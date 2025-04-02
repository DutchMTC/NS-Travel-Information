"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Journey, TrainUnit } from '../lib/ns-api'; // Remove API function imports
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
  initialJourneys: JourneyWithDetails[]; // Use updated type for initial props
  stationCode: string;
  stationName: string; // Pass station name for messages
}

export const StationJourneyDisplay: React.FC<StationJourneyDisplayProps> = ({
  initialJourneys,
  stationCode,
  stationName,
}) => {
  const [journeyType, setJourneyType] = useState<JourneyType>('departures');
  const [journeys, setJourneys] = useState<JourneyWithDetails[]>(initialJourneys); // Use updated type for state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch data from the internal API route
  const fetchAndSetJourneys = useCallback(async (type: JourneyType) => {
    setIsLoading(true);
    setError(null);
    setJourneys([]); // Clear previous journeys

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
        } catch (e) {
          // Ignore if parsing error body fails
        }
        throw new Error(errorMsg);
      }

      const data: JourneyWithDetails[] = await response.json(); // Expect updated type from API
      setJourneys(data);

    } catch (err) {
      console.error(`Client-side fetch error for ${type} (${stationCode}):`, err);
      if (err instanceof Error) {
        // Use the error message thrown from the try block or fetch itself
        setError(err.message);
      } else {
        setError(`An unknown client-side error occurred while fetching ${type} data.`);
      }
      setJourneys([]); // Clear journeys on error
    } finally {
      setIsLoading(false);
    }
  }, [stationCode]); // Dependency on stationCode

  // Effect to fetch data when journeyType changes
  useEffect(() => {
    // Fetch data whenever journeyType changes
    // The initial state is set via props, so this effect
    // will run for the first switch *away* from departures,
    // and then for every subsequent switch.
    fetchAndSetJourneys(journeyType);
     // Update document title (optional)
     document.title = `${journeyType.charAt(0).toUpperCase() + journeyType.slice(1)} - ${stationName}`;

  }, [journeyType, fetchAndSetJourneys, stationName]);

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