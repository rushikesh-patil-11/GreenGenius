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

  const generateTasks = async () => {
    const newTasks: Task[] = [];
    const today = new Date();

    try {
      // For new plants (no lastWateringDate), create immediate watering task
      if (!lastWateringDate) {
        const wateringTask: Task = {
          id: `watering-${plantId}`,
          plantId,
          type: 'watering',
          dueDate: today,
          status: 'pending',
        };
        newTasks.push(wateringTask);
        
        // Save to database
        const { error: wateringError } = await supabase
          .from('plant_care_tasks')
          .insert({
            plant_id: plantId,
            type: 'watering',
            due_date: today.toISOString(),
            status: 'pending'
          });

        if (wateringError) {
          console.error('Error creating watering task:', wateringError);
        }
      } else {
        // Generate watering task for existing plants
        const nextWateringDate = addDays(lastWateringDate, wateringBenchmark);
        if (isBefore(nextWateringDate, today) || isToday(nextWateringDate)) {
          const wateringTask: Task = {
            id: `watering-${plantId}`,
            plantId,
            type: 'watering',
            dueDate: nextWateringDate,
            status: 'pending',
            lastCareDate: lastWateringDate,
          };
          newTasks.push(wateringTask);
          
          // Save to database
          const { error: wateringError } = await supabase
            .from('plant_care_tasks')
            .insert({
              plant_id: plantId,
              type: 'watering',
              due_date: nextWateringDate.toISOString(),
              status: 'pending',
              last_care_date: lastWateringDate.toISOString()
            });

          if (wateringError) {
            console.error('Error creating watering task:', wateringError);
          }
        }
      }

      // Generate fertilizing task (every 30 days)
      if (!lastFertilizingDate) {
        const fertilizingTask: Task = {
          id: `fertilizing-${plantId}`,
          plantId,
          type: 'fertilizing',
          dueDate: addDays(today, 30),
          status: 'pending',
        };
        newTasks.push(fertilizingTask);
        
        // Save to database
        const { error: fertilizingError } = await supabase
          .from('plant_care_tasks')
          .insert({
            plant_id: plantId,
            type: 'fertilizing',
            due_date: addDays(today, 30).toISOString(),
            status: 'pending'
          });

        if (fertilizingError) {
          console.error('Error creating fertilizing task:', fertilizingError);
        }
      } else {
        const nextFertilizingDate = addDays(lastFertilizingDate, 30);
        if (isBefore(nextFertilizingDate, today) || isToday(nextFertilizingDate)) {
          const fertilizingTask: Task = {
            id: `fertilizing-${plantId}`,
            plantId,
            type: 'fertilizing',
            dueDate: nextFertilizingDate,
            status: 'pending',
            lastCareDate: lastFertilizingDate,
          };
          newTasks.push(fertilizingTask);
          
          // Save to database
          const { error: fertilizingError } = await supabase
            .from('plant_care_tasks')
            .insert({
              plant_id: plantId,
              type: 'fertilizing',
              due_date: nextFertilizingDate.toISOString(),
              status: 'pending',
              last_care_date: lastFertilizingDate.toISOString()
            });

          if (fertilizingError) {
            console.error('Error creating fertilizing task:', fertilizingError);
          }
        }
      }

      // Generate pruning task (every 90 days)
      if (!lastPruningDate) {
        const pruningTask: Task = {
          id: `pruning-${plantId}`,
          plantId,
          type: 'pruning',
          dueDate: addDays(today, 90),
          status: 'pending',
        };
        newTasks.push(pruningTask);
        
        // Save to database
        const { error: pruningError } = await supabase
          .from('plant_care_tasks')
          .insert({
            plant_id: plantId,
            type: 'pruning',
            due_date: addDays(today, 90).toISOString(),
            status: 'pending'
          });

        if (pruningError) {
          console.error('Error creating pruning task:', pruningError);
        }
      } else {
        const nextPruningDate = addDays(lastPruningDate, 90);
        if (isBefore(nextPruningDate, today) || isToday(nextPruningDate)) {
          const pruningTask: Task = {
            id: `pruning-${plantId}`,
            plantId,
            type: 'pruning',
            dueDate: nextPruningDate,
            status: 'pending',
            lastCareDate: lastPruningDate,
          };
          newTasks.push(pruningTask);
          
          // Save to database
          const { error: pruningError } = await supabase
            .from('plant_care_tasks')
            .insert({
              plant_id: plantId,
              type: 'pruning',
              due_date: nextPruningDate.toISOString(),
              status: 'pending',
              last_care_date: lastPruningDate.toISOString()
            });

          if (pruningError) {
            console.error('Error creating pruning task:', pruningError);
          }
        }
      }

      setTasks(newTasks);
    } catch (error) {
      console.error('Error generating tasks:', error);
    }
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