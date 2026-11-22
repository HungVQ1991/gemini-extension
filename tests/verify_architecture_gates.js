const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");
const { ROOT, getContentScriptFiles, loadFile, loadCombinedContentJs } = require("./load-content");

function createMockElement(tagName, ownerDocument) {
  const attrs = new Map();
  const children = [];
  const classSet = new Set();
  const styleObj = {
    cssText: "",
    setProperty() {},
    removeProperty() {}
  };
  const el = {
    nodeType: 1,
    tagName: String(tagName || "div").toUpperCase(),
    id: "",
    ownerDocument,
    children,
    childNodes: children,
    parentNode: null,
    parentElement: null,
    style: styleObj,
    dataset: {},
    textContent: "",
    innerText: "",
    value: "",
    classList: {
      add(...cls) { cls.forEach(c => classSet.add(c)); },
      remove(...cls) { cls.forEach(c => classSet.delete(c)); },
      toggle(c, force) {
        if (typeof force === "boolean") {
          force ? classSet.add(c) : classSet.delete(c);
          return force;
        }
        if (classSet.has(c)) { classSet.delete(c); return false; }
        classSet.add(c); return true;
      },
      contains(c) { return classSet.has(c); }
    },
    get className() { return Array.from(classSet).join(" "); },
    set className(v) {
      classSet.clear();
      String(v || "").split(/\s+/).filter(Boolean).forEach(c => classSet.add(c));
    },
    setAttribute(k, v) { attrs.set(String(k), String(v)); },
    getAttribute(k) { return attrs.has(String(k)) ? attrs.get(String(k)) : null; },
    hasAttribute(k) { return attrs.has(String(k)); },
    removeAttribute(k) { attrs.delete(String(k)); },
    appendChild(child) {
      if (child && typeof child === "object") {
        child.parentNode = el;
        child.parentElement = el;
        children.push(child);
      }
      return child;
    },
    insertBefore(child, ref) {
      const idx = ref ? children.indexOf(ref) : -1;
      if (child && typeof child === "object") {
        child.parentNode = el;
        child.parentElement = el;
        if (idx >= 0) children.splice(idx, 0, child);
        else children.push(child);
      }
      return child;
    },
    removeChild(child) {
      const idx = children.indexOf(child);
      if (idx >= 0) children.splice(idx, 1);
      if (child) { child.parentNode = null; child.parentElement = null; }
      return child;
    },
    replaceChildren(...nodes) {
      children.forEach(c => { if (c) { c.parentNode = null; c.parentElement = null; } });
      children.length = 0;
      nodes.forEach(n => el.appendChild(n));
    },
    remove() {
      if (el.parentNode && typeof el.parentNode.removeChild === "function") el.parentNode.removeChild(el);
    },
    querySelector(sel) {
      const s = String(sel || "").trim();
      const walk = (arr) => {
        for (const ch of arr) {
          if (!ch || typeof ch !== "object") continue;
          if (s.startsWith("#") && ch.id === s.slice(1)) return ch;
          if (s.startsWith(".") && ch.classList && ch.classList.contains(s.slice(1))) return ch;
          if (ch.children) {
            const hit = walk(ch.children);
            if (hit) return hit;
          }
        }
        return null;
      };
      return walk(children);
    },
    querySelectorAll() { return []; },
    closest() { return null; },
    matches() { return false; },
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() { return true; },
    getBoundingClientRect() { return { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }; },
    click() {},
    focus() {},
    blur() {},
    cloneNode() { return createMockElement(tagName, ownerDocument); }
  };
  return el;
}

function runAllContentModulesInVm({ hash, flushTimeouts }) {
  const storageOnChangedCalls = [];
  const runtimeOnMessageCalls = [];
  let moObserveCalls = 0;
  let intervalCalls = 0;
  let syncGetCalls = 0;
  const queuedTimers = [];
  let nextTimerId = 1;

  const doc = {
    hidden: false,
    readyState: "complete",
    addEventListener() {},
    removeEventListener() {},
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: () => null,
    elementsFromPoint: () => [],
    hasFocus: () => false,
    createElement(tag) { return createMockElement(tag, doc); },
    createElementNS(_ns, tag) { return createMockElement(tag, doc); },
    createTextNode(t) { return { nodeType: 3, textContent: String(t || "") }; },
    importNode(node) { return node; },
    activeElement: null
  };
  doc.documentElement = createMockElement("html", doc);
  doc.head = createMockElement("head", doc);
  doc.body = createMockElement("body", doc);
  doc.documentElement.appendChild(doc.head);
  doc.documentElement.appendChild(doc.body);
  doc.activeElement = doc.body;

  const win = {
    location: {
      href: `https://gemini.google.com/app${hash || ""}`,
      pathname: "/app",
      origin: "https://gemini.google.com",
      hash: hash || "",
      search: ""
    },
    innerWidth: 1280,
    innerHeight: 800,
    addEventListener() {},
    removeEventListener() {},
    getComputedStyle: () => ({ visibility: "visible", display: "block" }),
    getSelection: () => ({ rangeCount: 0, removeAllRanges() {}, addRange() {} }),
    navigator: { userAgent: "Chrome/130.0.0.0", clipboard: {} }
  };
  win.window = win;
  win.self = win;
  win.top = win;

  class MockMutationObserver {
    constructor(cb) { this.cb = cb; }
    observe() { moObserveCalls++; }
    disconnect() {}
    takeRecords() { return []; }
  }

  const ls = new Map();
  const mockChrome = {
    runtime: {
      id: "test-ext-id",
      lastError: null,
      getURL: (p) => `chrome-extension://test-ext-id/${p}`,
      sendMessage: (_m, cb) => { if (typeof cb === "function") cb({}); return Promise.resolve({}); },
      onMessage: { addListener: fn => runtimeOnMessageCalls.push(fn) }
    },
    storage: {
      sync: {
        get(_keys, cb) {
          syncGetCalls++;
          const res = { extensionEnabled: true };
          if (typeof cb === "function") cb(res);
          return Promise.resolve(res);
        },
        set(_obj, cb) { if (typeof cb === "function") cb(); return Promise.resolve(); },
        remove(_keys, cb) { if (typeof cb === "function") cb(); return Promise.resolve(); }
      },
      local: {
        get(_keys, cb) {
          const res = {};
          if (typeof cb === "function") cb(res);
          return Promise.resolve(res);
        },
        set(_obj, cb) { if (typeof cb === "function") cb(); return Promise.resolve(); },
        getBytesInUse(_k, cb) { if (typeof cb === "function") cb(0); return Promise.resolve(0); }
      },
      onChanged: { addListener: fn => storageOnChangedCalls.push(fn) }
    }
  };

  const ctx = vm.createContext({
    window: win,
    self: win,
    top: win,
    document: doc,
    location: win.location,
    navigator: win.navigator,
    chrome: mockChrome,
    MutationObserver: MockMutationObserver,
    HTMLElement: function HTMLElement() {},
    Node: { ELEMENT_NODE: 1, TEXT_NODE: 3 },
    Event: function Event(t, o) { this.type = t; Object.assign(this, o); },
    CustomEvent: function CustomEvent(t, o) { this.type = t; this.detail = o && o.detail; },
    URL,
    URLSearchParams,
    Blob: function Blob() {},
    File: function File() {},
    FileReader: function FileReader() {},
    DOMParser: class {
      parseFromString(str) {
        const b = createMockElement("body", doc);
        b.innerText = str;
        return { body: b };
      }
    },
    localStorage: {
      getItem: k => ls.has(k) ? ls.get(k) : null,
      setItem: (k, v) => ls.set(k, String(v)),
      removeItem: k => ls.delete(k)
    },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    setTimeout(fn, delay) {
      const id = nextTimerId++;
      if (typeof fn === "function") queuedTimers.push({ id, fn, delay: Number(delay) || 0, cleared: false });
      return id;
    },
    clearTimeout(id) {
      const t = queuedTimers.find(x => x.id === id);
      if (t) t.cleared = true;
    },
    setInterval() {
      intervalCalls++;
      return nextTimerId++;
    },
    clearInterval() {},
    requestAnimationFrame: () => 1,
    cancelAnimationFrame() {},
    fetch: () => Promise.resolve({ ok: true, json: async () => ({}), text: async () => "" }),
    Map, Set, WeakMap, WeakSet, Promise, Date, Array, Object, Boolean, Number, String, RegExp, Math, JSON, Error, console
  });
  ctx.globalThis = ctx;

  const files = getContentScriptFiles();
  for (const rel of files) {
    vm.runInContext(loadFile(rel), ctx, { filename: rel });
  }

  let flushedCount = 0;
  if (flushTimeouts) {
    // Execute captured setTimeout callbacks up to a bounded cap so retry loops don't spin infinitely
    let cursor = 0;
    const cap = 150;
    while (cursor < queuedTimers.length && flushedCount < cap) {
      const item = queuedTimers[cursor++];
      if (!item.cleared) {
        flushedCount++;
        item.fn();
      }
    }
  }

  return {
    ctx,
    storageOnChangedCalls,
    runtimeOnMessageCalls,
    moObserveCalls,
    intervalCalls,
    syncGetCalls,
    flushedCount
  };
}

function countCssBraceBalance(cssText) {
  const clean = cssText
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, "");
  let depth = 0;
  let minDepth = 0;
  for (const ch of clean) {
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth < minDepth) minDepth = depth;
    }
  }
  return { depth, minDepth };
}

(async () => {
  // =========================================================================
  // [G1] Manifest v2.0.0, Modular Layout <= 3500L, Full JS Syntax Validation
  // =========================================================================
  {
    const manifest = JSON.parse(loadFile("manifest.json"));
    assert.strictEqual(manifest.version, "2.0.0", "Extension SemVer must be 2.0.0");
    assert.ok(Array.isArray(manifest.permissions) && manifest.permissions.includes("alarms"), "manifest.json must declare alarms permission");
    assert.strictEqual(fs.existsSync(path.join(ROOT, "content.js")), false, "Monolithic content.js must not exist");

    const csFiles = getContentScriptFiles();
    assert.strictEqual(csFiles.length, 20, `Expected 20 content script modules, found ${csFiles.length}`);
    for (const rel of csFiles) {
      const abs = path.join(ROOT, rel);
      assert.ok(fs.existsSync(abs), `Missing manifest script: ${rel}`);
      const code = loadFile(rel);
      const lineCount = code.split(/\r?\n/).length;
      assert.ok(lineCount <= 3500, `${rel} exceeds 3500 line cap (got ${lineCount})`);
      new vm.Script(code, { filename: rel });
    }

    for (const topJs of ["background.js", "popup.js", "spoof_injector.js", "diagram-sandbox.js", "drive-auth.js"]) {
      const code = loadFile(topJs);
      new vm.Script(code, { filename: topJs });
    }
  }
  console.log("PASS [G1]: Manifest v2.0.0, 20-module content layout (all <= 3500L), full extension JS syntax verified");

  // =========================================================================
  // [G2] Security Hygiene (0 eval/new Function, 0 CDN URLs, 0 HTML Write Sinks)
  // =========================================================================
  {
    const forbiddenEval = /\beval\s*\(|new\s+Function\b/;
    const forbiddenCdn = /https?:\/\/(?:cdn\.jsdelivr\.net|unpkg\.com|cdnjs\.cloudflare\.com)/i;
    const forbiddenHtmlSinks = /\.(?:innerHTML|outerHTML)\s*[+]?=|\binsertAdjacentHTML\s*\(|\bdocument\.write\s*\(/;

    for (const rel of getContentScriptFiles()) {
      const code = loadFile(rel);
      assert.strictEqual(forbiddenEval.test(code), false, `${rel} contains eval / new Function`);
      assert.strictEqual(forbiddenCdn.test(code), false, `${rel} contains external CDN URL`);
      assert.strictEqual(forbiddenHtmlSinks.test(code), false, `${rel} contains forbidden HTML write sink`);
    }

    const combined = loadCombinedContentJs();
    const directSyncGets = combined.split(/\r?\n/).filter(l => /chrome\.storage\.sync\.get\s*\(/.test(l));
    assert.strictEqual(directSyncGets.length, 2, `Combined direct chrome.storage.sync.get( count must stay 2 (found ${directSyncGets.length})`);
  }
  console.log("PASS [G2]: Security & MV3 CSP hygiene (0 eval/new Function, 0 CDN URLs, 0 HTML write sinks, 2 sync.get) verified");

  // =========================================================================
  // [G3] Runtime Bus Consolidation & Silent Worker Zero-Side-Effect Proof
  // =========================================================================
  {
    const normalRun = runAllContentModulesInVm({ hash: "", flushTimeouts: false });
    assert.strictEqual(
      normalRun.storageOnChangedCalls.length,
      1,
      `Normal tab must register strictly 1 native chrome.storage.onChanged listener across all 20 modules (got ${normalRun.storageOnChangedCalls.length})`
    );
    assert.strictEqual(
      normalRun.runtimeOnMessageCalls.length,
      1,
      `Normal tab must register strictly 1 native chrome.runtime.onMessage listener across all 20 modules (got ${normalRun.runtimeOnMessageCalls.length})`
    );
    assert.strictEqual(normalRun.syncGetCalls, 1, "Normal tab bootstrap should perform only 1 cached sync.get(null)");

    for (const hash of ["#sg_orch_worker=1", "#sg_bg_worker=1"]) {
      const workerRun = runAllContentModulesInVm({ hash, flushTimeouts: true });
      await new Promise(r => setImmediate(r));
      assert.strictEqual(workerRun.moObserveCalls, 0, `${hash} must create 0 MutationObserver.observe calls even after timer flush (got ${workerRun.moObserveCalls})`);
      assert.strictEqual(workerRun.intervalCalls, 0, `${hash} must register 0 setInterval calls even after timer flush (got ${workerRun.intervalCalls})`);
      assert.strictEqual(workerRun.syncGetCalls, 0, `${hash} must issue 0 chrome.storage.sync.get IPCs even after timer flush (got ${workerRun.syncGetCalls})`);
      assert.strictEqual(workerRun.storageOnChangedCalls.length, 0, `${hash} must register 0 native storage.onChanged listeners`);
      assert.strictEqual(workerRun.runtimeOnMessageCalls.length, 0, `${hash} must register 0 native runtime.onMessage listeners`);
    }
  }
  console.log("PASS [G3]: Single runtime bus (1 storage + 1 message native listener) & silent worker 0 MO / 0 interval / 0 sync.get after timer flush verified");

  // =========================================================================
  // [G4] Skills Data & CSS Brace Integrity
  // =========================================================================
  {
    const baseline = JSON.parse(loadFile("skills/baseline.json"));
    assert.ok(Array.isArray(baseline.instructions) && baseline.instructions.length === 7, "skills/baseline.json must contain 7 baseline instructions");
    const baseIds = baseline.instructions.map(s => s && s.id);
    assert.strictEqual(new Set(baseIds).size, baseIds.length, "skills/baseline.json must have 0 duplicate IDs");

    const registry = JSON.parse(loadFile("skills/registry.json"));
    assert.ok(Array.isArray(registry.skills) && registry.skills.length === 12, "skills/registry.json must contain 12 registry skills");
    const regIds = registry.skills.map(s => s && s.id);
    assert.strictEqual(new Set(regIds).size, regIds.length, "skills/registry.json must have 0 duplicate IDs");

    for (const cssFile of ["content.css", "popup.css", "diagram-sandbox.css"]) {
      const bal = countCssBraceBalance(loadFile(cssFile));
      assert.strictEqual(bal.depth, 0, `${cssFile} has unbalanced braces (final depth=${bal.depth})`);
      assert.strictEqual(bal.minDepth, 0, `${cssFile} has stray closing brace (min depth=${bal.minDepth})`);
    }
  }
  console.log("PASS [G4]: Skills integrity (7 baseline + 12 registry unique IDs) and CSS brace balance verified");

  // =========================================================================
  // [G5] Token / Quota Usage Counter Resilience (No spoof_injector, No DOMParser, Retry on 400)
  // =========================================================================
  {
    const compJs = loadFile("content/legacy-composer-optimizer.js");
    const coreJs = loadFile("content/core-namespace.js");
    const ucStart = compJs.indexOf("let wordCounterElement = null,");
    const ucEnd = compJs.indexOf('SG_IS_SILENT_BG_WORKER_TAB || (sgObserverRegistry.registerUIRefresh("modeButtonTextObserver"');
    assert.ok(ucStart > 0 && ucEnd > ucStart, "Could not locate usage counter + word counter slice");
    let ucSlice = compJs.slice(ucStart, ucEnd);
    // Avoid top-level sgRegisterNavTick invocation inside isolated slice unless mocked
    const ucDoc = {
      hidden: false,
      addEventListener() {},
      removeEventListener() {},
      createElement(tag) { return createMockElement(tag, ucDoc); },
      createElementNS(_ns, tag) { return createMockElement(tag, ucDoc); },
      createTextNode(t) { return { nodeType: 3, textContent: String(t || "") }; },
      querySelector: () => null,
      querySelectorAll: (sel) => sel === "script"
        ? [{ textContent: 'window.WIZ_global_data = {"SNlM0e":"AT_DOM_TOKEN","FdrFJe":"-9876543210","cfb2h":"boq_bard_20261122"};' }]
        : []
    };
    ucDoc.documentElement = createMockElement("html", ucDoc);
    ucDoc.body = createMockElement("body", ucDoc);

    const fetchCalls = [];
    const ucLocalSet = [];
    const ucTimeouts = new Set();
    const ucCtx = vm.createContext({
      window: {
        location: { href: "https://gemini.google.com/u/1/app", pathname: "/u/1/app", hash: "" },
        innerWidth: 1280,
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent() {}
      },
      document: ucDoc,
      location: { href: "https://gemini.google.com/u/1/app", pathname: "/u/1/app", hash: "" },
      localStorage: { getItem: () => null, setItem() {} },
      chrome: {
        storage: {
          sync: { get: (_k, cb) => cb && cb({ extensionEnabled: true }), onChanged: { addListener() {} } },
          local: { get: (_k, cb) => cb && cb({}), set: (o) => ucLocalSet.push(o) }
        }
      },
      MutationObserver: class { observe() {} disconnect() {} },
      CustomEvent: function CustomEvent(t, o) { this.type = t; this.detail = o && o.detail; },
      fetch: async (url, opts) => {
        fetchCalls.push({ url, opts });
        if (fetchCalls.length === 1) {
          return { ok: false, status: 400, text: async () => "" };
        }
        return {
          ok: true,
          status: 200,
          text: async () => ')]}\'\n120\n[["wrb.fr","jSf9Qc","[1,[[0,0.42,1,[[1900000000,0]]],[0,0.15,2,[[1900500000,0]]]]]",null,null,null,"generic"]]\n'
        };
      },
      requestAnimationFrame: () => 1,
      setTimeout(fn, delay) {
        if (typeof fn !== "function") return 0;
        const h = setTimeout(() => {
          ucTimeouts.delete(h);
          fn();
        }, delay);
        ucTimeouts.add(h);
        return h;
      },
      clearTimeout(h) {
        ucTimeouts.delete(h);
        clearTimeout(h);
      },
      setInterval: () => 1,
      clearInterval() {},
      Map, Set, Promise, Date, Array, Object, Boolean, Number, String, Error, JSON, Math, RegExp, encodeURIComponent,
      getAccountRpcPrefix: () => "/u/1",
      getGoogleAccountIndex: () => "1",
      sgRegisterNavTick() {},
      checkForNavigation() {},
      checkWideChatNavigation() {},
      updateCounterPosition() {},
      bindComposerPosListeners() {},
      scheduleComposerWidgetsPosition() {},
      sgObserverRegistry: { registerUIRefresh() {} },
      isDarkTheme: () => false,
      restoreOptimizeButton() {},
      updateChatPlaceholder() {},
      findInputAnchor: () => null,
      findPromptInput: () => null,
      isGemInstructionsField: () => false,
      getHorizontalInputRect: () => ({ left: 0, right: 0 }),
      console: { log() {}, warn() {}, error() {} }
    });
    ucCtx.globalThis = ucCtx;
    try {
      // Deliberately leave DOMParser undefined to prove #sg-usage-counter and #sg-word-counter never need HTML parsing
      vm.runInContext(coreJs + "\n" + ucSlice, ucCtx);

      const tok = await ucCtx._ucGetTokens();
      assert.deepStrictEqual({ at: tok.at, sid: tok.sid, bl: tok.bl }, {
        at: "AT_DOM_TOKEN",
        sid: "-9876543210",
        bl: "boq_bard_20261122"
      }, "_ucGetTokens must extract negative FdrFJe and tokens directly from DOM <script> tags without spoof_injector");

      ucCtx.initWordCounter();
      const ucEl = vm.runInContext("dailyPromptCounterElement", ucCtx);
      const wcEl = vm.runInContext("wordCounterElement", ucCtx);
      assert.ok(ucEl, "#sg-usage-counter must be created without DOMParser");
      assert.ok(ucEl.querySelector(".sg-uc-summary"), ".sg-uc-summary must exist");
      assert.ok(ucEl.querySelector("#sg-uc-five-pct"), "#sg-uc-five-pct must exist");
      assert.ok(wcEl, "#sg-word-counter must be created without DOMParser");
      assert.ok(wcEl.querySelector("#sg-count-tokens"), "#sg-count-tokens must exist");

      await ucCtx._ucFetch(true);
      assert.strictEqual(fetchCalls.length, 2, "_ucFetch must clear stale tokens and automatically retry once on HTTP 400");
      assert.ok(fetchCalls[1].url.includes("f.sid=-9876543210"), "batchexecute URL must include negative f.sid");
      assert.strictEqual(ucEl.querySelector(".sg-uc-value").textContent, "42%");
      assert.strictEqual(ucEl.querySelector("#sg-uc-five-pct").textContent, "42%");
      assert.strictEqual(ucEl.querySelector("#sg-uc-week-pct").textContent, "15%");
      assert.strictEqual(ucLocalSet.length, 1, "Parsed usage must be cached to chrome.storage.local");
    } finally {
      for (const h of ucTimeouts) clearTimeout(h);
      ucTimeouts.clear();
    }
  }
  console.log("PASS [G5]: Usage counter pure-DOM widget, negative FdrFJe DOM fallback, chunked jSf9Qc parser & HTTP 400 retry verified");
  console.log("\nALL ARCHITECTURE GATES PASSED!");
})().catch((err) => {
  console.error("TEST FAILED:", err);
  process.exit(1);
});
