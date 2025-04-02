import type { Metadata } from "next";
// import { motion } from 'framer-motion'; // Removed motion import
import { Geist, Geist_Mono } from "next/font/google"; // Corrected font import name
// import StationSearch from "../components/StationSearch"; // Moved to AnimatedHeader
import { ThemeProvider } from "../components/ThemeProvider"; // Import ThemeProvider
// import { ThemeToggleButton } from "../components/ThemeToggleButton"; // Moved to AnimatedHeader
import { AnimatedHeader } from "../components/AnimatedHeader"; // Import the new header component
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Define base URL (replace with environment variable if needed for deployment)
const siteBaseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'; // Default to localhost for dev

export const metadata: Metadata = {
  metadataBase: new URL(siteBaseUrl), // Important for resolving relative image paths
  title: {
    default: "Dutch Train Departures", // Default title for the site
    template: "%s | Dutch Train Departures", // Template for page-specific titles
  },
  description: "Check live train departures and arrivals for stations in the Netherlands.",
  openGraph: {
    title: "Dutch Train Departures",
    description: "Check live train departures and arrivals for stations in the Netherlands.",
    url: siteBaseUrl,
    siteName: "Dutch Train Departures",
    images: [
      {
        url: '/globe.svg', // Path relative to the public directory
        width: 800, // Provide dimensions if known
        height: 600,
        alt: 'Globe icon representing the Netherlands train network',
      },
    ],
    locale: 'en_US', // Or 'nl_NL' if preferred
    type: 'website',
  },
  // Optional: Add Twitter specific tags if needed
  // twitter: {
  //   card: 'summary_large_image',
  //   title: 'Dutch Train Departures',
  //   description: 'Check live train departures and arrivals for stations in the Netherlands.',
  //   images: [`${siteBaseUrl}/globe.svg`], // Must be absolute URL for Twitter
  // },
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
          {/* Use the new AnimatedHeader client component */}
          <AnimatedHeader />
          {/* Removed extra closing header tag */}
          <main>{children}</main> {/* Wrap children in main */}
        </ThemeProvider>
      </body>
    </html>
  );
}
