const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

function getContentScriptFiles() {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8"));
  const scripts = Array.isArray(manifest.content_scripts) ? manifest.content_scripts : [];
  const isolatedEntry =
    scripts.find((entry) => entry && entry.run_at === "document_end" && entry.world !== "MAIN") ||
    scripts.find((entry) => entry && entry.world !== "MAIN");
  if (!isolatedEntry || !Array.isArray(isolatedEntry.js)) {
    throw new Error("Could not locate document_end content_scripts entry in manifest.json");
  }
  return isolatedEntry.js.slice();
}

function loadFile(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function loadCombinedContentJs() {
  const files = getContentScriptFiles();
  return files
    .map((relPath) => `/* === SG_FILE: ${relPath} === */\n` + loadFile(relPath))
    .join("\n");
}

module.exports = {
  ROOT,
  getContentScriptFiles,
  loadFile,
  loadCombinedContentJs
};
