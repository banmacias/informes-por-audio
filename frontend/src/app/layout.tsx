import type { Metadata, Viewport } from "next";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import { SessionProvider } from "next-auth/react";

export const metadata: Metadata = {
  title: "Informes por Audio",
  description: "Graba sesiones, transcribe y genera informes clínicos",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="bg-gray-50 text-gray-900 antialiased">
        <SessionProvider>
          <main className="max-w-md mx-auto min-h-screen pb-20 px-4 pt-4">
            {children}
          </main>
          <BottomNav />
        </SessionProvider>
      </body>
    </html>
  );
}
