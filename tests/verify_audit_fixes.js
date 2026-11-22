const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const { ROOT, loadCombinedContentJs } = require("./load-content");
const contentJs = loadCombinedContentJs();
const backgroundJs = fs.readFileSync(path.join(ROOT, "background.js"), "utf8");
const spoofJs = fs.readFileSync(path.join(ROOT, "spoof_injector.js"), "utf8");
const popupJs = fs.readFileSync(path.join(ROOT, "popup.js"), "utf8");
const popupHtml = fs.readFileSync(path.join(ROOT, "popup.html"), "utf8");

function extractFn(src, signaturePrefix) {
  const idx = src.indexOf(signaturePrefix);
  assert.ok(idx >= 0, `Could not locate "${signaturePrefix}"`);
  const braceStart = src.indexOf("{", idx);
  let depth = 0, inStr = null, inComment = null;
  for (let i = braceStart; i < src.length; i++) {
    const ch = src[i], nx = src[i + 1];
    if (inComment === "line") { if (ch === "\n") inComment = null; continue; }
    if (inComment === "block") { if (ch === "*" && nx === "/") { inComment = null; i++; } continue; }
    if (inStr) { if (ch === "\\") { i++; continue; } if (ch === inStr) inStr = null; continue; }
    if (ch === "/" && nx === "/") { inComment = "line"; i++; continue; }
    if (ch === "/" && nx === "*") { inComment = "block"; i++; continue; }
    if (ch === '"' || ch === "'" || ch === "`") { inStr = ch; continue; }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return src.slice(idx, i + 1);
    }
  }
  throw new Error(`Unclosed block for "${signaturePrefix}"`);
}

class MockClassList {
  constructor() { this._set = new Set(); }
  _sync(s) { this._set = new Set(String(s || "").trim().split(/\s+/).filter(Boolean)); }
  add(...a) { a.forEach(c => c && this._set.add(c)); }
  remove(...a) { a.forEach(c => this._set.delete(c)); }
  contains(c) { return this._set.has(c); }
  toggle(c, f) {
    if (f === undefined) { if (this._set.has(c)) { this._set.delete(c); return false; } this._set.add(c); return true; }
    if (f) this._set.add(c); else this._set.delete(c);
    return Boolean(f);
  }
}

class MockEl {
  constructor(tag) {
    this.tagName = String(tag || "DIV").toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.attrs = new Map();
    this.style = {};
    this.dataset = {};
    this.classList = new MockClassList();
    this._text = "";
    this._htmlReads = 0;
    this._htmlWrites = [];
    this.disabled = false;
    this.value = "";
    this.clicks = 0;
    this.isConnected = true;
  }
  get className() { return Array.from(this.classList._set).join(" "); }
  set className(v) { this.classList._sync(v); }
  get textContent() {
    if (this.children.length === 0) return this._text;
    return this._text + this.children.map(c => c.textContent).join("\n");
  }
  set textContent(v) {
    this._text = String(v ?? "");
    this.children = [];
  }
  get innerHTML() { this._htmlReads++; return "<p><br></p>"; }
  set innerHTML(v) { this._htmlWrites.push(String(v)); }
  appendChild(c) { c.parentNode = this; this.children.push(c); return c; }
  replaceChildren(...nodes) { this.children = []; this._text = ""; nodes.forEach(n => this.appendChild(n)); }
  setAttribute(k, v) { this.attrs.set(k, String(v)); }
  getAttribute(k) { return this.attrs.has(k) ? this.attrs.get(k) : null; }
  hasAttribute(k) { return this.attrs.has(k); }
  removeAttribute(k) { this.attrs.delete(k); }
  addEventListener() {}
  removeEventListener() {}
  dispatchEvent() { return true; }
  focus() {}
  click() { this.clicks++; }
  closest(sel) {
    let cur = this;
    const parts = sel.split(",").map(s => s.trim());
    while (cur) {
      for (const p of parts) {
        if (cur.tagName.toLowerCase() === p) return cur;
        if (p.startsWith(".") && cur.classList.contains(p.slice(1).split(" ")[0])) return cur;
        if (p === 'button[data-test-id="send-button"]' && cur.tagName === "BUTTON" && cur.getAttribute("data-test-id") === "send-button") return cur;
        if (p === ".send-button-container button" && cur.tagName === "BUTTON" && cur.parentNode && cur.parentNode.classList.contains("send-button-container")) return cur;
        if (p === "button.send-button" && cur.tagName === "BUTTON" && cur.classList.contains("send-button")) return cur;
      }
      cur = cur.parentNode;
    }
    return null;
  }
  contains(node) {
    let cur = node;
    while (cur) { if (cur === this) return true; cur = cur.parentNode; }
    return false;
  }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  querySelectorAll(sel) {
    const out = [];
    const parts = sel.split(",").map(s => s.trim());
    const matchOne = (el, p) => {
      if (p === el.tagName.toLowerCase()) return true;
      if (p.startsWith(".") && el.classList.contains(p.slice(1))) return true;
      if (p === '[data-test-id^="bard-mode-option-"]') return (el.getAttribute("data-test-id") || "").startsWith("bard-mode-option-");
      if (p === '[data-test-id="bard-mode-menu-button"]') return el.getAttribute("data-test-id") === "bard-mode-menu-button";
      if (p === 'mat-icon[fonticon="lock"]') return el.tagName === "MAT-ICON" && el.getAttribute("fonticon") === "lock";
      if (p === 'mat-icon[fonticon="stop"]') return el.tagName === "MAT-ICON" && el.getAttribute("fonticon") === "stop";
      if (p === 'mat-icon[fonticon="close"]') return el.tagName === "MAT-ICON" && el.getAttribute("fonticon") === "close";
      if (p === "chat-window.is-temporary-chat") return el.tagName === "CHAT-WINDOW" && el.classList.contains("is-temporary-chat");
      if (p === 'gem-menu-item[value="thinking_level"]') return el.tagName === "GEM-MENU-ITEM" && el.getAttribute("value") === "thinking_level";
      if (p === "gem-menu-item") return el.tagName === "GEM-MENU-ITEM";
      if (p === "gem-menu-item:not([data-test-id]):not([value]):not([aria-controls])") {
        return el.tagName === "GEM-MENU-ITEM" && !el.hasAttribute("data-test-id") && !el.hasAttribute("value") && !el.hasAttribute("aria-controls");
      }
      if (p === 'button[class*="temporary"]') return el.tagName === "BUTTON" && el.className.includes("temporary");
      if (p === '[data-temporary]') return el.hasAttribute("data-temporary");
      return false;
    };
    const walk = (n) => {
      for (const c of n.children) {
        if (parts.some(p => matchOne(c, p))) out.push(c);
        walk(c);
      }
    };
    walk(this);
    return out;
  }
}

(async () => {
  // =========================================================================
  // [R1] Capture-phase priority: SkillPreSendInterceptor vs Orchestrator vs Periodic
  // =========================================================================
  {
    const docListeners = { keydown: [], click: [] };
    const composer = new MockEl("div");
    composer.classList.add("ql-editor");
    composer.setAttribute("contenteditable", "true");
    composer.setAttribute("role", "textbox");
    const sendBtn = new MockEl("button");
    sendBtn.setAttribute("data-test-id", "send-button");
    const stopIcon = new MockEl("mat-icon");
    stopIcon.setAttribute("fonticon", "stop");

    let composerText = "";
    let periodicBlocked = null;
    let skillInjectCalls = 0;
    const orchStarts = [];

    const doc = {
      body: { dataset: {} },
      documentElement: new MockEl("html"),
      addEventListener(type, fn, capture) {
        if (docListeners[type]) docListeners[type].push({ fn, capture: Boolean(capture) });
      },
      removeEventListener() {},
      querySelectorAll: () => [],
      querySelector: () => null
    };

    const dispatchDoc = (type, ev) => {
      for (const item of docListeners[type]) {
        if (ev.immediateStopped) break;
        item.fn(ev);
      }
    };

    const r1Code = [
      extractFn(contentJs, "function initSkillPreSendInterceptor("),
      extractFn(contentJs, "function sgOrchCheckPrefixIntercept("),
      extractFn(contentJs, "function sgOrchOnCaptureKeydown("),
      extractFn(contentJs, "function sgOrchOnCaptureClick(")
    ].join("\n\n");

    const r1Ctx = vm.createContext({
      document: doc,
      window: { location: { hash: "" } },
      Element: MockEl,
      _sgSkillBypassSend: false,
      _sgMigrationRunning: false,
      _sgBaselineMigrationRunning: false,
      _sgOrchBypassSendIntercept: false,
      isExtensionEnabled: true,
      isSkillsInjectionEnabled: true,
      isBaselineInjectionEnabled: true,
      isOrchestratorEnabled: true,
      isCurrentlyGenerating: false,
      isQueueingEnabled: false,
      slashMenuVisible: false,
      sgSkillMenuVisible: false,
      sgEffectiveSkills: [{ id: "orchestrate-mode", enabled: true }],
      _sgOrchConfigPopoverEl: null,
      sgIsImeComposing: () => false,
      isMessageEditField: () => false,
      findPromptInput: () => composer,
      getPromptText: () => composerText,
      sgOrchReadComposerText: () => composerText.trim(),
      sgResolveInvokedSkills: (raw) => ({
        invokedSkills: /\/oc\/|\/orchestrate\/|\/an\/|@orchestrate-mode/i.test(raw)
          ? [{ id: "orchestrate-mode", name: "Orchestrate Mode" }]
          : [],
        cleanedQuery: raw
      }),
      sgGetActiveBaselinesForCurrentTurn: () => [{ id: "rule1", text: "Always check." }],
      sgGetPeriodicBlockedElement: () => periodicBlocked,
      sgPerformSkillInjectionAndSend: () => { skillInjectCalls++; composerText = "[BASELINE] mutated"; return true; },
      sgStartOrchestration: (txt) => { orchStarts.push(txt); },
      SG_SKILL_SEND_BTN_SELECTOR: 'button[data-test-id="send-button"]'
    });
    vm.runInContext(r1Code, r1Ctx);

    // Register in exact real startup order: Skills FIRST, Orchestrator SECOND!
    r1Ctx.initSkillPreSendInterceptor();
    doc.addEventListener("keydown", r1Ctx.sgOrchOnCaptureKeydown, true);
    doc.addEventListener("click", r1Ctx.sgOrchOnCaptureClick, true);

    const makeKeyEv = (key = "Enter") => ({
      key, shiftKey: false, ctrlKey: false, altKey: false, metaKey: false,
      target: composer,
      defaultPrevented: false, immediateStopped: false,
      preventDefault() { this.defaultPrevented = true; },
      stopPropagation() {},
      stopImmediatePropagation() { this.immediateStopped = true; }
    });
    const makeClickEv = (targetEl) => ({
      target: targetEl,
      defaultPrevented: false, immediateStopped: false,
      preventDefault() { this.defaultPrevented = true; },
      stopPropagation() {},
      stopImmediatePropagation() { this.immediateStopped = true; }
    });

    // Case A: /oc/, /orchestrate/, @orchestrate-mode + Turn 1 Baseline -> Orchestrator MUST win on Enter & Click!
    for (const prompt of ["/oc/ Build allocator", "/orchestrate/ Cache design", "@orchestrate-mode SQL plan"]) {
      composerText = prompt;
      const beforeOrch = orchStarts.length;
      const beforeSkills = skillInjectCalls;
      const kev = makeKeyEv("Enter");
      dispatchDoc("keydown", kev);
      assert.strictEqual(skillInjectCalls, beforeSkills, `SkillPreSend must NOT hijack ${prompt} on Enter`);
      assert.strictEqual(orchStarts.length, beforeOrch + 1, `Orchestrator MUST start for ${prompt} on Enter`);
      assert.strictEqual(kev.defaultPrevented, true);

      const cev = makeClickEv(sendBtn);
      dispatchDoc("click", cev);
      assert.strictEqual(skillInjectCalls, beforeSkills, `SkillPreSend must NOT hijack ${prompt} on Send click`);
      assert.strictEqual(orchStarts.length, beforeOrch + 2, `Orchestrator MUST start for ${prompt} on Send click`);
    }

    // Case B: Periodic Coming soon block active -> neither SkillPreSend nor Orchestrator mutates draft or runs!
    periodicBlocked = { symbol: "Cd" };
    composerText = "/an/ explain pointers";
    dispatchDoc("keydown", makeKeyEv("Enter"));
    assert.strictEqual(skillInjectCalls, 0, "SkillPreSend must yield when Periodic Coming soon blocks send");
    assert.strictEqual(composerText, "/an/ explain pointers", "Composer text must NOT be mutated while send-blocked");

    composerText = "/oc/ explain pointers";
    dispatchDoc("keydown", makeKeyEv("Enter"));
    assert.strictEqual(orchStarts.length, 6, "Orchestrator must NOT start when Periodic Coming soon blocks send");

    // Case C: Disabled or Stop sendBtn must NOT launch Orchestrator on click
    periodicBlocked = null;
    sendBtn.disabled = true;
    dispatchDoc("click", makeClickEv(sendBtn));
    assert.strictEqual(orchStarts.length, 6, "Disabled Send button must NOT start Orchestrator");
    sendBtn.disabled = false;
    sendBtn.classList.add("stop");
    dispatchDoc("click", makeClickEv(sendBtn));
    assert.strictEqual(orchStarts.length, 6, "Stop button must NOT start Orchestrator");
    sendBtn.classList.remove("stop");

    // Case D: Regular Skill invocation still runs SkillPreSendInterceptor!
    composerText = "/an/ explain malloc";
    dispatchDoc("keydown", makeKeyEv("Enter"));
    assert.strictEqual(skillInjectCalls, 1, "Regular /an/ prompt MUST still use SkillPreSendInterceptor");

    console.log("PASS [R1]: Capture-phase priority respects Orchestrator prefixes (/oc/, /orchestrate/, @orchestrate-mode), Periodic Coming-Soon blocks, and disabled/stop buttons");
  }

  // =========================================================================
  // [R2] Prompt Chains safe DOM text construction (zero innerHTML HTML-parsing injection)
  // =========================================================================
  {
    const editor = new MockEl("div");
    editor.tagName = "DIV";
    const doc = {
      querySelector: (sel) => sel === "EDITOR" ? editor : null,
      createElement: (tag) => new MockEl(tag),
      createRange: () => ({ selectNodeContents() {}, collapse() {} })
    };
    const fnCode = extractFn(contentJs, "async function executeChainStep(");
    const ctx = vm.createContext({
      document: doc,
      window: {
        getSelection: () => ({ removeAllRanges() {}, addRange() {} }),
        sgChainState: {
          isRunning: true,
          chain: {
            steps: [{ text: "std::vector<int>\n<img src=x onerror=alert(1)>\n\nlast" }]
          }
        }
      },
      Event: class Event { constructor(t, o) { this.type = t; Object.assign(this, o); } },
      QUEUE_INPUT_SELECTOR: "EDITOR",
      QUEUE_SEND_BUTTON_SELECTOR: "BTN_NONE",
      resolvePromptReferences: x => x,
      updateChainProgressIndicator() {},
      triggerWordCounterUpdate() {},
      resetChainExecution() {},
      showToast() {},
      setTimeout: () => 0,
      console
    });
    vm.runInContext(fnCode, ctx);
    await ctx.executeChainStep(0);

    assert.strictEqual(editor._htmlWrites.length, 0, "executeChainStep must NOT write step text via innerHTML");
    assert.strictEqual(editor.children.length, 4, "Must create 4 <p> elements for 4 lines");
    assert.strictEqual(editor.children[0].tagName, "P");
    assert.strictEqual(editor.children[0]._text, "std::vector<int>");
    assert.strictEqual(editor.children[0].children.length, 0, "Angle brackets must stay text, not HTML nodes");
    assert.strictEqual(editor.children[1]._text, "<img src=x onerror=alert(1)>");
    assert.strictEqual(editor.children[1].children.length, 0, "XSS payload must remain inert plain text");
    assert.strictEqual(editor.children[2].children[0]?.tagName, "BR");
    assert.strictEqual(editor.children[3]._text, "last");
    console.log("PASS [R2]: Prompt Chains uses safe replaceChildren() + textContent without HTML parsing or XSS");
  }

  // =========================================================================
  // [R3] Gemini 4 & Vietnamese Mode/Thinking Selectors + Temp Chat Active Guard
  // =========================================================================
  {
    const body = new MockEl("body");
    const doc = {
      body,
      getElementById: (id) => id === "sub_lv" ? submenuEl : null,
      querySelector: (sel) => doc.querySelectorAll(sel)[0] || null,
      querySelectorAll: (sel) => body.querySelectorAll(sel)
    };

    // Active temporary chat -> clickTemporaryChatButton must NOT click anything!
    const chatWin = new MockEl("chat-window");
    chatWin.classList.add("is-temporary-chat");
    const tempBtn = new MockEl("button");
    tempBtn.className = "temp-chat-button";
    const decoyDiv = new MockEl("div");
    decoyDiv.className = "temporary-notice";
    body.appendChild(chatWin);
    body.appendChild(tempBtn);
    body.appendChild(decoyDiv);

    // Gemini 4 Vietnamese Mode Menu with Auto at index 0 + locked Carbon
    const modeBtn = new MockEl("div");
    modeBtn.setAttribute("data-test-id", "bard-mode-menu-button");
    const modeLabel = new MockEl("span");
    modeLabel.className = "mode-title";
    modeLabel._text = "Hydrogen";
    modeBtn.appendChild(modeLabel);
    body.appendChild(modeBtn);

    const optAuto = new MockEl("button");
    optAuto.setAttribute("data-test-id", "bard-mode-option-auto");
    optAuto._text = "Tự động Chọn chế độ tốt nhất";
    const optH = new MockEl("button");
    optH.setAttribute("data-test-id", "bard-mode-option-0");
    optH._text = "Hydrogen Trợ giúp hằng ngày";
    const optN = new MockEl("button");
    optN.setAttribute("data-test-id", "bard-mode-option-1");
    optN._text = "Neon Phân tích sâu hơn";
    const optC = new MockEl("button");
    optC.setAttribute("data-test-id", "bard-mode-option-2");
    optC._text = "Carbon Lập trình và xử lý công việc phức tạp";
    const lockIcon = new MockEl("mat-icon");
    lockIcon.setAttribute("fonticon", "lock");
    optC.appendChild(lockIcon);
    body.appendChild(optAuto);
    body.appendChild(optH);
    body.appendChild(optN);
    body.appendChild(optC);

    const submenuEl = new MockEl("div");
    submenuEl.id = "sub_lv";
    const lvLow = new MockEl("gem-menu-item"); lvLow._text = "Thấp";
    const lvMed = new MockEl("gem-menu-item"); lvMed._text = "Trung bình";
    const lvHigh = new MockEl("gem-menu-item"); lvHigh._text = "Cao";
    submenuEl.appendChild(lvLow);
    submenuEl.appendChild(lvMed);
    submenuEl.appendChild(lvHigh);
    const triggerLv = new MockEl("gem-menu-item");
    triggerLv.setAttribute("value", "thinking_level");
    triggerLv.setAttribute("aria-controls", "sub_lv");
    body.appendChild(triggerLv);

    const bgModeCode = [
      extractFn(backgroundJs, "function clickTemporaryChatButton("),
      extractFn(backgroundJs, "function clickOptimizationModeButton("),
      extractFn(backgroundJs, "function setThinkingLevelInTab("),
      extractFn(backgroundJs, "function getCurrentModeName("),
      extractFn(contentJs, "function parseModeFromButtonText(")
    ].join("\n\n");

    const bgCtx = vm.createContext({ document: doc, MouseEvent: class { constructor(t) { this.type = t; } } });
    vm.runInContext(bgModeCode, bgCtx);

    assert.strictEqual(bgCtx.clickTemporaryChatButton(), true);
    assert.strictEqual(tempBtn.clicks, 0, "Already-active Temp Chat must NOT be toggled off by clicking");
    assert.strictEqual(decoyDiv.clicks, 0, "Arbitrary div.temporary must NEVER be clicked");

    assert.strictEqual(bgCtx.getCurrentModeName(), "Hydrogen");
    assert.strictEqual(bgCtx.clickOptimizationModeButton("flash"), "CLICKED");
    assert.strictEqual(optAuto.clicks, 0, "Must NEVER falsely select Tự động at index 0");
    assert.strictEqual(optH.clicks, 1, "flash must select Hydrogen");

    assert.strictEqual(bgCtx.clickOptimizationModeButton("thinking"), "CLICKED");
    assert.strictEqual(optN.clicks, 1, "thinking must select Neon");

    assert.strictEqual(bgCtx.clickOptimizationModeButton("pro"), "CLICKED");
    assert.strictEqual(optC.clicks, 0, "Locked Carbon must be skipped");
    assert.strictEqual(optH.clicks, 2, "Locked Pro must fall back to unlocked Hydrogen, not Auto");

    assert.strictEqual(bgCtx.setThinkingLevelInTab("medium"), "CLICKED");
    assert.strictEqual(lvMed.clicks, 1, "Vietnamese 'Trung bình' must be matched");
    assert.strictEqual(bgCtx.setThinkingLevelInTab("high"), "CLICKED");
    assert.strictEqual(lvHigh.clicks, 1, "Vietnamese 'Cao' must be matched");

    assert.strictEqual(bgCtx.parseModeFromButtonText("Hydrogen • Trợ giúp hằng ngày"), "fast");
    assert.strictEqual(bgCtx.parseModeFromButtonText("Neon • Phân tích sâu hơn"), "thinking");
    assert.strictEqual(bgCtx.parseModeFromButtonText("Carbon • Lập trình và xử lý công việc phức tạp"), "pro");
    assert.strictEqual(bgCtx.parseModeFromButtonText("Flash-Lite"), "fast");
    assert.strictEqual(bgCtx.parseModeFromButtonText("Flash"), "thinking");
    assert.strictEqual(bgCtx.parseModeFromButtonText("Tự động"), null);

    console.log("PASS [R3]: Gemini 4 & Vietnamese mode/thinking matchers + active Temp Chat guard verified");
  }

  // =========================================================================
  // [R4] Unified SG.messages bus & legacy runtime handlers strict boolean contract
  // =========================================================================
  {
    const { loadFile } = require("./load-content");
    const coreJs = loadFile("content/core-namespace.js");
    const runtimeBusJs = loadFile("content/runtime-bus.js");
    const nativeMsgListeners = [];
    const r4Ctx = vm.createContext({
      window: { location: { hash: "" }, isTrashcanEnabled: true },
      document: { documentElement: { setAttribute() {} }, hidden: false, body: {}, addEventListener() {}, querySelectorAll: () => [], getElementById: () => null },
      localStorage: { getItem: () => null, setItem() {} },
      chrome: {
        storage: {
          sync: { get: (_k, cb) => cb && cb({}), onChanged: { addListener() {} } },
          onChanged: { addListener() {} }
        },
        runtime: { onMessage: { addListener: fn => nativeMsgListeners.push(fn) } }
      },
      MutationObserver: class { observe() {} disconnect() {} },
      requestAnimationFrame: () => 1,
      setTimeout, clearTimeout, Map, Set, Promise, Date, Object, Array, Boolean, Number, String, Error, console,
      isDownloadAudioEnabled: false,
      downloadAudioObserver: null,
      isBookmarksEnabled: false,
      bookmarksObserver: null,
      _sgWelcomeSettingsOpen: false,
      isDailyCounterVisible: false,
      dailyPromptCounterElement: null,
      pinnedChatsObserver: null,
      _sgPinnedWrapperReclaimObserver: null,
      _sgDragChatToInputActive: false,
      useAIStudioForOptimize: false,
      async initCollapsiblePinnedChats() { return "async_promise_would_violate_if_returned"; },
      setupSidebarChatDragListeners() {},
      setupInputAreaDropTarget() {},
      teardownDragChatToInput() {},
      sgCancelWelcomeTourTimer() {},
      sgMaybeScheduleWelcomeTour() {},
      updateCounterPosition() {},
      removePinnedSectionHeader() {},
      handleRuntimeMessage() {},
      showToast() {},
      async fetchChatTurnsViaRpc() { return []; }
    });
    r4Ctx.globalThis = r4Ctx;

    // Extract either enclosing `(() => { ... })();` IIFE or inline `const _sgUcMsg = ...` block
    const extractMsgBlock = (needle) => {
      const anchor = contentJs.indexOf(needle);
      assert.ok(anchor > 0, `Missing needle: ${needle}`);
      const constIdx = contentJs.lastIndexOf("const _sgUcMsg =", anchor);
      const iifeIdx = contentJs.lastIndexOf("(() => {", anchor);
      if (constIdx > iifeIdx) {
        const endMarker = "chrome.runtime.onMessage.addListener(_sgUcMsg);";
        const endIdx = contentJs.indexOf(endMarker, anchor);
        assert.ok(endIdx > anchor, `Missing endMarker for ${needle}`);
        const closeBrace = contentJs.indexOf("}", endIdx + endMarker.length);
        assert.ok(closeBrace > endIdx);
        return contentJs.slice(constIdx, closeBrace + 1);
      }
      const start = iifeIdx;
      assert.ok(start >= 0, `Missing enclosing IIFE for ${needle}`);
      let depth = 0, inStr = null;
      for (let i = start; i < contentJs.length; i++) {
        const ch = contentJs[i];
        if (inStr) { if (ch === "\\") { i++; continue; } if (ch === inStr) inStr = null; continue; }
        if (ch === '"' || ch === "'" || ch === "`") { inStr = ch; continue; }
        if (ch === "(") depth++;
        else if (ch === ")") {
          depth--;
          if (depth === 0) {
            const rest = contentJs.slice(i + 1);
            const m = rest.match(/^\s*\(\s*\)\s*;?/);
            assert.ok(m, `Expected trailing IIFE invocation after ${needle}`);
            return contentJs.slice(start, i + 1 + m[0].length);
          }
        }
      }
      throw new Error(`Unclosed IIFE for ${needle}`);
    };

    const codeR4 = [
      coreJs,
      runtimeBusJs,
      extractMsgBlock('if ("ENABLE_TRASHCAN" === e.type)'),
      extractMsgBlock('"SHOW_DAILY_COUNTER" === e.type'),
      extractMsgBlock('"FETCH_CHAT_VIA_RPC" === e.type'),
      extractMsgBlock('"ENABLE_COLLAPSIBLE_PINNED" === e.type'),
      extractMsgBlock('"ENABLE_DRAG_CHAT_INPUT" === e.type'),
      extractMsgBlock('"ENABLE_AI_STUDIO_OPTIMIZE" === e.type')
    ].join("\n");
    vm.runInContext(codeR4, r4Ctx);
    assert.strictEqual(nativeMsgListeners.length, 1, "All 6 legacy handlers must route through strictly 1 native runtime.onMessage bus");
    const bus = nativeMsgListeners[0];
    assert.strictEqual(bus({ type: "ENABLE_TRASHCAN" }, {}, () => {}), false);
    assert.strictEqual(bus({ type: "SHOW_DAILY_COUNTER" }, {}, () => {}), false);
    assert.strictEqual(bus({ type: "ENABLE_COLLAPSIBLE_PINNED" }, {}, () => {}), false);
    assert.strictEqual(bus({ type: "ENABLE_DRAG_CHAT_INPUT" }, {}, () => {}), false);
    assert.strictEqual(bus({ type: "ENABLE_AI_STUDIO_OPTIMIZE" }, {}, () => {}), false);
    assert.strictEqual(bus({ type: "SHOW_TOAST", message: "ok" }, {}, () => {}), false);
    assert.strictEqual(bus({ type: "FETCH_CHAT_VIA_RPC", chatId: "abc" }, {}, () => {}), true);
    console.log("PASS [R4]: Unified SG.messages bus binds 1 native listener and returns strict synchronous booleans (!1 vs !0)");
  }

  // =========================================================================
  // [R5] Master toggle sync (spoof_injector + popup), Scrape URL allowlist, baseline.json & Copy preserved
  // =========================================================================
  {
    // spoof_injector stand-down when localStorage.sg_ext_enabled === "0"
    let moCount = 0, ivCount = 0;
    const origClick = () => "orig";
    function FakeInput() { this.type = "file"; }
    FakeInput.prototype.click = origClick;
    function FakeIframe() {}
    Object.defineProperty(FakeIframe.prototype, "contentWindow", { get() { return null; }, configurable: true });
    function FakeMsgEv() {}
    Object.defineProperty(FakeMsgEv.prototype, "source", { get() { return null; }, configurable: true });
    const winListeners = {};
    const spoofCtx = vm.createContext({
      window: {
        location: { hash: "" },
        addEventListener: (t, fn, cap) => { (winListeners[t] = winListeners[t] || []).push(fn); },
        dispatchEvent: () => true
      },
      document: { documentElement: { appendChild() {}, getAttribute: () => "1" }, body: null },
      localStorage: { getItem: (k) => (k === "sg_ext_enabled" ? "0" : k === "sg_last_theme" ? "dark" : "1") },
      MutationObserver: class { observe() { moCount++; } disconnect() {} },
      setInterval: () => { ivCount++; return 1; },
      clearInterval() {},
      setTimeout: () => 1,
      clearTimeout() {},
      HTMLInputElement: FakeInput,
      HTMLIFrameElement: FakeIframe,
      MessageEvent: FakeMsgEv,
      CustomEvent: class { constructor(t, o) { this.type = t; } },
      WIZ_global_data: { SNlM0e: "a", FdrFJe: "b", cfb2h: "c" }
    });
    vm.runInContext(spoofJs, spoofCtx);
    assert.strictEqual(moCount, 0, "spoof_injector must create 0 MutationObservers when sg_ext_enabled=0");
    assert.strictEqual(ivCount, 0, "spoof_injector must create 0 setIntervals when sg_ext_enabled=0");
    assert.strictEqual(FakeInput.prototype.click, origClick, "spoof_injector must NOT hook file input click when sg_ext_enabled=0");
    const kev = { key: "k", code: "KeyK", ctrlKey: true, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, stopPropagation() {} };
    (winListeners.keydown || []).forEach(fn => fn(kev));
    assert.strictEqual(kev.defaultPrevented, false, "Ctrl+K must NOT be intercepted when sg_ext_enabled=0");

    // Scrape URL validation in background.js
    let tabsCreated = 0;
    const scrapeCode = [
      extractFn(backgroundJs, "function isAllowedGeminiTabUrl("),
      extractFn(backgroundJs, "async function handleScrapeChatContent("),
      extractFn(backgroundJs, "async function handleScrapeChatBatch(")
    ].join("\n\n");
    const scrapeCtx = vm.createContext({
      _batchScrapeAborted: false,
      tryFetchChatViaRpc: async () => null,
      chrome: {
        tabs: { create: async () => { tabsCreated++; return { id: 99 }; }, sendMessage: async () => {} },
        scripting: { executeScript: async () => [] }
      },
      sgTrackTempTab: async () => {},
      sgUntrackTempTab: async () => {},
      sgDrainTrackedTempTabs: async () => [],
      console: { error() {}, log() {}, warn() {} }
    });
    vm.runInContext(scrapeCode, scrapeCtx);
    const badRes1 = await scrapeCtx.handleScrapeChatContent({ chatUrl: "https://evil.example/phish", chatId: "1", chatTitle: "T" }, { tab: { id: 1 } });
    assert.strictEqual(badRes1.success, false);
    assert.ok(/Invalid Gemini chat URL/i.test(badRes1.error));
    const badRes2 = await scrapeCtx.handleScrapeChatBatch({ chats: [{ chatUrl: "javascript:alert(1)", chatId: "2", chatTitle: "T2" }] }, { tab: { id: 1 } });
    assert.strictEqual(badRes2.results[0].success, false);
    assert.strictEqual(tabsCreated, 0, "Invalid chatUrl must NEVER call chrome.tabs.create");

    // baseline.json & popup.html tooltip (verified against repo baseline schema)
    const baseline = JSON.parse(fs.readFileSync(path.join(ROOT, "skills/baseline.json"), "utf8"));
    assert.ok(typeof baseline.bundleVersion === "string" && baseline.bundleVersion.trim().length > 0, "baseline.bundleVersion must be a non-empty string");
    assert.ok(Array.isArray(baseline.instructions) && baseline.instructions.length >= 7, "baseline.json must contain >= 7 instructions");
    const ids = baseline.instructions.map(x => x.id);
    assert.strictEqual(new Set(ids).size, ids.length, "All baseline instruction IDs must be strictly unique");
    const aliasRule = baseline.instructions.find(x => x.id === "command-aliases");
    const capRule = baseline.instructions.find(x => x.id === "extension-capabilities-guide");
    const circuitRule = baseline.instructions.find(x => x.id === "circuit-schematic-rendering-guide");
    assert.ok(aliasRule && aliasRule.text.includes("/an/"));
    assert.ok(capRule, "extension-capabilities-guide must exist");
    assert.strictEqual(capRule.version, 5);
    assert.ok(
      capRule.text.includes("mermaid") &&
      capRule.text.includes("wavedrom") &&
      capRule.text.includes("Selective Export") &&
      capRule.text.includes("Multi-Agent Orchestrator") &&
      capRule.text.includes("Command Palette")
    );
    assert.strictEqual(capRule.text.includes("r_h/r_v") || capRule.text.includes("nmos/pmos"), false, "extension-capabilities-guide must not retain circuit rules");
    assert.ok(circuitRule, "circuit-schematic-rendering-guide must exist");
    assert.strictEqual(circuitRule.version, 1);
    assert.ok(
      circuitRule.text.includes("WaveDrom") &&
      circuitRule.text.includes("NetlistSVG") &&
      circuitRule.text.includes("r_h/r_v") &&
      circuitRule.text.includes("nmos/pmos") &&
      circuitRule.text.includes("20px grid") &&
      circuitRule.text.includes('stroke="currentColor"')
    );
    assert.ok(popupHtml.includes("NetlistSVG circuit diagrams"), "popup.html Diagram Renderer tooltip must list NetlistSVG");
    assert.ok(popupJs.includes("SG_SYNC_MASTER_STATE"), "popup.js must sync master state before reloading tabs");

    console.log("PASS [R5]: Master toggle stand-down, Scrape URL allowlist, baseline.json unique schema + split circuit guide, and popup tooltip verified");
  }

  console.log("\nALL AUDIT REGRESSION TESTS PASSED!");
})().catch((err) => {
  console.error("TEST FAILED:", err);
  process.exit(1);
});
