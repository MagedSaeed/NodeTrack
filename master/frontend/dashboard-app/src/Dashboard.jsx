import { useState, useEffect } from 'react'
import { Database, Cpu, Server, Users, HardDrive, ChevronUp, ChevronDown, Loader2 } from 'lucide-react'
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
  const [overviewData, setOverviewData] = useState(null);
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

  // Fetch overview data from dedicated endpoint
  const fetchOverviewData = async () => {
    setLoading(true);
    try {
      const overviewUrl = new URL('/api/overview/', window.location.origin);
      if (startDate) overviewUrl.searchParams.append('start_date', startDate);
      if (endDate) overviewUrl.searchParams.append('end_date', endDate);

      await fetchWithTokenAuth({
        url: overviewUrl.toString(),
        onSuccess: (result) => setOverviewData(result),
        onError: (errorMsg) => console.error('Overview data fetch error:', errorMsg),
        setLoading
      });
    } catch (err) {
      console.error("Error fetching overview data:", err);
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
      value: loading || !overviewData ? <Loader2 className="h-5 w-5 animate-spin text-slate-400" /> : overviewData.total_nodes,
      icon: Server
    },
    {
      title: "Total Users",
      value: loading || !overviewData ? <Loader2 className="h-5 w-5 animate-spin text-slate-400" /> : overviewData.total_users,
      icon: Users
    },
    {
      title: "Total GPUs",
      value: loading || !overviewData ? <Loader2 className="h-5 w-5 animate-spin text-slate-400" /> : overviewData.total_gpus,
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
          <h2 className="text-lg font-semibold text-slate-700">Cluster Overview at the selected time range</h2>
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