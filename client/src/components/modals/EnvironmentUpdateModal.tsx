import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EnvironmentReading as SharedEnvironmentReading } from "@shared/schema";
import { useEnvironment } from "@/hooks/useEnvironment";
import { useToast } from "@/components/ui/use-toast";

interface EnvironmentUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentEnvironment?: SharedEnvironmentReading;
  onUpdate: () => void;
}

export function EnvironmentUpdateModal({ isOpen, onClose, currentEnvironment, onUpdate }: EnvironmentUpdateModalProps) {
  const [temperature, setTemperature] = useState<string>('');
  const [humidity, setHumidity] = useState<string>('');
  const [soilMoisture, setSoilMoisture] = useState<string>(''); // New state for soil moisture

  const { updateEnvironment: updateEnvironmentMutation } = useEnvironment();

  useEffect(() => {
    if (currentEnvironment) {
      setTemperature(currentEnvironment.temperature?.toString() || '');
      setHumidity(currentEnvironment.humidity?.toString() || '');
      setSoilMoisture(currentEnvironment.soil_moisture_0_to_10cm?.toString() || ''); // Initialize soil moisture state from currentEnvironment
    } else {
      setTemperature('');
      setHumidity('');
      setSoilMoisture(''); // Clear soil moisture state
    }
  }, [currentEnvironment]);

  const handleSubmit = async () => {
    const updatedData: Partial<SharedEnvironmentReading> = {};
    if (temperature !== '') updatedData.temperature = parseFloat(temperature);
    if (humidity !== '') updatedData.humidity = parseFloat(humidity);
    // Removed manual soil moisture update: if (soilMoisture !== '') updatedData.soil_moisture_0_to_10cm = parseFloat(soilMoisture); // Include soil moisture in update data

    try {
      await updateEnvironmentMutation.mutateAsync(updatedData);
      toast.success("Environment readings updated successfully!");
      onUpdate();
      onClose();
    } catch (error) {
      console.error("Failed to update environment readings:", error);
      toast.error("Failed to update environment readings.");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Update Environment Readings</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="temperature" className="text-right">
              Temperature (°C)
            </Label>
            <Input
              id="temperature"
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
              className="col-span-3"
              type="number"
              step="0.1"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="humidity" className="text-right">
              Humidity (%)
            </Label>
            <Input
              id="humidity"
              value={humidity}
              onChange={(e) => setHumidity(e.target.value)}
              className="col-span-3"
              type="number"
              step="0.1"
            />
          </div>
          {/* Soil Moisture Input Field - Removed */}
          {/* <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="soilMoisture" className="text-right">
                Soil Moisture (m³/m³)
              </Label>
              <Input
                id="soilMoisture"
                value={soilMoisture}
                onChange={(e) => setSoilMoisture(e.target.value)}
                className="col-span-3"
                type="number"
                step="0.01"
              />
            </div> */}
          </div>
          <DialogFooter>
            <Button type="button" onClick={handleSubmit} disabled={updateEnvironmentMutation.isLoading}>
              {updateEnvironmentMutation.isLoading ? 'Updating...' : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };
}

export default EnvironmentUpdateModal;
