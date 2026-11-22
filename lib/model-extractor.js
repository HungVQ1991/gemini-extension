(function (root) {
  "use strict";

  /**
   * 100% self-contained in-page extractor suitable for chrome.scripting.executeScript
   * and Chrome DevTools Console execution. Must NOT reference outer closure variables.
   */
  async function sgExtractFeasibleModelsInTab(extractorConfig) {
    const cfg = extractorConfig && typeof extractorConfig === "object" ? extractorConfig : {};
    const menuButtonSelector = cfg.menuButtonSelector || '[data-test-id="bard-mode-menu-button"]';
    const optionSelector = cfg.optionSelector || '[data-test-id^="bard-mode-option-"]';
    const thinkingTriggerSelector = cfg.thinkingTriggerSelector || 'gem-menu-item[value="thinking_level"]';
    const autoPatterns = Array.isArray(cfg.autoPatterns) && cfg.autoPatterns.length > 0
      ? cfg.autoPatterns.map(p => String(p).toLowerCase())
      : ["tự động", "automatic", "auto"];
    const lockedTestIdSubstrings = Array.isArray(cfg.lockedTestIdSubstrings) && cfg.lockedTestIdSubstrings.length > 0
      ? cfg.lockedTestIdSubstrings.map(p => String(p).toLowerCase())
      : ["upsell"];
    const ignoreTitlePatterns = Array.isArray(cfg.ignoreTitlePatterns) && cfg.ignoreTitlePatterns.length > 0
      ? cfg.ignoreTitlePatterns.map(p => String(p).toLowerCase())
      : ["upgrade", "nâng cấp"];
    const modelsMap = cfg.models && typeof cfg.models === "object"
      ? cfg.models
      : {
          hydrogen: { domPatterns: ["hydrogen", "trợ giúp hằng ngày", "everyday", "daily", "flash-lite", "flash lite", "gemini fast", "fast"] },
          neon: { domPatterns: ["neon", "phân tích sâu hơn", "deeper analysis", "deep analysis", "gemini thinking", "thinking"] },
          carbon: { domPatterns: ["carbon", "lập trình và xử lý công việc phức tạp", "coding and complex", "most complex work", "complex work", "gemini pro", "pro"] },
          argon: { domPatterns: ["argon", "code and analysis", "deep think"] }
        };
    const thinkingMap = cfg.thinkingLevels && typeof cfg.thinkingLevels === "object"
      ? cfg.thinkingLevels
      : {
          minimal: { domPatterns: ["minimal", "tối thiểu"] },
          low: { domPatterns: ["low", "thấp", "standard", "tiêu chuẩn"] },
          medium: { domPatterns: ["medium", "trung bình", "vừa", "balanced"] },
          high: { domPatterns: ["high", "cao", "extended", "mở rộng"] },
          extra: { domPatterns: ["extra", "rất cao", "max", "siêu", "tối đa"] }
        };
    const probeThinkingLevels = cfg.probeThinkingLevels !== false;

    const sleepMs = ms => new Promise(r => setTimeout(r, ms));
    const normWs = s => String(s || "").replace(/\s+/g, " ").trim();
    const isIconLikeEl = el => {
      if (!el || typeof el.getAttribute !== "function") return false;
      const tag = String(el.tagName || "").toLowerCase();
      if (tag === "mat-icon" || tag === "svg") return true;
      const cls = String(el.className || "").toLowerCase();
      if (cls.includes("cdk-visually-hidden") || cls.includes("sr-only") || cls.includes("ripple") || cls.includes("focus-indicator")) return true;
      if (el.getAttribute("data-sg-periodic-label") === "true") return true;
      if (el.hasAttribute && (el.hasAttribute("fonticon") || el.hasAttribute("data-mat-icon-name"))) return true;
      return false;
    };

    const collectVisibleText = el => {
      if (!el) return "";
      if (el.nodeType === 3) return String(el.textContent || "");
      if (isIconLikeEl(el)) return "";
      const children = el.childNodes && el.childNodes.length > 0
        ? Array.from(el.childNodes)
        : (Array.isArray(el.children) && el.children.length > 0 ? el.children : null);
      if (!children) return normWs(el.textContent || "");
      const parts = [];
      for (const ch of children) {
        if (!ch) continue;
        if (ch.nodeType === 3) {
          const t = normWs(ch.textContent || "");
          if (t) parts.push(t);
        } else if (ch.nodeType === 1 || ch.tagName) {
          const t = collectVisibleText(ch);
          if (t) parts.push(t);
        }
      }
      if (parts.length === 0 && (!el.children || el.children.length === 0)) {
        return normWs(el.textContent || "");
      }
      return normWs(parts.join(" "));
    };

    const matchesToken = (txt, pat) => {
      const p = String(pat || "").toLowerCase().trim();
      if (!p || !txt) return false;
      if (p === "pro") return /\bpro\b/.test(txt);
      if (p === "flash") return /\bflash\b(?!\s*-?\s*lite)/.test(txt);
      if (p === "auto") return /\bauto\b/.test(txt);
      return txt.includes(p);
    };

    const modelNameHintRegex = /\b(hydrogen|neon|carbon|argon|flash-lite|flash lite|flash|fast|thinking|pro|deep think|3\.1|4\s+[a-z]+)\b/i;

    const extractOptionMeta = item => {
      const rawText = collectVisibleText(item) || normWs(item.textContent || "");
      const tid = String(item.getAttribute && item.getAttribute("data-test-id") || "").trim();
      const labelContainer = item.querySelector ? item.querySelector(".label-container") : null;
      let title = "";
      let description = "";

      if (labelContainer) {
        const kids = Array.from(labelContainer.children || []).map(collectVisibleText).filter(Boolean);
        if (kids.length >= 2) {
          title = kids[0];
          description = kids.slice(1).join(" ").trim();
        } else if (kids.length === 1) {
          title = kids[0];
        }
      }

      if (!title && item.querySelector) {
        const titleEl = item.querySelector(".mode-title, .label, .title, [class*='title']");
        const descEl = item.querySelector(".description, .subtitle, .secondary-text, .sublabel, .caption, [class*='desc'], [class*='subtitle'], [class*='sublabel']");
        title = titleEl ? collectVisibleText(titleEl) : "";
        description = descEl ? collectVisibleText(descEl) : "";
      }

      if (!title) {
        const lines = String(item.textContent || "")
          .split(/\r?\n/)
          .map(normWs)
          .filter(Boolean);
        title = lines[0] || rawText;
        if (!description && lines.length > 1) {
          description = lines.slice(1).join(" ").trim();
        }
      }

      if (!description && title && rawText.length > title.length && rawText.toLowerCase().startsWith(title.toLowerCase())) {
        description = rawText.slice(title.length).trim();
      }

      const titleHasModel = modelNameHintRegex.test(title);
      const descHasModel = modelNameHintRegex.test(description);
      const exactName = (!titleHasModel && descHasModel && description)
        ? description
        : (title || rawText);

      const lowerFull = `${exactName} ${title} ${description} ${rawText}`.toLowerCase();
      const lowerTitle = String(exactName || "").toLowerCase();
      const tidLower = tid.toLowerCase();

      const hasLockIcon = (() => {
        if (item.querySelector && item.querySelector('mat-icon[fonticon="lock"], mat-icon[data-mat-icon-name="lock"], mat-icon[fonticon="lock_outline"], .lock-icon')) {
          return true;
        }
        const icons = item.querySelectorAll ? Array.from(item.querySelectorAll("mat-icon")) : [];
        return icons.some(ic => /^(lock|lock_outline)$/i.test(normWs(ic.textContent || "")));
      })();

      const isUpsellTestId = lockedTestIdSubstrings.some(sub => tidLower.includes(sub));
      const isUpgradeTitle = ignoreTitlePatterns.some(pat => lowerTitle.includes(pat));
      const isDisabledAttr = item.disabled === true ||
        (item.getAttribute && item.getAttribute("aria-disabled") === "true") ||
        (item.hasAttribute && item.hasAttribute("disabled"));
      const locked = Boolean(isUpsellTestId || isUpgradeTitle || isDisabledAttr || hasLockIcon);
      const lockReason = isUpsellTestId || isUpgradeTitle ? "upsell" : (hasLockIcon ? "lock_icon" : (isDisabledAttr ? "disabled" : null));

      const isAuto = autoPatterns.some(pat => matchesToken(lowerFull, pat)) || tidLower.includes("auto");
      const selected = Boolean(
        (item.getAttribute && item.getAttribute("aria-checked") === "true") ||
        (item.classList && (item.classList.contains("selected") || item.classList.contains("is-selected") || item.classList.contains("active"))) ||
        (item.querySelector && item.querySelector(".selected, .is-selected, .active"))
      );

      let canonicalId = null;
      if (!isAuto) {
        const candidates = [];
        for (const [mId, mObj] of Object.entries(modelsMap)) {
          const pats = [mId, mObj.displayName, mObj.badgeLabel, ...(Array.isArray(mObj.domPatterns) ? mObj.domPatterns : [])].filter(Boolean);
          for (const pat of pats) {
            const p = String(pat).toLowerCase().trim();
            candidates.push({ id: mId, pat: p, weight: p.length + (p === mId ? 50 : 0) });
          }
        }
        candidates.sort((a, b) => b.weight - a.weight);
        for (const c of candidates) {
          if (matchesToken(`${lowerFull} ${tidLower}`, c.pat)) {
            canonicalId = c.id;
            break;
          }
        }
      }

      return {
        exactName,
        title,
        description,
        rawText,
        dataTestId: tid || null,
        canonicalId,
        isAuto,
        locked,
        lockReason,
        selected,
        feasible: !locked && !isAuto && Boolean(exactName)
      };
    };

    const resolveThinkingCanonicalId = text => {
      const low = String(text || "").toLowerCase();
      const matchers = [];
      for (const [tId, tObj] of Object.entries(thinkingMap)) {
        const pats = [tId, tObj.label, ...(Array.isArray(tObj.aliases) ? tObj.aliases : []), ...(Array.isArray(tObj.domPatterns) ? tObj.domPatterns : [])].filter(Boolean);
        for (const p of pats) {
          const lp = String(p).toLowerCase().trim();
          matchers.push({ id: tId, pat: lp, len: lp.length + (lp === tId ? 30 : 0) });
        }
      }
      matchers.sort((a, b) => b.len - a.len);
      for (const m of matchers) {
        if (low.includes(m.pat)) return m.id;
      }
      return null;
    };

    const findThinkingTrigger = () => {
      const byVal = document.querySelector(thinkingTriggerSelector);
      if (byVal) return byVal;
      const allGmi = Array.from(document.querySelectorAll("gem-menu-item"));
      return allGmi.find(el => el.getAttribute && el.getAttribute("aria-haspopup") === "true")
        || allGmi.find(el => /^(?:thinking level|mức độ suy luận)\b/i.test(normWs(el.textContent || "")))
        || null;
    };

    const collectThinkingItems = () => {
      const trig = findThinkingTrigger();
      const ctrlId = trig && trig.getAttribute ? trig.getAttribute("aria-controls") : null;
      if (ctrlId && typeof document.getElementById === "function") {
        const sub = document.getElementById(ctrlId);
        if (sub) {
          const items = Array.from(sub.querySelectorAll("gem-menu-item"));
          if (items.length >= 2) return items;
        }
      }
      const noAttr = Array.from(document.querySelectorAll("gem-menu-item:not([data-test-id]):not([value]):not([aria-controls])"))
        .filter(item => !(item.getAttribute && item.getAttribute("aria-haspopup") === "true"));
      if (noAttr.length >= 2) return noAttr;

      const allThinkWords = [];
      for (const [tId, tObj] of Object.entries(thinkingMap)) {
        allThinkWords.push(tId);
        if (tObj.label) allThinkWords.push(String(tObj.label).toLowerCase());
        for (const p of (tObj.domPatterns || [])) allThinkWords.push(String(p).toLowerCase());
      }
      return Array.from(document.querySelectorAll("gem-menu-item")).filter(item => {
        if (item.hasAttribute && (item.hasAttribute("data-test-id") || item.getAttribute("aria-haspopup") === "true" || item.getAttribute("value") === "thinking_level")) {
          return false;
        }
        const txt = normWs(item.textContent || "").toLowerCase();
        return allThinkWords.some(tok => tok && txt.includes(tok));
      });
    };

    const modeBtn = document.querySelector(menuButtonSelector);
    if (!modeBtn) {
      return {
        ok: false,
        error: "Mode switcher button not found on page",
        extractedAt: new Date().toISOString(),
        url: typeof location !== "undefined" ? String(location.href || "") : "",
        currentModel: null,
        feasibleModelNames: [],
        feasibleCanonicalIds: [],
        feasibleModels: [],
        excludedModels: [],
        allModels: [],
        thinkingLevels: []
      };
    }

    const activeLabelEl = modeBtn.querySelector ? modeBtn.querySelector(".mode-title, .logo-pill-label-container span:not([data-sg-periodic-label='true'])") : null;
    const currentModel = normWs((activeLabelEl && !activeLabelEl.hasAttribute("data-sg-periodic-label") ? activeLabelEl.textContent : "") || collectVisibleText(modeBtn)) || null;

    const trigger = (modeBtn.querySelector && (modeBtn.querySelector("button.input-area-switch") || modeBtn.querySelector("button"))) || modeBtn;
    const wasMenuOpen = document.querySelectorAll(optionSelector).length > 0;
    const addedHideClass = Boolean(!wasMenuOpen && document.body && !document.body.classList.contains("sg-hiding-mode-menu"));
    if (addedHideClass && document.body) {
      document.body.classList.add("sg-hiding-mode-menu");
    }

    let allModels = [];
    let thinkingLevels = [];

    try {
      if (!wasMenuOpen && typeof trigger.click === "function") {
        trigger.click();
        const deadline = Date.now() + 1200;
        while (Date.now() < deadline) {
          if (document.querySelectorAll(optionSelector).length > 0) break;
          await sleepMs(30);
        }
      }

      const optEls = Array.from(document.querySelectorAll(optionSelector));
      const candidateSet = new Set(optEls);
      optEls.forEach(opt => {
        const menu = typeof opt.closest === "function" ? opt.closest("gem-menu") : null;
        if (!menu || !menu.querySelectorAll) return;
        Array.from(menu.querySelectorAll("gem-menu-item")).forEach(mi => {
          const val = mi.getAttribute ? mi.getAttribute("value") : "";
          const hasPop = mi.getAttribute ? mi.getAttribute("aria-haspopup") : "";
          if (val === "thinking_level" || hasPop === "true") return;
          if (mi.querySelector && mi.querySelector('mat-icon[data-mat-icon-name="arrow_right"], mat-icon[fonticon="arrow_right"]')) return;
          candidateSet.add(mi);
        });
      });

      const seenKeys = new Set();
      for (const el of candidateSet) {
        const meta = extractOptionMeta(el);
        const dedupKey = meta.dataTestId || `${meta.exactName.toLowerCase()}::${meta.rawText.toLowerCase()}`;
        if (!meta.rawText && !meta.exactName) continue;
        if (seenKeys.has(dedupKey)) continue;
        seenKeys.add(dedupKey);
        allModels.push(meta);
      }

      if (probeThinkingLevels) {
        let levelItems = collectThinkingItems();
        if (levelItems.length < 2) {
          const thinkTrig = findThinkingTrigger();
          if (thinkTrig) {
            try {
              if (typeof MouseEvent === "function" && typeof thinkTrig.dispatchEvent === "function") {
                thinkTrig.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
                thinkTrig.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
              }
              if (typeof thinkTrig.click === "function") thinkTrig.click();
            } catch (_e) {}
            const subDeadline = Date.now() + 450;
            while (Date.now() < subDeadline) {
              levelItems = collectThinkingItems();
              if (levelItems.length >= 2) break;
              await sleepMs(30);
            }
          }
        }

        const seenLevels = new Set();
        thinkingLevels = levelItems.map(li => {
          const titleNode = li.querySelector ? (li.querySelector(".label") || li.querySelector(".mode-title")) : null;
          const exactName = collectVisibleText(titleNode || li) || normWs(li.textContent || "");
          const rawText = collectVisibleText(li) || normWs(li.textContent || "");
          const disabled = Boolean(
            li.disabled === true ||
            (li.getAttribute && li.getAttribute("aria-disabled") === "true") ||
            (li.hasAttribute && li.hasAttribute("disabled"))
          );
          const selected = Boolean(
            (li.getAttribute && li.getAttribute("aria-checked") === "true") ||
            (li.classList && (li.classList.contains("selected") || li.classList.contains("active"))) ||
            (li.querySelector && li.querySelector(".selected, .active"))
          );
          return {
            exactName,
            rawText,
            canonicalId: resolveThinkingCanonicalId(`${exactName} ${rawText}`),
            selected,
            disabled
          };
        }).filter(l => {
          if (!l.exactName) return false;
          const key = l.exactName.toLowerCase();
          if (seenLevels.has(key)) return false;
          seenLevels.add(key);
          return true;
        });
      }
    } finally {
      if (!wasMenuOpen) {
        try {
          if (typeof KeyboardEvent === "function") {
            const esc = new KeyboardEvent("keydown", { key: "Escape", code: "Escape", keyCode: 27, bubbles: true, cancelable: true });
            if (typeof document.dispatchEvent === "function") document.dispatchEvent(esc);
          }
          const backdrop = document.querySelector(".cdk-overlay-backdrop");
          if (backdrop && typeof backdrop.click === "function") {
            backdrop.click();
          } else if (document.body && typeof document.body.click === "function") {
            document.body.click();
          }
          if (document.querySelectorAll(optionSelector).length > 0 && typeof trigger.click === "function") {
            trigger.click();
            await sleepMs(40);
          }
        } catch (_e) {}
      }
      if (addedHideClass && document.body) {
        document.body.classList.remove("sg-hiding-mode-menu");
      }
    }

    const feasibleModels = allModels.filter(m => m.feasible);
    const excludedModels = allModels.filter(m => !m.feasible);
    const feasibleCanonicalIds = [];
    const seenCanon = new Set();
    for (const m of feasibleModels) {
      if (m.canonicalId && !seenCanon.has(m.canonicalId)) {
        seenCanon.add(m.canonicalId);
        feasibleCanonicalIds.push(m.canonicalId);
      }
    }

    return {
      ok: allModels.length > 0,
      extractedAt: new Date().toISOString(),
      url: typeof location !== "undefined" ? String(location.href || "") : "",
      currentModel,
      feasibleModelNames: feasibleModels.map(m => m.exactName),
      feasibleCanonicalIds,
      feasibleModels,
      excludedModels,
      allModels,
      thinkingLevels
    };
  }

  function decodeHtmlEntities(str) {
    return String(str || "")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, "\"")
      .replace(/&#39;|&#x27;/gi, "'")
      .replace(/&#(\d+);/g, (_m, dec) => String.fromCharCode(Number(dec) || 32))
      .replace(/&#x([0-9a-f]+);/gi, (_m, hex) => String.fromCharCode(parseInt(hex, 16) || 32));
  }

  function stripHtmlToText(html) {
    return decodeHtmlEntities(
      String(html || "")
        .replace(/<mat-icon\b[^>]*>[\s\S]*?<\/mat-icon>/gi, " ")
        .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, " ")
        .replace(/<[^>]+>/g, " ")
    ).replace(/\s+/g, " ").trim();
  }

  function extractAttr(openTag, attrName) {
    const escaped = attrName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const m = openTag.match(new RegExp(`(?:^|\\s)${escaped}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
    if (!m) return null;
    return decodeHtmlEntities(m[1] !== undefined ? m[1] : (m[2] !== undefined ? m[2] : m[3]));
  }

  function extractBalancedTagBlocks(html, tagName) {
    const blocks = [];
    const tagRe = new RegExp(`<(\\/)?${tagName}(?=[\\s>])[^>]*>`, "gi");
    let match;
    let openStart = -1;
    let openEnd = -1;
    let openTag = "";
    let depth = 0;

    while ((match = tagRe.exec(html)) !== null) {
      const isClose = Boolean(match[1]);
      if (!isClose) {
        if (depth === 0) {
          openStart = match.index;
          openEnd = tagRe.lastIndex;
          openTag = match[0];
        }
        depth++;
      } else if (depth > 0) {
        depth--;
        if (depth === 0) {
          blocks.push({
            openTag,
            innerHtml: html.slice(openEnd, match.index),
            outerHtml: html.slice(openStart, tagRe.lastIndex)
          });
          openStart = -1;
        }
      }
    }
    return blocks;
  }

  function extractFirstClassText(innerHtml, classNames) {
    for (const cls of classNames) {
      const openRe = new RegExp(`<([a-z0-9-]+)\\b[^>]*class\\s*=\\s*["'][^"']*\\b${cls}\\b[^"']*["'][^>]*>`, "i");
      const m = innerHtml.match(openRe);
      if (!m) continue;
      const tag = m[1];
      const start = m.index + m[0].length;
      const tagRe = new RegExp(`<(\\/)?${tag}(?=[\\s>])[^>]*>`, "gi");
      tagRe.lastIndex = start;
      let depth = 1;
      let next;
      let endIdx = innerHtml.length;
      while ((next = tagRe.exec(innerHtml)) !== null) {
        if (next[1]) {
          depth--;
          if (depth === 0) {
            endIdx = next.index;
            break;
          }
        } else {
          depth++;
        }
      }
      const text = stripHtmlToText(innerHtml.slice(start, endIdx));
      if (text) return text;
    }
    return "";
  }

  function extractModelsFromHtml(htmlString, config) {
    const routingApi = root.SGModelRouting || (typeof require === "function" ? require("./model-routing.js") : null);
    const cfg = config && config.models ? config : (routingApi ? routingApi.DEFAULT_CONFIG : {});
    const ext = cfg.extractor || {};
    const autoPatterns = Array.isArray(ext.autoPatterns) ? ext.autoPatterns.map(p => p.toLowerCase()) : ["tự động", "automatic", "auto"];
    const lockedSubs = Array.isArray(ext.lockedTestIdSubstrings) ? ext.lockedTestIdSubstrings.map(p => p.toLowerCase()) : ["upsell"];
    const ignoreTitles = Array.isArray(ext.ignoreTitlePatterns) ? ext.ignoreTitlePatterns.map(p => p.toLowerCase()) : ["upgrade", "nâng cấp"];

    const html = String(htmlString || "");
    const blocks = [
      ...extractBalancedTagBlocks(html, "button"),
      ...extractBalancedTagBlocks(html, "gem-menu-item"),
      ...extractBalancedTagBlocks(html, "a")
    ];

    const matchesToken = (txt, pat) => {
      const p = String(pat || "").toLowerCase().trim();
      if (!p || !txt) return false;
      if (p === "pro") return /\bpro\b/.test(txt);
      if (p === "flash") return /\bflash\b(?!\s*-?\s*lite)/.test(txt);
      if (p === "auto") return /\bauto\b/.test(txt);
      return txt.includes(p);
    };

    const nameHintRe = /\b(hydrogen|neon|carbon|argon|flash-lite|flash lite|flash|fast|thinking|pro|deep think|3\.1|4\s+[a-z]+)\b/i;
    const allModels = [];
    const seenKeys = new Set();

    let currentModel = null;
    const modeBtnBlocks = blocks.filter(b => (extractAttr(b.openTag, "data-test-id") || "") === "bard-mode-menu-button");
    if (modeBtnBlocks.length > 0) {
      currentModel = extractFirstClassText(modeBtnBlocks[0].innerHtml, ["mode-title", "logo-pill-label-container"]) || stripHtmlToText(modeBtnBlocks[0].innerHtml) || null;
    }

    for (const blk of blocks) {
      const tid = extractAttr(blk.openTag, "data-test-id") || "";
      if (!tid.startsWith("bard-mode-option-")) continue;

      const labelBlock = extractFirstClassText(blk.innerHtml, ["label-container"]);
      const titleFromCls = extractFirstClassText(blk.innerHtml, ["mode-title", "label", "title"]);
      const descFromCls = extractFirstClassText(blk.innerHtml, ["description", "subtitle", "secondary-text", "sublabel", "caption"]);
      const rawText = stripHtmlToText(blk.innerHtml);

      let title = titleFromCls || labelBlock || rawText;
      let description = descFromCls || "";
      if (!description && title && rawText.length > title.length && rawText.toLowerCase().startsWith(title.toLowerCase())) {
        description = rawText.slice(title.length).trim();
      }
      const exactName = (!nameHintRe.test(title) && nameHintRe.test(description) && description)
        ? description
        : (title || rawText);

      const lowerFull = `${exactName} ${title} ${description} ${rawText}`.toLowerCase();
      const lowerTitle = exactName.toLowerCase();
      const tidLower = tid.toLowerCase();
      const clsStr = String(extractAttr(blk.openTag, "class") || "");

      const hasLockMarkup = /fonticon\s*=\s*["']lock(?:_outline)?["']|data-mat-icon-name\s*=\s*["']lock(?:_outline)?["']|lock-icon|<mat-icon\b[^>]*>\s*lock(?:_outline)?\s*<\/mat-icon>/i.test(blk.innerHtml);
      const isDisabled = /\bdisabled\b/i.test(blk.openTag) || extractAttr(blk.openTag, "aria-disabled") === "true";
      const isUpsell = lockedSubs.some(s => tidLower.includes(s)) || ignoreTitles.some(p => lowerTitle.includes(p));
      const locked = Boolean(hasLockMarkup || isDisabled || isUpsell);
      const lockReason = isUpsell ? "upsell" : (hasLockMarkup ? "lock_icon" : (isDisabled ? "disabled" : null));

      const isAuto = autoPatterns.some(pat => matchesToken(lowerFull, pat)) || tidLower.includes("auto");
      const selected = extractAttr(blk.openTag, "aria-checked") === "true" || /\b(?:selected|is-selected|active)\b/.test(clsStr);

      let canonicalId = null;
      if (!isAuto && routingApi && typeof routingApi.normalizeModelId === "function") {
        canonicalId = routingApi.normalizeModelId(`${exactName} ${rawText} ${tid}`, cfg);
      }

      const key = tid || exactName.toLowerCase();
      if (!exactName || seenKeys.has(key)) continue;
      seenKeys.add(key);

      allModels.push({
        exactName,
        title,
        description,
        rawText,
        dataTestId: tid || null,
        canonicalId,
        isAuto,
        locked,
        lockReason,
        selected,
        feasible: !locked && !isAuto && Boolean(exactName)
      });
    }

    // Extract thinking levels from <gem-menu-item> nodes
    const thinkingLevels = [];
    const seenLevels = new Set();
    const gmiBlocks = blocks.filter(b => b.openTag.toLowerCase().startsWith("<gem-menu-item"));
    for (const blk of gmiBlocks) {
      const tid = extractAttr(blk.openTag, "data-test-id") || "";
      const val = extractAttr(blk.openTag, "value") || "";
      const hasPop = extractAttr(blk.openTag, "aria-haspopup") || "";
      if (tid.startsWith("bard-mode-option-") || val === "thinking_level" || hasPop === "true") continue;

      const labelText = extractFirstClassText(blk.innerHtml, ["label", "mode-title"]) || stripHtmlToText(blk.innerHtml);
      const rawText = stripHtmlToText(blk.innerHtml);
      if (!labelText) continue;

      const low = rawText.toLowerCase();
      const allThinkWords = ["minimal", "low", "medium", "high", "extra", "max", "standard", "extended", "tối thiểu", "thấp", "trung bình", "vừa", "cao", "rất cao", "tối đa", "tiêu chuẩn", "mở rộng"];
      if (!allThinkWords.some(w => low.includes(w))) continue;

      const canonicalId = routingApi && typeof routingApi.normalizeThinkingLevel === "function"
        ? routingApi.normalizeThinkingLevel(rawText, cfg)
        : null;
      const clsStr = String(extractAttr(blk.openTag, "class") || "");
      const key = labelText.toLowerCase();
      if (seenLevels.has(key)) continue;
      seenLevels.add(key);

      thinkingLevels.push({
        exactName: labelText,
        rawText,
        canonicalId,
        selected: extractAttr(blk.openTag, "aria-checked") === "true" || /\b(?:selected|active)\b/.test(clsStr),
        disabled: /\bdisabled\b/i.test(blk.openTag) || extractAttr(blk.openTag, "aria-disabled") === "true"
      });
    }

    const feasibleModels = allModels.filter(m => m.feasible);
    const excludedModels = allModels.filter(m => !m.feasible);
    const feasibleCanonicalIds = [];
    const seenCanon = new Set();
    for (const m of feasibleModels) {
      if (m.canonicalId && !seenCanon.has(m.canonicalId)) {
        seenCanon.add(m.canonicalId);
        feasibleCanonicalIds.push(m.canonicalId);
      }
    }

    return {
      ok: allModels.length > 0,
      extractedAt: new Date().toISOString(),
      url: "offline://html-fixture",
      currentModel,
      feasibleModelNames: feasibleModels.map(m => m.exactName),
      feasibleCanonicalIds,
      feasibleModels,
      excludedModels,
      allModels,
      thinkingLevels
    };
  }

  function buildExtractorArgs(config) {
    const routingApi = root.SGModelRouting || (typeof require === "function" ? require("./model-routing.js") : null);
    const cfg = config && config.models ? config : (routingApi ? routingApi.DEFAULT_CONFIG : {});
    const ext = cfg.extractor || {};

    const slimModels = {};
    for (const [id, m] of Object.entries(cfg.models || {})) {
      slimModels[id] = {
        displayName: m.displayName,
        badgeLabel: m.badgeLabel,
        domPatterns: Array.isArray(m.domPatterns) ? m.domPatterns.slice() : [id]
      };
    }
    const slimThinking = {};
    for (const [id, t] of Object.entries(cfg.thinkingLevels || {})) {
      slimThinking[id] = {
        label: t.label,
        aliases: Array.isArray(t.aliases) ? t.aliases.slice() : [],
        domPatterns: Array.isArray(t.domPatterns) ? t.domPatterns.slice() : [id]
      };
    }

    return {
      menuButtonSelector: ext.menuButtonSelector || '[data-test-id="bard-mode-menu-button"]',
      optionSelector: ext.optionSelector || '[data-test-id^="bard-mode-option-"]',
      thinkingTriggerSelector: ext.thinkingTriggerSelector || 'gem-menu-item[value="thinking_level"]',
      autoPatterns: Array.isArray(ext.autoPatterns) ? ext.autoPatterns.slice() : ["tự động", "automatic", "auto"],
      lockedTestIdSubstrings: Array.isArray(ext.lockedTestIdSubstrings) ? ext.lockedTestIdSubstrings.slice() : ["upsell"],
      ignoreTitlePatterns: Array.isArray(ext.ignoreTitlePatterns) ? ext.ignoreTitlePatterns.slice() : ["upgrade", "nâng cấp"],
      models: slimModels,
      thinkingLevels: slimThinking,
      probeThinkingLevels: true
    };
  }

  function buildBrowserConsoleSnippet(config) {
    const argsJson = JSON.stringify(buildExtractorArgs(config));
    const fnSource = sgExtractFeasibleModelsInTab.toString();
    return [
      "(async () => {",
      `  const sgExtractFeasibleModelsInTab = ${fnSource};`,
      `  const result = await sgExtractFeasibleModelsInTab(${argsJson});`,
      "  console.log('[SG Model Extractor] Feasible Model Names:', result.feasibleModelNames);",
      "  if (result.feasibleModels.length && typeof console.table === 'function') {",
      "    console.table(result.feasibleModels.map(m => ({ exactName: m.exactName, canonicalId: m.canonicalId, dataTestId: m.dataTestId, selected: m.selected })));",
      "  }",
      "  console.log(JSON.stringify(result, null, 2));",
      "  if (typeof copy === 'function') { copy(result); console.info('[SG Model Extractor] JSON copied to clipboard.'); }",
      "  return result;",
      "})();"
    ].join("\n");
  }

  function evaluateConfigFeasibility(config, extractedReport, routingApiOverride) {
    const routingApi = routingApiOverride || root.SGModelRouting || (typeof require === "function" ? require("./model-routing.js") : null);
    if (!routingApi || !extractedReport) {
      return { ok: false, unmappedFeasibleNames: [], tasks: [] };
    }
    const cfg = config && config.tasks ? config : routingApi.DEFAULT_CONFIG;
    const feasibleList = Array.isArray(extractedReport.feasibleModels) ? extractedReport.feasibleModels : [];

    const tasks = [];
    const optLevels = cfg.tasks?.optimize?.levels || {};
    for (const lvKey of Object.keys(optLevels)) {
      const prof = routingApi.resolveOptimizeProfile(lvKey, cfg, { feasibleModels: feasibleList });
      tasks.push({
        taskId: `optimize.${lvKey}`,
        configuredModel: prof.requestedModel,
        resolvedModel: prof.model,
        thinkingLevel: prof.thinkingLevel,
        fallbackUsed: prof.fallbackUsed,
        exactDomMatches: feasibleList.filter(m => m.canonicalId === prof.model).map(m => m.exactName)
      });
    }

    const gProf = routingApi.resolveGrammarProfile(cfg, { feasibleModels: feasibleList });
    tasks.push({
      taskId: "grammar",
      configuredModel: gProf.requestedModel,
      resolvedModel: gProf.model,
      thinkingLevel: gProf.thinkingLevel,
      fallbackUsed: gProf.fallbackUsed,
      exactDomMatches: feasibleList.filter(m => m.canonicalId === gProf.model).map(m => m.exactName)
    });

    if (typeof routingApi.resolveCheckpointProfile === "function") {
      const cpProf = routingApi.resolveCheckpointProfile(cfg, { feasibleModels: feasibleList });
      tasks.push({
        taskId: "checkpoint",
        configuredModel: cpProf.requestedModel,
        resolvedModel: cpProf.model,
        thinkingLevel: cpProf.thinkingLevel,
        fallbackUsed: cpProf.fallbackUsed,
        exactDomMatches: feasibleList.filter(m => m.canonicalId === cpProf.model).map(m => m.exactName)
      });
    }

    const pProf = routingApi.resolveOrchestratePlannerProfile(cfg, { feasibleModels: feasibleList });
    tasks.push({
      taskId: "orchestrate.planner.clean1Turn",
      configuredModel: pProf.requestedModel,
      resolvedModel: pProf.model,
      thinkingLevel: pProf.thinkingLevel,
      fallbackUsed: pProf.fallbackUsed,
      exactDomMatches: feasibleList.filter(m => m.canonicalId === pProf.model).map(m => m.exactName)
    });

    const qsProf = routingApi.resolveOrchestrateSubAgentProfile(null, null, "quota_saver", cfg, { feasibleModels: feasibleList });
    tasks.push({
      taskId: "orchestrate.policies.quota_saver",
      configuredModel: qsProf.requestedModel,
      resolvedModel: qsProf.model,
      thinkingLevel: qsProf.thinkingLevel,
      fallbackUsed: qsProf.fallbackUsed,
      exactDomMatches: feasibleList.filter(m => m.canonicalId === qsProf.model).map(m => m.exactName)
    });

    const adModels = cfg.tasks?.orchestrate?.policies?.adaptive?.allowedModels || [];
    for (const mId of adModels) {
      const adProf = routingApi.resolveOrchestrateSubAgentProfile(mId, cfg.tasks.orchestrate.policies.adaptive.defaultThinkingLevel, "adaptive", cfg, { feasibleModels: feasibleList });
      tasks.push({
        taskId: `orchestrate.adaptive.${mId}`,
        configuredModel: mId,
        resolvedModel: adProf.model,
        thinkingLevel: adProf.thinkingLevel,
        fallbackUsed: adProf.fallbackUsed,
        exactDomMatches: feasibleList.filter(m => m.canonicalId === adProf.model).map(m => m.exactName)
      });
    }

    const unmappedFeasibleNames = feasibleList
      .filter(m => !m.canonicalId)
      .map(m => m.exactName);

    return {
      ok: Boolean(extractedReport.ok) && tasks.every(t => t.exactDomMatches.length > 0),
      unmappedFeasibleNames,
      tasks
    };
  }

  const api = {
    sgExtractFeasibleModelsInTab,
    extractModelsFromHtml,
    buildExtractorArgs,
    buildBrowserConsoleSnippet,
    evaluateConfigFeasibility
  };

  if (typeof module === "object" && module && module.exports) {
    module.exports = api;
  }
  if (root && typeof root === "object") {
    root.SGModelExtractor = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : (typeof self !== "undefined" ? self : this));
