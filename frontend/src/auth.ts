import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

const allowedEmails = (process.env.ALLOWED_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/drive.readonly",
        },
      },
    }),
  ],
  callbacks: {
    signIn({ user }) {
      // If no allowlist is set, allow everyone (dev mode)
      if (allowedEmails.length === 0) return true;
      const email = user.email?.toLowerCase() || "";
      return allowedEmails.includes(email);
    },
    jwt({ token, account }) {
      // Save Google access_token on initial sign-in
      if (account?.access_token) {
        token.google_access_token = account.access_token;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      // Expose Google access token so Drive API calls can use it
      (session as Record<string, unknown>).google_access_token =
        token.google_access_token ?? null;
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
});
