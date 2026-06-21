import type { Metadata, Viewport } from "next";
import "./globals.css";
import AppShell from "@/components/app-shell";
import ServiceWorkerRegister from "@/components/service-wroker-register";

export const metadata: Metadata = {
  title: {
    default: "Meal Planner",
    template: "%s | Meal Planner",
  },
  description:
    "Personal meal planning, cooking scheduling, pantry tracking, and shopping.",
  applicationName: "Meal Planner",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Meal Planner",
  },
};

export const viewport: Viewport = {
  themeColor: "#1f5132",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <ServiceWorkerRegister />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}