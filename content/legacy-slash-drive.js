let slashMenuElement = null,
  slashMenuVisible = !1,
  selectedSlashIndex = 0,
  filteredPrompts = [],
  currentInputForSlash = null,
  slashSearchQuery = "",
  slashTriggerType = "prompts",
  slashMenuManuallyClosed = !1,
  slashInputRafPending = !1;

function initSlashCommands() {
  sgSyncGetCached(["extensionEnabled", "promptsEnabled"], e => {
    if (!1 === e.extensionEnabled) return;
    if (!(isPromptsFeatureEnabled = !1 !== e.promptsEnabled)) return void sgObserverRegistry.unregisterUIRefresh("slashCommands");
    const t = ["rich-textarea .ql-editor", '.ql-editor[contenteditable="true"]', '[contenteditable="true"][role="textbox"]', 'textarea[placeholder*="Enter"]'],
      n = e => {
        if (!isExtensionEnabled || !isPromptsFeatureEnabled) return void hideSlashMenu();
        if (sgIsImeComposing(e)) return;
        "input" !== e.type && "keyup" !== e.type || "Escape" !== e.key && (slashMenuManuallyClosed = !1);
        const t = e.target;
        currentInputForSlash = t, slashInputRafPending || (slashInputRafPending = !0, requestAnimationFrame(() => {
          slashInputRafPending = !1;
          let e = "";
          t.isContentEditable ? e = t.textContent || t.innerText || "" : "TEXTAREA" !== t.tagName && "INPUT" !== t.tagName || (e = t.value || "");
          const n = window.getSelection();
          if (!n || !n.rangeCount) return void hideSlashMenu();
          const o = n.getRangeAt(0);
          let r = "";
          try {
            const e = o.cloneRange();
            e.selectNodeContents(t), e.setEnd(o.endContainer, o.endOffset), r = e.toString()
          } catch (e) {
            r = o.startContainer.textContent?.substring(0, o.startOffset) || ""
          }
          const s = r.match(/\/\/(\w*)$/),
            a = r.match(/,,(\w*)$/);
          s ? slashMenuManuallyClosed || (slashTriggerType = "prompts", slashSearchQuery = s[1].toLowerCase(), showSlashMenu(t)) : a ? slashMenuManuallyClosed || (slashTriggerType = "chains", slashSearchQuery = a[1].toLowerCase(), showSlashMenu(t)) : (slashMenuManuallyClosed = !1, hideSlashMenu())
        }))
      },
      o = e => {
        if (sgIsImeComposing(e)) return;
        if (isExtensionEnabled && isPromptsFeatureEnabled && slashMenuVisible)
          if ("ArrowDown" === e.key || "Tab" === e.key && !e.shiftKey) {
            if (0 === filteredPrompts.length) return;
            e.preventDefault(), selectedSlashIndex = (selectedSlashIndex + 1) % filteredPrompts.length, updateSlashSelection()
          } else if ("ArrowUp" === e.key || "Tab" === e.key && e.shiftKey) {
          if (0 === filteredPrompts.length) return;
          e.preventDefault(), selectedSlashIndex = (selectedSlashIndex - 1 + filteredPrompts.length) % filteredPrompts.length, updateSlashSelection()
        } else if ("Enter" === e.key) {
          if (0 === filteredPrompts.length) return;
          e.preventDefault(), e.stopPropagation(), filteredPrompts[selectedSlashIndex] && insertPromptAtSlash(filteredPrompts[selectedSlashIndex])
        } else "Escape" === e.key && (e.preventDefault(), slashMenuManuallyClosed = !0, hideSlashMenu())
      };
    sgObserverRegistry.registerUIRefresh("slashCommands", () => {
      const e = new Set;
      for (const n of t) document.querySelectorAll(n).forEach(t => e.add(t));
      e.forEach(e => {
        e.dataset.sgSlashInitialized || (e.addEventListener("input", n), e.addEventListener("keydown", o, !0), e.addEventListener("keyup", n), e.dataset.sgSlashInitialized = "true")
      })
    })
  })
}

function showSlashMenu(e) {
  slashMenuElement || (slashMenuElement = document.createElement("div"), slashMenuElement.id = "sg-slash-menu", slashMenuElement.style.cssText = "\n      position: fixed;\n      z-index: 10000;\n      background: var(--gem-sys-color--surface, #f0f4f8);\n      border: 1px solid var(--gem-sys-color--outline-variant, #dce1e9);\n      border-radius: 12px;\n      box-shadow: 0 8px 24px rgba(0,0,0,0.15);\n      width: 300px;\n      max-height: 450px;\n      overflow-y: auto;\n      display: none;\n      flex-direction: column;\n      padding: 8px 0;\n      font-family: var(--sg-font-text);\n    ", document.body.appendChild(slashMenuElement)), filteredPrompts = "prompts" === slashTriggerType ? promptsData.prompts.filter(e => e.title.toLowerCase().includes(slashSearchQuery)) : (chainsData?.chains || []).filter(e => e.title.toLowerCase().includes(slashSearchQuery)), filteredPrompts.length > 0 && selectedSlashIndex >= filteredPrompts.length ? selectedSlashIndex = 0 : 0 === filteredPrompts.length && (selectedSlashIndex = -1);
  if (!renderSlashMenu()) return;
  slashMenuElement.style.display = "flex", slashMenuElement.style.visibility = "hidden";
  const t = e.getBoundingClientRect(),
    n = slashMenuElement.offsetHeight;
  t.top > n + 60 ? slashMenuElement.style.top = t.top - n - 50 + "px" : slashMenuElement.style.top = `${t.bottom+20}px`, slashMenuElement.style.left = `${t.left}px`, slashMenuElement.style.visibility = "visible", slashMenuVisible = !0
}

function renderSlashMenu() {
  const clearSlash = () => {
    if ("function" == typeof slashMenuElement.replaceChildren) slashMenuElement.replaceChildren();
    else slashMenuElement.textContent = "";
  };
  if (0 === filteredPrompts.length) {
    if (0 === ("prompts" === slashTriggerType ? promptsData.prompts.length : (chainsData?.chains || []).length) && "" === slashSearchQuery) {
      const e = "prompts" === slashTriggerType ? "No prompts yet" : "No chains yet";
      clearSlash();
      const emptyEl = document.createElement("div");
      emptyEl.style.cssText = "padding: 12px 16px; color: var(--gem-sys-color--on-surface-variant, #575a5a); font-size: 14px; text-align: center; opacity: 0.7;";
      emptyEl.textContent = e;
      slashMenuElement.appendChild(emptyEl);
      return !0;
    }
    return hideSlashMenu(), !1
  }
  clearSlash();
  filteredPrompts.forEach((item, idx) => {
    const row = document.createElement("div");
    row.className = "sg-slash-item" + (idx === selectedSlashIndex ? " selected" : "");
    row.dataset.index = String(idx);
    row.style.cssText = `\n      padding: 10px 16px;\n      cursor: pointer;\n      display: flex;\n      flex-direction: column;\n      gap: 2px;\n      background: ${idx === selectedSlashIndex ? "var(--gem-sys-color--surface-container-high, #e9eef6)" : "transparent"};\n      transition: background 0.1s;\n    `;
    const titleSpan = document.createElement("span");
    titleSpan.style.cssText = "font-weight: 500; font-size: 14px; color: var(--gem-sys-color--on-surface, #1f1f1f);";
    titleSpan.textContent = String(item && item.title || "");
    const subSpan = document.createElement("span");
    subSpan.style.cssText = "font-size: 11px; color: var(--gem-sys-color--on-surface-variant, #575a5a); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; opacity: 0.7;";
    subSpan.textContent = "chains" === slashTriggerType
      ? `${item.steps?.length || 0} step${1 !== (item.steps?.length || 0) ? "s" : ""}`
      : String(item.text || "").substring(0, 60) + "...";
    row.appendChild(titleSpan);
    row.appendChild(subSpan);
    row.addEventListener("mousedown", ev => {
      ev.preventDefault();
      const n = parseInt(row.dataset.index);
      insertPromptAtSlash(filteredPrompts[n]);
    });
    row.addEventListener("mouseenter", () => {
      selectedSlashIndex = parseInt(row.dataset.index);
      updateSlashSelection();
    });
    slashMenuElement.appendChild(row);
  });
  return !0;
}

function updateSlashSelection() {
  slashMenuElement.querySelectorAll(".sg-slash-item").forEach((e, t) => {
    e.style.background = t === selectedSlashIndex ? "var(--gem-sys-color--surface-container-high, #e9eef6)" : "transparent", t === selectedSlashIndex ? e.classList.add("selected") : e.classList.remove("selected")
  });
  const e = slashMenuElement.querySelector(".sg-slash-item.selected");
  e && e.scrollIntoView({
    block: "nearest"
  })
}

function hideSlashMenu() {
  slashMenuElement && (slashMenuElement.style.display = "none"), slashMenuVisible = !1, selectedSlashIndex = 0
}

function insertPromptAtSlash(e) {
  if (window._sgPromptsHintClose && (window._sgPromptsHintClose(), window._sgPromptsHintClose = null), !currentInputForSlash) return;
  const t = window.getSelection();
  if (!t || !t.rangeCount) return;
  const n = t.getRangeAt(0);
  let o = n.startContainer,
    r = n.startOffset;
  o.nodeType !== Node.TEXT_NODE && (o.childNodes[r] ? (o = o.childNodes[r], r = 0) : o.childNodes[r - 1] && (o = o.childNodes[r - 1], r = o.textContent?.length || 0));
  const s = (o.textContent || "").substring(0, r),
    a = "chains" === slashTriggerType ? ",," : "//",
    i = s.lastIndexOf(a);
  if (-1 === i) return hideSlashMenu(), void handlePromptVariables(e.text, async t => {
    if (isCurrentlyGenerating && isQueueingEnabled && e.autosend) {
      tryEnqueueMessage(`[PROMPT:${e.title}] ` + t) && (showToast(`Prompt "${e.title}" added to queue`, "info"), setPromptText(""))
    } else if (pastePromptText(t, currentInputForSlash), e.mode && "none" !== e.mode && (await switchMode(e.mode), e.tool && "none" !== e.tool && await new Promise(e => setTimeout(e, 300))), e.tool && "none" !== e.tool && await selectTool(e.tool), e.autosend) {
      await new Promise(e => setTimeout(e, 500));
      const e = document.querySelector(".send-button");
      e && !e.disabled && e.click()
    }
  });
  hideSlashMenu(), currentInputForSlash.focus();
  const l = window.getSelection(),
    c = document.createRange();
  try {
    c.setStart(o, i), c.setEnd(o, r), l.removeAllRanges(), l.addRange(c), document.execCommand("insertText", !1, "")
  } catch (e) {
    console.error("[Gemini Power Suite] Range error:", e), setPromptText("")
  }
  let d = null;
  try {
    window.getSelection().rangeCount > 0 && (d = window.getSelection().getRangeAt(0).cloneRange())
  } catch (e) {}
  "chains" !== slashTriggerType ? handlePromptVariables(e.text, async t => {
    if (d && (!isCurrentlyGenerating || !isQueueingEnabled)) try {
      const e = window.getSelection();
      e.removeAllRanges(), e.addRange(d)
    } catch (e) {}
    if (isCurrentlyGenerating && isQueueingEnabled && e.autosend) {
      if (tryEnqueueMessage(`[PROMPT:${e.title}] ` + t)) {
        showToast(`Prompt "${e.title}" added to queue`, "info");
        const t = currentInputForSlash || findPromptInput();
        t && ("DIV" === t.tagName ? (() => {
          const p = document.createElement("p");
          p.appendChild(document.createElement("br"));
          "function" == typeof t.replaceChildren ? t.replaceChildren(p) : (t.textContent = "", t.appendChild(p));
        })() : t.value = "", triggerWordCounterUpdate())
      }
    } else if (pastePromptText(t, currentInputForSlash), triggerWordCounterUpdate(), e.mode && "none" !== e.mode && (await switchMode(e.mode), e.tool && "none" !== e.tool && await new Promise(e => setTimeout(e, 300))), e.tool && "none" !== e.tool && await selectTool(e.tool), e.autosend) {
      await new Promise(e => setTimeout(e, 500));
      const e = document.querySelector(".send-button");
      e && !e.disabled && e.click()
    }
  }) : runChain(e)
}

function setupNativeSettingsMenuObserver() {
  sgObserverRegistry.registerUIRefresh("nativeSettingsMenu", () => {
    const e = document.querySelector(".desktop-settings-menu");
    e && injectNativeSettingsMenuItem(e)
  })
}

function injectNativeSettingsMenuItem(e) {
  if (e.querySelector("#sg-native-settings-btn")) return;
  const t = e.querySelector(".mat-mdc-menu-content");
  if (!t) return;
  const n = isDarkTheme(),
    o = getThemeColors(n),
    r = !!t.querySelector(".mat-mdc-menu-item.lm-menu-item-theme"),
    s = document.createElement("button");
  if (s.id = "sg-native-settings-btn", s.setAttribute("role", "menuitem"), s.setAttribute("tabindex", "0"), r) {
    s.className = "mat-mdc-menu-item mat-focus-indicator lm-menu-item-theme";
    const e = document.createElement("span");
    e.className = "mat-mdc-menu-item-text";
    const t = document.createElement("gem-icon");
    t.className = "gds-icon-l gem-menu-item-icon", t.setAttribute("size", "large");
    const n = document.createElement("mat-icon");
    n.className = "mat-icon notranslate lm-icon-l google-symbols mat-ligature-font mat-icon-no-color", n.setAttribute("role", "img"), n.setAttribute("aria-hidden", "true"), n.setAttribute("data-mat-icon-type", "font"), n.setAttribute("data-mat-icon-name", "settings"), n.setAttribute("fonticon", "settings"), t.appendChild(n);
    const o = document.createElement("span");
    o.className = "gds-label-l gem-menu-item-label", o.textContent = "Gemini Power Suite settings", e.appendChild(t), e.appendChild(o);
    const r = document.createElement("div");
    r.className = "mat-ripple mat-mdc-menu-ripple", s.appendChild(e), s.appendChild(r)
  } else {
    s.className = "mat-mdc-menu-item mat-focus-indicator", s.style.cssText = `\n      display: flex;\n      align-items: center;\n      width: 100%;\n      min-height: 48px;\n      height: 48px;\n      margin: 0;\n      border: none;\n      background: transparent;\n      cursor: pointer;\n      font-family: inherit;\n      font-size: 14px;\n      font-weight: 500;\n      color: var(--gem-sys-color--on-surface, ${o.textPrimary});\n      text-align: left;\n      position: relative;\n      overflow: hidden;\n      gap: 12px;\n      box-sizing: border-box;\n      padding: 0 16px 0 12px; /* Moved slightly right */\n    `;
    const e = document.createElement("mat-icon");
    e.className = "mat-icon notranslate gds-icon-l google-symbols mat-ligature-font mat-icon-no-color", e.setAttribute("role", "img"), e.setAttribute("aria-hidden", "true"), e.style.cssText = "\n      width: 24px;\n      height: 24px;\n      font-size: 24px;\n      display: flex;\n      align-items: center;\n      justify-content: center;\n      flex-shrink: 0;\n      margin-left: 0px; /* Moved slightly right */\n    ", e.textContent = "settings";
    const t = document.createElement("span");
    t.className = "mat-mdc-menu-item-text", t.style.flex = "1", t.style.marginLeft = "-16px";
    const n = document.createElement("span");
    n.className = "gds-label-l", n.textContent = "Gemini Power Suite settings", t.appendChild(n);
    const r = document.createElement("div");
    r.className = "mat-ripple mat-mdc-menu-ripple", s.appendChild(e), s.appendChild(t), s.appendChild(r)
  }
  const a = n ? "#2e2f2f" : "#d7dadf",
    i = n ? "#2e2f2f" : "#d7dadf";
  s.addEventListener("mouseenter", () => {
    const e = Array.from(t.children).find(e => e !== s && e.classList.contains("mat-mdc-menu-item") && e.getAttributeNames().some(e => e.startsWith("_ng")));
    e && e.dispatchEvent(new MouseEvent("mouseenter", {
      bubbles: !0
    })), Array.from(t.children).forEach(e => {
      e !== s && e.style && (e.style.backgroundColor = "transparent")
    }), document.activeElement && document.activeElement !== s && document.activeElement.blur(), r || (s.style.backgroundColor = a)
  });
  const l = () => {
    r || (s.style.backgroundColor = "transparent"), Array.from(t.children).forEach(e => {
      e !== s && e.style && (e.style.backgroundColor = "")
    })
  };
  s.addEventListener("mouseleave", l), s.addEventListener("focus", () => {
    Array.from(t.children).forEach(e => {
      e !== s && e.style && (e.style.backgroundColor = "transparent")
    }), r || (s.style.backgroundColor = i)
  }), s.addEventListener("blur", l);
  t.addEventListener("keydown", e => {
    if ("ArrowUp" !== e.key && "ArrowDown" !== e.key) return;
    const n = Array.from(t.querySelectorAll(".mat-mdc-menu-item")),
      o = n.indexOf(document.activeElement); - 1 !== o && ("ArrowDown" === e.key ? document.activeElement === s ? (e.preventDefault(), e.stopImmediatePropagation(), n[0].focus()) : o === n.length - 2 && (e.preventDefault(), e.stopImmediatePropagation(), s.focus()) : "ArrowUp" === e.key && (document.activeElement === s ? (e.preventDefault(), e.stopImmediatePropagation(), n[o - 1].focus()) : 0 === o && (e.preventDefault(), e.stopImmediatePropagation(), s.focus())))
  }, !0), s.addEventListener("click", e => {
    e.stopPropagation();
    const t = document.querySelector(".cdk-overlay-backdrop");
    t && t.click(), sgSafeSendMessage({
      type: "OPEN_POPUP"
    })
  }), t.appendChild(s)
}

function setupTemporaryChatModelObserver() {
  document.addEventListener("click", async e => {
    const t = e.target.closest(GEMINI_SELECTORS.tempChatToggle.join(", "));
    if (!t) return;
    const n = () => {
        if (isTempChatActive()) return !0;
        const e = t.closest("ms-incognito-mode-toggle");
        return t.classList.contains("temp-chat-on") || t.classList.contains("ms-button-active") || t.classList.contains("active") || t.classList.contains("selected") || "true" === t.getAttribute("aria-pressed") || !!e?.classList.contains("active")
      },
      o = n();
    setTimeout(async () => {
      let e = n();
      for (let t = 100; e === o && t < 2e3; t += 50) await new Promise(e => setTimeout(e, 50)), e = n();
      if (e !== o)
        if (e) {
          const e = (await sgSyncGetCached(["tempChatModel"])).tempChatModel || "none";
          "none" !== e && (await new Promise(e => setTimeout(e, 300)), switchModeSilent(e))
        } else {
          const e = (await sgSyncGetCached(["defaultModel"])).defaultModel || "none";
          if ("none" !== e) {
            const t = {
              flash: "Fast",
              thinking: "Thinking",
              pro: "Pro"
            } [e];
            t && (await new Promise(e => setTimeout(e, 300)), switchModeSilent(t))
          }
        }
    }, 100)
  }, !0)
}
SG_IS_SILENT_BG_WORKER_TAB || (setupNativeSettingsMenuObserver(), initSlashCommands(), document.addEventListener("mousedown", e => {
  !slashMenuElement || slashMenuElement.contains(e.target) || currentInputForSlash?.contains(e.target) || hideSlashMenu()
}), document.addEventListener("keydown", e => {
  if (sgIsImeComposing(e) || "/" !== e.key || e.ctrlKey || e.altKey || e.shiftKey || e.metaKey) return;
  if (!isExtensionEnabled || !isFocusShortcutEnabled) return;
  if (document.querySelector(".sg-modal-overlay.show") || document.getElementById("sg-settings-host")) return;
  const t = document.activeElement;
  if (!("INPUT" === t.tagName || "TEXTAREA" === t.tagName || "SELECT" === t.tagName || "BUTTON" === t.tagName || t.isContentEditable || t.hasAttribute("tabindex") && "-1" !== t.getAttribute("tabindex")) && t === document.body) {
    e.preventDefault();
    const t = findPromptInput();
    if (t)
      if (t.focus(), t.isContentEditable) {
        const e = document.createRange();
        e.selectNodeContents(t), e.collapse(!1);
        const n = window.getSelection();
        n.removeAllRanges(), n.addRange(e)
      } else if ("function" == typeof t.setSelectionRange) {
        const e = t.value.length;
        t.setSelectionRange(e, e)
      }
  }
}), setTimeout(() => {
  setupTemporaryChatModelObserver()
}, 1e3));
const DRIVE_SYNC_STATE_KEY = "driveSyncState",
  DRIVE_SYNC_DEBOUNCE_MS = 2500,
  DRIVE_SYNC_RETRY_DELAYS = [3e4, 12e4, 6e5],
  DRIVE_SYNC_MAX_CONFLICT_RETRIES = 3,
  DRIVE_SYNC_MAX_PAYLOAD_BYTES = 15728640;
let driveSyncState = null,
  driveSyncEnabledFlag = !1,
  driveSyncInFlight = !1,
  driveSyncQueued = !1,
  driveSyncDebounceTimer = null,
  driveSyncRetryTimer = null,
  driveSyncRetryAttempt = 0,
  driveSyncConflictAttempt = 0;
const driveSyncExpectedFps = new Map;
let driveSyncExpectedFpsGc = null;
const driveSyncStatusListeners = new Set;

function driveSyncGenerateDeviceId() {
  return "dev_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10)
}
async function loadDriveSyncState() {
  try {
    const e = await chrome.storage.local.get("driveSyncState");
    driveSyncState = e.driveSyncState || {}, driveSyncState.deviceId || (driveSyncState.deviceId = driveSyncGenerateDeviceId(), await chrome.storage.local.set({
      [DRIVE_SYNC_STATE_KEY]: driveSyncState
    }))
  } catch (e) {
    driveSyncState = {
      deviceId: driveSyncGenerateDeviceId()
    }
  }
}
async function saveDriveSyncState(e) {
  driveSyncState = Object.assign({}, driveSyncState || {}, e);
  try {
    await chrome.storage.local.set({
      [DRIVE_SYNC_STATE_KEY]: driveSyncState
    })
  } catch (e) {}
  notifyDriveSyncStatusListeners()
}
async function clearDriveSyncState() {
  driveSyncState = {
    deviceId: driveSyncState && driveSyncState.deviceId || driveSyncGenerateDeviceId()
  };
  try {
    await chrome.storage.local.remove("driveSyncState")
  } catch (e) {}
  notifyDriveSyncStatusListeners()
}

function onDriveSyncStatusChange(e) {
  return driveSyncStatusListeners.add(e), () => driveSyncStatusListeners.delete(e)
}

function notifyDriveSyncStatusListeners() {
  driveSyncStatusListeners.forEach(e => {
    try {
      e(driveSyncState || {})
    } catch (e) {}
  })
}
const TOMB_GC_MS = 2592e6;

function emptyFoldersData() {
  return {
    folders: [],
    recycleBin: [],
    permanentlyDeleted: [],
    permanentlyDeletedAt: {},
    restoredFromBinAt: {},
    deletedFolders: []
  }
}
const SG_SORT_SPACING = 1024;

function sgComputeNewSortIndex(e, t) {
  if (null == e && null == t) return SG_SORT_SPACING;
  if (null == e) return t - SG_SORT_SPACING;
  if (null == t) return e + SG_SORT_SPACING;
  const n = (e + t) / 2;
  return n <= e || n >= t ? null : n
}

function sgRebalanceSortIndices(e, t) {
  for (let n = 0; n < e.length; n++) e[n].sortIndex = (n + 1) * SG_SORT_SPACING, e[n].sortIndexAt = t
}

function sgEnsureSortIndices(e) {
  if (!Array.isArray(e)) return !1;
  let t = !1,
    n = 0;
  for (const t of e) t && "number" == typeof t.sortIndex && t.sortIndex > n && (n = t.sortIndex);
  for (let o = 0; o < e.length; o++) {
    const r = e[o];
    r && ("number" != typeof r.sortIndex ? (n += SG_SORT_SPACING, r.sortIndex = n, "number" != typeof r.sortIndexAt && (r.sortIndexAt = 0), t = !0) : "number" != typeof r.sortIndexAt && (r.sortIndexAt = 0, t = !0))
  }
  return t
}

function sgNextSortIndex(e) {
  let t = 0;
  if (Array.isArray(e))
    for (const n of e) n && "number" == typeof n.sortIndex && n.sortIndex > t && (t = n.sortIndex);
  return t + SG_SORT_SPACING
}

function driveSyncStableStringify(e) {
  const t = e => {
    if (null === e || "object" != typeof e) return e;
    if (Array.isArray(e)) return e.map(t);
    const n = {};
    return Object.keys(e).sort().forEach(o => {
      n[o] = t(e[o])
    }), n
  };
  return JSON.stringify(t(e))
}

function driveSyncFingerprint(e) {
  const t = e => Array.isArray(e) ? e : [];
  let n = 5381,
    o = 0,
    r = 0;
  const s = e => {
      n = (n << 5) + n ^ (e |= 0) | 0, o = 31 * o + e | 0, r++
    },
    a = e => {
      if (!e) return void s(0);
      const t = String(e);
      for (let e = 0; e < t.length; e++) s(t.charCodeAt(e))
    },
    i = e || {};
  for (const e of t(i.folders)) {
    if (!e) {
      s(0);
      continue
    }
    a(e.id), s(e.lastModified || 0);
    const n = t(e.chats);
    s(n.length);
    for (const e of n) a(e && e.id), s(e && e.pinned ? 1 : 0);
    const o = t(e.removedChats);
    s(o.length);
    for (const e of o) e ? (a(e.chatId), s(e.removedAt || 0)) : s(0)
  }
  for (const e of t(i.recycleBin)) e ? (a(e.id), s(e.deletedAt || 0)) : s(0);
  for (const e of t(i.permanentlyDeleted)) a(e);
  const l = i.permanentlyDeletedAt && "object" == typeof i.permanentlyDeletedAt ? i.permanentlyDeletedAt : {},
    c = Object.keys(l).sort();
  for (const e of c) a(e), s(l[e] || 0);
  const d = i.restoredFromBinAt && "object" == typeof i.restoredFromBinAt ? i.restoredFromBinAt : {},
    u = Object.keys(d).sort();
  for (const e of u) a(e), s(d[e] || 0);
  for (const e of t(i.deletedFolders)) e ? (a(e.id), s(e.deletedAt || 0)) : s(0);
  for (const e of t(i.prompts)) e ? (a(e.id), s(e.lastModified || 0), s(e.sortIndex || 0), s(e.sortIndexAt || 0)) : s(0);
  for (const e of t(i.deletedPrompts)) e ? (a(e.id), s(e.deletedAt || 0)) : s(0);
  for (const e of t(i.chains)) e ? (a(e.id), s(e.lastModified || 0), s(e.sortIndex || 0), s(e.sortIndexAt || 0)) : s(0);
  for (const e of t(i.deletedChains)) e ? (a(e.id), s(e.deletedAt || 0)) : s(0);
  const p = i.bookmarks && "object" == typeof i.bookmarks ? i.bookmarks : {};
  for (const e of Object.keys(p).sort()) {
    a(e);
    const n = t(p[e]).map(e => "string" == typeof e ? {
      id: e,
      ts: 0
    } : e).filter(e => e && e.id).sort((e, t) => String(e.id) < String(t.id) ? -1 : String(e.id) > String(t.id) ? 1 : 0);
    s(n.length);
    for (const e of n) a(e.id), s(e.ts || 0)
  }
  for (const e of t(i.deletedBookmarks)) e ? (a(e.id), s(e.deletedAt || 0)) : s(0);
  return n.toString(36) + ":" + o.toString(36) + ":" + r
}

function driveSyncFingerprintForKey(e, t) {
  const n = t || {};
  if (e === FOLDERS_STORAGE_KEY) return driveSyncFingerprint({
    folders: n.folders,
    recycleBin: n.recycleBin,
    permanentlyDeleted: n.permanentlyDeleted,
    permanentlyDeletedAt: n.permanentlyDeletedAt,
    restoredFromBinAt: n.restoredFromBinAt,
    deletedFolders: n.deletedFolders
  });
  if (e === PROMPTS_STORAGE_KEY) return driveSyncFingerprint({
    prompts: n.prompts,
    deletedPrompts: n.deletedPrompts
  });
  if (e === CHAINS_STORAGE_KEY) return driveSyncFingerprint({
    chains: n.chains,
    deletedChains: n.deletedChains
  });
  if (e === SG_BOOKMARKS_STORAGE_KEY) {
    const {
      chats: e,
      deleted: t
    } = sgUnwrapBookmarksStored(n);
    return driveSyncFingerprint({
      bookmarks: e,
      deletedBookmarks: t
    })
  }
  return null
}

function mergeFoldersData(e, t) {
  const n = e || emptyFoldersData(),
    o = t || emptyFoldersData(),
    r = e => Array.isArray(e) ? e : [],
    s = Date.now(),
    a = n.restoredFromBinAt && "object" == typeof n.restoredFromBinAt ? n.restoredFromBinAt : {},
    i = o.restoredFromBinAt && "object" == typeof o.restoredFromBinAt ? o.restoredFromBinAt : {},
    l = {};
  for (const e of [...Object.keys(a), ...Object.keys(i)]) {
    const t = Math.max(a[e] || 0, i[e] || 0);
    t && ((!l[e] || t > l[e]) && (l[e] = t))
  }
  const c = e => {
      if (!e) return 0;
      const t = e.startsWith("c_") ? e.substring(2) : "c_" + e;
      return Math.max(l[e] || 0, l[t] || 0)
    },
    d = n.permanentlyDeletedAt && "object" == typeof n.permanentlyDeletedAt ? n.permanentlyDeletedAt : {},
    u = o.permanentlyDeletedAt && "object" == typeof o.permanentlyDeletedAt ? o.permanentlyDeletedAt : {},
    p = {};
  for (const e of [...r(n.permanentlyDeleted), ...r(o.permanentlyDeleted)]) {
    const t = Math.max(d[e] || 0, u[e] || 0) || s;
    (!p[e] || t > p[e]) && (p[e] = t)
  }
  for (const e of Object.keys(p)) c(e) >= p[e] && delete p[e];
  const g = new Set(Object.keys(p).filter(e => s - p[e] < 2592e6)),
    m = new Map;
  for (const e of [...r(n.deletedFolders), ...r(o.deletedFolders)]) {
    if (!e || !e.id) continue;
    const t = m.get(e.id),
      n = e.deletedAt || 0;
    (!t || n > t.deletedAt) && m.set(e.id, {
      id: e.id,
      deletedAt: n
    })
  }
  const h = new Map(r(n.folders).map(e => [e.id, e])),
    f = new Map(r(o.folders).map(e => [e.id, e])),
    y = [],
    b = new Set,
    v = e => {
      if (b.has(e) || g.has(e)) return;
      b.add(e);
      const t = h.get(e),
        n = f.get(e),
        o = m.get(e);
      if (o) {
        if (Math.max(t?.lastModified || 0, n?.lastModified || 0) <= o.deletedAt) return;
        m.delete(e)
      }
      let a, i, l;
      if (t && n) {
        const e = t.lastModified || 0,
          o = (n.lastModified || 0) > e ? n : t,
          s = o === t ? n : t;
        a = o, i = o.lastModified || 0, l = [{
          chats: r(o.chats),
          time: i
        }, {
          chats: r(s.chats),
          time: s.lastModified || 0
        }]
      } else a = t || n, i = a.lastModified || 0, l = [{
        chats: r(a.chats),
        time: i
      }];
      const c = new Map;
      for (const e of [t, n])
        if (e)
          for (const t of r(e.removedChats)) {
            if (!t || !t.chatId) continue;
            const e = t.removedAt || 0,
              n = c.get(t.chatId);
            (!n || e > n.removedAt) && c.set(t.chatId, {
              chatId: t.chatId,
              removedAt: e
            })
          }
      const d = new Map;
      for (const e of l)
        for (const t of e.chats) {
          if (!t || !t.id || g.has(t.id) || d.has(t.id)) continue;
          const n = c.get(t.id);
          n && n.removedAt >= e.time || d.set(t.id, t)
        }
      const u = [];
      for (const e of c.values()) s - e.removedAt >= 2592e6 || d.has(e.chatId) || u.push(e);
      y.push(Object.assign({}, a, {
        chats: Array.from(d.values()),
        removedChats: u
      }))
    };
  for (const e of h.keys()) v(e);
  for (const e of f.keys()) v(e);
  const x = new Map;
  for (const e of [...r(n.recycleBin), ...r(o.recycleBin)]) {
    if (!e || !e.id || g.has(e.id)) continue;
    if (c(e.id) >= (e.deletedAt || 0)) continue;
    const t = x.get(e.id);
    (!t || (e.deletedAt || 0) > (t.deletedAt || 0)) && x.set(e.id, e)
  }
  const w = (e, t, n, o) => {
      const a = new Map;
      for (const e of [...r(n), ...r(o)]) {
        if (!e || !e.id) continue;
        const t = e.deletedAt || 0,
          n = a.get(e.id);
        (!n || t > n.deletedAt) && a.set(e.id, {
          id: e.id,
          deletedAt: t
        })
      }
      const i = new Map(r(e).map(e => [e.id, e])),
        l = new Map(r(t).map(e => [e.id, e])),
        c = [],
        d = new Set,
        u = e => {
          if (d.has(e) || g.has(e)) return;
          d.add(e);
          const t = i.get(e),
            n = l.get(e),
            o = a.get(e);
          if (o) {
            if (Math.max(t?.lastModified || 0, n?.lastModified || 0) <= o.deletedAt) return;
            a.delete(e)
          }
          if (t && n) {
            const e = (t.lastModified || 0) >= (n.lastModified || 0) ? t : n,
              o = (t.sortIndexAt || 0) >= (n.sortIndexAt || 0) ? t : n;
            o === e || "number" != typeof o.sortIndex ? c.push(e) : c.push(Object.assign({}, e, {
              sortIndex: o.sortIndex,
              sortIndexAt: o.sortIndexAt || 0
            }))
          } else c.push(t || n)
        };
      for (const e of i.keys()) u(e);
      for (const e of l.keys()) u(e);
      let p = 0;
      for (const e of c) e && "number" == typeof e.sortIndex && e.sortIndex > p && (p = e.sortIndex);
      for (let e = 0; e < c.length; e++) {
        const t = c[e];
        t && "number" != typeof t.sortIndex && (p += SG_SORT_SPACING, c[e] = Object.assign({}, t, {
          sortIndex: p,
          sortIndexAt: t.sortIndexAt || 0
        }))
      }
      c.sort((e, t) => (e.sortIndex || 0) - (t.sortIndex || 0));
      const m = [];
      for (const e of a.values()) s - e.deletedAt >= 2592e6 || m.push(e);
      return {
        items: c,
        tombs: m
      }
    },
    S = w(n.prompts, o.prompts, n.deletedPrompts, o.deletedPrompts),
    E = w(n.chains, o.chains, n.deletedChains, o.deletedChains),
    k = (() => {
      const e = new Map;
      for (const t of [...r(n.deletedBookmarks), ...r(o.deletedBookmarks)]) {
        if (!t || !t.id) continue;
        const n = t.deletedAt || 0,
          o = e.get(t.id);
        (!o || n > o.deletedAt) && e.set(t.id, {
          id: t.id,
          deletedAt: n
        })
      }
      const t = e => {
          const t = new Map,
            n = e && "object" == typeof e ? e : {};
          for (const e of Object.keys(n))
            if (Array.isArray(n[e]))
              for (const o of n[e]) {
                const n = "string" == typeof o ? {
                  id: o,
                  text: "",
                  ts: 0
                } : o;
                n && n.id && t.set(n.id, Object.assign({}, n, {
                  chatId: e
                }))
              }
          return t
        },
        a = t(n.bookmarks),
        i = t(o.bookmarks),
        l = {},
        c = new Set,
        d = t => {
          if (c.has(t)) return;
          c.add(t);
          const n = a.get(t),
            o = i.get(t),
            r = e.get(t);
          if (r) {
            if (Math.max(n?.ts || 0, o?.ts || 0) <= r.deletedAt) return;
            e.delete(t)
          }
          let s;
          if (n && o) {
            s = (n.ts || 0) >= (o.ts || 0) ? n : o;
            const e = s === n ? o : n;
            s = Object.assign({}, s), !s.text && e.text && (s.text = e.text), "number" != typeof s.pos && "number" == typeof e.pos && (s.pos = e.pos)
          } else s = Object.assign({}, n || o);
          const d = s.chatId;
          d && (delete s.chatId, l[d] || (l[d] = []), l[d].push(s))
        };
      for (const e of a.keys()) d(e);
      for (const e of i.keys()) d(e);
      const u = [];
      for (const t of e.values()) s - t.deletedAt >= 2592e6 || u.push(t);
      return {
        bookmarks: l,
        tombs: u
      }
    })(),
    T = {};
  for (const e of Object.keys(l)) s - l[e] >= 2592e6 || (T[e] = l[e]);
  const C = [];
  for (const e of m.values()) s - e.deletedAt >= 2592e6 || C.push(e);
  const A = {
    folders: y,
    recycleBin: Array.from(x.values()),
    permanentlyDeleted: Array.from(g),
    permanentlyDeletedAt: Object.fromEntries(Object.entries(p).filter(([e]) => g.has(e))),
    restoredFromBinAt: T,
    deletedFolders: C,
    prompts: S.items,
    deletedPrompts: S.tombs,
    chains: E.items,
    deletedChains: E.tombs,
    bookmarks: k.bookmarks,
    deletedBookmarks: k.tombs
  };
  for (const e of Object.keys(n)) e in A || (A[e] = n[e]);
  for (const e of Object.keys(o)) e in A || (A[e] = o[e]);
  return A
}

function driveSyncScheduleRetry() {
  driveSyncRetryTimer && clearTimeout(driveSyncRetryTimer);
  const e = DRIVE_SYNC_RETRY_DELAYS[Math.min(driveSyncRetryAttempt, DRIVE_SYNC_RETRY_DELAYS.length - 1)];
  driveSyncRetryAttempt++, driveSyncRetryTimer = setTimeout(() => {
    driveSyncRetryTimer = null, driveSyncNow("retry")
  }, e)
}

function driveSyncScheduleDebounced(e) {
  driveSyncEnabledFlag && (driveSyncDebounceTimer && clearTimeout(driveSyncDebounceTimer), driveSyncDebounceTimer = setTimeout(() => {
    driveSyncDebounceTimer = null, driveSyncNow(e || "local-change")
  }, 2500))
}

function driveSyncBuildPayload(e) {
  const t = {
      folders: Array.isArray(e.folders) ? e.folders : [],
      recycleBin: Array.isArray(e.recycleBin) ? e.recycleBin : [],
      permanentlyDeleted: Array.isArray(e.permanentlyDeleted) ? e.permanentlyDeleted : [],
      permanentlyDeletedAt: e.permanentlyDeletedAt && "object" == typeof e.permanentlyDeletedAt ? e.permanentlyDeletedAt : {},
      restoredFromBinAt: e.restoredFromBinAt && "object" == typeof e.restoredFromBinAt ? e.restoredFromBinAt : {},
      deletedFolders: Array.isArray(e.deletedFolders) ? e.deletedFolders : [],
      prompts: Array.isArray(e.prompts) ? e.prompts : [],
      deletedPrompts: Array.isArray(e.deletedPrompts) ? e.deletedPrompts : [],
      chains: Array.isArray(e.chains) ? e.chains : [],
      deletedChains: Array.isArray(e.deletedChains) ? e.deletedChains : [],
      bookmarks: e.bookmarks && "object" == typeof e.bookmarks ? e.bookmarks : {},
      deletedBookmarks: Array.isArray(e.deletedBookmarks) ? e.deletedBookmarks : []
    },
    n = {};
  for (const o of Object.keys(e || {})) o in t || (n[o] = e[o]);
  return {
    version: 1,
    deviceId: driveSyncState && driveSyncState.deviceId || "unknown",
    updatedAt: Date.now(),
    data: Object.assign(n, t)
  }
}

function driveSyncBuildCheckedPayload(e) {
  const t = driveSyncBuildPayload(e),
    n = JSON.stringify(t),
    o = new Blob([n]).size;
  return o > 15728640 ? {
    ok: !1,
    oversize: !0,
    sizeBytes: o
  } : {
    ok: !0,
    payload: t,
    sizeBytes: o
  }
}
async function driveSyncHandleOversize(e) {
  const t = (e / 1048576).toFixed(1),
    n = 15..toFixed(0),
    o = `Payload is ${t} MB (limit ${n} MB)`;
  await saveDriveSyncState({
    lastSyncStatus: "error",
    lastSyncError: o
  });
  try {
    showToast(`Drive sync: data is too large to upload (${t} MB > ${n} MB limit). Reduce folder, prompt, chain, or bookmark content.`, "error")
  } catch (e) {}
}
async function driveSyncSendMessage(e, t) {
  return new Promise(n => {
    try {
      chrome.runtime.sendMessage(Object.assign({
        type: e
      }, t || {}), e => {
        chrome.runtime.lastError ? n({
          ok: !1,
          error: chrome.runtime.lastError.message
        }) : n(e || {
          ok: !1,
          error: "no response"
        })
      })
    } catch (e) {
      n({
        ok: !1,
        error: e.message
      })
    }
  })
}

function wireDriveSyncButton(e) {
  const t = e.querySelector("#sg-folder-sync-btn");
  if (!t) return;
  const n = e => {
    const n = void 0 !== driveSyncEnabledFlag && driveSyncEnabledFlag;
    t.style.display = n ? "flex" : "none", t.classList.remove("is-syncing", "is-ok", "is-error");
    const o = e && e.lastSyncStatus;
    if ("syncing" === o) t.classList.add("is-syncing"), t.disabled = !0, t.title = "Syncing with Google Drive…";
    else if ("error" === o) t.classList.add("is-error"), t.disabled = !1, t.title = "Sync failed: " + (e.lastSyncError || "unknown error") + " (click to retry)";
    else {
      if (t.disabled = !1, e && e.lastSyncAt) {
        const n = Math.max(0, Date.now() - e.lastSyncAt),
          o = Math.floor(n / 6e4),
          r = o < 1 ? "just now" : o < 60 ? `${o} min ago` : `${Math.floor(o/60)}h ago`;
        t.title = `Last synced: ${r} — click to sync now`
      } else t.title = "Sync with Google Drive";
      "ok" === o && (t.classList.add("is-ok"), setTimeout(() => t.classList.remove("is-ok"), 1500))
    }
  };
  n(driveSyncState);
  const o = onDriveSyncStatusChange(n),
    r = new MutationObserver(() => {
      e.isConnected || (o(), r.disconnect())
    });
  r.observe(e.parentNode || document.body, {
    childList: !0
  }), t.addEventListener("click", () => {
    driveSyncEnabledFlag && driveSyncNow("manual")
  })
}
async function driveSyncReRenderModalIfOpen() {
  const e = document.querySelector(".sg-folders-modal");
  if (!e) return;
  const t = !!e.querySelector("#sg-tab-prompts"),
    n = e.dataset.activeTab;
  if (t) {
    if (!e.querySelector(".sg-tabs-pill")) return;
    if ("function" == typeof e._sgClose) try {
      e._sgClose()
    } catch (e) {}
    if (e.remove(), "function" == typeof showPromptsModal) try {
      await showPromptsModal(n)
    } catch (e) {}
  } else if ("function" == typeof showFoldersModal) try {
    showFoldersModal(n)
  } catch (e) {}
}
async function driveSyncApplyMergedLocally(e) {
  const t = {
    folders: Array.isArray(e.folders) ? e.folders : [],
    recycleBin: Array.isArray(e.recycleBin) ? e.recycleBin : [],
    permanentlyDeleted: Array.isArray(e.permanentlyDeleted) ? e.permanentlyDeleted : [],
    permanentlyDeletedAt: e.permanentlyDeletedAt && "object" == typeof e.permanentlyDeletedAt ? e.permanentlyDeletedAt : {},
    restoredFromBinAt: e.restoredFromBinAt && "object" == typeof e.restoredFromBinAt ? e.restoredFromBinAt : {},
    deletedFolders: Array.isArray(e.deletedFolders) ? e.deletedFolders : []
  };
  for (const n of Object.keys(e)) n in t || "prompts" !== n && "deletedPrompts" !== n && "chains" !== n && "deletedChains" !== n && "bookmarks" !== n && "deletedBookmarks" !== n && (t[n] = e[n]);
  const n = {
      prompts: Array.isArray(e.prompts) ? e.prompts : [],
      deletedPrompts: Array.isArray(e.deletedPrompts) ? e.deletedPrompts : []
    },
    o = {
      chains: Array.isArray(e.chains) ? e.chains : [],
      deletedChains: Array.isArray(e.deletedChains) ? e.deletedChains : []
    },
    r = {
      v: 2,
      chats: e.bookmarks && "object" == typeof e.bookmarks ? e.bookmarks : {},
      deleted: Array.isArray(e.deletedBookmarks) ? e.deletedBookmarks : []
    };
  try {
    const [e, s] = await Promise.all([chrome.storage.local.getBytesInUse(null), chrome.storage.local.getBytesInUse([FOLDERS_STORAGE_KEY, PROMPTS_STORAGE_KEY, CHAINS_STORAGE_KEY, SG_BOOKMARKS_STORAGE_KEY])]), a = e - s + new Blob([JSON.stringify({
      [FOLDERS_STORAGE_KEY]: t,
      [PROMPTS_STORAGE_KEY]: n,
      [CHAINS_STORAGE_KEY]: o,
      [SG_BOOKMARKS_STORAGE_KEY]: r
    })]).size;
    if (a > 20971520) {
      driveSyncExpectedFps.clear(), driveSyncExpectedFpsGc && (clearTimeout(driveSyncExpectedFpsGc), driveSyncExpectedFpsGc = null);
      const e = (a / 1048576).toFixed(2),
        t = 20..toFixed(0),
        n = `Local storage full — cannot apply remote changes (${e} MB > ${t} MB)`;
      await saveDriveSyncState({
        lastSyncStatus: "error",
        lastSyncError: n
      });
      try {
        showToast(`Drive sync: local storage full, cannot pull remote changes (${e} MB > ${t} MB). Free space and retry.`, "error")
      } catch (e) {}
      return !1
    }
  } catch (e) {}
  return foldersData = t, promptsData = n, chainsData = o, _sgBookmarks = r.chats, _sgBookmarkTombs = r.deleted, sgRebuildBookmarkIndex(), driveSyncExpectedFps.set(FOLDERS_STORAGE_KEY, driveSyncFingerprintForKey(FOLDERS_STORAGE_KEY, foldersData)), driveSyncExpectedFps.set(PROMPTS_STORAGE_KEY, driveSyncFingerprintForKey(PROMPTS_STORAGE_KEY, promptsData)), driveSyncExpectedFps.set(CHAINS_STORAGE_KEY, driveSyncFingerprintForKey(CHAINS_STORAGE_KEY, chainsData)), driveSyncExpectedFps.set(SG_BOOKMARKS_STORAGE_KEY, driveSyncFingerprintForKey(SG_BOOKMARKS_STORAGE_KEY, r)), driveSyncExpectedFpsGc && clearTimeout(driveSyncExpectedFpsGc), driveSyncExpectedFpsGc = setTimeout(() => {
    driveSyncExpectedFps.clear(), driveSyncExpectedFpsGc = null
  }, 5e3), await saveFoldersData(), await savePromptsData(!0), await saveChainsData(!0), await sgSaveBookmarks(), isBookmarksEnabled && (sgApplyAllBookmarkStates(), sgRefreshBookmarksHeaderButton()), await driveSyncReRenderModalIfOpen(), !0
}
async function driveSyncHandleFatalAuthError(e) {
  await saveDriveSyncState({
    lastSyncStatus: "error",
    lastSyncError: e || "Drive access revoked"
  });
  try {
    showToast("Drive sync disabled: " + (e || "access revoked"), "error")
  } catch (e) {}
  driveSyncEnabledFlag = !1;
  try {
    await chrome.storage.sync.set({
      driveSyncEnabled: !1
    }), chrome.runtime.sendMessage({
      type: "DRIVE_SYNC_DISCONNECT"
    })
  } catch (e) {}
}
function driveSyncScheduleConflictRetry(e) {
  driveSyncConflictAttempt++;
  if (driveSyncConflictAttempt > DRIVE_SYNC_MAX_CONFLICT_RETRIES) {
    return driveSyncConflictAttempt = 0, {
      retried: !1,
      attempt: DRIVE_SYNC_MAX_CONFLICT_RETRIES
    };
  }
  const t = Math.min(1e3 * Math.pow(2, driveSyncConflictAttempt - 1), 8e3);
  return driveSyncRetryTimer && clearTimeout(driveSyncRetryTimer), driveSyncRetryTimer = setTimeout(() => {
    driveSyncRetryTimer = null, driveSyncNow(e || "conflict-retry")
  }, t), {
    retried: !0,
    attempt: driveSyncConflictAttempt,
    delay: t
  }
}

async function driveSyncNow(e) {
  if (navigator.locks && navigator.locks.request) {
    return await navigator.locks.request("sg-drive-sync", { ifAvailable: true }, async lock => {
      if (!lock) {
        return { ok: !1, reason: "locked-by-another-tab" };
      }
      return await _performDriveSync(e);
    });
  }
  return await _performDriveSync(e);
}

async function _performDriveSync(e) {
  if (!driveSyncEnabledFlag) return {
    ok: !1,
    reason: "disabled"
  };
  if (driveSyncInFlight) return driveSyncQueued = !0, {
    ok: !1,
    reason: "in-flight"
  };
  const t = e => saveDriveSyncState({
      lastSyncAt: Date.now(),
      lastRemoteFileId: e.id,
      lastRemoteModifiedTime: e.modifiedTime,
      lastSyncStatus: "ok",
      lastSyncError: null
    }),
    n = () => ({
      ...foldersData || emptyFoldersData(),
      prompts: promptsData && promptsData.prompts || [],
      deletedPrompts: promptsData && promptsData.deletedPrompts || [],
      chains: chainsData && chainsData.chains || [],
      deletedChains: chainsData && chainsData.deletedChains || [],
      bookmarks: _sgBookmarks || {},
      deletedBookmarks: _sgBookmarkTombs || []
    }),
    o = async e => {
      try {
        if (!(await chrome.storage.local.get(["driveSyncInitialConfirmPending"])).driveSyncInitialConfirmPending) return;
        await chrome.storage.local.remove("driveSyncInitialConfirmPending"), e && "function" == typeof showToast && showToast("Google Drive connected — merged existing backup into local data", "success")
      } catch (e) {}
    };
  driveSyncInFlight = !0, await saveDriveSyncState({
    lastSyncStatus: "syncing",
    lastSyncError: null
  });
  try {
    const e = await driveSyncSendMessage("DRIVE_SYNC_FETCH_REMOTE");
    if (!e.ok) {
      if (401 === e.status || 403 === e.status) return await driveSyncHandleFatalAuthError(e.error), {
        ok: !1
      };
      if (e.corrupted) {
        try {
          showToast("Drive sync: remote file was corrupted, reuploading from this device", "info")
        } catch (e) {}
        const e = driveSyncBuildCheckedPayload(n());
        if (!e.ok) return await driveSyncHandleOversize(e.sizeBytes), {
          ok: !1,
          error: "oversize"
        };
        const o = await driveSyncSendMessage("DRIVE_SYNC_GET_REMOTE_META"),
          r = o && o.ok && o.file ? o.file.id : null,
          s = await driveSyncSendMessage("DRIVE_SYNC_PUSH_REMOTE", {
            fileId: r,
            payload: e.payload
          });
        if (!s.ok) throw new Error(s.error || "recovery push failed");
        return await t(s.file), driveSyncRetryAttempt = 0, driveSyncConflictAttempt = 0, {
          ok: !0
        }
      }
      throw new Error(e.error || "fetch failed")
    }
    if (!e.file) {
      const e = driveSyncBuildCheckedPayload(n());
      if (!e.ok) return await driveSyncHandleOversize(e.sizeBytes), {
        ok: !1,
        error: "oversize"
      };
      const r = await driveSyncSendMessage("DRIVE_SYNC_PUSH_REMOTE", {
        fileId: null,
        payload: e.payload
      });
      if (!r.ok) throw new Error(r.error || "push failed");
      return await t(r.file), await o(!1), driveSyncRetryAttempt = 0, driveSyncConflictAttempt = 0, {
        ok: !0
      }
    }
    const r = n(),
      s = e.payload && e.payload.data || emptyFoldersData(),
      a = mergeFoldersData(r, s),
      i = driveSyncFingerprint(r),
      l = driveSyncFingerprint(s),
      c = driveSyncFingerprint(a),
      d = c !== l;
    if (c !== i) {
      if (!await driveSyncApplyMergedLocally(a)) return {
        ok: !1,
        error: "storage-full"
      };
      await o(!0)
    }
    if (d) {
      const n = driveSyncBuildCheckedPayload(a);
      if (!n.ok) return await driveSyncHandleOversize(n.sizeBytes), {
        ok: !1,
        error: "oversize"
      };
      if (e.etag) {
        const o = await driveSyncSendMessage("DRIVE_SYNC_PUSH_REMOTE", {
          fileId: e.file.id,
          payload: n.payload,
          ifMatch: e.etag
        });
        if (o.ok) await t(o.file);
        else {
          if (412 !== o.status) throw new Error(o.error || "push failed");
          const cr = driveSyncScheduleConflictRetry("412-conflict");
          if (cr.retried) return {
            ok: !1,
            reason: "conflict-retry",
            attempt: cr.attempt
          };
          return await saveDriveSyncState({
            lastSyncStatus: "error",
            lastSyncError: "Drive sync conflict persisted after 3 retries (HTTP 412)"
          }), {
            ok: !1,
            error: "conflict-limit"
          };
        }
      } else {
        const o = await driveSyncSendMessage("DRIVE_SYNC_GET_REMOTE_META");
        if (o.ok && o.file && o.file.modifiedTime && e.file.modifiedTime && o.file.modifiedTime !== e.file.modifiedTime) {
          const cr = driveSyncScheduleConflictRetry("modified-time-conflict");
          if (cr.retried) return {
            ok: !1,
            reason: "conflict-retry",
            attempt: cr.attempt
          };
          return await saveDriveSyncState({
            lastSyncStatus: "error",
            lastSyncError: "Drive sync conflict persisted after 3 retries (remote modified)"
          }), {
            ok: !1,
            error: "conflict-limit"
          };
        } else {
          const o = await driveSyncSendMessage("DRIVE_SYNC_PUSH_REMOTE", {
            fileId: e.file.id,
            payload: n.payload
          });
          if (!o.ok) throw new Error(o.error || "push failed");
          await t(o.file)
        }
      }
    } else await t(e.file);
    return driveSyncQueued || await o(!1), driveSyncRetryAttempt = 0, driveSyncConflictAttempt = 0, {
      ok: !0
    }
  } catch (e) {
    return await saveDriveSyncState({
      lastSyncStatus: "error",
      lastSyncError: e.message || "Sync failed"
    }), driveSyncScheduleRetry(), {
      ok: !1,
      error: e.message
    }
  } finally {
    driveSyncInFlight = !1, driveSyncQueued && (driveSyncQueued = !1, setTimeout(() => driveSyncNow("queued"), 0))
  }
}
async function initDriveSync() {
  await loadDriveSyncState();
  try {
    const e = await sgSyncGetCached(["driveSyncEnabled"]);
    driveSyncEnabledFlag = !!e.driveSyncEnabled
  } catch (e) {
    driveSyncEnabledFlag = !1
  }
  const _sgDriveStorageChanged = (e, t) => {
    if ("sync" === t && e.driveSyncEnabled) {
      const t = driveSyncEnabledFlag;
      driveSyncEnabledFlag = !!e.driveSyncEnabled.newValue, notifyDriveSyncStatusListeners(), !t && driveSyncEnabledFlag ? driveSyncNow("toggle-on") : t && !driveSyncEnabledFlag && (driveSyncDebounceTimer && (clearTimeout(driveSyncDebounceTimer), driveSyncDebounceTimer = null), driveSyncRetryTimer && (clearTimeout(driveSyncRetryTimer), driveSyncRetryTimer = null), driveSyncRetryAttempt = 0, driveSyncConflictAttempt = 0, clearDriveSyncState())
    }
    if ("local" === t && driveSyncEnabledFlag) {
      const t = [FOLDERS_STORAGE_KEY, PROMPTS_STORAGE_KEY, CHAINS_STORAGE_KEY, SG_BOOKMARKS_STORAGE_KEY];
      let n = !1;
      for (const o of t) {
        if (!e[o]) continue;
        const t = driveSyncExpectedFps.get(o);
        if (void 0 !== t) {
          if (driveSyncFingerprintForKey(o, e[o].newValue) === t) {
            driveSyncExpectedFps.delete(o);
            continue
          }
          driveSyncExpectedFps.delete(o)
        }
        n = !0
      }
      n && driveSyncScheduleDebounced("local-change"), 0 === driveSyncExpectedFps.size && driveSyncExpectedFpsGc && (clearTimeout(driveSyncExpectedFpsGc), driveSyncExpectedFpsGc = null)
    }
  };
  if ("undefined" != typeof SG && SG.storage) {
    SG.storage.onChanged("legacy:drive-sync", _sgDriveStorageChanged, { area: "any" });
  } else if ("undefined" != typeof chrome && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener(_sgDriveStorageChanged);
  }
  driveSyncEnabledFlag && driveSyncNow("startup")
}
SG_IS_SILENT_BG_WORKER_TAB || (sgSyncGetCached(["focusShortcut"], e => {
  Object.prototype.hasOwnProperty.call(e, "focusShortcut") && chrome.storage.sync.remove(["focusShortcut"])
}), setTimeout(() => {
  void 0 !== foldersData && sgSyncGetCached(["trashcanEnabled"], e => {
    foldersData.trashcanEnabled = !1 !== e.trashcanEnabled
  })
}, 1e3), setTimeout(() => {
  try {
    sgSyncGetCached(["downloadAudioEnabled"], e => {
      !1 !== e.downloadAudioEnabled ? (isDownloadAudioEnabled = !0, "function" == typeof initDownloadAudio && initDownloadAudio()) : isDownloadAudioEnabled = !1
    })
  } catch (e) {
    console.error("[Gemini Power Suite] Force init failed:", e)
  }
}, 500), setTimeout(() => {
  sgSyncGetCached(["bookmarksEnabled"], async e => {
    try {
      if (!1 === e.bookmarksEnabled) return void(isBookmarksEnabled = !1);
      isBookmarksEnabled = !0, await sgLoadBookmarks(), initBookmarks(), sgApplyAllBookmarkStates(), sgRefreshBookmarksHeaderButton()
    } catch (e) {
      console.error("[Gemini Power Suite] Bookmarks init failed:", e)
    }
  })
}, 500));
