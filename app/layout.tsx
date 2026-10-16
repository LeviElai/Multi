import type { Metadata } from "next";
import "./globals.css";
import "./world.css";

export const metadata: Metadata = {
  title: "MULTIGAME — One quiz. Five different games.",
  description: "Five wildly different games. One room. Create your own multiplayer game show.",
  robots: { index: false, follow: false },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
