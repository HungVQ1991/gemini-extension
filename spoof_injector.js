! function() {
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
  }();
