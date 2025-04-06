const fs = require('fs');
const path = require('path');

// Use the current directory of the script to find the input file
const filePath = path.join(__dirname, 'travel_planner_output.txt');
const outputFilePath = path.join(__dirname, 'travel_summary.txt');

// Helper function to format date/time string into a readable format
function formatDateTime(dateTimeString) {
    if (!dateTimeString) return 'N/A';
    try {
        const date = new Date(dateTimeString);
        // Using Dutch locale and Amsterdam timezone for appropriate formatting
        return date.toLocaleString('nl-NL', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit',
            timeZone: 'Europe/Amsterdam'
        });
    } catch (e) {
        console.warn(`Warning: Could not parse date-time: ${dateTimeString}`);
        return dateTimeString; // Return original string if parsing fails
    }
}

// Helper function to format only the time part of a date/time string
function formatTime(dateTimeString) {
    if (!dateTimeString) return 'N/A';
     try {
        const date = new Date(dateTimeString);
        return date.toLocaleTimeString('nl-NL', {
            hour: '2-digit', minute: '2-digit',
            timeZone: 'Europe/Amsterdam'
        });
    } catch (e) {
        console.warn(`Warning: Could not parse time: ${dateTimeString}`);
        return dateTimeString; // Return original string if parsing fails
    }
}

try {
    // Read the JSON file content
    const rawData = fs.readFileSync(filePath, 'utf8');
    // Parse the JSON data
    const travelData = JSON.parse(rawData);

    let outputContent = ''; // Initialize string to hold the output

    // Basic validation of the parsed data
    if (!travelData || !travelData.trips || !Array.isArray(travelData.trips) || travelData.trips.length === 0) {
        console.log("No valid travel trips found in the data."); // Keep this console log for immediate feedback
        process.exit(0); // Exit gracefully if no trips are found
    }

    outputContent += "--- Travel Plan Summary ---\n";

    // --- Extract and Display Settings (derived from the first trip's data) ---
    const firstTripForSettings = travelData.trips[0];
    if (firstTripForSettings.legs && firstTripForSettings.legs.length > 0) {
        const firstLeg = firstTripForSettings.legs[0];
        // Find the very last leg of the first trip for the destination
        const lastLeg = firstTripForSettings.legs[firstTripForSettings.legs.length - 1];
        outputContent += "\n=== Planning Settings ===\n";
        outputContent += `Origin:      ${firstLeg.origin?.name || 'N/A'}\n`;
        outputContent += `Destination: ${lastLeg.destination?.name || 'N/A'}\n`;
        // Display the planned departure time as the requested time
        outputContent += `Time:        ${formatDateTime(firstLeg.origin?.plannedDateTime) || 'N/A'}\n`;
    } else {
         outputContent += "\n=== Planning Settings ===\n";
         outputContent += "Could not determine planning settings from the data (incomplete first trip).\n";
    }


    // --- Iterate through and Display Each Trip Option ---
    travelData.trips.forEach((trip, index) => {
        outputContent += `\n=== Trip Option ${index + 1} ===\n`;

        // Check if the trip has legs
        if (!trip.legs || !Array.isArray(trip.legs) || trip.legs.length === 0) {
            outputContent += "  Trip data is incomplete (missing legs).\n";
            return; // Skip to the next trip if legs are missing
        }

        // Determine overall departure and arrival from the first and last leg
        const overallDepartureTime = trip.legs[0].origin?.plannedDateTime;
        const overallArrivalTime = trip.legs[trip.legs.length - 1].destination?.plannedDateTime;

        outputContent += `Departure:   ${formatDateTime(overallDepartureTime)}\n`;
        outputContent += `Arrival:     ${formatDateTime(overallArrivalTime)}\n`;
        outputContent += `Duration:    ${trip.plannedDurationInMinutes ?? 'N/A'} minutes\n`;
        outputContent += `Transfers:   ${trip.transfers ?? 'N/A'}\n`; // Use nullish coalescing for 0 transfers
        outputContent += `Status:      ${trip.status || 'N/A'}\n`;

        // Display General Trip Messages
        if (trip.messages && trip.messages.length > 0) {
            outputContent += "Messages:\n";
            trip.messages.forEach(msg => outputContent += `  - ${msg.message || 'No message text'}\n`);
        }

        // Display Trip-Specific Labels/Notes (like supplements)
         if (trip.labelListItems && trip.labelListItems.length > 0) {
            outputContent += "Notes:\n";
            trip.labelListItems.forEach(label => outputContent += `  - ${label.label || 'No label text'}\n`);
        }

        outputContent += "\n  --- Legs ---\n";
        trip.legs.forEach((leg, legIndex) => {
            // Prefer actual track, fallback to planned track, else 'N/A'
            const depTrack = leg.origin?.actualTrack || leg.origin?.plannedTrack || 'N/A';
            const arrTrack = leg.destination?.actualTrack || leg.destination?.plannedTrack || 'N/A';
            // Format times
            const depTime = formatTime(leg.origin?.plannedDateTime);
            const arrTime = formatTime(leg.destination?.plannedDateTime);

            outputContent += `  Leg ${legIndex + 1}: ${leg.product?.shortCategoryName || 'N/A'} ${leg.name || ''} (Direction: ${leg.direction || 'N/A'})\n`;
            outputContent += `    ${depTime} Depart ${leg.origin?.name || 'N/A'} (Track ${depTrack})\n`;
            outputContent += `    ${arrTime} Arrive ${leg.destination?.name || 'N/A'} (Track ${arrTrack})\n`;

            // Display Leg-Specific Notes (only if marked for presentation)
            if (leg.notes && leg.notes.length > 0) {
                 leg.notes.forEach(note => {
                     // Check if the note has a value and is meant to be shown
                     if (note.value && note.isPresentationRequired !== false) {
                         outputContent += `      Note: ${note.value}\n`;
                     }
                 });
            }
             // Display Product-Specific Notes (like supplements, only if marked for presentation)
            if (leg.product?.notes) {
                leg.product.notes.forEach(noteGroup => {
                    if (Array.isArray(noteGroup)) {
                        noteGroup.forEach(note => {
                            // Specifically look for supplement notes or others marked for presentation
                            if (note.value && note.isPresentationRequired !== false && note.key === 'PRODUCT_SUPPLEMENT') {
                                outputContent += `      Note: ${note.value}\n`;
                            }
                        });
                    }
                });
            }
             // Display Transfer Messages associated with this leg (info for getting to the *next* leg)
            if (leg.transferMessages && leg.transferMessages.length > 0) {
                outputContent += "    Transfer Info:\n";
                leg.transferMessages.forEach(msg => outputContent += `      - ${msg.message || 'No message text'}\n`);
            }

            outputContent += '\n'; // Add spacing for readability between legs
        });
    });

    outputContent += "--- End of Summary ---\n";

    // Write the accumulated output to the file
    fs.writeFileSync(outputFilePath, outputContent, 'utf8');
    console.log(`Travel summary successfully written to ${outputFilePath}`); // Log success to console

} catch (error) {
    // Handle potential errors during file reading or JSON parsing
    if (error.code === 'ENOENT') {
        console.error(`Error: Input file not found at ${filePath}`);
        console.error("Please ensure 'travel_planner_output.txt' exists in the same directory as the script.");
    } else if (error instanceof SyntaxError) {
        console.error(`Error: Could not parse JSON data in ${filePath}.`);
        console.error("Please ensure the file contains valid JSON.");
    } else {
        // Catch-all for other unexpected errors
        console.error("An unexpected error occurred:", error);
    }
    process.exit(1); // Exit with a non-zero code to indicate failure
}