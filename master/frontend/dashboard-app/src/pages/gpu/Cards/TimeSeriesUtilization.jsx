import React, { useState, useEffect } from 'react';
import { Card } from '../../../shared_ui/card';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, Brush 
} from 'recharts';
import { Database } from 'lucide-react';
import _ from 'lodash';

const TIME_PERIODS = {
  MINUTE: { label: 'Minutes', value: 'minute', days: 1 },
  HOUR: { label: 'Hourly', value: 'hour', days: 7 },
  DAY: { label: 'Daily', value: 'day', days: 30 },
  WEEK: { label: 'Weekly', value: 'week', days: 90 },
  MONTH: { label: 'Monthly', value: 'month', days: 365 }
};


const TimeSeriesUtilizationCard = ({ data }) => {
  const [selectedPeriod, setSelectedPeriod] = useState(TIME_PERIODS.HOUR);


  // Calculate statistics from available data
  const stats = data.summary || {
    avg_memory: _.meanBy(Object.values(data.per_user), 'avg_memory'),
    max_memory: _.maxBy(Object.values(data.per_user), 'max_memory')?.max_memory,
    min_memory: _.minBy(Object.values(data.per_user), 'avg_memory')?.avg_memory,
    total_users: Object.keys(data.per_user).length
  };

  // Use time series data if available, otherwise create placeholder data
  const chartData = data.time_series || Object.entries(data.per_user).map(([username, stats]) => ({
    timeLabel: username,
    avg_memory: stats.avg_memory,
    max_memory: stats.max_memory,
    min_memory: stats.avg_memory // Using avg as min since we don't have min in old format
  }));

  return (
    <Card className="bg-white shadow-md rounded-lg border border-slate-100 overflow-hidden">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-blue-50 rounded-md">
              <Database className="h-4 w-4 text-blue-500" />
            </div>
            <span className="text-sm font-medium text-slate-700">Memory Usage Over Time</span>
          </div>
          
          {data.time_series && (
            <div className="flex flex-wrap gap-2">
              {Object.values(TIME_PERIODS).map((period) => (
                <button
                  key={period.value}
                  onClick={() => setSelectedPeriod(period)}
                  className={`px-3 py-1 text-xs rounded-md transition-colors ${
                    selectedPeriod.value === period.value
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {period.label}
                </button>
              ))}
            </div>
          )}
        </div>
        
        {/* Statistics cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="p-4 bg-slate-50 rounded-lg">
            <div className="text-sm text-slate-600 mb-1">Average Usage</div>
            <div className="text-xl font-bold text-slate-800">
              {Math.round(stats.avg_memory)} MB
            </div>
          </div>
          <div className="p-4 bg-slate-50 rounded-lg">
            <div className="text-sm text-slate-600 mb-1">Max Usage</div>
            <div className="text-xl font-bold text-slate-800">
              {Math.round(stats.max_memory)} MB
            </div>
          </div>
          <div className="p-4 bg-slate-50 rounded-lg">
            <div className="text-sm text-slate-600 mb-1">Min Usage</div>
            <div className="text-xl font-bold text-slate-800">
              {Math.round(stats.min_memory)} MB
            </div>
          </div>
          <div className="p-4 bg-slate-50 rounded-lg">
            <div className="text-sm text-slate-600 mb-1">Total Users</div>
            <div className="text-xl font-bold text-slate-800">
              {stats.total_users}
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis 
                dataKey="timeLabel" 
                tick={{ fill: '#64748b', fontSize: 11 }}
                angle={-45}
                textAnchor="end"
                interval="preserveStartEnd"
              />
              <YAxis 
                tick={{ fill: '#64748b', fontSize: 11 }}
                label={{ 
                  value: 'Memory Usage (MB)', 
                  angle: -90, 
                  position: 'insideLeft',
                  fill: '#64748b'
                }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  boxShadow: '0 2px 4px -1px rgba(0,0,0,0.05), 0 1px 2px -1px rgba(0,0,0,0.05)',
                  fontSize: '12px'
                }}
                formatter={(value) => [`${Math.round(value)} MB`]}
                labelFormatter={(label) => `Time: ${label}`}
              />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Line 
                type="monotone" 
                dataKey="avg_memory" 
                stroke="#3b82f6" 
                name="Average Memory"
                strokeWidth={2}
                dot={false}
              />
              <Line 
                type="monotone" 
                dataKey="max_memory" 
                stroke="#10b981" 
                name="Max Memory"
                strokeWidth={2}
                dot={false}
                strokeDasharray="3 3"
              />
              <Line 
                type="monotone" 
                dataKey="min_memory" 
                stroke="#ef4444" 
                name="Min Memory"
                strokeWidth={2}
                dot={false}
                strokeDasharray="3 3"
              />
              {data.time_series && (
                <Brush 
                  dataKey="timeLabel"
                  height={30}
                  stroke="#8884d8"
                  travellerWidth={10}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Time range indicator */}
        {data.date_range && (
          <div className="mt-4 text-xs text-slate-500 text-center">
            {data.date_range.start} - {data.date_range.end}
          </div>
        )}
      </div>
    </Card>
  );
};

export default TimeSeriesUtilizationCard;