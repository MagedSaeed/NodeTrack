import React, { useState, useEffect } from 'react';
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

const TimeSeriesUtilizationCard = ({ data }) => {
  const [selectedPeriod, setSelectedPeriod] = useState(TIME_PERIODS.HOUR);
  const [filteredData, setFilteredData] = useState([]);

  useEffect(() => {
    if (!data.time_series) {
      setFilteredData(Object.entries(data.per_user).map(([username, stats]) => ({
        timestamp: username,
        avg_memory: stats.avg_memory,
        max_memory: stats.max_memory,
        min_memory: stats.min_memory || stats.avg_memory
      })));
      return;
    }

    const now = new Date();
    const startDate = new Date(now.getTime() - (selectedPeriod.days * 24 * 60 * 60 * 1000));

    const filteredTimeData = data.time_series.filter(point => {
      const pointDate = new Date(point.timestamp);
      return pointDate >= startDate && pointDate <= now;
    });

    const groupedData = _.groupBy(filteredTimeData, point => {
      const date = new Date(point.timestamp);
      switch (selectedPeriod.value) {
        case 'hour':
          return date.toISOString().slice(0, 13);
        case 'day':
          return date.toISOString().slice(0, 10);
        case 'week':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          return weekStart.toISOString().slice(0, 10);
        case 'month':
          return date.toISOString().slice(0, 7);
        default:
          return date.toISOString().slice(0, 13);
      }
    });

    const aggregatedData = Object.entries(groupedData).map(([timestamp, points]) => ({
      timestamp,
      avg_memory: _.meanBy(points, 'avg_memory'),
      max_memory: _.maxBy(points, 'max_memory').max_memory,
      min_memory: _.minBy(points, 'min_memory').min_memory,
      gpus_used: _.maxBy(points, 'gpus_used').gpus_used,
      unique_users: _.maxBy(points, 'unique_users').unique_users
    }));

    const sortedData = _.sortBy(aggregatedData, 'timestamp');
    setFilteredData(sortedData);
  }, [selectedPeriod, data]);

  const stats = {
    avg_memory: _.meanBy(filteredData, 'avg_memory') || data.summary.avg_memory,
    max_memory: _.maxBy(filteredData, 'max_memory')?.max_memory || data.summary.max_memory,
    min_memory: _.minBy(filteredData, 'min_memory')?.min_memory || data.summary.min_memory,
    total_users: data.summary.total_users
  };

  const formatTimeLabel = (timestamp) => {
    if (!data.time_series) return timestamp;
    
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
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-blue-50 rounded-md">
              <Database className="h-5 w-5 text-blue-500" />
            </div>
            <span className="text-base font-medium text-slate-700">Memory Usage Over Time</span>
          </div>
          
          {data.time_series && (
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
          )}
        </div>
        
        <div className="grid grid-cols-4 gap-6 mb-8">
          <div className="p-4 bg-slate-50 rounded-lg">
            <div className="text-sm text-slate-600 mb-2">Average Usage</div>
            <div className="text-2xl font-bold text-slate-800">
              {Math.round(stats.avg_memory)} MB
            </div>
          </div>
          <div className="p-4 bg-slate-50 rounded-lg">
            <div className="text-sm text-slate-600 mb-2">Max Usage</div>
            <div className="text-2xl font-bold text-slate-800">
              {Math.round(stats.max_memory)} MB
            </div>
          </div>
          <div className="p-4 bg-slate-50 rounded-lg">
            <div className="text-sm text-slate-600 mb-2">Min Usage</div>
            <div className="text-2xl font-bold text-slate-800">
              {Math.round(stats.min_memory)} MB
            </div>
          </div>
          <div className="p-4 bg-slate-50 rounded-lg">
            <div className="text-sm text-slate-600 mb-2">Total Users</div>
            <div className="text-2xl font-bold text-slate-800">
              {stats.total_users}
            </div>
          </div>
        </div>

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
                  value: 'Memory Usage (MB)', 
                  angle: -90, 
                  position: 'insideLeft',
                  style: { 
                    fill: '#64748b',
                    fontSize: '14px',
                    textAnchor: 'middle'
                  },
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
                formatter={(value) => [`${Math.round(value)} MB`]}
                labelFormatter={(label) => {
                  const date = new Date(label);
                  return `${formatTimeLabel(label)}`
                }}
              />
              <Legend 
                verticalAlign="top"
                height={36}
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ 
                  fontSize: '12px',
                  paddingTop: '15px'
                }}
              />
              <Line 
                type="monotone" 
                dataKey="avg_memory" 
                stroke="#3b82f6" 
                name="Average Memory"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2, fill: 'white' }}
              />
              {data.time_series && (
                <Brush 
                  dataKey="timestamp"
                  height={30}
                  stroke="#94a3b8"
                  tickFormatter={formatTimeLabel}
                  startIndex={Math.max(0, filteredData.length - 20)}
                  y={300}
                  travellerWidth={10}
                  fill="#f8fafc"
                  padding={{ top: 10 }}
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  gap={10}
                  x={250}
                  width={500}
                />
              )}
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