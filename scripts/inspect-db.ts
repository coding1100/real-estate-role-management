import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

function createPrismaForScript() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  const pool = new pg.Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

const prisma = createPrismaForScript();

async function main() {
  const domains = await prisma.domain.findMany();
  const pages = await prisma.landingPage.findMany({
    include: { domain: true },
  });

  console.log("Domains:");
  console.dir(domains, { depth: null });
  console.log("\nLandingPages:");
  console.dir(pages, { depth: null });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

