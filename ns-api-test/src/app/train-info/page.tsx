import React from 'react';
import type { Metadata } from 'next';
import TrainInfoClientPage from '../../components/TrainInfoClientPage'; // Import the new client component

// Set metadata for this page (Server Component - OK to export metadata)
export const metadata: Metadata = {
  title: 'Train Lookup', // Title will be combined with template: "Train Lookup | Spoorwijzer"
  description: 'Look up information about specific train units (materieelnummer).',
};

// This is now a Server Component
export default function TrainInfoPage() {
  // Simply render the client component that contains the actual UI and client-side logic
  return <TrainInfoClientPage />;
}