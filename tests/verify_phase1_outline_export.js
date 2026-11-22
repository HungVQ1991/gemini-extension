const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const { ROOT, loadCombinedContentJs } = require("./load-content");
const contentJs = loadCombinedContentJs();
const contentCss = fs.readFileSync(path.join(ROOT, "content.css"), "utf8");

// Extract slices cleanly
const filterStart = contentJs.indexOf("function sgFilterMessagesForSelectiveExport(");
const filterEnd = contentJs.indexOf("async function getChatHistoryForExport(");
assert.ok(filterStart > 0 && filterEnd > filterStart, "Could not locate sgFilterMessagesForSelectiveExport");
const filterSlice = contentJs.slice(filterStart, filterEnd);

const outlineStart = contentJs.indexOf("const SG_OUTLINE_UI_STATE_KEY =");
const outlineEnd = contentJs.indexOf("function sgOpenForkHandoffModalFromResponse(");
assert.ok(outlineStart > 0 && outlineEnd > outlineStart, "Could not locate Outline & Selective Export slice");
const outlineSlice = contentJs.slice(outlineStart, outlineEnd);

// Also check zero HTML sinks in new slices
const selExpStart = outlineSlice.indexOf("function sgCloseSelectiveExportModal(");
const assetsStart = outlineSlice.indexOf("function sgSummarizeDiagramAssetLabel(");
const assetsEnd = outlineSlice.indexOf("function sgExtractCodeBlockLang(");
for (const [label, chunk] of [
  ["sgFilterMessagesForSelectiveExport", filterSlice],
  ["sgExtractTurnAssets", outlineSlice.slice(assetsStart, assetsEnd)],
  ["sgOpenSelectiveExportModal", outlineSlice.slice(selExpStart)]
]) {
  assert.ok(!/\.(?:innerHTML|outerHTML|insertAdjacentHTML)\b|document\.write\s*\(/i.test(chunk), `Forbidden HTML sink in ${label}`);
}

// Verify CSS balanced braces and print hide rule
let depth = 0;
for (const ch of contentCss) {
  if (ch === "{") depth++;
  else if (ch === "}") depth--;
  assert.ok(depth >= 0, "Unbalanced closing brace in content.css");
}
assert.strictEqual(depth, 0, "Unbalanced braces in content.css");
assert.ok(contentCss.includes("#sg-selective-export-overlay"), "Missing #sg-selective-export-overlay CSS");

// Minimal DOM harness
class MiniEl {
  constructor(tag) {
    this.tagName = String(tag || "div").toUpperCase();
    this.nodeType = 1;
    this.id = "";
    this.className = "";
    this.attrs = new Map();
    this.dataset = {};
    this.style = {};
    this.children = [];
    this.childNodes = this.children;
    this.parentNode = null;
    this.parentElement = null;
    this.isConnected = false;
    this.listeners = new Map();
    this.checked = false;
    this.disabled = false;
    this.value = "";
    this.offsetWidth = 100;
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
    if (k.startsWith("data-")) {
      const camel = k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      if (Object.prototype.hasOwnProperty.call(this.dataset, camel)) return this.dataset[camel];
    }
    return this.attrs.has(k) ? this.attrs.get(k) : null;
  }
  appendChild(ch) {
    if (!ch) return ch;
    ch.parentNode = this;
    ch.parentElement = this;
    this.children.push(ch);
    const setC = (n, v) => { n.isConnected = v; for (const c of n.children || []) setC(c, v); };
    setC(ch, this.isConnected);
    return ch;
  }
  replaceChildren(...nodes) {
    for (const c of this.children) { c.parentNode = null; c.parentElement = null; }
    this.children.length = 0;
    for (const n of nodes) if (n) this.appendChild(n);
  }
  remove() {
    if (this.parentNode) {
      const i = this.parentNode.children.indexOf(this);
      if (i >= 0) this.parentNode.children.splice(i, 1);
      this.parentNode = null;
      this.parentElement = null;
      this.isConnected = false;
    }
  }
  addEventListener(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(fn);
  }
  dispatch(type, extra = {}) {
    const ev = Object.assign({ type, target: this, preventDefault() {}, stopPropagation() {} }, extra);
    for (const fn of (this.listeners.get(type) || []).slice()) fn(ev);
  }
  click() {
    if (this.disabled) return;
    if (this.tagName === "INPUT" && this.getAttribute("type") === "checkbox") {
      this.checked = !this.checked;
      this.dispatch("change");
    } else {
      this.dispatch("click");
    }
  }
  scrollIntoView() { this._scrolled = true; }
  contains(node) { let c = node; while (c) { if (c === this) return true; c = c.parentNode; } return false; }
  getBoundingClientRect() { return { top: 0, right: 1200, width: 1200, height: 40 }; }
  matches(sel) {
    return sel.split(",").map(s => s.trim()).some(p => {
      if (!p) return false;
      if (p.startsWith("#")) return this.id === p.slice(1);
      if (p.startsWith(".")) return this.classList.contains(p.slice(1));
      if (p === '[id^="sg-"]') return (this.id || "").startsWith("sg-");
      if (p === '[data-filename]') return this.getAttribute("data-filename") !== null;
      if (p === '[data-test-id="file-preview"]') return this.getAttribute("data-test-id") === "file-preview";
      if (p === '[data-test-id="uploaded-file"]') return this.getAttribute("data-test-id") === "uploaded-file";
      if (p === '[data-message-author="user"]') return this.getAttribute("data-message-author") === "user";
      if (p === '[data-message-author="model"]') return this.getAttribute("data-message-author") === "model";
      return this.tagName === p.toUpperCase();
    });
  }
  closest(sel) {
    let cur = this;
    while (cur) { if (cur.matches(sel)) return cur; cur = cur.parentNode; }
    return null;
  }
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

const body = new MiniEl("body");
body.isConnected = true;
const chatHistory = new MiniEl("div");
chatHistory.id = "chat-history";
body.appendChild(chatHistory);

const docListeners = new Map();
const doc = {
  body,
  documentElement: body,
  scrollingElement: chatHistory,
  createElement: tag => new MiniEl(tag),
  createElementNS: (_ns, tag) => new MiniEl(tag),
  getElementById: id => body.querySelector("#" + id),
  querySelector: sel => body.querySelector(sel),
  querySelectorAll: sel => body.querySelectorAll(sel),
  addEventListener: (t, fn) => { (docListeners.get(t) || docListeners.set(t, []).get(t)).push(fn); },
  removeEventListener: (t, fn) => { const a = docListeners.get(t); if (a) { const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); } }
};

function sgSkillEl(tag, props = {}, children = []) {
  const el = doc.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === undefined || v === null) continue;
    if (k === "className") el.className = v;
    else if (k === "textContent") el.textContent = v;
    else if (k === "checked") el.checked = Boolean(v);
    else if (k === "disabled") el.disabled = Boolean(v);
    else if (k === "value") el.value = String(v);
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v);
  }
  const arr = Array.isArray(children) ? children : [children];
  for (const ch of arr) {
    if (!ch) continue;
    if (typeof ch === "string") {
      if (el.children.length === 0 && !el._text) el.textContent = ch;
      else { const sp = doc.createElement("span"); sp.textContent = ch; el.appendChild(sp); }
    } else el.appendChild(ch);
  }
  return el;
}

const exportedCalls = [];
let revealedTarget = null;
const bookmarkedIds = new Set(["r_turn2"]);

const ctx = vm.createContext({
  document: doc,
  window: { innerWidth: 1280, location: { pathname: "/app/chat123", search: "" } },
  chrome: { storage: { local: { set() {}, get(_k, cb) { cb({}); } } } },
  isExtensionEnabled: true,
  domQuery: key => key === "chatHistory" ? chatHistory : null,
  getCurrentChatId: () => "chat123",
  findActiveChatInfo: () => ({ id: "chat123", title: "Architecture Discussion" }),
  sgNormalizeInstructionText: s => String(s || "").replace(/\s+/g, " ").trim(),
  sgIsBookmarked: id => bookmarkedIds.has(id),
  sgGetTurnId: el => el && el.id ? el.id : null,
  sgRevealTurn: (_ch, target) => { revealedTarget = target; },
  sgSkillEl,
  SG_DIAGRAM_LABELS: { mermaid: "Mermaid", svg: "SVG", dot: "Graphviz", chart: "Chart.js", wavedrom: "WaveDrom" },
  sgGetCodeBlockSource: cb => { const c = cb.querySelector("code"); return c ? c.textContent : ""; },
  sgDetectCodeBlockLanguage: cb => cb._lang || "",
  sgExtractCommentFilename: src => { const m = String(src || "").match(/^#\s*([A-Za-z0-9_.-]+\.[a-z0-9]+)\b/m); return m ? m[1] : ""; },
  sgDetectDiagramEngine: (cb, src) => {
    if (cb._lang === "mermaid") return "mermaid";
    if (cb._lang === "dot") return "dot";
    if (cb._lang === "chart") return "chart";
    if (cb._lang === "wavedrom") return "wavedrom";
    if (cb._lang === "svg") return "svg";
    return null;
  },
  sgDiagramGetSvgBlockSource: () => '<svg viewBox="0 0 100 100"><title>Pipeline SVG</title><rect/></svg>',
  exportChatAsPdf: async opts => exportedCalls.push({ format: "pdf", opts }),
  exportChatAsMarkdown: async opts => exportedCalls.push({ format: "md", opts }),
  exportChatAsDocx: async opts => exportedCalls.push({ format: "docx", opts }),
  exportChatAsText: async opts => exportedCalls.push({ format: "txt", opts }),
  showToast() {},
  requestAnimationFrame: fn => fn(),
  setTimeout: (fn) => { return 0; },
  clearTimeout() {},
  Map, Set, Array, Object, String, Number, Boolean, Math, RegExp, JSON, console
});

vm.runInContext(filterSlice + "\n" + outlineSlice, ctx);

// === [E1]: Selective Export Message Filtering & Virtualized Alignment ===
{
  const rpcMessages = [
    { role: "User", text: "Turn 1 prompt about intro", timestamp: "10:00" },
    { role: "Gemini", text: "Turn 1 answer", timestamp: "10:00" },
    { role: "User", text: "Turn 2 prompt about Vulkan pipeline", timestamp: "10:01" },
    { role: "Gemini", text: "Turn 2 Vulkan answer", timestamp: "10:01" },
    { role: "User", text: "Turn 3 prompt about WaveDrom", timestamp: "10:02" },
    { role: "Gemini", text: "Turn 3 WaveDrom answer", timestamp: "10:02" },
    { role: "User", text: "Turn 4 prompt about cleanup", timestamp: "10:03" },
    { role: "Gemini", text: "Turn 4 cleanup answer", timestamp: "10:03" }
  ];

  // Unfiltered passthrough
  assert.strictEqual(ctx.sgFilterMessagesForSelectiveExport(rpcMessages, {}).length, 8);

  // Exact turn subset (turns 2 & 4)
  const sub = ctx.sgFilterMessagesForSelectiveExport(rpcMessages, { selectedTurnNumbers: [2, 4] });
  assert.strictEqual(sub.length, 4);
  assert.strictEqual(sub[0].text, "Turn 2 prompt about Vulkan pipeline");
  assert.strictEqual(sub[3].text, "Turn 4 cleanup answer");

  // AI-only export (includeUserQueries: false)
  const aiOnly = ctx.sgFilterMessagesForSelectiveExport(rpcMessages, {
    selectedTurnNumbers: [2],
    includeUserQueries: false
  });
  assert.strictEqual(aiOnly.length, 1);
  assert.strictEqual(aiOnly[0].role, "Gemini");
  assert.strictEqual(aiOnly[0].text, "Turn 2 Vulkan answer");

  // Virtualized chat alignment: Outline only had last 2 turns (#1 = Turn 3, #2 = Turn 4)
  const aligned = ctx.sgFilterMessagesForSelectiveExport(rpcMessages, {
    selectedTurnNumbers: [1],
    totalOutlineTurns: 2,
    selectedTurnPreviews: [{ turnNumber: 1, userSnippet: "Turn 3 prompt about WaveDrom" }]
  });
  assert.strictEqual(aligned.length, 2);
  assert.strictEqual(aligned[0].text, "Turn 3 prompt about WaveDrom");
  assert.strictEqual(aligned[1].text, "Turn 3 WaveDrom answer");
}
console.log("PASS [E1]: Selective Export turn filter, AI-only mode, and virtualized long-chat alignment");

// === [E2]: Turn Asset Indexing (5 Diagram Engines + Code + File Cards) ===
function buildTurnDom(id, userPrompt, buildModelFn, userFiles = []) {
  const cont = new MiniEl("div");
  cont.className = "conversation-container";
  cont.id = id;
  const uq = new MiniEl("user-query");
  const qt = new MiniEl("div");
  qt.className = "query-text";
  qt.textContent = userPrompt;
  uq.appendChild(qt);
  for (const fn of userFiles) {
    const f = new MiniEl("file-preview-chip");
    f.setAttribute("data-filename", fn);
    uq.appendChild(f);
  }
  const mr = new MiniEl("model-response");
  mr.id = id;
  buildModelFn(mr);
  cont.appendChild(uq);
  cont.appendChild(mr);
  chatHistory.appendChild(cont);
  return { cont, uq, mr };
}

function addCodeBlock(parent, lang, text) {
  const cb = new MiniEl("code-block");
  cb._lang = lang;
  const pre = new MiniEl("pre");
  const code = new MiniEl("code");
  code.textContent = text;
  pre.appendChild(code);
  cb.appendChild(pre);
  parent.appendChild(cb);
  return cb;
}

let mermaidCb, waveCb, svgSb, pyCb;
buildTurnDom("r_turn1", "Explain architecture and upload baseline.json", (mr) => {
  const h2 = new MiniEl("h2");
  h2.textContent = "Architecture Overview";
  mr.appendChild(h2);
  mermaidCb = addCodeBlock(mr, "mermaid", "flowchart TD\n  title: System Flow\n  A --> B");
  pyCb = addCodeBlock(mr, "python", "# app.py\nprint('hello')\n");
}, ["baseline.json"]);

buildTurnDom("r_turn2", "Show timing diagram, bar chart, DOT graph, and Pure SVG", (mr) => {
  const h2 = new MiniEl("h2");
  h2.textContent = "Visual Assets";
  mr.appendChild(h2);
  waveCb = addCodeBlock(mr, "wavedrom", '{"signal":[{"name":"clk","wave":"p..."},{"name":"req","wave":"01.0"}]}');
  addCodeBlock(mr, "chart", '{"type":"bar","data":{"datasets":[{"data":[1,2]}]}}');
  addCodeBlock(mr, "dot", 'digraph AST { A -> B; }');
  svgSb = new MiniEl("svg-code-block");
  mr.appendChild(svgSb);
});

const turns = ctx.sgScanConversationTurns();
assert.strictEqual(turns.length, 2);
assert.strictEqual(turns[0].assets.length, 3, "Turn 1 must index Mermaid + Python file + baseline.json file");
assert.strictEqual(turns[0].assets[0].badge, "Mermaid");
assert.strictEqual(turns[0].assets[0].label, "System Flow");
assert.strictEqual(turns[0].assets[1].kind, "code");
assert.strictEqual(turns[0].assets[1].label, "app.py");
assert.strictEqual(turns[0].assets[2].kind, "file");
assert.strictEqual(turns[0].assets[2].label, "baseline.json");

assert.strictEqual(turns[1].isBookmarked, true);
assert.strictEqual(turns[1].assets.length, 4, "Turn 2 must index WaveDrom + Chart.js + Graphviz + native SVG");
assert.strictEqual(turns[1].assets[0].badge, "WaveDrom");
assert.strictEqual(turns[1].assets[0].label, "Waveform (2)");
assert.strictEqual(turns[1].assets[1].badge, "Chart.js");
assert.strictEqual(turns[1].assets[1].label, "Bar chart");
assert.strictEqual(turns[1].assets[2].badge, "Graphviz");
assert.strictEqual(turns[1].assets[2].label, "Graph AST");
assert.strictEqual(turns[1].assets[3].badge, "SVG");
assert.strictEqual(turns[1].assets[3].label, "Pipeline SVG");
console.log("PASS [E2]: Asset indexing across Mermaid, WaveDrom, Chart.js, Graphviz, native <svg-code-block>, code blocks, and file chips");

// === [E3]: Outline Asset Rendering, Search Filtering & Direct Jump ===
ctx.sgRenderOutline(turns, true);
const outlineRoot = doc.getElementById("sg-outline-root");
assert.ok(outlineRoot, "Outline root must mount");
const togglePill = doc.getElementById("sg-outline-toggle-pill");
assert.ok(togglePill, "Outline toggle pill must exist");
togglePill.click();

const assetRows = outlineRoot.querySelectorAll(".sg-outline-asset");
assert.strictEqual(assetRows.length, 7, "All 7 indexed assets must render in Outline when showAssets=true");

// Filter by "wavedrom" via real search input -> only Turn 2 + WaveDrom asset
const searchInput = outlineRoot.querySelector(".sg-outline-search");
assert.ok(searchInput, "Outline search input must exist");
searchInput.value = "wavedrom";
searchInput.dispatch("input");
const filteredAssetRows = outlineRoot.querySelectorAll(".sg-outline-asset");
assert.strictEqual(filteredAssetRows.length, 1, "Search 'wavedrom' must filter down to the WaveDrom asset");
filteredAssetRows[0].click();
assert.strictEqual(revealedTarget, waveCb, "Clicking WaveDrom asset row must scroll directly to that code-block");
assert.strictEqual(waveCb.classList.contains("sg-outline-flash"), true, "Target asset must receive flash highlight");

// Clear search and toggle Assets button OFF -> 0 asset rows rendered
searchInput.value = "";
searchInput.dispatch("input");
const assetsToggleBtn = outlineRoot.querySelectorAll(".sg-outline-icon-btn").find(b => (b.getAttribute("title") || "").includes("indexed diagrams"));
assert.ok(assetsToggleBtn, "Assets toggle button must exist in Outline header");
assetsToggleBtn.click();
assert.strictEqual(outlineRoot.querySelectorAll(".sg-outline-asset").length, 0, "showAssets=false must hide asset rows");
assetsToggleBtn.click();
assert.strictEqual(outlineRoot.querySelectorAll(".sg-outline-asset").length, 7, "Toggling Assets back ON restores all 7 assets");
console.log("PASS [E3]: Conversation Outline asset chips, search filtering by asset type/filename, toggle, and 1-click navigation");

// === [E4]: Selective Export Modal UX & End-to-End Dispatch ===
ctx.sgOpenSelectiveExportModal({ mode: "bookmarked" });
const overlay = doc.getElementById("sg-selective-export-overlay");
assert.ok(overlay, "Selective Export modal must open");
const summaryText = overlay.querySelector(".sg-selexp-summary").textContent;
assert.strictEqual(summaryText, "Selected: 1 / 2 turn(s)", "Bookmarked mode must pre-select only bookmarked turn (#2)");

// Pick PDF format & uncheck "Include User prompts"
const allButtons = overlay.querySelectorAll("button");
const pdfBtn = allButtons.find(b => b.textContent === "PDF (.pdf)");
const exportPrimaryBtn = allButtons.find(b => b.textContent === "Export Selected");
assert.ok(pdfBtn && exportPrimaryBtn, "Format and Export buttons must exist");
pdfBtn.click();

const optLabels = overlay.querySelectorAll(".sg-selexp-opt-check");
const includeUserLabel = optLabels.find(l => l.textContent.includes("Include User prompts"));
includeUserLabel.querySelector("input").click(); // uncheck

exportPrimaryBtn.click();
assert.strictEqual(doc.getElementById("sg-selective-export-overlay"), null, "Modal must close after clicking Export");
assert.strictEqual(exportedCalls.length, 1);
assert.strictEqual(exportedCalls[0].format, "pdf");
assert.deepStrictEqual(exportedCalls[0].opts.selectedTurnNumbers, [2]);
assert.strictEqual(exportedCalls[0].opts.includeUserQueries, false);
assert.strictEqual(exportedCalls[0].opts.totalOutlineTurns, 2);

// Reopen and verify Escape closes cleanly
ctx.sgOpenSelectiveExportModal({});
assert.ok(doc.getElementById("sg-selective-export-overlay"));
for (const fn of (docListeners.get("keydown") || []).slice()) {
  fn({ key: "Escape", preventDefault() {}, stopPropagation() {} });
}
assert.strictEqual(doc.getElementById("sg-selective-export-overlay"), null, "Escape must close Selective Export modal");

console.log("PASS [E4]: Selective Export modal (Bookmarked / Custom / Diagrams presets, PDF/MD/DOCX/TXT, AI-only toggle, Escape close)");
console.log("\nALL PHASE 1 (P1 + P2) VERIFICATION TESTS PASSED!");
