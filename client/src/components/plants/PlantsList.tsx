import { useState, useEffect } from "react";
import { ChevronRight } from "lucide-react";
import { Link } from "wouter";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlantCard } from "@/components/plants/PlantCard";
import AppLoader from "@/components/ui/AppLoader";
import type { Plant, PlantHealthMetric } from "@shared/schema";

interface PlantsListProps {
  plants: Plant[];
  healthMetrics: Record<number, PlantHealthMetric>;
  loading?: boolean;
}

export function PlantsList({ plants, healthMetrics, loading = false }: PlantsListProps) {
  const [filter, setFilter] = useState("all");
  const [filteredPlants, setFilteredPlants] = useState<Plant[]>(plants);

  useEffect(() => {
    if (filter === "all") {
      setFilteredPlants(plants);
    } else if (filter === "needs-attention") {
      setFilteredPlants(
        plants.filter((plant) => {
          const health = healthMetrics[plant.id]?.overallHealth || 0;
          return health < 75;
        })
      );
    } else if (filter === "healthy") {
      setFilteredPlants(
        plants.filter((plant) => {
          const health = healthMetrics[plant.id]?.overallHealth || 0;
          return health >= 75;
        })
      );
    }
  }, [filter, plants, healthMetrics]);

  if (loading) {
    return (
      <div className="mb-8 flex flex-col items-center justify-center py-12">
        <AppLoader 
          title="Loading Your Garden" 
          message="Fetching your plants and their health data..." 
          size="large" 
          variant="default"
        />
      </div>
    );
  }

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold font-poppins text-textColor dark:text-foreground">My Plants</h2>
        <div className="flex items-center">
          <div className="relative mr-2">
            <Select
              value={filter}
              onValueChange={(value) => setFilter(value)}
            >
              <SelectTrigger className="w-[180px] bg-white dark:bg-card border border-gray-200 dark:border-gray-800 rounded-lg">
                <SelectValue placeholder="All Plants" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Plants</SelectItem>
                <SelectItem value="needs-attention">Need Attention</SelectItem>
                <SelectItem value="healthy">Healthy</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Link to="/plants">
            <Button variant="link" className="text-secondary">
              View All <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
      </div>
      
      {filteredPlants.length === 0 ? (
        <div className="text-center py-8 bg-white dark:bg-card rounded-lg shadow-sm">
          <p className="text-muted-foreground">No plants found matching your filter.</p>
          <Link to="/plants/add">
            <Button className="mt-4 bg-primary hover:bg-primary-light text-white">
              Add Your First Plant
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPlants.map((plant) => (
            <PlantCard
              key={plant.id}
              plant={plant}
              healthMetrics={healthMetrics[plant.id]}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default PlantsList;
