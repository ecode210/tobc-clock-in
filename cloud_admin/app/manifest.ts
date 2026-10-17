import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TOBC Clock-In Admin",
    short_name: "TOBC Admin",
    description:
      "Manage workers, track attendance, and export clock-in records for The Olivebrook Church.",
    start_url: "/",
    display: "standalone",
    background_color: "#f2f0f6",
    theme_color: "#f8096d",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
