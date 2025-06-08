import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

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
