"use client"; // Need client component for motion

import React, { Suspense } from 'react';
import { motion } from 'framer-motion'; // Import motion
import TrainInfoSearch from '../../components/TrainInfoSearch'; // Using relative path for diagnosis

export default function TrainInfoPage() {
  return (
    // Use similar container and padding as main page
    <motion.main // Wrap main content with motion.main
      initial={{ opacity: 0, y: 10 }} // Initial state: invisible and slightly down
      animate={{ opacity: 1, y: 0 }} // Animate to: visible and original position
      transition={{ duration: 0.5 }} // Animation duration
      className="max-w-4xl mx-auto p-4 sm:p-8"
    >
      {/* Center heading and apply similar styles */}
      <h1 className="text-3xl font-bold mb-4 text-center text-blue-900 dark:text-blue-300">
        Train Lookup
      </h1>
      <p className="mb-8 text-center text-gray-600 dark:text-gray-400"> {/* Center paragraph */}
        Enter a materieelnummer to find its information and latest journey details.
      </p>
      <Suspense fallback={<div className="text-center p-4">Loading search...</div>}>
        <TrainInfoSearch />
      </Suspense>
    </motion.main>
  );
}