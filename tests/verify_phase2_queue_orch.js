const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const { ROOT, loadCombinedContentJs } = require("./load-content");
const contentJs = loadCombinedContentJs();
const contentCss = fs.readFileSync(path.join(ROOT, "content.css"), "utf8");

// Check balanced braces in content.css
{
  let depth = 0;
  for (const ch of contentCss) {
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    assert.ok(depth >= 0, "Unbalanced closing brace in content.css");
  }
  assert.strictEqual(depth, 0, "Unbalanced braces in content.css");
  assert.ok(contentCss.includes(".sg-queue-route-bar"), "Missing P3 .sg-queue-route-bar CSS");
  assert.ok(contentCss.includes(".sg-orch-review-task"), "Missing P4 .sg-orch-review-task CSS");
}

// Extract P3 Queue slice (resolveQueueModeBadge .. before handleQueueDomChanges)
const qStart = contentJs.indexOf("function resolveQueueModeBadge(");
const qEnd = contentJs.indexOf("function handleQueueDomChanges(");
assert.ok(qStart > 0 && qEnd > qStart, "Could not locate Queue slice");
const qSlice = contentJs.slice(qStart, qEnd);

// Verify updateQueueDisplay + Queue helpers have zero innerHTML sinks
const updStart = qSlice.indexOf("function sgNormalizeQueueItem(");
const updEnd = qSlice.indexOf("function enableQueueInputListener(");
const updSlice = qSlice.slice(updStart, updEnd);
assert.ok(!/\.(?:innerHTML|outerHTML|insertAdjacentHTML)\b|document\.write\s*\(/i.test(updSlice), "Queue routing UI must have ZERO HTML sinks");

// Extract P4 Orchestrator slice (const SG_ORCHESTRATOR_CONFIG_KEY .. end of sgSetOrchestratorEnabled)
const oStart = contentJs.indexOf("const SG_ORCHESTRATOR_CONFIG_KEY =");
const oEndMarker = contentJs.indexOf("function sgSetOrchestratorEnabled(");
const oEnd = contentJs.indexOf("\nfunction ", oEndMarker + 35);
assert.ok(oStart > 0 && oEnd > oStart, "Could not locate Orchestrator slice");
const oSlice = contentJs.slice(oStart, oEnd);
assert.ok(!/\.(?:innerHTML|outerHTML|insertAdjacentHTML)\b|document\.write\s*\(/i.test(oSlice), "Orchestrator must have ZERO HTML sinks");

class MiniEl {
  constructor(tag) {
    this.tagName = String(tag || "div").toUpperCase();
    this.id = "";
    this.className = "";
    this.type = "";
    this.value = "";
    this.checked = false;
    this.disabled = false;
    this.selected = false;
    this.rows = 3;
    this.title = "";
    this.attrs = new Map();
    this.dataset = {};
    this.style = { display: "none" };
    this.children = [];
    this.parentNode = null;
    this.isConnected = false;
    this.listeners = new Map();
    this._text = "";
    const self = this;
    this.classList = {
      add(...cs) { const s = new Set(self.className.split(/\s+/).filter(Boolean)); cs.forEach(c => s.add(c)); self.className = [...s].join(" "); },
      remove(...cs) { const s = new Set(self.className.split(/\s+/).filter(Boolean)); cs.forEach(c => s.delete(c)); self.className = [...s].join(" "); },
      toggle(c, force) { const has = this.contains(c); const next = force === undefined ? !has : Boolean(force); next ? this.add(c) : this.remove(c); return next; },
      contains(c) { return self.className.split(/\s+/).includes(c); }
    };
  }
  get textContent() {
    if (this.children.length === 0) return this._text;
    return this._text + this.children.map(c => c.textContent || "").join("");
  }
  set textContent(v) {
    this._text = String(v == null ? "" : v);
    this.children.length = 0;
  }
  get firstChild() { return this.children[0] || null; }
  get innerHTML() { return this.children.map(c => `<${c.tagName.toLowerCase()}>${c.textContent}</${c.tagName.toLowerCase()}>`).join(""); }
  set innerHTML(v) { this.children.length = 0; this._text = ""; this._rawHtml = String(v || ""); }
  setAttribute(k, v) {
    this.attrs.set(k, String(v));
    if (k === "id") this.id = String(v);
    if (k === "class") this.className = String(v);
    if (k.startsWith("data-")) {
      const camel = k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      this.dataset[camel] = String(v);
    }
  }
  getAttribute(k) {
    if (k === "id" && this.id) return this.id;
    if (k === "class" && this.className) return this.className;
    return this.attrs.has(k) ? this.attrs.get(k) : null;
  }
  appendChild(ch) {
    if (!ch) return ch;
    ch.parentNode = this;
    this.children.push(ch);
    const setC = (n, v) => { n.isConnected = v; for (const c of n.children || []) setC(c, v); };
    setC(ch, this.isConnected);
    if (this.tagName === "SELECT" && ch.tagName === "OPTION" && ch.selected) {
      this.value = ch.value;
    }
    return ch;
  }
  removeChild(ch) {
    const i = this.children.indexOf(ch);
    if (i >= 0) { this.children.splice(i, 1); ch.parentNode = null; ch.isConnected = false; }
    return ch;
  }
  replaceChildren(...nodes) {
    for (const c of this.children) { c.parentNode = null; c.isConnected = false; }
    this.children.length = 0;
    this._text = "";
    for (const n of nodes) if (n) this.appendChild(n);
  }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  addEventListener(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(fn);
  }
  removeEventListener(type, fn) {
    const arr = this.listeners.get(type);
    if (arr) { const i = arr.indexOf(fn); if (i >= 0) arr.splice(i, 1); }
  }
  dispatchEvent(ev) {
    const e = Object.assign({ preventDefault() {}, stopPropagation() {}, stopImmediatePropagation() {} }, ev, { target: this });
    for (const fn of (this.listeners.get(e.type) || []).slice()) fn(e);
    return true;
  }
  click() {
    if (this.disabled) return;
    if (this.tagName === "INPUT" && this.type === "checkbox") {
      this.checked = !this.checked;
      this.dispatchEvent({ type: "change" });
    } else {
      this.dispatchEvent({ type: "click" });
    }
  }
  focus() {}
  getBoundingClientRect() { return { left: 100, top: 600, width: 80, height: 32 }; }
  matches(sel) {
    return sel.split(",").map(s => s.trim()).some(p => {
      if (!p) return false;
      if (p.startsWith("#")) return this.id === p.slice(1);
      if (p.startsWith(".")) return this.classList.contains(p.slice(1));
      if (p === '[fonticon="stop"]') return this.getAttribute("fonticon") === "stop";
      return this.tagName === p.toUpperCase();
    });
  }
  closest(sel) { let c = this; while (c) { if (c.matches(sel)) return c; c = c.parentNode; } return null; }
  querySelectorAll(sel) {
    const out = [];
    const walk = (n) => {
      for (const c of n.children || []) {
        if (c.matches && c.matches(sel)) out.push(c);
        walk(c);
      }
    };
    walk(this);
    return out;
  }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
}

// =========================================================================
// [Q1]: P3 Per-Task Routing in Message Queue
// =========================================================================
{
  const qBody = new MiniEl("body");
  qBody.isConnected = true;

  const queueDisp = new MiniEl("div");
  queueDisp.id = "sg-queue-display";
  const queueList = new MiniEl("div");
  queueList.id = "sg-queue-list";
  queueDisp.appendChild(queueList);
  qBody.appendChild(queueDisp);

  const composerDiv = new MiniEl("div");
  composerDiv.className = "ql-editor";
  const sendBtnEl = new MiniEl("button");
  sendBtnEl.className = "send-button";

  const periodicCalls = [];
  const fallbackModeCalls = [];
  const fallbackThinkCalls = [];
  const releasedElems = [
    { symbol: "H", name: "Hydrogen", modelLabel: "H · 4 Hydrogen", realMode: "fast", released: true, locked: false },
    { symbol: "Ne", name: "Neon", modelLabel: "Ne · 4 Neon", realMode: "thinking", released: true, locked: false },
    { symbol: "C", name: "Carbon", modelLabel: "C · 4 Carbon", realMode: "pro", released: true, locked: false },
    { symbol: "Cd", name: "Cadmium", modelLabel: "Cd · Cadmium", realMode: null, released: false, locked: true }
  ];

  let qSaves = 0;
  let sendClickedPrompt = "";

  sendBtnEl.addEventListener("click", () => {
    sendClickedPrompt = composerDiv.children.map(p => p.textContent).join("\n");
    // Simulate generation starting after send
    const stopEl = new MiniEl("mat-icon");
    stopEl.setAttribute("fonticon", "stop");
    qBody.appendChild(stopEl);
  });

  const qCtx = vm.createContext({
    document: {
      body: qBody,
      createElement: tag => new MiniEl(tag),
      createTextNode: txt => { const sp = new MiniEl("span"); sp.textContent = txt; return sp; },
      querySelector: sel => {
        if (sel === "#composer") return composerDiv;
        if (sel === "#sendbtn") return sendBtnEl;
        return qBody.querySelector(sel);
      },
      querySelectorAll: sel => qBody.querySelectorAll(sel)
    },
    Event: class Event { constructor(t, opts) { this.type = t; this.bubbles = Boolean(opts && opts.bubbles); } },
    QUEUE_INPUT_SELECTOR: "#composer",
    QUEUE_SEND_BUTTON_SELECTOR: "#sendbtn",
    queueDisplayElement: queueDisp,
    messageQueue: [],
    isQueueingEnabled: true,
    isQueueDisplayVisible: true,
    isCurrentlyGenerating: false,
    isSendingFromQueue: false,
    slashMenuVisible: false,
    sgSkillMenuVisible: false,
    lastQueueChatId: "chat_1",
    getCurrentChatId: () => "chat_1",
    getCurrentMode: () => "fast",
    getCurrentThinkingLevel: () => "low",
    extractInputText: el => el.textContent || el.value || "",
    triggerWordCounterUpdate() {},
    isDarkTheme: () => true,
    saveQueueToStorage: () => { qSaves++; },
    createQueueDisplay: () => {},
    deleteMessageFromQueue(i) { qCtx.messageQueue.splice(i, 1); qCtx.saveQueueToStorage(); qCtx.updateQueueDisplay(); },
    sgBuildQueueIcon: (kind, sz) => { const m = new MiniEl("mat-icon"); m.setAttribute("data-kind", kind); return m; },
    sgPeriodicGetAllReleasedElements: () => releasedElems.filter(e => e.released),
    sgPeriodicGetElement: sym => releasedElems.find(e => e.symbol === sym) || null,
    sgPeriodicGetThinkingLevels: sym => sym === "Ne"
      ? [{ value: "low", label: "Low" }, { value: "medium", label: "Medium" }, { value: "high", label: "High" }]
      : [{ value: "low", label: "Low" }, { value: "high", label: "High" }],
    sgPeriodicReadState: () => ({ selectedType: "element", symbol: "H", released: true }),
    sgPeriodicSelectElement: (el, lvl) => periodicCalls.push({ symbol: el.symbol, thinkingLevel: lvl }),
    sgGetPeriodicBlockedElement: () => null,
    switchMode: m => fallbackModeCalls.push(m),
    setThinkingLevel: async l => fallbackThinkCalls.push(l),
    sgEffectiveSkills: [
      { id: "acknowledgment", name: "Ack", enabled: true, aliases: ["/ac/"] },
      { id: "orchestrate-mode", name: "Orch", enabled: true, aliases: ["/oc/"] },
      { id: "plan-mode", name: "Plan Mode", enabled: true, aliases: ["/pl/", "/plan/"] },
      { id: "review-mode", name: "Review Mode", enabled: true, aliases: ["/rv/", "/review/"] },
      { id: "no-code-mode", name: "No-Code Mode", enabled: true, aliases: ["/nc/", "/no code/"] }
    ],
    sgIsImeComposing: () => false,
    setTimeout, clearTimeout,
    Set, Map, Array, Object, String, Boolean, RegExp, Promise, Math, console
  });

  vm.runInContext(qSlice, qCtx);

  // Normalize legacy string & object queue entries
  assert.deepStrictEqual(
    JSON.parse(JSON.stringify(qCtx.sgNormalizeQueueItem("legacy plain task"))),
    { text: "legacy plain task", mode: null, periodicSymbol: null, thinkingLevel: null, skills: [] }
  );

  // Dispatch prompt avoids duplicating @id or /alias/
  assert.strictEqual(
    qCtx.sgBuildQueueDispatchPrompt("Design architecture", ["plan-mode", "no-code-mode"]),
    "@plan-mode @no-code-mode Design architecture"
  );
  assert.strictEqual(
    qCtx.sgBuildQueueDispatchPrompt("/pl/ Design architecture @no-code-mode", ["plan-mode", "no-code-mode"]),
    "/pl/ Design architecture @no-code-mode"
  );

  // Enqueue two tasks
  qCtx.tryEnqueueMessage("First task");
  qCtx.tryEnqueueMessage({ text: "Second task", mode: "fast", periodicSymbol: "H", thinkingLevel: "low", skills: [] });
  assert.strictEqual(qCtx.messageQueue.length, 2);

  // Check UI rendered 2 cards without innerHTML
  const cards = queueList.querySelectorAll(".sg-queue-item-card");
  assert.strictEqual(cards.length, 2, "Must render 2 queue cards");
  assert.ok(cards[0].classList.contains("sg-queue-item-next"), "First card must have .sg-queue-item-next");

  // Reorder: move #2 up via ↑ button
  const secondControls = cards[1].querySelectorAll(".sg-queue-action-btn");
  const moveUpBtn = secondControls.find(b => b.textContent === "↑");
  assert.ok(moveUpBtn, "Move up button must exist on 2nd card");
  moveUpBtn.click();
  assert.strictEqual(qCtx.messageQueue[0].text, "Second task", "↑ must move 2nd item to index 0");

  // Route first item in UI to 4 Neon (Ne), High thinking, and attach plan-mode + no-code-mode
  let updatedCards = queueList.querySelectorAll(".sg-queue-item-card");
  const selects = updatedCards[0].querySelectorAll("select");
  assert.strictEqual(selects.length, 3, "Must render Model, Thinking, and + Skill selects");
  selects[0].value = "periodic:Ne";
  selects[0].dispatchEvent({ type: "change" });
  updatedCards = queueList.querySelectorAll(".sg-queue-item-card");
  const sAfterModel = updatedCards[0].querySelectorAll("select");
  sAfterModel[1].value = "high";
  sAfterModel[1].dispatchEvent({ type: "change" });
  updatedCards = queueList.querySelectorAll(".sg-queue-item-card");
  updatedCards[0].querySelectorAll("select")[2].value = "plan-mode";
  updatedCards[0].querySelectorAll("select")[2].dispatchEvent({ type: "change" });
  updatedCards = queueList.querySelectorAll(".sg-queue-item-card");
  updatedCards[0].querySelectorAll("select")[2].value = "no-code-mode";
  updatedCards[0].querySelectorAll("select")[2].dispatchEvent({ type: "change" });

  assert.strictEqual(qCtx.messageQueue[0].periodicSymbol, "Ne");
  assert.strictEqual(qCtx.messageQueue[0].thinkingLevel, "high");
  assert.deepStrictEqual([...qCtx.messageQueue[0].skills], ["plan-mode", "no-code-mode"]);

  // Verify skill chip removal works
  const chips = queueList.querySelectorAll(".sg-queue-item-card")[0].querySelectorAll(".sg-queue-skill-chip");
  assert.strictEqual(chips.length, 2);

  // Dispatch first item (Periodic Symbol Ne + High + 2 skills)
  Promise.resolve().then(async () => {
    await qCtx.sendNextQueuedMessage();
    await new Promise(r => setTimeout(r, 700));
    assert.strictEqual(periodicCalls.length, 1, "Must call sgPeriodicSelectElement when periodicSymbol is set");
    assert.deepStrictEqual(periodicCalls[0], { symbol: "Ne", thinkingLevel: "high" });
    assert.strictEqual(sendClickedPrompt, "@plan-mode @no-code-mode Second task", "Dispatched prompt must include attached skills");

    // Stop icon from 1st send -> clear it and verify fallback mode dispatch on 2nd item
    qBody.querySelectorAll('[fonticon="stop"]').forEach(n => n.remove());
    qCtx.isCurrentlyGenerating = false;
    qCtx.isSendingFromQueue = false;
    qCtx.updateQueueItemRoute(0, { periodicSymbol: null, mode: "pro", thinkingLevel: "extended" });
    await qCtx.sendNextQueuedMessage();
    await new Promise(r => setTimeout(r, 700));
    assert.deepStrictEqual(fallbackModeCalls, ["pro"], "Fallback mode switch must run when periodicSymbol is null");
    assert.deepStrictEqual(fallbackThinkCalls, ["extended"], "Fallback thinking switch must run");

    console.log("PASS [Q1]: P3 Queue normalization, reorder, Periodic + fallback routing, multi-skill attach & dispatch");

    // =========================================================================
    // [Q2] & [Q3]: P4 Multi-Skill/Modifier Chaining & Interactive Plan Review
    // =========================================================================
    const oBody = new MiniEl("body");
    oBody.isConnected = true;
    const composer = new MiniEl("div");
    composer.className = "ql-editor";
    oBody.appendChild(composer);

    let dispatchedWorkerTasks = null;
    let submittedMainCount = 0;

    const p4Skills = [
      { id: "orchestrate-mode", name: "Orchestrate Mode", mode: "both", enabled: true, version: 1, hash: "h_o", aliases: ["/oc/"], instructions: "Orch body", description: "Coordinate" },
      { id: "acknowledgment", name: "Ack", mode: "bootstrap", enabled: true, version: 1, hash: "h_a", aliases: ["/ac/"], instructions: "Ack body", description: "Ack" },
      { id: "analyze-mode", name: "Analyze Mode", mode: "both", enabled: true, version: 1, hash: "h_an", aliases: ["/an/", "/analyze/"], instructions: "Analyze root principles objectively.", description: "Examine mechanisms" },
      { id: "review-mode", name: "Review Mode", mode: "both", enabled: true, version: 1, hash: "h_rv", aliases: ["/rv/", "/review/"], instructions: "Audit logic and memory safety.", description: "Critique implementation" },
      { id: "no-code-mode", name: "No-Code Mode", mode: "both", enabled: true, version: 1, hash: "h_nc", aliases: ["/nc/", "/no code/"], instructions: "Suppress all code blocks unconditionally.", description: "No-code constraint" }
    ];

    const oCtx = vm.createContext({
      document: {
        body: oBody,
        activeElement: oBody,
        createElement: tag => new MiniEl(tag),
        createElementNS: (_ns, tag) => new MiniEl(tag),
        getElementById: id => oBody.querySelector("#" + id),
        querySelector: sel => oBody.querySelector(sel),
        querySelectorAll: sel => oBody.querySelectorAll(sel)
      },
      window: { innerWidth: 1280, innerHeight: 800, location: { pathname: "/app/testchat", hash: "" } },
      chrome: {
        runtime: {
          sendMessage: async (msg) => {
            if (msg.type === "ORCHESTRATOR_PREWARM_POOL") return { ok: true };
            if (msg.type === "ORCHESTRATOR_RUN_SUBAGENTS") {
              if (msg.tasks && msg.tasks[0] && msg.tasks[0].id === "__planner__") {
                return {
                  results: [{
                    success: true,
                    output: [
                      "<<<SG_PLAN_SUMMARY>>>",
                      "Split architecture analysis and audit.",
                      "<<<SG_PLAN_SUMMARY_END>>>",
                      "<<<SG_AGENT_START>>>",
                      "ID: agent_1",
                      "ROLE: Architecture Analyst",
                      "MODEL: hydrogen",
                      "THINKING: low",
                      "SKILL: analyze-mode + no-code-mode",
                      "TASK:",
                      "- Objective: Analyze Vulkan sync barriers without code.",
                      "<<<SG_AGENT_END>>>",
                      "<<<SG_AGENT_START>>>",
                      "ID: agent_2",
                      "ROLE: Safety Reviewer",
                      "MODEL: hydrogen",
                      "THINKING: low",
                      "SKILL: /rv/nc/",
                      "TASK:",
                      "- Objective: Review concurrency hazards.",
                      "<<<SG_AGENT_END>>>"
                    ].join("\n")
                  }]
                };
              }
              dispatchedWorkerTasks = msg.tasks;
              return {
                results: msg.tasks.map(t => ({ id: t.id, success: true, model: t.model, output: `Output for ${t.id}`, workerSlot: 1 }))
              };
            }
            return { ok: true };
          }
        },
        storage: { sync: { get: (_k, cb) => cb({}), onChanged: { addListener() {} } } }
      },
      localStorage: new Map(),
      SG_IS_SILENT_BG_WORKER_TAB: false,
      isExtensionEnabled: true,
      isOrchestratorEnabled: true,
      SG_ORCH_MAX_SUBAGENTS_CAP: 4,
      SG_ORCH_DEFAULT_MAX_SUBAGENTS: 3,
      SG_ORCH_SVG_NS: "http://www.w3.org/2000/svg",
      _sgOrchChatLoadedHashes: new Map(),
      sgSkillMigrationLedger: {},
      loadEffectiveSkills: async () => ({ skills: p4Skills }),
      sgPeriodicLoadCatalog: () => ({
        scanned: true,
        elements: { H: { locked: false }, Ne: { locked: false }, C: { locked: true } }
      }),
      sgOrchSubmitAndWaitMainTab: async (_run, promptText) => {
        submittedMainCount++;
        return `Final synthesis (${submittedMainCount}): ok`;
      },
      getConversationContext: () => null,
      sgIsVietnameseGeminiUI: () => false,
      showToast() {},
      setInterval: fn => { oCtx._lastTimerFn = fn; return 42; },
      clearInterval() {},
      setTimeout, clearTimeout,
      Map, Set, Array, Object, String, Number, Boolean, Math, RegExp, JSON, Promise, console
    });
    oCtx.localStorage.getItem = k => oCtx.localStorage.has(k) ? oCtx.localStorage.get(k) : null;
    oCtx.localStorage.setItem = (k, v) => oCtx.localStorage.set(k, String(v));

    // Patch global vars declared before SG_ORCHESTRATOR_CONFIG_KEY
    const helperHeader = `
      let _sgOrchestratorConfig = null;
      let _sgOrchestratorScope = null;
      let _sgOrchestratorActiveRun = null;
      let _sgOrchCardEl = null;
      let _sgOrchCardMinimized = false;
      let _sgOrchConfigPopoverEl = null;
      let _sgOrchConfigPrevFocusEl = null;
      let _sgOrchestrateBtnEl = null;
      let _sgOrchBypassSendIntercept = false;
      function sgSyncOrchestrateButtonVisualState() {}
      function sgInjectOrchestrateButton() {}
      function sgCloseOrchestratorConfigPopover() {}
    `;
    const oStartBody = contentJs.indexOf("function sgOrchGetAccountScope(");
    const oSliceExec = helperHeader + "\n" + contentJs.slice(oStartBody, oEnd);
    assert.ok(!/\.(?:innerHTML|outerHTML|insertAdjacentHTML)\b|document\.write\s*\(/i.test(oSliceExec));
    vm.runInContext(oSliceExec, oCtx);
    oCtx.sgOrchSubmitAndWaitMainTab = async (_run, _promptText) => {
      submittedMainCount++;
      return `Final synthesis (${submittedMainCount}): ok`;
    };

    // [Q2]: Primary Catalog keeps no-code-mode out of generic list, readiness tracks constraintModifiers, chaining works!
    assert.strictEqual(oCtx.sgOrchDefaultConfig().reviewPlan, false, "reviewPlan must default to false");
    const readiness = oCtx.sgOrchResolveSkillReadiness(p4Skills, { mode: "in_chat" }, {});
    assert.strictEqual(readiness.allEligibleSkills.some(s => s.id === "no-code-mode"), false, "no-code-mode stays separated from specialist catalog");
    assert.strictEqual(readiness.constraintModifiers.some(s => s.id === "no-code-mode"), true, "constraintModifiers exposes no-code-mode");

    const promptFromStandalone = oCtx.sgBuildOrchestratorPlannerPrompt("Design allocator", { mode: "in_chat", maxAgents: 2, modelPolicy: "quota_saver" }, p4Skills, null, readiness);
    assert.strictEqual(promptFromStandalone.includes("no-code-mode:"), false, "Planner catalog must never emit '- no-code-mode:'");
    assert.ok(promptFromStandalone.includes("analyze-mode + no-code-mode"), "Planner rule 6 teaches '+' chaining");

    const chained1 = oCtx.sgOrchMatchSkillsForTask("analyze-mode + no-code-mode", "", p4Skills).map(s => s.id);
    const chained2 = oCtx.sgOrchMatchSkillsForTask("/rv/nc/", "", p4Skills).map(s => s.id);
    assert.deepStrictEqual([...chained1], ["analyze-mode", "no-code-mode"]);
    assert.deepStrictEqual([...chained2], ["review-mode", "no-code-mode"]);

    const parsedPlan = oCtx.sgParseOrchestratorPlan(
      "<<<SG_AGENT_START>>>\nID: agent_1\nROLE: Architect\nSKILL: analyze-mode + no-code-mode\nTASK:\nExplain allocator.\n<<<SG_AGENT_END>>>",
      "Explain allocator",
      { mode: "in_chat", maxAgents: 2, modelPolicy: "quota_saver" },
      p4Skills
    );
    assert.deepStrictEqual([...parsedPlan.tasks[0].skillIds], ["analyze-mode", "no-code-mode"]);
    assert.strictEqual(parsedPlan.tasks[0].skillId, "analyze-mode");
    assert.ok(parsedPlan.tasks[0].prompt.includes("LEFT-TO-RIGHT PRECEDENCE: @analyze-mode -> @no-code-mode"));
    assert.ok(parsedPlan.tasks[0].prompt.includes('<skill id="analyze-mode"'));
    assert.ok(parsedPlan.tasks[0].prompt.includes('<skill id="no-code-mode"'));
    console.log("PASS [Q2]: P4 Multi-Skill/Modifier chaining (left-to-right + & /an/nc/), separate constraintModifiers, clean prompt precedence");

    // [Q3]: Interactive Plan Review (reviewPlan: true)
    const runPromise = oCtx.sgStartOrchestration("Build lock-free ring buffer", { mode: "clean_1turn", maxAgents: 2, modelPolicy: "quota_saver", reviewPlan: true });
    // Wait until phase enters "reviewing"
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 15));
      if (oBody.querySelector(".sg-orch-review-run-btn")) break;
    }
    const card = oBody.querySelector("#sg-orchestrator-card");
    assert.ok(card, "Orchestrator card must mount");
    const taskInputs = card.querySelectorAll(".sg-orch-review-task");
    assert.strictEqual(taskInputs.length, 2, "Review UI must show 2 editable task textareas");

    // Verify 1s timer tick during reviewing does NOT replace textarea node (preserves typing focus!)
    const firstTextareaRef = taskInputs[0];
    oCtx._lastTimerFn();
    assert.strictEqual(card.querySelectorAll(".sg-orch-review-task")[0], firstTextareaRef, "Timer tick during review must NOT destroy focused textarea");

    // Edit agent_1: change model -> neon, thinking -> high, task text -> custom edited task; skip agent_2
    const rows = card.querySelectorAll(".sg-orch-agent-row");
    const a1Selects = rows[0].querySelectorAll(".sg-orch-review-select");
    a1Selects[0].value = "neon";
    a1Selects[0].dispatchEvent({ type: "change" });
    a1Selects[1].value = "high";
    a1Selects[1].dispatchEvent({ type: "change" });
    firstTextareaRef.value = "Edited task: Focus specifically on memory_order_acquire/release.";
    firstTextareaRef.dispatchEvent({ type: "input" });

    // Check locked Carbon option is disabled in Model select
    const carbonOpt = a1Selects[0].children.find(o => o.value === "carbon");
    assert.ok(carbonOpt && carbonOpt.disabled === true, "Locked 4 Carbon option must be disabled in Plan Review");

    // Skip agent_2 via enable checkbox
    const a2EnableCb = rows[1].querySelector(".sg-orch-review-enable");
    a2EnableCb.click();
    assert.ok(rows[1].classList.contains("is-disabled"), "Disabled row gets .is-disabled");
    const runWorkersBtn = card.querySelector(".sg-orch-review-run-btn");
    assert.strictEqual(runWorkersBtn.textContent, "Run Workers (1)", "Run button updates live to remaining active workers");

    // Click Run Workers (1)
    runWorkersBtn.click();
    const ok = await runPromise;
    assert.strictEqual(ok, true, "Orchestration must complete after clicking Run Workers");
    assert.strictEqual(dispatchedWorkerTasks.length, 1, "Only the 1 enabled sub-agent should dispatch");
    assert.strictEqual(dispatchedWorkerTasks[0].model, "neon", "Dispatched worker must use reviewed model 'neon'");
    assert.strictEqual(dispatchedWorkerTasks[0].thinkingLevel, "high", "Dispatched worker must use reviewed thinking 'high'");
    assert.ok(dispatchedWorkerTasks[0].prompt.includes("memory_order_acquire/release"), "Rebuilt prompt must reflect edited task");
    assert.ok(dispatchedWorkerTasks[0].prompt.includes("LEFT-TO-RIGHT PRECEDENCE: @analyze-mode -> @no-code-mode"), "Rebuilt prompt must preserve chained skills");

    // Verify Abort during review cancels cleanly
    const abortPromise = oCtx.sgStartOrchestration("Another task", { mode: "clean_1turn", maxAgents: 2, reviewPlan: true });
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 15));
      if (oBody.querySelector(".sg-orch-review-run-btn")) break;
    }
    oCtx.sgAbortActiveOrchestration("Aborted in review");
    const abortedRes = await abortPromise;
    assert.strictEqual(abortedRes, false, "Aborting during review must resolve false cleanly");

    console.log("PASS [Q3]: P4 Interactive Plan Review (pause gate, timer focus preservation, model lock check, skip agent, prompt rebuild, Abort)");
    console.log("\nALL PHASE 2 (P3 + P4) VERIFICATION TESTS PASSED!");
  }).catch(err => {
    console.error("PHASE 2 TEST FAILED:", err);
    process.exit(1);
  });
}
