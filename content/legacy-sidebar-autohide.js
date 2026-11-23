function createSidebarSection() {
  const e = document.createElement("div");
  e.id = "sg-sidebar-section", e.className = "sg-sidebar-section", e.style.cssText = "margin: 0 12px 8px 12px; overflow: visible; transition: margin-top 0.2s ease;", setTimeout(updateSidebarSectionSpacing, 0);
  const t = gpsSectionExpanded ? "rotate(90deg)" : "rotate(0deg)";sgSetSafeHtml(e, `\n    <div class="sg-section-header" id="sg-section-toggle" tabindex="0" role="button" aria-expanded="${gpsSectionExpanded}" aria-controls="sg-section-content" style="\n      display: flex;\n      align-items: center;\n      justify-content: space-between;\n      padding: 12px 14px;\n      background: transparent;\n      border-radius: 28px;\n      cursor: pointer;\n      user-select: none;\n      transition: background 0.15s ease;\n    ">\n      <div class="sg-section-header-left" style="display: flex; align-items: center;">\n          <svg class="sg-section-brain-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width: 20px; height: 20px; margin-left: 2px; flex-shrink: 0; color: #000;">\n            <path d="M13 3L4 14h7l-1 7 9-11h-7l1-7z"/>\n          </svg>\n          <span class="sg-section-title" style="font-size: 14px; font-weight: 500; color: #1f1f1f;">Gemini Power Suite</span>\n      </div>\n      <svg class="sg-section-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="\n        width: 16px;\n        height: 16px;\n        color: #727676;\n        transition: transform 0.2s ease;\n        transform: ${t};\n        margin-right: -5px;\n      ">\n        <path d="M9 18l6-6-6-6"/>\n      </svg>\n    </div>\n    <div class="sg-section-content" id="sg-section-content" style="\n      overflow: hidden;\n      max-height: ${gpsSectionExpanded?"260px":"0"};\n      transition: max-height 0.2s ease;\n      margin-top: 0;\n    ">\n      <div class="sg-dropdown-menu" style="padding: 0;">\n        <div class="sg-dropdown-item" id="sg-folders-menu-item" tabindex="0" role="button" style="\n          display: flex;\n          align-items: center;\n          gap: 14px;\n          padding: 8px 12px;\n          cursor: pointer;\n          transition: background 0.15s ease;\n          border-radius: 24px;\n          background: transparent;\n          margin-left: 2px;\n        ">\n          <span class="sg-lumi-icon" aria-hidden="true">folder</span>\n          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width: 20px; height: 20px; color: #575a5a; flex-shrink: 0;">\n            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>\n          </svg>\n          <span style="font-family: var(--sg-font-flex); font-size: 14px; font-weight: 500; color: #1f1f1f;">Folders</span>\n        </div>\n        <div class="sg-dropdown-item" id="sg-prompts-menu-item" tabindex="0" role="button" style="\n          display: flex;\n          align-items: center;\n          gap: 14px;\n          padding: 8px 12px;\n          cursor: pointer;\n          transition: background 0.15s ease;\n          border-radius: 24px;\n          background: transparent;\n          margin-left: 2px;\n        ">\n          <span class="sg-lumi-icon" aria-hidden="true">note_stack</span>\n          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width: 20px; height: 20px; color: #575a5a; flex-shrink: 0;">\n            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>\n          </svg>\n          <span style="font-family: var(--sg-font-flex); font-size: 14px; font-weight: 500; color: #1f1f1f;">Prompts</span>\n        </div>\n        <div class="sg-dropdown-item" id="sg-settings-menu-item" tabindex="0" role="button" style="\n          display: flex;\n          align-items: center;\n          gap: 14px;\n          padding: 8px 12px;\n          cursor: pointer;\n          transition: background 0.15s ease;\n          border-radius: 24px;\n          background: transparent;\n          margin-left: 2px;\n        ">\n          <span class="sg-lumi-icon" aria-hidden="true">settings</span>\n          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width: 20px; height: 20px; color: #575a5a; flex-shrink: 0;">\n            <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />\n            <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />\n          </svg>\n          <span style="font-family: var(--sg-font-flex); font-size: 14px; font-weight: 500; color: #1f1f1f;">Settings</span>\n        </div>\n      </div>\n    </div>\n  `);
  const menu = e.querySelector(".sg-dropdown-menu");
  const settingsItem = e.querySelector("#sg-settings-menu-item");
  if (menu) {
    const skillsItem = document.createElement("div");
    skillsItem.className = "sg-dropdown-item";
    skillsItem.id = "sg-skills-menu-item";
    skillsItem.setAttribute("tabindex", "0");
    skillsItem.setAttribute("role", "button");
    skillsItem.style.cssText = "display: flex; align-items: center; gap: 14px; padding: 8px 12px; cursor: pointer; transition: background 0.15s ease; border-radius: 24px; background: transparent; margin-left: 2px;";
    const lumi = document.createElement("span");
    lumi.className = "sg-lumi-icon";
    lumi.setAttribute("aria-hidden", "true");
    lumi.textContent = "auto_awesome";
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.5");
    svg.style.cssText = "width: 20px; height: 20px; color: #575a5a; flex-shrink: 0;";
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z");
    svg.appendChild(path);
    const label = document.createElement("span");
    label.style.cssText = "font-family: var(--sg-font-flex); font-size: 14px; font-weight: 500; color: #1f1f1f;";
    label.textContent = "Skills";
    skillsItem.appendChild(lumi);
    skillsItem.appendChild(svg);
    skillsItem.appendChild(label);
    settingsItem ? menu.insertBefore(skillsItem, settingsItem) : menu.appendChild(skillsItem);
  }
  return e;
}

function toggleSidebarSection(e) {
  const t = document.getElementById("sg-sidebar-section");
  t && (t.style.display = e ? "block" : "none")
}

function findSidebarSectionAnchor() {
  const e = document.querySelector(".sidenav-with-history-container infinite-scroller") || document.querySelector("side-navigation-content infinite-scroller") || document.querySelector("bard-sidenav infinite-scroller") || document.querySelector('[role="navigation"] infinite-scroller');
  if (e) {
    const t = e.querySelectorAll(":scope > expandable-section");
    for (const n of t)
      if (n.querySelector(".chat-history, conversations-list")) return {
        container: e,
        before: n
      };
    const n = e.querySelector(":scope > .chat-history");
    if (n) return {
      container: e,
      before: n
    };
    const o = e.querySelector(":scope > .gems-list-container");
    if (o) return {
      container: e,
      before: o.nextElementSibling
    };
    const r = e.querySelector(":scope > .side-nav-entry-container");
    if (r) return {
      container: e,
      before: r.nextElementSibling
    };
    const s = e.querySelector(":scope > .bottom-gradient-container");
    return s ? {
      container: e,
      before: s
    } : {
      container: e,
      before: null
    }
  }
  const t = document.querySelector(".overflow-container");
  if (t) {
    const e = t.querySelector(":scope > location-footer");
    return e ? {
      container: t,
      before: e
    } : {
      container: t,
      before: null
    }
  }
  const n = document.querySelector(".sidenav-with-history-container") || document.querySelector("side-navigation-content") || document.querySelector("bard-sidenav");
  return n ? {
    container: n,
    before: null
  } : null
}
let _sgIsNewestUiCache = !1;

function isNewestGeminiUi() {
  if (_sgIsNewestUiCache) return !0;
  const e = !!document.querySelector('.sidenav-with-history-container infinite-scroller > expandable-section, side-navigation-content infinite-scroller > expandable-section, bard-sidenav gem-nav-list-item[data-test-id="conversation"], .close-sidenav-button, button[data-test-id="side-nav-sparkle-button"], simplified-input-menu, gem-icon');
  return e && (_sgIsNewestUiCache = !0), e
}

function getGeminiUiVariant() {
  if (isNewestGeminiUi()) return "newest";
  return !!document.querySelector(".conversation-items-container, side-nav-action-button") ? "old" : "unknown"
}

function applyGeminiUiVariantClass(e) {
  if (!e) return;
  const t = isNewestGeminiUi();
  t !== e.classList.contains("sg-newest-ui") && (t ? e.classList.add("sg-newest-ui") : e.classList.remove("sg-newest-ui"))
}

function repositionSidebarSection() {
  injectSidebarSection()
}

function injectSidebarSection() {
  const e = findSidebarSectionAnchor();
  if (!e) return !1;
  const t = e.before && e.before.parentElement === e.container,
    n = n => {
      t ? e.container.insertBefore(n, e.before) : e.container.appendChild(n)
    },
    o = document.getElementById("sg-sidebar-section");
  if (o) {
    applyGeminiUiVariantClass(o);
    const r = o.parentElement === e.container,
      s = e.before === o || (t ? o.nextElementSibling === e.before : o === e.container.lastElementChild);
    return r && s || n(o), !0
  }
  const r = createSidebarSection();
  return applyGeminiUiVariantClass(r), sgSyncGetCached(["sidebarDropdownEnabled", "foldersEnabled", "promptsEnabled"], e => {
    if (!1 === e.sidebarDropdownEnabled && (r.style.display = "none"), !1 === e.foldersEnabled) {
      const e = r.querySelector("#sg-folders-menu-item");
      e && (e.style.display = "none")
    }
    if (!1 === e.promptsEnabled) {
      const e = r.querySelector("#sg-prompts-menu-item");
      e && (e.style.display = "none")
    }
    if (!settingsInMenuEnabled) {
      const e = r.querySelector("#sg-settings-menu-item");
      e && (e.style.display = "none")
    }
  }), n(r), setupFolderEventListeners(), updateTheme(), !0
}

function setupFolderEventListeners() {
  const e = document.getElementById("sg-section-toggle"),
    t = document.getElementById("sg-section-content"),
    n = e?.querySelector(".sg-section-chevron");
  e && t && (e.addEventListener("click", () => {
    gpsSectionExpanded = !gpsSectionExpanded, e.classList.remove("sg-bounce"), e.offsetWidth, e.classList.add("sg-bounce"), t.style.maxHeight = gpsSectionExpanded ? "260px" : "0", e.setAttribute("aria-expanded", gpsSectionExpanded), n && (n.style.transform = gpsSectionExpanded ? "rotate(90deg)" : "rotate(0deg)"), chrome.storage.sync.set({
      gpsDropdownExpanded: gpsSectionExpanded
    })
  }), e.addEventListener("keydown", t => {
    "Enter" !== t.key && " " !== t.key || (t.preventDefault(), e.click())
  }), e.addEventListener("mouseenter", () => {
    e.style.background = getThemeColors().sidebarHover
  }), e.addEventListener("mouseleave", () => {
    e.style.background = "transparent"
  }));
  const o = document.getElementById("sg-folders-menu-item");
  o && (o.addEventListener("click", e => {
    e.stopPropagation(), showFoldersModal()
  }), o.addEventListener("keydown", e => {
    "Enter" !== e.key && " " !== e.key || (e.preventDefault(), o.click())
  }), o.addEventListener("mouseenter", () => {
    o.style.background = getThemeColors().sidebarHover
  }), o.addEventListener("mouseleave", () => {
    o.style.background = "transparent"
  }));
  const r = document.getElementById("sg-prompts-menu-item");
  r && (r.addEventListener("mousedown", () => {
    sgPromptsModalCaret = sgCaptureComposerCaret() || sgLastComposerCaret
  }), r.addEventListener("click", e => {
    e.stopPropagation(), window._sgPromptsHintClose && (window._sgPromptsHintClose(), window._sgPromptsHintClose = null), showPromptsModal()
  }), r.addEventListener("keydown", e => {
    "Enter" !== e.key && " " !== e.key || (e.preventDefault(), r.click())
  }), r.addEventListener("mouseenter", () => {
    r.style.background = getThemeColors().sidebarHover
  }), r.addEventListener("mouseleave", () => {
    r.style.background = "transparent"
  }));
  const sk = document.getElementById("sg-skills-menu-item");
  sk && (sk.addEventListener("click", e => {
    e.stopPropagation(), "function" == typeof showSkillsModal && showSkillsModal()
  }), sk.addEventListener("keydown", e => {
    "Enter" !== e.key && " " !== e.key || (e.preventDefault(), sk.click())
  }), sk.addEventListener("mouseenter", () => {
    sk.style.background = getThemeColors().sidebarHover
  }), sk.addEventListener("mouseleave", () => {
    sk.style.background = "transparent"
  }));
  const s = document.getElementById("sg-settings-menu-item");
  s && (s.addEventListener("click", e => {
    e.stopPropagation(), sgSafeSendMessage({
      type: "OPEN_POPUP"
    })
  }), s.addEventListener("keydown", e => {
    "Enter" !== e.key && " " !== e.key || (e.preventDefault(), s.click())
  }), s.addEventListener("mouseenter", () => {
    s.style.background = getThemeColors().sidebarHover
  }), s.addEventListener("mouseleave", () => {
    s.style.background = "transparent"
  }))
}
const SG_NATIVE_MENU_SPECS = [{
    id: "sg-native-header",
    icon: null,
    label: "Gemini Power Suite",
    action: "toggle"
  }, {
    id: "sg-native-folders",
    icon: "folder",
    label: "Folders",
    action: "folders"
  }, {
    id: "sg-native-prompts",
    icon: "note_stack",
    label: "Prompts",
    action: "prompts"
  }, {
    id: "sg-native-skills",
    icon: "auto_awesome",
    label: "Skills",
    action: "skills"
  }, {
    id: "sg-native-settings",
    icon: "settings",
    label: "Settings",
    action: "settings"
  }],
  SG_BOLT_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width:20px;height:20px;"><path d="M13 3L4 14h7l-1 7 9-11h-7l1-7z"/></svg>';
let _sgNativeMenuObserver = null,
  _sgNativeReinjectScheduled = !1,
  _sgLastInjectedSignature = "",
  _sgInjectingNow = !1;
const SG_LIBRARY_ITEM_SEL = 'gem-nav-list-item[data-test-id="library-side-nav-entry-button"], gem-nav-list-item[data-test-id="my-stuff-side-nav-entry-button"]';

function sgGetAdditionalMenus() {
  const e = document.querySelectorAll(SG_LIBRARY_ITEM_SEL),
    t = new Set;
  return e.forEach(e => {
    const n = e.closest("mat-nav-list");
    n && t.add(n)
  }), [...t]
}

function sgGetLibraryInMenu(e) {
  return e?.querySelector(SG_LIBRARY_ITEM_SEL)
}

function sgSourceSignature(e) {
  if (!e) return "";
  return (e.firstElementChild?.tagName || "") + ":" + (e.querySelector(".title-text") ? "1" : "0")
}

function sgFormatShortcut(e) {
  if (!e || !e.key) return "";
  const t = [];
  return e.ctrl && t.push("Ctrl"), e.shift && t.push("Shift"), e.alt && t.push("Alt"), e.meta && t.push("Cmd"), t.push(1 === e.key.length ? e.key.toUpperCase() : e.key), t.join("+")
}

function sgGetShortcutLabel(e) {
  return "folders" === e && void 0 !== isFoldersShortcutEnabled && isFoldersShortcutEnabled ? sgFormatShortcut(foldersShortcut) : "prompts" === e && void 0 !== isPromptsShortcutEnabled && isPromptsShortcutEnabled ? sgFormatShortcut(promptsShortcut) : "settings" === e && void 0 !== isSettingsShortcutEnabled && isSettingsShortcutEnabled ? sgFormatShortcut(settingsShortcut) : ""
}

function sgMakeNativeNavItem(e, t) {
  const n = t.cloneNode(!0);
  n.setAttribute("data-test-id", e.id);
  const o = e => e.classList.remove("ng-star-inserted");
  o(n), n.querySelectorAll(".ng-star-inserted").forEach(o), ["is-active", "mdc-list-item--activated", "mat-mdc-list-item-activated", "active"].forEach(e => {
    n.classList.remove(e), n.querySelectorAll("." + e).forEach(t => t.classList.remove(e))
  }), n.querySelectorAll("[aria-current]").forEach(e => e.removeAttribute("aria-current")), n.style.userSelect = "none", n.style.webkitUserSelect = "none", "folders" !== e.action && "prompts" !== e.action && "skills" !== e.action && "settings" !== e.action || (n.classList.add("sg-native-collapsible"), gpsSectionExpanded || (n.classList.add("sg-native-hidden", "sg-native-no-anim"), requestAnimationFrame(() => {
    requestAnimationFrame(() => n.classList.remove("sg-native-no-anim"))
  }))), n.querySelectorAll("mat-icon").forEach(t => {
    e.icon ? (t.textContent = "", t.setAttribute("fonticon", e.icon), t.setAttribute("data-mat-icon-name", e.icon)) : (t.removeAttribute("fonticon"), t.removeAttribute("data-mat-icon-name"),sgSetSafeHtml(t, SG_BOLT_SVG))
  });
  const r = n.querySelector(".title-text");
  if ("settings" === e.action && !settingsInMenuEnabled) {
    n.dataset.sgFeatureDisabled = "1";
    n.style.display = "none";
  }
  if (r && (r.textContent = e.label), "toggle" === e.action) {
    const e = n.querySelector(".mat-mdc-list-item-meta, .trailing-content");
    if (e) {sgSetSafeHtml(e, "");
      const t = document.createElement("span");
      t.className = "sg-native-chevron", t.setAttribute("aria-hidden", "true"), t.style.cssText = "display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;transition:transform 0.15s ease;transform:rotate(" + (gpsSectionExpanded ? "0" : "-90") + "deg);",sgSetSafeHtml(t, '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;"><path d="M6 9l6 6 6-6"/></svg>'), e.appendChild(t)
    }
  }
  const s = n.querySelector("a, button");
  s && (s.setAttribute("aria-label", e.label), s.removeAttribute("href"), s.removeAttribute("routerlink"), s.removeAttribute("routerLink"), s.removeAttribute("jslog")), n.querySelectorAll("[aria-describedby]").forEach(e => e.removeAttribute("aria-describedby")), n.querySelectorAll(".mat-mdc-tooltip-trigger").forEach(t => t.setAttribute("aria-label", e.label)), n.setAttribute("data-sg-tooltip", e.label);
  const a = sgGetShortcutLabel(e.action);
  if (a && "toggle" !== e.action) {
    const e = n.querySelector(".mat-mdc-list-item-meta, .trailing-content");
    if (e) {sgSetSafeHtml(e, "");
      const t = document.createElement("span");
      t.className = "sg-native-shortcut", t.setAttribute("aria-hidden", "true"), t.textContent = a, e.appendChild(t)
    }
  }
  return n.addEventListener("click", t => {
    t.preventDefault(), t.stopImmediatePropagation(), sgHandleNativeItemClick(e.action);
    const o = n.querySelector("a, button") || n;
    try {
      o.blur && o.blur()
    } catch (e) {}
    if (document.activeElement && n.contains(document.activeElement)) try {
      document.activeElement.blur()
    } catch (e) {}
  }, !0), n.addEventListener("mousedown", e => {
    e.preventDefault()
  }, !0), sgAttachNavTooltip(n), n
}

function sgHandleNativeItemClick(e) {
  switch (e) {
    case "toggle":
      sgToggleNativeSubItems();
      break;
    case "folders":
      document.getElementById("sg-folders-menu-item")?.click();
      break;
    case "prompts":
      document.getElementById("sg-prompts-menu-item")?.click();
      break;
    case "skills":
      "function" == typeof showSkillsModal && showSkillsModal();
      break;
    case "settings":
      document.getElementById("sg-settings-menu-item")?.click()
  }
}

function sgToggleNativeSubItems() {
  gpsSectionExpanded = !gpsSectionExpanded, sgApplyNativeSubItemsVisibility(), sgUpdateNativeChevron(), chrome.storage.sync.set({
    gpsDropdownExpanded: gpsSectionExpanded
  })
}

function sgApplyNativeSubItemsVisibility() {
  ["sg-native-folders", "sg-native-prompts", "sg-native-skills", "sg-native-settings"].forEach(e => {
    document.querySelectorAll(`[data-test-id="${e}"]`).forEach(e => {
      "1" !== e.dataset.sgFeatureDisabled && e.classList.toggle("sg-native-hidden", !gpsSectionExpanded)
    })
  })
}

function sgUpdateNativeChevron() {
  document.querySelectorAll('[data-test-id="sg-native-header"] .sg-native-chevron').forEach(e => {
    e.style.transform = "rotate(" + (gpsSectionExpanded ? "0" : "-90") + "deg)"
  })
}

function sgSetNativeMenuItemVisible(e, t) {
  document.querySelectorAll(`[data-test-id="sg-native-${e}"]`).forEach(e => {
    e.dataset.sgFeatureDisabled = t ? "0" : "1", e.style.display = "", e.classList.add("sg-native-collapsible"), e.classList.toggle("sg-native-hidden", !t)
  }), t && sgApplyNativeSubItemsVisibility()
}

function sgSetNativeMenuVisible(e) {
  e ? (document.querySelectorAll('[data-test-id="sg-native-header"]').forEach(e => {
    e.dataset.sgFeatureDisabled = "0", e.style.display = "", e.classList.remove("sg-native-hidden")
  }), sgSyncGetCached(["foldersEnabled", "promptsEnabled", "settingsInMenuEnabled"], e => {
    sgSetNativeMenuItemVisible("folders", !1 !== e.foldersEnabled), sgSetNativeMenuItemVisible("prompts", !1 !== e.promptsEnabled), sgSetNativeMenuItemVisible("skills", !0), sgSetNativeMenuItemVisible("settings", !0 === e.settingsInMenuEnabled)
  })) : document.querySelectorAll('[data-test-id^="sg-native-"]').forEach(e => {
    e.dataset.sgFeatureDisabled = "1", e.style.display = "", e.classList.add("sg-native-collapsible", "sg-native-hidden")
  })
}
let _sgNavTooltipEl = null,
  _sgNavTooltipShowTimer = null,
  _sgNavTooltipCurrentRow = null;

function sgGetNavTooltipEl() {
  if (_sgNavTooltipEl && document.body.contains(_sgNavTooltipEl)) return _sgNavTooltipEl;
  const e = document.createElement("div");
  return e.id = "sg-nav-tooltip", e.setAttribute("role", "tooltip"), e.setAttribute("aria-hidden", "true"), document.body.appendChild(e), _sgNavTooltipEl = e, e
}

function sgHideNavTooltip() {
  _sgNavTooltipShowTimer && (clearTimeout(_sgNavTooltipShowTimer), _sgNavTooltipShowTimer = null), _sgNavTooltipCurrentRow = null, _sgNavTooltipEl && (_sgNavTooltipEl.getAnimations().forEach(e => e.cancel()), _sgNavTooltipEl.classList.remove("sg-nav-tooltip-visible"), _sgNavTooltipEl.setAttribute("aria-hidden", "true"), _sgNavTooltipEl.animate([{
    opacity: 1,
    transform: "translateY(-50%) scale(1)"
  }, {
    opacity: 0,
    transform: "translateY(-50%) scale(0.8)"
  }], {
    duration: 75,
    easing: "cubic-bezier(0.4, 0, 1, 1)"
  }))
}

function sgShowNavTooltipFor(e) {
  const t = document.querySelector("chat-app");
  if (!t || t.classList.contains("side-nav-open")) return;
  const n = e.getAttribute("data-sg-tooltip");
  if (!n) return;
  const o = (e.querySelector(".mat-mdc-tooltip-trigger") || e).getBoundingClientRect();
  if (0 === o.width || 0 === o.height) return;
  const r = sgGetNavTooltipEl();
  r.textContent = n;
  const s = o.top + o.height / 2,
    a = o.right + 8;
  r.style.top = s + "px", r.style.left = a + "px", r.setAttribute("aria-hidden", "false"), r.getAnimations().forEach(e => e.cancel()), r.classList.add("sg-nav-tooltip-visible"), r.animate([{
    opacity: 0,
    transform: "translateY(-50%) scale(0.8)"
  }, {
    opacity: 1,
    transform: "translateY(-50%) scale(1)"
  }], {
    duration: 150,
    easing: "cubic-bezier(0, 0, 0.2, 1)"
  })
}

function sgAttachNavTooltip(e) {
  if (e.__sgNavTooltipBound) return;
  e.__sgNavTooltipBound = !0;
  const t = () => {
      _sgNavTooltipShowTimer && clearTimeout(_sgNavTooltipShowTimer), _sgNavTooltipCurrentRow = e, sgShowNavTooltipFor(e)
    },
    n = () => {
      _sgNavTooltipCurrentRow === e && sgHideNavTooltip()
    };
  e.addEventListener("mouseenter", t), e.addEventListener("mouseleave", n), e.addEventListener("focusin", t), e.addEventListener("focusout", n)
}

function sgInjectNativeMenu() {
  const e = sgGetAdditionalMenus();
  if (!e.length) return !1;
  let t = "",
    n = !1,
    o = !1;
  if (e.forEach(e => {
      const r = sgGetLibraryInMenu(e),
        s = sgSourceSignature(r);
      s || (o = !0), "A" !== r?.firstElementChild?.tagName || r.querySelector(".title-text") || (o = !0), t += s + "##";
      e.querySelectorAll('[data-test-id^="sg-native-"]').length !== SG_NATIVE_MENU_SPECS.length && (n = !0)
    }), o) return !0;
  if (!n && t === _sgLastInjectedSignature) return !0;
  _sgInjectingNow = !0;
  try {
    e.forEach(e => {
      const t = sgGetLibraryInMenu(e);
      if (!t || !t.firstElementChild) return;
      e.querySelectorAll('[data-test-id^="sg-native-"]').forEach(e => e.remove());
      const n = document.createDocumentFragment();
      SG_NATIVE_MENU_SPECS.forEach(e => {
        n.appendChild(sgMakeNativeNavItem(e, t))
      }), e.appendChild(n)
    }), _sgLastInjectedSignature = t
  } finally {
    Promise.resolve().then(() => {
      _sgInjectingNow = !1
    })
  }
  return sgSyncGetCached(["sidebarDropdownEnabled", "foldersEnabled", "promptsEnabled", "settingsInMenuEnabled"], e => {
    const t = document.querySelectorAll('[data-test-id^="sg-native-"]');
    !1 !== e.sidebarDropdownEnabled ? (!1 === e.foldersEnabled && document.querySelectorAll('[data-test-id="sg-native-folders"]').forEach(e => {
      e.dataset.sgFeatureDisabled = "1", e.style.display = "none"
    }), !1 === e.promptsEnabled && document.querySelectorAll('[data-test-id="sg-native-prompts"]').forEach(e => {
      e.dataset.sgFeatureDisabled = "1", e.style.display = "none"
    }), !0 !== e.settingsInMenuEnabled && document.querySelectorAll('[data-test-id="sg-native-settings"]').forEach(e => {
      e.dataset.sgFeatureDisabled = "1", e.style.display = "none"
    }), sgApplyNativeSubItemsVisibility()) : t.forEach(e => {
      e.dataset.sgFeatureDisabled = "1", e.style.display = "none"
    })
  }), !0
}

function sgNativeFormConverged() {
  const e = sgGetAdditionalMenus();
  if (!e.length) return !1;
  for (const t of e) {
    const e = sgGetLibraryInMenu(t),
      n = sgSourceSignature(e);
    if (!n) return !1;
    if ("A" === e?.firstElementChild?.tagName && !e.querySelector(".title-text")) return !1;
    const o = t.querySelector('[data-test-id="sg-native-folders"]') || t.querySelector('[data-test-id^="sg-native-"]');
    if (!o) return !1;
    if (sgSourceSignature(o) !== n) return !1
  }
  return !0
}
let _sgReinjectTimers = [],
  _sgReinjectPoll = null,
  _sgReinjectPendingOnVisible = !1,
  _sgReinjectVisBound = !1;

function sgEnsureReinjectVisibilityListener() {
  if (_sgReinjectVisBound || SG_IS_SILENT_BG_WORKER_TAB) return;
  _sgReinjectVisBound = !0;
  "undefined" != typeof document && "function" == typeof document.addEventListener && document.addEventListener("visibilitychange", () => {
    if (!document.hidden && _sgReinjectPendingOnVisible) {
      _sgReinjectPendingOnVisible = !1;
      sgScheduleNativeReinject();
    }
  });
}

function sgScheduleNativeReinject() {
  if (SG_IS_SILENT_BG_WORKER_TAB) return;
  sgEnsureReinjectVisibilityListener();
  _sgReinjectTimers.forEach(e => clearTimeout(e)), _sgReinjectTimers = [];
  _sgReinjectPoll && (clearInterval(_sgReinjectPoll), _sgReinjectPoll = null);
  if ("undefined" != typeof document && document.hidden) {
    _sgReinjectPendingOnVisible = !0;
    return;
  }
  _sgReinjectPendingOnVisible = !1;
  [50, 200, 500, 1e3].forEach(e => {
    _sgReinjectTimers.push(setTimeout(() => sgInjectNativeMenu(), e))
  });
  const e = Date.now();
  _sgReinjectPoll = setInterval(() => {
    if ("undefined" != typeof document && document.hidden) {
      clearInterval(_sgReinjectPoll);
      _sgReinjectPoll = null;
      _sgReinjectPendingOnVisible = !0;
      return;
    }
    sgInjectNativeMenu(), (sgNativeFormConverged() || Date.now() - e > 6e3) && (clearInterval(_sgReinjectPoll), _sgReinjectPoll = null)
  }, 300)
}

function sgSetupNativeMenuObserver() {
  _sgNativeMenuObserver && (_sgNativeMenuObserver.disconnect(), _sgNativeMenuObserver = null), _sgNativeMenuObserver = new MutationObserver(() => {
    _sgInjectingNow || sgScheduleNativeReinject();
    updateSidebarAutohideState();
  });
  const e = document.querySelector(".sidenav-with-history-container");
  e && _sgNativeMenuObserver.observe(e, {
    attributes: !0,
    attributeFilter: ["class"]
  });
  const app = document.querySelector("chat-app");
  app && _sgNativeMenuObserver.observe(app, {
    attributes: !0,
    attributeFilter: ["class"]
  });
}

/* ==========================================================================
   Auto-hide Collapsed Sidebar Feature
   ========================================================================== */
let autohideCollapsedSidebar = !0;
let _sgSidebarHoverTimer = null;
let _sgSidebarEnterTimer = null;
let _sgSidebarSensorEl = null;
let _sgSidebarListenersBound = !1;
let _sgCollapsedSidebarWidth = 53;
let _sgSidebarMenuSpawned = !1;
let _sgSidebarMenuOriginAt = 0;
let _sgLastMouseX = null;

function getCollapsedSidebarWidth() {
  const sidenav = document.querySelector("bard-sidenav, side-navigation-v2, .sidenav-with-history-container");
  if (sidenav) {
    const w = sidenav.offsetWidth;
    if (w > 30 && w < 120 && w !== _sgCollapsedSidebarWidth) {
      _sgCollapsedSidebarWidth = w;
      document.documentElement.style.setProperty("--sg-collapsed-sidebar-width", _sgCollapsedSidebarWidth + "px");
    }
  }
  return _sgCollapsedSidebarWidth;
}

function isGeminiSidebarCollapsed() {
  const app = document.querySelector("chat-app");
  if (app && app.classList.contains("side-nav-open")) return false;
  const sidenav = document.querySelector(".sidenav-with-history-container");
  if (sidenav && !sidenav.classList.contains("collapsed")) return false;
  return true;
}

function isSidebarMenuElVisible(el) {
  if (!el || !el.isConnected) return false;
  if (typeof getComputedStyle === "function") {
    const style = getComputedStyle(el);
    if (style && (style.display === "none" || style.visibility === "hidden")) return false;
  }
  if (typeof el.getBoundingClientRect === "function") {
    const rect = el.getBoundingClientRect();
    if (rect && rect.width === 0 && rect.height === 0) return false;
  }
  return true;
}

function hasOpenCdkMenuOverlay() {
  const panes = document.querySelectorAll(".cdk-overlay-pane");
  for (const pane of panes) {
    if (!isSidebarMenuElVisible(pane)) continue;
    if (pane.querySelector('.desktop-settings-menu, .mat-mdc-menu-panel, [role="menu"]')) {
      return true;
    }
  }
  return false;
}

function isSidebarMenuOpen() {
  const settingsMenu = document.querySelector(".desktop-settings-menu");
  if (isSidebarMenuElVisible(settingsMenu)) {
    _sgSidebarMenuSpawned = !0;
    return true;
  }

  const cdkMenuOpen = hasOpenCdkMenuOverlay();
  if (!cdkMenuOpen) {
    _sgSidebarMenuSpawned = !1;
    if (_sgSidebarMenuOriginAt && Date.now() - _sgSidebarMenuOriginAt > 600) {
      _sgSidebarMenuOriginAt = 0;
    }
  } else {
    if (_sgSidebarMenuSpawned) return true;
    if (_sgSidebarMenuOriginAt && Date.now() - _sgSidebarMenuOriginAt <= 600) {
      _sgSidebarMenuSpawned = !0;
      return true;
    }
  }

  const sidenav = document.querySelector("bard-sidenav, side-navigation-v2");
  if (sidenav && cdkMenuOpen) {
    const triggers = sidenav.querySelectorAll(
      'button[aria-expanded="true"][aria-controls^="cdk-overlay"], button[aria-expanded="true"][aria-controls^="mat-menu-panel"]'
    );
    for (const btn of triggers) {
      if (!isSidebarMenuElVisible(btn)) continue;
      const ctrlId = btn.getAttribute("aria-controls");
      const panel = ctrlId ? document.getElementById(ctrlId) : null;
      if (panel && panel.closest(".cdk-overlay-pane") && isSidebarMenuElVisible(panel)) {
        _sgSidebarMenuSpawned = !0;
        return true;
      }
    }
  }

  return false;
}

function clearSidebarHoverHideTimer() {
  if (_sgSidebarHoverTimer) {
    clearTimeout(_sgSidebarHoverTimer);
    _sgSidebarHoverTimer = null;
  }
}

function clearSidebarHoverEnterTimer() {
  if (_sgSidebarEnterTimer) {
    clearTimeout(_sgSidebarEnterTimer);
    _sgSidebarEnterTimer = null;
  }
}

function scheduleSidebarHoverReveal(delayMs = 80) {
  clearSidebarHoverHideTimer();
  if (document.body.classList.contains("sg-sidebar-hovered") || isSidebarMenuOpen() || delayMs <= 0) {
    clearSidebarHoverEnterTimer();
    document.body.classList.add("sg-sidebar-hovered");
    return;
  }
  if (_sgSidebarEnterTimer) return;
  _sgSidebarEnterTimer = setTimeout(() => {
    _sgSidebarEnterTimer = null;
    if (autohideCollapsedSidebar && isGeminiSidebarCollapsed()) {
      document.body.classList.add("sg-sidebar-hovered");
    }
  }, delayMs);
}

function scheduleSidebarHoverHide(delayMs = 180) {
  clearSidebarHoverEnterTimer();
  if (isSidebarMenuOpen()) {
    clearSidebarHoverHideTimer();
    return;
  }
  clearSidebarHoverHideTimer();
  _sgSidebarHoverTimer = setTimeout(() => {
    _sgSidebarHoverTimer = null;
    if (!isSidebarMenuOpen()) {
      document.body.classList.remove("sg-sidebar-hovered");
    }
  }, delayMs);
}

function reconcileSidebarHoverState() {
  if (!autohideCollapsedSidebar || !isGeminiSidebarCollapsed()) {
    _sgSidebarMenuSpawned = !1;
    _sgSidebarMenuOriginAt = 0;
    clearSidebarHoverEnterTimer();
    clearSidebarHoverHideTimer();
    if (document.body.classList.contains("sg-sidebar-hovered")) {
      document.body.classList.remove("sg-sidebar-hovered");
    }
    return;
  }
  if (isSidebarMenuOpen()) {
    clearSidebarHoverEnterTimer();
    clearSidebarHoverHideTimer();
    if (!document.body.classList.contains("sg-sidebar-hovered")) {
      document.body.classList.add("sg-sidebar-hovered");
    }
    return;
  }
  if (document.body.classList.contains("sg-sidebar-hovered")) {
    const side = document.querySelector("bard-sidenav, side-navigation-v2, .sidenav-with-history-container");
    const isHoveringSidebar = !!(side && typeof side.matches === "function" && side.matches(":hover")) ||
      !!(_sgSidebarSensorEl && typeof _sgSidebarSensorEl.matches === "function" && _sgSidebarSensorEl.matches(":hover"));
    const triggerWidth = getCollapsedSidebarWidth();
    const cursorOutside = _sgLastMouseX === null || _sgLastMouseX > triggerWidth + 30;
    if (!isHoveringSidebar && cursorOutside && !_sgSidebarHoverTimer) {
      scheduleSidebarHoverHide(180);
    }
  }
}

function updateSidebarAutohideState() {
  if (autohideCollapsedSidebar) {
    getCollapsedSidebarWidth();
    document.body.classList.add("sg-autohide-collapsed-sidebar");
    ensureSidebarHoverSensor();
    initSidebarAutohideListeners();
    bindCollapsedSidenavHover();
    injectSidebarExpandButton();
  } else {
    clearSidebarHoverEnterTimer();
    clearSidebarHoverHideTimer();
    _sgSidebarMenuSpawned = !1;
    _sgSidebarMenuOriginAt = 0;
    document.body.classList.remove("sg-autohide-collapsed-sidebar", "sg-sidebar-hovered");
    if (_sgSidebarSensorEl) {
      _sgSidebarSensorEl.remove();
      _sgSidebarSensorEl = null;
    }
    injectSidebarExpandButton();
  }
}

function expandGeminiSidebar() {
  const candidates = [
    'button[data-test-id="side-nav-menu-button"]',
    'button.main-menu-button',
    'button[aria-label="Main menu"]',
    'button[aria-label*="Main menu" i]',
    'button[aria-label*="Open menu" i]',
    'button[aria-label*="Expand menu" i]',
    'button[aria-label*="Navigation menu" i]',
    'button[aria-label*="Show menu" i]',
    'button[aria-label*="Expand sidebar" i]',
    'button[aria-label*="Toggle sidebar" i]',
    'button[aria-label*="sidebar" i]',
    'button[aria-label*="side panel" i]',
    'button[aria-label*="thanh bên" i]',
    'button[aria-label*="Mở trình đơn" i]',
    'button[aria-label*="Trình đơn chính" i]',
    'button.close-sidenav-button'
  ];
  const customExpandBtn = document.getElementById("sg-sidebar-expand-btn");
  for (const sel of candidates) {
    const el = document.querySelector(sel);
    if (el && el !== customExpandBtn && !el.disabled) {
      el.click();
      setTimeout(updateSidebarAutohideState, 80);
      return;
    }
  }
  const sparkleBtn = document.querySelector('button[data-test-id="side-nav-sparkle-button"]');
  if (sparkleBtn && sparkleBtn !== customExpandBtn && !sparkleBtn.disabled) {
    sparkleBtn.click();
    setTimeout(updateSidebarAutohideState, 80);
    return;
  }
  const app = document.querySelector("chat-app");
  if (app) {
    app.classList.add("side-nav-open");
    const c = document.querySelector(".sidenav-with-history-container");
    if (c) c.classList.remove("collapsed");
    updateSidebarAutohideState();
  }
}

function createSidebarExpandSvg() {
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("class", "sg-built-in-expand-svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "20");
  svg.setAttribute("height", "20");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");

  const rect = document.createElementNS(svgNS, "rect");
  rect.setAttribute("x", "3");
  rect.setAttribute("y", "3");
  rect.setAttribute("width", "18");
  rect.setAttribute("height", "18");
  rect.setAttribute("rx", "4");
  svg.appendChild(rect);

  const divider = document.createElementNS(svgNS, "path");
  divider.setAttribute("d", "M9 3v18");
  svg.appendChild(divider);

  const chevron = document.createElementNS(svgNS, "path");
  chevron.setAttribute("d", "M13 9l3 3-3 3");
  svg.appendChild(chevron);

  return svg;
}

function findCollapsedRailNewChatSlot(sidenav) {
  if (!sidenav) return null;
  const candidates = [
    'a[data-test-id="expanded-button"][href="/app"]',
    'a[data-test-id="expanded-button"][href$="/app"]',
    'a[href="/app"]',
    'a[href$="/app"]',
    '[data-test-id="new-chat-button"]',
    'button[aria-label*="New chat" i]',
    '[aria-label*="New chat" i]',
    '[aria-label="Create new chat" i]',
    'button[aria-label*="Cuộc trò chuyện mới" i]'
  ];
  for (const sel of candidates) {
    const el = sidenav.querySelector(sel);
    if (el) {
      return el.closest('side-nav-action-button, [data-test-id="new-chat-button"], .new-chat-container, .new-prompt-button') || el;
    }
  }
  return null;
}

function injectSidebarExpandButton() {
  // If sidebar is expanded, clean up any custom expand elements
  if (!isGeminiSidebarCollapsed()) {
    const existing = document.getElementById("sg-sidebar-expand-btn");
    if (existing) existing.remove();
    const existingSvgs = document.querySelectorAll(".sg-built-in-expand-svg");
    existingSvgs.forEach(s => s.remove());
    return;
  }

  const sidenav = document.querySelector("bard-sidenav, side-navigation-v2, .sidenav-with-history-container");
  if (!sidenav) return;

  const expandLabel = sgIsVietnameseGeminiUI() ? "Mở thanh bên" : "Expand sidebar";

  // Clean any stray expand SVG accidentally injected into detached buttons outside the rail
  const detachedSparkle = document.querySelector('button[data-test-id="side-nav-sparkle-button"]');
  if (detachedSparkle && !sidenav.contains(detachedSparkle)) {
    const stray = detachedSparkle.querySelector(".sg-built-in-expand-svg");
    if (stray) stray.remove();
  }

  // 1. If Gemini has an in-flow sparkle button inside the collapsed rail, reuse it
  const sparkleInRail = sidenav.querySelector('button[data-test-id="side-nav-sparkle-button"]');
  if (sparkleInRail) {
    const old = document.getElementById("sg-sidebar-expand-btn");
    if (old) old.remove();

    sparkleInRail.setAttribute("aria-label", expandLabel);
    sparkleInRail.setAttribute("title", expandLabel);
    sparkleInRail.setAttribute("data-sg-tooltip", expandLabel);

    if (!sparkleInRail.querySelector(".sg-built-in-expand-svg")) {
      sparkleInRail.appendChild(createSidebarExpandSvg());
    }

    if (!sparkleInRail._sgExpandBound) {
      sparkleInRail._sgExpandBound = true;
      sparkleInRail.addEventListener("click", (e) => {
        if (isGeminiSidebarCollapsed() && e.isTrusted) {
          e.preventDefault();
          e.stopPropagation();
          expandGeminiSidebar();
        }
      });
    }

    if (typeof sgAttachNavTooltip === "function" && !sparkleInRail._sgTooltipBound) {
      sparkleInRail._sgTooltipBound = true;
      sgAttachNavTooltip(sparkleInRail);
    }
    return;
  }

  // 2. Otherwise: strictly inject ONE expand button inside the rail directly above New Chat
  let btn = document.getElementById("sg-sidebar-expand-btn");
  if (!btn) {
    btn = document.createElement("button");
    btn.type = "button";
    btn.id = "sg-sidebar-expand-btn";
    btn.className = "sg-sidebar-expand-btn";
    btn.setAttribute("aria-label", expandLabel);
    btn.setAttribute("title", expandLabel);
    btn.setAttribute("data-sg-tooltip", expandLabel);
    btn.appendChild(createSidebarExpandSvg());

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      expandGeminiSidebar();
    });

    if (typeof sgAttachNavTooltip === "function") {
      sgAttachNavTooltip(btn);
    }
  } else {
    if (btn.getAttribute("aria-label") !== expandLabel) {
      btn.setAttribute("aria-label", expandLabel);
      btn.setAttribute("title", expandLabel);
      btn.setAttribute("data-sg-tooltip", expandLabel);
    }
    if (!btn.querySelector(".sg-built-in-expand-svg")) {
      btn.appendChild(createSidebarExpandSvg());
    }
  }

  const newChatSlot = findCollapsedRailNewChatSlot(sidenav);
  if (newChatSlot && newChatSlot.parentNode) {
    if (btn.nextElementSibling !== newChatSlot || btn.parentElement !== newChatSlot.parentNode) {
      newChatSlot.parentNode.insertBefore(btn, newChatSlot);
    }
  } else {
    const topContainer = sidenav.querySelector("side-navigation-content, .sidenav-with-history-container, .side-nav-container") || sidenav;
    if (btn.parentElement !== topContainer) {
      topContainer.prepend(btn);
    }
  }
}

function ensureSidebarHoverSensor() {
  if (!autohideCollapsedSidebar) return;
  if (_sgSidebarSensorEl && document.body.contains(_sgSidebarSensorEl)) return;
  const sensor = document.createElement("div");
  sensor.id = "sg-sidebar-hover-sensor";
  sensor.setAttribute("aria-hidden", "true");
  
  const chatApp = document.querySelector("chat-app");
  if (chatApp && chatApp.parentNode) {
    chatApp.parentNode.insertBefore(sensor, chatApp);
  } else {
    document.body.prepend(sensor);
  }
  _sgSidebarSensorEl = sensor;

  sensor.addEventListener("mouseenter", () => {
    if (!autohideCollapsedSidebar || !isGeminiSidebarCollapsed()) return;
    scheduleSidebarHoverReveal(80);
  });

  sensor.addEventListener("mouseleave", (e) => {
    clearSidebarHoverEnterTimer();
    const sidenav = document.querySelector("bard-sidenav, side-navigation-v2, .sidenav-with-history-container");
    if (e.relatedTarget && sidenav && (sidenav === e.relatedTarget || sidenav.contains(e.relatedTarget))) {
      return;
    }
    if (isSidebarMenuOpen()) return;
    scheduleSidebarHoverHide(200);
  });
}

function bindCollapsedSidenavHover() {
  const sidenav = document.querySelector("bard-sidenav, side-navigation-v2, .sidenav-with-history-container");
  if (!sidenav || sidenav._sgHoverBound) return;
  sidenav._sgHoverBound = true;
  sidenav.addEventListener("mouseenter", () => {
    if (!autohideCollapsedSidebar || !isGeminiSidebarCollapsed()) return;
    scheduleSidebarHoverReveal(80);
  });
  sidenav.addEventListener("mouseleave", (e) => {
    clearSidebarHoverEnterTimer();
    const triggerWidth = getCollapsedSidebarWidth();
    if (e.clientX <= triggerWidth || isSidebarMenuOpen()) return;
    scheduleSidebarHoverHide(200);
  });
}

function initSidebarAutohideListeners() {
  bindCollapsedSidenavHover();
  if (_sgSidebarListenersBound) return;
  _sgSidebarListenersBound = !0;

  document.addEventListener("pointerdown", (e) => {
    if (!autohideCollapsedSidebar || !isGeminiSidebarCollapsed()) return;
    const target = e.target;
    const inSidenav = !!(target && typeof target.closest === "function" && target.closest("bard-sidenav, side-navigation-v2"));
    if (inSidenav) {
      const isExpandBtn = !!target.closest('#sg-sidebar-expand-btn, button[data-test-id="side-nav-sparkle-button"]');
      if (!isExpandBtn) {
        _sgSidebarMenuOriginAt = Date.now();
      }
    } else if (!(target && typeof target.closest === "function" && target.closest(".cdk-overlay-pane"))) {
      _sgSidebarMenuOriginAt = 0;
      _sgSidebarMenuSpawned = !1;
    }
  }, true);

  document.addEventListener("keydown", (e) => {
    if (!autohideCollapsedSidebar || !isGeminiSidebarCollapsed()) return;
    if ("Enter" !== e.key && " " !== e.key) return;
    const target = e.target;
    const inSidenav = !!(target && typeof target.closest === "function" && target.closest("bard-sidenav, side-navigation-v2"));
    if (inSidenav && !target.closest('#sg-sidebar-expand-btn, button[data-test-id="side-nav-sparkle-button"]')) {
      _sgSidebarMenuOriginAt = Date.now();
    }
  }, true);

  let _sgSidebarMouseMoveRAF = !1;
  window.addEventListener("mousemove", (e) => {
    _sgLastMouseX = e.clientX;
    if (!autohideCollapsedSidebar) return;
    if (e.clientX > 160 && !document.body.classList.contains("sg-sidebar-hovered") && !_sgSidebarEnterTimer && !_sgSidebarMenuSpawned) {
      return;
    }
    if (_sgSidebarMouseMoveRAF) return;
    _sgSidebarMouseMoveRAF = !0;
    requestAnimationFrame(() => {
      _sgSidebarMouseMoveRAF = !1;
      const curX = _sgLastMouseX;
      if (curX === null) return;
      if (!autohideCollapsedSidebar || !isGeminiSidebarCollapsed()) {
        clearSidebarHoverEnterTimer();
        clearSidebarHoverHideTimer();
        _sgSidebarMenuSpawned = !1;
        _sgSidebarMenuOriginAt = 0;
        if (document.body.classList.contains("sg-sidebar-hovered")) {
          document.body.classList.remove("sg-sidebar-hovered");
        }
        return;
      }
      if (isSidebarMenuOpen()) {
        clearSidebarHoverEnterTimer();
        clearSidebarHoverHideTimer();
        if (!document.body.classList.contains("sg-sidebar-hovered")) {
          document.body.classList.add("sg-sidebar-hovered");
        }
        return;
      }
      const side = document.querySelector("bard-sidenav, side-navigation-v2, .sidenav-with-history-container");
      const rect = side ? side.getBoundingClientRect() : null;
      const triggerWidth = Math.max(getCollapsedSidebarWidth(), rect && rect.width > 0 ? rect.right : 53);

      if (curX <= triggerWidth + 8) {
        scheduleSidebarHoverReveal(80);
      } else {
        clearSidebarHoverEnterTimer();
        if (curX > triggerWidth + 30 && document.body.classList.contains("sg-sidebar-hovered")) {
          if (!_sgSidebarHoverTimer) {
            scheduleSidebarHoverHide(180);
          }
        }
      }
    });
  }, { passive: true });

  document.addEventListener("mouseleave", () => {
    _sgLastMouseX = null;
    clearSidebarHoverEnterTimer();
    if (isSidebarMenuOpen()) return;
    clearSidebarHoverHideTimer();
    if (document.body.classList.contains("sg-sidebar-hovered")) {
      document.body.classList.remove("sg-sidebar-hovered");
    }
  });
}

if (!SG_IS_SILENT_BG_WORKER_TAB) {
  try {
    sgSyncGetCached(["autohideCollapsedSidebar"], e => {
      if (void 0 !== e.autohideCollapsedSidebar) {
        autohideCollapsedSidebar = !1 !== e.autohideCollapsedSidebar;
      }
      updateSidebarAutohideState();
    });
    const _sgSidebarAutohideChanged = (e, t) => {
      if ("sync" === t && void 0 !== e.autohideCollapsedSidebar) {
        autohideCollapsedSidebar = !1 !== e.autohideCollapsedSidebar.newValue;
        updateSidebarAutohideState();
      }
    };
    if ("undefined" != typeof SG && SG.storage) {
      SG.storage.onChanged("legacy:sidebar-autohide-sync", _sgSidebarAutohideChanged, { area: "sync", keys: ["autohideCollapsedSidebar"] });
    } else if ("undefined" != typeof chrome && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener(_sgSidebarAutohideChanged);
    }
  } catch (e) {
    updateSidebarAutohideState();
  }
}

sgObserverRegistry.registerUIRefresh("sidebarAutohide", () => {
  if (autohideCollapsedSidebar) {
    updateSidebarAutohideState();
    reconcileSidebarHoverState();
  }
  injectSidebarExpandButton();
});

/* ==========================================================================
   Auto-hide Top-right Actions Feature
   ========================================================================== */
let autohideTopActions = !0;
let _sgTopActionsHoverTimer = null;
let _sgTopActionsEnterTimer = null;
let _sgTopActionsSensorEl = null;
let _sgTopActionsListenersBound = !1;
let _sgTopActionsMenuSpawned = !1;
let _sgTopActionsMenuOriginAt = 0;

function getTopActionsMenuRoot() {
  return document.querySelector("top-bar-actions .right-section") || document.querySelector("top-bar-actions");
}

function clearTopActionsHoverEnterTimer() {
  if (_sgTopActionsEnterTimer) {
    clearTimeout(_sgTopActionsEnterTimer);
    _sgTopActionsEnterTimer = null;
  }
}

function scheduleTopActionsReveal(delayMs = 90) {
  if (_sgTopActionsHoverTimer) {
    clearTimeout(_sgTopActionsHoverTimer);
    _sgTopActionsHoverTimer = null;
  }
  if (document.body.classList.contains("sg-top-actions-hovered") || isTopActionsMenuOpen() || delayMs <= 0) {
    clearTopActionsHoverEnterTimer();
    document.body.classList.add("sg-top-actions-hovered");
    return;
  }
  if (_sgTopActionsEnterTimer) return;
  _sgTopActionsEnterTimer = setTimeout(() => {
    _sgTopActionsEnterTimer = null;
    if (autohideTopActions) {
      document.body.classList.add("sg-top-actions-hovered");
    }
  }, delayMs);
}

function isTopActionsMenuOpen() {
  if (document.querySelector("#sg-export-popup-overlay, #sg-info-popup-overlay, .sg-bookmark-menu-overlay, .sg-bookmark-menu, .sg-export-popup, .sg-info-popup")) {
    return true;
  }

  const topRoot = getTopActionsMenuRoot();
  const hasExpandedTopBtn = !!(topRoot && topRoot.querySelector('button[aria-expanded="true"]:not([data-test-id*="bard-mode"])'));

  let hasVisibleMenuPanel = false;
  const menuPanels = document.querySelectorAll(".mat-mdc-menu-panel, [role='menu']");
  for (const pane of menuPanels) {
    if (pane.offsetParent !== null && pane.offsetHeight > 0) {
      hasVisibleMenuPanel = true;
      break;
    }
  }

  if (!hasVisibleMenuPanel) {
    _sgTopActionsMenuSpawned = !1;
    if (_sgTopActionsMenuOriginAt && Date.now() - _sgTopActionsMenuOriginAt > 600) {
      _sgTopActionsMenuOriginAt = 0;
    }
  } else {
    if (_sgTopActionsMenuSpawned) return true;
    if (_sgTopActionsMenuOriginAt && Date.now() - _sgTopActionsMenuOriginAt <= 600) {
      _sgTopActionsMenuSpawned = !0;
      return true;
    }
  }

  if (hasExpandedTopBtn) {
    if (hasVisibleMenuPanel) _sgTopActionsMenuSpawned = !0;
    return true;
  }

  return false;
}

function getTopActionsTriggerBounds() {
  const el = document.querySelector("top-bar-actions .right-section") || document.querySelector("top-bar-actions");
  if (el && el.offsetParent !== null) {
    const rect = el.getBoundingClientRect();
    return {
      width: Math.max(240, Math.round(window.innerWidth - rect.left + 24)),
      height: Math.max(54, Math.round(rect.bottom + 14))
    };
  }
  return { width: 260, height: 56 };
}

function ensureTopActionsHoverSensor() {
  if (!autohideTopActions) return;
  if (_sgTopActionsSensorEl && document.body.contains(_sgTopActionsSensorEl)) return;
  const sensor = document.createElement("div");
  sensor.id = "sg-top-actions-hover-sensor";
  sensor.setAttribute("aria-hidden", "true");

  document.body.prepend(sensor);
  _sgTopActionsSensorEl = sensor;

  sensor.addEventListener("mouseenter", () => {
    if (!autohideTopActions) return;
    scheduleTopActionsReveal(90);
  });

  sensor.addEventListener("mouseleave", (e) => {
    clearTopActionsHoverEnterTimer();
    const topBar = getTopActionsMenuRoot();
    if (e.relatedTarget && topBar && (topBar === e.relatedTarget || topBar.contains(e.relatedTarget))) {
      return;
    }
    if (isTopActionsMenuOpen()) return;
    if (_sgTopActionsHoverTimer) clearTimeout(_sgTopActionsHoverTimer);
    _sgTopActionsHoverTimer = setTimeout(() => {
      if (!isTopActionsMenuOpen()) {
        document.body.classList.remove("sg-top-actions-hovered");
      }
      _sgTopActionsHoverTimer = null;
    }, 220);
  });
}

function initTopActionsAutohideListeners() {
  if (_sgTopActionsListenersBound) return;
  _sgTopActionsListenersBound = !0;

  const trackTopActionsOrigin = (target) => {
    if (!autohideTopActions) return;
    const topRoot = getTopActionsMenuRoot();
    const inTopRight = !!(target && topRoot && (target === topRoot || topRoot.contains(target)));
    if (inTopRight) {
      _sgTopActionsMenuOriginAt = Date.now();
    } else if (!(target && typeof target.closest === "function" && target.closest(".cdk-overlay-pane, #sg-export-popup-overlay, #sg-info-popup-overlay, .sg-bookmark-menu-overlay, .sg-bookmark-menu"))) {
      _sgTopActionsMenuOriginAt = 0;
      _sgTopActionsMenuSpawned = !1;
    }
  };

  document.addEventListener("pointerdown", (e) => {
    trackTopActionsOrigin(e.target);
  }, true);

  document.addEventListener("keydown", (e) => {
    if ("Enter" !== e.key && " " !== e.key) return;
    trackTopActionsOrigin(e.target);
  }, true);

  let _sgTopActionsMouseMoveRAF = !1;
  let _sgTopLastMouseX = 0;
  let _sgTopLastMouseY = 0;
  window.addEventListener("mousemove", (e) => {
    _sgTopLastMouseX = e.clientX;
    _sgTopLastMouseY = e.clientY;
    if (!autohideTopActions) return;
    if ((e.clientY > 130 || e.clientX < window.innerWidth - 420) && !document.body.classList.contains("sg-top-actions-hovered") && !_sgTopActionsEnterTimer && !_sgTopActionsMenuSpawned) {
      return;
    }
    if (_sgTopActionsMouseMoveRAF) return;
    _sgTopActionsMouseMoveRAF = !0;
    requestAnimationFrame(() => {
      _sgTopActionsMouseMoveRAF = !1;
      if (!autohideTopActions) {
        _sgTopActionsMenuSpawned = !1;
        _sgTopActionsMenuOriginAt = 0;
        clearTopActionsHoverEnterTimer();
        if (_sgTopActionsHoverTimer) {
          clearTimeout(_sgTopActionsHoverTimer);
          _sgTopActionsHoverTimer = null;
        }
        if (document.body.classList.contains("sg-top-actions-hovered")) {
          document.body.classList.remove("sg-top-actions-hovered");
        }
        return;
      }

      if (isTopActionsMenuOpen()) {
        clearTopActionsHoverEnterTimer();
        if (_sgTopActionsHoverTimer) {
          clearTimeout(_sgTopActionsHoverTimer);
          _sgTopActionsHoverTimer = null;
        }
        if (!document.body.classList.contains("sg-top-actions-hovered")) {
          document.body.classList.add("sg-top-actions-hovered");
        }
        return;
      }

      const bounds = getTopActionsTriggerBounds();
      const isInZone = _sgTopLastMouseX >= (window.innerWidth - bounds.width) && _sgTopLastMouseY <= bounds.height;

      if (isInZone) {
        scheduleTopActionsReveal(90);
      } else {
        clearTopActionsHoverEnterTimer();
        if (document.body.classList.contains("sg-top-actions-hovered")) {
          const isWayOut = _sgTopLastMouseX < (window.innerWidth - bounds.width - 25) || _sgTopLastMouseY > (bounds.height + 25);
          if (isWayOut && !_sgTopActionsHoverTimer) {
            _sgTopActionsHoverTimer = setTimeout(() => {
              if (!isTopActionsMenuOpen()) {
                document.body.classList.remove("sg-top-actions-hovered");
              }
              _sgTopActionsHoverTimer = null;
            }, 200);
          }
        }
      }
    });
  }, { passive: true });

  document.addEventListener("mouseleave", () => {
    clearTopActionsHoverEnterTimer();
    if (isTopActionsMenuOpen()) return;
    if (document.body.classList.contains("sg-top-actions-hovered")) {
      document.body.classList.remove("sg-top-actions-hovered");
    }
  });
}

function reconcileTopActionsHoverState() {
  if (!autohideTopActions) {
    _sgTopActionsMenuSpawned = !1;
    _sgTopActionsMenuOriginAt = 0;
    clearTopActionsHoverEnterTimer();
    if (_sgTopActionsHoverTimer) {
      clearTimeout(_sgTopActionsHoverTimer);
      _sgTopActionsHoverTimer = null;
    }
    if (document.body.classList.contains("sg-top-actions-hovered")) {
      document.body.classList.remove("sg-top-actions-hovered");
    }
    return;
  }
  if (isTopActionsMenuOpen()) {
    clearTopActionsHoverEnterTimer();
    if (_sgTopActionsHoverTimer) {
      clearTimeout(_sgTopActionsHoverTimer);
      _sgTopActionsHoverTimer = null;
    }
    if (!document.body.classList.contains("sg-top-actions-hovered")) {
      document.body.classList.add("sg-top-actions-hovered");
    }
    return;
  }
  if (document.body.classList.contains("sg-top-actions-hovered")) {
    const topRoot = getTopActionsMenuRoot();
    const isHoveringTop = !!(topRoot && typeof topRoot.matches === "function" && topRoot.matches(":hover")) ||
      !!(_sgTopActionsSensorEl && typeof _sgTopActionsSensorEl.matches === "function" && _sgTopActionsSensorEl.matches(":hover"));
    if (!isHoveringTop && !_sgTopActionsHoverTimer) {
      _sgTopActionsHoverTimer = setTimeout(() => {
        if (!isTopActionsMenuOpen()) {
          document.body.classList.remove("sg-top-actions-hovered");
        }
        _sgTopActionsHoverTimer = null;
      }, 200);
    }
  }
}

function updateTopActionsAutohideState() {
  if (autohideTopActions) {
    document.body.classList.add("sg-autohide-top-actions");
    ensureTopActionsHoverSensor();
    initTopActionsAutohideListeners();
  } else {
    _sgTopActionsMenuSpawned = !1;
    _sgTopActionsMenuOriginAt = 0;
    clearTopActionsHoverEnterTimer();
    if (_sgTopActionsHoverTimer) {
      clearTimeout(_sgTopActionsHoverTimer);
      _sgTopActionsHoverTimer = null;
    }
    document.body.classList.remove("sg-autohide-top-actions", "sg-top-actions-hovered");
    if (_sgTopActionsSensorEl) {
      _sgTopActionsSensorEl.remove();
      _sgTopActionsSensorEl = null;
    }
  }
}

if (!SG_IS_SILENT_BG_WORKER_TAB) {
  try {
    sgSyncGetCached(["autohideTopActions"], e => {
      if (void 0 !== e.autohideTopActions) {
        autohideTopActions = !1 !== e.autohideTopActions;
      }
      updateTopActionsAutohideState();
    });
    const _sgTopActionsAutohideChanged = (e, t) => {
      if ("sync" === t && void 0 !== e.autohideTopActions) {
        autohideTopActions = !1 !== e.autohideTopActions.newValue;
        updateTopActionsAutohideState();
      }
    };
    if ("undefined" != typeof SG && SG.storage) {
      SG.storage.onChanged("legacy:top-actions-autohide-sync", _sgTopActionsAutohideChanged, { area: "sync", keys: ["autohideTopActions"] });
    } else if ("undefined" != typeof chrome && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener(_sgTopActionsAutohideChanged);
    }
  } catch (e) {
    updateTopActionsAutohideState();
  }
}

sgObserverRegistry.registerUIRefresh("topActionsAutohide", () => {
  if (autohideTopActions) {
    ensureTopActionsHoverSensor();
    reconcileTopActionsHoverState();
  }
});
