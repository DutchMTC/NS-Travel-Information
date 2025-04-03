import React from 'react';
import TrainInfoSearch from '../../components/TrainInfoSearch'; // Using relative path for diagnosis

export default function TrainInfoPage() {
  return (
    // Use similar container and padding as main page
    <main className="max-w-4xl mx-auto p-4 sm:p-8">
      {/* Center heading and apply similar styles */}
      <h1 className="text-3xl font-bold mb-4 text-center text-blue-900 dark:text-blue-300">
        Current Journey Lookup
      </h1>
      <p className="mb-8 text-center text-gray-600 dark:text-gray-400"> {/* Center paragraph */}
        Enter a materieelnummer to find its current journey details.
      </p>
      <TrainInfoSearch />
    </main>
  );
}