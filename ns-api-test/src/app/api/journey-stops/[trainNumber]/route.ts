// src/app/api/journey-stops/[trainNumber]/route.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Re-use or define necessary interfaces (can also be imported from ns-api.ts if structure allows)
// Interface for a single arrival or departure event at a stop
interface StopEvent {
    plannedTime: string; // ISO 8601 format
    actualTime?: string;  // ISO 8601 format (optional)
    delayInSeconds?: number;
    cancelled?: boolean;
    // Add other potential fields like track if needed
}

// Updated interface for the overall stop information
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
    destination?: string;
    arrivals: StopEvent[];   // Array of arrival events (usually just one)
    departures: StopEvent[]; // Array of departure events (usually just one)
    // Add other potential fields like status if needed
}

interface JourneyDetailsPayload {
    notes: unknown[];
    productNumbers: string[];
    stops: JourneyStop[];
    // Add other potential fields
}

interface JourneyDetailsResponse {
    payload: JourneyDetailsPayload;
    // Add other potential fields like links, meta if needed
}


export async function GET(request: NextRequest, props: { params: Promise<{ trainNumber: string }> }) {
    const params = await props.params;
    const trainNumber = params.trainNumber;
    const apiKey = process.env.NSR_API_KEY;

    if (!apiKey) {
        console.error("Error: NSR_API_KEY environment variable is not set.");
        return NextResponse.json({ error: "NS API Key is missing" }, { status: 500 });
    }

    if (!trainNumber) {
        return NextResponse.json({ error: "Train number is required" }, { status: 400 });
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
            // Handle 404 or other errors gracefully
            const errorBody = await response.text();
            console.error(`Error fetching journey details for train ${trainNumber}: ${response.status} ${response.statusText}`, errorBody);
            // Return a more specific error based on status code if needed
             if (response.status === 404) {
                 return NextResponse.json({ error: `Journey details not found for train ${trainNumber}` }, { status: 404 });
             }
            return NextResponse.json({ error: `Failed to fetch journey details. Status: ${response.status}` }, { status: response.status });
        }

        const data: JourneyDetailsResponse = await response.json();

        // Extract the stops array
        // Return the entire payload, which includes stops and notes
        if (data.payload) {
            return NextResponse.json(data.payload);
        } else {
            console.warn(`Could not find payload in journey details response for train ${trainNumber}.`);
            return NextResponse.json({ error: "Payload data not found in API response" }, { status: 404 }); // Or 500 if unexpected
        }

    } catch (error) {
        console.error(`An error occurred while fetching journey details for train ${trainNumber}:`, error);
        return NextResponse.json({ error: "An internal server error occurred" }, { status: 500 });
    }
}