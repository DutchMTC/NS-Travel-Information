import type { Metadata } from 'next'; // Import Metadata types
import { stations } from '../../lib/stations';
// import StationSearch from '@/components/StationSearch'; // No longer needed here
import { StationJourneyDisplay } from '../../components/StationJourneyDisplay'; // Import the client wrapper
// import { AnimatedStationHeading } from '../../components/AnimatedStationHeading'; // Removed as heading is now in client component

// Force dynamic rendering for the page to ensure searchParams are always fresh
export const dynamic = 'force-dynamic';

// Define base URL (consistent with layout.tsx)
const siteBaseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

// Define props for the page component and generateMetadata
interface StationPageProps {
  params: Promise<{ stationCode: string }>; // Params are directly available in Server Components
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>; // SearchParams are directly available
}

// --- Dynamic Metadata Generation ---
// Correct: Destructure params directly
// generateMetadata receives props directly
export async function generateMetadata(props: StationPageProps): Promise<Metadata> {
  const params = await props.params;
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
// Page component receives props directly
export default async function StationPage(props: StationPageProps) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const { stationCode } = params;
  const upperCaseStationCode = stationCode.toUpperCase();

  // Find the station name from the imported list (synchronous operation)
  const station = stations.find(s => s.code.toUpperCase() === upperCaseStationCode);
  const stationName = station ? station.name : upperCaseStationCode;

  // Read initial offset from searchParams on the server
  const initialOffsetMinutes = parseInt(searchParams?.offsetM?.toString() || '0', 10);
  // No data fetching here, just render the client component responsible for fetching
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 font-[family-name:var(--font-geist-sans)]"> {/* Removed plain-mode class */}
      <main className="max-w-4xl mx-auto p-4 sm:p-8">
        {/* StationSearch removed as functionality moved to main page */}

        {/* Render the client component, passing necessary props */}
        <StationJourneyDisplay
          stationCode={upperCaseStationCode}
          stationName={stationName}
          initialOffsetMinutes={isNaN(initialOffsetMinutes) ? 0 : initialOffsetMinutes} // Pass initial offset
        />
      </main>
    </div>
  );
}