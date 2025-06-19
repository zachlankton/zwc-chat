import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ApiKeyInfo } from "./chat/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function asyncDelay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function basedOnLabel(label: string) {
  return label
    .toLowerCase()
    .replaceAll(/[^\w\d\s]/g, "") // remove all non word, non digit, and non whitespace characters
    .replaceAll(/\s{2,}/g, " ") // remove duplicate spaces
    .trim() // remove leading and trailing whitespaces
    .replaceAll(" ", "-"); // replaces spaces with dashes
}

export function tryParseJson(txt: string) {
  try {
    return JSON.parse(txt);
  } catch (error) {
    return txt;
  }
}

export const getUsageStatus = (apiKeyInfo?: ApiKeyInfo | null) => {
  if (!apiKeyInfo) return null;

  // Handle unlimited keys
  if (apiKeyInfo.limit === null) {
    return {
      percentage: 100, // remaining
      status: "good" as const,
      remaining: Infinity,
      limit: null,
      usage: apiKeyInfo.usage,
    };
  }

  if (apiKeyInfo.limit === 0) return null;
  const usagePercentage = (apiKeyInfo.usage / apiKeyInfo.limit) * 100;
  const remainingPercentage = Math.max(0, 100 - usagePercentage);

  let status: "good" | "warning" | "critical" = "good";
  if (usagePercentage >= 90) {
    status = "critical";
  } else if (usagePercentage >= 80) {
    status = "warning";
  }

  return {
    percentage: remainingPercentage,
    status,
    remaining: apiKeyInfo.limit_remaining,
    limit: apiKeyInfo.limit,
    usage: apiKeyInfo.usage,
  };
};
