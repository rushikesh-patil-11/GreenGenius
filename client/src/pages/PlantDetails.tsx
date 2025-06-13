import { useState, useEffect, ElementType } from "react";
import { useParams, Link, useLocation } from "wouter";
import { ArrowLeft, Droplet, Sun, Heart, Edit, Trash2, AlertTriangle, Sparkles, RefreshCcw, Globe, Info, BookOpen, ClipboardList, AlertCircle, Leaf as LeafIcon, Thermometer, Scissors, ShieldCheck, Zap, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AppLoader from "@/components/ui/AppLoader";
import Sidebar from "@/components/layout/Sidebar";
import MobileNavigation from "@/components/layout/MobileNavigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { usePlantDetails } from "@/hooks/usePlants";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDate, formatNextWatering, getHealthStatus } from "@/lib/utils";
import { apiRequest } from "@/lib/apiRequest";
import { queryClient } from "@/lib/queryClient";

// Types for Perenual API Data
interface PerenualImage {
  image_id: number;
  license: number;
  license_name: string;
  license_url: string;
  original_url: string;
  regular_url: string;
  medium_url: string;
  small_url: string;
  thumbnail: string;
}

interface PerenualPlant {
  id: number;
  common_name: string;
  scientific_name: string[];
  other_name?: string[];
  family?: string | null;
  origin?: string[] | null;
  type?: string;
  dimension?: string;
  cycle?: string;
  attracts?: string[];
  propagation?: string[];
  hardiness?: { min: string; max: string };
  hardiness_location?: { full_url: string; full_iframe: string };
  watering?: string;
  watering_general_benchmark?: { value: string; unit: string };
  sunlight?: string[] | string;
  maintenance?: string | null;
  care_guides?: string; // URL to care guides
  soil?: string[];
  growth_rate?: string;
  drought_tolerant?: boolean;
  salt_tolerant?: boolean;
  thorny?: boolean;
  invasive?: boolean;
  tropical?: boolean;
  cuisine?: boolean;
  indoor?: boolean;
  flowers?: boolean;
  flower_color?: string;
  cones?: boolean;
  fruits?: boolean;
  edible_fruit?: boolean;
  fruit_color?: string[];
  fruiting_season?: string;
  harvest_season?: string;
  leaf?: boolean;
  leaf_color?: string[];
  edible_leaf?: boolean;
  medicinal?: boolean;
  poisonous_to_humans?: number; // 0 or 1 typically
  poisonous_to_pets?: number; // 0 or 1 typically
  description?: string;
  default_image?: PerenualImage;
  problem?: string | null;
  pruning_month?: string[];
  // Add any other fields you anticipate or find in the API response
}

// Interface for items within tab content sections
interface TabDetailItem {
  label: string;
  value?: string | boolean | null; // Optional, as links might not use it directly
  type?: 'link';                   // Optional, only for link items
  href?: string | null;            // Optional, only for link items
}

interface TabConfig {
  value: string;
  title: string;
  icon: ElementType;
  content: TabDetailItem[];
}

interface PerenualApiResponse {
  data: PerenualPlant[];
  to: number;
  per_page: number;
  current_page: number;
  from: number;
  last_page: number;
  total: number;
}

export default function PlantDetails() {
  const { id } = useParams();
  const plantId = parseInt(id || "0");
  const { toast } = useToast();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [location, navigate] = useLocation();
  const [aiCareTips, setAiCareTips] = useState<Array<{ category: string; tip: string }>>([]);
  const [isFetchingTips, setIsFetchingTips] = useState(false);
  const [tipsError, setTipsError] = useState<string | null>(null);

  // State for Perenual API plant details
  const [perenualPlantDetails, setPerenualPlantDetails] = useState<PerenualPlant | null>(null);
  const [isFetchingPerenualDetails, setIsFetchingPerenualDetails] = useState(false);
  const [perenualDetailsError, setPerenualDetailsError] = useState<string | null>(null);
  
  const { plant, healthMetrics, isLoading, error } = usePlantDetails(plantId);
  
  useEffect(() => {
    const loadSavedAiCareTips = async () => {
      if (!plantId || plantId === 0) {
        setAiCareTips([]); // Clear tips if plantId is invalid or not yet available
        return;
      }

      setIsFetchingTips(true);
      setTipsError(null);
      try {
        // Make a GET request to fetch previously saved tips
        const savedTips = await apiRequest<{ category: string; tip: string; }[]>(
          `/api/plants/${plantId}/ai-care-tips`, 
          { method: 'GET' }
        );
        setAiCareTips(savedTips || []); // Handle null/undefined response by setting to empty array
      } catch (err: any) {
        console.error("Failed to load saved AI care tips:", err);
        setAiCareTips([]); // Set to empty if there's an error (e.g., 404 if no tips yet)
        // You could set a non-critical error message if needed, e.g.,
        // setTipsError("Could not retrieve existing AI tips. Try generating new ones.");
      } finally {
        setIsFetchingTips(false);
      }
    };

    // Only fetch tips if the main plant data is loaded and valid
    if (plantId && plant && !isLoading) {
      loadSavedAiCareTips();
    } else if (!isLoading && !plant && plantId > 0) {
      // If plant loading is finished but the plant itself wasn't found, clear tips.
      setAiCareTips([]);
    }
  }, [plantId, plant, isLoading]); // Dependencies: re-run if these change

  // useEffect to fetch details from Perenual API when plant.name is available
  useEffect(() => {
    const fetchDetailsFromPerenual = async () => {
      if (plant && plant.perenual_id) { // Use perenual_id for fetching
        setIsFetchingPerenualDetails(true);
        setPerenualDetailsError(null);
        setPerenualPlantDetails(null); // Reset on new fetch
        try {
          const response = await apiRequest<PerenualPlant>(
            `/api/perenual-details/${plant.perenual_id}`, // Use the new endpoint with perenual_id
            { method: 'GET' }
          );
          if (response) {
            setPerenualPlantDetails(response); // Store the plant object directly
          } else {
            // No specific error, just means no data from Perenual for this plant name
            // console.log("No details found in Perenual for:", plant.name);
            setPerenualPlantDetails(null);
          }
        } catch (err: any) {
          console.error("Failed to fetch plant details from Perenual API:", err);
          setPerenualDetailsError(err.message || "Could not load additional details from external database.");
          setPerenualPlantDetails(null);
        } finally {
          setIsFetchingPerenualDetails(false);
        }
      }
    };

    if (plant && !isLoading && plantId > 0) { // Ensure primary plant data is loaded and plantId is valid
      fetchDetailsFromPerenual();
    } else if (!isLoading && !plant && plantId > 0) {
      // If plant loading is finished but the plant itself wasn't found, clear Perenual details too.
      setPerenualPlantDetails(null);
      setIsFetchingPerenualDetails(false);
      setPerenualDetailsError(null);
    }
  }, [plant, isLoading, plantId]); // Re-run if plant data or plantId changes

  if (isLoading) {
    return (
      <div className="container py-12 flex justify-center items-center min-h-[50vh]">
        <AppLoader 
          title="Loading Plant Details" 
          message="Gathering information about your plant..." 
          size="large" 
          variant="default"
        />
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
      // Corrected apiRequest call for DELETE
      await apiRequest(`/api/plants/${plant.id}`, { method: 'DELETE' });
      
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

  const fetchAiCareTips = async () => {
    if (!plant) return;
    setIsFetchingTips(true);
    setTipsError(null);
    setAiCareTips([]); // Clear previous tips

    try {
      const tips = await apiRequest<{ category: string; tip: string; }[]>(`/api/plants/${plantId}/ai-care-tips`, { method: 'POST', data: {} });
      setAiCareTips(tips);
    } catch (err: any) {
      console.error("Failed to fetch AI care tips:", err);
      setTipsError(err.message || "Could not load AI-powered care tips. Please try again.");
    } finally {
      setIsFetchingTips(false);
    }
  };

  // Determine the best image URL to use
  const getPlantImageUrl = () => {
    if (perenualPlantDetails?.default_image?.original_url) return perenualPlantDetails.default_image.original_url;
    if (perenualPlantDetails?.default_image?.regular_url) return perenualPlantDetails.default_image.regular_url;
    if (perenualPlantDetails?.default_image?.medium_url) return perenualPlantDetails.default_image.medium_url;
    if (plant?.api_image_url) return plant.api_image_url;
    return "/placeholder.svg"; // Fallback placeholder
  };

  const tabsConfigData: TabConfig[] = [
    { value: "overview", title: "Plant Overview", icon: Info, content: [
      { label: "Description", value: perenualPlantDetails?.description },
      { label: "Family", value: perenualPlantDetails?.family },
      { label: "Type", value: perenualPlantDetails?.type },
      { label: "Dimensions", value: perenualPlantDetails?.dimension },
      { label: "Other Names", value: perenualPlantDetails?.other_name?.join(', ') },
    ]},
    { value: "care", title: "Care Guide", icon: BookOpen, content: [
      { label: "Watering Needs", value: perenualPlantDetails?.watering },
      { label: "Watering Benchmark", value: perenualPlantDetails?.watering_general_benchmark ? `${perenualPlantDetails.watering_general_benchmark.value} ${perenualPlantDetails.watering_general_benchmark.unit}` : null },
      { label: "Sunlight", value: Array.isArray(perenualPlantDetails?.sunlight) ? perenualPlantDetails.sunlight.join(', ') : perenualPlantDetails?.sunlight },
      { label: "Soil", value: perenualPlantDetails?.soil?.join(', ') },
      { label: "Maintenance", value: perenualPlantDetails?.maintenance },
      { label: "Pruning Months", value: perenualPlantDetails?.pruning_month?.join(', ') },
      { label: "Hardiness Zone", value: perenualPlantDetails?.hardiness ? `${perenualPlantDetails.hardiness.min} - ${perenualPlantDetails.hardiness.max}` : null },
      { type: "link" as const, label: "External Care Guide", href: perenualPlantDetails?.care_guides },
    ]},
    { value: "characteristics", title: "Characteristics", icon: LeafIcon, content: [
      { label: "Growth Rate", value: perenualPlantDetails?.growth_rate },
      { label: "Drought Tolerant", value: perenualPlantDetails?.drought_tolerant ? 'Yes' : 'No' },
      { label: "Salt Tolerant", value: perenualPlantDetails?.salt_tolerant ? 'Yes' : 'No' },
      { label: "Indoor Plant", value: perenualPlantDetails?.indoor ? 'Yes' : 'No' },
      { label: "Flowers", value: perenualPlantDetails?.flowers ? `Yes (${perenualPlantDetails.flower_color || 'color not specified'})` : 'No' },
      { label: "Fruits", value: perenualPlantDetails?.fruits ? `Yes (Edible: ${perenualPlantDetails.edible_fruit ? 'Yes' : 'No'})` : 'No' },
      { label: "Thorny", value: perenualPlantDetails?.thorny ? 'Yes' : 'No' },
      { label: "Invasive", value: perenualPlantDetails?.invasive ? 'Yes' : 'No' },
      { label: "Tropical", value: perenualPlantDetails?.tropical ? 'Yes' : 'No' },
      { label: "Cuisine Use", value: perenualPlantDetails?.cuisine ? 'Yes' : 'No' },
    ]},
    { value: "healthSafety", title: "Health & Safety", icon: ShieldCheck, content: [
      { label: "Poisonous to Humans", value: perenualPlantDetails?.poisonous_to_humans === 1 ? 'Yes' : perenualPlantDetails?.poisonous_to_humans === 0 ? 'No' : 'N/A' },
      { label: "Poisonous to Pets", value: perenualPlantDetails?.poisonous_to_pets === 1 ? 'Yes' : perenualPlantDetails?.poisonous_to_pets === 0 ? 'No' : 'N/A' },
      { label: "Medicinal", value: perenualPlantDetails?.medicinal ? 'Yes' : 'No' },
      { label: "Known Problems", value: perenualPlantDetails?.problem },
    ]}
  ];

  const plantImageUrl = getPlantImageUrl();

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-background to-background-muted dark:from-gray-900 dark:to-gray-800">
      <Sidebar />
      <main className="main-content flex-1 overflow-y-auto pb-16 font-sans">
        <div className="p-4 md:p-8 max-w-5xl mx-auto">
          <Link href="/plants" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6 group">
            <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
            Back to Plants
          </Link>

          {/* Hero Section */}
          <div className="relative rounded-xl overflow-hidden shadow-2xl mb-8 bg-card dark:bg-gray-800/50">
            <div className="aspect-[16/9] md:aspect-[21/9] w-full">
              {isFetchingPerenualDetails && plantImageUrl === "/placeholder.svg" ? (
                <div className="w-full h-full flex items-center justify-center bg-gray-300 dark:bg-gray-700 animate-pulse">
                  <LeafIcon className="h-16 w-16 text-gray-400 dark:text-gray-500" />
                </div>
              ) : (
                <img
                  src={plantImageUrl}
                  alt={perenualPlantDetails?.common_name || plant.name}
                  className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                />
              )}
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent"></div>
            <div className="absolute bottom-0 left-0 p-6 md:p-8 w-full">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-1 tracking-tight font-poppins">
                {perenualPlantDetails?.common_name || plant.name}
              </h1>
              <p className="text-md sm:text-lg text-gray-300 italic">
                {perenualPlantDetails?.scientific_name?.join(', ') || 'Scientific name not available'}
              </p>
            </div>            <div className="absolute top-4 right-4">
              <Button
                variant="destructive"
                size="icon"
                className="rounded-full h-10 w-10 shadow-md hover:bg-destructive/90"
                onClick={() => setIsDeleteDialogOpen(true)}
                title="Delete Plant"
              >
                <Trash2 className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Quick Info Bar */}
          <Card className="mb-8 shadow-lg bg-card dark:bg-gray-800/50">
            <CardContent className="p-4 md:p-6">
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 text-sm">
                {[ 
                  { icon: Droplet, label: "Watering", value: perenualPlantDetails?.watering, color: "text-blue-500 dark:text-blue-400" },
                  { icon: Sun, label: "Sunlight", value: Array.isArray(perenualPlantDetails?.sunlight) ? perenualPlantDetails.sunlight.join(', ') : perenualPlantDetails?.sunlight, color: "text-yellow-500 dark:text-yellow-400" },
                  { icon: RefreshCcw, label: "Cycle", value: perenualPlantDetails?.cycle, color: "text-green-500 dark:text-green-400" },
                  { icon: Globe, label: "Origin", value: perenualPlantDetails?.origin?.join(', '), color: "text-purple-500 dark:text-purple-400" }
                ].map((item, index) => (
                  item.value && (
                    <div key={index} className="flex items-center space-x-3 p-3 bg-background/50 dark:bg-gray-700/30 rounded-lg">
                      <item.icon className={`h-6 w-6 ${item.color}`} />
                      <div>
                        <p className="font-semibold text-foreground dark:text-gray-200">{item.label}</p>
                        <p className="text-muted-foreground dark:text-gray-400 capitalize">{item.value}</p>
                      </div>
                    </div>
                  )
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Tabs for Detailed Information */}
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 mb-6 bg-card dark:bg-gray-800/50 p-1 rounded-lg shadow">
              <TabsTrigger value="overview" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-muted/50 dark:hover:bg-gray-700/50 rounded-md transition-all">Overview</TabsTrigger>
              <TabsTrigger value="care" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-muted/50 dark:hover:bg-gray-700/50 rounded-md transition-all">Care Guide</TabsTrigger>
              <TabsTrigger value="characteristics" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-muted/50 dark:hover:bg-gray-700/50 rounded-md transition-all">Characteristics</TabsTrigger>
              <TabsTrigger value="healthSafety" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-muted/50 dark:hover:bg-gray-700/50 rounded-md transition-all">Health & Safety</TabsTrigger>
              <TabsTrigger value="aiTips" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-muted/50 dark:hover:bg-gray-700/50 rounded-md transition-all">AI Tips</TabsTrigger>
            </TabsList>

            {tabsConfigData.map(tab => (
              <TabsContent key={tab.value} value={tab.value}>
                <Card className="shadow-lg bg-card dark:bg-gray-800/50">
                  <CardContent className="p-6">
                    <div className="flex items-center mb-6">
                      <tab.icon className="h-6 w-6 mr-3 text-primary" />
                      <h3 className="text-2xl font-semibold font-poppins text-foreground dark:text-gray-100">{tab.title}</h3>
                    </div>
                    <div className="space-y-3 text-sm">
                      {tab.content.map((item: TabDetailItem, idx: number) => (
                        item.value && (
                          <div key={idx} className="grid grid-cols-1 md:grid-cols-3 gap-1 items-start">
                            <p className="font-medium text-muted-foreground dark:text-gray-400 md:col-span-1">{item.label}:</p>
                            <p className="text-foreground dark:text-gray-200 md:col-span-2 capitalize">
                              {item.type === 'link' && item.href ? (
                                <Button variant="link" asChild className="p-0 h-auto text-primary hover:underline">
                                  <a href={item.href} target="_blank" rel="noopener noreferrer">View Guide</a>
                                </Button>
                              ) : item.value}
                            </p>
                          </div>
                        )
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            ))}

            <TabsContent value="aiTips">
              <Card className="shadow-lg bg-card dark:bg-gray-800/50">
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 gap-4">
                    <div className="flex items-center">
                      <Zap className="h-6 w-6 mr-3 text-primary" />
                      <h3 className="text-2xl font-semibold font-poppins text-foreground dark:text-gray-100">AI Powered Care Tips</h3>
                    </div>
                    <Button onClick={fetchAiCareTips} disabled={isFetchingTips} size="sm" className="bg-accent hover:bg-accent-hover text-accent-foreground min-w-[150px]">
                      {isFetchingTips ? (
                        <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="mr-2 h-4 w-4" />
                      )}
                      {isFetchingTips ? "Generating..." : aiCareTips.length > 0 ? "Regenerate Tips" : "Generate Tips"}
                    </Button>
                  </div>
                  {isFetchingTips && (
                    <div className="flex justify-center items-center py-8">
                      <Loader2 className="h-8 w-8 text-primary animate-spin" />
                      <p className="ml-2 text-muted-foreground">Fetching tips...</p>
                    </div>
                  )}

                  {tipsError && (
                    <div className="text-destructive bg-destructive/10 p-4 rounded-md text-sm">
                      <AlertTriangle className="inline-block h-4 w-4 mr-2 align-middle" />
                      Error: {tipsError}
                    </div>
                  )}

                  {aiCareTips.length > 0 ? (
                    <ul className="space-y-4">
                      {aiCareTips.map((tip, index) => (
                        <li key={index} className="p-4 bg-background/50 dark:bg-gray-700/30 rounded-lg shadow-sm border-l-4 border-primary">
                          <strong className="font-semibold text-primary capitalize block mb-1">{tip.category}:</strong> 
                          <p className="text-muted-foreground dark:text-gray-300">{tip.tip}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    !isFetchingTips && !tipsError && (
                      <div className="text-center py-8 text-muted-foreground dark:text-gray-400">
                        <ClipboardList className="mx-auto h-10 w-10 mb-3 opacity-50" />
                        <p>No AI care tips available yet. Click the button above to generate them!</p>
                      </div>
                    )
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Delete Confirmation Dialog (preserved) */}
          <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <DialogContent className="bg-card dark:bg-gray-800">
              <DialogHeader>
                <DialogTitle className="text-foreground dark:text-gray-100">Are you sure you want to delete this plant?</DialogTitle>
                <DialogDescription className="text-muted-foreground dark:text-gray-400">
                  This action cannot be undone. This will permanently delete "{plant.name}" 
                  and all its associated data.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="mt-4">
                <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} disabled={isDeleting} className="dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700">
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleDeletePlant} disabled={isDeleting}>
                  {isDeleting ? <RefreshCcw className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />} 
                  {isDeleting ? "Deleting..." : "Delete Plant"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

        </div> 
      </main>
      <MobileNavigation />
    </div>
  );
}
