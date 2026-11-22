/**
 * Gemini Power Suite - Content Script (Gemini DOM Injection)
 * Responsibilities:
 * - Injects custom UI into gemini.google.com (Folders, Prompt Library, Prompt Chains)
 * - Message Queue implementation
 * - Usage Counter (5-hour and weekly quota tracker)
 * - PDF/DOCX/Text export handlers
 * - Timestamps, bookmarks, custom notes, and audio download
 * - Declutter filters and UI enhancements
 */
let lastSidebarToggleTime = 0;
const SIDEBAR_TOGGLE_DEBOUNCE = 100;
const guideUrl = "undefined" != typeof chrome && chrome.runtime && "function" == typeof chrome.runtime.getURL ? chrome.runtime.getURL("guide.html") : "";

function getGoogleAccountIndex() {
  const e = window.location.pathname.match(/^\/u\/(\d+)\//);
  return e ? e[1] : null
}

function getAccountAwareUrl(e = "") {
  const t = getGoogleAccountIndex(),
    n = t ? `/u/${t}/app` : "/app";
  return `https://gemini.google.com${e?`${n}/${e}`:n}`
}

function getAccountRpcPrefix() {
  const e = getGoogleAccountIndex();
  return e ? `/u/${e}` : ""
}

function sgIsVietnameseGeminiUI(sampleText = "") {
  const cleaned = String(sampleText || "").replace(/\s+/g, " ").trim();
  if (cleaned) {
    if (/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(cleaned) || /\b(tải|tệp|thanh bên|cài đặt|cuộc trò chuyện)\b/i.test(cleaned)) {
      return !0;
    }
    if (/\b(file|files|upload|uploads|add|folder|sidebar|settings|new chat|computer|device|drive|tools|more)\b/i.test(cleaned)) {
      return !1;
    }
  }
  try {
    const hl = (new URLSearchParams(window.location.search).get("hl") || "").toLowerCase();
    if (hl) return hl.startsWith("vi");
  } catch (e) {}
  return (document.documentElement.lang || "").toLowerCase().startsWith("vi");
}

function sgSafeSendMessage(payload, callback) {
  try {
    if ("undefined" == typeof chrome || !chrome.runtime || !chrome.runtime.id) {
      if ("function" == typeof callback) {
        callback(null, "Extension context invalidated");
        return;
      }
      return Promise.resolve(null);
    }
    if ("function" == typeof callback) {
      chrome.runtime.sendMessage(payload, resp => {
        const err = chrome.runtime.lastError ? chrome.runtime.lastError.message : null;
        callback(err ? null : resp, err);
      });
      return;
    }
    const maybePromise = chrome.runtime.sendMessage(payload);
    if (maybePromise && "function" == typeof maybePromise.catch) {
      return maybePromise.catch(() => null);
    }
    return Promise.resolve(maybePromise || null);
  } catch (e) {
    if ("function" == typeof callback) {
      callback(null, String(e && e.message || e));
      return;
    }
    return Promise.resolve(null);
  }
}

function sgSanitizeCssColor(color, fallback = "var(--gem-sys-color--on-surface-variant, #575a5a)") {
  const val = String(color || "").trim();
  if (/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(val)) return val;
  if (/^(?:rgb|rgba|hsl|hsla)\(\s*[0-9.,%\s/+-]+\s*\)$/i.test(val)) return val;
  if (/^[a-zA-Z]{3,20}$/.test(val)) return val;
  return fallback;
}

function openPrintHtmlWindow(html) {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank");
  if (!win) {
    URL.revokeObjectURL(url);
    return !1;
  }
  let printed = !1;
  let revoked = !1;
  const revokeOnce = () => {
    if (!revoked) {
      revoked = !0;
      URL.revokeObjectURL(url);
    }
  };
  const triggerPrint = () => {
    if (printed) return;
    printed = !0;
    try {
      win.focus();
      win.print();
    } catch (e) {}
  };
  try {
    win.addEventListener("afterprint", () => {
      try { win.close(); } catch (e) {}
      revokeOnce();
    }, { once: !0 });
    win.addEventListener("load", () => setTimeout(triggerPrint, 150), { once: !0 });
  } catch (e) {}
  setTimeout(triggerPrint, 650);
  setTimeout(revokeOnce, 6e4);
  return !0;
}

function sgRafCoalesce(e) {
  let t = !1;
  return function() {
    t || (t = !0, requestAnimationFrame(() => {
      t = !1;
      try {
        e()
      } catch (e) {
        console.error("[SG] observer handler error:", e)
      }
    }))
  }
}

function sgRafCoalesceRecords(e) {
  let t = !1,
    n = [];
  return function(o) {
    if (o && o.length)
      for (let e = 0; e < o.length; e++) n.push(o[e]);
    t || (t = !0, requestAnimationFrame(() => {
      t = !1;
      const o = n;
      n = [];
      try {
        e(o)
      } catch (e) {
        console.error("[SG] observer handler error:", e)
      }
    }))
  }
}

function findSidebarToggleButton() {
  const e = document.querySelector('button[data-test-id="side-nav-menu-button"], button.main-menu-button, button[aria-label="Main menu"], button[aria-label*="Main menu" i], button[aria-label*="Open menu" i], button[aria-label*="Expand menu" i], button[aria-label*="Navigation menu" i], button[aria-label*="Toggle sidebar" i], button[aria-label*="Expand sidebar" i], button[aria-label*="Collapse sidebar" i], button[aria-label*="thanh bên" i], button[aria-label*="Trình đơn chính" i]');
  if (e) return e;
  const t = e => {
      for (const t of document.querySelectorAll(e))
        if (null !== t.offsetParent && !t.disabled) return t;
      return null
    },
    n = t("button.close-sidenav-button, .close-sidenav-button button");
  if (n) return n;
  const o = t('button[data-test-id="side-nav-sparkle-button"]');
  if (o) return o;
  const s = document.getElementById("sg-sidebar-expand-btn");
  if (s && !s.disabled) return s;
  return null
}

function sgToggleSidebarKeepFocus(e) {
  const t = document.activeElement,
    n = ["cdk-focused", "cdk-program-focused", "cdk-keyboard-focused", "cdk-mouse-focused", "cdk-touch-focused"],
    o = e => {
      const o = e.target;
      o instanceof Element && o.closest('.close-sidenav-button, [data-test-id="side-nav-sparkle-button"], button[data-test-id="side-nav-menu-button"], button.main-menu-button, #sg-sidebar-expand-btn') && (a(), setTimeout(() => {
        t && t !== document.body && t.isConnected && t !== o && t.getClientRects().length > 0 ? t.focus({
          preventScroll: !0
        }) : o.blur(), o.classList.remove(...n), r(0)
      }, 0))
    },
    r = e => {
      document.querySelector(".mat-mdc-tooltip.mat-mdc-tooltip-show") ? document.body.dispatchEvent(new KeyboardEvent("keydown", {
        key: "Escape",
        code: "Escape",
        keyCode: 27,
        which: 27,
        bubbles: !0,
        cancelable: !0
      })) : e < 10 && setTimeout(() => r(e + 1), 100)
    },
    s = setTimeout(() => a(), 1500);

  function a() {
    clearTimeout(s), document.removeEventListener("focusin", o, !0)
  }
  document.addEventListener("focusin", o, !0), e.click()
}

function findDialogActionButtons(e) {
  if (!e) return {
    confirmBtn: null,
    cancelBtn: null,
    confirmJslog: ""
  };
  let t = e.querySelector('[data-test-id="confirm-button"] button') || e.querySelector('button[data-test-id="confirm-button"]'),
    n = e.querySelector('[data-test-id="cancel-button"] button') || e.querySelector('button[data-test-id="cancel-button"]');
  if (!t || !n) {
    const o = e.querySelector("mat-dialog-actions, .mat-mdc-dialog-actions, .mdc-dialog__actions"),
      r = Array.from((o || e).querySelectorAll("button")),
      s = e => e.getAttribute("jslog") || e.closest("gem-button")?.getAttribute("jslog") || "";
    if (t || (t = r.find(e => {
        const t = s(e);
        return t.includes("186009") || t.includes("186097")
      }) || null), n || (n = r.find(e => s(e).includes("305700")) || null), o) {
      if (!t) {
        const e = r.filter(e => e !== n);
        t = e.length ? e[e.length - 1] : null
      }
      n || (n = r.find(e => e !== t) || null)
    }
  }
  const o = t && (t.getAttribute("jslog") || t.closest("gem-button")?.getAttribute("jslog")) || "";
  return {
    confirmBtn: t,
    cancelBtn: n,
    confirmJslog: o
  }
}
const DOM = Object.freeze({
    get promptInput() {
      return domQuery("promptInput")
    },
    get chatHistory() {
      return domQuery("chatHistory")
    },
    get sidebarScroller() {
      return domQuery("sidebarScroller")
    },
    get modeMenuButton() {
      return domQuery("modeMenuButton")
    },
    get sendButton() {
      return domQuery("sendButton")
    },
    get tempChatButton() {
      return domQuery("tempChatButton")
    },
    get newChatButton() {
      return domQuery("newChatButton")
    },
    get userQueries() {
      return domQueryAll("userQuery", document, {
        fallback: !0
      })
    },
    get modelResponses() {
      return domQueryAll("modelResponse", document, {
        fallback: !0
      })
    },
    get allMessages() {
      return domQueryAll("allMessages")
    },
    get dialog() {
      return domQuery("dialog")
    },
    get nativeMenu() {
      return domQuery("nativeMenu")
    },
    get gemsHeader() {
      return domQuery("gemsHeader")
    }
  }),
  STORAGE_LIMIT_BYTES = 20971520;
async function checkStorageLimit(e) {
  try {
    const t = await chrome.storage.local.getBytesInUse(),
      n = t + new Blob([JSON.stringify(e)]).size;
    return {
      allowed: n <= 20971520,
      currentSize: t,
      estimatedSize: n
    }
  } catch (e) {
    return console.error("[Storage Limit] Error checking storage:", e), {
      allowed: !0,
      currentSize: 0,
      estimatedSize: 0
    }
  }
}
async function safeLocalStorageSet(e) {
  const t = await checkStorageLimit(e);
  if (!t.allowed) {
    const e = (t.currentSize / 1048576).toFixed(2),
      n = (t.estimatedSize / 1048576).toFixed(2);
    return console.warn(`[Storage Limit] Storage limit exceeded! Current: ${e}MB, Estimated after save: ${n}MB, Limit: 20MB`), "function" == typeof showToast ? showToast(`Storage limit reached (${e}MB / 20MB). Please delete old data to continue.`, "error") : alert(`Storage limit reached (${e}MB / 20MB). Cannot save new data. Please delete old folders, prompts, or chats.`), !1
  }
  return await chrome.storage.local.set(e), !0
}

function getTodayDateString() {
  const e = new Date;
  return `${e.getFullYear()}-${String(e.getMonth()+1).padStart(2,"0")}-${String(e.getDate()).padStart(2,"0")}`
}

function isRecordingShortcut() {
  if (document.querySelector(".recording")) return !0;
  const e = document.getElementById("sg-settings-modal-host");
  return !!e?.shadowRoot?.querySelector(".recording")
}

function setupShiftClickSelection(e, t, n) {
  if (!e) return () => {};
  const o = o => {
    const r = o.target.closest(t);
    if (!r || "checkbox" !== r.type) return;
    const s = window._sgShiftClickAnchors[t];
    if (o.shiftKey && s && s !== r && document.contains(s)) {
      const o = Array.from(e.querySelectorAll(t)).filter(e => null !== e.offsetParent || "none" !== getComputedStyle(e).display),
        a = o.indexOf(r),
        i = o.indexOf(s);
      if (-1 !== a && -1 !== i) {
        const e = Math.min(a, i),
          t = Math.max(a, i),
          s = r.checked;
        for (let n = e; n <= t; n++) o[n].checked !== s && (o[n].checked = s, o[n].dispatchEvent(new Event("change", {
          bubbles: !0
        })));
        n && n()
      }
      return
    }
    window._sgShiftClickAnchors[t] = r
  };
  return e.addEventListener("click", o, !0), () => {
    e.removeEventListener("click", o, !0)
  }
}

function markdownTableToAscii(e) {
  const t = e.trim().split("\n").filter(e => e.trim()),
    n = [];
  for (const e of t) {
    if (/^\|[\s\-:|]+\|?$/.test(e.trim())) continue;
    const t = e.split("|").slice(1, -1).map(e => e.trim().replace(/\*\*([^*]+)\*\*/g, "$1").replace(/__([^_]+)__/g, "$1").replace(/(^|\s)\*([^*\n]+)\*/g, "$1$2").replace(/(^|\s)_([^_\n]+)_/g, "$1$2").replace(/`([^`]+)`/g, "$1"));
    t.length && n.push(t)
  }
  if (0 === n.length) return e;
  const o = Math.max(...n.map(e => e.length)),
    r = new Array(o).fill(0);
  for (const e of n)
    for (let t = 0; t < o; t++) {
      const n = e[t] || "";
      n.length > r[t] && (r[t] = n.length)
    }
  const s = "+" + r.map(e => "-".repeat(e + 2)).join("+") + "+",
    a = e => "| " + r.map((t, n) => (e[n] || "").padEnd(t)).join(" | ") + " |",
    i = [s, a(n[0]), s];
  for (let e = 1; e < n.length; e++) i.push(a(n[e]));
  return i.push(s), "\n" + i.join("\n") + "\n"
}

function stripFollowUpMarkup(e) {
  if ("string" != typeof e || -1 === e.indexOf("<")) return e;
  const t = "(?:\"[^\"]*\"|'[^']*'|[^>])*",
    n = "(?:ElicitationsGroup|Elicitation|FollowUp)",
    o = e.replace(new RegExp(`<(${n})(?![A-Za-z])${t}>[\\s\\S]*?<\\/\\1\\s*>`, "g"), "").replace(new RegExp(`<\\/?${n}(?![A-Za-z])${t}>`, "g"), "");
  return o === e ? e : o.replace(/[ \t]+$/gm, "").replace(/\n{3,}/g, "\n\n").replace(/\n+[ \t]*(\*|-|_)(?:[ \t]*\1){2,}\s*$/, "").trim()
}

function formatTextExport(e, t) {
  let n = `${t}\nExported on: ${(new Date).toLocaleString()}\n\n`;
  return e.forEach(e => {
    const t = e.timestamp ? ` [${e.timestamp}]` : "";
    let o = e.text.replace(/```([^\n]*)\n([\s\S]*?)```/g, (e, t, n) => {
      const o = t.trim();
      return `\n--------------------------------------------------\n${o?`Language: ${o}`:"Code Block"}\n--------------------------------------------------\n${n.trim()}\n--------------------------------------------------\n`
    });
    o = o.replace(/(\n\|[^\n]+\|\n\|[\s\-:|]+\|\n(?:\|[^\n]+\|\n?)+)/g, e => markdownTableToAscii(e)), o = o.replace(/\n{3,}/g, "\n\n"), n += `${e.role}${t}\n\n${o}\n\n==================================================\n\n`
  }), n
}

function formatMarkdownExport(e, t, n) {
  const o = (new Date).toLocaleString();
  let r = n ? `${formatMarkdownFrontmatter(e,t,n)}# ${t}\n\n---\n\n` : `# ${t}\n\n> Exported on: ${o}\n\n---\n\n`;
  return e.forEach((t, n) => {
    const o = t.timestamp ? ` — ${t.timestamp}` : "";
    let s = t.text.replace(/\n{3,}/g, "\n\n");
    r += `## ${t.role}${o}\n\n${s}\n\n`;
    const a = n === e.length - 1;
    "Gemini" !== t.role || a || (r += "---\n\n")
  }), r
}

function formatMarkdownFrontmatter(e, t, n) {
  const o = ["---", `title: ${JSON.stringify(String(t))}`];
  n.source && o.push(`source: ${JSON.stringify(String(n.source))}`);
  let r = null;
  for (const t of e) "number" == typeof t.timeSec && t.timeSec > 1e9 && (null === r || t.timeSec < r) && (r = t.timeSec);
  return null !== r && o.push(`created: ${formatLocalIsoDateTime(new Date(1e3*r))}`), o.push(`exported: ${formatLocalIsoDateTime(n.exportedAt||new Date)}`), o.push(`messages: ${e.length}`), o.push("---"), o.join("\n") + "\n\n"
}

function formatLocalIsoDateTime(e) {
  const t = e => String(e).padStart(2, "0");
  return `${e.getFullYear()}-${t(e.getMonth()+1)}-${t(e.getDate())}T${t(e.getHours())}:${t(e.getMinutes())}:${t(e.getSeconds())}`
}

function formatPrintHtml(e, t) {
  const safeTitle = escapeHtml(t || "Gemini Chat");
  let n = `<!DOCTYPE html><html><head><title>${safeTitle}</title><style>
    body { font-family: 'Google Sans Text', 'Google Sans Flex', 'Google Sans', 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; line-height: 1.6; color: #333; }
    h1 { border-bottom: 2px solid #eee; padding-bottom: 10px; margin-top: 0; }
    .meta { color: #666; font-size: 0.9em; margin-bottom: 40px; }
    .message { margin-bottom: 24px; page-break-inside: auto; break-inside: auto; }
    .role { font-weight: bold; font-size: 0.9em; margin-bottom: 4px; display: flex; align-items: baseline; }
    .role .name { color: #1a73e8; margin-right: 10px; text-transform: uppercase; font-size: 0.85em; letter-spacing: 0.5px; }
    .role .name.user { color: #202124; }
    .text { white-space: pre-wrap; word-wrap: break-word; }
    pre { background-color: #f5f5f5; border: 1px solid #ddd; border-radius: 4px; padding: 12px; overflow-x: auto; font-family: 'Google Sans Code', 'Roboto Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 0.9em; white-space: pre-wrap; margin: 10px 0; page-break-inside: avoid; break-inside: avoid; }
    table { border-collapse: collapse; margin: 10px 0; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
    th { background-color: #f5f5f5; font-weight: bold; }
    tr:nth-child(even) { background-color: #fafafa; }
    @media print { body { padding: 0; margin: 0; width: 100%; max-width: 100%; -webkit-print-color-adjust: exact; } .message { page-break-inside: auto; break-inside: auto; } pre { page-break-inside: avoid; break-inside: avoid; } @page { margin: 2cm; } }
  </style></head><body><h1>${safeTitle}</h1><div class="meta">Exported on: ${(new Date).toLocaleString()}</div>`;
  return e.forEach(e => {
    if (!e) return;
    const t = "User" === e.role ? "user" : "gemini",
      o = e.timestamp ? `<span class="time">${escapeHtml(String(e.timestamp))}</span>` : "";
    let r = (e.text || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/```([^\n]*)\n([\s\S]*?)```/g, (e, t, n) => {
      const o = t.trim();
      return `${o?`<div style="font-size: 0.8em; color: #666; font-weight: bold; margin-bottom: 4px; text-transform: uppercase;">${o}</div>`:""}<pre>${n.trim()}</pre>`
    });
    r = r.replace(/(\n\|[^\n]+\|\n\|[\s\-:|]+\|\n(?:\|[^\n]+\|\n?)+)/g, e => {
      const t = e.trim().split("\n").filter(e => e.trim());
      if (t.length < 2) return e;
      let n = "<table>";
      return t.forEach((e, t) => {
        if (e.match(/^\|[\s\-:|]+\|$/)) return;
        const o = e.split("|").slice(1, -1).map(e => e.trim()),
          r = 0 === t,
          s = r ? "th" : "td";
        r && (n += "<thead>"), 2 === t && (n += "<tbody>"), n += "<tr>" + o.map(e => `<${s}>${e}</${s}>`).join("") + "</tr>", r && (n += "</thead>")
      }), n += "</tbody></table>", n
    }), r = r.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>").replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/__(.+?)__/g, "<strong>$1</strong>").replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, "<em>$1</em>").replace(/(?<!_)_([^_]+?)_(?!_)/g, "<em>$1</em>").replace(/`([^`]+)`/g, '<code style="background:#f0f0f0;padding:1px 4px;border-radius:3px;font-family:\'Google Sans Code\', \'Roboto Mono\', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;">$1</code>').replace(/~~(.+?)~~/g, "<del>$1</del>"), r = r.replace(/\n{2,}/g, "<br/><br/>").replace(/\n/g, "<br/>"), n += `<div class="message"><div class="role"><span class="name ${t}">${escapeHtml(String(e.role || ""))}</span> ${o}</div><div class="text">${r}</div></div>`
  }), n += "</body></html>", n
}

function ensureExportLibs(e) {
  const t = () => "pdf" === e ? "undefined" != typeof jspdf : "undefined" != typeof docx;
  return t() ? Promise.resolve(!0) : new Promise(n => {
    let o = !1;
    const r = e => {
      o || (o = !0, n(e))
    };
    try {
      chrome.runtime.sendMessage({
        type: "LOAD_EXPORT_LIBS",
        kind: e
      }, e => {
        if (chrome.runtime.lastError) return console.warn("[Gemini Power Suite] Export lib load failed:", chrome.runtime.lastError.message), void r(t());
        r(!(!e || !e.success) && t())
      })
    } catch (e) {
      console.warn("[Gemini Power Suite] Export lib load threw:", e), r(t())
    }
  })
}
async function generateDocxBlob(e, t) {
  if (await ensureExportLibs("docx"), "undefined" == typeof docx) return console.warn("[Gemini Power Suite] docx library not loaded"), showToast("DOCX library not loaded. Please reload extension.", "error"), null;
  const {
    Document: n,
    Packer: o,
    Paragraph: r,
    TextRun: s,
    Table: a,
    TableRow: i,
    TableCell: l,
    HeadingLevel: c,
    AlignmentType: d,
    WidthType: u,
    ShadingType: p,
    BorderStyle: g
  } = docx, m = (new Date).toLocaleString();

  function h(e, t = null) {
    return e.map(e => {
      const n = {
        text: e.text,
        bold: e.bold || !1,
        italics: e.italic || !1,
        strike: e.strikethrough || !1,
        font: "Calibri"
      };
      return t && (n.size = t), e.code && (n.font = "Consolas", n.shading = {
        type: p.SOLID,
        fill: "f5f5f5",
        color: "f5f5f5"
      }), new s(n)
    })
  }
  const f = [];
  f.push(new r({
    heading: c.TITLE,
    children: [new s({
      text: e,
      bold: !0,
      size: 56,
      font: "Calibri"
    })]
  })), f.push(new r({
    children: [new s({
      text: `Exported on: ${m}`,
      color: "666666",
      size: 24,
      font: "Calibri"
    })]
  })), f.push(new r({
    text: ""
  })), t.forEach(e => {
    const t = "User" === e.role ? "000000" : "1a73e8",
      n = [new s({
        text: e.role,
        bold: !0,
        color: t,
        size: 28,
        font: "Calibri"
      })];
    e.timestamp && n.push(new s({
      text: ` ${e.timestamp}`,
      color: "888888",
      size: 24,
      font: "Calibri"
    })), f.push(new r({
      children: n,
      spacing: {
        after: 50
      }
    })), f.push(new r({
      text: ""
    }));
    let o = e.text.replace(/^\n+/, "");
    const d = /```([^\n]*)\n([\s\S]*?)```/g,
      m = [];
    let y, b = 0;
    for (; null !== (y = d.exec(o));) y.index > b && m.push({
      type: "text",
      content: o.slice(b, y.index)
    }), m.push({
      type: "code",
      language: y[1],
      content: y[2]
    }), b = y.index + y[0].length;
    b < o.length && m.push({
      type: "text",
      content: o.slice(b)
    }), 0 === m.length && m.push({
      type: "text",
      content: o
    }), m.forEach((e, t) => {
      if ("code" === e.type) {
        e.language && f.push(new r({
          children: [new s({
            text: e.language.toUpperCase(),
            font: "Calibri",
            size: 24,
            color: "555555",
            bold: !0
          })]
        }));
        e.content.split("\n").forEach(e => {
          f.push(new r({
            children: [new s({
              text: e || " ",
              font: "Consolas",
              size: 22
            })],
            shading: {
              type: p.SOLID,
              fill: "f5f5f5",
              color: "f5f5f5"
            },
            spacing: {
              line: 240
            }
          }))
        }), f.push(new r({
          text: ""
        }))
      } else {
        const n = /(\|[^\n]+\|\n\|[\s\-:|]+\|\n(?:\|[^\n]+\|\n?)+)/g;
        let o, s = e.content,
          d = 0;
        const y = [];
        for (; null !== (o = n.exec(s));) o.index > d && y.push({
          type: "text",
          content: s.slice(d, o.index)
        }), y.push({
          type: "table",
          content: o[1]
        }), d = o.index + o[0].length;
        d < s.length && y.push({
          type: "text",
          content: s.slice(d)
        }), 0 === y.length && y.push({
          type: "text",
          content: s
        }), y.forEach((e, n) => {
          if ("table" === e.type) {
            const t = function(e) {
              const t = e.split("\n").filter(e => e.trim() && e.includes("|"));
              if (t.length < 2) return null;
              const n = [];
              let o = !0;
              for (const e of t) {
                if (e.match(/^\|[\s\-:|]+\|$/)) {
                  o = !1;
                  continue
                }
                const t = e.split("|").slice(1, -1).map(e => e.trim()).map(e => {
                  const t = parseMarkdownSegments(e);
                  return new l({
                    children: [new r({
                      children: h(t, 24)
                    })],
                    shading: o ? {
                      type: p.SOLID,
                      fill: "e0e0e0",
                      color: "e0e0e0"
                    } : void 0
                  })
                });
                n.push(new i({
                  children: t
                })), o && (o = !1)
              }
              return 0 === n.length ? null : new a({
                rows: n,
                width: {
                  size: 100,
                  type: u.PERCENTAGE
                }
              })
            }(e.content);
            t && (f.push(t), f.push(new r({
              text: ""
            })))
          } else {
            const o = e.content.split("\n"),
              s = n + 1 < y.length && "table" === y[n + 1].type,
              a = n === y.length - 1 && t + 1 < m.length && "code" === m[t + 1].type;
            o.forEach((e, t) => {
              let n = {};
              if (s || a) {
                if (o.slice(t + 1).every(e => !e.trim())) {
                  if (!e.trim()) return;
                  n = {
                    spacing: {
                      after: 80
                    }
                  }
                }
              }
              f.push(function(e, t = {}) {
                if (!e || "" === e.trim()) return new r({
                  text: ""
                });
                const n = parseBlockMarkdown(e);
                switch (n.type) {
                  case "header": {
                    const e = {
                      1: c.HEADING_1,
                      2: c.HEADING_2,
                      3: c.HEADING_3,
                      4: c.HEADING_4,
                      5: c.HEADING_5,
                      6: c.HEADING_6
                    };
                    return new r({
                      heading: e[n.level] || c.HEADING_3,
                      children: h(n.segments),
                      ...t
                    })
                  }
                  case "bullet":
                    return new r({
                      bullet: {
                        level: n.indent
                      },
                      children: h(n.segments, 24),
                      ...t
                    });
                  case "number":
                    return new r({
                      numbering: {
                        reference: "sg-numbered-list",
                        level: n.indent
                      },
                      children: h(n.segments, 24),
                      ...t
                    });
                  case "rule":
                    return new r({
                      border: {
                        bottom: {
                          style: g.SINGLE,
                          size: 6,
                          color: "BFBFBF",
                          space: 1
                        }
                      },
                      children: []
                    });
                  default:
                    return new r({
                      children: h(n.segments, 24),
                      ...t
                    })
                }
              }(e, n))
            })
          }
        })
      }
    }), f.push(new r({
      text: "",
      spacing: {
        after: 140
      }
    }))
  });
  const y = new n({
    numbering: {
      config: [{
        reference: "sg-numbered-list",
        levels: [{
          level: 0,
          format: "decimal",
          text: "%1.",
          alignment: d.START
        }, {
          level: 1,
          format: "decimal",
          text: "%1.%2.",
          alignment: d.START
        }, {
          level: 2,
          format: "decimal",
          text: "%1.%2.%3.",
          alignment: d.START
        }]
      }]
    },
    sections: [{
      properties: {},
      children: f
    }]
  });
  return await o.toBlob(y)
}

function parseMarkdownSegments(e) {
  if (!e) return [{
    text: "",
    bold: !1,
    italic: !1,
    code: !1,
    strikethrough: !1
  }];
  const t = [];
  const n = [];
  [{
    regex: /\*\*\*(.+?)\*\*\*/g,
    bold: !0,
    italic: !0
  }, {
    regex: /___(.+?)___/g,
    bold: !0,
    italic: !0
  }, {
    regex: /\*\*(.+?)\*\*/g,
    bold: !0,
    italic: !1
  }, {
    regex: /__(.+?)__/g,
    bold: !0,
    italic: !1
  }, {
    regex: /(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g,
    bold: !1,
    italic: !0
  }, {
    regex: /(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g,
    bold: !1,
    italic: !0
  }, {
    regex: /`([^`]+)`/g,
    code: !0
  }, {
    regex: /~~(.+?)~~/g,
    strikethrough: !0
  }].forEach(t => {
    const o = new RegExp(t.regex.source, "g");
    let r;
    for (; null !== (r = o.exec(e));) n.push({
      start: r.index,
      end: r.index + r[0].length,
      text: r[1],
      bold: t.bold || !1,
      italic: t.italic || !1,
      code: t.code || !1,
      strikethrough: t.strikethrough || !1
    })
  }), n.sort((e, t) => e.start - t.start);
  const o = [];
  let r = 0;
  n.forEach(e => {
    e.start >= r && (o.push(e), r = e.end)
  });
  let s = 0;
  return o.forEach(n => {
    n.start > s && t.push({
      text: e.substring(s, n.start),
      bold: !1,
      italic: !1,
      code: !1,
      strikethrough: !1
    }), t.push({
      text: n.text,
      bold: n.bold,
      italic: n.italic,
      code: n.code,
      strikethrough: n.strikethrough
    }), s = n.end
  }), s < e.length && t.push({
    text: e.substring(s),
    bold: !1,
    italic: !1,
    code: !1,
    strikethrough: !1
  }), t.length > 0 ? t : [{
    text: e,
    bold: !1,
    italic: !1,
    code: !1,
    strikethrough: !1
  }]
}

function parseBlockMarkdown(e) {
  const t = e.trimStart(),
    n = e.length - t.length,
    o = t.match(/^(#{1,6})\s+(.*)$/);
  if (o) return {
    type: "header",
    level: o[1].length,
    content: o[2],
    segments: parseMarkdownSegments(o[2])
  };
  if (/^([-*_])(?:[ \t]*\1){2,}[ \t]*$/.test(t)) return {
    type: "rule",
    content: "",
    segments: []
  };
  const r = t.match(/^[-*]\s+(.*)$/);
  if (r && !t.match(/^[-*]{3,}/)) return {
    type: "bullet",
    indent: Math.floor(n / 2),
    content: r[1],
    segments: parseMarkdownSegments(r[1])
  };
  const s = t.match(/^(\d+)\.\s+(.*)$/);
  return s ? {
    type: "number",
    num: parseInt(s[1]),
    indent: Math.floor(n / 2),
    content: s[2],
    segments: parseMarkdownSegments(s[2])
  } : {
    type: "text",
    content: e,
    segments: parseMarkdownSegments(e)
  }
}
function sanitizePdfText(str) {
  if (!str) return "";
  return String(str).replace(/[\uD800-\uDFFF]/g, "");
}

async function generatePdfBlob(e, t, n = {}) {
  const {
    stripWatermark: o = !1,
    systemPrompt: r = ""
  } = n;
  if (await ensureExportLibs("pdf"), "undefined" == typeof jspdf) return console.warn("[Gemini Power Suite] jsPDF library not loaded"), showToast("PDF library not loaded. Please reload extension.", "error"), null;
  const {
    jsPDF: s
  } = jspdf, a = new s({
    orientation: "portrait",
    unit: "pt",
    format: "a4"
  });
  if ("undefined" != typeof ROBOTO_FONTS) {
    [{
      style: "normal",
      key: "normal"
    }, {
      style: "bold",
      key: "bold"
    }, {
      style: "italic",
      key: "italic"
    }, {
      style: "bolditalic",
      key: "bolditalic"
    }].forEach(({
      style: e,
      key: t
    }) => {
      ROBOTO_FONTS[t] && (a.addFileToVFS(`Roboto-${e}.ttf`, ROBOTO_FONTS[t]), a.addFont(`Roboto-${e}.ttf`, "Roboto", e))
    }), a.setFont("Roboto")
  }
  const i = 50,
    l = 495.28,
    c = 11,
    d = 16;
  let u = i;
  const p = (e = 16) => u + e > 791.89 && (a.addPage(), u = i, !0),
    g = (e, t, n, o, r, defaultBold = false) => {
      let s = t,
        l = n;
      const c = .3 * r;
      return e.forEach((e, n) => {
        if (!e.text) return;
        const isBold = Boolean(e.bold || defaultBold);
        let d = "normal";
        isBold && e.italic ? d = "bolditalic" : isBold ? d = "bold" : e.italic && (d = "italic");
        const isCode = Boolean(e.code);
        const fontName = isCode ? (/[^\x00-\xFF]/.test(e.text) ? "Roboto" : "courier") : "Roboto";
        a.setFont(fontName, isCode ? (isBold ? "bold" : "normal") : d);
        a.setFontSize(r);
        e.text.split(" ").forEach((n, d) => {
          if (!n && 0 === d) return;
          const u = a.getTextWidth(n);
          if (s + (u + (s > t ? c : 0)) > t + o && s > t && (l += 1.3 * r, s = t, l > 791.89 && (a.addPage(), l = i)), s > t && (s += c), e.code && (a.setFillColor(245, 245, 245), a.rect(s - 2, l - r + 2, u + 4, r + 2, "F"), a.setTextColor(0, 0, 0)), a.text(n, s, l), e.strikethrough) {
            const e = l - .3 * r;
            a.setDrawColor(100, 100, 100), a.setLineWidth(.5), a.line(s, e, s + u, e)
          }
          s += u
        })
      }), l + 1.3 * r
    },
    m = e => {
      const t = e - .35 * c;
      return a.setDrawColor(191, 191, 191), a.setLineWidth(.75), a.line(i, t, 545.28, t), a.setDrawColor(0, 0, 0), e + d
    };
  const cleanTitle = sanitizePdfText(e || "Gemini Chat");
  if (r) {
    const cleanSysPrompt = sanitizePdfText(r);
    a.setFontSize(10), a.setFont("Roboto", "italic"), a.setTextColor(80, 80, 80);
    a.splitTextToSize(cleanSysPrompt, l).forEach(e => {
      u + 12 > 791.89 && (a.addPage(), u = i), a.text(e, i, u), u += 12
    }), u += 8
  }
  a.setFontSize(18), a.setFont("Roboto", "bold"), a.setTextColor(0, 0, 0);
  const titleLines = a.splitTextToSize(cleanTitle, l);
  titleLines.forEach(line => {
    p(22);
    a.text(line, i, u + 18);
    u += 22;
  });
  u += 13;
  if (!o) {
    p(20);
    a.setFontSize(10);
    a.setFont("Roboto", "normal");
    a.setTextColor(100, 100, 100);
    a.text(`Exported on: ${(new Date).toLocaleString()}`, i, u);
    u += 25;
  }
  a.setTextColor(0, 0, 0);
  t.forEach(e => {
    p(50);
    let t = sanitizePdfText(e.text || "").replace(/\n{3,}/g, "\n\n").replace(/^\n+/, "");
    const n = [];
    t = t.replace(/(\n\|[^\n]+\|\n\|[\s\-:|]+\|\n(?:\|[^\n]+\|\n?)+)/g, e => {
      const t = e.trim().split("\n").filter(e => e.trim());
      if (t.length < 2) return e;
      const o = t.filter(e => !e.match(/^\|[\s\-:|]+\|$/)).map(e => e.split("|").slice(1, -1).map(e => sanitizePdfText(e.trim()))),
        r = `__PDF_TABLE_${n.length}__`;
      return n.push(o), "\n" + r + "\n"
    });
    const o = "Gemini" === e.role,
      r = e.role.toUpperCase(),
      s = e.timestamp ? `  ${e.timestamp}` : "";
    if (a.setFontSize(10), a.setFont("Roboto", "bold"), o ? a.setTextColor(26, 115, 232) : a.setTextColor(32, 33, 36), a.text(r, i, u), s) {
      const e = a.getTextWidth(r);
      a.setFont("Roboto", "normal"), a.setTextColor(128, 128, 128), a.text(s, i + e, u)
    }
    u += d, u += 8, a.setTextColor(0, 0, 0);
    const h = t.split(/```([^\n]*)\n([\s\S]*?)```/g);
    for (let e = 0; e < h.length; e++) {
      const t = h[e];
      if (e % 3 == 0) {
        if (!t.trim()) continue;
        const e = /__PDF_TABLE_(\d+)__/g;
        let o, r = 0;
        for (; null !== (o = e.exec(t));) {
          const e = t.substring(r, o.index);
          if (e.trim()) {
            e.split("\n").forEach(e => {
              if (!e.trim()) return void(u += 8);
              p(32);
              const t = parseBlockMarkdown(e);
              if ("rule" === t.type) return void(u = m(u));
              let n = c,
                o = i,
                r = "";
              switch (t.type) {
                case "header":
                  n = 1 === t.level ? 16 : 2 === t.level ? 14 : 3 === t.level ? 13 : 12, u += 4, a.setFont("Roboto", "bold");
                  break;
                case "bullet":
                  o = i + 12 * t.indent + 12, r = "• ";
                  break;
                case "number":
                  a.setFontSize(c), a.setFont("Roboto", "normal"), r = `${t.num}. `, o = i + 12 * t.indent + Math.max(12, a.getTextWidth(r) + 2)
              }
              r && (a.setFontSize(c), a.setFont("Roboto", "normal"), a.text(r, i + 12 * t.indent, u));
              const s = t.segments || parseMarkdownSegments(t.content || e);
              u = g(s, o, u, l - (o - i), n, "header" === t.type), "header" === t.type && (u += 2)
            })
          }
          const s = parseInt(o[1]);
          if (n[s]) {
            p(50);
            const e = n[s],
              t = [e[0]],
              o = e.slice(1);
            a.autoTable({
              startY: u,
              head: t,
              body: o,
              margin: {
                left: i,
                right: i
              },
              styles: {
                fontSize: 9,
                cellPadding: 4,
                font: "Roboto"
              },
              headStyles: {
                fillColor: [240, 240, 240],
                textColor: [0, 0, 0],
                fontStyle: "bold",
                font: "Roboto"
              },
              alternateRowStyles: {
                fillColor: [250, 250, 250]
              }
            }), u = a.lastAutoTable.finalY + 10
          }
          r = o.index + o[0].length
        }
        const s = t.substring(r);
        if (s.trim()) {
          s.split("\n").forEach(e => {
            if (!e.trim()) return void(u += 8);
            p(32);
            const t = parseBlockMarkdown(e);
            if ("rule" === t.type) return void(u = m(u));
            let n = c,
              o = i,
              r = "";
            switch (t.type) {
              case "header":
                n = 1 === t.level ? 16 : 2 === t.level ? 14 : 3 === t.level ? 13 : 12, u += 4;
                break;
              case "bullet":
                o = i + 12 * t.indent + 12, r = "• ";
                break;
              case "number":
                a.setFontSize(c), a.setFont("Roboto", "normal"), r = `${t.num}. `, o = i + 12 * t.indent + Math.max(12, a.getTextWidth(r) + 2)
            }
            r && (a.setFontSize(c), a.setFont("Roboto", "normal"), a.text(r, i + 12 * t.indent, u));
            const s = t.segments || parseMarkdownSegments(t.content || e);
            u = g(s, o, u, l - (o - i), n, "header" === t.type), "header" === t.type && (u += 2)
          })
        }
      } else if (e % 3 == 1) {
        const e = t.trim();
        e && (p(d), a.setFontSize(9), a.setFont("Roboto", "normal"), a.setTextColor(100, 100, 100), a.text(e.toUpperCase(), i, u), u += 12.8, a.setTextColor(0, 0, 0))
      } else if (e % 3 == 2) {
        const codeLines = t.split("\n");
        p(20);
        const n = 14;
        a.setFontSize(10);
        codeLines.forEach(line => {
          const fontName = /[^\x00-\xFF]/.test(line) ? "Roboto" : "courier";
          a.setFont(fontName, "normal");
          const wrapped = a.splitTextToSize(line || " ", 485.28);
          wrapped.forEach(subLine => {
            if (u + n > 791.89) {
              a.addPage();
              u = i;
            }
            a.setFillColor(245, 245, 245);
            a.rect(i, u - 10 + 2, l, n, "F");
            a.setTextColor(0, 0, 0);
            a.text(subLine, 55, u);
            u += n;
          });
        });
        u += 8;
      }
    }
    u += 24
  }), a.output("blob")
}

function _styledPdfHide(e, t) {
  if (!e) return;
  const n = e.style.getPropertyValue("display"),
    o = e.style.getPropertyPriority("display");
  e.style.setProperty("display", "none", "important"), t.push(() => {
    n ? e.style.setProperty("display", n, o) : e.style.removeProperty("display")
  })
}

function _styledPdfSetStyle(e, t, n, o) {
  if (!e) return;
  const r = e.style.getPropertyValue(t),
    s = e.style.getPropertyPriority(t);
  e.style.setProperty(t, n, "important"), o.push(() => {
    r ? e.style.setProperty(t, r, s) : e.style.removeProperty(t)
  })
}
window._sgShiftClickAnchors = window._sgShiftClickAnchors || {};
const SG_STYLED_PDF_PROGRESS_ID = "sg-styled-pdf-progress",
  SG_STYLED_PDF_BLOCKER_ID = "sg-styled-pdf-blocker";

function _styledPdfShowProgress(e) {
  let t = document.getElementById("sg-styled-pdf-progress");
  if (!t) {
    t = document.createElement("div"), t.id = "sg-styled-pdf-progress", t.setAttribute("role", "status"), t.setAttribute("aria-live", "polite"), t.style.cssText = ["position:fixed", "right:20px", "bottom:20px", "z-index:2147483647", "display:flex", "align-items:center", "gap:12px", "padding:14px 20px", "border-radius:16px", "background:var(--gem-sys-color--surface-container, #f0f4f9)", "color:var(--gem-sys-color--on-surface, #1f1f1f)", "border:1px solid var(--gem-sys-color--outline-variant, rgba(0,0,0,0.12))", "box-shadow:0 4px 16px rgba(0,0,0,0.18)", "font-family:var(--sg-font-text)", "font-size:14px", "font-weight:500", "line-height:20px", "max-width:min(420px, calc(100vw - 40px))", "pointer-events:none"].join(";");
    const e = document.createElement("span");
    e.style.cssText = "width:20px;height:20px;flex:none;box-sizing:border-box;border-radius:50%;border:2.5px solid color-mix(in srgb, currentColor 20%, transparent);border-top-color:var(--gem-sys-color--primary, #0b57d0);animation:sg-spin .8s linear infinite;display:inline-block;";
    const n = document.createElement("span");
    n.className = "sg-styled-pdf-progress-label", t.append(e, n), document.body.appendChild(t)
  }
  return _styledPdfUpdateProgress(e), t
}

function _styledPdfUpdateProgress(e) {
  const t = document.querySelector("#sg-styled-pdf-progress .sg-styled-pdf-progress-label");
  t && t.textContent !== e && (t.textContent = e)
}

function _styledPdfRemoveProgress() {
  document.getElementById("sg-styled-pdf-progress")?.remove()
}

function _styledPdfShowInputBlocker() {
  if (document.getElementById("sg-styled-pdf-blocker")) return;
  const e = document.createElement("div");
  e.id = "sg-styled-pdf-blocker", e.style.cssText = "position:fixed;inset:0;z-index:2147483646;background:transparent;cursor:wait;";
  const t = e => {
      e.preventDefault(), e.stopPropagation()
    },
    n = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "PageUp", "PageDown", "Home", "End", " ", "Spacebar"],
    o = e => {
      n.includes(e.key) && (e.preventDefault(), e.stopPropagation())
    };
  if (window.addEventListener("wheel", t, {
      passive: !1,
      capture: !0
    }), window.addEventListener("touchmove", t, {
      passive: !1,
      capture: !0
    }), window.addEventListener("keydown", o, !0), e._sgCleanup = () => {
      window.removeEventListener("wheel", t, {
        capture: !0
      }), window.removeEventListener("touchmove", t, {
        capture: !0
      }), window.removeEventListener("keydown", o, !0)
    }, document.activeElement && document.activeElement !== document.body) try {
    document.activeElement.blur()
  } catch (e) {}
  document.body.appendChild(e)
}

function _styledPdfRemoveInputBlocker() {
  const e = document.getElementById("sg-styled-pdf-blocker");
  e && (e._sgCleanup && e._sgCleanup(), e.remove())
}
async function _styledPdfPrepareDOM(e) {
  document.querySelectorAll(["bard-sidenav", "side-navigation-content", ".sidenav-with-history-container", ".side-nav-menu-button", "side-nav-sparkle-button", "top-bar-actions", "header", "mat-toolbar", ".boqOnegoogleliteOgbOneGoogleBar", "#gb", "#gbwa", "input-area-v2", "input-area", "bard-input-area", "rich-textarea", "mat-mdc-form-field", "input-toolbar", "input-container", "zero-state-wrapper", "follow-up-suggestion-list", "mat-list-item.suggestion", "message-actions", "response-actions", "thumbs-feedback", "share-button", "share-and-export", "menu-trigger", "sources-list", "sources-container", "data-stream-container", "related-content", "simplified-input-menu", '[data-test-id="conversation-actions"]', "disclaimer", "freemium-rag-disclaimer", "freemium-file-upload-near-quota-disclaimer", "freemium-file-upload-quota-exceeded-disclaimer", '[class*="disclaimer-container"]', "freemium-banner", "freemium-disclaimer", ".table-footer", ".hide-from-message-actions", ".overflow-menu-button", "code-block .buttons", 'code-block [class*="copy-button"]', 'code-block [class*="download-button"]', 'code-block button[aria-label="Copy code"]', 'code-block button[aria-label="Download code"]'].join(",")).forEach(t => _styledPdfHide(t, e)), document.querySelectorAll('button, [role="button"]').forEach(t => {
    const n = (t.innerText || t.textContent || "").trim();
    if ("Show thinking" === n || "Hide thinking" === n || "Thinking" === n || "Sources" === n) {
      _styledPdfHide(t.closest('model-thoughts, thought-chunk, [class*="thought"], [class*="thinking"], details, .response-element-row') || t.parentElement || t, e)
    }
  }), document.querySelectorAll('model-thoughts, thought-chunk, [class*="thought-chunk"], [class*="thinking-content"]').forEach(t => _styledPdfHide(t, e)), document.querySelectorAll('[id^="sg-"], [class*="sg-header-btn"], [class*="sg-floating-tooltip"], [class*="sg-scroll-nav"], [class*="sg-word-counter"], [class*="sg-quick-action"], [class*="sg-message-queue"], [class*="sg-pinned-collapse"], [class*="sg-folder"], [class*="sg-toast"]').forEach(t => {
    "sg-styled-pdf-progress" !== t.id && "sg-styled-pdf-blocker" !== t.id && _styledPdfHide(t, e)
  });
  const t = document.querySelector("infinite-scroller.chat-history") || document.querySelector("infinite-scroller") || document.querySelector('[class*="chat-history"]');
  if (t) {
    _styledPdfSetStyle(t, "padding-top", "0", e);
    let n = t;
    for (; n && n !== document.documentElement;) _styledPdfSetStyle(n, "overflow", "visible", e), _styledPdfSetStyle(n, "overflow-y", "visible", e), _styledPdfSetStyle(n, "height", "auto", e), _styledPdfSetStyle(n, "max-height", "none", e), _styledPdfSetStyle(n, "mask-image", "none", e), _styledPdfSetStyle(n, "-webkit-mask-image", "none", e), n = n.parentElement
  }
  document.querySelectorAll(".top-gradient, .bottom-gradient, .bottom-gradient-container, .gradient-strip").forEach(t => _styledPdfHide(t, e)), document.querySelectorAll(".conversation-container").forEach(t => {
    _styledPdfSetStyle(t, "min-height", "auto", e)
  }), document.querySelectorAll('.restart-chat-button-scroll-placeholder, [class*="scroll-placeholder"], [class*="scroll-anchor"], [class*="scroll-spacer"]').forEach(t => _styledPdfHide(t, e)), document.body.classList.contains("dark-theme") && (document.body.classList.remove("dark-theme"), document.body.classList.add("light-theme"), e.push(() => {
    document.body.classList.remove("light-theme"), document.body.classList.add("dark-theme")
  }), [document.documentElement, document.body].forEach(t => {
    _styledPdfSetStyle(t, "background", "#ffffff", e), _styledPdfSetStyle(t, "background-color", "#ffffff", e), _styledPdfSetStyle(t, "color", "#1f1f1f", e)
  }));
  const n = document.createElement("style");
  n.id = "sg-styled-pdf-print-style", n.textContent = '\n    @page { size: A4; margin: 0.5in; }\n    @media print {\n      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }\n      html, body { background: #ffffff !important; color: #1f1f1f !important; }\n      bard-sidenav, side-navigation-content, .sidenav-with-history-container,\n      .side-nav-menu-button, side-nav-sparkle-button,\n      header, mat-toolbar, top-bar-actions,\n      .boqOnegoogleliteOgbOneGoogleBar, #gb, #gbwa,\n      input-area-v2, input-area, bard-input-area, rich-textarea, input-toolbar,\n      follow-up-suggestion-list, zero-state-wrapper,\n      message-actions, response-actions, thumbs-feedback,\n      share-and-export, share-button, sources-list, sources-container,\n      related-content, simplified-input-menu,\n      [data-test-id="conversation-actions"],\n      disclaimer, freemium-rag-disclaimer, freemium-banner, freemium-disclaimer,\n      freemium-file-upload-near-quota-disclaimer,\n      freemium-file-upload-quota-exceeded-disclaimer,\n      [class*="disclaimer-container"],\n      .table-footer, .hide-from-message-actions, .overflow-menu-button,\n      code-block .buttons,\n      code-block [class*="copy-button"], code-block [class*="download-button"],\n      code-block button[aria-label="Copy code"],\n      code-block button[aria-label="Download code"],\n      [id^="sg-"], [class*="sg-floating-tooltip"], [class*="sg-toast"]\n      { display: none !important; }\n      /* Pagination — small block elements are always safe to keep whole. */\n      p, li, pre, code, blockquote, table,\n      .user-query-bubble-with-background, user-query\n      { break-inside: avoid; page-break-inside: avoid; }\n      /* model-response and code-block get break-inside protection applied\n         *inline* by JS, but only when they actually fit on one page. See\n         _styledPdfPrepareDOM for the measurement pass. */\n      infinite-scroller, infinite-scroller.chat-history, [class*="chat-history"],\n      .chat-history-scroll-container\n      { overflow: visible !important; height: auto !important; max-height: none !important; padding-top: 0 !important; mask-image: none !important; -webkit-mask-image: none !important; }\n      .top-gradient, .bottom-gradient, .bottom-gradient-container, .gradient-strip,\n      .restart-chat-button-scroll-placeholder,\n      [class*="scroll-placeholder"], [class*="scroll-anchor"], [class*="scroll-spacer"]\n      { display: none !important; }\n      /* Gemini sets an inline min-height on the latest .conversation-container\n         to anchor the user\'s question to the top of the viewport (Angular\n         scroll-anchor pattern). That min-height becomes blank trailing pages\n         once we unfix the scroll container. Override it.\n         Gemini also sets content-visibility: auto on every turn (class\n         turn-content-visibility). Chrome should render skipped turns for\n         print anyway; forcing visible makes sure no off-screen turn prints\n         as an empty 500px placeholder. */\n      .conversation-container { min-height: 0 !important; content-visibility: visible !important; }\n    }\n  ', document.head.appendChild(n), e.push(() => n.remove()), await new Promise(e => requestAnimationFrame(e));
  document.querySelectorAll("model-response, code-block, user-query").forEach(t => {
    const n = t.offsetHeight;
    n > 0 && n <= 980 && (_styledPdfSetStyle(t, "break-inside", "avoid", e), _styledPdfSetStyle(t, "page-break-inside", "avoid", e))
  })
}
async function generateStyledPdf() {
  const e = "function" == typeof findActiveChatInfo ? findActiveChatInfo() : null,
    t = (e && e.title || document.title || "Gemini Chat").replace(/\s*[-–—]\s*Google Gemini\s*$/i, "").trim() || "Gemini Chat",
    n = [],
    o = document.title;
  document.title = t, n.push(() => {
    document.title = o
  }), _styledPdfShowInputBlocker(), _styledPdfShowProgress("Preparing PDF…");
  try {
    let e = !1;
    const t = await ensureFullChatLoaded({
      onProgress: (e, t) => _styledPdfUpdateProgress(t ? `Loading the full chat (${e} of ${t})…` : "Loading the full chat…"),
      onIncomplete: () => {
        e = !0
      }
    });
    n.push(t), _styledPdfUpdateProgress("Preparing PDF…"), await _styledPdfPrepareDOM(n), _styledPdfUpdateProgress(e ? "Couldn't load the whole chat, so older messages may be missing. Opening print dialog…" : "Opening print dialog… Long chats can take a while."), await new Promise(e => requestAnimationFrame(e)), await new Promise(e => requestAnimationFrame(e)), await new Promise(e => {
      const t = () => {
        window.removeEventListener("afterprint", t), e()
      };
      window.addEventListener("afterprint", t), window.print()
    })
  } catch (e) {
    console.error("[Gemini Power Suite] Styled PDF error:", e);
    try {
      showToast("Styled PDF export failed", "error")
    } catch (e) {}
  } finally {
    _styledPdfRemoveInputBlocker(), _styledPdfRemoveProgress();
    for (const e of n.reverse()) try {
      e()
    } catch (e) {}
  }
}
async function exportChatAsPdf(e = {}) {
  let t = await getChatHistoryForExport(e);
  if (0 === t.length) return void showToast("Cannot export empty chat", "error");
  t = applyTimestampOpt(t, e), showToast("Exporting...", "info");
  const n = findActiveChatInfo(),
    o = n ? n.title : "Gemini Chat";
  try {
    const e = await generatePdfBlob(o, t);
    if (!e) return;
    const n = URL.createObjectURL(e),
      r = document.createElement("a");
    r.href = n;
    const s = o.replace(/[^a-z0-9]/gi, "_").substring(0, 50);
    r.download = `${s}_${(new Date).toISOString().slice(0,10)}.pdf`, document.body.appendChild(r), r.click(), setTimeout(() => {
      document.body.removeChild(r), URL.revokeObjectURL(n)
    }, 100), showToast("PDF downloaded!", "success")
  } catch (e) {
    console.error("[Gemini Power Suite] PDF export error:", e), showToast("PDF Generation failed. Try Print instead.", "error")
  }
}

function detectTheme() {
  if (document.body.classList.contains("dark-theme")) return "dark";
  if (document.body.classList.contains("light-theme")) return "light";
  const e = window.getComputedStyle(document.body).backgroundColor;
  if (e) {
    const t = e.match(/\d+/g);
    if (t && t.length >= 3) {
      return (299 * parseInt(t[0]) + 587 * parseInt(t[1]) + 114 * parseInt(t[2])) / 1e3 < 128 ? "dark" : "light"
    }
  }
  return "dark"
}

function isDarkTheme() {
  return "dark" === detectTheme()
}

function getThemeColors(e) {
  return void 0 === e && (e = isDarkTheme()), {
    border: e ? "#5f6368" : "#dadce0",
    btnBg: e ? "rgba(32, 33, 36, 0.95)" : "rgba(255, 255, 255, 0.95)",
    hoverBg: e ? "#3c4043" : "#f1f3f4",
    hoverBgAlt: e ? "#3c4043" : "#e8eaed",
    sidebarHover: e ? "#3c4043" : "#dce1e9",
    textPrimary: e ? "#e8eaed" : "#1f1f1f",
    textPrimaryAlt: e ? "#e8eaed" : "#202124",
    textSecondary: e ? "#9aa0a6" : "#5f6368",
    iconText: e ? "#e8eaed" : "#5f6368",
    accent: e ? "#8ab4f8" : "#1a73e8",
    solidBg: e ? "#1e1f20" : "#ffffff",
    dropdownBg: e ? "#2d2e31" : "#ffffff",
    tabActiveBg: e ? "#000000" : "white"
  }
}

let _sgLastSavedTheme = null,
  _sgLastObservedTheme = null;

function updateTheme() {
  const e = detectTheme(),
    t = "dark" === e,
    n = getThemeColors(t),
    o = {
      bg: n.btnBg,
      text: n.iconText,
      border: n.border,
      hoverBg: n.hoverBgAlt,
      hoverText: n.textPrimary
    };
  _sgLastObservedTheme = e;
  if (e !== _sgLastSavedTheme) {
    _sgLastSavedTheme = e;
    try {
      localStorage.setItem("sg_last_theme", e)
    } catch (e) {}
  }
  const r = document.getElementById("sg-optimize-prompt-btn");
  r && (r.style.backgroundColor = o.bg, r.style.color = o.text, r.style.borderColor = o.border);
  const s = document.getElementById("sg-word-counter");
  s && (s.style.background = t ? "rgba(32, 33, 36, 0.9)" : "rgba(255, 255, 255, 0.9)", s.style.color = o.text, s.style.borderColor = o.border);
  document.querySelectorAll(".sg-message-timestamp").forEach(e => {
    e.style.color = t ? "#9aa0a6" : "#70757a";
    const n = e.querySelector("svg");
    n && (n.style.color = "currentColor")
  });
  const i = document.querySelector(".sg-section-title");
  i && (i.style.color = o.hoverText);
  const l = document.querySelector(".sg-section-chevron");
  l && (l.style.color = t ? "#9aa0a6" : "#727676");
  ["sg-folders-menu-item", "sg-prompts-menu-item", "sg-skills-menu-item", "sg-settings-menu-item"].forEach(e => {
    const n = document.getElementById(e);
    if (n) {
      const e = n.querySelector("span"),
        r = n.querySelector("svg");
      e && (e.style.color = o.hoverText), r && (r.style.color = t ? "#9aa0a6" : "#575a5a")
    }
  });
  const c = document.getElementById("sg-pinned-section-header");
  if (c) {
    const e = c.querySelector("span"),
      r = c.querySelector(".sg-section-header-left svg"),
      s = c.querySelector(".sg-pinned-chevron");
    e && (e.style.color = o.hoverText), r && (r.style.color = n.textSecondary), s && (s.style.color = t ? "#9aa0a6" : "#727676")
  }
  const d = document.getElementById("sg-queue-display");
  d && (d.style.backgroundColor = t ? "#1e1f20" : "#ffffff", d.style.borderColor = t ? "#3c4043" : "#dadce0", d.style.color = t ? "#e3e3e3" : "#3c4043", d.style.boxShadow = t ? "0 4px 20px rgba(0,0,0,0.5)" : "0 4px 12px rgba(0,0,0,0.15)", updateQueueDisplay());
  const u = document.getElementById("sg-quick-action-buttons");
  u && u.remove();
  document.querySelectorAll(".sg-download-audio-btn").forEach(e => {
    e.style.color = t ? "#fff" : "#000"
  });
}
let _sgThemeRAFPending = !1;
const sgBodyAttributeObserver = new MutationObserver(e => {
  for (const t of e)
    if ("class" === t.attributeName) {
      detectTheme() !== _sgLastObservedTheme && !_sgThemeRAFPending && (_sgThemeRAFPending = !0, requestAnimationFrame(() => {
        _sgThemeRAFPending = !1, updateTheme()
      }));
      break
    }
});
SG_IS_SILENT_BG_WORKER_TAB || sgBodyAttributeObserver.observe(document.body, {
  attributes: !0,
  attributeFilter: ["class"]
});
const MAX_TOASTS = 5;
let toastContainer = null;

function getToastContainer() {
  return toastContainer || (toastContainer = document.createElement("div"), toastContainer.id = "sg-toast-container", toastContainer.style.cssText = "\n      position: fixed;\n      bottom: 20px;\n      left: 20px;\n      display: flex;\n      flex-direction: column;\n      gap: 10px;\n      z-index: 99999999;\n      pointer-events: none; /* Let clicks pass through empty areas */\n    ", document.body.appendChild(toastContainer)), toastContainer
}

function showToast(e, t = "info") {
  const n = getToastContainer();
  for (; n.children.length >= MAX_TOASTS;) n.firstElementChild.remove();
  const o = Array.from(n.children),
    r = document.createElement("div"),
    s = (isDarkTheme(), {
      info: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      success: "linear-gradient(135deg, #0ba360 0%, #3cba92 100%)",
      error: "linear-gradient(135deg, #e85d6c 0%, #CA6673 100%)"
    });
  r.textContent = e, r.style.cssText = `\n    background: ${s[t]||s.info};\n    color: white;\n    padding: 12px 24px;\n    border-radius: 10px;\n    font-family: var(--sg-font-text);\n    font-size: 14px;\n    font-weight: 500;\n    box-shadow: 0 4px 12px rgba(0,0,0,0.3);\n    opacity: 0;\n    transform: translateX(-50px);\n    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);\n    backdrop-filter: blur(8px);\n    border: 1px solid rgba(255,255,255,0.1);\n    pointer-events: auto;\n    flex-shrink: 0;\n    margin-top: 0;\n  `, n.appendChild(r);
  const a = r.offsetHeight + 10;
  o.forEach(e => {
    e.style.transition = "none", e.style.transform = `translateY(${a}px)`, e.offsetHeight, e.style.transition = "transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)", e.style.transform = "translateY(0)"
  }), requestAnimationFrame(() => {
    r.style.opacity = "1", r.style.transform = "translateX(0)"
  }), setTimeout(() => {
    r.isConnected && (r.style.opacity = "0", r.style.transform = "translateX(-50px)", setTimeout(() => {
      r.isConnected && r.remove()
    }, 400))
  }, 3e3)
}

function trapFocusInModal(e, t) {
  const n = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

  function o(o) {
    if ("Escape" === o.key) return o.preventDefault(), void(t && t());
    if ("Tab" !== o.key) return;
    const r = Array.from(e.querySelectorAll(n)).filter(e => null !== e.offsetParent);
    if (0 === r.length) return;
    const s = r[0],
      a = r[r.length - 1],
      i = e.getRootNode().activeElement || document.activeElement;
    o.shiftKey ? i !== s && r.includes(i) || (o.preventDefault(), a.focus()) : i !== a && r.includes(i) || (o.preventDefault(), s.focus())
  }
  return e.addEventListener("keydown", o), requestAnimationFrame(() => {
    const t = e.querySelectorAll(n);
    t.length > 0 && t[0].focus()
  }), () => {
    e.removeEventListener("keydown", o)
  }
}

function enableArrowNavigation(e, t, n) {
  if (!e.dataset.arrowNavEnabled) return e.dataset.arrowNavEnabled = "true", e.addEventListener("keydown", o), e.querySelectorAll(t).forEach(e => {
    e.hasAttribute("tabindex") || e.setAttribute("tabindex", "0")
  }), () => {
    e.removeEventListener("keydown", o)
  };

  function o(o) {
    const r = Array.from(e.querySelectorAll(t)).filter(e => null !== e.offsetParent);
    if (0 === r.length) return;
    const s = e.getRootNode().activeElement || document.activeElement,
      a = r.indexOf(s);
    if ("ArrowDown" === o.key) {
      o.preventDefault();
      const e = a < r.length - 1 ? a + 1 : 0;
      r[e]?.focus()
    } else if ("ArrowUp" === o.key) {
      o.preventDefault();
      const e = a > 0 ? a - 1 : r.length - 1;
      r[e]?.focus()
    } else "Enter" !== o.key && " " !== o.key || -1 === a || (o.preventDefault(), n ? n(r[a], a) : r[a].click())
  }
}
(() => {
  const _sgLegacyAudioBookmarksMsg = e => {
    if ("ENABLE_TRASHCAN" === e.type) window.isTrashcanEnabled = !0;
    else if ("DISABLE_TRASHCAN" === e.type) window.isTrashcanEnabled = !1;
    else if ("ENABLE_DOWNLOAD_AUDIO" === e.type) isDownloadAudioEnabled = !0, initDownloadAudio();
    else if ("DISABLE_DOWNLOAD_AUDIO" === e.type) isDownloadAudioEnabled = !1, removeAllDownloadAudioButtons(), downloadAudioObserver && (downloadAudioObserver.disconnect(), downloadAudioObserver = null);
    else if ("ENABLE_BOOKMARKS" === e.type) isBookmarksEnabled = !0, sgLoadBookmarks().then(() => {
      initBookmarks(), sgApplyAllBookmarkStates(), sgRefreshBookmarksHeaderButton()
    });
    else if ("DISABLE_BOOKMARKS" === e.type) isBookmarksEnabled = !1, removeAllBookmarkButtons(), sgRefreshBookmarksHeaderButton(), bookmarksObserver && (bookmarksObserver.disconnect(), bookmarksObserver = null);
    else if ("ONBOARDING_DISMISSED" === e.type) {
      const e = document.getElementById("sg-onboarding-popup");
      e && e.remove()
    } else if ("SETTINGS_POPUP_OPENED" === e.type) {
      _sgWelcomeSettingsOpen = !0, sgCancelWelcomeTourTimer();
      const e = document.getElementById("sg-settings-reminder-popup");
      e && e.remove()
    } else "SETTINGS_POPUP_CLOSED" === e.type && (_sgWelcomeSettingsOpen = !1, sgMaybeScheduleWelcomeTour());
    return !1;
  };
  if ("undefined" != typeof SG && SG.messages) {
    SG.messages.onMatcher("legacy:audio-bookmarks-ui", () => !0, _sgLegacyAudioBookmarksMsg);
  } else if ("undefined" != typeof chrome && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener(_sgLegacyAudioBookmarksMsg);
  }
})();
let downloadAudioObserver = null,
  isDownloadAudioEnabled = !0;

function removeAllDownloadAudioButtons() {
  document.querySelectorAll(".sg-download-audio-btn").forEach(e => e.remove())
}

function getResponseText(e) {
  const t = e.cloneNode(!0);
  t.querySelectorAll(".cdk-visually-hidden").forEach(e => e.remove()), t.querySelectorAll('.sg-message-timestamp, [class*="timestamp"]').forEach(e => e.remove()), t.querySelectorAll('fact-check-button, sources-list, sources-carousel, button[aria-label*="Sources"]').forEach(e => e.remove()), t.querySelectorAll('button, [role="toolbar"], .actions-container, copy-button, tts-button').forEach(e => e.remove()), t.querySelectorAll('[class*="sg-"]').forEach(e => e.remove());
  const n = t.querySelector('.model-response-text, .response-content, [class*="response"]');
  return n ? n.innerText || n.textContent || "" : t.innerText || t.textContent || ""
}

function getATToken() {
  const e = document.querySelectorAll("script");
  for (const t of e) {
    const e = (t.textContent || "").match(/SNlM0e":"([^"]+)"/);
    if (e) return e[1]
  }
  return window.WIZ_global_data && window.WIZ_global_data.SNlM0e ? window.WIZ_global_data.SNlM0e : null
}
let _sgBuildLabelCache = "";

function getBuildLabel() {
  if (_sgBuildLabelCache) return _sgBuildLabelCache;
  const e = document.querySelectorAll("script");
  for (const t of e) {
    const e = (t.textContent || "").match(/"cfb2h":"([^"]+)"/);
    if (e) return _sgBuildLabelCache = e[1], _sgBuildLabelCache
  }
  return window.WIZ_global_data && window.WIZ_global_data.cfb2h ? (_sgBuildLabelCache = window.WIZ_global_data.cfb2h, _sgBuildLabelCache) : ""
}
async function fetchTTSAudio(e) {
  const t = getATToken();
  if (!t) throw new Error("Could not get authentication token");
  const n = document.documentElement.lang || "en-US",
    o = JSON.stringify([
      [
        ["XqA3Ic", JSON.stringify([null, e, n, null, 2]), null, "generic"]
      ]
    ]),
    r = new URLSearchParams;
  r.append("f.req", o), r.append("at", t);
  const s = getAccountRpcPrefix(),
    a = await fetch(`${s}/_/BardChatUi/data/batchexecute?rpcids=XqA3Ic&source-path=${encodeURIComponent(s+"/app")}&rt=c`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: r.toString(),
      credentials: "include"
    });
  if (!a.ok) throw new Error("TTS request failed");
  const i = (await a.text()).replace(/^\)\]\}'/, "").trim().split("\n");
  for (const e of i) try {
    const t = JSON.parse(e.trim());
    if (Array.isArray(t))
      for (const e of t)
        if (Array.isArray(e) && "wrb.fr" === e[0] && "XqA3Ic" === e[1]) {
          const t = e[2];
          if (t) {
            const e = JSON.parse(t);
            if (e && e[0]) return e[0]
          }
        }
  } catch (e) {}
  throw new Error("Could not find audio data in response")
}

function downloadAudioBlob(e, t) {
  const n = atob(e),
    o = new Uint8Array(n.length);
  for (let e = 0; e < n.length; e++) o[e] = n.charCodeAt(e);
  const r = new Blob([o], {
      type: "audio/ogg"
    }),
    s = URL.createObjectURL(r),
    a = document.createElement("a");
  a.href = s, a.download = t, document.body.appendChild(a), a.click(), setTimeout(() => {
    document.body.removeChild(a), URL.revokeObjectURL(s)
  }, 1000)
}

function createNativeDownloadGlyph() {
  const e = "http://www.w3.org/2000/svg",
    t = document.createElementNS(e, "svg");
  t.setAttribute("width", "20"), t.setAttribute("height", "20"), t.setAttribute("viewBox", "0 0 24 24"), t.setAttribute("fill", "none"), t.setAttribute("stroke", "currentColor"), t.setAttribute("stroke-linecap", "round"), t.setAttribute("stroke-linejoin", "round"), t.setAttribute("aria-hidden", "true");
  const n = document.createElementNS(e, "g");
  n.setAttribute("stroke-width", "1.5");
  for (const t of ["M12 4.5v10.25", "m7.25 10 4.75 4.75L16.75 10"]) {
    const o = document.createElementNS(e, "path");
    o.setAttribute("d", t), n.appendChild(o)
  }
  t.appendChild(n);
  const o = document.createElementNS(e, "path");
  return o.setAttribute("d", "M5.5 19h13"), o.setAttribute("stroke-width", "1.7"), t.appendChild(o), t
}

function createSvgIcon(e) {
  const t = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  if (t.setAttribute("width", "18"), t.setAttribute("height", "18"), t.setAttribute("viewBox", "0 0 24 24"), t.setAttribute("fill", "none"), t.setAttribute("stroke", "error" === e ? "red" : "currentColor"), t.setAttribute("stroke-width", "1.5"), t.setAttribute("stroke-linecap", "round"), t.setAttribute("stroke-linejoin", "round"), "loading" === e) {
    t.classList.add("sg-spin");
    const e = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    e.setAttribute("cx", "12"), e.setAttribute("cy", "12"), e.setAttribute("r", "10"), e.setAttribute("stroke-dasharray", "31.4 31.4"), e.setAttribute("stroke-linecap", "round"), t.appendChild(e)
  } else if ("success" === e) {
    const e = document.createElementNS("http://www.w3.org/2000/svg", "path");
    e.setAttribute("d", "M20 6L9 17l-5-5"), t.appendChild(e)
  } else if ("error" === e) {
    const e = document.createElementNS("http://www.w3.org/2000/svg", "path");
    e.setAttribute("d", "M18 6L6 18"), t.appendChild(e);
    const n = document.createElementNS("http://www.w3.org/2000/svg", "path");
    n.setAttribute("d", "M6 6l12 12"), t.appendChild(n)
  }
  return t
}
async function handleDownloadAudioClick(e, t) {
  e.preventDefault(), e.stopPropagation();
  const n = e.currentTarget,
    o = () => n.replaceChildren(createNativeDownloadGlyph());
  n.replaceChildren(createSvgIcon("loading")), n.disabled = !0;
  try {
    const e = getResponseText(t);
    if (!e || 0 === e.trim().length) throw new Error("No text content found");
    const r = await fetchTTSAudio(e.substring(0, 5e3));
    downloadAudioBlob(r, `gemini-response-${(new Date).toISOString().replace(/[:.]/g,"-").substring(0,19)}.ogg`), n.replaceChildren(createSvgIcon("success")), setTimeout(() => {
      o(), n.disabled = !1
    }, 1500)
  } catch (e) {
    console.error("[Gemini Power Suite] Download audio error:", e), n.replaceChildren(createSvgIcon("error")), setTimeout(() => {
      o(), n.disabled = !1
    }, 2e3)
  }
}

function injectDownloadButton(e) {
  if (!isDownloadAudioEnabled) return;
  if (e.querySelector(".sg-download-audio-btn")) return;
  if (e.querySelector("img, image-preview, .generated-image, [data-image-id], canvas-preview")) return;
  let t = e.querySelector("copy-button");
  if (!t) {
    const n = e.querySelector('button[aria-label="Copy"], button[aria-label*="copy"]');
    n && (t = n.parentElement && "COPY-BUTTON" === n.parentElement.tagName.toUpperCase() ? n.parentElement : n)
  }
  if (!t) return;
  const n = document.createElement("button");
  n.className = "sg-download-audio-btn", n.setAttribute("aria-label", "Download audio"), n.setAttribute("data-tooltip", "Download audio"), n.appendChild(createNativeDownloadGlyph()), n.addEventListener("click", t => {
    handleDownloadAudioClick(t, e)
  }), n.addEventListener("mouseenter", () => showSgDownloadTooltip(n)), n.addEventListener("mouseleave", hideSgDownloadTooltip), n.addEventListener("click", hideSgDownloadTooltip), t.parentElement && t.parentElement.insertBefore(n, t.nextSibling)
}
let _sgDownloadTooltipEl = null,
  _sgDownloadTooltipHideTimer = null;

function showSgDownloadTooltip(e) {
  if (!e || !e.isConnected) return;
  _sgDownloadTooltipHideTimer && (clearTimeout(_sgDownloadTooltipHideTimer), _sgDownloadTooltipHideTimer = null), _sgDownloadTooltipEl || (_sgDownloadTooltipEl = document.createElement("div"), _sgDownloadTooltipEl.className = "sg-floating-tooltip", document.body.appendChild(_sgDownloadTooltipEl)), _sgDownloadTooltipEl.textContent = e.getAttribute("aria-label") || "Download audio";
  const t = e.getBoundingClientRect(),
    n = _sgDownloadTooltipEl.offsetWidth;
  _sgDownloadTooltipEl.style.top = `${t.bottom+8}px`, _sgDownloadTooltipEl.style.left = t.left + t.width / 2 - n / 2 + "px", requestAnimationFrame(() => {
    _sgDownloadTooltipEl && _sgDownloadTooltipEl.classList.add("sg-floating-tooltip--visible")
  })
}

function hideSgDownloadTooltip() {
  _sgDownloadTooltipEl && (_sgDownloadTooltipEl.classList.remove("sg-floating-tooltip--visible"), _sgDownloadTooltipHideTimer && clearTimeout(_sgDownloadTooltipHideTimer), _sgDownloadTooltipHideTimer = setTimeout(() => {
    _sgDownloadTooltipEl && _sgDownloadTooltipEl.parentNode && _sgDownloadTooltipEl.parentNode.removeChild(_sgDownloadTooltipEl), _sgDownloadTooltipEl = null, _sgDownloadTooltipHideTimer = null
  }, 200))
}

const _SG_STREAM_LEAF_TAGS = new Set(["SPAN", "CODE", "STRONG", "EM", "BR", "P", "LI", "A", "B", "I", "PRE", "UL", "OL", "TR", "TD", "TH", "H1", "H2", "H3", "H4", "H5", "H6"]);
const _sgPendingAudioResp = new WeakSet;

function initDownloadAudio() {
  if (SG_IS_SILENT_BG_WORKER_TAB) return;
  const scheduleResp = resp => {
    if (!resp || _sgPendingAudioResp.has(resp) || resp.querySelector(".sg-download-audio-btn")) return;
    _sgPendingAudioResp.add(resp);
    injectDownloadButton(resp);
    setTimeout(() => {
      _sgPendingAudioResp.delete(resp);
      resp.isConnected && injectDownloadButton(resp);
    }, 500);
  };
  document.querySelectorAll("model-response").forEach(scheduleResp), downloadAudioObserver && downloadAudioObserver.disconnect(), downloadAudioObserver = new MutationObserver(sgRafCoalesceRecords(e => {
    const targets = new Set;
    for (const t of e)
      for (const n of t.addedNodes) {
        if (n.nodeType !== Node.ELEMENT_NODE) continue;
        const tag = n.tagName;
        if (_SG_STREAM_LEAF_TAGS.has(tag)) continue;
        if ("MODEL-RESPONSE" === tag) {
          targets.add(n);
          continue;
        }
        if ("COPY-BUTTON" === tag || "MESSAGE-ACTIONS" === tag || (n.getAttribute && ("Copy" === n.getAttribute("aria-label") || "Listen" === n.getAttribute("aria-label")))) {
          const mr = n.closest("model-response");
          mr && targets.add(mr);
          continue;
        }
        if (n.firstElementChild && n.querySelectorAll) {
          const mrs = n.querySelectorAll("model-response");
          if (mrs.length) {
            mrs.forEach(mr => targets.add(mr));
          } else {
            const cb = n.querySelector('copy-button, button[aria-label="Copy"]');
            if (cb) {
              const mr = n.closest("model-response") || cb.closest("model-response");
              mr && targets.add(mr);
            }
          }
        }
      }
    targets.forEach(scheduleResp);
  })), downloadAudioObserver.observe(document.body, {
    childList: !0,
    subtree: !0
  })
}
let bookmarksObserver = null,
  isBookmarksEnabled = !0;
const SG_BOOKMARKS_STORAGE_KEY = "sgBookmarks";
let _sgBookmarks = {},
  _sgBookmarkIds = new Set,
  _sgBookmarksLoaded = !1,
  _sgBookmarkTombs = [];

function sgUnwrapBookmarksStored(e) {
  return e && "object" == typeof e ? e.chats && "object" == typeof e.chats ? {
    chats: e.chats,
    deleted: Array.isArray(e.deleted) ? e.deleted : []
  } : {
    chats: e,
    deleted: []
  } : {
    chats: {},
    deleted: []
  }
}

function sgAddBookmarkTomb(e) {
  const t = Date.now(),
    n = _sgBookmarkTombs.find(t => t && t.id === e);
  n ? n.deletedAt = t : _sgBookmarkTombs.push({
    id: e,
    deletedAt: t
  })
}

function sgClearBookmarkTomb(e) {
  _sgBookmarkTombs = _sgBookmarkTombs.filter(t => !t || t.id !== e)
}

function sgNormalizeBookmarkEntry(e) {
  if ("string" == typeof e) return {
    id: e,
    text: "",
    ts: 0
  };
  if (e && "object" == typeof e && e.id) {
    const t = {
      id: e.id,
      text: e.text || "",
      ts: e.ts || 0
    };
    return "number" == typeof e.pos && (t.pos = e.pos), t
  }
  return null
}

function sgGetChatBookmarks(e) {
  const t = _sgBookmarks[e];
  return Array.isArray(t) ? t.map(sgNormalizeBookmarkEntry).filter(Boolean) : []
}

function sgRebuildBookmarkIndex() {
  _sgBookmarkIds = new Set;
  for (const e of Object.values(_sgBookmarks))
    if (Array.isArray(e))
      for (const t of e) {
        const e = sgNormalizeBookmarkEntry(t);
        e && _sgBookmarkIds.add(e.id)
      }
}
async function sgLoadBookmarks() {
  try {
    const e = await chrome.storage.local.get([SG_BOOKMARKS_STORAGE_KEY]),
      {
        chats: t,
        deleted: n
      } = sgUnwrapBookmarksStored(e[SG_BOOKMARKS_STORAGE_KEY]);
    _sgBookmarks = t, _sgBookmarkTombs = n
  } catch (e) {
    console.error("[Gemini Power Suite] Failed to load bookmarks:", e), _sgBookmarks = {}, _sgBookmarkTombs = []
  }
  sgRebuildBookmarkIndex(), _sgBookmarksLoaded = !0
}

function sgBuildBookmarksStored() {
  return {
    v: 2,
    chats: _sgBookmarks,
    deleted: _sgBookmarkTombs
  }
}
async function sgSaveBookmarks() {
  try {
    await safeLocalStorageSet({
      [SG_BOOKMARKS_STORAGE_KEY]: sgBuildBookmarksStored()
    })
  } catch (e) {
    console.error("[Gemini Power Suite] Failed to save bookmarks:", e)
  }
}

function sgGetTurnId(e) {
  const t = e.closest(".conversation-container");
  return t && t.id ? t.id : null
}

function sgIsBookmarked(e) {
  return !!e && _sgBookmarkIds.has(e)
}

function sgSetBookmarked(e, t, n) {
  if (!e) return;
  const o = getCurrentChatId(),
    r = sgGetChatBookmarks(o);
  if (t) {
    const t = r.find(t => t.id === e);
    t ? (t.text = n || t.text, t.ts = Date.now()) : r.push({
      id: e,
      text: n || "",
      ts: Date.now()
    }), _sgBookmarks[o] = r, _sgBookmarkIds.add(e), sgClearBookmarkTomb(e);
    const s = _sgTurnOrderCache.get(o);
    s && !s.has(e) && _sgTurnOrderCache.delete(o)
  } else {
    const t = r.filter(t => t.id !== e);
    t.length ? _sgBookmarks[o] = t : delete _sgBookmarks[o], _sgBookmarkIds.delete(e), sgAddBookmarkTomb(e);
    for (const t of Object.keys(_sgBookmarks)) {
      const n = sgGetChatBookmarks(t).filter(t => t.id !== e);
      n.length ? _sgBookmarks[t] = n : delete _sgBookmarks[t]
    }
  }
  sgSaveBookmarks(), sgRefreshBookmarksHeaderButton()
}

function sgChatHasBookmarks(e) {
  return !(!isBookmarksEnabled || !e) && sgGetChatBookmarks(String(e).replace(/^c_/, "")).length > 0
}

function sgBookmarkIndicatorHtml(e) {
  return sgChatHasBookmarks(e) ? `\n            <span class="sg-chat-bookmark-indicator" title="Has bookmarked messages" style="\n              width: 32px;\n              height: 32px;\n              display: flex;\n              align-items: center;\n              justify-content: center;\n              flex-shrink: 0;\n              color: var(--gem-sys-color--primary, #0b57d0);\n              margin-left: 8px;\n            ">\n              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="width: 20px; height: 20px;">\n                <path d="${SG_BOOKMARK_PATH}"/>\n              </svg>\n            </span>` : ""
}

function sgBookmarkSnippet(e) {
  let t = "";
  try {
    t = (getResponseText(e) || "").replace(/\s+/g, " ").trim()
  } catch (e) {}
  if (!t) {
    const n = e.closest(".conversation-container"),
      o = n && n.querySelector(".query-text");
    o && (t = (o.innerText || o.textContent || "").replace(/\s+/g, " ").trim())
  }
  return t.slice(0, 140)
}
const SG_BOOKMARK_PATH = "M7.75 4.5h8.5a1.25 1.25 0 0 1 1.25 1.25v13.02a.6.6 0 0 1-.92.51L12 16.3l-4.58 2.98a.6.6 0 0 1-.92-.51V5.75A1.25 1.25 0 0 1 7.75 4.5Z";

function createBookmarkGlyph(e) {
  const t = "http://www.w3.org/2000/svg",
    n = document.createElementNS(t, "svg");
  n.setAttribute("width", "20"), n.setAttribute("height", "20"), n.setAttribute("viewBox", "0 0 24 24"), n.setAttribute("fill", e ? "currentColor" : "none"), n.setAttribute("aria-hidden", "true");
  const o = document.createElementNS(t, "path");
  return o.setAttribute("d", SG_BOOKMARK_PATH), o.setAttribute("stroke", "currentColor"), o.setAttribute("stroke-width", "1.5"), o.setAttribute("stroke-linejoin", "round"), n.appendChild(o), n
}

function applyBookmarkVisual(e, t) {
  e.classList.toggle("sg-bookmarked", t);
  const n = e.closest(".conversation-container");
  n && n.classList.toggle("sg-bookmarked-turn", t);
  const o = e.querySelector(".sg-bookmark-btn");
  if (!o) return;
  o.classList.toggle("sg-bookmark-btn--on", t), o.setAttribute("aria-pressed", t ? "true" : "false");
  const r = t ? "Remove bookmark" : "Bookmark message";
  o.setAttribute("aria-label", r), o.setAttribute("data-tooltip", r), o.replaceChildren(createBookmarkGlyph(t))
}

function sgApplyAllBookmarkStates() {
  document.querySelectorAll("model-response").forEach(e => {
    applyBookmarkVisual(e, sgIsBookmarked(sgGetTurnId(e)))
  })
}

function removeAllBookmarkButtons() {
  document.querySelectorAll(".sg-bookmark-btn").forEach(e => e.remove()), document.querySelectorAll("model-response.sg-bookmarked").forEach(e => e.classList.remove("sg-bookmarked")), document.querySelectorAll(".conversation-container.sg-bookmarked-turn").forEach(e => e.classList.remove("sg-bookmarked-turn"))
}

function findMessageActionsBar(e) {
  return e.querySelector("message-actions .buttons-container-v2") || e.querySelector('message-actions [class*="buttons-container"]') || null
}

function findBookmarkInsertPoint(e) {
  const t = e.querySelector(":scope > .sg-download-audio-btn");
  if (t) return {
    ref: t.nextSibling
  };
  const n = Array.from(e.children);
  let o = null;
  for (const e of n) {
    const t = e.tagName.toUpperCase();
    "COPY-BUTTON" !== t && "SHARE-BUTTON" !== t || (o = e)
  }
  if (o) return {
    ref: o.nextSibling
  };
  const r = n.find(e => e.querySelector('[data-test-id="more-menu-button"]'));
  if (r) return {
    ref: r
  };
  const s = n.find(e => e.classList.contains("spacer"));
  return s ? {
    ref: s
  } : {
    ref: null
  }
}
async function handleBookmarkClick(e, t) {
  e.preventDefault(), e.stopPropagation(), hideSgDownloadTooltip();
  const n = sgGetTurnId(t);
  if (!n) return;
  _sgBookmarksLoaded || await sgLoadBookmarks();
  const o = !sgIsBookmarked(n);
  sgSetBookmarked(n, o, o ? sgBookmarkSnippet(t) : ""), applyBookmarkVisual(t, o)
}

function injectBookmarkButton(e) {
  if (!isBookmarksEnabled) return;
  if (e.querySelector(".sg-bookmark-btn")) return;
  const t = sgGetTurnId(e);
  if (!t) return;
  const n = findMessageActionsBar(e);
  if (!n) return;
  const o = sgIsBookmarked(t),
    r = document.createElement("button");
  r.className = "sg-bookmark-btn", r.setAttribute("type", "button"), r.addEventListener("click", t => {
    handleBookmarkClick(t, e)
  }), r.addEventListener("mouseenter", () => showSgDownloadTooltip(r)), r.addEventListener("mouseleave", hideSgDownloadTooltip);
  const {
    ref: s
  } = findBookmarkInsertPoint(n);
  n.insertBefore(r, s), applyBookmarkVisual(e, o)
}

const _sgPendingBookmarkResp = new WeakSet;

function initBookmarks() {
  if (SG_IS_SILENT_BG_WORKER_TAB) return;
  const scheduleResp = resp => {
    if (!resp || _sgPendingBookmarkResp.has(resp) || resp.querySelector(".sg-bookmark-btn")) return;
    _sgPendingBookmarkResp.add(resp);
    injectBookmarkButton(resp);
    setTimeout(() => {
      resp.isConnected && injectBookmarkButton(resp);
      setTimeout(() => {
        _sgPendingBookmarkResp.delete(resp);
        resp.isConnected && injectBookmarkButton(resp);
      }, 1500);
    }, 500);
  };
  document.querySelectorAll("model-response").forEach(scheduleResp), bookmarksObserver && bookmarksObserver.disconnect(), bookmarksObserver = new MutationObserver(sgRafCoalesceRecords(e => {
    const targets = new Set;
    for (const t of e)
      for (const n of t.addedNodes) {
        if (n.nodeType !== Node.ELEMENT_NODE) continue;
        const tag = n.tagName;
        if (_SG_STREAM_LEAF_TAGS.has(tag)) continue;
        if ("MODEL-RESPONSE" === tag) {
          targets.add(n);
          continue;
        }
        if ("MESSAGE-ACTIONS" === tag) {
          const mr = n.closest("model-response");
          mr && targets.add(mr);
          continue;
        }
        if (n.firstElementChild && n.querySelectorAll) {
          const mrs = n.querySelectorAll("model-response");
          if (mrs.length) {
            mrs.forEach(mr => targets.add(mr));
          } else {
            const ma = n.querySelector("message-actions");
            if (ma) {
              const mr = n.closest("model-response") || ma.closest("model-response");
              mr && targets.add(mr);
            }
          }
        }
      }
    targets.forEach(scheduleResp);
  })), bookmarksObserver.observe(document.body, {
    childList: !0,
    subtree: !0
  })
}
(() => {
  const _sgBookmarksStorageChanged = (e, t) => {
    if ("local" !== t || !e[SG_BOOKMARKS_STORAGE_KEY]) return;
    const {
      chats: n,
      deleted: o
    } = sgUnwrapBookmarksStored(e[SG_BOOKMARKS_STORAGE_KEY].newValue);
    _sgBookmarks = n, _sgBookmarkTombs = o, sgRebuildBookmarkIndex(), isBookmarksEnabled && (sgApplyAllBookmarkStates(), sgRefreshBookmarksHeaderButton())
  };
  if ("undefined" != typeof SG && SG.storage) {
    SG.storage.onChanged("legacy:bookmarks-local", _sgBookmarksStorageChanged, { area: "local", keys: [SG_BOOKMARKS_STORAGE_KEY] });
  } else if ("undefined" != typeof chrome && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener(_sgBookmarksStorageChanged);
  }
})();
let _sgBookmarkMenuEl = null,
  _sgBookmarkScrollToken = 0;
const _sgTurnOrderCache = new Map,
  _sgTurnOrderInflight = new Map,
  _sgTurnOrderFails = new Map,
  SG_TURN_ORDER_MAX_FAILS = 3;

function sgEnsureTurnOrder(e) {
  if (!e || "default" === e) return Promise.resolve(null);
  if (_sgTurnOrderCache.has(e)) return Promise.resolve(_sgTurnOrderCache.get(e));
  if (_sgTurnOrderInflight.has(e)) return _sgTurnOrderInflight.get(e);
  if ((_sgTurnOrderFails.get(e) || 0) >= 3) return Promise.resolve(null);
  const t = (async () => {
    let t = null;
    try {
      const n = await fetchChatTimestamps(e);
      Array.isArray(n) && n.length && (t = new Map, n.forEach((e, n) => {
        e && e.turnId && t.set(e.turnId, n)
      }), t.size || (t = null))
    } catch (e) {}
    return t ? (_sgTurnOrderCache.set(e, t), _sgTurnOrderFails.delete(e)) : _sgTurnOrderFails.set(e, (_sgTurnOrderFails.get(e) || 0) + 1), t
  })().finally(() => _sgTurnOrderInflight.delete(e));
  return _sgTurnOrderInflight.set(e, t), t
}

function sgPersistBookmarkPositions(e, t) {
  const n = sgGetChatBookmarks(e);
  if (!n.length) return;
  let o = !1;
  for (const e of n) {
    if (!t.has(e.id)) continue;
    const n = t.get(e.id);
    e.pos !== n && (e.pos = n, o = !0)
  }
  o && (_sgBookmarks[e] = n, sgSaveBookmarks())
}

function sgSortBookmarksByChatOrder(e, t) {
  const n = _sgTurnOrderCache.get(t),
    o = e => n && n.has(e.id) ? n.get(e.id) : "number" == typeof e.pos ? e.pos : Number.MAX_SAFE_INTEGER;
  return n || e.some(e => "number" == typeof e.pos) ? e.map((e, t) => ({
    entry: e,
    index: t,
    pos: o(e)
  })).sort((e, t) => e.pos - t.pos || e.index - t.index).map(e => e.entry) : e
}

function createBookmarksHeaderGlyph() {
  const e = "http://www.w3.org/2000/svg",
    t = document.createElementNS(e, "svg");
  t.setAttribute("width", "24"), t.setAttribute("height", "24"), t.setAttribute("viewBox", "0 0 24 24"), t.setAttribute("fill", "none"), t.setAttribute("aria-hidden", "true");
  const n = document.createElementNS(e, "path");
  return n.setAttribute("d", SG_BOOKMARK_PATH), n.setAttribute("stroke", "currentColor"), n.setAttribute("stroke-width", "1.8"), n.setAttribute("stroke-linejoin", "round"), t.appendChild(n), t
}
let _sgBookmarkMenuChatId = null;

function sgRefreshBookmarksHeaderButton() {
  const e = document.getElementById("sg-header-buttons-container");
  if (!e) return;
  const t = document.getElementById("sg-header-bookmarks-btn"),
    n = getCurrentChatId(),
    o = isBookmarksEnabled ? sgGetChatBookmarks(n).length : 0;
  if (null !== _sgBookmarkMenuChatId && _sgBookmarkMenuChatId !== n && sgHideBookmarkMenu(), _sgBookmarkMenuChatId = n, !o) return t && t.remove(), void sgHideBookmarkMenu();
  let r = t;
  r || (r = document.createElement("button"), r.id = "sg-header-bookmarks-btn", r.className = "sg-header-btn", r.setAttribute("type", "button"), r.style.cssText = "\n      display: flex;\n      align-items: center;\n      justify-content: center;\n      width: 40px;\n      height: 40px;\n      border-radius: 50%;\n      background: transparent;\n      border: none;\n      color: var(--gem-sys-color--on-surface, #444746);\n      cursor: pointer;\n      transition: background 0.15s ease;\n    ", r.appendChild(createBookmarksHeaderGlyph()), r.setAttribute("aria-label", "Bookmarked messages"), r.addEventListener("pointerenter", () => {
    sgEnsureTurnOrder(n).then(e => {
      e && sgPersistBookmarkPositions(n, e)
    })
  }), r.addEventListener("click", e => {
    e.preventDefault(), e.stopPropagation(), _sgBookmarkMenuEl ? sgHideBookmarkMenu() : sgShowBookmarkMenu(r)
  }));
  const s = 1 === o ? "1 bookmark" : `${o} bookmarks`;
  r.getAttribute("data-tooltip") !== s && r.setAttribute("data-tooltip", s), e.firstChild !== r && e.insertBefore(r, e.firstChild)
}

function sgHideBookmarkMenu() {
  if (!_sgBookmarkMenuEl) return;
  const e = _sgBookmarkMenuEl;
  _sgBookmarkMenuEl = null, e.classList.remove("sg-bookmark-menu--visible"), setTimeout(() => {
    e.parentNode && e.parentNode.removeChild(e)
  }, 150)
}

function sgShowBookmarkMenu(e) {
  if (_sgBookmarkMenuEl) return;
  const t = getCurrentChatId(),
    n = sgSortBookmarksByChatOrder(sgGetChatBookmarks(t), t);
  if (!n.length) return;
  const o = document.createElement("div");
  o.className = "sg-bookmark-menu", o.setAttribute("role", "menu");
  const r = document.createElement("div");
  r.className = "sg-bookmark-menu-header", r.textContent = 1 === n.length ? "1 bookmarked message" : `${n.length} bookmarked messages`, o.appendChild(r);
  const s = document.createElement("div");
  s.className = "sg-bookmark-menu-list", n.forEach((e, t) => {
    const n = document.createElement("button");
    n.className = "sg-bookmark-menu-item", n.setAttribute("type", "button"), n.setAttribute("role", "menuitem");
    const o = document.createElement("span");
    o.className = "sg-bookmark-menu-num", o.textContent = String(t + 1), n.appendChild(o);
    const r = document.createElement("span");
    r.className = "sg-bookmark-menu-label", r.textContent = e.text || "Bookmarked message", n.appendChild(r), n.addEventListener("click", async t => {
      if (t.preventDefault(), t.stopPropagation(), n.classList.contains("sg-bookmark-menu-item--busy")) return;
      n.classList.add("sg-bookmark-menu-item--busy");
      const o = await sgScrollToBookmark(e.id);
      n.classList.remove("sg-bookmark-menu-item--busy"), o ? sgHideBookmarkMenu() : (n.classList.add("sg-bookmark-menu-item--missing"), r.textContent = "Could not find this message")
    }), s.appendChild(n)
  }), o.appendChild(s), document.body.appendChild(o), _sgBookmarkMenuEl = o;
  const a = e.getBoundingClientRect(),
    i = o.offsetWidth;
  let l = a.left + a.width / 2 - i / 2;
  l = Math.max(8, Math.min(l, window.innerWidth - i - 8)), o.style.top = `${a.bottom+8}px`, o.style.left = `${l}px`, requestAnimationFrame(() => o.classList.add("sg-bookmark-menu--visible"))
}

function sgRevealTurn(e, t) {
  const n = e.getBoundingClientRect(),
    o = t.getBoundingClientRect(),
    r = e.scrollTop + (o.top - n.top) - 24;
  fastSmoothScroll(e, Math.max(0, r))
}
async function sgScrollToBookmark(e) {
  const t = domQuery("chatHistory");
  if (!t) return !1;
  const n = ++_sgBookmarkScrollToken;
  _scrollToTopToken++;
  const o = () => document.getElementById(e),
    r = () => n !== _sgBookmarkScrollToken,
    s = e => new Promise(t => setTimeout(t, e));
  let a = o();
  if (a) return sgRevealTurn(t, a), !0;
  const i = async e => {
    let n = -1,
      i = 0,
      l = 0;
    for (; l < 140;) {
      if (r()) return !1;
      const c = Math.max(200, .9 * t.clientHeight),
        d = "up" === e ? Math.max(0, t.scrollTop - c) : Math.min(t.scrollHeight, t.scrollTop + c);
      if (fastSmoothScroll(t, d), await s(220), r()) return !1;
      if (l++, a = o(), a) return sgRevealTurn(t, a), !0;
      const u = t.scrollHeight;
      if (("up" === e ? t.scrollTop <= 1 : t.scrollTop + t.clientHeight >= u - 1) && u === n ? i++ : i = 0, n = u, i >= 5) return !1
    }
    return !1
  };
  return !!await i("up") || !r() && await i("down")
}
SG_IS_SILENT_BG_WORKER_TAB || (document.addEventListener("keydown", e => {
  "Escape" === e.key && _sgBookmarkMenuEl && sgHideBookmarkMenu()
}), document.addEventListener("click", e => {
  _sgBookmarkMenuEl && (e.target.closest(".sg-bookmark-menu") || e.target.closest("#sg-header-bookmarks-btn") || sgHideBookmarkMenu())
}, !0));
let cachedChatId = null,
  cachedChatIdUrl = null;
const sgMsgTsCache = new Map,
  sgMsgTsInflight = new Map,
  sgMsgTsFailCounts = new Map,
  SG_MSG_TS_MAX_FETCH_FAILS = 3;
let sgMsgTsLastChatId = null,
  sgMsgTsObserverRegistered = !1,
  sgMsgTsRefetchTimer = null;

function getCurrentChatId() {
  const e = window.location.href;
  return cachedChatIdUrl === e && null !== cachedChatId || (cachedChatIdUrl = e, cachedChatId = e.match(/\/app\/([a-zA-Z0-9]+)/)?.[1] || "default"), cachedChatId
}

function findLoadedChatAnchor(e) {
  if (!e) return null;
  const t = document.querySelectorAll('a[href*="/app/"]');
  for (const n of t) {
    const t = n.getAttribute("href") || n.href || "";
    if ((t.split("/app/").pop()?.split(/[?#]/)[0] || "") === e) return n
  }
  return null
}

function sgOpenChatReliably(e, t) {
  let n = (t || "").toString();
  if (n.startsWith("c_") && (n = n.slice(2)), !n && e && (n = e.split("/app/").pop()?.split(/[?#]/)[0] || ""), n && getCurrentChatId() === n) return;
  const o = () => {
      window.location.href = e
    },
    r = n ? findLoadedChatAnchor(n) : null;
  if (r) {
    r.click();
    let e = 0;
    const t = setInterval(() => {
      e += 150, getCurrentChatId() !== n ? e >= 1200 && (clearInterval(t), o()) : clearInterval(t)
    }, 150);
    return
  }
  o()
}

function getMsgTsStorageKey(e) {
  return `sg_msgts_v2_${e}`
}

function formatTimestamp(e) {
  if (!e) return "--:--";
  const t = e.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
  return `${e.toLocaleDateString([],{month:"short",day:"numeric"})} ${t}`
}

function createTimestampElement(e) {
  const t = document.createElement("div");
  t.className = "sg-message-timestamp", t.style.cssText = "\n    font-size: 11px;\n    color: var(--sg-on-surface-variant, #70757a);\n    font-family: var(--sg-font-text);\n    padding: 2px 8px;\n    opacity: 0.7;\n    user-select: none;\n    display: flex;\n    align-items: center;\n    gap: 4px;\n    white-space: nowrap;\n    flex-shrink: 0;\n  ";
  const n = new Date(e);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "currentColor");
  svg.style.cssText = "width: 12px; height: 12px; opacity: 0.7;";
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z");
  svg.appendChild(path);
  const span = document.createElement("span");
  span.textContent = formatTimestamp(n);
  t.replaceChildren ? t.replaceChildren(svg, span) : (t.appendChild(svg), t.appendChild(span));
  t.dataset.sgTimestamp = String(e);
  return t;
}

function loadMsgTsFromStorage(e) {
  try {
    const t = localStorage.getItem(getMsgTsStorageKey(e));
    if (!t) return null;
    const n = JSON.parse(t);
    return n && Array.isArray(n.turns) ? n : null
  } catch (e) {
    return null
  }
}

function saveMsgTsToStorage(e, t) {
  try {
    localStorage.setItem(getMsgTsStorageKey(e), JSON.stringify(t))
  } catch (e) {}
}

function cleanupLegacyMsgTsKey(e) {
  try {
    const t = `sg_timestamps_${e}`;
    null !== localStorage.getItem(t) && localStorage.removeItem(t)
  } catch (e) {}
}
async function fetchChatTimestamps(e) {
  if (!e || "default" === e) return null;
  if (sgMsgTsInflight.has(e)) return sgMsgTsInflight.get(e);
  const t = (async () => {
    const t = getATToken();
    if (!t) return null;
    const n = getBuildLabel(),
      o = e.startsWith("c_") ? e : `c_${e}`,
      r = JSON.stringify([
        [
          ["hNvQHb", JSON.stringify([o]), null, "generic"]
        ]
      ]),
      s = new URLSearchParams;
    s.append("f.req", r), s.append("at", t);
    const a = getAccountRpcPrefix(),
      i = `${a}/_/BardChatUi/data/batchexecute?rpcids=hNvQHb&source-path=${encodeURIComponent(a+"/app")}&bl=${encodeURIComponent(n)}&hl=en&_reqid=${Math.floor(1e7*Math.random())}&rt=c`;
    let l;
    try {
      const e = await fetch(i, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
        },
        body: s.toString(),
        credentials: "include"
      });
      if (!e.ok) return null;
      l = await e.text()
    } catch (e) {
      return null
    }
    const c = l.replace(/^\)\]\}'/, "").trim().split("\n");
    let d = null;
    for (const e of c) try {
      const t = JSON.parse(e.trim());
      if (!Array.isArray(t)) continue;
      for (const e of t)
        if (Array.isArray(e) && "wrb.fr" === e[0] && "hNvQHb" === e[1] && "string" == typeof e[2]) {
          d = JSON.parse(e[2]);
          break
        } if (d) break
    } catch (e) {}
    if (!d || !Array.isArray(d[0])) return null;
    const u = [];
    for (const e of d[0]) try {
      const t = e && e[4];
      if (!Array.isArray(t) || "number" != typeof t[0]) continue;
      const n = 1e3 * t[0] + Math.round((t[1] || 0) / 1e6);
      let o = null;
      try {
        o = e[3][0][0][0] || null
      } catch (e) {}
      let r = null;
      try {
        r = (e[0][1] || "").replace(/^r_/, "") || null
      } catch (e) {}
      u.push({
        responseId: o,
        turnId: r,
        tsMs: n
      })
    } catch (e) {}
    return u.reverse(), u
  })().finally(() => {
    sgMsgTsInflight.delete(e)
  });
  return sgMsgTsInflight.set(e, t), t
}
let sgMsgTsLastRunAt = 0,
  sgMsgTsTrailingRun = null;
async function refreshTimestamps() {
  const e = performance.now();
  if (!(e - sgMsgTsLastRunAt < 250)) return sgMsgTsLastRunAt = e, _refreshTimestampsImpl();
  sgMsgTsTrailingRun || (sgMsgTsTrailingRun = setTimeout(() => {
    sgMsgTsTrailingRun = null, _refreshTimestampsImpl()
  }, 260))
}
async function _refreshTimestampsImpl() {
  if (document.body.classList.contains("sg-timestamps-hidden")) return void document.querySelectorAll(".sg-message-timestamp").forEach(e => e.remove());
  const e = getCurrentChatId();
  if (sgMsgTsLastChatId && sgMsgTsLastChatId !== e && document.querySelectorAll(".sg-message-timestamp").forEach(e => e.remove()), sgMsgTsLastChatId = e, !e || "default" === e) return;
  if (!sgMsgTsCache.has(e)) {
    cleanupLegacyMsgTsKey(e);
    const t = loadMsgTsFromStorage(e);
    t && sgMsgTsCache.set(e, t)
  }
  const t = document.querySelectorAll("model-response"),
    n = sgMsgTsCache.get(e);
  n && Array.isArray(n.turns) && applyTimestampsToBubbles(t, n.turns);
  const o = n ? n.turns.length : 0,
    r = (sgMsgTsFailCounts.get(e) || 0) >= 3,
    s = !n && !r,
    a = n && t.length > o && !r,
    i = t => {
      sgMsgTsRefetchTimer = setTimeout(async () => {
        sgMsgTsRefetchTimer = null;
        if (getCurrentChatId() !== e) return;
        const t = await fetchChatTimestamps(e);
        if (!t || !t.length) return void sgMsgTsFailCounts.set(e, (sgMsgTsFailCounts.get(e) || 0) + 1);
        sgMsgTsFailCounts.delete(e);
        const n = {
          turnCount: t.length,
          turns: t
        };
        sgMsgTsCache.set(e, n), saveMsgTsToStorage(e, n), getCurrentChatId() === e && applyTimestampsToBubbles(document.querySelectorAll("model-response"), t)
      }, t)
    };
  s ? sgMsgTsRefetchTimer || sgMsgTsInflight.has(e) || i(50) : a && (sgMsgTsRefetchTimer && clearTimeout(sgMsgTsRefetchTimer), i(1500))
}

function applyTimestampsToBubbles(e, t) {
  e && t && e.forEach((e, n) => {
    const o = t[n];
    if (!o) return;
    const r = String(o.tsMs),
      s = e.querySelector(".sg-message-timestamp");
    if (s) {
      if (s.dataset.sgTimestamp === r) return;
      s.remove()
    }
    const a = e.querySelector("message-actions .buttons-container-v2") || e.querySelector("message-actions"),
      i = createTimestampElement(o.tsMs);
    if (a) {
      const e = a.querySelector(":scope > .spacer");
      e ? a.insertBefore(i, e) : a.appendChild(i)
    }
  })
}

function startMsgTsObserver() {
  sgMsgTsObserverRegistered || (sgObserverRegistry.registerUIRefresh("sg-msg-ts", refreshTimestamps), sgMsgTsObserverRegistered = !0)
}

function stopMsgTsObserver() {
  sgMsgTsObserverRegistered && (sgObserverRegistry.unregisterUIRefresh("sg-msg-ts"), sgMsgTsObserverRegistered = !1)
}

function sgMsgTsApplyEnabled(e) {
  e ? (sgMsgTsFailCounts.clear(), document.body.classList.remove("sg-timestamps-hidden"), startMsgTsObserver(), refreshTimestamps()) : (document.body.classList.add("sg-timestamps-hidden"), document.querySelectorAll(".sg-message-timestamp").forEach(e => e.remove()), stopMsgTsObserver())
}
SG_IS_SILENT_BG_WORKER_TAB || setTimeout(() => {
  sgSyncGetCached(["extensionEnabled", "timestampsEnabled"], e => {
    if (!1 === e.extensionEnabled) return;
    const t = !0 === e.timestampsEnabled;
    t || document.body.classList.add("sg-timestamps-hidden"), t && (startMsgTsObserver(), refreshTimestamps())
  })
}, 2500);
