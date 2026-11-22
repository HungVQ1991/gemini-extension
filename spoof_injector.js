(function () {
  "use strict";

  try {
    if (typeof window === "undefined") return;
    if (window.location && /#(?:.*&)?sg_(?:orch|bg)_worker=1\b/i.test(String(window.location.hash || ""))) {
      if (!window.__sgWorkerRafShimInstalled) {
        window.__sgWorkerRafShimInstalled = true;
        window.__GPS_SPOOF_ACTIVE = true;
        try {
          if (typeof document !== "undefined") {
            try { Object.defineProperty(document, "hidden", { get: function () { return false; }, configurable: true }); } catch (_e1) {}
            try { Object.defineProperty(document, "visibilityState", { get: function () { return "visible"; }, configurable: true }); } catch (_e2) {}
            try { Object.defineProperty(document, "hasFocus", { value: function () { return true; }, writable: true, configurable: true }); } catch (_e3) {}
          }
        } catch (_eDoc) {}
        try {
          if (typeof window.requestAnimationFrame === "function" && typeof setTimeout === "function") {
            var origRAF = window.requestAnimationFrame;
            var origCAF = typeof window.cancelAnimationFrame === "function" ? window.cancelAnimationFrame : null;
            var hasMap = typeof Map === "function";
            var pending = hasMap ? new Map() : Object.create(null);
            var nextRafId = 1;
            var nowFn = function () {
              return (typeof performance !== "undefined" && performance && typeof performance.now === "function")
                ? performance.now()
                : Date.now();
            };
            var getRec = function (id) { return hasMap ? pending.get(id) : pending[id]; };
            var setRec = function (id, rec) { if (hasMap) pending.set(id, rec); else pending[id] = rec; };
            var delRec = function (id) { if (hasMap) pending.delete(id); else delete pending[id]; };
            window.requestAnimationFrame = function (cb) {
              var id = nextRafId++;
              if (typeof cb !== "function") return id;
              var rec = { fired: false, rafHandle: 0, timerHandle: 0 };
              var fire = function (ts) {
                if (rec.fired) return;
                rec.fired = true;
                delRec(id);
                if (rec.timerHandle && typeof clearTimeout === "function") {
                  try { clearTimeout(rec.timerHandle); } catch (_ct) {}
                }
                if (rec.rafHandle && origCAF) {
                  try { origCAF.call(window, rec.rafHandle); } catch (_caf) {}
                }
                cb(typeof ts === "number" ? ts : nowFn());
              };
              setRec(id, rec);
              try { rec.rafHandle = origRAF.call(window, fire); } catch (_rErr) {}
              rec.timerHandle = setTimeout(function () { fire(nowFn()); }, 50);
              return id;
            };
            window.cancelAnimationFrame = function (id) {
              var rec = getRec(id);
              if (rec) {
                rec.fired = true;
                delRec(id);
                if (rec.timerHandle && typeof clearTimeout === "function") {
                  try { clearTimeout(rec.timerHandle); } catch (_ct) {}
                }
                if (rec.rafHandle && origCAF) {
                  try { origCAF.call(window, rec.rafHandle); } catch (_caf) {}
                }
              }
              if (origCAF) {
                try { origCAF.call(window, id); } catch (_caf2) {}
              }
            };
          }
        } catch (_eRaf) {}
      }
      return;
    }
  } catch (_e) {
    return;
  }

  try {
    if (typeof localStorage !== "undefined" && localStorage.getItem("sg_ext_enabled") === "0") return;
  } catch (_e) {}

  try {
    if (window.__sgSpoofInstalled) return;
    var installedDesc = Object.getOwnPropertyDescriptor(window, "__sgSpoofInstalled");
    if (!installedDesc || installedDesc.configurable) {
      Object.defineProperty(window, "__sgSpoofInstalled", {
        value: true,
        writable: true,
        configurable: true,
        enumerable: false
      });
    } else if (installedDesc.writable) {
      window.__sgSpoofInstalled = true;
    }
  } catch (_e) {
    try { window.__sgSpoofInstalled = true; } catch (_e2) {}
  }

  // 1. Anti-FOUC dark backdrop until Gemini applies its theme class
  try {
    if (typeof localStorage !== "undefined" && localStorage.getItem("sg_last_theme") === "dark" && typeof document !== "undefined" && document.documentElement) {
      var styleEl = document.createElement("style");
      styleEl.id = "sg-anti-fouc";
      styleEl.textContent = "html,body{background-color:#131314!important}";
      document.documentElement.appendChild(styleEl);

      var antiFoucObserver = null;
      var antiFoucTimer = setTimeout(cleanupAntiFouc, 6000);
      function cleanupAntiFouc() {
        if (antiFoucTimer) {
          clearTimeout(antiFoucTimer);
          antiFoucTimer = null;
        }
        try {
          var existing = document.getElementById("sg-anti-fouc");
          if (existing) existing.remove();
        } catch (_e) {}
        if (antiFoucObserver) {
          try { antiFoucObserver.disconnect(); } catch (_e) {}
        }
      }
      if (typeof MutationObserver === "function") {
        antiFoucObserver = new MutationObserver(function () {
          var bodyEl = document.body;
          if (bodyEl && (bodyEl.classList.contains("dark-theme") || bodyEl.classList.contains("light-theme"))) {
            cleanupAntiFouc();
          }
        });
        antiFoucObserver.observe(document.documentElement, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["class"]
        });
      }
    }
  } catch (_e) {}

  // 2. Folder Uploader file-picker click interception (prototype-safe)
  try {
    if (typeof HTMLInputElement !== "undefined" && HTMLInputElement.prototype && typeof HTMLInputElement.prototype.click === "function") {
      var clickDesc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "click");
      var canOverrideClick = !clickDesc || clickDesc.writable !== false || clickDesc.configurable;
      if (canOverrideClick) {
        var origInputClick = HTMLInputElement.prototype.click;
        var wrappedInputClick = function () {
          try {
            if (this.type === "file" && document.body && document.body.hasAttribute("data-sg-block-file-picker")) {
              this.setAttribute("data-sg-intercepted", "true");
              return;
            }
          } catch (_e) {}
          return origInputClick.apply(this, arguments);
        };
        if (!clickDesc || clickDesc.configurable) {
          Object.defineProperty(HTMLInputElement.prototype, "click", {
            value: wrappedInputClick,
            writable: true,
            configurable: true,
            enumerable: clickDesc ? clickDesc.enumerable : false
          });
        } else {
          HTMLInputElement.prototype.click = wrappedInputClick;
        }
      }
    }
  } catch (_e) {}

  // 3. WIZ RPC token bridge (SNlM0e, FdrFJe, cfb2h)
  try {
    var wizCache = null;
    function emitWizTokens() {
      if (!wizCache) return;
      try {
        window.dispatchEvent(new CustomEvent("sg-wiz-tokens", { detail: wizCache }));
      } catch (_e) {}
    }
    function tryReadWizTokens(allowPartial) {
      if (wizCache && wizCache.at && wizCache.sid && wizCache.bl) {
        emitWizTokens();
        return true;
      }
      var wd = window.WIZ_global_data;
      if (wd && wd.SNlM0e && wd.FdrFJe != null && wd.cfb2h) {
        wizCache = { at: String(wd.SNlM0e), sid: String(wd.FdrFJe), bl: String(wd.cfb2h) };
        emitWizTokens();
        return true;
      }
      if (allowPartial && wd && wd.SNlM0e) {
        wizCache = {
          at: String(wd.SNlM0e),
          sid: wd.FdrFJe != null ? String(wd.FdrFJe) : "",
          bl: wd.cfb2h ? String(wd.cfb2h) : ""
        };
        emitWizTokens();
        return true;
      }
      return false;
    }
    window.addEventListener("sg-wiz-tokens-request", function () {
      if (!tryReadWizTokens(false)) {
        var reqTicks = 0;
        var reqTimer = setInterval(function () {
          reqTicks++;
          if (tryReadWizTokens(reqTicks >= 15) || reqTicks >= 200) clearInterval(reqTimer);
        }, 50);
      }
    });
    if (!tryReadWizTokens(false)) {
      var bootTicks = 0;
      var bootTimer = setInterval(function () {
        bootTicks++;
        if (tryReadWizTokens(bootTicks >= 15) || bootTicks >= 200) clearInterval(bootTimer);
      }, 50);
    }
  } catch (_e) {}

  // 4. Native <svg-code-block> genui-morph postMessage capture bridge
  (function () {
    try {
      if (typeof HTMLIFrameElement === "undefined" || typeof MessageEvent === "undefined") return;
      var cwDesc = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, "contentWindow");
      var srcDesc = Object.getOwnPropertyDescriptor(MessageEvent.prototype, "source");
      if (!cwDesc || typeof cwDesc.get !== "function" || !cwDesc.configurable) return;

      var origCwGet = cwDesc.get;
      var origSrcGet = srcDesc && typeof srcDesc.get === "function" && srcDesc.configurable ? srcDesc.get : null;
      var winToProxy = new WeakMap();
      var svgStore = new Map();
      var seq = 0;

      function extractSvgMarkup(html) {
        if (typeof html !== "string") return "";
        var startIdx = html.search(/<svg(?:\s|>)/i);
        if (startIdx === -1) return "";
        var endIdx = html.toLowerCase().lastIndexOf("</svg>");
        if (endIdx <= startIdx) return "";
        return html.slice(startIdx, endIdx + 6);
      }

      function emitSvgRecord(id, svg, complete) {
        try {
          window.dispatchEvent(new CustomEvent("sg-svg-block-source", {
            detail: { id: id, svg: svg, complete: Boolean(complete) }
          }));
        } catch (_e) {}
      }

      function getBlockId(svgBlock) {
        var id = svgBlock.getAttribute("data-sg-svg-id");
        if (!id) {
          id = "sg_svg_" + (++seq);
          svgBlock.setAttribute("data-sg-svg-id", id);
        }
        return id;
      }

      function pruneSvgStore() {
        if (svgStore.size < 32) return;
        svgStore.forEach(function (rec, id) {
          if (!rec || !rec.el || !rec.el.isConnected) {
            svgStore.delete(id);
          }
        });
      }

      Object.defineProperty(HTMLIFrameElement.prototype, "contentWindow", {
        configurable: true,
        enumerable: cwDesc.enumerable,
        get: function () {
          var realWin = origCwGet.call(this);
          if (!realWin) return realWin;
          var iframeEl = this;
          try {
            if (iframeEl.classList && iframeEl.classList.contains("sg-diagram-iframe")) return realWin;
            if (typeof iframeEl.closest !== "function" || !iframeEl.closest("genui-sandbox")) return realWin;
            var svgBlock = iframeEl.closest("svg-code-block");
            if (!svgBlock) return realWin;

            var existingProxy = winToProxy.get(realWin);
            if (existingProxy) return existingProxy;

            var wrappedPostMessage = function (msg) {
              try {
                if (msg && typeof msg === "object") {
                  var ownerBlock = iframeEl.closest("svg-code-block") || svgBlock;
                  if (ownerBlock) {
                    if (msg.type === "genui-morph" && typeof msg.html === "string") {
                      var svgMarkup = extractSvgMarkup(msg.html);
                      if (svgMarkup) {
                        var id = getBlockId(ownerBlock);
                        pruneSvgStore();
                        svgStore.set(id, { el: ownerBlock, svg: svgMarkup, complete: false });
                        emitSvgRecord(id, svgMarkup, false);
                      }
                    } else if (msg.type === "genui-stream-complete") {
                      var existingId = ownerBlock.getAttribute("data-sg-svg-id");
                      var rec = existingId ? svgStore.get(existingId) : null;
                      if (rec && rec.svg) {
                        rec.complete = true;
                        emitSvgRecord(existingId, rec.svg, true);
                      }
                    }
                  }
                }
              } catch (_e) {}
              return realWin.postMessage.apply(realWin, arguments);
            };

            var proxyWin = new Proxy(Object.create(null), {
              get: function (_t, prop) {
                if (prop === "postMessage") return wrappedPostMessage;
                var val = realWin[prop];
                return typeof val === "function" ? val.bind(realWin) : val;
              },
              set: function (_t, prop, value) {
                realWin[prop] = value;
                return true;
              }
            });

            winToProxy.set(realWin, proxyWin);
            return proxyWin;
          } catch (_e) {
            return realWin;
          }
        }
      });

      if (origSrcGet) {
        Object.defineProperty(MessageEvent.prototype, "source", {
          configurable: true,
          enumerable: srcDesc.enumerable,
          get: function () {
            var rawSource = origSrcGet.call(this);
            if (rawSource && typeof rawSource === "object") {
              var mapped = winToProxy.get(rawSource);
              if (mapped) return mapped;
            }
            return rawSource;
          }
        });
      }

      window.addEventListener("sg-svg-block-source-request", function (ev) {
        try {
          var reqId = ev && ev.detail && ev.detail.id ? String(ev.detail.id) : "*";
          if (reqId !== "*") {
            var rec = svgStore.get(reqId);
            if (rec && rec.svg) emitSvgRecord(reqId, rec.svg, rec.complete);
            return;
          }
          svgStore.forEach(function (rec, id) {
            if (rec && rec.el && rec.el.isConnected && rec.svg) {
              emitSvgRecord(id, rec.svg, rec.complete);
            } else {
              svgStore.delete(id);
            }
          });
        } catch (_e) {}
      });
    } catch (_e) {}
  })();

  // 5. Early document_start Cmd/Ctrl+K & Cmd/Ctrl+Shift+K takeover
  try {
    window.addEventListener("keydown", function (e) {
      try {
        if (typeof localStorage !== "undefined" && localStorage.getItem("sg_ext_enabled") === "0") return;
      } catch (_e) {}
      if (!e || e.isComposing || e.keyCode === 229 || e.key === "Process") return;
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      var keyLower = (e.key || "").toLowerCase();
      if (keyLower !== "k" && e.code !== "KeyK") return;

      var activeAttr = null;
      try {
        activeAttr = document.documentElement && document.documentElement.getAttribute("data-sg-cp-active");
      } catch (_e) {}
      var isActive = activeAttr !== null ? activeAttr === "1" : true;
      if (activeAttr === null) {
        try {
          if (localStorage.getItem("sg_cp_active") === "0") isActive = false;
        } catch (_e) {}
      }
      if (!isActive) return;

      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === "function") {
        e.stopImmediatePropagation();
      }
      if (!e.shiftKey) {
        try {
          window.dispatchEvent(new CustomEvent("sg-cp-toggle-request", {
            detail: { timeStamp: e.timeStamp }
          }));
        } catch (_e) {}
      }
    }, true);
  } catch (_e) {}
})();
