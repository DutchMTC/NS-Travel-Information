"use client";

import React, { useState } from 'react'; // Removed unused useEffect
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter, SheetClose } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // For error display
import { Loader2, Clock, Calendar, MapPin, Train, Settings2 } from 'lucide-react'; // Import additional icons
import TripResultDisplay from '@/components/TripResultDisplay'; // Import the display component
import type { Trip } from '@/lib/ns-api'; // Import the Trip type from the correct location

// Define the state interface based on settings
interface TravelPlannerSettings {
  lang: string;
  fromStation: string;
  originUicCode: string;
  originLat: number | null;
  originLng: number | null;
  originName: string;
  toStation: string;
  destinationUicCode: string;
  destinationLat: number | null;
  destinationLng: number | null;
  destinationName: string;
  viaStation: string;
  viaUicCode: string;
  viaLat: number | null;
  viaLng: number | null;
  originWalk: boolean;
  originBike: boolean;
  originCar: boolean;
  destinationWalk: boolean;
  destinationBike: boolean;
  destinationCar: boolean;
  dateTime: string; // Use string for datetime-local input
  searchForArrival: boolean;
  context: string;
  addChangeTime: number | null;
  viaWaitTime: number | null;
  travelAssistance: boolean;
  accessibilityEquipment1: string;
  accessibilityEquipment2: string;
  searchForAccessibleTrip: boolean;
  localTrainsOnly: boolean;
  excludeHighSpeedTrains: boolean;
  excludeTrainsWithReservationRequired: boolean;
  product: string;
  discount: string;
  travelClass: number | null; // 1 or 2
  passing: boolean;
  travelRequestType: string;
  disabledTransportModalities: string[]; // Array of strings
  firstMileModality: string;
  lastMileModality: string;
  entireTripModality: string;
}

// Removed duplicate interface definitions - assuming they are handled by TripResultDisplay or a shared types file

const initialSettings: TravelPlannerSettings = {
  lang: 'nl',
  fromStation: '',
  originUicCode: '',
  originLat: null,
  originLng: null,
  originName: '',
  toStation: '',
  destinationUicCode: '',
  destinationLat: null,
  destinationLng: null,
  destinationName: '',
  viaStation: '',
  viaUicCode: '',
  viaLat: null,
  viaLng: null,
  originWalk: false,
  originBike: false,
  originCar: false,
  destinationWalk: false,
  destinationBike: false,
  destinationCar: false,
  dateTime: '',
  searchForArrival: false,
  context: '',
  addChangeTime: null,
  viaWaitTime: null,
  travelAssistance: false,
  accessibilityEquipment1: '',
  accessibilityEquipment2: '',
  searchForAccessibleTrip: false,
  localTrainsOnly: false,
  excludeHighSpeedTrains: false,
  excludeTrainsWithReservationRequired: false,
  product: '',
  discount: '',
  travelClass: 2, // Default to 2nd class
  passing: false,
  travelRequestType: '',
  disabledTransportModalities: [],
  firstMileModality: '',
  lastMileModality: '',
  entireTripModality: '',
};

// Product options from settings file
const productOptions = [
    "GEEN", "OVCHIPKAART_ENKELE_REIS", "OVCHIPKAART_RETOUR", "DAL_VOORDEEL",
    "ALTIJD_VOORDEEL", "DAL_VRIJ", "WEEKEND_VRIJ", "ALTIJD_VRIJ", "BUSINESSCARD",
    "BUSINESSCARD_DAL", "STUDENT_WEEK", "STUDENT_WEEKEND", "VDU",
    "SAMENREISKORTING", "TRAJECT_VRIJ"
];

// Transport Modalities (example, adjust as needed based on API)
const transportModalities = ["BUS", "FERRY", "TRAM", "METRO", "TRAIN", "SUBWAY", "SHARED_BIKE", "SHARED_CAR", "TAXI"];

export default function TravelPlannerPage() {
  const [settings, setSettings] = useState<TravelPlannerSettings>(initialSettings);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trips, setTrips] = useState<Trip[] | null>(null); // State to hold trip results

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    // Handle number inputs separately to store null for empty strings
    if (type === 'number') {
        setSettings(prev => ({
            ...prev,
            [name]: value === '' ? null : parseFloat(value),
        }));
    } else {
        setSettings(prev => ({
            ...prev,
            [name]: value,
        }));
    }
  };

  const handleSwitchChange = (checked: boolean, name: string) => {
     setSettings(prev => ({ ...prev, [name]: checked }));
  };

  const handleSelectChange = (value: string, name: string) => {
    // Handle travelClass specifically to store as number or null
    if (name === 'travelClass') {
        setSettings(prev => ({ ...prev, [name]: value ? parseInt(value, 10) : null }));
    } else {
        setSettings(prev => ({ ...prev, [name]: value }));
    }
  };

   const handleMultiSelectChange = (modality: string) => {
    setSettings(prev => {
      const currentModalities = prev.disabledTransportModalities;
      if (currentModalities.includes(modality)) {
        return { ...prev, disabledTransportModalities: currentModalities.filter(m => m !== modality) };
      } else {
        return { ...prev, disabledTransportModalities: [...currentModalities, modality] };
      }
    });
  };

  // Function to handle integer inputs specifically
  const handleIntegerInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const intValue = value === '' ? null : parseInt(value, 10);
    // Allow empty string (for null) or valid non-negative integers
    if (value === '' || (intValue !== null && !isNaN(intValue) && intValue >= 0 && Number.isInteger(intValue))) {
        setSettings(prev => ({ ...prev, [name]: intValue }));
    }
    // Optionally provide feedback for invalid input (e.g., negative numbers, decimals)
  };

  const handlePlanTrip = async () => {
    setLoading(true);
    setError(null);
    setTrips(null); // Clear previous results
    setIsSettingsOpen(false); // Close the settings sheet

    // Basic validation (optional, but good practice)
    if (!settings.fromStation && !settings.originName && !settings.originUicCode && !(settings.originLat && settings.originLng)) {
        setError("Please specify an origin station or location.");
        setLoading(false);
        return;
    }
     if (!settings.toStation && !settings.destinationName && !settings.destinationUicCode && !(settings.destinationLat && settings.destinationLng)) {
        setError("Please specify a destination station or location.");
        setLoading(false);
        return;
    }

    try {
      const response = await fetch('/api/plan-trip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });

      const data = await response.json();

      if (!response.ok) {
        // Use error message from backend if available, otherwise provide a generic one
        const errorMessage = data.error || `API request failed with status ${response.status}`;
        const errorDetails = data.details ? ` Details: ${JSON.stringify(data.details)}` : '';
        console.error("API Error:", errorMessage, errorDetails);
        setError(`${errorMessage}${errorDetails}`);
        setTrips(null);
      } else {
        // Assuming the API returns { trips: [...] } structure
        if (data && Array.isArray(data.trips)) {
            setTrips(data.trips);
            // Optionally update context from response if needed for pagination
            // setSettings(prev => ({ ...prev, context: data.scrollRequestForwardContext ?? prev.context }));
        } else {
             console.warn("API response format unexpected:", data);
             setError("Received unexpected data format from the server.");
             setTrips(null);
        }
      }
    } catch (err) {
      console.error('Failed to fetch trip plan:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred while planning the trip.');
      setTrips(null);
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6 text-gray-800 dark:text-gray-200">Travel Planner</h1>

      {/* Main Content Area - Dynamic based on state */}
      <div className="mb-6 p-6 border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 shadow-sm text-gray-800 dark:text-gray-200 min-h-[200px]">
        <h2 className="text-xl font-semibold mb-4">Your Planned Trip</h2>
        {loading && (
          <div className="flex items-center justify-center text-gray-600 dark:text-gray-400">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            <span>Planning your trip...</span>
          </div>
        )}
        {error && !loading && (
          <Alert variant="destructive">
            <AlertTitle>Error Planning Trip</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {!loading && !error && !trips && (
          <p className="text-gray-600 dark:text-gray-400">Configure your journey using the &apos;Customize Trip&apos; button and click &apos;Plan Trip&apos;.</p>
        )}
         {!loading && !error && trips && trips.length === 0 && (
          <p className="text-gray-600 dark:text-gray-400">No trips found matching your criteria.</p>
        )}
        {!loading && !error && trips && trips.length > 0 && (
          <TripResultDisplay trips={trips} />
        )}
      </div>

      {/* Settings Trigger Button */}
       <Sheet open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <SheetTrigger asChild>
          <Button 
            variant="outline"
            className="flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-900"
          >
            <Settings2 className="mr-2 h-4 w-4" /> 
            Customize Trip
          </Button>
        </SheetTrigger>
        <SheetContent className="w-[90vw] max-w-[540px] sm:w-[540px] bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700"> 
          <SheetHeader>
            <SheetTitle className="text-xl font-semibold text-gray-800 dark:text-gray-200">Travel Settings</SheetTitle>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-120px)] pr-6 text-gray-800 dark:text-gray-200"> 
            <div className="grid gap-6 py-4"> 

              {/* --- Location Settings --- */}
              <div>
                <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200 flex items-center">
                  <MapPin className="mr-2 h-5 w-5 text-blue-600 dark:text-blue-400" />
                  Locations
                </h3>
                <Separator className="mb-4 bg-gray-200 dark:bg-gray-700"/>
                <div className="grid gap-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="fromStation" className="text-right text-gray-700 dark:text-gray-300">From Station</Label>
                    <Input 
                      id="fromStation" 
                      name="fromStation" 
                      value={settings.fromStation} 
                      onChange={handleInputChange} 
                      className="col-span-3 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-blue-500 focus:border-blue-500" 
                      placeholder="e.g., Utrecht Centraal or UT"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="originUicCode" className="text-right text-gray-700 dark:text-gray-300">Origin UIC</Label>
                    <Input 
                      id="originUicCode" 
                      name="originUicCode" 
                      value={settings.originUicCode} 
                      onChange={handleInputChange} 
                      className="col-span-3 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-blue-500 focus:border-blue-500" 
                      placeholder="UIC Code (optional)"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="originLat" className="text-right text-gray-700 dark:text-gray-300">Origin Lat</Label>
                    <Input 
                      id="originLat" 
                      name="originLat" 
                      type="number" 
                      step="any" 
                      value={settings.originLat ?? ''} 
                      onChange={handleInputChange} 
                      className="col-span-3 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-blue-500 focus:border-blue-500" 
                      placeholder="Latitude (optional)"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="originLng" className="text-right text-gray-700 dark:text-gray-300">Origin Lng</Label>
                    <Input 
                      id="originLng" 
                      name="originLng" 
                      type="number" 
                      step="any" 
                      value={settings.originLng ?? ''} 
                      onChange={handleInputChange} 
                      className="col-span-3 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-blue-500 focus:border-blue-500" 
                      placeholder="Longitude (optional)"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="originName" className="text-right text-gray-700 dark:text-gray-300">Origin Name</Label>
                    <Input 
                      id="originName" 
                      name="originName" 
                      value={settings.originName} 
                      onChange={handleInputChange} 
                      className="col-span-3 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-blue-500 focus:border-blue-500" 
                      placeholder="Custom origin name (optional)"
                    />
                  </div>

                  <Separator className="my-2 bg-gray-200 dark:bg-gray-700"/>

                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="toStation" className="text-right text-gray-700 dark:text-gray-300">To Station</Label>
                    <Input 
                      id="toStation" 
                      name="toStation" 
                      value={settings.toStation} 
                      onChange={handleInputChange} 
                      className="col-span-3 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-blue-500 focus:border-blue-500" 
                      placeholder="e.g., Amsterdam Centraal or ASD"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="destinationUicCode" className="text-right text-gray-700 dark:text-gray-300">Dest. UIC</Label>
                    <Input 
                      id="destinationUicCode" 
                      name="destinationUicCode" 
                      value={settings.destinationUicCode} 
                      onChange={handleInputChange} 
                      className="col-span-3 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-blue-500 focus:border-blue-500" 
                      placeholder="UIC Code (optional)"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="destinationLat" className="text-right text-gray-700 dark:text-gray-300">Dest. Lat</Label>
                    <Input 
                      id="destinationLat" 
                      name="destinationLat" 
                      type="number" 
                      step="any" 
                      value={settings.destinationLat ?? ''} 
                      onChange={handleInputChange} 
                      className="col-span-3 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-blue-500 focus:border-blue-500" 
                      placeholder="Latitude (optional)"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="destinationLng" className="text-right text-gray-700 dark:text-gray-300">Dest. Lng</Label>
                    <Input 
                      id="destinationLng" 
                      name="destinationLng" 
                      type="number" 
                      step="any" 
                      value={settings.destinationLng ?? ''} 
                      onChange={handleInputChange} 
                      className="col-span-3 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-blue-500 focus:border-blue-500" 
                      placeholder="Longitude (optional)"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="destinationName" className="text-right text-gray-700 dark:text-gray-300">Dest. Name</Label>
                    <Input 
                      id="destinationName" 
                      name="destinationName" 
                      value={settings.destinationName} 
                      onChange={handleInputChange} 
                      className="col-span-3 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-blue-500 focus:border-blue-500" 
                      placeholder="Custom destination name (optional)"
                    />
                  </div>

                  <Separator className="my-2 bg-gray-200 dark:bg-gray-700"/>

                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="viaStation" className="text-right text-gray-700 dark:text-gray-300">Via Station</Label>
                    <Input 
                      id="viaStation" 
                      name="viaStation" 
                      value={settings.viaStation} 
                      onChange={handleInputChange} 
                      className="col-span-3 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-blue-500 focus:border-blue-500" 
                      placeholder="Via station (optional)"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="viaUicCode" className="text-right text-gray-700 dark:text-gray-300">Via UIC</Label>
                    <Input 
                      id="viaUicCode" 
                      name="viaUicCode" 
                      value={settings.viaUicCode} 
                      onChange={handleInputChange} 
                      className="col-span-3 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-blue-500 focus:border-blue-500" 
                      placeholder="UIC Code (optional)"
                    />
                  </div>
                   <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="viaLat" className="text-right text-gray-700 dark:text-gray-300">Via Lat</Label>
                    <Input 
                      id="viaLat" 
                      name="viaLat" 
                      type="number" 
                      step="any" 
                      value={settings.viaLat ?? ''} 
                      onChange={handleInputChange} 
                      className="col-span-3 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-blue-500 focus:border-blue-500" 
                      placeholder="Latitude (door-to-door only)"
                    />
                  </div>
                   <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="viaLng" className="text-right text-gray-700 dark:text-gray-300">Via Lng</Label>
                    <Input 
                      id="viaLng" 
                      name="viaLng" 
                      type="number" 
                      step="any" 
                      value={settings.viaLng ?? ''} 
                      onChange={handleInputChange} 
                      className="col-span-3 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-blue-500 focus:border-blue-500" 
                      placeholder="Longitude (door-to-door only)"
                    />
                  </div>
                </div>
              </div>

              {/* --- Time & Date Settings --- */}
              <div>
                <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200 flex items-center">
                  <Clock className="mr-2 h-5 w-5 text-blue-600 dark:text-blue-400" />
                  Time & Date
                </h3>
                <Separator className="mb-4 bg-gray-200 dark:bg-gray-700"/>
                <div className="grid gap-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="dateTime" className="text-right text-gray-700 dark:text-gray-300">Date & Time</Label>
                        <Input 
                          id="dateTime" 
                          name="dateTime" 
                          type="datetime-local" 
                          value={settings.dateTime} 
                          onChange={handleInputChange} 
                          className="col-span-3 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                    <div className="flex items-center space-x-2 col-start-2 col-span-3">
                        <Switch 
                          id="searchForArrival" 
                          name="searchForArrival" 
                          checked={settings.searchForArrival} 
                          onCheckedChange={(checked: boolean) => handleSwitchChange(checked, 'searchForArrival')} 
                          aria-label="Search for Arrival Time"
                          className="data-[state=checked]:bg-blue-600 dark:data-[state=checked]:bg-blue-500"
                        />
                        <Label htmlFor="searchForArrival" className="text-gray-700 dark:text-gray-300">Search for Arrival Time</Label>
                    </div>
                </div>
              </div>

              {/* --- Travel Options --- */}
              <div>
                <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200 flex items-center">
                  <Train className="mr-2 h-5 w-5 text-blue-600 dark:text-blue-400" />
                  Travel Options
                </h3>
                <Separator className="mb-4 bg-gray-200 dark:bg-gray-700"/>
                <div className="grid gap-4">
                    <div className="flex items-center space-x-2">
                        <Switch 
                          id="localTrainsOnly" 
                          name="localTrainsOnly" 
                          checked={settings.localTrainsOnly} 
                          onCheckedChange={(checked: boolean) => handleSwitchChange(checked, 'localTrainsOnly')} 
                          aria-label="Local Trains Only"
                          className="data-[state=checked]:bg-blue-600 dark:data-[state=checked]:bg-blue-500"
                        />
                        <Label htmlFor="localTrainsOnly" className="text-gray-700 dark:text-gray-300">Local Trains Only (Sprinter/Stoptrein)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Switch 
                          id="excludeHighSpeedTrains" 
                          name="excludeHighSpeedTrains" 
                          checked={settings.excludeHighSpeedTrains} 
                          onCheckedChange={(checked: boolean) => handleSwitchChange(checked, 'excludeHighSpeedTrains')} 
                          aria-label="Exclude High-Speed Trains"
                          className="data-[state=checked]:bg-blue-600 dark:data-[state=checked]:bg-blue-500"
                        />
                        <Label htmlFor="excludeHighSpeedTrains" className="text-gray-700 dark:text-gray-300">Exclude High-Speed Trains (incl. supplement)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Switch 
                          id="excludeTrainsWithReservationRequired" 
                          name="excludeTrainsWithReservationRequired" 
                          checked={settings.excludeTrainsWithReservationRequired} 
                          onCheckedChange={(checked: boolean) => handleSwitchChange(checked, 'excludeTrainsWithReservationRequired')} 
                          aria-label="Exclude Trains Requiring Reservation"
                          className="data-[state=checked]:bg-blue-600 dark:data-[state=checked]:bg-blue-500"
                        />
                        <Label htmlFor="excludeTrainsWithReservationRequired" className="text-gray-700 dark:text-gray-300">Exclude Trains Requiring Reservation (e.g., Eurostar)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Switch 
                          id="passing" 
                          name="passing" 
                          checked={settings.passing} 
                          onCheckedChange={(checked: boolean) => handleSwitchChange(checked, 'passing')} 
                          aria-label="Show Passing Stops"
                          className="data-[state=checked]:bg-blue-600 dark:data-[state=checked]:bg-blue-500"
                        />
                        <Label htmlFor="passing" className="text-gray-700 dark:text-gray-300">Show Passing Stops (non-stopping)</Label>
                    </div>

                    <div className="grid grid-cols-4 items-center gap-4 mt-2">
                        <Label htmlFor="addChangeTime" className="text-right text-gray-700 dark:text-gray-300">Extra Transfer Time</Label>
                        <Input 
                          id="addChangeTime" 
                          name="addChangeTime" 
                          type="number" 
                          min="0" 
                          step="1" 
                          value={settings.addChangeTime ?? ''} 
                          onChange={handleIntegerInputChange} 
                          className="col-span-3 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-blue-500 focus:border-blue-500" 
                          placeholder="Minutes (optional)"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="viaWaitTime" className="text-right text-gray-700 dark:text-gray-300">Via Wait Time</Label>
                        <Input 
                          id="viaWaitTime" 
                          name="viaWaitTime" 
                          type="number" 
                          min="0" 
                          step="1" 
                          value={settings.viaWaitTime ?? ''} 
                          onChange={handleIntegerInputChange} 
                          className="col-span-3 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-blue-500 focus:border-blue-500" 
                          placeholder="Minutes at via station (optional)"
                        />
                    </div>
                </div>
              </div>

              {/* --- First/Last Mile --- */}
              <div>
                <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200 flex items-center">First/Last Mile Options</h3>
                <Separator className="mb-4 bg-gray-200 dark:bg-gray-700"/>
                <div className="grid gap-4">
                    <Label className="font-medium text-gray-700 dark:text-gray-300">From Origin:</Label>
                    <div className="flex items-center space-x-4 pl-4">
                        <div className="flex items-center space-x-2">
                            <Switch 
                              id="originWalk" 
                              name="originWalk" 
                              checked={settings.originWalk} 
                              onCheckedChange={(checked: boolean) => handleSwitchChange(checked, 'originWalk')} 
                              aria-label="Origin Walk"
                              className="data-[state=checked]:bg-blue-600 dark:data-[state=checked]:bg-blue-500"
                            />
                            <Label htmlFor="originWalk" className="text-gray-700 dark:text-gray-300">Walk</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Switch 
                              id="originBike" 
                              name="originBike" 
                              checked={settings.originBike} 
                              onCheckedChange={(checked: boolean) => handleSwitchChange(checked, 'originBike')} 
                              aria-label="Origin Bike"
                              className="data-[state=checked]:bg-blue-600 dark:data-[state=checked]:bg-blue-500"
                            />
                            <Label htmlFor="originBike" className="text-gray-700 dark:text-gray-300">Bike</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Switch 
                              id="originCar" 
                              name="originCar" 
                              checked={settings.originCar} 
                              onCheckedChange={(checked: boolean) => handleSwitchChange(checked, 'originCar')} 
                              aria-label="Origin Car"
                              className="data-[state=checked]:bg-blue-600 dark:data-[state=checked]:bg-blue-500"
                            />
                            <Label htmlFor="originCar" className="text-gray-700 dark:text-gray-300">Car</Label>
                        </div>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="firstMileModality" className="text-right text-gray-700 dark:text-gray-300">Origin Shared Modality</Label>
                        <Input 
                          id="firstMileModality" 
                          name="firstMileModality" 
                          value={settings.firstMileModality} 
                          onChange={handleInputChange} 
                          className="col-span-3 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-blue-500 focus:border-blue-500" 
                          placeholder="e.g., OV-fiets, Check (optional)"
                        />
                    </div>

                    <Label className="font-medium text-gray-700 dark:text-gray-300">To Destination:</Label>
                    <div className="flex items-center space-x-4 pl-4">
                        <div className="flex items-center space-x-2">
                            <Switch 
                              id="destinationWalk" 
                              name="destinationWalk" 
                              checked={settings.destinationWalk} 
                              onCheckedChange={(checked: boolean) => handleSwitchChange(checked, 'destinationWalk')} 
                              aria-label="Destination Walk"
                              className="data-[state=checked]:bg-blue-600 dark:data-[state=checked]:bg-blue-500"
                            />
                            <Label htmlFor="destinationWalk" className="text-gray-700 dark:text-gray-300">Walk</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Switch 
                              id="destinationBike" 
                              name="destinationBike" 
                              checked={settings.destinationBike} 
                              onCheckedChange={(checked: boolean) => handleSwitchChange(checked, 'destinationBike')} 
                              aria-label="Destination Bike"
                              className="data-[state=checked]:bg-blue-600 dark:data-[state=checked]:bg-blue-500"
                            />
                            <Label htmlFor="destinationBike" className="text-gray-700 dark:text-gray-300">Bike</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Switch 
                              id="destinationCar" 
                              name="destinationCar" 
                              checked={settings.destinationCar} 
                              onCheckedChange={(checked: boolean) => handleSwitchChange(checked, 'destinationCar')} 
                              aria-label="Destination Car"
                              className="data-[state=checked]:bg-blue-600 dark:data-[state=checked]:bg-blue-500"
                            />
                            <Label htmlFor="destinationCar" className="text-gray-700 dark:text-gray-300">Car</Label>
                        </div>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="lastMileModality" className="text-right text-gray-700 dark:text-gray-300">Dest. Shared Modality</Label>
                        <Input 
                          id="lastMileModality" 
                          name="lastMileModality" 
                          value={settings.lastMileModality} 
                          onChange={handleInputChange} 
                          className="col-span-3 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-blue-500 focus:border-blue-500" 
                          placeholder="e.g., OV-fiets, Check (optional)"
                        />
                    </div>
                </div>
              </div>

              {/* --- Accessibility --- */}
              <div>
                <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200 flex items-center">Accessibility</h3>
                <Separator className="mb-4 bg-gray-200 dark:bg-gray-700"/>
                <div className="grid gap-4">
                    <div className="flex items-center space-x-2">
                        <Switch 
                          id="travelAssistance" 
                          name="travelAssistance" 
                          checked={settings.travelAssistance} 
                          onCheckedChange={(checked: boolean) => handleSwitchChange(checked, 'travelAssistance')} 
                          aria-label="Request Travel Assistance"
                          className="data-[state=checked]:bg-blue-600 dark:data-[state=checked]:bg-blue-500"
                        />
                        <Label htmlFor="travelAssistance" className="text-gray-700 dark:text-gray-300">Request Travel Assistance (PAS)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Switch 
                          id="searchForAccessibleTrip" 
                          name="searchForAccessibleTrip" 
                          checked={settings.searchForAccessibleTrip} 
                          onCheckedChange={(checked: boolean) => handleSwitchChange(checked, 'searchForAccessibleTrip')} 
                          aria-label="Search for Accessible Trip"
                          className="data-[state=checked]:bg-blue-600 dark:data-[state=checked]:bg-blue-500"
                        />
                        <Label htmlFor="searchForAccessibleTrip" className="text-gray-700 dark:text-gray-300">Search for Accessible Trip</Label>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="accessibilityEquipment1" className="text-right text-gray-700 dark:text-gray-300">Equipment 1</Label>
                        <Input 
                          id="accessibilityEquipment1" 
                          name="accessibilityEquipment1" 
                          value={settings.accessibilityEquipment1} 
                          onChange={handleInputChange} 
                          className="col-span-3 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-blue-500 focus:border-blue-500" 
                          placeholder="e.g., SCOOTER (optional)"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="accessibilityEquipment2" className="text-right text-gray-700 dark:text-gray-300">Equipment 2</Label>
                        <Input 
                          id="accessibilityEquipment2" 
                          name="accessibilityEquipment2" 
                          value={settings.accessibilityEquipment2} 
                          onChange={handleInputChange} 
                          className="col-span-3 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-blue-500 focus:border-blue-500" 
                          placeholder="Optional second equipment"
                        />
                    </div>
                </div>
              </div>

              {/* --- Fare & Product --- */}
              <div>
                <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200 flex items-center">Fare & Product</h3>
                <Separator className="mb-4 bg-gray-200 dark:bg-gray-700"/>
                <div className="grid gap-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="product" className="text-right text-gray-700 dark:text-gray-300">Product</Label>
                        <Select name="product" value={settings.product} onValueChange={(value: string) => handleSelectChange(value, 'product')}>
                        <SelectTrigger className="col-span-3 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-blue-500 focus:border-blue-500">
                            <SelectValue placeholder="Select product..." />
                        </SelectTrigger>
                        <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700">
                            {/* Placeholder is handled by SelectValue */}
                            {productOptions.map(option => (
                            <SelectItem key={option} value={option} className="text-gray-900 dark:text-gray-100">{option.replace(/_/g, ' ')}</SelectItem>
                            ))}
                        </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="discount" className="text-right text-gray-700 dark:text-gray-300">Discount</Label>
                        {/* TODO: Consider making this a Select if possible values are known */}
                        <Input 
                          id="discount" 
                          name="discount" 
                          value={settings.discount} 
                          onChange={handleInputChange} 
                          className="col-span-3 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-blue-500 focus:border-blue-500" 
                          placeholder="e.g., DISCOUNT_40_PERCENT (optional)"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="travelClass" className="text-right text-gray-700 dark:text-gray-300">Travel Class</Label>
                        <Select name="travelClass" value={settings.travelClass?.toString() ?? ''} onValueChange={(value: string) => handleSelectChange(value, 'travelClass')}>
                            <SelectTrigger className="col-span-3 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-blue-500 focus:border-blue-500">
                                <SelectValue placeholder="Select class..." />
                            </SelectTrigger>
                            <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700">
                                <SelectItem value="1" className="text-gray-900 dark:text-gray-100">1st Class</SelectItem>
                                <SelectItem value="2" className="text-gray-900 dark:text-gray-100">2nd Class</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
              </div>

              {/* --- Advanced/Other --- */}
              <div>
                <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200 flex items-center">Advanced</h3>
                <Separator className="mb-4 bg-gray-200 dark:bg-gray-700"/>
                <div className="grid gap-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="lang" className="text-right text-gray-700 dark:text-gray-300">Language</Label>
                        <Select name="lang" value={settings.lang} onValueChange={(value: string) => handleSelectChange(value, 'lang')}>
                            <SelectTrigger className="col-span-3 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-blue-500 focus:border-blue-500">
                                <SelectValue placeholder="Select language..." />
                            </SelectTrigger>
                            <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700">
                                <SelectItem value="nl" className="text-gray-900 dark:text-gray-100">Nederlands (nl)</SelectItem>
                                <SelectItem value="en" className="text-gray-900 dark:text-gray-100">English (en)</SelectItem>
                                {/* Add other languages if supported by API */}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="context" className="text-right text-gray-700 dark:text-gray-300">Context</Label>
                        <Input 
                          id="context" 
                          name="context" 
                          value={settings.context} 
                          onChange={handleInputChange} 
                          className="col-span-3 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-blue-500 focus:border-blue-500" 
                          placeholder="For pagination (next/previous)"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="travelRequestType" className="text-right text-gray-700 dark:text-gray-300">Request Type</Label>
                        <Input 
                          id="travelRequestType" 
                          name="travelRequestType" 
                          value={settings.travelRequestType} 
                          onChange={handleInputChange} 
                          className="col-span-3 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-blue-500 focus:border-blue-500" 
                          placeholder="e.g., directionsOnly (optional)"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="entireTripModality" className="text-right text-gray-700 dark:text-gray-300">Entire Trip Modality</Label>
                        <Input 
                          id="entireTripModality" 
                          name="entireTripModality" 
                          value={settings.entireTripModality} 
                          onChange={handleInputChange} 
                          className="col-span-3 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-blue-500 focus:border-blue-500" 
                          placeholder="Filter total trip (optional)"
                        />
                    </div>

                    {/* Disabled Transport Modalities */}
                    <div>
                        <Label className="font-medium text-gray-700 dark:text-gray-300">Exclude Transport Modalities:</Label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 mt-2 pl-4">
                        {transportModalities.map(modality => (
                            <div key={modality} className="flex items-center space-x-2">
                            <Checkbox
                                id={`modality-${modality}`}
                                checked={settings.disabledTransportModalities.includes(modality)}
                                onCheckedChange={() => handleMultiSelectChange(modality)}
                                className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 dark:data-[state=checked]:bg-blue-500 dark:data-[state=checked]:border-blue-500"
                                aria-label={`Exclude ${modality}`}
                            />
                            <Label htmlFor={`modality-${modality}`} className="text-sm font-normal text-gray-700 dark:text-gray-300">
                                {modality.replace(/_/g, ' ')}
                            </Label>
                            </div>
                        ))}
                        </div>
                    </div>
                </div>
              </div>

            </div> {/* End of main grid */}
          </ScrollArea>
          <SheetFooter className="mt-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
            <SheetClose asChild>
              <Button 
                type="button" 
                variant="outline"
                className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Close
              </Button>
            </SheetClose>
             <Button 
              type="button" 
              onClick={handlePlanTrip} 
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-500 dark:hover:bg-blue-600"
             >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {loading ? 'Planning...' : 'Plan Trip'}
             </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

    </div>
  );
}