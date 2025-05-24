import { useQuery, useMutation } from "@tanstack/react-query";
import { Plant, PlantHealthMetric } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";

export function usePlants(options?: { enabled?: boolean }) {
  const {
    data: plants = [],
    isLoading,
    error,
  } = useQuery<Plant[]>({
    queryKey: ['/api/plants'],
    queryFn: async () => {
      const response = await fetch(`/api/plants`);
      if (!response.ok) {
        throw new Error('Failed to fetch plants');
      }
      return response.json();
    },
    enabled: options?.enabled,
  });

  const healthMetricsQueries = plants.map((plant) => {
    return useQuery<PlantHealthMetric>({
      queryKey: ['/api/plants', plant.id, 'health'],
      queryFn: async () => {
        const response = await fetch(`/api/plants/${plant.id}/health`);
        if (!response.ok) {
          throw new Error('Failed to fetch plant health metrics');
        }
        return response.json();
      },
      enabled: plants.length > 0 && !!options?.enabled,
    });
  });

  const isHealthMetricsLoading = healthMetricsQueries.some(query => query.isLoading);
  
  const healthMetrics = plants.reduce((acc, plant, index) => {
    if (healthMetricsQueries[index].data) {
      acc[plant.id] = healthMetricsQueries[index].data;
    }
    return acc;
  }, {} as Record<number, PlantHealthMetric>);

  const addPlant = useMutation({
    mutationFn: async (newPlant: any) => {
      return apiRequest('POST', '/api/plants', newPlant);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/plants'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard-stats'] });
    }
  });

  const updatePlant = useMutation({
    mutationFn: async ({ id, plant }: { id: number; plant: any }) => {
      return apiRequest('PUT', `/api/plants/${id}`, plant);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/plants'] });
      queryClient.invalidateQueries({ queryKey: ['/api/plants', variables.id, 'health'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard-stats'] });
    }
  });

  const deletePlant = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/plants/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/plants'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard-stats'] });
    }
  });

  return {
    plants,
    healthMetrics,
    isLoading: isLoading || isHealthMetricsLoading,
    error,
    addPlant,
    updatePlant,
    deletePlant,
  };
}

export function usePlantDetails(plantId: number) {
  const {
    data: plant,
    isLoading: isPlantLoading,
    error: plantError,
  } = useQuery<Plant>({
    queryKey: ['/api/plants', plantId],
    queryFn: async () => {
      const response = await fetch(`/api/plants/${plantId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch plant details');
      }
      return response.json();
    },
    enabled: !!plantId,
  });

  const {
    data: healthMetrics,
    isLoading: isHealthLoading,
    error: healthError,
  } = useQuery<PlantHealthMetric>({
    queryKey: ['/api/plants', plantId, 'health'],
    queryFn: async () => {
      const response = await fetch(`/api/plants/${plantId}/health`);
      if (!response.ok) {
        throw new Error('Failed to fetch plant health metrics');
      }
      return response.json();
    },
    enabled: !!plantId,
  });

  return {
    plant,
    healthMetrics,
    isLoading: isPlantLoading || isHealthLoading,
    error: plantError || healthError,
  };
}
