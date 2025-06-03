import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plant, PlantHealthMetric } from "@shared/schema";
import { getHealthStatus, formatNextWatering } from "@/lib/utils";
import { Droplet, Sun, Calendar, ChevronRight, Clock, Leaf, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";

interface PlantCardProps {
  plant: Plant;
  healthMetrics?: PlantHealthMetric;
}

export function PlantCard({ plant }: PlantCardProps) {
  // Get actual status directly from plant data
  const status = plant.status || "healthy";
  const healthStatus = getHealthStatus(status === "healthy" ? 100 : status === "needs_attention" ? 50 : 25);
  
  // Calculate next watering based on last watered date and frequency
  const nextWatering = formatNextWatering(plant.lastWatered || new Date(), plant.waterFrequencyDays || 7);
  
  // Calculate how long the plant has been in your collection
  const plantAge = plant.acquiredDate ? formatDistanceToNow(new Date(plant.acquiredDate), { addSuffix: false }) : "Unknown";
  
  return (
    <Card className="plant-card bg-white dark:bg-card rounded-xl overflow-hidden shadow-natural">
      <div className="w-full h-48 bg-gray-200 dark:bg-gray-800 overflow-hidden">
        {plant.api_image_url ? (
          <img 
            src={plant.api_image_url} 
            alt={plant.name} 
            className="w-full h-48 object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-primary/10">
            <Leaf className="text-primary h-16 w-16 opacity-30" />
          </div>
        )}
      </div>
      <CardContent className="p-5">
        <div className="flex justify-between items-center">
          <h3 className="font-poppins font-semibold text-lg text-textColor dark:text-foreground">{plant.name}</h3>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${healthStatus.color}`}>
            {healthStatus.status}
          </span>
        </div>
        <p className="text-muted-foreground text-sm mt-1">{plant.species || "Unknown species"}</p>
        
        <div className="mt-4 space-y-3">
          <div className="flex justify-between items-center py-1 border-b border-gray-100 dark:border-gray-800">
            <span className="text-sm text-textColor dark:text-foreground font-medium flex items-center">
              <Droplet className="text-secondary mr-2 h-4 w-4" /> Water Needs
            </span>
            <span className="text-sm text-muted-foreground">
              {plant.watering_general_benchmark && typeof plant.watering_general_benchmark === 'object' && 'value' in plant.watering_general_benchmark && 'unit' in plant.watering_general_benchmark ? 
                `${plant.watering_general_benchmark.value} ${plant.watering_general_benchmark.unit}` : 
                plant.waterFrequencyDays ? `Every ${plant.waterFrequencyDays} days` : "Unknown"}
            </span>
          </div>
          
          <div className="flex justify-between items-center py-1 border-b border-gray-100 dark:border-gray-800">
            <span className="text-sm text-textColor dark:text-foreground font-medium flex items-center">
              <Sun className="text-warning mr-2 h-4 w-4" /> Light Preference
            </span>
            <span className="text-sm text-muted-foreground">
              {plant.sunlight && plant.sunlight.length > 0 ? 
                plant.sunlight[0] : "Not specified"}
            </span>
          </div>
          
          <div className="flex justify-between items-center py-1 border-b border-gray-100 dark:border-gray-800">
            <span className="text-sm text-textColor dark:text-foreground font-medium flex items-center">
              <Sparkles className="text-primary mr-2 h-4 w-4" /> Care Level
            </span>
            <span className="text-sm text-muted-foreground">
              {plant.care_level || "Standard"}
            </span>
          </div>
          
          <div className="flex justify-between items-center py-1">
            <span className="text-sm text-textColor dark:text-foreground font-medium flex items-center">
              <Calendar className="text-success mr-2 h-4 w-4" /> In Collection
            </span>
            <span className="text-sm text-muted-foreground">
              {plantAge}
            </span>
          </div>
        </div>
        
        <div className="mt-5 flex items-center justify-between bg-gray-50 dark:bg-gray-900 p-2 rounded-lg">
          <div className="flex items-center">
            <Clock className="h-4 w-4 text-secondary mr-2" />
            <div className="text-sm">
              <span className="text-muted-foreground">Water </span>
              <span 
                className={`font-medium ${nextWatering === 'Today!' ? 'text-destructive' : 'text-textColor dark:text-foreground'}`}
              >
                {nextWatering}
              </span>
            </div>
          </div>
          <Link href={`/plants/${plant.id}`}>
            <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full bg-primary/10 text-primary hover:bg-primary/20">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default PlantCard;
