"use client"; // Client component for framer-motion

    import { useState, Suspense } from 'react'; // Import useState and Suspense
    import { useSearchParams } from 'next/navigation'; // Import useSearchParams
    import { motion, AnimatePresence } from 'framer-motion'; // Import AnimatePresence
    import Link from 'next/link';
    import Image from 'next/image';
    import { useTheme } from "./ThemeProvider"; // Use local ThemeProvider hook
    // import StationSearch from "./StationSearch"; // Removed import
    import { ThemeToggleButton } from "./ThemeToggleButton";
    
    
    // Inner component to access searchParams safely within Suspense
    const HeaderContent = () => {
      const searchParams = useSearchParams();
      const isPlainMode = searchParams.get('plain') === 'true';

      // If plain mode is active, render nothing
      if (isPlainMode) {
        return null;
      }

      // Original header logic starts here if not in plain mode
      const { theme } = useTheme(); // Get current theme
      const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    
      const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);
    
      const menuVariants = {
        hidden: { opacity: 0, y: -20 },
        visible: { opacity: 1, y: 0 },
      };
      return (
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="p-4 bg-white shadow-md sticky top-0 z-20 dark:bg-gray-800"
        >
          <div className="max-w-4xl mx-auto flex justify-between items-center">
            {/* Logo */}
            <Link href="/" className="flex items-center shrink-0 mr-4"> {/* Ensure logo doesn't shrink excessively */}
              <Image
                src={theme === 'dark' ? "/assets/global/Spoorwijzer Logo Dark Mode.svg" : "/assets/global/Spoorwijzer Logo.svg"} // Conditional src
                alt="Spoorwijzer Logo"
                width={192} // Adjust size as needed (240 * 0.8)
                height={192} // Adjust size as needed (240 * 0.8)
                priority // Prioritize loading the logo
                className="h-10 w-auto" // Control height, auto width for aspect ratio
              />
            </Link>
    
            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-x-4 flex-grow justify-end">
              <nav className="flex items-center gap-x-4">
                <Link href="/" className="text-sm font-medium hover:underline text-gray-700 dark:text-gray-300">
                  Departures/Arrivals
                </Link>
                <Link href="/train-info" className="text-sm font-medium hover:underline text-gray-700 dark:text-gray-300">
                  Train Lookup
                </Link>
              </nav>
              <ThemeToggleButton />
            </div>
    
            {/* Mobile Menu Button */}
            <div className="md:hidden flex items-center">
              <button
                onClick={toggleMobileMenu}
                className="p-2 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
                aria-label="Toggle menu"
              >
                {/* Simple Hamburger Icon */}
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
              </button>
            </div>
          </div>
    
          {/* Mobile Menu */}
          <AnimatePresence>
            {isMobileMenuOpen && (
              <motion.div
                variants={menuVariants}
                initial="hidden"
                animate="visible"
                exit="hidden"
                transition={{ duration: 0.3 }}
                className="md:hidden mt-4 p-4 bg-white dark:bg-gray-800 rounded-md shadow-lg absolute top-full left-0 right-0 z-10" // Position below header
              >
                <nav className="flex flex-col gap-y-4 items-start">
                  <Link href="/" className="block w-full text-base font-medium hover:underline text-gray-700 dark:text-gray-300" onClick={toggleMobileMenu}>
                    Departures/Arrivals
                  </Link>
                  <Link href="/train-info" className="block w-full text-base font-medium hover:underline text-gray-700 dark:text-gray-300" onClick={toggleMobileMenu}>
                    Train Lookup
                  </Link>
                  <div className="mt-2 w-full">
                     <ThemeToggleButton />
                  </div>
                </nav>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.header>
      );
    };

    // Export a wrapper component that uses Suspense
    export const AnimatedHeader = () => {
      return (
        // Suspense is needed because useSearchParams() suspends rendering
        <Suspense fallback={null}> {/* Render nothing during suspense */}
          <HeaderContent />
        </Suspense>
      );
    };