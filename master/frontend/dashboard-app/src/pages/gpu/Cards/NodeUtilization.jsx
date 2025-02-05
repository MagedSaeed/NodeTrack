import { Server } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { CollapsibleCard } from "../../../shared_ui/Card"
const NodeUtilization = ({ data }) => {
    const nodeChartData = Object.entries(data.per_node).map(([hostname, stats]) => ({
        name: hostname,
        'Average Memory (MB)': Math.round(stats.avg_memory || 0),
        'Active Users': stats.unique_users || 0,
        'Total GPUs': stats.total_gpus || 0
      }));
    return (
        <CollapsibleCard
            title={
                <div className="flex items-center space-x-2">
                    <div className="p-1.5 bg-emerald-50 rounded-md">
                        <Server className="h-4 w-4 text-emerald-500" />
                    </div>
                    <span className="text-sm font-medium text-slate-700">Node Utilization Analysis</span>
                </div>
            }
            className="bg-white shadow-md rounded-lg border border-slate-100 overflow-hidden"
        >
            <div className="h-72 p-4">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={nodeChartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis
                            dataKey="name"
                            tick={{ fill: '#64748b', fontSize: 11 }}
                            interval={0}
                            angle={-45}
                            textAnchor="end"
                            height={60}
                        />
                        <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                boxShadow: '0 2px 4px -1px rgba(0,0,0,0.05), 0 1px 2px -1px rgba(0,0,0,0.05)',
                                fontSize: '12px'
                            }}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                        <Bar dataKey="Average Memory (MB)" fill="#3b82f6" />
                        <Bar dataKey="Active Users" fill="#10b981" />
                        <Bar dataKey="Total GPUs" fill="#8b5cf6" />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </CollapsibleCard>
    )
}

export default NodeUtilization