import { Clock } from "lucide-react";
import { CollapsibleCard } from "../../../shared_ui/Card";

const ActivityLog = ({ data }) => {
    return (
        <CollapsibleCard
          title={
            <div className="flex items-center space-x-2">
              <div className="p-1.5 bg-violet-50 rounded-md">
                <Clock className="h-4 w-4 text-violet-500" />
              </div>
              <span className="text-sm font-medium text-slate-700">Activity Log</span>
            </div>
          }
          className="bg-white shadow-md rounded-lg border border-slate-100 overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">User</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">Nodes Used</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-slate-500">Avg Memory (MB)</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-slate-500">GPUs Used</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(data.per_user).map(([username, stats]) => (
                  <tr
                    key={username}
                    className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors duration-150"
                  >
                    <td className="py-2 px-3 text-xs text-slate-700">{username}</td>
                    <td className="py-2 px-3 text-xs text-slate-700">{stats.nodes_used}</td>
                    <td className="py-2 px-3 text-xs text-slate-700 text-right">{Math.round(stats.avg_memory).toLocaleString()}</td>
                    <td className="py-2 px-3 text-xs text-slate-700 text-right">{stats.gpus_used}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CollapsibleCard>
    )
}

export default ActivityLog;