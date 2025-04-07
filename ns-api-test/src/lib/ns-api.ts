// src/lib/ns-api.ts

// Define interfaces for the NS API departure response structure
// Based on typical structure, might need refinement based on actual API response
export interface TrainProduct { // Exported
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

export interface DepartureMessage {
  message: string;
  style: string;
}

// Renamed from Departure as it's used for both departures and arrivals
export interface Journey {
  product: TrainProduct;
  origin?: string;
  direction?: string;
  plannedDateTime: string;
  plannedTrack?: string;
  actualDateTime: string;
  actualTrack?: string;
  trainCategory: string;
  cancelled: boolean;
  routeStations: RouteStation[];
  messages?: DepartureMessage[];
  originPlannedDepartureTime?: string;
}

// Payload structure for Departures
interface DeparturesPayload {
  source: string;
  departures: Journey[];
}

// Payload structure for Arrivals
interface ArrivalsPayload {
    source: string;
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
        [key: string]: unknown;
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
export interface TrainUnit {
  type: string;
  materieelnummer: number;
  afbeelding?: string;
  eindbestemming?: string;
}

interface CompositionResponse {
  materieeldelen: TrainUnit[];
  lengte: number;
  richting?: string;
}

// --- Interfaces for Journey Details API (/journey) ---

// Basic interface for stock information within JourneyStop
interface StockInfo {
    trainType?: string;
    numberOfSeats?: number;
    numberOfParts?: number;
    trainParts?: {
        stockIdentifier?: string;
        facilities?: string[];
        image?: { uri?: string };
    }[];
    hasSignificantChange?: boolean;
}

// Exporting JourneyStop as it's used in the Leg interface
export interface JourneyStop {
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
    destination?: string;
    status?: string;
    kind?: string;
    arrivals?: {
        product?: TrainProduct;
        origin?: { name?: string; uicCode?: string };
        destination?: { name?: string; uicCode?: string };
        plannedTime?: string;
        actualTime?: string;
        delayInSeconds?: number;
        cancelled?: boolean;
        plannedTrack?: string;
        actualTrack?: string;
        stockIdentifiers?: string[];
    }[];
    departures?: {
        product?: TrainProduct;
        origin?: { name?: string; uicCode?: string };
        destination?: { name?: string; uicCode?: string };
        plannedTime?: string;
        actualTime?: string;
        delayInSeconds?: number;
        cancelled?: boolean;
        plannedTrack?: string;
        actualTrack?: string;
        stockIdentifiers?: string[];
    }[];
    actualStock?: StockInfo;
    plannedStock?: StockInfo;
    platformFeatures?: unknown[];
    coachCrowdForecast?: unknown[];
}

interface JourneyDetailsPayload {
    notes: unknown[];
    productNumbers: string[];
    stops: JourneyStop[];
}

interface JourneyDetailsResponse {
    payload: JourneyDetailsPayload;
}

// --- Interfaces for Disruptions API (/disruptions/station) ---
interface Situation {
  label?: string;
}

interface SummaryAdditionalTravelTime {
  label?: string;
}

interface Timespan {
  period?: string;
  start?: string;
  end?: string;
  situation?: Situation;
  cause?: { label?: string };
  advices?: string[];
}

export interface Disruption {
  id: string;
  type: "CALAMITY" | "DISRUPTION" | "MAINTENANCE";
  isActive: boolean;
  title: string;
  topic?: string;
  situation?: Situation;
  summaryAdditionalTravelTime?: SummaryAdditionalTravelTime;
  timespans?: Timespan[];
  expectedDuration?: { description?: string };
}

// --- Trip Planning Interfaces (from TripResultDisplay, now centralized) ---
export interface StopTimeInfo {
    name: string;
    plannedDateTime?: string;
    actualDateTime?: string;
    plannedTrack?: string;
    actualTrack?: string;
    exitSide?: string;
    uicCode?: string;
}

export interface LegNote {
    value: string;
    key?: string;
    noteType?: string;
    isPresentationRequired?: boolean;
}

export interface Leg { // Exported
    idx: string;
    name?: string;
    direction?: string;
    origin: StopTimeInfo;
    destination: StopTimeInfo;
    product?: TrainProduct; // Use exported TrainProduct
    notes?: LegNote[];
    cancelled?: boolean;
    changePossible?: boolean;
    alternativeTransport?: boolean;
    stops?: JourneyStop[]; // Use exported JourneyStop
    trainType?: string | null;
}

export interface TripNote {
    message: string;
    type?: string;
}

export interface LabelListItem {
    label: string;
    stickerType?: string;
}

export interface Trip { // Exported
    uid: string;
    plannedDurationInMinutes: number;
    actualDurationInMinutes?: number;
    transfers: number;
    status: string;
    legs: Leg[];
    messages?: TripNote[];
    labelListItems?: LabelListItem[];
    productFare?: {
        priceInCents?: number;
        supplementInCents?: number;
    };
}


// Shared function to fetch journeys (departures or arrivals)
async function fetchJourneys(stationCode: string, type: 'departures' | 'arrivals', dateTime?: string): Promise<Journey[]> {
    const apiKey = process.env.NSR_API_KEY;

    if (!apiKey) {
        console.error(`Error: NSR_API_KEY environment variable is not set for ${type}.`);
        throw new Error("NS API Key is missing. Please configure it in .env.local");
    }

    const baseUrl = `https://gateway.apiportal.ns.nl/reisinformatie-api/api/v2/${type}`;
    const params = new URLSearchParams({
        lang: 'en',
        station: stationCode,
        maxJourneys: '50',
    });
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
            try { errorBody = await response.text(); } catch { /* Ignore */ }
            console.error(`[ns-api.ts] Error fetching NS ${type} for station ${stationCode}. Status: ${response.status} ${response.statusText}. Body:`, errorBody);
            throw new Error(`Failed to fetch ${type}. Status: ${response.status}. Body: ${errorBody}`);
        }

        const data = await response.json();

        if (type === 'departures') {
            const departureData = data as DeparturesResponse;
            if (!departureData.payload || !Array.isArray(departureData.payload.departures)) {
                console.error(`Invalid API response structure for ${type}:`, data);
                throw new Error(`Received invalid data structure from NS API for ${type}.`);
            }
             return departureData.payload.departures.map(dep => ({
                ...dep,
                origin: undefined
            }));
        } else { // type === 'arrivals'
            const arrivalData = data as ArrivalsResponse;
            if (!arrivalData.payload || !Array.isArray(arrivalData.payload.arrivals)) {
                console.error(`Invalid API response structure for ${type}:`, data);
                throw new Error(`Received invalid data structure from NS API for ${type}.`);
            }
            return arrivalData.payload.arrivals.map(arr => {
                const journey: Journey = {
                    product: arr.product,
                    plannedDateTime: arr.plannedDateTime,
                    actualDateTime: arr.actualDateTime,
                    trainCategory: arr.trainCategory,
                    cancelled: arr.cancelled,
                    routeStations: arr.routeStations,
                    origin: arr.origin,
                    direction: undefined,
                    plannedTrack: arr.plannedTrack,
                    actualTrack: arr.actualTrack,
                    messages: arr.messages,
                };
                return journey;
            });
        }

    } catch (error) {
        console.error(`An error occurred while fetching or processing NS ${type}:`, error);
        if (error instanceof Error) { throw error; }
        else { throw new Error(`An unknown error occurred during NS API request for ${type}.`); }
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
export async function getTrainComposition(trainNumber: string, stationCode: string): Promise<{ length: number; parts: TrainUnit[]; destination?: string } | null> {
  const apiKey = process.env.NSR_API_KEY;
  if (!apiKey) { console.error("Error: NSR_API_KEY environment variable is not set for getTrainComposition."); return null; }
  const apiUrl = `https://gateway.apiportal.ns.nl/virtual-train-api/v1/trein/${trainNumber}/${stationCode}`;
  try {
    const response = await fetch(apiUrl, { method: 'GET', headers: { 'Ocp-Apim-Subscription-Key': apiKey, 'Accept': 'application/json' }, cache: 'no-store' });
    if (!response.ok) {
      if (response.status === 404) { console.warn(`Composition data not found for train ${trainNumber} at station ${stationCode} (Status 404)`); return null; }
      const errorBody = await response.text();
      console.error(`Error fetching composition for train ${trainNumber} at station ${stationCode}: ${response.status} ${response.statusText}`, errorBody);
      return null;
    }
    const data: CompositionResponse = await response.json();
    if (typeof data.lengte === 'number' && Array.isArray(data.materieeldelen)) {
      return { length: data.lengte, parts: data.materieeldelen, destination: data.richting };
    } else {
      console.warn(`Could not determine composition from response for train ${trainNumber} at station ${stationCode}. Missing 'lengte' or 'materieeldelen'. Response keys:`, Object.keys(data));
      return null;
    }
  } catch (error) { console.error(`An error occurred while fetching composition for train ${trainNumber} at station ${stationCode}:`, error); return null; }
}

// --- Function to fetch Journey Destination ---
export async function getJourneyDestination(trainNumber: string): Promise<string | null> {
    const apiKey = process.env.NSR_API_KEY;
    if (!apiKey) { console.error("Error: NSR_API_KEY environment variable is not set for getJourneyDestination."); return null; }
    const apiUrl = `https://gateway.apiportal.ns.nl/reisinformatie-api/api/v2/journey?train=${trainNumber}`;
    try {
        const response = await fetch(apiUrl, { method: 'GET', headers: { 'Ocp-Apim-Subscription-Key': apiKey, 'Accept': 'application/json' }, cache: 'no-store' });
        if (!response.ok) {
            if (response.status === 404) { console.warn(`Journey details not found for train ${trainNumber} (Status 404)`); return null; }
            const errorBody = await response.text();
            console.error(`Error fetching journey details for train ${trainNumber}: ${response.status} ${response.statusText}`, errorBody);
            return null;
        }
        const data: JourneyDetailsResponse = await response.json();
        if (data.payload && Array.isArray(data.payload.stops) && data.payload.stops.length > 0) {
            const lastStop = data.payload.stops[data.payload.stops.length - 1];
            if (lastStop.destination) { return lastStop.destination; }
            for (const stop of data.payload.stops) { if (stop.destination) { return stop.destination; } }
        }
        console.warn(`Could not determine destination from journey details response for train ${trainNumber}.`);
        return null;
    } catch (error) { console.error(`An error occurred while fetching journey details for train ${trainNumber}:`, error); return null; }
}

// --- Function to fetch Journey Origin Departure Time ---
export async function getJourneyOriginDepartureTime(trainNumber: string): Promise<string | null> {
    const apiKey = process.env.NSR_API_KEY;
    if (!apiKey) { console.error("Error: NSR_API_KEY environment variable is not set for getJourneyOriginDepartureTime."); return null; }
    const apiUrl = `https://gateway.apiportal.ns.nl/reisinformatie-api/api/v2/journey?train=${trainNumber}`;
    try {
        const response = await fetch(apiUrl, { method: 'GET', headers: { 'Ocp-Apim-Subscription-Key': apiKey, 'Accept': 'application/json' }, cache: 'no-store' });
        if (!response.ok) {
            if (response.status === 404) { console.warn(`Journey details not found for train ${trainNumber} (Status 404) when fetching origin time.`); return null; }
            const errorBody = await response.text();
            console.error(`Error fetching journey details for train ${trainNumber} (origin time): ${response.status} ${response.statusText}`, errorBody);
            return null;
        }
        const data: JourneyDetailsResponse = await response.json();
        if (data.payload && Array.isArray(data.payload.stops) && data.payload.stops.length > 0) {
            const originStop = data.payload.stops[0];
            if (originStop.departures && originStop.departures.length > 0 && originStop.departures[0].plannedTime) {
                return originStop.departures[0].plannedTime;
            } else { console.warn(`Origin stop for train ${trainNumber} found, but missing departures[0].plannedTime.`); }
        } else { console.warn(`Could not find stops array or it was empty for train ${trainNumber} when fetching origin time.`); }
        return null;
    } catch (error) { console.error(`An error occurred while fetching journey details for train ${trainNumber} (origin time):`, error); return null; }
}

// --- Function to fetch Journey Stock Details (Train Type) ---
export async function getJourneyStockDetails(
    trainNumber: string,
    dateTime: string,
    departureUicCode: string,
    arrivalUicCode: string
): Promise<string | null> {
    const apiKey = process.env.NSR_API_KEY;
    if (!apiKey) { console.error("Error: NSR_API_KEY environment variable is not set for getJourneyStockDetails."); return null; }
    const params = new URLSearchParams({ train: trainNumber, dateTime: dateTime, departureUicCode: departureUicCode, arrivalUicCode: arrivalUicCode });
    const apiUrl = `https://gateway.apiportal.ns.nl/reisinformatie-api/api/v2/journey?${params.toString()}`;
    try {
        const response = await fetch(apiUrl, { method: 'GET', headers: { 'Ocp-Apim-Subscription-Key': apiKey, 'Accept': 'application/json' }, cache: 'no-store' });
        if (!response.ok) {
            if (response.status === 404) { console.warn(`Journey stock details not found for train ${trainNumber} (${departureUicCode} -> ${arrivalUicCode}) at ${dateTime} (Status 404)`); return null; }
            const errorBody = await response.text();
            console.error(`Error fetching journey stock details for train ${trainNumber}: ${response.status} ${response.statusText}`, errorBody);
            return null;
        }
        const data: JourneyDetailsResponse = await response.json();
        if (data.payload && Array.isArray(data.payload.stops) && data.payload.stops.length > 0) {
            const firstStop = data.payload.stops[0];
             if (firstStop?.actualStock?.trainType || firstStop?.plannedStock?.trainType) {
                 const trainType = firstStop.actualStock?.trainType || firstStop.plannedStock?.trainType;
                 if (trainType) { return trainType; }
             }
             const stopWithStock = data.payload.stops.find(stop => stop.actualStock?.trainType || stop.plannedStock?.trainType);
             if (stopWithStock) {
                 const trainType = stopWithStock.actualStock?.trainType || stopWithStock.plannedStock?.trainType;
                 if (trainType) { return trainType; }
             }
        }
        console.warn(`Could not determine trainType from journey details response for train ${trainNumber} (${departureUicCode} -> ${arrivalUicCode}) at ${dateTime}.`);
        return null;
    } catch (error) { console.error(`An error occurred while fetching journey stock details for train ${trainNumber}:`, error); return null; }
}

// --- Function to fetch Station Disruptions ---
export async function getStationDisruptions(stationCode: string): Promise<Disruption[]> {
    const apiKey = process.env.NSR_API_KEY;
    if (!apiKey) { console.error("Error: NSR_API_KEY environment variable is not set for getStationDisruptions."); return []; }
    const apiUrl = `https://gateway.apiportal.ns.nl/reisinformatie-api/api/v3/disruptions/station/${stationCode}`;
    try {
        const response = await fetch(apiUrl, { method: 'GET', headers: { 'Ocp-Apim-Subscription-Key': apiKey, 'Accept': 'application/json' }, cache: 'no-store' });
        if (!response.ok) {
            if (response.status === 404) { console.log(`No disruptions found for station ${stationCode} (Status 404)`); return []; }
            const errorBody = await response.text();
            console.error(`[ns-api.ts] Error fetching NS disruptions for station ${stationCode}. Status: ${response.status} ${response.statusText}. Body:`, errorBody);
            throw new Error(`Failed to fetch disruptions. Status: ${response.status}. Body: ${errorBody}`);
        }
        const data: Disruption[] = await response.json();
        return data;
    } catch (error) {
        console.error(`[ns-api.ts] An error occurred while fetching or processing NS disruptions for station ${stationCode}:`, error);
        if (error instanceof Error) { throw error; }
        else { throw new Error(`An unknown error occurred during NS API request for disruptions.`); }
    }
}