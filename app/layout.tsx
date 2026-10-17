import SoundDesign from '../apps/web/components/SoundDesign';
import { Atmosphere } from '../apps/web/components/world/Atmosphere';
import type { Metadata } from "next";
import "./globals.css";
import "../apps/web/components/creator.css";
import "./world.css";
import "./product.css";
import "./arcade.css";
import "./reactions.css";
import "./characters.css";
import "./clarity.css";
export const metadata: Metadata = {
    title: "MULTIGAME — One quiz. Five different games.",
    description: "Five wildly different games. One room. Create your own multiplayer game show.",
    robots: { index: false, follow: false },
    icons: {
        icon: "/favicon.svg",
        shortcut: "/favicon.svg",
    },
};
export default function RootLayout({ children, }: Readonly<{
    children: React.ReactNode;
}>) {
    return (<html lang="en"><head/>
      <body className="antialiased"><SoundDesign/><Atmosphere global/>{children}</body>
    </html>);
}
