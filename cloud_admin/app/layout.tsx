import type { Metadata, Viewport } from "next";
import "./globals.css";

const description =
  "Manage workers, track attendance, and export clock-in records for The Olivebrook Church.";

export const metadata: Metadata = {
  title: {
    default: "TOBC Clock-In Admin",
    template: "%s · TOBC Clock-In Admin",
  },
  description,
  applicationName: "TOBC Clock-In Admin",
  authors: [{ name: "The Olivebrook Church" }],
  appleWebApp: {
    capable: true,
    title: "TOBC Admin",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
  openGraph: {
    type: "website",
    siteName: "TOBC Clock-In",
    title: "TOBC Clock-In Admin",
    description,
  },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#f8096d",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
