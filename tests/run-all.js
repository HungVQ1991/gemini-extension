const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const testsDir = __dirname;
const suites = fs
  .readdirSync(testsDir)
  .filter((name) => /^verify_.*\.js$/.test(name))
  .sort();

if (suites.length === 0) {
  console.error("No verify_*.js test suites found in", testsDir);
  process.exit(1);
}

const results = [];
let failed = 0;
const totalStart = Date.now();

for (const suite of suites) {
  const fullPath = path.join(testsDir, suite);
  console.log(`\n=== Running ${suite} ===`);
  const start = Date.now();
  const proc = spawnSync(process.execPath, [fullPath], { stdio: "inherit" });
  const elapsedMs = Date.now() - start;
  const code = proc.status === null ? 1 : proc.status;
  results.push({ suite, code, elapsedMs });
  if (code !== 0) {
    failed++;
    console.error(`FAIL: ${suite} exited with code ${code}`);
  }
}

const totalMs = Date.now() - totalStart;
console.log("\n=== Suite Summary ===");
for (const r of results) {
  console.log(`${r.code === 0 ? "PASS" : "FAIL"} ${r.suite.padEnd(34)} (${r.elapsedMs}ms)`);
}
console.log(`Total: ${results.length - failed}/${results.length} passed in ${totalMs}ms`);

if (failed > 0) {
  process.exit(1);
}
