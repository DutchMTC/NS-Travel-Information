// src/lib/specialLiveries.ts

/**
 * Interface for the details of a special livery.
 */
export interface SpecialLiveryDetails {
  name: string;
  imageUrl?: string; // Optional custom image URL
}

/**
 * A mapping of train material numbers (materieelnummers) to their special livery details.
 * Keys are strings representing the train number.
 * Values are objects containing the name and optional custom image URL.
 */
export const specialLiveries: { [key: string]: SpecialLiveryDetails } = {
  "9556": {
    name: "De Groene Trein",
    imageUrl: "/assets/trains/GroeneTrein.png" 
  },
  "9520": {
    name: "Ex. Olympische Trein",
    imageUrl: "/assets/trains/OlympischeSpelenTrein.png"
  },
  "9525": {
    name: "Ex. Olympische Trein",
    imageUrl: "/assets/trains/OlympischeSpelenTrein.png" 
  },
  "9524": {
    name: "Ex. OV Chipkaart Trein",
    imageUrl: "/assets/trains/OVChipkaartTrein.png" 
  },
  "9549": {
    name: "Lekker lezen doe je in de trein",
  },
  "9592": {
    name: "Lekker lezen doe je in de trein",
  },
  "4201": {
    name: "Ex. Olympische Trein",
    imageUrl: "/assets/trains/OlympischeSpelenTreinICM.png" 
  },
  "4240": {
    name: "Ex. Olympische Trein",
    imageUrl: "/assets/trains/OlympischeSpelenTreinICM.png" 
  },
  "4028": {
    name: "Ex. Kinderboekenweek Trein",
    imageUrl: "/assets/trains/KinderBoekenWeekICM.png" 
  },
  "4011": {
    name: "De eerste Koploper. Goodbye little friend <3",
    imageUrl: "/assets/trains/KLMICM.png" 
  },
  
  
  // Add more special liveries here as needed
  // Example:
  // "1234": {
  //   name: "Another Special Train",
  //   imageUrl: "https://example.com/images/special-train.png"
  // }
};

/**
 * Function to get the special livery details object for a given train number.
 * @param trainNumber - The train number (string) to look up.
 * @returns The SpecialLiveryDetails object, or undefined if not found.
 */
function getSpecialLiveryDetails(trainNumber: string): SpecialLiveryDetails | undefined {
  return specialLiveries[trainNumber];
}


/**
 * Function to get the special livery name for a given train number.
 * @param trainNumber - The train number (string) to look up.
 * @returns The name of the special livery, or undefined if not found.
 */
export function getSpecialLiveryName(trainNumber: string): string | undefined {
  return getSpecialLiveryDetails(trainNumber)?.name;
}

/**
 * Function to get the custom image URL for a special livery.
 * @param trainNumber - The train number (string) to look up.
 * @returns The custom image URL, or undefined if not defined or livery not found.
 */
export function getSpecialLiveryImageUrl(trainNumber: string): string | undefined {
    return getSpecialLiveryDetails(trainNumber)?.imageUrl;
}