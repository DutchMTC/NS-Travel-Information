import { stations } from '../../lib/stations'; // Import the stations list
// import { getDepartures, getTrainComposition, Journey, TrainUnit } from '../../lib/ns-api'; // Temporarily commented out
// import { StationJourneyDisplay } from '../../components/StationJourneyDisplay'; // Temporarily commented out


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

  // Find the station name from the imported list
  const station = stations.find(s => s.code.toUpperCase() === upperCaseStationCode);
  const stationName = station ? station.name : upperCaseStationCode; // Fallback to code if not found

  // --- Temporarily commented out data fetching and error handling ---
  // let initialJourneys: Journey[] = [];
  // let journeysWithComposition: (Journey & { composition: { length: number; parts: TrainUnit[] } | null })[] = [];
  // let error: string | null = null;
  // try {
  //   initialJourneys = await getDepartures(upperCaseStationCode);
  //   if (initialJourneys.length > 0) {
  //     const compositionPromises = initialJourneys.map(journey =>
  //       getTrainComposition(journey.product.number).catch(e => {
  //         console.error(`Failed to fetch composition for train ${journey.product.number}:`, e);
  //         return null;
  //       })
  //     );
  //     const compositions = await Promise.all(compositionPromises);
  //     journeysWithComposition = initialJourneys.map((journey, index) => ({
  //       ...journey,
  //       composition: compositions[index],
  //     }));
  //   }
  // } catch (err) {
  //   console.error(`Failed to fetch departures for ${upperCaseStationCode}:`, err);
  //   if (err instanceof Error) {
  //     error = err.message;
  //   } else {
  //     error = `An unknown error occurred while fetching departure data for ${upperCaseStationCode}.`;
  //   }
  //   if (error?.includes("NS API Key is missing")) {
  //       error = "Error: NS API Key is missing. Please ensure NSR_API_KEY is set in your .env.local file.";
  //   }
  // }
  // --- End temporary comment out ---

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 font-[family-name:var(--font-geist-sans)]">
      <main className="max-w-4xl mx-auto p-4 sm:p-8">
        <h1 className="text-3xl font-bold mb-6 text-center text-blue-900 dark:text-blue-300">
          {stationName} (Simplified Page)
        </h1>

        {/* --- Temporarily commented out rendering --- */}
        {/* {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative text-center dark:bg-red-900/30 dark:border-red-700/50 dark:text-red-400" role="alert">
            <strong className="font-bold">Error:</strong>
            <span className="block sm:inline ml-2">{error}</span>
          </div>
        )} */}
        {/* {!error && (
          <StationJourneyDisplay
            // initialJourneys={journeysWithComposition} // Temporarily commented out
            stationCode={upperCaseStationCode}
            stationName={stationName}
          />
        )} */}
        {/* --- End temporary comment out --- */}
        <p>This is a simplified version of the station page for build testing.</p>
      </main>
    </div>
  );
}