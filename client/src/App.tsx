import { Switch, Route, Redirect, useLocation } from "wouter";
import React from 'react';
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider as ShadcnThemeProvider } from "@/hooks/useTheme"; // Renamed to avoid conflict
import { CustomThemeProvider, useCustomTheme } from "@/contexts/ThemeContext"; // Import our custom theme provider
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import Plants from "@/pages/Plants";
import PlantDetails from "@/pages/PlantDetails";
import Landing from "@/pages/Landing";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
  useUser,
} from "@clerk/clerk-react";
import { Sun, Moon, Leaf } from 'lucide-react'; // Import icons
import path from "path";

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

// Simple Theme Toggle Button Component
const ThemeToggleButton: React.FC = () => {
  const { theme, toggleTheme } = useCustomTheme();
  return (
    <button 
      onClick={toggleTheme} 
      className="p-2 rounded-full bg-gray-800/50 hover:bg-gray-700/50 transition-colors duration-200 flex items-center justify-center"
      aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
    >
      {theme === 'light' ? <Moon size={18} className="text-gray-200" /> : <Sun size={18} className="text-yellow-300" />}
    </button>
  );
};

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPageOrRedirect} /> 
      <ProtectedRoute path="/dashboard" component={Dashboard} />
      <ProtectedRoute path="/plants" component={Plants} />
      <ProtectedRoute path="/plants/:id" component={PlantDetails} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <CustomThemeProvider> {/* Our custom theme provider wraps everything */} 
        <ShadcnThemeProvider defaultTheme="light"> {/* Existing theme provider from Shadcn/hooks */} 
          <TooltipProvider>
            <header className="bg-[#0f172a] text-white px-6 py-4 flex justify-between items-center gap-4 border-b border-gray-800/30 shadow-md">
              <div className="flex items-center">
                <div className="relative mr-2">
                  <div className="absolute -inset-1 bg-gradient-to-r from-primary/40 to-primary/20 rounded-full blur-md"></div>
                  <Leaf size={24} className="text-primary relative z-10" />
                </div>
                <div>
                  <h1 className="text-xl font-bold font-poppins bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                    GreenGenius
                  </h1>
                  <p className="text-xs text-gray-400 font-medium -mt-1">Plant Care Assistant</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <ThemeToggleButton /> {/* Add the toggle button here */}
                <SignedOut>
                {/* @ts-ignore TODO: Investigate Clerk types for afterSignInUrl/afterSignUpUrl on SignInButton */}
                <SignInButton afterSignInUrl="/dashboard" afterSignUpUrl="/dashboard" mode="modal" className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium transition-colors duration-200" />
                {/* @ts-ignore TODO: Investigate Clerk types for afterSignInUrl/afterSignUpUrl on SignUpButton */}
                <SignUpButton afterSignInUrl="/dashboard" afterSignUpUrl="/dashboard" mode="modal" className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-sm font-medium transition-colors duration-200" />
              </SignedOut>
              <SignedIn>
                <UserButton 
                  afterSignOutUrl="/" 
                  appearance={{
                    elements: {
                      avatarBox: "h-9 w-9 rounded-full ring-2 ring-primary/30 hover:ring-primary/50 transition-all duration-200"
                    }
                  }}
                />
              </SignedIn>
              </div>
            </header>
            <Toaster />
            <Router />
          </TooltipProvider>
        </ShadcnThemeProvider>
      </CustomThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
