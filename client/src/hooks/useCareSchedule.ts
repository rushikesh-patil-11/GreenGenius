import { useQuery, useMutation } from "@tanstack/react-query";
import { CareTask } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";

export function useCareSchedule(userId: number) {
  const {
    data: tasks = [],
    isLoading,
    error,
  } = useQuery<CareTask[]>({
    queryKey: ['/api/care-tasks', { userId }],
    queryFn: async () => {
      const response = await fetch(`/api/care-tasks?userId=${userId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch care tasks');
      }
      return response.json();
    },
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
