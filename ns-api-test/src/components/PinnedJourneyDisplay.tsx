'use client'; // This component uses hooks and interacts with localStorage

import React, { useState, useEffect, useRef } from 'react';
import { FaThumbtack } from 'react-icons/fa'; // Import the pin icon
import Link from 'next/link';
import { usePinnedJourney, PinnedJourneyData } from '@/hooks/usePinnedJourney'; // Import type
import { formatTime, calculateDelay, formatDateTimeForApi } from '@/lib/utils'; // Import formatTime and calculateDelay
import { stations } from '@/lib/stations'; // Import stations data for name lookup
import { Journey } from '@/lib/ns-api'; // Import Journey (DepartureMessage no longer needed here)

// --- Local Interfaces for Fetched Data ---
// Simplified local interface for stop events
interface PinnedStopEvent {
    plannedTime: string;
    actualTime?: string;
    cancelled?: boolean;
    plannedTrack?: string;
    actualTrack?: string;
    // messages removed
}
// Simplified local interface for journey stops
interface PinnedJourneyStop {
    id: string;
    stop: { name: string; uicCode: string; };
    arrivals: PinnedStopEvent[];
    departures: PinnedStopEvent[];
}
// Interface for the payload from /api/journey-stops
interface JourneyStopsPayload {
    stops: PinnedJourneyStop[];
    notes?: unknown[]; // Keep notes as unknown for now, not used
}
// --- End Local Interfaces ---

// Interface for the derived state about the next stop
interface NextStopDetails {
    name?: string;
    plannedArrivalTime?: string; // Raw ISO string
    actualArrivalTime?: string; // Raw ISO string
    platform?: string;
    cancelled?: boolean;
    // messages removed
    // journeyNotes removed
    loading: boolean;
    error?: string;
}

// Create lookup maps
const stationUicToNameMap = new Map(stations.map(s => [s.uic.toString(), s.name_long]));
const stationUicToCodeMap = new Map(stations.map(s => [s.uic.toString(), s.code]));

const REFRESH_INTERVAL_MS = 30000; // Refresh every 30 seconds

const PinnedJourneyDisplay: React.FC = () => {
  const { pinnedJourney, unpinJourney } = usePinnedJourney();
  const [liveDepartureData, setLiveDepartureData] = useState<Journey | null>(null);
  const [nextStopDetails, setNextStopDetails] = useState<NextStopDetails | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Combined fetch function
  const fetchLiveData = async (currentPinnedJourney: PinnedJourneyData | null) => {
      if (!currentPinnedJourney) return;

      setIsLoading(true);
      setError(null);

      const stationCode = stationUicToCodeMap.get(currentPinnedJourney.originUic);
      if (!stationCode) {
          setError("Invalid origin station code."); setIsLoading(false); return;
      }

      let apiDateTime: string | undefined = undefined;
      try {
          const plannedDate = new Date(currentPinnedJourney.plannedDepartureTime);
          plannedDate.setMinutes(plannedDate.getMinutes() - 1);
          apiDateTime = formatDateTimeForApi(plannedDate);
      } catch {
          setError("Invalid planned departure time."); setIsLoading(false); return;
      }

      try {
          const departureApiUrl = `/api/journeys/${stationCode}?type=departures${apiDateTime ? `&dateTime=${encodeURIComponent(apiDateTime)}` : ''}`;
          const stopsApiUrl = `/api/journey-stops/${currentPinnedJourney.trainNumber}`;

          const [departureResponse, stopsResponse] = await Promise.all([
              fetch(departureApiUrl),
              fetch(stopsApiUrl)
          ]);

          // --- Process Departure Status ---
          let foundDeparture: Journey | null = null;
          let departureError: string | null = null;
          if (departureResponse.ok) {
              const departureData: { journeys: Journey[] } = await departureResponse.json();
              foundDeparture = departureData.journeys?.find(j =>
                  j.product.number === currentPinnedJourney.trainNumber &&
                  j.plannedDateTime === currentPinnedJourney.plannedDepartureTime
              ) ?? null;
              setLiveDepartureData(foundDeparture);
              if (!foundDeparture) { departureError = "Departure not found in current schedule."; }
          } else {
              const errorData = await departureResponse.json().catch(() => ({}));
              departureError = errorData.error || `Departure fetch failed (${departureResponse.status})`;
              console.error("Failed to fetch live departure status:", departureError);
              setLiveDepartureData(null);
          }

          // --- Process Stops List ---
          let foundNextStopDetails: NextStopDetails | null = null;
          let stopsError: string | null = null;
          if (stopsResponse.ok) {
              const stopsPayload: JourneyStopsPayload = await stopsResponse.json();
              const stops = stopsPayload.stops || [];
              // Removed storing notes
              const now = new Date();

              let liveNextStop: PinnedJourneyStop | null = null;
              for (const stop of stops) {
                  const departureEvent = stop.departures?.[0];
                  const arrivalEvent = stop.arrivals?.[0];
                  if (!departureEvent || !arrivalEvent) continue;
                  const departureTimeStr = departureEvent.actualTime || departureEvent.plannedTime;
                  try {
                      const departureTime = new Date(departureTimeStr);
                      if (departureTime > now) { liveNextStop = stop; break; }
                  } catch (e) { console.error("Error parsing stop departure time:", departureTimeStr, e); }
              }

              if (liveNextStop) {
                  const arrivalEvent = liveNextStop.arrivals[0];
                  foundNextStopDetails = {
                      name: liveNextStop.stop.name,
                      plannedArrivalTime: arrivalEvent.plannedTime,
                      actualArrivalTime: arrivalEvent.actualTime,
                      platform: arrivalEvent.actualTrack ?? arrivalEvent.plannedTrack,
                      cancelled: arrivalEvent.cancelled ?? false,
                      // messages removed
                      // journeyNotes removed
                      loading: false,
                      error: undefined,
                  };
              } else {
                  stopsError = "No further stops found.";
                  foundNextStopDetails = { loading: false, error: stopsError ?? undefined };
              }
          } else {
              const errorData = await stopsResponse.json().catch(() => ({}));
              stopsError = errorData.error || `Stops fetch failed (${stopsResponse.status})`;
              console.error("Failed to fetch stops list:", stopsError);
              foundNextStopDetails = { loading: false, error: stopsError ?? undefined };
          }
          setNextStopDetails(foundNextStopDetails);

          if (departureError && stopsError) setError("Failed to update status.");
          else if (departureError) setError(departureError);
          else if (stopsError && !foundNextStopDetails?.name) setError(stopsError);
          else setError(null);

      } catch (err) {
          console.error("Error fetching pinned journey live data:", err);
          setError(err instanceof Error ? err.message : "Fetch error");
          setLiveDepartureData(null);
          setNextStopDetails({ loading: false, error: "Fetch error" });
      } finally {
          setIsLoading(false);
      }
    };

  useEffect(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (!pinnedJourney) {
        setLiveDepartureData(null); setNextStopDetails(null); setError(null);
        return;
    }
    fetchLiveData(pinnedJourney);
    intervalRef.current = setInterval(() => { fetchLiveData(pinnedJourney); }, REFRESH_INTERVAL_MS);
    return () => { if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; } };
  }, [pinnedJourney]);

  if (!pinnedJourney) { return null; }

  const displayOriginName = pinnedJourney.origin || "Unknown Origin";
  const plannedTimeForDelay = liveDepartureData?.plannedDateTime || pinnedJourney.plannedDepartureTime;
  const actualTimeForDelay = liveDepartureData?.actualDateTime;
  const originDelayMinutes = calculateDelay(plannedTimeForDelay, actualTimeForDelay ?? plannedTimeForDelay);
  const isCancelled = liveDepartureData?.cancelled ?? false;

  const nextStopArrivalDelayMinutes = nextStopDetails?.plannedArrivalTime && nextStopDetails?.actualArrivalTime
      ? calculateDelay(nextStopDetails.plannedArrivalTime, nextStopDetails.actualArrivalTime) : 0;
  const isNextStopCancelled = nextStopDetails?.cancelled ?? false;

  // Removed message filtering and styling logic

  const mainBgClass = isCancelled ? 'bg-red-50 dark:bg-red-900/30' : 'bg-slate-800 dark:bg-slate-900';
  const mainBorderClass = isCancelled ? 'border-red-700/50' : 'border-slate-700';
  const textClass = isCancelled ? 'text-red-600 dark:text-red-400' : 'text-gray-200';
  const secondaryTextClass = isCancelled ? 'text-red-500' : 'text-gray-400';
  const lineThroughClass = isCancelled ? 'line-through' : '';
  const linkHoverClass = isCancelled ? '' : 'hover:underline';
  const boxOpacityClass = isCancelled ? 'opacity-70' : '';

  const isClickable = !!pinnedJourney.materieelNummer && !isCancelled;
  const linkHref = `/train-info?materieelnummer=${pinnedJourney.materieelNummer}`;
  const linkTitle = `View details for train ${pinnedJourney.materieelNummer ?? pinnedJourney.trainNumber}`;

  const content = (
    <div className="space-y-2">
        {/* Train Type and Number + Pin Icon + Origin Delay/Cancel */}
        <div className="flex items-center space-x-2 flex-wrap">
            <FaThumbtack className={`w-3 h-3 ${textClass}`} />
            {pinnedJourney.journeyCategory && pinnedJourney.trainNumber && (
              <p className={`text-sm font-semibold ${textClass} ${lineThroughClass}`}>
                  {pinnedJourney.journeyCategory} {pinnedJourney.trainNumber}
              </p>
            )}
             {originDelayMinutes > 0 && !isCancelled && (
                 <span className="text-xs font-medium text-red-400">
                   (Origin +{originDelayMinutes} min)
                 </span>
              )}
            {isCancelled && (
              <span className="ml-2 px-2 py-0.5 bg-red-600 text-white text-sm font-semibold rounded">
                Cancelled
              </span>
            )}
        </div>

        {/* Row with Origin -> Destination */}
        <div>
          <div className={`flex items-center space-x-2 text-sm ${linkHoverClass}`}>
            <span className={`bg-gray-700 px-2 py-0.5 rounded text-xs ${lineThroughClass} ${textClass}`}>{displayOriginName}</span>
            <span className={`${lineThroughClass} ${textClass}`}>→</span>
            <span className={`bg-gray-700 px-2 py-0.5 rounded text-xs ${lineThroughClass} ${textClass}`}>{pinnedJourney.destination}</span>
          </div>
        </div>

        {/* Display Next Station below From/To */}
        <div className="text-sm">
            <p className={`text-xs mb-0.5 ${secondaryTextClass} ${lineThroughClass}`}>Next Station:</p>
            {nextStopDetails?.loading ? (
                <p className="text-xs italic text-gray-400">Loading live details...</p>
            ) : !nextStopDetails || nextStopDetails.error || !nextStopDetails.name ? (
                 <p className={`font-semibold ${textClass} ${lineThroughClass}`}>{pinnedJourney.nextStation} <span className="text-xs italic text-red-400">(Live details unavailable: {nextStopDetails?.error || 'No next stop'})</span></p>
            ) : (
                <div className={`bg-gray-700 p-2 rounded mt-1 ${boxOpacityClass}`}>
                    {/* Arrival Time + Delay at Next Station */}
                    <div className="flex items-center space-x-1 mb-1 flex-wrap">
                        {nextStopDetails.plannedArrivalTime && (
                            <span className={`font-semibold text-sm ${ (nextStopArrivalDelayMinutes > 0 || isNextStopCancelled) ? 'line-through' : '' } ${ isNextStopCancelled ? textClass : 'text-blue-400' }`}>
                                {formatTime(nextStopDetails.plannedArrivalTime)}
                            </span>
                        )}
                        {nextStopDetails.actualArrivalTime && nextStopArrivalDelayMinutes > 0 && !isNextStopCancelled && (
                            <span className="font-semibold text-sm text-red-400">
                                {formatTime(nextStopDetails.actualArrivalTime)}
                            </span>
                        )}
                        {nextStopArrivalDelayMinutes > 0 && !isNextStopCancelled && (
                            <span className="text-xs font-medium text-red-400">
                                (+{nextStopArrivalDelayMinutes} min)
                            </span>
                        )}
                         {isNextStopCancelled && (
                            <span className="ml-1 px-1.5 py-0.5 bg-red-600 text-white text-xs font-semibold rounded">
                                Cancelled Stop
                            </span>
                         )}
                    </div>
                    {/* Platform and Name below time */}
                    <div className={`flex items-center space-x-2 ${isNextStopCancelled ? lineThroughClass : ''}`}>
                        {nextStopDetails.platform && (
                            <span className={`border font-semibold px-2 py-0.5 rounded text-xs ${isNextStopCancelled ? `border-red-500 ${textClass}` : 'border-blue-400 text-blue-400'}`}>
                                {nextStopDetails.platform}
                            </span>
                        )}
                        <span className={`font-semibold text-sm ${textClass}`}>{nextStopDetails.name}</span>
                    </div>
                    {/* Message Display Area Removed */}
                </div>
            )}
         </div>
    </div>
  );

  return (
    <div className={`relative ${mainBgClass} text-white p-3 shadow-lg border-b ${mainBorderClass} md:max-w-4xl md:mx-auto md:rounded-b-lg`}>
       <button
            onClick={(e) => { e.stopPropagation(); unpinJourney(); }}
            className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center bg-red-600 text-white rounded hover:bg-red-700 text-xs font-bold transition-colors z-10"
            aria-label="Unpin journey" title="Unpin this journey"
          > ✕ </button>

      {isClickable ? (
          <Link href={linkHref} className="block rounded hover:bg-slate-700/50 -m-1 p-1" title={linkTitle}>
              {content}
          </Link>
      ) : (
          <div className="block rounded -m-1 p-1 cursor-default" title={linkTitle}>
              {content}
          </div>
      )}

      {isLoading && <p className="text-xs italic text-gray-400 mt-1">Updating status...</p>}
      {error && !isLoading && <p className="text-xs italic text-orange-400 mt-1">Status update failed: {error}</p>}

      {/* Placeholder */}
      {/* <div className="text-xs text-gray-400">Length: N/A | Train: N/A</div> */}
    </div>
  );
};

export default PinnedJourneyDisplay;