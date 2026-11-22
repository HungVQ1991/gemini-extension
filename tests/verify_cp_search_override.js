const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const { ROOT, loadCombinedContentJs } = require("./load-content");
const spoofSrc = fs.readFileSync(path.join(ROOT, "spoof_injector.js"), "utf8");
const contentSrc = loadCombinedContentJs();

// Extract Command Palette shortcut & sidebar search takeover slice from content.js
const cpStart = contentSrc.indexOf("let _sgCpLastHandledTs = -1;");
const cpEnd = contentSrc.indexOf("const SG_ORCHESTRATOR_CONFIG_KEY");
assert.ok(cpStart > 0 && cpEnd > cpStart, "Could not locate Command Palette takeover slice in content.js");
const cpSlice = contentSrc.slice(cpStart, cpEnd);

class MiniEl {
  constructor(tag) {
    this.tagName = tag.toUpperCase();
    this.id = "";
    this.className = "";
    this.attrs = new Map();
    this.dataset = {};
    this.children = [];
    this.parentNode = null;
    this.isConnected = false;
    this.textContent = "";
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
  hasAttribute(k) { return this.getAttribute(k) !== null; }
  removeAttribute(k) {
    this.attrs.delete(k);
    if (k.startsWith("data-")) {
      const camel = k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      delete this.dataset[camel];
    }
  }
  appendChild(ch) {
    ch.parentNode = this;
    this.children.push(ch);
    const setC = (n, v) => { n.isConnected = v; for (const c of n.children) setC(c, v); };
    setC(ch, this.isConnected);
    return ch;
  }
  contains(node) {
    let cur = node;
    while (cur) { if (cur === this) return true; cur = cur.parentNode; }
    return false;
  }
  matches(sel) {
    return sel.split(",").map(s => s.trim()).some(p => {
      if (p === "button") return this.tagName === "BUTTON";
      if (p === "a") return this.tagName === "A";
      if (p === "[role='button']" || p === '[role="button"]') return this.getAttribute("role") === "button";
      if (p === "bard-sidenav") return this.tagName === "BARD-SIDENAV";
      if (p === "side-navigation-v2") return this.tagName === "SIDE-NAVIGATION-V2";
      if (p === "search-nav-button") return this.tagName === "SEARCH-NAV-BUTTON";
      if (p === "side-nav-action-button") return this.tagName === "SIDE-NAV-ACTION-BUTTON";
      if (p === '.sidenav-with-history-container') return this.className.includes("sidenav-with-history-container");
      if (p === '#sg-command-palette-overlay') return this.id === "sg-command-palette-overlay";
      if (p === '[id^="sg-"]') return (this.id || "").startsWith("sg-");
      if (p === '[class*="sg-"]') return (this.className || "").includes("sg-");
      if (p === '[data-test-id="search-nav-button"]') return this.getAttribute("data-test-id") === "search-nav-button";
      if (p === '[data-test-id="side-nav-search-button"]') return this.getAttribute("data-test-id") === "side-nav-search-button";
      if (p === 'a[href="/search"]') return this.tagName === "A" && this.getAttribute("href") === "/search";
      if (p === 'a[href*="/search?"]') return this.tagName === "A" && (this.getAttribute("href") || "").includes("/search?");
      if (p === 'mat-icon[fonticon="search"]') return this.tagName === "MAT-ICON" && this.getAttribute("fonticon") === "search";
      if (p === 'mat-icon[data-mat-icon-name="search"]') return this.tagName === "MAT-ICON" && this.getAttribute("data-mat-icon-name") === "search";
      if (p === '[fonticon="search"]') return this.getAttribute("fonticon") === "search";
      if (p === '[data-sg-cp-search-proxy="1"]') return this.dataset.sgCpSearchProxy === "1";
      if (p === ".cdk-overlay-container .mdc-tooltip__surface") return this.className.includes("mdc-tooltip__surface") && Boolean(this.closest(".cdk-overlay-container"));
      if (p === ".cdk-overlay-container .mat-mdc-tooltip") return this.className.includes("mat-mdc-tooltip") && Boolean(this.closest(".cdk-overlay-container"));
      if (p === ".cdk-overlay-container") return this.className.includes("cdk-overlay-container");
      return false;
    });
  }
  closest(sel) {
    let cur = this;
    while (cur) {
      if (cur.matches(sel)) return cur;
      cur = cur.parentNode;
    }
    return null;
  }
  querySelectorAll(sel) {
    const out = [];
    const walk = (n) => {
      for (const c of n.children) {
        if (c.matches(sel)) out.push(c);
        walk(c);
      }
    };
    walk(this);
    return out;
  }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
}

const docEl = new MiniEl("html");
docEl.isConnected = true;
const body = new MiniEl("body");
body.className = "dark-theme sg-autohide-collapsed-sidebar sg-hide-activity sg-hide-upgrade-btns";
docEl.appendChild(body);

// Build sidebar search button matching Gemini Vietnamese UI
const sidenav = new MiniEl("bard-sidenav");
const searchBtn = new MiniEl("button");
searchBtn.setAttribute("aria-label", "Tìm kiếm trong các cuộc trò chuyện (Ctrl+Shift+K)");
searchBtn.setAttribute("aria-describedby", "cdk-desc-search");
const searchIcon = new MiniEl("mat-icon");
searchIcon.setAttribute("fonticon", "search");
searchBtn.appendChild(searchIcon);
sidenav.appendChild(searchBtn);

// Add an extension-owned button inside sidenav (must NEVER be intercepted)
const sgBtn = new MiniEl("button");
sgBtn.id = "sg-folder-search";
const sgIcon = new MiniEl("mat-icon");
sgIcon.setAttribute("fonticon", "search");
sgBtn.appendChild(sgIcon);
sidenav.appendChild(sgBtn);

const cdkDesc = new MiniEl("div");
cdkDesc.id = "cdk-desc-search";
cdkDesc.textContent = "Tìm kiếm trong các cuộc trò chuyện (Ctrl+Shift+K)";

const cdkOverlay = new MiniEl("div");
cdkOverlay.className = "cdk-overlay-container";
const tooltipSurface = new MiniEl("div");
tooltipSurface.className = "mdc-tooltip__surface";
tooltipSurface.textContent = "Tìm kiếm trong các cuộc trò chuyện (Ctrl+Shift+K)";
cdkOverlay.appendChild(tooltipSurface);

body.appendChild(sidenav);
body.appendChild(cdkDesc);
body.appendChild(cdkOverlay);

const lsMap = new Map();
const winCapListeners = new Map();
const winBubbleListeners = new Map();

const sharedWin = {
  location: { hash: "" },
  addEventListener(type, fn, capture) {
    const m = capture ? winCapListeners : winBubbleListeners;
    if (!m.has(type)) m.set(type, []);
    m.get(type).push(fn);
  },
  removeEventListener(type, fn, capture) {
    const m = capture ? winCapListeners : winBubbleListeners;
    const arr = m.get(type);
    if (arr) { const i = arr.indexOf(fn); if (i >= 0) arr.splice(i, 1); }
  },
  dispatchEvent(ev) {
    ev._stoppedImmediate = false;
    ev._stopped = false;
    ev._prevented = false;
    ev.preventDefault = () => { ev._prevented = true; };
    ev.stopPropagation = () => { ev._stopped = true; };
    ev.stopImmediatePropagation = () => { ev._stopped = true; ev._stoppedImmediate = true; };
    for (const fn of (winCapListeners.get(ev.type) || []).slice()) {
      fn(ev);
      if (ev._stoppedImmediate) return !ev._prevented;
    }
    for (const fn of (winBubbleListeners.get(ev.type) || []).slice()) {
      fn(ev);
      if (ev._stoppedImmediate) return !ev._prevented;
    }
    return !ev._prevented;
  }
};

const sharedDoc = {
  documentElement: docEl,
  body,
  getElementById(id) {
    const walk = (n) => {
      if (n.id === id) return n;
      for (const c of n.children) { const r = walk(c); if (r) return r; }
      return null;
    };
    return walk(docEl);
  },
  querySelector: sel => docEl.querySelector(sel),
  querySelectorAll: sel => docEl.querySelectorAll(sel)
};

class CustomEvent {
  constructor(type, init) { this.type = type; this.detail = init ? init.detail : undefined; }
}

// 1. Run spoof_injector.js at document_start (BEFORE Gemini registers its shortcut!)
const spoofCtx = vm.createContext({
  window: sharedWin,
  document: sharedDoc,
  localStorage: { getItem: k => lsMap.has(k) ? lsMap.get(k) : null, setItem: (k, v) => lsMap.set(k, String(v)) },
  HTMLInputElement: class { click() {} },
  HTMLIFrameElement: class {},
  MessageEvent: class {},
  CustomEvent,
  MutationObserver: class { observe() {} disconnect() {} },
  setInterval: () => 0,
  clearInterval: () => {},
  setTimeout, clearTimeout,
  WeakMap, Map, Proxy, Object, String, Boolean, Array, console
});
vm.runInContext(spoofSrc, spoofCtx);

// 2. Simulate Gemini's Angular app registering its native search shortcuts on window capture!
let geminiNativeSearchCalls = 0;
sharedWin.addEventListener("keydown", (e) => {
  if (e.isComposing) return;
  if ((e.ctrlKey || e.metaKey) && (e.key || "").toLowerCase() === "k") {
    geminiNativeSearchCalls++;
  }
}, true);

// 3. Run content.js Command Palette slice (at document_end)
let openCount = 0;
let closeCount = 0;
let paletteOpen = false;
const cpCtx = vm.createContext({
  window: sharedWin,
  document: sharedDoc,
  navigator: { platform: "Win32" },
  localStorage: { getItem: k => lsMap.has(k) ? lsMap.get(k) : null, setItem: (k, v) => lsMap.set(k, String(v)) },
  chrome: {
    storage: {
      sync: { get: (_k, cb) => cb({ extensionEnabled: true, commandPaletteEnabled: true }) },
      onChanged: { addListener() {} }
    }
  },
  isExtensionEnabled: true,
  isCommandPaletteEnabled: true,
  sgObserverRegistry: { registerUIRefresh() {} },
  sgConsumePendingPaletteJump() {},
  sgOpenCommandPalette() { openCount++; paletteOpen = true; },
  sgCloseCommandPalette() { if (!paletteOpen) return false; closeCount++; paletteOpen = false; return true; },
  CustomEvent,
  setTimeout: (fn) => { fn(); return 0; },
  clearTimeout: () => {},
  Set, Array, String, Boolean, Object, console
});
vm.runInContext(cpSlice, cpCtx);

// Test [S1]: Ctrl+Shift+K is blocked completely; Gemini never sees it; palette does NOT open
const evShiftK = { type: "keydown", ctrlKey: true, shiftKey: true, altKey: false, key: "K", code: "KeyK", timeStamp: 100 };
sharedWin.dispatchEvent(evShiftK);
assert.strictEqual(evShiftK._prevented, true, "Ctrl+Shift+K must be prevented");
assert.strictEqual(geminiNativeSearchCalls, 0, "Gemini native search handler must NEVER receive Ctrl+Shift+K");
assert.strictEqual(openCount, 0, "Ctrl+Shift+K must NOT open Command Palette");

// Test [S2]: Ctrl+K intercepts BEFORE Gemini, toggles Command Palette ONCE (no double toggle!)
const evCtrlK = { type: "keydown", ctrlKey: true, shiftKey: false, altKey: false, key: "k", code: "KeyK", timeStamp: 200 };
sharedWin.dispatchEvent(evCtrlK);
assert.strictEqual(evCtrlK._prevented, true, "Ctrl+K must be prevented");
assert.strictEqual(geminiNativeSearchCalls, 0, "Gemini must NEVER receive Ctrl+K");
assert.strictEqual(openCount, 1, "Ctrl+K must open Command Palette exactly once");

// Pressing Ctrl+K again closes it cleanly
const evCtrlK2 = { type: "keydown", ctrlKey: true, shiftKey: false, altKey: false, key: "k", code: "KeyK", timeStamp: 300 };
sharedWin.dispatchEvent(evCtrlK2);
assert.strictEqual(closeCount, 1, "Second Ctrl+K must close Command Palette");

// Test [S3]: IME guard preserved
const evIme = { type: "keydown", ctrlKey: true, shiftKey: false, altKey: false, key: "k", code: "KeyK", isComposing: true, timeStamp: 350 };
sharedWin.dispatchEvent(evIme);
assert.strictEqual(openCount, 1, "IME composing keydown must be ignored");

// Test [S4]: Clicking sidebar magnifying glass icon opens Command Palette & blocks native navigation
const clickEv = { type: "click", target: searchIcon };
sharedWin.dispatchEvent(clickEv);
assert.strictEqual(clickEv._prevented, true, "Click on sidebar search icon must be prevented");
assert.strictEqual(clickEv._stoppedImmediate, true, "Click must stop before Angular handler");
assert.strictEqual(openCount, 2, "Clicking sidebar search icon must open Command Palette");

// Test [S5]: Clicking extension-owned #sg-folder-search inside sidenav is NOT hijacked
const sgClickEv = { type: "click", target: sgIcon };
sharedWin.dispatchEvent(sgClickEv);
assert.strictEqual(sgClickEv._prevented, false, "Extension-owned #sg-* controls must NOT be intercepted");
assert.strictEqual(openCount, 2);

// Test [S6]: Pressing Enter on focused sidebar search button opens Command Palette
const enterEv = { type: "keydown", key: "Enter", target: searchBtn, ctrlKey: false, metaKey: false, altKey: false };
sharedWin.dispatchEvent(enterEv);
assert.strictEqual(enterEv._prevented, true, "Enter on sidebar search button must be prevented");
assert.strictEqual(openCount, 3, "Enter on sidebar search button must open Command Palette");

// Test [S7]: Tooltip & aria-label relabeled to Command Palette (Ctrl+K)
assert.strictEqual(searchBtn.getAttribute("aria-label"), "Command Palette (Ctrl+K)");
assert.strictEqual(cdkDesc.textContent, "Command Palette (Ctrl+K)");
sharedWin.dispatchEvent({ type: "mouseenter", target: searchIcon });
assert.strictEqual(tooltipSurface.textContent, "Command Palette (Ctrl+K)", "Visible CDK tooltip must relabel to Command Palette (Ctrl+K)");

// Test [S8]: Teardown when disabled restores native search button & native shortcuts cleanly
cpCtx.sgSetCommandPaletteEnabled(false);
assert.strictEqual(docEl.getAttribute("data-sg-cp-active"), "0");
assert.strictEqual(lsMap.get("sg_cp_active"), "0");
assert.strictEqual(searchBtn.getAttribute("aria-label"), "Tìm kiếm trong các cuộc trò chuyện (Ctrl+Shift+K)", "Original aria-label must be restored");
assert.strictEqual(cdkDesc.textContent, "Tìm kiếm trong các cuộc trò chuyện (Ctrl+Shift+K)", "Original CDK description must be restored");
const evAfterOff = { type: "keydown", ctrlKey: true, shiftKey: true, altKey: false, key: "K", code: "KeyK", timeStamp: 400 };
sharedWin.dispatchEvent(evAfterOff);
assert.strictEqual(geminiNativeSearchCalls, 1, "When Command Palette is disabled, Gemini native shortcut must work again");
const clickAfterOff = { type: "click", target: searchIcon };
sharedWin.dispatchEvent(clickAfterOff);
assert.strictEqual(clickAfterOff._prevented, false, "When disabled, sidebar search click must pass through to Gemini");

console.log("PASS [S1]-[S8]: Native Gemini search neutralized (Ctrl+Shift+K blocked, Ctrl+K won at document_start, sidebar search icon -> Command Palette + tooltip relabel + clean teardown)");
