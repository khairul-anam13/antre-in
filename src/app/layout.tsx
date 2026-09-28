import type { Metadata, Viewport } from "next";
import "./tokens.css";
import "./ios.css";
import "./app.css";

export const metadata: Metadata = {
  title: { default: "Antre-in", template: "%s · Antre-in" },
  description: "Pesan minuman dari HP, bayar online, ambil tanpa antre.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Antre-in", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f2f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        <div className="wallpaper" aria-hidden />
        {children}
      </body>
    </html>
  );
}
