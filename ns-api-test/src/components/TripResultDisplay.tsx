import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Clock, ArrowRight, TrainTrack, Shuffle, AlertCircle, CheckCircle } from 'lucide-react'; // Icons
import { format } from 'date-fns'; // For time formatting

// Re-use or import the Trip/Leg interfaces defined in page.tsx or a shared types file
// More accurate interface based on NS API structure
export interface StopTimeInfo {
    name: string;
    plannedDateTime?: string; // Use optional as actual might be preferred if available
    actualDateTime?: string;
    plannedTrack?: string;
    actualTrack?: string;
    // Add other fields like uicCode, lat, lng if needed
}

export interface ProductInfo {
    number?: string;
    categoryCode?: string; // e.g., IC, SPR
    shortCategoryName?: string; // e.g., IC, SPR
    longCategoryName?: string; // e.g., Intercity, Sprinter
    operatorCode?: string; // e.g., NS
    type?: string; // e.g., TRAIN
    displayName?: string; // e.g., NS Intercity
}

export interface LegNote { // Assuming structure from previous examples
    value: string;
    key?: string;
    noteType?: string; // e.g., ATTRIBUTE, UNKNOWN
    isPresentationRequired?: boolean;
}

export interface Leg {
    idx: string; // Leg index
    name?: string; // Train name like "IC 3071"
    direction?: string;
    origin: StopTimeInfo;
    destination: StopTimeInfo;
    product?: ProductInfo;
    notes?: LegNote[]; // For leg-specific remarks
    cancelled?: boolean;
    changePossible?: boolean;
    alternativeTransport?: boolean;
    // Add crowdForecast, punctuality, stops array etc. if needed
}

// More accurate Trip interface
export interface TripNote { // Assuming structure from previous examples
    message: string;
    type?: string; // e.g., INFO, WARNING
}
export interface LabelListItem { // For things like supplements
    label: string;
    stickerType?: string;
}

export interface Trip {
    uid: string; // Unique identifier for the trip option
    plannedDurationInMinutes: number;
    actualDurationInMinutes?: number;
    transfers: number;
    status: string; // e.g., NORMAL, CANCELLED, DISRUPTION, ALTERED
    legs: Leg[];
    messages?: TripNote[]; // Renamed from notes for clarity based on API structure
    labelListItems?: LabelListItem[]; // For supplements etc.
    // Add crowdForecast, optimal, fare info etc. if needed
}

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
const formatTime = (isoString: string): string => {
    try {
        return format(new Date(isoString), 'HH:mm');
    } catch (e) {
        console.error("Error formatting time:", isoString, e);
        return "Invalid Time";
    }
};

// Helper to get status icon and color
const getStatusInfo = (status: string): { icon: React.ReactNode; color: string } => {
    switch (status?.toUpperCase()) {
        case 'CANCELLED':
            return { icon: <AlertCircle className="h-4 w-4 text-red-600" />, color: 'text-red-600' };
        case 'DISRUPTION':
        case 'ALTERED': // Treat altered also as a disruption indicator
            return { icon: <AlertCircle className="h-4 w-4 text-orange-500" />, color: 'text-orange-500' };
        case 'NORMAL':
            return { icon: <CheckCircle className="h-4 w-4 text-green-600" />, color: 'text-green-600' };
        default:
            return { icon: null, color: 'text-muted-foreground' }; // Default or unknown status
    }
};

const TripResultDisplay: React.FC<TripResultDisplayProps> = ({ trips }) => {
    if (!trips || trips.length === 0) {
        return <p className="text-muted-foreground">No trip results to display.</p>;
    }

    return (
        <div className="space-y-4">
            {trips.map((trip, index) => {
                const { icon: statusIcon, color: statusColor } = getStatusInfo(trip.status);
                // Use plannedDateTime, fallback to actualDateTime if needed/available
                const overallStartTime = trip.legs[0]?.origin?.plannedDateTime || trip.legs[0]?.origin?.actualDateTime;
                const overallEndTime = trip.legs[trip.legs.length - 1]?.destination?.plannedDateTime || trip.legs[trip.legs.length - 1]?.destination?.actualDateTime;
                const overallOriginName = trip.legs[0]?.origin?.name;
                const overallDestinationName = trip.legs[trip.legs.length - 1]?.destination?.name;

                return (
                    <Card key={trip.uid || index} className="overflow-hidden">
                        <CardHeader className="pb-2">
                            <div className="flex justify-between items-start gap-2">
                                <div>
                                    {/* Corrected Structure: Title and Description are siblings */}
                                    <CardTitle className="text-lg">
                                        {overallOriginName || '?'} <ArrowRight className="inline h-4 w-4 mx-1" /> {overallDestinationName || '?'}
                                    </CardTitle>
                                    <CardDescription className="text-sm">
                                        {overallStartTime ? formatTime(overallStartTime) : '?'} - {overallEndTime ? formatTime(overallEndTime) : '?'}
                                    </CardDescription>
                                    {/* Div for duration/transfers/status is also a sibling */}
                                    <div className="flex items-center gap-3 text-sm mt-1">
                                        <span className="flex items-center gap-1" title="Duration">
                                            <Clock className="h-3.5 w-3.5" />
                                            {formatDuration(trip.actualDurationInMinutes ?? trip.plannedDurationInMinutes)}
                                        </span>
                                        <span className="flex items-center gap-1" title="Transfers">
                                            <Shuffle className="h-3.5 w-3.5" />
                                            {trip.transfers} Transfer{trip.transfers !== 1 ? 's' : ''}
                                        </span>
                                        {statusIcon && (
                                            <span className={`flex items-center gap-1 ${statusColor}`} title={`Status: ${trip.status}`}>
                                                {statusIcon}
                                                {trip.status}
                                            </span>
                                        )}
                                    </div>
                                    {/* Display trip-level labels (e.g., supplements) */}
                                    {trip.labelListItems && trip.labelListItems.length > 0 && (
                                        <div className="mt-1 text-xs space-x-1">
                                            {trip.labelListItems.map((label, lblIdx) => (
                                                <span key={lblIdx} className="inline-block bg-muted text-muted-foreground px-1.5 py-0.5 rounded-sm">{label.label}</span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                {/* Optional: Add price or other summary info here */}
                            </div>
                             {/* Display trip-level notes/messages */}
                             {/* Display trip-level messages */}
                             {trip.messages && trip.messages.length > 0 && (
                                <div className="mt-2 text-xs space-y-1">
                                    {trip.messages.map((msg, msgIdx) => (
                                        <p key={msgIdx} className={`flex items-center gap-1 ${msg.type === 'WARNING' ? 'text-orange-600' : msg.type === 'ERROR' ? 'text-red-600' : 'text-muted-foreground'}`}>
                                            {msg.type === 'WARNING' || msg.type === 'ERROR' ? <AlertCircle className="h-3 w-3" /> : null}
                                            {msg.message} {/* Use message field */}
                                        </p>
                                    ))}
                                </div>
                            )}
                        </CardHeader>
                        <CardContent className="pt-2">
                            <Separator className="mb-3" />
                            <div className="space-y-3">
                                {trip.legs.map((leg, legIndex) => (
                                    <div key={legIndex} className={`relative pl-6 ${leg.cancelled ? 'opacity-50 line-through' : ''}`}>
                                        {/* Timeline Dot */}
                                        <div className={`absolute left-0 top-1 h-3 w-3 rounded-full ${leg.cancelled ? 'bg-red-400' : 'bg-primary'}`}></div>
                                        {/* Timeline Line (except for last leg) */}
                                        {legIndex < trip.legs.length - 1 && (
                                            <div className={`absolute left-[5px] top-[18px] h-[calc(100%-5px)] w-[2px] ${leg.cancelled ? 'bg-red-200' : 'bg-primary/30'}`}></div>
                                        )}

                                        <div className="flex justify-between items-center mb-1">
                                            <span className="font-medium">{formatTime(leg.origin.plannedDateTime || leg.origin.actualDateTime || '')} - {leg.origin.name}</span>
                                            {(leg.origin.actualTrack || leg.origin.plannedTrack) && <span className="text-xs text-muted-foreground flex items-center gap-1"><TrainTrack className="h-3 w-3" /> Spoor {leg.origin.actualTrack || leg.origin.plannedTrack}</span>}
                                        </div>
                                        <div className="text-sm text-muted-foreground mb-1 ml-1 flex items-center gap-2">
                                            <ArrowRight className="h-3 w-3" />
                                            <span>{leg.product?.shortCategoryName || leg.product?.type || 'Unknown'} {leg.product?.number || leg.name || ''}</span> { /* Display train name if product number missing */}
                                            {leg.direction && <span className="text-xs italic ml-1">({leg.direction})</span>}
                                            {leg.cancelled && <span className="text-red-600 font-semibold">(Cancelled)</span>}
                                            {leg.alternativeTransport && <span className="text-orange-500 font-semibold">(Alternative Transport)</span>}
                                        </div>
                                         {/* Display leg-level notes/messages */}
                                         {leg.notes && leg.notes.length > 0 && (
                                            <div className="ml-1 mt-1 text-xs space-y-0.5">
                                                {/* Filter notes that should be presented */}
                                                {leg.notes?.filter(note => note.isPresentationRequired !== false).map((note, noteIdx) => (
                                                    <p key={noteIdx} className={`flex items-center gap-1 ${note.noteType === 'WARNING' ? 'text-orange-600' : note.noteType === 'ERROR' ? 'text-red-600' : 'text-muted-foreground'}`}>
                                                        {note.noteType === 'WARNING' || note.noteType === 'ERROR' ? <AlertCircle className="h-3 w-3" /> : null}
                                                        {note.value}
                                                    </p>
                                                ))}
                                            </div>
                                        )}
                                        <div className="flex justify-between items-center mt-1">
                                            <span className="font-medium">{formatTime(leg.destination.plannedDateTime || leg.destination.actualDateTime || '')} - {leg.destination.name}</span>
                                            {(leg.destination.actualTrack || leg.destination.plannedTrack) && <span className="text-xs text-muted-foreground flex items-center gap-1"><TrainTrack className="h-3 w-3" /> Spoor {leg.destination.actualTrack || leg.destination.plannedTrack}</span>}
                                        </div>
                                        {/* Add transfer info if not the last leg */}
                                        {legIndex < trip.legs.length - 1 && leg.changePossible !== false && (
                                            <Separator className="my-2" />
                                            // Optional: Add transfer time indication here if available in API data
                                        )}
                                         {legIndex < trip.legs.length - 1 && leg.changePossible === false && (
                                            <div className="my-2 text-sm text-orange-600 font-medium flex items-center gap-1"><AlertCircle className="h-4 w-4" /> Short transfer - Not guaranteed</div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
};

export default TripResultDisplay;