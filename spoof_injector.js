/**
 * Superpower for Gemini - Spoof Injector
 * Injected at document_start in MAIN world.
 * Responsibilities:
 * - Anti-FOUC (Flash of Unstyled Content) for Dark Theme
 * - File picker interception
 * - Google WIZ internal token extraction (SNlM0e, FdrFJe, cfb2h)
 * - Background tab throttling bypass (document.visibilityState spoofing & Web Worker keep-alive)
 */
! function() {
  try {
    if ("dark" === localStorage.getItem("sg_last_theme")) {
      var e = document.createElement("style");
      e.id = "sg-anti-fouc", e.textContent = "html,body{background-color:#131314!important}", document.documentElement.appendChild(e);
      var t = new MutationObserver(function() {
        var e = document.body;
        if (e && (e.classList.contains("dark-theme") || e.classList.contains("light-theme"))) {
          var n = document.getElementById("sg-anti-fouc");
          n && n.remove(), t.disconnect()
        }
      });
      t.observe(document.documentElement, {
        childList: !0,
        subtree: !0,
        attributes: !0,
        attributeFilter: ["class"]
      })
    }
  } catch (e) {}
}(), window.reloadSG = () => (window.dispatchEvent(new CustomEvent("SG_RELOAD_REQUEST")), "Reloading Superpower for Gemini..."),
  function() {
    var e = HTMLInputElement.prototype.click;
    HTMLInputElement.prototype.click = function() {
      if ("file" !== this.type || !document.body || !document.body.hasAttribute("data-sg-block-file-picker")) return e.apply(this, arguments);
      this.setAttribute("data-sg-intercepted", "true")
    }
  }(),
  function() {
    var e = null;

    function t() {
      e && window.dispatchEvent(new CustomEvent("sg-wiz-tokens", {
        detail: e
      }))
    }

    function n() {
      return e ? (t(), !0) : (n = window.WIZ_global_data, !!(e = n && n.SNlM0e && n.FdrFJe && n.cfb2h ? {
        at: n.SNlM0e,
        sid: n.FdrFJe,
        bl: n.cfb2h
      } : null) && (t(), !0));
      var n
    }
    if (window.addEventListener("sg-wiz-tokens-request", function() {
        if (!n()) var e = 0,
          t = setInterval(function() {
            e++, (n() || e >= 60) && clearInterval(t)
          }, 50)
      }), !n()) var i = 0,
      o = setInterval(function() {
        i++, (n() || i >= 60) && clearInterval(o)
      }, 50)
  }(),
  function() {
    try {
      if (window.__SUPERPOWER_SPOOF_ACTIVE) return;
      window.__SUPERPOWER_SPOOF_ACTIVE = !0;
      const t = "visible" === document.visibilityState,
        n = EventTarget.prototype.addEventListener;
      EventTarget.prototype.addEventListener = function(e, t, i) {
        if (!["visibilitychange", "webkitvisibilitychange", "pagehide", "mozvisibilitychange", "msvisibilitychange"].includes(e) && (!["blur", "focusout"].includes(e) || this !== document && this !== window)) return n.apply(this, arguments)
      }, Object.defineProperty(document, "hidden", {
        get: () => !1,
        configurable: !0
      }), Object.defineProperty(document, "visibilityState", {
        get: () => "visible",
        configurable: !0
      }), Object.defineProperty(document, "hasFocus", {
        value: () => !0,
        writable: !0,
        configurable: !0
      }), document.hasFocus = () => !0;
      try {
        Object.defineProperty(Document.prototype, "hasFocus", {
          value: () => !0,
          writable: !0,
          configurable: !0
        })
      } catch (s) {}
      if (!t && window.IntersectionObserver) {
        const d = window.IntersectionObserver;
        window.IntersectionObserver = class extends d {
          constructor(e, t) {
            super((t, n) => {
              const i = t.map(e => ({
                time: performance.now(),
                target: e.target,
                isIntersecting: !0,
                intersectionRatio: 1,
                boundingClientRect: e.target.getBoundingClientRect(),
                intersectionRect: e.target.getBoundingClientRect(),
                rootBounds: document.body ? document.body.getBoundingClientRect() : null
              }));
              e(i, n)
            }, t), this._callback = e
          }
          observe(e) {
            const t = {
              time: performance.now(),
              target: e,
              isIntersecting: !0,
              intersectionRatio: 1,
              boundingClientRect: e.getBoundingClientRect(),
              intersectionRect: e.getBoundingClientRect(),
              rootBounds: document.body ? document.body.getBoundingClientRect() : null
            };
            try {
              this._callback([t], this)
            } catch (e) {}
            super.observe(e)
          }
        }
      }
      t || (window.requestIdleCallback = function(e, t) {
        return setTimeout(() => {
          e({
            didTimeout: !1,
            timeRemaining: () => 50
          })
        }, 1)
      }, window.cancelIdleCallback = function(e) {
        clearTimeout(e)
      });
      const i = () => {
        if (!window.__SG_AUDIO_INIT) try {
          const e = window.AudioContext || window.webkitAudioContext;
          if (e) {
            const t = new e,
              n = t.createOscillator(),
              o = t.createGain();
            n.connect(o), n.frequency.value = 100, o.gain.value = 0, n.start(), "suspended" === t.state && t.resume().catch(() => {}), window.__SG_AUDIO_INIT = !0, window.removeEventListener("mousedown", i), window.removeEventListener("keydown", i)
          }
        } catch (e) {}
      };
      window.addEventListener("mousedown", i, {
        once: !0
      }), window.addEventListener("keydown", i, {
        once: !0
      });
      let o;
      const a = new Blob(["\n            const timers = new Map();\n            self.onmessage = function(e) {\n                if (e.data === 'start_raf') {\n                    setInterval(() => self.postMessage({ type: 'raf_tick' }), 16);\n                }\n                if (e.data.type === 'set_timeout') {\n                    const id = setTimeout(() => {\n                        self.postMessage({ type: 'timeout_tick', id: e.data.id });\n                        timers.delete(e.data.id);\n                    }, e.data.delay);\n                    timers.set(e.data.id, id);\n                }\n                if (e.data.type === 'set_interval') {\n                    const id = setInterval(() => {\n                        self.postMessage({ type: 'interval_tick', id: e.data.id });\n                    }, e.data.delay);\n                    timers.set(e.data.id, id);\n                }\n                if (e.data.type === 'clear_timer') {\n                    const timerId = timers.get(e.data.id);\n                    if (timerId) {\n                        clearTimeout(timerId);\n                        clearInterval(timerId);\n                        timers.delete(e.data.id);\n                    }\n                }\n            };\n        "], {
          type: "application/javascript"
        }),
        r = URL.createObjectURL(a);
      if (window.trustedTypes && window.trustedTypes.createPolicy) {
        const l = "superpower-gemini-policy";
        o = (window.trustedTypes.defaultPolicy || (window.trustedTypes.getPolicyNames?.().includes(l) ? {
          createScriptURL: e => e
        } : window.trustedTypes.createPolicy(l, {
          createScriptURL: e => e
        }))).createScriptURL(r)
      } else o = r;
      let c = null;
      if (c) {
        const u = new Map;
        let w = 0;
        window.requestAnimationFrame = function(e) {
          const t = w++;
          return u.set(t, e), t
        }, window.webkitRequestAnimationFrame = window.requestAnimationFrame, window.cancelAnimationFrame = e => u.delete(e);
        const m = window.setTimeout,
          p = window.clearTimeout,
          f = window.setInterval,
          y = window.clearInterval,
          g = new Map;
        let v = 1e4;

        function e(e, t, n, ...i) {
          if (n < 99999999) {
            const o = v++;
            return g.set(o, () => t(...i)), c.postMessage({
              type: e,
              id: o,
              delay: n
            }), o
          }
          return "set_timeout" === e ? m(t, n, ...i) : f(t, n, ...i)
        }
        window.setTimeout = (t, n, ...i) => e("set_timeout", t, n, ...i), window.setInterval = (t, n, ...i) => e("set_interval", t, n, ...i);
        const b = e => e >= 1e4 && (g.delete(e), c.postMessage({
          type: "clear_timer",
          id: e
        }), !0);
        window.clearTimeout = e => {
          b(e) || p(e)
        }, window.clearInterval = e => {
          b(e) || y(e)
        }, c.onmessage = function(e) {
          if ("raf_tick" === e.data.type) {
            const e = performance.now(),
              t = new Map(u);
            u.clear(), t.forEach(t => {
              try {
                t(e)
              } catch (e) {}
            })
          }
          if ("timeout_tick" === e.data.type) {
            const t = g.get(e.data.id);
            if (t) {
              g.delete(e.data.id);
              try {
                t()
              } catch (e) {}
            }
          }
          if ("interval_tick" === e.data.type) {
            const t = g.get(e.data.id);
            if (t) try {
              t()
            } catch (e) {}
          }
        }, c.postMessage("start_raf")
      }
    } catch (h) {
      console.error("[Superpower for Gemini] Spoof injection failed: ❌", h)
    }
  }();
