import { useState } from "react";
import { Calendar, Filter } from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import MobileNavigation from "@/components/layout/MobileNavigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCareSchedule } from "@/hooks/useCareSchedule";
import { Droplet, Scissors, Check, X } from "lucide-react";
import { formatRelativeDate, formatDate } from "@/lib/utils";
import { usePlants } from "@/hooks/usePlants";
import { useToast } from "@/hooks/use-toast";

export default function CareSchedulePage() {
  const userId = 1; // In a real app, this would come from authentication
  const [filter, setFilter] = useState("all");
  const { toast } = useToast();
  
  const { tasks, isLoading, completeTask, skipTask } = useCareSchedule(userId);
  const { plants, isLoading: isPlantsLoading } = usePlants(userId);
  
  const [processingTasks, setProcessingTasks] = useState<number[]>([]);
  
  // Filter tasks
  const filteredTasks = tasks.filter(task => {
    if (filter === "all") return true;
    if (filter === "today") {
      const today = new Date();
      const taskDate = new Date(task.dueDate);
      return (
        taskDate.getDate() === today.getDate() &&
        taskDate.getMonth() === today.getMonth() &&
        taskDate.getFullYear() === today.getFullYear()
      );
    }
    if (filter === "upcoming") {
      const today = new Date();
      const taskDate = new Date(task.dueDate);
      return taskDate > today;
    }
    return true;
  });
  
  // Get plant name by ID
  const getPlantName = (plantId: number) => {
    const plant = plants.find(p => p.id === plantId);
    return plant ? plant.name : 'Unknown Plant';
  };
  
  const handleCompleteTask = async (taskId: number) => {
    setProcessingTasks(prev => [...prev, taskId]);
    
    try {
      await completeTask.mutateAsync(taskId);
      
      toast({
        title: "Task completed",
        description: "The care task has been marked as completed.",
        variant: "default",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to complete task. Please try again.",
        variant: "destructive",
      });
    } finally {
      setProcessingTasks(prev => prev.filter(id => id !== taskId));
    }
  };
  
  const handleSkipTask = async (taskId: number) => {
    setProcessingTasks(prev => [...prev, taskId]);
    
    try {
      await skipTask.mutateAsync(taskId);
      
      toast({
        title: "Task skipped",
        description: "The care task has been skipped.",
        variant: "default",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to skip task. Please try again.",
        variant: "destructive",
      });
    } finally {
      setProcessingTasks(prev => prev.filter(id => id !== taskId));
    }
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop Sidebar */}
      <Sidebar />
      
      {/* Main Content */}
      <main className="main-content flex-1 overflow-y-auto pb-16">
        <div className="p-6 md:p-8">
          {/* Page Header */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold font-poppins text-textColor dark:text-foreground">
                Care Schedule
              </h1>
              <p className="text-muted-foreground mt-1">
                Track and manage your plant care tasks
              </p>
            </div>
            <div className="mt-4 md:mt-0">
              <Select
                value={filter}
                onValueChange={(value) => setFilter(value)}
              >
                <SelectTrigger className="w-[180px] bg-white dark:bg-card border border-gray-200 dark:border-gray-800 rounded-lg">
                  <span className="flex items-center">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="All Tasks" />
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tasks</SelectItem>
                  <SelectItem value="today">Due Today</SelectItem>
                  <SelectItem value="upcoming">Upcoming</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* Care Tasks */}
          <Card className="bg-white dark:bg-card shadow-natural">
            <CardContent className="p-6">
              {isLoading || isPlantsLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center p-3 border border-gray-100 dark:border-gray-800 rounded-lg animate-pulse">
                      <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full mr-4"></div>
                      <div className="flex-1">
                        <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-2"></div>
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
                      </div>
                      <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full mr-2"></div>
                      <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                    </div>
                  ))}
                </div>
              ) : filteredTasks.length === 0 ? (
                <div className="text-center py-10">
                  <Calendar className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-poppins font-semibold mb-2">No care tasks</h3>
                  <p className="text-muted-foreground">
                    {filter !== "all" 
                      ? "No tasks match your selected filter." 
                      : "Your plants don't need any care at the moment."}
                  </p>
                  {filter !== "all" && (
                    <Button 
                      variant="outline" 
                      className="mt-4"
                      onClick={() => setFilter("all")}
                    >
                      View All Tasks
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredTasks.map((task) => (
                    <div 
                      key={task.id} 
                      className="flex items-center p-4 border border-gray-100 dark:border-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      <div className={`flex items-center justify-center w-12 h-12 rounded-full mr-4 ${
                        task.taskType === 'water' 
                          ? 'bg-secondary/10' 
                          : 'bg-accent/10'
                      }`}>
                        {task.taskType === 'water' ? (
                          <Droplet className="text-secondary text-xl" />
                        ) : (
                          <Scissors className="text-accent text-xl" />
                        )}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-poppins font-medium text-textColor dark:text-foreground text-lg">
                          {task.taskType === 'water' ? 'Water ' : 'Prune '}
                          {getPlantName(task.plantId)}
                        </h4>
                        <div className="flex items-center mt-1">
                          <span className="text-muted-foreground text-sm">
                            Due: {formatRelativeDate(task.dueDate)}
                          </span>
                          <span className="mx-2 text-muted-foreground">•</span>
                          <span className="text-muted-foreground text-sm">
                            {formatDate(task.dueDate)}
                          </span>
                        </div>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-10 w-10 rounded-full bg-gray-100 dark:bg-gray-800 text-textColor dark:text-foreground hover:bg-gray-200 dark:hover:bg-gray-700 mr-2"
                        onClick={() => handleCompleteTask(task.id)}
                        disabled={processingTasks.includes(task.id)}
                      >
                        <Check className="h-5 w-5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-10 w-10 rounded-full bg-gray-100 dark:bg-gray-800 text-textColor dark:text-foreground hover:bg-gray-200 dark:hover:bg-gray-700"
                        onClick={() => handleSkipTask(task.id)}
                        disabled={processingTasks.includes(task.id)}
                      >
                        <X className="h-5 w-5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
      
      {/* Mobile Navigation */}
      <MobileNavigation />
    </div>
  );
}
