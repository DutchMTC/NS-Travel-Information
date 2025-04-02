// Removed all server-side data fetching imports (getDepartures, etc.)
import { stations } from '../../lib/stations'; // Keep stations for name lookup
import { StationJourneyDisplay } from '../../components/StationJourneyDisplay'; // Import the client wrapper

// Removed Edge runtime export to see if it resolves the params error

// Define props for the page component
interface StationPageProps {
  params: Promise<{ stationCode: string }>;
  // searchParams might be needed if we pass them down later
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

// Make the page component non-async
// Destructure stationCode directly in the signature
export default async function StationPage(props: StationPageProps) {
  const params = await props.params;

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