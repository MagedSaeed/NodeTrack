import React, { useState, useEffect } from 'react';
import {Calendar} from 'lucide-react';
import { useDateRange } from '../contexts/DateContext';

const Header = () => {
    const { startDate, endDate, setStartDate, setEndDate } = useDateRange();
    
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
                onChange={(e) => setStartDate(e.target.value)}
                className="text-xs border rounded px-2 py-1"
              />
              <span className="text-xs text-slate-500">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="text-xs border rounded px-2 py-1"
              />
            </div>
          </div>
        </div>
        <p className="text-sm text-slate-600 mt-1">High-Performance Computing Resource Monitor</p>
      </div>
    );
  };

export default Header