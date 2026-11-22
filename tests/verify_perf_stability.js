const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const { ROOT, loadCombinedContentJs } = require("./load-content");
const contentJs = loadCombinedContentJs();
const bgJs = fs.readFileSync(path.join(ROOT, "background.js"), "utf8");
const spoofJs = fs.readFileSync(path.join(ROOT, "spoof_injector.js"), "utf8");

function extractFn(src, name) {
  const idx = src.indexOf(`function ${name}(`);
  assert.ok(idx >= 0, `Missing function ${name}`);
  let depth = 0;
  let end = -1;
  for (let i = src.indexOf("{", idx); i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  return src.slice(idx, end);
}

(async () => {
  // === [P1]: Silent Background Worker Fast-Path (0 observers, 0 intervals, 0 sync.get) ===
  for (const hash of ["#sg_orch_worker=1", "#sg_bg_worker=1"]) {
    let moObserveCalls = 0;
    let intervalCalls = 0;
    let syncGetCalls = 0;
    const listeners = [];

    const mockBody = {
      dataset: {},
      classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
      appendChild() {},
      contains: () => false,
      querySelector: () => null,
      querySelectorAll: () => []
    };
    const mockDoc = {
      body: mockBody,
      head: mockBody,
      documentElement: {
        lang: "vi",
        classList: { add() {}, remove() {}, contains: () => false },
        style: { setProperty() {} },
        appendChild() {},
        setAttribute() {},
        removeAttribute() {}
      },
      hidden: false,
      activeElement: mockBody,
      addEventListener(type, fn) { listeners.push({ type, fn }); },
      removeEventListener() {},
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
      createElement: () => ({
        style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
        setAttribute() {}, appendChild() {}, addEventListener() {}, remove() {}
      })
    };
    const mockWin = {
      location: { href: `https://gemini.google.com/u/3/app${hash}`, pathname: "/u/3/app", search: "", hash },
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {},
      getSelection: () => null,
      innerWidth: 1280,
      innerHeight: 800
    };
    const mockChrome = {
      runtime: {
        id: "test-ext",
        getURL: p => `chrome-extension://test/${p}`,
        onMessage: { addListener() {} },
        sendMessage: () => Promise.resolve(null),
        lastError: null
      },
      storage: {
        sync: {
          get(_k, cb) { syncGetCalls++; cb && cb({}); return Promise.resolve({}); },
          set() { return Promise.resolve(); }
        },
        local: {
          get(_k, cb) { cb && cb({}); return Promise.resolve({}); },
          set() { return Promise.resolve(); },
          remove() { return Promise.resolve(); }
        },
        onChanged: { addListener() {} }
      }
    };
    class MockMO {
      constructor() {}
      observe() { moObserveCalls++; }
      disconnect() {}
    }

    // Check spoof_injector.js first
    const spoofCtx = vm.createContext({
      window: mockWin,
      document: mockDoc,
      localStorage: { getItem: () => "dark" },
      MutationObserver: MockMO,
      HTMLInputElement: { prototype: { click() {} } },
      CustomEvent: function(t, o) { this.type = t; this.detail = o && o.detail; },
      setInterval: () => { intervalCalls++; return 1; },
      clearInterval() {},
      setTimeout: () => 1,
      clearTimeout() {}
    });
    vm.runInContext(spoofJs, spoofCtx);
    assert.strictEqual(moObserveCalls, 0, `spoof_injector.js must create 0 MutationObservers on ${hash}`);
    assert.strictEqual(intervalCalls, 0, `spoof_injector.js must create 0 setIntervals on ${hash}`);

    // Check full content.js on silent bg worker tab
    const ctx = vm.createContext({
      window: mockWin,
      location: mockWin.location,
      document: mockDoc,
      chrome: mockChrome,
      MutationObserver: MockMO,
      Node: { ELEMENT_NODE: 1, TEXT_NODE: 3 },
      Event: function(t) { this.type = t; },
      CustomEvent: function(t, o) { this.type = t; this.detail = o && o.detail; },
      URLSearchParams,
      Map, Set, WeakSet, WeakMap, Promise, Date, Array, Object, Boolean, Number, String, RegExp, Math, JSON, Error,
      localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
      sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
      navigator: { userAgent: "Chrome", clipboard: {} },
      console,
      setTimeout: () => 1,
      clearTimeout() {},
      setInterval: () => { intervalCalls++; return 1; },
      clearInterval() {},
      requestAnimationFrame: () => 1,
      cancelAnimationFrame() {}
    });
    vm.runInContext(contentJs, ctx);
    assert.strictEqual(vm.runInContext("SG_IS_SILENT_BG_WORKER_TAB", ctx), true, `SG_IS_SILENT_BG_WORKER_TAB must be true for ${hash}`);
    assert.strictEqual(vm.runInContext("isExtensionEnabled", ctx), false, `isExtensionEnabled must be false on ${hash}`);
    assert.strictEqual(moObserveCalls, 0, `content.js must observe 0 MutationObservers on ${hash} (got ${moObserveCalls})`);
    assert.strictEqual(intervalCalls, 0, `content.js must register 0 setIntervals on ${hash} (got ${intervalCalls})`);
    assert.strictEqual(syncGetCalls, 0, `content.js must make 0 chrome.storage.sync.get IPCs on ${hash} (got ${syncGetCalls})`);
  }
  console.log("PASS [P1]: Silent Background Worker Fast-Path (#sg_orch_worker=1 & #sg_bg_worker=1) -> 0 MutationObservers, 0 setIntervals, 0 storage.sync IPCs");

  // === [P2]: Visibility-Aware Pausing in sgObserverRegistry ===
  {
    const docListeners = {};
    const doc = {
      hidden: true,
      body: {},
      addEventListener(type, fn) { (docListeners[type] ||= []).push(fn); }
    };
    let rafQueue = [];
    const sliceStart = contentJs.indexOf("const sgObserverRegistry = {");
    assert.ok(sliceStart >= 0, "Missing sgObserverRegistry");
    let regDepth = 0;
    let sliceEnd = -1;
    for (let i = contentJs.indexOf("{", sliceStart); i < contentJs.length; i++) {
      if (contentJs[i] === "{") regDepth++;
      else if (contentJs[i] === "}") {
        regDepth--;
        if (regDepth === 0) {
          sliceEnd = i + 1;
          break;
        }
      }
    }
    assert.ok(sliceEnd > sliceStart, "Unclosed sgObserverRegistry");
    const regSrc = contentJs.slice(sliceStart, sliceEnd) + ";";
    const ctx = vm.createContext({
      SG_IS_SILENT_BG_WORKER_TAB: false,
      document: doc,
      messageQueue: [],
      activeChainState: null,
      MutationObserver: class { observe() {} disconnect() {} },
      requestAnimationFrame: fn => rafQueue.push(fn),
      setTimeout: fn => { fn(); return 1; },
      clearTimeout() {},
      Map, Date, console
    });
    vm.runInContext(regSrc, ctx);
    const reg = vm.runInContext("sgObserverRegistry", ctx);
    let runs = 0;
    reg.registerUIRefresh("test", () => { runs++; });
    reg._scheduleUIRefresh();
    assert.strictEqual(runs, 0, "Must pause UI refresh while document.hidden=true and no queue/chain active");
    assert.strictEqual(reg._pendingHiddenFlush, true);

    // Return to tab -> visibilitychange flushes immediately
    doc.hidden = false;
    (docListeners.visibilitychange || []).forEach(fn => fn());
    while (rafQueue.length) rafQueue.shift()();
    assert.strictEqual(runs, 1, "Must flush pending UI refresh immediately when tab becomes visible");

    // Active messageQueue while hidden -> must NOT pause!
    doc.hidden = true;
    ctx.messageQueue = ["queued prompt"];
    reg._uiRefreshLastRun = 0;
    reg._scheduleUIRefresh();
    while (rafQueue.length) rafQueue.shift()();
    assert.strictEqual(runs, 2, "Must continue flushing while hidden when messageQueue has pending items");
  }
  console.log("PASS [P2]: Visibility-aware pausing saves idle CPU on hidden tabs & flushes on tab focus (preserves background Message Queue)");

  // === [P3]: Streaming Hot-Path Fast-Paths (CodeBlock & CommandPalette Pending Jump) ===
  {
    // Verify sgRefreshCodeBlockActions skips sgCollectChatCodeBlocks when unchanged
    let collectCalls = 0;
    const cbEl = {
      dataset: { sgCbLen: "11", sgCbIdx: "0" },
      closest: () => null,
      querySelector: sel => sel === ".sg-cb-actions" ? {} : { textContent: "hello world" }
    };
    const startIdx = contentJs.indexOf("let _sgCodeBlockLastCount = -1;");
    const endIdx = contentJs.indexOf("function sgSetCodeBlockActionsEnabled", startIdx);
    const cbSrc = contentJs.slice(startIdx, endIdx);
    const ctx = vm.createContext({
      document: { querySelectorAll: () => [cbEl] },
      isExtensionEnabled: true,
      isCodeBlockActionsEnabled: true,
      sgCollectChatCodeBlocks: () => { collectCalls++; return [{ index: 0, element: cbEl, codeText: "hello world" }]; },
      sgEnhanceCodeBlock: () => {},
      setTimeout: fn => { fn(); return 1; },
      clearTimeout() {}
    });
    vm.runInContext(cbSrc, ctx);
    ctx.sgRefreshCodeBlockActions(); // first run sees count diff (-1 -> 1)
    assert.strictEqual(collectCalls, 1);
    ctx.sgRefreshCodeBlockActions(); // second run unchanged -> skips completely!
    ctx.sgRefreshCodeBlockActions();
    assert.strictEqual(collectCalls, 1, "Unchanged code blocks must NOT re-run sgCollectChatCodeBlocks on subsequent ticks");

    // Verify sgConsumePendingPaletteJump skips sessionStorage.getItem after initial null
    let ssGets = 0;
    const ssMap = new Map();
    const jumpStart = contentJs.indexOf("let _sgCpMaybePendingJump = true;");
    const jumpEnd = contentJs.indexOf("const deadline = Date.now() + 6000;", jumpStart);
    // Extract just queue + initial part of consume by compiling full function
    const fnStart = jumpStart;
    let d = 0, fnEnd = -1;
    const consumePos = contentJs.indexOf("async function sgConsumePendingPaletteJump()", fnStart);
    for (let i = contentJs.indexOf("{", consumePos); i < contentJs.length; i++) {
      if (contentJs[i] === "{") d++;
      else if (contentJs[i] === "}") { d--; if (d === 0) { fnEnd = i + 1; break; } }
    }
    const jumpCtx = vm.createContext({
      SG_CP_PENDING_JUMP_KEY: "sg_cp_pending_jump",
      SG_CP_PENDING_JUMP_TTL_MS: 25000,
      _sgCpJumpRunning: false,
      sessionStorage: {
        getItem: k => { ssGets++; return ssMap.get(k) || null; },
        setItem: (k, v) => ssMap.set(k, v),
        removeItem: k => ssMap.delete(k)
      },
      getCurrentChatId: () => "other_chat",
      JSON, Date, String, Promise, setTimeout: () => 1
    });
    vm.runInContext(contentJs.slice(fnStart, fnEnd), jumpCtx);
    await jumpCtx.sgConsumePendingPaletteJump(); // 1st check -> null -> disarms
    await jumpCtx.sgConsumePendingPaletteJump(); // skipped!
    await jumpCtx.sgConsumePendingPaletteJump(); // skipped!
    assert.strictEqual(ssGets, 1, "Must call sessionStorage.getItem only once when no jump is pending");
    jumpCtx.sgQueueCrossChatJump({ chatId: "target_chat" });
    await jumpCtx.sgConsumePendingPaletteJump(); // re-armed!
    assert.strictEqual(ssGets, 2, "sgQueueCrossChatJump must re-arm pending jump check");
  }
  console.log("PASS [P3]: Hot-path fast-paths (CodeBlock dirty check & CommandPalette pending-jump boolean guard)");

  // === [P4]: background.js 0 innerHTML + Vietnamese/occluded clickSubmit ===
  {
    assert.strictEqual(/\.innerHTML\s*[+]?=/.test(bgJs), false, "background.js must have ZERO innerHTML sinks");
    let innerHtmlWritten = false;
    const children = [];
    const editor = {
      get firstChild() { return children[0] || null; },
      removeChild(c) { const i = children.indexOf(c); if (i >= 0) children.splice(i, 1); },
      appendChild(c) { children.push(c); },
      set innerHTML(_v) { innerHtmlWritten = true; },
      classList: { remove() {} },
      dispatchEvent() {},
      focus() {}
    };
    const ctx = vm.createContext({
      document: {
        querySelector: () => editor,
        createElement: tag => ({ tag, textContent: "", children: [], appendChild(c) { this.children.push(c); }, set innerHTML(_v) { innerHtmlWritten = true; } })
      },
      Event: function(t) { this.type = t; },
      console
    });
    vm.runInContext(extractFn(bgJs, "enterPrompt"), ctx);
    assert.strictEqual(ctx.enterPrompt("line1\n\nline3"), true);
    assert.strictEqual(innerHtmlWritten, false, "enterPrompt must NEVER touch innerHTML");
    assert.strictEqual(children.length, 3);
    assert.strictEqual(children[1].children[0].tag, "br");

    // clickSubmit Vietnamese Gửi + skip aria-disabled + occluded offsetParent===null
    let clicked = 0;
    const disabledBtn = { isConnected: true, disabled: false, offsetParent: {}, hasAttribute: () => false, getAttribute: k => k === "aria-disabled" ? "true" : "Gửi", classList: { contains: () => false }, querySelector: () => null, click() { clicked = -999; } };
    const viSendBtn = { isConnected: true, disabled: false, offsetParent: null, getClientRects: () => [], hasAttribute: () => false, getAttribute: k => k === "aria-label" ? "Gửi tin nhắn" : null, classList: { contains: () => false }, querySelector: () => null, click() { clicked++; } };
    const csCtx = vm.createContext({
      document: {
        querySelectorAll: sel => sel.includes("Gửi") ? [disabledBtn, viSendBtn] : []
      },
      getComputedStyle: () => ({ display: "inline-flex", visibility: "visible" }),
      console
    });
    vm.runInContext(extractFn(bgJs, "clickSubmit"), csCtx);
    assert.strictEqual(csCtx.clickSubmit(), true, "clickSubmit must click Vietnamese Gửi button on occluded background tab");
    assert.strictEqual(clicked, 1);
  }
  console.log("PASS [P4]: background.js has 0 innerHTML sinks & clickSubmit handles Vietnamese UI + aria-disabled + occluded tabs");

  // === [P5]: Master Toggle Completeness & Outline Local Bookmarks Sync ===
  {
    assert.ok(contentJs.includes('["extensionEnabled", "folderUploadEnabled"]'), "folderUpload must check extensionEnabled");
    assert.ok(contentJs.includes('["extensionEnabled", "skillsInjectionEnabled", "baselineInjectionEnabled"]'), "Skills system must check extensionEnabled");
    assert.ok(contentJs.includes('["extensionEnabled", "conversationOutlineEnabled", "forkHandoffEnabled"]'), "Outline/Fork must check extensionEnabled");
    assert.ok(contentJs.includes('["extensionEnabled", "codeBlockActionsEnabled"]'), "CodeBlock actions must check extensionEnabled");
    assert.ok(contentJs.includes('["extensionEnabled", "commandPaletteEnabled"]'), "CommandPalette must check extensionEnabled");
    assert.ok(contentJs.includes('areaName === "local" && changes[SG_BOOKMARKS_STORAGE_KEY]'), "Outline must listen to chrome.storage.local for sgBookmarks changes");
  }
  console.log("PASS [P5]: Master toggle (extensionEnabled=false) enforced across all 5 subsystems + Outline local bookmarks sync fixed");

  // === [P6]: Storage Cache Hygiene & Manifest/Registry/CSS Integrity ===
  {
    const directSyncGets = contentJs.split("\n").filter(l => /chrome\.storage\.sync\.get\s*\(/.test(l));
    assert.strictEqual(directSyncGets.length, 2, `Expected only 2 direct chrome.storage.sync.get calls in content.js (bootstrap + legacy migration), found ${directSyncGets.length}`);
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8"));
    const registry = JSON.parse(fs.readFileSync(path.join(ROOT, "skills/registry.json"), "utf8"));
    const baseline = JSON.parse(fs.readFileSync(path.join(ROOT, "skills/baseline.json"), "utf8"));
    assert.strictEqual(registry.skills.length, 12);
    assert.ok(Array.isArray(baseline.instructions) && baseline.instructions.length >= 7, "Baseline instructions must have >= 7 valid entries");
    const bIds = baseline.instructions.map(x => x.id);
    assert.strictEqual(new Set(bIds).size, bIds.length, "Baseline instructions must have unique IDs");
    for (const b of baseline.instructions) assert.ok(b && b.id && b.title && b.text, `Invalid baseline instruction entry: ${b && b.id}`);
    for (const s of registry.skills) assert.ok(fs.existsSync(path.join(ROOT, s.file)), `Missing skill file ${s.file}`);
    for (const war of manifest.web_accessible_resources || []) {
      for (const r of war.resources || []) {
        if (r.endsWith("/*")) {
          const dirPath = path.join(ROOT, r.slice(0, -2));
          assert.ok(fs.existsSync(dirPath) && fs.readdirSync(dirPath).length > 0, `Missing or empty WAR dir ${r}`);
        } else {
          assert.ok(fs.existsSync(path.join(ROOT, r)), `Missing WAR ${r}`);
        }
      }
    }
    for (const cssFile of ["content.css", "popup.css"]) {
      const stripped = fs.readFileSync(path.join(ROOT, cssFile), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
      assert.strictEqual((stripped.match(/\{/g) || []).length, (stripped.match(/\}/g) || []).length, `Unbalanced braces in ${cssFile}`);
    }
  }
  console.log("PASS [P6]: Storage cache hygiene (only 2 direct sync.get calls), JSON/manifest/registry/WAR/CSS integrity verified");

  console.log("\nALL PERFORMANCE, COMPLETENESS & STABILITY CHECKS PASSED!");
})().catch(err => {
  console.error("TEST FAILED:", err);
  process.exit(1);
});
