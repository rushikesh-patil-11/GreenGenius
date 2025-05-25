import { useQuery, useMutation } from "@tanstack/react-query";
import { CareTask, EnrichedCareTask } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";

export function useCareSchedule(options?: { enabled?: boolean }) {
  const {
    data: tasks = [],
    isLoading,
    error,
  } = useQuery<EnrichedCareTask[]>({
    queryKey: ['/api/care-tasks'],
    queryFn: async () => {
      const response = await fetch(`/api/care-tasks`);
      if (!response.ok) {
        throw new Error('Failed to fetch care tasks');
      }
      return response.json();
    },
    enabled: options?.enabled,
  });

  const completeTask = useMutation({
    mutationFn: async (taskId: number) => {
      return apiRequest('PUT', `/api/care-tasks/${taskId}/complete`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/care-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/plants'] });
    }
  });

  const skipTask = useMutation({
    mutationFn: async (taskId: number) => {
      return apiRequest('PUT', `/api/care-tasks/${taskId}/skip`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/care-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard-stats'] });
    }
  });

  const addTask = useMutation({
    mutationFn: async (task: any) => {
      return apiRequest('POST', '/api/care-tasks', task);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/care-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard-stats'] });
    }
  });

  return {
    tasks,
    isLoading,
    error,
    completeTask,
    skipTask,
    addTask,
  };
}
