import type { Metadata } from 'next'; // Import Metadata types (Removed ResolvingMetadata)
import { stations } from '../../lib/stations'; // Keep stations for name lookup
import { StationJourneyDisplay } from '../../components/StationJourneyDisplay'; // Import the client wrapper

// Define base URL (consistent with layout.tsx)
const siteBaseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
// Removed Edge runtime export to see if it resolves the params error

// Define props for the page component and generateMetadata
interface StationPageProps {
  params: Promise<{ stationCode: string }>; // params is the resolved object, not a promise
  // searchParams might be needed if we pass them down later
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>; // Also not a promise here
}

// --- Dynamic Metadata Generation ---
export async function generateMetadata(props: StationPageProps): Promise<Metadata> {
  const params = await props.params;
  const stationCode = params.stationCode.toUpperCase(); // Access directly, no promise
  const station = stations.find(s => s.code.toUpperCase() === stationCode);
  const stationName = station ? station.name : stationCode; // Fallback to code

  // Optionally fetch data here if needed for metadata (e.g., specific image)
  // const product = await fetch(`https://...`).then((res) => res.json())

  // Get previous images (optional, if you want to keep layout images)
  // const previousImages = (await parent).openGraph?.images || []

  const title = stationName ? `${stationName} Departures & Arrivals` : 'Station Information';
  const description = `View live train departures and arrivals for ${stationName || 'this station'} in the Netherlands.`;

  return {
    title: stationName || 'Station', // Sets the <title> tag
    description: description,
    openGraph: {
      title: title,
      description: description,
      url: `${siteBaseUrl}/${stationCode}`, // URL specific to this station
      // images: [`${siteBaseUrl}/specific-station-image.png`], // Optional: Add specific image if available
      // images: [...previousImages], // Keep images from layout if desired
    },
    // Optional: Add Twitter specific tags if needed
    // twitter: {
    //   card: 'summary_large_image',
    //   title: title,
    //   description: description,
    //   // images: [`${siteBaseUrl}/specific-station-image.png`],
    // },
  };
}

// --- Page Component ---
// Make the page component non-async
// Destructure params directly in the signature
export default async function StationPage(props: StationPageProps) {
  const params = await props.params;
  // No need for async or props wrapper
  // const params = await props.params; // Removed await

  const {
    stationCode
  } = params;

  const upperCaseStationCode = stationCode.toUpperCase();

  // Find the station name from the imported list (synchronous operation)
  const station = stations.find(s => s.code.toUpperCase() === upperCaseStationCode);
  const stationName = station ? station.name : upperCaseStationCode; // Fallback to code

  // No data fetching here, just render the client component responsible for fetching
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 font-[family-name:var(--font-geist-sans)]">
      <main className="max-w-4xl mx-auto p-4 sm:p-8">
        {/* Header can remain simple or be part of StationJourneyDisplay */}
        <h1 className="text-3xl font-bold mb-6 text-center text-blue-900 dark:text-blue-300">
          {stationName}
        </h1>

        {/* Render the client component, passing necessary props */}
        {/* It will handle its own data fetching, loading, and error states */}
        <StationJourneyDisplay
          stationCode={upperCaseStationCode}
          stationName={stationName}
          // Remove initialJourneys prop, it's fetched client-side now
        />
      </main>
    </div>
  );
}