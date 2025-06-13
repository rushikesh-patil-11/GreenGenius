import React, { useState, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlantAvatar } from "@/components/ui/PlantAvatar";
import { useAuth } from "@clerk/clerk-react";
import { apiRequest } from "@/lib/queryClient";

interface ActivityLog {
  id: number;
  plantName: string;
  actionType: string;
  actionTime: string;
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
    if (!search.trim()) return logs;
    const s = search.toLowerCase();
    return logs.filter(
      (log) =>
        log.plantName.toLowerCase().includes(s) ||
        log.actionType.toLowerCase().includes(s) ||
        (log.notes && log.notes.toLowerCase().includes(s))
    );
  }, [search, logs]);

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Plant Activity History</h1>
      <Input
        placeholder="Search by plant, action, or note..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-6"
      />
      {isLoading ? (
        <div className="text-center py-16">Loading activity logs...</div>
      ) : filteredLogs.length === 0 ? (
        <div className="text-center py-16 text-gray-500">No activity found.</div>
      ) : (
        <div className="space-y-3">
          {filteredLogs.map((log) => (
            <Card key={log.id} className="flex items-center gap-4 p-4">
              <PlantAvatar src={log.plantImage} alt={log.plantName} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold truncate">{log.plantName}</span>
                  <Badge variant="outline">{log.actionType}</Badge>
                </div>
                <div className="text-xs text-gray-500">
                  {log.actionTime && new Date(log.actionTime).toLocaleString()} {log.notes && `| ${log.notes}`}
                </div>
                <div className="flex gap-4 mt-1 text-xs text-gray-400">
                  {log.dateAdded && <span>Date Added: {new Date(log.dateAdded).toLocaleDateString()}</span>}
                  {log.lastWatered && <span>Last Watered: {new Date(log.lastWatered).toLocaleDateString()}</span>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
