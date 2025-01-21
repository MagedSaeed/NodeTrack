import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Activity, Server, Users, Cpu } from 'lucide-react';

const GPUDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const serverAddress = import.meta.env.VITE_SERVER_ADDRESS
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
    const interval = setInterval(fetchData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Activity className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-2">Loading dashboard...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen text-red-500">
        <span>{error}</span>
      </div>
    );
  }

  // Transform data for the charts
  const userChartData = Object.entries(data.per_user).map(([username, stats]) => ({
    name: username,
    'Average Memory': Math.round(stats.avg_memory),
    'Additional to Max': Math.round(stats.max_memory - stats.avg_memory) // This represents the difference
  }));

  const nodeChartData = Object.entries(data.per_node).map(([hostname, stats]) => ({
    name: hostname,
    'Average Memory (MB)': Math.round(stats.avg_memory),
    'Active Users': stats.unique_users
  }));

  // Update the total GPUs calculation in the GPUDashboard component
  const totalGPUs = Object.entries(data.per_node).reduce((total, [_, stats]) => {
        // Each node reports its total GPUs through the unique_users field
        // We sum across nodes to get total cluster GPUs
        return total + Math.max(...Object.values(data.last_24h)
        .filter(entry => entry.hostname === _)
        .map(entry => entry.gpus_used));
    }, 0);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">GPU Cluster Monitoring Dashboard</h1>
        
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Active Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Object.keys(data.per_user).length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Nodes</CardTitle>
              <Server className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Object.keys(data.per_node).length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total GPUs in Use</CardTitle>
                <Cpu className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">
                {totalGPUs}
                </div>
            </CardContent>
         </Card>
        </div>

        {/* Memory Usage by User */}
        <Card className="mb-8">
            <CardHeader>
                <CardTitle>Memory Usage by User</CardTitle>
            </CardHeader>
            <CardContent className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                <BarChart data={userChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip 
                    formatter={(value, name, props) => {
                        if (name === 'Additional to Max') {
                        const baseValue = props.payload['Average Memory'];
                        return [`Max: ${baseValue + value} MB`, 'Max Memory'];
                        }
                        return [`${value} MB`, 'Average Memory'];
                    }}
                    />
                    <Legend />
                    <Bar dataKey="Average Memory" stackId="a" fill="#8b5cf6" /> {/* Purple for average */}
                    <Bar dataKey="Additional to Max" stackId="a" fill="#10b981" /> {/* Green for the difference to max */}
                </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
        {/* Node Utilization */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Node Utilization</CardTitle>
          </CardHeader>
          <CardContent className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={nodeChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="Average Memory (MB)" fill="#8884d8" />
                <Bar dataKey="Active Users" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Recent Activity Table */}
        <Card>
          <CardHeader>
            <CardTitle>Last 24 Hours Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-4">User</th>
                    <th className="text-left p-4">Node</th>
                    <th className="text-left p-4">Avg Memory (MB)</th>
                    <th className="text-left p-4">GPUs Used</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(data.last_24h).map(([key, stats]) => (
                    <tr key={key} className="border-b hover:bg-gray-50">
                      <td className="p-4">{stats.username}</td>
                      <td className="p-4">{stats.hostname}</td>
                      <td className="p-4">{Math.round(stats.avg_memory)}</td>
                      <td className="p-4">{stats.gpus_used}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default GPUDashboard;