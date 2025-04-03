"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Journey, TrainUnit, Disruption } from '../lib/ns-api';
import { stations as stationData } from '../lib/stations'; // Import station data
import { formatDateTimeForApi } from '../lib/utils';
import JourneyList from './DepartureList';
import { JourneyTypeSwitch } from './JourneyTypeSwitch';
import TimeOffsetSettings from './TimeOffsetSettings';
import { AnimatedStationHeading } from './AnimatedStationHeading';

// Simple Clock Icon SVG
const ClockIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" {...props}>
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.414-1.414L11 10.586V6z" clipRule="evenodd" />
  </svg>
);

// Simple Warning Icon SVG (Triangle with Exclamation)
const WarningIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" {...props}>
        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 3.001-1.742 3.001H4.42c-1.53 0-2.493-1.667-1.743-3.001l5.58-9.92zM10 13a1 1 0 110-2 1 1 0 010 2zm-1.75-5.75a.75.75 0 00-1.5 0v3a.75.75 0 001.5 0v-3z" clipRule="evenodd" />
    </svg>
);

type JourneyType = 'departures' | 'arrivals';

interface JourneyWithDetails extends Journey {
  composition: { length: number; parts: TrainUnit[] } | null;
  finalDestination?: string | null;
}

interface StationJourneyDisplayProps {
  stationCode: string;
  stationName: string;
  initialOffsetMinutes: number;
}

interface ApiResponse {
  journeys: JourneyWithDetails[];
  disruptions: Disruption[];
}

export const StationJourneyDisplay: React.FC<StationJourneyDisplayProps> = ({
  stationCode,
  stationName,
  initialOffsetMinutes,
}) => {
  const router = useRouter();
  const searchParams = useSearchParams();

  // State
  const [journeyType, setJourneyType] = useState<JourneyType>('departures');
  const [offsetMinutes, setOffsetMinutes] = useState<number>(initialOffsetMinutes); // Immediate value from input
  const [debouncedOffsetMinutes, setDebouncedOffsetMinutes] = useState<number>(initialOffsetMinutes); // Value used for fetching/URL
  const [journeys, setJourneys] = useState<JourneyWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allDisruptions, setAllDisruptions] = useState<Disruption[]>([]);
  const [activeDisruptions, setActiveDisruptions] = useState<Disruption[]>([]);
  const [activeMaintenances, setActiveMaintenances] = useState<Disruption[]>([]);
  const [showMaintenances, setShowMaintenances] = useState(false);
  const [isOffsetPopoverOpen, setIsOffsetPopoverOpen] = useState(false);
  const [displayDateTimeString, setDisplayDateTimeString] = useState<string | null>(null);

  // Refs
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Memos
  const targetDateTime = useMemo(() => {
    if (debouncedOffsetMinutes === 0) {
      return undefined;
    }
    const now = new Date();
    now.setMinutes(now.getMinutes() + debouncedOffsetMinutes);
    return formatDateTimeForApi(now);
  }, [debouncedOffsetMinutes]);

  const currentStationUic = useMemo(() => {
    // Find the station object matching the stationCode (case-insensitive)
    const station = stationData.find(s => s.code.toUpperCase() === stationCode.toUpperCase());
    // Return the UIC code or the original stationCode as a fallback (though ideally it should always be found)
    return station ? station.uic : stationCode;
  }, [stationCode]);

  // Callbacks
  const fetchAndSetJourneys = useCallback(async (type: JourneyType, dateTime?: string) => {
    setIsLoading(true);
    setError(null);
    setJourneys([]);
    setAllDisruptions([]);
    setActiveDisruptions([]);
    setActiveMaintenances([]);

    try {
      const apiUrl = `/api/journeys/${stationCode}?type=${type}${dateTime ? `&dateTime=${encodeURIComponent(dateTime)}` : ''}`;
      const response = await fetch(apiUrl);
      if (!response.ok) {
        let errorMsg = `Error fetching ${type}: ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
          if (errorData.error) errorMsg = errorData.error;
        } catch { /* ignore */ }
        throw new Error(errorMsg);
      }
      const data: ApiResponse = await response.json();
      setJourneys(data.journeys);
      setAllDisruptions(data.disruptions);
    } catch (err) {
      console.error(`Client-side fetch error for ${type} (${stationCode}):`, err);
      setError(err instanceof Error ? err.message : `An unknown client-side error occurred.`);
      setJourneys([]);
      setAllDisruptions([]);
    } finally {
      setIsLoading(false);
    }
  }, [stationCode]);

  const handleTypeChange = (newType: JourneyType) => {
    setJourneyType(newType);
  };

  const handleOffsetChange = (minutes: number) => {
    const m = Math.max(0, minutes);
    setOffsetMinutes(m); // Update immediate state only
  };

  // Effects
  // Debounce offset changes for URL update and data fetching trigger
  useEffect(() => {
    const handler = setTimeout(() => {
      if (offsetMinutes !== debouncedOffsetMinutes) {
        setDebouncedOffsetMinutes(offsetMinutes);

        // Update URL
        const currentParams = new URLSearchParams(searchParams.toString());
        currentParams.delete('offsetD'); // Clean up old params just in case
        currentParams.delete('offsetH');
        if (offsetMinutes > 0) {
          currentParams.set('offsetM', offsetMinutes.toString());
        } else {
          currentParams.delete('offsetM');
        }
        const hash = window.location.hash;
        router.push(`${window.location.pathname}?${currentParams.toString()}${hash}`, { scroll: false });
      }
    }, 500); // 500ms delay

    return () => {
      clearTimeout(handler);
    };
  }, [offsetMinutes, debouncedOffsetMinutes, searchParams, router]);

  // Fetch data when type or debounced offset changes
  useEffect(() => {
    fetchAndSetJourneys(journeyType, targetDateTime);
    document.title = `${journeyType.charAt(0).toUpperCase() + journeyType.slice(1)} - ${stationName}`;

    // Update display string (client-side only)
    if (targetDateTime) {
      try {
        setDisplayDateTimeString(new Date(targetDateTime).toLocaleString());
      } catch (e) {
        console.error("Error creating locale date string:", e);
        setDisplayDateTimeString("Invalid Date");
      }
    } else {
      setDisplayDateTimeString(null);
    }
  }, [journeyType, targetDateTime, fetchAndSetJourneys, stationName]); // targetDateTime depends on debouncedOffsetMinutes

  // Process disruptions
  useEffect(() => {
    const active = allDisruptions.filter(d => d.isActive);
    setActiveDisruptions(active.filter(d => d.type === 'DISRUPTION' || d.type === 'CALAMITY'));
    setActiveMaintenances(active.filter(d => d.type === 'MAINTENANCE'));
  }, [allDisruptions]);

  // Handle clicks outside popover
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        popoverRef.current && !popoverRef.current.contains(event.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOffsetPopoverOpen(false);
      }
    }
    if (isOffsetPopoverOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOffsetPopoverOpen]);

  // Render JSX
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      {/* Heading */}
      <AnimatedStationHeading stationName={stationName} />
      {debouncedOffsetMinutes > 0 && (
        <p className="text-center text-sm text-muted-foreground -mt-2 mb-4">
          +{debouncedOffsetMinutes} min offset
        </p>
      )}

      {/* Controls */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="mb-6 flex justify-center items-center gap-4"
      >
        <JourneyTypeSwitch currentType={journeyType} onChange={handleTypeChange} />
        <div className="relative" ref={popoverRef}>
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setIsOffsetPopoverOpen(!isOffsetPopoverOpen)}
            className="p-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-md inline-flex items-center justify-center"
            aria-label="Set time offset"
            aria-expanded={isOffsetPopoverOpen}
          >
            <ClockIcon className="h-5 w-5" />
          </button>
          <AnimatePresence>
            {isOffsetPopoverOpen && (
              <motion.div
                key="time-offset-popover"
                initial={{ opacity: 0, scale: 0.95, y: -5 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -5 }}
                transition={{ duration: 0.2 }}
                className="absolute z-10 mt-2 w-48 rounded-md shadow-lg bg-popover text-popover-foreground border p-0 right-0 origin-top-right"
              >
                <TimeOffsetSettings
                  offsetMinutes={offsetMinutes} // Pass immediate value to input
                  onOffsetChange={handleOffsetChange}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Loading State */}
      {isLoading && (
        <p className="text-center text-gray-600 dark:text-gray-400 mt-4">Loading {journeyType}{displayDateTimeString ? ` for ${displayDateTimeString}` : ''}...</p>
      )}

      {/* Disruptions Section */}
      {!isLoading && !error && activeDisruptions.length > 0 && (
        <div className="my-4 p-4 bg-red-100 border border-red-300 text-red-800 rounded-md dark:bg-red-900/30 dark:border-red-700/50 dark:text-red-300">
          <h3 className="font-bold text-lg mb-2 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-red-600 dark:text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 3.001-1.742 3.001H4.42c-1.53 0-2.493-1.667-1.743-3.001l5.58-9.92zM10 13a1 1 0 110-2 1 1 0 010 2zm-1.75-5.75a.75.75 0 00-1.5 0v3a.75.75 0 001.5 0v-3z" clipRule="evenodd" />
            </svg>
            Active Disruptions
          </h3>
          <ul className="space-y-2">
            {activeDisruptions.map((disruption) => {
              // Debug log removed
              return (
                // List item for each disruption
                <li key={disruption.id} className="text-sm space-y-1">
                  {/* Disruption Title */}
                  <p><strong className="font-semibold">{disruption.title}</strong></p>

                  {/* Situation Label (from timespans) - Apply consistent styling */}
                  {disruption.timespans?.[0]?.situation?.label && (
                    <p className="ml-2 flex items-center text-xs text-gray-700 dark:text-gray-400">
                      <WarningIcon className="h-3 w-3 mr-1 flex-shrink-0" /> {/* Use WarningIcon */}
                      {disruption.timespans[0].situation.label}
                    </p>
                  )}

                  {/* Additional Travel Time */}
                  {disruption.summaryAdditionalTravelTime?.label && (
                    <p className="ml-2 flex items-center text-xs text-gray-700 dark:text-gray-400">
                      <ClockIcon className="h-3 w-3 mr-1" /> {/* Use ClockIcon component */}
                      {disruption.summaryAdditionalTravelTime.label}
                    </p>
                  )}

                  {/* Timespan Period */}
                  {disruption.timespans?.[0]?.period && (
                     <p className="ml-2 flex items-center text-xs text-gray-700 dark:text-gray-400">
                       <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor"> {/* Calendar Icon */}
                         <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                       </svg>
                       {disruption.timespans[0].period}
                     </p>
                  )}

                  {/* Expected Duration */}
                  {disruption.expectedDuration?.description && (
                    <p className="ml-2 flex items-center text-xs text-gray-700 dark:text-gray-400">
                      <ClockIcon className="h-3 w-3 mr-1" /> {/* Use ClockIcon component */}
                      Duration: {disruption.expectedDuration.description}
                    </p>
                  )}
                </li> // Close the list item
              ); // Close the return statement
            })} {/* Close the map function callback */}
          </ul>
        </div>
      )}

      {/* Maintenance Toggle & Section */}
      {!isLoading && !error && activeMaintenances.length > 0 && (
        <div className="my-4 flex flex-col items-center">
          <button
            onClick={() => setShowMaintenances(!showMaintenances)}
            className="text-sm font-bold text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-500 focus:outline-none mb-2 flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path d="M15 18H5a1 1 0 01-1-1V16a1 1 0 011-1h10a1 1 0 011 1v1a1 1 0 01-1 1z" />
              <path d="M6.166 14L10 4.5l3.834 9.5H6.166z" />
              <path d="M7.076 12h5.848l-.73-1.824H7.806l-.73 1.824z" />
              <path d="M8.152 9h3.696l-.462-1.154H8.614l-.462 1.154z" />
            </svg>
            {showMaintenances ? 'Hide' : 'Show'} Maintenances ({activeMaintenances.length})
          </button>
          <AnimatePresence>
            {showMaintenances && (
              <motion.div
                key="maintenance-section"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="w-full overflow-hidden"
              >
                <div className="p-4 bg-orange-100 border border-orange-300 text-orange-800 rounded-md dark:bg-orange-900/30 dark:border-orange-700/50 dark:text-orange-300 mt-1">
                  <h3 className="font-bold text-lg mb-2 flex items-center">
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
          No upcoming {journeyType} found for {stationName}{displayDateTimeString ? ` around ${displayDateTimeString}` : ''}.
        </p>
      )}

      {/* Journey List */}
      {!isLoading && !error && journeys.length > 0 && (
        <JourneyList journeys={journeys} listType={journeyType} currentStationUic={currentStationUic} />
      )}
    </motion.div>
  );
};