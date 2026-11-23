let gpsSidebarObserver = null,
  _sgViewportReinjectBound = !1;
async function initFolderSystem() {
  const e = await new Promise(e => {
    sgSyncGetCached(["extensionEnabled", "foldersEnabled"], e)
  });
  isFoldersFeatureEnabled = !1 !== e.foldersEnabled;
  if (!1 !== e.extensionEnabled) {
    injectFolderStyles(), await loadFoldersData();
    try {
      initDriveSync()
    } catch (e) {
      console.error("[Drive Sync] init failed", e)
    }
    if (injectSidebarSection(), gpsSidebarObserver || (sgObserverRegistry.registerUIRefresh("gpsSidebar", injectSidebarSection), gpsSidebarObserver = {
        disconnect() {
          sgObserverRegistry.unregisterUIRefresh("gpsSidebar")
        }
      }), !_sgViewportReinjectBound) {
      _sgViewportReinjectBound = !0;
      let e = null;
      const t = () => {
        clearTimeout(e), e = setTimeout(() => {
          const e = () => {
            try {
              injectSidebarSection()
            } catch (e) {
              console.error("[SG] viewport re-inject failed", e)
            }
            try {
              sgInjectNativeMenu()
            } catch (e) {}
          };
          e(), setTimeout(e, 500);
          try {
            sgScheduleNativeReinject()
          } catch (e) {}
        }, 150)
      };
      window.addEventListener("resize", t, { passive: !0 }), window.visualViewport && window.visualViewport.addEventListener("resize", t, { passive: !0 })
    }
    if (sgInjectNativeMenu(), sgScheduleNativeReinject(), sgSetupNativeMenuObserver(), !1 !== e.foldersEnabled) {
      setupFolderOverlayObserver(), setupChatMenuClickTracker(), applySidebarFiltering();
      startSidebarFilterWatchers();
    }
    document.addEventListener("click", e => {
      const t = [".sg-add-chat-checkbox", ".sg-prompt-checkbox", ".sg-chat-checkbox", ".sg-chats-tab-checkbox"];
      for (const n of t) {
        const t = e.target.closest(n);
        if (t && "checkbox" === t.type) return e.shiftKey || (window._sgShiftClickAnchors = window._sgShiftClickAnchors || {}, window._sgShiftClickAnchors[n] = t), void(e.shiftKey || e.stopPropagation())
      }
      e.target.matches(".sg-stop-propagation") && e.stopPropagation()
    }, !0), checkAndShowOnboardingPopup(), sgInitSettingsReminder(), sgInitWelcomeTour()
  }
}
let _sgSidebarFilterObserver = null,
  _sgSidebarFilterRetryTimer = null,
  _sgSidebarFilterInterval = null;

let _sgSidebarFilterVisHandler = null;

function stopSidebarFilterWatchers() {
  if (_sgSidebarFilterObserver) {
    _sgSidebarFilterObserver.disconnect();
    _sgSidebarFilterObserver = null;
  }
  if (_sgSidebarFilterRetryTimer) {
    clearTimeout(_sgSidebarFilterRetryTimer);
    _sgSidebarFilterRetryTimer = null;
  }
  if (_sgSidebarFilterInterval) {
    clearInterval(_sgSidebarFilterInterval);
    _sgSidebarFilterInterval = null;
  }
  if (_sgSidebarFilterVisHandler && "undefined" != typeof document && "function" == typeof document.removeEventListener) {
    document.removeEventListener("visibilitychange", _sgSidebarFilterVisHandler);
    _sgSidebarFilterVisHandler = null;
  }
}

function startSidebarFilterWatchers() {
  if (SG_IS_SILENT_BG_WORKER_TAB) return;
  stopSidebarFilterWatchers();
  const bindObserver = () => {
    const list = domQuery("conversationsList");
    if (!list) return !1;
    _sgSidebarFilterObserver = new MutationObserver(debouncedApplySidebarFiltering);
    _sgSidebarFilterObserver.observe(list, {
      childList: !0,
      subtree: !0
    });
    return !0;
  };
  if (!bindObserver()) {
    _sgSidebarFilterRetryTimer = setTimeout(() => {
      _sgSidebarFilterRetryTimer = null;
      if (isFoldersFeatureEnabled) bindObserver();
    }, 3e3);
  }
  const syncFilterInterval = () => {
    if ("undefined" != typeof document && document.hidden) {
      if (_sgSidebarFilterInterval) {
        clearInterval(_sgSidebarFilterInterval);
        _sgSidebarFilterInterval = null;
      }
      return;
    }
    if (!isFoldersFeatureEnabled) return;
    _sgSidebarFilterInterval || (_sgSidebarFilterInterval = setInterval(() => {
      if (document.hidden) {
        clearInterval(_sgSidebarFilterInterval);
        _sgSidebarFilterInterval = null;
        return;
      }
      applySidebarFiltering();
    }, 3e4));
  };
  _sgSidebarFilterVisHandler = () => {
    if ("undefined" != typeof document && document.hidden) {
      syncFilterInterval();
    } else if (isFoldersFeatureEnabled) {
      applySidebarFiltering();
      syncFilterInterval();
    }
  };
  "undefined" != typeof document && "function" == typeof document.addEventListener && document.addEventListener("visibilitychange", _sgSidebarFilterVisHandler);
  syncFilterInterval();
}
let sidebarLoadMoreTimeout = null,
  sidebarLoadMoreRetries = 0,
  _sgLastSidebarLoadDomCount = -1;
const MAX_SIDEBAR_LOAD_RETRIES = 10,
  _sgSessionPermanentlyDeletedIds = new Set;

function triggerSidebarLoadMore(e, t, o = 0) {
  if (!t || t <= 0) {
    sidebarLoadMoreTimeout && (clearTimeout(sidebarLoadMoreTimeout), sidebarLoadMoreTimeout = null);
    sidebarLoadMoreRetries = 0;
    _sgLastSidebarLoadDomCount = -1;
    return;
  }
  const n = "INFINITE-SCROLLER" === e?.tagName ? e : domQuery("sidebarScroller");
  if (!n) return;
  if (n.scrollHeight > n.clientHeight + 150) {
    sidebarLoadMoreRetries = 0;
    _sgLastSidebarLoadDomCount = -1;
    return;
  }
  if (sidebarLoadMoreRetries > 0 && o <= _sgLastSidebarLoadDomCount) return;
  if (sidebarLoadMoreRetries >= MAX_SIDEBAR_LOAD_RETRIES) return;
  sidebarLoadMoreTimeout && clearTimeout(sidebarLoadMoreTimeout);
  sidebarLoadMoreTimeout = setTimeout(() => {
    sidebarLoadMoreTimeout = null;
    if (sidebarLoadMoreRetries >= MAX_SIDEBAR_LOAD_RETRIES) return;
    if (sidebarLoadMoreRetries > 0 && o <= _sgLastSidebarLoadDomCount) return;
    sidebarLoadMoreRetries++;
    _sgLastSidebarLoadDomCount = o;
    const e = n.scrollTop;
    n.scrollTop = n.scrollHeight, n.dispatchEvent(new Event("scroll", {
      bubbles: !0
    })), setTimeout(() => {
      0 === e && (n.scrollTop = 0)
    }, 100)
  }, 200)
}
let _sidebarFilteringTimeout = null;

function debouncedApplySidebarFiltering() {
  applyHiddenChatsCSS(), _sidebarFilteringTimeout && clearTimeout(_sidebarFilteringTimeout), _sidebarFilteringTimeout = setTimeout(applySidebarFiltering, 300)
}

function sgNormalizeChatId(e) {
  return "string" == typeof e && e.startsWith("c_") ? e.substring(2) : e
}

function sgCollectPinnedChatIds() {
  const e = new Set;
  return document.querySelectorAll('gem-nav-list-item[data-test-id="conversation"], .conversation-items-container').forEach(t => {
    const n = !!t.querySelector('[fonticon="push_pin"], [data-mat-icon-name="push_pin"], .pin-icon-container mat-icon'),
      o = (t.textContent || "").toLowerCase().includes("pinned chat"),
      r = !!t.closest("#sg-pinned-section-wrapper");
    if (n || o || r ? "1" !== t.dataset.sgPinned && (t.dataset.sgPinned = "1") : "1" !== t.dataset.sgPinned || t.matches(":hover") || delete t.dataset.sgPinned, "1" !== t.dataset.sgPinned) return;
    const s = t.querySelector('a[href*="/app/"]')?.getAttribute("href") || "",
      a = s.split("/app/").pop()?.split(/[?#]/)[0] || "";
    a && e.add(sgNormalizeChatId(a))
  }), e
}

function applyHiddenChatsCSS() {
  const e = new Set;
  if (_sgSessionPermanentlyDeletedIds.forEach(t => {
      t && e.add(t)
    }), hideFolderedChats && Array.isArray(foldersData.folders)) {
    const t = sgCollectPinnedChatIds();
    foldersData.folders.forEach(n => {
      Array.isArray(n.chats) && n.chats.forEach(n => {
        n && n.id && !t.has(sgNormalizeChatId(n.id)) && e.add(n.id)
      })
    })
  }
  const t = window.sgForcedVisibleChatId;
  t && (e.delete(t), e.delete(t.startsWith("c_") ? t.substring(2) : "c_" + t));
  let n = document.getElementById("sg-hidden-chats-style");
  if (n || (n = document.createElement("style"), n.id = "sg-hidden-chats-style", (document.head || document.documentElement).appendChild(n)), 0 === e.size) return void(n.textContent && (n.textContent = ""));
  const o = [];
  e.forEach(e => {
    const t = e.startsWith("c_") ? e.substring(2) : e;
    o.push(`gem-nav-list-item[data-test-id="conversation"]:has(a[href*="/app/${t}"])`), o.push(`.conversation-items-container:has(a[href*="/app/${t}"])`)
  });
  const r = o.join(",\n") + " { display: none !important; }";
  n.textContent !== r && (n.textContent = r)
}

function applySidebarFiltering() {
  applyHiddenChatsCSS();
  const e = domQuery("conversationsList"),
    t = document.getElementById("sg-pinned-section-wrapper");
  if (!e && !t) return;
  const n = new Set,
    permSet = new Set;
  foldersData.permanentlyDeleted && foldersData.permanentlyDeleted.forEach(e => {
    n.add(e);
    permSet.add(e);
  });
  const o = new Set;
  if (foldersData.folders.forEach(e => {
      e.chats && e.chats.forEach(e => o.add(e.id))
    }), hideFolderedChats) {
    const e = sgCollectPinnedChatIds();
    o.forEach(t => {
      e.has(sgNormalizeChatId(t)) || n.add(t)
    })
  }
  let hiddenInDomCount = 0,
    totalDomCount = 0,
    newSessionPermFound = !1;
  const seenDomChatIds = new Set,
    r = 'div.conversation, gem-nav-list-item[data-test-id="conversation"]';
  [...e ? e.querySelectorAll(r) : [], ...t ? t.querySelectorAll(r) : []].forEach(e => {
    let o = null;
    const r = e.querySelector('a[href*="/app/"]');
    if (r) {
      const e = r.href;
      o = e.split("/app/").pop()?.split(/[?#]/)[0] || ""
    }
    if (!o) {
      o = extractChatIdFromJslog(e.getAttribute("jslog"))
    }
    if (!o) return;
    const s = o.startsWith("c_") ? o.substring(2) : o;
    seenDomChatIds.has(s) || (seenDomChatIds.add(s), totalDomCount++);
    const a = window.sgForcedVisibleChatId === o || window.sgForcedVisibleChatId === s,
      i = (n.has(o) || n.has(s)) && !a,
      l = "GEM-NAV-LIST-ITEM" === e.tagName ? e : e.closest(".conversation-items-container") || e.closest('[class*="conversation-item"]') || e.parentElement;
    if (i) {
      hiddenInDomCount++;
      if ((permSet.has(o) || permSet.has(s)) && !_sgSessionPermanentlyDeletedIds.has(s)) {
        _sgSessionPermanentlyDeletedIds.add(s);
        newSessionPermFound = !0;
      }
    }
    l && i ? l.style.display = "none" : l && (l.style.display = "")
  });
  (e ? e.querySelectorAll(".conversation-items-container") : []).forEach(e => {
    if (e.querySelector("div.conversation")) return;
    const t = e.querySelector('a[href*="/app/"]');
    if (!t) return;
    const o = t.href,
      r = o.split("/app/").pop()?.split(/[?#]/)[0] || "",
      s = r.startsWith("c_") ? r.substring(2) : r;
    seenDomChatIds.has(s) || (seenDomChatIds.add(s), totalDomCount++);
    if (n.has(r) || n.has(s)) {
      hiddenInDomCount++;
      if ((permSet.has(r) || permSet.has(s)) && !_sgSessionPermanentlyDeletedIds.has(s)) {
        _sgSessionPermanentlyDeletedIds.add(s);
        newSessionPermFound = !0;
      }
      e.style.display = "none";
    } else {
      e.style.display = "";
    }
  });
  newSessionPermFound && applyHiddenChatsCSS();
  e && triggerSidebarLoadMore(e, hiddenInDomCount, totalDomCount)
}

function applySearchPanelFiltering() {
  const e = document.querySelector(".search-window-container");
  if (!e) return;
  const t = new Set;
  if (hideFolderedChats && foldersData.folders) {
    const e = sgCollectPinnedChatIds();
    foldersData.folders.forEach(n => {
      n.chats && n.chats.forEach(n => {
        n.title && !e.has(sgNormalizeChatId(n.id)) && t.add(n.title)
      })
    })
  }
  e.querySelectorAll(".conversation-container").forEach(e => {
    const n = e.querySelector(".title"),
      o = n?.textContent?.trim();
    o && (e.style.display = t.has(o) ? "none" : "")
  })
}
SG_IS_SILENT_BG_WORKER_TAB || (sgObserverRegistry.registerUIRefresh("searchPanelFiltering", applySearchPanelFiltering), setTimeout(initFolderSystem, 500));
let pinnedSectionExpanded = !0,
  pinnedChatsObserver = null,
  _sgPinnedWrapperReclaimObserver = null;
async function loadPinnedSectionState() {
  try {
    const e = await sgSyncGetCached(["pinnedSectionExpanded"]);
    void 0 !== e.pinnedSectionExpanded && (pinnedSectionExpanded = e.pinnedSectionExpanded)
  } catch (e) {
    console.error("[Gemini Power Suite] Error loading pinned section state: ❌", e)
  }
}
async function savePinnedSectionState() {
  try {
    await chrome.storage.sync.set({
      pinnedSectionExpanded: pinnedSectionExpanded
    })
  } catch (e) {
    console.error("[Gemini Power Suite] Error saving pinned section state: ❌", e)
  }
}

function findPinnedChats() {
  const e = [],
    t = new Set,
    n = document.getElementById("sg-pinned-section-wrapper");
  n && n.querySelectorAll('gem-nav-list-item[data-test-id="conversation"]').forEach(n => {
    t.has(n) || (t.add(n), e.push(n))
  });
  const o = domQuery("conversationsList");
  if (!o) return e;
  let r = o.querySelectorAll('gem-nav-list-item[data-test-id="conversation"]');
  return 0 === r.length && (r = o.querySelectorAll(".conversation-items-container")), r.forEach(n => {
    if (t.has(n)) return;
    const o = n.querySelector('[fonticon="push_pin"], [data-mat-icon-name="push_pin"], .pin-icon-container mat-icon'),
      r = (n.textContent?.toLowerCase() || "").includes("pinned chat"),
      s = (n.classList.contains("sg-pinned-chat-visible") || n.classList.contains("sg-pinned-chat-hidden")) && n.matches(":hover");
    (o || r || s) && (t.add(n), e.push(n))
  }), e
}

function sgClearStalePinnedMarks(e) {
  const t = new Set(e);
  document.querySelectorAll(".sg-pinned-chat-hidden, .sg-pinned-chat-visible").forEach(e => {
    if (t.has(e)) return;
    const n = e.classList.contains("sg-pinned-chat-hidden");
    e.classList.remove("sg-pinned-chat-hidden", "sg-pinned-chat-visible"), n && e.querySelectorAll("a, button, [tabindex]").forEach(e => {
      void 0 !== e.dataset.originalTabIndex ? e.setAttribute("tabindex", e.dataset.originalTabIndex) : e.removeAttribute("tabindex")
    })
  })
}

function findNewestRecentsSection() {
  const e = document.querySelector(".sidenav-with-history-container infinite-scroller") || document.querySelector("side-navigation-content infinite-scroller") || document.querySelector("bard-sidenav infinite-scroller") || document.querySelector('[role="navigation"] infinite-scroller');
  if (!e) return null;
  const t = e.querySelectorAll(":scope > expandable-section");
  for (const n of t)
    if (n.querySelector(".chat-history, conversations-list")) return {
      container: e,
      recentsSection: n
    };
  return null
}

function sgRowHasPinMarker(e) {
  return !!e.querySelector('.conversation-pin-icon, [fonticon="push_pin"], [data-mat-icon-name="push_pin"], .pin-icon-container mat-icon') || (e.textContent || "").toLowerCase().includes("pinned chat")
}

function evictUnpinnedChatsFromWrapper(e, t) {
  const n = [...e.querySelectorAll('gem-nav-list-item[data-test-id="conversation"]')].filter(e => !sgRowHasPinMarker(e) && !e.matches(":hover") && !e.classList.contains("menu-opened"));
  if (!n.length) return;
  const o = t.querySelector("mat-nav-list") || t,
    r = o.querySelector(':scope > gem-nav-list-item[data-test-id="conversation"]') || o.firstChild;
  n.forEach(e => o.insertBefore(e, r))
}

function relocatePinnedChatsIntoWrapper(e) {
  if (!e) return;
  const t = domQuery("conversationsList");
  if (!t) return;
  const n = e.querySelector(".sg-pinned-section-content-inner") || e;
  evictUnpinnedChatsFromWrapper(e, t);
  t.querySelectorAll('gem-nav-list-item[data-test-id="conversation"]').forEach(t => {
    if (!sgRowHasPinMarker(t)) return;
    const o = t.querySelector("a")?.getAttribute("href");
    if (o) {
      const n = e.querySelector(`gem-nav-list-item a[href="${CSS.escape(o)}"]`),
        r = n?.closest("gem-nav-list-item");
      r && r !== t && r.remove()
    }
    n.appendChild(t)
  })
}

function attachPinnedWrapperReclaimObserver(e) {
  if (!e || _sgPinnedWrapperReclaimObserver) return;
  const t = e.querySelector(".sg-pinned-section-content-inner") || e;
  _sgPinnedWrapperReclaimObserver = new MutationObserver(e => {
    let n = 0;
    e.forEach(e => {
      e.removedNodes.forEach(e => {
        e instanceof HTMLElement && "GEM-NAV-LIST-ITEM" === e.tagName && e.isConnected && e.parentElement !== t && sgRowHasPinMarker(e) && (t.appendChild(e), n++)
      })
    }), n && updatePinnedChatsVisibility()
  }), _sgPinnedWrapperReclaimObserver.observe(t, {
    childList: !0
  })
}

function createPinnedSectionHeader() {
  const e = document.createElement("div");
  e.id = "sg-pinned-section-header", e.className = "sg-pinned-header", e.setAttribute("tabindex", "0"), e.setAttribute("role", "button"), e.setAttribute("aria-expanded", pinnedSectionExpanded);
  const t = pinnedSectionExpanded ? "rotate(0deg)" : "rotate(-90deg)";
  return e.style.cssText = "\n    display: flex;\n    align-items: center;\n    justify-content: space-between;\n    padding: 12px 14px;\n    margin: 0 0 8px 0;\n    background: transparent;\n    border-radius: 28px;\n    cursor: pointer;\n    user-select: none;\n    transition: background 0.15s ease;\n  ",sgSetSafeHtml(e, `\n    <div class="sg-section-header-left" style="display: flex; align-items: center; gap: 10px;">\n      <svg viewBox="0 0 24 24" fill="currentColor" style="width: 18px; height: 18px; color: #5f6368;">\n        <path d="M16 9V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z"/>\n      </svg>\n      <span style="font-size: 14px; font-weight: 500; color: #1f1f1f;">Pinned</span>\n    </div>\n    <mat-icon class="sg-pinned-chevron mat-icon notranslate lm-icon-s lumi-symbols mat-ligature-font mat-icon-no-color" role="img" aria-hidden="true" data-mat-icon-type="font" data-mat-icon-name="keyboard_arrow_down" style="transform: ${t}; transition: none;">keyboard_arrow_down</mat-icon>\n  `), e
}

function updatePinnedChatsVisibility() {
  const e = findPinnedChats(),
    t = document.getElementById("sg-pinned-section-content");
  t ? (pinnedSectionExpanded ? t.classList.add("expanded") : t.classList.remove("expanded"), e.forEach(e => {
    e.querySelectorAll("a, button, [tabindex]").forEach(e => {
      pinnedSectionExpanded ? void 0 !== e.dataset.originalTabIndex ? e.setAttribute("tabindex", e.dataset.originalTabIndex) : e.removeAttribute("tabindex") : (e.hasAttribute("tabindex") && "-1" !== e.getAttribute("tabindex") && void 0 === e.dataset.originalTabIndex && (e.dataset.originalTabIndex = e.getAttribute("tabindex")), e.setAttribute("tabindex", "-1"))
    }), e.classList.remove("sg-pinned-chat-hidden"), e.classList.remove("sg-pinned-chat-visible")
  })) : e.forEach(e => {
    const t = e.querySelectorAll("a, button, [tabindex]");
    pinnedSectionExpanded ? (e.classList.remove("sg-pinned-chat-hidden"), e.classList.add("sg-pinned-chat-visible"), t.forEach(e => {
      void 0 !== e.dataset.originalTabIndex ? e.setAttribute("tabindex", e.dataset.originalTabIndex) : e.removeAttribute("tabindex")
    })) : (e.classList.remove("sg-pinned-chat-visible"), e.classList.add("sg-pinned-chat-hidden"), t.forEach(e => {
      e.hasAttribute("tabindex") && "-1" !== e.getAttribute("tabindex") && void 0 === e.dataset.originalTabIndex && (e.dataset.originalTabIndex = e.getAttribute("tabindex")), e.setAttribute("tabindex", "-1")
    }))
  });
  const n = document.querySelector("#sg-pinned-section-header .sg-pinned-chevron");
  n && (n.style.transform = pinnedSectionExpanded ? "rotate(0deg)" : "rotate(-90deg)")
}
async function togglePinnedSection() {
  pinnedSectionExpanded = !pinnedSectionExpanded, updatePinnedChatsVisibility(), await savePinnedSectionState()
}

function injectPinnedSectionHeader() {
  const e = isNewestGeminiUi();
  if (e) {
    const e = document.getElementById("sg-pinned-section-wrapper");
    if (e) return relocatePinnedChatsIntoWrapper(e), updatePinnedChatsVisibility(), !0
  } else if (document.getElementById("sg-pinned-section-header")) return !0;
  const t = findPinnedChats();
  if (0 === t.length) return !1;
  const n = createPinnedSectionHeader();
  if (applyGeminiUiVariantClass(n), e) {
    const e = findNewestRecentsSection();
    if (!e) return !1;
    const t = document.createElement("div");
    t.id = "sg-pinned-section-wrapper", t.className = "sg-pinned-section-wrapper sg-newest-ui", e.container.insertBefore(t, e.recentsSection), t.appendChild(n);
    const o = document.createElement("div");
    o.id = "sg-pinned-section-content", o.className = "sg-pinned-section-content" + (pinnedSectionExpanded ? " expanded" : "");
    const r = document.createElement("div");
    r.className = "sg-pinned-section-content-inner", o.appendChild(r), t.appendChild(o), relocatePinnedChatsIntoWrapper(t), attachPinnedWrapperReclaimObserver(t)
  } else {
    const e = t[0];
    if (!e) return !1;
    e.parentNode.insertBefore(n, e)
  }
  return n.addEventListener("click", togglePinnedSection), n.addEventListener("keydown", e => {
    "Enter" !== e.key && " " !== e.key || (e.preventDefault(), togglePinnedSection())
  }), n.addEventListener("mouseenter", () => {
    n.classList.contains("sg-newest-ui") || (n.style.background = getThemeColors().sidebarHover)
  }), n.addEventListener("mouseleave", () => {
    n.classList.contains("sg-newest-ui") || (n.style.background = "transparent")
  }), updatePinnedChatsVisibility(), updateTheme(), !0
}

function removePinnedSectionHeader() {
  const e = document.getElementById("sg-pinned-section-wrapper");
  if (e) {
    const t = domQuery("conversationsList"),
      n = t?.querySelector("mat-nav-list") || t,
      o = e.querySelectorAll('gem-nav-list-item[data-test-id="conversation"]');
    if (n && o.length) {
      const e = n.firstChild;
      o.forEach(t => n.insertBefore(t, e))
    }
    e.remove()
  }
  const t = document.getElementById("sg-pinned-section-header");
  t && t.remove();
  findPinnedChats().forEach(e => {
    e.classList.remove("sg-pinned-chat-hidden"), e.classList.remove("sg-pinned-chat-visible")
  }), sgClearStalePinnedMarks([])
}
async function initCollapsiblePinnedChats() {
  const e = await new Promise(e => {
    sgSyncGetCached(["extensionEnabled", "collapsiblePinnedEnabled"], e)
  });
  if (!1 === e.extensionEnabled) return;
  if (!1 === e.collapsiblePinnedEnabled) return;
  await loadPinnedSectionState();
  if (!injectPinnedSectionHeader()) {
    let e = 0;
    const t = 20,
      n = setInterval(() => {
        e++, (injectPinnedSectionHeader() || e >= t) && clearInterval(n)
      }, 500)
  }
  if (!pinnedChatsObserver) {
    pinnedChatsObserver = new MutationObserver(sgRafCoalesce(() => {
      const e = isNewestGeminiUi() ? document.getElementById("sg-pinned-section-wrapper") : null;
      if (e && relocatePinnedChatsIntoWrapper(e), document.getElementById("sg-pinned-section-header")) {
        const e = findPinnedChats();
        sgClearStalePinnedMarks(e), 0 === e.length ? removePinnedSectionHeader() : pinnedSectionExpanded || e.forEach(e => {
          e.classList.contains("sg-pinned-chat-hidden") || (e.classList.remove("sg-pinned-chat-visible"), e.classList.add("sg-pinned-chat-hidden"))
        })
      } else {
        findPinnedChats().length > 0 && injectPinnedSectionHeader()
      }
    }));
    const e = domQuery("conversationsList"),
      t = document.querySelector(".sidenav-with-history-container infinite-scroller") || document.querySelector("side-navigation-content infinite-scroller") || document.querySelector("bard-sidenav infinite-scroller") || e;
    t && pinnedChatsObserver.observe(t, {
      childList: !0,
      subtree: !0
    })
  }
}
(() => {
  const _sgCollapsiblePinnedMsg = (e, t, n) => {
    if ("ENABLE_COLLAPSIBLE_PINNED" === e.type) initCollapsiblePinnedChats();
    else if ("DISABLE_COLLAPSIBLE_PINNED" === e.type) removePinnedSectionHeader(), pinnedChatsObserver && (pinnedChatsObserver.disconnect(), pinnedChatsObserver = null), _sgPinnedWrapperReclaimObserver && (_sgPinnedWrapperReclaimObserver.disconnect(), _sgPinnedWrapperReclaimObserver = null);
    return !1;
  };
  if ("undefined" != typeof SG && SG.messages) {
    SG.messages.onMatcher("legacy:collapsible-pinned", () => !0, _sgCollapsiblePinnedMsg);
  } else if ("undefined" != typeof chrome && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener(_sgCollapsiblePinnedMsg);
  }
})();
SG_IS_SILENT_BG_WORKER_TAB || setTimeout(initCollapsiblePinnedChats, 1500);
let _sgDragChatInProgress = !1,
  _sgDragChatListenersAttached = !1,
  _sgDragChatDropAttached = !1,
  _sgDragChatToInputActive = !1,
  _sgFolderDragActive = !1,
  _sgDragChatPendingCount = 0,
  _sgDragChatDoneCount = 0,
  _sgDragChatTotalCount = 0,
  _sgDragChatAborted = !1,
  _sgAttachChain = Promise.resolve(),
  _sgDragChatActiveIds = new Set;

function showDragAttachIndicator(e) {
  removeDragAttachIndicator();
  const t = document.querySelector("input-area-v2") || domQuery("inputAreaContainer");
  if (!t || !t.parentElement) return;
  const n = document.createElement("div");
  n.id = "sg-drag-attach-indicator";
  n.className = "sg-drag-attach-indicator";

  const spinner = document.createElement("div");
  spinner.className = "sg-drag-attach-ind-spinner";

  const textSpan = document.createElement("span");
  textSpan.className = "sg-drag-attach-ind-text";
  textSpan.textContent = String(e || "");

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "sg-drag-attach-ind-cancel";
  cancelBtn.title = "Cancel all attachments";
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("width", "16");
  svg.setAttribute("height", "16");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2.5");
  const path = document.createElementNS(svgNS, "path");
  path.setAttribute("d", "M18 6L6 18M6 6l12 12");
  svg.appendChild(path);
  cancelBtn.appendChild(svg);
  cancelBtn.addEventListener("click", () => {
    _sgCancelAllDragAttach();
  });

  n.appendChild(spinner);
  n.appendChild(textSpan);
  n.appendChild(cancelBtn);
  t.parentElement.insertBefore(n, t);
  _sgDisableSendButton(!0);
}

function updateDragAttachIndicator(e) {
  const t = document.querySelector("#sg-drag-attach-indicator .sg-drag-attach-ind-text");
  t && (t.textContent = e)
}

function removeDragAttachIndicator() {
  const e = document.getElementById("sg-drag-attach-indicator");
  e && e.remove(), _sgDisableSendButton(!1)
}

function _sgDisableSendButton(e) {
  const t = DOM.sendButton;
  t && (e ? (t.dataset.sgDisabledByDrag = "true", t.disabled = !0, t.style.pointerEvents = "none", t.style.opacity = "0.4") : (delete t.dataset.sgDisabledByDrag, t.disabled = !1, t.style.pointerEvents = "", t.style.opacity = ""))
}

function _sgCancelAllDragAttach() {
  _sgDragChatAborted = !0, _sgDragChatInProgress = !1, _sgDragChatPendingCount = 0, _sgDragChatDoneCount = 0, _sgDragChatTotalCount = 0, _sgDragChatActiveIds.clear(), _sgAttachChain = Promise.resolve(), _sgRestoreFilePicker(), removeDragAttachIndicator(), sgSafeSendMessage({
    type: "ABORT_SCRAPE_CHAT"
  }), showToast("Chat attachment cancelled.", "info")
}

function _sgUpdateDragProgress() {
  if (!_sgDragChatAborted)
    if (_sgDragChatPendingCount <= 0) {
      const e = _sgDragChatDoneCount;
      _sgDragChatInProgress = !1, _sgDragChatDoneCount = 0, _sgDragChatTotalCount = 0, _sgDragChatActiveIds.clear(), _sgRestoreFilePicker(), removeDragAttachIndicator(), e > 0 && showToast(`${e} chat(s) attached as PDF.`, "success")
    } else updateDragAttachIndicator(`Attaching chats... (${_sgDragChatDoneCount}/${_sgDragChatTotalCount})`)
}
let _sgFilePickerBlocked = !1;

function _sgBlockFilePicker() {
  _sgFilePickerBlocked || (_sgFilePickerBlocked = !0, document.body.setAttribute("data-sg-block-file-picker", "true"))
}

function _sgRestoreFilePicker() {
  _sgFilePickerBlocked && (_sgFilePickerBlocked = !1, document.body.removeAttribute("data-sg-block-file-picker"))
}

function showDragAttachOverlay(e) {
  showDragAttachIndicator(e)
}

function updateDragAttachOverlay(e) {
  updateDragAttachIndicator(e)
}

function removeDragAttachOverlay() {
  const e = document.getElementById("sg-drag-attach-overlay");
  e && e.remove(), removeDragAttachIndicator()
}

function setupSidebarChatDragListeners() {
  document.querySelectorAll('gem-nav-list-item[data-test-id="conversation"], .conversation').forEach(e => {
    e.dataset.sgDragChat || (e.dataset.sgDragChat = "true", e.setAttribute("draggable", "true"), e.addEventListener("dragstart", t => {
      if (!_sgDragChatToInputActive && !_sgFolderDragActive) return;
      let n = (e.getAttribute("jslog") || "").match(/"c_([a-z0-9]+)"/i),
        o = n ? n[1] : "";
      if (!o) {
        const t = e.querySelector("[jslog]");
        n = (t?.getAttribute("jslog") || "").match(/"c_([a-z0-9]+)"/i), o = n ? n[1] : ""
      }
      if (!o) {
        const t = e.querySelector('a[href*="/app/"]');
        o = t ? (t.getAttribute("href") || "").split("/app/").pop().split(/[?#]/)[0] : ""
      }
      if (!o) return void t.preventDefault();
      o = sgNormalizeChatId(o);
      const r = e.querySelector(".conversation-title, .title-text"),
        s = r && r.textContent.trim() || e.querySelector('a[href*="/app/"]')?.getAttribute("aria-label")?.trim() || e.querySelector("p, span")?.textContent?.trim() || "Untitled Chat",
        a = getAccountAwareUrl(o);
      if (t.dataTransfer.setData("application/x-sg-chat-drag", JSON.stringify({
          chatId: o,
          chatTitle: s,
          chatUrl: a
        })), t.dataTransfer.setData("text/plain", s), t.dataTransfer.effectAllowed = "copy", e.classList.add("sg-chat-dragging"), _sgDragChatToInputActive) {
        const e = domQuery("inputAreaContainer");
        e && e.classList.add("sg-input-drop-target")
      }
      _sgFolderDragActive && document.body.classList.add("sg-folder-chat-drag")
    }), e.addEventListener("dragend", () => {
      e.classList.remove("sg-chat-dragging");
      const t = domQuery("inputAreaContainer");
      t && t.classList.remove("sg-input-drop-target"), sgFolderChatDragEnd()
    }))
  }), _sgDragChatListenersAttached = !0
}

function setupInputAreaDropTarget() {
  const e = domQuery("inputAreaContainer");
  e && !e.dataset.sgDropTarget && (e.dataset.sgDropTarget = "true", e.addEventListener("dragover", e => {
    _sgDragChatToInputActive && e.dataTransfer.types.includes("application/x-sg-chat-drag") && (e.preventDefault(), e.dataTransfer.dropEffect = "copy")
  }), e.addEventListener("drop", t => {
    if (e.classList.remove("sg-input-drop-target"), !_sgDragChatToInputActive) return;
    const n = t.dataTransfer.getData("application/x-sg-chat-drag");
    if (n) {
      t.preventDefault(), t.stopPropagation();
      try {
        handleChatDropOnInput(JSON.parse(n))
      } catch (e) {
        console.error("[Gemini Power Suite] Failed to parse drag chat data:", e)
      }
    }
  }), _sgDragChatDropAttached = !0)
}
async function handleChatDropOnInput({
  chatId: e,
  chatTitle: t,
  chatUrl: n
}) {
  _sgDragChatActiveIds.has(e) ? showToast(`"${t}" is already being attached.`, "info") : (_sgDragChatActiveIds.add(e), _sgDragChatPendingCount++, _sgDragChatTotalCount++, _sgDragChatAborted = !1, _sgDragChatInProgress ? updateDragAttachIndicator(`Attaching chats... (${_sgDragChatDoneCount}/${_sgDragChatTotalCount})`) : (_sgDragChatInProgress = !0, _sgDragChatDoneCount = 0, _sgBlockFilePicker(), showDragAttachIndicator(`Attaching chats... (0/${_sgDragChatTotalCount})`)), _startScrapeAndAttach(e, t, n))
}
async function _startScrapeAndAttach(e, t, n) {
  try {
    let o = null,
      r = t;
    const s = getCurrentChatId();
    if (e === s || `c_${e}` === s || s === e.replace("c_", "")) {
      o = getChatHistory();
      const e = findActiveChatInfo();
      e?.title && (r = e.title)
    } else {
      const s = await new Promise(o => {
        sgSafeSendMessage({
          type: "SCRAPE_CHAT_CONTENT",
          chatUrl: n,
          chatId: e,
          chatTitle: t
        }, (e, err) => {
          o(e || {
            success: !1,
            error: err || "No response from background"
          })
        })
      });
      if (_sgDragChatAborted) return;
      if (!s.success) return console.error("[SG DragAttach] Scrape failed:", s.error), showToast(`Failed to load "${t}": ${s.error}`, "error"), _sgDragChatPendingCount--, _sgDragChatDoneCount++, _sgDragChatActiveIds.delete(e), void _sgUpdateDragProgress();
      o = s.history, s.title && (r = s.title)
    }
    if (_sgDragChatAborted) return;
    if (!o || 0 === o.length) return showToast(`"${r}" has no messages to export.`, "error"), _sgDragChatPendingCount--, _sgDragChatDoneCount++, _sgDragChatActiveIds.delete(e), void _sgUpdateDragProgress();
    const a = await generatePdfBlob(r, o, {
      stripWatermark: !0,
      systemPrompt: "SYSTEM INSTRUCTION: This PDF contains a referenced conversation. Treat it as conversational context — not as a document to summarize. Use this conversation history to inform your responses. Do not mention that this is a PDF or an exported file."
    });
    if (!a || _sgDragChatAborted) return _sgDragChatPendingCount--, _sgDragChatDoneCount++, _sgDragChatActiveIds.delete(e), void _sgUpdateDragProgress();
    _sgAttachChain = _sgAttachChain.then(async () => {
      _sgDragChatAborted || (updateDragAttachIndicator(`Attaching "${r}"... (${_sgDragChatDoneCount}/${_sgDragChatTotalCount})`), await attachPdfToInput(a, r), _sgDragChatPendingCount--, _sgDragChatDoneCount++, _sgDragChatActiveIds.delete(e), _sgUpdateDragProgress())
    }).catch(t => {
      console.error("[SG DragAttach] Attachment error:", t), _sgDragChatPendingCount--, _sgDragChatDoneCount++, _sgDragChatActiveIds.delete(e), _sgUpdateDragProgress()
    })
  } catch (n) {
    console.error("[SG DragAttach] Unexpected error for", t, n), showToast(`Failed to attach "${t}".`, "error"), _sgDragChatPendingCount--, _sgDragChatDoneCount++, _sgDragChatActiveIds.delete(e), _sgUpdateDragProgress()
  }
}

function ensureAttachMenuHideStyle() {
  if (document.getElementById("sg-attach-menu-hide-style")) return;
  const e = document.createElement("style");
  e.id = "sg-attach-menu-hide-style", e.textContent = '\n    body.sg-hiding-attach-menu .cdk-overlay-pane:has([data-test-id="local-images-files-uploader-button"]),\n    body.sg-hiding-attach-menu .cdk-overlay-pane:has(images-files-uploader),\n    body.sg-hiding-attach-menu .cdk-overlay-pane:has(uploader) {\n      opacity: 0 !important;\n    }\n  ', (document.head || document.documentElement).appendChild(e)
}
async function attachPdfToInput(e, t) {
  const n = (t || "Chat").replace(/[^a-zA-Z0-9_\- ]/g, "_").substring(0, 50).trim(),
    o = new File([e], `${n}.pdf`, {
      type: "application/pdf"
    });
  _sgBlockFilePicker();
  const a = () => document.body.classList.remove("sg-hiding-attach-menu");
  let i = null;
  try {
    const r = [
      'button[aria-label="Open upload file menu"]',
      'button[aria-label="Open input area menu to select tools and upload types"]',
      'button[aria-label="More options for input"]',
      'button[aria-label="Upload & tools"]',
      'button[aria-label*="Uploads and tools" i]',
      'button[aria-label*="Upload & tools" i]',
      'button[aria-label*="Upload and tools" i]',
      'button[aria-label*="Add file" i]',
      'button[aria-label*="Upload file" i]',
      'button[aria-label*="Nội dung tải lên" i]',
      'button[data-test-id="uploader-button"]',
      'button[data-test-id="input-area-menu-button"]',
      'button.upload-card-button',
      'button[aria-label*="tải tệp" i]',
      'button[aria-label*="trình đơn" i]'
    ];
    let s = null;
    for (const e of r)
      if (s = document.querySelector(e), s) break;
    if (!s) {
      const e = domQuery("inputAreaContainer");
      const btnSel = 'button:has(mat-icon[fonticon="plus"]), button:has(mat-icon[fonticon="add"]), button:has(mat-icon[data-mat-icon-name="plus"]), button:has(mat-icon[data-mat-icon-name="add"])';
      s = e && e.querySelector(btnSel) || document.querySelector(btnSel)
    }
    if (!s) return console.error("[SG DragAttach] Upload menu button not found!"), await attachPdfFallbackDownload(e, n);
    ensureAttachMenuHideStyle(), document.body.classList.add("sg-hiding-attach-menu");
    i = setTimeout(a, 5e3);
    s.click(), await new Promise(e => setTimeout(e, 250));
    const l = [
      'gem-menu-item[data-test-id="local-images-files-uploader-button"], [role="menuitem"][data-test-id="local-images-files-uploader-button"], button[data-test-id="local-images-files-uploader-button"]',
      '[data-test-id="local-images-files-uploader-button"]',
      'gem-menu-item:has(mat-icon[fonticon="attach_file"]), gem-menu-item:has(mat-icon[fonticon="attach_file_add"]), gem-menu-item:has(mat-icon[fonticon="upload_file"]), gem-menu-item:has(mat-icon[data-mat-icon-name="attach_file"]), gem-menu-item:has(mat-icon[data-mat-icon-name="upload_file"])',
      '[role="menuitem"]:has(mat-icon[fonticon="attach_file"]), [role="menuitem"]:has(mat-icon[fonticon="attach_file_add"]), [role="menuitem"]:has(mat-icon[fonticon="upload_file"]), [role="menuitem"]:has(mat-icon[data-mat-icon-name="attach_file"]), [role="menuitem"]:has(mat-icon[data-mat-icon-name="upload_file"])',
      'gem-menu-item[aria-label="Files" i], [role="menuitem"][aria-label="Files" i], gem-menu-item[aria-label="File" i], [role="menuitem"][aria-label="File" i]',
      'gem-menu-item[aria-label^="Upload file" i], button[aria-label^="Upload file" i], menu-item[aria-label="Upload files"], menu-item[aria-label^="Upload file" i], [role="menuitem"][aria-label^="Upload file" i]',
      'gem-menu-item[aria-label*="Add file" i], [role="menuitem"][aria-label*="Add file" i], button[aria-label*="Add file" i]',
      'gem-menu-item[aria-label*="Upload from" i], [role="menuitem"][aria-label*="Upload from" i], button[aria-label*="Upload from" i]',
      'gem-menu-item[aria-label*="Tải tệp" i], button[aria-label*="Tải tệp" i], menu-item[aria-label*="Tải tệp" i], [role="menuitem"][aria-label*="Tải tệp" i]',
      'images-files-uploader [role="menuitem"], images-files-uploader button'
    ];
    let c = null;
    for (const e of l) {
      const found = Array.from(document.querySelectorAll(e)).find(el => !el.closest("#sg-folder-upload-menu-item") && isFolderMenuElementVisible(el));
      if (found) {
        c = found;
        break
      }
    }
    if (!c) {
      const items = document.querySelectorAll('.cdk-overlay-pane gem-menu-item, .cdk-overlay-pane [role="menuitem"], .cdk-overlay-pane button, .cdk-overlay-pane menu-item, .mat-mdc-menu-panel button, [role="menu"] [role="menuitem"]');
      for (const item of items) {
        if (item.closest("#sg-folder-upload-menu-item") || !isFolderMenuElementVisible(item)) continue;
        const clone = item.cloneNode(!0);
        clone.querySelectorAll("mat-icon, gem-icon, svg, .cdk-visually-hidden").forEach(el => el.remove());
        const txt = (clone.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
        if (!txt || txt.includes("lựa chọn tải lên khác") || txt.includes("more upload") || txt.includes("other upload") || txt.includes("more options")) continue;
        if ("tệp" === txt || "file" === txt || "files" === txt || "local files" === txt || txt.includes("tải tệp") || txt.includes("upload file") || txt.includes("add file") || txt.includes("upload from computer") || txt.includes("upload from device") || txt.includes("choose file")) {
          c = item;
          break
        }
      }
    }
    if (!c) return console.error("[SG DragAttach] Upload files menu item not found!"), document.body.click(), await attachPdfFallbackDownload(e, n);
    c.click(), await new Promise(e => setTimeout(e, 400));
    const d = document.querySelector('input[type="file"][data-sg-intercepted="true"]') || document.querySelector('input[type="file"][name="Filedata"]') || Array.from(document.querySelectorAll('input[type="file"]')).find(el => el.id !== "sg-dir-input" && !el.hasAttribute("webkitdirectory") && !el.closest('[id^="sg-"]')) || null;
    if (!d) return console.error("[SG DragAttach] No file input found!"), await attachPdfFallbackDownload(e, n);
    const u = new DataTransfer;
    u.items.add(o), d.files = u.files, d.dispatchEvent(new Event("change", {
      bubbles: !0
    })), d.dispatchEvent(new Event("input", {
      bubbles: !0
    })), document.body.click(), clearTimeout(i), a(), await new Promise(e => setTimeout(e, 2e3)), d.hasAttribute("data-sg-intercepted") && d.removeAttribute("data-sg-intercepted");
    return !!(document.querySelector('mat-chip-row, [class*="attachment"], [class*="file-chip"], [class*="uploaded"], [data-test-id*="chip"], .input-chip') || d.files && d.files.length > 0) || (console.warn("[SG DragAttach] Could not verify attachment. Falling back to download."), await attachPdfFallbackDownload(e, n))
  } finally {
    _sgRestoreFilePicker();
    if (i) clearTimeout(i);
    a();
  }
}
async function attachPdfFallbackDownload(e, t) {
  try {
    const n = URL.createObjectURL(e),
      o = document.createElement("a");
    return o.href = n, o.download = `${t}.pdf`, document.body.appendChild(o), o.click(), document.body.removeChild(o), setTimeout(() => URL.revokeObjectURL(n), 5e3), showToast("PDF downloaded. Please attach it manually using the upload icon (+).", "info"), !1
  } catch (e) {
    return console.error("[SG DragAttach] PDF download fallback failed:", e), showToast("Failed to generate PDF. Please try again.", "error"), !1
  }
}

function teardownDragChatToInput() {
  _sgDragChatToInputActive = !1;
  const e = domQuery("inputAreaContainer");
  e && e.classList.remove("sg-input-drop-target"), removeDragAttachIndicator()
}

function initDragChatToInput() {
  sgSyncGetCached(["extensionEnabled", "dragChatToInputEnabled"], e => {
    !1 !== e.extensionEnabled && !1 !== e.dragChatToInputEnabled && (_sgDragChatToInputActive = !0, setupSidebarChatDragListeners(), setupInputAreaDropTarget())
  })
}
(() => {
  const _sgDragChatInputMsg = (e, t, n) => ("ENABLE_DRAG_CHAT_INPUT" === e.type ? (_sgDragChatToInputActive = !0, setupSidebarChatDragListeners(), setupInputAreaDropTarget()) : "DISABLE_DRAG_CHAT_INPUT" === e.type && teardownDragChatToInput(), !1);
  if ("undefined" != typeof SG && SG.messages) {
    SG.messages.onMatcher("legacy:drag-chat-input", () => !0, _sgDragChatInputMsg);
  } else if ("undefined" != typeof chrome && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener(_sgDragChatInputMsg);
  }
  sgObserverRegistry.registerUIRefresh("dragChatToInput", () => {
    (_sgDragChatToInputActive || _sgFolderDragActive) && (setupSidebarChatDragListeners(), _sgDragChatToInputActive && !_sgDragChatDropAttached && setupInputAreaDropTarget())
  });
  const _sgDragChatInputChanged = (e, t) => {
    "sync" === t && (void 0 === e.extensionEnabled && void 0 === e.dragChatToInputEnabled || sgSyncGetCached(["extensionEnabled", "dragChatToInputEnabled"], e => {
      const t = !1 !== e.extensionEnabled && !1 !== e.dragChatToInputEnabled;
      t && !_sgDragChatToInputActive ? (_sgDragChatToInputActive = !0, setupSidebarChatDragListeners(), setupInputAreaDropTarget()) : !t && _sgDragChatToInputActive && teardownDragChatToInput()
    }))
  };
  if ("undefined" != typeof SG && SG.storage) {
    SG.storage.onChanged("legacy:drag-chat-input-sync", _sgDragChatInputChanged, { area: "sync", keys: ["extensionEnabled", "dragChatToInputEnabled"] });
  } else if ("undefined" != typeof chrome && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener(_sgDragChatInputChanged);
  }
})();
SG_IS_SILENT_BG_WORKER_TAB || setTimeout(initDragChatToInput, 2e3);
const SG_FOLDER_SPRING_OPEN_MS = 650,
  SG_FOLDERS_NAV_SEL = '#sg-folders-menu-item, [data-test-id="sg-native-folders"]';
let sgFolderSpringTimer = null,
  sgFolderSpringOpened = !1,
  _sgFolderNavDropBound = !1;

function sgFolderNavFromDragEvent(e) {
  return _sgFolderDragActive && e.dataTransfer?.types?.includes("application/x-sg-chat-drag") && e.target?.closest?.(SG_FOLDERS_NAV_SEL) || null
}

function sgCancelFolderSpringOpen() {
  sgFolderSpringTimer && (clearTimeout(sgFolderSpringTimer), sgFolderSpringTimer = null)
}

function sgClearFolderNavHighlight() {
  document.querySelectorAll(".sg-folder-nav-drop-target").forEach(e => e.classList.remove("sg-folder-nav-drop-target"))
}

function sgFolderChatDragEnd() {
  sgCancelFolderSpringOpen(), sgFolderSpringOpened = !1, sgClearFolderNavHighlight(), document.body.classList.remove("sg-folder-chat-drag")
}

function setupFolderNavDropTarget() {
  _sgFolderNavDropBound || (_sgFolderNavDropBound = !0, document.addEventListener("dragover", e => {
    const t = sgFolderNavFromDragEvent(e);
    t && (e.preventDefault(), e.stopPropagation(), t.classList.add("sg-folder-nav-drop-target"), sgFolderSpringTimer || sgFolderSpringOpened || document.querySelector(".sg-folders-modal") || (sgFolderSpringTimer = setTimeout(() => {
      sgFolderSpringTimer = null, sgFolderSpringOpened = !0, sgClearFolderNavHighlight(), showFoldersModal()
    }, 650)))
  }, !0), document.addEventListener("dragleave", e => {
    const t = sgFolderNavFromDragEvent(e);
    if (!t) return;
    if (e.relatedTarget && t.contains(e.relatedTarget)) return;
    const n = t.getBoundingClientRect();
    !e.relatedTarget && e.clientX > n.left && e.clientX < n.right && e.clientY > n.top && e.clientY < n.bottom || (t.classList.remove("sg-folder-nav-drop-target"), sgCancelFolderSpringOpen())
  }, !0), document.addEventListener("drop", e => {
    if (!sgFolderNavFromDragEvent(e)) return;
    e.preventDefault(), e.stopPropagation();
    const t = sgFolderSpringOpened;
    if (sgFolderChatDragEnd(), t || document.querySelector(".sg-folders-modal")) return;
    let n = null;
    try {
      n = JSON.parse(e.dataTransfer.getData("application/x-sg-chat-drag"))
    } catch (e) {
      return
    }
    n?.chatId && sgRequireDataReady() && showAddToFolderMenu(null, n.chatId, n.chatTitle, n.chatUrl)
  }, !0))
}

function sgSetFolderDragActive(e) {
  _sgFolderDragActive = e, e ? (setupSidebarChatDragListeners(), setupFolderNavDropTarget()) : sgFolderChatDragEnd()
}

function initFolderSidebarDrag() {
  sgSyncGetCached(["extensionEnabled", "foldersEnabled"], e => {
    sgSetFolderDragActive(!1 !== e.extensionEnabled && !1 !== e.foldersEnabled)
  })
}
(() => {
  const _sgFolderSidebarDragChanged = (e, t) => {
    "sync" === t && (void 0 === e.extensionEnabled && void 0 === e.foldersEnabled || initFolderSidebarDrag())
  };
  if ("undefined" != typeof SG && SG.storage) {
    SG.storage.onChanged("legacy:folder-sidebar-drag-sync", _sgFolderSidebarDragChanged, { area: "sync", keys: ["extensionEnabled", "foldersEnabled"] });
  } else if ("undefined" != typeof chrome && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener(_sgFolderSidebarDragChanged);
  }
})();
SG_IS_SILENT_BG_WORKER_TAB || (setTimeout(initFolderSidebarDrag, 2e3), setTimeout(() => {
  document.body && (sgObserverRegistry.registerUIRefresh("headerButtons", () => {
    injectHeaderButtons();
    updateTopActionsAutohideState();
  }), injectHeaderButtons())
}, 100));
let isExportButtonEnabled = !0,
  isInfoButtonEnabled = !0,
  isWideChatButtonEnabled = !0,
  isWideChatEnabled = !1;

function shouldApplyWideChat() {
  return !window.location.pathname.includes("/gems/")
}
let _wideChatScrollAnchorRAF = null;

function updateWideChatClass() {
  const e = isWideChatEnabled && shouldApplyWideChat();
  if (e === document.body.classList.contains("sg-wide-chat")) return;
  const t = domQuery("chatHistory");
  let n = null,
    o = 0;
  if (t) {
    const e = Array.from(t.querySelectorAll(".conversation-container"));
    let r = -1,
      s = -1;
    for (let t = 0; t < e.length; t++) {
      const n = e[t].getBoundingClientRect();
      if (n.bottom > 0 && n.top < window.innerHeight) - 1 === r && (r = t), s = t;
      else if (-1 !== r) break
    } - 1 === r && (r = 0, s = Math.min(e.length - 1, 9));
    const a = Math.max(0, r - 5),
      i = Math.min(e.length - 1, s + 5);
    for (let t = a; t <= i; t++) e[t].classList.add("sg-animate-wide");
    const l = t.querySelectorAll("user-query, model-response");
    for (const e of l) {
      const t = e.getBoundingClientRect();
      if (t.bottom > 0) {
        n = e, o = t.top;
        break
      }
    }
  }
  if (e ? document.body.classList.add("sg-wide-chat") : document.body.classList.remove("sg-wide-chat"), t && setTimeout(() => {
      t.querySelectorAll(".sg-animate-wide").forEach(e => e.classList.remove("sg-animate-wide"))
    }, 350), t && n) {
    _wideChatScrollAnchorRAF && cancelAnimationFrame(_wideChatScrollAnchorRAF);
    const e = performance.now(),
      r = 350;
    _wideChatScrollAnchorRAF = requestAnimationFrame(function s() {
      const a = n.getBoundingClientRect().top - o;
      Math.abs(a) > .5 && (t.scrollTop += a), _wideChatScrollAnchorRAF = performance.now() - e < r ? requestAnimationFrame(s) : null
    })
  }
}

function updateOfflineIcon() {
  const e = document.getElementById("sg-offline-icon");
  navigator.onLine ? e && e.remove() : e || injectOfflineIcon()
}

function injectOfflineIcon() {
  const e = document.querySelector("top-bar-actions");
  if (!e) return;
  if (document.getElementById("sg-offline-icon")) return;
  const t = document.createElement("button");
  t.id = "sg-offline-icon", t.title = "You are offline. Some features may be unavailable.", t.style.cssText = "\n    display: flex;\n    align-items: center;\n    justify-content: center;\n    width: 40px;\n    height: 40px;\n    border-radius: 50%;\n    background: transparent;\n    border: none;\n    color: #f28b82;\n    cursor: help;\n    margin-left: 80px;\n    margin-top: 4px;\n    animation: sg-pulse 2s ease-in-out infinite;\n  ",sgSetSafeHtml(t, '\n    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">\n      <path d="M23.64 7c-.45-.34-4.93-4-11.64-4-1.5 0-2.89.19-4.15.48L18.18 13.8 23.64 7zM3.41 1.31L2 2.72l2.05 2.06C1.91 5.76.59 6.82.36 7l11.63 14.49.01.01.01-.01 3.9-4.86 3.32 3.32 1.41-1.41L3.41 1.31zM12 18.93l-8.47-10.5c.45-.35 1.1-.76 1.9-1.16L12 13.75l.01-.01 2.02 2.02L12 18.93z"/>\n    </svg>\n  '), e.insertBefore(t, e.firstChild)
}

function ensureOfflineStyles() {
  if (document.getElementById("sg-offline-styles")) return;
  const e = document.createElement("style");
  e.id = "sg-offline-styles", e.textContent = "\n    @keyframes sg-pulse {\n      0%, 100% { opacity: 1; }\n      50% { opacity: 0.5; }\n    }\n  ", document.head.appendChild(e)
}

function isOnGeminiChatPage() {
  return /^\/(?:u\/\d+\/)?(?:app|gem\/[^/]+)(?:\/|$)/.test(window.location.pathname)
}

function isOnNewChatLanding() {
  return /^\/(?:u\/\d+\/)?app\/?$/.test(window.location.pathname)
}

function isOnGemLanding() {
  return /^\/(?:u\/\d+\/)?gem\/[^/]+\/?$/.test(window.location.pathname)
}

function hideNewChatGreeting() {
  if (!isExtensionEnabled || !isOnNewChatLanding()) return;
  if (document.querySelector("user-query, model-response")) return;

  const composerAnchor = document.querySelector("input-container") || document.querySelector("input-area-v2");
  if (!composerAnchor) return;

  const composerRect = composerAnchor.getBoundingClientRect();
  if (0 === composerRect.width && 0 === composerRect.height) return;

  const chatScope = document.querySelector("chat-window") || document.querySelector("main") || document.body;

  const isExcluded = e => {
    if (!e || !(e instanceof Element)) return true;
    return !!e.closest('bard-sidenav, side-navigation-v2, top-bar-actions, header, input-container, input-area-v2, [id^="sg-"], [class*="sg-"], dialog, [role="dialog"], mat-dialog-container, .cdk-overlay-pane');
  };

  const isInteractive = e => {
    if (!e || !(e instanceof Element)) return true;
    if (e.matches('button, a, input, textarea, select, [contenteditable="true"], [role="button"]')) return true;
    return !!e.querySelector('button, a, input, textarea, select, [contenteditable="true"], [role="button"]');
  };

  let newlyTagged = false;
  const tagGreeting = e => {
    if (!e || isExcluded(e) || isInteractive(e) || e.contains(composerAnchor)) return;
    if (e.getAttribute("data-sg-hidden-greeting") !== "true") {
      e.setAttribute("data-sg-hidden-greeting", "true");
      newlyTagged = true;
    }
  };

  let prev = composerAnchor.previousElementSibling;
  while (prev) {
    if (!isExcluded(prev) && !isInteractive(prev) && !prev.contains(composerAnchor)) {
      const text = (prev.textContent || "").trim();
      if (text.length > 0) {
        tagGreeting(prev);
      }
    }
    prev = prev.previousElementSibling;
  }

  if (composerAnchor.parentElement && composerAnchor.parentElement !== chatScope && !isExcluded(composerAnchor.parentElement)) {
    let parentPrev = composerAnchor.parentElement.previousElementSibling;
    while (parentPrev) {
      if (!isExcluded(parentPrev) && !isInteractive(parentPrev) && !parentPrev.contains(composerAnchor)) {
        const text = (parentPrev.textContent || "").trim();
        if (text.length > 0) {
          tagGreeting(parentPrev);
        }
      }
      parentPrev = parentPrev.previousElementSibling;
    }
  }

  const headings = chatScope.querySelectorAll('h1, h2, [role="heading"], [data-test-id*="greeting"], [class*="greeting"]');
  for (const h of headings) {
    if (isExcluded(h) || isInteractive(h) || h.contains(composerAnchor)) continue;
    const hRect = h.getBoundingClientRect();
    if (hRect.top < composerRect.top || (0 === hRect.height && "true" === h.getAttribute("data-sg-hidden-greeting"))) {
      tagGreeting(h);
      const parent = h.parentElement;
      if (parent && parent !== chatScope && !isExcluded(parent) && !isInteractive(parent) && !parent.contains(composerAnchor)) {
        tagGreeting(parent);
      }
    }
  }

  if (newlyTagged) {
    requestAnimationFrame(() => {
      "function" == typeof updateButtonPosition && updateButtonPosition();
      "function" == typeof updateCounterPosition && updateCounterPosition();
    });
  }
}

sgObserverRegistry.registerUIRefresh("hideNewChatGreeting", () => {
  if (isExtensionEnabled && isOnNewChatLanding()) {
    hideNewChatGreeting();
  }
});

SG_IS_SILENT_BG_WORKER_TAB || setTimeout(() => {
  if (isExtensionEnabled && isOnNewChatLanding()) {
    hideNewChatGreeting();
  }
}, 50);


function injectHeaderButtons() {
  const e = document.querySelector("top-bar-actions");
  if (!e) return;
  if (isNewestGeminiUi() && !isOnGeminiChatPage()) {
    const e = document.getElementById("sg-header-buttons-container");
    return void(e && e.remove())
  }
  const t = isBookmarksEnabled && sgGetChatBookmarks(getCurrentChatId()).length > 0;
  if (!(isWideChatButtonEnabled || isExportButtonEnabled || isInfoButtonEnabled || t)) {
    const e = document.getElementById("sg-header-buttons-container");
    return e && e.remove(), sgHideBookmarkMenu(), void(isWideChatEnabled && (isWideChatEnabled = !1, document.body.classList.remove("sg-wide-chat"), chrome.storage.sync.set({
      wideChatEnabled: !1
    })))
  }
  if (!document.getElementById("sg-header-buttons-container") && "unknown" === getGeminiUiVariant()) return;
  const n = e.querySelector("div.top-bar-actions"),
    o = n ? n.querySelector(".right-section") : null,
    r = o || e;
  o && o.firstElementChild;
  let s = document.getElementById("sg-header-buttons-container");
  s ? s.classList.toggle("sg-newest-ui", isNewestGeminiUi()) : (s = document.createElement("div"), s.id = "sg-header-buttons-container", s.className = "buttons-container", s.classList.toggle("sg-newest-ui", isNewestGeminiUi()), s.style.cssText = "display: flex; align-items: center; gap: 0px;", r.appendChild(s)), s.classList.toggle("sg-new-chat", isOnNewChatLanding());
  const a = o ? o.querySelector(".adv-upsell") : null;
  if (a && (a.querySelector("upsell-button") || a.querySelector(".gds-upsell-button") || a.textContent.includes("Upgrade"))) {
    const e = a.nextSibling;
    s.previousSibling !== a && r.insertBefore(s, e)
  } else {
    const e = o ? o.querySelector(".buttons-container:not(#sg-header-buttons-container)") : null;
    e && s.nextSibling !== e && e !== s && r.insertBefore(s, e)
  }
  const i = "\n    display: flex;\n    align-items: center;\n    justify-content: center;\n    width: 40px;\n    height: 40px;\n    border-radius: 50%;\n    background: transparent;\n    border: none;\n    color: var(--gem-sys-color--on-surface, #444746);\n    cursor: pointer;\n    transition: background 0.15s ease;\n  ",
    l = document.getElementById("sg-header-wide-btn");
  if (isWideChatButtonEnabled)
    if (l) l.classList.toggle("sg-wide-active", isWideChatEnabled);
    else {
      const e = document.createElement("button");
      e.id = "sg-header-wide-btn", e.className = "sg-header-btn" + (isWideChatEnabled ? " sg-wide-active" : ""), e.setAttribute("data-tooltip", "Toggle wide chat"), e.style.cssText = i,sgSetSafeHtml(e, '\n      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">\n        <path class="sg-arrow-left" d="M9 6l-5 6 5 6"/>\n        <path class="sg-arrow-right" d="M15 6l5 6-5 6"/>\n      </svg>\n    '), e.addEventListener("click", () => {
        isWideChatEnabled = !isWideChatEnabled, updateWideChatClass(), e.classList.toggle("sg-wide-active", isWideChatEnabled), chrome.storage.sync.set({
          wideChatEnabled: isWideChatEnabled
        })
      }), s.insertBefore(e, s.firstChild)
    }
  else l && l.remove(), isWideChatEnabled && (isWideChatEnabled = !1, document.body.classList.remove("sg-wide-chat"), chrome.storage.sync.set({
    wideChatEnabled: !1
  }));
  const c = document.getElementById("sg-header-export-btn");
  if (isExportButtonEnabled) {
    if (!c) {
      const e = document.createElement("button");
      e.id = "sg-header-export-btn", e.className = "sg-header-btn", e.setAttribute("data-tooltip", "Export chat"), e.style.cssText = i,sgSetSafeHtml(e, '\n        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">\n          <path d="M12 15.575q-.2 0-.375-.062-.175-.063-.325-.213l-3.6-3.6q-.3-.3-.288-.713.013-.412.288-.687.3-.3.713-.312.412-.013.687.262L11 12.15V5q0-.425.288-.713Q11.575 4 12 4q.425 0 .713.287Q13 4.575 13 5v7.15l1.9-1.9q.3-.3.713-.288.412.013.687.288.275.275.288.687.012.413-.288.713l-3.6 3.6q-.15.15-.325.213-.175.062-.375.062ZM6 20q-.825 0-1.413-.587Q4 18.825 4 18v-2q0-.425.287-.713Q4.575 15 5 15t.713.287Q6 15.575 6 16v2h12v-2q0-.425.288-.713Q18.575 15 19 15t.712.287Q20 15.575 20 16v2q0 .825-.587 1.413Q18.825 20 18 20Z" fill="currentColor"/>\n        </svg>\n        <span class="sg-header-glyph" aria-hidden="true">download</span>\n      '), e.addEventListener("click", e => {
        isOnGemLanding() ? showToast("Choose a conversation first", "info") : showExportPopup()
      });
      const t = document.getElementById("sg-header-info-btn");
      t ? s.insertBefore(e, t) : s.appendChild(e)
    }
  } else c && c.remove();
  const d = document.getElementById("sg-header-info-btn");
  if (isInfoButtonEnabled) {
    if (!d) {
      const e = document.createElement("button");
      e.id = "sg-header-info-btn", e.className = "sg-header-btn", e.setAttribute("data-tooltip", "Chat info"), e.style.cssText = i,sgSetSafeHtml(e, '\n        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">\n          <path d="M12 17q.425 0 .713-.288Q13 16.425 13 16v-4q0-.425-.287-.713Q12.425 11 12 11t-.712.287Q11 11.575 11 12v4q0 .425.288.712.287.288.712.288Zm0-8q.425 0 .713-.288Q13 8.425 13 8t-.287-.713Q12.425 7 12 7t-.712.287Q11 7.575 11 8t.288.712Q11.575 9 12 9Zm0 13q-2.075 0-3.9-.788-1.825-.787-3.175-2.137-1.35-1.35-2.137-3.175Q2 14.075 2 12t.788-3.9q.787-1.825 2.137-3.175 1.35-1.35 3.175-2.138Q9.925 2 12 2t3.9.787q1.825.788 3.175 2.138 1.35 1.35 2.137 3.175Q22 9.925 22 12t-.788 3.9q-.787 1.825-2.137 3.175-1.35 1.35-3.175 2.137Q14.075 22 12 22Zm0-2q3.35 0 5.675-2.325Q20 15.35 20 12q0-3.35-2.325-5.675Q15.35 4 12 4 8.65 4 6.325 6.325 4 8.65 4 12q0 3.35 2.325 5.675Q8.65 20 12 20Zm0-8Z" fill="currentColor"/>\n        </svg>\n        <span class="sg-header-glyph" aria-hidden="true">info</span>\n      '), e.addEventListener("click", () => {
        isOnGemLanding() ? showToast("Choose a conversation first", "info") : showInfoPopup()
      }), s.appendChild(e)
    }
  } else d && d.remove();
  sgRefreshBookmarksHeaderButton(), 0 === s.children.length && s.remove(), updateTopActionsAutohideState();
}

function showExportPopup() {
  const e = document.getElementById("sg-export-popup-overlay");
  e && e.remove();
  const t = document.createElement("div");
  t.className = "sg-export-popup", t.style.cssText = '\n    background: var(--gem-sys-color--surface, #fff);\n    color: var(--gem-sys-color--on-surface, #1f1f1f);\n    width: 320px;\n    border-radius: 12px;\n    box-shadow: 0 4px 24px rgba(0,0,0,0.2);\n    display: flex;\n    flex-direction: column;\n    overflow: hidden;\n    transform: scale(0.95);\n    transition: transform 0.2s cubic-bezier(0.2, 0.0, 0, 1.0);\n    padding: 24px;\n    font-family: var(--sg-font-text); /* Fix font to match UI */\n  ', document.body.classList.contains("dark-theme") && (t.style.background = "#1e1f20", t.style.color = "#e3e3e3");
  const {
    overlay: n,
    close: o
  } = createModalOverlay({
    id: "sg-export-popup-overlay",
    zIndex: 2101,
    onClose: () => {
      t.style.transform = "scale(0.95)"
    }
  }), r = document.createElement("div");
  r.style.cssText = "\n    display: flex;\n    align-items: center;\n    justify-content: space-between;\n    margin-bottom: 20px;\n  ";
  const s = document.createElement("h3");
  s.textContent = "Export Chat", s.style.cssText = "\n    margin: 0;\n    font-size: 1.25rem;\n    font-weight: 500;\n    display: flex;\n    align-items: center;\n    gap: 8px;\n  ";
  const a = document.createElement("button");
  a.title = "Copy chat to clipboard",sgSetSafeHtml(a, '\n    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">\n      <path d="M9 18q-.825 0-1.412-.587Q7 16.825 7 16V4q0-.825.588-1.413Q8.175 2 9 2h9q.825 0 1.413.587Q20 3.175 20 4v12q0 .825-.587 1.413Q18.825 18 18 18Zm0-2h9V4H9v12Zm-4 6q-.825 0-1.412-.587Q3 20.825 3 20V7q0-.425.288-.713Q3.575 6 4 6t.713.287Q5 6.575 5 7v13h10q.425 0 .713.287.287.288.287.713 0 .425-.287.712Q15.425 22 15 22Z"/>\n    </svg>\n  '), a.style.cssText = "\n    background: transparent;\n    border: none;\n    color: inherit;\n    cursor: pointer;\n    width: 32px;\n    height: 32px;\n    padding: 0;\n    border-radius: 50%;\n    display: flex;\n    align-items: center;\n    justify-content: center;\n    opacity: 0.7;\n    transition: background 0.2s, opacity 0.2s;\n  ", a.addEventListener("mouseenter", () => {
    a.style.opacity = "1", a.style.background = "var(--gem-sys-color--surface-container-highest, rgba(60, 64, 67, 0.08))"
  }), a.addEventListener("mouseleave", () => {
    a.style.opacity = "0.7", a.style.background = "transparent"
  }), a.addEventListener("click", () => {
    const e = getChatHistory();
    if (0 === e.length) return showToast("Cannot copy empty chat", "error"), void o();
    const t = findActiveChatInfo(),
      n = t ? t.title : "Gemini Chat",
      r = (new Date).toLocaleString(),
      s = !!b.checked;
    let a = `${n}\nExported on: ${r}\n\n`;
    e.forEach(e => {
      const t = s && e.timestamp ? ` ${e.timestamp}` : "";
      a += `${e.role}${t}\n\n${e.text}\n\n`
    }), navigator.clipboard.writeText(a).then(() => {
      showToast("Chat copied to clipboard", "success"), o()
    }).catch(e => {
      console.error("Failed to copy text: ", e), showToast("Failed to copy chat", "error")
    })
  }), s.appendChild(a);
  const i = document.createElement("button");sgSetSafeHtml(i, '\n    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">\n      <path d="M18 6L6 18M6 6l12 12"></path>\n    </svg>\n  '), i.style.cssText = "\n    background: transparent;\n    border: none;\n    color: inherit;\n    cursor: pointer;\n    padding: 4px;\n    border-radius: 50%;\n    display: flex;\n    align-items: center;\n    justify-content: center;\n    opacity: 0.7;\n    transition: opacity 0.2s, background 0.2s;\n  ", i.addEventListener("mouseenter", () => {
    i.style.opacity = "1", i.style.background = "rgba(128,128,128,0.1)"
  }), i.addEventListener("mouseleave", () => {
    i.style.opacity = "0.7", i.style.background = "transparent"
  }), i.addEventListener("click", o), r.appendChild(s), r.appendChild(i), t.appendChild(r);
  const l = document.createElement("label");
  l.style.cssText = "\n    display: flex;\n    align-items: center;\n    gap: 8px;\n    margin-bottom: 0;\n    padding: 2px 4px;\n    cursor: pointer;\n    font-size: 1rem;\n    user-select: none;\n  ";
  const c = document.createElement("span");
  c.textContent = "Include Gemini thoughts", c.style.cssText = "flex: 1;";
  const d = document.createElement("span");
  d.style.cssText = "\n    position: relative;\n    display: inline-block;\n    width: 44px;\n    height: 24px;\n    flex-shrink: 0;\n  ";
  const u = document.createElement("input");
  u.type = "checkbox", u.id = "sg-export-include-thoughts", u.style.cssText = "opacity: 0; width: 0; height: 0; position: absolute;";
  const p = document.createElement("span");
  p.style.cssText = `\n    position: absolute;\n    inset: 0;\n    background-color: ${document.body.classList.contains("dark-theme")?"#5f6368":"#bdc1c6"};\n    border-radius: 24px;\n    transition: background-color 0.3s;\n  `;
  const g = document.createElement("span");
  g.style.cssText = "\n    position: absolute;\n    height: 18px;\n    width: 18px;\n    left: 3px;\n    bottom: 3px;\n    background-color: #fff;\n    border-radius: 50%;\n    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);\n    transition: transform 0.3s;\n  ", p.appendChild(g), d.appendChild(u), d.appendChild(p), l.appendChild(c), l.appendChild(d);
  const m = () => {
    const e = u.checked;
    p.style.background = e ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" : document.body.classList.contains("dark-theme") ? "#5f6368" : "#bdc1c6", g.style.transform = e ? "translateX(20px)" : "translateX(0)"
  };
  u.addEventListener("change", () => {
    m();
    try {
      chrome.storage.sync.set({
        sg_export_include_thoughts: u.checked
      })
    } catch (e) {}
  });
  const h = document.createElement("label");
  h.style.cssText = "\n    display: flex;\n    align-items: center;\n    gap: 8px;\n    margin-bottom: 0;\n    padding: 2px 4px;\n    cursor: pointer;\n    font-size: 1rem;\n    user-select: none;\n  ";
  const f = document.createElement("span");
  f.textContent = "Include timestamps", f.style.cssText = "flex: 1;";
  const y = document.createElement("span");
  y.style.cssText = "\n    position: relative;\n    display: inline-block;\n    width: 44px;\n    height: 24px;\n    flex-shrink: 0;\n  ";
  const b = document.createElement("input");
  b.type = "checkbox", b.id = "sg-export-include-timestamps", b.style.cssText = "opacity: 0; width: 0; height: 0; position: absolute;";
  const v = document.createElement("span");
  v.style.cssText = `\n    position: absolute;\n    inset: 0;\n    background-color: ${document.body.classList.contains("dark-theme")?"#5f6368":"#bdc1c6"};\n    border-radius: 24px;\n    transition: background-color 0.3s;\n  `;
  const x = document.createElement("span");
  x.style.cssText = "\n    position: absolute;\n    height: 18px;\n    width: 18px;\n    left: 3px;\n    bottom: 3px;\n    background-color: #fff;\n    border-radius: 50%;\n    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);\n    transition: transform 0.3s;\n  ", v.appendChild(x), y.appendChild(b), y.appendChild(v), h.appendChild(f), h.appendChild(y);
  const w = () => {
    const e = b.checked;
    v.style.background = e ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" : document.body.classList.contains("dark-theme") ? "#5f6368" : "#bdc1c6", x.style.transform = e ? "translateX(20px)" : "translateX(0)"
  };
  b.addEventListener("change", () => {
    w();
    try {
      chrome.storage.sync.set({
        sg_export_include_timestamps: b.checked
      })
    } catch (e) {}
  });
  const S = document.createElement("label");
  S.title = "Adds the title, a link to the chat, dates and the message count at the top of .md files, for Obsidian and other note apps", S.style.cssText = "\n    display: flex;\n    align-items: center;\n    gap: 8px;\n    margin-bottom: 16px;\n    padding: 2px 4px;\n    cursor: pointer;\n    font-size: 1rem;\n    user-select: none;\n  ";
  const E = document.createElement("span");
  E.textContent = "Add properties to .md", E.style.cssText = "flex: 1;";
  const k = document.createElement("span");
  k.style.cssText = "\n    position: relative;\n    display: inline-block;\n    width: 44px;\n    height: 24px;\n    flex-shrink: 0;\n  ";
  const T = document.createElement("input");
  T.type = "checkbox", T.id = "sg-export-md-properties", T.style.cssText = "opacity: 0; width: 0; height: 0; position: absolute;";
  const C = document.createElement("span");
  C.style.cssText = `\n    position: absolute;\n    inset: 0;\n    background-color: ${document.body.classList.contains("dark-theme")?"#5f6368":"#bdc1c6"};\n    border-radius: 24px;\n    transition: background-color 0.3s;\n  `;
  const A = document.createElement("span");
  A.style.cssText = "\n    position: absolute;\n    height: 18px;\n    width: 18px;\n    left: 3px;\n    bottom: 3px;\n    background-color: #fff;\n    border-radius: 50%;\n    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);\n    transition: transform 0.3s;\n  ", C.appendChild(A), k.appendChild(T), k.appendChild(C), S.appendChild(E), S.appendChild(k);
  const L = () => {
    const e = T.checked;
    C.style.background = e ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" : document.body.classList.contains("dark-theme") ? "#5f6368" : "#bdc1c6", A.style.transform = e ? "translateX(20px)" : "translateX(0)"
  };
  T.addEventListener("change", () => {
    L();
    try {
      chrome.storage.sync.set({
        sg_export_md_properties: T.checked
      })
    } catch (e) {}
  }), t.appendChild(h), t.appendChild(l), t.appendChild(S);
  const _ = document.createElement("div");
  _.style.cssText = "\n    display: flex;\n    flex-direction: column;\n    gap: 12px;\n  ";
  const M = (e, t, n) => {
    const r = document.createElement("button");
    return r.style.cssText = "\n      position: relative;\n      padding: 12px;\n      border-radius: 8px;\n      border: 1px solid var(--gem-sys-color--outline, #747775);\n      background: transparent;\n      color: inherit;\n      cursor: pointer;\n      font-size: 1rem;\n      text-align: left;\n      transition: background 0.1s;\n      display: flex;\n      align-items: center;\n      gap: 12px;\n    ",sgSetSafeHtml(r, `\n      <div style="display: flex; align-items: center; justify-content: center; width: 32px; height: 32px;">\n        ${n}\n      </div>\n      <span>Export as ${e}</span>\n    `), r.addEventListener("mouseenter", () => r.style.background = "var(--gem-sys-color--surface-container-high, rgba(255,255,255,0.05))"), r.addEventListener("mouseleave", () => r.style.background = "transparent"), r.dataset.sgExportFormat = t, r.addEventListener("click", async () => {
      if ("styled-pdf" === t && r.classList.contains("sg-export-option--disabled")) return;
      const n = !!u.checked,
        s = !!b.checked,
        a = !!T.checked;
      o(), "txt" === t ? await exportChatAsText({
        includeThoughts: n,
        includeTimestamps: s
      }) : "md" === t ? await exportChatAsMarkdown({
        includeThoughts: n,
        includeTimestamps: s,
        mdProperties: a
      }) : "pdf" === t ? await exportChatAsPdf({
        includeThoughts: n,
        includeTimestamps: s
      }) : "styled-pdf" === t ? await generateStyledPdf() : "print" === t ? await printChat({
        includeThoughts: n,
        includeTimestamps: s
      }) : "docx" === t && await exportChatAsDocx({
        includeThoughts: n,
        includeTimestamps: s
      })
    }), r
  };
  _.appendChild(M(".txt", "txt", '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z" fill="currentColor"/></svg>')), _.appendChild(M(".md", "md", '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2.5 4h19A1.5 1.5 0 0 1 23 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-19A1.5 1.5 0 0 1 1 18.5v-13A1.5 1.5 0 0 1 2.5 4Zm3 12v-5l2.5 3 2.5-3v5h2V8h-2L8 11 5.5 8h-2v8h2Zm12.5 0 3.5-4H19V8h-3v4h-2.5L18 16Z" fill="currentColor"/></svg>')), _.appendChild(M(".docx", "docx", '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" fill="currentColor"/></svg>')), _.appendChild(M("Print", "print", '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z" fill="currentColor"/></svg>')), _.appendChild(M(".pdf", "pdf", '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm10 5.5h1v-3h-1v3z" fill="currentColor"/></svg>'));
  const I = M("Styled .pdf", "styled-pdf", '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z" fill="currentColor"/><path d="M16.5 14.2l.7 1.6 1.6.7-1.6.7-.7 1.6-.7-1.6-1.6-.7 1.6-.7.7-1.6z" fill="currentColor"/></svg>');
  _.appendChild(I);

  const selectiveBtn = document.createElement("button");
  selectiveBtn.type = "button";
  selectiveBtn.className = "sg-selective-export-entry-btn";
  const selIconWrap = document.createElement("div");
  selIconWrap.className = "sg-selective-export-entry-icon";
  if (typeof sgCreateSvgIcon === "function" && typeof SG_EXPORT_SVG_PATHS !== "undefined") {
    selIconWrap.appendChild(sgCreateSvgIcon(SG_EXPORT_SVG_PATHS, 20));
  }
  const selLabel = document.createElement("span");
  selLabel.textContent = "Selective Export (Outline / Bookmarks)...";
  selectiveBtn.appendChild(selIconWrap);
  selectiveBtn.appendChild(selLabel);
  selectiveBtn.addEventListener("click", () => {
    const incThoughts = !!u.checked;
    const incTimestamps = !!b.checked;
    const mdProps = !!T.checked;
    o();
    if (typeof sgOpenSelectiveExportModal === "function") {
      sgOpenSelectiveExportModal({
        includeThoughts: incThoughts,
        includeTimestamps: incTimestamps,
        mdProperties: mdProps
      });
    }
  });
  _.appendChild(selectiveBtn);

  function P() {
    const e = !!u.checked;
    I.classList.toggle("sg-export-option--disabled", e), e ? (I.setAttribute("aria-disabled", "true"), I.setAttribute("data-sg-tooltip", 'Turn off "Include Gemini thoughts" to use Styled .pdf')) : (I.removeAttribute("aria-disabled"), I.removeAttribute("data-sg-tooltip"))
  }
  P(), u.addEventListener("change", P);
  try {
    sgSyncGetCached(["sg_export_include_thoughts", "sg_export_include_timestamps", "sg_export_md_properties"], e => {
      u.checked = !!(e && !0 === e.sg_export_include_thoughts), m();
      b.checked = !(e && !1 === e.sg_export_include_timestamps), w();
      T.checked = !!(e && !0 === e.sg_export_md_properties), L();
      P();
    });
  } catch (e) {
    b.checked = !0, w(), P();
  }
  t.appendChild(_), n.appendChild(t), document.body.appendChild(n), requestAnimationFrame(() => {
    n.classList.add("show"), t.style.transform = "scale(1)"
  })
}

function showBulkExportModal(e) {
  const t = document.getElementById("sg-export-popup-overlay");
  t && t.remove();
  const n = document.createElement("div");
  n.id = "sg-export-popup-overlay", n.style.cssText = "\n    position: fixed;\n    top: 0;\n    left: 0;\n    width: 100vw;\n    height: 100vh;\n    background: rgba(0, 0, 0, 0.5);\n    z-index: 2201; /* Higher than folder modal */\n    display: flex;\n    align-items: center;\n    justify-content: center;\n    backdrop-filter: blur(2px);\n    opacity: 0;\n    transition: opacity 0.2s ease;\n  ";
  const o = document.createElement("div");
  o.className = "sg-export-popup", o.style.cssText = "\n    background: var(--gem-sys-color--surface, #fff);\n    color: var(--gem-sys-color--on-surface, #1f1f1f);\n    width: 400px;\n    border-radius: 12px;\n    box-shadow: 0 4px 24px rgba(0,0,0,0.2);\n    display: flex;\n    flex-direction: column;\n    overflow: hidden;\n    transform: scale(0.95);\n    transition: transform 0.2s;\n    padding: 24px;\n    font-family: var(--sg-font-text);\n  ", document.body.classList.contains("dark-theme") && (o.style.background = "#1e1f20", o.style.color = "#e3e3e3");
  const r = document.createElement("div");
  r.style.cssText = "display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;";
  const s = document.createElement("h3");
  s.textContent = `Export ${e.length} Chats`, s.style.cssText = "margin: 0; font-size: 1.25rem; font-weight: 500;";
  const a = document.createElement("button");sgSetSafeHtml(a, '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"></path></svg>'), a.style.cssText = "background: transparent; border: none; color: inherit; cursor: pointer; padding: 4px; border-radius: 50%; opacity: 0.7; transition: all 0.2s;", a.addEventListener("click", () => {
    y || n.remove()
  }), r.appendChild(s), r.appendChild(a), o.appendChild(r);
  const i = document.createElement("p");
  i.textContent = "Choose an export format for your chats.", i.style.cssText = "margin: 0 0 20px; font-size: 0.9rem; opacity: 0.8;", o.appendChild(i);
  const l = document.createElement("label");
  l.textContent = "Format:", l.style.cssText = "font-size: 0.85rem; font-weight: 500; margin-bottom: 6px; display: block;", o.appendChild(l);
  const c = document.createElement("select");
  c.style.cssText = "\n    width: 100%;\n    padding: 10px;\n    border-radius: 8px;\n    border: 1px solid var(--gem-sys-color--outline-variant, #dce1e9);\n    background: var(--gem-sys-color--surface-container, #f0f4f8);\n    color: inherit;\n    font-size: 0.9rem;\n    margin-bottom: 20px;\n    outline: none;\n    cursor: pointer;\n  ";
  [{
    value: "txt",
    label: "Plain Text (.txt)"
  }, {
    value: "md",
    label: "Markdown (.md)"
  }, {
    value: "pdf",
    label: "PDF Document (.pdf)"
  }, {
    value: "docx",
    label: "Word Document (.docx)"
  }, {
    value: "print",
    label: "Printable HTML (opens tabs)"
  }].forEach(e => {
    const t = document.createElement("option");
    t.value = e.value, t.textContent = e.label, c.appendChild(t)
  }), o.appendChild(c);
  const d = document.createElement("div");
  d.style.cssText = "display: flex; flex-direction: column; gap: 12px;";
  const u = document.createElement("div");
  u.id = "sg-bulk-export-progress", u.style.cssText = "display: none; margin-top: 16px;";
  const p = document.createElement("div");
  p.style.cssText = "font-size: 0.9rem; margin-bottom: 8px;", p.textContent = "Preparing...";
  const g = document.createElement("div");
  g.style.cssText = "width: 100%; height: 6px; background: var(--gem-sys-color--surface-container-high, #e0e0e0); border-radius: 3px; overflow: hidden;";
  const m = document.createElement("div");
  m.style.cssText = "width: 0%; height: 100%; background: #4285f4; transition: width 0.3s ease;", g.appendChild(m), u.appendChild(p), u.appendChild(g);
  const h = document.createElement("button");
  h.style.cssText = "padding: 14px; border-radius: 8px; border: none; background: #4285f4; color: white; cursor: pointer; font-size: 1rem; font-weight: 500; transition: background 0.1s; display: flex; align-items: center; justify-content: center; gap: 10px;",sgSetSafeHtml(h, '\n    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">\n      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>\n    </svg>\n    Export Chats\n  '), h.addEventListener("mouseenter", () => h.style.background = "#1a73e8"), h.addEventListener("mouseleave", () => h.style.background = "#4285f4");
  let f = !1,
    y = !1;
  h.addEventListener("click", async () => {
    if (y) {
      if (f) return;
      f = !0;
      try {
        sgSafeSendMessage({ type: "ABORT_SCRAPE_CHAT" });
      } catch (err) {}
      return h.textContent = "Cancelling...", h.style.background = "#999", h.style.cursor = "not-allowed", h.disabled = !0, h.onmouseenter = null, h.onmouseleave = null, void(p.textContent = "Cancelling export...")
    }
    const s = c.value,
      i = await new Promise(e => {
        try {
          sgSyncGetCached(["sg_export_md_properties"], t => e(!(!t || !0 !== t.sg_export_md_properties)))
        } catch (t) {
          e(!1)
        }
      });
    y = !0, c.disabled = !0,sgSetSafeHtml(h, '\n      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">\n        <rect x="6" y="6" width="12" height="12" rx="1"/>\n      </svg>\n      Stop Export\n    '), h.style.background = "#ea4335", h.style.cursor = "pointer", h.disabled = !1, h.style.opacity = "1", h.onmouseenter = () => h.style.background = "#d33b2c", h.onmouseleave = () => h.style.background = "#ea4335", a.disabled = !0, a.style.opacity = "0.3", a.style.cursor = "not-allowed", u.style.display = "block";
    let l = 0;
    const d = [],
      g = async (e, t) => {
        try {
          const n = await new Promise(t => {
            sgSafeSendMessage({
              type: "SCRAPE_CHAT_CONTENT",
              chatUrl: e.url,
              chatId: e.id,
              chatTitle: e.title
            }, (e, err) => {
              t(e || {
                success: !1,
                error: err || "No response"
              })
            })
          });
          if (n.success && n.history && n.history.length > 0) {
            const o = n.history,
              r = e.title,
              s = r.replace(/[^a-z0-9]/gi, "_").substring(0, 50),
              a = (new Date).toISOString().slice(0, 10);
            if ("txt" === t) {
              const e = formatTextExport(o, r),
                t = new Blob([e], {
                  type: "text/plain"
                }),
                n = URL.createObjectURL(t),
                i = document.createElement("a");
              i.href = n, i.download = `${s}_${a}.txt`, document.body.appendChild(i), i.click(), setTimeout(() => { document.body.removeChild(i), URL.revokeObjectURL(n) }, 1000)
            } else if ("md" === t) {
              const t = formatMarkdownExport(o, r, i ? {
                  source: e.url
                } : null),
                n = new Blob([t], {
                  type: "text/markdown"
                }),
                l = URL.createObjectURL(n),
                c = document.createElement("a");
              c.href = l, c.download = `${s}_${a}.md`, document.body.appendChild(c), c.click(), setTimeout(() => { document.body.removeChild(c), URL.revokeObjectURL(l) }, 1000)
            } else if ("pdf" === t) {
              const e = await generatePdfBlob(r, o);
              if (!e) throw new Error("Failed to generate PDF");
              const t = URL.createObjectURL(e),
                n = document.createElement("a");
              n.href = t, n.download = `${s}_${a}.pdf`, document.body.appendChild(n), n.click(), setTimeout(() => { document.body.removeChild(n), URL.revokeObjectURL(t) }, 1000)
            } else if ("docx" === t) {
              const e = await generateDocxBlob(r, o);
              if (!e) throw new Error("Failed to generate DOCX");
              const t = URL.createObjectURL(e),
                n = document.createElement("a");
              n.href = t, n.download = `${s}_${a}.docx`, document.body.appendChild(n), n.click(), setTimeout(() => { document.body.removeChild(n), URL.revokeObjectURL(t) }, 1000)
            } else if ("print" === t) {
              const e = formatPrintHtml(o, r);
              if (!openPrintHtmlWindow(e)) throw new Error("Popup blocked — please allow popups to print");
            }
            return {
              success: !0,
              chat: e
            }
          }
          return console.warn("[Gemini Power Suite] Failed to export:", e.title, n.error), {
            success: !1,
            chat: e,
            error: n.error || "Unknown error"
          }
        } catch (t) {
          return console.error("[Gemini Power Suite] Export error:", t), {
            success: !1,
            chat: e,
            error: t.message || "Export error"
          }
        }
      };
    for (let t = 0; t < e.length; t += 5) {
      if (f) {
        p.textContent = "Export cancelled";
        break
      }
      const n = e.slice(t, Math.min(t + 5, e.length)),
        o = Math.min(t + 5, e.length),
        r = Math.round(o / e.length * 100);
      p.textContent = `Exporting ${t+1}-${o}/${e.length}...`, m.style.width = `${r}%`;
      const results = await Promise.all(n.map(e => g(e, s)));
      for (const res of results) {
        if (res.success) {
          l++;
        } else {
          d.push({
            chat: res.chat,
            error: res.error
          });
        }
      }
      t + 5 < e.length && await new Promise(e => setTimeout(e, 500))
    }
    let b = 0;
    if (d.length > 0 && !f)
      for (let e = 1; e <= 2 && d.length > 0; e++) {
        const t = [...d];
        d.length = 0;
        for (let n = 0; n < t.length; n++) {
          if (f) {
            p.textContent = "Export cancelled during retry";
            break
          }
          const {
            chat: o
          } = t[n];
          p.textContent = `Retry ${e}/2: ${o.title.substring(0,40)}...`;
          try {
            const e = await new Promise(e => {
              sgSafeSendMessage({
                type: "SCRAPE_CHAT_CONTENT",
                chatUrl: o.url,
                chatId: o.id,
                chatTitle: o.title
              }, (t, err) => {
                e(t || {
                  success: !1,
                  error: err || "No response"
                })
              })
            });
            if (e.success && e.history && e.history.length > 0) {
              const t = e.history,
                n = o.title,
                r = n.replace(/[^a-z0-9]/gi, "_").substring(0, 50),
                a = (new Date).toISOString().slice(0, 10);
              if ("txt" === s) {
                const e = formatTextExport(t, n),
                  o = new Blob([e], {
                    type: "text/plain"
                  }),
                  s = URL.createObjectURL(o),
                  i = document.createElement("a");
                i.href = s, i.download = `${r}_${a}.txt`, document.body.appendChild(i), i.click(), setTimeout(() => { document.body.removeChild(i), URL.revokeObjectURL(s) }, 1000)
              } else if ("md" === s) {
                const e = formatMarkdownExport(t, n, i ? {
                    source: o.url
                  } : null),
                  s = new Blob([e], {
                    type: "text/markdown"
                  }),
                  l = URL.createObjectURL(s),
                  c = document.createElement("a");
                c.href = l, c.download = `${r}_${a}.md`, document.body.appendChild(c), c.click(), setTimeout(() => { document.body.removeChild(c), URL.revokeObjectURL(l) }, 1000)
              } else if ("pdf" === s) {
                const e = await generatePdfBlob(n, t);
                if (!e) throw new Error("Failed to generate PDF");
                const o = URL.createObjectURL(e),
                  s = document.createElement("a");
                s.href = o, s.download = `${r}_${a}.pdf`, document.body.appendChild(s), s.click(), setTimeout(() => { document.body.removeChild(s), URL.revokeObjectURL(o) }, 1000)
              } else if ("docx" === s) {
                const e = await generateDocxBlob(n, t);
                if (!e) throw new Error("Failed to generate DOCX");
                const o = URL.createObjectURL(e),
                  s = document.createElement("a");
                s.href = o, s.download = `${r}_${a}.docx`, document.body.appendChild(s), s.click(), setTimeout(() => { document.body.removeChild(s), URL.revokeObjectURL(o) }, 1000)
              } else if ("print" === s) {
                const e = formatPrintHtml(t, n);
                if (!openPrintHtmlWindow(e)) throw new Error("Popup blocked — please allow popups to print");
              }
              b++, l++
            } else d.push({
              chat: o,
              error: e.error || "Retry failed"
            })
          } catch (e) {
            d.push({
              chat: o,
              error: e.message
            })
          }
          await new Promise(t => setTimeout(t, 1500 * e))
        }
        if (f) break
      }
    if (f) p.textContent = `Cancelled. ${l} exported before stopping`, m.style.width = `${Math.round(l/e.length*100)}%`, m.style.background = "#fb8c00", setTimeout(() => {
      n.remove(), l > 0 ? showToast(`Export cancelled. ${l} chat(s) exported before stopping`, "warning") : showToast("Export cancelled", "info")
    }, 500);
    else {
      const e = b > 0 ? ` (${b} recovered)` : "",
        t = d.length;
      p.textContent = `Done! ${l} exported${e}, ${t} failed`, m.style.width = "100%", m.style.background = l > 0 ? "#34a853" : "#ea4335", t > 0 && console.warn("[Gemini Power Suite] Permanently failed exports:", d.map(e => `${e.chat.title}: ${e.error}`)), setTimeout(() => {
        n.remove(), l > 0 ? showToast(`Exported ${l} chat(s)${e}`, "success") : showToast("Export failed", "error")
      }, 1500)
    }
    y = !1
  }), d.appendChild(h), o.appendChild(d), o.appendChild(u), n.appendChild(o);
  let b = !1;
  n.addEventListener("mousedown", e => {
    b = e.target === n
  }), n.addEventListener("click", e => {
    if (e.target === n && b) {
      if (y) return;
      n.remove()
    }
  }), document.body.appendChild(n), requestAnimationFrame(() => {
    n.style.opacity = "1", o.style.transform = "scale(1)"
  })
}
async function ensureFullChatLoaded({
  onProgress: e = null,
  onIncomplete: t = null
} = {}) {
  const n = domQuery("chatHistory");
  if (!n) return () => {};
  let o = null,
    r = 0;
  try {
    const e = findActiveChatInfo();
    if (e && e.id) {
      const t = await callHNvQHb(e.id, 1e4),
        n = t && Array.isArray(t[0]) ? t[0] : null;
      if (n && n.length > 0) {
        r = n.length;
        const e = n[n.length - 1]?.[0]?.[1];
        "string" == typeof e && e && (o = e.replace(/^r_/, ""))
      }
    }
  } catch (e) {}
  const s = () => n.querySelectorAll(".conversation-container").length,
    a = () => {
      const e = o && document.getElementById(o);
      return !!e && n.contains(e)
    };
  if (o) {
    if (a()) return () => {}
  } else if (n.scrollTop <= 10) return () => {};
  const i = n.scrollTop,
    l = n.scrollHeight,
    c = () => r ? Math.min(s(), r) : s(),
    d = () => r ? `Loading full chat for export (${c()} of ${r})...` : "Loading full chat for export...";
  e ? e(c(), r) : showToast(d(), "info"), n.scrollTop = 0;
  const u = Date.now();
  let p = u,
    g = s(),
    m = u,
    h = n.scrollHeight,
    f = u,
    y = !1;
  for (;;) {
    await new Promise(e => setTimeout(e, 400)), n.scrollTop = 0;
    const t = Date.now();
    if (o) {
      if (a()) {
        y = !0;
        break
      }
      const e = s();
      if (e !== g && (g = e, m = t), t - m > 2e4) break
    } else {
      const e = n.scrollHeight;
      if (e !== h && (h = e, f = t), t - f >= 3e3) {
        y = !0;
        break
      }
    }
    if (t - u > 3e5) break;
    e ? e(c(), r) : t - p >= 6e3 && (p = t, showToast(d(), "info"))
  }
  return y || (t ? t() : showToast("Couldn't load the whole chat. The export may be missing older messages.", "error")), () => {
    const e = n.scrollHeight - l;
    n.scrollTop = i + e
  }
}

function getChatHistory() {
  const e = [],
    t = ["user-query", ".user-message", '[data-message-author="user"]', ".query-content"],
    n = [...t, "model-response", ".model-response", '[data-message-author="model"]', "message-content .markdown-main-panel"].join(", ");
  let o = Array.from(document.querySelectorAll(n));
  if (o = o.filter((e, t, n) => !n.some((n, o) => t !== o && n.contains(e))), o.length > 0) o.forEach(n => {
    let o = "Gemini";
    t.some(e => n.matches(e) || n.closest(e)) && (o = "User");
    let r = "";
    const s = n.querySelector(".sg-message-timestamp");
    if (s) r = s.textContent.trim();
    else {
      const e = /([0-1]?[0-9]:[0-5][0-9]\s?[AP]M)/i,
        t = n.innerText.match(e);
      t && (r = t[0])
    }
    const a = n.cloneNode(!0);
    ["sources-carousel-inline", "sources-carousel", "source-footnote", ".gemini-export-checkbox-container", ".sg-message-timestamp", ".sg-cb-actions", ".sg-cb-expand-bar", ".sg-cb-fallback-header", ".sg-fork-turn-btn", ".sg-bookmark-btn", ".sg-download-audio-btn", "style", "script", "mat-icon", "mat-icon-button", ".message-actions", "message-actions", "response-actions", ".response-actions", "response-input-area", ".input-area", ".table-footer", ".export-sheets-button-container", ".copy-button", ".cdk-visually-hidden", "elicitations", "follow-up"].forEach(e => {
      a.querySelectorAll(e).forEach(e => e.remove())
    });
    a.querySelectorAll('button, [role="button"]').forEach(e => {
      const t = e.innerText.trim();
      "Show thinking" !== t && "Thinking" !== t && "Sources" !== t || e.remove()
    });
    const i = new Map,
      l = n.querySelectorAll("code-block, pre"),
      c = a.querySelectorAll("code-block, pre");
    l.forEach((e, t) => {
      if (!c[t]) return;
      const n = c[t];
      let o = "";
      const r = e.querySelector(".code-block-decoration, .header, .bar");
      if (r) {
        const rc = r.cloneNode(!0);
        rc.querySelectorAll('.sg-cb-actions, .buttons, button, [role="button"], svg').forEach(el => el.remove());
        let langText = (rc.innerText || rc.textContent || "").replace(/copy/i, "").trim();
        langText && (o = langText)
      }
      if (!o) {
        const t = e.getAttribute("data-language");
        t && (o = t)
      }
      if (!o) {
        let t = e.className.match(/language-(\w+)/);
        t && (o = t[1])
      }
      if (!o) {
        const t = e.querySelector("code");
        if (t) {
          const e = t.getAttribute("data-language");
          if (e && (o = e), !o) {
            let e = t.className.match(/language-(\w+)/);
            e && (o = e[1])
          }
        }
      }
      const s = (e.querySelector("code") || e).textContent,
        a = `__MEMO_CODE_BLOCK_${t}__`;
      i.set(a, `\n\`\`\`${o}\n${s}\n\`\`\`\n`), n.replaceWith(document.createTextNode(a))
    });
    const d = new Map,
      u = n.querySelectorAll("table"),
      p = a.querySelectorAll("table");
    u.forEach((e, t) => {
      if (!p[t]) return;
      const n = p[t],
        o = e.querySelectorAll("tr");
      if (0 === o.length) return;
      const r = [];
      let s = 0;
      o.forEach(e => {
        const t = e.querySelectorAll("th, td"),
          n = [];
        t.forEach(e => {
          const t = e.innerText.trim().replace(/\|/g, "\\|").replace(/\n/g, " ");
          n.push(t)
        }), r.push(n), s = Math.max(s, n.length)
      });
      const a = new Array(s).fill(3);
      r.forEach(e => {
        for (let t = 0; t < s; t++) {
          const n = e[t] || "";
          a[t] = Math.max(a[t], n.length)
        }
      });
      let i = "\n";
      r.forEach((e, t) => {
        const n = [];
        for (let t = 0; t < s; t++) {
          const o = e[t] || "";
          n.push(o.padEnd(a[t]))
        }
        i += "| " + n.join(" | ") + " |\n", 0 === t && (i += "| " + a.map(e => "-".repeat(e)).join(" | ") + " |\n")
      }), i += "\n";
      const l = `__MEMO_TABLE_${t}__`;
      d.set(l, i), n.replaceWith(document.createTextNode(l))
    });
    const g = new Map;
    let m = 0;
    const h = (e, t) => {
      a.querySelectorAll(e).forEach(e => {
        const n = `__FMT_${m++}__`,
          o = e.textContent;
        g.set(n, t(o)), e.replaceWith(document.createTextNode(n))
      })
    };
    ["h1", "h2", "h3", "h4", "h5", "h6"].forEach((e, t) => {
      a.querySelectorAll(e).forEach(e => {
        const n = `__FMT_${m++}__`,
          o = "#".repeat(t + 1) + " ";
        g.set(n, "\n" + o + e.innerText.trim() + "\n"), e.replaceWith(document.createTextNode(n))
      })
    }), a.querySelectorAll("ul").forEach(e => {
      const t = e.querySelectorAll(":scope > li");
      t.forEach((e, n) => {
        const o = `__FMT_${m++}__`,
          r = n === t.length - 1 ? "\n\n" : "";
        g.set(o, "\n- " + e.innerText.trim() + r), e.replaceWith(document.createTextNode(o))
      })
    }), a.querySelectorAll("ol").forEach(e => {
      const t = e.querySelectorAll(":scope > li");
      t.forEach((e, n) => {
        const o = `__FMT_${m++}__`,
          r = n === t.length - 1 ? "\n\n" : "";
        g.set(o, "\n" + (n + 1) + ". " + e.innerText.trim() + r), e.replaceWith(document.createTextNode(o))
      })
    }), h("strong, b", e => `**${e}**`), h("em, i", e => `*${e}*`), h("code:not(pre code):not(code-block code)", e => `\`${e}\``), h("del, s, strike", e => `~~${e}~~`);
    a.querySelectorAll("p, div.paragraph, li, h1, h2, h3, h4, h5, h6").forEach(e => {
      e.appendChild(document.createTextNode("\n\n"))
    });
    let f = a.innerText.trim();
    f = f.replace(/\n{3,}/g, "\n\n"), i.forEach((e, t) => {
      f = f.replace(t, () => e)
    }), d.forEach((e, t) => {
      f = f.replace(t, () => e)
    }), g.forEach((e, t) => {
      f = f.replace(t, () => e)
    }), r && f.includes(r) && (f = f.replace(r, "").trim()), f && f.length > 0 && e.push({
      role: o,
      text: f,
      timestamp: r
    })
  });
  else {
    document.querySelectorAll(".user-query-container, .model-response-container").forEach(t => {
      const n = t.classList.contains("user-query-container") ? "User" : "Gemini";
      e.push({
        role: n,
        text: t.innerText.trim(),
        timestamp: ""
      })
    })
  }
  return e
}

function applyTimestampOpt(e, t) {
  return t && !1 === t.includeTimestamps ? e.map(e => ({
    ...e,
    timestamp: ""
  })) : e
}
async function exportChatAsText(e = {}) {
  let t = await getChatHistoryForExport(e);
  if (0 === t.length) return void showToast("Cannot export empty chat", "error");
  t = applyTimestampOpt(t, e), showToast("Exporting...", "info");
  const n = findActiveChatInfo(),
    o = n ? n.title : "Gemini Chat",
    r = formatTextExport(t, o),
    s = new Blob([r], {
      type: "text/plain"
    }),
    a = URL.createObjectURL(s),
    i = document.createElement("a");
  i.href = a;
  const l = o.replace(/[^a-z0-9]/gi, "_").substring(0, 50);
  i.download = `${l}_${(new Date).toISOString().slice(0,10)}.txt`, document.body.appendChild(i), i.click(), setTimeout(() => {
    document.body.removeChild(i), URL.revokeObjectURL(a)
  }, 100)
}
async function exportChatAsMarkdown(e = {}) {
  let t = await getChatHistoryForExport(e);
  if (0 === t.length) return void showToast("Cannot export empty chat", "error");
  t = applyTimestampOpt(t, e), showToast("Exporting...", "info");
  const n = findActiveChatInfo(),
    o = n ? n.title : "Gemini Chat",
    r = formatMarkdownExport(t, o, e.mdProperties ? {
      source: n && n.id ? location.origin + location.pathname : ""
    } : null),
    s = new Blob([r], {
      type: "text/markdown"
    }),
    a = URL.createObjectURL(s),
    i = document.createElement("a");
  i.href = a;
  const l = o.replace(/[^a-z0-9]/gi, "_").substring(0, 50);
  i.download = `${l}_${(new Date).toISOString().slice(0,10)}.md`, document.body.appendChild(i), i.click(), setTimeout(() => {
    document.body.removeChild(i), URL.revokeObjectURL(a)
  }, 100)
}
async function callHNvQHb(e, t) {
  try {
    if (!e) return null;
    let n = null,
      o = null;
    for (const e of document.querySelectorAll("script")) {
      const t = e.textContent;
      if (t) {
        if (!n) {
          const e = t.match(/"SNlM0e":"([^"]+)"/);
          e && (n = e[1])
        }
        if (!o) {
          const e = t.match(/"FdrFJe":"(-?\d+)"/);
          e && (o = e[1])
        }
        if (n && o) break
      }
    }
    if (!n) return null;
    const r = getAccountRpcPrefix(),
      s = ["c_" + e, t, null, 1, [1],
        [4], null, 1
      ],
      a = JSON.stringify([
        [
          ["hNvQHb", JSON.stringify(s), null, "generic"]
        ]
      ]),
      i = new URLSearchParams;
    i.set("f.req", a), i.set("at", n);
    const l = o ? `&f.sid=${encodeURIComponent(o)}` : "",
      c = `https://gemini.google.com${r}/_/BardChatUi/data/batchexecute?rpcids=hNvQHb&source-path=${encodeURIComponent(r+"/app")}${l}&hl=en&_reqid=${Math.floor(1e7*Math.random())}&rt=c`,
      d = await fetch(c, {
        method: "POST",
        body: i,
        credentials: "include",
        headers: {
          "content-type": "application/x-www-form-urlencoded;charset=UTF-8"
        }
      });
    if (!d.ok) return null;
    const u = (await d.text()).replace(/^\)\]\}'\n?/, "");
    for (const e of u.split("\n"))
      if (e.startsWith("[")) try {
        const t = JSON.parse(e);
        if (Array.isArray(t) && t[0] && "wrb.fr" === t[0][0] && "hNvQHb" === t[0][1]) return JSON.parse(t[0][2])
      } catch (e) {}
    return null
  } catch (e) {
    return null
  }
}
SG_IS_SILENT_BG_WORKER_TAB || (sgSyncGetCached(["showExportButton", "showInfoButton", "showWideChatButton", "wideChatEnabled"], e => {
  isExportButtonEnabled = !1 !== e.showExportButton, isInfoButtonEnabled = !1 !== e.showInfoButton, isWideChatButtonEnabled = !1 !== e.showWideChatButton, isWideChatEnabled = !0 === e.wideChatEnabled, updateWideChatClass(), injectHeaderButtons()
}), window.addEventListener("online", () => {
  updateOfflineIcon(), showToast("Back online!", "success")
}), window.addEventListener("offline", () => {
  updateOfflineIcon(), showToast("You are offline", "info")
}), setTimeout(() => {
  ensureOfflineStyles(), navigator.onLine || updateOfflineIcon()
}, 2e3));
const HNVQHB_TS_LIMIT = 100;
async function fetchPreciseChatTimestamps(e) {
  function t(e) {
    const t = e[e.length - 1];
    return Array.isArray(t) && "number" == typeof t[0] && t[0] > 1e9 ? t[0] : null
  }
  let n = await callHNvQHb(e, 100),
    o = n && Array.isArray(n[0]) ? n[0] : null;
  if (!o || 0 === o.length) return null;
  let r = o.length < 100;
  if (!r) {
    const t = await callHNvQHb(e, 1e4),
      n = t && Array.isArray(t[0]) ? t[0] : null;
    n && n.length > 0 && (o = n, r = n.length < 1e4)
  }
  const s = t(o[0]),
    a = t(o[o.length - 1]);
  return s ? {
    newestSec: s,
    oldestSec: a || s,
    turnCount: o.length,
    complete: r
  } : null
}

function formatTimestampHHMMAMPM(e) {
  if ("number" != typeof e || e < 1e9) return "";
  const t = new Date(1e3 * e);
  let n = t.getHours();
  const o = t.getMinutes(),
    r = n >= 12 ? "PM" : "AM";
  n %= 12, 0 === n && (n = 12);
  return `${t.toLocaleDateString([],{year:"numeric",month:"short",day:"numeric"})} ${n}:${String(o).padStart(2,"0")} ${r}`
}
async function fetchChatTurnsViaRpc(e, t = !1) {
  const n = await callHNvQHb(e, 1e4),
    o = n && Array.isArray(n[0]) ? n[0] : null;
  if (!o || 0 === o.length) return null;
  const r = [];
  for (let e = o.length - 1; e >= 0; e--) {
    const n = o[e];
    if (!Array.isArray(n)) continue;
    const s = n[n.length - 1],
      a = Array.isArray(s) && "number" == typeof s[0] && s[0] > 1e9 ? s[0] : null,
      i = a ? formatTimestampHHMMAMPM(a) : "",
      l = n[2] && n[2][0] && n[2][0][0];
    "string" == typeof l && l.length > 0 && r.push({
      role: "User",
      text: l,
      timestamp: i,
      timeSec: a
    });
    let c = n[3] && n[3][0] && n[3][0][0] && n[3][0][0][1] && n[3][0][0][1][0];
    if (c = stripFollowUpMarkup(c), "string" == typeof c && c.length > 0) {
      if (t) {
        const e = n[3] && n[3][0] && n[3][0][0] && n[3][0][0][37] && n[3][0][0][37][0] && n[3][0][0][37][0][0];
        "string" == typeof e && e.trim().length > 0 && (c = `**Thoughts**\n\n${e.trim()}\n\n---\n\n${c}`)
      }
      r.push({
        role: "Gemini",
        text: c,
        timestamp: i,
        timeSec: a
      })
    }
  }
  return r.length > 0 ? r : null
}
function sgFilterMessagesForSelectiveExport(messages, options = {}) {
  const list = Array.isArray(messages) ? messages : [];
  if (!list.length) return [];
  const hasTurnSelection = Boolean(
    options && (Array.isArray(options.selectedTurnNumbers) || options.selectedTurnNumbers instanceof Set)
  );
  const includeUserQueries = !(options && options.includeUserQueries === false);
  if (!hasTurnSelection && includeUserQueries) return list;

  const grouped = [];
  let current = null;
  for (const msg of list) {
    if (!msg) continue;
    const isUser = String(msg.role || "").toLowerCase() === "user";
    if (isUser) {
      if (current) grouped.push(current);
      current = { turnNumber: grouped.length + 1, userMsg: msg, messages: [msg] };
    } else if (!current) {
      grouped.push({ turnNumber: grouped.length + 1, userMsg: null, messages: [msg] });
    } else {
      current.messages.push(msg);
      grouped.push(current);
      current = null;
    }
  }
  if (current) grouped.push(current);

  let allowedTurnNums = null;
  if (hasTurnSelection) {
    const rawSet = options.selectedTurnNumbers instanceof Set
      ? options.selectedTurnNumbers
      : new Set(options.selectedTurnNumbers.map(Number).filter(n => Number.isFinite(n) && n >= 1));
    const totalOutline = Number(options.totalOutlineTurns || 0);
    const previews = Array.isArray(options.selectedTurnPreviews) ? options.selectedTurnPreviews : [];

    if (!totalOutline || grouped.length === totalOutline || previews.length === 0) {
      allowedTurnNums = rawSet;
    } else {
      const norm = (s) => String(s || "").replace(/\s+/g, " ").trim().toLowerCase().slice(0, 72);
      const matched = new Set();
      const usedTurns = new Set();
      const offset = Math.max(0, grouped.length - totalOutline);

      for (const p of previews) {
        const snippet = norm(p && p.userSnippet);
        let foundTurn = null;
        if (snippet && snippet.length >= 8) {
          for (const g of grouped) {
            if (usedTurns.has(g.turnNumber)) continue;
            const gNorm = norm(g.userMsg && g.userMsg.text);
            if (gNorm && (gNorm.startsWith(snippet) || snippet.startsWith(gNorm))) {
              foundTurn = g.turnNumber;
              break;
            }
          }
        }
        if (foundTurn === null && p && Number.isFinite(Number(p.turnNumber))) {
          const shifted = Number(p.turnNumber) + offset;
          if (shifted >= 1 && shifted <= grouped.length && !usedTurns.has(shifted)) {
            foundTurn = shifted;
          }
        }
        if (foundTurn !== null) {
          matched.add(foundTurn);
          usedTurns.add(foundTurn);
        }
      }
      allowedTurnNums = matched.size > 0 ? matched : rawSet;
    }
  }

  const out = [];
  for (const g of grouped) {
    if (allowedTurnNums && !allowedTurnNums.has(g.turnNumber)) continue;
    for (const msg of g.messages) {
      const isUser = String(msg.role || "").toLowerCase() === "user";
      if (!includeUserQueries && isUser) continue;
      out.push(msg);
    }
  }
  return out;
}

async function getChatHistoryForExport(e = {}) {
  const t = !!e.includeThoughts;
  let n = !1;
  let raw = null;
  try {
    const info = findActiveChatInfo(),
      o = info && info.id;
    if (o) {
      n = !0;
      const rpcMsgs = await fetchChatTurnsViaRpc(o, t);
      if (rpcMsgs && rpcMsgs.length > 0) raw = rpcMsgs;
    }
  } catch (err) {}
  if (!raw) {
    if (n) {
      try {
        showToast("Using fallback export", "info")
      } catch (err) {}
      if (t) try {
        showToast("Thoughts unavailable in fallback export", "info")
      } catch (err) {}
    }
    const o = await ensureFullChatLoaded(),
      r = getChatHistory();
    o();
    raw = r;
  }
  return sgFilterMessagesForSelectiveExport(raw, e);
}

function showInfoPopup() {
  const e = document.getElementById("sg-info-popup-overlay");
  e && e.remove();
  const t = document.createElement("div");
  t.className = "sg-info-popup", t.style.cssText = '\n    background: var(--gem-sys-color--surface, #fff);\n    color: var(--gem-sys-color--on-surface, #1f1f1f);\n    width: 400px;\n    max-width: 90vw;\n    border-radius: 12px;\n    box-shadow: 0 4px 24px rgba(0,0,0,0.2);\n    display: flex;\n    flex-direction: column;\n    transform: scale(0.95);\n    transition: transform 0.2s cubic-bezier(0.2, 0.0, 0, 1.0);\n    font-family: var(--sg-font-text); /* Fix font to match UI */\n  ', document.body.classList.contains("dark-theme") && (t.style.background = "#1e1f20", t.style.color = "#e3e3e3");
  const {
    overlay: n,
    close: o
  } = createModalOverlay({
    id: "sg-info-popup-overlay",
    zIndex: 2100,
    onClose: () => {
      t.style.transform = "scale(0.95)"
    }
  }), r = document.createElement("div");
  r.style.cssText = "\n    display: flex;\n    align-items: center;\n    justify-content: space-between;\n    padding: 16px 20px;\n    border-bottom: 1px solid var(--gem-sys-color--outline-variant, rgba(0,0,0,0.1));\n  ";
  const s = document.createElement("h2");
  s.textContent = "Chat Info", s.style.cssText = "\n    margin: 0;\n    font-family: var(--sg-font-flex);\n    font-size: 18px;\n    font-weight: 500;\n  ";
  const a = document.createElement("button");sgSetSafeHtml(a, '\n    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">\n      <path d="M18 6L6 18M6 6l12 12"></path>\n    </svg>\n  '), a.style.cssText = "\n    background: transparent;\n    border: none;\n    color: inherit;\n    cursor: pointer;\n    padding: 4px;\n    border-radius: 50%;\n    display: flex;\n    align-items: center;\n    justify-content: center;\n    opacity: 0.7;\n    transition: opacity 0.2s, background 0.2s;\n  ", a.addEventListener("mouseenter", () => {
    a.style.opacity = "1", a.style.background = "rgba(128,128,128,0.1)"
  }), a.addEventListener("mouseleave", () => {
    a.style.opacity = "0.7", a.style.background = "transparent"
  }), a.addEventListener("click", o);
  const i = document.createElement("div");
  i.style.cssText = "\n    padding: 20px;\n    font-family: var(--sg-font-text);\n    font-size: 14px;\n    line-height: 1.5;\n  ";
  const l = findActiveChatInfo(),
    c = getChatHistory();
  let d = "N/A",
    u = "N/A",
    p = 0;
  if (c.length > 0) {
    p = c.length;
    const e = c.find(e => e.timestamp && "--:--" !== e.timestamp && "unknown" !== e.timestamp);
    e && e.timestamp && (d = e.timestamp);
    let t = null;
    for (let e = c.length - 1; e >= 0; e--)
      if (c[e].timestamp && "--:--" !== c[e].timestamp && "unknown" !== c[e].timestamp) {
        t = c[e];
        break
      } t && t.timestamp && (u = t.timestamp)
  }
  const g = document.createElement("div");
  g.style.cssText = "\n    margin-top: 20px;\n    padding-top: 20px;\n    border-top: 1px solid var(--gem-sys-color--outline-variant, rgba(0,0,0,0.1));\n  ";
  const m = document.createElement("div");
  m.style.cssText = "\n    font-weight: 500;\n    margin-bottom: 8px;\n    display: flex;\n    justify-content: space-between;\n    align-items: center;\n  ",sgSetSafeHtml(m, "<span>Notes</span>");
  const h = document.createElement("textarea");
  h.placeholder = "Add notes for this chat...";
  const f = document.body.classList.contains("dark-theme");
  h.style.cssText = `\n    width: 100%;\n    height: 100px;\n    padding: 12px 14px;\n    border-radius: 16px;\n    border: 1px solid transparent;\n    background: var(--gem-sys-color--surface-container-high, ${f?"#282a2d":"#e9eef6"});\n    color: var(--gem-sys-color--on-surface, inherit);\n    font-family: var(--sg-font-flex);\n    font-size: 13px;\n    resize: none;\n    box-sizing: border-box;\n    outline: none;\n    transition: border-color 0.2s, background-color 0.2s;\n  `, h.addEventListener("focus", () => {
    h.style.borderColor = "var(--gem-sys-color--primary, #4285f4)"
  }), h.addEventListener("blur", () => {
    h.style.borderColor = "transparent"
  });
  const y = document.createElement("button");
  y.textContent = "Save Notes", y.className = "sg-save-notes-btn";
  const b = `var(--gem-sys-color--surface-container-high, ${f?"#282a2d":"#e9eef6"})`,
    v = `var(--gem-sys-color--surface-container-highest, ${f?"#36383b":"#dce1e9"})`;
  y.style.cssText = `\n    margin-top: 10px;\n    padding: 8px 18px;\n    background: ${b};\n    color: var(--gem-sys-color--on-surface, ${f?"#e8eaed":"#1f1f1f"});\n    border: none;\n    border-radius: 20px;\n    font-family: var(--sg-font-flex);\n    font-size: 13px;\n    font-weight: 500;\n    cursor: pointer;\n    transition: background-color 0.2s;\n    float: right;\n  `, y.addEventListener("mouseenter", () => {
    y.disabled || (y.style.background = v)
  }), y.addEventListener("mouseleave", () => {
    y.disabled || (y.style.background = b)
  });
  const x = l ? l.id : null;
  !x ? (g.style.opacity = "0.5", g.style.pointerEvents = "none", h.placeholder = "Notes are available after the first message") : (chrome.storage.local.get(["sg_chat_notes"], e => {
    const t = e.sg_chat_notes || {};
    t[x] && (h.value = t[x])
  }), y.addEventListener("click", () => {
    y.disabled || (y.disabled = !0, chrome.storage.local.get(["sg_chat_notes"], e => {
      const t = e.sg_chat_notes || {};
      t[x] = h.value, chrome.storage.local.set({
        sg_chat_notes: t
      }, () => {
        y.textContent = "Saved!", setTimeout(() => {
          y.textContent = "Save Notes", y.disabled = !1
        }, 1500)
      })
    }))
  }));
  const w = document.createElement("div");
  w.style.clear = "both", g.appendChild(m), g.appendChild(h), g.appendChild(y), g.appendChild(w),sgSetSafeHtml(i, `\n    <div style="margin-bottom: 12px;"><strong>Title:</strong> ${l?escapeHtml(l.title):"N/A"}</div>\n    <div style="margin-bottom: 12px;"><strong>Creation Date:</strong> <span id="sg-info-creation-date-value">${d}</span></div>\n    <div style="margin-bottom: 12px;"><strong>Last Interacted:</strong> <span id="sg-info-last-interacted-value">${u}</span></div>\n    <div style="margin-bottom: 12px;"><strong>Total Messages:</strong> ${p}</div>\n  `), i.appendChild(g), x && fetchPreciseChatTimestamps(x).then(e => {
    if (!e) return;
    const t = document.getElementById("sg-info-last-interacted-value");
    t && (t.textContent = new Date(1e3 * e.newestSec).toLocaleString());
    const n = document.getElementById("sg-info-creation-date-value");
    n && e.complete && (n.textContent = new Date(1e3 * e.oldestSec).toLocaleString())
  }), r.appendChild(s), r.appendChild(a), t.appendChild(r), t.appendChild(i), n.appendChild(t), document.body.appendChild(n), requestAnimationFrame(() => {
    n.classList.add("show"), t.style.transform = "scale(1)"
  })
}
async function exportChatAsDocx(e = {}) {
  let t = await getChatHistoryForExport(e);
  if (0 === t.length) return void showToast("Cannot export empty chat", "error");
  t = applyTimestampOpt(t, e), showToast("Creating Word document...", "info");
  const n = findActiveChatInfo(),
    o = n ? n.title : "Gemini Chat",
    r = await generateDocxBlob(o, t);
  if (!r) return void showToast("Failed to create Word document", "error");
  const s = URL.createObjectURL(r),
    a = document.createElement("a");
  a.href = s;
  const i = o.replace(/[^a-z0-9]/gi, "_").substring(0, 50);
  a.download = `${i}_${(new Date).toISOString().slice(0,10)}.docx`, document.body.appendChild(a), a.click(), setTimeout(() => {
    document.body.removeChild(a), URL.revokeObjectURL(s)
  }, 1000), showToast("Word document downloaded!", "success")
}
async function printChat(e = {}) {
  let t = await getChatHistoryForExport(e);
  if (0 === t.length) return void showToast("Cannot print empty chat", "error");
  t = applyTimestampOpt(t, e), showToast("Preparing print view...", "info");
  const n = findActiveChatInfo(),
    o = formatPrintHtml(t, n ? n.title : "Gemini Chat");
  openPrintHtmlWindow(o) || showToast("Please allow popups to print.", "error")
}
SG_IS_SILENT_BG_WORKER_TAB || sgSyncGetCached(["useAIStudioForOptimize"], e => {
  void 0 !== e.useAIStudioForOptimize && (useAIStudioForOptimize = e.useAIStudioForOptimize)
});
(() => {
  const _sgAiStudioOptMsg = (e, t, n) => {
    "ENABLE_AI_STUDIO_OPTIMIZE" === e.type ? useAIStudioForOptimize = !0 : "DISABLE_AI_STUDIO_OPTIMIZE" === e.type && (useAIStudioForOptimize = !1);
    return !1;
  };
  if ("undefined" != typeof SG && SG.messages) {
    SG.messages.onMatcher("legacy:ai-studio-optimize", () => !0, _sgAiStudioOptMsg);
  } else if ("undefined" != typeof chrome && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener(_sgAiStudioOptMsg);
  }
})();
