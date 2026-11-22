const GEMINI_SELECTORS = Object.freeze({
  chatHistory: ["infinite-scroller.chat-history", "infinite-scroller", '[class*="chat-history"]'],
  chatHistoryCanvas: ["infinite-scroller.immersives-open"],
  sidebarScroller: ["bard-sidenav infinite-scroller", 'infinite-scroller[scrollable="true"]', '[role="navigation"]', ".conversations-container", ".infinite-scroller"],
  conversationsList: ["conversations-list", "infinite-scroller"],
  sidebarNav: ["conversations-list", "mat-sidenav", '[class*="sidenav"]'],
  sidebarContainer: [".sidenav-with-history-container"],
  sidebarTarget: ["side-nav", "nav", "body"],
  sideNavEntryContainer: [".side-nav-entry-container"],
  sideNavEntryButton: ["side-nav-entry-button"],
  sideNavMenuButton: ['button[data-test-id="side-nav-menu-button"]'],
  promptInput: ["rich-textarea .ql-editor", '.ql-editor[contenteditable="true"]', '[contenteditable="true"][role="textbox"]', 'textarea[placeholder*="Enter"]'],
  promptInputFullscreen: [".ql-editor.isFullscreen"],
  inputAreaContainer: ["input-area-v2", ".input-area", ".text-input-field", "rich-textarea"],
  inputAreaSwitch: ["button.input-area-switch"],
  sendButton: ['.send-button-container button:has(mat-icon[fonticon="arrow_upward"])', 'button[data-test-id="send-button"]', 'button[aria-label*="Send"]', 'button[aria-label*="send"]', ".send-button", 'button mat-icon[data-mat-icon-name="send"]', 'button:has(mat-icon[data-mat-icon-name="send"])'],
  queueSendButton: [".send-button-container button", ".send-button button", 'button:has(mat-icon[fonticon="arrow_upward"])', 'button:has(mat-icon[fonticon="send"])', 'button[data-testid="send_button"]', 'button[aria-label*="Send"]', 'button[aria-label*="send"]', 'button[aria-label="Send message"]'],
  queueInput: ["div.ql-editor", "textarea.mat-mdc-input-element", "rich-textarea .ql-editor"],
  queueStopIcon: ['[fonticon="stop"]'],
  userQuery: ["user-query", ".user-message", '[data-message-author="user"]', ".query-content"],
  modelResponse: ["model-response", ".model-response", '[data-message-author="model"]', "message-content .markdown-main-panel"],
  allMessages: ["user-query, model-response"],
  dialog: ["mat-dialog-container", ".mat-mdc-dialog-container", '[role="dialog"]'],
  dialogTitle: ['h1[data-test-id="message-dialog-title"]', ".mat-mdc-dialog-title", ".mdc-dialog__title"],
  dialogContent: ['[data-test-id="message-dialog-content"] p', ".mat-mdc-dialog-content p", ".message-dialog-content p"],
  dialogConfirmButton: ['button[data-test-id="confirm-button"]', '.mat-mdc-button.mat-primary:not([data-test-id="cancel-button"])'],
  dialogCancelButton: ['button[data-test-id="cancel-button"]', ".mat-mdc-button:not(.mat-primary)"],
  overlayAll: [".cdk-overlay-container", ".cdk-overlay-pane", ".cdk-overlay-backdrop"],
  overlayPane: [".cdk-overlay-pane"],
  overlayBackdrop: [".cdk-overlay-backdrop"],
  nativeMenu: [".cdk-overlay-pane", "mat-menu-panel", ".mat-mdc-menu-panel"],
  menuItems: [".mat-mdc-menu-item", '[role="menuitem"]'],
  menuContent: [".mat-mdc-menu-content"],
  menuTrigger: ["button[matDynamicMenuTriggerFor]", 'button[aria-haspopup="menu"]', ".mat-mdc-menu-trigger", 'button[aria-label*="More"]', ".actions button"],
  modeMenuButton: ['[data-test-id="bard-mode-menu-button"]'],
  modeOptions: ['[data-test-id^="bard-mode-option-"]'],
  thinkingLevelItems: ['gem-menu-item[value="thinking_level"]', 'gem-menu-item:not([data-test-id]):not([value]):not([aria-controls])', 'button[role="menuitemradio"]'],
  svgCodeBlock: ["svg-code-block"],
  nativeSearchButtons: ['button[data-test-id="search-button"]', 'button[aria-label*="Search" i]', 'button[aria-label*="Tìm kiếm" i]'],
  stopButton: ['button[data-test-id="stop-button"]', "button.stop", 'button:has(mat-icon[fonticon="stop"])'],
  tempChatButton: ["temp-chat-button button", '[data-test-id="temp-chat-button-container"] button', 'button[jslog^="274589"]', '[data-test-id="temp-chat-button"]', "ms-incognito-mode-toggle button"],
  tempChatToggle: ["temp-chat-button", '[data-test-id="temp-chat-button-container"]', 'button[jslog^="274589"]', '[data-test-id="temp-chat-button"]', 'button[aria-label="Temporary chat toggle"]', "ms-incognito-mode-toggle button"],
  tempChatActive: ["chat-window.is-temporary-chat", 'temp-chat-button mat-icon[fonticon="close"]', "temp-chat-button .temp-chat-on", '[data-test-id="temp-chat-button"].temp-chat-on'],
  newChatButton: ['a[data-test-id="expanded-button"][href="/app"]', 'a[data-test-id="expanded-button"][href$="/app"]', 'a[href="/app"]', 'a[href$="/app"]', '[data-test-id="new-chat-button"] a[href="/app"]', '[data-test-id="new-chat-button"] a[href$="/app"]', 'button[aria-label*="New chat" i]', '[aria-label*="New chat" i]', '[aria-label="Create new chat" i]', 'button[aria-label*="Cuộc trò chuyện mới" i]'],
  gemsHeader: ['gem-nav-list-item:has(a[href$="/gems/view"])', 'gem-nav-list-item[data-test-id="gems-side-nav-entry-button"]', '[data-test-id="bot-list-side-nav-entry-button"]', 'div[aria-label="Gems"]'],
  gemsSidebarItems: ["div.bot-item"],
  myStuff: ['[data-test-id="library-side-nav-entry-button"]', '[data-test-id="my-stuff-side-nav-entry-button"]', 'div[aria-label="My Stuff"]'],
  activityButton: ['[data-test-id="desktop-bard-activity-control"]', 'button[aria-label="Gemini Apps Activity"]'],
  copyButton: ["copy-button", 'button[aria-label="Copy"]'],
  sgPriorityOverlays: [".sg-modal-overlay", ".sg-folders-modal", ".sg-context-menu", ".sg-info-popup", ".cdk-overlay-pane", "mat-dialog-container", ".mat-mdc-dialog-container"],
  sgFoldersModal: [".sg-folders-modal"]
});

function _resolveSelectors(e) {
  return Array.isArray(e) ? e : "string" == typeof e && GEMINI_SELECTORS[e] ? GEMINI_SELECTORS[e] : "string" == typeof e ? [e] : [];
}

function domQuery(e, t = document) {
  const n = _resolveSelectors(e);
  for (const e of n) {
    try {
      const n = t.querySelector(e);
      if (n) return n;
    } catch (e) {}
  }
  return null;
}

function domQueryAll(e, t = document, n = {}) {
  const o = _resolveSelectors(e);
  if (n.fallback) {
    for (const e of o) {
      try {
        const n = t.querySelectorAll(e);
        if (n.length > 0) return n;
      } catch (e) {}
    }
    return [];
  }
  try {
    return t.querySelectorAll(o.join(", "));
  } catch (e) {
    return [];
  }
}

const _sgSelectorHealth = new Map();
const _sgSelectorWarnedKeys = new Set();

function sgQueryWithHealth(key, root = document, options = {}) {
  const list = _resolveSelectors(key);
  if (!list.length || !root || typeof root.querySelector !== "function") return null;

  const metricKey = typeof key === "string" ? key : list[0];
  const primarySelector = list[0];
  const silent = typeof SG_IS_SILENT_BG_WORKER_TAB !== "undefined" && SG_IS_SILENT_BG_WORKER_TAB;

  for (let i = 0; i < list.length; i++) {
    try {
      const el = root.querySelector(list[i]);
      if (el) {
        if (i > 0) {
          const prev = _sgSelectorHealth.get(metricKey);
          const count = (prev ? prev.count : 0) + 1;
          _sgSelectorHealth.set(metricKey, {
            status: "fallback",
            matchedIndex: i,
            matchedSelector: list[i],
            primarySelector,
            count
          });
          if (!silent && !_sgSelectorWarnedKeys.has(metricKey)) {
            _sgSelectorWarnedKeys.add(metricKey);
            console.warn(`[SG.selectors] Primary selector missed for "${metricKey}", fell back to #${i} (${list[i]})`);
          }
        }
        return el;
      }
    } catch (_e) {}
  }

  if (options && options.warnOnMiss) {
    const prev = _sgSelectorHealth.get(metricKey);
    const count = (prev ? prev.count : 0) + 1;
    _sgSelectorHealth.set(metricKey, {
      status: "miss",
      matchedIndex: -1,
      matchedSelector: null,
      primarySelector,
      count
    });
    if (!silent && !_sgSelectorWarnedKeys.has(`miss:${metricKey}`)) {
      _sgSelectorWarnedKeys.add(`miss:${metricKey}`);
      console.warn(`[SG.selectors] All selectors missed for "${metricKey}" (${primarySelector})`);
    }
  }
  return null;
}

function sgGetSelectorHealthReport() {
  const out = {};
  for (const [k, v] of _sgSelectorHealth.entries()) {
    out[k] = Object.assign({}, v);
  }
  return out;
}

const SG_DIAG_DEFAULT_PROBE_KEYS = Object.freeze([
  "promptInput", "inputAreaContainer", "sendButton",
  "modeMenuButton", "inputAreaSwitch",
  "sidebarScroller", "conversationsList", "tempChatButton", "newChatButton",
  "userQuery", "modelResponse", "chatHistory",
  "stopButton", "nativeSearchButtons"
]);

function sgRunSelectorDiagnosticsProbe(root = typeof document !== "undefined" ? document : null, keys = null) {
  const keyList = Array.isArray(keys) && keys.length > 0 ? keys : SG_DIAG_DEFAULT_PROBE_KEYS;
  const out = {};
  for (const key of keyList) {
    const list = _resolveSelectors(key);
    const rt = _sgSelectorHealth.get(key);
    if (!list.length || !root || typeof root.querySelector !== "function") {
      out[key] = {
        key,
        status: "miss",
        matchedIndex: -1,
        matchedSelector: null,
        primarySelector: list[0] || null,
        runtimeFallbackCount: rt ? rt.count : 0
      };
      continue;
    }
    let matchedIdx = -1;
    let matchedSel = null;
    for (let i = 0; i < list.length; i++) {
      try {
        if (root.querySelector(list[i])) {
          matchedIdx = i;
          matchedSel = list[i];
          break;
        }
      } catch (_e) {}
    }
    out[key] = {
      key,
      status: matchedIdx === 0 ? "primary" : (matchedIdx > 0 ? "fallback" : "miss"),
      matchedIndex: matchedIdx,
      matchedSelector: matchedSel,
      primarySelector: list[0],
      runtimeFallbackCount: rt ? rt.count : 0
    };
  }
  return out;
}

if (typeof SG !== "undefined" && SG) {
  SG.selectors = Object.freeze({
    map: GEMINI_SELECTORS,
    resolve: _resolveSelectors,
    query: domQuery,
    queryAll: domQueryAll,
    queryWithHealth: sgQueryWithHealth,
    getHealthReport: sgGetSelectorHealthReport,
    runDiagnosticsProbe: sgRunSelectorDiagnosticsProbe
  });
}
