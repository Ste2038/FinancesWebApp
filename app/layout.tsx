import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Finances Web App",
  description: "Personal finance cockpit with SQLite imports, analytics, and Telegram automation."
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
