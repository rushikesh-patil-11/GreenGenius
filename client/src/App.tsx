import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/hooks/useTheme";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import Plants from "@/pages/Plants";
import CareSchedulePage from "@/pages/CareSchedulePage";
import PlantDetails from "@/pages/PlantDetails";
import AIRecommendationsPage from "@/pages/AIRecommendationsPage";
import Landing from "@/pages/Landing";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/plants" component={Plants} />
      <Route path="/plants/:id" component={PlantDetails} />
      <Route path="/schedule" component={CareSchedulePage} />
      <Route path="/recommendations" component={AIRecommendationsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
