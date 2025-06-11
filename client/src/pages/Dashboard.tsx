import { useState, useEffect } from "react"; // Added useEffect
import { Plus, Thermometer, Droplet, Sun, Sprout, BarChartHorizontalBig, BrainCircuit, Leaf, Wind, Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import Sidebar from "@/components/layout/Sidebar";
import MobileNavigation from "@/components/layout/MobileNavigation";
import PlantsList from "@/components/plants/PlantsList";
import AddPlantModal from "@/components/modals/AddPlantModal";
import { useDashboardStats } from "@/hooks/useEnvironment"; // Assuming this provides totalPlants
import { usePlants } from "@/hooks/usePlants";
import { useEnvironment } from "@/hooks/useEnvironment";
import { useAuth } from "@clerk/clerk-react";
import { queryClient, apiRequest } from "@/lib/queryClient"; // Added apiRequest
import AppLoader from "@/components/ui/AppLoader";
import type { Plant } from "@shared/schema";
import { TaskReminder } from "@/components/TaskReminder";
import { usePlantCareTasks } from "@/hooks/usePlantCareTasks";

// Helper to check if a date is today (UTC-safe)
const isToday = (someDate: string | Date) => {
  const today = new Date();
  const dateToCompare = new Date(someDate);
  // Compare YYYY-MM-DD in UTC
  return today.toISOString().slice(0, 10) === dateToCompare.toISOString().slice(0, 10);
};

interface WeatherCardProps {
  icon: React.ElementType;
  value: string | number;
  unit?: string;
  label: string;
  iconBgClass: string;
  iconColorClass: string;
}

const WeatherCard: React.FC<WeatherCardProps> = ({ icon: Icon, value, unit, label, iconBgClass, iconColorClass }) => (
  <div className="bg-white dark:bg-slate-700 p-3.5 rounded-xl shadow-md flex items-center space-x-3">
    <div className={`p-2.5 rounded-lg ${iconBgClass}`}>
      <Icon className={`h-5 w-5 ${iconColorClass}`} />
    </div>
    <div>
      <p className="text-lg font-semibold text-gray-700 dark:text-gray-200">
        {value}{unit}
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
    </div>
  </div>
);

export default function Dashboard() {
  const { userId: clerkUserId, isSignedIn, getToken } = useAuth(); // Added getToken
  const [isAddPlantModalOpen, setIsAddPlantModalOpen] = useState(false);
  const [friendlyAiTip, setFriendlyAiTip] = useState<string | null>(null);
  const [isLoadingTip, setIsLoadingTip] = useState<boolean>(false);

  const { stats, isLoading: isStatsLoading } = useDashboardStats({ enabled: !!isSignedIn && !!clerkUserId });
  const { plants, healthMetrics, isLoading: isPlantsLoading } = usePlants({ enabled: !!isSignedIn && !!clerkUserId });
  // Unified task logic: use only usePlantCareTasks
  const { tasks: careTasks, isLoading: isCareTasksLoading, updateTask } = usePlantCareTasks();
  const { environmentData, recommendations, isLoading: isEnvironmentLoading } = useEnvironment({ enabled: !!isSignedIn && !!clerkUserId });

  const handleAddPlant = (newPlant: Plant) => {
    queryClient.invalidateQueries({ queryKey: ['/api/plants'] });
    queryClient.invalidateQueries({ queryKey: ['/api/dashboard-stats'] });
    console.log('Plant added:', newPlant);
  };

  // Normalize task data for UI
  const normalizedTasks = (careTasks || []).map(task => {
    // Ensure plantId is present, fallback to plant_id from backend
    const plantId = task.plantId || (task as any).plant_id;
    // Debug: log plantId and all plant ids
    console.log('Task:', task.id, 'plantId:', plantId, 'all plant ids:', plants ? plants.map(p => p.id) : []);
    let plantName = (task as any).plant_name || '';
    if (!plantName && plants && plantId) {
      const plant = plants.find(p => String(p.id) === String(plantId));
      if (plant) plantName = plant.name;
    }
    return {
      ...task,
      plantId, // always attach plantId
      completed: task.status === 'done',
      taskType: task.type, // 'watering', 'fertilizing', 'pruning'
      plantName: plantName || 'Unknown Plant',
    };
  });

  // Debug output to inspect fetched tasks
  console.log("Fetched careTasks:", normalizedTasks.map(task => ({id: task.id, dueDate: task.dueDate, status: task.status, type: task.type})));
  // Show all pending tasks instead of only today's
  const pendingTasks = normalizedTasks.filter((task: typeof normalizedTasks[number]) => task.status === 'pending');
  const totalTasks = pendingTasks.length;
  const completedTasks = pendingTasks.filter((task: typeof normalizedTasks[number]) => task.completed).length;
  const remainingTasks = pendingTasks.filter((task: typeof normalizedTasks[number]) => !task.completed).length;
  // const aiTip = recommendations && recommendations.length > 0 ? recommendations[0] : null; // Old way of getting tip

  // useEffect for fetching General AI Tip of the Day
  useEffect(() => {
    if (isSignedIn && getToken) { // General tip doesn't depend on plants list
      const fetchGeneralAiTip = async () => {
        setIsLoadingTip(true);
        try {
          const response = await apiRequest(
            'GET', // Changed to GET
            `/api/ai-general-tip`, // New endpoint for general tips
            {
              getToken: getToken, // Pass getToken for authentication
              // No body needed for GET request to this endpoint
            }
          );

          // The apiRequest function returns a Response object.
          // We need to parse its JSON body to get the actual data.
          const data = await response.json();

          if (data && data.tip) {
            setFriendlyAiTip(data.tip);
          } else {
            setFriendlyAiTip(data?.error || 'Could not fetch a general tip today. Check your connection or try again later.');
          }
        } catch (error) {
          console.error("Failed to fetch general AI tip:", error);
          setFriendlyAiTip("Oops! We couldn't fetch a general tip for you right now. Please try again.");
        } finally {
          setIsLoadingTip(false);
        }
      };

      fetchGeneralAiTip();
    }
  }, [isSignedIn, getToken]);

  // Determine weather conditions text
  let weatherConditionText = "Clear";
  // Basic logic for condition text, can be expanded
  if (environmentData?.humidity && environmentData.humidity > 75) weatherConditionText = "Humid";
  if (environmentData?.temperature && environmentData.temperature < 10) weatherConditionText = "Cold"; // Assuming Celsius, adjust if Fahrenheit
  if (environmentData?.temperature && environmentData.temperature > 30) weatherConditionText = "Hot";  // Assuming Celsius, adjust if Fahrenheit
  // For simplicity, we'll use a generic Sun icon for 'Clear' or default
  let WeatherConditionIcon = Sun;
  if (weatherConditionText === "Humid") WeatherConditionIcon = Droplet; // Or a cloud icon
  if (weatherConditionText === "Cold" || weatherConditionText === "Hot") WeatherConditionIcon = Thermometer; // Or Wind


  // Check if all main data is loading, but only after authentication is complete
  const isLoading = isSignedIn && clerkUserId && (isPlantsLoading || isStatsLoading || isEnvironmentLoading || isCareTasksLoading);

  // Main loading state for the entire dashboard - only show after authentication is verified
  if (isSignedIn && clerkUserId && isLoading) {
    return (
      <div className="flex h-screen bg-emerald-50 dark:bg-gray-900">
        <Sidebar />
        <main className="main-content flex-1 overflow-y-auto pb-20 bg-emerald-50 dark:bg-gray-900 flex items-center justify-center">
          <AppLoader 
            title="Loading Dashboard" 
            message="Gathering all your plant data and insights..." 
            size="large" 
            variant="default"
          />
        </main>
        <MobileNavigation />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-emerald-50 dark:bg-gray-900">
      <Sidebar />

      <main className="main-content flex-1 overflow-y-auto pb-20 bg-emerald-50 dark:bg-gray-900">
        <div className="p-6 md:p-8">
          {/* New Dashboard Header: Greeting and Weather */}
          <div className="mb-8 p-6 rounded-xl bg-green-100 dark:bg-gray-800 shadow-sm flex flex-col md:flex-row justify-between md:items-start">
            {/* Text content on the left */}
            <div className="mb-4 md:mb-0 md:mr-6">
              <h1 className="text-3xl font-bold text-green-800 dark:text-green-300 font-poppins">
                Good day for plant care!
              </h1>
              <p className="text-green-600 dark:text-green-400 mt-1">
                Perfect conditions for your green friends.
              </p>
            </div>
            {/* Weather cards on the right */}
            <div className="flex flex-col sm:flex-row gap-3">
              <WeatherCard 
                icon={Thermometer}
                value={isEnvironmentLoading ? '--' : environmentData?.temperature ?? '--'}
                unit="°F" 
                label="Temperature"
                iconBgClass="bg-orange-100 dark:bg-orange-800"
                iconColorClass="text-orange-500 dark:text-orange-300"
              />
              <WeatherCard 
                icon={Droplet} 
                value={isEnvironmentLoading ? '--' : environmentData?.humidity ?? '--'}
                unit="%" 
                label="Humidity" 
                iconBgClass="bg-sky-100 dark:bg-sky-800"
                iconColorClass="text-sky-500 dark:text-sky-300"
              />
              <WeatherCard 
                icon={Leaf} 
                value={isEnvironmentLoading ? '--' : environmentData?.soil_moisture_0_to_10cm ?? '--'} // Sourced from environmentData
                unit="%"
                label="Soil Moisture" 
                iconBgClass="bg-lime-100 dark:bg-lime-800"
                iconColorClass="text-lime-600 dark:text-lime-300"
              />
            </div>
          </div>

          {/* Your Plant Collection Section */}
          <div className="mb-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
              <h2 className="text-2xl font-bold text-green-700 dark:text-green-400 mb-3 sm:mb-0">
                Your Plant Collection
              </h2>
              <Button 
                className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 px-5 rounded-lg shadow-md flex items-center transition-colors duration-150"
                onClick={() => setIsAddPlantModalOpen(true)}
              >
                <Plus className="h-5 w-5 mr-2" />
                Add New Plant
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Today's Tasks Card */}
              <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center">
                      <Sprout className="h-7 w-7 mr-3 text-green-500" />
                      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Today's Tasks</h3>
                    </div>
                  </div>
                  {isCareTasksLoading ? (
                    <AppLoader title="Loading Tasks" message="Fetching your care tasks..." size="small" variant="minimal" />
                  ) : totalTasks > 0 ? (
                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <div className="text-center">
                          <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{totalTasks}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Total Tasks</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                            {completedTasks}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Completed</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                            {remainingTasks}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Remaining</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-600 dark:text-gray-300 mt-4">No tasks for today! Add some plants to get care tasks.</p>
                  )}
                </div>
              </div>

              {/* Plant Collection Card */}
              <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg">
                <div className="flex items-center mb-3">
                  <BarChartHorizontalBig className="h-7 w-7 mr-3 text-blue-500" />
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Plant Collection</h3>
                </div>
                {isStatsLoading ? (
                    <AppLoader title="Loading Stats" message="Fetching your plant collection stats..." size="small" variant="minimal" />
                  ) : (
                  <p className="text-2xl font-bold text-gray-700 dark:text-gray-200">{stats?.totalPlants || 0} <span className="text-sm font-normal text-gray-600 dark:text-gray-300">plants total</span></p>
                )}
                {/* Placeholder for visual element if any */}
                <div className="mt-4 h-10 flex items-end space-x-1">
                  {[...Array(Math.min(stats?.totalPlants || 0, 5))].map((_, i) => (
                     <div key={i} className={`w-3 rounded-t-sm ${i % 2 === 0 ? 'bg-green-400 h-full' : 'bg-green-600 h-3/4'}`}></div>
                  ))}
                </div>
              </div>

              {/* AI Tip of the Day Card */}
              <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg">
                <div className="flex items-center mb-3">
                  <BrainCircuit className="h-7 w-7 mr-3 text-purple-500" />
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">AI Tip of the Day</h3>
                </div>
                {isLoadingTip ? (
                  <AppLoader title="Loading Tip" message="Generating your daily plant care tip..." size="small" variant="minimal" />
                ) : friendlyAiTip ? (
                  <p className="text-base italic text-green-700 dark:text-green-400 leading-relaxed font-medium">🌱 {friendlyAiTip}</p>
                ) : (
                  <p className="text-sm text-gray-600 dark:text-gray-300">No tips available right now, or still loading plants.</p>
                )}
              </div>
            </div>

            {/* Task Reminders Section */}
            <div className="mt-8">
              <div className="flex items-center mb-4">
                <BrainCircuit className="h-7 w-7 mr-3 text-purple-500" />
                <h2 className="text-2xl font-bold text-green-700 dark:text-green-400">Task Reminders</h2>
              </div>
              <div className="space-y-3">
                {pendingTasks.length === 0 ? (
                  <div className="text-gray-600 dark:text-gray-300 italic">No pending tasks! Enjoy your day </div>
                ) : (
                  pendingTasks.map(task => (
                    <div key={task.id} className="bg-white dark:bg-slate-700 rounded-lg shadow flex items-center justify-between p-4">
                      <div className="flex items-center gap-3">
                        {/* Type icon */}
                        {task.taskType === 'watering' && <Droplet className="w-5 h-5 text-blue-500" />}
                        {task.taskType === 'fertilizing' && <Sun className="w-5 h-5 text-yellow-500" />}
                        {task.taskType === 'pruning' && <Scissors className="w-5 h-5 text-green-700" />}
                        <div>
                          <div className="font-semibold capitalize text-gray-800 dark:text-gray-100">{task.taskType} <span className="text-sm font-normal text-gray-500 dark:text-gray-300">for</span> {task.plantName}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Due: {new Date(task.dueDate).toLocaleDateString()}</div>
                        </div>
                      </div>
                      <div>
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 capitalize">{task.status}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

          {/* My Plants Section */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-green-700 dark:text-green-400 mb-8">
              My Plants <span className="text-base font-normal text-gray-500 dark:text-gray-400">({plants?.length || 0} plants)</span>
            </h2>
            <PlantsList 
              plants={plants || []} 
              healthMetrics={healthMetrics || {}}
              loading={isPlantsLoading}
            />
          </div>

        </div>
      </main>
      
      <MobileNavigation />
      
      <AddPlantModal 
        isOpen={isAddPlantModalOpen}
        onClose={() => setIsAddPlantModalOpen(false)}
        onAddPlant={handleAddPlant}
      />

      {/* Floating Action Button */}
      <Button 
        className="fixed bottom-6 right-6 md:bottom-8 md:right-8 bg-green-600 hover:bg-green-700 text-white p-4 h-14 w-14 rounded-full shadow-xl z-20 flex items-center justify-center transition-transform duration-150 ease-in-out hover:scale-105"
        onClick={() => setIsAddPlantModalOpen(true)}
        aria-label="Add New Plant"
      >
        <Plus className="h-7 w-7" />
      </Button>
    </div>
  );
}
