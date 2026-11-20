/**
 * Gemini Power Suite - Google Drive Authorization
 * Responsibilities:
 * - Connects user to Google Drive AppData for cloud sync
 */
document.addEventListener("DOMContentLoaded", () => {
  const e = document.getElementById("connect-btn"),
    s = document.getElementById("status"),
    t = document.getElementById("closing-note");

  function setButtonState(btn, iconType, label) {
    btn.textContent = "";
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", "20");
    svg.setAttribute("height", "20");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    if (iconType === "sync") svg.setAttribute("class", "sg-spin");
    const paths = iconType === "sync"
      ? ["M21 12a9 9 0 1 1-2.64-6.36", "M21 3v6h-6"]
      : ["M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71", "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"];
    for (const d of paths) {
      const p = document.createElementNS(svgNS, "path");
      p.setAttribute("d", d);
      svg.appendChild(p);
    }
    btn.appendChild(svg);
    btn.appendChild(document.createTextNode(" " + label));
  }

  function n(t) {
    s.textContent = t, s.className = "status error", e.disabled = !1, e.removeAttribute("aria-busy"), setButtonState(e, "link", "Try Again")
  }
  let oauthConfigured = true;
  chrome.runtime.sendMessage({ type: "DRIVE_SYNC_GET_STATUS" }, resp => {
    if (chrome.runtime.lastError) return;
    if (resp && resp.configured === false) {
      oauthConfigured = false;
      e.disabled = true;
      s.textContent = "Google Drive Sync is not configured yet. Add your own Google Cloud OAuth2 Client ID in manifest.json (oauth2) and background.js (DRIVE_WEB_CLIENT_ID) to enable cloud sync.";
      s.className = "status error";
    }
  });
  e.addEventListener("click", () => {
    if (!oauthConfigured) return;
    e.disabled = !0, e.setAttribute("aria-busy", "true"), setButtonState(e, "sync", "Connecting..."), s.className = "status", chrome.permissions.request({
      permissions: ["identity"]
    }, i => {
      i ? chrome.runtime.sendMessage({
        type: "DRIVE_SYNC_CONNECT"
      }, i => {
        if (chrome.runtime.lastError) n("Connection failed: " + chrome.runtime.lastError.message);
        else if (i && i.authorized) s.textContent = "Google Drive connected successfully!", s.className = "status success", t.classList.add("visible"), e.disabled = !0, e.removeAttribute("aria-busy"), setTimeout(() => window.close(), 3e3);
        else if (i && i.unconfigured) n(i.error || "Google Drive Sync is not configured yet.");
        else {
          let e = i && i.error || "Please try again.";
          e = e.replace(/The user did not/gi, "You did not").replace(/\buser did not\b/gi, "You did not").replace(/\bThe user\b/g, "You").replace(/\buser\b/g, "you"), n("Authorization failed: " + e)
        }
      }) : n("Permission was not granted. Click Try Again to retry.")
    })
  })
});
