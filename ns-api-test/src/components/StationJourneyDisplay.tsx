"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion'; // Import framer-motion
import { Journey, TrainUnit, Disruption } from '../lib/ns-api'; // Import Disruption type
import JourneyList from './DepartureList'; // Component file is still DepartureList.tsx
import { JourneyTypeSwitch } from './JourneyTypeSwitch';

type JourneyType = 'departures' | 'arrivals';

// Combined type from page component
// Combined type matching the internal API response from /api/journeys
interface JourneyWithDetails extends Journey {
  composition: { length: number; parts: TrainUnit[] } | null; // Composition without destination
  finalDestination?: string | null; // Destination fetched separately
}

interface StationJourneyDisplayProps {
  // initialJourneys is no longer passed; fetched client-side
  stationCode: string;
  stationName: string; // Pass station name for messages
}

// Type for the API response from our internal route
interface ApiResponse {
  journeys: JourneyWithDetails[];
  disruptions: Disruption[];
}
export const StationJourneyDisplay: React.FC<StationJourneyDisplayProps> = ({
  // initialJourneys removed from props
  stationCode,
  stationName,
}) => {
  const [journeyType, setJourneyType] = useState<JourneyType>('departures');
  const [journeys, setJourneys] = useState<JourneyWithDetails[]>([]); // Initialize as empty, fetched in useEffect
  const [isLoading, setIsLoading] = useState(true); // Start loading initially
  const [error, setError] = useState<string | null>(null);
  const [allDisruptions, setAllDisruptions] = useState<Disruption[]>([]); // Raw fetched data
  const [activeDisruptions, setActiveDisruptions] = useState<Disruption[]>([]); // Filtered: DISRUPTION/CALAMITY
  const [activeMaintenances, setActiveMaintenances] = useState<Disruption[]>([]); // Filtered: MAINTENANCE
  const [showMaintenances, setShowMaintenances] = useState(false); // Toggle for maintenance section

  // Fetch data from the internal API route
  const fetchAndSetJourneys = useCallback(async (type: JourneyType) => {
    setIsLoading(true);
    setError(null);
    setJourneys([]); // Clear previous journeys
    setAllDisruptions([]); // Clear previous raw data
    setActiveDisruptions([]); // Clear filtered disruptions
    setActiveMaintenances([]); // Clear filtered maintenances

    try {
      const response = await fetch(`/api/journeys/${stationCode}?type=${type}`);

      if (!response.ok) {
        let errorMsg = `Error fetching ${type}: ${response.status} ${response.statusText}`;
        try {
          // Try to get error message from API route response body
          const errorData = await response.json();
          if (errorData.error) {
            errorMsg = errorData.error;
          }
        } catch {
          // Ignore if parsing error body fails, no need for 'e' variable
        }
        throw new Error(errorMsg);
      }

      const data: ApiResponse = await response.json(); // Expect updated type from API
      console.log("Full API Response:", data); // Log the entire fetched data object
      setJourneys(data.journeys);
      setAllDisruptions(data.disruptions); // Set raw disruptions state

    } catch (err) {
      console.error(`Client-side fetch error for ${type} (${stationCode}):`, err);
      if (err instanceof Error) {
        // Use the error message thrown from the try block or fetch itself
        setError(err.message);
      } else {
        setError(`An unknown client-side error occurred while fetching ${type} data.`);
      }
      setJourneys([]); // Clear journeys on error
      setAllDisruptions([]); // Clear raw data on error
      setActiveDisruptions([]);
      setActiveMaintenances([]);
    } finally {
      setIsLoading(false);
    }
  }, [stationCode]); // Dependency on stationCode

  // Effect to fetch data on initial load and when journeyType changes
  useEffect(() => {
    fetchAndSetJourneys(journeyType);
     // Update document title (optional)
     document.title = `${journeyType.charAt(0).toUpperCase() + journeyType.slice(1)} - ${stationName}`;
  }, [journeyType, fetchAndSetJourneys, stationName]); // fetchAndSetJourneys is stable due to useCallback

  // Process disruptions when allDisruptions changes
  useEffect(() => {
    const active = allDisruptions.filter(d => d.isActive);
    setActiveDisruptions(active.filter(d => d.type === 'DISRUPTION' || d.type === 'CALAMITY'));
    setActiveMaintenances(active.filter(d => d.type === 'MAINTENANCE'));

    // Log for debugging (optional)
    if (active.length > 0) {
      console.log("Processed Active Disruptions:", active.filter(d => d.type === 'DISRUPTION' || d.type === 'CALAMITY'));
      console.log("Processed Active Maintenances:", active.filter(d => d.type === 'MAINTENANCE'));
    }
  }, [allDisruptions]);

  const handleTypeChange = (newType: JourneyType) => {
    setJourneyType(newType);
  };

  return (
    <motion.div // Add motion wrapper for the whole component content if desired, or just specific parts
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.2 }} // Add a slight delay after header
    >
      {/* Journey Type Switch */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }} // Stagger animation
        className="mb-4 flex justify-center"
      >
        <JourneyTypeSwitch currentType={journeyType} onChange={handleTypeChange} />
      </motion.div>

      {/* Loading State */}
      {isLoading && (
        <p className="text-center text-gray-600 dark:text-gray-400 mt-4">Loading {journeyType}...</p>
      )}

     {/* Disruptions Section */}
     {/* Active Disruptions Section (Red Box) */}
     {!isLoading && !error && activeDisruptions.length > 0 && (
       <div className="my-4 p-4 bg-red-100 border border-red-300 text-red-800 rounded-md dark:bg-red-900/30 dark:border-red-700/50 dark:text-red-300">
         <h3 className="font-bold text-lg mb-2 flex items-center">
           <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-red-600 dark:text-red-400" viewBox="0 0 20 20" fill="currentColor">
             <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 3.001-1.742 3.001H4.42c-1.53 0-2.493-1.667-1.743-3.001l5.58-9.92zM10 13a1 1 0 110-2 1 1 0 010 2zm-1.75-5.75a.75.75 0 00-1.5 0v3a.75.75 0 001.5 0v-3z" clipRule="evenodd" />
           </svg>
           Active Disruptions
         </h3>
         <ul className="space-y-2">
           {activeDisruptions.map((disruption) => (
             <li key={disruption.id} className="text-sm space-y-1">
               <p><strong className="font-semibold">{disruption.title}</strong></p>
               {disruption.situation?.label && <p className="ml-2">- {disruption.situation.label}</p>}
               {disruption.summaryAdditionalTravelTime?.label && (
                 <p className="ml-2 flex items-center text-xs text-gray-700 dark:text-gray-400">
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                     <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.414-1.414L11 10.586V6z" clipRule="evenodd" />
                   </svg>
                   {disruption.summaryAdditionalTravelTime.label}
                 </p>
               )}
               {disruption.timespans?.[0]?.period && (
                  <p className="ml-2 flex items-center text-xs text-gray-700 dark:text-gray-400">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                    </svg>
                    {disruption.timespans[0].period}
                  </p>
               )}
             </li>
           ))}
         </ul>
       </div>
     )}

     {/* Maintenance Toggle & Section */}
     {!isLoading && !error && activeMaintenances.length > 0 && (
       <div className="my-4 flex flex-col items-center"> {/* Centering container */}
         {/* Clickable Toggle */}
         <button
           onClick={() => setShowMaintenances(!showMaintenances)}
           className="text-sm font-bold text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-500 focus:outline-none mb-2 flex items-center" // Changed yellow to orange
         >
           {/* Traffic Cone Icon */}
           <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
             <path d="M15 18H5a1 1 0 01-1-1V16a1 1 0 011-1h10a1 1 0 011 1v1a1 1 0 01-1 1z" /> {/* Base */}
             <path d="M6.166 14L10 4.5l3.834 9.5H6.166z" /> {/* Cone */}
             <path d="M7.076 12h5.848l-.73-1.824H7.806l-.73 1.824z" /> {/* Stripe 1 */}
             <path d="M8.152 9h3.696l-.462-1.154H8.614l-.462 1.154z" /> {/* Stripe 2 */}
           </svg>
           {showMaintenances ? 'Hide' : 'Show'} Maintenances ({activeMaintenances.length})
         </button>

         {/* Animated Maintenance Section */}
         <AnimatePresence>
           {showMaintenances && (
             <motion.div
               key="maintenance-section" // Add key for AnimatePresence
               initial={{ opacity: 0, height: 0 }}
               animate={{ opacity: 1, height: 'auto' }}
               exit={{ opacity: 0, height: 0 }}
               transition={{ duration: 0.3 }}
               className="w-full max-w-2xl overflow-hidden" // Ensure container clips content during animation
             >
               <div className="p-4 bg-orange-100 border border-orange-300 text-orange-800 rounded-md dark:bg-orange-900/30 dark:border-orange-700/50 dark:text-orange-300 mt-1"> {/* Added mt-1 */}
                 <h3 className="font-bold text-lg mb-2 flex items-center">
                   {/* Using the info icon from disruptions box for consistency */}
               <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-orange-600 dark:text-orange-400" viewBox="0 0 20 20" fill="currentColor">
                 <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
               </svg>
               Active Maintenances
             </h3>
             <ul className="space-y-2">
               {activeMaintenances.map((maintenance) => (
                 <li key={maintenance.id} className="text-sm space-y-1">
                   <p><strong className="font-semibold">{maintenance.title}</strong></p>
                   {maintenance.situation?.label && <p className="ml-2">- {maintenance.situation.label}</p>}
                   {maintenance.summaryAdditionalTravelTime?.label && (
                     <p className="ml-2 flex items-center text-xs text-gray-700 dark:text-gray-400">
                       <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                         <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.414-1.414L11 10.586V6z" clipRule="evenodd" />
                       </svg>
                       {maintenance.summaryAdditionalTravelTime.label}
                     </p>
                   )}
                   {maintenance.timespans?.[0]?.period && (
                     <p className="ml-2 flex items-center text-xs text-gray-700 dark:text-gray-400">
                       <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                         <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                       </svg>
                       {maintenance.timespans[0].period}
                     </p>
                   )}
                 </li>
               ))}
             </ul>
           </div>
         </motion.div>
       )}
     </AnimatePresence>
   </div>
 )}

      {/* Error State */}
      {error && !isLoading && (
         <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative text-center dark:bg-red-900/30 dark:border-red-700/50 dark:text-red-400" role="alert">
           <strong className="font-bold">Error:</strong>
           <span className="block sm:inline ml-2">{error}</span>
         </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && journeys.length === 0 && (
        <p className="text-center text-gray-600 dark:text-gray-400 mt-4">
          No upcoming {journeyType} found for {stationName}.
        </p>
      )}

      {/* Journey List */}
      {!isLoading && !error && journeys.length > 0 && (
        <JourneyList journeys={journeys} listType={journeyType} />
      )}
    </motion.div>
  );
};