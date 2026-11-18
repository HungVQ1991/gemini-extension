/**
 * Superpower for Gemini - Popup Controller
 * Responsibilities:
 * - Manage UI toggles (folders, prompts, queue, declutter, export, etc.)
 * - Keyboard shortcuts configuration modal
 * - Model & thinking level preferences
 * - License upgrade modal & Pro features state
 */
const IS_MAC = /mac|iphone|ipad|ipod/i.test(navigator.userAgentData && navigator.userAgentData.platform || navigator.platform || ""),
  ALT_LABEL = IS_MAC ? "Option" : "Alt";

function toDisplayCombo(e) {
  return IS_MAC ? String(e).replace(/\bAlt\b/g, "Option") : e
}
const SG_HEADER_MAX_BUTTONS_PRO = 8;

function sgExpandHeaderForPro() {
  const e = document.querySelector(".header-actions"),
    t = e && e.querySelector(".header-more"),
    n = document.getElementById("sg-header-more-menu");
  if (!e || !t || !n) return;
  const o = Array.from(n.querySelectorAll(".header-more-item"));
  if (!o.length) return void(t.hidden = !0);
  Array.from(e.children).filter(e => e !== t).length + o.length > 8 || (o.forEach(n => {
    const o = n.querySelector("span");
    o && n.setAttribute("data-tooltip-fast", o.textContent.trim()), n.classList.remove("header-more-item"), n.classList.add("bug-report-btn", "sg-header-promoted"), e.insertBefore(n, t)
  }), t.hidden = !0)
}

function shortcutBaseKeyFromCode(e) {
  if (/^Key[A-Z]$/.test(e || "")) return e.slice(3).toLowerCase();
  if (/^Digit[0-9]$/.test(e || "")) return e.slice(5);
  return {
    Minus: "-",
    Equal: "=",
    BracketLeft: "[",
    BracketRight: "]",
    Backslash: "\\",
    Semicolon: ";",
    Quote: "'",
    Comma: ",",
    Period: ".",
    Slash: "/",
    Backquote: "`"
  } [e] || null
}
const TOGGLE_CONFIG = [{
  id: "prompts-toggle",
  storageKey: "promptsEnabled",
  defaultOn: !0,
  enableMsg: "ENABLE_PROMPTS",
  disableMsg: "DISABLE_PROMPTS"
}, {
  id: "export-btn-toggle",
  storageKey: "showExportButton",
  defaultOn: !0,
  enableMsg: "ENABLE_EXPORT_BTN",
  disableMsg: "DISABLE_EXPORT_BTN"
}, {
  id: "info-btn-toggle",
  storageKey: "showInfoButton",
  defaultOn: !0,
  enableMsg: "ENABLE_INFO_BTN",
  disableMsg: "DISABLE_INFO_BTN"
}, {
  id: "wide-chat-btn-toggle",
  storageKey: "showWideChatButton",
  defaultOn: !0,
  enableMsg: "SHOW_WIDE_BTN",
  disableMsg: "HIDE_WIDE_BTN"
}, {
  id: "optimize-toggle",
  storageKey: "optimizeEnabled",
  defaultOn: !0,
  enableMsg: "ENABLE_OPTIMIZE",
  disableMsg: "DISABLE_OPTIMIZE"
}, {
  id: "optimize-thinking-toggle",
  storageKey: "optimizeUseThinking",
  defaultOn: !1,
  enableMsg: null,
  disableMsg: null
}, {
  id: "counter-toggle",
  storageKey: "counterEnabled",
  defaultOn: !0,
  enableMsg: "ENABLE_COUNTER",
  disableMsg: "DISABLE_COUNTER"
}, {
  id: "daily-counter-toggle",
  storageKey: "dailyCounterVisible",
  defaultOn: !0,
  enableMsg: "SHOW_DAILY_COUNTER",
  disableMsg: "HIDE_DAILY_COUNTER"
}, {
  id: "usage-counter-show-pct-toggle",
  storageKey: "usageCounterShowPct",
  defaultOn: !0,
  enableMsg: null,
  disableMsg: null
}, {
  id: "usage-counter-show-time-toggle",
  storageKey: "usageCounterShowTime",
  defaultOn: !1,
  enableMsg: null,
  disableMsg: null
}, {
  id: "scroll-toggle",
  storageKey: "scrollButtonsEnabled",
  defaultOn: !0,
  enableMsg: "ENABLE_SCROLL_BUTTONS",
  disableMsg: "DISABLE_SCROLL_BUTTONS"
}, {
  id: "hide-upgrade-btns-toggle",
  storageKey: "hideUpgradeButtons",
  defaultOn: !1,
  enableMsg: "HIDE_UPGRADE_BUTTONS",
  disableMsg: "SHOW_UPGRADE_BUTTONS"
}, {
  id: "timestamps-toggle",
  storageKey: "timestampsEnabled",
  defaultOn: !1,
  enableMsg: "ENABLE_TIMESTAMPS",
  disableMsg: "DISABLE_TIMESTAMPS"
}, {
  id: "pinned-collapse-toggle",
  storageKey: "collapsiblePinnedEnabled",
  defaultOn: !0,
  enableMsg: "ENABLE_COLLAPSIBLE_PINNED",
  disableMsg: "DISABLE_COLLAPSIBLE_PINNED"
}, {
  id: "drag-chat-input-toggle",
  storageKey: "dragChatToInputEnabled",
  defaultOn: !0,
  enableMsg: "ENABLE_DRAG_CHAT_INPUT",
  disableMsg: "DISABLE_DRAG_CHAT_INPUT"
}, {
  id: "location-info-toggle",
  storageKey: "hideLocationInfo",
  defaultOn: !1,
  enableMsg: "HIDE_LOCATION_INFO",
  disableMsg: "SHOW_LOCATION_INFO"
}, {
  id: "activity-toggle",
  storageKey: "hideActivity",
  defaultOn: !1,
  enableMsg: "HIDE_ACTIVITY",
  disableMsg: "SHOW_ACTIVITY"
}, {
  id: "download-audio-toggle",
  storageKey: "downloadAudioEnabled",
  defaultOn: !0,
  enableMsg: "ENABLE_DOWNLOAD_AUDIO",
  disableMsg: "DISABLE_DOWNLOAD_AUDIO"
}, {
  id: "bookmarks-toggle",
  storageKey: "bookmarksEnabled",
  defaultOn: !0,
  enableMsg: "ENABLE_BOOKMARKS",
  disableMsg: "DISABLE_BOOKMARKS"
}, {
  id: "telemetry-toggle",
  storageKey: "telemetryEnabled",
  defaultOn: !0,
  enableMsg: null,
  disableMsg: null
}, {
  id: "trashcan-toggle",
  storageKey: "trashcanEnabled",
  defaultOn: !0,
  enableMsg: "ENABLE_TRASHCAN",
  disableMsg: "DISABLE_TRASHCAN"
}, {
  id: "show-queue-toggle",
  storageKey: "showQueueWindow",
  defaultOn: !0,
  enableMsg: "SHOW_QUEUE_WINDOW",
  disableMsg: "HIDE_QUEUE_WINDOW"
}];

function initToggles() {
  const e = chrome.runtime.getManifest();
  document.getElementById("extension-version").textContent = "v" + e.version;
  const t = document.getElementById("extension-toggle"),
    n = document.getElementById("warning-modal"),
    o = document.getElementById("warning-title"),
    s = document.getElementById("warning-main-text"),
    r = document.getElementById("warning-sub-text"),
    a = document.getElementById("warning-confirm-btn"),
    c = document.getElementById("warning-cancel-btn"),
    d = document.getElementById("warning-close-btn");
  let i = null;

  function l(e, t, a, c) {
    o && (o.textContent = e), s && (s.textContent = t), r && (r.textContent = a), i = c, n && (n.style.display = "flex")
  }

  function u(e) {
    chrome.storage.sync.set({
      extensionEnabled: e
    }), updateSettingsState(e), chrome.tabs.query({
      active: !0,
      currentWindow: !0
    }, e => {
      e[0] && e[0].url && e[0].url.includes("gemini.google.com") && chrome.tabs.reload(e[0].id)
    }), chrome.runtime.sendMessage({
      type: "MARK_TABS_FOR_REFRESH"
    })
  }
  chrome.storage.sync.get(["extensionEnabled"], e => {
    t.checked = !1 !== e.extensionEnabled, updateSettingsState(t.checked)
  }), t.addEventListener("change", e => {
    t.checked ? u(!0) : (t.checked = !0, l("Warning ⚠️", "Are you sure you want to disable Superpower for Gemini?", "When disabled, the settings menu will disappear from the sidebar. You can still access settings by clicking the extension icon or the 'Settings & Help' button at the bottom left > 'Superpower for Gemini Settings'.", () => {
      t.checked = !1, u(!1)
    }))
  }), a && a.addEventListener("click", () => {
    i && i(), n.style.display = "none"
  }), c && c.addEventListener("click", () => {
    n.style.display = "none"
  }), d && d.addEventListener("click", () => {
    n.style.display = "none"
  }), n && n.addEventListener("click", e => {
    e.target === n && (n.style.display = "none")
  });
  const g = document.getElementById("sidebar-dropdown-toggle"),
    m = document.getElementById("folders-toggle"),
    h = document.getElementById("settings-menu-toggle");
  chrome.storage.sync.get(["sidebarDropdownEnabled"], e => {
    const t = !1 !== e.sidebarDropdownEnabled;
    g.checked = t, updateMenuDependentSettings(t)
  }), g.addEventListener("change", () => {
    g.checked ? (chrome.storage.sync.set({
      sidebarDropdownEnabled: !0
    }), sendMessageToContentScript("ENABLE_SIDEBAR_DROPDOWN"), updateMenuDependentSettings(!0)) : (g.checked = !0, l("Warning ⚠️", "Are you sure you want to hide the Superpower menu from the sidebar?", `This will also hide Settings, Folders, and Prompts from the sidebar. You can still access settings by clicking the extension icon or pressing ${ALT_LABEL}+S (or your custom shortcut).`, () => {
      g.checked = !1, chrome.storage.sync.set({
        sidebarDropdownEnabled: !1
      }), sendMessageToContentScript("DISABLE_SIDEBAR_DROPDOWN"), updateMenuDependentSettings(!1)
    }))
  }), chrome.storage.sync.get(["foldersEnabled"], e => {
    m.checked = !1 !== e.foldersEnabled, updateTrashcanDependencyState(m.checked)
  }), m.addEventListener("change", () => {
    const e = m.checked;
    chrome.storage.sync.set({
      foldersEnabled: e
    }), sendMessageToContentScript(e ? "ENABLE_FOLDERS" : "DISABLE_FOLDERS"), updateTrashcanDependencyState(e), e ? chrome.storage.sync.get(["wasTrashcanEnabledBeforeFoldersDisable"], e => {
      e.wasTrashcanEnabledBeforeFoldersDisable && (chrome.storage.sync.set({
        trashcanEnabled: !0
      }), sendMessageToContentScript("ENABLE_TRASHCAN"))
    }) : chrome.storage.sync.get(["trashcanEnabled"], e => {
      !1 !== e.trashcanEnabled ? (chrome.storage.sync.set({
        trashcanEnabled: !1,
        wasTrashcanEnabledBeforeFoldersDisable: !0
      }), sendMessageToContentScript("DISABLE_TRASHCAN")) : chrome.storage.sync.set({
        wasTrashcanEnabledBeforeFoldersDisable: !1
      })
    })
  }), TOGGLE_CONFIG.forEach(e => setupToggle(e)), chrome.storage.sync.get(["settingsInMenuEnabled"], e => {
    h.checked = !1 !== e.settingsInMenuEnabled
  }), h.addEventListener("change", () => {
    h.checked ? (chrome.storage.sync.set({
      settingsInMenuEnabled: !0
    }), sendMessageToContentScript("ENABLE_SETTINGS_MENU")) : (h.checked = !0, l("Warning ⚠️", "Are you sure you want to hide Settings from the menu?", `You can still access settings by clicking the extension icon, pressing ${ALT_LABEL}+S (or your custom shortcut), or via the 'Settings & Help' button at the bottom left.`, () => {
      h.checked = !1, chrome.storage.sync.set({
        settingsInMenuEnabled: !1
      }), sendMessageToContentScript("DISABLE_SETTINGS_MENU")
    }))
  });
  const p = document.getElementById("hide-gems-gallery-toggle"),
    E = document.getElementById("hide-gems-button-toggle");
  chrome.storage.sync.get({
    hidePremadeGemsGallery: !1,
    hideGemsSidebarButton: !1
  }, e => {
    p.checked = e.hidePremadeGemsGallery, E.checked = e.hideGemsSidebarButton, updateGemsDependencyState(E.checked)
  }), p.addEventListener("change", () => {
    chrome.storage.sync.set({
      hidePremadeGemsGallery: p.checked
    }), sendMessageToContentScript(p.checked ? "HIDE_GEMS_GALLERY" : "SHOW_GEMS_GALLERY")
  }), E.addEventListener("change", () => {
    const e = E.checked;
    chrome.storage.sync.set({
      hideGemsSidebarButton: e
    }), sendMessageToContentScript(e ? "HIDE_GEMS_BUTTON" : "SHOW_GEMS_BUTTON"), updateGemsDependencyState(e)
  });
  const y = document.getElementById("drag-chat-pro-crown");
  y && (y.addEventListener("click", e => {
    e.preventDefault(), e.stopPropagation(), sendMessageToContentScript("SHOW_UPGRADE_TOAST"), , window.close()
  }), chrome.storage.sync.get(["sgProActive", "sgLicenseKey"], e => {
    e.sgProActive && e.sgLicenseKey && (y.style.display = "none")
  })), setupToggle({
    id: "queue-toggle",
    storageKey: "queueingEnabled",
    defaultOn: !0,
    enableMsg: "ENABLE_QUEUING",
    disableMsg: "DISABLE_QUEUING",
    onChange: updateQueueParamsState
  }), initGearDropdown("queue-gear-btn", "queue-gear-dropdown"), initGearDropdown("daily-counter-gear-btn", "daily-counter-gear-dropdown"), initGearDropdown("optimize-gear-btn", "optimize-gear-dropdown"), initGearDropdown("hide-gems-gear-btn", "hide-gems-gear-dropdown");
  const S = document.getElementById("optimize-prompt-pro-crown");
  S && S.addEventListener("click", e => {
    e.preventDefault(), e.stopPropagation(), sendMessageToContentScript("SHOW_UPGRADE_TOAST"), , window.close()
  }), chrome.storage.sync.get(["sgProActive", "sgLicenseKey"], e => {
    e.sgProActive && e.sgLicenseKey && S && (S.style.display = "none")
  });
  const T = document.getElementById("optimize-prompt-configure-btn");
  T && T.addEventListener("click", () => {
    chrome.tabs.query({
      active: !0,
      currentWindow: !0
    }, e => {
      const t = e && e[0];
      t && t.url && t.url.includes("gemini.google.com") ? chrome.tabs.sendMessage(t.id, {
        type: "OPEN_OPTIMIZE_PROMPT_EDITOR"
      }).catch(() => {}) : chrome.runtime.sendMessage({
        type: "OPEN_GEMINI_WITH_EDITOR"
      }), window.close()
    })
  });
  const b = document.getElementById("bug-report-btn");
  b && b.addEventListener("click", e => {
    e.preventDefault(), e.stopPropagation();
    const t = chrome.runtime.getManifest().version,
      n = navigator.userAgent,
      o = `https://docs.google.com/forms/d/e/1FAIpQLSfZGSR-vQXsOJyvLxNWO_ASXXQ6EY_U0h4XWj1pf-VCikncSQ/viewform?usp=pp_url&entry.851543601=${t}&entry.1475261422=${encodeURIComponent(n)}`;
    chrome.tabs.create({
      url: o
    })
  });
  const f = document.getElementById("propose-btn");
  f && f.addEventListener("click", e => {
    e.preventDefault(), e.stopPropagation();
    const t = `https://docs.google.com/forms/d/e/1FAIpQLSc4_7p_-h7YygPcb41wAer7hN_44vt2VGOdRq3Z-KxqFhA51Q/viewform?usp=pp_url&entry.440162603=${chrome.runtime.getManifest().version}`;
    chrome.tabs.create({
      url: t
    })
  });
  const _ = document.getElementById("sg-header-more-btn"),
    L = document.getElementById("sg-header-more-menu");
  if (_ && L) {
    const e = () => L.classList.remove("open");
    _.addEventListener("click", e => {
      e.preventDefault(), e.stopPropagation(), L.classList.toggle("open")
    }), L.addEventListener("click", e, !0), document.addEventListener("click", t => {
      L.classList.contains("open") && (L.contains(t.target) || e())
    }), document.addEventListener("keydown", t => {
      "Escape" === t.key && e()
    })
  }
  const C = document.getElementById("sg-more-extensions-btn"),
    I = document.getElementById("sg-extensions-modal");
  if (C && I) {
    const e = () => {
      I.style.display = "none", document.documentElement.classList.remove("no-scroll")
    };
    C.addEventListener("click", e => {
      e.preventDefault(), e.stopPropagation(), I.style.display = "flex", document.documentElement.classList.add("no-scroll")
    });
    const t = document.getElementById("sg-extensions-close-btn");
    t && t.addEventListener("click", e), I.addEventListener("click", t => {
      t.target === I && e()
    }), document.addEventListener("keydown", t => {
      "Escape" === t.key && "flex" === I.style.display && e()
    }), I.querySelectorAll(".sg-ext-row").forEach(t => {
      t.addEventListener("click", n => {
        n.preventDefault(), n.stopPropagation(), chrome.tabs.create({
          url: t.href
        }), e()
      })
    })
  }
  const O = document.getElementById("sg-newsletter-btn"),
    A = document.getElementById("sg-newsletter-modal");
  if (O && A) {
    const e = "https://superpowerforai.com/api/subscribe",
      t = "You are on the list. Thanks for signing up.",
      n = "About once a month, unsubscribe anytime.",
      o = "You are already signed up. Adding another address is fine.",
      s = document.getElementById("sg-newsletter-form"),
      r = document.getElementById("sg-newsletter-email"),
      a = document.getElementById("sg-newsletter-submit"),
      c = document.getElementById("sg-newsletter-note");
    let d = !1;
    const i = (e, t) => {
        c.textContent = e, c.classList.remove("is-error", "is-success"), t && c.classList.add(t)
      },
      l = () => {
        A.style.display = "none", document.documentElement.classList.remove("no-scroll")
      };
    O.addEventListener("click", e => {
      e.preventDefault(), e.stopPropagation(), A.style.display = "flex", document.documentElement.classList.add("no-scroll"), a.disabled = !1, a.textContent = "Sign up", i(d ? o : n), r.focus()
    });
    const u = document.getElementById("sg-newsletter-close-btn");
    u && u.addEventListener("click", l), A.addEventListener("click", e => {
      e.target === A && l()
    }), document.addEventListener("keydown", e => {
      "Escape" === e.key && "flex" === A.style.display && l()
    });
    const g = document.getElementById("sg-newsletter-privacy");
    g && g.addEventListener("click", e => {
      e.preventDefault(), chrome.tabs.create({
        url: g.href
      })
    }), chrome.storage.sync.get(["sgNewsletterSubscribed"], e => {
      d = !0 === e.sgNewsletterSubscribed
    }), s.addEventListener("submit", async o => {
      o.preventDefault();
      const s = r.value.trim();
      if (!a.disabled)
        if (!s || s.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) i("Please enter a valid email address.", "is-error");
        else {
          a.disabled = !0, a.textContent = "Signing up...", i(n);
          try {
            const n = await fetch(e, {
                method: "POST",
                headers: {
                  "Content-Type": "text/plain;charset=UTF-8"
                },
                body: JSON.stringify({
                  email: s,
                  product: "gemini",
                  website: ""
                })
              }),
              o = await n.json().catch(() => null);
            if (n.ok && o && o.ok) return a.textContent = "Signed up", r.value = "", i(t, "is-success"), d = !0, chrome.storage.sync.set({
              sgNewsletterSubscribed: !0
            }), void 
            i(o && o.error || "Something went wrong. Please try again.", "is-error")
          } catch (e) {
            i("Could not connect. Please try again.", "is-error")
          }
          a.disabled = !1, a.textContent = "Sign up"
        }
    })
  }
  const v = document.getElementById("sg-upgrade-btn");
  v && (v.addEventListener("click", e => {
    e.preventDefault(), e.stopPropagation(), , chrome.tabs.query({
      active: !0,
      currentWindow: !0
    }, e => {
      const t = e && e[0];
      t && t.url && t.url.includes("gemini.google.com") ? chrome.tabs.sendMessage(t.id, {
        type: "SHOW_UPGRADE_TOAST"
      }).catch(() => {}) : chrome.runtime.sendMessage({
        type: "OPEN_GEMINI_WITH_UPGRADE"
      }), window.close()
    })
  }), chrome.storage.sync.get(["sgProActive", "sgLicenseKey"], e => {
    e.sgProActive && e.sgLicenseKey && (v.classList.add("compact"), v.setAttribute("data-tooltip-fast", "Pro Active ✅"), sgExpandHeaderForPro())
  }));
  let k = !1;
  const D = document.getElementById("drive-sync-toggle");
  D && (D.disabled = !0), chrome.storage.sync.get(["driveSyncEnabled"], e => {
    k = true;
    const t = document.getElementById("drive-sync-pro-crown");
    t && k && (t.style.display = "none"), D && (D.disabled = !1)
  });
  const M = document.getElementById("drive-sync-pro-crown");
  if (M && M.addEventListener("click", e => {
      e.preventDefault(), e.stopPropagation(), sendMessageToContentScript("SHOW_UPGRADE_TOAST"), , window.close()
    }), D) {
    D.addEventListener("change", e => {
      k || D.checked && (e.stopImmediatePropagation(), D.checked = !1, , chrome.tabs.query({
        active: !0,
        currentWindow: !0
      }, e => {
        const t = e && e[0];
        t && t.url && t.url.includes("gemini.google.com") ? chrome.tabs.sendMessage(t.id, {
          type: "SHOW_UPGRADE_TOAST"
        }).catch(() => {}) : chrome.runtime.sendMessage({
          type: "OPEN_GEMINI_WITH_UPGRADE"
        }), window.close()
      }))
    }, !0);
    (() => {
      chrome.storage.sync.get(["driveSyncEnabled"], e => {
        !!e.driveSyncEnabled ? chrome.permissions.contains({
          permissions: ["identity"]
        }, e => {
          e ? D.checked = !0 : (D.checked = !1, chrome.runtime.sendMessage({
            type: "DRIVE_SYNC_DISCONNECT"
          }))
        }) : D.checked = !1
      })
    })(), chrome.storage.onChanged.addListener((e, t) => {
      "sync" === t && e.driveSyncEnabled && (D.checked = !!e.driveSyncEnabled.newValue)
    });
    const e = () => {
        chrome.runtime.sendMessage({
          type: "DRIVE_SYNC_CONNECT"
        }, e => {
          D.disabled = !1, e && e.authorized || (D.checked = !1, chrome.permissions.remove({
            permissions: ["identity"]
          }))
        })
      },
      t = () => {
        D.disabled = !0, e()
      },
      n = () => {
        D.disabled = !0, chrome.permissions.request({
          permissions: ["identity"]
        }, t => {
          if (!t) return D.checked = !1, void(D.disabled = !1);
          e()
        })
      };
    D.addEventListener("change", () => {
      D.checked ? chrome.permissions.contains({
        permissions: ["identity"]
      }, e => {
        if (e) t();
        else {
          D.checked = !1;
          const e = document.getElementById("warning-confirm-btn"),
            t = e ? e.textContent : "Disable";
          e && (e.textContent = "Connect");
          const o = () => {
            e && (e.textContent = t)
          };
          document.getElementById("warning-cancel-btn")?.addEventListener("click", o, {
            once: !0
          }), document.getElementById("warning-close-btn")?.addEventListener("click", o, {
            once: !0
          }), l("Connect Google Drive", "Google Drive Sync backs up your folders, prompts, chains, and bookmarks so they're available on all your devices.", "Clicking \"Connect\" will open Google's authorization page where you'll grant optional access to Google Drive app data. The extension can only store its own data — nothing personal is accessed.", () => {
            o(), D.checked = !0, n()
          })
        }
      }) : (D.disabled = !0, chrome.runtime.sendMessage({
        type: "DRIVE_SYNC_DISCONNECT"
      }, () => {
        D.disabled = !1, D.checked = !1
      }))
    })
  }
  document.addEventListener("click", e => {
    const t = e.target.closest(".sg-help-link");
    if (t) {
      e.preventDefault();
      let n = t.getAttribute("href"),
        o = n.startsWith("http") ? n : chrome.runtime.getURL(n);
      chrome.tabs.create({
        url: o
      })
    }
  })
}

function updateSettingsState(e) {
  document.querySelectorAll(".settings-section").forEach(t => {
    e ? (t.classList.remove("disabled"), t.querySelectorAll("input").forEach(e => e.disabled = !1)) : (t.classList.add("disabled"), t.querySelectorAll("input").forEach(e => e.disabled = !0))
  })
}

function updateMenuDependentSettings(e) {
  const t = document.getElementById("folders-toggle"),
    n = document.getElementById("prompts-toggle"),
    o = document.getElementById("settings-menu-toggle");
  if (!t || !n || !o) return;
  const s = t.closest(".toggle-row"),
    r = n.closest(".toggle-row"),
    a = o.closest(".toggle-row");
  e ? (s.classList.remove("disabled"), t.disabled = !1, r.classList.remove("disabled"), n.disabled = !1, a.classList.remove("disabled"), o.disabled = !1) : (s.classList.add("disabled"), t.disabled = !0, r.classList.add("disabled"), n.disabled = !0, a.classList.add("disabled"), o.disabled = !0)
}

function updateGemsDependencyState(e) {
  const t = document.getElementById("hide-gems-gallery-toggle");
  if (!t) return;
  const n = t.closest(".toggle-row");
  e ? (n.classList.add("disabled"), t.disabled = !0) : (n.classList.remove("disabled"), t.disabled = !1)
}

function updateTrashcanDependencyState(e) {
  const t = document.getElementById("trashcan-toggle");
  if (!t) return;
  const n = t.closest(".toggle-row");
  e ? (n.classList.remove("disabled"), t.disabled = !1) : (n.classList.add("disabled"), t.disabled = !0)
}

function updateQueueParamsState(e) {
  const t = document.getElementById("show-queue-toggle");
  if (!t) return;
  const n = t.closest(".toggle-row");
  e ? (n.classList.remove("disabled"), t.disabled = !1) : (n.classList.add("disabled"), t.disabled = !0)
}

function initGearDropdown(e, t) {
  const n = document.getElementById(e),
    o = document.getElementById(t);
  n && o && (n.addEventListener("click", e => {
    e.preventDefault(), e.stopPropagation();
    const t = o.classList.contains("show");
    o.classList.toggle("show"), n.classList.toggle("active", !t)
  }), document.addEventListener("click", e => {
    n.contains(e.target) || o.contains(e.target) || (o.classList.remove("show"), n.classList.remove("active"))
  }))
}

function setupToggle({
  id: e,
  storageKey: t,
  defaultOn: n,
  enableMsg: o,
  disableMsg: s,
  onChange: r
}) {
  const a = document.getElementById(e);
  a && (chrome.storage.sync.get([t], e => {
    const o = n ? !1 !== e[t] : !0 === e[t];
    a.checked = o, r && r(o)
  }), a.addEventListener("change", () => {
    const e = a.checked;
    chrome.storage.sync.set({
      [t]: e
    }), o && s && sendMessageToContentScript(e ? o : s), r && r(e)
  }))
}

function sendMessageToContentScript(e) {
  chrome.tabs.query({
    active: !0,
    currentWindow: !0
  }, t => {
    t[0] && t[0].id && chrome.tabs.sendMessage(t[0].id, {
      type: e
    }).catch(() => {})
  })
}
const keyToId = {};
TOGGLE_CONFIG.forEach(e => {
  keyToId[e.storageKey] = e.id
}), Object.assign(keyToId, {
  extensionEnabled: "extension-toggle",
  sidebarDropdownEnabled: "sidebar-dropdown-toggle",
  foldersEnabled: "folders-toggle",
  settingsInMenuEnabled: "settings-menu-toggle",
  queueingEnabled: "queue-toggle",
  hidePremadeGemsGallery: "hide-gems-gallery-toggle",
  hideGemsSidebarButton: "hide-gems-button-toggle"
});
const storageChangeCallbacks = {
  extensionEnabled: updateSettingsState,
  sidebarDropdownEnabled: updateMenuDependentSettings,
  foldersEnabled: updateTrashcanDependencyState,
  hideGemsSidebarButton: updateGemsDependencyState,
  queueingEnabled: updateQueueParamsState
};

function closePopup() {
  window.close()
}
chrome.storage.onChanged.addListener((e, t) => {
  if ("sync" === t)
    for (const [t, n] of Object.entries(e)) {
      const e = keyToId[t];
      if (e) {
        const o = document.getElementById(e);
        if (o && o.checked !== n.newValue) {
          o.checked = n.newValue;
          const e = storageChangeCallbacks[t];
          e && e(n.newValue)
        }
      }
    }
}), document.addEventListener("DOMContentLoaded", () => {
  
  try {
    chrome.runtime.connect({
      name: "sg-settings-popup"
    })
  } catch (e) {}
  chrome.storage.sync.get(["lastTheme"], e => {
    "dark" === e.lastTheme && document.body.classList.add("dark-theme")
  }), initToggles(), initShortcutsModal(), initModelSettingsModal(), sendMessageToContentScript("CLOSE_IN_PAGE_SETTINGS")
}), chrome.runtime.onMessage.addListener(e => {
  "CLOSE_POPUP" === e.type ? closePopup() : "SHOW_GUIDE_TOOLTIP" === e.type && showGuideTooltip()
});
let _sgGuideTooltipShown = !1;

function showGuideTooltip() {
  if (_sgGuideTooltipShown) return;
  const e = document.getElementById("sg-guide-btn");
  if (!e) return;
  _sgGuideTooltipShown = !0, chrome.storage.sync.set({
    hasSeenGuideTooltip: !0
  });
  const t = document.body.classList.contains("dark-theme"),
    n = t ? "#2d2e31" : "#ffffff",
    o = t ? "#e8eaed" : "#1f1f1f",
    s = t ? "#9aa0a6" : "#5f6368",
    r = t ? "#5f6368" : "#dadce0",
    a = t ? "rgba(138,180,248,0.9)" : "rgba(26,115,232,0.9)",
    c = t ? "rgba(138,180,248,0.35)" : "rgba(26,115,232,0.25)",
    d = e.getBoundingClientRect(),
    i = document.createElement("div");
  i.id = "sg-guide-tooltip-ring", i.style.cssText = `\n        position: fixed;\n        left: ${d.left-4}px; top: ${d.top-4}px;\n        width: ${d.width+8}px; height: ${d.height+8}px;\n        border-radius: 50%;\n        box-shadow: 0 0 0 2px ${a}, 0 0 12px 3px ${c};\n        pointer-events: none;\n        z-index: 2147483646;\n        animation: sg-guide-ring-pulse 1.4s ease-in-out infinite;\n    `;
  const l = document.createElement("div");
  l.id = "sg-guide-tooltip";
  const u = 230;
  let g = d.left + d.width / 2 - 115;
  g = Math.max(8, Math.min(g, window.innerWidth - u - 8));
  const m = d.bottom + 12,
    h = Math.max(g + 14, Math.min(d.left + d.width / 2, g + u - 14));
  if (l.style.cssText = `\n        position: fixed;\n        left: ${g}px; top: ${m}px;\n        width: 230px;\n        background: ${n};\n        border: 1px solid ${r};\n        border-radius: 12px;\n        padding: 14px 16px 12px 16px;\n        box-shadow: 0 8px 28px rgba(0,0,0,0.28);\n        z-index: 2147483647;\n        font-family: 'Google Sans', 'Google Sans Text', Roboto, sans-serif;\n        opacity: 0; transform: translateY(-4px);\n        transition: opacity 0.18s ease, transform 0.18s ease;\n        box-sizing: border-box;\n    `, l.innerHTML = `\n        <div style="position:absolute;top:-7px;left:${h-g-7}px;\n            width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;\n            border-bottom:7px solid ${r};"></div>\n        <div style="position:absolute;top:-6px;left:${h-g-6}px;\n            width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;\n            border-bottom:6px solid ${n};"></div>\n        <div style="font-size:14px;font-weight:600;color:${o};margin-bottom:5px;">📖 New here?</div>\n        <p style="margin:0 0 12px 0;font-size:12.5px;line-height:1.45;color:${s};">\n            Open the <strong>Guide</strong> any time for a full walkthrough of every feature.\n        </p>\n        <div style="display:flex;justify-content:flex-end;gap:8px;">\n            <button id="sg-guide-tooltip-dismiss" style="\n                padding:6px 14px;border:none;border-radius:7px;cursor:pointer;\n                font-family:inherit;font-size:12.5px;font-weight:600;\n                background:linear-gradient(135deg, #4285f4 0%, #1a73e8 100%);color:#fff;\n            ">Got it</button>\n        </div>\n    `, !document.getElementById("sg-guide-tooltip-style")) {
    const e = document.createElement("style");
    e.id = "sg-guide-tooltip-style", e.textContent = `@keyframes sg-guide-ring-pulse {\n            0%,100% { box-shadow: 0 0 0 2px ${a}, 0 0 10px 2px ${c}; }\n            50% { box-shadow: 0 0 0 3px ${a}, 0 0 18px 5px ${c}; }\n        }`, document.head.appendChild(e)
  }
  document.body.appendChild(i), document.body.appendChild(l), requestAnimationFrame(() => {
    l.style.opacity = "1", l.style.transform = "translateY(0)"
  });
  const p = () => {
    l.style.opacity = "0", l.style.transform = "translateY(-4px)", setTimeout(() => {
      l.remove(), i.remove()
    }, 180)
  };
  l.querySelector("#sg-guide-tooltip-dismiss").addEventListener("click", p), e.addEventListener("click", p, {
    once: !0
  })
}! function() {
  const e = {
    key: "s",
    alt: !0,
    ctrl: !1,
    shift: !1,
    meta: !1
  };
  chrome.storage.sync.get(["settingsShortcut", "settingsShortcutEnabled"], t => {
    if (!1 === t.settingsShortcutEnabled) return;
    const n = t.settingsShortcut || e;
    document.addEventListener("keydown", e => {
      if (e.altKey !== (n.alt || !1) || e.ctrlKey !== (n.ctrl || !1) || e.shiftKey !== (n.shift || !1) || e.metaKey !== (n.meta || !1)) return;
      (e.key.toLowerCase() === n.key.toLowerCase() || IS_MAC && e.altKey && shortcutBaseKeyFromCode(e.code) === n.key.toLowerCase()) && (e.preventDefault(), closePopup())
    })
  })
}();
const DEFAULT_SHORTCUT = {
    key: "o",
    alt: !0,
    ctrl: !1,
    shift: !1,
    meta: !1
  },
  DEFAULT_FOLDERS_SHORTCUT = {
    key: "f",
    alt: !0,
    ctrl: !1,
    shift: !1,
    meta: !1
  },
  DEFAULT_PROMPTS_SHORTCUT = {
    key: "l",
    alt: !0,
    ctrl: !1,
    shift: !1,
    meta: !1
  },
  DEFAULT_FOCUS_SHORTCUT = {
    key: "/",
    alt: !1,
    ctrl: !1,
    shift: !1,
    meta: !1
  },
  DEFAULT_GRAMMAR_SHORTCUT = {
    key: "g",
    alt: !0,
    ctrl: !1,
    shift: !1,
    meta: !1
  },
  DEFAULT_FAST_SHORTCUT = {
    key: "f",
    alt: !0,
    ctrl: !0,
    shift: !1,
    meta: !1
  },
  DEFAULT_THINKING_SHORTCUT = {
    key: "t",
    alt: !0,
    ctrl: !0,
    shift: !1,
    meta: !1
  },
  DEFAULT_PRO_SHORTCUT = {
    key: "p",
    alt: !0,
    ctrl: !0,
    shift: !1,
    meta: !1
  },
  DEFAULT_CYCLE_MODE_SHORTCUT = {
    key: "p",
    alt: !0,
    ctrl: !1,
    shift: !1,
    meta: !1
  },
  DEFAULT_IMAGE_SHORTCUT = {
    key: "i",
    alt: !0,
    ctrl: !1,
    shift: !1,
    meta: !1
  },
  DEFAULT_NO_TOOL_SHORTCUT = {
    key: "n",
    alt: !0,
    ctrl: !1,
    shift: !1,
    meta: !1
  },
  DEFAULT_DEEP_RESEARCH_SHORTCUT = {
    key: "r",
    alt: !0,
    ctrl: !1,
    shift: !1,
    meta: !1
  },
  DEFAULT_CANVAS_SHORTCUT = {
    key: "c",
    alt: !0,
    ctrl: !1,
    shift: !1,
    meta: !1
  },
  DEFAULT_VIDEO_SHORTCUT = {
    key: "v",
    alt: !0,
    ctrl: !1,
    shift: !1,
    meta: !1
  },
  DEFAULT_MUSIC_SHORTCUT = {
    key: "m",
    alt: !0,
    ctrl: !1,
    shift: !1,
    meta: !1
  },
  DEFAULT_SIDEBAR_SHORTCUT = {
    key: "q",
    alt: !0,
    ctrl: !1,
    shift: !1,
    meta: !1
  },
  DEFAULT_INSTRUCTIONS_SHORTCUT = {
    key: "i",
    alt: !0,
    ctrl: !0,
    shift: !1,
    meta: !1
  },
  DEFAULT_NEWCHAT_SHORTCUT = {
    key: "n",
    alt: !0,
    ctrl: !0,
    shift: !1,
    meta: !1
  },
  DEFAULT_TEMP_CHAT_SHORTCUT = {
    key: "a",
    alt: !0,
    ctrl: !1,
    shift: !1,
    meta: !1
  },
  DEFAULT_THINKING_LEVEL_SHORTCUT = {
    key: "t",
    alt: !0,
    ctrl: !1,
    shift: !1,
    meta: !1
  },
  DEFAULT_SETTINGS_SHORTCUT = {
    key: "s",
    alt: !0,
    ctrl: !1,
    shift: !1,
    meta: !1
  },
  SHORTCUT_CONFIGS = [{
    storageKey: "optimizeShortcut",
    elementId: "optimize-shortcut-input",
    defaultVal: DEFAULT_SHORTCUT
  }, {
    storageKey: "foldersShortcut",
    elementId: "folders-shortcut-input",
    defaultVal: DEFAULT_FOLDERS_SHORTCUT
  }, {
    storageKey: "promptsShortcut",
    elementId: "prompts-shortcut-input",
    defaultVal: DEFAULT_PROMPTS_SHORTCUT
  }, {
    storageKey: "grammarShortcut",
    elementId: "grammar-shortcut-input",
    defaultVal: DEFAULT_GRAMMAR_SHORTCUT
  }, {
    storageKey: "cycleModeShortcut",
    elementId: "cycle-mode-shortcut-input",
    defaultVal: DEFAULT_CYCLE_MODE_SHORTCUT
  }, {
    storageKey: "imageShortcut",
    elementId: "image-shortcut-input",
    defaultVal: DEFAULT_IMAGE_SHORTCUT
  }, {
    storageKey: "noToolShortcut",
    elementId: "no-tool-shortcut-input",
    defaultVal: DEFAULT_NO_TOOL_SHORTCUT
  }, {
    storageKey: "deepResearchShortcut",
    elementId: "deep-research-shortcut-input",
    defaultVal: DEFAULT_DEEP_RESEARCH_SHORTCUT
  }, {
    storageKey: "canvasShortcut",
    elementId: "canvas-shortcut-input",
    defaultVal: DEFAULT_CANVAS_SHORTCUT
  }, {
    storageKey: "videoShortcut",
    elementId: "video-shortcut-input",
    defaultVal: DEFAULT_VIDEO_SHORTCUT
  }, {
    storageKey: "musicShortcut",
    elementId: "music-shortcut-input",
    defaultVal: DEFAULT_MUSIC_SHORTCUT
  }, {
    storageKey: "sidebarShortcut",
    elementId: "sidebar-shortcut-input",
    defaultVal: DEFAULT_SIDEBAR_SHORTCUT
  }, {
    storageKey: "instructionsShortcut",
    elementId: "instructions-shortcut-input",
    defaultVal: DEFAULT_INSTRUCTIONS_SHORTCUT
  }, {
    storageKey: "newchatShortcut",
    elementId: "newchat-shortcut-input",
    defaultVal: DEFAULT_NEWCHAT_SHORTCUT
  }, {
    storageKey: "tempChatShortcut",
    elementId: "temp-chat-shortcut-input",
    defaultVal: DEFAULT_TEMP_CHAT_SHORTCUT
  }, {
    storageKey: "thinkingLevelShortcut",
    elementId: "thinking-level-shortcut-input",
    defaultVal: DEFAULT_THINKING_LEVEL_SHORTCUT
  }],
  currentShortcuts = {};
for (const e of SHORTCUT_CONFIGS) currentShortcuts[e.storageKey] = {
  ...e.defaultVal
};

function formatShortcut(e) {
  const t = [];
  return e.ctrl && t.push("Ctrl"), e.alt && t.push("Alt"), e.shift && t.push("Shift"), e.meta && t.push("Meta"), t.push(e.key.toUpperCase()), t.join("+")
}

function displayShortcut(e) {
  return toDisplayCombo(formatShortcut(e))
}
async function checkShortcutConflict(e, t = null) {
  const n = formatShortcut(e);
  return new Promise(e => {
    chrome.storage.sync.get(["optimizeShortcut", "foldersShortcut", "promptsShortcut", "grammarShortcut", "settingsShortcut", "cycleModeShortcut", "imageShortcut", "noToolShortcut", "deepResearchShortcut", "canvasShortcut", "videoShortcut", "musicShortcut", "sidebarShortcut", "instructionsShortcut", "newchatShortcut", "optimizeShortcutEnabled", "foldersShortcutEnabled", "promptsShortcutEnabled", "grammarShortcutEnabled", "settingsShortcutEnabled", "cycleModeShortcutEnabled", "imageShortcutEnabled", "noToolShortcutEnabled", "deepResearchShortcutEnabled", "canvasShortcutEnabled", "videoShortcutEnabled", "musicShortcutEnabled", "sidebarShortcutEnabled", "instructionsShortcutEnabled", "newchatShortcutEnabled", "tempChatShortcut", "tempChatShortcutEnabled", "thinkingLevelShortcut", "thinkingLevelShortcutEnabled", "focusShortcutEnabled", "quickActions"], o => {
      const s = [{
        key: "optimizeShortcut",
        name: "Optimize Prompt",
        shortcut: o.optimizeShortcut || DEFAULT_SHORTCUT,
        enabled: !1 !== o.optimizeShortcutEnabled
      }, {
        key: "foldersShortcut",
        name: "Open Folders",
        shortcut: o.foldersShortcut || DEFAULT_FOLDERS_SHORTCUT,
        enabled: !1 !== o.foldersShortcutEnabled
      }, {
        key: "promptsShortcut",
        name: "Open Prompts",
        shortcut: o.promptsShortcut || DEFAULT_PROMPTS_SHORTCUT,
        enabled: !1 !== o.promptsShortcutEnabled
      }, {
        key: "focusShortcut",
        name: "Focus Input",
        shortcut: DEFAULT_FOCUS_SHORTCUT,
        enabled: !1 !== o.focusShortcutEnabled
      }, {
        key: "grammarShortcut",
        name: "Fix Grammar",
        shortcut: o.grammarShortcut || DEFAULT_GRAMMAR_SHORTCUT,
        enabled: !1 !== o.grammarShortcutEnabled
      }, {
        key: "settingsShortcut",
        name: "Open Settings",
        shortcut: o.settingsShortcut || DEFAULT_SETTINGS_SHORTCUT,
        enabled: !1 !== o.settingsShortcutEnabled
      }, {
        key: "cycleModeShortcut",
        name: "Cycle Model",
        shortcut: o.cycleModeShortcut || DEFAULT_CYCLE_MODE_SHORTCUT,
        enabled: !1 !== o.cycleModeShortcutEnabled
      }, {
        key: "imageShortcut",
        name: "Toggle Image Gen",
        shortcut: o.imageShortcut || DEFAULT_IMAGE_SHORTCUT,
        enabled: !1 !== o.imageShortcutEnabled
      }, {
        key: "noToolShortcut",
        name: "Deselect Tool",
        shortcut: o.noToolShortcut || DEFAULT_NO_TOOL_SHORTCUT,
        enabled: !1 !== o.noToolShortcutEnabled
      }, {
        key: "deepResearchShortcut",
        name: "Toggle Deep Research",
        shortcut: o.deepResearchShortcut || DEFAULT_DEEP_RESEARCH_SHORTCUT,
        enabled: !1 !== o.deepResearchShortcutEnabled
      }, {
        key: "canvasShortcut",
        name: "Toggle Canvas",
        shortcut: o.canvasShortcut || DEFAULT_CANVAS_SHORTCUT,
        enabled: !1 !== o.canvasShortcutEnabled
      }, {
        key: "videoShortcut",
        name: "Toggle Video",
        shortcut: o.videoShortcut || DEFAULT_VIDEO_SHORTCUT,
        enabled: !1 !== o.videoShortcutEnabled
      }, {
        key: "musicShortcut",
        name: "Toggle Music",
        shortcut: o.musicShortcut || DEFAULT_MUSIC_SHORTCUT,
        enabled: !1 !== o.musicShortcutEnabled
      }, {
        key: "sidebarShortcut",
        name: "Toggle Sidebar",
        shortcut: o.sidebarShortcut || DEFAULT_SIDEBAR_SHORTCUT,
        enabled: !1 !== o.sidebarShortcutEnabled
      }, {
        key: "instructionsShortcut",
        name: "Open Custom Instructions",
        shortcut: o.instructionsShortcut || DEFAULT_INSTRUCTIONS_SHORTCUT,
        enabled: !1 !== o.instructionsShortcutEnabled
      }, {
        key: "newchatShortcut",
        name: "Open New Chat",
        shortcut: o.newchatShortcut || DEFAULT_NEWCHAT_SHORTCUT,
        enabled: !1 !== o.newchatShortcutEnabled
      }, {
        key: "tempChatShortcut",
        name: "Toggle Temp Chat",
        shortcut: o.tempChatShortcut || DEFAULT_TEMP_CHAT_SHORTCUT,
        enabled: !1 !== o.tempChatShortcutEnabled
      }, {
        key: "thinkingLevelShortcut",
        name: "Toggle Thinking Level",
        shortcut: o.thinkingLevelShortcut || DEFAULT_THINKING_LEVEL_SHORTCUT,
        enabled: !1 !== o.thinkingLevelShortcutEnabled
      }];
      for (const o of s)
        if (o.key !== t && o.shortcut && o.enabled && formatShortcut(o.shortcut) === n) return void e({
          conflict: !0,
          name: o.name
        });
      const r = o.quickActions || [];
      for (let o = 0; o < r.length; o++) {
        const s = r[o];
        if (t !== `quickAction${o}` && (s.enabled && s.shortcut && s.shortcut === n)) return void e({
          conflict: !0,
          name: `Quick Action ${o+1}`
        })
      }
      e({
        conflict: !1
      })
    })
  })
}

function setupShortcutInput(e) {
  const t = document.getElementById(e.elementId);
  if (!t) return;
  let n = !1,
    o = !1;
  t.addEventListener("focus", () => {
    n = !0, o = !1, t.classList.add("recording"), t.textContent = "Press shortcut..."
  }), t.addEventListener("blur", () => {
    n = !1, t.classList.remove("recording"), o || (t.textContent = displayShortcut(currentShortcuts[e.storageKey]))
  }), t.addEventListener("keydown", async s => {
    if (!n) return;
    if (s.preventDefault(), s.stopPropagation(), "Escape" === s.key) return void t.blur();
    if (["Control", "Alt", "Shift", "Meta"].includes(s.key)) return;
    if (!(s.ctrlKey || s.altKey || s.shiftKey || s.metaKey)) return o = !0, t.textContent = "Need modifier key!", void setTimeout(() => {
      o = !1, t.textContent = n ? "Press shortcut..." : displayShortcut(currentShortcuts[e.storageKey])
    }, 1e3);
    let r = s.key.toLowerCase();
    if (IS_MAC && s.altKey) {
      const e = shortcutBaseKeyFromCode(s.code);
      e && (r = e)
    }
    const a = {
        key: r,
        alt: s.altKey,
        ctrl: s.ctrlKey,
        shift: s.shiftKey,
        meta: s.metaKey
      },
      c = await checkShortcutConflict(a, e.storageKey);
    if (c.conflict) return t.textContent = `Used by ${c.name}!`, t.style.background = "linear-gradient(135deg, #e85d6c 0%, #CA6673 100%)", t.style.color = "white", void setTimeout(() => {
      t.textContent = displayShortcut(currentShortcuts[e.storageKey]), t.style.background = "", t.style.color = "", t.classList.remove("recording"), n = !1, t.blur()
    }, 1500);
    currentShortcuts[e.storageKey] = a, t.textContent = displayShortcut(currentShortcuts[e.storageKey]), t.classList.remove("recording"), n = !1, t.blur(), chrome.storage.sync.set({
      [e.storageKey]: a
    })
  })
}

function initShortcutsModal() {
  const e = document.getElementById("shortcuts-btn"),
    t = document.getElementById("shortcuts-modal"),
    n = document.getElementById("shortcuts-close-btn"),
    o = document.getElementById("shortcuts-reset-btn");
  if (!e || !t) return;
  IS_MAC && t.querySelectorAll(".shortcut-key-input").forEach(e => {
    e.textContent = toDisplayCombo(e.textContent)
  });
  const s = SHORTCUT_CONFIGS.map(e => e.storageKey),
    r = SHORTCUT_CONFIGS.map(e => e.storageKey + "Enabled");
  chrome.storage.sync.get([...s, ...r, "focusShortcutEnabled"], e => {
    for (const t of SHORTCUT_CONFIGS) {
      e[t.storageKey] && (currentShortcuts[t.storageKey] = e[t.storageKey]);
      const n = document.getElementById(t.elementId);
      n && (n.textContent = displayShortcut(currentShortcuts[t.storageKey]))
    }
    for (const t of SHORTCUT_CONFIGS) {
      const n = t.elementId.replace("-input", "-enabled"),
        o = document.getElementById(n);
      o && (o.checked = !1 !== e[t.storageKey + "Enabled"])
    }
    const t = document.getElementById("focus-shortcut-enabled");
    t && (t.checked = !1 !== e.focusShortcutEnabled)
  }), e.addEventListener("click", () => {
    t.style.display = "flex", document.documentElement.classList.add("no-scroll"), chrome.storage.sync.get([...s, ...r, "focusShortcutEnabled"], e => {
      for (const t of SHORTCUT_CONFIGS) {
        currentShortcuts[t.storageKey] = e[t.storageKey] ? {
          ...e[t.storageKey]
        } : {
          ...t.defaultVal
        };
        const n = document.getElementById(t.elementId);
        n && (n.textContent = displayShortcut(currentShortcuts[t.storageKey]))
      }
      for (const t of SHORTCUT_CONFIGS) {
        const n = t.elementId.replace("-input", "-enabled"),
          o = document.getElementById(n);
        o && (o.checked = !1 !== e[t.storageKey + "Enabled"])
      }
      const t = document.getElementById("focus-shortcut-enabled");
      t && (t.checked = !1 !== e.focusShortcutEnabled)
    })
  });
  const a = () => {
    t.style.display = "none", document.documentElement.classList.remove("no-scroll");
    for (const e of SHORTCUT_CONFIGS) {
      const t = document.getElementById(e.elementId);
      t && t.classList.remove("recording")
    }
  };
  n.addEventListener("click", a), t.addEventListener("click", e => {
    e.target === t && a()
  }), document.addEventListener("keydown", e => {
    if ("Escape" === e.key && "flex" === t.style.display) {
      const e = t.querySelector(".recording");
      e ? e.blur() : a()
    }
  });
  for (const e of SHORTCUT_CONFIGS) {
    const t = e.elementId.replace("-input", "-enabled"),
      n = document.getElementById(t);
    n && n.addEventListener("change", () => {
      chrome.storage.sync.set({
        [e.storageKey + "Enabled"]: n.checked
      })
    })
  }
  const c = document.getElementById("focus-shortcut-enabled");
  c && c.addEventListener("change", () => {
    chrome.storage.sync.set({
      focusShortcutEnabled: c.checked
    })
  });
  const d = document.getElementById("focus-shortcut-input");
  if (d) {
    let e = null;
    d.addEventListener("click", () => {
      e && clearTimeout(e), d.textContent = "Can't be changed!", d.style.background = "linear-gradient(135deg, #e85d6c 0%, #CA6673 100%)", d.style.color = "white", e = setTimeout(() => {
        d.textContent = "/", d.style.background = "", d.style.color = "", e = null
      }, 1500)
    })
  }
  SHORTCUT_CONFIGS.forEach(e => setupShortcutInput(e)), o.addEventListener("click", () => {
    for (const e of SHORTCUT_CONFIGS) {
      currentShortcuts[e.storageKey] = {
        ...e.defaultVal
      };
      const t = document.getElementById(e.elementId);
      t && (t.textContent = displayShortcut(currentShortcuts[e.storageKey]))
    }
    const e = document.getElementById("focus-shortcut-enabled");
    e && (e.checked = !0);
    const t = SHORTCUT_CONFIGS.map(e => formatShortcut(currentShortcuts[e.storageKey]));
    chrome.storage.sync.get(["quickActions"], e => {
      const n = e.quickActions || [];
      let o = !1;
      for (let e = 0; e < n.length; e++) n[e].shortcut && t.includes(n[e].shortcut) && (n[e].shortcut = "", o = !0);
      const s = {
        focusShortcutEnabled: !0
      };
      for (const e of SHORTCUT_CONFIGS) s[e.storageKey] = currentShortcuts[e.storageKey];
      o && (s.quickActions = n), chrome.storage.sync.set(s)
    })
  })
}

function _sgWireSegmented(e, t, n, o) {
  const s = document.getElementById(e);
  if (!s) return;
  const r = Array.from(s.querySelectorAll(".sg-seg-opt"));
  if (!r.length) return;
  const a = r.some(e => e.dataset.value === n) ? n : o,
    c = e => {
      r.forEach(t => {
        const n = t.dataset.value === e;
        t.classList.toggle("sg-active", n), t.setAttribute("aria-checked", n ? "true" : "false"), t.tabIndex = n ? 0 : -1
      })
    };
  c(a), r.forEach(e => {
    e.addEventListener("click", () => {
      e.classList.contains("sg-active") || (c(e.dataset.value), chrome.storage.sync.set({
        [t]: e.dataset.value
      }))
    })
  })
}

function initModelSettingsModal() {
  const e = document.getElementById("model-settings-btn"),
    t = document.getElementById("model-settings-modal"),
    n = document.getElementById("model-settings-close-btn");
  if (!e || !t) return;
  chrome.storage.sync.get(["optimizeModel", "defaultModel", "defaultReasoningEffort", "tempChatModel"], e => {
    _sgWireSegmented("default-model-seg", "defaultModel", e.defaultModel || "none", "none");
    _sgWireSegmented("default-thinking-level-seg", "defaultReasoningEffort", {
      standard: "low",
      extended: "high"
    } [e.defaultReasoningEffort] || e.defaultReasoningEffort || "none", "none"), _sgWireSegmented("optimize-model-seg", "optimizeModel", e.optimizeModel || "flash", "flash"), _sgWireSegmented("temp-chat-model-seg", "tempChatModel", e.tempChatModel || "none", "none")
  }), e.addEventListener("click", () => {
    t.style.display = "flex", document.documentElement.classList.add("no-scroll")
  });
  const o = () => {
    t.style.display = "none", document.documentElement.classList.remove("no-scroll")
  };
  n && n.addEventListener("click", o), t.addEventListener("click", e => {
    e.target === t && o()
  })
}
