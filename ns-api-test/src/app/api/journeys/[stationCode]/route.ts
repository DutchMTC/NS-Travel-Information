import { NextResponse, NextRequest } from 'next/server';
import { getDepartures, getArrivals, getTrainComposition, getJourneyDestination, getStationDisruptions, Journey, TrainUnit, Disruption } from '../../../../lib/ns-api'; // Add getStationDisruptions, Disruption

// Force dynamic rendering, disable caching
export const dynamic = 'force-dynamic';

// Edge runtime removed to use standard serverless environment

// Combined type for response
// Combined type for response, including composition and final destination
interface JourneyWithDetails extends Journey {
  composition: { length: number; parts: TrainUnit[] } | null; // Composition without destination here
  finalDestination?: string | null; // Destination fetched separately
}

export async function GET(
  request: NextRequest
  // context parameter removed as stationCode is extracted from request.nextUrl
) {
  // Extract stationCode from the URL path for broader compatibility
  const pathnameParts = request.nextUrl.pathname.split('/');
  const stationCode = pathnameParts[pathnameParts.length - 1];
  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get('type') as 'departures' | 'arrivals' | null;

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
  try {
    // Fetch base journeys (departures or arrivals)
    const fetchFunction = type === 'departures' ? getDepartures : getArrivals;
    // Fetch base journeys and disruptions in parallel
    const stationCodeUpper = stationCode.toUpperCase();
    const fetchJourneysPromise = fetchFunction(stationCodeUpper);
    const fetchDisruptionsPromise = getStationDisruptions(stationCodeUpper);

    const [baseJourneys, disruptions] = await Promise.all([
        fetchJourneysPromise,
        fetchDisruptionsPromise
    ]);

    let journeysWithDetails: JourneyWithDetails[] = [];

    if (baseJourneys.length > 0) {
      // Fetch compositions and (only for arrivals) destinations in parallel
      const detailPromises = baseJourneys.map(async (j) => {
          const trainNumber = j.product.number;
          const compositionPromise = getTrainComposition(trainNumber).catch(e => {
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

          // --- DEBUG LOG (Moved inside map to log after resolution) ---
          if (type === 'arrivals') {
              console.log(`[DEBUG] API Route - Train ${trainNumber} (Arrival): Destination -> ${destinationResult ?? 'Not Found'}`);
          }
          // --- END DEBUG LOG ---

          return { compositionResult, destinationResult }; // Return results for this journey
      });

      const details = await Promise.all(detailPromises); // Array of { compositionResult, destinationResult }

      // Combine journeys with their fetched details
      journeysWithDetails = baseJourneys.map((j, index) => {
          const { compositionResult, destinationResult } = details[index];
          const compositionData = compositionResult ? { length: compositionResult.length, parts: compositionResult.parts } : null;

          return {
              ...j,
              composition: compositionData,
              finalDestination: destinationResult, // Already null if type was 'departures'
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
    console.error(`API Route Error fetching ${type} for ${stationCode}:`, error);
    const errorMessage = error instanceof Error ? error.message : `An unknown error occurred while fetching ${type} data.`;
    // Avoid exposing sensitive details like API key missing error directly
    const clientErrorMessage = errorMessage.includes("NS API Key is missing")
        ? "Server configuration error." // Generic message for client
        : `Failed to fetch ${type} data.`;

    // Ensure error response structure matches expected client handling if necessary
    // For now, just return the error message
    return NextResponse.json({ error: clientErrorMessage, journeys: [], disruptions: [] }, { status: 500 });
  }
}