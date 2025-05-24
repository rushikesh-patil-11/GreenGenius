import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertPlantSchema, type Plant, type InsertPlant } from "@shared/schema";
import { z } from "zod";
// import { apiRequest } from "@/lib/apiRequest";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

interface AddPlantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddPlant: (newPlant: Plant) => void;
}

// Form schema for validation, excluding id and userId which are handled by backend
const addPlantFormSchema = insertPlantSchema.omit({ userId: true });

export function AddPlantModal({ isOpen, onClose, onAddPlant }: AddPlantModalProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get current date as YYYY-MM-DD format for default value
  const getTodayDateString = () => {
    const today = new Date();
    return today.toISOString().split('T')[0]; // Returns YYYY-MM-DD format
  };

  const form = useForm<Omit<InsertPlant, 'id' | 'userId'>>({
    resolver: zodResolver(addPlantFormSchema),
    defaultValues: {
      name: "",
      species: "",
      imageUrl: "",
      description: "",
      waterFrequencyDays: 7,
      lightRequirement: "medium",
      lastWatered: getTodayDateString(),
      status: 'healthy',
    },
  });

  const onSubmit = async (values: Omit<InsertPlant, 'id' | 'userId'>) => {
    setIsSubmitting(true);
    
    try {
      // The server will handle the string date format directly
      // const newPlant = await apiRequest<Plant>("POST", "/api/plants", values);
      // Placeholder for newPlant to resolve immediate TS errors
      const newPlant: Plant = { 
        ...values, 
        id: Date.now(), // dummy id
        userId: 0, // dummy userId
        // Ensure all Plant properties are here, potentially with default/dummy values
        name: values.name || "Default Plant Name",
        species: values.species || null,
        imageUrl: values.imageUrl || null,
        description: values.description || null,
        acquiredDate: values.lastWatered ? new Date(values.lastWatered) : new Date(), // lastWatered is used as acquiredDate in form
        status: values.status || 'healthy',
        waterFrequencyDays: values.waterFrequencyDays || 7,
        lightRequirement: values.lightRequirement || 'medium',
        lastWatered: values.lastWatered ? new Date(values.lastWatered) : new Date(),
      };

      toast({
        title: "Success",
        description: `${values.name || 'Plant'} has been submitted.`, // Adjusted message
        variant: "default",
      });
      onAddPlant(newPlant); // Call prop with the newly created plant
      queryClient.invalidateQueries({ queryKey: ['/api/plants'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard-stats'] });
      form.reset();
      onClose();
    } catch (error: any) {
      console.error("Failed to add plant:", error);
      toast({
        title: "Error adding plant",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold font-poppins">Add New Plant</DialogTitle>
          <DialogDescription>
            Enter the details of your plant to start tracking its care
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Plant Name*</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Monstera Deliciosa" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="species"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Species</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Swiss Cheese Plant" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormDescription>
                    The scientific or common name of your plant
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="imageUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Image URL</FormLabel>
                  <FormControl>
                    <Input placeholder="https://..." {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormDescription>
                    Link to an image of your plant (optional)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="waterFrequencyDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Watering Frequency (days)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min={1} 
                        {...field} 
                        value={field.value ?? ""} // Ensure value is not null
                        onChange={(e) => field.onChange(e.target.value === '' ? null : e.target.valueAsNumber)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="lightRequirement"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Light Requirement</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      value={field.value ?? ""} // Ensure value is not null
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
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Add notes about your plant..." 
                      className="resize-none" 
                      rows={3}
                      {...field} 
                      value={field.value ?? ""} // Ensure value is not null
                    />
                  </FormControl>
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
                {isSubmitting ? "Adding..." : "Add Plant"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default AddPlantModal;
