const SG_PERIODIC_STORAGE_KEY = "sg_periodic_model_state";
const SG_PERIODIC_DISCOVERED_KEY = "sg_periodic_discovered_models";
const SG_PERIODIC_LEVELS_KEY = "sg_periodic_thinking_levels";
const SG_PERIODIC_MAX_THINKING_LEVELS = 6;
const SG_PERIODIC_SVG_NS = "http://www.w3.org/2000/svg";

const SG_PERIODIC_ACCENT_PALETTE = Object.freeze([
  "blue", "purple", "teal", "amber", "rose", "emerald", "indigo", "cyan"
]);

const SG_PERIODIC_CATEGORIES = Object.freeze({
  nm: "Reactive nonmetal",
  ng: "Noble gas",
  am: "Alkali metal",
  ae: "Alkaline earth metal",
  md: "Metalloid",
  tm: "Transition metal",
  pt: "Post-transition metal",
  ln: "Lanthanide",
  ac: "Actinide"
});

const SG_PERIODIC_GAS_SYMBOLS = new Set(["H", "He", "N", "O", "F", "Ne", "Cl", "Ar", "Kr", "Xe", "Rn"]);
const SG_PERIODIC_LIQUID_SYMBOLS = new Set(["Br", "Hg"]);

const SG_PERIODIC_DEFAULT_THINKING_LEVELS = Object.freeze([
  Object.freeze({ value: "low", label: "Low" }),
  Object.freeze({ value: "medium", label: "Medium" }),
  Object.freeze({ value: "high", label: "High" })
]);

const SG_PERIODIC_RELEASED = Object.freeze({
  H: Object.freeze({
    title: "Gemini 4 Hydrogen",
    subtitle: "Everyday help",
    description: "Fast, responsive model tuned for everyday answers, quick writing, summaries, and lightweight reasoning.",
    accent: "blue",
    realMode: "fast"
  }),
  C: Object.freeze({
    title: "Gemini 4 Carbon",
    subtitle: "Most complex work",
    description: "Flagship high-capability model built for complex multi-step reasoning, architecture, research, and deep analysis.",
    accent: "purple",
    realMode: "pro"
  }),
  Ar: Object.freeze({
    title: "Gemini 4 Argon",
    subtitle: "Code and analysis",
    description: "Structured reasoning specialist designed for coding, debugging, math, and methodical technical analysis.",
    accent: "teal",
    realMode: "thinking"
  })
});

const SG_PERIODIC_OTHER_MODELS = Object.freeze([
  Object.freeze({ id: "flash-lite", label: "Flash-Lite", realMode: "fast" }),
  Object.freeze({ id: "3.1-pro", label: "3.1 Pro", realMode: "pro" })
]);

const SG_PERIODIC_ELEMENTS = Object.freeze([
  [1, "H", "Hydrogen", 1, 1, "1.008", "nm"],
  [2, "He", "Helium", 18, 1, "4.0026", "ng"],
  [3, "Li", "Lithium", 1, 2, "6.94", "am"],
  [4, "Be", "Beryllium", 2, 2, "9.0122", "ae"],
  [5, "B", "Boron", 13, 2, "10.81", "md"],
  [6, "C", "Carbon", 14, 2, "12.011", "nm"],
  [7, "N", "Nitrogen", 15, 2, "14.007", "nm"],
  [8, "O", "Oxygen", 16, 2, "15.999", "nm"],
  [9, "F", "Fluorine", 17, 2, "18.998", "nm"],
  [10, "Ne", "Neon", 18, 2, "20.180", "ng"],
  [11, "Na", "Sodium", 1, 3, "22.990", "am"],
  [12, "Mg", "Magnesium", 2, 3, "24.305", "ae"],
  [13, "Al", "Aluminum", 13, 3, "26.982", "pt"],
  [14, "Si", "Silicon", 14, 3, "28.085", "md"],
  [15, "P", "Phosphorus", 15, 3, "30.974", "nm"],
  [16, "S", "Sulfur", 16, 3, "32.06", "nm"],
  [17, "Cl", "Chlorine", 17, 3, "35.45", "nm"],
  [18, "Ar", "Argon", 18, 3, "39.948", "ng"],
  [19, "K", "Potassium", 1, 4, "39.098", "am"],
  [20, "Ca", "Calcium", 2, 4, "40.078", "ae"],
  [21, "Sc", "Scandium", 3, 4, "44.956", "tm"],
  [22, "Ti", "Titanium", 4, 4, "47.867", "tm"],
  [23, "V", "Vanadium", 5, 4, "50.942", "tm"],
  [24, "Cr", "Chromium", 6, 4, "51.996", "tm"],
  [25, "Mn", "Manganese", 7, 4, "54.938", "tm"],
  [26, "Fe", "Iron", 8, 4, "55.845", "tm"],
  [27, "Co", "Cobalt", 9, 4, "58.933", "tm"],
  [28, "Ni", "Nickel", 10, 4, "58.693", "tm"],
  [29, "Cu", "Copper", 11, 4, "63.546", "tm"],
  [30, "Zn", "Zinc", 12, 4, "65.38", "tm"],
  [31, "Ga", "Gallium", 13, 4, "69.723", "pt"],
  [32, "Ge", "Germanium", 14, 4, "72.630", "md"],
  [33, "As", "Arsenic", 15, 4, "74.922", "md"],
  [34, "Se", "Selenium", 16, 4, "78.971", "nm"],
  [35, "Br", "Bromine", 17, 4, "79.904", "nm"],
  [36, "Kr", "Krypton", 18, 4, "83.798", "ng"],
  [37, "Rb", "Rubidium", 1, 5, "85.468", "am"],
  [38, "Sr", "Strontium", 2, 5, "87.62", "ae"],
  [39, "Y", "Yttrium", 3, 5, "88.906", "tm"],
  [40, "Zr", "Zirconium", 4, 5, "91.224", "tm"],
  [41, "Nb", "Niobium", 5, 5, "92.906", "tm"],
  [42, "Mo", "Molybdenum", 6, 5, "95.95", "tm"],
  [43, "Tc", "Technetium", 7, 5, "[98]", "tm"],
  [44, "Ru", "Ruthenium", 8, 5, "101.07", "tm"],
  [45, "Rh", "Rhodium", 9, 5, "102.91", "tm"],
  [46, "Pd", "Palladium", 10, 5, "106.42", "tm"],
  [47, "Ag", "Silver", 11, 5, "107.87", "tm"],
  [48, "Cd", "Cadmium", 12, 5, "112.41", "tm"],
  [49, "In", "Indium", 13, 5, "114.82", "pt"],
  [50, "Sn", "Tin", 14, 5, "118.71", "pt"],
  [51, "Sb", "Antimony", 15, 5, "121.76", "md"],
  [52, "Te", "Tellurium", 16, 5, "127.60", "md"],
  [53, "I", "Iodine", 17, 5, "126.90", "nm"],
  [54, "Xe", "Xenon", 18, 5, "131.29", "ng"],
  [55, "Cs", "Cesium", 1, 6, "132.91", "am"],
  [56, "Ba", "Barium", 2, 6, "137.33", "ae"],
  [57, "La", "Lanthanum", 4, 8, "138.91", "ln"],
  [58, "Ce", "Cerium", 5, 8, "140.12", "ln"],
  [59, "Pr", "Praseodymium", 6, 8, "140.91", "ln"],
  [60, "Nd", "Neodymium", 7, 8, "144.24", "ln"],
  [61, "Pm", "Promethium", 8, 8, "[145]", "ln"],
  [62, "Sm", "Samarium", 9, 8, "150.36", "ln"],
  [63, "Eu", "Europium", 10, 8, "151.96", "ln"],
  [64, "Gd", "Gadolinium", 11, 8, "157.25", "ln"],
  [65, "Tb", "Terbium", 12, 8, "158.93", "ln"],
  [66, "Dy", "Dysprosium", 13, 8, "162.50", "ln"],
  [67, "Ho", "Holmium", 14, 8, "164.93", "ln"],
  [68, "Er", "Erbium", 15, 8, "167.26", "ln"],
  [69, "Tm", "Thulium", 16, 8, "168.93", "ln"],
  [70, "Yb", "Ytterbium", 17, 8, "173.05", "ln"],
  [71, "Lu", "Lutetium", 18, 8, "174.97", "ln"],
  [72, "Hf", "Hafnium", 4, 6, "178.49", "tm"],
  [73, "Ta", "Tantalum", 5, 6, "180.95", "tm"],
  [74, "W", "Tungsten", 6, 6, "183.84", "tm"],
  [75, "Re", "Rhenium", 7, 6, "186.21", "tm"],
  [76, "Os", "Osmium", 8, 6, "190.23", "tm"],
  [77, "Ir", "Iridium", 9, 6, "192.22", "tm"],
  [78, "Pt", "Platinum", 10, 6, "195.08", "tm"],
  [79, "Au", "Gold", 11, 6, "196.97", "tm"],
  [80, "Hg", "Mercury", 12, 6, "200.59", "tm"],
  [81, "Tl", "Thallium", 13, 6, "204.38", "pt"],
  [82, "Pb", "Lead", 14, 6, "207.2", "pt"],
  [83, "Bi", "Bismuth", 15, 6, "208.98", "pt"],
  [84, "Po", "Polonium", 16, 6, "[209]", "pt"],
  [85, "At", "Astatine", 17, 6, "[210]", "md"],
  [86, "Rn", "Radon", 18, 6, "[222]", "ng"],
  [87, "Fr", "Francium", 1, 7, "[223]", "am"],
  [88, "Ra", "Radium", 2, 7, "[226]", "ae"],
  [89, "Ac", "Actinium", 4, 9, "[227]", "ac"],
  [90, "Th", "Thorium", 5, 9, "232.04", "ac"],
  [91, "Pa", "Protactinium", 6, 9, "231.04", "ac"],
  [92, "U", "Uranium", 7, 9, "238.03", "ac"],
  [93, "Np", "Neptunium", 8, 9, "[237]", "ac"],
  [94, "Pu", "Plutonium", 9, 9, "[244]", "ac"],
  [95, "Am", "Americium", 10, 9, "[243]", "ac"],
  [96, "Cm", "Curium", 11, 9, "[247]", "ac"],
  [97, "Bk", "Berkelium", 12, 9, "[247]", "ac"],
  [98, "Cf", "Californium", 13, 9, "[251]", "ac"],
  [99, "Es", "Einsteinium", 14, 9, "[252]", "ac"],
  [100, "Fm", "Fermium", 15, 9, "[257]", "ac"],
  [101, "Md", "Mendelevium", 16, 9, "[258]", "ac"],
  [102, "No", "Nobelium", 17, 9, "[259]", "ac"],
  [103, "Lr", "Lawrencium", 18, 9, "[266]", "ac"],
  [104, "Rf", "Rutherfordium", 4, 7, "[267]", "tm"],
  [105, "Db", "Dubnium", 5, 7, "[268]", "tm"],
  [106, "Sg", "Seaborgium", 6, 7, "[269]", "tm"],
  [107, "Bh", "Bohrium", 7, 7, "[270]", "tm"],
  [108, "Hs", "Hassium", 8, 7, "[277]", "tm"],
  [109, "Mt", "Meitnerium", 9, 7, "[278]", "tm"],
  [110, "Ds", "Darmstadtium", 10, 7, "[281]", "tm"],
  [111, "Rg", "Roentgenium", 11, 7, "[282]", "tm"],
  [112, "Cn", "Copernicium", 12, 7, "[285]", "tm"],
  [113, "Nh", "Nihonium", 13, 7, "[286]", "pt"],
  [114, "Fl", "Flerovium", 14, 7, "[289]", "pt"],
  [115, "Mc", "Moscovium", 15, 7, "[290]", "pt"],
  [116, "Lv", "Livermorium", 16, 7, "[293]", "pt"],
  [117, "Ts", "Tennessine", 17, 7, "[294]", "pt"],
  [118, "Og", "Oganesson", 18, 7, "[294]", "ng"]
]);

const SG_PERIODIC_SUPERSCRIPT = Object.freeze({
  "0": "\u2070", "1": "\u00B9", "2": "\u00B2", "3": "\u00B3", "4": "\u2074",
  "5": "\u2075", "6": "\u2076", "7": "\u2077", "8": "\u2078", "9": "\u2079"
});

const SG_PERIODIC_CONFIG_EXCEPTIONS = Object.freeze({
  24: "[Ar] 3d5 4s1", 29: "[Ar] 3d10 4s1", 41: "[Kr] 4d4 5s1", 42: "[Kr] 4d5 5s1",
  44: "[Kr] 4d7 5s1", 45: "[Kr] 4d8 5s1", 46: "[Kr] 4d10", 47: "[Kr] 4d10 5s1",
  57: "[Xe] 5d1 6s2", 58: "[Xe] 4f1 5d1 6s2", 64: "[Xe] 4f7 5d1 6s2",
  78: "[Xe] 4f14 5d9 6s1", 79: "[Xe] 4f14 5d10 6s1",
  89: "[Rn] 6d1 7s2", 90: "[Rn] 6d2 7s2", 91: "[Rn] 5f2 6d1 7s2", 92: "[Rn] 5f3 6d1 7s2",
  93: "[Rn] 5f4 6d1 7s2", 96: "[Rn] 5f7 6d1 7s2", 103: "[Rn] 5f14 7s2 7p1"
});

function sgPeriodicElectronConfig(z) {
  const toSup = n => String(n).split("").map(d => SG_PERIODIC_SUPERSCRIPT[d] || d).join("");
  if (SG_PERIODIC_CONFIG_EXCEPTIONS[z]) {
    return SG_PERIODIC_CONFIG_EXCEPTIONS[z].replace(/([spdf])(\d+)/g, (_, o, n) => o + toSup(n));
  }
  const cores = [[86, "[Rn]"], [54, "[Xe]"], [36, "[Kr]"], [18, "[Ar]"], [10, "[Ne]"], [2, "[He]"]];
  const orbitals = [
    ["1s", 2], ["2s", 2], ["2p", 6], ["3s", 2], ["3p", 6], ["4s", 2], ["3d", 10], ["4p", 6],
    ["5s", 2], ["4d", 10], ["5p", 6], ["6s", 2], ["4f", 14], ["5d", 10], ["6p", 6], ["7s", 2],
    ["5f", 14], ["6d", 10], ["7p", 6]
  ];
  const core = cores.find(([cz]) => z > cz);
  let rem = z;
  const filled = [];
  for (const [orb, cap] of orbitals) {
    if (rem <= 0) break;
    const take = Math.min(rem, cap);
    filled.push([orb, take]);
    rem -= take;
  }
  let skip = core ? core[0] : 0;
  const valence = [];
  for (const [orb, take] of filled) {
    if (skip >= take) { skip -= take; continue; }
    valence.push([orb, take - skip]);
    skip = 0;
  }
  const lOrd = { s: 0, p: 1, d: 2, f: 3 };
  valence.sort((a, b) => Number(a[0][0]) - Number(b[0][0]) || lOrd[a[0][1]] - lOrd[b[0][1]]);
  const parts = core ? [core[1]] : [];
  for (const [orb, cnt] of valence) parts.push(orb + toSup(cnt));
  return parts.join(" ");
}

function sgPeriodicBlockForElement(z, group, period) {
  if (z === 2 || group <= 2) return "s-block";
  if (period >= 8) return "f-block";
  if (group >= 3 && group <= 12) return "d-block";
  return "p-block";
}

function sgPeriodicPhaseForElement(z, symbol) {
  if (SG_PERIODIC_GAS_SYMBOLS.has(symbol)) return "Gas";
  if (SG_PERIODIC_LIQUID_SYMBOLS.has(symbol)) return "Liquid";
  if (z >= 104) return "Synthetic";
  return "Solid";
}

const SG_PERIODIC_BY_SYMBOL = new Map(
  SG_PERIODIC_ELEMENTS.map(([z, symbol, name, group, period, mass, catCode]) => {
    const releasedMeta = SG_PERIODIC_RELEASED[symbol] || null;
    const category = SG_PERIODIC_CATEGORIES[catCode] || "Element";
    const phase = sgPeriodicPhaseForElement(z, symbol);
    const block = sgPeriodicBlockForElement(z, group, period);
    const config = sgPeriodicElectronConfig(z);
    const displayPeriod = period === 8 ? 6 : (period === 9 ? 7 : period);
    const positionLabel = period === 8
      ? "Lanthanide \u00B7 Period 6"
      : period === 9
        ? "Actinide \u00B7 Period 7"
        : `Group ${group} \u00B7 Period ${displayPeriod}`;
    return [symbol, Object.freeze({
      z,
      symbol,
      name,
      group,
      period,
      displayPeriod,
      mass: `${mass} u`,
      category,
      phase,
      block,
      config,
      positionLabel,
      released: Boolean(releasedMeta),
      title: releasedMeta ? releasedMeta.title : name,
      subtitle: releasedMeta ? releasedMeta.subtitle : "Coming soon",
      description: releasedMeta ? releasedMeta.description : "",
      accent: releasedMeta ? releasedMeta.accent : "muted",
      realMode: releasedMeta ? releasedMeta.realMode : null
    })];
  })
);

const SG_PERIODIC_NAME_TO_SYMBOL = (() => {
  const map = new Map();
  for (const el of SG_PERIODIC_BY_SYMBOL.values()) {
    map.set(el.name.toLowerCase(), el.symbol);
  }
  map.set("aluminium", "Al");
  map.set("sulphur", "S");
  map.set("caesium", "Cs");
  return map;
})();

const SG_PERIODIC_NAME_REGEX = new RegExp(
  `\\b(${Array.from(SG_PERIODIC_NAME_TO_SYMBOL.keys()).sort((a, b) => b.length - a.length).join("|")})\\b`,
  "i"
);

let isPeriodicModelPickerEnabled = false;
let _sgPeriodicInitialized = false;
let _sgPeriodicCaptureBound = false;
let _sgPeriodicSendBlockBound = false;
let _sgPeriodicLastBlockedToastAt = 0;
let _sgPeriodicOpenListenersBound = false;
let _sgPeriodicPanelEl = null;
let _sgPeriodicPopoverEl = null;
let _sgPeriodicIsOpen = false;
let _sgPeriodicLastTriggerEl = null;
let _sgPeriodicHoveredTile = null;
let _sgPeriodicPopoverInteractive = false;
let _sgPeriodicPopoverHideTimer = null;
let _sgPeriodicIntentTimer = null;
let _sgPeriodicIntentTile = null;
let _sgPeriodicLastInteractiveExit = null;
let _sgPeriodicThinkingTimer = null;
let _sgPeriodicProbeTimer = null;
let _sgPeriodicProbeInFlight = false;
let _sgPeriodicProbedThisSession = false;
let _sgPeriodicBypassDepth = 0;
let _sgPeriodicBypassClick = false;
let _sgPeriodicState = null;
let _sgPeriodicCatalog = null;
let _sgPeriodicLoadedScope = null;
let _sgPeriodicThinkingLevels = null;

const SG_PERIODIC_CATALOG_KEY = "sg_periodic_catalog_v2";
const SG_PERIODIC_CLASSIC_MODE_TO_SYMBOL = Object.freeze({
  fast: "H",
  thinking: "Ar",
  pro: "C"
});

function sgPeriodicGetAccountScope() {
  try {
    const pathname = (typeof window !== "undefined" && window.location && window.location.pathname) || "";
    const m = pathname.match(/^\/u\/(\d+)\b/);
    return m ? `u${m[1]}` : "default";
  } catch (e) {
    return "default";
  }
}

function sgPeriodicScopedKey(baseKey) {
  const scope = sgPeriodicGetAccountScope();
  return scope === "default" ? baseKey : `${baseKey}:${scope}`;
}

function sgPeriodicResetScopeCacheIfNeeded() {
  const scope = sgPeriodicGetAccountScope();
  if (_sgPeriodicLoadedScope !== null && _sgPeriodicLoadedScope !== scope) {
    _sgPeriodicState = null;
    _sgPeriodicCatalog = null;
    _sgPeriodicThinkingLevels = null;
    _sgPeriodicProbedThisSession = false;
  }
  _sgPeriodicLoadedScope = scope;
}

function sgPeriodicDefaultCatalog() {
  return {
    scanned: false,
    scannedAt: 0,
    uiMode: "fallback",
    elements: {},
    otherModels: [],
    levelsByModel: {}
  };
}

function sgPeriodicLoadCatalog() {
  sgPeriodicResetScopeCacheIfNeeded();
  if (_sgPeriodicCatalog) return _sgPeriodicCatalog;
  const fresh = sgPeriodicDefaultCatalog();
  try {
    const raw = localStorage.getItem(sgPeriodicScopedKey(SG_PERIODIC_CATALOG_KEY));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        fresh.scanned = Boolean(parsed.scanned);
        fresh.scannedAt = Number(parsed.scannedAt) || 0;
        fresh.uiMode = typeof parsed.uiMode === "string" ? parsed.uiMode : "fallback";
        if (parsed.elements && typeof parsed.elements === "object") {
          for (const [sym, meta] of Object.entries(parsed.elements)) {
            if (SG_PERIODIC_BY_SYMBOL.has(sym) && meta && typeof meta === "object") {
              fresh.elements[sym] = meta;
            }
          }
        }
        if (Array.isArray(parsed.otherModels)) {
          fresh.otherModels = parsed.otherModels.filter(m => m && typeof m === "object" && m.id && m.label);
        }
        if (parsed.levelsByModel && typeof parsed.levelsByModel === "object") {
          for (const [k, list] of Object.entries(parsed.levelsByModel)) {
            if (Array.isArray(list) && list.length >= 2) {
              fresh.levelsByModel[k] = sgPeriodicNormalizeThinkingLevels(list);
            }
          }
        }
      }
    } else {
      const legacy = localStorage.getItem(sgPeriodicScopedKey(SG_PERIODIC_DISCOVERED_KEY));
      if (legacy) {
        const parsedLegacy = JSON.parse(legacy);
        if (parsedLegacy && typeof parsedLegacy === "object") {
          for (const [sym, meta] of Object.entries(parsedLegacy)) {
            if (SG_PERIODIC_BY_SYMBOL.has(sym) && meta && typeof meta === "object") {
              fresh.elements[sym] = meta;
            }
          }
        }
      }
    }
  } catch (e) {}
  _sgPeriodicCatalog = fresh;
  return _sgPeriodicCatalog;
}

function sgPeriodicPersistCatalog() {
  if (!_sgPeriodicCatalog) return;
  try {
    localStorage.setItem(sgPeriodicScopedKey(SG_PERIODIC_CATALOG_KEY), JSON.stringify(_sgPeriodicCatalog));
  } catch (e) {}
}

function sgPeriodicNormalizeThinkingLevels(levels) {
  if (!Array.isArray(levels) || levels.length < 2) {
    return SG_PERIODIC_DEFAULT_THINKING_LEVELS.map((l, idx) => ({ ...l, index: idx }));
  }
  const seen = new Set();
  const out = [];
  for (let i = 0; i < levels.length && out.length < SG_PERIODIC_MAX_THINKING_LEVELS; i++) {
    const item = levels[i];
    const label = String(typeof item === "string" ? item : (item && (item.label || item.name || item.value)) || "").trim().replace(/\s+/g, " ");
    if (!label) continue;
    const rawVal = typeof item === "object" && item && item.value
      ? String(item.value).trim().toLowerCase()
      : label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || `level_${i}`;
    const value = seen.has(rawVal) ? `${rawVal}_${i}` : rawVal;
    seen.add(value);
    out.push({ value, label, index: out.length });
  }
  return out.length >= 2 ? out : SG_PERIODIC_DEFAULT_THINKING_LEVELS.map((l, idx) => ({ ...l, index: idx }));
}

function sgPeriodicGetThinkingLevels(symbol = null) {
  const catalog = sgPeriodicLoadCatalog();
  if (symbol && catalog.levelsByModel && Array.isArray(catalog.levelsByModel[symbol]) && catalog.levelsByModel[symbol].length >= 2) {
    return catalog.levelsByModel[symbol];
  }
  if (catalog.levelsByModel && Array.isArray(catalog.levelsByModel._default) && catalog.levelsByModel._default.length >= 2) {
    return catalog.levelsByModel._default;
  }
  if (_sgPeriodicThinkingLevels) return _sgPeriodicThinkingLevels;
  try {
    const raw = localStorage.getItem(sgPeriodicScopedKey(SG_PERIODIC_LEVELS_KEY));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length >= 2) {
        _sgPeriodicThinkingLevels = sgPeriodicNormalizeThinkingLevels(parsed);
        return _sgPeriodicThinkingLevels;
      }
    }
  } catch (e) {}
  _sgPeriodicThinkingLevels = SG_PERIODIC_DEFAULT_THINKING_LEVELS.map((l, idx) => ({ ...l, index: idx }));
  return _sgPeriodicThinkingLevels;
}

function sgPeriodicSetThinkingLevels(levels, { persist = true, symbol = null } = {}) {
  const normalized = sgPeriodicNormalizeThinkingLevels(levels);
  const catalog = sgPeriodicLoadCatalog();
  const key = symbol && SG_PERIODIC_BY_SYMBOL.has(symbol) ? symbol : "_default";
  const prev = catalog.levelsByModel[key] || _sgPeriodicThinkingLevels;
  const changed = !prev || prev.length !== normalized.length || prev.some((p, i) => p.value !== normalized[i].value || p.label !== normalized[i].label);
  catalog.levelsByModel[key] = normalized;
  if (key === "_default" || !catalog.levelsByModel._default) {
    catalog.levelsByModel._default = normalized;
    _sgPeriodicThinkingLevels = normalized;
  }
  if (persist) {
    sgPeriodicPersistCatalog();
    try {
      localStorage.setItem(sgPeriodicScopedKey(SG_PERIODIC_LEVELS_KEY), JSON.stringify(normalized));
    } catch (e) {}
  }
  return changed;
}

function sgPeriodicAccentForZ(z) {
  return SG_PERIODIC_ACCENT_PALETTE[(Math.max(0, Number(z) || 0) + 2) % SG_PERIODIC_ACCENT_PALETTE.length];
}

function sgPeriodicGetElement(symbol) {
  const base = SG_PERIODIC_BY_SYMBOL.get(symbol);
  if (!base) return null;
  const catalog = sgPeriodicLoadCatalog();
  const dyn = catalog.elements[symbol] || null;

  if (catalog.scanned) {
    if (!dyn) {
      return {
        ...base,
        released: false,
        locked: false,
        lockReason: "",
        title: base.name,
        subtitle: "Coming soon",
        description: "",
        accent: "muted",
        realMode: null,
        optionTestId: null,
        optionMatchText: base.name,
        isDynamicRelease: false
      };
    }
    const isLocked = Boolean(dyn.locked);
    const accent = dyn.accent && SG_PERIODIC_ACCENT_PALETTE.includes(dyn.accent)
      ? dyn.accent
      : (base.released ? base.accent : sgPeriodicAccentForZ(base.z));
    const title = (typeof dyn.title === "string" && dyn.title.trim())
      ? dyn.title.trim()
      : (base.released ? base.title : `Gemini 4 ${base.name}`);
    const subtitle = (typeof dyn.subtitle === "string" && dyn.subtitle.trim())
      ? dyn.subtitle.trim()
      : (isLocked ? (dyn.lockReason || "Locked on this account") : (base.released ? base.subtitle : "Available model"));
    const description = (typeof dyn.description === "string" && dyn.description.trim())
      ? dyn.description.trim()
      : (base.description || `Gemini model mapped to ${base.name} (${base.symbol}, Z=${base.z}).`);
    return {
      ...base,
      released: !isLocked,
      locked: isLocked,
      lockReason: isLocked ? (dyn.lockReason || "Unavailable on this plan") : "",
      title,
      subtitle,
      description,
      accent: isLocked ? "muted" : accent,
      realMode: dyn.realMode || null,
      optionTestId: dyn.optionTestId || null,
      optionMatchText: dyn.optionMatchText || base.name,
      isDynamicRelease: !base.released
    };
  }

  if (!dyn) {
    return {
      ...base,
      locked: false,
      lockReason: ""
    };
  }
  const isLocked = Boolean(dyn.locked);
  const accent = dyn.accent && SG_PERIODIC_ACCENT_PALETTE.includes(dyn.accent)
    ? dyn.accent
    : (base.released ? base.accent : sgPeriodicAccentForZ(base.z));
  const title = (typeof dyn.title === "string" && dyn.title.trim())
    ? dyn.title.trim()
    : (base.released ? base.title : `Gemini 4 ${base.name}`);
  const subtitle = (typeof dyn.subtitle === "string" && dyn.subtitle.trim())
    ? dyn.subtitle.trim()
    : (isLocked ? (dyn.lockReason || "Locked on this account") : (base.released ? base.subtitle : "Available model"));
  const description = (typeof dyn.description === "string" && dyn.description.trim())
    ? dyn.description.trim()
    : (base.description || `Available Gemini model mapped to ${base.name} (${base.symbol}, Z=${base.z}).`);
  return {
    ...base,
    released: !isLocked,
    locked: isLocked,
    lockReason: isLocked ? (dyn.lockReason || "Unavailable on this plan") : "",
    title,
    subtitle,
    description,
    accent: isLocked ? "muted" : accent,
    realMode: dyn.realMode || base.realMode || null,
    optionTestId: dyn.optionTestId || null,
    optionMatchText: dyn.optionMatchText || base.name,
    isDynamicRelease: !base.released
  };
}

function sgPeriodicGetAllReleasedElements() {
  const list = [];
  for (const sym of SG_PERIODIC_BY_SYMBOL.keys()) {
    const el = sgPeriodicGetElement(sym);
    if (el && el.released) list.push(el);
  }
  return list;
}

function sgPeriodicGetAllLockedElements() {
  const list = [];
  for (const sym of SG_PERIODIC_BY_SYMBOL.keys()) {
    const el = sgPeriodicGetElement(sym);
    if (el && el.locked) list.push(el);
  }
  return list;
}

function sgPeriodicGetOtherModels() {
  const catalog = sgPeriodicLoadCatalog();
  if (catalog.scanned) {
    return catalog.otherModels;
  }
  return SG_PERIODIC_OTHER_MODELS;
}

function sgPeriodicBuildElementEntry(symbol, spec, prev = {}) {
  const base = SG_PERIODIC_BY_SYMBOL.get(symbol);
  if (!base) return null;
  const obj = typeof spec === "object" && spec ? spec : {};
  const rawTitle = typeof obj.title === "string" ? obj.title.trim() : "";
  const resolvedTitle = rawTitle && rawTitle.toLowerCase() !== base.name.toLowerCase()
    ? rawTitle
    : (prev.title || (base.released ? base.title : `Gemini 4 ${base.name}`));
  const rawSub = typeof obj.subtitle === "string" ? obj.subtitle.trim() : "";
  const resolvedSubtitle = rawSub || prev.subtitle || (base.released ? base.subtitle : "Available model");
  const rawDesc = typeof obj.description === "string" ? obj.description.trim() : "";
  const resolvedDescription = rawDesc && (!base.released || rawDesc.length > 24)
    ? rawDesc
    : (prev.description || base.description || "");
  return {
    title: resolvedTitle,
    subtitle: resolvedSubtitle,
    description: resolvedDescription,
    accent: obj.accent && SG_PERIODIC_ACCENT_PALETTE.includes(obj.accent) ? obj.accent : (prev.accent || (base.released ? base.accent : sgPeriodicAccentForZ(base.z))),
    realMode: obj.realMode !== undefined ? obj.realMode : (prev.realMode || base.realMode || null),
    optionTestId: obj.optionTestId || prev.optionTestId || null,
    optionMatchText: obj.optionMatchText || prev.optionMatchText || base.name,
    locked: Boolean(obj.locked),
    lockReason: typeof obj.lockReason === "string" ? obj.lockReason.trim() : ""
  };
}

function sgPeriodicRegisterReleasedModel(spec, { persist = true, refresh = true } = {}) {
  if (!spec) return false;
  let symbol = typeof spec === "string" ? spec : spec.symbol;
  if (!symbol && typeof spec === "object" && spec.name) {
    symbol = SG_PERIODIC_NAME_TO_SYMBOL.get(String(spec.name).trim().toLowerCase());
  }
  if (!symbol && typeof spec === "string") {
    symbol = SG_PERIODIC_NAME_TO_SYMBOL.get(spec.trim().toLowerCase()) || symbol;
  }
  const catalog = sgPeriodicLoadCatalog();
  const prev = catalog.elements[symbol] || {};
  const next = sgPeriodicBuildElementEntry(symbol, spec, prev);
  if (!next) return false;

  const unchanged =
    Boolean(catalog.elements[symbol]) &&
    prev.title === next.title &&
    prev.subtitle === next.subtitle &&
    prev.description === next.description &&
    prev.accent === next.accent &&
    prev.realMode === next.realMode &&
    prev.optionTestId === next.optionTestId &&
    prev.optionMatchText === next.optionMatchText &&
    Boolean(prev.locked) === next.locked &&
    (prev.lockReason || "") === next.lockReason;

  if (unchanged) return false;
  catalog.elements[symbol] = next;
  if (persist) sgPeriodicPersistCatalog();
  if (refresh) {
    sgPeriodicRefreshPanelReleasedStates();
    sgSyncPeriodicSendBlockState();
  }
  return true;
}

function sgPeriodicRegisterReleasedModels(list) {
  if (!Array.isArray(list)) return 0;
  let changedCount = 0;
  for (const item of list) {
    if (sgPeriodicRegisterReleasedModel(item, { persist: false, refresh: false })) {
      changedCount++;
    }
  }
  if (changedCount > 0) {
    sgPeriodicPersistCatalog();
    sgPeriodicRefreshPanelReleasedStates();
    sgSyncPeriodicSendBlockState();
  }
  return changedCount;
}

function sgPeriodicCollectTextSegments(el) {
  const segs = [];
  const walk = node => {
    if (!node) return;
    if (node.nodeType === 3) {
      const s = (node.nodeValue || node._text || "").trim().replace(/\s+/g, " ");
      if (s) segs.push(s);
      return;
    }
    if (node.nodeType !== 1) return;
    if (node.getAttribute && node.getAttribute("data-sg-periodic-label") === "true") return;
    if (typeof node.matches === "function" && node.matches(SG_PERIODIC_ICON_SELECTOR)) return;
    for (const ch of (node.childNodes || [])) walk(ch);
  };
  walk(el);
  return segs;
}

function sgPeriodicCollectSpacedText(el) {
  if (!el) return "";
  return sgPeriodicCollectTextSegments(el).join(" ").replace(/\s+/g, " ").trim();
}

function sgPeriodicInspectMenuItemLocked(item) {
  if (!item || item.nodeType !== 1) return { locked: false, lockReason: "" };
  const text = sgPeriodicCollectSpacedText(item);
  const tidLower = (item.getAttribute("data-test-id") || "").toLowerCase();
  const lower = `${text} ${tidLower}`.toLowerCase();
  const isDisabled = Boolean(
    item.disabled ||
    item.hasAttribute("disabled") ||
    item.getAttribute("aria-disabled") === "true" ||
    (item.classList && (item.classList.contains("disabled") || item.classList.contains("mat-mdc-menu-item-disabled") || item.classList.contains("locked")))
  );
  const hasLockIcon = Boolean(
    typeof item.querySelector === "function" &&
    item.querySelector('[fonticon="lock"], [data-mat-icon-name="lock"], [fonticon="lock_outline"], [data-mat-icon-name="lock_outline"]')
  );
  const hasUpsellTestId = tidLower.includes("upsell");
  const hasUpgradeEl = Boolean(
    typeof item.querySelector === "function" &&
    item.querySelector('a[href*="upgrade"], a[href*="one.google"], button[class*="upgrade"], .upgrade-badge, .upsell-badge')
  );
  const hasUpgradeText = /\b(upgrade|nâng cấp|get ultra|try ultra|get pro|try pro)\b/i.test(lower);
  const hasLimitText = /\b(limit reached|usage limit|đã đạt giới hạn|hết hạn mức)\b/i.test(lower);

  if (!isDisabled && !hasLockIcon && !hasUpsellTestId && !hasUpgradeEl && !hasUpgradeText && !hasLimitText) {
    return { locked: false, lockReason: "" };
  }
  if (hasLimitText) return { locked: true, lockReason: "Usage limit reached" };
  if (hasUpsellTestId || hasUpgradeEl || hasUpgradeText || hasLockIcon) {
    if (/(^|[_\s-])ultra($|[_\s-])/.test(lower)) return { locked: true, lockReason: "Requires Google AI Ultra" };
    if (/(^|[_\s-])pro($|[_\s-])/.test(lower)) return { locked: true, lockReason: "Requires Google AI Pro" };
    return { locked: true, lockReason: "Upgrade required" };
  }
  return { locked: true, lockReason: "Unavailable on this plan" };
}

function sgPeriodicExtractMenuItemMeta(item) {
  const fullSpaced = sgPeriodicCollectSpacedText(item);
  const labelContainer = typeof item.querySelector === "function" ? item.querySelector(".label-container") : null;
  if (labelContainer) {
    let parts = Array.from(labelContainer.children || [])
      .map(ch => sgPeriodicCollectSpacedText(ch))
      .filter(Boolean);
    if (parts.length < 2) {
      const segs = sgPeriodicCollectTextSegments(labelContainer);
      if (segs.length >= 2) parts = segs;
    }
    if (parts.length >= 2) {
      return {
        title: parts[0],
        description: parts.slice(1).join(" ").trim(),
        fullText: fullSpaced
      };
    }
    if (parts.length === 1) {
      return { title: parts[0], description: "", fullText: fullSpaced };
    }
  }

  const titleEl = item.querySelector(".label, .mode-title, .title, [class*='title']");
  const descEl = item.querySelector(".description, .subtitle, .secondary-text, .sublabel, .caption, [class*='desc'], [class*='subtitle'], [class*='sublabel'], [class*='caption']");
  const rawLines = (item.textContent || "")
    .split(/\r?\n/)
    .map(s => s.trim().replace(/\s+/g, " "))
    .filter(Boolean);
  const title = (titleEl ? sgPeriodicCollectSpacedText(titleEl) : "") || rawLines[0] || fullSpaced;
  let description = descEl ? sgPeriodicCollectSpacedText(descEl) : "";
  if (!description && rawLines.length > 1) {
    const extra = rawLines.slice(1).join(" ").trim();
    if (extra && extra.toLowerCase() !== title.toLowerCase()) description = extra;
  }
  if (!description && title && fullSpaced.length > title.length && fullSpaced.toLowerCase().startsWith(title.toLowerCase())) {
    description = fullSpaced.slice(title.length).trim();
  }
  return { title, description, fullText: fullSpaced };
}

function sgPeriodicResolveScannedElementFields(c) {
  const titleHasName = SG_PERIODIC_NAME_REGEX.test(c.title || "");
  const descHasName = SG_PERIODIC_NAME_REGEX.test(c.description || "");
  if (!titleHasName && descHasName) {
    const rawModel = (c.description || "").trim();
    const formattedTitle = /^\d+(?:\.\d+)?\s+[a-z]+$/i.test(rawModel)
      ? `Gemini ${rawModel}`
      : (rawModel || undefined);
    const useCase = (c.title || "").trim();
    return {
      title: formattedTitle,
      subtitle: c.lockInfo.locked ? c.lockInfo.lockReason : (useCase || undefined),
      description: useCase ? `${useCase}.` : undefined,
      optionMatchText: rawModel || c.elemName
    };
  }
  return {
    title: c.title || undefined,
    subtitle: c.lockInfo.locked ? c.lockInfo.lockReason : (c.description && c.description.length <= 48 ? c.description : undefined),
    description: c.description || undefined,
    optionMatchText: c.title || c.elemName
  };
}

function sgPeriodicIsSelectedMenuItem(item) {
  return Boolean(
    item &&
    (item.classList.contains("is-selected") ||
      item.classList.contains("selected") ||
      item.getAttribute("aria-checked") === "true")
  );
}

function sgPeriodicScanGeminiCatalogFromDom({ replaceSnapshot = false } = {}) {
  if (!isExtensionEnabled || !isPeriodicModelPickerEnabled) return false;
  const catalog = sgPeriodicLoadCatalog();
  let changed = false;

  const optionItems = Array.from(document.querySelectorAll('[data-test-id^="bard-mode-option-"]'));
  const menuSet = new Set();
  optionItems.forEach(item => {
    const m = typeof item.closest === "function" ? item.closest("gem-menu") : null;
    if (m) menuSet.add(m);
  });
  const candidateItems = new Set(optionItems);
  menuSet.forEach(menu => {
    menu.querySelectorAll("gem-menu-item").forEach(mi => {
      const tid = mi.getAttribute("data-test-id") || "";
      const val = mi.getAttribute("value") || "";
      if (val === "thinking_level" || mi.getAttribute("aria-haspopup") === "true") return;
      if (mi.querySelector('mat-icon[data-mat-icon-name="arrow_right"], mat-icon[fonticon="arrow_right"]')) return;
      if (tid.startsWith("bard-mode-option-") || SG_PERIODIC_NAME_REGEX.test(mi.textContent || "")) {
        candidateItems.add(mi);
      }
    });
  });

  let activeMenuElementSymbol = null;
  const parsedCandidates = [];
  candidateItems.forEach(item => {
    const { title, description, fullText: extractedFull } = sgPeriodicExtractMenuItemMeta(item);
    if (!title && !description && !extractedFull) return;
    const tid = item.getAttribute("data-test-id") || "";
    const lockInfo = sgPeriodicInspectMenuItemLocked(item);
    const fullText = `${title} ${description} ${extractedFull || ""}`.trim();
    const elemMatch = fullText.match(SG_PERIODIC_NAME_REGEX);
    const elemSym = elemMatch ? SG_PERIODIC_NAME_TO_SYMBOL.get(elemMatch[1].toLowerCase()) : null;
    const inferredMode = typeof parseModeFromButtonText === "function"
      ? parseModeFromButtonText(`${tid} ${title}`)
      : null;
    const isSelected = sgPeriodicIsSelectedMenuItem(item);
    if (isSelected && elemSym) activeMenuElementSymbol = elemSym;
    parsedCandidates.push({
      item, title, description, fullText, tid, lockInfo, elemSym, elemName: elemMatch ? elemMatch[1] : "", inferredMode, isSelected
    });
  });

  if (parsedCandidates.length > 0) {
    const hasElementModels = parsedCandidates.some(c => Boolean(c.elemSym));
    if (replaceSnapshot) {
      const nextElements = {};
      const nextOtherModels = [];
      const seenOtherIds = new Set();

      for (const c of parsedCandidates) {
        let targetSym = c.elemSym;
        if (!hasElementModels && !targetSym && c.inferredMode && SG_PERIODIC_CLASSIC_MODE_TO_SYMBOL[c.inferredMode]) {
          targetSym = SG_PERIODIC_CLASSIC_MODE_TO_SYMBOL[c.inferredMode];
          if (c.isSelected) activeMenuElementSymbol = targetSym;
        }
        if (targetSym) {
          const fields = hasElementModels ? sgPeriodicResolveScannedElementFields(c) : {
            title: undefined,
            subtitle: c.lockInfo.locked ? c.lockInfo.lockReason : (c.description && c.description.length <= 48 ? c.description : undefined),
            description: c.description || undefined,
            optionMatchText: c.title || c.elemName
          };
          const entry = sgPeriodicBuildElementEntry(targetSym, {
            title: fields.title,
            subtitle: fields.subtitle,
            description: fields.description,
            realMode: hasElementModels ? (c.inferredMode || null) : c.inferredMode,
            optionTestId: c.tid || undefined,
            optionMatchText: fields.optionMatchText,
            locked: c.lockInfo.locked,
            lockReason: c.lockInfo.lockReason
          }, catalog.elements[targetSym] || {});
          if (entry) nextElements[targetSym] = entry;
        } else if (c.title) {
          const id = (c.tid || c.title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `other-${nextOtherModels.length}`;
          if (!seenOtherIds.has(id)) {
            seenOtherIds.add(id);
            nextOtherModels.push({
              id,
              label: c.title,
              description: c.description || "",
              realMode: c.inferredMode || null,
              optionTestId: c.tid || null,
              optionMatchText: c.title,
              locked: c.lockInfo.locked,
              lockReason: c.lockInfo.lockReason
            });
          }
        }
      }

      const prevJson = JSON.stringify({ s: catalog.scanned, u: catalog.uiMode, e: catalog.elements, o: catalog.otherModels });
      catalog.scanned = true;
      catalog.scannedAt = Date.now();
      catalog.uiMode = hasElementModels ? "element" : "classic";
      catalog.elements = nextElements;
      catalog.otherModels = nextOtherModels;
      const nextJson = JSON.stringify({ s: catalog.scanned, u: catalog.uiMode, e: catalog.elements, o: catalog.otherModels });
      if (prevJson !== nextJson) changed = true;
    } else {
      for (const c of parsedCandidates) {
        if (!c.elemSym) continue;
        const fields = sgPeriodicResolveScannedElementFields(c);
        if (sgPeriodicRegisterReleasedModel({
          symbol: c.elemSym,
          title: fields.title,
          subtitle: fields.subtitle,
          description: fields.description,
          realMode: c.inferredMode || undefined,
          optionTestId: c.tid || undefined,
          optionMatchText: fields.optionMatchText,
          locked: c.lockInfo.locked,
          lockReason: c.lockInfo.lockReason
        }, { persist: false, refresh: false })) {
          changed = true;
        }
      }
    }
  }

  const modeBtn = document.querySelector('[data-test-id="bard-mode-menu-button"]');
  let nativeBtnElementSymbol = null;
  if (modeBtn) {
    const nativeText = sgPeriodicCollectSpacedText(modeBtn);
    const m = nativeText.match(SG_PERIODIC_NAME_REGEX);
    if (m) {
      const sym = SG_PERIODIC_NAME_TO_SYMBOL.get(m[1].toLowerCase());
      if (sym) {
        nativeBtnElementSymbol = sym;
        if (!replaceSnapshot && sgPeriodicRegisterReleasedModel({ symbol: sym, locked: false }, { persist: false, refresh: false })) {
          changed = true;
        }
      }
    }
  }

  if (typeof findEffortLevelItems === "function") {
    try {
      const effortItems = findEffortLevelItems();
      if (Array.isArray(effortItems) && effortItems.length >= 2) {
        const parsedLevels = effortItems.slice(0, SG_PERIODIC_MAX_THINKING_LEVELS).map((item, idx) => {
          const lbl = ((item.querySelector(".label") || item).textContent || "").trim().replace(/\s+/g, " ");
          const lower = lbl.toLowerCase();
          let value = `level_${idx}`;
          if (/\b(minimal|min|tối thiểu)\b/.test(lower)) value = "minimal";
          else if (/\b(low|thấp|standard)\b/.test(lower)) value = "low";
          else if (/\b(medium|trung bình|balanced)\b/.test(lower)) value = "medium";
          else if (/\b(extra|rất cao|extended|super)\b/.test(lower)) value = "extra";
          else if (/\b(ultra|max|tối đa|maximum)\b/.test(lower)) value = "max";
          else if (/\b(high|cao)\b/.test(lower)) value = "high";
          return { value, label: lbl || `Level ${idx + 1}`, index: idx };
        });
        const state = _sgPeriodicState;
        const levelTargetSym = activeMenuElementSymbol || nativeBtnElementSymbol || (state && state.selectedType === "element" ? state.symbol : null);
        if (sgPeriodicSetThinkingLevels(parsedLevels, { persist: false, symbol: levelTargetSym })) {
          changed = true;
        }
        if (levelTargetSym && sgPeriodicSetThinkingLevels(parsedLevels, { persist: false, symbol: null })) {
          changed = true;
        }
      }
    } catch (e) {}
  }

  if (changed) {
    sgPeriodicPersistCatalog();
    sgPeriodicRefreshPanelReleasedStates();
    sgPeriodicRebuildFooterPills();
    sgPeriodicUpdateSelectionClasses();
    sgSyncPeriodicSendBlockState();
  }
  return changed;
}

function sgPeriodicSetRefreshButtonBusy(busy) {
  if (!_sgPeriodicPanelEl) return;
  const btn = _sgPeriodicPanelEl.querySelector(".sg-periodic-refresh-btn");
  if (!btn) return;
  btn.classList.toggle("sg-periodic-spinning", Boolean(busy));
  btn.setAttribute("aria-busy", busy ? "true" : "false");
  btn.disabled = Boolean(busy);
}

function sgPeriodicIsNativeMenuOpen() {
  return document.querySelectorAll('[data-test-id^="bard-mode-option-"]').length > 0;
}

function sgPeriodicCloseNativeModeMenu(trigger, onClosed) {
  const tryEscape = () => {
    try {
      const target = document.querySelector('[data-test-id^="bard-mode-option-"]')
        || document.querySelector("gem-menu")
        || document.activeElement
        || document.body;
      if (typeof KeyboardEvent === "function") {
        if (target && typeof target.dispatchEvent === "function") {
          target.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", keyCode: 27, bubbles: true, cancelable: true }));
        }
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", keyCode: 27, bubbles: true, cancelable: true }));
      }
    } catch (e) {}
  };

  const tryHidePopoverAndBackdrop = () => {
    try {
      document.querySelectorAll("gem-menu").forEach(m => {
        if (!m.querySelector('[data-test-id^="bard-mode-option-"]')) return;
        if (typeof m.hidePopover === "function") {
          try { m.hidePopover(); } catch (e) {}
        }
      });
      const backdrop = document.querySelector(".cdk-overlay-backdrop");
      if (backdrop && typeof backdrop.click === "function") {
        backdrop.click();
      } else if (document.body) {
        if (typeof MouseEvent === "function") {
          document.body.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, cancelable: true }));
          document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
        }
        document.body.click();
      }
    } catch (e) {}
  };

  tryHidePopoverAndBackdrop();

  let stage = 0;
  const check = () => {
    if (!sgPeriodicIsNativeMenuOpen()) {
      onClosed();
      return;
    }
    stage++;
    if (stage === 1) {
      tryEscape();
      setTimeout(check, 45);
      return;
    }
    if (stage === 2) {
      if (trigger && typeof trigger.click === "function") {
        sgPeriodicRunWithBypass(() => trigger.click());
      }
      setTimeout(check, 60);
      return;
    }
    if (stage <= 6) {
      tryEscape();
      setTimeout(check, 50);
      return;
    }
    onClosed();
  };
  setTimeout(check, 45);
}

function sgPeriodicProbeCatalogSilent({ force = false } = {}) {
  if (!isExtensionEnabled || !isPeriodicModelPickerEnabled) return Promise.resolve(false);
  if (_sgPeriodicProbeInFlight) return Promise.resolve(false);
  if (!force && _sgPeriodicProbedThisSession) return Promise.resolve(false);
  if (document.documentElement && document.documentElement.hasAttribute("data-sg-detecting-mode")) {
    return Promise.resolve(false);
  }

  const existing = document.querySelectorAll('[data-test-id^="bard-mode-option-"]');
  if (existing.length > 0) {
    _sgPeriodicProbedThisSession = true;
    const changed = sgPeriodicScanGeminiCatalogFromDom({ replaceSnapshot: true });
    return Promise.resolve(changed);
  }

  const modeBtn = document.querySelector('[data-test-id="bard-mode-menu-button"]');
  if (!modeBtn) return Promise.resolve(false);
  const trigger = modeBtn.querySelector("button.input-area-switch") || modeBtn.querySelector("button") || modeBtn;

  _sgPeriodicProbeInFlight = true;
  _sgPeriodicProbedThisSession = true;
  sgPeriodicSetRefreshButtonBusy(true);

  if (typeof ensureModeMenuHideStyle === "function") ensureModeMenuHideStyle();
  if (document.body) document.body.classList.add("sg-hiding-mode-menu");

  return new Promise(resolve => {
    let settled = false;
    let pollId = null;
    let safetyId = null;

    const finish = found => {
      if (settled) return;
      settled = true;
      if (pollId) clearInterval(pollId);
      if (safetyId) clearTimeout(safetyId);
      sgPeriodicCloseNativeModeMenu(trigger, () => {
        setTimeout(() => {
          if (document.body) document.body.classList.remove("sg-hiding-mode-menu");
          _sgPeriodicProbeInFlight = false;
          sgPeriodicSetRefreshButtonBusy(false);
          resolve(found);
        }, 60);
      });
    };

    try {
      sgPeriodicRunWithBypass(() => trigger.click());
    } catch (e) {
      finish(false);
      return;
    }

    let ticks = 0;
    pollId = setInterval(() => {
      ticks++;
      const items = document.querySelectorAll('[data-test-id^="bard-mode-option-"]');
      if (items.length > 0) {
        sgPeriodicScanGeminiCatalogFromDom({ replaceSnapshot: true });
        finish(true);
      } else if (ticks >= 32) {
        finish(false);
      }
    }, 25);

    safetyId = setTimeout(() => finish(false), 900);
  });
}

function sgPeriodicReadState() {
  sgPeriodicResetScopeCacheIfNeeded();
  if (_sgPeriodicState) return _sgPeriodicState;
  try {
    const raw = localStorage.getItem(sgPeriodicScopedKey(SG_PERIODIC_STORAGE_KEY));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        const levels = sgPeriodicGetThinkingLevels(parsed.symbol || null);
        const fallbackLevel = levels[Math.min(1, levels.length - 1)].value;
        const storedLevel = typeof parsed.thinkingLevel === "string" && parsed.thinkingLevel.trim()
          ? parsed.thinkingLevel.trim().toLowerCase()
          : fallbackLevel;
        _sgPeriodicState = {
          selectedType: parsed.selectedType === "other" ? "other" : "element",
          symbol: typeof parsed.symbol === "string" ? parsed.symbol : null,
          id: typeof parsed.id === "string" ? parsed.id : null,
          name: typeof parsed.name === "string" ? parsed.name : "",
          released: Boolean(parsed.released),
          thinkingLevel: storedLevel
        };
        return _sgPeriodicState;
      }
    }
  } catch (e) {}
  return null;
}

function sgPeriodicSaveState(next) {
  sgPeriodicResetScopeCacheIfNeeded();
  _sgPeriodicState = next;
  try {
    const key = sgPeriodicScopedKey(SG_PERIODIC_STORAGE_KEY);
    if (next) {
      localStorage.setItem(key, JSON.stringify(next));
    } else {
      localStorage.removeItem(key);
    }
  } catch (e) {}
}

function sgPeriodicCreateEl(tag, attrs, children) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null) continue;
      if (k === "className") el.className = v;
      else if (k === "textContent") el.textContent = v;
      else if (k === "dataset" && typeof v === "object") {
        for (const [dk, dv] of Object.entries(v)) el.dataset[dk] = String(dv);
      } else el.setAttribute(k, String(v));
    }
  }
  if (Array.isArray(children)) {
    for (const ch of children) {
      if (ch === null || ch === undefined) continue;
      el.appendChild(typeof ch === "string" ? document.createTextNode(ch) : ch);
    }
  }
  return el;
}

function sgPeriodicCreateSparkleSvg() {
  const svg = document.createElementNS(SG_PERIODIC_SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "18");
  svg.setAttribute("height", "18");
  svg.setAttribute("fill", "currentColor");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", "sg-periodic-sparkle-icon");
  const path = document.createElementNS(SG_PERIODIC_SVG_NS, "path");
  path.setAttribute("d", "M12 2C12.7 7.1 16.9 11.3 22 12C16.9 12.7 12.7 16.9 12 22C11.3 16.9 7.1 12.7 2 12C7.1 11.3 11.3 7.1 12 2Z");
  svg.appendChild(path);
  return svg;
}

function sgPeriodicCreateCloseSvg() {
  const svg = document.createElementNS(SG_PERIODIC_SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "16");
  svg.setAttribute("height", "16");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  const p = document.createElementNS(SG_PERIODIC_SVG_NS, "path");
  p.setAttribute("d", "M18 6L6 18M6 6l12 12");
  svg.appendChild(p);
  return svg;
}

function sgPeriodicCreateRefreshSvg() {
  const svg = document.createElementNS(SG_PERIODIC_SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "15");
  svg.setAttribute("height", "15");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  const p1 = document.createElementNS(SG_PERIODIC_SVG_NS, "path");
  p1.setAttribute("d", "M21 12a9 9 0 1 1-2.64-6.36");
  const p2 = document.createElementNS(SG_PERIODIC_SVG_NS, "path");
  p2.setAttribute("d", "M21 3v6h-6");
  svg.appendChild(p1);
  svg.appendChild(p2);
  return svg;
}

function sgPeriodicRunWithBypass(fn) {
  _sgPeriodicBypassDepth++;
  _sgPeriodicBypassClick = true;
  try {
    return fn();
  } finally {
    setTimeout(() => {
      _sgPeriodicBypassDepth = Math.max(0, _sgPeriodicBypassDepth - 1);
      _sgPeriodicBypassClick = _sgPeriodicBypassDepth > 0;
    }, 0);
  }
}

const SG_PERIODIC_ICON_SELECTOR = "mat-icon, .mat-icon, svg, .google-symbols, .material-symbols-outlined, .material-icons, [fonticon], [data-mat-icon-name]";
const SG_PERIODIC_RIPPLE_SELECTOR = ".mat-mdc-button-persistent-ripple, .mdc-button__ripple, .mat-focus-indicator, .mat-mdc-button-touch-target";

function sgPeriodicElementNonIconText(el) {
  if (!el || el.nodeType !== 1) return "";
  const clone = el.cloneNode(true);
  clone.querySelectorAll(SG_PERIODIC_ICON_SELECTOR).forEach(n => n.remove());
  return (clone.textContent || "").trim();
}

function sgPeriodicIsIconNode(el) {
  if (!el || el.nodeType !== 1) return false;
  if (typeof el.matches === "function" && el.matches(SG_PERIODIC_ICON_SELECTOR)) return true;
  if (el.getAttribute("data-sg-periodic-label") === "true") return false;
  if (typeof el.querySelector === "function" && el.querySelector(SG_PERIODIC_ICON_SELECTOR)) {
    return sgPeriodicElementNonIconText(el) === "";
  }
  return false;
}

function sgPeriodicResolveLabelHost(btn) {
  const innerBtn = btn.querySelector("button.input-area-switch") || btn.querySelector("button") || btn;
  let host = innerBtn.querySelector(".mdc-button__label")
    || innerBtn.querySelector(".logo-pill-label-container")
    || innerBtn;

  for (let depth = 0; depth < 3; depth++) {
    const contentChildren = Array.from(host.children).filter(c =>
      c.getAttribute("data-sg-periodic-label") !== "true" &&
      !(typeof c.matches === "function" && c.matches(SG_PERIODIC_RIPPLE_SELECTOR))
    );
    if (
      contentChildren.length === 1 &&
      contentChildren[0].children.length > 0 &&
      !sgPeriodicIsIconNode(contentChildren[0])
    ) {
      host = contentChildren[0];
    } else {
      break;
    }
  }
  return host;
}

function sgRestorePeriodicModeButtonLabel() {
  document.querySelectorAll('[data-test-id="bard-mode-menu-button"]').forEach(btn => {
    btn.removeAttribute("data-sg-periodic-active");
    btn.removeAttribute("data-sg-periodic-inline-host");
    btn.removeAttribute("data-sg-periodic-host");
    btn.querySelectorAll('[data-sg-periodic-host="true"]').forEach(el => el.removeAttribute("data-sg-periodic-host"));
    btn.querySelectorAll('[data-sg-periodic-keep="true"]').forEach(el => el.removeAttribute("data-sg-periodic-keep"));
    btn.querySelectorAll('[data-sg-periodic-label="true"]').forEach(el => el.remove());
  });
}

function sgSyncPeriodicModeButtonLabel() {
  if (!isExtensionEnabled || !isPeriodicModelPickerEnabled) {
    sgRestorePeriodicModeButtonLabel();
    return;
  }
  const state = sgPeriodicReadState();
  if (!state || !state.name) return;
  const buttons = document.querySelectorAll('[data-test-id="bard-mode-menu-button"]');
  if (!buttons || !buttons.length) return;

  const liveElem = state.selectedType === "element" && state.symbol ? sgPeriodicGetElement(state.symbol) : null;
  const isLocked = Boolean(liveElem && liveElem.locked);
  const isReleased = state.selectedType === "other" || Boolean(liveElem ? liveElem.released : state.released);
  const displayLabel = state.selectedType === "element" && isLocked
    ? `\uD83D\uDD12 ${state.name}`
    : state.selectedType === "element" && !isReleased
      ? `\u25CB ${state.name}`
      : state.name;

  buttons.forEach(btn => {
    const existingLabel = btn.querySelector('[data-sg-periodic-label="true"]');
    if (
      existingLabel &&
      existingLabel.textContent === displayLabel &&
      btn.getAttribute("data-sg-periodic-active") === "true" &&
      existingLabel.parentElement &&
      existingLabel.parentElement.getAttribute("data-sg-periodic-host") === "true"
    ) {
      return;
    }

    if (btn.getAttribute("data-sg-periodic-active") !== "true") {
      btn.setAttribute("data-sg-periodic-active", "true");
    }

    const host = sgPeriodicResolveLabelHost(btn);
    btn.querySelectorAll('[data-sg-periodic-host="true"]').forEach(el => {
      if (el !== host) el.removeAttribute("data-sg-periodic-host");
    });
    if (btn !== host && btn.hasAttribute("data-sg-periodic-host")) {
      btn.removeAttribute("data-sg-periodic-host");
    }
    if (host.getAttribute("data-sg-periodic-host") !== "true") {
      host.setAttribute("data-sg-periodic-host", "true");
    }

    const keptIcons = [];
    Array.from(host.children).forEach(child => {
      if (child.getAttribute("data-sg-periodic-label") === "true") return;
      if (sgPeriodicIsIconNode(child)) {
        keptIcons.push(child);
        if (child.getAttribute("data-sg-periodic-keep") !== "true") {
          child.setAttribute("data-sg-periodic-keep", "true");
        }
      } else if (child.hasAttribute("data-sg-periodic-keep")) {
        child.removeAttribute("data-sg-periodic-keep");
      }
    });

    const trailingIcon = keptIcons.length ? keptIcons[keptIcons.length - 1] : null;
    let labelEl = btn.querySelector('[data-sg-periodic-label="true"]');
    if (!labelEl) {
      labelEl = sgPeriodicCreateEl("span", {
        className: "sg-periodic-mode-label",
        "data-sg-periodic-label": "true"
      });
    }

    if (trailingIcon) {
      if (labelEl.parentElement !== host || labelEl.nextElementSibling !== trailingIcon) {
        host.insertBefore(labelEl, trailingIcon);
      }
    } else if (labelEl.parentElement !== host) {
      host.appendChild(labelEl);
    }

    if (labelEl.textContent !== displayLabel) {
      labelEl.textContent = displayLabel;
    }
  });
}

function sgClearPeriodicPopoverTimer() {
  if (_sgPeriodicPopoverHideTimer) {
    clearTimeout(_sgPeriodicPopoverHideTimer);
    _sgPeriodicPopoverHideTimer = null;
  }
}

function sgClearPeriodicIntentTimer() {
  if (_sgPeriodicIntentTimer) {
    clearTimeout(_sgPeriodicIntentTimer);
    _sgPeriodicIntentTimer = null;
  }
  _sgPeriodicIntentTile = null;
}

function sgPeriodicPointInTriangle(px, py, ax, ay, bx, by, cx, cy) {
  const sign = (x1, y1, x2, y2, x3, y3) => (x1 - x3) * (y2 - y3) - (x2 - x3) * (y1 - y3);
  const d1 = sign(px, py, ax, ay, bx, by);
  const d2 = sign(px, py, bx, by, cx, cy);
  const d3 = sign(px, py, cx, cy, ax, ay);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

function sgPeriodicShouldDeferTileSwitch(e, nextTile) {
  if (!_sgPeriodicPopoverInteractive || !_sgPeriodicPopoverEl || !_sgPeriodicHoveredTile) return false;
  if (_sgPeriodicHoveredTile === nextTile) return false;
  if (!_sgPeriodicPopoverEl.classList.contains("sg-periodic-visible")) return false;
  if (!_sgPeriodicLastInteractiveExit) return false;
  if (Date.now() - _sgPeriodicLastInteractiveExit.at > 360) return false;
  if (!e || typeof e.clientX !== "number" || typeof e.clientY !== "number") return false;
  if (e.clientX === 0 && e.clientY === 0) return false;

  const pRect = _sgPeriodicPopoverEl.getBoundingClientRect();
  if (!pRect || (pRect.width <= 0 && pRect.height <= 0)) return false;

  const tRect = _sgPeriodicLastInteractiveExit.tileRect || _sgPeriodicHoveredTile.getBoundingClientRect();
  const placedBelow = _sgPeriodicPopoverEl.classList.contains("sg-periodic-popover-below");
  const ax = Math.max(tRect.left, Math.min(tRect.right, _sgPeriodicLastInteractiveExit.x));
  const ay = placedBelow ? (tRect.top - 4) : (tRect.bottom + 4);
  const padX = 18;
  const bx = pRect.left - padX;
  const cx = pRect.right + padX;
  const by = placedBelow ? pRect.bottom : pRect.top;

  return sgPeriodicPointInTriangle(e.clientX, e.clientY, ax, ay, bx, by, cx, by);
}

function sgHidePeriodicPopover() {
  sgClearPeriodicPopoverTimer();
  sgClearPeriodicIntentTimer();
  _sgPeriodicHoveredTile = null;
  _sgPeriodicPopoverInteractive = false;
  _sgPeriodicLastInteractiveExit = null;
  if (_sgPeriodicPopoverEl) {
    _sgPeriodicPopoverEl.classList.remove("sg-periodic-visible", "sg-periodic-popover-interactive", "sg-periodic-popover-passive");
    _sgPeriodicPopoverEl.setAttribute("aria-hidden", "true");
  }
}

function sgSchedulePeriodicPopoverHide(delayMs = 180) {
  sgClearPeriodicPopoverTimer();
  _sgPeriodicPopoverHideTimer = setTimeout(() => {
    _sgPeriodicPopoverHideTimer = null;
    sgHidePeriodicPopover();
  }, delayMs);
}

function sgPeriodicRefreshPanelReleasedStates() {
  if (!_sgPeriodicPanelEl) return;
  let releasedCount = 0;
  let lockedCount = 0;
  _sgPeriodicPanelEl.querySelectorAll(".sg-periodic-tile").forEach(tile => {
    const sym = tile.dataset.symbol;
    const elem = sgPeriodicGetElement(sym);
    if (!elem) return;
    if (elem.released) releasedCount++;
    else if (elem.locked) lockedCount++;
    const wasSelected = tile.classList.contains("sg-periodic-selected");
    const stateCls = elem.released
      ? `sg-periodic-released sg-periodic-accent-${elem.accent}`
      : elem.locked
        ? "sg-periodic-locked"
        : "sg-periodic-coming-soon";
    tile.className = `sg-periodic-tile ${stateCls}${wasSelected ? " sg-periodic-selected" : ""}`;
    tile.setAttribute(
      "aria-label",
      `${elem.z} ${elem.name}${elem.released ? ` (${elem.title})` : elem.locked ? ` (${elem.lockReason || "Locked"})` : " (Coming soon)"}`
    );
    tile.dataset.released = elem.released ? "true" : "false";
    tile.dataset.locked = elem.locked ? "true" : "false";
  });
  const countEl = _sgPeriodicPanelEl.querySelector('[data-sg-periodic-released-count="true"]');
  if (countEl) {
    countEl.textContent = `${releasedCount} released`;
  }
  const lockedLegend = _sgPeriodicPanelEl.querySelector('[data-sg-periodic-locked-legend="true"]');
  const lockedCountEl = _sgPeriodicPanelEl.querySelector('[data-sg-periodic-locked-count="true"]');
  if (lockedLegend && lockedCountEl) {
    lockedLegend.hidden = lockedCount === 0;
    lockedCountEl.textContent = `${lockedCount} locked`;
  }
  sgSyncPeriodicModeButtonLabel();
}

function sgPeriodicRebuildFooterPills() {
  if (!_sgPeriodicPanelEl) return;
  const container = _sgPeriodicPanelEl.querySelector(".sg-periodic-footer-pills");
  if (!container) return;
  while (container.firstChild) container.removeChild(container.firstChild);
  const models = sgPeriodicGetOtherModels();
  if (!models.length) {
    container.appendChild(sgPeriodicCreateEl("span", {
      className: "sg-periodic-footer-empty",
      textContent: "None on this account"
    }));
    return;
  }
  models.forEach(model => {
    const pill = sgPeriodicCreateEl("button", {
      type: "button",
      className: `sg-periodic-other-pill${model.locked ? " sg-periodic-other-locked" : ""}`,
      textContent: model.locked ? `\uD83D\uDD12 ${model.label}` : model.label,
      title: model.locked ? (model.lockReason || "Locked on this account") : (model.description || model.label),
      "aria-pressed": "false",
      "aria-disabled": model.locked ? "true" : "false",
      dataset: { modelId: model.id }
    });
    pill.addEventListener("click", e => {
      e.preventDefault();
      e.stopPropagation();
      sgPeriodicSelectOtherModel(model);
    });
    container.appendChild(pill);
  });
}

function sgPeriodicUpdateSelectionClasses() {
  if (!_sgPeriodicPanelEl) return;
  const state = sgPeriodicReadState();
  _sgPeriodicPanelEl.querySelectorAll(".sg-periodic-tile").forEach(tile => {
    const isSelected = Boolean(state && state.selectedType === "element" && state.symbol === tile.dataset.symbol);
    tile.classList.toggle("sg-periodic-selected", isSelected);
    tile.setAttribute("aria-pressed", isSelected ? "true" : "false");
  });
  _sgPeriodicPanelEl.querySelectorAll(".sg-periodic-other-pill").forEach(pill => {
    const isSelected = Boolean(state && state.selectedType === "other" && state.id === pill.dataset.modelId);
    pill.classList.toggle("sg-periodic-selected", isSelected);
    pill.setAttribute("aria-pressed", isSelected ? "true" : "false");
  });
}

function sgPeriodicSwitchToDynamicOption(elem) {
  const modeBtn = document.querySelector('[data-test-id="bard-mode-menu-button"]');
  if (!modeBtn) return false;
  const matchOpt = items => {
    if (elem.optionTestId) {
      for (const it of items) {
        if (it.getAttribute("data-test-id") === elem.optionTestId) return it;
      }
    }
    const re = new RegExp(`\\b${elem.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    for (const it of items) {
      if (re.test(sgPeriodicCollectSpacedText(it))) return it;
    }
    if (elem.optionMatchText) {
      const targetLower = elem.optionMatchText.toLowerCase();
      for (const it of items) {
        if (sgPeriodicCollectSpacedText(it).toLowerCase().includes(targetLower)) return it;
      }
    }
    return null;
  };
  const existing = document.querySelectorAll('[data-test-id^="bard-mode-option-"]');
  if (existing.length > 0) {
    const found = matchOpt(existing);
    if (found) {
      found.click();
      return true;
    }
  }
  if (typeof ensureModeMenuHideStyle === "function") ensureModeMenuHideStyle();
  if (document.body) document.body.classList.add("sg-hiding-mode-menu");
  const hideCleanup = () => {
    if (document.body) document.body.classList.remove("sg-hiding-mode-menu");
  };
  const safety = setTimeout(hideCleanup, 2000);
  const trigger = modeBtn.querySelector("button.input-area-switch") || modeBtn.querySelector("button") || modeBtn;
  sgPeriodicRunWithBypass(() => trigger.click());
  let ticks = 0;
  const poll = setInterval(() => {
    ticks++;
    const items = document.querySelectorAll('[data-test-id^="bard-mode-option-"]');
    if (items.length === 0) {
      if (ticks >= 40) {
        clearInterval(poll);
        document.body && document.body.click();
        clearTimeout(safety);
        setTimeout(hideCleanup, 350);
      }
      return;
    }
    clearInterval(poll);
    sgPeriodicScanGeminiCatalogFromDom();
    const found = matchOpt(items);
    if (found) {
      found.click();
    } else {
      document.body && document.body.click();
    }
    clearTimeout(safety);
    setTimeout(hideCleanup, 350);
  }, 25);
  return true;
}

async function sgPeriodicApplyThinkingLevelByIndex(levelObj, allLevels) {
  const modeBtn = document.querySelector('button[aria-label="Open mode picker"]') || document.querySelector('[data-test-id="bard-mode-menu-button"]');
  if (!modeBtn) return;
  const trigger = modeBtn.querySelector("button.input-area-switch") || modeBtn.querySelector("button") || modeBtn;
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const pickTargetItem = items => {
    const wantLabel = (levelObj.label || "").trim().toLowerCase();
    for (const it of items) {
      const txt = ((it.querySelector(".label") || it).textContent || "").trim().replace(/\s+/g, " ").toLowerCase();
      if (wantLabel && txt === wantLabel) return it;
    }
    const maxIdx = Math.max(1, allLevels.length - 1);
    const scaled = allLevels.length === items.length
      ? levelObj.index
      : Math.round((levelObj.index / maxIdx) * (items.length - 1));
    return items[Math.max(0, Math.min(items.length - 1, scaled))] || null;
  };

  if (typeof ensureModeMenuHideStyle === "function") ensureModeMenuHideStyle();
  if (document.body) document.body.classList.add("sg-hiding-mode-menu");
  const cleanup = () => {
    if (document.body) document.body.classList.remove("sg-hiding-mode-menu");
  };
  const safety = setTimeout(cleanup, 2500);
  try {
    let items = typeof findEffortLevelItems === "function" ? findEffortLevelItems() : null;
    if (!items) {
      sgPeriodicRunWithBypass(() => trigger.click());
      for (let i = 0; i < 40 && !items; i++) {
        await wait(25);
        items = typeof findEffortLevelItems === "function" ? findEffortLevelItems() : null;
        if (!items) {
          const subTrigger = document.querySelector('gem-menu-item[value="thinking_level"]') ||
            Array.from(document.querySelectorAll("gem-menu-item")).find(it => it.getAttribute("aria-haspopup") === "true");
          if (subTrigger) {
            subTrigger.click();
            await wait(40);
            items = typeof findEffortLevelItems === "function" ? findEffortLevelItems() : null;
          }
        }
      }
    }
    if (items && items.length >= 2) {
      sgPeriodicScanGeminiCatalogFromDom();
      const target = pickTargetItem(items);
      if (target && target.getAttribute("aria-disabled") !== "true" && !target.hasAttribute("disabled")) {
        target.click();
      }
    }
    document.body && document.body.click();
  } catch (e) {} finally {
    clearTimeout(safety);
    setTimeout(cleanup, 350);
  }
}

function sgPeriodicSelectElement(elem, thinkingLevel) {
  if (!elem) return;
  const liveElem = (elem.symbol && sgPeriodicGetElement(elem.symbol)) || elem;
  const levels = sgPeriodicGetThinkingLevels(liveElem.symbol);
  const prevState = sgPeriodicReadState();
  const defaultLevel = levels[Math.min(1, levels.length - 1)].value;
  const validValues = new Set(levels.map(l => l.value));
  const requested = typeof thinkingLevel === "string" ? thinkingLevel.trim().toLowerCase() : "";
  const level = requested && validValues.has(requested)
    ? requested
    : (prevState && prevState.thinkingLevel && validValues.has(prevState.thinkingLevel) ? prevState.thinkingLevel : defaultLevel);
  const levelIdx = Math.max(0, levels.findIndex(l => l.value === level));
  const levelObj = levels[levelIdx] || { value: level, label: level, index: levelIdx };

  sgPeriodicSaveState({
    selectedType: "element",
    symbol: liveElem.symbol,
    id: null,
    name: liveElem.name,
    released: liveElem.released,
    thinkingLevel: level
  });

  sgPeriodicUpdateSelectionClasses();
  sgSyncPeriodicModeButtonLabel();
  sgSyncPeriodicSendBlockState();
  sgClosePeriodicPanel({ restoreFocus: false });

  if (_sgPeriodicThinkingTimer) {
    clearTimeout(_sgPeriodicThinkingTimer);
    _sgPeriodicThinkingTimer = null;
  }

  if (liveElem.released) {
    sgPeriodicRunWithBypass(() => {
      if (liveElem.optionTestId || (!liveElem.realMode && liveElem.optionMatchText)) {
        sgPeriodicSwitchToDynamicOption(liveElem);
      } else if (liveElem.realMode) {
        if (typeof switchModeSilent === "function") {
          switchModeSilent(liveElem.realMode);
        } else if (typeof switchMode === "function") {
          switchMode(liveElem.realMode);
        }
      } else {
        sgPeriodicSwitchToDynamicOption(liveElem);
      }
    });
    const isExtended = levelIdx >= Math.ceil(levels.length / 2);
    const mappedLevel = isExtended ? "extended" : "standard";
    const isStandardThree = levels.length <= 3 && ["low", "medium", "high"].includes(level);
    _sgPeriodicThinkingTimer = setTimeout(() => {
      _sgPeriodicThinkingTimer = null;
      if (!isExtensionEnabled || !isPeriodicModelPickerEnabled) return;
      sgPeriodicRunWithBypass(() => {
        try {
          if (isStandardThree && typeof setThinkingLevel === "function") {
            const res = setThinkingLevel(level);
            if (res && typeof res.catch === "function") res.catch(() => {});
          } else if (levels.length > 3 || !isStandardThree) {
            const res = sgPeriodicApplyThinkingLevelByIndex(levelObj, levels);
            if (res && typeof res.catch === "function") res.catch(() => {});
          } else if (typeof switchThinkingLevelSilent === "function") {
            const res = switchThinkingLevelSilent(mappedLevel);
            if (res && typeof res.catch === "function") res.catch(() => {});
          }
        } catch (e) {}
      });
    }, 450);
  }
}

function sgPeriodicSelectOtherModel(model) {
  if (!model) return;
  if (model.locked) {
    if (typeof showToast === "function") {
      showToast(`${model.label}: ${model.lockReason || "Unavailable on this account"}`, "info");
    }
    return;
  }
  if (_sgPeriodicThinkingTimer) {
    clearTimeout(_sgPeriodicThinkingTimer);
    _sgPeriodicThinkingTimer = null;
  }
  const prevState = sgPeriodicReadState();
  sgPeriodicSaveState({
    selectedType: "other",
    symbol: null,
    id: model.id,
    name: model.label,
    released: true,
    thinkingLevel: (prevState && prevState.thinkingLevel) || "medium"
  });

  sgPeriodicUpdateSelectionClasses();
  sgSyncPeriodicModeButtonLabel();
  sgSyncPeriodicSendBlockState();
  sgClosePeriodicPanel({ restoreFocus: false });

  sgPeriodicRunWithBypass(() => {
    if (model.optionTestId || (!model.realMode && model.optionMatchText)) {
      sgPeriodicSwitchToDynamicOption({
        name: model.label,
        optionTestId: model.optionTestId || null,
        optionMatchText: model.optionMatchText || model.label
      });
    } else if (model.realMode) {
      if (typeof switchModeSilent === "function") {
        switchModeSilent(model.realMode);
      } else if (typeof switchMode === "function") {
        switchMode(model.realMode);
      }
    }
  });
}

function sgEnsurePeriodicPopover() {
  if (_sgPeriodicPopoverEl && _sgPeriodicPopoverEl.isConnected) return _sgPeriodicPopoverEl;
  const pop = sgPeriodicCreateEl("div", {
    id: "sg-periodic-popover",
    className: "sg-periodic-popover",
    role: "region",
    "aria-label": "Element details",
    "aria-hidden": "true"
  });
  pop.addEventListener("mouseenter", () => {
    if (_sgPeriodicPopoverInteractive) {
      sgClearPeriodicPopoverTimer();
      sgClearPeriodicIntentTimer();
    }
  });
  pop.addEventListener("mouseleave", () => {
    _sgPeriodicLastInteractiveExit = null;
    if (_sgPeriodicPopoverInteractive) {
      sgSchedulePeriodicPopoverHide(90);
    } else {
      sgHidePeriodicPopover();
    }
  });
  pop.addEventListener("focusin", () => {
    if (_sgPeriodicPopoverInteractive) {
      sgClearPeriodicPopoverTimer();
      sgClearPeriodicIntentTimer();
    }
  });
  pop.addEventListener("focusout", e => {
    if (!pop.contains(e.relatedTarget) && (!_sgPeriodicHoveredTile || !_sgPeriodicHoveredTile.contains(e.relatedTarget))) {
      _sgPeriodicLastInteractiveExit = null;
      if (_sgPeriodicPopoverInteractive) {
        sgSchedulePeriodicPopoverHide(90);
      } else {
        sgHidePeriodicPopover();
      }
    }
  });
  document.body.appendChild(pop);
  _sgPeriodicPopoverEl = pop;
  return pop;
}

function sgPositionPeriodicPopover(tileEl, popEl) {
  const margin = 8;
  const vw = window.innerWidth || 1280;
  const vh = window.innerHeight || 800;
  const tRect = tileEl.getBoundingClientRect();
  const pRect = popEl.getBoundingClientRect();
  const pW = pRect.width || 260;
  const pH = pRect.height || 150;
  const gap = popEl.classList.contains("sg-periodic-popover-interactive") ? 4 : 8;

  let left = tRect.left + tRect.width / 2 - pW / 2;
  left = Math.max(margin, Math.min(vw - pW - margin, left));

  let top = tRect.top - pH - gap;
  let placedBelow = false;
  if (top < margin) {
    top = tRect.bottom + gap;
    placedBelow = true;
  }
  top = Math.max(margin, Math.min(vh - pH - margin, top));

  popEl.style.left = `${Math.round(left)}px`;
  popEl.style.top = `${Math.round(top)}px`;
  popEl.classList.toggle("sg-periodic-popover-below", placedBelow);
}

function sgPeriodicCreateFactCell(label, value) {
  return sgPeriodicCreateEl("div", { className: "sg-periodic-pop-fact" }, [
    sgPeriodicCreateEl("span", { className: "sg-periodic-pop-fact-label", textContent: label }),
    sgPeriodicCreateEl("span", { className: "sg-periodic-pop-fact-val", textContent: value })
  ]);
}

function sgShowPeriodicPopover(tileEl, elemInput) {
  if (!_sgPeriodicIsOpen || !tileEl || !elemInput) return;
  const elem = (typeof elemInput === "string" ? sgPeriodicGetElement(elemInput) : (elemInput.symbol ? sgPeriodicGetElement(elemInput.symbol) : elemInput));
  if (!elem) return;

  sgClearPeriodicPopoverTimer();
  sgClearPeriodicIntentTimer();
  _sgPeriodicHoveredTile = tileEl;
  _sgPeriodicPopoverInteractive = Boolean(elem.released);
  _sgPeriodicLastInteractiveExit = null;

  const pop = sgEnsurePeriodicPopover();
  while (pop.firstChild) pop.removeChild(pop.firstChild);

  pop.classList.toggle("sg-periodic-popover-interactive", _sgPeriodicPopoverInteractive);
  pop.classList.toggle("sg-periodic-popover-passive", !_sgPeriodicPopoverInteractive);

  const badge = sgPeriodicCreateEl("div", {
    className: `sg-periodic-pop-badge sg-periodic-accent-${elem.accent}`
  }, [
    sgPeriodicCreateEl("span", { className: "sg-periodic-pop-num", textContent: String(elem.z) }),
    sgPeriodicCreateEl("span", { className: "sg-periodic-pop-sym", textContent: elem.symbol })
  ]);

  const titleRow = sgPeriodicCreateEl("div", { className: "sg-periodic-pop-title-row" }, [
    sgPeriodicCreateEl("div", { className: "sg-periodic-pop-title", textContent: (elem.released || elem.locked) ? elem.title : elem.name }),
    sgPeriodicCreateEl("span", {
      className: `sg-periodic-pop-status ${elem.released ? "sg-periodic-status-live" : elem.locked ? "sg-periodic-status-locked" : "sg-periodic-status-soon"}`,
      textContent: elem.released ? (elem.isDynamicRelease ? "New" : "Released") : (elem.locked ? "\uD83D\uDD12 Locked" : "Coming soon")
    })
  ]);

  const subText = elem.released ? elem.subtitle : elem.locked ? (elem.lockReason || "Unavailable on this plan") : elem.category;
  const meta = sgPeriodicCreateEl("div", { className: "sg-periodic-pop-meta" }, [
    titleRow,
    sgPeriodicCreateEl("div", { className: "sg-periodic-pop-sub", textContent: subText })
  ]);

  pop.appendChild(sgPeriodicCreateEl("div", { className: "sg-periodic-pop-head" }, [badge, meta]));

  if (elem.released) {
    if (elem.description) {
      pop.appendChild(sgPeriodicCreateEl("div", {
        className: "sg-periodic-pop-desc",
        textContent: elem.description
      }));
    }

    pop.appendChild(sgPeriodicCreateEl("div", {
      className: "sg-periodic-pop-chem-inline",
      textContent: `Z=${elem.z} \u00B7 ${elem.category} \u00B7 ${elem.mass}`
    }));

    const state = sgPeriodicReadState();
    const levels = sgPeriodicGetThinkingLevels(elem.symbol).slice(0, SG_PERIODIC_MAX_THINKING_LEVELS);
    const defaultLevel = levels[Math.min(1, levels.length - 1)].value;
    const currentLevel = state && state.thinkingLevel && levels.some(l => l.value === state.thinkingLevel)
      ? state.thinkingLevel
      : defaultLevel;

    const seg = sgPeriodicCreateEl("div", {
      className: "sg-periodic-level-seg",
      role: "radiogroup",
      "aria-label": "Thinking level",
      dataset: { count: String(levels.length) }
    });

    const buttons = levels.map((lvl, idx) => {
      const checked = currentLevel === lvl.value;
      const btn = sgPeriodicCreateEl("button", {
        type: "button",
        className: `sg-periodic-level-btn${checked ? " sg-active" : ""}`,
        role: "radio",
        "aria-checked": checked ? "true" : "false",
        tabindex: checked ? "0" : "-1",
        textContent: lvl.label,
        dataset: { level: lvl.value, levelIndex: String(idx) }
      });

      btn.addEventListener("click", e => {
        e.preventDefault();
        e.stopPropagation();
        sgPeriodicSelectElement(elem, lvl.value);
      });

      btn.addEventListener("keydown", e => {
        if (typeof sgIsImeComposing === "function" && sgIsImeComposing(e)) return;
        let nextIdx = -1;
        if (e.key === "ArrowRight" || e.key === "ArrowDown") nextIdx = (idx + 1) % levels.length;
        else if (e.key === "ArrowLeft" || e.key === "ArrowUp") nextIdx = (idx - 1 + levels.length) % levels.length;
        else if (e.key === "Home") nextIdx = 0;
        else if (e.key === "End") nextIdx = levels.length - 1;
        if (nextIdx !== -1) {
          e.preventDefault();
          e.stopPropagation();
          buttons.forEach((b, bi) => {
            const active = bi === nextIdx;
            b.classList.toggle("sg-active", active);
            b.setAttribute("aria-checked", active ? "true" : "false");
            b.tabIndex = active ? 0 : -1;
          });
          buttons[nextIdx].focus();
        }
      });

      return btn;
    });

    buttons.forEach(b => seg.appendChild(b));
    const levelWrap = sgPeriodicCreateEl("div", { className: "sg-periodic-pop-levels" }, [
      sgPeriodicCreateEl("div", { className: "sg-periodic-pop-levels-label", textContent: "Thinking level" }),
      seg
    ]);
    pop.appendChild(levelWrap);
  } else if (elem.locked) {
    if (elem.description) {
      pop.appendChild(sgPeriodicCreateEl("div", {
        className: "sg-periodic-pop-desc",
        textContent: elem.description
      }));
    }
    pop.appendChild(sgPeriodicCreateEl("div", {
      className: "sg-periodic-pop-chem-inline",
      textContent: `Z=${elem.z} \u00B7 ${elem.category} \u00B7 ${elem.mass} \u00B7 ${elem.config}`
    }));
  } else {
    const facts = sgPeriodicCreateEl("div", { className: "sg-periodic-pop-facts" }, [
      sgPeriodicCreateFactCell("Atomic mass", elem.mass),
      sgPeriodicCreateFactCell("Phase (STP)", elem.phase),
      sgPeriodicCreateFactCell("Position", elem.positionLabel),
      sgPeriodicCreateFactCell("Block", elem.block)
    ]);
    pop.appendChild(facts);

    const configRow = sgPeriodicCreateEl("div", { className: "sg-periodic-pop-config" }, [
      sgPeriodicCreateEl("span", { className: "sg-periodic-pop-fact-label", textContent: "Electron config" }),
      sgPeriodicCreateEl("span", { className: "sg-periodic-pop-config-val", textContent: elem.config })
    ]);
    pop.appendChild(configRow);
  }

  pop.setAttribute("aria-hidden", "false");
  pop.classList.add("sg-periodic-visible");
  sgPositionPeriodicPopover(tileEl, pop);
}

function sgEnsurePeriodicPanel() {
  if (_sgPeriodicPanelEl && _sgPeriodicPanelEl.isConnected) return _sgPeriodicPanelEl;

  const refreshBtn = sgPeriodicCreateEl("button", {
    type: "button",
    className: "sg-periodic-refresh-btn",
    "aria-label": "Scan available Gemini models",
    title: "Refresh available models for this account"
  }, [sgPeriodicCreateRefreshSvg()]);
  refreshBtn.addEventListener("click", e => {
    e.preventDefault();
    e.stopPropagation();
    sgPeriodicProbeCatalogSilent({ force: true });
  });

  const closeBtn = sgPeriodicCreateEl("button", {
    type: "button",
    className: "sg-periodic-close-btn",
    "aria-label": "Close model periodic table",
    title: "Close"
  }, [sgPeriodicCreateCloseSvg()]);
  closeBtn.addEventListener("click", e => {
    e.preventDefault();
    e.stopPropagation();
    sgClosePeriodicPanel({ restoreFocus: true });
  });

  const header = sgPeriodicCreateEl("div", { className: "sg-periodic-header" }, [
    sgPeriodicCreateEl("div", { className: "sg-periodic-header-left" }, [
      sgPeriodicCreateSparkleSvg(),
      sgPeriodicCreateEl("span", { className: "sg-periodic-title", textContent: "Model periodic table" })
    ]),
    sgPeriodicCreateEl("div", { className: "sg-periodic-header-actions" }, [refreshBtn, closeBtn])
  ]);

  const grid = sgPeriodicCreateEl("div", { className: "sg-periodic-grid" });

  for (let g = 1; g <= 18; g++) {
    const gLabel = sgPeriodicCreateEl("div", {
      className: "sg-periodic-axis-col",
      textContent: String(g),
      "aria-hidden": "true"
    });
    gLabel.style.gridColumn = String(g + 1);
    gLabel.style.gridRow = "1";
    grid.appendChild(gLabel);
  }

  for (let p = 1; p <= 7; p++) {
    const pLabel = sgPeriodicCreateEl("div", {
      className: "sg-periodic-axis-row",
      textContent: String(p),
      "aria-hidden": "true"
    });
    pLabel.style.gridColumn = "1";
    pLabel.style.gridRow = String(p + 1);
    grid.appendChild(pLabel);
  }

  const initialReleasedCount = sgPeriodicGetAllReleasedElements().length;
  const initialLockedCount = sgPeriodicGetAllLockedElements().length;
  const lockedLegendItem = sgPeriodicCreateEl("span", {
    className: "sg-periodic-legend-item",
    "data-sg-periodic-locked-legend": "true"
  }, [
    sgPeriodicCreateEl("span", { className: "sg-periodic-legend-dot sg-periodic-dot-locked", "aria-hidden": "true" }),
    sgPeriodicCreateEl("span", {
      "data-sg-periodic-locked-count": "true",
      textContent: `${initialLockedCount} locked`
    })
  ]);
  lockedLegendItem.hidden = initialLockedCount === 0;

  const hero = sgPeriodicCreateEl("div", { className: "sg-periodic-hero" }, [
    sgPeriodicCreateEl("div", { className: "sg-periodic-hero-title", textContent: "Gemini 4" }),
    sgPeriodicCreateEl("div", { className: "sg-periodic-legend" }, [
      sgPeriodicCreateEl("span", { className: "sg-periodic-legend-item" }, [
        sgPeriodicCreateEl("span", { className: "sg-periodic-legend-dot sg-periodic-dot-released", "aria-hidden": "true" }),
        sgPeriodicCreateEl("span", {
          "data-sg-periodic-released-count": "true",
          textContent: `${initialReleasedCount} released`
        })
      ]),
      lockedLegendItem,
      sgPeriodicCreateEl("span", { className: "sg-periodic-legend-item" }, [
        sgPeriodicCreateEl("span", { className: "sg-periodic-legend-dot sg-periodic-dot-soon", "aria-hidden": "true" }),
        sgPeriodicCreateEl("span", { textContent: "Coming soon" })
      ])
    ])
  ]);
  hero.style.gridColumn = "4 / 14";
  hero.style.gridRow = "2 / 5";
  grid.appendChild(hero);

  const phLanthanides = sgPeriodicCreateEl("div", {
    className: "sg-periodic-placeholder",
    textContent: "57\u201371",
    "aria-hidden": "true"
  });
  phLanthanides.style.gridColumn = "4";
  phLanthanides.style.gridRow = "7";
  grid.appendChild(phLanthanides);

  const phActinides = sgPeriodicCreateEl("div", {
    className: "sg-periodic-placeholder",
    textContent: "89\u2013103",
    "aria-hidden": "true"
  });
  phActinides.style.gridColumn = "4";
  phActinides.style.gridRow = "8";
  grid.appendChild(phActinides);

  const fLabel1 = sgPeriodicCreateEl("div", {
    className: "sg-periodic-fblock-label",
    textContent: "57\u201371",
    "aria-hidden": "true"
  });
  fLabel1.style.gridColumn = "2 / 5";
  fLabel1.style.gridRow = "10";
  grid.appendChild(fLabel1);

  const fLabel2 = sgPeriodicCreateEl("div", {
    className: "sg-periodic-fblock-label",
    textContent: "89\u2013103",
    "aria-hidden": "true"
  });
  fLabel2.style.gridColumn = "2 / 5";
  fLabel2.style.gridRow = "11";
  grid.appendChild(fLabel2);

  for (const baseElem of SG_PERIODIC_BY_SYMBOL.values()) {
    const elem = sgPeriodicGetElement(baseElem.symbol);
    const gridCol = elem.group + 1;
    const gridRow = elem.period <= 7 ? elem.period + 1 : (elem.period === 8 ? 10 : 11);
    const tile = sgPeriodicCreateEl("button", {
      type: "button",
      className: `sg-periodic-tile ${elem.released ? `sg-periodic-released sg-periodic-accent-${elem.accent}` : "sg-periodic-coming-soon"}`,
      "aria-label": `${elem.z} ${elem.name}${elem.released ? ` (${elem.title})` : " (Coming soon)"}`,
      "aria-pressed": "false",
      dataset: {
        atomicNumber: elem.z,
        symbol: elem.symbol,
        released: elem.released ? "true" : "false"
      }
    }, [
      sgPeriodicCreateEl("span", { className: "sg-periodic-tile-num", textContent: String(elem.z) }),
      sgPeriodicCreateEl("span", { className: "sg-periodic-tile-sym", textContent: elem.symbol })
    ]);
    tile.style.gridColumn = String(gridCol);
    tile.style.gridRow = String(gridRow);

    const sym = elem.symbol;
    tile.addEventListener("mouseenter", e => {
      if (sgPeriodicShouldDeferTileSwitch(e, tile)) {
        sgClearPeriodicIntentTimer();
        _sgPeriodicIntentTile = tile;
        _sgPeriodicIntentTimer = setTimeout(() => {
          _sgPeriodicIntentTimer = null;
          _sgPeriodicIntentTile = null;
          if (_sgPeriodicIsOpen) {
            sgShowPeriodicPopover(tile, sgPeriodicGetElement(sym));
          }
        }, 180);
        return;
      }
      sgShowPeriodicPopover(tile, sgPeriodicGetElement(sym));
    });
    tile.addEventListener("mouseleave", e => {
      if (_sgPeriodicIntentTile === tile) {
        sgClearPeriodicIntentTimer();
      }
      if (_sgPeriodicHoveredTile !== tile) return;
      const live = sgPeriodicGetElement(sym);
      if (live && live.released) {
        _sgPeriodicLastInteractiveExit = {
          x: e && typeof e.clientX === "number" ? e.clientX : 0,
          y: e && typeof e.clientY === "number" ? e.clientY : 0,
          tileRect: tile.getBoundingClientRect(),
          at: Date.now()
        };
        sgSchedulePeriodicPopoverHide(220);
      } else {
        sgHidePeriodicPopover();
      }
    });
    tile.addEventListener("focus", () => sgShowPeriodicPopover(tile, sgPeriodicGetElement(sym)));
    tile.addEventListener("blur", e => {
      if (_sgPeriodicHoveredTile !== tile) return;
      const live = sgPeriodicGetElement(sym);
      if (!live || !live.released) {
        sgHidePeriodicPopover();
      } else if (!_sgPeriodicPopoverEl || !_sgPeriodicPopoverEl.contains(e.relatedTarget)) {
        sgSchedulePeriodicPopoverHide(140);
      }
    });
    tile.addEventListener("click", e => {
      e.preventDefault();
      e.stopPropagation();
      sgPeriodicSelectElement(sgPeriodicGetElement(sym));
    });

    grid.appendChild(tile);
  }

  const gridScroll = sgPeriodicCreateEl("div", { className: "sg-periodic-grid-wrap" }, [grid]);

  const footer = sgPeriodicCreateEl("div", { className: "sg-periodic-footer" }, [
    sgPeriodicCreateEl("span", { className: "sg-periodic-footer-label", textContent: "Other models" }),
    sgPeriodicCreateEl("div", { className: "sg-periodic-footer-pills" })
  ]);

  const panel = sgPeriodicCreateEl("div", {
    id: "sg-periodic-model-panel",
    className: "sg-periodic-panel",
    role: "dialog",
    "aria-modal": "false",
    "aria-label": "Model periodic table"
  }, [header, gridScroll, footer]);

  panel.addEventListener("mouseleave", () => {
    if (!_sgPeriodicPopoverInteractive) {
      sgHidePeriodicPopover();
    } else {
      sgSchedulePeriodicPopoverHide(220);
    }
  });

  document.body.appendChild(panel);
  _sgPeriodicPanelEl = panel;
  sgPeriodicRebuildFooterPills();
  return panel;
}

function sgPositionPeriodicPanel(triggerEl) {
  if (!_sgPeriodicPanelEl) return;
  const margin = 12;
  const vw = window.innerWidth || 1280;
  const vh = window.innerHeight || 800;
  const rect = _sgPeriodicPanelEl.getBoundingClientRect();
  const panelW = rect.width || Math.min(860, vw - 24);
  const panelH = rect.height || 460;

  let left = (vw - panelW) / 2;
  let top = vh - panelH - 84;

  if (triggerEl && typeof triggerEl.getBoundingClientRect === "function") {
    const tRect = triggerEl.getBoundingClientRect();
    if (tRect.width > 0 || tRect.height > 0) {
      left = tRect.left + tRect.width / 2 - panelW / 2;
      const aboveTop = tRect.top - panelH - 10;
      const belowTop = tRect.bottom + 10;
      top = aboveTop >= margin ? aboveTop : (belowTop + panelH <= vh - margin ? belowTop : vh - panelH - margin);
    }
  }

  left = Math.max(margin, Math.min(vw - panelW - margin, left));
  top = Math.max(margin, Math.min(vh - panelH - margin, top));

  _sgPeriodicPanelEl.style.left = `${Math.round(left)}px`;
  _sgPeriodicPanelEl.style.top = `${Math.round(top)}px`;
}

function sgHandlePeriodicOutsideClick(e) {
  if (!_sgPeriodicIsOpen || _sgPeriodicProbeInFlight) return;
  const t = e.target;
  if (_sgPeriodicPanelEl && _sgPeriodicPanelEl.contains(t)) return;
  if (_sgPeriodicPopoverEl && _sgPeriodicPopoverEl.contains(t)) return;
  if (_sgPeriodicLastTriggerEl && _sgPeriodicLastTriggerEl.contains(t)) return;
  sgClosePeriodicPanel({ restoreFocus: false });
}

function sgHandlePeriodicKeydown(e) {
  if (!_sgPeriodicIsOpen || _sgPeriodicProbeInFlight || !e) return;
  if (typeof sgIsImeComposing === "function" && sgIsImeComposing(e)) return;
  if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    if (typeof e.stopImmediatePropagation === "function") {
      e.stopImmediatePropagation();
    }
    sgClosePeriodicPanel({ restoreFocus: true });
  }
}

function sgHandlePeriodicResize() {
  if (!_sgPeriodicIsOpen) return;
  sgHidePeriodicPopover();
  sgPositionPeriodicPanel(_sgPeriodicLastTriggerEl);
}

function sgBindPeriodicOpenListeners() {
  if (_sgPeriodicOpenListenersBound) return;
  _sgPeriodicOpenListenersBound = true;
  if (typeof SG !== "undefined" && SG && SG.dispatcher) {
    SG.dispatcher.register("periodic:outside-mousedown", "document", "mousedown", sgHandlePeriodicOutsideClick, SG.dispatcher.PRIORITY.UI_CONTROLS);
    SG.dispatcher.register("periodic:open-keydown", "document", "keydown", sgHandlePeriodicKeydown, SG.dispatcher.PRIORITY.MODAL_ESCAPE);
  } else {
    document.addEventListener("mousedown", sgHandlePeriodicOutsideClick, true);
    document.addEventListener("keydown", sgHandlePeriodicKeydown, true);
  }
  window.addEventListener("resize", sgHandlePeriodicResize, { passive: true });
}

function sgUnbindPeriodicOpenListeners() {
  if (!_sgPeriodicOpenListenersBound) return;
  _sgPeriodicOpenListenersBound = false;
  if (typeof SG !== "undefined" && SG && SG.dispatcher) {
    SG.dispatcher.unregister("periodic:outside-mousedown");
    SG.dispatcher.unregister("periodic:open-keydown");
  } else {
    document.removeEventListener("mousedown", sgHandlePeriodicOutsideClick, true);
    document.removeEventListener("keydown", sgHandlePeriodicKeydown, true);
  }
  window.removeEventListener("resize", sgHandlePeriodicResize);
}

function sgOpenPeriodicPanel(triggerEl) {
  if (!isExtensionEnabled || !isPeriodicModelPickerEnabled) return;
  _sgPeriodicLastTriggerEl = triggerEl || document.querySelector('[data-test-id="bard-mode-menu-button"]');
  sgPeriodicScanGeminiCatalogFromDom();
  const panel = sgEnsurePeriodicPanel();
  sgPeriodicRefreshPanelReleasedStates();
  sgPeriodicRebuildFooterPills();
  sgPeriodicUpdateSelectionClasses();
  panel.classList.add("sg-periodic-open");
  _sgPeriodicIsOpen = true;
  sgPositionPeriodicPanel(_sgPeriodicLastTriggerEl);
  sgBindPeriodicOpenListeners();
  if (!_sgPeriodicProbedThisSession) {
    if (_sgPeriodicProbeTimer) clearTimeout(_sgPeriodicProbeTimer);
    _sgPeriodicProbeTimer = setTimeout(() => {
      _sgPeriodicProbeTimer = null;
      if (_sgPeriodicIsOpen) sgPeriodicProbeCatalogSilent({ force: false });
    }, 60);
  }
}

function sgClosePeriodicPanel({ restoreFocus = false } = {}) {
  if (_sgPeriodicProbeTimer) {
    clearTimeout(_sgPeriodicProbeTimer);
    _sgPeriodicProbeTimer = null;
  }
  sgHidePeriodicPopover();
  _sgPeriodicIsOpen = false;
  sgUnbindPeriodicOpenListeners();
  if (_sgPeriodicPanelEl) {
    _sgPeriodicPanelEl.classList.remove("sg-periodic-open");
  }
  if (restoreFocus && _sgPeriodicLastTriggerEl && _sgPeriodicLastTriggerEl.isConnected) {
    const focusTarget = _sgPeriodicLastTriggerEl.querySelector("button") || _sgPeriodicLastTriggerEl;
    if (typeof focusTarget.focus === "function") {
      try {
        focusTarget.focus();
      } catch (e) {}
    }
  }
}

function sgHandlePeriodicTriggerClick(e) {
  if (!isExtensionEnabled || !isPeriodicModelPickerEnabled) return;
  if (_sgPeriodicBypassClick || _sgPeriodicBypassDepth > 0) return;
  if (document.body && (document.body.classList.contains("sg-hiding-mode-menu") || document.body.dataset.sgBgWorker === "true")) return;
  if (typeof window !== "undefined" && window.location && String(window.location.hash || "").includes("sg_orch_worker=1")) return;
  if (document.documentElement && document.documentElement.hasAttribute("data-sg-detecting-mode")) return;
  const target = e.target;
  if (!target || typeof target.closest !== "function") return;
  const modeBtn = target.closest('[data-test-id="bard-mode-menu-button"]');
  if (!modeBtn) return;

  e.preventDefault();
  e.stopPropagation();
  if (typeof e.stopImmediatePropagation === "function") {
    e.stopImmediatePropagation();
  }

  if (_sgPeriodicIsOpen) {
    sgClosePeriodicPanel({ restoreFocus: false });
  } else {
    sgOpenPeriodicPanel(modeBtn);
  }
}

function sgGetPeriodicBlockedElement() {
  if (!isExtensionEnabled || !isPeriodicModelPickerEnabled) return null;
  if (typeof document !== "undefined" && document.body && document.body.dataset.sgBgWorker === "true") return null;
  if (typeof window !== "undefined" && window.location && String(window.location.hash || "").includes("sg_orch_worker=1")) return null;
  const state = sgPeriodicReadState();
  if (!state || state.selectedType !== "element") return null;
  const live = state.symbol ? sgPeriodicGetElement(state.symbol) : null;
  if (live ? live.released : state.released) return null;
  return state;
}

function sgShowPeriodicSendBlockedToast() {
  const blocked = sgGetPeriodicBlockedElement();
  if (!blocked) return;
  const now = Date.now();
  if (now - _sgPeriodicLastBlockedToastAt < 1600) return;
  _sgPeriodicLastBlockedToastAt = now;
  const isVi = typeof sgIsVietnameseGeminiUI === "function" && sgIsVietnameseGeminiUI();
  const liveElem = blocked.symbol ? sgPeriodicGetElement(blocked.symbol) : null;
  const releasedNames = sgPeriodicGetAllReleasedElements().map(e => e.name).slice(0, 5).join(", ");
  const fallbackTarget = releasedNames || "Other models";
  const msg = liveElem && liveElem.locked
    ? (isVi
        ? `${blocked.name} đang bị khóa trên tài khoản này (${liveElem.lockReason || "không khả dụng"}). Chọn ${fallbackTarget} để gửi tin nhắn.`
        : `${blocked.name} is locked on this account (${liveElem.lockReason || "unavailable"}). Select ${fallbackTarget} to send messages.`)
    : (isVi
        ? `${blocked.name} chưa khả dụng (Coming soon). Chọn ${fallbackTarget} hoặc Other models để gửi tin nhắn.`
        : `${blocked.name} is coming soon. Select ${fallbackTarget}, or Other models to send messages.`);
  if (typeof showToast === "function") {
    showToast(msg, "info");
  }
}

function sgPeriodicIsStopButton(btn) {
  if (!btn || btn.nodeType !== 1) return false;
  if (btn.classList && btn.classList.contains("stop")) return true;
  if (typeof btn.querySelector === "function" && btn.querySelector('[fonticon="stop"], [data-mat-icon-name="stop"]')) return true;
  const aria = (btn.getAttribute("aria-label") || "").toLowerCase();
  if (aria.includes("stop") || aria.includes("dừng")) return true;
  return false;
}

function sgPeriodicIsMicButton(btn) {
  if (!btn || btn.nodeType !== 1) return false;
  if (typeof btn.querySelector === "function" && btn.querySelector('[fonticon="mic"], [data-mat-icon-name="mic"], [fonticon="mic_none"], [data-mat-icon-name="mic_none"]')) return true;
  const aria = (btn.getAttribute("aria-label") || "").toLowerCase();
  if (aria.includes("mic") || aria.includes("voice") || aria.includes("giọng nói") || aria.includes("thu âm")) return true;
  return false;
}

function sgPeriodicFindSendButtonFromTarget(target) {
  if (!target || typeof target.closest !== "function") return null;
  if (target.closest("#sg-periodic-model-panel, #sg-periodic-popover, [data-test-id=\"bard-mode-menu-button\"]")) return null;
  const btn = target.closest('button, [role="button"]');
  if (!btn || sgPeriodicIsStopButton(btn) || sgPeriodicIsMicButton(btn)) return null;
  if (btn.classList && btn.classList.contains("send-button")) return btn;
  if (btn.closest(".send-button-container, .send-button")) return btn;
  const tid = (btn.getAttribute("data-test-id") || btn.getAttribute("data-testid") || "").toLowerCase();
  if (tid === "send-button" || tid === "send_button") return btn;
  const inComposer = Boolean(btn.closest("input-area-v2, .input-area, .text-input-field, rich-textarea, .input-buttons-wrapper-bottom"));
  if (inComposer && typeof btn.querySelector === "function" && btn.querySelector('mat-icon[fonticon="send"], mat-icon[data-mat-icon-name="send"], mat-icon[fonticon="arrow_upward"], mat-icon[data-mat-icon-name="arrow_upward"], .send-button-icon')) {
    return btn;
  }
  const aria = (btn.getAttribute("aria-label") || "").trim().toLowerCase();
  if (inComposer && aria && (/^(send|gửi)(\s|$)/.test(aria) || aria.includes("send message") || aria.includes("gửi tin nhắn") || aria.includes("gửi câu lệnh"))) {
    return btn;
  }
  return null;
}

function sgPeriodicIsPromptInputTarget(target) {
  if (!target || typeof target.closest !== "function") return false;
  if (target.closest("#sg-periodic-model-panel, #sg-periodic-popover, #sg-command-palette-overlay, .sg-skills-overlay, #sg-fork-modal-overlay, #sg-folder-v2-overlay")) {
    return false;
  }
  return Boolean(target.closest('rich-textarea, .ql-editor, input-area-v2 textarea, .input-area [contenteditable="true"], .text-input-field [contenteditable="true"], [contenteditable="true"][role="textbox"]'));
}

function sgHandlePeriodicSendBlockPointer(e) {
  if (!sgGetPeriodicBlockedElement()) return;
  const sendBtn = sgPeriodicFindSendButtonFromTarget(e.target);
  if (!sendBtn) return;
  e.preventDefault();
  e.stopPropagation();
  if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
  if (e.type === "click") sgShowPeriodicSendBlockedToast();
}

function sgHandlePeriodicSendBlockKeydown(e) {
  if (!sgGetPeriodicBlockedElement()) return;
  if (e.key !== "Enter" && e.code !== "Enter" && e.code !== "NumpadEnter") return;
  if (e.shiftKey || e.altKey) return;
  if (typeof sgIsImeComposing === "function" && sgIsImeComposing(e)) return;
  if (typeof slashMenuVisible !== "undefined" && slashMenuVisible) return;
  if (typeof sgSkillMenuVisible !== "undefined" && sgSkillMenuVisible) return;
  if (!sgPeriodicIsPromptInputTarget(e.target)) return;
  e.preventDefault();
  e.stopPropagation();
  if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
  if (e.type === "keydown") sgShowPeriodicSendBlockedToast();
}

function sgHandlePeriodicSendBlockSubmit(e) {
  if (!sgGetPeriodicBlockedElement()) return;
  const t = e.target;
  if (!t || typeof t.closest !== "function") return;
  if (!t.closest("input-area-v2, .input-area, .text-input-field") && !(typeof t.querySelector === "function" && t.querySelector("rich-textarea, .ql-editor"))) {
    return;
  }
  e.preventDefault();
  e.stopPropagation();
  if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
  sgShowPeriodicSendBlockedToast();
}

function sgSyncPeriodicSendBlockState() {
  const blocked = Boolean(sgGetPeriodicBlockedElement());
  if (document.body && document.body.classList) {
    document.body.classList.toggle("sg-periodic-send-blocked", blocked);
  }
  if (blocked && !_sgPeriodicSendBlockBound) {
    _sgPeriodicSendBlockBound = true;
    if (typeof SG !== "undefined" && SG && SG.dispatcher) {
      const P = SG.dispatcher.PRIORITY.PERIODIC_SEND_BLOCK;
      SG.dispatcher.register("periodic:block-pointerdown", "document", "pointerdown", sgHandlePeriodicSendBlockPointer, P);
      SG.dispatcher.register("periodic:block-click", "document", "click", sgHandlePeriodicSendBlockPointer, P);
      SG.dispatcher.register("periodic:block-keydown", "document", "keydown", sgHandlePeriodicSendBlockKeydown, P);
      SG.dispatcher.register("periodic:block-keypress", "document", "keypress", sgHandlePeriodicSendBlockKeydown, P);
      SG.dispatcher.register("periodic:block-submit", "document", "submit", sgHandlePeriodicSendBlockSubmit, P);
    } else {
      document.addEventListener("pointerdown", sgHandlePeriodicSendBlockPointer, true);
      document.addEventListener("click", sgHandlePeriodicSendBlockPointer, true);
      document.addEventListener("keydown", sgHandlePeriodicSendBlockKeydown, true);
      document.addEventListener("keypress", sgHandlePeriodicSendBlockKeydown, true);
      document.addEventListener("submit", sgHandlePeriodicSendBlockSubmit, true);
    }
  } else if (!blocked && _sgPeriodicSendBlockBound) {
    _sgPeriodicSendBlockBound = false;
    if (typeof SG !== "undefined" && SG && SG.dispatcher) {
      SG.dispatcher.unregisterByPrefix("periodic:block-");
    } else {
      document.removeEventListener("pointerdown", sgHandlePeriodicSendBlockPointer, true);
      document.removeEventListener("click", sgHandlePeriodicSendBlockPointer, true);
      document.removeEventListener("keydown", sgHandlePeriodicSendBlockKeydown, true);
      document.removeEventListener("keypress", sgHandlePeriodicSendBlockKeydown, true);
      document.removeEventListener("submit", sgHandlePeriodicSendBlockSubmit, true);
    }
  }
}

function sgTeardownPeriodicModelPicker() {
  if (_sgPeriodicThinkingTimer) {
    clearTimeout(_sgPeriodicThinkingTimer);
    _sgPeriodicThinkingTimer = null;
  }
  if (_sgPeriodicProbeTimer) {
    clearTimeout(_sgPeriodicProbeTimer);
    _sgPeriodicProbeTimer = null;
  }
  _sgPeriodicProbeInFlight = false;
  sgClosePeriodicPanel({ restoreFocus: false });
  if (_sgPeriodicCaptureBound) {
    _sgPeriodicCaptureBound = false;
    if (typeof SG !== "undefined" && SG && SG.dispatcher) {
      SG.dispatcher.unregister("periodic:trigger-click");
    } else {
      document.removeEventListener("click", sgHandlePeriodicTriggerClick, true);
    }
  }
  sgSyncPeriodicSendBlockState();
  if (typeof sgObserverRegistry !== "undefined" && sgObserverRegistry && sgObserverRegistry.unregisterUIRefresh) {
    sgObserverRegistry.unregisterUIRefresh("periodicModelLabel");
  }
  if (_sgPeriodicPopoverEl) {
    _sgPeriodicPopoverEl.remove();
    _sgPeriodicPopoverEl = null;
  }
  if (_sgPeriodicPanelEl) {
    _sgPeriodicPanelEl.remove();
    _sgPeriodicPanelEl = null;
  }
  _sgPeriodicLastTriggerEl = null;
  sgRestorePeriodicModeButtonLabel();
}

function sgPeriodicOnDomRefresh() {
  if (document.querySelector('[data-test-id^="bard-mode-option-"]')) {
    sgPeriodicScanGeminiCatalogFromDom();
  }
  sgSyncPeriodicModeButtonLabel();
}

function sgSetPeriodicModelPickerEnabled(enabled) {
  isPeriodicModelPickerEnabled = enabled === true;
  if (!isExtensionEnabled || !isPeriodicModelPickerEnabled) {
    sgTeardownPeriodicModelPicker();
    return;
  }
  if (!_sgPeriodicCaptureBound) {
    _sgPeriodicCaptureBound = true;
    if (typeof SG !== "undefined" && SG && SG.dispatcher) {
      SG.dispatcher.register("periodic:trigger-click", "document", "click", sgHandlePeriodicTriggerClick, SG.dispatcher.PRIORITY.UI_CONTROLS);
    } else {
      document.addEventListener("click", sgHandlePeriodicTriggerClick, true);
    }
  }
  if (typeof sgObserverRegistry !== "undefined" && sgObserverRegistry && sgObserverRegistry.registerUIRefresh) {
    sgObserverRegistry.registerUIRefresh("periodicModelLabel", sgPeriodicOnDomRefresh);
  }
  sgPeriodicScanGeminiCatalogFromDom();
  sgSyncPeriodicModeButtonLabel();
  sgSyncPeriodicSendBlockState();
}

function initPeriodicModelPickerSystem() {
  if (typeof SG_IS_SILENT_BG_WORKER_TAB !== "undefined" && SG_IS_SILENT_BG_WORKER_TAB) return;
  if (_sgPeriodicInitialized) return;
  _sgPeriodicInitialized = true;

  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync) {
    ("function" == typeof sgSyncGetCached ? sgSyncGetCached : chrome.storage.sync.get.bind(chrome.storage.sync))(
      ["periodicModelPickerEnabled", "extensionEnabled"],
      res => {
        const safe = res || {};
        if (safe.extensionEnabled === false) {
          isExtensionEnabled = false;
        }
        sgSetPeriodicModelPickerEnabled(safe.periodicModelPickerEnabled === true);
      }
    );

    const _sgPeriodicStorageHandler = (changes, areaName) => {
      if (areaName !== "sync" || !changes) return;
      if (changes.extensionEnabled) {
        isExtensionEnabled = changes.extensionEnabled.newValue !== false;
        if (!isExtensionEnabled) {
          sgTeardownPeriodicModelPicker();
        } else if (isPeriodicModelPickerEnabled) {
          sgSetPeriodicModelPickerEnabled(true);
        }
      }
      if (changes.periodicModelPickerEnabled) {
        sgSetPeriodicModelPickerEnabled(changes.periodicModelPickerEnabled.newValue === true);
      }
    };
    if (typeof SG !== "undefined" && SG && SG.storage) {
      SG.storage.onChanged("periodic-table:sync", _sgPeriodicStorageHandler, { area: "sync" });
    } else if (chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener(_sgPeriodicStorageHandler);
    }
  }
}

if (typeof document !== "undefined" && typeof chrome !== "undefined" && chrome.storage) {
  initPeriodicModelPickerSystem();
}
