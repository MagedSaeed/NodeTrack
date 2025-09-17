import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Search } from 'lucide-react';
import { Resizable } from 'react-resizable';
import 'react-resizable/css/styles.css';

// DetailsPanel component for showing detailed node information
const DetailsPanel = ({ selectedPoint, nodeColors, onClose, setSelectedNodes, showAsPercentage }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectAll, setSelectAll] = useState(true);
  // Reduced initial size for a more compact look
  const [dimensions, setDimensions] = useState({ width: 550, height: 550 }); // Wider to accommodate percentage column
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
  
  // Calculate percentage for each node
  const nodesWithPercentage = useMemo(() => {
    return filteredNodes.map(node => {
      const capacity = selectedPoint.capacities?.[node.dataKey] || 0;
      let percentage = 0;
      if (capacity > 0) {
        percentage = (node.value / capacity) * 100;
      }
      return {
        ...node,
        percentage
      };
    });
  }, [filteredNodes, selectedPoint.capacities]);
  
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
    let sortableItems = [...nodesWithPercentage];
    
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
        } else if (sortConfig.key === 'percentage') {
          aValue = a.percentage;
          bValue = b.percentage;
        } else if (sortConfig.key === 'capacity') {
          aValue = selectedPoint.capacities[a.dataKey] || 0;
          bValue = selectedPoint.capacities[b.dataKey] || 0;
        } else if (sortConfig.key === 'active') {
          aValue = selectedPoint.activeStatus[a.dataKey] ? 1 : 0;
          bValue = selectedPoint.activeStatus[b.dataKey] ? 1 : 0;
        }
        
        // Handle numeric comparisons
        if (sortConfig.key === 'value' || sortConfig.key === 'percentage' || sortConfig.key === 'capacity' || sortConfig.key === 'active') {
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
  }, [nodesWithPercentage, sortConfig, selectedPoint.capacities, selectedPoint.activeStatus]);
  
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
  
  // Calculate total memory utilization percentage
  const totalUtilizationPercentage = useMemo(() => {
    if (selectedPoint.totalUtilization && selectedPoint.totalCapacity && selectedPoint.totalCapacity > 0) {
      return (selectedPoint.totalUtilization / selectedPoint.totalCapacity) * 100;
    }
    return 0;
  }, [selectedPoint.totalUtilization, selectedPoint.totalCapacity]);
  
  // Common divider component for consistency
  const Divider = () => (
    <div className="h-6 border-l border-slate-200 mx-3"></div>
  );
  
  return (
    <Resizable
      width={dimensions.width}
      height={dimensions.height}
      minConstraints={[550, 400]} // Wider minimum width
      maxConstraints={[800, 700]}
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
            <div className="w-4"></div>
            <button 
              onClick={() => requestSort('dataKey')}
              className={`flex items-center w-1/6 text-left hover:text-slate-800 ${sortConfig.key === 'dataKey' ? 'text-slate-800' : ''}`}
            >
              Node {getSortDirectionArrow('dataKey')}
            </button>
            
            <Divider />
            
            <button 
              onClick={() => requestSort('value')}
              className={`flex items-center w-1/6 text-right justify-end hover:text-slate-800 ${sortConfig.key === 'value' ? 'text-slate-800' : ''}`}
            >
              Usage {getSortDirectionArrow('value')}
            </button>
            
            <Divider />
            
            <button 
              onClick={() => requestSort('percentage')}
              className={`flex items-center w-1/6 text-right justify-end hover:text-slate-800 ${sortConfig.key === 'percentage' ? 'text-slate-800' : ''}`}
            >
              Usage % {getSortDirectionArrow('percentage')}
            </button>
            
            <Divider />
            
            <button 
              onClick={() => requestSort('capacity')}
              className={`flex items-center w-1/6 text-right justify-end hover:text-slate-800 ${sortConfig.key === 'capacity' ? 'text-slate-800' : ''}`}
            >
              Capacity {getSortDirectionArrow('capacity')}
            </button>
            
            <Divider />
            
            <button 
              onClick={() => requestSort('active')}
              className={`flex items-center w-1/6 text-center justify-center hover:text-slate-800 ${sortConfig.key === 'active' ? 'text-slate-800' : ''}`}
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
              const percentageValue = item.percentage;
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
                    className={`text-xs truncate ml-2 w-1/6 ${isActive ? 'text-slate-700 font-medium' : 'text-slate-400'}`}
                  >
                    {nodeName.replace('node_', '')}
                  </span>
                  
                  <Divider />
                  
                  {/* Utilization - smaller numbers with right padding */}
                  <span 
                    className={`text-xs font-medium w-1/6 text-right ${isActive ? 'text-purple-600' : 'text-purple-400'}`}
                  >
                    {item.value.toFixed(1)} GB
                  </span>
                  
                  <Divider />
                  
                  {/* Usage Percentage - new column with left padding */}
                  <span 
                    className={`text-xs font-medium w-1/6 text-right ${isActive ? 'text-blue-600' : 'text-blue-400'}`}
                  >
                    {percentageValue.toFixed(1)}%
                    
                    {/* Show a utilization indicator */}
                    <div className="w-full h-1 bg-slate-100 rounded-full mt-1 overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${
                          percentageValue > 90 ? 'bg-red-500' : 
                          percentageValue > 75 ? 'bg-yellow-500' : 'bg-blue-500'
                        }`}
                        style={{ width: `${Math.min(100, percentageValue)}%` }}
                      ></div>
                    </div>
                  </span>
                  
                  <Divider />
                  
                  {/* Capacity - smaller numbers */}
                  <span 
                    className={`text-xs font-medium w-1/6 text-right ${isActive ? 'text-red-600' : 'text-red-400'}`}
                  >
                    {capacityValue.toFixed(1)} GB
                  </span>
                  
                  <Divider />
                  
                  {/* Active status - smaller badges */}
                  <div className="w-1/6 flex justify-center">
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
          <div className="grid grid-cols-3 gap-3">
            {selectedPoint.totalUtilization !== undefined && (
              <div className="bg-white p-3 rounded shadow-sm border border-slate-100">
                <div className="text-xs text-slate-500 mb-0.5">Total Usage</div>
                <div className="text-base font-medium text-purple-600">
                  {selectedPoint.totalUtilization.toFixed(1)} GB
                </div>
              </div>
            )}
            
            {/* Add utilization percentage card */}
            {selectedPoint.totalUtilization !== undefined && selectedPoint.totalCapacity !== undefined && (
              <div className="bg-white p-3 rounded shadow-sm border border-slate-100">
                <div className="text-xs text-slate-500 mb-0.5">Usage Percentage</div>
                <div className="text-base font-medium text-blue-600">
                  {totalUtilizationPercentage.toFixed(1)}%
                </div>
                {/* Add a progress bar for visualization */}
                <div className="w-full h-1.5 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
                  <div 
                    className={`h-full rounded-full ${
                      totalUtilizationPercentage > 90 ? 'bg-red-500' : 
                      totalUtilizationPercentage > 75 ? 'bg-yellow-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${Math.min(100, totalUtilizationPercentage)}%` }}
                  ></div>
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

export default DetailsPanel;