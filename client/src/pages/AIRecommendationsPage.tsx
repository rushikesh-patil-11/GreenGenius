import { useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import MobileNavigation from "@/components/layout/MobileNavigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Droplet, Sun, Check, Lightbulb } from "lucide-react";
import { useEnvironment } from "@/hooks/useEnvironment";
import { usePlants } from "@/hooks/usePlants";
import { Recommendation } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export default function AIRecommendationsPage() {
  const userId = 1; // In a real app, this would come from authentication
  const { toast } = useToast();
  const [applyingIds, setApplyingIds] = useState<number[]>([]);
  
  const { recommendations, isLoading, applyRecommendation } = useEnvironment(userId);
  const { plants, isLoading: isPlantsLoading } = usePlants(userId);
  
  const getPlantName = (plantId?: number) => {
    if (!plantId) return "All Plants";
    const plant = plants.find(p => p.id === plantId);
    return plant ? plant.name : 'Unknown Plant';
  };
  
  const handleApplyRecommendation = async (recommendationId: number) => {
    setApplyingIds(prev => [...prev, recommendationId]);
    
    try {
      await applyRecommendation.mutateAsync(recommendationId);
      
      toast({
        title: "Recommendation applied",
        description: "The recommendation has been successfully applied.",
        variant: "default",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to apply recommendation. Please try again.",
        variant: "destructive",
      });
    } finally {
      setApplyingIds(prev => prev.filter(id => id !== recommendationId));
    }
  };
  
  const renderRecommendationCard = (recommendation: Recommendation) => {
    return (
      <Card key={recommendation.id} className="bg-white dark:bg-card shadow-natural">
        <CardContent className="p-6">
          <div className="flex items-start">
            {recommendation.recommendationType === 'water' ? (
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-secondary/10 shrink-0 mr-4">
                <Droplet className="text-secondary text-2xl" />
              </div>
            ) : (
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-warning/10 shrink-0 mr-4">
                <Sun className="text-warning text-2xl" />
              </div>
            )}
            <div className="flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2">
                <h3 className="font-poppins font-semibold text-lg text-textColor dark:text-foreground">
                  {recommendation.recommendationType === 'water' 
                    ? 'Watering Adjustment' 
                    : 'Light Adjustment'}
                </h3>
                <span className="text-muted-foreground text-sm">
                  For: {getPlantName(recommendation.plantId)}
                </span>
              </div>
              <p className="text-textColor dark:text-foreground mb-4">{recommendation.message}</p>
              <Button 
                className="bg-primary hover:bg-primary-light text-white"
                onClick={() => handleApplyRecommendation(recommendation.id)}
                disabled={applyingIds.includes(recommendation.id)}
              >
                <Check className="mr-2 h-4 w-4" />
                {applyingIds.includes(recommendation.id) 
                  ? 'Applying...' 
                  : 'Apply Recommendation'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop Sidebar */}
      <Sidebar />
      
      {/* Main Content */}
      <main className="main-content flex-1 overflow-y-auto pb-16">
        <div className="p-6 md:p-8">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-2xl md:text-3xl font-bold font-poppins text-textColor dark:text-foreground">
              AI Recommendations
            </h1>
            <p className="text-muted-foreground mt-1">
              Smart care suggestions for your plants based on environmental conditions
            </p>
          </div>
          
          {/* Recommendations */}
          {isLoading || isPlantsLoading ? (
            <div className="space-y-6">
              {[...Array(3)].map((_, i) => (
                <Card key={i} className="bg-white dark:bg-card shadow-natural">
                  <CardContent className="p-6">
                    <div className="animate-pulse flex space-x-4">
                      <div className="rounded-full bg-gray-200 dark:bg-gray-700 h-12 w-12"></div>
                      <div className="flex-1 space-y-4 py-1">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                        <div className="space-y-2">
                          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
                        </div>
                        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : recommendations.length === 0 ? (
            <Card className="bg-white dark:bg-card shadow-natural">
              <CardContent className="p-8 text-center">
                <Lightbulb className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
                <h2 className="text-xl font-bold font-poppins mb-2">No Recommendations</h2>
                <p className="text-muted-foreground max-w-md mx-auto mb-6">
                  We don't have any care recommendations for you right now. Update your environment readings to get personalized suggestions.
                </p>
                <Button 
                  className="bg-primary hover:bg-primary-light text-white"
                  onClick={() => window.location.href = "/"}
                >
                  Go to Dashboard
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-6">
                {recommendations.map(recommendation => renderRecommendationCard(recommendation))}
              </div>
            </div>
          )}
        </div>
      </main>
      
      {/* Mobile Navigation */}
      <MobileNavigation />
    </div>
  );
}
