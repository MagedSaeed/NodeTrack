import React, { useState, useEffect } from 'react';
import { Activity } from 'lucide-react';
import TimeSeriesUtilizationCard from '../../shared_ui/TimeSeriesUtilization';
import ErrorIcon from '../../shared_ui/ErrorIcon';
import { useDateRange } from '../../contexts/DateContext';
import { fetchWithTokenAuth } from '../../utils/auth'; // Import the auth utility

const GPU = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { startDate, endDate } = useDateRange();

  const fetchData = async () => {
    try {
      // Clear previous error when starting new request
      setError(null);

      // Use relative path - Vite will proxy to backend
      const url = new URL('/api/gpu/report', window.location.origin);
      if (startDate) url.searchParams.append('start_date', startDate);
      if (endDate) url.searchParams.append('end_date', endDate);

      // Use the auth utility to handle token management and requests
      await fetchWithTokenAuth({
        url: url.toString(),
        onSuccess: (result) => setData(result),
        onError: (errorMsg) => setError(errorMsg),
        setLoading: setLoading
      });
    } catch (err) {
      console.error("Error in fetchData:", err);
      setError(err.message || 'Failed to fetch data');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Set up polling interval
    const interval = setInterval(fetchData, 300000); // 5 minutes
    
    // Cleanup interval on unmount
    return () => clearInterval(interval);
  }, [startDate, endDate]); // Re-fetch when dates change

  if (loading) {
    return (
      <div className="flex items-center justify-center h-80">
        <Activity className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-80">
        <ErrorIcon message={`Error loading GPU data: ${error}`} size="w-8 h-8" />
      </div>
    );
  }

  if (!data || !data.per_user || !data.per_node) {
    return (
      <div className="flex items-center justify-center h-80">
        <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-100 flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 text-yellow-500" />
          <span className="text-yellow-600 text-sm font-medium">Invalid data format received</span>
        </div>
      </div>
    );
  }
  return (
    <div>
      {/* Charts Section */}
      <div className="space-y-4">
        {/* Time Series Utilization Chart */}
        <TimeSeriesUtilizationCard data={data} />

        {/* Activity Log - Fixed Table */}
        {/* <ActivityLog data={data} /> */}
      </div>
    </div>
  );
};

export default GPU;