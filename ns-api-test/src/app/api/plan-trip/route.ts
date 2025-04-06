import { NextRequest, NextResponse } from 'next/server';

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

        const data = await response.json();
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