// ============================================================================
// SMART CODE BLOCK ACTIONS (Collapse/Expand, Diff with previous)
// ============================================================================

let isCodeBlockActionsEnabled = true;
const SG_CODE_COLLAPSE_MIN_LINES = 30;
const SG_CODE_DIFF_DP_CELL_LIMIT = 250000;

const SG_CODE_LANG_ALIASES = {
  "c++": "cpp",
  "cpp": "cpp",
  "cxx": "cpp",
  "cc": "cpp",
  "hpp": "hpp",
  "hh": "hpp",
  "hxx": "hpp",
  "h": "h",
  "c": "c",
  "c#": "csharp",
  "csharp": "csharp",
  "cs": "csharp",
  "js": "javascript",
  "javascript": "javascript",
  "mjs": "javascript",
  "cjs": "javascript",
  "jsx": "jsx",
  "ts": "typescript",
  "typescript": "typescript",
  "mts": "typescript",
  "cts": "typescript",
  "tsx": "tsx",
  "py": "python",
  "python": "python",
  "python3": "python",
  "sh": "bash",
  "bash": "bash",
  "zsh": "bash",
  "shell": "bash",
  "shellscript": "bash",
  "powershell": "powershell",
  "pwsh": "powershell",
  "ps1": "powershell",
  "yml": "yaml",
  "yaml": "yaml",
  "md": "markdown",
  "markdown": "markdown",
  "htm": "html",
  "html": "html",
  "css": "css",
  "scss": "scss",
  "sass": "sass",
  "less": "less",
  "json": "json",
  "json5": "json",
  "jsonc": "jsonc",
  "rs": "rust",
  "rust": "rust",
  "go": "go",
  "golang": "go",
  "java": "java",
  "kt": "kotlin",
  "kotlin": "kotlin",
  "rb": "ruby",
  "ruby": "ruby",
  "php": "php",
  "sql": "sql",
  "postgresql": "sql",
  "postgres": "sql",
  "mysql": "sql",
  "sqlite": "sql",
  "xml": "xml",
  "svg": "svg",
  "asm": "asm",
  "assembly": "asm",
  "x86asm": "asm",
  "nasm": "asm",
  "gas": "asm",
  "s": "asm",
  "glsl": "glsl",
  "vert": "glsl",
  "frag": "glsl",
  "comp": "glsl",
  "hlsl": "hlsl",
  "wgsl": "wgsl",
  "dockerfile": "dockerfile",
  "docker": "dockerfile",
  "makefile": "makefile",
  "make": "makefile",
  "cmake": "cmake",
  "toml": "toml",
  "ini": "ini",
  "cfg": "ini",
  "swift": "swift",
  "dart": "dart",
  "lua": "lua",
  "r": "r",
  "proto": "proto",
  "protobuf": "proto",
  "graphql": "graphql",
  "gql": "graphql",
  "vue": "vue",
  "svelte": "svelte",
  "diff": "diff",
  "patch": "diff",
  "plaintext": "text",
  "text": "text",
  "txt": "text"
};

const SG_CODE_EXACT_FILENAMES = {
  dockerfile: "Dockerfile",
  makefile: "Makefile"
};

const SG_CODE_LANG_EXT_MAP = {
  cpp: "cpp",
  hpp: "hpp",
  c: "c",
  h: "h",
  csharp: "cs",
  javascript: "js",
  jsx: "jsx",
  typescript: "ts",
  tsx: "tsx",
  python: "py",
  bash: "sh",
  powershell: "ps1",
  yaml: "yml",
  markdown: "md",
  html: "html",
  css: "css",
  scss: "scss",
  sass: "sass",
  less: "less",
  json: "json",
  jsonc: "jsonc",
  rust: "rs",
  go: "go",
  java: "java",
  kotlin: "kt",
  ruby: "rb",
  php: "php",
  sql: "sql",
  xml: "xml",
  svg: "svg",
  asm: "s",
  glsl: "glsl",
  hlsl: "hlsl",
  wgsl: "wgsl",
  cmake: "cmake",
  toml: "toml",
  ini: "ini",
  swift: "swift",
  dart: "dart",
  lua: "lua",
  r: "r",
  proto: "proto",
  graphql: "graphql",
  vue: "vue",
  svelte: "svelte",
  diff: "patch",
  text: "txt"
};

const SG_CODE_KNOWN_SPECIAL_FILES = new Set([
  "Dockerfile",
  "Makefile",
  "CMakeLists.txt",
  "Cargo.toml",
  "go.mod",
  "package.json",
  "tsconfig.json",
  "pom.xml",
  "build.gradle",
  "build.gradle.kts",
  "requirements.txt",
  ".gitignore"
]);

function sgNormalizeCodeLang(raw) {
  const cleaned = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/^language-/, "")
    .replace(/^lang-/, "");
  if (!cleaned) return "";
  return SG_CODE_LANG_ALIASES[cleaned] || cleaned;
}

function sgSanitizeCodeFilename(candidate) {
  if (!candidate) return null;
  let cleaned = String(candidate)
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/\\/g, "/");

  const segments = cleaned.split("/").filter(Boolean);
  let base = segments.length ? segments[segments.length - 1] : "";
  base = base.replace(/\.\.+/g, ".").replace(/[<>:"/\\|?*\x00-\x1f]/g, "");

  if (!base || base === "." || base === "..") return null;
  base = base.replace(/^\.{2,}/, "");
  if (!base || base === ".") return null;

  if (SG_CODE_KNOWN_SPECIAL_FILES.has(base)) {
    return base;
  }

  const extMatch = base.match(/^([A-Za-z0-9_.-]+)\.([A-Za-z][A-Za-z0-9]{0,9})$/);
  if (!extMatch || !extMatch[1] || extMatch[1] === "." || /^\.+$/.test(extMatch[1])) {
    return null;
  }
  return base;
}

function sgExtractCommentFilename(codeText) {
  const lines = String(codeText || "").split(/\r?\n/);
  let checked = 0;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;
    checked++;
    if (checked > 3) break;
    if (trimmed.startsWith("#!")) continue;

    let inner = trimmed;
    let isCommentLine = false;
    const prefixRules = [
      /^\/\/+\s*/,
      /^\/\*\*?\s*/,
      /^\*\s+/,
      /^<!--\s*/,
      /^--\s*/,
      /^;\s*/,
      /^#\s*/
    ];
    for (const rx of prefixRules) {
      if (rx.test(inner)) {
        inner = inner.replace(rx, "");
        isCommentLine = true;
        break;
      }
    }
    if (!isCommentLine) continue;

    inner = inner
      .replace(/\*\/\s*$/, "")
      .replace(/-->\s*$/, "")
      .replace(/^(?:file|filename|path)\s*[:=]\s*/i, "")
      .trim();

    if (!inner) continue;

    const firstToken = inner.split(/\s+/)[0];
    const sanitized = sgSanitizeCodeFilename(firstToken);
    if (sanitized) return sanitized;
  }

  return null;
}

function sgGuessCodeFilename(codeText, rawLang) {
  const fromComment = sgExtractCommentFilename(codeText);
  if (fromComment) return fromComment;

  const norm = sgNormalizeCodeLang(rawLang);
  if (SG_CODE_EXACT_FILENAMES[norm]) {
    return SG_CODE_EXACT_FILENAMES[norm];
  }
  const ext = SG_CODE_LANG_EXT_MAP[norm] || "txt";
  return `snippet.${ext}`;
}

function sgDetectCodeBlockLanguage(codeBlock) {
  if (!codeBlock || typeof codeBlock.getAttribute !== "function") return "";

  const directAttr = codeBlock.getAttribute("data-language");
  if (directAttr && directAttr.trim()) return directAttr.trim();

  if (typeof codeBlock.querySelector === "function") {
    const attrNode = codeBlock.querySelector("[data-language]");
    if (attrNode) {
      const val = attrNode.getAttribute("data-language");
      if (val && val.trim()) return val.trim();
    }

    const codeEl = codeBlock.querySelector("pre code, code, pre");
    if (codeEl && codeEl.className && typeof codeEl.className === "string") {
      const m = codeEl.className.match(/(?:^|\s)(?:language|lang)-([^\s]+)/i);
      if (m && m[1]) return m[1].trim();
    }

    const headerEl = codeBlock.querySelector(".code-block-decoration, .header, .bar");
    if (headerEl && headerEl.cloneNode) {
      const clone = headerEl.cloneNode(true);
      const ignoreNodes = clone.querySelectorAll(".sg-cb-actions, .buttons, button, [role='button'], svg");
      for (const n of ignoreNodes) n.remove();
      const rawText = typeof sgNormalizeInstructionText === "function"
        ? sgNormalizeInstructionText(clone.textContent || "")
        : String(clone.textContent || "").trim();
      if (rawText && rawText.length <= 28 && !/copy|use code|caution|download/i.test(rawText)) {
        return rawText.split(/\s+/)[0];
      }
    }
  }

  return "";
}

function sgGetCodeBlockSource(codeBlock) {
  if (!codeBlock || typeof codeBlock.querySelector !== "function") return "";
  const preCode = codeBlock.querySelector("pre code") || codeBlock.querySelector("pre") || codeBlock.querySelector("code");
  if (!preCode) return "";
  return String(preCode.textContent || "").replace(/\r\n/g, "\n");
}

function sgAssignLineNumbers(ops) {
  let oldLine = 1;
  let newLine = 1;
  let added = 0;
  let removed = 0;
  const rows = [];

  for (const op of ops) {
    if (op.type === "equal") {
      rows.push({ type: "equal", text: op.text, oldLine: oldLine++, newLine: newLine++ });
    } else if (op.type === "del") {
      rows.push({ type: "del", text: op.text, oldLine: oldLine++, newLine: null });
      removed++;
    } else if (op.type === "add") {
      rows.push({ type: "add", text: op.text, oldLine: null, newLine: newLine++ });
      added++;
    }
  }

  return { rows, added, removed };
}

function sgLinearDiffFallback(midOld, midNew) {
  const ops = [];
  const m = midOld.length;
  const n = midNew.length;
  const LOOKAHEAD = 64;
  let i = 0;
  let j = 0;

  while (i < m && j < n) {
    if (midOld[i] === midNew[j]) {
      ops.push({ type: "equal", text: midOld[i] });
      i++;
      j++;
      continue;
    }

    let addAhead = -1;
    const maxJ = Math.min(n, j + LOOKAHEAD);
    for (let k = j + 1; k < maxJ; k++) {
      if (midNew[k] === midOld[i]) {
        addAhead = k - j;
        break;
      }
    }

    let delAhead = -1;
    const maxI = Math.min(m, i + LOOKAHEAD);
    for (let k = i + 1; k < maxI; k++) {
      if (midOld[k] === midNew[j]) {
        delAhead = k - i;
        break;
      }
    }

    if (delAhead !== -1 && (addAhead === -1 || delAhead <= addAhead)) {
      for (let d = 0; d < delAhead; d++) {
        ops.push({ type: "del", text: midOld[i++] });
      }
    } else if (addAhead !== -1) {
      for (let a = 0; a < addAhead; a++) {
        ops.push({ type: "add", text: midNew[j++] });
      }
    } else {
      ops.push({ type: "del", text: midOld[i++] });
      ops.push({ type: "add", text: midNew[j++] });
    }
  }

  while (i < m) ops.push({ type: "del", text: midOld[i++] });
  while (j < n) ops.push({ type: "add", text: midNew[j++] });
  return ops;
}

function sgComputeLineDiff(oldText, newText) {
  const oldLines = String(oldText || "").replace(/\r\n/g, "\n").split("\n");
  const newLines = String(newText || "").replace(/\r\n/g, "\n").split("\n");

  if (oldLines.length === newLines.length && oldLines.every((l, idx) => l === newLines[idx])) {
    const { rows, added, removed } = sgAssignLineNumbers(
      oldLines.map((text) => ({ type: "equal", text }))
    );
    return { rows, added, removed, fallbackUsed: false, isIdentical: true };
  }

  let prefixLen = 0;
  const minLen = Math.min(oldLines.length, newLines.length);
  while (prefixLen < minLen && oldLines[prefixLen] === newLines[prefixLen]) {
    prefixLen++;
  }

  let suffixLen = 0;
  while (
    suffixLen < minLen - prefixLen &&
    oldLines[oldLines.length - 1 - suffixLen] === newLines[newLines.length - 1 - suffixLen]
  ) {
    suffixLen++;
  }

  const midOld = oldLines.slice(prefixLen, oldLines.length - suffixLen);
  const midNew = newLines.slice(prefixLen, newLines.length - suffixLen);
  const m = midOld.length;
  const n = midNew.length;

  let midOps = [];
  let fallbackUsed = false;

  if (m === 0) {
    midOps = midNew.map((text) => ({ type: "add", text }));
  } else if (n === 0) {
    midOps = midOld.map((text) => ({ type: "del", text }));
  } else if (m * n <= SG_CODE_DIFF_DP_CELL_LIMIT) {
    const cols = n + 1;
    const dp = new Int32Array((m + 1) * cols);

    for (let i = m - 1; i >= 0; i--) {
      const rowOffset = i * cols;
      const nextRowOffset = (i + 1) * cols;
      for (let j = n - 1; j >= 0; j--) {
        if (midOld[i] === midNew[j]) {
          dp[rowOffset + j] = dp[nextRowOffset + j + 1] + 1;
        } else {
          const down = dp[nextRowOffset + j];
          const right = dp[rowOffset + j + 1];
          dp[rowOffset + j] = down >= right ? down : right;
        }
      }
    }

    let i = 0;
    let j = 0;
    while (i < m && j < n) {
      if (midOld[i] === midNew[j]) {
        midOps.push({ type: "equal", text: midOld[i] });
        i++;
        j++;
      } else if (dp[(i + 1) * cols + j] >= dp[i * cols + (j + 1)]) {
        midOps.push({ type: "del", text: midOld[i] });
        i++;
      } else {
        midOps.push({ type: "add", text: midNew[j] });
        j++;
      }
    }
    while (i < m) midOps.push({ type: "del", text: midOld[i++] });
    while (j < n) midOps.push({ type: "add", text: midNew[j++] });
  } else {
    fallbackUsed = true;
    midOps = sgLinearDiffFallback(midOld, midNew);
  }

  const allOps = [];
  for (let i = 0; i < prefixLen; i++) {
    allOps.push({ type: "equal", text: oldLines[i] });
  }
  for (const op of midOps) allOps.push(op);
  for (let i = 0; i < suffixLen; i++) {
    allOps.push({ type: "equal", text: oldLines[oldLines.length - suffixLen + i] });
  }

  const { rows, added, removed } = sgAssignLineNumbers(allOps);
  return { rows, added, removed, fallbackUsed, isIdentical: added === 0 && removed === 0 };
}

function sgFilterDiffChangesOnly(rows, contextLines = 3) {
  if (!Array.isArray(rows) || !rows.length) return [];

  const keep = new Array(rows.length).fill(false);
  let hasChange = false;

  for (let i = 0; i < rows.length; i++) {
    if (rows[i].type === "add" || rows[i].type === "del") {
      hasChange = true;
      const start = Math.max(0, i - contextLines);
      const end = Math.min(rows.length - 1, i + contextLines);
      for (let k = start; k <= end; k++) {
        keep[k] = true;
      }
    }
  }

  if (!hasChange) return [];

  const result = [];
  let i = 0;
  while (i < rows.length) {
    if (keep[i]) {
      result.push(rows[i]);
      i++;
    } else {
      let skipped = 0;
      const startRow = rows[i];
      while (i < rows.length && !keep[i]) {
        skipped++;
        i++;
      }
      result.push({
        type: "sep",
        skippedCount: skipped,
        oldStart: startRow.oldLine,
        newStart: startRow.newLine
      });
    }
  }

  return result;
}

function sgFormatUnifiedPatch(diffResult, oldLabel = "previous", newLabel = "current", contextLines = 3) {
  const rows = (diffResult && diffResult.rows) || [];
  const filtered = sgFilterDiffChangesOnly(rows, contextLines);
  if (!filtered.length) {
    return `--- ${oldLabel}\n+++ ${newLabel}\n`;
  }

  const out = [`--- ${oldLabel}`, `+++ ${newLabel}`];
  let hunkLines = [];
  let hunkOldStart = 1;
  let hunkNewStart = 1;
  let hunkOldCount = 0;
  let hunkNewCount = 0;

  function flushHunk() {
    if (!hunkLines.length) return;
    out.push(`@@ -${hunkOldStart},${hunkOldCount} +${hunkNewStart},${hunkNewCount} @@`);
    out.push(...hunkLines);
    hunkLines = [];
    hunkOldCount = 0;
    hunkNewCount = 0;
  }

  for (const row of filtered) {
    if (row.type === "sep") {
      flushHunk();
      continue;
    }
    if (!hunkLines.length) {
      hunkOldStart = row.oldLine || 1;
      hunkNewStart = row.newLine || 1;
    }
    if (row.type === "equal") {
      hunkLines.push(` ${row.text}`);
      hunkOldCount++;
      hunkNewCount++;
    } else if (row.type === "del") {
      hunkLines.push(`-${row.text}`);
      hunkOldCount++;
    } else if (row.type === "add") {
      hunkLines.push(`+${row.text}`);
      hunkNewCount++;
    }
  }
  flushHunk();
  return out.join("\n");
}

function sgCollectChatCodeBlocks(rootDoc) {
  const doc = rootDoc || (typeof document !== "undefined" ? document : null);
  if (!doc || typeof doc.querySelectorAll !== "function") return [];

  const nodes = Array.from(doc.querySelectorAll("code-block"));
  const items = [];

  for (const cb of nodes) {
    if (typeof cb.closest === "function" && cb.closest('[id^="sg-"]')) {
      continue;
    }
    const langRaw = sgDetectCodeBlockLanguage(cb);
    const langNorm = sgNormalizeCodeLang(langRaw);
    const codeText = sgGetCodeBlockSource(cb);
    const commentFilename = sgExtractCommentFilename(codeText);
    const filename = commentFilename || sgGuessCodeFilename(codeText, langRaw);

    items.push({
      index: items.length,
      element: cb,
      langRaw,
      langNorm,
      codeText,
      commentFilename,
      filename
    });
  }

  return items;
}

function sgFindPreviousCodeBlockMatches(currentItem, allItems) {
  if (!currentItem || !Array.isArray(allItems)) return [];

  const curComment = (currentItem.commentFilename || "").toLowerCase();
  const curLang = currentItem.langNorm || "";
  const exactFileMatches = [];
  const sameLangMatches = [];

  for (let i = currentItem.index - 1; i >= 0; i--) {
    const cand = allItems[i];
    if (!cand) continue;

    const candComment = (cand.commentFilename || "").toLowerCase();
    const isExactFilename = curComment !== "" && candComment !== "" && curComment === candComment;
    const isSameLang = curLang !== "" && cand.langNorm === curLang;

    if (isExactFilename) {
      exactFileMatches.push({ ...cand, matchReason: "filename" });
    } else if (isSameLang) {
      sameLangMatches.push({ ...cand, matchReason: "language" });
    }
  }

  return [...exactFileMatches, ...sameLangMatches];
}

function sgOpenCodeDiffModal(currentItem, matches) {
  if (!matches || !matches.length) {
    if (typeof showToast === "function") {
      showToast("No earlier matching code block found in this chat to diff against.", "info");
    }
    return;
  }

  const existing = document.getElementById("sg-code-diff-overlay");
  if (existing) existing.remove();

  let selectedBaselineIdx = 0;
  let viewMode = "changes";
  let lastDiff = null;

  const { overlay, close } = createModalOverlay({
    id: "sg-code-diff-overlay",
    zIndex: 2150
  });

  const modal = sgSkillEl("div", {
    className: "sg-diff-modal",
    role: "dialog",
    "aria-modal": "true",
    "aria-label": `Code Diff: ${currentItem.filename}`
  });

  const diffIcon = typeof sgCreateSvgIcon === "function"
    ? sgCreateSvgIcon(["M7 5v14M17 5v14M4 8l3-3 3 3M14 16l3 3 3-3"], 18)
    : sgSkillEl("span", { textContent: "⇄" });

  const statsEl = sgSkillEl("span", { className: "sg-diff-stats" });
  const header = sgSkillEl("div", { className: "sg-diff-header" }, [
    sgSkillEl("div", { className: "sg-diff-title-group" }, [
      diffIcon,
      sgSkillEl("span", { className: "sg-diff-title", textContent: `Diff: ${currentItem.filename}` }),
      statsEl
    ]),
    sgSkillEl("button", {
      type: "button",
      className: "sg-diff-close-btn",
      "aria-label": "Close diff modal",
      textContent: "×",
      onClick: () => close()
    })
  ]);

  const baselineSelect = sgSkillEl("select", {
    className: "sg-diff-select",
    "aria-label": "Compare baseline version"
  });
  matches.forEach((m, idx) => {
    const label = `Block #${m.index + 1} — ${m.filename} (${m.matchReason === "filename" ? "same file" : (m.langNorm || "text")})`;
    baselineSelect.appendChild(sgSkillEl("option", { value: String(idx), textContent: label }));
  });

  const changesBtn = sgSkillEl("button", {
    type: "button",
    className: "sg-diff-tab sg-diff-tab-active",
    textContent: "Changes Only (±3)"
  });
  const fullBtn = sgSkillEl("button", {
    type: "button",
    className: "sg-diff-tab",
    textContent: "Full File"
  });

  const copyPatchBtn = sgSkillEl("button", {
    type: "button",
    className: "sg-diff-copy-btn",
    textContent: "Copy Patch"
  });

  const toolbar = sgSkillEl("div", { className: "sg-diff-toolbar" }, [
    sgSkillEl("label", { className: "sg-diff-baseline-label" }, [
      sgSkillEl("span", { textContent: "Compare against:" }),
      baselineSelect
    ]),
    sgSkillEl("div", { className: "sg-diff-toolbar-right" }, [
      sgSkillEl("div", { className: "sg-diff-tabs" }, [changesBtn, fullBtn]),
      copyPatchBtn
    ])
  ]);

  const body = sgSkillEl("div", { className: "sg-diff-body" });

  function renderDiffBody() {
    const baseline = matches[selectedBaselineIdx] || matches[0];
    lastDiff = sgComputeLineDiff(baseline.codeText, currentItem.codeText);

    while (statsEl.firstChild) statsEl.removeChild(statsEl.firstChild);
    statsEl.appendChild(sgSkillEl("span", { className: "sg-diff-stat-add", textContent: `+${lastDiff.added}` }));
    statsEl.appendChild(sgSkillEl("span", { className: "sg-diff-stat-del", textContent: `-${lastDiff.removed}` }));
    if (lastDiff.fallbackUsed) {
      statsEl.appendChild(sgSkillEl("span", { className: "sg-diff-stat-note", textContent: "approx (large)" }));
    }

    while (body.firstChild) body.removeChild(body.firstChild);

    if (lastDiff.isIdentical) {
      body.appendChild(
        sgSkillEl("div", {
          className: "sg-diff-identical",
          textContent: `No differences between Block #${baseline.index + 1} and Block #${currentItem.index + 1}.`
        })
      );
      return;
    }

    const displayRows = viewMode === "changes"
      ? sgFilterDiffChangesOnly(lastDiff.rows, 3)
      : lastDiff.rows;

    const table = sgSkillEl("div", { className: "sg-diff-table" });
    for (const row of displayRows) {
      if (row.type === "sep") {
        table.appendChild(
          sgSkillEl("div", {
            className: "sg-diff-sep",
            textContent: `⋯ ${row.skippedCount} unchanged lines ⋯`
          })
        );
        continue;
      }

      const rowCls = row.type === "add"
        ? "sg-diff-row sg-diff-row-add"
        : (row.type === "del" ? "sg-diff-row sg-diff-row-del" : "sg-diff-row sg-diff-row-eq");
      const marker = row.type === "add" ? "+" : (row.type === "del" ? "-" : " ");

      table.appendChild(
        sgSkillEl("div", { className: rowCls }, [
          sgSkillEl("span", { className: "sg-diff-ln", textContent: row.oldLine ? String(row.oldLine) : "" }),
          sgSkillEl("span", { className: "sg-diff-ln", textContent: row.newLine ? String(row.newLine) : "" }),
          sgSkillEl("span", { className: "sg-diff-sign", textContent: marker }),
          sgSkillEl("span", { className: "sg-diff-code", textContent: row.text })
        ])
      );
    }

    body.appendChild(table);
  }

  baselineSelect.addEventListener("change", () => {
    selectedBaselineIdx = Number(baselineSelect.value) || 0;
    renderDiffBody();
  });

  changesBtn.addEventListener("click", () => {
    viewMode = "changes";
    changesBtn.classList.add("sg-diff-tab-active");
    fullBtn.classList.remove("sg-diff-tab-active");
    renderDiffBody();
  });

  fullBtn.addEventListener("click", () => {
    viewMode = "full";
    fullBtn.classList.add("sg-diff-tab-active");
    changesBtn.classList.remove("sg-diff-tab-active");
    renderDiffBody();
  });

  copyPatchBtn.addEventListener("click", async () => {
    const baseline = matches[selectedBaselineIdx] || matches[0];
    const patch = sgFormatUnifiedPatch(
      lastDiff,
      `a/${baseline.filename}#block-${baseline.index + 1}`,
      `b/${currentItem.filename}#block-${currentItem.index + 1}`
    );
    try {
      await navigator.clipboard.writeText(patch);
      copyPatchBtn.textContent = "Copied Patch!";
      setTimeout(() => {
        copyPatchBtn.textContent = "Copy Patch";
      }, 1500);
    } catch (_e) {
      if (typeof showToast === "function") {
        showToast("Clipboard permission denied.", "error");
      }
    }
  });

  modal.appendChild(header);
  modal.appendChild(toolbar);
  modal.appendChild(body);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  renderDiffBody();
  requestAnimationFrame(() => overlay.classList.add("show"));
}

function sgCountLines(text) {
  if (!text) return 0;
  let count = 1;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 10) count++;
  }
  return count;
}

function sgEnsureCodeBlockHeader(codeBlock) {
  let header = codeBlock.querySelector(".code-block-decoration, .header, .bar");
  if (!header) {
    header = sgSkillEl("div", { className: "sg-cb-fallback-header" });
    codeBlock.insertBefore(header, codeBlock.firstChild);
  }
  return header;
}

function sgSyncCodeBlockCollapseUI(codeBlock, lineCount, collapseBtn) {
  const isLong = lineCount > SG_CODE_COLLAPSE_MIN_LINES;
  let expandBar = codeBlock.querySelector(":scope > .sg-cb-expand-bar");

  if (!isLong) {
    codeBlock.classList.remove("sg-cb-collapsed");
    if (expandBar) expandBar.remove();
    if (collapseBtn) collapseBtn.classList.add("sg-cb-hidden");
    return;
  }

  if (collapseBtn) collapseBtn.classList.remove("sg-cb-hidden");

  if (!codeBlock.dataset.sgCbUserToggled) {
    codeBlock.classList.add("sg-cb-collapsed");
  }

  const collapsed = codeBlock.classList.contains("sg-cb-collapsed");
  if (collapseBtn) {
    collapseBtn.title = collapsed ? `Expand code (${lineCount} lines)` : "Collapse code";
    collapseBtn.setAttribute("aria-label", collapseBtn.title);
    collapseBtn.classList.toggle("sg-cb-btn-active", collapsed);
  }

  if (collapsed) {
    if (!expandBar) {
      expandBar = sgSkillEl("button", {
        type: "button",
        className: "sg-cb-expand-bar",
        onClick: (e) => {
          e.preventDefault();
          e.stopPropagation();
          codeBlock.dataset.sgCbUserToggled = "1";
          codeBlock.classList.remove("sg-cb-collapsed");
          sgSyncCodeBlockCollapseUI(codeBlock, sgCountLines(sgGetCodeBlockSource(codeBlock)), collapseBtn);
        }
      });
      codeBlock.appendChild(expandBar);
    }
    const labelText = `Show all ${lineCount} lines`;
    if (expandBar.textContent !== labelText) {
      expandBar.textContent = labelText;
    }
  } else if (expandBar) {
    expandBar.remove();
  }
}

function sgEnhanceCodeBlock(codeBlock, item, allItems) {
  if (!codeBlock || (typeof codeBlock.closest === "function" && codeBlock.closest('[id^="sg-"]'))) {
    return;
  }

  const header = sgEnsureCodeBlockHeader(codeBlock);
  let actions = header.querySelector(":scope > .sg-cb-actions");

  if (!actions) {
    const foldIcon = typeof sgCreateSvgIcon === "function"
      ? sgCreateSvgIcon(["M7 14l5-5 5 5M7 20l5-5 5 5", "M7 4l5 5 5-5"], 14)
      : sgSkillEl("span", { textContent: "↕" });
    const collapseBtn = sgSkillEl("button", {
      type: "button",
      className: "sg-cb-btn sg-cb-collapse-btn",
      title: "Collapse / Expand code",
      "aria-label": "Collapse or expand code"
    }, [foldIcon]);

    const diffIcon = typeof sgCreateSvgIcon === "function"
      ? sgCreateSvgIcon(["M6 5v14M18 5v14M3 8l3-3 3 3M15 16l3 3 3-3"], 14)
      : sgSkillEl("span", { textContent: "⇄" });
    const diffBtn = sgSkillEl("button", {
      type: "button",
      className: "sg-cb-btn sg-cb-diff-btn",
      title: "Diff with previous version in chat",
      "aria-label": "Diff with previous version in chat"
    }, [diffIcon]);

    collapseBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      codeBlock.dataset.sgCbUserToggled = "1";
      codeBlock.classList.toggle("sg-cb-collapsed");
      const currentLines = sgCountLines(sgGetCodeBlockSource(codeBlock));
      sgSyncCodeBlockCollapseUI(codeBlock, currentLines, collapseBtn);
    });

    diffBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const blocks = sgCollectChatCodeBlocks(document);
      const current = blocks.find((b) => b.element === codeBlock);
      if (!current) return;
      const matches = sgFindPreviousCodeBlockMatches(current, blocks);
      sgOpenCodeDiffModal(current, matches);
    });

    actions = sgSkillEl("div", { className: "sg-cb-actions" }, [collapseBtn, diffBtn]);

    const nativeBtns = header.querySelector(":scope > .buttons");
    if (nativeBtns) {
      header.insertBefore(actions, nativeBtns);
    } else {
      header.appendChild(actions);
    }
  }

  const collapseBtn = actions.querySelector(".sg-cb-collapse-btn");
  const diffBtn = actions.querySelector(".sg-cb-diff-btn");

  if (diffBtn) {
    const hasPrevMatch = sgFindPreviousCodeBlockMatches(item, allItems).length > 0;
    diffBtn.classList.toggle("sg-cb-btn-muted", !hasPrevMatch);
    diffBtn.title = hasPrevMatch
      ? "Diff with previous matching code block"
      : "No earlier matching code block in this chat";
  }

  const lineCount = sgCountLines(item.codeText);
  sgSyncCodeBlockCollapseUI(codeBlock, lineCount, collapseBtn);
  if (codeBlock.dataset) {
    codeBlock.dataset.sgCbLen = String(item.codeText ? item.codeText.length : 0);
    codeBlock.dataset.sgCbIdx = String(item.index);
  }
}

function sgTeardownCodeBlockActions() {
  if (typeof document === "undefined") return;
  const diffOverlay = document.getElementById("sg-code-diff-overlay");
  if (diffOverlay) diffOverlay.remove();

  for (const el of document.querySelectorAll(".sg-cb-actions, .sg-cb-expand-bar")) {
    el.remove();
  }
  for (const fb of document.querySelectorAll(".sg-cb-fallback-header")) {
    if (!fb.children.length) fb.remove();
  }
  for (const cb of document.querySelectorAll("code-block.sg-cb-collapsed")) {
    cb.classList.remove("sg-cb-collapsed");
  }
  for (const cb of document.querySelectorAll("[data-sg-cb-len]")) {
    delete cb.dataset.sgCbLen;
    delete cb.dataset.sgCbIdx;
  }
}

let _sgCodeBlockLastCount = -1;
let _sgCodeBlockRefreshTimer = null;

function sgScheduleCodeBlockActionsRefresh() {
  if (!isExtensionEnabled || !isCodeBlockActionsEnabled || _sgCodeBlockRefreshTimer) return;
  _sgCodeBlockRefreshTimer = setTimeout(() => {
    _sgCodeBlockRefreshTimer = null;
    sgRefreshCodeBlockActions();
  }, 200);
}

function sgRefreshCodeBlockActions() {
  if (typeof document === "undefined" || !isExtensionEnabled || !isCodeBlockActionsEnabled) return;

  const nodes = document.querySelectorAll("code-block");
  if (0 === nodes.length) {
    _sgCodeBlockLastCount = 0;
    return;
  }

  let dirty = nodes.length !== _sgCodeBlockLastCount;
  if (!dirty) {
    let validIdx = 0;
    for (const cb of nodes) {
      if (typeof cb.closest === "function" && cb.closest('[id^="sg-"]')) continue;
      const preCode = cb.querySelector("pre code") || cb.querySelector("pre") || cb.querySelector("code");
      const raw = preCode ? String(preCode.textContent || "") : "";
      const curLen = raw.includes("\r") ? raw.replace(/\r\n/g, "\n").length : raw.length;
      if (!cb.dataset || cb.dataset.sgCbLen !== String(curLen) || cb.dataset.sgCbIdx !== String(validIdx) || !cb.querySelector(".sg-cb-actions")) {
        dirty = true;
        break;
      }
      validIdx++;
    }
  }
  if (!dirty) return;
  _sgCodeBlockLastCount = nodes.length;

  const allItems = sgCollectChatCodeBlocks(document);
  for (const item of allItems) {
    const el = item.element;
    const lenStr = String(item.codeText ? item.codeText.length : 0);
    const idxStr = String(item.index);
    if (el && el.dataset && el.dataset.sgCbLen === lenStr && el.dataset.sgCbIdx === idxStr && el.querySelector && el.querySelector(".sg-cb-actions")) {
      continue;
    }
    sgEnhanceCodeBlock(el, item, allItems);
  }
}

function sgSetCodeBlockActionsEnabled(enabled) {
  isCodeBlockActionsEnabled = enabled !== false && isExtensionEnabled;
  if (!isCodeBlockActionsEnabled) {
    if (_sgCodeBlockRefreshTimer) {
      clearTimeout(_sgCodeBlockRefreshTimer);
      _sgCodeBlockRefreshTimer = null;
    }
    _sgCodeBlockLastCount = -1;
    sgTeardownCodeBlockActions();
    return;
  }
  _sgCodeBlockLastCount = -1;
  sgRefreshCodeBlockActions();
}

function initCodeBlockActionsSystem() {
  if ("undefined" != typeof SG_IS_SILENT_BG_WORKER_TAB && SG_IS_SILENT_BG_WORKER_TAB) return;
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync) {
    ("function" == typeof sgSyncGetCached ? sgSyncGetCached : chrome.storage.sync.get.bind(chrome.storage.sync))(["extensionEnabled", "codeBlockActionsEnabled"], (res) => {
      const safe = res || {};
      if (safe.extensionEnabled === false) {
        isExtensionEnabled = false;
        sgSetCodeBlockActionsEnabled(false);
        return;
      }
      sgSetCodeBlockActionsEnabled(safe.codeBlockActionsEnabled !== false);
      if (typeof sgObserverRegistry !== "undefined" && sgObserverRegistry.registerUIRefresh) {
        sgObserverRegistry.registerUIRefresh("codeBlockActions", sgScheduleCodeBlockActionsRefresh);
      }
    });

    const _sgCodeBlockStorageHandler = (changes, areaName) => {
      if (areaName !== "sync" || !changes) return;
      if (changes.extensionEnabled) {
        isExtensionEnabled = changes.extensionEnabled.newValue !== false;
      }
      if (changes.extensionEnabled || changes.codeBlockActionsEnabled) {
        const nextCb = changes.codeBlockActionsEnabled ? changes.codeBlockActionsEnabled.newValue !== false : isCodeBlockActionsEnabled;
        sgSetCodeBlockActionsEnabled(isExtensionEnabled && nextCb);
      }
    };
    if (typeof SG !== "undefined" && SG && SG.storage) {
      SG.storage.onChanged("code-blocks:sync", _sgCodeBlockStorageHandler, { area: "sync" });
    } else {
      chrome.storage.onChanged.addListener(_sgCodeBlockStorageHandler);
    }
  }
}

if (!("undefined" != typeof SG_IS_SILENT_BG_WORKER_TAB && SG_IS_SILENT_BG_WORKER_TAB) && typeof document !== "undefined" && typeof chrome !== "undefined" && chrome.storage) {
  initCodeBlockActionsSystem();
}
