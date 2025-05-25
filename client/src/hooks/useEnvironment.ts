import { useQuery, useMutation } from "@tanstack/react-query";
import { EnvironmentReading, Recommendation } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";

// Define interfaces for dashboard stats
interface ProcessedDashboardStats {
  totalPlants: number;
  plantsNeedingWater: number;
  healthStatus: string;
  healthPercentage: number;
  upcomingTasks: number; // Ensured to be a number
  newPlantsThisMonth: number;
  name?: string; // Used in Dashboard.tsx
  // Include any other properties returned by /api/dashboard-stats
}

// Assume API might return 'upcomingTasks' as 'any' initially
interface ApiDashboardStats extends Omit<ProcessedDashboardStats, 'upcomingTasks'> {
  upcomingTasks: any; 
}

export function useEnvironment(options?: { enabled?: boolean }) {
  const { data: environmentData, isLoading: isEnvironmentLoading, error: environmentError } = useQuery<EnvironmentReading>({
    queryKey: ['/api/environment'],
    queryFn: async () => {
      const [environmentResponse, weatherResponse] = await Promise.all([
        fetch(`/api/environment`),
        fetch(`/api/weather`)
      ]);

      if (!environmentResponse.ok) {
        throw new Error('Failed to fetch environment data');
      }
      if (!weatherResponse.ok) {
        // Log the error but don't block the environment data from loading
        console.error('Failed to fetch weather data:', weatherResponse.statusText);
        // Return just the environment data if weather fetching fails
        return environmentResponse.json();
      }

      const environment = await environmentResponse.json();
      const weather = await weatherResponse.json();

      // Combine environment data with weather data, prioritizing existing environment data
      return {
        ...environment,
        temperature: environment.temperature ?? weather.current.temperature_2m,
        humidity: environment.humidity ?? weather.current.relative_humidity_2m,
        soil_moisture_0_to_10cm: environment.soil_moisture_0_to_10cm ?? weather.current.soil_moisture_0_to_10cm,
        // Note: Light level is not directly available from Open-Meteo, keep existing or set to null/default
        lightLevel: environment.lightLevel ?? null, // Or a default like 'unknown'
      };
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
  } = useQuery<ProcessedDashboardStats>({
    queryKey: ['/api/dashboard-stats'],
    queryFn: async (): Promise<ProcessedDashboardStats> => {
      const response = await fetch(`/api/dashboard-stats`);
      if (!response.ok) {
        // Attempt to get more error info from response body
        let errorBody = 'Failed to fetch dashboard stats';
        try {
          const errJson = await response.json();
          errorBody = errJson.message || errJson.error || JSON.stringify(errJson);
        } catch (e) {
          // Ignore if response body is not JSON or empty
        }
        throw new Error(`Failed to fetch dashboard stats: ${response.status} ${errorBody}`);
      }
      const rawData: ApiDashboardStats = await response.json();

      let processedUpcomingTasks: number;
      if (rawData.upcomingTasks && typeof rawData.upcomingTasks === 'object' && !Array.isArray(rawData.upcomingTasks)) {
        // If it's a single task object (and not null/undefined)
        processedUpcomingTasks = 1;
      } else if (Array.isArray(rawData.upcomingTasks)) {
        // If it's an array of tasks
        processedUpcomingTasks = rawData.upcomingTasks.length;
      } else if (typeof rawData.upcomingTasks === 'number') {
        // If it's already a number
        processedUpcomingTasks = rawData.upcomingTasks;
      } else {
        // Otherwise (null, undefined, or unexpected type)
        processedUpcomingTasks = 0;
      }

      return {
        ...rawData,
        upcomingTasks: processedUpcomingTasks,
      };
    },
    enabled: options?.enabled,
  });

  return {
    stats,
    isLoading,
    error,
  };
}
