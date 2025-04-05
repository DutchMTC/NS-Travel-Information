"use client"; // This component needs client-side interactivity

import { useState, useMemo } from 'react'; // Removed unused useEffect
import { motion, AnimatePresence } from 'framer-motion'; // Import AnimatePresence
import { Journey, TrainUnit, DepartureMessage } from '../lib/ns-api'; // Import Journey instead of Departure
import { FaLongArrowAltRight, FaStar, FaThumbtack } from 'react-icons/fa'; // Added FaThumbtack, Removed unused FaFilter
import { FiAlertTriangle } from 'react-icons/fi'; // Import warning icon
import Image from 'next/image'; // Import next/image
import { formatTime, calculateDelay } from '../lib/utils'; // Import helpers
import { stations } from '../lib/stations'; // Import stations data
import { getSpecialLiveryName, getSpecialLiveryImageUrl } from '../lib/specialLiveries'; // Import special livery data and image getter
import { usePinnedJourney, PinnedJourneyData } from '../hooks/usePinnedJourney'; // Import pinning hook and type
// Removed Shadcn UI imports

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
  // originPlannedDepartureTime is optional via Journey interface
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


// Removed unused FilterCounts interface

// Removed FilterStatus interface as it's no longer needed here

interface JourneyListProps {
  journeys: JourneyWithDetails[];
  listType: 'departures' | 'arrivals';
  currentStationUic: string;
  // showFilterPanel prop removed, handled by parent
  // Filter state and handlers are now controlled by parent
  selectedTrainTypes: string[];
  selectedDestinations: string[];
  // onTrainTypeChange and onDestinationChange are handled by the parent
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
const stationNameToLongNameMap = new Map(stations.map(s => [s.name.toUpperCase(), s.name_long])); // Map for name -> name_long
const stationShortNameToLongNameMap = new Map(stations.map(s => [s.name_short.toUpperCase(), s.name_long])); // Map for name_short -> name_long
const stationUicToLongNameMap = new Map(stations.map(s => [s.uic, s.name_long])); // Map UIC to name_long

// Helper to find name_long, trying different name fields
const getStationLongName = (name: string): string => {
    const upperName = name.toUpperCase();
    return stationNameToLongNameMap.get(upperName)
        || stationShortNameToLongNameMap.get(upperName)
        || name; // Fallback to original name if not found
};

export default function JourneyList({
    journeys,
    listType,
    currentStationUic,
    // showFilterPanel prop removed
    // Receive filter state and callbacks from props
    selectedTrainTypes,
    selectedDestinations
    // onTrainTypeChange, // Handled by parent
    // onDestinationChange // Handled by parent
}: JourneyListProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [stopsData, setStopsData] = useState<Record<string, JourneyStop[]>>({}); // Cache for stops
  const [loadingStops, setLoadingStops] = useState<boolean>(false); // Loading for individual stop expansion
  const [errorStops, setErrorStops] = useState<string | null>(null); // Error for individual stop expansion
  const { pinJourney, unpinJourney, pinnedJourney } = usePinnedJourney(); // Get pinning functions and state (added unpinJourney)
  // Removed local state for selectedTrainTypes and selectedDestinations
  // Removed unused state variables for destination search
  // potentialDestinations is calculated via useMemo below
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


  // Removed the useEffect hook that fetched all stops upfront.

  // --- Filtering Logic & Derived State ---
  // Get unique train types from the current journeys
  // Removed unused uniqueTrainTypes calculation

  // Helper function to extract shortened destination name (similar logic as in render)
  // Moved *before* potentialDestinations useMemo
  const getShortenedDestination = (journey: JourneyWithDetails): string | null => {
      const warningMessagePrefix = "Rijdt niet verder dan ";
      const warningMessage = journey.messages?.find(msg =>
          msg.message.startsWith(warningMessagePrefix) // Removed style check
      );
      if (warningMessage) {
          let extractedName = warningMessage.message.substring(warningMessagePrefix.length).replace(/\[|\]/g, '');
          const doorIndex = extractedName.indexOf(" door ");
          if (doorIndex !== -1) {
              extractedName = extractedName.substring(0, doorIndex).trim();
          }
          return extractedName;
      }
      return null;
  };

  // Calculate potential filter destinations directly from journey data
  // Removed unused potentialDestinations calculation

  // Call parent handler for train type change
  // Removed unused handleTrainTypeChange function (parent handler is used directly)

  // --- Helper function moved above ---


  // Call parent handler for adding a destination filter
  // Removed unused handleAddDestinationFilter function (parent handler is used directly)

  // Call parent handler for removing a destination filter
  // Removed unused handleRemoveDestinationFilter function (parent handler is used directly)

  // Removed the older, type-only filter logic.
  // The combined logic below handles both type and stop filters.
  // Filter journeys based on selected types AND selected stops
  const filteredJourneys = useMemo(() => {
    return journeys.filter(journey => {
      // Check train type filter
      const typeMatch = selectedTrainTypes.length === 0 || selectedTrainTypes.includes(journey.product.shortCategoryName);
      if (!typeMatch) return false;

      // Check destination filter (if any destinations are selected)
      if (selectedDestinations.length > 0) {
          let journeyDest: string | undefined | null = null;
          if (listType === 'departures') {
              const shortenedDest = getShortenedDestination(journey);
              journeyDest = shortenedDest || journey.direction;
          } else { // arrivals
              journeyDest = journey.finalDestination || journey.composition?.destination;
          }

          // If journey has no destination or doesn't match any selected, exclude it
          if (!journeyDest || !selectedDestinations.includes(journeyDest)) {
              return false;
          }
      }

      // If passed both filters (or filters not active), include the journey
      return true;
    });
  }, [journeys, selectedTrainTypes, selectedDestinations, listType]); // Removed unnecessary stopsData dependency

  // Removed useEffect for reporting filter counts (parent now has state)

  // --- Pinning Logic ---
  const handlePinClick = (event: React.MouseEvent, journeyData: JourneyWithDetails) => {
    event.stopPropagation(); // Prevent item expansion when clicking pin

    // Determine origin name using the existing map
    const originName = stationUicToLongNameMap.get(currentStationUic) || stationCodeToNameMap.get(currentStationUic.toUpperCase()) || "Unknown Origin";

    // Determine destination, considering shortened journeys
    const warningMessagePrefixPin = "Rijdt niet verder dan ";
    const warningMessagePin = journeyData.messages?.find(msg => msg.message.startsWith(warningMessagePrefixPin));
    let shortenedDestinationPin: string | null = null;
    if (warningMessagePin) {
        let extractedNamePin = warningMessagePin.message.substring(warningMessagePrefixPin.length).replace(/\[|\]/g, '');
        const doorIndexPin = extractedNamePin.indexOf(" door ");
        if (doorIndexPin !== -1) {
            extractedNamePin = extractedNamePin.substring(0, doorIndexPin).trim();
        }
        shortenedDestinationPin = extractedNamePin;
    }
    const destinationName = (shortenedDestinationPin ? getStationLongName(shortenedDestinationPin) : journeyData.direction) || "Unknown";


    // Find the materieelnummer of the first part going to the final destination
    let targetMaterieelNummer: number | undefined | null = undefined;
    if (journeyData.composition?.parts) {
        for (const part of journeyData.composition.parts) {
            const partDestinationCode = part.eindbestemming;
            if (!partDestinationCode) {
                // No specific destination for this part, assume it goes all the way
                targetMaterieelNummer = part.materieelnummer;
                break; // Found the first one
            } else {
                // Check if this part's destination matches the overall journey destination
                const partDestinationName = stationCodeToNameMap.get(partDestinationCode); // Use the existing map
                if (partDestinationName && partDestinationName.toUpperCase() === destinationName.toUpperCase()) {
                    targetMaterieelNummer = part.materieelnummer;
                    break; // Found the first one
                }
            }
        }
        // Fallback: If no matching part found, use the first part's number if available
        if (targetMaterieelNummer === undefined && journeyData.composition.parts.length > 0) {
            targetMaterieelNummer = journeyData.composition.parts[0].materieelnummer;
        }
    }

    const dataToPin: PinnedJourneyData = {
      origin: originName,
      originUic: currentStationUic, // Store the reliable UIC code
      destination: destinationName,
      departureTime: journeyData.plannedDateTime, // Already ISO string
      trainNumber: journeyData.product.number, // Keep the service number as well
      nextStation: journeyData.routeStations?.[0]?.mediumName ?? "Unknown", // Fallback if missing
      platform: journeyData.actualTrack ?? journeyData.plannedTrack ?? undefined, // Restore platform at origin
      journeyCategory: journeyData.product.shortCategoryName,
      materieelNummer: targetMaterieelNummer != null && targetMaterieelNummer !== 0 ? targetMaterieelNummer.toString() : undefined,
      // messages: journeyData.messages, // Removed - messages fetched dynamically
      plannedDepartureTime: journeyData.plannedDateTime,
      // actualDepartureTime: journeyData.actualDateTime, // Removed - fetched live
      // cancelled: journeyData.cancelled, // Removed - status determined dynamically
    };

    // Check if the clicked journey is already pinned
    const isCurrentlyPinned = pinnedJourney?.trainNumber === journeyData.product.number &&
                             pinnedJourney?.departureTime === journeyData.plannedDateTime;

    // Toggle Pin: If already pinned, unpin; otherwise, pin.
    if (isCurrentlyPinned) {
        unpinJourney();
    } else {
        pinJourney(dataToPin);
    }
  };
  // --- End Pinning Logic ---

  // --- End Filtering Logic ---


  return (
    <div> {/* Main wrapper */}
      {/* Filter Button and Indicators are now rendered in the parent component */}

      {/* Filter panel removed - now rendered in parent */}

      {/* Journey List */}
      <motion.ul
        className="divide-y divide-gray-200 dark:divide-gray-700" // Added dark mode divider
        variants={listVariants}
        initial="hidden"
        animate="visible"
      >
      {filteredJourneys.length === 0 && (
          <li className="p-4 text-center text-gray-500 dark:text-gray-400 italic">
            No departures match the selected filters.
          </li>
      )}
      {filteredJourneys.map((journey, index) => { // Use filteredJourneys and index
        // Use journey instead of dep
        const delayMinutes = calculateDelay(journey.plannedDateTime, journey.actualDateTime);
        const plannedTimeFormatted = formatTime(journey.plannedDateTime);
        const actualTimeFormatted = formatTime(journey.actualDateTime); // Format actual time
        const isExpanded = index === expandedIndex;
        const trainNumber = journey.product.number; // Get train number for fetching stops

        // <<< START NEW CODE >>>
        // Check if this is the first departure and its origin time is in the future
        let isNextJourney = false;
        if (index === 0 && listType === 'departures' && journey.originPlannedDepartureTime) {
            try {
                const originDeparture = new Date(journey.originPlannedDepartureTime);
                const now = new Date();
                if (originDeparture > now) {
                    isNextJourney = true;
                }
            } catch (e) {
                console.error("Error parsing origin departure time:", journey.originPlannedDepartureTime, e);
            }
        }
        // <<< END NEW CODE >>>

        // Check for shortened journey warning
        let shortenedDestination = null;
        const warningMessagePrefix = "Rijdt niet verder dan ";
        const warningMessage = journey.messages?.find(msg =>
          msg.message.startsWith(warningMessagePrefix) // Removed style check
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
            className={`relative p-4 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer ${journey.cancelled ? 'bg-red-50 dark:bg-red-900/30' : ''}`} // Added relative positioning
            variants={itemVariants}
            onClick={() => handleToggle(index, trainNumber)} // Add onClick handler
          >
            {/* Pin Button moved below */}
            {/* Main Info Row */}
            <div className="flex justify-between items-start mb-2">
              {/* Left Column: Time/Delay + Destination/Type */}
              <div className="flex-grow mr-4">
                {/* Time + Delay */}
                <div className="flex items-center flex-wrap mb-1"> {/* Added flex-wrap */}
                  {/* <<< START MODIFICATION >>> */}
                  {/* Add "Next Journey" badge if applicable */}
                  {isNextJourney && (
                      <span className="mr-2 px-2 py-0.5 bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300 text-xs font-semibold rounded">
                          Next Journey
                      </span>
                  )}
                  {/* <<< END MODIFICATION >>> */}

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
                          {/* New destination (name_long) in red */}
                          <span className="font-medium text-lg text-red-600 dark:text-red-400 ml-2">
                            {getStationLongName(shortenedDestination)} {/* Use helper to get name_long */}
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
              {/* Right Column: Track Square and Pin Button */}
              <div className="flex items-center flex-shrink-0 ml-2 space-x-2"> {/* Increased space-x to 2 */}
                  {/* Track Square */}
                  <span className={`flex items-center justify-center w-12 h-12 rounded border text-base font-semibold ${
                    journey.actualTrack && journey.plannedTrack && journey.actualTrack !== journey.plannedTrack
                      ? 'border-red-600 text-red-600 dark:border-red-500 dark:text-red-500'
                      : 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                  }`}>
                    {journey.actualTrack ?? journey.plannedTrack ?? '?'}
                  </span>
                  {/* Pin Button */}
                  {(() => {
                      const isCurrentlyPinned = pinnedJourney?.trainNumber === journey.product.number &&
                                               pinnedJourney?.departureTime === journey.plannedDateTime;
                      return (
                          <button
                            onClick={(e) => handlePinClick(e, journey)}
                            className={`p-1.5 rounded hover:bg-gray-300 dark:hover:bg-gray-600 ${isCurrentlyPinned ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`}
                            aria-label={isCurrentlyPinned ? "Unpin Journey" : "Pin Journey"}
                            title={isCurrentlyPinned ? "Unpin Journey" : "Pin Journey"}
                          >
                            <FaThumbtack size={18} className={isCurrentlyPinned ? 'fill-current' : ''} /> {/* Increased icon size */}
                          </button>
                      );
                  })()}
              </div>
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

                        // Find the index of the shortened destination stop, if applicable
                        let shortenedDestinationStopIndex = -1;
                        if (shortenedDestination) {
                            // Get the likely long name of the shortened destination using the helper
                            const targetLongName = getStationLongName(shortenedDestination).toUpperCase();
                            // Find index based on stop.name matching the target long name (case-insensitive)
                            shortenedDestinationStopIndex = stoppingRelevantStops.findIndex(s =>
                                s.stop.name.toUpperCase() === targetLongName
                            );
                        }

                        // Return the list directly if there are stops
                        return (
                          <ul className="text-sm space-y-2">
                            {stoppingRelevantStops.map((stop, stopIndex) => { // Added stopIndex
                              // We know arrivalEvent exists because of the filter above
                              const arrivalEvent = stop.arrivals[0];
                              const plannedTime = arrivalEvent.plannedTime ? formatTime(arrivalEvent.plannedTime) : '--:--';
                              const actualTime = arrivalEvent.actualTime ? formatTime(arrivalEvent.actualTime) : null;
                              const delay = (arrivalEvent.plannedTime && arrivalEvent.actualTime)
                                ? calculateDelay(arrivalEvent.plannedTime, arrivalEvent.actualTime)
                                : 0;
                              const isCancelled = arrivalEvent.cancelled ?? false;

                              // Determine if this stop should be struck through
                              const shouldStrikeThrough = shortenedDestinationStopIndex !== -1 && stopIndex > shortenedDestinationStopIndex;

                              // Define base classes and conditional classes for the list item background/opacity
                              const baseLiClasses = 'flex flex-col p-2 rounded';
                              let conditionalLiClasses = '';
                              if (isCancelled && !shouldStrikeThrough) {
                                  conditionalLiClasses = 'bg-red-50 dark:bg-red-900/30 opacity-70'; // Explicitly cancelled, not shortened
                              } else if (shouldStrikeThrough) {
                                  conditionalLiClasses = 'bg-gray-200 dark:bg-gray-600'; // Effectively cancelled (shortened)
                              } else {
                                  conditionalLiClasses = 'bg-gray-100 dark:bg-gray-700'; // Default
                              }
                              // line-through and text color applied individually

                              return (
                                <li key={stop.id} className={`${baseLiClasses} ${conditionalLiClasses}`}>
                                  {/* Top Row: Time Info Only */}
                                  <div className="flex items-center space-x-1 text-xs mb-0.5">
                                    {/* Time Display Logic */}
                                    {shouldStrikeThrough ? (
                                        // Effectively Cancelled Stop
                                        <>
                                            <span className="font-medium text-red-600 dark:text-red-400 line-through"> {/* Red time + strikethrough */}
                                                {plannedTime}
                                            </span>
                                            {/* White text on red bg badge, capitalized, NO strikethrough */}
                                            <span className="ml-1 px-1.5 py-0.5 bg-red-600 text-white text-xs font-semibold rounded inline-block">
                                                Cancelled
                                            </span>
                                        </>
                                    ) : isCancelled ? (
                                        // Explicitly Cancelled Stop
                                        <span className="px-1.5 py-0.5 bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 rounded font-medium line-through"> {/* Badge with strikethrough */}
                                            Cancelled
                                        </span>
                                    ) : (
                                        // Normal Stop
                                        <>
                                            <span className={`font-medium text-blue-700 dark:text-blue-400 ${delay > 0 ? 'line-through' : ''}`}> {/* Strikethrough only if delayed */}
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
                                  <div className="flex items-center space-x-2">
                                    {/* Track Info */}
                                    {!(isCancelled && !shouldStrikeThrough) && (() => { // Render track unless explicitly cancelled AND not shortened
                                        const plannedTrack = arrivalEvent.plannedTrack;
                                        const actualTrack = arrivalEvent.actualTrack;
                                        const displayTrack = shouldStrikeThrough ? (plannedTrack ?? '?') : (actualTrack ?? plannedTrack ?? '?');
                                        const trackChanged = !shouldStrikeThrough && actualTrack && plannedTrack && actualTrack !== plannedTrack;
                                        const colorClasses = shouldStrikeThrough || trackChanged
                                            ? 'border-red-600 text-red-600 dark:border-red-500 dark:text-red-500' // Red if shortened or changed
                                            : 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'; // Blue otherwise

                                        return (
                                            // Apply color, ensure no line-through
                                            <span className={`flex items-center justify-center w-6 h-6 rounded border text-xs font-semibold flex-shrink-0 inline-block ${colorClasses}`}>
                                                {displayTrack}
                                            </span>
                                        );
                                    })()}
                                    {/* Stop Name */}
                                    <span className={`text-sm ${
                                        isCancelled ? 'text-red-600 dark:text-red-400 line-through' : // Explicitly cancelled
                                        shouldStrikeThrough ? 'text-red-600 dark:text-red-400 line-through' : // Effectively cancelled
                                        'text-gray-700 dark:text-gray-300' // Normal
                                    }`}>
                                        {stop.stop.name}
                                    </span>
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
    </div> // Close wrapper div
  );
} // Correct closing brace for the component function