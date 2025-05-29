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

// Form schema for validation
const addPlantFormSchema = z.object({
  commonName: z.string().min(1, { message: "Common name is required" }),
});
// Infer type for form data
type AddPlantFormData = z.infer<typeof addPlantFormSchema>;

export function AddPlantModal({ isOpen, onClose, onAddPlant }: AddPlantModalProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Removed getTodayDateString as default for lastWatered is now new Date()

  const form = useForm<AddPlantFormData>({
    resolver: zodResolver(addPlantFormSchema),
    defaultValues: {
      commonName: "",
    },
  });

  const onSubmit = async (values: AddPlantFormData) => {
    setIsSubmitting(true);
    
    try {
      // The backend expects an object like { commonName: "..." }
      const newPlant = await apiRequest<Plant>("/api/plants", { method: "POST", data: values });

      toast({
        title: "Plant Added!",
        description: `${newPlant.name || values.commonName || 'Your new plant'} has been successfully added.`,
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
              name="commonName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Common Name*</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Monstera, Snake Plant" {...field} />
                  </FormControl>
                  <FormDescription>
                    Enter the common name of the plant you want to add.
                  </FormDescription>
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
