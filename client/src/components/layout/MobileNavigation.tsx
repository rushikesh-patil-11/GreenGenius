import { Link, useLocation } from "wouter";
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

  return (
    <nav className="mobile-nav fixed bottom-0 left-0 right-0 bg-white dark:bg-card border-t border-gray-200 dark:border-gray-800 z-10">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item, index) => (
          <Link key={index} href={item.href}>
            <a className={cn(
              "flex flex-col items-center justify-center",
              location === item.href 
                ? "text-primary" 
                : "text-text-light dark:text-muted-foreground"
            )}>
              <item.icon className="text-xl" />
              <span className="text-xs mt-1 font-medium">{item.label}</span>
            </a>
          </Link>
        ))}
        <Link href="/plants/add">
          <a className="flex flex-col items-center justify-center">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary text-white -mt-5 shadow-lg">
              <Plus className="text-xl" />
            </div>
          </a>
        </Link>
      </div>
    </nav>
  );
}

export default MobileNavigation;
