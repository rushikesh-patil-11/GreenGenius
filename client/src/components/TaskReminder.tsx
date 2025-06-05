import React, { useEffect, useState } from 'react';
import { format, addDays, isBefore, isAfter, isToday } from 'date-fns';
import { Bell, Droplet, Scissors } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';

interface Task {
  id: string;
  plantId: string;
  type: 'watering' | 'fertilizing' | 'pruning';
  dueDate: Date;
  status: 'pending' | 'done' | 'skipped';
  lastCareDate?: Date;
}

interface TaskReminderProps {
  plantId: string;
  wateringBenchmark?: number;
  lastWateringDate?: Date;
  lastFertilizingDate?: Date;
  lastPruningDate?: Date;
}

export const TaskReminder: React.FC<TaskReminderProps> = ({
  plantId,
  wateringBenchmark = 2,
  lastWateringDate,
  lastFertilizingDate,
  lastPruningDate,
}) => {
  const [tasks, setTasks] = useState<Task[]>([]);

  const generateTasks = () => {
    const newTasks: Task[] = [];
    const today = new Date();

    // Generate watering task
    if (lastWateringDate) {
      const nextWateringDate = addDays(lastWateringDate, wateringBenchmark);
      if (isBefore(nextWateringDate, today) || isToday(nextWateringDate)) {
        newTasks.push({
          id: `watering-${plantId}`,
          plantId,
          type: 'watering',
          dueDate: nextWateringDate,
          status: 'pending',
          lastCareDate: lastWateringDate,
        });
      }
    }

    // Generate fertilizing task (every 30 days)
    if (lastFertilizingDate) {
      const nextFertilizingDate = addDays(lastFertilizingDate, 30);
      if (isBefore(nextFertilizingDate, today) || isToday(nextFertilizingDate)) {
        newTasks.push({
          id: `fertilizing-${plantId}`,
          plantId,
          type: 'fertilizing',
          dueDate: nextFertilizingDate,
          status: 'pending',
          lastCareDate: lastFertilizingDate,
        });
      }
    }

    // Generate pruning task (every 90 days)
    if (lastPruningDate) {
      const nextPruningDate = addDays(lastPruningDate, 90);
      if (isBefore(nextPruningDate, today) || isToday(nextPruningDate)) {
        newTasks.push({
          id: `pruning-${plantId}`,
          plantId,
          type: 'pruning',
          dueDate: nextPruningDate,
          status: 'pending',
          lastCareDate: lastPruningDate,
        });
      }
    }

    setTasks(newTasks);
  };

  useEffect(() => {
    generateTasks();
  }, [plantId, wateringBenchmark, lastWateringDate, lastFertilizingDate, lastPruningDate]);

  const getTaskIcon = (type: Task['type']) => {
    switch (type) {
      case 'watering':
        return <Droplet className="w-4 h-4" />;
      case 'fertilizing':
        return <Bell className="w-4 h-4" />;
      case 'pruning':
        return <Scissors className="w-4 h-4" />;
    }
  };

  const getTaskStatus = (dueDate: Date) => {
    if (isBefore(dueDate, new Date())) return 'overdue';
    if (isToday(dueDate)) return 'due';
    return 'upcoming';
  };

  const handleTaskAction = async (taskId: string, action: 'done' | 'skip' | 'reschedule') => {
    try {
      if (action === 'done') {
        await supabase
          .from('plant_care_tasks')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('id', taskId);
      } else if (action === 'skip') {
        await supabase
          .from('plant_care_tasks')
          .update({ status: 'skipped' })
          .eq('id', taskId);
      } else if (action === 'reschedule') {
        const task = tasks.find(t => t.id === taskId);
        if (task) {
          const newDueDate = addDays(new Date(), 1);
          await supabase
            .from('plant_care_tasks')
            .update({ due_date: newDueDate.toISOString() })
            .eq('id', taskId);
        }
      }
      generateTasks(); // Refresh tasks after action
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  return (
    <div className="space-y-4">
      {tasks.map((task) => (
        <Card key={task.id} className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {getTaskIcon(task.type)}
              <div>
                <h3 className="font-medium capitalize">{task.type}</h3>
                <p className="text-sm text-gray-500">
                  Due: {format(task.dueDate, 'MMM dd, yyyy')}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Badge
                variant={
                  getTaskStatus(task.dueDate) === 'overdue'
                    ? 'destructive'
                    : getTaskStatus(task.dueDate) === 'due'
                    ? 'default'
                    : 'secondary'
                }
              >
                {getTaskStatus(task.dueDate)}
              </Badge>
              <div className="flex space-x-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleTaskAction(task.id, 'done')}
                >
                  ✅
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleTaskAction(task.id, 'skip')}
                >
                  ❌
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleTaskAction(task.id, 'reschedule')}
                >
                  🔁
                </Button>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}; 