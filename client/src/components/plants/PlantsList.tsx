import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Plant, PlantHealthMetric } from "@shared/schema";
import { PlantCard } from "./PlantCard";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";

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
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold font-poppins text-textColor dark:text-foreground">My Plants</h2>
          <div className="flex items-center animate-pulse">
            <div className="h-10 w-32 bg-gray-200 dark:bg-gray-700 rounded mr-2"></div>
            <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="rounded-xl overflow-hidden shadow-natural">
              <div className="w-full h-48 bg-gray-200 dark:bg-gray-700 animate-pulse"></div>
              <div className="p-5 space-y-4">
                <div className="flex justify-between">
                  <div className="h-6 w-1/2 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  <div className="h-6 w-1/4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                </div>
                <div className="h-4 w-1/3 bg-gray-200 dark:bg-gray-700 rounded"></div>
                <div className="space-y-3">
                  {[...Array(3)].map((_, j) => (
                    <div key={j} className="flex justify-between items-center">
                      <div className="h-4 w-1/4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                      <div className="h-2 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center pt-2">
                  <div className="h-4 w-1/3 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                </div>
              </div>
            </Card>
          ))}
        </div>
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
          <Link href="/plants">
            <Button variant="link" className="text-secondary">
              View All <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
      </div>
      
      {filteredPlants.length === 0 ? (
        <div className="text-center py-8 bg-white dark:bg-card rounded-lg shadow-sm">
          <p className="text-muted-foreground">No plants found matching your filter.</p>
          <Link href="/plants/add">
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
