// src/lib/ns-api.ts

// Define interfaces for the NS API departure response structure
// Based on typical structure, might need refinement based on actual API response
interface TrainProduct {
  categoryCode: string;
  shortCategoryName: string;
  longCategoryName: string;
  operatorCode: string;
  operatorName: string;
  type: string;
  number: string; // Add train number field
}

interface RouteStation {
  uicCode: string;
  mediumName: string;
}

export interface DepartureMessage { // Add export
  message: string;
  style: string;
}

// Renamed from Departure as it's used for both departures and arrivals
export interface Journey {
  product: TrainProduct;
  origin?: string; // Added for arrivals (sometimes present)
  direction?: string; // Keep for departures
  plannedDateTime: string; // ISO 8601 format (e.g., "2023-10-27T10:30:00+0200")
  plannedTrack?: string;
  actualDateTime: string; // ISO 8601 format
  actualTrack?: string;
  trainCategory: string;
  cancelled: boolean;
  routeStations: RouteStation[];
  messages?: DepartureMessage[];
  // Add other relevant fields if needed based on the API documentation or response
}

// Payload structure for Departures
interface DeparturesPayload {
  source: string;
  departures: Journey[];
}

// Payload structure for Arrivals (assuming similar structure, key change)
interface ArrivalsPayload {
    source: string;
    // The actual API response uses 'arrivals' containing objects that might have 'origin' but not 'direction'
    // We map this to our Journey interface in fetchJourneys
    // Define a basic structure for the raw arrival object before mapping
    arrivals: {
        product: TrainProduct;
        plannedDateTime: string;
        actualDateTime: string;
        trainCategory: string;
        cancelled: boolean;
        routeStations: RouteStation[];
        origin?: string;
        plannedTrack?: string;
        actualTrack?: string;
        messages?: DepartureMessage[];
        // Include other potential fields from the raw API response if known
        [key: string]: any; // Allow other fields but prefer known ones
    }[];
}

// Response structure for Departures
interface DeparturesResponse {
  payload: DeparturesPayload;
}

// Response structure for Arrivals
interface ArrivalsResponse {
    payload: ArrivalsPayload;
}

// --- Interfaces for Virtual Train API (Composition) ---
// Structure based on user feedback and common NS API patterns
export interface TrainUnit { // Add export keyword
  type: string; // e.g., "VIRM", "ICM"
  materieelnummer: number; // Add materieelnummer field
  // Assuming an image URL might be provided - adjust if needed
  afbeelding?: string; // Correct field name for image URL
  // Other properties like number of seats might exist
}

interface CompositionResponse {
  materieeldelen: TrainUnit[]; // Array of train parts
  lengte: number;             // Total length
  richting?: string;          // Possible field for destination/direction
  // Other potential fields like 'bakken' might exist
}

// --- Interfaces for Journey Details API (/journey) ---
interface JourneyStop {
    id: string;
    stop: {
        name: string;
        lng: number;
        lat: number;
        countryCode: string;
        uicCode: string;
    };
    previousStopId: string[];
    nextStopId: string[];
    destination?: string; // Destination might be present here
    // Add other potential fields like arrival/departure times if needed
}

interface JourneyDetailsPayload {
    notes: unknown[]; // Use unknown instead of any for notes
    productNumbers: string[];
    stops: JourneyStop[];
    // Add other potential fields
}

interface JourneyDetailsResponse {
    payload: JourneyDetailsPayload;
}

// Shared function to fetch journeys (departures or arrivals)
async function fetchJourneys(stationCode: string, type: 'departures' | 'arrivals'): Promise<Journey[]> {
    const apiKey = process.env.NSR_API_KEY;

    if (!apiKey) {
        console.error(`Error: NSR_API_KEY environment variable is not set for ${type}.`);
        throw new Error("NS API Key is missing. Please configure it in .env.local");
    }

    // Construct the base URL
    const baseUrl = `https://gateway.apiportal.ns.nl/reisinformatie-api/api/v2/${type}`;
    const params = new URLSearchParams({
        lang: 'en',
        station: stationCode,
        maxJourneys: '50', // Fetch a reasonable number
    });
    const apiUrl = `${baseUrl}?${params.toString()}`;

    try {
        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Cache-Control': 'no-cache',
                'Ocp-Apim-Subscription-Key': apiKey,
                'Accept': 'application/json',
            },
            cache: 'no-store',
        });

        if (!response.ok) {
            let errorBody = 'Could not read error body.';
            try {
                errorBody = await response.text();
            } catch { /* Ignore, no need for 'e' variable */ }
            console.error(`Error fetching NS ${type}: ${response.status} ${response.statusText}`, errorBody);
            throw new Error(`Failed to fetch ${type}. Status: ${response.status}. ${errorBody}`);
        }

        const data = await response.json();

        // Type guard to check the payload structure based on 'type'
        if (type === 'departures') {
            const departureData = data as DeparturesResponse;
            if (!departureData.payload || !Array.isArray(departureData.payload.departures)) {
                console.error(`Invalid API response structure for ${type}:`, data);
                throw new Error(`Received invalid data structure from NS API for ${type}.`);
            }
            // Ensure departures conform to Journey interface (direction is expected)
             return departureData.payload.departures.map(dep => ({
                ...dep,
                origin: undefined // Explicitly set origin as undefined for departures
            }));
        } else { // type === 'arrivals'
            const arrivalData = data as ArrivalsResponse;
            if (!arrivalData.payload || !Array.isArray(arrivalData.payload.arrivals)) {
                console.error(`Invalid API response structure for ${type}:`, data);
                throw new Error(`Received invalid data structure from NS API for ${type}.`);
            }
            // Arrivals payload has 'origin' directly. 'direction' might be missing or irrelevant.
            // Ensure the returned objects conform to the Journey interface.
            return arrivalData.payload.arrivals.map(arr => {
                // Create a new object conforming to Journey, explicitly setting fields
                const journey: Journey = {
                    // Map required fields from arrival object 'arr'
                    product: arr.product,
                    plannedDateTime: arr.plannedDateTime,
                    actualDateTime: arr.actualDateTime,
                    trainCategory: arr.trainCategory,
                    cancelled: arr.cancelled,
                    routeStations: arr.routeStations, // Assuming these exist
                    // Optional fields
                    origin: arr.origin, // Use the origin field directly
                    direction: undefined, // Explicitly set direction as undefined for arrivals
                    plannedTrack: arr.plannedTrack,
                    actualTrack: arr.actualTrack,
                    messages: arr.messages,
                };
                // Add any other fields from arr if necessary, ensuring type safety
                // e.g., if arr has other properties not explicitly listed but desired:
                // journey = { ...arr, ...journey }; // Be careful with overwrites

                return journey;
            });
        }

    } catch (error) {
        console.error(`An error occurred while fetching or processing NS ${type}:`, error);
        if (error instanceof Error) {
            throw error;
        } else {
            throw new Error(`An unknown error occurred during NS API request for ${type}.`);
        }
    }
}

// Function to fetch departures for a given station
export async function getDepartures(stationCode: string): Promise<Journey[]> {
    return fetchJourneys(stationCode, 'departures');
}

// Function to fetch arrivals for a given station
export async function getArrivals(stationCode: string): Promise<Journey[]> {
    return fetchJourneys(stationCode, 'arrivals');
}

// --- Function to fetch Train Composition Details ---
// Returns an object with length, parts, and potentially destination, or null on failure
export async function getTrainComposition(trainNumber: string): Promise<{ length: number; parts: TrainUnit[]; destination?: string } | null> {
  const apiKey = process.env.NSR_API_KEY;

  if (!apiKey) {
    console.error("Error: NSR_API_KEY environment variable is not set for getTrainComposition.");
    return null; // Return null if API key is missing
  }

  const apiUrl = `https://gateway.apiportal.ns.nl/virtual-train-api/v1/trein/${trainNumber}`;

  try {
    console.log(`[DEBUG] Fetching Composition URL: ${apiUrl}`); // Add debug log
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey,
        'Accept': 'application/json',
      },
      cache: 'no-store', // Use appropriate caching strategy
    });

    if (!response.ok) {
      // Handle cases like 404 Not Found if composition isn't available
      if (response.status === 404) {
        // Don't warn for 404, it's common if composition isn't available for that train/time
        // console.warn(`Composition data not found for train ${trainNumber} (Status 404)`);
        return null;
      }
      const errorBody = await response.text(); // Use const
      console.error(`Error fetching composition for train ${trainNumber}: ${response.status} ${response.statusText}`, errorBody);
      // Depending on requirements, might return null or throw
      return null;
    }

    const data: CompositionResponse = await response.json();

    // Check for expected structure
    if (typeof data.lengte === 'number' && Array.isArray(data.materieeldelen)) {
      // console.log(`Composition found for train ${trainNumber}, length: ${data.lengte}, parts: ${data.materieeldelen.length}, richting: ${data.richting}`); // Keep commented
      return {
        length: data.lengte,
        parts: data.materieeldelen,
        destination: data.richting // Include destination if present
      };
    } else {
      console.warn(`Could not determine composition from response for train ${trainNumber}. Missing 'lengte' or 'materieeldelen'. Response keys:`, Object.keys(data));
      return null;
    }

  } catch (error) {
    console.error(`An error occurred while fetching composition for train ${trainNumber}:`, error);
    return null; // Return null on error
  }
}

// --- Function to fetch Journey Destination ---
// Uses the /journey endpoint to find the final destination based on train number
export async function getJourneyDestination(trainNumber: string): Promise<string | null> {
    const apiKey = process.env.NSR_API_KEY;

    if (!apiKey) {
        console.error("Error: NSR_API_KEY environment variable is not set for getJourneyDestination.");
        return null;
    }

    const apiUrl = `https://gateway.apiportal.ns.nl/reisinformatie-api/api/v2/journey?train=${trainNumber}`;

    try {
        console.log(`[DEBUG] Fetching Journey Details URL: ${apiUrl}`); // Add debug log
        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Ocp-Apim-Subscription-Key': apiKey,
                'Accept': 'application/json',
            },
            cache: 'no-store', // Or appropriate caching
        });

        if (!response.ok) {
            // Handle 404 or other errors gracefully
            if (response.status === 404) {
                 console.warn(`Journey details not found for train ${trainNumber} (Status 404)`);
                 return null;
            }
            const errorBody = await response.text(); // Use const
            console.error(`Error fetching journey details for train ${trainNumber}: ${response.status} ${response.statusText}`, errorBody);
            return null;
        }

        const data: JourneyDetailsResponse = await response.json();

        // Find the destination from the stops array
        // The destination is often listed in the *last* stop of the journey
        if (data.payload && Array.isArray(data.payload.stops) && data.payload.stops.length > 0) {
            // Check the last stop first, as it often contains the final destination
            const lastStop = data.payload.stops[data.payload.stops.length - 1];
            if (lastStop.destination) {
                return lastStop.destination;
            }
            // Fallback: Sometimes the destination might be in an earlier stop's 'destination' field
            // This logic might need refinement based on observing more API responses
            for (const stop of data.payload.stops) {
                if (stop.destination) {
                    return stop.destination;
                }
            }
        }

        console.warn(`Could not determine destination from journey details response for train ${trainNumber}.`);
        return null; // Destination not found in the expected place

    } catch (error) {
        console.error(`An error occurred while fetching journey details for train ${trainNumber}:`, error);
        return null; // Return null on error
    }
}