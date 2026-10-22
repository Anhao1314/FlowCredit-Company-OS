// Coverage gate. Zero dependencies, no network, no model calls.
//
// Runs the suite once with the test runner's built-in coverage and enforces
// the README baseline minus a small drift margin. The measured baseline is
// lines 87.1 / branches 82.4 / functions 83.3; the gate floors are set just
// under it so routine drift fails the build while a meaningful regression
// cannot sneak through. CI job: coverage (Node 24.x — the support target).
import { spawn } from "node:child_process";

const num = (name, fallback) => {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > 100)
    throw new Error(`${name} must be a number between 0 and 100`);
  return value;
};

const MIN_LINES = num("FLOWCREDIT_COVERAGE_MIN_LINES", 86.5);
const MIN_BRANCHES = num("FLOWCREDIT_COVERAGE_MIN_BRANCHES", 81.5);
const MIN_FUNCTIONS = num("FLOWCREDIT_COVERAGE_MIN_FUNCTIONS", 82.5);

const child = spawn(process.execPath, ["--test", "--experimental-test-coverage"], {
  stdio: ["ignore", "pipe", "pipe"],
});
let output = "";
child.stdout.on("data", (chunk) => {
  output += chunk;
  process.stdout.write(chunk);
});
child.stderr.on("data", (chunk) => process.stderr.write(chunk));

child.on("close", (code) => {
  if (code !== 0) {
    console.error(`coverage gate: the test suite itself failed (exit ${code})`);
    process.exit(code ?? 1);
  }
  const row = output.split("\n").find((line) => line.includes("all files"));
  if (!row) {
    console.error("coverage gate: no coverage summary found in the test runner output");
    process.exit(1);
  }
  const numbers = [...row.matchAll(/\d+\.\d+/g)].map((match) => Number(match[0]));
  if (numbers.length < 3) {
    console.error(`coverage gate: could not parse the summary row: ${row.trim()}`);
    process.exit(1);
  }
  const [lines, branches, functions] = numbers;
  const breaches = [];
  if (lines < MIN_LINES) breaches.push(`lines ${lines} < ${MIN_LINES}`);
  if (branches < MIN_BRANCHES) breaches.push(`branches ${branches} < ${MIN_BRANCHES}`);
  if (functions < MIN_FUNCTIONS) breaches.push(`functions ${functions} < ${MIN_FUNCTIONS}`);
  if (breaches.length > 0) {
    console.error(
      `coverage gate: FAIL — ${breaches.join("; ")} (baseline: lines ≥ ${MIN_LINES}, branches ≥ ${MIN_BRANCHES}, functions ≥ ${MIN_FUNCTIONS})`,
    );
    process.exit(1);
  }
  console.log(
    `coverage gate: PASS — lines ${lines} ≥ ${MIN_LINES}, branches ${branches} ≥ ${MIN_BRANCHES}, functions ${functions} ≥ ${MIN_FUNCTIONS}`,
  );
});
