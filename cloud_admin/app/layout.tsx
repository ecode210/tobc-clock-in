import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "TOBC Clock-In",
    template: "%s · TOBC Clock-In",
  },
  description: "Church clock-in administration portal",
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
