// ============================================================================
// UNIFIED COMMAND PALETTE (Ctrl+K Global Local Search & Quick Actions)
// ============================================================================

let isCommandPaletteEnabled = true;
const SG_CP_PENDING_JUMP_KEY = "sg_cp_pending_jump";
const SG_CP_PENDING_JUMP_TTL_MS = 25000;
const SG_CP_MAX_RESULTS = 80;
const SG_CP_CATEGORIES = ["all", "command", "chat", "folder", "bookmark", "note", "prompt", "chain", "skill"];

const SG_CP_PREFIX_MAP = {
  ">": "command",
  "#": "folder_or_chat",
  "@": "skill",
  "/": "prompt_or_chain",
  "*": "bookmark",
  "!": "note"
};

const SG_CP_CATEGORY_META = {
  all: { label: "All", badge: "All" },
  command: { label: "Commands", badge: "CMD" },
  chat: { label: "Chats", badge: "CHAT" },
  folder: { label: "Folders", badge: "DIR" },
  bookmark: { label: "Bookmarks", badge: "BM" },
  note: { label: "Notes", badge: "NOTE" },
  prompt: { label: "Prompts", badge: "PRMT" },
  chain: { label: "Chains", badge: "CHAIN" },
  skill: { label: "Skills", badge: "SKILL" }
};

const SG_CP_ICON_PATHS = {
  search: ["M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z", "M21 21l-4.35-4.35"],
  command: ["M13 2L3 14h9l-1 8 10-12h-9l1-8z"],
  folder: ["M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"],
  chat: ["M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"],
  bookmark: ["M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"],
  note: ["M4 4h16v12H8l-4 4V4z", "M8 9h8M8 13h5"],
  prompt: ["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z", "M14 2v6h6M8 13h8M8 17h5"],
  chain: ["M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71", "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"],
  skill: ["M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z"]
};

const SG_CP_ACTION_HINTS = {
  command: "Run",
  folder: "Open",
  chat: "Open",
  bookmark: "Jump",
  note: "Note",
  prompt: "Insert",
  chain: "Run",
  skill: "Insert"
};

let _sgCpJumpRunning = false;

function sgNormalizeSearchText(str) {
  return String(str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .trim();
}

function sgParsePaletteQuery(rawQuery, activeCategory = "all") {
  const trimmedLeft = String(rawQuery || "").trimStart();
  let effectiveCategory = SG_CP_CATEGORIES.includes(activeCategory) ? activeCategory : "all";
  let hasPrefix = false;
  let term = trimmedLeft.trim();

  if (trimmedLeft.length > 0 && Object.prototype.hasOwnProperty.call(SG_CP_PREFIX_MAP, trimmedLeft[0])) {
    effectiveCategory = SG_CP_PREFIX_MAP[trimmedLeft[0]];
    hasPrefix = true;
    term = trimmedLeft.slice(1).trim();
  }

  const normTerm = sgNormalizeSearchText(term);
  const tokens = normTerm ? normTerm.split(/\s+/).filter(Boolean) : [];

  return {
    effectiveCategory,
    hasPrefix,
    term,
    normTerm,
    tokens
  };
}

function sgFuzzySubsequenceScore(needle, haystack) {
  if (!needle || !haystack || needle.length < 2 || needle.length > haystack.length) return 0;

  let nIdx = 0;
  let prevMatch = -1;
  let firstMatch = -1;
  let boundaryHits = 0;
  let consecutiveHits = 0;

  for (let hIdx = 0; hIdx < haystack.length && nIdx < needle.length; hIdx++) {
    if (haystack[hIdx] === needle[nIdx]) {
      if (firstMatch === -1) firstMatch = hIdx;
      if (hIdx === 0 || /[\s/_.:@-]/.test(haystack[hIdx - 1])) {
        boundaryHits++;
      }
      if (prevMatch !== -1 && hIdx === prevMatch + 1) {
        consecutiveHits++;
      }
      prevMatch = hIdx;
      nIdx++;
    }
  }

  if (nIdx !== needle.length) return 0;

  const span = Math.max(needle.length, prevMatch - firstMatch + 1);
  const density = needle.length / span;
  const boundaryRatio = boundaryHits / needle.length;
  const consecutiveRatio = needle.length > 1 ? consecutiveHits / (needle.length - 1) : 0;

  const raw = 8 + boundaryRatio * 14 + consecutiveRatio * 8 + density * 5;
  return Math.max(8, Math.min(35, Math.round(raw)));
}

function sgMatchesPaletteCategory(itemType, effectiveCategory) {
  if (!effectiveCategory || effectiveCategory === "all") return true;
  if (effectiveCategory === "folder_or_chat") return itemType === "folder" || itemType === "chat";
  if (effectiveCategory === "prompt_or_chain") return itemType === "prompt" || itemType === "chain";
  return itemType === effectiveCategory;
}

function sgEnsureNormalizedPaletteItem(item) {
  if (!item) return;
  if (typeof item._normTitle !== "string") {
    item._normTitle = sgNormalizeSearchText(item.title || "");
  }
  if (typeof item._normSearch !== "string") {
    item._normSearch = sgNormalizeSearchText(item.searchText || `${item.title || ""} ${item.subtitle || ""}`);
  }
}

function sgScoreCommandPaletteItem(item, parsedQuery) {
  if (!item || !sgMatchesPaletteCategory(item.type, parsedQuery.effectiveCategory)) {
    return 0;
  }

  sgEnsureNormalizedPaletteItem(item);
  const { normTerm, tokens } = parsedQuery;

  if (!normTerm) {
    return (item.baseWeight || 10) + (item.isCurrentChat ? 15 : 0);
  }

  const title = item._normTitle;
  const search = item._normSearch;

  if (title === normTerm) {
    return 120;
  }

  if (title.startsWith(normTerm)) {
    return 90;
  }

  const subIdx = title.indexOf(normTerm);
  if (subIdx !== -1) {
    const atBoundary = subIdx === 0 || /[\s/_.:@-]/.test(title[subIdx - 1]);
    return atBoundary ? 72 : 65;
  }

  if (tokens.length > 0 && tokens.every((tk) => title.includes(tk))) {
    let boundaryBonus = 0;
    for (const tk of tokens) {
      const idx = title.indexOf(tk);
      if (idx === 0 || (idx > 0 && /[\s/_.:@-]/.test(title[idx - 1]))) {
        boundaryBonus += 2;
      }
    }
    return Math.min(60, 45 + boundaryBonus);
  }

  if (tokens.length > 0 && tokens.every((tk) => search.includes(tk))) {
    const titleTokenHits = tokens.filter((tk) => title.includes(tk)).length;
    return Math.min(42, 28 + titleTokenHits * 3);
  }

  const compactNeedle = normTerm.replace(/\s+/g, "");
  return sgFuzzySubsequenceScore(compactNeedle, title);
}

function sgFilterCommandPaletteItems(items, rawQuery, activeCategory = "all", maxResults = SG_CP_MAX_RESULTS) {
  const parsed = sgParsePaletteQuery(rawQuery, activeCategory);
  const scored = [];

  for (const item of items || []) {
    const score = sgScoreCommandPaletteItem(item, parsed);
    if (score > 0) {
      scored.push({ item, score });
    }
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const curDiff = (b.item.isCurrentChat ? 1 : 0) - (a.item.isCurrentChat ? 1 : 0);
    if (curDiff !== 0) return curDiff;
    const bwDiff = (b.item.baseWeight || 0) - (a.item.baseWeight || 0);
    if (bwDiff !== 0) return bwDiff;
    const lenDiff = String(a.item.title || "").length - String(b.item.title || "").length;
    if (lenDiff !== 0) return lenDiff;
    return String(a.item.title || "").localeCompare(String(b.item.title || ""));
  });

  const cap = Number.isFinite(maxResults) && maxResults > 0 ? maxResults : SG_CP_MAX_RESULTS;
  return {
    results: scored.slice(0, cap),
    totalMatches: scored.length,
    effectiveCategory: parsed.effectiveCategory,
    parsed
  };
}

function sgBuildGeminiChatUrl(chatId, originOverride, pathOverride) {
  const cleanId = String(chatId || "").replace(/^c_/, "").trim();
  const origin = originOverride ||
    (typeof location !== "undefined" && location.origin && location.origin !== "null"
      ? location.origin
      : "https://gemini.google.com");

  let prefix = "";
  if (typeof pathOverride === "string") {
    const m = pathOverride.match(/\/u\/(\d+)/);
    if (m) prefix = `/u/${m[1]}`;
  } else if (typeof getAccountRpcPrefix === "function") {
    prefix = getAccountRpcPrefix() || "";
  } else if (typeof window !== "undefined" && window.location && window.location.pathname) {
    const m = window.location.pathname.match(/\/u\/(\d+)/);
    if (m) prefix = `/u/${m[1]}`;
  }

  if (!cleanId || cleanId === "default") {
    return `${origin}${prefix}/app`;
  }
  return `${origin}${prefix}/app/${cleanId}`;
}

function sgTruncateSingleLine(text, maxLen = 100) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (clean.length <= maxLen) return clean;
  return clean.slice(0, Math.max(0, maxLen - 1)).trimEnd() + "…";
}

function sgCollectCommandPaletteEntries(sources = {}, options = {}) {
  const entries = [];
  const currentChatId = options.currentChatId !== undefined
    ? String(options.currentChatId || "")
    : (typeof getCurrentChatId === "function" ? String(getCurrentChatId() || "") : "");

  const originOverride = options.origin;
  const pathOverride = options.pathname;

  const state = options.uiState || {
    wideChatEnabled: typeof isWideChatEnabled !== "undefined" ? Boolean(isWideChatEnabled) : false,
    outlineEnabled: typeof isConversationOutlineEnabled !== "undefined" ? Boolean(isConversationOutlineEnabled) : true,
    codeActionsEnabled: typeof isCodeBlockActionsEnabled !== "undefined" ? Boolean(isCodeBlockActionsEnabled) : true
  };

  // 1. Quick Commands
  const commands = [
    {
      id: "cmd_toggle_wide_chat",
      title: "Toggle Wide Chat",
      subtitle: `Expand conversation width (${state.wideChatEnabled ? "ON" : "OFF"})`,
      searchText: "toggle wide chat layout width expand screen twc",
      baseWeight: 26,
      commandId: "toggle_wide_chat"
    },
    {
      id: "cmd_export_markdown",
      title: "Export Chat as Markdown",
      subtitle: "Download the active conversation as a .md file",
      searchText: "export chat markdown md download save",
      baseWeight: 25,
      commandId: "export_markdown"
    },
    {
      id: "cmd_export_popup",
      title: "Export Chat (All Formats...)",
      subtitle: "Open export dialog for Text, Markdown, PDF, and DOCX",
      searchText: "export chat pdf docx txt markdown dialog",
      baseWeight: 24,
      commandId: "export_popup"
    },
    {
      id: "cmd_open_chat_info",
      title: "Open Chat Info & Notes",
      subtitle: "View timestamps, message count, and edit private notes",
      searchText: "chat info notes metadata edit note current",
      baseWeight: 24,
      commandId: "open_chat_info"
    },
    {
      id: "cmd_open_folders",
      title: "Open Folders",
      subtitle: "Browse folders, nested groups, and organized chats",
      searchText: "open folders organize chats directory",
      baseWeight: 24,
      commandId: "open_folders"
    },
    {
      id: "cmd_open_prompts",
      title: "Open Prompts & Chains",
      subtitle: "Manage saved prompts and multi-step prompt chains",
      searchText: "open prompts chains library templates",
      baseWeight: 23,
      commandId: "open_prompts"
    },
    {
      id: "cmd_open_skills",
      title: "Open Skills & Baseline Manager",
      subtitle: "Edit @skills, aliases, and /saved-info baselines",
      searchText: "open skills baseline instructions manager registry",
      baseWeight: 23,
      commandId: "open_skills"
    },
    {
      id: "cmd_migrate_skills",
      title: "Migrate Skills to Current Account",
      subtitle: "Sync pending custom/bundled skills to active /u/ account",
      searchText: "migrate skills sync account bootstrap saved info",
      baseWeight: 22,
      commandId: "migrate_skills"
    },
    {
      id: "cmd_fork_handoff",
      title: "Fork / Hand-off Summary",
      subtitle: "Pack selected turns or bookmarks into a new chat hand-off",
      searchText: "fork handoff summary context split new chat",
      baseWeight: 22,
      commandId: "fork_handoff"
    },
    {
      id: "cmd_selective_export",
      title: "Selective Export (Outline / Bookmarks)",
      subtitle: "Export chosen turns, bookmarked responses, or diagram turns to MD/PDF/DOCX/TXT",
      searchText: "selective export outline bookmarks turns pdf docx markdown filter",
      baseWeight: 22,
      commandId: "selective_export"
    },
    {
      id: "cmd_toggle_outline",
      title: "Toggle Conversation Outline",
      subtitle: `Show/hide floating turn & heading outline (${state.outlineEnabled ? "ON" : "OFF"})`,
      searchText: "toggle conversation outline toc headings navigation",
      baseWeight: 21,
      commandId: "toggle_outline"
    },
    {
      id: "cmd_upload_folder",
      title: "Upload Folder (Selective Tree v2)",
      subtitle: "Pick a local folder, filter by .gitignore, check token budget",
      searchText: "upload folder directory gitignore bundle tree tokens",
      baseWeight: 21,
      commandId: "upload_folder"
    },
    {
      id: "cmd_toggle_sidebar",
      title: "Toggle Sidebar",
      subtitle: "Collapse or expand Gemini left navigation sidebar",
      searchText: "toggle sidebar navigation collapse expand",
      baseWeight: 20,
      commandId: "toggle_sidebar"
    },
    {
      id: "cmd_toggle_code_actions",
      title: "Toggle Smart Code Block Actions",
      subtitle: `Collapse & Diff buttons on code headers (${state.codeActionsEnabled ? "ON" : "OFF"})`,
      searchText: "toggle smart code block actions collapse diff header",
      baseWeight: 20,
      commandId: "toggle_code_actions"
    },
    {
      id: "cmd_run_orchestrator",
      title: "Run Multi-Agent Orchestrator",
      subtitle: "Decompose prompt into sub-agents in warm Temp-Chat workers & synthesize",
      searchText: "run multi agent orchestrator subagents swarm parallel decompose synthesize",
      baseWeight: 23,
      commandId: "run_orchestrator"
    },
    {
      id: "cmd_config_orchestrator",
      title: "Configure Multi-Agent Orchestrator",
      subtitle: "Configure execution mode, max sub-agents (2-4), and model routing policy",
      searchText: "configure multi agent orchestrator settings mode subagents warm pool",
      baseWeight: 21,
      commandId: "config_orchestrator"
    }
  ];

  for (const cmd of commands) {
    entries.push({
      id: cmd.id,
      type: "command",
      title: cmd.title,
      subtitle: cmd.subtitle,
      searchText: cmd.searchText,
      baseWeight: cmd.baseWeight,
      actionHint: "Run",
      payload: { commandId: cmd.commandId }
    });
  }

  // Prepare folders & chat title resolution map
  const foldersObj = sources.foldersData || { folders: [], recycleBin: [], deletedFolders: [] };
  const allFolders = Array.isArray(foldersObj.folders) ? foldersObj.folders : [];
  const deletedFolderIds = new Set(
    (Array.isArray(foldersObj.deletedFolders) ? foldersObj.deletedFolders : [])
      .map((f) => (typeof f === "string" ? f : f && f.id))
      .filter(Boolean)
  );
  const recycleBinIds = new Set();
  for (const r of Array.isArray(foldersObj.recycleBin) ? foldersObj.recycleBin : []) {
    const rid = typeof r === "string" ? r : r && r.id;
    if (!rid) continue;
    recycleBinIds.add(String(rid));
    recycleBinIds.add(String(rid).replace(/^c_/, ""));
  }

  const activeFolders = allFolders.filter((f) => f && f.id && !deletedFolderIds.has(f.id));
  const folderById = new Map();
  for (const f of activeFolders) {
    folderById.set(f.id, f);
  }

  function buildFolderPath(folderId) {
    const parts = [];
    const seen = new Set();
    let cur = folderById.get(folderId);
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id);
      parts.unshift(cur.name || "Untitled Folder");
      cur = cur.parentId ? folderById.get(cur.parentId) : null;
    }
    return parts.join(" / ");
  }

  const chatTitleMap = new Map();
  const folderChatMap = new Map();

  // 2. Folders & 3. Folder Chats
  for (const f of activeFolders) {
    const fullPath = buildFolderPath(f.id) || f.name || "Untitled Folder";
    const visibleChats = (Array.isArray(f.chats) ? f.chats : []).filter((ch) => {
      if (!ch || !ch.id) return false;
      const rawId = String(ch.id);
      const cleanId = rawId.replace(/^c_/, "");
      return !recycleBinIds.has(rawId) && !recycleBinIds.has(cleanId);
    });

    entries.push({
      id: `folder:${f.id}`,
      type: "folder",
      title: f.name || "Untitled Folder",
      subtitle: `${fullPath} • ${visibleChats.length} chat${visibleChats.length === 1 ? "" : "s"}`,
      searchText: `${f.name || ""} ${fullPath}`,
      baseWeight: 18,
      actionHint: "Open",
      payload: { folderId: f.id }
    });

    for (const ch of visibleChats) {
      const cleanId = String(ch.id).replace(/^c_/, "");
      const title = (ch.title || "").trim() || `Chat ${cleanId}`;
      const chatUrl = ch.url || sgBuildGeminiChatUrl(cleanId, originOverride, pathOverride);
      if (!chatTitleMap.has(cleanId)) {
        chatTitleMap.set(cleanId, { title, url: chatUrl });
      }
      if (!folderChatMap.has(cleanId)) {
        folderChatMap.set(cleanId, {
          chatId: cleanId,
          title,
          url: chatUrl,
          pinned: Boolean(ch.pinned),
          folderPaths: [fullPath]
        });
      } else {
        const rec = folderChatMap.get(cleanId);
        rec.pinned = rec.pinned || Boolean(ch.pinned);
        if (!rec.folderPaths.includes(fullPath)) {
          rec.folderPaths.push(fullPath);
        }
      }
    }
  }

  for (const sChat of Array.isArray(sources.sidebarChats) ? sources.sidebarChats : []) {
    if (!sChat || !sChat.id) continue;
    const cleanId = String(sChat.id).replace(/^c_/, "");
    if (!cleanId || recycleBinIds.has(cleanId)) continue;
    const title = (sChat.title || "").trim() || cleanId;
    const url = sChat.url || sgBuildGeminiChatUrl(cleanId, originOverride, pathOverride);
    if (!chatTitleMap.has(cleanId)) {
      chatTitleMap.set(cleanId, { title, url });
    }
    if (!folderChatMap.has(cleanId)) {
      folderChatMap.set(cleanId, {
        chatId: cleanId,
        title,
        url,
        pinned: false,
        folderPaths: ["Recent Sidebar"]
      });
    }
  }

  for (const rec of folderChatMap.values()) {
    const isCur = Boolean(currentChatId && rec.chatId === currentChatId);
    entries.push({
      id: `chat:${rec.chatId}`,
      type: "chat",
      title: rec.title,
      subtitle: `${rec.pinned ? "Pinned • " : ""}${rec.folderPaths.join(", ")}${isCur ? " • Current chat" : ""}`,
      searchText: `${rec.title} ${rec.folderPaths.join(" ")} ${rec.chatId}`,
      baseWeight: rec.pinned ? 20 : 19,
      isCurrentChat: isCur,
      actionHint: "Open",
      payload: { chatId: rec.chatId, chatUrl: rec.url }
    });
  }

  // 4. Bookmarks
  const rawBmObj = sources.bookmarks;
  const unwrappedBm = typeof sgUnwrapBookmarksStored === "function"
    ? sgUnwrapBookmarksStored(rawBmObj)
    : { chats: (rawBmObj && rawBmObj.chats) || rawBmObj || {} };

  for (const [rawChatId, bmList] of Object.entries(unwrappedBm.chats || {})) {
    if (!Array.isArray(bmList)) continue;
    const cleanChatId = String(rawChatId || "").replace(/^c_/, "");
    const chatMeta = chatTitleMap.get(cleanChatId);
    const chatLabel = chatMeta ? chatMeta.title : (cleanChatId === "default" ? "Current Chat" : `Chat ${cleanChatId}`);
    const chatUrl = (chatMeta && chatMeta.url) || sgBuildGeminiChatUrl(cleanChatId, originOverride, pathOverride);
    const isCur = Boolean(currentChatId && cleanChatId === currentChatId);

    for (const rawEntry of bmList) {
      const bm = typeof sgNormalizeBookmarkEntry === "function"
        ? sgNormalizeBookmarkEntry(rawEntry)
        : (rawEntry && rawEntry.id ? rawEntry : null);
      if (!bm || !bm.id) continue;
      const snippet = sgTruncateSingleLine(bm.text || "", 110) || "Bookmarked message";
      entries.push({
        id: `bookmark:${cleanChatId}:${bm.id}`,
        type: "bookmark",
        title: snippet,
        subtitle: `${chatLabel}${isCur ? " • Current chat" : ""}`,
        searchText: `${bm.text || ""} ${chatLabel} ${bm.id}`,
        baseWeight: 17,
        isCurrentChat: isCur,
        actionHint: "Jump",
        payload: { chatId: cleanChatId, bookmarkId: bm.id, chatUrl }
      });
    }
  }

  // 5. Chat Notes (sg_chat_notes)
  const notesMap = sources.notes && typeof sources.notes === "object" ? sources.notes : {};
  for (const [rawChatId, rawNoteText] of Object.entries(notesMap)) {
    if (typeof rawNoteText !== "string" || !rawNoteText.trim()) continue;
    const cleanChatId = String(rawChatId || "").replace(/^c_/, "");
    const chatMeta = chatTitleMap.get(cleanChatId);
    const chatLabel = chatMeta ? chatMeta.title : `Chat ${cleanChatId}`;
    const chatUrl = (chatMeta && chatMeta.url) || sgBuildGeminiChatUrl(cleanChatId, originOverride, pathOverride);
    const isCur = Boolean(currentChatId && cleanChatId === currentChatId);
    const preview = sgTruncateSingleLine(rawNoteText, 120);

    entries.push({
      id: `note:${cleanChatId}`,
      type: "note",
      title: `Note: ${chatLabel}`,
      subtitle: `${preview}${isCur ? " • Current chat" : ""}`,
      searchText: `${chatLabel} ${rawNoteText}`,
      baseWeight: 17,
      isCurrentChat: isCur,
      actionHint: "Note",
      payload: { chatId: cleanChatId, chatUrl }
    });
  }

  // 6. Prompts
  const promptsList = (sources.promptsData && Array.isArray(sources.promptsData.prompts))
    ? sources.promptsData.prompts
    : [];
  for (const p of promptsList) {
    if (!p || !p.title) continue;
    const varMatches = p.text ? [...new Set((p.text.match(/\{\{\s*([^{}]+)\s*\}\}/g) || []).map((v) => v.trim()))] : [];
    const snippet = sgTruncateSingleLine(p.text || "", 90);
    const varLabel = varMatches.length ? `${varMatches.length} var${varMatches.length > 1 ? "s" : ""} • ` : "";
    entries.push({
      id: `prompt:${p.id || p.title}`,
      type: "prompt",
      title: p.title,
      subtitle: `${varLabel}${snippet}`,
      searchText: `${p.title} ${p.text || ""}`,
      baseWeight: 16,
      actionHint: "Insert",
      payload: { prompt: p }
    });
  }

  // 7. Chains
  const chainsList = (sources.chainsData && Array.isArray(sources.chainsData.chains))
    ? sources.chainsData.chains
    : [];
  for (const ch of chainsList) {
    if (!ch || !ch.title) continue;
    const steps = Array.isArray(ch.steps) ? ch.steps : [];
    const firstStep = steps.length ? sgTruncateSingleLine(steps[0], 80) : "";
    entries.push({
      id: `chain:${ch.id || ch.title}`,
      type: "chain",
      title: ch.title,
      subtitle: `${steps.length} step${steps.length === 1 ? "" : "s"}${firstStep ? " • " + firstStep : ""}`,
      searchText: `${ch.title} ${steps.join(" ")}`,
      baseWeight: 15,
      actionHint: "Run",
      payload: { chain: ch }
    });
  }

  // 8. Skills
  const skillsList = Array.isArray(sources.skills) ? sources.skills : [];
  for (const s of skillsList) {
    if (!s || !s.id) continue;
    const aliases = Array.isArray(s.aliases) ? s.aliases : [];
    const aliasText = aliases.length ? ` (${aliases.join(", ")})` : "";
    const statusText = s.enabled === false ? " [Disabled]" : "";
    const descText = s.description ? ` — ${sgTruncateSingleLine(s.description, 85)}` : "";
    entries.push({
      id: `skill:${s.id}`,
      type: "skill",
      title: s.name || s.id,
      subtitle: `@${s.id}${aliasText}${statusText}${descText}`,
      searchText: `${s.name || ""} @${s.id} ${aliases.join(" ")} ${s.description || ""}`,
      baseWeight: s.enabled === false ? 12 : 16,
      actionHint: s.enabled !== false && (s.mode === "inject" || s.mode === "both") ? "Insert" : "Manage",
      payload: { skill: s }
    });
  }

  return entries;
}

function sgCollectLoadedSidebarChats() {
  if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") return [];
  const list = [];
  const seen = new Set();
  for (const anchor of document.querySelectorAll('a[href*="/app/"]')) {
    if (anchor.closest('[id^="sg-"]')) continue;
    const href = anchor.getAttribute("href") || anchor.href || "";
    const m = href.match(/\/app\/([a-zA-Z0-9_-]+)/);
    if (!m || !m[1] || seen.has(m[1])) continue;
    seen.add(m[1]);
    const labelEl = anchor.querySelector(".conversation-title, p, span");
    const rawTitle = (labelEl && labelEl.textContent) || anchor.textContent || "";
    const title = rawTitle.replace(/\s+/g, " ").trim();
    if (!title) continue;
    list.push({
      id: m[1],
      title,
      url: href.startsWith("http") ? href : sgBuildGeminiChatUrl(m[1])
    });
  }
  return list;
}

async function sgLoadCommandPaletteSources() {
  await migrateLegacyStorageKeys();
  let stored = {};
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    try {
      stored = await chrome.storage.local.get([
        FOLDERS_STORAGE_KEY,
        PROMPTS_STORAGE_KEY,
        CHAINS_STORAGE_KEY,
        SG_BOOKMARKS_STORAGE_KEY,
        "sg_chat_notes"
      ]);
    } catch (_e) {
      stored = {};
    }
  }

  let skills = [];
  if (typeof loadEffectiveSkills === "function") {
    try {
      const loaded = await loadEffectiveSkills();
      skills = Array.isArray(loaded && loaded.skills) ? loaded.skills : [];
    } catch (_e) {
      skills = [];
    }
  }

  return {
    foldersData: stored[FOLDERS_STORAGE_KEY] || (typeof foldersData !== "undefined" ? foldersData : { folders: [], recycleBin: [] }),
    promptsData: stored[PROMPTS_STORAGE_KEY] || (typeof promptsData !== "undefined" ? promptsData : { prompts: [] }),
    chainsData: stored[CHAINS_STORAGE_KEY] || (typeof chainsData !== "undefined" ? chainsData : { chains: [] }),
    bookmarks: stored[SG_BOOKMARKS_STORAGE_KEY] || (typeof sgBuildBookmarksStored === "function" ? sgBuildBookmarksStored() : {}),
    notes: stored.sg_chat_notes || {},
    skills,
    sidebarChats: sgCollectLoadedSidebarChats()
  };
}

let _sgCpMaybePendingJump = true;

function sgQueueCrossChatJump(payload) {
  _sgCpMaybePendingJump = true;
  try {
    sessionStorage.setItem(SG_CP_PENDING_JUMP_KEY, JSON.stringify({
      ...payload,
      ts: Date.now()
    }));
  } catch (_e) {
    // Ignore storage unavailability
  }
}

async function sgConsumePendingPaletteJump() {
  if (!_sgCpMaybePendingJump || _sgCpJumpRunning || typeof sessionStorage === "undefined") return;
  let raw = null;
  try {
    raw = sessionStorage.getItem(SG_CP_PENDING_JUMP_KEY);
  } catch (_e) {
    _sgCpMaybePendingJump = false;
    return;
  }
  if (!raw) {
    _sgCpMaybePendingJump = false;
    return;
  }

  let pending = null;
  try {
    pending = JSON.parse(raw);
  } catch (_e) {
    sessionStorage.removeItem(SG_CP_PENDING_JUMP_KEY);
    _sgCpMaybePendingJump = false;
    return;
  }

  if (!pending || typeof pending.ts !== "number" || Date.now() - pending.ts > SG_CP_PENDING_JUMP_TTL_MS) {
    sessionStorage.removeItem(SG_CP_PENDING_JUMP_KEY);
    _sgCpMaybePendingJump = false;
    return;
  }

  const curChatId = typeof getCurrentChatId === "function" ? String(getCurrentChatId() || "") : "";
  if (!pending.chatId || curChatId !== String(pending.chatId)) {
    return;
  }

  sessionStorage.removeItem(SG_CP_PENDING_JUMP_KEY);
  _sgCpMaybePendingJump = false;
  _sgCpJumpRunning = true;

  try {
    const deadline = Date.now() + 6000;
    while (Date.now() < deadline) {
      const ch = typeof domQuery === "function" ? domQuery("chatHistory") : null;
      if (ch && ch.querySelector(".conversation-container")) break;
      await new Promise((r) => setTimeout(r, 250));
    }

    if (pending.type === "bookmark" && pending.bookmarkId && typeof sgScrollToBookmark === "function") {
      const found = await sgScrollToBookmark(pending.bookmarkId);
      if (!found && typeof showToast === "function") {
        showToast("Could not locate bookmarked message in this chat.", "warning");
      }
    } else if (pending.type === "note" && typeof showInfoPopup === "function") {
      await new Promise((r) => setTimeout(r, 450));
      showInfoPopup();
    }
  } finally {
    _sgCpJumpRunning = false;
  }
}

async function sgExecuteCommandPaletteEntry(entry) {
  if (!entry || !entry.payload) return;
  const p = entry.payload;

  if (entry.type === "command") {
    switch (p.commandId) {
      case "toggle_wide_chat": {
        if (typeof isWideChatEnabled !== "undefined") {
          isWideChatEnabled = !isWideChatEnabled;
          if (typeof updateWideChatClass === "function") updateWideChatClass();
          const btn = document.getElementById("sg-header-wide-btn");
          if (btn) btn.classList.toggle("sg-wide-active", isWideChatEnabled);
          if (chrome.storage && chrome.storage.sync) {
            chrome.storage.sync.set({ wideChatEnabled: isWideChatEnabled });
          }
          if (typeof showToast === "function") {
            showToast(`Wide Chat ${isWideChatEnabled ? "enabled" : "disabled"}.`, "success");
          }
        }
        break;
      }
      case "export_markdown":
        if (typeof isOnGemLanding === "function" && isOnGemLanding()) {
          if (typeof showToast === "function") showToast("Choose a conversation first", "info");
        } else if (typeof exportChatAsMarkdown === "function") {
          await exportChatAsMarkdown({});
        }
        break;
      case "export_popup":
        if (typeof isOnGemLanding === "function" && isOnGemLanding()) {
          if (typeof showToast === "function") showToast("Choose a conversation first", "info");
        } else if (typeof showExportPopup === "function") {
          showExportPopup();
        }
        break;
      case "selective_export":
        if (typeof isOnGemLanding === "function" && isOnGemLanding()) {
          if (typeof showToast === "function") showToast("Choose a conversation first", "info");
        } else if (typeof sgOpenSelectiveExportModal === "function") {
          sgOpenSelectiveExportModal({});
        }
        break;
      case "open_chat_info":
        if (typeof isOnGemLanding === "function" && isOnGemLanding()) {
          if (typeof showToast === "function") showToast("Choose a conversation first", "info");
        } else if (typeof showInfoPopup === "function") {
          showInfoPopup();
        }
        break;
      case "open_folders":
        if (typeof showFoldersModal === "function") showFoldersModal();
        break;
      case "open_prompts":
        if (typeof showPromptsModal === "function") await showPromptsModal();
        break;
      case "open_skills":
        if (typeof showSkillsModal === "function") await showSkillsModal();
        break;
      case "migrate_skills":
        if (typeof showSkillsModal === "function") {
          await showSkillsModal({ tab: "skills", view: "confirm-migrate" });
        }
        break;
      case "fork_handoff":
        if (typeof sgOpenForkHandoffModal === "function") await sgOpenForkHandoffModal();
        break;
      case "toggle_outline": {
        if (typeof isConversationOutlineEnabled !== "undefined" && typeof sgSetOutlineEnabled === "function") {
          const next = !isConversationOutlineEnabled;
          sgSetOutlineEnabled(next);
          if (chrome.storage && chrome.storage.sync) {
            chrome.storage.sync.set({ conversationOutlineEnabled: next });
          }
          if (typeof showToast === "function") {
            showToast(`Conversation Outline ${next ? "enabled" : "disabled"}.`, "success");
          }
        }
        break;
      }
      case "upload_folder":
        if (typeof ensureDirInput === "function") {
          ensureDirInput().click();
        }
        break;
      case "toggle_sidebar": {
        const toggleBtn = typeof findSidebarToggleButton === "function" ? findSidebarToggleButton() : null;
        if (toggleBtn && typeof sgToggleSidebarKeepFocus === "function") {
          sgToggleSidebarKeepFocus(toggleBtn);
        } else if (typeof showToast === "function") {
          showToast("Sidebar toggle button not found.", "info");
        }
        break;
      }
      case "toggle_code_actions": {
        const next = !isCodeBlockActionsEnabled;
        sgSetCodeBlockActionsEnabled(next);
        if (chrome.storage && chrome.storage.sync) {
          chrome.storage.sync.set({ codeBlockActionsEnabled: next });
        }
        if (typeof showToast === "function") {
          showToast(`Smart Code Block Actions ${next ? "enabled" : "disabled"}.`, "success");
        }
        break;
      }
      case "run_orchestrator":
        if (typeof sgTriggerOrchestratorFromUi === "function") {
          sgTriggerOrchestratorFromUi();
        }
        break;
      case "config_orchestrator":
        if (typeof sgOpenOrchestratorConfigPopover === "function") {
          sgOpenOrchestratorConfigPopover();
        }
        break;
    }
    return;
  }

  if (entry.type === "folder") {
    if (typeof showFolderChatsModal === "function") {
      await showFolderChatsModal(p.folderId);
    }
    return;
  }

  if (entry.type === "chat") {
    const curId = typeof getCurrentChatId === "function" ? String(getCurrentChatId() || "") : "";
    if (p.chatId && p.chatId === curId) {
      if (typeof showToast === "function") showToast("Already viewing this chat.", "info");
      return;
    }
    const targetUrl = p.chatUrl || sgBuildGeminiChatUrl(p.chatId);
    if (typeof sgOpenChatReliably === "function") {
      sgOpenChatReliably(targetUrl, p.chatId);
    }
    return;
  }

  if (entry.type === "bookmark") {
    const curId = typeof getCurrentChatId === "function" ? String(getCurrentChatId() || "") : "";
    const inDom = Boolean(p.bookmarkId && document.getElementById(p.bookmarkId));
    if (inDom || (p.chatId && p.chatId === curId)) {
      if (typeof sgScrollToBookmark === "function") {
        const ok = await sgScrollToBookmark(p.bookmarkId);
        if (!ok && typeof showToast === "function") {
          showToast("Could not find this bookmarked message in current view.", "warning");
        }
      }
      return;
    }
    sgQueueCrossChatJump({ type: "bookmark", chatId: p.chatId, bookmarkId: p.bookmarkId });
    const targetUrl = p.chatUrl || sgBuildGeminiChatUrl(p.chatId);
    if (typeof sgOpenChatReliably === "function") {
      sgOpenChatReliably(targetUrl, p.chatId);
    }
    return;
  }

  if (entry.type === "note") {
    const curId = typeof getCurrentChatId === "function" ? String(getCurrentChatId() || "") : "";
    if (p.chatId && p.chatId === curId) {
      if (typeof showInfoPopup === "function") showInfoPopup();
      return;
    }
    sgQueueCrossChatJump({ type: "note", chatId: p.chatId });
    const targetUrl = p.chatUrl || sgBuildGeminiChatUrl(p.chatId);
    if (typeof sgOpenChatReliably === "function") {
      sgOpenChatReliably(targetUrl, p.chatId);
    }
    return;
  }

  if (entry.type === "prompt" && p.prompt) {
    const pr = p.prompt;
    const pasteAndConfigure = async (resolvedText) => {
      const inputEl = typeof findPromptInput === "function" ? findPromptInput() : null;
      if (typeof pastePromptText === "function") {
        pastePromptText(resolvedText, inputEl);
      }
      if (typeof triggerWordCounterUpdate === "function") {
        triggerWordCounterUpdate();
      }
      if (pr.mode && pr.mode !== "none" && typeof switchMode === "function") {
        await switchMode(pr.mode);
        if (pr.tool && pr.tool !== "none") await new Promise((r) => setTimeout(r, 300));
      }
      if (pr.tool && pr.tool !== "none" && typeof selectTool === "function") {
        await selectTool(pr.tool);
      }
      if (pr.autosend) {
        await new Promise((r) => setTimeout(r, 500));
        const sendBtn = document.querySelector('.send-button, button[data-test-id="send-button"]');
        if (sendBtn && !sendBtn.disabled) sendBtn.click();
      }
    };
    if (typeof handlePromptVariables === "function") {
      handlePromptVariables(pr.text || "", pasteAndConfigure);
    } else {
      await pasteAndConfigure(pr.text || "");
    }
    return;
  }

  if (entry.type === "chain" && p.chain) {
    if (typeof runChain === "function") {
      runChain(p.chain);
    }
    return;
  }

  if (entry.type === "skill" && p.skill) {
    const sk = p.skill;
    if (sk.enabled !== false && (sk.mode === "inject" || sk.mode === "both")) {
      const inputEl = typeof findPromptInput === "function" ? findPromptInput() : null;
      if (inputEl && typeof pastePromptText === "function") {
        pastePromptText(`@${sk.id} `, inputEl);
        if (typeof triggerWordCounterUpdate === "function") triggerWordCounterUpdate();
        return;
      }
    }
    if (typeof showSkillsModal === "function") {
      await showSkillsModal();
    }
  }
}

function sgRenderHighlightedText(container, rawText, normTerm) {
  const text = String(rawText || "");
  if (!normTerm) {
    container.appendChild(document.createTextNode(text));
    return;
  }

  const lower = text.toLowerCase();
  const tokens = normTerm.split(/\s+/).filter(Boolean);
  let matchedRange = null;

  const exactIdx = lower.indexOf(normTerm);
  if (exactIdx !== -1) {
    matchedRange = [exactIdx, exactIdx + normTerm.length];
  } else {
    for (const tk of tokens) {
      const idx = lower.indexOf(tk);
      if (idx !== -1) {
        matchedRange = [idx, idx + tk.length];
        break;
      }
    }
  }

  if (!matchedRange) {
    container.appendChild(document.createTextNode(text));
    return;
  }

  const [start, end] = matchedRange;
  if (start > 0) {
    container.appendChild(document.createTextNode(text.slice(0, start)));
  }
  container.appendChild(sgSkillEl("mark", { className: "sg-cp-mark", textContent: text.slice(start, end) }));
  if (end < text.length) {
    container.appendChild(document.createTextNode(text.slice(end)));
  }
}

function sgCloseCommandPalette() {
  const existing = document.getElementById("sg-command-palette-overlay");
  if (!existing) return false;
  if (typeof existing._sgClose === "function") {
    existing._sgClose();
  } else {
    existing.remove();
  }
  return true;
}

async function sgOpenCommandPalette() {
  if (!isCommandPaletteEnabled) return;
  if (sgCloseCommandPalette()) return;

  let prevFocus = null;
  try {
    prevFocus = document.activeElement;
  } catch (_) {}

  const sources = await sgLoadCommandPaletteSources();
  const allEntries = sgCollectCommandPaletteEntries(sources);

  let activeCategory = "all";
  let rawQuery = "";
  let currentResults = [];
  let activeIndex = 0;

  const { overlay, close } = createModalOverlay({
    id: "sg-command-palette-overlay",
    zIndex: 2200,
    returnFocusTo: prevFocus
  });

  const modal = sgSkillEl("div", {
    className: "sg-cp-modal",
    role: "dialog",
    "aria-modal": "true",
    "aria-label": "Unified Command Palette"
  });

  const searchIcon = typeof sgCreateSvgIcon === "function"
    ? sgCreateSvgIcon(SG_CP_ICON_PATHS.search, 18)
    : sgSkillEl("span", { textContent: "⌘" });

  const searchInput = sgSkillEl("input", {
    type: "text",
    className: "sg-cp-input",
    placeholder: "Search folders, chats, notes, bookmarks, prompts, skills, >commands...",
    "aria-label": "Command Palette search"
  });

  const shortcutKbd = sgSkillEl("span", {
    className: "sg-cp-kbd",
    textContent: /mac/i.test(navigator.platform || "") ? "⌘K" : "Ctrl+K"
  });

  const closeBtn = sgSkillEl("button", {
    type: "button",
    className: "sg-cp-close-btn",
    "aria-label": "Close Command Palette",
    textContent: "×",
    onClick: () => close()
  });

  const searchBar = sgSkillEl("div", { className: "sg-cp-search-bar" }, [
    sgSkillEl("span", { className: "sg-cp-search-icon" }, [searchIcon]),
    searchInput,
    shortcutKbd,
    closeBtn
  ]);

  const chipRow = sgSkillEl("div", { className: "sg-cp-chips", role: "tablist" });
  const chipButtons = new Map();

  for (const catKey of SG_CP_CATEGORIES) {
    const meta = SG_CP_CATEGORY_META[catKey];
    const chip = sgSkillEl("button", {
      type: "button",
      className: `sg-cp-chip${catKey === activeCategory ? " sg-cp-chip-active" : ""}`,
      textContent: meta.label,
      onClick: () => {
        activeCategory = catKey;
        refreshResults(true);
        searchInput.focus();
      }
    });
    chipButtons.set(catKey, chip);
    chipRow.appendChild(chip);
  }

  const listWrap = sgSkillEl("div", {
    className: "sg-cp-list",
    role: "listbox"
  });

  const matchCounter = sgSkillEl("span", { className: "sg-cp-counter" });
  const footer = sgSkillEl("div", { className: "sg-cp-footer" }, [
    sgSkillEl("span", {
      className: "sg-cp-hints",
      textContent: "↑↓ Navigate • ↵ Run • Tab Filter • > cmd  # dir  * bm  ! note  / prompt  @ skill"
    }),
    matchCounter
  ]);

  modal.appendChild(searchBar);
  modal.appendChild(chipRow);
  modal.appendChild(listWrap);
  modal.appendChild(footer);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const rowEls = [];

  function syncActiveRowUI() {
    for (let i = 0; i < rowEls.length; i++) {
      const isAct = i === activeIndex;
      rowEls[i].classList.toggle("sg-cp-item-active", isAct);
      rowEls[i].setAttribute("aria-selected", isAct ? "true" : "false");
    }
    if (rowEls[activeIndex] && typeof rowEls[activeIndex].scrollIntoView === "function") {
      rowEls[activeIndex].scrollIntoView({ block: "nearest" });
    }
  }

  function runAtIndex(idx) {
    const picked = currentResults[idx];
    if (!picked || !picked.item) return;
    close({ restoreFocus: false });
    sgExecuteCommandPaletteEntry(picked.item);
  }

  function refreshResults(resetIndex = true) {
    const filtered = sgFilterCommandPaletteItems(allEntries, rawQuery, activeCategory, SG_CP_MAX_RESULTS);
    currentResults = filtered.results;
    if (resetIndex || activeIndex >= currentResults.length) {
      activeIndex = 0;
    }

    for (const [catKey, btn] of chipButtons.entries()) {
      const eff = filtered.effectiveCategory;
      const isActive = catKey === activeCategory ||
        (filtered.parsed.hasPrefix && (
          eff === catKey ||
          (eff === "folder_or_chat" && (catKey === "folder" || catKey === "chat")) ||
          (eff === "prompt_or_chain" && (catKey === "prompt" || catKey === "chain"))
        ));
      btn.classList.toggle("sg-cp-chip-active", isActive);
    }

    while (listWrap.firstChild) listWrap.removeChild(listWrap.firstChild);
    rowEls.length = 0;

    if (!currentResults.length) {
      listWrap.appendChild(sgSkillEl("div", {
        className: "sg-cp-empty",
        textContent: rawQuery.trim()
          ? `No local items matching "${rawQuery.trim()}".`
          : "No items in this category yet."
      }));
      matchCounter.textContent = "0 results";
      return;
    }

    matchCounter.textContent = filtered.totalMatches > currentResults.length
      ? `${currentResults.length} / ${filtered.totalMatches} matches`
      : `${currentResults.length} result${currentResults.length === 1 ? "" : "s"}`;

    currentResults.forEach(({ item }, idx) => {
      const catMeta = SG_CP_CATEGORY_META[item.type] || SG_CP_CATEGORY_META.command;
      const iconPaths = SG_CP_ICON_PATHS[item.type] || SG_CP_ICON_PATHS.command;
      const iconNode = typeof sgCreateSvgIcon === "function"
        ? sgCreateSvgIcon(iconPaths, 16)
        : sgSkillEl("span", { textContent: "•" });

      const titleSpan = sgSkillEl("div", { className: "sg-cp-item-title" });
      sgRenderHighlightedText(titleSpan, item.title, filtered.parsed.normTerm);

      const subSpan = sgSkillEl("div", { className: "sg-cp-item-sub" });
      sgRenderHighlightedText(subSpan, item.subtitle || "", filtered.parsed.normTerm);

      const badge = sgSkillEl("span", {
        className: `sg-cp-badge sg-cp-badge-${item.type}`,
        textContent: catMeta.badge
      });

      const hint = sgSkillEl("span", {
        className: "sg-cp-action-hint",
        textContent: item.actionHint || SG_CP_ACTION_HINTS[item.type] || "Open"
      });

      const row = sgSkillEl("button", {
        type: "button",
        role: "option",
        className: `sg-cp-item${idx === activeIndex ? " sg-cp-item-active" : ""}`,
        "aria-selected": idx === activeIndex ? "true" : "false",
        onMouseEnter: () => {
          activeIndex = idx;
          syncActiveRowUI();
        },
        onClick: (e) => {
          e.preventDefault();
          runAtIndex(idx);
        }
      }, [
        sgSkillEl("span", { className: `sg-cp-item-icon sg-cp-icon-${item.type}` }, [iconNode]),
        sgSkillEl("div", { className: "sg-cp-item-main" }, [titleSpan, subSpan]),
        badge,
        hint
      ]);

      rowEls.push(row);
      listWrap.appendChild(row);
    });
  }

  searchInput.addEventListener("input", () => {
    rawQuery = searchInput.value || "";
    refreshResults(true);
  });

  modal.addEventListener("keydown", (e) => {
    if (e && (e.isComposing || 229 === e.keyCode || "Process" === e.key)) return;
    const keyLower = (e.key || "").toLowerCase();
    if (e.key === "ArrowDown" || (e.ctrlKey && !e.altKey && !e.metaKey && keyLower === "n")) {
      if (!currentResults.length) return;
      e.preventDefault();
      e.stopPropagation();
      activeIndex = (activeIndex + 1) % currentResults.length;
      syncActiveRowUI();
      return;
    }
    if (e.key === "ArrowUp" || (e.ctrlKey && !e.altKey && !e.metaKey && keyLower === "p")) {
      if (!currentResults.length) return;
      e.preventDefault();
      e.stopPropagation();
      activeIndex = (activeIndex - 1 + currentResults.length) % currentResults.length;
      syncActiveRowUI();
      return;
    }
    if (e.key === "Enter") {
      if (!currentResults.length) return;
      e.preventDefault();
      e.stopPropagation();
      runAtIndex(activeIndex);
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      e.stopPropagation();
      const curIdx = SG_CP_CATEGORIES.indexOf(activeCategory);
      const delta = e.shiftKey ? -1 : 1;
      const nextIdx = (curIdx + delta + SG_CP_CATEGORIES.length) % SG_CP_CATEGORIES.length;
      activeCategory = SG_CP_CATEGORIES[nextIdx];
      refreshResults(true);
      searchInput.focus();
    }
  });

  refreshResults(true);
  requestAnimationFrame(() => {
    overlay.classList.add("show");
    searchInput.focus();
  });
}

let _sgCpLastHandledTs = -1;
let _sgCpListenersBound = false;
let _sgCpTooltipTimer = null;
let _sgCpCachedSearchBtn = null;
let _sgCpLastSideOpen = null;

function sgGetCommandPaletteShortcutLabel() {
  const isMac = typeof navigator !== "undefined" && /mac/i.test(navigator.platform || "");
  return isMac ? "Command Palette (⌘K)" : "Command Palette (Ctrl+K)";
}

function sgIsNativeSearchLabelText(text) {
  return /tìm kiếm trong các cuộc trò chuyện|search for chats|search chats|ctrl\+shift\+k|⌘⇧k|cmd\+shift\+k/i.test(String(text || ""));
}

function sgFindNativeSearchButtonFromTarget(target) {
  if (!target || typeof target.closest !== "function") return null;
  if (target.closest("#sg-command-palette-overlay")) return null;
  const inSidenav = target.closest("bard-sidenav, side-navigation-v2, .sidenav-with-history-container");
  if (!inSidenav) return null;

  let cur = target;
  while (cur && cur !== inSidenav) {
    const cid = cur.id || "";
    const cls = typeof cur.className === "string" ? cur.className : "";
    if (cid.startsWith("sg-") || /\bsg-/.test(cls)) return null;
    cur = cur.parentNode;
  }

  const directHost = target.closest(
    'search-nav-button, [data-test-id="search-nav-button"], [data-test-id="side-nav-search-button"], a[href="/search"], a[href*="/search?"]'
  );
  if (directHost && inSidenav.contains(directHost)) return directHost;

  const btn = target.closest('button, a, [role="button"], side-nav-action-button');
  if (!btn || !inSidenav.contains(btn)) return null;

  if (btn.querySelector && btn.querySelector('mat-icon[fonticon="search"], mat-icon[data-mat-icon-name="search"], [fonticon="search"]')) {
    return btn;
  }

  const label = (
    (btn.getAttribute && (btn.getAttribute("aria-label") || btn.getAttribute("mattooltip") || btn.getAttribute("title"))) || ""
  ).trim();
  if (sgIsNativeSearchLabelText(label)) return btn;

  const descId = btn.getAttribute && btn.getAttribute("aria-describedby");
  if (descId && typeof document !== "undefined") {
    const descEl = document.getElementById(descId);
    if (descEl && sgIsNativeSearchLabelText(descEl.textContent)) return btn;
  }
  return null;
}

function sgFindAllNativeSearchButtons() {
  if (typeof document === "undefined") return [];
  const sidenav = document.querySelector("bard-sidenav, side-navigation-v2, .sidenav-with-history-container");
  if (!sidenav) return [];
  const found = new Set();
  const candidates = sidenav.querySelectorAll(
    'search-nav-button, [data-test-id="search-nav-button"], [data-test-id="side-nav-search-button"], a[href="/search"], a[href*="/search?"], button, [role="button"], side-nav-action-button'
  );
  for (const el of candidates) {
    const matched = sgFindNativeSearchButtonFromTarget(el);
    if (matched) found.add(matched);
  }
  return Array.from(found);
}

function sgRelabelVisibleNativeSearchTooltips() {
  if (typeof document === "undefined" || !isCommandPaletteEnabled) return;
  const tipLabel = sgGetCommandPaletteShortcutLabel();
  const surfaces = document.querySelectorAll(".cdk-overlay-container .mdc-tooltip__surface, .cdk-overlay-container .mat-mdc-tooltip");
  for (const el of surfaces) {
    if (el && sgIsNativeSearchLabelText(el.textContent)) {
      el.textContent = tipLabel;
    }
  }
}

function sgSyncNativeSearchButtons(forceScan) {
  if (typeof document === "undefined" || !isCommandPaletteEnabled) return;
  const sideOpen = Boolean(document.querySelector("chat-app.side-nav-open"));
  if (
    !forceScan &&
    sideOpen === _sgCpLastSideOpen &&
    _sgCpCachedSearchBtn &&
    _sgCpCachedSearchBtn.isConnected &&
    _sgCpCachedSearchBtn.dataset &&
    _sgCpCachedSearchBtn.dataset.sgCpSearchProxy === "1"
  ) {
    return;
  }
  _sgCpLastSideOpen = sideOpen;
  const tipLabel = sgGetCommandPaletteShortcutLabel();
  const btns = sgFindAllNativeSearchButtons();
  _sgCpCachedSearchBtn = null;
  for (const host of btns) {
    const targetBtn = host.matches && host.matches("button, a, [role='button']")
      ? host
      : (host.querySelector ? (host.querySelector("button, a, [role='button']") || host) : host);
    if (!targetBtn || !targetBtn.dataset) continue;
    if (!targetBtn.dataset.sgCpSearchProxy) {
      targetBtn.dataset.sgCpSearchProxy = "1";
      if (targetBtn.hasAttribute("aria-label")) {
        targetBtn.dataset.sgOrigAriaLabel = targetBtn.getAttribute("aria-label") || "";
      }
    }
    if (targetBtn.getAttribute("aria-label") !== tipLabel) {
      targetBtn.setAttribute("aria-label", tipLabel);
    }
    const descId = targetBtn.getAttribute("aria-describedby");
    if (descId) {
      const descEl = document.getElementById(descId);
      if (descEl && sgIsNativeSearchLabelText(descEl.textContent)) {
        if (!descEl.dataset.sgOrigText) descEl.dataset.sgOrigText = descEl.textContent;
        descEl.textContent = tipLabel;
      }
    }
    if (!_sgCpCachedSearchBtn) _sgCpCachedSearchBtn = targetBtn;
  }
}

function sgRestoreNativeSearchButtons() {
  _sgCpCachedSearchBtn = null;
  _sgCpLastSideOpen = null;
  if (typeof document === "undefined") return;
  const proxied = document.querySelectorAll('[data-sg-cp-search-proxy="1"]');
  for (const el of proxied) {
    if (typeof el.dataset.sgOrigAriaLabel === "string") {
      el.setAttribute("aria-label", el.dataset.sgOrigAriaLabel);
      delete el.dataset.sgOrigAriaLabel;
    } else {
      el.removeAttribute("aria-label");
    }
    const descId = el.getAttribute("aria-describedby");
    if (descId) {
      const descEl = document.getElementById(descId);
      if (descEl && typeof descEl.dataset.sgOrigText === "string") {
        descEl.textContent = descEl.dataset.sgOrigText;
        delete descEl.dataset.sgOrigText;
      }
    }
    delete el.dataset.sgCpSearchProxy;
  }
}

function sgToggleCommandPalette() {
  if (typeof isExtensionEnabled !== "undefined" && !isExtensionEnabled) return;
  if (!isCommandPaletteEnabled) return;
  if (sgCloseCommandPalette()) return;
  sgOpenCommandPalette();
}

function sgHandleCommandPaletteToggleEvent(e) {
  if (typeof isExtensionEnabled !== "undefined" && !isExtensionEnabled) return;
  if (!isCommandPaletteEnabled) return;
  const ts = e && e.detail && typeof e.detail.timeStamp === "number" ? e.detail.timeStamp : -1;
  if (ts !== -1 && ts === _sgCpLastHandledTs) return;
  _sgCpLastHandledTs = ts;
  sgToggleCommandPalette();
}

function sgHandleNativeSearchClick(e) {
  if (typeof isExtensionEnabled !== "undefined" && !isExtensionEnabled) return;
  if (!isCommandPaletteEnabled || !e) return;
  const matched = sgFindNativeSearchButtonFromTarget(e.target);
  if (!matched) return;
  e.preventDefault();
  e.stopPropagation();
  if (typeof e.stopImmediatePropagation === "function") {
    e.stopImmediatePropagation();
  }
  if (e.type === "click") {
    sgOpenCommandPalette();
  }
}

function sgHandleNativeSearchHover(e) {
  if (typeof isExtensionEnabled !== "undefined" && !isExtensionEnabled) return;
  if (!isCommandPaletteEnabled || !e) return;
  if (!sgFindNativeSearchButtonFromTarget(e.target)) return;
  sgSyncNativeSearchButtons();
  sgRelabelVisibleNativeSearchTooltips();
  if (_sgCpTooltipTimer) clearTimeout(_sgCpTooltipTimer);
  _sgCpTooltipTimer = setTimeout(() => {
    _sgCpTooltipTimer = null;
    sgRelabelVisibleNativeSearchTooltips();
  }, 120);
}

function sgHandleCommandPaletteKeydown(e) {
  if (typeof isExtensionEnabled !== "undefined" && !isExtensionEnabled) return;
  if (!isCommandPaletteEnabled || !e) return;
  if (e.isComposing || 229 === e.keyCode || "Process" === e.key) return;

  if ((e.key === "Enter" || e.key === " ") && !e.ctrlKey && !e.metaKey && !e.altKey) {
    if (sgFindNativeSearchButtonFromTarget(e.target)) {
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === "function") {
        e.stopImmediatePropagation();
      }
      sgOpenCommandPalette();
      return;
    }
  }

  const isMod = Boolean(e.ctrlKey || e.metaKey);
  if (!isMod || e.altKey) return;

  const keyLower = (e.key || "").toLowerCase();
  if (keyLower !== "k" && e.code !== "KeyK") return;

  e.preventDefault();
  e.stopPropagation();
  if (typeof e.stopImmediatePropagation === "function") {
    e.stopImmediatePropagation();
  }
  if (e.shiftKey) return;
  if (typeof e.timeStamp === "number" && e.timeStamp === _sgCpLastHandledTs) return;
  _sgCpLastHandledTs = typeof e.timeStamp === "number" ? e.timeStamp : -1;
  sgToggleCommandPalette();
}

function sgBindCommandPaletteListeners() {
  if (_sgCpListenersBound || typeof window === "undefined") return;
  _sgCpListenersBound = true;
  if (typeof SG !== "undefined" && SG && SG.dispatcher) {
    const P = SG.dispatcher.PRIORITY.COMMAND_PALETTE;
    SG.dispatcher.register("cp:keydown", "window", "keydown", sgHandleCommandPaletteKeydown, P);
    SG.dispatcher.register("cp:click", "window", "click", sgHandleNativeSearchClick, P);
    SG.dispatcher.register("cp:auxclick", "window", "auxclick", sgHandleNativeSearchClick, P);
    SG.dispatcher.register("cp:mouseenter", "window", "mouseenter", sgHandleNativeSearchHover, P);
    SG.dispatcher.register("cp:focusin", "window", "focusin", sgHandleNativeSearchHover, P);
  } else {
    window.addEventListener("keydown", sgHandleCommandPaletteKeydown, true);
    window.addEventListener("click", sgHandleNativeSearchClick, true);
    window.addEventListener("auxclick", sgHandleNativeSearchClick, true);
    window.addEventListener("mouseenter", sgHandleNativeSearchHover, true);
    window.addEventListener("focusin", sgHandleNativeSearchHover, true);
  }
  window.addEventListener("sg-cp-toggle-request", sgHandleCommandPaletteToggleEvent);
}

function sgUnbindCommandPaletteListeners() {
  if (!_sgCpListenersBound || typeof window === "undefined") return;
  _sgCpListenersBound = false;
  if (typeof SG !== "undefined" && SG && SG.dispatcher) {
    SG.dispatcher.unregisterByPrefix("cp:");
  } else {
    window.removeEventListener("keydown", sgHandleCommandPaletteKeydown, true);
    window.removeEventListener("click", sgHandleNativeSearchClick, true);
    window.removeEventListener("auxclick", sgHandleNativeSearchClick, true);
    window.removeEventListener("mouseenter", sgHandleNativeSearchHover, true);
    window.removeEventListener("focusin", sgHandleNativeSearchHover, true);
  }
  window.removeEventListener("sg-cp-toggle-request", sgHandleCommandPaletteToggleEvent);
  if (_sgCpTooltipTimer) {
    clearTimeout(_sgCpTooltipTimer);
    _sgCpTooltipTimer = null;
  }
}

function sgSetCommandPaletteEnabled(enabled) {
  isCommandPaletteEnabled = enabled !== false && (typeof isExtensionEnabled === "undefined" || isExtensionEnabled);
  try {
    if (typeof document !== "undefined" && document.documentElement) {
      document.documentElement.setAttribute("data-sg-cp-active", isCommandPaletteEnabled ? "1" : "0");
    }
  } catch (_e) {}
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("sg_cp_active", isCommandPaletteEnabled ? "1" : "0");
    }
  } catch (_e) {}

  if (!isCommandPaletteEnabled) {
    sgCloseCommandPalette();
    sgUnbindCommandPaletteListeners();
    sgRestoreNativeSearchButtons();
    return;
  }
  sgBindCommandPaletteListeners();
  sgSyncNativeSearchButtons();
}

let _sgCommandPaletteInitialized = false;

function initCommandPaletteSystem() {
  if (("undefined" != typeof SG_IS_SILENT_BG_WORKER_TAB && SG_IS_SILENT_BG_WORKER_TAB) || _sgCommandPaletteInitialized) return;
  _sgCommandPaletteInitialized = true;

  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync) {
    ("function" == typeof sgSyncGetCached ? sgSyncGetCached : chrome.storage.sync.get.bind(chrome.storage.sync))(["extensionEnabled", "commandPaletteEnabled"], (res) => {
      const safe = res || {};
      if (safe.extensionEnabled === false) {
        isExtensionEnabled = false;
        sgSetCommandPaletteEnabled(false);
        return;
      }
      sgSetCommandPaletteEnabled(safe.commandPaletteEnabled !== false);
      if (typeof sgObserverRegistry !== "undefined" && sgObserverRegistry.registerUIRefresh) {
        sgObserverRegistry.registerUIRefresh("commandPalettePendingJump", () => {
          sgConsumePendingPaletteJump();
          if (isCommandPaletteEnabled) sgSyncNativeSearchButtons();
        });
      }
      setTimeout(() => {
        sgConsumePendingPaletteJump();
        if (isCommandPaletteEnabled) sgSyncNativeSearchButtons();
      }, 600);
    });

    const _sgCpStorageHandler = (changes, areaName) => {
      if (areaName !== "sync" || !changes) return;
      if (changes.extensionEnabled) {
        isExtensionEnabled = changes.extensionEnabled.newValue !== false;
      }
      if (changes.extensionEnabled || changes.commandPaletteEnabled) {
        const nextCp = changes.commandPaletteEnabled ? changes.commandPaletteEnabled.newValue !== false : isCommandPaletteEnabled;
        sgSetCommandPaletteEnabled(isExtensionEnabled && nextCp);
      }
    };
    if (typeof SG !== "undefined" && SG && SG.storage) {
      SG.storage.onChanged("command-palette:sync", _sgCpStorageHandler, { area: "sync" });
    } else {
      chrome.storage.onChanged.addListener(_sgCpStorageHandler);
    }
  }
}

if (!("undefined" != typeof SG_IS_SILENT_BG_WORKER_TAB && SG_IS_SILENT_BG_WORKER_TAB) && typeof document !== "undefined" && typeof chrome !== "undefined" && chrome.storage) {
  initCommandPaletteSystem();
}
