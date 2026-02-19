import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(price: number | null): string {
  if (price === null) return "N/A";
  if (price === 0) return "Free";
  if (price < 0.01) return `$${price.toFixed(4)}`;
  return `$${price.toFixed(2)}`;
}

export function formatNumber(num: number | null): string {
  if (num === null) return "N/A";
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(0)}K`;
  return num.toString();
}

export function getProviderHex(provider: string): string {
  const colors: Record<string, string> = {
    openai: "#10b981",
    anthropic: "#f97316",
    google: "#3b82f6",
    meta: "#8b5cf6",
    "meta-llama": "#8b5cf6",
    mistralai: "#a855f7",
    cohere: "#ec4899",
    deepseek: "#06b6d4",
    xai: "#f43f5e",
    azure: "#0ea5e9",
    bedrock: "#f59e0b",
    ollama: "#22c55e",
    groq: "#e11d48",
    together: "#7c3aed",
    fireworks: "#ef4444",
    perplexity: "#84cc16",
  };
  return colors[provider.toLowerCase()] || "#94a3b8";
}

// Broad palette for assigning unique colors per model index
const MODEL_PALETTE = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16",
  "#22c55e", "#10b981", "#14b8a6", "#06b6d4", "#0ea5e9",
  "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#d946ef",
  "#ec4899", "#f43f5e", "#fb923c", "#a3e635", "#2dd4bf",
  "#38bdf8", "#818cf8", "#c084fc", "#f472b6", "#fb7185",
];

export function getModelColor(index: number): string {
  return MODEL_PALETTE[index % MODEL_PALETTE.length];
}

export function getProviderColor(provider: string): string {
  const colors: Record<string, string> = {
    openai: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
    anthropic: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    google: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    meta: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
    "meta-llama": "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
    mistralai: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    cohere: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
    deepseek: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
    xai: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
    azure: "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200",
    bedrock: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
    ollama: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
    groq: "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200",
    together: "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200",
    fireworks: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    perplexity: "bg-lime-100 text-lime-800 dark:bg-lime-900 dark:text-lime-200",
  };
  return colors[provider.toLowerCase()] || "bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200";
}
