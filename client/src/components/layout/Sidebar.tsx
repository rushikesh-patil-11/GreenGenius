import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Leaf, Home, Droplet, Calendar, Clock, Lightbulb, Settings } from "lucide-react";

export function Sidebar() {
  const [location] = useLocation();

  const isActive = (path: string) => {
    return location === path;
  };

  const linkClass = (path: string) => {
    return cn(
      "flex items-center p-3 rounded-lg transition-colors cursor-pointer",
      isActive(path)
        ? "text-textColor bg-primary/10"
        : "text-textColor hover:bg-gray-100 dark:hover:bg-gray-800"
    );
  };

  // Navigation item component to avoid nested anchor tags
  const NavItem = ({ path, icon, label }: { path: string, icon: React.ReactNode, label: string }) => {
    const handleClick = () => {
      window.location.href = path;
    };
    
    return (
      <div onClick={handleClick} className={linkClass(path)}>
        {icon}
        <span className="ml-3 font-medium font-poppins">{label}</span>
      </div>
    );
  };

  return (
    <aside className="desktop-sidebar fixed w-64 h-full bg-white dark:bg-card shadow-natural z-10">
      <div className="flex items-center justify-center h-20 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center">
          <Leaf className="text-primary text-3xl" />
          <h1 className="ml-2 text-2xl font-bold font-poppins text-textColor dark:text-foreground">PlantPal</h1>
        </div>
      </div>
      <nav className="px-4 pt-6">
        <div className="space-y-4">
          <NavItem 
            path="/dashboard" 
            icon={<Home className="text-primary text-xl" />} 
            label="Dashboard" 
          />
          <NavItem 
            path="/plants" 
            icon={<Leaf className="text-xl" />} 
            label="My Plants" 
          />

          <NavItem 
            path="/history" 
            icon={<Clock className="text-xl" />} 
            label="Care History" 
          />
          <NavItem 
            path="/recommendations" 
            icon={<Lightbulb className="text-xl" />} 
            label="AI Recommendations" 
          />
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <NavItem 
            path="/settings" 
            icon={<Settings className="text-xl" />} 
            label="Settings" 
          />
        </div>
      </nav>
    </aside>
  );
}

export default Sidebar;
