import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm, type FieldErrors } from "react-hook-form"; // Import FieldErrors
import { zodResolver } from "@hookform/resolvers/zod";
import { insertPlantSchema, type Plant, type InsertPlant } from "@shared/schema";
import { z } from "zod";
import { apiRequest } from "@/lib/apiRequest";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

interface AddPlantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddPlant: (newPlant: Plant) => void;
}

// Form schema for validation, excluding id and userId which are handled by backend
const addPlantFormSchema = insertPlantSchema.omit({ userId: true });
// Infer type for form data
type AddPlantFormData = z.infer<typeof addPlantFormSchema>;

export function AddPlantModal({ isOpen, onClose, onAddPlant }: AddPlantModalProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Removed getTodayDateString as default for lastWatered is now new Date()

  const form = useForm<AddPlantFormData>({
    resolver: zodResolver(addPlantFormSchema),
    defaultValues: {
      name: "", // name is required, so empty string is a common default
      species: undefined, // Optional field
      imageUrl: undefined, // Optional field
      acquiredDate: new Date(), // Default to today as Date object
    },
  });

  const onSubmit = async (values: AddPlantFormData) => {
    setIsSubmitting(true);
    
    try {
      // The server will handle the date objects directly thanks to z.coerce.date()
      const newPlant = await apiRequest<Plant>("/api/plants", { method: "POST", data: values });

      toast({
        title: "Plant Added!",
        description: `${newPlant.name || 'Your new plant'} has been successfully added.`,
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

  // Use FieldErrors<AddPlantFormData> for more specific error typing if needed
  const onInvalid = (errors: FieldErrors<AddPlantFormData>) => {
    console.error("Form validation errors:", errors); // Optional: for debugging
    toast({
      title: "Validation Error",
      description: "Please fill in all required fields correctly.",
      variant: "destructive",
    });
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
          <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-4">
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
            
            <FormField
              control={form.control}
              name="acquiredDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Acquired Date</FormLabel>
                  <FormControl>
                    <Input 
                        type="date" 
                        {...field} 
                        value={field.value instanceof Date ? field.value.toISOString().split('T')[0] : field.value ?? ""}
                        onChange={e => field.onChange(e.target.valueAsDate)} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="flex justify-end pt-4">
              <Button type="button" variant="outline" onClick={onClose} className="mr-2">
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
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
