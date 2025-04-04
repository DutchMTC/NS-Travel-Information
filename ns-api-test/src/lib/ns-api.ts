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
  originPlannedDepartureTime?: string; // <<< ADDED FIELD
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
        [key: string]: unknown; // Use unknown instead of any for better type safety
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
  eindbestemming?: string; // Destination specific to this part
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
    // Add arrival/departure details within the stop object
    arrival?: { // Make optional
        plannedTime?: string;
        actualTime?: string;
        delayInSeconds?: number;
        cancelled?: boolean;
        plannedTrack?: string;
        actualTrack?: string;
    };
    departure?: { // Make optional
        plannedTime?: string;
        actualTime?: string;
        delayInSeconds?: number;
        cancelled?: boolean;
        plannedTrack?: string;
        actualTrack?: string;
    };
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

// --- Interfaces for Disruptions API (/disruptions/station) ---
interface Situation {
  label?: string; // Make optional as it might not always be present
  // Add other fields if known from API response
}

interface SummaryAdditionalTravelTime {
  label?: string; // Make optional
  // Add other fields if known
}

interface Timespan {
  period?: string; // Make optional
  start?: string; // Add start time
  end?: string; // Add end time
  situation?: Situation; // Add nested situation object
  cause?: { label?: string }; // Add cause object
  advices?: string[]; // Add advices array
  // Add other fields like start/end dates if known
}

export interface Disruption {
  id: string;
  type: "CALAMITY" | "DISRUPTION" | "MAINTENANCE";
  isActive: boolean;
  title: string;
  topic?: string; // Make optional as it might not always be present
  situation?: Situation; // Add nested situation object
  summaryAdditionalTravelTime?: SummaryAdditionalTravelTime; // Add nested travel time object
  timespans?: Timespan[]; // Add array of timespans
  expectedDuration?: { description?: string }; // Add expected duration
  // Add other potential fields like 'description', 'publicationSections' if needed
}

// Shared function to fetch journeys (departures or arrivals)
async function fetchJourneys(stationCode: string, type: 'departures' | 'arrivals', dateTime?: string): Promise<Journey[]> {
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
    // Add dateTime parameter if provided
    if (dateTime) {
        params.set('dateTime', dateTime);
    }
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
            console.error(`[ns-api.ts] Error fetching NS ${type} for station ${stationCode}. Status: ${response.status} ${response.statusText}. Body:`, errorBody); // More detailed log
            throw new Error(`Failed to fetch ${type}. Status: ${response.status}. Body: ${errorBody}`); // Include body in thrown error
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

// Function to fetch departures for a given station, optionally at a specific time
export async function getDepartures(stationCode: string, dateTime?: string): Promise<Journey[]> {
    return fetchJourneys(stationCode, 'departures', dateTime);
}

// Function to fetch arrivals for a given station, optionally at a specific time
export async function getArrivals(stationCode: string, dateTime?: string): Promise<Journey[]> {
    return fetchJourneys(stationCode, 'arrivals', dateTime);
}

// --- Function to fetch Train Composition Details ---
// Returns an object with length, parts, and potentially destination, or null on failure
export async function getTrainComposition(trainNumber: string, stationCode: string): Promise<{ length: number; parts: TrainUnit[]; destination?: string } | null> {
  const apiKey = process.env.NSR_API_KEY;

  if (!apiKey) {
    console.error("Error: NSR_API_KEY environment variable is not set for getTrainComposition.");
    return null; // Return null if API key is missing
  }

  // Use the endpoint that includes the station code
  const apiUrl = `https://gateway.apiportal.ns.nl/virtual-train-api/v1/trein/${trainNumber}/${stationCode}`;

  try {
    // console.log(`[DEBUG] Fetching Composition URL for train ${trainNumber} at station ${stationCode}: ${apiUrl}`); // Removed debug log
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
        console.warn(`Composition data not found for train ${trainNumber} at station ${stationCode} (Status 404)`); // Updated warning
        return null;
      }
      const errorBody = await response.text(); // Use const
      console.error(`Error fetching composition for train ${trainNumber} at station ${stationCode}: ${response.status} ${response.statusText}`, errorBody); // Updated error log
      // Depending on requirements, might return null or throw
      return null;
    }

    const data: CompositionResponse = await response.json();

    // console.log(`[DEBUG] Raw NS Virtual Train API Response for train ${trainNumber} at station ${stationCode}:`, JSON.stringify(data, null, 2)); // Removed debug log

    // Check for expected structure
    if (typeof data.lengte === 'number' && Array.isArray(data.materieeldelen)) {
      // console.log(`Composition found for train ${trainNumber} at station ${stationCode}, length: ${data.lengte}, parts: ${data.materieeldelen.length}, richting: ${data.richting}`); // Updated comment
      return {
        length: data.lengte,
        parts: data.materieeldelen,
        destination: data.richting // Include destination if present
      };
    } else {
      console.warn(`Could not determine composition from response for train ${trainNumber} at station ${stationCode}. Missing 'lengte' or 'materieeldelen'. Response keys:`, Object.keys(data)); // Updated warning
      return null;
    }

  } catch (error) {
    console.error(`An error occurred while fetching composition for train ${trainNumber} at station ${stationCode}:`, error); // Updated error log
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
        // console.log(`[DEBUG] Fetching Journey Details URL: ${apiUrl}`); // Removed debug log
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


// --- Function to fetch Journey Origin Departure Time ---
// Uses the /journey endpoint to find the planned departure time from the origin station
export async function getJourneyOriginDepartureTime(trainNumber: string): Promise<string | null> {
    const apiKey = process.env.NSR_API_KEY;

    if (!apiKey) {
        console.error("Error: NSR_API_KEY environment variable is not set for getJourneyOriginDepartureTime.");
        return null;
    }

    const apiUrl = `https://gateway.apiportal.ns.nl/reisinformatie-api/api/v2/journey?train=${trainNumber}`;

    try {
        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Ocp-Apim-Subscription-Key': apiKey,
                'Accept': 'application/json',
            },
            cache: 'no-store', // Or appropriate caching
        });

        if (!response.ok) {
            if (response.status === 404) {
                 console.warn(`Journey details not found for train ${trainNumber} (Status 404) when fetching origin time.`);
                 return null;
            }
            const errorBody = await response.text();
            console.error(`Error fetching journey details for train ${trainNumber} (origin time): ${response.status} ${response.statusText}`, errorBody);
            return null;
        }

        const data: JourneyDetailsResponse = await response.json();

        // The origin station is typically the *first* stop in the list
        if (data.payload && Array.isArray(data.payload.stops) && data.payload.stops.length > 0) {
            const originStop = data.payload.stops[0];
            // Check if the departure object and its plannedTime exist
            if (originStop.departure && originStop.departure.plannedTime) {
                return originStop.departure.plannedTime; // Return the planned departure time ISO string
            } else {
                 console.warn(`Origin stop for train ${trainNumber} found, but missing departure.plannedTime.`);
            }
        } else {
             console.warn(`Could not find stops array or it was empty for train ${trainNumber} when fetching origin time.`);
        }

        return null; // Origin departure time not found

    } catch (error) {
        console.error(`An error occurred while fetching journey details for train ${trainNumber} (origin time):`, error);
        return null; // Return null on error
    }
}

// --- Function to fetch Station Disruptions ---
export async function getStationDisruptions(stationCode: string): Promise<Disruption[]> {
    const apiKey = process.env.NSR_API_KEY;

    if (!apiKey) {
        console.error("Error: NSR_API_KEY environment variable is not set for getStationDisruptions.");
        // Depending on requirements, might return empty array or throw
        return []; // Return empty array if API key is missing
    }

    // Use the V3 endpoint for disruptions
    const apiUrl = `https://gateway.apiportal.ns.nl/reisinformatie-api/api/v3/disruptions/station/${stationCode}`;

    try {
        // console.log(`[DEBUG] Fetching Disruptions URL: ${apiUrl}`); // Removed debug log
        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Ocp-Apim-Subscription-Key': apiKey,
                'Accept': 'application/json',
            },
            cache: 'no-store', // Or appropriate caching
        });

        if (!response.ok) {
            // Handle errors, e.g., 404 if no disruptions or other API issues
            if (response.status === 404) {
                 console.log(`No disruptions found for station ${stationCode} (Status 404)`);
                 return []; // No disruptions is not an error
            }
            const errorBody = await response.text();
            console.error(`[ns-api.ts] Error fetching NS disruptions for station ${stationCode}. Status: ${response.status} ${response.statusText}. Body:`, errorBody); // More detailed log
            // Re-throw the error so Promise.all catches it properly in the API route
            throw new Error(`Failed to fetch disruptions. Status: ${response.status}. Body: ${errorBody}`);
        }
const data: Disruption[] = await response.json();
// console.log(`[DEBUG] Raw NS Disruptions API Response for ${stationCode}:`, JSON.stringify(data, null, 2)); // Removed debug log

// Filter for active disruptions if needed, though the API might already do this
// return data.filter(d => d.isActive);
return data; // Return all disruptions fetched
        return data; // Return all disruptions fetched

    } catch (error) {
        console.error(`[ns-api.ts] An error occurred while fetching or processing NS disruptions for station ${stationCode}:`, error); // More detailed log
        // Re-throw the error so Promise.all catches it properly in the API route
        if (error instanceof Error) {
            throw error;
        } else {
            throw new Error(`An unknown error occurred during NS API request for disruptions.`);
        }
    }
}