import React, { useState, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlantAvatar } from "@/components/ui/PlantAvatar";
import { useAuth } from "@clerk/clerk-react";
import { apiRequest } from "@/lib/queryClient";
import Sidebar from "@/components/layout/Sidebar";
import MobileNavigation from "@/components/layout/MobileNavigation";
import { 
  Droplet, 
  Sun, 
  Scissors, 
  PlusCircle, 
  CalendarDays, 
  Search,
  Filter,
  Clock,
  Leaf,
  Sparkles,
  TrendingUp
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ActivityLog {
  id: string;
  plantName: string;
  actionType: string;
  actionTime: string | Date;
  notes?: string;
  dateAdded?: string;
  lastWatered?: string;
  plantImage?: string;
}

export default function HistoryPage() {
  const { userId: clerkUserId, isSignedIn, getToken } = useAuth();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState("all");

  useEffect(() => {
    if (!isSignedIn || !clerkUserId) return;
    setIsLoading(true);
    apiRequest("GET", `/api/history`, undefined, getToken)
      .then(async (res) => {
        const data = await res.json();
        setLogs(data.logs || []);
      })
      .catch(() => setLogs([]))
      .finally(() => setIsLoading(false));
  }, [isSignedIn, clerkUserId, getToken]);

  const filteredLogs = useMemo(() => {
    let filtered = logs;
    
    // Filter by search term
    if (search.trim()) {
      const s = search.toLowerCase();
      filtered = filtered.filter(
        (log) =>
          log.plantName.toLowerCase().includes(s) ||
          log.actionType.toLowerCase().includes(s) ||
          (log.notes && log.notes.toLowerCase().includes(s))
      );
    }
    
    // Filter by action type
    if (selectedFilter !== "all") {
      filtered = filtered.filter(
        (log) => log.actionType.toLowerCase() === selectedFilter.toLowerCase()
      );
    }
    
    return filtered;
  }, [search, logs, selectedFilter]);

  // Get unique action types for filter buttons
  const actionTypes = useMemo(() => {
    const types = ["all", ...Array.from(new Set(logs.map(log => log.actionType.toLowerCase())))];
    return types;
  }, [logs]);

  // Map action types to icons and colors with plate theme
  const getActionConfig = (type: string) => {
    switch (type.toLowerCase()) {
      case "watered": 
        return {
          icon: <Droplet className="w-4 h-4" />,
          color: "from-blue-500 to-cyan-400",
          bgColor: "bg-blue-50 dark:bg-blue-950/20",
          textColor: "text-blue-600 dark:text-blue-400",
          borderColor: "border-blue-200 dark:border-blue-800"
        };
      case "fertilized": 
        return {
          icon: <Sun className="w-4 h-4" />,
          color: "from-amber-500 to-yellow-400",
          bgColor: "bg-amber-50 dark:bg-amber-950/20",
          textColor: "text-amber-600 dark:text-amber-400",
          borderColor: "border-amber-200 dark:border-amber-800"
        };
      case "pruned": 
        return {
          icon: <Scissors className="w-4 h-4" />,
          color: "from-emerald-500 to-green-400",
          bgColor: "bg-emerald-50 dark:bg-emerald-950/20",
          textColor: "text-emerald-600 dark:text-emerald-400",
          borderColor: "border-emerald-200 dark:border-emerald-800"
        };
      case "added": 
        return {
          icon: <PlusCircle className="w-4 h-4" />,
          color: "from-violet-500 to-purple-400",
          bgColor: "bg-violet-50 dark:bg-violet-950/20",
          textColor: "text-violet-600 dark:text-violet-400",
          borderColor: "border-violet-200 dark:border-violet-800"
        };
      default: 
        return {
          icon: <CalendarDays className="w-4 h-4" />,
          color: "from-slate-500 to-gray-400",
          bgColor: "bg-slate-50 dark:bg-slate-950/20",
          textColor: "text-slate-600 dark:text-slate-400",
          borderColor: "border-slate-200 dark:border-slate-800"
        };
    }
  };

  const getTimeAgo = (dateInput: string | Date) => {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return "Just now";
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    const diffInWeeks = Math.floor(diffInDays / 7);
    if (diffInWeeks < 4) return `${diffInWeeks}w ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-emerald-950/20">
      {/* Sidebar for desktop */}
      <div className="hidden md:flex md:w-64 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-r border-slate-200/60 dark:border-slate-700/60">
        <Sidebar />
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Enhanced Header */}
        <header className="sticky top-0 z-20 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-slate-200/60 dark:border-slate-700/60 shadow-sm">
          <div className="px-4 py-6">
            {/* Header Top */}
            <div className="flex flex-col gap-4 md:gap-0 md:flex-row md:items-start md:justify-between mb-6">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-400 shadow-lg">
                    <TrendingUp className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight bg-gradient-to-r from-emerald-600 via-green-600 to-teal-600 dark:from-emerald-400 dark:via-green-400 dark:to-teal-400 bg-clip-text text-transparent">
                      Activity History
                    </h1>
                    <p className="text-slate-600 dark:text-slate-400 font-medium">
                      Track your plant care journey and celebrate every milestone
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Stats Overview */}
              <div className="flex gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{logs.length}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Total Activities</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {logs.filter(log => log.actionType.toLowerCase() === 'watered').length}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Waterings</div>
                </div>
              </div>
            </div>
            
            {/* Search and Filters */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="relative flex-1 md:max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search plants, actions, or notes..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 bg-white/70 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 focus:ring-emerald-500 focus:border-emerald-500 rounded-xl shadow-sm"
                />
              </div>
              
              {/* Filter Buttons */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                <Filter className="w-4 h-4 text-slate-500 flex-shrink-0" />
                {actionTypes.map((type) => {
                  const config = getActionConfig(type);
                  return (
                    <button
                      key={type}
                      onClick={() => setSelectedFilter(type)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 whitespace-nowrap",
                        selectedFilter === type
                          ? `${config.bgColor} ${config.textColor} ${config.borderColor} border shadow-sm`
                          : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 border border-transparent"
                      )}
                    >
                      {type !== "all" && config.icon}
                      {type === "all" ? "All" : type.charAt(0).toUpperCase() + type.slice(1)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-8">
          {isLoading ? (
            <div className="flex flex-col justify-center items-center h-64 space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-200 border-t-emerald-600"></div>
              <span className="text-lg text-slate-600 dark:text-slate-400">Loading your plant activities...</span>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col justify-center items-center h-64 space-y-4">
              <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-800">
                <Leaf className="w-12 h-12 text-slate-400" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold text-slate-600 dark:text-slate-400">No activities found</h3>
                <p className="text-slate-500 dark:text-slate-500">
                  {search.trim() || selectedFilter !== "all" 
                    ? "Try adjusting your search or filter" 
                    : "Start caring for your plants to see activities here"}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredLogs.map((log, index) => {
                const config = getActionConfig(log.actionType);
                return (
                  <Card
                    key={log.id}
                    className={cn(
                      "group relative overflow-hidden border-0 shadow-sm hover:shadow-lg transition-all duration-300 rounded-2xl",
                      "bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm",
                      "hover:bg-white dark:hover:bg-slate-900",
                      "hover:scale-[1.02] hover:-translate-y-1"
                    )}
                    style={{
                      animationDelay: `${index * 50}ms`,
                      animation: "fadeInUp 0.5s ease-out forwards"
                    }}
                  >
                    {/* Gradient Border */}
                    <div className={cn(
                      "absolute inset-0 rounded-2xl p-[1px] bg-gradient-to-r opacity-0 group-hover:opacity-100 transition-opacity duration-300",
                      config.color
                    )}>
                      <div className="w-full h-full rounded-2xl bg-white dark:bg-slate-900" />
                    </div>
                    
                    <div className="relative p-6">
                      <div className="flex items-start gap-4">
                        {/* Plant Avatar with Enhanced Styling */}
                        <div className="relative flex-shrink-0">
                          <div className={cn(
                            "p-1 rounded-2xl bg-gradient-to-r shadow-lg",
                            config.color
                          )}>
                            <PlantAvatar 
                              src={log.plantImage} 
                              alt={log.plantName} 
                              size={56}
                            />
                          </div>
                        </div>
                        
                        {/* Content */}
                        <div className="flex-1 min-w-0 space-y-2">
                          {/* Header Row */}
                          <div className="flex items-center justify-between gap-3">
                            <h3 className="font-bold text-xl text-slate-800 dark:text-slate-200 truncate">
                              {log.plantName}
                            </h3>
                            <div className="flex items-center gap-2">
                              <Badge 
                                className={cn(
                                  "flex items-center gap-1.5 px-3 py-1 font-medium shadow-sm border-0",
                                  config.bgColor,
                                  config.textColor
                                )}
                              >
                                {config.icon}
                                {log.actionType}
                              </Badge>
                            </div>
                          </div>
                          
                          {/* Time and Notes */}
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                              <Clock className="w-4 h-4" />
                              <span className="font-medium">{getTimeAgo(log.actionTime)}</span>
                              <span className="text-slate-400 dark:text-slate-500">•</span>
                              <span className="text-sm">{new Date(log.actionTime).toLocaleDateString()}</span>
                            </div>
                            
                            {log.notes && (
                              <div className="flex items-start gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                                <Sparkles className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                                <p className="text-sm text-slate-700 dark:text-slate-300 italic">
                                  "{log.notes}"
                                </p>
                              </div>
                            )}
                            
                            {/* Additional Info */}
                            {(log.dateAdded || log.lastWatered) && (
                              <div className="flex flex-wrap gap-4 text-xs text-slate-500 dark:text-slate-400">
                                {log.dateAdded && (
                                  <span className="flex items-center gap-1">
                                    <PlusCircle className="w-3 h-3" />
                                    Added: {new Date(log.dateAdded).toLocaleDateString()}
                                  </span>
                                )}
                                {log.lastWatered && (
                                  <span className="flex items-center gap-1">
                                    <Droplet className="w-3 h-3" />
                                    Last watered: {new Date(log.lastWatered).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </main>
        
        {/* Mobile Navigation */}
        <div className="md:hidden block">
          <MobileNavigation />
        </div>
      </div>
      
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}