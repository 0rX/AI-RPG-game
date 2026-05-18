import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RelicForge",
  description: "AI-powered text RPG world builder and runtime"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
