import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Figtree } from "next/font/google";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = {
  title: "FarmSignal — field operations for cooperatives",
  description: "Turns field observations and potential anomalies into prioritized inspection tasks.",
};

export const viewport: Viewport = {
  themeColor: "#0e3d21",
};

const figtree = Figtree({ subsets: ["latin"], variable: "--font-figtree" });

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={figtree.variable}>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
