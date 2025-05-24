import { useQuery, useMutation } from "@tanstack/react-query";
import { EnvironmentReading, Recommendation } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";

export function useEnvironment(userId: number) {
  const {
    data: environmentData,
    isLoading: isEnvironmentLoading,
    error: environmentError,
  } = useQuery<EnvironmentReading>({
    queryKey: ['/api/environment', { userId }],
    queryFn: async () => {
      const response = await fetch(`/api/environment?userId=${userId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch environment data');
      }
      return response.json();
    },
  });

  const {
    data: recommendations = [],
    isLoading: isRecommendationsLoading,
    error: recommendationsError,
  } = useQuery<Recommendation[]>({
    queryKey: ['/api/recommendations', { userId }],
    queryFn: async () => {
      const response = await fetch(`/api/recommendations?userId=${userId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch recommendations');
      }
      return response.json();
    },
  });

  const updateEnvironment = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('POST', '/api/environment', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/environment'] });
      queryClient.invalidateQueries({ queryKey: ['/api/recommendations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard-stats'] });
    }
  });

  const applyRecommendation = useMutation({
    mutationFn: async (recommendationId: number) => {
      return apiRequest('PUT', `/api/recommendations/${recommendationId}/apply`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/recommendations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/plants'] });
    }
  });

  return {
    environmentData,
    recommendations,
    isLoading: isEnvironmentLoading || isRecommendationsLoading,
    error: environmentError || recommendationsError,
    updateEnvironment,
    applyRecommendation,
  };
}

export function useDashboardStats(userId: number) {
  const {
    data: stats,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['/api/dashboard-stats', { userId }],
    queryFn: async () => {
      const response = await fetch(`/api/dashboard-stats?userId=${userId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard stats');
      }
      return response.json();
    },
  });

  return {
    stats,
    isLoading,
    error,
  };
}
