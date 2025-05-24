import { useState } from "react";
import { useParams, Link } from "wouter";
import { ArrowLeft, Droplet, Sun, Heart, Calendar, Edit, Trash2, AlertTriangle } from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import MobileNavigation from "@/components/layout/MobileNavigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { usePlantDetails } from "@/hooks/usePlants";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDate, formatNextWatering, getHealthStatus } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";

export default function PlantDetails() {
  const { id } = useParams();
  const plantId = parseInt(id || "0");
  const { toast } = useToast();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [, navigate] = useLocation();
  
  const { plant, healthMetrics, isLoading, error } = usePlantDetails(plantId);
  
  if (isLoading) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <main className="main-content flex-1 overflow-y-auto pb-16">
          <div className="p-6 md:p-8">
            <div className="animate-pulse">
              <div className="h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded mb-8"></div>
              <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-xl mb-6"></div>
              <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
              <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-6"></div>
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    <div className="h-2 w-48 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
        <MobileNavigation />
      </div>
    );
  }
  
  if (error || !plant) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <main className="main-content flex-1 overflow-y-auto pb-16">
          <div className="p-6 md:p-8">
            <Link href="/plants">
              <Button variant="ghost" className="mb-8">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Plants
              </Button>
            </Link>
            <Card className="bg-white dark:bg-card shadow-natural">
              <CardContent className="p-6 text-center">
                <AlertTriangle className="mx-auto h-12 w-12 text-destructive mb-4 mt-8" />
                <h2 className="text-xl font-bold font-poppins mb-2">Plant Not Found</h2>
                <p className="text-muted-foreground mb-6">
                  The plant you're looking for doesn't exist or has been removed.
                </p>
                <Link href="/plants">
                  <Button className="bg-primary hover:bg-primary-light text-white">
                    View All Plants
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </main>
        <MobileNavigation />
      </div>
    );
  }
  
  const waterLevel = healthMetrics?.waterLevel || 0;
  const lightLevel = healthMetrics?.lightLevel || 0;
  const overallHealth = healthMetrics?.overallHealth || 0;
  const healthStatus = getHealthStatus(overallHealth);
  const nextWatering = formatNextWatering(plant.lastWatered || new Date(), plant.waterFrequencyDays || 7);
  
  const handleDeletePlant = async () => {
    setIsDeleting(true);
    
    try {
      await apiRequest('DELETE', `/api/plants/${plantId}`, {});
      
      toast({
        title: "Plant deleted",
        description: "The plant has been successfully deleted.",
        variant: "default",
      });
      
      queryClient.invalidateQueries({ queryKey: ['/api/plants'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard-stats'] });
      
      navigate("/plants");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete plant. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop Sidebar */}
      <Sidebar />
      
      {/* Main Content */}
      <main className="main-content flex-1 overflow-y-auto pb-16">
        <div className="p-6 md:p-8">
          {/* Back Button */}
          <Link href="/plants">
            <Button variant="ghost" className="mb-6">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Plants
            </Button>
          </Link>
          
          {/* Plant Header */}
          <div className="bg-white dark:bg-card rounded-xl overflow-hidden shadow-natural mb-6">
            <div className="relative h-64 w-full">
              {plant.imageUrl ? (
                <img 
                  src={plant.imageUrl} 
                  alt={plant.name} 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-primary/10">
                  <Droplet className="text-primary h-24 w-24 opacity-30" />
                </div>
              )}
              <div className="absolute top-4 right-4 flex space-x-2">
                <Link href={`/plants/${plantId}/edit`}>
                  <Button variant="outline" size="icon" className="bg-white/90 dark:bg-black/50 h-10 w-10 rounded-full">
                    <Edit className="h-5 w-5" />
                  </Button>
                </Link>
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="bg-white/90 dark:bg-black/50 h-10 w-10 rounded-full text-destructive hover:text-destructive"
                  onClick={() => setIsDeleteDialogOpen(true)}
                >
                  <Trash2 className="h-5 w-5" />
                </Button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h1 className="text-2xl font-bold font-poppins text-textColor dark:text-foreground">{plant.name}</h1>
                  <p className="text-muted-foreground mt-1">{plant.species || "Unknown species"}</p>
                </div>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${healthStatus.color}`}>
                  {healthStatus.status}
                </span>
              </div>
              
              {plant.description && (
                <p className="text-textColor dark:text-foreground mb-6">{plant.description}</p>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-textColor dark:text-foreground font-medium flex items-center">
                      <Droplet className="text-secondary mr-2 h-4 w-4" /> Water Level
                    </span>
                    <ProgressBar value={waterLevel} maxValue={100} className="w-32 bg-gray-200 dark:bg-gray-700" color="bg-secondary" />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-textColor dark:text-foreground font-medium flex items-center">
                      <Sun className="text-warning mr-2 h-4 w-4" /> Light Level
                    </span>
                    <ProgressBar value={lightLevel} maxValue={100} className="w-32 bg-gray-200 dark:bg-gray-700" color="bg-warning" />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-textColor dark:text-foreground font-medium flex items-center">
                      <Heart className="text-primary mr-2 h-4 w-4" /> Overall Health
                    </span>
                    <ProgressBar 
                      value={overallHealth} 
                      maxValue={100} 
                      className="w-32 bg-gray-200 dark:bg-gray-700" 
                      color={overallHealth >= 75 ? "bg-success" : overallHealth >= 50 ? "bg-warning" : "bg-destructive"} 
                    />
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center">
                    <Calendar className="text-muted-foreground h-4 w-4 mr-2" />
                    <span className="text-sm text-muted-foreground">Acquired: </span>
                    <span className="text-sm text-textColor dark:text-foreground ml-1">
                      {plant.acquiredDate ? formatDate(plant.acquiredDate) : 'Not specified'}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <Droplet className="text-muted-foreground h-4 w-4 mr-2" />
                    <span className="text-sm text-muted-foreground">Water frequency: </span>
                    <span className="text-sm text-textColor dark:text-foreground ml-1">
                      {plant.waterFrequencyDays ? `Every ${plant.waterFrequencyDays} days` : 'Not set'}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <Sun className="text-muted-foreground h-4 w-4 mr-2" />
                    <span className="text-sm text-muted-foreground">Light preference: </span>
                    <span className="text-sm text-textColor dark:text-foreground ml-1 capitalize">
                      {plant.lightRequirement || 'Not specified'}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <Droplet className="text-muted-foreground h-4 w-4 mr-2" />
                    <span className="text-sm text-muted-foreground">Last watered: </span>
                    <span className="text-sm text-textColor dark:text-foreground ml-1">
                      {plant.lastWatered ? formatDate(plant.lastWatered) : 'Not recorded'}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <Calendar className="text-muted-foreground h-4 w-4 mr-2" />
                    <span className="text-sm text-muted-foreground">Next watering: </span>
                    <span className={`text-sm ml-1 font-medium ${nextWatering === 'Today!' ? 'text-destructive' : 'text-textColor dark:text-foreground'}`}>
                      {nextWatering}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Care History (placeholder for future implementation) */}
          <Card className="bg-white dark:bg-card shadow-natural mb-6">
            <CardContent className="p-6">
              <h2 className="text-xl font-bold font-poppins mb-4">Care History</h2>
              <p className="text-muted-foreground text-center py-6">
                No care history recorded yet for this plant.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
      
      {/* Mobile Navigation */}
      <MobileNavigation />
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-xl font-bold font-poppins">Delete Plant</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <span className="font-semibold">{plant.name}</span>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button 
              variant="outline" 
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button 
              className="bg-destructive hover:bg-destructive/90 text-white"
              onClick={handleDeletePlant}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete Plant"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
