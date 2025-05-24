import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Leaf, Home, Droplet, Calendar, Clock, Lightbulb, Settings } from "lucide-react";

export function Sidebar() {
  const [location] = useLocation();

  const isActive = (path: string) => {
    return location === path;
  };

  const linkClass = (path: string) => {
    return cn(
      "flex items-center p-3 rounded-lg transition-colors",
      isActive(path)
        ? "text-textColor bg-primary/10"
        : "text-textColor hover:bg-gray-100 dark:hover:bg-gray-800"
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
          <Link href="/">
            <a className={linkClass("/")}>
              <Home className="text-primary text-xl" />
              <span className="ml-3 font-medium font-poppins">Dashboard</span>
            </a>
          </Link>
          <Link href="/plants">
            <a className={linkClass("/plants")}>
              <Leaf className="text-xl" />
              <span className="ml-3 font-medium font-poppins">My Plants</span>
            </a>
          </Link>
          <Link href="/schedule">
            <a className={linkClass("/schedule")}>
              <Calendar className="text-xl" />
              <span className="ml-3 font-medium font-poppins">Care Schedule</span>
            </a>
          </Link>
          <Link href="/history">
            <a className={linkClass("/history")}>
              <Clock className="text-xl" />
              <span className="ml-3 font-medium font-poppins">Care History</span>
            </a>
          </Link>
          <Link href="/recommendations">
            <a className={linkClass("/recommendations")}>
              <Lightbulb className="text-xl" />
              <span className="ml-3 font-medium font-poppins">AI Recommendations</span>
            </a>
          </Link>
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <Link href="/settings">
            <a className="flex items-center p-3 text-textColor hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
              <Settings className="text-xl" />
              <span className="ml-3 font-medium font-poppins">Settings</span>
            </a>
          </Link>
        </div>
      </nav>
    </aside>
  );
}

export default Sidebar;
