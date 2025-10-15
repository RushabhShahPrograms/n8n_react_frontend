import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Generates a reasonably unique job id for webhook correlation
// Format: job_<timestamp>_<random>
export function generateJobId() {
  const timestamp = Date.now();
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `job_${timestamp}_${randomPart}`;
}
