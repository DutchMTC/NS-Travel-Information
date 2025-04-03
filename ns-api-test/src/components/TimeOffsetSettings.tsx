// ns-api-test/src/components/TimeOffsetSettings.tsx
import React from 'react';

interface TimeOffsetSettingsProps {
  offsetMinutes: number;
  onOffsetChange: (minutes: number) => void; // Only minutes needed
}

const TimeOffsetSettings: React.FC<TimeOffsetSettingsProps> = ({
  offsetMinutes,
  onOffsetChange,
}) => {
  const handleMinutesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const stringValue = e.target.value;
    // Treat empty string as 0, otherwise parse
    const value = stringValue === '' ? 0 : parseInt(stringValue, 10);
    // Ensure we pass 0 if parsing results in NaN (e.g., for non-numeric input)
    onOffsetChange(isNaN(value) ? 0 : value);
  };

  return (
    // Simplified layout for minutes only
    <div className="p-4 space-y-2">
      <label htmlFor="offset-minutes" className="block text-sm font-medium">
        Offset (Minutes from Now)
      </label>
      <input
        type="number"
        id="offset-minutes"
        name="offset-minutes"
        min="0"
        step="1" // Allow increments of 1
        // Display empty string if value is 0
        value={offsetMinutes === 0 ? '' : offsetMinutes}
        onChange={handleMinutesChange}
        className="w-full p-2 border rounded-md bg-input text-foreground"
        placeholder="0"
      />
      <p className="text-xs text-muted-foreground">Set the time offset in minutes from now.</p>
    </div>
  );
};

export default TimeOffsetSettings;