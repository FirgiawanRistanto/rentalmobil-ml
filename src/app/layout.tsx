import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Besan Rental Mobil Lampung — Smart Rental dengan Harga AI",
  description:
    "Rental mobil cerdas di Lampung. Harga dinamis berbasis AI Random Forest. All-in termasuk supir dan BBM.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght@100..700,0..1&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body className={`${inter.variable} ${plusJakarta.variable} bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-slate-100 antialiased`}>
        <div className="relative flex min-h-screen w-full flex-col">
          <Navbar />
          {children}
          <Footer />
        </div>
      </body>
    </html>
  );
}
