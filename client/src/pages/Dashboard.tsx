import { useState } from "react";
import { Bell, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import Sidebar from "@/components/layout/Sidebar";
import MobileNavigation from "@/components/layout/MobileNavigation";
import OverviewCards from "@/components/dashboard/OverviewCards";
import EnvironmentSection from "@/components/dashboard/EnvironmentSection";
import AIRecommendations from "@/components/dashboard/AIRecommendations";
import PlantsList from "@/components/plants/PlantsList";
import CareSchedule from "@/components/care/CareSchedule";
import AddPlantModal from "@/components/modals/AddPlantModal";
import { useDashboardStats } from "@/hooks/useEnvironment";
import { usePlants } from "@/hooks/usePlants";
import { useCareSchedule } from "@/hooks/useCareSchedule";
import { useEnvironment } from "@/hooks/useEnvironment";
import { useAuth } from "@clerk/clerk-react";
import { queryClient } from "@/lib/queryClient";
import type { Plant } from "@shared/schema";

export default function Dashboard() {
  const userId = 1; // In a real app, this would come from authentication
  const [isAddPlantModalOpen, setIsAddPlantModalOpen] = useState(false);
  
  // Fetch dashboard stats
  const { stats, isLoading: isStatsLoading } = useDashboardStats(userId);
  
  // Fetch plants and health metrics
  const { plants, healthMetrics, isLoading: isPlantsLoading } = usePlants(userId);
  
  // Fetch care tasks
  const { tasks, isLoading: isTasksLoading } = useCareSchedule(userId);
  
  // Fetch environment data and recommendations
  const { 
    environmentData, 
    recommendations, 
    isLoading: isEnvironmentLoading,
    updateEnvironment
  } = useEnvironment(userId);

  const handleAddPlant = (newPlant: Plant) => {
    // Invalidate queries to refetch data after adding a plant
    queryClient.invalidateQueries({ queryKey: ['/api/plants'] });
    queryClient.invalidateQueries({ queryKey: ['/api/dashboard-stats'] });
    // Optionally, you could update local state if you're managing plants that way
    console.log('Plant added:', newPlant);
  };

  const handleUpdateEnvironment = () => {
    // This is handled within the EnvironmentSection component
  };

  const handleApplyRecommendation = () => {
    // This is handled within the AIRecommendations component
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop Sidebar */}
      <Sidebar />
      
      {/* Main Content */}
      <main className="main-content flex-1 overflow-y-auto pb-16">
        <div className="p-6 md:p-8">
          {/* Dashboard Header */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold font-poppins text-textColor dark:text-foreground">
                Welcome back, {stats?.name || 'Alex'}!
              </h1>
              <p className="text-muted-foreground mt-1">
                Here's how your plants are doing today.
              </p>
            </div>
            <div className="mt-4 md:mt-0 flex items-center">
              <Button variant="outline" className="mr-3 relative">
                <Bell className="h-4 w-4 mr-2" />
                <span>Notifications</span>
                <span className="ml-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white text-xs">
                  {stats?.plantsNeedingWater || 0}
                </span>
              </Button>
              <Button 
                className="bg-primary hover:bg-primary-light text-white"
                onClick={() => setIsAddPlantModalOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                <span>Add Plant</span>
              </Button>
            </div>
          </div>
          
          {/* Overview Cards */}
          <OverviewCards stats={stats || {}} loading={isStatsLoading} />
          
          {/* Environment Section */}
          <EnvironmentSection 
            environmentData={environmentData}
            userId={userId}
            onUpdate={handleUpdateEnvironment}
            loading={isEnvironmentLoading}
          />
          
          {/* AI Recommendations */}
          <AIRecommendations 
            recommendations={recommendations || []}
            onApplyRecommendation={handleApplyRecommendation}
            loading={isEnvironmentLoading}
          />
          
          {/* Plants Section */}
          <PlantsList 
            plants={plants || []} 
            healthMetrics={healthMetrics || {}}
            loading={isPlantsLoading}
          />
          
          {/* Care Schedule Section */}
          <CareSchedule 
            tasks={tasks || []}
            loading={isTasksLoading}
          />
        </div>
      </main>
      
      {/* Mobile Navigation */}
      <MobileNavigation />
      
      {/* Add Plant Modal */}
      <AddPlantModal 
        isOpen={isAddPlantModalOpen}
        onClose={() => setIsAddPlantModalOpen(false)}
        onAddPlant={handleAddPlant}
      />
    </div>
  );
}
