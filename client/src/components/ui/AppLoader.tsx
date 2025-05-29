import { Loader2 } from 'lucide-react';

interface AppLoaderProps {
  title?: string;
  message?: string;
}

export default function AppLoader({ 
  title = "Gathering Information...", 
  message = "Please wait a moment while we fetch the details." 
}: AppLoaderProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <div className="relative flex items-center justify-center h-24 w-24 mb-6">
        {/* Outer ring, pulsing */}
        <div className="absolute h-full w-full rounded-full bg-primary/20 animate-pulse"></div>
        {/* Inner spinning icon */}
        <Loader2 className="h-12 w-12 text-primary animate-spin" />
      </div>
      <h2 className="text-xl font-medium text-foreground mb-2">{title}</h2>
      <p className="text-muted-foreground max-w-xs">{message}</p>
    </div>
  );
}
