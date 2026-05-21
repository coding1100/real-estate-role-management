// Use relative import so this script can run under ts-node without Next.js module aliasing.
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

// Load environment variables (including .env.local like Next.js)
dotenv.config();
dotenv.config({ path: ".env.local", override: true });

function createPrismaForSync() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  const pool = new pg.Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

const prisma = createPrismaForSync();

async function main() {
  const masterPages = await prisma.landingPage.findMany({
    where: {
      slug: {
        in: ["master-buyer", "master-seller"],
      },
    },
    select: {
      id: true,
      slug: true,
      type: true,
      sections: true,
      formSchema: true,
      masterTemplateId: true,
    },
  });

  if (masterPages.length === 0) {
    console.log("No master-buyer or master-seller pages found.");
    return;
  }

  console.log(`Found ${masterPages.length} master page(s). Syncing...`);

  for (const page of masterPages) {
    if (!page.masterTemplateId) {
      console.log(
        `Skipping page ${page.id} (${page.slug}) because it has no masterTemplateId.`,
      );
      continue;
    }

    const template = await prisma.masterTemplate.update({
      where: { id: page.masterTemplateId },
      data: {
        sections: page.sections as any,
        formSchema: (page.formSchema as any) ?? undefined,
      },
    });

    console.log(
      `Updated MasterTemplate ${template.id} (type=${template.type}) from page ${page.id} (slug=${page.slug}).`,
    );
  }

  console.log("Sync complete.");
}

main()
  .catch((err) => {
    console.error("Error syncing master templates from pages:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

