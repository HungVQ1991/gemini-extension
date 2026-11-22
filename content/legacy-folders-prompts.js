function showFoldersModal(e) {
  if (!sgRequireDataReady()) return;
  document.querySelectorAll(".sg-folders-modal").forEach(e => e.remove());
  const t = domQuery("sidebarScroller"),
    n = t ? t.scrollTop : 0,
    o = {
      isActive: !1,
      loadingId: 0
    };
  let r = null,
    s = !1;
  const a = document.createElement("div");

  function i(e, t) {
    const n = foldersData.folders.filter(t => t.parentId === (e || null)),
      o = new Set(foldersData.recycleBin?.map(e => e.id) || []);
    return foldersData.folders.forEach(e => {
      e.chats && (e.chats = e.chats.filter(e => !o.has(e.id)))
    }), 0 === n.length ? null === e ? '\n          <div class="sg-empty-state" style="text-align: center; padding: 60px 20px; color: #575a5a;">\n            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width: 48px; height: 48px; margin: 0 auto 16px; opacity: 0.5;">\n              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>\n            </svg>\n            <p style="font-size: 15px; margin: 0 0 8px;">No folders yet</p>\n            <p style="font-size: 13px; opacity: 0.7;">Create your first folder to organize your chats</p>\n          </div>\n        ' : "" : `\n      <div class="sg-folder-group" style="display: flex; flex-direction: column;">\n        ${n.map(e=>{const n=foldersData.folders.some(t=>t.parentId===e.id),o=!1!==e.expanded,r=20+24*t,s=escapeHtml(String(e.id||"")),c=sgSanitizeCssColor(e.color);return`\n            <div class="sg-folder-row-container" data-depth="${t}" data-folder-id="${s}">\n              <div class="sg-folder-row" \n                   data-folder-id="${s}"\n                   draggable="true"\n                   style="\n                    display: flex;\n                    align-items: center;\n                    padding: 16px 24px 16px ${r}px;\n                    border-radius: 8px;\n                    cursor: pointer;\n                    transition: background 0.1s;\n                    user-select: none;\n                    margin: 0 8px;\n                    border-bottom: 1px solid var(--gem-sys-color--outline-variant, #dce1e9);\n                    font-family: var(--sg-font-text);\n                   ">\n                \n                <div class="sg-folder-expand" data-folder-id="${s}" style="\n                  width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; \n                  background: transparent; border-radius: 50%; cursor: pointer; margin-right: 4px;\n                  opacity: ${n?1:0}; pointer-events: ${n?"auto":"none"};\n                  transition: background 0.2s;\n                ">\n                   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="${o?"sg-chevron-rotated":""}" style="\n                      width: 20px; height: 20px; color: var(--gem-sys-color--on-surface-variant, #575a5a);\n                      transition: transform 0.2s;\n                   ">\n                     <path d="M9 18l6-6-6-6"/>\n                   </svg>\n                </div>\n\n                <input type="checkbox" class="sg-folder-checkbox" data-folder-id="${s}" style="\n                    width: 24px; \n                    height: 24px; \n                    min-width: 24px;\n                    min-height: 24px;\n                    flex-shrink: 0;\n                    margin: 0;\n                    margin-right: 18px; \n                    cursor: pointer; \n                    accent-color: #4285f4;\n                ">\n\n                <div class="sg-folder-content" style="flex: 1; display: flex; align-items: center; gap: 12px; min-width: 0;">\n                  <svg viewBox="0 0 24 24" fill="currentColor" style="width: 20px; height: 20px; color: ${c}; flex-shrink: 0;">\n                    <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>\n                  </svg>\n                  <span class="sg-folder-name-text" style="\n                    font-size: 16px; \n                    color: var(--gem-sys-color--on-surface, #1f1f1f); \n                    font-weight: 500; \n                    white-space: nowrap; \n                    overflow: hidden; \n                    text-overflow: ellipsis;\n                  ">${escapeHtml(e.name)}</span>\n                  <span style="font-size: 14px; color: var(--gem-sys-color--on-surface-variant, #9aa0a6); margin-left: auto;">${(e.chats||[]).length} chats</span>\n                </div>\n\n                <button class="sg-folder-options-btn" data-folder-id="${s}" style="\n                    width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;\n                    border: none; background: transparent; border-radius: 50%; \n                    color: var(--gem-sys-color--on-surface-variant, #575a5a);\n                    cursor: pointer; opacity: 0; transition: all 0.2s; margin-left: 12px;\n                ">\n                  <svg viewBox="0 0 24 24" fill="currentColor" style="width: 22px; height: 22px;">\n                    <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>\n                  </svg>\n                </button>\n              </div>\n              \n              \x3c!-- Recursion container for animation --\x3e\n              <div class="sg-folder-children-container ${o?"sg-folder-children-expanded":"sg-folder-children-collapsed"}" data-parent-id="${s}">\n                ${n?i(e.id,t+1):""}\n              </div>\n            </div>\n           `}).join("")}\n      </div>\n    `
  }

  function l() {
    a.querySelectorAll(".sg-folder-row").forEach(e => {
      e.addEventListener("dragstart", t => {
        t.stopPropagation(), t.dataTransfer.setData("text/plain", e.dataset.folderId), t.dataTransfer.effectAllowed = "move", e.style.opacity = "0.5"
      }), e.addEventListener("dragend", () => {
        e.style.opacity = "1", activeDropTargetId = null, d()
      }), e.addEventListener("dragover", t => {
        if (t.preventDefault(), t.stopPropagation(), t.dataTransfer.types.includes("application/x-sg-chat-drag")) {
          const t = e.dataset.folderId;
          return void(activeDropTargetState && activeDropTargetState.id === t && "inside" === activeDropTargetState.position || (activeDropTargetState = {
            id: t,
            position: "inside"
          }, d()))
        }
        const n = e.getBoundingClientRect(),
          o = t.clientY - n.top,
          r = n.height;
        let s = "inside";
        o < .25 * r ? s = "top" : o > .75 * r && (s = "bottom");
        const a = document.querySelector('.sg-folder-row[style*="opacity: 0.5"]')?.dataset.folderId,
          i = e.dataset.folderId;
        if (a !== i) {
          const e = {
            id: i,
            position: s
          };
          activeDropTargetState && activeDropTargetState.id === i && activeDropTargetState.position === s || (activeDropTargetState = e, d())
        }
      }), e.addEventListener("dragleave", t => {
        const n = e.getBoundingClientRect();
        (t.clientY < n.top || t.clientY > n.bottom || t.clientX < n.left || t.clientX > n.right) && (activeDropTargetState = null, d())
      }), e.addEventListener("drop", t => {
        t.preventDefault(), t.stopPropagation();
        const n = t.dataTransfer.getData("application/x-sg-chat-drag");
        if (n) {
          activeDropTargetState = null, d(), sgFolderChatDragEnd();
          let t = null;
          try {
            t = JSON.parse(n)
          } catch (e) {
            return
          }
          if (!t?.chatId) return;
          return void addChatToFolder(e.dataset.folderId, t.chatId, t.chatTitle, t.chatUrl, !0).then(() => {
            a.isConnected && c()
          })
        }
        moveFolder(t.dataTransfer.getData("text/plain"), e.dataset.folderId, activeDropTargetState ? activeDropTargetState.position : "inside"), activeDropTargetState = null, d()
      }), e.addEventListener("click", t => {
        if (t.target.classList.contains("sg-folder-checkbox")) return;
        const n = e.dataset.folderId;
        a.remove(), showFolderChatsModal(n)
      }), e.addEventListener("mouseenter", () => {
        e.style.background = "var(--gem-sys-color--surface-container-highest, #dce1e9)", e.style.borderColor = "var(--gem-sys-color--outline, #c8d0da)";
        const t = e.querySelector(".sg-folder-options-btn");
        t && (t.style.opacity = "1")
      }), e.addEventListener("mouseleave", () => {
        e.style.background = "transparent", e.style.borderColor = "transparent", e.style.borderBottomColor = "var(--gem-sys-color--outline-variant, #dce1e9)";
        const t = e.querySelector(".sg-folder-options-btn");
        t && (t.style.opacity = "0")
      }), e.addEventListener("contextmenu", t => {
        t.preventDefault(), t.stopPropagation();
        showFolderContextMenu(e.querySelector(".sg-folder-options-btn") || e, e.dataset.folderId)
      })
    }), a.querySelectorAll(".sg-folder-expand").forEach(e => {
      e.addEventListener("click", async t => {
        t.stopPropagation();
        const n = e.dataset.folderId,
          o = foldersData.folders.find(e => e.id === n);
        if (o) {
          o.expanded = !1 === o.expanded;
          const t = e.closest(".sg-folder-row-container"),
            r = t?.querySelector(`.sg-folder-children-container[data-parent-id="${n}"]`),
            s = e.querySelector("svg");
          r && (o.expanded ? (r.classList.remove("sg-folder-children-collapsed"), r.classList.add("sg-folder-children-expanded"), s?.classList.add("sg-chevron-rotated")) : (r.classList.remove("sg-folder-children-expanded"), r.classList.add("sg-folder-children-collapsed"), s?.classList.remove("sg-chevron-rotated"))), saveFoldersData()
        }
      })
    }), a.querySelectorAll(".sg-folder-checkbox").forEach(e => {
      e.addEventListener("change", q), e.addEventListener("click", e => e.stopPropagation())
    }), a.querySelectorAll(".sg-folder-options-btn").forEach(e => {
      e.addEventListener("click", t => {
        t.stopPropagation(), showFolderContextMenu(e, e.dataset.folderId)
      }), e.addEventListener("mouseenter", () => {
        e.style.background = "#dce1e9", e.style.color = "#3c4043"
      }), e.addEventListener("mouseleave", () => {
        e.style.background = "transparent", e.style.color = "#575a5a"
      })
    })
  }

  function c() {
    const e = a.querySelector(".sg-folder-tree-container");
    if (!e) return;
    const t = e.scrollTop;sgSetSafeHtml(e, i(null, 0)), l(), e.scrollTop = t, q()
  }

  function d() {
    a.querySelectorAll(".sg-folder-row").forEach(e => {
      e.classList.remove("sg-drag-over", "sg-drag-over-top", "sg-drag-over-bottom"), activeDropTargetState && e.dataset.folderId === activeDropTargetState.id && ("inside" === activeDropTargetState.position ? e.classList.add("sg-drag-over") : "top" === activeDropTargetState.position ? e.classList.add("sg-drag-over-top") : "bottom" === activeDropTargetState.position && e.classList.add("sg-drag-over-bottom"))
    })
  }
  a.className = "sg-folders-modal", a.dataset.activeTab = "folders", a.style.cssText = "\n    position: fixed;\n    top: 0;\n    left: 0;\n    right: 0;\n    bottom: 0;\n    background: rgba(0, 0, 0, 0.4);\n    backdrop-filter: blur(4px);\n    display: flex;\n    align-items: center;\n    justify-content: center;\n    z-index: 2000;\n    opacity: 0;\n    transition: opacity 0.2s ease;\n  ",sgSetSafeHtml(a, `\n    <div class="sg-folders-modal-content" style="\n      width: 90%;\n      max-width: 900px;\n      height: 67.5vh;\n      background: var(--gem-sys-color--surface, #f0f4f8);\n      border-radius: 16px;\n      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);\n      display: flex;\n      flex-direction: column;\n      overflow: hidden;\n      font-family: var(--sg-font-text);\n    ">\n      \x3c!-- Header --\x3e\n      <div style="\n        display: flex;\n        align-items: center;\n        justify-content: space-between;\n        padding: 11.5px 32px;\n        border-bottom: 1px solid var(--gem-sys-color--outline-variant, #dce1e9);\n        background: var(--gem-sys-color--surface, #f0f4f8);\n      ">\n        <div style="display: flex; align-items: center; gap: 16px; flex: 1;">\n          \x3c!-- Help Icon --\x3e\n          <a id="sg-tab-help-link" href="${guideUrl}#folders" target="_blank" class="sg-help-link" style="margin-right: -8px;">\n            <span class="sg-help-btn" data-tooltip-fast="Open guide for this feature">?</span>\n          </a>\n          \x3c!-- Tabbed Navigation Pill --\x3e\n          <div class="sg-tabs-pill" style="\n            display: flex;\n            background: var(--gem-sys-color--surface-container-high, #e9eef6);\n            border-radius: 24px;\n            padding: 4px;\n            gap: 4px;\n          ">\n            <button id="sg-tab-folders" class="sg-tab-btn active" style="\n              border: none;\n              border-radius: 20px;\n              padding: 8px 20px;\n              font-size: 14px;\n              font-weight: 500;\n              cursor: pointer;\n              transition: all 0.2s ease;\n              background: ${getThemeColors().tabActiveBg};\n              color: var(--gem-sys-color--on-surface, #1f1f1f);\n              box-shadow: ${isDarkTheme()?"0 1px 3px rgba(0,0,0,0.5)":"0 1px 3px rgba(0,0,0,0.1)"};\n            ">Folders</button>\n            <button id="sg-tab-chats" class="sg-tab-btn" style="\n              border: none;\n              border-radius: 20px;\n              padding: 8px 20px;\n              font-size: 14px;\n              font-weight: 500;\n              cursor: pointer;\n              transition: all 0.2s ease;\n              background: transparent;\n              color: var(--gem-sys-color--on-surface-variant, #575a5a);\n            ">Chats</button>\n            <button id="sg-tab-recycle-bin" class="sg-tab-btn" style="\n              border: none;\n              border-radius: 20px;\n              padding: 8px 20px;\n              font-size: 14px;\n              font-weight: 500;\n              cursor: pointer;\n              transition: all 0.2s ease;\n              background: transparent;\n              color: var(--gem-sys-color--on-surface-variant, #575a5a);\n              display: ${!1!==foldersData.trashcanEnabled?"block":"none"};\n            ">Trash</button>\n          </div>\n\n          \x3c!-- Action Buttons Moved Here --\x3e\n          <div style="display: flex; align-items: center; gap: 8px;">\n            <button id="sg-add-folder-modal-btn" style="\n              display: flex;\n              align-items: center;\n              gap: 8px;\n              padding: 0 18px;\n              height: 38px;\n              background: var(--gem-sys-color--surface-container-high, #e9eef6);\n              border: none;\n              border-radius: 20px;\n              color: var(--gem-sys-color--on-surface, #1f1f1f);\n              font-size: 13px;\n              font-weight: 500;\n              cursor: pointer;\n              transition: all 0.15s ease;\n            ">\n              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;">\n                <path d="M12 5v14M5 12h14"/>\n              </svg>\n              Add Folder\n            </button>\n\n            <button id="sg-delete-selected-btn" style="\n              display: flex;\n              align-items: center;\n              gap: 6px;\n              padding: 0 18px;\n              height: 38px;\n              background: var(--gem-sys-color--surface-container-high, #e9eef6);\n              border: none;\n              border-radius: 20px;\n              color: var(--gem-sys-color--on-surface, #1f1f1f);\n              font-size: 13px;\n              font-weight: 500;\n              cursor: pointer;\n              transition: all 0.15s ease;\n              opacity: 0.5;\n              pointer-events: none;\n            " onmouseenter="if(this.style.opacity === '1') this.style.background='var(--sg-surface-hover, #dce1e9)'" onmouseleave="if(this.style.opacity === '1') this.style.background='var(--gem-sys-color--surface-container-high, #e9eef6)'">\n              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;">\n                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>\n              </svg>\n              Delete Selected\n            </button>\n\n            \x3c!-- Hide Foldered Chats Toggle --\x3e\n            <div id="sg-hide-foldered-toggle" style="\n              display: flex;\n              align-items: center;\n              gap: 10px;\n              padding: 0 16px;\n              height: 38px;\n              margin-left: 8px;\n              background: var(--gem-sys-color--surface-container-high, #e9eef6);\n              border-radius: 20px;\n              cursor: pointer;\n              user-select: none;\n              transition: background 0.15s ease;\n            " onmouseenter="this.style.background='var(--gem-sys-color--surface-container-highest, #dce1e9)'" onmouseleave="this.style.background='var(--gem-sys-color--surface-container-high, #e9eef6)'">\n              <div class="sg-checkbox-custom" style="\n                width: 18px;\n                height: 18px;\n                border: 2px solid var(--gem-sys-color--outline, #727676);\n                border-radius: 4px;\n                display: flex;\n                align-items: center;\n                justify-content: center;\n                transition: all 0.15s ease;\n                background: transparent;\n              ">\n                <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="4" style="width: 12px; height: 12px; display: none;">\n                  <path d="M20 6L9 17l-5-5"/>\n                </svg>\n              </div>\n              <span style="font-size: 13px; font-weight: 500; color: var(--gem-sys-color--on-surface, #1f1f1f); white-space: nowrap;">Hide foldered (sidebar)</span>\n            </div>\n\n          </div>\n\n          \x3c!-- Recycle Bin Actions (hidden by default) --\x3e\n          <div id="sg-bin-actions" style="display: none; align-items: center; gap: 8px;">\n            <button id="sg-bin-delete-selected-btn" style="\n              display: flex;\n              align-items: center;\n              gap: 6px;\n              padding: 0 18px;\n              height: 38px;\n              background: var(--gem-sys-color--surface-container-high, #e9eef6);\n              border: none;\n              border-radius: 20px;\n              color: var(--gem-sys-color--on-surface, #1f1f1f);\n              font-size: 13px;\n              font-weight: 500;\n              cursor: pointer;\n              transition: all 0.15s ease;\n              opacity: 0.5;\n              pointer-events: none;\n            " onmouseenter="if(this.style.opacity === '1') this.style.background='var(--sg-surface-hover, #dce1e9)'" onmouseleave="if(this.style.opacity === '1') this.style.background='var(--gem-sys-color--surface-container-high, #e9eef6)'">\n              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;">\n                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>\n              </svg>\n              Delete Selected\n            </button>\n            \n            <button id="sg-bin-restore-selected-btn" style="\n              display: flex;\n              align-items: center;\n              gap: 6px;\n              padding: 0 18px;\n              height: 38px;\n              background: var(--gem-sys-color--surface-container-high, #e9eef6);\n              border: none;\n              border-radius: 20px;\n              color: var(--gem-sys-color--on-surface, #1f1f1f);\n              font-size: 13px;\n              font-weight: 500;\n              cursor: pointer;\n              transition: all 0.15s ease;\n              opacity: 0.5;\n              pointer-events: none;\n            " onmouseenter="if(this.style.opacity === '1') this.style.background='var(--sg-surface-hover, #dce1e9)'" onmouseleave="if(this.style.opacity === '1') this.style.background='var(--gem-sys-color--surface-container-high, #e9eef6)'">\n              <svg viewBox="0 0 24 24" fill="currentColor" style="width: 14px; height: 14px;">\n                <path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/>\n              </svg>\n              Restore Selected\n            </button>\n\n            <div id="sg-bin-select-all-toggle" style="\n              display: flex;\n              align-items: center;\n              gap: 10px;\n              padding: 0 16px;\n              height: 38px;\n              background: var(--gem-sys-color--surface-container-high, #e9eef6);\n              border-radius: 20px;\n              cursor: pointer;\n              user-select: none;\n              transition: background 0.15s ease;\n            " onmouseenter="this.style.background='var(--gem-sys-color--surface-container-highest, #dce1e9)'" onmouseleave="this.style.background='var(--gem-sys-color--surface-container-high, #e9eef6)'">\n              <div class="sg-checkbox-custom" style="\n                width: 18px;\n                height: 18px;\n                border: 2px solid var(--gem-sys-color--outline, #727676);\n                border-radius: 4px;\n                display: flex;\n                align-items: center;\n                justify-content: center;\n                transition: all 0.15s ease;\n                background: transparent;\n              ">\n                <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="4" style="width: 12px; height: 12px; display: none;">\n                  <path d="M20 6L9 17l-5-5"/>\n                </svg>\n              </div>\n              <span style="font-size: 13px; font-weight: 500; color: var(--gem-sys-color--on-surface, #1f1f1f);">Select All</span>\n              <span id="sg-bin-selected-count" style="font-size: 13px; color: var(--gem-sys-color--on-surface-variant, #575a5a); opacity: 0.7;">(0)</span>\n            </div>\n          </div>\n\n          \x3c!-- Chats Tab Actions (hidden by default) --\x3e\n          <div id="sg-chats-actions" style="display: none; align-items: center; gap: 16px;">\n            \x3c!-- Select All moved to the bottom footer (#sg-chats-footer) --\x3e\n            <div id="sg-chats-hide-foldered-toggle" style="\n              display: flex;\n              align-items: center;\n              gap: 10px;\n              padding: 0 16px;\n              height: 38px;\n              background: var(--gem-sys-color--surface-container-high, #e9eef6);\n              border-radius: 20px;\n              cursor: pointer;\n              user-select: none;\n              transition: background 0.15s ease;\n            " onmouseenter="this.style.background='var(--gem-sys-color--surface-container-highest, #dce1e9)'" onmouseleave="this.style.background='var(--gem-sys-color--surface-container-high, #e9eef6)'">\n              <div class="sg-checkbox-custom" style="\n                width: 18px;\n                height: 18px;\n                border: 2px solid var(--gem-sys-color--outline, #727676);\n                border-radius: 4px;\n                display: flex;\n                align-items: center;\n                justify-content: center;\n                transition: all 0.15s ease;\n                background: transparent;\n              ">\n                <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="4" style="width: 12px; height: 12px; display: none;">\n                  <path d="M20 6L9 17l-5-5"/>\n                </svg>\n              </div>\n              <span style="font-size: 13px; font-weight: 500; color: var(--gem-sys-color--on-surface, #1f1f1f); white-space: nowrap;">Hide foldered</span>\n            </div>\n\n            \x3c!-- Bulk Actions Dropdown --\x3e\n            <div id="sg-chats-bulk-actions-container" style="position: relative; display: flex; align-items: center;">\n              <button id="sg-chats-bulk-actions-btn" style="\n                display: flex;\n                align-items: center;\n                gap: 6px;\n                padding: 0 18px;\n                height: 38px;\n                background: var(--gem-sys-color--surface-container-high, #e9eef6);\n                border: none;\n                border-radius: 20px;\n                color: var(--gem-sys-color--on-surface, #1f1f1f);\n                font-size: 13px;\n                font-weight: 500;\n                cursor: pointer;\n                transition: all 0.15s ease;\n              " onmouseenter="if(this.style.opacity === '1') this.style.background='var(--sg-surface-hover, #dce1e9)'" onmouseleave="if(this.style.opacity === '1') this.style.background='var(--gem-sys-color--surface-container-high, #e9eef6)'">\n                Bulk Actions\n                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px; margin-left: 2px;">\n                  <path d="M6 9l6 6 6-6"/>\n                </svg>\n              </button>\n\n              <div id="sg-chats-bulk-menu" style="\n                display: none;\n                position: absolute;\n                top: calc(100% + 8px);\n                right: 0;\n                width: 180px;\n                background: var(--gem-sys-color--surface-container-highest, #f0f4f8);\n                border: 1px solid var(--gem-sys-color--outline-variant, #dce1e9);\n                border-radius: 12px;\n                box-shadow: 0 4px 12px rgba(0,0,0,0.15);\n                z-index: 100;\n                padding: 4px;\n                flex-direction: column;\n                overflow: hidden;\n              ">\n                <button class="sg-bulk-action-item" data-action="delete" style="\n                  display: flex; align-items: center; gap: 10px; padding: 10px 12px;\n                  background: transparent; border: none; border-radius: 8px;\n                  color: var(--gem-sys-color--on-surface, #1f1f1f); font-size: 13px; font-weight: 500;\n                  cursor: pointer; transition: background 0.15s ease; text-align: left;\n                ">\n                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;">\n                    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>\n                  </svg>\n                  Delete Selected\n                </button>\n                <button class="sg-bulk-action-item" data-action="export" style="\n                  display: flex; align-items: center; gap: 10px; padding: 10px 12px;\n                  background: transparent; border: none; border-radius: 8px;\n                  color: var(--gem-sys-color--on-surface, #1f1f1f); font-size: 13px; font-weight: 500;\n                  cursor: pointer; transition: background 0.15s ease; text-align: left;\n                ">\n                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;">\n                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>\n                  </svg>\n                  Export Selected\n                </button>\n                <button class="sg-bulk-action-item" data-action="move" style="\n                  display: flex; align-items: center; gap: 10px; padding: 10px 12px;\n                  background: transparent; border: none; border-radius: 8px;\n                  color: var(--gem-sys-color--on-surface, #1f1f1f); font-size: 13px; font-weight: 500;\n                  cursor: pointer; transition: background 0.15s ease; text-align: left;\n                ">\n                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;">\n                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>\n                  </svg>\n                  Move to Folder\n                </button>\n              </div>\n            </div>\n          </div>\n        </div>\n        \n        <button class="sg-close-modal-btn" style="\n          width: 36px;\n          height: 36px;\n          background: transparent;\n          border: none;\n          border-radius: 50%;\n          color: var(--gem-sys-color--on-surface-variant, #575a5a);\n          cursor: pointer;\n          display: flex;\n          align-items: center;\n          justify-content: center;\n          transition: all 0.15s ease;\n          margin-left: 16px; \n        ">\n          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 20px; height: 20px;">\n            <path d="M18 6L6 18M6 6l12 12"/>\n          </svg>\n        </button>\n      </div>\n      \n      \x3c!-- Toolbar: Search Only --\x3e\n      <div style="\n        display: flex;\n        align-items: center;\n        gap: 12px;\n        padding: 12px 32px; /* Matches header horizontal padding */\n        border-bottom: 1px solid var(--gem-sys-color--outline-variant, #dce1e9);\n      ">\n        <div style="\n          flex: 1;\n          display: flex;\n          align-items: center;\n          gap: 8px;\n          padding: 14px 14px;\n          background: var(--gem-sys-color--surface-container-high, #e9eef6);\n          border-radius: 20px;\n          border: 1px solid var(--gem-sys-color--outline, #dce1e9);\n        ">\n          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px; color: var(--gem-sys-color--on-surface-variant, #575a5a);">\n            <circle cx="11" cy="11" r="8"/>\n            <path d="M21 21l-4.35-4.35"/>\n          </svg>\n          <input type="text" id="sg-folder-search-input" placeholder="Search folders..." style="\n            flex: 1;\n            background: transparent;\n            border: none;\n            outline: none;\n            color: var(--gem-sys-color--on-surface, #1f1f1f);\n            font-size: 13px;\n          ">\n        </div>\n        <button id="sg-folder-sync-btn" class="sg-folder-sync-btn" title="Sync with Google Drive" style="display: none;">\n          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px;">\n            <path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>\n            <path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>\n            <polyline points="21 3 21 8 16 8"/>\n            <polyline points="3 21 3 16 8 16"/>\n          </svg>\n        </button>\n      </div>\n\n      <div class="sg-folder-tree-container" style="\n        flex: 1;\n        overflow: auto;\n        scrollbar-gutter: stable;\n        padding: 0;\n      ">\n        <div id="sg-folder-tree-list">\n          ${i(null,0)}\n        </div>\n      </div>\n\n      \x3c!-- Chats Tab Footer (Sort A-Z + Select All + Bulk Actions) — visibility toggled in switchToChats / switchToFolders / switchToRecycleBin.\n           Layout mirrors the Add-Chats-to-Folder modal footer: native checkbox labels on the left, action button(s) on the right. --\x3e\n      <div id="sg-chats-footer" style="\n        display: none;\n        align-items: center;\n        justify-content: space-between;\n        padding: 12px 32px;\n        border-top: 1px solid var(--gem-sys-color--outline-variant, #dce1e9);\n        background: var(--gem-sys-color--surface, #f0f4f8);\n        flex-shrink: 0;\n      ">\n        <div style="display: flex; align-items: center; gap: 18px;">\n          <label id="sg-chats-sort-az-toggle" style="display: flex; align-items: center; gap: 8px; cursor: pointer; user-select: none; font-family: var(--sg-font-text);">\n            <input type="checkbox" id="sg-chats-sort-az-input" style="\n              width: 20px;\n              height: 20px;\n              accent-color: #4285f4;\n              cursor: pointer;\n            ">\n            <span style="font-size: 14px; color: var(--gem-sys-color--on-surface, #1f1f1f); font-weight: 500;">Sort A-Z</span>\n          </label>\n          <label id="sg-chats-select-all-toggle" style="display: flex; align-items: center; gap: 8px; cursor: pointer; user-select: none; font-family: var(--sg-font-text);">\n            <input type="checkbox" id="sg-chats-select-all-input" style="\n              width: 20px;\n              height: 20px;\n              accent-color: #4285f4;\n              cursor: pointer;\n            ">\n            <span style="font-size: 14px; color: var(--gem-sys-color--on-surface, #1f1f1f); font-weight: 500;">Select All</span>\n            <span id="sg-chats-selected-count" style="font-size: 13px; color: var(--gem-sys-color--on-surface-variant, #575a5a); opacity: 0.7;">(0)</span>\n          </label>\n        </div>\n      </div>\n\n    </div>\n  `), a.refreshTree = c, setTimeout(() => {
    l();
    const e = a.querySelector(".sg-folder-tree-container");
    setupShiftClickSelection(e, ".sg-folder-checkbox", q), e.addEventListener("dragover", e => {
      e.dataTransfer.types.includes("application/x-sg-chat-drag") || e.preventDefault(), e.target.closest(".sg-folder-row") || (activeDropTargetState = null, d())
    }), e.addEventListener("drop", e => {
      if (!e.dataTransfer.types.includes("application/x-sg-chat-drag") && (e.preventDefault(), !e.target.closest(".sg-folder-row"))) {
        moveFolder(e.dataTransfer.getData("text/plain"), null, "inside")
      }
    })
  }, 50), document.body.appendChild(a);
  const u = () => a.querySelector("#sg-folder-search-input")?.focus();
  setTimeout(u, 100), setTimeout(u, 250), requestAnimationFrame(() => {
    a.style.opacity = "1"
  });
  let p = null,
    g = null;
  const m = (e = !1) => {
    if (!p) return;
    sgUnregisterAnchoredTip(p), p.style.animation = "sg-onboarding-fade-in 0.2s ease-out reverse";
    const t = p,
      n = g;
    p = null, g = null, setTimeout(() => {
      t.remove(), n && window.removeEventListener("resize", n)
    }, 200), e && chrome.storage.local.set({
      hasSeenCreateFolderTip: !0
    })
  };
  chrome.storage.local.get("hasSeenCreateFolderTip", e => {
    if (e.hasSeenCreateFolderTip) return;
    const t = a.querySelector("#sg-add-folder-modal-btn");
    t && setTimeout(() => {
      if (!a.isConnected) return;
      if (foldersData.folders && foldersData.folders.length > 0) return;
      if (document.getElementById("sg-create-folder-tip")) return;
      const e = document.createElement("div");

      function n() {
        const n = t.getBoundingClientRect();
        e.style.top = `${n.bottom+14}px`, e.style.left = n.left + n.width / 2 - e.offsetWidth / 2 + "px"
      }
      e.id = "sg-create-folder-tip", e.className = "sg-onboarding-popup",sgSetSafeHtml(e, '\n        <div class="sg-onboarding-popup-content" style="max-width: 250px; padding: 16px;">\n          <div class="sg-onboarding-popup-arrow sg-onboarding-popup-arrow-up"></div>\n          <button id="sg-create-folder-tip-close" class="sg-onboarding-popup-close" aria-label="Close">\n            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">\n              <path d="M18 6L6 18M6 6l12 12"/>\n            </svg>\n          </button>\n          <h3 class="sg-onboarding-popup-title" style="font-size: 14px; margin-bottom: 6px;">💡 Create your first folder</h3>\n          <p class="sg-onboarding-popup-message" style="margin-bottom: 12px;">Create your first folder to start organizing your chats.</p>\n          <button class="sg-onboarding-popup-button" id="sg-create-folder-tip-ok" style="padding: 8px 16px; font-size: 13px;">Add Folder</button>\n        </div>\n      '), e.style.zIndex = "10001", p = e, document.body.appendChild(e), sgRegisterAnchoredTip(e, a, m), n(), window.addEventListener("resize", n), g = n, e.querySelector("#sg-create-folder-tip-close").addEventListener("click", () => m(!0)), e.querySelector("#sg-create-folder-tip-ok").addEventListener("click", () => {
        m(!0), t.click()
      }), t.addEventListener("click", () => m(!0), {
        once: !0
      })
    }, 500)
  });
  let h = null,
    f = null;
  const y = (e = !1) => {
    if (!h) return;
    sgUnregisterAnchoredTip(h), h.style.animation = "sg-onboarding-fade-in 0.2s ease-out reverse";
    const t = h,
      n = f;
    h = null, f = null, setTimeout(() => {
      t.remove(), n && window.removeEventListener("resize", n)
    }, 200), e && chrome.storage.local.set({
      hasSeenOpenFolderTip: !0
    })
  };
  chrome.storage.local.get("hasSeenOpenFolderTip", e => {
    e.hasSeenOpenFolderTip || setTimeout(() => {
      if (!a.isConnected) return;
      if (!foldersData.folders || 0 === foldersData.folders.length) return;
      if (document.getElementById("sg-create-folder-tip")) return;
      if (document.getElementById("sg-open-folder-tip")) return;
      const e = a.querySelector(".sg-folder-row");
      if (!e) return;
      const t = document.createElement("div");

      function n() {
        const n = e.getBoundingClientRect();
        t.style.top = `${n.bottom+12}px`;
        const o = n.left + Math.min(n.width / 2, 110);
        t.style.left = o - t.offsetWidth / 2 + "px"
      }
      t.id = "sg-open-folder-tip", t.className = "sg-onboarding-popup",sgSetSafeHtml(t, '\n        <div class="sg-onboarding-popup-content" style="max-width: 250px; padding: 16px;">\n          <div class="sg-onboarding-popup-arrow sg-onboarding-popup-arrow-up"></div>\n          <button id="sg-open-folder-tip-close" class="sg-onboarding-popup-close" aria-label="Close">\n            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">\n              <path d="M18 6L6 18M6 6l12 12"/>\n            </svg>\n          </button>\n          <h3 class="sg-onboarding-popup-title" style="font-size: 14px; margin-bottom: 6px;">💡 Open your folder</h3>\n          <p class="sg-onboarding-popup-message" style="margin-bottom: 12px;">Open a folder to see the chats inside.</p>\n          <button class="sg-onboarding-popup-button" id="sg-open-folder-tip-ok" style="padding: 8px 16px; font-size: 13px;">Open folder</button>\n        </div>\n      '), t.style.zIndex = "10001", h = t, document.body.appendChild(t), sgRegisterAnchoredTip(t, a, y), n(), window.addEventListener("resize", n), f = n, t.querySelector("#sg-open-folder-tip-close").addEventListener("click", () => y(!0)), t.querySelector("#sg-open-folder-tip-ok").addEventListener("click", () => {
        y(!0), e.click()
      });
      const o = a.querySelector(".sg-folder-tree-container");
      o && o.addEventListener("click", () => y(!0), {
        capture: !0,
        once: !0
      })
    }, 500)
  });
  let b = null,
    v = null;
  const x = (e = !1) => {
    if (!b) return;
    sgUnregisterAnchoredTip(b), b.style.animation = "sg-onboarding-fade-in 0.2s ease-out reverse";
    const t = b,
      n = v;
    b = null, v = null, setTimeout(() => {
      t.remove(), n && window.removeEventListener("resize", n)
    }, 200), e && chrome.storage.local.set({
      hasSeenFoldersHideTip: !0
    })
  };
  chrome.storage.local.get(["hasSeenFoldersHideTip", "hasSeenOpenFolderTip"], e => {
    if (e.hasSeenFoldersHideTip) return;
    if (!e.hasSeenOpenFolderTip) return;
    const t = a.querySelector("#sg-hide-foldered-toggle");
    t && setTimeout(() => {
      if (!a.isConnected) return;
      if (!foldersData.folders || 0 === foldersData.folders.length) return;
      if (document.getElementById("sg-hide-foldered-tip")) return;
      const e = document.createElement("div");

      function n() {
        const n = t.getBoundingClientRect();
        e.style.top = n.top + n.height / 2 - 73 + "px", e.style.left = `${n.right+16}px`
      }
      e.id = "sg-hide-foldered-tip", e.className = "sg-onboarding-popup",sgSetSafeHtml(e, '\n        <div class="sg-onboarding-popup-content" style="max-width: 250px; padding: 16px;">\n          <div class="sg-onboarding-popup-arrow"></div>\n          <button id="sg-hide-foldered-tip-close" class="sg-onboarding-popup-close" aria-label="Close">\n            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">\n              <path d="M18 6L6 18M6 6l12 12"/>\n            </svg>\n          </button>\n          <h3 class="sg-onboarding-popup-title" style="font-size: 14px; margin-bottom: 6px;">💡 Hide Foldered Chats</h3>\n          <p class="sg-onboarding-popup-message" style="margin-bottom: 12px;">Enable this to hide chats that are already in a folder from your sidebar.</p>\n          <button class="sg-onboarding-popup-button" id="sg-hide-foldered-tip-ok" style="padding: 8px 16px; font-size: 13px;">Got it</button>\n        </div>\n      '), e.style.zIndex = "10001", b = e, document.body.appendChild(e), sgRegisterAnchoredTip(e, a, x), n(), window.addEventListener("resize", n), v = n, e.querySelector("#sg-hide-foldered-tip-close").addEventListener("click", () => x(!0)), e.querySelector("#sg-hide-foldered-tip-ok").addEventListener("click", () => x(!0)), t.addEventListener("click", () => x(!0), {
        once: !0
      })
    }, 500)
  });
  let w = null,
    S = null;
  const E = (e = !1) => {
      if (!w) return;
      sgUnregisterAnchoredTip(w), w.style.animation = "sg-onboarding-fade-in 0.2s ease-out reverse";
      const t = w,
        n = S;
      w = null, S = null, setTimeout(() => {
        t.remove(), n && window.removeEventListener("resize", n)
      }, 200), e && chrome.storage.local.set({
        hasSeenTrashcanTip: !0
      })
    },
    k = () => {
      o.isActive = !1, m(!1), y(!1), x(!1), E(!1), modalStack = modalStack.filter(e => e !== a), a.style.opacity = "0", setTimeout(() => a.remove(), 200), document.removeEventListener("keydown", A, !0), t && setTimeout(() => {
        t.scrollTop = n
      }, 250), s && setTimeout(() => {
        const e = document.querySelector(".sidenav-with-history-container"),
          t = findSidebarToggleButton();
        e && !e.classList.contains("collapsed") && t && t.click()
      }, 450)
    },
    T = a.querySelector(".sg-close-modal-btn");
  T.addEventListener("click", k), T.addEventListener("mouseenter", () => {
    T.style.background = "var(--gem-sys-color--surface-container-highest, #dce1e9)"
  }), T.addEventListener("mouseleave", () => {
    T.style.background = "transparent"
  });
  let C = !1;
  a.addEventListener("mousedown", e => {
    C = e.target === a
  }), a.addEventListener("click", e => {
    e.target === a && C && k()
  });
  const A = e => {
    if ("Escape" === e.key) return a.isConnected ? void(modalStack[modalStack.length - 1] === a && (e.preventDefault(), e.stopImmediatePropagation(), k())) : (document.removeEventListener("keydown", A, !0), void(modalStack = modalStack.filter(e => e !== a)))
  };
  document.addEventListener("keydown", A, !0), modalStack.push(a), a.querySelector("#sg-add-folder-modal-btn").addEventListener("click", () => {
    showCreateFolderModal()
  });
  const L = a.querySelector("#sg-folder-search-input");
  trapFocusInModal(a, k), enableArrowNavigation(a.querySelector(".sg-folder-tree-container"), ".sg-folder-item-content", e => {
    e.click()
  }), L.addEventListener("input", () => {
    const e = L.value.toLowerCase().trim();
    a.querySelectorAll(".sg-folder-row").forEach(t => {
      const n = t.querySelector(".sg-folder-name-text")?.textContent?.toLowerCase() || "";
      t.style.display = n.includes(e) ? "flex" : "none"
    })
  }), wireDriveSyncButton(a);
  const _ = a.querySelector("#sg-add-folder-modal-btn");
  _.addEventListener("mouseenter", () => {
    _.style.background = "var(--gem-sys-color--surface-container-highest, #e1e3e1)"
  }), _.addEventListener("mouseleave", () => {
    _.style.background = "var(--gem-sys-color--surface-container-high, #e9eef6)"
  });
  const M = a.querySelector("#sg-delete-selected-btn"),
    I = a.querySelector("#sg-hide-foldered-toggle"),
    P = I.querySelector(".sg-checkbox-custom"),
    D = P.querySelector("svg"),
    B = e => {
      e ? (P.style.background = "#4285f4", P.style.borderColor = "#4285f4", D.style.display = "block") : (P.style.background = "transparent", P.style.borderColor = "var(--gem-sys-color--outline, #727676)", D.style.display = "none")
    };
  B(hideFolderedChats), I.addEventListener("click", async () => {
    hideFolderedChats = !hideFolderedChats, B(hideFolderedChats), await chrome.storage.sync.set({
      hideFolderedChats: hideFolderedChats
    }), applySidebarFiltering(), applySearchPanelFiltering()
  });
  const q = () => {
    const e = a.querySelectorAll(".sg-folder-checkbox:checked");
    e.length > 0 ? (M.style.opacity = "1", M.style.pointerEvents = "auto", M.style.background = "var(--gem-sys-color--error-container, #ffdad6)", M.style.color = "var(--gem-sys-color--on-error-container, #410002)",sgSetSafeHtml(M, `\n        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;">\n          <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>\n        </svg>\n        Delete Selected (${e.length})\n      `)) : (M.style.opacity = "0.5", M.style.pointerEvents = "none", M.style.background = "var(--gem-sys-color--surface-container-high, #e9eef6)", M.style.color = "var(--gem-sys-color--on-surface, #1f1f1f)",sgSetSafeHtml(M, '\n        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;">\n          <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>\n        </svg>\n        Delete Selected\n      '))
  };
  M.addEventListener("mouseenter", () => {
    a.querySelectorAll(".sg-folder-checkbox:checked").length > 0 && (M.style.background = "var(--gem-sys-color--error, #b3261e)", M.style.color = "var(--gem-sys-color--on-error, white)")
  }), M.addEventListener("mouseleave", () => {
    a.querySelectorAll(".sg-folder-checkbox:checked").length > 0 && (M.style.background = "var(--gem-sys-color--error-container, #ffdad6)", M.style.color = "var(--gem-sys-color--on-error-container, #410002)")
  }), a.querySelectorAll(".sg-folder-checkbox").forEach(e => {
    e.addEventListener("change", q)
  }), M.addEventListener("click", async () => {
    const e = a.querySelectorAll(".sg-folder-checkbox:checked"),
      t = Array.from(e).map(e => e.dataset.folderId);
    0 !== t.length && showConfirmationModal("Delete Folder(s)?", `Are you sure you want to delete ${t.length} folder(s)?`, async () => {
      for (const e of t) await deleteFolderRecursive(e);
      showToast(`${t.length} folder(s) deleted`, "success"), refreshFolderModal()
    })
  }), a.querySelectorAll(".sg-folder-options-btn").forEach(e => {
    e.addEventListener("click", t => {
      t.stopPropagation();
      const n = e.dataset.folderId;
      showFolderContextMenu(e, n)
    }), e.addEventListener("mouseenter", () => {
      e.style.background = "#dce1e9", e.style.color = "#3c4043"
    }), e.addEventListener("mouseleave", () => {
      e.style.background = "transparent", e.style.color = "#575a5a"
    })
  });
  const O = a.querySelector("#sg-tab-folders"),
    R = a.querySelector("#sg-tab-chats"),
    F = a.querySelector("#sg-tab-recycle-bin"),
    N = a.querySelector("#sg-add-folder-modal-btn")?.parentElement,
    $ = a.querySelector(".sg-folders-modal-content > div:nth-child(2)"),
    z = a.querySelector(".sg-folder-tree-container"),
    G = e => {
      const t = isDarkTheme(),
        n = getThemeColors(t),
        o = a.querySelector("#sg-tab-help-link");
      o && ("folders" === e ? o.href = `${guideUrl}#folders` : "chats" === e ? o.href = `${guideUrl}#chats` : "recycle-bin" === e && (o.href = `${guideUrl}#recycle-bin`)), [O, R, F].forEach(o => {
        if (!o) return;
        const r = o.id === `sg-tab-${e}`;
        o.style.background = r ? n.tabActiveBg : "transparent", o.style.color = r ? "var(--gem-sys-color--on-surface, #1f1f1f)" : "var(--gem-sys-color--on-surface-variant, #575a5a)", o.style.boxShadow = r ? t ? "0 1px 3px rgba(0,0,0,0.5)" : "0 1px 3px rgba(0,0,0,0.1)" : "none", r ? o.classList.add("active") : o.classList.remove("active")
      })
    },
    H = () => {
      o.isActive = !1, a.dataset.activeTab = "recycle-bin", G("recycle-bin"), N && (N.style.display = "none"), $ && ($.style.display = "flex");
      const e = a.querySelector("#sg-chats-actions");
      e && (e.style.display = "none");
      const t = a.querySelector("#sg-chats-footer");
      t && (t.style.display = "none");
      const n = a.querySelector("#sg-bin-actions");
      n && (n.style.display = "flex"), setTimeout(() => {
        chrome.storage.local.get("hasSeenTrashcanTip", e => {
          if (e.hasSeenTrashcanTip) return;
          if (!a.isConnected) return;
          if (document.getElementById("sg-trashcan-tip")) return;
          const t = a.querySelector("#sg-tab-recycle-bin");
          if (!t) return;
          const n = document.createElement("div");

          function o() {
            const e = t.getBoundingClientRect(),
              o = n.getBoundingClientRect();
            n.style.top = `${e.bottom+16}px`, n.style.left = e.left + e.width / 2 - o.width / 2 + "px"
          }
          n.id = "sg-trashcan-tip", n.className = "sg-onboarding-popup",sgSetSafeHtml(n, '\n        <div class="sg-onboarding-popup-content" style="max-width: 260px; padding: 16px;">\n          <div class="sg-onboarding-popup-arrow sg-onboarding-popup-arrow-up"></div>\n          <button id="sg-trashcan-tip-close" class="sg-onboarding-popup-close" aria-label="Close">\n            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">\n              <path d="M18 6L6 18M6 6l12 12"/>\n            </svg>\n          </button>\n          <h3 class="sg-onboarding-popup-title" style="font-size: 14px; margin-bottom: 6px;">💡 Trashcan</h3>\n          <p class="sg-onboarding-popup-message" style="margin-bottom: 12px;">Deleted chats are kept here so you can restore them. You can turn the Trashcan off anytime in the extension settings.</p>\n          <button class="sg-onboarding-popup-button" id="sg-trashcan-tip-ok" style="padding: 8px 16px; font-size: 13px;">Got it</button>\n        </div>\n      '), n.style.zIndex = "10001", w = n, document.body.appendChild(n), sgRegisterAnchoredTip(n, a, E), o(), requestAnimationFrame(o), window.addEventListener("resize", o), S = o, n.querySelector("#sg-trashcan-tip-close").addEventListener("click", () => E(!0)), n.querySelector("#sg-trashcan-tip-ok").addEventListener("click", () => E(!0))
        })
      }, 250);
      const s = a.querySelector("#sg-bin-delete-selected-btn"),
        i = () => {
          const e = z.querySelectorAll(".sg-bin-checkbox:checked"),
            t = z.querySelectorAll(".sg-bin-checkbox"),
            n = a.querySelector("#sg-bin-delete-selected-btn"),
            o = a.querySelector("#sg-bin-selected-count");
          o && (o.textContent = `(${e.length})`);
          const r = a.querySelector("#sg-bin-select-all-toggle");
          if (r) {
            const n = r.querySelector(".sg-checkbox-custom"),
              o = n?.querySelector("svg"),
              s = t.length > 0 && e.length === t.length;
            n && (n.style.background = s ? "#4285f4" : "transparent", n.style.borderColor = s ? "#4285f4" : "var(--gem-sys-color--outline, #727676)"), o && (o.style.display = s ? "block" : "none")
          }
          n && (e.length > 0 ? (n.style.opacity = "1", n.style.pointerEvents = "auto", n.style.background = "var(--gem-sys-color--error-container, #ffdad6)", n.style.color = "var(--gem-sys-color--on-error-container, #410002)",sgSetSafeHtml(n, `\n            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;">\n              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>\n            </svg>\n            Delete Selected (${e.length})\n          `)) : (n.style.opacity = "0.5", n.style.pointerEvents = "none", n.style.background = "var(--gem-sys-color--surface-container-high, #e9eef6)", n.style.color = "var(--gem-sys-color--on-surface, #1f1f1f)",sgSetSafeHtml(n, '\n            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;">\n              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>\n            </svg>\n            Delete Selected\n          ')));
          const s = a.querySelector("#sg-bin-restore-selected-btn");
          s && (e.length > 0 ? (s.style.opacity = "1", s.style.pointerEvents = "auto",sgSetSafeHtml(s, `\n            <svg viewBox="0 0 24 24" fill="currentColor" style="width: 14px; height: 14px;">\n              <path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/>\n            </svg>\n            Restore Selected (${e.length})\n          `)) : (s.style.opacity = "0.5", s.style.pointerEvents = "none",sgSetSafeHtml(s, '\n            <svg viewBox="0 0 24 24" fill="currentColor" style="width: 14px; height: 14px;">\n              <path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/>\n            </svg>\n            Restore Selected\n          ')))
        },
        l = () => {
          if (!z) return;sgSetSafeHtml(z, function() {
            if (!foldersData.recycleBin || 0 === foldersData.recycleBin.length) return '\n        <div class="sg-empty-state" style="text-align: center; padding: 60px 20px; color: #575a5a;">\n          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width: 48px; height: 48px; margin: 0 auto 16px; opacity: 0.5;">\n            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>\n          </svg>\n          <p style="font-size: 15px; margin: 0 0 8px;">Recycle Bin is empty</p>\n          <p style="font-size: 13px; opacity: 0.7;">Deleted items will appear here</p>\n        </div>\n      ';
            return `\n      <div class="sg-bin-items-container" style="display: flex; flex-direction: column; flex: 1; overflow-y: auto;">\n        ${foldersData.recycleBin.map(e=>{const id=escapeHtml(String(e.id||""));return`\n      <div class="sg-bin-item" data-chat-id="${id}" tabindex="0" style="\n        display: flex;\n        align-items: center;\n        padding: 12px 24px 12px 64px;\n        background: transparent;\n        border-radius: 8px !important;\n        cursor: default;\n        transition: background 0.1s;\n        user-select: none;\n        margin: 0 8px;\n        border-bottom: 1px solid var(--gem-sys-color--outline-variant, #dce1e9);\n        font-family: var(--sg-font-text);\n      ">\n        <input type="checkbox" class="sg-bin-checkbox" data-chat-id="${id}" style="\n          width: 30px;\n          height: 30px;\n          min-width: 30px;\n          min-height: 30px;\n          flex-shrink: 0;\n          margin: 0;\n          margin-right: 18px;\n          cursor: pointer;\n          accent-color: #4285f4;\n        ">\n\n        <div style="flex: 1; display: flex; align-items: center; gap: 12px; min-width: 0;">\n          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width: 20px; height: 20px; color: var(--gem-sys-color--on-surface-variant, #575a5a); flex-shrink: 0;">\n            <path d="M3 6h18"/>\n            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>\n            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>\n            <path d="M10 11v6"/>\n            <path d="M14 11v6"/>\n          </svg>\n          <span style="\n            font-size: 16px; \n            color: var(--gem-sys-color--on-surface, #1f1f1f); \n            font-weight: 500; \n            white-space: nowrap; \n            overflow: hidden; \n            text-overflow: ellipsis;\n          " title="${escapeHtml(e.title||"Untitled Chat")}">${escapeHtml(e.title||"Untitled Chat")}</span>\n        </div>\n        \n        <div style="display: flex; gap: 8px;">\n          <button class="sg-restore-btn" data-id="${id}" style="\n            width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;\n            border: none; background: transparent; border-radius: 50%; \n            color: var(--gem-sys-color--on-surface-variant, #575a5a);\n            cursor: pointer; transition: all 0.2s;\n          " title="Restore chat">\n            <svg viewBox="0 0 24 24" fill="currentColor" style="width: 20px; height: 20px;">\n              <path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/>\n            </svg>\n          </button>\n          <button class="sg-permanent-delete-btn" data-id="${id}" style="\n            width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;\n            border: none; background: transparent; border-radius: 50%; \n            color: var(--gem-sys-color--on-surface-variant, #575a5a);\n            cursor: pointer; transition: all 0.2s;\n          " title="Delete permanently (Shift+Click to skip confirmation)">\n            <svg viewBox="0 0 24 24" fill="currentColor" style="width: 20px; height: 20px;">\n              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>\n            </svg>\n          </button>\n        </div>\n      </div>\n    `}).join("")}\n      </div>\n    `
          }()), enableArrowNavigation(z, ".sg-chats-tab-item, .sg-bin-item", e => {
            e.classList.contains("sg-bin-item") ? e.querySelector('input[type="checkbox"]')?.click() : e.click()
          }), z.querySelectorAll(".sg-bin-item").forEach(e => {
            e.addEventListener("mouseenter", () => {
              e.style.background = "var(--gem-sys-color--surface-container-highest, #dce1e91a)"
            }), e.addEventListener("mouseleave", () => {
              e.style.background = "transparent"
            })
          }), z.querySelectorAll(".sg-restore-btn").forEach(e => {
            e.addEventListener("click", t => {
              t.stopPropagation(), restoreChatFromBin(e.dataset.id), showToast("Chat restored", "success"), l()
            }), e.addEventListener("mouseenter", () => {
              e.style.background = "var(--gem-sys-color--surface-container-highest, #dce1e9)", e.style.color = "#1a73e8"
            }), e.addEventListener("mouseleave", () => {
              e.style.background = "transparent", e.style.color = "var(--gem-sys-color--on-surface-variant, #575a5a)"
            })
          }), z.querySelectorAll(".sg-permanent-delete-btn").forEach(e => {
            e.addEventListener("click", t => {
              t.stopPropagation();
              const n = async () => {
                await permanentlyDeleteChatFromBin(e.dataset.id), r && (r = r.filter(t => t.id !== e.dataset.id)), l()
              };
              t.shiftKey ? n() : showConfirmationModal("Permanently Delete?", "Permanently delete this chat from the bin? This cannot be undone.<br><br>⚠️ Permanently deletes chats from Google's servers", n)
            }), e.addEventListener("mouseenter", () => {
              e.style.background = "#fdeded", e.style.color = "#d93025"
            }), e.addEventListener("mouseleave", () => {
              e.style.background = "transparent", e.style.color = "var(--gem-sys-color--on-surface-variant, #575a5a)"
            })
          }), z.querySelectorAll(".sg-bin-checkbox").forEach(e => {
            e.addEventListener("click", e => {
              e.stopPropagation()
            }), e.addEventListener("change", i)
          }), i();
          const e = $?.querySelector("#sg-folder-search-input");
          if (e && e.value.trim()) {
            const t = e.value.toLowerCase().trim();
            z.querySelectorAll(".sg-bin-item").forEach(e => {
              const n = e.querySelector("span")?.textContent?.toLowerCase() || "";
              e.style.display = n.includes(t) ? "flex" : "none"
            })
          }
        };
      if (z) {
        l(), setupShiftClickSelection(z, ".sg-bin-checkbox", i);
        const e = $?.querySelector("#sg-folder-search-input");
        if (e) {
          e.placeholder = "Search deleted chats...";
          const t = e.cloneNode(!0);
          e.parentNode.replaceChild(t, e), t.value = "", t.focus(), t.addEventListener("input", () => {
            const e = t.value.toLowerCase().trim();
            z.querySelectorAll(".sg-bin-item").forEach(t => {
              const n = t.querySelector("span")?.textContent?.toLowerCase() || "";
              t.style.display = n.includes(e) ? "flex" : "none"
            })
          })
        }
        const t = a.querySelector("#sg-bin-restore-selected-btn");
        if (t) {
          const e = t.cloneNode(!0);
          t.parentNode.replaceChild(e, t), e.addEventListener("mouseenter", () => {
            z.querySelectorAll(".sg-bin-checkbox:checked").length > 0 && (e.style.background = "var(--gem-sys-color--surface-container-highest, #dce1e9)")
          }), e.addEventListener("mouseleave", () => {
            e.style.background = "var(--gem-sys-color--surface-container-high, #e9eef6)"
          }), e.addEventListener("click", async () => {
            const e = z.querySelectorAll(".sg-bin-checkbox:checked"),
              t = Array.from(e).map(e => e.dataset.chatId);
            if (0 !== t.length) {
              for (const e of t) await restoreChatFromBin(e);
              l(), showToast(`${t.length} chat(s) restored`, "success")
            }
          })
        }
        const n = a.querySelector("#sg-bin-select-all-toggle");
        if (n) {
          const e = n.cloneNode(!0);
          n.parentNode.replaceChild(e, n), e.addEventListener("click", () => {
            const e = Array.from(z.querySelectorAll(".sg-bin-checkbox")).filter(e => {
              const t = e.closest(".sg-bin-item");
              return t && "none" !== t.style.display
            });
            if (0 === e.length) return;
            e.filter(e => e.checked).length === e.length ? e.forEach(e => e.checked = !1) : e.forEach(e => e.checked = !0), i()
          })
        }
        if (s) {
          const e = s.cloneNode(!0);
          s.parentNode.replaceChild(e, s), e.addEventListener("mouseenter", () => {
            z.querySelectorAll(".sg-bin-checkbox:checked").length > 0 && (e.style.background = "var(--gem-sys-color--error, #b3261e)", e.style.color = "var(--gem-sys-color--on-error, white)")
          }), e.addEventListener("mouseleave", () => {
            z.querySelectorAll(".sg-bin-checkbox:checked").length > 0 && (e.style.background = "var(--gem-sys-color--error-container, #ffdad6)", e.style.color = "var(--gem-sys-color--on-error-container, #410002)")
          }), e.addEventListener("click", () => {
            const e = z.querySelectorAll(".sg-bin-checkbox:checked"),
              t = Array.from(e).map(e => e.dataset.chatId);
            0 !== t.length && showConfirmationModal("Permanently Delete?", `Permanently delete ${t.length} chat(s)? This cannot be undone.<br><br>⚠️ Permanently deletes chats from Google's servers`, async () => {
              let e = 0;
              for (const n of t) try {
                await permanentlyDeleteChatFromBin(n, !0), e++
              } catch (e) {
                console.error("Failed to permanently delete:", n, e)
              }
              if (r) {
                const e = new Set(t);
                r = r.filter(t => !e.has(t.id))
              }
              l(), showToast(`Permanently deleted ${e} chat(s)`, "success")
            })
          })
        }
      }
    };
  const U = async () => {
    E(!1), o.loadingId++, o.isActive = !0;
    const e = o.loadingId;
    a.dataset.activeTab = "chats", G("chats"), N && (N.style.display = "none"), $ && ($.style.display = "flex");
    const t = a.querySelector("#sg-bin-actions");
    t && (t.style.display = "none");
    const n = a.querySelector("#sg-chats-actions");
    n && (n.style.display = "flex");
    const i = a.querySelector("#sg-chats-footer");
    i && (i.style.display = "flex");
    const l = $?.querySelector('input[type="text"]');
    l && (l.placeholder = "Search chats...", l.value = "", l.focus()), z && await async function(e, t, n, a) {
      enableArrowNavigation(e, ".sg-chats-tab-item, .sg-bin-item", e => {
        e.classList.contains("sg-bin-item") ? e.querySelector('input[type="checkbox"]')?.click() : e.click()
      });
      const i = () => o.isActive && o.loadingId === a;
      let l = !1,
        c = 0;
      const d = 5,
        u = new Set;
      let p = [];
      const g = new Set;
      let m = "",
        h = !1,
        f = !1;
      try {
        const e = await chrome.storage.local.get("sgChatsTabSortAZ");
        f = !!e.sgChatsTabSortAZ
      } catch (e) {}
      const y = () => {
          const e = new Set;
          return foldersData.folders.forEach(t => {
            (t.chats || []).forEach(t => e.add(t.id))
          }), e
        },
        b = () => {
          const e = new Set;
          return (foldersData.recycleBin || []).forEach(t => e.add(t.id)), e
        },
        v = () => {
          const e = b();
          let t = p.filter(t => !e.has(t.id));
          if (hideFolderedInChatsTab) {
            const e = y();
            t = t.filter(t => !e.has(t.id))
          }
          return m && (t = t.filter(e => (e.title || "").toLowerCase().includes(m))), f && (t = t.slice().sort((e, t) => (e.title || "").localeCompare(t.title || "", void 0, {
            sensitivity: "base",
            numeric: !0
          }))), t
        },
        x = () => {
          const e = t.querySelector("#sg-chats-selected-count"),
            n = t.querySelector("#sg-chats-bulk-actions-btn"),
            o = v();
          e && (e.textContent = `(${g.size})`);
          const r = t.querySelector("#sg-chats-select-all-input");
          if (r) {
            const e = o.length,
              t = o.filter(e => g.has(e.id)).length;
            0 === e || 0 === t ? (r.checked = !1, r.indeterminate = !1) : t === e ? (r.checked = !0, r.indeterminate = !1) : (r.checked = !1, r.indeterminate = !0)
          }
          n && (g.size > 0 ? (n.style.opacity = "1", n.style.background = "var(--gem-sys-color--surface-container-high, #e9eef6)",sgSetSafeHtml(n, `\n            Bulk Actions (${g.size})\n            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px; margin-left: 2px;">\n              <path d="M6 9l6 6 6-6"/>\n            </svg>\n          `)) : (n.style.opacity = "0.5", n.style.background = "var(--gem-sys-color--surface-container-high, #e9eef6)",sgSetSafeHtml(n, '\n            Bulk Actions\n            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px; margin-left: 2px;">\n              <path d="M6 9l6 6 6-6"/>\n            </svg>\n          ')))
        },
        w = () => {
          const t = v();
          if (0 === t.length) {
            if (!h) {
              const t = m ? "Searching chats..." : "Loading chats...",
                n = e.querySelector(".sg-chats-loading-spinner");
              if (n) {
                const e = n.querySelector("p");
                return void(e && e.textContent !== t && (e.textContent = t))
              }
              return void(sgSetSafeHtml(e, `\n            <div class="sg-chats-loading-spinner" style="text-align: center; padding: 40px 20px; color: #575a5a;">\n              <div style="display: inline-block; width: 24px; height: 24px; border: 3px solid var(--gem-sys-color--outline-variant, #dce1e9); border-top-color: var(--gem-sys-color--primary, #4285f4); border-radius: 50%; animation: sg-spin 1s linear infinite;"></div>\n              <p style="margin-top: 16px; font-size: 14px;">${t}</p>\n            </div>\n          `))
            }
            return void(sgSetSafeHtml(e, `\n          <div class="sg-empty-state" style="text-align: center; padding: 60px 20px; color: #575a5a;">\n            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width: 48px; height: 48px; margin: 0 auto 16px; opacity: 0.5;">\n              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>\n            </svg>\n            <p style="font-size: 15px; margin: 0 0 8px;">${hideFolderedInChatsTab?"No unfoldered chats":"No chats found"}</p>\n            <p style="font-size: 13px; opacity: 0.7;">${hideFolderedInChatsTab?"All your chats are organized in folders":"Your chats will appear here"}</p>\n          </div>\n        `))
          }
          const n = t.map(e => {
            const t = g.has(e.id),
              cid = escapeHtml(String(e.id || "")),
              curl = escapeHtml(String(e.url || ""));
            return `\n            <div class="sg-chats-tab-item" data-chat-id="${cid}" data-chat-url="${curl}" tabindex="0" style="\n              display: flex;\n              align-items: center;\n              padding: 13px 24px 13px 64px;\n              background: transparent;\n              border-radius: 8px !important;\n              cursor: pointer;\n              transition: background 0.1s;\n              user-select: none;\n              margin: 0 8px;\n              border-bottom: 1px solid var(--gem-sys-color--outline-variant, #dce1e9);\n              font-family: var(--sg-font-text);\n            ">\n              <input type="checkbox" class="sg-chats-tab-checkbox" data-chat-id="${cid}" ${t?"checked":""} style="\n                width: 30px;\n                height: 30px;\n                min-width: 30px;\n                min-height: 30px;\n                flex-shrink: 0;\n                margin: 0;\n                margin-right: 18px;\n                cursor: pointer;\n                accent-color: #4285f4;\n              ">\n              <div style="flex: 1; display: flex; align-items: center; gap: 12px; min-width: 0;">\n                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 20px; height: 20px; color: var(--gem-sys-color--on-surface-variant, #575a5a); flex-shrink: 0;">\n                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>\n                </svg>\n                <span style="\n                  font-size: 16px;\n                  color: var(--gem-sys-color--on-surface, #1f1f1f);\n                  font-weight: 500;\n                  white-space: nowrap;\n                  overflow: hidden;\n                  text-overflow: ellipsis;\n                ">${escapeHtml(e.title)}</span>\n              </div>\n            </div>\n          `
          }).join("");
          let o = e.querySelector(".sg-chats-tab-list");
          o || (sgSetSafeHtml(e, '<div class="sg-chats-tab-list" style="display: flex; flex-direction: column;"></div>'), o = e.querySelector(".sg-chats-tab-list")),sgSetSafeHtml(o, n);
          let r = e.querySelector(".sg-chats-loading-more");
          h ? r && r.remove() : r || (() => {
            const lm = document.createElement("div");
            lm.className = "sg-chats-loading-more";
            lm.style.cssText = "display: flex; align-items: center; gap: 10px; padding: 8px 32px; background: var(--gem-sys-color--surface-container, #e3e8f0); color: var(--gem-sys-color--primary, #4285f4); font-size: 13px; font-family: var(--sg-font-text); position: sticky; top: 0; z-index: 2; flex-shrink: 0;";
            const sp = document.createElement("div");
            sp.style.cssText = "width: 14px; height: 14px; border: 2px solid var(--gem-sys-color--outline-variant, #dce1e9); border-top-color: var(--gem-sys-color--primary, #4285f4); border-radius: 50%; animation: sg-spin 1s linear infinite; flex-shrink: 0;";
            const tx = document.createElement("span");
            tx.textContent = "Loading more chats...";
            lm.appendChild(sp), lm.appendChild(tx);
            e.insertBefore(lm, e.firstChild);
          })(), S(), x()
        },
        S = () => {
          e.querySelectorAll(".sg-chats-tab-item").forEach(e => {
            e.addEventListener("mouseenter", () => {
              e.style.background = "var(--gem-sys-color--surface-container-highest, #dce1e91a)"
            }), e.addEventListener("mouseleave", () => {
              e.style.background = "transparent"
            }), e.addEventListener("click", n => {
              if (n.target.classList.contains("sg-chats-tab-checkbox")) return;
              const o = e.dataset.chatUrl;
              o && (window.location.href = o, t.remove())
            });
            const n = e.querySelector(".sg-chats-tab-checkbox");
            n && (n.addEventListener("click", e => {
              e.shiftKey || e.stopPropagation()
            }), n.addEventListener("change", () => {
              const e = n.dataset.chatId;
              n.checked ? g.add(e) : g.delete(e), x()
            }))
          })
        },
        E = t.querySelector("#sg-chats-select-all-input");
      if (E) {
        const e = E.cloneNode(!0);
        E.parentNode.replaceChild(e, E), e.addEventListener("change", () => {
          const t = v();
          e.checked ? t.forEach(e => g.add(e.id)) : t.forEach(e => g.delete(e.id)), w()
        })
      }
      const k = t.querySelector("#sg-chats-hide-foldered-toggle");
      if (k) {
        const e = k.querySelector(".sg-checkbox-custom"),
          t = e?.querySelector("svg"),
          n = () => {
            e && (e.style.background = hideFolderedInChatsTab ? "#4285f4" : "transparent", e.style.borderColor = hideFolderedInChatsTab ? "#4285f4" : "var(--gem-sys-color--outline, #727676)"), t && (t.style.display = hideFolderedInChatsTab ? "block" : "none")
          };
        k.addEventListener("click", async () => {
          hideFolderedInChatsTab = !hideFolderedInChatsTab, n(), w(), await chrome.storage.sync.set({
            hideFolderedInChatsTab: hideFolderedInChatsTab
          })
        }), n()
      }
      const T = t.querySelector("#sg-chats-sort-az-input");
      if (T) {
        const e = T.cloneNode(!0);
        T.parentNode.replaceChild(e, T), e.checked = f, e.addEventListener("change", () => {
          f = e.checked, w();
          try {
            chrome.storage.local.set({
              sgChatsTabSortAZ: f
            })
          } catch (e) {}
        })
      }
      if (n) {
        const e = n.cloneNode(!0);
        n.parentNode.replaceChild(e, n), e.addEventListener("input", () => {
          m = e.value.toLowerCase().trim(), w()
        })
      }
      let C = t.querySelector("#sg-chats-bulk-actions-container");
      if (C) {
        const e = C.cloneNode(!0);
        C.parentNode.replaceChild(e, C), C = e;
        const t = C.querySelector("#sg-chats-bulk-actions-btn"),
          n = C.querySelector("#sg-chats-bulk-menu");
        if (t && n) {
          const e = e => {
            if (e.stopPropagation(), 0 === g.size) return;
            const t = "flex" === n.style.display;
            if (n.style.display = t ? "none" : "flex", !t) {
              const e = t => {
                n.contains(t.target) || (n.style.display = "none", document.removeEventListener("click", e))
              };
              setTimeout(() => document.addEventListener("click", e), 0)
            }
          };
          t.addEventListener("click", e), n.querySelectorAll(".sg-bulk-action-item").forEach(e => {
            e.addEventListener("click", t => {
              t.stopPropagation(), n.style.display = "none";
              const o = e.dataset.action;
              if (0 !== g.size)
                if ("delete" === o) void 0 === window.isTrashcanEnabled || window.isTrashcanEnabled ? showConfirmationModal("Move to Trash", `Move ${g.size} chat(s) to Trash?`, async () => {
                  let e = 0;
                  const t = new Set(g);
                  for (const n of t) {
                    const t = p.find(e => e.id === n);
                    t && (await recycleChat(n, t.title, !0), e++)
                  }
                  p = p.filter(e => !t.has(e.id)), g.clear(), w(), showToast(`${e} chat(s) moved to Trash`, "success")
                }, "Move to Trash") : showConfirmationModal("Delete Permanently?", `<p style="color: var(--sg-on-surface-variant); margin: 0;">\n                    Permanently delete ${g.size} chat(s)? This cannot be undone.\n                    <br><br>⚠️ Permanently deletes chats from Google's servers\n                  </p>`, async () => {
                  let e = 0;
                  const t = new Set(g);
                  for (const n of t) try {
                    await permanentlyDeleteChatFromBin(n, !0), e++
                  } catch (e) {
                    console.error("Failed to permanently delete:", n, e)
                  }
                  p = p.filter(e => !t.has(e.id)), r && (r = r.filter(e => !t.has(e.id))), g.clear(), w(), showToast(`Permanently deleted ${e} chat(s)`, "success")
                }, "Delete");
                else if ("export" === o) {
                showBulkExportModal(p.filter(e => g.has(e.id)))
              } else if ("move" === o) {
                showMoveToFolderModal(p.filter(e => g.has(e.id)), e => {
                  if (hideFolderedInChatsTab) {
                    const e = new Set(g);
                    p = p.filter(t => !e.has(t.id)), g.clear(), w()
                  }
                  showToast(`Moved ${e} chat(s) to folder`, "success")
                })
              }
            })
          })
        }
      }
      const A = async () => {
        if (l || c >= d || !i()) return;
        if (l = !0, c++, await scrollSidebarToLoadMore(() => !i()), !i()) return void(l = !1);
        if (await new Promise(e => setTimeout(e, 100)), !i()) return void(l = !1);
        const e = getAllSidebarChats();
        let t = 0;
        e.forEach(e => {
          u.has(e.id) || (u.add(e.id), p.push(e), t++)
        }), t > 0 && i() && (w(), c = 0), l = !1
      };
      let L = !1;
      const _ = () => {
        L || (L = !0, setupShiftClickSelection(e, ".sg-chats-tab-checkbox", () => {
          e.querySelectorAll(".sg-chats-tab-checkbox").forEach(e => {
            const t = e.dataset.chatId;
            e.checked ? g.add(t) : g.delete(t)
          }), x()
        }))
      };
      if (r && r.length > 0) return p = r.slice(), p.forEach(e => u.add(e.id)), h = !0, void(i() && (w(), _()));sgSetSafeHtml(e, '\n      <div class="sg-chats-loading-spinner" style="text-align: center; padding: 40px 20px; color: #575a5a;">\n        <div style="display: inline-block; width: 24px; height: 24px; border: 3px solid var(--gem-sys-color--outline-variant, #dce1e9); border-top-color: var(--gem-sys-color--primary, #4285f4); border-radius: 50%; animation: sg-spin 1s linear infinite;"></div>\n        <p style="margin-top: 16px; font-size: 14px;">Loading chats...</p>\n      </div>\n    ');
      let M = !1,
        I = !1;
      try {
        await fetchAllChatsViaMaZiqc(i, (e, {
          isLast: t
        }) => {
          if (i()) {
            for (const t of e) u.has(t.id) || (u.add(t.id), p.push(t));
            I = !0, t && (h = !0), w(), _()
          }
        }), h = !0, M = !0
      } catch (e) {
        if (I) console.warn("[SG Folders] MaZiqc stream stopped early, keeping partial list:", e), h = !0, M = !0, i() && w();
        else {
          if (console.warn("[SG Folders] MaZiqc chat list fetch failed, falling back to sidebar scrape:", e), await (async () => {
              const e = document.querySelector(".sidenav-with-history-container"),
                t = findSidebarToggleButton();
              e?.classList.contains("collapsed") && t && (s = !0, t.click(), await new Promise(e => {
                let t = 0;
                const n = setInterval(() => {
                  t++, (!document.querySelector(".sidenav-with-history-container")?.classList.contains("collapsed") || t > 20) && (clearInterval(n), setTimeout(e, 300))
                }, 100)
              }))
            })(), !i()) return;
          p = getAllSidebarChats(), p.forEach(e => u.add(e.id))
        }
      }
      i() && (w(), _());
      if (!M) {
        for (; c < d && i();) {
          p.length;
          if (await A(), !i()) break;
          await new Promise(e => setTimeout(e, 200))
        }
        h = !0
      }
      if (i())
        if (0 === v().length) w();
        else {
          const t = e.querySelector(".sg-chats-loading-more");
          t && t.remove()
        } h && p.length > 0 && i() && (r = p.slice())
    }(z, a, l, e)
  };
  O.addEventListener("click", () => {
    o.isActive = !1, E(!1), a.dataset.activeTab = "folders", G("folders"), N && (N.style.display = "flex"), $ && ($.style.display = "flex");
    const e = a.querySelector("#sg-bin-actions");
    e && (e.style.display = "none");
    const t = a.querySelector("#sg-chats-actions");
    t && (t.style.display = "none");
    const n = a.querySelector("#sg-chats-footer");
    n && (n.style.display = "none");
    const r = $?.querySelector('input[type="text"]');
    r && (r.placeholder = "Search folders...", r.value = "", r.focus()), z && (sgSetSafeHtml(z, `<div id="sg-folder-tree-list">${i(null,0)}</div>`), l()), M && (M.style.opacity = "0.5", M.style.pointerEvents = "none", M.style.background = "var(--gem-sys-color--surface-container-high, #e9eef6)", M.style.color = "var(--gem-sys-color--on-surface, #1f1f1f)",sgSetSafeHtml(M, '\n        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;">\n          <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>\n        </svg>\n        Delete Selected\n      '))
  }), R && R.addEventListener("click", U), F.addEventListener("click", H), "chats" === e && R ? U() : "recycle-bin" === e && H()
}
async function deleteFolderRecursive(e) {
  const t = new Set;
  ! function e(n) {
    t.add(n), foldersData.folders.filter(e => e.parentId === n).forEach(t => e(t.id))
  }(e);
  const n = foldersData.folders.length;
  if (foldersData.folders = foldersData.folders.filter(e => !t.has(e.id)), foldersData.folders.length !== n) {
    foldersData.deletedFolders || (foldersData.deletedFolders = []);
    const e = Date.now(),
      n = new Set(foldersData.deletedFolders.map(e => e.id));
    t.forEach(t => {
      n.has(t) || foldersData.deletedFolders.push({
        id: t,
        deletedAt: e
      })
    }), await saveFoldersData(), refreshFolderModal(), showToast("Folder deleted", "success")
  }
}

function escapeHtml(e) {
  return String(null == e ? "" : e)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function showCreateFolderModal(e = null) {
  const t = createModal(e ? "Create Subfolder" : "Create New Folder", '\n    <form id="sg-create-folder-form">\n      <div class="sg-form-group">\n        <label class="sg-form-label">Folder Name</label>\n        <input type="text" class="sg-form-input" id="sg-folder-name" placeholder="Enter folder name" required autofocus>\n      </div>\n      <div class="sg-form-group" style="margin-top: 16px;">\n        <label class="sg-form-label">Folder Color</label>\n        <div style="display: flex; align-items: center; gap: 10px;">\n          <input type="color" id="sg-folder-color" value="#5f6368" class="sg-color-input" style="\n            -webkit-appearance: none;\n            border: none;\n            width: 40px;\n            height: 40px;\n            cursor: pointer;\n            background: none;\n            padding: 0;\n            border-radius: 8px;\n            overflow: hidden;\n          ">\n          <span style="font-size: 13px; color: var(--gem-sys-color--on-surface-variant, #575a5a);">Pick a color</span>\n        </div>\n      </div>\n    </form>\n  ', [{
    text: "Cancel",
    class: "sg-btn sg-btn-gray",
    action: "close"
  }, {
    text: e ? "Create Subfolder" : "Create Folder",
    class: "sg-btn sg-btn-gray",
    action: "submit"
  }]);
  document.body.appendChild(t), t.style.zIndex = "1000001", requestAnimationFrame(() => t.classList.add("show"));
  const n = t.querySelectorAll(".sg-btn"),
    o = Array.from(n).find(e => "Cancel" === e.textContent.trim());
  o && o.addEventListener("click", () => {}), setTimeout(() => {
    document.getElementById("sg-folder-name")?.focus()
  }, 100);
  const r = document.getElementById("sg-create-folder-form");
  t.querySelector('[data-action="submit"]').addEventListener("click", () => {
    const n = document.getElementById("sg-folder-name").value.trim(),
      o = document.getElementById("sg-folder-color").value;
    if (n) {
      createFolder(n, o, e), closeModal(t);
      const s = document.querySelector(".sg-folders-modal");
      s && s.refreshTree && s.refreshTree()
    }
  }), r.addEventListener("submit", e => {
    e.preventDefault(), t.querySelector('[data-action="submit"]').click()
  })
}

function showRenameFolderModal(e) {
  const t = foldersData.folders.find(t => t.id === e);
  if (!t) return;
  const n = createModal("Edit Folder", `\n    <form id="sg-rename-folder-form">\n      <div class="sg-form-group">\n        <label class="sg-form-label">Folder Name</label>\n        <input type="text" class="sg-form-input" id="sg-new-folder-name" value="${escapeHtml(t.name)}" required autofocus>\n      </div>\n      <div class="sg-form-group" style="margin-top: 16px;">\n        <label class="sg-form-label">Folder Color</label>\n        <div style="display: flex; align-items: center; gap: 10px;">\n          <input type="color" id="sg-folder-color" value="${t.color||"#5f6368"}" class="sg-color-input" style="\n            -webkit-appearance: none;\n            border: none;\n            width: 40px;\n            height: 40px;\n            cursor: pointer;\n            background: none;\n            padding: 0;\n            border-radius: 8px;\n            overflow: hidden;\n          ">\n          <span style="font-size: 13px; color: var(--gem-sys-color--on-surface-variant, #575a5a);">Pick a color</span>\n        </div>\n      </div>\n    </form>\n  `, [{
    text: "Cancel",
    class: "sg-btn sg-btn-gray",
    action: "close"
  }, {
    text: "Save",
    class: "sg-btn sg-btn-gray",
    action: "submit"
  }]);
  document.body.appendChild(n), requestAnimationFrame(() => n.classList.add("show")), setTimeout(() => {
    const e = document.getElementById("sg-new-folder-name");
    e?.focus(), e?.select()
  }, 100), n.querySelector('[data-action="submit"]').addEventListener("click", () => {
    const t = document.getElementById("sg-new-folder-name").value.trim(),
      o = document.getElementById("sg-folder-color").value;
    t && (renameFolder(e, t, o), closeModal(n))
  }), document.getElementById("sg-rename-folder-form").addEventListener("submit", e => {
    e.preventDefault(), n.querySelector('[data-action="submit"]').click()
  })
}

function showDeleteFolderModal(e) {
  const t = foldersData.folders.find(t => t.id === e);
  t && showConfirmationModal("Delete Folder", `\n    <p style="color: var(--sg-on-surface-variant); margin: 0;">\n      Are you sure you want to delete "<strong>${escapeHtml(t.name)}</strong>"?\n      <br><br>\n      <span style="font-size: 13px;">This won't delete your chats, just the folder organization.</span>\n    </p>\n    `, () => {
    deleteFolderRecursive(e)
  })
}

function sgShowAnchoredTip(e) {
  const {
    id: t,
    storageKey: n,
    modal: o,
    target: r,
    title: s,
    body: a,
    buttonLabel: i,
    onButton: l,
    onDismissed: c
  } = e;
  if (!r || !o) return;
  if (document.getElementById(t)) return;
  const d = document.createElement("div");
  d.id = t, d.className = "sg-onboarding-popup", d.style.zIndex = "10001",sgSetSafeHtml(d, `\n    <div class="sg-onboarding-popup-content" style="max-width: 250px; padding: 16px;">\n      <div class="sg-onboarding-popup-arrow sg-onboarding-popup-arrow-up"></div>\n      <button class="sg-onboarding-popup-close sg-anchored-tip-close" aria-label="Close">\n        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>\n      </button>\n      <h3 class="sg-onboarding-popup-title" style="font-size: 14px; margin-bottom: 6px;">${s}</h3>\n      <p class="sg-onboarding-popup-message" style="margin-bottom: 12px;">${a}</p>\n      <button class="sg-onboarding-popup-button sg-anchored-tip-ok" style="padding: 8px 16px; font-size: 13px;">${escapeHtml(i)}</button>\n    </div>\n  `), document.body.appendChild(d);
  let u = !1,
    p = null;
  const g = () => {
      const e = r.getBoundingClientRect();
      d.style.top = `${e.bottom+12}px`, d.style.left = e.left + e.width / 2 - d.offsetWidth / 2 + "px"
    },
    m = e => {
      u || (u = !0, p && (p.disconnect(), p = null), sgUnregisterAnchoredTip(d), window.removeEventListener("resize", g), d.style.animation = "sg-onboarding-fade-in 0.2s ease-out reverse", setTimeout(() => d.remove(), 200), e && n && chrome.storage.local.set({
        [n]: !0
      }))
    };
  sgRegisterAnchoredTip(d, o, m), d._sgRemove = m, g(), window.addEventListener("resize", g, { passive: !0 }), d.querySelector(".sg-anchored-tip-close").addEventListener("click", () => {
    m(!0), c && c()
  }), d.querySelector(".sg-anchored-tip-ok").addEventListener("click", () => {
    if (m(!0), "function" == typeof l) try {
      l()
    } catch (e) {}
    c && c()
  }), r.addEventListener("click", () => m(!0), {
    once: !0
  }), p = new MutationObserver(() => {
    o.isConnected || m(!1)
  }), p.observe(document.body, {
    childList: !0
  })
}
async function showPromptsModal(e) {
  const t = sgCaptureComposerCaret();
  if (t ? sgPromptsModalCaret = t : sgPromptsModalCaret || (sgPromptsModalCaret = sgLastComposerCaret), !sgRequireDataReady()) return;
  const {
    overlay: n,
    close: o
  } = createModalOverlay({
    onClose: () => {
      document.removeEventListener("sg-refresh-prompts", O), delete window.sgCurrentPromptsModalSwitcher, optimizationShortcutHandler && (document.removeEventListener("keydown", optimizationShortcutHandler, !0), optimizationShortcutHandler = null), isModalOptimizing && (isModalOptimizing = !1, sgSafeSendMessage({
        type: "CANCEL_OPTIMIZATION"
      }))
    },
    onEsc: (e, t) => {
      isModalConfirmationMode || isModalOptimizing || (e.preventDefault(), e.stopImmediatePropagation(), "edit" === p ? (h(), b()) : t())
    }
  });
  n.classList.add("sg-folders-modal"), n.dataset.activeTab = "prompts", n.style.backdropFilter = "blur(4px)";
  const r = 0 === promptsData.prompts.length ? '\n    <div class="sg-empty-state" style="text-align: center; padding: 40px 20px; color: #575a5a;">\n      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width: 48px; height: 48px; margin: 0 auto 16px; opacity: 0.5;">\n        <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>\n      </svg>\n      <p style="font-size: 15px; margin: 0 0 8px;">No prompts yet</p>\n      <p style="font-size: 13px; opacity: 0.7;">Save your favorite prompts to reuse them anytime</p>\n    </div>\n  ' : promptsData.prompts.map(e => { const pid = escapeHtml(String(e.id || "")); return `\n    <div class="sg-prompt-item" data-prompt-id="${pid}" draggable="true" style="\n      display: flex;\n      align-items: center;\n      padding: 16px 24px 16px 64px;\n      background: transparent;\n      border-radius: 8px !important;\n      cursor: pointer;\n      transition: background 0.1s;\n      user-select: none;\n      margin: 0 8px;\n      border-bottom: 1px solid var(--gem-sys-color--outline-variant, #dce1e9);\n      font-family: var(--sg-font-text);\n    ">\n      <input type="checkbox" class="sg-prompt-checkbox" data-prompt-id="${pid}" style="\n        width: 30px;\n        height: 30px;\n        min-width: 30px;\n        min-height: 30px;\n        flex-shrink: 0;\n        margin: 0;\n        margin-right: 18px;\n        cursor: pointer;\n        accent-color: #4285f4;\n      ">\n\n      <div style="flex: 1; display: flex; align-items: center; gap: 12px; min-width: 0;">\n        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width: 20px; height: 20px; color: var(--gem-sys-color--on-surface-variant, #575a5a); flex-shrink: 0;">\n          <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>\n        </svg>\n        <div style="flex: 1; min-width: 0;">\n            <span style="font-size: 16px; font-weight: 500; color: var(--gem-sys-color--on-surface, #1f1f1f); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block;">${escapeHtml(e.title)}</span>\n            <span style="font-size: 12px; color: var(--gem-sys-color--on-surface-variant, #575a5a); opacity: 0.8;">${(()=>{const t=new Set;if(e.text){const n=e.text.match(/\{\{([^}]+)\}\}/g);n&&n.forEach(e=>t.add(e))}const n=t.size;return 0===n?"No variables":`${n} variable${1!==n?"s":""}`})()}</span>\n          </div>\n      </div>\n      <button type="button" class="sg-library-use-btn" title="Paste into the chat box" aria-label="Use prompt">${SG_LIBRARY_USE_ICON_SVG}<span>Use</span></button>\n    </div>\n  `; }).join("");sgSetSafeHtml(n, `\n    <div class="sg-folders-modal-content" style="\n      width: 90%;\n      max-width: 900px;\n      height: 67.5vh;\n      background: var(--gem-sys-color--surface, #f0f4f8);\n      border-radius: 16px;\n      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);\n      display: flex;\n      flex-direction: column;\n      overflow: hidden;\n      font-family: var(--sg-font-text);\n    ">\n      \x3c!-- Header --\x3e\n      <div style="\n        display: flex;\n        align-items: center;\n        justify-content: space-between;\n        padding: 11.5px 32px;\n        border-bottom: 1px solid var(--gem-sys-color--outline-variant, #dce1e9);\n        background: var(--gem-sys-color--surface, #f0f4f8);\n        flex-shrink: 0;\n      ">\n        <div style="display: flex; align-items: center; gap: 16px; flex: 1;">\n          \x3c!-- Help Icon --\x3e\n          <a id="sg-prompts-tab-help-link" href="${guideUrl}#prompts-list" target="_blank" class="sg-help-link" style="margin-right: -8px;">\n            <span class="sg-help-btn" data-tooltip-fast="Open guide for this feature">?</span>\n          </a>\n          \x3c!-- Tabbed Navigation Pill --\x3e\n          <div class="sg-tabs-pill" style="\n            display: flex;\n            background: var(--gem-sys-color--surface-container-high, #e9eef6);\n            border-radius: 24px;\n            padding: 4px;\n            gap: 4px;\n          ">\n            <button id="sg-tab-prompts" class="sg-tab-btn active" style="\n              border: none;\n              border-radius: 20px;\n              padding: 8px 20px;\n              font-size: 14px;\n              font-weight: 500;\n              cursor: pointer;\n              transition: all 0.2s ease;\n              background: ${getThemeColors().tabActiveBg};\n              color: var(--gem-sys-color--on-surface, #1f1f1f);\n              box-shadow: ${isDarkTheme()?"0 1px 3px rgba(0,0,0,0.5)":"0 1px 3px rgba(0,0,0,0.1)"};\n            ">Prompts</button>\n            <button id="sg-tab-chains" class="sg-tab-btn" style="\n              border: none;\n              border-radius: 20px;\n              padding: 8px 20px;\n              font-size: 14px;\n              font-weight: 500;\n              cursor: pointer;\n              transition: all 0.2s ease;\n              background: transparent;\n              color: var(--gem-sys-color--on-surface-variant, #575a5a);\n            ">Chains</button>\n          </div>\n\n          <div id="sg-prompt-actions" style="display: flex; align-items: center; gap: 8px;">\n            <button id="sg-add-prompt-btn" style="\n              display: flex;\n              align-items: center;\n              justify-content: center;\n              gap: 8px;\n              padding: 0 18px;\n              height: 38px;\n              min-width: 140px;\n              background: var(--gem-sys-color--surface-container-high, #e9eef6);\n              border: none;\n              border-radius: 20px;\n              color: var(--gem-sys-color--on-surface, #1f1f1f);\n              font-size: 13px;\n              font-weight: 500;\n              cursor: pointer;\n              transition: all 0.15s ease;\n            ">\n              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;">\n                <path d="M12 5v14M5 12h14"/>\n              </svg>\n              Add Prompt\n            </button>\n\n            <button id="sg-delete-prompts-btn" style="\n              display: flex;\n              align-items: center;\n              gap: 6px;\n              padding: 0 18px;\n              height: 38px;\n              background: var(--gem-sys-color--surface-container-high, #e9eef6);\n              border: none;\n              border-radius: 20px;\n              color: var(--gem-sys-color--on-surface, #1f1f1f);\n              font-size: 13px;\n              font-weight: 500;\n              cursor: pointer;\n              transition: all 0.15s ease;\n              opacity: 0.5;\n              pointer-events: none;\n            ">\n              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;">\n                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>\n              </svg>\n              Delete Selected\n            </button>\n          </div>\n\n          \x3c!-- Chain Actions Bar --\x3e\n          <div id="sg-chain-actions" style="display: none; align-items: center; gap: 8px;">\n            <button id="sg-add-chain-btn" style="\n              display: flex;\n              align-items: center;\n              justify-content: center;\n              gap: 8px;\n              padding: 0 18px;\n              height: 38px;\n              min-width: 140px;\n              background: var(--gem-sys-color--surface-container-high, #e9eef6);\n              border: none;\n              border-radius: 20px;\n              color: var(--gem-sys-color--on-surface, #1f1f1f);\n              font-size: 13px;\n              font-weight: 500;\n              cursor: pointer;\n              transition: all 0.15s ease;\n            ">\n              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;">\n                <path d="M12 5v14M5 12h14"/>\n              </svg>\n              Add Chain\n            </button>\n\n            <button id="sg-delete-chains-btn" style="\n              display: flex;\n              align-items: center;\n              gap: 6px;\n              padding: 0 18px;\n              height: 38px;\n              background: var(--gem-sys-color--surface-container-high, #e9eef6);\n              border: none;\n              border-radius: 20px;\n              color: var(--gem-sys-color--on-surface, #1f1f1f);\n              font-size: 13px;\n              font-weight: 500;\n              cursor: pointer;\n              transition: all 0.15s ease;\n              opacity: 0.5;\n              pointer-events: none;\n            ">\n              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;">\n                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>\n              </svg>\n              Delete Selected\n            </button>\n          </div>\n        </div>\n        \n        <button class="sg-close-modal-btn" style="\n          width: 36px;\n          height: 36px;\n          background: transparent;\n          border: none;\n          border-radius: 50%;\n          color: var(--gem-sys-color--on-surface-variant, #575a5a);\n          cursor: pointer;\n          display: flex;\n          align-items: center;\n          justify-content: center;\n          transition: all 0.15s ease;\n          flex-shrink: 0;\n          margin-left: 16px;\n        ">\n          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 20px; height: 20px;">\n            <path d="M18 6L6 18M6 6l12 12"/>\n          </svg>\n        </button>\n      </div>\n\n      \x3c!-- Toolbar (Search) --\x3e\n      <div style="\n        display: flex;\n        align-items: center;\n        gap: 12px;\n        padding: 12px 32px;\n        border-bottom: 1px solid var(--gem-sys-color--outline-variant, #dce1e9);\n        flex-shrink: 0;\n      ">\n        <div style="\n          flex: 1;\n          display: flex;\n          align-items: center;\n          gap: 8px;\n          padding: 14px 14px;\n          background: var(--gem-sys-color--surface-container-high, #e9eef6);\n          border-radius: 20px;\n          border: 1px solid var(--gem-sys-color--outline, #dce1e9);\n        ">\n          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px; color: var(--gem-sys-color--on-surface-variant, #575a5a);">\n            <circle cx="11" cy="11" r="8"/>\n            <path d="M21 21l-4.35-4.35"/>\n          </svg>\n          <input type="text" id="sg-prompt-search" placeholder="Search prompts..." style="\n            flex: 1;\n            background: transparent;\n            border: none;\n            outline: none;\n            color: var(--gem-sys-color--on-surface, #1f1f1f);\n            font-size: 13px;\n          ">\n        </div>\n        <button id="sg-folder-sync-btn" class="sg-folder-sync-btn" title="Sync with Google Drive" style="display: none;">\n          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px;">\n            <path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>\n            <path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>\n            <polyline points="21 3 21 8 16 8"/>\n            <polyline points="3 21 3 16 8 16"/>\n          </svg>\n        </button>\n      </div>\n\n      \x3c!-- Content Area --\x3e\n      <div id="sg-prompts-list-container" style="flex: 1; overflow-y: auto; padding: 0;">\n        <div style="display: flex; flex-direction: column;">\n          ${r}\n        </div>\n      </div>\n    </div>\n  `), document.body.appendChild(n), requestAnimationFrame(() => {
    n.classList.add("show"), n.querySelector("#sg-prompt-search")?.focus()
  });
  const s = o,
    a = n.querySelector(".sg-close-modal-btn");
  let i, l, c, d, u;
  a.addEventListener("click", s), a.addEventListener("mouseenter", () => {
    a.style.background = "rgba(0,0,0,0.05)"
  }), a.addEventListener("mouseleave", () => {
    a.style.background = "transparent"
  }), isModalOptimizing = !1, isModalConfirmationMode = !1, optimizationShortcutHandler = null;
  let p = "list",
    g = null;

  function m() {
    n.querySelectorAll(".sg-prompt-item").forEach(e => {
      e.classList.remove("sg-drag-over", "sg-drag-over-top", "sg-drag-over-bottom"), g && e.dataset.promptId === g.id && ("top" === g.position ? e.classList.add("sg-drag-over-top") : "bottom" === g.position && e.classList.add("sg-drag-over-bottom"))
    })
  }

  function h() {
    const e = n.querySelector(".sg-folders-modal-content > div:first-child");
    e.style.padding = "11.5px 32px";sgSetSafeHtml(e.querySelector("div:first-child"), `\n      \x3c!-- Help Icon --\x3e\n      <a id="sg-prompts-tab-help-link" href="${guideUrl}#prompts-list" target="_blank" class="sg-help-link" style="margin-right: -8px;">\n        <span class="sg-help-btn" data-tooltip-fast="Open guide for this feature">?</span>\n      </a>\n      <div class="sg-tabs-pill" style="display: flex; background: var(--gem-sys-color--surface-container-high, #e9eef6); border-radius: 24px; padding: 4px; gap: 4px;">\n        <button id="sg-tab-prompts" class="sg-tab-btn active" style="border: none; border-radius: 20px; padding: 8px 20px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.2s ease; background: ${getThemeColors().tabActiveBg}; color: var(--gem-sys-color--on-surface, #1f1f1f); box-shadow: ${isDarkTheme()?"0 1px 3px rgba(0,0,0,0.5)":"0 1px 3px rgba(0,0,0,0.1)"};">Prompts</button>\n        <button id="sg-tab-chains" class="sg-tab-btn" style="border: none; border-radius: 20px; padding: 8px 20px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.2s ease; background: transparent; color: var(--gem-sys-color--on-surface-variant, #575a5a);">Chains</button>\n      </div>\n\n      <div id="sg-prompt-actions" style="display: flex; align-items: center; gap: 8px;">\n        <button id="sg-add-prompt-btn" style="display: flex; align-items: center; justify-content: center; gap: 8px; padding: 0 18px; height: 38px; min-width: 140px; background: var(--gem-sys-color--surface-container-high, #e9eef6); border: none; border-radius: 20px; color: var(--gem-sys-color--on-surface, #1f1f1f); font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.15s ease;">\n          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;"><path d="M12 5v14M5 12h14"/></svg> Add Prompt\n        </button>\n        <button id="sg-delete-prompts-btn" style="display: flex; align-items: center; gap: 6px; padding: 0 18px; height: 38px; background: var(--gem-sys-color--surface-container-high, #e9eef6); border: none; border-radius: 20px; color: var(--gem-sys-color--on-surface, #1f1f1f); font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.15s ease; opacity: 0.5; pointer-events: none;">\n          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> Delete Selected\n        </button>\n      </div>\n      <div id="sg-chain-actions" style="display: none; align-items: center; gap: 8px;">\n        <button id="sg-add-chain-btn" style="display: flex; align-items: center; justify-content: center; gap: 8px; padding: 0 18px; height: 38px; min-width: 140px; background: var(--gem-sys-color--surface-container-high, #e9eef6); border: none; border-radius: 20px; color: var(--gem-sys-color--on-surface, #1f1f1f); font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.15s ease;">\n          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;"><path d="M12 5v14M5 12h14"/></svg> Add Chain\n        </button>\n        <button id="sg-delete-chains-btn" style="display: flex; align-items: center; gap: 6px; padding: 0 18px; height: 38px; background: var(--gem-sys-color--surface-container-high, #e9eef6); border: none; border-radius: 20px; color: var(--gem-sys-color--on-surface, #1f1f1f); font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.15s ease; opacity: 0.5; pointer-events: none;">\n          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> Delete Selected\n        </button>\n      </div>\n    `), i = n.querySelector("#sg-tab-prompts"), l = n.querySelector("#sg-tab-chains");
    c = n.querySelector("#sg-prompt-actions"), d = n.querySelector("#sg-chain-actions"), u = n.querySelector(".sg-folders-modal-content > div:nth-child(2)"), i.addEventListener("click", b), l.addEventListener("click", v);
    const o = n.querySelector("#sg-add-prompt-btn");
    o.addEventListener("mouseenter", () => o.style.background = "var(--gem-sys-color--surface-container-highest, #e1e3e1)"), o.addEventListener("mouseleave", () => o.style.background = "var(--gem-sys-color--surface-container-high, #e9eef6)"), o.addEventListener("click", () => {
      y()
    });
    const r = n.querySelector("#sg-delete-prompts-btn");
    r && (r.addEventListener("mouseenter", () => {
      "1" === r.style.opacity && (r.style.background = "var(--gem-sys-color--error, #b3261e)", r.style.color = "var(--gem-sys-color--on-error, white)")
    }), r.addEventListener("mouseleave", () => {
      "1" === r.style.opacity ? (r.style.background = "var(--gem-sys-color--error-container, #f9dedc)", r.style.color = "var(--gem-sys-color--on-error-container, #410e0b)") : (r.style.background = "var(--gem-sys-color--surface-container-high, #e9eef6)", r.style.color = "var(--gem-sys-color--on-surface, #1f1f1f)")
    }), r.addEventListener("click", async () => {
      const e = Array.from(n.querySelectorAll(".sg-prompt-checkbox:checked")).map(e => e.dataset.promptId);
      e.length > 0 && showConfirmationModal("Delete Prompts", `Delete ${e.length} selected prompt(s)?`, async () => {
        tombstonePrompts(e), promptsData.prompts = promptsData.prompts.filter(t => !e.includes(t.id)), await savePromptsData(), b(), showToast(`${e.length} prompt(s) deleted`, "success")
      })
    }));
    const s = n.querySelector("#sg-add-chain-btn"),
      a = n.querySelector("#sg-delete-chains-btn");
    s && (s.addEventListener("mouseenter", () => s.style.background = "var(--gem-sys-color--surface-container-highest, #e1e3e1)"), s.addEventListener("mouseleave", () => s.style.background = "var(--gem-sys-color--surface-container-high, #e9eef6)"), s.addEventListener("click", () => E())), a && (a.addEventListener("mouseenter", () => {
      "1" === a.style.opacity && (a.style.background = "var(--gem-sys-color--error, #b3261e)", a.style.color = "var(--gem-sys-color--on-error, white)")
    }), a.addEventListener("mouseleave", () => {
      "1" === a.style.opacity ? (a.style.background = "var(--gem-sys-color--error-container, #f9dedc)", a.style.color = "var(--gem-sys-color--on-error-container, #410e0b)") : (a.style.background = "var(--gem-sys-color--surface-container-high, #e9eef6)", a.style.color = "var(--gem-sys-color--on-surface, #1f1f1f)")
    }), a.addEventListener("click", async () => {
      const e = Array.from(n.querySelectorAll(".sg-chain-checkbox:checked")).map(e => e.dataset.chainId);
      e.length > 0 && showConfirmationModal("Delete Chains", `Delete ${e.length} selected chain(s)?`, async () => {
        tombstoneChains(e), chainsData.chains = chainsData.chains.filter(t => !e.includes(t.id)), await saveChainsData(), v(), showToast(`${e.length} chain(s) deleted`, "success")
      })
    }))
  }
  h(), wireDriveSyncButton(n);
  const f = n.querySelector("#sg-prompts-list-container");

  function y(e = null) {
    p = "edit";
    const t = null !== e,
      o = t ? promptsData.prompts.find(t => t.id === e) : {
        title: "",
        text: ""
      };
    if (t && !o) return;sgSetSafeHtml(n.querySelector(".sg-folders-modal-content > div:first-child > div:first-child"), `\n      \x3c!-- Help Icon --\x3e\n      <a id="sg-prompts-tab-help-link" href="${guideUrl}#prompts-list" target="_blank" class="sg-help-link" style="margin-right: 4px;">\n        <span class="sg-help-btn" data-tooltip-fast="Open guide for this feature">?</span>\n      </a>\n      <div style="display: flex; align-items: center; gap: 12px; flex: 1;">\n        <h2 style="font-family: var(--sg-font-flex); font-size: 20px; font-weight: 500; color: var(--gem-sys-color--on-surface, #1f1f1f); margin: 0;">${t?"Edit Prompt":"New Prompt"}</h2>\n      </div>\n    `);
    n.querySelector(".sg-folders-modal-content > div:first-child").style.padding = "13px 32px";
    const r = () => {
      isModalOptimizing && (isModalOptimizing = !1, sgSafeSendMessage({
        type: "CANCEL_OPTIMIZATION"
      })), h(), b()
    };
    u && (u.style.display = "none"),sgSetSafeHtml(f, `\n      <div style="padding: 24px 32px; height: auto; display: flex; flex-direction: column; overflow: hidden;">\n        <form id="sg-edit-prompt-form" style="font-family: var(--sg-font-text); display: flex; flex-direction: column; height: auto; min-height: 0; gap: 0px;">\n          <div class="sg-form-group" style="flex-shrink: 0; display: flex; flex-direction: column; gap: 12px;">\n            <label class="sg-form-label" style="font-size: 11px; color: var(--gem-sys-color--on-surface-variant, #575a5a); letter-spacing: 0.8px; margin: 0;">PROMPT TITLE</label>\n            <input type="text" class="sg-form-input" id="sg-edit-prompt-title" value="${escapeHtml(o.title)}" required autofocus style="background: var(--gem-sys-color--surface-container-high, #e9eef6); border: 1px solid var(--gem-sys-color--outline-variant, #dce1e9); padding: 14px 16px; border-radius: 12px; font-size: 15px;">\n          </div>\n\n          <div class="sg-form-group" style="flex: none; display: flex; flex-direction: column; min-height: 0; gap: 12px;">\n            <div style="display: flex; align-items: center; justify-content: flex-start; gap: 16px; margin: 0;">\n              <label class="sg-form-label" style="font-size: 11px; color: var(--gem-sys-color--on-surface-variant, #575a5a); letter-spacing: 0.8px; margin: 0;">PROMPT TEXT</label>\n              \n              <div id="sg-modal-controls-container" style="display: flex; align-items: center; gap: 8px;">\n                <button type="button" id="sg-modal-optimize-btn" class="sg-optimize-btn" style="\n                  display: inline-flex;\n                  align-items: center;\n                  justify-content: center;\n                  gap: 4px;\n                  height: 32px;\n                  padding: 0 12px 0 8px;\n                  border-radius: 16px;\n                  font-size: 14px;\n                  font-weight: 500;\n                  font-family: var(--sg-font-flex);\n                  cursor: pointer;\n                  user-select: none;\n                  transition: all 0.2s ease;\n                  box-shadow: 0 1px 3px rgba(0,0,0,0.12);\n                  background: ${getThemeColors().btnBg};\n                  border: 1px solid ${getThemeColors().border};\n                  color: ${getThemeColors().iconText};\n                ">\n                  <svg class="sg-optimize-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">\n                    <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>\n                  </svg>\n                  <span class="sg-optimize-label">Optimize</span>\n                </button>\n\n                <div id="sg-modal-word-counter" style="\n                  display: inline-flex;\n                  align-items: center;\n                  height: 32px;\n                  padding: 0 16px;\n                  border-radius: 16px;\n                  font-size: 12px;\n                  font-weight: 500;\n                  font-family: var(--sg-font-flex);\n                  cursor: pointer;\n                  user-select: none;\n                  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);\n                  box-shadow: 0 1px 3px rgba(0,0,0,0.12);\n                  background: ${getThemeColors().btnBg};\n                  border: 1px solid ${getThemeColors().border};\n                  color: ${getThemeColors().iconText};\n                  overflow: hidden;\n                  white-space: nowrap;\n                  max-width: fit-content;\n                ">\n                  <div class="sg-modal-counter-summary" style="flex-shrink: 0; transition: color 0.2s ease;">0 words / 0 characters</div>\n                  <div class="sg-modal-counter-details" style="\n                    display: flex; \n                    align-items: center; \n                    gap: 12px; \n                    margin-left: 0; \n                    padding-left: 0; \n                    border-left: 1px solid transparent;\n                    max-width: 0;\n                    opacity: 0;\n                    visibility: hidden;\n                    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);\n                    overflow: hidden;\n                  ">\n                    <span style="margin-left: 12px; padding-left: 12px; border-left: 1px solid ${isDarkTheme()?"rgba(255,255,255,0.1)":"rgba(0,0,0,0.1)"};">Characters (No Spaces): <strong id="sg-modal-stat-nospace">0</strong></span>\n                    <span>Sentences: <strong id="sg-modal-stat-sentences">0</strong></span>\n                    <span>Paragraphs: <strong id="sg-modal-stat-paragraphs">0</strong></span>\n                    <span>Lines: <strong id="sg-modal-stat-lines">0</strong></span>\n                  </div>\n                </div>\n              </div>\n            </div>\n            <textarea id="sg-edit-prompt-text" class="sg-form-input" required placeholder="Use {{variableName}} to insert dynamic values (e.g. {{role}}, {{topic}}) or [[Prompt Title]] to reference other prompts..." style="flex: none; resize: none; font-family: inherit; padding: 14px 16px; margin: 0; min-height: 0; height: 500px; background: var(--gem-sys-color--surface-container-high, #e9eef6); border: 1px solid var(--gem-sys-color--outline-variant, #dce1e9); border-radius: 12px; font-size: 15px; color: var(--gem-sys-color--on-surface, #1f1f1f);">${escapeHtml(o.text)}</textarea>\n          </div>\n          \n          <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-shrink: 0;">\n            \x3c!-- Mode and Tool Selection (left side) --\x3e\n            <div style="display: flex; align-items: center; gap: 12px;">\n              <label class="sg-form-label" style="font-size: 11px; color: var(--gem-sys-color--on-surface-variant, #575a5a); letter-spacing: 0.8px; margin: 0;">ACTIONS</label>\n              <button type="button" class="sg-prompt-mode-btn" title="Switch model when using this prompt" tabindex="-1" style="\n                width: 32px;\n                height: 32px;\n                position: relative;\n                z-index: 1;\n                pointer-events: auto;\n                background: transparent;\n                border: 1px solid ${o.mode?"var(--gem-sys-color--primary, #1a73e8)":"var(--gem-sys-color--outline-variant, #dce1e9)"};\n                border-radius: 50%;\n                color: ${o.mode?"var(--gem-sys-color--primary, #1a73e8)":"var(--gem-sys-color--on-surface-variant, #575a5a)"};\n                cursor: pointer;\n                display: flex;\n                align-items: center;\n                justify-content: center;\n                transition: all 0.15s ease;\n                font-size: 12px;\n              " data-tooltip-fast="${o.mode||"No mode change"}">\n                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;">\n                  <circle cx="12" cy="12" r="3"/>\n                  <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>\n                </svg>\n              </button>\n\n              <button type="button" class="sg-prompt-tool-btn" title="Select tool when using this prompt" tabindex="-1" style="\n                width: 32px;\n                height: 32px;\n                position: relative;\n                z-index: 1;\n                pointer-events: auto;\n                background: transparent;\n                border: 1px solid ${o.tool?"var(--gem-sys-color--primary, #1a73e8)":"var(--gem-sys-color--outline-variant, #dce1e9)"};\n                border-radius: 50%;\n                color: ${o.tool?"var(--gem-sys-color--primary, #1a73e8)":"var(--gem-sys-color--on-surface-variant, #575a5a)"};\n                cursor: pointer;\n                display: flex;\n                align-items: center;\n                justify-content: center;\n                transition: all 0.15s ease;\n                font-size: 12px;\n              " data-tooltip-fast="${o.tool||"No tool change"}">\n                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;">\n                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>\n                </svg>\n              </button>\n\n              <button type="button" class="sg-prompt-autosend-btn" title="Auto-send message after using this prompt" tabindex="-1" style="\n                width: 32px;\n                height: 32px;\n                position: relative;\n                z-index: 1;\n                pointer-events: auto;\n                background: ${o.autosend?"var(--gem-sys-color--primary, #1a73e8)":"transparent"};\n                border: 1px solid ${o.autosend?"var(--gem-sys-color--primary, #1a73e8)":"var(--gem-sys-color--outline-variant, #dce1e9)"};\n                border-radius: 50%;\n                color: ${o.autosend?"#ffffff":"var(--gem-sys-color--on-surface-variant, #575a5a)"};\n                cursor: pointer;\n                display: flex;\n                align-items: center;\n                justify-content: center;\n                transition: all 0.15s ease;\n                font-size: 12px;\n              " data-tooltip-fast="${o.autosend?"Auto-send enabled":"Auto-send disabled"}">\n                <svg viewBox="0 0 24 24" fill="currentColor" style="width: 14px; height: 14px;">\n                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>\n                </svg>\n              </button>\n            </div>\n\n            \x3c!-- Save/Cancel buttons (right side) --\x3e\n            <div style="display: flex; gap: 12px;">\n              <button type="button" id="sg-edit-cancel-btn" class="sg-btn sg-btn-gray">Cancel</button>\n              <button type="button" id="sg-edit-save-btn" class="sg-btn sg-btn-gray">${t?"Save Changes":"Create Prompt"}</button>\n            </div>\n          </div>\n        </form>\n      </div>\n    `);
    const s = f.querySelector("#sg-edit-prompt-text"),
      a = f.querySelector("#sg-modal-optimize-btn"),
      i = f.querySelector("#sg-modal-word-counter"),
      l = getThemeColors(isDarkTheme()),
      c = l.btnBg,
      d = l.hoverBgAlt,
      g = e => {
        e.addEventListener("mouseenter", () => {
          isModalConfirmationMode || isModalOptimizing || (e.style.background = d)
        }), e.addEventListener("mouseleave", () => {
          isModalConfirmationMode || isModalOptimizing || (e.style.background = c)
        })
      };
    g(a), g(i);
    const m = () => {
      const e = countText(s.value);
      f.querySelector(".sg-modal-counter-summary").textContent = `${e.words} words / ${e.chars} characters`;
      const t = f.querySelector("#sg-modal-stat-nospace"),
        n = f.querySelector("#sg-modal-stat-sentences"),
        o = f.querySelector("#sg-modal-stat-paragraphs"),
        r = f.querySelector("#sg-modal-stat-lines");
      t && (t.textContent = e.charsNoSpace), n && (n.textContent = e.sentences), o && (o.textContent = e.paragraphs), r && (r.textContent = e.lines)
    };
    i.addEventListener("click", e => {
      e.stopPropagation();
      const t = i.querySelector(".sg-modal-counter-details");
      "1" === t.style.opacity ? (t.style.maxWidth = "0", t.style.opacity = "0", t.style.visibility = "hidden", i.style.background = c) : (t.style.maxWidth = "1000px", t.style.opacity = "1", t.style.visibility = "visible", i.style.background = d)
    }), s.addEventListener("input", m), m();
    let y = "";
    const v = () => {
      optimizationShortcutHandler && (document.removeEventListener("keydown", optimizationShortcutHandler, !0), optimizationShortcutHandler = null), isModalConfirmationMode = !1, isModalOptimizing = !1, morphOutOptimizeBtn(a, () => {sgSetSafeHtml(a, '\n        <svg class="sg-optimize-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">\n          <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>\n        </svg>\n        <span class="sg-optimize-label">Optimize</span>\n      ');
        const e = getThemeColors(isDarkTheme());
        a.style.background = e.btnBg, a.style.borderColor = e.border, a.style.color = e.iconText, a.style.padding = "0 12px 0 8px", a.style.pointerEvents = "auto", a.style.boxShadow = "0 1px 3px rgba(0,0,0,0.12)", a.style.height = "32px"
      })
    };
    a.addEventListener("click", async e => {
      if (e.preventDefault(), isModalConfirmationMode) {
        const t = e.target;
        return void(t.closest("#sg-modal-optimize-accept") ? (showToast("Changes accepted", "success"), v()) : t.closest("#sg-modal-optimize-reject") && (s.value = y, s.dispatchEvent(new Event("input", {
          bubbles: !0
        })), showToast("Changes reverted", "info"), v()))
      }
      if (isModalOptimizing) return isModalOptimizing = !1, sgSafeSendMessage({
        type: "CANCEL_OPTIMIZATION"
      }), void v();
      const t = s.value.trim();
      if (t) {
        y = t, isModalOptimizing = !0, enterOptimizeLoadingState(a);
        try {
          const e = await chrome.runtime.sendMessage({
            type: "OPTIMIZE_PROMPT",
            prompt: t,
            originalMode: "unknown",
            isFollowUp: !1,
            hasVariables: !0,
            useAIStudio: useAIStudioForOptimize
          });
          if (!isModalOptimizing) return;
          if (e?.success && e.optimizedPrompt) {
            s.value = e.optimizedPrompt, s.dispatchEvent(new Event("input", {
              bubbles: !0
            })), showToast("Prompt optimized!", "success"), isModalConfirmationMode = !0, isModalOptimizing = !1, a.classList.remove("loading"), a.style.padding = "0", a.style.pointerEvents = "none", a.style.background = "transparent", a.style.borderColor = "transparent", a.style.boxShadow = "none", a.style.height = "auto", a.style.overflow = "visible";
            const t = isDarkTheme(),
              n = `width: 32px; height: 32px; padding: 0; display: flex; align-items: center; justify-content: center; border-radius: 50%; cursor: pointer; box-shadow: 0 1px 2px rgba(0,0,0,0.1); pointer-events: auto; border: 1px solid ${getThemeColors(t).border}; background: ${t?"rgba(32, 33, 36, 0.95)":"white"};`;sgSetSafeHtml(a, `\n            <div style="display: flex; gap: 8px; align-items: center;">\n              <div id="sg-modal-optimize-reject" title="Revert" style="${n} transition: background 0.15s ease;">\n                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16">\n                  <path d="M18 6L6 18M6 6l12 12"/>\n                </svg>\n              </div>\n              <div id="sg-modal-optimize-accept" title="Accept" style="${n} transition: background 0.15s ease;">\n                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16">\n                  <path d="M20 6L9 17l-5-5"/>\n                </svg>\n              </div>\n            </div>\n          `);
            const o = a.querySelector("#sg-modal-optimize-reject"),
              r = a.querySelector("#sg-modal-optimize-accept"),
              i = t ? "rgba(32, 33, 36, 0.95)" : "white",
              l = t ? "#3c4043" : "#e8eaed";
            o && (o.addEventListener("mouseenter", () => o.style.background = l), o.addEventListener("mouseleave", () => o.style.background = i)), r && (r.addEventListener("mouseenter", () => r.style.background = l), r.addEventListener("mouseleave", () => r.style.background = i)), optimizationShortcutHandler = e => {
              isModalConfirmationMode && ("Enter" === e.key ? (e.preventDefault(), e.stopImmediatePropagation(), r?.click()) : "Escape" === e.key && (e.preventDefault(), e.stopImmediatePropagation(), o?.click()))
            }, document.addEventListener("keydown", optimizationShortcutHandler, !0)
          } else showToast("Optimization failed", "error"), v()
        } catch (e) {
          console.error(e), showToast("Optimization error", "error"), v()
        }
      } else showToast("Please enter text to optimize", "info")
    });
    let x = o.mode || "",
      w = o.tool || "";
    const S = f.querySelector(".sg-prompt-mode-btn"),
      E = f.querySelector(".sg-prompt-tool-btn"),
      k = () => {
        S && (S.style.background = "transparent", S.style.borderColor = x ? "var(--gem-sys-color--primary, #1a73e8)" : "var(--gem-sys-color--outline-variant, #dce1e9)", S.style.color = x ? "var(--gem-sys-color--primary, #1a73e8)" : "var(--gem-sys-color--on-surface-variant, #575a5a)", S.setAttribute("data-tooltip-fast", x || "No mode change"), S.title = x ? `Model: ${x}` : "Switch model when using this prompt"), E && (E.style.background = "transparent", E.style.borderColor = w ? "var(--gem-sys-color--primary, #1a73e8)" : "var(--gem-sys-color--outline-variant, #dce1e9)", E.style.color = w ? "var(--gem-sys-color--primary, #1a73e8)" : "var(--gem-sys-color--on-surface-variant, #575a5a)", E.setAttribute("data-tooltip-fast", w || "No tool change"), E.title = w ? `Tool: ${w}` : "Select tool when using this prompt")
      };
    S?.addEventListener("click", e => {
      e.stopPropagation(),
        function(e) {
          const t = document.querySelector(".sg-tool-dropdown");
          t && t.remove();
          const n = document.querySelector(".sg-mode-dropdown");
          if (n) return void n.remove();
          const o = isDarkTheme(),
            r = getThemeColors(o),
            s = document.createElement("div");
          s.className = "sg-mode-dropdown", document.body.appendChild(s);
          const a = e.getBoundingClientRect();
          s.style.cssText = `\n        position: fixed;\n        bottom: ${window.innerHeight-a.top+4}px;\n        left: ${a.left}px;\n        min-width: 160px;\n        background: ${r.dropdownBg};\n        border: 1px solid ${r.border};\n        border-radius: 8px;\n        box-shadow: 0 4px 12px rgba(0,0,0,0.15);\n        padding: 4px 0;\n        z-index: 2100;\n        font-size: 13px;\n      `;
          [{
            value: "",
            label: "🔄 No change",
            desc: "Keep current mode"
          }, {
            value: "Fast",
            label: "⚡ Flash-Lite",
            desc: "Fastest answers"
          }, {
            value: "Thinking",
            label: "🧠 Flash",
            desc: "All-around help"
          }, {
            value: "Pro",
            label: "💎 Pro",
            desc: "Advanced math & code"
          }].forEach(e => {
            const t = document.createElement("div");
            t.style.cssText = `\n          padding: 8px 12px;\n          cursor: pointer;\n          display: flex;\n          align-items: center;\n          justify-content: space-between;\n          gap: 8px;\n          background: ${x===e.value?o?"#3c4043":"#e8f0fe":"transparent"};\n          color: ${r.textPrimaryAlt};\n          transition: background 0.15s;\n        `,sgSetSafeHtml(t, `\n          <span>${e.label}</span>\n          ${x===e.value?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;"><path d="M20 6L9 17l-5-5"/></svg>':""}\n        `), t.addEventListener("mouseenter", () => {
              t.style.background = r.hoverBg
            }), t.addEventListener("mouseleave", () => {
              t.style.background = x === e.value ? o ? "#3c4043" : "#e8f0fe" : "transparent"
            }), t.addEventListener("click", () => {
              x = e.value, k(), s.remove()
            }), s.appendChild(t)
          }), document.body.appendChild(s);
          const i = t => {
            s.contains(t.target) || t.target === e || (s.remove(), document.removeEventListener("click", i))
          };
          setTimeout(() => document.addEventListener("click", i), 10)
        }(S)
    }), S?.addEventListener("mouseenter", () => {
      x || (S.style.background = "var(--gem-sys-color--surface-container-highest, #dfe3eb)")
    }), S?.addEventListener("mouseleave", () => {
      x || (S.style.background = "transparent")
    }), E?.addEventListener("click", e => {
      e.stopPropagation(),
        function(e) {
          const t = document.querySelector(".sg-mode-dropdown");
          t && t.remove();
          const n = document.querySelector(".sg-tool-dropdown");
          if (n) return void n.remove();
          const o = isDarkTheme(),
            r = getThemeColors(o),
            s = document.createElement("div");
          s.className = "sg-tool-dropdown";
          const a = e.getBoundingClientRect();
          s.style.cssText = `\n        position: fixed;\n        bottom: ${window.innerHeight-a.top+4}px;\n        left: ${a.left}px;\n        min-width: 160px;\n        background: ${r.dropdownBg};\n        border: 1px solid ${r.border};\n        border-radius: 8px;\n        box-shadow: 0 4px 12px rgba(0,0,0,0.15);\n        padding: 4px 0;\n        z-index: 2100;\n        font-size: 13px;\n      `;
          [{
            value: "",
            label: "🔧 No change",
            desc: "Keep current tool"
          }, {
            value: "none",
            label: "❌ None",
            desc: "Deselect tool"
          }, {
            value: "deep-research",
            label: "🔬 Deep Research",
            desc: "In-depth analysis"
          }, {
            value: "video",
            label: "🎥 Create Videos",
            desc: "Generate videos"
          }, {
            value: "image",
            label: "🍌 Create Images",
            desc: "Generate images"
          }, {
            value: "canvas",
            label: "📋 Canvas",
            desc: "Visual workspace"
          }, {
            value: "guided-learning",
            label: "📚 Guided Learning",
            desc: "Educational mode"
          }].forEach(e => {
            const t = document.createElement("div");
            t.style.cssText = `\n          padding: 8px 12px;\n          cursor: pointer;\n          display: flex;\n          align-items: center;\n          justify-content: space-between;\n          gap: 8px;\n          background: ${w===e.value?o?"#3c4043":"#e8f0fe":"transparent"};\n          color: ${r.textPrimaryAlt};\n          transition: background 0.15s;\n        `,sgSetSafeHtml(t, `\n          <span>${e.label}</span>\n          ${w===e.value?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;"><path d="M20 6L9 17l-5-5"/></svg>':""}\n        `), t.addEventListener("mouseenter", () => {
              t.style.background = r.hoverBg
            }), t.addEventListener("mouseleave", () => {
              t.style.background = w === e.value ? o ? "#3c4043" : "#e8f0fe" : "transparent"
            }), t.addEventListener("click", () => {
              w = e.value, k(), s.remove()
            }), s.appendChild(t)
          }), document.body.appendChild(s);
          const i = t => {
            s.contains(t.target) || t.target === e || (s.remove(), document.removeEventListener("click", i))
          };
          setTimeout(() => document.addEventListener("click", i), 10)
        }(E)
    }), E?.addEventListener("mouseenter", () => {
      w || (E.style.background = "var(--gem-sys-color--surface-container-highest, #dfe3eb)")
    }), E?.addEventListener("mouseleave", () => {
      w || (E.style.background = "transparent")
    });
    let T = o.autosend || !1;
    const C = f.querySelector(".sg-prompt-autosend-btn");
    C?.addEventListener("click", e => {
      e.stopPropagation(), T = !T, C && (C.style.background = T ? "var(--gem-sys-color--primary, #1a73e8)" : "transparent", C.style.borderColor = T ? "var(--gem-sys-color--primary, #1a73e8)" : "var(--gem-sys-color--outline-variant, #dce1e9)", C.style.color = T ? "#ffffff" : "var(--gem-sys-color--on-surface-variant, #575a5a)", C.setAttribute("data-tooltip-fast", T ? "Auto-send enabled" : "Auto-send disabled"), C.title = T ? "Auto-send enabled" : "Auto-send disabled")
    }), C?.addEventListener("mouseenter", () => {
      T || (C.style.background = "var(--gem-sys-color--surface-container-highest, #dfe3eb)")
    }), C?.addEventListener("mouseleave", () => {
      T || (C.style.background = "transparent")
    }), f.querySelector("#sg-edit-cancel-btn").addEventListener("click", r), f.querySelector("#sg-edit-save-btn").addEventListener("click", async () => {
      const n = f.querySelector("#sg-edit-prompt-title").value.trim(),
        o = f.querySelector("#sg-edit-prompt-text").value.trim();
      if (n && o) {
        if (promptsData.prompts.find(t => t.title.toLowerCase() === n.toLowerCase() && t.id !== e)) return void showToast("A prompt with this name already exists", "error");
        if (t) {
          const t = promptsData.prompts.findIndex(t => t.id === e);
          if (-1 !== t) {
            promptsData.prompts[t] = {
              ...promptsData.prompts[t],
              title: n,
              text: o,
              mode: x,
              tool: w,
              autosend: T,
              lastModified: Date.now()
            };
            await savePromptsData() && (showToast("Prompt updated", "success"), r())
          }
        } else {
          const t = Date.now(),
            s = {
              id: generatePromptId(),
              title: n,
              text: o,
              mode: x,
              tool: w,
              autosend: T,
              lastModified: t,
              sortIndex: sgNextSortIndex(promptsData.prompts),
              sortIndexAt: t
            };
          promptsData.prompts.push(s);
          await savePromptsData() ? (showToast("Prompt saved to library", "success"), r()) : promptsData.prompts.pop()
        }
      }
    })
  }

  function b() {
    p = "list", n.dataset.activeTab = "prompts";
    const e = n.querySelector("#sg-prompts-tab-help-link");
    e && (e.href = `${guideUrl}#prompts`);
    const t = isDarkTheme(),
      o = getThemeColors(t);
    i.style.background = o.tabActiveBg, i.style.color = "var(--gem-sys-color--on-surface, #1f1f1f)", i.style.boxShadow = t ? "0 1px 3px rgba(0,0,0,0.5)" : "0 1px 3px rgba(0,0,0,0.1)", l.style.background = "transparent", l.style.color = "var(--gem-sys-color--on-surface-variant, #575a5a)", l.style.boxShadow = "none", u && (u.style.display = "flex"), c && (c.style.display = "flex"), d && (d.style.display = "none");
    const s = 0 === promptsData.prompts.length ? '\n      <div class="sg-empty-state" style="text-align: center; padding: 40px 20px; color: #575a5a;">\n        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width: 48px; height: 48px; margin: 0 auto 16px; opacity: 0.5;">\n          <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>\n        </svg>\n        <p style="font-size: 15px; margin: 0 0 8px;">No prompts yet</p>\n        <p style="font-size: 13px; opacity: 0.7;">Save your favorite prompts to reuse them anytime</p>\n      </div>\n    ' : promptsData.prompts.map(e => { const pid = escapeHtml(String(e.id || "")); return `\n      <div class="sg-prompt-item" data-prompt-id="${pid}" draggable="true" style="\n        display: flex;\n        align-items: center;\n        padding: 16px 24px 16px 64px;\n        background: transparent;\n        border-radius: 8px !important;\n        cursor: pointer;\n        transition: background 0.1s;\n        user-select: none;\n        margin: 0 8px;\n        border-bottom: 1px solid var(--gem-sys-color--outline-variant, #dce1e9);\n        font-family: var(--sg-font-text);\n      ">\n        <input type="checkbox" class="sg-prompt-checkbox" data-prompt-id="${pid}" style="\n          width: 30px;\n          height: 30px;\n          min-width: 30px;\n          min-height: 30px;\n          flex-shrink: 0;\n          margin: 0;\n          margin-right: 18px;\n          cursor: pointer;\n          accent-color: #4285f4;\n        ">\n\n        <div style="flex: 1; display: flex; align-items: center; gap: 12px; min-width: 0;">\n          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width: 20px; height: 20px; color: var(--gem-sys-color--on-surface-variant, #575a5a); flex-shrink: 0;">\n            <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>\n          </svg>\n          <div style="flex: 1; min-width: 0;">\n            <span style="font-size: 16px; font-weight: 500; color: var(--gem-sys-color--on-surface, #1f1f1f); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block;">${escapeHtml(e.title)}</span>\n            <span style="font-size: 12px; color: var(--gem-sys-color--on-surface-variant, #575a5a); opacity: 0.8;">${(()=>{const t=new Set;if(e.text){const n=e.text.match(/\{\{([^}]+)\}\}/g);n&&n.forEach(e=>t.add(e))}const n=t.size;return 0===n?"No variables":`${n} variable${1!==n?"s":""}`})()}</span>\n          </div>\n        </div>\n        <button type="button" class="sg-library-use-btn" title="Paste into the chat box" aria-label="Use prompt">${SG_LIBRARY_USE_ICON_SVG}<span>Use</span></button>\n      </div>\n    `; }).join("");sgSetSafeHtml(f, `<div style="display: flex; flex-direction: column;">${s}</div>`), D(), document.getElementById("sg-create-chain-tip")?._sgRemove?.(!1), q("prompts")
  }

  function v() {
    p = "chains-list", n.dataset.activeTab = "chains";
    const e = n.querySelector("#sg-prompts-tab-help-link");
    e && (e.href = `${guideUrl}#chains`);
    const t = isDarkTheme(),
      r = getThemeColors(t);
    i.style.background = "transparent", i.style.color = "var(--gem-sys-color--on-surface-variant, #575a5a)", i.style.boxShadow = "none", l.style.background = r.tabActiveBg, l.style.color = "var(--gem-sys-color--on-surface, #1f1f1f)", l.style.boxShadow = t ? "0 1px 3px rgba(0,0,0,0.5)" : "0 1px 3px rgba(0,0,0,0.1)";
    u && (u.style.display = "flex"), c && (c.style.display = "none"), d && (d.style.display = "flex");
    const g = n.querySelector("#sg-prompt-search");
    if (g && (g.placeholder = "Search chains...", g.value = ""), document.getElementById("sg-create-prompt-tip")?._sgRemove?.(!1), document.getElementById("sg-show-chains-tip")?._sgRemove?.(!1), q("chains"), 0 === chainsData.chains.length) return void(sgSetSafeHtml(f, '\n        <div style="text-align: center; padding: 60px 20px; color: #575a5a;">\n          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width: 48px; height: 48px; margin: 0 auto 16px; opacity: 0.5;">\n            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-7-7z"/>\n            <path d="M13 2v7h7"/>\n            <circle cx="9" cy="14" r="2"/>\n            <circle cx="15" cy="14" r="2"/>\n            <path d="M9 16v2h6v-2"/>\n          </svg>\n          <p style="font-size: 16px; font-weight: 500; margin: 0 0 8px; color: var(--gem-sys-color--on-surface, #1f1f1f);">No chains yet</p>\n          <p class="sg-empty-state-desc" style="font-size: 13px; opacity: 0.7; max-width: 300px; margin: 0 auto;">Create prompt chains to run multiple prompts in sequence. Use ",," in the chat input to trigger them.</p>\n        </div>\n      '));
    const m = chainsData.chains.map(e => { const cid = escapeHtml(String(e.id || "")); return `\n      <div class="sg-chain-item" data-chain-id="${cid}" draggable="true" style="\n        display: flex;\n        align-items: center;\n        padding: 18.5px 24px 18.5px 64px;\n        background: transparent;\n        border-radius: 8px !important;\n        cursor: pointer;\n        transition: background 0.1s;\n        user-select: none;\n        margin: 0 8px;\n        border-bottom: 1px solid var(--gem-sys-color--outline-variant, #dce1e9);\n        font-family: var(--sg-font-text);\n      ">\n        <input type="checkbox" class="sg-chain-checkbox" data-chain-id="${cid}" style="\n          width: 30px;\n          height: 30px;\n          min-width: 30px;\n          min-height: 30px;\n          flex-shrink: 0;\n          margin: 0;\n          margin-right: 18px;\n          cursor: pointer;\n          accent-color: #4285f4;\n        ">\n\n        <div style="flex: 1; display: flex; align-items: center; gap: 12px; min-width: 0;">\n          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width: 20px; height: 20px; color: var(--gem-sys-color--on-surface-variant, #575a5a); flex-shrink: 0;">\n            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-7-7z"/>\n            <path d="M13 2v7h7"/>\n            <circle cx="9" cy="14" r="2" fill="currentColor"/>\n            <circle cx="15" cy="14" r="2" fill="currentColor"/>\n            <path d="M9 16v2h6v-2"/>\n          </svg>\n          <div style="flex: 1; min-width: 0;">\n            <span style="font-size: 16px; font-weight: 500; color: var(--gem-sys-color--on-surface, #1f1f1f); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block;">${escapeHtml(e.title)}</span>\n            <div style="display: flex; align-items: center; gap: 6px;">\n              <span style="font-size: 12px; color: var(--gem-sys-color--on-surface-variant, #575a5a); opacity: 0.8;">${e.steps.length} step${1!==e.steps.length?"s":""}</span>\n              <span style="font-size: 12px; color: var(--gem-sys-color--on-surface-variant, #575a5a); opacity: 0.6;">•</span>\n              <span style="font-size: 12px; color: var(--gem-sys-color--on-surface-variant, #575a5a); opacity: 0.8;">${(()=>{const t=new Set;e.steps.forEach(e=>{const n=("string"==typeof e?e:e.text||"").match(/\{\{([^}]+)\}\}/g);n&&n.forEach(e=>t.add(e))});const n=t.size;return 0===n?"No variables":`${n} variable${1!==n?"s":""}`})()}</span>\n            </div>\n          </div>\n        </div>\n        <button type="button" class="sg-library-use-btn" title="Run chain" aria-label="Run chain">${SG_LIBRARY_USE_ICON_SVG}<span>Use</span></button>\n      </div>\n    `; }).join("");sgSetSafeHtml(f, `<div style="display: flex; flex-direction: column;">${m}</div>`),
      function() {
        const e = n.querySelector("#sg-prompt-search");
        e && (e.value = "", e.focus(), e.addEventListener("input", e => {
          const t = e.target.value.toLowerCase();
          n.querySelectorAll(".sg-chain-item").forEach(e => {
            const n = e.querySelector("span")?.textContent?.toLowerCase() || "";
            e.style.display = n.includes(t) ? "flex" : "none"
          })
        }));
        const t = () => {
          const e = n.querySelectorAll(".sg-chain-checkbox:checked").length,
            t = n.querySelector("#sg-delete-chains-btn");
          t && (e > 0 ? (t.style.opacity = "1", t.style.pointerEvents = "auto", t.style.background = "var(--gem-sys-color--error-container, #f9dedc)", t.style.color = "var(--gem-sys-color--on-error-container, #410e0b)") : (t.style.opacity = "0.5", t.style.pointerEvents = "none", t.style.background = "var(--gem-sys-color--surface-container-high, #e9eef6)", t.style.color = "var(--gem-sys-color--on-surface, #1f1f1f)"))
        };
        t(), n.querySelectorAll(".sg-chain-checkbox").forEach(e => {
          e.addEventListener("change", t)
        }), n.querySelectorAll(".sg-chain-item").forEach(e => {
          e.addEventListener("dragstart", t => {
            t.dataTransfer.setData("text/plain", e.dataset.chainId), e.style.opacity = "0.5"
          }), e.addEventListener("dragend", () => {
            e.style.opacity = "1", R = null, F()
          }), e.addEventListener("dragover", t => {
            t.preventDefault();
            const n = e.getBoundingClientRect(),
              o = n.top + n.height / 2,
              r = t.clientY < o ? "top" : "bottom",
              s = e.dataset.chainId;
            R && R.id === s && R.position === r || (R = {
              id: s,
              position: r
            }, F())
          }), e.addEventListener("dragleave", t => {
            const n = e.getBoundingClientRect();
            (t.clientX < n.left || t.clientX >= n.right || t.clientY < n.top || t.clientY >= n.bottom) && (R = null, F())
          }), e.addEventListener("drop", t => {
            t.preventDefault();
            const n = t.dataTransfer.getData("text/plain"),
              o = e.dataset.chainId,
              r = R ? R.position : "bottom";
            n && n !== o && async function(e, t, n) {
              const o = chainsData.chains.findIndex(t => t.id === e);
              if (-1 === o) return;
              const r = chainsData.chains[o];
              chainsData.chains.splice(o, 1);
              const s = chainsData.chains.findIndex(e => e.id === t);
              if (-1 === s) chainsData.chains.push(r);
              else {
                const e = "top" === n ? s : s + 1;
                chainsData.chains.splice(e, 0, r)
              }
              const a = Date.now(),
                i = chainsData.chains.indexOf(r),
                l = chainsData.chains[i - 1],
                c = chainsData.chains[i + 1],
                d = l && "number" == typeof l.sortIndex ? l.sortIndex : null,
                u = c && "number" == typeof c.sortIndex ? c.sortIndex : null,
                p = sgComputeNewSortIndex(d, u);
              null === p ? sgRebalanceSortIndices(chainsData.chains, a) : (r.sortIndex = p, r.sortIndexAt = a);
              await saveChainsData(), v()
            }(n, o, r), R = null, F()
          }), e.addEventListener("mouseenter", () => {
            e.style.background = "var(--gem-sys-color--surface-container-highest, #dce1e9)", e.style.borderColor = "var(--gem-sys-color--outline, #c8d0da)";
            const t = e.querySelector(".sg-chain-options-btn");
            t && (t.style.opacity = "1")
          }), e.addEventListener("mouseleave", () => {
            e.style.background = "transparent", e.style.borderColor = "transparent", e.style.borderBottomColor = "var(--gem-sys-color--outline-variant, #dce1e9)";
            const t = e.querySelector(".sg-chain-options-btn");
            t && (t.style.opacity = "0")
          }), e.addEventListener("click", t => {
            if (t.target.closest(".sg-chain-checkbox") || t.target.closest(".sg-chain-options-btn")) return;
            E(e.dataset.chainId)
          }), e.querySelector(".sg-chain-options-btn")?.addEventListener("click", t => {
            t.stopPropagation(),
              function(e, t) {
                document.querySelectorAll(".sg-context-menu").forEach(e => e.remove());
                const n = document.createElement("div");
                n.className = "sg-context-menu",sgSetSafeHtml(n, '\n      <button class="sg-context-item" data-action="run" style="color: var(--gem-sys-color--primary, #1a73e8);">\n        <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">\n          <path d="M8 5v14l11-7z"/>\n        </svg>\n        Run Chain\n      </button>\n      <button class="sg-context-item" data-action="edit">\n        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">\n          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>\n          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>\n        </svg>\n        Edit\n      </button>\n      <button class="sg-context-item sg-context-item-danger" data-action="delete">\n        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">\n          <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>\n        </svg>\n        Delete\n      </button>\n    '), document.body.appendChild(n);
                const o = e.getBoundingClientRect();
                n.style.top = o.bottom + 4 + "px", n.style.left = o.left - 120 + "px", requestAnimationFrame(() => n.classList.add("show")), n.querySelector('[data-action="run"]').addEventListener("click", () => {
                  const e = chainsData.chains.find(e => e.id === t);
                  e && (s(), runChain(e)), n.remove()
                }), n.querySelector('[data-action="edit"]').addEventListener("click", () => {
                  E(t), n.remove()
                }), n.querySelector('[data-action="delete"]').addEventListener("click", async () => {
                  showConfirmationModal("Delete Chain", "Delete this chain?", async () => {
                    tombstoneChains([t]), chainsData.chains = chainsData.chains.filter(e => e.id !== t), await saveChainsData(), v(), showToast("Chain deleted", "success")
                  }), n.remove()
                });
                const r = t => {
                  n.contains(t.target) || t.target === e || (n.remove(), document.removeEventListener("click", r))
                };
                setTimeout(() => document.addEventListener("click", r), 10)
              }(t.currentTarget, e.dataset.chainId)
          }), e.querySelector(".sg-library-use-btn")?.addEventListener("click", t => {
            t.stopPropagation();
            const n = chainsData.chains.find(t => t.id === e.dataset.chainId);
            n && (o(), runChain(n))
          })
        })
      }();
    setupShiftClickSelection(f, ".sg-chain-checkbox", () => {
      const e = n.querySelectorAll(".sg-chain-checkbox:checked").length,
        t = n.querySelector("#sg-delete-chains-btn");
      t && (e > 0 ? (t.style.opacity = "1", t.style.pointerEvents = "auto", t.style.background = "var(--gem-sys-color--error-container, #f9dedc)", t.style.color = "var(--gem-sys-color--on-error-container, #410e0b)") : (t.style.opacity = "0.5", t.style.pointerEvents = "none", t.style.background = "var(--gem-sys-color--surface-container-high, #e9eef6)", t.style.color = "var(--gem-sys-color--on-surface, #1f1f1f)"))
    })
  }
  function E(e = null) {
    p = "edit-chain";
    const t = null !== e,
      o = t ? chainsData.chains.find(t => t.id === e) : {
        title: "",
        steps: [""]
      };
    if (t && !o) return;sgSetSafeHtml(n.querySelector(".sg-folders-modal-content > div:first-child > div:first-child"), `\n      \x3c!-- Help Icon --\x3e\n      <a id="sg-prompts-tab-help-link" href="${guideUrl}#chains" target="_blank" class="sg-help-link" style="margin-right: 4px;">\n        <span class="sg-help-btn" data-tooltip-fast="Open guide for this feature">?</span>\n      </a>\n      <h2 style="font-family: var(--sg-font-flex); font-size: 20px; font-weight: 500; color: var(--gem-sys-color--on-surface, #1f1f1f); margin: 0;">${t?"Edit Chain":"New Chain"}</h2>\n    `), u && (u.style.display = "none");
    const r = (o.steps.length > 0 ? o.steps : [""]).map((e, t) => L(t, e)).join("");sgSetSafeHtml(f, `\n      <div style="padding: 24px 32px; display: flex; flex-direction: column; gap: 12px;">\n        <div style="display: flex; flex-direction: column; gap: 8px;">\n          <label style="font-size: 13px; font-weight: 500; color: var(--gem-sys-color--on-surface-variant, #575a5a);">Chain Title</label>\n          <input type="text" id="sg-chain-title" value="${escapeHtml(o.title)}" placeholder="Enter chain title..." style="\n            padding: 14px 16px;\n            border: 1px solid var(--gem-sys-color--outline-variant, #dce1e9);\n            border-radius: 12px;\n            font-size: 15px;\n            background: var(--gem-sys-color--surface-container-high, #e9eef6);\n            color: var(--gem-sys-color--on-surface, #1f1f1f);\n            outline: none;\n            transition: border-color 0.2s;\n          ">\n        </div>\n\n        <div style="display: flex; flex-direction: column; gap: 12px;">\n          <div style="display: flex; align-items: center; justify-content: space-between;">\n            <div style="display: flex; align-items: center; gap: 16px;">\n              <label style="font-size: 11px; color: var(--gem-sys-color--on-surface-variant, #575a5a); letter-spacing: 0.8px; margin: 0; text-transform: uppercase; font-weight: 500;">Steps</label>\n              \n              <div id="sg-chain-controls-container" style="display: flex; align-items: center; gap: 8px;">\n                <button type="button" id="sg-chain-optimize-btn" class="sg-optimize-btn" style="\n                  display: inline-flex;\n                  align-items: center;\n                  justify-content: center;\n                  gap: 4px;\n                  height: 32px;\n                  padding: 0 12px 0 8px;\n                  border-radius: 16px;\n                  font-size: 14px;\n                  font-weight: 500;\n                  font-family: var(--sg-font-flex);\n                  cursor: pointer;\n                  user-select: none;\n                  transition: all 0.2s ease;\n                  box-shadow: 0 1px 3px rgba(0,0,0,0.12);\n                  background: ${getThemeColors().btnBg};\n                  border: 1px solid ${getThemeColors().border};\n                  color: ${getThemeColors().iconText};\n                ">\n                  <svg class="sg-optimize-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">\n                    <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>\n                  </svg>\n                  <span class="sg-optimize-label">Optimize</span>\n                </button>\n\n                <div id="sg-chain-word-counter" style="\n                  display: inline-flex;\n                  align-items: center;\n                  height: 32px;\n                  padding: 0 16px;\n                  border-radius: 16px;\n                  font-size: 12px;\n                  font-weight: 500;\n                  font-family: var(--sg-font-flex);\n                  cursor: pointer;\n                  user-select: none;\n                  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);\n                  box-shadow: 0 1px 3px rgba(0,0,0,0.12);\n                  background: ${getThemeColors().btnBg};\n                  border: 1px solid ${getThemeColors().border};\n                  color: ${getThemeColors().iconText};\n                  overflow: hidden;\n                  white-space: nowrap;\n                  max-width: fit-content;\n                ">\n                  <div class="sg-chain-counter-summary" style="flex-shrink: 0; transition: color 0.2s ease;">0 words / 0 characters</div>\n                  <div class="sg-chain-counter-details" style="\n                    display: flex; \n                    align-items: center; \n                    gap: 12px; \n                    margin-left: 0; \n                    padding-left: 0; \n                    border-left: 1px solid transparent;\n                    max-width: 0;\n                    opacity: 0;\n                    visibility: hidden;\n                    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);\n                    overflow: hidden;\n                  ">\n                    <span style="margin-left: 12px; padding-left: 12px; border-left: 1px solid ${isDarkTheme()?"rgba(255,255,255,0.1)":"rgba(0,0,0,0.1)"};">Characters (No Spaces): <strong id="sg-chain-stat-nospace">0</strong></span>\n                    <span>Sentences: <strong id="sg-chain-stat-sentences">0</strong></span>\n                    <span>Paragraphs: <strong id="sg-chain-stat-paragraphs">0</strong></span>\n                    <span>Lines: <strong id="sg-chain-stat-lines">0</strong></span>\n                  </div>\n                </div>\n              </div>\n            </div>\n\n          </div>\n          <div id="sg-chain-steps-container" style="display: flex; flex-direction: column; gap: 12px;">\n            ${r}\n          </div>\n        </div>\n\n        <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 12px;">\n          <button id="sg-add-step-btn" class="sg-btn sg-btn-gray" style="\n            display: flex;\n            align-items: center;\n            gap: 6px;\n            padding: 8px 16px;\n            font-size: 13px;\n            font-weight: 500;\n            cursor: pointer;\n            transition: all 0.15s ease;\n          ">\n            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;">\n              <path d="M12 5v14M5 12h14"/>\n            </svg>\n            Add Step\n          </button>\n          <button id="sg-cancel-chain-btn" class="sg-btn sg-btn-gray">Cancel</button>\n          <button id="sg-save-chain-btn" class="sg-btn sg-btn-gray">Save Chain</button>\n        </div>\n      </div>\n    `), n.querySelector("#sg-chain-title")?.focus(), n.querySelector("#sg-add-step-btn")?.addEventListener("click", () => {
      const e = n.querySelector("#sg-chain-steps-container"),
        t = e.querySelectorAll(".sg-chain-step").length,
        r = document.createElement("div");sgSetSafeHtml(r, L(t, ""));
      const s = r.firstElementChild;
      e.appendChild(s), _(s), s.querySelector("textarea")?.focus(), P()
    }), n.querySelector("#sg-cancel-chain-btn")?.addEventListener("click", () => {
      h(), v()
    }), n.querySelector("#sg-save-chain-btn")?.addEventListener("click", async () => {
      const o = n.querySelector("#sg-chain-title")?.value?.trim();
      if (!o) return void showToast("Please enter a chain title", "error");
      const r = Array.from(n.querySelectorAll(".sg-chain-step")).map(e => ({
        text: e.querySelector("textarea")?.value?.trim() || "",
        mode: e.dataset.mode || "",
        tool: e.dataset.tool || ""
      })).filter(e => e.text.length > 0);
      if (0 !== r.length) {
        if (t) {
          const t = chainsData.chains.find(t => t.id === e);
          t && (t.title = o, t.steps = r, t.lastModified = Date.now())
        } else {
          const t = Date.now();
          chainsData.chains.push({
            id: generateChainId(),
            title: o,
            steps: r,
            createdAt: t,
            lastModified: t,
            sortIndex: sgNextSortIndex(chainsData.chains),
            sortIndexAt: t
          })
        }
        await saveChainsData(), showToast(t ? "Chain updated" : "Chain created", "success"), h(), v()
      } else showToast("Please add at least one step", "error")
    }), n.querySelectorAll(".sg-chain-step").forEach(_);
    const s = n.querySelector(".sg-chain-step");
    s && (s.style.borderLeftColor = "var(--gem-sys-color--primary, #1a73e8)", s.dataset.active = "true", I())
  }
  let k = "",
    T = null;

  function C(e) {
    return {
      Fast: "⚡ Flash-Lite",
      Thinking: "🧠 Flash",
      Pro: "💎 Pro"
    } [e] || "🔄 Mode"
  }

  function A(e) {
    return {
      none: "❌ None",
      "deep-research": "🔬 Research",
      video: "🎥 Video",
      image: "🍌 Image",
      canvas: "📋 Canvas",
      "guided-learning": "📚 Learn"
    } [e] || "🔧 Tool"
  }

  function L(e, t) {
    const n = function(e) {
        return "string" == typeof e ? {
          text: e,
          mode: "",
          tool: ""
        } : {
          text: e.text || "",
          mode: e.mode || "",
          tool: e.tool || ""
        }
      }(t),
      o = C(n.mode),
      r = A(n.tool);
    return `\n\n        <div class="sg-chain-step" data-step-index="${e}" data-active="false" data-mode="${escapeHtml(n.mode)}" data-tool="${escapeHtml(n.tool)}" style="\n\n          position: relative;\n\n          display: flex;\n\n          gap: 12px;\n\n          padding: 16px;\n\n          background: var(--gem-sys-color--surface-container-high, #e9eef6);\n\n          border-radius: 12px;\n\n          border-left: 4px solid var(--gem-sys-color--outline-variant, #dce1e9);\n\n          transition: border-left-color 0.2s ease;\n\n        ">\n\n          <span class="sg-step-number" style="\n\n            font-size: 13px;\n\n            font-weight: 600;\n\n            color: var(--gem-sys-color--on-surface-variant, #575a5a);\n\n            min-width: 50px;\n\n          ">Step ${e+1}</span>\n\n          <textarea class="sg-chain-step-textarea" placeholder="Enter prompt for this step. Use {{variableName}} for dynamic values or [[Prompt Title]] to reference prompts..." style="\n\n            flex: 1;\n\n            min-height: 120px;\n\n            padding: 12px;\n\n            border: 1px solid var(--gem-sys-color--outline-variant, #dce1e9);\n\n            border-radius: 8px;\n\n            font-size: 14px;\n\n            line-height: 1.5;\n\n            resize: vertical;\n\n            background: var(--gem-sys-color--surface, #f0f4f8);\n\n            color: var(--gem-sys-color--on-surface, #1f1f1f);\n\n            outline: none;\n\n            font-family: inherit;\n\n          ">${escapeHtml(n.text)}</textarea>\n\n          <div class="sg-step-actions" style="\n            display: flex;\n            flex-direction: column;\n            gap: 6px;\n            flex-shrink: 0;\n          ">\n                  <button class="sg-remove-step-btn" title="Remove step" tabindex="-1" style="\n\n                    width: 32px;\n\n                    height: 32px;\n\n                    background: transparent;\n\n                    border: 1px solid var(--gem-sys-color--outline-variant, #dce1e9);\n\n            border-radius: 50%;\n\n            color: var(--gem-sys-color--on-surface-variant, #575a5a);\n\n            cursor: pointer;\n\n            display: flex;\n\n            align-items: center;\n\n            justify-content: center;\n\n            transition: all 0.15s ease;\n\n            flex-shrink: 0;\n\n          ">\n\n            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px;">\n\n              <path d="M18 6L6 18M6 6l12 12"/>\n\n            </svg>\n\n          </button>\n\n          <button class="sg-step-mode-btn" title="Switch model before this step" tabindex="-1" style="\n            width: 32px;\n            height: 32px;\n            background: transparent;\n            border: 1px solid ${n.mode?"var(--gem-sys-color--primary, #1a73e8)":"var(--gem-sys-color--outline-variant, #dce1e9)"};\n            border-radius: 50%;\n            color: ${n.mode?"var(--gem-sys-color--primary, #1a73e8)":"var(--gem-sys-color--on-surface-variant, #575a5a)"};\n            cursor: pointer;\n            display: flex;\n            align-items: center;\n            justify-content: center;\n            transition: all 0.15s ease;\n            font-size: 12px;\n          " data-tooltip-fast="${o}">\n            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;">\n              <circle cx="12" cy="12" r="3"/>\n              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>\n            </svg>\n          </button>\n\n          <button class="sg-step-tool-btn" title="Select tool before this step" tabindex="-1" style="\n            width: 32px;\n            height: 32px;\n            background: transparent;\n            border: 1px solid ${n.tool?"var(--gem-sys-color--primary, #1a73e8)":"var(--gem-sys-color--outline-variant, #dce1e9)"};\n            border-radius: 50%;\n            color: ${n.tool?"var(--gem-sys-color--primary, #1a73e8)":"var(--gem-sys-color--on-surface-variant, #575a5a)"};\n            cursor: pointer;\n            display: flex;\n            align-items: center;\n            justify-content: center;\n            transition: all 0.15s ease;\n            font-size: 12px;\n          " data-tooltip-fast="${r}">\n            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;">\n              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>\n            </svg>\n          </button>\n          </div>\n\n        </div>\n\n      `
  }

  function _(e) {
    const t = e.querySelector("textarea"),
      o = () => {
        n.querySelectorAll(".sg-chain-step").forEach(e => {
          e.style.borderLeftColor = "var(--gem-sys-color--outline-variant, #dce1e9)", e.dataset.active = "false"
        }), e.style.borderLeftColor = "var(--gem-sys-color--primary, #1a73e8)", e.dataset.active = "true", isModalConfirmationMode || I()
      };
    t?.addEventListener("focus", o), t?.addEventListener("click", o), t?.addEventListener("input", () => {
      "true" !== e.dataset.active || isModalConfirmationMode || I()
    });
    const r = e.querySelector(".sg-remove-step-btn");
    r?.addEventListener("click", () => {
      n.querySelector("#sg-chain-steps-container").querySelectorAll(".sg-chain-step").length <= 1 ? showToast("Chain must have at least one step", "info") : (e.remove(), P(), I())
    }), r?.addEventListener("mouseenter", () => {
      r.style.background = "var(--gem-sys-color--error, #b3261e)", r.style.color = "white", r.style.borderColor = "var(--gem-sys-color--error, #b3261e)"
    }), r?.addEventListener("mouseleave", () => {
      r.style.background = "transparent", r.style.color = "var(--gem-sys-color--on-surface-variant, #575a5a)", r.style.borderColor = "var(--gem-sys-color--outline-variant, #dce1e9)"
    });
    const s = e.querySelector(".sg-step-mode-btn");
    s?.addEventListener("click", t => {
      t.stopPropagation(),
        function(e, t) {
          const n = document.querySelector(".sg-step-dropdown");
          if (n) return void n.remove();
          const o = e.dataset.mode || "",
            r = isDarkTheme(),
            s = getThemeColors(r),
            a = document.createElement("div");
          a.className = "sg-step-dropdown", a.style.cssText = `\n      position: absolute;\n      top: ${t.offsetTop+t.offsetHeight+4}px;\n      right: 0;\n      min-width: 140px;\n      background: ${s.dropdownBg};\n      border: 1px solid ${s.border};\n      border-radius: 8px;\n      box-shadow: 0 4px 12px rgba(0,0,0,0.15);\n      padding: 4px 0;\n      z-index: 1000;\n      font-size: 13px;\n    `;
          [{
            value: "",
            label: "🔄 No change",
            desc: "Keep current mode"
          }, {
            value: "Fast",
            label: "⚡ Flash-Lite",
            desc: "Fastest answers"
          }, {
            value: "Thinking",
            label: "🧠 Flash",
            desc: "All-around help"
          }, {
            value: "Pro",
            label: "💎 Pro",
            desc: "Advanced math & code"
          }].forEach(t => {
            const n = document.createElement("div");
            n.style.cssText = `\n        padding: 8px 12px;\n        cursor: pointer;\n        display: flex;\n        align-items: center;\n        justify-content: space-between;\n        gap: 8px;\n        background: ${o===t.value?r?"#3c4043":"#e8f0fe":"transparent"};\n        color: ${s.textPrimaryAlt};\n        transition: background 0.15s;\n      `,sgSetSafeHtml(n, `\n        <span>${t.label}</span>\n        ${o===t.value?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;"><path d="M20 6L9 17l-5-5"/></svg>':""}\n      `), n.addEventListener("mouseenter", () => {
              n.style.background = s.hoverBg
            }), n.addEventListener("mouseleave", () => {
              n.style.background = o === t.value ? r ? "#3c4043" : "#e8f0fe" : "transparent"
            }), n.addEventListener("click", () => {
              e.dataset.mode = t.value, M(e), a.remove()
            }), a.appendChild(n)
          }), e.querySelector(".sg-step-actions").appendChild(a);
          const i = e => {
            a.contains(e.target) || e.target === t || (a.remove(), document.removeEventListener("click", i))
          };
          setTimeout(() => document.addEventListener("click", i), 10)
        }(e, s)
    }), s?.addEventListener("mouseenter", () => {
      e.dataset.mode || (s.style.background = "var(--gem-sys-color--surface-container-highest, #dfe3eb)")
    }), s?.addEventListener("mouseleave", () => {
      e.dataset.mode || (s.style.background = "transparent")
    });
    const a = e.querySelector(".sg-step-tool-btn");
    a?.addEventListener("click", t => {
      t.stopPropagation(),
        function(e, t) {
          const n = document.querySelector(".sg-step-dropdown");
          if (n) return void n.remove();
          const o = e.dataset.tool || "",
            r = isDarkTheme(),
            s = getThemeColors(r),
            a = document.createElement("div");
          a.className = "sg-step-dropdown", a.style.cssText = `\n      position: absolute;\n      top: ${t.offsetTop+t.offsetHeight+4}px;\n      right: 0;\n      min-width: 160px;\n      background: ${s.dropdownBg};\n      border: 1px solid ${s.border};\n      border-radius: 8px;\n      box-shadow: 0 4px 12px rgba(0,0,0,0.15);\n      padding: 4px 0;\n      z-index: 1000;\n      font-size: 13px;\n    `;
          [{
            value: "",
            label: "🔧 No change",
            desc: "Keep current tool"
          }, {
            value: "none",
            label: "❌ None",
            desc: "Deselect tool"
          }, {
            value: "deep-research",
            label: "🔬 Deep Research",
            desc: "In-depth analysis"
          }, {
            value: "video",
            label: "🎥 Create Videos",
            desc: "Generate videos"
          }, {
            value: "image",
            label: "🍌 Create Images",
            desc: "Generate images"
          }, {
            value: "canvas",
            label: "📋 Canvas",
            desc: "Visual workspace"
          }, {
            value: "guided-learning",
            label: "📚 Guided Learning",
            desc: "Educational mode"
          }].forEach(t => {
            const n = document.createElement("div");
            n.style.cssText = `\n        padding: 8px 12px;\n        cursor: pointer;\n        display: flex;\n        align-items: center;\n        justify-content: space-between;\n        gap: 8px;\n        background: ${o===t.value?r?"#3c4043":"#e8f0fe":"transparent"};\n        color: ${s.textPrimaryAlt};\n        transition: background 0.15s;\n      `,sgSetSafeHtml(n, `\n        <span>${t.label}</span>\n        ${o===t.value?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;"><path d="M20 6L9 17l-5-5"/></svg>':""}\n      `), n.addEventListener("mouseenter", () => {
              n.style.background = s.hoverBg
            }), n.addEventListener("mouseleave", () => {
              n.style.background = o === t.value ? r ? "#3c4043" : "#e8f0fe" : "transparent"
            }), n.addEventListener("click", () => {
              const n = e.dataset.tool || "";
              e.dataset.tool = t.value, M(e), a.remove(), "deep-research" === t.value && "deep-research" !== n && showChainDeepResearchAutoConfirmNotice()
            }), a.appendChild(n)
          }), e.querySelector(".sg-step-actions").appendChild(a);
          const i = e => {
            a.contains(e.target) || e.target === t || (a.remove(), document.removeEventListener("click", i))
          };
          setTimeout(() => document.addEventListener("click", i), 10)
        }(e, a)
    }), a?.addEventListener("mouseenter", () => {
      e.dataset.tool || (a.style.background = "var(--gem-sys-color--surface-container-highest, #dfe3eb)")
    }), a?.addEventListener("mouseleave", () => {
      e.dataset.tool || (a.style.background = "transparent")
    })
  }

  function M(e) {
    const t = e.querySelector(".sg-step-mode-btn"),
      n = e.querySelector(".sg-step-tool-btn"),
      o = e.dataset.mode || "",
      r = e.dataset.tool || "";
    t && (t.style.background = "transparent", t.style.borderColor = o ? "var(--gem-sys-color--primary, #1a73e8)" : "var(--gem-sys-color--outline-variant, #dce1e9)", t.style.color = o ? "var(--gem-sys-color--primary, #1a73e8)" : "var(--gem-sys-color--on-surface-variant, #575a5a)", t.setAttribute("data-tooltip-fast", C(o)), t.title = o ? `Model: ${o}` : "Switch model before this step"), n && (n.style.background = "transparent", n.style.borderColor = r ? "var(--gem-sys-color--primary, #1a73e8)" : "var(--gem-sys-color--outline-variant, #dce1e9)", n.style.color = r ? "var(--gem-sys-color--primary, #1a73e8)" : "var(--gem-sys-color--on-surface-variant, #575a5a)", n.setAttribute("data-tooltip-fast", A(r)), n.title = r ? `Tool: ${A(r).replace(/[^\w\s]/g,"").trim()}` : "Select tool before this step")
  }

  function I() {
    const e = n.querySelector('.sg-chain-step[data-active="true"]') || n.querySelector(".sg-chain-step"),
      t = n.querySelector("#sg-chain-word-counter"),
      o = n.querySelector("#sg-chain-optimize-btn");
    if (!e || !t) return;
    const r = e.querySelector("textarea"),
      s = countText(r ? r.value : "");
    if (!t.dataset.hoverAttached) {
      const e = getThemeColors(isDarkTheme()),
        n = e.btnBg,
        r = e.hoverBgAlt,
        s = e => {
          e.addEventListener("mouseenter", () => {
            isModalConfirmationMode || isModalOptimizing || (e.style.background = r)
          }), e.addEventListener("mouseleave", () => {
            isModalConfirmationMode || isModalOptimizing || (e.style.background = n)
          })
        };
      s(t), s(o), t.addEventListener("click", e => {
        e.stopPropagation();
        const o = t.querySelector(".sg-chain-counter-details");
        "1" === o.style.opacity ? (o.style.maxWidth = "0", o.style.opacity = "0", o.style.visibility = "hidden", t.style.background = n) : (o.style.maxWidth = "1000px", o.style.opacity = "1", o.style.visibility = "visible", t.style.background = r)
      }), t.dataset.hoverAttached = "true"
    }
    const a = t.querySelector(".sg-chain-counter-summary");
    a && (a.textContent = `${s.words} words / ${s.chars} characters`);
    const i = t.querySelector("#sg-chain-stat-nospace"),
      l = t.querySelector("#sg-chain-stat-sentences"),
      c = t.querySelector("#sg-chain-stat-paragraphs"),
      d = t.querySelector("#sg-chain-stat-lines");
    i && (i.textContent = s.charsNoSpace), l && (l.textContent = s.sentences), c && (c.textContent = s.paragraphs), d && (d.textContent = s.lines);
    const u = () => {
      optimizationShortcutHandler && (document.removeEventListener("keydown", optimizationShortcutHandler, !0), optimizationShortcutHandler = null), isModalConfirmationMode = !1, isModalOptimizing = !1, morphOutOptimizeBtn(o, () => {sgSetSafeHtml(o, '\n            <svg class="sg-optimize-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">\n              <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>\n            </svg>\n            <span class="sg-optimize-label">Optimize</span>\n          ');
        const e = getThemeColors(isDarkTheme());
        o.style.background = e.btnBg, o.style.borderColor = e.border, o.style.color = e.iconText, o.style.padding = "0 12px 0 8px", o.style.pointerEvents = "auto", o.style.boxShadow = "0 1px 3px rgba(0,0,0,0.12)", o.style.height = "32px"
      }), I()
    };
    o && (o.onclick = async t => {
      if (t.preventDefault(), t.stopPropagation(), isModalConfirmationMode) {
        const e = t.target;
        if (e.closest("#sg-modal-optimize-accept")) showToast("Changes accepted", "success"), T = null, u();
        else if (e.closest("#sg-modal-optimize-reject")) {
          const e = T ? T.querySelector("textarea") : r;
          e && (e.value = k, e.dispatchEvent(new Event("input", {
            bubbles: !0
          }))), T = null, showToast("Changes reverted", "info"), u()
        }
        return
      }
      if (isModalOptimizing) return isModalOptimizing = !1, sgSafeSendMessage({
        type: "CANCEL_OPTIMIZATION"
      }), void u();
      const s = r.value.trim();
      if (s) {
        T = e, k = s, isModalOptimizing = !0, enterOptimizeLoadingState(o);
        try {
          const t = parseInt(e.dataset.stepIndex || "0", 10),
            a = Array.from(n.querySelectorAll(".sg-chain-step"));
          let i = null;
          if (t > 0) {
            const e = a.slice(0, t).map((e, t) => {
              const n = e.querySelector("textarea");
              return {
                stepNumber: t + 1,
                prompt: n ? n.value.trim() : ""
              }
            }).filter(e => e.prompt.length > 0);
            e.length > 0 && (i = {
              previousSteps: e,
              currentStepNumber: t + 1
            })
          }
          const l = await sgSafeSendMessage({
            type: "OPTIMIZE_PROMPT",
            prompt: s,
            originalMode: "unknown",
            isFollowUp: t > 0 && null !== i,
            context: i,
            hasVariables: !0,
            isChainStep: !0,
            useAIStudio: void 0 !== useAIStudioForOptimize && useAIStudioForOptimize
          });
          if (!isModalOptimizing) return;
          if (l?.success && l.optimizedPrompt) {
            const e = T ? T.querySelector("textarea") : r;
            e && (e.value = l.optimizedPrompt, e.dispatchEvent(new Event("input", {
              bubbles: !0
            }))), showToast("Step optimized!", "success"), isModalConfirmationMode = !0, isModalOptimizing = !1, o.classList.remove("loading"), o.style.padding = "0", o.style.pointerEvents = "none", o.style.background = "transparent", o.style.borderColor = "transparent", o.style.boxShadow = "none", o.style.height = "auto", o.style.overflow = "visible";
            const t = isDarkTheme(),
              n = `width: 32px; height: 32px; padding: 0; display: flex; align-items: center; justify-content: center; border-radius: 50%; cursor: pointer; box-shadow: 0 1px 2px rgba(0,0,0,0.1); pointer-events: auto; border: 1px solid ${getThemeColors(t).border}; background: ${t?"rgba(32, 33, 36, 0.95)":"white"};`;sgSetSafeHtml(o, `\n                        <div style="display: flex; gap: 8px; align-items: center;">\n                          <div id="sg-modal-optimize-reject" title="Revert" style="${n} transition: background 0.15s ease;">\n                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16">\n                              <path d="M18 6L6 18M6 6l12 12"/>\n                            </svg>\n                          </div>\n                          <div id="sg-modal-optimize-accept" title="Accept" style="${n} transition: background 0.15s ease;">\n                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16">\n                              <path d="M20 6L9 17l-5-5"/>\n                            </svg>\n                          </div>\n                        </div>\n                      `);
            const s = o.querySelector("#sg-modal-optimize-reject"),
              a = o.querySelector("#sg-modal-optimize-accept"),
              i = t ? "rgba(32, 33, 36, 0.95)" : "white",
              c = t ? "#3c4043" : "#e8eaed";
            s && (s.addEventListener("mouseenter", () => s.style.background = c), s.addEventListener("mouseleave", () => s.style.background = i)), a && (a.addEventListener("mouseenter", () => a.style.background = c), a.addEventListener("mouseleave", () => a.style.background = i)), optimizationShortcutHandler = e => {
              isModalConfirmationMode && ("Enter" === e.key ? (e.preventDefault(), e.stopImmediatePropagation(), a?.click()) : "Escape" === e.key && (e.preventDefault(), e.stopImmediatePropagation(), s?.click()))
            }, document.addEventListener("keydown", optimizationShortcutHandler, !0)
          } else showToast("Optimization failed", "error"), u()
        } catch (e) {
          console.error(e), showToast("Optimization error", "error"), u()
        }
      } else showToast("Please enter text to optimize", "info")
    })
  }

  function P() {
    n.querySelectorAll(".sg-chain-step").forEach((e, t) => {
      e.dataset.stepIndex = t;
      const n = e.querySelector(".sg-step-number");
      n && (n.textContent = `Step ${t+1}`)
    })
  }

  function D() {
    const e = n.querySelector("#sg-prompt-search");
    e && (e.value = "", e.focus(), e.addEventListener("input", e => {
      const t = e.target.value.toLowerCase();
      n.querySelectorAll(".sg-prompt-item").forEach(e => {
        const n = e.querySelector("span")?.textContent?.toLowerCase() || "";
        e.style.display = n.includes(t) ? "flex" : "none"
      })
    }));
    const t = () => {
      const e = n.querySelectorAll(".sg-prompt-checkbox:checked").length,
        t = n.querySelector("#sg-delete-prompts-btn");
      t && (e > 0 ? (t.style.opacity = "1", t.style.pointerEvents = "auto", t.style.background = "var(--gem-sys-color--error-container, #f9dedc)", t.style.color = "var(--gem-sys-color--on-error-container, #410e0b)") : (t.style.opacity = "0.5", t.style.pointerEvents = "none", t.style.background = "var(--gem-sys-color--surface-container-high, #e9eef6)", t.style.color = "var(--gem-sys-color--on-surface, #1f1f1f)"))
    };
    t(), n.querySelectorAll(".sg-prompt-checkbox").forEach(e => {
      e.addEventListener("change", t)
    }), n.querySelectorAll(".sg-prompt-item").forEach(e => {
      e.addEventListener("dragstart", t => {
        t.dataTransfer.setData("text/plain", e.dataset.promptId), e.style.opacity = "0.5"
      }), e.addEventListener("dragend", () => {
        e.style.opacity = "1", g = null, m()
      }), e.addEventListener("dragover", t => {
        t.preventDefault();
        const n = e.getBoundingClientRect(),
          o = n.top + n.height / 2,
          r = t.clientY < o ? "top" : "bottom",
          s = e.dataset.promptId;
        g && g.id === s && g.position === r || (g = {
          id: s,
          position: r
        }, m())
      }), e.addEventListener("dragleave", t => {
        const n = e.getBoundingClientRect();
        (t.clientX < n.left || t.clientX >= n.right || t.clientY < n.top || t.clientY >= n.bottom) && (g = null, m())
      }), e.addEventListener("drop", t => {
        t.preventDefault();
        const n = t.dataTransfer.getData("text/plain"),
          o = e.dataset.promptId,
          r = g ? g.position : "bottom";
        n && n !== o && async function(e, t, n) {
          const o = promptsData.prompts.findIndex(t => t.id === e);
          if (-1 === o) return;
          const r = promptsData.prompts[o];
          promptsData.prompts.splice(o, 1);
          const s = promptsData.prompts.findIndex(e => e.id === t);
          if (-1 === s) promptsData.prompts.push(r);
          else {
            const e = "top" === n ? s : s + 1;
            promptsData.prompts.splice(e, 0, r)
          }
          const a = Date.now(),
            i = promptsData.prompts.indexOf(r),
            l = promptsData.prompts[i - 1],
            c = promptsData.prompts[i + 1],
            d = sgComputeNewSortIndex(l && "number" == typeof l.sortIndex ? l.sortIndex : null, c && "number" == typeof c.sortIndex ? c.sortIndex : null);
          null === d ? sgRebalanceSortIndices(promptsData.prompts, a) : (r.sortIndex = d, r.sortIndexAt = a), await savePromptsData(), b()
        }(n, o, r), g = null, m()
      }), e.addEventListener("mouseenter", () => {
        e.style.background = "var(--gem-sys-color--surface-container-highest, #dce1e9)", e.style.borderColor = "var(--gem-sys-color--outline, #c8d0da)";
        const t = e.querySelector(".sg-prompt-options-btn");
        t && (t.style.opacity = "1")
      }), e.addEventListener("mouseleave", () => {
        e.style.background = "transparent", e.style.borderColor = "transparent", e.style.borderBottomColor = "var(--gem-sys-color--outline-variant, #dce1e9)";
        const t = e.querySelector(".sg-prompt-options-btn");
        t && (t.style.opacity = "0")
      }), e.addEventListener("click", t => {
        if (t.target.closest(".sg-prompt-checkbox") || t.target.closest(".sg-prompt-options-btn")) return;
        y(e.dataset.promptId)
      }), e.querySelector(".sg-prompt-options-btn")?.addEventListener("click", t => {
        t.stopPropagation(), showPromptContextMenu(t.currentTarget, e.dataset.promptId)
      }), e.querySelector(".sg-library-use-btn")?.addEventListener("click", t => {
        t.stopPropagation(),
          function(e) {
            const t = promptsData.prompts.find(t => t.id === e);
            if (!t) return;
            const n = sgPromptsModalCaret;
            sgPromptsModalCaret = null, o(), handlePromptVariables(t.text, async e => {
              isCurrentlyGenerating && isQueueingEnabled && t.autosend ? tryEnqueueMessage(`[PROMPT:${t.title}] ` + e) && showToast(`Prompt "${t.title}" added to queue`, "info") : (sgPlaceComposerCaret(n), pastePromptText(e), triggerWordCounterUpdate(), setTimeout(async () => {
                if (t.mode && "none" !== t.mode && (await switchMode(t.mode), t.tool && "none" !== t.tool && await new Promise(e => setTimeout(e, 300))), t.tool && "none" !== t.tool && await selectTool(t.tool), t.autosend) {
                  await new Promise(e => setTimeout(e, 500));
                  const e = document.querySelector(".send-button");
                  e && !e.disabled && e.click()
                }
              }, 300))
            })
          }(e.dataset.promptId)
      })
    })
  }
  D();

  function B() {
    chrome.storage.local.get("hasSeenShowChainsTip", e => {
      if (e.hasSeenShowChainsTip) return;
      if ("list" !== p || "prompts" !== n.dataset.activeTab) return;
      if (document.getElementById("sg-create-prompt-tip")) return;
      const t = n.querySelector("#sg-tab-chains");
      t && 0 !== t.getBoundingClientRect().width && sgShowAnchoredTip({
        id: "sg-show-chains-tip",
        storageKey: "hasSeenShowChainsTip",
        modal: n,
        target: t,
        title: "💡 Try Chains",
        body: "Chains run a sequence of prompts automatically. Open the <strong>Chains</strong> tab to set one up.",
        buttonLabel: "Show Chains",
        onButton: () => t.click()
      })
    })
  }

  function q(e) {
    clearTimeout(n._sgPromptTipTimer), n._sgPromptTipTimer = setTimeout(() => {
      n.isConnected && ("chains" === e ? chrome.storage.local.get("hasSeenCreateChainTip", e => {
        if (e.hasSeenCreateChainTip) return;
        if ("chains-list" !== p || "chains" !== n.dataset.activeTab) return;
        const t = n.querySelector("#sg-add-chain-btn");
        t && 0 !== t.getBoundingClientRect().width && sgShowAnchoredTip({
          id: "sg-create-chain-tip",
          storageKey: "hasSeenCreateChainTip",
          modal: n,
          target: t,
          title: "💡 Create a chain",
          body: "Build a multi-step chain that sends each prompt in turn, waiting for Gemini between steps.",
          buttonLabel: "Add Chain",
          onButton: () => t.click()
        })
      }) : chrome.storage.local.get("hasSeenCreatePromptTip", e => {
        if ("list" !== p || "prompts" !== n.dataset.activeTab) return;
        const t = n.querySelector("#sg-add-prompt-btn");
        t && 0 !== t.getBoundingClientRect().width && (e.hasSeenCreatePromptTip ? B() : sgShowAnchoredTip({
          id: "sg-create-prompt-tip",
          storageKey: "hasSeenCreatePromptTip",
          modal: n,
          target: t,
          title: "💡 Create a prompt",
          body: "Save a reusable prompt template, then insert it into the chat anytime with <code>//</code>.",
          buttonLabel: "Add Prompt",
          onButton: () => t.click(),
          onDismissed: () => setTimeout(B, 250)
        }))
      }))
    }, 500)
  }

  function O() {
    b()
  }
  setupShiftClickSelection(n.querySelector("#sg-prompts-list-container"), ".sg-prompt-checkbox", () => {
    const e = n.querySelectorAll(".sg-prompt-checkbox:checked").length,
      t = n.querySelector("#sg-delete-prompts-btn");
    t && (e > 0 ? (t.style.opacity = "1", t.style.pointerEvents = "auto", t.style.background = "var(--gem-sys-color--error-container, #f9dedc)", t.style.color = "var(--gem-sys-color--on-error-container, #410e0b)") : (t.style.opacity = "0.5", t.style.pointerEvents = "none", t.style.background = "var(--gem-sys-color--surface-container-high, #e9eef6)", t.style.color = "var(--gem-sys-color--on-surface, #1f1f1f)"))
  }), window.sgCurrentPromptsModalSwitcher = y, "chains" === e ? v() : b(), document.addEventListener("sg-refresh-prompts", O);
  let R = null;

  function F() {
    if (n.querySelectorAll(".sg-chain-item").forEach(e => {
        e.style.borderTop = "none", e.style.borderBottom = "1px solid var(--gem-sys-color--outline-variant, #dce1e9)"
      }), R) {
      const e = n.querySelector(`.sg-chain-item[data-chain-id="${R.id}"]`);
      e && ("top" === R.position ? e.style.borderTop = "3px solid var(--gem-sys-color--primary, #1a73e8)" : e.style.borderBottom = "3px solid var(--gem-sys-color--primary, #1a73e8)")
    }
  }
}

function showPromptContextMenu(e, t) {
  document.querySelectorAll(".sg-context-menu").forEach(e => e.remove());
  const n = document.createElement("div");
  n.className = "sg-context-menu",sgSetSafeHtml(n, '\n    <button class="sg-context-item" data-action="use" style="color: var(--gem-sys-color--primary, #1a73e8);">\n      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">\n        <path d="M12 19l7-7-7-7M5 12h14"/>\n      </svg>\n      Use (Paste)\n    </button>\n    <button class="sg-context-item" data-action="edit">\n      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">\n        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>\n        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>\n      </svg>\n      Edit Prompt\n    </button>\n    <button class="sg-context-item sg-context-item-danger" data-action="delete">\n      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">\n        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>\n      </svg>\n      Delete\n    </button>\n  '), document.body.appendChild(n);
  const o = e.getBoundingClientRect();
  n.style.top = o.bottom + 4 + "px", n.style.left = o.left - 120 + "px", requestAnimationFrame(() => n.classList.add("show")), n.querySelector('[data-action="use"]').addEventListener("click", () => {
    n.remove();
    const e = promptsData.prompts.find(e => e.id === t);
    e && handlePromptVariables(e.text, async t => {
      if (isCurrentlyGenerating && isQueueingEnabled && e.autosend) {
        tryEnqueueMessage(`[PROMPT:${e.title}] ` + t) && showToast(`Prompt "${e.title}" added to queue`, "info")
      } else pastePromptText(t), setTimeout(async () => {
        if (e.mode && "none" !== e.mode && (await switchMode(e.mode), e.tool && "none" !== e.tool && await new Promise(e => setTimeout(e, 300))), e.tool && "none" !== e.tool && await selectTool(e.tool), e.autosend) {
          await new Promise(e => setTimeout(e, 500));
          const e = document.querySelector(".send-button");
          e && !e.disabled && e.click()
        }
      }, 300);
      const n = document.querySelector(".sg-folders-modal");
      n && (n.style.opacity = "0", setTimeout(() => n.remove(), 200));
      const o = document.querySelector(".sg-modal-overlay");
      if (o) {
        const e = o.querySelector(".sg-modal-title")?.textContent;
        "Prompt Library" !== e && "Your Prompts" !== e || (o.classList.remove("sg-show"), setTimeout(() => o.remove(), 200))
      }
    })
  }), n.querySelector('[data-action="edit"]').addEventListener("click", () => {
    n.remove();
    document.querySelector(".sg-folders-modal") && window.sgCurrentPromptsModalSwitcher && window.sgCurrentPromptsModalSwitcher(t)
  }), n.querySelector('[data-action="delete"]').addEventListener("click", async () => {
    n.remove(), showConfirmationModal("Delete Prompt", "Delete this prompt?", async () => {
      tombstonePrompts([t]), promptsData.prompts = promptsData.prompts.filter(e => e.id !== t), await savePromptsData(), document.dispatchEvent(new CustomEvent("sg-refresh-prompts")), showToast("Prompt deleted", "success")
    })
  });
  const r = t => {
    n.contains(t.target) || t.target === e || (n.remove(), document.removeEventListener("click", r))
  };
  setTimeout(() => document.addEventListener("click", r), 10)
}
async function showFolderChatsModal(e) {
  const t = await sgSyncGetCached(["trashcanEnabled", "foldersEnabled"]);
  foldersData.trashcanEnabled = !1 !== t.trashcanEnabled && !1 !== t.foldersEnabled;
  const n = foldersData.folders.find(t => t.id === e);
  if (!n) return;
  n.chats || (n.chats = []);
  let o = !1;
  n.chats.forEach(e => {
    const t = document.querySelector(`a[href*="${e.id}"]`);
    if (t) {
      const n = t.querySelector("p, span, .conversation-title");
      if (n) {
        const t = n.textContent?.trim();
        t && t !== e.title && (e.title = t, o = !0)
      }
    }
  }), o && await saveFoldersData();
  let r = "";
  if (0 === n.chats.length) r = "\n      <div class=\"sg-empty-chats sg-empty-state\">\n        <p>No chats in this folder yet.<br>Use the 'Add current chat' button, or the 3-dots menu on any folder to add it here.</p>\n      </div>\n    ";
  else {
    r = `\n      <div class="sg-chats-list" style="display: flex; flex-direction: column;">\n        ${[...n.chats].sort((e,t)=>e.pinned&&!t.pinned?-1:!e.pinned&&t.pinned?1:(e.title||"").localeCompare(t.title||"")).map(e=>{const cid=escapeHtml(String(e.id||"")),curl=escapeHtml(String(e.url||""));return`\n          <div class="sg-chat-item" data-chat-id="${cid}" data-chat-url="${curl}" style="\n            display: flex;\n            align-items: center;\n            padding: 11px 24px 11px 64px;\n            background: transparent;\n            border-radius: 8px !important; /* Force rounded corners */\n            cursor: pointer;\n            transition: background 0.1s;\n            user-select: none;\n            margin: 0 8px;\n            border-bottom: 1px solid var(--gem-sys-color--outline-variant, #dce1e9);\n            font-family: var(--sg-font-text);\n          ">\n            <input type="checkbox" class="sg-chat-checkbox" data-chat-id="${cid}" style="\n              width: 30px;\n              height: 30px;\n              min-width: 30px;\n              min-height: 30px;\n              flex-shrink: 0;\n              margin: 0;\n              margin-right: 18px;\n              cursor: pointer;\n              accent-color: #4285f4;\n            ">\n\n            <div class="sg-chat-content" style="flex: 1; display: flex; align-items: center; gap: 12px; min-width: 0;">\n              <svg class="sg-chat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 20px; height: 20px; color: var(--gem-sys-color--on-surface-variant, #575a5a); flex-shrink: 0;">\n                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>\n              </svg>\n              <span class="sg-chat-name" style="\n                font-size: 16px; \n                color: var(--gem-sys-color--on-surface, #1f1f1f); \n                font-weight: 500; \n                white-space: nowrap; \n                overflow: hidden; \n                text-overflow: ellipsis;\n              ">${escapeHtml(e.title)}</span>\n            </div>\n${sgBookmarkIndicatorHtml(e.id)}\n            <button class="sg-chat-pin-btn" data-chat-id="${cid}" title="${e.pinned?"Unpin":"Pin"}" style="\n              width: 32px;\n              height: 32px;\n              display: flex;\n              align-items: center;\n              justify-content: center;\n              background: transparent;\n              border: none;\n              border-radius: 50%;\n              color: ${e.pinned?"#4285f4":"var(--gem-sys-color--on-surface-variant, #575a5a)"};\n              cursor: pointer;\n              transition: all 0.2s;\n              margin-left: 8px;\n            ">\n              <svg viewBox="0 0 24 24" fill="${e.pinned?"currentColor":"none"}" stroke="currentColor" stroke-width="2" style="width: 20px; height: 20px;">\n                <path d="M16 11V5l1-1c.55 0 1-.45 1-1S17.55 2 17 2H7c-.55 0-1 .45-1 1s.45 1 1 1l1 1v6c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z"/>\n              </svg>\n            </button>\n\n            <button class="sg-chat-remove-btn" data-chat-id="${cid}" title="Remove from folder" style="\n              width: 32px;\n              height: 32px;\n              display: flex;\n              align-items: center;\n              justify-content: center;\n              background: transparent;\n              border: none;\n              border-radius: 50%;\n              color: var(--gem-sys-color--on-surface-variant, #575a5a);\n              cursor: pointer;\n              transition: all 0.2s;\n              margin-left: 0;\n            ">\n              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 20px; height: 20px;">\n                <path d="M18 6L6 18M6 6l12 12"/>\n              </svg>\n            </button>\n          </div>\n        `}).join("")}\n      </div>\n    `
  }
  const s = createModal("", "", []),
    a = s.querySelector(".sg-modal-container");
  a && (a.style.width = "90%", a.style.maxWidth = "900px", a.style.height = "67.5vh", a.style.display = "flex", a.style.flexDirection = "column", a.style.padding = "0", a.style.background = "var(--gem-sys-color--surface, #f0f4f8)", a.style.overflow = "hidden",sgSetSafeHtml(a, `\n      \x3c!-- Header --\x3e\n      <div style="\n        display: flex;\n        align-items: center;\n        justify-content: space-between;\n        padding: 13px 32px;\n        border-bottom: 1px solid var(--gem-sys-color--outline-variant, #dce1e9);\n        background: var(--gem-sys-color--surface, #f0f4f8);\n        flex-shrink: 0;\n      ">\n        <div style="display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0;">\n          <button id="sg-back-arrow-btn" style="\n            display: flex;\n            align-items: center;\n            justify-content: center;\n            width: 44px;\n            height: 44px;\n            background: transparent;\n            border: none;\n            border-radius: 50%;\n            color: var(--gem-sys-color--on-surface-variant, #575a5a);\n            cursor: pointer;\n            flex-shrink: 0;\n            transition: background 0.15s ease;\n            margin-left: -8px;\n          ">\n            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 24px; height: 24px;">\n              <path d="M15 18l-6-6 6-6"/>\n            </svg>\n          </button>\n          \n          <h2 style="font-family: var(--sg-font-flex); font-size: 20px; font-weight: 500; color: var(--gem-sys-color--on-surface, #575a5a); margin: 0; overflow: hidden; text-overflow: ellipsis; margin-right: 16px;">${escapeHtml(n.name)}</h2>\n\n          <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">\n            <button id="sg-add-multi-chats-btn" style="\n              display: flex;\n              align-items: center;\n              gap: 8px;\n              padding: 0 18px;\n              height: 38px;\n              background: var(--gem-sys-color--surface-container-high, #e9eef6);\n              border: none;\n              border-radius: 20px;\n              color: var(--gem-sys-color--on-surface, #1f1f1f);\n              font-size: 13px;\n              font-weight: 500;\n              cursor: pointer;\n              transition: all 0.15s ease;\n            ">\n              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;">\n                <path d="M12 5v14M5 12h14"/>\n              </svg>\n              Add chats\n            </button>\n\n            <button id="sg-remove-selected-chats-btn" style="\n              display: flex;\n              align-items: center;\n              gap: 8px;\n              padding: 0 18px;\n              height: 38px;\n              background: var(--gem-sys-color--surface-container-high, #e9eef6);\n              border: none;\n              border-radius: 20px;\n              color: var(--gem-sys-color--on-surface, #1f1f1f);\n              font-size: 13px;\n              font-weight: 500;\n              cursor: pointer;\n              transition: all 0.15s ease;\n              opacity: 0.5;\n              pointer-events: none;\n            ">\n              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;">\n                <path d="M15 12H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>\n              </svg>\n              Remove from Folder\n            </button>\n\n            <button id="sg-delete-selected-chats-btn" style="\n              display: flex;\n              align-items: center;\n              gap: 8px;\n              padding: 0 18px;\n              height: 38px;\n              background: var(--gem-sys-color--surface-container-high, #e9eef6);\n              border: none;\n              border-radius: 20px;\n              color: var(--gem-sys-color--on-surface, #1f1f1f);\n              font-size: 13px;\n              font-weight: 500;\n              cursor: pointer;\n              transition: all 0.15s ease;\n              opacity: 0.5;\n              pointer-events: none;\n            ">\n              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;">\n                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>\n              </svg>\n              Remove Selected\n            </button>\n          </div>\n\n          \x3c!-- Spacer to push everything else to the right --\x3e\n          <div style="flex: 1;"></div>\n        </div>\n        \n        <div style="display: flex; align-items: center; gap: 20px; margin-left: 20px;">\n          <span style="font-family: var(--sg-font-text); font-size: 16px; color: var(--gem-sys-color--on-surface-variant, #575a5a); opacity: 0.7; white-space: nowrap; flex-shrink: 0;">\n            (${(n.chats||[]).length} ${1===(n.chats||[]).length?"chat":"chats"})\n          </span>\n\n          <button class="sg-close-modal-btn" style="\n              width: 36px;\n              height: 36px;\n              background: transparent;\n              border: none;\n              border-radius: 50%;\n              color: var(--gem-sys-color--on-surface-variant, #575a5a);\n              cursor: pointer;\n              display: flex;\n              align-items: center;\n              justify-content: center;\n              transition: all 0.15s ease;\n          ">\n            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 20px; height: 20px;">\n              <path d="M18 6L6 18M6 6l12 12"/>\n            </svg>\n          </button>\n        </div>\n      </div>\n\n      \x3c!-- Toolbar --\x3e\n      <div style="\n          display: flex;\n          align-items: center;\n          gap: 12px;\n          padding: 12px 32px;\n          border-bottom: 1px solid var(--gem-sys-color--outline-variant, #dce1e9);\n          background: var(--gem-sys-color--surface, #f0f4f8);\n          flex-shrink: 0;\n      ">\n        <div style="\n            flex: 1;\n            display: flex;\n            align-items: center;\n            gap: 8px;\n            padding: 14px 14px;\n            background: var(--gem-sys-color--surface-container-high, #e9eef6);\n            border-radius: 20px;\n            border: 1px solid var(--gem-sys-color--outline, #dce1e9);\n        ">\n          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px; color: var(--gem-sys-color--on-surface-variant, #575a5a);">\n             <circle cx="11" cy="11" r="8"/>\n             <path d="M21 21l-4.35-4.35"/>\n          </svg>\n          <input type="text" id="sg-folder-chat-search" placeholder="Search chats in this folder..." style="\n              flex: 1;\n              background: transparent;\n              border: none;\n              outline: none;\n              color: var(--gem-sys-color--on-surface, #1f1f1f);\n              font-size: 13px;\n          ">\n        </div>\n        \x3c!-- Select All Checkbox --\x3e\n        <label style="\n            display: flex;\n            align-items: center;\n            gap: 8px;\n            cursor: pointer;\n            user-select: none;\n            flex-shrink: 0;\n            padding: 8px 12px;\n            border-radius: 8px;\n            transition: background 0.15s;\n        " id="sg-select-all-label">\n          <input type="checkbox" id="sg-select-all-chats" style="\n            width: 20px;\n            height: 20px;\n            cursor: pointer;\n            accent-color: #4285f4;\n          ">\n          <span style="\n            font-family: var(--sg-font-text);\n            font-size: 13px;\n            font-weight: 500;\n            color: var(--gem-sys-color--on-surface, #1f1f1f);\n            white-space: nowrap;\n          ">Select All</span>\n        </label>\n      </div>\n\n      \x3c!-- Content --\x3e\n      <div class="sg-modal-body" style="flex: 1; overflow-y: auto; padding: 2px 0 0 0;">\n         <div class="sg-chat-list" style="display: flex; flex-direction: column;">\n           ${r}\n         </div>\n      </div>\n    `)), document.body.appendChild(s), requestAnimationFrame(() => s.classList.add("show")), setTimeout(() => s.querySelector("#sg-folder-chat-search")?.focus(), 50);
  const i = s.querySelector(".sg-close-modal-btn");
  i && (i.addEventListener("click", () => {
    closeModal(s)
  }), i.addEventListener("mouseenter", () => {
    i.style.background = "var(--gem-sys-color--surface-container-highest, #dce1e9)"
  }), i.addEventListener("mouseleave", () => {
    i.style.background = "transparent"
  }));
  const l = s.querySelector("#sg-add-multi-chats-btn");
  l && (l.addEventListener("click", () => {
    closeModal(s), showAddChatsModal(e)
  }), l.addEventListener("mouseenter", () => {
    l.style.background = "var(--gem-sys-color--surface-container-highest, #e1e3e1)"
  }), l.addEventListener("mouseleave", () => {
    l.style.background = "var(--gem-sys-color--surface-container-high, #e9eef6)"
  }));
  let c = null,
    d = null,
    u = null;
  const p = (e = !1) => {
    if (u && (u.disconnect(), u = null), !c) return;
    sgUnregisterAnchoredTip(c), c.style.animation = "sg-onboarding-fade-in 0.2s ease-out reverse";
    const t = c,
      n = d;
    c = null, d = null, setTimeout(() => {
      t.remove(), n && window.removeEventListener("resize", n)
    }, 200), e && chrome.storage.local.set({
      hasSeenAddChatsTip: !0
    })
  };
  l && chrome.storage.local.get("hasSeenAddChatsTip", e => {
    e.hasSeenAddChatsTip || setTimeout(() => {
      if (!s.isConnected) return;
      if (document.getElementById("sg-add-chats-tip")) return;
      const e = document.createElement("div");

      function t() {
        const t = l.getBoundingClientRect();
        e.style.top = `${t.bottom+14}px`, e.style.left = t.left + t.width / 2 - e.offsetWidth / 2 + "px"
      }
      e.id = "sg-add-chats-tip", e.className = "sg-onboarding-popup",sgSetSafeHtml(e, '\n          <div class="sg-onboarding-popup-content" style="max-width: 250px; padding: 16px;">\n            <div class="sg-onboarding-popup-arrow sg-onboarding-popup-arrow-up"></div>\n            <button id="sg-add-chats-tip-close" class="sg-onboarding-popup-close" aria-label="Close">\n              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">\n                <path d="M18 6L6 18M6 6l12 12"/>\n              </svg>\n            </button>\n            <h3 class="sg-onboarding-popup-title" style="font-size: 14px; margin-bottom: 6px;">💡 Add chats to this folder</h3>\n            <p class="sg-onboarding-popup-message" style="margin-bottom: 12px;">Put existing conversations into this folder.</p>\n            <button class="sg-onboarding-popup-button" id="sg-add-chats-tip-ok" style="padding: 8px 16px; font-size: 13px;">Add chats</button>\n          </div>\n        '), e.style.zIndex = "10001", c = e, document.body.appendChild(e), sgRegisterAnchoredTip(e, s, p), t(), window.addEventListener("resize", t), d = t, e.querySelector("#sg-add-chats-tip-close").addEventListener("click", () => p(!0)), e.querySelector("#sg-add-chats-tip-ok").addEventListener("click", () => {
        p(!0), l.click()
      }), l.addEventListener("click", () => p(!0), {
        once: !0
      }), u = new MutationObserver(() => {
        s.isConnected || p(!1)
      }), u.observe(document.body, {
        childList: !0
      })
    }, 500)
  });
  const g = s.querySelector("#sg-remove-selected-chats-btn"),
    m = s.querySelector("#sg-delete-selected-chats-btn"),
    h = () => {
      const e = s.querySelectorAll(".sg-chat-checkbox:checked").length;
      g && (e > 0 ? (g.style.opacity = "1", g.style.pointerEvents = "auto",sgSetSafeHtml(g, `\n          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;">\n            <path d="M15 12H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>\n          </svg>\n          Remove from Folder (${e})\n        `)) : (g.style.opacity = "0.5", g.style.pointerEvents = "none",sgSetSafeHtml(g, '\n          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;">\n            <path d="M15 12H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>\n          </svg>\n          Remove from Folder\n        '))), m && (e > 0 ? (m.style.opacity = "1", m.style.pointerEvents = "auto", m.style.background = "var(--gem-sys-color--error-container, #ffdad6)", m.style.color = "var(--gem-sys-color--on-error-container, #410002)",sgSetSafeHtml(m, `\n          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;">\n            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>\n          </svg>\n          Remove Selected (${e})\n        `)) : (m.style.opacity = "0.5", m.style.pointerEvents = "none", m.style.background = "var(--gem-sys-color--surface-container-high, #e9eef6)", m.style.color = "var(--gem-sys-color--on-surface, #1f1f1f)",sgSetSafeHtml(m, '\n          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;">\n            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>\n          </svg>\n          Remove Selected\n        ')))
    };
  g && (g.addEventListener("mouseenter", () => {
    "1" === g.style.opacity && (g.style.background = "var(--gem-sys-color--surface-container-highest, #dce1e9)")
  }), g.addEventListener("mouseleave", () => {
    "1" === g.style.opacity && (g.style.background = "var(--gem-sys-color--surface-container-high, #e9eef6)")
  }), g.addEventListener("click", async () => {
    const t = s.querySelectorAll(".sg-chat-checkbox:checked"),
      o = Array.from(t).map(e => e.dataset.chatId);
    0 !== o.length && showConfirmationModal("Remove Chats", `<p style="color: var(--sg-on-surface-variant); margin: 0;">Remove ${o.length} selected chat(s) from this folder?</p>`, async () => {
      const t = new Set(o);
      n.chats = n.chats.filter(e => !t.has(e.id)), Array.isArray(n.removedChats) || (n.removedChats = []), n.removedChats = n.removedChats.filter(e => e && !t.has(e.chatId));
      const r = Date.now();
      for (const e of o) n.removedChats.push({
        chatId: e,
        removedAt: r
      });
      n.lastModified = r, await saveFoldersData(), showToast(`Removed ${o.length} chat(s)`, "success"), closeModal(s), showFolderChatsModal(e)
    }, "Remove")
  })), m && (m.addEventListener("mouseenter", () => {
    "1" === m.style.opacity && (m.style.background = "var(--gem-sys-color--error, #b3261e)", m.style.color = "var(--gem-sys-color--on-error, white)")
  }), m.addEventListener("mouseleave", () => {
    "1" === m.style.opacity && (m.style.background = "var(--gem-sys-color--error-container, #ffdad6)", m.style.color = "var(--gem-sys-color--on-error-container, #410002)")
  }), m.addEventListener("click", async () => {
    const t = s.querySelectorAll(".sg-chat-checkbox:checked"),
      o = Array.from(t).map(e => e.dataset.chatId);
    if (0 === o.length) return;
    !1 !== foldersData.trashcanEnabled ? showConfirmationModal("Move to Trash", `Move ${o.length} chat(s) to Trash?`, async () => {
      let t = 0;
      for (const e of o) {
        const o = n.chats.find(t => t.id === e);
        o && (await recycleChat(e, o.title, !0), t++)
      }
      await saveFoldersData(), showToast(`${t} chat(s) moved to Trash`, "success"), closeModal(s), showFolderChatsModal(e)
    }, "Move to Trash") : showConfirmationModal("Delete Permanently?", `<p style="color: var(--sg-on-surface-variant); margin: 0;">\n                  Permanently delete ${o.length} chat(s)? This cannot be undone.\n                  <br><br>⚠️ Permanently deletes chats from Google's servers\n                </p>`, async () => {
      let t = 0;
      for (const e of o) try {
        await permanentlyDeleteChatFromBin(e, !0), t++
      } catch (t) {
        console.error("Failed to permanently delete:", e, t)
      }
      n.chats = n.chats.filter(e => !o.includes(e.id)), n.lastModified = Date.now(), await saveFoldersData(), showToast(`Permanently deleted ${t} chat(s)`, "success"), closeModal(s), showFolderChatsModal(e)
    }, "Delete")
  })), s.querySelectorAll(".sg-chat-checkbox").forEach(e => {
    e.addEventListener("change", h)
  });
  const f = () => document.removeEventListener("keydown", b, !0),
    y = () => {
      f(), closeModal(s), showFoldersModal()
    },
    b = e => {
      "Escape" === e.key && (s.isConnected ? (e.stopImmediatePropagation(), y()) : f())
    };
  document.addEventListener("keydown", b, !0), sgOnModalClose(s, f);
  const v = s.querySelector("#sg-back-arrow-btn");
  v && (v.addEventListener("click", y), v.addEventListener("mouseenter", () => {
    v.style.background = "var(--gem-sys-color--surface-container-highest, #dce1e9)"
  }), v.addEventListener("mouseleave", () => {
    v.style.background = "transparent"
  }));
  const x = s.querySelector("#sg-folder-chat-search");
  x && (x.focus(), x.addEventListener("input", e => {
    const t = e.target.value.toLowerCase();
    s.querySelectorAll(".sg-chat-item").forEach(e => {
      (e.querySelector(".sg-chat-name")?.textContent?.toLowerCase() || "").includes(t) ? e.style.display = "flex" : e.style.display = "none"
    }), E()
  }));
  const w = s.querySelector("#sg-select-all-chats"),
    S = s.querySelector("#sg-select-all-label"),
    E = () => {
      if (!w) return;
      const e = s.querySelectorAll('.sg-chat-item:not([style*="display: none"]) .sg-chat-checkbox'),
        t = s.querySelectorAll('.sg-chat-item:not([style*="display: none"]) .sg-chat-checkbox:checked').length,
        n = e.length;
      0 === n || 0 === t ? (w.checked = !1, w.indeterminate = !1) : t === n ? (w.checked = !0, w.indeterminate = !1) : (w.checked = !1, w.indeterminate = !0)
    };
  w && (w.addEventListener("change", () => {
    const e = w.checked;
    s.querySelectorAll('.sg-chat-item:not([style*="display: none"]) .sg-chat-checkbox').forEach(t => {
      t.checked = e
    }), h()
  }), S && (S.addEventListener("mouseenter", () => {
    S.style.background = "var(--gem-sys-color--surface-container-high, #e9eef6)"
  }), S.addEventListener("mouseleave", () => {
    S.style.background = "transparent"
  }))), s.querySelectorAll(".sg-chat-checkbox").forEach(e => {
    e.addEventListener("change", () => {
      E(), h()
    })
  });
  setupShiftClickSelection(s.querySelector(".sg-modal-body"), ".sg-chat-checkbox", () => {
    E(), h()
  }), s.querySelectorAll(".sg-chat-item").forEach(e => {
    e.addEventListener("mouseenter", () => {
      e.style.background = "var(--gem-sys-color--surface-container-highest, #dce1e9)"
    }), e.addEventListener("mouseleave", () => {
      e.style.background = "transparent"
    }), e.addEventListener("click", t => {
      if (!t.target.closest(".sg-chat-remove-btn") && !t.target.closest(".sg-chat-checkbox") && !t.target.closest(".sg-chat-pin-btn")) {
        const t = e.dataset.chatUrl;
        t && "undefined" !== t && t.includes("/app/") ? (closeModal(s), sgOpenChatReliably(t, e.dataset.chatId)) : showToast("Chat URL not available", "error")
      }
    })
  }), s.querySelectorAll(".sg-chat-pin-btn").forEach(t => {
    t.addEventListener("mouseenter", () => {
      t.style.background = "#c4c9d1"
    }), t.addEventListener("mouseleave", () => {
      t.style.background = "transparent"
    }), t.addEventListener("click", async o => {
      o.stopPropagation();
      const r = t.dataset.chatId,
        a = n.chats.find(e => e.id === r);
      a && (a.pinned = !a.pinned, n.lastModified = Date.now(), await saveFoldersData(), closeModal(s), showFolderChatsModal(e))
    })
  }), s.querySelectorAll(".sg-chat-remove-btn").forEach(t => {
    t.addEventListener("mouseenter", () => {
      t.style.background = "#c4c9d1"
    }), t.addEventListener("mouseleave", () => {
      t.style.background = "transparent"
    }), t.addEventListener("click", async n => {
      n.stopPropagation();
      const o = t.dataset.chatId;
      await removeChatFromFolder(e, o), closeModal(s), showFolderChatsModal(e)
    })
  })
}

function showFolderContextMenu(e, t) {
  document.querySelectorAll(".sg-context-menu").forEach(e => e.remove());
  const n = document.createElement("div");
  n.className = "sg-context-menu",sgSetSafeHtml(n, '\n    <button class="sg-context-item sg-context-item-primary" data-action="add-chat">\n      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">\n        <path d="M12 5v14M5 12h14"/>\n      </svg>\n      Add current chat\n    </button>\n    <button class="sg-context-item" data-action="add-multi-chats">\n      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">\n        <path d="M12 5v14M5 12h14"/>\n      </svg>\n      Add multiple chats...\n    </button>\n    <button class="sg-context-item" data-action="new-subfolder">\n      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">\n        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>\n        <line x1="12" y1="11" x2="12" y2="17"/>\n        <line x1="9" y1="14" x2="15" y2="14"/>\n      </svg>\n      New subfolder\n    </button>\n    <div class="sg-context-divider" style="height: 1px; background: #3c3c3c; margin: 4px 0;"></div>\n    <button class="sg-context-item" data-action="rename">\n      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">\n        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>\n        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>\n      </svg>\n      Rename\n    </button>\n    <button class="sg-context-item sg-context-item-danger" data-action="delete">\n      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">\n        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>\n      </svg>\n      Delete\n    </button>\n  '), document.body.appendChild(n);
  const o = e.getBoundingClientRect();
  n.style.top = o.bottom + 4 + "px", n.style.left = o.left - 100 + "px", requestAnimationFrame(() => n.classList.add("show")), n.querySelector('[data-action="add-chat"]').addEventListener("click", () => {
    n.remove();
    const e = findActiveChatInfo();
    e ? addChatToFolder(t, e.id, e.title, e.url) : showToast("Open a chat first to add it to this folder", "info")
  }), n.querySelector('[data-action="add-multi-chats"]').addEventListener("click", () => {
    n.remove();
    const e = document.querySelector(".sg-folders-modal");
    e && e.remove(), showAddChatsModal(t)
  }), n.querySelector('[data-action="new-subfolder"]').addEventListener("click", () => {
    n.remove();
    if (getFolderDepth(t) >= 10) return void showToast("Maximum folder depth (10) reached", "error");
    const e = document.querySelector(".sg-modal-overlay");
    e && e.remove(), showCreateFolderModal(t)
  }), n.querySelector('[data-action="rename"]').addEventListener("click", () => {
    n.remove();
    const e = document.querySelector(".sg-modal-overlay");
    e && e.remove(), showRenameFolderModal(t)
  }), n.querySelector('[data-action="delete"]').addEventListener("click", () => {
    n.remove();
    document.querySelector(".sg-modal-overlay");
    showDeleteFolderModal(t)
  }), setTimeout(() => {
    document.addEventListener("click", function e(t) {
      n.contains(t.target) || (n.classList.remove("show"), setTimeout(() => n.remove(), 150), document.removeEventListener("click", e))
    })
  }, 50)
}

function showAddToFolderMenu(e, t, n, o) {
  if (document.querySelectorAll(".sg-context-menu").forEach(e => e.remove()), 0 === foldersData.folders.length) return void showToast("Create a folder first", "info");
  document.querySelector(".cdk-overlay-pane, mat-menu-panel, .mat-mdc-menu-panel") && document.dispatchEvent(new KeyboardEvent("keydown", {
    key: "Escape",
    bubbles: !0
  })), setTimeout(() => {
    const e = new Set;
    foldersData.folders.forEach(n => {
      n.chats && n.chats.some(e => e.id === t) && e.add(n.id)
    });
    const r = new Set(e),
      s = () => foldersData.folders.map(e => (e => {
        const t = r.has(e.id),
          n = t ? "background: var(--sg-surface-hover); font-weight: 500;" : "";
        return `\n        <button class="sg-folder-select-item" data-folder-id="${escapeHtml(String(e.id || ""))}" data-in-folder="${t}" style="${n}">\n          ${t?'\n            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="width: 18px; height: 18px; flex-shrink: 0; color: var(--sg-primary);">\n              <path d="M20 6L9 17l-5-5"/>\n            </svg>\n          ':'\n             <div style="width: 18px; height: 18px; border: 2px solid var(--sg-outline); border-radius: 4px; box-sizing: border-box;"></div>\n          '}\n          \n          <span style="flex: 1; margin-left: 8px;">${escapeHtml(e.name)}</span>\n          <span style="font-size: 12px; opacity: 0.7;">${(e.chats||[]).length}</span>\n        </button>\n      `
      })(e)).join(""),
      a = createModal("Add to Folder", `\n      <div style="margin-bottom: 12px; font-family: var(--sg-font-text); font-size: 13px; color: var(--sg-on-surface-variant);">\n        Manage folders for: <strong style="color: var(--sg-on-surface);">${escapeHtml(n)}</strong>\n      </div>\n      <div class="sg-folder-select-list" id="sg-folder-select-list" style="display: flex; flex-direction: column; gap: 4px;">\n        ${s()}\n      </div>\n    `, [{
        text: "Done",
        class: "sg-btn sg-btn-gray",
        action: "save"
      }]);
    document.body.appendChild(a), a.style.zIndex = "1000002", requestAnimationFrame(() => a.classList.add("show"));
    const i = () => {
        a.querySelectorAll(".sg-folder-select-item").forEach(e => {
          e.addEventListener("click", t => {
            t.preventDefault(), t.stopPropagation();
            const n = e.dataset.folderId;
            r.has(n) ? r.delete(n) : r.add(n), (() => {
              const e = a.querySelector("#sg-folder-select-list");
              e && (sgSetSafeHtml(e, s()), i())
            })()
          })
        })
      },
      l = a.querySelector('[data-action="save"]');
    l && l.addEventListener("click", async () => {
      l.disabled = !0, l.style.opacity = "0.7", l.textContent = "Saving...";
      const s = [...r].filter(t => !e.has(t)),
        i = [...e].filter(e => !r.has(e));
      for (const e of i) await removeChatFromFolder(e, t);
      for (const e of s) await addChatToFolder(e, t, n, o);
      (s.length > 0 || i.length > 0) && showToast("Folder changes saved", "success"), closeModal(a)
    }), i()
  }, 50)
}

function showConfirmationModal(e, t, n, o = "Delete") {
  const r = createModal(e, `\n    <div style="padding: 10px 0; color: var(--gem-sys-color--on-surface-variant, #575a5a); font-size: 14px; line-height: 1.5; font-family: var(--sg-font-text);">\n      ${t}\n    </div>\n  `, [{
    text: "Cancel",
    class: "sg-btn sg-btn-gray",
    action: "close"
  }, {
    text: o,
    class: "sg-btn sg-btn-gray",
    action: "confirm"
  }]);
  document.body.appendChild(r), r.style.zIndex = "1000002", requestAnimationFrame(() => r.classList.add("show"));
  r.querySelector('[data-action="confirm"]').addEventListener("click", () => {
    n(), closeModal(r)
  })
}

function createModalOverlay(e = {}) {
  const {
    id: t = null,
    zIndex: n = null,
    onClose: o = null,
    onEsc: r = null,
    returnFocusTo: prevFocusOpt = null
  } = e, s = document.createElement("div");
  s.className = "sg-modal-overlay", t && (s.id = t), n && (s.style.zIndex = n);
  try {
    s._sgPrevFocus = prevFocusOpt || document.activeElement
  } catch (e) {}
  const a = closeOpts => {
    o && o(), closeModal(s, closeOpts)
  };
  let i = !1;
  s.addEventListener("mousedown", e => {
    i = e.target === s
  }), s.addEventListener("click", e => {
    e.target === s && i && a()
  });
  const l = e => {
    "Escape" === e.key && modalStack[modalStack.length - 1] === s && (r ? r(e, a) : (e.preventDefault(), e.stopImmediatePropagation(), a()))
  };
  return document.addEventListener("keydown", l, !0), s._sgEscHandler = l, s._sgClose = a, modalStack.push(s), {
    overlay: s,
    close: a
  }
}

function createModal(e, t, n) {
  const o = document.createElement("div");
  try {
    o._sgPrevFocus = document.activeElement
  } catch (e) {}
  o.className = "sg-modal-overlay",sgSetSafeHtml(o, `\n    <div class="sg-modal-container" role="dialog" aria-modal="true">\n      <div class="sg-modal-header">\n        <h3 class="sg-modal-title">${e}</h3>\n        <button class="sg-modal-close" data-action="close">\n          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">\n            <path d="M18 6L6 18M6 6l12 12"/>\n          </svg>\n        </button>\n      </div>\n      <div class="sg-modal-body">${t}</div>\n      ${n&&n.length?`\n        <div class="sg-modal-footer">\n          ${n.map(e=>`\n            <button class="${e.class}" data-action="${e.action}">${e.text}</button>\n          `).join("")}\n        </div>\n      `:""}\n    </div>\n  `), o.querySelectorAll('[data-action="close"]').forEach(e => {
    e.addEventListener("click", () => closeModal(o))
  });
  let r = !1;
  o.querySelectorAll('input[type="color"]').forEach(e => {
    e.addEventListener("focus", () => {
      r = !0
    }), e.addEventListener("blur", () => {
      setTimeout(() => {
        r = !1
      }, 300)
    })
  });
  let s = !1;
  o.addEventListener("mousedown", e => {
    s = e.target === o
  }), o.addEventListener("click", e => {
    e.target === o && s && !r && closeModal(o)
  });
  const a = e => {
    "Escape" === e.key && modalStack[modalStack.length - 1] === o && (e.preventDefault(), e.stopImmediatePropagation(), closeModal(o))
  };
  return document.addEventListener("keydown", a, !0), o._sgEscHandler = a, modalStack.push(o), o
}
const _sgAnchoredTips = new Map;
let _sgAnchoredTipObserver = null;

function sgRegisterAnchoredTip(e, t, n) {
  e && "function" == typeof n && (_sgAnchoredTips.set(e, {
    modal: t || null,
    remove: n
  }), _sgAnchoredTipObserver || (_sgAnchoredTipObserver = new MutationObserver(sgRafCoalesce(sgSweepOrphanedTips)), _sgAnchoredTipObserver.observe(document.body, {
    childList: !0
  })))
}

function sgUnregisterAnchoredTip(e) {
  _sgAnchoredTips.delete(e), 0 === _sgAnchoredTips.size && _sgAnchoredTipObserver && (_sgAnchoredTipObserver.disconnect(), _sgAnchoredTipObserver = null)
}

function sgSweepOrphanedTips() {
  for (const [e, t] of Array.from(_sgAnchoredTips)) {
    if ((t.modal && !t.modal.isConnected || !e.isConnected) && (sgUnregisterAnchoredTip(e), e.isConnected)) try {
      t.remove(!1)
    } catch (t) {
      e.remove()
    }
  }
}

function sgDismissAnchoredTips(e = null, t = !1) {
  for (const [n, o] of Array.from(_sgAnchoredTips))
    if (!e || o.modal === e) {
      sgUnregisterAnchoredTip(n);
      try {
        o.remove(t)
      } catch (e) {
        n.remove()
      }
    }
}

function sgOnModalClose(e, t) {
  e && "function" == typeof t && (e._sgCleanups || (e._sgCleanups = [])).push(t)
}

function closeModal(e, closeOpts = {}) {
  if (e._sgEscHandler && document.removeEventListener("keydown", e._sgEscHandler, !0), e._sgCleanups) {
    const t = e._sgCleanups;
    e._sgCleanups = null;
    for (const e of t) try {
      e()
    } catch (e) {}
  }
  modalStack = modalStack.filter(t => t !== e), sgDismissAnchoredTips(e), e.classList.remove("show");
  const prevFocus = e._sgPrevFocus;
  e._sgPrevFocus = null;
  if ((!closeOpts || !1 !== closeOpts.restoreFocus) && prevFocus && prevFocus.isConnected && "function" == typeof prevFocus.focus) try {
    prevFocus.focus({
      preventScroll: !0
    })
  } catch (e) {}
  setTimeout(() => e.remove(), 200)
}
let lastClickedMenuButton = null;

function setupMenuButtonTracker() {
  document.addEventListener("click", e => {
    const t = e.target.closest('button[mat-mdc-menu-trigger], button[mat-menu-trigger-for], gem-nav-list-item[data-test-id="conversation"] button[aria-label^="More options for"], gem-icon-button[data-test-id="conversation-actions-menu-icon-button"] button, project-chat-row button[aria-haspopup="true"]');
    t && (lastClickedMenuButton = t)
  }, !0)
}
let lastClickedChatInfo = null;

function extractChatIdFromJslog(e) {
  if (!e) return null;
  const t = e.match(/"(c_[a-z0-9_-]+)"/i) || e.match(/"([a-z0-9]{8,}-[a-z0-9-]+)"/i);
  return t && t[1] ? t[1] : null
}
var isFoldersFeatureEnabled = !0;
let folderOverlayObserver = null;

function setupFolderOverlayObserver() {
  folderOverlayObserver && folderOverlayObserver.disconnect(), setupMenuButtonTracker(), folderOverlayObserver = new MutationObserver(sgRafCoalesceRecords(e => {
    for (const t of e)
      for (const e of t.addedNodes) {
        if (e.nodeType !== Node.ELEMENT_NODE) continue;
        if (e.id?.startsWith("sg-") || e.classList?.contains("sg-context-menu") || e.classList?.contains("sg-modal-overlay")) continue;
        const t = (e.matches?.('mat-menu-panel, .mat-mdc-menu-panel, [role="menu"]') ? e : null) || e.querySelector?.('mat-menu-panel, .mat-mdc-menu-panel, [role="menu"]');
        if (t) {
          const e = t.classList.contains("conversation-actions-menu"),
            n = t.classList.contains("bot-actions-menu"),
            o = lastClickedMenuButton?.classList?.contains("conversation-actions-menu-button"),
            r = lastClickedMenuButton?.classList?.contains("bot-actions-menu-button"),
            s = !!lastClickedMenuButton?.closest('gem-icon-button[data-test-id="conversation-actions-menu-icon-button"]');
          (e && !n || o && !r || s && !r) && isFoldersFeatureEnabled && injectAddToFolderOption(t)
        }
      }
    const t = document.querySelector(':where(mat-dialog-container, .mat-mdc-dialog-container, [role="dialog"]):not([class*="sg-"]):not([id^="sg-"])');
    if (t && !t.dataset.sgProcessed) {
      if (window.sgIsRealDeleteInProgress) return void(t.dataset.sgProcessed = "true");
      const e = t.querySelector('[data-test-id="message-dialog-title"], h1.mat-mdc-dialog-title, .mdc-dialog__title'),
        {
          confirmBtn: n,
          cancelBtn: o,
          confirmJslog: r
        } = findDialogActionButtons(t),
        s = !!(e && o && n),
        a = r.includes("186009");
      if (r.includes("186097")) return void(t.dataset.sgProcessed = "true");
      const i = t.getAttribute("aria-label")?.toLowerCase() || "",
        l = (i.includes("delete chat") || i.includes("chat"), lastClickedMenuButton?.classList?.contains("conversation-actions-menu-button") || lastClickedMenuButton?.getAttribute("aria-label")?.startsWith("More options for") && !!lastClickedMenuButton.closest('gem-nav-list-item[data-test-id="conversation"]')),
        c = lastClickedMenuButton?.classList?.contains("bot-actions-menu-button"),
        d = !!lastClickedMenuButton?.closest?.("project-chat-row");
      if (c || d) return void(t.dataset.sgProcessed = "true");
      const u = !!t.querySelector('input, textarea, mat-form-field, [contenteditable="true"]'),
        p = a || s && l && !r && !u,
        g = t.textContent || "",
        m = g.includes("Delete chat?") || g.includes("This will delete prompts");
      (s && p || m && !c) && function(e) {
        if (void 0 !== window.isTrashcanEnabled && !window.isTrashcanEnabled) return void(e.dataset.sgProcessed = "true");
        e.dataset.sgProcessed = "true";
        const t = () => {
          const t = e.querySelector('h1[data-test-id="message-dialog-title"], .mat-mdc-dialog-title, .mdc-dialog__title');
          t && !t.dataset.sgModified && (t.dataset.sgModified = "true", t.textContent = "Move to Recycle Bin?");
          const n = e.querySelector('[data-test-id="message-dialog-content"] p, .mat-mdc-dialog-content p, .message-dialog-content p');
          n && !n.dataset.sgModified && (n.dataset.sgModified = "true",sgSetSafeHtml(n, 'This chat will be moved to the <span style="color: #4285f4; font-weight: 500;">Recycle Bin</span> in your Folders. You can restore it or permanently delete it from there later.'));
          const o = e.querySelector('a[data-test-id="message-url"], mat-dialog-content a, .mat-mdc-dialog-content a');
          o && o.remove();
          const {
            confirmBtn: r,
            cancelBtn: s
          } = findDialogActionButtons(e);
          if (r && !r.dataset.sgHijacked) {
            r.dataset.sgHijacked = "true";
            (r.querySelector(".mdc-button__label .gds-body-m") || r.querySelector(".mdc-button__label") || r).textContent = "Move to Bin", r.addEventListener("click", t => {
              t.preventDefault(), t.stopPropagation(), t.stopImmediatePropagation();
              let n = null;
              const o = e => {
                if (!e) return null;
                const t = e.querySelector('a[href*="/app/"]'),
                  n = t?.href,
                  o = n?.split("/app/").pop()?.split(/[?#]/)[0] || "";
                if (!o) return null;
                const r = e.querySelector(".conversation-title, .title-text");
                return {
                  id: o,
                  title: r && r.innerText.trim() || t?.getAttribute("aria-label") || t?.getAttribute("mattooltip") || t?.getAttribute("gemtooltip") || e.textContent?.trim().replace(/more_vert/gi, "").replace(/\s+/g, " ").slice(0, 80) || "Untitled Chat"
                }
              };
              if (lastClickedMenuButton) {
                n = o(lastClickedMenuButton.closest('.conversation, .conversation-list-item, [class*="conversation-item"], gem-nav-list-item[data-test-id="conversation"]'))
              }
              if (!n) {
                const e = document.querySelector('conversations-list, mat-sidenav, [class*="sidenav"]');
                if (e) {
                  const t = e.querySelector('button[aria-expanded="true"]'),
                    r = t?.closest('.conversation, .conversation-list-item, [class*="conversation-item"], gem-nav-list-item[data-test-id="conversation"]');
                  n = o(r)
                }
              }
              if (!n) {
                const e = extractChatIdFromJslog(r.getAttribute("jslog"));
                if (e) {
                  n = {
                    id: e,
                    title: "Recycled Chat"
                  };
                  const t = document.querySelectorAll('.conversation, [class*="conversation-item"], gem-nav-list-item[data-test-id="conversation"]');
                  for (const r of t) {
                    if ((r.getAttribute("jslog") || r.querySelector("[jslog]")?.getAttribute("jslog") || "").includes(e)) {
                      const e = o(r);
                      if (e?.title && "Untitled Chat" !== e.title) {
                        n.title = e.title;
                        break
                      }
                    }
                  }
                  if ("Recycled Chat" === n.title) {
                    const t = foldersData.folders.flatMap(e => e.chats || []).find(t => t.id === e);
                    t && (n.title = t.title)
                  }
                }
              }
              if (n || (n = lastClickedChatInfo), n && n.id) {
                if (void 0 !== window.isTrashcanEnabled && !window.isTrashcanEnabled) return;
                if (t.stopPropagation(), t.preventDefault(), recycleChat(n.id, n.title), showToast("Chat moved to Recycle Bin", "success"), s) s.click();
                else {
                  const t = e.closest(".cdk-overlay-pane") || document.querySelector(".cdk-overlay-pane");
                  t && t.remove()
                }
              } else console.error("[Gemini Power Suite] Could not identify chat for recycling ❌"), showToast("Could not find chat info. Try refreshing.", "error")
            }, !0)
          }
        };
        t();
        const n = setInterval(t, 30);
        setTimeout(() => clearInterval(n), 1e3)
      }(t)
    }
  }));
  const overlayTarget = document.querySelector(".cdk-overlay-container") || document.body;
  folderOverlayObserver.observe(overlayTarget, {
    childList: !0,
    subtree: !0
  })
}
let chatMenuClickTrackerActive = !1;

function trackChatMenuClick(e) {
  const t = e.target.closest('.conversation, .conversation-list-item, [class*="conversation-item"], gem-nav-list-item[data-test-id="conversation"], a[href*="/app/"]');
  if (t) {
    let e = "",
      n = "",
      o = "";
    const r = "A" === t.tagName ? t : t.querySelector('a[href*="/app/"]');
    if (r) n = r.href, e = n.split("/app/").pop()?.split(/[?#]/)[0] || "";
    else {
      const o = extractChatIdFromJslog(t.getAttribute("jslog") || t.querySelector("[jslog]")?.getAttribute("jslog"));
      o && (e = o, n = getAccountAwareUrl(e))
    }
    if (e) {
      const s = t.querySelector('.conversation-title, .title-text, [class*="title"]');
      o = s ? s.innerText.trim() : "", !o && r && (o = r.getAttribute("aria-label") || ""), o || (o = t.textContent?.trim().replace(/more_vert/gi, "").replace(/\s+/g, " ").slice(0, 100) || "Untitled Chat"), lastClickedChatInfo = {
        id: e,
        title: o,
        url: n
      }
    }
  }
}

function setupChatMenuClickTracker() {
  chatMenuClickTrackerActive || (document.addEventListener("mousedown", trackChatMenuClick, !0), document.addEventListener("contextmenu", trackChatMenuClick, !0), chatMenuClickTrackerActive = !0)
}

function cleanupChatMenuClickTracker() {
  chatMenuClickTrackerActive && (document.removeEventListener("mousedown", trackChatMenuClick, !0), document.removeEventListener("contextmenu", trackChatMenuClick, !0), chatMenuClickTrackerActive = !1)
}

function findActiveChatInfo() {
  const e = window.location.href;
  if (e.includes("/app/")) {
    const t = e.split("/app/").pop()?.split(/[?#]/)[0] || "";
    let n = "";
    const o = [() => {
      const e = document.querySelector('gem-nav-list-item[data-test-id="conversation"] a[aria-current="page"], .conversation-items-container > .conversation.selected, .conversation-items-container > .conversation.is-active');
      return e?.querySelector(".title-text, .conversation-title")?.textContent?.trim()
    }, () => {
      const e = (document.title || "").replace(/\s*[-–—]\s*(Google\s+)?Gemini\s*$/i, "").trim();
      return /^(google\s+)?gemini$/i.test(e) ? null : e
    }, () => document.querySelector("[data-original-user-text]")?.textContent?.trim(), () => {
      const e = document.querySelector("user-query .query-text, .user-query .query-text");
      if (!e) return null;
      const t = e.cloneNode(!0);
      return t.querySelectorAll(".cdk-visually-hidden").forEach(e => e.remove()), t.textContent.replace(/\s+/g, " ").trim()
    }];
    for (const e of o) try {
      const t = e();
      if (t && t.length > 0 && !/^(google\s+)?gemini$/i.test(t)) {
        n = t.slice(0, 80);
        break
      }
    } catch (e) {}
    return n || (n = "Chat from " + (new Date).toLocaleDateString()), {
      id: t,
      title: n,
      url: e
    }
  }
  return null
}

function buildAddToFolderClickHandler(e) {
  return t => {
    t.stopPropagation();
    let n = null;
    const o = e => {
      if (!e) return null;
      const t = e.querySelector('a[href*="/app/"]');
      let n = "",
        o = "";
      if (t) o = t.href, n = o.split("/app/").pop()?.split(/[?#]/)[0] || "";
      else {
        const t = extractChatIdFromJslog(e.getAttribute("jslog") || e.querySelector("[jslog]")?.getAttribute("jslog"));
        t && (n = t, o = getAccountAwareUrl(n))
      }
      if (!n) return null;
      const r = e.querySelector(".conversation-title, .title-text");
      return {
        id: n,
        title: r && r.innerText.trim() || t?.getAttribute("aria-label") || t?.getAttribute("mattooltip") || t?.getAttribute("gemtooltip") || e.textContent?.trim().replace(/more_vert/gi, "").replace(/\s+/g, " ").slice(0, 100) || "Untitled Chat",
        url: o
      }
    };
    if (lastClickedMenuButton) {
      n = o(lastClickedMenuButton.closest('.conversation, .conversation-list-item, [class*="conversation-item"], gem-nav-list-item[data-test-id="conversation"]'))
    }
    if (!n) {
      const e = document.querySelector('conversations-list, mat-sidenav, [class*="sidenav"]');
      if (e) {
        const t = e.querySelector('button[aria-expanded="true"]'),
          r = t?.closest('.conversation, .conversation-list-item, [class*="conversation-item"], gem-nav-list-item[data-test-id="conversation"]');
        n = o(r)
      }
    }
    if (n || (n = lastClickedChatInfo), n || (n = findActiveChatInfo()), !n) return void showToast("Could not identify chat to add to folder", "info");
    const r = document.querySelector(".cdk-overlay-backdrop");
    if (r) r.click();
    else {
      const e = document.querySelector('button[aria-expanded="true"]');
      e ? e.click() : document.dispatchEvent(new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: !0
      }))
    }
    showAddToFolderMenu(e, n.id, n.title, n.url)
  }
}

function injectAddToFolderOption(e) {
  if (e.querySelector(".sg-add-to-folder-btn")) return;
  if ("GEM-MENU" === e.tagName || e.matches?.('[role="menu"]') && e.querySelector("gem-menu-item")) {
    const t = e.querySelector("gem-menu-item");
    if (!t) return;
    const n = t.cloneNode(!0);
    n.classList.add("sg-add-to-folder-btn"), n.setAttribute("data-test-id", "sg-add-to-folder"), n.setAttribute("data-active", "false");
    const o = n.querySelector("mat-icon[fonticon]");
    o && (o.setAttribute("fonticon", "folder"), o.setAttribute("data-mat-icon-name", "folder"));
    const r = n.querySelector(".label-container .label > span") || n.querySelector(".label-container .label") || n.querySelector(".label-container");
    return r && (r.textContent = " Add chat to folder "), n.addEventListener("click", buildAddToFolderClickHandler(n)), void e.appendChild(n)
  }
  const t = e.querySelectorAll('button, [role="menuitem"]');
  if (0 === t.length) return;
  const n = !!e.querySelector(".mat-mdc-menu-item.lm-menu-item-theme"),
    o = document.createElement("button");
  if (o.setAttribute("role", "menuitem"), n) {
    o.className = "sg-add-to-folder-btn mat-mdc-menu-item mat-focus-indicator lm-menu-item-theme";
    const e = document.createElement("span");
    e.className = "mat-mdc-menu-item-text";
    const t = document.createElement("gem-icon");
    t.className = "gem-menu-item-icon";
    const n = document.createElement("mat-icon");
    n.className = "mat-icon notranslate lm-icon-m lumi-symbols mat-ligature-font mat-icon-no-color", n.setAttribute("role", "img"), n.setAttribute("aria-hidden", "true"), n.setAttribute("data-mat-icon-type", "font"), n.setAttribute("data-mat-icon-name", "folder"), n.setAttribute("fonticon", "folder"), t.appendChild(n);
    const r = document.createElement("span");
    r.className = "gds-body-m gem-menu-item-label", r.textContent = "Add chat to folder", e.appendChild(t), e.appendChild(r);
    const s = document.createElement("div");
    s.className = "mat-ripple mat-mdc-menu-ripple", o.appendChild(e), o.appendChild(s)
  } else {
    o.className = "sg-add-to-folder-btn";
    const e = "\n      display: flex;\n      align-items: center;\n      gap: 12px;\n      width: 100%;\n      padding: 8px 16px;\n      background: transparent;\n      border: none;\n      font-family: var(--sg-font-text);\n      font-size: 14px;\n      color: var(--gem-sys-color--on-surface, #e8eaed);\n      cursor: pointer;\n      text-align: left;\n    ";
    o.style.cssText = e,sgSetSafeHtml(o, '\n      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink: 0;">\n        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>\n        <line x1="12" y1="11" x2="12" y2="17"/>\n        <line x1="9" y1="14" x2="15" y2="14"/>\n      </svg>\n      <span>Add chat to folder</span>\n    '), o.addEventListener("mouseenter", () => {
      o.style.background = "var(--gem-sys-color--surface-container-highest, #3c3c3c)"
    }), o.addEventListener("mouseleave", () => {
      o.style.background = "transparent"
    })
  }
  o.addEventListener("click", buildAddToFolderClickHandler(o));
  const r = t[t.length - 1];
  r && r.parentNode && r.parentNode.insertBefore(o, r.nextSibling)
}
(() => {
  const _sgFolderMenuTrackerChanged = (e, t) => {
    if ("sync" === t && void 0 !== e.extensionEnabled) {
      const t = !1 !== e.extensionEnabled.newValue;
      t && !chatMenuClickTrackerActive ? setupChatMenuClickTracker() : !t && chatMenuClickTrackerActive && cleanupChatMenuClickTracker()
    }
    if ("sync" === t && void 0 !== e.foldersEnabled) {
      isFoldersFeatureEnabled = !1 !== e.foldersEnabled.newValue
    }
  };
  if ("undefined" != typeof SG && SG.storage) {
    SG.storage.onChanged("legacy:folder-menu-tracker-sync", _sgFolderMenuTrackerChanged, { area: "sync", keys: ["extensionEnabled", "foldersEnabled"] });
  } else if ("undefined" != typeof chrome && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener(_sgFolderMenuTrackerChanged);
  }
})();
