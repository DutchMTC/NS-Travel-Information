'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react'; // Added useRef
import Image from 'next/image';
import { FaStar, FaChevronDown, FaArrowDown, FaExclamationTriangle } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter, useSearchParams, usePathname } from 'next/navigation'; // Import hooks
import { formatTime, calculateDelay, formatDateTimeForApi } from '../lib/utils'; // Import formatDateTimeForApi
import { getSpecialLiveryName, getSpecialLiveryImageUrl } from '../lib/specialLiveries';
import { Journey, TrainUnit } from '../lib/ns-api'; // Import Journey type and TrainUnit for transfer data
import DepartureList from './DepartureList'; // Import DepartureList
import { stations } from '../lib/stations'; // Import station data for lookup
// --- Types ---
interface StationInfo { name: string; lng: number; lat: number; countryCode: string; uicCode: string; }
interface Product { number: string; categoryCode: string; shortCategoryName: string; longCategoryName: string; operatorCode: string; operatorName: string; type: string; }
interface ArrivalDeparture { product: Product; origin: StationInfo; destination: StationInfo; plannedTime: string; actualTime?: string; delayInSeconds?: number; plannedTrack?: string; actualTrack?: string; cancelled: boolean; punctuality?: number; crowdForecast?: string; stockIdentifiers?: string[]; }
interface TrainPart { stockIdentifier: string; destination?: StationInfo; facilities: string[]; image?: { uri: string }; }
interface StockInfo { trainType: string; numberOfSeats: number; numberOfParts: number; trainParts: TrainPart[]; hasSignificantChange: boolean; }
interface Stop { id: string; stop: StationInfo; previousStopId: string[]; nextStopId: string[]; destination?: string; status: string; arrivals: ArrivalDeparture[]; departures: ArrivalDeparture[]; actualStock?: StockInfo; plannedStock?: StockInfo; platformFeatures?: unknown[]; coachCrowdForecast?: unknown[]; }
interface Note {
  id?: string;
  text: string;
  type?: 'DISRUPTION' | 'INFO' | 'CALAMITY' | string;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | string;
  alternativeTransport?: boolean;
}

// Interface matching the structure returned by /api/journeys and expected by DepartureList
interface JourneyWithDetails extends Journey {
  // Composition parts might have individual destinations (eindbestemming)
  composition: { length: number; parts: TrainUnit[]; destination?: string } | null;
  finalDestination?: string | null; // Destination fetched separately
}

interface JourneyPayload {
    stops: Stop[];
    notes?: Note[];
    // Add other potential payload fields if needed
}
// --- End Types ---

// --- Helper Functions ---
const getCurrentTime = () => new Date();

const parseApiTime = (timeString?: string): Date | null => {
  if (!timeString) return null;
  try {
    return new Date(timeString);
  } catch (e) {
    console.error("Error parsing time:", timeString, e);
    return null;
  }
};
// --- End Helper Functions ---
// --- End Types ---

export default function TrainInfoSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Initialize state from URL param or empty
  const initialMNumFromUrl = searchParams.get('materieelnummer') || '';
  const [materieelnummer, setMaterieelnummer] = useState(initialMNumFromUrl);

  const [stops, setStops] = useState<Stop[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null); // For generic errors like "Train not found"
  const [isExpanded, setIsExpanded] = useState(true); // Journey details expanded by default
  const [isNotInService, setIsNotInService] = useState(false); // Track if train exists but isn't running
  const initialSearchDone = useRef(false); // Track initial search based on URL param

  // Function to perform the actual API fetch
  const performSearch = useCallback(async (mNum: string) => {
    if (!mNum) {
        setStops([]);
        setError(null);
        setNotes([]); // Clear notes on empty search
        setIsNotInService(false); // Clear not in service state
        return;
    }
    setIsLoading(true);
    setError(null); // Clear generic error
    setIsNotInService(false); // Reset not in service state
    setStops([]);
    setNotes([]); // Clear notes before new search
    setIsExpanded(true); // Expand journey details on new search

    try {
      const response = await fetch(`/api/train-info/${mNum}`);
      if (!response.ok) {
        // Handle errors, distinguishing "Not Found" vs "Not In Service"
        if (response.status === 404) {
            let errorData = { error: "Train not found" }; // Default 404 message
            try {
                errorData = await response.json();
            } catch { // Variable removed as it's unused
                 // Ignore if error response is not JSON
            }

            if (errorData.error === "This train is not currently in service.") {
                setIsNotInService(true); // Set specific state for this case
                setError(null); // Clear generic error
            } else {
                setError("Train not found"); // Treat other 404s as truly not found
                setIsNotInService(false);
            }
        } else {
            // Generic error for other statuses
            let errorMsg = `Error: ${response.status} ${response.statusText}`;
             try {
                 const errorData = await response.json();
                 errorMsg = errorData.error || errorMsg;
             } catch { /* Ignore - Variable removed as it's unused */ }
            setError(errorMsg);
            setIsNotInService(false);
        }
        setStops([]); // Ensure stops are cleared on error
        setNotes([]); // Ensure notes are cleared on error
        return;
      }
      // Successful fetch
      const payload: JourneyPayload = await response.json();
      const fetchedStops = payload.stops || [];
      const fetchedNotes = payload.notes || [];

      setStops(fetchedStops);
      setNotes(fetchedNotes);

      // Clear error and not in service state if fetch was successful (even with empty stops initially)
      setError(null);
      setIsNotInService(false);

      // Note: We no longer set an error if stops are empty here.
      // The journey card visibility handles this.

    } catch (err: unknown) {
      console.error('Error fetching train info:', err);
      const message = err instanceof Error ? err.message : 'An unknown error occurred while fetching train information.';
      setError(message); // Set generic error for network/other issues
      setIsNotInService(false); // Clear not in service state on network errors
      setStops([]);
      setNotes([]);
    } finally {
      setIsLoading(false);
    }
  }, []); // No dependencies needed here

  // Function to handle initiating search and updating URL
  const handleSearch = () => {
    const trimmedMNum = materieelnummer.trim();
    const current = new URLSearchParams(searchParams.toString());

    if (!trimmedMNum) {
      setError('Please enter a materieelnummer.');
      current.delete('materieelnummer'); // Remove param if search is empty
    } else {
      current.set('materieelnummer', trimmedMNum); // Set param if search is valid
    }
    // Update URL without causing full page reload
    router.push(`${pathname}?${current.toString()}`, { scroll: false });

    // Perform search only if there's a valid number
    if (trimmedMNum) {
        performSearch(trimmedMNum);
    } else {
        // Clear results if search input is empty
        setStops([]);
        setError(null);
        setNotes([]); // Clear notes on empty search
        setIsNotInService(false); // Clear not in service state
    }
  };

  // Handle input changes (only clear URL if input becomes empty)
  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = event.target.value;
      setMaterieelnummer(newValue);
      if (newValue.trim() === '') {
          const current = new URLSearchParams(searchParams.toString());
          current.delete('materieelnummer');
          router.push(`${pathname}?${current.toString()}`, { scroll: false });
          setStops([]);
          setError(null);
          setNotes([]); // Clear notes when input is cleared
          setIsNotInService(false); // Clear not in service state
      }
  };

  // Ref to hold the current state value without adding it to effect dependencies
  const materieelnummerRef = useRef(materieelnummer);
  useEffect(() => {
    materieelnummerRef.current = materieelnummer;
  }, [materieelnummer]); // Keep this effect minimal just to update the ref

  // Effect to sync FROM URL changes or perform initial load search
  useEffect(() => {
    const mNumFromUrl = searchParams.get('materieelnummer');

    if (mNumFromUrl) {
      // URL has a parameter
      // Only update state and search if the URL param is different from the current state
      // OR if this is the very first load (initialSearchDone is false)
      if (mNumFromUrl !== materieelnummerRef.current || !initialSearchDone.current) {
         // Check initialSearchDone flag *before* setting it true
         const isInitial = !initialSearchDone.current;
         setMaterieelnummer(mNumFromUrl); // Sync state FROM URL
         // Only mark initial search done if it was truly the initial one based on URL
         if (isInitial) {
            initialSearchDone.current = true;
         }
         performSearch(mNumFromUrl); // Perform search based on URL value
      }
    } else {
      // URL does NOT have the parameter
      // If the state currently has a value, clear it to sync FROM URL removal
      if (materieelnummerRef.current !== '') {
        setMaterieelnummer(''); // Clear state
        setStops([]);
        setError(null);
        setNotes([]);
        setIsNotInService(false);
        initialSearchDone.current = false; // Reset flag as param is gone
      }
    }
    // This effect should primarily react to the URL changing.
    // performSearch is stable due to useCallback.
    // Removed eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, performSearch]); // Removed materieelnummer from dependencies


  // Helper function to extract summary data for the header
  const getJourneySummary = () => {
    // Only return summary if stops exist (meaning a journey was found)
    if (!stops || stops.length === 0 || !materieelnummer) return null;

    // --- Find the specific stock info for the searched materieelnummer ---
    let targetStockInfo: StockInfo | undefined = undefined;
    let targetTrainPart: TrainPart | undefined = undefined;

    for (const stop of stops) {
        const currentStock = stop.actualStock || stop.plannedStock;
        if (currentStock?.trainParts) {
            const foundPart = currentStock.trainParts.find(part => part.stockIdentifier === materieelnummer);
            if (foundPart) {
                targetStockInfo = currentStock; // Use the stock info where the part was found
                targetTrainPart = foundPart;
                break; // Found the relevant stock info, stop searching
            }
        }
    }

    // If the specific train part wasn't found in the journey stops, return null for summary
    if (!targetTrainPart || !targetStockInfo) return null;

    // --- Extract details from the found stock/part ---
    const stockIdentifier = targetTrainPart.stockIdentifier; // Should match materieelnummer
    const trainType = targetStockInfo.trainType;
    const numberOfSeats = targetStockInfo.numberOfSeats;
    const facilities = targetTrainPart.facilities;
    const numberOfParts = targetStockInfo.numberOfParts; // This is the 'lengte'
    const genericImageUrl = targetTrainPart.image?.uri;
    const specialLiveryImageUrl = stockIdentifier ? getSpecialLiveryImageUrl(stockIdentifier) : undefined;
    const specialLiveryName = stockIdentifier ? getSpecialLiveryName(stockIdentifier) : null;
    const displayImageUrl = specialLiveryImageUrl || genericImageUrl;
    const displayImageAlt = specialLiveryName || trainType || 'Train image';

    // --- Extract overall journey details ---
    const originStop = stops.find(s => s.status === 'ORIGIN') || stops[0];
    const destinationStop = stops.find(s => s.status === 'DESTINATION') || stops[stops.length - 1];
    const departureEvent = originStop?.departures[0];
    const arrivalEvent = destinationStop?.arrivals[0];
    if (!departureEvent) return null; // Essential for journey details

    // Ritnummer and Vervoerder removed as they relate to the specific journey, not the train unit itself
    // const ritnummer = departureEvent.product.number;
    // const vervoerder = departureEvent.product.operatorName;

    const departureDelayMinutes = calculateDelay(departureEvent.plannedTime, departureEvent.actualTime ?? departureEvent.plannedTime);
    const departurePlannedTimeFormatted = formatTime(departureEvent.plannedTime);
    const departureActualTimeFormatted = departureEvent.actualTime ? formatTime(departureEvent.actualTime) : departurePlannedTimeFormatted;
    const isJourneyCancelled = departureEvent.cancelled;
    const arrivalDelayMinutes = arrivalEvent ? calculateDelay(arrivalEvent.plannedTime, arrivalEvent.actualTime ?? arrivalEvent.plannedTime) : 0;
    const arrivalPlannedTimeFormatted = arrivalEvent ? formatTime(arrivalEvent.plannedTime) : '--:--';
    const arrivalActualTimeFormatted = arrivalEvent?.actualTime ? formatTime(arrivalEvent.actualTime) : arrivalPlannedTimeFormatted;
    const originStationName = originStop?.stop.name ?? departureEvent.origin.name ?? 'Unknown Origin';
    const finalDestinationName = destinationStop?.stop.name ?? departureEvent.destination.name ?? 'Unknown Destination';

    return {
      departureEvent, arrivalEvent, originStationName, finalDestinationName, isJourneyCancelled,
      departureDelayMinutes, departurePlannedTimeFormatted, departureActualTimeFormatted,
      arrivalDelayMinutes, arrivalPlannedTimeFormatted, arrivalActualTimeFormatted,
      // Add specific stock info, facilities and journey details to summary
      trainType, numberOfParts, numberOfSeats, facilities, // Removed ritnummer, vervoerder
      displayImageUrl, displayImageAlt, specialLiveryName, stockIdentifier
    };
  };

  const summary = getJourneySummary(); // Will be null if no stops or specific train part not found

      {/* --- Current Journey Section Component Definition --- */}
      // Define the type for the summary prop based on the return type of getJourneySummary
      type JourneySummaryType = ReturnType<typeof getJourneySummary>;
      const CurrentJourneySection: React.FC<{ stops: Stop[]; summary: JourneySummaryType }> = ({ stops, summary }) => {
        const [transferData, setTransferData] = useState<Record<string, { loading: boolean; error: string | null; departures: JourneyWithDetails[] }>>({}); // State for transfer data
        const [upcomingTransfersVisible, setUpcomingTransfersVisible] = useState<Record<string, boolean>>({}); // State for upcoming stop transfer visibility

        const fetchTransfers = async (stationUic: string, arrivalTimeString?: string) => { // Add arrivalTimeString parameter
          if (!stationUic || transferData[stationUic]?.departures || transferData[stationUic]?.loading) {
            return; // Don't fetch if already loaded, loading, or no UIC
          }

          // --- Find the short station code from the UIC ---
          const station = stations.find(s => s.uic === stationUic);
          if (!station) {
              console.error(`[fetchTransfers] Could not find station code for UIC: ${stationUic}`);
              setTransferData(prev => ({ ...prev, [stationUic]: { loading: false, error: `Invalid station UIC: ${stationUic}`, departures: [] } }));
              return;
          }
          const stationCode = station.code; // Use the short code for the API call
          // --- End station code lookup ---

          setTransferData(prev => ({ ...prev, [stationUic]: { loading: true, error: null, departures: [] } }));

          // Modified try block to always log raw response text
          let rawResponseText = '';
          let responseOk = false;
          try {
            // --- Calculate target time for transfers ---
            let targetDateTimeString: string | undefined = undefined;
            if (arrivalTimeString) {
                const arrivalTime = parseApiTime(arrivalTimeString);
                if (arrivalTime) {
                    arrivalTime.setMinutes(arrivalTime.getMinutes() + 3); // Add 3 minutes
                    targetDateTimeString = formatDateTimeForApi(arrivalTime);
                } else {
                    console.warn(`[fetchTransfers] Could not parse arrival time: ${arrivalTimeString}`);
                }
            }
            // --- End target time calculation ---

            // Use the found stationCode and optional dateTime in the URL
            const apiUrl = `/api/journeys/${stationCode}?type=departures${targetDateTimeString ? `&dateTime=${encodeURIComponent(targetDateTimeString)}` : ''}`;
            console.log(`[Fetching Transfers URL] ${apiUrl}`); // Log the URL being fetched
            const response = await fetch(apiUrl);
            responseOk = response.ok; // Store status before reading body
            rawResponseText = await response.text(); // Read as text first

            // Log the raw response regardless of status
            console.log(`[Raw API Response for ${stationUic} - Status: ${response.status}]`);
            console.log(rawResponseText);

            if (!responseOk) {
              // Set error state based on the raw text if status is not OK
              setTransferData(prev => ({ ...prev, [stationUic]: { loading: false, error: `API Error ${response.status}: ${rawResponseText.substring(0, 100)}...`, departures: [] } }));
            } else {
              // If response was OK, try to parse JSON
              try {
                const data: { journeys: JourneyWithDetails[], disruptions: unknown[] } = JSON.parse(rawResponseText); // Expect JourneyWithDetails
                setTransferData(prev => ({ ...prev, [stationUic]: { loading: false, error: null, departures: data.journeys || [] } }));
              } catch (parseError) {
                console.error("Error parsing JSON response:", parseError);
                setTransferData(prev => ({ ...prev, [stationUic]: { loading: false, error: "Failed to parse API response.", departures: [] } }));
              }
            }
          } catch (fetchErr) {
            // Catch errors during the fetch itself (e.g., network error)
            console.error("Network or fetch error fetching transfers:", fetchErr);
            const message = fetchErr instanceof Error ? fetchErr.message : "Network error fetching transfers.";
            setTransferData(prev => ({ ...prev, [stationUic]: { loading: false, error: message, departures: [] } }));
          }
        };


        if (!stops || stops.length === 0) {
          return null;
        }

        const now = getCurrentTime();
        const finalStop = stops[stops.length - 1];
        const finalArrivalEvent = finalStop?.arrivals[0];
        // Use actualTime if available, otherwise plannedTime for final arrival check
        const finalArrivalTime = parseApiTime(finalArrivalEvent?.actualTime ?? finalArrivalEvent?.plannedTime);

        // Condition 1: Check if final arrival time is in the future
        if (!finalArrivalTime || finalArrivalTime <= now) {
          return null; // Don't render if journey is completed or final time invalid
        }

        // Condition 2: Determine Next Station and Upcoming Stops
        let nextStopIndex = -1;
        for (let i = 0; i < stops.length; i++) {
          const stop = stops[i];
          const arrivalEvent = stop.arrivals[0];
          const departureEvent = stop.departures[0];

          // Use actual times if available, fallback to planned
          const arrivalTime = parseApiTime(arrivalEvent?.actualTime ?? arrivalEvent?.plannedTime);
          const departureTime = parseApiTime(departureEvent?.actualTime ?? departureEvent?.plannedTime);


          if (arrivalTime && now < arrivalTime) {
            // Current time is before arrival at this stop -> this is the next stop
            nextStopIndex = i;
            break;
          } else if (departureTime && arrivalTime && now >= arrivalTime && now < departureTime) {
            // Current time is between arrival and departure at this stop -> the *following* stop is the next one
            if (i + 1 < stops.length) {
              nextStopIndex = i + 1;
            } else {
              // Train is at the last stop, but hasn't departed yet. No "next" stop.
              nextStopIndex = -1; // Indicate no upcoming stops
            }
            break;
          } else { // Note: This 'else' block becomes empty after removing the log, which is fine.
          }
          // If current time is after departureTime, continue loop
        }

         // If no next stop found (e.g., only final stop remains and arrival is in future)
         if (nextStopIndex === -1 || nextStopIndex >= stops.length) {
           return null; // Don't show section if only the final destination remains or is already reached/passed departure
         }

        const nextStop = stops[nextStopIndex];
        // Filter upcoming stops to only include those with an arrival event (meaning the train actually stops)
        const upcomingStops = stops.slice(nextStopIndex + 1).filter(stop => stop.arrivals && stop.arrivals.length > 0);

        // Toggle visibility for an upcoming stop's transfers
        const toggleUpcomingTransferVisibility = (uic: string) => {
            setUpcomingTransfersVisible(prev => ({ ...prev, [uic]: !prev[uic] }));
        };

        // --- Reusable Stop Display Component Definition (Defined Inside) ---
        const StopDisplay: React.FC<{
            stop: Stop;
            isNextStop?: boolean;
            isFinalDestination: boolean;
        }> = ({ stop, isNextStop = false, isFinalDestination }) => {
            const uic = stop.stop.uicCode;
            // We need UIC to show button and details, but can render basic info without it

            // Determine the relevant event (arrival or departure) based on context
            const relevantEvent = isFinalDestination || !isNextStop
                ? stop.arrivals[0] // Use arrival for upcoming stops and the final destination
                : stop.departures[0] || stop.arrivals[0]; // Use departure for next stop, fallback to arrival

            if (!relevantEvent) return null; // Need an event to display time/track

            const plannedTime = formatTime(relevantEvent.plannedTime);
            const actualTime = relevantEvent.actualTime ? formatTime(relevantEvent.actualTime) : plannedTime;
            const delayMinutes = calculateDelay(relevantEvent.plannedTime, relevantEvent.actualTime ?? relevantEvent.plannedTime);
            const track = relevantEvent.actualTrack || relevantEvent.plannedTrack;
            const isCancelled = relevantEvent.cancelled;

            // Access state directly since component is defined inside
            const isVisible = uic ? !!upcomingTransfersVisible[uic] : false;
            const transferInfo = uic ? transferData[uic] : undefined;

            const handleToggleClick = () => {
                if (!uic) return; // Don't toggle if no UIC
                toggleUpcomingTransferVisibility(uic);
                // Fetch transfers based on arrival time when opening
                const fetchBaseTime = stop.arrivals[0]?.actualTime ?? stop.arrivals[0]?.plannedTime;
                if (!isVisible && !transferInfo?.departures && !transferInfo?.loading && fetchBaseTime) {
                    fetchTransfers(uic, fetchBaseTime);
                }
            };

            // Define colors
            const plannedTimeColor = isCancelled ? 'text-red-400/80 dark:text-red-500/80' : 'text-blue-500 dark:text-blue-400';
            const actualTimeColor = 'text-red-500 dark:text-red-400';
            const stationNameColor = isCancelled ? 'text-gray-400 dark:text-gray-500' : 'text-gray-100 dark:text-gray-100';
            const platformColorClasses = relevantEvent.actualTrack && relevantEvent.plannedTrack && relevantEvent.actualTrack !== relevantEvent.plannedTrack
                ? 'border-red-600 text-red-600 dark:border-red-500 dark:text-red-500'
                : 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400';

            // Define base sizes (mobile-first) and apply larger sizes conditionally with sm: prefix
            // Define base sizes (mobile-first) and apply larger sizes conditionally with sm: prefix
            // Base sizes for Next Stop are slightly larger than upcoming stops
            const containerPadding = isNextStop ? `p-4 sm:p-6` : `p-3`; // Mobile: p-4, sm+: p-6 for next
            const timeRowTextSize = isNextStop ? `text-base sm:text-2xl` : `text-sm`; // Mobile: text-base, sm+: text-2xl for next
            const timeRowMargin = isNextStop ? `mb-1.5 sm:mb-3` : `mb-1`; // Mobile: mb-1.5, sm+: mb-3 for next
            const platformSize = isNextStop ? `w-8 h-8 sm:w-12 sm:h-12` : `w-6 h-6`; // Mobile: w-8 h-8, sm+: w/h-12 for next
            const platformTextSize = isNextStop ? `text-sm sm:text-xl` : `text-xs`; // Mobile: text-sm, sm+: text-xl for next
            const platformMargin = isNextStop ? `mr-3 sm:mr-4` : `mr-2`; // Mobile: mr-3, sm+: mr-4 for next
            const stationNameSize = isNextStop ? `text-lg sm:text-3xl` : `text-base`; // Mobile: text-lg, sm+: text-3xl for next
            const stationNameWeight = isNextStop ? 'font-bold' : 'font-medium'; // Keep bold only for next stop
            const buttonPadding = isNextStop ? `py-1.5 px-4 sm:py-2.5 sm:px-6` : `py-1 px-3`; // Mobile: py-1.5 px-4, sm+: py-2.5 px-6 for next
            const buttonTextSize = isNextStop ? `text-base sm:text-xl` : `text-sm`; // Mobile: text-base, sm+: text-xl for next

            return (
                 // Add onClick to the main div, make it focusable and add cursor-pointer
                 <div
                    className={`${containerPadding} rounded-md ${isCancelled ? 'bg-gray-700/50 opacity-70' : 'bg-gray-800 dark:bg-slate-800'} ${uic ? 'cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50' : ''}`}
                    onClick={uic ? handleToggleClick : undefined}
                    role={uic ? "button" : undefined}
                    tabIndex={uic ? 0 : undefined}
                    onKeyDown={uic ? (e) => { if (e.key === 'Enter' || e.key === ' ') handleToggleClick(); } : undefined}
                 >
                    {/* Time Row */}
                    <div className={`flex items-center ${timeRowTextSize} ${timeRowMargin}`}>
                        <span className={`font-semibold ${plannedTimeColor} ${ (isCancelled || delayMinutes > 0) ? 'line-through' : '' }`}>
                            {plannedTime}
                        </span>
                        {delayMinutes > 0 && !isCancelled && (
                            <span className={`ml-2 font-semibold ${actualTimeColor}`}>
                                {actualTime}
                            </span>
                        )}
                        {delayMinutes > 0 && !isCancelled && (
                            <span className={`ml-1 font-medium text-xs ${actualTimeColor}`}> {/* Keep delay text smaller */}
                                (+{delayMinutes})
                            </span>
                        )}
                        {isCancelled && (
                            <span className="ml-2 px-1.5 py-0.5 bg-red-600 text-white text-xs font-semibold rounded">
                                Cancelled
                            </span>
                        )}
                    </div>
                    {/* Platform and Station Row */}
                    <div className={`flex items-center ${!isNextStop ? 'justify-between' : ''}`}> {/* Conditionally justify */}
                        <div className="flex items-center"> {/* Group platform and name */}
                            <span className={`flex items-center justify-center ${platformSize} rounded border ${platformTextSize} font-semibold ${platformMargin} ${platformColorClasses}`}>
                                {track ?? '?'}
                            </span>
                            <span className={`${stationNameWeight} ${stationNameSize} ${stationNameColor} ${isCancelled ? 'line-through' : ''}`}>
                                {stop.stop.name}
                            </span>
                        </div>
                        {/* Transfer Toggle Button (Inline for upcoming stops) */}
                        {!isNextStop && uic && (
                            <button
                                onClick={(e) => { e.stopPropagation(); handleToggleClick(); }}
                                disabled={transferInfo?.loading}
                                className={`flex items-center ${buttonTextSize} ${buttonPadding} rounded bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-blue-500`}
                                aria-label={`${isVisible ? 'Hide' : 'Show'} transfers for ${stop.stop.name.replace("'", "&apos;")}`}
                                aria-expanded={isVisible}
                            >
                                {transferInfo?.loading ? 'Loading...' : 'Transfers'}
                                <motion.div animate={{ rotate: isVisible ? 180 : 0 }} transition={{ duration: 0.2 }} className="ml-1.5">
                                    <FaChevronDown className="h-3 w-3" />
                                </motion.div>
                            </button>
                        )}
                    </div>
                    {/* Transfer Toggle Button (Full width for next stop) */}
                    {isNextStop && uic && (
                         <button
                            onClick={(e) => { e.stopPropagation(); handleToggleClick(); }}
                            disabled={transferInfo?.loading}
                            className={`flex items-center justify-center w-full mt-4 ${buttonTextSize} ${buttonPadding} rounded bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-blue-500`} // Added w-full, mt-4, justify-center
                            aria-label={`${isVisible ? 'Hide' : 'Show'} transfers for ${stop.stop.name.replace("'", "&apos;")}`}
                            aria-expanded={isVisible}
                        >
                            {transferInfo?.loading ? 'Loading...' : 'Transfers'}
                            <motion.div animate={{ rotate: isVisible ? 180 : 0 }} transition={{ duration: 0.2 }} className="ml-1.5">
                                <FaChevronDown className="h-3 w-3" />
                            </motion.div>
                        </button>
                    )}
                    {/* Collapsible Transfer Data */}
                    <AnimatePresence initial={false}>
                        {isVisible && uic && (
                            <motion.div
                                key={`transfer-${uic}`}
                                initial="collapsed"
                                animate="open"
                                exit="collapsed"
                                variants={{
                                    open: { opacity: 1, height: 'auto', marginTop: '12px' },
                                    collapsed: { opacity: 0, height: 0, marginTop: '0px' }
                                }}
                                transition={{ duration: 0.3, ease: [0.04, 0.62, 0.23, 0.98] }}
                                className="overflow-hidden border-t border-gray-600 dark:border-gray-700 pt-3 mt-3"
                            >
                                {/* Prevent clicks inside the details from closing it */}
                                <div onClick={(e) => e.stopPropagation()}>
                                    {transferInfo?.error && (
                                        <p className="text-xs text-red-400 dark:text-red-400 italic py-1">{transferInfo.error}</p>
                                    )}
                                    {/* <<< START MODIFICATION >>> */}
                                    {!transferInfo?.error && !transferInfo?.loading && transferInfo?.departures.length === 0 && (
                                        (() => {
                                            // Use arrival time for the check, fallback to relevant event time if arrival missing
                                            const plannedArrivalTimeString = stop.arrivals[0]?.plannedTime ?? relevantEvent.plannedTime;
                                            const plannedArrivalTime = parseApiTime(plannedArrivalTimeString);
                                            const now = getCurrentTime(); // Recalculate current time here
                                            const ninetyMinutesInMillis = 90 * 60 * 1000;

                                            if (plannedArrivalTime && plannedArrivalTime.getTime() > now.getTime() + ninetyMinutesInMillis) {
                                                return <p className="text-xs text-gray-400 dark:text-gray-400 italic py-1">Transfers only become visible 90 minutes before arrival.</p>;
                                            } else {
                                                return <p className="text-xs text-gray-400 dark:text-gray-400 italic py-1">No departures found.</p>;
                                            }
                                        })()
                                    )}
                                    {/* <<< END MODIFICATION >>> */}
                                    {transferInfo?.departures && transferInfo.departures.length > 0 && (
                                        <DepartureList
                                            journeys={transferInfo.departures}
                                            listType="departures"
                                            currentStationUic={uic}
                                            showFilterPanel={false}
                                            selectedTrainTypes={[]}
                                            selectedDestinations={[]}
                                            onTrainTypeChange={() => {}}
                                            onDestinationChange={() => {}}
                                        />
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            );
        };
        // --- End Reusable Stop Display Component Definition ---

        // Need summary to display the header
        if (!summary) return null;

        // Determine if the journey is in the future based on origin departure time
        let isNextJourney = false;
        const originDepartureTime = parseApiTime(summary.departureEvent?.plannedTime);
        if (originDepartureTime && originDepartureTime > now) {
            isNextJourney = true;
        }

        return (
          <div className="mb-4"> {/* Add margin below this section */}
            {/* Conditionally render heading */}
            <h2 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-200">
                {isNextJourney ? 'Next Journey' : 'Current Journey'}
            </h2>
            {/* Main container with border/shadow */}
            <div className="border rounded-md shadow-sm dark:bg-gray-800 dark:border-gray-700 overflow-hidden">
                {/* Header Section - Styled like Latest Journey Header */}
                <div className="p-4 bg-blue-50 dark:bg-blue-900/30">
                    {/* Adapted from Latest Journey Header (lines 796-853), removed button/chevron */}
                    <div className="flex-grow text-left space-y-1">
                        <div> {/* Wrap origin/dest in a div */}
                            {/* Origin Row */}
                            <div className="flex items-center">
                                <span className={`font-semibold text-lg ${summary.isJourneyCancelled ? 'line-through text-red-700/80 dark:text-red-500/80' : 'text-gray-800 dark:text-gray-200'}`}>
                                {summary.originStationName}
                                </span>
                                <span className={`ml-3 text-lg font-semibold ${ (summary.isJourneyCancelled || summary.departureDelayMinutes > 0) ? 'line-through' : '' } ${ summary.isJourneyCancelled ? 'text-red-600/80 dark:text-red-400/80' : 'text-blue-800 dark:text-blue-300' }`}>
                                {summary.departurePlannedTimeFormatted}
                                </span>
                                {summary.departureDelayMinutes > 0 && !summary.isJourneyCancelled && (
                                <span className="ml-1.5 text-lg font-semibold text-red-600 dark:text-red-400">
                                    {summary.departureActualTimeFormatted}
                                </span>
                                )}
                                {summary.departureDelayMinutes > 0 && !summary.isJourneyCancelled && (
                                    <span className="ml-1 text-sm font-medium text-red-600 dark:text-red-400">
                                    (+{summary.departureDelayMinutes} min)
                                    </span>
                                )}
                            </div>
                            {/* Down Arrow Separator */}
                            <div className="flex my-1">
                                <FaArrowDown className="text-gray-400 dark:text-gray-500" />
                            </div>
                            {/* Destination Row */}
                            <div className="flex items-center">
                                <span className={`font-semibold text-lg ${summary.isJourneyCancelled ? 'line-through text-red-700/80 dark:text-red-500/80' : 'text-gray-800 dark:text-gray-200'}`}>
                                {summary.finalDestinationName}
                                </span>
                                <span className={`ml-3 text-lg font-semibold ${ (summary.isJourneyCancelled || summary.arrivalDelayMinutes > 0) ? 'line-through' : '' } ${ summary.isJourneyCancelled ? 'text-red-600/80 dark:text-red-400/80' : 'text-blue-800 dark:text-blue-300' }`}>
                                {summary.arrivalPlannedTimeFormatted}
                                </span>
                                {summary.arrivalDelayMinutes > 0 && !summary.isJourneyCancelled && (
                                <span className="ml-1.5 text-lg font-semibold text-red-600 dark:text-red-400">
                                    {summary.arrivalActualTimeFormatted}
                                </span>
                                )}
                                {summary.arrivalDelayMinutes > 0 && !summary.isJourneyCancelled && (
                                    <span className="ml-1 text-sm font-medium text-red-600 dark:text-red-400">
                                    (+{summary.arrivalDelayMinutes} min)
                                    </span>
                                )}
                            </div>
                            {/* Train Type / Cancelled */}
                            <div className="pt-1">
                                {summary.isJourneyCancelled ? (
                                    <span className="px-2 py-0.5 bg-red-600 text-white text-sm font-semibold rounded">
                                    Cancelled
                                    </span>
                                ) : (
                                    <span className="text-sm text-gray-500 dark:text-gray-400">
                                    {summary.departureEvent.product.operatorName} {summary.departureEvent.product.shortCategoryName} {summary.departureEvent.product.number}
                                    </span>
                                )}
                            </div>
                        </div> {/* Close wrapper div */}
                    </div>
                </div> {/* Close Header Section */}

                {/* Content Section (Next/Upcoming Stops) */}
                <div className="p-4 space-y-3 bg-white dark:bg-slate-900"> {/* Restored original dark background */}
                    {/* Next Station */}
                    <div>
                        <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-1">Next Station:</h3>
                        <StopDisplay
                            stop={nextStop}
                            isNextStop={true}
                            isFinalDestination={nextStopIndex === (stops.length - 1)}
                        />
                    </div>

                    {/* Upcoming Stops */}
                    {upcomingStops.length > 0 && (
                        <div>
                        <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-1">Upcoming Stops:</h3>
                        <ul className="space-y-2">
                            {upcomingStops.map((stop) => (
                            <li key={stop.id}>
                                <StopDisplay
                                    stop={stop}
                                    isFinalDestination={stop.status === 'DESTINATION'}
                                />
                            </li>
                            ))}
                        </ul>
                        </div>
                    )}
                </div> {/* Close Content Section */}
            </div> {/* Close Main container */}
          </div>
        );
      };
      {/* --- End Current Journey Section Component Definition --- */}

  // Derive livery info directly from materieelnummer for the "Not In Service" case
  const notInServiceImageUrl = isNotInService ? getSpecialLiveryImageUrl(materieelnummer) : null;
  const notInServiceLiveryName = isNotInService ? getSpecialLiveryName(materieelnummer) : null;

  return (
    <div>
      {/* Search Input */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={materieelnummer}
          onChange={handleInputChange} // Use new handler
          placeholder="Enter Materieelnummer (e.g., 4011)"
          className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500 flex-grow"
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <button
          onClick={handleSearch}
          disabled={isLoading}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
        >
          {isLoading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {/* Error Display (Generic Errors Only) */}
      {error && !isNotInService && (
        <div className="bg-red-600 text-white font-bold p-3 rounded-md mb-4 text-center">
          {error} {/* Display "Train not found" or other generic errors */}
        </div>
      )}

      {/* Loading State */}
      {isLoading && <p>Loading train details...</p>}

      {/* Initial Prompt */}
      {!isLoading && !error && !isNotInService && stops.length === 0 && !materieelnummer && (
         <p>Enter a materieelnummer above to see its details.</p>
      )}

      {/* Disruption Notes Display - Show even if train not in service but notes exist */}
      {!isLoading && notes.length > 0 && (
        <div className="mb-4 p-3 border border-yellow-400 bg-yellow-50 dark:bg-yellow-900/30 dark:border-yellow-600 rounded-md shadow-sm">
          <h3 className="text-lg font-semibold mb-2 text-yellow-800 dark:text-yellow-300 flex items-center">
            <FaExclamationTriangle className="mr-2" aria-hidden="true" />
            Important Information
          </h3>
          <ul className="list-disc list-inside space-y-1 text-yellow-700 dark:text-yellow-200">
            {notes.map((note, index) =>
              <li key={note.id ?? `note-${index}`}>{note.text}</li> // Corrected map syntax
            )}
          </ul>
        </div>
      )}

      {/* Train Info Card - Shows if journey found OR if train is known but not in service */}
      {!isLoading && !error && (summary || isNotInService) && (
        <div className="border rounded-md shadow-sm bg-white dark:bg-gray-800 dark:border-gray-700 overflow-hidden mb-4 p-4">
           <h2 className="text-xl font-semibold mb-3 text-gray-800 dark:text-gray-200">Train Information</h2>
           <div className="flex flex-col items-center gap-4">
              {/* Image - Use summary if available, otherwise derive from materieelnummer */}
              {(summary?.displayImageUrl || notInServiceImageUrl) && (
                 <div className="w-full mb-3">
                    <Image
                      src={summary?.displayImageUrl || notInServiceImageUrl!} // Use non-null assertion as we check existence
                      alt={summary?.displayImageAlt || notInServiceLiveryName || `Train ${materieelnummer}`}
                      title={summary?.displayImageAlt || notInServiceLiveryName || `Train ${materieelnummer}`}
                      quality={80}
                      unoptimized={true}
                      layout="responsive"
                      width={16}
                      height={9}
                      className="w-full h-auto object-contain rounded" // Removed border
                    />
                 </div>
              )}
              {/* Details */}
              <div className="flex-grow space-y-1 text-sm w-full">
                 {/* Type & Materieelnummer */}
                 <p>
                    <span className="font-semibold text-gray-700 dark:text-gray-300">
                        {summary ? 'Type:' : 'Number:'} {/* Adjust label */}
                    </span>{' '}
                    <span className="text-gray-600 dark:text-gray-400">
                       {summary ? summary.trainType : ''} {summary?.stockIdentifier && summary.stockIdentifier !== '0' ? `(${summary.stockIdentifier})` : `(${materieelnummer})`}
                    </span>
                 </p>

                 {/* Show full details only if summary exists (i.e., journey found) */}
                 {summary && (
                    <>
                        {/* Length */}
                        {summary.numberOfParts !== undefined && (
                            <p>
                            <span className="font-semibold text-gray-700 dark:text-gray-300">Length:</span>{' '}
                            <span className="text-gray-600 dark:text-gray-400">
                                {summary.numberOfParts} parts
                            </span>
                            </p>
                        )}
                        {/* Seats */}
                        {summary.numberOfSeats !== undefined && (
                            <p>
                            <span className="font-semibold text-gray-700 dark:text-gray-300">Seats:</span>{' '}
                            <span className="text-gray-600 dark:text-gray-400">
                                {summary.numberOfSeats}
                            </span>
                            </p>
                        )}
                        {/* Facilities */}
                        {summary.facilities && summary.facilities.length > 0 && (
                            <p>
                            <span className="font-semibold text-gray-700 dark:text-gray-300">Facilities:</span>{' '}
                            <span className="text-gray-600 dark:text-gray-400 capitalize">
                                {summary.facilities.map(f => f.toLowerCase().replace(/_/g, ' ')).join(', ')}
                            </span>
                            </p>
                        )}
                    </>
                 )}

                 {/* Special Livery - Show if summary has it OR if not in service and derivable */}
                 {(summary?.specialLiveryName || notInServiceLiveryName) && (
                   <p className="pt-1">
                     <span className="inline-flex items-center px-1.5 py-0.5 bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 rounded text-xs font-medium">
                       <FaStar className="mr-1 h-3 w-3" aria-hidden="true" />
                       {summary?.specialLiveryName || notInServiceLiveryName}
                     </span>
                   </p>
                 )}

                 {/* Not In Service Indicator */}
                 {isNotInService && (
                    <p className="pt-1 text-sm font-medium text-orange-600 dark:text-orange-400">
                        Not currently in service.
                    </p>
                 )}
              </div>
           </div>
        </div>
      )}


      {/* Current Journey Section (Conditionally Rendered) */}
      {/* Wrap the conditional rendering in curly braces */}
      {!isLoading && !error && !isNotInService && stops.length > 0 && summary && (
        <CurrentJourneySection stops={stops} summary={summary} /> /* Pass summary prop */
      )}

      {/* Journey Card Display - Only show if stops are actually found AND not in the "Not In Service" state */}
      {!isLoading && !error && !isNotInService && stops.length > 0 && summary && (
        <> {/* Fragment to group heading and card */}
          <h2 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-200">Latest Journey</h2>
          <div className="border rounded-md shadow-sm bg-white dark:bg-gray-800 dark:border-gray-700 overflow-hidden">
            {/* Card Header - Clickable */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex justify-between items-start w-full p-4 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
              aria-expanded={isExpanded}
            >
              {/* Left Column: Origin/Dest + Times */}
              <div className="flex-grow mr-4 text-left space-y-1"> {/* Reduced space-y */}
                {/* Origin/Destination Info */}
                <div> {/* Wrap origin/dest in a div */}
                  {/* Origin Row */}
                  <div className="flex items-center">
                    <span className={`font-semibold text-lg ${summary.isJourneyCancelled ? 'line-through text-red-700/80 dark:text-red-500/80' : 'text-gray-800 dark:text-gray-200'}`}>
                      {summary.originStationName}
                    </span>
                    <span className={`ml-3 text-lg font-semibold ${ (summary.isJourneyCancelled || summary.departureDelayMinutes > 0) ? 'line-through' : '' } ${ summary.isJourneyCancelled ? 'text-red-600/80 dark:text-red-400/80' : 'text-blue-800 dark:text-blue-300' }`}>
                      {summary.departurePlannedTimeFormatted}
                    </span>
                    {summary.departureDelayMinutes > 0 && !summary.isJourneyCancelled && (
                      <span className="ml-1.5 text-lg font-semibold text-red-600 dark:text-red-400">
                        {summary.departureActualTimeFormatted}
                      </span>
                    )}
                    {summary.departureDelayMinutes > 0 && !summary.isJourneyCancelled && (
                        <span className="ml-1 text-sm font-medium text-red-600 dark:text-red-400">
                          (+{summary.departureDelayMinutes} min)
                        </span>
                    )}
                  </div>
                  {/* Down Arrow Separator - Left Aligned */}
                  <div className="flex my-1">
                    <FaArrowDown className="text-gray-400 dark:text-gray-500" />
                  </div>
                  {/* Destination Row */}
                  <div className="flex items-center">
                    <span className={`font-semibold text-lg ${summary.isJourneyCancelled ? 'line-through text-red-700/80 dark:text-red-500/80' : 'text-gray-800 dark:text-gray-200'}`}>
                      {summary.finalDestinationName}
                    </span>
                    <span className={`ml-3 text-lg font-semibold ${ (summary.isJourneyCancelled || summary.arrivalDelayMinutes > 0) ? 'line-through' : '' } ${ summary.isJourneyCancelled ? 'text-red-600/80 dark:text-red-400/80' : 'text-blue-800 dark:text-blue-300' }`}>
                      {summary.arrivalPlannedTimeFormatted}
                    </span>
                    {summary.arrivalDelayMinutes > 0 && !summary.isJourneyCancelled && (
                      <span className="ml-1.5 text-lg font-semibold text-red-600 dark:text-red-400">
                        {summary.arrivalActualTimeFormatted}
                      </span>
                    )}
                    {summary.arrivalDelayMinutes > 0 && !summary.isJourneyCancelled && (
                        <span className="ml-1 text-sm font-medium text-red-600 dark:text-red-400">
                          (+{summary.arrivalDelayMinutes} min)
                        </span>
                    )}
                  </div>
                  {/* Train Type / Cancelled */}
                  <div className="pt-1">
                    {summary.isJourneyCancelled ? (
                        <span className="px-2 py-0.5 bg-red-600 text-white text-sm font-semibold rounded">
                          Cancelled
                        </span>
                    ) : (
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {summary.departureEvent.product.operatorName} {summary.departureEvent.product.shortCategoryName} {summary.departureEvent.product.number}
                        </span>
                    )}
                  </div>
                </div> {/* Close wrapper div */}
              </div>
              {/* Right Column: Chevron Only */}
              <div className="flex flex-col items-center flex-shrink-0 pt-1">
                  <motion.div
                    animate={{ rotate: isExpanded ? 0 : -180 }}
                    transition={{ duration: 0.2 }}
                  >
                    <FaChevronDown className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                  </motion.div>
              </div>
            </button>

            {/* Collapsible Content - Stops List */}
            <AnimatePresence initial={false}>
              {isExpanded && (
                <motion.div
                  key="content"
                  initial="collapsed"
                  animate="open"
                  exit="collapsed"
                  variants={{
                    open: { opacity: 1, height: 'auto' },
                    collapsed: { opacity: 0, height: 0 }
                  }}
                  transition={{ duration: 0.3, ease: [0.04, 0.62, 0.23, 0.98] }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                    <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                      {stops.map((stop) => {
                        const arrival = stop.arrivals.length > 0 ? stop.arrivals[0] : null;
                        const departure = stop.departures.length > 0 ? stop.departures[0] : null;
                        const relevantEvent = (stop.status === 'ORIGIN' || stop.status === 'STOP') ? (departure || arrival) : (arrival || departure);
                        const stockInfo = stop.actualStock || stop.plannedStock;

                        if (!relevantEvent) return null;

                        const plannedTime = formatTime(relevantEvent.plannedTime);
                        const actualTime = relevantEvent.actualTime ? formatTime(relevantEvent.actualTime) : plannedTime;
                        const delayMinutes = calculateDelay(relevantEvent.plannedTime, relevantEvent.actualTime ?? relevantEvent.plannedTime);
                        const track = relevantEvent.actualTrack || relevantEvent.plannedTrack;
                        const isCancelled = relevantEvent.cancelled;

                        return (
                          <li key={stop.id} className={`p-4 ${isCancelled ? 'bg-red-50 dark:bg-red-900/30 opacity-70' : ''}`}>
                            {/* Stop Info Row */}
                            <div className="flex justify-between items-start mb-2">
                              {/* Left: Time/Delay + Stop Name/Status */}
                              <div className="flex-grow mr-4">
                                <div className="flex items-center flex-wrap mb-1">
                                  <span className={`text-lg font-semibold ${ (isCancelled || delayMinutes > 0) ? 'line-through' : '' } ${ isCancelled ? 'text-red-600 dark:text-red-400' : 'text-blue-800 dark:text-blue-300' } mr-2`}>
                                    {plannedTime}
                                  </span>
                                  {delayMinutes > 0 && !isCancelled && (
                                    <span className="text-lg font-semibold text-red-600 dark:text-red-400 mr-2">
                                      {actualTime}
                                    </span>
                                  )}
                                  {delayMinutes > 0 && !isCancelled && (
                                     <span className="text-sm font-medium text-red-600 dark:text-red-400">
                                       (+{delayMinutes} min)
                                     </span>
                                  )}
                                  {isCancelled && (
                                    <span className="ml-2 px-2 py-0.5 bg-red-600 text-white text-sm font-semibold rounded">
                                      Cancelled
                                    </span>
                                  )}
                                </div> {/* Close flex items-center flex-wrap mb-1 */}
                                <div>
                                  <span className={`font-semibold text-lg ${isCancelled ? 'line-through text-red-700 dark:text-red-500' : 'text-gray-800 dark:text-gray-200'}`}>
                                    {stop.stop.name}
                                  </span>
                                  <span className={`ml-1.5 text-xs font-medium px-2 py-0.5 rounded ${
                                      isCancelled ? 'text-red-700/70 dark:text-red-500/70' :
                                      stop.status === 'STOP' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                                      stop.status === 'PASSING' ? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' :
                                      stop.status === 'ORIGIN' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                      stop.status === 'DESTINATION' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' :
                                      'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                                    }`}>{stop.status}</span>
                                </div>
                              </div>
                              {/* Right: Track */}
                              <span className={`flex items-center justify-center w-12 h-12 rounded border text-base font-semibold flex-shrink-0 ${
                                relevantEvent.actualTrack && relevantEvent.plannedTrack && relevantEvent.actualTrack !== relevantEvent.plannedTrack
                                  ? 'border-red-600 text-red-600 dark:border-red-500 dark:text-red-500'
                                  : 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                              }`}>
                                {track ?? '?'}
                              </span>
                            </div>

                            {/* Composition at this stop */}
                            {stockInfo && (
                              <div className="mt-2">
                                <div className="text-sm text-gray-700 dark:text-gray-300 mb-1">
                                  <strong>Length:</strong> {stockInfo.numberOfParts}
                                </div>
                                <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded">
                                  {stockInfo.trainParts.map((part, partIndex) => {
                                    const customImageUrl = part.stockIdentifier ? getSpecialLiveryImageUrl(part.stockIdentifier) : undefined;
                                    const imageUrl = customImageUrl || part.image?.uri;
                                    const imageAlt = part.stockIdentifier ? getSpecialLiveryName(part.stockIdentifier) || stockInfo.trainType : stockInfo.trainType;
                                    const materieelNummerDisplay = part.stockIdentifier == null ? 'N/A' : (part.stockIdentifier === '0' ? 'Unknown' : part.stockIdentifier);
                                    const liveryName = part.stockIdentifier ? getSpecialLiveryName(part.stockIdentifier) : null;

                                    return (
                                      <div key={part.stockIdentifier ?? `part-${partIndex}`} className="mb-1 last:mb-0"> {/* Use ?? and prefix index */}
                                        {imageUrl ? (
                                          <Image src={imageUrl} alt={imageAlt ?? 'Train part image'} title={imageAlt ?? ''} width={300} height={84} quality={100} unoptimized={true} className="h-7 w-auto object-contain" />
                                        ) : (
                                          <div className="h-7 flex items-center justify-center text-gray-400 dark:text-gray-500 text-xs italic">(No image)</div>
                                        )}
                                        <div className="flex items-center text-xs text-left text-gray-600 dark:text-gray-400 mt-0.5 flex-wrap">
                                          <span>
                                            {stockInfo.trainType} ({materieelNummerDisplay})
                                            {liveryName && (
                                              <span className="inline-flex items-center ml-1 px-1.5 py-0.5 bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 rounded text-xs font-medium">
                                                <FaStar className="mr-1" aria-hidden="true" />
                                                {liveryName}
                                              </span>
                                            )}
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div> {/* Close Journey Card div */}
        </> // Close Fragment
      )}
    </div>
  );
}