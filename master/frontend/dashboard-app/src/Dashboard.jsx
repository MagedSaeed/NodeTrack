import { useState, useEffect } from 'react'
import { Database, Cpu, Server, Users, HardDrive, ChevronUp, ChevronDown } from 'lucide-react'
import GPUDashboard from './pages/gpu/Dashboard'
import CPUDashboard from './pages/cpu/Dashboard'
import Header from './shared_ui/Header'
import TabNavigation from './shared_ui/TabNavigation'
import Overview from './shared_ui/Overview'
import { DateProvider, useDateRange } from './contexts/DateContext'
import { fetchWithTokenAuth } from './utils/auth'

// Inner component that has access to DateProvider context
const DashboardContent = () => {
  const [activeTab, setActiveTab] = useState('gpu');
  const [showOverview, setShowOverview] = useState(() => {
    const saved = localStorage.getItem('nodetrack-overview-visible');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [gpuData, setGpuData] = useState(null);
  const [cpuData, setCpuData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { startDate, endDate } = useDateRange();

  const tabs = [
    {
      id: 'gpu',
      label: 'GPU',
      icon: Database,
      component: GPUDashboard
    },
    {
      id: 'cpu',
      label: 'CPU',
      icon: Cpu,
      component: CPUDashboard
    }
  ];

  // Fetch overview data from both GPU and CPU endpoints
  const fetchOverviewData = async () => {
    setLoading(true);
    try {
      // Fetch GPU data
      const gpuUrl = new URL('/api/gpu/report', window.location.origin);
      if (startDate) gpuUrl.searchParams.append('start_date', startDate);
      if (endDate) gpuUrl.searchParams.append('end_date', endDate);

      await fetchWithTokenAuth({
        url: gpuUrl.toString(),
        onSuccess: (result) => setGpuData(result),
        onError: (errorMsg) => console.error('GPU data fetch error:', errorMsg),
        setLoading: () => {} // Don't set loading here since we have multiple requests
      });

      // Fetch CPU data
      const cpuUrl = new URL('/api/cpu/report', window.location.origin);
      if (startDate) cpuUrl.searchParams.append('start_date', startDate);
      if (endDate) cpuUrl.searchParams.append('end_date', endDate);

      await fetchWithTokenAuth({
        url: cpuUrl.toString(),
        onSuccess: (result) => setCpuData(result),
        onError: (errorMsg) => console.error('CPU data fetch error:', errorMsg),
        setLoading: () => {} // Don't set loading here since we have multiple requests
      });
    } catch (err) {
      console.error("Error fetching overview data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverviewData();
  }, [startDate, endDate]);

  // Create dynamic overview cards based on fetched data
  const overviewCards = [
    {
      title: "Total Nodes",
      value: loading ? "Loading..." : Math.max(gpuData?.summary?.total_nodes || 0, cpuData?.summary?.total_nodes || 0),
      icon: Server
    },
    {
      title: "Total Users",
      value: loading ? "Loading..." : (() => {
        const gpuUsers = Object.keys(gpuData?.per_user || {});
        const cpuUsers = Object.keys(cpuData?.per_user || {});
        const allUsers = new Set([...gpuUsers, ...cpuUsers]);
        return allUsers.size;
      })(),
      icon: Users
    },
    {
      title: "Total GPUs",
      value: loading ? "Loading..." : gpuData?.summary?.total_gpus || 0,
      icon: HardDrive
    }
  ];

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component || GPUDashboard;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 min-h-screen">
      <Header />

      {/* Collapsible Overview Section */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-700">Cluster Overview</h2>
          <button
            onClick={() => {
              const newValue = !showOverview;
              setShowOverview(newValue);
              localStorage.setItem('nodetrack-overview-visible', JSON.stringify(newValue));
            }}
            className="flex items-center space-x-2 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
          >
            <span>{showOverview ? 'Hide' : 'Show'}</span>
            {showOverview ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Animated collapse/expand */}
        <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
          showOverview ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}>
          <Overview cards={overviewCards} />
        </div>
      </div>

      <TabNavigation
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
      <ActiveComponent />
    </div>
  );
};

// Main Dashboard component with DateProvider wrapper
const Dashboard = () => {
  return (
    <DateProvider>
      <DashboardContent />
    </DateProvider>
  );
};

export default Dashboard