import { useLocation } from "wouter";
import { LayoutDashboard, Leaf, Plus, Calendar, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

export function MobileNavigation() {
  const [location] = useLocation();

  const navItems = [
    { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/plants", icon: Leaf, label: "Plants" },
    { href: "/schedule", icon: Calendar, label: "Schedule" },
    { href: "/recommendations", icon: Lightbulb, label: "Tips" }
  ];
  
  // Helper function to handle navigation
  const navigateTo = (path: string) => {
    window.location.href = path;
  };

  return (
    <nav className="mobile-nav fixed bottom-0 left-0 right-0 bg-white dark:bg-card border-t border-gray-200 dark:border-gray-800 z-10">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item, index) => (
          <div 
            key={index} 
            className={cn(
              "flex flex-col items-center justify-center cursor-pointer",
              location === item.href 
                ? "text-primary" 
                : "text-text-light dark:text-muted-foreground"
            )}
            onClick={() => navigateTo(item.href)}
          >
            <item.icon className="text-xl" />
            <span className="text-xs mt-1 font-medium">{item.label}</span>
          </div>
        ))}
        <div 
          className="flex flex-col items-center justify-center cursor-pointer"
          onClick={() => navigateTo("/plants/add")}
        >
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary text-white -mt-5 shadow-lg">
            <Plus className="text-xl" />
          </div>
        </div>
      </div>
    </nav>
  );
}

export default MobileNavigation;
