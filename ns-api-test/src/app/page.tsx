// StationSearch is now rendered in layout.tsx

export default function Home() {

  return (
    <div className="min-h-screen bg-gray-50 font-[family-name:var(--font-geist-sans)]">
      <main className="max-w-4xl mx-auto p-4 sm:p-8">
        <h1 className="text-3xl font-bold mb-8 text-center text-blue-900">
          Dutch Train Departures
        </h1>
        {/* StationSearch removed, now in layout */}

        <p className="text-center text-gray-600 dark:text-gray-400 mb-8">
          Use the search bar above to find departures and arrivals for a specific station.
        </p>

        {/* Content previously showing departures is removed. */}
        {/* The StationSearch component handles navigation. */}
      </main>
    </div>
  );
}
