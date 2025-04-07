import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Clock, ArrowRight, TrainTrack, Shuffle, AlertCircle, CheckCircle } from 'lucide-react'; // Icons
import { format } from 'date-fns'; // For time formatting
// Correctly import JourneyStop and other necessary types from ns-api
import type { Trip, Leg, JourneyStop, StopTimeInfo, TrainProduct, LegNote } from '@/lib/ns-api';

// Re-use or import the Trip/Leg interfaces defined in page.tsx or a shared types file
// Note: Local interfaces removed as they are now imported from ns-api.ts

interface TripResultDisplayProps {
    trips: Trip[];
}

// Helper to format duration
const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    let durationString = '';
    if (hours > 0) {
        durationString += `${hours}h `;
    }
    durationString += `${mins}m`;
    return durationString;
};

// Helper to format time string (assuming ISO 8601 format from API)
const formatTime = (isoString: string | undefined): string => {
    if (!isoString) return '?'; // Handle undefined input
    try {
        return format(new Date(isoString), 'HH:mm');
    } catch (e) {
        console.error("Error formatting time:", isoString, e);
        return "Invalid Time";
    }
};

// Helper to format price from cents
const formatPrice = (cents: number | undefined | null): string => {
    if (cents === undefined || cents === null) {
        return ''; // Return empty string if no price
    }
    const euros = cents / 100;
    // Use Intl.NumberFormat for locale-aware currency formatting
    return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(euros);
};

// Helper to get status icon and color
const getStatusInfo = (status: string): { icon: React.ReactNode; color: string } => {
    switch (status?.toUpperCase()) {
        case 'CANCELLED':
            return { icon: <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />, color: 'text-red-600 dark:text-red-400' };
        case 'DISRUPTION':
        case 'ALTERED': // Treat altered also as a disruption indicator
            return { icon: <AlertCircle className="h-4 w-4 text-orange-500 dark:text-orange-400" />, color: 'text-orange-500 dark:text-orange-400' };
        case 'NORMAL':
            return { icon: <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />, color: 'text-green-600 dark:text-green-400' };
        default:
            return { icon: null, color: 'text-gray-600 dark:text-gray-400' }; // Default or unknown status
    }
};

const TripResultDisplay: React.FC<TripResultDisplayProps> = ({ trips }) => {
    const [expandedLegIndex, setExpandedLegIndex] = useState<string | null>(null); // Use leg.idx as key

    const handleLegClick = (legIdx: string) => {
        setExpandedLegIndex(prevIndex => (prevIndex === legIdx ? null : legIdx));
    };

    if (!trips || trips.length === 0) {
        return <p className="text-gray-600 dark:text-gray-400">No trip results to display.</p>;
    }

    return (
        <div className="space-y-4">
            {trips.map((trip, tripIndex) => {
                const { icon: statusIcon, color: statusColor } = getStatusInfo(trip.status);
                const overallStartTime = trip.legs[0]?.origin?.plannedDateTime || trip.legs[0]?.origin?.actualDateTime;
                const overallEndTime = trip.legs[trip.legs.length - 1]?.destination?.plannedDateTime || trip.legs[trip.legs.length - 1]?.destination?.actualDateTime;
                const overallOriginName = trip.legs[0]?.origin?.name;
                const overallDestinationName = trip.legs[trip.legs.length - 1]?.destination?.name;

                return (
                    <Card key={trip.uid || tripIndex} className="overflow-hidden border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800">
                        <CardHeader className="pb-2 bg-gray-50 dark:bg-gray-800">
                            <div className="flex justify-between items-start gap-2">
                                <div>
                                    <CardTitle className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                                        {overallOriginName || '?'} <ArrowRight className="inline h-4 w-4 mx-1 text-blue-600 dark:text-blue-400" /> {overallDestinationName || '?'}
                                    </CardTitle>
                                    <CardDescription className="text-sm text-gray-600 dark:text-gray-400">
                                        {formatTime(overallStartTime)} - {formatTime(overallEndTime)}
                                    </CardDescription>
                                    <div className="flex items-center gap-3 text-sm mt-1">
                                        <span className="flex items-center gap-1 text-gray-700 dark:text-gray-300" title="Duration">
                                            <Clock className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                                            {formatDuration(trip.actualDurationInMinutes ?? trip.plannedDurationInMinutes)}
                                        </span>
                                        <span className="flex items-center gap-1 text-gray-700 dark:text-gray-300" title="Transfers">
                                            <Shuffle className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                                            {trip.transfers} Transfer{trip.transfers !== 1 ? 's' : ''}
                                        </span>
                                        {statusIcon && (
                                            <span className={`flex items-center gap-1 ${statusColor}`} title={`Status: ${trip.status}`}>
                                                {statusIcon}
                                                {trip.status}
                                            </span>
                                        )}
                                    </div>
                                    {(trip.productFare?.priceInCents !== undefined || trip.productFare?.supplementInCents !== undefined) && (
                                        <div className="flex items-center gap-3 text-sm mt-1 text-gray-700 dark:text-gray-300">
                                            {trip.productFare.priceInCents !== undefined && (
                                                <span>Price: {formatPrice(trip.productFare.priceInCents)}</span>
                                            )}
                                            {trip.productFare.supplementInCents !== undefined && trip.productFare.supplementInCents > 0 && (
                                                <span className="text-xs">(+{formatPrice(trip.productFare.supplementInCents)} supplement)</span>
                                            )}
                                        </div>
                                    )}
                                    {trip.labelListItems && trip.labelListItems.length > 0 && (
                                        <div className="mt-1 text-xs space-x-1">
                                            {trip.labelListItems.map((label, lblIdx) => (
                                                <span key={lblIdx} className="inline-block bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-1.5 py-0.5 rounded-sm">{label.label}</span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                             {trip.messages && trip.messages.length > 0 && (
                                <div className="mt-2 text-xs space-y-1">
                                    {trip.messages.map((msg, msgIdx) => (
                                        <p key={msgIdx} className={`flex items-center gap-1 ${
                                            msg.type === 'WARNING' ? 'text-orange-600 dark:text-orange-400' :
                                            msg.type === 'ERROR' ? 'text-red-600 dark:text-red-400' :
                                            'text-gray-600 dark:text-gray-400'
                                        }`}>
                                            {msg.type === 'WARNING' || msg.type === 'ERROR' ? <AlertCircle className="h-3 w-3" /> : null}
                                            {msg.message}
                                        </p>
                                    ))}
                                </div>
                            )}
                        </CardHeader>
                        <CardContent className="pt-2 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200">
                            <Separator className="mb-3 bg-gray-200 dark:bg-gray-700" />
                            <div className="space-y-3">
                                {trip.legs.map((leg, legIndex) => {
                                    const isExpanded = expandedLegIndex === leg.idx;
                                    // Use JourneyStop type for stops, filter out passing
                                    const actualStops = leg.stops?.filter(stop => stop.status !== 'PASSING') || [];

                                    return (
                                        <div key={leg.idx} className={`relative pl-6 ${leg.cancelled ? 'opacity-50' : ''}`}>
                                            {/* Timeline Dot */}
                                            <div className={`absolute left-0 top-1 h-3 w-3 rounded-full ${leg.cancelled ? 'bg-red-500 dark:bg-red-400' : 'bg-blue-600 dark:bg-blue-400'}`}></div>
                                            {/* Timeline Line (connects dots) */}
                                            {legIndex < trip.legs.length - 1 && (
                                                <div className={`absolute left-[5px] top-[18px] h-[calc(100%-10px)] w-[2px] ${leg.cancelled ? 'bg-red-300 dark:bg-red-800' : 'bg-blue-200 dark:bg-blue-700'}`}></div>
                                            )}

                                            {/* Clickable Leg Header */}
                                            <div
                                                className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 rounded p-1 -ml-1 ${leg.cancelled ? 'line-through' : ''}`}
                                                onClick={() => handleLegClick(leg.idx)} // Use leg.idx
                                                role="button"
                                                aria-expanded={isExpanded}
                                                aria-controls={`leg-stops-${trip.uid}-${leg.idx}`}
                                            >
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="font-medium text-gray-800 dark:text-gray-200">{formatTime(leg.origin.plannedDateTime || leg.origin.actualDateTime)} - {leg.origin.name}</span>
                                                    {(leg.origin.actualTrack || leg.origin.plannedTrack) &&
                                                        <span className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1">
                                                            <TrainTrack className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                                                            <span className="flex items-center justify-center px-1.5 py-0.5 rounded border text-xs font-semibold border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400">
                                                                {leg.origin.actualTrack || leg.origin.plannedTrack}
                                                            </span>
                                                        </span>
                                                    }
                                                </div>
                                                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1 ml-1 flex items-center gap-2">
                                                    <ArrowRight className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                                                    {/* Display Train Type (Material) */}
                                                    <span>{leg.product?.shortCategoryName || leg.product?.type || 'Unknown'} {leg.product?.number || leg.name || ''} {leg.trainType && <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">({leg.trainType})</span>}</span>
                                                    {leg.direction && <span className="text-xs italic ml-1">({leg.direction})</span>}
                                                    {leg.cancelled && <span className="text-red-600 dark:text-red-400 font-semibold">(Cancelled)</span>}
                                                    {leg.alternativeTransport && <span className="text-orange-500 dark:text-orange-400 font-semibold">(Alternative Transport)</span>}
                                                </div>
                                                {leg.notes && leg.notes.length > 0 && (
                                                    <div className="ml-1 mt-1 text-xs space-y-0.5">
                                                        {leg.notes?.filter(note => note.isPresentationRequired !== false).map((note, noteIdx) => (
                                                            <p key={noteIdx} className={`flex items-center gap-1 ${
                                                                note.noteType === 'WARNING' ? 'text-orange-600 dark:text-orange-400' :
                                                                note.noteType === 'ERROR' ? 'text-red-600 dark:text-red-400' :
                                                                'text-gray-600 dark:text-gray-400'
                                                            }`}>
                                                                {note.noteType === 'WARNING' || note.noteType === 'ERROR' ? <AlertCircle className="h-3 w-3" /> : null}
                                                                {note.value}
                                                            </p>
                                                        ))}
                                                    </div>
                                                )}
                                                <div className="flex justify-between items-center mt-1">
                                                    <span className="font-medium text-gray-800 dark:text-gray-200">{formatTime(leg.destination.plannedDateTime || leg.destination.actualDateTime)} - {leg.destination.name}</span>
                                                    {(leg.destination.actualTrack || leg.destination.plannedTrack) &&
                                                        <span className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1">
                                                            <TrainTrack className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                                                            <span className="flex items-center justify-center px-1.5 py-0.5 rounded border text-xs font-semibold border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400">
                                                                {leg.destination.actualTrack || leg.destination.plannedTrack}
                                                            </span>
                                                        </span>
                                                    }
                                                    {leg.destination.exitSide && (
                                                        <span className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1" title={`Exit Side: ${leg.destination.exitSide}`}>
                                                            Exit: {leg.destination.exitSide.charAt(0).toUpperCase() + leg.destination.exitSide.slice(1).toLowerCase()}
                                                        </span>
                                                    )}
                                                </div>
                                            </div> {/* End of clickable leg header */}

                                            {/* Conditionally render intermediate stops */}
                                            {isExpanded && actualStops.length > 0 && (
                                                <div id={`leg-stops-${trip.uid}-${leg.idx}`} className="mt-2 ml-4 pl-4 border-l-2 border-gray-300 dark:border-gray-600 space-y-1.5">
                                                    <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Intermediate Stops:</h4>
                                                    {actualStops.map((stop: JourneyStop, stopIndex: number) => { // Explicitly type stop
                                                        // Correctly access nested properties from JourneyStop
                                                        const arrival = stop.arrivals?.[0]; // Get first arrival event
                                                        const departure = stop.departures?.[0]; // Get first departure event
                                                        const arrivalTime = arrival?.actualTime || arrival?.plannedTime;
                                                        const arrivalTrack = arrival?.actualTrack || arrival?.plannedTrack;
                                                        const departureTime = departure?.actualTime || departure?.plannedTime;
                                                        const departureTrack = departure?.actualTrack || departure?.plannedTrack;
                                                        // Check cancellation status within arrival/departure objects
                                                        const isCancelled = arrival?.cancelled || departure?.cancelled || false;

                                                        // Determine if it's the first or last *displayed* stop in this leg
                                                        const isFirstDisplayedStop = stopIndex === 0;
                                                        const isLastDisplayedStop = stopIndex === actualStops.length - 1;

                                                        return (
                                                            // Use stop.stop.uicCode for key if available, fallback to index
                                                            <div key={stop.stop?.uicCode || stopIndex} className={`text-xs ${isCancelled ? 'opacity-50 line-through' : ''}`}>
                                                                {/* Access name via stop.stop.name */}
                                                                <p className="font-medium text-gray-800 dark:text-gray-200">{stop.stop?.name || 'Unknown Stop'}</p>
                                                                <div className="flex justify-between items-center text-gray-600 dark:text-gray-400">
                                                                    {/* Arrival Info (if not first displayed stop) */}
                                                                    {!isFirstDisplayedStop && arrivalTime && (
                                                                        <span className="flex items-center gap-1">
                                                                            Arr: {formatTime(arrivalTime)}
                                                                            {arrivalTrack && (
                                                                                <span className="flex items-center gap-0.5 ml-1" title={`Arrival Track: ${arrivalTrack}`}>
                                                                                    (<TrainTrack className="h-2.5 w-2.5" />{arrivalTrack})
                                                                                </span>
                                                                            )}
                                                                        </span>
                                                                    )}
                                                                    {/* Departure Info (if not last displayed stop) */}
                                                                    {!isLastDisplayedStop && departureTime && (
                                                                        <span className="flex items-center gap-1">
                                                                            Dep: {formatTime(departureTime)}
                                                                            {departureTrack && (
                                                                                <span className="flex items-center gap-0.5 ml-1" title={`Departure Track: ${departureTrack}`}>
                                                                                    (<TrainTrack className="h-2.5 w-2.5" />{departureTrack})
                                                                                </span>
                                                                            )}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {isCancelled && <p className="text-red-600 dark:text-red-400 font-semibold">(Stop Cancelled)</p>}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}

                                            {/* Separator and Transfer Info */}
                                            {legIndex < trip.legs.length - 1 && (
                                                <>
                                                    <Separator className="my-2 bg-gray-200 dark:bg-gray-700" />
                                                    {leg.changePossible === false && (
                                                        <div className="mb-2 text-sm text-orange-600 dark:text-orange-400 font-medium flex items-center gap-1">
                                                            <AlertCircle className="h-4 w-4" /> Short transfer - Not guaranteed
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div> // Closing div for the entire leg item
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
};

export default TripResultDisplay;