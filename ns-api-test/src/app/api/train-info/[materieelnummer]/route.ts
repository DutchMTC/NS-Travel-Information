import { NextRequest, NextResponse } from 'next/server';


const NSR_API_KEY = process.env.NSR_API_KEY;
const VIRTUAL_TRAIN_API_URL = 'https://gateway.apiportal.ns.nl/virtual-train-api/v1/ritnummer';
const REISINFORMATIE_API_URL = 'https://gateway.apiportal.ns.nl/reisinformatie-api/api/v2/journey';

// RitNummerResponse interface might not be needed if API returns plain text/number

// Updated types based on the provided API response structure

interface StationInfo {
    name: string;
    lng: number;
    lat: number;
    countryCode: string;
    uicCode: string;
}

interface Product {
    number: string;
    categoryCode: string;
    shortCategoryName: string;
    longCategoryName: string;
    operatorCode: string;
    operatorName: string;
    type: string; // e.g., "TRAIN"
}

interface ArrivalDeparture {
    product: Product;
    origin: StationInfo;
    destination: StationInfo;
    plannedTime: string;
    actualTime?: string;
    delayInSeconds?: number;
    plannedTrack?: string;
    actualTrack?: string;
    cancelled: boolean;
    punctuality?: number; // Only on arrivals?
    crowdForecast?: string; // e.g., "LOW", "MEDIUM", "HIGH", "UNKNOWN"
    stockIdentifiers?: string[];
}

interface TrainPart {
    stockIdentifier: string;
    destination?: StationInfo; // Optional, might not be present on all parts
    facilities: string[]; // e.g., ["WIFI", "TOILET"]
    image?: { uri: string };
}

interface StockInfo {
    trainType: string;
    numberOfSeats: number;
    numberOfParts: number;
    trainParts: TrainPart[];
    hasSignificantChange: boolean;
}

interface Stop {
    id: string;
    stop: StationInfo;
    previousStopId: string[];
    nextStopId: string[];
    destination?: string; // Final destination name for this stop
    status: string; // e.g., "ORIGIN", "STOP", "PASSING", "DESTINATION"
    arrivals: ArrivalDeparture[];
    departures: ArrivalDeparture[];
    actualStock?: StockInfo;
    plannedStock?: StockInfo;
    platformFeatures?: unknown[]; // Define further if needed
    coachCrowdForecast?: unknown[]; // Define further if needed
}

interface JourneyStopsApiResponse {
    payload: {
        notes?: unknown[]; // Define further if needed
        productNumbers?: string[];
        stops: Stop[];
        allowCrowdReporting?: boolean;
        source?: string;
    };
    // Add other potential top-level fields if any
}


export async function GET(
    _request: NextRequest, // Parameter is required by Next.js but not used in this function
    props: { params: Promise<{ materieelnummer: string }> }
) {
    const params = await props.params;
    const materieelnummer = params.materieelnummer;

    if (!NSR_API_KEY) {
        console.error('NSR_API_KEY is not set in environment variables.');
        return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    if (!materieelnummer) {
        return NextResponse.json({ error: 'Materieelnummer is required' }, { status: 400 });
    }

    try {
        // 1. Fetch Ritnummer from Materieelnummer
        const ritnummerResponse = await fetch(`${VIRTUAL_TRAIN_API_URL}/${materieelnummer}`, {
            headers: {
                'Ocp-Apim-Subscription-Key': NSR_API_KEY, // Reverted to standard header
                'Cache-Control': 'no-cache', // Advised by NS API docs for real-time data
            },
        });

        if (!ritnummerResponse.ok) {
            // Handle cases where materieelnummer is not found or other API errors
            // If ritnummer lookup fails with 404, it means the train isn't active
            if (ritnummerResponse.status === 404) {
                 return NextResponse.json({ error: "This train is not currently in service." }, { status: 404 });
            }
            console.error(`Error fetching ritnummer: ${ritnummerResponse.status} ${ritnummerResponse.statusText}`);
            const errorBody = await ritnummerResponse.text();
            console.error("Error body:", errorBody);
            return NextResponse.json({ error: 'Failed to fetch ritnummer from NS API' }, { status: ritnummerResponse.status });
        }

        // Attempt to parse as text first, then as number
        let ritNummer: number | null = null;
        try {
            const ritnummerText = await ritnummerResponse.text();
            const parsedNum = parseInt(ritnummerText.trim(), 10);
            if (!isNaN(parsedNum)) {
                ritNummer = parsedNum;
            } else {
                 // Fallback: Try parsing as JSON if text wasn't a number
                 console.warn("Ritnummer response was not plain text number, attempting JSON parse.");
                 try {
                     const ritnummerData = JSON.parse(ritnummerText); // Use the text we already fetched
                     if (ritnummerData && typeof ritnummerData.ritNummer === 'number') {
                         ritNummer = ritnummerData.ritNummer;
                     }
                 } catch (jsonError) {
                     console.error("Failed to parse ritnummer response as JSON either:", jsonError);
                 }
            }
        } catch (textError) {
             console.error("Error reading ritnummer response as text:", textError);
             // Potentially try JSON parsing as a last resort if text reading fails?
             // For now, we'll let the null check handle it.
        }

        // If parsing failed to yield a ritNummer
        if (!ritNummer) {
             return NextResponse.json({ error: "Could not determine Ritnummer for this train." }, { status: 404 }); // Keep this distinct? Or use the generic one? Let's use the generic one for consistency.
             // return NextResponse.json({ error: "This train is not currently in service." }, { status: 404 });
        }

        const journeyApiUrl = `${REISINFORMATIE_API_URL}?train=${ritNummer}`; // Use 'train' query parameter

        // 2. Fetch Journeys using Ritnummer
        const journeyResponse = await fetch(journeyApiUrl, { // Use the constructed URL
             headers: {
                'Ocp-Apim-Subscription-Key': NSR_API_KEY,
                'Cache-Control': 'no-cache',
            },
        });

        if (!journeyResponse.ok) {
             // If journey lookup fails (e.g., 400 Bad Request, 404 Not Found for the ritnummer), treat as not in service
             if (journeyResponse.status === 404 || journeyResponse.status === 400) {
                 console.warn(`Journey lookup for ritnummer ${ritNummer} failed with status ${journeyResponse.status}. Assuming train not in service.`);
                 return NextResponse.json({ error: "This train is not currently in service." }, { status: 404 });
             }
             // Handle other potential errors (e.g., 500)
             const errorMsg = `Failed to fetch journey stops from NS API (Status: ${journeyResponse.status})`;
             try {
                 const errorBodyText = await journeyResponse.text();
                 console.error(`Error fetching journey stops: ${journeyResponse.status} ${journeyResponse.statusText}`);
                 console.error("NS API Error body:", errorBodyText);
                 // Attempt to parse for more specific message (optional)
                 // ... (parsing logic omitted for brevity, can be added back if needed)
             } catch (readError) {
                  console.error("Could not read error body from NS API response:", readError);
             }
             return NextResponse.json({ error: errorMsg }, { status: journeyResponse.status });
        }

        const journeyData: JourneyStopsApiResponse = await journeyResponse.json();

        // Check if the payload or stops array is empty after a successful fetch
        if (!journeyData.payload?.stops || journeyData.payload.stops.length === 0) {
            console.warn(`Journey lookup for ritnummer ${ritNummer} succeeded but returned no stops. Assuming train not in service.`);
            return NextResponse.json({ error: "This train is not currently in service." }, { status: 404 });
        }

        // Return the stops payload if found
        return NextResponse.json(journeyData.payload.stops, { status: 200 });

    } catch (error) {
        console.error('Internal server error:', error);
        return NextResponse.json({ error: 'Internal server error processing request' }, { status: 500 });
    }
}