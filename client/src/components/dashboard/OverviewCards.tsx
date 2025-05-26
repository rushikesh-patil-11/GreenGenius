import { Leaf, Droplet, Heart, Calendar, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface OverviewStats {
  totalPlants: number;
  plantsNeedingWater: number;
  healthStatus: string;
  healthPercentage: number;
  upcomingTasks: number;
  newPlantsThisMonth: number;
}

interface OverviewCardsProps {
  stats?: OverviewStats;
  loading?: boolean;
}

export function OverviewCards({ stats, loading = false }: OverviewCardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="bg-white dark:bg-card shadow-natural">
            <CardContent className="p-6">
              <div className="h-24 animate-pulse flex flex-col justify-between">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2"></div>
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-2"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="bg-white dark:bg-card shadow-natural">
            <CardContent className="p-6">
              <p className="text-muted-foreground text-center py-10">No overview data available.</p>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {/* Total Plants Card */}
      <Card className="bg-white dark:bg-card shadow-natural">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm font-medium">Total Plants</p>
              <h3 className="text-3xl font-bold font-poppins mt-1 text-textColor dark:text-foreground">{stats.totalPlants}</h3>
            </div>
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
              <Leaf className="text-primary text-2xl" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-success font-medium flex items-center">
              <TrendingUp className="mr-1 h-4 w-4" /> {stats.newPlantsThisMonth} new this month
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Plants Needing Water Card */}
      <Card className="bg-white dark:bg-card shadow-natural">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm font-medium">Plants Needing Water</p>
              <h3 className="text-3xl font-bold font-poppins mt-1 text-textColor dark:text-foreground">{stats.plantsNeedingWater}</h3>
            </div>
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-secondary/10">
              <Droplet className="text-secondary text-2xl" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-warning font-medium flex items-center">
              {stats.plantsNeedingWater > 0 ? "Water within 24 hours" : "All plants watered"}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Health Status Card */}
      <Card className="bg-white dark:bg-card shadow-natural">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm font-medium">Health Status</p>
              <h3 className="text-3xl font-bold font-poppins mt-1 text-textColor dark:text-foreground">{stats.healthStatus}</h3>
            </div>
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-success/10">
              <Heart className="text-success text-2xl" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                className="bg-success rounded-full h-2" 
                style={{ width: `${stats.healthPercentage}%` }}
              ></div>
            </div>
            <span className="ml-2 text-success font-medium">{stats.healthPercentage}%</span>
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Tasks Card */}
      <Card className="bg-white dark:bg-card shadow-natural">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm font-medium">Upcoming Tasks</p>
              <h3 className="text-3xl font-bold font-poppins mt-1 text-textColor dark:text-foreground">{stats.upcomingTasks}</h3>
            </div>
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-accent/10">
              <Calendar className="text-accent text-2xl" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-muted-foreground font-medium">
              {stats.upcomingTasks > 0 
                ? `Next: ${stats.upcomingTasks} tasks pending` 
                : "No upcoming tasks"}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default OverviewCards;
