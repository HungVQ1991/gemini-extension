/**
 * Gemini Power Suite - Popup Controller (Personal Edition)
 * Clean, crash-proof, dark-mode ready
 */

// Broadcast message to all open Gemini tabs
function sendMessageToContentScript(type, data = {}) {
  chrome.tabs.query({ url: "*://gemini.google.com/*" }, tabs => {
    if (!tabs || !tabs.length) return;
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, { type, ...data }).catch(() => {});
    });
  });
}

// Master toggle dependency state
function updateSettingsState(enabled) {
  document.querySelectorAll(".settings-section").forEach(section => {
    if (enabled) {
      section.classList.remove("disabled");
      section.querySelectorAll("input, button").forEach(el => el.disabled = false);
    } else {
      section.classList.add("disabled");
      section.querySelectorAll("input, button").forEach(el => el.disabled = true);
    }
  });
  if (enabled) {
    const foldersToggle = document.getElementById("folders-toggle");
    const queueToggle = document.getElementById("queue-toggle");
    const menuToggle = document.getElementById("sidebar-dropdown-toggle");
    const menuOn = menuToggle ? menuToggle.checked : true;
    if (menuToggle) updateMenuDependentSettings(menuOn);
    if (foldersToggle) updateTrashcanDependencyState(menuOn && foldersToggle.checked);
    if (queueToggle) updateQueueParamsState(queueToggle.checked);
    if (typeof window._sgApplyDriveSyncAvailability === "function") {
      window._sgApplyDriveSyncAvailability();
    }
  }
}

// Menu-dependent toggle state
function updateMenuDependentSettings(enabled) {
  const foldersToggle = document.getElementById("folders-toggle");
  const promptsToggle = document.getElementById("prompts-toggle");
  
  [foldersToggle, promptsToggle].forEach(toggle => {
    if (!toggle) return;
    const row = toggle.closest(".toggle-row");
    if (enabled) {
      row?.classList.remove("disabled");
      toggle.disabled = false;
    } else {
      row?.classList.add("disabled");
      toggle.disabled = true;
    }
  });
  if (foldersToggle) {
    updateTrashcanDependencyState(enabled && foldersToggle.checked);
  }
}

// Trashcan dependency on Folders
function updateTrashcanDependencyState(foldersEnabled) {
  const trashcanToggle = document.getElementById("trashcan-toggle");
  if (!trashcanToggle) return;
  const row = trashcanToggle.closest(".toggle-row");
  if (foldersEnabled) {
    row?.classList.remove("disabled");
    trashcanToggle.disabled = false;
  } else {
    row?.classList.add("disabled");
    trashcanToggle.disabled = true;
  }
}

// Queue window dependency on Message Queue
function updateQueueParamsState(queueEnabled) {
  const queueWinToggle = document.getElementById("show-queue-toggle");
  if (!queueWinToggle) return;
  const row = queueWinToggle.closest(".toggle-row");
  if (queueEnabled) {
    row?.classList.remove("disabled");
    queueWinToggle.disabled = false;
  } else {
    row?.classList.add("disabled");
    queueWinToggle.disabled = true;
  }
}

// Helper to bind toggle event listener and return a batch hydrator
function setupToggle({ id, storageKey, defaultOn, enableMsg, disableMsg, onChange }, initialData = null) {
  const toggle = document.getElementById(id);
  if (!toggle) return null;

  const hydrate = res => {
    const safe = res || {};
    const val = defaultOn ? safe[storageKey] !== false : safe[storageKey] === true;
    toggle.checked = val;
    if (onChange) onChange(val);
  };

  if (initialData) {
    hydrate(initialData);
  }

  toggle.addEventListener("change", () => {
    const val = toggle.checked;
    chrome.storage.sync.set({ [storageKey]: val });
    if (enableMsg && disableMsg) {
      sendMessageToContentScript(val ? enableMsg : disableMsg);
    }
    if (onChange) onChange(val);
  });

  return hydrate;
}

// Segmented control helper with keyboard arrow navigation
function wireSegmented(containerId, storageKey, defaultVal, initialData = null, normalizeVal = null) {
  const container = document.getElementById(containerId);
  if (!container) return null;
  const options = Array.from(container.querySelectorAll(".sg-seg-opt"));
  if (!options.length) return null;

  const setActive = (val) => {
    options.forEach(opt => {
      const match = opt.dataset.value === val;
      opt.classList.toggle("sg-active", match);
      opt.setAttribute("aria-checked", match ? "true" : "false");
      opt.tabIndex = match ? 0 : -1;
    });
  };

  const hydrate = res => {
    const safe = res || {};
    const raw = safe[storageKey] || defaultVal;
    const current = typeof normalizeVal === "function" ? normalizeVal(raw) : raw;
    setActive(current);
  };

  if (initialData) {
    hydrate(initialData);
  }

  options.forEach((opt, idx) => {
    opt.addEventListener("click", () => {
      const val = opt.dataset.value;
      setActive(val);
      chrome.storage.sync.set({ [storageKey]: val });
    });

    opt.addEventListener("keydown", e => {
      let nextIdx = -1;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        nextIdx = (idx + 1) % options.length;
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        nextIdx = (idx - 1 + options.length) % options.length;
      } else if (e.key === "Home") {
        nextIdx = 0;
      } else if (e.key === "End") {
        nextIdx = options.length - 1;
      }
      if (nextIdx !== -1) {
        e.preventDefault();
        const nextOpt = options[nextIdx];
        const val = nextOpt.dataset.value;
        nextOpt.focus();
        setActive(val);
        chrome.storage.sync.set({ [storageKey]: val });
      }
    });
  });

  return hydrate;
}

// Main initialization
document.addEventListener("DOMContentLoaded", () => {
  // 1. Force dark-theme on body
  document.body.classList.add("dark-theme");

  // 2. Master Extension Toggle & Warning Modal
  const masterToggle = document.getElementById("extension-toggle");
  const warnModal = document.getElementById("warning-modal");
  const warnConfirm = document.getElementById("warning-confirm-btn");
  const warnCancel = document.getElementById("warning-cancel-btn");
  const warnClose = document.getElementById("warning-close-btn");
  let warnPrevFocus = null;

  function closeWarnModal(restoreFocus = true) {
    if (warnModal) warnModal.style.display = "none";
    if (restoreFocus && warnPrevFocus && warnPrevFocus.isConnected && typeof warnPrevFocus.focus === "function") {
      try { warnPrevFocus.focus(); } catch (_) {}
    } else if (restoreFocus && masterToggle && typeof masterToggle.focus === "function") {
      try { masterToggle.focus(); } catch (_) {}
    }
    warnPrevFocus = null;
  }

  function setMasterState(enabled) {
    chrome.storage.sync.set({ extensionEnabled: enabled });
    updateSettingsState(enabled);
    chrome.tabs.query({ url: "*://gemini.google.com/*" }, tabs => {
      (tabs || []).forEach(tab => {
        const reloadTab = () => {
          try {
            Promise.resolve(chrome.tabs.reload(tab.id)).catch(() => {});
          } catch (_e) {}
        };
        try {
          const p = chrome.tabs.sendMessage(tab.id, { type: "SG_SYNC_MASTER_STATE", enabled });
          if (p && typeof p.then === "function") {
            p.then(reloadTab, reloadTab);
          } else {
            reloadTab();
          }
        } catch (_e) {
          reloadTab();
        }
      });
    });
  }

  if (masterToggle) {
    masterToggle.addEventListener("change", () => {
      if (masterToggle.checked) {
        setMasterState(true);
      } else {
        // Show warning before disabling
        masterToggle.checked = true; // keep checked until confirmed
        warnPrevFocus = document.activeElement;
        if (warnModal) {
          warnModal.style.display = "flex";
          if (warnCancel && typeof warnCancel.focus === "function") {
            warnCancel.focus();
          } else if (warnClose && typeof warnClose.focus === "function") {
            warnClose.focus();
          }
        }
      }
    });
  }

  if (warnConfirm) {
    warnConfirm.addEventListener("click", () => {
      if (masterToggle) masterToggle.checked = false;
      setMasterState(false);
      closeKeybindsModal(false);
      closeWarnModal(true);
    });
  }
  if (warnCancel) {
    warnCancel.addEventListener("click", () => {
      closeWarnModal(true);
    });
  }
  if (warnClose) {
    warnClose.addEventListener("click", () => {
      closeWarnModal(true);
    });
  }
  if (warnModal) {
    warnModal.addEventListener("click", e => {
      if (e.target === warnModal) closeWarnModal(true);
    });
    document.addEventListener("keydown", e => {
      if (e.key === "Escape" && warnModal.style.display === "flex") {
        e.preventDefault();
        closeWarnModal(true);
      }
    });
  }

  // 3. Register all toggles & segmented controls synchronously, then hydrate in ONE batch IPC
  const toggleConfigs = [
    // Menu & Folders
    { id: "sidebar-dropdown-toggle", storageKey: "sidebarDropdownEnabled", defaultOn: true, enableMsg: "ENABLE_SIDEBAR_DROPDOWN", disableMsg: "DISABLE_SIDEBAR_DROPDOWN", onChange: updateMenuDependentSettings },
    { id: "folders-toggle", storageKey: "foldersEnabled", defaultOn: true, enableMsg: "ENABLE_FOLDERS", disableMsg: "DISABLE_FOLDERS", onChange: updateTrashcanDependencyState },
    { id: "trashcan-toggle", storageKey: "trashcanEnabled", defaultOn: true, enableMsg: "ENABLE_TRASHCAN", disableMsg: "DISABLE_TRASHCAN" },
    { id: "prompts-toggle", storageKey: "promptsEnabled", defaultOn: true, enableMsg: "ENABLE_PROMPTS", disableMsg: "DISABLE_PROMPTS" },
    { id: "skills-injection-toggle", storageKey: "skillsInjectionEnabled", defaultOn: false, enableMsg: "ENABLE_SKILLS_INJECTION", disableMsg: "DISABLE_SKILLS_INJECTION" },
    { id: "baseline-injection-toggle", storageKey: "baselineInjectionEnabled", defaultOn: false, enableMsg: "ENABLE_BASELINE_INJECTION", disableMsg: "DISABLE_BASELINE_INJECTION" },
    // Interface Enhancements
    { id: "folder-upload-toggle", storageKey: "folderUploadEnabled", defaultOn: true, enableMsg: "ENABLE_FOLDER_UPLOAD", disableMsg: "DISABLE_FOLDER_UPLOAD" },
    { id: "export-btn-toggle", storageKey: "showExportButton", defaultOn: true, enableMsg: "ENABLE_EXPORT_BTN", disableMsg: "DISABLE_EXPORT_BTN" },
    { id: "info-btn-toggle", storageKey: "showInfoButton", defaultOn: true, enableMsg: "ENABLE_INFO_BTN", disableMsg: "DISABLE_INFO_BTN" },
    { id: "wide-chat-btn-toggle", storageKey: "showWideChatButton", defaultOn: true, enableMsg: "SHOW_WIDE_BTN", disableMsg: "HIDE_WIDE_BTN" },
    { id: "autohide-top-actions-toggle", storageKey: "autohideTopActions", defaultOn: true, enableMsg: "ENABLE_AUTOHIDE_TOP_ACTIONS", disableMsg: "DISABLE_AUTOHIDE_TOP_ACTIONS" },
    { id: "timestamps-toggle", storageKey: "timestampsEnabled", defaultOn: false, enableMsg: "ENABLE_TIMESTAMPS", disableMsg: "DISABLE_TIMESTAMPS" },
    { id: "optimize-toggle", storageKey: "optimizeEnabled", defaultOn: true, enableMsg: "ENABLE_OPTIMIZE", disableMsg: "DISABLE_OPTIMIZE" },
    { id: "counter-toggle", storageKey: "counterEnabled", defaultOn: true, enableMsg: "ENABLE_COUNTER", disableMsg: "DISABLE_COUNTER" },
    { id: "download-audio-toggle", storageKey: "downloadAudioEnabled", defaultOn: true, enableMsg: "ENABLE_DOWNLOAD_AUDIO", disableMsg: "DISABLE_DOWNLOAD_AUDIO" },
    { id: "bookmarks-toggle", storageKey: "bookmarksEnabled", defaultOn: true, enableMsg: "ENABLE_BOOKMARKS", disableMsg: "DISABLE_BOOKMARKS" },
    { id: "outline-toggle", storageKey: "conversationOutlineEnabled", defaultOn: true, enableMsg: "ENABLE_OUTLINE", disableMsg: "DISABLE_OUTLINE" },
    { id: "fork-handoff-toggle", storageKey: "forkHandoffEnabled", defaultOn: true, enableMsg: "ENABLE_FORK_HANDOFF", disableMsg: "DISABLE_FORK_HANDOFF" },
    { id: "code-actions-toggle", storageKey: "codeBlockActionsEnabled", defaultOn: true, enableMsg: "ENABLE_CODE_BLOCK_ACTIONS", disableMsg: "DISABLE_CODE_BLOCK_ACTIONS" },
    { id: "diagram-renderer-toggle", storageKey: "diagramRendererEnabled", defaultOn: true, enableMsg: "ENABLE_DIAGRAM_RENDERER", disableMsg: "DISABLE_DIAGRAM_RENDERER" },
    { id: "command-palette-toggle", storageKey: "commandPaletteEnabled", defaultOn: true, enableMsg: "ENABLE_COMMAND_PALETTE", disableMsg: "DISABLE_COMMAND_PALETTE" },
    { id: "periodic-model-picker-toggle", storageKey: "periodicModelPickerEnabled", defaultOn: false, enableMsg: "ENABLE_PERIODIC_MODEL_PICKER", disableMsg: "DISABLE_PERIODIC_MODEL_PICKER" },
    { id: "orchestrator-toggle", storageKey: "orchestratorEnabled", defaultOn: true, enableMsg: "ENABLE_ORCHESTRATOR", disableMsg: "DISABLE_ORCHESTRATOR" },
    { id: "queue-toggle", storageKey: "queueingEnabled", defaultOn: true, enableMsg: "ENABLE_QUEUING", disableMsg: "DISABLE_QUEUING", onChange: updateQueueParamsState },
    { id: "show-queue-toggle", storageKey: "showQueueWindow", defaultOn: true, enableMsg: "SHOW_QUEUE_WINDOW", disableMsg: "HIDE_QUEUE_WINDOW" },
    // Sidebar
    { id: "autohide-sidebar-toggle", storageKey: "autohideCollapsedSidebar", defaultOn: true, enableMsg: "ENABLE_AUTOHIDE_SIDEBAR", disableMsg: "DISABLE_AUTOHIDE_SIDEBAR" },
    { id: "pinned-collapse-toggle", storageKey: "collapsiblePinnedEnabled", defaultOn: true, enableMsg: "ENABLE_COLLAPSIBLE_PINNED", disableMsg: "DISABLE_COLLAPSIBLE_PINNED" },
    { id: "drag-chat-input-toggle", storageKey: "dragChatToInputEnabled", defaultOn: true, enableMsg: "ENABLE_DRAG_CHAT_INPUT", disableMsg: "DISABLE_DRAG_CHAT_INPUT" },
    // UI Declutter
    { id: "hide-upgrade-btns-toggle", storageKey: "hideUpgradeButtons", defaultOn: true, enableMsg: "HIDE_UPGRADE_BUTTONS", disableMsg: "SHOW_UPGRADE_BUTTONS" },
    { id: "location-info-toggle", storageKey: "hideLocationInfo", defaultOn: true, enableMsg: "HIDE_LOCATION_INFO", disableMsg: "SHOW_LOCATION_INFO" },
    { id: "activity-toggle", storageKey: "hideActivity", defaultOn: true, enableMsg: "HIDE_ACTIVITY", disableMsg: "SHOW_ACTIVITY" },
    { id: "hide-gems-button-toggle", storageKey: "hideGemsSidebarButton", defaultOn: true, enableMsg: "HIDE_GEMS_SIDEBAR_BUTTON", disableMsg: "SHOW_GEMS_SIDEBAR_BUTTON" },
    // Keyboard Shortcuts
    { id: "focus-shortcut-toggle", storageKey: "focusShortcutEnabled", defaultOn: true }
  ];

  const toggleHydrators = toggleConfigs.map(cfg => setupToggle(cfg)).filter(Boolean);

  const openSkillsBtn = document.getElementById("open-skills-manager-btn");
  if (openSkillsBtn) {
    const defaultLabel = openSkillsBtn.textContent;
    openSkillsBtn.addEventListener("click", () => {
      chrome.tabs.query({ active: true, currentWindow: true }, activeTabs => {
        const activeTab = activeTabs && activeTabs[0];
        if (activeTab && activeTab.url && activeTab.url.includes("gemini.google.com")) {
          chrome.tabs.sendMessage(activeTab.id, { type: "OPEN_SKILLS_MODAL" }).catch(() => {});
          window.close();
          return;
        }
        chrome.tabs.query({ url: "*://gemini.google.com/*" }, geminiTabs => {
          const target = geminiTabs && geminiTabs[0];
          if (target) {
            chrome.tabs.update(target.id, { active: true });
            if (target.windowId !== undefined) {
              chrome.windows.update(target.windowId, { focused: true });
            }
            chrome.tabs.sendMessage(target.id, { type: "OPEN_SKILLS_MODAL" }).catch(() => {});
            window.close();
          } else {
            openSkillsBtn.textContent = "Open a Gemini tab first";
            setTimeout(() => {
              openSkillsBtn.textContent = defaultLabel;
            }, 1800);
          }
        });
      });
    });
  }

  // Google Drive Sync Toggle
  const driveSyncToggle = document.getElementById("drive-sync-toggle");
  let driveOAuthConfigured = true;
  window._sgApplyDriveSyncAvailability = () => {
    if (!driveSyncToggle) return;
    const row = driveSyncToggle.closest(".toggle-row");
    if (!driveOAuthConfigured && !driveSyncToggle.checked) {
      driveSyncToggle.disabled = true;
      row?.classList.add("disabled");
      if (row) {
        row.dataset.tooltip = "Google Drive Sync requires your own Google Cloud OAuth2 Client ID in manifest.json and background.js.";
      }
    }
  };
  if (driveSyncToggle) {
    const openDriveAuthTab = () => {
      driveSyncToggle.checked = false;
      driveSyncToggle.disabled = false;
      chrome.runtime.sendMessage({ type: "DRIVE_SYNC_OPEN_AUTH_PAGE" }, () => {
        void chrome.runtime.lastError;
        window.close();
      });
    };

    driveSyncToggle.addEventListener("change", () => {
      if (driveSyncToggle.checked) {
        if (!driveOAuthConfigured) {
          driveSyncToggle.checked = false;
          window._sgApplyDriveSyncAvailability();
          return;
        }
        driveSyncToggle.disabled = true;
        chrome.permissions.contains({ permissions: ["identity"] }, hasPerm => {
          if (!hasPerm) {
            openDriveAuthTab();
            return;
          }
          chrome.runtime.sendMessage({ type: "DRIVE_SYNC_CONNECT", silentOnly: true }, resp => {
            if (chrome.runtime.lastError || !(resp && resp.authorized)) {
              openDriveAuthTab();
              return;
            }
            driveSyncToggle.disabled = false;
            chrome.storage.sync.set({ driveSyncEnabled: true });
          });
        });
      } else {
        driveSyncToggle.disabled = true;
        chrome.runtime.sendMessage({ type: "DRIVE_SYNC_DISCONNECT" }, () => {
          void chrome.runtime.lastError;
          driveSyncToggle.disabled = false;
          chrome.storage.sync.set({ driveSyncEnabled: false });
          window._sgApplyDriveSyncAvailability();
        });
      }
    });

    chrome.runtime.sendMessage({ type: "DRIVE_SYNC_GET_STATUS" }, resp => {
      if (chrome.runtime.lastError) return;
      if (resp && resp.configured === false) {
        driveOAuthConfigured = false;
        window._sgApplyDriveSyncAvailability();
      }
    });
  }

  let activeModelRoutingCfg = window.SGModelRouting ? window.SGModelRouting.DEFAULT_CONFIG : null;
  const normalizeOptimizeStorageVal = raw => {
    if (window.SGModelRouting && typeof window.SGModelRouting.normalizeOptimizeLevel === "function") {
      return window.SGModelRouting.normalizeOptimizeLevel(raw, activeModelRoutingCfg);
    }
    const low = String(raw || "").trim().toLowerCase();
    if (low === "thinking" || low === "flash") return "flash";
    if (low === "pro") return "pro";
    return "lite";
  };

  const applyOptimizeRoutingLabels = cfg => {
    if (!cfg || !window.SGModelRouting) return;
    activeModelRoutingCfg = cfg;
    const seg = document.getElementById("optimize-model-seg");
    if (seg) {
      seg.querySelectorAll(".sg-seg-opt").forEach(btn => {
        const val = btn.dataset.value;
        const prof = window.SGModelRouting.resolveOptimizeProfile(val, cfg);
        if (!prof) return;
        const modelDisplay = cfg.models?.[prof.model]?.displayName || prof.model;
        const thinkLabel = cfg.thinkingLevels?.[prof.thinkingLevel]?.label || prof.thinkingLevel;
        const modelSpan = btn.querySelector ? btn.querySelector(".sg-seg-opt-model") : null;
        const levelSpan = btn.querySelector ? btn.querySelector(".sg-seg-opt-level") : null;
        if (modelSpan && levelSpan) {
          modelSpan.textContent = modelDisplay;
          levelSpan.textContent = thinkLabel;
        } else {
          btn.textContent = `${modelDisplay} · ${thinkLabel}`;
        }
        btn.title = `${prof.label} — ${prof.badgeLabel}`;
        btn.setAttribute("aria-label", `${modelDisplay} · ${thinkLabel} (${prof.label})`);
      });
    }
  };

  const hydrateOptimizeSeg = wireSegmented(
    "optimize-model-seg",
    "optimizeModel",
    "lite",
    null,
    normalizeOptimizeStorageVal
  );
  if (activeModelRoutingCfg) {
    applyOptimizeRoutingLabels(activeModelRoutingCfg);
  }
  if (window.SGModelRouting && typeof window.SGModelRouting.loadConfigFromExtension === "function" && typeof fetch === "function") {
    window.SGModelRouting.loadConfigFromExtension().then(res => {
      if (res && res.config) applyOptimizeRoutingLabels(res.config);
    }).catch(() => {});
  } else if (chrome.runtime && typeof chrome.runtime.sendMessage === "function") {
    try {
      chrome.runtime.sendMessage({ type: "GET_MODEL_ROUTING_CONFIG" }, resp => {
        void chrome.runtime.lastError;
        if (resp && resp.config) applyOptimizeRoutingLabels(resp.config);
      });
    } catch (_e) {}
  }

  const SHORTCUT_CONFIGS = [
    // General & Navigation
    { group: "General & Navigation", label: "Optimize Prompt", storageKey: "optimizeShortcut", enabledKey: "optimizeShortcutEnabled", defaultShortcut: { key: "o", alt: true, ctrl: false, shift: false, meta: false } },
    { group: "General & Navigation", label: "Fix Grammar", storageKey: "grammarShortcut", enabledKey: "grammarShortcutEnabled", defaultShortcut: { key: "g", alt: false, ctrl: true, shift: true, meta: false } },
    { group: "General & Navigation", label: "Open Folders", storageKey: "foldersShortcut", enabledKey: "foldersShortcutEnabled", defaultShortcut: { key: "f", alt: true, ctrl: false, shift: false, meta: false } },
    { group: "General & Navigation", label: "Open Prompts", storageKey: "promptsShortcut", enabledKey: "promptsShortcutEnabled", defaultShortcut: { key: "l", alt: true, ctrl: false, shift: false, meta: false } },
    { group: "General & Navigation", label: "Open Settings", storageKey: "settingsShortcut", enabledKey: "settingsShortcutEnabled", defaultShortcut: { key: "s", alt: true, ctrl: false, shift: false, meta: false } },
    { group: "General & Navigation", label: "Toggle Sidebar", storageKey: "sidebarShortcut", enabledKey: "sidebarShortcutEnabled", defaultShortcut: { key: "q", alt: true, ctrl: false, shift: false, meta: false } },
    { group: "General & Navigation", label: "New Chat", storageKey: "newchatShortcut", enabledKey: "newchatShortcutEnabled", defaultShortcut: { key: "n", alt: true, ctrl: true, shift: false, meta: false } },
    { group: "General & Navigation", label: "Temporary Chat", storageKey: "tempChatShortcut", enabledKey: "tempChatShortcutEnabled", defaultShortcut: { key: "a", alt: true, ctrl: false, shift: false, meta: false } },
    { group: "General & Navigation", label: "Saved Info", storageKey: "instructionsShortcut", enabledKey: "instructionsShortcutEnabled", defaultShortcut: { key: "i", alt: true, ctrl: true, shift: false, meta: false } },
    // Model & Thinking
    { group: "Model & Thinking", label: "Cycle Model Mode", storageKey: "cycleModeShortcut", enabledKey: "cycleModeShortcutEnabled", defaultShortcut: { key: "p", alt: true, ctrl: false, shift: false, meta: false } },
    { group: "Model & Thinking", label: "Cycle Thinking Level", storageKey: "thinkingLevelShortcut", enabledKey: "thinkingLevelShortcutEnabled", defaultShortcut: { key: "t", alt: true, ctrl: false, shift: false, meta: false } },
    // Gemini Tools
    { group: "Gemini Tools", label: "Tool: Image", storageKey: "imageShortcut", enabledKey: "imageShortcutEnabled", defaultShortcut: { key: "i", alt: true, ctrl: false, shift: false, meta: false } },
    { group: "Gemini Tools", label: "Tool: Clear Tool", storageKey: "noToolShortcut", enabledKey: "noToolShortcutEnabled", defaultShortcut: { key: "n", alt: true, ctrl: false, shift: false, meta: false } },
    { group: "Gemini Tools", label: "Tool: Deep Research", storageKey: "deepResearchShortcut", enabledKey: "deepResearchShortcutEnabled", defaultShortcut: { key: "r", alt: true, ctrl: false, shift: false, meta: false } },
    { group: "Gemini Tools", label: "Tool: Canvas", storageKey: "canvasShortcut", enabledKey: "canvasShortcutEnabled", defaultShortcut: { key: "c", alt: true, ctrl: false, shift: false, meta: false } },
    { group: "Gemini Tools", label: "Tool: Video", storageKey: "videoShortcut", enabledKey: "videoShortcutEnabled", defaultShortcut: { key: "v", alt: true, ctrl: false, shift: false, meta: false } },
    { group: "Gemini Tools", label: "Tool: Music", storageKey: "musicShortcut", enabledKey: "musicShortcutEnabled", defaultShortcut: { key: "m", alt: true, ctrl: false, shift: false, meta: false } }
  ];

  function normalizeShortcutObj(raw, fallback) {
    const src = raw && typeof raw === "object" && raw.key ? raw : fallback;
    return {
      key: String(src.key || "").toLowerCase(),
      alt: Boolean(src.alt),
      ctrl: Boolean(src.ctrl),
      shift: Boolean(src.shift),
      meta: Boolean(src.meta)
    };
  }

  function formatShortcutObj(sc) {
    const parts = [];
    if (sc.ctrl) parts.push("Ctrl");
    if (sc.alt) parts.push("Alt");
    if (sc.shift) parts.push("Shift");
    if (sc.meta) parts.push("Meta");
    parts.push(String(sc.key || "").toUpperCase());
    return parts.join("+");
  }

  function shortcutSignature(sc) {
    return `${sc.ctrl ? 1 : 0}:${sc.alt ? 1 : 0}:${sc.shift ? 1 : 0}:${sc.meta ? 1 : 0}:${String(sc.key || "").toLowerCase()}`;
  }

  function shortcutBaseKeyFromCode(code) {
    if (/^Key[A-Z]$/.test(code || "")) return code.slice(3).toLowerCase();
    if (/^Digit[0-9]$/.test(code || "")) return code.slice(5);
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
    }[code] || null;
  }

  function extractRecordedShortcut(e) {
    const rawLow = String(e.key || "").toLowerCase();
    if (["control", "shift", "alt", "meta", "os", "dead", "process", "altgraph", "capslock", "numlock", "scrolllock"].includes(rawLow)) {
      return null;
    }
    const baseKey = shortcutBaseKeyFromCode(e.code) || (
      /^f(?:[1-9]|1[0-2])$/.test(rawLow) || ["arrowup", "arrowdown", "arrowleft", "arrowright", "home", "end", "pageup", "pagedown", "insert", "delete"].includes(rawLow)
        ? rawLow
        : ""
    );
    if (!baseKey) {
      return { error: "Unsupported key. Use letters, numbers, punctuation, arrows, or F1-F12." };
    }
    const isFKey = /^f(?:[1-9]|1[0-2])$/.test(baseKey);
    const hasMainMod = Boolean(e.ctrlKey || e.altKey || e.metaKey);
    if (!hasMainMod && !isFKey) {
      return { error: "Use Ctrl, Alt, or Meta + key (or F1-F12) so typing is not interrupted." };
    }
    return {
      shortcut: {
        key: baseKey,
        alt: Boolean(e.altKey),
        ctrl: Boolean(e.ctrlKey),
        shift: Boolean(e.shiftKey),
        meta: Boolean(e.metaKey)
      }
    };
  }

  const shortcutState = new Map();
  SHORTCUT_CONFIGS.forEach(cfg => {
    shortcutState.set(cfg.storageKey, {
      shortcut: normalizeShortcutObj(null, cfg.defaultShortcut),
      enabled: true
    });
  });

  const openKeybindsBtn = document.getElementById("open-keybinds-btn");
  const keybindsModal = document.getElementById("keybinds-modal");
  const keybindsCloseBtn = document.getElementById("keybinds-close-btn");
  const keybindsDoneBtn = document.getElementById("keybinds-done-btn");
  const keybindsResetAllBtn = document.getElementById("keybinds-reset-all-btn");
  const keybindsSearch = document.getElementById("keybinds-search");
  const keybindsStatus = document.getElementById("keybinds-status");
  const keybindsList = document.getElementById("keybinds-list");
  const cmdPaletteToggle = document.getElementById("command-palette-toggle");

  let recordingKeybindKey = null;
  let transientKeybindStatus = null;

  function computeKeybindConflicts() {
    const bySig = new Map();
    SHORTCUT_CONFIGS.forEach(cfg => {
      const entry = shortcutState.get(cfg.storageKey);
      if (!entry || !entry.enabled) return;
      const sig = shortcutSignature(entry.shortcut);
      if (!bySig.has(sig)) bySig.set(sig, []);
      bySig.get(sig).push(cfg);
    });

    const conflicts = new Map();
    const cpActive = !cmdPaletteToggle || cmdPaletteToggle.checked;
    const ctrlKSig = "1:0:0:0:k";
    const metaKSig = "0:0:0:1:k";

    SHORTCUT_CONFIGS.forEach(cfg => {
      const entry = shortcutState.get(cfg.storageKey);
      if (!entry || !entry.enabled) return;
      const sig = shortcutSignature(entry.shortcut);
      const dupes = (bySig.get(sig) || []).filter(other => other.storageKey !== cfg.storageKey);
      const reasons = dupes.map(d => d.label);
      if (cpActive && (sig === ctrlKSig || sig === metaKSig)) {
        reasons.push("Command Palette");
      }
      if (reasons.length > 0) {
        conflicts.set(cfg.storageKey, reasons);
      }
    });
    return conflicts;
  }

  function updateKeybindStatusBanner(conflicts) {
    if (!keybindsStatus) return;
    if (transientKeybindStatus) {
      keybindsStatus.textContent = transientKeybindStatus.text;
      keybindsStatus.className = `sg-keybinds-status ${transientKeybindStatus.kind === "error" ? "is-error" : "is-warn"}`;
      return;
    }
    if (recordingKeybindKey) {
      const cfg = SHORTCUT_CONFIGS.find(c => c.storageKey === recordingKeybindKey);
      keybindsStatus.textContent = `Recording for "${cfg ? cfg.label : recordingKeybindKey}" — press key combo (Esc to cancel).`;
      keybindsStatus.className = "sg-keybinds-status";
      return;
    }
    if (conflicts.size > 0) {
      const firstEntry = conflicts.entries().next().value;
      const firstCfg = SHORTCUT_CONFIGS.find(c => c.storageKey === firstEntry[0]);
      keybindsStatus.textContent = `Conflict: ${firstCfg ? firstCfg.label : firstEntry[0]} overlaps with ${firstEntry[1].join(", ")}.`;
      keybindsStatus.className = "sg-keybinds-status is-warn";
      return;
    }
    keybindsStatus.textContent = "Click a keybind button and press your desired key combination.";
    keybindsStatus.className = "sg-keybinds-status";
  }

  function renderKeybindsList() {
    if (!keybindsList) return;
    while (keybindsList.firstChild) {
      keybindsList.removeChild(keybindsList.firstChild);
    }

    const q = keybindsSearch ? keybindsSearch.value.trim().toLowerCase() : "";
    const conflicts = computeKeybindConflicts();
    updateKeybindStatusBanner(conflicts);

    let lastGroup = "";
    let renderedCount = 0;

    SHORTCUT_CONFIGS.forEach(cfg => {
      const entry = shortcutState.get(cfg.storageKey);
      const formatted = formatShortcutObj(entry.shortcut);
      const hay = `${cfg.group} ${cfg.label} ${formatted}`.toLowerCase();
      if (q && !hay.includes(q)) return;

      if (cfg.group !== lastGroup) {
        lastGroup = cfg.group;
        const heading = document.createElement("div");
        heading.className = "sg-kb-group-title";
        heading.textContent = cfg.group;
        keybindsList.appendChild(heading);
      }

      const row = document.createElement("div");
      const conflictReasons = conflicts.get(cfg.storageKey);
      row.className = `sg-kb-row${entry.enabled ? "" : " is-disabled"}${conflictReasons ? " is-conflict" : ""}`;
      row.setAttribute("data-sg-kb-key", cfg.storageKey);

      const labelEl = document.createElement("span");
      labelEl.className = "sg-kb-label";
      labelEl.textContent = cfg.label;
      labelEl.title = conflictReasons ? `${cfg.label} (Conflicts with ${conflictReasons.join(", ")})` : cfg.label;

      const controls = document.createElement("div");
      controls.className = "sg-kb-controls";

      const isRec = recordingKeybindKey === cfg.storageKey;
      const keyBtn = document.createElement("button");
      keyBtn.type = "button";
      keyBtn.className = `sg-kb-key-btn${isRec ? " is-recording" : ""}`;
      keyBtn.textContent = isRec ? "Press keys…" : formatted;
      keyBtn.title = "Click to record a new keybind";
      keyBtn.setAttribute("data-sg-kb-record", cfg.storageKey);
      keyBtn.addEventListener("click", () => {
        transientKeybindStatus = null;
        recordingKeybindKey = isRec ? null : cfg.storageKey;
        renderKeybindsList();
        if (recordingKeybindKey) {
          const activeBtn = keybindsList.querySelector(`[data-sg-kb-record="${cfg.storageKey}"]`);
          if (activeBtn && typeof activeBtn.focus === "function") activeBtn.focus();
        }
      });

      const resetBtn = document.createElement("button");
      resetBtn.type = "button";
      resetBtn.className = "sg-kb-reset-btn";
      resetBtn.textContent = "↺";
      resetBtn.title = `Reset to default (${formatShortcutObj(cfg.defaultShortcut)})`;
      resetBtn.setAttribute("aria-label", `Reset ${cfg.label} shortcut`);
      resetBtn.setAttribute("data-sg-kb-reset", cfg.storageKey);
      resetBtn.addEventListener("click", () => {
        transientKeybindStatus = null;
        if (recordingKeybindKey === cfg.storageKey) recordingKeybindKey = null;
        const defCombo = normalizeShortcutObj(null, cfg.defaultShortcut);
        shortcutState.set(cfg.storageKey, { shortcut: defCombo, enabled: true });
        chrome.storage.sync.set({
          [cfg.storageKey]: defCombo,
          [cfg.enabledKey]: true
        });
        renderKeybindsList();
      });

      const switchLbl = document.createElement("label");
      switchLbl.className = "switch switch-sm";
      switchLbl.title = entry.enabled ? "Disable keybind" : "Enable keybind";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = entry.enabled;
      cb.setAttribute("aria-label", `Enable ${cfg.label} keybind`);
      cb.setAttribute("data-sg-kb-toggle", cfg.storageKey);
      cb.addEventListener("change", () => {
        transientKeybindStatus = null;
        entry.enabled = Boolean(cb.checked);
        chrome.storage.sync.set({ [cfg.enabledKey]: entry.enabled });
        renderKeybindsList();
      });
      const slider = document.createElement("span");
      slider.className = "slider";
      switchLbl.appendChild(cb);
      switchLbl.appendChild(slider);

      controls.appendChild(keyBtn);
      controls.appendChild(resetBtn);
      controls.appendChild(switchLbl);
      row.appendChild(labelEl);
      row.appendChild(controls);
      keybindsList.appendChild(row);
      renderedCount++;
    });

    if (renderedCount === 0) {
      const empty = document.createElement("p");
      empty.className = "sg-popup-no-results";
      empty.textContent = "No matching keybinds";
      keybindsList.appendChild(empty);
    }
  }

  function closeKeybindsModal(restoreFocus = true) {
    recordingKeybindKey = null;
    transientKeybindStatus = null;
    if (keybindsModal) keybindsModal.style.display = "none";
    if (restoreFocus && openKeybindsBtn && openKeybindsBtn.isConnected && typeof openKeybindsBtn.focus === "function") {
      try { openKeybindsBtn.focus(); } catch (_e) {}
    }
  }

  function openKeybindsModal() {
    if (!keybindsModal) return;
    recordingKeybindKey = null;
    transientKeybindStatus = null;
    if (keybindsSearch) keybindsSearch.value = "";
    renderKeybindsList();
    keybindsModal.style.display = "flex";
    if (keybindsSearch && typeof keybindsSearch.focus === "function") {
      try { keybindsSearch.focus(); } catch (_e) {}
    }
  }

  if (openKeybindsBtn && keybindsModal && keybindsList) {
    openKeybindsBtn.addEventListener("click", openKeybindsModal);
    if (keybindsCloseBtn) keybindsCloseBtn.addEventListener("click", () => closeKeybindsModal(true));
    if (keybindsDoneBtn) keybindsDoneBtn.addEventListener("click", () => closeKeybindsModal(true));
    if (keybindsSearch) keybindsSearch.addEventListener("input", renderKeybindsList);
    if (keybindsResetAllBtn) {
      keybindsResetAllBtn.addEventListener("click", () => {
        recordingKeybindKey = null;
        transientKeybindStatus = null;
        const payload = {};
        SHORTCUT_CONFIGS.forEach(cfg => {
          const defCombo = normalizeShortcutObj(null, cfg.defaultShortcut);
          shortcutState.set(cfg.storageKey, { shortcut: defCombo, enabled: true });
          payload[cfg.storageKey] = defCombo;
          payload[cfg.enabledKey] = true;
        });
        chrome.storage.sync.set(payload);
        renderKeybindsList();
      });
    }
    keybindsModal.addEventListener("click", e => {
      if (e.target === keybindsModal) closeKeybindsModal(true);
    });
    document.addEventListener("keydown", e => {
      if (keybindsModal.style.display !== "flex") return;
      if (recordingKeybindKey) {
        if (e.key === "Escape" && !e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) {
          e.preventDefault();
          e.stopPropagation();
          recordingKeybindKey = null;
          transientKeybindStatus = null;
          renderKeybindsList();
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        const parsed = extractRecordedShortcut(e);
        if (!parsed) return;
        if (parsed.error) {
          transientKeybindStatus = { kind: "error", text: parsed.error };
          renderKeybindsList();
          return;
        }
        const activeKey = recordingKeybindKey;
        const curEntry = shortcutState.get(activeKey);
        if (curEntry) {
          curEntry.shortcut = parsed.shortcut;
        }
        recordingKeybindKey = null;
        transientKeybindStatus = null;
        chrome.storage.sync.set({ [activeKey]: parsed.shortcut });
        renderKeybindsList();
        const savedBtn = keybindsList.querySelector(`[data-sg-kb-record="${activeKey}"]`);
        if (savedBtn && typeof savedBtn.focus === "function") savedBtn.focus();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        closeKeybindsModal(true);
      }
    });
  }

  // Single batched chrome.storage.sync.get for all popup settings (33 -> 1 IPC)
  const ALL_POPUP_SYNC_KEYS = [
    "extensionEnabled",
    ...toggleConfigs.map(cfg => cfg.storageKey),
    "driveSyncEnabled",
    "optimizeModel",
    ...SHORTCUT_CONFIGS.flatMap(cfg => [cfg.storageKey, cfg.enabledKey])
  ];
  chrome.storage.sync.get(ALL_POPUP_SYNC_KEYS, res => {
    const safeRes = res || {};
    const isEnabled = safeRes.extensionEnabled !== false;
    if (masterToggle) masterToggle.checked = isEnabled;
    toggleHydrators.forEach(fn => fn(safeRes));
    if (driveSyncToggle) driveSyncToggle.checked = !!safeRes.driveSyncEnabled;
    if (hydrateOptimizeSeg) hydrateOptimizeSeg(safeRes);
    SHORTCUT_CONFIGS.forEach(cfg => {
      shortcutState.set(cfg.storageKey, {
        shortcut: normalizeShortcutObj(safeRes[cfg.storageKey], cfg.defaultShortcut),
        enabled: safeRes[cfg.enabledKey] !== false
      });
    });
    updateSettingsState(isEnabled);
  });

  // 4. Collapsible Sections & Real-time Filter Search
  const sections = Array.from(document.querySelectorAll(".settings-section"));
  sections.forEach(sec => {
    const header = sec.querySelector(":scope > h3");
    if (!header) return;
    header.tabIndex = 0;
    header.setAttribute("role", "button");
    header.setAttribute("aria-expanded", "true");
    const toggleSec = () => {
      const nextCollapsed = !sec.classList.contains("collapsed");
      sec.classList.toggle("collapsed", nextCollapsed);
      sec.dataset.sgUserCollapsed = nextCollapsed ? "true" : "false";
      header.setAttribute("aria-expanded", nextCollapsed ? "false" : "true");
    };
    header.addEventListener("click", toggleSec);
    header.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggleSec();
      }
    });
  });

  const searchInput = document.getElementById("sg-popup-search");
  const searchClear = document.getElementById("sg-popup-search-clear");
  const noResultsEl = document.getElementById("sg-popup-no-results");
  const masterSection = document.querySelector(".master-toggle-section");

  function applyPopupFilter() {
    if (!searchInput) return;
    const q = searchInput.value.trim().toLowerCase();
    if (searchClear) searchClear.hidden = q.length === 0;

    let visibleMatches = 0;
    if (masterSection) {
      const masterRow = masterSection.querySelector(".toggle-row");
      const hay = ((masterRow?.textContent || "") + " " + (masterRow?.dataset?.tooltip || "")).toLowerCase();
      const showMaster = q === "" || hay.includes(q);
      masterSection.classList.toggle("sg-popup-hidden", !showMaster);
      if (showMaster) visibleMatches++;
    }

    sections.forEach(sec => {
      const header = sec.querySelector(":scope > h3");
      const headerText = (header?.textContent || "").toLowerCase();
      const headerMatch = q !== "" && headerText.includes(q);
      const items = Array.from(sec.querySelectorAll(":scope > .toggle-row, :scope > .setting-item"));
      let secVisibleCount = 0;

      items.forEach(item => {
        const text = ((item.textContent || "") + " " + (item.dataset?.tooltip || "")).toLowerCase();
        const match = q === "" || headerMatch || text.includes(q);
        item.classList.toggle("sg-popup-hidden", !match);
        if (match) {
          secVisibleCount++;
          visibleMatches++;
        }
      });

      sec.classList.toggle("sg-popup-hidden", q !== "" && secVisibleCount === 0);
      if (q !== "" && secVisibleCount > 0) {
        sec.classList.remove("collapsed");
        if (header) header.setAttribute("aria-expanded", "true");
      } else if (q === "") {
        const wasCollapsed = sec.dataset.sgUserCollapsed === "true";
        sec.classList.toggle("collapsed", wasCollapsed);
        if (header) header.setAttribute("aria-expanded", wasCollapsed ? "false" : "true");
      }
    });

    if (noResultsEl) {
      noResultsEl.hidden = q === "" || visibleMatches > 0;
    }
  }

  if (searchInput) {
    searchInput.addEventListener("input", applyPopupFilter);
    searchInput.addEventListener("keydown", e => {
      if (e.key === "Escape" && searchInput.value) {
        e.preventDefault();
        e.stopPropagation();
        searchInput.value = "";
        applyPopupFilter();
      }
    });
  }
  if (searchClear && searchInput) {
    searchClear.addEventListener("click", () => {
      searchInput.value = "";
      applyPopupFilter();
      searchInput.focus();
    });
  }
});
