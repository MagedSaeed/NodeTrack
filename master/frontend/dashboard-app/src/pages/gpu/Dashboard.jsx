import React, { useState, useEffect } from 'react';
import { CollapsibleCard } from '../../shared_ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Activity, Server, Users, Cpu, Clock, AlertCircle } from 'lucide-react';
import TimeSeriesUtilizationCard from './Cards/TimeSeriesUtilization';
import { useDateRange } from '../../contexts/DateContext';
import Overview from './Cards/Overview';
import NodeUtilization from './Cards/NodeUtilization';
import ActivityLog from './Cards/ActivityLog';

const GPU = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { startDate, endDate } = useDateRange();

  const fetchData = async () => {
    try {
      setLoading(true);
      const serverAddress = import.meta.env.VITE_SERVER_ADDRESS;
      const response = await fetch(
        `http://${serverAddress}:5000/report`
      );
      const result = await response.json();
      setData(result);
      setLoading(false);
    } catch (err) {
      setError('Failed to fetch data');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 300000);
    return () => clearInterval(interval);
  }, [startDate, endDate]);

  if (loading) return (
    <div className="flex items-center justify-center h-80">
      <Activity className="w-6 h-6 animate-spin text-blue-500" />
    </div>
  );

  if (error) return (
    <div className="flex items-center justify-center h-80">
      <div className="p-3 bg-red-50 rounded-lg border border-red-100 flex items-center space-x-2">
        <AlertCircle className="w-5 h-5 text-red-500" />
        <span className="text-red-600 text-sm font-medium">{error}</span>
      </div>
    </div>
  );

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
      {/* Metrics Overview */}

      <Overview data={data} />

      {/* Charts Section */}
      <div className="space-y-4">

        {/* Time Series Utilization Card */}
        <TimeSeriesUtilizationCard data={data} />

        {/* Node Utilization Analysis - Fixed Chart */}
        <NodeUtilization data={data} />

        {/* Activity Log - Fixed Table */}
        <ActivityLog data={data} />

      </div>
    </div>
  );
};

export default GPU;