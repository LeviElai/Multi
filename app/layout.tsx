import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MULTIGAME — Make a night of it",
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
