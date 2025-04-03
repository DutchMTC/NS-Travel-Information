"use client"; // This component needs client-side interactivity

import { useState } from 'react'; // Import useState
import { motion, AnimatePresence } from 'framer-motion'; // Import AnimatePresence
import { Journey, TrainUnit, DepartureMessage } from '../lib/ns-api'; // Import Journey instead of Departure
import { FaLongArrowAltRight, FaStar } from 'react-icons/fa'; // Added FaStar
import { FiAlertTriangle } from 'react-icons/fi'; // Import warning icon
import Image from 'next/image'; // Import next/image
import { formatTime, calculateDelay } from '../lib/utils'; // Import helpers
import { stations } from '../lib/stations'; // Import stations data
import { getSpecialLiveryName, getSpecialLiveryImageUrl } from '../lib/specialLiveries'; // Import special livery data and image getter


// Define the props type, including the composition data
// This interface is now defined in StationJourneyDisplay.tsx
// We expect the journeys prop to already have this shape.
// interface JourneyWithComposition extends Journey {
//   composition: { length: number; parts: TrainUnit[]; destination?: string } | null;
// }

// Define the expected shape of the data received from StationJourneyDisplay
// which matches the response from the internal API route
interface JourneyWithDetails extends Journey {
  // Composition parts might have individual destinations (eindbestemming)
  composition: { length: number; parts: TrainUnit[]; destination?: string } | null;
  finalDestination?: string | null; // Destination fetched separately
}

// Interface for a single arrival or departure event at a stop
interface StopEvent {
    plannedTime: string; // ISO 8601 format
    actualTime?: string;  // ISO 8601 format (optional)
    delayInSeconds?: number;
    cancelled?: boolean;
    plannedTrack?: string; // Added planned track
    actualTrack?: string;  // Added actual track
    // Add other potential fields if needed
}

// Updated interface for the overall stop information (matching API route)
interface JourneyStop {
    id: string;
    stop: {
        name: string;
        uicCode: string;
        // Add other fields if needed from the API response
    };
    arrivals: StopEvent[];   // Array of arrival events (usually just one)
    departures: StopEvent[]; // Array of departure events (usually just one)
    // Add other potential fields like status if needed
}


interface JourneyListProps {
  journeys: JourneyWithDetails[]; // Use the updated type
  listType: 'departures' | 'arrivals'; // Add type to distinguish list content
  currentStationUic: string; // Add prop for the current station's UIC code
}

// Animation variants
const listVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08, // Stagger animation for each item
    },
  }, // <-- Missing closing brace was here
};

const itemVariants = {
  hidden: { y: 15, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      type: 'spring',
      stiffness: 120,
      damping: 15,
    },
  },
};

const detailsVariants = {
  hidden: { opacity: 0, height: 0 },
  visible: {
    opacity: 1,
    height: 'auto',
    transition: { duration: 0.3, ease: "easeInOut" }
  },
  exit: {
    opacity: 0,
    height: 0,
    transition: { duration: 0.2, ease: "easeInOut" }
   }
};


// Create a lookup map for station codes to names for efficient access
// Create a lookup map for station codes (converted to uppercase) to names
const stationCodeToNameMap = new Map(stations.map(s => [s.code.toUpperCase(), s.name]));

export default function JourneyList({ journeys, listType, currentStationUic }: JourneyListProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [stopsData, setStopsData] = useState<Record<string, JourneyStop[]>>({}); // Cache for stops
  const [loadingStops, setLoadingStops] = useState<boolean>(false);
  const [errorStops, setErrorStops] = useState<string | null>(null);

  const handleToggle = async (index: number, trainNumber: string) => {
    const isOpening = expandedIndex !== index;
    setExpandedIndex(isOpening ? index : null); // Toggle expansion

    // If opening and stops not already fetched for this train
    if (isOpening && !stopsData[trainNumber]) {
      setLoadingStops(true);
      setErrorStops(null);
      try {
        const response = await fetch(`/api/journey-stops/${trainNumber}`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to fetch stops (${response.status})`);
        }
        const stops: JourneyStop[] = await response.json();
        // console.log(`[DEBUG] Fetched stops data for train ${trainNumber}:`, stops); // Removed debug log
        setStopsData(prev => ({ ...prev, [trainNumber]: stops }));
      } catch (err) {
        console.error("Error fetching journey stops:", err);
        setErrorStops(err instanceof Error ? err.message : "Could not load stops.");
        // Optionally collapse on error: setExpandedIndex(null);
      } finally {
        setLoadingStops(false);
      }
    } else if (!isOpening) {
        // Clear loading/error when collapsing
        setLoadingStops(false);
        setErrorStops(null);
    }
  };

  return (
    <motion.ul
      className="divide-y divide-gray-200 dark:divide-gray-700" // Added dark mode divider
      variants={listVariants}
      initial="hidden"
      animate="visible"
    >
      {journeys.map((journey, index) => { // Add index back
        // Use journey instead of dep
        const delayMinutes = calculateDelay(journey.plannedDateTime, journey.actualDateTime);
        const plannedTimeFormatted = formatTime(journey.plannedDateTime);
        const actualTimeFormatted = formatTime(journey.actualDateTime); // Format actual time
        const isExpanded = index === expandedIndex;
        const trainNumber = journey.product.number; // Get train number for fetching stops

        // Check for shortened journey warning
        let shortenedDestination = null;
        const warningMessagePrefix = "Rijdt niet verder dan ";
        const warningMessage = journey.messages?.find(msg =>
          msg.message.startsWith(warningMessagePrefix) && msg.style === 'WARNING'
        );

        if (warningMessage) {
          // Extract station name, removing brackets and anything after " door "
          let extractedName = warningMessage.message.substring(warningMessagePrefix.length).replace(/\[|\]/g, '');
          const doorIndex = extractedName.indexOf(" door ");
          if (doorIndex !== -1) {
            extractedName = extractedName.substring(0, doorIndex).trim();
          }
          shortenedDestination = extractedName;
        }

        return (
          <motion.li
            key={journey.plannedDateTime + '-' + journey.product.number} // Use more stable key
            className={`p-4 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer ${journey.cancelled ? 'bg-red-50 dark:bg-red-900/30' : ''}`} // Added dark mode hover/cancelled bg
            variants={itemVariants}
            onClick={() => handleToggle(index, trainNumber)} // Add onClick handler
          >
            {/* Main Info Row */}
            <div className="flex justify-between items-start mb-2">
              {/* Left Column: Time/Delay + Destination/Type */}
              <div className="flex-grow mr-4">
                {/* Time + Delay */}
                <div className="flex items-center flex-wrap mb-1"> {/* Added flex-wrap */}
                  {/* Planned Time (strikethrough if cancelled OR delayed) */}
                  <span className={`text-lg font-semibold ${ (journey.cancelled || delayMinutes > 0) ? 'line-through' : '' } ${ journey.cancelled ? 'text-red-600 dark:text-red-400' : 'text-blue-800 dark:text-blue-300' } mr-2`}>
                    {plannedTimeFormatted}
                  </span>

                  {/* Actual Time (only if delayed and not cancelled) */}
                  {delayMinutes > 0 && !journey.cancelled && (
                    <span className="text-lg font-semibold text-red-600 dark:text-red-400 mr-2">
                      {actualTimeFormatted}
                    </span>
                  )}

                  {/* Delay amount (only if delayed and not cancelled) */}
                  {delayMinutes > 0 && !journey.cancelled && (
                     <span className="text-sm font-medium text-red-600 dark:text-red-400">
                       (+{delayMinutes} min)
                     </span>
                  )}
                  {/* Show Cancelled box if cancelled */}
                  {journey.cancelled && (
                    <span className="ml-2 px-2 py-0.5 bg-red-600 text-white text-sm font-semibold rounded">
                      Cancelled
                    </span>
                  )}
                </div>
                {/* Origin/Destination + Type */}
                <div> {/* Container for Dest + Type */}
                  {/* Conditional rendering for Arrivals vs Departures */}
                  {listType === 'arrivals' ? (
                    <div className={`flex items-center flex-wrap ${journey.cancelled ? 'text-red-700 dark:text-red-500' : ''}`}>
                      {/* From Station */}
                      <span className={`bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm font-medium mr-2 px-2.5 py-0.5 rounded ${journey.cancelled ? 'line-through' : ''}`}>
                        From: {journey.origin}
                      </span>

                      {/* Arrow */}
                      <FaLongArrowAltRight className={`text-gray-500 dark:text-gray-400 mx-1 self-center ${journey.cancelled ? 'line-through' : ''}`} />

                      {/* To Station - Conditional based on shortened journey OR destination change */}
                      {shortenedDestination ? (
                        // Journey is shortened ("Rijdt niet verder dan")
                        <>
                          <span className={`bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm font-medium mr-1 px-2.5 py-0.5 rounded line-through ${journey.cancelled ? 'opacity-70' : ''}`}>
                            {/* Show original intended destination if available */}
                            To: {journey.finalDestination ?? journey.composition?.destination ?? 'Unknown'}
                          </span>
                          <span className={`bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 text-sm font-medium mr-2 px-2.5 py-0.5 rounded ${journey.cancelled ? 'line-through' : ''}`}>
                            (Ends at: {shortenedDestination}) {/* Actual end station */}
                          </span>
                        </>
                      ) : journey.finalDestination && journey.composition?.destination && journey.finalDestination !== journey.composition.destination ? (
                        // Destination Changed (final vs composition)
                        <>
                          <span className={`bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm font-medium mr-1 px-2.5 py-0.5 rounded line-through ${journey.cancelled ? 'opacity-70' : ''}`}>
                            To: {journey.composition.destination} {/* Original Destination from Composition */}
                          </span>
                          <span className={`bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 text-sm font-medium mr-2 px-2.5 py-0.5 rounded ${journey.cancelled ? 'line-through' : ''}`}>
                            (Now: {journey.finalDestination}) {/* New Destination from Journey Details */}
                          </span>
                        </>
                      ) : (
                        // Destination Not Changed (or data missing/mismatch)
                        <span className={`bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm font-medium mr-2 px-2.5 py-0.5 rounded ${journey.cancelled ? 'line-through' : ''}`}>
                          {/* Show finalDestination if available, fallback to composition destination, then Unknown */}
                          To: {journey.finalDestination ?? journey.composition?.destination ?? 'Unknown'}
                        </span>
                      )}

                      {/* Train Type */}
                      <span className={`text-base ml-1 ${journey.cancelled ? 'line-through text-red-700 dark:text-red-500' : 'text-gray-500 dark:text-gray-400'}`}>
                         ({journey.product.shortCategoryName})
                      </span>
                    </div>
                  ) : (
                    <div> {/* Container for Departure Direction + Type */}
                      {shortenedDestination ? (
                        <>
                          {/* Original destination with strikethrough */}
                          <span className={`font-medium text-lg line-through ${journey.cancelled ? 'text-red-700 dark:text-red-500' : 'text-gray-800 dark:text-gray-200'}`}>
                            {journey.direction}
                          </span>
                          {/* New destination in red */}
                          <span className="font-medium text-lg text-red-600 dark:text-red-400 ml-2">
                            {shortenedDestination}
                          </span>
                        </>
                      ) : (
                        /* Normal destination */
                        <span className={`font-medium text-lg ${journey.cancelled ? 'line-through text-red-700 dark:text-red-500' : 'text-gray-800 dark:text-gray-200'}`}>
                          {journey.direction}
                        </span>
                      )}
                      {/* Train Type */}
                      <span className={`text-base ml-2 ${journey.cancelled ? 'text-red-700 dark:text-red-500' : 'text-gray-500 dark:text-gray-400'}`}>
                        ({journey.product.shortCategoryName})
                      </span>
                    </div>
                  )}
                </div>
              </div>
              {/* Right Column: Track Square */}
              <span className={`flex items-center justify-center w-12 h-12 rounded border text-base font-semibold flex-shrink-0 ${
                journey.actualTrack && journey.plannedTrack && journey.actualTrack !== journey.plannedTrack
                  ? 'border-red-600 text-red-600 dark:border-red-500 dark:text-red-500' // Dark mode track change
                  : 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400' // Dark mode normal track
              }`}>
                {journey.actualTrack ?? journey.plannedTrack ?? '?'}
              </span>
            </div>

            {/* Composition Details - No longer expandable */}
            {/* Display Length above images */}
            {journey.composition && (
              <div className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                <strong>Length:</strong> {journey.composition.length}
              </div>
            )}

            {/* Train Part Images (Moved outside expandable section, always visible) */}
            {journey.composition?.parts && journey.composition.parts.some(p => p.afbeelding) && (
               <div className="mt-1"> {/* Adjusted margin */}
                 {journey.composition.parts.map((part, partIndex) => { // Removed arr from map args
                   const partDestinationCode = part.eindbestemming;
                   const partDestinationName = partDestinationCode ? stationCodeToNameMap.get(partDestinationCode) : undefined;

                   // Determine the overall journey destination name
                   const overallDestinationName = listType === 'departures' ? journey.direction : journey.finalDestination;

                   // Check if the part destination exists and is different from the overall destination
                   const showPartDestinationBox = partDestinationName && partDestinationName !== overallDestinationName;

                   // Revert to previous styling: conditional background/padding, mb-2, full rounding
                   return (
                     <div
                       key={part.materieelnummer || partIndex}
                       // Apply padding and background to all parts, changing color based on destination difference
                       className={`mb-2 p-2 rounded ${journey.cancelled ? 'bg-red-50 dark:bg-red-900/30' : showPartDestinationBox ? 'bg-red-50 dark:bg-red-900/30' : 'bg-gray-100 dark:bg-gray-700'}`}
                     >
                       {/* Image - Prioritize custom livery image */}
                       {(() => {
                         const customImageUrl = part.materieelnummer ? getSpecialLiveryImageUrl(part.materieelnummer.toString()) : undefined;
                         const imageUrl = customImageUrl || part.afbeelding; // Use custom if available, else API image
                         const imageAlt = part.materieelnummer ? getSpecialLiveryName(part.materieelnummer.toString()) || part.type : part.type; // Use livery name for alt if available

                         return imageUrl ? (
                           <Image src={imageUrl} alt={imageAlt} title={imageAlt} width={300} height={84} quality={100} unoptimized={true} className="h-7 w-auto object-contain" />
                         ) : (
                           <div className="h-7 flex items-center justify-center text-gray-400 dark:text-gray-500 text-xs italic">(No image)</div> // Adjusted height to match image
                         );
                       })()}
                       {/* Type, Number, and optional Destination Warning */}
                       <div className="flex items-center text-xs text-left text-gray-600 dark:text-gray-400 mt-0.5 flex-wrap"> {/* Added flex-wrap */}
                         {/* Type, Number, and Livery */}
                         <span>
                           {part.type} ({ part.materieelnummer == null ? 'N/A' : (part.materieelnummer === 0 ? 'Unknown' : part.materieelnummer) }) {/* Handle null/undefined, 0, and other numbers */}
                           {part.materieelnummer && getSpecialLiveryName(part.materieelnummer.toString()) && (
                             <span className="inline-flex items-center ml-1 px-1.5 py-0.5 bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 rounded text-xs font-medium"> {/* Added inline-flex and items-center */}
                               <FaStar className="mr-1" aria-hidden="true" />
                               {getSpecialLiveryName(part.materieelnummer.toString())} {/* Safe to call here as it's inside the conditional */}
                             </span>
                           )}
                         </span>
                         {/* Display part-specific destination info inline if conditions met */}
                         {showPartDestinationBox && (
                           <div className="flex items-center ml-2"> {/* Use ml-2 for spacing */}
                             <FiAlertTriangle className="text-red-600 dark:text-red-400 mr-1 flex-shrink-0" aria-hidden="true" /> {/* Added flex-shrink-0 */}
                             <span className="font-medium text-red-600 dark:text-red-400"> {/* Changed p to span */}
                               {/* Display the translated name */}
                               This train part ends at {partDestinationName || partDestinationCode} {/* Fallback to code if name not found */}
                             </span>
                           </div>
                         )}
                       </div>
                     </div>
                   );
                 })}
               </div>
            )}

           {/* Removed the overall composition destination display */}

           {/* Messages Row (Always Visible) */}
            {/* Messages Row (Always Visible) - Restructured conditional rendering */}
            {(() => { // Wrap in IIFE to handle filtering logic cleanly
              // Filter out messages about specific train parts ending early, as this is shown on the part itself
              const messageRegex = /^Treinstel \d+ rijdt niet verder dan .*$/;
              const filteredMessages = journey.messages?.filter(msg => !messageRegex.test(msg.message)) ?? [];

              if (filteredMessages.length === 0) {
                return null; // Don't render the message box if no relevant messages remain
              }

              // Determine message box styling based on cancelled status or shortened destination (using original logic)
              let messageClasses = '';
              if (journey.cancelled) {
                messageClasses = 'bg-red-600 text-white'; // Style for fully cancelled
              } else if (shortenedDestination) {
                // Style for shortened journey warning (red) - This applies if the *overall* journey is shortened
                messageClasses = 'text-red-800 bg-red-50 border border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700/50';
              } else {
                // Default style for other warnings/messages (yellow)
                messageClasses = 'text-yellow-800 bg-yellow-50 border border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700/50';
              }

              return (
                <div className={`mt-2 text-sm rounded p-2 ${messageClasses}`}>
                  {/* Map over the filtered messages */}
                  {filteredMessages.map((msg: DepartureMessage, msgIndex: number) => (
                    <p key={msgIndex}>{msg.message}</p>
                  ))}
                </div>
              );
            })()}
            {/* --- Intermediate Stops Section --- */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  key="stops-details"
                  variants={detailsVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700 overflow-hidden" // Added styling and overflow hidden
                >
                  {loadingStops && <p className="text-sm text-gray-500 dark:text-gray-400 italic">Loading stops...</p>}
                  {errorStops && <p className="text-sm text-red-600 dark:text-red-400">Error: {errorStops}</p>}
                  {!loadingStops && !errorStops && stopsData[trainNumber] && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">Intermediate Stops:</h4>
                      {(() => {
                        const allStops = stopsData[trainNumber] || [];
                        // Find the index of the current station (case-insensitive comparison)
                        const currentStationUicUpper = currentStationUic.toUpperCase();
                        const currentStationIndex = allStops.findIndex(s => s.stop.uicCode?.toUpperCase() === currentStationUicUpper);

                        // Filter stops: only show those *after* the current station
                        // If current station not found (shouldn't happen often), show all stops for debugging? Or none? Let's show none for now.
                        const relevantStops = currentStationIndex !== -1
                          ? allStops.slice(currentStationIndex + 1)
                          : [];

                        // Filter relevantStops to only include those with actual arrival data (i.e., they are stopping points)
                        const stoppingRelevantStops = relevantStops.filter(stop => stop.arrivals && stop.arrivals.length > 0);

                        if (stoppingRelevantStops.length === 0) {
                          // Attempt to get the station name from the map
                          const currentStationName = stationCodeToNameMap.get(currentStationUicUpper);
                          // Display message with name if found, otherwise a generic message
                          return <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                            {currentStationName ? `${currentStationName} is the final destination of this train.` : 'This is the final destination of this train.'}
                          </p>;
                        }

                        // Return the list directly if there are stops
                        return (
                          <ul className="text-sm space-y-2">
                            {stoppingRelevantStops.map((stop) => {
                              // We know arrivalEvent exists because of the filter above
                              const arrivalEvent = stop.arrivals[0];
                              const plannedTime = arrivalEvent.plannedTime ? formatTime(arrivalEvent.plannedTime) : '--:--';
                              const actualTime = arrivalEvent.actualTime ? formatTime(arrivalEvent.actualTime) : null;
                              const delay = (arrivalEvent.plannedTime && arrivalEvent.actualTime)
                                ? calculateDelay(arrivalEvent.plannedTime, arrivalEvent.actualTime)
                                : 0;
                              const isCancelled = arrivalEvent.cancelled ?? false;

                              return (
                                <li key={stop.id} className={`flex flex-col p-2 rounded bg-gray-100 dark:bg-gray-700 ${isCancelled ? 'text-red-600 dark:text-red-400 opacity-70' : 'text-gray-700 dark:text-gray-300'}`}>
                                  {/* Top Row: Time Info Only */}
                                  <div className="flex items-center space-x-1 text-xs mb-0.5"> {/* Reduced margin-bottom */}
                                    {isCancelled ? (
                                      <span className="px-1.5 py-0.5 bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 rounded font-medium">Cancelled</span>
                                    ) : (
                                      <>
                                        <span className={`font-medium text-blue-700 dark:text-blue-400 ${delay > 0 ? 'line-through' : ''}`}>
                                          {plannedTime}
                                        </span>
                                        {actualTime && delay > 0 && (
                                          <span className="font-medium text-red-600 dark:text-red-400">{actualTime}</span>
                                        )}
                                        {delay > 0 && (
                                          <span className="font-medium text-red-600 dark:text-red-400">(+{delay})</span>
                                        )}
                                      </>
                                    )}
                                  </div>

                                  {/* Bottom Row: Track + Stop Name */}
                                  <div className="flex items-center space-x-2"> {/* New div for track and name */}
                                    {/* Track Info (only if not cancelled) */}
                                    {!isCancelled && (
                                      (() => {
                                        const plannedTrack = arrivalEvent.plannedTrack;
                                        const actualTrack = arrivalEvent.actualTrack;
                                        const displayTrack = actualTrack ?? plannedTrack ?? '?';
                                        const trackChanged = actualTrack && plannedTrack && actualTrack !== plannedTrack;

                                        return (
                                          <span className={`flex items-center justify-center w-6 h-6 rounded border text-xs font-semibold flex-shrink-0 ${
                                            trackChanged
                                              ? 'border-red-600 text-red-600 dark:border-red-500 dark:text-red-500'
                                              : 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                                          }`}>
                                            {displayTrack}
                                          </span>
                                        );
                                      })()
                                    )}
                                    {/* Stop Name */}
                                    <span className={`text-sm ${isCancelled ? 'line-through' : ''}`}>{stop.stop.name}</span>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        );
                      })()} {/* Invoke the IIFE here */}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
            {/* --- End Intermediate Stops Section --- */}
          </motion.li>
        );
      })}
    </motion.ul>
  );
}