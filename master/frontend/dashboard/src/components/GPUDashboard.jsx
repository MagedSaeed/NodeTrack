import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CollapsibleCard } from './ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Activity, Server, Users, Cpu, Database, Clock, AlertCircle } from 'lucide-react';

const GPUDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const serverAddress = import.meta.env.VITE_SERVER_ADDRESS;
        const response = await fetch(`http://${serverAddress}:5000/report`);
        const result = await response.json();
        setData(result);
        setLoading(false);
      } catch (err) {
        setError('Failed to fetch data');
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

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

  const userChartData = Object.entries(data.per_user).map(([username, stats]) => {
    const userNodeEntry = Object.entries(data.last_month).find(([_, entry]) => 
      entry.username === username
    );
    
    return {
      name: username,
      'Average Memory': Math.round(stats.avg_memory),
      'Additional to Max': Math.round(stats.max_memory - stats.avg_memory),
      nodeName: userNodeEntry ? userNodeEntry[1].hostname : 'Unknown'
    };
  });

  const nodeChartData = Object.entries(data.per_node).map(([hostname, stats]) => ({
    name: hostname,
    'Average Memory (MB)': Math.round(stats.avg_memory),
    'Active Users': stats.unique_users
  }));

  const totalGPUs = Object.entries(data.per_node).reduce((total, [hostname, stats]) => {
    return total + Math.max(...Object.values(data.last_month)
      .filter(entry => entry.hostname === hostname)
      .map(entry => entry.gpus_used));
  }, 0);

  const CustomizedLabel = (props) => {
    const { x, y, width, payload } = props;
    if (!payload || !payload.nodeName) return null;
    
    return (
      <text
        x={x + width / 2}
        y={y - 6}
        fill="#666"
        textAnchor="middle"
        fontSize="11"
      >
        {payload.nodeName}
      </text>
    );
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 min-h-screen">
      {/* Header Section */}
      <div className="mb-6">
        <div className="flex items-baseline justify-between">
          <h1 className="text-2xl font-bold text-slate-800">NodeTrack Dashboard</h1>
          {data.date_range && (
            <p className="text-xs text-slate-500">
              {new Date(data.date_range.start).toLocaleString()} - {new Date(data.date_range.end).toLocaleString()}
            </p>
          )}
        </div>
        <p className="text-sm text-slate-600 mt-1">High-Performance Computing Resource Monitor</p>
      </div>

      {/* Metrics Overview */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className="bg-white shadow-md hover:shadow-lg transition-all duration-200 rounded-lg border border-slate-100">
          <CardHeader className="flex flex-row items-center justify-between p-4 pb-0">
            <CardTitle className="text-sm font-medium text-slate-600">Active Users</CardTitle>
            <div className="p-1.5 bg-blue-50 rounded-md">
              <Users className="h-4 w-4 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <div className="text-2xl font-bold text-slate-800">{Object.keys(data.per_user).length}</div>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-md hover:shadow-lg transition-all duration-200 rounded-lg border border-slate-100">
          <CardHeader className="flex flex-row items-center justify-between p-4 pb-0">
            <CardTitle className="text-sm font-medium text-slate-600">Active Nodes</CardTitle>
            <div className="p-1.5 bg-emerald-50 rounded-md">
              <Server className="h-4 w-4 text-emerald-500" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <div className="text-2xl font-bold text-slate-800">{Object.keys(data.per_node).length}</div>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-md hover:shadow-lg transition-all duration-200 rounded-lg border border-slate-100">
          <CardHeader className="flex flex-row items-center justify-between p-4 pb-0">
            <CardTitle className="text-sm font-medium text-slate-600">GPUs in Use</CardTitle>
            <div className="p-1.5 bg-violet-50 rounded-md">
              <Cpu className="h-4 w-4 text-violet-500" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <div className="text-2xl font-bold text-slate-800">{totalGPUs}</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="space-y-4">
        <CollapsibleCard
          title={
            <div className="flex items-center space-x-2">
              <div className="p-1.5 bg-blue-50 rounded-md">
                <Database className="h-4 w-4 text-blue-500" />
              </div>
              <span className="text-sm font-medium text-slate-700">Memory Usage Distribution</span>
            </div>
          }
          className="bg-white shadow-md rounded-lg border border-slate-100 overflow-hidden"
        >
          <div className="h-72 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={userChartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
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
                  formatter={(value, name, props) => {
                    if (name === 'Additional to Max') {
                      const baseValue = props.payload['Average Memory'];
                      return [`Max: ${baseValue + value} MB`, 'Maximum Memory'];
                    }
                    return [`${value} MB`, 'Average Memory'];
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="Average Memory" stackId="a" fill="#3b82f6" />
                <Bar dataKey="Additional to Max" stackId="a" fill="#10b981" label={CustomizedLabel} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CollapsibleCard>

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
              <span className="text-sm font-medium text-slate-700">Monthly Activity Log</span>
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
                {Object.entries(data.last_month).map(([key, stats]) => (
                  <tr 
                    key={key} 
                    className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors duration-150"
                  >
                    <td className="py-2 px-3 text-xs text-slate-700">{stats.username}</td>
                    <td className="py-2 px-3 text-xs text-slate-700">{stats.hostname}</td>
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