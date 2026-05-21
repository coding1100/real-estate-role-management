import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import {
  ensureDefaultTenant,
  seedTenantRoles,
  getBuiltInRoleId,
} from "../lib/tenantRoles";
import { migrateLegacyUsersToTenant } from "../lib/team";

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
  const tenantId = await ensureDefaultTenant();
  await seedTenantRoles(tenantId);

  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@example.com";
  const adminPassword =
    process.env.SEED_ADMIN_PASSWORD || "change-me-please";
  const passwordHash = await bcrypt.hash(adminPassword, 10);
  const adminRoleId = await getBuiltInRoleId(tenantId, "admin");
  if (!adminRoleId) throw new Error("Admin tenant role missing");

  const user = await prisma.adminUser.upsert({
    where: { email: adminEmail },
    update: {
      isPlatformAdmin: true,
      allDomainsRole: "admin",
    },
    create: {
      email: adminEmail,
      passwordHash,
      name: "Admin",
      isPlatformAdmin: true,
      allDomainsRole: "admin",
    },
  });

  await prisma.tenantMembership.upsert({
    where: {
      tenantId_userId: { tenantId, userId: user.id },
    },
    update: {
      allDomainsRoleId: adminRoleId,
      isTenantAdmin: true,
    },
    create: {
      tenantId,
      userId: user.id,
      allDomainsRoleId: adminRoleId,
      isTenantAdmin: true,
    },
  });

  await migrateLegacyUsersToTenant(tenantId);

  await prisma.masterTemplate.upsert({
    where: { type: "buyer" },
    update: {},
    create: {
      type: "buyer",
      name: "Buyer Master Template",
      sections: {},
      formSchema: {},
    },
  });

  await prisma.masterTemplate.upsert({
    where: { type: "seller" },
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
    where: {
      tenantId_hostname: { tenantId, hostname: "bendhomes.us" },
    },
    update: {},
    create: {
      tenantId,
      hostname: "bendhomes.us",
      displayName: "Bend Homes",
      notifyEmail: adminEmail,
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
