#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const routing = require("../lib/model-routing.js");
const extractor = require("../lib/model-extractor.js");

const DEFAULT_CONFIG_FILE = path.join(__dirname, "..", "config", "model-routing.json");

function parseArgs(argv) {
  const opts = {
    mode: "validate",
    configPath: DEFAULT_CONFIG_FILE,
    inputFile: null,
    inputType: null,
    writeSnapshot: null,
    syncPatternsFile: null,
    jsonOutput: false,
    help: false
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      opts.help = true;
    } else if (arg === "--validate") {
      opts.mode = "validate";
    } else if (arg === "--snippet" || arg === "--print-browser-snippet") {
      opts.mode = "snippet";
    } else if (arg === "--json") {
      opts.jsonOutput = true;
    } else if (arg === "--config" && argv[i + 1]) {
      opts.configPath = path.resolve(argv[++i]);
    } else if (arg.startsWith("--config=")) {
      opts.configPath = path.resolve(arg.slice("--config=".length));
    } else if (arg === "--from-html" && argv[i + 1]) {
      opts.mode = "extract";
      opts.inputType = "html";
      opts.inputFile = path.resolve(argv[++i]);
    } else if (arg.startsWith("--from-html=")) {
      opts.mode = "extract";
      opts.inputType = "html";
      opts.inputFile = path.resolve(arg.slice("--from-html=".length));
    } else if (arg === "--from-json" && argv[i + 1]) {
      opts.mode = "extract";
      opts.inputType = "json";
      opts.inputFile = path.resolve(argv[++i]);
    } else if (arg.startsWith("--from-json=")) {
      opts.mode = "extract";
      opts.inputType = "json";
      opts.inputFile = path.resolve(arg.slice("--from-json=".length));
    } else if (arg === "--write-snapshot" && argv[i + 1]) {
      opts.writeSnapshot = path.resolve(argv[++i]);
    } else if (arg.startsWith("--write-snapshot=")) {
      opts.writeSnapshot = path.resolve(arg.slice("--write-snapshot=".length));
    } else if (arg === "--sync-patterns" && argv[i + 1]) {
      opts.mode = "sync";
      opts.syncPatternsFile = path.resolve(argv[++i]);
    } else if (arg.startsWith("--sync-patterns=")) {
      opts.mode = "sync";
      opts.syncPatternsFile = path.resolve(arg.slice("--sync-patterns=".length));
    } else {
      throw new Error(`Unknown or incomplete argument: ${arg}`);
    }
  }
  return opts;
}

function getUsageText() {
  return [
    "Gemini Power Suite — Model Routing & Feasible Model Extractor CLI",
    "",
    "Usage:",
    "  node scripts/extract-models.js [options]",
    "",
    "Options:",
    "  --validate                   Validate config/model-routing.json and print task mappings (default)",
    "  --snippet                    Print copy-pasteable DevTools Console snippet for live gemini.google.com",
    "  --from-html <file>           Extract feasible models & thinking levels from saved Gemini DOM HTML",
    "  --from-json <file>           Inspect an exported extraction JSON snapshot against config",
    "  --write-snapshot <out.json>  Write extraction JSON report to disk (with --from-html / --from-json)",
    "  --sync-patterns <file>       Merge newly discovered feasible model names into config domPatterns",
    "  --config <path>              Use an alternate model-routing JSON file",
    "  --json                       Print machine-readable JSON output",
    "  -h, --help                   Show this help message"
  ].join("\n");
}

function formatValidationSummary(loaded) {
  const cfg = loaded.config;
  const lines = [
    `Config File : ${loaded.filePath}`,
    `Status      : ${loaded.ok ? "VALID" : "INVALID"}`
  ];
  if (loaded.errors.length > 0) {
    lines.push("Errors:");
    for (const err of loaded.errors) lines.push(`  - ${err}`);
  }
  if (loaded.warnings.length > 0) {
    lines.push("Warnings:");
    for (const w of loaded.warnings) lines.push(`  - ${w}`);
  }
  lines.push("", "Task Profiles:");
  const optLevels = cfg.tasks?.optimize?.levels || {};
  for (const lvKey of Object.keys(optLevels)) {
    const p = routing.resolveOptimizeProfile(lvKey, cfg);
    lines.push(`  - optimize.${lvKey.padEnd(8)} -> ${p.model} / ${p.thinkingLevel} (${p.badgeLabel}, ${p.timeoutMs}ms)`);
  }
  const gp = routing.resolveGrammarProfile(cfg);
  lines.push(`  - ${"grammar".padEnd(17)} -> ${gp.model} / ${gp.thinkingLevel} (${gp.badgeLabel}, ${gp.timeoutMs}ms)`);
  const cp = typeof routing.resolveCheckpointProfile === "function" ? routing.resolveCheckpointProfile(cfg) : null;
  if (cp) {
    lines.push(`  - ${"checkpoint".padEnd(17)} -> ${cp.model} / ${cp.thinkingLevel} (${cp.badgeLabel}, ${cp.timeoutMs}ms)`);
  }
  const pp = routing.resolveOrchestratePlannerProfile(cfg);
  lines.push(`  - ${"orch.planner.1t".padEnd(17)} -> ${pp.model} (fallback: ${cfg.tasks.orchestrate.planner.clean1Turn.fallbackModel}) / ${pp.thinkingLevel} (${pp.timeoutMs}ms)`);
  const qs = routing.resolveOrchestrateSubAgentProfile(null, null, "quota_saver", cfg);
  lines.push(`  - ${"orch.quota_saver".padEnd(17)} -> ${qs.model} / ${qs.thinkingLevel} (${qs.badgeLabel}, ${qs.timeoutMs}ms)`);
  const ad = cfg.tasks.orchestrate.policies.adaptive;
  lines.push(`  - ${"orch.adaptive".padEnd(17)} -> allowed=[${ad.allowedModels.join(", ")}], default=${ad.defaultModel} / ${ad.defaultThinkingLevel}`);
  lines.push("", "Catalog Models:");
  for (const m of Object.values(cfg.models)) {
    lines.push(`  - ${m.id} (${m.symbol}): display="${m.displayName}", patterns=${m.domPatterns.length}, fallback=[${m.fallbackOrder.join(", ")}]`);
  }
  return lines.join("\n");
}

function loadExtractionReportFromFile(filePath, inputType, config) {
  const raw = fs.readFileSync(filePath, "utf8");
  if (inputType === "html") {
    return extractor.extractModelsFromHtml(raw, config);
  }
  const parsed = JSON.parse(raw);
  if (parsed && Array.isArray(parsed.feasibleModels)) {
    return parsed;
  }
  throw new Error("Input JSON must contain a 'feasibleModels' array (exported by the browser snippet or --from-html)");
}

function mergeSyncedPatterns(rawConfigObj, extractedReport, config) {
  const updated = JSON.parse(JSON.stringify(rawConfigObj));
  if (!updated.models || typeof updated.models !== "object") {
    throw new Error("Target config file has no 'models' map");
  }
  const added = [];
  const feasible = Array.isArray(extractedReport?.feasibleModels) ? extractedReport.feasibleModels : [];
  for (const item of feasible) {
    if (!item || !item.exactName) continue;
    const canonicalId = item.canonicalId || routing.normalizeModelId(item.exactName, config);
    if (!canonicalId || !updated.models[canonicalId]) continue;
    const modelObj = updated.models[canonicalId];
    if (!Array.isArray(modelObj.domPatterns)) modelObj.domPatterns = [];
    const candidatePat = String(item.exactName).trim().toLowerCase();
    if (!candidatePat) continue;
    const exists = modelObj.domPatterns.some(p => String(p).toLowerCase() === candidatePat);
    if (!exists) {
      modelObj.domPatterns.push(candidatePat);
      added.push({ model: canonicalId, pattern: candidatePat });
    }
  }
  return { updated, added };
}

function runCli(argv = process.argv.slice(2), io = { stdout: s => process.stdout.write(s + "\n"), stderr: s => process.stderr.write(s + "\n") }) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (err) {
    io.stderr(String(err.message || err));
    io.stderr(getUsageText());
    return { exitCode: 1, error: String(err.message || err) };
  }

  if (opts.help) {
    io.stdout(getUsageText());
    return { exitCode: 0 };
  }

  const loaded = routing.loadConfigFromNode(opts.configPath);

  if (opts.mode === "snippet") {
    const snippet = extractor.buildBrowserConsoleSnippet(loaded.config);
    if (opts.jsonOutput) {
      io.stdout(JSON.stringify({ ok: loaded.ok, configPath: loaded.filePath, snippet }, null, 2));
    } else {
      io.stdout(snippet);
    }
    return { exitCode: loaded.ok ? 0 : 1, snippet };
  }

  if (opts.mode === "extract") {
    let report;
    try {
      report = loadExtractionReportFromFile(opts.inputFile, opts.inputType, loaded.config);
    } catch (err) {
      io.stderr(`Failed to parse input ${opts.inputFile}: ${err.message || err}`);
      return { exitCode: 1, error: String(err.message || err) };
    }

    const feasibility = extractor.evaluateConfigFeasibility(loaded.config, report, routing);
    const payload = { ...report, feasibility };

    if (opts.writeSnapshot) {
      fs.mkdirSync(path.dirname(opts.writeSnapshot), { recursive: true });
      fs.writeFileSync(opts.writeSnapshot, JSON.stringify(payload, null, 2) + "\n", "utf8");
    }

    if (opts.jsonOutput) {
      io.stdout(JSON.stringify(payload, null, 2));
    } else {
      const lines = [
        `Current Model        : ${report.currentModel || "(unknown)"}`,
        `Feasible Model Names : ${report.feasibleModelNames.length > 0 ? report.feasibleModelNames.join(", ") : "(none)"}`,
        `Excluded Models      : ${report.excludedModels.map(m => `${m.exactName} [${m.isAuto ? "auto" : m.lockReason || "locked"}]`).join(", ") || "(none)"}`,
        `Thinking Levels      : ${report.thinkingLevels.map(t => `${t.exactName}${t.canonicalId ? ` (${t.canonicalId})` : ""}`).join(", ") || "(none found in snippet)"}`,
        "",
        "Task Feasibility Audit:"
      ];
      for (const t of feasibility.tasks) {
        const fbNote = t.fallbackUsed ? ` [FALLBACK from ${t.configuredModel}]` : "";
        const domNote = t.exactDomMatches.length > 0 ? t.exactDomMatches.join(" | ") : "NO MATCH";
        lines.push(`  - ${t.taskId.padEnd(32)} -> ${t.resolvedModel} / ${t.thinkingLevel}${fbNote} (DOM: ${domNote})`);
      }
      if (feasibility.unmappedFeasibleNames.length > 0) {
        lines.push("", `Unmapped Feasible Names: ${feasibility.unmappedFeasibleNames.join(", ")}`);
      }
      io.stdout(lines.join("\n"));
    }
    return { exitCode: report.ok ? 0 : 1, report: payload };
  }

  if (opts.mode === "sync") {
    if (!loaded.ok) {
      io.stderr(`Cannot sync into invalid config ${loaded.filePath}: ${loaded.errors.join("; ")}`);
      return { exitCode: 1 };
    }
    const extType = opts.syncPatternsFile.toLowerCase().endsWith(".html") || opts.syncPatternsFile.toLowerCase().endsWith(".htm")
      ? "html"
      : "json";
    let report;
    try {
      report = loadExtractionReportFromFile(opts.syncPatternsFile, extType, loaded.config);
    } catch (err) {
      io.stderr(`Failed to read ${opts.syncPatternsFile}: ${err.message || err}`);
      return { exitCode: 1, error: String(err.message || err) };
    }

    const rawConfigObj = JSON.parse(fs.readFileSync(loaded.filePath, "utf8"));
    const { updated, added } = mergeSyncedPatterns(rawConfigObj, report, loaded.config);
    const revalidated = routing.validateAndNormalizeConfig(updated);
    if (!revalidated.valid) {
      io.stderr(`Merged config failed validation: ${revalidated.errors.join("; ")}`);
      return { exitCode: 1 };
    }
    if (added.length > 0) {
      fs.writeFileSync(loaded.filePath, JSON.stringify(updated, null, 2) + "\n", "utf8");
    }
    if (opts.jsonOutput) {
      io.stdout(JSON.stringify({ ok: true, configPath: loaded.filePath, added }, null, 2));
    } else {
      io.stdout(added.length > 0
        ? `Added ${added.length} new pattern(s) to ${loaded.filePath}: ${added.map(a => `${a.model}+="${a.pattern}"`).join(", ")}`
        : `No new domPatterns needed in ${loaded.filePath}.`);
    }
    return { exitCode: 0, added };
  }

  // Default: --validate
  if (opts.jsonOutput) {
    io.stdout(JSON.stringify(loaded, null, 2));
  } else {
    io.stdout(formatValidationSummary(loaded));
  }
  return { exitCode: loaded.ok ? 0 : 1, loaded };
}

if (require.main === module) {
  const res = runCli(process.argv.slice(2));
  process.exitCode = res.exitCode;
}

module.exports = {
  runCli,
  parseArgs,
  mergeSyncedPatterns,
  formatValidationSummary
};
