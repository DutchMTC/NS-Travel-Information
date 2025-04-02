"use client"; // This component needs client-side interactivity

import { motion } from 'framer-motion'; // Removed AnimatePresence
import { Journey, TrainUnit, DepartureMessage } from '../lib/ns-api'; // Import Journey instead of Departure
import { FaLongArrowAltRight } from 'react-icons/fa'; // Import a different arrow icon
import Image from 'next/image'; // Import next/image
import { formatTime, calculateDelay } from '../lib/utils'; // Import helpers


// Define the props type, including the composition data
// This interface is now defined in StationJourneyDisplay.tsx
// We expect the journeys prop to already have this shape.
// interface JourneyWithComposition extends Journey {
//   composition: { length: number; parts: TrainUnit[]; destination?: string } | null;
// }

// Define the expected shape of the data received from StationJourneyDisplay
// which matches the response from the internal API route
interface JourneyWithDetails extends Journey {
  composition: { length: number; parts: TrainUnit[] } | null; // Composition without destination
  finalDestination?: string | null; // Destination fetched separately
}

interface JourneyListProps {
  journeys: JourneyWithDetails[]; // Use the updated type
  listType: 'departures' | 'arrivals'; // Add type to distinguish list content
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

// Removed unused detailsVariants

export default function JourneyList({ journeys, listType }: JourneyListProps) {
  // Removed useState and handleToggle for expandedIndex

  return (
    <motion.ul
      className="divide-y divide-gray-200 dark:divide-gray-700" // Added dark mode divider
      variants={listVariants}
      initial="hidden"
      animate="visible"
    >
      {journeys.map((journey) => { // Removed unused index
        // Use journey instead of dep
        const delayMinutes = calculateDelay(journey.plannedDateTime, journey.actualDateTime);
        const plannedTimeFormatted = formatTime(journey.plannedDateTime);
        const actualTimeFormatted = formatTime(journey.actualDateTime); // Format actual time
        // Removed isExpanded variable

        return (
          <motion.li
            key={journey.plannedDateTime + '-' + journey.product.number} // Use more stable key
            className={`p-4 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer ${journey.cancelled ? 'bg-red-50 dark:bg-red-900/30' : ''}`} // Added dark mode hover/cancelled bg
            variants={itemVariants}
            // Removed onClick handler
          >
            {/* Main Info Row */}
            <div className="flex justify-between items-start mb-2">
              {/* Left Column: Time/Delay + Destination/Type */}
              <div className="flex-grow mr-4">
                {/* Time + Delay */}
                <div className="flex items-center mb-1">
                  {/* Show actual time in red box FIRST if delayed and NOT cancelled */}
                  {delayMinutes > 0 && !journey.cancelled && (
                    <span className="mr-2 px-2 py-0.5 bg-red-600 text-white text-sm font-semibold rounded">
                      {actualTimeFormatted}
                    </span>
                  )}
                  {/* Planned Time (color depends on cancelled/delay) */}
                  {/* Add margin-right only if something follows it */}
                  <span className={`text-lg font-semibold ${ (delayMinutes > 0 || journey.cancelled) ? 'mr-2' : '' } ${journey.cancelled ? 'text-red-600 dark:text-red-400' : (delayMinutes > 0 ? 'text-red-600 dark:text-red-400' : 'text-blue-800 dark:text-blue-300')}`}>
                    {plannedTimeFormatted}
                  </span>
                  {/* Show +X min if delayed */}
                  {delayMinutes > 0 && (
                     <span className="text-sm font-medium text-red-600 dark:text-red-400">
                       +{delayMinutes} min
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
                    <div className={`flex items-center flex-wrap ${journey.cancelled ? 'line-through text-red-700 dark:text-red-500' : ''}`}>
                      <span className="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm font-medium mr-2 px-2.5 py-0.5 rounded">
                        From: {journey.origin}
                      </span>
                      {journey.finalDestination && (
                        <>
                          <FaLongArrowAltRight className="text-gray-500 dark:text-gray-400 mx-1" />
                          <span className="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm font-medium mr-2 px-2.5 py-0.5 rounded">
                            To: {journey.finalDestination}
                          </span>
                        </>
                      )}
                      <span className={`text-base ml-1 ${journey.cancelled ? 'text-red-700 dark:text-red-500' : 'text-gray-500 dark:text-gray-400'}`}>
                         ({journey.product.shortCategoryName})
                      </span>
                    </div>
                  ) : (
                    <div> {/* Container for Departure Direction + Type */}
                       <span className={`font-medium text-lg ${journey.cancelled ? 'line-through text-red-700 dark:text-red-500' : 'text-gray-800 dark:text-gray-200'}`}>
                         {journey.direction}
                       </span>
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
                 {journey.composition.parts.map((part, partIndex) => (
                   <div key={part.materieelnummer || partIndex} className="mb-2"> {/* Wrapper for image + text, use materieelnummer as key */}
                     {part.afbeelding ? (
                       <Image src={part.afbeelding} alt={part.type} title={part.type} width={300} height={84} quality={100} unoptimized={true} className="h-7 w-auto object-contain" />
                     ) : (
                       <div className="h-12 flex items-center justify-center text-gray-400 dark:text-gray-500 text-xs italic">(No image)</div>
                     )}
                     {/* Display type and number below each image */}
                     <div className="text-xs text-left text-gray-600 dark:text-gray-400 mt-0.5"> {/* Changed text-center to text-left */}
                       {part.type} ({part.materieelnummer})
                     </div>
                   </div>
                 ))}
               </div>
            )}

            {/* Messages Row (Always Visible) */}
            {/* Messages Row (Always Visible) - Restructured conditional rendering */}
            {journey.messages && journey.messages.length > 0 && (() => {
              const messageClasses = journey.cancelled
                ? 'bg-red-600 text-white' // Style for cancelled
                : 'text-yellow-800 bg-yellow-50 border border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700/50'; // Style for non-cancelled
              return (
                <div className={`mt-2 text-sm rounded p-2 ${messageClasses}`}>
                  {journey.messages.map((msg: DepartureMessage, msgIndex: number) => ( // Add types for msg and msgIndex
                    <p key={msgIndex}>{msg.message}</p>
                  ))}
                </div>
              );
            })()}
          </motion.li>
        );
      })}
    </motion.ul>
  );
}