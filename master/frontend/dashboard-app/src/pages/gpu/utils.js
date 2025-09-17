// Time period options for the chart
export const TIME_PERIODS = {
  HOUR: { label: 'Hourly', value: 'hour', days: 7 },
  DAY: { label: 'Daily', value: 'day', days: 30 },
  WEEK: { label: 'Weekly', value: 'week', days: 90 },
  MONTH: { label: 'Monthly', value: 'month', days: 365 }
};

export const generateDistinctColors = (count) => {
  const colors = [];
  for (let i = 0; i < count; i++) {
    const hue = (i * 137.508) % 360; // Golden angle approximation for good distribution
    const saturation = 65 + Math.random() * 10;
    const lightness = 65 + Math.random() * 10;
    colors.push(`hsla(${hue}, ${saturation}%, ${lightness}%, 0.7)`);
  }
  return colors;
};

export const getPeriodKey = (date, period) => {
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

export const formatTimeLabel = (timestamp, periodValue) => {
  if (!timestamp) return '';
  
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) {
    return timestamp;
  }

  switch (periodValue) {
    case 'hour':
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

export const processTimeSeriesData = (data, selectedPeriod, selectedNodes, startDateString, endDateString) => {
  if (!data?.time_series?.nodes_timeseries) return [];

  // Use provided date range or fall back to period-based range
  let startDate, endDate;
  const now = new Date();

  if (startDateString && endDateString) {
    startDate = new Date(startDateString);
    endDate = new Date(endDateString);
    // Add one day to endDate to make it inclusive
    endDate.setDate(endDate.getDate() + 1);
    // Ensure endDate doesn't exceed current time
    if (endDate > now) {
      endDate = now;
    }
  } else {
    // Fallback to the original logic
    startDate = new Date(now.getTime() - (selectedPeriod.days * 24 * 60 * 60 * 1000));
    endDate = now;
  }

  const allTimestamps = new Set();
  const nodeData = {};
  
  // Initialize node data structure
  data.time_series.nodes_timeseries.forEach(node => {
    const [nodeName, timeseries] = Object.entries(node)[0];
    nodeData[nodeName] = {};
    
    timeseries.forEach(point => {
      const pointDate = new Date(point.timestamp);
      // Ensure point is within range and not in the future
      if (pointDate >= startDate && pointDate <= endDate && pointDate <= now) {
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
        const usedValue = values.used.reduce((a, b) => a + b, 0) / values.used.length; // Average
        const totalValue = values.total.reduce((a, b) => a + b, 0) / values.total.length; // Average
        const isActive = values.active.length > 0 ? values.active[values.active.length - 1] : true;
        
        dataPoint[nodeName] = usedValue;
        dataPoint[`${nodeName}_total`] = totalValue;
        dataPoint[`${nodeName}_is_active`] = isActive;

        // Only add to totals if node is selected
        if (selectedNodes[nodeName]) {
          selectedUtilization += usedValue;
          selectedCapacity = data.summary?.total_capacity_gb || totalValue; // Use summary data if available
        }
      }
    });

    // Add totals for selected nodes only
    dataPoint.total_utilization = selectedUtilization;
    dataPoint.total_capacity = selectedCapacity;

    return dataPoint;
  });

  // For hourly view, maintain higher granularity by reducing the "skip" factor
  if (selectedPeriod.value === 'hour') {
    const maxPoints = 200; // Increase max points for hourly view
    const skip = Math.max(1, Math.ceil(aggregatedData.length / maxPoints));
    return aggregatedData.filter((_, index) => index % skip === 0);
  }
  
  // For other views, use the original logic
  const maxPoints = 100;
  const skip = Math.max(1, Math.ceil(aggregatedData.length / maxPoints));
  return aggregatedData.filter((_, index) => index % skip === 0);
};

// Calculate appropriate interval for X-axis ticks based on data points count
export const calculateXAxisInterval = (dataPointsCount) => {
  if (dataPointsCount <= 12) return 0; // Show all ticks for 12 or fewer points
  if (dataPointsCount <= 24) return 1; // Show every other tick for 24 or fewer points
  if (dataPointsCount <= 48) return 3; // Show every 4th tick for 48 or fewer points
  return 'preserveStartEnd'; // For larger datasets, preserve just start and end
};

export const createDetailPointData = (pointData, selectedNodes, formatTimeLabel) => {
  if (!pointData) return null;
  
  // Extract nodes with values
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
  
  // Extract capacity values
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
  
  // Extract active status
  const activeStatus = {};
  Object.entries(pointData)
    .filter(([key]) => 
      key.includes('_is_active')
    )
    .forEach(([key, value]) => {
      const nodeName = key.replace('_is_active', '');
      activeStatus[nodeName] = value;
    });
  
  return {
    label: pointData.timestamp,
    formattedLabel: formatTimeLabel(pointData.timestamp),
    nodes: nodesWithValues,
    capacities,
    activeStatus,
    totalUtilization: pointData.total_utilization,
    totalCapacity: pointData.total_capacity
  };
};