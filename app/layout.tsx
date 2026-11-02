import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import SiteFooter from "./components/SiteFooter";
import SiteHeader from "./components/SiteHeader";
import Toaster from "./components/Toaster";
import "./globals.css";
import "./pages.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "cyrillic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const description = "Подберём игры под твоё настроение, время и то, что тебе нравится.";

export const metadata: Metadata = {
  title: {
    default: "PlayPick — во что поиграть сейчас",
    template: "%s — PlayPick",
  },
  description,
  applicationName: "PlayPick",
  openGraph: {
    type: "website",
    siteName: "PlayPick",
    locale: "ru_RU",
    title: "PlayPick — во что поиграть сейчас",
    description,
  },
  twitter: {
    card: "summary_large_image",
    title: "PlayPick — во что поиграть сейчас",
    description,
  },
};

export const viewport: Viewport = {
  themeColor: "#070b12",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full site-body">
        <a href="#main" className="skip-link">Перейти к содержимому</a>
        <SiteHeader />
        <div className="site-content" id="main">{children}</div>
        <SiteFooter />
        <Toaster />
      </body>
    </html>
  );
}
