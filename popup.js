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
      section.querySelectorAll("input").forEach(inp => inp.disabled = false);
    } else {
      section.classList.add("disabled");
      section.querySelectorAll("input").forEach(inp => inp.disabled = true);
    }
  });
}

// Menu-dependent toggle state
function updateMenuDependentSettings(enabled) {
  const foldersToggle = document.getElementById("folders-toggle");
  const promptsToggle = document.getElementById("prompts-toggle");
  const settingsMenuToggle = document.getElementById("settings-menu-toggle");
  
  [foldersToggle, promptsToggle, settingsMenuToggle].forEach(toggle => {
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

// Helper to bind standard toggle
function setupToggle({ id, storageKey, defaultOn, enableMsg, disableMsg, onChange }) {
  const toggle = document.getElementById(id);
  if (!toggle) return;

  chrome.storage.sync.get([storageKey], res => {
    const val = defaultOn ? res[storageKey] !== false : res[storageKey] === true;
    toggle.checked = val;
    if (onChange) onChange(val);
  });

  toggle.addEventListener("change", () => {
    const val = toggle.checked;
    chrome.storage.sync.set({ [storageKey]: val });
    if (enableMsg && disableMsg) {
      sendMessageToContentScript(val ? enableMsg : disableMsg);
    }
    if (onChange) onChange(val);
  });
}

// Segmented control helper for Model Settings modal
function wireSegmented(containerId, storageKey, defaultVal) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const options = Array.from(container.querySelectorAll(".sg-seg-opt"));
  if (!options.length) return;

  const setActive = (val) => {
    options.forEach(opt => {
      const match = opt.dataset.value === val;
      opt.classList.toggle("sg-active", match);
      opt.setAttribute("aria-checked", match ? "true" : "false");
      opt.tabIndex = match ? 0 : -1;
    });
  };

  chrome.storage.sync.get([storageKey], res => {
    const current = res[storageKey] || defaultVal;
    setActive(current);
  });

  options.forEach(opt => {
    opt.addEventListener("click", () => {
      const val = opt.dataset.value;
      setActive(val);
      chrome.storage.sync.set({ [storageKey]: val });
    });
  });
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
    chrome.storage.sync.get(["extensionEnabled"], res => {
      const isEnabled = res.extensionEnabled !== false;
      masterToggle.checked = isEnabled;
      updateSettingsState(isEnabled);
    });

    masterToggle.addEventListener("change", () => {
      if (masterToggle.checked) {
        setMasterState(true);
      } else {
        // Show warning before disabling
        masterToggle.checked = true; // keep checked until confirmed
        if (warnModal) warnModal.style.display = "flex";
      }
    });
  }

  if (warnConfirm) {
    warnConfirm.addEventListener("click", () => {
      if (masterToggle) masterToggle.checked = false;
      setMasterState(false);
      if (warnModal) warnModal.style.display = "none";
    });
  }
  if (warnCancel) {
    warnCancel.addEventListener("click", () => {
      if (warnModal) warnModal.style.display = "none";
    });
  }
  if (warnClose) {
    warnClose.addEventListener("click", () => {
      if (warnModal) warnModal.style.display = "none";
    });
  }
  if (warnModal) {
    warnModal.addEventListener("click", e => {
      if (e.target === warnModal) warnModal.style.display = "none";
    });
  }

  // 3. Menu & Folders section toggles
  setupToggle({
    id: "sidebar-dropdown-toggle",
    storageKey: "sidebarDropdownEnabled",
    defaultOn: true,
    enableMsg: "ENABLE_SIDEBAR_DROPDOWN",
    disableMsg: "DISABLE_SIDEBAR_DROPDOWN",
    onChange: updateMenuDependentSettings
  });

  setupToggle({
    id: "folders-toggle",
    storageKey: "foldersEnabled",
    defaultOn: true,
    enableMsg: "ENABLE_FOLDERS",
    disableMsg: "DISABLE_FOLDERS",
    onChange: updateTrashcanDependencyState
  });

  setupToggle({
    id: "trashcan-toggle",
    storageKey: "trashcanEnabled",
    defaultOn: true,
    enableMsg: "ENABLE_TRASHCAN",
    disableMsg: "DISABLE_TRASHCAN"
  });

  setupToggle({
    id: "prompts-toggle",
    storageKey: "promptsEnabled",
    defaultOn: true,
    enableMsg: "ENABLE_PROMPTS",
    disableMsg: "DISABLE_PROMPTS"
  });

  setupToggle({
    id: "settings-menu-toggle",
    storageKey: "settingsInMenuEnabled",
    defaultOn: true,
    enableMsg: "ENABLE_SETTINGS_MENU",
    disableMsg: "DISABLE_SETTINGS_MENU"
  });

  // 4. Interface Enhancements
  setupToggle({
    id: "export-btn-toggle",
    storageKey: "showExportButton",
    defaultOn: true,
    enableMsg: "ENABLE_EXPORT_BTN",
    disableMsg: "DISABLE_EXPORT_BTN"
  });

  setupToggle({
    id: "info-btn-toggle",
    storageKey: "showInfoButton",
    defaultOn: true,
    enableMsg: "ENABLE_INFO_BTN",
    disableMsg: "DISABLE_INFO_BTN"
  });

  setupToggle({
    id: "wide-chat-btn-toggle",
    storageKey: "showWideChatButton",
    defaultOn: true,
    enableMsg: "SHOW_WIDE_BTN",
    disableMsg: "HIDE_WIDE_BTN"
  });

  setupToggle({
    id: "timestamps-toggle",
    storageKey: "timestampsEnabled",
    defaultOn: false,
    enableMsg: "ENABLE_TIMESTAMPS",
    disableMsg: "DISABLE_TIMESTAMPS"
  });

  setupToggle({
    id: "optimize-toggle",
    storageKey: "optimizeEnabled",
    defaultOn: true,
    enableMsg: "ENABLE_OPTIMIZE",
    disableMsg: "DISABLE_OPTIMIZE"
  });

  setupToggle({
    id: "counter-toggle",
    storageKey: "counterEnabled",
    defaultOn: true,
    enableMsg: "ENABLE_COUNTER",
    disableMsg: "DISABLE_COUNTER"
  });

  setupToggle({
    id: "daily-counter-toggle",
    storageKey: "dailyCounterVisible",
    defaultOn: true,
    enableMsg: "SHOW_DAILY_COUNTER",
    disableMsg: "HIDE_DAILY_COUNTER"
  });

  setupToggle({
    id: "scroll-toggle",
    storageKey: "scrollButtonsEnabled",
    defaultOn: true,
    enableMsg: "ENABLE_SCROLL_BUTTONS",
    disableMsg: "DISABLE_SCROLL_BUTTONS"
  });

  setupToggle({
    id: "download-audio-toggle",
    storageKey: "downloadAudioEnabled",
    defaultOn: true,
    enableMsg: "ENABLE_DOWNLOAD_AUDIO",
    disableMsg: "DISABLE_DOWNLOAD_AUDIO"
  });

  setupToggle({
    id: "bookmarks-toggle",
    storageKey: "bookmarksEnabled",
    defaultOn: true,
    enableMsg: "ENABLE_BOOKMARKS",
    disableMsg: "DISABLE_BOOKMARKS"
  });

  setupToggle({
    id: "queue-toggle",
    storageKey: "queueingEnabled",
    defaultOn: true,
    enableMsg: "ENABLE_QUEUING",
    disableMsg: "DISABLE_QUEUING",
    onChange: updateQueueParamsState
  });

  setupToggle({
    id: "show-queue-toggle",
    storageKey: "showQueueWindow",
    defaultOn: true,
    enableMsg: "SHOW_QUEUE_WINDOW",
    disableMsg: "HIDE_QUEUE_WINDOW"
  });

  // 5. Sidebar Section
  setupToggle({
    id: "pinned-collapse-toggle",
    storageKey: "collapsiblePinnedEnabled",
    defaultOn: true,
    enableMsg: "ENABLE_COLLAPSIBLE_PINNED",
    disableMsg: "DISABLE_COLLAPSIBLE_PINNED"
  });

  setupToggle({
    id: "drag-chat-input-toggle",
    storageKey: "dragChatToInputEnabled",
    defaultOn: true,
    enableMsg: "ENABLE_DRAG_CHAT_INPUT",
    disableMsg: "DISABLE_DRAG_CHAT_INPUT"
  });

  // 6. UI Declutter Section
  setupToggle({
    id: "hide-upgrade-btns-toggle",
    storageKey: "hideUpgradeButtons",
    defaultOn: true,
    enableMsg: "HIDE_UPGRADE_BUTTONS",
    disableMsg: "SHOW_UPGRADE_BUTTONS"
  });

  setupToggle({
    id: "location-info-toggle",
    storageKey: "hideLocationInfo",
    defaultOn: true,
    enableMsg: "HIDE_LOCATION_INFO",
    disableMsg: "SHOW_LOCATION_INFO"
  });

  setupToggle({
    id: "activity-toggle",
    storageKey: "hideActivity",
    defaultOn: true,
    enableMsg: "HIDE_ACTIVITY",
    disableMsg: "SHOW_ACTIVITY"
  });

  setupToggle({
    id: "hide-gems-button-toggle",
    storageKey: "hideGemsSidebarButton",
    defaultOn: false,
    enableMsg: "HIDE_GEMS_SIDEBAR_BUTTON",
    disableMsg: "SHOW_GEMS_SIDEBAR_BUTTON"
  });

  // 7. Google Drive Sync Toggle
  const driveSyncToggle = document.getElementById("drive-sync-toggle");
  if (driveSyncToggle) {
    chrome.storage.sync.get(["driveSyncEnabled"], res => {
      driveSyncToggle.checked = !!res.driveSyncEnabled;
    });

    driveSyncToggle.addEventListener("change", () => {
      if (driveSyncToggle.checked) {
        driveSyncToggle.disabled = true;
        chrome.permissions.request({ permissions: ["identity"] }, granted => {
          if (!granted) {
            driveSyncToggle.checked = false;
            driveSyncToggle.disabled = false;
            return;
          }
          chrome.runtime.sendMessage({ type: "DRIVE_SYNC_CONNECT" }, resp => {
            driveSyncToggle.disabled = false;
            if (resp && resp.authorized) {
              chrome.storage.sync.set({ driveSyncEnabled: true });
            } else {
              driveSyncToggle.checked = false;
              chrome.storage.sync.set({ driveSyncEnabled: false });
            }
          });
        });
      } else {
        driveSyncToggle.disabled = true;
        chrome.runtime.sendMessage({ type: "DRIVE_SYNC_DISCONNECT" }, () => {
          driveSyncToggle.disabled = false;
          chrome.storage.sync.set({ driveSyncEnabled: false });
        });
      }
    });
  }

  // 8. Model Settings Modal
  const modelBtn = document.getElementById("model-settings-btn");
  const modelModal = document.getElementById("model-settings-modal");
  const modelClose = document.getElementById("model-settings-close-btn");

  if (modelBtn && modelModal) {
    modelBtn.addEventListener("click", () => {
      modelModal.style.display = "flex";
      document.documentElement.classList.add("no-scroll");
    });
  }
  const closeModel = () => {
    if (modelModal) {
      modelModal.style.display = "none";
      document.documentElement.classList.remove("no-scroll");
    }
  };
  if (modelClose) modelClose.addEventListener("click", closeModel);
  if (modelModal) {
    modelModal.addEventListener("click", e => {
      if (e.target === modelModal) closeModel();
    });
  }

  wireSegmented("default-model-seg", "defaultModel", "none");
  wireSegmented("default-thinking-level-seg", "defaultReasoningEffort", "none");
  wireSegmented("optimize-model-seg", "optimizeModel", "flash");
});
