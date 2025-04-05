'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { FaStar, FaChevronDown, FaArrowDown, FaExclamationTriangle, FaThumbtack } from 'react-icons/fa'; // Added FaThumbtack
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { formatTime, calculateDelay, formatDateTimeForApi } from '../lib/utils';
import { getSpecialLiveryName, getSpecialLiveryImageUrl } from '../lib/specialLiveries';
import { Journey, TrainUnit, DepartureMessage } from '../lib/ns-api'; // Added DepartureMessage
import DepartureList from './DepartureList';
import { stations } from '../lib/stations';
import { usePinnedJourney, PinnedJourneyData } from '../hooks/usePinnedJourney'; // Import pinning hook and type

// --- Types ---
interface StationInfo { name: string; lng: number; lat: number; countryCode: string; uicCode: string; }
interface Product { number: string; categoryCode: string; shortCategoryName: string; longCategoryName: string; operatorCode: string; operatorName: string; type: string; }
// Extended ArrivalDeparture to potentially include messages
interface ArrivalDeparture {
    product: Product;
    origin?: StationInfo; // Made optional as it might not be on all events
    destination?: StationInfo; // Made optional
    plannedTime: string;
    actualTime?: string;
    delayInSeconds?: number;
    plannedTrack?: string;
    actualTrack?: string;
    cancelled: boolean;
    punctuality?: number;
    crowdForecast?: string;
    stockIdentifiers?: string[];
    messages?: DepartureMessage[]; // Added messages
}
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
  composition: { length: number; parts: TrainUnit[]; destination?: string } | null;
  finalDestination?: string | null;
}

interface JourneyPayload {
    stops: Stop[];
    notes?: Note[];
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

export default function TrainInfoSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const initialMNumFromUrl = searchParams.get('materieelnummer') || '';
  const [materieelnummer, setMaterieelnummer] = useState(initialMNumFromUrl);

  const [stops, setStops] = useState<Stop[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [isNotInService, setIsNotInService] = useState(false);
  const initialSearchDone = useRef(false);

  const performSearch = useCallback(async (mNum: string) => {
    if (!mNum) {
        setStops([]); setError(null); setNotes([]); setIsNotInService(false);
        return;
    }
    setIsLoading(true); setError(null); setIsNotInService(false); setStops([]); setNotes([]); setIsExpanded(true);

    try {
      const response = await fetch(`/api/train-info/${mNum}`);
      if (!response.ok) {
        if (response.status === 404) {
            let errorData = { error: "Train not found" };
            try { errorData = await response.json(); } catch {}
            if (errorData.error === "This train is not currently in service.") {
                setIsNotInService(true); setError(null);
            } else {
                setError("Train not found"); setIsNotInService(false);
            }
        } else {
            let errorMsg = `Error: ${response.status} ${response.statusText}`;
             try { const errorData = await response.json(); errorMsg = errorData.error || errorMsg; } catch {}
            setError(errorMsg); setIsNotInService(false);
        }
        setStops([]); setNotes([]);
        return;
      }
      const payload: JourneyPayload = await response.json();
      const fetchedStops = payload.stops || [];
      const fetchedNotes = payload.notes || [];
      setStops(fetchedStops); setNotes(fetchedNotes);
      setError(null); setIsNotInService(false);
    } catch (err: unknown) {
      console.error('Error fetching train info:', err);
      const message = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(message); setIsNotInService(false); setStops([]); setNotes([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSearch = () => {
    const trimmedMNum = materieelnummer.trim();
    const current = new URLSearchParams(searchParams.toString());
    if (!trimmedMNum) {
      setError('Please enter a materieelnummer.'); current.delete('materieelnummer');
    } else {
      current.set('materieelnummer', trimmedMNum);
    }
    router.push(`${pathname}?${current.toString()}`, { scroll: false });
    if (trimmedMNum) { performSearch(trimmedMNum); }
    else { setStops([]); setError(null); setNotes([]); setIsNotInService(false); }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = event.target.value;
      setMaterieelnummer(newValue);
      if (newValue.trim() === '') {
          const current = new URLSearchParams(searchParams.toString());
          current.delete('materieelnummer');
          router.push(`${pathname}?${current.toString()}`, { scroll: false });
          setStops([]); setError(null); setNotes([]); setIsNotInService(false);
      }
  };

  const materieelnummerRef = useRef(materieelnummer);
  useEffect(() => { materieelnummerRef.current = materieelnummer; }, [materieelnummer]);

  useEffect(() => {
    const mNumFromUrl = searchParams.get('materieelnummer');
    if (mNumFromUrl) {
      if (mNumFromUrl !== materieelnummerRef.current || !initialSearchDone.current) {
         const isInitial = !initialSearchDone.current;
         setMaterieelnummer(mNumFromUrl);
         if (isInitial) { initialSearchDone.current = true; }
         performSearch(mNumFromUrl);
      }
    } else {
      if (materieelnummerRef.current !== '') {
        setMaterieelnummer(''); setStops([]); setError(null); setNotes([]); setIsNotInService(false);
        initialSearchDone.current = false;
      }
    }
  }, [searchParams, performSearch]);

  const getJourneySummary = () => {
    if (!stops || stops.length === 0 || !materieelnummer) return null;

    let targetStockInfo: StockInfo | undefined = undefined;
    let targetTrainPart: TrainPart | undefined = undefined;
    for (const stop of stops) {
        const currentStock = stop.actualStock || stop.plannedStock;
        if (currentStock?.trainParts) {
            const foundPart = currentStock.trainParts.find(part => part.stockIdentifier === materieelnummer);
            if (foundPart) {
                targetStockInfo = currentStock; targetTrainPart = foundPart; break;
            }
        }
    }
    if (!targetTrainPart || !targetStockInfo) return null; // Return null if specific part not found

    const stockIdentifier = targetTrainPart.stockIdentifier;
    const trainType = targetStockInfo.trainType;
    const numberOfSeats = targetStockInfo.numberOfSeats;
    const facilities = targetTrainPart.facilities;
    const numberOfParts = targetStockInfo.numberOfParts;
    const genericImageUrl = targetTrainPart.image?.uri;
    const specialLiveryImageUrl = stockIdentifier ? getSpecialLiveryImageUrl(stockIdentifier) : undefined;
    const specialLiveryName = stockIdentifier ? getSpecialLiveryName(stockIdentifier) : null;
    const displayImageUrl = specialLiveryImageUrl || genericImageUrl;
    const displayImageAlt = specialLiveryName || trainType || 'Train image';

    const originStop = stops.find(s => s.status === 'ORIGIN') || stops[0];
    const destinationStop = stops.find(s => s.status === 'DESTINATION') || stops[stops.length - 1];
    const departureEvent = originStop?.departures[0];
    const arrivalEvent = destinationStop?.arrivals[0];
    if (!departureEvent) return null;

    // Extract journey details from the first departure event
    const journeyNumber = departureEvent.product.number;
    const journeyCategory = departureEvent.product.shortCategoryName;
    const operatorName = departureEvent.product.operatorName;

    const departureDelayMinutes = calculateDelay(departureEvent.plannedTime, departureEvent.actualTime ?? departureEvent.plannedTime);
    const departurePlannedTimeFormatted = formatTime(departureEvent.plannedTime);
    const departureActualTimeFormatted = departureEvent.actualTime ? formatTime(departureEvent.actualTime) : departurePlannedTimeFormatted;
    const isJourneyCancelled = departureEvent.cancelled; // Cancellation at origin
    const arrivalDelayMinutes = arrivalEvent ? calculateDelay(arrivalEvent.plannedTime, arrivalEvent.actualTime ?? arrivalEvent.plannedTime) : 0;
    const arrivalPlannedTimeFormatted = arrivalEvent ? formatTime(arrivalEvent.plannedTime) : '--:--';
    const arrivalActualTimeFormatted = arrivalEvent?.actualTime ? formatTime(arrivalEvent.actualTime) : arrivalPlannedTimeFormatted;
    const originStationName = originStop?.stop.name ?? 'Unknown Origin';
    const finalDestinationName = destinationStop?.stop.name ?? 'Unknown Destination';

    return {
      departureEvent, arrivalEvent, originStationName, finalDestinationName, isJourneyCancelled,
      departureDelayMinutes, departurePlannedTimeFormatted, departureActualTimeFormatted,
      arrivalDelayMinutes, arrivalPlannedTimeFormatted, arrivalActualTimeFormatted,
      trainType, numberOfParts, numberOfSeats, facilities,
      displayImageUrl, displayImageAlt, specialLiveryName, stockIdentifier,
      // Add journey specific details needed for pinning
      journeyNumber, journeyCategory, operatorName,
      originUic: originStop?.stop.uicCode, // UIC of the true origin
      plannedDepartureTime: departureEvent.plannedTime, // Planned departure from true origin
      actualDepartureTime: departureEvent.actualTime, // Actual departure from true origin
    };
  };

  const summary = getJourneySummary();

  // --- Current Journey Section Component Definition ---
  type JourneySummaryType = ReturnType<typeof getJourneySummary>;
  const CurrentJourneySection: React.FC<{ stops: Stop[]; summary: JourneySummaryType }> = ({ stops, summary }) => {
    const [transferData, setTransferData] = useState<Record<string, { loading: boolean; error: string | null; departures: JourneyWithDetails[] }>>({});
    const [upcomingTransfersVisible, setUpcomingTransfersVisible] = useState<Record<string, boolean>>({});
    const { pinJourney, unpinJourney, pinnedJourney } = usePinnedJourney(); // Use the hook here

    // --- Pinning Logic for Train Info Page ---
    const handlePinClick = (event: React.MouseEvent) => {
        event.stopPropagation(); // Prevent card expansion/collapse

        if (!summary || !stops || stops.length === 0) return; // Need summary and stops data

        const originStop = stops[0];
        const destinationStop = stops[stops.length - 1];
        const secondStop = stops.length > 1 ? stops[1] : null; // For initial nextStation guess

        const dataToPin: PinnedJourneyData = {
          origin: summary.originStationName, // True origin name
          originUic: summary.originUic || '', // True origin UIC
          destination: summary.finalDestinationName,
          departureTime: summary.plannedDepartureTime, // Planned departure from true origin
          trainNumber: summary.journeyNumber,
          nextStation: secondStop?.stop.name ?? "Unknown", // Initial guess for next stop
          platform: originStop.departures[0]?.actualTrack ?? originStop.departures[0]?.plannedTrack, // Platform at true origin
          journeyCategory: summary.journeyCategory,
          materieelNummer: summary.stockIdentifier !== '0' ? summary.stockIdentifier : undefined, // Use the searched number
          plannedDepartureTime: summary.plannedDepartureTime, // Planned departure from true origin
          // actualDepartureTime: summary.actualDepartureTime || summary.plannedDepartureTime, // Removed - fetched live
          // messages: summary.departureEvent.messages, // Removed - messages fetched dynamically
          // No 'cancelled' field needed here
        };

        // Check if this specific journey instance (trainNumber + origin departure time) is pinned
        const isCurrentlyPinned = pinnedJourney?.trainNumber === dataToPin.trainNumber &&
                                 pinnedJourney?.plannedDepartureTime === dataToPin.plannedDepartureTime; // Compare based on origin departure

        if (isCurrentlyPinned) {
            unpinJourney();
        } else {
            pinJourney(dataToPin);
        }
    };
    // --- End Pinning Logic ---


    const fetchTransfers = async (stationUic: string, arrivalTimeString?: string) => {
      if (!stationUic || transferData[stationUic]?.departures || transferData[stationUic]?.loading) return;
      const station = stations.find(s => s.uic === stationUic);
      if (!station) {
          setTransferData(prev => ({ ...prev, [stationUic]: { loading: false, error: `Invalid station UIC: ${stationUic}`, departures: [] } })); return;
      }
      const stationCode = station.code;
      setTransferData(prev => ({ ...prev, [stationUic]: { loading: true, error: null, departures: [] } }));
      let rawResponseText = ''; let responseOk = false;
      try {
        let targetDateTimeString: string | undefined = undefined;
        if (arrivalTimeString) {
            const arrivalTime = parseApiTime(arrivalTimeString);
            if (arrivalTime) { arrivalTime.setMinutes(arrivalTime.getMinutes() + 3); targetDateTimeString = formatDateTimeForApi(arrivalTime); }
        }
        const apiUrl = `/api/journeys/${stationCode}?type=departures${targetDateTimeString ? `&dateTime=${encodeURIComponent(targetDateTimeString)}` : ''}`;
        const response = await fetch(apiUrl); responseOk = response.ok; rawResponseText = await response.text();
        if (!responseOk) { setTransferData(prev => ({ ...prev, [stationUic]: { loading: false, error: `API Error ${response.status}: ${rawResponseText.substring(0, 100)}...`, departures: [] } })); }
        else {
          try { const data: { journeys: JourneyWithDetails[], disruptions: unknown[] } = JSON.parse(rawResponseText); setTransferData(prev => ({ ...prev, [stationUic]: { loading: false, error: null, departures: data.journeys || [] } })); }
          catch (parseError) { console.error("Error parsing JSON:", parseError); setTransferData(prev => ({ ...prev, [stationUic]: { loading: false, error: "Failed to parse API response.", departures: [] } })); }
        }
      } catch (fetchErr) {
        console.error("Network error fetching transfers:", fetchErr); const message = fetchErr instanceof Error ? fetchErr.message : "Network error."; setTransferData(prev => ({ ...prev, [stationUic]: { loading: false, error: message, departures: [] } }));
      }
    };

    if (!stops || stops.length === 0) return null;
    const now = getCurrentTime();
    const finalStop = stops[stops.length - 1];
    const finalArrivalEvent = finalStop?.arrivals[0];
    const finalArrivalTime = parseApiTime(finalArrivalEvent?.actualTime ?? finalArrivalEvent?.plannedTime);
    if (!finalArrivalTime || finalArrivalTime <= now) return null;

    let nextStopIndex = -1;
    for (let i = 0; i < stops.length; i++) {
      const stop = stops[i]; const arrivalEvent = stop.arrivals[0]; const departureEvent = stop.departures[0];
      const arrivalTime = parseApiTime(arrivalEvent?.actualTime ?? arrivalEvent?.plannedTime);
      const departureTime = parseApiTime(departureEvent?.actualTime ?? departureEvent?.plannedTime);
      if (arrivalTime && now < arrivalTime) { nextStopIndex = i; break; }
      else if (departureTime && arrivalTime && now >= arrivalTime && now < departureTime) { if (i + 1 < stops.length) { nextStopIndex = i + 1; } else { nextStopIndex = -1; } break; }
    }
    if (nextStopIndex === -1 || nextStopIndex >= stops.length) return null;
    const nextStop = stops[nextStopIndex];
    const upcomingStops = stops.slice(nextStopIndex + 1).filter(stop => stop.arrivals && stop.arrivals.length > 0);
    const toggleUpcomingTransferVisibility = (uic: string) => { setUpcomingTransfersVisible(prev => ({ ...prev, [uic]: !prev[uic] })); };

    const StopDisplay: React.FC<{ stop: Stop; isNextStop?: boolean; isFinalDestination: boolean; }> = ({ stop, isNextStop = false, isFinalDestination }) => {
        const uic = stop.stop.uicCode;
        const relevantEvent = isFinalDestination || !isNextStop ? stop.arrivals[0] : stop.departures[0] || stop.arrivals[0];
        if (!relevantEvent) return null;
        const plannedTime = formatTime(relevantEvent.plannedTime);
        const actualTime = relevantEvent.actualTime ? formatTime(relevantEvent.actualTime) : plannedTime;
        const delayMinutes = calculateDelay(relevantEvent.plannedTime, relevantEvent.actualTime ?? relevantEvent.plannedTime);
        const track = relevantEvent.actualTrack || relevantEvent.plannedTrack;
        const isCancelled = relevantEvent.cancelled;
        const isVisible = uic ? !!upcomingTransfersVisible[uic] : false;
        const transferInfo = uic ? transferData[uic] : undefined;
        const handleToggleClick = () => {
            if (!uic) return; toggleUpcomingTransferVisibility(uic);
            const fetchBaseTime = stop.arrivals[0]?.actualTime ?? stop.arrivals[0]?.plannedTime;
            if (!isVisible && !transferInfo?.departures && !transferInfo?.loading && fetchBaseTime) { fetchTransfers(uic, fetchBaseTime); }
        };
        const plannedTimeColor = isCancelled ? 'text-red-400/80 dark:text-red-500/80' : 'text-blue-500 dark:text-blue-400';
        const actualTimeColor = 'text-red-500 dark:text-red-400';
        const stationNameColor = isCancelled ? 'text-gray-400 dark:text-gray-500' : 'text-gray-100 dark:text-gray-100';
        const platformColorClasses = relevantEvent.actualTrack && relevantEvent.plannedTrack && relevantEvent.actualTrack !== relevantEvent.plannedTrack ? 'border-red-600 text-red-600 dark:border-red-500 dark:text-red-500' : 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400';
        const containerPadding = isNextStop ? `p-4 sm:p-6` : `p-3`; const timeRowTextSize = isNextStop ? `text-base sm:text-2xl` : `text-sm`; const timeRowMargin = isNextStop ? `mb-1.5 sm:mb-3` : `mb-1`; const platformSize = isNextStop ? `w-8 h-8 sm:w-12 sm:h-12` : `w-6 h-6`; const platformTextSize = isNextStop ? `text-sm sm:text-xl` : `text-xs`; const platformMargin = isNextStop ? `mr-3 sm:mr-4` : `mr-2`; const stationNameSize = isNextStop ? `text-lg sm:text-3xl` : `text-base`; const stationNameWeight = isNextStop ? 'font-bold' : 'font-medium'; const buttonPadding = isNextStop ? `py-1.5 px-4 sm:py-2.5 sm:px-6` : `py-1 px-3`; const buttonTextSize = isNextStop ? `text-base sm:text-xl` : `text-sm`;
        return (
             <div className={`${containerPadding} rounded-md ${isCancelled ? 'bg-gray-700/50 opacity-70' : 'bg-gray-800 dark:bg-slate-800'} ${uic ? 'cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50' : ''}`} onClick={uic ? handleToggleClick : undefined} role={uic ? "button" : undefined} tabIndex={uic ? 0 : undefined} onKeyDown={uic ? (e) => { if (e.key === 'Enter' || e.key === ' ') handleToggleClick(); } : undefined}>
                <div className={`flex items-center ${timeRowTextSize} ${timeRowMargin}`}>
                    <span className={`font-semibold ${plannedTimeColor} ${ (isCancelled || delayMinutes > 0) ? 'line-through' : '' }`}>{plannedTime}</span>
                    {delayMinutes > 0 && !isCancelled && (<span className={`ml-2 font-semibold ${actualTimeColor}`}>{actualTime}</span>)}
                    {delayMinutes > 0 && !isCancelled && (<span className={`ml-1 font-medium text-xs ${actualTimeColor}`}>(+{delayMinutes})</span>)}
                    {isCancelled && (<span className="ml-2 px-1.5 py-0.5 bg-red-600 text-white text-xs font-semibold rounded">Cancelled</span>)}
                </div>
                <div className={`flex items-center ${!isNextStop ? 'justify-between' : ''}`}>
                    <div className="flex items-center">
                        <span className={`flex items-center justify-center ${platformSize} rounded border ${platformTextSize} font-semibold ${platformMargin} ${platformColorClasses}`}>{track ?? '?'}</span>
                        <span className={`${stationNameWeight} ${stationNameSize} ${stationNameColor} ${isCancelled ? 'line-through' : ''}`}>{stop.stop.name}</span>
                    </div>
                    {!isNextStop && uic && (<button onClick={(e) => { e.stopPropagation(); handleToggleClick(); }} disabled={transferInfo?.loading} className={`flex items-center ${buttonTextSize} ${buttonPadding} rounded bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-blue-500`} aria-label={`${isVisible ? 'Hide' : 'Show'} transfers for ${stop.stop.name.replace("'", "&apos;")}`} aria-expanded={isVisible}>{transferInfo?.loading ? 'Loading...' : 'Transfers'}<motion.div animate={{ rotate: isVisible ? 180 : 0 }} transition={{ duration: 0.2 }} className="ml-1.5"><FaChevronDown className="h-3 w-3" /></motion.div></button>)}
                </div>
                {isNextStop && uic && (<button onClick={(e) => { e.stopPropagation(); handleToggleClick(); }} disabled={transferInfo?.loading} className={`flex items-center justify-center w-full mt-4 ${buttonTextSize} ${buttonPadding} rounded bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-blue-500`} aria-label={`${isVisible ? 'Hide' : 'Show'} transfers for ${stop.stop.name.replace("'", "&apos;")}`} aria-expanded={isVisible}>{transferInfo?.loading ? 'Loading...' : 'Transfers'}<motion.div animate={{ rotate: isVisible ? 180 : 0 }} transition={{ duration: 0.2 }} className="ml-1.5"><FaChevronDown className="h-3 w-3" /></motion.div></button>)}
                <AnimatePresence initial={false}>
                    {isVisible && uic && (
                        <motion.div key={`transfer-${uic}`} initial="collapsed" animate="open" exit="collapsed" variants={{ open: { opacity: 1, height: 'auto', marginTop: '12px' }, collapsed: { opacity: 0, height: 0, marginTop: '0px' } }} transition={{ duration: 0.3, ease: [0.04, 0.62, 0.23, 0.98] }} className="overflow-hidden border-t border-gray-600 dark:border-gray-700 pt-3 mt-3">
                            <div onClick={(e) => e.stopPropagation()}>
                                {transferInfo?.error && (<p className="text-xs text-red-400 dark:text-red-400 italic py-1">{transferInfo.error}</p>)}
                                {!transferInfo?.error && !transferInfo?.loading && transferInfo?.departures.length === 0 && ( (() => { const plannedArrivalTimeString = stop.arrivals[0]?.plannedTime ?? relevantEvent.plannedTime; const plannedArrivalTime = parseApiTime(plannedArrivalTimeString); const now = getCurrentTime(); const ninetyMinutesInMillis = 90 * 60 * 1000; if (plannedArrivalTime && plannedArrivalTime.getTime() > now.getTime() + ninetyMinutesInMillis) { return <p className="text-xs text-gray-400 dark:text-gray-400 italic py-1">Transfers only become visible 90 minutes before arrival.</p>; } else { return <p className="text-xs text-gray-400 dark:text-gray-400 italic py-1">No departures found.</p>; } })() )}
                                {transferInfo?.departures && transferInfo.departures.length > 0 && (<DepartureList journeys={transferInfo.departures} listType="departures" currentStationUic={uic} selectedTrainTypes={[]} selectedDestinations={[]} />)}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        );
    };

    if (!summary) return null;
    let isNextJourney = false; const originDepartureTime = parseApiTime(summary.departureEvent?.plannedTime); if (originDepartureTime && originDepartureTime > now) { isNextJourney = true; }

    // Check if this journey is currently pinned
    const isCurrentlyPinned = pinnedJourney?.trainNumber === summary.journeyNumber &&
                             pinnedJourney?.plannedDepartureTime === summary.plannedDepartureTime;

    return (
      <div className="mb-4">
        <h2 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-200">{isNextJourney ? 'Next Journey' : 'Current Journey'}</h2>
        <div className="border rounded-md shadow-sm dark:bg-gray-800 dark:border-gray-700 overflow-hidden">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/30 relative"> {/* Added relative positioning for pin button */}
                {/* Pin Button for Journey Header */}
                <button
                    onClick={handlePinClick}
                    className={`p-1.5 rounded hover:bg-gray-300 dark:hover:bg-blue-800/50 absolute top-2 right-2 z-10 ${isCurrentlyPinned ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`}
                    aria-label={isCurrentlyPinned ? "Unpin Journey" : "Pin Journey"}
                    title={isCurrentlyPinned ? "Unpin Journey" : "Pin Journey"}
                >
                    <FaThumbtack size={18} className={isCurrentlyPinned ? 'fill-current' : ''} />
                </button>

                <div className="flex-grow text-left space-y-1">
                    <div>
                        <div className="flex items-center">
                            <span className={`font-semibold text-lg ${summary.isJourneyCancelled ? 'line-through text-red-700/80 dark:text-red-500/80' : 'text-gray-800 dark:text-gray-200'}`}>{summary.originStationName}</span>
                            <span className={`ml-3 text-lg font-semibold ${ (summary.isJourneyCancelled || summary.departureDelayMinutes > 0) ? 'line-through' : '' } ${ summary.isJourneyCancelled ? 'text-red-600/80 dark:text-red-400/80' : 'text-blue-800 dark:text-blue-300' }`}>{summary.departurePlannedTimeFormatted}</span>
                            {summary.departureDelayMinutes > 0 && !summary.isJourneyCancelled && (<span className="ml-1.5 text-lg font-semibold text-red-600 dark:text-red-400">{summary.departureActualTimeFormatted}</span>)}
                            {summary.departureDelayMinutes > 0 && !summary.isJourneyCancelled && (<span className="ml-1 text-sm font-medium text-red-600 dark:text-red-400">(+{summary.departureDelayMinutes} min)</span>)}
                        </div>
                        <div className="flex my-1"><FaArrowDown className="text-gray-400 dark:text-gray-500" /></div>
                        <div className="flex items-center">
                            <span className={`font-semibold text-lg ${summary.isJourneyCancelled ? 'line-through text-red-700/80 dark:text-red-500/80' : 'text-gray-800 dark:text-gray-200'}`}>{summary.finalDestinationName}</span>
                            <span className={`ml-3 text-lg font-semibold ${ (summary.isJourneyCancelled || summary.arrivalDelayMinutes > 0) ? 'line-through' : '' } ${ summary.isJourneyCancelled ? 'text-red-600/80 dark:text-red-400/80' : 'text-blue-800 dark:text-blue-300' }`}>{summary.arrivalPlannedTimeFormatted}</span>
                            {summary.arrivalDelayMinutes > 0 && !summary.isJourneyCancelled && (<span className="ml-1.5 text-lg font-semibold text-red-600 dark:text-red-400">{summary.arrivalActualTimeFormatted}</span>)}
                            {summary.arrivalDelayMinutes > 0 && !summary.isJourneyCancelled && (<span className="ml-1 text-sm font-medium text-red-600 dark:text-red-400">(+{summary.arrivalDelayMinutes} min)</span>)}
                        </div>
                        <div className="pt-1">
                            {summary.isJourneyCancelled ? (<span className="px-2 py-0.5 bg-red-600 text-white text-sm font-semibold rounded">Cancelled</span>)
                            : (<span className="text-sm text-gray-500 dark:text-gray-400">{summary.operatorName} {summary.journeyCategory} {summary.journeyNumber}</span>)}
                        </div>
                    </div>
                </div>
            </div>
            <div className="p-4 space-y-3 bg-white dark:bg-slate-900">
                {nextStop && (
                    <div>
                        <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-1">Next Station:</h3>
                        <StopDisplay stop={nextStop} isNextStop={true} isFinalDestination={nextStopIndex === (stops.length - 1)} />
                    </div>
                )}
                {upcomingStops.length > 0 && (
                    <div>
                        <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-1">Upcoming Stops:</h3>
                        <ul className="space-y-2">
                            {upcomingStops.map((stop) => (<li key={stop.id}><StopDisplay stop={stop} isFinalDestination={stop.status === 'DESTINATION'} /></li>))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
      </div>
    );
  };
  // --- End Current Journey Section Component Definition ---

  const notInServiceImageUrl = isNotInService ? getSpecialLiveryImageUrl(materieelnummer) : null;
  const notInServiceLiveryName = isNotInService ? getSpecialLiveryName(materieelnummer) : null;

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <input type="text" value={materieelnummer} onChange={handleInputChange} placeholder="Enter Materieelnummer (e.g., 4011)" className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500 flex-grow" onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
        <button onClick={handleSearch} disabled={isLoading} className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50">{isLoading ? 'Searching...' : 'Search'}</button>
      </div>
      {error && !isNotInService && (<div className="bg-red-600 text-white font-bold p-3 rounded-md mb-4 text-center">{error}</div>)}
      {isLoading && <p>Loading train details...</p>}
      {!isLoading && !error && !isNotInService && stops.length === 0 && !materieelnummer && (<p>Enter a materieelnummer above to see its details.</p>)}
      {!isLoading && notes.length > 0 && (
        <div className="mb-4 p-3 border border-yellow-400 bg-yellow-50 dark:bg-yellow-900/30 dark:border-yellow-600 rounded-md shadow-sm">
          <h3 className="text-lg font-semibold mb-2 text-yellow-800 dark:text-yellow-300 flex items-center"><FaExclamationTriangle className="mr-2" aria-hidden="true" />Important Information</h3>
          <ul className="list-disc list-inside space-y-1 text-yellow-700 dark:text-yellow-200">{notes.map((note, index) => <li key={note.id ?? `note-${index}`}>{note.text}</li>)}</ul>
        </div>
      )}
      {!isLoading && !error && (summary || isNotInService) && (
        <div className="border rounded-md shadow-sm bg-white dark:bg-gray-800 dark:border-gray-700 overflow-hidden mb-4 p-4">
           <h2 className="text-xl font-semibold mb-3 text-gray-800 dark:text-gray-200">Train Information</h2>
           <div className="flex flex-col items-center gap-4">
              {(summary?.displayImageUrl || notInServiceImageUrl) && (
                 <div className="w-full mb-3">
                    <Image src={summary?.displayImageUrl || notInServiceImageUrl!} alt={summary?.displayImageAlt || notInServiceLiveryName || `Train ${materieelnummer}`} title={summary?.displayImageAlt || notInServiceLiveryName || `Train ${materieelnummer}`} quality={80} unoptimized={true} layout="responsive" width={16} height={9} className="w-full h-auto object-contain rounded" />
                 </div>
              )}
              <div className="flex-grow space-y-1 text-sm w-full">
                 <p><span className="font-semibold text-gray-700 dark:text-gray-300">{summary ? 'Type:' : 'Number:'}</span>{' '}<span className="text-gray-600 dark:text-gray-400">{summary ? summary.trainType : ''} {summary?.stockIdentifier && summary.stockIdentifier !== '0' ? `(${summary.stockIdentifier})` : `(${materieelnummer})`}</span></p>
                 {summary && ( <> {summary.numberOfParts !== undefined && (<p><span className="font-semibold text-gray-700 dark:text-gray-300">Length:</span>{' '}<span className="text-gray-600 dark:text-gray-400">{summary.numberOfParts} parts</span></p>)} {summary.numberOfSeats !== undefined && (<p><span className="font-semibold text-gray-700 dark:text-gray-300">Seats:</span>{' '}<span className="text-gray-600 dark:text-gray-400">{summary.numberOfSeats}</span></p>)} {summary.facilities && summary.facilities.length > 0 && (<p><span className="font-semibold text-gray-700 dark:text-gray-300">Facilities:</span>{' '}<span className="text-gray-600 dark:text-gray-400 capitalize">{summary.facilities.map(f => f.toLowerCase().replace(/_/g, ' ')).join(', ')}</span></p>)} </> )}
                 {(summary?.specialLiveryName || notInServiceLiveryName) && (<p className="pt-1"><span className="inline-flex items-center px-1.5 py-0.5 bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 rounded text-xs font-medium"><FaStar className="mr-1 h-3 w-3" aria-hidden="true" />{summary?.specialLiveryName || notInServiceLiveryName}</span></p>)}
                 {isNotInService && (<p className="pt-1 text-sm font-medium text-orange-600 dark:text-orange-400">Not currently in service.</p>)}
              </div>
           </div>
        </div>
      )}
      {!isLoading && !error && !isNotInService && stops.length > 0 && summary && (<CurrentJourneySection stops={stops} summary={summary} />)}
    </div>
  );
}