(function (root) {
  "use strict";

  const CONFIG_PATH = "config/model-routing.json";
  const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

  const DEFAULT_CONFIG = Object.freeze({
    schemaVersion: 1,
    defaultFallbackModel: "hydrogen",
    defaultThinkingLevel: "low",
    models: {
      hydrogen: {
        id: "hydrogen",
        symbol: "H",
        displayName: "Hydrogen",
        badgeLabel: "4 Hydrogen",
        legacyMode: "fast",
        heavy: false,
        aliases: ["h", "4 hydrogen", "gemini 4 hydrogen", "flash-lite", "flash lite", "fast", "gemini fast"],
        domPatterns: ["hydrogen", "trợ giúp hằng ngày", "everyday help", "everyday", "daily", "flash-lite", "flash lite", "gemini fast", "fast"],
        fallbackOrder: ["neon", "carbon"],
        thinkingLevels: ["minimal", "low", "medium", "high"]
      },
      neon: {
        id: "neon",
        symbol: "Ne",
        displayName: "Neon",
        badgeLabel: "4 Neon",
        legacyMode: "thinking",
        heavy: true,
        aliases: ["ne", "4 neon", "gemini 4 neon", "thinking", "gemini thinking"],
        domPatterns: ["neon", "phân tích sâu hơn", "deeper analysis", "deep analysis", "gemini thinking", "thinking"],
        fallbackOrder: ["hydrogen", "carbon"],
        thinkingLevels: ["low", "medium", "high", "extra"]
      },
      carbon: {
        id: "carbon",
        symbol: "C",
        displayName: "Carbon",
        badgeLabel: "4 Carbon",
        legacyMode: "pro",
        heavy: true,
        aliases: ["c", "4 carbon", "gemini 4 carbon", "pro", "gemini pro", "3.1 pro"],
        domPatterns: ["carbon", "lập trình và xử lý công việc phức tạp", "coding and complex", "most complex work", "complex work", "gemini pro", "pro"],
        fallbackOrder: ["neon", "hydrogen"],
        thinkingLevels: ["low", "medium", "high", "extra"]
      },
      argon: {
        id: "argon",
        symbol: "Ar",
        displayName: "Argon",
        badgeLabel: "4 Argon",
        legacyMode: "thinking",
        heavy: true,
        aliases: ["ar", "4 argon", "gemini 4 argon", "deep think"],
        domPatterns: ["argon", "code and analysis", "deep think"],
        fallbackOrder: ["neon", "hydrogen"],
        thinkingLevels: ["low", "medium", "high", "extra"]
      }
    },
    thinkingLevels: {
      minimal: {
        id: "minimal",
        label: "Minimal",
        aliases: ["min", "tối thiểu"],
        domPatterns: ["minimal", "tối thiểu"]
      },
      low: {
        id: "low",
        label: "Low",
        aliases: ["standard", "tiêu chuẩn", "thấp"],
        domPatterns: ["low", "thấp", "standard", "tiêu chuẩn"]
      },
      medium: {
        id: "medium",
        label: "Medium",
        aliases: ["med", "balanced", "trung bình", "vừa"],
        domPatterns: ["medium", "trung bình", "vừa", "balanced"]
      },
      high: {
        id: "high",
        label: "High",
        aliases: ["extended", "cao", "mở rộng"],
        domPatterns: ["high", "cao", "extended", "mở rộng"]
      },
      extra: {
        id: "extra",
        label: "Extra",
        aliases: ["max", "maximum", "ultra", "siêu", "rất cao", "tối đa"],
        domPatterns: ["extra", "rất cao", "max", "siêu", "tối đa"]
      }
    },
    tasks: {
      optimize: {
        defaultLevel: "lite",
        levels: {
          lite: {
            label: "Lite",
            model: "hydrogen",
            thinkingLevel: "low",
            aliases: ["flash-lite", "flash_lite", "fast"],
            timeoutMs: 60000
          },
          flash: {
            label: "Flash",
            model: "hydrogen",
            thinkingLevel: "high",
            aliases: ["thinking", "standard"],
            timeoutMs: 120000
          },
          pro: {
            label: "Pro",
            model: "neon",
            thinkingLevel: "low",
            aliases: ["deep", "heavy"],
            timeoutMs: 120000
          }
        }
      },
      grammar: {
        model: "hydrogen",
        thinkingLevel: "low",
        timeoutMs: 60000
      },
      checkpoint: {
        model: "hydrogen",
        thinkingLevel: "high",
        timeoutMs: 120000
      },
      orchestrate: {
        planner: {
          clean1Turn: {
            model: "neon",
            fallbackModel: "hydrogen",
            thinkingLevel: "medium",
            timeoutMs: 150000
          }
        },
        policies: {
          quota_saver: {
            label: "Quota Saver (4 H)",
            description: "Force Sub-Agents onto 4 Hydrogen · Low to preserve Pro & Ultra quota",
            model: "hydrogen",
            thinkingLevel: "low",
            timeoutMs: 90000
          },
          adaptive: {
            label: "Adaptive (H / Ne)",
            description: "Allow Planner to assign models per sub-agent task based on complexity",
            defaultModel: "hydrogen",
            defaultThinkingLevel: "low",
            plannerPromptModels: ["hydrogen", "neon"],
            allowedModels: ["hydrogen", "neon", "carbon"],
            plannerPromptThinkingLevels: ["low", "medium", "high"],
            allowedThinkingLevels: ["low", "medium", "high", "extra"],
            standardTimeoutMs: 90000,
            heavyTimeoutMs: 150000
          }
        }
      }
    },
    extractor: {
      menuButtonSelector: "[data-test-id=\"bard-mode-menu-button\"]",
      optionSelector: "[data-test-id^=\"bard-mode-option-\"]",
      thinkingTriggerSelector: "gem-menu-item[value=\"thinking_level\"]",
      autoPatterns: ["tự động", "automatic", "auto"],
      lockedTestIdSubstrings: ["upsell"],
      ignoreTitlePatterns: ["upgrade", "nâng cấp"]
    }
  });

  function isPlainObject(val) {
    return Boolean(val) && typeof val === "object" && !Array.isArray(val);
  }

  function sanitizeKey(key) {
    if (typeof key !== "string") return "";
    const trimmed = key.trim().toLowerCase();
    if (!trimmed || FORBIDDEN_KEYS.has(trimmed)) return "";
    return trimmed;
  }

  function hasRawForbiddenKey(obj) {
    if (!isPlainObject(obj)) return false;
    return Object.getOwnPropertyNames(obj).some(k => FORBIDDEN_KEYS.has(k));
  }

  function sanitizeStringArray(arr, fallback) {
    const src = Array.isArray(arr) ? arr : (Array.isArray(fallback) ? fallback : []);
    const out = [];
    const seen = new Set();
    for (const item of src) {
      if (typeof item !== "string") continue;
      const clean = item.trim();
      if (!clean) continue;
      const low = clean.toLowerCase();
      if (seen.has(low)) continue;
      seen.add(low);
      out.push(clean);
    }
    return out;
  }

  function cloneDefaultConfig() {
    return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  }

  function positiveTimeout(raw, fallback) {
    const n = Number(raw);
    return Number.isFinite(n) && n >= 1000 ? Math.round(n) : fallback;
  }

  function escapeRegExp(str) {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function matchesPatternToken(text, pat) {
    const lowPat = String(pat || "").toLowerCase().trim();
    if (!lowPat || !text) return false;
    if (lowPat === "pro") return /\bpro\b/.test(text);
    if (lowPat === "flash") return /\bflash\b(?!\s*-?\s*lite)/.test(text);
    return text.includes(lowPat);
  }

  function validateAndNormalizeConfig(raw) {
    const errors = [];
    const warnings = [];
    const def = cloneDefaultConfig();

    if (!isPlainObject(raw)) {
      errors.push("Root config must be a JSON object");
      return { valid: false, errors, warnings, config: def };
    }

    if (hasRawForbiddenKey(raw)) {
      errors.push("Root config contains forbidden prototype key");
    }

    const schemaVersion = Number.isFinite(Number(raw.schemaVersion)) && Number(raw.schemaVersion) > 0
      ? Number(raw.schemaVersion)
      : def.schemaVersion;

    // 1. Normalize models map
    const models = {};
    if (!isPlainObject(raw.models) || Object.keys(raw.models).length === 0) {
      errors.push("Missing or empty 'models' catalog");
      Object.assign(models, def.models);
    } else {
      if (hasRawForbiddenKey(raw.models)) {
        errors.push("'models' contains forbidden prototype key");
      }
      for (const rawKey of Object.keys(raw.models)) {
        const key = sanitizeKey(rawKey);
        if (!key) continue;
        const entry = raw.models[rawKey];
        if (!isPlainObject(entry)) {
          errors.push(`models.${key} must be an object`);
          continue;
        }
        if (hasRawForbiddenKey(entry)) {
          errors.push(`models.${key} contains forbidden prototype key`);
        }
        const defEntry = def.models[key] || {};
        const displayName = typeof entry.displayName === "string" && entry.displayName.trim()
          ? entry.displayName.trim()
          : (defEntry.displayName || key.charAt(0).toUpperCase() + key.slice(1));
        const badgeLabel = typeof entry.badgeLabel === "string" && entry.badgeLabel.trim()
          ? entry.badgeLabel.trim()
          : (defEntry.badgeLabel || `4 ${displayName}`);
        const domPatterns = sanitizeStringArray(entry.domPatterns, defEntry.domPatterns || [key]);
        if (domPatterns.length === 0) domPatterns.push(key);
        const aliases = sanitizeStringArray(entry.aliases, defEntry.aliases || [key]);
        const fallbackOrder = sanitizeStringArray(entry.fallbackOrder, defEntry.fallbackOrder || []).map(x => x.toLowerCase());
        const modelThinkLevels = sanitizeStringArray(entry.thinkingLevels, defEntry.thinkingLevels || ["low", "medium", "high"]).map(x => x.toLowerCase());

        models[key] = {
          id: key,
          symbol: typeof entry.symbol === "string" && entry.symbol.trim() ? entry.symbol.trim() : (defEntry.symbol || displayName.slice(0, 2)),
          displayName,
          badgeLabel,
          legacyMode: typeof entry.legacyMode === "string" && entry.legacyMode.trim() ? entry.legacyMode.trim().toLowerCase() : (defEntry.legacyMode || "fast"),
          heavy: typeof entry.heavy === "boolean" ? entry.heavy : Boolean(defEntry.heavy),
          aliases: aliases.map(a => a.toLowerCase()),
          domPatterns: domPatterns.map(p => p.toLowerCase()),
          fallbackOrder,
          thinkingLevels: modelThinkLevels
        };
      }
      if (Object.keys(models).length === 0) {
        errors.push("'models' produced zero valid entries");
        Object.assign(models, def.models);
      }
    }

    // 2. Normalize thinkingLevels map
    const thinkingLevels = {};
    if (!isPlainObject(raw.thinkingLevels) || Object.keys(raw.thinkingLevels).length === 0) {
      errors.push("Missing or empty 'thinkingLevels' catalog");
      Object.assign(thinkingLevels, def.thinkingLevels);
    } else {
      if (hasRawForbiddenKey(raw.thinkingLevels)) {
        errors.push("'thinkingLevels' contains forbidden prototype key");
      }
      for (const rawKey of Object.keys(raw.thinkingLevels)) {
        const key = sanitizeKey(rawKey);
        if (!key) continue;
        const entry = raw.thinkingLevels[rawKey];
        if (!isPlainObject(entry)) {
          errors.push(`thinkingLevels.${key} must be an object`);
          continue;
        }
        const defEntry = def.thinkingLevels[key] || {};
        const label = typeof entry.label === "string" && entry.label.trim()
          ? entry.label.trim()
          : (defEntry.label || key.charAt(0).toUpperCase() + key.slice(1));
        const domPatterns = sanitizeStringArray(entry.domPatterns, defEntry.domPatterns || [key]).map(p => p.toLowerCase());
        if (domPatterns.length === 0) domPatterns.push(key);
        const aliases = sanitizeStringArray(entry.aliases, defEntry.aliases || []).map(a => a.toLowerCase());

        thinkingLevels[key] = {
          id: key,
          label,
          aliases,
          domPatterns
        };
      }
      if (Object.keys(thinkingLevels).length === 0) {
        errors.push("'thinkingLevels' produced zero valid entries");
        Object.assign(thinkingLevels, def.thinkingLevels);
      }
    }

    const firstModelId = Object.keys(models)[0];
    const defaultFallbackModelRaw = sanitizeKey(raw.defaultFallbackModel || def.defaultFallbackModel);
    let defaultFallbackModel = defaultFallbackModelRaw;
    if (!defaultFallbackModel || !models[defaultFallbackModel]) {
      if (raw.defaultFallbackModel !== undefined) {
        errors.push(`defaultFallbackModel '${raw.defaultFallbackModel}' is not defined in models`);
      }
      defaultFallbackModel = models[def.defaultFallbackModel] ? def.defaultFallbackModel : firstModelId;
    }

    const firstThinkId = Object.keys(thinkingLevels)[0];
    const defaultThinkingLevelRaw = sanitizeKey(raw.defaultThinkingLevel || def.defaultThinkingLevel);
    let defaultThinkingLevel = defaultThinkingLevelRaw;
    if (!defaultThinkingLevel || !thinkingLevels[defaultThinkingLevel]) {
      if (raw.defaultThinkingLevel !== undefined) {
        errors.push(`defaultThinkingLevel '${raw.defaultThinkingLevel}' is not defined in thinkingLevels`);
      }
      defaultThinkingLevel = thinkingLevels[def.defaultThinkingLevel] ? def.defaultThinkingLevel : firstThinkId;
    }

    const validateRefPair = (pathLabel, obj, defObj) => {
      const mRaw = typeof obj?.model === "string" ? sanitizeKey(obj.model) : "";
      const tRaw = typeof obj?.thinkingLevel === "string" ? sanitizeKey(obj.thinkingLevel) : "";
      if (!mRaw || !models[mRaw]) {
        errors.push(`${pathLabel}.model '${obj?.model || ""}' is not defined in models`);
      }
      if (!tRaw || !thinkingLevels[tRaw]) {
        errors.push(`${pathLabel}.thinkingLevel '${obj?.thinkingLevel || ""}' is not defined in thinkingLevels`);
      }
      return {
        model: mRaw && models[mRaw] ? mRaw : (models[defObj.model] ? defObj.model : defaultFallbackModel),
        thinkingLevel: tRaw && thinkingLevels[tRaw] ? tRaw : (thinkingLevels[defObj.thinkingLevel] ? defObj.thinkingLevel : defaultThinkingLevel)
      };
    };

    // 3. Validate & normalize tasks
    const rawTasks = isPlainObject(raw.tasks) ? raw.tasks : {};
    if (!isPlainObject(raw.tasks)) {
      errors.push("Missing 'tasks' section");
    }

    // 3a. tasks.optimize
    const rawOpt = isPlainObject(rawTasks.optimize) ? rawTasks.optimize : null;
    const rawOptLevels = rawOpt && isPlainObject(rawOpt.levels) ? rawOpt.levels : null;
    if (!rawOpt || !rawOptLevels || Object.keys(rawOptLevels).length === 0) {
      errors.push("Missing 'tasks.optimize.levels'");
    }
    const optLevels = {};
    if (rawOptLevels && Object.keys(rawOptLevels).length > 0) {
      if (hasRawForbiddenKey(rawOptLevels)) {
        errors.push("'tasks.optimize.levels' contains forbidden prototype key");
      }
      for (const rawLv of Object.keys(rawOptLevels)) {
        const lvKey = sanitizeKey(rawLv);
        if (!lvKey) continue;
        const lvEntry = rawOptLevels[rawLv];
        if (!isPlainObject(lvEntry)) {
          errors.push(`tasks.optimize.levels.${lvKey} must be an object`);
          continue;
        }
        const defLv = def.tasks.optimize.levels[lvKey] || {
          label: lvKey.charAt(0).toUpperCase() + lvKey.slice(1),
          model: defaultFallbackModel,
          thinkingLevel: defaultThinkingLevel,
          aliases: [],
          timeoutMs: 60000
        };
        const pair = validateRefPair(`tasks.optimize.levels.${lvKey}`, lvEntry, defLv);
        optLevels[lvKey] = {
          id: lvKey,
          label: typeof lvEntry.label === "string" && lvEntry.label.trim() ? lvEntry.label.trim() : defLv.label,
          model: pair.model,
          thinkingLevel: pair.thinkingLevel,
          aliases: sanitizeStringArray(lvEntry.aliases, defLv.aliases).map(a => a.toLowerCase()),
          timeoutMs: positiveTimeout(lvEntry.timeoutMs, defLv.timeoutMs)
        };
      }
    }
    if (Object.keys(optLevels).length === 0) {
      for (const k of Object.keys(def.tasks.optimize.levels)) {
        optLevels[k] = Object.assign({ id: k }, def.tasks.optimize.levels[k]);
      }
    }
    const firstOptKey = Object.keys(optLevels)[0];
    const reqDefOptLv = sanitizeKey(rawOpt?.defaultLevel || def.tasks.optimize.defaultLevel);
    let defaultOptLevel = reqDefOptLv && optLevels[reqDefOptLv] ? reqDefOptLv : "";
    if (!defaultOptLevel) {
      if (rawOpt && rawOpt.defaultLevel !== undefined) {
        errors.push(`tasks.optimize.defaultLevel '${rawOpt.defaultLevel}' is not defined in tasks.optimize.levels`);
      }
      defaultOptLevel = optLevels[def.tasks.optimize.defaultLevel] ? def.tasks.optimize.defaultLevel : firstOptKey;
    }

    // 3b. tasks.grammar
    const rawGrammar = isPlainObject(rawTasks.grammar) ? rawTasks.grammar : null;
    if (!rawGrammar) {
      errors.push("Missing 'tasks.grammar'");
    }
    const grammarPair = rawGrammar
      ? validateRefPair("tasks.grammar", rawGrammar, def.tasks.grammar)
      : {
          model: models[def.tasks.grammar.model] ? def.tasks.grammar.model : defaultFallbackModel,
          thinkingLevel: thinkingLevels[def.tasks.grammar.thinkingLevel] ? def.tasks.grammar.thinkingLevel : defaultThinkingLevel
        };
    const grammarCfg = {
      model: grammarPair.model,
      thinkingLevel: grammarPair.thinkingLevel,
      timeoutMs: positiveTimeout(rawGrammar?.timeoutMs, def.tasks.grammar.timeoutMs)
    };

    // 3b-2. tasks.checkpoint (optional for backward compatibility; validated strictly if provided)
    const rawCheckpoint = isPlainObject(rawTasks.checkpoint) ? rawTasks.checkpoint : null;
    if (rawTasks.checkpoint !== undefined && !rawCheckpoint) {
      errors.push("'tasks.checkpoint' must be an object");
    }
    const checkpointPair = rawCheckpoint
      ? validateRefPair("tasks.checkpoint", rawCheckpoint, def.tasks.checkpoint)
      : {
          model: models[def.tasks.checkpoint.model] ? def.tasks.checkpoint.model : defaultFallbackModel,
          thinkingLevel: thinkingLevels[def.tasks.checkpoint.thinkingLevel] ? def.tasks.checkpoint.thinkingLevel : defaultThinkingLevel
        };
    const checkpointCfg = {
      model: checkpointPair.model,
      thinkingLevel: checkpointPair.thinkingLevel,
      timeoutMs: positiveTimeout(rawCheckpoint?.timeoutMs, def.tasks.checkpoint.timeoutMs)
    };

    // 3c. tasks.orchestrate
    const rawOrch = isPlainObject(rawTasks.orchestrate) ? rawTasks.orchestrate : null;
    if (!rawOrch) {
      errors.push("Missing 'tasks.orchestrate'");
    }
    const rawClean1Turn = rawOrch && isPlainObject(rawOrch.planner) && isPlainObject(rawOrch.planner.clean1Turn)
      ? rawOrch.planner.clean1Turn
      : null;
    if (!rawClean1Turn) {
      errors.push("Missing 'tasks.orchestrate.planner.clean1Turn'");
    }
    const defPlanner = def.tasks.orchestrate.planner.clean1Turn;
    const plannerPair = rawClean1Turn
      ? validateRefPair("tasks.orchestrate.planner.clean1Turn", rawClean1Turn, defPlanner)
      : {
          model: models[defPlanner.model] ? defPlanner.model : defaultFallbackModel,
          thinkingLevel: thinkingLevels[defPlanner.thinkingLevel] ? defPlanner.thinkingLevel : defaultThinkingLevel
        };
    const rawPlannerFb = sanitizeKey(rawClean1Turn?.fallbackModel || "");
    if (rawClean1Turn && rawClean1Turn.fallbackModel !== undefined && (!rawPlannerFb || !models[rawPlannerFb])) {
      errors.push(`tasks.orchestrate.planner.clean1Turn.fallbackModel '${rawClean1Turn.fallbackModel}' is not defined in models`);
    }
    const clean1TurnCfg = {
      model: plannerPair.model,
      fallbackModel: rawPlannerFb && models[rawPlannerFb]
        ? rawPlannerFb
        : (models[defPlanner.fallbackModel] ? defPlanner.fallbackModel : defaultFallbackModel),
      thinkingLevel: plannerPair.thinkingLevel,
      timeoutMs: positiveTimeout(rawClean1Turn?.timeoutMs, defPlanner.timeoutMs)
    };

    const rawPolicies = rawOrch && isPlainObject(rawOrch.policies) ? rawOrch.policies : null;
    if (!rawPolicies) {
      errors.push("Missing 'tasks.orchestrate.policies'");
    }
    const rawQuota = rawPolicies && isPlainObject(rawPolicies.quota_saver) ? rawPolicies.quota_saver : null;
    if (!rawQuota) {
      errors.push("Missing 'tasks.orchestrate.policies.quota_saver'");
    }
    const defQuota = def.tasks.orchestrate.policies.quota_saver;
    const quotaPair = rawQuota
      ? validateRefPair("tasks.orchestrate.policies.quota_saver", rawQuota, defQuota)
      : {
          model: models[defQuota.model] ? defQuota.model : defaultFallbackModel,
          thinkingLevel: thinkingLevels[defQuota.thinkingLevel] ? defQuota.thinkingLevel : defaultThinkingLevel
        };
    const quotaSaverCfg = {
      label: typeof rawQuota?.label === "string" && rawQuota.label.trim() ? rawQuota.label.trim() : defQuota.label,
      description: typeof rawQuota?.description === "string" && rawQuota.description.trim() ? rawQuota.description.trim() : defQuota.description,
      model: quotaPair.model,
      thinkingLevel: quotaPair.thinkingLevel,
      timeoutMs: positiveTimeout(rawQuota?.timeoutMs, defQuota.timeoutMs)
    };

    const rawAdaptive = rawPolicies && isPlainObject(rawPolicies.adaptive) ? rawPolicies.adaptive : null;
    if (!rawAdaptive) {
      errors.push("Missing 'tasks.orchestrate.policies.adaptive'");
    }
    const defAd = def.tasks.orchestrate.policies.adaptive;
    const rawAdDefModel = sanitizeKey(rawAdaptive?.defaultModel || "");
    const rawAdDefThink = sanitizeKey(rawAdaptive?.defaultThinkingLevel || "");
    if (rawAdaptive && (!rawAdDefModel || !models[rawAdDefModel])) {
      errors.push(`tasks.orchestrate.policies.adaptive.defaultModel '${rawAdaptive.defaultModel || ""}' is not defined in models`);
    }
    if (rawAdaptive && (!rawAdDefThink || !thinkingLevels[rawAdDefThink])) {
      errors.push(`tasks.orchestrate.policies.adaptive.defaultThinkingLevel '${rawAdaptive.defaultThinkingLevel || ""}' is not defined in thinkingLevels`);
    }
    const validateList = (list, lookup, fallbackList, fieldName) => {
      const cleaned = sanitizeStringArray(list, fallbackList).map(x => x.toLowerCase());
      const validItems = [];
      for (const item of cleaned) {
        if (!lookup[item]) {
          errors.push(`tasks.orchestrate.policies.adaptive.${fieldName} references unknown '${item}'`);
        } else {
          validItems.push(item);
        }
      }
      return validItems.length > 0 ? validItems : fallbackList.filter(x => Boolean(lookup[x]));
    };

    const adaptiveDefaultModel = rawAdDefModel && models[rawAdDefModel]
      ? rawAdDefModel
      : (models[defAd.defaultModel] ? defAd.defaultModel : defaultFallbackModel);
    const adaptiveDefaultThink = rawAdDefThink && thinkingLevels[rawAdDefThink]
      ? rawAdDefThink
      : (thinkingLevels[defAd.defaultThinkingLevel] ? defAd.defaultThinkingLevel : defaultThinkingLevel);
    const allowedModels = validateList(rawAdaptive?.allowedModels, models, defAd.allowedModels, "allowedModels");
    const plannerPromptModels = validateList(rawAdaptive?.plannerPromptModels, models, defAd.plannerPromptModels, "plannerPromptModels");
    const allowedThinkingLevels = validateList(rawAdaptive?.allowedThinkingLevels, thinkingLevels, defAd.allowedThinkingLevels, "allowedThinkingLevels");
    const plannerPromptThinkingLevels = validateList(rawAdaptive?.plannerPromptThinkingLevels, thinkingLevels, defAd.plannerPromptThinkingLevels, "plannerPromptThinkingLevels");

    const adaptiveCfg = {
      label: typeof rawAdaptive?.label === "string" && rawAdaptive.label.trim() ? rawAdaptive.label.trim() : defAd.label,
      description: typeof rawAdaptive?.description === "string" && rawAdaptive.description.trim() ? rawAdaptive.description.trim() : defAd.description,
      defaultModel: adaptiveDefaultModel,
      defaultThinkingLevel: adaptiveDefaultThink,
      plannerPromptModels,
      allowedModels,
      plannerPromptThinkingLevels,
      allowedThinkingLevels,
      standardTimeoutMs: positiveTimeout(rawAdaptive?.standardTimeoutMs, defAd.standardTimeoutMs),
      heavyTimeoutMs: positiveTimeout(rawAdaptive?.heavyTimeoutMs, defAd.heavyTimeoutMs)
    };

    // 4. Normalize extractor settings
    const rawExt = isPlainObject(raw.extractor) ? raw.extractor : {};
    if (!isPlainObject(raw.extractor)) {
      warnings.push("Missing optional 'extractor' config; using defaults");
    }
    const extractor = {
      menuButtonSelector: typeof rawExt.menuButtonSelector === "string" && rawExt.menuButtonSelector.trim()
        ? rawExt.menuButtonSelector.trim()
        : def.extractor.menuButtonSelector,
      optionSelector: typeof rawExt.optionSelector === "string" && rawExt.optionSelector.trim()
        ? rawExt.optionSelector.trim()
        : def.extractor.optionSelector,
      thinkingTriggerSelector: typeof rawExt.thinkingTriggerSelector === "string" && rawExt.thinkingTriggerSelector.trim()
        ? rawExt.thinkingTriggerSelector.trim()
        : def.extractor.thinkingTriggerSelector,
      autoPatterns: sanitizeStringArray(rawExt.autoPatterns, def.extractor.autoPatterns).map(p => p.toLowerCase()),
      lockedTestIdSubstrings: sanitizeStringArray(rawExt.lockedTestIdSubstrings, def.extractor.lockedTestIdSubstrings).map(p => p.toLowerCase()),
      ignoreTitlePatterns: sanitizeStringArray(rawExt.ignoreTitlePatterns, def.extractor.ignoreTitlePatterns).map(p => p.toLowerCase())
    };

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      config: {
        schemaVersion,
        defaultFallbackModel,
        defaultThinkingLevel,
        models,
        thinkingLevels,
        tasks: {
          optimize: {
            defaultLevel: defaultOptLevel,
            levels: optLevels
          },
          grammar: grammarCfg,
          checkpoint: checkpointCfg,
          orchestrate: {
            planner: {
              clean1Turn: clean1TurnCfg
            },
            policies: {
              quota_saver: quotaSaverCfg,
              adaptive: adaptiveCfg
            }
          }
        },
        extractor
      }
    };
  }

  let _cachedExtResult = null;
  let _inflightExtPromise = null;

  async function loadConfigFromExtension({ forceReload = false } = {}) {
    if (!forceReload && _cachedExtResult) {
      return _cachedExtResult;
    }
    if (!forceReload && _inflightExtPromise) {
      return _inflightExtPromise;
    }
    _inflightExtPromise = (async () => {
      try {
        if (typeof chrome !== "undefined" && chrome.runtime && typeof chrome.runtime.getURL === "function" && typeof fetch === "function") {
          const url = chrome.runtime.getURL(CONFIG_PATH);
          const resp = await fetch(url);
          if (!resp || !resp.ok) {
            const status = resp ? resp.status : "NO_RESPONSE";
            const res = {
              ok: false,
              source: "default",
              config: cloneDefaultConfig(),
              errors: [`Failed to fetch ${CONFIG_PATH} (HTTP ${status})`],
              warnings: []
            };
            _cachedExtResult = res;
            return res;
          }
          const rawJson = await resp.json();
          const checked = validateAndNormalizeConfig(rawJson);
          const res = {
            ok: checked.valid,
            source: "json",
            config: checked.config,
            errors: checked.errors,
            warnings: checked.warnings
          };
          _cachedExtResult = res;
          return res;
        }
      } catch (err) {
        const res = {
          ok: false,
          source: "default",
          config: cloneDefaultConfig(),
          errors: [String(err && err.message || err)],
          warnings: []
        };
        _cachedExtResult = res;
        return res;
      }
      const fallbackRes = {
        ok: true,
        source: "default",
        config: cloneDefaultConfig(),
        errors: [],
        warnings: []
      };
      _cachedExtResult = fallbackRes;
      return fallbackRes;
    })();
    try {
      return await _inflightExtPromise;
    } finally {
      _inflightExtPromise = null;
    }
  }

  function loadConfigFromNode(filePath) {
    if (typeof require !== "function") {
      return {
        ok: false,
        filePath: filePath || CONFIG_PATH,
        config: cloneDefaultConfig(),
        errors: ["loadConfigFromNode is only available in Node.js"],
        warnings: []
      };
    }
    const fs = require("fs");
    const path = require("path");
    const targetPath = filePath || path.join(__dirname, "..", CONFIG_PATH);
    try {
      const text = fs.readFileSync(targetPath, "utf8");
      const rawJson = JSON.parse(text);
      const checked = validateAndNormalizeConfig(rawJson);
      return {
        ok: checked.valid,
        filePath: targetPath,
        config: checked.config,
        errors: checked.errors,
        warnings: checked.warnings
      };
    } catch (err) {
      return {
        ok: false,
        filePath: targetPath,
        config: cloneDefaultConfig(),
        errors: [String(err && err.message || err)],
        warnings: []
      };
    }
  }

  function clearCachedExtensionConfig() {
    _cachedExtResult = null;
    _inflightExtPromise = null;
  }

  function normalizeModelId(raw, config = DEFAULT_CONFIG) {
    const cfg = config && config.models ? config : DEFAULT_CONFIG;
    const str = String(raw || "").trim().toLowerCase().replace(/\s+/g, " ");
    if (!str) return null;
    const modelEntries = Object.values(cfg.models);

    // 1. Exact ID -> displayName / symbol / badgeLabel -> aliases -> domPatterns across all entries
    for (const m of modelEntries) {
      if (str === m.id) return m.id;
    }
    for (const m of modelEntries) {
      if (m.symbol && str === m.symbol.toLowerCase()) return m.id;
      if (m.displayName && str === m.displayName.toLowerCase()) return m.id;
      if (m.badgeLabel && str === m.badgeLabel.toLowerCase()) return m.id;
    }
    for (const m of modelEntries) {
      if (Array.isArray(m.aliases) && m.aliases.some(a => a.toLowerCase() === str)) return m.id;
    }
    for (const m of modelEntries) {
      if (Array.isArray(m.domPatterns) && m.domPatterns.some(p => p.toLowerCase() === str)) return m.id;
    }

    // 2. Word-boundary search across canonical IDs and multi-char aliases (longest first)
    const tokenPairs = [];
    for (const m of modelEntries) {
      tokenPairs.push({ id: m.id, tok: m.id, weight: m.id.length });
      if (m.badgeLabel) tokenPairs.push({ id: m.id, tok: m.badgeLabel.toLowerCase(), weight: m.badgeLabel.length });
      if (m.displayName) tokenPairs.push({ id: m.id, tok: m.displayName.toLowerCase(), weight: m.displayName.length });
      for (const a of (m.aliases || [])) {
        const lowA = String(a).toLowerCase();
        if (lowA.length >= 2 && (!m.symbol || lowA !== m.symbol.toLowerCase())) {
          tokenPairs.push({ id: m.id, tok: lowA, weight: lowA.length });
        }
      }
    }
    tokenPairs.sort((a, b) => b.weight - a.weight);
    for (const { id, tok } of tokenPairs) {
      const re = new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(tok)}(?:$|[^a-z0-9])`, "i");
      if (re.test(str)) return id;
    }

    // 3. DOM pattern matching (longest first; respects 'pro' / 'flash' word boundaries)
    const patternPairs = [];
    for (const m of modelEntries) {
      for (const p of (m.domPatterns || [])) {
        const lowP = String(p).toLowerCase();
        patternPairs.push({ id: m.id, pat: lowP, weight: lowP.length });
      }
    }
    patternPairs.sort((a, b) => b.weight - a.weight);
    for (const { id, pat } of patternPairs) {
      if (matchesPatternToken(str, pat)) return id;
    }

    return null;
  }

  function normalizeThinkingLevel(raw, config = DEFAULT_CONFIG) {
    const cfg = config && config.thinkingLevels ? config : DEFAULT_CONFIG;
    const defLevel = cfg.defaultThinkingLevel || "low";
    const str = String(raw || "").trim().toLowerCase().replace(/\s+/g, " ");
    if (!str) return cfg.thinkingLevels[defLevel] ? defLevel : Object.keys(cfg.thinkingLevels)[0];

    const entries = Object.values(cfg.thinkingLevels);
    for (const t of entries) {
      if (str === t.id) return t.id;
    }
    for (const t of entries) {
      if (t.label && str === t.label.toLowerCase()) return t.id;
    }
    for (const t of entries) {
      if (Array.isArray(t.aliases) && t.aliases.some(a => a.toLowerCase() === str)) return t.id;
    }
    for (const t of entries) {
      if (Array.isArray(t.domPatterns) && t.domPatterns.some(p => p.toLowerCase() === str)) return t.id;
    }

    // Longest-token first prevents "rất cao" matching "cao" or "max" substring colliding
    const matchers = [];
    for (const t of entries) {
      matchers.push({ id: t.id, pat: t.id, len: t.id.length });
      for (const a of (t.aliases || [])) matchers.push({ id: t.id, pat: String(a).toLowerCase(), len: a.length });
      for (const p of (t.domPatterns || [])) matchers.push({ id: t.id, pat: String(p).toLowerCase(), len: p.length });
    }
    matchers.sort((a, b) => b.len - a.len);
    for (const { id, pat } of matchers) {
      if (!pat) continue;
      if (pat.length <= 3) {
        const re = new RegExp(`(?:^|[^a-z0-9\\u00c0-\\u1ef9])${escapeRegExp(pat)}(?:$|[^a-z0-9\\u00c0-\\u1ef9])`, "i");
        if (re.test(str)) return id;
      } else if (str.includes(pat)) {
        return id;
      }
    }

    return cfg.thinkingLevels[defLevel] ? defLevel : Object.keys(cfg.thinkingLevels)[0];
  }

  function normalizeOptimizeLevel(raw, config = DEFAULT_CONFIG) {
    const cfg = config && config.tasks && config.tasks.optimize ? config : DEFAULT_CONFIG;
    const optCfg = cfg.tasks.optimize;
    const levels = optCfg.levels || DEFAULT_CONFIG.tasks.optimize.levels;
    const defKey = levels[optCfg.defaultLevel] ? optCfg.defaultLevel : Object.keys(levels)[0];
    const str = String(raw || "").trim().toLowerCase();
    if (!str) return defKey;
    if (levels[str] && !FORBIDDEN_KEYS.has(str)) return str;
    for (const [lvKey, lvObj] of Object.entries(levels)) {
      if (lvObj.label && lvObj.label.toLowerCase() === str) return lvKey;
      if (Array.isArray(lvObj.aliases) && lvObj.aliases.some(a => a.toLowerCase() === str)) {
        return lvKey;
      }
    }
    return defKey;
  }

  function resolveFeasibleModel(requestedModelId, feasibleModels, config = DEFAULT_CONFIG) {
    const cfg = config && config.models ? config : DEFAULT_CONFIG;
    const reqNorm = normalizeModelId(requestedModelId, cfg) || cfg.defaultFallbackModel || "hydrogen";
    if (!Array.isArray(feasibleModels)) {
      return {
        requested: reqNorm,
        resolved: reqNorm,
        fallbackUsed: false,
        feasible: true
      };
    }

    const feasibleSet = new Set();
    for (const item of feasibleModels) {
      if (!item) continue;
      if (typeof item === "string") {
        const cid = normalizeModelId(item, cfg);
        feasibleSet.add(cid || item.trim().toLowerCase());
      } else if (typeof item === "object") {
        if (item.locked || item.isAuto || item.feasible === false) continue;
        const cid = item.canonicalId || normalizeModelId(item.exactName || item.name || item.id, cfg);
        if (cid) feasibleSet.add(cid);
      }
    }

    if (feasibleSet.size === 0) {
      return {
        requested: reqNorm,
        resolved: reqNorm,
        fallbackUsed: false,
        feasible: false
      };
    }

    if (feasibleSet.has(reqNorm)) {
      return {
        requested: reqNorm,
        resolved: reqNorm,
        fallbackUsed: false,
        feasible: true
      };
    }

    const reqEntry = cfg.models[reqNorm];
    const chain = [
      ...(Array.isArray(reqEntry?.fallbackOrder) ? reqEntry.fallbackOrder : []),
      cfg.defaultFallbackModel,
      ...Object.keys(cfg.models)
    ];
    for (const cand of chain) {
      if (cand && feasibleSet.has(cand)) {
        return {
          requested: reqNorm,
          resolved: cand,
          fallbackUsed: cand !== reqNorm,
          feasible: true
        };
      }
    }

    const firstFeasible = Array.from(feasibleSet)[0];
    return {
      requested: reqNorm,
      resolved: firstFeasible || reqNorm,
      fallbackUsed: Boolean(firstFeasible && firstFeasible !== reqNorm),
      feasible: Boolean(firstFeasible)
    };
  }

  function buildSelectionPayload(modelId, thinkingLevel, config = DEFAULT_CONFIG) {
    const cfg = config && config.models ? config : DEFAULT_CONFIG;
    const resolvedModel = normalizeModelId(modelId, cfg) || cfg.defaultFallbackModel || "hydrogen";
    const resolvedThink = normalizeThinkingLevel(thinkingLevel, cfg);
    const modelEntry = cfg.models[resolvedModel] || cfg.models[cfg.defaultFallbackModel] || Object.values(cfg.models)[0];
    const thinkEntry = cfg.thinkingLevels[resolvedThink] || cfg.thinkingLevels[cfg.defaultThinkingLevel] || Object.values(cfg.thinkingLevels)[0];

    const fallbackIds = [];
    const seenFb = new Set([resolvedModel]);
    const pushFb = id => {
      if (!id || seenFb.has(id) || !cfg.models[id]) return;
      seenFb.add(id);
      fallbackIds.push(id);
    };
    for (const fb of (modelEntry.fallbackOrder || [])) pushFb(fb);
    pushFb(cfg.defaultFallbackModel);
    for (const id of Object.keys(cfg.models)) pushFb(id);

    const allThinkingTokensSet = new Set();
    for (const tObj of Object.values(cfg.thinkingLevels)) {
      allThinkingTokensSet.add(tObj.id);
      if (tObj.label) allThinkingTokensSet.add(tObj.label.toLowerCase());
      for (const a of (tObj.aliases || [])) allThinkingTokensSet.add(String(a).toLowerCase());
      for (const p of (tObj.domPatterns || [])) allThinkingTokensSet.add(String(p).toLowerCase());
    }

    const thinkingPatterns = Array.isArray(thinkEntry.domPatterns) ? thinkEntry.domPatterns.slice() : [resolvedThink];
    if (resolvedThink === "minimal" && cfg.thinkingLevels.low?.domPatterns) {
      for (const p of cfg.thinkingLevels.low.domPatterns) {
        if (!thinkingPatterns.includes(p)) thinkingPatterns.push(p);
      }
    } else if (resolvedThink === "extra" && cfg.thinkingLevels.high?.domPatterns) {
      for (const p of cfg.thinkingLevels.high.domPatterns) {
        if (!thinkingPatterns.includes(p)) thinkingPatterns.push(p);
      }
    }

    return {
      model: resolvedModel,
      thinkingLevel: resolvedThink,
      modelPatterns: Array.isArray(modelEntry.domPatterns) ? modelEntry.domPatterns.slice() : [resolvedModel],
      fallbackModels: fallbackIds.map(id => ({
        id,
        domPatterns: Array.isArray(cfg.models[id].domPatterns) ? cfg.models[id].domPatterns.slice() : [id]
      })),
      thinkingPatterns,
      allThinkingTokens: Array.from(allThinkingTokensSet),
      autoPatterns: Array.isArray(cfg.extractor?.autoPatterns) ? cfg.extractor.autoPatterns.slice() : ["tự động", "automatic", "auto"],
      lockedTestIdSubstrings: Array.isArray(cfg.extractor?.lockedTestIdSubstrings) ? cfg.extractor.lockedTestIdSubstrings.slice() : ["upsell"],
      enforceThinkingLevel: true
    };
  }

  function formatModelBadge(modelId, thinkingLevel, config = DEFAULT_CONFIG) {
    const cfg = config && config.models ? config : DEFAULT_CONFIG;
    const normModel = normalizeModelId(modelId, cfg) || cfg.defaultFallbackModel || "hydrogen";
    const normThink = normalizeThinkingLevel(thinkingLevel, cfg);
    const mObj = cfg.models[normModel];
    const tObj = cfg.thinkingLevels[normThink];
    const mLabel = mObj ? mObj.badgeLabel : `4 ${normModel}`;
    const tLabel = tObj ? tObj.label : (normThink.charAt(0).toUpperCase() + normThink.slice(1));
    return `${mLabel} · ${tLabel}`;
  }

  function clampThinkingForModel(thinkingId, modelId, config) {
    const mObj = config.models[modelId];
    if (!mObj || !Array.isArray(mObj.thinkingLevels) || mObj.thinkingLevels.length === 0) {
      return thinkingId;
    }
    if (mObj.thinkingLevels.includes(thinkingId)) return thinkingId;
    return mObj.thinkingLevels.includes(config.defaultThinkingLevel)
      ? config.defaultThinkingLevel
      : mObj.thinkingLevels[0];
  }

  function resolveOptimizeProfile(levelKey, config = DEFAULT_CONFIG, options = {}) {
    const cfg = config && config.tasks && config.tasks.optimize ? config : DEFAULT_CONFIG;
    const level = normalizeOptimizeLevel(levelKey, cfg);
    const entry = cfg.tasks.optimize.levels[level] || Object.values(cfg.tasks.optimize.levels)[0];
    const feasibleRes = resolveFeasibleModel(entry.model, options.feasibleModels, cfg);
    const resolvedModel = feasibleRes.resolved;
    const rawThink = options.overrideThinkingLevel || (feasibleRes.fallbackUsed ? clampThinkingForModel(entry.thinkingLevel, resolvedModel, cfg) : entry.thinkingLevel);
    const thinkingLevel = normalizeThinkingLevel(rawThink, cfg);

    return {
      task: "optimize",
      level,
      label: entry.label || level,
      model: resolvedModel,
      requestedModel: feasibleRes.requested,
      fallbackUsed: feasibleRes.fallbackUsed,
      thinkingLevel,
      timeoutMs: positiveTimeout(entry.timeoutMs, 60000),
      badgeLabel: formatModelBadge(resolvedModel, thinkingLevel, cfg),
      selectionPayload: buildSelectionPayload(resolvedModel, thinkingLevel, cfg)
    };
  }

  function resolveGrammarProfile(config = DEFAULT_CONFIG, options = {}) {
    const cfg = config && config.tasks && config.tasks.grammar ? config : DEFAULT_CONFIG;
    const entry = cfg.tasks.grammar;
    const feasibleRes = resolveFeasibleModel(entry.model, options.feasibleModels, cfg);
    const resolvedModel = feasibleRes.resolved;
    const thinkingLevel = normalizeThinkingLevel(entry.thinkingLevel, cfg);

    return {
      task: "grammar",
      model: resolvedModel,
      requestedModel: feasibleRes.requested,
      fallbackUsed: feasibleRes.fallbackUsed,
      thinkingLevel,
      timeoutMs: positiveTimeout(entry.timeoutMs, 60000),
      badgeLabel: formatModelBadge(resolvedModel, thinkingLevel, cfg),
      selectionPayload: buildSelectionPayload(resolvedModel, thinkingLevel, cfg)
    };
  }

  function resolveCheckpointProfile(config = DEFAULT_CONFIG, options = {}) {
    const cfg = config && config.tasks ? config : DEFAULT_CONFIG;
    const entry = cfg.tasks.checkpoint || DEFAULT_CONFIG.tasks.checkpoint;
    const feasibleRes = resolveFeasibleModel(entry.model, options.feasibleModels, cfg);
    const resolvedModel = feasibleRes.resolved;
    const rawThink = feasibleRes.fallbackUsed
      ? clampThinkingForModel(entry.thinkingLevel, resolvedModel, cfg)
      : entry.thinkingLevel;
    const thinkingLevel = normalizeThinkingLevel(rawThink, cfg);

    return {
      task: "checkpoint",
      model: resolvedModel,
      requestedModel: feasibleRes.requested,
      fallbackUsed: feasibleRes.fallbackUsed,
      thinkingLevel,
      timeoutMs: positiveTimeout(entry.timeoutMs, 120000),
      badgeLabel: formatModelBadge(resolvedModel, thinkingLevel, cfg),
      selectionPayload: buildSelectionPayload(resolvedModel, thinkingLevel, cfg)
    };
  }

  function resolveOrchestratePlannerProfile(config = DEFAULT_CONFIG, options = {}) {
    const cfg = config && config.tasks && config.tasks.orchestrate ? config : DEFAULT_CONFIG;
    const entry = cfg.tasks.orchestrate.planner.clean1Turn;
    let chosen = entry.model;
    let fallbackUsed = false;

    if (Array.isArray(options.feasibleModels)) {
      const primaryCheck = resolveFeasibleModel(entry.model, options.feasibleModels, cfg);
      if (!primaryCheck.fallbackUsed && primaryCheck.feasible) {
        chosen = primaryCheck.resolved;
      } else {
        const fbCheck = resolveFeasibleModel(entry.fallbackModel, options.feasibleModels, cfg);
        chosen = fbCheck.resolved;
        fallbackUsed = chosen !== entry.model;
      }
    }

    const thinkingLevel = normalizeThinkingLevel(entry.thinkingLevel, cfg);
    return {
      task: "orchestrate.planner.clean1Turn",
      model: chosen,
      requestedModel: entry.model,
      fallbackUsed,
      thinkingLevel,
      timeoutMs: positiveTimeout(entry.timeoutMs, 150000),
      badgeLabel: formatModelBadge(chosen, thinkingLevel, cfg),
      selectionPayload: buildSelectionPayload(chosen, thinkingLevel, cfg)
    };
  }

  function resolveOrchestrateSubAgentProfile(rawModel, rawThinking, policy = "quota_saver", config = DEFAULT_CONFIG, options = {}) {
    const cfg = config && config.tasks && config.tasks.orchestrate ? config : DEFAULT_CONFIG;
    const policies = cfg.tasks.orchestrate.policies;

    if (policy !== "adaptive") {
      const qs = policies.quota_saver;
      const feasibleRes = resolveFeasibleModel(qs.model, options.feasibleModels, cfg);
      const resolvedModel = feasibleRes.resolved;
      const thinkingLevel = normalizeThinkingLevel(qs.thinkingLevel, cfg);
      return {
        task: "orchestrate.subagent",
        policy: "quota_saver",
        model: resolvedModel,
        requestedModel: qs.model,
        fallbackUsed: feasibleRes.fallbackUsed,
        thinkingLevel,
        timeoutMs: positiveTimeout(qs.timeoutMs, 90000),
        badgeLabel: formatModelBadge(resolvedModel, thinkingLevel, cfg),
        selectionPayload: buildSelectionPayload(resolvedModel, thinkingLevel, cfg)
      };
    }

    const ad = policies.adaptive;
    const allowedModels = Array.isArray(ad.allowedModels) && ad.allowedModels.length > 0 ? ad.allowedModels : [ad.defaultModel];
    let normReq = normalizeModelId(rawModel, cfg) || ad.defaultModel;
    if (!allowedModels.includes(normReq)) {
      const fbMatch = (cfg.models[normReq]?.fallbackOrder || []).find(id => allowedModels.includes(id));
      normReq = fbMatch || ad.defaultModel;
    }

    let feasibleSubset = options.feasibleModels;
    if (Array.isArray(feasibleSubset)) {
      const filtered = feasibleSubset.filter(item => {
        const cid = typeof item === "string"
          ? normalizeModelId(item, cfg)
          : (item && !item.locked && !item.isAuto && item.feasible !== false ? (item.canonicalId || normalizeModelId(item.exactName || item.name || item.id, cfg)) : null);
        return cid && allowedModels.includes(cid);
      });
      if (filtered.length > 0) feasibleSubset = filtered;
    }

    const feasibleRes = resolveFeasibleModel(normReq, feasibleSubset, cfg);
    const resolvedModel = allowedModels.includes(feasibleRes.resolved) ? feasibleRes.resolved : ad.defaultModel;

    const allowedThinking = Array.isArray(ad.allowedThinkingLevels) && ad.allowedThinkingLevels.length > 0
      ? ad.allowedThinkingLevels
      : ["low", "medium", "high"];
    let normThink = normalizeThinkingLevel(rawThinking, cfg);
    if (!allowedThinking.includes(normThink)) {
      normThink = ad.defaultThinkingLevel;
    }

    const isHeavy = Boolean(cfg.models[resolvedModel]?.heavy);
    const timeoutMs = isHeavy
      ? positiveTimeout(ad.heavyTimeoutMs, 150000)
      : positiveTimeout(ad.standardTimeoutMs, 90000);

    return {
      task: "orchestrate.subagent",
      policy: "adaptive",
      model: resolvedModel,
      requestedModel: normReq,
      fallbackUsed: resolvedModel !== normReq || feasibleRes.fallbackUsed,
      thinkingLevel: normThink,
      timeoutMs,
      badgeLabel: formatModelBadge(resolvedModel, normThink, cfg),
      selectionPayload: buildSelectionPayload(resolvedModel, normThink, cfg)
    };
  }

  const api = {
    CONFIG_PATH,
    DEFAULT_CONFIG,
    cloneDefaultConfig,
    validateAndNormalizeConfig,
    loadConfigFromExtension,
    loadConfigFromNode,
    clearCachedExtensionConfig,
    normalizeModelId,
    normalizeThinkingLevel,
    normalizeOptimizeLevel,
    resolveFeasibleModel,
    resolveOptimizeProfile,
    resolveGrammarProfile,
    resolveCheckpointProfile,
    resolveOrchestratePlannerProfile,
    resolveOrchestrateSubAgentProfile,
    buildSelectionPayload,
    formatModelBadge
  };

  if (typeof module === "object" && module && module.exports) {
    module.exports = api;
  }
  if (root && typeof root === "object") {
    root.SGModelRouting = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : (typeof self !== "undefined" ? self : this));
