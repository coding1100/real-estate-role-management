/**
 * Renders React Email templates to HTML files and optionally sends a test via Resend.
 * Run: npm run test:email
 * Optional: RESEND_API_KEY, RESEND_FROM_EMAIL, EMAIL_TEST_TO=you@example.com
 */
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { Resend } from "resend";
import {
  renderDocumentDeliveryEmailHtml,
  renderNewLeadEmailHtml,
} from "../lib/email-render";

async function main() {
  const outDir = join(process.cwd(), "scripts", "email-preview-output");
  await mkdir(outDir, { recursive: true });

  const lead = await renderNewLeadEmailHtml({
    leadType: "buyer",
    domainHostname: "bendhomeforsale.us",
    pageSlug: "home-value-estimate",
    brandName: "Bend Home For Sale",
    fieldRows: [
      { label: "name", value: "Alex Rivera" },
      { label: "email", value: "alex@example.com" },
      { label: "phone", value: "(541) 555-0199" },
      { label: "timeline", value: "3–6 months" },
    ],
  });

  const doc = await renderDocumentDeliveryEmailHtml({
    siteName: "Bend Home For Sale",
    domainHostname: "bendhomeforsale.us",
    pageSlug: "market-report",
    documentNames: ["Bend Market Report Q1.pdf", "Neighborhood guide.pdf"],
  });

  await writeFile(join(outDir, "new-lead.html"), lead.html, "utf8");
  await writeFile(join(outDir, "new-lead.txt"), lead.text, "utf8");
  await writeFile(join(outDir, "document-delivery.html"), doc.html, "utf8");
  await writeFile(join(outDir, "document-delivery.txt"), doc.text, "utf8");

  console.log("Email preview files written to:", outDir);
  console.log("  - new-lead.html / .txt");
  console.log("  - document-delivery.html / .txt");

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  const testTo = process.env.EMAIL_TEST_TO?.trim();

  if (apiKey && from && testTo) {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from,
      to: testTo,
      subject: "[Test] New buyer lead — React Email template",
      html: lead.html,
      text: lead.text,
    });
    await resend.emails.send({
      from,
      to: testTo,
      subject: "[Test] Document delivery — React Email template",
      html: doc.html,
      text: doc.text,
    });
    console.log("Sent 2 test messages to", testTo);
  } else {
    console.log(
      "Skip live send (set RESEND_API_KEY, RESEND_FROM_EMAIL, EMAIL_TEST_TO to test Resend).",
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
