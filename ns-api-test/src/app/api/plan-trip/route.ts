import { NextRequest, NextResponse } from 'next/server';
import { getJourneyStockDetails } from '@/lib/ns-api'; // Import the new function
import type { Trip, Leg } from '@/lib/ns-api'; // Import types (adjust path if needed)

export async function POST(request: NextRequest) {
    const apiKey = process.env.NSR_API_KEY; // Use the correct environment variable name

    if (!apiKey) {
        console.error('NSR_API_KEY environment variable is not set.'); // Update error message
        return NextResponse.json({ error: 'Server configuration error: API key missing.' }, { status: 500 });
    }

    try {
        const settings = await request.json();

        // Construct query parameters, filtering out null/undefined/empty values
        const params = new URLSearchParams();
        for (const key in settings) {
            const value = settings[key];
            if (value !== null && value !== undefined && value !== '') {
                // Handle boolean values explicitly
                if (typeof value === 'boolean') {
                    params.append(key, String(value));
                }
                // Handle arrays (assuming comma-separated string format for NS API)
                else if (Array.isArray(value)) {
                     if (value.length > 0) {
                        params.append(key, value.join(','));
                     }
                }
                // Handle other types
                else {
                    params.append(key, String(value));
                }
            }
        }

        const apiUrl = `https://gateway.apiportal.ns.nl/reisinformatie-api/api/v3/trips?${params.toString()}`;

        console.log(`Fetching from NS API: ${apiUrl}`); // Log the URL for debugging (without API key)

        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Ocp-Apim-Subscription-Key': apiKey,
                'Accept': 'application/json', // Ensure we request JSON
            },
            cache: 'no-store', // Ensure fresh data for trip planning
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`NS API Error (${response.status}): ${errorText}`);
            // Try to parse error if it's JSON, otherwise return text
            let errorJson = null;
            try {
                errorJson = JSON.parse(errorText);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            } catch (_e) { // Ignore parsing error
                // Ignore parsing error
            }
            return NextResponse.json(
                { error: `Failed to fetch trip data from NS API. Status: ${response.status}`, details: errorJson || errorText },
                { status: response.status }
            );
        }

        const data: { trips: Trip[] } = await response.json(); // Add type annotation

        // --- Enrich legs with trainType ---
        if (data.trips && data.trips.length > 0) {
            const stockDetailPromises = [];
            const legRefs: { tripIndex: number; legIndex: number; leg: Leg }[] = []; // Keep track of which promise belongs to which leg

            for (let tripIndex = 0; tripIndex < data.trips.length; tripIndex++) {
                const trip = data.trips[tripIndex];
                for (let legIndex = 0; legIndex < trip.legs.length; legIndex++) {
                    const leg = trip.legs[legIndex];
                    // Only fetch for train legs with necessary info
                    if (leg.product?.type === 'TRAIN' && leg.product.number && leg.origin.plannedDateTime && leg.origin.uicCode && leg.destination.uicCode) {
                        legRefs.push({ tripIndex, legIndex, leg });
                        stockDetailPromises.push(
                            getJourneyStockDetails(
                                leg.product.number,
                                leg.origin.plannedDateTime, // Use planned time as reference
                                leg.origin.uicCode,
                                leg.destination.uicCode
                            )
                        );
                    }
                }
            }

            // Fetch all stock details concurrently and handle results/errors
            const stockDetailResults = await Promise.allSettled(stockDetailPromises);

            stockDetailResults.forEach((result, index) => {
                const { tripIndex, legIndex } = legRefs[index];
                if (result.status === 'fulfilled' && result.value) {
                    // Add trainType to the leg object (ensure leg object allows this property)
                    // We'll need to adjust the Leg interface later
                    (data.trips[tripIndex].legs[legIndex] as any).trainType = result.value;
                } else if (result.status === 'rejected') {
                    console.warn(`Failed to fetch stock details for leg ${legRefs[index].leg.idx}:`, result.reason);
                    // Optionally add a null or error indicator to the leg
                    // (data.trips[tripIndex].legs[legIndex] as any).trainType = null;
                }
            });
        }
        // --- End Enrichment ---

        return NextResponse.json(data);

    } catch (error) {
        console.error('Error in /api/plan-trip:', error);
        let errorMessage = 'Internal Server Error';
        if (error instanceof Error) {
            errorMessage = error.message;
        }
        return NextResponse.json({ error: 'Failed to process trip planning request.', details: errorMessage }, { status: 500 });
    }
}

// Optional: Add OPTIONS method if needed for CORS preflight requests,
// though typically not required for same-origin API routes in Next.js.
// export async function OPTIONS() {
//   return new Response(null, {
//     status: 204,
//     headers: {
//       'Allow': 'POST, OPTIONS',
//     },
//   });
// }