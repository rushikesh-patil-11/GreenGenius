import { Loader2, LeafyGreen } from 'lucide-react';

interface AppLoaderProps {
  title?: string;
  message?: string;
  size?: 'small' | 'medium' | 'large';
  variant?: 'default' | 'minimal';
}

export default function AppLoader({ 
  title = "Gathering Information...", 
  message = "Please wait a moment while we fetch the details.",
  size = 'medium',
  variant = 'default'
}: AppLoaderProps) {
  // Size mappings
  const sizeClasses = {
    small: {
      container: "h-16 w-16",
      icon: "h-8 w-8",
      title: "text-base",
      message: "text-xs"
    },
    medium: {
      container: "h-24 w-24",
      icon: "h-12 w-12",
      title: "text-xl",
      message: "text-sm"
    },
    large: {
      container: "h-32 w-32",
      icon: "h-16 w-16",
      title: "text-2xl",
      message: "text-base"
    }
  };

  // For minimal variant, we don't show the title and message
  if (variant === 'minimal') {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="relative flex items-center justify-center">
          {/* Outer ring with gradient and rotation */}
          <div className="absolute h-full w-full rounded-full bg-gradient-to-r from-green-400 to-emerald-500 opacity-30 animate-pulse"></div>
          <div className="absolute h-full w-full rounded-full border-4 border-transparent border-t-primary border-b-primary animate-spin"></div>
          {/* Inner spinning icon */}
          <div className="bg-background rounded-full p-2">
            <LeafyGreen className={`${sizeClasses[size].icon} text-primary animate-bounce`} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <div className={`relative flex items-center justify-center ${sizeClasses[size].container} mb-6`}>
        {/* Gradient background with pulse */}
        <div className="absolute h-full w-full rounded-full bg-gradient-to-r from-green-400 to-emerald-500 opacity-20 animate-pulse"></div>
        
        {/* Spinning border */}
        <div className="absolute h-full w-full rounded-full border-4 border-transparent border-t-primary border-b-primary animate-spin"></div>
        
        {/* Inner spinning icon with backdrop */}
        <div className="bg-background dark:bg-slate-800 rounded-full p-3 z-10">
          <LeafyGreen className={`${sizeClasses[size].icon} text-primary animate-bounce`} />
        </div>
      </div>
      
      <h2 className={`${sizeClasses[size].title} font-medium text-foreground mb-2 font-poppins`}>{title}</h2>
      <p className={`${sizeClasses[size].message} text-muted-foreground max-w-xs`}>{message}</p>
    </div>
  );
}
