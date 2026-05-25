import { writeTestingReport } from "./report";

const { summaryPath, jsonPath, passed, failed, total } = writeTestingReport();
console.log("\n--- Role & Team scenario report (final) ---");
console.log(`Scenarios: ${total} | Passed: ${passed} | Failed: ${failed}`);
console.log(`JSON: ${jsonPath}`);
console.log(`Summary: ${summaryPath}`);
process.exit(failed > 0 ? 1 : 0);
