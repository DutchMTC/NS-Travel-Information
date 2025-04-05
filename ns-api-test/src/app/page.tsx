"use client"; // Need client component for state and effects

// Force dynamic rendering for the page to ensure searchParams are always fresh
export const dynamic = 'force-dynamic';

import { useState, useEffect, Suspense, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import StationSearch from "@/components/StationSearch";
import { StationJourneyDisplay } from '@/components/StationJourneyDisplay';
import { stations } from '@/lib/stations';

// Wrap the component logic to use Suspense for searchParams
function HomePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isPlainMode = searchParams.get('plain') === 'true';
  const [selectedStationCode, setSelectedStationCode] = useState<string | null>(null);
  const [selectedStationName, setSelectedStationName] = useState<string | null>(null);
  const [nearestStations, setNearestStations] = useState<{ id: { code: string }; names: { long: string } }[]>([]);
  const [isLoadingLocation, setIsLoadingLocation] = useState<boolean>(false); // Renamed for clarity
  const [locationError, setLocationError] = useState<string | null>(null);
  // Removed permissionState

  // Effect to sync selected station state with URL search parameter
   useEffect(() => {
     const stationCodeFromUrl = searchParams.get('station');
     const station = stationCodeFromUrl ? stations.find(s => s.code.toUpperCase() === stationCodeFromUrl.toUpperCase()) : null;
     setSelectedStationCode(station ? station.code : null);
     setSelectedStationName(station ? station.name : null);
   }, [searchParams]);


  // Function to fetch stations *after* getting position
  const fetchNearestStations = useCallback(async (latitude: number, longitude: number) => {
    console.log("fetchNearestStations called");
    setIsLoadingLocation(true); // Keep loading true for API call
    setLocationError(null);
    setNearestStations([]);
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
    } catch (error: unknown) {
      console.error("Failed to fetch nearest stations:", error);
      if (error instanceof Error) {
        setLocationError(error.message);
      } else {
        setLocationError("An unknown error occurred while fetching nearest stations.");
      }
    } finally {
      setIsLoadingLocation(false); // Loading ends after API call attempt
    }
  }, []);

  // Function to handle getting location and fetching stations
  const getLocationAndFetch = useCallback(() => {
      if (!navigator.geolocation) {
          setLocationError("Geolocation is not supported by your browser.");
          setIsLoadingLocation(false); // Stop loading if not supported
          return;
      }
      console.log("Attempting to get location and fetch...");
      setIsLoadingLocation(true); // Show loading
      setLocationError(null);
      setNearestStations([]);

      navigator.geolocation.getCurrentPosition(
          (position) => {
              console.log("Position obtained, fetching stations...");
              fetchNearestStations(position.coords.latitude, position.coords.longitude);
          },
          (error) => {
              console.error("Error getting position:", error);
              setIsLoadingLocation(false); // Stop loading on error
              switch (error.code) {
                case error.PERMISSION_DENIED:
                  setLocationError("Location permission denied. Please grant access to see nearby stations.");
                  break;
                case error.POSITION_UNAVAILABLE:
                  setLocationError("Location information is unavailable.");
                  break;
                case error.TIMEOUT:
                  setLocationError("The request to get user location timed out.");
                  break;
                default:
                  setLocationError("An unknown error occurred while getting location.");
                  break;
              }
          },
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 }
      );
  }, [fetchNearestStations]); // Depends on fetchNearestStations


  // Effect to trigger location fetch on load if no station is selected
  useEffect(() => {
      if (!selectedStationCode) {
          console.log("No station selected, triggering location fetch on load.");
          getLocationAndFetch();
      } else {
          // If a station IS selected, clear location state
          setNearestStations([]);
          setIsLoadingLocation(false);
          setLocationError(null);
      }
  // Run when selectedStationCode changes (or on initial load if null)
  }, [selectedStationCode, getLocationAndFetch]);


  const handleStationSelect = (stationCode: string) => {
    router.push(`/?station=${stationCode}`, { scroll: false });
  };

  // --- Render Logic ---
  const renderNearbyStationsContent = () => {
    if (isLoadingLocation) {
        return <p className="text-center text-gray-500 dark:text-gray-400 italic">Fetching nearby stations...</p>;
    }
    if (locationError) {
        // Optionally, add a retry button here if desired
        return <p className="text-center text-red-600 dark:text-red-400">Error: {locationError}</p>;
    }
    if (nearestStations.length > 0) {
        return (
          <ul className="space-y-2 w-full"> {/* Ensure list takes width */}
            {nearestStations.map((station) => (
              <li key={station.id.code}>
                <Link
                  href={`/?station=${station.id.code}`}
                  className="block px-4 py-3 rounded-md text-lg font-semibold bg-gray-100 dark:bg-gray-700 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-gray-600 hover:text-blue-800 dark:hover:text-blue-200 transition-colors duration-150 ease-in-out shadow-sm"
                >
                  {station.names.long}
                </Link>
              </li>
            ))}
          </ul>
        );
    }
    // If not loading, no error, but no stations (could be due to API returning none, or initial state before fetch)
    // We might not want to show "No stations found" immediately before the fetch completes.
    // Let's only show it if there was no error and the fetch completed (isLoading is false).
    if (!isLoadingLocation && !locationError && nearestStations.length === 0) {
        return <p className="text-center text-gray-500 dark:text-gray-400 italic">No nearby stations found.</p>;
    }

    return null; // Should ideally not be reached if logic is correct
  };

  return (
    <div className="min-h-screen font-[family-name:var(--font-geist-sans)]">
      <main className="max-w-4xl mx-auto p-4 sm:p-8">

        <AnimatePresence mode="wait">
          {!selectedStationCode ? (
            // --- Placeholder View (No Station Selected) ---
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

              {/* --- Nearby Stations Section --- */}
              <div className="mt-6 text-sm">
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800 shadow-sm max-w-sm mx-auto text-left min-h-[150px] flex flex-col justify-center items-center">
                  <h3 className="font-semibold mb-3 text-lg text-gray-800 dark:text-gray-200 w-full text-center">Nearby Stations:</h3>
                  {renderNearbyStationsContent()}
                </div>
              </div>
              {/* --- End Nearby Stations Section --- */}

            </motion.div>
            // --- End Placeholder View ---

          ) : (
            // --- Station Selected View ---
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
            // --- End Station Selected View ---
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
