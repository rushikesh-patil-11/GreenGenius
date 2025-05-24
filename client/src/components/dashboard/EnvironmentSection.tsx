import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Thermometer, Droplet, Sun, RefreshCw } from "lucide-react";
import { getEnvironmentStatus, getLightLevelInfo } from "@/lib/utils";
import { useState } from "react";
import EnvironmentUpdateModal from "@/components/modals/EnvironmentUpdateModal";
import type { EnvironmentReading as SharedEnvironmentReading } from "@shared/schema";

interface EnvironmentSectionProps {
  environmentData?: SharedEnvironmentReading;
  onUpdate: () => void;
  loading?: boolean;
}

export function EnvironmentSection({ environmentData, onUpdate, loading = false }: EnvironmentSectionProps) {
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);

  const handleUpdateEnvironment = () => {
    setIsUpdateModalOpen(true);
  };

  // If loading, or if environmentData is not yet available (even if not strictly loading), show skeleton.
  // This handles the case where the parent might pass undefined before data is ready.
  if (loading || !environmentData) {
    return (
      <Card className="bg-white dark:bg-card shadow-natural mb-8">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4">
            <h2 className="text-xl font-bold font-poppins text-textColor dark:text-foreground">Environment Conditions</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center p-4 border border-gray-100 dark:border-gray-800 rounded-lg animate-pulse">
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

  // At this point, environmentData is guaranteed to be defined due to the check above.
  const temperatureStatus = environmentData.temperature
    ? getEnvironmentStatus(environmentData.temperature, 'temperature')
    : { status: 'Unknown', color: 'text-muted-foreground' };
  
  const humidityStatus = environmentData.humidity
    ? getEnvironmentStatus(environmentData.humidity, 'humidity')
    : { status: 'Unknown', color: 'text-muted-foreground' };
  
  const lightLevelInfo = getLightLevelInfo(environmentData.lightLevel || '');

  return (
    <>
      <Card className="bg-white dark:bg-card shadow-natural mb-8">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4">
            <h2 className="text-xl font-bold font-poppins text-textColor dark:text-foreground">Environment Conditions</h2>
            <Button
              variant="ghost"
              className="mt-2 sm:mt-0 text-secondary"
              onClick={handleUpdateEnvironment}
            >
              <RefreshCw className="h-4 w-4 mr-1" /> Update Readings
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-center p-4 border border-gray-100 dark:border-gray-800 rounded-lg">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-secondary/10 mr-4">
                <Thermometer className="text-secondary text-2xl" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Temperature</p>
                <div className="flex items-end">
                  <h3 className="text-2xl font-bold font-poppins text-textColor dark:text-foreground">
                    {environmentData.temperature ? `${environmentData.temperature}°C` : 'Not set'}
                  </h3>
                  <span className={`${temperatureStatus.color} text-sm ml-2 flex items-center`}>
                    {environmentData.temperature && (
                      <>
                        {temperatureStatus.status === 'Optimal' ? (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        )}
                        {temperatureStatus.status}
                      </>
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center p-4 border border-gray-100 dark:border-gray-800 rounded-lg">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-secondary/10 mr-4">
                <Droplet className="text-secondary text-2xl" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Humidity</p>
                <div className="flex items-end">
                  <h3 className="text-2xl font-bold font-poppins text-textColor dark:text-foreground">
                    {environmentData.humidity ? `${environmentData.humidity}%` : 'Not set'}
                  </h3>
                  <span className={`${humidityStatus.color} text-sm ml-2 flex items-center`}>
                    {environmentData.humidity && (
                      <>
                        {humidityStatus.status === 'Optimal' ? (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        )}
                        {humidityStatus.status}
                      </>
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center p-4 border border-gray-100 dark:border-gray-800 rounded-lg">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-secondary/10 mr-4">
                <Sun className="text-secondary text-2xl" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Light Level</p>
                <div className="flex items-end">
                  <h3 className="text-2xl font-bold font-poppins text-textColor dark:text-foreground">
                    {lightLevelInfo.label || 'Not set'}
                  </h3>
                  <span className={`${lightLevelInfo.color} text-sm ml-2 flex items-center`}>
                    {environmentData.lightLevel && (
                      <>
                        {lightLevelInfo.status === 'Good' ? (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        )}
                        {lightLevelInfo.status}
                      </>
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <EnvironmentUpdateModal
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
        currentEnvironment={environmentData}
        onUpdate={onUpdate}
      />
    </>
  );
}

export default EnvironmentSection;
