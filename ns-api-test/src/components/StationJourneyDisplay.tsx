"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { FaFilter } from 'react-icons/fa'; // Import Filter icon
import { Journey, TrainUnit, Disruption } from '../lib/ns-api';
import { stations as stationData } from '../lib/stations'; // Import station data
import { formatDateTimeForApi } from '../lib/utils';
import JourneyList from './DepartureList'; // Assuming JourneyListProps is defined inside or exported
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

// Removed unused FilterCounts interface definition

// Removed FilterStatus interface
export const StationJourneyDisplay: React.FC<StationJourneyDisplayProps> = ({
  stationCode,
  stationName,
  initialOffsetMinutes,
}) => {
  // Define station lookup maps (outside component rendering logic for performance)
  // Removed unused stationCodeToNameMap
  const stationNameToLongNameMap = useMemo(() => new Map(stationData.map(s => [s.name.toUpperCase(), s.name_long])), []);
  const stationShortNameToLongNameMap = useMemo(() => new Map(stationData.map(s => [s.name_short.toUpperCase(), s.name_long])), []);

  // Helper to find name_long, trying different name fields
  const getStationLongName = useCallback((name: string): string => {
      if (!name) return 'Unknown'; // Handle null/undefined input
      const upperName = name.toUpperCase();
      return stationNameToLongNameMap.get(upperName)
          || stationShortNameToLongNameMap.get(upperName)
          || name; // Fallback to original name if not found
  }, [stationNameToLongNameMap, stationShortNameToLongNameMap]); // Depends on the maps
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
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  // Lifted filter state
  const [selectedTrainTypes, setSelectedTrainTypes] = useState<string[]>(() => {
      // Initialize from URL search params
      const params = new URLSearchParams(searchParams.toString());
      return params.get('types')?.split(',').filter(Boolean) || []; // Added filter(Boolean)
  });
  const [selectedDestinations, setSelectedDestinations] = useState<string[]>(() => {
      // Initialize from URL search params
      const params = new URLSearchParams(searchParams.toString());
      return params.get('dest')?.split(',').filter(Boolean) || []; // Added filter(Boolean)
  });
  // Removed filterCounts state
  const [destinationSearchQuery, setDestinationSearchQuery] = useState<string>(''); // State for filter search
  const [isDestinationSearchFocused, setIsDestinationSearchFocused] = useState(false); // State for filter search focus

  // Refs
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const filterTriggerRef = useRef<HTMLButtonElement>(null); // Ref for filter button
  const fetchControllerRef = useRef<AbortController | null>(null); // Ref for fetch AbortController
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

  // Calculate unique train types and potential destinations based on the *unfiltered* journeys
  const uniqueTrainTypes = useMemo(() => {
    const types = new Set(journeys.map(j => j.product.shortCategoryName));
    return Array.from(types).sort();
  }, [journeys]);

  // Helper function to get the effective destination, now defined within StationJourneyDisplay
  const getEffectiveDestination = useCallback((journey: JourneyWithDetails): string | null => {
      const warningMessagePrefix = "Rijdt niet verder dan ";
      const warningMessage = journey.messages?.find(msg =>
          msg.message.startsWith(warningMessagePrefix)
      );
      if (warningMessage) {
          let extractedName = warningMessage.message.substring(warningMessagePrefix.length).replace(/\[|\]/g, '');
          const doorIndex = extractedName.indexOf(" door ");
          if (doorIndex !== -1) {
              extractedName = extractedName.substring(0, doorIndex).trim();
          }
          // Use the helper defined above to get the long name
          return getStationLongName(extractedName);
      }
      // Use direction for departures, finalDestination for arrivals
      // Access journeyType state directly here
      const baseDest = journeyType === 'departures' ? journey.direction : (journey.finalDestination || null); // Removed journey.composition?.destination
      // Apply getStationLongName for consistency
      return baseDest ? getStationLongName(baseDest) : null;
  }, [journeyType, getStationLongName]); // Add journeyType and getStationLongName to dependencies

  const potentialDestinations = useMemo(() => {
    const destinations = new Set<string>();
    journeys.forEach(journey => {
        const dest = getEffectiveDestination(journey);
        if (dest) {
            destinations.add(dest);
        }
    });
    return Array.from(destinations).sort();
  }, [journeys, getEffectiveDestination]); // Depends on journeys and the helper

  // Filter journeys based on selected types AND selected destinations
  // This logic now resides in the parent component
  const filteredJourneys = useMemo(() => {
    return journeys.filter(journey => {
      // Check train type filter
      const typeMatch = selectedTrainTypes.length === 0 || selectedTrainTypes.includes(journey.product.shortCategoryName);
      if (!typeMatch) return false;

      // Check destination filter (if any destinations are selected)
      if (selectedDestinations.length > 0) {
          const journeyDest = getEffectiveDestination(journey); // Use the helper

          // If journey has no destination or doesn't match any selected, exclude it
          if (!journeyDest || !selectedDestinations.includes(journeyDest)) {
              return false;
          }
      }

      // If passed both filters (or filters not active), include the journey
      return true;
    });
  }, [journeys, selectedTrainTypes, selectedDestinations, getEffectiveDestination]); // Correct dependencies

  // Callbacks
  const fetchAndSetJourneys = useCallback(async (type: JourneyType, dateTime?: string, isBackgroundRefresh = false) => {
    // Abort previous fetch if it exists
    if (fetchControllerRef.current && !isBackgroundRefresh) {
        console.log("Aborting previous fetch request..."); // DEBUG LOG
        fetchControllerRef.current.abort();
    }

    // Create a new AbortController for the current fetch, unless it's a background refresh
    let currentAbortController: AbortController | null = null;
    if (!isBackgroundRefresh) {
        currentAbortController = new AbortController();
        fetchControllerRef.current = currentAbortController;
    }

    // Only show full loading state for initial load or explicit user action
    if (!isBackgroundRefresh) {
        setIsLoading(true);
        setError(null); // Reset error only on foreground fetches
    }

    try {
      const apiUrl = `/api/journeys/${stationCode}?type=${type}${dateTime ? `&dateTime=${encodeURIComponent(dateTime)}` : ''}`;
      console.log(`Fetching: ${apiUrl}`); // DEBUG LOG
      const response = await fetch(apiUrl, {
          cache: 'no-store',
          signal: currentAbortController?.signal // Pass the signal to fetch
      });

      if (!response.ok) {
        // Don't throw error for aborted requests
        if (currentAbortController?.signal.aborted) {
            console.log("Fetch aborted gracefully."); // DEBUG LOG
            return; // Exit early if aborted
        }
        let errorMsg = `Error fetching ${type}: ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
          if (errorData.error) errorMsg = errorData.error;
        } catch { /* ignore parsing error body */ }
        throw new Error(errorMsg);
      }

      const data: ApiResponse = await response.json();

      // Check if the request was aborted *after* await response.json()
      // This can happen in rare cases if abort is called during JSON parsing
      if (currentAbortController?.signal.aborted) {
          console.log("Fetch aborted after response received but before state update."); // DEBUG LOG
          return; // Exit early
      }

      // --- Update state only on successful fetch ---
      console.log(`Fetch successful for ${type}. Updating state.`); // DEBUG LOG
      setJourneys(data.journeys);
      setAllDisruptions(data.disruptions);
      // Don't reset error here, it was reset at the start of foreground fetch
      // setError(null);

    } catch (err: any) {
        // Check if the error is due to the fetch being aborted
        if (err.name === 'AbortError') {
            console.log('Fetch request was aborted.'); // DEBUG LOG
            // Don't set error state for aborted requests
        } else {
            console.error(`Client-side fetch error for ${type} (${stationCode}):`, err);
            // Only set error and clear data on foreground fetch errors
            if (!isBackgroundRefresh) {
                setError(err instanceof Error ? err.message : `An unknown client-side error occurred.`);
                setJourneys([]); // Clear data on foreground error
                setAllDisruptions([]);
                setActiveDisruptions([]); // Also clear derived state
                setActiveMaintenances([]);
            }
            // For background refresh errors, just log, keep potentially stale data visible
        }
    } finally {
      // Stop loading indicator only for foreground fetches
      if (!isBackgroundRefresh) {
          setIsLoading(false);
          // Clear the controller ref if this fetch completed (wasn't aborted)
          if (fetchControllerRef.current === currentAbortController) {
              fetchControllerRef.current = null;
          }
      }
    }
  }, [stationCode]); // Dependencies: only stationCode. Other variables are captured.

  const handleTypeChange = (newType: JourneyType) => {
    setJourneyType(newType);
  };

  const handleOffsetChange = (minutes: number) => {
    const m = Math.max(0, minutes);
    setOffsetMinutes(m); // Update immediate state only
  };

  // Helper function to update URL without full page reload (using replace)
  const updateUrlParams = useCallback((newParams: Record<string, string | null>) => {
    const currentParams = new URLSearchParams(searchParams.toString());
    Object.entries(newParams).forEach(([key, value]) => {
        if (value && value.length > 0) {
            currentParams.set(key, value);
        } else {
            currentParams.delete(key);
        }
    });
    const hash = window.location.hash;
    // Use router.replace for filter changes to avoid polluting browser history
    router.replace(`${window.location.pathname}?${currentParams.toString()}${hash}`, { scroll: false });
  }, [searchParams, router]); // Added dependencies

  // Handlers for filter changes (to be passed to JourneyList)
  const handleTrainTypeChange = useCallback((type: string, checked: boolean) => {
    setSelectedTrainTypes(prev => {
        const newTypes = checked
            ? [...prev, type]
            : prev.filter(t => t !== type);
        // Update URL
        updateUrlParams({ types: newTypes.join(',') || null }); // Pass null if empty
        return newTypes;
    });
  }, [updateUrlParams]); // Use updateUrlParams

  const handleDestinationChange = useCallback((destination: string, add: boolean) => {
    setSelectedDestinations(prev => {
        const newDestinations = add
            ? [...prev, destination]
            : prev.filter(d => d !== destination);
        // Update URL
        updateUrlParams({ dest: newDestinations.join(',') || null }); // Pass null if empty
        return newDestinations;
    });
  }, [updateUrlParams]); // Use updateUrlParams

  // Effects
  // Debounce offset changes for URL update and data fetching trigger
  // Update URL for time offset changes (using router.push for history)
   useEffect(() => {
     const handler = setTimeout(() => {
       if (offsetMinutes !== debouncedOffsetMinutes) {
         setDebouncedOffsetMinutes(offsetMinutes);
         // Use router.push for offset changes
         const currentParams = new URLSearchParams(searchParams.toString());
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
   }, [offsetMinutes, debouncedOffsetMinutes, searchParams, router]); // Keep router.push for offset

  // Effect to read filters from URL on mount/navigation (handles back/forward)
  // Effect to synchronize filter and offset UI state with URL parameters
  useEffect(() => {
      const params = new URLSearchParams(searchParams.toString());

      // Update filter state only if it differs from URL
      const urlTypes = params.get('types')?.split(',').filter(Boolean) || [];
      const urlDests = params.get('dest')?.split(',').filter(Boolean) || [];

      setSelectedTrainTypes(current =>
          JSON.stringify(current) !== JSON.stringify(urlTypes) ? urlTypes : current
      );
      setSelectedDestinations(current =>
          JSON.stringify(current) !== JSON.stringify(urlDests) ? urlDests : current
      );

      // Update offset UI state (offsetMinutes) from URL
      const urlOffsetM = parseInt(params.get('offsetM') || '0', 10);
      const validUrlOffset = isNaN(urlOffsetM) ? 0 : Math.max(0, urlOffsetM); // Ensure non-negative integer

      setOffsetMinutes(current =>
          current !== validUrlOffset ? validUrlOffset : current
      );

      // Note: We do NOT set debouncedOffsetMinutes here. That is handled by its own debouncing effect.
      // This effect only syncs the immediate UI state (offsetMinutes) with the URL.

  }, [searchParams]); // Rerun if searchParams change

  // Fetch data when type or debounced offset changes
  useEffect(() => {
    // Calculate targetDateTime based on the current debouncedOffsetMinutes when the effect runs
    const currentTargetDateTime = debouncedOffsetMinutes === 0
        ? undefined
        : formatDateTimeForApi(new Date(Date.now() + debouncedOffsetMinutes * 60000));

    console.log(`Fetch effect running. Type: ${journeyType}, Debounced Offset: ${debouncedOffsetMinutes}, Target DateTime: ${currentTargetDateTime}`); // DEBUG LOG
    fetchAndSetJourneys(journeyType, currentTargetDateTime);

    // Update document title to a generic one for station pages
    document.title = `Departures and Arrivals | Spoorwijzer`;

    // Update display string (client-side only) based on the calculated dateTime for this fetch
    if (currentTargetDateTime) {
      try {
        setDisplayDateTimeString(new Date(currentTargetDateTime).toLocaleString());
      } catch (e) {
        console.error("Error creating locale date string:", e);
        setDisplayDateTimeString("Invalid Date");
      }
    } else {
      setDisplayDateTimeString(null);
    }
    // Depend on debouncedOffsetMinutes instead of targetDateTime
  }, [journeyType, debouncedOffsetMinutes, fetchAndSetJourneys, stationName]);

   // Effect for periodic background refresh
   useEffect(() => {
    const refreshInterval = 60000; // Refresh every 60 seconds

    const intervalId = setInterval(() => {
      console.log(`Background refreshing ${journeyType} for ${stationCode}...`);
      // Fetch data in the background without setting the main loading state
      fetchAndSetJourneys(journeyType, targetDateTime, true);
    }, refreshInterval);

    // Cleanup function to clear the interval when the component unmounts or dependencies change
    return () => clearInterval(intervalId);
  }, [journeyType, targetDateTime, fetchAndSetJourneys, stationCode]); // Re-create interval if these change

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
        <p className="text-center text-sm text-muted-foreground mb-4"> {/* Removed -mt-2 */}
          +{debouncedOffsetMinutes} min offset
        </p>
      )}

      {/* Controls (Stacked Vertically) */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="mt-6 mb-6 flex flex-col items-center gap-3" // Added mt-6, Stack vertically, add gap
      >
        {/* Journey Type Switch (Centered) */}
        <div className="flex justify-center">
            <JourneyTypeSwitch currentType={journeyType} onChange={handleTypeChange} />
        </div>

        {/* Filter & Time Offset Buttons (Row below switch) */}
        <div className="flex justify-center items-center gap-2 sm:gap-4">
            {/* Filter Button & Indicators */}
            <div className="flex items-center gap-1">
                {/* Filter Toggle Button */}
                <button
                    ref={filterTriggerRef}
                    onClick={() => setShowFilterPanel(!showFilterPanel)}
                    className="flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-900"
                    aria-expanded={showFilterPanel}
                    aria-controls="filter-options" // Make sure this ID matches the one in JourneyList
                >
                    <FaFilter className="mr-1.5 h-4 w-4" aria-hidden="true" />
                    Filter ({selectedTrainTypes.length > 0 || selectedDestinations.length > 0 ? `${selectedTrainTypes.length}T/${selectedDestinations.length}D` : 'None'}) {/* Use state lengths directly */}
                </button>
            </div>

            {/* Time Offset Button & Popover */}
            <div className="relative">
              <button
                ref={triggerRef}
                type="button"
                onClick={() => setIsOffsetPopoverOpen(!isOffsetPopoverOpen)}
                // Apply similar styling as Filter button
                className="flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-900"
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
                    // Use popoverRef here for click outside logic
                    ref={popoverRef}
                    className="absolute z-10 mt-2 w-48 rounded-md shadow-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 p-0 right-0 origin-top-right" // Match button background, adjust border
                  >
                    <TimeOffsetSettings
                      offsetMinutes={offsetMinutes}
                      onOffsetChange={handleOffsetChange}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
        </div>
      </motion.div>

      {/* Loading State */}
      {isLoading && (
        <p className="text-center text-gray-600 dark:text-gray-400 mt-4">Loading {journeyType}{displayDateTimeString ? ` for ${displayDateTimeString}` : ''}...</p>
      )}

      {/* Filter Panel (Moved Here) */}
      <AnimatePresence>
        {showFilterPanel && (
          <motion.div
            id="filter-options" // Keep ID for aria-controls
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="mb-4 p-4 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 shadow-sm"
          >
            {/* Train Type Filter */}
            <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-4">
                <h3 className="text-md font-semibold mb-3 text-gray-800 dark:text-gray-200">Filter by Train Type</h3>
                <div className="flex flex-col gap-y-2">
                {uniqueTrainTypes.map(type => (
                    <div key={type} className="flex items-center space-x-2">
                    <input
                        type="checkbox"
                        id={`filter-type-${type}`}
                        checked={selectedTrainTypes.includes(type)}
                        onChange={(e) => handleTrainTypeChange(type, e.target.checked)} // Use handler from this component
                        aria-label={`Filter by ${type}`}
                        className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:bg-gray-700 dark:focus:ring-blue-600 dark:ring-offset-gray-800 cursor-pointer"
                    />
                    <label htmlFor={`filter-type-${type}`} className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer select-none">
                        {type}
                    </label>
                    </div>
                ))}
                </div>
            </div>
            {/* Destination Filter */}
            <div className="relative">
               <h3 className="text-md font-semibold mb-3 text-gray-800 dark:text-gray-200">Filter by Final Destination</h3>
               <input
                   type="text"
                   placeholder="Search destinations..."
                   value={destinationSearchQuery}
                   onChange={(e) => setDestinationSearchQuery(e.target.value)}
                   onFocus={() => setIsDestinationSearchFocused(true)}
                   onBlur={() => { setTimeout(() => setIsDestinationSearchFocused(false), 150); }}
                   className="block w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                   disabled={potentialDestinations.length === 0}
               />
               {(isDestinationSearchFocused || destinationSearchQuery) && potentialDestinations.length > 0 && (
                   <ul className="absolute z-10 w-full mt-1 max-h-48 overflow-y-auto bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg py-1">
                       {(() => {
                           const matchingDestinations = potentialDestinations
                               .filter(dest => dest.toLowerCase().includes(destinationSearchQuery.toLowerCase()))
                               .filter(dest => !selectedDestinations.includes(dest));

                           if (matchingDestinations.length === 0) {
                               return <li className="px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 italic">No matching destinations found.</li>;
                           }

                           return matchingDestinations.map(dest => (
                               <li
                                   key={dest}
                                   onClick={() => {
                                       handleDestinationChange(dest, true); // Use handler from this component
                                       setDestinationSearchQuery('');
                                   }}
                                   className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer"
                               >
                                   {dest}
                               </li>
                           ));
                       })()}
                   </ul>
               )}
               {/* Selected Destination Tags */}
               <div className="mt-3 flex flex-wrap gap-2 min-h-[2rem]">
                   {selectedDestinations.map(dest => (
                       <span key={dest} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 shadow-sm">
                           {dest}
                           <button
                               type="button"
                               onClick={() => handleDestinationChange(dest, false)} // Use handler from this component
                               className="ml-1.5 flex-shrink-0 inline-flex items-center justify-center h-4 w-4 rounded-full text-green-500 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-800 hover:text-green-600 dark:hover:text-green-100 focus:outline-none focus:bg-green-500 focus:text-white transition-colors"
                               aria-label={`Remove ${dest} filter`}
                           >
                               <svg className="h-2 w-2" stroke="currentColor" fill="none" viewBox="0 0 8 8">
                                   <path strokeLinecap="round" strokeWidth="1.5" d="M1 1l6 6m0-6L1 7" />
                               </svg>
                           </button>
                       </span>
                   ))}
                   {selectedDestinations.length === 0 && !destinationSearchQuery && (
                       <>
                           {potentialDestinations.length === 0 ? (
                               <p className="text-xs text-gray-500 dark:text-gray-400 italic">No destinations found.</p>
                           ) : (
                               <p className="text-xs text-gray-500 dark:text-gray-400 italic">Search or select a destination.</p>
                           )}
                       </>
                   )}
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
        <JourneyList
            journeys={filteredJourneys} // Pass the FILTERED journeys array
            listType={journeyType}
            currentStationUic={currentStationUic}
            // showFilterPanel prop removed
            // Pass down filter state and handlers (still needed by JourneyList for display/logic)
            selectedTrainTypes={selectedTrainTypes}
            selectedDestinations={selectedDestinations}
            // onTrainTypeChange={handleTrainTypeChange} // Removed, handled in parent
            // onDestinationChange={handleDestinationChange} // Removed, handled in parent
        />
      )}

    </motion.div>
  );
};