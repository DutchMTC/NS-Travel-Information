"use client";

import React from 'react';

type JourneyType = 'departures' | 'arrivals';

interface JourneyTypeSwitchProps {
  currentType: JourneyType;
  onChange: (newType: JourneyType) => void;
}

export const JourneyTypeSwitch: React.FC<JourneyTypeSwitchProps> = ({ currentType, onChange }) => {
  const switchType = (type: JourneyType) => {
    if (type !== currentType) {
      onChange(type);
    }
  };

  const baseClasses = "px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-150 ease-in-out";
  const activeClasses = "bg-blue-600 text-white dark:bg-blue-500";
  const inactiveClasses = "bg-white text-blue-700 hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600";

  return (
    <div className="inline-flex rounded-md shadow-sm" role="group">
      <button
        type="button"
        onClick={() => switchType('departures')}
        className={`${baseClasses} rounded-l-lg border border-gray-300 dark:border-gray-600 ${currentType === 'departures' ? activeClasses : inactiveClasses}`}
      >
        Departures
      </button>
      <button
        type="button"
        onClick={() => switchType('arrivals')}
        className={`${baseClasses} rounded-r-lg border-t border-b border-r border-gray-300 dark:border-gray-600 ${currentType === 'arrivals' ? activeClasses : inactiveClasses}`}
      >
        Arrivals
      </button>
    </div>
  );
};