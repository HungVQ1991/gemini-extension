let messageQueue = [],
  isCurrentlyGenerating = !1,
  queueDisplayElement = null,
  isQueueingEnabled = !0,
  isQueueDisplayVisible = !0,
  isSendingFromQueue = !1,
  queueCompletionChecks = 0;
const QUEUE_ESC_HOLD_MS = 1e3;
let queueEscActive = !1,
  queueEscTimer = null;
const QUEUE_STOP_ICON_SELECTOR = '[fonticon="stop"]',
  QUEUE_INPUT_SELECTOR = "div.ql-editor, textarea.mat-mdc-input-element, rich-textarea .ql-editor",
  QUEUE_SEND_BUTTON_SELECTOR = [".send-button-container button", ".send-button button", 'button:has(mat-icon[fonticon="arrow_upward"])', 'button:has(mat-icon[fonticon="send"])', 'button[data-testid="send_button"]', 'button[aria-label*="Send"]', 'button[aria-label*="send"]', 'button[aria-label="Send message"]'].join(", ");
let storedQueues = {},
  lastQueueChatId = null,
  queueNavigationInterval = null;

function saveQueueToStorage() {
  try {
    const e = getCurrentChatId() || "default";
    storedQueues[e] = [...messageQueue];
    if ("undefined" != typeof sessionStorage) {
      sessionStorage.setItem("sg_stored_queues", JSON.stringify(storedQueues));
    }
  } catch (err) {}
}

function loadQueueFromStorage() {
  sgSyncGetCached(["queueingEnabled", "showQueueWindow"], e => {
    isQueueingEnabled = !1 !== e.queueingEnabled, isQueueDisplayVisible = !1 !== e.showQueueWindow;
    if ("undefined" != typeof sessionStorage) {
      try {
        const raw = sessionStorage.getItem("sg_stored_queues");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && "object" == typeof parsed && !Array.isArray(parsed)) {
            storedQueues = parsed;
            const c = getCurrentChatId() || "default";
            if (Array.isArray(storedQueues[c])) {
              messageQueue = [...storedQueues[c]];
            }
          }
        }
      } catch (err) {}
    }
    updateQueueDisplay();
  });
}

function deleteMessageFromQueue(e) {
  e > -1 && e < messageQueue.length && (messageQueue.splice(e, 1), saveQueueToStorage(), updateQueueDisplay())
}

function clearQueue() {
  0 !== messageQueue.length && (messageQueue = [], saveQueueToStorage(), updateQueueDisplay())
}

function isVisibleOverlayOpen() {
  const e = document.querySelectorAll('[role="menu"], [role="dialog"]');
  for (const t of e)
    if ("function" == typeof t.checkVisibility) {
      if (t.checkVisibility()) return !0
    } else if (t.getClientRects().length > 0) return !0;
  return !1
}

function handleQueueEscKeydown(e) {
  "Escape" !== e.key || e.repeat || queueEscActive || 0 !== messageQueue.length && queueDisplayElement && "none" !== queueDisplayElement.style.display && (slashMenuVisible || ("undefined" != typeof sgSkillMenuVisible && sgSkillMenuVisible) || isVisibleOverlayOpen() || (queueEscActive = !0, showQueueEscProgress(), queueEscTimer = setTimeout(() => {
    queueEscActive = !1, queueEscTimer = null, hideQueueEscProgress(), clearQueue(), showToast("Queue cleared", "info")
  }, 1e3)))
}

function handleQueueEscKeyup(e) {
  "Escape" === e.key && queueEscActive && cancelQueueEscHold()
}

function cancelQueueEscHold() {
  (queueEscActive || queueEscTimer) && (queueEscActive = !1, queueEscTimer && (clearTimeout(queueEscTimer), queueEscTimer = null), hideQueueEscProgress())
}

function showQueueEscProgress() {
  if (!queueDisplayElement) return;
  const e = queueDisplayElement.querySelector(".sg-queue-title");
  e && (e.textContent = "Clearing…");
  let t = queueDisplayElement.querySelector("#sg-queue-esc-progress");
  if (!t) {
    t = document.createElement("div"), t.id = "sg-queue-esc-progress", t.style.cssText = "\n      height: 3px;\n      width: 0%;\n      background-color: #ea4335;\n      border-radius: 2px;\n      margin: -6px 0 10px 0;\n    ";
    const e = queueDisplayElement.querySelector(".sg-queue-header");
    e && e.after(t)
  }
  t.style.transition = "none", t.style.width = "0%", t.offsetWidth, t.style.transition = "width 1000ms linear", t.style.width = "100%"
}

function hideQueueEscProgress() {
  if (!queueDisplayElement) return;
  const e = queueDisplayElement.querySelector("#sg-queue-esc-progress");
  e && (e.style.transition = "none", e.style.width = "0%");
  const t = queueDisplayElement.querySelector(".sg-queue-title");
  t && (t.textContent = "Message Queue")
}

function createQueueDisplay() {
  if (document.getElementById("sg-queue-display")) return;
  queueDisplayElement = document.createElement("div"), queueDisplayElement.id = "sg-queue-display",sgSetSafeHtml(queueDisplayElement, '\n    <div class="sg-queue-header">\n      <span class="sg-queue-icon"></span>\n      <span class="sg-queue-title">Message Queue</span>\n      <button class="sg-queue-clear-all" type="button" title="Delete all queued messages">Clear all</button>\n    </div>\n    <div id="sg-queue-list"></div>\n  '), queueDisplayElement.querySelector(".sg-queue-icon").appendChild(sgBuildQueueIcon("list", 16)), queueDisplayElement.style.cssText = `\n    position: fixed;\n    bottom: 20px;\n    right: 20px;\n    width: 300px;\n    background-color: ${isDarkTheme()?"#1e1f20":"#ffffff"};\n    border: 1px solid ${isDarkTheme()?"#3c4043":"#dadce0"};\n    border-radius: 12px;\n    padding: 16px;\n    z-index: 100;\n    box-shadow: 0 4px 12px rgba(0,0,0,0.15);\n    font-family: var(--sg-font-text);\n    color: ${isDarkTheme()?"#e3e3e3":"#3c4043"};\n    display: none;\n  `;
  queueDisplayElement.querySelector(".sg-queue-header").style.cssText = "\n    display: flex;\n    align-items: center;\n    gap: 8px;\n    margin-bottom: 12px;\n    font-size: 14px;\n    font-weight: 600;\n  ", queueDisplayElement.querySelector(".sg-queue-title").style.flexGrow = "1";
  const e = queueDisplayElement.querySelector(".sg-queue-clear-all");
  e.style.cssText = `\n    background: none;\n    border: none;\n    font-family: inherit;\n    font-size: 12px;\n    font-weight: 500;\n    color: ${isDarkTheme()?"#9aa0a6":"#80868b"};\n    cursor: pointer;\n    padding: 4px 8px;\n    border-radius: 8px;\n    transition: all 0.15s ease;\n    flex: none;\n  `, e.addEventListener("mouseenter", () => {
    e.style.backgroundColor = isDarkTheme() ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)", e.style.color = isDarkTheme() ? "#e3e3e3" : "#202124"
  }), e.addEventListener("mouseleave", () => {
    e.style.backgroundColor = "transparent", e.style.color = isDarkTheme() ? "#9aa0a6" : "#80868b"
  }), e.addEventListener("click", clearQueue), document.body.appendChild(queueDisplayElement)
}
const SG_QUEUE_ICON_SVGS = {
    bolt: "M11 21h-1l1-7H7.5c-.88 0-.33-.75-.31-.78C8.48 10.94 10.42 7.54 13.01 3h1l-1 7h3.51c.4 0 .62.19.42.66C12.97 17.55 11 21 11 21z",
    diamond: ["M6.2 4h11.6L22 10l-10 12L2 10l4.2-6zM8 6L5.2 10 12 19.4 18.8 10 16 6H8z", "M8.5 10L12 17l3.5-7h-7z"],
    science: "M19.8 18.4 14 10.67V6.5l1.35-1.69c.26-.33.03-.81-.39-.81H9.04c-.42 0-.65.48-.39.81L10 6.5v4.17L4.2 18.4c-.49.66-.02 1.6.8 1.6h14c.82 0 1.29-.94.8-1.6z"
  },
  SG_QUEUE_FONT_ICONS = {
    list: "format_list_bulleted",
    spark: "spark",
    close: "close"
  };

function sgBuildQueueIcon(e, t) {
  t = t || 14;
  const n = SG_QUEUE_FONT_ICONS[e];
  if (n) {
    const e = document.createElement("mat-icon");
    return e.setAttribute("fonticon", n), e.className = "mat-icon notranslate lumi-symbols mat-ligature-font mat-icon-no-color", e.style.cssText = `font-size:${t}px;width:${t}px;height:${t}px;line-height:${t}px;vertical-align:middle;display:inline-flex;align-items:center;justify-content:center;flex:none;`, e
  }
  const o = SG_QUEUE_ICON_SVGS[e];
  if (!o) return document.createTextNode("");
  const r = document.createElement("span");
  r.style.cssText = `display:inline-flex;width:${t}px;height:${t}px;vertical-align:middle;flex:none;`;
  const s = Array.isArray(o) ? o : [o];
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", String(t));
  svg.setAttribute("height", String(t));
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "currentColor");
  s.forEach(d => {
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", d);
    svg.appendChild(p);
  });
  r.appendChild(svg);
  return r;
}

function resolveQueueModeBadge(e) {
  if (!e) return null;
  const t = String(e).toLowerCase();
  return "fast" === t || "flash-lite" === t || "flashlite" === t || "h" === t || "hydrogen" === t ? {
    iconKind: "bolt",
    label: "h" === t || "hydrogen" === t ? "4 Hydrogen" : "Flash-Lite"
  } : "thinking" === t || "flash" === t || "ne" === t || "neon" === t || "ar" === t || "argon" === t ? {
    iconKind: "spark",
    label: "ne" === t || "neon" === t ? "4 Neon" : ("ar" === t || "argon" === t ? "4 Argon" : "Flash")
  } : "pro" === t || "c" === t || "carbon" === t ? {
    iconKind: "diamond",
    label: "c" === t || "carbon" === t ? "4 Carbon" : "Pro"
  } : null
}

function sgNormalizeQueueItem(raw) {
  if (typeof raw === "string") {
    return { text: raw, mode: null, periodicSymbol: null, thinkingLevel: null, skills: [] };
  }
  const obj = raw && typeof raw === "object" ? raw : {};
  const skills = Array.isArray(obj.skills)
    ? Array.from(new Set(obj.skills.map(s => String(s || "").trim()).filter(Boolean)))
    : [];
  return {
    text: String(obj.text || ""),
    mode: obj.mode ? String(obj.mode) : null,
    periodicSymbol: obj.periodicSymbol ? String(obj.periodicSymbol) : null,
    thinkingLevel: obj.thinkingLevel ? String(obj.thinkingLevel) : null,
    skills
  };
}

function sgGetQueueAvailableModels() {
  const options = [];
  if (typeof sgPeriodicGetAllReleasedElements === "function") {
    try {
      const released = sgPeriodicGetAllReleasedElements();
      for (const el of released || []) {
        if (!el || !el.symbol || el.locked) continue;
        options.push({
          key: `periodic:${el.symbol}`,
          periodicSymbol: el.symbol,
          mode: el.realMode || null,
          label: el.modelLabel || `${el.symbol} · ${el.name}`
        });
      }
    } catch (_e) {}
  }
  if (options.length === 0) {
    options.push(
      { key: "mode:fast", periodicSymbol: null, mode: "fast", label: "Flash-Lite (Fast)" },
      { key: "mode:thinking", periodicSymbol: null, mode: "thinking", label: "Flash (Thinking)" },
      { key: "mode:pro", periodicSymbol: null, mode: "pro", label: "Pro" }
    );
  }
  return options;
}

function sgGetQueueThinkingLevelsForModel(periodicSymbol) {
  if (periodicSymbol && typeof sgPeriodicGetThinkingLevels === "function") {
    try {
      const lvls = sgPeriodicGetThinkingLevels(periodicSymbol);
      if (Array.isArray(lvls) && lvls.length > 0) {
        return lvls.map(l => ({ value: l.value, label: l.label || l.value }));
      }
    } catch (_e) {}
  }
  return [
    { value: "low", label: "Low" },
    { value: "medium", label: "Medium" },
    { value: "high", label: "High" },
    { value: "extended", label: "Extended" }
  ];
}

function sgGetQueueAvailableSkills() {
  if (typeof sgEffectiveSkills === "undefined" || !Array.isArray(sgEffectiveSkills)) return [];
  const excluded = new Set(["acknowledgment", "orchestrate-mode"]);
  return sgEffectiveSkills
    .filter(s => s && s.id && s.enabled !== false && !excluded.has(String(s.id).toLowerCase()))
    .map(s => ({ id: s.id, name: s.name || s.id, aliases: Array.isArray(s.aliases) ? s.aliases : [] }));
}

function sgBuildQueueDispatchPrompt(rawText, skills) {
  const cleaned = String(rawText || "").replace(/^\[(PROMPT|CHAIN|QA):[^\]]+\]\s*/s, "");
  const skillList = Array.isArray(skills) ? skills.map(s => String(s || "").trim()).filter(Boolean) : [];
  if (skillList.length === 0) return cleaned;

  let overrideSplit = null;
  if (typeof sgParsePriorityOverride === "function") {
    const parsed = sgParsePriorityOverride(cleaned);
    if (parsed && parsed.hasOverride) {
      const markerIdx = Number.isInteger(parsed.markerIndex) ? parsed.markerIndex : cleaned.lastIndexOf("//->");
      if (markerIdx !== -1) {
        overrideSplit = {
          before: cleaned.slice(0, markerIdx),
          after: cleaned.slice(markerIdx + 4).trimStart()
        };
      }
    }
  } else {
    const markerIdx = cleaned.lastIndexOf("//->");
    if (markerIdx !== -1) {
      const afterCandidate = cleaned.slice(markerIdx + 4).trimStart();
      if (afterCandidate.length > 0) {
        overrideSplit = {
          before: cleaned.slice(0, markerIdx),
          after: afterCandidate
        };
      }
    }
  }

  const scopeText = overrideSplit ? overrideSplit.after : cleaned;
  const lowerScope = scopeText.toLowerCase();
  const available = sgGetQueueAvailableSkills();
  const byId = new Map(available.map(s => [s.id.toLowerCase(), s]));
  const missingTokens = [];

  for (const sid of skillList) {
    const sidLow = sid.toLowerCase();
    const meta = byId.get(sidLow);
    const hasId = new RegExp(`(?:^|\\s)@${sidLow.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\s|$)`, "i").test(scopeText);
    const hasAlias = Boolean(meta && meta.aliases.some(a => a && lowerScope.includes(String(a).toLowerCase())));
    if (!hasId && !hasAlias) {
      missingTokens.push(`@${sid}`);
    }
  }
  if (missingTokens.length === 0) return cleaned;
  if (overrideSplit) {
    return `${overrideSplit.before}//-> ${missingTokens.join(" ")} ${overrideSplit.after}`.trim();
  }
  return `${missingTokens.join(" ")} ${cleaned}`.trim();
}

function moveQueuedMessage(index, delta) {
  const target = index + delta;
  if (index < 0 || index >= messageQueue.length || target < 0 || target >= messageQueue.length) return;
  const item = messageQueue[index];
  messageQueue[index] = messageQueue[target];
  messageQueue[target] = item;
  saveQueueToStorage();
  updateQueueDisplay();
}

function updateQueueItemRoute(index, patch) {
  if (index < 0 || index >= messageQueue.length) return;
  const norm = sgNormalizeQueueItem(messageQueue[index]);
  messageQueue[index] = Object.assign({}, norm, patch || {});
  saveQueueToStorage();
  updateQueueDisplay();
}

function updateQueueDisplay() {
  queueDisplayElement || createQueueDisplay();
  const listEl = queueDisplayElement.querySelector("#sg-queue-list");
  if (!listEl) return;
  while (listEl.firstChild) listEl.removeChild(listEl.firstChild);

  if (!(messageQueue.length > 0 && isQueueingEnabled && isQueueDisplayVisible)) {
    queueDisplayElement.style.display = "none";
    return;
  }

  queueDisplayElement.style.display = "block";
  const modelOptions = sgGetQueueAvailableModels();
  const skillOptions = sgGetQueueAvailableSkills();

  messageQueue.forEach((rawItem, idx) => {
    const item = sgNormalizeQueueItem(rawItem);
    const card = document.createElement("div");
    card.className = `sg-queue-item-card${idx === 0 ? " sg-queue-item-next" : ""}`;

    const topRow = document.createElement("div");
    topRow.className = "sg-queue-item-top";

    const textWrap = document.createElement("span");
    textWrap.className = "sg-queue-item-text";

    const idxPill = document.createElement("span");
    idxPill.className = "sg-queue-idx";
    idxPill.textContent = `#${idx + 1}`;
    textWrap.appendChild(idxPill);

    const badge = resolveQueueModeBadge(item.periodicSymbol || item.mode);
    if (badge) {
      const iconHost = document.createElement("span");
      iconHost.className = "sg-queue-mode-icon";
      iconHost.title = `${badge.label}${item.thinkingLevel ? ` · ${item.thinkingLevel}` : ""}`;
      iconHost.appendChild(sgBuildQueueIcon(badge.iconKind, 13));
      textWrap.appendChild(iconHost);
    }

    const prefixMatch = item.text.match(/^\[(PROMPT|CHAIN|QA):([^\]]+)\]\s*(.*)/s);
    if (prefixMatch) {
      const kind = prefixMatch[1];
      const tag = prefixMatch[2];
      const bodyTxt = prefixMatch[3];
      const kindEl = document.createElement("strong");
      kindEl.textContent = `${kind}: `;
      kindEl.style.color = kind === "CHAIN" ? "#f4b400" : "#4285f4";
      const tagEl = document.createElement("span");
      tagEl.textContent = `${tag} `;
      tagEl.style.fontWeight = "500";
      const bodyEl = document.createElement("span");
      bodyEl.textContent = bodyTxt.length > 42 ? bodyTxt.slice(0, 42) + "..." : bodyTxt;
      bodyEl.style.opacity = "0.82";
      textWrap.appendChild(kindEl);
      textWrap.appendChild(tagEl);
      textWrap.appendChild(bodyEl);
      textWrap.title = bodyTxt;
    } else {
      const spanTxt = document.createElement("span");
      spanTxt.textContent = item.text.length > 56 ? item.text.slice(0, 56) + "..." : item.text;
      textWrap.appendChild(spanTxt);
      textWrap.title = item.text;
    }

    const controls = document.createElement("div");
    controls.className = "sg-queue-item-controls";

    const mkActionBtn = (txt, title, onClick, disabled = false) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "sg-queue-action-btn";
      b.textContent = txt;
      b.title = title;
      b.disabled = disabled;
      b.addEventListener("click", ev => {
        ev.preventDefault();
        ev.stopPropagation();
        onClick();
      });
      return b;
    };

    if (messageQueue.length > 1) {
      controls.appendChild(mkActionBtn("↑", "Move up", () => moveQueuedMessage(idx, -1), idx === 0));
      controls.appendChild(mkActionBtn("↓", "Move down", () => moveQueuedMessage(idx, 1), idx === messageQueue.length - 1));
    }
    controls.appendChild(mkActionBtn("×", "Delete this message", () => deleteMessageFromQueue(idx)));

    topRow.appendChild(textWrap);
    topRow.appendChild(controls);
    card.appendChild(topRow);

    const routeBar = document.createElement("div");
    routeBar.className = "sg-queue-route-bar";

    const modelSelect = document.createElement("select");
    modelSelect.className = "sg-queue-select";
    modelSelect.setAttribute("aria-label", `Model for queued task #${idx + 1}`);
    const defModelOpt = document.createElement("option");
    defModelOpt.value = "";
    defModelOpt.textContent = "Model: Current";
    modelSelect.appendChild(defModelOpt);

    const currentModelKey = item.periodicSymbol
      ? `periodic:${item.periodicSymbol}`
      : (item.mode ? `mode:${String(item.mode).toLowerCase()}` : "");

    for (const mOpt of modelOptions) {
      const oEl = document.createElement("option");
      oEl.value = mOpt.key;
      oEl.textContent = mOpt.label;
      if (mOpt.key === currentModelKey || (!item.periodicSymbol && item.mode && mOpt.mode === String(item.mode).toLowerCase())) {
        oEl.selected = true;
      }
      modelSelect.appendChild(oEl);
    }
    modelSelect.addEventListener("change", () => {
      const val = modelSelect.value;
      if (!val) {
        updateQueueItemRoute(idx, { periodicSymbol: null, mode: null });
        return;
      }
      if (val.startsWith("periodic:")) {
        const sym = val.slice("periodic:".length);
        const found = modelOptions.find(m => m.periodicSymbol === sym);
        updateQueueItemRoute(idx, { periodicSymbol: sym, mode: found ? found.mode : null });
      } else if (val.startsWith("mode:")) {
        updateQueueItemRoute(idx, { periodicSymbol: null, mode: val.slice("mode:".length) });
      }
    });
    routeBar.appendChild(modelSelect);

    const thinkSelect = document.createElement("select");
    thinkSelect.className = "sg-queue-select";
    thinkSelect.setAttribute("aria-label", `Thinking level for queued task #${idx + 1}`);
    const defThinkOpt = document.createElement("option");
    defThinkOpt.value = "";
    defThinkOpt.textContent = "Think: Auto";
    thinkSelect.appendChild(defThinkOpt);
    const tLevels = sgGetQueueThinkingLevelsForModel(item.periodicSymbol);
    for (const lv of tLevels) {
      const oEl = document.createElement("option");
      oEl.value = lv.value;
      oEl.textContent = lv.label;
      if (String(item.thinkingLevel || "").toLowerCase() === String(lv.value).toLowerCase()) {
        oEl.selected = true;
      }
      thinkSelect.appendChild(oEl);
    }
    thinkSelect.addEventListener("change", () => {
      updateQueueItemRoute(idx, { thinkingLevel: thinkSelect.value || null });
    });
    routeBar.appendChild(thinkSelect);

    if (skillOptions.length > 0) {
      const skillSelect = document.createElement("select");
      skillSelect.className = "sg-queue-select sg-queue-skill-select";
      skillSelect.setAttribute("aria-label", `Add skill to queued task #${idx + 1}`);
      const phOpt = document.createElement("option");
      phOpt.value = "";
      phOpt.textContent = "+ Skill";
      skillSelect.appendChild(phOpt);
      for (const sk of skillOptions) {
        if (item.skills.includes(sk.id)) continue;
        const oEl = document.createElement("option");
        oEl.value = sk.id;
        oEl.textContent = `@${sk.id}`;
        skillSelect.appendChild(oEl);
      }
      skillSelect.addEventListener("change", () => {
        const picked = skillSelect.value;
        if (!picked) return;
        const nextSkills = item.skills.includes(picked) ? item.skills : [...item.skills, picked];
        updateQueueItemRoute(idx, { skills: nextSkills });
      });
      routeBar.appendChild(skillSelect);
    }

    card.appendChild(routeBar);

    if (item.skills.length > 0) {
      const skillsRow = document.createElement("div");
      skillsRow.className = "sg-queue-skills-row";
      for (const sid of item.skills) {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "sg-queue-skill-chip";
        chip.title = `Remove @${sid}`;
        chip.textContent = `@${sid} ×`;
        chip.addEventListener("click", ev => {
          ev.preventDefault();
          ev.stopPropagation();
          updateQueueItemRoute(idx, { skills: item.skills.filter(s => s !== sid) });
        });
        skillsRow.appendChild(chip);
      }
      card.appendChild(skillsRow);
    }

    listEl.appendChild(card);
  });
}

function tryEnqueueMessage(e) {
  return messageQueue.push(sgNormalizeQueueItem(e)), saveQueueToStorage(), updateQueueDisplay(), !0
}

let _sgQueueNativeAtSessionActive = false;

function sgQueueIsPopupElVisible(el) {
  if (!el || el.isConnected === false) return false;
  if (el.hidden) return false;
  if (typeof el.getAttribute === "function" && el.getAttribute("aria-hidden") === "true") return false;
  if (el.style && (el.style.display === "none" || el.style.visibility === "hidden")) return false;
  if (typeof window !== "undefined" && typeof window.getComputedStyle === "function") {
    try {
      const style = window.getComputedStyle(el);
      if (style && (style.display === "none" || style.visibility === "hidden" || parseFloat(style.opacity) === 0)) {
        return false;
      }
    } catch (_e) {}
  }
  if (typeof el.getBoundingClientRect === "function") {
    try {
      const rect = el.getBoundingClientRect();
      if (rect && (rect.width <= 0 || rect.height <= 0)) return false;
    } catch (_e) {}
  }
  return true;
}

function sgQueueIsNativeAutocompleteOpen(composer) {
  if (typeof document === "undefined") return false;
  if (composer && typeof composer.getAttribute === "function") {
    if (composer.getAttribute("aria-expanded") === "true") return true;
    const activeDesc = composer.getAttribute("aria-activedescendant");
    if (activeDesc) {
      const descEl = typeof document.getElementById === "function" ? document.getElementById(activeDesc) : null;
      if (!descEl || sgQueueIsPopupElVisible(descEl)) return true;
    }
  }
  if (typeof document.querySelectorAll !== "function") return false;

  const panes = document.querySelectorAll(".cdk-overlay-pane");
  for (const pane of panes) {
    if (!sgQueueIsPopupElVisible(pane)) continue;
    if (pane.classList && typeof pane.classList.contains === "function" && pane.classList.contains("mat-mdc-tooltip-panel")) {
      continue;
    }
    const isTooltipOnly = Boolean(
      typeof pane.querySelector === "function" &&
      pane.querySelector('.mat-mdc-tooltip, mat-tooltip-component, [role="tooltip"]') &&
      !pane.querySelector('[role="listbox"], [role="menu"], [role="option"], [role="menuitem"], mat-option, .mat-mdc-option')
    );
    if (isTooltipOnly) continue;
    if (
      typeof pane.querySelector !== "function" ||
      pane.querySelector('[role="listbox"], [role="menu"], [role="option"], [role="menuitem"], mat-option, .mat-mdc-option, .mat-mdc-autocomplete-panel, .mat-autocomplete-panel, .mat-mdc-menu-panel, mat-menu-panel, gem-menu-item, button, li, [class*="mention"], [class*="autocomplete"], [class*="suggestion"]')
    ) {
      return true;
    }
  }

  const inlineMenus = document.querySelectorAll(
    '[role="listbox"]:not(#sg-skill-autocomplete):not(#sg-slash-menu), .mat-mdc-autocomplete-panel, .mat-autocomplete-panel, at-mentions-menu, mention-menu, skills-menu, extensions-menu, [class*="mention-menu"], [class*="mentions-menu"], [class*="at-mention"], [class*="autocomplete-panel"], [class*="suggestion-menu"], [class*="typeahead"]'
  );
  for (const menu of inlineMenus) {
    if (sgQueueIsPopupElVisible(menu)) return true;
  }
  return false;
}

function sgQueueGetActiveAtToken(inputEl) {
  let textBefore = null;
  if (inputEl && (inputEl.tagName === "TEXTAREA" || inputEl.tagName === "INPUT")) {
    const end = typeof inputEl.selectionStart === "number" ? inputEl.selectionStart : (inputEl.value || "").length;
    textBefore = String(inputEl.value || "").slice(Math.max(0, end - 128), end);
  } else if (inputEl && typeof window !== "undefined" && typeof window.getSelection === "function") {
    try {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        if (range && range.endContainer && range.endContainer.nodeType === 3 && (typeof inputEl.contains !== "function" || inputEl.contains(range.endContainer))) {
          const nodeText = String(range.endContainer.nodeValue || "").slice(0, range.endOffset);
          if (nodeText.length === 0 || /[\s>@]/.test(nodeText)) {
            textBefore = nodeText;
          }
        }
      }
    } catch (_e) {}
  }
  if (textBefore === null && typeof sgGetCaretTextBeforeCursor === "function") {
    const caret = sgGetCaretTextBeforeCursor(inputEl);
    if (caret && typeof caret.textBefore === "string") {
      textBefore = caret.textBefore;
    }
  }
  if (textBefore === null && inputEl) {
    textBefore = String(extractInputText(inputEl) || "");
  }
  if (typeof textBefore !== "string") return null;
  const m = textBefore.match(/(?:^|[\s>])(@([a-zA-Z0-9_.-]*))$/);
  return m ? m[1] : null;
}

function handleQueueKeydown(e) {
  if (sgIsImeComposing(e)) return;
  if ("Enter" !== e.key) {
    if (!isCurrentlyGenerating || !isQueueingEnabled) {
      _sgQueueNativeAtSessionActive = false;
      return;
    }
    if ("Escape" === e.key || " " === e.key || "Tab" === e.key) {
      _sgQueueNativeAtSessionActive = false;
      return;
    }
    if (!_sgQueueNativeAtSessionActive && "@" !== e.key && "Backspace" !== e.key) {
      return;
    }
    if ("@" === e.key) {
      _sgQueueNativeAtSessionActive = true;
      return;
    }
    const t = document.querySelector(QUEUE_INPUT_SELECTOR);
    const atToken = t ? sgQueueGetActiveAtToken(t) : null;
    if (atToken && ("ArrowDown" === e.key || "ArrowUp" === e.key || "Backspace" === e.key || (!e.ctrlKey && !e.altKey && !e.metaKey && /^[a-zA-Z0-9_.-]$/.test(e.key)))) {
      _sgQueueNativeAtSessionActive = true;
    } else if (!atToken && typeof e.key === "string" && e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
      _sgQueueNativeAtSessionActive = false;
    }
    return;
  }
  if (!e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey && isCurrentlyGenerating && isQueueingEnabled && !slashMenuVisible && ("undefined" == typeof sgSkillMenuVisible || !sgSkillMenuVisible)) {
    const t = document.querySelector(QUEUE_INPUT_SELECTOR);
    if (sgQueueIsNativeAutocompleteOpen(t)) {
      _sgQueueNativeAtSessionActive = false;
      return;
    }
    const activeAtToken = t ? sgQueueGetActiveAtToken(t) : null;
    if ("@" === activeAtToken || (activeAtToken && _sgQueueNativeAtSessionActive)) {
      _sgQueueNativeAtSessionActive = false;
      return;
    }
    _sgQueueNativeAtSessionActive = false;
    e.preventDefault(), e.stopPropagation();
    if (t) {
      const textVal = extractInputText(t).trim();
      if (textVal) {
        const thinkLvl = getCurrentThinkingLevel();
        let activePeriodicSymbol = null;
        if (typeof sgPeriodicReadState === "function") {
          try {
            const pState = sgPeriodicReadState();
            if (pState && pState.selectedType === "element" && pState.released && pState.symbol) {
              activePeriodicSymbol = pState.symbol;
            }
          } catch (_e) {}
        }
        if (!tryEnqueueMessage({
            text: textVal,
            mode: getCurrentMode(),
            periodicSymbol: activePeriodicSymbol,
            thinkingLevel: thinkLvl,
            skills: []
          })) return;
        if ("DIV" === t.tagName) {
          t.replaceChildren();
          const p = document.createElement("p");
          p.appendChild(document.createElement("br"));
          t.appendChild(p);
        } else {
          t.value = "";
        }
        triggerWordCounterUpdate();
      }
    }
  }
}

function enableQueueInputListener() {
  const e = document.querySelector(QUEUE_INPUT_SELECTOR);
  e && (e.removeEventListener("keydown", handleQueueKeydown, !0), e.addEventListener("keydown", handleQueueKeydown, !0))
}

function disableQueueInputListener() {
  const e = document.querySelector(QUEUE_INPUT_SELECTOR);
  e && e.removeEventListener("keydown", handleQueueKeydown, !0)
}

function updateQueueGenerationStatus() {
  const e = document.querySelector('[fonticon="stop"]'),
    t = isCurrentlyGenerating,
    n = !!e;
  n ? (isCurrentlyGenerating = !0, queueCompletionChecks = 0) : t ? (queueCompletionChecks++, queueCompletionChecks >= 2 && (isCurrentlyGenerating = !1, queueCompletionChecks = 0, setTimeout(sendNextQueuedMessage, 500))) : !isCurrentlyGenerating && messageQueue.length > 0 && isQueueingEnabled && !isSendingFromQueue && (window.sgQueueWatchdogTimeout || (window.sgQueueWatchdogTimeout = setTimeout(() => {
    window.sgQueueWatchdogTimeout = null, !isCurrentlyGenerating && messageQueue.length > 0 && isQueueingEnabled && !isSendingFromQueue && sendNextQueuedMessage()
  }, 3e3)))
}
async function sendNextQueuedMessage() {
  if ("function" == typeof sgGetPeriodicBlockedElement && sgGetPeriodicBlockedElement()) return;
  if (0 === messageQueue.length || !isQueueingEnabled || isCurrentlyGenerating || isSendingFromQueue) return;
  const e = getCurrentChatId();
  if (e !== lastQueueChatId) {
    if ("default" !== lastQueueChatId || "default" === e) return;
    lastQueueChatId = e
  }
  const t = document.querySelector(QUEUE_INPUT_SELECTOR);
  if (!t) return;
  let n = "DIV" === t.tagName
    ? (Array.from(t.children || []).length ? Array.from(t.children).map(c => c.textContent || "") : String(t.textContent || "").split("\n"))
    : t.value;
  const o = e => {
    e.preventDefault(), e.stopImmediatePropagation()
  };
  t.addEventListener("keydown", o, !0), t.addEventListener("keypress", o, !0), t.addEventListener("paste", o, !0), isSendingFromQueue = !0;
  const r = sgNormalizeQueueItem(messageQueue.shift());
  saveQueueToStorage(), updateQueueDisplay();

  const periodicElem = r.periodicSymbol && typeof sgPeriodicGetElement === "function"
    ? sgPeriodicGetElement(r.periodicSymbol)
    : null;
  if (periodicElem && periodicElem.released && !periodicElem.locked && typeof sgPeriodicSelectElement === "function") {
    try {
      sgPeriodicSelectElement(periodicElem, r.thinkingLevel || undefined);
    } catch (_e) {}
    await new Promise(res => setTimeout(res, 720));
  } else {
    if (r.mode && (switchMode(r.mode), await new Promise(res => setTimeout(res, 400))), r.thinkingLevel) {
      try {
        await setThinkingLevel(r.thinkingLevel);
      } catch (_e) {}
      await new Promise(res => setTimeout(res, 250));
    }
  }

  const l = sgBuildQueueDispatchPrompt(r.text, r.skills);
  if ("DIV" === t.tagName) {
    t.replaceChildren();
    l.split("\n").forEach(line => {
      const p = document.createElement("p");
      if (line) {
        p.textContent = line;
      } else {
        p.appendChild(document.createElement("br"));
      }
      t.appendChild(p);
    });
    t.classList.remove("ql-blank");
  } else {
    t.value = l;
  }
  triggerWordCounterUpdate(), t.dispatchEvent(new Event("input", {
    bubbles: !0
  }));
  let c = 0;
  const d = () => {
      if (t.removeEventListener("keydown", o, !0), t.removeEventListener("keypress", o, !0), t.removeEventListener("paste", o, !0), "DIV" === t.tagName) {
        const lines = Array.isArray(n) ? n : String(n || "").split("\n");
        const nodes = lines.map(line => {
          const p = document.createElement("p");
          if (line) p.textContent = line;
          else p.appendChild(document.createElement("br"));
          return p;
        });
        "function" == typeof t.replaceChildren ? t.replaceChildren(...nodes) : (t.textContent = "", nodes.forEach(node => t.appendChild(node)));
        t.focus();
        try {
          const e = document.createRange(),
            n = window.getSelection();
          e.selectNodeContents(t), e.collapse(!1), n.removeAllRanges(), n.addRange(e)
        } catch (e) {}
      } else t.value = n, t.focus();
      triggerWordCounterUpdate()
    },
    u = () => {
      c++;
      const t = document.querySelector(QUEUE_SEND_BUTTON_SELECTOR);
      if (t && !t.disabled) {
        const n = getCurrentChatId();
        if (!(n === e || "default" === e && "default" !== n)) return messageQueue.unshift(r), saveQueueToStorage(), updateQueueDisplay(), isSendingFromQueue = !1, void d();
        t.click();
        let o = 0;
        const s = () => {
          o++;
          if ("undefined" != typeof _sgSkillBypassSend && _sgSkillBypassSend) {
            if (o < 30) return void setTimeout(s, 100);
          }
          const e = document.querySelector('[fonticon="stop"]'),
            t = document.querySelector(QUEUE_SEND_BUTTON_SELECTOR);
          e || !t || t.disabled ? (setTimeout(() => {
            d()
          }, 100), setTimeout(triggerWordCounterUpdate, 1e3), isSendingFromQueue = !1) : o < 20 ? setTimeout(s, 100) : (messageQueue.unshift(r), saveQueueToStorage(), updateQueueDisplay(), d(), isSendingFromQueue = !1)
        };
        s()
      } else c < 15 ? setTimeout(u, 300) : (console.error("[Gemini Power Suite] Failed to send queued message - send button not available or disabled"), messageQueue.unshift(r), saveQueueToStorage(), updateQueueDisplay(), d(), isSendingFromQueue = !1)
    };
  setTimeout(u, 500)
}

function handleQueueDomChanges() {
  updateQueueGenerationStatus(), isQueueingEnabled && enableQueueInputListener()
}

function checkQueueNavigation() {
  const e = getCurrentChatId();
  if (lastQueueChatId && e !== lastQueueChatId) {
    if ("default" === lastQueueChatId && "default" !== e) return storedQueues[e] && storedQueues[e].length && (messageQueue = [...messageQueue, ...storedQueues[e]], delete storedQueues[e]), delete storedQueues.default, lastQueueChatId = e, saveQueueToStorage(), void updateQueueDisplay();
    messageQueue.length > 0 ? storedQueues[lastQueueChatId] = [...messageQueue] : delete storedQueues[lastQueueChatId], lastQueueChatId = e, messageQueue = storedQueues[e] ? [...storedQueues[e]] : [], saveQueueToStorage(), updateQueueDisplay()
  } else !lastQueueChatId && e && (lastQueueChatId = e)
}

function handleRuntimeMessage(e) {
  switch (e.type) {
    case "ENABLE_QUEUING":
      isQueueingEnabled = !0, enableQueueInputListener(), updateQueueDisplay();
      break;
    case "DISABLE_QUEUING":
      isQueueingEnabled = !1, disableQueueInputListener(), updateQueueDisplay();
      break;
    case "SHOW_QUEUE_WINDOW":
      isQueueDisplayVisible = !0, updateQueueDisplay();
      break;
    case "HIDE_QUEUE_WINDOW":
      isQueueDisplayVisible = !1, updateQueueDisplay();
      break;
    case "ENABLE_SIDEBAR_DROPDOWN":
      toggleSidebarSection(!0), sgSetNativeMenuVisible(!0);
      break;
    case "DISABLE_SIDEBAR_DROPDOWN":
      toggleSidebarSection(!1), sgSetNativeMenuVisible(!1);
      break;
    case "ENABLE_FOLDERS": {
      isFoldersFeatureEnabled = !0;
      const _foldersItem = document.getElementById("sg-folders-menu-item");
      _foldersItem && (_foldersItem.style.display = "flex"), sgSetNativeMenuItemVisible("folders", !0), startSidebarFilterWatchers();
      break;
    }
    case "ENABLE_SETTINGS_MENU":
      settingsInMenuEnabled = !0;
      const t = document.getElementById("sg-settings-menu-item");
      t && (t.style.display = "flex"), sgSetNativeMenuItemVisible("settings", !0);
      break;
    case "DISABLE_SETTINGS_MENU":
      settingsInMenuEnabled = !1;
      const n = document.getElementById("sg-settings-menu-item");
      n && (n.style.display = "none"), sgSetNativeMenuItemVisible("settings", !1);
      break;
    case "DISABLE_FOLDERS":
      isFoldersFeatureEnabled = !1;
      const o = document.getElementById("sg-folders-menu-item");
      o && (o.style.display = "none"), sgSetNativeMenuItemVisible("folders", !1), stopSidebarFilterWatchers();
      break;
    case "ENABLE_PROMPTS":
      isPromptsFeatureEnabled = !0;
      const a = document.getElementById("sg-prompts-menu-item");
      a && (a.style.display = "flex"), sgSetNativeMenuItemVisible("prompts", !0), slashMenuElement || initSlashCommands(), updateChatPlaceholder();
      break;
    case "DISABLE_PROMPTS":
      isPromptsFeatureEnabled = !1;
      const i = document.getElementById("sg-prompts-menu-item");
      i && (i.style.display = "none"), sgSetNativeMenuItemVisible("prompts", !1), hideSlashMenu(), updateChatPlaceholder();
      break;
    case "ENABLE_SKILLS_INJECTION":
      isSkillsInjectionEnabled = !0;
      break;
    case "DISABLE_SKILLS_INJECTION":
      isSkillsInjectionEnabled = !1, "function" == typeof hideSkillAutocomplete && hideSkillAutocomplete();
      break;
    case "OPEN_SKILLS_MODAL":
      "function" == typeof showSkillsModal && showSkillsModal();
      break;
    case "ENABLE_BASELINE_INJECTION":
      isBaselineInjectionEnabled = !0;
      break;
    case "DISABLE_BASELINE_INJECTION":
      isBaselineInjectionEnabled = !1;
      break;
    case "ENABLE_OUTLINE":
      if (typeof sgSetOutlineEnabled === "function") sgSetOutlineEnabled(true);
      break;
    case "DISABLE_OUTLINE":
      if (typeof sgSetOutlineEnabled === "function") sgSetOutlineEnabled(false);
      break;
    case "ENABLE_FORK_HANDOFF":
      if (typeof sgSetForkHandoffEnabled === "function") sgSetForkHandoffEnabled(true);
      break;
    case "DISABLE_FORK_HANDOFF":
      if (typeof sgSetForkHandoffEnabled === "function") sgSetForkHandoffEnabled(false);
      break;
    case "ENABLE_CODE_BLOCK_ACTIONS":
      if (typeof sgSetCodeBlockActionsEnabled === "function") sgSetCodeBlockActionsEnabled(true);
      break;
    case "DISABLE_CODE_BLOCK_ACTIONS":
      if (typeof sgSetCodeBlockActionsEnabled === "function") sgSetCodeBlockActionsEnabled(false);
      break;
    case "ENABLE_COMMAND_PALETTE":
      if (typeof sgSetCommandPaletteEnabled === "function") sgSetCommandPaletteEnabled(true);
      break;
    case "DISABLE_COMMAND_PALETTE":
      if (typeof sgSetCommandPaletteEnabled === "function") sgSetCommandPaletteEnabled(false);
      break;
    case "OPEN_COMMAND_PALETTE":
      if (typeof sgOpenCommandPalette === "function") sgOpenCommandPalette();
      break;
    case "ENABLE_OPTIMIZE":
      isOptimizeFeatureEnabled = !0;
      const l = document.getElementById("sg-optimize-prompt-btn");
      l ? (l.style.display = "flex", updateButtonPosition()) : injectOptimizeButton();
      break;
    case "DISABLE_OPTIMIZE":
      isOptimizeFeatureEnabled = !1;
      const c = document.getElementById("sg-optimize-prompt-btn");
      c && (c.style.display = "none"), optimizePromptObserver && (optimizePromptObserver.disconnect(), optimizePromptObserver = null);
      break;
    case "OPEN_OPTIMIZE_PROMPT_EDITOR":
      showOptimizePromptEditor();
      break;
    case "ENABLE_COUNTER":
      isCounterFeatureEnabled = !0;
      const d = document.getElementById("sg-word-counter");
      d ? (d.style.display = "flex", currentInputElement && updateCounter(currentInputElement.innerText || currentInputElement.value || ""), updateCounterPosition()) : initWordCounter();
      break;
    case "DISABLE_COUNTER":
      isCounterFeatureEnabled = !1;
      const u = document.getElementById("sg-word-counter");
      u && (u.style.display = "none");
      break;
    case "SG_SYNC_MASTER_STATE":
      isExtensionEnabled = !1 !== e.enabled, sgSyncMasterLocalStorageFlag(isExtensionEnabled);
      break;
    case "ENABLE_EXTENSION":
    case "DISABLE_EXTENSION":
      window.location.reload();
      break;
    case "ENABLE_TIMESTAMPS":
      sgMsgTsApplyEnabled(!0);
      break;
    case "DISABLE_TIMESTAMPS":
      sgMsgTsApplyEnabled(!1);
      break;
    case "ENABLE_AUTOHIDE_SIDEBAR":
      autohideCollapsedSidebar = !0;
      updateSidebarAutohideState();
      break;
    case "DISABLE_AUTOHIDE_SIDEBAR":
      autohideCollapsedSidebar = !1;
      updateSidebarAutohideState();
      break;
    case "ENABLE_AUTOHIDE_TOP_ACTIONS":
      autohideTopActions = !0;
      updateTopActionsAutohideState();
      break;
    case "DISABLE_AUTOHIDE_TOP_ACTIONS":
      autohideTopActions = !1;
      updateTopActionsAutohideState();
      break;
    case "CLOSE_IN_PAGE_SETTINGS":
      const m = document.getElementById("sg-settings-modal-host");
      m && m.remove();
      break;
    case "HIDE_GEMS_GALLERY":
      premadeGemsGalleryHidden = !0, applyGemsHiding();
      break;
    case "SHOW_GEMS_GALLERY":
      premadeGemsGalleryHidden = !1, applyGemsHiding();
      break;
    case "HIDE_GEMS_SIDEBAR_BUTTON":
    case "HIDE_GEMS_BUTTON":
      premadeGemsButtonHidden = !0, applyGemsHiding();
      break;
    case "SHOW_GEMS_SIDEBAR_BUTTON":
    case "SHOW_GEMS_BUTTON":
      premadeGemsButtonHidden = !1, applyGemsHiding();
      break;
    case "HIDE_LOCATION_INFO":
      hideLocationInfo = !0, applyLocationVisibility();
      break;
    case "SHOW_LOCATION_INFO":
      hideLocationInfo = !1, applyLocationVisibility();
      break;
    case "HIDE_ACTIVITY":
      hideActivity = !0, applyActivityVisibility();
      break;
    case "SHOW_ACTIVITY":
      hideActivity = !1, applyActivityVisibility();
      break;
    case "HIDE_UPGRADE_BUTTONS":
      document.body.classList.add("sg-hide-upgrade-buttons");
      break;
    case "SHOW_UPGRADE_BUTTONS":
      document.body.classList.remove("sg-hide-upgrade-buttons");
      break;
    case "ENABLE_EXPORT_BTN":
      isExportButtonEnabled = !0, injectHeaderButtons();
      break;
    case "DISABLE_EXPORT_BTN":
      isExportButtonEnabled = !1, injectHeaderButtons();
      break;
    case "ENABLE_INFO_BTN":
      isInfoButtonEnabled = !0, injectHeaderButtons();
      break;
    case "DISABLE_INFO_BTN":
      isInfoButtonEnabled = !1, injectHeaderButtons();
      break;
    case "ENABLE_WIDE_CHAT":
      isWideChatEnabled = !0, updateWideChatClass(), injectHeaderButtons();
      break;
    case "DISABLE_WIDE_CHAT":
      isWideChatEnabled = !1, updateWideChatClass(), injectHeaderButtons();
      break;
    case "ENABLE_FOLDER_UPLOAD":
      isFolderUploadEnabled = !0;
      setupFolderUploadMenuObserver();
      initFolderDragDrop();
      break;
    case "DISABLE_FOLDER_UPLOAD":
      isFolderUploadEnabled = !1;
      const _fub = document.getElementById("sg-folder-upload-btn");
      _fub && _fub.remove();
      document.querySelectorAll("#sg-folder-upload-menu-item").forEach(e => e.remove());
      sgObserverRegistry.unregisterUIRefresh("folderMenu");
      break;
    case "SHOW_WIDE_BTN":
      isWideChatButtonEnabled = !0, injectHeaderButtons();
      break;
    case "HIDE_WIDE_BTN":
      isWideChatButtonEnabled = !1, injectHeaderButtons();
      break;
    case "ENABLE_PERIODIC_MODEL_PICKER":
      "function" == typeof sgSetPeriodicModelPickerEnabled && sgSetPeriodicModelPickerEnabled(!0);
      break;
    case "DISABLE_PERIODIC_MODEL_PICKER":
      "function" == typeof sgSetPeriodicModelPickerEnabled && sgSetPeriodicModelPickerEnabled(!1);
      break;
    case "ENABLE_ORCHESTRATOR":
      "function" == typeof sgSetOrchestratorEnabled && sgSetOrchestratorEnabled(!0);
      break;
    case "DISABLE_ORCHESTRATOR":
      "function" == typeof sgSetOrchestratorEnabled && sgSetOrchestratorEnabled(!1);
      break;
    case "ORCHESTRATOR_SUBAGENT_PROGRESS":
      "function" == typeof sgHandleOrchestratorProgress && sgHandleOrchestratorProgress(e);
      break;
    case "ENABLE_DIAGRAM_RENDERER":
      "function" == typeof sgSetDiagramRendererEnabled && sgSetDiagramRendererEnabled(!0);
      break;
    case "DISABLE_DIAGRAM_RENDERER":
      "function" == typeof sgSetDiagramRendererEnabled && sgSetDiagramRendererEnabled(!1);
      break
  }
}

function initQueueFeature() {
  loadQueueFromStorage(), createQueueDisplay(), document.addEventListener("keydown", handleQueueEscKeydown, !0), document.addEventListener("keyup", handleQueueEscKeyup, !0), window.addEventListener("blur", cancelQueueEscHold), sgObserverRegistry.registerUIRefresh("queueDomChanges", handleQueueDomChanges), setTimeout(() => {
    handleQueueDomChanges(), lastQueueChatId = getCurrentChatId(), queueNavigationInterval && clearInterval(queueNavigationInterval), queueNavigationInterval = !0, sgRegisterNavTick(() => {
      checkQueueNavigation(), checkChainNavigation()
    }), !isCurrentlyGenerating && messageQueue.length > 0 && sendNextQueuedMessage()
  }, 1500)
}
(() => {
  const _sgLegacyRuntimeCoreMsg = (e, t, n) => {
    if ("FETCH_CHAT_VIA_RPC" === e.type) return fetchChatTurnsViaRpc(e.chatId).then(e => n({
      success: !(!e || !e.length),
      history: e || []
    })).catch(e => n({
      success: !1,
      error: String(e && e.message || e)
    })), !0;
    if ("SHOW_TOAST" !== e.type) return handleRuntimeMessage(e), !1;
    try {
      showToast(e.message, e.toastType || "info")
    } catch (e) {}
    return !1;
  };
  if ("undefined" != typeof SG && SG.messages) {
    SG.messages.onMatcher("legacy:runtime-core", () => !0, _sgLegacyRuntimeCoreMsg);
  } else if ("undefined" != typeof chrome && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener(_sgLegacyRuntimeCoreMsg);
  }
})();
SG_IS_SILENT_BG_WORKER_TAB || setTimeout(() => {
  sgSyncGetCached(["extensionEnabled"], e => {
    !1 !== e.extensionEnabled && initQueueFeature()
  })
}, 2500);
const FOLDERS_STORAGE_KEY = "gpsFolders",
  PROMPTS_STORAGE_KEY = "gpsPrompts",
  CHAINS_STORAGE_KEY = "gpsChains",
  DROPDOWN_EXPANDED_KEY = "gpsDropdownExpanded";
const GPS_STORAGE_MIGRATED_KEY = "gpsStorageMigratedV1";
let _gpsStorageMigrationPromise = null;

function migrateLegacyStorageKeys() {
  if (_gpsStorageMigrationPromise) return _gpsStorageMigrationPromise;
  _gpsStorageMigrationPromise = (async () => {
    try {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        const flag = await chrome.storage.local.get([GPS_STORAGE_MIGRATED_KEY]);
        if (flag && flag[GPS_STORAGE_MIGRATED_KEY] === true) return;

        const localMigrations = [
          ["superpowerGeminiFolders", FOLDERS_STORAGE_KEY],
          ["superpowerGeminiPrompts", PROMPTS_STORAGE_KEY],
          ["superpowerGeminiChains", CHAINS_STORAGE_KEY]
        ];
        const localData = await chrome.storage.local.get(localMigrations.flat());
        const localSet = {};
        const localRemove = [];
        for (const [oldKey, newKey] of localMigrations) {
          if (localData[newKey] === undefined && localData[oldKey] !== undefined) {
            localSet[newKey] = localData[oldKey];
            localRemove.push(oldKey);
          } else if (localData[newKey] !== undefined && localData[oldKey] !== undefined) {
            localRemove.push(oldKey);
          }
        }
        if (Object.keys(localSet).length > 0) {
          await chrome.storage.local.set(localSet);
        }
        const obsoleteLocal = ["superpowerGeminiFeedback", "sgFamilyPromoPopup", "sgLastPromoAt", "_sg_rl", "_sg_rl_b"];
        await chrome.storage.local.remove([...new Set([...localRemove, ...obsoleteLocal])]);
      }
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync) {
        const syncMigrations = [
          ["superpowerDropdownExpanded", DROPDOWN_EXPANDED_KEY]
        ];
        const syncData = await chrome.storage.sync.get(syncMigrations.flat());
        const syncSet = {};
        const syncRemove = [];
        for (const [oldKey, newKey] of syncMigrations) {
          if (syncData[newKey] === undefined && syncData[oldKey] !== undefined) {
            syncSet[newKey] = syncData[oldKey];
            syncRemove.push(oldKey);
          } else if (syncData[newKey] !== undefined && syncData[oldKey] !== undefined) {
            syncRemove.push(oldKey);
          }
        }
        if (Object.keys(syncSet).length > 0) {
          await chrome.storage.sync.set(syncSet);
          if (_sgBootstrapSyncCache) Object.assign(_sgBootstrapSyncCache, syncSet);
        }
        const obsoleteSync = ["sgProActive", "sgLicenseKey", "sgProductId", "sgUpsellLang", "telemetryEnabled"];
        await chrome.storage.sync.remove([...new Set([...syncRemove, ...obsoleteSync])]);
        if (_sgBootstrapSyncCache) {
          for (const k of [...syncRemove, ...obsoleteSync]) delete _sgBootstrapSyncCache[k];
        }
      }
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({ [GPS_STORAGE_MIGRATED_KEY]: true });
      }
    } catch (e) {}
  })();
  return _gpsStorageMigrationPromise;
}
let foldersData = {
    folders: []
  },
  promptsData = {
    prompts: [],
    deletedPrompts: []
  },
  chainsData = {
    chains: [],
    deletedChains: []
  },
  sgDataReady = !1,
  _sgDataLoadAttempts = 0,
  _sgDataLoadRetryTimer = null;

function sgScheduleDataLoadRetry() {
  sgDataReady || _sgDataLoadRetryTimer || _sgDataLoadAttempts >= 3 || (_sgDataLoadAttempts++, _sgDataLoadRetryTimer = setTimeout(() => {
    _sgDataLoadRetryTimer = null, loadFoldersData()
  }, 1e3 * _sgDataLoadAttempts))
}
let gpsSectionExpanded = !0,
  modalStack = [];

function sgRequireDataReady() {
  if (sgDataReady) return !0;
  try {
    showToast("Still loading your saved data, try again in a second", "info")
  } catch (e) {}
  return !1
}
let hideFolderedChats = !0,
  hideFolderedInChatsTab = !0,
  hideLocationInfo = !0,
  hideActivity = !0,
  settingsInMenuEnabled = !1;

function generateSgId(e = "item") {
  return e + "_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9)
}

function generateFolderId() {
  return generateSgId("folder")
}

function generatePromptId() {
  return generateSgId("prompt")
}

function generateChainId() {
  return generateSgId("chain")
}
const MAX_FOLDER_DEPTH = 10;

function getFolderDepth(e) {
  let t = 0,
    n = foldersData.folders.find(t => t.id === e);
  for (; n && n.parentId && (t++, n = foldersData.folders.find(e => e.id === n.parentId), !(t > 100)););
  return t
}
async function loadFoldersData() {
  try {
    await migrateLegacyStorageKeys();
    const e = await chrome.storage.local.get(FOLDERS_STORAGE_KEY);
    if (e[FOLDERS_STORAGE_KEY]) {
      foldersData = e[FOLDERS_STORAGE_KEY], delete foldersData.recycleBin, delete foldersData.restoredFromBinAt, foldersData.permanentlyDeleted || (foldersData.permanentlyDeleted = []), foldersData.deletedFolders || (foldersData.deletedFolders = []), foldersData.permanentlyDeletedAt && "object" == typeof foldersData.permanentlyDeletedAt || (foldersData.permanentlyDeletedAt = {});
      const t = Date.now();
      for (const e of foldersData.permanentlyDeleted) "number" != typeof foldersData.permanentlyDeletedAt[e] && (foldersData.permanentlyDeletedAt[e] = t)
    }
    const t = await loadPromptsData(),
      n = await loadChainsData();
    t && n ? sgDataReady = !0 : sgScheduleDataLoadRetry();
    const o = await sgSyncGetCached(["gpsDropdownExpanded", "hideFolderedChats", "hideFolderedInChatsTab", "settingsInMenuEnabled"]);
    if (void 0 !== o.gpsDropdownExpanded && (gpsSectionExpanded = o.gpsDropdownExpanded), void 0 !== o.hideFolderedChats && (hideFolderedChats = o.hideFolderedChats, applySidebarFiltering()), void 0 !== o.hideFolderedInChatsTab) hideFolderedInChatsTab = o.hideFolderedInChatsTab;
    else {
      hideFolderedInChatsTab = hideFolderedChats;
      try {
        chrome.storage.sync.set({
          hideFolderedInChatsTab: hideFolderedInChatsTab
        })
      } catch (e) {}
    }
    void 0 !== o.settingsInMenuEnabled && (settingsInMenuEnabled = o.settingsInMenuEnabled)
  } catch (e) {
    console.error("[Gemini Power Suite] Error loading data:", e), sgScheduleDataLoadRetry()
  }
}
async function loadPromptsData() {
  try {
    await migrateLegacyStorageKeys();
    const e = await chrome.storage.local.get(PROMPTS_STORAGE_KEY);
    if (e[PROMPTS_STORAGE_KEY]) {
      promptsData = e[PROMPTS_STORAGE_KEY], Array.isArray(promptsData.prompts) || (promptsData.prompts = []), Array.isArray(promptsData.deletedPrompts) || (promptsData.deletedPrompts = []);
      for (const e of promptsData.prompts) "number" != typeof e.lastModified && (e.lastModified = 0);
      sgEnsureSortIndices(promptsData.prompts) && await savePromptsData(!0)
    } else {
      const e = Date.now();
      promptsData = {
        prompts: [{
          id: "prompt_default_email_rewriter",
          title: "Email Rewriter",
          text: "Rewrite the following email draft. I want the final tone to be {{desired_tone}}. Keep the message concise but effective.\n\nDraft: {{email_draft}}",
          lastModified: e,
          sortIndex: SG_SORT_SPACING,
          sortIndexAt: 0
        }],
        deletedPrompts: []
      }, await savePromptsData(!0)
    }
    return !0
  } catch (e) {
    return console.error("[Gemini Power Suite] Error loading prompts:", e), !1
  }
}
async function saveFoldersData() {
  const e = await safeLocalStorageSet({
    [FOLDERS_STORAGE_KEY]: foldersData
  });
  return e || console.error("[Folders] Failed to save - storage limit exceeded"), e
}
async function savePromptsData(e = !1) {
  return !!await safeLocalStorageSet({
    [PROMPTS_STORAGE_KEY]: promptsData
  }) || (console.error("[Prompts] Failed to save - storage limit exceeded"), !1)
}
async function loadChainsData() {
  try {
    await migrateLegacyStorageKeys();
    const e = await chrome.storage.local.get(CHAINS_STORAGE_KEY);
    if (e[CHAINS_STORAGE_KEY]) {
      chainsData = e[CHAINS_STORAGE_KEY], Array.isArray(chainsData.chains) || (chainsData.chains = []), Array.isArray(chainsData.deletedChains) || (chainsData.deletedChains = []);
      for (const e of chainsData.chains) "number" != typeof e.lastModified && (e.lastModified = 0);
      sgEnsureSortIndices(chainsData.chains) && await saveChainsData(!0)
    } else {
      const e = Date.now();
      chainsData = {
        chains: [{
          id: "chain_default_content_repurposer",
          title: "The Content Repurposer",
          steps: ["Write a 5-point Twitter thread about {{topic}}. Keep it punchy and viral.", "Now, write a professional LinkedIn post tailored specifically for a {{target_audience}} audience. Focus on the business value.", "Finally, write a script for a 30-second TikTok video explaining {{topic}} to {{target_audience}}."],
          lastModified: e,
          sortIndex: SG_SORT_SPACING,
          sortIndexAt: 0
        }],
        deletedChains: []
      }, await saveChainsData(!0)
    }
    return !0
  } catch (e) {
    return console.error("[Gemini Power Suite] Error loading chains:", e), !1
  }
}
async function saveChainsData(e = !1) {
  return !!await safeLocalStorageSet({
    [CHAINS_STORAGE_KEY]: chainsData
  }) || (console.error("[Chains] Failed to save - storage limit exceeded"), !1)
}

function tombstonePrompts(e) {
  Array.isArray(promptsData.deletedPrompts) || (promptsData.deletedPrompts = []);
  const t = Date.now(),
    n = new Set(e);
  promptsData.deletedPrompts = promptsData.deletedPrompts.filter(e => !n.has(e.id));
  for (const n of e) promptsData.deletedPrompts.push({
    id: n,
    deletedAt: t
  })
}

function tombstoneChains(e) {
  Array.isArray(chainsData.deletedChains) || (chainsData.deletedChains = []);
  const t = Date.now(),
    n = new Set(e);
  chainsData.deletedChains = chainsData.deletedChains.filter(e => !n.has(e.id));
  for (const n of e) chainsData.deletedChains.push({
    id: n,
    deletedAt: t
  })
}
window.sgChainState = null;
let storedChains = {},
  lastChainChatId = null;

function checkChainNavigation() {
  const e = getCurrentChatId();
  if (window.sgChainState && window.sgChainState.isRunning) {
    if (lastChainChatId && e !== lastChainChatId) {
      if ("default" === lastChainChatId && "default" !== e) return void(lastChainChatId = e);
      window.sgChainState.checkInterval && (clearInterval(window.sgChainState.checkInterval), window.sgChainState.checkInterval = null), storedChains[lastChainChatId] = {
        ...window.sgChainState
      }, window.sgChainState = null;
      const t = document.getElementById("sg-chain-progress");
      t && (t.style.display = "none"), t && t.remove()
    }
  } else if (e && storedChains[e]) {
    window.sgChainState = storedChains[e], delete storedChains[e], lastChainChatId = e, showChainProgressIndicator(window.sgChainState.currentStep, window.sgChainState.chain.steps.length), updateChainProgressIndicator(window.sgChainState.currentStep, window.sgChainState.chain.steps.length, "Resuming...");
    if (!!document.querySelector('[fonticon="stop"]')) setupChainResponseDetection(window.sgChainState.currentStep);
    else {
      updateChainProgressIndicator(window.sgChainState.currentStep, window.sgChainState.chain.steps.length, "AI finished, proceeding...");
      const e = window.sgChainState.currentStep + 1;
      window.sgChainState.currentStep = e, setTimeout(() => executeChainStep(e), 1e3)
    }
  }!window.sgChainState && storedChains[e]
}

function runChain(e) {
  if (!e || !e.steps || 0 === e.steps.length) return void showToast("Invalid chain: no steps found", "error");
  const t = e => resolvePromptReferences("string" == typeof e ? e : e.text || ""),
    n = /\{\{\s*([^{}]+)\s*\}\}/g,
    o = new Set;
  if (e.steps.forEach(e => {
      [...t(e).matchAll(n)].forEach(e => o.add(e[1].trim()))
    }), o.size > 0) promptChainVariables(e, [...o]);
  else if (isCurrentlyGenerating && isQueueingEnabled) {
    let n = 0;
    for (let o = 0; o < e.steps.length; o++) {
      const r = t(e.steps[o]);
      if (!tryEnqueueMessage(`[CHAIN:${e.title} (Step ${o+1}/${e.steps.length})] ` + r)) break;
      n++
    }
    n > 0 && showToast(`Chain "${e.title}" (${n} step${1===n?"":"s"}) added to queue`, "info")
  } else startChainExecution(e)
}

function promptChainVariables(e, t) {
  const n = createModal("Fill Chain Variables", `\n    <form id="sg-chain-vars-form" style="display: flex; flex-direction: column; gap: 16px;">\n      <p style="font-size: 13px; color: var(--gem-sys-color--on-surface-variant, #575a5a); margin: 0 0 8px; font-family: var(--sg-font-text);">\n        Fill in the variables for chain "<strong>${escapeHtml(e.title)}</strong>" (${e.steps.length} steps):\n      </p>\n      ${t.map((v,idx)=>{const sv=escapeHtml(v);return `\n        <div class="sg-form-group">\n          <label class="sg-form-label" style="text-transform: capitalize;">${sv}</label>\n          <input type="text" class="sg-form-input" data-var="${sv}" placeholder="Enter ${sv}..." required ${0===idx?"autofocus":""}>\n        </div>\n      `}).join("")}\n    </form>\n  `, [{
    text: "Cancel",
    class: "sg-btn sg-btn-gray",
    action: "close"
  }, {
    text: "Run Chain",
    class: "sg-btn sg-btn-gray",
    action: "submit"
  }]);
  document.body.appendChild(n), n.classList.add("show"), n.style.zIndex = "1000002", setTimeout(() => {
    n.querySelector("input")?.focus()
  }, 100);
  const o = () => {
    const t = n.querySelectorAll("input[data-var]");
    let o = !0;
    if (t.forEach(e => {
        e.value.trim() || (e.style.borderColor = "var(--gem-sys-color--error, #ea4335)", o = !1)
      }), !o) return;
    const r = {};
    t.forEach(e => {
      r[e.dataset.var] = e.value.trim()
    });
    const s = e => {
        let t = e;
        return Object.entries(r).forEach(([e, n]) => {
          const o = new RegExp(`{{\\s*${e.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}\\s*}}`, "g");
          t = t.replace(o, n)
        }), t
      },
      a = {
        ...e,
        steps: e.steps.map(e => "string" == typeof e ? s(resolvePromptReferences(e)) : {
          ...e,
          text: s(resolvePromptReferences(e.text || ""))
        })
      };
    n.remove();
    const i = e => "string" == typeof e ? e : e.text || "";
    if (isCurrentlyGenerating && isQueueingEnabled) {
      let e = 0;
      for (let t = 0; t < a.steps.length; t++) {
        const n = i(a.steps[t]);
        if (!tryEnqueueMessage(`[CHAIN:${a.title} (Step ${t+1}/${a.steps.length})] ` + n)) break;
        e++
      }
      e > 0 && showToast(`Chain "${a.title}" (${e} step${1===e?"":"s"}) added to queue`, "info")
    } else startChainExecution(a)
  };
  n.querySelector("#sg-chain-vars-form").addEventListener("keydown", e => {
    "Enter" === e.key && (e.preventDefault(), o())
  }), n.querySelector('[data-action="submit"]').addEventListener("click", e => {
    e.preventDefault(), o()
  })
}

function startChainExecution(e) {
  lastChainChatId = getCurrentChatId(), window.sgChainState = {
    chain: e,
    currentStep: 0,
    isRunning: !0,
    checkInterval: null
  }, showChainProgressIndicator(0, e.steps.length), executeChainStep(0)
}
async function executeChainStep(e) {
  const t = window.sgChainState;
  if (!t || !t.isRunning) return;
  const n = t.chain;
  if (e >= n.steps.length) return resetChainExecution(), void showToast("Chain completed! ✅", "success");
  const o = n.steps[e],
    r = "string" == typeof o ? {
      text: resolvePromptReferences(o),
      mode: "",
      tool: ""
    } : {
      text: resolvePromptReferences(o.text || ""),
      mode: o.mode || "",
      tool: o.tool || ""
    },
    s = r.text;
  updateChainProgressIndicator(e, n.steps.length, "Preparing..."), r.mode && (updateChainProgressIndicator(e, n.steps.length, `Switching to ${r.mode} mode...`), switchMode(r.mode), await new Promise(e => setTimeout(e, 400))), r.tool && (updateChainProgressIndicator(e, n.steps.length, "Selecting tool..."), await selectTool(r.tool), await new Promise(e => setTimeout(e, 300))), updateChainProgressIndicator(e, n.steps.length, "Sending...");
  const a = document.querySelector(QUEUE_INPUT_SELECTOR);
  if (!a) return showToast("Could not find input field", "error"), void resetChainExecution();
  let i = "DIV" === a.tagName
    ? (Array.from(a.children || []).length ? Array.from(a.children).map(ch => ch.textContent || "") : String(a.textContent || "").split("\n"))
    : a.value;
  const l = e => {
    e.preventDefault(), e.stopImmediatePropagation()
  };
  a.addEventListener("keydown", l, !0), a.addEventListener("keypress", l, !0), a.addEventListener("paste", l, !0);
  const c = () => {
    if (a.removeEventListener("keydown", l, !0), a.removeEventListener("keypress", l, !0), a.removeEventListener("paste", l, !0), "DIV" === a.tagName) {
      const lines = Array.isArray(i) ? i : String(i || "").split("\n");
      const nodes = lines.map(line => {
        const p = document.createElement("p");
        if (line) p.textContent = line;
        else p.appendChild(document.createElement("br"));
        return p;
      });
      "function" == typeof a.replaceChildren ? a.replaceChildren(...nodes) : (a.textContent = "", nodes.forEach(node => a.appendChild(node)));
      a.focus();
      try {
        const e = document.createRange(),
          t = window.getSelection();
        e.selectNodeContents(a), e.collapse(!1), t.removeAllRanges(), t.addRange(e)
      } catch (e) {}
    } else a.value = i, a.focus();
    triggerWordCounterUpdate()
  };
  if ("DIV" === a.tagName) {
    a.replaceChildren();
    String(s || "").split("\n").forEach(line => {
      const p = document.createElement("p");
      if (line) {
        p.textContent = line;
      } else {
        p.appendChild(document.createElement("br"));
      }
      a.appendChild(p);
    });
    a.classList.remove("ql-blank");
  } else {
    a.value = s;
  }
  a.dispatchEvent(new Event("input", {
    bubbles: !0
  })), triggerWordCounterUpdate(), a.focus();
  let d = 0;
  const u = () => {
    d++;
    const t = document.querySelector(QUEUE_SEND_BUTTON_SELECTOR);
    if (t && !t.disabled) {
      t.click();
      let n = 0;
      const o = () => {
        n++;
        const t = document.querySelector('[fonticon="stop"]'),
          r = document.querySelector(QUEUE_SEND_BUTTON_SELECTOR);
        t || !r || r.disabled ? (setTimeout(() => {
          c()
        }, 100), setupChainResponseDetection(e), setTimeout(triggerWordCounterUpdate, 1e3)) : n < 20 ? setTimeout(o, 100) : (console.warn("[Gemini Power Suite] Chain: Send verification failed for step", e + 1), d < 15 ? setTimeout(u, 300) : (showToast("Could not send message - click did not register", "error"), c(), resetChainExecution()))
      };
      setTimeout(o, 100)
    } else d < 15 ? setTimeout(u, 250) : (showToast("Could not send message - send button not available", "error"), c(), resetChainExecution())
  };
  setTimeout(u, 500)
}

function setupChainResponseDetection(e) {
  const t = window.sgChainState;
  if (!t) return;
  let n = 0,
    o = 0,
    r = !1;
  const s = t.chain.steps[e];
  let a = "deep-research" === ("object" == typeof s && s && s.tool || ""),
    i = !1,
    l = 0;
  updateChainProgressIndicator(e, t.chain.steps.length, "Waiting for AI to start..."), t.checkInterval = setInterval(() => {
    n++;
    if (!!document.querySelector('[fonticon="stop"]')) r = !0, o = 0, updateChainProgressIndicator(e, t.chain.steps.length, i ? "Deep Research running..." : "AI is responding...");
    else if (r && (o++, o >= 3)) {
      if (a && !i) {
        const n = document.querySelector('deep-research-confirmation-widget button[data-test-id="confirm-button"]');
        if (n && !n.disabled) return n.click(), i = !0, a = !1, updateChainProgressIndicator(e, t.chain.steps.length, "Auto-accepted Deep Research..."), r = !1, void(o = 0);
        if (l++, l < 20) return;
        a = !1
      }
      clearInterval(t.checkInterval), t.checkInterval = null;
      const n = e + 1;
      t.currentStep = n, n < t.chain.steps.length ? (updateChainProgressIndicator(n, t.chain.steps.length, "Preparing next step..."), setTimeout(() => executeChainStep(n), 1500)) : executeChainStep(n)
    }
    n >= 600 && (clearInterval(t.checkInterval), showToast("Chain timed out after 5 minutes", "error"), resetChainExecution())
  }, 500)
}

function showChainProgressIndicator(e, t) {
  let n = document.getElementById("sg-chain-progress");
  const o = isDarkTheme(),
    r = getThemeColors(o);
  if (n || (n = document.createElement("div"), n.id = "sg-chain-progress", n.style.cssText = `\n      position: fixed;\n      bottom: 20px;\n      right: 20px;\n      width: 300px;\n      background: ${r.solidBg};\n      border: 1px solid ${o?"#3c4043":"#dadce0"};\n      border-radius: 12px;\n      padding: 16px;\n      z-index: 100;\n      box-shadow: 0 4px 12px rgba(0,0,0,0.15);\n      font-family: var(--sg-font-text);\n      color: ${o?"#e3e3e3":"#3c4043"};\n    `, document.body.appendChild(n)),sgSetSafeHtml(n, `\n    <div style="\n      display: flex;\n      align-items: center;\n      gap: 8px;\n      margin-bottom: 12px;\n      font-size: 14px;\n      font-weight: 600;\n    ">\n      <span style="font-size: 16px;">⛓️</span>\n      <span>Running Chain</span>\n      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px; margin-left: auto; animation: sg-spin 1s linear infinite; opacity: 0.7;">\n        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>\n      </svg>\n    </div>\n    <div style="\n      font-size: 13px;\n      color: ${r.textSecondary};\n      margin-bottom: 8px;\n    ">\n      Step ${e+1} of ${t}\n    </div>\n    <div id="sg-chain-status" style="\n      font-size: 12px;\n      color: ${r.accent};\n      margin-bottom: 12px;\n    ">\n      Initializing...\n    </div>\n    <div style="display: flex; gap: 8px;">\n      <button id="sg-chain-skip-btn" style="\n        flex: 1;\n        padding: 8px 12px;\n        background: ${o?"#303134":"#f1f3f4"};\n        border: 1px solid ${r.border};\n        border-radius: 6px;\n        color: ${o?"#e3e3e3":"#3c4043"};\n        font-size: 12px;\n        font-weight: 500;\n        cursor: pointer;\n        transition: background 0.15s;\n      ">Skip Step</button>\n      <button id="sg-chain-stop-btn" style="\n        flex: 1;\n        padding: 8px 12px;\n        background: ${o?"#5c2828":"#fce8e6"};\n        border: 1px solid ${o?"#a93226":"#f5c6cb"};\n        border-radius: 6px;\n        color: ${o?"#f28b82":"#c5221f"};\n        font-size: 12px;\n        font-weight: 500;\n        cursor: pointer;\n        transition: background 0.15s;\n      ">Stop</button>\n    </div>\n  `), !document.getElementById("sg-chain-spin-style")) {
    const e = document.createElement("style");
    e.id = "sg-chain-spin-style", e.textContent = "\n      @keyframes sg-spin {\n        from { transform: rotate(0deg); }\n        to { transform: rotate(360deg); }\n      }\n    ", document.head.appendChild(e)
  }
  n.querySelector("#sg-chain-skip-btn")?.addEventListener("click", () => {
    const e = window.sgChainState;
    if (e && e.isRunning) {
      e.checkInterval && (clearInterval(e.checkInterval), e.checkInterval = null);
      const t = e.currentStep + 1;
      e.currentStep = t, executeChainStep(t)
    }
  }), n.querySelector("#sg-chain-stop-btn")?.addEventListener("click", () => {
    resetChainExecution(), showToast("Chain stopped", "info")
  })
}

function updateChainProgressIndicator(e, t, n) {
  const o = document.getElementById("sg-chain-progress");
  if (!o) return;
  const r = o.querySelector("div:nth-child(2)");
  r && (r.textContent = `Step ${e+1} of ${t}`);
  const s = o.querySelector("#sg-chain-status");
  s && (s.textContent = n)
}

function resetChainExecution() {
  const e = window.sgChainState;
  e && e.checkInterval && clearInterval(e.checkInterval), window.sgChainState = null;
  const t = document.getElementById("sg-chain-progress");
  t && (t.style.transition = "opacity 0.2s", t.style.opacity = "0", setTimeout(() => t.remove(), 200))
}

function showChainDeepResearchAutoConfirmNotice() {
  chrome.storage.local.get(["chainDeepResearchAutoConfirmNoticeDismissed"], e => {
    if (e.chainDeepResearchAutoConfirmNoticeDismissed) return;
    const t = createModal("🔬 Deep Research will auto-accept", '\n      <p style="margin: 0 0 12px; font-size: 14px; line-height: 1.5; font-family: var(--sg-font-text);">\n        Normally, Deep Research first proposes a research plan and waits for you to click <strong>"Start research"</strong> before running.\n      </p>\n      <p style="margin: 0; font-size: 14px; line-height: 1.5; font-family: var(--sg-font-text);">\n        When this chain step runs, Gemini Power Suite will <strong>automatically click "Start research"</strong> for you so the chain keeps moving without needing your confirmation.\n      </p>\n    ', [{
      text: "Got it",
      class: "sg-btn sg-btn-gray",
      action: "close"
    }]);
    document.body.appendChild(t), t.classList.add("show"), t.style.zIndex = "1000003", chrome.storage.local.set({
      chainDeepResearchAutoConfirmNoticeDismissed: !0
    })
  })
}
async function createFolder(e, t = "#4285f4", n = null) {
  const o = {
    id: generateFolderId(),
    name: e.trim(),
    color: t,
    chats: [],
    parentId: n,
    expanded: !0,
    lastModified: Date.now()
  };
  foldersData.folders.push(o), await saveFoldersData();
  document.querySelector(".sg-folders-modal") && (showFoldersModal(), showToast(`Folder "${e}" created`, "success"))
}
async function moveFolder(e, t, n = "inside") {
  const o = foldersData.folders.findIndex(t => t.id === e);
  if (-1 === o) return;
  const r = foldersData.folders[o];
  if (!t) return r.parentId = null, r.lastModified = Date.now(), foldersData.folders.splice(o, 1), foldersData.folders.push(r), await saveFoldersData(), void refreshFolderModal();
  const s = foldersData.folders.find(e => e.id === t);
  if (!s) return;
  if (e === t) return;
  let a = s;
  if ("inside" === n) {
    for (; a;) {
      if (a.id === e) return void showToast("Cannot move folder into its own subfolder", "error");
      a = foldersData.folders.find(e => e.id === a.parentId)
    }
    r.parentId = t, r.lastModified = Date.now(), s.expanded = !0, foldersData.folders.splice(o, 1), foldersData.folders.push(r)
  } else {
    if (-1 === foldersData.folders.findIndex(e => e.id === t)) return;
    for (a = s; a;) {
      if (a.id === e) return void showToast("Cannot move folder into its own subfolder area", "error");
      a = foldersData.folders.find(e => e.id === a.parentId)
    }
    r.parentId = s.parentId, r.lastModified = Date.now(), foldersData.folders.splice(o, 1);
    const i = foldersData.folders.findIndex(e => e.id === t);
    "top" === n ? foldersData.folders.splice(i, 0, r) : foldersData.folders.splice(i + 1, 0, r)
  }
  await saveFoldersData(), refreshFolderModal()
}

function refreshFolderModal() {
  const e = document.querySelector(".sg-folders-modal");
  e && ("function" == typeof e.refreshTree ? e.refreshTree() : showFoldersModal())
}
async function renameFolder(e, t, n = null) {
  const o = foldersData.folders.find(t => t.id === e);
  o && (o.name = t.trim(), n && (o.color = n), o.lastModified = Date.now(), await saveFoldersData(), showFoldersModal(), showToast("Folder updated", "success"))
}
function _sgNavigateToNewChat() {
  const e = document.querySelector('a[href="https://gemini.google.com/app"]') || document.querySelector('a[href="/app"]');
  if (e) return void e.click();
  const t = document.querySelector('a[data-test-id="expanded-button"][href="/app"]') || document.querySelector('[data-test-id="new-chat-button"] a[href="/app"]') || document.querySelector('[aria-label="New chat"]') || document.querySelector('[aria-label="Create new chat"]');
  if (t) return void t.click();
  window.location.href = getAccountAwareUrl()
}
async function _sgFinalizePermanentChatDeletion(e, n, t = !1) {
  _sgSessionPermanentlyDeletedIds.add(n), Array.isArray(foldersData.folders) && foldersData.folders.forEach(t => {
    if (t.chats) {
      const r = t.chats.length;
      t.chats = t.chats.filter(t => {
        const o = t.id.startsWith("c_") ? t.id.substring(2) : t.id;
        return o !== n && t.id !== e
      }), t.chats.length !== r && (t.lastModified = Date.now())
    }
  }), delete foldersData.recycleBin, foldersData.permanentlyDeleted || (foldersData.permanentlyDeleted = []), foldersData.permanentlyDeleted.includes(n) || (foldersData.permanentlyDeleted.push(n), foldersData.permanentlyDeletedAt || (foldersData.permanentlyDeletedAt = {}), foldersData.permanentlyDeletedAt[n] = Date.now()), await saveFoldersData(), applySidebarFiltering(), !t && window.location.href.includes(n) && _sgNavigateToNewChat()
}
async function _sgDeleteChatViaApi(e) {
  const t = await _ucGetTokens(),
    n = Math.floor(99999 * Math.random()) + 1e5,
    o = getAccountRpcPrefix(),
    r = `https://gemini.google.com${o}/_/BardChatUi/data/batchexecute?rpcids=GzXR5e&source-path=${encodeURIComponent(o+"/app")}&bl=${encodeURIComponent(t.bl)}&f.sid=${encodeURIComponent(t.sid)}&hl=en&_reqid=${n}&rt=c`,
    s = JSON.stringify(["c_" + e]),
    a = JSON.stringify([
      [
        ["GzXR5e", s, null, "generic"]
      ]
    ]),
    i = "f.req=" + encodeURIComponent(a) + "&at=" + encodeURIComponent(t.at) + "&",
    l = await fetch(r, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "X-Same-Domain": "1"
      },
      body: i
    });
  if (!l.ok) throw new Error("HTTP " + l.status);
  const c = await l.text();
  if (!c.includes('"GzXR5e","[]"')) throw new Error("Unexpected response: " + c.slice(0, 200))
}
async function permanentlyDeleteChat(e, t = !1) {
  const n = e.startsWith("c_") ? e.substring(2) : e;
  try {
    return await _sgDeleteChatViaApi(n), await _sgFinalizePermanentChatDeletion(e, n, t), void(t || showToast("Chat permanently deleted", "success"))
  } catch (e) {
    console.warn("[Gemini Power Suite] API delete failed, falling back to UI flow:", e)
  }
  window.sgForcedVisibleChatId = n, applySidebarFiltering();
  const o = document.createElement("style");
  o.textContent = '\n    .cdk-overlay-container, [role="dialog"], .mat-mdc-dialog-container, .cdk-overlay-pane {\n      visibility: hidden !important;\n      opacity: 0 !important;\n      pointer-events: none !important;\n    }\n  ', document.head.appendChild(o);
  const r = () => {
    window.sgForcedVisibleChatId = null, o.parentNode && o.remove(), applySidebarFiltering()
  };

  function s(t) {
    const o = t.querySelectorAll('div.conversation, [class*="conversation-item"], gem-nav-list-item[data-test-id="conversation"]');
    for (const t of o) {
      const o = t.getAttribute("jslog") || "",
        r = t.querySelector('a[href*="/app/"]'),
        s = r?.href?.split("/app/").pop()?.split(/[?#]/)[0] || "",
        a = t.getAttribute("data-test-id") || "";
      if (o.includes(e) || o.includes(n) || s === e || s === n || a.includes(e) || a.includes(n)) {
        const e = "GEM-NAV-LIST-ITEM" === t.tagName ? t : t.closest(".conversation-items-container") || t.closest('[class*="conversation-item"]') || t.parentElement;
        return {
          row: t,
          container: e
        }
      }
    }
    return null
  }
  try {
    const o = domQuery("conversationsList");
    if (!o) throw new Error("Could not find sidebar container");
    let a = null,
      i = null,
      l = s(o);
    if (l && (a = l.row, i = l.container), !a) {
      const e = "INFINITE-SCROLLER" === o.tagName ? o : domQuery("sidebarScroller");
      if (e) {
        for (let t = 0; t < 8 && !a; t++) e.scrollTop = e.scrollHeight, e.dispatchEvent(new Event("scroll", {
          bubbles: !0
        })), await new Promise(e => setTimeout(e, 600)), l = s(o), l && (a = l.row, i = l.container);
        e.scrollTop = 0
      }
    }
    if (!a || !i) return console.error("[Gemini Power Suite] Could not find sidebar row for native deletion ❌"), await _sgFinalizePermanentChatDeletion(e, n, t), t || showToast("Chat not found in sidebar — it may have already been deleted by Google.", "info"), void r();
    i.style.display = "flex", i.style.visibility = "visible", a.style.display = "flex", a.style.visibility = "visible", a.scrollIntoView({
      block: "center",
      behavior: "instant"
    });
    const c = a.querySelector('button[matDynamicMenuTriggerFor], button[aria-haspopup="menu"], .mat-mdc-menu-trigger, button[aria-label*="More"], .actions button');
    if (c) c.click();
    else {
      const e = a.nextElementSibling,
        t = e?.querySelector("button");
      if (!t) throw new Error("Could not find 3-dots menu button");
      t.click()
    }
    const d = await new Promise(e => {
      let t = 0;
      const n = setInterval(() => {
        let o = document.querySelector('[data-test-id="delete-button"]');
        if (!o) {
          const e = document.querySelectorAll('.mat-mdc-menu-item, [role="menuitem"]');
          for (const t of e)
            if (t.querySelector('mat-icon[data-mat-icon-name="delete"], mat-icon[fonticon="delete"]')) {
              o = t;
              break
            }
        }
        if (!o) {
          o = Array.from(document.querySelectorAll('.mat-mdc-menu-item, [role="menuitem"]')).find(e => e.textContent.includes("Delete"))
        }(o || t > 20) && (clearInterval(n), e(o)), t++
      }, 100)
    });
    if (!d) throw new Error('Could not find "Delete" option in menu');
    d.click();
    const u = await new Promise(e => {
      let t = 0;
      const n = setInterval(() => {
        const o = document.querySelectorAll('mat-dialog-container:not([class*="sg-"]), .mat-mdc-dialog-container:not([class*="sg-"]), [role="dialog"]:not([class*="sg-"]):not([id^="sg-"])');
        let r = null;
        for (const e of o)
          if (r = findDialogActionButtons(e).confirmBtn, r) break;
        (r || t > 20) && (clearInterval(n), e(r)), t++
      }, 100)
    });
    if (!u) throw new Error("Could not find confirmation button in dialog");
    u.click(), await new Promise(e => {
      let t = 0;
      const n = setInterval(() => {
        (!document.body.contains(a) || null === a.offsetParent || t > 30) && (clearInterval(n), e()), t++
      }, 200)
    }), await _sgFinalizePermanentChatDeletion(e, n, t), t || showToast("Chat permanently deleted", "success")
  } catch (e) {
    console.error("[Gemini Power Suite] Error during native delete:", e), t || showToast("Failed to delete from Google: " + e.message, "error")
  } finally {
    r()
  }
}
async function addChatToFolder(e, t, n, o, r = !1, s = !1) {
  const a = foldersData.folders.find(t => t.id === e);
  if (a) {
    a.chats || (a.chats = []);
    if (a.chats.find(e => e.id === t)) return void(s || showToast(`Chat is already in "${a.name}"`, "info"));
    let e = o;
    if (e && "undefined" !== e && "" !== e && e.includes("/app/") || (e = getAccountAwareUrl(t)), a.chats.push({
        id: t,
        title: n,
        url: e,
        pinned: !1
      }), a.lastModified = Date.now(), applyHiddenChatsCSS(), await saveFoldersData(), !r) {
      const e = document.querySelector(".sg-folders-modal");
      e && (e.remove(), showFoldersModal())
    }
    s || showToast(`Added to "${a.name}"`, "success"), applySidebarFiltering()
  }
}
async function removeChatFromFolder(e, t) {
  const n = foldersData.folders.find(t => t.id === e);
  n && (n.chats || (n.chats = []), n.chats = n.chats.filter(e => e.id !== t), Array.isArray(n.removedChats) || (n.removedChats = []), n.removedChats = n.removedChats.filter(e => e && e.chatId !== t), n.removedChats.push({
    chatId: t,
    removedAt: Date.now()
  }), n.lastModified = Date.now(), await saveFoldersData(), showToast("Chat removed from folder", "success"), applySidebarFiltering())
}

function getAllSidebarChats() {
  return Array.from(document.querySelectorAll('.conversation, gem-nav-list-item[data-test-id="conversation"]')).map(e => {
    if (null === e.offsetParent) return null;
    const t = window.getComputedStyle(e);
    if ("none" === t.display || "hidden" === t.visibility) return null;
    const n = e.querySelector('a[href*="/app/"]');
    let o = "";
    if (n?.href && (o = n.href.split("/app/").pop()?.split(/[?#]/)[0] || "", o.startsWith("c_") && (o = o.substring(2))), !o) {
      const t = (e.getAttribute("jslog") || e.querySelector("[jslog]")?.getAttribute("jslog") || "").match(/"c_([a-z0-9]+)"/i);
      o = t ? t[1] : ""
    }
    const r = e.querySelector(".conversation-title, .title-text");
    return {
      id: o,
      title: r && r.textContent.trim() || n?.getAttribute("aria-label") || e.querySelector("p, span")?.textContent?.trim() || "Untitled Chat",
      url: o ? getAccountAwareUrl(o) : ""
    }
  }).filter(e => e && e.id)
}
async function fetchAllChatsViaMaZiqc(e = () => !0, t = null) {
  const n = await _ucGetTokens(),
    o = getAccountRpcPrefix(),
    r = [];
  let s = null;
  for (let a = 0; a < 50; a++) {
    if (!e()) return r;
    const a = null === s ? "[]" : JSON.stringify([null, s]),
      i = Math.floor(99999 * Math.random()) + 1e5,
      l = `https://gemini.google.com${o}/_/BardChatUi/data/batchexecute?rpcids=MaZiqc&source-path=${encodeURIComponent(o+"/app")}&bl=${encodeURIComponent(n.bl)}&f.sid=${encodeURIComponent(n.sid)}&hl=en&_reqid=${i}&rt=c`,
      c = "f.req=" + encodeURIComponent(JSON.stringify([
        [
          ["MaZiqc", a, null, "generic"]
        ]
      ])) + "&at=" + encodeURIComponent(n.at) + "&",
      d = await fetch(l, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          "X-Same-Domain": "1"
        },
        body: c,
        credentials: "include"
      });
    if (!d.ok) throw new Error("MaZiqc HTTP " + d.status);
    const u = await d.text(),
      p = u.indexOf("[");
    if (-1 === p) throw new Error("MaZiqc parse: no JSON start");
    let g = 0,
      m = !1,
      h = !1,
      f = -1;
    for (let e = p; e < u.length; e++) {
      const t = u[e];
      if (m) {
        if (h) {
          h = !1;
          continue
        }
        if ("\\" === t) {
          h = !0;
          continue
        }
        '"' === t && (m = !1)
      } else if ('"' !== t) {
        if ("[" === t || "{" === t) g++;
        else if (("]" === t || "}" === t) && (g--, 0 === g)) {
          f = e + 1;
          break
        }
      } else m = !0
    }
    if (-1 === f) throw new Error("MaZiqc parse: unbalanced JSON");
    const y = JSON.parse(u.slice(p, f)),
      b = Array.isArray(y) ? y.find(e => Array.isArray(e) && "wrb.fr" === e[0] && "MaZiqc" === e[1]) : null;
    if (!b) throw new Error("MaZiqc parse: no wrb.fr row");
    let v = JSON.parse(b[2]);
    "string" == typeof v && (v = JSON.parse(v));
    const x = v && v[2] || [],
      w = [];
    for (const e of x) {
      if (!Array.isArray(e) || !e[0]) continue;
      let t = e[0];
      t.startsWith("c_") && (t = t.substring(2));
      const n = {
        id: t,
        title: e[1] || "Untitled Chat",
        url: getAccountAwareUrl(t)
      };
      w.push(n), r.push(n)
    }
    const S = v && v[1],
      E = !S;
    if (t) try {
      t(w, {
        isLast: E
      })
    } catch (e) {}
    if (E) return r;
    s = S
  }
  throw new Error("MaZiqc pagination cap (50) reached")
}
async function scrollSidebarToLoadMore(e = () => !1) {
  const t = domQuery("sidebarScroller");
  if (!t) {
    const t = document.querySelector('.conversation, gem-nav-list-item[data-test-id="conversation"]');
    if (t) {
      let n = t.parentElement;
      for (; n && n !== document.body;) {
        if (n.scrollHeight > n.clientHeight) {
          if (e()) return;
          return n.scrollTop = n.scrollHeight, n.dispatchEvent(new Event("scroll", {
            bubbles: !0
          })), void await new Promise(e => setTimeout(e, 300))
        }
        n = n.parentElement
      }
    }
    return
  }
  if (e()) return;
  if (t.scrollTop = t.scrollHeight, t.dispatchEvent(new Event("scroll", {
      bubbles: !0
    })), await new Promise(e => setTimeout(e, 100)), e()) return;
  const n = Array.from(document.querySelectorAll('.conversation, gem-nav-list-item[data-test-id="conversation"]')).pop();
  if (n) {
    n.scrollIntoView({
      block: "end"
    });
    const t = n.closest('[role="navigation"]') || n.parentElement;
    t && !e() && (t.dispatchEvent(new WheelEvent("wheel", {
      deltaY: 500,
      bubbles: !0
    })), t.dispatchEvent(new WheelEvent("wheel", {
      deltaY: 500,
      bubbles: !0
    })))
  }
  e() || await new Promise(e => setTimeout(e, 150))
}

function showMoveToFolderModal(e, t) {
  if (0 === foldersData.folders.length) return void showToast("Create a folder first", "info");
  const n = new Map(getAllSidebarChats().map(e => [e.id, e])),
    o = (e || []).map(e => {
      const t = e && "object" == typeof e,
        o = t ? e.id : e,
        r = n.get(o);
      return {
        id: o,
        title: t && e.title || r?.title || "Untitled Chat",
        url: t && e.url || r?.url || getAccountAwareUrl(o)
      }
    }).filter(e => e.id),
    r = o.map(e => e.id),
    s = new Set;
  foldersData.folders.forEach(e => {
    e.chats && e.chats.some(e => r.includes(e.id)) && s.add(e.id)
  });
  const a = new Set(s),
    i = () => foldersData.folders.map(e => (e => {
      const t = a.has(e.id),
        n = t ? "background: var(--sg-surface-hover); font-weight: 500;" : "";
      return `\n      <button class="sg-folder-select-item" data-folder-id="${escapeHtml(String(e.id || ""))}" data-in-folder="${t}" style="${n}">\n        ${t?'\n          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="width: 18px; height: 18px; flex-shrink: 0; color: var(--sg-primary);">\n            <path d="M20 6L9 17l-5-5"/>\n          </svg>\n        ':'\n           <div style="width: 18px; height: 18px; border: 2px solid var(--sg-outline); border-radius: 4px; box-sizing: border-box;"></div>\n        '}\n        \n        <span style="flex: 1; margin-left: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(e.name)}</span>\n        <span style="font-size: 12px; opacity: 0.7;">${(e.chats||[]).length}</span>\n      </button>\n    `
    })(e)).join(""),
    l = createModal("Move to Folder", `\n    <div style="margin-bottom: 12px; font-family: var(--sg-font-text); font-size: 13px; color: var(--sg-on-surface-variant);">\n      Manage folders for <strong style="color: var(--sg-on-surface);">${r.length} chat(s)</strong>:\n    </div>\n    <div class="sg-folder-select-list" id="sg-folder-select-list" style="display: flex; flex-direction: column; gap: 4px; max-height: 450px; overflow-y: auto;">\n      ${i()}\n    </div>\n  `, [{
      text: "Cancel",
      class: "sg-btn sg-btn-gray",
      action: "close"
    }, {
      text: "Done",
      class: "sg-btn sg-btn-gray",
      action: "save"
    }]);
  document.body.appendChild(l), l.style.zIndex = "1000002", requestAnimationFrame(() => l.classList.add("show"));
  const c = () => {
      l.querySelectorAll(".sg-folder-select-item").forEach(e => {
        e.addEventListener("click", t => {
          t.preventDefault(), t.stopPropagation();
          const n = e.dataset.folderId;
          a.has(n) ? a.delete(n) : a.add(n), (() => {
            const e = l.querySelector("#sg-folder-select-list");
            e && (sgSetSafeHtml(e, i()), c())
          })()
        })
      })
    },
    d = l.querySelector('[data-action="save"]');
  d && d.addEventListener("click", async () => {
    d.disabled = !0, d.style.opacity = "0.7", d.textContent = "Saving...";
    const e = [...s].filter(e => !a.has(e));
    let n = 0;
    for (const t of o) {
      for (const e of a) await addChatToFolder(e, t.id, t.title, t.url, !0, !0);
      for (const n of e) await removeChatFromFolder(n, t.id);
      n++
    }
    t && t(n), closeModal(l)
  }), c()
}
async function showAddChatsModal(e) {
  const t = foldersData.folders.find(t => t.id === e);
  if (!t) return;
  t.chats || (t.chats = []);
  let n = !1;
  try {
    const e = await chrome.storage.local.get("sgAddChatsSortAZ");
    n = !!e.sgAddChatsSortAZ
  } catch (e) {}
  const o = e => e.slice().sort((e, t) => (e.title || "").localeCompare(t.title || "", void 0, {
    sensitivity: "base",
    numeric: !0
  }));
  let r = getAllSidebarChats();
  const s = new Set(r.map(e => e.id)),
    a = new Set(t.chats.map(e => e.id));
  let i = r.filter(e => !a.has(e.id));
  const l = createModal("", "", []),
    c = l.querySelector(".sg-modal-container");
  c && (c.style.width = "90%", c.style.maxWidth = "900px", c.style.height = "67.5vh", c.style.maxHeight = "1200px", c.style.display = "flex", c.style.flexDirection = "column", c.style.padding = "0", c.style.background = "var(--gem-sys-color--surface, #f0f4f8)", c.style.overflow = "hidden",sgSetSafeHtml(c, `\n      \x3c!-- Header --\x3e\n      <div style="\n        display: flex;\n        align-items: center;\n        justify-content: space-between;\n        padding: 16px 24px;\n        border-bottom: 1px solid var(--gem-sys-color--outline-variant, #dce1e9);\n        background: var(--gem-sys-color--surface, #f0f4f8);\n        flex-shrink: 0;\n      ">\n        <div style="display: flex; align-items: center; gap: 12px;">\n          <button id="sg-add-chats-back-btn" style="\n            display: flex;\n            align-items: center;\n            justify-content: center;\n            width: 44px;\n            height: 44px;\n            background: transparent;\n            border: none;\n            border-radius: 50%;\n            color: var(--gem-sys-color--on-surface-variant, #575a5a);\n            cursor: pointer;\n            transition: background 0.15s ease;\n            margin-left: -8px;\n          ">\n            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 24px; height: 24px;">\n              <path d="M15 18l-6-6 6-6"/>\n            </svg>\n          </button>\n          <h2 style="font-family: var(--sg-font-flex); font-size: 20px; font-weight: 500; color: var(--gem-sys-color--on-surface, #1f1f1f); margin: 0;">\n            Add Chats to "${escapeHtml(t.name)}"\n          </h2>\n        </div>\n        <button class="sg-close-modal-btn" style="\n          width: 36px;\n          height: 36px;\n          background: transparent;\n          border: none;\n          border-radius: 50%;\n          color: var(--gem-sys-color--on-surface-variant, #575a5a);\n          cursor: pointer;\n          display: flex;\n          align-items: center;\n          justify-content: center;\n          transition: all 0.15s ease;\n        ">\n          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 20px; height: 20px;">\n            <path d="M18 6L6 18M6 6l12 12"/>\n          </svg>\n        </button>\n      </div>\n      \n      \x3c!-- Search and Controls --\x3e\n      <div style="\n        display: flex;\n        align-items: center;\n        gap: 12px;\n        padding: 12px 32px;\n        background: var(--gem-sys-color--surface, #f0f4f8);\n        flex-shrink: 0;\n      ">\n        <div style="\n          flex: 1;\n          display: flex;\n          align-items: center;\n          gap: 12px;\n          padding: 10px 14px;\n          background: var(--gem-sys-color--surface-container-high, #e9eef6);\n          border-radius: 20px;\n          border: none;\n        ">\n          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px; color: var(--gem-sys-color--on-surface-variant, #575a5a);">\n            <circle cx="11" cy="11" r="8"/>\n            <path d="M21 21l-4.35-4.35"/>\n          </svg>\n          <input type="text" id="sg-add-chats-search" placeholder="Search chats..." style="\n            flex: 1;\n            background: transparent;\n            border: none;\n            outline: none;\n            color: var(--gem-sys-color--on-surface, #1f1f1f);\n            font-size: 13px;\n            font-family: var(--sg-font-text);\n          ">\n        </div>\n      </div>\n      \n      \x3c!-- Loading indicator --\x3e\n      <div id="sg-add-chats-loading" style="\n        display: none;\n        padding: 8px 32px;\n        background: var(--gem-sys-color--surface-container, #e3e8f0);\n        color: var(--gem-sys-color--primary, #4285f4);\n        font-size: 13px;\n        font-family: var(--sg-font-text);\n        flex-shrink: 0;\n      ">\n        <div style="display: flex; align-items: center; gap: 8px;">\n          <div class="sg-loading-spinner" style="\n            width: 14px;\n            height: 14px;\n            border: 2px solid var(--gem-sys-color--outline-variant, #dce1e9);\n            border-top-color: var(--gem-sys-color--primary, #4285f4);\n            border-radius: 50%;\n            animation: sg-spin 1s linear infinite;\n          "></div>\n          <span id="sg-add-chats-status">Loading more chats...</span>\n        </div>\n      </div>\n      \n      \x3c!-- Chat List --\x3e\n      <div id="sg-add-chats-list" style="\n        flex: 1;\n        overflow-y: auto;\n        padding: 2px 8px 0 0;\n      ">\n        ${i.length>0?(n?o(i):i).map(e=>`\n          <div class="sg-add-chat-item" data-chat-id="${escapeHtml(String(e.id || ""))}" data-chat-title="${escapeHtml(e.title)}" data-chat-url="${escapeHtml(String(e.url || ""))}" style="\n            display: flex;\n            align-items: center;\n            padding: 18px 24px;\n            border-radius: 8px;\n            cursor: pointer;\n            transition: background 0.1s;\n            gap: 12px;\n            margin: 0 8px;\n            border-bottom: 1px solid var(--gem-sys-color--outline-variant, #dce1e9);\n          ">\n            <input type="checkbox" class="sg-add-chat-checkbox" data-chat-id="${escapeHtml(String(e.id || ""))}" style="\n              width: 30px;\n              height: 30px;\n              min-width: 30px;\n              min-height: 30px;\n              accent-color: #4285f4;\n              cursor: pointer;\n              flex-shrink: 0;\n              margin-right: 18px;\n            ">\n            <div style="flex: 1; min-width: 0; padding-right: 32px;">\n              <span style="\n                font-family: var(--sg-font-text);\n                font-size: 16px;\n                color: var(--gem-sys-color--on-surface, #1f1f1f);\n                font-weight: 500;\n                white-space: nowrap;\n                word-break: keep-all;\n                overflow: hidden;\n                text-overflow: ellipsis;\n                display: block;\n                max-width: 100%;\n              ">${escapeHtml(e.title)}</span>\n            </div>\n          </div>\n        `).join(""):'\n          <div style="\n            text-align: center;\n            padding: 40px 20px;\n            color: var(--gem-sys-color--on-surface-variant, #575a5a);\n            font-family: var(--sg-font-text);\n          ">\n            <p style="margin: 0;">No available chats to add.</p>\n            <p style="margin: 8px 0 0 0; font-size: 13px; opacity: 0.7;">All your chats are already in this folder.</p>\n          </div>\n        '}\n      </div>\n      \n      \x3c!-- Footer --\x3e\n      <div style="\n        display: flex;\n        align-items: center;\n        justify-content: space-between;\n        padding: 12px 32px;\n        border-top: 1px solid var(--gem-sys-color--outline-variant, #dce1e9);\n        background: var(--gem-sys-color--surface, #f0f4f8);\n        flex-shrink: 0;\n      ">\n        <div style="display: flex; align-items: center; gap: 18px;">\n          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; user-select: none; font-family: var(--sg-font-text);">\n            <input type="checkbox" id="sg-sort-az-chats" ${n?"checked":""} style="\n              width: 20px;\n              height: 20px;\n              accent-color: #4285f4;\n              cursor: pointer;\n            ">\n            <span style="font-size: 14px; color: var(--gem-sys-color--on-surface, #1f1f1f); font-weight: 500;">Sort A-Z</span>\n          </label>\n          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; user-select: none; font-family: var(--sg-font-text);">\n            <input type="checkbox" id="sg-select-all-chats" style="\n              width: 20px;\n              height: 20px;\n              accent-color: #4285f4;\n              cursor: pointer;\n            ">\n            <span style="font-size: 14px; color: var(--gem-sys-color--on-surface, #1f1f1f); font-weight: 500;">Select All</span>\n            <span id="sg-selected-count" style="font-size: 13px; color: var(--gem-sys-color--on-surface-variant, #575a5a); opacity: 0.7;">(0 selected)</span>\n          </label>\n        </div>\n        \n        <div style="display: flex; gap: 12px;">\n          <button id="sg-add-chats-cancel" style="\n            padding: 0 18px;\n            height: 38px;\n            background: var(--gem-sys-color--surface-container-high, #e9eef6);\n            border: none;\n            border-radius: 20px;\n            color: var(--gem-sys-color--on-surface, #1f1f1f);\n            font-size: 13px;\n            font-weight: 500;\n            cursor: pointer;\n            transition: all 0.15s ease;\n          ">Cancel</button>\n          <button id="sg-add-selected-chats" style="\n            padding: 0 18px;\n            height: 38px;\n            background: var(--gem-sys-color--surface-container-high, #e9eef6);\n            border: none;\n            border-radius: 20px;\n            color: var(--gem-sys-color--on-surface, #1f1f1f);\n            font-size: 13px;\n            font-weight: 500;\n            cursor: pointer;\n            transition: all 0.15s ease;\n            opacity: 0.5;\n            pointer-events: none;\n          ">Add Selected</button>\n        </div>\n      </div>\n    `)), document.body.appendChild(l), l.querySelector("#sg-add-chats-search")?.focus(), requestAnimationFrame(() => l.classList.add("show"));
  let d = !1,
    u = 0;
  let p = !0;
  const g = domQuery("sidebarScroller"),
    m = g ? g.scrollTop : 0,
    h = new Map,
    f = () => {
      const e = h.size,
        t = l.querySelector("#sg-selected-count"),
        n = l.querySelector("#sg-add-selected-chats");
      t && (t.textContent = `(${e} selected)`), n && (e > 0 ? (n.style.opacity = "1", n.style.pointerEvents = "auto", n.textContent = `Add Selected (${e})`) : (n.style.opacity = "0.5", n.style.pointerEvents = "none", n.textContent = "Add Selected"), n.style.background = "var(--gem-sys-color--surface-container-high, #e9eef6)", n.style.color = "var(--gem-sys-color--on-surface, #1f1f1f)")
    },
    y = e => {
      const t = e.toLowerCase();
      let r = t ? i.filter(e => e.title.toLowerCase().includes(t)) : i;
      n && (r = o(r)), (e => {
        const t = l.querySelector("#sg-add-chats-list");
        t && (e.length > 0 ? (sgSetSafeHtml(t, e.map(e => {
          const t = h.has(e.id);
          return `\n          <div class="sg-add-chat-item" data-chat-id="${escapeHtml(String(e.id || ""))}" data-chat-title="${escapeHtml(e.title)}" data-chat-url="${escapeHtml(String(e.url || ""))}" style="\n            display: flex;\n            align-items: center;\n            padding: 18px 24px;\n            border-radius: 8px;\n            cursor: pointer;\n            transition: background 0.1s;\n            gap: 12px;\n            margin: 0 8px;\n            border-bottom: 1px solid var(--gem-sys-color--outline-variant, #dce1e9);\n          ">\n            <input type="checkbox" class="sg-add-chat-checkbox" data-chat-id="${escapeHtml(String(e.id || ""))}" style="\n              width: 30px;\n              height: 30px;\n              min-width: 30px;\n              min-height: 30px;\n              accent-color: #4285f4;\n              cursor: pointer;\n              flex-shrink: 0;\n              margin-right: 18px;\n            " ${t?"checked":""}>\n            <div style="flex: 1; min-width: 0; padding-right: 32px;">\n              <span style="\n                font-family: var(--sg-font-text);\n                font-size: 16px;\n                color: var(--gem-sys-color--on-surface, #1f1f1f);\n                font-weight: 500;\n                white-space: nowrap;\n                word-break: keep-all;\n                overflow: hidden;\n                text-overflow: ellipsis;\n                display: block;\n                max-width: 100%;\n              ">${escapeHtml(e.title)}</span>\n            </div>\n          </div>\n        `
        }).join("")), w()) :sgSetSafeHtml(t, '\n        <div style="\n          text-align: center;\n          padding: 40px 20px;\n          color: var(--gem-sys-color--on-surface-variant, #575a5a);\n        ">\n          <p style="margin: 0;">No matching chats found.</p>\n        </div>\n      '), f())
      })(r)
    },
    b = async (e = !1) => {
      if (d || u >= 5) return;
      d = !0, u++;
      const t = l.querySelector("#sg-add-chats-status");
      t && !e && (t.textContent = "Loading more chats...");
      s.size;
      if (await scrollSidebarToLoadMore(() => !p), !p) return;
      await new Promise(e => setTimeout(e, 100));
      const n = getAllSidebarChats();
      let o = 0;
      if (n.forEach(e => {
          s.has(e.id) || a.has(e.id) || (s.add(e.id), i.push(e), o++)
        }), o > 0) {
        u = 0, t && !e && (t.textContent = "Loading more chats...");
        const n = l.querySelector("#sg-add-chats-search"),
          o = n?.value?.trim() || "";
        y(o)
      }
      return d = !1, o > 0
    }, v = l.querySelector("#sg-add-chats-loading"), x = l.querySelector("#sg-add-chats-status");
  v && (v.style.display = "block"), x && (x.textContent = "Loading chats..."), (async () => {
    let e = !1;
    try {
      await fetchAllChatsViaMaZiqc(() => p, t => {
        if (!p) return;
        for (const e of t) s.has(e.id) || (s.add(e.id), r.push(e), a.has(e.id) || i.push(e));
        e = !0;
        const n = l.querySelector("#sg-add-chats-search")?.value?.trim() || "";
        y(n), x && (x.textContent = "Loading more chats...")
      }), p && (u = 5, v && (v.style.display = "none"))
    } catch (t) {
      e ? (console.warn("[SG AddChats] MaZiqc stream stopped early, keeping partial list:", t), p && (u = 5, v && (v.style.display = "none"))) : (console.warn("[SG AddChats] MaZiqc fetch failed, falling back to sidebar scrape:", t), (async () => {
        for (await new Promise(e => setTimeout(e, 800)); p && i.length < 5e3;) {
          if (!await b(!0)) {
            if (u >= 5) break;
            await new Promise(e => setTimeout(e, 500))
          }
          await new Promise(e => setTimeout(e, 100))
        }
        const e = l.querySelector("#sg-add-chats-loading");
        if (e && (e.style.display = "none"), p && g) {
          const e = () => {
            g && (g.scrollTop = m)
          };
          e(), setTimeout(e, 50), setTimeout(e, 200)
        }
      })())
    }
  })();
  const w = () => {
    l.querySelectorAll(".sg-add-chat-item").forEach(e => {
      e.addEventListener("click", t => {
        if ("checkbox" === t.target.type) return;
        const n = e.querySelector(".sg-add-chat-checkbox");
        n && (n.checked = !n.checked, n.checked ? h.set(e.dataset.chatId, {
          id: e.dataset.chatId,
          title: e.dataset.chatTitle,
          url: e.dataset.chatUrl
        }) : h.delete(e.dataset.chatId), f())
      }), e.addEventListener("mouseenter", () => {
        e.style.background = "var(--gem-sys-color--surface-container-highest, #dce1e9)"
      }), e.addEventListener("mouseleave", () => {
        e.style.background = "transparent"
      })
    }), l.querySelectorAll(".sg-add-chat-checkbox").forEach(e => {
      e.addEventListener("change", t => {
        const n = e.closest(".sg-add-chat-item");
        t.target.checked ? h.set(e.dataset.chatId, {
          id: e.dataset.chatId,
          title: n?.dataset.chatTitle || "Untitled Chat",
          url: n?.dataset.chatUrl || getAccountAwareUrl(e.dataset.chatId)
        }) : h.delete(e.dataset.chatId), f()
      })
    })
  };
  w();
  setupShiftClickSelection(l.querySelector("#sg-add-chats-list"), ".sg-add-chat-checkbox", f);
  const S = l.querySelector("#sg-add-chats-search");
  if (S) {
    let e = null;
    S.addEventListener("input", t => {
      const n = t.target.value.trim();
      clearTimeout(e), n && u < 5 ? e = setTimeout(async () => {
        await b(), y(n)
      }, 300) : y(n)
    })
  }
  const E = l.querySelector("#sg-sort-az-chats");
  E && E.addEventListener("change", () => {
    n = E.checked;
    try {
      chrome.storage.local.set({
        sgAddChatsSortAZ: n
      })
    } catch (e) {}
    const e = l.querySelector("#sg-add-chats-search"),
      t = e?.value?.trim() || "";
    y(t)
  });
  const k = l.querySelector("#sg-select-all-chats");
  k && k.addEventListener("change", async e => {
    const t = e.target.checked;
    if (t && u < 5) {
      const e = l.querySelector("#sg-add-chats-status");
      for (e && (e.textContent = "Loading all chats..."); u < 5;) {
        const e = i.length;
        if (await b(), i.length === e) break
      }
      const t = l.querySelector("#sg-add-chats-search"),
        n = t?.value?.trim() || "";
      y(n)
    }
    l.querySelectorAll('.sg-add-chat-item:not([style*="display: none"]) .sg-add-chat-checkbox').forEach(e => {
      e.checked = t;
      const n = e.closest(".sg-add-chat-item");
      t ? h.set(e.dataset.chatId, {
        id: e.dataset.chatId,
        title: n?.dataset.chatTitle || "Untitled Chat",
        url: n?.dataset.chatUrl || getAccountAwareUrl(e.dataset.chatId)
      }) : h.delete(e.dataset.chatId)
    }), f()
  });
  const T = l.querySelector("#sg-add-chats-list");
  T && T.addEventListener("scroll", () => {
    d || u >= 5 || T.scrollHeight - T.scrollTop - T.clientHeight < 100 && b()
  }, { passive: !0 });
  const C = () => {
      if (p = !1, g) {
        const e = () => {
          g && (g.scrollTop = m)
        };
        e(), setTimeout(e, 50), setTimeout(e, 200), setTimeout(e, 500)
      }
      closeModal(l), showFolderChatsModal(e)
    },
    A = l.querySelector(".sg-close-modal-btn");
  A && (A.addEventListener("click", C), A.addEventListener("mouseenter", () => A.style.background = "var(--gem-sys-color--surface-container-highest, #dce1e9)"), A.addEventListener("mouseleave", () => A.style.background = "transparent")), l.querySelector("#sg-add-chats-back-btn")?.addEventListener("click", C), l.querySelector("#sg-add-chats-cancel")?.addEventListener("click", C);
  const L = l.querySelector("#sg-add-chats-back-btn");
  L && (L.addEventListener("mouseenter", () => L.style.background = "var(--gem-sys-color--surface-container-highest, #dce1e9)"), L.addEventListener("mouseleave", () => L.style.background = "transparent"));
  const _ = l.querySelector("#sg-add-chats-cancel");
  _ && (_.addEventListener("mouseenter", () => _.style.background = "var(--gem-sys-color--surface-container-highest, #dce1e9)"), _.addEventListener("mouseleave", () => _.style.background = "var(--gem-sys-color--surface-container-high, #e9eef6)"));
  const M = l.querySelector("#sg-add-selected-chats");
  M && (M.addEventListener("mouseenter", () => {
    M.style.background = "var(--gem-sys-color--surface-container-highest, #dce1e9)"
  }), M.addEventListener("mouseleave", () => {
    M.style.background = "var(--gem-sys-color--surface-container-high, #e9eef6)"
  }), M.addEventListener("click", async () => {
    const e = Array.from(h.values());
    if (0 === e.length) return;
    let n = 0;
    for (const o of e) t.chats.find(e => e.id === o.id) || (t.chats.push({
      id: o.id,
      title: o.title,
      url: o.url,
      pinned: !1
    }), n++);
    if (n > 0) {
      if (t.lastModified = Date.now(), Array.isArray(t.removedChats)) {
        const n = new Set(e.map(e => e.id));
        t.removedChats = t.removedChats.filter(e => !e || !n.has(e.chatId))
      }
      applyHiddenChatsCSS(), await saveFoldersData(), showToast(`Added ${n} chat${n>1?"s":""} to "${t.name}"`, "success"), applySidebarFiltering()
    }
    C()
  }));
  const I = () => {
      document.removeEventListener("keydown", P, !0)
    },
    P = e => {
      "Escape" === e.key && (l.isConnected ? (e.stopImmediatePropagation(), C()) : I())
    };
  document.addEventListener("keydown", P, !0), sgOnModalClose(l, I)
}

function injectFolderStyles() {
  if (document.getElementById("sg-folder-styles")) return;
  const e = document.createElement("link");
  e.id = "sg-folder-styles", e.rel = "stylesheet", e.href = chrome.runtime.getURL("content.css"), document.head.appendChild(e)
}

function updateSidebarSectionSpacing() {
  const e = document.getElementById("sg-sidebar-section");
  e && (e.style.marginTop = premadeGemsButtonHidden ? "-8px" : "0px")
}
let isTourActive = !1,
  currentTourStep = 0,
  currentTourTarget = null;

function createTourOverlay() {
  removeTourOverlay();
  const e = document.createElement("div");
  e.id = "sg-tour-overlay", e.style.cssText = "\n    position: fixed;\n    top: 0;\n    left: 0;\n    width: 100vw;\n    height: 100vh;\n    background: rgba(0, 0, 0, 0.5);\n    z-index: 999998;\n    pointer-events: auto;\n  ", document.body.appendChild(e)
}

function removeTourOverlay() {
  const e = document.getElementById("sg-tour-overlay");
  e && e.remove(), currentTourTarget && (currentTourTarget.style.removeProperty("position"), currentTourTarget.style.removeProperty("z-index"), currentTourTarget.style.removeProperty("pointer-events"), currentTourTarget = null)
}

function spotlightElement(e) {
  currentTourTarget && currentTourTarget !== e && (currentTourTarget.style.removeProperty("position"), currentTourTarget.style.removeProperty("z-index"), currentTourTarget.style.removeProperty("pointer-events")), currentTourTarget = e;
  "static" === window.getComputedStyle(e).position && (e.style.position = "relative"), e.style.zIndex = "999999", e.style.pointerEvents = "auto"
}

function removeTourPopup() {
  const e = document.getElementById("sg-tour-popup");
  e && e.remove()
}

function showTourStep(e, t, n, o = {}) {
  if (removeTourPopup(), !e) return console.warn("[Gemini Power Suite] Tour target not found"), void endTour();
  const r = document.createElement("div");

  function s() {
    const t = e.getBoundingClientRect(),
      n = void 0 !== o.offsetTop ? o.offsetTop : -45,
      s = void 0 !== o.offsetLeft ? o.offsetLeft : 20;
    r.style.top = `${t.top+t.height/2+n}px`, r.style.left = `${t.right+s}px`
  }
  return r.id = "sg-tour-popup", r.className = "sg-onboarding-popup sg-tour-popup",sgSetSafeHtml(r, `\n    <div class="sg-onboarding-popup-content">\n      <div class="sg-onboarding-popup-arrow"></div>\n      <button class="sg-onboarding-popup-close" id="sg-tour-close" aria-label="Close">\n        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">\n          <path d="M18 6L6 18M6 6l12 12"/>\n        </svg>\n      </button>\n      <h3 class="sg-onboarding-popup-title">${t}</h3>\n      <p class="sg-onboarding-popup-message">${n}</p>\n    </div>\n  `), document.body.appendChild(r), spotlightElement(e), o.zIndex && (r.style.zIndex = o.zIndex), s(), window.addEventListener("resize", s), document.getElementById("sg-tour-close").addEventListener("click", endTour), {
    positionPopup: s,
    popup: r
  }
}

function endTour() {
  isTourActive = !1, currentTourStep = 0, removeTourPopup(), removeTourOverlay();
  const e = document.getElementById("sg-folders-modal-overlay");
  e && (e.classList.remove("show"), setTimeout(() => e.remove(), 200)), chrome.storage.sync.set({
    hasSeenOnboardingPopup: !0,
    hasCompletedTour: !0
  })
}

function tourStep1_ClickFolders() {
  currentTourStep = 1;
  const e = document.getElementById("sg-folders-menu-item");
  if (!e) return void endTour();
  const t = document.getElementById("sg-section-content"),
    n = document.querySelector(".sg-section-chevron");
  t && "0px" === t.style.maxHeight && (t.style.maxHeight = "200px", n && (n.style.transform = "rotate(90deg)"), gpsSectionExpanded = !0), showTourStep(e, "Organize with Folders", "Click <strong>Folders</strong> to organize your chats into custom folders.", {
    offsetTop: -60
  });
  const o = () => {
    e.removeEventListener("click", o), removeTourPopup(), setTimeout(() => {
      tourStep2_AddFolder()
    }, 400)
  };
  e.addEventListener("click", o)
}

function tourStep2_AddFolder() {
  currentTourStep = 2;
  const e = setInterval(() => {
    const t = document.getElementById("sg-add-folder-modal-btn");
    if (t) {
      clearInterval(e), showTourStep(t, "Create Your First Folder", "Click <strong>Add Folder</strong> to create your first folder.", {
        offsetTop: -55
      });
      const n = () => {
        t.removeEventListener("click", n), removeTourPopup(), setTimeout(() => {
          tourStep3_CreateFolder()
        }, 300)
      };
      t.addEventListener("click", n)
    }
  }, 100);
  setTimeout(() => clearInterval(e), 3e3)
}

function tourStep3_CreateFolder() {
  currentTourStep = 3;
  const e = setInterval(() => {
    const t = document.getElementById("sg-folder-name"),
      n = document.querySelector('[data-action="submit"]');
    if (t && n) {
      clearInterval(e), showTourStep(t, "Name Your Folder", "Enter a name for your folder and click <strong>Create Folder</strong> to finish!", {
        zIndex: "1000002",
        offsetTop: 90,
        offsetLeft: 25
      });
      const o = () => {
        n.removeEventListener("click", o), endTour()
      };
      n.addEventListener("click", o);
      const r = document.getElementById("sg-create-folder-form");
      if (r) {
        const e = () => {
          r.removeEventListener("submit", e), endTour()
        };
        r.addEventListener("submit", e)
      }
    }
  }, 100);
  setTimeout(() => clearInterval(e), 3e3)
}

function startTour() {
  isTourActive = !0, currentTourStep = 0;
  const e = document.getElementById("sg-onboarding-popup");
  e && e.remove(), createTourOverlay(), chrome.storage.sync.set({
    hasSeenOnboardingPopup: !0
  }), setTimeout(() => {
    tourStep1_ClickFolders()
  }, 300)
}

function sgGetOnboardingSettingsAnchor() {
  if (isNewestGeminiUi()) {
    const e = document.querySelectorAll('[data-test-id="sg-native-settings"]');
    for (const t of e) {
      const e = t.getBoundingClientRect();
      if (e.width > 0 && e.height > 0) return t
    }
    return null
  }
  return document.getElementById("sg-settings-menu-item")
}

function showOnboardingPopup() {
  if (document.getElementById("sg-onboarding-popup")) return;
  if (!sgGetOnboardingSettingsAnchor()) return;
  const e = document.createElement("div");
  e.id = "sg-onboarding-popup", e.className = "sg-onboarding-popup",sgSetSafeHtml(e, '\n    <div class="sg-onboarding-popup-content">\n      <div class="sg-onboarding-popup-arrow"></div>\n      <button class="sg-onboarding-popup-close" id="sg-onboarding-close" aria-label="Close">\n        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">\n          <path d="M18 6L6 18M6 6l12 12"/>\n        </svg>\n      </button>\n      <svg class="sg-onboarding-popup-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">\n        <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>\n        <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>\n      </svg>\n      <h3 class="sg-onboarding-popup-title">Hate the clutter? Make it minimal!</h3>\n      <p class="sg-onboarding-popup-message">Gemini Power Suite is 100% modular. You can toggle <strong>ANY</strong> feature <strong>ON</strong> or <strong>OFF</strong> in the Settings.</p>\n      <div class="sg-onboarding-popup-buttons">\n        \x3c!-- <button class="sg-onboarding-popup-button sg-onboarding-secondary" id="sg-onboarding-tour">Take a tour</button> --\x3e\n        <button class="sg-onboarding-popup-button" id="sg-onboarding-dismiss">Get Started</button>\n      </div>\n    </div>\n  '), document.body.appendChild(e);
  let t = -1,
    n = -1,
    o = null,
    r = 0;

  function s() {
    const r = sgGetOnboardingSettingsAnchor(),
      s = r ? r.getBoundingClientRect() : null;
    let a = !s || 0 === s.width || 0 === s.height || s.bottom <= 0 || s.top >= window.innerHeight || s.right <= 0 || s.left >= window.innerWidth;
    if (!a) {
      const t = s.left + s.width / 2,
        n = s.top + s.height / 2,
        o = document.elementsFromPoint(t, n).find(t => !e.contains(t));
      o && (o === r || r.contains(o)) || (a = !0)
    }
    if (a !== o && (e.style.visibility = a ? "hidden" : "visible", o = a), a) return;
    const i = s.top + s.height / 2 - e.offsetHeight / 2,
      l = s.right + 20;
    i !== t && (e.style.top = `${i}px`, t = i), l !== n && (e.style.left = `${l}px`, n = l)
  }

  function a(t = !1) {
    e.style.animation = "sg-onboarding-fade-in 0.2s ease-out reverse", setTimeout(() => {
      if (e.remove(), r && cancelAnimationFrame(r), t) {
        const e = document.getElementById("sg-settings-menu-item");
        e && e.click()
      }
    }, 200), chrome.storage.sync.set({
      hasSeenOnboardingPopup: !0
    }), sgSafeSendMessage({
      type: "DISMISS_ONBOARDING"
    }), sgArmWelcomeTour()
  }
  s(), requestAnimationFrame(s), r = requestAnimationFrame(function t() {
    document.body.contains(e) && (s(), r = requestAnimationFrame(t))
  }), document.getElementById("sg-onboarding-dismiss").addEventListener("click", a), document.getElementById("sg-onboarding-close").addEventListener("click", a);
  const i = sgGetOnboardingSettingsAnchor();
  i && i.addEventListener("click", () => a(), {
    once: !0
  })
}

function checkAndShowOnboardingPopup() {
  sgSyncGetCached(["hasSeenOnboardingPopup"], e => {
    if (!0 !== e.hasSeenOnboardingPopup)
      if ("visible" === document.visibilityState) runOnboardingFlow();
      else {
        const e = () => {
          "visible" === document.visibilityState && (document.removeEventListener("visibilitychange", e), sgSyncGetCached(["hasSeenOnboardingPopup"], e => {
            !0 !== e.hasSeenOnboardingPopup && runOnboardingFlow()
          }))
        };
        document.addEventListener("visibilitychange", e)
      }
  })
}

function runOnboardingFlow() {
  let e = 0;
  const t = setInterval(() => {
    e++;
    const n = document.querySelector(".sidenav-with-history-container"),
      o = findSidebarToggleButton();
    n ? (clearInterval(t), setTimeout(() => {
      const e = n.classList.contains("collapsed"),
        t = isNewestGeminiUi();
      if (e && !t && o) {
        o.click();
        let e = 0;
        const t = setInterval(() => {
          e++;
          const n = document.getElementById("sg-settings-menu-item"),
            o = !document.querySelector(".sidenav-with-history-container")?.classList.contains("collapsed");
          n && o ? (clearInterval(t), r()) : e > 20 && clearInterval(t)
        }, 100)
      } else r();

      function r() {
        const e = document.getElementById("sg-section-content"),
          t = document.querySelector(".sg-section-chevron");
        e && "0px" === e.style.maxHeight && (e.style.maxHeight = "200px", t && (t.style.transform = "rotate(90deg)"), gpsSectionExpanded = !0, chrome.storage.sync.set({
          gpsDropdownExpanded: !0
        })), isNewestGeminiUi() && !gpsSectionExpanded && (gpsSectionExpanded = !0, "function" == typeof sgApplyNativeSubItemsVisibility && sgApplyNativeSubItemsVisibility(), "function" == typeof sgUpdateNativeChevron && sgUpdateNativeChevron(), chrome.storage.sync.set({
          gpsDropdownExpanded: !0
        })), setTimeout(() => {
          showOnboardingPopup()
        }, 300)
      }
    }, 1e3)) : e > 50 && clearInterval(t)
  }, 100)
}
const SG_SETTINGS_CHANGED_KEY = "sgSettingsChanged",
  SG_SETTINGS_REMINDER_KEY = "sgSettingsReminder",
  SG_SETTINGS_REMINDER_MIN_AGE_MS = 3456e5,
  SG_SETTINGS_REMINDER_ACTIVE_DAYS = 3,
  SG_SETTINGS_DEFAULT_TOGGLES = {
    extensionEnabled: !0,
    sidebarDropdownEnabled: !0,
    foldersEnabled: !0,
    settingsInMenuEnabled: !1,
    queueingEnabled: !0,
    promptsEnabled: !0,
    showExportButton: !0,
    showInfoButton: !0,
    showWideChatButton: !0,
    optimizeEnabled: !0,
    optimizeUseThinking: !1,
    counterEnabled: !0,
    dailyCounterVisible: !0,
    usageCounterShowPct: !0,
    usageCounterShowTime: !1,
    hideUpgradeButtons: !0,
    collapsiblePinnedEnabled: !0,
    dragChatToInputEnabled: !0,
    hideLocationInfo: !0,
    hideActivity: !0,
    downloadAudioEnabled: !0,
    bookmarksEnabled: !0,
    showQueueWindow: !0,
    hidePremadeGemsGallery: !1,
    hideGemsSidebarButton: !0,
    skillsInjectionEnabled: !1,
    baselineInjectionEnabled: !1,
    focusShortcutEnabled: !0
  },
  SG_SETTINGS_DEFAULT_CHOICES = {
    defaultModel: "none",
    defaultReasoningEffort: "none",
    optimizeModel: "lite",
    tempChatModel: "none"
  },
  SG_SETTINGS_DEFAULT_SHORTCUTS = {
    optimizeShortcut: "alt+o",
    foldersShortcut: "alt+f",
    promptsShortcut: "alt+l",
    grammarShortcut: "ctrl+shift+g",
    cycleModeShortcut: "alt+p",
    imageShortcut: "alt+i",
    noToolShortcut: "alt+n",
    deepResearchShortcut: "alt+r",
    canvasShortcut: "alt+c",
    videoShortcut: "alt+v",
    musicShortcut: "alt+m",
    sidebarShortcut: "ctrl+b",
    instructionsShortcut: "ctrl+alt+i",
    newchatShortcut: "ctrl+alt+n",
    tempChatShortcut: "alt+a",
    thinkingLevelShortcut: "alt+t",
    settingsShortcut: "alt+s"
  };

function sgSettingsShortcutCombo(e) {
  return e && "string" == typeof e.key ? (e.ctrl ? "ctrl+" : "") + (e.alt ? "alt+" : "") + (e.shift ? "shift+" : "") + (e.meta ? "meta+" : "") + e.key.toLowerCase() : null
}

function sgSettingsDifferFromDefaults(e) {
  if (!e) return !1;
  for (const [t, n] of Object.entries(SG_SETTINGS_DEFAULT_TOGGLES))
    if (n ? !1 === e[t] : !0 === e[t]) return !0;
  for (const [t, n] of Object.entries(SG_SETTINGS_DEFAULT_CHOICES))
    if ("string" == typeof e[t] && e[t] !== n) return !0;
  for (const [t, n] of Object.entries(SG_SETTINGS_DEFAULT_SHORTCUTS)) {
    if (!1 === e[t + "Enabled"]) return !0;
    const o = sgSettingsShortcutCombo(e[t]);
    if (o && o !== n) return !0
  }
  return !1
}

function sgSettingsReminderStorageKeys() {
  const e = Object.keys(SG_SETTINGS_DEFAULT_SHORTCUTS);
  return [...Object.keys(SG_SETTINGS_DEFAULT_TOGGLES), ...Object.keys(SG_SETTINGS_DEFAULT_CHOICES), ...e, ...e.map(e => e + "Enabled")]
}

function sgAddActiveDay(e, t) {
  const n = Array.isArray(e) ? e.slice() : [];
  return !n.includes(t) && n.length < 3 && n.push(t), n
}

function sgSettingsReminderDue(e, t) {
  return !(!e || e.shown || "number" != typeof e.since) && (t - e.since >= 3456e5 && Array.isArray(e.days) && e.days.length >= 3)
}
async function sgCheckSettingsChanged() {
  if (!0 === (await chrome.storage.local.get(SG_SETTINGS_CHANGED_KEY))[SG_SETTINGS_CHANGED_KEY]) return !0;
  return !!sgSettingsDifferFromDefaults(await sgSyncGetCached(sgSettingsReminderStorageKeys())) && (await chrome.storage.local.set({
    [SG_SETTINGS_CHANGED_KEY]: !0
  }), !0)
}
async function sgInitSettingsReminder() {
  try {
    if (await sgCheckSettingsChanged()) return;
    const e = (await chrome.storage.local.get(SG_SETTINGS_REMINDER_KEY))[SG_SETTINGS_REMINDER_KEY] || {};
    if (e.shown) return;
    const t = Date.now();
    if ("number" != typeof e.since && (e.since = t), e.days = sgAddActiveDay(e.days, getTodayDateString()), await chrome.storage.local.set({
        [SG_SETTINGS_REMINDER_KEY]: e
      }), !sgSettingsReminderDue(e, t)) return;
    if (!0 !== (await sgSyncGetCached(["hasSeenOnboardingPopup"])).hasSeenOnboardingPopup) return;
    const n = () => setTimeout(sgTryShowSettingsReminder, 8e3);
    if ("visible" === document.visibilityState) n();
    else {
      const e = () => {
        "visible" === document.visibilityState && (document.removeEventListener("visibilitychange", e), n())
      };
      document.addEventListener("visibilitychange", e)
    }
  } catch (e) {
    console.error("[Gemini Power Suite] Settings reminder check failed:", e)
  }
}
async function sgTryShowSettingsReminder() {
  if (!isExtensionEnabled) return;
  if (document.getElementById("sg-settings-reminder-popup")) return;
  if (await sgCheckSettingsChanged()) return;
  const e = await chrome.storage.local.get(SG_SETTINGS_REMINDER_KEY);
  if (!sgSettingsReminderDue(e[SG_SETTINGS_REMINDER_KEY], Date.now())) return;
  if (sgAnyOverlayPopupOpen()) return;
  const t = document.querySelector(".sidenav-with-history-container"),
    n = findSidebarToggleButton();
  !isNewestGeminiUi() && t && t.classList.contains("collapsed") && n && n.click();
  const o = document.getElementById("sg-section-content"),
    r = document.querySelector(".sg-section-chevron");
  o && "0px" === o.style.maxHeight && (o.style.maxHeight = "200px", r && (r.style.transform = "rotate(90deg)"), gpsSectionExpanded = !0, chrome.storage.sync.set({
    gpsDropdownExpanded: !0
  })), isNewestGeminiUi() && !gpsSectionExpanded && (gpsSectionExpanded = !0, "function" == typeof sgApplyNativeSubItemsVisibility && sgApplyNativeSubItemsVisibility(), "function" == typeof sgUpdateNativeChevron && sgUpdateNativeChevron(), chrome.storage.sync.set({
    gpsDropdownExpanded: !0
  }));
  let s = 0;
  const a = setInterval(() => {
    s++;
    const t = sgGetOnboardingSettingsAnchor(),
      n = t ? t.getBoundingClientRect() : null;
    n && n.width > 0 && n.height > 0 ? (clearInterval(a), _renderSettingsReminderPopup(e[SG_SETTINGS_REMINDER_KEY])) : s > 20 && clearInterval(a)
  }, 100)
}

function _renderSettingsReminderPopup(e) {
  if (document.getElementById("sg-settings-reminder-popup")) return;
  if (sgAnyOverlayPopupOpen()) return;
  chrome.storage.local.set({
    [SG_SETTINGS_REMINDER_KEY]: {
      ...e,
      shown: !0,
      shownAt: Date.now()
    }
  });
  const t = document.createElement("div");
  t.id = "sg-settings-reminder-popup", t.className = "sg-onboarding-popup",sgSetSafeHtml(t, '\n    <div class="sg-onboarding-popup-content">\n      <div class="sg-onboarding-popup-arrow"></div>\n      <button class="sg-onboarding-popup-close" id="sg-settings-reminder-close" aria-label="Close">\n        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">\n          <path d="M18 6L6 18M6 6l12 12"/>\n        </svg>\n      </button>\n      <svg class="sg-onboarding-popup-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">\n        <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>\n        <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>\n      </svg>\n      <h3 class="sg-onboarding-popup-title">Too much on screen?</h3>\n      <p class="sg-onboarding-popup-message">Every Gemini Power Suite feature can be turned <strong>ON</strong> or <strong>OFF</strong>. Open Settings and keep only what you use.</p>\n      <div class="sg-onboarding-popup-buttons">\n        <button class="sg-onboarding-popup-button" id="sg-settings-reminder-open">Open Settings</button>\n        <button class="sg-onboarding-popup-button sg-onboarding-secondary" id="sg-settings-reminder-dismiss">Got it</button>\n      </div>\n    </div>\n  '), document.body.appendChild(t);
  let n = -1,
    o = -1,
    r = null,
    s = 0;

  function a() {
    const e = sgGetOnboardingSettingsAnchor(),
      s = e ? e.getBoundingClientRect() : null;
    let a = !s || 0 === s.width || 0 === s.height || s.bottom <= 0 || s.top >= window.innerHeight || s.right <= 0 || s.left >= window.innerWidth;
    if (!a) {
      const n = s.left + s.width / 2,
        o = s.top + s.height / 2,
        r = document.elementsFromPoint(n, o).find(e => !t.contains(e));
      r && (r === e || e.contains(r)) || (a = !0)
    }
    if (a !== r && (t.style.visibility = a ? "hidden" : "visible", r = a), a) return;
    const i = s.top + s.height / 2 - t.offsetHeight / 2,
      l = s.right + 20;
    i !== n && (t.style.top = `${i}px`, n = i), l !== o && (t.style.left = `${l}px`, o = l)
  }

  function i() {
    document.body.contains(t) && (t.style.animation = "sg-onboarding-fade-in 0.2s ease-out reverse", setTimeout(() => {
      t.remove(), s && cancelAnimationFrame(s)
    }, 200))
  }
  a(), requestAnimationFrame(a), s = requestAnimationFrame(function e() {
    document.body.contains(t) && (a(), s = requestAnimationFrame(e))
  }), document.getElementById("sg-settings-reminder-close").addEventListener("click", i), document.getElementById("sg-settings-reminder-dismiss").addEventListener("click", i), document.getElementById("sg-settings-reminder-open").addEventListener("click", () => {
    i(), chrome.runtime.sendMessage({
      type: "OPEN_POPUP"
    })
  })
}
(() => {
  const _sgSettingsReminderSyncChanged = (e, t) => {
    if ("sync" !== t) return;
    const n = sgSettingsReminderStorageKeys();
    Object.keys(e).some(e => n.includes(e)) && sgCheckSettingsChanged().catch(() => {})
  };
  if ("undefined" != typeof SG && SG.storage) {
    SG.storage.onChanged("legacy:settings-reminder-sync", _sgSettingsReminderSyncChanged, { area: "sync" });
  } else if ("undefined" != typeof chrome && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener(_sgSettingsReminderSyncChanged);
  }
})();
const SG_WELCOME_TOUR_SEEN_KEY = "hasSeenWelcomeTour",
  SG_WELCOME_TOUR_PENDING_KEY = "welcomeTourPending",
  SG_WELCOME_TOUR_COOLDOWN_MS = 1e3;
let _sgWelcomeSettingsOpen = !1,
  _sgWelcomeTourPending = !1,
  _sgWelcomeTourTimer = null;

function sgBuildTourSteps() {
  return [{
    id: "folders",
    title: "Organize with Folders",
    body: "Group your chats into custom folders. Click the highlighted <strong>Folders</strong> button — or hit Open Folders — to create your first one.",
    bodyHtml: !0,
    buttonLabel: "Open Folders",
    onPrimary: () => sgTourOpenThenContinue(sgTourClickFolders),
    onTargetClick: () => sgTourOpenThenContinue(sgTourClickFolders),
    onEnter: () => sgTourRevealSidebarItem(sgGetTourFoldersAnchor),
    targets: () => [sgGetTourFoldersAnchor()]
  }, {
    id: "prompts",
    title: "Prompts & Chains",
    body: "Save reusable <strong>prompts</strong> (insert with <code>//</code>) and multi-step <strong>chains</strong> (run with <code>,,</code>) — both live here. Click the highlighted <strong>Prompts</strong> button — or hit Open Prompts — to set them up.",
    bodyHtml: !0,
    buttonLabel: "Open Prompts",
    onPrimary: () => sgTourOpenThenContinue(sgTourClickPrompts),
    onTargetClick: () => sgTourOpenThenContinue(sgTourClickPrompts),
    onEnter: () => sgTourRevealSidebarItem(sgGetTourPromptsAnchor),
    targets: () => [sgGetTourPromptsAnchor()]
  }, {
    id: "final",
    title: "You're all set",
    body: "Tip: Gemini Power Suite comes with handy <b>keyboard shortcuts</b> — <b>Alt+S</b> opens settings, <b>Alt+F</b> folders, <b>Alt+L</b> prompts, <b>Alt+O</b> optimizes your prompt, and more (all rebindable in the settings). Open the guide for the full list and every other feature.",
    bodyHtml: !0,
    buttonLabel: "Got it",
    hideSkip: !0,
    showOpenGuide: !0
  }]
}

function sgTourRevealSidebarItem(e) {
  if (!("function" == typeof isNewestGeminiUi && isNewestGeminiUi())) {
    const e = document.querySelector(".sidenav-with-history-container");
    if (e && e.classList.contains("collapsed")) {
      const e = "function" == typeof findSidebarToggleButton ? findSidebarToggleButton() : null;
      e && e.click()
    }
  }
  sgTourExpandSidebarMenu();
  const t = () => {
    const t = e();
    if (t) try {
      t.scrollIntoView({
        block: "center",
        inline: "nearest"
      })
    } catch (e) {}
  };
  t(), setTimeout(t, 80)
}

function sgGetTourFoldersAnchor() {
  return sgGetTourSidebarAnchor("sg-native-folders", "sg-folders-menu-item")
}

function sgGetTourPromptsAnchor() {
  return sgGetTourSidebarAnchor("sg-native-prompts", "sg-prompts-menu-item")
}

function sgGetTourSidebarAnchor(e, t) {
  if ("function" == typeof isNewestGeminiUi && isNewestGeminiUi()) {
    const t = document.querySelectorAll(`[data-test-id="${e}"]`);
    for (const e of t) {
      const t = e.getBoundingClientRect();
      if (t.width > 0 && t.height > 0) return e
    }
    return null
  }
  const n = document.getElementById(t);
  if (n) {
    const e = n.getBoundingClientRect();
    if (e.width > 0 && e.height > 0) return n
  }
  return null
}

function sgTourExpandSidebarMenu() {
  if ("function" == typeof isNewestGeminiUi && isNewestGeminiUi()) return void(gpsSectionExpanded || (gpsSectionExpanded = !0, "function" == typeof sgApplyNativeSubItemsVisibility && sgApplyNativeSubItemsVisibility(), "function" == typeof sgUpdateNativeChevron && sgUpdateNativeChevron(), chrome.storage.sync.set({
    gpsDropdownExpanded: !0
  })));
  const e = document.getElementById("sg-section-content");
  if (e && "0px" === e.style.maxHeight) {
    e.style.maxHeight = "200px";
    const t = document.querySelector(".sg-section-chevron");
    t && (t.style.transform = "rotate(90deg)");
    const n = document.getElementById("sg-section-toggle");
    n && n.setAttribute("aria-expanded", "true"), gpsSectionExpanded = !0, chrome.storage.sync.set({
      gpsDropdownExpanded: !0
    })
  }
}
let _sgTour = {
  steps: [],
  idx: -1,
  reposition: null,
  pollId: null,
  rafId: null,
  lastKey: "",
  resumePoll: null
};

function sgStartSpotlightTour(e) {
  _sgTour.steps = e || [], _sgTour.idx = -1, 0 !== _sgTour.steps.length ? sgTourShowStep(0) : sgDismissWelcomeModal()
}

function sgTourClearListeners() {
  _sgTour.reposition && (window.removeEventListener("resize", _sgTour.reposition), window.removeEventListener("scroll", _sgTour.reposition, {
    capture: !0
  }), _sgTour.reposition = null), _sgTour.rafId && (cancelAnimationFrame(_sgTour.rafId), _sgTour.rafId = null), _sgTour.pollId && (clearInterval(_sgTour.pollId), _sgTour.pollId = null), _sgTour.resumePoll && (clearInterval(_sgTour.resumePoll), _sgTour.resumePoll = null)
}

function sgTourEnd() {
  sgTourClearListeners();
  const e = document.getElementById("sg-welcome-tour-overlay");
  e && (e.style.opacity = "0", setTimeout(() => e.remove(), 200)), _sgTour.steps = [], _sgTour.idx = -1, _sgTour.lastKey = ""
}

function sgTourAdvance() {
  const e = _sgTour.idx + 1;
  if (e >= _sgTour.steps.length) return sgTourEnd();
  sgTourShowStep(e)
}

function sgTourClickFolders() {
  const e = document.getElementById("sg-folders-menu-item") || sgGetTourFoldersAnchor();
  if (e) {
    try {
      e.click()
    } catch (e) {}
    return !0
  }
  return !1
}

function sgTourClickPrompts() {
  const e = document.getElementById("sg-prompts-menu-item") || sgGetTourPromptsAnchor();
  if (e) {
    try {
      e.click()
    } catch (e) {}
    return !0
  }
  return !1
}

function sgTourOpenThenContinue(e) {
  const t = _sgTour.idx >= 0 && _sgTour.idx < _sgTour.steps.length - 1;
  sgTourClearListeners();
  const n = document.getElementById("sg-welcome-tour-overlay");
  n && n.remove();
  if (!e() || !t) return void sgTourEnd();
  let o = !1,
    r = 0,
    s = 0;
  _sgTour.resumePoll = setInterval(() => {
    if (_sgTour.idx < 0) return clearInterval(_sgTour.resumePoll), void(_sgTour.resumePoll = null);
    return !!document.querySelector(".sg-folders-modal, .sg-modal-overlay") ? (o = !0, void(r = 0)) : o ? void(++r >= 3 && (clearInterval(_sgTour.resumePoll), _sgTour.resumePoll = null, sgTourAdvance())) : (s += 200, void(s > 4e3 && (clearInterval(_sgTour.resumePoll), _sgTour.resumePoll = null, sgTourEnd())))
  }, 200)
}

function sgTourWaitForTargets(e, t) {
  return new Promise(n => {
    const o = performance.now(),
      r = () => {
        const s = (("function" == typeof e ? e() : []) || []).filter(Boolean),
          a = s.filter(e => {
            if (!e || !e.isConnected) return !1;
            const t = e.getBoundingClientRect();
            return t.width > 0 && t.height > 0
          });
        return s.length > 0 && a.length === s.length ? n(a) : performance.now() - o >= t ? n(a.length > 0 ? a : null) : void(_sgTour.rafId = requestAnimationFrame(r))
      };
    r()
  })
}
async function sgTourShowStep(e) {
  const t = _sgTour.steps.length;
  if (e < 0 || e >= t) return sgTourEnd();
  const n = _sgTour.steps[e];
  _sgTour.idx = e, _sgTour.lastKey = "";
  let o = document.getElementById("sg-welcome-tour-overlay");
  if (o || (o = document.createElement("div"), o.id = "sg-welcome-tour-overlay", document.body.appendChild(o)), sgTourClearListeners(),sgSetSafeHtml(o, ""), o.style.cssText = "\n    position: fixed; inset: 0;\n    z-index: 2147483600;\n    background: rgba(0,0,0,0.6);\n    backdrop-filter: blur(2px); -webkit-backdrop-filter: blur(2px);\n    display: block; opacity: 1; transition: opacity 0.2s ease;\n    font-family: var(--sg-font-text);\n  ", "function" == typeof n.onEnter) {
    try {
      n.onEnter()
    } catch (e) {}
    await new Promise(e => requestAnimationFrame(e))
  }
  let r = null;
  if (n.targets && (r = await sgTourWaitForTargets(n.targets, 1800), !r)) return sgTourAdvance();
  sgTourRenderStep(n, e, t, r)
}

function sgTourRenderDim(e, t, n) {
  const o = t.map(e => `<rect x="${e.x}" y="${e.y}" width="${e.w}" height="${e.h}" rx="10" ry="10" fill="black"/>`).join(""),
    r = "sg-tour-mask-" + Math.random().toString(36).slice(2, 8);sgSetSafeHtml(e, `\n    <svg width="100%" height="100%" preserveAspectRatio="none" style="position:absolute;inset:0;display:block;">\n      <defs><mask id="${r}"><rect width="100%" height="100%" fill="white"/>${o}</mask></defs>\n      <rect width="100%" height="100%" fill="black" fill-opacity="${n}" mask="url(#${r})"/>\n    </svg>`)
}

function sgTourRenderStep(e, t, n, o) {
  sgTourClearListeners();
  const r = Array.isArray(o) && o.length > 0,
    s = isDarkTheme(),
    a = getThemeColors(s),
    i = a.solidBg,
    l = a.textPrimary,
    c = a.textSecondary,
    d = c,
    u = c,
    p = s ? "rgba(138,180,248,0.95)" : "rgba(26,115,232,0.95)",
    g = s ? "rgba(138,180,248,0.35)" : "rgba(26,115,232,0.25)",
    m = document.getElementById("sg-welcome-tour-overlay");
  if (!m) return;sgSetSafeHtml(m, ""), m.style.pointerEvents = "auto";
  let h = null,
    f = null,
    y = null,
    b = null;
  r ? (m.style.background = "transparent", m.style.backdropFilter = "", m.style.webkitBackdropFilter = "", m.style.display = "block", m.style.alignItems = "", m.style.justifyContent = "", h = document.createElement("div"), h.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:1;", m.appendChild(h), f = document.createElement("div"), f.style.cssText = `position:fixed;border-radius:10px;box-shadow:0 0 0 3px ${p},0 0 18px 4px ${g};pointer-events:none;transition:top .2s ease,left .2s ease,width .2s ease,height .2s ease;z-index:2;`, m.appendChild(f), y = document.createElement("div"), y.style.cssText = "position:fixed;width:0;height:0;pointer-events:none;z-index:11;", m.appendChild(y), "function" == typeof e.onTargetClick && (b = document.createElement("div"), b.style.cssText = "position:fixed;z-index:12;cursor:pointer;background:transparent;", b.addEventListener("click", () => {
    try {
      e.onTargetClick()
    } catch (e) {}
  }), m.appendChild(b))) : (m.style.background = "rgba(0,0,0,0.6)", m.style.backdropFilter = "blur(2px)", m.style.webkitBackdropFilter = "blur(2px)", m.style.display = "flex", m.style.alignItems = "center", m.style.justifyContent = "center");
  const v = t === n - 1,
    x = e.buttonLabel || (v ? "Finish" : "Next"),
    w = e.hideSkip ? "" : `<button class="sg-tour-skip" style="\n      position:absolute;top:10px;right:14px;border:none;background:transparent;\n      color:${u};font-size:12px;cursor:pointer;padding:4px 6px;border-radius:4px;\n      font-family:inherit;transition:color .15s ease;">Skip tour</button>`,
    S = e.hideSkip ? "0" : "70px",
    E = e.showOpenGuide ? `<button class="sg-tour-open-guide" style="\n      padding:9px 18px;border:none;border-radius:8px;cursor:pointer;\n      background:${s?"rgba(138,180,248,0.18)":"rgba(26,115,232,0.12)"};\n      color:${s?"#8ab4f8":"#1a73e8"};font-family:inherit;font-size:13px;\n      font-weight:600;transition:background .15s ease;">Open guide</button>` : "",
    k = document.createElement("div");
  k.style.cssText = r ? `position:fixed;z-index:10;background:${i};border-radius:14px;\n       padding:18px 20px 16px;max-width:320px;width:320px;box-shadow:0 8px 32px rgba(0,0,0,0.35);\n       box-sizing:border-box;transition:top .2s ease,left .2s ease;` : `position:relative;z-index:10;background:${i};border-radius:16px;\n       padding:24px 28px 20px;max-width:460px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.35);\n       box-sizing:border-box;`,sgSetSafeHtml(k, `\n    ${w}\n    <div style="font-size:11px;font-weight:600;letter-spacing:.5px;color:${d};text-transform:uppercase;margin:0 ${S} 8px 0;">\n      Step ${t+1} of ${n}\n    </div>\n    <h3 style="margin:0 0 9px 0;font-size:${r?"16":"19"}px;font-weight:600;color:${l};">${escapeHtml(e.title)}</h3>\n    <p style="margin:0 0 16px 0;font-size:13.5px;line-height:1.5;color:${c};">\n      ${e.bodyHtml?e.body:escapeHtml(e.body)}\n    </p>\n    <div style="display:flex;justify-content:flex-end;gap:10px;align-items:center;flex-wrap:wrap;">\n      ${E}\n      <button class="sg-tour-primary" style="\n        padding:9px 22px;border:none;border-radius:8px;cursor:pointer;\n        background:linear-gradient(135deg,#4285f4 0%,#1a73e8 100%);color:#fff;\n        font-family:inherit;font-size:13px;font-weight:600;\n        box-shadow:0 1px 3px rgba(0,0,0,0.18);transition:filter .15s ease;">${escapeHtml(x)}</button>\n    </div>\n  `), m.appendChild(k), r && sgTourPosition(o, k, h, f, y, i, b);
  const T = k.querySelector(".sg-tour-primary");
  T.addEventListener("mouseenter", () => {
    T.style.filter = "brightness(1.06)"
  }), T.addEventListener("mouseleave", () => {
    T.style.filter = "none"
  }), T.addEventListener("click", () => {
    if ("function" == typeof e.onPrimary) try {
      e.onPrimary()
    } catch (e) {} else sgTourAdvance()
  });
  const C = k.querySelector(".sg-tour-skip");
  C && (C.addEventListener("mouseenter", () => {
    C.style.color = l
  }), C.addEventListener("mouseleave", () => {
    C.style.color = u
  }), C.addEventListener("click", () => sgTourEnd()));
  const A = k.querySelector(".sg-tour-open-guide");
  if (A) {
    const e = s ? "rgba(138,180,248,0.18)" : "rgba(26,115,232,0.12)",
      t = s ? "rgba(138,180,248,0.28)" : "rgba(26,115,232,0.20)";
    A.addEventListener("mouseenter", () => {
      A.style.background = t
    }), A.addEventListener("mouseleave", () => {
      A.style.background = e
    }), A.addEventListener("click", () => {
      try {
        // guide removed
      } catch (e) {}
    })
  }
  if (r) {
    const e = () => sgTourPosition(o, k, h, f, y, i, b);
    window.addEventListener("resize", e, {
      passive: !0
    }), window.addEventListener("scroll", e, {
      passive: !0,
      capture: !0
    }), _sgTour.reposition = e;
    let t = 0;
    _sgTour.pollId = setInterval(() => {
      t++, e(), t >= 20 && (clearInterval(_sgTour.pollId), _sgTour.pollId = null)
    }, 200)
  }
}

function sgTourPosition(e, t, n, o, r, s, a) {
  const i = (e || []).filter(e => e && e.isConnected);
  if (0 === i.length) return void sgTourAdvance();
  const l = i[0].getBoundingClientRect(),
    c = {
      x: Math.max(0, l.left - 6),
      y: Math.max(0, l.top - 6),
      w: l.width + 12,
      h: l.height + 12
    },
    d = `${Math.round(c.x)},${Math.round(c.y)},${Math.round(c.w)},${Math.round(c.h)}`;
  if (d === _sgTour.lastKey) return;
  _sgTour.lastKey = d, sgTourRenderDim(n, [c], .6), o.style.left = c.x + "px", o.style.top = c.y + "px", o.style.width = c.w + "px", o.style.height = c.h + "px", a && (a.style.left = l.left + "px", a.style.top = l.top + "px", a.style.width = l.width + "px", a.style.height = l.height + "px");
  const u = t.offsetWidth || 320,
    p = t.offsetHeight || 150;
  let g = c.x + c.w + 18,
    m = c.y + c.h / 2 - p / 2,
    h = "left";
  g + u > window.innerWidth - 12 && (g = Math.max(12, Math.min(c.x + c.w / 2 - u / 2, window.innerWidth - u - 12)), m = c.y + c.h + 18, h = "top"), m = Math.max(12, Math.min(m, window.innerHeight - p - 12)), t.style.left = g + "px", t.style.top = m + "px";
  if (r.style.borderTop = "", r.style.borderBottom = "", r.style.borderLeft = "", r.style.borderRight = "", "left" === h) {
    const e = Math.max(m + 16, Math.min(c.y + c.h / 2, m + p - 16));
    r.style.left = g - 9 + "px", r.style.top = e - 9 + "px", r.style.borderTop = "9px solid transparent", r.style.borderBottom = "9px solid transparent", r.style.borderRight = `9px solid ${s}`
  } else {
    const e = Math.max(g + 16, Math.min(c.x + c.w / 2, g + u - 16));
    r.style.left = e - 9 + "px", r.style.top = m - 9 + "px", r.style.borderLeft = "9px solid transparent", r.style.borderRight = "9px solid transparent", r.style.borderBottom = `9px solid ${s}`
  }
}

function sgArmWelcomeTour() {
  sgSyncGetCached([SG_WELCOME_TOUR_SEEN_KEY], e => {
    !0 !== e[SG_WELCOME_TOUR_SEEN_KEY] && (_sgWelcomeTourPending = !0, chrome.storage.local.set({
      [SG_WELCOME_TOUR_PENDING_KEY]: !0
    }), sgMaybeScheduleWelcomeTour())
  })
}

function sgInitWelcomeTour() {
  sgSyncGetCached([SG_WELCOME_TOUR_SEEN_KEY], e => {
    !0 !== e[SG_WELCOME_TOUR_SEEN_KEY] && chrome.storage.local.get([SG_WELCOME_TOUR_PENDING_KEY], e => {
      !0 === e[SG_WELCOME_TOUR_PENDING_KEY] && (_sgWelcomeTourPending = !0, sgMaybeScheduleWelcomeTour())
    })
  })
}

function sgCancelWelcomeTourTimer() {
  _sgWelcomeTourTimer && (clearTimeout(_sgWelcomeTourTimer), _sgWelcomeTourTimer = null)
}

function sgMaybeScheduleWelcomeTour() {
  _sgWelcomeTourPending && (_sgWelcomeSettingsOpen || (sgCancelWelcomeTourTimer(), _sgWelcomeTourTimer = setTimeout(() => {
    _sgWelcomeTourTimer = null, sgStartWelcomeTour()
  }, SG_WELCOME_TOUR_COOLDOWN_MS)))
}

function sgStartWelcomeTour() {
  if (_sgWelcomeTourPending && !_sgWelcomeSettingsOpen && !document.getElementById("sg-welcome-tour-overlay")) {
    if ("visible" !== document.visibilityState) {
      const e = () => {
        "visible" === document.visibilityState && (document.removeEventListener("visibilitychange", e), sgMaybeScheduleWelcomeTour())
      };
      return void document.addEventListener("visibilitychange", e)
    }
    sgSyncGetCached([SG_WELCOME_TOUR_SEEN_KEY], e => {
      _sgWelcomeTourPending = !1, chrome.storage.local.remove(SG_WELCOME_TOUR_PENDING_KEY), !0 !== e[SG_WELCOME_TOUR_SEEN_KEY] && (chrome.storage.sync.set({
        [SG_WELCOME_TOUR_SEEN_KEY]: !0
      }), sgShowWelcomeModal())
    })
  }
}

function sgDismissWelcomeModal() {
  const e = document.getElementById("sg-welcome-tour-overlay");
  if (!e) return;
  const t = e.firstElementChild;
  e.style.opacity = "0", t && (t.style.transform = "scale(0.92)"), setTimeout(() => e.remove(), 200)
}

function sgShowWelcomeModal() {
  if (document.getElementById("sg-welcome-tour-overlay")) return;
  const e = isDarkTheme(),
    t = getThemeColors(e),
    n = t.solidBg,
    o = t.textPrimary,
    r = t.textSecondary,
    s = e ? "#9aa0a6" : "#80868b",
    a = t.border,
    i = e ? "#e8eaed" : "#3c4043",
    l = t.hoverBg,
    c = sgBuildTourSteps(),
    d = c.length > 0,
    u = document.createElement("div");
  u.id = "sg-welcome-tour-overlay", u.style.cssText = "\n    position: fixed; inset: 0;\n    background: rgba(0,0,0,0.65);\n    backdrop-filter: blur(3px);\n    -webkit-backdrop-filter: blur(3px);\n    z-index: 2147483600;\n    display: flex; align-items: center; justify-content: center;\n    opacity: 0; transition: opacity 0.2s ease;\n    font-family: var(--sg-font-text);\n  ";
  const p = document.createElement("div");
  p.style.cssText = `\n    position: relative;\n    background: ${n};\n    border-radius: 16px;\n    padding: 28px 32px 22px 32px;\n    max-width: 500px;\n    width: 90%;\n    box-shadow: 0 8px 32px rgba(0,0,0,0.25);\n    transform: scale(0.92);\n    transition: transform 0.2s ease;\n    box-sizing: border-box;\n  `,sgSetSafeHtml(p, `\n    <button class="sg-welcome-close" aria-label="Close" style="\n      position: absolute; top: 12px; right: 12px;\n      width: 28px; height: 28px;\n      border: none; background: transparent;\n      cursor: pointer; border-radius: 50%;\n      display: flex; align-items: center; justify-content: center;\n      color: ${s}; opacity: 0.7;\n      transition: opacity 0.15s ease, background 0.15s ease; padding: 0;\n    ">\n      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14">\n        <path d="M18 6L6 18M6 6l12 12"/>\n      </svg>\n    </button>\n\n    <div style="font-size:32px;line-height:1;margin-bottom:12px;">👋</div>\n    <h2 style="margin:0 0 10px 0;font-size:20px;font-weight:600;color:${o};">\n      Welcome to Gemini Power Suite!\n    </h2>\n    <p style="margin:0 0 22px 0;font-size:14px;line-height:1.5;color:${r};">\n      Boost Gemini with folders, exports, prompt optimization, slash commands, and more. Take a quick 60-second tour to find your way around.\n    </p>\n\n    <div style="display:flex;gap:10px;justify-content:flex-end;align-items:center;flex-wrap:wrap;">\n      <button class="sg-welcome-secondary" style="\n        padding: 8px 16px;\n        border: 1px solid ${a};\n        background: transparent;\n        color: ${i};\n        border-radius: 8px;\n        font-family: inherit;\n        font-size: 13px;\n        font-weight: 500;\n        cursor: pointer;\n        transition: background 0.15s ease;\n      ">Don't show again</button>\n      <button class="sg-welcome-primary" style="\n        padding: 9px 22px;\n        border: none;\n        background: linear-gradient(135deg, #4285f4 0%, #1a73e8 100%);\n        color: #fff;\n        border-radius: 8px;\n        font-family: inherit;\n        font-size: 13px;\n        font-weight: 600;\n        cursor: pointer;\n        box-shadow: 0 1px 3px rgba(0,0,0,0.18);\n        transition: filter 0.15s ease, transform 0.05s ease;\n      ">Start tour</button>\n    </div>\n  `), u.appendChild(p), document.body.appendChild(u), requestAnimationFrame(() => {
    u.style.opacity = "1", p.style.transform = "scale(1)"
  });
  const g = p.querySelector(".sg-welcome-close"),
    m = p.querySelector(".sg-welcome-primary"),
    h = p.querySelector(".sg-welcome-secondary");
  g.addEventListener("mouseenter", () => {
    g.style.opacity = "1", g.style.background = l
  }), g.addEventListener("mouseleave", () => {
    g.style.opacity = "0.7", g.style.background = "transparent"
  }), m.addEventListener("mouseenter", () => {
    m.style.filter = "brightness(1.06)"
  }), m.addEventListener("mouseleave", () => {
    m.style.filter = "none"
  }), g.addEventListener("click", () => sgDismissWelcomeModal()), m.addEventListener("click", () => {
    d ? sgStartSpotlightTour(c) : sgDismissWelcomeModal()
  }), h && (h.addEventListener("mouseenter", () => {
    h.style.background = l
  }), h.addEventListener("mouseleave", () => {
    h.style.background = "transparent"
  }), h.addEventListener("click", () => sgDismissWelcomeModal()))
}
