import type { Metadata, Viewport } from "next";
import { Noto_Sans_SC } from "next/font/google";
import "./globals.css";
import { BootSplash } from "@/components/BootSplash";
import { CriticalImagePreload } from "@/components/CriticalImagePreload";
import { DesignStage } from "@/components/DesignStage";
import { OrientationPrompt } from "@/components/OrientationPrompt";
import { STAGE_SCALE_BOOTSTRAP } from "@/lib/design-stage";

const body = Noto_Sans_SC({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
});

export const metadata: Metadata = {
  title: "萌兽德扑 · CRITTER HOLD'EM",
  description: "可爱手机德州扑克派对：单人 AI、多人房间、观战与断线接管。",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "萌兽德扑",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#120e0a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: the bootstrap script writes --stage-scale
    // onto <html> before React hydrates.
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: STAGE_SCALE_BOOTSTRAP }} />
        <CriticalImagePreload />
      </head>
      <body
        className={`${body.variable} antialiased`}
        style={{ background: "#120e0a" }}
      >
        <BootSplash />
        <OrientationPrompt />
        <DesignStage>{children}</DesignStage>
      </body>
    </html>
  );
}
