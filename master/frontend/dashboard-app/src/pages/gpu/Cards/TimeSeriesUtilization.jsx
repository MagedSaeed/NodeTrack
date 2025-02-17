import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '../../../shared_ui/Card';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Brush 
} from 'recharts';
import { Database, ChevronDown } from 'lucide-react';
import _ from 'lodash';

const TIME_PERIODS = {
  HOUR: { label: 'Hourly', value: 'hour', days: 7 },
  DAY: { label: 'Daily', value: 'day', days: 30 },
  WEEK: { label: 'Weekly', value: 'week', days: 90 },
  MONTH: { label: 'Monthly', value: 'month', days: 365 }
};

const generateDistinctColors = (count) => {
  const colors = [];
  for (let i = 0; i < count; i++) {
    const hue = (i * 137.508) % 360;
    const saturation = 65 + Math.random() * 10;
    const lightness = 65 + Math.random() * 10;
    colors.push(`hsla(${hue}, ${saturation}%, ${lightness}%, 0.7)`);
  }
  return colors;
};

const getPeriodKey = (date, period) => {
  const d = new Date(date);
  switch (period) {
    case 'hour':
      return d.toISOString().slice(0, 13);
    case 'day':
      return d.toISOString().slice(0, 10);
    case 'week':
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      return weekStart.toISOString().slice(0, 10);
    case 'month':
      return d.toISOString().slice(0, 7);
    default:
      return d.toISOString();
  }
};

const TimeSeriesUtilizationCard = ({ data }) => {
  const [selectedPeriod, setSelectedPeriod] = useState(TIME_PERIODS.HOUR);
  const [filteredData, setFilteredData] = useState([]);
  const [isNodeDropdownOpen, setIsNodeDropdownOpen] = useState(false);
  const [selectedNodes, setSelectedNodes] = useState({});
  const [showTotalUtilization, setShowTotalUtilization] = useState(true);
  const [showTotalCapacity, setShowTotalCapacity] = useState(true);

  // Get unique nodes and assign colors
  const nodeColors = useMemo(() => {
    if (!data?.time_series?.nodes_timeseries) return {};
    
    const nodes = data.time_series.nodes_timeseries.map(node => Object.keys(node)[0]);
    const colors = generateDistinctColors(nodes.length);
    
    setSelectedNodes(prev => {
      const newState = { ...prev };
      nodes.forEach(node => {
        if (newState[node] === undefined) newState[node] = true;
      });
      return newState;
    });
    
    return nodes.reduce((acc, node, index) => {
      acc[node] = colors[index];
      return acc;
    }, {});
  }, [data?.time_series?.nodes_timeseries]);

  useEffect(() => {
    if (!data?.time_series?.nodes_timeseries) return;

    const now = new Date();
    const startDate = new Date(now.getTime() - (selectedPeriod.days * 24 * 60 * 60 * 1000));

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
            nodeData[nodeName][periodKey] = {
              used: [],
              total: []
            };
          }
          nodeData[nodeName][periodKey].used.push(point.memory_used);
          nodeData[nodeName][periodKey].total.push(point.memory_total);
        }
      });
    });

    // Convert timestamps to sorted array
    const sortedTimestamps = Array.from(allTimestamps).sort();

    // Create aggregated data points
    const aggregatedData = sortedTimestamps.map(timestamp => {
      const dataPoint = { timestamp };

      // Track selected nodes' totals for this timestamp
      let selectedUtilization = 0;
      let selectedCapacity = 0;

      Object.entries(nodeData).forEach(([nodeName, periodData]) => {
        const values = periodData[timestamp] || { used: [], total: [] };
        if (values.used.length > 0) {
          const usedValue = _.mean(values.used);
          const totalValue = _.mean(values.total);
          dataPoint[nodeName] = usedValue;
          dataPoint[`${nodeName}_total`] = totalValue;

          // Only add to totals if node is selected
          if (selectedNodes[nodeName]) {
            selectedUtilization += usedValue;
            selectedCapacity += totalValue;
          }
        }
      });

      // Add totals for selected nodes only
      dataPoint.total_utilization = selectedUtilization;
      dataPoint.total_capacity = selectedCapacity;

      return dataPoint;
    });

    // Reduce the number of visible points based on the data size
    const maxPoints = 100;
    const skip = Math.ceil(aggregatedData.length / maxPoints);
    const reducedData = aggregatedData.filter((_, index) => index % skip === 0);

    setFilteredData(reducedData);
  }, [selectedPeriod, data?.time_series?.nodes_timeseries, selectedNodes]); // Added selectedNodes as dependency

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
          
          <div className="flex items-center space-x-4">
            {/* Modified Node Selection Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsNodeDropdownOpen(!isNodeDropdownOpen)}
                className="px-4 py-2 text-sm bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 flex items-center space-x-2"
              >
                <span>Select Nodes</span>
                <ChevronDown className="h-4 w-4" />
              </button>
              
              {isNodeDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
                  <div className="p-2 border-b border-slate-200">
                    <button
                      onClick={() => {
                        const allSelected = Object.values(selectedNodes).every(v => v);
                        const newState = Object.keys(selectedNodes).reduce((acc, node) => {
                          acc[node] = !allSelected;
                          return acc;
                        }, {});
                        setSelectedNodes(newState);
                      }}
                      className="text-sm text-slate-600 hover:text-slate-900"
                    >
                      {Object.values(selectedNodes).every(v => v) ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
                  <div className="overflow-y-auto max-h-64 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-slate-50">
                    {Object.keys(nodeColors).map(node => (
                      <div
                        key={node}
                        className="flex items-center space-x-2 p-2 hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          checked={selectedNodes[node]}
                          onChange={() => {
                            setSelectedNodes(prev => ({
                              ...prev,
                              [node]: !prev[node]
                            }));
                          }}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: nodeColors[node] }}
                        />
                        <span className="text-sm text-slate-600 truncate">
                          {node.replace('node_', 'Node ')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
  
            {/* Time Period Selection */}
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
        </div>

        {/* Total Utilization and Capacity Checkboxes */}
        <div className="mb-4 flex items-center justify-end space-x-4">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={showTotalUtilization}
              onChange={() => setShowTotalUtilization(!showTotalUtilization)}
              className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
            />
            <span className="text-sm text-slate-600">Selected Nodes Total Utilization</span>
          </label>
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={showTotalCapacity}
              onChange={() => setShowTotalCapacity(!showTotalCapacity)}
              className="h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
            />
            <span className="text-sm text-slate-600">Selected Nodes Total Capacity</span>
          </label>
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
                  if (name === 'total_utilization') {
                    return [`${value?.toFixed(2)} GB`, 'Selected Nodes Total Utilization'];
                  }
                  if (name === 'total_capacity') {
                    return [`${value?.toFixed(2)} GB`, 'Selected Nodes Total Capacity'];
                  }
                  if (name.includes('_total')) {
                    return [`${value?.toFixed(2)} GB`, `${name.replace('_total', '')} Capacity`];
                  }
                  return [`${value?.toFixed(2)} GB`, name];
                }}
                labelFormatter={(label) => formatTimeLabel(label)}
              />

              {/* Individual node lines */}
              {Object.entries(nodeColors).map(([nodeKey, color]) => (
                selectedNodes[nodeKey] && (
                  <Line 
                    key={nodeKey}
                    type="monotone"
                    dataKey={nodeKey}
                    stroke={color}
                    name={nodeKey}
                    strokeWidth={1}
                    dot={false}
                    activeDot={{ r: 4, stroke: color, strokeWidth: 1, fill: 'white' }}
                  />
                )
              ))}

              {/* Total utilization line - now only for selected nodes */}
              {showTotalUtilization && (
                <Line
                  type="monotone"
                  dataKey="total_utilization"
                  stroke="#9333ea"
                  name="total_utilization"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  activeDot={{ r: 6, stroke: '#9333ea', strokeWidth: 2, fill: 'white' }}
                />
              )}

              {/* Total capacity line - now only for selected nodes */}
              {showTotalCapacity && (
                <Line
                  type="monotone"
                  dataKey="total_capacity"
                  stroke="#dc2626"
                  name="total_capacity"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  activeDot={{ r: 6, stroke: '#dc2626', strokeWidth: 2, fill: 'white' }}
                />
              )}
              
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