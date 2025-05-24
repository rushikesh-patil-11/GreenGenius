import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plant, PlantHealthMetric } from "@shared/schema";
import { getHealthStatus, formatNextWatering } from "@/lib/utils";
import { Droplet, Sun, Leaf, ChevronRight } from "lucide-react";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Link } from "wouter";

interface PlantCardProps {
  plant: Plant;
  healthMetrics?: PlantHealthMetric;
}

export function PlantCard({ plant, healthMetrics }: PlantCardProps) {
  const waterLevel = healthMetrics?.waterLevel || 0;
  const lightLevel = healthMetrics?.lightLevel || 0;
  const overallHealth = healthMetrics?.overallHealth || 0;
  
  const healthStatus = getHealthStatus(overallHealth);
  const nextWatering = formatNextWatering(plant.lastWatered || new Date(), plant.waterFrequencyDays || 7);
  
  return (
    <Card className="plant-card bg-white dark:bg-card rounded-xl overflow-hidden shadow-natural">
      <div className="w-full h-48 bg-gray-200 dark:bg-gray-800 overflow-hidden">
        {plant.imageUrl ? (
          <img 
            src={plant.imageUrl} 
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
          <div className="flex justify-between items-center">
            <span className="text-sm text-textColor dark:text-foreground font-medium flex items-center">
              <Droplet className="text-secondary mr-2 h-4 w-4" /> Water
            </span>
            <ProgressBar value={waterLevel} maxValue={100} className="w-32 bg-gray-200 dark:bg-gray-700" color="bg-secondary" />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-textColor dark:text-foreground font-medium flex items-center">
              <Sun className="text-warning mr-2 h-4 w-4" /> Light
            </span>
            <ProgressBar value={lightLevel} maxValue={100} className="w-32 bg-gray-200 dark:bg-gray-700" color="bg-warning" />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-textColor dark:text-foreground font-medium flex items-center">
              <Leaf className="text-primary mr-2 h-4 w-4" /> Health
            </span>
            <ProgressBar 
              value={overallHealth} 
              maxValue={100} 
              className="w-32 bg-gray-200 dark:bg-gray-700" 
              color={overallHealth >= 75 ? "bg-success" : overallHealth >= 50 ? "bg-warning" : "bg-destructive"} 
            />
          </div>
        </div>
        
        <div className="mt-5 flex items-center justify-between">
          <div className="text-sm">
            <span className="text-muted-foreground">Next water:</span>
            <span 
              className={`font-medium ml-1 ${nextWatering === 'Today!' ? 'text-destructive' : 'text-textColor dark:text-foreground'}`}
            >
              {nextWatering}
            </span>
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
