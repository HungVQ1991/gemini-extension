const SG_DIAGRAM_DEBOUNCE_MS = 750;
const SG_DIAGRAM_ENGINE_MAP = Object.freeze({
  mermaid: "mermaid",
  svg: "svg",
  dot: "dot",
  graphviz: "dot",
  chart: "chart",
  chartjs: "chart",
  "chart-json": "chart",
  wavedrom: "wavedrom",
  netlist: "netlist",
  netlistsvg: "netlist",
  circuit: "netlist",
  schematic: "netlist"
});
const SG_DIAGRAM_GENERIC_LABELS = new Set([
  "",
  "code",
  "code snippet",
  "snippet",
  "plain",
  "plaintext",
  "text",
  "txt",
  "đoạn mã",
  "đoạn",
  "mã",
  "mã nguồn",
  "văn bản"
]);
const SG_DIAGRAM_CHART_TYPES = new Set([
  "line",
  "bar",
  "scatter",
  "radar",
  "pie",
  "doughnut",
  "polararea",
  "bubble"
]);
const SG_DIAGRAM_LABELS = Object.freeze({
  mermaid: "Mermaid",
  svg: "SVG",
  dot: "Graphviz",
  chart: "Chart.js",
  wavedrom: "WaveDrom",
  netlist: "NetlistSVG"
});

const SG_DIAGRAM_LAZY_MARGIN_PX = 350;
let isDiagramRendererEnabled = true;
let _sgDiagramInitialized = false;
let _sgDiagramMessageBound = false;
let _sgSvgSourceListenerBound = false;
let _sgDiagramThemeObserver = null;
let _sgDiagramIntersectionObserver = null;
let _sgDiagramLastTheme = null;
let _sgDiagramExportSeq = 0;
let _sgDiagramFullscreenState = null;

const _sgDiagramEntries = new Map();
const _sgDiagramEntriesByToken = new Map();
const _sgDiagramPendingExports = new Map();
const _sgSvgBlockSources = new Map();
let _sgDiagramNonDiagramCache = new WeakSet();

function sgDiagramGetExtOrigin() {
  try {
    if (typeof chrome !== "undefined" && chrome.runtime && typeof chrome.runtime.getURL === "function") {
      return new URL(chrome.runtime.getURL("diagram-sandbox.html")).origin;
    }
  } catch (_e) {}
  return "";
}

function sgDiagramGenerateToken() {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    }
  } catch (_e) {}
  return (
    Math.random().toString(36).slice(2) +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2)
  );
}

function sgDiagramHashText(text) {
  const s = String(text || "");
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `${s.length}:${(h >>> 0).toString(16)}`;
}

function sgDiagramGetCurrentTheme() {
  if (typeof detectTheme === "function") {
    return detectTheme() === "dark" ? "dark" : "light";
  }
  if (typeof document !== "undefined" && document.body && document.body.classList) {
    return document.body.classList.contains("dark-theme") ? "dark" : "light";
  }
  return "dark";
}

function sgDiagramReadFullHeaderLabel(codeBlock) {
  if (!codeBlock || typeof codeBlock.querySelector !== "function") return "";
  const headerEl = codeBlock.querySelector(".code-block-decoration, .header, .bar");
  if (!headerEl || typeof headerEl.cloneNode !== "function") return "";
  try {
    const clone = headerEl.cloneNode(true);
    const ignoreNodes = clone.querySelectorAll(".sg-cb-actions, .buttons, button, [role='button'], svg");
    for (const n of ignoreNodes) n.remove();
    const cleaned = String(clone.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
    if (cleaned && cleaned.length <= 28 && !/copy|use code|caution|download/i.test(cleaned)) {
      return cleaned;
    }
  } catch (_e) {}
  return "";
}

function sgDiagramIsXmlSvgSource(sourceText) {
  const trimmed = String(sourceText || "").trim();
  if (!trimmed) return false;
  if (/^<svg[\s>]/i.test(trimmed)) return true;
  if (/^<\?xml\b[\s\S]*?\?>\s*(?:<!--[\s\S]*?-->\s*)*(?:<!DOCTYPE\b[^>]*>\s*)*<svg[\s>]/i.test(trimmed)) {
    return true;
  }
  return false;
}

function sgSniffMermaidSource(sourceText) {
  let text = String(sourceText || "").trim();
  if (!text) return false;
  if (text.startsWith("---")) {
    const fmEnd = text.indexOf("\n---", 3);
    if (fmEnd !== -1) {
      text = text.slice(fmEnd + 4).trim();
    }
  }
  const lines = text.split(/\r?\n/);
  let firstLine = "";
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("%%")) continue;
    firstLine = line;
    break;
  }
  if (!firstLine) return false;
  return (
    /^flowchart(?:-v2)?(?:\s+(?:TB|TD|BT|RL|LR))?(?:\s|$|;)/i.test(firstLine) ||
    /^graph\s+(?:TB|TD|BT|RL|LR)(?:\s|$|;)/i.test(firstLine) ||
    /^(?:sequenceDiagram|classDiagram(?:-v2)?|stateDiagram(?:-v2)?|erDiagram|gantt|mindmap|timeline|gitGraph|quadrantChart|architecture-beta|block-beta|journey|requirementDiagram|xychart-beta|sankey-beta|packet-beta|kanban|zenuml|C4(?:Context|Container|Component|Dynamic|Deployment))(?:\s|:|$)/.test(firstLine) ||
    /^pie(?:\s+showData|\s+title\b|\s*$)/i.test(firstLine)
  );
}

function sgSniffDotSource(sourceText) {
  let text = String(sourceText || "").trim();
  if (!text) return false;
  text = text.replace(/^(?:\s*(?:\/\/[^\n]*|\/\*[\s\S]*?\*\/|#[^\n]*)\s*)+/, "").trim();
  if (!/^(?:strict\s+)?(?:di)?graph\b(?:\s+(?:"[^"]*"|[A-Za-z_][\w]*))?\s*\{/i.test(text)) {
    return false;
  }
  if (!text.includes("}")) return false;
  return /(?:->|--|\b(?:node|edge|graph)\s*\[|\bsubgraph\b|\brankdir\s*=)/i.test(text);
}

function sgSniffWaveDromSignalArray(arr, depth) {
  if (!Array.isArray(arr) || depth > 8) return false;
  for (const item of arr) {
    if (!item) continue;
    if (Array.isArray(item)) {
      if (sgSniffWaveDromSignalArray(item, depth + 1)) return true;
    } else if (typeof item === "object" && typeof item.wave === "string") {
      return true;
    }
  }
  return false;
}

function sgSniffJsonDiagramEngine(sourceText) {
  const trimmed = String(sourceText || "").trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return null;
  let parsed = null;
  try {
    parsed = JSON.parse(trimmed);
  } catch (_e) {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;

  if (
    typeof parsed.type === "string" &&
    SG_DIAGRAM_CHART_TYPES.has(parsed.type.trim().toLowerCase()) &&
    parsed.data &&
    typeof parsed.data === "object" &&
    !Array.isArray(parsed.data) &&
    Array.isArray(parsed.data.datasets) &&
    parsed.data.datasets.some((ds) => ds && typeof ds === "object" && Array.isArray(ds.data))
  ) {
    return "chart";
  }

  if (Array.isArray(parsed.signal) && parsed.signal.length > 0 && sgSniffWaveDromSignalArray(parsed.signal, 0)) {
    return "wavedrom";
  }

  if (
    Array.isArray(parsed.reg) &&
    parsed.reg.length > 0 &&
    parsed.reg.every((item) => item && typeof item === "object" && typeof item.bits === "number" && item.bits > 0)
  ) {
    return "wavedrom";
  }

  if (
    Array.isArray(parsed.assign) &&
    parsed.assign.length > 0 &&
    parsed.assign.every((row) => Array.isArray(row) && row.length >= 2 && typeof row[0] === "string")
  ) {
    return "wavedrom";
  }

  if (
    parsed.modules &&
    typeof parsed.modules === "object" &&
    !Array.isArray(parsed.modules)
  ) {
    const modValues = Object.values(parsed.modules);
    const hasValidModule = modValues.some(
      (mod) =>
        mod &&
        typeof mod === "object" &&
        !Array.isArray(mod) &&
        ((mod.cells && typeof mod.cells === "object" && !Array.isArray(mod.cells)) ||
          (mod.ports && typeof mod.ports === "object" && !Array.isArray(mod.ports)))
    );
    if (hasValidModule) return "netlist";
  }

  if (
    parsed.cells &&
    typeof parsed.cells === "object" &&
    !Array.isArray(parsed.cells)
  ) {
    const cellValues = Object.values(parsed.cells);
    const hasValidCell = cellValues.some(
      (cell) =>
        cell &&
        typeof cell === "object" &&
        !Array.isArray(cell) &&
        typeof cell.type === "string" &&
        cell.connections &&
        typeof cell.connections === "object" &&
        !Array.isArray(cell.connections)
    );
    if (hasValidCell) return "netlist";
  }

  return null;
}

function sgDetectDiagramEngine(codeBlock, sourceText) {
  const rawLang = typeof sgDetectCodeBlockLanguage === "function"
    ? sgDetectCodeBlockLanguage(codeBlock)
    : "";
  const norm = String(rawLang || "")
    .trim()
    .toLowerCase()
    .replace(/^language-/, "")
    .replace(/^lang-/, "");
  const fullHeader = sgDiagramReadFullHeaderLabel(codeBlock);

  if (norm && Object.prototype.hasOwnProperty.call(SG_DIAGRAM_ENGINE_MAP, norm)) {
    return SG_DIAGRAM_ENGINE_MAP[norm];
  }
  if (fullHeader && Object.prototype.hasOwnProperty.call(SG_DIAGRAM_ENGINE_MAP, fullHeader)) {
    return SG_DIAGRAM_ENGINE_MAP[fullHeader];
  }

  const isXmlLabel = norm === "xml" || fullHeader === "xml";
  if (isXmlLabel) {
    return sgDiagramIsXmlSvgSource(sourceText) ? "svg" : null;
  }

  const isJsonLabel = norm === "json" || norm === "jsonc" || fullHeader === "json" || fullHeader === "jsonc";
  if (isJsonLabel) {
    return sgSniffJsonDiagramEngine(sourceText);
  }

  const isGenericLabel = SG_DIAGRAM_GENERIC_LABELS.has(norm) && (!fullHeader || SG_DIAGRAM_GENERIC_LABELS.has(fullHeader));
  if (!isGenericLabel) {
    return null;
  }

  if (sgDiagramIsXmlSvgSource(sourceText)) return "svg";
  if (sgSniffMermaidSource(sourceText)) return "mermaid";
  if (sgSniffDotSource(sourceText)) return "dot";
  const jsonEngine = sgSniffJsonDiagramEngine(sourceText);
  if (jsonEngine) return jsonEngine;

  return null;
}

function sgDiagramExtractSvgFromSrcdoc(srcdoc) {
  if (typeof srcdoc !== "string" || !srcdoc) return "";
  const bodyIdx = srcdoc.lastIndexOf("<body");
  if (bodyIdx === -1) return "";
  const bodySlice = srcdoc.slice(bodyIdx);
  const startIdx = bodySlice.search(/<svg(?:\s|>)/i);
  if (startIdx === -1) return "";
  const endIdx = bodySlice.toLowerCase().lastIndexOf("</svg>");
  if (endIdx <= startIdx) return "";
  return bodySlice.slice(startIdx, endIdx + 6).trim();
}

function sgDiagramGetSvgBlockSource(svgBlock) {
  if (!svgBlock || typeof svgBlock.getAttribute !== "function") return "";
  const svgId = svgBlock.getAttribute("data-sg-svg-id");
  if (svgId) {
    let cached = _sgSvgBlockSources.get(svgId);
    if (!cached && typeof window !== "undefined" && typeof CustomEvent === "function") {
      try {
        window.dispatchEvent(new CustomEvent("sg-svg-block-source-request", {
          detail: { id: svgId }
        }));
      } catch (_e) {}
      cached = _sgSvgBlockSources.get(svgId);
    }
    if (cached) return cached;
  }
  if (typeof svgBlock.querySelector === "function") {
    const genuiIframe = svgBlock.querySelector("genui-sandbox iframe[srcdoc]");
    if (genuiIframe) {
      const fromSrcdoc = sgDiagramExtractSvgFromSrcdoc(genuiIframe.getAttribute("srcdoc") || "");
      if (fromSrcdoc) return fromSrcdoc;
    }
  }
  return "";
}

function sgDiagramGetTargetSource(targetBlock, isNativeSvgBlock) {
  if (isNativeSvgBlock) {
    return sgDiagramGetSvgBlockSource(targetBlock);
  }
  return typeof sgGetCodeBlockSource === "function" ? sgGetCodeBlockSource(targetBlock) : "";
}

function sgHandleCapturedSvgBlockSource(event) {
  const detail = event && event.detail;
  if (!detail || typeof detail.id !== "string" || typeof detail.svg !== "string" || !detail.svg.trim()) return;
  _sgSvgBlockSources.set(detail.id, detail.svg);
  if (!isExtensionEnabled || !isDiagramRendererEnabled || typeof document === "undefined") return;
  const blocks = document.querySelectorAll("svg-code-block");
  for (const sb of blocks) {
    if (sb.getAttribute("data-sg-svg-id") === detail.id) {
      if (typeof sb.closest === "function" && sb.closest('[id^="sg-"]')) return;
      sgDiagramScheduleBlockRender(sb, "svg", detail.svg, true);
      return;
    }
  }
}

function sgDiagramIsGeneratingNow() {
  if (typeof document === "undefined") return false;
  const stopSelectors = [
    '[fonticon="stop"]',
    'mat-icon[fonticon="stop"]',
    'mat-icon[data-mat-icon-name="stop"]',
    'button[aria-label*="Stop" i]',
    'button[aria-label*="Dừng" i]'
  ];
  for (const sel of stopSelectors) {
    const el = document.querySelector(sel);
    if (el && el.offsetParent !== null) return true;
  }
  return false;
}

function sgDiagramIsBlockStreaming(codeBlock) {
  if (!codeBlock || !sgDiagramIsGeneratingNow()) return false;
  if (typeof document === "undefined" || typeof codeBlock.closest !== "function") return false;
  const ownerResp = codeBlock.closest("model-response, .model-response");
  if (!ownerResp) return false;
  const allResponses = document.querySelectorAll("model-response, .model-response");
  if (!allResponses.length) return false;
  return allResponses[allResponses.length - 1] === ownerResp;
}

function sgDiagramPostToEntry(entry, payload) {
  if (!entry || !entry.iframe || !entry.iframe.contentWindow) return;
  try {
    entry.iframe.contentWindow.postMessage(
      Object.assign({}, payload, { token: entry.token }),
      "*"
    );
  } catch (_e) {}
}

function sgDiagramSetMode(entry, mode) {
  if (!entry || !entry.codeBlock) return;
  const isPreview = mode === "preview";
  entry.mode = isPreview ? "preview" : "code";
  entry.codeBlock.classList.toggle("sg-diagram-preview-mode", isPreview);
  if (entry.stageEl) entry.stageEl.hidden = !isPreview;
  if (entry.codeViewEl) entry.codeViewEl.hidden = isPreview;
  if (entry.previewBtn) {
    entry.previewBtn.classList.toggle("sg-active", isPreview);
    entry.previewBtn.setAttribute("aria-pressed", isPreview ? "true" : "false");
  }
  if (entry.codeBtn) {
    entry.codeBtn.classList.toggle("sg-active", !isPreview);
    entry.codeBtn.setAttribute("aria-pressed", !isPreview ? "true" : "false");
  }
}

function sgDiagramSetError(entry, errorMsg) {
  if (!entry || !entry.errorBannerEl) return;
  const msg = String(errorMsg || "").trim();
  if (!msg) {
    entry.errorBannerEl.hidden = true;
    entry.errorBannerEl.textContent = "";
    return;
  }
  entry.errorBannerEl.textContent = `${SG_DIAGRAM_LABELS[entry.engine] || "Diagram"} render error: ${msg}`;
  entry.errorBannerEl.hidden = false;
}

function sgDiagramTriggerDownload(filename, contentOrDataUrl, isDataUrl) {
  try {
    const a = document.createElement("a");
    if (isDataUrl) {
      a.href = contentOrDataUrl;
    } else {
      const blob = new Blob([contentOrDataUrl], { type: "image/svg+xml;charset=utf-8" });
      a.href = URL.createObjectURL(blob);
      setTimeout(() => {
        try { URL.revokeObjectURL(a.href); } catch (_e) {}
      }, 4000);
    }
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (_e) {}
}

function sgDiagramRequestExport(entry, format) {
  if (!entry || !entry.ready) return;
  const requestId = `exp_${++_sgDiagramExportSeq}_${Date.now()}`;
  _sgDiagramPendingExports.set(requestId, {
    token: entry.token,
    engine: entry.engine,
    format,
    createdAt: Date.now()
  });
  sgDiagramPostToEntry(entry, {
    type: "SG_DIAGRAM_EXPORT",
    format,
    requestId
  });
}

function sgCloseDiagramFullscreen(restoreFocus) {
  const st = _sgDiagramFullscreenState;
  if (!st) return;
  _sgDiagramFullscreenState = null;

  if (typeof SG !== "undefined" && SG && SG.dispatcher) {
    SG.dispatcher.unregister("diagram:fs-esc");
  } else if (st.keyHandler) {
    document.removeEventListener("keydown", st.keyHandler, true);
  }
  if (st.fsEntry && st.fsEntry.token) {
    _sgDiagramEntriesByToken.delete(st.fsEntry.token);
  }
  if (st.overlay && st.overlay.parentNode) {
    st.overlay.remove();
  }
  if (restoreFocus && st.prevFocus && st.prevFocus.isConnected && typeof st.prevFocus.focus === "function") {
    try { st.prevFocus.focus(); } catch (_e) {}
  }
}

function sgOpenDiagramFullscreen(entry, triggerBtn) {
  if (!entry || typeof document === "undefined") return;
  if (_sgDiagramFullscreenState) sgCloseDiagramFullscreen(false);

  const source = entry.lastRenderPayload && typeof entry.lastRenderPayload.source === "string"
    ? entry.lastRenderPayload.source
    : (entry.codeBlock ? sgDiagramGetTargetSource(entry.codeBlock, Boolean(entry.isNativeSvgBlock)) : "");
  if (!source || !source.trim()) return;

  const prevFocus = triggerBtn || document.activeElement;
  const fsToken = sgDiagramGenerateToken();

  const overlay = document.createElement("div");
  overlay.className = "sg-diagram-fullscreen-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", `${SG_DIAGRAM_LABELS[entry.engine] || "Diagram"} Fullscreen Preview`);

  const card = document.createElement("div");
  card.className = "sg-diagram-fullscreen-card";

  const bar = document.createElement("div");
  bar.className = "sg-diagram-toolbar";

  const leftGroup = document.createElement("div");
  leftGroup.className = "sg-diagram-toolbar-group";
  const badge = document.createElement("span");
  badge.className = "sg-diagram-badge";
  badge.textContent = `${SG_DIAGRAM_LABELS[entry.engine] || entry.engine} · Fullscreen`;
  leftGroup.appendChild(badge);

  const rightGroup = document.createElement("div");
  rightGroup.className = "sg-diagram-toolbar-group";

  const mkBtn = (label, title, onClick) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "sg-diagram-btn";
    b.textContent = label;
    b.title = title;
    b.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    });
    return b;
  };

  const fsIframe = document.createElement("iframe");
  fsIframe.className = "sg-diagram-iframe";
  fsIframe.setAttribute("sandbox", "allow-scripts");
  fsIframe.setAttribute("title", `${SG_DIAGRAM_LABELS[entry.engine] || "Diagram"} Fullscreen Preview`);
  const fsUrl = typeof chrome !== "undefined" && chrome.runtime && typeof chrome.runtime.getURL === "function"
    ? chrome.runtime.getURL(`diagram-sandbox.html#token=${encodeURIComponent(fsToken)}`)
    : `diagram-sandbox.html#token=${encodeURIComponent(fsToken)}`;
  fsIframe.src = fsUrl;

  const fsErrorBanner = document.createElement("div");
  fsErrorBanner.className = "sg-diagram-error-banner";
  fsErrorBanner.setAttribute("role", "status");
  fsErrorBanner.hidden = true;

  let fsSvgBtn = null;
  const renderPayload = {
    type: "SG_DIAGRAM_RENDER",
    engine: entry.engine,
    source,
    theme: sgDiagramGetCurrentTheme()
  };

  const fsEntry = {
    token: fsToken,
    engine: entry.engine,
    isFullscreen: true,
    iframe: fsIframe,
    errorBannerEl: fsErrorBanner,
    svgBtn: null,
    ready: false,
    pendingRender: renderPayload,
    lastRenderPayload: renderPayload
  };

  if (entry.engine !== "chart") {
    rightGroup.appendChild(mkBtn("-", "Zoom out", () => sgDiagramPostToEntry(fsEntry, { type: "SG_DIAGRAM_ZOOM", action: "out" })));
    rightGroup.appendChild(mkBtn("Fit", "Fit to view", () => sgDiagramPostToEntry(fsEntry, { type: "SG_DIAGRAM_ZOOM", action: "fit" })));
    rightGroup.appendChild(mkBtn("+", "Zoom in", () => sgDiagramPostToEntry(fsEntry, { type: "SG_DIAGRAM_ZOOM", action: "in" })));
    fsSvgBtn = mkBtn("SVG", "Download SVG", () => sgDiagramRequestExport(fsEntry, "svg"));
    fsEntry.svgBtn = fsSvgBtn;
    rightGroup.appendChild(fsSvgBtn);
  }
  rightGroup.appendChild(mkBtn("PNG", "Download PNG", () => sgDiagramRequestExport(fsEntry, "png")));
  const closeBtn = mkBtn("Close", "Close fullscreen (Esc)", () => sgCloseDiagramFullscreen(true));
  rightGroup.appendChild(closeBtn);

  bar.appendChild(leftGroup);
  bar.appendChild(rightGroup);

  const body = document.createElement("div");
  body.className = "sg-diagram-fullscreen-body";
  body.appendChild(fsIframe);

  card.appendChild(bar);
  card.appendChild(fsErrorBanner);
  card.appendChild(body);
  overlay.appendChild(card);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) sgCloseDiagramFullscreen(true);
  });

  const keyHandler = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      sgCloseDiagramFullscreen(true);
    }
  };
  if (typeof SG !== "undefined" && SG && SG.dispatcher) {
    SG.dispatcher.register("diagram:fs-esc", "document", "keydown", keyHandler, SG.dispatcher.PRIORITY.MODAL_ESCAPE);
  } else {
    document.addEventListener("keydown", keyHandler, true);
  }

  _sgDiagramEntriesByToken.set(fsToken, fsEntry);
  _sgDiagramFullscreenState = { entry, fsEntry, overlay, prevFocus, keyHandler };
  document.body.appendChild(overlay);
  closeBtn.focus();
}

function sgMountDiagramHost(codeBlock, engine, isNativeSvgBlock) {
  const token = sgDiagramGenerateToken();
  const host = document.createElement("div");
  host.className = "sg-diagram-host";
  host.dataset.sgDiagramToken = token;

  const toolbar = document.createElement("div");
  toolbar.className = "sg-diagram-toolbar";

  const leftGroup = document.createElement("div");
  leftGroup.className = "sg-diagram-toolbar-group";

  const badge = document.createElement("span");
  badge.className = "sg-diagram-badge";
  badge.textContent = SG_DIAGRAM_LABELS[engine] || engine;

  const seg = document.createElement("div");
  seg.className = "sg-diagram-seg";
  seg.setAttribute("role", "group");
  seg.setAttribute("aria-label", "Diagram view mode");

  const previewBtn = document.createElement("button");
  previewBtn.type = "button";
  previewBtn.className = "sg-diagram-seg-btn sg-active";
  previewBtn.textContent = "Preview";
  previewBtn.setAttribute("aria-pressed", "true");

  const codeBtn = document.createElement("button");
  codeBtn.type = "button";
  codeBtn.className = "sg-diagram-seg-btn";
  codeBtn.textContent = "Code";
  codeBtn.setAttribute("aria-pressed", "false");

  seg.appendChild(previewBtn);
  seg.appendChild(codeBtn);
  leftGroup.appendChild(badge);
  leftGroup.appendChild(seg);

  const rightGroup = document.createElement("div");
  rightGroup.className = "sg-diagram-toolbar-group";

  const mkBtn = (label, title) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "sg-diagram-btn";
    b.textContent = label;
    b.title = title;
    return b;
  };

  const zoomOutBtn = mkBtn("-", "Zoom out");
  const fitBtn = mkBtn("Fit", "Fit to view");
  const zoomInBtn = mkBtn("+", "Zoom in");
  const fullBtn = mkBtn("Expand", "Fullscreen preview");
  const copyBtn = isNativeSvgBlock ? mkBtn("Copy", "Copy SVG code") : null;
  const svgBtn = mkBtn("SVG", "Download SVG");
  const pngBtn = mkBtn("PNG", "Download PNG");

  const isVector = engine !== "chart";
  zoomOutBtn.hidden = !isVector;
  fitBtn.hidden = !isVector;
  zoomInBtn.hidden = !isVector;
  svgBtn.hidden = !isVector;

  rightGroup.appendChild(zoomOutBtn);
  rightGroup.appendChild(fitBtn);
  rightGroup.appendChild(zoomInBtn);
  rightGroup.appendChild(fullBtn);
  if (copyBtn) rightGroup.appendChild(copyBtn);
  rightGroup.appendChild(svgBtn);
  rightGroup.appendChild(pngBtn);

  toolbar.appendChild(leftGroup);
  toolbar.appendChild(rightGroup);

  const errorBannerEl = document.createElement("div");
  errorBannerEl.className = "sg-diagram-error-banner";
  errorBannerEl.setAttribute("role", "status");
  errorBannerEl.hidden = true;

  const stageEl = document.createElement("div");
  stageEl.className = "sg-diagram-stage";

  const iframe = document.createElement("iframe");
  iframe.className = "sg-diagram-iframe";
  iframe.setAttribute("sandbox", "allow-scripts");
  iframe.setAttribute("title", `${SG_DIAGRAM_LABELS[engine] || "Diagram"} Preview`);
  const sandboxUrl = typeof chrome !== "undefined" && chrome.runtime && typeof chrome.runtime.getURL === "function"
    ? chrome.runtime.getURL(`diagram-sandbox.html#token=${encodeURIComponent(token)}`)
    : `diagram-sandbox.html#token=${encodeURIComponent(token)}`;
  iframe.src = sandboxUrl;
  stageEl.appendChild(iframe);

  host.appendChild(toolbar);
  host.appendChild(errorBannerEl);
  host.appendChild(stageEl);

  let codeViewEl = null;
  let codeEl = null;
  if (isNativeSvgBlock) {
    codeViewEl = document.createElement("div");
    codeViewEl.className = "sg-diagram-code-view";
    codeViewEl.hidden = true;
    const preEl = document.createElement("pre");
    codeEl = document.createElement("code");
    preEl.appendChild(codeEl);
    codeViewEl.appendChild(preEl);
    host.appendChild(codeViewEl);

    codeBlock.classList.add("sg-diagram-svg-managed");
    const svgPreview = codeBlock.querySelector(".svg-preview");
    if (svgPreview && svgPreview.parentNode) {
      svgPreview.parentNode.insertBefore(host, svgPreview);
    } else {
      const innerWrap = codeBlock.querySelector(".svg-code-block") || codeBlock;
      innerWrap.appendChild(host);
    }
  } else {
    const codeContainer = codeBlock.querySelector(".formatted-code-block-internal-container") || codeBlock.querySelector("pre");
    if (codeContainer && codeContainer.parentNode) {
      codeContainer.parentNode.insertBefore(host, codeContainer);
    } else {
      codeBlock.appendChild(host);
    }
  }

  const entry = {
    token,
    engine,
    isNativeSvgBlock: Boolean(isNativeSvgBlock),
    codeBlock,
    host,
    badge,
    previewBtn,
    codeBtn,
    zoomOutBtn,
    fitBtn,
    zoomInBtn,
    copyBtn,
    svgBtn,
    pngBtn,
    errorBannerEl,
    stageEl,
    codeViewEl,
    codeEl,
    iframe,
    ready: false,
    mode: "preview",
    pendingRender: null,
    lastRenderPayload: null,
    renderedHash: null,
    pendingHash: null,
    debounceTimer: null
  };

  previewBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    sgDiagramSetMode(entry, "preview");
    if (entry.ready) sgDiagramPostToEntry(entry, { type: "SG_DIAGRAM_ZOOM", action: "fit" });
  });
  codeBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    sgDiagramSetMode(entry, "code");
  });
  zoomOutBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    sgDiagramPostToEntry(entry, { type: "SG_DIAGRAM_ZOOM", action: "out" });
  });
  fitBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    sgDiagramPostToEntry(entry, { type: "SG_DIAGRAM_ZOOM", action: "fit" });
  });
  zoomInBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    sgDiagramPostToEntry(entry, { type: "SG_DIAGRAM_ZOOM", action: "in" });
  });
  fullBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    sgOpenDiagramFullscreen(entry, fullBtn);
  });
  if (copyBtn) {
    copyBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const text = entry.lastRenderPayload && entry.lastRenderPayload.source
        ? entry.lastRenderPayload.source
        : sgDiagramGetTargetSource(entry.codeBlock, true);
      if (!text) return;
      if (typeof navigator !== "undefined" && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        navigator.clipboard.writeText(text).then(() => {
          copyBtn.textContent = "Copied";
          setTimeout(() => { copyBtn.textContent = "Copy"; }, 1400);
        }).catch(() => {});
      }
    });
  }
  svgBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    sgDiagramRequestExport(entry, "svg");
  });
  pngBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    sgDiagramRequestExport(entry, "png");
  });

  _sgDiagramEntries.set(codeBlock, entry);
  _sgDiagramEntriesByToken.set(token, entry);
  return entry;
}

function sgDiagramDispatchRender(entry, engine, source, hash) {
  if (!entry || !entry.codeBlock || !entry.codeBlock.isConnected) return;
  if (entry.engine !== engine) {
    entry.engine = engine;
    entry.badge.textContent = SG_DIAGRAM_LABELS[engine] || engine;
    const isVector = engine !== "chart";
    entry.zoomOutBtn.hidden = !isVector;
    entry.fitBtn.hidden = !isVector;
    entry.zoomInBtn.hidden = !isVector;
    entry.svgBtn.hidden = !isVector;
  }
  if (entry.codeEl) {
    entry.codeEl.textContent = source;
  }
  entry.renderedHash = hash;
  const payload = {
    type: "SG_DIAGRAM_RENDER",
    engine,
    source,
    theme: sgDiagramGetCurrentTheme()
  };
  entry.lastRenderPayload = payload;
  if (entry.ready) {
    sgDiagramPostToEntry(entry, payload);
  } else {
    entry.pendingRender = payload;
  }
}

function sgDiagramIsNearViewport(el) {
  if (!el || typeof el.getBoundingClientRect !== "function" || typeof window === "undefined") {
    return true;
  }
  const rect = el.getBoundingClientRect();
  if (!rect || (rect.top === 0 && rect.bottom === 0 && rect.height === 0 && rect.width === 0)) {
    return true;
  }
  const vh = window.innerHeight || 900;
  return rect.bottom >= -SG_DIAGRAM_LAZY_MARGIN_PX && rect.top <= vh + SG_DIAGRAM_LAZY_MARGIN_PX;
}

function sgDiagramEnsureIntersectionObserver() {
  if (_sgDiagramIntersectionObserver) return _sgDiagramIntersectionObserver;
  if (typeof IntersectionObserver !== "function") return null;
  _sgDiagramIntersectionObserver = new IntersectionObserver((entries) => {
    for (const io of entries) {
      if (io && io.isIntersecting && io.target) {
        sgDiagramActivateDeferredEntry(io.target);
      }
    }
  }, { rootMargin: `${SG_DIAGRAM_LAZY_MARGIN_PX}px 0px` });
  return _sgDiagramIntersectionObserver;
}

function sgDiagramMountLazyPlaceholder(codeBlock, engine, isNativeSvgBlock) {
  const placeholder = document.createElement("div");
  placeholder.className = "sg-diagram-lazy-placeholder";

  const meta = document.createElement("div");
  meta.className = "sg-diagram-lazy-meta";

  const badge = document.createElement("span");
  badge.className = "sg-diagram-badge";
  badge.textContent = SG_DIAGRAM_LABELS[engine] || engine;

  const note = document.createElement("span");
  note.textContent = "Diagram paused off-screen";

  meta.appendChild(badge);
  meta.appendChild(note);

  const renderBtn = document.createElement("button");
  renderBtn.type = "button";
  renderBtn.className = "sg-diagram-btn";
  renderBtn.textContent = "Render now";
  renderBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    sgDiagramActivateDeferredEntry(codeBlock);
  });

  placeholder.appendChild(meta);
  placeholder.appendChild(renderBtn);

  if (isNativeSvgBlock) {
    const svgPreview = codeBlock.querySelector(".svg-preview");
    if (svgPreview && svgPreview.parentNode) {
      svgPreview.parentNode.insertBefore(placeholder, svgPreview);
    } else {
      const innerWrap = codeBlock.querySelector(".svg-code-block") || codeBlock;
      innerWrap.appendChild(placeholder);
    }
  } else {
    const codeContainer = codeBlock.querySelector(".formatted-code-block-internal-container") || codeBlock.querySelector("pre");
    if (codeContainer && codeContainer.parentNode) {
      codeContainer.parentNode.insertBefore(placeholder, codeContainer);
    } else {
      codeBlock.appendChild(placeholder);
    }
  }
  return placeholder;
}

function sgDiagramActivateDeferredEntry(codeBlock) {
  const entry = _sgDiagramEntries.get(codeBlock);
  if (!entry || !entry.deferred || !entry.deferredData) return;
  if (_sgDiagramIntersectionObserver) {
    try { _sgDiagramIntersectionObserver.unobserve(codeBlock); } catch (_e) {}
  }
  if (entry.placeholderEl && entry.placeholderEl.parentNode) {
    entry.placeholderEl.remove();
  }
  entry.placeholderEl = null;
  const deferredData = entry.deferredData;
  entry.deferred = false;
  entry.deferredData = null;

  if (!isExtensionEnabled || !isDiagramRendererEnabled || !codeBlock || !codeBlock.isConnected) {
    sgDiagramRemoveEntry(codeBlock);
    return;
  }
  const activeEntry = sgMountDiagramHost(codeBlock, deferredData.engine, deferredData.isNativeSvgBlock);
  if (activeEntry.renderedHash === deferredData.hash && activeEntry.engine === deferredData.engine) {
    return;
  }
  sgDiagramDispatchRender(activeEntry, deferredData.engine, deferredData.source, deferredData.hash);
}

function sgDiagramFlushAllDeferred() {
  for (const [cb, entry] of Array.from(_sgDiagramEntries.entries())) {
    if (entry && entry.deferred) {
      sgDiagramActivateDeferredEntry(cb);
    }
  }
}

function sgDiagramScheduleBlockRender(codeBlock, engine, source, isNativeSvgBlock) {
  const nativeSvg = Boolean(isNativeSvgBlock);
  const hash = `${engine}:${sgDiagramHashText(source)}`;
  let entry = _sgDiagramEntries.get(codeBlock);

  if (entry && entry.renderedHash === hash && entry.engine === engine) {
    return;
  }
  if (entry && entry.deferred && entry.deferredData && entry.deferredData.hash === hash && entry.engine === engine) {
    return;
  }

  if (sgDiagramIsBlockStreaming(codeBlock)) {
    if (entry && entry.debounceTimer) {
      clearTimeout(entry.debounceTimer);
      entry.debounceTimer = null;
    }
    return;
  }

  if (!entry) {
    entry = {
      token: null,
      engine,
      isNativeSvgBlock: nativeSvg,
      codeBlock,
      pendingHash: null,
      renderedHash: null,
      debounceTimer: null,
      mounted: false,
      deferred: false,
      deferredData: null,
      placeholderEl: null
    };
    _sgDiagramEntries.set(codeBlock, entry);
  }

  if (entry.pendingHash === hash && entry.debounceTimer) {
    return;
  }

  if (entry.debounceTimer) {
    clearTimeout(entry.debounceTimer);
  }
  entry.pendingHash = hash;
  entry.debounceTimer = setTimeout(() => {
    entry.debounceTimer = null;
    if (!isExtensionEnabled || !isDiagramRendererEnabled) return;
    if (!codeBlock.isConnected) {
      sgDiagramRemoveEntry(codeBlock);
      return;
    }
    if (sgDiagramIsBlockStreaming(codeBlock)) return;
    const latestSource = sgDiagramGetTargetSource(codeBlock, nativeSvg) || source;
    const latestEngine = nativeSvg ? "svg" : sgDetectDiagramEngine(codeBlock, latestSource);
    if (!latestEngine || !latestSource.trim()) return;
    const latestHash = `${latestEngine}:${sgDiagramHashText(latestSource)}`;

    let activeEntry = _sgDiagramEntries.get(codeBlock);
    if ((!activeEntry || !activeEntry.token) && typeof IntersectionObserver === "function" && !sgDiagramIsNearViewport(codeBlock)) {
      if (!activeEntry) {
        activeEntry = {
          token: null,
          engine: latestEngine,
          isNativeSvgBlock: nativeSvg,
          codeBlock,
          pendingHash: null,
          renderedHash: null,
          debounceTimer: null,
          mounted: false,
          deferred: false,
          deferredData: null,
          placeholderEl: null
        };
        _sgDiagramEntries.set(codeBlock, activeEntry);
      }
      if (activeEntry.placeholderEl && activeEntry.engine !== latestEngine) {
        const badgeEl = activeEntry.placeholderEl.querySelector(".sg-diagram-badge");
        if (badgeEl) badgeEl.textContent = SG_DIAGRAM_LABELS[latestEngine] || latestEngine;
      }
      if (!activeEntry.placeholderEl || !activeEntry.placeholderEl.isConnected) {
        activeEntry.placeholderEl = sgDiagramMountLazyPlaceholder(codeBlock, latestEngine, nativeSvg);
      }
      activeEntry.engine = latestEngine;
      activeEntry.deferred = true;
      activeEntry.deferredData = {
        engine: latestEngine,
        source: latestSource,
        hash: latestHash,
        isNativeSvgBlock: nativeSvg
      };
      const io = sgDiagramEnsureIntersectionObserver();
      if (io) io.observe(codeBlock);
      return;
    }

    if (activeEntry && activeEntry.placeholderEl) {
      if (_sgDiagramIntersectionObserver) {
        try { _sgDiagramIntersectionObserver.unobserve(codeBlock); } catch (_e) {}
      }
      if (activeEntry.placeholderEl.parentNode) activeEntry.placeholderEl.remove();
      activeEntry.placeholderEl = null;
      activeEntry.deferred = false;
      activeEntry.deferredData = null;
    }

    if (!activeEntry || !activeEntry.token) {
      activeEntry = sgMountDiagramHost(codeBlock, latestEngine, nativeSvg);
    }
    if (activeEntry.renderedHash === latestHash && activeEntry.engine === latestEngine) {
      return;
    }
    sgDiagramDispatchRender(activeEntry, latestEngine, latestSource, latestHash);
  }, SG_DIAGRAM_DEBOUNCE_MS);
}

function sgDiagramRemoveEntry(codeBlock) {
  const entry = _sgDiagramEntries.get(codeBlock);
  if (!entry) return;
  if (_sgDiagramIntersectionObserver) {
    try { _sgDiagramIntersectionObserver.unobserve(codeBlock); } catch (_e) {}
  }
  if (entry.placeholderEl && entry.placeholderEl.parentNode) {
    entry.placeholderEl.remove();
  }
  if (entry.debounceTimer) {
    clearTimeout(entry.debounceTimer);
    entry.debounceTimer = null;
  }
  if (_sgDiagramFullscreenState && _sgDiagramFullscreenState.entry === entry) {
    sgCloseDiagramFullscreen(false);
  }
  if (entry.token) {
    _sgDiagramEntriesByToken.delete(entry.token);
  }
  if (entry.host && entry.host.parentNode) {
    entry.host.remove();
  }
  if (codeBlock && codeBlock.classList) {
    codeBlock.classList.remove("sg-diagram-preview-mode");
    codeBlock.classList.remove("sg-diagram-svg-managed");
  }
  _sgDiagramEntries.delete(codeBlock);
}

function sgDiagramPruneDisconnected() {
  for (const [cb] of _sgDiagramEntries.entries()) {
    if (!cb || !cb.isConnected) {
      sgDiagramRemoveEntry(cb);
    }
  }
}

function sgRefreshDiagramRenderer() {
  if (typeof document === "undefined" || !isExtensionEnabled || !isDiagramRendererEnabled) return;
  sgDiagramPruneDisconnected();
  const responses = document.querySelectorAll("model-response");
  const lastResponse = responses && responses.length > 0 ? responses[responses.length - 1] : null;

  const blocks = document.querySelectorAll("code-block");
  for (const cb of blocks) {
    if (typeof cb.closest === "function" && cb.closest('[id^="sg-"]')) continue;
    const mr = typeof cb.closest === "function" ? cb.closest("model-response") : null;
    const isSettledOlderTurn = Boolean(mr && lastResponse && mr !== lastResponse);
    if (isSettledOlderTurn) {
      if (_sgDiagramNonDiagramCache.has(cb)) continue;
      const existing = _sgDiagramEntries.get(cb);
      if (existing && (existing.renderedHash || existing.deferred)) continue;
    }
    const source = typeof sgGetCodeBlockSource === "function" ? sgGetCodeBlockSource(cb) : "";
    if (!source || !source.trim()) continue;
    const engine = sgDetectDiagramEngine(cb, source);
    if (!engine) {
      if (isSettledOlderTurn && !sgDiagramIsBlockStreaming(cb)) {
        _sgDiagramNonDiagramCache.add(cb);
      }
      continue;
    }
    sgDiagramScheduleBlockRender(cb, engine, source, false);
  }
  const svgBlocks = document.querySelectorAll("svg-code-block");
  for (const sb of svgBlocks) {
    if (typeof sb.closest === "function" && sb.closest('[id^="sg-"]')) continue;
    const mr = typeof sb.closest === "function" ? sb.closest("model-response") : null;
    const isSettledOlderTurn = Boolean(mr && lastResponse && mr !== lastResponse);
    if (isSettledOlderTurn) {
      const existing = _sgDiagramEntries.get(sb);
      if (existing && (existing.renderedHash || existing.deferred)) continue;
    }
    const source = sgDiagramGetSvgBlockSource(sb);
    if (!source || !source.trim()) continue;
    sgDiagramScheduleBlockRender(sb, "svg", source, true);
  }
}

function sgHandleDiagramSandboxMessage(event) {
  if (!event || !event.data || typeof event.data !== "object") return;
  const data = event.data;
  if (typeof data.token !== "string" || !data.token) return;

  const entry = _sgDiagramEntriesByToken.get(data.token);
  if (!entry || !entry.iframe || event.source !== entry.iframe.contentWindow) return;

  const extOrigin = sgDiagramGetExtOrigin();
  if (event.origin !== "null" && (!extOrigin || event.origin !== extOrigin)) return;

  switch (data.type) {
    case "SG_DIAGRAM_READY":
      entry.ready = true;
      if (entry.pendingRender) {
        const pending = entry.pendingRender;
        entry.pendingRender = null;
        sgDiagramPostToEntry(entry, pending);
      } else if (entry.lastRenderPayload) {
        sgDiagramPostToEntry(entry, Object.assign({}, entry.lastRenderPayload, {
          theme: sgDiagramGetCurrentTheme()
        }));
      }
      break;
    case "SG_DIAGRAM_RESIZE":
      if (!entry.isFullscreen && typeof data.height === "number" && Number.isFinite(data.height) && entry.iframe) {
        const clamped = Math.max(160, Math.min(720, Math.ceil(data.height)));
        entry.iframe.style.height = `${clamped}px`;
      }
      break;
    case "SG_DIAGRAM_RENDERED":
      sgDiagramSetError(entry, "");
      if (entry.svgBtn) entry.svgBtn.hidden = !data.canExportSvg;
      if (!entry.isFullscreen) {
        sgDiagramSetMode(entry, "preview");
      }
      break;
    case "SG_DIAGRAM_ERROR":
      sgDiagramSetError(entry, data.error || "Unable to render diagram");
      if (!entry.isFullscreen) {
        sgDiagramSetMode(entry, "code");
      }
      break;
    case "SG_DIAGRAM_EXPORT_RESULT": {
      const req = _sgDiagramPendingExports.get(data.requestId);
      if (!req || req.token !== entry.token) return;
      _sgDiagramPendingExports.delete(data.requestId);
      if (data.error) {
        if (typeof showToast === "function") {
          showToast(`Diagram export failed: ${data.error}`, "error");
        }
        return;
      }
      const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const ext = data.format === "svg" ? "svg" : "png";
      sgDiagramTriggerDownload(
        `gemini-${req.engine || "diagram"}-${stamp}.${ext}`,
        data.data,
        ext === "png"
      );
      break;
    }
  }
}

function sgSyncDiagramThemes() {
  const nextTheme = sgDiagramGetCurrentTheme();
  if (nextTheme === _sgDiagramLastTheme) return;
  _sgDiagramLastTheme = nextTheme;
  for (const entry of _sgDiagramEntriesByToken.values()) {
    if (entry && entry.ready) {
      sgDiagramPostToEntry(entry, { type: "SG_DIAGRAM_THEME", theme: nextTheme });
    }
  }
}

function sgBindDiagramListeners() {
  if (!_sgDiagramMessageBound && typeof window !== "undefined") {
    _sgDiagramMessageBound = true;
    window.addEventListener("message", sgHandleDiagramSandboxMessage);
  }
  if (!_sgSvgSourceListenerBound && typeof window !== "undefined") {
    _sgSvgSourceListenerBound = true;
    window.addEventListener("sg-svg-block-source", sgHandleCapturedSvgBlockSource);
    try {
      if (typeof CustomEvent === "function") {
        window.dispatchEvent(new CustomEvent("sg-svg-block-source-request", {
          detail: { id: "*" }
        }));
      }
    } catch (_e) {}
  }
  _sgDiagramLastTheme = sgDiagramGetCurrentTheme();
  if (!_sgDiagramThemeObserver && typeof MutationObserver !== "undefined" && typeof document !== "undefined" && document.body) {
    _sgDiagramThemeObserver = new MutationObserver(() => {
      sgSyncDiagramThemes();
    });
    _sgDiagramThemeObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ["class"]
    });
  }
}

function sgTeardownDiagramRenderer() {
  sgCloseDiagramFullscreen(false);
  for (const cb of Array.from(_sgDiagramEntries.keys())) {
    sgDiagramRemoveEntry(cb);
  }
  _sgDiagramEntries.clear();
  _sgDiagramEntriesByToken.clear();
  _sgDiagramPendingExports.clear();

  if (_sgDiagramMessageBound && typeof window !== "undefined") {
    _sgDiagramMessageBound = false;
    window.removeEventListener("message", sgHandleDiagramSandboxMessage);
  }
  if (_sgSvgSourceListenerBound && typeof window !== "undefined") {
    _sgSvgSourceListenerBound = false;
    window.removeEventListener("sg-svg-block-source", sgHandleCapturedSvgBlockSource);
  }
  if (_sgDiagramThemeObserver) {
    _sgDiagramThemeObserver.disconnect();
    _sgDiagramThemeObserver = null;
  }
  if (_sgDiagramIntersectionObserver) {
    _sgDiagramIntersectionObserver.disconnect();
    _sgDiagramIntersectionObserver = null;
  }
  _sgDiagramNonDiagramCache = new WeakSet();
  if (typeof sgObserverRegistry !== "undefined" && sgObserverRegistry.unregisterUIRefresh) {
    sgObserverRegistry.unregisterUIRefresh("diagramRenderer");
  }
}

function sgSetDiagramRendererEnabled(enabled) {
  isDiagramRendererEnabled = enabled !== false && isExtensionEnabled;
  if (!isDiagramRendererEnabled) {
    sgTeardownDiagramRenderer();
    return;
  }
  sgBindDiagramListeners();
  if (typeof sgObserverRegistry !== "undefined" && sgObserverRegistry.registerUIRefresh) {
    sgObserverRegistry.registerUIRefresh("diagramRenderer", sgRefreshDiagramRenderer);
  }
  sgRefreshDiagramRenderer();
}

function initDiagramRendererSystem() {
  if (("undefined" != typeof SG_IS_SILENT_BG_WORKER_TAB && SG_IS_SILENT_BG_WORKER_TAB) || _sgDiagramInitialized) return;
  _sgDiagramInitialized = true;

  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync) {
    const reader = typeof sgSyncGetCached === "function"
      ? sgSyncGetCached
      : chrome.storage.sync.get.bind(chrome.storage.sync);
    reader(["extensionEnabled", "diagramRendererEnabled"], (res) => {
      const safe = res || {};
      if (safe.extensionEnabled === false) {
        isExtensionEnabled = false;
        sgSetDiagramRendererEnabled(false);
        return;
      }
      sgSetDiagramRendererEnabled(safe.diagramRendererEnabled !== false);
    });

    const _sgDiagramStorageHandler = (changes, areaName) => {
      if (areaName !== "sync" || !changes) return;
      if (changes.extensionEnabled) {
        isExtensionEnabled = changes.extensionEnabled.newValue !== false;
      }
      if (changes.extensionEnabled || changes.diagramRendererEnabled) {
        const nextVal = changes.diagramRendererEnabled
          ? changes.diagramRendererEnabled.newValue !== false
          : isDiagramRendererEnabled;
        sgSetDiagramRendererEnabled(isExtensionEnabled && nextVal);
      }
    };
    if (typeof SG !== "undefined" && SG && SG.storage) {
      SG.storage.onChanged("diagram-renderer:sync", _sgDiagramStorageHandler, { area: "sync" });
    } else if (chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener(_sgDiagramStorageHandler);
    }
  }
}

if (!("undefined" != typeof SG_IS_SILENT_BG_WORKER_TAB && SG_IS_SILENT_BG_WORKER_TAB) && typeof document !== "undefined" && typeof chrome !== "undefined" && chrome.storage) {
  initDiagramRendererSystem();
}
