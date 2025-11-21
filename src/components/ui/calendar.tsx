"use client"

import * as React from "react"


import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

export interface CalendarProps {
  selected: Date | null;
  onSelect: (date: Date | null) => void;
  className?: string;
  // react-datepicker specific props can be added here as needed
  // For example, to allow passing all valid DatePicker props:
  [key: string]: unknown;
}


function Calendar({ selected, onSelect, className, ...props }: CalendarProps) {
  return (
    <DatePicker
      selected={selected}
      onChange={onSelect}
      inline // To display the calendar directly without an input field
      className={className}
      // calendarClassName={cn("p-3", className)} // Reusing the className for the calendar itself
      // All other styling and component overrides are removed for now.
      // They can be re-added using react-datepicker's customization options if needed.
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
