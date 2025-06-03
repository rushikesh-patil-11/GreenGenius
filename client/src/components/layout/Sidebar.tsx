import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Leaf, Home, Clock, Lightbulb, Settings } from "lucide-react";
import { motion } from "framer-motion";

export function Sidebar() {
  const [location] = useLocation();

  const isActive = (path: string) => location === path;

  const linkClass = (path: string) =>
    cn(
      "group flex items-center gap-3 p-3 rounded-xl transition-all duration-200 ease-in-out",
      isActive(path)
        ? "bg-primary/15 text-primary font-semibold shadow-sm"
        : "text-gray-600 dark:text-gray-400 hover:bg-muted/30 dark:hover:bg-muted/20 hover:text-primary/80 dark:hover:text-primary/80"
    );

  const NavItem = ({
    path,
    icon,
    label,
  }: {
    path: string;
    icon: React.ReactNode;
    label: string;
  }) => {
    const handleClick = () => {
      window.location.href = path;
    };
    
    const active = isActive(path);

    return (
      <motion.button
        onClick={handleClick}
        className={linkClass(path)}
        aria-label={label}
        whileTap={{ scale: 0.98 }}
        whileHover={{ x: 2 }}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        <div className={cn(
          "relative p-1 rounded-full transition-all", 
          active ? "bg-primary/10" : ""
        )}>
          {icon}

        </div>
        <span className={cn(
          "font-medium font-poppins transition-all",
          active ? "font-semibold" : ""
        )}>{label}</span>
      </motion.button>
    );
  };

  return (
    <motion.aside 
      className="fixed left-0 top-0 h-full w-64 bg-background/95 backdrop-blur-md border-r border-border/50 shadow-xl z-20"
      initial={{ x: -100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <motion.div 
        className="flex items-center justify-between h-20 border-b border-border/50 px-6"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex items-center">
          <div className="relative mr-3">
            <motion.div 
              className="absolute -inset-1 bg-gradient-to-r from-primary/40 to-primary/20 rounded-full blur-md"
              animate={{ 
                scale: [1, 1.1, 1],
                opacity: [0.7, 0.9, 0.7] 
              }}
              transition={{ 
                duration: 3, 
                repeat: Infinity,
                repeatType: "reverse" 
              }}
            />
            <Leaf className="text-primary text-2xl relative z-10" />
          </div>
          <div>
            <h1 className="text-xl font-bold font-poppins bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              GreenGenius
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium -mt-1">Plant Care Assistant</p>
          </div>
        </div>
      </motion.div>
      <nav className="px-4 py-6 space-y-6">
        <div className="space-y-2">
          <NavItem path="/dashboard" icon={<Home className="w-5 h-5" />} label="Dashboard" />
          <NavItem path="/plants" icon={<Leaf className="w-5 h-5" />} label="My Plants" />
          <NavItem path="/history" icon={<Clock className="w-5 h-5" />} label="Care History" />
          <NavItem
            path="/recommendations"
            icon={<Lightbulb className="w-5 h-5" />}
            label="AI Recommendations"
          />
        </div>
        <motion.div 
          className="pt-6 mt-6 border-t border-border/50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <NavItem path="/settings" icon={<Settings className="w-5 h-5" />} label="Settings" />
        </motion.div>
      </nav>
    </motion.aside>
  );
}

export default Sidebar;
