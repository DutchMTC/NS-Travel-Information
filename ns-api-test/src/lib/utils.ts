// src/lib/utils.ts

/**
 * Formats an ISO date string (e.g., "2023-10-27T10:30:00+0200")
 * into a HH:mm time string using Dutch locale.
 * Returns "Invalid Time" on error.
 */
export function formatTime(isoDateTime: string): string {
  try {
    const date = new Date(isoDateTime);
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