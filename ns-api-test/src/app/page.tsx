import StationSearch from "@/components/StationSearch"; // Import the component

export default function Home() {

  return (
    <div className="min-h-screen font-[family-name:var(--font-geist-sans)]"> {/* Removed bg-gray-50 */}
      <main className="max-w-4xl mx-auto p-4 sm:p-8">
        <h1 className="text-3xl font-bold mb-8 text-center text-blue-900 dark:text-blue-300"> {/* Added dark mode text color */}
          Dutch Train Departures
        </h1>
        {/* Add StationSearch component here */}
        <div className="mb-8 flex justify-center"> {/* Center the search bar */}
           <StationSearch />
        </div>

        {/* Content previously showing departures is removed. */}
        {/* The StationSearch component handles navigation. */}
      </main>
    </div>
  );
}
