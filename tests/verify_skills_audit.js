const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const { ROOT: WORKSPACE, loadCombinedContentJs } = require("./load-content");
const bgCode = fs.readFileSync(path.join(WORKSPACE, "background.js"), "utf8");
const contentCode = loadCombinedContentJs();
const registry = JSON.parse(fs.readFileSync(path.join(WORKSPACE, "skills", "registry.json"), "utf8"));

// Minimal DOM implementation sufficient for customize-page, modal, and toast testing
class MiniNode {
  constructor(tagName = "DIV") {
    this.nodeType = 1;
    this.tagName = String(tagName).toUpperCase();
    this.children = [];
    this.childNodes = this.children;
    this.parentNode = null;
    this.attrs = {};
    this.dataset = {};
    this.style = {};
    this._text = "";
    this.listeners = {};
    this.id = "";
    this.className = "";
    this.classList = {
      _set: () => new Set(String(this.className || "").split(/\s+/).filter(Boolean)),
      add: (...cls) => {
        const s = this.classList._set();
        cls.forEach(c => s.add(c));
        this.className = [...s].join(" ");
      },
      remove: (...cls) => {
        const s = this.classList._set();
        cls.forEach(c => s.delete(c));
        this.className = [...s].join(" ");
      },
      contains: c => this.classList._set().has(c)
    };
  }
  get isConnected() { return Boolean(this.parentNode || this.tagName === "BODY" || this.tagName === "HTML"); }
  get textContent() {
    if (this.children.length === 0) return this._text;
    return this._text + this.children.map(c => c.textContent).join("");
  }
  set textContent(v) {
    this.children.length = 0;
    this._text = String(v == null ? "" : v);
  }
  appendChild(ch) {
    if (!ch) return ch;
    if (ch.parentNode) {
      const i = ch.parentNode.children.indexOf(ch);
      if (i >= 0) ch.parentNode.children.splice(i, 1);
    }
    ch.parentNode = this;
    this.children.push(ch);
    return ch;
  }
  replaceChildren(...nodes) {
    this.children.forEach(c => { c.parentNode = null; });
    this.children.length = 0;
    this._text = "";
    nodes.forEach(n => { if (n) this.appendChild(n); });
  }
  remove() {
    if (!this.parentNode) return;
    const i = this.parentNode.children.indexOf(this);
    if (i >= 0) this.parentNode.children.splice(i, 1);
    this.parentNode = null;
  }
  setAttribute(k, v) {
    this.attrs[k] = String(v);
    if (k === "id") this.id = String(v);
    if (k === "class") this.className = String(v);
  }
  getAttribute(k) {
    if (k === "id") return this.id || this.attrs.id || null;
    if (k === "class") return this.className || this.attrs.class || null;
    return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null;
  }
  removeAttribute(k) {
    delete this.attrs[k];
    if (k === "id") this.id = "";
    if (k === "class") this.className = "";
  }
  hasAttribute(k) { return this.getAttribute(k) !== null; }
  addEventListener(ev, fn) {
    (this.listeners[ev] = this.listeners[ev] || []).push(fn);
  }
  removeEventListener(ev, fn) {
    if (!this.listeners[ev]) return;
    this.listeners[ev] = this.listeners[ev].filter(f => f !== fn);
  }
  click() {
    (this.listeners.click || []).forEach(fn => fn({ target: this, preventDefault() {}, stopPropagation() {} }));
  }
  _matchesOne(sel) {
    sel = sel.trim();
    if (!sel) return false;
    // Handle descendant chains by checking last segment + ancestors
    if (sel.includes(" ")) {
      const parts = sel.split(/\s+/).filter(Boolean);
      if (!this._matchesOne(parts[parts.length - 1])) return false;
      let cur = this.parentNode;
      let pIdx = parts.length - 2;
      while (cur && pIdx >= 0) {
        if (cur._matchesOne(parts[pIdx])) pIdx--;
        cur = cur.parentNode;
      }
      return pIdx < 0;
    }
    let rest = sel;
    // Extract attribute selectors
    const attrChecks = [];
    rest = rest.replace(/\[([^\]]+)\]/g, (_, inner) => {
      const m = inner.match(/^([^=*~|^$]+)(?:([*~|^$]?=)["']?([^"']*)["']?)?$/);
      if (m) attrChecks.push({ name: m[1].trim(), op: m[2] || "", val: m[3] ?? "" });
      return "";
    });
    // Tag, #id, .class
    const tagMatch = rest.match(/^[a-zA-Z0-9_-]+/);
    if (tagMatch && this.tagName !== tagMatch[0].toUpperCase()) return false;
    const idMatch = rest.match(/#([a-zA-Z0-9_-]+)/);
    if (idMatch && this.id !== idMatch[1]) return false;
    const classMatches = [...rest.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map(m => m[1]);
    for (const c of classMatches) {
      if (!this.classList.contains(c)) return false;
    }
    for (const ac of attrChecks) {
      const got = this.getAttribute(ac.name);
      if (!ac.op) {
        if (got === null) return false;
      } else if (ac.op === "=") {
        if (got !== ac.val) return false;
      } else if (ac.op === "*=") {
        if (got === null || !got.includes(ac.val)) return false;
      }
    }
    return true;
  }
  matches(selector) {
    return String(selector).split(",").some(s => this._matchesOne(s));
  }
  closest(selector) {
    let cur = this;
    while (cur) {
      if (cur.matches(selector)) return cur;
      cur = cur.parentNode;
    }
    return null;
  }
  querySelectorAll(selector) {
    const out = [];
    const walk = node => {
      for (const ch of node.children) {
        if (ch.nodeType === 1) {
          if (ch.matches(selector)) out.push(ch);
          walk(ch);
        }
      }
    };
    walk(this);
    return out;
  }
  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }
}

function buildCustomizeSkillsDom(installedSkills, catalogSkills) {
  const docRoot = new MiniNode("BODY");
  const page = new MiniNode("CUSTOMIZE-PAGE");
  const tabBtn = new MiniNode("BUTTON");
  tabBtn.setAttribute("role", "tab");
  tabBtn.setAttribute("data-tab", "skills");
  tabBtn.setAttribute("aria-selected", "true");
  page.appendChild(tabBtn);

  const header = new MiniNode("HEADER");
  header.className = "page-header";
  const createBtn = new MiniNode("GEM-BUTTON");
  createBtn.className = "create-dropdown-button";
  header.appendChild(createBtn);
  page.appendChild(header);

  const sec1 = new MiniNode("SECTION");
  sec1.className = "category-section";
  const grid1 = new MiniNode("DIV");
  grid1.className = "skills-grid";
  for (const s of installedSkills) {
    const card = new MiniNode("CUSTOMIZE-CARD");
    const primary = new MiniNode("BUTTON");
    primary.className = "card-primary-action";
    primary.setAttribute("data-card-id", s.cardId);
    primary.setAttribute("aria-label", `${s.title}, ${s.subtitle}`);
    card.appendChild(primary);

    const content = new MiniNode("DIV");
    content.className = "content";
    const titleWrap = new MiniNode("DIV");
    titleWrap.className = "title";
    const titleText = new MiniNode("SPAN");
    titleText.className = "title-text";
    titleText.textContent = s.title;
    titleWrap.appendChild(titleText);
    const sub = new MiniNode("DIV");
    sub.className = "subtitle";
    sub.textContent = s.subtitle;
    content.appendChild(titleWrap);
    content.appendChild(sub);
    card.appendChild(content);

    const action = new MiniNode("DIV");
    action.className = "card-action-container";
    const more = new MiniNode("GEM-ICON-BUTTON");
    more.className = "more-button";
    more.setAttribute("fonticonname", "more_horiz");
    action.appendChild(more);
    card.appendChild(action);
    grid1.appendChild(card);
  }
  sec1.appendChild(grid1);
  page.appendChild(sec1);

  const sec2 = new MiniNode("SECTION");
  sec2.className = "category-section";
  const grid2 = new MiniNode("DIV");
  grid2.className = "skills-grid";
  for (const c of catalogSkills) {
    const card = new MiniNode("CUSTOMIZE-CARD");
    const primary = new MiniNode("BUTTON");
    primary.className = "card-primary-action";
    primary.setAttribute("data-card-id", c.cardId);
    card.appendChild(primary);

    const content = new MiniNode("DIV");
    content.className = "content";
    const titleText = new MiniNode("SPAN");
    titleText.className = "title-text";
    titleText.textContent = c.title;
    const sub = new MiniNode("DIV");
    sub.className = "subtitle";
    sub.textContent = c.subtitle;
    content.appendChild(titleText);
    content.appendChild(sub);
    card.appendChild(content);

    const action = new MiniNode("DIV");
    action.className = "card-action-container";
    const addBtn = new MiniNode("GEM-ICON-BUTTON");
    addBtn.className = "add-button";
    addBtn.setAttribute("fonticonname", "add");
    action.appendChild(addBtn);
    card.appendChild(action);
    grid2.appendChild(card);
  }
  sec2.appendChild(grid2);
  page.appendChild(sec2);
  docRoot.appendChild(page);

  const footer = new MiniNode("SIDENAV-MAVATAR-FOOTER");
  const acctLink = new MiniNode("A");
  acctLink.setAttribute("aria-label", "Google Account: Test User (tester@example.com)");
  footer.appendChild(acctLink);
  docRoot.appendChild(footer);

  return docRoot;
}

async function runTests() {
  // =========================================================================
  // TEST 1: background.js scanner (extractor, singleflight, TTL cache, cleanup)
  // =========================================================================
  const sessionStore = {};
  let nextTabId = 500;
  let createdTabs = [];
  let removedTabs = [];
  let onUpdatedListeners = [];

  const sampleInstalled = registry.skills.slice(0, 11).map((s, idx) => ({
    cardId: `00000000-0000-4000-8000-${String(idx + 1).padStart(12, "0")}`,
    title: s.id,
    subtitle: s.description
  }));
  const sampleCatalog = [
    { cardId: "match-my-writing-style", title: "Mô phỏng phong cách viết", subtitle: "Học theo giọng văn của bạn" },
    { cardId: "focus-my-energy", title: "Làm việc theo mức năng lượng", subtitle: "Sắp xếp khối lượng công việc" }
  ];

  const bgSandbox = {
    console,
    setTimeout,
    clearTimeout,
    URL,
    Date,
    Promise,
    Set,
    Map,
    Array,
    Object,
    String,
    Number,
    Boolean,
    RegExp,
    JSON,
    Math,
    navigator: { userAgent: "Chrome/130" },
    chrome: {
      runtime: {
        id: "test-ext",
        onInstalled: { addListener() {} },
        onConnect: { addListener() {} },
        onMessage: { addListener() {} },
        getManifest: () => ({}),
        getURL: p => `chrome-extension://test-ext/${p}`
      },
      commands: { onCommand: { addListener() {} } },
      permissions: { onRemoved: { addListener() {} }, contains: async () => false },
      storage: {
        local: { get: (k, cb) => cb && cb({}), set: (v, cb) => cb && cb(), remove: (k, cb) => cb && cb() },
        sync: { get: async () => ({}), set: async () => {}, remove: async () => {} },
        session: {
          get: async keys => {
            if (typeof keys === "string") return { [keys]: sessionStore[keys] };
            return { ...sessionStore };
          },
          set: async obj => { Object.assign(sessionStore, obj); }
        }
      },
      tabs: {
        onActivated: { addListener() {} },
        onRemoved: { addListener() {} },
        onUpdated: {
          addListener(fn) { onUpdatedListeners.push(fn); },
          removeListener(fn) { onUpdatedListeners = onUpdatedListeners.filter(x => x !== fn); }
        },
        query: async () => [],
        create: async opts => {
          const id = nextTabId++;
          createdTabs.push({ id, ...opts });
          setTimeout(() => {
            onUpdatedListeners.slice().forEach(fn => fn(id, { status: "complete" }));
          }, 5);
          return { id, url: opts.url };
        },
        remove: async id => { removedTabs.push(id); },
        get: async id => ({ id, status: "complete" })
      },
      scripting: {
        executeScript: async ({ func, args }) => {
          const mockBody = buildCustomizeSkillsDom(sampleInstalled, sampleCatalog);
          const mockDoc = {
            body: mockBody,
            documentElement: mockBody,
            querySelector: sel => mockBody.querySelector(sel),
            querySelectorAll: sel => mockBody.querySelectorAll(sel)
          };
          const mockWin = { location: { pathname: "/u/3/customize/skills" } };
          const wrapped = new Function("document", "window", `return (${func.toString()}).apply(null, arguments[2]);`);
          const result = wrapped(mockDoc, mockWin, args || []);
          return [{ result }];
        }
      }
    }
  };
  vm.createContext(bgSandbox);
  vm.runInContext(bgCode, bgSandbox);

  // Singleflight test: two concurrent calls create only 1 background tab
  const [scanA, scanB] = await Promise.all([
    bgSandbox.handleScanUserSkillsEntries({ url: "https://gemini.google.com/u/3/customize/skills", accountIndex: "3", forceFresh: false, bundleVersion: "1.1.0" }, { tab: { windowId: 1 } }),
    bgSandbox.handleScanUserSkillsEntries({ url: "https://gemini.google.com/u/3/customize/skills", accountIndex: "3", forceFresh: false, bundleVersion: "1.1.0" }, { tab: { windowId: 1 } })
  ]);
  assert.strictEqual(createdTabs.length, 1, "Singleflight must open exactly 1 bg tab for concurrent scans");
  assert.strictEqual(removedTabs.length, 1, "Ephemeral bg tab must be removed in finally");
  assert.strictEqual(scanA.ok, true);
  assert.strictEqual(scanA.verified, true);
  assert.strictEqual(scanA.skills.length, 11, "Must extract exactly 11 installed cards and exclude catalog add-button cards");
  assert.strictEqual(scanB.skills.length, 11);
  assert.strictEqual(scanA.email, "tester@example.com");

  // TTL cache hit test (forceFresh: false)
  const scanCached = await bgSandbox.handleScanUserSkillsEntries({ url: "https://gemini.google.com/u/3/customize/skills", accountIndex: "3", forceFresh: false, bundleVersion: "1.1.0" }, { tab: { windowId: 1 } });
  assert.strictEqual(createdTabs.length, 1, "TTL cache hit must open 0 new tabs");
  assert.strictEqual(scanCached.source, "cache");

  // Bundle version bump invalidates TTL cache
  const scanNewVer = await bgSandbox.handleScanUserSkillsEntries({ url: "https://gemini.google.com/u/3/customize/skills", accountIndex: "3", forceFresh: false, bundleVersion: "1.2.0" }, { tab: { windowId: 1 } });
  assert.strictEqual(createdTabs.length, 2, "Bundle version change must invalidate TTL cache");
  assert.strictEqual(removedTabs.length, 2);
  assert.strictEqual(scanNewVer.source, "bg_tab");

  // forceFresh: true (Popup open) always runs fresh scan
  const scanFresh = await bgSandbox.handleScanUserSkillsEntries({ url: "https://gemini.google.com/u/3/customize/skills", accountIndex: "3", forceFresh: true, bundleVersion: "1.2.0" }, { tab: { windowId: 1 } });
  assert.strictEqual(createdTabs.length, 3, "forceFresh:true must run fresh scan");
  assert.strictEqual(removedTabs.length, 3);
  assert.strictEqual(scanFresh.verified, true);

  console.log("PASS [V1]: background.js /customize/skills extractor, installed-vs-catalog filter, Singleflight, TTL cache, bundleVersion invalidation, and tab cleanup");

  // =========================================================================
  // TEST 2: content.js Audit Engine, 2-way Sync, Trigger 1 Toast, Trigger 2 Modal, Orchestrator
  // =========================================================================
  const localStore = { sgSkillsLocal: { overrides: {}, customSkills: {}, deletedIds: [] }, sgSkillMigrationLedger: {} };
  const sentMessages = [];
  let mockRemoteSkillsResponse = null;
  let mockRemoteSavedInfoResponse = { ok: true, verified: true, entries: [], source: "bg_tab" };

  const body = new MiniNode("BODY");
  const sidebarSkillItem = new MiniNode("DIV");
  sidebarSkillItem.id = "sg-skills-menu-item";
  body.appendChild(sidebarSkillItem);
  const acctEl = new MiniNode("A");
  acctEl.setAttribute("aria-label", "Google Account: Test User (tester@example.com)");
  body.appendChild(acctEl);

  const mockDocument = {
    body,
    documentElement: body,
    head: new MiniNode("HEAD"),
    activeElement: null,
    createElement: tag => new MiniNode(tag),
    createTextNode: txt => {
      const n = new MiniNode("#TEXT");
      n.nodeType = 3;
      n._text = String(txt);
      return n;
    },
    getElementById: id => body.querySelector(`#${id}`),
    querySelector: sel => body.querySelector(sel),
    querySelectorAll: sel => body.querySelectorAll(sel),
    addEventListener() {},
    removeEventListener() {}
  };

  // Load only the Skills & Orchestrator helpers into a clean VM slice
  const bundledSkillsWithContent = registry.skills.map(s => ({
    ...s,
    content: `# ${s.name}\n\nInstructions for ${s.id}.`
  }));

  const contentSandbox = {
    console,
    setTimeout: (fn) => 0, // prevent auto-running background timers on script load
    clearTimeout() {},
    requestAnimationFrame: fn => fn(),
    Node: MiniNode,
    Element: MiniNode,
    document: mockDocument,
    window: {
      location: { pathname: "/u/3/app", href: "https://gemini.google.com/u/3/app" },
      addEventListener() {},
      removeEventListener() {},
      getComputedStyle: () => ({ visibility: "visible", display: "block" })
    },
    isDarkTheme: () => true,
    getGoogleAccountIndex: () => "3",
    sgObserverRegistry: { registerUIRefresh() {}, registerInput() {} },
    showToast: () => {},
    safeLocalStorageSet: async obj => { Object.assign(localStore, obj); return true; },
    chrome: {
      runtime: {
        lastError: null,
        sendMessage: (msg, cb) => {
          sentMessages.push(msg);
          if (msg.type === "GET_BUNDLED_SKILLS") {
            cb && cb({ ok: true, bundleVersion: registry.bundleVersion, skills: bundledSkillsWithContent });
            return;
          }
          if (msg.type === "GET_BUNDLED_BASELINE") {
            cb && cb({ ok: true, bundleVersion: "1.1.0", instructions: [] });
            return;
          }
          if (msg.type === "SCAN_USER_SKILLS_ENTRIES") {
            cb && cb(mockRemoteSkillsResponse);
            return;
          }
          if (msg.type === "SCAN_SAVED_INFO_ENTRIES") {
            cb && cb(mockRemoteSavedInfoResponse);
            return;
          }
          cb && cb({ ok: true });
        },
        onMessage: { addListener() {} }
      },
      storage: {
        local: {
          get: (keys, cb) => {
            const res = {};
            (Array.isArray(keys) ? keys : [keys]).forEach(k => { res[k] = localStore[k]; });
            cb && cb(res);
          },
          set: (obj, cb) => { Object.assign(localStore, obj); cb && cb(); }
        },
        sync: { get: (k, cb) => cb && cb({}), set: (o, cb) => cb && cb() },
        onChanged: { addListener() {} }
      }
    }
  };
  vm.createContext(contentSandbox);

  // Extract Skills + Orchestrator sections from content.js cleanly
  const startMarker = 'const SG_SKILLS_LOCAL_KEY = "sgSkillsLocal";';
  const endMarker = "initSkillsRegistrySystem();";
  const skillsStart = contentCode.indexOf(startMarker);
  const skillsEnd = contentCode.indexOf(endMarker) + endMarker.length;
  assert(skillsStart > 0 && skillsEnd > skillsStart, "Must locate Skills subsystem in content.js");

  const orchStart = contentCode.indexOf("function sgOrchDefaultConfig");
  const orchEnd = contentCode.indexOf("function sgBuildOrchestratorPlannerPrompt");
  assert(orchStart > 0 && orchEnd > orchStart, "Must locate Orchestrator readiness in content.js");

  const toastStart = contentCode.indexOf("const MAX_TOASTS = 5;");
  const toastEnd = contentCode.indexOf("function trapFocusInModal");

  vm.runInContext(
    contentCode.slice(toastStart, toastEnd) + "\n" +
    "function initSkillAutocomplete(){}\nfunction initSkillPreSendInterceptor(){}\n" +
    contentCode.slice(skillsStart, skillsEnd) + "\n" +
    "const SG_ORCH_DEFAULT_MAX_SUBAGENTS = 2; const SG_ORCH_MAX_SUBAGENTS = 4;\nconst _sgOrchChatLoadedHashes = new Map();\nfunction sgOrchGetAccountScope(){ return 'u3'; }\n" +
    contentCode.slice(orchStart, orchEnd),
    contentSandbox
  );

  // Scenario 2A: All 12 bundled skills installed on /customize/skills -> 0 missing, 0 toast, Orchestrator Compact Ready!
  const all12Installed = registry.skills.map((s, i) => ({
    cardId: `uuid-${i}`,
    title: s.id,
    subtitle: s.description
  }));
  mockRemoteSkillsResponse = { ok: true, verified: true, skills: all12Installed, email: "tester@example.com", source: "bg_tab", scannedAt: Date.now() };

  const auditAll = await contentSandbox.sgRunPageLoadBundledSkillsAudit({ force: true });
  assert.strictEqual(auditAll.audit.verified, true);
  assert.strictEqual(auditAll.audit.totalBundled, 12);
  assert.strictEqual(auditAll.audit.installedCount, 12);
  assert.strictEqual(auditAll.audit.missingBundled.length, 0);
  assert.strictEqual(mockDocument.getElementById("sg-missing-skills-toast"), null, "No toast when all 12 bundled skills are installed");
  assert.strictEqual(sidebarSkillItem.classList.contains("sg-has-missing-skills"), false);

  const loaded1 = await contentSandbox.loadEffectiveSkills();
  const readinessAll = contentSandbox.sgOrchResolveSkillReadiness(loaded1.skills, { mode: "in_chat" });
  assert.strictEqual(readinessAll.orchestrateReady, true, "Orchestrator must immediately switch to Compact Ready after Trigger 1 checkpoints @orchestrate-mode");
  assert.strictEqual(readinessAll.orchestrateSource, "account_synced");
  console.log("PASS [V2]: Trigger 1 (all 12 installed) -> auto-checkpoints ledger, 0 toast, Orchestrator Compact Ready");

  // Scenario 2B: User deletes orchestrate-mode on /customize/skills -> Verified removal prunes ledger, updates badge, Orchestrator falls back to Full Injector, and NO toast pops up
  const only11Installed = all12Installed.filter(c => c.title !== "orchestrate-mode");
  mockRemoteSkillsResponse = { ok: true, verified: true, skills: only11Installed, email: "tester@example.com", source: "bg_tab", scannedAt: Date.now() };
  const auditMissing = await contentSandbox.sgRunPageLoadBundledSkillsAudit({ force: true });
  assert.strictEqual(auditMissing.audit.installedCount, 11);
  assert.strictEqual(auditMissing.audit.missingBundled.length, 1);
  assert.strictEqual(auditMissing.audit.missingBundled[0].id, "orchestrate-mode");
  assert.strictEqual(auditMissing.diff.statusById["orchestrate-mode"], "removed", "Deleted skill must be flagged as removed");
  assert.strictEqual(mockDocument.getElementById("sg-missing-skills-toast"), null, "Missing-skills reminder toast must NOT appear");
  assert.strictEqual(sidebarSkillItem.classList.contains("sg-has-missing-skills"), true, "Sidebar badge dot must be enabled");

  const readinessAfterRemoval = contentSandbox.sgOrchResolveSkillReadiness(loaded1.skills, { mode: "in_chat" });
  assert.strictEqual(readinessAfterRemoval.orchestrateReady, false, "Orchestrator must fall back to Full Injector after verified removal");
  console.log("PASS [V3]: Verified removal on /customize/skills -> prunes ledger, updates badge without toast, forces Orchestrator Full Injector");

  // Scenario 2C: Unverified scan failure NEVER prunes existing ledger entries!
  mockRemoteSkillsResponse = { ok: false, verified: false, skills: [], source: "error" };
  const auditFailed = await contentSandbox.sgRunPageLoadBundledSkillsAudit({ force: true, suppressToast: true });
  assert.strictEqual(auditFailed.audit.verified, false);
  const ledgerAfterFail = localStore.sgSkillMigrationLedger["u_3:tester@example.com"].migrated;
  assert.strictEqual(Object.keys(ledgerAfterFail).length, 11, "Failed/unverified scan must NEVER prune existing ledger entries");
  console.log("PASS [V4]: Unverified remote scan guard preserves local ledger safely");

  // Scenario 2D: Background/Temp worker page skips Trigger 1 completely
  const msgCountBeforeWorker = sentMessages.length;
  body.dataset.sgBgWorker = "true";
  const workerAudit = await contentSandbox.sgRunPageLoadBundledSkillsAudit({ force: true });
  assert.strictEqual(workerAudit, null, "Background worker tab must skip page-load audit");
  assert.strictEqual(sentMessages.length, msgCountBeforeWorker, "Background worker tab must send 0 scan messages");
  delete body.dataset.sgBgWorker;
  console.log("PASS [V5]: Background/Temp-Chat worker guard prevents recursive scans");

  // Scenario 2E: Trigger 2 (Popup Migrate Skills & Baseline) -> fresh scan on open, tab-switch dedup, fresh scan on reopen
  mockRemoteSkillsResponse = { ok: true, verified: true, skills: only11Installed, email: "tester@example.com", source: "bg_tab", scannedAt: Date.now() };
  const skillsScansBefore = sentMessages.filter(m => m.type === "SCAN_USER_SKILLS_ENTRIES").length;
  const savedInfoScansBefore = sentMessages.filter(m => m.type === "SCAN_SAVED_INFO_ENTRIES").length;

  await contentSandbox.showSkillsModal({ tab: "skills" });
  const skillsScansAfterOpen = sentMessages.filter(m => m.type === "SCAN_USER_SKILLS_ENTRIES");
  assert.strictEqual(skillsScansAfterOpen.length, skillsScansBefore + 1, "Opening popup on Skills tab must run 1 fresh SCAN_USER_SKILLS_ENTRIES");
  assert.strictEqual(skillsScansAfterOpen[skillsScansAfterOpen.length - 1].forceFresh, true, "Popup open scan must pass forceFresh: true");
  assert.strictEqual(sentMessages.filter(m => m.type === "SCAN_SAVED_INFO_ENTRIES").length, savedInfoScansBefore, "Opening Skills tab must NOT scan /saved-info");

  const overlay = mockDocument.getElementById("sg-skills-modal-overlay");
  assert.ok(overlay, "Skills modal overlay must mount");
  const auditBanner = overlay.querySelector(".sg-audit-banner");
  assert.ok(auditBanner && auditBanner.classList.contains("is-warn"), "Audit banner must show warning state for missing bundled skill");
  assert.ok(auditBanner.textContent.includes("orchestrate-mode"), "Audit banner must name missing skill");

  // Switch to Baseline tab -> triggers 1 fresh SCAN_SAVED_INFO_ENTRIES
  const tabs = overlay.querySelectorAll('[role="tab"]');
  tabs[1].click();
  await new Promise(r => setTimeout(r, 20));
  assert.strictEqual(sentMessages.filter(m => m.type === "SCAN_SAVED_INFO_ENTRIES").length, savedInfoScansBefore + 1, "Switching to Baseline tab must scan /saved-info once");

  // Switch back to Skills tab in same modal session -> must NOT rescan /customize/skills again
  const tabs2 = overlay.querySelectorAll('[role="tab"]');
  tabs2[0].click();
  await new Promise(r => setTimeout(r, 20));
  assert.strictEqual(sentMessages.filter(m => m.type === "SCAN_USER_SKILLS_ENTRIES").length, skillsScansBefore + 1, "Switching back to Skills tab within same modal session must reuse snapshot");

  // Re-open popup -> MUST fire another fresh scan!
  await contentSandbox.showSkillsModal({ tab: "skills" });
  assert.strictEqual(sentMessages.filter(m => m.type === "SCAN_USER_SKILLS_ENTRIES").length, skillsScansBefore + 2, "Re-opening popup must fire a new fresh scan");

  // Verify migrate pill has NO adjacent text and toggling preserves scrollTop
  const reopenedOverlay = mockDocument.getElementById("sg-skills-modal-overlay");
  const migratePills = reopenedOverlay.querySelectorAll(".sg-skill-migrate-pill");
  assert.ok(migratePills.length > 0, "Expected migrate pills on Skills tab");
  for (const pill of migratePills) {
    assert.strictEqual(pill.textContent.trim(), "", "Migrate pill must have no adjacent text label");
    assert.ok(pill.getAttribute("title"), "Migrate pill should keep hover title tooltip");
  }
  const scrollBody = reopenedOverlay.querySelector(".sg-skills-body");
  scrollBody.scrollTop = 420;
  const firstCb = migratePills[0].querySelector(".sg-skill-migrate-checkbox");
  firstCb.checked = !firstCb.checked;
  (firstCb.listeners.change || []).forEach(fn => fn({ target: firstCb }));
  await new Promise(r => setTimeout(r, 20));
  const afterBody = reopenedOverlay.querySelector(".sg-skills-body");
  assert.strictEqual(afterBody.scrollTop, 420, "Toggling migrate checkbox must preserve .sg-skills-body scrollTop");

  console.log("PASS [V6]: Trigger 2 (Migrate Skills & Baseline popup) -> forceFresh scan on every open, Skills vs Baseline source split, tab-switch dedup, Audit Banner, clean checkbox-only pill & scroll preservation");

  console.log("\nALL SUITE V BUNDLED SKILLS AUDIT TESTS PASSED!");
}

runTests().catch(err => {
  console.error("TEST FAILED:", err);
  process.exit(1);
});
