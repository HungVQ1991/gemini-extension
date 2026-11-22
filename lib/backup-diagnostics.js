(function (root) {
  "use strict";

  const BACKUP_FORMAT = "gps-unified-backup-v1";
  const BACKUP_SCHEMA_VERSION = 1;
  const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

  const SYNC_BACKUP_KEY_TYPES = Object.freeze({
    // Boolean settings & feature toggles
    extensionEnabled: "boolean",
    sidebarDropdownEnabled: "boolean",
    foldersEnabled: "boolean",
    trashcanEnabled: "boolean",
    promptsEnabled: "boolean",
    skillsInjectionEnabled: "boolean",
    baselineInjectionEnabled: "boolean",
    folderUploadEnabled: "boolean",
    showExportButton: "boolean",
    showInfoButton: "boolean",
    showWideChatButton: "boolean",
    autohideTopActions: "boolean",
    timestampsEnabled: "boolean",
    optimizeEnabled: "boolean",
    counterEnabled: "boolean",
    downloadAudioEnabled: "boolean",
    bookmarksEnabled: "boolean",
    conversationOutlineEnabled: "boolean",
    forkHandoffEnabled: "boolean",
    codeBlockActionsEnabled: "boolean",
    diagramRendererEnabled: "boolean",
    commandPaletteEnabled: "boolean",
    periodicModelPickerEnabled: "boolean",
    orchestratorEnabled: "boolean",
    queueingEnabled: "boolean",
    showQueueWindow: "boolean",
    autohideCollapsedSidebar: "boolean",
    collapsiblePinnedEnabled: "boolean",
    dragChatToInputEnabled: "boolean",
    hideUpgradeButtons: "boolean",
    hideLocationInfo: "boolean",
    hideActivity: "boolean",
    hideGemsSidebarButton: "boolean",
    focusShortcutEnabled: "boolean",
    driveSyncEnabled: "boolean",
    gpsDropdownExpanded: "boolean",
    hideFolderedChats: "boolean",
    hideFolderedInChatsTab: "boolean",
    settingsInMenuEnabled: "boolean",
    // String settings
    optimizeModel: "string_short",
    defaultModel: "string_short",
    defaultReasoningEffort: "string_short",
    tempChatModel: "string_short",
    customOptimizePrompt: "string_long",
    customFollowupPrompt: "string_long",
    // 17 Rebindable shortcuts & enabled flags
    optimizeShortcut: "shortcut",
    optimizeShortcutEnabled: "boolean",
    grammarShortcut: "shortcut",
    grammarShortcutEnabled: "boolean",
    foldersShortcut: "shortcut",
    foldersShortcutEnabled: "boolean",
    promptsShortcut: "shortcut",
    promptsShortcutEnabled: "boolean",
    settingsShortcut: "shortcut",
    settingsShortcutEnabled: "boolean",
    sidebarShortcut: "shortcut",
    sidebarShortcutEnabled: "boolean",
    newchatShortcut: "shortcut",
    newchatShortcutEnabled: "boolean",
    tempChatShortcut: "shortcut",
    tempChatShortcutEnabled: "boolean",
    instructionsShortcut: "shortcut",
    instructionsShortcutEnabled: "boolean",
    cycleModeShortcut: "shortcut",
    cycleModeShortcutEnabled: "boolean",
    thinkingLevelShortcut: "shortcut",
    thinkingLevelShortcutEnabled: "boolean",
    imageShortcut: "shortcut",
    imageShortcutEnabled: "boolean",
    noToolShortcut: "shortcut",
    noToolShortcutEnabled: "boolean",
    deepResearchShortcut: "shortcut",
    deepResearchShortcutEnabled: "boolean",
    canvasShortcut: "shortcut",
    canvasShortcutEnabled: "boolean",
    videoShortcut: "shortcut",
    videoShortcutEnabled: "boolean",
    musicShortcut: "shortcut",
    musicShortcutEnabled: "boolean"
  });

  const LOCAL_BACKUP_KEY_TYPES = Object.freeze({
    gpsFolders: "folders",
    gpsPrompts: "prompts",
    gpsChains: "chains",
    sgBookmarks: "object",
    sgForkOrigins: "object",
    sg_chat_notes: "string_map",
    sgSkillsLocal: "object",
    sgBaselineLocal: "object",
    sgBaselineAccountPrefs: "object",
    sgChatsTabSortAZ: "boolean",
    sgAddChatsSortAZ: "boolean"
  });

  const CRITICAL_SELECTOR_GROUPS = Object.freeze([
    Object.freeze({
      id: "composer",
      label: "Composer & Send",
      required: true,
      keys: Object.freeze(["promptInput", "inputAreaContainer", "sendButton"])
    }),
    Object.freeze({
      id: "modelPicker",
      label: "Model Picker",
      required: true,
      keys: Object.freeze(["modeMenuButton", "inputAreaSwitch"])
    }),
    Object.freeze({
      id: "navigation",
      label: "Sidebar & New Chat",
      required: true,
      keys: Object.freeze(["sidebarScroller", "conversationsList", "tempChatButton", "newChatButton"])
    }),
    Object.freeze({
      id: "conversation",
      label: "Conversation Turns",
      required: false,
      keys: Object.freeze(["userQuery", "modelResponse", "chatHistory"])
    }),
    Object.freeze({
      id: "toolbar",
      label: "Runtime Controls",
      required: false,
      keys: Object.freeze(["stopButton", "nativeSearchButtons"])
    })
  ]);

  function isPlainObject(val) {
    return Boolean(val) && typeof val === "object" && !Array.isArray(val);
  }

  function hasForbiddenKeyRecursive(val, depth = 0, seen = new WeakSet()) {
    if (!val || typeof val !== "object" || depth > 24) return false;
    if (seen.has(val)) return false;
    seen.add(val);
    if (Array.isArray(val)) {
      for (const item of val) {
        if (hasForbiddenKeyRecursive(item, depth + 1, seen)) return true;
      }
      return false;
    }
    const keys = Object.getOwnPropertyNames(val);
    for (const k of keys) {
      if (FORBIDDEN_KEYS.has(k)) return true;
      if (hasForbiddenKeyRecursive(val[k], depth + 1, seen)) return true;
    }
    return false;
  }

  function sanitizeDeepClone(val, depth = 0, seen = new WeakSet()) {
    if (val === null || typeof val === "boolean" || typeof val === "string") return val;
    if (typeof val === "number") return Number.isFinite(val) ? val : null;
    if (!val || typeof val !== "object" || depth > 24) return undefined;
    if (seen.has(val)) return undefined;
    seen.add(val);
    if (Array.isArray(val)) {
      const arr = [];
      for (const item of val) {
        const cloned = sanitizeDeepClone(item, depth + 1, seen);
        if (cloned !== undefined) arr.push(cloned);
      }
      return arr;
    }
    const out = {};
    for (const k of Object.keys(val)) {
      if (FORBIDDEN_KEYS.has(k)) continue;
      const cloned = sanitizeDeepClone(val[k], depth + 1, seen);
      if (cloned !== undefined) out[k] = cloned;
    }
    return out;
  }

  function normalizeShortcutValue(val) {
    if (!isPlainObject(val)) return null;
    if (typeof val.key !== "string") return null;
    const key = val.key.trim().toLowerCase();
    if (!key || key.length > 24) return null;
    const mods = ["alt", "ctrl", "shift", "meta"];
    for (const m of mods) {
      if (val[m] !== undefined && typeof val[m] !== "boolean") return null;
    }
    return {
      key,
      alt: Boolean(val.alt),
      ctrl: Boolean(val.ctrl),
      shift: Boolean(val.shift),
      meta: Boolean(val.meta)
    };
  }

  function validateSyncEntry(key, val) {
    const kind = SYNC_BACKUP_KEY_TYPES[key];
    if (!kind) return { ok: false, unknown: true };
    if (kind === "boolean") {
      return typeof val === "boolean" ? { ok: true, value: val } : { ok: false, error: `sync.${key} must be a boolean` };
    }
    if (kind === "string_short") {
      return typeof val === "string" && val.length <= 128
        ? { ok: true, value: val }
        : { ok: false, error: `sync.${key} must be a string (<= 128 chars)` };
    }
    if (kind === "string_long") {
      return typeof val === "string" && val.length <= 32000
        ? { ok: true, value: val }
        : { ok: false, error: `sync.${key} must be a string (<= 32000 chars)` };
    }
    if (kind === "shortcut") {
      const sc = normalizeShortcutValue(val);
      return sc ? { ok: true, value: sc } : { ok: false, error: `sync.${key} must be a valid shortcut object` };
    }
    return { ok: false, unknown: true };
  }

  function validateLocalEntry(key, val) {
    const kind = LOCAL_BACKUP_KEY_TYPES[key];
    if (!kind) return { ok: false, unknown: true };
    if (kind === "boolean") {
      return typeof val === "boolean" ? { ok: true, value: val } : { ok: false, error: `local.${key} must be a boolean` };
    }
    if (kind === "folders") {
      if (!isPlainObject(val)) return { ok: false, error: `local.${key} must be an object` };
      if (val.folders !== undefined && !Array.isArray(val.folders)) return { ok: false, error: `local.${key}.folders must be an array` };
      return { ok: true, value: sanitizeDeepClone(val) };
    }
    if (kind === "prompts") {
      if (!isPlainObject(val)) return { ok: false, error: `local.${key} must be an object` };
      if (val.prompts !== undefined && !Array.isArray(val.prompts)) return { ok: false, error: `local.${key}.prompts must be an array` };
      return { ok: true, value: sanitizeDeepClone(val) };
    }
    if (kind === "chains") {
      if (!isPlainObject(val)) return { ok: false, error: `local.${key} must be an object` };
      if (val.chains !== undefined && !Array.isArray(val.chains)) return { ok: false, error: `local.${key}.chains must be an array` };
      return { ok: true, value: sanitizeDeepClone(val) };
    }
    if (kind === "string_map") {
      if (!isPlainObject(val)) return { ok: false, error: `local.${key} must be an object` };
      const cleaned = {};
      for (const subKey of Object.keys(val)) {
        if (FORBIDDEN_KEYS.has(subKey)) continue;
        if (typeof val[subKey] !== "string") {
          return { ok: false, error: `local.${key}.${subKey} must be a string` };
        }
        cleaned[subKey] = val[subKey];
      }
      return { ok: true, value: cleaned };
    }
    if (kind === "object") {
      if (!isPlainObject(val)) return { ok: false, error: `local.${key} must be an object` };
      return { ok: true, value: sanitizeDeepClone(val) };
    }
    return { ok: false, unknown: true };
  }

  function countBookmarksMap(raw) {
    if (!isPlainObject(raw)) return 0;
    const chatMap = isPlainObject(raw.chats) ? raw.chats : raw;
    let total = 0;
    for (const [k, v] of Object.entries(chatMap)) {
      if (k === "version" || k === "deleted") continue;
      if (Array.isArray(v)) total += v.length;
    }
    return total;
  }

  function computeBackupCounts(syncMap = {}, localMap = {}) {
    let shortcutCount = 0;
    let settingCount = 0;
    for (const k of Object.keys(syncMap)) {
      if (SYNC_BACKUP_KEY_TYPES[k] === "shortcut") shortcutCount++;
      else settingCount++;
    }
    const folders = Array.isArray(localMap.gpsFolders?.folders) ? localMap.gpsFolders.folders.length : 0;
    const prompts = Array.isArray(localMap.gpsPrompts?.prompts) ? localMap.gpsPrompts.prompts.length : 0;
    const chains = Array.isArray(localMap.gpsChains?.chains) ? localMap.gpsChains.chains.length : 0;
    const bookmarks = countBookmarksMap(localMap.sgBookmarks);
    const chatNotes = isPlainObject(localMap.sg_chat_notes) ? Object.keys(localMap.sg_chat_notes).length : 0;
    const customSkills = isPlainObject(localMap.sgSkillsLocal?.customSkills)
      ? Object.keys(localMap.sgSkillsLocal.customSkills).length
      : 0;
    const customBaselines = isPlainObject(localMap.sgBaselineLocal?.customInstructions)
      ? Object.keys(localMap.sgBaselineLocal.customInstructions).length
      : 0;

    return {
      syncSettings: settingCount,
      shortcuts: shortcutCount,
      folders,
      prompts,
      chains,
      bookmarks,
      chatNotes,
      customSkills,
      customBaselines
    };
  }

  function summarizeModelRoutingForBackup(modelRoutingConfig) {
    if (!isPlainObject(modelRoutingConfig) || !isPlainObject(modelRoutingConfig.tasks)) return null;
    const optLevels = {};
    if (isPlainObject(modelRoutingConfig.tasks.optimize?.levels)) {
      for (const [k, v] of Object.entries(modelRoutingConfig.tasks.optimize.levels)) {
        if (FORBIDDEN_KEYS.has(k) || !isPlainObject(v)) continue;
        optLevels[k] = `${v.model || "hydrogen"} / ${v.thinkingLevel || "low"}`;
      }
    }
    const grammarCfg = modelRoutingConfig.tasks.grammar;
    const orchPlanner = modelRoutingConfig.tasks.orchestrate?.planner?.clean1Turn;
    return {
      schemaVersion: modelRoutingConfig.schemaVersion || 1,
      optimize: optLevels,
      grammar: isPlainObject(grammarCfg) ? `${grammarCfg.model || "hydrogen"} / ${grammarCfg.thinkingLevel || "low"}` : null,
      orchestratePlannerClean1Turn: isPlainObject(orchPlanner)
        ? `${orchPlanner.model || "neon"} (fallback: ${orchPlanner.fallbackModel || "hydrogen"}) / ${orchPlanner.thinkingLevel || "medium"}`
        : null
    };
  }

  function buildUnifiedBackupPayload({ syncData = {}, localData = {}, extensionVersion = "2.0.0", modelRoutingConfig = null, now = new Date() } = {}) {
    const cleanSync = {};
    if (isPlainObject(syncData)) {
      for (const k of Object.keys(syncData)) {
        if (FORBIDDEN_KEYS.has(k)) continue;
        const checked = validateSyncEntry(k, syncData[k]);
        if (checked.ok) cleanSync[k] = checked.value;
      }
    }

    const cleanLocal = {};
    if (isPlainObject(localData)) {
      for (const k of Object.keys(localData)) {
        if (FORBIDDEN_KEYS.has(k)) continue;
        const checked = validateLocalEntry(k, localData[k]);
        if (checked.ok) cleanLocal[k] = checked.value;
      }
    }

    const exportedDate = now instanceof Date ? now : new Date(now || Date.now());
    return {
      meta: {
        format: BACKUP_FORMAT,
        schemaVersion: BACKUP_SCHEMA_VERSION,
        extensionVersion: String(extensionVersion || "2.0.0"),
        exportedAt: exportedDate.toISOString()
      },
      counts: computeBackupCounts(cleanSync, cleanLocal),
      sync: cleanSync,
      local: cleanLocal,
      modelRoutingSummary: summarizeModelRoutingForBackup(modelRoutingConfig)
    };
  }

  function validateUnifiedBackupPayload(raw) {
    const errors = [];
    const warnings = [];
    const syncToWrite = {};
    const localToWrite = {};

    if (!isPlainObject(raw)) {
      return {
        valid: false,
        errors: ["Backup root must be a JSON object"],
        warnings,
        syncToWrite,
        localToWrite,
        summary: computeBackupCounts(),
        meta: null
      };
    }

    if (hasForbiddenKeyRecursive(raw)) {
      return {
        valid: false,
        errors: ["Backup payload contains forbidden prototype key"],
        warnings,
        syncToWrite,
        localToWrite,
        summary: computeBackupCounts(),
        meta: null
      };
    }

    const meta = raw.meta;
    if (!isPlainObject(meta)) {
      errors.push("Missing backup 'meta' header");
    } else {
      if (meta.format !== BACKUP_FORMAT) {
        errors.push(`Unsupported backup format '${String(meta.format || "")}' (expected '${BACKUP_FORMAT}')`);
      }
      if (!Number.isInteger(meta.schemaVersion) || meta.schemaVersion < 1 || meta.schemaVersion > BACKUP_SCHEMA_VERSION) {
        errors.push(`Unsupported schemaVersion '${String(meta.schemaVersion)}'`);
      }
    }

    if (raw.sync !== undefined) {
      if (!isPlainObject(raw.sync)) {
        errors.push("'sync' section must be an object");
      } else {
        for (const k of Object.keys(raw.sync)) {
          const res = validateSyncEntry(k, raw.sync[k]);
          if (res.ok) {
            syncToWrite[k] = res.value;
          } else if (res.unknown) {
            warnings.push(`Ignored unsupported sync key '${k}'`);
          } else {
            errors.push(res.error);
          }
        }
      }
    }

    if (raw.local !== undefined) {
      if (!isPlainObject(raw.local)) {
        errors.push("'local' section must be an object");
      } else {
        for (const k of Object.keys(raw.local)) {
          const res = validateLocalEntry(k, raw.local[k]);
          if (res.ok) {
            localToWrite[k] = res.value;
          } else if (res.unknown) {
            warnings.push(`Ignored unsupported local key '${k}'`);
          } else {
            errors.push(res.error);
          }
        }
      }
    }

    if (Object.keys(syncToWrite).length === 0 && Object.keys(localToWrite).length === 0) {
      errors.push("Backup contains no restorable settings or data");
    }

    const cleanMeta = isPlainObject(meta)
      ? {
          format: String(meta.format || ""),
          schemaVersion: Number(meta.schemaVersion) || 0,
          extensionVersion: typeof meta.extensionVersion === "string" ? meta.extensionVersion : "unknown",
          exportedAt: typeof meta.exportedAt === "string" ? meta.exportedAt : null
        }
      : null;

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      syncToWrite,
      localToWrite,
      summary: computeBackupCounts(syncToWrite, localToWrite),
      meta: cleanMeta
    };
  }

  function sanitizeTabUrl(rawUrl) {
    const str = String(rawUrl || "").trim();
    if (!str) return null;
    try {
      const parsed = new URL(str);
      if (parsed.origin !== "https://gemini.google.com") return "(non-gemini)";
      let cleanPath = parsed.pathname || "/";
      cleanPath = cleanPath
        .replace(/^(\/(?:u\/\d+\/)?app)\/[^/?#]+/i, "$1/<redacted>")
        .replace(/^(\/(?:u\/\d+\/)?gem)\/[^/?#]+/i, "$1/<redacted>")
        .replace(/^(\/(?:u\/\d+\/)?share)\/[^/?#]+/i, "$1/<redacted>");
      return `${parsed.origin}${cleanPath}`;
    } catch (_e) {
      return "(invalid-url)";
    }
  }

  function evaluateSelectorGroups(probeEntries = {}, runtimeHealth = {}) {
    const probeMap = isPlainObject(probeEntries) ? probeEntries : {};
    const rtMap = isPlainObject(runtimeHealth) ? runtimeHealth : {};
    const groups = [];
    let totalPrimary = 0;
    let totalFallback = 0;
    let totalMiss = 0;
    let requiredMiss = 0;
    let requiredFallback = 0;

    for (const grp of CRITICAL_SELECTOR_GROUPS) {
      let gPrimary = 0;
      let gFallback = 0;
      let gMiss = 0;
      const items = [];

      for (const key of grp.keys) {
        const entry = isPlainObject(probeMap[key]) ? probeMap[key] : null;
        const rtEntry = isPlainObject(rtMap[key]) ? rtMap[key] : null;
        const status = entry
          ? (entry.status === "primary" || entry.status === "fallback" ? entry.status : "miss")
          : "miss";
        if (status === "primary") {
          gPrimary++;
          totalPrimary++;
        } else if (status === "fallback") {
          gFallback++;
          totalFallback++;
          if (grp.required) requiredFallback++;
        } else {
          gMiss++;
          totalMiss++;
          if (grp.required) requiredMiss++;
        }
        items.push({
          key,
          status,
          matchedIndex: entry ? entry.matchedIndex : -1,
          matchedSelector: entry ? entry.matchedSelector : null,
          runtimeFallbackCount: entry?.runtimeFallbackCount || (rtEntry ? rtEntry.count || 0 : 0)
        });
      }

      let groupStatus = "ok";
      if (!grp.required && gPrimary === 0 && gFallback === 0 && gMiss > 0) {
        groupStatus = "idle";
      } else if (grp.required && gMiss > 0) {
        groupStatus = "miss";
      } else if (gFallback > 0) {
        groupStatus = "fallback";
      } else if (!grp.required && gMiss > 0) {
        groupStatus = "idle";
      }

      groups.push({
        id: grp.id,
        label: grp.label,
        required: grp.required,
        status: groupStatus,
        primaryCount: gPrimary,
        fallbackCount: gFallback,
        missCount: gMiss,
        items
      });
    }

    const runtimeFallbacks = [];
    for (const [key, info] of Object.entries(rtMap)) {
      if (isPlainObject(info) && info.count > 0) {
        runtimeFallbacks.push({
          key,
          status: info.status || "fallback",
          matchedIndex: Number.isFinite(Number(info.matchedIndex)) ? Number(info.matchedIndex) : -1,
          count: Number(info.count) || 0
        });
      }
    }

    let overallStatus = "healthy";
    if (requiredMiss > 0) overallStatus = "error";
    else if (requiredFallback > 0 || totalFallback > 0 || runtimeFallbacks.some(r => r.status === "miss")) overallStatus = "degraded";

    return {
      overallStatus,
      primaryCount: totalPrimary,
      fallbackCount: totalFallback,
      missCount: totalMiss,
      groups,
      runtimeFallbacks
    };
  }

  function buildDiagnosticsReport({
    extensionVersion = "2.0.0",
    swBootedAt = null,
    alarmsCount = 0,
    activeTab = null,
    contentDiag = null,
    workerStats = {},
    storageStats = {},
    modelRouting = null,
    modelFeasibility = null,
    now = new Date()
  } = {}) {
    const generatedAt = (now instanceof Date ? now : new Date(now || Date.now())).toISOString();
    const tabReachable = Boolean(contentDiag && contentDiag.ok);
    const sanitizedUrl = activeTab ? sanitizeTabUrl(activeTab.url) : null;

    const selectorsSummary = tabReachable
      ? evaluateSelectorGroups(contentDiag.selectorProbe, contentDiag.runtimeHealth)
      : {
          overallStatus: activeTab ? "error" : "no_gemini_tab",
          primaryCount: 0,
          fallbackCount: 0,
          missCount: 0,
          groups: [],
          runtimeFallbacks: []
        };

    const routingValid = Boolean(modelRouting && modelRouting.ok !== false && (!Array.isArray(modelRouting.errors) || modelRouting.errors.length === 0));
    let overallStatus = "healthy";
    if (!activeTab) {
      overallStatus = routingValid ? "no_gemini_tab" : "error";
    } else if (!tabReachable || selectorsSummary.overallStatus === "error" || !routingValid) {
      overallStatus = "error";
    } else if (selectorsSummary.overallStatus === "degraded" || (modelFeasibility && modelFeasibility.tasks && modelFeasibility.tasks.some(t => t.fallbackUsed))) {
      overallStatus = "degraded";
    }

    return {
      generatedAt,
      extensionVersion: String(extensionVersion || "2.0.0"),
      overallStatus,
      serviceWorker: {
        bootedAt: swBootedAt ? new Date(swBootedAt).toISOString() : null,
        uptimeSec: swBootedAt ? Math.max(0, Math.floor((Date.now() - swBootedAt) / 1000)) : null,
        alarmsCount: Number(alarmsCount) || 0,
        activeOrchPools: Number(workerStats.activeOrchPools) || 0,
        busyOrchPools: Number(workerStats.busyOrchPools) || 0,
        activeWorkerWindows: Number(workerStats.activeWorkerWindows) || 0,
        tempTabCounts: sanitizeDeepClone(workerStats.tempTabCounts || { opt: 0, orch: 0, scrape: 0, batch: 0, audit: 0 }),
        recentEvents: Array.isArray(workerStats.recentEvents) ? workerStats.recentEvents.slice(-10) : []
      },
      activeGeminiTab: activeTab
        ? {
            found: true,
            active: Boolean(activeTab.active),
            sanitizedUrl,
            contentScriptReachable: tabReachable,
            ui: tabReachable && isPlainObject(contentDiag.ui)
              ? {
                  extensionEnabled: contentDiag.ui.extensionEnabled !== false,
                  usageCounterMounted: Boolean(contentDiag.ui.usageCounterMounted),
                  orchestrateBtnMounted: Boolean(contentDiag.ui.orchestrateBtnMounted),
                  periodicPickerActive: Boolean(contentDiag.ui.periodicPickerActive),
                  hasMessages: Boolean(contentDiag.ui.hasMessages)
                }
              : null
          }
        : { found: false, active: false, sanitizedUrl: null, contentScriptReachable: false, ui: null },
      selectors: selectorsSummary,
      modelRouting: {
        valid: routingValid,
        source: modelRouting?.source || "unknown",
        errors: Array.isArray(modelRouting?.errors) ? modelRouting.errors.slice(0, 10) : [],
        warnings: Array.isArray(modelRouting?.warnings) ? modelRouting.warnings.slice(0, 10) : [],
        summary: summarizeModelRoutingForBackup(modelRouting?.config),
        feasibility: modelFeasibility ? sanitizeDeepClone(modelFeasibility) : null
      },
      storage: {
        syncBytesInUse: Number.isFinite(Number(storageStats.syncBytesInUse)) ? Number(storageStats.syncBytesInUse) : null,
        localBytesInUse: Number.isFinite(Number(storageStats.localBytesInUse)) ? Number(storageStats.localBytesInUse) : null,
        counts: sanitizeDeepClone(storageStats.counts || {})
      }
    };
  }

  function formatDiagnosticsText(report) {
    if (!isPlainObject(report)) return "";
    const lines = [
      `Gemini Power Suite Diagnostics (v${report.extensionVersion || "2.0.0"})`,
      `Generated : ${report.generatedAt || ""}`,
      `Overall   : ${String(report.overallStatus || "unknown").toUpperCase()}`,
      `Active Tab: ${report.activeGeminiTab?.found ? `${report.activeGeminiTab.sanitizedUrl} (CS=${report.activeGeminiTab.contentScriptReachable ? "OK" : "UNREACHABLE"})` : "No Gemini tab open"}`
    ];
    if (report.selectors?.groups?.length > 0) {
      lines.push("", "DOM Selector Groups:");
      for (const g of report.selectors.groups) {
        lines.push(`  - ${g.label}: ${String(g.status).toUpperCase()} (primary=${g.primaryCount}, fallback=${g.fallbackCount}, miss=${g.missCount})`);
      }
    }
    const sw = report.serviceWorker || {};
    lines.push(
      "",
      `Workers & Pools: orchPools=${sw.activeOrchPools || 0} (busy=${sw.busyOrchPools || 0}), alarms=${sw.alarmsCount || 0}, optTabs=${sw.tempTabCounts?.opt || 0}, orchTabs=${sw.tempTabCounts?.orch || 0}`
    );
    const mr = report.modelRouting || {};
    lines.push(`Model Routing: ${mr.valid ? "VALID" : "INVALID"} (source=${mr.source || "unknown"})`);
    if (mr.feasibility) {
      lines.push(`Model Probe  : current=${mr.feasibility.currentModel || "?"}, feasible=[${(mr.feasibility.feasibleModelNames || []).join(", ")}]`);
    }
    const st = report.storage || {};
    lines.push(
      `Storage Usage: sync=${st.syncBytesInUse !== null ? `${st.syncBytesInUse} B` : "n/a"}, local=${st.localBytesInUse !== null ? `${st.localBytesInUse} B` : "n/a"}`
    );
    if (Array.isArray(sw.recentEvents) && sw.recentEvents.length > 0) {
      lines.push("", "Recent Worker Events:");
      for (const ev of sw.recentEvents) {
        lines.push(`  - [${ev.level || "info"}] ${ev.scope || "sw"}:${ev.code || ""} ${ev.message || ""}`.trim());
      }
    }
    return lines.join("\n");
  }

  const api = {
    BACKUP_FORMAT,
    BACKUP_SCHEMA_VERSION,
    SYNC_BACKUP_KEY_TYPES,
    LOCAL_BACKUP_KEY_TYPES,
    CRITICAL_SELECTOR_GROUPS,
    hasForbiddenKeyRecursive,
    sanitizeDeepClone,
    computeBackupCounts,
    buildUnifiedBackupPayload,
    validateUnifiedBackupPayload,
    sanitizeTabUrl,
    evaluateSelectorGroups,
    buildDiagnosticsReport,
    formatDiagnosticsText
  };

  if (typeof module === "object" && module && module.exports) {
    module.exports = api;
  }
  if (root && typeof root === "object") {
    root.SGBackupDiagnostics = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : (typeof self !== "undefined" ? self : this));
