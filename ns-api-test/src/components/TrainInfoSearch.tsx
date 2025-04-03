'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { FaStar, FaChevronDown, FaArrowDown } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter, useSearchParams, usePathname } from 'next/navigation'; // Import hooks
import { formatTime, calculateDelay } from '../lib/utils';
import { getSpecialLiveryName, getSpecialLiveryImageUrl } from '../lib/specialLiveries';

// --- Types ---
interface StationInfo { name: string; lng: number; lat: number; countryCode: string; uicCode: string; }
interface Product { number: string; categoryCode: string; shortCategoryName: string; longCategoryName: string; operatorCode: string; operatorName: string; type: string; }
interface ArrivalDeparture { product: Product; origin: StationInfo; destination: StationInfo; plannedTime: string; actualTime?: string; delayInSeconds?: number; plannedTrack?: string; actualTrack?: string; cancelled: boolean; punctuality?: number; crowdForecast?: string; stockIdentifiers?: string[]; }
interface TrainPart { stockIdentifier: string; destination?: StationInfo; facilities: string[]; image?: { uri: string }; }
interface StockInfo { trainType: string; numberOfSeats: number; numberOfParts: number; trainParts: TrainPart[]; hasSignificantChange: boolean; }
interface Stop { id: string; stop: StationInfo; previousStopId: string[]; nextStopId: string[]; destination?: string; status: string; arrivals: ArrivalDeparture[]; departures: ArrivalDeparture[]; actualStock?: StockInfo; plannedStock?: StockInfo; platformFeatures?: any[]; coachCrowdForecast?: any[]; }
// --- End Types ---

export default function TrainInfoSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Initialize state from URL param or empty
  const initialMNumFromUrl = searchParams.get('materieelnummer') || '';
  const [materieelnummer, setMaterieelnummer] = useState(initialMNumFromUrl);

  const [stops, setStops] = useState<Stop[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);

  // Function to perform the actual API fetch
  const performSearch = useCallback(async (mNum: string) => {
    if (!mNum) {
        setStops([]);
        setError(null);
        return;
    }
    setIsLoading(true);
    setError(null);
    setStops([]);
    setIsExpanded(true);

    try {
      const response = await fetch(`/api/train-info/${mNum}`);
      if (!response.ok) {
        let errorMsg = `Error: ${response.status} ${response.statusText}`;
        try {
            const errorData = await response.json();
            errorMsg = errorData.error || errorMsg;
        } catch (jsonError) {
            console.error("Failed to parse error JSON:", jsonError);
        }
         setError(errorMsg);
         return;
      }
      const fetchedStops: Stop[] = await response.json();
      setStops(fetchedStops);
      if (fetchedStops.length === 0) {
           setError(`No stops found for the journey associated with materieelnummer ${mNum} today.`);
       }
    } catch (err: any) {
      console.error('Error fetching train info:', err);
      setError(err.message || 'An unknown error occurred while fetching train information.');
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
      }
  };

  // Effect to perform search when URL parameter changes (e.g., on initial load or back/forward)
  useEffect(() => {
    const mNumFromUrl = searchParams.get('materieelnummer');
    if (mNumFromUrl) {
        // Only update state and search if the URL param differs from current input state
        // to avoid redundant searches when we update the URL ourselves in handleSearch/handleInputChange
        if (mNumFromUrl !== materieelnummer) {
            setMaterieelnummer(mNumFromUrl);
            performSearch(mNumFromUrl);
        }
    } else {
        // If URL param is removed (e.g., by clearing input), clear results
        if (materieelnummer !== '') {
            setMaterieelnummer('');
            setStops([]);
            setError(null);
        }
    }
    // Dependency array includes searchParams to react to URL changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);


  // Helper function to extract summary data for the header
  const getJourneySummary = () => {
    if (!stops || stops.length === 0) return null;
    const originStop = stops.find(s => s.status === 'ORIGIN') || stops[0];
    const destinationStop = stops.find(s => s.status === 'DESTINATION') || stops[stops.length - 1];
    const departureEvent = originStop?.departures[0];
    const arrivalEvent = destinationStop?.arrivals[0];
    if (!departureEvent) return null;

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
    };
  };

  const summary = getJourneySummary();

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

      {/* Error Display */}
      {error && (
        <div className="bg-red-600 text-white font-bold p-3 rounded-md mb-4 text-center">
          {error}
        </div>
      )}

      {/* Loading State */}
      {isLoading && <p>Loading journey details...</p>}

      {/* Initial Prompt */}
      {!isLoading && !error && stops.length === 0 && !materieelnummer && (
         <p>Enter a materieelnummer above to see its journey details.</p>
      )}

      {/* Journey Card Display */}
      {!isLoading && !error && stops.length > 0 && summary && (
        <div className="border rounded-md shadow-sm bg-white dark:bg-gray-800 dark:border-gray-700 overflow-hidden">
          {/* Card Header - Clickable */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex justify-between items-start w-full p-4 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
            aria-expanded={isExpanded}
          >
            {/* Left Column: Origin/Dest + Times */}
            <div className="flex-grow mr-4 text-left space-y-1">
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
                              </div>
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
                                    <div key={part.stockIdentifier || partIndex} className="mb-1 last:mb-0">
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
        </div>
      )}
    </div>
  );
}