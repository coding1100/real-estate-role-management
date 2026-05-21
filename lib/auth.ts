import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import {
  loadUserAccess,
  listUserTenants,
  resolveActiveTenantId,
} from "./authorization";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/admin/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: {},
        password: {},
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.adminUser.findUnique({
          where: { email: credentials.email },
        });
        if (!user) return null;

        const valid = await bcrypt.compare(
          credentials.password,
          user.passwordHash,
        );
        if (!valid) return null;

        const tenantId = await resolveActiveTenantId(user.id, null);
        if (!tenantId && !user.isPlatformAdmin) return null;

        const access =
          tenantId != null
            ? await loadUserAccess(user.id, tenantId)
            : null;
        if (!access && !user.isPlatformAdmin) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        const tenantId = await resolveActiveTenantId(token.id as string, null);
        if (tenantId) token.activeTenantId = tenantId;
      }
      if (trigger === "update" && session?.activeTenantId) {
        token.activeTenantId = session.activeTenantId as string;
      }
      return token;
    },
    async session({ session, token }) {
      const userId = token.id as string | undefined;
      if (!session.user || !userId) return session;

      session.user.id = userId;
      const activeTenantId =
        (token.activeTenantId as string | undefined) ??
        (await resolveActiveTenantId(userId, null)) ??
        undefined;

      if (activeTenantId) {
        session.user.activeTenantId = activeTenantId;
        const access = await loadUserAccess(userId, activeTenantId);
        if (access) {
          session.user.email = access.email;
          session.user.tenantId = access.tenantId;
          session.user.tenantName = access.tenantName;
          session.user.isPlatformAdmin = access.isPlatformAdmin;
          session.user.isTenantAdmin = access.isTenantAdmin;
        }
      }

      session.user.tenants = await listUserTenants(userId);

      return session;
    },
  },
};

export async function getServerAuthSession() {
  return getServerSession(authOptions);
}
