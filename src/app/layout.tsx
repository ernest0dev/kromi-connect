import type { Metadata } from "next";
import { Analytics } from '@vercel/analytics/next';
import { goldplay } from "@/fonts/goldplay";
import { inter } from "@/fonts/inter";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kromi Connect",
  description: "CRM y Panel de Contenido Digital",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="es"
      className={`${goldplay.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Analytics />
      </body>
    </html>
  );
}