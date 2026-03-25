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
    }),
  ],
  callbacks: {
    signIn({ user }) {
      // If no allowlist is set, allow everyone (dev mode)
      if (allowedEmails.length === 0) return true;
      const email = user.email?.toLowerCase() || "";
      return allowedEmails.includes(email);
    },
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
});
