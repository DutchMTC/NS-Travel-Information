import { getDepartures, getTrainComposition, Journey, TrainUnit } from '../../lib/ns-api'; // Removed getArrivals
// Remove JourneyList import, it's used inside StationJourneyDisplay
import { stations } from '../../lib/stations'; // Import the stations list
import { StationJourneyDisplay } from '../../components/StationJourneyDisplay'; // Import the client wrapper
// Removed formatTime, calculateDelay as they are used in client components now


// Define props directly, including optional searchParams
export default async function StationPage({
  params,
  searchParams, // Explicitly include searchParams even if unused
}: {
  params: { stationCode: string };
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const { stationCode } = params; // Extract station code from params
  const upperCaseStationCode = stationCode.toUpperCase(); // Use consistent casing

  // State will be managed client-side later for the switch
  // For server-side rendering, we'll fetch departures by default
  let initialJourneys: Journey[] = [];
  let journeysWithComposition: (Journey & { composition: { length: number; parts: TrainUnit[] } | null })[] = [];
  let error: string | null = null;
  // Find the station name from the imported list
  const station = stations.find(s => s.code.toUpperCase() === upperCaseStationCode);
  const stationName = station ? station.name : upperCaseStationCode; // Fallback to code if not found

  try {
    // Use the dynamic station code from params
    initialJourneys = await getDepartures(upperCaseStationCode); // Fetch departures initially

    // --- Fetch Train Composition ---
    if (initialJourneys.length > 0) {
      const compositionPromises = initialJourneys.map(journey =>
        getTrainComposition(journey.product.number).catch(e => {
          console.error(`Failed to fetch composition for train ${journey.product.number}:`, e);
          return null;
        })
      );
      const compositions = await Promise.all(compositionPromises);

      journeysWithComposition = initialJourneys.map((journey, index) => ({
        ...journey,
        composition: compositions[index],
      }));
    }
    // --- End Fetch Train Composition ---

  } catch (err) {
    console.error(`Failed to fetch departures for ${upperCaseStationCode}:`, err);
    if (err instanceof Error) {
      error = err.message;
    } else {
      error = `An unknown error occurred while fetching departure data for ${upperCaseStationCode}.`;
    }
    if (error?.includes("NS API Key is missing")) {
        error = "Error: NS API Key is missing. Please ensure NSR_API_KEY is set in your .env.local file.";
    }
    // Add specific error for unknown station if UIC code wasn't found (optional enhancement)
    // if (error?.includes("UIC Code not found")) { ... }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 font-[family-name:var(--font-geist-sans)]"> {/* Added dark bg */}
      <main className="max-w-4xl mx-auto p-4 sm:p-8">
        <h1 className="text-3xl font-bold mb-6 text-center text-blue-900 dark:text-blue-300"> {/* Added dark text */}
          {/* Use stationName for the heading */}
          {stationName} {/* Title now just station name, type handled in client component */}
        </h1>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative text-center dark:bg-red-900/30 dark:border-red-700/50 dark:text-red-400" role="alert"> {/* Added dark error style */}
            <strong className="font-bold">Error:</strong>
            <span className="block sm:inline ml-2">{error}</span>
          </div>
        )}

        {/* Render the client component wrapper if there was no initial fetch error */}
        {!error && (
          <StationJourneyDisplay
            initialJourneys={journeysWithComposition}
            stationCode={upperCaseStationCode}
            stationName={stationName}
          />
        )}
      </main>
    </div>
  );
}