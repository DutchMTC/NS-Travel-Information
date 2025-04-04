import { NextResponse, NextRequest } from 'next/server';
// Import the new function and update Journey interface import
import {
    getDepartures,
    getArrivals,
    getTrainComposition,
    getJourneyDestination,
    getStationDisruptions,
    getJourneyOriginDepartureTime, // <<< IMPORT NEW FUNCTION
    Journey,
    TrainUnit,
    Disruption
} from '../../../../lib/ns-api';

// Force dynamic rendering, disable caching
export const dynamic = 'force-dynamic';

// Combined type for response, including composition, final destination, and origin time
interface JourneyWithDetails extends Journey {
  composition: { length: number; parts: TrainUnit[]; destination?: string } | null;
  finalDestination?: string | null;
  // originPlannedDepartureTime is already optional in the base Journey interface
}

export async function GET(
  request: NextRequest
  // context parameter removed as stationCode is extracted from request.nextUrl
) {
  console.log(`[API Route Start] Handling GET request for: ${request.nextUrl.pathname}${request.nextUrl.search}`); // Log entry
  // Extract stationCode from the URL path for broader compatibility
  const pathnameParts = request.nextUrl.pathname.split('/');
  const stationCode = pathnameParts[pathnameParts.length - 1];
  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get('type') as 'departures' | 'arrivals' | null;
  const dateTime = searchParams.get('dateTime'); // Get the dateTime parameter

  if (!stationCode) {
    return NextResponse.json({ error: 'Station code is required' }, { status: 400 });
  }

  if (type !== 'departures' && type !== 'arrivals') {
    return NextResponse.json({ error: 'Invalid type parameter. Use "departures" or "arrivals".' }, { status: 400 });
  }

  // New response type including disruptions
  interface ApiResponse {
    journeys: JourneyWithDetails[];
    disruptions: Disruption[];
  }
  console.log(`[API Route Pre-Try] Station: ${stationCode}, Type: ${type}, DateTime: ${dateTime}`); // Log before try
  try {
    // Fetch base journeys (departures or arrivals)
    const fetchFunction = type === 'departures' ? getDepartures : getArrivals;
    // Fetch base journeys and disruptions in parallel
    const stationCodeUpper = stationCode.toUpperCase();
    // Pass dateTime to the fetch function if it exists
    const fetchJourneysPromise = fetchFunction(stationCodeUpper, dateTime ?? undefined);
    const fetchDisruptionsPromise = getStationDisruptions(stationCodeUpper);

    const [baseJourneys, disruptions] = await Promise.all([
        fetchJourneysPromise,
        fetchDisruptionsPromise
    ]);

    let journeysWithDetails: JourneyWithDetails[] = [];
    let firstJourneyOriginTime: string | null = null; // <<< Variable to store origin time

    // Fetch origin time only for the first departure if no offset is applied
    if (type === 'departures' && !dateTime && baseJourneys.length > 0) {
        try {
            firstJourneyOriginTime = await getJourneyOriginDepartureTime(baseJourneys[0].product.number);
            console.log(`[API Route] Fetched origin time for first departure (${baseJourneys[0].product.number}): ${firstJourneyOriginTime}`);
        } catch (e) {
            console.error(`[API Route] Failed to fetch origin time for first departure (${baseJourneys[0].product.number}):`, e);
            // Continue without the origin time if fetching fails
        }
    }

    if (baseJourneys.length > 0) {
      // Fetch compositions and (only for arrivals) destinations in parallel
      const detailPromises = baseJourneys.map(async (j) => {
          const trainNumber = j.product.number;
          const compositionPromise = getTrainComposition(trainNumber, stationCodeUpper).catch(e => {
              console.error(`API Route: Failed to fetch composition for train ${trainNumber}:`, e);
              return null;
          });

          let destinationPromise: Promise<string | null>;
          if (type === 'arrivals') {
              destinationPromise = getJourneyDestination(trainNumber).catch(e => {
                  console.error(`API Route: Failed to fetch destination for train ${trainNumber}:`, e);
                  return null;
              });
          } else {
              destinationPromise = Promise.resolve(null); // No need to fetch destination for departures
          }

          // Await both promises for this journey
          const [compositionResult, destinationResult] = await Promise.all([compositionPromise, destinationPromise]);

          // Debug log removed

          return { compositionResult, destinationResult }; // Return results for this journey
      });

      const details = await Promise.all(detailPromises); // Array of { compositionResult, destinationResult }

      // Combine journeys with their fetched details
      journeysWithDetails = baseJourneys.map((j, index) => {
          const { compositionResult, destinationResult } = details[index];
          // Include destination from composition result if available
          const compositionData = compositionResult
              ? { length: compositionResult.length, parts: compositionResult.parts, destination: compositionResult.destination }
              : null;

          // Add origin time only to the first journey object if fetched
          const originTime = (index === 0 && firstJourneyOriginTime) ? firstJourneyOriginTime : undefined;

          return {
              ...j,
              composition: compositionData,
              finalDestination: destinationResult,
              originPlannedDepartureTime: originTime, // <<< ADD ORIGIN TIME HERE
          };
      });
    }

    // Filter for active disruptions (optional, API might already do this)
    const activeDisruptions = disruptions.filter(d => d.isActive); // Changed let to const

    // Fake disruptions removed.


    const responsePayload: ApiResponse = {
        journeys: journeysWithDetails,
        disruptions: activeDisruptions // Includes the fake one now
    };

    return NextResponse.json(responsePayload);

  } catch (error) {
    // Log the detailed error object caught by the API route handler
    console.error(`[API Route Error] Caught error while fetching ${type} for ${stationCode}:`, error);
    const errorMessage = error instanceof Error ? error.message : `An unknown error occurred while fetching ${type} data.`;
    // Avoid exposing sensitive details like API key missing error directly
    const clientErrorMessage = errorMessage.includes("NS API Key is missing")
        ? "Server configuration error." // Generic message for client
        : `Failed to fetch ${type} data.`; // Keep the generic client message

    // Ensure error response structure matches expected client handling if necessary
    // For now, just return the error message
    return NextResponse.json({ error: clientErrorMessage, journeys: [], disruptions: [] }, { status: 500 });
  }
}