const SG_SKILLS_LOCAL_KEY = "sgSkillsLocal";
const SG_SKILLS_LEDGER_KEY = "sgSkillMigrationLedger";
const SG_SKILL_VALID_MODES = new Set(["inject", "bootstrap", "both"]);
const SG_SKILL_FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const SG_SKILL_SEND_BTN_SELECTOR = [
  'button[data-test-id="send-button"]',
  'button[data-testid="send_button"]',
  ".send-button-container button",
  ".send-button button",
  "button.send-button",
  'button:has(mat-icon[data-mat-icon-name="send"])',
  'button:has(mat-icon[fonticon="send"])',
  'button:has(mat-icon[fonticon="arrow_upward"])',
  'button[aria-label*="Send"]',
  'button[aria-label*="send"]'
].join(", ");

let isSkillsInjectionEnabled = false;
let sgBundledSkillsCache = null;
let sgSkillsLocalState = { overrides: {}, customSkills: {}, deletedIds: [] };
let sgSkillMigrationLedger = {};
let sgEffectiveSkills = [];
let sgDeletedBundledIds = [];
let _sgSkillBypassSend = false;
let _sgMigrationRunning = false;
let _sgMigrationAborted = false;
let sgSkillMenuElement = null;
let sgSkillMenuVisible = false;
let sgSkillMenuItems = [];
let sgSkillMenuIndex = 0;
let sgSkillMenuContext = null;
let sgSkillMenuDismissedToken = "";
let sgSkillAcRafPending = false;
let _sgSkillsModalState = { overlay: null, view: "list", editId: null, refresh: null };

const SG_BASELINE_LOCAL_KEY = "sgBaselineLocal";
const SG_BASELINE_PREFS_KEY = "sgBaselineAccountPrefs";
const SG_BASELINE_LEDGER_KEY = "sgBaselineMigrationLedger";
const SG_BASELINE_PENDING_JOB_KEY = "sgBaselineMigrationPendingJob";
const SG_BASELINE_JOB_TTL_MS = 5 * 60 * 1000;

let isBaselineInjectionEnabled = false;
let sgBundledBaselineCache = null;
let sgBaselineLocalState = { overrides: {}, customInstructions: {}, deletedIds: [] };
let sgBaselineAccountPrefs = {};
let sgBaselineMigrationLedger = {};
let sgEffectiveBaselines = [];
let sgDeletedBundledBaselineIds = [];
let _sgBaselineMigrationRunning = false;
let _sgBaselineMigrationAborted = false;
let _sgSavedInfoLastCheckedPath = "";

function sgNormalizeInstructionText(raw) {
  return String(raw || "").normalize("NFC").replace(/\s+/g, " ").trim();
}

function sgComputeBaselineHash(item) {
  const payload = JSON.stringify({
    title: String(item.title || ""),
    text: sgNormalizeInstructionText(item.text || "")
  });
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < payload.length; i++) {
    const c = payload.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 ^= (c + i) & 0xffff;
    h2 = Math.imul(h2, 0x85ebca6b) >>> 0;
  }
  return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}

function sgFilterSafeMap(raw) {
  const out = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw)) {
    if (SG_SKILL_FORBIDDEN_KEYS.has(k) || !v || typeof v !== "object" || Array.isArray(v)) continue;
    out[k] = v;
  }
  return out;
}

function sgNormalizeBaselineLocalStore(raw) {
  const base = { overrides: {}, customInstructions: {}, deletedIds: [] };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;
  base.overrides = sgFilterSafeMap(raw.overrides);
  base.customInstructions = sgFilterSafeMap(raw.customInstructions);
  if (Array.isArray(raw.deletedIds)) {
    base.deletedIds = [...new Set(raw.deletedIds.filter(id => typeof id === "string" && id.trim() && !SG_SKILL_FORBIDDEN_KEYS.has(id)))];
  }
  return base;
}

function sgFetchBundledBaseline(force = false) {
  if (sgBundledBaselineCache && !force) {
    return Promise.resolve(sgBundledBaselineCache);
  }
  return new Promise(resolve => {
    try {
      chrome.runtime.sendMessage({ type: "GET_BUNDLED_BASELINE" }, resp => {
        if (chrome.runtime.lastError || !resp || !resp.ok) {
          resolve(sgBundledBaselineCache || { bundleVersion: "1.0.0", instructions: [] });
          return;
        }
        sgBundledBaselineCache = {
          bundleVersion: String(resp.bundleVersion || "1.0.0"),
          instructions: Array.isArray(resp.instructions) ? resp.instructions : []
        };
        resolve(sgBundledBaselineCache);
      });
    } catch (err) {
      resolve(sgBundledBaselineCache || { bundleVersion: "1.0.0", instructions: [] });
    }
  });
}

function sgReadLocalBaselineStorage() {
  return new Promise(resolve => {
    try {
      chrome.storage.local.get([SG_BASELINE_LOCAL_KEY, SG_BASELINE_PREFS_KEY, SG_BASELINE_LEDGER_KEY], res => {
        resolve({
          local: sgNormalizeBaselineLocalStore(res && res[SG_BASELINE_LOCAL_KEY]),
          prefs: sgFilterSafeMap(res && res[SG_BASELINE_PREFS_KEY]),
          ledger: sgFilterSafeMap(res && res[SG_BASELINE_LEDGER_KEY])
        });
      });
    } catch (err) {
      resolve({ local: { overrides: {}, customInstructions: {}, deletedIds: [] }, prefs: {}, ledger: {} });
    }
  });
}

async function loadEffectiveBaselineInstructions(options = {}) {
  const bundled = await sgFetchBundledBaseline(Boolean(options.forceBundled));
  const { local, prefs, ledger } = await sgReadLocalBaselineStorage();
  sgBaselineLocalState = local;
  sgBaselineAccountPrefs = prefs;
  sgBaselineMigrationLedger = ledger;

  const deletedSet = new Set(local.deletedIds);
  const effective = [];
  const activeIds = new Set();
  const deletedBundled = [];

  for (const b of bundled.instructions) {
    if (!b || !b.id || SG_SKILL_FORBIDDEN_KEYS.has(b.id)) continue;
    if (deletedSet.has(b.id)) {
      deletedBundled.push(b.id);
      continue;
    }
    const ov = local.overrides[b.id];
    const isCustomized = Boolean(ov && ov.isCustomized === true);
    const merged = isCustomized
      ? {
          id: b.id,
          title: typeof ov.title === "string" && ov.title.trim() ? ov.title.trim() : b.title,
          text: typeof ov.text === "string" ? ov.text : b.text,
          enabled: typeof ov.enabled === "boolean" ? ov.enabled : (b.enabledByDefault !== false),
          version: Number.isFinite(Number(ov.version)) && Number(ov.version) > 0 ? Number(ov.version) : b.version,
          updatedAt: ov.updatedAt || null,
          origin: "customized",
          isBundled: true,
          isCustomized: true
        }
      : {
          id: b.id,
          title: b.title || b.id,
          text: b.text || "",
          enabled: ov && typeof ov.enabled === "boolean" ? ov.enabled : (b.enabledByDefault !== false),
          version: Number.isFinite(Number(b.version)) && Number(b.version) > 0 ? Number(b.version) : 1,
          updatedAt: null,
          origin: "bundled",
          isBundled: true,
          isCustomized: false
        };
    merged.hash = sgComputeBaselineHash(merged);
    effective.push(merged);
    activeIds.add(merged.id);
  }

  for (const [id, c] of Object.entries(local.customInstructions)) {
    if (!c || activeIds.has(id) || SG_SKILL_FORBIDDEN_KEYS.has(id)) continue;
    const customItem = {
      id,
      title: typeof c.title === "string" && c.title.trim() ? c.title.trim() : id,
      text: typeof c.text === "string" ? c.text : "",
      enabled: c.enabled !== false,
      version: Number.isFinite(Number(c.version)) && Number(c.version) > 0 ? Number(c.version) : 1,
      updatedAt: c.updatedAt || null,
      origin: "custom",
      isBundled: false,
      isCustomized: false
    };
    customItem.hash = sgComputeBaselineHash(customItem);
    effective.push(customItem);
    activeIds.add(id);
  }

  sgEffectiveBaselines = effective;
  sgDeletedBundledBaselineIds = deletedBundled;
  return {
    bundleVersion: bundled.bundleVersion,
    instructions: effective,
    deletedBundledIds: deletedBundled
  };
}

async function sgPersistBaselineLocal(nextLocal) {
  const normalized = sgNormalizeBaselineLocalStore(nextLocal);
  const ok = await safeLocalStorageSet({ [SG_BASELINE_LOCAL_KEY]: normalized });
  if (!ok) return false;
  sgBaselineLocalState = normalized;
  await loadEffectiveBaselineInstructions();
  return true;
}

async function saveBaselineOverride(id, patch) {
  if (!id || SG_SKILL_FORBIDDEN_KEYS.has(id)) throw new Error("Invalid baseline ID");
  await loadEffectiveBaselineInstructions();
  const bundled = (sgBundledBaselineCache?.instructions || []).find(item => item.id === id);
  const next = sgNormalizeBaselineLocalStore(sgBaselineLocalState);
  const now = new Date().toISOString();

  if (bundled) {
    const prev = next.overrides[id] || {};
    const prevVer = Number.isFinite(Number(prev.version)) ? Number(prev.version) : Number(bundled.version || 1);
    const nextTitle = typeof patch.title === "string" && patch.title.trim() ? patch.title.trim() : (prev.title || bundled.title);
    const nextText = typeof patch.text === "string" ? patch.text.trim() : (typeof prev.text === "string" ? prev.text : bundled.text);
    if (!nextText) throw new Error("Baseline instruction text cannot be empty.");
    const nextEnabled = typeof patch.enabled === "boolean" ? patch.enabled : (typeof prev.enabled === "boolean" ? prev.enabled : bundled.enabledByDefault !== false);

    next.overrides[id] = {
      title: nextTitle,
      text: nextText,
      enabled: nextEnabled,
      isCustomized: true,
      version: prevVer + 1,
      updatedAt: now
    };
    next.deletedIds = next.deletedIds.filter(d => d !== id);
  } else if (next.customInstructions[id]) {
    const prev = next.customInstructions[id];
    const nextText = typeof patch.text === "string" ? patch.text.trim() : (prev.text || "");
    if (!nextText) throw new Error("Baseline instruction text cannot be empty.");
    next.customInstructions[id] = {
      id,
      title: typeof patch.title === "string" && patch.title.trim() ? patch.title.trim() : prev.title,
      text: nextText,
      enabled: typeof patch.enabled === "boolean" ? patch.enabled : (prev.enabled !== false),
      version: (Number.isFinite(Number(prev.version)) ? Number(prev.version) : 1) + 1,
      updatedAt: now
    };
  } else {
    throw new Error(`Baseline instruction "${id}" not found`);
  }
  return sgPersistBaselineLocal(next);
}

async function toggleBaselineEnabled(id, enabled) {
  if (!id || SG_SKILL_FORBIDDEN_KEYS.has(id)) return false;
  await loadEffectiveBaselineInstructions();
  const bundled = (sgBundledBaselineCache?.instructions || []).find(item => item.id === id);
  const next = sgNormalizeBaselineLocalStore(sgBaselineLocalState);
  const now = new Date().toISOString();

  if (bundled) {
    const prev = next.overrides[id];
    if (prev && prev.isCustomized === true) {
      next.overrides[id] = { ...prev, enabled: Boolean(enabled), updatedAt: now };
    } else if (Boolean(enabled) === (bundled.enabledByDefault !== false)) {
      delete next.overrides[id];
    } else {
      next.overrides[id] = { enabled: Boolean(enabled), isCustomized: false, updatedAt: now };
    }
  } else if (next.customInstructions[id]) {
    next.customInstructions[id] = { ...next.customInstructions[id], enabled: Boolean(enabled), updatedAt: now };
  } else {
    return false;
  }
  return sgPersistBaselineLocal(next);
}

async function createCustomBaseline(data) {
  await loadEffectiveBaselineInstructions();
  const id = sgSanitizeSkillId(data.id || data.title);
  if (!id || SG_SKILL_FORBIDDEN_KEYS.has(id)) {
    throw new Error("Instruction ID must contain letters, numbers, dashes, or underscores.");
  }
  const bundledIds = new Set((sgBundledBaselineCache?.instructions || []).map(item => item.id));
  if (bundledIds.has(id) || sgBaselineLocalState.customInstructions[id]) {
    throw new Error(`Baseline ID "${id}" already exists.`);
  }
  const text = typeof data.text === "string" ? data.text.trim() : "";
  if (!text) {
    throw new Error("Baseline instruction text cannot be empty.");
  }
  const title = typeof data.title === "string" && data.title.trim() ? data.title.trim() : id;
  const next = sgNormalizeBaselineLocalStore(sgBaselineLocalState);
  next.customInstructions[id] = {
    id,
    title,
    text,
    enabled: data.enabled !== false,
    version: 1,
    updatedAt: new Date().toISOString()
  };
  const ok = await sgPersistBaselineLocal(next);
  if (!ok) throw new Error("Failed to save baseline instruction to local storage.");
  return id;
}

async function deleteLocalBaseline(id) {
  if (!id || SG_SKILL_FORBIDDEN_KEYS.has(id)) return false;
  await loadEffectiveBaselineInstructions();
  const bundled = (sgBundledBaselineCache?.instructions || []).find(item => item.id === id);
  const next = sgNormalizeBaselineLocalStore(sgBaselineLocalState);
  if (bundled) {
    delete next.overrides[id];
    if (!next.deletedIds.includes(id)) next.deletedIds.push(id);
  } else if (next.customInstructions[id]) {
    delete next.customInstructions[id];
  } else {
    return false;
  }
  return sgPersistBaselineLocal(next);
}

async function resetBaselineToBundled(id) {
  if (!id || SG_SKILL_FORBIDDEN_KEYS.has(id)) return false;
  await loadEffectiveBaselineInstructions();
  const next = sgNormalizeBaselineLocalStore(sgBaselineLocalState);
  delete next.overrides[id];
  next.deletedIds = next.deletedIds.filter(d => d !== id);
  return sgPersistBaselineLocal(next);
}

async function restoreDeletedBundledBaselines() {
  await loadEffectiveBaselineInstructions();
  const next = sgNormalizeBaselineLocalStore(sgBaselineLocalState);
  next.deletedIds = [];
  return sgPersistBaselineLocal(next);
}

function exportBaselineJson(triggerDownload = true) {
  const payload = {
    schemaVersion: 1,
    kind: "baseline-instructions",
    exportedAt: new Date().toISOString(),
    bundleVersion: sgBundledBaselineCache?.bundleVersion || "1.0.0",
    local: sgNormalizeBaselineLocalStore(sgBaselineLocalState),
    effectiveInstructions: sgEffectiveBaselines.map(item => ({
      id: item.id,
      title: item.title,
      text: item.text,
      enabled: item.enabled,
      version: item.version,
      origin: item.origin
    }))
  };
  const jsonText = JSON.stringify(payload, null, 2);
  if (triggerDownload) {
    const blob = new Blob([jsonText], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gemini-baseline-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return jsonText;
}

function sgValidateBaselineRecord(rec, fallbackId) {
  if (!rec || typeof rec !== "object" || Array.isArray(rec)) {
    throw new Error("Invalid baseline instruction object.");
  }
  const rawId = rec.id !== undefined ? rec.id : fallbackId;
  if (typeof rawId === "string" && SG_SKILL_FORBIDDEN_KEYS.has(rawId.trim())) {
    throw new Error("Invalid baseline instruction ID.");
  }
  const id = sgSanitizeSkillId(rawId);
  if (!id || SG_SKILL_FORBIDDEN_KEYS.has(id)) {
    throw new Error(`Invalid baseline instruction ID: "${String(rawId || "")}".`);
  }
  if (rec.title !== undefined && typeof rec.title !== "string") {
    throw new Error(`Baseline "${id}": title must be a string.`);
  }
  if (typeof rec.text !== "string" || !rec.text.trim()) {
    throw new Error(`Baseline "${id}": text must be a non-empty string.`);
  }
  if (rec.text.length > 50000) {
    throw new Error(`Baseline "${id}": text exceeds 50KB limit.`);
  }
  const version = rec.version !== undefined ? Number(rec.version) : 1;
  if (!Number.isFinite(version) || version < 1) {
    throw new Error(`Baseline "${id}": version must be a positive number.`);
  }
  return {
    id,
    title: typeof rec.title === "string" && rec.title.trim() ? rec.title.trim() : id,
    text: rec.text.trim(),
    enabled: rec.enabled !== false,
    version,
    isCustomized: rec.isCustomized === true,
    updatedAt: typeof rec.updatedAt === "string" ? rec.updatedAt : new Date().toISOString()
  };
}

async function importBaselineJson(rawText) {
  if (typeof rawText !== "string" || rawText.length > 2 * 1024 * 1024) {
    throw new Error("Import file is empty or exceeds 2MB limit.");
  }
  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch (err) {
    throw new Error("Invalid JSON syntax.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("JSON root must be an object.");
  }
  await loadEffectiveBaselineInstructions();
  const bundledIds = new Set((sgBundledBaselineCache?.instructions || []).map(item => item.id));
  const next = sgNormalizeBaselineLocalStore(sgBaselineLocalState);
  let importedCount = 0;

  if (parsed.local && typeof parsed.local === "object" && !Array.isArray(parsed.local)) {
    const src = parsed.local;
    if (src.overrides && typeof src.overrides === "object" && !Array.isArray(src.overrides)) {
      const entries = Object.entries(src.overrides);
      if (entries.length > 200) throw new Error("Too many overrides (max 200).");
      for (const [k, v] of entries) {
        if (SG_SKILL_FORBIDDEN_KEYS.has(k)) throw new Error("Invalid key in overrides.");
        if (v && typeof v === "object" && v.isCustomized === false && typeof v.enabled === "boolean") {
          next.overrides[k] = { enabled: v.enabled, isCustomized: false, updatedAt: new Date().toISOString() };
        } else {
          const clean = sgValidateBaselineRecord(v, k);
          next.overrides[clean.id] = {
            title: clean.title,
            text: clean.text,
            enabled: clean.enabled,
            isCustomized: true,
            version: clean.version,
            updatedAt: clean.updatedAt
          };
        }
        importedCount++;
      }
    }
    if (src.customInstructions && typeof src.customInstructions === "object" && !Array.isArray(src.customInstructions)) {
      const entries = Object.entries(src.customInstructions);
      if (entries.length > 200) throw new Error("Too many custom instructions (max 200).");
      for (const [k, v] of entries) {
        if (SG_SKILL_FORBIDDEN_KEYS.has(k)) throw new Error("Invalid key in customInstructions.");
        const clean = sgValidateBaselineRecord(v, k);
        if (bundledIds.has(clean.id)) {
          next.overrides[clean.id] = {
            title: clean.title,
            text: clean.text,
            enabled: clean.enabled,
            isCustomized: true,
            version: clean.version,
            updatedAt: clean.updatedAt
          };
        } else {
          next.customInstructions[clean.id] = clean;
        }
        importedCount++;
      }
    }
    if (Array.isArray(src.deletedIds)) {
      const validDeleted = src.deletedIds.filter(d => typeof d === "string" && !SG_SKILL_FORBIDDEN_KEYS.has(d) && d.trim());
      next.deletedIds = [...new Set([...next.deletedIds, ...validDeleted])];
    }
  } else if (Array.isArray(parsed.instructions)) {
    if (parsed.instructions.length > 200) throw new Error("Too many instructions (max 200).");
    for (const item of parsed.instructions) {
      const clean = sgValidateBaselineRecord(item);
      if (bundledIds.has(clean.id)) {
        next.overrides[clean.id] = {
          title: clean.title,
          text: clean.text,
          enabled: clean.enabled,
          isCustomized: true,
          version: clean.version,
          updatedAt: clean.updatedAt
        };
        next.deletedIds = next.deletedIds.filter(d => d !== clean.id);
      } else {
        next.customInstructions[clean.id] = clean;
      }
      importedCount++;
    }
  } else {
    throw new Error('JSON must contain either a "local" object or an "instructions" array.');
  }

  const ok = await sgPersistBaselineLocal(next);
  if (!ok) throw new Error("Storage quota exceeded while importing baseline instructions.");
  return { importedCount };
}

function sgIsBaselineInjectionEnabledForAccount(accountInfo) {
  if (!isBaselineInjectionEnabled) return false;
  const info = accountInfo || sgGetCurrentAccountInfo();
  const byKey = sgBaselineAccountPrefs[info.accountKey];
  if (byKey && typeof byKey.injectEnabled === "boolean") {
    return byKey.injectEnabled !== false;
  }
  const fallbackKey = `u_${info.index}`;
  const byIndex = sgBaselineAccountPrefs[fallbackKey];
  if (byIndex && typeof byIndex.injectEnabled === "boolean") {
    return byIndex.injectEnabled !== false;
  }
  return true;
}

async function setBaselineAccountInjectEnabled(accountKey, enabled) {
  if (!accountKey || SG_SKILL_FORBIDDEN_KEYS.has(accountKey)) return false;
  const { prefs } = await sgReadLocalBaselineStorage();
  const nextPrefs = {
    ...prefs,
    [accountKey]: { injectEnabled: Boolean(enabled), updatedAt: new Date().toISOString() }
  };
  const ok = await safeLocalStorageSet({ [SG_BASELINE_PREFS_KEY]: nextPrefs });
  if (ok) sgBaselineAccountPrefs = nextPrefs;
  return ok;
}

function sgSkillEl(tag, attrs, children) {
  const node = document.createElement(tag);
  if (attrs && typeof attrs === "object") {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null) continue;
      if (k === "className") node.className = v;
      else if (k === "textContent") node.textContent = String(v);
      else if (k === "value") node.value = String(v);
      else if (k === "checked") node.checked = Boolean(v);
      else if (k === "disabled") node.disabled = Boolean(v);
      else if (k === "style" && typeof v === "string") node.style.cssText = v;
      else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2).toLowerCase(), v);
      else node.setAttribute(k, String(v));
    }
  }
  if (Array.isArray(children)) {
    for (const child of children) {
      if (child === null || child === undefined || child === false) continue;
      node.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
    }
  } else if (children !== null && children !== undefined && children !== false) {
    node.appendChild(children instanceof Node ? children : document.createTextNode(String(children)));
  }
  return node;
}

function sgComputeSkillHash(skill) {
  const payload = JSON.stringify({
    name: String(skill.name || ""),
    description: String(skill.description || ""),
    content: String(skill.content || "")
  });
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < payload.length; i++) {
    const c = payload.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 ^= (c + i) & 0xffff;
    h2 = Math.imul(h2, 0x85ebca6b) >>> 0;
  }
  return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}

function sgNormalizeAliases(raw) {
  const arr = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? raw.split(/[\n,]+/)
      : [];
  const seen = new Set();
  const out = [];
  for (const item of arr) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(trimmed);
    }
  }
  return out;
}

function sgSanitizeSkillId(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function sgNormalizeLocalStore(raw) {
  const base = { overrides: {}, customSkills: {}, deletedIds: [] };
  if (!raw || typeof raw !== "object") return base;
  if (raw.overrides && typeof raw.overrides === "object" && !Array.isArray(raw.overrides)) {
    for (const [k, v] of Object.entries(raw.overrides)) {
      if (SG_SKILL_FORBIDDEN_KEYS.has(k) || !v || typeof v !== "object") continue;
      base.overrides[k] = v;
    }
  }
  if (raw.customSkills && typeof raw.customSkills === "object" && !Array.isArray(raw.customSkills)) {
    for (const [k, v] of Object.entries(raw.customSkills)) {
      if (SG_SKILL_FORBIDDEN_KEYS.has(k) || !v || typeof v !== "object") continue;
      base.customSkills[k] = v;
    }
  }
  if (Array.isArray(raw.deletedIds)) {
    base.deletedIds = [...new Set(raw.deletedIds.filter(id => typeof id === "string" && id.trim() && !SG_SKILL_FORBIDDEN_KEYS.has(id)))];
  }
  return base;
}

function sgFetchBundledSkills(force = false) {
  if (sgBundledSkillsCache && !force) {
    return Promise.resolve(sgBundledSkillsCache);
  }
  return new Promise(resolve => {
    try {
      chrome.runtime.sendMessage({ type: "GET_BUNDLED_SKILLS" }, resp => {
        if (chrome.runtime.lastError || !resp || !resp.ok) {
          resolve(sgBundledSkillsCache || { bundleVersion: "1.0.0", skills: [] });
          return;
        }
        sgBundledSkillsCache = {
          bundleVersion: String(resp.bundleVersion || "1.0.0"),
          skills: Array.isArray(resp.skills) ? resp.skills : []
        };
        resolve(sgBundledSkillsCache);
      });
    } catch (err) {
      resolve(sgBundledSkillsCache || { bundleVersion: "1.0.0", skills: [] });
    }
  });
}

function sgReadLocalSkillStorage() {
  return new Promise(resolve => {
    try {
      chrome.storage.local.get([SG_SKILLS_LOCAL_KEY, SG_SKILLS_LEDGER_KEY], res => {
        resolve({
          local: sgNormalizeLocalStore(res && res[SG_SKILLS_LOCAL_KEY]),
          ledger: res && res[SG_SKILLS_LEDGER_KEY] && typeof res[SG_SKILLS_LEDGER_KEY] === "object"
            ? res[SG_SKILLS_LEDGER_KEY]
            : {}
        });
      });
    } catch (err) {
      resolve({ local: { overrides: {}, customSkills: {}, deletedIds: [] }, ledger: {} });
    }
  });
}

async function loadEffectiveSkills(options = {}) {
  const bundled = await sgFetchBundledSkills(Boolean(options.forceBundled));
  const { local, ledger } = await sgReadLocalSkillStorage();
  sgSkillsLocalState = local;
  sgSkillMigrationLedger = ledger;

  const deletedSet = new Set(local.deletedIds);
  const effective = [];
  const activeIds = new Set();
  const deletedBundled = [];

  for (const b of bundled.skills) {
    if (!b || !b.id) continue;
    if (deletedSet.has(b.id)) {
      deletedBundled.push(b.id);
      continue;
    }
    const ov = local.overrides[b.id];
    const isCustomized = Boolean(ov && ov.isCustomized === true);
    const merged = isCustomized
      ? {
          id: b.id,
          name: typeof ov.name === "string" && ov.name.trim() ? ov.name.trim() : b.name,
          aliases: Array.isArray(ov.aliases) ? sgNormalizeAliases(ov.aliases) : sgNormalizeAliases(b.aliases),
          description: typeof ov.description === "string" ? ov.description : b.description,
          content: typeof ov.content === "string" ? ov.content : b.content,
          mode: SG_SKILL_VALID_MODES.has(ov.mode) ? ov.mode : b.mode,
          enabled: typeof ov.enabled === "boolean" ? ov.enabled : (b.enabledByDefault !== false),
          version: Number.isFinite(Number(ov.version)) && Number(ov.version) > 0 ? Number(ov.version) : b.version,
          updatedAt: ov.updatedAt || null,
          origin: "customized",
          isBundled: true,
          isCustomized: true,
          bundledFile: b.file || ""
        }
      : {
          id: b.id,
          name: b.name,
          aliases: sgNormalizeAliases(b.aliases),
          description: b.description || "",
          content: b.content || "",
          mode: SG_SKILL_VALID_MODES.has(b.mode) ? b.mode : "both",
          enabled: ov && typeof ov.enabled === "boolean" ? ov.enabled : (b.enabledByDefault !== false),
          version: Number.isFinite(Number(b.version)) && Number(b.version) > 0 ? Number(b.version) : 1,
          updatedAt: null,
          origin: "bundled",
          isBundled: true,
          isCustomized: false,
          bundledFile: b.file || ""
        };
    merged.hash = sgComputeSkillHash(merged);
    effective.push(merged);
    activeIds.add(merged.id);
  }

  for (const [id, c] of Object.entries(local.customSkills)) {
    if (!c || activeIds.has(id)) continue;
    const customSkill = {
      id,
      name: typeof c.name === "string" && c.name.trim() ? c.name.trim() : id,
      aliases: sgNormalizeAliases(c.aliases),
      description: typeof c.description === "string" ? c.description : "",
      content: typeof c.content === "string" ? c.content : "",
      mode: SG_SKILL_VALID_MODES.has(c.mode) ? c.mode : "both",
      enabled: c.enabled !== false,
      version: Number.isFinite(Number(c.version)) && Number(c.version) > 0 ? Number(c.version) : 1,
      updatedAt: c.updatedAt || null,
      origin: "custom",
      isBundled: false,
      isCustomized: false
    };
    customSkill.hash = sgComputeSkillHash(customSkill);
    effective.push(customSkill);
    activeIds.add(id);
  }

  sgEffectiveSkills = effective;
  sgDeletedBundledIds = deletedBundled;
  return {
    bundleVersion: bundled.bundleVersion,
    skills: effective,
    deletedBundledIds: deletedBundled
  };
}

async function sgPersistSkillsLocal(nextLocal) {
  const normalized = sgNormalizeLocalStore(nextLocal);
  const ok = await safeLocalStorageSet({ [SG_SKILLS_LOCAL_KEY]: normalized });
  if (!ok) return false;
  sgSkillsLocalState = normalized;
  await loadEffectiveSkills();
  return true;
}

async function saveSkillOverride(id, patch) {
  if (!id || SG_SKILL_FORBIDDEN_KEYS.has(id)) throw new Error("Invalid skill ID");
  await loadEffectiveSkills();
  const bundled = (sgBundledSkillsCache?.skills || []).find(s => s.id === id);
  const next = sgNormalizeLocalStore(sgSkillsLocalState);
  const now = new Date().toISOString();

  if (bundled) {
    const prev = next.overrides[id] || {};
    const prevVer = Number.isFinite(Number(prev.version)) ? Number(prev.version) : Number(bundled.version || 1);
    const nextContent = typeof patch.content === "string" ? patch.content : (typeof prev.content === "string" ? prev.content : bundled.content);
    const nextName = typeof patch.name === "string" && patch.name.trim() ? patch.name.trim() : (prev.name || bundled.name);
    const nextDesc = typeof patch.description === "string" ? patch.description : (typeof prev.description === "string" ? prev.description : bundled.description);
    const nextAliases = patch.aliases !== undefined ? sgNormalizeAliases(patch.aliases) : (Array.isArray(prev.aliases) ? prev.aliases : bundled.aliases);
    const nextMode = SG_SKILL_VALID_MODES.has(patch.mode) ? patch.mode : (SG_SKILL_VALID_MODES.has(prev.mode) ? prev.mode : bundled.mode);
    const nextEnabled = typeof patch.enabled === "boolean" ? patch.enabled : (typeof prev.enabled === "boolean" ? prev.enabled : bundled.enabledByDefault !== false);

    next.overrides[id] = {
      name: nextName,
      aliases: nextAliases,
      description: nextDesc,
      content: nextContent,
      mode: nextMode,
      enabled: nextEnabled,
      isCustomized: true,
      version: prevVer + 1,
      updatedAt: now
    };
    next.deletedIds = next.deletedIds.filter(d => d !== id);
  } else if (next.customSkills[id]) {
    const prev = next.customSkills[id];
    next.customSkills[id] = {
      id,
      name: typeof patch.name === "string" && patch.name.trim() ? patch.name.trim() : prev.name,
      aliases: patch.aliases !== undefined ? sgNormalizeAliases(patch.aliases) : sgNormalizeAliases(prev.aliases),
      description: typeof patch.description === "string" ? patch.description : (prev.description || ""),
      content: typeof patch.content === "string" ? patch.content : (prev.content || ""),
      mode: SG_SKILL_VALID_MODES.has(patch.mode) ? patch.mode : (prev.mode || "both"),
      enabled: typeof patch.enabled === "boolean" ? patch.enabled : (prev.enabled !== false),
      version: (Number.isFinite(Number(prev.version)) ? Number(prev.version) : 1) + 1,
      updatedAt: now
    };
  } else {
    throw new Error(`Skill "${id}" not found`);
  }
  return sgPersistSkillsLocal(next);
}

async function toggleSkillEnabled(id, enabled) {
  if (!id || SG_SKILL_FORBIDDEN_KEYS.has(id)) return false;
  await loadEffectiveSkills();
  const bundled = (sgBundledSkillsCache?.skills || []).find(s => s.id === id);
  const next = sgNormalizeLocalStore(sgSkillsLocalState);
  const now = new Date().toISOString();

  if (bundled) {
    const prev = next.overrides[id];
    if (prev && prev.isCustomized === true) {
      next.overrides[id] = { ...prev, enabled: Boolean(enabled), updatedAt: now };
    } else if (Boolean(enabled) === (bundled.enabledByDefault !== false)) {
      delete next.overrides[id];
    } else {
      next.overrides[id] = { enabled: Boolean(enabled), isCustomized: false, updatedAt: now };
    }
  } else if (next.customSkills[id]) {
    next.customSkills[id] = { ...next.customSkills[id], enabled: Boolean(enabled), updatedAt: now };
  } else {
    return false;
  }
  return sgPersistSkillsLocal(next);
}

async function createCustomSkill(data) {
  await loadEffectiveSkills();
  const id = sgSanitizeSkillId(data.id || data.name);
  if (!id || SG_SKILL_FORBIDDEN_KEYS.has(id)) {
    throw new Error("Skill ID must contain letters, numbers, dashes, or underscores.");
  }
  const bundledIds = new Set((sgBundledSkillsCache?.skills || []).map(s => s.id));
  if (bundledIds.has(id) || sgSkillsLocalState.customSkills[id]) {
    throw new Error(`Skill ID "${id}" already exists.`);
  }
  const name = typeof data.name === "string" && data.name.trim() ? data.name.trim() : id;
  const content = typeof data.content === "string" ? data.content : "";
  if (!content.trim()) {
    throw new Error("Skill Markdown instructions cannot be empty.");
  }
  const next = sgNormalizeLocalStore(sgSkillsLocalState);
  next.customSkills[id] = {
    id,
    name,
    aliases: sgNormalizeAliases(data.aliases),
    description: typeof data.description === "string" ? data.description.trim() : "",
    content,
    mode: SG_SKILL_VALID_MODES.has(data.mode) ? data.mode : "both",
    enabled: data.enabled !== false,
    version: 1,
    updatedAt: new Date().toISOString()
  };
  const ok = await sgPersistSkillsLocal(next);
  if (!ok) throw new Error("Failed to save skill to local storage.");
  return id;
}

async function deleteLocalSkill(id) {
  if (!id || SG_SKILL_FORBIDDEN_KEYS.has(id)) return false;
  await loadEffectiveSkills();
  const bundled = (sgBundledSkillsCache?.skills || []).find(s => s.id === id);
  const next = sgNormalizeLocalStore(sgSkillsLocalState);
  if (bundled) {
    delete next.overrides[id];
    if (!next.deletedIds.includes(id)) next.deletedIds.push(id);
  } else if (next.customSkills[id]) {
    delete next.customSkills[id];
  } else {
    return false;
  }
  return sgPersistSkillsLocal(next);
}

async function resetSkillToBundled(id) {
  if (!id || SG_SKILL_FORBIDDEN_KEYS.has(id)) return false;
  await loadEffectiveSkills();
  const next = sgNormalizeLocalStore(sgSkillsLocalState);
  delete next.overrides[id];
  next.deletedIds = next.deletedIds.filter(d => d !== id);
  return sgPersistSkillsLocal(next);
}

async function restoreDeletedBundledSkills() {
  await loadEffectiveSkills();
  const next = sgNormalizeLocalStore(sgSkillsLocalState);
  next.deletedIds = [];
  return sgPersistSkillsLocal(next);
}

function exportSkillsJson(triggerDownload = true) {
  const payload = {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    bundleVersion: sgBundledSkillsCache?.bundleVersion || "1.0.0",
    local: sgNormalizeLocalStore(sgSkillsLocalState),
    effectiveSkills: sgEffectiveSkills.map(s => ({
      id: s.id,
      name: s.name,
      aliases: s.aliases,
      description: s.description,
      content: s.content,
      mode: s.mode,
      enabled: s.enabled,
      version: s.version,
      origin: s.origin
    }))
  };
  const jsonText = JSON.stringify(payload, null, 2);
  if (triggerDownload) {
    const blob = new Blob([jsonText], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gemini-skills-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return jsonText;
}

function sgValidateSkillRecord(rec, fallbackId) {
  if (!rec || typeof rec !== "object" || Array.isArray(rec)) {
    throw new Error("Invalid skill object.");
  }
  const id = sgSanitizeSkillId(rec.id || fallbackId);
  if (!id || SG_SKILL_FORBIDDEN_KEYS.has(id)) {
    throw new Error(`Invalid skill ID: "${String(rec.id || fallbackId || "")}".`);
  }
  if (rec.name !== undefined && typeof rec.name !== "string") {
    throw new Error(`Skill "${id}": name must be a string.`);
  }
  if (rec.description !== undefined && typeof rec.description !== "string") {
    throw new Error(`Skill "${id}": description must be a string.`);
  }
  if (rec.content !== undefined && typeof rec.content !== "string") {
    throw new Error(`Skill "${id}": content must be a string.`);
  }
  if (typeof rec.content === "string" && rec.content.length > 200000) {
    throw new Error(`Skill "${id}": content exceeds 200KB limit.`);
  }
  if (rec.aliases !== undefined && !Array.isArray(rec.aliases)) {
    throw new Error(`Skill "${id}": aliases must be an array of strings.`);
  }
  if (Array.isArray(rec.aliases) && rec.aliases.some(a => typeof a !== "string")) {
    throw new Error(`Skill "${id}": every alias must be a string.`);
  }
  if (rec.mode !== undefined && !SG_SKILL_VALID_MODES.has(rec.mode)) {
    throw new Error(`Skill "${id}": invalid mode "${rec.mode}".`);
  }
  const version = rec.version !== undefined ? Number(rec.version) : 1;
  if (!Number.isFinite(version) || version < 1) {
    throw new Error(`Skill "${id}": version must be a positive number.`);
  }
  return {
    id,
    name: typeof rec.name === "string" && rec.name.trim() ? rec.name.trim() : id,
    aliases: sgNormalizeAliases(rec.aliases || []),
    description: typeof rec.description === "string" ? rec.description : "",
    content: typeof rec.content === "string" ? rec.content : "",
    mode: SG_SKILL_VALID_MODES.has(rec.mode) ? rec.mode : "both",
    enabled: rec.enabled !== false,
    version,
    isCustomized: rec.isCustomized === true,
    updatedAt: typeof rec.updatedAt === "string" ? rec.updatedAt : new Date().toISOString()
  };
}

async function importSkillsJson(rawText) {
  if (typeof rawText !== "string" || rawText.length > 4 * 1024 * 1024) {
    throw new Error("Import file is empty or exceeds 4MB limit.");
  }
  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch (err) {
    throw new Error("Invalid JSON syntax.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("JSON root must be an object.");
  }
  await loadEffectiveSkills();
  const bundledIds = new Set((sgBundledSkillsCache?.skills || []).map(s => s.id));
  const next = sgNormalizeLocalStore(sgSkillsLocalState);
  let importedCount = 0;

  if (parsed.local && typeof parsed.local === "object" && !Array.isArray(parsed.local)) {
    const src = parsed.local;
    if (src.overrides && typeof src.overrides === "object" && !Array.isArray(src.overrides)) {
      const entries = Object.entries(src.overrides);
      if (entries.length > 200) throw new Error("Too many overrides (max 200).");
      for (const [k, v] of entries) {
        if (SG_SKILL_FORBIDDEN_KEYS.has(k)) throw new Error("Invalid key in overrides.");
        if (v && typeof v === "object" && v.isCustomized === false && typeof v.enabled === "boolean") {
          next.overrides[k] = { enabled: v.enabled, isCustomized: false, updatedAt: new Date().toISOString() };
        } else {
          const clean = sgValidateSkillRecord(v, k);
          next.overrides[clean.id] = {
            name: clean.name,
            aliases: clean.aliases,
            description: clean.description,
            content: clean.content,
            mode: clean.mode,
            enabled: clean.enabled,
            isCustomized: true,
            version: clean.version,
            updatedAt: clean.updatedAt
          };
        }
        importedCount++;
      }
    }
    if (src.customSkills && typeof src.customSkills === "object" && !Array.isArray(src.customSkills)) {
      const entries = Object.entries(src.customSkills);
      if (entries.length > 200) throw new Error("Too many custom skills (max 200).");
      for (const [k, v] of entries) {
        if (SG_SKILL_FORBIDDEN_KEYS.has(k)) throw new Error("Invalid key in customSkills.");
        const clean = sgValidateSkillRecord(v, k);
        if (bundledIds.has(clean.id)) {
          next.overrides[clean.id] = { ...clean, isCustomized: true };
        } else {
          next.customSkills[clean.id] = clean;
        }
        importedCount++;
      }
    }
    if (Array.isArray(src.deletedIds)) {
      const validDeleted = src.deletedIds.filter(d => typeof d === "string" && !SG_SKILL_FORBIDDEN_KEYS.has(d) && d.trim());
      next.deletedIds = [...new Set([...next.deletedIds, ...validDeleted])];
    }
  } else if (Array.isArray(parsed.skills)) {
    if (parsed.skills.length > 200) throw new Error("Too many skills (max 200).");
    for (const item of parsed.skills) {
      const clean = sgValidateSkillRecord(item);
      if (bundledIds.has(clean.id)) {
        next.overrides[clean.id] = {
          name: clean.name,
          aliases: clean.aliases,
          description: clean.description,
          content: clean.content,
          mode: clean.mode,
          enabled: clean.enabled,
          isCustomized: true,
          version: clean.version,
          updatedAt: clean.updatedAt
        };
        next.deletedIds = next.deletedIds.filter(d => d !== clean.id);
      } else {
        next.customSkills[clean.id] = clean;
      }
      importedCount++;
    }
  } else {
    throw new Error('JSON must contain either a "local" object or a "skills" array.');
  }

  const ok = await sgPersistSkillsLocal(next);
  if (!ok) throw new Error("Storage quota exceeded while importing skills.");
  return { importedCount };
}

function sgIsValidTriggerLeftBoundary(text, idx, prevMatchEnd) {
  if (idx === 0 || idx === prevMatchEnd) return true;
  return /\s/.test(text[idx - 1]);
}

function sgIsValidTriggerRightBoundary(text, end, trigger) {
  if (end >= text.length) return true;
  const ch = text[end];
  if (/\s/.test(ch)) return true;
  if (trigger.endsWith("/") && ch === "/") return true;
  if (/[.,;:!?)]/.test(ch) && (end + 1 >= text.length || /\s/.test(text[end + 1]))) return true;
  return false;
}

function sgGetHandoffProtectedRanges(rawText) {
  if (typeof rawText !== "string" || !rawText) return [];
  const openTag = "[SG_HANDOFF_CONTEXT]";
  const closeTag = "[/SG_HANDOFF_CONTEXT]";
  const ranges = [];
  let cursor = 0;
  while (cursor < rawText.length) {
    const start = rawText.indexOf(openTag, cursor);
    if (start === -1) break;
    const endTag = rawText.indexOf(closeTag, start + openTag.length);
    if (endTag === -1) break;
    const end = endTag + closeTag.length;
    ranges.push({ start, end });
    cursor = end;
  }
  return ranges;
}

function sgResolveInvokedSkills(rawText, skills) {
  if (typeof rawText !== "string" || !rawText.trim() || !Array.isArray(skills) || !skills.length) {
    return { invokedSkills: [], cleanedQuery: rawText || "" };
  }
  const triggerEntries = [];
  const seenTrigger = new Set();
  for (const s of skills) {
    if (!s || !s.enabled || (s.mode !== "inject" && s.mode !== "both")) continue;
    const candidates = [...sgNormalizeAliases(s.aliases), `@${s.id}`];
    for (const trig of candidates) {
      const lower = trig.toLowerCase();
      if (!lower || seenTrigger.has(lower)) continue;
      seenTrigger.add(lower);
      triggerEntries.push({ trigger: trig, lower, len: trig.length, skill: s });
    }
  }
  if (!triggerEntries.length) {
    return { invokedSkills: [], cleanedQuery: rawText };
  }
  triggerEntries.sort((a, b) => b.len - a.len);

  const lowerText = rawText.toLowerCase();
  const protectedRanges = sgGetHandoffProtectedRanges(rawText);
  let rangeIdx = 0;
  const matches = [];
  let pos = 0;
  let lastMatchEnd = -1;

  while (pos < rawText.length) {
    while (rangeIdx < protectedRanges.length && protectedRanges[rangeIdx].end <= pos) {
      rangeIdx++;
    }
    if (rangeIdx < protectedRanges.length && pos >= protectedRanges[rangeIdx].start && pos < protectedRanges[rangeIdx].end) {
      pos = protectedRanges[rangeIdx].end;
      continue;
    }
    let matched = null;
    if (sgIsValidTriggerLeftBoundary(rawText, pos, lastMatchEnd)) {
      for (const entry of triggerEntries) {
        if (lowerText.startsWith(entry.lower, pos)) {
          const end = pos + entry.len;
          if (sgIsValidTriggerRightBoundary(rawText, end, entry.trigger)) {
            matched = { start: pos, end, skill: entry.skill };
            break;
          }
        }
      }
    }
    if (matched) {
      matches.push(matched);
      lastMatchEnd = matched.end;
      pos = matched.end;
    } else {
      pos++;
    }
  }

  if (!matches.length) {
    return { invokedSkills: [], cleanedQuery: rawText };
  }

  const invokedSkills = [];
  const seenSkillIds = new Set();
  for (const m of matches) {
    if (!seenSkillIds.has(m.skill.id)) {
      seenSkillIds.add(m.skill.id);
      invokedSkills.push(m.skill);
    }
  }

  let cleaned = "";
  let cursor = 0;
  for (const m of matches) {
    let sliceEnd = m.start;
    let nextCursor = m.end;
    const prevChunk = rawText.slice(cursor, sliceEnd);
    const hasLeadingSpace = prevChunk.length === 0 || /[ \t\n]$/.test(prevChunk);
    if (hasLeadingSpace && nextCursor < rawText.length && (rawText[nextCursor] === " " || rawText[nextCursor] === "\t")) {
      nextCursor++;
    }
    cleaned += prevChunk;
    cursor = nextCursor;
  }
  cleaned += rawText.slice(cursor);
  cleaned = cleaned.replace(/[ \t]{2,}/g, " ").replace(/^[ \t]+/, "").trimEnd();

  return { invokedSkills, cleanedQuery: cleaned };
}

function sgAssembleSkillPrompt(invokedSkills, cleanedQuery) {
  const blocks = invokedSkills.map(s => {
    const body = String(s.content || "").trim();
    return `<skill id="${s.id}" name="${s.name}">\n${body}\n</skill>`;
  });
  const header = `[ACTIVE SKILLS — FOLLOW THESE INSTRUCTIONS IN ORDER]\n\n${blocks.join("\n\n")}`;
  const query = String(cleanedQuery || "").trim();
  if (!query) return header;
  return `${header}\n\n[USER REQUEST]\n${query}`;
}

function sgIsFirstTurnOfNewChat() {
  return typeof isOnNewChatLanding === "function" &&
    isOnNewChatLanding() &&
    document.querySelectorAll("user-query, model-response").length === 0;
}

function sgGetActiveBaselinesForCurrentTurn(accountInfo) {
  if (!sgIsFirstTurnOfNewChat() || !sgIsBaselineInjectionEnabledForAccount(accountInfo)) {
    return [];
  }
  return sgEffectiveBaselines.filter(item => item && item.enabled && String(item.text || "").trim());
}

function sgAssemblePromptWithBaseline(baselineItems, invokedSkills, cleanedQuery) {
  const sections = [];
  if (Array.isArray(baselineItems) && baselineItems.length > 0) {
    const lines = baselineItems
      .map(item => String(item.text || "").trim())
      .filter(Boolean)
      .map(t => `- ${t}`);
    if (lines.length > 0) {
      sections.push(`[BASELINE INSTRUCTIONS]\n${lines.join("\n")}`);
    }
  }
  if (Array.isArray(invokedSkills) && invokedSkills.length > 0) {
    const blocks = invokedSkills.map(s => {
      const body = String(s.content || "").trim();
      return `<skill id="${s.id}" name="${s.name}">\n${body}\n</skill>`;
    });
    sections.push(`[ACTIVE SKILLS — FOLLOW THESE INSTRUCTIONS IN ORDER]\n\n${blocks.join("\n\n")}`);
  }
  const query = String(cleanedQuery || "").trim();
  if (query) {
    sections.push(`[USER REQUEST]\n${query}`);
  }
  return sections.join("\n\n");
}

function sgGetCaretTextBeforeCursor(inputEl) {
  if (!inputEl) return null;
  if (inputEl.tagName === "TEXTAREA" || inputEl.tagName === "INPUT") {
    const end = typeof inputEl.selectionStart === "number" ? inputEl.selectionStart : (inputEl.value || "").length;
    return { textBefore: (inputEl.value || "").slice(0, end), isTextarea: true, offset: end };
  }
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return null;
  const range = sel.getRangeAt(0);
  if (!inputEl.contains(range.endContainer)) return null;
  try {
    const clone = range.cloneRange();
    clone.selectNodeContents(inputEl);
    clone.setEnd(range.endContainer, range.endOffset);
    return { textBefore: clone.toString(), isTextarea: false, range };
  } catch (err) {
    return null;
  }
}

function hideSkillAutocomplete() {
  if (sgSkillMenuElement) sgSkillMenuElement.style.display = "none";
  sgSkillMenuVisible = false;
  sgSkillMenuItems = [];
  sgSkillMenuIndex = 0;
  sgSkillMenuContext = null;
}

function sgUpdateSkillAutocompleteSelection() {
  if (!sgSkillMenuElement) return;
  const rows = sgSkillMenuElement.querySelectorAll(".sg-skill-ac-item");
  rows.forEach((row, idx) => {
    row.classList.toggle("selected", idx === sgSkillMenuIndex);
  });
  const selected = sgSkillMenuElement.querySelector(".sg-skill-ac-item.selected");
  if (selected) selected.scrollIntoView({ block: "nearest" });
}

function sgInsertSkillTrigger(skill) {
  if (!sgSkillMenuContext || !skill) return;
  const { inputEl, triggerChar, rawMatch } = sgSkillMenuContext;
  const primarySlashAlias = skill.aliases.find(a => a.startsWith("/")) || skill.aliases[0];
  const token = triggerChar === "@"
    ? `@${skill.id}`
    : (primarySlashAlias || `@${skill.id}`);
  const replacement = `${token} `;

  hideSkillAutocomplete();
  inputEl.focus();

  if (inputEl.tagName === "TEXTAREA" || inputEl.tagName === "INPUT") {
    const curPos = typeof inputEl.selectionStart === "number" ? inputEl.selectionStart : inputEl.value.length;
    const start = Math.max(0, curPos - rawMatch.length);
    inputEl.value = inputEl.value.slice(0, start) + replacement + inputEl.value.slice(curPos);
    const nextPos = start + replacement.length;
    inputEl.setSelectionRange(nextPos, nextPos);
    inputEl.dispatchEvent(new Event("input", { bubbles: true }));
    return;
  }

  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  const range = sel.getRangeAt(0);
  let node = range.startContainer;
  let offset = range.startOffset;
  if (node.nodeType !== Node.TEXT_NODE) {
    if (node.childNodes[offset - 1] && node.childNodes[offset - 1].nodeType === Node.TEXT_NODE) {
      node = node.childNodes[offset - 1];
      offset = node.textContent.length;
    }
  }
  if (node.nodeType === Node.TEXT_NODE) {
    const before = node.textContent.slice(0, offset);
    const idx = before.lastIndexOf(rawMatch);
    if (idx !== -1) {
      const replaceRange = document.createRange();
      replaceRange.setStart(node, idx);
      replaceRange.setEnd(node, offset);
      sel.removeAllRanges();
      sel.addRange(replaceRange);
      document.execCommand("insertText", false, replacement);
      inputEl.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }
  }
  const full = getPromptText();
  const pos = full.lastIndexOf(rawMatch);
  if (pos !== -1) {
    setPromptText(full.slice(0, pos) + replacement + full.slice(pos + rawMatch.length));
  }
}

function sgRenderSkillAutocomplete(inputEl) {
  if (!sgSkillMenuElement) {
    sgSkillMenuElement = sgSkillEl("div", { id: "sg-skill-autocomplete", className: "sg-skill-autocomplete", role: "listbox" });
    document.body.appendChild(sgSkillMenuElement);
  }
  sgSkillMenuElement.replaceChildren();
  if (!sgSkillMenuItems.length) {
    hideSkillAutocomplete();
    return;
  }
  if (sgSkillMenuIndex >= sgSkillMenuItems.length || sgSkillMenuIndex < 0) {
    sgSkillMenuIndex = 0;
  }
  const header = sgSkillEl("div", { className: "sg-skill-ac-header", textContent: "Skills (Client-Side Inject)" });
  sgSkillMenuElement.appendChild(header);

  sgSkillMenuItems.forEach((skill, idx) => {
    const aliasText = [...skill.aliases, `@${skill.id}`].join("  ");
    const row = sgSkillEl("div", {
      className: `sg-skill-ac-item${idx === sgSkillMenuIndex ? " selected" : ""}`,
      role: "option",
      onMousedown: ev => {
        ev.preventDefault();
        sgInsertSkillTrigger(skill);
      },
      onMouseenter: () => {
        sgSkillMenuIndex = idx;
        sgUpdateSkillAutocompleteSelection();
      }
    }, [
      sgSkillEl("div", { className: "sg-skill-ac-top" }, [
        sgSkillEl("span", { className: "sg-skill-ac-name", textContent: skill.name }),
        sgSkillEl("span", { className: "sg-skill-ac-aliases", textContent: aliasText })
      ]),
      skill.description
        ? sgSkillEl("div", { className: "sg-skill-ac-desc", textContent: skill.description })
        : null
    ]);
    sgSkillMenuElement.appendChild(row);
  });

  sgSkillMenuElement.style.display = "flex";
  sgSkillMenuElement.style.visibility = "hidden";
  const rect = inputEl.getBoundingClientRect();
  const h = sgSkillMenuElement.offsetHeight;
  sgSkillMenuElement.style.top = rect.top > h + 60 ? `${rect.top - h - 12}px` : `${rect.bottom + 12}px`;
  sgSkillMenuElement.style.left = `${Math.max(12, Math.min(rect.left, window.innerWidth - 350))}px`;
  sgSkillMenuElement.style.visibility = "visible";
  sgSkillMenuVisible = true;
}

function initSkillAutocomplete() {
  const selectors = ["rich-textarea .ql-editor", '.ql-editor[contenteditable="true"]', '[contenteditable="true"][role="textbox"]', 'textarea[placeholder*="Enter"]'];

  const handleInput = ev => {
    if (!isExtensionEnabled || !isSkillsInjectionEnabled || slashMenuVisible) {
      hideSkillAutocomplete();
      return;
    }
    if (sgIsImeComposing(ev)) return;
    const inputEl = ev.target;
    if (!inputEl || isMessageEditField(inputEl)) return;
    if (ev.type === "keyup" && ev.key === "Escape") return;
    if (sgSkillAcRafPending) return;
    sgSkillAcRafPending = true;
    requestAnimationFrame(() => {
      sgSkillAcRafPending = false;
      if (!isExtensionEnabled || !isSkillsInjectionEnabled || slashMenuVisible) {
        hideSkillAutocomplete();
        return;
      }
      const caret = sgGetCaretTextBeforeCursor(inputEl);
      if (!caret) {
        hideSkillAutocomplete();
        return;
      }
      const text = caret.textBefore;
      const atMatch = text.match(/(?:^|\s)(@([a-zA-Z0-9_-]*))$/);
      const slashMatch = !atMatch ? text.match(/(?:^|\s)(\/(?!\/)([a-zA-Z0-9_-]+))$/) : null;
      const activeMatch = atMatch || slashMatch;
      if (!activeMatch) {
        sgSkillMenuDismissedToken = "";
        hideSkillAutocomplete();
        return;
      }
      const rawMatch = activeMatch[1];
      const query = (activeMatch[2] || "").toLowerCase();
      const triggerChar = atMatch ? "@" : "/";
      if (sgSkillMenuDismissedToken && sgSkillMenuDismissedToken === rawMatch) {
        return;
      }
      sgSkillMenuDismissedToken = "";

      const eligible = sgEffectiveSkills.filter(s => s.enabled && (s.mode === "inject" || s.mode === "both"));
      const matches = eligible.filter(s => {
        if (!query) return true;
        if (s.id.toLowerCase().includes(query)) return true;
        if (s.name.toLowerCase().includes(query)) return true;
        return s.aliases.some(a => a.toLowerCase().includes(query));
      });
      if (!matches.length) {
        hideSkillAutocomplete();
        return;
      }
      sgSkillMenuItems = matches;
      sgSkillMenuContext = { inputEl, triggerChar, rawMatch };
      sgRenderSkillAutocomplete(inputEl);
    });
  };

  const handleKeydown = ev => {
    if (sgIsImeComposing(ev)) return;
    if (!sgSkillMenuVisible || !isExtensionEnabled || !isSkillsInjectionEnabled) return;
    if (ev.key === "ArrowDown" || (ev.key === "Tab" && !ev.shiftKey)) {
      if (!sgSkillMenuItems.length) return;
      ev.preventDefault();
      ev.stopImmediatePropagation();
      sgSkillMenuIndex = (sgSkillMenuIndex + 1) % sgSkillMenuItems.length;
      sgUpdateSkillAutocompleteSelection();
    } else if (ev.key === "ArrowUp" || (ev.key === "Tab" && ev.shiftKey)) {
      if (!sgSkillMenuItems.length) return;
      ev.preventDefault();
      ev.stopImmediatePropagation();
      sgSkillMenuIndex = (sgSkillMenuIndex - 1 + sgSkillMenuItems.length) % sgSkillMenuItems.length;
      sgUpdateSkillAutocompleteSelection();
    } else if (ev.key === "Enter" && !ev.shiftKey) {
      if (!sgSkillMenuItems.length) return;
      ev.preventDefault();
      ev.stopImmediatePropagation();
      const chosen = sgSkillMenuItems[sgSkillMenuIndex];
      if (chosen) sgInsertSkillTrigger(chosen);
    } else if (ev.key === "Escape") {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      sgSkillMenuDismissedToken = sgSkillMenuContext?.rawMatch || "";
      hideSkillAutocomplete();
    }
  };

  sgObserverRegistry.registerUIRefresh("skillsAutocomplete", () => {
    const found = new Set();
    for (const sel of selectors) {
      document.querySelectorAll(sel).forEach(el => found.add(el));
    }
    found.forEach(el => {
      if (el.dataset.sgSkillAcBound) return;
      el.dataset.sgSkillAcBound = "true";
      el.addEventListener("input", handleInput);
      el.addEventListener("keyup", handleInput);
      el.addEventListener("keydown", handleKeydown, true);
    });
  });

  document.addEventListener("click", ev => {
    if (sgSkillMenuVisible && sgSkillMenuElement && !sgSkillMenuElement.contains(ev.target)) {
      hideSkillAutocomplete();
    }
  });
}

function sgPerformSkillInjectionAndSend(nativeSendBtn) {
  const rawText = getPromptText();
  if (!rawText || !rawText.trim()) return false;
  const { invokedSkills, cleanedQuery } = isSkillsInjectionEnabled
    ? sgResolveInvokedSkills(rawText, sgEffectiveSkills)
    : { invokedSkills: [], cleanedQuery: rawText };
  const activeBaselines = sgGetActiveBaselinesForCurrentTurn();
  if (!invokedSkills.length && !activeBaselines.length) return false;

  const finalPrompt = sgAssemblePromptWithBaseline(activeBaselines, invokedSkills, cleanedQuery);
  _sgSkillBypassSend = true;
  hideSkillAutocomplete();
  setPromptText(finalPrompt);

  if (typeof showToast === "function") {
    const parts = [];
    if (activeBaselines.length) parts.push(`${activeBaselines.length} baseline rule${activeBaselines.length > 1 ? "s" : ""}`);
    if (invokedSkills.length) parts.push(`skill${invokedSkills.length > 1 ? "s" : ""}: ${invokedSkills.map(s => s.name).join(", ")}`);
    showToast(`Applied ${parts.join(" + ")}`, "info");
  }

  setTimeout(() => {
    try {
      if (nativeSendBtn && nativeSendBtn.isConnected && !nativeSendBtn.disabled) {
        nativeSendBtn.click();
      } else {
        clickSendButton();
      }
    } finally {
      setTimeout(() => {
        _sgSkillBypassSend = false;
      }, 250);
    }
  }, 40);
  return true;
}

function initSkillPreSendInterceptor() {
  const onKeydown = ev => {
    if (_sgSkillBypassSend || _sgMigrationRunning || _sgBaselineMigrationRunning) return;
    if ("undefined" != typeof _sgOrchBypassSendIntercept && _sgOrchBypassSendIntercept) return;
    if ((document.body && "true" === document.body.dataset.sgBgWorker) || (window.location && String(window.location.hash || "").includes("sg_orch_worker=1"))) return;
    if (!isExtensionEnabled || (!isSkillsInjectionEnabled && !isBaselineInjectionEnabled)) return;
    if (ev.key !== "Enter" || ev.shiftKey || ev.ctrlKey || ev.altKey || ev.metaKey || sgIsImeComposing(ev)) return;
    if (slashMenuVisible || sgSkillMenuVisible) return;
    if (typeof isCurrentlyGenerating !== "undefined" && isCurrentlyGenerating && typeof isQueueingEnabled !== "undefined" && isQueueingEnabled) return;
    if (typeof sgGetPeriodicBlockedElement === "function" && sgGetPeriodicBlockedElement()) return;

    const target = ev.target;
    if (!(target instanceof Element) || isMessageEditField(target)) return;
    const composer = findPromptInput();
    if (!composer || (target !== composer && !composer.contains(target))) return;

    const rawText = getPromptText();
    if (!rawText || !rawText.trim()) return;
    if (typeof isOrchestratorEnabled !== "undefined" && isOrchestratorEnabled && /^\s*(?:\/orchestrate(?:-mode)?\/|\/oc\/|@orchestrate(?:-mode)?\b)\s*(.+)/is.test(rawText)) return;
    const { invokedSkills } = isSkillsInjectionEnabled
      ? sgResolveInvokedSkills(rawText, sgEffectiveSkills)
      : { invokedSkills: [] };
    const activeBaselines = sgGetActiveBaselinesForCurrentTurn();
    if (!invokedSkills.length && !activeBaselines.length) return;

    ev.preventDefault();
    ev.stopImmediatePropagation();
    sgPerformSkillInjectionAndSend(null);
  };

  const onClick = ev => {
    if (_sgSkillBypassSend || _sgMigrationRunning || _sgBaselineMigrationRunning) return;
    if ("undefined" != typeof _sgOrchBypassSendIntercept && _sgOrchBypassSendIntercept) return;
    if ((document.body && "true" === document.body.dataset.sgBgWorker) || (window.location && String(window.location.hash || "").includes("sg_orch_worker=1"))) return;
    if (!isExtensionEnabled || (!isSkillsInjectionEnabled && !isBaselineInjectionEnabled)) return;
    if (typeof sgGetPeriodicBlockedElement === "function" && sgGetPeriodicBlockedElement()) return;
    const target = ev.target;
    if (!(target instanceof Element)) return;
    const sendBtn = target.closest(SG_SKILL_SEND_BTN_SELECTOR);
    if (!sendBtn || sendBtn.disabled) return;
    if (sendBtn.classList.contains("stop") || sendBtn.querySelector('[fonticon="stop"]')) return;

    const rawText = getPromptText();
    if (!rawText || !rawText.trim()) return;
    if (typeof isOrchestratorEnabled !== "undefined" && isOrchestratorEnabled && /^\s*(?:\/orchestrate(?:-mode)?\/|\/oc\/|@orchestrate(?:-mode)?\b)\s*(.+)/is.test(rawText)) return;
    const { invokedSkills } = isSkillsInjectionEnabled
      ? sgResolveInvokedSkills(rawText, sgEffectiveSkills)
      : { invokedSkills: [] };
    const activeBaselines = sgGetActiveBaselinesForCurrentTurn();
    if (!invokedSkills.length && !activeBaselines.length) return;

    ev.preventDefault();
    ev.stopImmediatePropagation();
    sgPerformSkillInjectionAndSend(sendBtn);
  };

  if (typeof SG !== "undefined" && SG && SG.dispatcher) {
    SG.dispatcher.register("skills:presend:keydown", "document", "keydown", onKeydown, SG.dispatcher.PRIORITY.SKILLS_PRESEND);
    SG.dispatcher.register("skills:presend:click", "document", "click", onClick, SG.dispatcher.PRIORITY.SKILLS_PRESEND);
  } else {
    document.addEventListener("keydown", onKeydown, true);
    document.addEventListener("click", onClick, true);
  }
}

function sgGetCurrentAccountInfo() {
  const index = getGoogleAccountIndex() || "0";
  let email = null;
  const emailSelectors = [
    'a[aria-label*="Google Account"]',
    'button[aria-label*="Google Account"]',
    'a[aria-label*="Tài khoản Google"]',
    'button[aria-label*="Tài khoản Google"]',
    'a[href*="accounts.google.com/SignOutOptions"]',
    'header a[aria-label*="@"]',
    'top-bar-actions a[aria-label*="@"]',
    'top-bar-actions button[aria-label*="@"]'
  ];
  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
  for (const sel of emailSelectors) {
    try {
      const el = document.querySelector(sel);
      if (!el) continue;
      const text = [el.getAttribute("aria-label"), el.getAttribute("title"), el.getAttribute("data-email")].filter(Boolean).join(" ");
      const m = text.match(emailRegex);
      if (m) {
        email = m[1].toLowerCase();
        break;
      }
    } catch (err) {}
  }
  const accountKey = email ? `u_${index}:${email}` : `u_${index}`;
  const label = email ? `${email} (/u/${index})` : `Account /u/${index}`;
  return { accountKey, index, email, label };
}

function sgEscapeSkillRegex(str) {
  return String(str || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sgGetMatchingAccountLedgerKeys(ledger, accountInfo) {
  if (!ledger || typeof ledger !== "object") return [];
  const info = accountInfo || sgGetCurrentAccountInfo();
  const keys = [];
  const seen = new Set();
  const pushKey = k => {
    if (k && !seen.has(k) && Object.prototype.hasOwnProperty.call(ledger, k) && ledger[k] && typeof ledger[k] === "object") {
      seen.add(k);
      keys.push(k);
    }
  };
  pushKey(info.accountKey);
  if (info.index !== undefined && info.index !== null) {
    pushKey(`u_${info.index}`);
  }
  const emailLower = info.email ? String(info.email).toLowerCase() : "";
  const idxPrefix = info.index !== undefined && info.index !== null ? `u_${info.index}:` : "";
  for (const k of Object.keys(ledger)) {
    if (emailLower && k.toLowerCase().endsWith(`:${emailLower}`)) {
      pushKey(k);
    } else if (!emailLower && idxPrefix && k.startsWith(idxPrefix)) {
      pushKey(k);
    }
  }
  return keys;
}

function sgGetMergedAccountMigratedMap(ledger, accountInfo) {
  const keys = sgGetMatchingAccountLedgerKeys(ledger, accountInfo);
  const merged = {};
  for (let i = keys.length - 1; i >= 0; i--) {
    const entry = ledger[keys[i]];
    if (entry && entry.migrated && typeof entry.migrated === "object") {
      for (const [id, rec] of Object.entries(entry.migrated)) {
        if (!rec || typeof rec !== "object") continue;
        const existing = merged[id];
        if (!existing) {
          merged[id] = { ...rec };
        } else {
          const prevTime = Date.parse(existing.migratedAt || "") || 0;
          const nextTime = Date.parse(rec.migratedAt || "") || 0;
          if (nextTime >= prevTime) {
            merged[id] = { ...rec };
          }
        }
      }
    }
  }
  return merged;
}

const SG_BUNDLED_COMMAND_PROBES = [
  "/analyze/", "/breakdown/", "/origin/", "/plan/", "/simplify/",
  "/debug/", "/review/", "/no code/", "/agent-guide/", "/brainstorm/",
  "/orchestrate/", "/acknowledgment/"
];

function sgIsMultiCommandOverviewEntry(entryText, baselineInstructions) {
  const norm = sgNormalizeInstructionText(entryText);
  if (!norm) return false;
  if (Array.isArray(baselineInstructions)) {
    for (const b of baselineInstructions) {
      if (b && b.text && sgSavedInfoTextsEquivalent(b.text, norm, { mode: "dedupe" })) {
        return true;
      }
    }
  }
  const lower = norm.toLowerCase();
  if (lower.includes("skill id:") || lower.includes("--- begin skill instructions")) {
    return false;
  }
  let probeHits = 0;
  for (const probe of SG_BUNDLED_COMMAND_PROBES) {
    if (lower.includes(probe)) {
      probeHits++;
      if (probeHits >= 3) return true;
    }
  }
  return false;
}

function sgDoesSavedInfoContainSkill(skill, existingSavedTexts, baselineInstructions) {
  if (!skill || !skill.id || !existingSavedTexts) return false;
  const rawList = existingSavedTexts instanceof Set
    ? [...existingSavedTexts]
    : Array.isArray(existingSavedTexts)
      ? existingSavedTexts
      : [];
  if (!rawList.length) return false;

  const idLower = String(skill.id || "").trim().toLowerCase();
  const nameLower = sgNormalizeInstructionText(skill.name || "").toLowerCase();
  const aliases = Array.isArray(skill.aliases)
    ? skill.aliases.map(a => String(a || "").trim().toLowerCase()).filter(Boolean)
    : [];
  const descTokens = sgTokenizeSavedInfoContent(skill.description || "");
  const contentPreviewTokens = sgTokenizeSavedInfoContent(String(skill.content || "").slice(0, 600));
  const combinedRefTokens = new Set([...descTokens, ...contentPreviewTokens]);

  const atHandleRe = new RegExp(`(?:^|[^a-z0-9_-])@${sgEscapeSkillRegex(idLower)}(?:$|[^a-z0-9_-])`, "i");
  const hyphenIdRe = idLower.includes("-") && idLower.length >= 6
    ? new RegExp(`(?:^|[^a-z0-9_-])${sgEscapeSkillRegex(idLower)}(?:$|[^a-z0-9_-])`, "i")
    : null;

  for (const rawEntry of rawList) {
    const entry = sgNormalizeInstructionText(rawEntry);
    if (!entry || entry.length < 12) continue;
    if (sgIsMultiCommandOverviewEntry(entry, baselineInstructions)) continue;
    const eLower = entry.toLowerCase();

    if (skill.isCustomized) {
      if (
        (eLower.includes(`skill id: ${idLower}`) && eLower.includes(`version: ${skill.version}`))
        || sgSavedInfoTextsEquivalent(skill.content || "", entry, { mode: "new_entry" })
      ) {
        return true;
      }
      continue;
    }

    if (
      eLower.includes(`skill id: ${idLower}`)
      || eLower.includes(`<skill id="${idLower}"`)
      || atHandleRe.test(entry)
      || (hyphenIdRe && hyphenIdRe.test(entry))
    ) {
      return true;
    }

    const hasAlias = aliases.some(al => al.length >= 3 && eLower.includes(al));

    if (nameLower.length >= 4 && eLower.includes(nameLower)) {
      if (eLower.includes("skill name:") || hasAlias) return true;
      if (combinedRefTokens.size >= 4) {
        const entryTokens = sgTokenizeSavedInfoContent(entry);
        let shared = 0;
        for (const t of combinedRefTokens) {
          if (entryTokens.has(t)) shared++;
        }
        if (shared >= 4 || (shared / Math.max(descTokens.size || combinedRefTokens.size, 1)) >= 0.35) {
          return true;
        }
      }
    }

    if (skill.content && sgSavedInfoTextsEquivalent(skill.content, entry, { mode: "new_entry" })) {
      return true;
    }
    if (skill.description && sgSavedInfoTextsEquivalent(skill.description, entry, { mode: "new_entry" })) {
      return true;
    }

    if (hasAlias && combinedRefTokens.size >= 4) {
      const entryTokens = sgTokenizeSavedInfoContent(entry);
      let shared = 0;
      for (const t of combinedRefTokens) {
        if (entryTokens.has(t)) shared++;
      }
      const refDenom = Math.max(Math.min(descTokens.size || combinedRefTokens.size, 14), 4);
      if (shared >= 4 && (shared / refDenom) >= 0.35) {
        return true;
      }
    }
  }

  return false;
}

function sgDoesSavedInfoContainBaseline(item, existingSavedTexts) {
  if (!item || !item.text || !existingSavedTexts) return false;
  const norm = sgNormalizeInstructionText(item.text);
  if (!norm) return false;
  if (existingSavedTexts instanceof Set && existingSavedTexts.has(norm)) return true;
  const rawList = existingSavedTexts instanceof Set
    ? [...existingSavedTexts]
    : Array.isArray(existingSavedTexts)
      ? existingSavedTexts
      : [];
  for (const entry of rawList) {
    if (!entry) continue;
    if (sgNormalizeInstructionText(entry) === norm) return true;
    if (sgSavedInfoTextsEquivalent(norm, entry, { mode: "dedupe" })) return true;
  }
  return false;
}

function sgScanActiveChatDomForMigratedSkills() {
  const results = new Set();
  if (typeof document === "undefined" || !document.querySelectorAll) return results;
  try {
    const queries = document.querySelectorAll("user-query, .user-query-container, [data-test-id*='user-query']");
    for (const q of queries) {
      const txt = sgNormalizeInstructionText(q.textContent || "");
      if (!txt) continue;
      if (
        /skill id:\s*[a-z0-9_-]+/i.test(txt)
        || /<skill\s+id=["'][a-z0-9_-]+["']/i.test(txt)
        || /--- begin skill instructions/i.test(txt)
      ) {
        results.add(txt);
      }
    }
  } catch (err) {}
  return results;
}

const _sgScannedSavedInfoByAccount = new Map();
const _sgScannedUserSkillsByAccount = new Map();
const _sgRemovedSkillsByAccount = new Map();
let _sgLastBundledSkillsAudit = null;
let _sgPageLoadBundledAuditRan = false;

function sgGetCustomizeSkillsUrl() {
  const index = typeof getGoogleAccountIndex === "function" ? getGoogleAccountIndex() : null;
  return index ? `https://gemini.google.com/u/${index}/customize/skills` : "https://gemini.google.com/customize/skills";
}

function isOnCustomizeSkillsPage() {
  return /^\/(?:u\/\d+\/)?customize\/skills(?:\/|$)/i.test(window.location.pathname || "");
}

function sgNormalizeSkillSlugKey(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]+/g, "")
    .replace(/^-+|-+$/g, "");
}

function sgReadInstalledCustomizeSkillsFromDom() {
  if (typeof document === "undefined" || !document.querySelector) {
    return { hydrated: false, skills: [], totalCards: 0, sectionsCount: 0 };
  }
  const page = document.querySelector("customize-page");
  if (!page) {
    return { hydrated: false, skills: [], totalCards: 0, sectionsCount: 0 };
  }
  const activeSkillsTab = page.querySelector('button[role="tab"][data-tab="skills"][aria-selected="true"]');
  const hasHeader = Boolean(page.querySelector("header.page-header"));
  const hasCreateBtn = Boolean(page.querySelector(".create-dropdown-button, .mobile-pill-create-button"));
  const hasSpinner = Boolean(page.querySelector('mat-progress-spinner, [role="progressbar"]'));
  const sections = Array.from(page.querySelectorAll("section.category-section"));
  const cards = Array.from(page.querySelectorAll("customize-card"));

  const skills = [];
  const seen = new Set();
  for (const card of cards) {
    const actionBox = card.querySelector(".card-action-container");
    const hasMore = Boolean(actionBox && actionBox.querySelector('.more-button, [fonticonname="more_horiz"], mat-icon[fonticon="more_horiz"], mat-icon[data-mat-icon-name="more_horiz"]'));
    const hasAdd = Boolean(actionBox && actionBox.querySelector('.add-button, [fonticonname="add"], mat-icon[fonticon="add"], mat-icon[data-mat-icon-name="add"]'));
    if (!hasMore || hasAdd) continue;

    const primaryBtn = card.querySelector("button.card-primary-action");
    const cardId = String(primaryBtn && primaryBtn.getAttribute("data-card-id") || "").trim();
    const titleEl = card.querySelector(".content .title .title-text, .title-text, .content .title");
    const subtitleEl = card.querySelector(".content .subtitle, .subtitle");
    let title = sgNormalizeInstructionText(titleEl ? titleEl.textContent : "");
    let subtitle = sgNormalizeInstructionText(subtitleEl ? subtitleEl.textContent : "");
    if (!title && primaryBtn) {
      const aria = sgNormalizeInstructionText(primaryBtn.getAttribute("aria-label") || "");
      if (aria) {
        const commaIdx = aria.indexOf(",");
        title = (commaIdx > 0 ? aria.slice(0, commaIdx) : aria).trim();
        if (!subtitle && commaIdx > 0) subtitle = aria.slice(commaIdx + 1).trim();
      }
    }
    if (!title && !cardId) continue;
    const dedupeKey = cardId || title.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    skills.push({ cardId, title, subtitle });
  }

  const hydrated = Boolean(
    (isOnCustomizeSkillsPage() || activeSkillsTab)
    && hasHeader
    && !hasSpinner
    && (sections.length > 0 || cards.length > 0 || hasCreateBtn)
  );
  return {
    hydrated,
    skills,
    totalCards: cards.length,
    sectionsCount: sections.length
  };
}

function sgStoreScannedUserSkillsRecord(accountInfo, record) {
  if (!record || typeof record !== "object") return;
  const info = accountInfo || sgGetCurrentAccountInfo();
  if (info.accountKey) _sgScannedUserSkillsByAccount.set(info.accountKey, record);
  if (info.index !== undefined && info.index !== null) {
    _sgScannedUserSkillsByAccount.set(`u_${info.index}`, record);
  }
  if (record.email) {
    _sgScannedUserSkillsByAccount.set(`u_${info.index}:${String(record.email).toLowerCase()}`, record);
  }
}

function sgGetCachedUserSkillsRecordForAccount(accountInfo) {
  const info = accountInfo || sgGetCurrentAccountInfo();
  if (isOnCustomizeSkillsPage()) {
    const domSnap = sgReadInstalledCustomizeSkillsFromDom();
    if (domSnap.hydrated) {
      const rec = {
        ok: true,
        verified: true,
        skills: domSnap.skills,
        totalCards: domSnap.totalCards,
        sectionsCount: domSnap.sectionsCount,
        email: info.email || null,
        source: "current_tab",
        scannedAt: Date.now()
      };
      sgStoreScannedUserSkillsRecord(info, rec);
      return rec;
    }
  }
  const byKey = info.accountKey ? _sgScannedUserSkillsByAccount.get(info.accountKey) : null;
  const byIdx = _sgScannedUserSkillsByAccount.get(`u_${info.index}`);
  if (byKey && byIdx) {
    return (byKey.scannedAt || 0) >= (byIdx.scannedAt || 0) ? byKey : byIdx;
  }
  return byKey || byIdx || null;
}

function sgMatchInstalledSkillCard(skill, installedCards) {
  if (!skill || !skill.id || !Array.isArray(installedCards) || !installedCards.length) return null;
  const idLower = String(skill.id || "").trim().toLowerCase();
  const idSlug = sgNormalizeSkillSlugKey(skill.id);
  const nameLower = sgNormalizeInstructionText(skill.name || "").toLowerCase();
  const nameSlug = sgNormalizeSkillSlugKey(skill.name || "");
  const aliases = Array.isArray(skill.aliases)
    ? skill.aliases.map(a => String(a || "").trim().toLowerCase()).filter(a => a.length >= 3)
    : [];
  const descTokens = sgTokenizeSavedInfoContent(skill.description || "");

  for (const card of installedCards) {
    if (!card || typeof card !== "object") continue;
    const titleNorm = sgNormalizeInstructionText(card.title || "").toLowerCase();
    const titleSlug = sgNormalizeSkillSlugKey(card.title || "");
    if (
      titleNorm === idLower
      || titleNorm === `@${idLower}`
      || (idSlug && titleSlug === idSlug)
      || (nameLower && titleNorm === nameLower)
      || (nameSlug && titleSlug === nameSlug)
    ) {
      return card;
    }
  }

  for (const card of installedCards) {
    if (!card || typeof card !== "object") continue;
    const subNorm = sgNormalizeInstructionText(card.subtitle || "");
    const subLower = subNorm.toLowerCase();
    if (!subNorm) continue;

    if (subLower.includes(`@${idLower}`) || subLower.includes(`skill id: ${idLower}`)) {
      return card;
    }

    const hasAlias = aliases.some(al => subLower.includes(al));
    if (hasAlias && descTokens.size >= 3) {
      const subTokens = sgTokenizeSavedInfoContent(subNorm);
      let shared = 0;
      for (const t of descTokens) {
        if (subTokens.has(t)) shared++;
      }
      if (shared >= 3 && (shared / Math.max(Math.min(descTokens.size, 12), 3)) >= 0.4) {
        return card;
      }
    }

    if (skill.description && sgSavedInfoTextsEquivalent(skill.description, subNorm, { mode: "new_entry" })) {
      return card;
    }
  }

  return null;
}

function sgGetCachedSavedInfoTextsForAccount(accountInfo) {
  const info = accountInfo || sgGetCurrentAccountInfo();
  const out = new Set();
  if (isOnSavedInfoPage()) {
    for (const t of sgReadExistingSavedInfoTexts()) out.add(t);
  }
  for (const t of sgScanActiveChatDomForMigratedSkills()) out.add(t);

  const cachedByKey = _sgScannedSavedInfoByAccount.get(info.accountKey);
  const cachedByIdx = _sgScannedSavedInfoByAccount.get(`u_${info.index}`);
  for (const src of [cachedByKey, cachedByIdx]) {
    if (src && Array.isArray(src.entries)) {
      for (const t of src.entries) out.add(t);
    }
  }
  return out;
}

function sgComputeMigrationDiff(skills, ledger, accountInfo, existingSavedTexts = null, baselineInstructions = null, installedSkillsRecord = null) {
  const info = accountInfo || sgGetCurrentAccountInfo();
  const migratedMap = sgGetMergedAccountMigratedMap(ledger, info);
  const remoteSkillsRec = installedSkillsRecord !== null
    ? installedSkillsRecord
    : sgGetCachedUserSkillsRecordForAccount(info);
  const hasVerifiedRemoteSkills = Boolean(remoteSkillsRec && remoteSkillsRec.verified === true && Array.isArray(remoteSkillsRec.skills));
  const installedCards = hasVerifiedRemoteSkills ? remoteSkillsRec.skills : [];
  const removedSet = _sgRemovedSkillsByAccount.get(info.accountKey) || _sgRemovedSkillsByAccount.get(`u_${info.index}`) || new Set();

  const savedPool = existingSavedTexts !== null
    ? existingSavedTexts
    : null;
  const hasExplicitSavedPool = savedPool && ((savedPool instanceof Set && savedPool.size > 0) || (Array.isArray(savedPool) && savedPool.length > 0));
  const baselinesList = Array.isArray(baselineInstructions) ? baselineInstructions : sgEffectiveBaselines;

  const pending = [];
  const synced = [];
  const duplicates = [];
  const removed = [];
  const statusById = {};
  const matchedCardById = {};

  for (const s of skills) {
    if (!s.enabled || (s.mode !== "bootstrap" && s.mode !== "both")) {
      statusById[s.id] = "excluded";
      continue;
    }
    const prev = migratedMap[s.id];
    const ledgerSynced = Boolean(prev && prev.version === s.version && prev.hash === s.hash);

    if (hasVerifiedRemoteSkills) {
      const matchedCard = sgMatchInstalledSkillCard(s, installedCards);
      if (matchedCard) {
        matchedCardById[s.id] = matchedCard;
        if (s.isCustomized && prev && (prev.version !== s.version || prev.hash !== s.hash)) {
          statusById[s.id] = "updated";
          pending.push({ skill: s, reason: "updated" });
        } else {
          statusById[s.id] = ledgerSynced ? "synced" : "duplicate";
          if (!ledgerSynced) duplicates.push(s);
          synced.push(s);
        }
        continue;
      }
      if (prev || removedSet.has(s.id)) {
        statusById[s.id] = "removed";
        removed.push(s);
        pending.push({ skill: s, reason: "removed" });
      } else {
        statusById[s.id] = "new";
        pending.push({ skill: s, reason: "new" });
      }
      continue;
    }

    const inSavedInfo = Boolean(hasExplicitSavedPool && sgDoesSavedInfoContainSkill(s, savedPool, baselinesList));
    if (inSavedInfo && (!prev || ledgerSynced || !s.isCustomized)) {
      statusById[s.id] = ledgerSynced ? "synced" : "duplicate";
      duplicates.push(s);
      synced.push(s);
      continue;
    }

    if (!prev) {
      statusById[s.id] = removedSet.has(s.id) ? "removed" : "new";
      if (removedSet.has(s.id)) removed.push(s);
      pending.push({ skill: s, reason: removedSet.has(s.id) ? "removed" : "new" });
    } else if (prev.version !== s.version || prev.hash !== s.hash) {
      statusById[s.id] = "updated";
      pending.push({ skill: s, reason: "updated" });
    } else {
      statusById[s.id] = "synced";
      synced.push(s);
    }
  }
  return {
    accountKey: info.accountKey,
    accountLabel: info.label,
    pending,
    synced,
    duplicates,
    removed,
    statusById,
    matchedCardById,
    remoteVerified: hasVerifiedRemoteSkills,
    remoteSource: remoteSkillsRec && remoteSkillsRec.source ? remoteSkillsRec.source : null,
    remoteScannedAt: remoteSkillsRec && remoteSkillsRec.scannedAt ? remoteSkillsRec.scannedAt : null,
    totalEligible: pending.length + synced.length
  };
}

function sgBuildMigrationPrompt(skill) {
  const aliasesStr = skill.aliases.length ? skill.aliases.join(", ") : `@${skill.id}`;
  return [
    "Please create or update the following saved skill / instruction profile in my Gemini account with the exact specification below, and confirm once saved.",
    "",
    `Skill ID: ${skill.id}`,
    `Skill Name: ${skill.name}`,
    `Aliases / Triggers: ${aliasesStr}`,
    `Description: ${skill.description || "(none)"}`,
    `Version: ${skill.version}`,
    "",
    "--- BEGIN SKILL INSTRUCTIONS (MARKDOWN) ---",
    String(skill.content || "").trim(),
    "--- END SKILL INSTRUCTIONS ---"
  ].join("\n");
}

function sgIsGeminiGeneratingNow() {
  return Boolean(document.querySelector('[fonticon="stop"], mat-icon[data-mat-icon-name="stop"], .send-button.stop'));
}

function sgSleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function sgWaitForTurnCompletion(initialResponseCount, timeoutMs = 90000) {
  const startTime = Date.now();
  let started = false;
  let idleStreak = 0;

  while (Date.now() - startTime < timeoutMs) {
    if (_sgMigrationAborted) return { ok: false, reason: "aborted" };
    const generating = sgIsGeminiGeneratingNow();
    const currentResponses = document.querySelectorAll("model-response").length;

    if (!started) {
      if (generating || currentResponses > initialResponseCount) {
        started = true;
        idleStreak = generating ? 0 : 1;
      } else if (Date.now() - startTime > 12000) {
        return { ok: false, reason: "start-timeout" };
      }
      await sgSleep(250);
      continue;
    }

    if (generating) {
      idleStreak = 0;
    } else {
      idleStreak++;
      if (idleStreak >= 3) {
        return { ok: true };
      }
    }
    await sgSleep(400);
  }
  return { ok: false, reason: "timeout" };
}

async function sgCheckpointMigratedSkill(accountKey, bundleVersion, skill) {
  const { ledger } = await sgReadLocalSkillStorage();
  const nextLedger = { ...ledger };
  const prevAcct = nextLedger[accountKey] && typeof nextLedger[accountKey] === "object"
    ? nextLedger[accountKey]
    : { bundleVersion, migrated: {} };
  nextLedger[accountKey] = {
    bundleVersion,
    migrated: {
      ...(prevAcct.migrated || {}),
      [skill.id]: {
        version: skill.version,
        hash: skill.hash,
        migratedAt: new Date().toISOString()
      }
    }
  };
  const ok = await safeLocalStorageSet({ [SG_SKILLS_LEDGER_KEY]: nextLedger });
  if (ok) sgSkillMigrationLedger = nextLedger;
  return ok;
}

async function sgCheckpointMigratedSkillsBatch(accountKey, bundleVersion, skillsToSave) {
  if (!accountKey || SG_SKILL_FORBIDDEN_KEYS.has(accountKey) || !Array.isArray(skillsToSave) || !skillsToSave.length) {
    return false;
  }
  const { ledger } = await sgReadLocalSkillStorage();
  const nextLedger = { ...ledger };
  const prevAcct = nextLedger[accountKey] && typeof nextLedger[accountKey] === "object"
    ? nextLedger[accountKey]
    : { bundleVersion, migrated: {} };
  const nextMigrated = { ...(prevAcct.migrated || {}) };
  let changed = false;
  const nowIso = new Date().toISOString();

  for (const s of skillsToSave) {
    if (!s || !s.id || SG_SKILL_FORBIDDEN_KEYS.has(s.id)) continue;
    const h = s.hash || sgComputeSkillHash(s);
    const existing = nextMigrated[s.id];
    if (!existing || existing.version !== s.version || existing.hash !== h) {
      nextMigrated[s.id] = {
        version: s.version,
        hash: h,
        migratedAt: (existing && existing.migratedAt) || nowIso
      };
      changed = true;
    }
  }

  if (!changed) {
    sgSkillMigrationLedger = nextLedger;
    return true;
  }

  nextLedger[accountKey] = {
    bundleVersion: bundleVersion || prevAcct.bundleVersion || "1.1.0",
    migrated: nextMigrated
  };
  const ok = await safeLocalStorageSet({ [SG_SKILLS_LEDGER_KEY]: nextLedger });
  if (ok) sgSkillMigrationLedger = nextLedger;
  return ok;
}

async function sgPruneRemovedSkillsFromLedger(accountInfo, removedSkillIds) {
  if (!Array.isArray(removedSkillIds) || !removedSkillIds.length) return false;
  const info = accountInfo || sgGetCurrentAccountInfo();
  const { ledger } = await sgReadLocalSkillStorage();
  const nextLedger = { ...ledger };
  const keys = sgGetMatchingAccountLedgerKeys(nextLedger, info);
  const removeSet = new Set(removedSkillIds.filter(id => id && !SG_SKILL_FORBIDDEN_KEYS.has(id)));
  let changed = false;

  for (const k of keys) {
    const acct = nextLedger[k];
    if (!acct || !acct.migrated || typeof acct.migrated !== "object") continue;
    const nextMigrated = { ...acct.migrated };
    let acctChanged = false;
    for (const id of removeSet) {
      if (Object.prototype.hasOwnProperty.call(nextMigrated, id)) {
        delete nextMigrated[id];
        acctChanged = true;
        changed = true;
      }
    }
    if (acctChanged) {
      nextLedger[k] = { ...acct, migrated: nextMigrated };
    }
  }

  if (!changed) return true;
  const ok = await safeLocalStorageSet({ [SG_SKILLS_LEDGER_KEY]: nextLedger });
  if (ok) sgSkillMigrationLedger = nextLedger;
  return ok;
}

async function sgResetAccountLedger(accountKey, accountInfo = null) {
  const { ledger } = await sgReadLocalSkillStorage();
  const nextLedger = { ...ledger };
  const keysToClear = sgGetMatchingAccountLedgerKeys(nextLedger, accountInfo || { accountKey, index: (String(accountKey || "").match(/^u_(\d+)/) || [])[1] || "0" });
  delete nextLedger[accountKey];
  for (const k of keysToClear) {
    delete nextLedger[k];
    _sgScannedSavedInfoByAccount.delete(k);
    _sgScannedUserSkillsByAccount.delete(k);
    _sgRemovedSkillsByAccount.delete(k);
  }
  _sgScannedSavedInfoByAccount.delete(accountKey);
  _sgScannedUserSkillsByAccount.delete(accountKey);
  _sgRemovedSkillsByAccount.delete(accountKey);
  const ok = await safeLocalStorageSet({ [SG_SKILLS_LEDGER_KEY]: nextLedger });
  if (ok) sgSkillMigrationLedger = nextLedger;
  return ok;
}

function sgCreateMigrationHud(total, accountLabel, onStop) {
  const existing = document.getElementById("sg-skill-migration-hud");
  if (existing) existing.remove();

  const titleEl = sgSkillEl("div", { className: "sg-mig-hud-title", textContent: `Migrating 0 / ${total}...` });
  const acctEl = sgSkillEl("div", { className: "sg-mig-hud-acct", textContent: accountLabel });
  const detailEl = sgSkillEl("div", { className: "sg-mig-hud-detail", textContent: "Preparing..." });
  const barFill = sgSkillEl("div", { className: "sg-mig-hud-fill" });
  const stopBtn = sgSkillEl("button", {
    type: "button",
    className: "sg-skills-btn sg-skills-btn-danger",
    textContent: "Stop Migration",
    onClick: () => {
      stopBtn.disabled = true;
      stopBtn.textContent = "Stopping...";
      onStop();
    }
  });
  const closeBtn = sgSkillEl("button", {
    type: "button",
    className: "sg-skills-btn sg-skills-btn-secondary",
    textContent: "Close",
    style: "display: none;",
    onClick: () => hud.remove()
  });

  const hud = sgSkillEl("div", { id: "sg-skill-migration-hud", className: "sg-skill-migration-hud", role: "status" }, [
    sgSkillEl("div", { className: "sg-mig-hud-head" }, [
      sgSkillEl("div", null, [titleEl, acctEl])
    ]),
    sgSkillEl("div", { className: "sg-mig-hud-track" }, [barFill]),
    detailEl,
    sgSkillEl("div", { className: "sg-mig-hud-actions" }, [stopBtn, closeBtn])
  ]);
  document.body.appendChild(hud);

  return {
    update(completed, currentName, statusText) {
      titleEl.textContent = `Migrating ${Math.min(completed + 1, total)} / ${total}...`;
      detailEl.textContent = currentName ? `${currentName}: ${statusText}` : statusText;
      barFill.style.width = `${Math.round((completed / Math.max(total, 1)) * 100)}%`;
    },
    finish(completed, finalText, isError) {
      titleEl.textContent = isError ? `Migration stopped (${completed} / ${total})` : `Migration complete (${completed} / ${total})`;
      detailEl.textContent = finalText;
      barFill.style.width = `${Math.round((completed / Math.max(total, 1)) * 100)}%`;
      stopBtn.style.display = "none";
      closeBtn.style.display = "inline-flex";
    }
  };
}

async function sgStartAccountMigration(pendingItems, accountInfo, bundleVersion) {
  if (_sgMigrationRunning) {
    showToast("Skill migration is already running.", "info");
    return;
  }
  if (!pendingItems.length) {
    showToast("No pending skills to migrate for this account.", "info");
    return;
  }
  if (!findPromptInput()) {
    showToast("Open a Gemini chat composer before running Account Migration.", "error");
    return;
  }

  _sgMigrationRunning = true;
  _sgMigrationAborted = false;
  if (_sgSkillsModalState.overlay) {
    _sgSkillsModalState.overlay.remove();
    _sgSkillsModalState.overlay = null;
  }

  const total = pendingItems.length;
  let completed = 0;
  const hud = sgCreateMigrationHud(total, accountInfo.label, () => {
    _sgMigrationAborted = true;
  });

  try {
    const installedRec = sgGetCachedUserSkillsRecordForAccount(accountInfo);
    const installedCards = installedRec && installedRec.verified && Array.isArray(installedRec.skills)
      ? installedRec.skills
      : [];
    const migratedMap = sgGetMergedAccountMigratedMap(sgSkillMigrationLedger, accountInfo);

    for (let i = 0; i < total; i++) {
      if (_sgMigrationAborted) {
        hud.finish(completed, `Stopped by user. ${completed} skill(s) checkpointed.`, true);
        showToast(`Migration stopped after ${completed}/${total} skill(s).`, "info");
        return;
      }
      const pendingEntry = pendingItems[i];
      const skill = pendingEntry.skill || pendingEntry;

      if (!pendingEntry.forceMigrate) {
        const prev = migratedMap[skill.id];
        const alreadyInLedger = Boolean(prev && prev.version === skill.version && prev.hash === skill.hash);
        const alreadyInCustomizeSkills = Boolean(
          installedCards.length > 0
          && !skill.isCustomized
          && sgMatchInstalledSkillCard(skill, installedCards)
        );
        if (alreadyInLedger || alreadyInCustomizeSkills) {
          await sgCheckpointMigratedSkill(accountInfo.accountKey, bundleVersion, skill);
          completed++;
          hud.update(completed, skill.name, "Skipped (already installed in /customize/skills)");
          continue;
        }
      }

      hud.update(completed, skill.name, "Waiting for composer...");

      let waitIdle = 0;
      while (sgIsGeminiGeneratingNow() && waitIdle < 30 && !_sgMigrationAborted) {
        await sgSleep(500);
        waitIdle++;
      }
      if (_sgMigrationAborted) {
        hud.finish(completed, `Stopped by user. ${completed} skill(s) checkpointed.`, true);
        return;
      }
      if (!findPromptInput()) {
        hud.finish(completed, "Composer unavailable. Remaining skills were not migrated.", true);
        showToast("Migration paused: composer not found.", "error");
        return;
      }

      hud.update(completed, skill.name, "Sending prompt...");
      const initialResponses = document.querySelectorAll("model-response").length;
      setPromptText(sgBuildMigrationPrompt(skill));
      await sgSleep(160);
      if (_sgMigrationAborted) {
        hud.finish(completed, `Stopped by user. ${completed} skill(s) checkpointed.`, true);
        return;
      }

      clickSendButton();
      hud.update(completed, skill.name, "Waiting for Gemini response...");
      const turnResult = await sgWaitForTurnCompletion(initialResponses, 90000);

      if (!turnResult.ok) {
        const msg = turnResult.reason === "aborted"
          ? `Stopped by user. ${completed} skill(s) checkpointed.`
          : `Failed on "${skill.name}" (${turnResult.reason}). ${completed} skill(s) checkpointed.`;
        hud.finish(completed, msg, true);
        showToast(msg, turnResult.reason === "aborted" ? "info" : "error");
        return;
      }

      const saved = await sgCheckpointMigratedSkill(accountInfo.accountKey, bundleVersion, skill);
      if (!saved) {
        hud.finish(completed, "Failed to save checkpoint to local storage.", true);
        return;
      }
      completed++;
      hud.update(completed, skill.name, "Checkpointed");
      const remSet = _sgRemovedSkillsByAccount.get(accountInfo.accountKey);
      if (remSet) remSet.delete(skill.id);
      const remIdxSet = _sgRemovedSkillsByAccount.get(`u_${accountInfo.index}`);
      if (remIdxSet) remIdxSet.delete(skill.id);
      if (i < total - 1 && !_sgMigrationAborted) {
        await sgSleep(800);
      }
    }
    _sgScannedUserSkillsByAccount.delete(accountInfo.accountKey);
    _sgScannedUserSkillsByAccount.delete(`u_${accountInfo.index}`);
    sgUpdateSkillsMissingBadge(0);
    hud.finish(completed, `All ${completed} skill(s) migrated and checkpointed for ${accountInfo.label}.`, false);
    showToast(`Migrated ${completed} skill(s) to ${accountInfo.label}.`, "success");
  } finally {
    _sgMigrationRunning = false;
  }
}

function sgGetSavedInfoUrl() {
  const index = typeof getGoogleAccountIndex === "function" ? getGoogleAccountIndex() : null;
  return index ? `https://gemini.google.com/u/${index}/saved-info` : "https://gemini.google.com/saved-info";
}

function isOnSavedInfoPage() {
  return /^\/(?:u\/\d+\/)?saved-info(?:\/|$)/.test(window.location.pathname);
}

function sgComputeBaselineMigrationDiff(instructions, ledger, accountInfo, existingDomTexts = null) {
  const info = accountInfo || sgGetCurrentAccountInfo();
  const migratedMap = sgGetMergedAccountMigratedMap(ledger, info);
  const savedPool = existingDomTexts !== null
    ? existingDomTexts
    : sgGetCachedSavedInfoTextsForAccount(info);
  const hasSavedPool = savedPool && ((savedPool instanceof Set && savedPool.size > 0) || (Array.isArray(savedPool) && savedPool.length > 0));
  const pending = [];
  const synced = [];
  const duplicates = [];
  const statusById = {};

  for (const item of instructions) {
    if (!item || !item.enabled || !String(item.text || "").trim()) {
      if (item && item.id) statusById[item.id] = "excluded";
      continue;
    }
    const prev = migratedMap[item.id];
    const inSavedInfo = Boolean(hasSavedPool && sgDoesSavedInfoContainBaseline(item, savedPool));
    const ledgerSynced = Boolean(prev && prev.version === item.version && prev.hash === item.hash);

    if (inSavedInfo) {
      statusById[item.id] = "duplicate";
      duplicates.push(item);
      if (ledgerSynced) synced.push(item);
      continue;
    }
    if (!prev) {
      statusById[item.id] = "new";
      pending.push({ item, reason: "new" });
    } else if (prev.version !== item.version || prev.hash !== item.hash) {
      statusById[item.id] = "updated";
      pending.push({ item, reason: "updated" });
    } else {
      statusById[item.id] = "synced";
      synced.push(item);
    }
  }

  return {
    accountKey: info.accountKey,
    accountLabel: info.label,
    pending,
    synced,
    duplicates,
    statusById,
    totalEligible: pending.length + synced.length + duplicates.filter(d => !synced.includes(d)).length
  };
}

async function sgCheckpointMigratedBaseline(accountKey, bundleVersion, item) {
  if (!accountKey || SG_SKILL_FORBIDDEN_KEYS.has(accountKey) || !item || !item.id || SG_SKILL_FORBIDDEN_KEYS.has(item.id)) {
    return false;
  }
  const { ledger } = await sgReadLocalBaselineStorage();
  const nextLedger = { ...ledger };
  const prevAcct = nextLedger[accountKey] && typeof nextLedger[accountKey] === "object"
    ? nextLedger[accountKey]
    : { bundleVersion, migrated: {} };
  nextLedger[accountKey] = {
    bundleVersion,
    migrated: {
      ...(prevAcct.migrated || {}),
      [item.id]: {
        version: item.version,
        hash: item.hash || sgComputeBaselineHash(item),
        migratedAt: new Date().toISOString()
      }
    }
  };
  const ok = await safeLocalStorageSet({ [SG_BASELINE_LEDGER_KEY]: nextLedger });
  if (ok) sgBaselineMigrationLedger = nextLedger;
  return ok;
}

async function sgCheckpointMigratedBaselinesBatch(accountKey, bundleVersion, itemsToSave) {
  if (!accountKey || SG_SKILL_FORBIDDEN_KEYS.has(accountKey) || !Array.isArray(itemsToSave) || !itemsToSave.length) {
    return false;
  }
  const { ledger } = await sgReadLocalBaselineStorage();
  const nextLedger = { ...ledger };
  const prevAcct = nextLedger[accountKey] && typeof nextLedger[accountKey] === "object"
    ? nextLedger[accountKey]
    : { bundleVersion, migrated: {} };
  const nextMigrated = { ...(prevAcct.migrated || {}) };
  let changed = false;
  const nowIso = new Date().toISOString();

  for (const item of itemsToSave) {
    if (!item || !item.id || SG_SKILL_FORBIDDEN_KEYS.has(item.id)) continue;
    const h = item.hash || sgComputeBaselineHash(item);
    const existing = nextMigrated[item.id];
    if (!existing || existing.version !== item.version || existing.hash !== h) {
      nextMigrated[item.id] = {
        version: item.version,
        hash: h,
        migratedAt: (existing && existing.migratedAt) || nowIso
      };
      changed = true;
    }
  }

  if (!changed) {
    sgBaselineMigrationLedger = nextLedger;
    return true;
  }

  nextLedger[accountKey] = {
    bundleVersion: bundleVersion || prevAcct.bundleVersion || "1.1.0",
    migrated: nextMigrated
  };
  const ok = await safeLocalStorageSet({ [SG_BASELINE_LEDGER_KEY]: nextLedger });
  if (ok) sgBaselineMigrationLedger = nextLedger;
  return ok;
}

async function sgResetBaselineAccountLedger(accountKey, accountInfo = null) {
  if (!accountKey || SG_SKILL_FORBIDDEN_KEYS.has(accountKey)) return false;
  const { ledger } = await sgReadLocalBaselineStorage();
  const nextLedger = { ...ledger };
  const keysToClear = sgGetMatchingAccountLedgerKeys(nextLedger, accountInfo || { accountKey, index: (String(accountKey || "").match(/^u_(\d+)/) || [])[1] || "0" });
  delete nextLedger[accountKey];
  for (const k of keysToClear) {
    delete nextLedger[k];
    _sgScannedSavedInfoByAccount.delete(k);
  }
  _sgScannedSavedInfoByAccount.delete(accountKey);
  const ok = await safeLocalStorageSet({ [SG_BASELINE_LEDGER_KEY]: nextLedger });
  if (ok) sgBaselineMigrationLedger = nextLedger;
  return ok;
}

async function sgReconcileAndCheckpointSavedItems(skills, baselines, accountInfo, bundleVersion, baselineBundleVersion, extraSavedTexts = null) {
  const info = accountInfo || sgGetCurrentAccountInfo();
  const savedPool = sgGetCachedSavedInfoTextsForAccount(info);
  if (extraSavedTexts) {
    for (const t of extraSavedTexts) {
      if (t) savedPool.add(sgNormalizeInstructionText(t));
    }
  }

  const mergedSkillLedger = sgGetMergedAccountMigratedMap(sgSkillMigrationLedger, info);
  const mergedBaselineLedger = sgGetMergedAccountMigratedMap(sgBaselineMigrationLedger, info);

  const matchedSkills = [];
  const autoDisabledSkillIds = [];
  for (const s of skills || []) {
    if (!s || !s.id) continue;
    const prev = mergedSkillLedger[s.id];
    const inLedger = Boolean(prev && prev.version === s.version && prev.hash === s.hash);
    const inSavedInfo = Boolean(
      savedPool.size > 0
      && (!prev || inLedger || !s.isCustomized)
      && sgDoesSavedInfoContainSkill(s, savedPool, baselines)
    );
    if (inLedger || inSavedInfo) {
      matchedSkills.push(s);
      autoDisabledSkillIds.push(s.id);
    }
  }

  const matchedBaselines = [];
  const autoDisabledBaselineIds = [];
  for (const b of baselines || []) {
    if (!b || !b.id) continue;
    const prev = mergedBaselineLedger[b.id];
    const inLedger = Boolean(prev && prev.version === b.version && prev.hash === b.hash);
    const inSavedInfo = Boolean(savedPool.size > 0 && sgDoesSavedInfoContainBaseline(b, savedPool));
    if (inLedger || inSavedInfo) {
      matchedBaselines.push(b);
      autoDisabledBaselineIds.push(b.id);
    }
  }

  if (matchedSkills.length > 0) {
    await sgCheckpointMigratedSkillsBatch(info.accountKey, bundleVersion, matchedSkills);
  }
  if (matchedBaselines.length > 0) {
    await sgCheckpointMigratedBaselinesBatch(info.accountKey, baselineBundleVersion, matchedBaselines);
  }

  return {
    accountKey: info.accountKey,
    savedPoolSize: savedPool.size,
    autoDisabledSkillIds,
    autoDisabledBaselineIds,
    matchedSkillsCount: matchedSkills.length,
    matchedBaselinesCount: matchedBaselines.length
  };
}

function sgRequestRemoteSavedInfoScan(accountInfo, options = {}) {
  const info = accountInfo || sgGetCurrentAccountInfo();
  if (isOnSavedInfoPage()) {
    const entries = [...sgReadExistingSavedInfoTexts()];
    const record = { entries, verified: true, scannedAt: Date.now(), source: "current_tab" };
    _sgScannedSavedInfoByAccount.set(info.accountKey, record);
    _sgScannedSavedInfoByAccount.set(`u_${info.index}`, record);
    return Promise.resolve({ ok: true, verified: true, entries, source: "current_tab" });
  }

  return new Promise(resolve => {
    try {
      if (typeof chrome === "undefined" || !chrome.runtime || typeof chrome.runtime.sendMessage !== "function") {
        resolve({ ok: false, verified: false, entries: [] });
        return;
      }
      chrome.runtime.sendMessage({
        type: "SCAN_SAVED_INFO_ENTRIES",
        url: sgGetSavedInfoUrl(),
        accountIndex: info.index,
        forceFresh: Boolean(options && options.forceFresh)
      }, resp => {
        if (chrome.runtime.lastError || !resp || !resp.ok) {
          resolve({ ok: false, verified: false, entries: [] });
          return;
        }
        const entries = Array.isArray(resp.entries) ? resp.entries : [];
        const record = {
          entries,
          verified: resp.verified !== false,
          email: resp.email || null,
          scannedAt: resp.scannedAt || Date.now(),
          source: resp.source || "bg_tab"
        };
        _sgScannedSavedInfoByAccount.set(info.accountKey, record);
        _sgScannedSavedInfoByAccount.set(`u_${info.index}`, record);
        if (resp.email) {
          _sgScannedSavedInfoByAccount.set(`u_${info.index}:${String(resp.email).toLowerCase()}`, record);
        }
        resolve({ ok: true, verified: record.verified, entries, email: record.email, source: record.source, scannedAt: record.scannedAt });
      });
    } catch (err) {
      resolve({ ok: false, verified: false, entries: [] });
    }
  });
}

async function sgWaitForCustomizeSkillsHydration(timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const snap = sgReadInstalledCustomizeSkillsFromDom();
    if (snap.hydrated) return snap;
    await sgSleep(300);
  }
  return sgReadInstalledCustomizeSkillsFromDom();
}

async function sgRequestRemoteUserSkillsScan(accountInfo, options = {}) {
  const info = accountInfo || sgGetCurrentAccountInfo();
  if (isOnCustomizeSkillsPage()) {
    const snap = await sgWaitForCustomizeSkillsHydration(5000);
    const record = {
      ok: Boolean(snap.hydrated),
      verified: Boolean(snap.hydrated),
      skills: Array.isArray(snap.skills) ? snap.skills : [],
      totalCards: Number(snap.totalCards || 0),
      sectionsCount: Number(snap.sectionsCount || 0),
      email: info.email || null,
      source: "current_tab",
      scannedAt: Date.now(),
      bundleVersion: String(options && options.bundleVersion || "")
    };
    if (record.verified) {
      sgStoreScannedUserSkillsRecord(info, record);
    }
    return record;
  }

  return new Promise(resolve => {
    try {
      if (typeof chrome === "undefined" || !chrome.runtime || typeof chrome.runtime.sendMessage !== "function") {
        resolve({ ok: false, verified: false, skills: [], source: "unavailable" });
        return;
      }
      chrome.runtime.sendMessage({
        type: "SCAN_USER_SKILLS_ENTRIES",
        url: sgGetCustomizeSkillsUrl(),
        accountIndex: info.index,
        forceFresh: Boolean(options && options.forceFresh),
        bundleVersion: String(options && options.bundleVersion || "")
      }, resp => {
        if (chrome.runtime.lastError || !resp || !resp.ok) {
          resolve({
            ok: false,
            verified: false,
            skills: [],
            source: (resp && resp.source) || "error",
            error: (chrome.runtime.lastError && chrome.runtime.lastError.message) || (resp && resp.error) || "scan_failed"
          });
          return;
        }
        const record = {
          ok: true,
          verified: resp.verified === true,
          skills: Array.isArray(resp.skills) ? resp.skills : [],
          totalCards: Number(resp.totalCards || 0),
          sectionsCount: Number(resp.sectionsCount || 0),
          email: resp.email || info.email || null,
          source: resp.source || "bg_tab",
          scannedAt: resp.scannedAt || Date.now(),
          bundleVersion: String(resp.bundleVersion || (options && options.bundleVersion) || "")
        };
        if (record.verified) {
          sgStoreScannedUserSkillsRecord(info, record);
        }
        resolve(record);
      });
    } catch (err) {
      resolve({ ok: false, verified: false, skills: [], source: "error", error: String(err && err.message || err) });
    }
  });
}

function sgBuildBundledSkillsAuditSummary(skills, diff, scanRecord, bundleVersion = "") {
  const bundledEligible = (skills || []).filter(s => s && s.isBundled && s.enabled && (s.mode === "both" || s.mode === "bootstrap"));
  const installedBundled = [];
  const missingBundled = [];
  const outdatedBundled = [];
  const removedBundled = [];

  for (const s of bundledEligible) {
    const st = diff && diff.statusById ? diff.statusById[s.id] : "new";
    if (st === "synced" || st === "duplicate") {
      installedBundled.push(s);
    } else if (st === "updated") {
      outdatedBundled.push(s);
    } else if (st === "removed") {
      removedBundled.push(s);
      missingBundled.push(s);
    } else if (st === "new") {
      missingBundled.push(s);
    }
  }

  return {
    bundleVersion: String(bundleVersion || ""),
    totalBundled: bundledEligible.length,
    installedCount: installedBundled.length,
    installedBundled,
    missingBundled,
    outdatedBundled,
    removedBundled,
    verified: Boolean(scanRecord && scanRecord.verified === true),
    source: (scanRecord && scanRecord.source) || "ledger",
    scannedAt: (scanRecord && scanRecord.scannedAt) || Date.now(),
    remoteInstalledCount: scanRecord && Array.isArray(scanRecord.skills) ? scanRecord.skills.length : 0
  };
}

async function sgReconcileBundledSkillsWithAccount(skills, accountInfo, bundleVersion, scanRecord) {
  const baseInfo = accountInfo || sgGetCurrentAccountInfo();
  const effectiveEmail = baseInfo.email || (scanRecord && scanRecord.email) || null;
  const info = effectiveEmail && !baseInfo.email
    ? {
        ...baseInfo,
        email: effectiveEmail,
        accountKey: `u_${baseInfo.index}:${effectiveEmail}`,
        label: `${effectiveEmail} (/u/${baseInfo.index})`
      }
    : baseInfo;

  const verified = Boolean(scanRecord && scanRecord.verified === true && Array.isArray(scanRecord.skills));
  const installedCards = verified ? scanRecord.skills : [];
  const mergedLedger = sgGetMergedAccountMigratedMap(sgSkillMigrationLedger, info);

  const matchedSkillsToCheckpoint = [];
  const removedSkillIds = [];

  if (verified) {
    for (const s of skills || []) {
      if (!s || !s.id || !s.enabled || (s.mode !== "bootstrap" && s.mode !== "both")) continue;
      const prev = mergedLedger[s.id];
      const matchedCard = sgMatchInstalledSkillCard(s, installedCards);

      if (matchedCard) {
        if (!prev || (!s.isCustomized && (prev.version !== s.version || prev.hash !== s.hash))) {
          matchedSkillsToCheckpoint.push(s);
        }
      } else if (prev) {
        removedSkillIds.push(s.id);
      }
    }

    if (matchedSkillsToCheckpoint.length > 0) {
      await sgCheckpointMigratedSkillsBatch(info.accountKey, bundleVersion, matchedSkillsToCheckpoint);
    }
    if (removedSkillIds.length > 0) {
      await sgPruneRemovedSkillsFromLedger(info, removedSkillIds);
    }

    const removedSet = new Set(removedSkillIds);
    _sgRemovedSkillsByAccount.set(info.accountKey, removedSet);
    _sgRemovedSkillsByAccount.set(`u_${info.index}`, removedSet);
  }

  const diff = sgComputeMigrationDiff(skills, sgSkillMigrationLedger, info, null, sgEffectiveBaselines, verified ? scanRecord : null);
  const audit = sgBuildBundledSkillsAuditSummary(skills, diff, scanRecord, bundleVersion);
  _sgLastBundledSkillsAudit = { accountKey: info.accountKey, diff, audit };
  sgUpdateSkillsMissingBadge(audit.missingBundled.length + audit.outdatedBundled.length);

  return { info, diff, audit, checkpointedCount: matchedSkillsToCheckpoint.length, removedSkillIds };
}

function sgUpdateSkillsMissingBadge(missingCount) {
  if (typeof document === "undefined" || !document.querySelectorAll) return;
  const count = Math.max(0, Number(missingCount) || 0);
  const targets = document.querySelectorAll('#sg-skills-menu-item, [data-test-id="sg-native-skills"]');
  targets.forEach(el => {
    if (!el) return;
    if (count > 0) {
      el.classList.add("sg-has-missing-skills");
      el.setAttribute("data-sg-missing-skills", String(count));
    } else {
      el.classList.remove("sg-has-missing-skills");
      el.removeAttribute("data-sg-missing-skills");
    }
  });
}

function sgIsBackgroundOrTempWorkerPage() {
  try {
    if ("undefined" != typeof SG_IS_SILENT_BG_WORKER_TAB && SG_IS_SILENT_BG_WORKER_TAB) return true;
    if (typeof document !== "undefined" && document.body && document.body.dataset && document.body.dataset.sgBgWorker === "true") {
      return true;
    }
    const href = typeof window !== "undefined" && window.location ? String(window.location.href || "") : "";
    if (/temporary-chat|sg_(?:orch|bg)_worker=1/i.test(href)) return true;
  } catch (_e) {}
  return false;
}

async function sgRunPageLoadBundledSkillsAudit(options = {}) {
  if (_sgPageLoadBundledAuditRan && !options.force) return null;
  if (sgIsBackgroundOrTempWorkerPage()) return null;
  _sgPageLoadBundledAuditRan = true;

  try {
    const skillData = await loadEffectiveSkills();
    if (!skillData || !Array.isArray(skillData.skills) || !skillData.skills.length) return null;
    const accountInfo = sgGetCurrentAccountInfo();
    const scanRecord = await sgRequestRemoteUserSkillsScan(accountInfo, {
      forceFresh: Boolean(options.forceFresh),
      bundleVersion: skillData.bundleVersion
    });
    const res = await sgReconcileBundledSkillsWithAccount(
      skillData.skills,
      accountInfo,
      skillData.bundleVersion,
      scanRecord
    );
    return res;
  } catch (_err) {
    return null;
  }
}

async function sgAutoSyncCustomizeSkillsPageOnOpen() {
  if (!isOnCustomizeSkillsPage() || sgIsBackgroundOrTempWorkerPage()) return null;
  const skillData = await loadEffectiveSkills();
  const accountInfo = sgGetCurrentAccountInfo();
  const scanRecord = await sgRequestRemoteUserSkillsScan(accountInfo, {
    forceFresh: true,
    bundleVersion: skillData.bundleVersion
  });
  if (!scanRecord || !scanRecord.verified) return null;
  const res = await sgReconcileBundledSkillsWithAccount(
    skillData.skills,
    accountInfo,
    skillData.bundleVersion,
    scanRecord
  );
  if (typeof _sgSkillsModalState.refresh === "function") {
    _sgSkillsModalState.refresh();
  }
  return res;
}
