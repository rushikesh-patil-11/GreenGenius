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
        ? "bg-primary/20 text-primary font-semibold shadow-sm"
        : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/50 hover:text-primary/90"
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
      className="fixed left-0 top-0 h-full w-64 bg-white dark:bg-slate-900 backdrop-blur-md border-r border-gray-200 dark:border-gray-800/30 shadow-xl z-20"
      initial={{ x: -100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      
      <nav className="px-4 py-6 space-y-6">
        <div className="space-y-2">
          <NavItem path="/dashboard" icon={<Home className="w-5 h-5" />} label="Dashboard" />
          <NavItem path="/plants" icon={<Leaf className="w-5 h-5" />} label="My Plants" />
          <NavItem path="/history" icon={<Clock className="w-5 h-5" />} label="Care History" />
        </div>
        
       
      </nav>
    </motion.aside>
  );
}

export default Sidebar;
