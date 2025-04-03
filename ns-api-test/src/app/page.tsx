"use client"; // Need client component for state and effects

import { useState, useEffect, Suspense } from 'react'; // Import useEffect and Suspense
import { useRouter, useSearchParams } from 'next/navigation'; // Import hooks for routing and search params
import { motion, AnimatePresence } from 'framer-motion';
import StationSearch from "@/components/StationSearch"; // Import the component
import { StationJourneyDisplay } from '@/components/StationJourneyDisplay'; // Use named import
import { stations } from '@/lib/stations'; // Import stations list

// Wrap the component logic to use Suspense for searchParams
function HomePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedStationCode, setSelectedStationCode] = useState<string | null>(null);
  const [selectedStationName, setSelectedStationName] = useState<string | null>(null);

  // Effect to sync state with URL search parameter
  useEffect(() => {
    const stationCodeFromUrl = searchParams.get('station');
    const station = stationCodeFromUrl ? stations.find(s => s.code.toUpperCase() === stationCodeFromUrl.toUpperCase()) : null;
    setSelectedStationCode(station ? station.code : null);
    setSelectedStationName(station ? station.name : null);
  }, [searchParams]); // Re-run when searchParams change

  const handleStationSelect = (stationCode: string) => {
    // Update URL, the useEffect hook will handle state update
    router.push(`/?station=${stationCode}`, { scroll: false }); // Use router.push to update URL, prevent scroll jump
  };

  return (
    <div className="min-h-screen font-[family-name:var(--font-geist-sans)]"> {/* Removed bg-gray-50 */}
      <main className="max-w-4xl mx-auto p-4 sm:p-8">

        <AnimatePresence mode="wait"> {/* Use mode="wait" for smoother transition */}
          {!selectedStationCode ? (
            <motion.div
              key="placeholder" // Need a key for AnimatePresence
              initial={{ opacity: 0, y: 10 }} // Start invisible and slightly down
              animate={{ opacity: 1, y: 0, transition: { duration: 0.5 } }} // Fade in and slide up
              exit={{ opacity: 0, transition: { duration: 0.3 } }} // Fade out
              className="text-center text-gray-600 dark:text-gray-400" // Removed mt-8
              // Wrap initial content (title, search, placeholder)
            >
              <motion.h1
                layout // Allow title to potentially move smoothly if layout changes
                className="text-3xl font-bold mb-8 text-center text-blue-900 dark:text-blue-300"
              >
                Departures and Arrivals
              </motion.h1>
              <motion.div layout className="mb-8 flex justify-center">
                 <StationSearch onStationSelect={handleStationSelect} />
              </motion.div>
              <p>Please search for a station to view departure or arrival times.</p> {/* Placeholder text */}
            </motion.div>
          ) : (
            <motion.div
              key={selectedStationCode} // Key changes when station changes
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: 0.5, delay: 0.2 } }} // Fade in after placeholder fades out
            >
              {/* Search bar remains visible, but now outside the animating block */}
              <motion.div layout className="mb-8 flex justify-center">
                 <StationSearch onStationSelect={handleStationSelect} />
              </motion.div>
              <StationJourneyDisplay
                stationCode={selectedStationCode}
                // Provide the required props
                stationName={selectedStationName || 'Station'} // Pass the found name or a fallback
                initialOffsetMinutes={0} // Pass a default offset
              />
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
    <Suspense fallback={<div>Loading...</div>}> {/* Add Suspense boundary */}
      <HomePageContent />
    </Suspense>
  );
}
