import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./theatre.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Svengali’s Theatre",
  description: "Gather your puppets, defend your Stage, and steal the show. A multiplayer card game by Awais Ali Shah.",
  icons: { icon: "/theatre-mark.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
