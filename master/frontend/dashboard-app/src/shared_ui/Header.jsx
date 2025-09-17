import React, { useState, useEffect } from 'react';
import { Calendar, LogOut } from 'lucide-react';
import { useDateRange } from '../contexts/DateContext';
import { deleteCookie } from '../utils/auth'; // Import deleteCookie from auth

const Header = () => {
    const { startDate, endDate, setStartDate, setEndDate } = useDateRange();

    // Get today's date in YYYY-MM-DD format for max date constraint
    const today = new Date().toISOString().split('T')[0];
    // Get tomorrow's date for the end date field
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    // Get three months ago for minimum date constraint
    const threeMonthsAgo = new Date(Date.now() - (90 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];

    // Validate start date on component mount and ensure it's not older than 3 months
    useEffect(() => {
        if (startDate < threeMonthsAgo) {
            setStartDate(threeMonthsAgo);
        }
    }, [startDate, threeMonthsAgo, setStartDate]);

    const handleStartDateChange = (e) => {
        const selectedDate = e.target.value;
        if (selectedDate < threeMonthsAgo) {
            // If user tries to select a date older than 3 months, set it to 3 months ago
            setStartDate(threeMonthsAgo);
        } else {
            setStartDate(selectedDate);
        }
    };

    const handleLogout = () => {
      // Ask for confirmation before logging out
      const confirmLogout = window.confirm('Are you sure you want to log out? You will need to enter your access token again on the next request.');
      
      if (confirmLogout) {
        // Delete the access token from cookies
        deleteCookie('access_token');
        
        // Show a notification that user has logged out
        alert('You have been logged out successfully.');
        
        // Refresh the page
        window.location.reload();
      }
    };
    
    return (
      <div className="mb-6 bg-slate-100 rounded-lg p-4">
        <div className="flex items-baseline justify-between">
          <h1 className="text-2xl font-bold text-slate-800">NodeTrack Dashboard</h1>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-slate-500" />
              <input
                type="date"
                value={startDate}
                min={threeMonthsAgo}
                max={today}
                onChange={handleStartDateChange}
                className="text-xs border rounded px-2 py-1"
              />
              <span className="text-xs text-slate-500">to</span>
              <input
                type="date"
                value={endDate}
                max={tomorrow}
                onChange={(e) => setEndDate(e.target.value)}
                className="text-xs border rounded px-2 py-1"
              />
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-1 px-3 py-1 text-xs text-red-600 bg-white border border-red-200 rounded-md hover:bg-red-50 transition-colors"
              title="Logout"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
        <p className="text-sm text-slate-600 mt-1">High-Performance Computing Resource Monitor</p>
      </div>
    );
  };

export default Header