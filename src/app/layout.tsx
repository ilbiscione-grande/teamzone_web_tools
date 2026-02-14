import type { Metadata, Viewport } from "next";
import { Bebas_Neue, Space_Grotesk } from "next/font/google";
import "./globals.css";
import AuthListener from "@/components/AuthListener";
import PwaRegister from "@/components/PwaRegister";
import ScreenSizeNotice from "@/components/ScreenSizeNotice";
import { Analytics } from "@vercel/analytics/react";

const display = Bebas_Neue({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
});

const body = Space_Grotesk({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tactics Board Web",
  description: "Digital tactics board for football.",
  manifest: "/manifest.json",
  themeColor: "#0f1b1a",
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const adsenseClient = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  return (
    <html lang="sv">
      <head>
        {adsenseClient ? (
          <script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClient}`}
            crossOrigin="anonymous"
          />
        ) : null}
      </head>
      <body className={`${display.variable} ${body.variable} antialiased`}>
        {children}
        <Analytics />
        <AuthListener />
        <PwaRegister />
        <ScreenSizeNotice />
      </body>
    </html>
  );
}
