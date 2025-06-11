import React from 'react';
import { format } from 'date-fns';
import { Bell, Droplet, Scissors } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';

interface Task {
  id: string;
  plant_id: string;
  type: 'watering' | 'fertilizing' | 'pruning';
  due_date: string;
  status: 'pending' | 'done' | 'skipped';
  last_care_date?: string;
  // Add other fields as needed from your DB
}

interface TaskReminderProps {
  plantId: string;
}

export const TaskReminder: React.FC<TaskReminderProps> = ({ plantId }) => {
  // Fetch real pending tasks for this plant from the DB
  const { data: tasks, isLoading } = useQuery<Task[], Error>({
    queryKey: ['plantCareTasks', plantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plant_care_tasks')
        .select('*')
        .eq('plant_id', plantId)
        .eq('status', 'pending');
      if (error) throw error;
      return data || [];
    },
  });

  const getTaskIcon = (type: Task['type']) => {
    switch (type) {
      case 'watering':
        return <Droplet className="w-4 h-4" />;
      case 'fertilizing':
        return <Bell className="w-4 h-4" />;
      case 'pruning':
        return <Scissors className="w-4 h-4" />;
      default:
        return null;
    }
  };

  if (isLoading) return <div>Loading...</div>;
  if (!tasks || tasks.length === 0) return <div>No pending tasks for this plant.</div>;

  return (
    <div className="space-y-4">
      {tasks.map((task) => (
        <Card key={task.id} className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {getTaskIcon(task.type)}
              <div>
                <h3 className="font-medium capitalize">{task.type}</h3>
                <div className="text-sm text-muted-foreground">
                  Due: {format(new Date(task.due_date), 'MMM d, yyyy')}
                </div>
              </div>
            </div>
            <Badge variant="secondary">{task.status}</Badge>
          </div>
        </Card>
      ))}
    </div>
  );
};
 