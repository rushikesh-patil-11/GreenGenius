import { cn } from "@/lib/utils";

interface ProgressBarProps {
  value: number;
  maxValue: number;
  className?: string;
  color?: string;
}

export function ProgressBar({ value, maxValue, className, color = "bg-primary" }: ProgressBarProps) {
  const percentage = Math.min(100, Math.max(0, (value / maxValue) * 100));
  
  return (
    <div className={cn("rounded-full h-2", className)}>
      <div className={cn("rounded-full h-2", color)} style={{ width: `${percentage}%` }}></div>
    </div>
  );
}

export default ProgressBar;
