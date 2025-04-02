"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { stations, Station } from '../lib/stations';

export default function StationSearch() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredStations, setFilteredStations] = useState<Station[]>([]);
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);
  const router = useRouter();
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Update filtered stations based on search term
  useEffect(() => {
    const lowerCaseSearchTerm = searchTerm.toLowerCase().trim();
    if (lowerCaseSearchTerm === '') {
      // If search is empty, keep the full list (will be shown on focus)
      // We don't hide the dropdown here anymore based *only* on empty search term
      // Visibility is controlled by focus and clicks outside
      setFilteredStations(stations); // Set to all stations if empty
    } else {
      const results = stations.filter(station =>
        station.name.toLowerCase().includes(lowerCaseSearchTerm)
      );
      setFilteredStations(results);
      // Show dropdown only if there are results AND the input has focus (implicitly handled by isDropdownVisible state)
    }
  }, [searchTerm]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsDropdownVisible(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [searchContainerRef]);


  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  const handleStationSelect = (stationCode: string) => {
    setSearchTerm(''); // Clear search term
    setIsDropdownVisible(false); // Hide dropdown
    router.push(`/${stationCode}`); // Navigate to station page
  };

  // Show dropdown with full list on focus if search is empty, or filtered list if not
  const handleInputFocus = () => {
     if (searchTerm.trim() === '') {
        setFilteredStations(stations); // Ensure full list is ready
     }
     // Always show dropdown on focus, regardless of whether it was already filtered
     setIsDropdownVisible(true);
  };

  return (
    <div ref={searchContainerRef} className="relative w-full max-w-md mx-auto"> {/* Removed mb-6 */}
      <input
        type="text"
        placeholder="Search for a station..."
        value={searchTerm}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500" // Added text-sm
      />
      {isDropdownVisible && (
        <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto dark:bg-gray-800 dark:border-gray-600">
          {filteredStations.map((station) => (
            <li
              key={station.code}
              onClick={() => handleStationSelect(station.code)}
              className="px-4 py-2 hover:bg-blue-100 cursor-pointer text-gray-900 dark:text-gray-100 dark:hover:bg-gray-700"
            >
              {station.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}