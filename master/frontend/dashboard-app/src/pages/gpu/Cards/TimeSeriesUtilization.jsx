import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '../../../shared_ui/Card';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, Brush 
} from 'recharts';
import { Database } from 'lucide-react';
import _ from 'lodash';

const TIME_PERIODS = {
  HOUR: { label: 'Hourly', value: 'hour', days: 7 },
  DAY: { label: 'Daily', value: 'day', days: 30 },
  WEEK: { label: 'Weekly', value: 'week', days: 90 },
  MONTH: { label: 'Monthly', value: 'month', days: 365 }
};

// Improved color generation for better distinction between nodes
const generateDistinctColors = (count) => {
  const colors = [];
  for (let i = 0; i < count; i++) {
    const hue = (i * 137.508) % 360; // Use golden ratio for maximum distribution
    const saturation = 65 + Math.random() * 10; // Keep saturation relatively consistent
    const lightness = 65 + Math.random() * 10; // Keep lightness relatively consistent
    colors.push(`hsla(${hue}, ${saturation}%, ${lightness}%, 0.7)`);
  }
  return colors;
};

// Helper function to get period key for grouping
const getPeriodKey = (date, period) => {
  const d = new Date(date);
  switch (period) {
    case 'hour':
      return d.toISOString().slice(0, 13); // YYYY-MM-DDTHH
    case 'day':
      return d.toISOString().slice(0, 10); // YYYY-MM-DD
    case 'week':
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      return weekStart.toISOString().slice(0, 10);
    case 'month':
      return d.toISOString().slice(0, 7); // YYYY-MM
    default:
      return d.toISOString();
  }
};

const TimeSeriesUtilizationCard = ({ data }) => {
  const [selectedPeriod, setSelectedPeriod] = useState(TIME_PERIODS.HOUR);
  const [filteredData, setFilteredData] = useState([]);

  // Get unique nodes and assign colors
  const nodeColors = useMemo(() => {
    if (!data?.time_series?.nodes_timeseries) return {};
    
    const nodes = data.time_series.nodes_timeseries.map(node => Object.keys(node)[0]);
    const colors = generateDistinctColors(nodes.length);
    
    return nodes.reduce((acc, node, index) => {
      acc[node] = colors[index];
      return acc;
    }, {});
  }, [data?.time_series?.nodes_timeseries]);

  useEffect(() => {
    if (!data?.time_series?.nodes_timeseries) return;

    const now = new Date();
    const startDate = new Date(now.getTime() - (selectedPeriod.days * 24 * 60 * 60 * 1000));

    // First, collect all timestamps and initialize the map
    const allTimestamps = new Set();
    const nodeData = {};
    
    // Initialize node data structure
    data.time_series.nodes_timeseries.forEach(node => {
      const [nodeName, timeseries] = Object.entries(node)[0];
      nodeData[nodeName] = {};
      
      timeseries.forEach(point => {
        const pointDate = new Date(point.timestamp);
        if (pointDate >= startDate && pointDate <= now) {
          const periodKey = getPeriodKey(pointDate, selectedPeriod.value);
          allTimestamps.add(periodKey);
          
          if (!nodeData[nodeName][periodKey]) {
            nodeData[nodeName][periodKey] = [];
          }
          nodeData[nodeName][periodKey].push(point.memory_used);
        }
      });
    });

    // Convert timestamps to sorted array
    const sortedTimestamps = Array.from(allTimestamps).sort();

    // Create aggregated data points
    const aggregatedData = sortedTimestamps.map(timestamp => {
      const dataPoint = { timestamp };

      Object.entries(nodeData).forEach(([nodeName, periodData]) => {
        const values = periodData[timestamp] || [];
        if (values.length > 0) {
          dataPoint[nodeName] = _.mean(values);
        }
      });

      const allValues = Object.values(nodeData)
        .map(periodData => periodData[timestamp] || [])
        .flat()
        .filter(val => val !== undefined);

      if (allValues.length > 0) {
        dataPoint.max_memory = Math.max(...allValues);
        dataPoint.min_memory = Math.min(...allValues);
        dataPoint.avg_memory = _.mean(allValues);
      }

      return dataPoint;
    });

    // Reduce the number of visible points based on the data size
    const maxPoints = 100; // Maximum number of points to show
    const skip = Math.ceil(aggregatedData.length / maxPoints);
    const reducedData = aggregatedData.filter((_, index) => index % skip === 0);

    setFilteredData(reducedData);
  }, [selectedPeriod, data?.time_series?.nodes_timeseries]);

  const stats = useMemo(() => ({
    avg_memory: data.time_series?.summary?.hourly_stats?.avg_memory_gb || 0,
    max_memory: data.time_series?.summary?.hourly_stats?.max_memory_gb || 0,
    min_memory: data.time_series?.summary?.hourly_stats?.min_memory_gb || 0,
    total_nodes: data.time_series?.summary?.total_nodes || 0
  }), [data.time_series?.summary]);

  const formatTimeLabel = (timestamp) => {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) {
      return timestamp;
    }

    switch (selectedPeriod.value) {
      case 'hour':
        return `${date.getHours().toString().padStart(2, '0')}:00`;
      case 'day':
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      case 'week':
        return `Week ${date.getDate()}/${date.getMonth() + 1}`;
      case 'month':
        return date.toLocaleString('default', { month: 'short', year: '2-digit' });
      default:
        return timestamp;
    }
  };

  return (
    <Card className="bg-white shadow-md rounded-lg border border-slate-100 overflow-hidden">
      <div className="p-6">
        {/* Card header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-blue-50 rounded-md">
              <Database className="h-5 w-5 text-blue-500" />
            </div>
            <span className="text-base font-medium text-slate-700">Node Memory Usage Over Time</span>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {Object.values(TIME_PERIODS).map((period) => (
              <button
                key={period.value}
                onClick={() => setSelectedPeriod(period)}
                className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
                  selectedPeriod.value === period.value
                    ? 'bg-blue-100 text-blue-700 font-medium'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {period.label}
              </button>
            ))}
          </div>
        </div>
        
        {/* Statistics cards */}
        <div className="grid grid-cols-4 gap-6 mb-8">
          <div className="p-4 bg-slate-50 rounded-lg">
            <div className="text-sm text-slate-600 mb-2">Average Nodes Usage</div>
            <div className="text-2xl font-bold text-slate-800">
              {stats.avg_memory.toFixed(2)} GB
            </div>
          </div>
          <div className="p-4 bg-slate-50 rounded-lg">
            <div className="text-sm text-slate-600 mb-2">Max Nodes Usage</div>
            <div className="text-2xl font-bold text-slate-800">
              {stats.max_memory.toFixed(2)} GB
            </div>
          </div>
          <div className="p-4 bg-slate-50 rounded-lg">
            <div className="text-sm text-slate-600 mb-2">Min Nodes Usage</div>
            <div className="text-2xl font-bold text-slate-800">
              {stats.min_memory.toFixed(2)} GB
            </div>
          </div>
          <div className="p-4 bg-slate-50 rounded-lg">
            <div className="text-sm text-slate-600 mb-2">Total Nodes</div>
            <div className="text-2xl font-bold text-slate-800">
              {stats.total_nodes}
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart 
              data={filteredData} 
              margin={{ top: 10, right: 50, left: 60, bottom: 100 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis 
                dataKey="timestamp" 
                tick={{ fill: '#64748b', fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                interval="preserveStartEnd"
                tickFormatter={formatTimeLabel}
                height={60}
                padding={{ left: 10, right: 10 }}
              />
              <YAxis 
                tick={{ fill: '#64748b', fontSize: 12 }}
                tickCount={10}
                domain={[0, 'auto']}
                label={{ 
                  value: 'Node Memory Usage (GB)', 
                  angle: -90, 
                  position: 'insideLeft',
                  style: { fill: '#64748b', fontSize: '14px', textAnchor: 'middle' },
                  offset: -20
                }}
                width={55}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                  fontSize: '12px',
                  padding: '8px'
                }}
                formatter={(value, name) => {
                  if (name.startsWith('node_')) {
                    return [`${value?.toFixed(2)} GB`, `Node: ${name.replace('node_', '')}`];
                  }
                  return [`${value?.toFixed(2)} GB`, name];
                }}
                itemSorter={(item) => {
                  // Order: 1. Max 2. Avg 3. Min 4. Nodes
                  if (item.name === 'max_memory') return -4;
                  if (item.name === 'avg_memory') return -3;
                  if (item.name === 'min_memory') return -2;
                  return -10; // nodes
                }}
                labelFormatter={(label) => formatTimeLabel(label)}
              />
              <Legend 
                verticalAlign="top"
                height={36}
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: '12px', paddingTop: '15px' }}
                payload={[
                  { value: 'Maximum Memory', type: 'line', color: '#ef4444' },
                  { value: 'Average Memory', type: 'line', color: '#3b82f6' },
                  { value: 'Minimum Memory', type: 'line', color: '#22c55e' }
                ]}
              />
              
              {/* Statistics lines */}
              <Line 
                type="monotone" 
                dataKey="max_memory" 
                stroke="#ef4444"
                name="Maximum Memory"
                strokeWidth={1.5}
                strokeDasharray="5 5"
                dot={false}
                activeDot={{ r: 6, stroke: '#ef4444', strokeWidth: 2, fill: 'white' }}
              />
              <Line 
                type="monotone" 
                dataKey="avg_memory" 
                stroke="#3b82f6"
                name="Average Memory"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2, fill: 'white' }}
              />
              <Line 
                type="monotone" 
                dataKey="min_memory" 
                stroke="#22c55e"
                name="Minimum Memory"
                strokeWidth={1.5}
                strokeDasharray="5 5"
                dot={false}
                activeDot={{ r: 6, stroke: '#22c55e', strokeWidth: 2, fill: 'white' }}
              />

              {/* Individual node lines (hidden from legend) */}
              {Object.entries(nodeColors).map(([nodeKey, color]) => (
                <Line 
                  key={nodeKey}
                  type="monotone" 
                  dataKey={nodeKey}
                  stroke={color}
                  name={nodeKey}
                  strokeWidth={1}
                  dot={false}
                  activeDot={{ r: 4, stroke: color, strokeWidth: 1, fill: 'white' }}
                  hide={false}
                  legendType="none"
                />
              ))}
              
              
              <Brush 
                dataKey="timestamp"
                height={30}
                stroke="#94a3b8"
                tickFormatter={formatTimeLabel}
                y={300}
                travellerWidth={10}
                fill="#f8fafc"
                padding={{ top: 10 }}
                tick={{ fontSize: 10, fill: '#44748b' }}
                gap={10}
                x={225}
                width={500}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {data.date_range && (
          <div className="mt-6 text-sm text-slate-500 text-center">
            Data Range: {data.date_range.start} - {data.date_range.end}
          </div>
        )}
      </div>
    </Card>
  );
};

export default TimeSeriesUtilizationCard;