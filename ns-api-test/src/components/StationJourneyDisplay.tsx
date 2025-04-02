"use client";

import React, { useState, useEffect, useCallback } from 'react';
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
  const [disruptions, setDisruptions] = useState<Disruption[]>([]); // State for disruptions

  // Fetch data from the internal API route
  const fetchAndSetJourneys = useCallback(async (type: JourneyType) => {
    setIsLoading(true);
    setError(null);
    setJourneys([]); // Clear previous journeys
    setDisruptions([]); // Clear previous disruptions

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
      setJourneys(data.journeys);
      setDisruptions(data.disruptions); // Set disruptions state

    } catch (err) {
      console.error(`Client-side fetch error for ${type} (${stationCode}):`, err);
      if (err instanceof Error) {
        // Use the error message thrown from the try block or fetch itself
        setError(err.message);
      } else {
        setError(`An unknown client-side error occurred while fetching ${type} data.`);
      }
      setJourneys([]); // Clear journeys on error
      setDisruptions([]); // Clear disruptions on error
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

  const handleTypeChange = (newType: JourneyType) => {
    setJourneyType(newType);
  };

  return (
    <div>
      {/* Journey Type Switch */}
      <div className="mb-4 flex justify-center">
        <JourneyTypeSwitch currentType={journeyType} onChange={handleTypeChange} />
      </div>

      {/* Loading State */}
      {isLoading && (
        <p className="text-center text-gray-600 dark:text-gray-400 mt-4">Loading {journeyType}...</p>
      )}

     {/* Disruptions Section */}
     {!isLoading && !error && disruptions.length > 0 && (
       <div className="my-4 p-4 bg-red-100 border border-red-300 text-red-800 rounded-md dark:bg-red-900/30 dark:border-red-700/50 dark:text-red-300">
         <h3 className="font-bold text-lg mb-2 flex items-center">
           <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-red-600 dark:text-red-400" viewBox="0 0 20 20" fill="currentColor">
             <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 3.001-1.742 3.001H4.42c-1.53 0-2.493-1.667-1.743-3.001l5.58-9.92zM10 13a1 1 0 110-2 1 1 0 010 2zm-1.75-5.75a.75.75 0 00-1.5 0v3a.75.75 0 001.5 0v-3z" clipRule="evenodd" />
           </svg>
           Active Disruptions
         </h3>
         <ul>
           {disruptions.map((disruption) => (
             <li key={disruption.id} className="mb-1">
               <strong className="font-semibold">{disruption.title}:</strong> {disruption.topic}
             </li>
           ))}
         </ul>
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
    </div>
  );
};