import React, { createContext, useContext, useState } from 'react';

// Create the Date Context
const DateContext = createContext();

// Create a DateProvider component
export const DateProvider = ({ children }) => {
  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(
    new Date().toISOString().split('T')[0]
  );

  return (
    <DateContext.Provider value={{ startDate, endDate, setStartDate, setEndDate }}>
      {children}
    </DateContext.Provider>
  );
};

// Custom hook to use the date context
export const useDateRange = () => {
  const context = useContext(DateContext);
  if (!context) {
    throw new Error('useDateRange must be used within a DateProvider');
  }
  return context;
};