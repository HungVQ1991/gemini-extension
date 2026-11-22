const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");
const { ROOT, getContentScriptFiles, loadFile, loadCombinedContentJs } = require("./load-content");

(async () => {
  const coreJs = loadFile("content/core-namespace.js");
  const selectorsJs = loadFile("content/selectors.js");
  const dispatcherJs = loadFile("content/dispatcher.js");
  const runtimeBusJs = loadFile("content/runtime-bus.js");

  // =========================================================================
  // [C1] core-namespace.js + selectors.js (Silent Worker, SG.*, Health Check)
  // =========================================================================
  {
    let syncGets = 0;
    let warns = [];
    const silentLsWrites = [];
    const ctxSilent = vm.createContext({
      window: { location: { hash: "#sg_orch_worker=1" } },
      document: { documentElement: { setAttribute() {} }, hidden: false, body: {}, addEventListener() {} },
      localStorage: { setItem(k, v) { silentLsWrites.push([k, v]); }, getItem: () => null },
      chrome: {
        storage: {
          sync: { get(_k, cb) { syncGets++; cb && cb({}); } },
          onChanged: { addListener() {} }
        }
      },
      MutationObserver: class { observe() {} disconnect() {} },
      requestAnimationFrame: () => 1,
      setTimeout, clearTimeout, Map, Set, Promise, Date, Object, Array, Boolean, Number, String, Error,
      console: { warn: m => warns.push(String(m)), error: () => {} }
    });
    ctxSilent.globalThis = ctxSilent;
    vm.runInContext(coreJs + "\n" + selectorsJs, ctxSilent);
    await Promise.resolve();
    assert.strictEqual(ctxSilent.SG.isSilentWorkerTab, true);
    assert.strictEqual(ctxSilent.SG.state.extensionEnabled, false);
    assert.strictEqual(syncGets, 0, "Silent worker tab must perform 0 chrome.storage.sync.get IPCs");
    ctxSilent.SG.sync.syncMasterFlag(false);
    assert.strictEqual(silentLsWrites.length, 0, "Silent worker tab must NEVER write shared localStorage.sg_ext_enabled");

    // SG.dom.setSafeHtml Trusted Types enforcement test (DOMParser throws on raw string)
    let createdPolicyName = null;
    const targetChildren = [];
    const targetHost = {
      textContent: "",
      children: targetChildren,
      replaceChildren(...nodes) { targetChildren.length = 0; targetChildren.push(...nodes); },
      ownerDocument: { importNode: n => n }
    };
    const ctxTT = vm.createContext({
      window: {
        location: { hash: "" },
        trustedTypes: {
          createPolicy(name, rules) {
            createdPolicyName = name;
            return { createHTML: (s) => ({ __trustedHtml: true, raw: rules.createHTML(s) }) };
          }
        }
      },
      document: { documentElement: { setAttribute() {} }, hidden: false, body: {}, addEventListener() {} },
      localStorage: { setItem() {}, getItem: () => null },
      chrome: { storage: { sync: { get: (_k, cb) => cb && cb({ extensionEnabled: true }) }, onChanged: { addListener() {} } } },
      DOMParser: class {
        parseFromString(input) {
          if (typeof input === "string") {
            throw new TypeError("This document requires 'TrustedHTML' assignment.");
          }
          assert.ok(input && input.__trustedHtml, "DOMParser must receive TrustedHTML from policy");
          const parsedNode = { nodeType: 1, tagName: "DIV", children: [], removeAttribute() {}, attributes: [] };
          return { body: { childNodes: [parsedNode], querySelectorAll: () => [parsedNode] } };
        }
      },
      MutationObserver: class { observe() {} disconnect() {} },
      requestAnimationFrame: () => 1,
      setTimeout, clearTimeout, Map, Set, Promise, Date, Object, Array, Boolean, Number, String, Error, TypeError,
      console: { warn() {}, error() {} }
    });
    ctxTT.globalThis = ctxTT;
    vm.runInContext(coreJs, ctxTT);
    ctxTT.SG.dom.setSafeHtml(targetHost, '<div class="ok">trusted</div>');
    assert.strictEqual(createdPolicyName, "sg-safe-html", "sgSetSafeHtml must create sg-safe-html TrustedTypePolicy");
    assert.strictEqual(targetChildren.length, 1, "TrustedHTML parse must mount element child instead of textContent fallback");
    assert.strictEqual(targetHost.textContent, "", "textContent fallback must not overwrite TrustedHTML mount");

    // Health check on fallback & warn-once invariant
    let qCalls = [];
    const matchedFallback = { id: "composer-fallback" };
    const ctxActive = vm.createContext({
      window: { location: { hash: "" } },
      document: {
        documentElement: { setAttribute() {} },
        hidden: false,
        body: {},
        addEventListener() {},
        querySelector: (sel) => {
          qCalls.push(sel);
          return sel === '.ql-editor[contenteditable="true"]' ? matchedFallback : null;
        },
        querySelectorAll: () => []
      },
      localStorage: { setItem() {}, getItem: () => null },
      chrome: {
        storage: {
          sync: { get: (_k, cb) => cb && cb({ extensionEnabled: true }) },
          onChanged: { addListener() {} }
        }
      },
      MutationObserver: class { observe() {} disconnect() {} },
      requestAnimationFrame: () => 1,
      setTimeout, clearTimeout, Map, Set, Promise, Date, Object, Array, Boolean, Number, String, Error,
      console: { warn: m => warns.push(String(m)), error: () => {} }
    });
    ctxActive.globalThis = ctxActive;
    vm.runInContext(coreJs + "\n" + selectorsJs, ctxActive);

    assert.strictEqual(ctxActive.SG.version, "2.0.0");
    assert.ok(ctxActive.SG.dom && typeof ctxActive.SG.dom.setSafeHtml === "function", "SG.dom.setSafeHtml must be exposed");

    // SG.dom.sanitizeParsedFragment & setSafeHtml XSS sanitization + <form>/<svg> preservation
    const mkSanNode = (tag, attrs = {}, children = []) => {
      const attrMap = new Map(Object.entries(attrs));
      const node = {
        tagName: tag.toUpperCase(),
        nodeType: 1,
        children,
        parentNode: null,
        get attributes() { return Array.from(attrMap.entries()).map(([name, value]) => ({ name, value })); },
        removeAttribute(k) { for (const key of attrMap.keys()) if (key.toLowerCase() === String(k).toLowerCase()) attrMap.delete(key); },
        hasAttribute(k) { for (const key of attrMap.keys()) if (key.toLowerCase() === String(k).toLowerCase()) return true; return false; },
        getAttribute(k) { for (const [key, val] of attrMap.entries()) if (key.toLowerCase() === String(k).toLowerCase()) return val; return null; },
        remove() {
          if (this.parentNode && Array.isArray(this.parentNode.children)) {
            const i = this.parentNode.children.indexOf(this);
            if (i >= 0) this.parentNode.children.splice(i, 1);
            this.parentNode = null;
          }
        }
      };
      children.forEach(c => { c.parentNode = node; });
      return node;
    };
    const badScript = mkSanNode("script", { src: "https://evil.test/x.js" });
    const badImg = mkSanNode("img", { src: "ok.png", onerror: "alert(1)", ONLOAD: "alert(2)" });
    const badLink = mkSanNode("a", { href: "  javaScript:alert(1) ", title: "Keep" });
    const goodForm = mkSanNode("form", { id: "sg-vars-form" });
    const goodPath = mkSanNode("path", { d: "M0 0" });
    const goodSvg = mkSanNode("svg", { viewBox: "0 0 24 24", onload: "evil()" }, [goodPath]);
    const sanRoot = {
      children: [badScript, badImg, badLink, goodForm, goodSvg],
      querySelectorAll() {
        const out = [];
        const walk = (arr) => { for (const n of arr) { out.push(n); if (n.children) walk(n.children); } };
        walk(this.children);
        return out;
      }
    };
    badScript.parentNode = sanRoot; badImg.parentNode = sanRoot; badLink.parentNode = sanRoot; goodForm.parentNode = sanRoot; goodSvg.parentNode = sanRoot;
    ctxActive.SG.dom.sanitizeParsedFragment(sanRoot);
    assert.strictEqual(sanRoot.children.includes(badScript), false, "<script> must be stripped");
    assert.strictEqual(sanRoot.children.includes(goodForm), true, "<form> must be preserved for legacy modals");
    assert.strictEqual(badImg.hasAttribute("onerror"), false, "Inline on* attributes must be stripped");
    assert.strictEqual(badImg.hasAttribute("ONLOAD"), false, "Case-insensitive ON* attributes must be stripped");
    assert.strictEqual(badLink.hasAttribute("href"), false, "javascript: href must be stripped");
    assert.strictEqual(badLink.getAttribute("title"), "Keep", "Safe attributes must remain");
    assert.strictEqual(goodSvg.hasAttribute("onload"), false, "SVG onload must be stripped");
    assert.strictEqual(goodSvg.children.includes(goodPath), true, "Safe SVG child <path> must remain");

    // SG.dom.captureEditorLines & restoreEditorLines
    const editorHost = {
      children: [],
      ownerDocument: {
        createElement(t) {
          return { tagName: t.toUpperCase(), children: [], textContent: "", appendChild(c) { this.children.push(c); } };
        }
      },
      replaceChildren(...nodes) { this.children = nodes; }
    };
    ctxActive.SG.dom.restoreEditorLines(editorHost, ["alpha <tag>", "", "omega"]);
    assert.strictEqual(editorHost.children.length, 3);
    assert.strictEqual(editorHost.children[0].textContent, "alpha <tag>");
    assert.strictEqual(editorHost.children[1].children[0].tagName, "BR");
    assert.deepStrictEqual(ctxActive.SG.dom.captureEditorLines(editorHost), ["alpha <tag>", "", "omega"]);
    assert.strictEqual(ctxActive.SG.selectors.queryWithHealth("promptInput"), matchedFallback);
    assert.strictEqual(ctxActive.SG.selectors.queryWithHealth("promptInput"), matchedFallback);
    const r1 = ctxActive.SG.selectors.getHealthReport();
    assert.strictEqual(r1.promptInput.status, "fallback");
    assert.strictEqual(r1.promptInput.matchedIndex, 1);
    assert.strictEqual(r1.promptInput.count, 2);
    assert.strictEqual(warns.filter(w => w.includes('"promptInput"')).length, 1, "Fallback warning must log at most once per key per session");

    assert.strictEqual(ctxActive.SG.selectors.queryWithHealth("stopButton", ctxActive.document, { warnOnMiss: true }), null);
    assert.strictEqual(ctxActive.SG.selectors.queryWithHealth("stopButton", ctxActive.document, { warnOnMiss: true }), null);
    const r2 = ctxActive.SG.selectors.getHealthReport();
    assert.strictEqual(r2.stopButton.status, "miss");
    assert.strictEqual(r2.stopButton.count, 2);
    assert.strictEqual(warns.filter(w => w.includes('All selectors missed for "stopButton"')).length, 1, "Miss warning must log once");
  }
  console.log("PASS [C1]: core-namespace + selectors health tracking and worker fast-path verified");

  // =========================================================================
  // [C2] dispatcher.js (Reverse Registration, Priority Order, stopImmediatePropagation, Teardown)
  // =========================================================================
  {
    const docCapBuckets = new Map();
    let addCalls = 0;
    let removeCalls = 0;
    const mockDoc = {
      addEventListener(type, fn, capture) {
        if (!capture) return;
        addCalls++;
        if (!docCapBuckets.has(type)) docCapBuckets.set(type, []);
        docCapBuckets.get(type).push(fn);
      },
      removeEventListener(type, fn, capture) {
        if (!capture) return;
        removeCalls++;
        const arr = docCapBuckets.get(type);
        if (arr) {
          const idx = arr.indexOf(fn);
          if (idx >= 0) arr.splice(idx, 1);
        }
      }
    };
    const mockWin = { addEventListener() {}, removeEventListener() {} };

    const errors = [];
    const ctx = vm.createContext({
      window: mockWin,
      document: mockDoc,
      SG: {},
      Map, Set, Array, Object, Number, String, Boolean, Error,
      console: { error: m => errors.push(String(m)) }
    });
    vm.runInContext(dispatcherJs, ctx);
    const disp = ctx.SG.dispatcher;
    const P = disp.PRIORITY;

    const trace = [];
    // Register deliberately in reverse order: lowest priority first!
    disp.register("skills:kd", "document", "keydown", () => trace.push("skills:50"), P.SKILLS_PRESEND);
    disp.register("orch:kd", "document", "keydown", () => trace.push("orch:40"), P.ORCHESTRATOR);
    disp.register("cp:kd", "document", "keydown", () => {
      trace.push("cp:30:throws");
      throw new Error("simulated cp failure");
    }, P.COMMAND_PALETTE);
    disp.register("periodic:kd", "document", "keydown", () => trace.push("periodic:20"), P.PERIODIC_SEND_BLOCK);
    disp.register("modal:kd", "document", "keydown", () => trace.push("modal:10"), P.MODAL_ESCAPE);

    assert.strictEqual(addCalls, 1, "Dispatcher must attach strictly 1 capture listener per (target, eventType)");

    // Proto-based Event object (mirrors real browser DOM Event where stopImmediatePropagation lives on prototype)
    let protoStopCalls = 0;
    const EventProto = {
      preventDefault() {},
      stopPropagation() {},
      stopImmediatePropagation() { protoStopCalls++; }
    };
    const ev1 = Object.assign(Object.create(EventProto), { type: "keydown", key: "Enter" });
    docCapBuckets.get("keydown").slice().forEach(fn => fn(ev1));
    assert.deepStrictEqual(trace, ["modal:10", "periodic:20", "cp:30:throws", "orch:40", "skills:50"], "Handlers must execute strictly by priority even after reverse registration & throw");
    assert.strictEqual(errors.length, 1, "Throwing handler error must be caught and isolated");

    // stopImmediatePropagation at Orch(40) blocks Skills(50) and restores own property cleanly
    trace.length = 0;
    disp.unregister("orch:kd");
    disp.unregister("cp:kd");
    disp.register("orch:kd", "document", "keydown", (ev) => {
      trace.push("orch:40:stop");
      ev.stopImmediatePropagation();
    }, P.ORCHESTRATOR);

    const ev2 = Object.assign(Object.create(EventProto), { type: "keydown", key: "Enter" });
    docCapBuckets.get("keydown").slice().forEach(fn => fn(ev2));
    assert.deepStrictEqual(trace, ["modal:10", "periodic:20", "orch:40:stop"], "stopImmediatePropagation MUST halt lower-priority handlers immediately");
    assert.strictEqual(protoStopCalls, 1, "Native prototype stopImmediatePropagation must be forwarded");
    assert.strictEqual(Object.prototype.hasOwnProperty.call(ev2, "stopImmediatePropagation"), false, "Event wrapper must be cleaned up after dispatch");

    // Unregistering all removes native capture listener cleanly
    disp.unregisterByPrefix("periodic:");
    disp.unregister("modal:kd");
    disp.unregister("orch:kd");
    disp.unregister("skills:kd");
    assert.strictEqual(removeCalls, 1, "Removing last subscriber in bucket must removeEventListener");
    assert.strictEqual(docCapBuckets.get("keydown").length, 0);
  }
  console.log("PASS [C2]: dispatcher priority order, exception isolation, stopImmediatePropagation & teardown verified");

  // =========================================================================
  // [C3] runtime-bus.js (Single storage.onChanged & Synchronous runtime.onMessage)
  // =========================================================================
  {
    const storageNative = [];
    const msgNative = [];
    const lsMap = new Map();
    const ctx = vm.createContext({
      window: { location: { hash: "" } },
      document: { documentElement: { setAttribute() {} }, hidden: false, body: {}, addEventListener() {} },
      localStorage: {
        getItem: k => lsMap.get(k) || null,
        setItem: (k, v) => lsMap.set(k, String(v))
      },
      chrome: {
        storage: {
          sync: { get: (_k, cb) => cb && cb({ extensionEnabled: true, foo: 1 }) },
          onChanged: { addListener: fn => storageNative.push(fn) }
        },
        runtime: {
          onMessage: { addListener: fn => msgNative.push(fn) }
        }
      },
      MutationObserver: class { observe() {} disconnect() {} },
      requestAnimationFrame: () => 1,
      setTimeout, clearTimeout, Map, Set, Promise, Date, Object, Array, Boolean, Number, String, Error, console
    });
    ctx.globalThis = ctx;
    vm.runInContext(coreJs + "\n" + runtimeBusJs, ctx);

    const syncHits = [];
    const localHits = [];
    ctx.SG.storage.onChanged("sub:sync-foo", c => syncHits.push(c.foo.newValue), { area: "sync", keys: ["foo"] });
    ctx.SG.storage.onChanged("sub:local", c => localHits.push(c), { area: "local" });

    assert.strictEqual(storageNative.length, 1, "Must bind strictly 1 native chrome.storage.onChanged listener");
    await ctx.SG.sync.getBootstrap();
    // Even after getBootstrap resolves, still strictly 1 storage listener (microtask waited)
    assert.strictEqual(storageNative.length, 1, "Bootstrap sync must reuse runtime-bus without adding a 2nd storage.onChanged listener");

    // Fire native storage changes
    storageNative[0]({ bar: { newValue: 2 } }, "sync");
    assert.strictEqual(syncHits.length, 0, "Key filter must skip unrelated sync keys");
    storageNative[0]({ foo: { newValue: 42 }, extensionEnabled: { newValue: false } }, "sync");
    assert.deepStrictEqual(syncHits, [42]);
    assert.strictEqual(lsMap.get("sg_ext_enabled"), "0", "Bootstrap cache delta handler must update sg_ext_enabled on sync delta");
    assert.strictEqual(ctx._sgBootstrapSyncCache.foo, 42);
    assert.strictEqual(localHits.length, 0);

    // runtime.onMessage synchronous boolean contract
    ctx.SG.messages.on("ASYNC_CMD", async () => "would_return_promise_if_leaked");
    ctx.SG.messages.on("VOID_CMD", () => undefined);
    ctx.SG.messages.on("TRUE_ASYNC_CHANNEL", () => true);

    assert.strictEqual(msgNative.length, 1, "Must bind strictly 1 native chrome.runtime.onMessage listener");
    const rAsync = msgNative[0]({ type: "ASYNC_CMD" }, {}, () => {});
    const rVoid = msgNative[0]({ type: "VOID_CMD" }, {}, () => {});
    const rUnknown = msgNative[0]({ type: "UNKNOWN_CMD" }, {}, () => {});
    const rTrue = msgNative[0]({ type: "TRUE_ASYNC_CHANNEL" }, {}, () => {});
    assert.strictEqual(rAsync, false, "Async handler returning Promise must still yield synchronous false");
    assert.strictEqual(rVoid, false, "Undefined return must yield synchronous false");
    assert.strictEqual(rUnknown, false, "Unmatched message must yield synchronous false");
    assert.strictEqual(rTrue, true, "Only explicit strict boolean true keeps sendResponse channel open");
  }
  console.log("PASS [C3]: runtime-bus single storage.onChanged fan-out + synchronous boolean runtime.onMessage verified");

  // =========================================================================
  // [C4] Architecture Static Gates across Manifest & 20 content/*.js Modules
  // =========================================================================
  {
    const manifest = JSON.parse(loadFile("manifest.json"));
    assert.strictEqual(manifest.version, "2.0.0", "manifest.json version must be 2.0.0");
    assert.ok(Array.isArray(manifest.permissions) && manifest.permissions.includes("alarms"), "manifest.json permissions must include alarms");
    assert.strictEqual(fs.existsSync(path.join(ROOT, "content.js")), false, "Monolithic content.js must be retired/removed");

    const csFiles = getContentScriptFiles();
    assert.deepStrictEqual(
      csFiles,
      [
        "content/core-namespace.js",
        "content/selectors.js",
        "content/dispatcher.js",
        "content/runtime-bus.js",
        "content/legacy-core-export.js",
        "content/legacy-composer-optimizer.js",
        "content/legacy-queue-chains.js",
        "content/legacy-sidebar-autohide.js",
        "content/legacy-folders-prompts.js",
        "content/legacy-pinned-drag-export.js",
        "content/legacy-slash-drive.js",
        "content/folder-uploader.js",
        "content/skills-core.js",
        "content/skills-migration-ui.js",
        "content/outline-export.js",
        "content/code-blocks.js",
        "content/command-palette.js",
        "content/orchestrator.js",
        "content/periodic-table.js",
        "content/diagram-renderer.js"
      ],
      "manifest.json content_scripts[1].js order must match modular v2.0.0 20-file architecture"
    );

    const forbiddenEval = /\beval\s*\(|new\s+Function\b/;
    const forbiddenHtml = /\.(?:innerHTML|outerHTML)\s*[+]?=|\binsertAdjacentHTML\s*\(|\bdocument\.write\s*\(/;
    for (const rel of csFiles) {
      const code = loadFile(rel);
      const lineCount = code.split(/\r?\n/).length;
      assert.ok(lineCount <= 3500, `${rel} must be <= 3500 lines (got ${lineCount})`);
      assert.strictEqual(forbiddenEval.test(code), false, `${rel} must contain 0 eval/new Function`);
      assert.strictEqual(forbiddenHtml.test(code), false, `${rel} must contain 0 direct HTML write sinks`);
      new vm.Script(code, { filename: rel });
    }

    const combined = loadCombinedContentJs();
    const directSyncGets = combined.split("\n").filter(l => /chrome\.storage\.sync\.get\s*\(/.test(l));
    assert.strictEqual(directSyncGets.length, 2, `Combined direct chrome.storage.sync.get( count must stay 2, found ${directSyncGets.length}`);

    const sgStorageHits = (combined.match(/SG\.storage\.onChanged\(/g) || []).length;
    const sgMsgHits = (combined.match(/SG\.messages\.onMatcher\(/g) || []).length;
    const sgDispatcherHits = (combined.match(/SG\.dispatcher\.register\(/g) || []).length;
    assert.strictEqual(sgStorageHits, 23, `Expected 23 SG.storage.onChanged calls across all 20 modules (2 core + 8 modern + 13 legacy), found ${sgStorageHits}`);
    assert.strictEqual(sgMsgHits, 6, `Expected 6 SG.messages.onMatcher calls across legacy modules, found ${sgMsgHits}`);
    assert.strictEqual(sgDispatcherHits, 19, `Expected 19 modern SG.dispatcher.register bindings across content/*.js, found ${sgDispatcherHits}`);
  }
  console.log("PASS [C4]: Static architecture gates (manifest v2.0.0 + alarms, 20-module split <= 3500L, 0 eval/HTML sinks, unified storage & message bus) verified");
  console.log("\nALL CORE DISPATCHER & RUNTIME BUS TESTS PASSED!");
})().catch((err) => {
  console.error("TEST FAILED:", err);
  process.exit(1);
});
