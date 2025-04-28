// In TimeSeriesUtilizationCard.jsx

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card } from '../../../../shared_ui/Card';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Brush 
} from 'recharts';
import { Database, ChevronDown, Search } from 'lucide-react';
import _ from 'lodash';

// Import components
import CustomTooltip from './CustomTooltip';
import DetailsPanel from './DetailsPanel';

// Import utilities
import { 
  TIME_PERIODS, 
  generateDistinctColors, 
  formatTimeLabel as formatTimeLabelUtil, 
  processTimeSeriesData,
  createDetailPointData
} from './utils';

// Main component for time series utilization visualization
const TimeSeriesUtilizationCard = ({ data }) => {
  const [selectedPeriod, setSelectedPeriod] = useState(TIME_PERIODS.HOUR);
  const [filteredData, setFilteredData] = useState([]);
  const [isNodeDropdownOpen, setIsNodeDropdownOpen] = useState(false);
  const [selectedNodes, setSelectedNodes] = useState({});
  // Set both checkboxes to false by default
  const [showTotalUtilization, setShowTotalUtilization] = useState(false);
  const [showTotalCapacity, setShowTotalCapacity] = useState(false);
  const [showAsPercentage, setShowAsPercentage] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // State for detailed view
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState(null);
  
  const [visibleDataRange, setVisibleDataRange] = useState(null);
  
  const chartRef = useRef(null);

  // Format time label with the current period
  const formatTimeLabel = (timestamp) => formatTimeLabelUtil(timestamp, selectedPeriod.value);

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

  // Process and filter data when dependencies change
  useEffect(() => {
    const processedData = processTimeSeriesData(data, selectedPeriod, selectedNodes);
    setFilteredData(processedData);
    
    // Reset details view when data changes
    setDetailsVisible(false);
    setSelectedPoint(null);
    
  }, [selectedPeriod, data, selectedNodes]);

  // Simple brush change handler
  const handleBrushChange = (brushArea) => {
    if (brushArea && brushArea.startIndex !== undefined && brushArea.endIndex !== undefined) {
      setVisibleDataRange({
        startIndex: brushArea.startIndex,
        endIndex: brushArea.endIndex
      });
    }
  };

  // Dynamic interval calculation for X-axis based on visible range
  const calculateXAxisInterval = (data) => {
    if (!data || !data.length) return 'preserveStartEnd';
    
    // Determine how many points are visible
    const visibleCount = visibleDataRange
      ? visibleDataRange.endIndex - visibleDataRange.startIndex + 1
      : data.length;
    
    // For very small ranges (like when using the brush), show every tick
    if (visibleCount <= 20) return 0;
    
    // Adjust interval based on visible count for larger ranges
    if (visibleCount <= 30) return 1; // Show every other tick
    if (visibleCount <= 60) return 2; // Show every third tick
    if (visibleCount <= 100) return 4; // Show every fifth tick
    
    // For very large datasets, dynamically calculate to show ~12-15 ticks
    return Math.max(1, Math.floor(visibleCount / 15));
  };

  // Close details panel
  const handleCloseDetails = () => {
    setDetailsVisible(false);
    setSelectedPoint(null);
  };
  
  // Create a key for the LineChart that changes when checkbox states change
  // This will force the chart to re-render with animation when checkboxes are toggled
  const chartKey = useMemo(() => 
    `chart-${showTotalUtilization}-${showTotalCapacity}-${showAsPercentage}`, 
    [showTotalUtilization, showTotalCapacity, showAsPercentage]
  );

  // Handle outside click for dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isNodeDropdownOpen && !event.target.closest('.node-dropdown-container')) {
        setIsNodeDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isNodeDropdownOpen]);

  return (
    <Card className="bg-white shadow-md rounded-lg border border-slate-100 relative">
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
            {/* Node Selection Dropdown */}
            <div className="relative node-dropdown-container">
              <button
                onClick={() => setIsNodeDropdownOpen(!isNodeDropdownOpen)}
                className="px-4 py-2 text-sm bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 flex items-center space-x-2"
              >
                <span>Select Nodes</span>
                <ChevronDown className="h-4 w-4" />
              </button>
              
              {isNodeDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-lg shadow-lg z-40">
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
                  
                  {/* Search Input */}
                  <div className="p-2 border-b border-slate-200">
                    <input
                      type="text"
                      placeholder="Search nodes..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
  
                  <div className="overflow-y-auto max-h-64 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-slate-50">
                    {Object.keys(nodeColors)
                      .sort((a, b) => a.localeCompare(b))
                      .filter(node => {
                        const normalizedSearch = searchQuery.toLowerCase();
                        const normalizedNode = node.toLowerCase();
                        return _.deburr(normalizedNode).includes(_.deburr(normalizedSearch));
                      })
                      .map(node => (
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

        {/* Control Panel: Display Options */}
        <div className="mb-4 flex items-center justify-end space-x-4">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={showTotalUtilization}
              onChange={() => {
                setShowTotalUtilization(!showTotalUtilization);
                // Force re-render of all lines by changing chartKey
              }}
              className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
            />
            <span className="text-sm text-slate-600">Selected Nodes Total Utilization</span>
          </label>
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={showTotalCapacity}
              onChange={() => {
                setShowTotalCapacity(!showTotalCapacity);
                // Force re-render of all lines by changing chartKey
              }}
              className="h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
            />
            <span className="text-sm text-slate-600">Selected Nodes Total Capacity</span>
          </label>
          <div className="h-6 border-l border-slate-200 mx-2"></div>
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={showAsPercentage}
              onChange={() => {
                setShowAsPercentage(!showAsPercentage);
                // Force re-render of all lines by changing chartKey
              }}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-slate-600">Show as Percentage</span>
          </label>
        </div>

        {/* Chart Container */}
        <div className="h-96 relative" ref={chartRef}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart 
                key={chartKey}
                data={filteredData}
                margin={{ top: 10, right: 25, left: 25, bottom: 90 }} // Increased right margin
                onClick={(data) => {
                  // Ensure we have valid click data with an active payload
                  if (data && data.activePayload && data.activePayload.length > 0) {
                    // Get the timestamp from the clicked point
                    const pointData = data.activePayload[0].payload;
                    const detailPoint = createDetailPointData(
                      pointData, 
                      selectedNodes, 
                      formatTimeLabel
                    );
                    
                    setSelectedPoint(detailPoint);
                    setDetailsVisible(true);
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis 
                  dataKey="timestamp"
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  interval={(data) => calculateXAxisInterval(data)}
                  tickFormatter={(value) => {
                    // When zoomed in with the brush, show more detailed time format
                    if (visibleDataRange && 
                        (visibleDataRange.endIndex - visibleDataRange.startIndex) <= 20) {
                      const date = new Date(value);
                      return `${date.getHours().toString().padStart(2, '0')}:00 ${date.getDate()}/${date.getMonth()+1}`;
                    }
                    // Otherwise use the standard formatter
                    return formatTimeLabel(value);
                  }}
                  height={70} // Increased height for better label visibility
                  padding={{ left: 10, right: 10 }} // Increased padding on both sides
                />
                <YAxis 
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  tickCount={10}
                  domain={[0, showAsPercentage ? 100 : 'auto']}
                  tickFormatter={(value) => showAsPercentage ? `${value}%` : value}
                  label={{ 
                    value: showAsPercentage ? 'Memory Utilization (%)' : 'Node Memory Usage (GB)',
                    angle: -90,
                    position: 'insideLeft',
                    style: { fill: '#64748b', fontSize: '14px', textAnchor: 'middle' },
                    offset: -20
                  }}
                  width={55}
                />
                
                {/* Custom tooltip */}
                <Tooltip 
                  content={
                    <CustomTooltip 
                      nodeColors={nodeColors} 
                      selectedNodes={selectedNodes}
                      formatTimeLabel={formatTimeLabel}
                      showAsPercentage={showAsPercentage}
                    />
                  }
                  wrapperStyle={{ zIndex: 30, pointerEvents: 'none' }}
                  cursor={{ 
                    stroke: '#6366f1', 
                    strokeWidth: 1.5,
                    strokeDasharray: '5 5'
                  }}
                  isAnimationActive={false}
                />
    
                {/* Individual node lines with animation */}
                {Object.entries(nodeColors).map(([nodeKey, color]) => {
                  // Only render if node is selected
                  if (!selectedNodes[nodeKey]) return null;
                  
                  // For percentage mode, we need to calculate values on the fly
                  if (showAsPercentage) {
                    return (
                      <Line 
                        key={nodeKey}
                        type="monotone"
                        // Use a function to calculate percentage on the fly
                        dataKey={(dataPoint) => {
                          const usage = dataPoint[nodeKey];
                          const capacity = dataPoint[`${nodeKey}_total`];
                          // Calculate percentage if both values exist
                          if (usage !== undefined && capacity !== undefined && capacity > 0) {
                            return (usage / capacity) * 100;
                          }
                          return 0; // Default to 0 if we can't calculate
                        }}
                        stroke={color}
                        name={nodeKey}
                        strokeWidth={1}
                        dot={false}
                        activeDot={{ 
                          r: 4, 
                          stroke: color, 
                          strokeWidth: 1, 
                          fill: 'white'
                        }}
                        isAnimationActive={true}
                        animationDuration={1500}
                        animationEasing="ease-in-out"
                      />
                    );
                  }
                  
                  // For absolute values (GB)
                  return (
                    <Line 
                      key={nodeKey}
                      type="monotone"
                      dataKey={nodeKey}
                      stroke={color}
                      name={nodeKey}
                      strokeWidth={1}
                      dot={false}
                      activeDot={{ 
                        r: 4, 
                        stroke: color, 
                        strokeWidth: 1, 
                        fill: 'white'
                      }}
                      isAnimationActive={true}
                      animationDuration={1500}
                      animationEasing="ease-in-out"
                    />
                  );
                })}
    
                {/* Total utilization line - now only for selected nodes */}
                {showTotalUtilization && (
                  <Line
                    type="monotone"
                    dataKey={showAsPercentage ? 
                      // For percentage mode, calculate on the fly
                      (dataPoint) => {
                        const usage = dataPoint.total_utilization;
                        const capacity = dataPoint.total_capacity;
                        // Calculate percentage if both values exist
                        if (usage !== undefined && capacity !== undefined && capacity > 0) {
                          return (usage / capacity) * 100;
                        }
                        return 0; // Default to 0 if we can't calculate
                      } : 
                      // For absolute mode, use the raw value
                      "total_utilization"
                    }
                    stroke="#9333ea"
                    name="total_utilization"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    activeDot={{ 
                      r: 6, 
                      stroke: '#9333ea', 
                      strokeWidth: 2, 
                      fill: 'white'
                    }}
                    isAnimationActive={true}
                    animationDuration={1500}
                    animationEasing="ease-in-out"
                  />
                )}
    
                {/* Total capacity line - only show in absolute mode, not in percentage mode */}
                {showTotalCapacity && !showAsPercentage && (
                  <Line
                    type="monotone"
                    dataKey="total_capacity"
                    stroke="#dc2626"
                    name="total_capacity"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    activeDot={{ 
                      r: 6, 
                      stroke: '#dc2626', 
                      strokeWidth: 2, 
                      fill: 'white'
                    }}
                    isAnimationActive={true}
                    animationDuration={1500}
                    animationEasing="ease-in-out"
                  />
                )}
                
                {/* In percentage mode, add a 100% reference line */}
                {showAsPercentage && (
                  <Line
                    type="monotone"
                    dataKey={() => 100} // Constant 100% line
                    stroke="#dc2626"
                    name="max_capacity"
                    strokeWidth={1.5}
                    strokeDasharray="2 2"
                    dot={false}
                    isAnimationActive={false}
                  />
                )}
                
                {/* Fixed Brush Component with reduced width */}
                <Brush 
                  dataKey="timestamp"
                  height={20} 
                  stroke="#94a3b8"
                  fill="#f8fafc"
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    return `${date.getMonth()+1}/${date.getDate()}`;
                  }}
                  y={325}
                  travellerWidth={10}
                  padding={{ top: 5, bottom: 5 }}
                  tickGap={10}
                  onChange={handleBrushChange}
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  alwaysShowText={true}
                  // Reduce width to show right label
                  width="80%"
                  // Styling
                  strokeOpacity={0.8}
                  fillOpacity={0.2}
                  traveller={{
                    fill: '#f1f5f9',
                    stroke: '#64748b',
                    strokeWidth: 1.5,
                    width: 12,
                    height: 20,
                    r: 2
                  }}
                />
              </LineChart>
          </ResponsiveContainer>
          
          {/* Render the details panel */}
                          {detailsVisible && selectedPoint && (
            <DetailsPanel 
              selectedPoint={selectedPoint}
              nodeColors={nodeColors}
              onClose={handleCloseDetails}
              setSelectedNodes={setSelectedNodes}
              showAsPercentage={showAsPercentage}
            />
          )}
        </div>

        {/* Instructions text for brush usage */}
        <div className="text-xs text-slate-500 text-center">
          Drag the handles to adjust the visible time range
        </div>

        {/* {data.date_range && (
          <div className="mt-4 text-sm text-slate-500 text-center">
            Data Range: {data.date_range.start} - {data.date_range.end}
          </div>
        )} */}
      </div>
    </Card>
  );
};

export default TimeSeriesUtilizationCard;