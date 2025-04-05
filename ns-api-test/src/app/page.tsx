"use client"; // Need client component for state and effects

// Force dynamic rendering for the page to ensure searchParams are always fresh
export const dynamic = 'force-dynamic';

import { useState, useEffect, Suspense, useCallback } from 'react'; // Added useCallback
import Link from 'next/link'; // Import Link
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import StationSearch from "@/components/StationSearch";
import { StationJourneyDisplay } from '@/components/StationJourneyDisplay';
import { stations } from '@/lib/stations';

// Wrap the component logic to use Suspense for searchParams
function HomePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Check for plain mode from searchParams (needed for conditional search bar)
  const isPlainMode = searchParams.get('plain') === 'true';
  const [selectedStationCode, setSelectedStationCode] = useState<string | null>(null);
  const [selectedStationName, setSelectedStationName] = useState<string | null>(null);
  const [nearestStations, setNearestStations] = useState<{ id: { code: string }; names: { long: string } }[]>([]); // Update state type for nested structure
  const [locationLoading, setLocationLoading] = useState<boolean>(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationPermissionDenied, setLocationPermissionDenied] = useState<boolean>(false); // State for permission denial

  // Effect to sync state with URL search parameter
  useEffect(() => {
    const stationCodeFromUrl = searchParams.get('station');
    const station = stationCodeFromUrl ? stations.find(s => s.code.toUpperCase() === stationCodeFromUrl.toUpperCase()) : null;
    setSelectedStationCode(station ? station.code : null);
    setSelectedStationName(station ? station.name : null);
  }, [searchParams]);

  // Function to request location and fetch stations
  const requestLocationAndStations = useCallback(async () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser.");
      setLocationPermissionDenied(false);
      return;
    }

    setLocationLoading(true);
    setLocationError(null);
    setLocationPermissionDenied(false); // Reset denial state on new request

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const response = await fetch(`/api/nearest-stations?lat=${latitude}&lng=${longitude}`);
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `API request failed with status ${response.status}`);
          }
          const data = await response.json();
          console.log('Frontend - Data received:', data);
          if (data.stations && data.stations.length > 0) {
            setNearestStations(data.stations);
          } else {
            setLocationError("No nearby stations found.");
          }
        } catch (error: unknown) { // Use unknown for better type safety
          console.error("Failed to fetch nearest stations:", error);
          // Type check before accessing properties
          if (error instanceof Error) {
            setLocationError(error.message);
          } else {
            setLocationError("An unknown error occurred while fetching nearest stations.");
          }
        } finally {
          setLocationLoading(false);
        }
      },
      (error) => {
        // Handle errors
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setLocationError("Location permission denied. Please enable it in your browser settings to see nearby stations.");
            setLocationPermissionDenied(true); // Set specific state
            break;
          case error.POSITION_UNAVAILABLE:
            setLocationError("Location information is unavailable.");
            setLocationPermissionDenied(false);
            break;
          case error.TIMEOUT:
            setLocationError("The request to get user location timed out.");
            setLocationPermissionDenied(false);
            break;
          default:
            setLocationError("An unknown error occurred while getting location.");
            setLocationPermissionDenied(false);
            break;
        }
        setLocationLoading(false);
      }
    );
  }, []); // Empty dependency array as it doesn't depend on component state/props directly

  // Effect for geolocation and fetching nearest stations
  useEffect(() => {
    // Only run if no station is selected via URL/search
    if (!selectedStationCode) {
      requestLocationAndStations(); // Call the location request function
    } else {
      // If a station IS selected, clear any location-based suggestions/errors
      setNearestStations([]);
      setLocationLoading(false);
      setLocationError(null);
      setLocationPermissionDenied(false); // Also reset permission denial state
    }
    // Run when selectedStationCode changes or on initial mount if code is null
  }, [selectedStationCode, requestLocationAndStations]);

  const handleStationSelect = (stationCode: string) => {
    // Update URL, the useEffect hook will handle state update
    router.push(`/?station=${stationCode}`, { scroll: false }); // Use router.push to update URL, prevent scroll jump
  };

  return (
    <div className="min-h-screen font-[family-name:var(--font-geist-sans)]">
      <main className="max-w-4xl mx-auto p-4 sm:p-8">

        <AnimatePresence mode="wait">
          {!selectedStationCode ? (
            <motion.div
              key="placeholder"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.5 } }}
              exit={{ opacity: 0, transition: { duration: 0.3 } }}
              className="text-center text-gray-600 dark:text-gray-400"
            >
              <motion.h1
                layout
                className="text-3xl font-bold mb-8 text-center text-blue-900 dark:text-blue-300"
              >
                Departures and Arrivals
              </motion.h1>
              {!isPlainMode && (
                <motion.div layout className="mb-8 flex justify-center">
                  <StationSearch onStationSelect={handleStationSelect} />
                </motion.div>
              )}
              <p className="mb-4">Please search for a station to view departure or arrival times.</p>

              {/* Display Geolocation Suggestions/Status */}
              <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                {locationLoading && <p>Loading nearby stations...</p>}

                {/* Handle Location Error and Permission Denied */}
                {locationError && (
                  <div className="text-red-600 dark:text-red-400 max-w-sm mx-auto text-center"> {/* Centered error */}
                    <p className="font-medium">Error:</p>
                    <p>{locationError}</p>
                    {locationPermissionDenied && (
                      <button
                        onClick={requestLocationAndStations} // Use the memoized function
                        className="mt-3 px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-md shadow-sm hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                      >
                        Retry Location Request
                      </button>
                    )}
                  </div>
                )}

                {/* Display Nearby Stations List */}
                {!locationLoading && !locationError && nearestStations.length > 0 && (
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800 shadow-sm max-w-sm mx-auto text-left"> {/* Ensure text-left */}
                    <h3 className="font-semibold mb-3 text-lg text-gray-800 dark:text-gray-200">Nearby Stations:</h3>
                    <ul className="space-y-2">
                      {nearestStations.map((station) => (
                        <li key={station.id.code}>
                          <Link
                            href={`/?station=${station.id.code}`}
                            className="block px-4 py-3 rounded-md text-lg font-semibold bg-gray-100 dark:bg-gray-700 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-gray-600 hover:text-blue-800 dark:hover:text-blue-200 transition-colors duration-150 ease-in-out shadow-sm" // Updated styles: text-lg, font-semibold, bg, padding, hover
                          >
                            {station.names.long}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key={selectedStationCode}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: 0.5, delay: 0.2 } }}
            >
              {!isPlainMode && (
                <motion.div layout className="mb-8 flex justify-center">
                  <StationSearch onStationSelect={handleStationSelect} />
                </motion.div>
              )}
              {selectedStationCode && (
                <StationJourneyDisplay
                  stationCode={selectedStationCode}
                  stationName={selectedStationName || 'Station'}
                  initialOffsetMinutes={0}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

// Export a default component that wraps HomePageContent in Suspense
export default function Home() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center min-h-screen">Loading...</div>}>
      <HomePageContent />
    </Suspense>
  );
}
