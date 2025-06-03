import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import MobileNavigation from "@/components/layout/MobileNavigation";
import { PlantCard } from "@/components/plants/PlantCard";
import AddPlantModal from "@/components/modals/AddPlantModal";
import { usePlants } from "@/hooks/usePlants";
import AppLoader from "@/components/ui/AppLoader";
import { Input } from "@/components/ui/input";
import { useAuth } from "@clerk/clerk-react";
import { queryClient } from "@/lib/queryClient";
import type { Plant } from "@shared/schema";

export default function Plants() {
  const userId = 1; // In a real app, this would come from authentication
  const [isAddPlantModalOpen, setIsAddPlantModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  const { plants, healthMetrics, isLoading } = usePlants({ enabled: !!userId });
  
  const handleAddPlant = (newPlant: Plant) => {
    queryClient.invalidateQueries({ queryKey: ['/api/plants'] });
    console.log('Plant added in PlantsPage:', newPlant);
  };
  
  const handleOpenAddPlantModal = () => {
    setIsAddPlantModalOpen(true);
  };
  
  // Search plants
  const filteredPlants = plants.filter(plant => {
    // Apply search filter
    const matchesSearch = plant.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         (plant.species || "").toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesSearch;
  });

  if (isLoading) {
    return (
      <div className="container py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">My Plants</h1>
          <Button 
            className="bg-primary hover:bg-primary-light text-white"
            onClick={handleOpenAddPlantModal}
          >
            <Plus className="mr-2 h-4 w-4" /> Add Plant
          </Button>
        </div>
        <div className="flex justify-center items-center py-12">
          <AppLoader 
            title="Loading Your Garden" 
            message="Gathering information about your plants..." 
            size="large" 
            variant="default"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop Sidebar */}
      <Sidebar />
      
      {/* Main Content */}
      <main className="main-content flex-1 overflow-y-auto pb-16">
        <div className="p-6 md:p-8">
          {/* Page Header */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold font-poppins text-textColor dark:text-foreground">
                My Plants
              </h1>
              <p className="text-muted-foreground mt-1">
                Manage and track all your plants in one place
              </p>
            </div>
            <div className="mt-4 md:mt-0">
              <Button 
                className="bg-primary hover:bg-primary-light text-white"
                onClick={handleOpenAddPlantModal}
              >
                <Plus className="h-4 w-4 mr-2" />
                <span>Add Plant</span>
              </Button>
            </div>
          </div>
          
          {/* Search */}
          <div className="flex mb-6">
            <div className="relative flex-1">
              <Input
                placeholder="Search plants..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <path d="m21 21-4.3-4.3"></path>
                </svg>
              </div>
            </div>
          </div>
          
          {/* Plants Grid */}
          {filteredPlants.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-card rounded-lg shadow-natural">
              {searchQuery ? (
                <>
                  <h3 className="text-lg font-poppins font-semibold mb-2">No plants found</h3>
                  <p className="text-muted-foreground mb-6">No plants match your search criteria.</p>
                  <Button 
                    variant="outline" 
                    onClick={() => setSearchQuery("")}
                  >
                    Clear Search
                  </Button>
                </>
              ) : (
                <>
                  <h3 className="text-lg font-poppins font-semibold mb-2">No plants yet</h3>
                  <p className="text-muted-foreground mb-6">Add your first plant to get started.</p>
                  <Button 
                    className="bg-primary hover:bg-primary-light text-white"
                    onClick={handleOpenAddPlantModal}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    <span>Add Your First Plant</span>
                  </Button>
                </>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPlants.map((plant) => (
                <PlantCard
                  key={plant.id}
                  plant={plant}
                />
              ))}
            </div>
          )}
        </div>
      </main>
      
      {/* Mobile Navigation */}
      <MobileNavigation />
      
      {/* Add Plant Modal */}
      <AddPlantModal 
        isOpen={isAddPlantModalOpen}
        onClose={() => setIsAddPlantModalOpen(false)}
        onAddPlant={handleAddPlant}
      />
    </div>
  );
}
