const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const { ROOT, loadCombinedContentJs } = require("./load-content");

class MiniEvent {
  constructor(type, opts = {}) {
    this.type = type;
    this.bubbles = opts.bubbles !== false;
    this.cancelable = opts.cancelable !== false;
    this.defaultPrevented = false;
    this.propagationStopped = false;
    this.immediatePropagationStopped = false;
    this.target = null;
    this.currentTarget = null;
    this.key = opts.key || "";
    this.code = opts.code || "";
    this.keyCode = opts.keyCode || 0;
    this.shiftKey = Boolean(opts.shiftKey);
    this.altKey = Boolean(opts.altKey);
    this.ctrlKey = Boolean(opts.ctrlKey);
    this.metaKey = Boolean(opts.metaKey);
    this.isComposing = Boolean(opts.isComposing);
    this.relatedTarget = opts.relatedTarget || null;
    this.clientX = typeof opts.clientX === "number" ? opts.clientX : 0;
    this.clientY = typeof opts.clientY === "number" ? opts.clientY : 0;
  }
  preventDefault() {
    if (this.cancelable) this.defaultPrevented = true;
  }
  stopPropagation() {
    this.propagationStopped = true;
  }
  stopImmediatePropagation() {
    this.propagationStopped = true;
    this.immediatePropagationStopped = true;
  }
}

function createMiniDom(options = {}) {
  const { forbidHtmlSinks = false } = options;
  let activeElement = null;

  class ClassList {
    constructor(el) {
      this._el = el;
      this._set = new Set();
    }
    _syncFromString(str) {
      this._set = new Set(String(str || "").trim().split(/\s+/).filter(Boolean));
    }
    add(...cls) { cls.filter(Boolean).forEach(c => this._set.add(c)); }
    remove(...cls) { cls.forEach(c => this._set.delete(c)); }
    contains(c) { return this._set.has(c); }
    toggle(c, force) {
      if (force === undefined) {
        if (this._set.has(c)) { this._set.delete(c); return false; }
        this._set.add(c); return true;
      }
      if (force) { this._set.add(c); return true; }
      this._set.delete(c); return false;
    }
    toString() { return Array.from(this._set).join(" "); }
  }

  class MiniNode {
    constructor(nodeType, tagName = "") {
      this.nodeType = nodeType;
      this.tagName = tagName ? tagName.toUpperCase() : "";
      this.parentElement = null;
      this.parentNode = null;
      this.childNodes = [];
      this.attributes = new Map();
      this.style = {};
      this.classList = new ClassList(this);
      this._listeners = new Map();
      this._text = "";
      this.checked = false;
      this.disabled = false;
      this.hidden = false;
      this.value = "";
      this.tabIndex = 0;
      this.dataset = new Proxy({}, {
        get: (_, prop) => {
          const attr = "data-" + String(prop).replace(/[A-Z]/g, m => "-" + m.toLowerCase());
          return this.attributes.get(attr);
        },
        set: (_, prop, val) => {
          const attr = "data-" + String(prop).replace(/[A-Z]/g, m => "-" + m.toLowerCase());
          this.attributes.set(attr, String(val));
          return true;
        },
        deleteProperty: (_, prop) => {
          const attr = "data-" + String(prop).replace(/[A-Z]/g, m => "-" + m.toLowerCase());
          this.attributes.delete(attr);
          return true;
        }
      });
    }
    get id() { return this.attributes.get("id") || ""; }
    set id(v) { this.attributes.set("id", String(v)); }
    get className() { return this.classList.toString(); }
    set className(v) { this.classList._syncFromString(v); }
    get firstChild() { return this.childNodes[0] || null; }
    get children() { return this.childNodes.filter(c => c.nodeType === 1); }
    get nextElementSibling() {
      if (!this.parentNode) return null;
      const sibs = this.parentNode.children;
      const idx = sibs.indexOf(this);
      return idx >= 0 && idx + 1 < sibs.length ? sibs[idx + 1] : null;
    }
    get isConnected() {
      let cur = this;
      while (cur) {
        if (cur === doc || cur === doc.documentElement) return true;
        cur = cur.parentNode;
      }
      return false;
    }
    get textContent() {
      if (this.nodeType === 3) return this._text;
      return this.childNodes.map(c => c.textContent).join("");
    }
    set textContent(v) {
      if (this.nodeType === 3) { this._text = String(v ?? ""); return; }
      this.childNodes.forEach(c => { c.parentNode = null; c.parentElement = null; });
      this.childNodes = [];
      if (v !== null && v !== undefined && String(v) !== "") {
        const tn = doc.createTextNode(String(v));
        this.appendChild(tn);
      }
    }
    get innerHTML() {
      if (forbidHtmlSinks) throw new Error("FORBIDDEN_HTML_SINK: innerHTML read");
      return "";
    }
    set innerHTML(_v) {
      if (forbidHtmlSinks) throw new Error("FORBIDDEN_HTML_SINK: innerHTML write");
    }
    set outerHTML(_v) {
      if (forbidHtmlSinks) throw new Error("FORBIDDEN_HTML_SINK: outerHTML write");
    }
    insertAdjacentHTML() {
      if (forbidHtmlSinks) throw new Error("FORBIDDEN_HTML_SINK: insertAdjacentHTML");
    }
    setAttribute(k, v) {
      if (k === "class") this.className = v;
      else if (k === "tabindex") this.tabIndex = Number(v);
      this.attributes.set(k, String(v));
    }
    getAttribute(k) {
      if (k === "class") return this.className;
      return this.attributes.has(k) ? this.attributes.get(k) : null;
    }
    hasAttribute(k) { return this.attributes.has(k); }
    removeAttribute(k) {
      if (k === "class") this.className = "";
      this.attributes.delete(k);
    }
    appendChild(child) {
      if (child.parentNode) child.parentNode.removeChild(child);
      child.parentNode = this;
      child.parentElement = this.nodeType === 1 ? this : null;
      this.childNodes.push(child);
      return child;
    }
    insertBefore(child, ref) {
      if (!ref) return this.appendChild(child);
      if (child.parentNode) child.parentNode.removeChild(child);
      const idx = this.childNodes.indexOf(ref);
      child.parentNode = this;
      child.parentElement = this.nodeType === 1 ? this : null;
      if (idx === -1) this.childNodes.push(child);
      else this.childNodes.splice(idx, 0, child);
      return child;
    }
    removeChild(child) {
      const idx = this.childNodes.indexOf(child);
      if (idx >= 0) {
        this.childNodes.splice(idx, 1);
        child.parentNode = null;
        child.parentElement = null;
      }
      return child;
    }
    remove() {
      if (this.parentNode) this.parentNode.removeChild(this);
    }
    cloneNode(deep = false) {
      if (this.nodeType === 3) return doc.createTextNode(this._text);
      const copy = new MiniNode(1, this.tagName);
      for (const [k, v] of this.attributes.entries()) copy.attributes.set(k, v);
      copy.className = this.className;
      if (deep) {
        for (const ch of this.childNodes) copy.appendChild(ch.cloneNode(true));
      }
      return copy;
    }
    contains(other) {
      let cur = other;
      while (cur) {
        if (cur === this) return true;
        cur = cur.parentNode;
      }
      return false;
    }
    focus() { activeElement = this; }
    getBoundingClientRect() {
      if (this._rect) return this._rect;
      if (this.id === "sg-periodic-model-panel") return { left: 100, top: 100, right: 960, bottom: 560, width: 860, height: 460 };
      if (this.id === "sg-periodic-popover") return { left: 0, top: 0, right: 240, bottom: 130, width: 240, height: 130 };
      return { left: 400, top: 680, right: 510, bottom: 716, width: 110, height: 36 };
    }
    addEventListener(type, fn, opts) {
      const capture = typeof opts === "boolean" ? opts : Boolean(opts && opts.capture);
      const key = `${type}:${capture ? "cap" : "bub"}`;
      if (!this._listeners.has(key)) this._listeners.set(key, []);
      const arr = this._listeners.get(key);
      if (!arr.includes(fn)) arr.push(fn);
    }
    removeEventListener(type, fn, opts) {
      const capture = typeof opts === "boolean" ? opts : Boolean(opts && opts.capture);
      const key = `${type}:${capture ? "cap" : "bub"}`;
      const arr = this._listeners.get(key);
      if (!arr) return;
      const idx = arr.indexOf(fn);
      if (idx >= 0) arr.splice(idx, 1);
    }
    dispatchEvent(ev) {
      ev.target = this;
      const chain = [];
      let cur = this;
      while (cur) { chain.push(cur); cur = cur.parentNode; }
      if (chain[chain.length - 1] !== doc) chain.push(doc);

      for (let i = chain.length - 1; i >= 0; i--) {
        const node = chain[i];
        const list = (node._listeners.get(`${ev.type}:cap`) || []).slice();
        for (const fn of list) {
          ev.currentTarget = node;
          fn.call(node, ev);
          if (ev.immediatePropagationStopped) return !ev.defaultPrevented;
        }
        if (ev.propagationStopped) return !ev.defaultPrevented;
      }

      for (let i = 0; i < chain.length; i++) {
        const node = chain[i];
        const list = (node._listeners.get(`${ev.type}:bub`) || []).slice();
        for (const fn of list) {
          ev.currentTarget = node;
          fn.call(node, ev);
          if (ev.immediatePropagationStopped) return !ev.defaultPrevented;
        }
        if (ev.propagationStopped || !ev.bubbles) break;
      }
      return !ev.defaultPrevented;
    }
    click() {
      const ev = new MiniEvent("click", { bubbles: true, cancelable: true });
      this.dispatchEvent(ev);
    }
    matches(selector) {
      return selector.split(",").some(part => matchesSingle(this, part.trim()));
    }
    closest(selector) {
      let cur = this;
      while (cur && cur.nodeType === 1) {
        if (cur.matches(selector)) return cur;
        cur = cur.parentElement;
      }
      return null;
    }
    querySelectorAll(selector) {
      const parts = selector.split(",").map(s => s.trim()).filter(Boolean);
      const out = [];
      const visit = node => {
        for (const ch of node.children) {
          if (parts.some(p => matchesSelectorChain(ch, p, this))) out.push(ch);
          visit(ch);
        }
      };
      visit(this);
      return out;
    }
    querySelector(selector) {
      return this.querySelectorAll(selector)[0] || null;
    }
  }

  function matchesSingle(el, sel) {
    if (!el || el.nodeType !== 1) return false;
    let rest = sel;
    const attrMatches = [];
    rest = rest.replace(/\[([^\]=^$*]+)(?:([^*$]?=)["']([^"']*)["'])?\]/g, (_, k, op, v) => {
      attrMatches.push([k.trim(), op || "", v]);
      return "";
    });
    const idMatch = rest.match(/#([a-zA-Z0-9_-]+)/);
    if (idMatch) {
      if (el.id !== idMatch[1]) return false;
      rest = rest.replace(idMatch[0], "");
    }
    const clsMatches = [...rest.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map(m => m[1]);
    rest = rest.replace(/\.[a-zA-Z0-9_-]+/g, "");
    const tag = rest.trim().toLowerCase();
    if (tag && tag !== "*" && el.tagName.toLowerCase() !== tag) return false;
    for (const c of clsMatches) {
      if (!el.classList.contains(c)) return false;
    }
    for (const [k, op, v] of attrMatches) {
      const actual = el.getAttribute(k);
      if (!op) {
        if (!el.hasAttribute(k)) return false;
      } else if (op === "=") {
        if (actual !== v) return false;
      } else if (op === "^=") {
        if (actual === null || !actual.startsWith(v)) return false;
      } else if (op === "*=") {
        if (actual === null || !actual.includes(v)) return false;
      } else if (op === "$=") {
        if (actual === null || !actual.endsWith(v)) return false;
      }
    }
    return true;
  }

  function matchesSelectorChain(el, sel, scopeRoot) {
    if (sel.startsWith(":scope >")) {
      const target = sel.slice(":scope >".length).trim();
      return el.parentElement === scopeRoot && matchesSingle(el, target);
    }
    const tokens = sel.split(/\s+/).filter(Boolean);
    if (tokens.length === 1) return matchesSingle(el, tokens[0]);
    if (!matchesSingle(el, tokens[tokens.length - 1])) return false;
    let cur = el.parentElement;
    for (let i = tokens.length - 2; i >= 0; i--) {
      if (tokens[i] === ">") {
        i--;
        if (!cur || !matchesSingle(cur, tokens[i])) return false;
        cur = cur.parentElement;
      } else {
        while (cur && !matchesSingle(cur, tokens[i])) cur = cur.parentElement;
        if (!cur) return false;
        cur = cur.parentElement;
      }
    }
    return true;
  }

  const doc = new MiniNode(9, "#document");
  doc.documentElement = new MiniNode(1, "html");
  doc.body = new MiniNode(1, "body");
  doc.body.className = "dark-theme";
  doc.appendChild(doc.documentElement);
  doc.documentElement.appendChild(doc.body);
  doc.createElement = tag => new MiniNode(1, tag);
  doc.createElementNS = (_ns, tag) => new MiniNode(1, tag);
  doc.createTextNode = txt => {
    const n = new MiniNode(3, "");
    n._text = String(txt ?? "");
    return n;
  };
  doc.getElementById = id => doc.querySelector(`#${id}`);
  doc.write = () => {
    if (forbidHtmlSinks) throw new Error("FORBIDDEN_HTML_SINK: document.write");
  };
  Object.defineProperty(doc, "activeElement", { get: () => activeElement });

  return { doc, MiniEvent, getActiveElement: () => activeElement };
}

async function runPopupVmTests() {
  const popupHtml = fs.readFileSync(path.join(ROOT, "popup.html"), "utf8");
  const popupJs = fs.readFileSync(path.join(ROOT, "popup.js"), "utf8");

  function runWithStorage(initialSync) {
    const { doc, MiniEvent } = createMiniDom();
    let syncGetCalls = [];
    let syncSetCalls = [];
    let sentMessages = [];

    // Build realistic minimal popup DOM from popup.html
    const masterSec = doc.createElement("div");
    masterSec.className = "master-toggle-section";
    const masterRow = doc.createElement("div");
    masterRow.className = "toggle-row";
    masterRow.textContent = "Enable Gemini Power Suite";
    const masterInput = doc.createElement("input");
    masterInput.id = "master-toggle";
    masterRow.appendChild(masterInput);
    masterSec.appendChild(masterRow);
    doc.body.appendChild(masterSec);

    const searchInput = doc.createElement("input");
    searchInput.id = "sg-popup-search";
    const searchClear = doc.createElement("button");
    searchClear.id = "sg-popup-search-clear";
    const noResults = doc.createElement("div");
    noResults.id = "sg-popup-no-results";
    doc.body.appendChild(searchInput);
    doc.body.appendChild(searchClear);
    doc.body.appendChild(noResults);

    // Parse sections and toggle-rows from popup.html
    const secRegex = /<div class="settings-section" id="([^"]+)">\s*<h3>([^<]+)<\/h3>([\s\S]*?)(?=<div class="settings-section"|<!-- Footer|<footer|<div class="footer"|$)/g;
    let m;
    while ((m = secRegex.exec(popupHtml)) !== null) {
      const sec = doc.createElement("div");
      sec.className = "settings-section";
      sec.id = m[1];
      const h3 = doc.createElement("h3");
      h3.textContent = m[2];
      sec.appendChild(h3);

      const rowRegex = /<div class="toggle-row[^"]*"\s*data-tooltip="([^"]*)"[^>]*>[\s\S]*?<label for="([^"]+)">([^<]+)<\/label>[\s\S]*?<input[^>]*id="([^"]+)"/g;
      let rm;
      while ((rm = rowRegex.exec(m[3])) !== null) {
        const row = doc.createElement("div");
        row.className = "toggle-row";
        row.setAttribute("data-tooltip", rm[1]);
        const lbl = doc.createElement("label");
        lbl.textContent = rm[3];
        const inp = doc.createElement("input");
        inp.id = rm[4];
        row.appendChild(lbl);
        row.appendChild(inp);
        sec.appendChild(row);
      }
      doc.body.appendChild(sec);
    }

    // Add remaining known IDs (segmented control, buttons, modals, keybinds)
    for (const id of [
      "open-skills-manager-btn", "drive-sync-toggle", "drive-sync-row",
      "drive-sync-status", "optimize-model-seg", "view-guide-btn",
      "reset-btn", "warn-modal", "warn-confirm-btn", "warn-cancel-btn",
      "sg-popup-tooltip",
      "open-keybinds-btn", "keybinds-modal", "keybinds-close-btn",
      "keybinds-done-btn", "keybinds-reset-all-btn", "keybinds-search",
      "keybinds-status", "keybinds-list"
    ]) {
      if (!doc.getElementById(id)) {
        const el = doc.createElement("div");
        el.id = id;
        doc.body.appendChild(el);
      }
    }
    const kbModal = doc.getElementById("keybinds-modal");
    if (kbModal) kbModal.style.display = "none";

    const store = Object.assign({}, initialSync);
    const chrome = {
      storage: {
        sync: {
          get(keys, cb) {
            syncGetCalls.push(Array.isArray(keys) ? keys.slice() : keys);
            const res = {};
            const list = Array.isArray(keys) ? keys : Object.keys(store);
            for (const k of list) if (k in store) res[k] = store[k];
            cb(res);
          },
          set(obj, cb) {
            syncSetCalls.push(obj);
            Object.assign(store, obj);
            if (cb) cb();
          }
        },
        local: { get: (_k, cb) => cb && cb({}), set: (_o, cb) => cb && cb() }
      },
      tabs: {
        query(_q, cb) { cb([{ id: 7, url: "https://gemini.google.com/app" }]); },
        sendMessage(tabId, msg) {
          sentMessages.push({ tabId, msg });
          return Promise.resolve();
        },
        create() {},
        update() {}
      },
      runtime: {
        lastError: null,
        sendMessage(_m, cb) { if (cb) cb({ configured: true }); },
        getURL: p => p
      },
      permissions: { contains: (_p, cb) => cb(true) },
      windows: { update() {} }
    };

    const windowObj = {
      addEventListener() {},
      removeEventListener() {},
      close() {},
      innerWidth: 400,
      innerHeight: 600
    };

    const ctx = vm.createContext({
      document: doc,
      window: windowObj,
      chrome,
      console,
      setTimeout,
      clearTimeout
    });

    vm.runInContext(popupJs, ctx);
    doc.dispatchEvent(new MiniEvent("DOMContentLoaded"));

    return { doc, MiniEvent, syncGetCalls, syncSetCalls, sentMessages, store };
  }

  // 1. Default unset state
  const r1 = runWithStorage({});
  assert.strictEqual(r1.syncGetCalls.length, 1, "OPT-009: popup must perform exactly 1 batched chrome.storage.sync.get");
  assert.ok(r1.syncGetCalls[0].includes("periodicModelPickerEnabled"), "ALL_POPUP_SYNC_KEYS must include periodicModelPickerEnabled");
  const toggle = r1.doc.getElementById("periodic-model-picker-toggle");
  assert.ok(toggle, "periodic-model-picker-toggle must exist in popup DOM");
  assert.strictEqual(toggle.checked, false, "periodicModelPickerEnabled must default to OFF (false)");
  assert.strictEqual(r1.doc.getElementById("skills-injection-toggle").checked, false, "skillsInjectionEnabled must default to OFF (false)");
  assert.strictEqual(r1.doc.getElementById("baseline-injection-toggle").checked, false, "baselineInjectionEnabled must default to OFF (false)");
  assert.strictEqual(r1.doc.getElementById("hide-gems-button-toggle").checked, true, "hideGemsSidebarButton must default to ON (true)");

  // 2. Toggle ON -> writes true & sends ENABLE_PERIODIC_MODEL_PICKER
  toggle.checked = true;
  toggle.dispatchEvent(new r1.MiniEvent("change"));
  assert.deepStrictEqual({ ...r1.syncSetCalls[r1.syncSetCalls.length - 1] }, { periodicModelPickerEnabled: true });
  assert.strictEqual(r1.sentMessages[r1.sentMessages.length - 1].msg.type, "ENABLE_PERIODIC_MODEL_PICKER");

  // 3. Toggle OFF -> writes false & sends DISABLE_PERIODIC_MODEL_PICKER
  toggle.checked = false;
  toggle.dispatchEvent(new r1.MiniEvent("change"));
  assert.deepStrictEqual({ ...r1.syncSetCalls[r1.syncSetCalls.length - 1] }, { periodicModelPickerEnabled: false });
  assert.strictEqual(r1.sentMessages[r1.sentMessages.length - 1].msg.type, "DISABLE_PERIODIC_MODEL_PICKER");

  // 4. Popup search filter OPT-010 finds Model Periodic Table
  const searchInput = r1.doc.getElementById("sg-popup-search");
  searchInput.value = "periodic";
  searchInput.dispatchEvent(new r1.MiniEvent("input"));
  const periodicRow = toggle.closest(".toggle-row");
  assert.strictEqual(periodicRow.classList.contains("sg-popup-hidden"), false, "Popup search should show Model Periodic Table");

  // 5. Hydrate when explicitly enabled in storage
  const r2 = runWithStorage({ periodicModelPickerEnabled: true });
  assert.strictEqual(r2.syncGetCalls.length, 1);
  assert.strictEqual(r2.doc.getElementById("periodic-model-picker-toggle").checked, true);

  // 6. Keybinds Manager modal: 17 rows, validation, record Ctrl+Alt+K, conflict warning, toggle & reset
  assert.ok(r1.syncGetCalls[0].includes("optimizeShortcut"), "ALL_POPUP_SYNC_KEYS must include optimizeShortcut");
  assert.ok(r1.syncGetCalls[0].includes("grammarShortcut"), "ALL_POPUP_SYNC_KEYS must include grammarShortcut");
  assert.ok(r1.syncGetCalls[0].includes("focusShortcutEnabled"), "ALL_POPUP_SYNC_KEYS must include focusShortcutEnabled");
  assert.strictEqual(r1.doc.getElementById("focus-shortcut-toggle").checked, true, "focusShortcutEnabled must default to ON (true)");

  const openKbBtn = r1.doc.getElementById("open-keybinds-btn");
  const kbModalEl = r1.doc.getElementById("keybinds-modal");
  const kbListEl = r1.doc.getElementById("keybinds-list");
  openKbBtn.click();
  assert.strictEqual(kbModalEl.style.display, "flex", "Customize button must open keybinds modal");
  const kbRows = kbListEl.querySelectorAll(".sg-kb-row");
  assert.strictEqual(kbRows.length, 17, "Keybinds modal must render all 17 rebindable shortcuts");

  const optRecBtn = kbListEl.querySelector('[data-sg-kb-record="optimizeShortcut"]');
  assert.strictEqual(optRecBtn.textContent, "Alt+O");
  optRecBtn.click();

  const setsBeforeInvalid = r1.syncSetCalls.length;
  r1.doc.dispatchEvent(new r1.MiniEvent("keydown", { key: "a", code: "KeyA" }));
  assert.strictEqual(r1.syncSetCalls.length, setsBeforeInvalid, "Bare letter keybind must be rejected");
  assert.ok(r1.doc.getElementById("keybinds-status").classList.contains("is-error"), "Bare keybind must show validation error");

  r1.doc.dispatchEvent(new r1.MiniEvent("keydown", { key: "A", code: "KeyA", shiftKey: true }));
  assert.strictEqual(r1.syncSetCalls.length, setsBeforeInvalid, "Shift-only printable keybind must be rejected");

  r1.doc.dispatchEvent(new r1.MiniEvent("keydown", { key: "k", code: "KeyK", ctrlKey: true, altKey: true }));
  assert.deepStrictEqual(
    JSON.parse(JSON.stringify(r1.syncSetCalls[r1.syncSetCalls.length - 1])),
    { optimizeShortcut: { key: "k", alt: true, ctrl: true, shift: false, meta: false } }
  );
  assert.strictEqual(kbListEl.querySelector('[data-sg-kb-record="optimizeShortcut"]').textContent, "Ctrl+Alt+K");

  // Re-record conflicting Alt+F (same as Open Folders)
  kbListEl.querySelector('[data-sg-kb-record="optimizeShortcut"]').click();
  r1.doc.dispatchEvent(new r1.MiniEvent("keydown", { key: "f", code: "KeyF", altKey: true }));
  const optRowConflict = kbListEl.querySelector('[data-sg-kb-key="optimizeShortcut"]');
  assert.ok(optRowConflict.classList.contains("is-conflict"), "Overlapping Alt+F keybind must flag conflict row");
  assert.ok(r1.doc.getElementById("keybinds-status").classList.contains("is-warn"), "Conflict must warn in keybinds status banner");

  // Toggle disabled
  const optToggle = kbListEl.querySelector('[data-sg-kb-toggle="optimizeShortcut"]');
  optToggle.checked = false;
  optToggle.dispatchEvent(new r1.MiniEvent("change"));
  assert.deepStrictEqual(
    JSON.parse(JSON.stringify(r1.syncSetCalls[r1.syncSetCalls.length - 1])),
    { optimizeShortcutEnabled: false }
  );

  // Per-row reset restores Alt+O & enabled: true
  kbListEl.querySelector('[data-sg-kb-reset="optimizeShortcut"]').click();
  assert.deepStrictEqual(
    JSON.parse(JSON.stringify(r1.syncSetCalls[r1.syncSetCalls.length - 1])),
    { optimizeShortcut: { key: "o", alt: true, ctrl: false, shift: false, meta: false }, optimizeShortcutEnabled: true }
  );
  assert.strictEqual(kbListEl.querySelector('[data-sg-kb-record="optimizeShortcut"]').textContent, "Alt+O");

  // Reset All restores every shortcut in a single sync.set batch
  r1.doc.getElementById("keybinds-reset-all-btn").click();
  const resetAllPayload = r1.syncSetCalls[r1.syncSetCalls.length - 1];
  assert.strictEqual(Object.keys(resetAllPayload).length, 34, "Reset All must reset all 17 shortcuts + 17 enabled flags in 1 batch");

  console.log("PASS: Popup VM suite (single sync.get, default OFF, toggle ON/OFF messaging, search filter, enabled hydration, keybinds manager)");
}

async function runContentPeriodicVmTests() {
  const contentJs = loadCombinedContentJs();

  // Extract real production functions from content.js
  function sliceBetween(startMarker, endMarker) {
    const s = contentJs.indexOf(startMarker);
    assert.ok(s >= 0, `Start marker not found: ${startMarker}`);
    const e = endMarker ? contentJs.indexOf(endMarker, s + startMarker.length) : contentJs.length;
    assert.ok(e > s, `End marker not found: ${endMarker}`);
    return contentJs.slice(s, e);
  }

  function extractFunc(name) {
    const start = contentJs.indexOf(`function ${name}(`);
    assert.ok(start >= 0, `Function not found: ${name}`);
    let brace = contentJs.indexOf("{", start);
    let depth = 0;
    for (let i = brace; i < contentJs.length; i++) {
      if (contentJs[i] === "{") depth++;
      else if (contentJs[i] === "}") {
        depth--;
        if (depth === 0) return contentJs.slice(start, i + 1);
      }
    }
    throw new Error(`Unclosed function: ${name}`);
  }

  const imeFn = extractFunc("sgIsImeComposing");
  const parseModeFn = extractFunc("parseModeFromButtonText");
  const nativeTextFn = extractFunc("sgGetNativeModeButtonText");
  const periodicModule = sliceBetween("const SG_PERIODIC_STORAGE_KEY", null);

  // Extract the exact periodic cases from handleRuntimeMessage to verify message parity
  assert.ok(contentJs.includes('case "ENABLE_PERIODIC_MODEL_PICKER":'), "Missing ENABLE_PERIODIC_MODEL_PICKER case");
  assert.ok(contentJs.includes('case "DISABLE_PERIODIC_MODEL_PICKER":'), "Missing DISABLE_PERIODIC_MODEL_PICKER case");
  assert.ok(contentJs.includes('if ("SHOW_TOAST" !== e.type) return handleRuntimeMessage(e), !1;'), "BUG-007 synchronous return !1 broken");

  function createRuntime(initialSync = {}) {
    const { doc, MiniEvent, getActiveElement } = createMiniDom({ forbidHtmlSinks: true });

    // Create realistic Gemini mode button
    const modeBtn = doc.createElement("div");
    modeBtn.setAttribute("data-test-id", "bard-mode-menu-button");
    const innerBtn = doc.createElement("button");
    innerBtn.className = "input-area-switch";
    const pillContainer = doc.createElement("div");
    pillContainer.className = "logo-pill-label-container";
    const nativeSpan = doc.createElement("span");
    nativeSpan.textContent = "Fast";
    pillContainer.appendChild(nativeSpan);
    innerBtn.appendChild(pillContainer);
    modeBtn.appendChild(innerBtn);
    doc.body.appendChild(modeBtn);

    let nativeClickCount = 0;
    innerBtn.addEventListener("click", () => { nativeClickCount++; });

    const lsMap = new Map();
    const localStorage = {
      getItem: k => (lsMap.has(k) ? lsMap.get(k) : null),
      setItem: (k, v) => lsMap.set(k, String(v)),
      removeItem: k => lsMap.delete(k)
    };

    let syncSetCalls = 0;
    let onChangedListeners = [];
    const chrome = {
      storage: {
        sync: {
          get(keys, cb) {
            const out = {};
            const arr = Array.isArray(keys) ? keys : Object.keys(initialSync);
            for (const k of arr) if (k in initialSync) out[k] = initialSync[k];
            cb(out);
          },
          set() { syncSetCalls++; }
        },
        onChanged: {
          addListener(fn) { onChangedListeners.push(fn); }
        }
      }
    };

    const switchedModes = [];
    const thinkingLevels = [];
    let bypassClickDuringSwitchMode = null;
    let bypassClickDuringThinking = null;
    let nativeClicksDuringSwitch = 0;
    const registeredRefreshers = new Set();

    const timers = [];
    const fakeSetTimeout = (fn, ms) => {
      const t = { fn, ms, cleared: false };
      timers.push(t);
      return t;
    };
    const fakeClearTimeout = t => { if (t) t.cleared = true; };
    const flushTimers = (filterMs = null) => {
      const pending = timers.slice();
      timers.length = 0;
      for (const t of pending) {
        if (t.cleared) continue;
        if (filterMs !== null && t.ms > filterMs) { timers.push(t); continue; }
        t.fn();
      }
    };

    const ctx = vm.createContext({
      document: doc,
      window: { innerWidth: 1280, innerHeight: 800, location: { pathname: "/app" }, addEventListener() {}, removeEventListener() {} },
      localStorage,
      chrome,
      console,
      setTimeout: fakeSetTimeout,
      clearTimeout: fakeClearTimeout,
      setInterval: (fn, ms) => fakeSetTimeout(fn, ms),
      clearInterval: fakeClearTimeout,
      isExtensionEnabled: initialSync.extensionEnabled !== false,
      sgObserverRegistry: {
        registerUIRefresh: name => registeredRefreshers.add(name),
        unregisterUIRefresh: name => registeredRefreshers.delete(name)
      },
      switchModeSilent(mode) {
        switchedModes.push(mode);
        bypassClickDuringSwitchMode = vm.runInContext("_sgPeriodicBypassClick", ctx);
        const before = nativeClickCount;
        // Simulate Gemini switchModeSilent clicking the mode button internally
        const ev = new MiniEvent("click", { bubbles: true, cancelable: true });
        innerBtn.dispatchEvent(ev);
        assert.strictEqual(ev.defaultPrevented, false, "Bypass guard MUST prevent self-interception during switchModeSilent");
        nativeClicksDuringSwitch += (nativeClickCount - before);
      },
      async setThinkingLevel(lvl) {
        thinkingLevels.push(lvl);
        bypassClickDuringThinking = vm.runInContext("_sgPeriodicBypassClick", ctx);
      }
    });

    // Run actual extracted functions (prevent auto-init before we inspect if needed, or let auto-init run!)
    vm.runInContext(imeFn + "\n" + parseModeFn + "\n" + nativeTextFn + "\n" + periodicModule, ctx);

    return {
      ctx, doc, MiniEvent, modeBtn, innerBtn, nativeSpan,
      getNativeClickCount: () => nativeClickCount,
      getSyncSetCalls: () => syncSetCalls,
      getSwitchedModes: () => switchedModes,
      getThinkingLevels: () => thinkingLevels,
      getBypassDuringSwitch: () => bypassClickDuringSwitchMode,
      getBypassDuringThinking: () => bypassClickDuringThinking,
      getNativeClicksDuringSwitch: () => nativeClicksDuringSwitch,
      getRegisteredRefreshers: () => registeredRefreshers,
      fireStorageChange: (changes, area = "sync") => onChangedListeners.forEach(fn => fn(changes, area)),
      flushTimers,
      getActiveElement,
      localStorage
    };
  }

  // === CHECK A: Default OFF & Zero Cost ===
  const rOff = createRuntime({});
  assert.strictEqual(vm.runInContext("isPeriodicModelPickerEnabled", rOff.ctx), false, "Default must be OFF");
  assert.strictEqual(rOff.doc.getElementById("sg-periodic-model-panel"), null, "0 panel DOM when OFF");
  assert.strictEqual(rOff.doc.querySelectorAll(".sg-periodic-tile").length, 0, "0 tile DOM when OFF");
  const offClick = new rOff.MiniEvent("click", { bubbles: true, cancelable: true });
  rOff.innerBtn.dispatchEvent(offClick);
  assert.strictEqual(offClick.defaultPrevented, false, "Click must NOT be intercepted when OFF");
  assert.strictEqual(rOff.getNativeClickCount(), 1, "Native click handler must run when OFF");
  assert.strictEqual(rOff.modeBtn.getAttribute("data-sg-periodic-active"), null);
  console.log("PASS [A]: Default OFF -> 0 grid DOM, 0 click interception, 0 pill override");

  // === CHECK B: extensionEnabled === false ===
  const rExtOff = createRuntime({ extensionEnabled: false, periodicModelPickerEnabled: true });
  assert.strictEqual(rExtOff.doc.getElementById("sg-periodic-model-panel"), null, "0 panel DOM when extensionEnabled=false");
  const extOffClick = new rExtOff.MiniEvent("click", { bubbles: true, cancelable: true });
  rExtOff.innerBtn.dispatchEvent(extOffClick);
  assert.strictEqual(extOffClick.defaultPrevented, false, "Click must NOT be intercepted when extensionEnabled=false");
  assert.strictEqual(rExtOff.getNativeClickCount(), 1);
  console.log("PASS [B]: extensionEnabled=false -> 0 DOM, 0 interception even if periodicModelPickerEnabled=true");

  // === CHECK C: 118-Element IUPAC Data Integrity & Zero Collisions ===
  const elements = vm.runInContext("SG_PERIODIC_ELEMENTS", rOff.ctx);
  const bySym = vm.runInContext("SG_PERIODIC_BY_SYMBOL", rOff.ctx);
  assert.strictEqual(elements.length, 118, "Must have 118 elements");
  assert.strictEqual(bySym.size, 118, "Must have 118 unique symbols");
  const zSet = new Set();
  const nameSet = new Set();
  const coordSet = new Set();
  const releasedSyms = [];
  for (const [z, sym, name, group, period] of elements) {
    assert.ok(Number.isInteger(z) && z >= 1 && z <= 118, `Invalid atomic number ${z}`);
    assert.ok(!zSet.has(z), `Duplicate atomic number ${z}`);
    zSet.add(z);
    assert.ok(name && !nameSet.has(name), `Duplicate/empty name ${name}`);
    nameSet.add(name);
    assert.ok(group >= 1 && group <= 18, `Invalid group ${group} for ${sym}`);
    assert.ok((period >= 1 && period <= 7) || period === 8 || period === 9, `Invalid period ${period} for ${sym}`);
    const gridCol = group + 1;
    const gridRow = period <= 7 ? period + 1 : (period === 8 ? 10 : 11);
    const coord = `${gridCol},${gridRow}`;
    assert.ok(!coordSet.has(coord), `Grid collision at ${coord} for ${sym}`);
    coordSet.add(coord);
    // Ensure no overlap with hero (col 4..13, row 2..4) or placeholders (4,7) & (4,8)
    assert.ok(!(gridCol >= 4 && gridCol <= 13 && gridRow >= 2 && gridRow <= 4), `Hero overlap for ${sym}`);
    assert.ok(coord !== "4,7" && coord !== "4,8", `Placeholder overlap for ${sym}`);
    if (bySym.get(sym).released) releasedSyms.push(sym);
  }
  assert.deepStrictEqual(releasedSyms, ["H", "C", "Ar"], "Exactly H, C, Ar must be released");
  assert.strictEqual(bySym.get("H").realMode, "fast");
  assert.strictEqual(bySym.get("C").realMode, "pro");
  assert.strictEqual(bySym.get("Ar").realMode, "thinking");
  console.log("PASS [C]: 118 unique IUPAC elements (1..118), 3 released (H/C/Ar), 0 grid/hero/placeholder collisions");

  // === CHECK D: Lazy Build, Open, Hover Popover, Thinking Level Radiogroup, Bridge & Bypass ===
  const rOn = createRuntime({});
  vm.runInContext("sgSetPeriodicModelPickerEnabled(true)", rOn.ctx);
  // Still lazy: 0 DOM before first click!
  assert.strictEqual(rOn.doc.getElementById("sg-periodic-model-panel"), null, "Panel must be lazy-built only on first open");
  assert.ok(rOn.getRegisteredRefreshers().has("periodicModelLabel"));

  // Click mode button -> builds panel lazily and opens
  const openEv = new rOn.MiniEvent("click", { bubbles: true, cancelable: true });
  rOn.innerBtn.dispatchEvent(openEv);
  assert.strictEqual(openEv.defaultPrevented, true, "Click must be intercepted when enabled");
  assert.strictEqual(rOn.getNativeClickCount(), 0, "Native handler must not run on intercepted user click");

  const panel = rOn.doc.getElementById("sg-periodic-model-panel");
  assert.ok(panel, "Panel must exist after first open");
  assert.strictEqual(panel.getAttribute("role"), "dialog");
  assert.strictEqual(panel.getAttribute("aria-modal"), "false");
  assert.strictEqual(panel.getAttribute("aria-label"), "Model periodic table");
  assert.ok(panel.classList.contains("sg-periodic-open"));
  const tiles = panel.querySelectorAll(".sg-periodic-tile");
  assert.strictEqual(tiles.length, 118, "Panel must contain exactly 118 tile buttons");
  const pills = panel.querySelectorAll(".sg-periodic-other-pill");
  assert.strictEqual(pills.length, 2, "Footer must contain 2 Other models pills");

  // Hover Carbon (C) tile -> popover appears with 3-button Thinking level radiogroup
  const tileC = tiles.find(t => t.dataset.symbol === "C");
  assert.ok(tileC);
  tileC.dispatchEvent(new rOn.MiniEvent("mouseenter"));
  const pop = rOn.doc.getElementById("sg-periodic-popover");
  assert.ok(pop && pop.classList.contains("sg-periodic-visible"), "Popover must be visible on hover");
  assert.ok(pop.textContent.includes("Gemini 4 Carbon"));
  assert.ok(pop.textContent.includes("Most complex work"));
  const radios = pop.querySelectorAll('[role="radio"]');
  assert.strictEqual(radios.length, 3, "Released popover must have Low/Medium/High radios");
  assert.strictEqual(radios[1].getAttribute("aria-checked"), "true", "Default level should be Medium");

  // Keyboard ArrowRight moves checked/focus from Medium -> High
  radios[1].dispatchEvent(new rOn.MiniEvent("keydown", { key: "ArrowRight" }));
  assert.strictEqual(radios[2].getAttribute("aria-checked"), "true");
  assert.strictEqual(rOn.getActiveElement(), radios[2]);

  // Click High radio -> selects Carbon with High thinking level
  radios[2].click();
  assert.strictEqual(panel.classList.contains("sg-periodic-open"), false, "Panel closes after selection");
  assert.deepStrictEqual(rOn.getSwitchedModes(), ["pro"], "Carbon must bridge to real pro mode");
  assert.strictEqual(rOn.getBypassDuringSwitch(), true, "_sgPeriodicBypassClick must be true during switchModeSilent");
  assert.strictEqual(rOn.getNativeClicksDuringSwitch(), 1, "Programmatic click inside switchModeSilent must pass through un-intercepted");
  assert.strictEqual(rOn.modeBtn.getAttribute("data-sg-periodic-active"), "true");
  assert.strictEqual(rOn.modeBtn.querySelector('[data-sg-periodic-label="true"]').textContent, "Carbon");

  // Flush 0ms bypass reset & 450ms thinking level timer
  rOn.flushTimers(0);
  assert.strictEqual(vm.runInContext("_sgPeriodicBypassClick", rOn.ctx), false, "Bypass flag must reset after macrotask");
  rOn.flushTimers(500);
  assert.deepStrictEqual(rOn.getThinkingLevels(), ["high"], "Thinking level bridge must invoke setThinkingLevel('high')");
  assert.strictEqual(rOn.getBypassDuringThinking(), true);
  assert.strictEqual(rOn.getSyncSetCalls(), 0, "NEW-BUG-001: 0 chrome.storage.sync.set calls on selection");
  const saved = JSON.parse(rOn.localStorage.getItem("sg_periodic_model_state"));
  assert.strictEqual(saved.symbol, "C");
  assert.strictEqual(saved.thinkingLevel, "high");

  // Also verify H -> fast and Ar -> thinking, and panel instance is reused (lazy built once)
  rOn.innerBtn.dispatchEvent(new rOn.MiniEvent("click", { bubbles: true, cancelable: true }));
  assert.strictEqual(rOn.doc.getElementById("sg-periodic-model-panel"), panel, "Panel instance must be reused");
  tiles.find(t => t.dataset.symbol === "H").click();
  rOn.flushTimers(0);
  assert.deepStrictEqual(rOn.getSwitchedModes(), ["pro", "fast"]);
  assert.strictEqual(rOn.modeBtn.querySelector('[data-sg-periodic-label="true"]').textContent, "Hydrogen");

  rOn.innerBtn.dispatchEvent(new rOn.MiniEvent("click", { bubbles: true, cancelable: true }));
  tiles.find(t => t.dataset.symbol === "Ar").click();
  rOn.flushTimers(0);
  assert.deepStrictEqual(rOn.getSwitchedModes(), ["pro", "fast", "thinking"]);
  assert.strictEqual(rOn.modeBtn.querySelector('[data-sg-periodic-label="true"]').textContent, "Argon");
  console.log("PASS [D]: Lazy build, 118 tiles, popover radiogroup + ArrowRight, H/C/Ar bridge, bypass guard, 0 sync writes, 0 HTML sinks");

  // === CHECK E: Coming Soon Cosmetic Preview & Mode-Text Observer Isolation ===
  rOn.innerBtn.dispatchEvent(new rOn.MiniEvent("click", { bubbles: true, cancelable: true }));
  assert.ok(panel.classList.contains("sg-periodic-open"), "Panel must reopen before hovering Cd");
  const tileCd = tiles.find(t => t.dataset.symbol === "Cd");
  tileCd.dispatchEvent(new rOn.MiniEvent("mouseenter"));
  assert.strictEqual(pop.querySelectorAll('[role="radio"]').length, 0, "Coming soon popover must not show thinking level radios");
  assert.ok(pop.textContent.includes("Cadmium") && pop.textContent.includes("Coming soon"));

  const modeCountBeforeCd = rOn.getSwitchedModes().length;
  tileCd.click();
  rOn.flushTimers(0);
  assert.strictEqual(rOn.getSwitchedModes().length, modeCountBeforeCd, "Coming soon click must NOT change real Gemini mode");
  assert.strictEqual(rOn.modeBtn.querySelector('[data-sg-periodic-label="true"]').textContent, "\u25CB Cadmium");

  // Test Promethium ("Pm" contains "pro") does NOT corrupt sgGetNativeModeButtonText!
  rOn.innerBtn.dispatchEvent(new rOn.MiniEvent("click", { bubbles: true, cancelable: true }));
  tiles.find(t => t.dataset.symbol === "Pm").click();
  rOn.flushTimers(0);
  assert.strictEqual(rOn.modeBtn.querySelector('[data-sg-periodic-label="true"]').textContent, "\u25CB Promethium");
  const nativeText = rOn.ctx.sgGetNativeModeButtonText(rOn.modeBtn);
  assert.strictEqual(nativeText, "fast", "sgGetNativeModeButtonText must exclude [data-sg-periodic-label]");
  assert.strictEqual(rOn.ctx.parseModeFromButtonText(nativeText), "fast", "Native mode must still parse as 'fast', not 'pro'");
  console.log("PASS [E]: Coming soon (Cd -> ○ Cadmium, Pm -> ○ Promethium) preserves native mode text & observer isolation");

  // === CHECK F: Footer Other Models ===
  rOn.innerBtn.dispatchEvent(new rOn.MiniEvent("click", { bubbles: true, cancelable: true }));
  pills.find(p => p.dataset.modelId === "flash-lite").click();
  rOn.flushTimers(0);
  assert.strictEqual(rOn.getSwitchedModes()[rOn.getSwitchedModes().length - 1], "fast");
  assert.strictEqual(rOn.modeBtn.querySelector('[data-sg-periodic-label="true"]').textContent, "Flash-Lite");

  rOn.innerBtn.dispatchEvent(new rOn.MiniEvent("click", { bubbles: true, cancelable: true }));
  pills.find(p => p.dataset.modelId === "3.1-pro").click();
  rOn.flushTimers(0);
  assert.strictEqual(rOn.getSwitchedModes()[rOn.getSwitchedModes().length - 1], "pro");
  assert.strictEqual(rOn.modeBtn.querySelector('[data-sg-periodic-label="true"]').textContent, "3.1 Pro");
  console.log("PASS [F]: Footer Other models (Flash-Lite -> fast, 3.1 Pro -> pro)");

  // === CHECK G: IME & Escape Focus Restoration ===
  rOn.innerBtn.dispatchEvent(new rOn.MiniEvent("click", { bubbles: true, cancelable: true }));
  assert.ok(panel.classList.contains("sg-periodic-open"));

  // Escape during IME composition must be ignored
  rOn.doc.dispatchEvent(new rOn.MiniEvent("keydown", { key: "Escape", isComposing: true }));
  assert.ok(panel.classList.contains("sg-periodic-open"), "OPT-003: Escape with isComposing=true must NOT close panel");

  rOn.doc.dispatchEvent(new rOn.MiniEvent("keydown", { key: "Escape", keyCode: 229 }));
  assert.ok(panel.classList.contains("sg-periodic-open"), "OPT-003: Escape with keyCode=229 must NOT close panel");

  // Normal Escape closes panel & restores focus to trigger button
  rOn.doc.dispatchEvent(new rOn.MiniEvent("keydown", { key: "Escape" }));
  assert.strictEqual(panel.classList.contains("sg-periodic-open"), false, "Normal Escape must close panel");
  assert.strictEqual(rOn.getActiveElement(), rOn.innerBtn, "OPT-007: Escape must restore focus to trigger button");
  console.log("PASS [G]: OPT-003 IME guard (isComposing / 229) & OPT-007 Escape focus restoration");

  // === CHECK H: Complete Teardown on Disable ===
  rOn.innerBtn.dispatchEvent(new rOn.MiniEvent("click", { bubbles: true, cancelable: true }));
  tileC.dispatchEvent(new rOn.MiniEvent("mouseenter"));
  assert.ok(rOn.doc.getElementById("sg-periodic-model-panel"));
  assert.ok(rOn.doc.getElementById("sg-periodic-popover"));

  // Simulate DISABLE_PERIODIC_MODEL_PICKER / storage change -> false
  rOn.fireStorageChange({ periodicModelPickerEnabled: { oldValue: true, newValue: false } });
  assert.strictEqual(rOn.doc.getElementById("sg-periodic-model-panel"), null, "Panel must be unmounted on disable");
  assert.strictEqual(rOn.doc.getElementById("sg-periodic-popover"), null, "Popover must be unmounted on disable");
  assert.strictEqual(rOn.modeBtn.getAttribute("data-sg-periodic-active"), null, "data-sg-periodic-active must be removed");
  assert.strictEqual(rOn.modeBtn.querySelector('[data-sg-periodic-label="true"]'), null, "Custom pill span must be removed");
  assert.strictEqual(rOn.nativeSpan.textContent, "Fast", "Native button text must remain intact");
  assert.strictEqual(rOn.getRegisteredRefreshers().has("periodicModelLabel"), false, "UIRefresh callback must be unregistered");

  const afterDisableClick = new rOn.MiniEvent("click", { bubbles: true, cancelable: true });
  const beforeDisableClickCount = rOn.getNativeClickCount();
  rOn.innerBtn.dispatchEvent(afterDisableClick);
  assert.strictEqual(afterDisableClick.defaultPrevented, false, "Clicks must no longer be intercepted after disable");
  assert.strictEqual(rOn.getNativeClickCount(), beforeDisableClickCount + 1, "Native button click restored after disable");
  console.log("PASS [H]: Clean teardown (unmounts panel & popover, removes custom pill label, restores native click behavior)");

  // === CHECK I: Regression Invariants (BUG-001, BUG-007, OPT-011, background.js default OFF) ===
  const contentCss = fs.readFileSync(path.join(ROOT, "content.css"), "utf8");
  const bgJs = fs.readFileSync(path.join(ROOT, "background.js"), "utf8");
  assert.ok(/#sg-sidebar-hover-sensor\s*\{[\s\S]*?z-index:\s*980;/.test(contentCss), "BUG-001 hover sensor z-index 980 preserved");
  assert.ok(/z-index:\s*990\s*!important/.test(contentCss), "BUG-001 collapsed sidebar z-index 990 preserved");
  assert.ok(/#sg-periodic-model-panel\s*\{[\s\S]*?z-index:\s*10030;/.test(contentCss), "Periodic panel z-index 10030");
  assert.ok(/#sg-periodic-popover\s*\{[\s\S]*?z-index:\s*10035;/.test(contentCss), "Periodic popover z-index 10035");
  assert.ok(contentJs.includes("sgSyncGetCached"), "OPT-011 sgSyncGetCached preserved");
  assert.ok(!/periodicModelPickerEnabled\s*:\s*true/.test(bgJs), "background.js must never default periodicModelPickerEnabled to true");

  // Verify handleRuntimeMessage routes ENABLE/DISABLE_PERIODIC_MODEL_PICKER & SG.messages returns !1
  const onMsgMatch = contentJs.match(/const _sgLegacyRuntimeCoreMsg = \(e,\s*t,\s*n\)\s*=>\s*\{[\s\S]{0,600}SG\.messages\.onMatcher\("legacy:runtime-core"/);
  assert.ok(onMsgMatch && onMsgMatch[0].includes('return handleRuntimeMessage(e), !1'), "BUG-007 synchronous return !1 preserved");
  console.log("PASS [I]: Regression invariants (BUG-001 z-index 980/990, BUG-007 onMessage sync return !1, OPT-011 sgSyncGetCached, background.js default OFF)");

  // === CHECK J: Multi-Variant Gemini Mode Button DOM & CSS Visibility (Regression for Blank Label Bug) ===
  function isHiddenByPeriodicCss(el) {
    let cur = el;
    while (cur && cur.nodeType === 1) {
      const parent = cur.parentElement;
      if (parent && parent.getAttribute("data-sg-periodic-host") === "true") {
        const isKept =
          cur.getAttribute("data-sg-periodic-label") === "true" ||
          cur.getAttribute("data-sg-periodic-keep") === "true" ||
          cur.matches("mat-icon, .mat-icon, svg, .google-symbols, .material-symbols-outlined, .material-icons, [fonticon], [data-mat-icon-name], .mat-mdc-button-persistent-ripple, .mdc-button__ripple, .mat-focus-indicator, .mat-mdc-button-touch-target");
        if (!isKept) return true;
      }
      cur = parent;
    }
    return false;
  }

  const variants = [
    {
      name: "Classic Angular Material (.mdc-button__label > .logo-pill-label-container + mat-icon)",
      build(doc) {
        const root = doc.createElement("div");
        root.setAttribute("data-test-id", "bard-mode-menu-button");
        const btn = doc.createElement("button");
        btn.className = "mdc-button input-area-switch";
        const lbl = doc.createElement("span");
        lbl.className = "mdc-button__label";
        const pill = doc.createElement("div");
        pill.className = "logo-pill-label-container";
        const t1 = doc.createElement("span"); t1.textContent = "Fast";
        pill.appendChild(t1);
        const icon = doc.createElement("mat-icon"); icon.setAttribute("fonticon", "keyboard_arrow_down"); icon.textContent = "keyboard_arrow_down";
        lbl.appendChild(pill);
        lbl.appendChild(icon);
        btn.appendChild(lbl);
        root.appendChild(btn);
        return { root, nativeTexts: [t1], icon };
      }
    },
    {
      name: "Hydrogen nested (.mdc-button__label > .logo-pill-label-container > [Hydrogen, Trung bình, mat-icon])",
      build(doc) {
        const root = doc.createElement("div");
        root.setAttribute("data-test-id", "bard-mode-menu-button");
        const btn = doc.createElement("button");
        btn.className = "mdc-button input-area-switch";
        const lbl = doc.createElement("span");
        lbl.className = "mdc-button__label";
        const pill = doc.createElement("div");
        pill.className = "logo-pill-label-container";
        const t1 = doc.createElement("span"); t1.textContent = "Hydrogen";
        const t2 = doc.createElement("span"); t2.textContent = "Trung bình";
        const icon = doc.createElement("mat-icon"); icon.textContent = "keyboard_arrow_down";
        pill.appendChild(t1); pill.appendChild(t2); pill.appendChild(icon);
        lbl.appendChild(pill);
        btn.appendChild(lbl);
        root.appendChild(btn);
        return { root, nativeTexts: [t1, t2], icon };
      }
    },
    {
      name: "Hydrogen sibling effort (.mdc-button__label > [pill(Hydrogen), span(Trung bình), mat-icon])",
      build(doc) {
        const root = doc.createElement("div");
        root.setAttribute("data-test-id", "bard-mode-menu-button");
        const btn = doc.createElement("button");
        btn.className = "mdc-button input-area-switch";
        const lbl = doc.createElement("span");
        lbl.className = "mdc-button__label";
        const pill = doc.createElement("span"); pill.className = "logo-pill-label-container"; pill.textContent = "Hydrogen";
        const t2 = doc.createElement("span"); t2.className = "effort-label"; t2.textContent = "Trung bình";
        const icon = doc.createElement("mat-icon"); icon.textContent = "keyboard_arrow_down";
        lbl.appendChild(pill); lbl.appendChild(t2); lbl.appendChild(icon);
        btn.appendChild(lbl);
        root.appendChild(btn);
        return { root, nativeTexts: [pill, t2], icon };
      }
    },
    {
      name: "Wrapped icon (.mdc-button__label > div.row > [span(Hydrogen), span(Trung bình), span.arrow > mat-icon])",
      build(doc) {
        const root = doc.createElement("div");
        root.setAttribute("data-test-id", "bard-mode-menu-button");
        const btn = doc.createElement("button");
        btn.className = "mdc-button input-area-switch";
        const lbl = doc.createElement("span");
        lbl.className = "mdc-button__label";
        const row = doc.createElement("div"); row.className = "switch-row";
        const t1 = doc.createElement("span"); t1.textContent = "Hydrogen";
        const t2 = doc.createElement("span"); t2.textContent = "Trung bình";
        const arrowWrap = doc.createElement("span"); arrowWrap.className = "arrow-wrap";
        const icon = doc.createElement("mat-icon"); icon.textContent = "keyboard_arrow_down";
        arrowWrap.appendChild(icon);
        row.appendChild(t1); row.appendChild(t2); row.appendChild(arrowWrap);
        lbl.appendChild(row);
        btn.appendChild(lbl);
        root.appendChild(btn);
        return { root, nativeTexts: [t1, t2], icon };
      }
    }
  ];

  for (const v of variants) {
    const rV = createRuntime({ periodicModelPickerEnabled: true });
    rV.modeBtn.remove();
    const built = v.build(rV.doc);
    rV.doc.body.appendChild(built.root);
    rV.localStorage.setItem("sg_periodic_model_state", JSON.stringify({
      selectedType: "element", symbol: "C", id: null, name: "Carbon", released: true, thinkingLevel: "medium"
    }));
    vm.runInContext("_sgPeriodicState = null; sgSyncPeriodicModeButtonLabel();", rV.ctx);

    const hosts = built.root.querySelectorAll('[data-sg-periodic-host="true"]');
    assert.strictEqual(hosts.length, 1, `[${v.name}] exactly 1 host attribute`);
    const labelEl = built.root.querySelector('[data-sg-periodic-label="true"]');
    assert.ok(labelEl, `[${v.name}] labelEl must exist`);
    assert.strictEqual(labelEl.textContent, "Carbon", `[${v.name}] label text must be Carbon`);
    assert.strictEqual(labelEl.parentElement, hosts[0], `[${v.name}] labelEl must be direct child of host`);
    assert.strictEqual(isHiddenByPeriodicCss(labelEl), false, `[${v.name}] labelEl MUST NOT be hidden by CSS`);
    assert.strictEqual(isHiddenByPeriodicCss(built.icon), false, `[${v.name}] chevron icon MUST NOT be hidden by CSS`);
    for (const nt of built.nativeTexts) {
      assert.strictEqual(isHiddenByPeriodicCss(nt), true, `[${v.name}] native text '${nt.textContent}' MUST be hidden`);
    }

    // Also verify switching to Coming soon updates text cleanly and stays visible
    vm.runInContext('sgPeriodicSelectElement(SG_PERIODIC_BY_SYMBOL.get("Cd"))', rV.ctx);
    assert.strictEqual(built.root.querySelector('[data-sg-periodic-label="true"]').textContent, "\u25CB Cadmium");
    assert.strictEqual(isHiddenByPeriodicCss(built.root.querySelector('[data-sg-periodic-label="true"]')), false);

    // Verify teardown cleans every attribute & restores native text visibility
    vm.runInContext("sgSetPeriodicModelPickerEnabled(false)", rV.ctx);
    assert.strictEqual(built.root.querySelectorAll('[data-sg-periodic-host="true"]').length, 0);
    assert.strictEqual(built.root.querySelectorAll('[data-sg-periodic-keep="true"]').length, 0);
    assert.strictEqual(built.root.querySelectorAll('[data-sg-periodic-label="true"]').length, 0);
    for (const nt of built.nativeTexts) {
      assert.strictEqual(isHiddenByPeriodicCss(nt), false, `[${v.name}] native text restored after disable`);
    }
  }
  console.log("PASS [J]: All 4 Gemini DOM variants (Classic, Hydrogen nested, Hydrogen sibling effort, wrapped icon) keep label & chevron visible and hide native text cleanly");

  // === CHECK K: Coming Soon Send-Blocking (Click, Enter, Form Submit; preserves Stop, Mic, Shift+Enter, IME, Released, Disable) ===
  const rBlk = createRuntime({ periodicModelPickerEnabled: true });
  const toasts = [];
  rBlk.ctx.showToast = (msg, type) => toasts.push({ msg, type });
  rBlk.ctx.sgIsVietnameseGeminiUI = () => true;

  // Build composer DOM with input, send button, stop button, mic button, and form
  const composer = rBlk.doc.createElement("input-area-v2");
  const form = rBlk.doc.createElement("form");
  const richTa = rBlk.doc.createElement("rich-textarea");
  const editor = rBlk.doc.createElement("div");
  editor.className = "ql-editor";
  editor.setAttribute("contenteditable", "true");
  richTa.appendChild(editor);
  form.appendChild(richTa);

  const sendWrap = rBlk.doc.createElement("div");
  sendWrap.className = "send-button-container";
  const sendBtn = rBlk.doc.createElement("button");
  sendBtn.className = "send-button";
  sendBtn.setAttribute("aria-label", "Gửi tin nhắn");
  const sendIcon = rBlk.doc.createElement("mat-icon");
  sendIcon.setAttribute("fonticon", "arrow_upward");
  sendBtn.appendChild(sendIcon);
  sendWrap.appendChild(sendBtn);

  const stopBtn = rBlk.doc.createElement("button");
  stopBtn.className = "send-button stop";
  stopBtn.setAttribute("aria-label", "Dừng tạo phản hồi");
  const stopIcon = rBlk.doc.createElement("mat-icon");
  stopIcon.setAttribute("fonticon", "stop");
  stopBtn.appendChild(stopIcon);
  sendWrap.appendChild(stopBtn);

  const micBtn = rBlk.doc.createElement("button");
  micBtn.setAttribute("aria-label", "Sử dụng micrô");
  const micIcon = rBlk.doc.createElement("mat-icon");
  micIcon.setAttribute("fonticon", "mic");
  micBtn.appendChild(micIcon);
  sendWrap.appendChild(micBtn);

  form.appendChild(sendWrap);
  composer.appendChild(form);
  rBlk.doc.body.appendChild(composer);

  let sendClickReached = 0, stopClickReached = 0, micClickReached = 0, enterReached = 0, submitReached = 0;
  sendBtn.addEventListener("click", () => sendClickReached++);
  stopBtn.addEventListener("click", () => stopClickReached++);
  micBtn.addEventListener("click", () => micClickReached++);
  editor.addEventListener("keydown", e => { if (e.key === "Enter") enterReached++; });
  form.addEventListener("submit", () => submitReached++);

  // Select Coming soon element (Cd) -> must block sending!
  vm.runInContext('sgPeriodicSelectElement(SG_PERIODIC_BY_SYMBOL.get("Cd"))', rBlk.ctx);
  assert.strictEqual(rBlk.doc.body.classList.contains("sg-periodic-send-blocked"), true, "body must have sg-periodic-send-blocked");
  assert.strictEqual(vm.runInContext("_sgPeriodicSendBlockBound", rBlk.ctx), true, "send-block listeners must be bound");

  // 1. Clicking send icon inside send button is blocked
  const evSend = new rBlk.MiniEvent("click", { bubbles: true, cancelable: true });
  sendIcon.dispatchEvent(evSend);
  assert.strictEqual(evSend.defaultPrevented, true, "Send button click must be blocked on Coming soon element");
  assert.strictEqual(sendClickReached, 0, "Native send click listener must not fire");
  assert.ok(toasts.length >= 1 && toasts[0].msg.includes("Cadmium"), "Blocked toast must mention element name");

  // 2. Pressing Enter in editor is blocked
  const evEnter = new rBlk.MiniEvent("keydown", { key: "Enter", code: "Enter", bubbles: true, cancelable: true });
  editor.dispatchEvent(evEnter);
  assert.strictEqual(evEnter.defaultPrevented, true, "Enter in prompt editor must be blocked");
  assert.strictEqual(enterReached, 0, "Native Enter handler must not fire");

  // 3. Pressing Shift+Enter in editor is ALLOWED (newline)
  const evShiftEnter = new rBlk.MiniEvent("keydown", { key: "Enter", code: "Enter", shiftKey: true, bubbles: true, cancelable: true });
  editor.dispatchEvent(evShiftEnter);
  assert.strictEqual(evShiftEnter.defaultPrevented, false, "Shift+Enter must NOT be blocked");
  assert.strictEqual(enterReached, 1);

  // 4. Pressing Enter during IME composition is ALLOWED
  const evImeEnter = new rBlk.MiniEvent("keydown", { key: "Enter", code: "Enter", isComposing: true, bubbles: true, cancelable: true });
  editor.dispatchEvent(evImeEnter);
  assert.strictEqual(evImeEnter.defaultPrevented, false, "IME Enter must NOT be blocked");
  assert.strictEqual(enterReached, 2);

  // 5. Stop button and Mic button are ALLOWED
  const evStop = new rBlk.MiniEvent("click", { bubbles: true, cancelable: true });
  stopBtn.dispatchEvent(evStop);
  assert.strictEqual(evStop.defaultPrevented, false, "Stop button must NOT be blocked");
  assert.strictEqual(stopClickReached, 1);

  const evMic = new rBlk.MiniEvent("click", { bubbles: true, cancelable: true });
  micBtn.dispatchEvent(evMic);
  assert.strictEqual(evMic.defaultPrevented, false, "Mic button must NOT be blocked");
  assert.strictEqual(micClickReached, 1);

  // 6. Composer form submit is blocked
  const evSubmit = new rBlk.MiniEvent("submit", { bubbles: true, cancelable: true });
  form.dispatchEvent(evSubmit);
  assert.strictEqual(evSubmit.defaultPrevented, true, "Composer submit must be blocked");
  assert.strictEqual(submitReached, 0);

  // 7. Switching to released element (C) immediately unblocks sending & removes listeners
  vm.runInContext('sgPeriodicSelectElement(SG_PERIODIC_BY_SYMBOL.get("C"))', rBlk.ctx);
  rBlk.flushTimers(0);
  assert.strictEqual(rBlk.doc.body.classList.contains("sg-periodic-send-blocked"), false, "Released element must remove sg-periodic-send-blocked");
  assert.strictEqual(vm.runInContext("_sgPeriodicSendBlockBound", rBlk.ctx), false, "Send-block listeners must unbind when released");

  const evSendAllowed = new rBlk.MiniEvent("click", { bubbles: true, cancelable: true });
  sendBtn.dispatchEvent(evSendAllowed);
  assert.strictEqual(evSendAllowed.defaultPrevented, false, "Send click must succeed on released element");
  assert.strictEqual(sendClickReached, 1);

  const evEnterAllowed = new rBlk.MiniEvent("keydown", { key: "Enter", code: "Enter", bubbles: true, cancelable: true });
  editor.dispatchEvent(evEnterAllowed);
  assert.strictEqual(evEnterAllowed.defaultPrevented, false, "Enter must succeed on released element");
  assert.strictEqual(enterReached, 3);

  // 8. Re-select Coming soon (Au), then disable Periodic Table -> unblocks completely
  vm.runInContext('sgPeriodicSelectElement(SG_PERIODIC_BY_SYMBOL.get("Au"))', rBlk.ctx);
  assert.strictEqual(rBlk.doc.body.classList.contains("sg-periodic-send-blocked"), true);
  vm.runInContext("sgSetPeriodicModelPickerEnabled(false)", rBlk.ctx);
  assert.strictEqual(rBlk.doc.body.classList.contains("sg-periodic-send-blocked"), false);
  assert.strictEqual(vm.runInContext("_sgPeriodicSendBlockBound", rBlk.ctx), false);
  const evSendAfterDisable = new rBlk.MiniEvent("click", { bubbles: true, cancelable: true });
  sendBtn.dispatchEvent(evSendAfterDisable);
  assert.strictEqual(evSendAfterDisable.defaultPrevented, false);
  assert.strictEqual(sendClickReached, 2);

  console.log("PASS [K]: Coming soon send-blocking (blocks Send click/Enter/submit + toast; preserves Stop/Mic/Shift+Enter/IME; unblocks on released/other/disable)");

  // === CHECK L: Popover Hover Behavior (Coming Soon Immediate Close & Passive vs Released Interactive) ===
  const rPop = createRuntime({ periodicModelPickerEnabled: true });
  rPop.innerBtn.dispatchEvent(new rPop.MiniEvent("click", { bubbles: true, cancelable: true }));
  const popPanel = rPop.doc.getElementById("sg-periodic-model-panel");
  const allTiles = popPanel.querySelectorAll(".sg-periodic-tile");
  const tileLi = allTiles.find(t => t.dataset.symbol === "Li");
  const tileH = allTiles.find(t => t.dataset.symbol === "H");
  const tileC2 = allTiles.find(t => t.dataset.symbol === "C");

  // Hover Li (Coming soon) -> passive popover, closes IMMEDIATELY on mouseleave (0ms)
  tileLi.dispatchEvent(new rPop.MiniEvent("mouseenter"));
  const popEl = rPop.doc.getElementById("sg-periodic-popover");
  assert.ok(popEl.classList.contains("sg-periodic-visible"), "Li popover should open on mouseenter");
  assert.ok(popEl.classList.contains("sg-periodic-popover-passive"), "Coming soon popover must have passive class (pointer-events: none)");
  assert.strictEqual(popEl.classList.contains("sg-periodic-popover-interactive"), false);

  tileLi.dispatchEvent(new rPop.MiniEvent("mouseleave"));
  // MUST already be closed WITHOUT flushing any timer!
  assert.strictEqual(popEl.classList.contains("sg-periodic-visible"), false, "Coming soon popover MUST close immediately on mouseleave");
  assert.strictEqual(popEl.getAttribute("aria-hidden"), "true");

  // Hover H (Released) -> interactive popover, stays open if mouse moves into popover before 140ms
  tileH.dispatchEvent(new rPop.MiniEvent("mouseenter"));
  assert.ok(popEl.classList.contains("sg-periodic-visible"));
  assert.ok(popEl.classList.contains("sg-periodic-popover-interactive"), "Released popover must be interactive");
  assert.strictEqual(popEl.classList.contains("sg-periodic-popover-passive"), false);
  tileH.dispatchEvent(new rPop.MiniEvent("mouseleave"));
  assert.ok(popEl.classList.contains("sg-periodic-visible"), "Released popover uses brief hover-bridge grace timer");
  popEl.dispatchEvent(new rPop.MiniEvent("mouseenter"));
  rPop.flushTimers(200);
  assert.ok(popEl.classList.contains("sg-periodic-visible"), "Released popover stays open while hovering controls");
  popEl.dispatchEvent(new rPop.MiniEvent("mouseleave"));
  rPop.flushTimers(200);
  assert.strictEqual(popEl.classList.contains("sg-periodic-visible"), false, "Released popover closes after leaving popover");
  console.log("PASS [L]: Popover hover behavior (Coming soon passive + instant 0ms close on mouseleave; Released interactive hover-bridge)");

  // === CHECK M: Rich Popover Info (Element Chemistry Facts vs Model Description) ===
  tileLi.dispatchEvent(new rPop.MiniEvent("mouseenter"));
  const liText = popEl.textContent;
  assert.ok(liText.includes("Lithium"), "Li title");
  assert.ok(liText.includes("Alkali metal"), "Li category");
  assert.ok(liText.includes("6.94 u"), "Li atomic mass");
  assert.ok(liText.includes("Solid"), "Li phase");
  assert.ok(liText.includes("Group 1") && liText.includes("Period 2"), "Li position");
  assert.ok(liText.includes("s-block"), "Li block");
  assert.ok(liText.includes("[He] 2s\u00B9"), "Li electron config");
  assert.strictEqual(popEl.querySelectorAll(".sg-periodic-pop-desc").length, 0, "Coming soon must show facts, not model desc");

  tileC2.dispatchEvent(new rPop.MiniEvent("mouseenter"));
  const cDesc = popEl.querySelector(".sg-periodic-pop-desc");
  assert.ok(cDesc && cDesc.textContent.length > 30, "Released model popover must display rich model description");
  assert.ok(popEl.textContent.includes("Z=6") && popEl.textContent.includes("12.011 u"), "Released model shows compact element ref");

  // Verify electron config electron-sum === Z for all 118 elements inside VM
  const SUPER_REV = { "\u2070":"0","\u00B9":"1","\u00B2":"2","\u00B3":"3","\u2074":"4","\u2075":"5","\u2076":"6","\u2077":"7","\u2078":"8","\u2079":"9" };
  const CORE_Z = { "[He]":2, "[Ne]":10, "[Ar]":18, "[Kr]":36, "[Xe]":54, "[Rn]":86 };
  const bySymMap = vm.runInContext("SG_PERIODIC_BY_SYMBOL", rPop.ctx);
  for (const el of bySymMap.values()) {
    assert.ok(el.mass && el.category && el.phase && el.block && el.positionLabel && el.config, `Missing metadata on ${el.symbol}`);
    let sum = 0;
    for (const tok of el.config.split(" ")) {
      if (CORE_Z[tok]) sum += CORE_Z[tok];
      else {
        const m = tok.match(/^\d[spdf](.+)$/);
        assert.ok(m, `Invalid orbital token ${tok} on ${el.symbol}`);
        sum += Number(m[1].split("").map(ch => SUPER_REV[ch]).join(""));
      }
    }
    assert.strictEqual(sum, el.z, `Electron config count mismatch on Z=${el.z} ${el.symbol}: ${el.config}`);
  }
  console.log("PASS [M]: Rich popover info (118/118 IUPAC facts + verified electron configs for Coming soon; rich model description for Released)");

  // === CHECK N: Auto-Light Newly Released Models from Gemini DOM ===
  const fakeMenu = rPop.doc.createElement("gem-menu");
  const newOptLi = rPop.doc.createElement("gem-menu-item");
  newOptLi.setAttribute("data-test-id", "bard-mode-option-lithium");
  const optTitle = rPop.doc.createElement("div");
  optTitle.className = "mode-title";
  optTitle.textContent = "Gemini 4 Lithium";
  const optDesc = rPop.doc.createElement("div");
  optDesc.className = "description";
  optDesc.textContent = "Ultra-lightweight model for instant low-latency responses and rapid iteration.";
  newOptLi.appendChild(optTitle);
  newOptLi.appendChild(optDesc);
  fakeMenu.appendChild(newOptLi);
  rPop.doc.body.appendChild(fakeMenu);

  let newOptClicked = 0;
  newOptLi.addEventListener("click", () => newOptClicked++);

  const didDiscover = vm.runInContext("sgPeriodicScanGeminiCatalogFromDom()", rPop.ctx);
  assert.strictEqual(didDiscover, true, "Scanner must discover newly released Lithium model from Gemini DOM");
  assert.strictEqual(tileLi.dataset.released, "true", "3 Li tile must automatically light up as released");
  assert.ok(tileLi.classList.contains("sg-periodic-released"), "3 Li tile must gain sg-periodic-released class");
  assert.strictEqual(popPanel.querySelector('[data-sg-periodic-released-count="true"]').textContent, "4 released", "Legend count must auto-increment to 4 released");

  // Hovering newly lit Li now displays its discovered model description & Thinking level!
  tileLi.dispatchEvent(new rPop.MiniEvent("mouseenter"));
  assert.ok(popEl.classList.contains("sg-periodic-popover-interactive"), "Newly released Li popover becomes interactive");
  assert.ok(popEl.querySelector(".sg-periodic-pop-desc").textContent.includes("Ultra-lightweight model"), "Popover shows discovered model description");
  assert.ok(popEl.querySelectorAll('[role="radio"]').length >= 3, "Newly released Li shows Thinking level selector");

  // Selecting newly lit Li clicks the native dynamic option and does NOT block sending!
  tileLi.click();
  rPop.flushTimers(0);
  assert.strictEqual(newOptClicked, 1, "Selecting newly lit Li must click native bard-mode-option-lithium");
  assert.strictEqual(rPop.doc.body.classList.contains("sg-periodic-send-blocked"), false, "Newly released Li must NOT block sending");
  assert.strictEqual(rPop.modeBtn.querySelector('[data-sg-periodic-label="true"]').textContent, "Lithium", "Pill drops ○ prefix for released Li");
  fakeMenu.remove();
  console.log("PASS [N]: Auto-discovery lights up newly released models (Li -> 4 released, model desc, dynamic native click, unlocks send)");

  // === CHECK O: Dynamic Thinking Levels (4..6 levels, cap at 6, and DOM discovery) ===
  // 1. Discover 4 effort levels from Gemini DOM (Low, Medium, High, Extra)
  const effortClicked = [];
  const effortDomItems = ["Low", "Medium", "High", "Extra"].map(lbl => {
    const it = rPop.doc.createElement("gem-menu-item");
    const sp = rPop.doc.createElement("span");
    sp.className = "label";
    sp.textContent = lbl;
    it.appendChild(sp);
    it.addEventListener("click", () => effortClicked.push(lbl));
    return it;
  });
  rPop.ctx.findEffortLevelItems = () => effortDomItems;
  vm.runInContext("sgPeriodicScanGeminiCatalogFromDom()", rPop.ctx);

  // Re-open panel & hover H -> should render 4 levels!
  rPop.flushTimers(1500);
  rPop.flushTimers(300);
  rPop.flushTimers(300);
  rPop.innerBtn.dispatchEvent(new rPop.MiniEvent("click", { bubbles: true, cancelable: true }));
  assert.ok(popPanel.classList.contains("sg-periodic-open"), "Panel must reopen before hovering H in Check O");
  tileH.dispatchEvent(new rPop.MiniEvent("mouseenter"));
  const seg4 = popEl.querySelector(".sg-periodic-level-seg");
  const radios4 = popEl.querySelectorAll('[role="radio"]');
  assert.strictEqual(seg4.dataset.count, "4", "Segmented control must report data-count=4");
  assert.deepStrictEqual(radios4.map(b => b.textContent), ["Low", "Medium", "High", "Extra"]);

  // Select 4th level "Extra" -> clicks the 4th Gemini effort item ("Extra")!
  radios4[3].click();
  rPop.flushTimers(500);
  await new Promise(r => setImmediate(r));
  assert.deepStrictEqual(effortClicked, ["Extra"], "Selecting 4th thinking level 'Extra' must click native 'Extra' effort item");
  assert.strictEqual(JSON.parse(rPop.localStorage.getItem("sg_periodic_model_state")).thinkingLevel, "extra");

  // 2. Test 6 levels and cap when >6 (8 DOM items provided -> strictly capped at 6)
  const effortDomItems8 = ["Minimal", "Low", "Medium", "High", "Extra", "Max", "Ultra", "Extreme"].map(lbl => {
    const it = rPop.doc.createElement("gem-menu-item");
    const sp = rPop.doc.createElement("span");
    sp.className = "label";
    sp.textContent = lbl;
    it.appendChild(sp);
    return it;
  });
  rPop.ctx.findEffortLevelItems = () => effortDomItems8;
  rPop.flushTimers(1500);
  rPop.flushTimers(300);
  rPop.innerBtn.dispatchEvent(new rPop.MiniEvent("click", { bubbles: true, cancelable: true }));
  assert.ok(popPanel.classList.contains("sg-periodic-open"), "Panel must reopen after thinking-level cleanup");
  tileH.dispatchEvent(new rPop.MiniEvent("mouseenter"));
  const seg6 = popEl.querySelector(".sg-periodic-level-seg");
  const radios6 = popEl.querySelectorAll('[role="radio"]');
  assert.strictEqual(seg6.dataset.count, "6", "Thinking levels must cap at max 6");
  assert.strictEqual(radios6.length, 6, "Must render at most 6 thinking level radio buttons");
  assert.deepStrictEqual(radios6.map(b => b.textContent), ["Minimal", "Low", "Medium", "High", "Extra", "Max"]);
  console.log("PASS [O]: Dynamic Thinking levels (2..6 levels supported, auto-discovers 4th 'Extra' & clicks native item, caps strictly at 6)");

  // === CHECK P: Multi-Tier Silent Catalog Scanner (Plus, Pro, Ultra, Classic) & Per-Account Cache Isolation ===
  const rScan = createRuntime({ periodicModelPickerEnabled: true });
  // Simulate native menu open/close when trigger button is clicked during silent probe
  let activeMockMenuSpec = [];
  let mountedMockMenu = null;
  function buildMockMenu(doc, specs) {
    const m = doc.createElement("gem-menu");
    for (const s of specs) {
      const it = doc.createElement("gem-menu-item");
      it.setAttribute("data-test-id", s.tid);
      if (s.disabled) it.setAttribute("aria-disabled", "true");
      if (s.selected) it.setAttribute("aria-checked", "true");
      const t = doc.createElement("div");
      t.className = "mode-title";
      t.textContent = s.title;
      it.appendChild(t);
      if (s.desc) {
        const d = doc.createElement("div");
        d.className = "description";
        d.textContent = s.desc;
        it.appendChild(d);
      }
      m.appendChild(it);
    }
    return m;
  }
  rScan.innerBtn.addEventListener("click", () => {
    if (mountedMockMenu) { mountedMockMenu.remove(); mountedMockMenu = null; }
    if (activeMockMenuSpec.length) {
      mountedMockMenu = buildMockMenu(rScan.doc, activeMockMenuSpec);
      rScan.doc.body.appendChild(mountedMockMenu);
    }
  });
  rScan.doc.body.addEventListener("click", e => {
    if (e.target !== rScan.doc.body) return;
    if (mountedMockMenu) { mountedMockMenu.remove(); mountedMockMenu = null; }
  });

  // Helper to run silent probe with fake timers
  async function runProbe(specs, pathname) {
    rScan.ctx.window.location.pathname = pathname;
    activeMockMenuSpec = specs;
    const p = vm.runInContext("sgPeriodicProbeCatalogSilent({ force: true })", rScan.ctx);
    rScan.flushTimers(50);
    rScan.flushTimers(60);
    rScan.flushTimers(120);
    return await p;
  }

  // Open panel first so refresh updates live DOM
  rScan.innerBtn.dispatchEvent(new rScan.MiniEvent("click", { bubbles: true, cancelable: true }));
  const scanPanel = rScan.doc.getElementById("sg-periodic-model-panel");
  assert.ok(scanPanel.querySelector(".sg-periodic-refresh-btn"), "Header must have refresh scan button");

  // 1. Plus account (/u/0/app): ONLY Hydrogen
  await runProbe([
    { tid: "bard-mode-option-hydrogen", title: "Hydrogen", desc: "Everyday help", selected: true }
  ], "/u/0/app");
  assert.strictEqual(scanPanel.querySelector('[data-sg-periodic-released-count="true"]').textContent, "1 released", "Plus account has 1 released (H)");
  assert.strictEqual(scanPanel.querySelector('[data-sg-periodic-locked-legend="true"]').hidden, true);
  assert.strictEqual(scanPanel.querySelector('[data-symbol="H"]').dataset.released, "true");
  assert.strictEqual(scanPanel.querySelector('[data-symbol="C"]').dataset.released, "false", "Carbon must NOT be lit on Plus account");
  assert.strictEqual(scanPanel.querySelector('[data-symbol="Ar"]').dataset.released, "false", "Argon must NOT be lit on Plus account");
  assert.strictEqual(scanPanel.querySelectorAll(".sg-periodic-other-pill").length, 0, "No stale Other models when Plus menu has none");

  // 2. Pro account (/u/1/app): Hydrogen + Neon enabled, Carbon locked (Ultra), 3.1 Pro in Other models
  await runProbe([
    { tid: "bard-mode-option-hydrogen", title: "Hydrogen", desc: "Everyday help", selected: true },
    { tid: "bard-mode-option-neon", title: "Gemini 4 Neon", desc: "Fast creative assistant" },
    { tid: "bard-mode-option-carbon", title: "Gemini 4 Carbon", desc: "Upgrade to Google AI Ultra for complex work", disabled: true },
    { tid: "bard-mode-option-31pro", title: "3.1 Pro", desc: "Legacy pro model" }
  ], "/u/1/app");
  assert.strictEqual(scanPanel.querySelector('[data-sg-periodic-released-count="true"]').textContent, "2 released", "Pro account has 2 released (H, Ne)");
  assert.strictEqual(scanPanel.querySelector('[data-sg-periodic-locked-legend="true"]').hidden, false);
  assert.strictEqual(scanPanel.querySelector('[data-sg-periodic-locked-count="true"]').textContent, "1 locked", "Pro account shows 1 locked (C)");
  assert.strictEqual(scanPanel.querySelector('[data-symbol="H"]').dataset.released, "true");
  assert.strictEqual(scanPanel.querySelector('[data-symbol="Ne"]').dataset.released, "true");
  const tileCLocked = scanPanel.querySelector('[data-symbol="C"]');
  assert.strictEqual(tileCLocked.dataset.released, "false");
  assert.strictEqual(tileCLocked.dataset.locked, "true");
  assert.ok(tileCLocked.classList.contains("sg-periodic-locked"));
  const otherPillsPro = scanPanel.querySelectorAll(".sg-periodic-other-pill");
  assert.strictEqual(otherPillsPro.length, 1);
  assert.strictEqual(otherPillsPro[0].textContent, "3.1 Pro");

  // Hovering locked C shows passive Locked popover and closes immediately on mouseleave
  tileCLocked.dispatchEvent(new rScan.MiniEvent("mouseenter"));
  const scanPop = rScan.doc.getElementById("sg-periodic-popover");
  assert.ok(scanPop.classList.contains("sg-periodic-popover-passive"), "Locked popover must be passive");
  assert.ok(scanPop.textContent.includes("Locked") && scanPop.textContent.includes("Ultra"));
  tileCLocked.dispatchEvent(new rScan.MiniEvent("mouseleave"));
  assert.strictEqual(scanPop.classList.contains("sg-periodic-visible"), false, "Locked popover closes immediately on mouseleave");

  // Selecting locked C blocks sending messages & shows lock prefix on pill
  tileCLocked.click();
  assert.strictEqual(rScan.doc.body.classList.contains("sg-periodic-send-blocked"), true, "Locked element must block sending");
  assert.strictEqual(rScan.modeBtn.querySelector('[data-sg-periodic-label="true"]').textContent, "\uD83D\uDD12 Carbon");

  // 3. Ultra account (/u/2/app): Hydrogen + Neon + Carbon all released
  await runProbe([
    { tid: "bard-mode-option-hydrogen", title: "Hydrogen", desc: "Everyday help" },
    { tid: "bard-mode-option-neon", title: "Gemini 4 Neon", desc: "Fast creative assistant" },
    { tid: "bard-mode-option-carbon", title: "Gemini 4 Carbon", desc: "Flagship reasoning", selected: true }
  ], "/u/2/app");
  assert.strictEqual(scanPanel.querySelector('[data-sg-periodic-released-count="true"]').textContent, "3 released", "Ultra account has 3 released (H, Ne, C)");
  assert.strictEqual(scanPanel.querySelector('[data-symbol="C"]').dataset.released, "true");
  assert.strictEqual(scanPanel.querySelector('[data-symbol="C"]').dataset.locked, "false");

  // 4. Switching back to Plus (/u/0/app) restores Plus's isolated cache (only H, NOT contaminated by Pro/Ultra!)
  rScan.ctx.window.location.pathname = "/u/0/app";
  vm.runInContext("sgPeriodicRefreshPanelReleasedStates(); sgPeriodicRebuildFooterPills();", rScan.ctx);
  assert.strictEqual(scanPanel.querySelector('[data-sg-periodic-released-count="true"]').textContent, "1 released", "Per-account cache isolates Plus from Pro/Ultra");
  assert.strictEqual(scanPanel.querySelector('[data-symbol="Ne"]').dataset.released, "false");
  assert.strictEqual(scanPanel.querySelector('[data-symbol="C"]').dataset.released, "false");

  // 5. Classic account (/u/3/app): Fast + Thinking enabled, Pro disabled -> H & Ar released, C locked
  await runProbe([
    { tid: "bard-mode-option-fast", title: "Fast", desc: "Answers quickly", selected: true },
    { tid: "bard-mode-option-thinking", title: "Thinking", desc: "Solves complex problems" },
    { tid: "bard-mode-option-pro", title: "Pro", desc: "Upgrade to Pro", disabled: true }
  ], "/u/3/app");
  assert.strictEqual(scanPanel.querySelector('[data-sg-periodic-released-count="true"]').textContent, "2 released", "Classic fallback lights only available modes");
  assert.strictEqual(scanPanel.querySelector('[data-symbol="H"]').dataset.released, "true");
  assert.strictEqual(scanPanel.querySelector('[data-symbol="Ar"]').dataset.released, "true");
  assert.strictEqual(scanPanel.querySelector('[data-symbol="C"]').dataset.locked, "true");
  console.log("PASS [P]: Multi-tier Silent Catalog Scanner (Plus/Pro/Ultra/Classic, Locked state, dynamic footer, per-account cache isolation)");

  // === CHECK Q: Exact Live Gemini 4 Vietnamese DOM (.label-container without \n, upsell_MODE_CATEGORY_ULTRA) ===
  const rLive = createRuntime({ periodicModelPickerEnabled: true });
  rLive.ctx.window.location.pathname = "/u/0/app/f64a8beea7108ed2";
  // Build exact live gem-menu-item > gem-menu-item-content > div.label-container > [span.label, span.sub]
  const liveMenu = rLive.doc.createElement("gem-menu");
  const liveSpecs = [
    { tid: "bard-mode-option-8c46e95b1a07cecc", l1: "Tự động", l2: "Thích ứng với nhu cầu của bạn" },
    { tid: "bard-mode-option-56fdd199312815e2", l1: "Trợ giúp hằng ngày", l2: "4 Hydrogen" },
    { tid: "bard-mode-option-e6fa609c3fa255c0", l1: "Phân tích sâu hơn", l2: "4 Neon", selected: true },
    { tid: "bard-mode-option-upsell_MODE_CATEGORY_ULTRA", l1: "Lập trình và xử lý công việc phức tạp", l2: "4 Carbon", lockIcon: true }
  ];
  for (const s of liveSpecs) {
    const mi = rLive.doc.createElement("gem-menu-item");
    mi.setAttribute("role", "menuitemradio");
    mi.setAttribute("data-test-id", s.tid);
    mi.setAttribute("aria-disabled", "false");
    mi.setAttribute("aria-checked", s.selected ? "true" : "false");
    const content = rLive.doc.createElement("gem-menu-item-content");
    const lead = rLive.doc.createElement("div");
    lead.className = "leading-container";
    if (s.lockIcon) {
      const lk = rLive.doc.createElement("mat-icon");
      lk.setAttribute("fonticon", "lock");
      lead.appendChild(lk);
    }
    const lc = rLive.doc.createElement("div");
    lc.className = "label-container";
    const sp1 = rLive.doc.createElement("span");
    sp1.className = "label";
    sp1.textContent = s.l1;
    const sp2 = rLive.doc.createElement("span");
    sp2.className = "gem-menu-sublabel";
    sp2.textContent = s.l2;
    lc.appendChild(sp1);
    lc.appendChild(sp2);
    content.appendChild(lead);
    content.appendChild(lc);
    mi.appendChild(content);
    liveMenu.appendChild(mi);
  }
  rLive.doc.body.appendChild(liveMenu);

  // Open panel & scan snapshot
  rLive.innerBtn.dispatchEvent(new rLive.MiniEvent("click", { bubbles: true, cancelable: true }));
  await vm.runInContext("sgPeriodicProbeCatalogSilent({ force: true })", rLive.ctx);

  const livePanel = rLive.doc.getElementById("sg-periodic-model-panel");
  assert.strictEqual(livePanel.querySelector('[data-sg-periodic-released-count="true"]').textContent, "2 released", "Live DOM must detect 2 released (H, Ne)");
  assert.strictEqual(livePanel.querySelector('[data-sg-periodic-locked-count="true"]').textContent, "1 locked", "Live DOM must detect 1 locked (C)");
  assert.strictEqual(livePanel.querySelector('[data-symbol="H"]').dataset.released, "true");
  assert.strictEqual(livePanel.querySelector('[data-symbol="Ne"]').dataset.released, "true");
  assert.strictEqual(livePanel.querySelector('[data-symbol="C"]').dataset.locked, "true");
  assert.strictEqual(livePanel.querySelector('[data-symbol="Ar"]').dataset.released, "false");

  // Footer Other models must have ONLY "Tự động"
  const liveOthers = livePanel.querySelectorAll(".sg-periodic-other-pill");
  assert.strictEqual(liveOthers.length, 1, "Footer must contain only 'Tự động'");
  assert.strictEqual(liveOthers[0].textContent, "Tự động");

  // Hover Neon -> Gemini 4 Neon + Phân tích sâu hơn
  const liveTileNe = livePanel.querySelector('[data-symbol="Ne"]');
  liveTileNe.dispatchEvent(new rLive.MiniEvent("mouseenter"));
  const livePop = rLive.doc.getElementById("sg-periodic-popover");
  assert.ok(livePop.textContent.includes("Gemini 4 Neon"), "Neon popover title must be 'Gemini 4 Neon'");
  assert.ok(livePop.textContent.includes("Phân tích sâu hơn"), "Neon popover subtitle must preserve Gemini localized use-case");

  // Hover Carbon (locked) -> Gemini 4 Carbon + Requires Google AI Ultra
  const liveTileC = livePanel.querySelector('[data-symbol="C"]');
  liveTileC.dispatchEvent(new rLive.MiniEvent("mouseenter"));
  assert.ok(livePop.textContent.includes("Gemini 4 Carbon"));
  assert.ok(livePop.textContent.includes("Requires Google AI Ultra"), "upsell_MODE_CATEGORY_ULTRA must map to 'Requires Google AI Ultra'");

  liveMenu.remove();
  console.log("PASS [Q]: Exact Live Gemini 4 Vietnamese DOM (.label-container, 4 Hydrogen/4 Neon/4 Carbon locked Ultra, footer='Tự động' only)");

  // === CHECK R: Safe Hover Triangle (Diagonal Crossing from 10 Ne over 9 F / 2 He into Neon Popover) ===
  const rAim = createRuntime({ periodicModelPickerEnabled: true });
  vm.runInContext('sgPeriodicRegisterReleasedModel({ symbol: "Ne", title: "Gemini 4 Neon", subtitle: "Phân tích sâu hơn" })', rAim.ctx);
  rAim.innerBtn.dispatchEvent(new rAim.MiniEvent("click", { bubbles: true, cancelable: true }));
  const aimPanel = rAim.doc.getElementById("sg-periodic-model-panel");
  const aimTileNe = aimPanel.querySelector('[data-symbol="Ne"]');
  const aimTileHe = aimPanel.querySelector('[data-symbol="He"]');
  const aimTileF = aimPanel.querySelector('[data-symbol="F"]');
  const aimTileAr = aimPanel.querySelector('[data-symbol="Ar"]');

  // Realistic desktop rects for right-edge column 18 (row 1: He, row 2: F & Ne, row 3: Ar)
  aimTileHe._rect = { left: 900, top: 280, right: 940, bottom: 318, width: 40, height: 38 };
  aimTileF._rect  = { left: 857, top: 321, right: 897, bottom: 359, width: 40, height: 38 };
  aimTileNe._rect = { left: 900, top: 321, right: 940, bottom: 359, width: 40, height: 38 };
  aimTileAr._rect = { left: 900, top: 362, right: 940, bottom: 400, width: 40, height: 38 };

  // Hover 10 Ne -> popover opens above Ne (clamped left of right edge, spanning x=[660..940], y=[167..317])
  aimTileNe.dispatchEvent(new rAim.MiniEvent("mouseenter", { clientX: 920, clientY: 340 }));
  const aimPop = rAim.doc.getElementById("sg-periodic-popover");
  aimPop._rect = { left: 660, top: 167, right: 940, bottom: 317, width: 280, height: 150 };
  assert.ok(aimPop.classList.contains("sg-periodic-visible") && aimPop.textContent.includes("Gemini 4 Neon"));

  // 1. User leaves 10 Ne diagonally up-left across 9 F and 2 He toward Neon's popover
  aimTileNe.dispatchEvent(new rAim.MiniEvent("mouseleave", { clientX: 901, clientY: 332 }));
  aimTileF.dispatchEvent(new rAim.MiniEvent("mouseenter", { clientX: 890, clientY: 328 }));
  // MUST NOT kill Neon's popover!
  assert.ok(aimPop.classList.contains("sg-periodic-visible"), "Crossing 9 F diagonally must NOT hide Neon popover");
  assert.ok(aimPop.textContent.includes("Gemini 4 Neon"), "Crossing 9 F diagonally must NOT replace Neon popover immediately");

  // Leaving 9 F onto 2 He -> STILL must NOT kill Neon's popover!
  aimTileF.dispatchEvent(new rAim.MiniEvent("mouseleave", { clientX: 895, clientY: 320 }));
  aimTileHe.dispatchEvent(new rAim.MiniEvent("mouseenter", { clientX: 905, clientY: 317 }));
  assert.ok(aimPop.classList.contains("sg-periodic-visible") && aimPop.textContent.includes("Gemini 4 Neon"), "Crossing 2 He into popover must keep Neon open");

  // Entering Neon's popover cancels all hide/intent timers -> stays open even after timers flush!
  aimPop.dispatchEvent(new rAim.MiniEvent("mouseenter", { clientX: 820, clientY: 290 }));
  rAim.flushTimers(400);
  assert.ok(aimPop.classList.contains("sg-periodic-visible") && aimPop.textContent.includes("Gemini 4 Neon"), "Entering Neon popover preserves it stably");

  // 2. User moves AWAY from popover (down from 10 Ne to 18 Ar) -> switches IMMEDIATELY (0ms)!
  aimTileNe.dispatchEvent(new rAim.MiniEvent("mouseenter", { clientX: 920, clientY: 340 }));
  aimTileNe.dispatchEvent(new rAim.MiniEvent("mouseleave", { clientX: 920, clientY: 359 }));
  aimTileAr.dispatchEvent(new rAim.MiniEvent("mouseenter", { clientX: 920, clientY: 375 }));
  assert.ok(aimPop.textContent.includes("Argon"), "Moving away (down to Ar) must switch popover immediately");

  // 3. User moves from 10 Ne into 9 F and STOPS there (>180ms without entering popover) -> switches to Fluorine!
  aimTileNe.dispatchEvent(new rAim.MiniEvent("mouseenter", { clientX: 920, clientY: 340 }));
  aimTileNe.dispatchEvent(new rAim.MiniEvent("mouseleave", { clientX: 901, clientY: 332 }));
  aimTileF.dispatchEvent(new rAim.MiniEvent("mouseenter", { clientX: 888, clientY: 330 }));
  assert.ok(aimPop.textContent.includes("Gemini 4 Neon"), "Still Neon during brief diagonal grace");
  rAim.flushTimers(200);
  assert.ok(aimPop.textContent.includes("Fluorine"), "Stopping on 9 F switches to Fluorine after 180ms");
  console.log("PASS [R]: Safe hover triangle & bridge (diagonal 10 Ne -> 9 F/2 He -> Neon popover preserved; moving away switches 0ms; stopping on neighbor opens after 180ms)");

  // === CHECK S: Silent Probe Clean Native Menu Close (No Double-Toggle Reopen & Panel Stays Open on Escape) ===
  // Case 1: Menu closes via body.click() while aria-expanded was still "true" synchronously -> MUST NOT call trigger.click() again!
  const rClose = createRuntime({ periodicModelPickerEnabled: true });
  rClose.ctx.KeyboardEvent = function(type, opts) { return new rClose.MiniEvent(type, opts); };
  let triggerClicks = 0;
  let closeMenuEl = null;
  let closeMode = "body"; // "body" | "escape" | "toggle"
  rClose.innerBtn.addEventListener("click", () => {
    triggerClicks++;
    if (closeMenuEl) {
      closeMenuEl.remove();
      closeMenuEl = null;
      rClose.innerBtn.setAttribute("aria-expanded", "false");
      return;
    }
    rClose.innerBtn.setAttribute("aria-expanded", "true");
    closeMenuEl = rClose.doc.createElement("gem-menu");
    const it = rClose.doc.createElement("gem-menu-item");
    it.setAttribute("data-test-id", "bard-mode-option-h");
    const lc = rClose.doc.createElement("div");
    lc.className = "label-container";
    const s1 = rClose.doc.createElement("span"); s1.textContent = "Everyday help";
    const s2 = rClose.doc.createElement("span"); s2.textContent = "4 Hydrogen";
    lc.appendChild(s1); lc.appendChild(s2);
    it.appendChild(lc);
    closeMenuEl.appendChild(it);
    rClose.doc.body.appendChild(closeMenuEl);
  });
  rClose.doc.body.addEventListener("click", e => {
    if (e.target !== rClose.doc.body) return;
    if (closeMode === "body" && closeMenuEl) {
      // Simulate Angular closing menu (aria-expanded not cleared until after click!)
      closeMenuEl.remove();
      closeMenuEl = null;
    }
  });
  rClose.doc.addEventListener("keydown", e => {
    if (e.key === "Escape" && closeMode === "escape" && closeMenuEl) {
      closeMenuEl.remove();
      closeMenuEl = null;
      rClose.innerBtn.setAttribute("aria-expanded", "false");
    }
  });

  // Open Periodic panel
  rClose.innerBtn.dispatchEvent(new rClose.MiniEvent("click", { bubbles: true, cancelable: true }));
  const closePanel = rClose.doc.getElementById("sg-periodic-model-panel");
  assert.ok(closePanel.classList.contains("sg-periodic-open"));

  // S1: Body click closes menu -> trigger clicked ONLY once (to open), NOT reopened!
  closeMode = "body";
  triggerClicks = 0;
  const pS1 = vm.runInContext("sgPeriodicProbeCatalogSilent({ force: true })", rClose.ctx);
  rClose.flushTimers(50);
  rClose.flushTimers(60);
  rClose.flushTimers(100);
  await pS1;
  assert.strictEqual(triggerClicks, 1, "S1: Must NOT double-toggle trigger and reopen native menu");
  assert.strictEqual(rClose.doc.querySelectorAll('[data-test-id^="bard-mode-option-"]').length, 0, "S1: Native menu closed");
  assert.strictEqual(rClose.doc.body.classList.contains("sg-hiding-mode-menu"), false, "S1: sg-hiding-mode-menu cleaned up");
  assert.ok(closePanel.classList.contains("sg-periodic-open"), "S1: Periodic panel remains open");

  // S2: Menu ignores body click, closes only on Escape -> internal Escape closes native menu WITHOUT closing Periodic panel!
  closeMode = "escape";
  triggerClicks = 0;
  const pS2 = vm.runInContext("sgPeriodicProbeCatalogSilent({ force: true })", rClose.ctx);
  rClose.flushTimers(50);  // poll detects items -> tryHidePopoverAndBackdrop (ignored)
  rClose.flushTimers(60);  // stage 1 -> tryEscape closes closeMenuEl
  rClose.flushTimers(60);  // check sees closed -> schedules 60ms cleanup
  rClose.flushTimers(100); // cleanup resolves
  await pS2;
  assert.strictEqual(triggerClicks, 1, "S2: Closed via Escape without extra trigger click");
  assert.strictEqual(rClose.doc.querySelectorAll('[data-test-id^="bard-mode-option-"]').length, 0, "S2: Native menu closed");
  assert.strictEqual(rClose.doc.body.classList.contains("sg-hiding-mode-menu"), false);
  assert.ok(closePanel.classList.contains("sg-periodic-open"), "S2: Internal Escape MUST NOT close Periodic panel");

  // S3: Menu ignores body click & Escape, closes only on trigger toggle -> stage 2 toggles trigger cleanly!
  closeMode = "toggle";
  triggerClicks = 0;
  const pS3 = vm.runInContext("sgPeriodicProbeCatalogSilent({ force: true })", rClose.ctx);
  rClose.flushTimers(50);  // poll detects items
  rClose.flushTimers(60);  // stage 1 -> Escape (ignored)
  rClose.flushTimers(60);  // stage 2 -> trigger.click() closes closeMenuEl
  rClose.flushTimers(80);  // check sees closed
  rClose.flushTimers(100); // cleanup resolves
  await pS3;
  assert.strictEqual(triggerClicks, 2, "S3: Stage 2 toggled trigger once to close menu");
  assert.strictEqual(rClose.doc.querySelectorAll('[data-test-id^="bard-mode-option-"]').length, 0, "S3: Native menu closed");
  assert.strictEqual(rClose.doc.body.classList.contains("sg-hiding-mode-menu"), false);
  assert.ok(closePanel.classList.contains("sg-periodic-open"), "S3: Periodic panel remains open");
  console.log("PASS [S]: Silent probe clean native menu close (no double-toggle reopen, Escape/toggle fallback keeps Periodic panel open & leaves 0 overlay)");
}

async function runOrchestratorVmTests() {
  const contentJs = loadCombinedContentJs();
  const bgJs = fs.readFileSync(path.join(ROOT, "background.js"), "utf8");

  assert.ok(bgJs.includes('"ORCHESTRATOR_PREWARM_POOL" === e.type'), "background.js missing ORCHESTRATOR_PREWARM_POOL handler");
  assert.ok(bgJs.includes('"ORCHESTRATOR_RUN_SUBAGENTS" === e.type'), "background.js missing ORCHESTRATOR_RUN_SUBAGENTS handler");
  assert.ok(bgJs.includes('"ABORT_ORCHESTRATION" === e.type'), "background.js missing ABORT_ORCHESTRATION handler");
  assert.ok(contentJs.includes('case "ENABLE_ORCHESTRATOR":'), "content.js missing ENABLE_ORCHESTRATOR");
  assert.ok(contentJs.includes('case "DISABLE_ORCHESTRATOR":'), "content.js missing DISABLE_ORCHESTRATOR");
  assert.ok(contentJs.includes('case "ORCHESTRATOR_SUBAGENT_PROGRESS":'), "content.js missing ORCHESTRATOR_SUBAGENT_PROGRESS");
  assert.strictEqual(contentJs.includes("_sgSidebarHoverEnterTimer"), false, "Must not reference undefined _sgSidebarHoverEnterTimer");
  assert.strictEqual(contentJs.includes("_sgTopActionsHoverEnterTimer"), false, "Must not reference undefined _sgTopActionsHoverEnterTimer");

  // Verify sgCheckOrchWorkerResponseInTab is 100% self-contained when injected via chrome.scripting.executeScript
  const checkFnStart = bgJs.indexOf("function sgCheckOrchWorkerResponseInTab(");
  assert.ok(checkFnStart > 0, "sgCheckOrchWorkerResponseInTab not found in background.js");
  let bDepth = 0;
  let checkFnEnd = -1;
  for (let i = bgJs.indexOf("{", checkFnStart); i < bgJs.length; i++) {
    if (bgJs[i] === "{") bDepth++;
    else if (bgJs[i] === "}") {
      bDepth--;
      if (bDepth === 0) {
        checkFnEnd = i + 1;
        break;
      }
    }
  }
  const checkFnSrc = bgJs.slice(checkFnStart, checkFnEnd);
  assert.strictEqual(checkFnSrc.includes("checkResponseStatus"), false, "sgCheckOrchWorkerResponseInTab must NOT call external checkResponseStatus()");
  {
    const { doc: wDoc } = createMiniDom();
    const mr = wDoc.createElement("model-response");
    const panel = wDoc.createElement("div");
    panel.className = "markdown-main-panel";
    const p = wDoc.createElement("p");
    p.textContent = "#include <iostream>\nint main() { return 0; }";
    panel.appendChild(p);
    mr.appendChild(panel);
    wDoc.body.appendChild(mr);
    const isoCtx = vm.createContext({
      document: wDoc,
      Node: { TEXT_NODE: 3, ELEMENT_NODE: 1 }
    });
    vm.runInContext(checkFnSrc, isoCtx);
    const pollRes = vm.runInContext("sgCheckOrchWorkerResponseInTab(0)", isoCtx);
    assert.strictEqual(pollRes.phase, "streaming");
    assert.ok(pollRes.response && pollRes.response.includes("#include <iostream>"), "Self-contained sgCheckOrchWorkerResponseInTab must extract C++ response in isolated tab scope");
  }

  const startIdx = contentJs.indexOf("const SG_ORCHESTRATOR_CONFIG_KEY");
  const endIdx = contentJs.indexOf("const SG_PERIODIC_STORAGE_KEY");
  assert.ok(startIdx > 0 && endIdx > startIdx, "Orchestrator module slice markers not found");
  const orchSlice = contentJs.slice(startIdx, endIdx);
  assert.strictEqual(
    /\b(innerHTML|outerHTML|insertAdjacentHTML|document\.write)\b/.test(orchSlice),
    false,
    "Orchestrator module must have 0 HTML sinks"
  );

  const { doc, MiniEvent, getActiveElement } = createMiniDom({ forbidHtmlSinks: true });

  // Build composer & send button in MiniDom
  const inputWrap = doc.createElement("div");
  inputWrap.className = "input-area";
  const editor = doc.createElement("div");
  editor.className = "ql-editor";
  editor.setAttribute("contenteditable", "true");
  editor.setAttribute("role", "textbox");
  editor.getBoundingClientRect = () => ({ left: 100, top: 500, right: 700, bottom: 560, width: 600, height: 60 });
  inputWrap.appendChild(editor);
  doc.body.appendChild(inputWrap);

  const sendContainer = doc.createElement("div");
  sendContainer.className = "send-button-container";
  const sendBtn = doc.createElement("button");
  sendBtn.setAttribute("data-test-id", "send-button");
  sendBtn.setAttribute("aria-label", "Send message");
  sendContainer.appendChild(sendBtn);
  doc.body.appendChild(sendContainer);

  const lsMap = new Map();
  const localStorage = {
    getItem: k => (lsMap.has(k) ? lsMap.get(k) : null),
    setItem: (k, v) => lsMap.set(k, String(v)),
    removeItem: k => lsMap.delete(k)
  };

  let syncSetCalls = 0;
  let runtimeMessages = [];
  let ctx = null;

  const chrome = {
    storage: {
      sync: {
        get(_keys, cb) { cb({ extensionEnabled: true, orchestratorEnabled: true }); },
        set() { syncSetCalls++; }
      },
      onChanged: { addListener() {} }
    },
    runtime: {
      sendMessage(msg) {
        runtimeMessages.push(msg);
        if (msg.type === "ORCHESTRATOR_PREWARM_POOL") {
          return Promise.resolve({ success: true, runId: msg.runId, prewarmingCount: 1 });
        }
        if (msg.type === "ORCHESTRATOR_RUN_SUBAGENTS") {
          if (msg.tasks && msg.tasks[0] && msg.tasks[0].id === "__planner__") {
            return Promise.resolve({
              success: true,
              runId: msg.runId,
              results: [{
                id: "__planner__",
                role: "Planner",
                model: "neon",
                thinkingLevel: "medium",
                workerSlot: 1,
                reused: false,
                success: true,
                output: [
                  "<<<SG_PLAN_SUMMARY>>>",
                  "Phân rã thành 2 sub-agents chuyên biệt.",
                  "<<<SG_PLAN_SUMMARY_END>>>",
                  "<<<SG_AGENT_START>>>",
                  "ID: agent_1",
                  "ROLE: Kiến trúc sư Vulkan",
                  "MODEL: neon",
                  "THINKING: high",
                  "SKILL: cpp-vulkan",
                  "TASK: Thiết kế pipeline compute shader.",
                  "<<<SG_AGENT_END>>>",
                  "<<<SG_AGENT_START>>>",
                  "ID: agent_2",
                  "ROLE: Chuyên gia Kiểm thử",
                  "MODEL: hydrogen",
                  "THINKING: low",
                  "SKILL: none",
                  "TASK: Kiểm tra đồng bộ barrier và memory leak.",
                  "<<<SG_AGENT_END>>>"
                ].join("\n")
              }]
            });
          }
          // Sub-agent execution: emit live progress first!
          (msg.tasks || []).forEach((t, i) => {
            vm.runInContext(
              `sgHandleOrchestratorProgress(${JSON.stringify({
                runId: msg.runId,
                agentId: t.id,
                workerSlot: (i % 2) + 1,
                reused: i === 0,
                status: "streaming",
                model: t.model,
                thinkingLevel: t.thinkingLevel,
                chars: 128,
                preview: "Partial streaming output..."
              })})`,
              ctx
            );
          });
          return Promise.resolve({
            success: true,
            runId: msg.runId,
            results: (msg.tasks || []).map((t, i) => ({
              id: t.id,
              role: t.role,
              model: t.model,
              thinkingLevel: t.thinkingLevel,
              workerSlot: (i % 2) + 1,
              reused: i === 0,
              success: true,
              output: `Báo cáo hoàn chỉnh từ ${t.role} (${t.id})`
            }))
          });
        }
        return Promise.resolve({ ok: true });
      }
    }
  };

  // Auto-simulate main tab response when sendBtn is clicked during orchestration
  const submittedMainPrompts = [];
  sendBtn.addEventListener("click", () => {
    const resp = doc.createElement("model-response");
    const panel = doc.createElement("div");
    panel.className = "markdown-main-panel";
    const promptTxt = editor.textContent || "";
    submittedMainPrompts.push(promptTxt);
    if (promptTxt.includes("PHASE 1")) {
      panel.textContent = [
        "<<<SG_PLAN_SUMMARY>>>",
        "Chiến lược phân rã 4 nhánh.",
        "<<<SG_PLAN_SUMMARY_END>>>",
        "<<<SG_AGENT_START>>>",
        "ID: agent_1",
        "ROLE: System Architect",
        "MODEL: carbon",
        "THINKING: high",
        "SKILL: cpp-vulkan",
        "TASK: Phân tích kiến trúc hệ thống.",
        "<<<SG_AGENT_END>>>",
        "<<<SG_AGENT_START>>>",
        "ID: agent_2",
        "ROLE: Edge-Case Critic",
        "MODEL: hydrogen",
        "THINKING: low",
        "SKILL: none",
        "TASK: Kiểm tra các trường hợp biên.",
        "<<<SG_AGENT_END>>>",
        "<<<SG_AGENT_START>>>",
        "ID: agent_3",
        "ROLE: Perf Engineer",
        "MODEL: hydrogen",
        "THINKING: low",
        "SKILL: none",
        "TASK: Tối ưu cache locality.",
        "<<<SG_AGENT_END>>>",
        "<<<SG_AGENT_START>>>",
        "ID: agent_4",
        "ROLE: Security Reviewer",
        "MODEL: hydrogen",
        "THINKING: low",
        "SKILL: none",
        "TASK: Kiểm tra memory safety.",
        "<<<SG_AGENT_END>>>"
      ].join("\n");
    } else {
      panel.textContent = "Câu trả lời tổng hợp cuối cùng từ Orchestrator.";
    }
    resp.appendChild(panel);
    doc.body.appendChild(resp);
  });

  ctx = vm.createContext({
    window: { location: { pathname: "/u/0/app" }, innerWidth: 1280, innerHeight: 800 },
    document: doc,
    localStorage,
    chrome,
    KeyboardEvent: MiniEvent,
    Event: MiniEvent,
    MouseEvent: MiniEvent,
    setTimeout: fn => { fn(); return 1; },
    clearTimeout: () => {},
    setInterval: () => 1,
    clearInterval: () => {},
    isExtensionEnabled: true,
    sgIsImeComposing: e => Boolean(e && (e.isComposing || e.keyCode === 229)),
    findPromptInput: () => editor,
    findInputAnchor: () => editor,
    getHorizontalInputRect: () => editor.getBoundingClientRect(),
    loadEffectiveSkills: async () => ({
      skills: [{
        id: "cpp-vulkan",
        name: "C++23 & Vulkan Compute",
        aliases: ["/vk/"],
        enabled: true,
        instructions: "Prefer RAII and explicit Vulkan memory barriers."
      }]
    }),
    sgPeriodicLoadCatalog: () => ({
      scanned: true,
      elements: {
        H: { released: true, locked: false },
        Ne: { released: true, locked: false },
        C: { released: true, locked: true }
      }
    }),
    showToast: () => {},
    updateCounterPosition: () => {}
  });

  vm.runInContext(orchSlice, ctx);

  // 1. Verify #sg-orchestrate-btn injected
  const orchBtn = doc.getElementById("sg-orchestrate-btn");
  assert.ok(orchBtn, "#sg-orchestrate-btn must be injected when orchestratorEnabled=true");

  // 2. Verify Config Popover (role="dialog", Escape focus restore, localStorage config persistence)
  const cfgBtn = orchBtn.querySelector('[data-sg-orch-config-trigger="true"]');
  cfgBtn.focus();
  cfgBtn.click();
  const cfgPop = doc.getElementById("sg-orchestrator-config-popover");
  assert.ok(cfgPop && cfgPop.classList.contains("sg-orch-popover-open"), "Config popover should open");
  assert.strictEqual(cfgPop.getAttribute("role"), "dialog");
  doc.dispatchEvent(new MiniEvent("keydown", { key: "Escape", bubbles: true }));
  assert.strictEqual(cfgPop.classList.contains("sg-orch-popover-open"), false, "Escape closes config popover");
  assert.strictEqual(getActiveElement(), cfgBtn, "Escape restores focus to config trigger (OPT-007)");

  // 3. Verify Fault-Tolerant Parser (Tier 1, Tier 2, Tier 3, max cap 4, locked model fallback C -> Ne, Skill injection)
  const skills = [{ id: "cpp-vulkan", name: "Vulkan", aliases: ["/vk/"], enabled: true, instructions: "Use RAII." }];
  const tier1 = vm.runInContext(
    `sgParseOrchestratorPlan(
      "<<<SG_AGENT_START>>>\\nID: a1\\nROLE: Role1\\nMODEL: carbon\\nTHINKING: high\\nSKILL: cpp-vulkan\\nTASK: Do Vulkan\\n<<<SG_AGENT_END>>>\\n" +
      "<<<SG_AGENT_START>>>\\nID: a2\\nROLE: Role2\\nMODEL: neon\\nTHINKING: medium\\nTASK: Do Review\\n<<<SG_AGENT_END>>>\\n" +
      "<<<SG_AGENT_START>>>\\nID: a3\\nROLE: Role3\\nTASK: T3\\n<<<SG_AGENT_END>>>\\n" +
      "<<<SG_AGENT_START>>>\\nID: a4\\nROLE: Role4\\nTASK: T4\\n<<<SG_AGENT_END>>>\\n" +
      "<<<SG_AGENT_START>>>\\nID: a5\\nROLE: Role5\\nTASK: T5\\n<<<SG_AGENT_END>>>",
      "Thiết kế hệ thống C++",
      { mode: "in_chat", maxAgents: 4, modelPolicy: "adaptive" },
      ${JSON.stringify(skills)}
    )`,
    ctx
  );
  assert.strictEqual(tier1.tasks.length, 4, "Must cap strictly at 4 sub-agents even if 5 blocks present");
  assert.strictEqual(tier1.tasks[0].model, "neon", "Locked Carbon (Ultra) must safely downgrade to unlocked Neon");
  assert.strictEqual(tier1.tasks[0].skillId, "cpp-vulkan", "Skill ID matched from Skills Registry");
  assert.ok(tier1.tasks[0].prompt.includes("Use RAII."), "Skill instructions injected into sub-agent worker prompt");

  const tier3Fallback = vm.runInContext(
    `sgParseOrchestratorPlan("Unstructured response without tags", "Tối ưu hiệu năng Vulkan Compute", { mode: "in_chat", maxAgents: 3, modelPolicy: "quota_saver" }, [])`,
    ctx
  );
  assert.strictEqual(tier3Fallback.usedFallback, true, "Tier 3 fallback activated on unstructured response");
  assert.strictEqual(tier3Fallback.tasks.length, 3);
  assert.ok(tier3Fallback.tasks.every(t => t.model === "hydrogen" && t.thinkingLevel === "low"), "Quota saver forces 4 Hydrogen · Low");

  // 3b. Verify Planner Prompt hardening (All 7 cross-checked defects resolved)
  const sampleSkillsWithSlash = [
    { id: "acknowledgment", name: "Acknowledgment", description: "Activate when the user invokes /ac/, /ack/, or /acknowledgment/ to confirm rules.", enabled: true },
    { id: "no-code-mode", name: "No-Code Mode", description: "Activate when the user uses /nc/ or /no code/.", enabled: true },
    { id: "analyze-mode", name: "Analyze Mode", description: "Activate when the user uses /an/ or /analyze/, or asks to examine mechanisms.", enabled: true }
  ];
  const quotaSaverPlannerPrompt = vm.runInContext(
    `sgBuildOrchestratorPlannerPrompt("Phân tích hệ thống", { mode: "in_chat", maxAgents: 2, modelPolicy: "quota_saver" }, ${JSON.stringify(sampleSkillsWithSlash)}, null)`,
    ctx
  );
  assert.strictEqual(quotaSaverPlannerPrompt.includes("2 to 2"), false, "Must not render '2 to 2' when maxAgents=2");
  assert.strictEqual(quotaSaverPlannerPrompt.includes("between 2 and 2"), false, "Must not render 'between 2 and 2'");
  assert.ok(quotaSaverPlannerPrompt.includes("1 to 2"), "Renders flexible range '1 to 2' when maxAgents=2");
  assert.strictEqual(quotaSaverPlannerPrompt.includes("MODEL:"), false, "Quota-saver mode omits constant MODEL field from output template");
  assert.strictEqual(quotaSaverPlannerPrompt.includes("THINKING:"), false, "Quota-saver mode omits constant THINKING field from output template");
  assert.strictEqual(quotaSaverPlannerPrompt.includes("/an/"), false, "Strips live slash triggers from skill descriptions so Mode 1 Skill Injection is never falsely triggered");
  assert.strictEqual(quotaSaverPlannerPrompt.includes("acknowledgment:"), false, "Filters out meta acknowledgment skill from sub-agent catalog");
  assert.strictEqual(quotaSaverPlannerPrompt.includes("no-code-mode:"), false, "Filters out meta no-code-mode skill from sub-agent catalog");
  assert.ok(quotaSaverPlannerPrompt.includes("DATA BOUNDARY (ANTI-HIJACKING)"), "Includes explicit anti-hijacking untrusted data boundary rule");

  // Verify line-anchored delimiter parser does not truncate when TASK mentions inline <<<SG_AGENT_END>>>
  const inlineDelimiterTest = vm.runInContext(
    `sgParseOrchestratorPlan(
      "<<<SG_AGENT_START>>>\\nID: agent_1\\nROLE: Prompt Auditor\\nSKILL: analyze-mode\\nTASK:\\nKiểm tra chuỗi inline <<<SG_AGENT_END>>> nằm giữa dòng văn bản.\\n- Expected Deliverable: Báo cáo đầy đủ.\\n<<<SG_AGENT_END>>>",
      "Đánh giá prompt",
      { mode: "in_chat", maxAgents: 2, modelPolicy: "quota_saver" },
      ${JSON.stringify(sampleSkillsWithSlash)}
    )`,
    ctx
  );
  assert.strictEqual(inlineDelimiterTest.tasks.length, 1);
  assert.ok(inlineDelimiterTest.tasks[0].task.includes("Expected Deliverable: Báo cáo đầy đủ."), "Line-anchored delimiter regex must not truncate on inline <<<SG_AGENT_END>>> mention");

  // 4. Verify End-to-End Option C In-Chat 3-Phase Run (Prewarm + Main Tab Planner + 4-Worker Parallel Sub-Agents + Main Tab Synthesizer)
  assert.ok(bgJs.includes("const SG_ORCH_MAX_WARM_WORKERS = 4;"), "background.js must allow up to 4 parallel background workers");
  runtimeMessages = [];
  submittedMainPrompts.length = 0;
  const okInChat = await vm.runInContext(`sgStartOrchestration("Thiết kế engine Vulkan C++23", { mode: "in_chat", maxAgents: 4, modelPolicy: "quota_saver" })`, ctx);
  assert.strictEqual(okInChat, true, "In-Chat 3-Phase orchestration should complete");
  assert.ok(runtimeMessages.some(m => m.type === "ORCHESTRATOR_PREWARM_POOL"), "Should pre-warm worker pool in parallel during Phase 1");
  const subAgentDispatch = runtimeMessages.find(m => m.type === "ORCHESTRATOR_RUN_SUBAGENTS");
  assert.ok(subAgentDispatch, "Should dispatch sub-agents to warm pool in Phase 2");
  assert.strictEqual(subAgentDispatch.maxConcurrency, 4, "4 sub-agents must dispatch with maxConcurrency=4 for true background parallelism");
  const phase3Prompt = submittedMainPrompts[submittedMainPrompts.length - 1] || "";
  assert.ok(phase3Prompt.includes("Báo cáo hoàn chỉnh từ System Architect (agent_1)"), "Phase 3 synthesis prompt must include real Agent #1 output");
  assert.ok(phase3Prompt.includes("Báo cáo hoàn chỉnh từ Security Reviewer (agent_4)"), "Phase 3 synthesis prompt must include real Agent #4 output");
  assert.strictEqual(phase3Prompt.includes("[Sub-agent failed or timed out"), false, "Phase 3 synthesis must NEVER mark succeeded sub-agents as timed out");
  const card = doc.getElementById("sg-orchestrator-card");
  assert.ok(card && card.textContent.includes("Completed ✓"), "Live Orchestration Card shows Completed state");

  // 5. Verify End-to-End Option C Clean 1-Turn Run (Background Planner with keepPoolWarm=true + Warm Reused Sub-Agents + Single Main Tab Synthesis Turn)
  runtimeMessages = [];
  const okClean = await vm.runInContext(`sgStartOrchestration("Phân tích bộ nhớ Vulkan", { mode: "clean_1turn", maxAgents: 2, modelPolicy: "adaptive" })`, ctx);
  assert.strictEqual(okClean, true, "Clean 1-Turn orchestration should complete");
  const bgCalls = runtimeMessages.filter(m => m.type === "ORCHESTRATOR_RUN_SUBAGENTS");
  assert.strictEqual(bgCalls.length, 2, "Clean 1-Turn makes 1 background planner call (keepPoolWarm=true) + 1 parallel sub-agents call");
  assert.strictEqual(bgCalls[0].keepPoolWarm, true, "Planner call keeps Warm Worker #1 alive for immediate reuse in Phase 2");
  assert.strictEqual(bgCalls[1].keepPoolWarm, false, "Phase 2 closes warm pool after sub-agents finish");

  // 6. Suite [U]: Verify All 5 Cases of Unified Adaptive Skill-Aware Prompt Injector
  const registryJson = JSON.parse(fs.readFileSync(path.join(ROOT, "skills/registry.json"), "utf8"));
  const bundledOrchSkill = (registryJson.skills || []).find(s => s && s.id === "orchestrate-mode");
  assert.ok(bundledOrchSkill, "skills/registry.json must register orchestrate-mode");
  assert.ok(fs.existsSync(path.join(ROOT, bundledOrchSkill.file)), "skills/orchestrate-mode.md must exist on disk");

  const testSkillCatalog = [
    { id: "orchestrate-mode", name: "Orchestrate Mode", mode: "both", enabled: true, version: 1, hash: "hash_orch_v1", description: "Coordinate a 3-phase multi-agent workflow." },
    { id: "analyze-mode", name: "Analyze Mode", mode: "both", enabled: true, version: 1, hash: "hash_an_v1", description: "Objectively identify mechanisms. Trigger when the user uses /analyze/ or /an/." },
    { id: "debug-mode", name: "Debug Mode", mode: "both", enabled: true, version: 1, hash: "hash_db_v1", description: "Diagnose root causes. Trigger when the user uses /debug/ or /db/." },
    { id: "vulkan-custom", name: "Vulkan Compute Custom", mode: "inject", enabled: true, version: 1, hash: "hash_vk_v1", description: "Optimize subgroup barriers and shared memory bank conflicts." }
  ];

  // Clear any prior user-query or session cache before testing Case 1
  doc.querySelectorAll("user-query, model-response").forEach(n => n.remove());
  vm.runInContext("_sgOrchChatLoadedHashes.clear()", ctx);

  // Case 1: 0 pre-loaded skills in ledger -> Full Standalone Injector
  const case1Readiness = vm.runInContext(
    `sgOrchResolveSkillReadiness(${JSON.stringify(testSkillCatalog)}, { mode: "in_chat", maxAgents: 3, modelPolicy: "quota_saver" }, {})`,
    ctx
  );
  assert.strictEqual(case1Readiness.orchestrateReady, false, "Case 1: orchestrateReady must be false when ledger is empty");
  assert.strictEqual(case1Readiness.orchestrateSource, "unloaded");
  assert.strictEqual(case1Readiness.syncedSkills.length, 0);
  assert.strictEqual(case1Readiness.unloadedSkills.length, 3);
  const case1Prompt = vm.runInContext(
    `sgBuildOrchestratorPlannerPrompt("Thiết kế Vulkan Engine", { mode: "in_chat", maxAgents: 3, modelPolicy: "quota_saver" }, ${JSON.stringify(testSkillCatalog)}, null, ${JSON.stringify(case1Readiness)})`,
    ctx
  );
  assert.ok(case1Prompt.includes("**CRITICAL ORCHESTRATOR DIRECTIVE — PHASE 1"), "Case 1: Uses Full Standalone Prompt Injector");

  // Case 2: All skills synced on active account (/u/0) -> Compact Trigger Injector
  const fullLedger = {
    u_0: {
      bundleVersion: "1.1.0",
      migrated: {
        "orchestrate-mode": { version: 1, hash: "hash_orch_v1" },
        "analyze-mode": { version: 1, hash: "hash_an_v1" },
        "debug-mode": { version: 1, hash: "hash_db_v1" }
      }
    }
  };
  const allSyncedCatalog = testSkillCatalog.filter(s => s.id !== "vulkan-custom");
  const case2Readiness = vm.runInContext(
    `sgOrchResolveSkillReadiness(${JSON.stringify(allSyncedCatalog)}, { mode: "in_chat", maxAgents: 3, modelPolicy: "quota_saver" }, ${JSON.stringify(fullLedger)})`,
    ctx
  );
  assert.strictEqual(case2Readiness.orchestrateReady, true, "Case 2: orchestrateReady=true when synced in ledger");
  assert.strictEqual(case2Readiness.orchestrateSource, "account_synced");
  assert.strictEqual(case2Readiness.syncedSkills.length, 2);
  assert.strictEqual(case2Readiness.unloadedSkills.length, 0);
  const case2Prompt = vm.runInContext(
    `sgBuildOrchestratorPlannerPrompt("Thiết kế Vulkan Engine", { mode: "in_chat", maxAgents: 3, modelPolicy: "quota_saver" }, ${JSON.stringify(allSyncedCatalog)}, null, ${JSON.stringify(case2Readiness)})`,
    ctx
  );
  assert.ok(case2Prompt.startsWith("[@orchestrate-mode :: PHASE_1_PLANNER]"), "Case 2: Uses Compact Trigger Injector");
  assert.ok(case2Prompt.includes("PRELOADED_SKILLS (Assign by ID or none): analyze-mode, debug-mode"), "Case 2: Lists synced skills by ID on 1 line");
  assert.strictEqual(case2Prompt.includes("UNLOADED_OR_CUSTOM_SKILLS"), false, "Case 2: Omits unloaded skills section when all are synced");
  assert.ok(case2Prompt.length < case1Prompt.length * 0.65, "Case 2: Compact prompt is significantly shorter than Full Standalone prompt");

  // Case 3A: Partial Sync (@orchestrate-mode + analyze/debug synced, but vulkan-custom is unloaded)
  const case3AReadiness = vm.runInContext(
    `sgOrchResolveSkillReadiness(${JSON.stringify(testSkillCatalog)}, { mode: "in_chat", maxAgents: 3, modelPolicy: "quota_saver" }, ${JSON.stringify(fullLedger)})`,
    ctx
  );
  assert.strictEqual(case3AReadiness.orchestrateReady, true);
  assert.strictEqual(case3AReadiness.syncedSkills.length, 2);
  assert.strictEqual(case3AReadiness.unloadedSkills.length, 1);
  const case3APrompt = vm.runInContext(
    `sgBuildOrchestratorPlannerPrompt("Thiết kế Vulkan Engine", { mode: "in_chat", maxAgents: 3, modelPolicy: "quota_saver" }, ${JSON.stringify(testSkillCatalog)}, null, ${JSON.stringify(case3AReadiness)})`,
    ctx
  );
  assert.ok(case3APrompt.includes("PRELOADED_SKILLS (Assign by ID or none): analyze-mode, debug-mode"));
  assert.ok(case3APrompt.includes("UNLOADED_OR_CUSTOM_SKILLS (Assign by ID or none):\n- vulkan-custom: Vulkan Compute Custom — Optimize subgroup barriers"), "Case 3A: Appends description ONLY for unloaded/custom skills");

  // Case 3B: Stale / Modified @orchestrate-mode (hash mismatch in ledger -> falls back to Full Injector)
  const staleLedger = {
    u_0: {
      bundleVersion: "1.1.0",
      migrated: {
        "orchestrate-mode": { version: 1, hash: "OLD_STALE_HASH" },
        "analyze-mode": { version: 1, hash: "hash_an_v1" }
      }
    }
  };
  const case3BReadiness = vm.runInContext(
    `sgOrchResolveSkillReadiness(${JSON.stringify(testSkillCatalog)}, { mode: "in_chat", maxAgents: 3, modelPolicy: "quota_saver" }, ${JSON.stringify(staleLedger)})`,
    ctx
  );
  assert.strictEqual(case3BReadiness.orchestrateReady, false, "Case 3B: Modified @orchestrate-mode with mismatched hash must fall back to Full Injector");
  assert.strictEqual(case3BReadiness.orchestrateSource, "stale_override");

  // Case 5A & 5B: In-Chat Multi-Turn Reuse vs Clean 1-Turn Isolation
  vm.runInContext(`sgOrchMarkChatOrchestrateLoaded("hash_orch_v1")`, ctx);
  const uqNode = doc.createElement("user-query");
  uqNode.textContent = "Previous turn in this conversation";
  doc.body.appendChild(uqNode);
  const case5AReadiness = vm.runInContext(
    `sgOrchResolveSkillReadiness(${JSON.stringify(testSkillCatalog)}, { mode: "in_chat", maxAgents: 3, modelPolicy: "quota_saver" }, {})`,
    ctx
  );
  assert.strictEqual(case5AReadiness.orchestrateReady, true, "Case 5A: 2nd turn in same in_chat conversation reuses chat context and switches to Compact Injector");
  assert.strictEqual(case5AReadiness.orchestrateSource, "chat_context");

  const case5BReadiness = vm.runInContext(
    `sgOrchResolveSkillReadiness(${JSON.stringify(testSkillCatalog)}, { mode: "clean_1turn", maxAgents: 3, modelPolicy: "quota_saver" }, {})`,
    ctx
  );
  assert.strictEqual(case5BReadiness.orchestrateReady, false, "Case 5B: clean_1turn runs Planner in isolated Temp-Chat worker so it must NOT assume main-tab chat context when account ledger is empty");

  // 7. Verify Clean Teardown & 0 sync writes
  vm.runInContext(`sgSetOrchestratorEnabled(false)`, ctx);
  assert.strictEqual(doc.getElementById("sg-orchestrate-btn"), null, "Teardown removes #sg-orchestrate-btn");
  assert.strictEqual(doc.getElementById("sg-orchestrator-card"), null, "Teardown removes #sg-orchestrator-card");
  assert.strictEqual(syncSetCalls, 0, "Orchestrator must make 0 chrome.storage.sync.set writes");

  console.log("PASS [T]: Multi-Agent Orchestrator Option C (3-tier parser, Skills Registry + Periodic Catalog routing, parallel prewarm, Warm-Pool reuse, In-Chat & Clean 1-Turn, 0 HTML sinks, 0 sync writes)");
  console.log("PASS [U]: Adaptive Skill-Aware Prompt Injector (All 5 Cases: Unloaded Full Fallback, Account-Synced Compact Trigger, Partial Sync Split Catalog, Stale Hash Override, In-Chat Multi-Turn Reuse vs Clean 1-Turn Isolation)");
}

(async () => {
  await runPopupVmTests();
  await runContentPeriodicVmTests();
  await runOrchestratorVmTests();
  console.log("\nALL VM TESTS PASSED!");
})().catch(err => {
  console.error("VM TEST FAILED:", err);
  process.exit(1);
});
