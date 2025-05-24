import { Switch, Route, Redirect, useLocation } from "wouter";
import React from 'react';
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
import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
  useUser,
} from "@clerk/clerk-react";

const ProtectedRoute: React.FC<{ component: React.ComponentType<any>; path: string }> = ({ component: Component, path, ...rest }) => {
  const { isSignedIn, isLoaded } = useUser();

  if (!isLoaded) {
    // You can render a loading spinner or some placeholder here
    return <div>Loading authentication status...</div>;
  }

  if (!isSignedIn) {
    // If not signed in, redirect to the landing page
    return <Redirect to="/" />;
  }

  // If signed in, render the component for the given path
  return <Route path={path} component={Component} {...rest} />;
};

const LandingPageOrRedirect: React.FC = () => {
  const { isSignedIn, isLoaded } = useUser();
  const [, navigate] = useLocation(); // location is not used, so it can be omitted or named with _

  React.useEffect(() => {
    if (isLoaded && isSignedIn) {
      navigate("/dashboard", { replace: true });
    }
  }, [isLoaded, isSignedIn, navigate]);

  if (!isLoaded) {
    return <div>Loading authentication status...</div>; // Or a proper loader
  }

  // If signed in, the useEffect will handle redirection. Render null or a loader.
  // If not signed in (and isLoaded is true), render the Landing page.
  return isSignedIn ? null : <Landing />;
};

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPageOrRedirect} /> 
      <ProtectedRoute path="/dashboard" component={Dashboard} />
      <ProtectedRoute path="/plants" component={Plants} />
      <ProtectedRoute path="/plants/:id" component={PlantDetails} />
      <ProtectedRoute path="/schedule" component={CareSchedulePage} />
      <ProtectedRoute path="/recommendations" component={AIRecommendationsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <header style={{ padding: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
            <SignedOut>
              {/* @ts-ignore TODO: Investigate Clerk types for afterSignInUrl/afterSignUpUrl on SignInButton */}
              <SignInButton afterSignInUrl="/dashboard" afterSignUpUrl="/dashboard" />
              {/* @ts-ignore TODO: Investigate Clerk types for afterSignInUrl/afterSignUpUrl on SignUpButton */}
              <SignUpButton afterSignInUrl="/dashboard" afterSignUpUrl="/dashboard" />
            </SignedOut>
            <SignedIn>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
          </header>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
