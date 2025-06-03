import { useLocation } from "wouter";
import { LayoutDashboard, Leaf, Plus, Calendar, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

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
    <nav className="mobile-nav fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-card/95 backdrop-blur-md border-t border-gray-200/70 dark:border-gray-800/50 z-10 shadow-lg">
      <div className="flex items-center justify-around h-16 px-2 max-w-md mx-auto">
        {navItems.map((item, index) => {
          const isActive = location === item.href;
          return (
            <motion.div 
              key={index} 
              className={cn(
                "flex flex-col items-center justify-center cursor-pointer rounded-lg py-1 px-3 transition-all",
                isActive 
                  ? "text-primary" 
                  : "text-gray-500 dark:text-gray-400 hover:text-primary/80 dark:hover:text-primary/80"
              )}
              onClick={() => navigateTo(item.href)}
              whileTap={{ scale: 0.95 }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <div className={cn(
                "relative p-1.5 rounded-full transition-all",
                isActive ? "bg-primary/10" : ""  
              )}>
                <item.icon className={cn("w-5 h-5 transition-all", isActive ? "stroke-[2.5px]" : "stroke-[1.5px]")} />
                {isActive && (
                  <motion.div 
                    className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-primary rounded-full"
                    layoutId="activeIndicator"
                  />
                )}
              </div>
              <span className={cn(
                "text-xs mt-1 font-medium transition-all",
                isActive ? "font-semibold" : ""
              )}>{item.label}</span>
            </motion.div>
          );
        })}
        <motion.div 
          className="flex flex-col items-center justify-center cursor-pointer"
          onClick={() => navigateTo("/plants/add")}
          whileTap={{ scale: 0.95 }}
          whileHover={{ scale: 1.05 }}
        >
          <motion.div 
            className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-tr from-primary to-primary/80 text-white shadow-lg shadow-primary/20"
            initial={{ y: 20 }}
            animate={{ y: -10 }}
            transition={{ 
              type: "spring",
              stiffness: 300,
              damping: 15
            }}
          >
            <Plus className="w-5 h-5" />
          </motion.div>
        </motion.div>
      </div>
    </nav>
  );
}

export default MobileNavigation;
