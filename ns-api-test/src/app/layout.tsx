import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google"; // Corrected font import name
import StationSearch from "../components/StationSearch"; // Import the search component
import { ThemeProvider } from "../components/ThemeProvider"; // Import ThemeProvider
import { ThemeToggleButton } from "../components/ThemeToggleButton"; // Import ThemeToggleButton
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Create Next App",
  description: "Generated by create next app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50`} // Added bg-gray-50 for consistency
      >
        <ThemeProvider>
          <header className="p-4 bg-white shadow-md sticky top-0 z-20 dark:bg-gray-800"> {/* Added dark mode bg */}
            <div className="max-w-4xl mx-auto flex justify-between items-center"> {/* Container for layout */}
              <StationSearch />
              <ThemeToggleButton />
            </div>
          </header>
          <main>{children}</main> {/* Wrap children in main */}
        </ThemeProvider>
      </body>
    </html>
  );
}
