import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: "Frontpage — your personalized front page for tech content",
    template: "%s · Frontpage",
  },
  description:
    "Frontpage pulls the blogs, newsletters and changelogs you follow into one calm, organized reading dashboard. RSS and Atom, beautifully readable.",
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1117" },
  ],
};

/**
 * Applies the saved theme before first paint to avoid a flash. Reads the
 * persisted zustand store (safe: wrapped in try, falls back to system).
 */
const themeScript = `
try {
  var raw = localStorage.getItem("frontpage-store");
  var theme = raw ? (JSON.parse(raw).state || {}).prefs?.theme : null;
  if (theme === "dark" || (theme !== "light" && matchMedia("(prefers-color-scheme: dark)").matches)) {
    document.documentElement.setAttribute("data-theme", "dark");
  }
} catch (e) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
