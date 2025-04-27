import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card } from '../../../shared_ui/Card';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Brush 
} from 'recharts';
import { Database, ChevronDown, X, Search } from 'lucide-react';
import _ from 'lodash';
import { Resizable } from 'react-resizable';
import 'react-resizable/css/styles.css';

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
  
  // Store the complete ISO string to avoid parsing errors later
  const fullIsoString = d.toISOString();
  
  switch (period) {
    case 'hour':
      // Return the full ISO string to ensure proper date parsing
      return fullIsoString;
    case 'day':
      const dayStart = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0));
      return dayStart.toISOString();
    case 'week':
      const weekStart = new Date(d);
      weekStart.setUTCDate(d.getUTCDate() - d.getUTCDay());
      weekStart.setUTCHours(0, 0, 0, 0);
      return weekStart.toISOString();
    case 'month':
      const monthStart = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0));
      return monthStart.toISOString();
    default:
      return fullIsoString;
  }
};
// Fixed CustomTooltip with proper isActive parameter calculation and consistent styling
// CustomTooltip with cluster-wide active/inactive status
const CustomTooltip = ({ active, payload, label, nodeColors, selectedNodes, formatTimeLabel }) => {
  if (!active || !payload || !payload.length) return null;
  const topNodesCount = 3;
  
  // Direct access to the data object like the details panel does
  const pointData = payload[0].payload;
  
  // Collect nodes exactly like the details panel
  const nodesWithValues = Object.entries(pointData)
    .filter(([key, value]) => 
      !key.includes('_total') && 
      !key.includes('_is_active') &&
      key !== 'timestamp' && 
      key !== 'total_utilization' && 
      key !== 'total_capacity' &&
      selectedNodes[key]
    )
    .map(([key, value]) => ({
      dataKey: key,
      value
    }));
  
  // Collect active status exactly like the details panel
  const activeStatus = {};
  Object.entries(pointData)
    .filter(([key]) => key.includes('_is_active'))
    .forEach(([key, value]) => {
      const nodeName = key.replace('_is_active', '');
      activeStatus[nodeName] = value;
    });
  
  // Sort and take top topNodesCount
  const topNodes = [...nodesWithValues]
    .sort((a, b) => b.value - a.value)
    .slice(0, topNodesCount);
  
  // Count active nodes for top 5
  const activeTopCount = topNodes.filter(item => 
    activeStatus[item.dataKey] === true
  ).length;
  
  // Calculate cluster-wide status for all nodes
  const totalNodeCount = nodesWithValues.length;
  const activeNodeCount = nodesWithValues.filter(item => 
    activeStatus[item.dataKey] === true
  ).length;
  const inactiveNodeCount = totalNodeCount - activeNodeCount;
  
  // Calculate percentage active
  const activePercentage = totalNodeCount > 0 
    ? Math.round((activeNodeCount / totalNodeCount) * 100) 
    : 0;
  
  // Determine status level based on percentage active
  let statusColor = 'text-green-500';
  let statusBg = 'bg-green-50';
  if (activePercentage < 50) {
    statusColor = 'text-red-500';
    statusBg = 'bg-red-50';
  } else if (activePercentage < 80) {
    statusColor = 'text-yellow-500';
    statusBg = 'bg-yellow-50';
  }
  
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-4 max-w-xs pointer-events-none">
      <div className="mb-2">
        <h3 className="font-medium text-slate-700 text-base">{formatTimeLabel(label)}</h3>
        <div className="text-xs text-slate-500 mt-1">Click point to see details</div>
      </div>
      
      {/* Cluster-wide status indicator */}
      <div className={`mb-3 px-3 py-2 rounded-md ${statusBg} border border-slate-200`}>
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs font-medium text-slate-600">Cluster Status:</span>
          <span className={`text-xs font-medium ${statusColor}`}>
            {activePercentage}% Active
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center">
            <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
            <span className="text-slate-600">{activeNodeCount} active</span>
          </div>
          <div className="flex items-center">
            <div className="w-2 h-2 bg-slate-400 rounded-full mr-1"></div>
            <span className="text-slate-600">{inactiveNodeCount} inactive</span>
          </div>
        </div>
        
        {/* Progress bar showing active percentage */}
        <div className="mt-2 h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full ${
              activePercentage < 50 ? 'bg-red-500' : 
              activePercentage < 80 ? 'bg-yellow-500' : 'bg-green-500'
            }`}
            style={{ width: `${activePercentage}%` }}
          ></div>
        </div>
      </div>
      
      {/* Show top 5 most utilized nodes in tooltip */}
      {topNodes.length > 0 && (
        <div className="text-xs text-slate-600">
          <div className="flex justify-between items-center mb-2">
            <div className="text-xs font-medium text-slate-500">Top Utilized Nodes:</div>
            
            {/* Add active status summary for top nodes */}
            <div className="flex items-center">
              <span className={`text-xs ${activeTopCount === 0 ? 'text-red-500 font-medium' : 'text-slate-500'}`}>
                {activeTopCount === 0 ? 'All inactive!' : `${activeTopCount}/${topNodes.length} active`}
              </span>
            </div>
          </div>
          
          <div className="space-y-1.5">
            {topNodes.map((item, index) => {
              const nodeName = item.dataKey;
              // Use the EXACT same logic as the details panel
              const isActive = activeStatus[nodeName] === true;
              
              return (
                <div key={index} className="flex items-center py-1">
                  {/* Node color indicator - using same styling as details panel */}
                  <div 
                    className="w-3 h-3 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ 
                      backgroundColor: isActive ? nodeColors[nodeName] : '#94a3b8',
                      opacity: isActive ? 0.9 : 0.7,
                      boxShadow: isActive ? 'none' : 'inset 0 0 0 1px ' + nodeColors[nodeName]
                    }}
                  >
                    {!isActive && <div className="w-1 h-1 bg-white rounded-full"></div>}
                  </div>
                  
                  {/* Node name - gray for inactive */}
                  <span className={`truncate ml-2 mr-1.5 flex-1 ${isActive ? 'text-slate-600' : 'text-slate-400'}`}>
                    {nodeName.replace('node_', 'Node ')}
                  </span>
                  
                  {/* Memory value - dimmed for inactive */}
                  <span className={`font-medium flex-shrink-0 ${isActive ? 'text-purple-600' : 'text-purple-400'}`}>
                    {item.value.toFixed(2)} GB
                  </span>
                  
                  {/* Small inactive label */}
                  {!isActive && (
                    <span className="ml-1 text-slate-400 text-xs flex-shrink-0">
                      (off)
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          
          {nodesWithValues.length > topNodesCount && (
            <div className="text-slate-500 mt-2 text-center text-xs">
              +{nodesWithValues.length - topNodesCount} more nodes
            </div>
          )}
        </div>
      )}
      
      {/* Total values with improved styling */}
      {(pointData.total_utilization !== undefined || pointData.total_capacity !== undefined) && (
        <div className="mt-3 pt-3 border-t border-slate-100 text-xs space-y-2">
          {pointData.total_utilization !== undefined && (
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Total Utilization:</span>
              <span className="font-medium text-purple-600 px-2 py-0.5 bg-purple-50 rounded">
                {pointData.total_utilization.toFixed(2)} GB
              </span>
            </div>
          )}
          {pointData.total_capacity !== undefined && (
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Total Capacity:</span>
              <span className="font-medium text-red-600 px-2 py-0.5 bg-red-50 rounded">
                {pointData.total_capacity.toFixed(2)} GB
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Update the DetailsPanel component to show the active status with improved layout
const DetailsPanel = ({ selectedPoint, nodeColors, onClose, setSelectedNodes }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectAll, setSelectAll] = useState(true);
  // Reduced initial size for a more compact look
  const [dimensions, setDimensions] = useState({ width: 480, height: 550 });
  const panelRef = useRef(null);
  // Set default sorting to active status first, then by usage (highest to lowest)
  const [sortConfig, setSortConfig] = useState({ key: 'default', direction: 'descending' });
  
  // Initialize panel position to center of viewport on mount
  useEffect(() => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Calculate position to center the panel
    const left = (viewportWidth - dimensions.width) / 2;
    const top = (viewportHeight - dimensions.height) / 2;
    
    // Apply position directly to the panel element
    if (panelRef.current) {
      panelRef.current.style.left = `${left}px`;
      panelRef.current.style.top = `${top}px`;
    }
  }, [dimensions]);
  
  // Filter nodes based on search query
  const filteredNodes = selectedPoint.nodes.filter(item => {
    const nodeName = item.dataKey.toLowerCase();
    return nodeName.includes(searchQuery.toLowerCase());
  });
  
  // Sorting logic
  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };
  
  // Apply sorting to filtered nodes
  const sortedNodes = useMemo(() => {
    let sortableItems = [...filteredNodes];
    
    if (sortConfig.key && sortConfig.direction) {
      sortableItems.sort((a, b) => {
        let aValue, bValue;
        
        // Default sorting: active status first, then by usage (value)
        if (sortConfig.key === 'default') {
          // First compare active status
          const aActive = selectedPoint.activeStatus[a.dataKey] ? 1 : 0;
          const bActive = selectedPoint.activeStatus[b.dataKey] ? 1 : 0;
          
          // If active status is different, sort by that
          if (aActive !== bActive) {
            return sortConfig.direction === 'descending' ? bActive - aActive : aActive - bActive;
          }
          
          // If both have same active status, sort by value (usage)
          return sortConfig.direction === 'descending' ? b.value - a.value : a.value - b.value;
        }
        else if (sortConfig.key === 'dataKey') {
          aValue = a.dataKey.toLowerCase();
          bValue = b.dataKey.toLowerCase();
        } else if (sortConfig.key === 'value') {
          aValue = a.value;
          bValue = b.value;
        } else if (sortConfig.key === 'capacity') {
          aValue = selectedPoint.capacities[a.dataKey] || 0;
          bValue = selectedPoint.capacities[b.dataKey] || 0;
        } else if (sortConfig.key === 'active') {
          aValue = selectedPoint.activeStatus[a.dataKey] ? 1 : 0;
          bValue = selectedPoint.activeStatus[b.dataKey] ? 1 : 0;
        }
        
        // Handle numeric comparisons
        if (sortConfig.key === 'value' || sortConfig.key === 'capacity' || sortConfig.key === 'active') {
          return sortConfig.direction === 'ascending' ? aValue - bValue : bValue - aValue;
        }
        
        // Handle string comparisons
        if (aValue < bValue) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [filteredNodes, sortConfig, selectedPoint.capacities, selectedPoint.activeStatus]);
  
  // Handle select/deselect all
  const handleSelectAll = () => {
    const newValue = !selectAll;
    setSelectAll(newValue);
    
    // Update selectedNodes for all filtered nodes
    const updatedNodes = {};
    filteredNodes.forEach(item => {
      updatedNodes[item.dataKey] = newValue;
    });
    
    setSelectedNodes(prev => ({
      ...prev,
      ...updatedNodes
    }));
  };
  
  // Handle individual node selection
  const handleNodeSelection = (nodeName, isSelected) => {
    setSelectedNodes(prev => ({
      ...prev,
      [nodeName]: isSelected
    }));
  };
  
  // Handle resize
  const onResize = (event, { size }) => {
    setDimensions({
      width: size.width,
      height: size.height
    });
  };
  
  // Render sort indicator arrow with active highlight for current sort
  const getSortDirectionArrow = (key) => {
    // Don't show active highlight for default sorting
    if (sortConfig.key === 'default') {
      return <span className="text-slate-300 ml-1">↕</span>;
    }
    
    if (sortConfig.key !== key) {
      return <span className="text-slate-300 ml-1">↕</span>;
    }
    
    // When this column is the active sort, show the direction arrow in blue
    return sortConfig.direction === 'ascending' ? 
      <span className="text-blue-500 ml-1">↑</span> : 
      <span className="text-blue-500 ml-1">↓</span>;
  };
  
  return (
    <Resizable
      width={dimensions.width}
      height={dimensions.height}
      minConstraints={[380, 400]}
      maxConstraints={[700, 700]}
      onResize={onResize}
      handle={<div className="react-resizable-handle react-resizable-handle-se cursor-se-resize" />}
    >
      <div
        ref={panelRef}
        className="bg-white z-40 flex flex-col rounded-md shadow-lg border border-slate-200 select-none"
        style={{
          width: `${dimensions.width}px`,
          height: `${dimensions.height}px`,
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -5px rgba(0, 0, 0, 0.06)',
          position: 'fixed',
          overflow: 'hidden'
        }}
      >
        {/* Header - Reduced padding and font size */}
        <div className="py-3 px-4 border-b border-slate-200 flex justify-between items-center bg-blue-50">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
            <h3 className="font-medium text-base text-slate-700">
              Node Details for {selectedPoint.formattedLabel}
            </h3>
          </div>
          <div className="flex items-center">
            {/* <div className="text-xs text-slate-400 mr-3">Resize ↘</div> */}
            <button 
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-full"
            >
              <X size={16} />
            </button>
          </div>
        </div>
        
        {/* Search - More compact */}
        <div className="p-3 border-b border-slate-200 bg-white">
          <div className="flex items-center space-x-2 bg-slate-50 rounded-md px-3 py-1.5">
            <Search size={14} className="text-slate-400" />
            <input
              type="text"
              placeholder="Search nodes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent border-none text-xs focus:outline-none"
            />
          </div>
        </div>
        
        {/* Table - More compact with smaller text and modified margins */}
        <div className="flex-1 overflow-y-auto px-3 py-2">
          {/* Table Header - Smaller text and reduced padding */}
          <div className="flex items-center p-2 border-b border-slate-100 mb-2 font-medium text-xs text-slate-500">
            <div className="w-6"></div>
            <button 
              onClick={() => requestSort('dataKey')}
              className={`flex items-center w-2/5 text-left hover:text-slate-800 ${sortConfig.key === 'dataKey' ? 'text-slate-800' : ''}`}
            >
              Node {getSortDirectionArrow('dataKey')}
            </button>
            <button 
              onClick={() => requestSort('value')}
              className={`flex items-center w-1/5 text-right justify-end hover:text-slate-800 ${sortConfig.key === 'value' ? 'text-slate-800' : ''}`}
            >
              Usage {getSortDirectionArrow('value')}
            </button>
            <button 
              onClick={() => requestSort('capacity')}
              className={`flex items-center w-1/5 text-right justify-end hover:text-slate-800 ${sortConfig.key === 'capacity' ? 'text-slate-800' : ''}`}
            >
              Capacity {getSortDirectionArrow('capacity')}
            </button>
            <button 
              onClick={() => requestSort('active')}
              className={`flex items-center w-1/5 text-center justify-center hover:text-slate-800 ${sortConfig.key === 'active' ? 'text-slate-800' : ''}`}
            >
              Status {getSortDirectionArrow('active')}
            </button>
          </div>
          
          {/* Sort indicator to show default sorting is active */}
          {sortConfig.key === 'default' && (
            <div className="text-xs text-slate-400 italic px-2 pb-2">
              Sorted by: Active status, then by usage
            </div>
          )}
          
          {sortedNodes.length === 0 && (
            <div className="text-center p-4 text-xs text-slate-500">
              No nodes match your search query
            </div>
          )}

          <div className="space-y-1">
            {sortedNodes.map((item, index) => {
              const nodeName = item.dataKey;
              const capacityValue = selectedPoint.capacities?.[nodeName] || 0;
              const isActive = selectedPoint.activeStatus?.[nodeName] ?? true;
              
              return (
                <div 
                  key={index}
                  className={`flex items-center py-1.5 px-2 hover:bg-slate-50 rounded transition-colors ${!isActive ? 'bg-slate-50' : ''}`}
                >
                  {/* Node color indicator - compact size */}
                  <div 
                    className="w-4 h-4 rounded-full flex items-center justify-center"
                    style={{ 
                      backgroundColor: isActive ? nodeColors[nodeName] : '#94a3b8',
                      opacity: isActive ? 0.9 : 0.7,
                      boxShadow: isActive ? 'none' : 'inset 0 0 0 1px ' + nodeColors[nodeName]
                    }}
                  >
                    {!isActive && (
                      <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                    )}
                  </div>

                  {/* Node name - smaller text */}
                  <span 
                    className={`text-xs truncate ml-2 w-2/5 ${isActive ? 'text-slate-700 font-medium' : 'text-slate-400'}`}
                  >
                    {nodeName.replace('node_', 'Node ')}
                  </span>
                  
                  {/* Utilization - smaller numbers */}
                  <span 
                    className={`text-xs font-medium w-1/5 text-right ${isActive ? 'text-purple-600' : 'text-purple-400'}`}
                  >
                    {item.value.toFixed(1)} GB
                  </span>
                  
                  {/* Capacity - smaller numbers */}
                  <span 
                    className={`text-xs font-medium w-1/5 text-right ${isActive ? 'text-red-600' : 'text-red-400'}`}
                  >
                    {capacityValue.toFixed(1)} GB
                  </span>
                  
                  {/* Active status - smaller badges */}
                  <div className="w-1/5 flex justify-center">
                    {isActive ? (
                      <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded">
                        Active
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 bg-slate-200 text-slate-600 text-xs font-medium rounded">
                        Off
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Summary footer - More compact */}
        <div className="p-3 border-t border-slate-200 bg-slate-50">
          <div className="grid grid-cols-2 gap-3">
            {selectedPoint.totalUtilization !== undefined && (
              <div className="bg-white p-3 rounded shadow-sm border border-slate-100">
                <div className="text-xs text-slate-500 mb-0.5">Total Usage</div>
                <div className="text-base font-medium text-purple-600">
                  {selectedPoint.totalUtilization.toFixed(1)} GB
                </div>
              </div>
            )}
            
            {selectedPoint.totalCapacity !== undefined && (
              <div className="bg-white p-3 rounded shadow-sm border border-slate-100">
                <div className="text-xs text-slate-500 mb-0.5">Total Capacity</div>
                <div className="text-base font-medium text-red-600">
                  {selectedPoint.totalCapacity.toFixed(1)} GB
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Resizable>
  );
};

// Update the TimeSeriesUtilizationCard component to handle the is_active flag
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
              total: [],
              active: []
            };
          }
          nodeData[nodeName][periodKey].used.push(point.memory_used);
          nodeData[nodeName][periodKey].total.push(point.memory_total);
          // Store the is_active status from the API response
          nodeData[nodeName][periodKey].active.push(point.is_active !== undefined ? point.is_active : true);
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
        const values = periodData[timestamp] || { used: [], total: [], active: [] };
        if (values.used.length > 0) {
          const usedValue = _.mean(values.used);
          const totalValue = _.mean(values.total);
          const isActive = values.active.length > 0 ? values.active[values.active.length - 1] : true;
          
          dataPoint[nodeName] = usedValue;
          dataPoint[`${nodeName}_total`] = totalValue;
          dataPoint[`${nodeName}_is_active`] = isActive;

          // Only add to totals if node is selected
          if (selectedNodes[nodeName]) {
            selectedUtilization += usedValue;
            // selectedCapacity += totalValue;
            selectedCapacity = data.summary.total_capacity_gb; // Use the total capacity from the API response
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
    
    // Reset details view when data changes
    setDetailsVisible(false);
    setSelectedPoint(null);
  }, [selectedPeriod, data?.time_series?.nodes_timeseries, selectedNodes]);

  const formatTimeLabel = (timestamp) => {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) {
      return timestamp;
    }
  
    switch (selectedPeriod.value) {
      case 'hour':
        // Option 1: Use browser's local timezone (for Riyadh/KSA users)
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const hours = date.getHours().toString().padStart(2, '0');
        
        return `${year}-${month}-${day}T${hours}`;
        
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

  // Close details panel
  const handleCloseDetails = () => {
    setDetailsVisible(false);
    setSelectedPoint(null);
  };

  // Handle outside click
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
                    
                    // Create the data structure for the details panel
                    const nodesWithValues = Object.entries(pointData)
                      .filter(([key, value]) => 
                        !key.includes('_total') && 
                        !key.includes('_is_active') &&
                        key !== 'timestamp' && 
                        key !== 'total_utilization' && 
                        key !== 'total_capacity' &&
                        selectedNodes[key]
                      )
                      .map(([key, value]) => ({
                        dataKey: key,
                        value
                      }));
                    
                    // Collect capacity values for each node
                    const capacities = {};
                    Object.entries(pointData)
                      .filter(([key, value]) => 
                        key.includes('_total') && 
                        selectedNodes[key.replace('_total', '')]
                      )
                      .forEach(([key, value]) => {
                        const nodeName = key.replace('_total', '');
                        capacities[nodeName] = value;
                      });
                    
                    // Collect active status for each node
                    const activeStatus = {};
                    Object.entries(pointData)
                      .filter(([key]) => 
                        key.includes('_is_active')
                      )
                      .forEach(([key, value]) => {
                        const nodeName = key.replace('_is_active', '');
                        activeStatus[nodeName] = value;
                      });
                    
                    setSelectedPoint({
                      label: pointData.timestamp,
                      formattedLabel: formatTimeLabel(pointData.timestamp),
                      nodes: nodesWithValues,
                      capacities: capacities,
                      activeStatus: activeStatus,
                      totalUtilization: pointData.total_utilization,
                      totalCapacity: pointData.total_capacity
                    });
                    
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