/** Tastory — a food-memory journal. Frontend-only: everything lives in this browser. */

/** A photo is either a bundled sample (remote URL) or one the user added (a Blob kept in IndexedDB). */
export type PhotoRef =
  | { id: string; kind: "remote"; url: string; alt: string; credit?: string }
  | { id: string; kind: "local"; name: string; type: string; alt: string };

export interface Memory {
  id: string;
  dish: string;
  /** cooking date, YYYY-MM-DD */
  date: string;
  /** when it was added to Tastory (ms) */
  createdAt: number;
  updatedAt: number;
  caption: string;
  notes: string;
  /** 1–5, or null when not rated */
  rating: number | null;
  tags: string[];
  favourite: boolean;
  /** photos[0] is the cover */
  photos: PhotoRef[];
  /** bundled demo content — always labelled in the UI */
  sample?: boolean;
  /** the dish's emoji, used for graceful image fallbacks */
  emoji?: string;
}

export type MemoryDraft = Omit<Memory, "id" | "createdAt" | "updatedAt" | "photos" | "sample">;

export type ViewMode = "gallery" | "timeline";
export type FilterMode = "all" | "favourites" | "recent" | "top";
export type SortMode = "newest" | "oldest" | "rating" | "az";
