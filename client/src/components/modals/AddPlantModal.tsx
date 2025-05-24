import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertPlantSchema } from "@shared/schema";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

interface AddPlantModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: number;
}

const formSchema = insertPlantSchema.extend({
  name: z.string().min(1, "Plant name is required"),
  species: z.string().optional(),
  imageUrl: z.string().url("Please enter a valid URL").optional().or(z.literal("")),
  description: z.string().optional(),
  waterFrequencyDays: z.preprocess(
    (val) => (val === "" ? undefined : Number(val)),
    z.number().min(1, "Water frequency must be at least 1 day").optional()
  ),
  lightRequirement: z.enum(["low", "medium", "high"]).optional(),
});

export function AddPlantModal({ isOpen, onClose, userId }: AddPlantModalProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      userId,
      name: "",
      species: "",
      imageUrl: "",
      description: "",
      waterFrequencyDays: 7,
      lightRequirement: "medium",
      status: "healthy",
      lastWatered: new Date(),
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    
    try {
      // Convert the Date object to ISO string format for API compatibility
      const formattedData = {
        ...values,
        // Format the date as ISO string if it exists
        lastWatered: values.lastWatered ? values.lastWatered.toISOString() : null
      };
      
      await apiRequest("POST", "/api/plants", formattedData);
      
      toast({
        title: "Success",
        description: "Your plant has been added successfully.",
        variant: "default",
      });
      
      queryClient.invalidateQueries({ queryKey: ['/api/plants'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard-stats'] });
      
      form.reset();
      onClose();
    } catch (error) {
      console.error("Error adding plant:", error);
      toast({
        title: "Error",
        description: "Failed to add plant. Please try again.",
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
                    <Input placeholder="e.g. Swiss Cheese Plant" {...field} />
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
                    <Input placeholder="https://..." {...field} />
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
                        onChange={(e) => field.onChange(e.target.valueAsNumber)}
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
