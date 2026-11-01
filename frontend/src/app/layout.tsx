import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { Ambient } from "@/components/Ambient";
import { Preloader } from "@/components/Preloader";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "RANNAMATE — Your Kitchen. Your Mood. Your Mate.",
  description: "Tell RANNAMATE what you have and what you crave. It finds recipes you can actually cook and talks you through them.",
};

export const viewport: Viewport = { themeColor: "#F5DABF" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..700;1,9..144,300..600&family=Manrope:wght@400;500;600;700;800&display=swap"
        />
      </head>
      <body className="font-sans min-h-screen">
        <Preloader />
        <Ambient />
        <Navbar />
        <main className="relative z-10">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
