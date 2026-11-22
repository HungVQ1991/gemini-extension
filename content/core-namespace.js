const SG = (() => {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  const existing = root.SG && typeof root.SG === "object" ? root.SG : {};
  root.SG = existing;
  if (typeof window !== "undefined" && window !== root) {
    window.SG = existing;
  }
  return existing;
})();

const SG_IS_SILENT_BG_WORKER_TAB = Boolean(
  "undefined" != typeof window &&
  window.location &&
  /#(?:.*&)?sg_(?:orch|bg)_worker=1\b/i.test(String(window.location.hash || ""))
);
let isExtensionEnabled = !SG_IS_SILENT_BG_WORKER_TAB;
let isFocusShortcutEnabled = !SG_IS_SILENT_BG_WORKER_TAB;
var _sgBootstrapSyncCache = null,
  _sgBootstrapSyncPromise = null,
  _sgBootstrapSyncListenerBound = !1;

function sgPickSyncKeys(e, t) {
  const n = {};
  if (!e || "object" != typeof e) return n;
  if (null == t) return Object.assign({}, e);
  if ("string" == typeof t) return void 0 !== e[t] && (n[t] = e[t]), n;
  if (Array.isArray(t)) {
    for (const o of t) void 0 !== e[o] && (n[o] = e[o]);
    return n;
  }
  if ("object" == typeof t) {
    for (const o of Object.keys(t)) n[o] = void 0 !== e[o] ? e[o] : t[o];
    return n;
  }
  return n;
}

function sgSyncMasterLocalStorageFlag(enabled) {
  if (SG_IS_SILENT_BG_WORKER_TAB) return;
  const isOn = enabled !== false;
  try {
    if ("undefined" != typeof localStorage) {
      localStorage.setItem("sg_ext_enabled", isOn ? "1" : "0");
      if (!isOn) localStorage.setItem("sg_cp_active", "0");
    }
  } catch (e) {}
  try {
    if (!isOn && "undefined" != typeof document && document.documentElement) {
      document.documentElement.setAttribute("data-sg-cp-active", "0");
    }
  } catch (e) {}
}

function sgApplyBootstrapSyncDelta(changes, areaName) {
  if ("sync" === areaName && _sgBootstrapSyncCache && changes) {
    for (const key of Object.keys(changes)) {
      void 0 !== changes[key].newValue
        ? (_sgBootstrapSyncCache[key] = changes[key].newValue)
        : delete _sgBootstrapSyncCache[key];
    }
    void 0 !== changes.extensionEnabled &&
      sgSyncMasterLocalStorageFlag(!1 !== changes.extensionEnabled.newValue);
  }
}

function sgEnsureBootstrapSyncStorageListener() {
  if (SG_IS_SILENT_BG_WORKER_TAB || _sgBootstrapSyncListenerBound) return;
  if (SG.storage && typeof SG.storage.onChanged === "function") {
    _sgBootstrapSyncListenerBound = !0;
    SG.storage.onChanged("core:bootstrap-sync-cache", sgApplyBootstrapSyncDelta, { area: "sync" });
    return;
  }
  Promise.resolve().then(() => {
    if (SG_IS_SILENT_BG_WORKER_TAB || _sgBootstrapSyncListenerBound) return;
    if (SG.storage && typeof SG.storage.onChanged === "function") {
      _sgBootstrapSyncListenerBound = !0;
      SG.storage.onChanged("core:bootstrap-sync-cache", sgApplyBootstrapSyncDelta, { area: "sync" });
    } else if ("undefined" != typeof chrome && chrome.storage && chrome.storage.onChanged) {
      _sgBootstrapSyncListenerBound = !0;
      chrome.storage.onChanged.addListener(sgApplyBootstrapSyncDelta);
    }
  });
}

function sgGetBootstrapSync() {
  if (SG_IS_SILENT_BG_WORKER_TAB) {
    return Promise.resolve((_sgBootstrapSyncCache = { extensionEnabled: !1 }));
  }
  if (_sgBootstrapSyncPromise) return _sgBootstrapSyncPromise;
  sgEnsureBootstrapSyncStorageListener();
  _sgBootstrapSyncPromise =
    "undefined" != typeof chrome && chrome.storage && chrome.storage.sync && "function" == typeof chrome.storage.sync.get
      ? new Promise((e) => {
          try {
            chrome.storage.sync.get(null, (t) => {
              const n = t && "object" == typeof t ? Object.assign({}, t) : {};
              (_sgBootstrapSyncCache = n), e(n);
            });
          } catch (t) {
            (_sgBootstrapSyncCache = {}), e(_sgBootstrapSyncCache);
          }
        })
      : Promise.resolve((_sgBootstrapSyncCache = {}));
  return _sgBootstrapSyncPromise;
}

function sgSyncGetCached(e, t) {
  const n = () => sgGetBootstrapSync().then((t) => sgPickSyncKeys(t, e));
  return "function" == typeof t
    ? void n().then((e) => {
        try {
          t(e);
        } catch (e) {}
      })
    : n();
}

SG_IS_SILENT_BG_WORKER_TAB || sgSyncGetCached(["extensionEnabled", "focusShortcutEnabled"], (e) => {
  e &&
    (sgSyncMasterLocalStorageFlag(!1 !== e.extensionEnabled),
    !1 === e.extensionEnabled && (isExtensionEnabled = !1),
    !1 === e.focusShortcutEnabled && (isFocusShortcutEnabled = !1));
});

function sgIsImeComposing(e) {
  return Boolean(e && (e.isComposing || 229 === e.keyCode || "Process" === e.key));
}

const sgObserverRegistry = {
  _uiRefreshHandlers: new Map(),
  _uiRefreshObserver: null,
  _uiRefreshRAFPending: !1,
  _uiRefreshTimer: null,
  _uiRefreshLastRun: 0,
  _pendingHiddenFlush: !1,
  _visBound: !1,
  _hasActiveBgWork() {
    return (
      ("undefined" != typeof messageQueue && Array.isArray(messageQueue) && messageQueue.length > 0) ||
      ("undefined" != typeof activeChainState && Boolean(activeChainState))
    );
  },
  registerUIRefresh(e, t) {
    if (SG_IS_SILENT_BG_WORKER_TAB) return;
    this._uiRefreshHandlers.set(e, t), this._ensureUIRefreshObserver();
  },
  unregisterUIRefresh(e) {
    this._uiRefreshHandlers.delete(e), 0 === this._uiRefreshHandlers.size && this._teardownUIRefreshObserver();
  },
  _flushUIRefresh() {
    this._uiRefreshRAFPending = !1;
    if (SG_IS_SILENT_BG_WORKER_TAB) return;
    if ("undefined" != typeof document && document.hidden && !this._hasActiveBgWork()) {
      this._pendingHiddenFlush = !0;
      return;
    }
    this._pendingHiddenFlush = !1;
    this._uiRefreshLastRun = Date.now();
    for (const e of this._uiRefreshHandlers.values()) {
      try {
        e();
      } catch (e) {
        console.error("[SG] UI refresh handler error:", e);
      }
    }
  },
  _scheduleUIRefresh() {
    if (SG_IS_SILENT_BG_WORKER_TAB) return;
    if ("undefined" != typeof document && document.hidden && !this._hasActiveBgWork()) {
      this._pendingHiddenFlush = !0;
      return;
    }
    if (this._uiRefreshRAFPending || this._uiRefreshTimer) return;
    const elapsed = Date.now() - this._uiRefreshLastRun;
    if (elapsed >= 100) {
      this._uiRefreshRAFPending = !0;
      requestAnimationFrame(() => this._flushUIRefresh());
    } else {
      this._uiRefreshTimer = setTimeout(() => {
        this._uiRefreshTimer = null;
        if (!this._uiRefreshRAFPending) {
          this._uiRefreshRAFPending = !0;
          requestAnimationFrame(() => this._flushUIRefresh());
        }
      }, 100 - elapsed);
    }
  },
  _ensureUIRefreshObserver() {
    if (SG_IS_SILENT_BG_WORKER_TAB) return;
    if (!this._visBound && "undefined" != typeof document && "function" == typeof document.addEventListener) {
      this._visBound = !0;
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden && this._pendingHiddenFlush && this._uiRefreshHandlers.size > 0) {
          this._pendingHiddenFlush = !1;
          this._scheduleUIRefresh();
        }
      });
    }
    this._uiRefreshObserver ||
      ((this._uiRefreshObserver = new MutationObserver(() => {
        this._scheduleUIRefresh();
      })),
      this._uiRefreshObserver.observe(document.body, {
        childList: !0,
        subtree: !0
      }));
  },
  _teardownUIRefreshObserver() {
    this._uiRefreshTimer && (clearTimeout(this._uiRefreshTimer), (this._uiRefreshTimer = null)),
      this._uiRefreshObserver && (this._uiRefreshObserver.disconnect(), (this._uiRefreshObserver = null));
  }
};

const SG_FORBIDDEN_HTML_TAGS = new Set(["script", "iframe", "object", "embed", "applet", "base", "meta", "link"]);
const SG_UNSAFE_URL_ATTRS = new Set(["href", "src", "xlink:href", "formaction", "action"]);
const SG_UNSAFE_URL_RE = /^(?:javascript|vbscript|data\s*:\s*text\/html)\s*:/i;

function sgSanitizeParsedFragment(root) {
  if (!root || "function" != typeof root.querySelectorAll) return;
  const nodes = Array.from(root.querySelectorAll("*"));
  for (const el of nodes) {
    const tag = String(el.tagName || "").toLowerCase();
    if (SG_FORBIDDEN_HTML_TAGS.has(tag)) {
      if ("function" == typeof el.remove) el.remove();
      else if (el.parentNode && "function" == typeof el.parentNode.removeChild) el.parentNode.removeChild(el);
      continue;
    }
    const attrs = el.attributes ? Array.from(el.attributes) : [];
    for (const attr of attrs) {
      const name = String(attr && attr.name || "").toLowerCase();
      const val = String(attr && attr.value || "").trim();
      if (name.startsWith("on")) {
        el.removeAttribute(attr.name);
      } else if (SG_UNSAFE_URL_ATTRS.has(name) && SG_UNSAFE_URL_RE.test(val)) {
        el.removeAttribute(attr.name);
      }
    }
  }
}

function sgMountNodes(el, nodes) {
  if ("function" == typeof el.replaceChildren) {
    el.replaceChildren(...nodes);
  } else {
    while (el.firstChild) el.removeChild(el.firstChild);
    for (const n of nodes) el.appendChild(n);
  }
}

var _sgTrustedHtmlPolicy = null,
  _sgTrustedPolicyAttempted = !1,
  _sgSafeHtmlParseWarned = !1;

function sgGetTrustedHtmlPolicy() {
  if (_sgTrustedPolicyAttempted) return _sgTrustedHtmlPolicy;
  _sgTrustedPolicyAttempted = !0;
  try {
    const tt =
      ("undefined" != typeof window && window.trustedTypes) ||
      ("undefined" != typeof globalThis && globalThis.trustedTypes) ||
      null;
    if (!tt) return null;
    if ("function" == typeof tt.createPolicy) {
      try {
        _sgTrustedHtmlPolicy = tt.createPolicy("sg-safe-html", {
          createHTML: (s) => String(s)
        });
      } catch (e) {
        if (tt.defaultPolicy && "function" == typeof tt.defaultPolicy.createHTML) {
          _sgTrustedHtmlPolicy = tt.defaultPolicy;
        }
      }
    } else if (tt.defaultPolicy && "function" == typeof tt.defaultPolicy.createHTML) {
      _sgTrustedHtmlPolicy = tt.defaultPolicy;
    }
  } catch (e) {}
  return _sgTrustedHtmlPolicy;
}

function sgParseHtmlDocument(str) {
  const policy = sgGetTrustedHtmlPolicy();
  let trustedPayload = str;
  if (policy && "function" == typeof policy.createHTML) {
    try {
      trustedPayload = policy.createHTML(str);
    } catch (e) {
      trustedPayload = str;
    }
  }
  let lastErr = null;
  if ("undefined" != typeof DOMParser) {
    try {
      const parsed = new DOMParser().parseFromString(trustedPayload, "text/html");
      if (parsed && parsed.body) return { doc: parsed, error: null };
    } catch (e) {
      lastErr = e;
    }
    if (trustedPayload !== str) {
      try {
        const parsedRaw = new DOMParser().parseFromString(str, "text/html");
        if (parsedRaw && parsedRaw.body) return { doc: parsedRaw, error: null };
      } catch (e) {
        lastErr = e;
      }
    }
  }
  if ("undefined" != typeof Document && "function" == typeof Document.parseHTMLUnsafe) {
    try {
      const unsafeDoc = Document.parseHTMLUnsafe(trustedPayload);
      if (unsafeDoc && unsafeDoc.body) return { doc: unsafeDoc, error: null };
    } catch (e) {
      lastErr = e;
    }
    if (trustedPayload !== str) {
      try {
        const unsafeRaw = Document.parseHTMLUnsafe(str);
        if (unsafeRaw && unsafeRaw.body) return { doc: unsafeRaw, error: null };
      } catch (e) {
        lastErr = e;
      }
    }
  }
  return { doc: null, error: lastErr };
}

function sgSetSafeHtml(el, html) {
  if (!el) return el;
  const str = html == null ? "" : String(html);
  if (!str) {
    if ("function" == typeof el.replaceChildren) el.replaceChildren();
    else el.textContent = "";
    return el;
  }
  const res = sgParseHtmlDocument(str);
  const body = res && res.doc && res.doc.body;
  if (body) {
    sgSanitizeParsedFragment(body);
    const targetDoc = el.ownerDocument || ("undefined" != typeof document ? document : null);
    const imported = Array.from(body.childNodes).map((node) =>
      targetDoc && "function" == typeof targetDoc.importNode ? targetDoc.importNode(node, !0) : node
    );
    sgMountNodes(el, imported);
    return el;
  }
  if (res && res.error && !_sgSafeHtmlParseWarned) {
    _sgSafeHtmlParseWarned = !0;
    try {
      console.warn("[SG.dom.setSafeHtml] HTML parse failed:", res.error && res.error.message ? res.error.message : res.error);
    } catch (e) {}
  }
  el.textContent = str;
  return el;
}

function sgCaptureEditorLines(el) {
  if (!el) return [];
  const children = el.children ? Array.from(el.children) : [];
  if (children.length > 0) return children.map((c) => c.textContent || "");
  return String(el.textContent || "").split("\n");
}

function sgRestoreEditorLines(el, lines) {
  if (!el) return;
  const targetDoc = el.ownerDocument || ("undefined" != typeof document ? document : null);
  const arr = Array.isArray(lines) ? lines : String(lines || "").split("\n");
  const frag = [];
  for (const line of arr) {
    if (!targetDoc || "function" != typeof targetDoc.createElement) break;
    const p = targetDoc.createElement("p");
    if (line) p.textContent = line;
    else p.appendChild(targetDoc.createElement("br"));
    frag.push(p);
  }
  if (frag.length > 0) {
    sgMountNodes(el, frag);
  } else if ("function" == typeof el.replaceChildren) {
    el.replaceChildren();
  } else {
    el.textContent = "";
  }
}

SG.version = "2.0.0";
SG.isSilentWorkerTab = SG_IS_SILENT_BG_WORKER_TAB;
SG.sync = Object.freeze({
  getBootstrap: sgGetBootstrapSync,
  getCached: sgSyncGetCached,
  pickKeys: sgPickSyncKeys,
  syncMasterFlag: sgSyncMasterLocalStorageFlag
});
SG.observers = sgObserverRegistry;
SG.isImeComposing = sgIsImeComposing;
SG.dom = Object.freeze({
  setSafeHtml: sgSetSafeHtml,
  sanitizeParsedFragment: sgSanitizeParsedFragment,
  captureEditorLines: sgCaptureEditorLines,
  restoreEditorLines: sgRestoreEditorLines
});
SG.state = {
  get extensionEnabled() {
    return isExtensionEnabled;
  },
  set extensionEnabled(v) {
    isExtensionEnabled = Boolean(v);
  },
  get focusShortcutEnabled() {
    return isFocusShortcutEnabled;
  },
  set focusShortcutEnabled(v) {
    isFocusShortcutEnabled = Boolean(v);
  }
};
