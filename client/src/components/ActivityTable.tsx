import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlantAvatar } from "@/components/ui/PlantAvatar";

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

interface ActivityTableProps {
  logs: ActivityLog[];
}

export const ActivityTable: React.FC<ActivityTableProps> = ({ logs }) => {
  if (!logs.length) return <div className="text-center py-16 text-gray-500">No activity found.</div>;
  return (
    <div className="space-y-3">
      {logs.map((log) => (
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
  );
};
