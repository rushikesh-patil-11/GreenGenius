import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { addDays, format, formatDistanceToNow, isBefore } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  if (!date) return '';
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return format(dateObj, 'MMM dd, yyyy');
}

export function formatRelativeDate(date: Date | string): string {
  if (!date) return '';
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isBefore(dateObj, new Date())) {
    return 'Today';
  }
  
  return formatDistanceToNow(dateObj, { addSuffix: true });
}

export function calculateNextWateringDate(lastWatered: Date | string, frequencyDays: number): Date {
  const lastWateredDate = typeof lastWatered === 'string' ? new Date(lastWatered) : lastWatered;
  return addDays(lastWateredDate, frequencyDays);
}

export function formatNextWatering(lastWatered: Date | string, frequencyDays: number): string {
  if (!lastWatered || !frequencyDays) return 'Not set';
  
  const nextWateringDate = calculateNextWateringDate(lastWatered, frequencyDays);
  const today = new Date();
  
  // If next watering is today or in the past
  if (isBefore(nextWateringDate, addDays(today, 1))) {
    return 'Today!';
  }
  
  // If it's tomorrow
  if (isBefore(nextWateringDate, addDays(today, 2))) {
    return 'Tomorrow';
  }
  
  // If it's in the next week
  if (isBefore(nextWateringDate, addDays(today, 7))) {
    const days = Math.ceil((nextWateringDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return `In ${days} days`;
  }
  
  // Otherwise return the date
  return `On ${format(nextWateringDate, 'MMM dd')}`;
}

export function getHealthStatus(healthPercentage: number): { status: string; color: string } {
  if (healthPercentage >= 85) {
    return { status: 'Healthy', color: 'bg-success/10 text-success' };
  } else if (healthPercentage >= 60) {
    return { status: 'Good', color: 'bg-primary/10 text-primary' };
  } else if (healthPercentage >= 40) {
    return { status: 'Fair', color: 'bg-warning/10 text-warning' };
  } else {
    return { status: 'Needs Care', color: 'bg-destructive/10 text-destructive' };
  }
}

export function getEnvironmentStatus(value: number, metric: 'temperature' | 'humidity' | 'soil_moisture'): { status: string; color: string } {
  if (metric === 'temperature') {
    if (value >= 18 && value <= 24) {
      return { status: 'Optimal', color: 'text-success' };
    } else if ((value >= 15 && value < 18) || (value > 24 && value <= 27)) {
      return { status: 'Acceptable', color: 'text-warning' };
    } else {
      return { status: 'Concern', color: 'text-destructive' };
    }
  } else if (metric === 'humidity') {
    if (value >= 40 && value <= 60) {
      return { status: 'Optimal', color: 'text-success' };
    } else if ((value >= 30 && value < 40) || (value > 60 && value <= 70)) {
      return { status: 'Acceptable', color: 'text-warning' };
    } else {
      return { status: value < 40 ? 'Low' : 'High', color: 'text-destructive' };
    }
  } else if (metric === 'soil_moisture') {
    if (value >= 0.25 && value <= 0.35) {
      return { status: 'Optimal', color: 'text-success' };
    } else if ((value >= 0.15 && value < 0.25) || (value > 0.35 && value <= 0.45)) {
      return { status: 'Acceptable', color: 'text-warning' };
    } else {
      return { status: value < 0.15 ? 'Low' : 'High', color: 'text-destructive' };
    }
  }
  // Should not happen with TS checking, but as a fallback
  return { status: 'Unknown', color: 'text-muted-foreground' };
}

export function getLightLevelInfo(level: string): { label: string; status: string; color: string } {
  switch (level?.toLowerCase()) {
    case 'high':
      return { label: 'High', status: 'Good', color: 'text-success' };
    case 'medium':
      return { label: 'Medium', status: 'Good', color: 'text-success' };
    case 'low':
      return { label: 'Low', status: 'Concern', color: 'text-warning' };
    default:
      return { label: 'Unknown', status: 'Unknown', color: 'text-muted-foreground' };
  }
}
