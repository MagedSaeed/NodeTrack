import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CollapsibleCard } from './ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Activity, Server, Users, Cpu, Database, Clock, AlertCircle, Calendar } from 'lucide-react';
import TimeSeriesUtilizationCard from './avg_utilization';

const GPUDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [startDate, setStartDate] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const serverAddress = import.meta.env.VITE_SERVER_ADDRESS;
      const response = await fetch(
        `http://${serverAddress}:5000/report?start_date=${startDate}&end_date=${endDate}`
      );
      const result = await response.json();
      console.log('results are',result)
      setData(result);
      setLoading(false);
    } catch (err) {
      setError('Failed to fetch data');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
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

  const nodeChartData = Object.entries(data.per_node).map(([hostname, stats]) => ({
    name: hostname,
    'Average Memory (MB)': Math.round(stats.avg_memory || 0),
    'Active Users': stats.unique_users || 0,
    'Total GPUs': stats.total_gpus || 0
  }));

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 min-h-screen">
      {/* Header Section */}
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

      {/* Metrics Overview */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className="bg-white shadow-md hover:shadow-lg transition-all duration-200 rounded-lg border border-slate-100">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 bg-blue-50 rounded-md">
                <Users className="h-4 w-4 text-blue-500" />
              </div>
              <h3 className="text-sm font-medium text-slate-600">Active Users</h3>
            </div>
            <div className="text-2xl font-bold text-slate-800">
              {Object.keys(data.per_user).length}
            </div>
          </div>
        </Card>

        <Card className="bg-white shadow-md hover:shadow-lg transition-all duration-200 rounded-lg border border-slate-100">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 bg-emerald-50 rounded-md">
                <Server className="h-4 w-4 text-emerald-500" />
              </div>
              <h3 className="text-sm font-medium text-slate-600">Active Nodes</h3>
            </div>
            <div className="text-2xl font-bold text-slate-800">
              {Object.keys(data.per_node).length}
            </div>
          </div>
        </Card>

        <Card className="bg-white shadow-md hover:shadow-lg transition-all duration-200 rounded-lg border border-slate-100">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 bg-violet-50 rounded-md">
                <Cpu className="h-4 w-4 text-violet-500" />
              </div>
              <h3 className="text-sm font-medium text-slate-600">GPUs in Use</h3>
            </div>
            <div className="text-2xl font-bold text-slate-800">{data.summary.total_gpus}</div>
          </div>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="space-y-4">
        <TimeSeriesUtilizationCard data={data} />

        <CollapsibleCard
          title={
            <div className="flex items-center space-x-2">
              <div className="p-1.5 bg-emerald-50 rounded-md">
                <Server className="h-4 w-4 text-emerald-500" />
              </div>
              <span className="text-sm font-medium text-slate-700">Node Utilization Analysis</span>
            </div>
          }
          className="bg-white shadow-md rounded-lg border border-slate-100 overflow-hidden"
        >
          <div className="h-72 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={nodeChartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    boxShadow: '0 2px 4px -1px rgba(0,0,0,0.05), 0 1px 2px -1px rgba(0,0,0,0.05)',
                    fontSize: '12px'
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="Average Memory (MB)" fill="#3b82f6" />
                <Bar dataKey="Active Users" fill="#10b981" />
                <Bar dataKey="Total GPUs" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CollapsibleCard>

        <CollapsibleCard
          title={
            <div className="flex items-center space-x-2">
              <div className="p-1.5 bg-violet-50 rounded-md">
                <Clock className="h-4 w-4 text-violet-500" />
              </div>
              <span className="text-sm font-medium text-slate-700">Activity Log</span>
            </div>
          }
          className="bg-white shadow-md rounded-lg border border-slate-100 overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">User</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">Node</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">Avg Memory (MB)</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">GPUs Used</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(data.per_user).map(([username, stats]) => (
                  <tr 
                    key={username} 
                    className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors duration-150"
                  >
                    <td className="py-2 px-3 text-xs text-slate-700">{username}</td>
                    <td className="py-2 px-3 text-xs text-slate-700">{stats.nodes_used}</td>
                    <td className="py-2 px-3 text-xs text-slate-700">{Math.round(stats.avg_memory)}</td>
                    <td className="py-2 px-3 text-xs text-slate-700">{stats.gpus_used}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CollapsibleCard>
      </div>
    </div>
  );
};

export default GPUDashboard;