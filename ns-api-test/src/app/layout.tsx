import type { Metadata } from "next";
// import { motion } from 'framer-motion'; // Removed motion import
// import { motion } from 'framer-motion'; // Removed motion import
import { Geist, Geist_Mono } from "next/font/google"; // Corrected font import name
// import StationSearch from "../components/StationSearch"; // Moved to AnimatedHeader
import { ThemeProvider } from "../components/ThemeProvider"; // Import ThemeProvider
// import { ThemeToggleButton } from "../components/ThemeToggleButton"; // Moved to AnimatedHeader
import { AnimatedHeader } from "../components/AnimatedHeader"; // Import the new header component
import PinnedJourneyDisplay from "../components/PinnedJourneyDisplay"; // Import PinnedJourneyDisplay (default export)
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
    default: "Spoorwijzer", // Default title for the site
    template: "%s | Spoorwijzer", // Template for page-specific titles
  },
  description: "Check live train departures and arrivals for stations in the Netherlands.", // Description can remain the same or be updated if desired
  openGraph: {
    title: "Spoorwijzer",
    description: "Check live train departures and arrivals for stations in the Netherlands.",
    url: siteBaseUrl,
    siteName: "Spoorwijzer",
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
  icons: {
      icon: '/assets/global/Spoorwijzer Favicon.svg', // Path to your SVG favicon in the public directory
      // You can also specify other icon types like apple-touch-icon here if needed
      // apple: '/apple-icon.png',
  },
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
          <PinnedJourneyDisplay /> {/* Add the pinned journey display */}
          {/* Removed extra closing header tag */}
          <main>{children}</main> {/* Wrap children in main */}
        </ThemeProvider>
      </body>
    </html>
  );
}
