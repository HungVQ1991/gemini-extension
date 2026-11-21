! function() {
  try {
    if (window.location && /#(?:.*&)?sg_(?:orch|bg)_worker=1\b/i.test(String(window.location.hash || ""))) return;
  } catch (e) {}
  try {
    if ("dark" === localStorage.getItem("sg_last_theme")) {
      var e = document.createElement("style");
      e.id = "sg-anti-fouc", e.textContent = "html,body{background-color:#131314!important}", document.documentElement.appendChild(e);
      var t = new MutationObserver(function() {
        var e = document.body;
        if (e && (e.classList.contains("dark-theme") || e.classList.contains("light-theme"))) {
          cleanupAntiFouc();
        }
      });
      var antiFoucTimer = setTimeout(cleanupAntiFouc, 6000);
      function cleanupAntiFouc() {
        if (antiFoucTimer) {
          clearTimeout(antiFoucTimer);
          antiFoucTimer = null;
        }
        var n = document.getElementById("sg-anti-fouc");
        n && n.remove();
        t.disconnect();
      }
      t.observe(document.documentElement, {
        childList: !0,
        subtree: !0,
        attributes: !0,
        attributeFilter: ["class"]
      })
    }
  } catch (e) {}
}(),
  function() {
    var e = HTMLInputElement.prototype.click;
    HTMLInputElement.prototype.click = function() {
      if ("file" !== this.type || !document.body || !document.body.hasAttribute("data-sg-block-file-picker")) return e.apply(this, arguments);
      this.setAttribute("data-sg-intercepted", "true")
    }
  }(),
  function() {
    try {
      if (window.location && /#(?:.*&)?sg_(?:orch|bg)_worker=1\b/i.test(String(window.location.hash || ""))) return;
    } catch (e) {}
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
      if (window.location && /#(?:.*&)?sg_(?:orch|bg)_worker=1\b/i.test(String(window.location.hash || ""))) return;
    } catch (e) {}
    try {
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
        } catch (e) {}
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
        svgStore.forEach(function(rec, id) {
          if (!rec || !rec.el || !rec.el.isConnected) {
            svgStore.delete(id);
          }
        });
      }

      Object.defineProperty(HTMLIFrameElement.prototype, "contentWindow", {
        configurable: true,
        enumerable: cwDesc.enumerable,
        get: function() {
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

            var wrappedPostMessage = function(msg) {
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
              } catch (e) {}
              return realWin.postMessage.apply(realWin, arguments);
            };

            var proxyWin = new Proxy(Object.create(null), {
              get: function(_t, prop) {
                if (prop === "postMessage") return wrappedPostMessage;
                var val = realWin[prop];
                return typeof val === "function" ? val.bind(realWin) : val;
              },
              set: function(_t, prop, value) {
                realWin[prop] = value;
                return true;
              }
            });

            winToProxy.set(realWin, proxyWin);
            return proxyWin;
          } catch (e) {
            return realWin;
          }
        }
      });

      if (origSrcGet) {
        Object.defineProperty(MessageEvent.prototype, "source", {
          configurable: true,
          enumerable: srcDesc.enumerable,
          get: function() {
            var rawSource = origSrcGet.call(this);
            if (rawSource && typeof rawSource === "object") {
              var mapped = winToProxy.get(rawSource);
              if (mapped) return mapped;
            }
            return rawSource;
          }
        });
      }

      window.addEventListener("sg-svg-block-source-request", function(ev) {
        try {
          var reqId = ev && ev.detail && ev.detail.id ? String(ev.detail.id) : "*";
          if (reqId !== "*") {
            var rec = svgStore.get(reqId);
            if (rec && rec.svg) emitSvgRecord(reqId, rec.svg, rec.complete);
            return;
          }
          svgStore.forEach(function(rec, id) {
            if (rec && rec.el && rec.el.isConnected && rec.svg) {
              emitSvgRecord(id, rec.svg, rec.complete);
            } else {
              svgStore.delete(id);
            }
          });
        } catch (e) {}
      });
    } catch (e) {}
  }(),
  function() {
    try {
      if (window.location && /#(?:.*&)?sg_(?:orch|bg)_worker=1\b/i.test(String(window.location.hash || ""))) return;
    } catch (e) {}
    try {
      window.addEventListener("keydown", function(e) {
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
    } catch (e) {}
  }();
