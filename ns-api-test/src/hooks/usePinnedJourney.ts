import { useState, useEffect, useCallback } from 'react';
// Removed unused DepartureMessage import

// Define the structure for the pinned journey data
export interface PinnedJourneyData {
  origin: string;
  destination: string;
  departureTime: string; // ISO format recommended
  trainNumber: string;
  nextStation: string; // Name of the next station (best effort during pin)
  originUic: string; // UIC code of the origin station (for reliable lookup later)
  platform?: string; // Platform at origin where pinned
  journeyCategory?: string;
  materieelNummer?: string; // Specific train unit identifier
  plannedDepartureTime: string; // ISO string of planned departure from origin where pinned
  // actualDepartureTime: string; // Removed - will be fetched live
  // messages?: DepartureMessage[]; // Removed static messages
}

const LOCAL_STORAGE_KEY = 'pinnedJourney';

const CUSTOM_EVENT_NAME = 'pinnedJourneyChanged';

// Custom hook for managing the pinned journey
export function usePinnedJourney() {
  const [pinnedJourney, setPinnedJourney] = useState<PinnedJourneyData | null>(null);

  // Effect to load the pinned journey from LocalStorage on initial mount
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const storedJourney = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (storedJourney) {
          setPinnedJourney(JSON.parse(storedJourney));
        }
      }
    } catch (error) {
      console.error("Error reading pinned journey from LocalStorage:", error);
      // Handle potential errors, e.g., LocalStorage disabled or corrupted data
      setPinnedJourney(null);
    }
  }, []);

  // Effect to listen for changes in LocalStorage (cross-tab and same-tab)
  useEffect(() => {
    // Handler for the 'storage' event (cross-tab synchronization)
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === LOCAL_STORAGE_KEY) {
        try {
          const newValue = event.newValue ? JSON.parse(event.newValue) : null;
          setPinnedJourney(newValue);
        } catch (error) {
          console.error("Error parsing pinned journey from storage event:", error);
          setPinnedJourney(null);
        }
      }
    };

    // Handler for the custom event (same-tab synchronization)
    const handleCustomEvent = () => {
      try {
        const storedJourney = localStorage.getItem(LOCAL_STORAGE_KEY);
        const newValue = storedJourney ? JSON.parse(storedJourney) : null;
        // Only update state if it's actually different to avoid potential loops
        setPinnedJourney(currentValue => {
            // Basic comparison; consider deep comparison if needed for complex objects
            if (JSON.stringify(currentValue) !== JSON.stringify(newValue)) {
                return newValue;
            }
            return currentValue;
        });
      } catch (error) {
        console.error("Error reading pinned journey after custom event:", error);
        setPinnedJourney(null);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleStorageChange);
      window.addEventListener(CUSTOM_EVENT_NAME, handleCustomEvent);

      // Cleanup listeners on unmount
      return () => {
        window.removeEventListener('storage', handleStorageChange);
        window.removeEventListener(CUSTOM_EVENT_NAME, handleCustomEvent);
      };
    }
  }, []); // Empty dependency array ensures this runs only on mount and unmount

  // Function to pin a new journey
  const pinJourney = useCallback((journeyData: PinnedJourneyData) => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(journeyData));
        setPinnedJourney(journeyData); // Update state for the current hook instance
        window.dispatchEvent(new CustomEvent(CUSTOM_EVENT_NAME)); // Notify other instances
      }
    } catch (error) {
      console.error("Error saving pinned journey to LocalStorage:", error);
      // Handle potential errors, e.g., LocalStorage full or disabled
    }
  }, []);

  // Function to unpin the current journey
  const unpinJourney = useCallback(() => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
        setPinnedJourney(null); // Update state for the current hook instance
        window.dispatchEvent(new CustomEvent(CUSTOM_EVENT_NAME)); // Notify other instances
      }
    } catch (error) {
      console.error("Error removing pinned journey from LocalStorage:", error);
      // Handle potential errors
    }
  }, []);

  // Function to explicitly get the current pinned journey (though state is preferred)
  const getPinnedJourney = useCallback((): PinnedJourneyData | null => {
     try {
       if (typeof window !== 'undefined') {
         const storedJourney = localStorage.getItem(LOCAL_STORAGE_KEY);
         return storedJourney ? JSON.parse(storedJourney) : null;
       }
       return null;
     } catch (error) {
       console.error("Error retrieving pinned journey directly:", error);
       return null;
     }
  }, []);


  return { pinnedJourney, pinJourney, unpinJourney, getPinnedJourney };
}