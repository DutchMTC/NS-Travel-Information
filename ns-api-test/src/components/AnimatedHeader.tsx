"use client"; // Client component for framer-motion

    import { motion } from 'framer-motion';
    import StationSearch from "./StationSearch";
    import { ThemeToggleButton } from "./ThemeToggleButton";

    export const AnimatedHeader = () => {
      return (
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="p-4 bg-white shadow-md sticky top-0 z-20 dark:bg-gray-800"
        >
          <div className="max-w-4xl mx-auto flex justify-between items-center gap-x-4">
            <StationSearch />
            <ThemeToggleButton />
          </div>
        </motion.header>
      );
    };