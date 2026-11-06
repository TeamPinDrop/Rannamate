import type { Memory, PhotoRef } from "./types";

/**
 * Demonstration memories so the journal isn't empty on first visit. They are marked `sample`
 * and labelled "Sample" in the UI; the user can edit or delete them, or clear all samples at once.
 * Photos are free-to-use images from Unsplash (unsplash.com/license), loaded from their CDN.
 */
const u = (id: string, alt: string): PhotoRef => ({
  id: `sample-${id}`,
  kind: "remote",
  url: `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1400&q=75`,
  alt,
  credit: "Unsplash",
});

const at = (d: string) => new Date(`${d}T12:00:00`).getTime();
const mk = (m: Omit<Memory, "createdAt" | "updatedAt" | "sample">): Memory => ({ ...m, createdAt: at(m.date), updatedAt: at(m.date), sample: true });

export const SAMPLE_MEMORIES: Memory[] = [
  mk({
    id: "sample-dosa", dish: "Sunday Masala Dosa", date: "2026-10-18", emoji: "🥞", favourite: true, rating: 5,
    caption: "The first dosa that didn't stick to the tawa.",
    notes: "Rested the batter overnight. Tawa hot, then a splash of water before each dosa. Coconut chutney with a little roasted chana dal.",
    tags: ["breakfast", "south indian", "weekend"],
    photos: [
      u("1668236543090-82eba5ee5976", "A crispy dosa with potato masala, sambar and three chutneys"),
      u("1694849789325-914b71ab4075", "A crispy dosa with coconut chutney and sambar on a banana-leaf plate"),
      u("1743517894265-c86ab035adef", "A crispy dosa with dips on a silver tray"),
    ],
  }),
  mk({
    id: "sample-samosa", dish: "Monsoon Samosas", date: "2026-08-09", emoji: "🥟", favourite: true, rating: 4,
    caption: "Rain outside, three samosas and zero regrets.",
    notes: "Ajwain in the dough made the crust flaky. Fry on low flame — patience pays.",
    tags: ["snack", "monsoon", "fried"],
    photos: [u("1601050690597-df0568f70950", "Three golden fried samosas on a wooden tray with green chilli and pomegranate")],
  }),
  mk({
    id: "sample-sadya", dish: "Banana-Leaf Lunch", date: "2026-09-05", emoji: "🍃", favourite: false, rating: 5,
    caption: "Everyone at the table, everything on one leaf.",
    notes: "Made four of the sides; the family brought the rest. Payasam last, as it should be.",
    tags: ["festival", "south indian", "family"],
    photos: [u("1625398407796-82650a8c135f", "A traditional South Indian meal served on a large banana leaf")],
  }),
  mk({
    id: "sample-tikka", dish: "Tikka Masala, Finally Right", date: "2026-07-21", emoji: "🍛", favourite: false, rating: 4,
    caption: "Third attempt. Smoky, creamy, and gone in ten minutes.",
    notes: "Charred the marinated pieces under the grill before they went into the gravy. Kasuri methi at the end.",
    tags: ["dinner", "curry", "north indian"],
    photos: [
      u("1772730064951-89b427965dbc", "A bowl of creamy tikka masala with mint leaves"),
      u("1772730064970-a7b2735c93b9", "Tikka masala with naan bread on a wooden board"),
    ],
  }),
  mk({
    id: "sample-idli", dish: "Idli & Filter Coffee", date: "2026-10-02", emoji: "☕", favourite: false, rating: 4,
    caption: "Soft idlis, strong coffee, slow morning.",
    notes: "",
    tags: ["breakfast", "south indian"],
    photos: [u("1741376509166-cbd74b608f5a", "Idli and sambar with a cup of coffee")],
  }),
  mk({
    id: "sample-thali", dish: "Three-Bowl Thali", date: "2026-06-14", emoji: "🍚", favourite: false, rating: null,
    caption: "Leftovers, rearranged into something that looks planned.",
    notes: "Dal, sabzi and a little raita around a mound of rice.",
    tags: ["lunch", "leftovers"],
    photos: [u("1767114915989-c6ab3c8fc42e", "Three bowls of Indian food with rice and spices")],
  }),
  mk({
    id: "sample-curry", dish: "Weeknight Curry", date: "2026-05-30", emoji: "🥘", favourite: false, rating: 3,
    caption: "Thirty minutes, one pot.",
    notes: "A bit too much chilli. Next time: half the powder, more tomato.",
    tags: ["dinner", "quick", "curry"],
    photos: [
      u("1585937421612-70a008356fbe", "A curry served in a stainless-steel bowl"),
      u("1742599361539-f096753d1100", "Indian curry and rice, ready to eat"),
    ],
  }),
  mk({
    id: "sample-dosa-night", dish: "Dosa Night with Friends", date: "2026-04-12", emoji: "🥞", favourite: true, rating: 5,
    caption: "Twelve dosas, four chutneys, one very tired cook.",
    notes: "Kept the batter in two bowls — plain and with onion-chilli.",
    tags: ["friends", "south indian", "dinner"],
    photos: [
      u("1743615467363-250466982515", "A dosa served with three dipping sauces"),
      u("1743615467204-8fdaa85ff2db", "A dosa served with sides"),
    ],
  }),
];
