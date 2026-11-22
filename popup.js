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

  function hydratePopupUiFromMap(res) {
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
  }

  function downloadJsonObject(filename, obj) {
    try {
      if (typeof Blob !== "function" || typeof URL === "undefined" || typeof URL.createObjectURL !== "function") {
        return false;
      }
      const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      if (document.body && typeof document.body.appendChild === "function") {
        document.body.appendChild(a);
        if (typeof a.click === "function") a.click();
        if (typeof a.remove === "function") a.remove();
      }
      setTimeout(() => {
        try { URL.revokeObjectURL(url); } catch (_e) {}
      }, 1000);
      return true;
    } catch (_e) {
      return false;
    }
  }

  function sendRuntimeMsg(payload, cb) {
    try {
      chrome.runtime.sendMessage(payload, resp => {
        void chrome.runtime.lastError;
        cb(resp || null);
      });
    } catch (err) {
      cb({ ok: false, error: String(err && err.message || err) });
    }
  }

  // Backup & Restore modal controller
  const openBackupBtn = document.getElementById("open-backup-btn");
  const backupModal = document.getElementById("backup-modal");
  const backupCloseBtn = document.getElementById("backup-close-btn");
  const backupDoneBtn = document.getElementById("backup-done-btn");
  const backupStatus = document.getElementById("backup-status");
  const backupExportBtn = document.getElementById("backup-export-btn");
  const backupFileInput = document.getElementById("backup-file-input");
  const backupChooseBtn = document.getElementById("backup-choose-file-btn");
  const backupPreview = document.getElementById("backup-preview");
  const backupApplyBtn = document.getElementById("backup-apply-btn");

  let pendingRestorePayload = null;

  function setBackupStatus(text, kind = "") {
    if (!backupStatus) return;
    backupStatus.textContent = text;
    backupStatus.className = `sg-keybinds-status${kind === "error" ? " is-error" : (kind === "warn" ? " is-warn" : "")}`;
  }

  function renderBackupPreview(summary, meta, warnings = []) {
    if (!backupPreview) return;
    while (backupPreview.firstChild) backupPreview.removeChild(backupPreview.firstChild);
    const lines = [
      `Format v${meta?.schemaVersion || 1} (${meta?.exportedAt ? meta.exportedAt.slice(0, 10) : "valid"})`,
      `Settings: ${summary.syncSettings} · Shortcuts: ${summary.shortcuts} · Folders: ${summary.folders}`,
      `Prompts: ${summary.prompts} · Chains: ${summary.chains} · Bookmarks: ${summary.bookmarks} · Notes: ${summary.chatNotes}`,
      `Custom Skills: ${summary.customSkills} · Custom Baselines: ${summary.customBaselines}`
    ];
    if (Array.isArray(warnings) && warnings.length > 0) {
      lines.push(`Warnings: ${warnings.length} unsupported key(s) skipped`);
    }
    lines.forEach(line => {
      const div = document.createElement("div");
      div.textContent = line;
      backupPreview.appendChild(div);
    });
    backupPreview.hidden = false;
  }

  function clearPendingRestore() {
    pendingRestorePayload = null;
    if (backupApplyBtn) backupApplyBtn.disabled = true;
    if (backupPreview) {
      while (backupPreview.firstChild) backupPreview.removeChild(backupPreview.firstChild);
      backupPreview.hidden = true;
    }
    if (backupFileInput) backupFileInput.value = "";
  }

  function closeBackupModal(restoreFocus = true) {
    if (backupModal) backupModal.style.display = "none";
    if (restoreFocus && openBackupBtn && openBackupBtn.isConnected && typeof openBackupBtn.focus === "function") {
      try { openBackupBtn.focus(); } catch (_e) {}
    }
  }

  function handleSelectedBackupText(rawText) {
    clearPendingRestore();
    let parsed;
    try {
      parsed = JSON.parse(String(rawText || ""));
    } catch (_err) {
      setBackupStatus("Invalid JSON file.", "error");
      return;
    }
    setBackupStatus("Validating backup schema…");
    sendRuntimeMsg({ type: "IMPORT_UNIFIED_BACKUP", payload: parsed, dryRun: true }, resp => {
      if (!resp || !resp.ok) {
        const errText = resp && Array.isArray(resp.errors) && resp.errors.length > 0
          ? resp.errors[0]
          : (resp && resp.error ? resp.error : "Backup validation failed");
        setBackupStatus(errText, "error");
        return;
      }
      pendingRestorePayload = parsed;
      renderBackupPreview(resp.summary, resp.meta, resp.warnings);
      if (backupApplyBtn) backupApplyBtn.disabled = false;
      setBackupStatus("Validation passed. Review counts below and click Restore Backup.", resp.warnings?.length ? "warn" : "");
    });
  }

  if (openBackupBtn && backupModal) {
    openBackupBtn.addEventListener("click", () => {
      clearPendingRestore();
      setBackupStatus("Export everything to JSON or select a backup file to preview before restoring.");
      backupModal.style.display = "flex";
    });
    if (backupCloseBtn) backupCloseBtn.addEventListener("click", () => closeBackupModal(true));
    if (backupDoneBtn) backupDoneBtn.addEventListener("click", () => closeBackupModal(true));
    backupModal.addEventListener("click", e => {
      if (e.target === backupModal) closeBackupModal(true);
    });
    document.addEventListener("keydown", e => {
      if (backupModal.style.display === "flex" && e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        closeBackupModal(true);
      }
    });
    if (backupExportBtn) {
      backupExportBtn.addEventListener("click", () => {
        setBackupStatus("Generating backup…");
        sendRuntimeMsg({ type: "EXPORT_UNIFIED_BACKUP" }, resp => {
          if (!resp || !resp.ok || !resp.backup) {
            setBackupStatus(resp && resp.error ? resp.error : "Export failed.", "error");
            return;
          }
          const downloaded = downloadJsonObject(resp.filename || "gemini-power-suite-backup.json", resp.backup);
          const c = resp.backup.counts || {};
          setBackupStatus(
            `${downloaded ? "Exported" : "Prepared"} backup (${c.syncSettings || 0} settings, ${c.folders || 0} folders, ${c.prompts || 0} prompts, ${c.bookmarks || 0} bookmarks).`
          );
        });
      });
    }
    if (backupChooseBtn && backupFileInput) {
      backupChooseBtn.addEventListener("click", () => backupFileInput.click());
      backupFileInput.addEventListener("change", () => {
        const file = backupFileInput.files && backupFileInput.files[0];
        if (!file) return;
        if (typeof file.text === "function") {
          file.text().then(handleSelectedBackupText, () => setBackupStatus("Could not read file.", "error"));
        } else if (typeof FileReader === "function") {
          const reader = new FileReader();
          reader.onload = () => handleSelectedBackupText(reader.result);
          reader.onerror = () => setBackupStatus("Could not read file.", "error");
          reader.readAsText(file);
        }
      });
    }
    if (backupApplyBtn) {
      backupApplyBtn.addEventListener("click", () => {
        if (!pendingRestorePayload) return;
        backupApplyBtn.disabled = true;
        setBackupStatus("Restoring backup…");
        sendRuntimeMsg({ type: "IMPORT_UNIFIED_BACKUP", payload: pendingRestorePayload, dryRun: false }, resp => {
          if (!resp || !resp.ok) {
            const errText = resp && Array.isArray(resp.errors) && resp.errors.length > 0
              ? resp.errors[0]
              : (resp && resp.error ? resp.error : "Restore failed");
            setBackupStatus(errText, "error");
            backupApplyBtn.disabled = false;
            return;
          }
          if (resp.syncToWrite) hydratePopupUiFromMap(resp.syncToWrite);
          clearPendingRestore();
          setBackupStatus("Backup restored! Refresh open Gemini tabs to apply local data.");
        });
      });
    }
    window._sgBackupTestHook = { handleSelectedBackupText };
  }

  // System Diagnostics modal controller
  const openDiagBtn = document.getElementById("open-diagnostics-btn");
  const diagModal = document.getElementById("diagnostics-modal");
  const diagCloseBtn = document.getElementById("diagnostics-close-btn");
  const diagDoneBtn = document.getElementById("diagnostics-done-btn");
  const diagRefreshBtn = document.getElementById("diagnostics-refresh-btn");
  const diagProbeModelsBtn = document.getElementById("diagnostics-probe-models-btn");
  const diagSummaryEl = document.getElementById("diagnostics-summary");
  const diagBodyEl = document.getElementById("diagnostics-body");
  const diagCopyBtn = document.getElementById("diagnostics-copy-btn");
  const diagExportBtn = document.getElementById("diagnostics-export-btn");

  let lastDiagResponse = null;

  function statusBadgeClass(status) {
    const s = String(status || "").toLowerCase();
    if (s === "ok" || s === "healthy" || s === "valid" || s === "primary") return "is-ok";
    if (s === "fallback" || s === "degraded" || s === "warn" || s === "warning") return "is-warn";
    if (s === "idle" || s === "no_gemini_tab") return "is-idle";
    return "is-error";
  }

  function formatBytesCompact(n) {
    if (!Number.isFinite(Number(n))) return "n/a";
    const num = Number(n);
    if (num < 1024) return `${num} B`;
    return `${(num / 1024).toFixed(1)} KB`;
  }

  function makeDiagCard(title, badgeText, badgeKind) {
    const card = document.createElement("div");
    card.className = "sg-diag-card";
    const head = document.createElement("div");
    head.className = "sg-diag-card-head";
    const titleEl = document.createElement("span");
    titleEl.className = "sg-diag-card-title";
    titleEl.textContent = title;
    head.appendChild(titleEl);
    if (badgeText) {
      const badge = document.createElement("span");
      badge.className = `sg-diag-badge ${statusBadgeClass(badgeKind || badgeText)}`;
      badge.textContent = badgeText;
      head.appendChild(badge);
    }
    card.appendChild(head);
    return card;
  }

  function appendDiagRow(card, leftText, rightBadgeText, badgeKind) {
    const row = document.createElement("div");
    row.className = "sg-diag-row";
    const left = document.createElement("span");
    left.textContent = leftText;
    row.appendChild(left);
    if (rightBadgeText) {
      const badge = document.createElement("span");
      badge.className = `sg-diag-badge ${statusBadgeClass(badgeKind || rightBadgeText)}`;
      badge.textContent = rightBadgeText;
      row.appendChild(badge);
    }
    card.appendChild(row);
  }

  function appendDiagMeta(card, text) {
    const p = document.createElement("div");
    p.className = "sg-diag-meta";
    p.textContent = text;
    card.appendChild(p);
  }

  function renderDiagnosticsReport(report) {
    if (!diagBodyEl || !report) return;
    while (diagBodyEl.firstChild) diagBodyEl.removeChild(diagBodyEl.firstChild);

    if (diagSummaryEl) {
      const overall = String(report.overallStatus || "unknown").toUpperCase();
      diagSummaryEl.textContent = `Status: ${overall} · v${report.extensionVersion || "2.0.0"}`;
      diagSummaryEl.className = `sg-keybinds-status${report.overallStatus === "error" ? " is-error" : (report.overallStatus === "degraded" ? " is-warn" : "")}`;
    }

    // 1. Active Gemini Tab & UI
    const tab = report.activeGeminiTab || {};
    const tabCard = makeDiagCard(
      "Active Gemini Tab",
      tab.found ? (tab.contentScriptReachable ? "connected" : "error") : "no_gemini_tab",
      tab.found ? (tab.contentScriptReachable ? "ok" : "error") : "idle"
    );
    appendDiagMeta(tabCard, tab.found ? `${tab.sanitizedUrl || "gemini.google.com"}` : "Open a gemini.google.com tab to probe live selectors.");
    if (tab.ui) {
      appendDiagMeta(
        tabCard,
        `UI: Counter=${tab.ui.usageCounterMounted ? "Yes" : "No"} · Orchestrate=${tab.ui.orchestrateBtnMounted ? "Yes" : "No"} · Periodic=${tab.ui.periodicPickerActive ? "On" : "Off"}`
      );
    }
    diagBodyEl.appendChild(tabCard);

    // 2. DOM Selector Health
    const sel = report.selectors || {};
    const selCard = makeDiagCard("DOM Selector Health", sel.overallStatus || "idle");
    if (Array.isArray(sel.groups) && sel.groups.length > 0) {
      sel.groups.forEach(g => {
        const detail = `${g.status.toUpperCase()} (${g.primaryCount}p/${g.fallbackCount}f/${g.missCount}m)`;
        appendDiagRow(selCard, g.label, detail, g.status);
      });
    } else {
      appendDiagMeta(selCard, "Selector probe unavailable without an active Gemini tab.");
    }
    diagBodyEl.appendChild(selCard);

    // 3. Background Workers & Pools
    const sw = report.serviceWorker || {};
    const swBadge = (sw.busyOrchPools || 0) > 0 ? "busy" : "ok";
    const swCard = makeDiagCard("Workers & Service Worker", swBadge, (sw.busyOrchPools || 0) > 0 ? "warn" : "ok");
    appendDiagMeta(
      swCard,
      `Uptime: ${sw.uptimeSec !== null ? `${sw.uptimeSec}s` : "n/a"} · Alarms: ${sw.alarmsCount || 0} · Orch Pools: ${sw.activeOrchPools || 0} (busy ${sw.busyOrchPools || 0})`
    );
    const tc = sw.tempTabCounts || {};
    appendDiagMeta(swCard, `Temp Tabs: opt=${tc.opt || 0}, orch=${tc.orch || 0}, scrape=${tc.scrape || 0}, audit=${tc.audit || 0}`);
    if (Array.isArray(sw.recentEvents) && sw.recentEvents.length > 0) {
      sw.recentEvents.slice(-4).reverse().forEach(ev => {
        appendDiagMeta(swCard, `[${ev.level}] ${ev.scope}:${ev.code} ${ev.message}`);
      });
    } else {
      appendDiagMeta(swCard, "Recent worker events: 0 errors.");
    }
    diagBodyEl.appendChild(swCard);

    // 4. Model Routing & Live Feasibility
    const mr = report.modelRouting || {};
    const mrCard = makeDiagCard("Model Routing", mr.valid ? "valid" : "error");
    appendDiagMeta(mrCard, `Source: ${mr.source || "unknown"}`);
    if (mr.summary && mr.summary.optimize) {
      const optStr = Object.entries(mr.summary.optimize).map(([k, v]) => `${k}=${v}`).join(" | ");
      appendDiagMeta(mrCard, `Optimize: ${optStr}`);
    }
    if (mr.feasibility) {
      appendDiagMeta(
        mrCard,
        `Live Models: ${(mr.feasibility.feasibleModelNames || []).join(", ") || "(none)"} (excluded ${mr.feasibility.excludedCount || 0})`
      );
    }
    diagBodyEl.appendChild(mrCard);

    // 5. Storage Footprint
    const st = report.storage || {};
    const stCard = makeDiagCard("Storage Footprint", "ok");
    appendDiagMeta(stCard, `Sync: ${formatBytesCompact(st.syncBytesInUse)} · Local: ${formatBytesCompact(st.localBytesInUse)}`);
    const c = st.counts || {};
    appendDiagMeta(stCard, `Folders=${c.folders || 0}, Prompts=${c.prompts || 0}, Chains=${c.chains || 0}, Bookmarks=${c.bookmarks || 0}, Notes=${c.chatNotes || 0}`);
    diagBodyEl.appendChild(stCard);
  }

  function runPopupDiagnostics({ probeModels = false } = {}) {
    if (!diagSummaryEl) return;
    diagSummaryEl.textContent = probeModels ? "Running diagnostics + probing Gemini model menu…" : "Running diagnostics…";
    diagSummaryEl.className = "sg-keybinds-status";
    sendRuntimeMsg({ type: "RUN_SYSTEM_DIAGNOSTICS", probeModels, reloadRouting: probeModels }, resp => {
      if (!resp || !resp.ok || !resp.report) {
        diagSummaryEl.textContent = resp && resp.error ? resp.error : "Diagnostics failed.";
        diagSummaryEl.className = "sg-keybinds-status is-error";
        return;
      }
      lastDiagResponse = resp;
      renderDiagnosticsReport(resp.report);
    });
  }

  function closeDiagModal(restoreFocus = true) {
    if (diagModal) diagModal.style.display = "none";
    if (restoreFocus && openDiagBtn && openDiagBtn.isConnected && typeof openDiagBtn.focus === "function") {
      try { openDiagBtn.focus(); } catch (_e) {}
    }
  }

  if (openDiagBtn && diagModal) {
    openDiagBtn.addEventListener("click", () => {
      diagModal.style.display = "flex";
      runPopupDiagnostics({ probeModels: false });
    });
    if (diagCloseBtn) diagCloseBtn.addEventListener("click", () => closeDiagModal(true));
    if (diagDoneBtn) diagDoneBtn.addEventListener("click", () => closeDiagModal(true));
    if (diagRefreshBtn) diagRefreshBtn.addEventListener("click", () => runPopupDiagnostics({ probeModels: false }));
    if (diagProbeModelsBtn) diagProbeModelsBtn.addEventListener("click", () => runPopupDiagnostics({ probeModels: true }));
    if (diagCopyBtn) {
      diagCopyBtn.addEventListener("click", () => {
        const text = lastDiagResponse?.formattedText || "";
        if (!text) return;
        if (typeof navigator !== "undefined" && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
          navigator.clipboard.writeText(text).then(() => {
            if (diagSummaryEl) diagSummaryEl.textContent = "Diagnostics report copied to clipboard.";
          }).catch(() => {});
        }
      });
    }
    if (diagExportBtn) {
      diagExportBtn.addEventListener("click", () => {
        if (!lastDiagResponse || !lastDiagResponse.report) return;
        const day = new Date().toISOString().slice(0, 10);
        const ok = downloadJsonObject(`gemini-power-suite-diagnostics-${day}.json`, lastDiagResponse.report);
        if (diagSummaryEl && ok) diagSummaryEl.textContent = "Exported sanitized diagnostics JSON.";
      });
    }
    diagModal.addEventListener("click", e => {
      if (e.target === diagModal) closeDiagModal(true);
    });
    document.addEventListener("keydown", e => {
      if (diagModal.style.display === "flex" && e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        closeDiagModal(true);
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
  chrome.storage.sync.get(ALL_POPUP_SYNC_KEYS, hydratePopupUiFromMap);

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
