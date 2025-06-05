import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { PlantCareTask } from '@shared/schema';

export function usePlantCareTasks(plantId?: string) {
  const queryClient = useQueryClient();

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['plantCareTasks', plantId],
    queryFn: async () => {
      let query = supabase
        .from('plant_care_tasks')
        .select('*')
        .order('due_date', { ascending: true });

      if (plantId) {
        query = query.eq('plant_id', plantId);
      }

      const { data, error } = await query;
      if (error) throw error;

      return data.map((task: any) => ({
        ...task,
        dueDate: new Date(task.due_date),
        completedAt: task.completed_at ? new Date(task.completed_at) : undefined,
        createdAt: new Date(task.created_at),
        updatedAt: new Date(task.updated_at),
      })) as PlantCareTask[];
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, updates }: { taskId: string; updates: Partial<PlantCareTask> }) => {
      const { error } = await supabase
        .from('plant_care_tasks')
        .update({
          ...updates,
          due_date: updates.dueDate?.toISOString(),
          completed_at: updates.completedAt?.toISOString(),
        })
        .eq('id', taskId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plantCareTasks'] });
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async (newTask: Omit<PlantCareTask, 'id' | 'createdAt' | 'updatedAt'>) => {
      const { error } = await supabase
        .from('plant_care_tasks')
        .insert({
          plant_id: newTask.plantId,
          type: newTask.type,
          due_date: newTask.dueDate.toISOString(),
          status: newTask.status,
          completed_at: newTask.completedAt?.toISOString(),
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plantCareTasks'] });
    },
  });

  return {
    tasks,
    isLoading,
    updateTask: updateTaskMutation.mutate,
    createTask: createTaskMutation.mutate,
  };
} 