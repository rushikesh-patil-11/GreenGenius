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
import { Sun, Moon, Leaf } from 'lucide-react'; // Import icons

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
      style={{
        padding: '0.5rem',
        // Basic styling, can be improved with CSS variables or Tailwind
        backgroundColor: 'transparent', // Make background transparent for icon button
        color: 'var(--text-color)', // Use text color for icon
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
      aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'} // Accessibility
    >
      {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
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
      <ProtectedRoute path="/schedule" component={CareSchedulePage} />
      <ProtectedRoute path="/recommendations" component={AIRecommendationsPage} />
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
            <header style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', borderBottom: '1px solid var(--border-color, #e5e7eb)',  boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <Leaf size={28} className="text-primary" />
                <h1 style={{ marginLeft: '0.5rem', fontSize: '1.75rem', fontWeight: 'bold', fontFamily: 'Poppins, sans-serif' }} className="text-textColor dark:text-foreground">
                  PlantPal
                </h1>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <ThemeToggleButton /> {/* Add the toggle button here */}
                <SignedOut>
                {/* @ts-ignore TODO: Investigate Clerk types for afterSignInUrl/afterSignUpUrl on SignInButton */}
                <SignInButton afterSignInUrl="/dashboard" afterSignUpUrl="/dashboard" />
                {/* @ts-ignore TODO: Investigate Clerk types for afterSignInUrl/afterSignUpUrl on SignUpButton */}
                <SignUpButton afterSignInUrl="/dashboard" afterSignUpUrl="/dashboard" />
              </SignedOut>
              <SignedIn>
                <UserButton afterSignOutUrl="/" />
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
