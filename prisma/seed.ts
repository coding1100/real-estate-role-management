import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

// Load environment variables (including .env.local like Next.js)
dotenv.config();
dotenv.config({ path: ".env.local", override: true });

function createPrismaForSeed() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  const pool = new pg.Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

const prisma = createPrismaForSeed();

async function main() {
  // Seed a default admin user (email/password to be changed in production)
  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@example.com";
  const adminPassword =
    process.env.SEED_ADMIN_PASSWORD || "change-me-please";

  const passwordHash = await bcrypt.hash(adminPassword, 10);

  await prisma.adminUser.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash,
      name: "Admin",
    },
  });

  // Seed buyer and seller master templates with minimal structure
  await prisma.masterTemplate.upsert({
    where: { type: 'buyer' },
    update: {},
    create: {
      type: "buyer",
      name: "Buyer Master Template",
      sections: {},
      formSchema: {},
    },
  });

  await prisma.masterTemplate.upsert({
    where: { type: 'seller' },
    update: {},
    create: {
      type: "seller",
      name: "Seller Master Template",
      sections: {},
      formSchema: {},
    },
  });

  const buyerTemplate = await prisma.masterTemplate.findUnique({
    where: { type: "buyer" },
  });
  if (!buyerTemplate) throw new Error("Buyer template not found");

  const domain = await prisma.domain.upsert({
    where: { hostname: "bendhomes.us" },
    update: {},
    create: {
      hostname: "bendhomes.us",
      displayName: "Bend Homes",
      notifyEmail: "admin@example.com",
    },
  });

  await prisma.landingPage.upsert({
    where: {
      domainId_slug: { domainId: domain.id, slug: "tetherow-home" },
    },
    update: { status: "published" },
    create: {
      domainId: domain.id,
      slug: "tetherow-home",
      masterTemplateId: buyerTemplate.id,
      type: "buyer",
      status: "published",
      headline: "Tetherow Home",
      subheadline: "Your local market update",
      sections: [{ kind: "hero", id: "hero", props: {} }],
      formSchema: { fields: [] },
    },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

