import { Card } from '../../../shared_ui/card';
import { Server, Users, Cpu } from 'lucide-react';
const Overview = ({ data }) => { 
    return (
        <div className="grid grid-cols-3 gap-4 mb-6">
            <Card className="bg-white shadow-md hover:shadow-lg transition-all duration-200 rounded-lg border border-slate-100">
                <div className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="p-1.5 bg-blue-50 rounded-md">
                            <Users className="h-4 w-4 text-blue-500" />
                        </div>
                        <h3 className="text-sm font-medium text-slate-600">Active Users</h3>
                    </div>
                    <div className="text-2xl font-bold text-slate-800">
                        {Object.keys(data.per_user).length}
                    </div>
                </div>
            </Card>

            <Card className="bg-white shadow-md hover:shadow-lg transition-all duration-200 rounded-lg border border-slate-100">
                <div className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="p-1.5 bg-emerald-50 rounded-md">
                            <Server className="h-4 w-4 text-emerald-500" />
                        </div>
                        <h3 className="text-sm font-medium text-slate-600">Active Nodes</h3>
                    </div>
                    <div className="text-2xl font-bold text-slate-800">
                        {Object.keys(data.per_node).length}
                    </div>
                </div>
            </Card>

            <Card className="bg-white shadow-md hover:shadow-lg transition-all duration-200 rounded-lg border border-slate-100">
                <div className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="p-1.5 bg-violet-50 rounded-md">
                            <Cpu className="h-4 w-4 text-violet-500" />
                        </div>
                        <h3 className="text-sm font-medium text-slate-600">GPUs in Use</h3>
                    </div>
                    <div className="text-2xl font-bold text-slate-800">{data.summary.total_gpus}</div>
                </div>
            </Card>
        </div>
    )
}

export default Overview;                                                                                                                                                                                                    