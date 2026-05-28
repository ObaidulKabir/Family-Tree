import type { Metadata } from "next";
import { Geist, Geist_Mono, Merriweather } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const merriweather = Merriweather({
  weight: ["300", "400", "700", "900"],
  subsets: ["latin"],
  variable: "--font-serif",
});

export const metadata: Metadata = {
  title: "Family Tree App • Prospectbd Software",
  description: "Collaborative Family Tree Builder by Prospectbd Software",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const year = new Date().getFullYear();

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${merriweather.variable} antialiased`}
      >
        <div className="min-h-screen flex flex-col">
          <div className="flex-1">{children}</div>
          <footer className="border-t border-slate-200 bg-white">
            <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-4 text-center text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:text-left">
              <div>Powered by Prospectbd Software</div>
              <div>© {year} Prospectbd Software. All rights reserved.</div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
