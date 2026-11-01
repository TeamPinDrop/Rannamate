import type { Lang, Persona } from "./types";

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

type Bank = Record<Persona, Record<Lang, string[]>>;

const OPENERS: Bank = {
  mild: {
    en: ["Sure.", "Of course.", "Happy to help.", "Good question."],
    hinglish: ["Bilkul.", "Zaroor.", "Haan ji.", "Accha sawaal hai."],
  },
  masala: {
    en: ["Ooh, nice!", "Love that.", "Let's do it!", "Great call!"],
    hinglish: ["Arre wah!", "Mast!", "Chalo, shuru karte hain!", "Ekdum sahi!"],
  },
  chatpata: {
    en: ["Ohhh, now we're cooking! 🔥", "Hold my spatula! 🍳", "Flavour alert! 🚨", "Yesss, chef! 🌶️"],
    hinglish: ["Arre baap re, kya idea hai! 🔥", "Ekdum jhakaas! 🌶️", "Tadka time, boss! 🍳", "Uff, muh mein paani aa gaya! 🤤"],
  },
};

const CLOSERS: Bank = {
  mild: { en: ["", "", "Let me know if you need anything else."], hinglish: ["", "", "Aur kuch chahiye toh batana."] },
  masala: { en: ["", "Want me to walk you through it?", "Shall we start?"], hinglish: ["", "Shuru karein?", "Main saath hoon, tension mat lo!"] },
  chatpata: {
    en: ["Your kitchen won't know what hit it! 💥", "Apron on, let's go! 🧑‍🍳", "Taste buds = ready. 😎"],
    hinglish: ["Kitchen mein dhamaal macha denge! 💥", "Apron pehno, chalo! 🧑‍🍳", "Swaad ka full on dhamaka! 😎"],
  },
};

export const GREETINGS: Bank = {
  mild: {
    en: ["Hello! I'm Mate, your cooking companion. Tell me what's in your kitchen, or ask me about any recipe."],
    hinglish: ["Namaste! Main Mate hoon, aapka cooking saathi. Batao kitchen mein kya hai, ya kisi recipe ke baare mein poocho."],
  },
  masala: {
    en: ["Hey hey! 👋 Mate here. Tell me what's in your fridge and I'll find you something delicious — or just ask me anything about cooking!"],
    hinglish: ["Hello hello! 👋 Main Mate. Fridge mein kya pada hai batao, main kuch tasty dhoondh deta hoon!"],
  },
  chatpata: {
    en: ["Heyyy foodie! 🌶️ Mate in the house! Throw your ingredients at me and I'll turn them into magic. What're we cooking? 🔥"],
    hinglish: ["Arre foodie dost! 🌶️ Mate aa gaya! Ingredients batao, main jaadu kar deta hoon. Aaj kya banega? 🔥"],
  },
};

export const FALLBACK: Bank = {
  mild: {
    en: ["I'm not sure I understood. Try asking what you can make with certain ingredients, or name a recipe."],
    hinglish: ["Samajh nahi aaya. Ingredients batao ya kisi recipe ka naam lo."],
  },
  masala: {
    en: ["Hmm, you lost me there! 😅 Try \"I have eggs and tomatoes\", \"something spicy under 20 minutes\" or \"how do I make dal tadka?\""],
    hinglish: ["Hmm, yeh samajh nahi aaya! 😅 Try karo: \"mere paas eggs aur tamatar hai\", \"kuch spicy 20 min mein\" ya \"dal tadka kaise banaye?\""],
  },
  chatpata: {
    en: ["Whoa, that one flew over my chef hat! 🎩 Hit me with ingredients, a craving, or a recipe name and watch the magic! ✨"],
    hinglish: ["Arre yeh toh mere chef hat ke upar se nikal gaya! 🎩 Ingredients, craving ya recipe naam bolo — phir dekho jaadu! ✨"],
  },
};

export const JOKES = [
  "Why did the tomato blush? Because it saw the salad dressing! 🍅",
  "I told my dal a joke. It didn't laugh — it just kept simmering. 🥣",
  "What do you call a sad potato? A jacket potato with no jacket. 🥔",
  "Why don't eggs tell secrets? They might crack up! 🥚",
  "Paneer walked into a bar… and got grilled. 🧀",
  "Why was the onion so good at debates? It always made people cry. 🧅",
];

export function decorate(text: string, persona: Persona, lang: Lang, opts: { opener?: boolean; closer?: boolean } = {}) {
  const o = opts.opener !== false ? pick(OPENERS[persona][lang]) : "";
  const c = opts.closer ? pick(CLOSERS[persona][lang]) : "";
  return [o, text, c].filter(Boolean).join(" ");
}

export function line(bank: Bank, persona: Persona, lang: Lang) {
  return pick(bank[persona][lang]);
}

export { pick };

export const PERSONAS: { id: Persona; label: string; emoji: string; blurb: string }[] = [
  { id: "mild", label: "Mild", emoji: "🌿", blurb: "Calm & clear" },
  { id: "masala", label: "Masala", emoji: "🌶️", blurb: "Friendly & fun" },
  { id: "chatpata", label: "Extra Chatpata", emoji: "🔥", blurb: "Full drama" },
];

export const VOICE_STYLE: Record<Persona, { rate: number; pitch: number }> = {
  mild: { rate: 0.98, pitch: 1 },
  masala: { rate: 1.03, pitch: 1.08 },
  chatpata: { rate: 1.1, pitch: 1.18 },
};
