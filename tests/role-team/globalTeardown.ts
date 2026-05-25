import { writeTestingReport } from "./report";

export default function globalTeardown() {
  const { summaryPath, jsonPath, passed, failed, total } = writeTestingReport();
  console.log("\n--- Role & Team scenario report (final) ---");
  console.log(`Scenarios: ${total} | Passed: ${passed} | Failed: ${failed}`);
  console.log(`JSON: ${jsonPath}`);
  console.log(`Summary: ${summaryPath}`);
}
