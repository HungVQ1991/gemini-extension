/* ==========================================================================
   MODULE: FOLDER UPLOADER (Smart Context Bundler & Directory Reader)
   ========================================================================== */
let isFolderUploadEnabled = true;

const SG_FOLDER_HARD_IGNORED_DIRS = new Set([
  "node_modules", ".git", ".next", ".nuxt", "__pycache__",
  ".vscode", ".idea", ".turbo", ".svelte-kit", ".cache", "coverage",
  ".hg", ".svn"
]);

const SG_FOLDER_FALLBACK_IGNORED_DIRS = new Set([
  "dist", "build", "out", "target", "obj", "vendor"
]);

const SG_FOLDER_BINARY_EXTS = [
  ".png", ".jpg", ".jpeg", ".gif", ".ico", ".webp", ".avif", ".bmp", ".tiff",
  ".mp4", ".mp3", ".wav", ".ogg", ".webm", ".avi", ".mov", ".flac", ".m4a",
  ".zip", ".tar", ".gz", ".7z", ".rar", ".bz2", ".xz",
  ".exe", ".dll", ".so", ".dylib", ".bin", ".iso", ".img",
  ".pdf", ".docx", ".xlsx", ".pptx", ".doc", ".xls", ".ppt",
  ".woff", ".woff2", ".ttf", ".eot", ".otf",
  ".pyc", ".pyo", ".class", ".jar", ".war", ".wasm", ".o", ".a", ".lib", ".pdb"
];

function sgIsHardIgnoredDirName(name) {
  return SG_FOLDER_HARD_IGNORED_DIRS.has(String(name || "").toLowerCase());
}

function sgIsSensitiveOrBinaryPath(path) {
  if (!path) return true;
  const normalized = String(path).replace(/\\/g, "/");
  const segments = normalized.split("/");
  const baseName = (segments[segments.length - 1] || "").toLowerCase();
  if (!baseName) return true;

  if (
    baseName === ".ds_store" ||
    baseName === "thumbs.db" ||
    baseName.startsWith(".env") ||
    baseName.endsWith(".pem") ||
    baseName.endsWith(".key") ||
    baseName === "id_rsa" ||
    baseName === "id_ed25519" ||
    baseName.endsWith(".pfx") ||
    baseName.endsWith(".keystore")
  ) {
    return true;
  }

  return SG_FOLDER_BINARY_EXTS.some((ext) => baseName.endsWith(ext));
}

function sgHasHardIgnoredAncestor(path, rootFolderName = "") {
  const normalized = String(path || "").replace(/\\/g, "/");
  const segments = normalized.split("/");
  for (let i = 0; i < segments.length - 1; i++) {
    if (i === 0 && rootFolderName && segments[0] === rootFolderName) {
      continue;
    }
    if (sgIsHardIgnoredDirName(segments[i])) {
      return true;
    }
  }
  return false;
}

function shouldIgnorePath(path) {
  if (!path) return true;
  const normalized = String(path).replace(/\\/g, "/");
  const segments = normalized.split("/");

  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i].toLowerCase();
    if (SG_FOLDER_HARD_IGNORED_DIRS.has(seg) || SG_FOLDER_FALLBACK_IGNORED_DIRS.has(seg)) {
      return true;
    }
    if (seg === "bin") {
      const prevSegments = segments.slice(0, i);
      if (!prevSegments.includes("src")) {
        return true;
      }
    }
  }

  return sgIsSensitiveOrBinaryPath(normalized);
}

function sgGitignoreGlobToRegex(rawPattern, anchored) {
  let rx = "";
  let i = 0;
  const len = rawPattern.length;

  while (i < len) {
    const ch = rawPattern[i];
    if (ch === "\\" && i + 1 < len) {
      rx += rawPattern[i + 1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      i += 2;
      continue;
    }
    if (ch === "*") {
      if (rawPattern[i + 1] === "*") {
        const nextAfter = rawPattern[i + 2];
        if (nextAfter === "/") {
          rx += "(?:.+/)?";
          i += 3;
          continue;
        }
        rx += ".*";
        i += 2;
        continue;
      }
      rx += "[^/]*";
      i += 1;
      continue;
    }
    if (ch === "?") {
      rx += "[^/]";
      i += 1;
      continue;
    }
    if (ch === "[") {
      const closeIdx = rawPattern.indexOf("]", i + 1);
      if (closeIdx !== -1) {
        let clsBody = rawPattern.slice(i + 1, closeIdx);
        if (clsBody.startsWith("!")) {
          clsBody = "^" + clsBody.slice(1);
        }
        rx += `[${clsBody}]`;
        i = closeIdx + 1;
        continue;
      }
      rx += "\\[";
      i += 1;
      continue;
    }
    rx += ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    i += 1;
  }

  const finalPattern = anchored ? `^${rx}$` : `(?:^|/)${rx}$`;
  return new RegExp(finalPattern);
}

function sgTrimUnescapedTrailingSpaces(line) {
  let end = line.length;
  while (end > 0 && (line[end - 1] === " " || line[end - 1] === "\t")) {
    let backslashCount = 0;
    let j = end - 2;
    while (j >= 0 && line[j] === "\\") {
      backslashCount++;
      j--;
    }
    if (backslashCount % 2 === 1) break;
    end--;
  }
  return line.slice(0, end);
}

function sgParseGitignoreContent(content, baseDir = "") {
  const normalizedBase = String(baseDir || "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  const rules = [];
  const lines = String(content || "").split(/\r?\n/);

  for (const rawLine of lines) {
    let line = sgTrimUnescapedTrailingSpaces(rawLine);
    if (!line || line.startsWith("#")) continue;

    let negated = false;
    if (line.startsWith("!")) {
      negated = true;
      line = line.slice(1);
    }
    if (!line) continue;

    let dirOnly = false;
    while (line.endsWith("/")) {
      dirOnly = true;
      line = line.slice(0, -1);
    }
    if (!line) continue;

    const anchored = line.includes("/");
    if (line.startsWith("/")) {
      line = line.slice(1);
    }
    if (!line) continue;

    try {
      const regex = sgGitignoreGlobToRegex(line, anchored);
      rules.push({ baseDir: normalizedBase, negated, dirOnly, regex });
    } catch (_e) {
      // Skip malformed regex rule cleanly
    }
  }

  return rules;
}

function sgBuildGitignoreMatcher(gitignoreEntries) {
  const sortedEntries = [...(gitignoreEntries || [])]
    .map((entry) => ({
      baseDir: String(entry.baseDir || "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, ""),
      rules: Array.isArray(entry.rules) ? entry.rules : []
    }))
    .sort((a, b) => a.baseDir.length - b.baseDir.length);

  function evaluateTarget(targetPath, isDir) {
    let ignored = false;
    for (const entry of sortedEntries) {
      if (entry.baseDir) {
        if (!targetPath.startsWith(entry.baseDir + "/")) continue;
      }
      const subPath = entry.baseDir ? targetPath.slice(entry.baseDir.length + 1) : targetPath;
      if (!subPath) continue;

      for (const rule of entry.rules) {
        if (rule.dirOnly && !isDir) continue;
        if (rule.regex.test(subPath)) {
          ignored = !rule.negated;
        }
      }
    }
    return ignored;
  }

  return function isPathIgnoredByGitignore(relPath, isDir = false) {
    const cleanPath = String(relPath || "").replace(/\\/g, "/").replace(/^\/+/, "");
    if (!cleanPath || !sortedEntries.length) return false;

    const segments = cleanPath.split("/");
    let prefix = "";
    for (let i = 0; i < segments.length - 1; i++) {
      prefix = prefix ? `${prefix}/${segments[i]}` : segments[i];
      if (evaluateTarget(prefix, true)) {
        return true;
      }
    }
    return evaluateTarget(cleanPath, isDir);
  };
}

async function isBinaryFile(file) {
  try {
    const slice = file.slice(0, 8192);
    const buffer = await slice.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.length; i++) {
      if (bytes[i] === 0) return true;
    }
    return false;
  } catch (e) {
    return false;
  }
}

function buildDirectoryTree(paths) {
  const sorted = [...paths].sort();
  return sorted.map(p => `- ${p}`).join("\n");
}

async function readFileSystemEntryRecursively(entry, path = "") {
  if (entry.isFile) {
    return new Promise(resolve => {
      entry.file(f => {
        f.relativePath = path + f.name;
        resolve([f]);
      }, () => resolve([]));
    });
  } else if (entry.isDirectory) {
    if (path !== "" && sgIsHardIgnoredDirName(entry.name)) {
      return [];
    }
    const reader = entry.createReader();
    const entries = await new Promise(resolve => {
      const all = [];
      const readNext = () => {
        reader.readEntries(results => {
          if (!results || !results.length) return resolve(all);
          all.push(...results);
          readNext();
        }, () => resolve(all));
      };
      readNext();
    });
    const subFiles = await Promise.all(
      entries.map(e => readFileSystemEntryRecursively(e, path + entry.name + "/"))
    );
    return subFiles.flat();
  }
  return [];
}

async function attachFileToGeminiInput(file) {
  _sgBlockFilePicker();
  let i = null;
  try {
    const r = [
      'button[aria-label="Open upload file menu"]',
      'button[aria-label="Open input area menu to select tools and upload types"]',
      'button[aria-label="More options for input"]',
      'button[aria-label="Upload & tools"]',
      'button[aria-label*="Uploads and tools" i]',
      'button[aria-label*="Upload & tools" i]',
      'button[aria-label*="Upload and tools" i]',
      'button[aria-label*="Add file" i]',
      'button[aria-label*="Upload file" i]',
      'button[aria-label*="Nội dung tải lên" i]',
      'button[data-test-id="uploader-button"]',
      'button[data-test-id="input-area-menu-button"]',
      'button.upload-card-button',
      'button[aria-label*="tải tệp" i]',
      'button[aria-label*="trình đơn" i]'
    ];
    let s = null;
    for (const e of r) {
      s = document.querySelector(e);
      if (s) break;
    }
    if (!s) {
      const e = domQuery("inputAreaContainer");
      const btnSel = 'button:has(mat-icon[fonticon="plus"]), button:has(mat-icon[fonticon="add"]), button:has(mat-icon[data-mat-icon-name="plus"]), button:has(mat-icon[data-mat-icon-name="add"])';
      s = (e && e.querySelector(btnSel)) || document.querySelector(btnSel);
    }
    if (!s) {
      const text = await file.text();
      setPromptText(text);
      return false;
    }

    ensureAttachMenuHideStyle();
    document.body.classList.add("sg-hiding-attach-menu");
    i = setTimeout(() => document.body.classList.remove("sg-hiding-attach-menu"), 5000);

    s.click();
    await new Promise(e => setTimeout(e, 250));

    const l = [
      'gem-menu-item[data-test-id="local-images-files-uploader-button"], [role="menuitem"][data-test-id="local-images-files-uploader-button"], button[data-test-id="local-images-files-uploader-button"]',
      '[data-test-id="local-images-files-uploader-button"]',
      'gem-menu-item:has(mat-icon[fonticon="attach_file"]), gem-menu-item:has(mat-icon[fonticon="attach_file_add"]), gem-menu-item:has(mat-icon[fonticon="upload_file"]), gem-menu-item:has(mat-icon[data-mat-icon-name="attach_file"]), gem-menu-item:has(mat-icon[data-mat-icon-name="upload_file"])',
      '[role="menuitem"]:has(mat-icon[fonticon="attach_file"]), [role="menuitem"]:has(mat-icon[fonticon="attach_file_add"]), [role="menuitem"]:has(mat-icon[fonticon="upload_file"]), [role="menuitem"]:has(mat-icon[data-mat-icon-name="attach_file"]), [role="menuitem"]:has(mat-icon[data-mat-icon-name="upload_file"])',
      'gem-menu-item[aria-label="Files" i], [role="menuitem"][aria-label="Files" i], gem-menu-item[aria-label="File" i], [role="menuitem"][aria-label="File" i]',
      'button[aria-label^="Upload file" i]',
      'gem-menu-item[aria-label^="Upload file" i], menu-item[aria-label="Upload files"], menu-item[aria-label^="Upload file" i]',
      'button[aria-label="Upload files"]',
      '[role="menuitem"][aria-label^="Upload file" i]',
      'gem-menu-item[aria-label*="Add file" i], [role="menuitem"][aria-label*="Add file" i], button[aria-label*="Add file" i]',
      'gem-menu-item[aria-label*="Upload from" i], [role="menuitem"][aria-label*="Upload from" i], button[aria-label*="Upload from" i]',
      'gem-menu-item[aria-label*="Tải tệp" i], button[aria-label*="Tải tệp" i], menu-item[aria-label*="Tải tệp" i], [role="menuitem"][aria-label*="Tải tệp" i]',
      'images-files-uploader [role="menuitem"], images-files-uploader button'
    ];
    let c = null;
    for (const e of l) {
      const found = Array.from(document.querySelectorAll(e)).find(el =>
        !el.closest("#sg-folder-upload-menu-item") && isFolderMenuElementVisible(el)
      );
      if (found) {
        c = found;
        break;
      }
    }
    if (!c) {
      const items = document.querySelectorAll('.cdk-overlay-pane gem-menu-item, .cdk-overlay-pane [role="menuitem"], .cdk-overlay-pane button, .cdk-overlay-pane menu-item, .mat-mdc-menu-panel button, [role="menu"] [role="menuitem"]');
      for (const item of items) {
        if (item.closest("#sg-folder-upload-menu-item") || !isFolderMenuElementVisible(item)) continue;
        const clone = item.cloneNode(true);
        clone.querySelectorAll("mat-icon, gem-icon, svg, .cdk-visually-hidden").forEach(n => n.remove());
        const txt = (clone.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
        if (!txt || txt.includes("lựa chọn tải lên khác") || txt.includes("more upload") || txt.includes("other upload") || txt.includes("more options")) continue;
        if (
          txt === "tệp" ||
          txt === "file" ||
          txt === "files" ||
          txt === "local files" ||
          txt.includes("tải tệp") ||
          txt.includes("upload file") ||
          txt.includes("add file") ||
          txt.includes("upload from computer") ||
          txt.includes("upload from device") ||
          txt.includes("choose file")
        ) {
          c = item;
          break;
        }
      }
    }
    if (!c) {
      document.body.click();
      const text = await file.text();
      setPromptText(text);
      return false;
    }

    c.click();
    await new Promise(e => setTimeout(e, 400));

    const d = document.querySelector('input[type="file"][data-sg-intercepted="true"]') ||
              document.querySelector('input[type="file"][name="Filedata"]') ||
              Array.from(document.querySelectorAll('input[type="file"]')).find(el => el.id !== "sg-dir-input" && !el.hasAttribute("webkitdirectory") && !el.closest('[id^="sg-"]')) ||
              null;

    if (!d) {
      const text = await file.text();
      setPromptText(text);
      return false;
    }

    const u = new DataTransfer();
    u.items.add(file);
    d.files = u.files;
    d.dispatchEvent(new Event("change", { bubbles: true }));
    d.dispatchEvent(new Event("input", { bubbles: true }));
    document.body.click();

    await new Promise(e => setTimeout(e, 1500));
    if (d.hasAttribute("data-sg-intercepted")) d.removeAttribute("data-sg-intercepted");
    return true;
  } finally {
    _sgRestoreFilePicker();
    if (i) clearTimeout(i);
    document.body.classList.remove("sg-hiding-attach-menu");
  }
}

const SG_FOLDER_MAX_FILES = 400;
const SG_FOLDER_MAX_FILE_BYTES = 500 * 1024;
const SG_FOLDER_TOKEN_BUDGET = 128000;

function sgEstimateTokensSafe(text) {
  if (!text) return 0;
  if (typeof countText === "function") {
    return countText(text).tokens || 0;
  }
  return Math.max(1, Math.ceil(String(text).length / 4));
}

function sgFormatBytesCompact(bytes) {
  if (!bytes || bytes <= 0) return "0 KB";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  return kb >= 100 ? `${Math.round(kb)} KB` : `${kb.toFixed(1)} KB`;
}

function sgStripRootFolderPrefix(relPath, folderName) {
  const clean = String(relPath || "").replace(/\\/g, "/").replace(/^\/+/, "");
  if (folderName && clean.startsWith(folderName + "/")) {
    return clean.slice(folderName.length + 1);
  }
  return clean;
}

async function sgScanFolderForBundle(files, customFolderName = "") {
  const fileList = Array.from(files || []);
  let folderName = customFolderName;
  if (!folderName && fileList.length > 0) {
    const first = String(fileList[0].webkitRelativePath || fileList[0].relativePath || "");
    folderName = first.split("/")[0] || "project";
  }
  folderName = folderName || "project";

  const entries = [];
  for (const file of fileList) {
    const relPath = String(file.webkitRelativePath || file.relativePath || file.name || "")
      .replace(/\\/g, "/")
      .replace(/^\/+/, "");
    if (!relPath) continue;
    entries.push({ file, relPath });
  }
  entries.sort((a, b) => a.relPath.localeCompare(b.relPath));

  const gitignoreConfigs = [];
  for (const entry of entries) {
    const segs = entry.relPath.split("/");
    const baseName = segs[segs.length - 1] || "";
    if (baseName !== ".gitignore") continue;
    if (sgHasHardIgnoredAncestor(entry.relPath, folderName)) continue;
    if ((entry.file.size || 0) > 256 * 1024) continue;
    try {
      const text = await entry.file.text();
      const baseDir = segs.slice(0, -1).join("/");
      const rules = sgParseGitignoreContent(text, baseDir);
      if (rules.length > 0) {
        gitignoreConfigs.push({ baseDir, rules, path: entry.relPath });
      }
    } catch (_e) {
      // Ignore unreadable .gitignore
    }
  }

  const hasGitignore = gitignoreConfigs.length > 0;
  const gitignoreMatcher = hasGitignore ? sgBuildGitignoreMatcher(gitignoreConfigs) : null;

  const excludedCounts = {
    hardIgnored: 0,
    sensitiveOrBinary: 0,
    tooLarge: 0,
    binaryContent: 0,
    gitIgnored: 0
  };

  const activeCandidates = [];
  const ignoredCandidates = [];

  for (const entry of entries) {
    const { file, relPath } = entry;
    if (sgHasHardIgnoredAncestor(relPath, folderName)) {
      excludedCounts.hardIgnored++;
      continue;
    }
    if (sgIsSensitiveOrBinaryPath(relPath)) {
      excludedCounts.sensitiveOrBinary++;
      continue;
    }
    if ((file.size || 0) > SG_FOLDER_MAX_FILE_BYTES) {
      excludedCounts.tooLarge++;
      continue;
    }

    const matchedIgnore = hasGitignore
      ? gitignoreMatcher(relPath, false)
      : shouldIgnorePath(relPath);

    if (matchedIgnore) {
      excludedCounts.gitIgnored++;
      ignoredCandidates.push(entry);
    } else {
      activeCandidates.push(entry);
    }
  }

  const items = [];
  let truncatedActiveCount = 0;

  for (const entry of activeCandidates) {
    if (items.length >= SG_FOLDER_MAX_FILES) {
      truncatedActiveCount++;
      continue;
    }
    if (await isBinaryFile(entry.file)) {
      excludedCounts.binaryContent++;
      continue;
    }
    try {
      const content = await entry.file.text();
      const bytes = content.length;
      const tokens = sgEstimateTokensSafe(content);
      items.push({
        path: entry.relPath,
        displayPath: sgStripRootFolderPrefix(entry.relPath, folderName),
        file: entry.file,
        content,
        bytes,
        tokens,
        gitIgnored: false,
        checked: true,
        _visible: true
      });
    } catch (_e) {
      // Skip unreadable file
    }
  }

  const ignoredItems = [];
  for (const entry of ignoredCandidates.slice(0, SG_FOLDER_MAX_FILES)) {
    const approxSize = entry.file.size || 0;
    ignoredItems.push({
      path: entry.relPath,
      displayPath: sgStripRootFolderPrefix(entry.relPath, folderName),
      file: entry.file,
      content: null,
      bytes: approxSize,
      tokens: Math.max(1, Math.ceil(approxSize / 4)),
      gitIgnored: true,
      checked: false,
      _visible: false
    });
  }

  return {
    folderName,
    hasGitignore,
    gitignoreCount: gitignoreConfigs.length,
    gitignorePaths: gitignoreConfigs.map((c) => c.path),
    items,
    ignoredItems,
    excludedCounts,
    truncatedActiveCount
  };
}

function sgBuildFolderTreeModel(allItems) {
  const root = { type: "dir", name: "", dirPath: "", dirs: new Map(), files: [] };

  for (const item of allItems) {
    const rel = item.displayPath || item.path;
    const parts = rel.split("/").filter(Boolean);
    if (!parts.length) continue;

    let node = root;
    let currentDir = "";
    for (let i = 0; i < parts.length - 1; i++) {
      const seg = parts[i];
      currentDir = currentDir ? `${currentDir}/${seg}` : seg;
      if (!node.dirs.has(seg)) {
        node.dirs.set(seg, {
          type: "dir",
          name: seg,
          dirPath: currentDir,
          dirs: new Map(),
          files: []
        });
      }
      node = node.dirs.get(seg);
    }

    node.files.push({
      type: "file",
      name: parts[parts.length - 1],
      item
    });
  }

  function finalizeNode(dirNode) {
    const childDirs = Array.from(dirNode.dirs.values())
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(finalizeNode);
    const childFiles = [...dirNode.files].sort((a, b) => a.name.localeCompare(b.name));
    return {
      type: "dir",
      name: dirNode.name,
      dirPath: dirNode.dirPath,
      dirs: childDirs,
      files: childFiles
    };
  }

  return finalizeNode(root);
}

async function sgBuildAndAttachFolderBundle(folderName, selectedItems) {
  const MAX_BUNDLE_BYTES = 10 * 1024 * 1024;
  const resolvedItems = [];

  for (const item of selectedItems) {
    if (item.content === null) {
      if (await isBinaryFile(item.file)) continue;
      try {
        const text = await item.file.text();
        item.content = text;
        item.bytes = text.length;
        item.tokens = sgEstimateTokensSafe(text);
      } catch (_e) {
        continue;
      }
    }
    resolvedItems.push(item);
  }

  if (!resolvedItems.length) {
    showToast(`No readable files selected for "${folderName}".`, "warning");
    return false;
  }

  showToast(`Bundling ${resolvedItems.length} files from "${folderName}"...`, "info");

  const paths = resolvedItems.map((it) => it.path);
  const treeStr = buildDirectoryTree(paths);
  const totalTokens = resolvedItems.reduce((sum, it) => sum + (it.tokens || 0), 0);

  let bundle = `================================================================================\n`;
  bundle += `📁 PROJECT FOLDER CONTEXT: ${folderName}\n`;
  bundle += `Total Files: ${resolvedItems.length}\n`;
  bundle += `Estimated Tokens: ~${totalTokens.toLocaleString()}\n`;
  bundle += `Generated: ${new Date().toLocaleString()}\n`;
  bundle += `================================================================================\n\n`;
  bundle += `--------------------------------------------------------------------------------\n`;
  bundle += `DIRECTORY TREE:\n`;
  bundle += `--------------------------------------------------------------------------------\n`;
  bundle += `${treeStr}\n\n`;
  bundle += `--------------------------------------------------------------------------------\n`;
  bundle += `FILE CONTENTS:\n`;
  bundle += `--------------------------------------------------------------------------------\n\n`;

  let totalBytes = bundle.length;
  let bundledCount = 0;

  for (const item of resolvedItems) {
    const section = `================================================================================\nFILE: ${item.path}\n================================================================================\n${item.content}\n\n`;
    if (totalBytes + section.length > MAX_BUNDLE_BYTES) {
      showToast("Folder bundle exceeded 10MB limit. Remaining files omitted.", "warning");
      break;
    }
    bundle += section;
    totalBytes += section.length;
    bundledCount++;
  }

  if (bundle.length > MAX_BUNDLE_BYTES) {
    showToast("Folder bundle exceeds 10MB limit. Please select fewer files.", "error");
    return false;
  }

  const bundleFileName = `${folderName}_bundle.txt`;
  const bundleFile = new File([bundle], bundleFileName, { type: "text/plain" });
  showToast(`Uploading "${bundleFileName}" (${Math.round(bundle.length / 1024)} KB)...`, "info");

  const attached = await attachFileToGeminiInput(bundleFile);
  if (attached) {
    showToast(`Folder "${folderName}" attached successfully (${bundledCount} files, ~${totalTokens.toLocaleString()} tokens)!`, "success");
  } else {
    showToast(`Folder context inserted into prompt (${bundledCount} files)!`, "success");
  }
  return true;
}

function sgOpenFolderPreviewModal(scanResult) {
  const existing = document.getElementById("sg-folder-v2-overlay");
  if (existing) existing.remove();

  if (typeof window !== "undefined") {
    window._sgShiftClickAnchors = window._sgShiftClickAnchors || {};
  }

  const {
    folderName,
    hasGitignore,
    gitignoreCount,
    items,
    ignoredItems,
    excludedCounts,
    truncatedActiveCount
  } = scanResult;

  const allItems = [...items, ...ignoredItems];
  const treeModel = sgBuildFolderTreeModel(allItems);

  let applyIgnoreRules = true;
  let searchQuery = "";
  const dirState = new Map();
  const fileRowRefs = [];
  const dirNodeRefs = [];
  let cleanupShiftClick = null;

  const { overlay, close } = createModalOverlay({
    id: "sg-folder-v2-overlay",
    zIndex: 2150,
    onClose: () => {
      if (typeof cleanupShiftClick === "function") {
        cleanupShiftClick();
      }
      if (typeof window !== "undefined" && window._sgShiftClickAnchors) {
        delete window._sgShiftClickAnchors[".sg-fu-file-cb"];
      }
    }
  });

  const modal = sgSkillEl("div", {
    className: "sg-fu-modal",
    role: "dialog",
    "aria-modal": "true",
    "aria-label": `Folder Uploader Preview: ${folderName}`
  });

  const headerIcon = typeof sgCreateSvgIcon === "function"
    ? sgCreateSvgIcon(["M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z"], 18)
    : sgSkillEl("span", { textContent: "📁" });

  const titleEl = sgSkillEl("div", { className: "sg-fu-title-group" }, [
    headerIcon,
    sgSkillEl("span", { className: "sg-fu-title", textContent: folderName }),
    sgSkillEl("span", {
      className: `sg-fu-badge ${hasGitignore ? "sg-fu-badge-gitignore" : "sg-fu-badge-default"}`,
      textContent: hasGitignore
        ? `.gitignore (${gitignoreCount})`
        : "Default filter"
    })
  ]);

  const closeBtn = sgSkillEl("button", {
    type: "button",
    className: "sg-fu-close-btn",
    "aria-label": "Close folder preview",
    textContent: "×",
    onClick: () => close()
  });

  const header = sgSkillEl("div", { className: "sg-fu-header" }, [titleEl, closeBtn]);

  const searchInput = sgSkillEl("input", {
    type: "search",
    className: "sg-fu-search",
    placeholder: "Filter files by path (e.g. src/, .ts)...",
    "aria-label": "Filter files by path"
  });

  const ignoreCheckbox = sgSkillEl("input", {
    type: "checkbox",
    className: "sg-fu-ignore-toggle",
    checked: applyIgnoreRules
  });
  const ignoreToggleLabel = sgSkillEl("label", { className: "sg-fu-ignore-label" }, [
    ignoreCheckbox,
    sgSkillEl("span", {
      textContent: hasGitignore
        ? `Apply .gitignore rules (${excludedCounts.gitIgnored} hidden)`
        : `Apply default ignore rules (${excludedCounts.gitIgnored} hidden)`
    })
  ]);

  const controlsTop = sgSkillEl("div", { className: "sg-fu-controls-top" }, [
    searchInput,
    ignoreToggleLabel
  ]);

  const selectAllBtn = sgSkillEl("button", { type: "button", className: "sg-fu-btn", textContent: "Select All" });
  const deselectAllBtn = sgSkillEl("button", { type: "button", className: "sg-fu-btn", textContent: "Deselect All" });
  const expandAllBtn = sgSkillEl("button", { type: "button", className: "sg-fu-btn", textContent: "Expand All" });
  const collapseAllBtn = sgSkillEl("button", { type: "button", className: "sg-fu-btn", textContent: "Collapse All" });

  const tipSpan = sgSkillEl("span", {
    className: "sg-fu-tip",
    textContent: "Shift+Click for range • Alt+Drop/Click skips preview"
  });

  const controlsActions = sgSkillEl("div", { className: "sg-fu-controls-actions" }, [
    sgSkillEl("div", { className: "sg-fu-btn-group" }, [
      selectAllBtn,
      deselectAllBtn,
      expandAllBtn,
      collapseAllBtn
    ]),
    tipSpan
  ]);

  const noticeParts = [];
  if (truncatedActiveCount > 0) {
    noticeParts.push(`${truncatedActiveCount} extra active files omitted (limit ${SG_FOLDER_MAX_FILES})`);
  }
  const skippedSystem = excludedCounts.hardIgnored + excludedCounts.sensitiveOrBinary + excludedCounts.tooLarge + excludedCounts.binaryContent;
  if (skippedSystem > 0) {
    noticeParts.push(`${skippedSystem} binary/secret/system items skipped`);
  }

  const noticeBar = noticeParts.length
    ? sgSkillEl("div", { className: "sg-fu-notice", textContent: noticeParts.join(" • ") })
    : null;

  const treeWrap = sgSkillEl("div", { className: "sg-fu-tree" });
  const emptyMsg = sgSkillEl("div", {
    className: "sg-fu-empty sg-fu-hidden",
    textContent: "No files match your current filter."
  });

  function renderDirNode(dirNode, depth, parentContainer, ancestorRefs) {
    for (const childDir of dirNode.dirs) {
      const defaultExpanded = allItems.length <= 120 || depth < 2;
      const childrenBox = sgSkillEl("div", {
        className: `sg-fu-dir-children${defaultExpanded ? "" : " sg-fu-hidden"}`
      });

      const caretBtn = sgSkillEl("button", {
        type: "button",
        className: "sg-fu-caret-btn",
        "aria-label": `Toggle folder ${childDir.name}`,
        textContent: defaultExpanded ? "▾" : "▸"
      });

      const dirCb = sgSkillEl("input", {
        type: "checkbox",
        className: "sg-fu-dir-cb"
      });

      const dirMeta = sgSkillEl("span", { className: "sg-fu-meta" });
      const dirRow = sgSkillEl("div", {
        className: "sg-fu-row sg-fu-dir-row",
        style: `padding-left: ${10 + depth * 16}px;`
      }, [
        caretBtn,
        dirCb,
        sgSkillEl("span", { className: "sg-fu-folder-name", textContent: `${childDir.name}/` }),
        dirMeta
      ]);

      const dirWrap = sgSkillEl("div", { className: "sg-fu-dir-node" }, [dirRow, childrenBox]);
      parentContainer.appendChild(dirWrap);

      const dirRef = {
        dirPath: childDir.dirPath,
        wrap: dirWrap,
        row: dirRow,
        childrenBox,
        caretBtn,
        cb: dirCb,
        metaEl: dirMeta,
        expanded: defaultExpanded,
        fileRefs: []
      };
      dirState.set(childDir.dirPath, dirRef);
      dirNodeRefs.push(dirRef);

      const toggleExpand = () => {
        dirRef.expanded = !dirRef.expanded;
        childrenBox.classList.toggle("sg-fu-hidden", !dirRef.expanded);
        caretBtn.textContent = dirRef.expanded ? "▾" : "▸";
      };

      caretBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleExpand();
      });

      dirRow.addEventListener("dblclick", (e) => {
        if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "BUTTON")) return;
        toggleExpand();
      });

      dirCb.addEventListener("change", () => {
        const nextChecked = dirCb.checked;
        for (const fRef of dirRef.fileRefs) {
          if (!fRef.item._visible) continue;
          fRef.item.checked = nextChecked;
          fRef.cb.checked = nextChecked;
        }
        syncTreeAndBudget();
      });

      renderDirNode(childDir, depth + 1, childrenBox, [...ancestorRefs, dirRef]);
    }

    for (const fileNode of dirNode.files) {
      const item = fileNode.item;
      const cb = sgSkillEl("input", {
        type: "checkbox",
        className: "sg-fu-file-cb",
        checked: item.checked
      });
      const nameChildren = [
        sgSkillEl("span", { className: "sg-fu-file-name", textContent: fileNode.name })
      ];
      if (item.gitIgnored) {
        nameChildren.push(sgSkillEl("span", { className: "sg-fu-ignored-pill", textContent: "ignored" }));
      }
      const metaEl = sgSkillEl("span", {
        className: "sg-fu-meta",
        textContent: `${sgFormatBytesCompact(item.bytes)} • ~${item.tokens.toLocaleString()} tok`
      });
      const row = sgSkillEl("label", {
        className: `sg-fu-row sg-fu-file-row${item.gitIgnored ? " sg-fu-file-ignored" : ""}`,
        style: `padding-left: ${28 + depth * 16}px;`,
        title: item.path
      }, [
        cb,
        sgSkillEl("span", { className: "sg-fu-file-label" }, nameChildren),
        metaEl
      ]);

      parentContainer.appendChild(row);
      const fileRef = { item, row, cb };
      fileRowRefs.push(fileRef);
      for (const anc of ancestorRefs) {
        anc.fileRefs.push(fileRef);
      }

      cb.addEventListener("change", () => {
        if (!item._visible) {
          cb.checked = item.checked;
          return;
        }
        item.checked = cb.checked;
        syncTreeAndBudget();
      });
    }
  }

  renderDirNode(treeModel, 0, treeWrap, []);
  treeWrap.appendChild(emptyMsg);

  const budgetText = sgSkillEl("div", { className: "sg-fu-budget-text" });
  const budgetPctBadge = sgSkillEl("span", { className: "sg-fu-budget-pct" });
  const budgetFill = sgSkillEl("div", { className: "sg-fu-budget-fill" });
  const budgetTrack = sgSkillEl("div", { className: "sg-fu-budget-track" }, [budgetFill]);
  const budgetBox = sgSkillEl("div", { className: "sg-fu-budget-box" }, [
    sgSkillEl("div", { className: "sg-fu-budget-head" }, [budgetText, budgetPctBadge]),
    budgetTrack
  ]);

  const cancelBtn = sgSkillEl("button", {
    type: "button",
    className: "sg-fu-btn",
    textContent: "Cancel",
    onClick: () => close()
  });

  const attachBtn = sgSkillEl("button", {
    type: "button",
    className: "sg-fu-btn sg-fu-btn-primary",
    textContent: "Bundle & Attach"
  });

  const footer = sgSkillEl("div", { className: "sg-fu-footer" }, [
    budgetBox,
    sgSkillEl("div", { className: "sg-fu-footer-actions" }, [cancelBtn, attachBtn])
  ]);

  modal.appendChild(header);
  modal.appendChild(controlsTop);
  modal.appendChild(controlsActions);
  if (noticeBar) modal.appendChild(noticeBar);
  modal.appendChild(treeWrap);
  modal.appendChild(footer);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  function applyFiltersAndVisibility() {
    const q = searchQuery.trim().toLowerCase();
    let visibleCount = 0;

    for (const fRef of fileRowRefs) {
      const { item, row, cb } = fRef;
      const hiddenByIgnore = applyIgnoreRules && item.gitIgnored;
      const hiddenBySearch = q !== "" && !item.path.toLowerCase().includes(q) && !item.displayPath.toLowerCase().includes(q);
      const visible = !hiddenByIgnore && !hiddenBySearch;

      item._visible = visible;
      row.classList.toggle("sg-fu-hidden", !visible);
      cb.disabled = !visible;
      if (visible) visibleCount++;
    }

    for (const dRef of dirNodeRefs) {
      const hasVisible = dRef.fileRefs.some((f) => f.item._visible);
      dRef.wrap.classList.toggle("sg-fu-hidden", !hasVisible);
      if (hasVisible && q !== "") {
        dRef.childrenBox.classList.remove("sg-fu-hidden");
        dRef.caretBtn.textContent = "▾";
      } else if (hasVisible) {
        dRef.childrenBox.classList.toggle("sg-fu-hidden", !dRef.expanded);
        dRef.caretBtn.textContent = dRef.expanded ? "▾" : "▸";
      }
    }

    emptyMsg.classList.toggle("sg-fu-hidden", visibleCount > 0);
  }

  function syncTreeAndBudget() {
    for (const fRef of fileRowRefs) {
      if (!fRef.item._visible) {
        fRef.cb.checked = fRef.item.checked;
      } else {
        fRef.item.checked = fRef.cb.checked;
      }
    }

    for (const dRef of dirNodeRefs) {
      const visibleFiles = dRef.fileRefs.filter((f) => f.item._visible);
      if (!visibleFiles.length) continue;
      let checkedInDir = 0;
      let dirTokens = 0;
      for (const f of visibleFiles) {
        if (f.item.checked) {
          checkedInDir++;
          dirTokens += f.item.tokens || 0;
        }
      }
      dRef.cb.checked = checkedInDir === visibleFiles.length;
      dRef.cb.indeterminate = checkedInDir > 0 && checkedInDir < visibleFiles.length;
      dRef.metaEl.textContent = `${checkedInDir}/${visibleFiles.length} • ~${dirTokens.toLocaleString()} tok`;
    }

    let eligibleCount = 0;
    let selectedCount = 0;
    let selectedBytes = 0;
    let selectedTokens = 0;

    for (const fRef of fileRowRefs) {
      const it = fRef.item;
      if (applyIgnoreRules && it.gitIgnored) continue;
      eligibleCount++;
      if (it.checked) {
        selectedCount++;
        selectedBytes += it.bytes || 0;
        selectedTokens += it.tokens || 0;
      }
    }

    const rawPct = Math.round((selectedTokens / SG_FOLDER_TOKEN_BUDGET) * 100);
    const barPct = Math.min(100, rawPct);

    budgetText.textContent = `Selected: ${selectedCount} / ${eligibleCount} files • ${sgFormatBytesCompact(selectedBytes)} • ~${selectedTokens.toLocaleString()} tokens`;
    budgetPctBadge.textContent = `${rawPct}% of 128k`;
    budgetFill.style.width = `${barPct}%`;
    budgetFill.classList.remove("sg-fu-budget-warn", "sg-fu-budget-over");
    budgetPctBadge.classList.remove("sg-fu-budget-warn", "sg-fu-budget-over");
    if (rawPct >= 100) {
      budgetFill.classList.add("sg-fu-budget-over");
      budgetPctBadge.classList.add("sg-fu-budget-over");
    } else if (rawPct >= 75) {
      budgetFill.classList.add("sg-fu-budget-warn");
      budgetPctBadge.classList.add("sg-fu-budget-warn");
    }

    attachBtn.disabled = selectedCount === 0;
    attachBtn.textContent = `Bundle & Attach (${selectedCount})`;
  }

  cleanupShiftClick = typeof setupShiftClickSelection === "function"
    ? setupShiftClickSelection(treeWrap, ".sg-fu-file-cb", () => syncTreeAndBudget())
    : null;

  searchInput.addEventListener("input", () => {
    searchQuery = searchInput.value || "";
    applyFiltersAndVisibility();
    syncTreeAndBudget();
  });

  ignoreCheckbox.addEventListener("change", () => {
    applyIgnoreRules = ignoreCheckbox.checked;
    applyFiltersAndVisibility();
    syncTreeAndBudget();
  });

  selectAllBtn.addEventListener("click", () => {
    for (const fRef of fileRowRefs) {
      if (!fRef.item._visible) continue;
      fRef.item.checked = true;
      fRef.cb.checked = true;
    }
    syncTreeAndBudget();
  });

  deselectAllBtn.addEventListener("click", () => {
    for (const fRef of fileRowRefs) {
      if (!fRef.item._visible) continue;
      fRef.item.checked = false;
      fRef.cb.checked = false;
    }
    syncTreeAndBudget();
  });

  expandAllBtn.addEventListener("click", () => {
    for (const dRef of dirNodeRefs) {
      dRef.expanded = true;
      dRef.childrenBox.classList.remove("sg-fu-hidden");
      dRef.caretBtn.textContent = "▾";
    }
  });

  collapseAllBtn.addEventListener("click", () => {
    for (const dRef of dirNodeRefs) {
      dRef.expanded = false;
      dRef.childrenBox.classList.add("sg-fu-hidden");
      dRef.caretBtn.textContent = "▸";
    }
  });

  attachBtn.addEventListener("click", async () => {
    const chosen = fileRowRefs
      .map((f) => f.item)
      .filter((it) => it.checked && (!applyIgnoreRules || !it.gitIgnored));
    if (!chosen.length) return;
    attachBtn.disabled = true;
    attachBtn.setAttribute("aria-busy", "true");
    attachBtn.textContent = "Bundling...";
    let ok = false;
    try {
      ok = Boolean(await sgBuildAndAttachFolderBundle(folderName, chosen));
      if (ok) {
        close();
      }
    } catch (err) {
      ok = false;
      if (typeof showToast === "function") {
        showToast("Failed to bundle folder: " + String(err && err.message || err), "error");
      }
    } finally {
      if (!ok && overlay.isConnected) {
        attachBtn.removeAttribute("aria-busy");
        syncTreeAndBudget();
      }
    }
  });

  applyFiltersAndVisibility();
  syncTreeAndBudget();
  requestAnimationFrame(() => {
    overlay.classList.add("show");
    searchInput.focus();
  });
}

async function processAndUploadFolder(files, customFolderName = "", options = {}) {
  if (!files || !files.length) return;

  const provisionalName = customFolderName ||
    String(files[0].webkitRelativePath || files[0].relativePath || "").split("/")[0] ||
    "project";

  showToast(`Scanning folder "${provisionalName}"...`, "info");

  const scanResult = await sgScanFolderForBundle(files, customFolderName);
  if (!scanResult.items.length && !scanResult.ignoredItems.length) {
    showToast(`No readable code or text files found in "${scanResult.folderName}".`, "error");
    return;
  }

  if (options && options.skipPreview) {
    if (!scanResult.items.length) {
      showToast(`No non-ignored readable files found in "${scanResult.folderName}".`, "error");
      return;
    }
    await sgBuildAndAttachFolderBundle(scanResult.folderName, scanResult.items);
    return;
  }

  sgOpenFolderPreviewModal(scanResult);
}

let _sgFolderClickBound = false;
let _sgNextDirUploadFastMode = false;

function ensureDirInput() {
  let dirInput = document.getElementById("sg-dir-input");
  if (!dirInput) {
    dirInput = document.createElement("input");
    dirInput.type = "file";
    dirInput.id = "sg-dir-input";
    dirInput.webkitdirectory = true;
    dirInput.setAttribute("directory", "");
    dirInput.multiple = true;
    dirInput.style.display = "none";
    document.body.appendChild(dirInput);

    dirInput.addEventListener("change", async (e) => {
      const skipPreview = _sgNextDirUploadFastMode;
      _sgNextDirUploadFastMode = false;
      const files = Array.from(e.target.files || []);
      if (!files.length) return;
      await processAndUploadFolder(files, "", { skipPreview });
      dirInput.value = "";
    });
  }
  return dirInput;
}

function isFolderMenuElementVisible(el) {
  if (!el || !el.isConnected) return false;
  const rect = el.getBoundingClientRect();
  if (!rect || rect.width <= 0 || rect.height <= 0) return false;
  const cs = getComputedStyle(el);
  if (!cs || cs.display === "none" || cs.visibility === "hidden" || cs.visibility === "collapse") {
    return false;
  }
  return true;
}

function injectFolderUploadMenuItem(uploadItem, menuRoot) {
  if (!isExtensionEnabled || !isFolderUploadEnabled || !uploadItem || !uploadItem.parentElement) return;
  if (!isFolderMenuElementVisible(uploadItem)) return;
  const dedupeScope = uploadItem.closest('gem-menu, .cdk-overlay-pane, .mat-mdc-menu-panel, mat-menu-panel, [role="menu"], uploader-file-picker, simplified-input-menu') || menuRoot || uploadItem.parentElement;
  const existingInScope = dedupeScope.querySelector("#sg-folder-upload-menu-item");
  if (existingInScope) {
    if (isFolderMenuElementVisible(existingInScope)) return;
    existingInScope.remove();
  }

  const getVisibleChildren = (el) => Array.from(el.children).filter(ch => {
    const tag = ch.tagName ? ch.tagName.toLowerCase() : "";
    return tag !== "input" && tag !== "style" && tag !== "script" && !ch.hidden && ch.style.display !== "none";
  });

  let anchor = uploadItem;
  while (
    anchor.parentElement &&
    anchor.parentElement !== dedupeScope &&
    anchor.parentElement.parentElement &&
    getVisibleChildren(anchor.parentElement).length <= 1
  ) {
    anchor = anchor.parentElement;
  }
  if (!anchor.parentElement || !isFolderMenuElementVisible(anchor.parentElement)) return;
  if (anchor.parentElement.querySelector("#sg-folder-upload-menu-item")) return;

  const folderItem = uploadItem.cloneNode(true);
  ["jslog", "aria-controls", "aria-owns"].forEach(attr => folderItem.removeAttribute(attr));
  if (folderItem.getAttribute("data-test-id") === "local-images-files-uploader-button") {
    folderItem.removeAttribute("data-test-id");
  }
  folderItem.querySelectorAll('[data-test-id="local-images-files-uploader-button"]').forEach(el => {
    el.removeAttribute("data-test-id");
  });
  folderItem.id = "sg-folder-upload-menu-item";
  folderItem.setAttribute("data-test-id", "sg-folder-upload-menu-item");
  folderItem.disabled = false;
  folderItem.removeAttribute("disabled");
  folderItem.removeAttribute("aria-disabled");
  if (anchor !== uploadItem) {
    folderItem.style.width = "100%";
  }

  const originalTextClone = uploadItem.cloneNode(true);
  originalTextClone.querySelectorAll("mat-icon, gem-icon, svg, .cdk-visually-hidden").forEach(n => n.remove());
  const originalText = (originalTextClone.textContent || "").replace(/\s+/g, " ").trim();
  const labelText = sgIsVietnameseGeminiUI(originalText) ? "Tải thư mục lên" : "Upload folder";

  folderItem.setAttribute("aria-label", labelText);
  folderItem.setAttribute("title", labelText);

  const walker = document.createTreeWalker(folderItem, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_SKIP;
      const p = node.parentElement;
      if (p && p.closest("mat-icon, gem-icon, svg, .mat-ripple, .mat-mdc-button-ripple, .mdc-button__ripple, .cdk-visually-hidden")) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  const firstTextNode = walker.nextNode();
  if (firstTextNode) {
    firstTextNode.nodeValue = labelText;
  } else {
    const spans = folderItem.querySelectorAll("span");
    let spanUpdated = false;
    for (let i = spans.length - 1; i >= 0; i--) {
      const s = spans[i];
      if (!s.closest("mat-icon, gem-icon, svg") && s.children.length === 0 && s.textContent.trim().length > 0) {
        s.textContent = labelText;
        spanUpdated = true;
        break;
      }
    }
    if (!spanUpdated) {
      const span = document.createElement("span");
      span.textContent = labelText;
      folderItem.appendChild(span);
    }
  }

  const svgNS = "http://www.w3.org/2000/svg";
  const folderSvg = document.createElementNS(svgNS, "svg");
  folderSvg.setAttribute("viewBox", "0 0 24 24");
  folderSvg.setAttribute("width", "20");
  folderSvg.setAttribute("height", "20");
  folderSvg.setAttribute("fill", "none");
  folderSvg.setAttribute("stroke", "currentColor");
  folderSvg.setAttribute("stroke-width", "1.8");
  folderSvg.setAttribute("stroke-linecap", "round");
  folderSvg.setAttribute("stroke-linejoin", "round");
  folderSvg.setAttribute("aria-hidden", "true");
  const pFolder = document.createElementNS(svgNS, "path");
  pFolder.setAttribute("d", "M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-6l-2-2H5a2 2 0 0 0-2 2z");
  const pArrow = document.createElementNS(svgNS, "path");
  pArrow.setAttribute("d", "M12 16v-5m-2.5 2.5L12 11l2.5 2.5");
  folderSvg.appendChild(pFolder);
  folderSvg.appendChild(pArrow);

  const iconContainer = folderItem.querySelector("mat-icon, gem-icon, svg, [role='img']");
  if (iconContainer) {
    if (iconContainer.tagName && iconContainer.tagName.toLowerCase() === "svg") {
      if (iconContainer.getAttribute("class")) {
        folderSvg.setAttribute("class", iconContainer.getAttribute("class"));
      }
      iconContainer.replaceWith(folderSvg);
    } else {
      iconContainer.removeAttribute("fonticon");
      iconContainer.removeAttribute("data-mat-icon-name");
      iconContainer.textContent = "";
      iconContainer.style.display = "inline-flex";
      iconContainer.style.alignItems = "center";
      iconContainer.style.justifyContent = "center";
      iconContainer.appendChild(folderSvg);
    }
  }

  folderItem.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
    _sgNextDirUploadFastMode = Boolean(e.altKey);
    const dirInput = ensureDirInput();
    dirInput.click();
    setTimeout(() => {
      const backdrop = document.querySelector(".cdk-overlay-backdrop");
      if (backdrop) {
        backdrop.click();
      } else {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true }));
      }
    }, 0);
  }, true);

  anchor.parentElement.insertBefore(folderItem, anchor.nextSibling);
}

function checkAndInjectFolderMenuItem() {
  if (!isExtensionEnabled || !isFolderUploadEnabled) return;
  if (document.body && document.body.classList.contains("sg-hiding-attach-menu")) return;
  const roots = Array.from(document.querySelectorAll('gem-menu, .cdk-overlay-pane, .mat-mdc-menu-panel, mat-menu-panel, [role="menu"], uploader-file-picker, simplified-input-menu'));
  if (!roots.length) return;

  const candidateSelectors = [
    'gem-menu-item[data-test-id="local-images-files-uploader-button"], [role="menuitem"][data-test-id="local-images-files-uploader-button"], button[data-test-id="local-images-files-uploader-button"]',
    '[data-test-id="local-images-files-uploader-button"]',
    'gem-menu-item:has(mat-icon[fonticon="attach_file"]), gem-menu-item:has(mat-icon[fonticon="attach_file_add"]), gem-menu-item:has(mat-icon[fonticon="upload_file"]), gem-menu-item:has(mat-icon[data-mat-icon-name="attach_file"]), gem-menu-item:has(mat-icon[data-mat-icon-name="upload_file"])',
    '[role="menuitem"]:has(mat-icon[fonticon="attach_file"]), [role="menuitem"]:has(mat-icon[fonticon="attach_file_add"]), [role="menuitem"]:has(mat-icon[fonticon="upload_file"]), [role="menuitem"]:has(mat-icon[data-mat-icon-name="attach_file"]), [role="menuitem"]:has(mat-icon[data-mat-icon-name="upload_file"])',
    'gem-menu-item[aria-label="Files" i], [role="menuitem"][aria-label="Files" i], gem-menu-item[aria-label="File" i], [role="menuitem"][aria-label="File" i]',
    'gem-menu-item[aria-label*="Upload file" i], [role="menuitem"][aria-label*="Upload file" i], button[aria-label*="Upload file" i], menu-item[aria-label*="Upload file" i]',
    'gem-menu-item[aria-label*="Add file" i], [role="menuitem"][aria-label*="Add file" i], button[aria-label*="Add file" i], menu-item[aria-label*="Add file" i]',
    'gem-menu-item[aria-label*="Upload from" i], [role="menuitem"][aria-label*="Upload from" i], button[aria-label*="Upload from" i]',
    'gem-menu-item[aria-label*="Local file" i], [role="menuitem"][aria-label*="Local file" i], button[aria-label*="Local file" i]',
    'gem-menu-item[aria-label*="Tải tệp" i], [role="menuitem"][aria-label*="Tải tệp" i], button[aria-label*="Tải tệp" i], menu-item[aria-label*="Tải tệp" i]',
    'button:has(mat-icon[fonticon="attach_file"]), button:has(mat-icon[fonticon="attach_file_add"]), button:has(mat-icon[fonticon="upload_file"])',
    'images-files-uploader [role="menuitem"], images-files-uploader [mat-list-item], images-files-uploader button'
  ];

  const getCleanItemText = (el) => {
    const clone = el.cloneNode(true);
    clone.querySelectorAll("mat-icon, gem-icon, svg, .cdk-visually-hidden").forEach(n => n.remove());
    return (clone.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
  };

  for (const root of roots) {
    if (!isFolderMenuElementVisible(root)) continue;
    const existing = root.querySelector("#sg-folder-upload-menu-item");
    if (existing) {
      if (isFolderMenuElementVisible(existing)) continue;
      existing.remove();
    }

    let match = null;
    for (const sel of candidateSelectors) {
      const candidates = root.querySelectorAll(sel);
      for (const el of candidates) {
        if (!el.closest("#sg-folder-upload-menu-item") && isFolderMenuElementVisible(el)) {
          match = el;
          break;
        }
      }
      if (match) break;
    }

    if (!match) {
      const items = root.querySelectorAll('gem-menu-item, [role="menuitem"], button, menu-item, mat-list-item, [mat-list-item], a');
      for (const item of items) {
        if (item.closest("#sg-folder-upload-menu-item") || !isFolderMenuElementVisible(item)) continue;
        const txt = getCleanItemText(item);
        if (!txt || txt.includes("lựa chọn tải lên khác") || txt.includes("more upload") || txt.includes("other upload") || txt.includes("more options")) continue;
        if (
          txt === "tệp" ||
          txt === "file" ||
          txt === "files" ||
          txt === "local files" ||
          txt.includes("tải tệp") ||
          txt.includes("upload file") ||
          txt.includes("add file") ||
          txt.includes("tải ảnh") ||
          txt.includes("upload image") ||
          txt.includes("upload photo") ||
          txt.includes("upload from computer") ||
          txt.includes("upload from device") ||
          txt.includes("choose file") ||
          txt.includes("tải lên từ máy")
        ) {
          match = item;
          break;
        }
      }
    }

    if (match) {
      injectFolderUploadMenuItem(match, root);
      return;
    }
  }
}

function setupFolderUploadMenuObserver() {
  ensureDirInput();
  const existing = document.getElementById("sg-folder-upload-btn");
  if (existing) existing.remove();

  sgObserverRegistry.registerUIRefresh("folderMenu", () => {
    checkAndInjectFolderMenuItem();
    initFolderDragDrop();
  });
  checkAndInjectFolderMenuItem();

  if (!_sgFolderClickBound) {
    _sgFolderClickBound = true;
    document.addEventListener("click", (e) => {
      const t = e.target;
      if (t && t.closest('button[data-test-id="uploader-button"], button[data-test-id="input-area-menu-button"], button.upload-card-button, button:has(mat-icon[fonticon="plus"]), button:has(mat-icon[fonticon="add"]), button:has(mat-icon[data-mat-icon-name="plus"]), button:has(mat-icon[data-mat-icon-name="add"]), button[aria-label*="Uploads and tools" i], button[aria-label*="Upload & tools" i], button[aria-label*="Upload and tools" i], button[aria-label*="Add file" i], button[aria-label*="upload" i], button[aria-label*="attachment" i], button[aria-label*="Open input area menu" i], button[aria-label*="More options for input" i], button[aria-label*="Tools" i], button[aria-label*="Nội dung tải lên" i], button[aria-label*="tải tệp" i], button[aria-label*="thêm tệp" i], button[aria-label*="trình đơn" i], uploader button, input-area-v2 button')) {
        setTimeout(checkAndInjectFolderMenuItem, 50);
        setTimeout(checkAndInjectFolderMenuItem, 160);
        setTimeout(checkAndInjectFolderMenuItem, 380);
      }
    }, { capture: true, passive: true });
  }
}

function initFolderDragDrop() {
  if (!isFolderUploadEnabled) return;
  const inputContainer = document.querySelector("input-area-v2, .input-area, rich-textarea");
  if (!inputContainer || inputContainer.dataset.sgFolderDropAttached) return;
  inputContainer.dataset.sgFolderDropAttached = "true";

  inputContainer.addEventListener("dragover", (e) => {
    if (!isExtensionEnabled || !isFolderUploadEnabled) {
      inputContainer.classList.remove("sg-folder-drag-active");
      return;
    }
    const types = Array.from((e.dataTransfer && e.dataTransfer.types) || []);
    if (types.includes("Files") && !types.includes("application/x-sg-chat-drag")) {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
      inputContainer.classList.add("sg-folder-drag-active");
    }
  });

  inputContainer.addEventListener("dragleave", () => {
    inputContainer.classList.remove("sg-folder-drag-active");
  });

  inputContainer.addEventListener("drop", async (e) => {
    inputContainer.classList.remove("sg-folder-drag-active");
    if (!isExtensionEnabled || !isFolderUploadEnabled) return;
    if (!e.dataTransfer || !e.dataTransfer.items) return;

    const dirEntries = [];
    for (const item of e.dataTransfer.items) {
      if (item.kind === "file") {
        const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
        if (entry && entry.isDirectory) {
          dirEntries.push(entry);
        }
      }
    }

    if (dirEntries.length > 0) {
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === "function") {
        e.stopImmediatePropagation();
      }
      const skipPreview = Boolean(e.altKey);
      for (const entry of dirEntries) {
        const files = await readFileSystemEntryRecursively(entry);
        if (files.length) {
          await processAndUploadFolder(files, entry.name, { skipPreview });
        }
      }
    }
  }, true);
}

// Initial sync & storage lifecycle management

if (!SG_IS_SILENT_BG_WORKER_TAB) {
  ("function" == typeof sgSyncGetCached ? sgSyncGetCached : chrome.storage.sync.get.bind(chrome.storage.sync))(["extensionEnabled", "folderUploadEnabled"], res => {
    const safe = res || {};
    if (safe.extensionEnabled === false) {
      isExtensionEnabled = false;
      isFolderUploadEnabled = false;
      return;
    }
    isFolderUploadEnabled = safe.folderUploadEnabled !== false;
    if (isFolderUploadEnabled) {
      setupFolderUploadMenuObserver();
      initFolderDragDrop();
      setTimeout(initFolderDragDrop, 1000);
    }
  });

  const _sgFolderStorageHandler = (changes, areaName) => {
    if (areaName !== "sync" || !changes) return;
    if (changes.extensionEnabled) {
      isExtensionEnabled = changes.extensionEnabled.newValue !== false;
    }
    if (changes.folderUploadEnabled || changes.extensionEnabled) {
      const wantUpload = changes.folderUploadEnabled ? changes.folderUploadEnabled.newValue !== false : isFolderUploadEnabled;
      isFolderUploadEnabled = isExtensionEnabled && wantUpload;
      if (!isFolderUploadEnabled) {
        const existing = document.getElementById("sg-folder-upload-btn");
        if (existing) existing.remove();
        document.querySelectorAll("#sg-folder-upload-menu-item").forEach(e => e.remove());
        sgObserverRegistry.unregisterUIRefresh("folderMenu");
      } else {
        setupFolderUploadMenuObserver();
        initFolderDragDrop();
      }
    }
  };
  if (typeof SG !== "undefined" && SG && SG.storage) {
    SG.storage.onChanged("folder-uploader:sync", _sgFolderStorageHandler, { area: "sync" });
  } else {
    chrome.storage.onChanged.addListener(_sgFolderStorageHandler);
  }
}
