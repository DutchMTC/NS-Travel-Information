// ns-api-test/src/lib/utils.ts
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

// Keep the cn function
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats an ISO date string (e.g., "2023-10-27T10:30:00+0200")
 * into a HH:mm time string using Dutch locale.
 * Returns "Invalid Time" on error.
 */
export function formatTime(isoDateTime: string): string {
  try {
    const date = new Date(isoDateTime);
    // Check if date is valid
    if (isNaN(date.getTime())) {
        console.error("Invalid date provided to formatTime:", isoDateTime);
        return "Invalid Time";
    }
    return date.toLocaleTimeString('nl-NL', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch (e) {
    console.error("Error formatting time:", isoDateTime, e);
    return "Invalid Time";
  }
}

/**
 * Calculates the delay in minutes between a planned and actual ISO date string.
 * Returns 0 if the actual time is not later than the planned time or on error.
 */
export function calculateDelay(planned: string, actual: string): number {
  try {
    const plannedDate = new Date(planned);
    const actualDate = new Date(actual);
    // Ensure both dates are valid before comparing
    if (isNaN(plannedDate.getTime()) || isNaN(actualDate.getTime())) {
        console.error("Invalid date provided for delay calculation:", planned, actual);
        return 0;
    }
    const diffMs = actualDate.getTime() - plannedDate.getTime();
    // Only return positive delays
    if (diffMs <= 0) return 0;
    return Math.round(diffMs / (1000 * 60));
  } catch (e) {
    console.error("Error calculating delay:", planned, actual, e);
    return 0;
  }
}

/**
 * Formats a Date object into the "YYYY-MM-DDTHH:mm:ss+ZZZZ" format required by the NS API.
 */
export function formatDateTimeForApi(date: Date): string {
  try {
    // Check if date is valid
    if (isNaN(date.getTime())) {
        console.error("Invalid date provided to formatDateTimeForApi:", date);
        // Return a default or throw an error, depending on desired handling
        // For now, let's return an empty string or a noticeable invalid string
        return "INVALID_DATE_INPUT";
    }

    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0'); // Months are 0-indexed
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');

    // Calculate timezone offset in +/-HHMM format
    const timezoneOffset = -date.getTimezoneOffset(); // Offset is in minutes, reversed sign
    const offsetHours = Math.floor(Math.abs(timezoneOffset) / 60).toString().padStart(2, '0');
    const offsetMinutesPart = (Math.abs(timezoneOffset) % 60).toString().padStart(2, '0'); // Renamed variable
    const offsetSign = timezoneOffset >= 0 ? '+' : '-';
    const timezoneString = `${offsetSign}${offsetHours}${offsetMinutesPart}`;

    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${timezoneString}`;
  } catch (e) {
      console.error("Error formatting date for API:", date, e);
      return "DATE_FORMATTING_ERROR"; // Return error indicator
  }
}
