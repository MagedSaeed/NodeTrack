import React from 'react';

// CustomTooltip with cluster-wide active/inactive status
const CustomTooltip = ({ active, payload, label, nodeColors, selectedNodes, formatTimeLabel, showAsPercentage }) => {
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
    .map(([key, value]) => {
      // For percentage mode, calculate percentage values
      let displayValue = value;
      let percentValue = null;
      const capacityValue = pointData[`${key}_total`];
      
      if (capacityValue && capacityValue > 0) {
        percentValue = (value / capacityValue) * 100;
        if (showAsPercentage) {
          displayValue = percentValue; // Use percentage as the main value in percentage mode
        }
      }
      
      return {
        dataKey: key,
        value: displayValue,
        rawValue: value, // Keep original GB value
        percentValue, // Store percentage value
        capacityValue // Store capacity value
      };
    });
  
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

  // Calculate total utilization percentage if available
  let totalUtilizationPercentage = null;
  if (pointData.total_utilization !== undefined && 
      pointData.total_capacity !== undefined && 
      pointData.total_capacity > 0) {
    totalUtilizationPercentage = (pointData.total_utilization / pointData.total_capacity) * 100;
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
                    {showAsPercentage 
                      ? (item.percentValue !== null 
                          ? `${item.percentValue.toFixed(1)}%` 
                          : 'N/A')
                      : `${item.rawValue.toFixed(2)} GB`}
                  </span>

                  {/* Show percentage in parentheses if in GB mode, or GB in parentheses if in percentage mode */}
                  {item.percentValue !== null && !showAsPercentage && (
                    <span className="ml-1 text-slate-400 text-xs flex-shrink-0">
                      ({item.percentValue.toFixed(0)}%)
                    </span>
                  )}
                  {showAsPercentage && (
                    <span className="ml-1 text-slate-400 text-xs flex-shrink-0">
                      ({item.rawValue.toFixed(1)} GB)
                    </span>
                  )}
                  
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
              <div className="flex items-center">
                <span className="font-medium text-purple-600 px-2 py-0.5 bg-purple-50 rounded">
                  {showAsPercentage && totalUtilizationPercentage !== null
                    ? `${totalUtilizationPercentage.toFixed(1)}%`
                    : `${pointData.total_utilization.toFixed(2)} GB`}
                </span>
                
                {/* Show alternative format in smaller text */}
                {totalUtilizationPercentage !== null && (
                  <span className="ml-1 text-slate-400 text-xs">
                    {showAsPercentage
                      ? `(${pointData.total_utilization.toFixed(1)} GB)`
                      : `(${totalUtilizationPercentage.toFixed(0)}%)`}
                  </span>
                )}
              </div>
            </div>
          )}
          
          {/* Only show capacity in GB mode or as reference in percentage mode */}
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

export default CustomTooltip;