function sgExtractCleanElementText(el) {
  if (!el || (typeof Element === "function" ? !(el instanceof Element) : el.nodeType !== 1)) return "";
  const skipSelector = 'button, mat-icon, [role="button"], [aria-hidden="true"], svg, script, style, textarea, input, [contenteditable="true"], dialog, [role="dialog"], mat-dialog-container, .mat-mdc-dialog-container, .cdk-overlay-pane, top-bar-actions, bard-header, side-navigation-content, .sidenav-with-history-container';
  const parts = [];
  const walk = node => {
    if (!node) return;
    if (node.nodeType === 3) {
      parts.push(node.nodeValue || "");
      return;
    }
    if (node.nodeType !== 1) return;
    if (typeof node.matches === "function" && node.matches(skipSelector)) return;
    if (node !== document.body && node !== document.documentElement) {
      if (node.id && node.id.startsWith("sg-")) return;
      const cls = typeof node.className === "string" ? node.className : (typeof node.getAttribute === "function" ? node.getAttribute("class") || "" : "");
      if (/(?:^|\s)sg-/.test(cls)) return;
    }
    for (const child of node.childNodes || []) {
      walk(child);
    }
  };
  walk(el);
  return sgNormalizeInstructionText(parts.join(" "));
}

function sgIsElementDisabled(el) {
  return Boolean(!el || el.disabled || el.getAttribute("aria-disabled") === "true" || el.hasAttribute("disabled"));
}

function sgIsVisibleElement(el) {
  if (!el || (typeof Element === "function" ? !(el instanceof Element) : el.nodeType !== 1) || !el.isConnected) return false;
  if (typeof el.getClientRects === "function" && el.getClientRects().length === 0) return false;
  try {
    const cs = window.getComputedStyle(el);
    return cs.visibility !== "hidden" && cs.display !== "none";
  } catch (err) {
    return true;
  }
}

function sgGetSavedInfoMainScope() {
  return document.querySelector("bard-sidenav-content, mat-sidenav-content, .mat-drawer-content")
    || document.querySelector('main, [role="main"]')
    || document.body;
}

function sgIsInsideExcludedSavedInfoZone(el, options = {}) {
  if (!el || (typeof Element === "function" ? !(el instanceof Element) : el.nodeType !== 1)) return true;
  if (typeof el.closest === "function") {
    const inMainContentPane = Boolean(el.closest("bard-sidenav-content, mat-sidenav-content, .mat-drawer-content"));
    const inDialog = Boolean(options.allowDialog && el.closest('dialog, [role="dialog"], mat-dialog-container, .mat-mdc-dialog-container, .cdk-overlay-pane'));
    if (el.closest('top-bar-actions, bard-header, #gb, .boqOnegoogleliteOgbOneGoogleBar, side-navigation-content, .sidenav-with-history-container, [role="navigation"]')) {
      return true;
    }
    if (!inMainContentPane && !inDialog && el.closest("bard-sidenav, side-navigation-v2")) {
      return true;
    }
    const headerAncestor = el.closest("header");
    if (headerAncestor) {
      if (!inMainContentPane || Boolean(headerAncestor.querySelector('top-bar-actions, a[href*="SignOutOptions"], [aria-label*="Google Account"], [aria-label*="Tài khoản Google"]'))) {
        return true;
      }
    }
    if (!options.allowDialog && el.closest('dialog, [role="dialog"], mat-dialog-container, .mat-mdc-dialog-container, .cdk-overlay-pane')) {
      return true;
    }
  }

  let cur = el;
  while (cur && cur !== document.body && cur !== document.documentElement) {
    if (cur.id && cur.id.startsWith("sg-")) return true;
    const cls = typeof cur.className === "string" ? cur.className : (typeof cur.getAttribute === "function" ? cur.getAttribute("class") || "" : "");
    if (/(?:^|\s)sg-/.test(cls)) return true;
    cur = cur.parentElement;
  }
  return false;
}

function sgGetButtonCleanText(el) {
  if (!el || (typeof Element === "function" ? !(el instanceof Element) : el.nodeType !== 1)) return "";
  const skipSelector = 'mat-icon, svg, [aria-hidden="true"], script, style';
  const parts = [];
  const walk = node => {
    if (!node) return;
    if (node.nodeType === 3) {
      parts.push(node.nodeValue || "");
      return;
    }
    if (node.nodeType !== 1) return;
    if (typeof node.matches === "function" && node.matches(skipSelector)) return;
    for (const child of node.childNodes || []) {
      walk(child);
    }
  };
  walk(el);
  return sgNormalizeInstructionText(parts.join(" "));
}

function sgButtonHasAddIcon(btn) {
  if (!btn || typeof btn.querySelectorAll !== "function") return false;
  for (const icon of btn.querySelectorAll("mat-icon")) {
    const fontIcon = (icon.getAttribute("fonticon") || "").trim().toLowerCase();
    const dataIcon = (icon.getAttribute("data-mat-icon-name") || "").trim().toLowerCase();
    const ligature = sgNormalizeInstructionText(icon.textContent || "").toLowerCase();
    if (fontIcon === "add" || dataIcon === "add" || ligature === "add") return true;
  }
  return false;
}

function sgIsRejectedSavedInfoButton(btn) {
  if (!btn) return true;
  const rejectRe = /(?:^|\s)(delete|remove|cancel|close|dismiss|back|xóa|xoá|hủy|huỷ|đóng|bỏ qua|quay lại|thoát)(?:$|\s|[^\p{L}\p{N}])/iu;
  const clean = sgNormalizeInstructionText(sgGetButtonCleanText(btn));
  const aria = sgNormalizeInstructionText(btn.getAttribute("aria-label") || "");
  if (rejectRe.test(clean) || rejectRe.test(aria)) return true;
  const testId = (btn.getAttribute("data-test-id") || btn.getAttribute("data-testid") || "").trim();
  return /(delete|remove|cancel|close|dismiss)/i.test(testId);
}

function sgNormalizeSavedInfoVoice(raw) {
  return sgNormalizeInstructionText(raw)
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\bi\s+prefer\b/gi, "prefer")
    .replace(/\bi\s+avoid\b/gi, "avoid")
    .replace(/\b(?:i\s+want\s+you\s+to|i\s+would\s+like\s+you\s+to|i\s+like\s+you\s+to|i\s+should|you\s+should|i\s+want\s+to|the\s+user\s+(?:wants|prefers|likes)(?:\s+you\s+to|\s+to)?)\b/gi, "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

function sgTokenizeSavedInfoContent(raw) {
  const stopWords = new Set(["i", "me", "my", "you", "your", "want", "prefer", "should", "would", "like", "please", "always", "to", "must"]);
  const tokens = sgNormalizeInstructionText(raw).toLowerCase().match(/[\p{L}\p{N}_]+/gu) || [];
  const out = new Set();
  for (const t of tokens) {
    if (!stopWords.has(t)) out.add(t);
  }
  return out;
}

function sgSavedInfoTextsEquivalent(targetText, candidateText, options = {}) {
  const normTarget = sgNormalizeInstructionText(targetText);
  const normCand = sgNormalizeInstructionText(candidateText);
  if (!normTarget || !normCand) return false;
  if (normTarget === normCand) return true;

  const voiceTarget = sgNormalizeSavedInfoVoice(normTarget);
  const voiceCand = sgNormalizeSavedInfoVoice(normCand);
  if (voiceTarget && voiceTarget === voiceCand) return true;

  const sa = sgTokenizeSavedInfoContent(normTarget);
  const sb = sgTokenizeSavedInfoContent(normCand);
  const minTokens = options.minTokens ?? 4;
  if (sa.size < minTokens || sb.size < 3) return false;

  let inter = 0;
  for (const t of sa) {
    if (sb.has(t)) inter++;
  }
  const union = sa.size + sb.size - inter;
  if (!union) return false;
  const jaccard = inter / union;
  const recall = inter / sa.size;
  const minLen = Math.min(normTarget.length, normCand.length);
  const maxLen = Math.max(normTarget.length, normCand.length);
  const lenRatio = maxLen ? minLen / maxLen : 0;

  if (options.mode === "new_entry") {
    return jaccard >= 0.60 && recall >= 0.65 && lenRatio >= (minLen >= 60 ? 0.50 : 0.35);
  }
  return jaccard >= 0.85 && recall >= 0.88 && lenRatio >= (minLen >= 60 ? 0.65 : 0.45);
}

function sgReadExistingSavedInfoTexts() {
  const scope = sgGetSavedInfoMainScope();
  const results = new Set();
  if (!scope) return results;

  const itemSelectors = 'saved-info-item, memory-item, [data-test-id*="saved-info"], [data-test-id*="memory"], [data-test-id*="instruction"], [role="listitem"], mat-list-item, mat-card, li';
  for (const el of scope.querySelectorAll(itemSelectors)) {
    if (sgIsInsideExcludedSavedInfoZone(el, { allowDialog: false }) || el.closest("textarea, input")) continue;
    const txt = sgExtractCleanElementText(el);
    if (txt) results.add(txt);
  }
  for (const el of scope.querySelectorAll("p, span, div")) {
    if (sgIsInsideExcludedSavedInfoZone(el, { allowDialog: false }) || el.closest("textarea, input, button")) continue;
    if (el.querySelector('button, input, textarea, [contenteditable="true"]')) continue;
    if (el.tagName === "DIV" && el.querySelector("div, p, ul, ol, li, section, article, table, form")) continue;
    const txt = sgNormalizeInstructionText(el.textContent || "");
    if (txt) results.add(txt);
  }
  return results;
}

function sgHasSavedInfoTextInDom(targetText) {
  const normTarget = sgNormalizeInstructionText(targetText);
  if (!normTarget) return false;
  for (const entry of sgReadExistingSavedInfoTexts()) {
    if (sgSavedInfoTextsEquivalent(normTarget, entry, { mode: "dedupe" })) return true;
  }
  const scope = sgGetSavedInfoMainScope();
  const mainClean = scope ? sgExtractCleanElementText(scope) : "";
  if (!mainClean) return false;
  if (mainClean.includes(normTarget)) return true;
  const voiceTarget = sgNormalizeSavedInfoVoice(normTarget);
  return Boolean(voiceTarget.length >= 20 && sgNormalizeSavedInfoVoice(mainClean).includes(voiceTarget));
}

function sgFindSavedInfoAddButton() {
  const scope = sgGetSavedInfoMainScope();
  if (!scope) return null;

  const candidates = [];
  for (const btn of scope.querySelectorAll('button, [role="button"]')) {
    if (sgIsInsideExcludedSavedInfoZone(btn, { allowDialog: false })) continue;
    if (btn.closest("input-container, input-area-v2, rich-textarea")) continue;
    if (sgIsElementDisabled(btn) || !sgIsVisibleElement(btn)) continue;
    if (sgIsRejectedSavedInfoButton(btn)) continue;
    candidates.push(btn);
  }

  for (const btn of candidates) {
    const directTestId = btn.getAttribute("data-test-id") || btn.getAttribute("data-testid") || "";
    if (/(add|create|new)/i.test(directTestId)) return btn;
    const wrapper = typeof btn.closest === "function" ? btn.closest("[data-test-id], [data-testid]") : null;
    if (wrapper && scope.contains(wrapper) && wrapper !== scope) {
      const wrapTestId = wrapper.getAttribute("data-test-id") || wrapper.getAttribute("data-testid") || "";
      if (/(add|create|new)/i.test(wrapTestId) && wrapper.querySelectorAll('button, [role="button"]').length === 1) {
        return btn;
      }
    }
  }

  for (const btn of candidates) {
    if (sgButtonHasAddIcon(btn)) return btn;
  }

  const prefixRe = /^(add|add info|add instruction|new|thêm|thêm thông tin|thêm chỉ dẫn|thêm hướng dẫn)(?:$|\s|[^\p{L}\p{N}])/iu;
  for (const btn of candidates) {
    const clean = sgGetButtonCleanText(btn).replace(/^\+\s*/, "");
    const aria = sgNormalizeInstructionText(btn.getAttribute("aria-label") || "").replace(/^\+\s*/, "");
    if (prefixRe.test(clean) || prefixRe.test(aria)) return btn;
  }

  const containsRe = /(?:^|\s)(add|thêm)(?:$|\s|[^\p{L}\p{N}])/iu;
  for (const btn of candidates) {
    const clean = sgGetButtonCleanText(btn).replace(/^\+\s*/, "");
    const aria = sgNormalizeInstructionText(btn.getAttribute("aria-label") || "").replace(/^\+\s*/, "");
    if (containsRe.test(clean) || containsRe.test(aria)) return btn;
  }

  return null;
}

function sgFindSavedInfoInput() {
  const dialogRoots = [...document.querySelectorAll('mat-dialog-container, .mat-mdc-dialog-container, dialog, [role="dialog"], .cdk-overlay-pane')]
    .filter(root => !sgIsInsideExcludedSavedInfoZone(root, { allowDialog: true }) && sgIsVisibleElement(root));
  const mainRoot = sgGetSavedInfoMainScope();
  const inputSel = 'textarea, input[type="text"], input:not([type]), [contenteditable="true"]';

  for (const root of dialogRoots) {
    for (const el of root.querySelectorAll(inputSel)) {
      if (sgIsInsideExcludedSavedInfoZone(el, { allowDialog: true })) continue;
      if (!sgIsElementDisabled(el) && sgIsVisibleElement(el)) return el;
    }
  }

  if (mainRoot) {
    for (const el of mainRoot.querySelectorAll(inputSel)) {
      if (sgIsInsideExcludedSavedInfoZone(el, { allowDialog: true })) continue;
      if (el.closest("input-container, input-area-v2, rich-textarea")) continue;
      if (!sgIsElementDisabled(el) && sgIsVisibleElement(el)) return el;
    }
  }

  return null;
}

function sgFillNativeInputValue(el, text) {
  if (!el) return;
  if (typeof el.focus === "function") el.focus();
  if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
    let inserted = false;
    try {
      if (typeof el.select === "function") {
        el.select();
      } else if (typeof el.setSelectionRange === "function") {
        el.setSelectionRange(0, String(el.value || "").length);
      }
      if (typeof document !== "undefined" && typeof document.execCommand === "function") {
        inserted = Boolean(document.execCommand("insertText", false, text));
      }
    } catch (err) {}
    if (!inserted || el.value !== text) {
      try {
        if (typeof InputEvent === "function") {
          el.dispatchEvent(new InputEvent("beforeinput", {
            bubbles: true,
            composed: true,
            cancelable: true,
            inputType: "insertText",
            data: text
          }));
        }
      } catch (err) {}
      if (el.tagName === "TEXTAREA") {
        const desc = typeof HTMLTextAreaElement !== "undefined"
          ? Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")
          : null;
        if (desc && typeof desc.set === "function") desc.set.call(el, text);
        else el.value = text;
      } else {
        const desc = typeof HTMLInputElement !== "undefined"
          ? Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")
          : null;
        if (desc && typeof desc.set === "function") desc.set.call(el, text);
        else el.value = text;
      }
      try {
        if (typeof el.setSelectionRange === "function") {
          const endPos = String(text || "").length;
          el.setSelectionRange(endPos, endPos);
        }
      } catch (err) {}
    }
  } else {
    let inserted = false;
    const isEditable = Boolean(
      el.isContentEditable
      || (typeof el.getAttribute === "function" && el.getAttribute("contenteditable") !== null && el.getAttribute("contenteditable") !== "false")
    );
    if (isEditable && typeof document !== "undefined" && typeof document.execCommand === "function") {
      try {
        document.execCommand("selectAll", false, null);
        inserted = Boolean(document.execCommand("insertText", false, text));
      } catch (err) {}
    }
    if (!inserted) {
      el.textContent = text;
    }
  }
  try {
    if (typeof InputEvent === "function") {
      el.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true, inputType: "insertText", data: text }));
    } else {
      el.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    }
  } catch (err) {
    el.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
  }
  el.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
  try {
    if (typeof KeyboardEvent === "function") {
      el.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, composed: true, key: "a" }));
    }
  } catch (err) {}
}

function sgFindActiveSavedInfoDialog(inputEl) {
  if (inputEl && inputEl.isConnected && typeof inputEl.closest === "function") {
    const ancestor = inputEl.closest('mat-dialog-container, .mat-mdc-dialog-container, dialog, [role="dialog"], .cdk-overlay-pane');
    if (ancestor && !sgIsInsideExcludedSavedInfoZone(ancestor, { allowDialog: true }) && sgIsVisibleElement(ancestor)) {
      return ancestor;
    }
  }
  const dialogs = [...document.querySelectorAll('mat-dialog-container, .mat-mdc-dialog-container, dialog, [role="dialog"]')]
    .filter(d => !sgIsInsideExcludedSavedInfoZone(d, { allowDialog: true }) && sgIsVisibleElement(d));
  return dialogs.find(d => Boolean(d.querySelector('button, [role="button"]'))) || dialogs[0] || null;
}

function sgFindSavedInfoSaveButton(inputEl, options = {}) {
  const activeDialog = sgFindActiveSavedInfoDialog(inputEl);

  const scopes = [];
  const seenScopes = new Set();
  const pushScope = node => {
    if (node && !seenScopes.has(node) && !sgIsInsideExcludedSavedInfoZone(node, { allowDialog: true })) {
      seenScopes.add(node);
      scopes.push(node);
    }
  };

  if (activeDialog) {
    pushScope(activeDialog);
  } else {
    if (inputEl && typeof inputEl.closest === "function") {
      pushScope(inputEl.closest("form"));
    }
    pushScope(sgGetSavedInfoMainScope());
  }

  const saveLabelRe = /^(save|submit|send|add|done|confirm|ok|create|lưu|gửi|thêm|xong|xác nhận|tạo|đồng ý)(?:$|\s|[^\p{L}\p{N}])/iu;

  for (const scope of scopes) {
    const candidates = [];
    let disabledSubmitExists = false;
    for (const btn of scope.querySelectorAll('button, [role="button"]')) {
      if (sgIsInsideExcludedSavedInfoZone(btn, { allowDialog: true })) continue;
      if (!sgIsVisibleElement(btn)) continue;
      if (sgIsElementDisabled(btn)) {
        if (!sgIsRejectedSavedInfoButton(btn)) {
          const testId = (btn.getAttribute("data-test-id") || btn.getAttribute("data-testid") || "").trim();
          const clean = sgNormalizeInstructionText(sgGetButtonCleanText(btn));
          const aria = sgNormalizeInstructionText(btn.getAttribute("aria-label") || "");
          if (btn.getAttribute("type") === "submit" || /(save|submit|confirm)/i.test(testId) || saveLabelRe.test(clean) || saveLabelRe.test(aria)) {
            disabledSubmitExists = true;
          }
        }
        continue;
      }
      if (sgIsRejectedSavedInfoButton(btn)) continue;
      candidates.push(btn);
    }

    for (const btn of candidates) {
      const testId = (btn.getAttribute("data-test-id") || btn.getAttribute("data-testid") || "").trim();
      if (btn.getAttribute("type") === "submit" || /(save|submit|confirm)/i.test(testId)) {
        return btn;
      }
    }

    for (const btn of candidates) {
      const clean = sgNormalizeInstructionText(sgGetButtonCleanText(btn));
      const aria = sgNormalizeInstructionText(btn.getAttribute("aria-label") || "");
      if (saveLabelRe.test(clean) || saveLabelRe.test(aria)) {
        return btn;
      }
    }

    if (activeDialog && candidates.length === 1 && options && options.allowSingleFallback && !disabledSubmitExists) {
      return candidates[0];
    }
  }

  return null;
}

function sgCollectSaveButtonDiagnostics(inputEl) {
  const activeDialog = sgFindActiveSavedInfoDialog(inputEl);
  const scope = activeDialog || sgGetSavedInfoMainScope();
  const out = [];
  if (scope) {
    for (const btn of scope.querySelectorAll('button, [role="button"]')) {
      if (sgIsInsideExcludedSavedInfoZone(btn, { allowDialog: true })) continue;
      if (!sgIsVisibleElement(btn)) continue;
      out.push({
        text: sgNormalizeInstructionText(sgGetButtonCleanText(btn)),
        aria: sgNormalizeInstructionText(btn.getAttribute("aria-label") || ""),
        testId: btn.getAttribute("data-test-id") || btn.getAttribute("data-testid") || "",
        disabled: sgIsElementDisabled(btn),
        inDialog: Boolean(activeDialog)
      });
    }
  }
  const rawVal = inputEl ? String(inputEl.value ?? inputEl.textContent ?? "") : "";
  return {
    inputTag: inputEl ? inputEl.tagName : null,
    inputConnected: Boolean(inputEl && inputEl.isConnected),
    inputValueLen: rawVal.length,
    inputValuePreview: rawVal.slice(0, 60),
    activeElementTag: typeof document !== "undefined" && document.activeElement ? document.activeElement.tagName : null,
    docHasFocus: typeof document !== "undefined" && typeof document.hasFocus === "function" ? document.hasFocus() : null,
    buttons: out
  };
}

function sgCollectMainButtonDiagnostics() {
  const scope = sgGetSavedInfoMainScope();
  if (!scope) return [];
  const out = [];
  for (const btn of scope.querySelectorAll('button, [role="button"]')) {
    if (sgIsInsideExcludedSavedInfoZone(btn, { allowDialog: false })) continue;
    if (!sgIsVisibleElement(btn)) continue;
    const iconEl = btn.querySelector("mat-icon");
    const icon = iconEl
      ? (iconEl.getAttribute("fonticon") || iconEl.getAttribute("data-mat-icon-name") || sgNormalizeInstructionText(iconEl.textContent || ""))
      : "";
    out.push({
      text: sgGetButtonCleanText(btn),
      aria: sgNormalizeInstructionText(btn.getAttribute("aria-label") || ""),
      testId: btn.getAttribute("data-test-id") || btn.getAttribute("data-testid") || "",
      icon
    });
  }
  return out;
}

async function sgWaitForSavedInfoHydration(timeoutMs = 10000) {
  const startTime = Date.now();
  let readyMain = null;
  while (Date.now() - startTime < timeoutMs) {
    if (_sgBaselineMigrationAborted) return { ok: false, reason: "aborted" };
    const main = document.querySelector("bard-sidenav-content, mat-sidenav-content, .mat-drawer-content")
      || document.querySelector('main, [role="main"]');
    if (main) {
      if (sgFindSavedInfoAddButton()) {
        readyMain = main;
        break;
      }
      for (const btn of main.querySelectorAll('button, [role="button"]')) {
        if (sgIsInsideExcludedSavedInfoZone(btn, { allowDialog: false })) continue;
        if (!sgIsElementDisabled(btn) && sgIsVisibleElement(btn)) {
          readyMain = main;
          break;
        }
      }
      if (readyMain) break;
    }
    await sgSleep(200);
  }
  if (!readyMain) return { ok: false, reason: "timeout" };

  const settleStart = Date.now();
  const settleCapMs = Math.min(3500, Math.max(1200, timeoutMs - (Date.now() - startTime)));
  const initialEntriesCount = sgReadExistingSavedInfoTexts().size;
  let lastText = sgExtractCleanElementText(readyMain);
  let stablePolls = 0;

  while (Date.now() - settleStart < settleCapMs) {
    if (_sgBaselineMigrationAborted) return { ok: false, reason: "aborted" };
    const curMain = sgGetSavedInfoMainScope() || readyMain;
    const hasLoader = [...curMain.querySelectorAll('mat-progress-spinner, mat-progress-bar, [role="progressbar"], [aria-busy="true"]')]
      .some(el => !sgIsInsideExcludedSavedInfoZone(el, { allowDialog: false }) && sgIsVisibleElement(el));
    const curText = sgExtractCleanElementText(curMain);
    const curCount = sgReadExistingSavedInfoTexts().size;
    if (hasLoader || curText !== lastText) {
      lastText = curText;
      stablePolls = 0;
    } else {
      stablePolls++;
      const elapsedSettle = Date.now() - settleStart;
      if (stablePolls >= 2 && (curCount > initialEntriesCount || elapsedSettle >= 1000)) {
        return { ok: true };
      }
    }
    await sgSleep(200);
  }
  return { ok: true };
}

async function sgWaitForSavedInfoAppearance(targetText, timeoutMs = 15000, beforeEntries = null) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    if (_sgBaselineMigrationAborted) return { ok: false, reason: "aborted" };
    const dialogOpen = Boolean(sgFindActiveSavedInfoDialog(null));
    if (!dialogOpen) {
      if (sgHasSavedInfoTextInDom(targetText)) {
        return { ok: true };
      }
      if (beforeEntries && typeof beforeEntries.has === "function") {
        const currentEntries = sgReadExistingSavedInfoTexts();
        for (const entry of currentEntries) {
          if (!beforeEntries.has(entry) && sgSavedInfoTextsEquivalent(targetText, entry, { mode: "new_entry", minTokens: 3 })) {
            return { ok: true };
          }
        }
      }
    }
    await sgSleep(300);
  }
  return { ok: false, reason: "timeout" };
}

function sgClearPendingBaselineJob() {
  try {
    chrome.storage.local.remove([SG_BASELINE_PENDING_JOB_KEY]);
  } catch (err) {}
}

async function sgLaunchBaselineMigration(pendingItems, accountInfo, bundleVersion) {
  if (_sgBaselineMigrationRunning) {
    showToast("Baseline migration is already running.", "info");
    return;
  }
  if (!Array.isArray(pendingItems) || !pendingItems.length) {
    showToast("No pending baseline instructions to migrate.", "info");
    return;
  }
  const now = Date.now();
  const job = {
    accountKey: accountInfo.accountKey,
    accountIndex: accountInfo.index,
    accountEmail: accountInfo.email || null,
    accountLabel: accountInfo.label,
    bundleVersion,
    items: pendingItems.map(({ item }) => ({
      id: item.id,
      title: item.title,
      text: item.text,
      version: item.version,
      hash: item.hash
    })),
    confirmed: true,
    createdAt: now,
    expiresAt: now + SG_BASELINE_JOB_TTL_MS
  };
  const saved = await safeLocalStorageSet({ [SG_BASELINE_PENDING_JOB_KEY]: job });
  if (!saved) return;

  if (_sgSkillsModalState.overlay) {
    _sgSkillsModalState.overlay.remove();
    _sgSkillsModalState.overlay = null;
    _sgSkillsModalState.refresh = null;
  }

  if (isOnSavedInfoPage()) {
    sgCheckAndRunPendingBaselineMigration();
    return;
  }

  const targetUrl = sgGetSavedInfoUrl();
  try {
    chrome.runtime.sendMessage({ type: "OPEN_SAVED_INFO_TAB", url: targetUrl }, resp => {
      if (chrome.runtime.lastError || !resp || !resp.ok) {
        window.location.href = targetUrl;
      }
    });
  } catch (err) {
    window.location.href = targetUrl;
  }
}

async function sgCheckAndRunPendingBaselineMigration() {
  if (!isOnSavedInfoPage() || _sgBaselineMigrationRunning) return;
  const job = await new Promise(resolve => {
    try {
      chrome.storage.local.get([SG_BASELINE_PENDING_JOB_KEY], res => {
        resolve(res ? res[SG_BASELINE_PENDING_JOB_KEY] : null);
      });
    } catch (err) {
      resolve(null);
    }
  });
  if (!job || !job.confirmed || !Array.isArray(job.items) || !job.items.length) return;
  if (Date.now() > Number(job.expiresAt || 0)) {
    sgClearPendingBaselineJob();
    return;
  }

  const infoWaitStart = Date.now();
  let currentInfo = sgGetCurrentAccountInfo();
  while (Date.now() - infoWaitStart < 4000) {
    if (currentInfo.email && document.querySelector('bard-sidenav-content, mat-sidenav-content, main, [role="main"]')) break;
    await sgSleep(250);
    currentInfo = sgGetCurrentAccountInfo();
  }

  const indexMatch = String(job.accountIndex || "0") === String(currentInfo.index || "0");
  const emailMatch = !job.accountEmail || !currentInfo.email || job.accountEmail === currentInfo.email;
  if (!indexMatch || !emailMatch) {
    return;
  }

  sgClearPendingBaselineJob();
  _sgBaselineMigrationRunning = true;
  _sgBaselineMigrationAborted = false;

  const total = job.items.length;
  let completed = 0;
  const resolvedAccountKey = currentInfo.email ? currentInfo.accountKey : job.accountKey;
  const hud = sgCreateMigrationHud(total, currentInfo.label, () => {
    _sgBaselineMigrationAborted = true;
  });

  try {
    const hydration = await sgWaitForSavedInfoHydration(10000);
    if (!hydration.ok) {
      if (hydration.reason === "aborted") {
        hud.finish(completed, "Migration stopped by user.", true);
        return;
      }
      console.warn("[SG Baseline Migration] Visible buttons in main:", JSON.stringify(sgCollectMainButtonDiagnostics()));
      const msg = "Could not locate /saved-info controls. Migration aborted safely.";
      hud.finish(completed, msg, true);
      showToast(msg, "error");
      return;
    }

    for (let i = 0; i < total; i++) {
      if (_sgBaselineMigrationAborted) {
        hud.finish(completed, `Stopped by user. ${completed} instruction(s) checkpointed.`, true);
        showToast(`Migration stopped after ${completed}/${total} instruction(s).`, "info");
        return;
      }

      const item = job.items[i];
      hud.update(completed, item.title, "Checking existing Saved Info...");

      if (sgHasSavedInfoTextInDom(item.text)) {
        await sgCheckpointMigratedBaseline(resolvedAccountKey, job.bundleVersion, item);
        completed++;
        hud.update(completed, item.title, "Skipped duplicate (already saved)");
        continue;
      }

      const closeWaitStart = Date.now();
      while (sgFindActiveSavedInfoDialog(null) && Date.now() - closeWaitStart < 2000 && !_sgBaselineMigrationAborted) {
        await sgSleep(150);
      }
      if (_sgBaselineMigrationAborted) {
        hud.finish(completed, `Stopped by user. ${completed} instruction(s) checkpointed.`, true);
        return;
      }

      let addBtn = sgFindSavedInfoAddButton();
      const addStart = Date.now();
      while (!addBtn && Date.now() - addStart < 6000 && !_sgBaselineMigrationAborted) {
        await sgSleep(200);
        addBtn = sgFindSavedInfoAddButton();
      }
      if (_sgBaselineMigrationAborted) {
        hud.finish(completed, `Stopped by user. ${completed} instruction(s) checkpointed.`, true);
        return;
      }
      if (!addBtn) {
        console.warn("[SG Baseline Migration] Visible buttons in main:", JSON.stringify(sgCollectMainButtonDiagnostics()));
        const msg = `Could not locate Add button for "${item.title}". ${completed} checkpointed.`;
        hud.finish(completed, msg, true);
        showToast("Could not locate /saved-info Add button. Migration aborted safely.", "error");
        return;
      }

      addBtn.click();
      hud.update(completed, item.title, "Waiting for input field...");

      let inputEl = sgFindSavedInfoInput();
      const inputStart = Date.now();
      while (!inputEl && Date.now() - inputStart < 5000 && !_sgBaselineMigrationAborted) {
        await sgSleep(200);
        inputEl = sgFindSavedInfoInput();
      }
      if (_sgBaselineMigrationAborted) {
        hud.finish(completed, `Stopped by user. ${completed} instruction(s) checkpointed.`, true);
        return;
      }
      if (!inputEl) {
        const msg = `Could not locate input field for "${item.title}". ${completed} checkpointed.`;
        hud.finish(completed, msg, true);
        showToast("Could not locate /saved-info input field. Migration aborted safely.", "error");
        return;
      }

      await sgSleep(150);
      if (_sgBaselineMigrationAborted) {
        hud.finish(completed, `Stopped by user. ${completed} instruction(s) checkpointed.`, true);
        return;
      }
      inputEl = sgFindSavedInfoInput() || inputEl;

      sgFillNativeInputValue(inputEl, item.text);
      await sgSleep(180);
      if (_sgBaselineMigrationAborted) {
        hud.finish(completed, `Stopped by user. ${completed} instruction(s) checkpointed.`, true);
        return;
      }

      let saveBtn = sgFindSavedInfoSaveButton(inputEl, { allowSingleFallback: false });
      const saveStart = Date.now();
      let fillRetryStage = 0;
      while (!saveBtn && Date.now() - saveStart < 4000 && !_sgBaselineMigrationAborted) {
        await sgSleep(200);
        const elapsed = Date.now() - saveStart;
        if (fillRetryStage === 0 && elapsed >= 600) {
          fillRetryStage = 1;
          inputEl = sgFindSavedInfoInput() || inputEl;
          sgFillNativeInputValue(inputEl, item.text);
        } else if (fillRetryStage === 1 && elapsed >= 1600) {
          fillRetryStage = 2;
          inputEl = sgFindSavedInfoInput() || inputEl;
          sgFillNativeInputValue(inputEl, item.text);
          try {
            if (typeof CompositionEvent === "function") {
              inputEl.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, composed: true, data: item.text }));
            }
            inputEl.dispatchEvent(new Event("blur", { bubbles: true, composed: true }));
            if (typeof inputEl.focus === "function") inputEl.focus();
          } catch (err) {}
        }
        saveBtn = sgFindSavedInfoSaveButton(inputEl, { allowSingleFallback: elapsed >= 1500 });
      }
      if (_sgBaselineMigrationAborted) {
        hud.finish(completed, `Stopped by user. ${completed} instruction(s) checkpointed.`, true);
        return;
      }
      if (!saveBtn) {
        console.warn("[SG Baseline Migration] Save button not found:", JSON.stringify(sgCollectSaveButtonDiagnostics(inputEl)));
        const msg = `Could not locate Save button for "${item.title}". ${completed} checkpointed.`;
        hud.finish(completed, msg, true);
        showToast("Could not locate /saved-info Save button. Migration aborted safely.", "error");
        return;
      }

      hud.update(completed, item.title, "Saving entry...");
      const beforeEntries = sgReadExistingSavedInfoTexts();
      saveBtn.click();
      const appear = await sgWaitForSavedInfoAppearance(item.text, 15000, beforeEntries);
      if (!appear.ok) {
        if (appear.reason !== "aborted") {
          const openDialog = sgFindActiveSavedInfoDialog(null);
          const snackEl = document.querySelector('mat-snack-bar-container, .mdc-snackbar, [role="status"], [role="alert"]');
          console.warn("[SG Baseline Migration] Verify timeout diagnostics:", JSON.stringify({
            itemTitle: item.title,
            clickedAdd: sgGetButtonCleanText(addBtn),
            clickedSave: sgGetButtonCleanText(saveBtn),
            dialogStillOpen: Boolean(openDialog),
            dialogText: openDialog ? sgNormalizeInstructionText(openDialog.innerText ?? openDialog.textContent ?? "").slice(0, 240) : "",
            snackbarText: snackEl ? sgNormalizeInstructionText(snackEl.innerText ?? snackEl.textContent ?? "").slice(0, 200) : "",
            mainTextSnippet: sgExtractCleanElementText(sgGetSavedInfoMainScope()).slice(0, 400)
          }));
        }
        const msg = appear.reason === "aborted"
          ? `Stopped by user. ${completed} instruction(s) checkpointed.`
          : `Timed out verifying "${item.title}". ${completed} checkpointed.`;
        hud.finish(completed, msg, true);
        showToast(msg, appear.reason === "aborted" ? "info" : "error");
        return;
      }

      const saved = await sgCheckpointMigratedBaseline(resolvedAccountKey, job.bundleVersion, item);
      if (!saved) {
        hud.finish(completed, "Failed to save checkpoint to local storage.", true);
        return;
      }
      completed++;
      hud.update(completed, item.title, "Checkpointed");
      if (i < total - 1 && !_sgBaselineMigrationAborted) {
        await sgSleep(600);
      }
    }

    hud.finish(completed, `All ${completed} baseline instruction(s) migrated for ${currentInfo.label}.`, false);
    showToast(`Migrated ${completed} baseline instruction(s) to ${currentInfo.label}.`, "success");
  } finally {
    _sgBaselineMigrationRunning = false;
  }
}

async function sgAutoSyncSavedInfoPageOnOpen() {
  if (!isOnSavedInfoPage() || _sgBaselineMigrationRunning) return;
  const hydration = await sgWaitForSavedInfoHydration(8000);
  if (!hydration.ok) return;
  const [skillData, baselineData] = await Promise.all([
    loadEffectiveSkills(),
    loadEffectiveBaselineInstructions()
  ]);
  const accountInfo = sgGetCurrentAccountInfo();
  const entries = [...sgReadExistingSavedInfoTexts()];
  const record = { entries, scannedAt: Date.now(), source: "current_tab" };
  _sgScannedSavedInfoByAccount.set(accountInfo.accountKey, record);
  _sgScannedSavedInfoByAccount.set(`u_${accountInfo.index}`, record);
  await sgReconcileAndCheckpointSavedItems(
    skillData.skills,
    baselineData.instructions,
    accountInfo,
    skillData.bundleVersion,
    baselineData.bundleVersion,
    entries
  );
  if (typeof _sgSkillsModalState.refresh === "function") {
    _sgSkillsModalState.refresh();
  }
}

async function showSkillsModal(options = {}) {
  const existing = document.getElementById("sg-skills-modal-overlay");
  if (existing) existing.remove();

  const [loaded, loadedBaselines] = await Promise.all([
    loadEffectiveSkills(),
    loadEffectiveBaselineInstructions()
  ]);
  let activeTab = options && options.tab === "baseline" ? "baseline" : "skills";
  let view = options && typeof options.view === "string" ? options.view : "list";
  let editingSkill = null;
  let editingBaseline = null;
  let confirmResetLedger = false;
  let confirmResetBaselineLedger = false;

  const skillMigrateEnabled = new Map();
  const baselineMigrateEnabled = new Map();
  const userTouchedSkillMigrate = new Set();
  const userTouchedBaselineMigrate = new Set();
  let autoScanStatus = "idle";
  let autoScanToken = 0;
  let modalScannedSkills = false;
  let modalScannedBaseline = false;
  let lastSkillsScanRecord = null;
  let lastRenderedTab = activeTab;
  let lastRenderedView = view;

  function restoreBodyScroll(scrollTop) {
    if (!(scrollTop > 0)) return;
    const nextBody = modal.querySelector(".sg-skills-body");
    if (!nextBody) return;
    nextBody.scrollTop = scrollTop;
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => {
        if (nextBody.isConnected) nextBody.scrollTop = scrollTop;
      });
    }
  }

  function syncMigrateSelections(skills, diff, baselines, baselineDiff, resetSaved = true) {
    for (const s of skills || []) {
      const eligible = Boolean(s.enabled && (s.mode === "both" || s.mode === "bootstrap"));
      if (!eligible) {
        skillMigrateEnabled.set(s.id, false);
        continue;
      }
      const st = diff.statusById[s.id];
      const isSaved = st === "synced" || st === "duplicate";
      if (isSaved) {
        if (resetSaved || !userTouchedSkillMigrate.has(s.id)) {
          skillMigrateEnabled.set(s.id, false);
        }
      } else if (!skillMigrateEnabled.has(s.id) || (resetSaved && !userTouchedSkillMigrate.has(s.id))) {
        skillMigrateEnabled.set(s.id, true);
      }
    }

    for (const b of baselines || []) {
      const eligible = Boolean(b && b.enabled && String(b.text || "").trim());
      if (!eligible) {
        if (b && b.id) baselineMigrateEnabled.set(b.id, false);
        continue;
      }
      const st = baselineDiff.statusById[b.id];
      const isSaved = st === "synced" || st === "duplicate";
      if (isSaved) {
        if (resetSaved || !userTouchedBaselineMigrate.has(b.id)) {
          baselineMigrateEnabled.set(b.id, false);
        }
      } else if (!baselineMigrateEnabled.has(b.id) || (resetSaved && !userTouchedBaselineMigrate.has(b.id))) {
        baselineMigrateEnabled.set(b.id, true);
      }
    }
  }

  function getSelectedSkillMigrationItems(skills, diff) {
    const out = [];
    for (const s of skills || []) {
      const eligible = Boolean(s.enabled && (s.mode === "both" || s.mode === "bootstrap"));
      if (!eligible) continue;
      if (!skillMigrateEnabled.get(s.id)) continue;
      const st = diff.statusById[s.id];
      const isSaved = st === "synced" || st === "duplicate";
      out.push({
        skill: s,
        reason: st === "updated" ? "updated" : (st === "removed" ? "removed" : (isSaved ? "re-migrate" : "new")),
        forceMigrate: isSaved
      });
    }
    return out;
  }

  function getSelectedBaselineMigrationItems(baselines, baselineDiff) {
    const out = [];
    for (const item of baselines || []) {
      const eligible = Boolean(item && item.enabled && String(item.text || "").trim());
      if (!eligible) continue;
      if (!baselineMigrateEnabled.get(item.id)) continue;
      const st = baselineDiff.statusById[item.id];
      const isSaved = st === "synced" || st === "duplicate";
      out.push({
        item,
        reason: st === "updated" ? "updated" : (isSaved ? "re-migrate" : "new"),
        forceMigrate: isSaved
      });
    }
    return out;
  }

  async function triggerAutoScanForModal(forceRemote = true, targetScope = activeTab) {
    const myToken = ++autoScanToken;
    const scope = targetScope === "baseline" ? "baseline" : "skills";
    autoScanStatus = "scanning";
    const [skillData, baselineData] = await Promise.all([
      loadEffectiveSkills(),
      loadEffectiveBaselineInstructions()
    ]);
    const accountInfo = sgGetCurrentAccountInfo();

    // 1. Immediate local snapshot render
    const savedTextsNow = sgGetCachedSavedInfoTextsForAccount(accountInfo);
    const cachedSkillsRec = sgGetCachedUserSkillsRecordForAccount(accountInfo);
    const localDiff = sgComputeMigrationDiff(skillData.skills, sgSkillMigrationLedger, accountInfo, null, baselineData.instructions, cachedSkillsRec);
    const localBaselineDiff = sgComputeBaselineMigrationDiff(baselineData.instructions, sgBaselineMigrationLedger, accountInfo, savedTextsNow);
    syncMigrateSelections(skillData.skills, localDiff, baselineData.instructions, localBaselineDiff, true);

    if (!forceRemote) {
      autoScanStatus = "done";
      if (_sgSkillsModalState.overlay) await renderModal();
      return;
    }

    if (_sgSkillsModalState.overlay) {
      await renderModal();
    }

    if (scope === "skills") {
      // 2A. Fresh scan against Gemini /customize/skills
      const skillsRes = await sgRequestRemoteUserSkillsScan(accountInfo, {
        forceFresh: true,
        bundleVersion: skillData.bundleVersion
      });
      if (myToken !== autoScanToken) return;
      modalScannedSkills = true;
      lastSkillsScanRecord = skillsRes;

      const latestSkills = await loadEffectiveSkills();
      if (myToken !== autoScanToken) return;
      const reconciled = await sgReconcileBundledSkillsWithAccount(
        latestSkills.skills,
        accountInfo,
        latestSkills.bundleVersion,
        skillsRes
      );
      const nextBaselineDiff = sgComputeBaselineMigrationDiff(baselineData.instructions, sgBaselineMigrationLedger, accountInfo, savedTextsNow);
      syncMigrateSelections(latestSkills.skills, reconciled.diff, baselineData.instructions, nextBaselineDiff, true);
    } else {
      // 2B. Fresh scan against Gemini /saved-info for Baseline tab
      const remoteRes = await sgRequestRemoteSavedInfoScan(accountInfo, { forceFresh: true });
      if (myToken !== autoScanToken) return;
      modalScannedBaseline = true;

      if (remoteRes && remoteRes.ok) {
        const [latestSkills, latestBaselines] = await Promise.all([
          loadEffectiveSkills(),
          loadEffectiveBaselineInstructions()
        ]);
        await sgReconcileAndCheckpointSavedItems(
          [],
          latestBaselines.instructions,
          accountInfo,
          latestSkills.bundleVersion,
          latestBaselines.bundleVersion,
          remoteRes.entries
        );
        const updatedPool = sgGetCachedSavedInfoTextsForAccount(accountInfo);
        const nextSkillsDiff = sgComputeMigrationDiff(latestSkills.skills, sgSkillMigrationLedger, accountInfo, null, latestBaselines.instructions);
        const nextBaselineDiff = sgComputeBaselineMigrationDiff(latestBaselines.instructions, sgBaselineMigrationLedger, accountInfo, updatedPool);
        syncMigrateSelections(latestSkills.skills, nextSkillsDiff, latestBaselines.instructions, nextBaselineDiff, true);
      }
    }

    autoScanStatus = "done";
    if (_sgSkillsModalState.overlay) {
      await renderModal();
    }
  }

  const overlay = sgSkillEl("div", {
    id: "sg-skills-modal-overlay",
    className: "sg-skills-overlay",
    role: "dialog",
    "aria-modal": "true",
    "aria-label": "Skills Registry and Baseline Instructions",
    onClick: ev => {
      if (ev.target === overlay) closeModal();
    }
  });

  const modal = sgSkillEl("div", { className: "sg-skills-modal" });
  overlay.appendChild(modal);

  const closeModal = () => {
    autoScanToken++;
    overlay.remove();
    _sgSkillsModalState.overlay = null;
    _sgSkillsModalState.refresh = null;
    document.removeEventListener("keydown", onEsc);
  };
  const onEsc = ev => {
    if (ev.key === "Escape") {
      ev.preventDefault();
      if (view !== "list") {
        view = "list";
        editingSkill = null;
        editingBaseline = null;
        renderModal();
      } else {
        closeModal();
      }
    }
  };
  document.addEventListener("keydown", onEsc);

  const importFileInput = sgSkillEl("input", {
    type: "file",
    accept: ".json,application/json",
    style: "display: none;",
    onChange: async ev => {
      const file = ev.target.files && ev.target.files[0];
      ev.target.value = "";
      if (!file) return;
      try {
        const text = await file.text();
        const res = await importSkillsJson(text);
        showToast(`Imported ${res.importedCount} skill record(s).`, "success");
        await triggerAutoScanForModal(false);
      } catch (err) {
        showToast(`Import failed: ${err.message || err}`, "error");
      }
    }
  });
  overlay.appendChild(importFileInput);

  const importBaselineFileInput = sgSkillEl("input", {
    type: "file",
    accept: ".json,application/json",
    style: "display: none;",
    onChange: async ev => {
      const file = ev.target.files && ev.target.files[0];
      ev.target.value = "";
      if (!file) return;
      try {
        const text = await file.text();
        const res = await importBaselineJson(text);
        showToast(`Imported ${res.importedCount} baseline instruction(s).`, "success");
        await triggerAutoScanForModal(false);
      } catch (err) {
        showToast(`Import failed: ${err.message || err}`, "error");
      }
    }
  });
  overlay.appendChild(importBaselineFileInput);

  async function renderModal() {
    const [skillData, baselineData] = await Promise.all([
      loadEffectiveSkills(),
      loadEffectiveBaselineInstructions()
    ]);
    const { bundleVersion, skills, deletedBundledIds } = skillData;
    const {
      bundleVersion: baselineBundleVersion,
      instructions: baselines,
      deletedBundledIds: deletedBaselineIds
    } = baselineData;
    const accountInfo = sgGetCurrentAccountInfo();
    const existingSavedTexts = sgGetCachedSavedInfoTextsForAccount(accountInfo);
    const cachedSkillsRec = sgGetCachedUserSkillsRecordForAccount(accountInfo);
    const diff = sgComputeMigrationDiff(skills, sgSkillMigrationLedger, accountInfo, null, baselines, cachedSkillsRec);
    const baselineDiff = sgComputeBaselineMigrationDiff(baselines, sgBaselineMigrationLedger, accountInfo, existingSavedTexts);
    const skillsAudit = sgBuildBundledSkillsAuditSummary(skills, diff, cachedSkillsRec || lastSkillsScanRecord, bundleVersion);
    syncMigrateSelections(skills, diff, baselines, baselineDiff, false);

    const selectedSkillsToMigrate = getSelectedSkillMigrationItems(skills, diff);
    const selectedBaselinesToMigrate = getSelectedBaselineMigrationItems(baselines, baselineDiff);
    const savedSkillsCount = skills.filter(s => diff.statusById[s.id] === "synced" || diff.statusById[s.id] === "duplicate").length;
    const savedBaselinesCount = baselines.filter(b => baselineDiff.statusById[b.id] === "synced" || baselineDiff.statusById[b.id] === "duplicate").length;
    const baselineAcctEnabled = sgIsBaselineInjectionEnabledForAccount(accountInfo);

    const prevBodyEl = modal.querySelector(".sg-skills-body");
    const prevScrollTop = (prevBodyEl && lastRenderedTab === activeTab && lastRenderedView === view && view === "list")
      ? prevBodyEl.scrollTop
      : 0;
    lastRenderedTab = activeTab;
    lastRenderedView = view;

    modal.replaceChildren();

    const scanPillText = autoScanStatus === "scanning"
      ? (activeTab === "baseline" ? "Scanning /saved-info..." : "Scanning /customize/skills...")
      : activeTab === "baseline"
        ? `Saved Info: ${savedBaselinesCount}/${baselineDiff.totalEligible} saved`
        : skillsAudit.verified
          ? `/customize/skills: ${skillsAudit.installedCount}/${skillsAudit.totalBundled} bundled installed`
          : `Ledger: ${savedSkillsCount}/${diff.totalEligible} synced`;

    const scanPillClass = autoScanStatus === "scanning"
      ? "sg-pill-scanning"
      : activeTab === "skills" && skillsAudit.verified && (skillsAudit.missingBundled.length > 0 || skillsAudit.outdatedBundled.length > 0)
        ? "sg-pill-warn"
        : "sg-pill-ok";

    const header = sgSkillEl("div", { className: "sg-skills-header" }, [
      sgSkillEl("div", { className: "sg-skills-title-wrap" }, [
        sgSkillEl("h2", { className: "sg-skills-title", textContent: "Skills & Baseline Registry" }),
        sgSkillEl("div", { className: "sg-skills-meta-row" }, [
          sgSkillEl("span", {
            className: "sg-skills-pill",
            textContent: `Bundle v${activeTab === "baseline" ? baselineBundleVersion : bundleVersion}`
          }),
          sgSkillEl("span", { className: "sg-skills-pill", textContent: accountInfo.label }),
          sgSkillEl("span", {
            className: `sg-skills-pill ${isSkillsInjectionEnabled ? "sg-pill-ok" : "sg-pill-muted"}`,
            textContent: isSkillsInjectionEnabled ? "Skills Mode 1: ON" : "Skills Mode 1: OFF"
          }),
          sgSkillEl("span", {
            className: `sg-skills-pill ${baselineAcctEnabled ? "sg-pill-ok" : "sg-pill-muted"}`,
            textContent: baselineAcctEnabled ? "Baseline Turn-1: ON" : "Baseline Turn-1: OFF"
          }),
          sgSkillEl("span", {
            className: `sg-skills-pill ${scanPillClass}`,
            textContent: scanPillText
          })
        ])
      ]),
      sgSkillEl("button", {
        type: "button",
        className: "sg-skills-close-btn",
        "aria-label": "Close Skills modal",
        textContent: "×",
        onClick: closeModal
      })
    ]);
    modal.appendChild(header);

    const tabs = sgSkillEl("div", { className: "sg-skills-tabs", role: "tablist" }, [
      sgSkillEl("button", {
        type: "button",
        role: "tab",
        "aria-selected": activeTab === "skills" ? "true" : "false",
        className: `sg-skills-tab${activeTab === "skills" ? " active" : ""}`,
        textContent: `Skills (${skills.length})`,
        onClick: () => {
          activeTab = "skills";
          view = "list";
          editingSkill = null;
          editingBaseline = null;
          confirmResetBaselineLedger = false;
          if (!modalScannedSkills) {
            userTouchedSkillMigrate.clear();
            triggerAutoScanForModal(true, "skills");
          } else {
            renderModal();
          }
        }
      }),
      sgSkillEl("button", {
        type: "button",
        role: "tab",
        "aria-selected": activeTab === "baseline" ? "true" : "false",
        className: `sg-skills-tab${activeTab === "baseline" ? " active" : ""}`,
        textContent: `Baseline Instructions (${baselines.length})`,
        onClick: () => {
          activeTab = "baseline";
          view = "list";
          editingSkill = null;
          editingBaseline = null;
          confirmResetLedger = false;
          if (!modalScannedBaseline) {
            userTouchedBaselineMigrate.clear();
            triggerAutoScanForModal(true, "baseline");
          } else {
            renderModal();
          }
        }
      })
    ]);
    modal.appendChild(tabs);

    if (activeTab === "baseline") {
      if (view === "baseline-editor") {
        renderBaselineEditorView();
        return;
      }
      if (view === "confirm-baseline-migrate") {
        renderBaselineMigrationConfirmView(baselineDiff, selectedBaselinesToMigrate, savedBaselinesCount, accountInfo, baselineBundleVersion);
        return;
      }
      renderBaselineTab(baselines, deletedBaselineIds, baselineDiff, selectedBaselinesToMigrate, savedBaselinesCount, accountInfo);
      restoreBodyScroll(prevScrollTop);
      return;
    }

    if (view === "editor") {
      renderEditorView(bundleVersion);
      return;
    }
    if (view === "confirm-migrate") {
      if (!selectedSkillsToMigrate.length) {
        view = "list";
        if (typeof showToast === "function") {
          showToast("All skills are already synced or have Migrate turned off for this account.", "info");
        }
      } else {
        renderMigrationConfirmView(diff, selectedSkillsToMigrate, savedSkillsCount, accountInfo, bundleVersion);
        return;
      }
    }

    const migrateLabel = selectedSkillsToMigrate.length > 0
      ? `Migrate to Current Account (${selectedSkillsToMigrate.length} pending)`
      : "Account Synced";

    const toolbar = sgSkillEl("div", { className: "sg-skills-toolbar" }, [
      sgSkillEl("div", { className: "sg-skills-toolbar-group" }, [
        sgSkillEl("button", {
          type: "button",
          className: "sg-skills-btn sg-skills-btn-primary",
          textContent: "+ New Skill",
          onClick: () => {
            editingSkill = null;
            view = "editor";
            renderModal();
          }
        }),
        sgSkillEl("button", {
          type: "button",
          className: "sg-skills-btn sg-skills-btn-secondary",
          textContent: "Import JSON",
          onClick: () => importFileInput.click()
        }),
        sgSkillEl("button", {
          type: "button",
          className: "sg-skills-btn sg-skills-btn-secondary",
          textContent: "Export JSON",
          onClick: () => {
            exportSkillsJson(true);
            showToast("Exported skills backup JSON.", "success");
          }
        }),
        sgSkillEl("button", {
          type: "button",
          className: "sg-skills-btn sg-skills-btn-secondary",
          disabled: autoScanStatus === "scanning",
          textContent: autoScanStatus === "scanning" ? "Scanning..." : "Rescan /customize/skills",
          onClick: () => {
            userTouchedSkillMigrate.clear();
            triggerAutoScanForModal(true, "skills");
          }
        })
      ]),
      sgSkillEl("div", { className: "sg-skills-toolbar-group" }, [
        diff.synced.length > 0
          ? sgSkillEl("button", {
              type: "button",
              className: "sg-skills-btn sg-skills-btn-ghost",
              textContent: confirmResetLedger ? "Confirm Reset Ledger?" : "Reset Account Ledger",
              onClick: async () => {
                if (!confirmResetLedger) {
                  confirmResetLedger = true;
                  renderModal();
                  return;
                }
                confirmResetLedger = false;
                userTouchedSkillMigrate.clear();
                skillMigrateEnabled.clear();
                await sgResetAccountLedger(accountInfo.accountKey, accountInfo);
                showToast(`Cleared migration ledger for ${accountInfo.label}.`, "info");
                renderModal();
              }
            })
          : null,
        sgSkillEl("button", {
          type: "button",
          className: `sg-skills-btn ${selectedSkillsToMigrate.length > 0 ? "sg-skills-btn-accent" : "sg-skills-btn-secondary"}`,
          disabled: selectedSkillsToMigrate.length === 0 || _sgMigrationRunning,
          textContent: _sgMigrationRunning ? "Migration Running..." : migrateLabel,
          onClick: () => {
            confirmResetLedger = false;
            view = "confirm-migrate";
            renderModal();
          }
        })
      ])
    ]);
    modal.appendChild(toolbar);

    const missingCount = skillsAudit.missingBundled.length;
    const outdatedCount = skillsAudit.outdatedBundled.length;
    const auditMissingNames = [...skillsAudit.missingBundled, ...skillsAudit.outdatedBundled].map(s => s.id);
    const auditBannerClass = autoScanStatus === "scanning"
      ? "sg-audit-banner is-scanning"
      : !skillsAudit.verified
        ? "sg-audit-banner is-unverified"
        : (missingCount > 0 || outdatedCount > 0)
          ? "sg-audit-banner is-warn"
          : "sg-audit-banner is-ok";
    const auditBannerTitle = autoScanStatus === "scanning"
      ? "Đang kiểm tra bộ Skills thực tế trên /customize/skills..."
      : !skillsAudit.verified
        ? "Chưa quét được /customize/skills — đang hiển thị theo sổ cái cục bộ."
        : (missingCount === 0 && outdatedCount === 0)
          ? `Bundled Skills: ${skillsAudit.installedCount}/${skillsAudit.totalBundled} đã cài đặt trên /customize/skills (Verified)`
          : `Thiếu ${missingCount} skill thiết lập sẵn${outdatedCount > 0 ? ` · ${outdatedCount} cần cập nhật` : ""}: ${auditMissingNames.slice(0, 4).join(", ")}${auditMissingNames.length > 4 ? ` +${auditMissingNames.length - 4}` : ""}`;

    const auditBanner = sgSkillEl("div", { className: auditBannerClass }, [
      sgSkillEl("div", { className: "sg-audit-banner-text", textContent: auditBannerTitle }),
      sgSkillEl("div", { className: "sg-audit-banner-actions" }, [
        (missingCount > 0 || outdatedCount > 0) && autoScanStatus !== "scanning"
          ? sgSkillEl("button", {
              type: "button",
              className: "sg-skills-btn sg-skills-btn-sm sg-skills-btn-accent",
              textContent: `Select Missing (${missingCount + outdatedCount})`,
              onClick: () => {
                const targetSet = new Set(auditMissingNames);
                for (const s of skills) {
                  userTouchedSkillMigrate.add(s.id);
                  skillMigrateEnabled.set(s.id, targetSet.has(s.id));
                }
                renderModal();
              }
            })
          : null,
        !skillsAudit.verified && autoScanStatus !== "scanning"
          ? sgSkillEl("button", {
              type: "button",
              className: "sg-skills-btn sg-skills-btn-sm sg-skills-btn-secondary",
              textContent: "Retry Scan",
              onClick: () => {
                userTouchedSkillMigrate.clear();
                triggerAutoScanForModal(true, "skills");
              }
            })
          : null,
        sgSkillEl("button", {
          type: "button",
          className: "sg-skills-btn sg-skills-btn-sm sg-skills-btn-ghost",
          textContent: "Open /customize/skills",
          onClick: () => {
            try {
              chrome.runtime.sendMessage({ type: "OPEN_CUSTOMIZE_SKILLS_TAB", url: sgGetCustomizeSkillsUrl() });
            } catch (_e) {}
          }
        })
      ])
    ]);
    modal.appendChild(auditBanner);

    const body = sgSkillEl("div", { className: "sg-skills-body" });
    if (!skills.length) {
      body.appendChild(sgSkillEl("div", {
        className: "sg-skills-empty",
        textContent: "No skills configured yet. Click \"+ New Skill\" or restore bundled defaults."
      }));
    } else {
      for (const skill of skills) {
        const syncState = diff.statusById[skill.id];
        const isEligibleForMigrate = Boolean(skill.enabled && (skill.mode === "both" || skill.mode === "bootstrap"));
        const isSavedInAccount = syncState === "synced" || syncState === "duplicate";
        const isMigrateChecked = Boolean(isEligibleForMigrate && skillMigrateEnabled.get(skill.id));

        const originLabel = skill.origin === "customized" ? "Customized" : skill.origin === "custom" ? "Custom" : "Bundled";
        const originClass = skill.origin === "customized" ? "sg-badge-customized" : skill.origin === "custom" ? "sg-badge-custom" : "sg-badge-bundled";
        const modeLabel = skill.mode === "both" ? "Inject + Bootstrap" : skill.mode === "inject" ? "Inject only" : "Bootstrap only";
        const syncLabel = syncState === "duplicate"
          ? "Installed on Account"
          : syncState === "synced"
            ? (diff.remoteVerified ? "Installed (Verified)" : "Synced")
            : syncState === "removed"
              ? "Removed on Account"
              : syncState === "updated"
                ? "Update Pending"
                : syncState === "new"
                  ? "Not Installed"
                  : "No Bootstrap";
        const syncClass = isSavedInAccount
          ? "sg-badge-synced"
          : syncState === "removed"
            ? "sg-badge-removed"
            : (syncState === "new" || syncState === "updated")
              ? "sg-badge-pending"
              : "sg-badge-muted";

        const toggleInput = sgSkillEl("input", {
          type: "checkbox",
          checked: skill.enabled,
          "aria-label": `Toggle ${skill.name}`,
          onChange: async () => {
            await toggleSkillEnabled(skill.id, toggleInput.checked);
            renderModal();
          }
        });

        let migrateToggleEl = null;
        if (isEligibleForMigrate) {
          const migrateCheckbox = sgSkillEl("input", {
            type: "checkbox",
            className: "sg-skill-migrate-checkbox",
            checked: isMigrateChecked,
            "aria-label": `Migrate ${skill.name}`,
            onChange: () => {
              userTouchedSkillMigrate.add(skill.id);
              skillMigrateEnabled.set(skill.id, migrateCheckbox.checked);
              renderModal();
            }
          });
          migrateToggleEl = sgSkillEl("label", {
            className: `sg-skill-migrate-pill${isMigrateChecked ? " is-active" : ""}${!isMigrateChecked && isSavedInAccount ? " is-saved-off" : ""}`,
            title: isMigrateChecked
              ? "Migrate: ON (included in Account Migration)"
              : isSavedInAccount
                ? "Migrate: OFF (already installed in account — click to force re-migrate)"
                : "Migrate: OFF (click to include in Account Migration)"
          }, [
            migrateCheckbox
          ]);
        }

        const aliasRow = sgSkillEl("div", { className: "sg-skill-aliases" }, [
          ...skill.aliases.map(a => sgSkillEl("code", { className: "sg-skill-chip", textContent: a })),
          sgSkillEl("code", { className: "sg-skill-chip sg-skill-chip-id", textContent: `@${skill.id}` })
        ]);

        const cardActions = sgSkillEl("div", { className: "sg-skill-card-actions" }, [
          migrateToggleEl,
          sgSkillEl("label", { className: "sg-skill-switch", title: "Enable or disable skill" }, [
            toggleInput,
            sgSkillEl("span", { className: "sg-skill-slider" })
          ]),
          sgSkillEl("button", {
            type: "button",
            className: "sg-skills-btn sg-skills-btn-sm sg-skills-btn-secondary",
            textContent: "Edit",
            onClick: () => {
              editingSkill = skill;
              view = "editor";
              renderModal();
            }
          }),
          skill.isBundled && skill.isCustomized
            ? sgSkillEl("button", {
                type: "button",
                className: "sg-skills-btn sg-skills-btn-sm sg-skills-btn-secondary",
                textContent: "Reset",
                onClick: async () => {
                  await resetSkillToBundled(skill.id);
                  showToast(`Reset "${skill.name}" to bundled version.`, "info");
                  renderModal();
                }
              })
            : null,
          sgSkillEl("button", {
            type: "button",
            className: "sg-skills-btn sg-skills-btn-sm sg-skills-btn-danger-ghost",
            textContent: skill.isBundled ? "Hide" : "Delete",
            onClick: async () => {
              await deleteLocalSkill(skill.id);
              showToast(skill.isBundled ? `Hidden bundled skill "${skill.name}".` : `Deleted skill "${skill.name}".`, "info");
              renderModal();
            }
          })
        ]);

        const card = sgSkillEl("div", { className: `sg-skill-card${skill.enabled ? "" : " sg-skill-disabled"}` }, [
          sgSkillEl("div", { className: "sg-skill-card-main" }, [
            sgSkillEl("div", { className: "sg-skill-card-top" }, [
              sgSkillEl("span", { className: "sg-skill-card-name", textContent: skill.name }),
              sgSkillEl("span", { className: `sg-skill-badge ${originClass}`, textContent: originLabel }),
              sgSkillEl("span", { className: "sg-skill-badge sg-badge-mode", textContent: modeLabel }),
              sgSkillEl("span", { className: `sg-skill-badge ${syncClass}`, textContent: syncLabel }),
              sgSkillEl("span", { className: "sg-skill-ver", textContent: `v${skill.version}` })
            ]),
            skill.description
              ? sgSkillEl("div", { className: "sg-skill-card-desc", textContent: skill.description })
              : null,
            aliasRow
          ]),
          cardActions
        ]);
        body.appendChild(card);
      }
    }

    if (deletedBundledIds.length > 0) {
      body.appendChild(sgSkillEl("div", { className: "sg-skills-restore-bar" }, [
        sgSkillEl("span", { textContent: `${deletedBundledIds.length} bundled skill(s) hidden locally.` }),
        sgSkillEl("button", {
          type: "button",
          className: "sg-skills-btn sg-skills-btn-sm sg-skills-btn-secondary",
          textContent: "Restore Bundled",
          onClick: async () => {
            await restoreDeletedBundledSkills();
            showToast("Restored hidden bundled skills.", "success");
            renderModal();
          }
        })
      ]));
    }
    modal.appendChild(body);
    restoreBodyScroll(prevScrollTop);
  }

  function renderBaselineTab(baselines, deletedBaselineIds, baselineDiff, selectedBaselinesToMigrate, savedBaselinesCount, accountInfo) {
    const migrateLabel = selectedBaselinesToMigrate.length > 0
      ? `Migrate to /saved-info (${selectedBaselinesToMigrate.length} pending)`
      : "Account Synced";

    const acctToggle = sgSkillEl("input", {
      type: "checkbox",
      checked: sgIsBaselineInjectionEnabledForAccount(accountInfo),
      "aria-label": "Auto-inject baseline instructions on first turn for this account",
      onChange: async () => {
        await setBaselineAccountInjectEnabled(accountInfo.accountKey, acctToggle.checked);
        renderModal();
      }
    });

    const acctBar = sgSkillEl("div", { className: "sg-baseline-acct-bar" }, [
      sgSkillEl("div", { className: "sg-baseline-acct-text" }, [
        sgSkillEl("strong", { textContent: `Auto-inject on first turn for ${accountInfo.label}` }),
        sgSkillEl("div", {
          className: "sg-baseline-acct-hint",
          textContent: isBaselineInjectionEnabled
            ? "Disable this if this account already uses Gemini native Saved Info to avoid duplicate prompts."
            : "Global Baseline Injection is currently OFF in the extension popup."
        })
      ]),
      sgSkillEl("label", { className: "sg-skill-switch" }, [
        acctToggle,
        sgSkillEl("span", { className: "sg-skill-slider" })
      ])
    ]);

    const toolbar = sgSkillEl("div", { className: "sg-skills-toolbar" }, [
      sgSkillEl("div", { className: "sg-skills-toolbar-group" }, [
        sgSkillEl("button", {
          type: "button",
          className: "sg-skills-btn sg-skills-btn-primary",
          textContent: "+ New Instruction",
          onClick: () => {
            editingBaseline = null;
            view = "baseline-editor";
            renderModal();
          }
        }),
        sgSkillEl("button", {
          type: "button",
          className: "sg-skills-btn sg-skills-btn-secondary",
          textContent: "Import JSON",
          onClick: () => importBaselineFileInput.click()
        }),
        sgSkillEl("button", {
          type: "button",
          className: "sg-skills-btn sg-skills-btn-secondary",
          textContent: "Export JSON",
          onClick: () => {
            exportBaselineJson(true);
            showToast("Exported baseline instructions JSON.", "success");
          }
        }),
        sgSkillEl("button", {
          type: "button",
          className: "sg-skills-btn sg-skills-btn-secondary",
          disabled: autoScanStatus === "scanning",
          textContent: autoScanStatus === "scanning" ? "Scanning..." : "Rescan /saved-info",
          onClick: () => {
            userTouchedBaselineMigrate.clear();
            triggerAutoScanForModal(true, "baseline");
          }
        })
      ]),
      sgSkillEl("div", { className: "sg-skills-toolbar-group" }, [
        (baselineDiff.synced.length > 0 || baselineDiff.duplicates.length > 0)
          ? sgSkillEl("button", {
              type: "button",
              className: "sg-skills-btn sg-skills-btn-ghost",
              textContent: confirmResetBaselineLedger ? "Confirm Reset Ledger?" : "Reset Account Ledger",
              onClick: async () => {
                if (!confirmResetBaselineLedger) {
                  confirmResetBaselineLedger = true;
                  renderModal();
                  return;
                }
                confirmResetBaselineLedger = false;
                userTouchedBaselineMigrate.clear();
                baselineMigrateEnabled.clear();
                await sgResetBaselineAccountLedger(accountInfo.accountKey, accountInfo);
                showToast(`Cleared baseline migration ledger for ${accountInfo.label}.`, "info");
                renderModal();
              }
            })
          : null,
        sgSkillEl("button", {
          type: "button",
          className: `sg-skills-btn ${selectedBaselinesToMigrate.length > 0 ? "sg-skills-btn-accent" : "sg-skills-btn-secondary"}`,
          disabled: selectedBaselinesToMigrate.length === 0 || _sgBaselineMigrationRunning,
          textContent: _sgBaselineMigrationRunning ? "Migration Running..." : migrateLabel,
          onClick: () => {
            confirmResetBaselineLedger = false;
            view = "confirm-baseline-migrate";
            renderModal();
          }
        })
      ])
    ]);

    modal.appendChild(acctBar);
    modal.appendChild(toolbar);

    const body = sgSkillEl("div", { className: "sg-skills-body" });
    if (!baselines.length) {
      body.appendChild(sgSkillEl("div", {
        className: "sg-skills-empty",
        textContent: "No baseline instructions configured yet. Click \"+ New Instruction\" or restore bundled defaults."
      }));
    } else {
      for (const item of baselines) {
        const syncState = baselineDiff.statusById[item.id];
        const isEligibleForMigrate = Boolean(item.enabled && String(item.text || "").trim());
        const isSavedInAccount = syncState === "synced" || syncState === "duplicate";
        const isMigrateChecked = Boolean(isEligibleForMigrate && baselineMigrateEnabled.get(item.id));

        const originLabel = item.origin === "customized" ? "Customized" : item.origin === "custom" ? "Custom" : "Bundled";
        const originClass = item.origin === "customized" ? "sg-badge-customized" : item.origin === "custom" ? "sg-badge-custom" : "sg-badge-bundled";
        const syncLabel = syncState === "synced"
          ? "Synced"
          : syncState === "duplicate"
            ? "Already in Saved Info"
            : syncState === "updated"
              ? "Update Pending"
              : syncState === "new"
                ? "Not Migrated"
                : "Disabled";
        const syncClass = isSavedInAccount
          ? "sg-badge-synced"
          : (syncState === "new" || syncState === "updated")
            ? "sg-badge-pending"
            : "sg-badge-muted";

        const toggleInput = sgSkillEl("input", {
          type: "checkbox",
          checked: item.enabled,
          "aria-label": `Toggle ${item.title}`,
          onChange: async () => {
            await toggleBaselineEnabled(item.id, toggleInput.checked);
            renderModal();
          }
        });

        let migrateToggleEl = null;
        if (isEligibleForMigrate) {
          const migrateCheckbox = sgSkillEl("input", {
            type: "checkbox",
            className: "sg-skill-migrate-checkbox",
            checked: isMigrateChecked,
            "aria-label": `Migrate ${item.title}`,
            onChange: () => {
              userTouchedBaselineMigrate.add(item.id);
              baselineMigrateEnabled.set(item.id, migrateCheckbox.checked);
              renderModal();
            }
          });
          migrateToggleEl = sgSkillEl("label", {
            className: `sg-skill-migrate-pill${isMigrateChecked ? " is-active" : ""}${!isMigrateChecked && isSavedInAccount ? " is-saved-off" : ""}`,
            title: isMigrateChecked
              ? "Migrate: ON (included in /saved-info Migration)"
              : isSavedInAccount
                ? "Migrate: OFF (already saved in /saved-info — click to force re-migrate)"
                : "Migrate: OFF (click to include in /saved-info Migration)"
          }, [
            migrateCheckbox
          ]);
        }

        const cardActions = sgSkillEl("div", { className: "sg-skill-card-actions" }, [
          migrateToggleEl,
          sgSkillEl("label", { className: "sg-skill-switch", title: "Enable or disable baseline instruction" }, [
            toggleInput,
            sgSkillEl("span", { className: "sg-skill-slider" })
          ]),
          sgSkillEl("button", {
            type: "button",
            className: "sg-skills-btn sg-skills-btn-sm sg-skills-btn-secondary",
            textContent: "Edit",
            onClick: () => {
              editingBaseline = item;
              view = "baseline-editor";
              renderModal();
            }
          }),
          item.isBundled && item.isCustomized
            ? sgSkillEl("button", {
                type: "button",
                className: "sg-skills-btn sg-skills-btn-sm sg-skills-btn-secondary",
                textContent: "Reset",
                onClick: async () => {
                  await resetBaselineToBundled(item.id);
                  showToast(`Reset "${item.title}" to bundled version.`, "info");
                  renderModal();
                }
              })
            : null,
          sgSkillEl("button", {
            type: "button",
            className: "sg-skills-btn sg-skills-btn-sm sg-skills-btn-danger-ghost",
            textContent: item.isBundled ? "Hide" : "Delete",
            onClick: async () => {
              await deleteLocalBaseline(item.id);
              showToast(item.isBundled ? `Hidden bundled rule "${item.title}".` : `Deleted rule "${item.title}".`, "info");
              renderModal();
            }
          })
        ]);

        const card = sgSkillEl("div", { className: `sg-skill-card${item.enabled ? "" : " sg-skill-disabled"}` }, [
          sgSkillEl("div", { className: "sg-skill-card-main" }, [
            sgSkillEl("div", { className: "sg-skill-card-top" }, [
              sgSkillEl("span", { className: "sg-skill-card-name", textContent: item.title }),
              sgSkillEl("span", { className: `sg-skill-badge ${originClass}`, textContent: originLabel }),
              sgSkillEl("span", { className: `sg-skill-badge ${syncClass}`, textContent: syncLabel }),
              sgSkillEl("span", { className: "sg-skill-ver", textContent: `v${item.version}` })
            ]),
            sgSkillEl("div", { className: "sg-baseline-text-preview", textContent: item.text })
          ]),
          cardActions
        ]);
        body.appendChild(card);
      }
    }

    if (deletedBaselineIds.length > 0) {
      body.appendChild(sgSkillEl("div", { className: "sg-skills-restore-bar" }, [
        sgSkillEl("span", { textContent: `${deletedBaselineIds.length} bundled baseline rule(s) hidden locally.` }),
        sgSkillEl("button", {
          type: "button",
          className: "sg-skills-btn sg-skills-btn-sm sg-skills-btn-secondary",
          textContent: "Restore Bundled",
          onClick: async () => {
            await restoreDeletedBundledBaselines();
            showToast("Restored hidden bundled baseline rules.", "success");
            renderModal();
          }
        })
      ]));
    }
    modal.appendChild(body);
  }

  function renderBaselineEditorView() {
    const isEdit = Boolean(editingBaseline);
    const idInput = sgSkillEl("input", {
      type: "text",
      className: "sg-skills-input",
      placeholder: "e.g. response-style",
      value: isEdit ? editingBaseline.id : "",
      disabled: isEdit
    });
    const titleInput = sgSkillEl("input", {
      type: "text",
      className: "sg-skills-input",
      placeholder: "e.g. Concise Engineering Tone",
      value: isEdit ? editingBaseline.title : ""
    });
    const textInput = sgSkillEl("textarea", {
      className: "sg-skills-textarea",
      placeholder: "Instruction text to inject on Turn 1 and migrate verbatim to Saved Info...",
      rows: "7",
      value: isEdit ? editingBaseline.text : ""
    });
    const errBox = sgSkillEl("div", { className: "sg-skills-error", style: "display: none;" });

    const form = sgSkillEl("div", { className: "sg-skills-body sg-skills-editor" }, [
      sgSkillEl("h3", { className: "sg-skills-subhead", textContent: isEdit ? `Edit Baseline Rule: ${editingBaseline.title}` : "Create Baseline Instruction" }),
      sgSkillEl("div", { className: "sg-skills-grid" }, [
        sgSkillEl("label", { className: "sg-skills-field" }, [
          sgSkillEl("span", { textContent: "Instruction ID" }),
          idInput
        ]),
        sgSkillEl("label", { className: "sg-skills-field" }, [
          sgSkillEl("span", { textContent: "Display Title" }),
          titleInput
        ])
      ]),
      sgSkillEl("label", { className: "sg-skills-field" }, [
        sgSkillEl("span", { textContent: "Verbatim Instruction Text" }),
        textInput
      ]),
      errBox,
      sgSkillEl("div", { className: "sg-skills-footer-actions" }, [
        sgSkillEl("button", {
          type: "button",
          className: "sg-skills-btn sg-skills-btn-secondary",
          textContent: "Cancel",
          onClick: () => {
            editingBaseline = null;
            view = "list";
            renderModal();
          }
        }),
        sgSkillEl("button", {
          type: "button",
          className: "sg-skills-btn sg-skills-btn-primary",
          textContent: isEdit ? "Save Changes" : "Create Rule",
          onClick: async () => {
            errBox.style.display = "none";
            try {
              if (isEdit) {
                await saveBaselineOverride(editingBaseline.id, {
                  title: titleInput.value.trim(),
                  text: textInput.value
                });
                showToast(`Saved "${titleInput.value.trim() || editingBaseline.title}".`, "success");
              } else {
                await createCustomBaseline({
                  id: idInput.value,
                  title: titleInput.value,
                  text: textInput.value
                });
                showToast(`Created baseline rule "${titleInput.value.trim() || idInput.value}".`, "success");
              }
              editingBaseline = null;
              view = "list";
              renderModal();
            } catch (err) {
              errBox.textContent = err.message || String(err);
              errBox.style.display = "block";
            }
          }
        })
      ])
    ]);
    modal.appendChild(form);
  }

  function renderBaselineMigrationConfirmView(diff, selectedItems, savedCount, accountInfo, baselineBundleVersion) {
    const targetUrl = sgGetSavedInfoUrl();
    const list = sgSkillEl("div", { className: "sg-mig-preview-list" }, selectedItems.map(({ item, reason }) => {
      return sgSkillEl("div", { className: "sg-mig-preview-item" }, [
        sgSkillEl("div", { className: "sg-mig-preview-left" }, [
          sgSkillEl("strong", { textContent: `${item.title} (v${item.version})` }),
          sgSkillEl("span", { className: "sg-baseline-text-preview", textContent: item.text })
        ]),
        sgSkillEl("span", {
          className: `sg-skill-badge ${reason === "removed" ? "sg-badge-removed" : "sg-badge-pending"}`,
          textContent: reason === "updated" ? "UPDATE" : (reason === "removed" ? "REMOVED" : (reason === "re-migrate" ? "FORCE" : "NEW"))
        })
      ]);
    }));

    const panel = sgSkillEl("div", { className: "sg-skills-body sg-mig-confirm" }, [
      sgSkillEl("h3", { className: "sg-skills-subhead", textContent: "Confirm Migration to /saved-info (Mode 2)" }),
      savedCount > 0
        ? sgSkillEl("div", {
            className: "sg-mig-autoscan-note",
            textContent: `Auto-scan detected ${savedCount} already-saved baseline rule(s) in this account and turned off migration for them automatically.`
          })
        : null,
      sgSkillEl("p", {
        className: "sg-mig-warning",
        textContent: `Target: ${accountInfo.label} (${targetUrl}). This will open /saved-info for this account, deduplicate against existing Saved Info entries, add ${selectedItems.length} rule(s) verbatim, and checkpoint each completed entry. You can click "Stop Migration" at any time.`
      }),
      list,
      sgSkillEl("div", { className: "sg-skills-footer-actions" }, [
        sgSkillEl("button", {
          type: "button",
          className: "sg-skills-btn sg-skills-btn-secondary",
          textContent: "Back",
          onClick: () => {
            view = "list";
            renderModal();
          }
        }),
        sgSkillEl("button", {
          type: "button",
          className: "sg-skills-btn sg-skills-btn-accent",
          disabled: selectedItems.length === 0 || _sgBaselineMigrationRunning,
          textContent: `Confirm & Migrate ${selectedItems.length} Rule${selectedItems.length === 1 ? "" : "s"}`,
          onClick: () => {
            sgLaunchBaselineMigration(selectedItems, accountInfo, baselineBundleVersion);
          }
        })
      ])
    ]);
    modal.appendChild(panel);
  }

  function renderEditorView() {
    const isEdit = Boolean(editingSkill);
    const idInput = sgSkillEl("input", {
      type: "text",
      className: "sg-skills-input",
      placeholder: "e.g. code-review",
      value: isEdit ? editingSkill.id : "",
      disabled: isEdit
    });
    const nameInput = sgSkillEl("input", {
      type: "text",
      className: "sg-skills-input",
      placeholder: "e.g. Code Review",
      value: isEdit ? editingSkill.name : ""
    });
    const aliasesInput = sgSkillEl("input", {
      type: "text",
      className: "sg-skills-input",
      placeholder: "e.g. /review/, /rv/",
      value: isEdit ? editingSkill.aliases.join(", ") : ""
    });
    const modeSelect = sgSkillEl("select", { className: "sg-skills-input" }, [
      sgSkillEl("option", { value: "both", textContent: "Both (Client-Side Inject + Account Bootstrap)" }),
      sgSkillEl("option", { value: "inject", textContent: "Client-Side Inject only (Mode 1)" }),
      sgSkillEl("option", { value: "bootstrap", textContent: "Account Bootstrap only (Mode 2)" })
    ]);
    modeSelect.value = isEdit ? editingSkill.mode : "both";
    const descInput = sgSkillEl("input", {
      type: "text",
      className: "sg-skills-input",
      placeholder: "Short description",
      value: isEdit ? editingSkill.description : ""
    });
    const contentInput = sgSkillEl("textarea", {
      className: "sg-skills-textarea",
      placeholder: "# Skill Instructions (Markdown)...",
      rows: "10",
      value: isEdit ? editingSkill.content : ""
    });
    const errBox = sgSkillEl("div", { className: "sg-skills-error", style: "display: none;" });

    const form = sgSkillEl("div", { className: "sg-skills-body sg-skills-editor" }, [
      sgSkillEl("h3", { className: "sg-skills-subhead", textContent: isEdit ? `Edit Skill: ${editingSkill.name}` : "Create Custom Skill" }),
      sgSkillEl("div", { className: "sg-skills-grid" }, [
        sgSkillEl("label", { className: "sg-skills-field" }, [
          sgSkillEl("span", { textContent: "Skill ID (used for @id trigger)" }),
          idInput
        ]),
        sgSkillEl("label", { className: "sg-skills-field" }, [
          sgSkillEl("span", { textContent: "Display Name" }),
          nameInput
        ])
      ]),
      sgSkillEl("div", { className: "sg-skills-grid" }, [
        sgSkillEl("label", { className: "sg-skills-field" }, [
          sgSkillEl("span", { textContent: "Aliases (comma-separated)" }),
          aliasesInput
        ]),
        sgSkillEl("label", { className: "sg-skills-field" }, [
          sgSkillEl("span", { textContent: "Mode" }),
          modeSelect
        ])
      ]),
      sgSkillEl("label", { className: "sg-skills-field" }, [
        sgSkillEl("span", { textContent: "Description" }),
        descInput
      ]),
      sgSkillEl("label", { className: "sg-skills-field" }, [
        sgSkillEl("span", { textContent: "Markdown Instructions" }),
        contentInput
      ]),
      errBox,
      sgSkillEl("div", { className: "sg-skills-footer-actions" }, [
        sgSkillEl("button", {
          type: "button",
          className: "sg-skills-btn sg-skills-btn-secondary",
          textContent: "Cancel",
          onClick: () => {
            editingSkill = null;
            view = "list";
            renderModal();
          }
        }),
        sgSkillEl("button", {
          type: "button",
          className: "sg-skills-btn sg-skills-btn-primary",
          textContent: isEdit ? "Save Changes" : "Create Skill",
          onClick: async () => {
            errBox.style.display = "none";
            try {
              if (isEdit) {
                await saveSkillOverride(editingSkill.id, {
                  name: nameInput.value.trim(),
                  aliases: aliasesInput.value,
                  mode: modeSelect.value,
                  description: descInput.value.trim(),
                  content: contentInput.value
                });
                showToast(`Saved "${nameInput.value.trim() || editingSkill.id}".`, "success");
              } else {
                await createCustomSkill({
                  id: idInput.value,
                  name: nameInput.value,
                  aliases: aliasesInput.value,
                  mode: modeSelect.value,
                  description: descInput.value,
                  content: contentInput.value
                });
                showToast(`Created custom skill "${nameInput.value.trim() || idInput.value}".`, "success");
              }
              editingSkill = null;
              view = "list";
              renderModal();
            } catch (err) {
              errBox.textContent = err.message || String(err);
              errBox.style.display = "block";
            }
          }
        })
      ])
    ]);
    modal.appendChild(form);
  }

  function renderMigrationConfirmView(diff, selectedItems, savedCount, accountInfo, bundleVersion) {
    const list = sgSkillEl("div", { className: "sg-mig-preview-list" }, selectedItems.map(({ skill, reason }) => {
      return sgSkillEl("div", { className: "sg-mig-preview-item" }, [
        sgSkillEl("div", { className: "sg-mig-preview-left" }, [
          sgSkillEl("strong", { textContent: skill.name }),
          sgSkillEl("span", { className: "sg-skill-ver", textContent: `@${skill.id} · v${skill.version} · ${skill.content.length} chars` })
        ]),
        sgSkillEl("span", {
          className: `sg-skill-badge ${reason === "removed" ? "sg-badge-removed" : "sg-badge-pending"}`,
          textContent: reason === "updated" ? "UPDATE" : (reason === "removed" ? "REMOVED" : (reason === "re-migrate" ? "FORCE" : "NEW"))
        })
      ]);
    }));

    const panel = sgSkillEl("div", { className: "sg-skills-body sg-mig-confirm" }, [
      sgSkillEl("h3", { className: "sg-skills-subhead", textContent: "Confirm Account Migration (Mode 2)" }),
      savedCount > 0
        ? sgSkillEl("div", {
            className: "sg-mig-autoscan-note",
            textContent: `Auto-scan detected ${savedCount} already-saved skill(s) in this account and turned off migration for them automatically.`
          })
        : null,
      sgSkillEl("p", {
        className: "sg-mig-warning",
        textContent: `Target: ${accountInfo.label}. This will send ${selectedItems.length} sequential message(s) in the active Gemini chat and checkpoint each skill after completion. You can click "Stop Migration" at any time.`
      }),
      list,
      sgSkillEl("div", { className: "sg-skills-footer-actions" }, [
        sgSkillEl("button", {
          type: "button",
          className: "sg-skills-btn sg-skills-btn-secondary",
          textContent: "Back",
          onClick: () => {
            view = "list";
            renderModal();
          }
        }),
        sgSkillEl("button", {
          type: "button",
          className: "sg-skills-btn sg-skills-btn-accent",
          disabled: selectedItems.length === 0 || _sgMigrationRunning,
          textContent: `Confirm & Migrate ${selectedItems.length} Skill${selectedItems.length === 1 ? "" : "s"}`,
          onClick: () => {
            sgStartAccountMigration(selectedItems, accountInfo, bundleVersion);
          }
        })
      ])
    ]);
    modal.appendChild(panel);
  }

  document.body.appendChild(overlay);
  _sgSkillsModalState.overlay = overlay;
  _sgSkillsModalState.refresh = () => {
    if (_sgSkillsModalState.overlay && view === "list") {
      renderModal();
    }
  };
  await triggerAutoScanForModal(true, activeTab);
  return loaded;
}

function initSkillsRegistrySystem() {
  if ("undefined" != typeof SG_IS_SILENT_BG_WORKER_TAB && SG_IS_SILENT_BG_WORKER_TAB) return;
  ("function" == typeof sgSyncGetCached ? sgSyncGetCached : chrome.storage.sync.get.bind(chrome.storage.sync))(["extensionEnabled", "skillsInjectionEnabled", "baselineInjectionEnabled"], res => {
    const safe = res || {};
    if (safe.extensionEnabled === false) {
      isExtensionEnabled = false;
      isSkillsInjectionEnabled = false;
      isBaselineInjectionEnabled = false;
      return;
    }
    isSkillsInjectionEnabled = safe.skillsInjectionEnabled === true;
    isBaselineInjectionEnabled = safe.baselineInjectionEnabled === true;
    loadEffectiveSkills();
    loadEffectiveBaselineInstructions();
    initSkillAutocomplete();
    initSkillPreSendInterceptor();

    if (isOnSavedInfoPage()) {
      _sgSavedInfoLastCheckedPath = window.location.pathname;
      setTimeout(() => {
        sgCheckAndRunPendingBaselineMigration();
        sgAutoSyncSavedInfoPageOnOpen();
      }, 400);
    } else if (isOnCustomizeSkillsPage()) {
      _sgSavedInfoLastCheckedPath = window.location.pathname;
      setTimeout(() => {
        sgRunPageLoadBundledSkillsAudit();
      }, 500);
    } else {
      setTimeout(() => {
        if (typeof window.requestIdleCallback === "function") {
          window.requestIdleCallback(() => sgRunPageLoadBundledSkillsAudit(), { timeout: 3000 });
        } else {
          sgRunPageLoadBundledSkillsAudit();
        }
      }, 1500);
    }

    if (typeof sgObserverRegistry !== "undefined" && sgObserverRegistry && typeof sgObserverRegistry.registerUIRefresh === "function") {
      sgObserverRegistry.registerUIRefresh("baselineSavedInfoJob", () => {
        if (window.location.pathname !== _sgSavedInfoLastCheckedPath) {
          _sgSavedInfoLastCheckedPath = window.location.pathname;
          if (isOnSavedInfoPage()) {
            sgCheckAndRunPendingBaselineMigration();
            sgAutoSyncSavedInfoPageOnOpen();
          } else if (isOnCustomizeSkillsPage()) {
            sgAutoSyncCustomizeSkillsPageOnOpen();
          }
        }
      });
    }
  });

  const _sgSkillsStorageHandler = (changes, areaName) => {
    if (areaName === "local" && (changes[SG_SKILLS_LOCAL_KEY] || changes[SG_SKILLS_LEDGER_KEY])) {
      loadEffectiveSkills().then(() => {
        if (typeof _sgSkillsModalState.refresh === "function") {
          _sgSkillsModalState.refresh();
        }
      });
    }
    if (areaName === "local" && (changes[SG_BASELINE_LOCAL_KEY] || changes[SG_BASELINE_PREFS_KEY] || changes[SG_BASELINE_LEDGER_KEY])) {
      loadEffectiveBaselineInstructions().then(() => {
        if (typeof _sgSkillsModalState.refresh === "function") {
          _sgSkillsModalState.refresh();
        }
      });
    }
    if (areaName === "sync" && changes.skillsInjectionEnabled) {
      isSkillsInjectionEnabled = changes.skillsInjectionEnabled.newValue === true;
      if (!isSkillsInjectionEnabled) hideSkillAutocomplete();
      if (typeof _sgSkillsModalState.refresh === "function") {
        _sgSkillsModalState.refresh();
      }
    }
    if (areaName === "sync" && changes.baselineInjectionEnabled) {
      isBaselineInjectionEnabled = changes.baselineInjectionEnabled.newValue === true;
      if (typeof _sgSkillsModalState.refresh === "function") {
        _sgSkillsModalState.refresh();
      }
    }
  };
  if (typeof SG !== "undefined" && SG && SG.storage) {
    SG.storage.onChanged("skills-baseline:sync", _sgSkillsStorageHandler);
  } else {
    chrome.storage.onChanged.addListener(_sgSkillsStorageHandler);
  }
}

("undefined" != typeof SG_IS_SILENT_BG_WORKER_TAB && SG_IS_SILENT_BG_WORKER_TAB) || initSkillsRegistrySystem();
