(function () {
  "use strict";

  const PARENT_ORIGIN = "https://gemini.google.com";
  const MIN_HEIGHT = 160;
  const MAX_HEIGHT = 720;
  const MIN_ZOOM = 0.25;
  const MAX_ZOOM = 4.0;

  const FORBIDDEN_SVG_TAGS = new Set([
    "script",
    "foreignobject",
    "iframe",
    "object",
    "embed",
    "link",
    "meta",
    "base",
    "applet",
    "frame",
    "frameset",
    "form",
    "input",
    "button",
    "textarea",
    "select",
    "audio",
    "video"
  ]);

  const FORBIDDEN_JSON_KEYS = new Set(["__proto__", "constructor", "prototype"]);
  const FORBIDDEN_CHART_CALLBACK_KEYS = new Set([
    "callback",
    "generateLabels",
    "custom",
    "external",
    "onClick",
    "onHover",
    "onResize",
    "onComplete",
    "onProgress",
    "beforeInit",
    "afterInit",
    "beforeUpdate",
    "afterUpdate",
    "beforeDraw",
    "afterDraw",
    "beforeDatasetsDraw",
    "afterDatasetsDraw",
    "beforeEvent",
    "afterEvent",
    "formatter",
    "filter",
    "sort",
    "label",
    "title",
    "beforeTitle",
    "afterTitle",
    "beforeBody",
    "afterBody",
    "beforeFooter",
    "afterFooter"
  ]);

  const ENGINE_SCRIPTS = Object.freeze({
    mermaid: ["lib/diagrams/mermaid.min.js"],
    dot: ["lib/diagrams/viz-standalone.js"],
    chart: ["lib/diagrams/chart.umd.min.js"],
    wavedrom: ["lib/diagrams/wavedrom.min.js"],
    netlist: ["lib/diagrams/elk.bundled.js", "lib/diagrams/netlistsvg.min.js"]
  });

  const NETLIST_ANALOG_TYPES = new Set([
    "vcc", "vee", "gnd",
    "resistor_h", "r_h", "resistor_v", "r_v",
    "capacitor_h", "c_h", "capacitor_v", "c_v",
    "capacitor_pol_h", "cp_h", "c_pol_h", "capacitor_pol_v", "cp_v", "c_pol_v",
    "inductor_h", "l_h", "inductor_v", "l_v",
    "voltage_source", "v", "current_source", "i",
    "diode_h", "d_h", "diode_v", "d_v",
    "diode_schottky_h", "d_sk_h", "diode_schottky_v", "d_sk_v",
    "diode_led_h", "d_led_h", "diode_led_v", "d_led_v",
    "diode_zener_h", "d_z_h", "zener_h", "diode_zener_v", "d_z_v", "zener_v",
    "transistor_npn", "q_npn", "transistor_pnp", "q_pnp",
    "mosfet_n", "nmos", "q_nmos", "mosfet_p", "pmos", "q_pmos",
    "potentiometer_h", "pot_h", "potentiometer_v", "pot_v",
    "switch_h", "sw_h", "switch_v", "sw_v",
    "fuse_h", "f_h", "fuse_v", "f_v",
    "opamp", "op", "xtal", "transformer_1p_1s"
  ]);
  const NETLIST_NONPOLAR_TWOPIN_TYPES = new Set([
    "resistor_h", "r_h", "resistor_v", "r_v",
    "capacitor_h", "c_h", "capacitor_v", "c_v",
    "inductor_h", "l_h", "inductor_v", "l_v",
    "switch_h", "sw_h", "switch_v", "sw_v",
    "fuse_h", "f_h", "fuse_v", "f_v",
    "xtal"
  ]);
  const NETLIST_POLARIZED_TWOPIN_TYPES = new Set([
    "voltage_source", "v", "current_source", "i",
    "diode_h", "d_h", "diode_v", "d_v",
    "diode_schottky_h", "d_sk_h", "diode_schottky_v", "d_sk_v",
    "diode_led_h", "d_led_h", "diode_led_v", "d_led_v",
    "diode_zener_h", "d_z_h", "zener_h", "diode_zener_v", "d_z_v", "zener_v",
    "capacitor_pol_h", "cp_h", "c_pol_h", "capacitor_pol_v", "cp_v", "c_pol_v"
  ]);
  const NETLIST_TWO_PIN_ANALOG_TYPES = new Set([
    ...NETLIST_NONPOLAR_TWOPIN_TYPES,
    ...NETLIST_POLARIZED_TWOPIN_TYPES
  ]);
  const NETLIST_ORIENTABLE_ALIAS_MAP = Object.freeze({
    resistor: ["r_h", "r_v"],
    r: ["r_h", "r_v"],
    res: ["r_h", "r_v"],
    capacitor: ["c_h", "c_v"],
    c: ["c_h", "c_v"],
    cap: ["c_h", "c_v"],
    capacitor_pol: ["cp_h", "cp_v"],
    cap_pol: ["cp_h", "cp_v"],
    c_pol: ["cp_h", "cp_v"],
    cp: ["cp_h", "cp_v"],
    cap_polarized: ["cp_h", "cp_v"],
    electrolytic: ["cp_h", "cp_v"],
    electrolytic_capacitor: ["cp_h", "cp_v"],
    polarized_capacitor: ["cp_h", "cp_v"],
    inductor: ["l_h", "l_v"],
    l: ["l_h", "l_v"],
    ind: ["l_h", "l_v"],
    coil: ["l_h", "l_v"],
    diode: ["d_h", "d_v"],
    d: ["d_h", "d_v"],
    diode_schottky: ["d_sk_h", "d_sk_v"],
    schottky: ["d_sk_h", "d_sk_v"],
    schottky_diode: ["d_sk_h", "d_sk_v"],
    d_sk: ["d_sk_h", "d_sk_v"],
    diode_led: ["d_led_h", "d_led_v"],
    led: ["d_led_h", "d_led_v"],
    d_led: ["d_led_h", "d_led_v"],
    diode_zener: ["d_z_h", "d_z_v"],
    zener: ["d_z_h", "d_z_v"],
    zener_diode: ["d_z_h", "d_z_v"],
    d_z: ["d_z_h", "d_z_v"],
    potentiometer: ["pot_h", "pot_v"],
    pot: ["pot_h", "pot_v"],
    variable_resistor: ["pot_h", "pot_v"],
    var_resistor: ["pot_h", "pot_v"],
    trimmer: ["pot_h", "pot_v"],
    switch: ["sw_h", "sw_v"],
    sw: ["sw_h", "sw_v"],
    spst: ["sw_h", "sw_v"],
    fuse: ["f_h", "f_v"],
    f: ["f_h", "f_v"]
  });
  const NETLIST_STATIC_ALIAS_MAP = Object.freeze({
    vcc: "vcc",
    power: "vcc",
    vdd: "vcc",
    supply: "vcc",
    pwr: "vcc",
    vee: "vee",
    vss: "vee",
    neg_supply: "vee",
    gnd: "gnd",
    ground: "gnd",
    earth: "gnd",
    gnd_sym: "gnd",
    dgnd: "gnd",
    agnd: "gnd",
    pgnd: "gnd",
    voltage: "v",
    voltage_source: "v",
    vsource: "v",
    v_source: "v",
    battery: "v",
    bat: "v",
    dc_source: "v",
    ac_source: "v",
    vs: "v",
    current: "i",
    current_source: "i",
    isource: "i",
    i_source: "i",
    is: "i",
    npn: "q_npn",
    bjt_npn: "q_npn",
    npn_transistor: "q_npn",
    pnp: "q_pnp",
    bjt_pnp: "q_pnp",
    pnp_transistor: "q_pnp",
    nmos: "nmos",
    mosfet_n: "mosfet_n",
    n_mosfet: "nmos",
    nmosfet: "nmos",
    nfet: "nmos",
    q_nmos: "q_nmos",
    pmos: "pmos",
    mosfet_p: "mosfet_p",
    p_mosfet: "pmos",
    pmosfet: "pmos",
    pfet: "pmos",
    q_pmos: "q_pmos",
    opamp: "opamp",
    op: "op",
    op_amp: "opamp",
    amplifier: "opamp",
    xtal: "xtal",
    crystal: "xtal",
    oscillator: "xtal",
    quartz: "xtal",
    transformer_1p_1s: "transformer_1p_1s",
    transformer: "transformer_1p_1s",
    xfmr: "transformer_1p_1s",
    trafo: "transformer_1p_1s"
  });
  const NETLIST_ANALOG_PIN_MAPS = Object.freeze({
    twopin_ab: Object.freeze({
      a: "A", "1": "A", in: "A", left: "A", top: "A", p: "A", pos: "A", "+": "A", p1: "A", t1: "A", pin1: "A", n1: "A",
      b: "B", "2": "B", out: "B", right: "B", bottom: "B", n: "B", neg: "B", "-": "B", p2: "B", t2: "B", pin2: "B", n2: "B"
    }),
    twopin_pm: Object.freeze({
      "+": "+", pos: "+", positive: "+", p: "+", anode: "+", a: "+", "1": "+", in: "+", plus: "+", top: "+", left: "+",
      "-": "-", neg: "-", negative: "-", n: "-", cathode: "-", k: "-", c: "-", b: "-", "2": "-", out: "-", minus: "-", bottom: "-", right: "-"
    }),
    pot: Object.freeze({
      a: "A", "1": "A", in: "A", left: "A", top: "A",
      b: "B", "2": "B", out: "B", right: "B", bottom: "B",
      w: "W", "3": "W", wiper: "W", tap: "W", mid: "W", out_w: "W", slider: "W"
    }),
    bjt: Object.freeze({
      b: "B", base: "B",
      c: "C", collector: "C", col: "C",
      e: "E", emitter: "E", emit: "E"
    }),
    mosfet: Object.freeze({
      g: "G", gate: "G",
      d: "D", drain: "D",
      s: "S", source: "S", src: "S"
    }),
    opamp: Object.freeze({
      "+": "+", "in+": "+", inp: "+", noninv: "+", non_inv: "+", vp: "+", in_p: "+", noninverting: "+",
      "-": "-", "in-": "-", inn: "-", inv: "-", vn: "-", in_n: "-", inverting: "-",
      out: "OUT", y: "OUT", vo: "OUT", output: "OUT", vout: "OUT",
      vcc: "VCC", "v+": "VCC", vdd: "VCC", "vs+": "VCC", vpwr: "VCC",
      vee: "VEE", "v-": "VEE", vss: "VEE", "vs-": "VEE", vnwr: "VEE", gnd: "VEE"
    })
  });
  const NETLIST_GND_NAME_RE = /^(?:gnd|ground|vss|vee|agnd|dgnd|pgnd|0v|com|return)(?:_.*)?$/i;
  const NETLIST_VCC_NAME_RE = /^(?:vcc|vdd|avdd|dvdd|vin_pwr|vbat|\+?\d+(?:\.\d+)?v(?:dc)?|3v3|5v|12v)(?:_.*)?$/i;
  const NETLIST_OUTPUT_PINS = new Set(["Y", "Q", "OUT", "Z", "O", "COUT", "SUM"]);

  const _scriptLoadCache = new Map();
  let _vizInstancePromise = null;
  let _activeChartInstance = null;
  let _currentEngine = null;
  let _currentSource = "";
  let _currentTheme = "dark";
  let _currentSvgEl = null;
  let _currentCanvasEl = null;
  let _renderSeq = 0;
  let _renderGen = 0;

  let _scale = 1;
  let _panX = 0;
  let _panY = 0;
  let _baseWidth = 0;
  let _baseHeight = 0;
  let _isDragging = false;
  let _dragStartX = 0;
  let _dragStartY = 0;
  let _dragOriginPanX = 0;
  let _dragOriginPanY = 0;

  function readTokenFromHash() {
    try {
      const hash = String(window.location.hash || "").replace(/^#/, "");
      const params = new URLSearchParams(hash);
      return params.get("token") || "";
    } catch (_e) {
      return "";
    }
  }

  const INSTANCE_TOKEN = readTokenFromHash();
  const viewportEl = typeof document !== "undefined" ? document.getElementById("sg-sb-viewport") : null;
  const stageEl = typeof document !== "undefined" ? document.getElementById("sg-sb-stage") : null;
  const statusEl = typeof document !== "undefined" ? document.getElementById("sg-sb-status") : null;

  function postToParent(payload) {
    if (!INSTANCE_TOKEN || typeof window === "undefined" || !window.parent || window.parent === window) return;
    try {
      window.parent.postMessage(Object.assign({}, payload, { token: INSTANCE_TOKEN }), PARENT_ORIGIN);
    } catch (_e) {}
  }

  function showStatus(text, isError) {
    if (!statusEl) return;
    statusEl.textContent = String(text || "");
    statusEl.classList.toggle("sg-sb-error", Boolean(isError));
    statusEl.hidden = false;
  }

  function hideStatus() {
    if (!statusEl) return;
    statusEl.hidden = true;
    statusEl.textContent = "";
    statusEl.classList.remove("sg-sb-error");
  }

  function isSafeHref(rawVal) {
    const val = String(rawVal || "").trim();
    if (!val) return false;
    if (val.startsWith("#")) return true;
    const normalized = val.replace(/[\u0000-\u0020]+/g, "").toLowerCase();
    if (
      normalized.startsWith("javascript:") ||
      normalized.startsWith("vbscript:") ||
      normalized.startsWith("data:text/html") ||
      normalized.startsWith("data:image/svg") ||
      normalized.startsWith("http:") ||
      normalized.startsWith("https:") ||
      normalized.startsWith("//")
    ) {
      return false;
    }
    return /^data:image\/(?:png|jpeg|jpg|gif|webp);base64,[a-z0-9+/=]+$/i.test(normalized);
  }

  function sanitizeCssText(cssText) {
    return String(cssText || "")
      .replace(/@import\b[^;]*;?/gi, "")
      .replace(/expression\s*\([^)]*\)/gi, "")
      .replace(/behavior\s*:[^;]*;?/gi, "")
      .replace(/url\s*\(\s*['"]?\s*(?:https?:|\/\/|javascript:|vbscript:|data:text\/html)[^)]*\)/gi, "none");
  }

  function sanitizeSvgNodeTree(rootSvg) {
    const removeList = [];
    const walk = (node) => {
      if (!node) return;
      if (node.nodeType === 1) {
        const tag = String(node.localName || node.tagName || "").toLowerCase();
        if (FORBIDDEN_SVG_TAGS.has(tag)) {
          removeList.push(node);
          return;
        }
        if (tag === "style") {
          node.textContent = sanitizeCssText(node.textContent || "");
        }
        const attrs = Array.from(node.attributes || []);
        for (const attr of attrs) {
          const name = String(attr.name || "");
          const lower = name.toLowerCase();
          if (lower.startsWith("on") || lower === "srcdoc" || lower === "formaction") {
            node.removeAttribute(name);
            continue;
          }
          if (lower === "style") {
            node.setAttribute(name, sanitizeCssText(attr.value || ""));
            continue;
          }
          if (
            lower === "href" ||
            lower === "xlink:href" ||
            lower === "src" ||
            lower === "action" ||
            lower === "background" ||
            lower === "data"
          ) {
            if (!isSafeHref(attr.value)) {
              node.removeAttribute(name);
            }
          }
        }
      }
      const children = Array.from(node.childNodes || []);
      for (const child of children) {
        walk(child);
      }
    };

    walk(rootSvg);
    for (const bad of removeList) {
      if (bad.parentNode) bad.parentNode.removeChild(bad);
    }
    return rootSvg;
  }

  function parseAndSanitizeSvg(rawSvg) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(String(rawSvg || ""), "image/svg+xml");
    const parseErr = doc.querySelector("parsererror");
    if (parseErr) {
      throw new Error("Invalid SVG syntax: " + (parseErr.textContent || "").trim().slice(0, 140));
    }
    const root = doc.documentElement;
    if (!root || String(root.localName || root.tagName || "").toLowerCase() !== "svg") {
      throw new Error("SVG root element <svg> not found");
    }

    sanitizeSvgNodeTree(root);

    if (!root.getAttribute("xmlns")) {
      root.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    }

    const imported = typeof document.importNode === "function" ? document.importNode(root, true) : root;
    return imported;
  }

  function safeJsonParse(rawText) {
    const str = String(rawText || "").trim();
    if (!str) throw new Error("Empty JSON configuration");

    const parsed = JSON.parse(str, (key, value) => {
      if (FORBIDDEN_JSON_KEYS.has(key)) {
        throw new Error(`Unsafe JSON key rejected: ${key}`);
      }
      return value;
    });

    if (!parsed || typeof parsed !== "object") {
      throw new Error("JSON root must be an object");
    }

    const verifyObject = (obj, depth) => {
      if (depth > 25) throw new Error("JSON nesting depth exceeded");
      if (Array.isArray(obj)) {
        for (const item of obj) {
          if (item && typeof item === "object") verifyObject(item, depth + 1);
        }
        return;
      }
      for (const key of Object.keys(obj)) {
        if (FORBIDDEN_JSON_KEYS.has(key)) {
          throw new Error(`Unsafe JSON key rejected: ${key}`);
        }
        const val = obj[key];
        if (val && typeof val === "object") {
          verifyObject(val, depth + 1);
        }
      }
    };
    verifyObject(parsed, 0);
    return parsed;
  }

  function validateChartConfig(cfg) {
    const looksLikeFnString = (s) =>
      typeof s === "string" && /^\s*(?:async\s+)?(?:function\b|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/.test(s);

    const checkNode = (node, inOptions) => {
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) {
        for (const item of node) checkNode(item, inOptions);
        return;
      }
      for (const key of Object.keys(node)) {
        if (FORBIDDEN_JSON_KEYS.has(key)) {
          throw new Error(`Unsafe Chart.js key rejected: ${key}`);
        }
        const val = node[key];
        const nextInOptions = inOptions || key === "options" || key === "plugins" || key === "scales";
        if (nextInOptions && FORBIDDEN_CHART_CALLBACK_KEYS.has(key) && looksLikeFnString(val)) {
          throw new Error(`Executable callback string rejected in Chart.js option: ${key}`);
        }
        if (looksLikeFnString(val)) {
          throw new Error(`Executable function string rejected in Chart.js config: ${key}`);
        }
        if (val && typeof val === "object") {
          checkNode(val, nextInOptions);
        }
      }
    };

    checkNode(cfg, false);
    if (!cfg.type || typeof cfg.type !== "string") {
      throw new Error("Chart.js config requires a string 'type' field");
    }
    if (!cfg.data || typeof cfg.data !== "object") {
      throw new Error("Chart.js config requires a 'data' object");
    }
    return cfg;
  }

  function applyChartTheme(cfg, isDark) {
    const textColor = isDark ? "#e8eaed" : "#202124";
    const mutedColor = isDark ? "#9aa0a6" : "#5f6368";
    const gridColor = isDark ? "rgba(255, 255, 255, 0.10)" : "rgba(0, 0, 0, 0.08)";

    const clone = JSON.parse(JSON.stringify(cfg));
    clone.options = clone.options && typeof clone.options === "object" ? clone.options : {};
    clone.options.animation = false;
    clone.options.responsive = true;
    clone.options.maintainAspectRatio = false;
    if (!clone.options.color) clone.options.color = textColor;

    clone.options.plugins = clone.options.plugins && typeof clone.options.plugins === "object" ? clone.options.plugins : {};
    clone.options.plugins.legend = clone.options.plugins.legend && typeof clone.options.plugins.legend === "object" ? clone.options.plugins.legend : {};
    clone.options.plugins.legend.labels = Object.assign({ color: textColor }, clone.options.plugins.legend.labels || {});

    if (clone.options.plugins.title && typeof clone.options.plugins.title === "object") {
      clone.options.plugins.title.color = clone.options.plugins.title.color || textColor;
    }

    const typeLower = String(clone.type || "").toLowerCase();
    const hasCartesianAxes = ["line", "bar", "scatter", "bubble"].includes(typeLower);
    const hasRadialAxis = ["radar", "polararea"].includes(typeLower);

    if (hasCartesianAxes) {
      clone.options.scales = clone.options.scales && typeof clone.options.scales === "object" ? clone.options.scales : { x: {}, y: {} };
      for (const axisKey of Object.keys(clone.options.scales)) {
        const axis = clone.options.scales[axisKey];
        if (!axis || typeof axis !== "object") continue;
        axis.ticks = Object.assign({ color: mutedColor }, axis.ticks || {});
        axis.grid = Object.assign({ color: gridColor }, axis.grid || {});
        if (axis.title && typeof axis.title === "object") {
          axis.title.color = axis.title.color || textColor;
        }
      }
    } else if (hasRadialAxis) {
      clone.options.scales = clone.options.scales && typeof clone.options.scales === "object" ? clone.options.scales : { r: {} };
      const r = clone.options.scales.r && typeof clone.options.scales.r === "object" ? clone.options.scales.r : (clone.options.scales.r = {});
      r.grid = Object.assign({ color: gridColor }, r.grid || {});
      r.angleLines = Object.assign({ color: gridColor }, r.angleLines || {});
      r.pointLabels = Object.assign({ color: textColor }, r.pointLabels || {});
      r.ticks = Object.assign({ color: mutedColor, backdropColor: "transparent" }, r.ticks || {});
    }

    return clone;
  }

  function loadScriptFile(relPath) {
    if (_scriptLoadCache.has(relPath)) {
      return _scriptLoadCache.get(relPath);
    }
    const p = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = relPath;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        _scriptLoadCache.delete(relPath);
        reject(new Error(`Library "${relPath}" not found in lib/diagrams/`));
      };
      (document.head || document.documentElement).appendChild(script);
    });
    _scriptLoadCache.set(relPath, p);
    return p;
  }

  async function loadEngineScript(engine) {
    const scripts = ENGINE_SCRIPTS[engine];
    if (!scripts || scripts.length === 0) return;
    for (const src of scripts) {
      await loadScriptFile(src);
    }
  }

  function ensureSvgDimensions(svgEl) {
    let w = 0;
    let h = 0;
    const vb = svgEl.getAttribute("viewBox");
    if (vb) {
      const parts = vb.trim().split(/[\s,]+/).map(Number);
      if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
        w = parts[2];
        h = parts[3];
      }
    }
    if (!w || !h) {
      const attrW = parseFloat(svgEl.getAttribute("width") || "0");
      const attrH = parseFloat(svgEl.getAttribute("height") || "0");
      if (attrW > 0 && attrH > 0) {
        w = attrW;
        h = attrH;
        if (!vb) svgEl.setAttribute("viewBox", `0 0 ${w} ${h}`);
      }
    }
    if ((!w || !h) && typeof svgEl.getBBox === "function") {
      try {
        const box = svgEl.getBBox();
        if (box && box.width > 0 && box.height > 0) {
          w = Math.ceil(box.width + Math.abs(box.x) * 2);
          h = Math.ceil(box.height + Math.abs(box.y) * 2);
          if (!vb) svgEl.setAttribute("viewBox", `${box.x} ${box.y} ${box.width} ${box.height}`);
        }
      } catch (_e) {}
    }
    if (!w || !h) {
      const rect = typeof svgEl.getBoundingClientRect === "function" ? svgEl.getBoundingClientRect() : null;
      w = rect && rect.width > 10 ? rect.width : 640;
      h = rect && rect.height > 10 ? rect.height : 360;
    }
    svgEl.setAttribute("width", String(Math.ceil(w)));
    svgEl.setAttribute("height", String(Math.ceil(h)));
    return { width: Math.ceil(w), height: Math.ceil(h) };
  }

  function applyTransform() {
    if (!stageEl || _currentEngine === "chart") return;
    stageEl.style.transform = `translate(${_panX}px, ${_panY}px) scale(${_scale})`;
  }

  function fitToView() {
    if (!viewportEl || !stageEl || _currentEngine === "chart") return;
    const vw = Math.max(120, viewportEl.clientWidth - 32);
    const vh = Math.max(120, viewportEl.clientHeight - 32);
    if (_baseWidth > 0 && _baseHeight > 0) {
      const fitScale = Math.min(1, vw / _baseWidth, vh / _baseHeight);
      _scale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Number(fitScale.toFixed(3))));
    } else {
      _scale = 1;
    }
    _panX = 0;
    _panY = 0;
    applyTransform();
  }

  function setZoom(nextScale) {
    if (_currentEngine === "chart") return;
    _scale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Number(nextScale.toFixed(3))));
    applyTransform();
  }

  function clearStage() {
    if (_activeChartInstance && typeof _activeChartInstance.destroy === "function") {
      try {
        _activeChartInstance.destroy();
      } catch (_e) {}
      _activeChartInstance = null;
    }
    _currentSvgEl = null;
    _currentCanvasEl = null;
    if (stageEl) {
      while (stageEl.firstChild) stageEl.removeChild(stageEl.firstChild);
      stageEl.style.transform = "";
      stageEl.className = "sg-sb-stage";
    }
    if (viewportEl) {
      viewportEl.classList.remove("sg-sb-chart-mode");
    }
  }

  function normalizeDotDarkTheme(svgEl, isDark) {
    if (!isDark) return;
    const graphPolys = svgEl.querySelectorAll("g.graph > polygon");
    for (const poly of graphPolys) {
      const fill = (poly.getAttribute("fill") || "").trim().toLowerCase();
      if (fill === "white" || fill === "#ffffff" || fill === "#fff") {
        poly.setAttribute("fill", "transparent");
      }
      const stroke = (poly.getAttribute("stroke") || "").trim().toLowerCase();
      if (stroke === "none" || stroke === "white" || stroke === "#ffffff") {
        poly.setAttribute("stroke", "none");
      }
    }
    const shapes = svgEl.querySelectorAll("path, polygon, ellipse, polyline, line");
    for (const el of shapes) {
      const stroke = (el.getAttribute("stroke") || "").trim().toLowerCase();
      if (stroke === "black" || stroke === "#000000" || stroke === "#000") {
        el.setAttribute("stroke", "#c4c7c5");
      }
      const fill = (el.getAttribute("fill") || "").trim().toLowerCase();
      if (fill === "black" || fill === "#000000" || fill === "#000") {
        el.setAttribute("fill", "#c4c7c5");
      }
    }
  }

  const SVG_NS = "http://www.w3.org/2000/svg";
  const SVG_MATH_SYMBOLS = Object.freeze({
    alpha: "\u03B1", beta: "\u03B2", gamma: "\u03B3", delta: "\u03B4", epsilon: "\u03F5",
    varepsilon: "\u03B5", zeta: "\u03B6", eta: "\u03B7", theta: "\u03B8", vartheta: "\u03D1",
    iota: "\u03B9", kappa: "\u03BA", lambda: "\u03BB", mu: "\u03BC", nu: "\u03BD",
    xi: "\u03BE", omicron: "\u03BF", pi: "\u03C0", varpi: "\u03D6", rho: "\u03C1",
    varrho: "\u03F1", sigma: "\u03C3", varsigma: "\u03C2", tau: "\u03C4", upsilon: "\u03C5",
    phi: "\u03D5", varphi: "\u03C6", chi: "\u03C7", psi: "\u03C8", omega: "\u03C9",
    Gamma: "\u0393", Delta: "\u0394", Theta: "\u0398", Lambda: "\u039B", Xi: "\u039E",
    Pi: "\u03A0", Sigma: "\u03A3", Upsilon: "\u03A5", Phi: "\u03A6", Psi: "\u03A8", Omega: "\u03A9",
    cdot: "\u00B7", times: "\u00D7", pm: "\u00B1", mp: "\u2213", approx: "\u2248",
    neq: "\u2260", ne: "\u2260", leq: "\u2264", le: "\u2264", geq: "\u2265", ge: "\u2265",
    infty: "\u221E", partial: "\u2202", nabla: "\u2207", oint: "\u222E", int: "\u222B",
    sum: "\u2211", prod: "\u220F", sqrt: "\u221A", to: "\u2192", rightarrow: "\u2192",
    leftarrow: "\u2190", leftrightarrow: "\u2194", implies: "\u21D2", Rightarrow: "\u21D2",
    perp: "\u22A5", parallel: "\u2225", degree: "\u00B0", circ: "\u2218", propto: "\u221D", equiv: "\u2261"
  });
  const SVG_MATH_ACCENTS = Object.freeze({
    bar: "\u0304",
    hat: "\u0302"
  });
  const SVG_MATH_YOSYS_PREFIX_RE = /^\$(?:and|or|xor|xnor|not|mux|pmux|dff|add|sub|eq|lt|le|ge|gt|abc|auto|procdff|paramod|_)/;
  const SVG_MATH_SINGLE_TOKEN_RE = /^(?:\d+(?:\.\d+)?|(?:[A-Za-z]|\\[A-Za-z]+)(?:[_^](?:\{[^{}]*\}|\\[A-Za-z]+|[A-Za-z0-9]))*|\\(?:vec|bar|hat)\{(?:[A-Za-z]|\\[A-Za-z]+)\}(?:[_^](?:\{[^{}]*\}|\\[A-Za-z]+|[A-Za-z0-9]))*|\\(?:text|mathrm)\{[^\s{}]+\}|\\sqrt\{[^{}]*\})$/;
  const SVG_MATH_SKIP_TAGS = new Set(["style", "script", "title", "desc", "defs"]);
  const SVG_MATH_SUPERSCRIPT_MAP = Object.freeze({
    "0": "\u2070", "1": "\u00B9", "2": "\u00B2", "3": "\u00B3", "4": "\u2074",
    "5": "\u2075", "6": "\u2076", "7": "\u2077", "8": "\u2078", "9": "\u2079",
    "+": "\u207A", "-": "\u207B", "=": "\u207C", "(": "\u207D", ")": "\u207E",
    n: "\u207F", i: "\u2071"
  });
  const SVG_MATH_SUBSCRIPT_MAP = Object.freeze({
    "0": "\u2080", "1": "\u2081", "2": "\u2082", "3": "\u2083", "4": "\u2084",
    "5": "\u2085", "6": "\u2086", "7": "\u2087", "8": "\u2088", "9": "\u2089",
    "+": "\u208A", "-": "\u208B", "=": "\u208C", "(": "\u208D", ")": "\u208E",
    a: "\u2090", e: "\u2091", h: "\u2095", i: "\u1D62", j: "\u2C7C",
    k: "\u2096", l: "\u2097", m: "\u2098", n: "\u2099", o: "\u2092",
    p: "\u209A", r: "\u1D63", s: "\u209B", t: "\u209C", u: "\u1D64",
    v: "\u1D65", x: "\u2093"
  });

  function pushMathSegment(out, kind, text, bold = false) {
    if (!text) return;
    const isBold = Boolean(bold);
    if (out.length > 0 && out[out.length - 1].kind === kind && Boolean(out[out.length - 1].bold) === isBold) {
      out[out.length - 1].text += text;
    } else {
      out.push({ kind, text, bold: isBold });
    }
  }

  function buildBraceMatchMap(str) {
    const map = new Map();
    const stack = [];
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      if (ch === "\\") {
        i += 1;
        continue;
      }
      if (ch === "{") stack.push(i);
      else if (ch === "}" && stack.length > 0) {
        map.set(stack.pop(), i);
      }
    }
    return map;
  }

  function readBracedMathGroup(str, startIdx, braceMap = null) {
    if (startIdx >= str.length || str[startIdx] !== "{") return null;
    if (braceMap) {
      const endIdx = braceMap.get(startIdx);
      return endIdx !== undefined ? { content: str.slice(startIdx + 1, endIdx), nextIdx: endIdx + 1 } : null;
    }
    let depth = 0;
    for (let i = startIdx; i < str.length; i++) {
      const ch = str[i];
      if (ch === "\\") {
        i += 1;
        continue;
      }
      if (ch === "{") depth += 1;
      else if (ch === "}") {
        depth -= 1;
        if (depth === 0) {
          return { content: str.slice(startIdx + 1, i), nextIdx: i + 1 };
        }
      }
    }
    return null;
  }

  function readMathArgument(str, startIdx, braceMap = null) {
    let p = startIdx;
    while (p < str.length && /\s/.test(str[p])) p += 1;
    if (p >= str.length) return null;
    if (str[p] === "{") {
      return readBracedMathGroup(str, p, braceMap);
    }
    if (str[p] === "\\") {
      if (p + 1 < str.length && /[A-Za-z]/.test(str[p + 1])) {
        let end = p + 2;
        while (end < str.length && /[A-Za-z]/.test(str[end])) end += 1;
        return { content: str.slice(p, end), nextIdx: end };
      }
      return { content: str.slice(p, Math.min(str.length, p + 2)), nextIdx: Math.min(str.length, p + 2) };
    }
    return { content: str[p], nextIdx: p + 1 };
  }

  function isBalancedParenWrapped(s) {
    if (!s.startsWith("(") || !s.endsWith(")")) return false;
    let depth = 0;
    for (let i = 0; i < s.length; i++) {
      if (s[i] === "(") depth += 1;
      else if (s[i] === ")") {
        depth -= 1;
        if (depth === 0 && i < s.length - 1) return false;
        if (depth < 0) return false;
      }
    }
    return depth === 0;
  }

  function needsInlineMathParens(rawArg) {
    const s = String(rawArg || "").trim();
    if (!s || isBalancedParenWrapped(s) || SVG_MATH_SINGLE_TOKEN_RE.test(s)) return false;
    return true;
  }

  function latexFragmentToPlainText(fragment, depth) {
    const tmp = [];
    parseLatexMathSegments(fragment, tmp, depth + 1);
    return tmp.map((seg) => seg.text).join("");
  }

  function parseLatexMathSegments(expr, out, depth = 0) {
    if (depth > 8) {
      pushMathSegment(out, "text", expr);
      return;
    }
    const braceMap = expr.includes("{") ? buildBraceMatchMap(expr) : null;
    let i = 0;
    while (i < expr.length) {
      const ch = expr[i];
      if (ch === "\\") {
        if (i + 1 >= expr.length) {
          pushMathSegment(out, "text", "\\");
          break;
        }
        if (/[A-Za-z]/.test(expr[i + 1])) {
          let cmdEnd = i + 2;
          while (cmdEnd < expr.length && /[A-Za-z]/.test(expr[cmdEnd])) cmdEnd += 1;
          const cmd = expr.slice(i + 1, cmdEnd);
          let p = cmdEnd;
          while (p < expr.length && /\s/.test(expr[p])) p += 1;
          if (cmd === "text" || cmd === "mathrm") {
            if (p < expr.length && expr[p] === "{") {
              const grp = readBracedMathGroup(expr, p, braceMap);
              if (grp) {
                pushMathSegment(out, "text", grp.content.replace(/\\([${}%])/g, "$1"));
                i = grp.nextIdx;
                continue;
              }
            }
          }
          if (cmd === "vec") {
            const arg = readMathArgument(expr, cmdEnd, braceMap);
            if (arg) {
              const vecSegs = [];
              parseLatexMathSegments(arg.content, vecSegs, depth + 1);
              for (const seg of vecSegs) {
                pushMathSegment(out, seg.kind, seg.text, true);
              }
              i = arg.nextIdx;
              continue;
            }
          }
          if (Object.prototype.hasOwnProperty.call(SVG_MATH_ACCENTS, cmd)) {
            const arg = readMathArgument(expr, cmdEnd, braceMap);
            if (arg) {
              const base = latexFragmentToPlainText(arg.content, depth);
              pushMathSegment(out, "text", base + SVG_MATH_ACCENTS[cmd]);
              i = arg.nextIdx;
              continue;
            }
          }
          if (cmd === "frac") {
            const numArg = readMathArgument(expr, cmdEnd, braceMap);
            const denArg = numArg ? readMathArgument(expr, numArg.nextIdx, braceMap) : null;
            if (numArg && denArg) {
              const wrapNum = needsInlineMathParens(numArg.content);
              const wrapDen = needsInlineMathParens(denArg.content);
              if (wrapNum) pushMathSegment(out, "text", "(");
              parseLatexMathSegments(numArg.content, out, depth + 1);
              if (wrapNum) pushMathSegment(out, "text", ")");
              pushMathSegment(out, "text", "/");
              if (wrapDen) pushMathSegment(out, "text", "(");
              parseLatexMathSegments(denArg.content, out, depth + 1);
              if (wrapDen) pushMathSegment(out, "text", ")");
              i = denArg.nextIdx;
              continue;
            }
          }
          if (cmd === "sqrt") {
            if (p < expr.length && expr[p] === "{") {
              const radArg = readBracedMathGroup(expr, p, braceMap);
              if (radArg) {
                const wrapRad = needsInlineMathParens(radArg.content);
                pushMathSegment(out, "text", "\u221A");
                if (wrapRad) pushMathSegment(out, "text", "(");
                parseLatexMathSegments(radArg.content, out, depth + 1);
                if (wrapRad) pushMathSegment(out, "text", ")");
                i = radArg.nextIdx;
                continue;
              }
            }
            pushMathSegment(out, "text", "\u221A");
            i = cmdEnd;
            continue;
          }
          if (cmd === "left" || cmd === "right") {
            i = p < expr.length && expr[p] === "." ? p + 1 : cmdEnd;
            continue;
          }
          if (Object.prototype.hasOwnProperty.call(SVG_MATH_SYMBOLS, cmd)) {
            pushMathSegment(out, "text", SVG_MATH_SYMBOLS[cmd]);
            i = cmdEnd;
            continue;
          }
          pushMathSegment(out, "text", "\\" + cmd);
          i = cmdEnd;
          continue;
        }
        const esc = expr[i + 1];
        if (esc === "$" || esc === "%" || esc === "{" || esc === "}") {
          pushMathSegment(out, "text", esc);
        } else if (esc === "," || esc === ";" || esc === ":" || esc === " " || esc === "\\") {
          pushMathSegment(out, "text", " ");
        } else if (esc !== "!") {
          pushMathSegment(out, "text", "\\" + esc);
        }
        i += 2;
        continue;
      }
      if (ch === "^" || ch === "_") {
        const arg = readMathArgument(expr, i + 1, braceMap);
        if (arg) {
          const scriptKind = ch === "^" ? "super" : "sub";
          const scriptSegs = [];
          parseLatexMathSegments(arg.content, scriptSegs, depth + 1);
          for (const seg of scriptSegs) {
            pushMathSegment(out, scriptKind, seg.text, seg.bold);
          }
          i = arg.nextIdx;
          continue;
        }
        pushMathSegment(out, "text", ch);
        i += 1;
        continue;
      }
      if (ch === "{") {
        const grp = readBracedMathGroup(expr, i, braceMap);
        if (grp) {
          parseLatexMathSegments(grp.content, out, depth + 1);
          i = grp.nextIdx;
          continue;
        }
        pushMathSegment(out, "text", "{");
        i += 1;
        continue;
      }
      pushMathSegment(out, "text", ch);
      i += 1;
    }
  }

  function parseInlineMathText(rawText, stopAtQuote = false, preserveEscapedDollar = false) {
    const segments = [];
    let i = 0;
    let changed = false;
    let failParenBefore = -1;
    let failBracketBefore = -1;
    while (i < rawText.length) {
      if (rawText[i] === "\\" && i + 1 < rawText.length && rawText[i + 1] === "\\") {
        pushMathSegment(segments, "text", "\\\\");
        i += 2;
        continue;
      }
      if (rawText[i] === "\\" && i + 1 < rawText.length && rawText[i + 1] === "$") {
        if (preserveEscapedDollar) {
          pushMathSegment(segments, "text", "\\$");
        } else {
          pushMathSegment(segments, "text", "$");
          changed = true;
        }
        i += 2;
        continue;
      }
      if (rawText[i] === "\\" && i + 1 < rawText.length && (rawText[i + 1] === "(" || rawText[i + 1] === "[")) {
        const isParen = rawText[i + 1] === "(";
        const closeChar = isParen ? ")" : "]";
        const failBefore = isParen ? failParenBefore : failBracketBefore;
        let closeIdx = -1;
        if (i >= failBefore) {
          let limit = rawText.length;
          for (let j = i + 2; j < rawText.length - 1; j++) {
            if (rawText[j] === "\\") {
              if (rawText[j + 1] === closeChar) {
                closeIdx = j;
                break;
              }
              j += 1;
            } else if (stopAtQuote && rawText[j] === '"') {
              limit = j;
              break;
            }
          }
          if (closeIdx === -1) {
            if (isParen) failParenBefore = limit;
            else failBracketBefore = limit;
          }
        }
        if (closeIdx > i + 2) {
          const inner = rawText.slice(i + 2, closeIdx);
          if (inner.trim().length > 0) {
            parseLatexMathSegments(inner, segments, 0);
            changed = true;
            i = closeIdx + 2;
            continue;
          }
        }
        pushMathSegment(segments, "text", rawText.slice(i, i + 2));
        i += 2;
        continue;
      }
      if (rawText[i] === "$") {
        if (i + 1 < rawText.length && rawText[i + 1] !== "$" && !/\s/.test(rawText[i + 1])) {
          let closeIdx = -1;
          for (let j = i + 1; j < rawText.length; j++) {
            if (rawText[j] === "\\") {
              j += 1;
              continue;
            }
            if (stopAtQuote && rawText[j] === '"') {
              break;
            }
            if (rawText[j] === "$") {
              closeIdx = j;
              break;
            }
          }
          if (
            closeIdx > i + 1 &&
            !/\s/.test(rawText[closeIdx - 1]) &&
            !(closeIdx + 1 < rawText.length && /\d/.test(rawText[closeIdx + 1]))
          ) {
            let tokStart = i;
            while (tokStart > 0 && !/\s/.test(rawText[tokStart - 1]) && (!stopAtQuote || rawText[tokStart - 1] !== '"')) {
              tokStart -= 1;
            }
            let tokEnd = closeIdx + 1;
            while (tokEnd < rawText.length && !/\s/.test(rawText[tokEnd]) && (!stopAtQuote || rawText[tokEnd] !== '"')) {
              tokEnd += 1;
            }
            const token = rawText.slice(tokStart, tokEnd);
            const dollarCount = (token.match(/\$/g) || []).length;
            if (dollarCount >= 3 || SVG_MATH_YOSYS_PREFIX_RE.test(token)) {
              pushMathSegment(segments, "text", rawText.slice(i, tokEnd));
              i = tokEnd;
              continue;
            }
            parseLatexMathSegments(rawText.slice(i + 1, closeIdx), segments, 0);
            changed = true;
            i = closeIdx + 1;
            continue;
          }
        }
        pushMathSegment(segments, "text", "$");
        i += 1;
        continue;
      }
      pushMathSegment(segments, "text", rawText[i]);
      i += 1;
    }
    return changed ? segments : null;
  }

  function renderSvgInlineMath(svgEl) {
    if (!svgEl || svgEl.nodeType !== 1) return svgEl;
    const doc = svgEl.ownerDocument || (typeof document !== "undefined" ? document : null);
    if (!doc) return svgEl;

    const walk = (node, insideText) => {
      if (!node || node.nodeType !== 1) return;
      const tag = String(node.localName || node.tagName || "").toLowerCase();
      if (SVG_MATH_SKIP_TAGS.has(tag)) return;
      const isTextContainer = tag === "text" || (insideText && tag === "tspan");
      const children = Array.from(node.childNodes || []);
      for (const child of children) {
        if (child.nodeType === 3) {
          if (!isTextContainer) continue;
          const rawText = child.nodeValue != null ? String(child.nodeValue) : String(child.textContent || "");
          if (!rawText.includes("$") && !rawText.includes("\\(") && !rawText.includes("\\[")) continue;
          const segments = parseInlineMathText(rawText);
          if (!segments) continue;
          for (const seg of segments) {
            let newNode = null;
            if (seg.kind === "text" && !seg.bold) {
              newNode = typeof doc.createTextNode === "function"
                ? doc.createTextNode(seg.text)
                : { nodeType: 3, nodeValue: seg.text, textContent: seg.text };
            } else {
              if (typeof doc.createElementNS === "function") {
                newNode = doc.createElementNS(SVG_NS, "tspan");
              } else if (typeof doc.createElement === "function") {
                newNode = doc.createElement("tspan");
              }
              if (!newNode) continue;
              if (seg.kind === "super" || seg.kind === "sub") {
                newNode.setAttribute("font-size", "75%");
                newNode.setAttribute("baseline-shift", seg.kind === "super" ? "super" : "sub");
              }
              if (seg.bold) {
                newNode.setAttribute("font-weight", "bold");
              }
              newNode.textContent = seg.text;
            }
            node.insertBefore(newNode, child);
          }
          node.removeChild(child);
        } else if (child.nodeType === 1) {
          walk(child, insideText || tag === "text");
        }
      }
    };

    walk(svgEl, false);
    return svgEl;
  }

  function formatUnicodeMathScript(text, kind) {
    const map = kind === "super" ? SVG_MATH_SUPERSCRIPT_MAP : SVG_MATH_SUBSCRIPT_MAP;
    let out = "";
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === " ") {
        out += " ";
        continue;
      }
      if (!Object.prototype.hasOwnProperty.call(map, ch)) {
        return (kind === "super" ? "^" : "_") + text;
      }
      out += map[ch];
    }
    return out;
  }

  function preprocessMermaidMath(source) {
    const src = String(source || "");
    if (!src.includes("$") && !src.includes("\\(") && !src.includes("\\[")) {
      return src;
    }
    const lines = src.split("\n");
    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      if (!line.includes("$") && !line.includes("\\(") && !line.includes("\\[")) continue;
      const segments = parseInlineMathText(line, true, true);
      if (!segments) continue;
      let rebuilt = "";
      for (const seg of segments) {
        if (seg.kind === "super" || seg.kind === "sub") {
          rebuilt += formatUnicodeMathScript(seg.text, seg.kind);
        } else {
          rebuilt += seg.text;
        }
      }
      lines[li] = rebuilt;
    }
    return lines.join("\n");
  }

  const SVG_MATH_DOT_NLR_CMDS = new Set(["left", "right", "lim", "ln", "log", "rm"]);

  function isKnownLatexNlrCmd(str, slashIdx) {
    if (slashIdx + 1 >= str.length || !/[A-Za-z]/.test(str[slashIdx + 1])) return false;
    let end = slashIdx + 2;
    while (end < str.length && /[A-Za-z]/.test(str[end])) end += 1;
    const cmd = str.slice(slashIdx + 1, end);
    return SVG_MATH_DOT_NLR_CMDS.has(cmd) || Object.prototype.hasOwnProperty.call(SVG_MATH_SYMBOLS, cmd);
  }

  function isDotBreakEscape(str, idx) {
    if (idx + 1 >= str.length || str[idx] !== "\\") return false;
    const nextCh = str[idx + 1];
    if (nextCh !== "n" && nextCh !== "l" && nextCh !== "r") return false;
    return !isKnownLatexNlrCmd(str, idx);
  }

  function escapeDotMathSpan(spanText) {
    let out = "";
    let k = 0;
    while (k < spanText.length) {
      if (spanText[k] === "\\") {
        if (k + 1 < spanText.length && spanText[k + 1] === "\\") {
          out += "\\\\";
          k += 2;
          continue;
        }
        if (k + 1 < spanText.length && spanText[k + 1] === '"') {
          out += '\\"';
          k += 2;
          continue;
        }
        if (k + 1 < spanText.length && (spanText[k + 1] === "n" || spanText[k + 1] === "l" || spanText[k + 1] === "r")) {
          if (isKnownLatexNlrCmd(spanText, k)) {
            let cmdEnd = k + 2;
            while (cmdEnd < spanText.length && /[A-Za-z]/.test(spanText[cmdEnd])) cmdEnd += 1;
            out += "\\\\" + spanText.slice(k + 1, cmdEnd);
            k = cmdEnd;
            continue;
          }
          out += "\\" + spanText[k + 1];
          k += 2;
          continue;
        }
        out += "\\\\";
        k += 1;
        continue;
      }
      out += spanText[k];
      k += 1;
    }
    return out;
  }

  function escapeDotStringMath(inner) {
    if (!inner.includes("$") && !inner.includes("\\(") && !inner.includes("\\[")) {
      return inner;
    }
    let out = "";
    let i = 0;
    let failParenBefore = -1;
    let failBracketBefore = -1;
    while (i < inner.length) {
      if (inner[i] === "\\" && i + 1 < inner.length) {
        const nextCh = inner[i + 1];
        if (nextCh === "\\" || nextCh === "$" || nextCh === '"') {
          out += inner.slice(i, i + 2);
          i += 2;
          continue;
        }
        if (nextCh === "(" || nextCh === "[") {
          const isParen = nextCh === "(";
          const closeChar = isParen ? ")" : "]";
          const failBefore = isParen ? failParenBefore : failBracketBefore;
          let closeIdx = -1;
          if (i >= failBefore) {
            let limit = inner.length;
            for (let j = i + 2; j < inner.length - 1; j++) {
              if (inner[j] === "\n" || isDotBreakEscape(inner, j)) {
                limit = j;
                break;
              }
              if (inner[j] === "\\") {
                if (inner[j + 1] === closeChar) {
                  closeIdx = j;
                  break;
                }
                j += 1;
              }
            }
            if (closeIdx === -1) {
              if (isParen) failParenBefore = limit;
              else failBracketBefore = limit;
            }
          }
          if (closeIdx > i + 2 && inner.slice(i + 2, closeIdx).trim().length > 0) {
            out += escapeDotMathSpan(inner.slice(i, closeIdx + 2));
            i = closeIdx + 2;
            continue;
          }
          out += inner.slice(i, i + 2);
          i += 2;
          continue;
        }
        out += inner.slice(i, i + 2);
        i += 2;
        continue;
      }
      if (inner[i] === "$") {
        if (
          i + 1 < inner.length &&
          inner[i + 1] !== "$" &&
          !/\s/.test(inner[i + 1]) &&
          !isDotBreakEscape(inner, i + 1)
        ) {
          let closeIdx = -1;
          for (let j = i + 1; j < inner.length; j++) {
            if (inner[j] === "\n" || isDotBreakEscape(inner, j)) break;
            if (inner[j] === "\\") {
              j += 1;
              continue;
            }
            if (inner[j] === "$") {
              closeIdx = j;
              break;
            }
          }
          if (
            closeIdx > i + 1 &&
            !/\s/.test(inner[closeIdx - 1]) &&
            !(closeIdx + 1 < inner.length && /\d/.test(inner[closeIdx + 1]))
          ) {
            let tokStart = i;
            while (tokStart > 0 && !/\s/.test(inner[tokStart - 1])) {
              if (tokStart >= 2 && isDotBreakEscape(inner, tokStart - 2) && !(tokStart >= 3 && inner[tokStart - 3] === "\\")) {
                break;
              }
              tokStart -= 1;
            }
            let tokEnd = closeIdx + 1;
            while (tokEnd < inner.length && !/\s/.test(inner[tokEnd]) && !isDotBreakEscape(inner, tokEnd)) {
              tokEnd += 1;
            }
            const token = inner.slice(tokStart, tokEnd);
            const dollarCount = (token.match(/\$/g) || []).length;
            if (dollarCount >= 3 || SVG_MATH_YOSYS_PREFIX_RE.test(token)) {
              out += inner.slice(i, tokEnd);
              i = tokEnd;
              continue;
            }
            out += escapeDotMathSpan(inner.slice(i, closeIdx + 1));
            i = closeIdx + 1;
            continue;
          }
        }
        out += "$";
        i += 1;
        continue;
      }
      out += inner[i];
      i += 1;
    }
    return out;
  }

  function preprocessDotMath(source) {
    const src = String(source || "");
    if (!src.includes('"') || (!src.includes("$") && !src.includes("\\(") && !src.includes("\\["))) {
      return src;
    }
    let out = "";
    let i = 0;
    let atLineStart = true;
    while (i < src.length) {
      if (atLineStart && src[i] === "#") {
        const nl = src.indexOf("\n", i + 1);
        if (nl === -1) {
          out += src.slice(i);
          break;
        }
        out += src.slice(i, nl + 1);
        i = nl + 1;
        atLineStart = true;
        continue;
      }
      if (src[i] === "/" && i + 1 < src.length && src[i + 1] === "/") {
        const nl = src.indexOf("\n", i + 2);
        if (nl === -1) {
          out += src.slice(i);
          break;
        }
        out += src.slice(i, nl + 1);
        i = nl + 1;
        atLineStart = true;
        continue;
      }
      if (src[i] === "/" && i + 1 < src.length && src[i + 1] === "*") {
        const end = src.indexOf("*/", i + 2);
        if (end === -1) {
          out += src.slice(i);
          break;
        }
        out += src.slice(i, end + 2);
        i = end + 2;
        atLineStart = false;
        continue;
      }
      if (src[i] === '"') {
        let closeQuote = -1;
        for (let j = i + 1; j < src.length; j++) {
          if (src[j] === "\\") {
            j += 1;
            continue;
          }
          if (src[j] === '"') {
            closeQuote = j;
            break;
          }
        }
        if (closeQuote === -1) {
          out += src.slice(i);
          break;
        }
        const inner = src.slice(i + 1, closeQuote);
        out += '"' + escapeDotStringMath(inner) + '"';
        i = closeQuote + 1;
        atLineStart = false;
        continue;
      }
      const ch = src[i];
      out += ch;
      atLineStart = ch === "\n" ? true : (atLineStart && (ch === " " || ch === "\t" || ch === "\r"));
      i += 1;
    }
    return out;
  }

  const ENGINE_ADAPTERS = {
    async mermaid(source, isDark) {
      await loadEngineScript("mermaid");
      const m = window.mermaid;
      if (!m || typeof m.render !== "function") {
        throw new Error("Mermaid library failed to initialize");
      }
      m.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: isDark ? "dark" : "default",
        themeVariables: { dropShadow: "none" },
        themeCSS: ".node rect, .node polygon, .node circle, .node ellipse, .node path, .node .outer-path, .cluster rect, .statediagram-cluster rect, .actor, .icon, .icon-neo path, .tag-label-bkg { filter: none !important; }",
        flowchart: { htmlLabels: false },
        htmlLabels: false
      });
      const uid = "sg_mmd_" + (++_renderSeq) + "_" + Math.random().toString(36).slice(2, 7);
      const rendered = await m.render(uid, preprocessMermaidMath(String(source || "")));
      const svgCode = typeof rendered === "string" ? rendered : (rendered && rendered.svg ? rendered.svg : "");
      if (!svgCode) throw new Error("Mermaid returned empty SVG");
      const svgEl = parseAndSanitizeSvg(svgCode, false);
      renderSvgInlineMath(svgEl);
      return { kind: "svg", element: svgEl };
    },

    async svg(source) {
      const svgEl = parseAndSanitizeSvg(source, false);
      renderSvgInlineMath(svgEl);
      return { kind: "svg", element: svgEl };
    },

    async dot(source, isDark) {
      await loadEngineScript("dot");
      if (!window.Viz || typeof window.Viz.instance !== "function") {
        throw new Error("Graphviz Viz library failed to initialize");
      }
      if (!_vizInstancePromise) {
        _vizInstancePromise = window.Viz.instance().catch((err) => {
          _vizInstancePromise = null;
          throw err;
        });
      }
      const viz = await _vizInstancePromise;
      const svgStr = viz.renderString(preprocessDotMath(String(source || "")), { format: "svg" });
      if (!svgStr || !svgStr.includes("<svg")) {
        throw new Error("Graphviz returned empty SVG");
      }
      const svgEl = parseAndSanitizeSvg(svgStr, false);
      normalizeDotDarkTheme(svgEl, isDark);
      renderSvgInlineMath(svgEl);
      return { kind: "svg", element: svgEl };
    },

    async chart(source, isDark) {
      await loadEngineScript("chart");
      const ChartCtor = window.Chart;
      if (typeof ChartCtor !== "function") {
        throw new Error("Chart.js library failed to initialize");
      }
      const rawCfg = safeJsonParse(source);
      const validCfg = validateChartConfig(rawCfg);
      const themedCfg = applyChartTheme(validCfg, isDark);
      return { kind: "chart", config: themedCfg, ChartCtor };
    },

    async wavedrom(source) {
      await loadEngineScript("wavedrom");
      const wd = window.wavedrom || window.WaveDrom;
      if (!wd) {
        throw new Error("WaveDrom library failed to initialize");
      }
      const obj = safeJsonParse(source);
      let svgStr = "";
      if (typeof wd.renderAny === "function" && wd.onml && typeof wd.onml.stringify === "function") {
        const skins = wd.waveSkin || window.WaveSkin || {};
        const jsonml = wd.renderAny(0, obj, skins);
        svgStr = wd.onml.stringify(jsonml);
      } else if (typeof wd.RenderWaveElement === "function") {
        const host = document.createElement("div");
        const target = document.createElement("div");
        host.appendChild(target);
        wd.RenderWaveElement(0, obj, target, wd.waveSkin || window.WaveSkin || {});
        const svgChild = target.querySelector("svg");
        svgStr = svgChild ? new XMLSerializer().serializeToString(svgChild) : "";
      } else {
        throw new Error("Unsupported WaveDrom API version");
      }
      if (!svgStr || !svgStr.includes("<svg")) {
        throw new Error("WaveDrom produced empty SVG");
      }
      const svgEl = parseAndSanitizeSvg(svgStr, false);
      return { kind: "svg", element: svgEl };
    },

    async netlist(source) {
      await loadEngineScript("netlist");
      const nsvg = window.netlistsvg;
      if (!nsvg || typeof nsvg.render !== "function") {
        throw new Error("NetlistSVG library failed to initialize");
      }
      const raw = safeJsonParse(source);
      const { netlist, skin } = normalizeNetlistPayload(raw);
      ensureNetlistSvgMergedSupport(nsvg);
      const skinXml = skin === "analog"
        ? nsvg.analogSkin
        : skin === "mixed"
          ? getCachedMergedNetlistSkin(nsvg)
          : nsvg.digitalSkin;
      const svgStr = await nsvg.render(skinXml, netlist);
      if (!svgStr || !svgStr.includes("<svg")) {
        throw new Error("NetlistSVG produced empty SVG");
      }
      const svgEl = parseAndSanitizeSvg(svgStr, false);
      renderSvgInlineMath(svgEl);
      return { kind: "svg", element: svgEl };
    }
  };

  let _sgNetlistMergedSkinCache = null;

  function rewriteRenamedIds(node, renameMap) {
    if (!node || !renameMap || renameMap.size === 0) return;
    if (node.nodeType === 1) {
      if (node.attributes) {
        for (let i = 0; i < node.attributes.length; i++) {
          const attr = node.attributes[i];
          let val = attr.value;
          let changed = false;
          for (const [oldId, newId] of renameMap.entries()) {
            const urlPattern = `url(#${oldId})`;
            const hrefPattern = `#${oldId}`;
            if (val.includes(urlPattern)) {
              val = val.split(urlPattern).join(`url(#${newId})`);
              changed = true;
            }
            if (val === hrefPattern) {
              val = `#${newId}`;
              changed = true;
            }
          }
          if (changed) {
            node.setAttribute(attr.name, val);
          }
        }
      }
      const children = node.childNodes || [];
      for (let i = 0; i < children.length; i++) {
        rewriteRenamedIds(children[i], renameMap);
      }
    }
  }

  function mergeNetlistSkins(digitalSkinXml, analogSkinXml) {
    if (typeof digitalSkinXml !== "string" || !digitalSkinXml.trim()) {
      throw new Error("Invalid digitalSkinXml input");
    }
    if (typeof analogSkinXml !== "string" || !analogSkinXml.trim()) {
      throw new Error("Invalid analogSkinXml input");
    }

    const DOMParserCtor = typeof DOMParser !== "undefined"
      ? DOMParser
      : (typeof globalThis !== "undefined" && globalThis.DOMParser ? globalThis.DOMParser : null);
    const XMLSerializerCtor = typeof XMLSerializer !== "undefined"
      ? XMLSerializer
      : (typeof globalThis !== "undefined" && globalThis.XMLSerializer ? globalThis.XMLSerializer : null);

    if (!DOMParserCtor || !XMLSerializerCtor) {
      throw new Error("DOMParser or XMLSerializer is not available in environment");
    }

    const parser = new DOMParserCtor();
    const serializer = new XMLSerializerCtor();

    const digDoc = parser.parseFromString(digitalSkinXml, "image/svg+xml");
    const digErr = digDoc.querySelector ? digDoc.querySelector("parsererror") : null;
    if (digErr) {
      throw new Error(`Failed to parse digital skin XML: ${digErr.textContent}`);
    }

    const anaDoc = parser.parseFromString(analogSkinXml, "image/svg+xml");
    const anaErr = anaDoc.querySelector ? anaDoc.querySelector("parsererror") : null;
    if (anaErr) {
      throw new Error(`Failed to parse analog skin XML: ${anaErr.textContent}`);
    }

    const digSvg = digDoc.documentElement;
    const anaSvg = anaDoc.documentElement;

    if (anaSvg && anaSvg.attributes) {
      for (let i = 0; i < anaSvg.attributes.length; i++) {
        const attr = anaSvg.attributes[i];
        if (!digSvg.hasAttribute(attr.name)) {
          digSvg.setAttribute(attr.name, attr.value);
        }
      }
    }

    let digDefs = digDoc.querySelector ? digDoc.querySelector("defs") : null;
    const anaDefs = anaDoc.querySelector ? anaDoc.querySelector("defs") : null;
    const idRenameMap = new Map();

    if (anaDefs) {
      if (!digDefs) {
        digDefs = digDoc.createElementNS
          ? digDoc.createElementNS("http://www.w3.org/2000/svg", "defs")
          : digDoc.createElement("defs");
        digSvg.insertBefore(digDefs, digSvg.firstChild);
      }

      const existingDefsMap = new Map();
      const digDefChildren = digDefs.childNodes || [];
      for (let i = 0; i < digDefChildren.length; i++) {
        const c = digDefChildren[i];
        if (c.nodeType === 1 && c.getAttribute && c.getAttribute("id")) {
          existingDefsMap.set(c.getAttribute("id"), serializer.serializeToString(c));
        }
      }

      const anaDefChildren = anaDefs.childNodes || [];
      for (let i = 0; i < anaDefChildren.length; i++) {
        const c = anaDefChildren[i];
        if (c.nodeType !== 1) continue;
        const oldId = c.getAttribute ? c.getAttribute("id") : null;
        if (!oldId) {
          digDefs.appendChild(digDoc.importNode ? digDoc.importNode(c, true) : c.cloneNode(true));
          continue;
        }
        const serialized = serializer.serializeToString(c);
        if (existingDefsMap.has(oldId)) {
          if (existingDefsMap.get(oldId) === serialized) {
            continue;
          }
          let newId = `sg_ana_${oldId}`;
          let counter = 1;
          while (existingDefsMap.has(newId)) {
            newId = `sg_ana_${oldId}_${counter++}`;
          }
          idRenameMap.set(oldId, newId);
          const imported = digDoc.importNode ? digDoc.importNode(c, true) : c.cloneNode(true);
          imported.setAttribute("id", newId);
          digDefs.appendChild(imported);
          existingDefsMap.set(newId, serializer.serializeToString(imported));
        } else {
          const imported = digDoc.importNode ? digDoc.importNode(c, true) : c.cloneNode(true);
          digDefs.appendChild(imported);
          existingDefsMap.set(oldId, serialized);
        }
      }
    }

    const digStyle = digDoc.querySelector ? digDoc.querySelector("style") : null;
    const anaStyle = anaDoc.querySelector ? anaDoc.querySelector("style") : null;
    if (anaStyle) {
      if (!digStyle) {
        const newStyle = digDoc.createElementNS
          ? digDoc.createElementNS("http://www.w3.org/2000/svg", "style")
          : digDoc.createElement("style");
        newStyle.textContent = anaStyle.textContent;
        digSvg.appendChild(newStyle);
      } else {
        const digCss = digStyle.textContent || "";
        const anaCss = anaStyle.textContent || "";
        const cleanDig = digCss.replace(/\/\*[\s\S]*?\*\//g, "");
        const cleanAna = anaCss.replace(/\/\*[\s\S]*?\*\//g, "");
        const existingSelectors = new Set();
        const ruleRe = /([^{}]+)\{([^}]+)\}/g;
        let baseStrokeWidth = "1";
        let m;
        while ((m = ruleRe.exec(cleanDig)) !== null) {
          const parts = m[1].split(",");
          let isBaseSelector = false;
          for (let i = 0; i < parts.length; i++) {
            const s = parts[i].trim();
            if (s) {
              existingSelectors.add(s);
              if (s === "svg" || s === "path" || s === "line") {
                isBaseSelector = true;
              }
            }
          }
          if (isBaseSelector) {
            const swMatch = m[2].match(/stroke-width\s*:\s*([^;}\s]+)/i);
            if (swMatch) {
              baseStrokeWidth = swMatch[1];
            }
          }
        }
        const baseStrokeNum = parseFloat(baseStrokeWidth);
        const toAppend = [];
        while ((m = ruleRe.exec(cleanAna)) !== null) {
          const parts = m[1].split(",");
          const missing = [];
          for (let i = 0; i < parts.length; i++) {
            const s = parts[i].trim();
            if (s && !existingSelectors.has(s)) {
              missing.push(s);
              existingSelectors.add(s);
            }
          }
          if (missing.length > 0) {
            let body = m[2].trim();
            const isSymbolRule = missing.some((s) => /\.symbol\b/.test(s));
            const isDetailRule = missing.some((s) => /\.detail\b/.test(s));
            if (isSymbolRule || isDetailRule) {
              body = body.replace(/(stroke-width\s*:\s*)([^;]+)/gi, (full, prefix, val) => {
                if (isSymbolRule) return `${prefix}${baseStrokeWidth}`;
                const n = parseFloat(val);
                return Number.isFinite(n) && Number.isFinite(baseStrokeNum) && n > baseStrokeNum
                  ? `${prefix}${baseStrokeWidth}`
                  : full;
              });
            }
            toAppend.push(`\n${missing.join(", ")} {\n  ${body}\n}`);
          }
        }
        if (toAppend.length > 0) {
          digStyle.textContent = digCss + toAppend.join("") + "\n";
        }
      }
    }

    const existingTypes = new Set();
    const digChildren = digSvg.childNodes || [];
    for (let i = 0; i < digChildren.length; i++) {
      const c = digChildren[i];
      if (c.nodeType === 1 && (c.localName === "g" || c.tagName === "g")) {
        const stype = c.getAttribute
          ? (c.getAttribute("s:type") || (c.getAttributeNS && c.getAttributeNS("https://github.com/nturley/netlistsvg", "type")))
          : null;
        if (stype) existingTypes.add(stype);
      }
    }

    const anaChildren = anaSvg.childNodes || [];
    for (let i = 0; i < anaChildren.length; i++) {
      const c = anaChildren[i];
      if (c.nodeType === 1 && (c.localName === "g" || c.tagName === "g")) {
        const stype = c.getAttribute
          ? (c.getAttribute("s:type") || (c.getAttributeNS && c.getAttributeNS("https://github.com/nturley/netlistsvg", "type")))
          : null;
        if (stype && !existingTypes.has(stype)) {
          const copy = digDoc.importNode ? digDoc.importNode(c, true) : c.cloneNode(true);
          if (idRenameMap.size > 0) {
            rewriteRenamedIds(copy, idRenameMap);
          }
          digSvg.appendChild(copy);
          existingTypes.add(stype);
        }
      }
    }

    return serializer.serializeToString(digSvg);
  }

  function getCachedMergedNetlistSkin(nsvg) {
    if (!nsvg) return "";
    const digRef = nsvg.digitalSkin;
    const anaRef = nsvg.analogSkin;
    if (
      _sgNetlistMergedSkinCache &&
      _sgNetlistMergedSkinCache.digRef === digRef &&
      _sgNetlistMergedSkinCache.anaRef === anaRef
    ) {
      return _sgNetlistMergedSkinCache.mergedXml;
    }
    const mergedXml = mergeNetlistSkins(digRef, anaRef);
    _sgNetlistMergedSkinCache = { digRef, anaRef, mergedXml };
    return mergedXml;
  }

  function domNodeToOnml(node) {
    if (!node) return null;
    if (node.nodeType === 3 || node.nodeType === 4) {
      return node.textContent;
    }
    if (node.nodeType === 1) {
      const tag = node.tagName || node.localName;
      const localTag = (node.localName || tag || "").toLowerCase();
      const attrs = {};
      if (node.attributes) {
        for (let i = 0; i < node.attributes.length; i++) {
          const attr = node.attributes[i];
          attrs[attr.name] = attr.value;
        }
      }
      const children = [];
      const childNodes = node.childNodes || [];
      for (let i = 0; i < childNodes.length; i++) {
        const child = childNodes[i];
        if (child.nodeType === 3 || child.nodeType === 4) {
          const text = child.textContent;
          if (localTag === "style" || localTag === "text" || text.trim().length > 0) {
            children.push(text);
          }
        } else if (child.nodeType === 1) {
          const childOnml = domNodeToOnml(child);
          if (childOnml) children.push(childOnml);
        }
      }
      return [tag, attrs, ...children];
    }
    return null;
  }

  function xmlToOnml(xmlStr) {
    const DOMParserCtor = typeof DOMParser !== "undefined"
      ? DOMParser
      : (typeof globalThis !== "undefined" && globalThis.DOMParser ? globalThis.DOMParser : null);
    if (!DOMParserCtor) return null;
    const parser = new DOMParserCtor();
    const doc = parser.parseFromString(xmlStr, "image/svg+xml");
    if (doc.querySelector && doc.querySelector("parsererror")) {
      return null;
    }
    return domNodeToOnml(doc.documentElement);
  }

  function ensureNetlistSvgMergedSupport(nsvg) {
    if (!nsvg || nsvg._sgMergedSupport) return;
    const origRender = nsvg.render;
    let cachedXml = null;
    let cachedOnml = null;
    nsvg.render = async function (skinData, yosysNetlist) {
      if (
        typeof skinData === "string" &&
        skinData !== nsvg.digitalSkin &&
        skinData !== nsvg.analogSkin &&
        skinData !== "digital" &&
        skinData !== "analog"
      ) {
        let onml;
        if (skinData === cachedXml && cachedOnml) {
          onml = cachedOnml;
        } else {
          onml = xmlToOnml(skinData);
          if (onml) {
            cachedXml = skinData;
            cachedOnml = onml;
          }
        }
        if (onml) {
          return origRender.call(this, onml, yosysNetlist);
        }
      }
      return origRender.call(this, skinData, yosysNetlist);
    };
    nsvg._sgMergedSupport = true;
  }

  if (typeof window !== "undefined" && window.netlistsvg) {
    ensureNetlistSvgMergedSupport(window.netlistsvg);
  }

  function collectRawNetTokens(rawVal, outSet = new Set()) {
    if (typeof rawVal === "number" && Number.isInteger(rawVal)) {
      outSet.add(`num:${rawVal}`);
      return outSet;
    }
    if (typeof rawVal === "string") {
      const s = rawVal.trim().toLowerCase();
      if (s) outSet.add(`str:${s}`);
      return outSet;
    }
    if (Array.isArray(rawVal)) {
      for (const item of rawVal) {
        if (typeof item === "number" && Number.isInteger(item)) {
          outSet.add(`num:${item}`);
        } else if (typeof item === "string") {
          const s = item.trim().toLowerCase();
          if (s) outSet.add(`str:${s}`);
        }
      }
    }
    return outSet;
  }

  function tokensIntersectSet(tokens, targetSet) {
    for (const t of tokens) {
      if (targetSet.has(t)) return true;
    }
    return false;
  }

  function addNamedRailTokens(rawVal, gndRailTokens, vccRailTokens) {
    const tokens = collectRawNetTokens(rawVal);
    for (const tok of tokens) {
      if (!tok.startsWith("str:")) continue;
      const name = tok.slice(4);
      if (NETLIST_GND_NAME_RE.test(name)) gndRailTokens.add(tok);
      if (NETLIST_VCC_NAME_RE.test(name)) vccRailTokens.add(tok);
    }
  }

  function collectModuleRailTokens(mod) {
    const gndRailTokens = new Set();
    const vccRailTokens = new Set();

    if (mod.ports && typeof mod.ports === "object" && !Array.isArray(mod.ports)) {
      for (const pKey of Object.keys(mod.ports)) {
        if (FORBIDDEN_JSON_KEYS.has(pKey)) continue;
        const port = mod.ports[pKey];
        if (!port || typeof port !== "object" || Array.isArray(port)) continue;
        const rawBits = port.bits !== undefined ? port.bits : port.net !== undefined ? port.net : pKey;
        addNamedRailTokens(rawBits, gndRailTokens, vccRailTokens);
      }
    }

    if (mod.cells && typeof mod.cells === "object" && !Array.isArray(mod.cells)) {
      for (const cKey of Object.keys(mod.cells)) {
        if (FORBIDDEN_JSON_KEYS.has(cKey)) continue;
        const cell = mod.cells[cKey];
        if (!cell || typeof cell !== "object" || Array.isArray(cell)) continue;
        const rawTypeNorm = typeof cell.type === "string"
          ? cell.type.trim().toLowerCase().replace(/[\s-]+/g, "_")
          : "";
        const staticAlias = NETLIST_STATIC_ALIAS_MAP[rawTypeNorm];
        const rawConns = cell.connections && typeof cell.connections === "object" && !Array.isArray(cell.connections)
          ? cell.connections
          : null;
        if (!rawConns) continue;

        for (const pin of Object.keys(rawConns)) {
          if (FORBIDDEN_JSON_KEYS.has(pin)) continue;
          const val = rawConns[pin];
          addNamedRailTokens(val, gndRailTokens, vccRailTokens);
          if (staticAlias === "gnd" || staticAlias === "vee") {
            collectRawNetTokens(val, gndRailTokens);
          } else if (staticAlias === "vcc") {
            collectRawNetTokens(val, vccRailTokens);
          }
        }
      }
    }

    return { gndRailTokens, vccRailTokens };
  }

  function resolveNetlistCellType(rawType, rawConns, gndRailTokens, vccRailTokens, skipAnalogAliases = false) {
    const raw = typeof rawType === "string" && rawType.trim() ? rawType.trim() : "generic";
    if (skipAnalogAliases) {
      return raw;
    }
    const normKey = raw.toLowerCase().replace(/[\s-]+/g, "_");

    if (NETLIST_ANALOG_TYPES.has(normKey)) {
      return normKey;
    }

    const orientedMatch = normKey.match(/^(.+)_([hv])$/);
    if (orientedMatch && Object.prototype.hasOwnProperty.call(NETLIST_ORIENTABLE_ALIAS_MAP, orientedMatch[1])) {
      const pair = NETLIST_ORIENTABLE_ALIAS_MAP[orientedMatch[1]];
      return pair[orientedMatch[2] === "v" ? 1 : 0];
    }

    if (Object.prototype.hasOwnProperty.call(NETLIST_STATIC_ALIAS_MAP, normKey)) {
      return NETLIST_STATIC_ALIAS_MAP[normKey];
    }

    if (Object.prototype.hasOwnProperty.call(NETLIST_ORIENTABLE_ALIAS_MAP, normKey)) {
      const pair = NETLIST_ORIENTABLE_ALIAS_MAP[normKey];
      let touchesRail = false;
      if (rawConns && typeof rawConns === "object") {
        for (const pin of Object.keys(rawConns)) {
          if (FORBIDDEN_JSON_KEYS.has(pin)) continue;
          const toks = collectRawNetTokens(rawConns[pin]);
          if (tokensIntersectSet(toks, gndRailTokens) || tokensIntersectSet(toks, vccRailTokens)) {
            touchesRail = true;
            break;
          }
        }
      }
      return touchesRail ? pair[1] : pair[0];
    }

    return raw;
  }

  function getAnalogPinFamily(cellTypeLower) {
    if (cellTypeLower === "vcc" || cellTypeLower === "vee" || cellTypeLower === "gnd") return "rail";
    if (NETLIST_NONPOLAR_TWOPIN_TYPES.has(cellTypeLower)) return "twopin_ab";
    if (NETLIST_POLARIZED_TWOPIN_TYPES.has(cellTypeLower)) return "twopin_pm";
    if (/^(?:pot|potentiometer)_[hv]$/.test(cellTypeLower)) return "pot";
    if (/^(?:q_npn|q_pnp|transistor_npn|transistor_pnp)$/.test(cellTypeLower)) return "bjt";
    if (/^(?:nmos|q_nmos|mosfet_n|pmos|q_pmos|mosfet_p)$/.test(cellTypeLower)) return "mosfet";
    if (cellTypeLower === "opamp" || cellTypeLower === "op") return "opamp";
    return null;
  }

  function inferNetlistPinDirection(cellTypeLower, pinName, isAnalogCell = true) {
    const pinUpper = String(pinName || "").trim().toUpperCase();
    if (isAnalogCell) {
      if (cellTypeLower === "vcc") return "output";
      if (cellTypeLower === "gnd" || cellTypeLower === "vee") return "input";
      if (
        cellTypeLower === "q_npn" ||
        cellTypeLower === "q_pnp" ||
        cellTypeLower === "transistor_npn" ||
        cellTypeLower === "transistor_pnp"
      ) {
        return pinUpper === "E" ? "output" : "input";
      }
      if (cellTypeLower === "nmos" || cellTypeLower === "q_nmos" || cellTypeLower === "mosfet_n") {
        return pinUpper === "S" ? "output" : "input";
      }
      if (cellTypeLower === "pmos" || cellTypeLower === "q_pmos" || cellTypeLower === "mosfet_p") {
        return pinUpper === "D" ? "output" : "input";
      }
      if (/^(?:pot|potentiometer)_[hv]$/.test(cellTypeLower)) {
        return pinUpper === "B" || pinUpper === "W" ? "output" : "input";
      }
      if (cellTypeLower === "opamp" || cellTypeLower === "op") {
        return pinUpper === "OUT" || pinUpper === "Y" ? "output" : "input";
      }
      if (cellTypeLower === "transformer_1p_1s") {
        return pinUpper === "L2.1" || pinUpper === "L2.2" ? "output" : "input";
      }
      if (NETLIST_TWO_PIN_ANALOG_TYPES.has(cellTypeLower)) {
        if (pinUpper === "B" || pinUpper === "-") return "output";
        return "input";
      }
    }
    if (NETLIST_OUTPUT_PINS.has(pinUpper) || /^OUT\d*$/.test(pinUpper)) {
      return "output";
    }
    return "input";
  }

  function normalizeCellPinsAndDirections(cellTypeLower, isAnalogCell, rawConns, existingDirs, resolveBits, gndRailTokens, vccRailTokens) {
    const family = isAnalogCell ? getAnalogPinFamily(cellTypeLower) : null;
    const pinMap = family && family !== "rail" ? NETLIST_ANALOG_PIN_MAPS[family] : null;
    const origPins = Object.keys(rawConns).filter((p) => !FORBIDDEN_JSON_KEYS.has(p));

    const renameMap = new Map();
    const usedTargets = new Set();

    if (family === "rail" && origPins.length === 1) {
      renameMap.set(origPins[0], "A");
      usedTargets.add("A");
    } else if (pinMap) {
      for (const origPin of origPins) {
        const mapped = pinMap[origPin.trim().toLowerCase()];
        if (mapped && !usedTargets.has(mapped)) {
          renameMap.set(origPin, mapped);
          usedTargets.add(mapped);
        }
      }
      for (const origPin of origPins) {
        if (renameMap.has(origPin)) continue;
        if (!usedTargets.has(origPin)) {
          renameMap.set(origPin, origPin);
          usedTargets.add(origPin);
        }
      }
      if (family === "twopin_ab" && origPins.length === 2 && !(usedTargets.has("A") && usedTargets.has("B"))) {
        for (const origPin of origPins) {
          const curTarget = renameMap.get(origPin);
          if (curTarget === "A" || curTarget === "B") continue;
          const fallbackTarget = !usedTargets.has("A") ? "A" : !usedTargets.has("B") ? "B" : curTarget;
          if (fallbackTarget !== curTarget) {
            usedTargets.delete(curTarget);
            usedTargets.add(fallbackTarget);
            renameMap.set(origPin, fallbackTarget);
          }
        }
      }
    } else {
      for (const origPin of origPins) {
        renameMap.set(origPin, origPin);
      }
    }

    const normConns = {};
    const rawByTargetPin = {};
    for (const origPin of origPins) {
      const targetPin = renameMap.get(origPin) || origPin;
      if (FORBIDDEN_JSON_KEYS.has(targetPin)) continue;
      rawByTargetPin[targetPin] = rawConns[origPin];
      normConns[targetPin] = resolveBits(rawConns[origPin]);
    }

    let swappedAB = false;
    if (isAnalogCell && NETLIST_NONPOLAR_TWOPIN_TYPES.has(cellTypeLower) && cellTypeLower.endsWith("_v")) {
      if (normConns.A !== undefined && normConns.B !== undefined) {
        const toksA = collectRawNetTokens(rawByTargetPin.A);
        const toksB = collectRawNetTokens(rawByTargetPin.B);
        const aIsGnd = tokensIntersectSet(toksA, gndRailTokens);
        const bIsGnd = tokensIntersectSet(toksB, gndRailTokens);
        const aIsVcc = tokensIntersectSet(toksA, vccRailTokens);
        const bIsVcc = tokensIntersectSet(toksB, vccRailTokens);
        if ((aIsGnd && !bIsGnd) || (bIsVcc && !aIsVcc)) {
          const tmpBits = normConns.A;
          normConns.A = normConns.B;
          normConns.B = tmpBits;
          swappedAB = true;
        }
      }
    }

    const normDirs = {};
    if (!swappedAB) {
      for (const origPin of Object.keys(existingDirs)) {
        if (FORBIDDEN_JSON_KEYS.has(origPin)) continue;
        const targetPin = renameMap.get(origPin) || origPin;
        if (FORBIDDEN_JSON_KEYS.has(targetPin)) continue;
        const d = String(existingDirs[origPin] || "").trim().toLowerCase();
        if (d === "input" || d === "output" || (!isAnalogCell && d === "inout")) {
          normDirs[targetPin] = d;
        }
      }
    }
    for (const pin of Object.keys(normConns)) {
      if (!Object.prototype.hasOwnProperty.call(normDirs, pin)) {
        normDirs[pin] = inferNetlistPinDirection(cellTypeLower, pin, isAnalogCell);
      }
    }

    return { normConns, normDirs };
  }

  function normalizeCellAttributes(cell) {
    const out = {};
    let hasAny = false;
    if (cell.attributes && typeof cell.attributes === "object" && !Array.isArray(cell.attributes)) {
      for (const key of Object.keys(cell.attributes)) {
        if (FORBIDDEN_JSON_KEYS.has(key)) continue;
        const v = cell.attributes[key];
        if (v === null || v === undefined) continue;
        if ((key === "value" || key === "ref" || key === "name") && typeof v !== "string") {
          out[key] = String(v);
        } else {
          out[key] = v;
        }
        hasAny = true;
      }
    }
    if (!Object.prototype.hasOwnProperty.call(out, "value") && (typeof cell.value === "string" || typeof cell.value === "number")) {
      const s = String(cell.value).trim();
      if (s) {
        out.value = s;
        hasAny = true;
      }
    }
    if (!Object.prototype.hasOwnProperty.call(out, "name") && (typeof cell.name === "string" || typeof cell.name === "number")) {
      const s = String(cell.name).trim();
      if (s) {
        out.name = s;
        hasAny = true;
      }
    }
    return hasAny ? out : null;
  }

  function cloneSafePlainObject(obj) {
    const out = {};
    for (const k of Object.keys(obj)) {
      if (FORBIDDEN_JSON_KEYS.has(k)) continue;
      out[k] = obj[k];
    }
    return out;
  }

  function normalizeNetlistPayload(rawObj) {
    if (!rawObj || typeof rawObj !== "object" || Array.isArray(rawObj)) {
      throw new Error("Netlist payload must be a JSON object");
    }

    let sourceModules = null;
    if (rawObj.modules && typeof rawObj.modules === "object" && !Array.isArray(rawObj.modules)) {
      sourceModules = rawObj.modules;
    } else if (rawObj.cells && typeof rawObj.cells === "object" && !Array.isArray(rawObj.cells)) {
      const modName = typeof rawObj.name === "string" && rawObj.name.trim() ? rawObj.name.trim() : "circuit";
      sourceModules = {
        [modName]: {
          ports: rawObj.ports && typeof rawObj.ports === "object" && !Array.isArray(rawObj.ports) ? rawObj.ports : {},
          cells: rawObj.cells
        }
      };
    } else {
      throw new Error("Netlist JSON requires a 'modules' or 'cells' object");
    }

    let maxBitId = 1;
    const scanBits = (val) => {
      if (typeof val === "number" && Number.isInteger(val) && val > maxBitId) {
        maxBitId = val;
        return;
      }
      if (Array.isArray(val)) {
        for (const item of val) {
          if (typeof item === "number" && Number.isInteger(item) && item > maxBitId) {
            maxBitId = item;
          }
        }
      }
    };

    for (const modKey of Object.keys(sourceModules)) {
      if (FORBIDDEN_JSON_KEYS.has(modKey)) continue;
      const mod = sourceModules[modKey];
      if (!mod || typeof mod !== "object" || Array.isArray(mod)) continue;
      if (mod.ports && typeof mod.ports === "object" && !Array.isArray(mod.ports)) {
        for (const pKey of Object.keys(mod.ports)) {
          if (FORBIDDEN_JSON_KEYS.has(pKey)) continue;
          const port = mod.ports[pKey];
          if (port && typeof port === "object") scanBits(port.bits);
        }
      }
      if (mod.cells && typeof mod.cells === "object" && !Array.isArray(mod.cells)) {
        for (const cKey of Object.keys(mod.cells)) {
          if (FORBIDDEN_JSON_KEYS.has(cKey)) continue;
          const cell = mod.cells[cKey];
          if (cell && typeof cell === "object" && cell.connections && typeof cell.connections === "object") {
            for (const pin of Object.keys(cell.connections)) {
              if (!FORBIDDEN_JSON_KEYS.has(pin)) scanBits(cell.connections[pin]);
            }
          }
        }
      }
    }

    let nextBitId = maxBitId;
    const explicitSkin = String(rawObj.skin || "").trim().toLowerCase();
    const isExplicitDigital = explicitSkin === "digital";
    let sawAnalogCell = explicitSkin === "analog";
    let sawDigitalCell = isExplicitDigital;
    const normalizedModules = {};

    for (const modKey of Object.keys(sourceModules)) {
      if (FORBIDDEN_JSON_KEYS.has(modKey)) continue;
      const mod = sourceModules[modKey];
      if (!mod || typeof mod !== "object" || Array.isArray(mod)) continue;

      const { gndRailTokens, vccRailTokens } = collectModuleRailTokens(mod);
      const netMap = new Map();
      const resolveBits = (rawBits, fallbackName) => {
        const list = Array.isArray(rawBits)
          ? rawBits
          : rawBits !== undefined && rawBits !== null
            ? [rawBits]
            : fallbackName !== undefined
              ? [fallbackName]
              : [];
        const out = [];
        for (const item of list) {
          if (typeof item === "number" && Number.isInteger(item)) {
            out.push(item);
          } else if (typeof item === "string") {
            const s = item.trim();
            if (!s) continue;
            const lower = s.toLowerCase();
            if (s === "0" || s === "1" || lower === "x" || lower === "z") {
              out.push(lower);
            } else {
              if (!netMap.has(s)) {
                nextBitId += 1;
                netMap.set(s, nextBitId);
              }
              out.push(netMap.get(s));
            }
          }
        }
        return out;
      };

      const normPorts = {};
      if (mod.ports && typeof mod.ports === "object" && !Array.isArray(mod.ports)) {
        for (const pKey of Object.keys(mod.ports)) {
          if (FORBIDDEN_JSON_KEYS.has(pKey)) continue;
          const port = mod.ports[pKey];
          if (!port || typeof port !== "object" || Array.isArray(port)) continue;
          const dirRaw = String(port.direction || "input").trim().toLowerCase();
          const direction = dirRaw === "output" || dirRaw === "out"
            ? "output"
            : dirRaw === "inout"
              ? "inout"
              : "input";
          const rawBits = port.bits !== undefined ? port.bits : port.net !== undefined ? port.net : pKey;
          normPorts[pKey] = {
            direction,
            bits: resolveBits(rawBits, pKey)
          };
        }
      }

      const normCells = {};
      if (mod.cells && typeof mod.cells === "object" && !Array.isArray(mod.cells)) {
        for (const cKey of Object.keys(mod.cells)) {
          if (FORBIDDEN_JSON_KEYS.has(cKey)) continue;
          const cell = mod.cells[cKey];
          if (!cell || typeof cell !== "object" || Array.isArray(cell)) continue;

          const rawConns = cell.connections && typeof cell.connections === "object" && !Array.isArray(cell.connections)
            ? cell.connections
            : {};
          const cellType = resolveNetlistCellType(cell.type, rawConns, gndRailTokens, vccRailTokens, isExplicitDigital);
          const cellTypeLower = cellType.toLowerCase();
          const isAnalogCell = !isExplicitDigital && NETLIST_ANALOG_TYPES.has(cellTypeLower);
          if (isAnalogCell) {
            sawAnalogCell = true;
          } else {
            sawDigitalCell = true;
          }

          const existingDirs = cell.port_directions && typeof cell.port_directions === "object" && !Array.isArray(cell.port_directions)
            ? cell.port_directions
            : {};
          const { normConns, normDirs } = normalizeCellPinsAndDirections(
            cellTypeLower,
            isAnalogCell,
            rawConns,
            existingDirs,
            resolveBits,
            gndRailTokens,
            vccRailTokens
          );

          const normCell = {
            type: cellType,
            port_directions: normDirs,
            connections: normConns
          };
          const normAttrs = normalizeCellAttributes(cell);
          if (normAttrs) {
            normCell.attributes = normAttrs;
          }
          if (cell.parameters && typeof cell.parameters === "object" && !Array.isArray(cell.parameters)) {
            normCell.parameters = cloneSafePlainObject(cell.parameters);
          }
          if (cell.hide_name !== undefined) {
            normCell.hide_name = cell.hide_name;
          }
          normCells[cKey] = normCell;
        }
      }

      const normMod = {
        ports: normPorts,
        cells: normCells
      };
      if (mod.attributes && typeof mod.attributes === "object" && !Array.isArray(mod.attributes)) {
        normMod.attributes = cloneSafePlainObject(mod.attributes);
      }
      normalizedModules[modKey] = normMod;
    }

    if (Object.keys(normalizedModules).length === 0) {
      throw new Error("Netlist JSON contains no valid modules");
    }

    const skin = explicitSkin === "digital"
      ? "digital"
      : explicitSkin === "analog"
        ? "analog"
        : explicitSkin === "mixed" || explicitSkin === "unified"
          ? "mixed"
          : (sawAnalogCell && sawDigitalCell)
            ? "mixed"
            : sawAnalogCell
              ? "analog"
              : "digital";

    return {
      netlist: { modules: normalizedModules },
      skin
    };
  }

  function reportHeight(desiredHeight) {
    const clamped = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, Math.ceil(desiredHeight)));
    postToParent({ type: "SG_DIAGRAM_RESIZE", height: clamped });
  }

  async function renderDiagram(engine, source, theme) {
    const adapter = ENGINE_ADAPTERS[engine];
    if (!adapter) {
      postToParent({ type: "SG_DIAGRAM_ERROR", error: `Unsupported diagram engine: ${engine}` });
      return;
    }

    const gen = ++_renderGen;
    _currentEngine = engine;
    _currentSource = String(source || "");
    _currentTheme = theme === "light" ? "light" : "dark";
    const isDark = _currentTheme === "dark";
    document.body.classList.toggle("sg-sb-dark", isDark);

    clearStage();
    showStatus(`Rendering ${engine}…`, false);

    try {
      const result = await adapter(_currentSource, isDark);
      if (gen !== _renderGen) return;
      hideStatus();

      if (result.kind === "svg") {
        stageEl.classList.add(`sg-engine-${engine}`);
        stageEl.appendChild(result.element);
        _currentSvgEl = result.element;
        const dims = ensureSvgDimensions(result.element);
        _baseWidth = dims.width;
        _baseHeight = dims.height;
        const targetHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, dims.height + 40));
        reportHeight(targetHeight);
        requestAnimationFrame(() => {
          fitToView();
        });
        postToParent({
          type: "SG_DIAGRAM_RENDERED",
          engine,
          canExportSvg: true,
          width: dims.width,
          height: dims.height
        });
      } else if (result.kind === "chart") {
        viewportEl.classList.add("sg-sb-chart-mode");
        stageEl.style.width = "100%";
        stageEl.style.height = "100%";
        const wrap = document.createElement("div");
        wrap.className = "sg-sb-chart-wrap";
        const canvas = document.createElement("canvas");
        wrap.appendChild(canvas);
        stageEl.appendChild(wrap);
        _currentCanvasEl = canvas;

        const targetHeight = 360;
        reportHeight(targetHeight);

        const ctx = canvas.getContext("2d");
        _activeChartInstance = new result.ChartCtor(ctx, result.config);
        postToParent({
          type: "SG_DIAGRAM_RENDERED",
          engine,
          canExportSvg: false,
          width: canvas.width || 640,
          height: targetHeight
        });
      }
    } catch (err) {
      if (gen !== _renderGen) return;
      clearStage();
      const msg = String(err && err.message || err || "Diagram render failed");
      showStatus(msg, true);
      reportHeight(160);
      postToParent({ type: "SG_DIAGRAM_ERROR", engine, error: msg });
    }
  }

  function serializeCurrentSvg() {
    if (!_currentSvgEl) return null;
    const serializer = new XMLSerializer();
    let svgText = serializer.serializeToString(_currentSvgEl);
    if (!svgText.includes('xmlns="http://www.w3.org/2000/svg"')) {
      svgText = svgText.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    return svgText;
  }

  function rasterizeSvgToPngDataUrl(svgText, width, height, isDark) {
    return new Promise((resolve, reject) => {
      const w = Math.max(120, Math.min(4096, Math.ceil(width || 800)));
      const h = Math.max(120, Math.min(4096, Math.ceil(height || 450)));
      const scale = 2;
      const canvas = document.createElement("canvas");
      canvas.width = w * scale;
      canvas.height = h * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas 2D context unavailable"));

      const img = new Image();
      img.onload = () => {
        try {
          ctx.fillStyle = isDark ? "#16171a" : "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.scale(scale, scale);
          if ((_currentEngine === "wavedrom" || _currentEngine === "netlist") && isDark) {
            ctx.filter = "invert(0.92) hue-rotate(180deg)";
          }
          ctx.drawImage(img, 0, 0, w, h);
          const dataUrl = canvas.toDataURL("image/png");
          resolve(dataUrl);
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => reject(new Error("Failed to rasterize SVG to PNG"));
      const encoded = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgText);
      img.src = encoded;
    });
  }

  async function handleExport(format, requestId) {
    try {
      if (format === "svg") {
        const svgText = serializeCurrentSvg();
        if (!svgText) throw new Error("SVG export is not available for this engine");
        postToParent({
          type: "SG_DIAGRAM_EXPORT_RESULT",
          requestId,
          format: "svg",
          engine: _currentEngine,
          data: svgText
        });
        return;
      }

      if (format === "png") {
        if (_currentCanvasEl) {
          const w = _currentCanvasEl.width || 800;
          const h = _currentCanvasEl.height || 400;
          const out = document.createElement("canvas");
          out.width = w;
          out.height = h;
          const octx = out.getContext("2d");
          octx.fillStyle = _currentTheme === "dark" ? "#16171a" : "#ffffff";
          octx.fillRect(0, 0, w, h);
          octx.drawImage(_currentCanvasEl, 0, 0);
          postToParent({
            type: "SG_DIAGRAM_EXPORT_RESULT",
            requestId,
            format: "png",
            engine: _currentEngine,
            data: out.toDataURL("image/png")
          });
          return;
        }
        const svgText = serializeCurrentSvg();
        if (!svgText) throw new Error("No diagram rendered to export");
        const pngDataUrl = await rasterizeSvgToPngDataUrl(svgText, _baseWidth, _baseHeight, _currentTheme === "dark");
        postToParent({
          type: "SG_DIAGRAM_EXPORT_RESULT",
          requestId,
          format: "png",
          engine: _currentEngine,
          data: pngDataUrl
        });
      }
    } catch (err) {
      postToParent({
        type: "SG_DIAGRAM_EXPORT_RESULT",
        requestId,
        format,
        engine: _currentEngine,
        error: String(err && err.message || err)
      });
    }
  }

  function bindViewportInteractions() {
    if (!viewportEl) return;

    viewportEl.addEventListener("wheel", (e) => {
      if (_currentEngine === "chart") return;
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.12 : 0.89;
      setZoom(_scale * factor);
    }, { passive: false });

    viewportEl.addEventListener("pointerdown", (e) => {
      if (_currentEngine === "chart" || e.button !== 0) return;
      _isDragging = true;
      _dragStartX = e.clientX;
      _dragStartY = e.clientY;
      _dragOriginPanX = _panX;
      _dragOriginPanY = _panY;
      viewportEl.classList.add("sg-sb-dragging");
      if (typeof viewportEl.setPointerCapture === "function") {
        try { viewportEl.setPointerCapture(e.pointerId); } catch (_e) {}
      }
    });

    viewportEl.addEventListener("pointermove", (e) => {
      if (!_isDragging) return;
      _panX = _dragOriginPanX + (e.clientX - _dragStartX);
      _panY = _dragOriginPanY + (e.clientY - _dragStartY);
      applyTransform();
    });

    const endDrag = () => {
      if (!_isDragging) return;
      _isDragging = false;
      viewportEl.classList.remove("sg-sb-dragging");
    };
    viewportEl.addEventListener("pointerup", endDrag);
    viewportEl.addEventListener("pointercancel", endDrag);

    window.addEventListener("resize", () => {
      if (_currentEngine && _currentEngine !== "chart") {
        fitToView();
      }
    });
  }

  if (typeof window !== "undefined") {
    bindViewportInteractions();

    window.addEventListener("message", (event) => {
      if (event.source !== window.parent) return;
      if (event.origin !== PARENT_ORIGIN) return;
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (!INSTANCE_TOKEN || data.token !== INSTANCE_TOKEN) return;

      switch (data.type) {
        case "SG_DIAGRAM_RENDER":
          renderDiagram(data.engine, data.source, data.theme);
          break;
        case "SG_DIAGRAM_THEME":
          if (_currentEngine && _currentSource && data.theme !== _currentTheme) {
            renderDiagram(_currentEngine, _currentSource, data.theme);
          }
          break;
        case "SG_DIAGRAM_ZOOM":
          if (data.action === "in") setZoom(_scale * 1.2);
          else if (data.action === "out") setZoom(_scale / 1.2);
          else if (data.action === "fit") fitToView();
          break;
        case "SG_DIAGRAM_EXPORT":
          handleExport(data.format, data.requestId);
          break;
      }
    });

    postToParent({ type: "SG_DIAGRAM_READY" });
  }

  // Expose pure helpers for offline Node VM verification
  if (typeof globalThis !== "undefined") {
    globalThis.__sgDiagramSandboxTestApi = {
      parseAndSanitizeSvg,
      safeJsonParse,
      validateChartConfig,
      normalizeNetlistPayload,
      mergeNetlistSkins,
      ensureNetlistSvgMergedSupport,
      xmlToOnml,
      renderSvgInlineMath,
      preprocessMermaidMath,
      preprocessDotMath,
      isSafeHref,
      sanitizeCssText
    };
  }
})();
