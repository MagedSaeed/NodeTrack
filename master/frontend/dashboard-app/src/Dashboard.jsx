import GPUDashboard from './pages/gpu/Dashboard'
import Header from './shared_ui/Header'
import { DateProvider } from './contexts/DateContext'

const Dashboard = () => {
  return (
    <DateProvider>
      <div className="max-w-5xl mx-auto px-4 py-6 min-h-screen">
        <Header />
        <GPUDashboard />
      </div>
    </DateProvider>
  );
};

export default Dashboard