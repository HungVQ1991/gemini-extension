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
    wavedrom: ["lib/diagrams/wavedrom.min.js"]
  });

  const _scriptLoadCache = new Map();
  let _vizInstancePromise = null;
  let _activeChartInstance = null;
  let _currentEngine = null;
  let _currentSource = "";
  let _currentTheme = "dark";
  let _currentSvgEl = null;
  let _currentCanvasEl = null;
  let _renderSeq = 0;

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
        flowchart: { htmlLabels: false },
        htmlLabels: false
      });
      const uid = "sg_mmd_" + (++_renderSeq) + "_" + Math.random().toString(36).slice(2, 7);
      const rendered = await m.render(uid, String(source || ""));
      const svgCode = typeof rendered === "string" ? rendered : (rendered && rendered.svg ? rendered.svg : "");
      if (!svgCode) throw new Error("Mermaid returned empty SVG");
      const svgEl = parseAndSanitizeSvg(svgCode, false);
      return { kind: "svg", element: svgEl };
    },

    async svg(source) {
      const svgEl = parseAndSanitizeSvg(source, false);
      return { kind: "svg", element: svgEl };
    },

    async dot(source, isDark) {
      await loadEngineScript("dot");
      if (!window.Viz || typeof window.Viz.instance !== "function") {
        throw new Error("Graphviz Viz library failed to initialize");
      }
      if (!_vizInstancePromise) {
        _vizInstancePromise = window.Viz.instance();
      }
      const viz = await _vizInstancePromise;
      const svgStr = viz.renderString(String(source || ""), { format: "svg" });
      if (!svgStr || !svgStr.includes("<svg")) {
        throw new Error("Graphviz returned empty SVG");
      }
      const svgEl = parseAndSanitizeSvg(svgStr, false);
      normalizeDotDarkTheme(svgEl, isDark);
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
    }
  };

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

    _currentEngine = engine;
    _currentSource = String(source || "");
    _currentTheme = theme === "light" ? "light" : "dark";
    const isDark = _currentTheme === "dark";
    document.body.classList.toggle("sg-sb-dark", isDark);

    clearStage();
    showStatus(`Rendering ${engine}…`, false);

    try {
      const result = await adapter(_currentSource, isDark);
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
          if (_currentEngine === "wavedrom" && isDark) {
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
      isSafeHref,
      sanitizeCssText
    };
  }
})();
