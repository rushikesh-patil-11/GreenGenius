import { useQuery, useMutation } from "@tanstack/react-query";
import { EnvironmentReading, Recommendation } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";

export function useEnvironment(options?: { enabled?: boolean }) {
  const {
    data: environmentData,
    isLoading: isEnvironmentLoading,
    error: environmentError,
  } = useQuery<EnvironmentReading>({
    queryKey: ['/api/environment'],
    queryFn: async () => {
      const response = await fetch(`/api/environment`);
      if (!response.ok) {
        throw new Error('Failed to fetch environment data');
      }
      return response.json();
    },
    enabled: options?.enabled,
  });

  const {
    data: recommendations = [],
    isLoading: isRecommendationsLoading,
    error: recommendationsError,
  } = useQuery<Recommendation[]>({
    queryKey: ['/api/recommendations'],
    queryFn: async () => {
      const response = await fetch(`/api/recommendations`);
      if (!response.ok) {
        throw new Error('Failed to fetch recommendations');
      }
      return response.json();
    },
    enabled: options?.enabled,
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

export function useDashboardStats(options?: { enabled?: boolean }) {
  const {
    data: stats,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['/api/dashboard-stats'],
    queryFn: async () => {
      const response = await fetch(`/api/dashboard-stats`);
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard stats');
      }
      return response.json();
    },
    enabled: options?.enabled,
  });

  return {
    stats,
    isLoading,
    error,
  };
}
