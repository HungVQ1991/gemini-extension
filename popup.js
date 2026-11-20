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
function wireSegmented(containerId, storageKey, defaultVal, initialData = null) {
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
    const current = safe[storageKey] || defaultVal;
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
      tabs.forEach(tab => {
        chrome.tabs.reload(tab.id).catch(() => {});
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
    { id: "skills-injection-toggle", storageKey: "skillsInjectionEnabled", defaultOn: true, enableMsg: "ENABLE_SKILLS_INJECTION", disableMsg: "DISABLE_SKILLS_INJECTION" },
    { id: "baseline-injection-toggle", storageKey: "baselineInjectionEnabled", defaultOn: true, enableMsg: "ENABLE_BASELINE_INJECTION", disableMsg: "DISABLE_BASELINE_INJECTION" },
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
    { id: "command-palette-toggle", storageKey: "commandPaletteEnabled", defaultOn: true, enableMsg: "ENABLE_COMMAND_PALETTE", disableMsg: "DISABLE_COMMAND_PALETTE" },
    { id: "periodic-model-picker-toggle", storageKey: "periodicModelPickerEnabled", defaultOn: false, enableMsg: "ENABLE_PERIODIC_MODEL_PICKER", disableMsg: "DISABLE_PERIODIC_MODEL_PICKER" },
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
    { id: "hide-gems-button-toggle", storageKey: "hideGemsSidebarButton", defaultOn: false, enableMsg: "HIDE_GEMS_SIDEBAR_BUTTON", disableMsg: "SHOW_GEMS_SIDEBAR_BUTTON" }
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

  const hydrateOptimizeSeg = wireSegmented("optimize-model-seg", "optimizeModel", "flash");

  // Single batched chrome.storage.sync.get for all popup settings (33 -> 1 IPC)
  const ALL_POPUP_SYNC_KEYS = [
    "extensionEnabled",
    ...toggleConfigs.map(cfg => cfg.storageKey),
    "driveSyncEnabled",
    "optimizeModel"
  ];
  chrome.storage.sync.get(ALL_POPUP_SYNC_KEYS, res => {
    const safeRes = res || {};
    const isEnabled = safeRes.extensionEnabled !== false;
    if (masterToggle) masterToggle.checked = isEnabled;
    toggleHydrators.forEach(fn => fn(safeRes));
    if (driveSyncToggle) driveSyncToggle.checked = !!safeRes.driveSyncEnabled;
    if (hydrateOptimizeSeg) hydrateOptimizeSeg(safeRes);
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
