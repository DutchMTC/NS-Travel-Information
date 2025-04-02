import type { Metadata } from 'next'; // Import Metadata types
import { stations } from '../../lib/stations'; // Keep stations for name lookup
import { StationJourneyDisplay } from '../../components/StationJourneyDisplay'; // Import the client wrapper
import { AnimatedStationHeading } from '../../components/AnimatedStationHeading'; // Import the new heading component

// Define base URL (consistent with layout.tsx)
const siteBaseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

// Define props for the page component and generateMetadata
interface StationPageProps {
  params: Promise<{ stationCode: string }>; // Correct: params is the resolved object
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>; // Correct: searchParams is the resolved object
}

// --- Dynamic Metadata Generation ---
// Correct: Destructure params directly
export async function generateMetadata(props: StationPageProps): Promise<Metadata> {
  const params = await props.params;
  // Correct: Access params directly
  const stationCode = params.stationCode.toUpperCase();
  const station = stations.find(s => s.code.toUpperCase() === stationCode);
  const stationName = station ? station.name : stationCode; // Fallback to code

  const title = stationName ? `${stationName} Departures & Arrivals` : 'Station Information';
  const description = `View live train departures and arrivals for ${stationName || 'this station'} in the Netherlands.`;

  return {
    title: stationName || 'Station', // Sets the <title> tag
    description: description,
    openGraph: {
      title: title,
      description: description,
      url: `${siteBaseUrl}/${stationCode}`, // URL specific to this station
    },
  };
}

// --- Page Component ---
// Correct: Make non-async, destructure params directly
export default async function StationPage(props: StationPageProps) {
  const params = await props.params;
  const { stationCode } = params; // Destructure stationCode from params
  const upperCaseStationCode = stationCode.toUpperCase();

  // Find the station name from the imported list (synchronous operation)
  const station = stations.find(s => s.code.toUpperCase() === upperCaseStationCode);
  const stationName = station ? station.name : upperCaseStationCode; // Fallback to code

  // No data fetching here, just render the client component responsible for fetching
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 font-[family-name:var(--font-geist-sans)]">
      <main className="max-w-4xl mx-auto p-4 sm:p-8">
        {/* Use the animated heading component */}
        <AnimatedStationHeading stationName={stationName} />

        {/* Render the client component, passing necessary props */}
        <StationJourneyDisplay
          stationCode={upperCaseStationCode}
          stationName={stationName}
        />
      </main>
    </div>
  );
}