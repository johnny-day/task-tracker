import { AuthOptions, Session } from "next-auth";
import { JWT } from "next-auth/jwt";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "./prisma";

export interface ExtendedSession extends Session {
  accessToken?: string;
  error?: string;
}

export const authOptions: AuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      authorization: {
        params: {
          scope:
            "openid email profile https://www.googleapis.com/auth/calendar.readonly",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  callbacks: {
    async session({ session, user }): Promise<ExtendedSession> {
      const account = await prisma.account.findFirst({
        where: { userId: user.id, provider: "google" },
      });

      if (account?.expires_at && account.expires_at * 1000 < Date.now()) {
        try {
          const res = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              client_id: process.env.GOOGLE_CLIENT_ID || "",
              client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
              grant_type: "refresh_token",
              refresh_token: account.refresh_token || "",
            }),
          });

          const tokens = await res.json();

          if (!res.ok) throw tokens;

          await prisma.account.update({
            where: { id: account.id },
            data: {
              access_token: tokens.access_token,
              expires_at: Math.floor(Date.now() / 1000 + tokens.expires_in),
              refresh_token: tokens.refresh_token ?? account.refresh_token,
            },
          });

          return { ...session, accessToken: tokens.access_token };
        } catch {
          return { ...session, error: "RefreshTokenError" };
        }
      }

      return { ...session, accessToken: account?.access_token ?? undefined };
    },
  },
  pages: {
    signIn: "/settings",
  },
};
