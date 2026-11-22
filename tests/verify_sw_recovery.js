const vm = require("vm");
const assert = require("assert");
const { getContentScriptFiles, loadFile } = require("./load-content");

(async () => {
  const bgJs = loadFile("background.js");
  const spoofJs = loadFile("spoof_injector.js");

  // =========================================================================
  // [W1] MV3 Service Worker Cold Restart Recovery, Session Pools & Alarms
  // =========================================================================
  {
    const sessionStart = bgJs.indexOf('const SG_TEMP_TABS_SESSION_KEY = "sgActiveTempTabs";');
    const sessionEnd = bgJs.indexOf("const OPTIMIZATION_SYSTEM_PROMPT", sessionStart);
    assert.ok(sessionStart > 0 && sessionEnd > sessionStart, "Session tracking slice not found in background.js");

    const orchStart = bgJs.indexOf("const SG_ORCH_MAX_WARM_WORKERS = 4;");
    const orchEnd = bgJs.indexOf("async function sgCreateOrchWorkerTabInWindow(", orchStart);
    assert.ok(orchStart > 0 && orchEnd > orchStart, "Orchestrator pool recovery slice not found in background.js");

    const swSlice = bgJs.slice(sessionStart, sessionEnd) + "\n" + bgJs.slice(orchStart, orchEnd);

    const sharedSession = {};
    const sharedAlarms = new Map();
    const removedTabs = [];
    const removedWindows = [];

    function bootSwInstance({ triggerBootCleanup = false } = {}) {
      const alarmListeners = [];
      const startupListeners = [];
      let bootCleanupPromise = null;

      const ctx = vm.createContext({
        chrome: {
          storage: {
            session: {
              async get(key) {
                if (typeof key === "string") {
                  return Object.prototype.hasOwnProperty.call(sharedSession, key)
                    ? { [key]: JSON.parse(JSON.stringify(sharedSession[key])) }
                    : {};
                }
                if (Array.isArray(key)) {
                  const out = {};
                  for (const k of key) {
                    if (Object.prototype.hasOwnProperty.call(sharedSession, k)) {
                      out[k] = JSON.parse(JSON.stringify(sharedSession[k]));
                    }
                  }
                  return out;
                }
                return JSON.parse(JSON.stringify(sharedSession));
              },
              async set(obj) {
                for (const k of Object.keys(obj)) {
                  sharedSession[k] = JSON.parse(JSON.stringify(obj[k]));
                }
              }
            }
          },
          alarms: {
            create(name, info) { sharedAlarms.set(name, info); },
            async clear(name) { return sharedAlarms.delete(name); },
            onAlarm: { addListener(fn) { alarmListeners.push(fn); } }
          },
          runtime: {
            onStartup: { addListener(fn) { startupListeners.push(fn); } }
          },
          tabs: {
            async remove(tid) { removedTabs.push(tid); }
          },
          windows: {
            async remove(wid) { removedWindows.push(wid); }
          }
        },
        geminiAppUrlForTab: () => "https://gemini.google.com/app",
        setTimeout,
        clearTimeout,
        Map, Set, Array, Object, String, Number, Boolean, Promise, Date, Math, JSON, Error, console
      });

      const codeToRun = (triggerBootCleanup
        ? swSlice
        : swSlice.replace(
            "\nconst _sgBootCleanupPromise = sgCleanupOrphanedOrchWorkersOnBoot().catch(() => {});",
            "\nconst _sgBootCleanupPromise = Promise.resolve(); /* deferred boot cleanup */"
          )) +
        "\nvar __testApi = { pools: _sgOrchWarmPools, batchTabs: _activeBatchScrapeTabIds, bootCleanupPromise: _sgBootCleanupPromise };";
      vm.runInContext(codeToRun, ctx);

      return {
        ctx,
        api: ctx.__testApi,
        alarmListeners,
        startupListeners,
        drainQueue: () => ctx.sgEnqueueSessionTempTabOp(() => {})
      };
    }

    // 1. Live SW creates warm pool and schedules idle TTL alarm + session metadata
    const sw1 = bootSwInstance();
    assert.strictEqual(sw1.alarmListeners.length, 1, "background.js must bind chrome.alarms.onAlarm listener");
    assert.strictEqual(sw1.startupListeners.length, 1, "background.js must bind chrome.runtime.onStartup listener");

    const pool = {
      srcTabId: 101,
      runId: "run_101",
      aborted: false,
      workerWindowId: 700,
      idleTimer: null,
      workers: [{ slot: 0, tabId: 801 }, { slot: 1, tabId: 802 }]
    };
    sw1.api.pools.set(101, pool);
    await sw1.ctx.sgTrackOrchWorkerWindow(700);
    await sw1.ctx.sgTrackTempTab("orch", 801);
    await sw1.ctx.sgTrackTempTab("orch", 802);
    sw1.ctx.sgScheduleOrchPoolIdleTimer(pool);
    await sw1.drainQueue();

    assert.ok(sharedAlarms.has("sg_orch_idle_101"), "Warm pool must schedule chrome.alarms idle timer");
    assert.deepStrictEqual(sharedSession.sgActiveOrchPools["101"].tabIds, [801, 802]);
    assert.strictEqual(sharedSession.sgActiveOrchPools["101"].workerWindowId, 700);

    sw1.ctx.sgClearOrchPoolIdleTimer(pool);
    assert.strictEqual(sharedAlarms.has("sg_orch_idle_101"), false, "Clearing idle timer must clear chrome.alarms entry");

    // Re-arm before simulated MV3 SW termination
    sw1.ctx.sgScheduleOrchPoolIdleTimer(pool);
    await sw1.drainQueue();

    // 2. Simulated MV3 SW cold restart (empty in-memory maps!) -> Idle alarm wakes SW and cleans session pool
    const sw2 = bootSwInstance({ triggerBootCleanup: false });
    assert.strictEqual(sw2.api.pools.size, 0);
    await sw2.alarmListeners[0]({ name: "sg_orch_idle_101" });
    await sw2.drainQueue();

    assert.ok(removedWindows.includes(700), "Alarm after SW restart must close persisted worker window 700");
    assert.ok(removedTabs.includes(801) && removedTabs.includes(802), "Alarm after SW restart must close persisted worker tabs");
    assert.strictEqual(sharedSession.sgActiveOrchPools["101"], undefined, "Session pool entry must be removed after alarm cleanup");
    assert.deepStrictEqual(sharedSession.sgActiveOrchWorkerWindows, []);
    assert.deepStrictEqual(sharedSession.sgActiveTempTabs.orch, []);

    // 3. Boot orphan cleanup drains orphaned opt/scrape/audit/orch tabs & windows, while sparing active in-memory bucket
    removedTabs.length = 0;
    removedWindows.length = 0;
    sharedSession.sgActiveOrchPools = {
      "202": { runId: "stale_202", workerWindowId: 710, tabIds: [811] }
    };
    sharedSession.sgActiveOrchWorkerWindows = [710];
    sharedSession.sgActiveTempTabs = {
      opt: [900],
      scrape: [901],
      batch: [903],
      orch: [811],
      audit: [902]
    };

    const sw3 = bootSwInstance({ triggerBootCleanup: false });
    // Simulate an active in-memory batch scrape owning tab 903 -> must NOT be killed!
    sw3.api.batchTabs.add(903);
    await sw3.ctx.sgCleanupOrphanedOrchWorkersOnBoot();

    assert.ok(removedWindows.includes(710), "Boot cleanup must close orphaned worker window 710");
    for (const orphanTid of [811, 900, 901, 902]) {
      assert.ok(removedTabs.includes(orphanTid), `Boot cleanup must close orphaned tab ${orphanTid}`);
    }
    assert.strictEqual(removedTabs.includes(903), false, "Boot cleanup must NOT close active in-memory batch tab 903");
    assert.deepStrictEqual(sharedSession.sgActiveTempTabs.batch, [903]);

    // 4. Cold-wake concurrency race: stale persisted state + concurrent live pool created BEFORE boot cleanup finishes
    removedTabs.length = 0;
    removedWindows.length = 0;
    sharedSession.sgActiveOrchPools = {
      "101": { runId: "stale_101", workerWindowId: 700, tabIds: [801] }
    };
    sharedSession.sgActiveOrchWorkerWindows = [700];
    sharedSession.sgActiveTempTabs = {
      opt: [],
      scrape: [],
      batch: [],
      orch: [801],
      audit: []
    };

    const swRace = bootSwInstance({ triggerBootCleanup: true });
    // Synchronously register a new live pool on the SAME srcTabId 101 while _sgBootCleanupPromise is suspended on storage.session.get
    const livePool = {
      srcTabId: 101,
      runId: "live_101",
      aborted: false,
      busy: true,
      workerWindowId: 799,
      idleTimer: null,
      workers: [{ slot: 0, tabId: 899 }]
    };
    swRace.api.pools.set(101, livePool);
    swRace.ctx.sgTrackOrchWorkerWindow(799);
    swRace.ctx.sgTrackTempTab("orch", 899);
    swRace.ctx.sgPersistOrchPoolSession(livePool);

    await swRace.api.bootCleanupPromise;
    await swRace.drainQueue();

    assert.ok(removedWindows.includes(700), "Cold-wake cleanup must close stale worker window 700");
    assert.ok(removedTabs.includes(801), "Cold-wake cleanup must close stale worker tab 801");
    assert.strictEqual(removedWindows.includes(799), false, "Cold-wake cleanup MUST NOT close concurrent live worker window 799");
    assert.strictEqual(removedTabs.includes(899), false, "Cold-wake cleanup MUST NOT close concurrent live worker tab 899");
    assert.strictEqual(sharedSession.sgActiveOrchPools["101"].runId, "live_101");
    assert.deepStrictEqual(sharedSession.sgActiveOrchPools["101"].tabIds, [899]);
    assert.deepStrictEqual(sharedSession.sgActiveOrchWorkerWindows, [799]);
    assert.deepStrictEqual(sharedSession.sgActiveTempTabs.orch, [899]);

    // 5. Busy pool guard on idle alarm
    await swRace.alarmListeners[0]({ name: "sg_orch_idle_101" });
    await swRace.drainQueue();
    assert.strictEqual(swRace.api.pools.has(101), true, "Idle alarm must NOT destroy a busy orchestrator pool");
    assert.strictEqual(removedWindows.includes(799), false, "Idle alarm must NOT close busy worker window 799");
    assert.strictEqual(removedTabs.includes(899), false, "Idle alarm must NOT close busy worker tab 899");
  }
  console.log("PASS [W1]: MV3 Service Worker session persistence, alarm idle cleanup, and multi-bucket boot orphan recovery verified");

  // =========================================================================
  // [W2] spoof_injector.js Idempotency & Non-Configurable Descriptor Safety
  // =========================================================================
  {
    const keydownListeners = [];
    const wizListeners = [];
    function FakeInput() { this.type = "file"; }
    const nativeClick = function () { return "native"; };
    FakeInput.prototype.click = nativeClick;

    function FakeIframe() {}
    Object.defineProperty(FakeIframe.prototype, "contentWindow", {
      get() { return null; },
      configurable: true
    });
    function FakeMsgEv() {}
    Object.defineProperty(FakeMsgEv.prototype, "source", {
      get() { return null; },
      configurable: true
    });

    const win = {
      location: { hash: "" },
      addEventListener(type, fn, cap) {
        if (type === "keydown" && cap) keydownListeners.push(fn);
        if (type === "sg-wiz-tokens-request") wizListeners.push(fn);
      },
      dispatchEvent() { return true; }
    };
    const ctx = vm.createContext({
      window: win,
      document: { documentElement: { appendChild() {}, getAttribute: () => "1" }, body: null },
      localStorage: { getItem: () => null },
      HTMLInputElement: FakeInput,
      HTMLIFrameElement: FakeIframe,
      MessageEvent: FakeMsgEv,
      CustomEvent: class { constructor(t, o) { this.type = t; this.detail = o && o.detail; } },
      MutationObserver: class { observe() {} disconnect() {} },
      setInterval: () => 1,
      clearInterval() {},
      setTimeout: () => 1,
      clearTimeout() {},
      WeakMap, Map, Proxy, Object, String, Boolean, Array, console
    });

    vm.runInContext(spoofJs, ctx);
    const hookedClickAfterFirst = FakeInput.prototype.click;
    const hookedCwAfterFirst = Object.getOwnPropertyDescriptor(FakeIframe.prototype, "contentWindow").get;
    assert.strictEqual(win.__sgSpoofInstalled, true, "__sgSpoofInstalled flag must be set after installation");
    assert.strictEqual(keydownListeners.length, 1);
    assert.notStrictEqual(hookedClickAfterFirst, nativeClick);

    // Run a SECOND time -> idempotency guard must prevent double wrapping!
    vm.runInContext(spoofJs, ctx);
    assert.strictEqual(FakeInput.prototype.click, hookedClickAfterFirst, "Double injection must NOT double-wrap HTMLInputElement.prototype.click");
    assert.strictEqual(Object.getOwnPropertyDescriptor(FakeIframe.prototype, "contentWindow").get, hookedCwAfterFirst, "Double injection must NOT double-wrap contentWindow");
    assert.strictEqual(keydownListeners.length, 1, "Double injection must NOT attach duplicate keydown listener");

    // Non-configurable / frozen descriptors must NOT throw and must NOT block Ctrl+K listener
    function LockedInput() {}
    Object.defineProperty(LockedInput.prototype, "click", {
      value: () => {},
      writable: false,
      configurable: false
    });
    function LockedIframe() {}
    Object.defineProperty(LockedIframe.prototype, "contentWindow", {
      get() { return null; },
      configurable: false
    });
    function LockedMsg() {}
    Object.defineProperty(LockedMsg.prototype, "source", {
      get() { return null; },
      configurable: false
    });

    const lockedKeydowns = [];
    const lockedCtx = vm.createContext({
      window: {
        location: { hash: "" },
        addEventListener(t, fn, cap) { if (t === "keydown" && cap) lockedKeydowns.push(fn); },
        dispatchEvent() { return true; }
      },
      document: { documentElement: { appendChild() {}, getAttribute: () => "1" }, body: null },
      localStorage: { getItem: () => null },
      HTMLInputElement: LockedInput,
      HTMLIFrameElement: LockedIframe,
      MessageEvent: LockedMsg,
      CustomEvent: class { constructor(t) { this.type = t; } },
      MutationObserver: class { observe() {} disconnect() {} },
      setInterval: () => 1,
      clearInterval() {},
      setTimeout: () => 1,
      clearTimeout() {},
      WeakMap, Map, Proxy, Object, String, Boolean, Array, console
    });
    vm.runInContext(spoofJs, lockedCtx);
    assert.strictEqual(lockedKeydowns.length, 1, "Frozen/non-configurable prototype properties must NOT break Ctrl+K listener installation");
  }
  console.log("PASS [W2]: spoof_injector.js double-injection idempotency & non-configurable descriptor resilience verified");

  // =========================================================================
  // [W3] Đợt 2 Zero-Eval & Zero-Sink Hygiene Across background, spoof, content/*
  // =========================================================================
  {
    const forbiddenEval = /\beval\s*\(|new\s+Function\b/;
    const forbiddenHtml = /\.(?:innerHTML|outerHTML)\s*[+]?=|\binsertAdjacentHTML\s*\(|\bdocument\.write\s*\(/;

    assert.strictEqual(forbiddenEval.test(bgJs), false, "background.js must contain 0 eval/new Function");
    assert.strictEqual(forbiddenHtml.test(bgJs), false, "background.js must contain 0 HTML sinks");
    assert.strictEqual(forbiddenEval.test(spoofJs), false, "spoof_injector.js must contain 0 eval/new Function");
    assert.strictEqual(forbiddenHtml.test(spoofJs), false, "spoof_injector.js must contain 0 HTML sinks");
    new vm.Script(bgJs, { filename: "background.js" });
    new vm.Script(spoofJs, { filename: "spoof_injector.js" });

    for (const rel of getContentScriptFiles()) {
      const code = loadFile(rel);
      assert.strictEqual(forbiddenEval.test(code), false, `${rel} must contain 0 eval/new Function`);
      new vm.Script(code, { filename: rel });
    }
  }
  console.log("PASS [W3]: Zero eval/HTML sinks & clean syntax verified across background.js, spoof_injector.js, and all 14 content scripts");

  // =========================================================================
  // [W4] Worker rAF/Visibility Shim & Scoped Submit/Polling DOM Isolation
  // =========================================================================
  {
    let moCalls = 0;
    let ivCalls = 0;
    let lsReads = 0;
    let lsWrites = 0;
    const workerDoc = {};
    let nativeRafCalls = 0;
    const workerWin = {
      location: { hash: "#sg_orch_worker=1" },
      requestAnimationFrame() {
        nativeRafCalls++;
        return 900 + nativeRafCalls;
      },
      cancelAnimationFrame() {},
      addEventListener() {},
      dispatchEvent() { return true; }
    };
    const workerCtx = vm.createContext({
      window: workerWin,
      document: workerDoc,
      performance: { now: () => 1234 },
      localStorage: {
        getItem() { lsReads++; return null; },
        setItem() { lsWrites++; }
      },
      MutationObserver: class {
        constructor() { moCalls++; }
        observe() { moCalls++; }
        disconnect() {}
      },
      setInterval() { ivCalls++; return 1; },
      clearInterval() {},
      setTimeout,
      clearTimeout,
      Map, Object, String, Boolean, Array, console
    });
    vm.runInContext(spoofJs, workerCtx);

    assert.strictEqual(moCalls, 0, "Worker spoof_injector must create 0 MutationObservers");
    assert.strictEqual(ivCalls, 0, "Worker spoof_injector must register 0 setIntervals");
    assert.strictEqual(lsReads + lsWrites, 0, "Worker spoof_injector must perform 0 localStorage reads/writes");
    assert.strictEqual(workerDoc.hidden, false, "Worker document.hidden must be spoofed false");
    assert.strictEqual(workerDoc.visibilityState, "visible", "Worker document.visibilityState must be spoofed visible");
    assert.strictEqual(workerDoc.hasFocus(), true, "Worker document.hasFocus() must be spoofed true");

    let canceledFired = false;
    const canceledId = workerWin.requestAnimationFrame(() => { canceledFired = true; });
    workerWin.cancelAnimationFrame(canceledId);
    const rafTimestamp = await new Promise(resolve => {
      workerWin.requestAnimationFrame(ts => resolve(ts));
    });
    await new Promise(r => setTimeout(r, 70));
    assert.strictEqual(rafTimestamp, 1234, "Worker rAF timer fallback must fire even when minimized native rAF stalls");
    assert.strictEqual(canceledFired, false, "Canceled worker rAF callback must not fire");

    // Extract sgSubmitOrchPromptInTab, sgCheckOrchSubmitAcceptedInTab, and sgCheckOrchWorkerResponseInTab
    function extractTopFn(src, name) {
      const start = src.indexOf(`function ${name}(`);
      assert.ok(start > 0, `${name} not found in background.js`);
      let depth = 0;
      let end = -1;
      for (let i = src.indexOf("{", start); i < src.length; i++) {
        if (src[i] === "{") depth++;
        else if (src[i] === "}") {
          depth--;
          if (depth === 0) { end = i + 1; break; }
        }
      }
      return src.slice(start, end);
    }

    function mkEl(tag, attrs = {}, text = "") {
      const el = {
        nodeType: 1,
        tagName: tag.toUpperCase(),
        attrs: Object.assign({}, attrs),
        children: [],
        childNodes: [],
        parentNode: null,
        isConnected: true,
        offsetParent: tag === "bard-sidenav" ? {} : {},
        _text: text,
        clicks: 0,
        className: attrs.class || "",
        disabled: false,
        dataset: {},
        classList: {
          add(c) { const s = new Set(el.className.split(/\s+/).filter(Boolean)); s.add(c); el.className = [...s].join(" "); },
          remove(c) { const s = new Set(el.className.split(/\s+/).filter(Boolean)); s.delete(c); el.className = [...s].join(" "); },
          contains(c) { return el.className.split(/\s+/).includes(c); }
        },
        get textContent() {
          return el._text + el.children.map(c => c.textContent).join("");
        },
        set textContent(v) {
          el._text = String(v || "");
          el.children = [];
          el.childNodes = [];
        },
        getAttribute(k) {
          if (k === "class") return el.className || null;
          return Object.prototype.hasOwnProperty.call(el.attrs, k) ? el.attrs[k] : null;
        },
        hasAttribute(k) {
          return Object.prototype.hasOwnProperty.call(el.attrs, k);
        },
        appendChild(ch) {
          ch.parentNode = el;
          el.children.push(ch);
          el.childNodes.push(ch);
          return ch;
        },
        getClientRects() { return [{ width: 20, height: 20 }]; },
        click() { el.clicks++; },
        focus() {},
        dispatchEvent() { return true; },
        matches(sel) {
          return sel.split(",").map(s => s.trim()).some(part => {
            if (!part) return false;
            if (part.includes(" ")) {
              const segs = part.split(/\s+/);
              const tail = segs[segs.length - 1];
              const anc = segs.slice(0, -1).join(" ");
              return el.matches(tail) && Boolean(el.parentNode && el.parentNode.closest(anc));
            }
            if (part.startsWith(".")) return el.classList.contains(part.slice(1));
            const attrMatch = part.match(/^([a-z0-9_-]+)?\[([a-z0-9_-]+)(\*=|=)"([^"]+)"(?:\s+i)?\]$/i);
            if (attrMatch) {
              const [, tName, aName, op, aVal] = attrMatch;
              if (tName && el.tagName !== tName.toUpperCase()) return false;
              const got = String(el.getAttribute(aName) || "");
              return op === "*="
                ? got.toLowerCase().includes(aVal.toLowerCase())
                : got.toLowerCase() === aVal.toLowerCase();
            }
            const tagClsMatch = part.match(/^([a-z0-9_-]+)\.([a-z0-9_-]+)$/i);
            if (tagClsMatch) {
              return el.tagName === tagClsMatch[1].toUpperCase() && el.classList.contains(tagClsMatch[2]);
            }
            return el.tagName === part.toUpperCase();
          });
        },
        closest(sel) {
          let cur = el;
          while (cur) {
            if (cur.matches(sel)) return cur;
            cur = cur.parentNode;
          }
          return null;
        },
        querySelectorAll(sel) {
          const out = [];
          const walk = n => {
            for (const c of n.children || []) {
              if (c.matches(sel)) out.push(c);
              walk(c);
            }
          };
          walk(el);
          return out;
        },
        querySelector(sel) { return el.querySelectorAll(sel)[0] || null; }
      };
      if (text) {
        el.childNodes.push({ nodeType: 3, textContent: text });
      }
      return el;
    }

    const domBody = mkEl("body");
    const sideNav = mkEl("bard-sidenav");
    const sidebarFeedbackBtn = mkEl("button", { "aria-label": "Gửi phản hồi" });
    const sidebarSpinner = mkEl("div", { class: "loading", "aria-busy": "true" });
    sideNav.appendChild(sidebarFeedbackBtn);
    sideNav.appendChild(sidebarSpinner);
    domBody.appendChild(sideNav);

    const globalFeedbackBtn = mkEl("button", { "aria-label": "Send feedback" });
    domBody.appendChild(globalFeedbackBtn);

    const inputArea = mkEl("input-area-v2");
    const editor = mkEl("div", { class: "ql-editor", contenteditable: "true", role: "textbox" }, "Prompt ready");
    const sendContainer = mkEl("div", { class: "send-button-container" });
    const realSendBtn = mkEl("button", { "aria-label": "Gửi tin nhắn" });
    sendContainer.appendChild(realSendBtn);
    inputArea.appendChild(editor);
    inputArea.appendChild(sendContainer);
    domBody.appendChild(inputArea);

    const workerDomDoc = {
      body: domBody,
      querySelector: s => domBody.querySelector(s),
      querySelectorAll: s => domBody.querySelectorAll(s)
    };
    const workerEvalCtx = vm.createContext({
      document: workerDomDoc,
      Node: { TEXT_NODE: 3, ELEMENT_NODE: 1 },
      Event: class { constructor(t) { this.type = t; } },
      KeyboardEvent: class { constructor(t) { this.type = t; } },
      Number, Boolean, String, Array, RegExp
    });
    vm.runInContext([
      extractTopFn(bgJs, "sgCheckOrchSubmitAcceptedInTab"),
      extractTopFn(bgJs, "sgSubmitOrchPromptInTab"),
      extractTopFn(bgJs, "sgCheckOrchWorkerResponseInTab")
    ].join("\n"), workerEvalCtx);

    const preAcc = workerEvalCtx.sgCheckOrchSubmitAcceptedInTab(0, 0, true);
    assert.strictEqual(preAcc.submitted, false, "Sidebar .loading must NOT trigger false submitted=true");
    assert.strictEqual(preAcc.isGenerating, false, "Sidebar .loading must NOT trigger false isGenerating=true");

    const prePoll = workerEvalCtx.sgCheckOrchWorkerResponseInTab(0, 0);
    assert.strictEqual(prePoll.isGenerating, false, "Sidebar .loading must NOT trigger false poll isGenerating=true");
    assert.strictEqual(prePoll.queryAccepted, false, "Sidebar .loading must NOT trigger false queryAccepted=true");
    assert.strictEqual(prePoll.phase, "waiting");

    const subRes = workerEvalCtx.sgSubmitOrchPromptInTab(0, 0, false);
    assert.strictEqual(subRes.clicked, true);
    assert.strictEqual(subRes.method, "click");
    assert.strictEqual(sidebarFeedbackBtn.clicks, 0, "Must NEVER click sidebar 'Gửi phản hồi' button");
    assert.strictEqual(globalFeedbackBtn.clicks, 0, "Must NEVER click 'Send feedback' button");
    assert.strictEqual(realSendBtn.clicks, 1, "Must click the composer send button inside input-area-v2");

    // Append real model-response and confirm streaming text extraction works
    const mr = mkEl("model-response");
    const msgContent = mkEl("message-content");
    const panel = mkEl("div", { class: "markdown-main-panel" });
    panel.appendChild(mkEl("p", {}, "Quantum answer"));
    msgContent.appendChild(panel);
    mr.appendChild(msgContent);
    domBody.appendChild(mr);

    const postPoll = workerEvalCtx.sgCheckOrchWorkerResponseInTab(0, 0);
    assert.strictEqual(postPoll.queryAccepted, true);
    assert.strictEqual(postPoll.phase, "streaming");
    assert.strictEqual(postPoll.response, "Quantum answer");
  }
  console.log("PASS [W4]: Worker rAF/visibility shim & scoped submit/poll DOM isolation verified");
  console.log("\nALL SERVICE WORKER RECOVERY & SPOOF RESILIENCE TESTS PASSED!");
})().catch((err) => {
  console.error("TEST FAILED:", err);
  process.exit(1);
});
