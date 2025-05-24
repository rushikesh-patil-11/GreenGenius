import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertEnvironmentReadingSchema, type EnvironmentReading as SharedEnvironmentReading } from "@shared/schema";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

interface EnvironmentUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: number;
  currentEnvironment?: SharedEnvironmentReading;
  onUpdate: () => void;
}

const formSchema = insertEnvironmentReadingSchema.extend({
  temperature: z.preprocess(
    (val) => (val === "" ? undefined : Number(val)),
    z.number().min(0, "Temperature must be a positive number").optional()
  ),
  humidity: z.preprocess(
    (val) => (val === "" ? undefined : Number(val)),
    z.number().min(0, "Humidity must be a positive number").max(100, "Humidity cannot exceed 100%").optional()
  ),
  lightLevel: z.enum(["low", "medium", "high"]).optional(),
});

export function EnvironmentUpdateModal({ 
  isOpen, 
  onClose, 
  userId, 
  currentEnvironment,
  onUpdate 
}: EnvironmentUpdateModalProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      userId,
      temperature: currentEnvironment?.temperature ?? undefined,
      humidity: currentEnvironment?.humidity ?? undefined,
      lightLevel: currentEnvironment?.lightLevel as ("low" | "medium" | "high" | undefined),
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    
    try {
      await apiRequest("POST", "/api/environment", values);
      
      toast({
        title: "Success",
        description: "Environment readings updated successfully.",
        variant: "default",
      });
      
      queryClient.invalidateQueries({ queryKey: ['/api/environment'] });
      queryClient.invalidateQueries({ queryKey: ['/api/recommendations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard-stats'] });
      
      onUpdate();
      onClose();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update environment readings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold font-poppins">Update Environment Readings</DialogTitle>
          <DialogDescription>
            Enter the current environmental conditions around your plants
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="temperature"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Temperature (°C)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="e.g. 22" 
                      {...field} 
                      onChange={(e) => field.onChange(e.target.value === "" ? "" : parseFloat(e.target.value))}
                      value={field.value === undefined ? "" : field.value}
                    />
                  </FormControl>
                  <FormDescription>
                    Current room temperature in Celsius
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="humidity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Humidity (%)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="e.g. 45" 
                      min={0}
                      max={100}
                      {...field} 
                      onChange={(e) => field.onChange(e.target.value === "" ? "" : parseFloat(e.target.value))}
                      value={field.value === undefined ? "" : field.value}
                    />
                  </FormControl>
                  <FormDescription>
                    Current room humidity percentage
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="lightLevel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Light Level</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select light level" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Amount of natural light in your plant's environment
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="flex justify-end space-x-4 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="bg-primary hover:bg-primary-light text-white"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Updating..." : "Update Readings"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default EnvironmentUpdateModal;
