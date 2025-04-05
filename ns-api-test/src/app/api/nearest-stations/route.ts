import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');

    if (!lat || !lng) {
        return NextResponse.json({ error: 'Latitude and longitude are required' }, { status: 400 });
    }

    const apiKey = process.env.NSR_API_KEY;
    if (!apiKey) {
        console.error('NSR_API_KEY is not set in environment variables.');
        return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const nsApiUrl = `https://gateway.apiportal.ns.nl/nsapp-stations/v3/nearest?lat=${lat}&lng=${lng}&limit=3`;

    try {
        const response = await fetch(nsApiUrl, {
            headers: {
                'Ocp-Apim-Subscription-Key': apiKey,
            },
            // Add caching: Revalidate every 60 seconds
            next: { revalidate: 60 }
        });

        if (!response.ok) {
            console.error(`NS API request failed with status: ${response.status}`);
            const errorBody = await response.text();
            console.error(`NS API error body: ${errorBody}`);
            return NextResponse.json({ error: `Failed to fetch data from NS API: ${response.statusText}` }, { status: response.status });
        }

        const data = await response.json();

        // Extract relevant station data, ensuring id.code is available
        // Define a type for the expected station structure in the payload
        type NsStationPayloadItem = {
          id: { code: string; [key: string]: unknown }; // Expect id with at least a code
          names: { long: string; [key: string]: unknown }; // Expect names with at least a long name
          [key: string]: unknown; // Allow other properties
        };
        const stations = data?.payload?.map((station: NsStationPayloadItem) => ({
            id: station.id, // Pass the whole id object which should contain 'code'
            names: station.names // Pass the names object
        })) || [];

        return NextResponse.json({ stations: stations });

    } catch (error) {
        console.error('Error fetching from NS API:', error);
        return NextResponse.json({ error: 'Internal server error while fetching station data' }, { status: 500 });
    }
}