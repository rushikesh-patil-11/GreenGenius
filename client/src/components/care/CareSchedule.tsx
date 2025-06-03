import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import AppLoader from "@/components/ui/AppLoader";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import type { CareTask } from "@shared/schema";
import { Droplet, Scissors, Check, X } from "lucide-react";
import { formatRelativeDate } from "@/lib/utils";

interface CareScheduleProps {
  tasks: CareTask[];
  loading?: boolean;
}

export function CareSchedule({ tasks, loading = false }: CareScheduleProps) {
  const { toast } = useToast();
  const [processingTasks, setProcessingTasks] = useState<number[]>([]);

  const handleCompleteTask = async (taskId: number) => {
    setProcessingTasks((prev) => [...prev, taskId]);
    
    try {
      await apiRequest('PUT', `/api/care-tasks/${taskId}/complete`, {});
      
      toast({
        title: "Task completed",
        description: "The care task has been marked as completed.",
        variant: "default",
      });
      
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['/api/care-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/plants'] });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to complete task. Please try again.",
        variant: "destructive",
      });
    } finally {
      setProcessingTasks((prev) => prev.filter(id => id !== taskId));
    }
  };

  const handleSkipTask = async (taskId: number) => {
    setProcessingTasks((prev) => [...prev, taskId]);
    
    try {
      await apiRequest('PUT', `/api/care-tasks/${taskId}/skip`, {});
      
      toast({
        title: "Task skipped",
        description: "The care task has been skipped.",
        variant: "default",
      });
      
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['/api/care-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard-stats'] });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to skip task. Please try again.",
        variant: "destructive",
      });
    } finally {
      setProcessingTasks((prev) => prev.filter(id => id !== taskId));
    }
  };

  if (loading) {
    return (
      <Card className="bg-white dark:bg-card shadow-natural mb-8">
        <CardContent className="p-6 flex justify-center items-center py-12">
          <AppLoader 
            title="Loading Care Schedule" 
            message="Preparing your plant care tasks..." 
            size="medium" 
            variant="default"
          />
        </CardContent>
      </Card>
    );
  }

  if (tasks.length === 0) {
    return (
      <Card className="bg-white dark:bg-card shadow-natural mb-8">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold font-poppins text-textColor dark:text-foreground">Upcoming Care Tasks</h2>
            <Link to="/schedule">
              <Button variant="link" className="text-secondary">
                View Full Schedule <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>
          
          <div className="text-center py-8">
            <p className="text-muted-foreground">No upcoming care tasks.</p>
            <p className="text-muted-foreground text-sm mt-2">
              Tasks will appear here when your plants need care.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white dark:bg-card shadow-natural mb-8">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold font-poppins text-textColor dark:text-foreground">Upcoming Care Tasks</h2>
          <Link to="/schedule">
            <Button variant="link" className="text-secondary">
              View Full Schedule <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
        
        <div className="space-y-4">
          {tasks.slice(0, 3).map((task) => (
            <div 
              key={task.id} 
              className="flex items-center p-3 border border-gray-100 dark:border-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              <div className={`flex items-center justify-center w-10 h-10 rounded-full mr-4 ${
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
                <h4 className="font-poppins font-medium text-textColor dark:text-foreground">
                  {task.taskType === 'water' ? 'Water ' : 'Prune '}
                  Plant
                </h4>
                <p className="text-muted-foreground text-sm">
                  {formatRelativeDate(task.dueDate)}
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 rounded-full bg-gray-100 dark:bg-gray-800 text-textColor dark:text-foreground hover:bg-gray-200 dark:hover:bg-gray-700 mr-2"
                onClick={() => handleCompleteTask(task.id)}
                disabled={processingTasks.includes(task.id)}
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 rounded-full bg-gray-100 dark:bg-gray-800 text-textColor dark:text-foreground hover:bg-gray-200 dark:hover:bg-gray-700"
                onClick={() => handleSkipTask(task.id)}
                disabled={processingTasks.includes(task.id)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default CareSchedule;
