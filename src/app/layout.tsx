import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = {
  title: "FarmSignal — field operations for cooperatives",
  description: "Turns field observations and potential anomalies into prioritized inspection tasks.",
};

export const viewport: Viewport = {
  themeColor: "#1b3626",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
