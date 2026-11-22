(() => {
  const _storageSubscribers = new Map();
  let _storageNativeBound = false;

  function isSilentWorker() {
    return typeof SG_IS_SILENT_BG_WORKER_TAB !== "undefined" && SG_IS_SILENT_BG_WORKER_TAB;
  }

  function onNativeStorageChanged(changes, areaName) {
    if (!changes) return;
    const entries = Array.from(_storageSubscribers.values());
    for (const sub of entries) {
      if (sub.area !== "any" && sub.area !== areaName) continue;
      if (sub.keys) {
        let hit = false;
        for (const k of sub.keys) {
          if (Object.prototype.hasOwnProperty.call(changes, k)) {
            hit = true;
            break;
          }
        }
        if (!hit) continue;
      }
      try {
        sub.handler(changes, areaName);
      } catch (err) {
        console.error(`[SG.storage] Subscriber "${sub.id}" error:`, err);
      }
    }
  }

  function ensureStorageListener() {
    if (_storageNativeBound || isSilentWorker()) return;
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged && typeof chrome.storage.onChanged.addListener === "function") {
      _storageNativeBound = true;
      chrome.storage.onChanged.addListener(onNativeStorageChanged);
    }
  }

  function onStorageChanged(id, handler, opts = {}) {
    if (!id || typeof handler !== "function") return false;
    ensureStorageListener();
    const area = opts && typeof opts.area === "string" && opts.area ? opts.area : "any";
    const keys = opts && Array.isArray(opts.keys) && opts.keys.length > 0 ? opts.keys.slice() : null;
    _storageSubscribers.set(String(id), { id: String(id), handler, area, keys });
    return true;
  }

  function offStorageChanged(id) {
    return _storageSubscribers.delete(String(id));
  }

  function listStorageSubscribers() {
    return Array.from(_storageSubscribers.keys());
  }

  const _msgTypeHandlers = new Map();
  const _msgMatchers = new Map();
  let _msgNativeBound = false;

  function onNativeRuntimeMessage(msg, sender, sendResponse) {
    let keepChannelOpen = false;
    const type = msg && typeof msg === "object" ? msg.type : undefined;

    if (typeof type === "string" && _msgTypeHandlers.has(type)) {
      const handler = _msgTypeHandlers.get(type);
      try {
        if (handler(msg, sender, sendResponse) === true) {
          keepChannelOpen = true;
        }
      } catch (err) {
        console.error(`[SG.messages] Handler error for "${type}":`, err);
      }
    }

    for (const entry of Array.from(_msgMatchers.values())) {
      let matched = false;
      try {
        matched = Boolean(entry.predicate(msg, sender));
      } catch (err) {
        console.error(`[SG.messages] Matcher "${entry.id}" predicate error:`, err);
      }
      if (!matched) continue;
      try {
        if (entry.handler(msg, sender, sendResponse) === true) {
          keepChannelOpen = true;
        }
      } catch (err) {
        console.error(`[SG.messages] Matcher "${entry.id}" handler error:`, err);
      }
    }

    return keepChannelOpen === true;
  }

  function ensureMessageListener() {
    if (_msgNativeBound || isSilentWorker()) return;
    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage && typeof chrome.runtime.onMessage.addListener === "function") {
      _msgNativeBound = true;
      chrome.runtime.onMessage.addListener(onNativeRuntimeMessage);
    }
  }

  function onMessageType(type, handler) {
    if (!type || typeof handler !== "function") return false;
    ensureMessageListener();
    _msgTypeHandlers.set(String(type), handler);
    return true;
  }

  function onMessageMatcher(id, predicate, handler) {
    if (!id || typeof predicate !== "function" || typeof handler !== "function") return false;
    ensureMessageListener();
    _msgMatchers.set(String(id), { id: String(id), predicate, handler });
    return true;
  }

  function offMessage(key) {
    const k = String(key);
    return _msgTypeHandlers.delete(k) || _msgMatchers.delete(k);
  }

  if (typeof SG !== "undefined" && SG) {
    SG.storage = Object.freeze({
      onChanged: onStorageChanged,
      offChanged: offStorageChanged,
      listSubscribers: listStorageSubscribers
    });
    SG.messages = Object.freeze({
      on: onMessageType,
      onMatcher: onMessageMatcher,
      off: offMessage
    });
  }

  if (!isSilentWorker()) {
    onMessageType("RUN_SELECTOR_DIAGNOSTICS", (_msg, _sender, sendResponse) => {
      const selApi = typeof SG !== "undefined" && SG && SG.selectors ? SG.selectors : null;
      const hasDoc = typeof document !== "undefined" && document;
      const selectorProbe = selApi && typeof selApi.runDiagnosticsProbe === "function"
        ? selApi.runDiagnosticsProbe(hasDoc ? document : null)
        : {};
      const runtimeHealth = selApi && typeof selApi.getHealthReport === "function"
        ? selApi.getHealthReport()
        : {};
      const byId = id => (hasDoc && typeof document.getElementById === "function" ? document.getElementById(id) : null);
      const qSel = s => (hasDoc && typeof document.querySelector === "function" ? document.querySelector(s) : null);
      const ui = {
        extensionEnabled: typeof SG !== "undefined" && SG && SG.state ? SG.state.extensionEnabled !== false : null,
        usageCounterMounted: Boolean(byId("sg-usage-counter")),
        orchestrateBtnMounted: Boolean(byId("sg-orchestrate-btn")),
        periodicPickerActive: typeof isPeriodicModelPickerEnabled !== "undefined"
          ? Boolean(isPeriodicModelPickerEnabled)
          : Boolean(byId("sg-periodic-model-panel")),
        hasMessages: Boolean(qSel("user-query, model-response"))
      };
      if (typeof sendResponse === "function") {
        sendResponse({ ok: true, selectorProbe, runtimeHealth, ui });
      }
      return false;
    });

    if (typeof sgApplyBootstrapSyncDelta === "function") {
      _sgBootstrapSyncListenerBound = true;
      onStorageChanged("core:bootstrap-sync-cache", sgApplyBootstrapSyncDelta, { area: "sync" });
    }
  }
})();
