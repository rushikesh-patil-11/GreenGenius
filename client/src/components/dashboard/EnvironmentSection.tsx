import { Card, CardContent } from "@/components/ui/card";
import { Thermometer, Droplet, Gauge } from "lucide-react";
import { getEnvironmentStatus } from "@/lib/utils";
import type { EnvironmentReading as SharedEnvironmentReading } from "@shared/schema";

interface EnvironmentSectionProps {
  environmentData?: SharedEnvironmentReading;
  onUpdate: () => void; // Reserved for potential use
  loading?: boolean;
}

export function EnvironmentSection({
  environmentData,
  onUpdate,
  loading = false,
}: EnvironmentSectionProps) {
  if (loading || !environmentData) {
    return (
      <Card className="bg-white dark:bg-card shadow-natural mb-8">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4">
            <h2 className="text-xl font-bold font-poppins text-textColor dark:text-foreground">
              Environment Conditions
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="flex items-center p-4 border border-gray-100 dark:border-gray-800 rounded-lg animate-pulse"
              >
                <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-full mr-4"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2"></div>
                  <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const temperatureStatus = environmentData.temperature
    ? getEnvironmentStatus(environmentData.temperature, "temperature")
    : { status: "Unknown", color: "text-muted-foreground" };

  const humidityStatus = environmentData.humidity
    ? getEnvironmentStatus(environmentData.humidity, "humidity")
    : { status: "Unknown", color: "text-muted-foreground" };

  const soilMoistureStatus =
    environmentData.soil_moisture_0_to_10cm !== undefined &&
    environmentData.soil_moisture_0_to_10cm !== null
      ? { status: "Set", color: "text-green-500" }
      : { status: "Unknown", color: "text-muted-foreground" };

  return (
    <Card className="bg-white dark:bg-card shadow-natural mb-8">
      <CardContent className="p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4">
          <h2 className="text-xl font-bold font-poppins text-textColor dark:text-foreground">
            Environment Conditions
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Temperature */}
          <EnvironmentMetric
            icon={<Thermometer className="text-secondary text-2xl" />}
            label="Temperature"
            value={
              environmentData.temperature
                ? `${environmentData.temperature}°C`
                : "Not set"
            }
            status={temperatureStatus}
          />

          {/* Humidity */}
          <EnvironmentMetric
            icon={<Droplet className="text-secondary text-2xl" />}
            label="Humidity"
            value={
              environmentData.humidity
                ? `${environmentData.humidity}%`
                : "Not set"
            }
            status={humidityStatus}
          />

          {/* Soil Moisture */}
          <EnvironmentMetric
            icon={<Gauge className="text-secondary text-2xl" />}
            label="Soil Moisture (0-10cm)"
            value={
              environmentData.soil_moisture_0_to_10cm !== undefined &&
              environmentData.soil_moisture_0_to_10cm !== null
                ? `${environmentData.soil_moisture_0_to_10cm} m³/m³`
                : "Unknown"
            }
            status={soilMoistureStatus}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function EnvironmentMetric({
  icon,
  label,
  value,
  status,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  status: { status: string; color: string };
}) {
  return (
    <div className="flex items-center p-4 border border-gray-100 dark:border-gray-800 rounded-lg">
      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-secondary/10 mr-4">
        {icon}
      </div>
      <div>
        <p className="text-muted-foreground text-sm">{label}</p>
        <div className="flex items-end">
          <h3 className="text-2xl font-bold font-poppins text-textColor dark:text-foreground">
            {value}
          </h3>
          <span className={`${status.color} text-sm ml-2 flex items-center`}>
            {status.status}
          </span>
        </div>
      </div>
    </div>
  );
}

export default EnvironmentSection;
