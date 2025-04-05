"use client"; // This component needs to be a client component for framer-motion

    import { motion } from 'framer-motion';

    interface AnimatedStationHeadingProps {
      stationName: string;
    }

    export const AnimatedStationHeading: React.FC<AnimatedStationHeadingProps> = ({ stationName }) => {
      return (
        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }} // Stagger after header
          className="text-3xl font-bold text-center text-blue-900 dark:text-blue-300" // Removed mb-6
        >
          {stationName}
        </motion.h1>
      );
    };