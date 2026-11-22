// ============================================================================
// CONVERSATION OUTLINE & FORK / HAND-OFF SUMMARY (Phase 0 - Phase 3)
// ============================================================================

const SG_OUTLINE_UI_STATE_KEY = "sgOutlineUiState";
const SG_FORK_PENDING_KEY = "sgPendingForkHandoff";
const SG_FORK_PENDING_TTL_MS = 120 * 1000;
const SG_HANDOFF_OPEN_TAG = "[SG_HANDOFF_CONTEXT]";
const SG_HANDOFF_CLOSE_TAG = "[/SG_HANDOFF_CONTEXT]";

let isConversationOutlineEnabled = true;
let isForkHandoffEnabled = true;
let _sgOutlineUiState = {
  expanded: false,
  showHeadings: true,
  showAssets: true,
  bookmarkedOnly: false,
  filterText: ""
};
const _sgTurnIndexCache = new Map();
let _sgOutlineRoot = null;
let _sgOutlineListEl = null;
let _sgOutlineCountBadge = null;
let _sgOutlineSearchInput = null;
let _sgOutlineHeadingsBtn = null;
let _sgOutlineAssetsBtn = null;
let _sgOutlineBmFilterBtn = null;
let _sgOutlineSignature = "";
let _sgOutlineTurnsSnapshot = [];
let _sgOutlineScanTimer = null;
let _sgOutlineScrollRaf = null;
let _sgOutlineActiveKey = "";
let _sgOutlineLastChatId = "";
let _sgOutlineScrollTarget = null;
let _sgOutlineResizeTimer = null;
let _sgOutlineFlashTimer = null;
let _sgOutlineMutationObserver = null;
let _sgOutlineObservedChatEl = null;
let _sgForkModalOverlay = null;
let _sgSelectiveExportOverlay = null;
let _sgForkCheckedPath = "";
let _sgForkConsumeInFlight = false;

const SG_OUTLINE_SVG_PATHS = [
  "M8 6h13", "M8 12h13", "M8 18h13", "M3 6h.01", "M3 12h.01", "M3 18h.01"
];
const SG_FORK_SVG_PATHS = [
  "M6 3v12", "M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z", "M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  "M18 9a9 9 0 0 1-9 9"
];
const SG_CLOSE_SVG_PATHS = ["M18 6L6 18", "M6 6l12 12"];
const SG_HEADING_SVG_PATHS = ["M4 6h8", "M4 12h12", "M4 18h6", "M16 14l4 4", "M20 14l-4 4"];
const SG_BOOKMARK_SVG_PATHS = ["M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"];
const SG_ASSET_SVG_PATHS = ["M12 2L2 7l10 5 10-5-10-5z", "M2 17l10 5 10-5", "M2 12l10 5 10-5"];
const SG_EXPORT_SVG_PATHS = ["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", "M7 10l5 5 5-5", "M12 15V3"];

function sgCreateSvgIcon(paths, size = 15) {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  for (const d of paths) {
    const p = document.createElementNS(ns, "path");
    p.setAttribute("d", d);
    svg.appendChild(p);
  }
  return svg;
}

function sgPersistOutlineUiState() {
  try {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({
        [SG_OUTLINE_UI_STATE_KEY]: {
          expanded: Boolean(_sgOutlineUiState.expanded),
          showHeadings: _sgOutlineUiState.showHeadings !== false,
          showAssets: _sgOutlineUiState.showAssets !== false,
          bookmarkedOnly: Boolean(_sgOutlineUiState.bookmarkedOnly)
        }
      });
    }
  } catch (err) {}
}

function sgShouldSuppressOutlineSurface() {
  if (!isExtensionEnabled) return true;
  if (typeof isOnNewChatLanding === "function" && isOnNewChatLanding()) return true;
  if (typeof isOnSavedInfoPage === "function" && isOnSavedInfoPage()) return true;
  if (typeof window !== "undefined" && window.location && window.location.pathname.includes("/gems/")) return true;
  return false;
}

function sgReadCleanTurnText(rootEl) {
  if (!rootEl) return "";
  const skipSel = 'button, message-actions, .sg-message-timestamp, [id^="sg-"], mat-icon, svg, script, style, .cdk-visually-hidden, .sr-only, .visually-hidden';
  const parts = [];
  const walk = node => {
    if (!node) return;
    if (node.nodeType === 3) {
      parts.push(node.nodeValue || "");
      return;
    }
    if (node.nodeType !== 1) return;
    if (typeof node.matches === "function" && node.matches(skipSel)) return;
    for (const child of node.childNodes || []) {
      walk(child);
    }
  };
  walk(rootEl);
  return sgNormalizeInstructionText(parts.join(" "));
}

const SG_USER_AUTHOR_PREFIX_RE = /^(?:b\u1ea1n \u0111\u00e3 n\u00f3i|you said)\s*:?$/i;

function sgReadCleanUserQueryText(userEl) {
  if (!userEl) return "";
  const queryTextEl = typeof userEl.querySelector === "function" ? userEl.querySelector(".query-text") : null;
  const targetEl = queryTextEl || userEl;
  const skipSel = 'button, message-actions, .sg-message-timestamp, [id^="sg-"], mat-icon, svg, script, style, .cdk-visually-hidden, .sr-only, .visually-hidden';
  const parts = [];
  const walk = node => {
    if (!node) return;
    if (node.nodeType === 3) {
      const val = node.nodeValue || "";
      if (parts.length === 0 && SG_USER_AUTHOR_PREFIX_RE.test(val.trim())) return;
      parts.push(val);
      return;
    }
    if (node.nodeType !== 1) return;
    if (typeof node.matches === "function" && node.matches(skipSel)) return;
    if (node !== targetEl && parts.length === 0 && SG_USER_AUTHOR_PREFIX_RE.test((node.textContent || "").trim())) return;
    for (const child of node.childNodes || []) {
      walk(child);
    }
  };
  walk(targetEl);
  const cleaned = sgNormalizeInstructionText(parts.join(" "));
  if (cleaned) return cleaned;
  if (queryTextEl && targetEl === queryTextEl) {
    return sgReadCleanTurnText(userEl);
  }
  return sgReadCleanTurnText(targetEl);
}

function sgExtractHeadingItems(modelEl) {
  if (!modelEl || typeof modelEl.querySelectorAll !== "function") return [];
  const root = (typeof modelEl.querySelector === "function" && modelEl.querySelector("message-content, .markdown-main-panel, .markdown"))
    || modelEl;
  const out = [];
  let ordinal = 0;
  for (const h of root.querySelectorAll("h1, h2, h3")) {
    if (typeof h.closest === "function" && h.closest('pre, code, code-block, [id^="sg-"]')) continue;
    const text = sgReadCleanTurnText(h);
    if (!text) continue;
    const lvl = Number(String(h.tagName || "H2").slice(1));
    out.push({
      level: lvl >= 1 && lvl <= 3 ? lvl : 2,
      ordinal: ordinal++,
      text,
      el: h
    });
  }
  return out;
}

function sgSummarizeDiagramAssetLabel(engine, sourceText) {
  const src = String(sourceText || "").trim();
  if (engine === "mermaid") {
    const titleMatch = src.match(/^\s*title\s*:?\s*(.+)$/im);
    if (titleMatch && titleMatch[1].trim()) return titleMatch[1].trim().slice(0, 42);
    const lines = src.split(/\r?\n/);
    for (const raw of lines) {
      const line = raw.trim();
      if (!line || line.startsWith("%%") || line === "---") continue;
      return line.slice(0, 36);
    }
    return "Diagram";
  }
  if (engine === "chart") {
    try {
      const cfg = JSON.parse(src);
      const t = cfg && cfg.options && cfg.options.plugins && cfg.options.plugins.title && cfg.options.plugins.title.text;
      if (typeof t === "string" && t.trim()) return t.trim().slice(0, 42);
      if (cfg && typeof cfg.type === "string") {
        const cap = cfg.type.charAt(0).toUpperCase() + cfg.type.slice(1);
        return `${cap} chart`;
      }
    } catch (_e) {}
    return "Chart";
  }
  if (engine === "wavedrom") {
    try {
      const cfg = JSON.parse(src);
      if (cfg && cfg.head && typeof cfg.head.text === "string" && cfg.head.text.trim()) {
        return cfg.head.text.trim().slice(0, 42);
      }
      if (cfg && Array.isArray(cfg.assign)) return `Logic Circuit (${cfg.assign.length})`;
      if (cfg && Array.isArray(cfg.reg)) return `Bitfield (${cfg.reg.length})`;
      if (cfg && Array.isArray(cfg.signal)) return `Waveform (${cfg.signal.length})`;
    } catch (_e) {}
    return "Waveform";
  }
  if (engine === "netlist") {
    try {
      const cfg = JSON.parse(src);
      if (cfg && cfg.modules && typeof cfg.modules === "object" && !Array.isArray(cfg.modules)) {
        const modKeys = Object.keys(cfg.modules);
        if (modKeys.length > 0 && modKeys[0].trim()) {
          return `Circuit: ${modKeys[0].trim().slice(0, 32)}`;
        }
      }
      if (cfg && typeof cfg.name === "string" && cfg.name.trim()) {
        return `Circuit: ${cfg.name.trim().slice(0, 32)}`;
      }
      if (cfg && cfg.cells && typeof cfg.cells === "object" && !Array.isArray(cfg.cells)) {
        return `Circuit (${Object.keys(cfg.cells).length} cells)`;
      }
    } catch (_e) {}
    return "Circuit Schematic";
  }
  if (engine === "dot") {
    const m = src.match(/^(?:strict\s+)?(?:di)?graph\s+(?:"([^"]+)"|([A-Za-z_][\w]*))/i);
    if (m && (m[1] || m[2])) return `Graph ${(m[1] || m[2]).slice(0, 32)}`;
    return "Graphviz DOT";
  }
  if (engine === "svg") {
    const titleMatch = src.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch && titleMatch[1].trim()) return titleMatch[1].trim().slice(0, 42);
    return "Vector Graphic";
  }
  return "Diagram";
}

function sgExtractTurnAssets(userEl, modelEl) {
  const out = [];
  const seenEls = new Set();
  let ordinal = 0;

  if (modelEl && typeof modelEl.querySelectorAll === "function") {
    const blockNodes = modelEl.querySelectorAll("code-block, svg-code-block");
    for (const node of blockNodes) {
      if (!node || seenEls.has(node)) continue;
      if (typeof node.closest === "function" && node.closest('[id^="sg-"]')) continue;
      seenEls.add(node);
      const tag = String(node.tagName || "").toUpperCase();

      if (tag === "SVG-CODE-BLOCK") {
        const svgSrc = typeof sgDiagramGetSvgBlockSource === "function" ? sgDiagramGetSvgBlockSource(node) : "";
        const targetEl = (typeof node.querySelector === "function" && node.querySelector(".sg-diagram-host")) || node;
        out.push({
          ordinal: ordinal++,
          kind: "diagram",
          engine: "svg",
          badge: "SVG",
          label: sgSummarizeDiagramAssetLabel("svg", svgSrc),
          el: targetEl
        });
        continue;
      }

      const source = typeof sgGetCodeBlockSource === "function"
        ? sgGetCodeBlockSource(node)
        : String((node.querySelector && (node.querySelector("code") || node.querySelector("pre")) || node).textContent || "");
      const engine = typeof sgDetectDiagramEngine === "function" && source.trim()
        ? sgDetectDiagramEngine(node, source)
        : null;

      if (engine) {
        const badge = (typeof SG_DIAGRAM_LABELS !== "undefined" && SG_DIAGRAM_LABELS[engine]) || engine.toUpperCase();
        const targetEl = (typeof node.querySelector === "function" && node.querySelector(".sg-diagram-host")) || node;
        out.push({
          ordinal: ordinal++,
          kind: "diagram",
          engine,
          badge,
          label: sgSummarizeDiagramAssetLabel(engine, source),
          el: targetEl
        });
      } else if (source.trim()) {
        const lang = (typeof sgDetectCodeBlockLanguage === "function" ? sgDetectCodeBlockLanguage(node) : "")
          || sgExtractCodeBlockLang(node)
          || "";
        const filename = typeof sgExtractCommentFilename === "function" ? sgExtractCommentFilename(source) : "";
        const lineCount = source.split(/\r?\n/).length;
        const badge = (lang || "CODE").toUpperCase().slice(0, 10);
        const label = filename
          ? filename
          : (lang ? `${lang} · ${lineCount}L` : `Code · ${lineCount}L`);
        out.push({
          ordinal: ordinal++,
          kind: "code",
          engine: null,
          badge,
          label,
          el: node
        });
      }
    }
  }

  const fileRoots = [userEl, modelEl].filter(r => r && typeof r.querySelectorAll === "function");
  const fileSel = '[data-test-id="file-preview"], file-preview-chip, .file-preview-chip, [data-test-id="uploaded-file"], .uploaded-file-chip, response-file-preview, [data-filename]';
  for (const root of fileRoots) {
    for (const fNode of root.querySelectorAll(fileSel)) {
      if (!fNode || seenEls.has(fNode)) continue;
      if (typeof fNode.closest === "function" && fNode.closest('[id^="sg-"], code-block, svg-code-block')) continue;
      seenEls.add(fNode);
      const rawName = (fNode.getAttribute && (fNode.getAttribute("data-filename") || fNode.getAttribute("title") || fNode.getAttribute("aria-label")))
        || sgReadCleanTurnText(fNode);
      const cleanName = String(rawName || "").replace(/\s+/g, " ").trim().slice(0, 48);
      if (!cleanName) continue;
      out.push({
        ordinal: ordinal++,
        kind: "file",
        engine: null,
        badge: "FILE",
        label: cleanName,
        el: fNode
      });
    }
  }

  return out;
}

function sgExtractCodeBlockLang(preOrBlockEl) {
  if (!preOrBlockEl || typeof preOrBlockEl.querySelector !== "function") return "";
  const langNode = preOrBlockEl.querySelector('[class*="language-"]');
  if (langNode && typeof langNode.className === "string") {
    const m = langNode.className.match(/language-([a-z0-9_+#.-]+)/i);
    if (m) return m[1].toLowerCase();
  }
  const labelNode = preOrBlockEl.querySelector('.code-block-decoration span, .header span');
  if (labelNode) {
    const raw = sgNormalizeInstructionText(labelNode.textContent || "");
    if (raw && raw.length <= 24 && !/\s/.test(raw)) return raw.toLowerCase();
  }
  return "";
}

function sgExtractNodeMarkdownLite(rootEl) {
  if (!rootEl) return "";
  const skipSel = 'button, message-actions, .sg-message-timestamp, [id^="sg-"], mat-icon, svg, script, style, copy-button, share-button, thumbs-feedback, .cdk-visually-hidden, .sr-only, .visually-hidden';

  const walk = (node, listDepth = 0) => {
    if (!node) return "";
    if (node.nodeType === 3) {
      return node.nodeValue || "";
    }
    if (node.nodeType !== 1) return "";
    if (typeof node.matches === "function" && node.matches(skipSel)) return "";

    const tag = String(node.tagName || "").toUpperCase();
    if (tag === "BR") return "\n";

    if (tag === "CODE-BLOCK" || tag === "PRE") {
      const codeEl = typeof node.querySelector === "function" ? (node.querySelector("pre code") || node.querySelector("code") || node.querySelector("pre")) : null;
      const rawCode = String((codeEl || node).textContent || "").replace(/\r\n/g, "\n").trimEnd();
      if (!rawCode.trim()) return "";
      const lang = sgExtractCodeBlockLang(node);
      return `\n\`\`\`${lang}\n${rawCode}\n\`\`\`\n\n`;
    }

    if (tag === "CODE") {
      const inner = String(node.textContent || "").trim();
      return inner ? `\`${inner}\`` : "";
    }

    let inner = "";
    for (const child of node.childNodes || []) {
      inner += walk(child, tag === "UL" || tag === "OL" ? listDepth + 1 : listDepth);
    }

    if (/^H[1-6]$/.test(tag)) {
      const lvl = Number(tag.slice(1));
      const clean = inner.trim();
      return clean ? `\n${"#".repeat(lvl)} ${clean}\n\n` : "";
    }
    if (tag === "STRONG" || tag === "B") {
      const clean = inner.trim();
      return clean ? `**${clean}**` : "";
    }
    if (tag === "EM" || tag === "I") {
      const clean = inner.trim();
      return clean ? `*${clean}*` : "";
    }
    if (tag === "LI") {
      const clean = inner.trim();
      const parentTag = node.parentElement ? String(node.parentElement.tagName || "").toUpperCase() : "UL";
      let prefix = "- ";
      if (parentTag === "OL" && node.parentElement) {
        const siblings = Array.from(node.parentElement.childNodes || []).filter(c => c.nodeType === 1 && String(c.tagName || "").toUpperCase() === "LI");
        const idx = siblings.indexOf(node);
        prefix = `${idx >= 0 ? idx + 1 : 1}. `;
      }
      return clean ? `${"  ".repeat(Math.max(0, listDepth - 1))}${prefix}${clean}\n` : "";
    }
    if (tag === "BLOCKQUOTE") {
      const lines = inner.trim().split("\n").map(l => `> ${l}`).join("\n");
      return lines ? `\n${lines}\n\n` : "";
    }
    if (tag === "UL" || tag === "OL") {
      return inner.trim() ? `\n${inner.trim()}\n\n` : "";
    }
    if (tag === "P" || tag === "DIV" || tag === "TR") {
      const hasBlockSpacing = tag === "P" || (typeof node.className === "string" && node.className.includes("paragraph"));
      if (hasBlockSpacing) {
        return inner.trim() ? `${inner.trim()}\n\n` : "";
      }
      if (tag === "TR") {
        const cells = Array.from(node.childNodes || [])
          .filter(c => c.nodeType === 1 && (c.tagName === "TH" || c.tagName === "TD"))
          .map(c => sgReadCleanTurnText(c));
        return cells.length ? `| ${cells.join(" | ")} |\n` : inner;
      }
    }
    return inner;
  };

  return walk(rootEl, 0)
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function sgTrimTurnCacheIfNeeded() {
  while (_sgTurnIndexCache.size > 6) {
    const oldestKey = _sgTurnIndexCache.keys().next().value;
    if (oldestKey === undefined) break;
    _sgTurnIndexCache.delete(oldestKey);
  }
}

function sgScanConversationTurns() {
  if (sgShouldSuppressOutlineSurface()) return [];

  const chatHistoryEl = (typeof domQuery === "function" && domQuery("chatHistory")) || document;
  if (!chatHistoryEl || typeof chatHistoryEl.querySelectorAll !== "function") return [];

  const chatKey = (typeof getCurrentChatId === "function" && getCurrentChatId()) || "__active_chat__";
  if (_sgOutlineLastChatId && _sgOutlineLastChatId !== chatKey) {
    _sgOutlineActiveKey = "";
  }
  _sgOutlineLastChatId = chatKey;

  let chatCache = _sgTurnIndexCache.get(chatKey);
  if (!chatCache) {
    chatCache = new Map();
    _sgTurnIndexCache.set(chatKey, chatCache);
    sgTrimTurnCacheIfNeeded();
  }

  let containers = Array.from(chatHistoryEl.querySelectorAll(".conversation-container"));
  const domTurns = [];

  if (containers.length > 0) {
    containers = containers.filter((el, idx, arr) => !arr.some((other, j) => idx !== j && other.contains(el)));
    containers.forEach((container, idx) => {
      const userEl = container.querySelector('user-query, .user-message, [data-message-author="user"], .query-content');
      const modelEl = container.querySelector('model-response, .model-response, [data-message-author="model"]');
      const responseId = (container.id && container.id.trim()) || (modelEl && typeof sgGetTurnId === "function" ? sgGetTurnId(modelEl) : null) || null;
      const userText = userEl ? sgReadCleanUserQueryText(userEl) : "";
      const headings = modelEl ? sgExtractHeadingItems(modelEl) : [];
      const assets = sgExtractTurnAssets(userEl, modelEl);
      domTurns.push({
        key: responseId || `dom-idx-${idx}`,
        responseId,
        containerEl: container,
        userEl,
        modelEl,
        userText,
        headings,
        assets,
        inDom: true
      });
    });
  } else {
    const allNodes = Array.from(chatHistoryEl.querySelectorAll('user-query, model-response, [data-message-author="user"], [data-message-author="model"]'))
      .filter((el, idx, arr) => !arr.some((other, j) => idx !== j && other.contains(el)));
    let current = null;
    for (let i = 0; i < allNodes.length; i++) {
      const node = allNodes[i];
      const isUser = (typeof node.matches === "function" && node.matches('user-query, [data-message-author="user"]'));
      if (isUser) {
        if (current) domTurns.push(current);
        const rid = typeof sgGetTurnId === "function" ? sgGetTurnId(node) : null;
        current = {
          key: rid || `pair-${domTurns.length}`,
          responseId: rid,
          containerEl: (typeof node.closest === "function" && node.closest(".conversation-container")) || node,
          userEl: node,
          modelEl: null,
          userText: sgReadCleanUserQueryText(node),
          headings: [],
          assets: sgExtractTurnAssets(node, null),
          inDom: true
        };
      } else {
        const rid = (typeof sgGetTurnId === "function" ? sgGetTurnId(node) : null) || (node.id || null);
        if (!current) {
          current = {
            key: rid || `pair-${domTurns.length}`,
            responseId: rid,
            containerEl: (typeof node.closest === "function" && node.closest(".conversation-container")) || node,
            userEl: null,
            modelEl: node,
            userText: "",
            headings: sgExtractHeadingItems(node),
            assets: sgExtractTurnAssets(null, node),
            inDom: true
          };
        } else {
          if (rid && !current.responseId) {
            current.responseId = rid;
            current.key = rid;
          }
          current.modelEl = node;
          current.headings = sgExtractHeadingItems(node);
          current.assets = sgExtractTurnAssets(current.userEl, node);
        }
        domTurns.push(current);
        current = null;
      }
    }
    if (current) domTurns.push(current);
  }

  const seenKeys = new Set();
  for (const dt of domTurns) {
    if (!dt.userText && dt.headings.length === 0 && (!dt.assets || dt.assets.length === 0) && !dt.responseId) continue;
    seenKeys.add(dt.key);
    const prev = chatCache.get(dt.key);
    const mergedUserText = dt.userText || (prev ? prev.userText : "");
    const mergedHeadings = dt.headings.length > 0
      ? dt.headings
      : (prev && Array.isArray(prev.headings) ? prev.headings : []);
    const mergedAssets = dt.assets && dt.assets.length > 0
      ? dt.assets
      : (prev && Array.isArray(prev.assets) ? prev.assets : []);
    const resolvedId = dt.responseId || (prev ? prev.responseId : null);
    const isBookmarked = Boolean(resolvedId && typeof sgIsBookmarked === "function" && sgIsBookmarked(resolvedId));

    chatCache.set(dt.key, {
      key: dt.key,
      responseId: resolvedId,
      containerEl: dt.containerEl,
      userEl: dt.userEl,
      modelEl: dt.modelEl,
      userText: mergedUserText,
      userPreview: mergedUserText
        ? (mergedUserText.length > 88 ? mergedUserText.slice(0, 85).trimEnd() + "..." : mergedUserText)
        : (prev && prev.userPreview ? prev.userPreview : "(Prompt)"),
      headings: mergedHeadings,
      assets: mergedAssets,
      isBookmarked,
      inDom: true
    });
  }

  for (const [k, prev] of chatCache.entries()) {
    if (!seenKeys.has(k)) {
      chatCache.set(k, {
        ...prev,
        inDom: false,
        containerEl: null,
        userEl: null,
        modelEl: null,
        headings: (prev.headings || []).map(h => ({ ...h, el: null })),
        assets: (prev.assets || []).map(a => ({ ...a, el: null }))
      });
    }
  }

  const ordered = [];
  let turnNumber = 1;
  for (const item of chatCache.values()) {
    const bookmarkState = item.responseId
      ? Boolean(typeof sgIsBookmarked === "function" && sgIsBookmarked(item.responseId))
      : Boolean(item.isBookmarked);
    ordered.push({
      ...item,
      isBookmarked: bookmarkState,
      turnNumber: turnNumber++
    });
  }
  return ordered;
}

function sgComputeOutlineSignature(turns) {
  const parts = [
    _sgOutlineLastChatId,
    _sgOutlineUiState.expanded ? "1" : "0",
    _sgOutlineUiState.showHeadings ? "1" : "0",
    _sgOutlineUiState.showAssets ? "1" : "0",
    _sgOutlineUiState.bookmarkedOnly ? "1" : "0",
    _sgOutlineUiState.filterText || "",
    String(turns.length)
  ];
  for (const t of turns) {
    const lastHeading = t.headings.length ? t.headings[t.headings.length - 1].text.slice(0, 24) : "";
    const assetsList = Array.isArray(t.assets) ? t.assets : [];
    const lastAsset = assetsList.length
      ? `${assetsList[assetsList.length - 1].badge}:${assetsList[assetsList.length - 1].label.slice(0, 20)}`
      : "";
    parts.push(`${t.key}:${t.headings.length}:${assetsList.length}:${t.isBookmarked ? 1 : 0}:${t.userPreview.slice(0, 24)}:${lastHeading}:${lastAsset}`);
  }
  return parts.join("|");
}

function sgFlashOutlineTarget(targetEl) {
  if (!targetEl || !targetEl.classList) return;
  if (_sgOutlineFlashTimer) {
    clearTimeout(_sgOutlineFlashTimer);
    _sgOutlineFlashTimer = null;
  }
  targetEl.classList.remove("sg-outline-flash");
  void targetEl.offsetWidth;
  targetEl.classList.add("sg-outline-flash");
  _sgOutlineFlashTimer = setTimeout(() => {
    targetEl.classList.remove("sg-outline-flash");
  }, 1250);
}

async function sgNavigateOutlineTarget(turn, headingOrdinal = null, assetOrdinal = null) {
  if (!turn) return;
  const chatHistory = (typeof domQuery === "function" && domQuery("chatHistory"))
    || document.scrollingElement
    || document.documentElement;
  if (!chatHistory) return;

  const resolveInDom = () => {
    let container = turn.containerEl && turn.containerEl.isConnected ? turn.containerEl : null;
    if (!container && turn.responseId) {
      container = document.getElementById(turn.responseId);
    }
    if (assetOrdinal !== null) {
      const aObj = Array.isArray(turn.assets) ? turn.assets[assetOrdinal] : null;
      if (aObj && aObj.el && aObj.el.isConnected) return aObj.el;
      if (container) {
        const userEl = container.querySelector('user-query, .user-message, [data-message-author="user"], .query-content');
        const modelEl = container.querySelector('model-response, .model-response, [data-message-author="model"]') || container;
        const freshAssets = sgExtractTurnAssets(userEl, modelEl);
        if (freshAssets[assetOrdinal] && freshAssets[assetOrdinal].el) {
          return freshAssets[assetOrdinal].el;
        }
      }
    }
    if (headingOrdinal !== null) {
      const hObj = turn.headings[headingOrdinal];
      if (hObj && hObj.el && hObj.el.isConnected) return hObj.el;
      if (container) {
        const modelEl = container.querySelector('model-response, .model-response, [data-message-author="model"]') || container;
        const freshHeadings = sgExtractHeadingItems(modelEl);
        if (freshHeadings[headingOrdinal] && freshHeadings[headingOrdinal].el) {
          return freshHeadings[headingOrdinal].el;
        }
      }
    }
    if (turn.userEl && turn.userEl.isConnected) return turn.userEl;
    if (container) {
      return container.querySelector('user-query, .user-message, .query-content') || container;
    }
    return null;
  };

  let targetEl = resolveInDom();
  if (!targetEl && turn.responseId && typeof sgScrollToBookmark === "function") {
    await sgScrollToBookmark(turn.responseId);
    targetEl = resolveInDom();
  }

  if (targetEl) {
    if (typeof sgRevealTurn === "function") {
      sgRevealTurn(chatHistory, targetEl);
    } else if (typeof targetEl.scrollIntoView === "function") {
      targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    sgFlashOutlineTarget(targetEl);
    const activeKey = assetOrdinal !== null
      ? `${turn.key}::a${assetOrdinal}`
      : (headingOrdinal !== null ? `${turn.key}::h${headingOrdinal}` : turn.key);
    sgSetOutlineActiveKey(activeKey);
  }
}

function sgSetOutlineActiveKey(key) {
  _sgOutlineActiveKey = key || "";
  if (!_sgOutlineListEl) return;
  const rows = _sgOutlineListEl.querySelectorAll(".sg-outline-item");
  let activeNode = null;
  rows.forEach(btn => {
    const match = btn.dataset.outlineKey === _sgOutlineActiveKey;
    btn.classList.toggle("active", match);
    if (match) activeNode = btn;
  });
  if (activeNode && typeof activeNode.scrollIntoView === "function") {
    activeNode.scrollIntoView({ block: "nearest" });
  }
}

function sgUpdateOutlineScrollSpy() {
  _sgOutlineScrollRaf = null;
  if (!_sgOutlineUiState.expanded || !_sgOutlineListEl || _sgOutlineTurnsSnapshot.length === 0) return;
  const ch = (typeof domQuery === "function" && domQuery("chatHistory")) || null;
  const topAnchor = (ch ? ch.getBoundingClientRect().top : 64) + 96;

  let bestKey = "";
  let bestDelta = Infinity;

  for (const turn of _sgOutlineTurnsSnapshot) {
    const turnAnchorEl = (turn.userEl && turn.userEl.isConnected ? turn.userEl : null)
      || (turn.containerEl && turn.containerEl.isConnected ? turn.containerEl : null);
    if (turnAnchorEl) {
      const rect = turnAnchorEl.getBoundingClientRect();
      if (rect.height > 0) {
        const delta = topAnchor - rect.top;
        if (delta >= 0 && delta < bestDelta) {
          bestDelta = delta;
          bestKey = turn.key;
        }
      }
    }
    if (_sgOutlineUiState.showHeadings && turn.headings) {
      for (const h of turn.headings) {
        if (!h.el || !h.el.isConnected) continue;
        const rect = h.el.getBoundingClientRect();
        if (rect.height > 0) {
          const delta = topAnchor - rect.top;
          if (delta >= 0 && delta < bestDelta) {
            bestDelta = delta;
            bestKey = `${turn.key}::h${h.ordinal}`;
          }
        }
      }
    }
  }

  if (!bestKey && _sgOutlineTurnsSnapshot.length > 0) {
    bestKey = _sgOutlineTurnsSnapshot[0].key;
  }
  if (bestKey && bestKey !== _sgOutlineActiveKey) {
    sgSetOutlineActiveKey(bestKey);
  }
}

function sgAttachOutlineScrollSpy() {
  const ch = (typeof domQuery === "function" && domQuery("chatHistory")) || null;
  if (ch === _sgOutlineScrollTarget) return;
  if (_sgOutlineScrollTarget && typeof _sgOutlineScrollTarget._sgOutlineScrollHandler === "function") {
    _sgOutlineScrollTarget.removeEventListener("scroll", _sgOutlineScrollTarget._sgOutlineScrollHandler);
  }
  _sgOutlineScrollTarget = ch;
  if (!ch) return;
  const handler = () => {
    if (_sgOutlineScrollRaf !== null) return;
    _sgOutlineScrollRaf = requestAnimationFrame(sgUpdateOutlineScrollSpy);
  };
  ch._sgOutlineScrollHandler = handler;
  ch.addEventListener("scroll", handler, { passive: true });
}

function sgPositionOutlineRoot() {
  if (!_sgOutlineRoot) return;
  const suppressed = sgShouldSuppressOutlineSurface() || !isConversationOutlineEnabled || _sgOutlineTurnsSnapshot.length === 0;
  if (suppressed) {
    _sgOutlineRoot.style.display = "none";
    return;
  }
  const ch = (typeof domQuery === "function" && domQuery("chatHistory")) || null;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const chRect = ch ? ch.getBoundingClientRect() : { right: vw, width: vw };
  const rightOffset = Math.max(12, Math.min(vw - 300, Math.round(vw - (chRect.right || vw)) + 12));
  _sgOutlineRoot.style.right = `${Math.max(12, rightOffset)}px`;
  _sgOutlineRoot.style.display = "flex";
}

function sgEnsureOutlineRoot() {
  if (_sgOutlineRoot && _sgOutlineRoot.isConnected) return _sgOutlineRoot;
  const existing = document.getElementById("sg-outline-root");
  if (existing) existing.remove();

  const togglePill = sgSkillEl("button", {
    id: "sg-outline-toggle-pill",
    type: "button",
    title: "Show Conversation Outline",
    onClick: () => {
      _sgOutlineUiState.expanded = true;
      sgPersistOutlineUiState();
      sgRenderOutline(_sgOutlineTurnsSnapshot, true);
    }
  }, [
    sgCreateSvgIcon(SG_OUTLINE_SVG_PATHS, 15),
    sgSkillEl("span", { textContent: "Outline" }),
    (_sgOutlineCountBadge = sgSkillEl("span", { className: "sg-outline-count-badge", textContent: "0" }))
  ]);

  const exportHeaderBtn = sgSkillEl("button", {
    type: "button",
    className: "sg-outline-icon-btn",
    title: "Selective Export (Outline / Bookmarks)",
    onClick: () => sgOpenSelectiveExportModal({
      mode: _sgOutlineUiState.bookmarkedOnly ? "bookmarked" : "custom"
    })
  }, sgCreateSvgIcon(SG_EXPORT_SVG_PATHS, 14));

  const forkHeaderBtn = sgSkillEl("button", {
    type: "button",
    className: "sg-outline-icon-btn",
    title: "Fork & Hand-off chat summary",
    onClick: () => sgOpenForkHandoffModal({ mode: "range", upToTurn: _sgOutlineTurnsSnapshot.length })
  }, sgCreateSvgIcon(SG_FORK_SVG_PATHS, 14));

  _sgOutlineHeadingsBtn = sgSkillEl("button", {
    type: "button",
    className: `sg-outline-icon-btn${_sgOutlineUiState.showHeadings ? " active" : ""}`,
    title: "Toggle response headings (H1-H3)",
    onClick: () => {
      _sgOutlineUiState.showHeadings = !_sgOutlineUiState.showHeadings;
      sgPersistOutlineUiState();
      sgRenderOutline(_sgOutlineTurnsSnapshot, true);
    }
  }, sgCreateSvgIcon(SG_HEADING_SVG_PATHS, 14));

  _sgOutlineAssetsBtn = sgSkillEl("button", {
    type: "button",
    className: `sg-outline-icon-btn${_sgOutlineUiState.showAssets ? " active" : ""}`,
    title: "Toggle indexed diagrams, code & files",
    onClick: () => {
      _sgOutlineUiState.showAssets = !_sgOutlineUiState.showAssets;
      sgPersistOutlineUiState();
      sgRenderOutline(_sgOutlineTurnsSnapshot, true);
    }
  }, sgCreateSvgIcon(SG_ASSET_SVG_PATHS, 14));

  _sgOutlineBmFilterBtn = sgSkillEl("button", {
    type: "button",
    className: `sg-outline-icon-btn${_sgOutlineUiState.bookmarkedOnly ? " active" : ""}`,
    title: "Show bookmarked turns only",
    onClick: () => {
      _sgOutlineUiState.bookmarkedOnly = !_sgOutlineUiState.bookmarkedOnly;
      sgPersistOutlineUiState();
      sgRenderOutline(_sgOutlineTurnsSnapshot, true);
    }
  }, sgCreateSvgIcon(SG_BOOKMARK_SVG_PATHS, 14));

  const collapseBtn = sgSkillEl("button", {
    type: "button",
    className: "sg-outline-icon-btn",
    title: "Collapse outline",
    onClick: () => {
      _sgOutlineUiState.expanded = false;
      sgPersistOutlineUiState();
      sgRenderOutline(_sgOutlineTurnsSnapshot, true);
    }
  }, sgCreateSvgIcon(SG_CLOSE_SVG_PATHS, 14));

  _sgOutlineSearchInput = sgSkillEl("input", {
    type: "text",
    className: "sg-outline-search",
    placeholder: "Filter turns, headings, or assets...",
    value: _sgOutlineUiState.filterText || "",
    onInput: ev => {
      _sgOutlineUiState.filterText = ev.target.value || "";
      sgRenderOutline(_sgOutlineTurnsSnapshot, true);
    },
    onKeydown: ev => {
      if (ev.key === "Escape") {
        if (_sgOutlineUiState.filterText) {
          _sgOutlineUiState.filterText = "";
          _sgOutlineSearchInput.value = "";
          sgRenderOutline(_sgOutlineTurnsSnapshot, true);
        } else {
          _sgOutlineUiState.expanded = false;
          sgPersistOutlineUiState();
          sgRenderOutline(_sgOutlineTurnsSnapshot, true);
        }
      }
    }
  });

  _sgOutlineListEl = sgSkillEl("div", { className: "sg-outline-list" });

  const panel = sgSkillEl("div", { id: "sg-outline-panel" }, [
    sgSkillEl("div", { className: "sg-outline-header" }, [
      sgSkillEl("div", { className: "sg-outline-title-group" }, [
        sgCreateSvgIcon(SG_OUTLINE_SVG_PATHS, 14),
        sgSkillEl("span", { className: "sg-outline-title", textContent: "Outline" })
      ]),
      sgSkillEl("div", { className: "sg-outline-header-actions" }, [
        exportHeaderBtn,
        forkHeaderBtn,
        _sgOutlineHeadingsBtn,
        _sgOutlineAssetsBtn,
        _sgOutlineBmFilterBtn,
        collapseBtn
      ])
    ]),
    sgSkillEl("div", { className: "sg-outline-search-wrap" }, _sgOutlineSearchInput),
    _sgOutlineListEl
  ]);

  _sgOutlineRoot = sgSkillEl("div", { id: "sg-outline-root" }, [togglePill, panel]);
  document.body.appendChild(_sgOutlineRoot);
  return _sgOutlineRoot;
}

function sgRenderOutline(turns, force = false) {
  _sgOutlineTurnsSnapshot = Array.isArray(turns) ? turns : [];
  if (sgShouldSuppressOutlineSurface() || !isConversationOutlineEnabled || _sgOutlineTurnsSnapshot.length === 0) {
    if (_sgOutlineRoot) _sgOutlineRoot.style.display = "none";
    _sgOutlineSignature = "";
    return;
  }

  sgEnsureOutlineRoot();
  const sig = sgComputeOutlineSignature(_sgOutlineTurnsSnapshot);
  if (!force && sig === _sgOutlineSignature) {
    sgPositionOutlineRoot();
    return;
  }
  _sgOutlineSignature = sig;

  if (_sgOutlineCountBadge) {
    _sgOutlineCountBadge.textContent = String(_sgOutlineTurnsSnapshot.length);
  }
  const pillEl = _sgOutlineRoot.querySelector("#sg-outline-toggle-pill");
  const panelEl = _sgOutlineRoot.querySelector("#sg-outline-panel");
  if (pillEl) pillEl.style.display = _sgOutlineUiState.expanded ? "none" : "inline-flex";
  if (panelEl) panelEl.style.display = _sgOutlineUiState.expanded ? "flex" : "none";

  if (_sgOutlineHeadingsBtn) _sgOutlineHeadingsBtn.classList.toggle("active", Boolean(_sgOutlineUiState.showHeadings));
  if (_sgOutlineAssetsBtn) _sgOutlineAssetsBtn.classList.toggle("active", Boolean(_sgOutlineUiState.showAssets));
  if (_sgOutlineBmFilterBtn) _sgOutlineBmFilterBtn.classList.toggle("active", Boolean(_sgOutlineUiState.bookmarkedOnly));

  sgPositionOutlineRoot();
  if (!_sgOutlineUiState.expanded || !_sgOutlineListEl) return;

  const query = sgNormalizeInstructionText(_sgOutlineUiState.filterText || "").toLowerCase();
  _sgOutlineListEl.replaceChildren();

  let renderedCount = 0;
  for (const turn of _sgOutlineTurnsSnapshot) {
    if (_sgOutlineUiState.bookmarkedOnly && !turn.isBookmarked) continue;

    const matchedHeadings = [];
    for (const h of turn.headings || []) {
      if (!query || h.text.toLowerCase().includes(query) || turn.userPreview.toLowerCase().includes(query)) {
        matchedHeadings.push(h);
      }
    }
    const matchedAssets = [];
    for (const a of turn.assets || []) {
      const hay = `${a.badge || ""} ${a.label || ""} ${a.kind || ""}`.toLowerCase();
      if (!query || hay.includes(query) || turn.userPreview.toLowerCase().includes(query)) {
        matchedAssets.push(a);
      }
    }
    const turnMatches = !query || turn.userPreview.toLowerCase().includes(query) || `turn ${turn.turnNumber}`.includes(query);
    if (!turnMatches && matchedHeadings.length === 0 && matchedAssets.length === 0) continue;

    renderedCount++;
    const turnBtn = sgSkillEl("button", {
      type: "button",
      className: `sg-outline-item sg-outline-turn${_sgOutlineActiveKey === turn.key ? " active" : ""}`,
      "data-outline-key": turn.key,
      title: turn.userText || turn.userPreview,
      onClick: () => sgNavigateOutlineTarget(turn, null, null)
    }, [
      sgSkillEl("span", { className: "sg-outline-turn-num", textContent: `#${turn.turnNumber}` }),
      sgSkillEl("span", { className: "sg-outline-turn-text", textContent: turn.userPreview }),
      turn.isBookmarked ? sgSkillEl("span", { className: "sg-outline-bm-mark", textContent: "★", title: "Bookmarked" }) : null
    ]);

    const forkBtn = isForkHandoffEnabled
      ? sgSkillEl("button", {
          type: "button",
          className: "sg-outline-turn-fork-btn",
          title: `Fork conversation up to Turn #${turn.turnNumber}`,
          onClick: ev => {
            ev.preventDefault();
            ev.stopPropagation();
            sgOpenForkHandoffModal({ mode: "range", upToTurn: turn.turnNumber });
          }
        }, sgCreateSvgIcon(SG_FORK_SVG_PATHS, 13))
      : null;

    _sgOutlineListEl.appendChild(sgSkillEl("div", { className: "sg-outline-turn-row" }, [turnBtn, forkBtn]));

    if (_sgOutlineUiState.showHeadings && matchedHeadings.length > 0) {
      for (const h of matchedHeadings) {
        const hKey = `${turn.key}::h${h.ordinal}`;
        const hBtn = sgSkillEl("button", {
          type: "button",
          className: `sg-outline-item sg-outline-heading sg-outline-heading--h${h.level}${_sgOutlineActiveKey === hKey ? " active" : ""}`,
          "data-outline-key": hKey,
          title: h.text,
          onClick: () => sgNavigateOutlineTarget(turn, h.ordinal, null)
        }, [
          sgSkillEl("span", { className: "sg-outline-heading-text", textContent: h.text })
        ]);
        _sgOutlineListEl.appendChild(hBtn);
      }
    }

    if (_sgOutlineUiState.showAssets && matchedAssets.length > 0) {
      for (const asset of matchedAssets) {
        const aKey = `${turn.key}::a${asset.ordinal}`;
        const aBtn = sgSkillEl("button", {
          type: "button",
          className: `sg-outline-item sg-outline-asset sg-outline-asset--${asset.kind}${_sgOutlineActiveKey === aKey ? " active" : ""}`,
          "data-outline-key": aKey,
          title: `${asset.badge}: ${asset.label}`,
          onClick: () => sgNavigateOutlineTarget(turn, null, asset.ordinal)
        }, [
          sgSkillEl("span", { className: `sg-outline-asset-badge sg-outline-asset-badge--${asset.kind}`, textContent: asset.badge }),
          sgSkillEl("span", { className: "sg-outline-asset-label", textContent: asset.label })
        ]);
        _sgOutlineListEl.appendChild(aBtn);
      }
    }
  }

  if (renderedCount === 0) {
    _sgOutlineListEl.appendChild(sgSkillEl("div", {
      className: "sg-outline-empty",
      textContent: _sgOutlineUiState.bookmarkedOnly ? "No bookmarked turns match." : "No matching turns, headings, or assets."
    }));
  }
}

function sgTruncateMarkdownSafely(md, maxChars) {
  const text = String(md || "").trim();
  if (!text || maxChars <= 0) return "";
  if (text.length <= maxChars) return text;

  let cut = maxChars;
  const lastNl = text.lastIndexOf("\n", maxChars);
  if (lastNl >= Math.floor(maxChars * 0.75)) {
    cut = lastNl;
  } else {
    const lastSpace = text.lastIndexOf(" ", maxChars);
    if (lastSpace >= Math.floor(maxChars * 0.85)) {
      cut = lastSpace;
    }
  }

  let prefix = text.slice(0, cut).trimEnd();
  if (!prefix) {
    prefix = text.slice(0, maxChars).trimEnd();
  }
  const fenceMatches = prefix.match(/```/g);
  if (fenceMatches && fenceMatches.length % 2 === 1) {
    prefix += "\n```";
  }
  return `${prefix}\n[... truncated for hand-off]`;
}

function sgStripFencedCodeBlocks(md) {
  return String(md || "")
    .replace(/(^|\n)```[^\n]*\n[\s\S]*?\n?```(?=\n|$)/g, "$1[code block omitted]")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function sgBuildHandoffPayload(turns, options = {}) {
  const mode = options.mode === "bookmarked" || options.mode === "full" ? options.mode : "balanced";
  const maxTotalChars = Number.isFinite(Number(options.maxTotalChars)) ? Number(options.maxTotalChars) : 12000;
  const stripIntermediateCode = Boolean(options.stripIntermediateCode);
  const sourceTitle = sgNormalizeInstructionText(options.sourceTitle || "Gemini Conversation") || "Gemini Conversation";

  const selected = (Array.isArray(turns) ? turns : []).filter(t => {
    if (!t) return false;
    if (mode === "bookmarked" && !t.isBookmarked) return false;
    return Boolean(String(t.userText || "").trim() || String(t.modelText || "").trim());
  });

  if (selected.length === 0) {
    return `${SG_HANDOFF_OPEN_TAG}\nSource conversation: ${sourceTitle}\nIncluded turns: (none selected)\n${SG_HANDOFF_CLOSE_TAG}\n\nNext request: `;
  }

  const turnNums = selected.map(t => t.turnNumber).filter(n => typeof n === "number");
  const summaryLabel = turnNums.length
    ? `${selected.length} turn(s) (#${turnNums.join(", #")})${mode === "bookmarked" ? " [bookmarked]" : ""}`
    : `${selected.length} turn(s)`;

  const headerBlock = `${SG_HANDOFF_OPEN_TAG}\nSource conversation: ${sourceTitle}\nIncluded turns: ${summaryLabel}\n`;
  const footerBlock = `\n${SG_HANDOFF_CLOSE_TAG}\n\nContinue from the hand-off context above. Follow all established decisions and constraints.\n\nNext request: `;

  if (mode === "full") {
    const body = selected.map(t => {
      const parts = [];
      if (t.userText) parts.push(`### Turn ${t.turnNumber} — User\n${t.userText}`);
      if (t.modelText) parts.push(`### Turn ${t.turnNumber} — Gemini\n${t.modelText}`);
      return parts.join("\n\n");
    }).filter(Boolean).join("\n\n");
    return `${headerBlock}\n${body}${footerBlock}`;
  }

  const budgetForBody = Math.max(1200, maxTotalChars - headerBlock.length - footerBlock.length);
  const lastIdx = selected.length - 1;
  const lastPriority = Math.max(2400, Math.floor(budgetForBody * 0.45));
  const olderCount = Math.max(1, selected.length - 1);
  const olderEachBudget = Math.max(450, Math.floor((budgetForBody - lastPriority) / olderCount));

  const sections = [];
  let usedChars = 0;

  selected.forEach((t, idx) => {
    const isLast = idx === lastIdx;
    const parts = [];
    const rawUser = String(t.userText || "").trim();
    if (rawUser) {
      const userCap = isLast ? 3000 : Math.min(2000, Math.max(600, Math.floor(olderEachBudget * 0.45)));
      parts.push(`### Turn ${t.turnNumber} — User\n${sgTruncateMarkdownSafely(rawUser, userCap)}`);
    }
    let rawModel = String(t.modelText || "").trim();
    if (rawModel) {
      if (!isLast && stripIntermediateCode) {
        rawModel = sgStripFencedCodeBlocks(rawModel);
      }
      const remaining = Math.max(400, budgetForBody - usedChars);
      let modelCap = isLast ? lastPriority : olderEachBudget;
      if (t.isBookmarked && !isLast) {
        modelCap = Math.max(modelCap, Math.floor(budgetForBody * 0.30));
      }
      modelCap = Math.min(modelCap, remaining);
      parts.push(`### Turn ${t.turnNumber} — Gemini\n${sgTruncateMarkdownSafely(rawModel, modelCap)}`);
    }
    const block = parts.join("\n\n");
    usedChars += block.length;
    sections.push(block);
  });

  return `${headerBlock}\n${sections.join("\n\n")}${footerBlock}`;
}

async function sgCollectTurnsForFork(selectedTurnNumbers, indexedTurns) {
  const numSet = new Set(selectedTurnNumbers);
  const chosen = (indexedTurns || []).filter(t => numSet.has(t.turnNumber));
  const records = chosen.map(t => ({
    turnNumber: t.turnNumber,
    responseId: t.responseId,
    isBookmarked: Boolean(t.isBookmarked),
    userText: t.userEl && t.userEl.isConnected ? sgExtractNodeMarkdownLite((typeof t.userEl.querySelector === "function" && t.userEl.querySelector(".query-text")) || t.userEl) : (t.userText || ""),
    modelText: t.modelEl && t.modelEl.isConnected ? sgExtractNodeMarkdownLite(t.modelEl) : ""
  }));

  const missingContent = records.some(r => !r.userText || !r.modelText);
  if (missingContent && typeof getChatHistoryForExport === "function") {
    try {
      const exported = await getChatHistoryForExport({ includeThoughts: false });
      const paired = [];
      let pendingUser = null;
      for (const msg of Array.isArray(exported) ? exported : []) {
        if (msg.role === "User") {
          if (pendingUser !== null) {
            paired.push({ userText: pendingUser, modelText: "" });
          }
          pendingUser = String(msg.text || "").trim();
        } else {
          paired.push({ userText: pendingUser || "", modelText: String(msg.text || "").trim() });
          pendingUser = null;
        }
      }
      if (pendingUser !== null) {
        paired.push({ userText: pendingUser, modelText: "" });
      }
      for (const r of records) {
        const fallback = paired[r.turnNumber - 1];
        if (!fallback) continue;
        if (!r.userText && fallback.userText) r.userText = fallback.userText;
        if (!r.modelText && fallback.modelText) r.modelText = fallback.modelText;
      }
    } catch (err) {}
  }

  return records;
}

function sgGetGeminiNewChatUrl() {
  const m = typeof window !== "undefined" && window.location ? window.location.pathname.match(/^\/u\/(\d+)\//) : null;
  return m ? `https://gemini.google.com/u/${m[1]}/app` : "https://gemini.google.com/app";
}

async function sgLaunchForkHandoff(text, meta = {}) {
  const accountInfo = typeof sgGetCurrentAccountInfo === "function"
    ? sgGetCurrentAccountInfo()
    : { index: "0", email: null, label: "/u/0" };
  const now = Date.now();
  const job = {
    text: String(text || ""),
    sourceChatId: meta.sourceChatId || (typeof getCurrentChatId === "function" ? getCurrentChatId() : null),
    sourceTitle: meta.sourceTitle || "Gemini Conversation",
    accountIndex: accountInfo.index,
    accountEmail: accountInfo.email || null,
    createdAt: now,
    expiresAt: now + SG_FORK_PENDING_TTL_MS,
    nonce: `${now}_${Math.random().toString(36).slice(2, 8)}`
  };

  const saved = typeof safeLocalStorageSet === "function"
    ? await safeLocalStorageSet({ [SG_FORK_PENDING_KEY]: job })
    : false;
  if (!saved) return false;

  if (_sgForkModalOverlay) {
    _sgForkModalOverlay.remove();
    _sgForkModalOverlay = null;
  }

  const targetUrl = sgGetGeminiNewChatUrl();
  try {
    chrome.runtime.sendMessage({ type: "OPEN_GEMINI_NEW_CHAT_TAB", url: targetUrl }, resp => {
      if (chrome.runtime.lastError || !resp || !resp.ok) {
        window.open(targetUrl, "_blank", "noopener");
      }
    });
  } catch (err) {
    window.open(targetUrl, "_blank", "noopener");
  }
  return true;
}

async function sgCheckAndConsumePendingForkHandoff() {
  if (_sgForkConsumeInFlight) return false;
  if (typeof isOnNewChatLanding !== "function" || !isOnNewChatLanding()) return false;

  _sgForkConsumeInFlight = true;
  try {
    const job = await new Promise(resolve => {
      try {
        chrome.storage.local.get([SG_FORK_PENDING_KEY], res => {
          resolve(res ? res[SG_FORK_PENDING_KEY] : null);
        });
      } catch (err) {
        resolve(null);
      }
    });
    if (!job || typeof job.text !== "string" || !job.text.trim()) return false;

    if (Date.now() > Number(job.expiresAt || 0)) {
      try {
        chrome.storage.local.remove([SG_FORK_PENDING_KEY]);
      } catch (err) {}
      return false;
    }

    const waitStart = Date.now();
    let currentInfo = typeof sgGetCurrentAccountInfo === "function"
      ? sgGetCurrentAccountInfo()
      : { index: "0", email: null };
    while (Date.now() - waitStart < 3000) {
      if (currentInfo.email && findPromptInput()) break;
      await sgSleep(200);
      currentInfo = typeof sgGetCurrentAccountInfo === "function"
        ? sgGetCurrentAccountInfo()
        : { index: "0", email: null };
    }

    const indexMatch = String(job.accountIndex || "0") === String(currentInfo.index || "0");
    const emailMatch = !job.accountEmail || !currentInfo.email || job.accountEmail === currentInfo.email;
    if (!indexMatch || !emailMatch) return false;

    await new Promise(resolve => {
      try {
        chrome.storage.local.remove([SG_FORK_PENDING_KEY], resolve);
      } catch (err) {
        resolve();
      }
    });

    const inputWaitStart = Date.now();
    let composer = findPromptInput();
    while (!composer && Date.now() - inputWaitStart < 8000) {
      await sgSleep(200);
      composer = findPromptInput();
    }
    if (!composer) return false;

    await sgSleep(200);
    setPromptText(job.text);

    await sgSleep(250);
    const currentText = typeof getPromptText === "function"
      ? getPromptText()
      : (typeof extractInputText === "function" ? extractInputText(findPromptInput()) : "");
    if (!currentText || !currentText.trim()) {
      setPromptText(job.text);
    }

    if (typeof showToast === "function") {
      showToast("Hand-off context loaded. Review and add your next prompt.", "success");
    }
    return true;
  } finally {
    _sgForkConsumeInFlight = false;
  }
}

async function sgOpenForkHandoffModal(initialConfig = {}) {
  const turns = _sgOutlineTurnsSnapshot.length ? _sgOutlineTurnsSnapshot : sgScanConversationTurns();
  if (!turns.length) {
    if (typeof showToast === "function") showToast("No conversation turns available to fork yet.", "info");
    return;
  }

  if (_sgForkModalOverlay) {
    _sgForkModalOverlay.remove();
    _sgForkModalOverlay = null;
  }

  const chatInfo = typeof findActiveChatInfo === "function" ? findActiveChatInfo() : null;
  const sourceTitle = (chatInfo && chatInfo.title) || "Gemini Conversation";
  const sourceChatId = (chatInfo && chatInfo.id) || (typeof getCurrentChatId === "function" ? getCurrentChatId() : null);

  const bookmarkedCount = turns.filter(t => t.isBookmarked).length;
  let selMode = initialConfig.mode === "bookmarked" && bookmarkedCount > 0
    ? "bookmarked"
    : (initialConfig.mode === "custom" ? "custom" : "range");
  let upToTurn = Math.max(1, Math.min(turns.length, Number(initialConfig.upToTurn || turns.length)));
  const customSelected = new Set(turns.slice(0, upToTurn).map(t => t.turnNumber));
  let preset = "balanced_12k";
  let stripIntermediateCode = false;
  let isManuallyEdited = false;

  const previewArea = sgSkillEl("textarea", {
    className: "sg-fork-preview-area",
    spellcheck: "false",
    onInput: () => {
      isManuallyEdited = true;
      updateStats();
    }
  });
  const statsLabel = sgSkillEl("span", { className: "sg-fork-stats", textContent: "0 chars (~0 tokens)" });
  const rangeSelect = sgSkillEl("select", { className: "sg-fork-select" },
    turns.map(t => sgSkillEl("option", {
      value: String(t.turnNumber),
      textContent: `Up to #${t.turnNumber}: ${t.userPreview.slice(0, 42)}`
    }))
  );
  rangeSelect.value = String(upToTurn);

  const checklistEl = sgSkillEl("div", { className: "sg-fork-checklist", style: selMode === "custom" ? "" : "display: none;" });
  const presetSelect = sgSkillEl("select", { className: "sg-fork-select" }, [
    sgSkillEl("option", { value: "balanced_12k", textContent: "Balanced (~12k chars)" }),
    sgSkillEl("option", { value: "compact_6k", textContent: "Compact (~6k chars)" }),
    sgSkillEl("option", { value: "full", textContent: "Full Verbatim" })
  ]);
  const stripCodeCheckbox = sgSkillEl("input", {
    type: "checkbox",
    checked: stripIntermediateCode,
    onChange: ev => {
      stripIntermediateCode = Boolean(ev.target.checked);
      isManuallyEdited = false;
      rebuildPreview();
    }
  });

  const updateStats = () => {
    const val = previewArea.value || "";
    const chars = val.length;
    const approxTokens = Math.max(0, Math.round(chars / 4));
    statsLabel.textContent = `${chars.toLocaleString()} chars (~${approxTokens.toLocaleString()} tokens)${isManuallyEdited ? " • edited" : ""}`;
  };

  const getSelectedTurnNumbers = () => {
    if (selMode === "bookmarked") {
      return turns.filter(t => t.isBookmarked).map(t => t.turnNumber);
    }
    if (selMode === "custom") {
      return turns.filter(t => customSelected.has(t.turnNumber)).map(t => t.turnNumber);
    }
    return turns.slice(0, upToTurn).map(t => t.turnNumber);
  };

  let rebuildSeq = 0;
  const rebuildPreview = async () => {
    const seq = ++rebuildSeq;
    const selectedNums = getSelectedTurnNumbers();
    if (!selectedNums.length) {
      previewArea.value = "";
      updateStats();
      return;
    }
    statsLabel.textContent = "Extracting selected turns...";
    const records = await sgCollectTurnsForFork(selectedNums, turns);
    if (seq !== rebuildSeq) return;
    const packMode = selMode === "bookmarked"
      ? (preset === "full" ? "full" : "bookmarked")
      : (preset === "full" ? "full" : "balanced");
    const maxTotalChars = preset === "compact_6k" ? 6000 : 12000;
    const payload = sgBuildHandoffPayload(records, {
      mode: packMode,
      sourceTitle,
      maxTotalChars,
      stripIntermediateCode
    });
    previewArea.value = payload;
    isManuallyEdited = false;
    updateStats();
  };

  for (const t of turns) {
    const cb = sgSkillEl("input", {
      type: "checkbox",
      checked: customSelected.has(t.turnNumber),
      onChange: ev => {
        if (ev.target.checked) customSelected.add(t.turnNumber);
        else customSelected.delete(t.turnNumber);
        isManuallyEdited = false;
        rebuildPreview();
      }
    });
    checklistEl.appendChild(sgSkillEl("label", { className: "sg-fork-check-item" }, [
      cb,
      sgSkillEl("span", { className: "sg-outline-turn-num", textContent: `#${t.turnNumber}` }),
      sgSkillEl("span", { textContent: t.userPreview }),
      t.isBookmarked ? sgSkillEl("span", { className: "sg-outline-bm-mark", textContent: "★" }) : null
    ]));
  }

  let modeButtons = {};
  const setMode = nextMode => {
    selMode = nextMode;
    Object.entries(modeButtons).forEach(([k, btn]) => btn.classList.toggle("active", k === selMode));
    rangeSelect.style.display = selMode === "range" ? "" : "none";
    checklistEl.style.display = selMode === "custom" ? "flex" : "none";
    isManuallyEdited = false;
    rebuildPreview();
  };

  modeButtons = {
    range: sgSkillEl("button", {
      type: "button",
      className: `sg-fork-mode-btn${selMode === "range" ? " active" : ""}`,
      textContent: "Up to Turn K",
      onClick: () => setMode("range")
    }),
    bookmarked: sgSkillEl("button", {
      type: "button",
      className: `sg-fork-mode-btn${selMode === "bookmarked" ? " active" : ""}`,
      disabled: bookmarkedCount === 0,
      textContent: `Bookmarked Only (${bookmarkedCount})`,
      onClick: () => setMode("bookmarked")
    }),
    custom: sgSkillEl("button", {
      type: "button",
      className: `sg-fork-mode-btn${selMode === "custom" ? " active" : ""}`,
      textContent: "Custom Pick",
      onClick: () => setMode("custom")
    })
  };

  rangeSelect.addEventListener("change", () => {
    upToTurn = Math.max(1, Number(rangeSelect.value || turns.length));
    isManuallyEdited = false;
    rebuildPreview();
  });
  presetSelect.addEventListener("change", () => {
    preset = presetSelect.value || "balanced_12k";
    isManuallyEdited = false;
    rebuildPreview();
  });

  const closeModal = () => {
    if (_sgForkModalOverlay) {
      _sgForkModalOverlay.remove();
      _sgForkModalOverlay = null;
    }
    document.removeEventListener("keydown", onEsc);
  };
  const onEsc = ev => {
    if (ev.key === "Escape") closeModal();
  };
  document.addEventListener("keydown", onEsc);

  const modal = sgSkillEl("div", { className: "sg-fork-modal", role: "dialog", "aria-modal": "true" }, [
    sgSkillEl("div", { className: "sg-fork-modal-header" }, [
      sgSkillEl("div", {}, [
        sgSkillEl("h3", { className: "sg-fork-modal-title", textContent: "Fork & Hand-off Context" }),
        sgSkillEl("div", { className: "sg-fork-modal-subtitle", textContent: `${sourceTitle} • Pre-fills a new chat without auto-sending` })
      ]),
      sgSkillEl("button", {
        type: "button",
        className: "sg-outline-icon-btn",
        title: "Close",
        onClick: closeModal
      }, sgCreateSvgIcon(SG_CLOSE_SVG_PATHS, 15))
    ]),
    sgSkillEl("div", { className: "sg-fork-modal-body" }, [
      sgSkillEl("div", { className: "sg-fork-controls" }, [
        modeButtons.range,
        modeButtons.bookmarked,
        modeButtons.custom,
        rangeSelect,
        presetSelect
      ]),
      checklistEl,
      sgSkillEl("div", { className: "sg-fork-option-row" }, [
        sgSkillEl("label", { className: "sg-fork-checkbox-label" }, [
          stripCodeCheckbox,
          sgSkillEl("span", { textContent: "Omit code blocks in older intermediate turns" })
        ]),
        statsLabel
      ]),
      previewArea
    ]),
    sgSkillEl("div", { className: "sg-fork-modal-footer" }, [
      sgSkillEl("button", {
        type: "button",
        className: "sg-skills-btn sg-skills-btn-secondary",
        textContent: "Cancel",
        onClick: closeModal
      }),
      sgSkillEl("button", {
        type: "button",
        className: "sg-skills-btn sg-skills-btn-secondary",
        textContent: "Copy Handoff",
        onClick: async () => {
          if (!previewArea.value.trim()) return;
          try {
            await navigator.clipboard.writeText(previewArea.value);
            if (typeof showToast === "function") showToast("Hand-off context copied to clipboard.", "success");
          } catch (err) {
            if (typeof showToast === "function") showToast("Failed to copy to clipboard.", "error");
          }
        }
      }),
      sgSkillEl("button", {
        type: "button",
        className: "sg-skills-btn sg-skills-btn-primary",
        textContent: "Open New Chat with Context",
        onClick: async () => {
          const text = previewArea.value;
          if (!text || !text.trim()) return;
          await sgLaunchForkHandoff(text, { sourceChatId, sourceTitle });
        }
      })
    ])
  ]);

  const overlay = sgSkillEl("div", {
    id: "sg-fork-modal-overlay",
    onClick: ev => {
      if (ev.target === overlay) closeModal();
    }
  }, modal);

  document.body.appendChild(overlay);
  _sgForkModalOverlay = overlay;
  await rebuildPreview();
}

function sgCloseSelectiveExportModal() {
  if (_sgSelectiveExportOverlay) {
    if (typeof SG !== "undefined" && SG && SG.dispatcher) {
      SG.dispatcher.unregister("outline:export-esc");
    } else if (typeof _sgSelectiveExportOverlay._sgEscHandler === "function") {
      document.removeEventListener("keydown", _sgSelectiveExportOverlay._sgEscHandler, true);
    }
    _sgSelectiveExportOverlay.remove();
    _sgSelectiveExportOverlay = null;
  }
}

function sgOpenSelectiveExportModal(initialConfig = {}) {
  const turns = _sgOutlineTurnsSnapshot.length ? _sgOutlineTurnsSnapshot : sgScanConversationTurns();
  if (!turns.length) {
    if (typeof showToast === "function") showToast("No conversation turns available to export yet.", "info");
    return;
  }

  sgCloseSelectiveExportModal();

  const chatInfo = typeof findActiveChatInfo === "function" ? findActiveChatInfo() : null;
  const sourceTitle = (chatInfo && chatInfo.title) || "Gemini Conversation";
  const bookmarkedTurns = turns.filter(t => t.isBookmarked);
  const diagramTurns = turns.filter(t => Array.isArray(t.assets) && t.assets.some(a => a.kind === "diagram"));

  let selMode = initialConfig.mode === "bookmarked" && bookmarkedTurns.length > 0
    ? "bookmarked"
    : (initialConfig.mode === "all" ? "all" : "custom");
  let format = initialConfig.format || "md";
  let includeUserQueries = initialConfig.includeUserQueries !== false;
  let includeTimestamps = initialConfig.includeTimestamps !== false;
  let includeThoughts = Boolean(initialConfig.includeThoughts);
  let mdProperties = Boolean(initialConfig.mdProperties);

  const selectedTurns = new Set(
    selMode === "bookmarked"
      ? bookmarkedTurns.map(t => t.turnNumber)
      : turns.map(t => t.turnNumber)
  );

  const getActiveTurnSet = () => {
    if (selMode === "all") return new Set(turns.map(t => t.turnNumber));
    if (selMode === "bookmarked") return new Set(bookmarkedTurns.map(t => t.turnNumber));
    return new Set(selectedTurns);
  };

  const modeBtnRefs = new Map();
  const formatBtnRefs = new Map();
  const checklistEl = sgSkillEl("div", { className: "sg-selexp-checklist" });
  const summaryEl = sgSkillEl("span", { className: "sg-selexp-summary" });
  let exportBtn = null;
  let mdPropsRow = null;

  const updateSummaryAndButtons = () => {
    const activeSet = getActiveTurnSet();
    const count = activeSet.size;
    summaryEl.textContent = `Selected: ${count} / ${turns.length} turn(s)`;
    if (exportBtn) {
      exportBtn.disabled = count === 0;
    }
    modeBtnRefs.forEach((btn, key) => {
      btn.classList.toggle("active", selMode === key);
    });
    formatBtnRefs.forEach((btn, key) => {
      btn.classList.toggle("active", format === key);
    });
    if (mdPropsRow) {
      mdPropsRow.style.display = format === "md" ? "inline-flex" : "none";
    }
  };

  const renderChecklist = () => {
    checklistEl.replaceChildren();
    const activeSet = getActiveTurnSet();
    for (const turn of turns) {
      const checked = activeSet.has(turn.turnNumber);
      const cb = sgSkillEl("input", {
        type: "checkbox",
        checked,
        onChange: () => {
          if (selMode !== "custom") {
            selectedTurns.clear();
            activeSet.forEach(n => selectedTurns.add(n));
            selMode = "custom";
          }
          if (cb.checked) selectedTurns.add(turn.turnNumber);
          else selectedTurns.delete(turn.turnNumber);
          updateSummaryAndButtons();
        }
      });

      const headingCount = Array.isArray(turn.headings) ? turn.headings.length : 0;
      const diagCount = Array.isArray(turn.assets) ? turn.assets.filter(a => a.kind === "diagram").length : 0;
      const codeCount = Array.isArray(turn.assets) ? turn.assets.filter(a => a.kind === "code" || a.kind === "file").length : 0;
      const metaBits = [];
      if (headingCount > 0) metaBits.push(`${headingCount}H`);
      if (diagCount > 0) metaBits.push(`${diagCount} diag`);
      if (codeCount > 0) metaBits.push(`${codeCount} code`);

      const row = sgSkillEl("label", { className: `sg-selexp-turn-row${checked ? " checked" : ""}` }, [
        cb,
        sgSkillEl("span", { className: "sg-outline-turn-num", textContent: `#${turn.turnNumber}` }),
        sgSkillEl("span", { className: "sg-selexp-turn-preview", textContent: turn.userPreview || "(Prompt)" }),
        metaBits.length > 0 ? sgSkillEl("span", { className: "sg-selexp-meta-pill", textContent: metaBits.join(" · ") }) : null,
        turn.isBookmarked ? sgSkillEl("span", { className: "sg-outline-bm-mark", textContent: "★", title: "Bookmarked" }) : null
      ]);
      checklistEl.appendChild(row);
    }
    updateSummaryAndButtons();
  };

  const makeModeBtn = (key, label, disabled = false) => {
    const btn = sgSkillEl("button", {
      type: "button",
      className: `sg-selexp-chip${selMode === key ? " active" : ""}`,
      disabled,
      onClick: () => {
        if (disabled) return;
        selMode = key;
        if (key === "all") {
          selectedTurns.clear();
          turns.forEach(t => selectedTurns.add(t.turnNumber));
        } else if (key === "bookmarked") {
          selectedTurns.clear();
          bookmarkedTurns.forEach(t => selectedTurns.add(t.turnNumber));
        }
        renderChecklist();
      }
    }, label);
    modeBtnRefs.set(key, btn);
    return btn;
  };

  const makeQuickBtn = (label, onClick, disabled = false) => sgSkillEl("button", {
    type: "button",
    className: "sg-selexp-quick-btn",
    disabled,
    onClick
  }, label);

  const makeFormatBtn = (key, label) => {
    const btn = sgSkillEl("button", {
      type: "button",
      className: `sg-selexp-chip${format === key ? " active" : ""}`,
      onClick: () => {
        format = key;
        updateSummaryAndButtons();
      }
    }, label);
    formatBtnRefs.set(key, btn);
    return btn;
  };

  const makeOptCheck = (label, initialVal, onToggle) => {
    const input = sgSkillEl("input", {
      type: "checkbox",
      checked: initialVal,
      onChange: () => onToggle(Boolean(input.checked))
    });
    return sgSkillEl("label", { className: "sg-selexp-opt-check" }, [
      input,
      sgSkillEl("span", { textContent: label })
    ]);
  };

  mdPropsRow = makeOptCheck("Add Obsidian .md properties", mdProperties, v => { mdProperties = v; });

  exportBtn = sgSkillEl("button", {
    type: "button",
    className: "sg-selexp-primary-btn",
    onClick: async () => {
      const activeSet = getActiveTurnSet();
      if (activeSet.size === 0) {
        if (typeof showToast === "function") showToast("Select at least one turn to export.", "info");
        return;
      }
      const chosenTurns = turns.filter(t => activeSet.has(t.turnNumber));
      const exportOpts = {
        includeThoughts,
        includeTimestamps,
        mdProperties,
        includeUserQueries,
        selectedTurnNumbers: Array.from(activeSet),
        totalOutlineTurns: turns.length,
        selectedTurnPreviews: chosenTurns.map(t => ({
          turnNumber: t.turnNumber,
          userSnippet: (t.userText || t.userPreview || "").slice(0, 80)
        }))
      };
      sgCloseSelectiveExportModal();
      if (format === "pdf" && typeof exportChatAsPdf === "function") {
        await exportChatAsPdf(exportOpts);
      } else if (format === "docx" && typeof exportChatAsDocx === "function") {
        await exportChatAsDocx(exportOpts);
      } else if (format === "txt" && typeof exportChatAsText === "function") {
        await exportChatAsText(exportOpts);
      } else if (typeof exportChatAsMarkdown === "function") {
        await exportChatAsMarkdown(exportOpts);
      }
    }
  }, "Export Selected");

  const closeBtn = sgSkillEl("button", {
    type: "button",
    className: "sg-outline-icon-btn",
    title: "Close",
    "aria-label": "Close Selective Export",
    onClick: () => sgCloseSelectiveExportModal()
  }, sgCreateSvgIcon(SG_CLOSE_SVG_PATHS, 15));

  const modal = sgSkillEl("div", {
    className: "sg-fork-modal sg-selexp-modal",
    role: "dialog",
    "aria-modal": "true",
    "aria-label": "Selective Export"
  }, [
    sgSkillEl("div", { className: "sg-fork-modal-header" }, [
      sgSkillEl("div", {}, [
        sgSkillEl("h3", { className: "sg-fork-modal-title", textContent: "Selective Export (Outline & Bookmarks)" }),
        sgSkillEl("div", { className: "sg-fork-modal-subtitle", textContent: `${sourceTitle} · ${turns.length} turn(s), ${bookmarkedTurns.length} bookmarked` })
      ]),
      closeBtn
    ]),
    sgSkillEl("div", { className: "sg-fork-modal-body" }, [
      sgSkillEl("div", { className: "sg-selexp-row" }, [
        sgSkillEl("span", { className: "sg-selexp-label", textContent: "Scope:" }),
        makeModeBtn("all", `All Turns (${turns.length})`),
        makeModeBtn("bookmarked", `★ Bookmarked (${bookmarkedTurns.length})`, bookmarkedTurns.length === 0),
        makeModeBtn("custom", "Custom")
      ]),
      sgSkillEl("div", { className: "sg-selexp-quick-bar" }, [
        makeQuickBtn("Select All", () => {
          selMode = "custom";
          selectedTurns.clear();
          turns.forEach(t => selectedTurns.add(t.turnNumber));
          renderChecklist();
        }),
        makeQuickBtn("Clear", () => {
          selMode = "custom";
          selectedTurns.clear();
          renderChecklist();
        }),
        makeQuickBtn(`Only Bookmarked (${bookmarkedTurns.length})`, () => {
          selMode = "custom";
          selectedTurns.clear();
          bookmarkedTurns.forEach(t => selectedTurns.add(t.turnNumber));
          renderChecklist();
        }, bookmarkedTurns.length === 0),
        makeQuickBtn(`Only Diagrams (${diagramTurns.length})`, () => {
          selMode = "custom";
          selectedTurns.clear();
          diagramTurns.forEach(t => selectedTurns.add(t.turnNumber));
          renderChecklist();
        }, diagramTurns.length === 0)
      ]),
      checklistEl,
      sgSkillEl("div", { className: "sg-selexp-row" }, [
        sgSkillEl("span", { className: "sg-selexp-label", textContent: "Format:" }),
        makeFormatBtn("md", "Markdown (.md)"),
        makeFormatBtn("pdf", "PDF (.pdf)"),
        makeFormatBtn("docx", "DOCX (.docx)"),
        makeFormatBtn("txt", "Text (.txt)")
      ]),
      sgSkillEl("div", { className: "sg-selexp-opts-row" }, [
        makeOptCheck("Include User prompts", includeUserQueries, v => { includeUserQueries = v; }),
        makeOptCheck("Include timestamps", includeTimestamps, v => { includeTimestamps = v; }),
        makeOptCheck("Include Gemini thoughts", includeThoughts, v => { includeThoughts = v; }),
        mdPropsRow
      ])
    ]),
    sgSkillEl("div", { className: "sg-selexp-footer" }, [
      summaryEl,
      sgSkillEl("div", { className: "sg-selexp-footer-actions" }, [
        sgSkillEl("button", {
          type: "button",
          className: "sg-selexp-secondary-btn",
          onClick: () => sgCloseSelectiveExportModal()
        }, "Cancel"),
        exportBtn
      ])
    ])
  ]);

  const overlay = sgSkillEl("div", {
    id: "sg-selective-export-overlay",
    onClick: ev => {
      if (ev.target === overlay) sgCloseSelectiveExportModal();
    }
  }, modal);

  const escHandler = ev => {
    if (ev.key === "Escape") {
      ev.preventDefault();
      ev.stopPropagation();
      sgCloseSelectiveExportModal();
    }
  };
  overlay._sgEscHandler = escHandler;
  if (typeof SG !== "undefined" && SG && SG.dispatcher) {
    SG.dispatcher.register("outline:export-esc", "document", "keydown", escHandler, SG.dispatcher.PRIORITY.MODAL_ESCAPE);
  } else {
    document.addEventListener("keydown", escHandler, true);
  }
  document.body.appendChild(overlay);
  _sgSelectiveExportOverlay = overlay;
  renderChecklist();
}

function sgOpenForkHandoffModalFromResponse(modelEl) {
  const turns = sgScanConversationTurns();
  const rid = modelEl && typeof sgGetTurnId === "function" ? sgGetTurnId(modelEl) : null;
  let match = rid ? turns.find(t => t.responseId === rid) : null;
  if (!match && modelEl) {
    match = turns.find(t => t.modelEl === modelEl || (t.containerEl && t.containerEl.contains(modelEl)));
  }
  sgOpenForkHandoffModal({
    mode: "range",
    upToTurn: match ? match.turnNumber : turns.length
  });
}

function sgInjectForkButton(modelEl) {
  if (!isExtensionEnabled || !isForkHandoffEnabled || !modelEl) return;
  if (sgShouldSuppressOutlineSurface()) return;
  if (modelEl.querySelector(".sg-fork-turn-btn")) return;
  const bar = typeof findMessageActionsBar === "function" ? findMessageActionsBar(modelEl) : null;
  if (!bar) return;

  const btn = sgSkillEl("button", {
    type: "button",
    className: "sg-fork-turn-btn",
    title: "Fork conversation from here",
    "aria-label": "Fork conversation from here",
    onClick: ev => {
      ev.preventDefault();
      ev.stopPropagation();
      sgOpenForkHandoffModalFromResponse(modelEl);
    }
  }, sgCreateSvgIcon(SG_FORK_SVG_PATHS, 16));

  const bmBtn = bar.querySelector(".sg-bookmark-btn");
  if (bmBtn) {
    bar.insertBefore(btn, bmBtn.nextSibling);
  } else if (typeof findBookmarkInsertPoint === "function") {
    const { ref } = findBookmarkInsertPoint(bar);
    bar.insertBefore(btn, ref);
  } else {
    bar.appendChild(btn);
  }
}

function sgRemoveAllForkButtons() {
  document.querySelectorAll(".sg-fork-turn-btn").forEach(btn => btn.remove());
}

function sgRefreshOutlineAndForkUi(force = false) {
  const turns = sgScanConversationTurns();
  sgRenderOutline(turns, force);
  sgAttachOutlineScrollSpy();
  if (isForkHandoffEnabled && !sgShouldSuppressOutlineSurface()) {
    document.querySelectorAll("model-response").forEach(el => sgInjectForkButton(el));
  } else {
    sgRemoveAllForkButtons();
  }
}

function sgDisconnectChatMutationObserver() {
  if (_sgOutlineMutationObserver) {
    _sgOutlineMutationObserver.disconnect();
    _sgOutlineMutationObserver = null;
  }
  _sgOutlineObservedChatEl = null;
  if (_sgOutlineScanTimer) {
    clearTimeout(_sgOutlineScanTimer);
    _sgOutlineScanTimer = null;
  }
}

function sgScheduleOutlineRefresh(force = false) {
  if (!isConversationOutlineEnabled && !isForkHandoffEnabled) {
    sgDisconnectChatMutationObserver();
    return;
  }
  if (_sgOutlineScanTimer) clearTimeout(_sgOutlineScanTimer);
  _sgOutlineScanTimer = setTimeout(() => {
    _sgOutlineScanTimer = null;
    sgRefreshOutlineAndForkUi(force);
  }, 300);
}

function sgEnsureChatMutationObserver() {
  if (!isConversationOutlineEnabled && !isForkHandoffEnabled) {
    sgDisconnectChatMutationObserver();
    return;
  }
  if (typeof MutationObserver !== "function") return;
  const ch = (typeof domQuery === "function" && domQuery("chatHistory")) || null;
  if (ch === _sgOutlineObservedChatEl && _sgOutlineMutationObserver) return;
  if (_sgOutlineMutationObserver) {
    _sgOutlineMutationObserver.disconnect();
    _sgOutlineMutationObserver = null;
  }
  _sgOutlineObservedChatEl = ch;
  if (!ch) return;
  _sgOutlineMutationObserver = new MutationObserver(() => {
    sgScheduleOutlineRefresh(false);
  });
  _sgOutlineMutationObserver.observe(ch, { childList: true, subtree: true });
}

function sgSetOutlineEnabled(enabled) {
  isConversationOutlineEnabled = Boolean(enabled);
  if (!isConversationOutlineEnabled) {
    if (_sgOutlineRoot) _sgOutlineRoot.style.display = "none";
    sgCloseSelectiveExportModal();
  }
  if (!isConversationOutlineEnabled && !isForkHandoffEnabled) {
    sgDisconnectChatMutationObserver();
  } else {
    sgEnsureChatMutationObserver();
  }
  sgRefreshOutlineAndForkUi(true);
}

function sgSetForkHandoffEnabled(enabled) {
  isForkHandoffEnabled = Boolean(enabled);
  if (!isForkHandoffEnabled) {
    sgRemoveAllForkButtons();
  }
  if (!isConversationOutlineEnabled && !isForkHandoffEnabled) {
    sgDisconnectChatMutationObserver();
  } else {
    sgEnsureChatMutationObserver();
  }
  sgRefreshOutlineAndForkUi(true);
}

function initOutlineAndForkSystem() {
  if ("undefined" != typeof SG_IS_SILENT_BG_WORKER_TAB && SG_IS_SILENT_BG_WORKER_TAB) return;
  ("function" == typeof sgSyncGetCached ? sgSyncGetCached : chrome.storage.sync.get.bind(chrome.storage.sync))(["extensionEnabled", "conversationOutlineEnabled", "forkHandoffEnabled"], res => {
    const safe = res || {};
    if (safe.extensionEnabled === false) {
      isExtensionEnabled = false;
      isConversationOutlineEnabled = false;
      isForkHandoffEnabled = false;
      sgDisconnectChatMutationObserver();
      return;
    }
    isConversationOutlineEnabled = safe.conversationOutlineEnabled !== false;
    isForkHandoffEnabled = safe.forkHandoffEnabled !== false;

    chrome.storage.local.get([SG_OUTLINE_UI_STATE_KEY], localRes => {
      const saved = localRes && localRes[SG_OUTLINE_UI_STATE_KEY];
      if (saved && typeof saved === "object") {
        _sgOutlineUiState.expanded = Boolean(saved.expanded);
        _sgOutlineUiState.showHeadings = saved.showHeadings !== false;
        _sgOutlineUiState.showAssets = saved.showAssets !== false;
        _sgOutlineUiState.bookmarkedOnly = Boolean(saved.bookmarkedOnly);
        sgRenderOutline(_sgOutlineTurnsSnapshot, true);
      }
    });

    if (typeof sgObserverRegistry !== "undefined" && sgObserverRegistry && typeof sgObserverRegistry.registerUIRefresh === "function") {
      sgObserverRegistry.registerUIRefresh("outlineAndFork", () => {
        if (isExtensionEnabled && (isConversationOutlineEnabled || isForkHandoffEnabled)) {
          sgEnsureChatMutationObserver();
          sgScheduleOutlineRefresh(false);
        } else {
          sgDisconnectChatMutationObserver();
        }
        if (isExtensionEnabled && isForkHandoffEnabled) {
          const curPath = window.location.pathname + window.location.search;
          if (curPath !== _sgForkCheckedPath) {
            _sgForkCheckedPath = curPath;
            if (typeof isOnNewChatLanding === "function" && isOnNewChatLanding()) {
              sgCheckAndConsumePendingForkHandoff();
            }
          }
        }
      });
    }

    _sgForkCheckedPath = window.location.pathname + window.location.search;
    if (typeof isOnNewChatLanding === "function" && isOnNewChatLanding()) {
      setTimeout(() => sgCheckAndConsumePendingForkHandoff(), 350);
    } else {
      sgEnsureChatMutationObserver();
      setTimeout(() => sgRefreshOutlineAndForkUi(true), 500);
    }

    window.addEventListener("resize", () => {
      if (_sgOutlineResizeTimer) clearTimeout(_sgOutlineResizeTimer);
      _sgOutlineResizeTimer = setTimeout(() => sgPositionOutlineRoot(), 150);
    }, { passive: true });
  });

  const _sgOutlineStorageHandler = (changes, areaName) => {
    if (areaName === "sync" && changes.extensionEnabled) {
      isExtensionEnabled = changes.extensionEnabled.newValue !== false;
      if (!isExtensionEnabled) {
        sgSetOutlineEnabled(false);
        sgSetForkHandoffEnabled(false);
        return;
      }
    }
    if (areaName === "sync" && changes.conversationOutlineEnabled) {
      sgSetOutlineEnabled(isExtensionEnabled && changes.conversationOutlineEnabled.newValue !== false);
    }
    if (areaName === "sync" && changes.forkHandoffEnabled) {
      sgSetForkHandoffEnabled(isExtensionEnabled && changes.forkHandoffEnabled.newValue !== false);
    }
    if ((areaName === "local" && changes[SG_BOOKMARKS_STORAGE_KEY]) || (areaName === "sync" && changes.bookmarksEnabled)) {
      sgScheduleOutlineRefresh(true);
    }
  };
  if (typeof SG !== "undefined" && SG && SG.storage) {
    SG.storage.onChanged("outline-export:storage", _sgOutlineStorageHandler);
  } else {
    chrome.storage.onChanged.addListener(_sgOutlineStorageHandler);
  }
}

("undefined" != typeof SG_IS_SILENT_BG_WORKER_TAB && SG_IS_SILENT_BG_WORKER_TAB) || initOutlineAndForkSystem();
