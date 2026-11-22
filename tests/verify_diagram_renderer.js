const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const { ROOT, loadCombinedContentJs } = require("./load-content");
const manifestRaw = fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8");
const contentJs = loadCombinedContentJs();
const contentCss = fs.readFileSync(path.join(ROOT, "content.css"), "utf8");
const popupHtml = fs.readFileSync(path.join(ROOT, "popup.html"), "utf8");
const popupJs = fs.readFileSync(path.join(ROOT, "popup.js"), "utf8");
const sandboxHtml = fs.readFileSync(path.join(ROOT, "diagram-sandbox.html"), "utf8");
const sandboxJs = fs.readFileSync(path.join(ROOT, "diagram-sandbox.js"), "utf8");
const sandboxCss = fs.readFileSync(path.join(ROOT, "diagram-sandbox.css"), "utf8");

// === 1. Manifest & Static Security / Isolation Audit ===
const manifest = JSON.parse(manifestRaw);
assert.ok(manifest.content_security_policy && manifest.content_security_policy.extension_pages, "MV3 extension_pages CSP must be defined");
assert.ok(manifest.content_security_policy.extension_pages.includes("'wasm-unsafe-eval'"), "CSP must include wasm-unsafe-eval for local @viz-js/viz WASM");
assert.ok(manifest.content_security_policy.extension_pages.includes("script-src 'self'"), "CSP must restrict scripts to 'self'");

const warList = manifest.web_accessible_resources || [];
const allWarResources = warList.flatMap(w => w.resources || []);
assert.ok(allWarResources.includes("diagram-sandbox.html"), "WAR must include diagram-sandbox.html");
assert.ok(allWarResources.includes("diagram-sandbox.js"), "WAR must include diagram-sandbox.js");
assert.ok(allWarResources.includes("diagram-sandbox.css"), "WAR must include diagram-sandbox.css");
assert.ok(allWarResources.includes("lib/diagrams/*"), "WAR must include lib/diagrams/*");
assert.strictEqual(allWarResources.some(r => /skills/i.test(r)), false, "WAR must NEVER expose skills/*");
for (const w of warList) {
  assert.deepStrictEqual(w.matches, ["https://gemini.google.com/*"], "WAR matches must be scoped strictly to https://gemini.google.com/*");
}

// Check zero external CDN URLs in sandbox HTML & CSS
assert.strictEqual(/https?:\/\//i.test(sandboxHtml), false, "diagram-sandbox.html must contain zero external URLs");
assert.strictEqual(/https?:\/\//i.test(sandboxCss), false, "diagram-sandbox.css must contain zero external URLs");

// Check zero innerHTML/outerHTML/insertAdjacentHTML/document.write sinks in new code
const diagSliceStart = contentJs.indexOf("const SG_DIAGRAM_DEBOUNCE_MS = 750;");
assert.ok(diagSliceStart > 0, "Diagram renderer slice not found in content.js");
const diagSlice = contentJs.slice(diagSliceStart);
const forbiddenSinks = /\.(?:innerHTML|outerHTML)\s*[+]?=|\binsertAdjacentHTML\s*\(|\bdocument\.write\s*\(/;
assert.strictEqual(forbiddenSinks.test(diagSlice), false, "content.js diagram module must have ZERO HTML sinks");
assert.strictEqual(forbiddenSinks.test(popupJs), false, "popup.js must have ZERO HTML sinks");
assert.strictEqual(forbiddenSinks.test(sandboxJs), false, "diagram-sandbox.js must have ZERO HTML sinks");

// Check popup wiring
assert.ok(popupHtml.includes('id="diagram-renderer-toggle"'), "popup.html must contain #diagram-renderer-toggle");
assert.ok(popupJs.includes('id: "diagram-renderer-toggle"') && popupJs.includes('storageKey: "diagramRendererEnabled"') && popupJs.includes("ENABLE_DIAGRAM_RENDERER") && popupJs.includes("DISABLE_DIAGRAM_RENDERER"), "popup.js must wire diagramRendererEnabled toggle");
assert.ok(contentJs.includes('case "ENABLE_DIAGRAM_RENDERER":') && contentJs.includes('case "DISABLE_DIAGRAM_RENDERER":'), "content.js must handle ENABLE/DISABLE_DIAGRAM_RENDERER");

// Check CSS balance
const strippedCss = contentCss.replace(/\/\*[\s\S]*?\*\//g, "");
assert.strictEqual((strippedCss.match(/\{/g) || []).length, (strippedCss.match(/\}/g) || []).length, "content.css braces must be balanced");
const strippedSbCss = sandboxCss.replace(/\/\*[\s\S]*?\*\//g, "");
assert.strictEqual((strippedSbCss.match(/\{/g) || []).length, (strippedSbCss.match(/\}/g) || []).length, "diagram-sandbox.css braces must be balanced");

// Check postMessage origin/source/token checks in both sandbox and content script
assert.ok(sandboxJs.includes("event.source !== window.parent") && sandboxJs.includes("event.origin !== PARENT_ORIGIN") && sandboxJs.includes("data.token !== INSTANCE_TOKEN"), "diagram-sandbox.js must validate source, origin, and token");
assert.ok(diagSlice.includes("event.source !== entry.iframe.contentWindow") && diagSlice.includes('event.origin !== "null"') && diagSlice.includes("_sgDiagramEntriesByToken.get(data.token)"), "content.js must validate iframe source, origin, and token");

console.log("PASS [D1]: Manifest CSP/WAR, zero HTML sinks, zero CDN URLs, popup wiring, CSS balance, and postMessage token/source/origin checks");

// === 2. Mini XML/SVG DOMParser for Testing Pure SVG Sanitizer & Chart.js JSON Validator ===
class TinyNode {
  constructor(tag, attrs = {}) {
    this.nodeType = 1;
    this.localName = tag;
    this.tagName = tag;
    this._attrs = new Map(Object.entries(attrs));
    this.childNodes = [];
    this.parentNode = null;
    this._text = "";
  }
  get attributes() {
    return Array.from(this._attrs.entries()).map(([name, value]) => ({ name, value }));
  }
  getAttribute(name) {
    return this._attrs.has(name) ? this._attrs.get(name) : null;
  }
  setAttribute(name, value) {
    this._attrs.set(name, String(value));
  }
  removeAttribute(name) {
    this._attrs.delete(name);
  }
  appendChild(child) {
    child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }
  removeChild(child) {
    const idx = this.childNodes.indexOf(child);
    if (idx >= 0) {
      this.childNodes.splice(idx, 1);
      child.parentNode = null;
    }
    return child;
  }
  get textContent() {
    return this._text + this.childNodes.map(c => c.textContent || "").join("");
  }
  set textContent(v) {
    this._text = String(v || "");
    this.childNodes = [];
  }
  querySelector(sel) {
    const target = sel.toLowerCase();
    for (const c of this.childNodes) {
      if (c.nodeType === 1) {
        if (c.localName.toLowerCase() === target) return c;
        const found = c.querySelector(sel);
        if (found) return found;
      }
    }
    return null;
  }
}

function parseMiniXml(xmlStr) {
  const s = String(xmlStr || "").trim().replace(/^<\?xml[^>]*\?>\s*/i, "");
  if (s.includes("<parsererror")) {
    const errDoc = new TinyNode("#document");
    const pe = new TinyNode("parsererror");
    pe.textContent = "XML syntax error";
    errDoc.appendChild(pe);
    return { documentElement: pe, querySelector: sel => sel === "parsererror" ? pe : null };
  }
  const stack = [];
  let root = null;
  const tagRe = /<(\/?)([A-Za-z_][\w:.-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g;
  let lastIndex = 0;
  let m;
  while ((m = tagRe.exec(s)) !== null) {
    const textChunk = s.slice(lastIndex, m.index);
    if (textChunk && stack.length > 0) {
      stack[stack.length - 1]._text += textChunk;
    }
    lastIndex = tagRe.lastIndex;
    const isClose = m[1] === "/";
    const tagName = m[2];
    const attrStr = m[3] || "";
    const isSelfClose = m[4] === "/";
    if (isClose) {
      stack.pop();
    } else {
      const attrs = {};
      const attrRe = /([A-Za-z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
      let am;
      while ((am = attrRe.exec(attrStr)) !== null) {
        attrs[am[1]] = am[2] !== undefined ? am[2] : am[3];
      }
      const el = new TinyNode(tagName, attrs);
      if (stack.length > 0) stack[stack.length - 1].appendChild(el);
      else root = el;
      if (!isSelfClose) stack.push(el);
    }
  }
  return {
    documentElement: root,
    querySelector: sel => root ? (root.localName.toLowerCase() === sel.toLowerCase() ? root : root.querySelector(sel)) : null
  };
}

{
  const sbCtx = vm.createContext({
    URLSearchParams,
    Map, Set, Array, Object, String, Number, Boolean, Math, Date, JSON, Error, RegExp,
    DOMParser: class { parseFromString(str) { return parseMiniXml(str); } },
    document: {
      getElementById: () => null,
      importNode: n => n
    },
    console
  });
  sbCtx.globalThis = sbCtx;
  vm.runInContext(sandboxJs, sbCtx);
  const api = sbCtx.__sgDiagramSandboxTestApi;
  assert.ok(api, "Sandbox test API exposed");

  // SVG Sanitizer test
  const maliciousSvg = `<svg viewBox="0 0 200 100" onload="alert(1)">
    <script>alert("xss")</script>
    <foreignObject width="100" height="50"><div>html</div></foreignObject>
    <iframe src="https://evil.example"></iframe>
    <style>@import url(https://evil.example/x.css); rect { fill: blue; }</style>
    <a href="javascript:alert(2)" xlink:href="data:text/html,<script>alert(3)</script>">
      <rect x="10" y="10" width="80" height="40" onclick="evil()" fill="blue" />
    </a>
    <use href="#safe-id" />
    <circle id="safe-id" cx="50" cy="50" r="20" />
  </svg>`;
  const cleanSvg = api.parseAndSanitizeSvg(maliciousSvg);
  assert.strictEqual(cleanSvg.getAttribute("onload"), null, "Must strip onload on <svg>");
  assert.strictEqual(cleanSvg.querySelector("script"), null, "Must remove <script>");
  assert.strictEqual(cleanSvg.querySelector("foreignobject"), null, "Must remove <foreignObject>");
  assert.strictEqual(cleanSvg.querySelector("iframe"), null, "Must remove <iframe>");
  const aEl = cleanSvg.querySelector("a");
  assert.strictEqual(aEl.getAttribute("href"), null, "Must strip javascript: href");
  assert.strictEqual(aEl.getAttribute("xlink:href"), null, "Must strip data:text/html xlink:href");
  const rectEl = cleanSvg.querySelector("rect");
  assert.ok(rectEl, "Must preserve valid <rect>");
  assert.strictEqual(rectEl.getAttribute("onclick"), null, "Must strip onclick attribute");
  assert.strictEqual(rectEl.getAttribute("fill"), "blue", "Must preserve safe geometry attributes");
  const useEl = cleanSvg.querySelector("use");
  assert.strictEqual(useEl.getAttribute("href"), "#safe-id", "Must preserve internal #fragment href");
  const styleEl = cleanSvg.querySelector("style");
  assert.strictEqual(styleEl.textContent.includes("@import"), false, "Must strip @import from <style>");
  assert.ok(styleEl.textContent.includes("rect { fill: blue; }"), "Must preserve safe CSS rules in <style>");

  // Chart.js JSON security tests
  assert.throws(() => api.safeJsonParse('{"__proto__": {"polluted": true}, "type": "bar", "data": {}}'), /Unsafe JSON key/i, "Must reject __proto__ pollution key");
  assert.throws(() => api.safeJsonParse('{"constructor": {"prototype": {}}, "type": "bar", "data": {}}'), /Unsafe JSON key/i, "Must reject constructor key");
  assert.throws(() => api.validateChartConfig(api.safeJsonParse('{"type": "line", "data": {"labels": ["A"]}, "options": {"scales": {"y": {"ticks": {"callback": "function(v){return v;}"}}}}}')), /callback|function/i, "Must reject function string in Chart.js options");
  assert.throws(() => api.validateChartConfig(api.safeJsonParse('{"type": "bar", "data": {"labels": ["A"]}, "options": {"onClick": "(e) => alert(1)"}}')), /callback|function/i, "Must reject arrow function string");
  const validChart = api.validateChartConfig(api.safeJsonParse('{"type": "bar", "data": {"labels": ["Q1","Q2"], "datasets": [{"label": "Rev", "data": [10,20]}]}}'));
  assert.strictEqual(validChart.type, "bar");
}
console.log("PASS [D2]: Pure SVG sanitizer strips XSS vectors & preserves geometry; Chart.js JSON rejects prototype pollution and callback strings");

// === 3. Content Script Integration VM Tests (Language Detection, Streaming Guard, Debounce, Idempotency, Non-Destructive Preview, Error Fallback, Teardown) ===
{
  let now = 1000;
  let nextTimerId = 1;
  const timers = new Map();
  function fakeSetTimeout(fn, delay) {
    const id = nextTimerId++;
    timers.set(id, { fn, at: now + (Number(delay) || 0) });
    return id;
  }
  function fakeClearTimeout(id) {
    timers.delete(id);
  }
  function advanceTime(ms) {
    now += ms;
    for (const [id, t] of Array.from(timers.entries())) {
      if (t.at <= now) {
        timers.delete(id);
        t.fn();
      }
    }
  }

  function makeClassList() {
    const set = new Set();
    return {
      add: (...cs) => cs.forEach(c => set.add(c)),
      remove: (...cs) => cs.forEach(c => set.delete(c)),
      contains: c => set.has(c),
      toggle: (c, force) => {
        if (force === undefined) {
          if (set.has(c)) { set.delete(c); return false; }
          set.add(c); return true;
        }
        if (force) set.add(c); else set.delete(c);
        return Boolean(force);
      }
    };
  }

  class MiniEl {
    constructor(tag) {
      this.tagName = tag.toUpperCase();
      this.className = "";
      this.classList = makeClassList();
      this.dataset = {};
      this.style = {};
      this.hidden = false;
      this.children = [];
      this.parentNode = null;
      this.isConnected = false;
      this.attributes = new Map();
      this.listeners = new Map();
      this._text = "";
      this.offsetParent = {};
      this.postedMessages = [];
      if (this.tagName === "IFRAME") {
        this.contentWindow = {
          postMessage: (msg, origin) => this.postedMessages.push({ msg, origin })
        };
      }
    }
    get textContent() {
      if (this.children.length === 0) return this._text;
      return this._text + this.children.map(c => c.textContent).join("");
    }
    set textContent(v) {
      this._text = String(v || "");
      this.children = [];
    }
    get nextSibling() {
      if (!this.parentNode) return null;
      const idx = this.parentNode.children.indexOf(this);
      return idx >= 0 && idx + 1 < this.parentNode.children.length ? this.parentNode.children[idx + 1] : null;
    }
    setAttribute(k, v) { this.attributes.set(k, String(v)); }
    getAttribute(k) { return this.attributes.has(k) ? this.attributes.get(k) : null; }
    appendChild(child) {
      if (child.parentNode) child.parentNode.removeChild(child);
      child.parentNode = this;
      this.children.push(child);
      this._setConn(child, this.isConnected);
      return child;
    }
    insertBefore(child, ref) {
      if (!ref) return this.appendChild(child);
      if (child.parentNode) child.parentNode.removeChild(child);
      const idx = this.children.indexOf(ref);
      child.parentNode = this;
      if (idx >= 0) this.children.splice(idx, 0, child);
      else this.children.push(child);
      this._setConn(child, this.isConnected);
      return child;
    }
    removeChild(child) {
      const idx = this.children.indexOf(child);
      if (idx >= 0) {
        this.children.splice(idx, 1);
        child.parentNode = null;
        this._setConn(child, false);
      }
      return child;
    }
    remove() {
      if (this.parentNode) this.parentNode.removeChild(this);
    }
    _setConn(node, val) {
      node.isConnected = val;
      for (const c of node.children) this._setConn(c, val);
    }
    addEventListener(type, fn) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push(fn);
    }
    click() {
      for (const fn of this.listeners.get("click") || []) {
        fn({ preventDefault() {}, stopPropagation() {}, target: this });
      }
    }
    focus() {}
    closest(sel) {
      let cur = this;
      while (cur) {
        if (sel.includes("model-response") && cur.tagName === "MODEL-RESPONSE") return cur;
        if (sel.includes("svg-code-block") && cur.tagName === "SVG-CODE-BLOCK") return cur;
        if (sel.includes("genui-sandbox") && cur.tagName === "GENUI-SANDBOX") return cur;
        if (sel.includes('[id^="sg-"]') && (cur.id || "").startsWith("sg-")) return cur;
        cur = cur.parentNode;
      }
      return null;
    }
    querySelector(sel) {
      const all = this.querySelectorAll(sel);
      return all[0] || null;
    }
    querySelectorAll(sel) {
      const res = [];
      const parts = sel.split(",").map(s => s.trim());
      const matches = (el, p) => {
        if (p === "code-block") return el.tagName === "CODE-BLOCK";
        if (p === "svg-code-block") return el.tagName === "SVG-CODE-BLOCK";
        if (p === "model-response" || p === ".model-response") return el.tagName === "MODEL-RESPONSE";
        if (p === "pre") return el.tagName === "PRE";
        if (p === "code" || p === "pre code") return el.tagName === "CODE";
        if (p === ".formatted-code-block-internal-container") return el.className.includes("formatted-code-block-internal-container");
        if (p === ".svg-code-block") return el.className.includes("svg-code-block");
        if (p === ".svg-preview") return el.className.includes("svg-preview");
        if (p === ".sg-diagram-code-view") return el.className.includes("sg-diagram-code-view");
        if (p === "genui-sandbox iframe[srcdoc]") return el.tagName === "IFRAME" && el.getAttribute("srcdoc") !== null && Boolean(el.closest("genui-sandbox"));
        if (p === '[fonticon="stop"]') return el.getAttribute("fonticon") === "stop";
        if (p === ".sg-diagram-host") return el.className.includes("sg-diagram-host");
        if (p === ".sg-diagram-iframe") return el.className.includes("sg-diagram-iframe");
        return false;
      };
      const walk = (n) => {
        for (const c of n.children) {
          if (parts.some(p => matches(c, p))) res.push(c);
          walk(c);
        }
      };
      walk(this);
      return res;
    }
  }

  const body = new MiniEl("body");
  body.isConnected = true;
  body.classList.add("dark-theme");
  const winListeners = new Map();
  const docListeners = new Map();
  let registeredUiRefresh = null;

  const doc = {
    body,
    activeElement: body,
    createElement: tag => new MiniEl(tag),
    querySelector: sel => body.querySelector(sel),
    querySelectorAll: sel => body.querySelectorAll(sel),
    addEventListener: (t, fn) => { (docListeners.get(t) || docListeners.set(t, []).get(t)).push(fn); },
    removeEventListener: (t, fn) => { const a = docListeners.get(t); if (a) { const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); } }
  };

  function makeCodeBlock(lang, code) {
    const mr = new MiniEl("model-response");
    const cb = new MiniEl("code-block");
    cb._lang = lang;
    const inner = new MiniEl("div");
    inner.className = "formatted-code-block-internal-container";
    const pre = new MiniEl("pre");
    const codeEl = new MiniEl("code");
    codeEl.textContent = code;
    pre.appendChild(codeEl);
    inner.appendChild(pre);
    cb.appendChild(inner);
    mr.appendChild(cb);
    body.appendChild(mr);
    return { mr, cb, codeEl };
  }

  const ctx = vm.createContext({
    document: doc,
    window: {
      addEventListener: (t, fn) => { (winListeners.get(t) || winListeners.set(t, []).get(t)).push(fn); },
      removeEventListener: (t, fn) => { const a = winListeners.get(t); if (a) { const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); } },
      dispatchEvent: (ev) => {
        for (const fn of (winListeners.get(ev.type) || []).slice()) fn(ev);
        return true;
      }
    },
    CustomEvent: class CustomEvent {
      constructor(type, init) {
        this.type = type;
        this.detail = init ? init.detail : undefined;
      }
    },
    chrome: {
      runtime: { getURL: p => "chrome-extension://ext123/" + p },
      storage: {
        sync: { get: (_k, cb) => cb({ extensionEnabled: true, diagramRendererEnabled: true }) },
        onChanged: { addListener() {} }
      }
    },
    sgObserverRegistry: {
      registerUIRefresh: (name, fn) => { if (name === "diagramRenderer") registeredUiRefresh = fn; },
      unregisterUIRefresh: (name) => { if (name === "diagramRenderer") registeredUiRefresh = null; }
    },
    sgDetectCodeBlockLanguage: cb => cb._lang || "",
    sgGetCodeBlockSource: cb => {
      const c = cb.querySelector("code");
      return c ? c.textContent : "";
    },
    isExtensionEnabled: true,
    detectTheme: () => body.classList.contains("dark-theme") ? "dark" : "light",
    MutationObserver: class { observe() {} disconnect() {} },
    setTimeout: fakeSetTimeout,
    clearTimeout: fakeClearTimeout,
    URL, Blob, Map, Set, Array, Object, String, Number, Boolean, Math, Date, RegExp, Uint8Array,
    encodeURIComponent, console
  });

  // Skip auto-init call at very bottom? No, let auto-init run!
  vm.runInContext(diagSlice, ctx);

  // Language detection checks (all 5 engines + xml-svg + rejections)
  assert.strictEqual(ctx.sgDetectDiagramEngine({ _lang: "mermaid" }, "graph TD; A-->B;"), "mermaid");
  assert.strictEqual(ctx.sgDetectDiagramEngine({ _lang: "svg" }, "<svg></svg>"), "svg");
  assert.strictEqual(ctx.sgDetectDiagramEngine({ _lang: "xml" }, "<svg viewBox='0 0 10 10'></svg>"), "svg");
  assert.strictEqual(ctx.sgDetectDiagramEngine({ _lang: "xml" }, '<?xml version="1.0"?>\n<svg></svg>'), "svg");
  assert.strictEqual(ctx.sgDetectDiagramEngine({ _lang: "xml" }, '<?xml version="1.0"?><root><item/></root>'), null, "Plain XML without <svg> must be rejected");
  assert.strictEqual(ctx.sgDetectDiagramEngine({ _lang: "dot" }, "digraph { a -> b }"), "dot");
  assert.strictEqual(ctx.sgDetectDiagramEngine({ _lang: "graphviz" }, "digraph { a -> b }"), "dot");
  assert.strictEqual(ctx.sgDetectDiagramEngine({ _lang: "chart" }, '{"type":"bar","data":{}}'), "chart");
  assert.strictEqual(ctx.sgDetectDiagramEngine({ _lang: "chartjs" }, '{"type":"line","data":{}}'), "chart");
  assert.strictEqual(ctx.sgDetectDiagramEngine({ _lang: "chart-json" }, '{"type":"pie","data":{}}'), "chart");
  assert.strictEqual(ctx.sgDetectDiagramEngine({ _lang: "wavedrom" }, '{"signal":[]}'), "wavedrom");
  assert.strictEqual(ctx.sgDetectDiagramEngine({ _lang: "cpp" }, "int main(){}"), null);
  assert.strictEqual(ctx.sgDetectDiagramEngine({ _lang: "javascript" }, "console.log(1)"), null);
  assert.strictEqual(ctx.sgDetectDiagramEngine({ _lang: "json" }, '{"a":1}'), null);

  // Streaming guard test: active stop button on last model-response must defer rendering
  const stopIcon = new MiniEl("mat-icon");
  stopIcon.setAttribute("fonticon", "stop");
  body.appendChild(stopIcon);

  const { cb, codeEl } = makeCodeBlock("mermaid", "graph TD;\nA-->B;");
  ctx.sgRefreshDiagramRenderer();
  advanceTime(1000);
  assert.strictEqual(cb.querySelector(".sg-diagram-host"), null, "Must NOT render while stop icon is active on last model-response");

  // Streaming stops -> debounce 750ms
  stopIcon.remove();
  ctx.sgRefreshDiagramRenderer();
  advanceTime(400);
  assert.strictEqual(cb.querySelector(".sg-diagram-host"), null, "Must wait full 750ms debounce before mounting");
  // Mutate text at 400ms -> resets debounce
  codeEl.textContent = "graph TD;\nA-->B;\nB-->C;";
  ctx.sgRefreshDiagramRenderer();
  advanceTime(500);
  assert.strictEqual(cb.querySelector(".sg-diagram-host"), null, "Debounce must reset when content hash changes");
  advanceTime(300);
  const host = cb.querySelector(".sg-diagram-host");
  assert.ok(host, "Host must mount after 750ms stable debounce");
  const codeWrap = cb.querySelector(".formatted-code-block-internal-container");
  assert.ok(cb.children.indexOf(host) < cb.children.indexOf(codeWrap), "Diagram host/toolbar must mount ABOVE code container so Preview->Code keeps toolbar on top");
  const iframe = host.querySelector(".sg-diagram-iframe");
  assert.strictEqual(iframe.getAttribute("sandbox"), "allow-scripts", "Iframe must have strict sandbox=allow-scripts");
  assert.ok(iframe.src.startsWith("chrome-extension://ext123/diagram-sandbox.html#token="), "Iframe src must carry random hash token");

  // Simulate READY message from sandbox (first test wrong token rejection!)
  const token = host.dataset.sgDiagramToken;
  const dispatchMsg = (event) => (winListeners.get("message") || []).forEach(fn => fn(event));
  dispatchMsg({ source: iframe.contentWindow, origin: "null", data: { type: "SG_DIAGRAM_READY", token: "wrong_token" } });
  assert.strictEqual(iframe.postedMessages.length, 0, "Wrong token must be rejected");
  dispatchMsg({ source: {}, origin: "null", data: { type: "SG_DIAGRAM_READY", token } });
  assert.strictEqual(iframe.postedMessages.length, 0, "Wrong event.source must be rejected");

  // Valid READY -> posts SG_DIAGRAM_RENDER once
  dispatchMsg({ source: iframe.contentWindow, origin: "null", data: { type: "SG_DIAGRAM_READY", token } });
  assert.strictEqual(iframe.postedMessages.length, 1);
  assert.strictEqual(iframe.postedMessages[0].msg.type, "SG_DIAGRAM_RENDER");
  assert.strictEqual(iframe.postedMessages[0].msg.engine, "mermaid");

  // Content-hash idempotency: repeated refreshes with identical source must NOT re-render
  ctx.sgRefreshDiagramRenderer();
  advanceTime(1000);
  assert.strictEqual(iframe.postedMessages.length, 1, "Idempotent hash check must prevent redundant re-renders");

  // Rendered -> switches to Preview mode while keeping original <code> text untouched!
  dispatchMsg({ source: iframe.contentWindow, origin: "null", data: { type: "SG_DIAGRAM_RENDERED", token, canExportSvg: true } });
  assert.strictEqual(cb.classList.contains("sg-diagram-preview-mode"), true, "Valid render enables preview mode class");
  assert.strictEqual(codeEl.textContent, "graph TD;\nA-->B;\nB-->C;", "Original <code> text must remain completely untouched");

  // Fullscreen test: dedicated iframe renders without moving inline iframe
  const allBtns = [];
  const collectBtns = (n) => { for (const c of n.children || []) { if (c.tagName === "BUTTON") allBtns.push(c); collectBtns(c); } };
  collectBtns(host);
  const expandBtn = allBtns.find(b => b.textContent === "Expand");
  assert.ok(expandBtn, "Expand button must exist");
  expandBtn.click();
  const fsOverlay = body.children.find(c => (c.className || "").includes("sg-diagram-fullscreen-overlay"));
  assert.ok(fsOverlay, "Fullscreen overlay must mount on document.body");
  assert.strictEqual(iframe.parentNode, host.children[2], "Inline iframe must NEVER be moved/reloaded when opening fullscreen");
  const fsIframe = fsOverlay.querySelector(".sg-diagram-iframe");
  assert.ok(fsIframe && fsIframe !== iframe, "Fullscreen must use a dedicated sandboxed iframe");
  const fsToken = decodeURIComponent(fsIframe.src.split("#token=")[1] || "");
  assert.ok(fsToken && fsToken !== token, "Fullscreen iframe must have its own distinct token");
  dispatchMsg({ source: fsIframe.contentWindow, origin: "null", data: { type: "SG_DIAGRAM_READY", token: fsToken } });
  assert.strictEqual(fsIframe.postedMessages.length, 1, "Fullscreen iframe must receive SG_DIAGRAM_RENDER on READY");
  assert.strictEqual(fsIframe.postedMessages[0].msg.type, "SG_DIAGRAM_RENDER");
  ctx.sgCloseDiagramFullscreen(true);
  assert.strictEqual(body.children.includes(fsOverlay), false, "Closing fullscreen removes overlay cleanly");
  assert.strictEqual(iframe.parentNode, host.children[2], "Inline iframe remains untouched after closing fullscreen");

  // Error -> auto-falls back to Code mode with visible error banner
  dispatchMsg({ source: iframe.contentWindow, origin: "null", data: { type: "SG_DIAGRAM_ERROR", token, error: "Syntax error at line 2" } });
  assert.strictEqual(cb.classList.contains("sg-diagram-preview-mode"), false, "Error must auto-fallback to Code mode");

  // Teardown on toggle off -> removes host, preview class, and listeners cleanly
  ctx.sgSetDiagramRendererEnabled(false);
  assert.strictEqual(cb.querySelector(".sg-diagram-host"), null, "Teardown must remove diagram host");
  assert.strictEqual(registeredUiRefresh, null, "Teardown must unregister UI refresh observer");

  // === [D4]: Localized / Generic / Container Label Content Sniffing & Strict False-Positive Rejection ===
  const mermaidSamples = [
    "flowchart TD\n  A[Start] --> B[End]",
    "graph LR\n  A --> B",
    "%% comment\nsequenceDiagram\n  Alice->>Bob: Hi",
    "---\ntitle: Demo\n---\nclassDiagram\n  Animal <|-- Duck",
    "stateDiagram-v2\n  [*] --> Idle",
    "erDiagram\n  USER ||--o{ ORDER : places",
    "gantt\n  title Plan\n  section A\n  Task :a1, 2026-01-01, 3d",
    "mindmap\n  root((Core))",
    "timeline\n  title History\n  2026 : Launch",
    "gitGraph\n  commit",
    "pie title Pets\n  \"Dogs\" : 60",
    "quadrantChart\n  x-axis Low --> High",
    "architecture-beta\n  service api(server)[API]",
    "block-beta\n  columns 2\n  a b"
  ];
  const genericHeaders = ["Đoạn mã", "Đoạn", "Code snippet", "Code", "Plaintext", "text", "txt", "mã", "văn bản", ""];
  for (const h of genericHeaders) {
    assert.strictEqual(ctx.sgDetectDiagramEngine({ _lang: h }, mermaidSamples[0]), "mermaid", `Generic label "${h}" must sniff Mermaid`);
    assert.strictEqual(ctx.sgDetectDiagramEngine({ _lang: h }, 'digraph G { rankdir=LR; A -> B; }'), "dot", `Generic label "${h}" must sniff DOT`);
    assert.strictEqual(ctx.sgDetectDiagramEngine({ _lang: h }, 'strict graph { a -- b; }'), "dot", `Generic label "${h}" must sniff undirected DOT`);
    assert.strictEqual(ctx.sgDetectDiagramEngine({ _lang: h }, '{"type":"line","data":{"labels":["Jan"],"datasets":[{"label":"S","data":[10]}]}}'), "chart", `Generic label "${h}" must sniff Chart.js`);
    assert.strictEqual(ctx.sgDetectDiagramEngine({ _lang: h }, '{"signal":[{"name":"clk","wave":"p...."}]}'), "wavedrom", `Generic label "${h}" must sniff WaveDrom`);
    assert.strictEqual(ctx.sgDetectDiagramEngine({ _lang: h }, '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40"/></svg>'), "svg", `Generic label "${h}" must sniff Pure SVG`);
  }
  for (const sample of mermaidSamples) {
    assert.strictEqual(ctx.sgDetectDiagramEngine({ _lang: "Đoạn mã" }, sample), "mermaid", `Must detect Mermaid variant: ${sample.slice(0, 30)}`);
  }
  // Nested WaveDrom signal group & DOT with leading comments
  assert.strictEqual(ctx.sgDetectDiagramEngine({ _lang: "JSON" }, '{"signal":[["Bus",{"name":"d","wave":"x.."}]]}'), "wavedrom", "JSON header detects nested WaveDrom");
  assert.strictEqual(ctx.sgDetectDiagramEngine({ _lang: "JSON" }, '{"type":"doughnut","data":{"labels":["A","B"],"datasets":[{"data":[30,70]}]}}'), "chart", "JSON header detects Chart.js");
  assert.strictEqual(ctx.sgDetectDiagramEngine({ _lang: "Đoạn mã" }, '/* comment */\n// line\ndigraph "My Graph" {\n  a -> b;\n}'), "dot", "DOT with leading comments detected");

  // Strict false-positive rejections on JSON container
  const plainJsonSamples = [
    '{"name":"gemini-power-suite","version":"1.0.0","dependencies":{"foo":"1.0.0"}}',
    '{"bundleVersion":"1.1.0","skills":[{"id":"analyze-mode","file":"skills/analyze-mode.md"}]}',
    '{"status":"ok","type":"bar","data":{"id":123,"items":[1,2,3]}}',
    '{"signal":["SIGTERM","SIGINT"],"exitCode":0}'
  ];
  for (const j of plainJsonSamples) {
    assert.strictEqual(ctx.sgDetectDiagramEngine({ _lang: "JSON" }, j), null, `Plain JSON must NOT be detected: ${j.slice(0, 50)}`);
    assert.strictEqual(ctx.sgDetectDiagramEngine({ _lang: "Đoạn mã" }, j), null, `Plain JSON under generic label must NOT be detected: ${j.slice(0, 50)}`);
  }
  // JSON container must NOT sniff Mermaid/DOT
  assert.strictEqual(ctx.sgDetectDiagramEngine({ _lang: "JSON" }, "graph TD\nA-->B"), null, "JSON header must not sniff Mermaid");
  assert.strictEqual(ctx.sgDetectDiagramEngine({ _lang: "JSON" }, "digraph { a -> b }"), null, "JSON header must not sniff DOT");

  // Arbitrary C/JS/CSS code under generic labels must NOT be detected as DOT or Mermaid
  const nonDiagramGenericCode = [
    "int main() { return 0; }",
    "function graph() { const a = 1; return a; }",
    "graph { color: red; background: white; }",
    "class Graph { render() { return this.x; } }",
    "const obj = { signal: 'ok' };"
  ];
  for (const snippet of nonDiagramGenericCode) {
    assert.strictEqual(ctx.sgDetectDiagramEngine({ _lang: "Đoạn mã" }, snippet), null, `Non-diagram code under generic label must NOT trigger: ${snippet}`);
    assert.strictEqual(ctx.sgDetectDiagramEngine({ _lang: "" }, snippet), null, `Non-diagram code under empty label must NOT trigger: ${snippet}`);
  }

  // Explicit non-diagram languages must NEVER trigger content sniffing
  const explicitNonDiagLangs = ["javascript", "typescript", "python", "cpp", "c++", "c", "java", "html", "css", "bash", "sh", "sql", "rust", "go", "yaml"];
  for (const lang of explicitNonDiagLangs) {
    assert.strictEqual(ctx.sgDetectDiagramEngine({ _lang: lang }, "flowchart TD\nA-->B"), null, `Explicit ${lang} must NEVER sniff Mermaid`);
    assert.strictEqual(ctx.sgDetectDiagramEngine({ _lang: lang }, "digraph { A -> B }"), null, `Explicit ${lang} must NEVER sniff DOT`);
    assert.strictEqual(ctx.sgDetectDiagramEngine({ _lang: lang }, '{"type":"bar","data":{"datasets":[{"data":[1]}]}}'), null, `Explicit ${lang} must NEVER sniff Chart.js`);
    assert.strictEqual(ctx.sgDetectDiagramEngine({ _lang: lang }, '{"signal":[{"name":"clk","wave":"p."}]}'), null, `Explicit ${lang} must NEVER sniff WaveDrom`);
    assert.strictEqual(ctx.sgDetectDiagramEngine({ _lang: lang }, '<svg viewBox="0 0 10 10"></svg>'), null, `Explicit ${lang} must NEVER sniff SVG`);
  }

  // === [D5]: Gemini Native <svg-code-block> + spoof_injector.js genui-morph Bridge ===
  {
    const spoofSrc = fs.readFileSync(path.join(ROOT, "spoof_injector.js"), "utf8");
    class FakeHTMLInputElement { click() {} }
    class FakeHTMLIFrameElement extends MiniEl {
      constructor() {
        super("div");
        this.tagName = "IFRAME";
        this._realWin = {
          received: [],
          postMessage(msg, target) { this.received.push({ msg, target }); },
          closed: false
        };
      }
      get contentWindow() { return this._realWin; }
    }
    class FakeMessageEvent {
      constructor(src) { this._src = src; }
      get source() { return this._src; }
    }

    const spoofCtx = vm.createContext({
      window: ctx.window,
      document: doc,
      localStorage: { getItem: () => null },
      HTMLInputElement: FakeHTMLInputElement,
      HTMLIFrameElement: FakeHTMLIFrameElement,
      MessageEvent: FakeMessageEvent,
      CustomEvent: ctx.CustomEvent,
      MutationObserver: class { observe() {} disconnect() {} },
      setInterval: () => 0,
      clearInterval: () => {},
      setTimeout: fakeSetTimeout,
      clearTimeout: fakeClearTimeout,
      WeakMap, Map, Proxy, Object, String, Boolean, Array, console
    });
    spoofCtx.window.location = { hash: "" };
    vm.runInContext(spoofSrc, spoofCtx);

    // Re-enable diagram renderer (which binds sg-svg-block-source listener)
    ctx.sgSetDiagramRendererEnabled(true);

    // Build Gemini's exact <svg-code-block> DOM hierarchy
    const mrSvg = new MiniEl("model-response");
    const svgCodeBlock = new MiniEl("svg-code-block");
    const innerBox = new MiniEl("div");
    innerBox.className = "svg-code-block svg-code-block--picture";
    const nativeToolbar = new MiniEl("div");
    nativeToolbar.className = "svg-toolbar";
    const svgPreview = new MiniEl("div");
    svgPreview.className = "svg-preview";
    const genuiSandbox = new MiniEl("genui-sandbox");
    const genuiContainer = new MiniEl("div");
    genuiContainer.className = "genui-sandbox-container";
    const genuiIframe = new FakeHTMLIFrameElement();
    genuiIframe.setAttribute("title", "Model Generated UI Container");
    genuiIframe.setAttribute("srcdoc", '<!DOCTYPE html><html><head><style id="genui-host-injected-css"></style></head><body><div id="app-root"></div></body></html>');

    genuiContainer.appendChild(genuiIframe);
    genuiSandbox.appendChild(genuiContainer);
    svgPreview.appendChild(genuiSandbox);
    innerBox.appendChild(nativeToolbar);
    innerBox.appendChild(svgPreview);
    svgCodeBlock.appendChild(innerBox);
    mrSvg.appendChild(svgCodeBlock);
    body.appendChild(mrSvg);

    // Verify stable contentWindow identity + MessageEvent.source identity preservation
    const cw1 = genuiIframe.contentWindow;
    const cw2 = genuiIframe.contentWindow;
    assert.strictEqual(cw1, cw2, "Wrapped contentWindow must preserve === identity");
    const resizeEv = new FakeMessageEvent(genuiIframe._realWin);
    assert.strictEqual(resizeEv.source, cw1, "MessageEvent.source must match wrapped iframe.contentWindow for genui-resize");

    // Verify unrelated genui-sandbox iframe (NOT inside svg-code-block) is NOT proxied
    const nonSvgSandbox = new MiniEl("genui-sandbox");
    const nonSvgIframe = new FakeHTMLIFrameElement();
    nonSvgSandbox.appendChild(nonSvgIframe);
    body.appendChild(nonSvgSandbox);
    assert.strictEqual(nonSvgIframe.contentWindow, nonSvgIframe._realWin, "Non-SVG GenUI iframe must NEVER be proxied");

    // Simulate Gemini pushing SVG via genui-morph + genui-stream-complete
    const rawSvg = '<svg viewBox="0 0 320 120"><rect width="100" height="60" fill="#3b82f6"/><text x="20" y="35">Input</text></svg>';
    cw1.postMessage({ type: "genui-morph", html: rawSvg + '<canvas data-svg-context-canvas=""></canvas>' }, "*");
    assert.strictEqual(genuiIframe._realWin.received.length, 1, "genui-morph must be forwarded transparently to real iframe");
    cw1.postMessage({ type: "genui-stream-complete" }, "*");
    assert.ok(svgCodeBlock.getAttribute("data-sg-svg-id"), "spoof_injector must tag svg-code-block with data-sg-svg-id");

    // Advance debounce -> mounts .sg-diagram-host right before .svg-preview
    advanceTime(800);
    const svgHost = svgCodeBlock.querySelector(".sg-diagram-host");
    assert.ok(svgHost, "Native <svg-code-block> must mount .sg-diagram-host toolbar");
    assert.ok(svgCodeBlock.classList.contains("sg-diagram-svg-managed"), "Must add sg-diagram-svg-managed class");
    assert.ok(innerBox.children.indexOf(svgHost) < innerBox.children.indexOf(svgPreview), "Host must mount ABOVE .svg-preview");

    const svgIframe = svgHost.querySelector(".sg-diagram-iframe");
    const svgTok = svgHost.dataset.sgDiagramToken;
    dispatchMsg({ source: svgIframe.contentWindow, origin: "null", data: { type: "SG_DIAGRAM_READY", token: svgTok } });
    assert.strictEqual(svgIframe.postedMessages.length, 1, "Sandbox iframe must receive SG_DIAGRAM_RENDER");
    assert.strictEqual(svgIframe.postedMessages[0].msg.engine, "svg");
    assert.strictEqual(svgIframe.postedMessages[0].msg.source, rawSvg, "Extracted source must be clean <svg>...</svg> without canvas sibling");

    dispatchMsg({ source: svgIframe.contentWindow, origin: "null", data: { type: "SG_DIAGRAM_RENDERED", token: svgTok, canExportSvg: true } });
    const codeView = svgHost.querySelector(".sg-diagram-code-view");
    assert.ok(codeView && codeView.hidden === true, "Code view must stay hidden in Preview mode");

    // Toggle Preview -> Code shows raw SVG source in .sg-diagram-code-view
    const svgBtns = [];
    const walkBtns = (n) => { for (const c of n.children || []) { if (c.tagName === "BUTTON") svgBtns.push(c); walkBtns(c); } };
    walkBtns(svgHost);
    const svgCodeBtn = svgBtns.find(b => b.textContent === "Code");
    const svgPreviewBtn = svgBtns.find(b => b.textContent === "Preview");
    const svgExpandBtn = svgBtns.find(b => b.textContent === "Expand");
    const svgCopyBtn = svgBtns.find(b => b.textContent === "Copy");
    assert.ok(svgCodeBtn && svgPreviewBtn && svgExpandBtn && svgCopyBtn, "Native SVG host must expose Preview, Code, Expand, Copy buttons");
    svgCodeBtn.click();
    assert.strictEqual(codeView.hidden, false, "Code mode must reveal .sg-diagram-code-view");
    assert.strictEqual(codeView.querySelector("code").textContent, rawSvg, "Code view must contain exact SVG markup via textContent");
    svgPreviewBtn.click();
    assert.strictEqual(codeView.hidden, true, "Switching back to Preview must hide code view");

    // Expand Fullscreen works on native <svg-code-block>
    svgExpandBtn.click();
    const svgFsOverlay = body.children.find(c => (c.className || "").includes("sg-diagram-fullscreen-overlay"));
    assert.ok(svgFsOverlay, "Expand must open fullscreen overlay for native <svg-code-block>");
    ctx.sgCloseDiagramFullscreen(true);

    // Fallback srcdoc extraction helper check
    const staticSrcdoc = '<!DOCTYPE html><html><head><script>var s="<svg>fake</svg>";</script></head><body><div id="app-root"><svg viewBox="0 0 10 10"><circle r="4"/></svg></div></body></html>';
    assert.strictEqual(ctx.sgDiagramExtractSvgFromSrcdoc(staticSrcdoc), '<svg viewBox="0 0 10 10"><circle r="4"/></svg>', "Static srcdoc fallback must extract SVG from <body> only");

    // Teardown restores native <svg-code-block> cleanly
    ctx.sgSetDiagramRendererEnabled(false);
    assert.strictEqual(svgCodeBlock.querySelector(".sg-diagram-host"), null, "Teardown must remove host from <svg-code-block>");
    assert.strictEqual(svgCodeBlock.classList.contains("sg-diagram-svg-managed"), false, "Teardown must remove sg-diagram-svg-managed class");
  }
}
console.log("PASS [D3]: Language detection, streaming guard, 750ms debounce, hash idempotency, token/source validation, non-destructive preview, error fallback, and clean teardown");
console.log("PASS [D4]: Localized/generic/container content sniffing (Đoạn mã, Code snippet, JSON, XML, empty) + zero false positives on plain JSON, C/JS/CSS, and explicit languages");
console.log("PASS [D5]: Gemini native <svg-code-block> genui-morph bridge, MessageEvent.source identity, Preview/Code/Expand/Copy toolbar, srcdoc fallback, and clean teardown");

(async () => {
  // === [D6]: WaveDrom assign + NetlistSVG (CSP safety, Named-Net normalization, Digital & Analog end-to-end render) ===
  const elkPath = path.join(ROOT, "lib/diagrams/elk.bundled.js");
  const nsvgPath = path.join(ROOT, "lib/diagrams/netlistsvg.min.js");
  const wdPath = path.join(ROOT, "lib/diagrams/wavedrom.min.js");
  assert.ok(fs.existsSync(elkPath) && fs.existsSync(nsvgPath), "lib/diagrams/elk.bundled.js and netlistsvg.min.js must exist");
  const elkCode = fs.readFileSync(elkPath, "utf8");
  const nsvgCode = fs.readFileSync(nsvgPath, "utf8");
  assert.strictEqual(/\beval\s*\(|new\s+Function\b/.test(elkCode), false, "elk.bundled.js must contain zero eval/new Function");
  assert.strictEqual(/\beval\s*\(|new\s+Function\b/.test(nsvgCode), false, "netlistsvg.min.js must contain zero eval/new Function");

  const sbCtx2 = vm.createContext({
    URLSearchParams,
    Map, Set, Array, Object, String, Number, Boolean, Math, Date, JSON, Error, RegExp,
    DOMParser: class { parseFromString(str) { return parseMiniXml(str); } },
    document: { getElementById: () => null, importNode: n => n },
    console
  });
  sbCtx2.globalThis = sbCtx2;
  vm.runInContext(sandboxJs, sbCtx2);
  const { normalizeNetlistPayload } = sbCtx2.__sgDiagramSandboxTestApi;
  assert.strictEqual(typeof normalizeNetlistPayload, "function", "normalizeNetlistPayload must be exported for testing");

  // 1) Digital flat Named-Net with sequential DFF feedback loop + constant "0" + omitted port_directions
  const rawDigitalNamed = {
    name: "toggle_dff",
    ports: {
      clk: { direction: "input", bits: "clk" },
      rst_n: { direction: "input", bits: ["1"] },
      q_out: { direction: "output", bits: ["q"] }
    },
    cells: {
      inv1: {
        type: "$not",
        connections: { A: "q", Y: "q_n" }
      },
      reg1: {
        type: "$dff",
        connections: { CLK: "clk", D: "q_n", Q: "q" }
      }
    }
  };
  const normDig = normalizeNetlistPayload(rawDigitalNamed);
  assert.strictEqual(normDig.skin, "digital", "Digital gates/$dff must select digital skin");
  const digMod = normDig.netlist.modules.toggle_dff;
  assert.ok(digMod, "Flat payload must wrap under module name toggle_dff");
  assert.deepStrictEqual(Array.from(digMod.ports.rst_n.bits), ["1"], "Yosys constant string '1' must stay '1'");
  assert.strictEqual(digMod.cells.inv1.port_directions.A, "input");
  assert.strictEqual(digMod.cells.inv1.port_directions.Y, "output");
  assert.strictEqual(digMod.cells.reg1.port_directions.CLK, "input");
  assert.strictEqual(digMod.cells.reg1.port_directions.D, "input");
  assert.strictEqual(digMod.cells.reg1.port_directions.Q, "output");
  assert.strictEqual(digMod.cells.reg1.connections.Q[0], digMod.cells.inv1.connections.A[0], "Named net 'q' must map to identical bit ID across feedback loop");
  assert.strictEqual(digMod.ports.q_out.bits[0], digMod.cells.reg1.connections.Q[0], "Output port 'q' must match reg1.Q bit ID");

  // 2) Analog flat Named-Net with omitted port_directions -> auto-detect analog skin & pin directions
  const rawAnalogNamed = {
    name: "rc_npn_stage",
    ports: {
      vin: { direction: "input", bits: ["vin"] },
      vout: { direction: "output", bits: ["vc"] }
    },
    cells: {
      V1: { type: "vcc", connections: { A: "vcc_5v" } },
      Rc: { type: "r_v", connections: { A: "vcc_5v", B: "vc" }, attributes: { value: "2.2k" } },
      Cin: { type: "c_h", connections: { A: "vin", B: "vb" }, attributes: { value: "10uF" } },
      Q1: { type: "q_npn", connections: { B: "vb", C: "vc", E: "gnd_net" }, attributes: { value: "2N2222" } },
      G1: { type: "gnd", connections: { A: "gnd_net" } },
      U1: { type: "opamp", connections: { "+": "vc", "-": "vout_fb", VCC: "vcc_5v", VEE: "gnd_net", OUT: "vout_fb" } }
    }
  };
  const normAna = normalizeNetlistPayload(rawAnalogNamed);
  assert.strictEqual(normAna.skin, "analog", "Analog parts must auto-select analog skin");
  const anaCells = normAna.netlist.modules.rc_npn_stage.cells;
  assert.strictEqual(anaCells.V1.port_directions.A, "output", "vcc A pin must default to output driver");
  assert.strictEqual(anaCells.G1.port_directions.A, "input", "gnd A pin must default to input sink");
  assert.strictEqual(anaCells.Rc.port_directions.B, "output", "r_v B pin must default to output");
  assert.strictEqual(anaCells.Q1.port_directions.E, "output", "q_npn E pin must default to output");
  assert.strictEqual(anaCells.U1.port_directions.OUT, "output", "opamp OUT pin must default to output");
  assert.strictEqual(anaCells.U1.port_directions["+"], "input", "opamp + pin must default to input");

  // 3) Hybrid numeric + named bits collision guard
  const hybridNorm = normalizeNetlistPayload({
    modules: {
      top: {
        ports: { a: { direction: "input", bits: [50] } },
        cells: { g1: { type: "$not", connections: { A: [50], Y: ["out_wire"] } } }
      }
    }
  });
  assert.ok(hybridNorm.netlist.modules.top.cells.g1.connections.Y[0] > 50, "Allocated named-net bit ID must stay strictly above max existing numeric bit ID");

  // 4) Live render test for WaveDrom assign + NetlistSVG Digital + NetlistSVG Analog
  const wdCtx = vm.createContext({ window: {}, self: {}, globalThis: {} });
  wdCtx.window = wdCtx; wdCtx.self = wdCtx; wdCtx.globalThis = wdCtx;
  vm.runInContext(fs.readFileSync(wdPath, "utf8"), wdCtx);
  const wd = wdCtx.wavedrom || wdCtx.WaveDrom;
  const assignSvg = wd.onml.stringify(wd.renderAny(0, { assign: [["sum", ["^", "a", "b"]]] }, wd.waveSkin || {}));
  assert.ok(assignSvg.includes("<svg") && assignSvg.includes("<path"), "WaveDrom assign must produce valid logic gate SVG");

  const nsvgCtx = vm.createContext({ document: {}, console, setTimeout, clearTimeout });
  nsvgCtx.window = nsvgCtx; nsvgCtx.self = nsvgCtx;
  vm.runInContext(elkCode, nsvgCtx);
  vm.runInContext(nsvgCode, nsvgCtx);
  const digSvg = await nsvgCtx.netlistsvg.render(nsvgCtx.netlistsvg.digitalSkin, JSON.parse(JSON.stringify(normDig.netlist)));
  assert.ok(digSvg.includes("<svg") && (digSvg.includes("toggle_dff") || digSvg.includes("<path")), "NetlistSVG digital Named-Net must render valid <svg>");
  assert.ok(digSvg.includes("<svg") && (digSvg.includes("<rect") || digSvg.includes("<path")), "NetlistSVG digital DFF circuit must include SVG shapes");
  const anaSvg = await nsvgCtx.netlistsvg.render(nsvgCtx.netlistsvg.analogSkin, JSON.parse(JSON.stringify(normAna.netlist)));
  assert.ok(anaSvg.includes("<svg") && anaSvg.includes("<circle") && anaSvg.includes("Rc"), "NetlistSVG analog Named-Net must render transistor/resistor/opamp SVG");
  assert.strictEqual(/s:generic="body"/.test(anaSvg), false, "opamp/resistor/capacitor/npn/gnd in [D6] must render analog symbols without generic fallback");

  console.log("PASS [D6]: WaveDrom assign + NetlistSVG (CSP-clean elkjs/netlistsvg, Named-Net normalization, and Digital/Analog SVG rendering)");

  // === [D8]: NetlistSVG Analog Alias/Pin Normalization, Auto Vertical Shunt, & Expanded Analog Skin ===
  {
    // 1) Exact RLC filter screenshot scenario: unoriented resistor, inductor, capacitor + gnd + top-level value
    const rlcRaw = {
      name: "rlc_filter",
      ports: {
        Vin: { direction: "input", bits: ["vin"] },
        Vout: { direction: "output", bits: ["vout"] }
      },
      cells: {
        R1: { type: "resistor", connections: { A: "vin", B: "n1" }, value: "1k" },
        L1: { type: "inductor", connections: { A: "n1", B: "vout" }, value: "10mH" },
        C1: { type: "capacitor", connections: { A: "vout", B: "0" }, value: "100nF" },
        G1: { type: "gnd", connections: { A: "0" } }
      }
    };
    const rlcNorm = normalizeNetlistPayload(rlcRaw);
    assert.strictEqual(rlcNorm.skin, "analog", "RLC filter must select analog skin");
    const rlcCells = rlcNorm.netlist.modules.rlc_filter.cells;
    assert.strictEqual(rlcCells.R1.type, "r_h", "Series resistor must resolve to horizontal r_h");
    assert.strictEqual(rlcCells.L1.type, "l_h", "Series inductor must resolve to horizontal l_h");
    assert.strictEqual(rlcCells.C1.type, "c_v", "Shunt capacitor connected to gnd must auto-orient to c_v");
    assert.strictEqual(rlcCells.R1.attributes.value, "1k", "Top-level value must lift into attributes.value");
    assert.strictEqual(rlcCells.L1.attributes.value, "10mH");
    assert.strictEqual(rlcCells.C1.attributes.value, "100nF");

    const rlcSvg = await nsvgCtx.netlistsvg.render(nsvgCtx.netlistsvg.analogSkin, JSON.parse(JSON.stringify(rlcNorm.netlist)));
    assert.ok(rlcSvg.includes("<svg") && rlcSvg.includes("<path"), "RLC filter must render valid SVG paths");
    assert.strictEqual(/s:generic="body"/.test(rlcSvg), false, "RLC filter must NOT fall back to generic boxes");
    for (const label of ["R1", "1k", "L1", "10mH", "C1", "100nF"]) {
      assert.ok(rlcSvg.includes(label), `RLC SVG must include label '${label}'`);
    }
    for (const placeholder of ["Xk", "Xu", "XpF", "XV", "XA"]) {
      assert.strictEqual(rlcSvg.includes(placeholder), false, `RLC SVG must NOT contain placeholder '${placeholder}'`);
    }

    // 2) Explicit orientation preservation + vertical rail pin-order swap (A=gnd, B=node -> A=node, B=gnd)
    const orientNorm = normalizeNetlistPayload({
      name: "explicit_orient",
      ports: { vout: { direction: "output", bits: ["vout"] } },
      cells: {
        Ch: { type: "capacitor_h", connections: { A: "vout", B: "gnd_net" } },
        Rv: { type: "resistor_v", connections: { A: "n_in", B: "vout" } },
        Cshunt: { type: "capacitor", connections: { A: "gnd_net", B: "vout" } },
        G1: { type: "ground", connections: { ground_pin: "gnd_net" } }
      }
    });
    const oCells = orientNorm.netlist.modules.explicit_orient.cells;
    assert.strictEqual(oCells.Ch.type, "capacitor_h", "Explicit capacitor_h on gnd must stay horizontal");
    assert.strictEqual(oCells.Rv.type, "resistor_v", "Explicit resistor_v in series must stay vertical");
    assert.strictEqual(oCells.Cshunt.type, "c_v", "Unoriented shunt capacitor must orient to c_v");
    assert.strictEqual(oCells.G1.type, "gnd", "ground alias must resolve to gnd");
    assert.ok(oCells.G1.connections.A, "Single arbitrary pin on gnd must normalize to A");
    assert.deepStrictEqual(Array.from(oCells.Cshunt.connections.B), Array.from(oCells.G1.connections.A), "Vertical c_v must place gnd net on bottom pin B");
    const orientSvg = await nsvgCtx.netlistsvg.render(nsvgCtx.netlistsvg.analogSkin, JSON.parse(JSON.stringify(orientNorm.netlist)));
    assert.strictEqual(/s:generic="body"/.test(orientSvg), false, "explicit_orient must have zero generic fallback boxes");

    // 3) Pin-alias normalization & inout coercion across BJT, MOSFET, OpAmp, Diode, Potentiometer, Rail
    const aliasPinNorm = normalizeNetlistPayload({
      name: "pin_aliases",
      ports: { vin: { direction: "input", bits: ["vin"] }, vout: { direction: "output", bits: ["vout"] } },
      cells: {
        V1: { type: "vdd", connections: { out: "vdd_3v3" } },
        D1: { type: "diode", port_directions: { anode: "inout", cathode: "inout" }, connections: { anode: "vin", cathode: "n_d" } },
        Q1: { type: "npn", connections: { base: "n_d", collector: "vdd_3v3", emitter: "n_q" } },
        M1: { type: "mosfet_n", connections: { gate: "n_q", drain: "n_m", source: "gnd_net" } },
        U1: { type: "op-amp", connections: { "in+": "n_d", "in-": "n_m", vo: "vout", vdd: "vdd_3v3", vss: "gnd_net" } },
        RV1: { type: "potentiometer", connections: { "1": "vdd_3v3", "2": "n_m", wiper: "n_d" } },
        G1: { type: "earth", connections: { p0: "gnd_net" } }
      }
    });
    const apCells = aliasPinNorm.netlist.modules.pin_aliases.cells;
    assert.strictEqual(apCells.V1.type, "vcc");
    assert.ok(apCells.V1.connections.A);
    assert.strictEqual(apCells.D1.type, "d_h");
    assert.ok(apCells.D1.connections["+"] && apCells.D1.connections["-"]);
    assert.strictEqual(apCells.D1.port_directions["+"], "input");
    assert.strictEqual(apCells.D1.port_directions["-"], "output");
    assert.strictEqual(apCells.Q1.type, "q_npn");
    assert.ok(apCells.Q1.connections.B && apCells.Q1.connections.C && apCells.Q1.connections.E);
    assert.strictEqual(apCells.M1.type, "mosfet_n");
    assert.strictEqual(apCells.M1.port_directions.G, "input");
    assert.strictEqual(apCells.M1.port_directions.D, "input");
    assert.strictEqual(apCells.M1.port_directions.S, "output");
    assert.strictEqual(apCells.U1.type, "opamp");
    assert.ok(apCells.U1.connections["+"] && apCells.U1.connections["-"] && apCells.U1.connections.OUT && apCells.U1.connections.VCC && apCells.U1.connections.VEE);
    assert.strictEqual(apCells.U1.port_directions.OUT, "output");
    assert.strictEqual(apCells.RV1.type, "pot_v", "Potentiometer touching vdd_3v3 must orient to pot_v");
    assert.ok(apCells.RV1.connections.A && apCells.RV1.connections.B && apCells.RV1.connections.W);

    // 4) End-to-end live render of ALL 7 new analog families + opamp + diode_led_h
    const allNewAnalog = normalizeNetlistPayload({
      name: "all_new_analog_parts",
      ports: { vin: { direction: "input", bits: ["vin"] }, vout: { direction: "output", bits: ["vout"] } },
      cells: {
        V1: { type: "vcc", connections: { A: "vdd" } },
        G1: { type: "gnd", connections: { A: "gnd" } },
        F1: { type: "fuse_h", connections: { A: "vin", B: "n_f1" }, attributes: { value: "1A" } },
        F2: { type: "fuse_v", connections: { A: "n_f1", B: "n_f2" } },
        SW1: { type: "switch_h", connections: { A: "n_f2", B: "n_sw1" } },
        SW2: { type: "switch_v", connections: { A: "n_sw1", B: "n_sw2" } },
        RV1: { type: "potentiometer_h", connections: { A: "n_sw2", B: "n_rv1", W: "n_w1" }, attributes: { value: "10k" } },
        RV2: { type: "potentiometer_v", connections: { A: "vdd", B: "gnd", W: "n_w2" } },
        CP1: { type: "capacitor_pol_h", connections: { "+": "n_rv1", "-": "n_cp1" }, attributes: { value: "47uF" } },
        CP2: { type: "capacitor_pol_v", connections: { "+": "n_cp1", "-": "gnd" } },
        DZ1: { type: "diode_zener_h", connections: { "+": "n_dz1", "-": "vdd" }, attributes: { value: "5.1V" } },
        DZ2: { type: "diode_zener_v", connections: { "+": "gnd", "-": "n_dz2" } },
        LED1: { type: "diode_led_h", connections: { "+": "n_w1", "-": "gnd" } },
        M1: { type: "nmos", connections: { G: "n_w2", D: "n_dz1", S: "gnd" }, attributes: { value: "2N7000" } },
        M2: { type: "pmos", connections: { G: "n_dz2", S: "vdd", D: "n_m2" }, attributes: { value: "BS250" } },
        U1: { type: "opamp", connections: { "+": "n_m2", "-": "vout", OUT: "vout", VCC: "vdd", VEE: "gnd" }, attributes: { value: "LM358" } }
      }
    });
    const newAnaSvg = await nsvgCtx.netlistsvg.render(nsvgCtx.netlistsvg.analogSkin, JSON.parse(JSON.stringify(allNewAnalog.netlist)));
    assert.ok(newAnaSvg.includes("<svg"), "All new analog components must render valid <svg>");
    assert.strictEqual(/s:generic="body"/.test(newAnaSvg), false, "NONE of the 7 new analog families + opamp + diode_led_h may fall back to generic boxes!");
    for (const ref of ["M1", "M2", "DZ1", "DZ2", "CP1", "CP2", "RV1", "RV2", "SW1", "SW2", "F1", "F2", "U1", "LED1", "2N7000", "LM358", "47uF", "5.1V"]) {
      assert.ok(newAnaSvg.includes(ref), `Rendered analog SVG must contain '${ref}'`);
    }
    for (const placeholder of ["Xk", "Xu", "XpF", "XV", "XA"]) {
      assert.strictEqual(newAnaSvg.includes(placeholder), false, `Rendered analog SVG must NOT contain placeholder '${placeholder}'`);
    }
  }
  console.log("PASS [D8]: NetlistSVG analog alias/pin normalization, auto vertical shunt orientation, placeholder removal, and all 7 new vector families render cleanly");

  // === [D7]: Content sniffing & Outline asset labeling for WaveDrom assign & NetlistSVG ===
  const detStart = contentJs.indexOf("const SG_DIAGRAM_ENGINE_MAP =");
  const detEnd = contentJs.indexOf("function sgDiagramExtractSvgFromSrcdoc(");
  assert.ok(detStart > 0 && detEnd > detStart, "Must locate SG_DIAGRAM_ENGINE_MAP .. sgDetectDiagramEngine in content.js");
  const detectCtx = vm.createContext({
    JSON, Object, Array, Set, String,
    sgDetectCodeBlockLanguage: (cb) => cb._lang || ""
  });
  vm.runInContext(contentJs.slice(detStart, detEnd), detectCtx);
  const mkCb = (lang) => ({ _lang: lang, querySelector: () => null });

  const assignJson = JSON.stringify({ assign: [["sum", ["^", "a", "b"]], ["cout", ["&", "a", "b"]]] });
  const namedNetJson = JSON.stringify(rawDigitalNamed);
  const yosysJson = JSON.stringify({
    modules: {
      full_adder: {
        ports: { a: { direction: "input", bits: [2] } },
        cells: { x1: { type: "$_XOR_", connections: { A: [2], Y: [3] } } }
      }
    }
  });

  // Explicit tags
  assert.strictEqual(detectCtx.sgDetectDiagramEngine(mkCb("netlist"), yosysJson), "netlist");
  assert.strictEqual(detectCtx.sgDetectDiagramEngine(mkCb("netlistsvg"), yosysJson), "netlist");
  assert.strictEqual(detectCtx.sgDetectDiagramEngine(mkCb("circuit"), namedNetJson), "netlist");
  assert.strictEqual(detectCtx.sgDetectDiagramEngine(mkCb("schematic"), namedNetJson), "netlist");
  assert.strictEqual(detectCtx.sgDetectDiagramEngine(mkCb("wavedrom"), assignJson), "wavedrom");

  // Sniffing under JSON & localized/generic labels
  for (const lbl of ["json", "Json", "Đoạn mã", "Code snippet", ""]) {
    assert.strictEqual(detectCtx.sgDetectDiagramEngine(mkCb(lbl), assignJson), "wavedrom", `WaveDrom assign must sniff under '${lbl}'`);
    assert.strictEqual(detectCtx.sgDetectDiagramEngine(mkCb(lbl), yosysJson), "netlist", `Yosys JSON must sniff under '${lbl}'`);
    assert.strictEqual(detectCtx.sgDetectDiagramEngine(mkCb(lbl), namedNetJson), "netlist", `Named-Net JSON must sniff under '${lbl}'`);
  }

  // Non-diagram safety
  assert.strictEqual(detectCtx.sgDetectDiagramEngine(mkCb("json"), '{"name":"test","cells":[1,2,3]}'), null, "Non-object cells array must NOT sniff netlist");
  assert.strictEqual(detectCtx.sgDetectDiagramEngine(mkCb("javascript"), yosysJson), null, "Explicit javascript must NEVER sniff netlist");

  // Summarize asset labels
  const labelFnStart = contentJs.indexOf("function sgSummarizeDiagramAssetLabel(");
  const labelFnEnd = contentJs.indexOf("function sgExtractTurnAssets(");
  assert.ok(labelFnStart > 0 && labelFnEnd > labelFnStart);
  const labelCtx = vm.createContext({ JSON, Object, Array, String });
  vm.runInContext(contentJs.slice(labelFnStart, labelFnEnd), labelCtx);
  assert.strictEqual(labelCtx.sgSummarizeDiagramAssetLabel("wavedrom", assignJson), "Logic Circuit (2)");
  assert.strictEqual(labelCtx.sgSummarizeDiagramAssetLabel("netlist", yosysJson), "Circuit: full_adder");
  assert.strictEqual(labelCtx.sgSummarizeDiagramAssetLabel("netlist", namedNetJson), "Circuit: toggle_dff");

  console.log("PASS [D7]: Detection, JSON/localized sniffing, and Outline asset labeling for WaveDrom assign & NetlistSVG");
  console.log("\nALL DIAGRAM RENDERER VERIFICATION TESTS PASSED!");
})().catch((err) => {
  console.error("TEST FAILED:", err);
  process.exit(1);
});
