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
  const [showTotalUtilization, setShowTotalUtilization] = useState(true);
  const [showTotalCapacity, setShowTotalCapacity] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // State for detailed view
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState(null);
  
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

  // Close details panel
  const handleCloseDetails = () => {
    setDetailsVisible(false);
    setSelectedPoint(null);
  };

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
            {/* Modified Node Selection Dropdown */}
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

        {/* Chart Container */}
        <div className="h-96 relative" ref={chartRef}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart 
                data={filteredData}
                margin={{ top: 10, right: 50, left: 60, bottom: 100 }}
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
                
                {/* Custom tooltip */}
                <Tooltip 
                  content={
                    <CustomTooltip 
                      nodeColors={nodeColors} 
                      selectedNodes={selectedNodes}
                      formatTimeLabel={formatTimeLabel}
                    />
                  }
                  wrapperStyle={{ zIndex: 30, pointerEvents: 'none' }}
                  cursor={{ 
                    stroke: '#6366f1', 
                    strokeWidth: 1.5,
                    strokeDasharray: '5 5'
                  }}
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
                      activeDot={{ 
                        r: 4, 
                        stroke: color, 
                        strokeWidth: 1, 
                        fill: 'white'
                      }}
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
                    activeDot={{ 
                      r: 6, 
                      stroke: '#9333ea', 
                      strokeWidth: 2, 
                      fill: 'white'
                    }}
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
                    activeDot={{ 
                      r: 6, 
                      stroke: '#dc2626', 
                      strokeWidth: 2, 
                      fill: 'white'
                    }}
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
            />
          )}
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