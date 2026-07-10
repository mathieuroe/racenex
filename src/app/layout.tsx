import type { Metadata } from "next";
import { Barlow_Semi_Condensed, Inter } from "next/font/google";
import "./globals.css";

const barlow = Barlow_Semi_Condensed({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  style: ["normal", "italic"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "racenex ∥ dein nächstes Rennen. deine Leute. deine Zeiten.",
  description:
    "Die Plattform für Ausdauersportler: alle deine Rennen an einem Ort — Triathlon, Hyrox, Marathon. Finde die Leute, die mit dir am Start stehen.",
  icons: {
    icon: "/racenex-app-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" className={`${barlow.variable} ${inter.variable}`}>
      <body className="min-h-screen bg-void font-body text-chalk antialiased">
        {children}
      </body>
    </html>
  );
}
