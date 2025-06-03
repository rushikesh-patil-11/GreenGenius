import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lightbulb, Droplet, Sun, Check, RefreshCw } from "lucide-react";
import { Recommendation } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { queryClient } from "@/lib/queryClient";
import AppLoader from "@/components/ui/AppLoader";

interface AIRecommendationsProps {
  recommendations: Recommendation[];
  onApplyRecommendation: () => void;
  loading?: boolean;
}

export function AIRecommendations({ recommendations, onApplyRecommendation, loading = false }: AIRecommendationsProps) {
  const { toast } = useToast();
  const [applyingIds, setApplyingIds] = useState<number[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleApplyRecommendation = async (recommendationId: number) => {
    setApplyingIds((prev) => [...prev, recommendationId]);
    
    try {
      await apiRequest('PUT', `/api/recommendations/${recommendationId}/apply`, {});
      
      toast({
        title: "Recommendation applied",
        description: "The recommendation has been successfully applied.",
        variant: "default",
      });
      
      queryClient.invalidateQueries({ queryKey: ['/api/recommendations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/plants'] });
      
      onApplyRecommendation();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to apply recommendation. Please try again.",
        variant: "destructive",
      });
    } finally {
      setApplyingIds((prev) => prev.filter(id => id !== recommendationId));
    }
  };
  
  // Generate new AI recommendations using Gemini
  const handleGenerateRecommendations = async () => {
    setIsGenerating(true);
    
    try {
      // Default user ID (in a real app, this would come from authentication)
      const userId = 1;
      
      await apiRequest('POST', '/api/recommendations/generate', { userId });
      
      toast({
        title: "AI Recommendations Generated",
        description: "New plant care recommendations have been created using Gemini AI.",
        variant: "default",
      });
      
      queryClient.invalidateQueries({ queryKey: ['/api/recommendations'] });
      
      onApplyRecommendation(); // Refresh data
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate AI recommendations. Please try again.",
        variant: "destructive",
      });
      console.error("Error generating recommendations:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  if (loading) {
    return (
      <Card className="bg-gradient-to-r from-primary/10 to-secondary/10 shadow-natural mb-8">
        <CardContent className="p-6">
          <div className="flex items-center mb-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary mr-3">
              <Lightbulb className="text-white" />
            </div>
            <h2 className="text-xl font-bold font-poppins text-textColor dark:text-foreground">AI Care Recommendations</h2>
          </div>
          
          <div className="flex justify-center items-center py-8">
            <AppLoader 
              title="Loading AI Recommendations" 
              message="Gathering intelligent care suggestions for your plants..." 
              size="medium" 
              variant="default"
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (recommendations.length === 0) {
    return (
      <Card className="bg-gradient-to-r from-primary/10 to-secondary/10 shadow-natural mb-8">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary mr-3">
                <Lightbulb className="text-white" />
              </div>
              <h2 className="text-xl font-bold font-poppins text-textColor dark:text-foreground">AI Care Recommendations</h2>
            </div>
            
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleGenerateRecommendations}
              disabled={isGenerating}
              className="flex items-center gap-1"
            >
              <RefreshCw className={`h-4 w-4 ${isGenerating ? 'animate-spin' : ''}`} />
              {isGenerating ? 'Generating...' : 'Generate with Gemini AI'}
            </Button>
          </div>
          
          <div className="bg-white dark:bg-card rounded-lg p-6 text-center">
            <p className="text-muted-foreground mb-4">
              No recommendations available at the moment. Use Gemini AI to generate personalized care suggestions for your plants.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-r from-primary/10 to-secondary/10 shadow-natural mb-8">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary mr-3">
              <Lightbulb className="text-white" />
            </div>
            <h2 className="text-xl font-bold font-poppins text-textColor dark:text-foreground">AI Care Recommendations</h2>
          </div>
          
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleGenerateRecommendations}
            disabled={isGenerating}
            className="flex items-center gap-1"
          >
            <RefreshCw className={`h-4 w-4 ${isGenerating ? 'animate-spin' : ''}`} />
            {isGenerating ? 'Generating...' : 'Generate with Gemini AI'}
          </Button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          {recommendations.map((recommendation) => (
            <div key={recommendation.id} className="bg-white dark:bg-card rounded-lg p-4 shadow-sm">
              <div className="flex items-start">
                {recommendation.recommendationType === 'water' ? (
                  <Droplet className="text-secondary text-2xl mr-3 mt-1" />
                ) : (
                  <Sun className="text-warning text-2xl mr-3 mt-1" />
                )}
                <div>
                  <h3 className="font-poppins font-semibold text-textColor dark:text-foreground">
                    {recommendation.recommendationType === 'water' 
                      ? 'Adjust Watering Schedule' 
                      : 'Light Adjustment Needed'}
                  </h3>
                  <p className="text-muted-foreground text-sm mt-1">{recommendation.message}</p>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="mt-3 text-secondary"
                    onClick={() => handleApplyRecommendation(recommendation.id)}
                    disabled={applyingIds.includes(recommendation.id)}
                  >
                    <Check className="h-4 w-4 mr-1" /> 
                    {applyingIds.includes(recommendation.id) 
                      ? 'Applying...' 
                      : 'Apply Recommendation'}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default AIRecommendations;
