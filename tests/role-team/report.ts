import fs from "node:fs";
import path from "node:path";

export type ScenarioRecord = {
  id: string;
  category: string;
  name: string;
  actor: string;
  expected: string;
  actual: string;
  pass: boolean;
};

const REPORT_DIR = path.join(process.cwd(), "reports");
const BUFFER_PATH = path.join(REPORT_DIR, "scenario-buffer.jsonl");

export function recordScenario(record: ScenarioRecord): void {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.appendFileSync(BUFFER_PATH, `${JSON.stringify(record)}\n`, "utf8");
}

export function loadScenarioRecords(): ScenarioRecord[] {
  if (!fs.existsSync(BUFFER_PATH)) return [];
  return fs
    .readFileSync(BUFFER_PATH, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as ScenarioRecord);
}

export function clearScenarioRecords(): void {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(BUFFER_PATH, "", "utf8");
}

export function writeTestingReport(): {
  summaryPath: string;
  jsonPath: string;
  passed: number;
  failed: number;
  total: number;
} {
  const scenarios = loadScenarioRecords();
  const passed = scenarios.filter((s) => s.pass).length;
  const failed = scenarios.filter((s) => !s.pass).length;
  const total = scenarios.length;

  const byCategory = new Map<string, ScenarioRecord[]>();
  for (const s of scenarios) {
    const list = byCategory.get(s.category) ?? [];
    list.push(s);
    byCategory.set(s.category, list);
  }

  const reportDir = path.join(process.cwd(), "reports");
  fs.mkdirSync(reportDir, { recursive: true });

  const jsonPath = path.join(reportDir, "role-team-report.json");
  const summaryPath = path.join(reportDir, "role-team-report.txt");

  const payload = {
    generatedAt: new Date().toISOString(),
    summary: { total, passed, failed, passRate: total ? passed / total : 0 },
    categories: [...byCategory.entries()].map(([category, items]) => ({
      category,
      passed: items.filter((i) => i.pass).length,
      failed: items.filter((i) => !i.pass).length,
      scenarios: items,
    })),
  };

  fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2), "utf8");

  const lines: string[] = [
    "ROLE & TEAM MANAGEMENT — SCENARIO TEST REPORT",
    "=".repeat(60),
    `Generated: ${payload.generatedAt}`,
    `Total scenarios: ${total}`,
    `Passed: ${passed}`,
    `Failed: ${failed}`,
    `Pass rate: ${total ? ((passed / total) * 100).toFixed(1) : "0"}%`,
    "",
  ];

  for (const [category, items] of byCategory) {
    lines.push(`## ${category}`);
    lines.push("-".repeat(40));
    for (const s of items) {
      lines.push(
        `[${s.pass ? "PASS" : "FAIL"}] ${s.id} — ${s.name}`,
        `  Actor: ${s.actor}`,
        `  Expected: ${s.expected}`,
        `  Actual: ${s.actual}`,
        "",
      );
    }
  }

  if (failed > 0) {
    lines.push("FAILED SCENARIOS (action required)");
    lines.push("-".repeat(40));
    for (const s of scenarios.filter((x) => !x.pass)) {
      lines.push(`- ${s.id}: ${s.name} (${s.actor})`);
    }
  }

  fs.writeFileSync(summaryPath, lines.join("\n"), "utf8");

  return { summaryPath, jsonPath, passed, failed, total };
}
