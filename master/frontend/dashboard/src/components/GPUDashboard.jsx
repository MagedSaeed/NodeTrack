import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center space-y-4">
          <Activity className="w-12 h-12 animate-spin text-blue-600 mx-auto" />
          <p className="text-lg font-medium text-gray-600">Loading NodeTrack Dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
          <p className="text-lg font-medium text-red-500">{error}</p>
        </div>
      </div>
    );
  }

  // Transform data for the charts with proper node mapping
  const userChartData = Object.entries(data.per_user).map(([username, stats]) => {
    // Find the node information from last_24h data
    const userNodeEntry = Object.entries(data.last_24h).find(([_, entry]) => 
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
    return total + Math.max(...Object.values(data.last_24h)
      .filter(entry => entry.hostname === hostname)
      .map(entry => entry.gpus_used));
  }, 0);

  const CustomizedLabel = (props) => {
    const { x, y, width, payload, value } = props;
    if (!payload || !payload.nodeName) return null;
    
    // Calculate total height of the stack
    const totalValue = payload['Average Memory'] + payload['Additional to Max'];
    // Get y position for the first bar (which is at the bottom)
    const yAxis = props.chartProps?.children?.find(child => child.type.displayName === 'YAxis');
    const yScale = yAxis?.props?.scale;
    // Calculate position at the top of the stacked bar
    const yPos = yScale ? yScale(totalValue) : y;
    
    return (
      <text
        x={x + width / 2}
        y={yPos - 10}  // Position above the total height
        fill="#666"
        textAnchor="middle"
        fontSize="12"
      >
        {payload.nodeName}
      </text>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* Header Section */}
          <div className="flex flex-col space-y-2">
            <h1 className="text-4xl font-bold text-gray-900">NodeTrack Dashboard</h1>
            <p className="text-gray-600">High-Performance Computing Resource Monitor</p>
          </div>

          {/* Metrics Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-white border-none shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg font-medium text-gray-900">Active Users</CardTitle>
                <Users className="h-5 w-5 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-900">
                  {Object.keys(data.per_user).length}
                </div>
                <p className="text-sm text-gray-500 mt-1">Currently utilizing resources</p>
              </CardContent>
            </Card>

            <Card className="bg-white border-none shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg font-medium text-gray-900">Active Nodes</CardTitle>
                <Server className="h-5 w-5 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-900">
                  {Object.keys(data.per_node).length}
                </div>
                <p className="text-sm text-gray-500 mt-1">Operational computing nodes</p>
              </CardContent>
            </Card>

            <Card className="bg-white border-none shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg font-medium text-gray-900">GPUs in Use</CardTitle>
                <Cpu className="h-5 w-5 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-900">{totalGPUs}</div>
                <p className="text-sm text-gray-500 mt-1">Total GPU units allocated</p>
              </CardContent>
            </Card>
          </div>

          {/* Charts Section */}
          <div className="space-y-6">
            <Card className="bg-white border-none shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Database className="h-5 w-5 text-blue-600" />
                  <span>Memory Usage Distribution</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={userChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="name" tick={{ fill: '#666' }} />
                    <YAxis tick={{ fill: '#666' }} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                      }}
                      formatter={(value, name, props) => {
                        if (name === 'Additional to Max') {
                          const baseValue = props.payload['Average Memory'];
                          return [`Max: ${baseValue + value} MB`, 'Maximum Memory'];
                        }
                        return [`${value} MB`, 'Average Memory'];
                      }}
                    />
                    <Legend />
                    <Bar dataKey="Average Memory" stackId="a" fill="#4f46e5" />
                    <Bar 
                      dataKey="Additional to Max" 
                      stackId="a" 
                      fill="#10b981"
                      label={CustomizedLabel}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Node Utilization Chart */}
            <Card className="bg-white border-none shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Server className="h-5 w-5 text-green-600" />
                  <span>Node Utilization Analysis</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={nodeChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="name" tick={{ fill: '#666' }} />
                    <YAxis tick={{ fill: '#666' }} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                      }}
                    />
                    <Legend />
                    <Bar dataKey="Average Memory (MB)" fill="#4f46e5" />
                    <Bar dataKey="Active Users" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Activity Log */}
            <Card className="bg-white border-none shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Clock className="h-5 w-5 text-purple-600" />
                  <span>Recent Activity Log</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left p-4 text-gray-600 font-medium">User</th>
                        <th className="text-left p-4 text-gray-600 font-medium">Node</th>
                        <th className="text-left p-4 text-gray-600 font-medium">Avg Memory (MB)</th>
                        <th className="text-left p-4 text-gray-600 font-medium">GPUs Used</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(data.last_24h).map(([key, stats]) => (
                        <tr key={key} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="p-4 text-gray-900">{stats.username}</td>
                          <td className="p-4 text-gray-900">{stats.hostname}</td>
                          <td className="p-4 text-gray-900">{Math.round(stats.avg_memory)}</td>
                          <td className="p-4 text-gray-900">{stats.gpus_used}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GPUDashboard;