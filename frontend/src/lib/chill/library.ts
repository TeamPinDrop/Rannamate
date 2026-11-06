/**
 * Cook & Chill — curated content library.
 * Used (a) as the Food Facts knowledge base, and (b) as the clearly-labelled fallback whenever
 * the live AI is not configured or doesn't answer. Facts and trivia answers here are
 * well-established; keep it that way when adding entries.
 */
import type { Fact, GuessQ, Joke, Riddle, TriviaQ, WyrQ } from "./types";

export const TRIVIA: TriviaQ[] = [
  { id: "t-sushi", difficulty: "easy", question: "Which country is traditionally associated with sushi?", options: ["China", "Japan", "Thailand", "Korea"], correct: 1, explanation: "Sushi is a Japanese dish built around vinegared rice." },
  { id: "t-onion", difficulty: "easy", question: "Which vegetable is famous for making people cry when it's chopped?", options: ["Carrot", "Potato", "Onion", "Cucumber"], correct: 2, explanation: "Cutting an onion releases an irritating compound that reaches your eyes." },
  { id: "t-guac", difficulty: "easy", question: "What is the main ingredient of guacamole?", options: ["Avocado", "Cucumber", "Green peas", "Spinach"], correct: 0, explanation: "Guacamole is a Mexican dip made from mashed avocado." },
  { id: "t-paneer", difficulty: "easy", question: "Paneer is made by curdling which ingredient?", options: ["Soy milk", "Coconut milk", "Curd", "Milk"], correct: 3, explanation: "Hot milk is curdled with an acid like lemon juice or vinegar, then the curds are pressed." },
  { id: "t-turmeric", difficulty: "easy", question: "Which spice gives most Indian dals their golden-yellow colour?", options: ["Cumin", "Turmeric", "Coriander", "Cardamom"], correct: 1, explanation: "Turmeric's colour comes from a pigment called curcumin." },
  { id: "t-mango", difficulty: "easy", question: "Which fruit is often called the 'king of fruits' in India?", options: ["Banana", "Jackfruit", "Mango", "Guava"], correct: 2, explanation: "The mango is India's national fruit and its most celebrated one." },
  { id: "t-tofu", difficulty: "easy", question: "Tofu is made from which bean?", options: ["Chickpea", "Soybean", "Kidney bean", "Mung bean"], correct: 1, explanation: "Tofu is curdled soy milk pressed into blocks." },
  { id: "t-poha", difficulty: "easy", question: "Poha is a flattened form of which grain?", options: ["Wheat", "Rice", "Corn", "Millet"], correct: 1, explanation: "Poha is rice that's parboiled and pressed flat." },
  { id: "t-hummus", difficulty: "easy", question: "Hummus is mainly made from…", options: ["Chickpeas", "Lentils", "Peanuts", "Potatoes"], correct: 0, explanation: "Classic hummus blends chickpeas with tahini, lemon and garlic." },
  { id: "t-kimchi", difficulty: "easy", question: "Kimchi is a fermented dish from which country?", options: ["Vietnam", "Japan", "Korea", "Indonesia"], correct: 2, explanation: "Kimchi — usually fermented napa cabbage — is a Korean staple." },
  { id: "t-padthai", difficulty: "easy", question: "Pad Thai is a stir-fried noodle dish from…", options: ["Thailand", "Malaysia", "China", "Cambodia"], correct: 0, explanation: "Pad Thai is one of Thailand's best-known dishes." },
  { id: "t-ghee", difficulty: "easy", question: "What is ghee?", options: ["Fermented milk", "Clarified butter", "Coconut fat", "Mustard oil"], correct: 1, explanation: "Ghee is butter simmered until the milk solids separate and the water cooks off." },
  { id: "t-mozz", difficulty: "easy", question: "Which cheese tops a classic pizza Margherita?", options: ["Cheddar", "Paneer", "Mozzarella", "Parmesan"], correct: 2, explanation: "Margherita uses tomato, mozzarella and basil." },
  { id: "t-idli", difficulty: "easy", question: "Idli batter is traditionally made from rice and which lentil?", options: ["Toor dal", "Urad dal", "Masoor dal", "Chana dal"], correct: 1, explanation: "Rice and urad dal are ground and fermented to make idli batter." },
  { id: "t-saffron", difficulty: "medium", question: "Which spice is the most expensive by weight?", options: ["Cardamom", "Vanilla", "Saffron", "Cinnamon"], correct: 2, explanation: "Saffron threads are hand-picked from crocus flowers, which makes them very costly." },
  { id: "t-aldente", difficulty: "medium", question: "What does the Italian phrase 'al dente' literally mean?", options: ["To the tooth", "With butter", "Well cooked", "In the pot"], correct: 0, explanation: "Al dente pasta is cooked through but still has a slight bite." },
  { id: "t-capsaicin", difficulty: "medium", question: "Which compound makes chillies taste hot?", options: ["Caffeine", "Capsaicin", "Curcumin", "Citric acid"], correct: 1, explanation: "Capsaicin triggers the heat-sensing receptors in your mouth." },
  { id: "t-chilli-india", difficulty: "medium", question: "Who is credited with bringing chillies to India in the 16th century?", options: ["Portuguese traders", "Mughal emperors", "Chinese monks", "British merchants"], correct: 0, explanation: "Chillies come from the Americas and reached India through Portuguese trade." },
  { id: "t-potato-origin", difficulty: "medium", question: "Where was the potato first domesticated?", options: ["Ireland", "India", "The Andes of South America", "Egypt"], correct: 2, explanation: "Potatoes were domesticated in the Andes, in today's Peru and Bolivia." },
  { id: "t-pepper", difficulty: "medium", question: "Black pepper is native to which region?", options: ["Western Ghats of India", "Sahara", "Andes", "Siberia"], correct: 0, explanation: "Black pepper vines are native to the Malabar coast and Western Ghats." },
  { id: "t-peanut", difficulty: "medium", question: "Botanically, a peanut is a…", options: ["Tree nut", "Legume", "Seed of a palm", "Root"], correct: 1, explanation: "Peanuts grow underground in pods and belong to the bean family." },
  { id: "t-paella", difficulty: "medium", question: "Paella comes from which country?", options: ["Italy", "Mexico", "Portugal", "Spain"], correct: 3, explanation: "Paella is a rice dish from Valencia in Spain." },
  { id: "t-tomato-fruit", difficulty: "medium", question: "Botanically speaking, a tomato is a…", options: ["Root", "Fruit", "Leaf", "Stem"], correct: 1, explanation: "Tomatoes develop from the flower and hold seeds, so botanists call them fruits." },
  { id: "t-margherita", difficulty: "medium", question: "Pizza Margherita is linked to which Italian city?", options: ["Rome", "Milan", "Naples", "Venice"], correct: 2, explanation: "Naples is the home of Neapolitan pizza, including the Margherita." },
  { id: "t-dum", difficulty: "medium", question: "In 'dum' biryani, what does 'dum' refer to?", options: ["Deep-frying the rice", "Slow-cooking in a sealed pot", "Adding yogurt", "Grilling the meat"], correct: 1, explanation: "Dum cooking seals the pot so the food cooks gently in its own steam." },
  { id: "t-dhokla", difficulty: "medium", question: "Dhokla is a famous snack from which Indian state?", options: ["Punjab", "Kerala", "Gujarat", "Assam"], correct: 2, explanation: "Dhokla is a steamed, fermented gram-flour snack from Gujarat." },
  { id: "t-marzipan", difficulty: "medium", question: "Marzipan is made mainly from sugar and which nut?", options: ["Cashew", "Almond", "Walnut", "Pistachio"], correct: 1, explanation: "Marzipan is a sweet almond paste." },
  { id: "t-vanilla", difficulty: "medium", question: "Vanilla comes from the pods of which kind of plant?", options: ["An orchid", "A palm", "A cactus", "A grass"], correct: 0, explanation: "Vanilla is the cured seed pod of a climbing orchid." },
  { id: "t-maillard", difficulty: "hard", question: "What's the name of the browning reaction that gives toast and seared food their flavour?", options: ["Oxidation", "Maillard reaction", "Fermentation", "Emulsification"], correct: 1, explanation: "The Maillard reaction happens between amino acids and sugars under dry heat." },
  { id: "t-scoville", difficulty: "hard", question: "The Scoville scale measures…", options: ["Salt content", "Sugar content", "Chilli heat", "Acidity"], correct: 2, explanation: "Wilbur Scoville devised it in 1912 to rate chilli pungency." },
  { id: "t-koji", difficulty: "hard", question: "Which mould is used to ferment soy sauce and miso?", options: ["Penicillium", "Aspergillus oryzae (koji)", "Rhizopus", "Saccharomyces"], correct: 1, explanation: "Koji mould breaks down soybeans and grains to build deep savoury flavour." },
  { id: "t-saffron-part", difficulty: "hard", question: "Which part of the crocus flower becomes saffron?", options: ["Petals", "Stigmas", "Leaves", "Bulb"], correct: 1, explanation: "Each flower has just three red stigmas, picked by hand." },
  { id: "t-altitude", difficulty: "hard", question: "Why does water boil at a lower temperature in the mountains?", options: ["Colder air", "Lower air pressure", "Less oxygen in water", "Thinner pots"], correct: 1, explanation: "Lower air pressure lets water boil sooner, so food cooks more slowly." },
  { id: "t-allicin", difficulty: "hard", question: "Which compound forms when garlic is crushed or chopped?", options: ["Allicin", "Lycopene", "Piperine", "Gingerol"], correct: 0, explanation: "Crushing garlic lets an enzyme turn alliin into pungent allicin." },
  { id: "t-rasgulla", difficulty: "hard", question: "Which two Indian states each hold a GI tag for their own version of the rasgulla?", options: ["Bihar & Jharkhand", "West Bengal & Odisha", "Assam & Tripura", "UP & MP"], correct: 1, explanation: "West Bengal received a GI tag in 2017 and Odisha in 2019." },
  { id: "t-wasabi", difficulty: "hard", question: "Wasabi belongs to the same plant family as…", options: ["Ginger", "Mustard and cabbage", "Mint", "Onion"], correct: 1, explanation: "Wasabi is a brassica, like mustard, cabbage and horseradish." },
];

export const GUESS: GuessQ[] = [
  { id: "g-green-chilli", ingredientId: "green-chilli", emoji: "🌶️", answer: "Green chilli", aliases: ["green chilli", "green chili", "chilli", "chili", "mirchi", "hari mirch"], clues: ["I'm long, slim and usually green — sometimes I turn red.", "Bite me and you'll feel the heat.", "I'm slit and dropped into tadkas and omelettes all over India."] },
  { id: "g-onion", ingredientId: "onion", emoji: "🧅", answer: "Onion", aliases: ["onion", "pyaaz", "pyaz", "kanda"], clues: ["I wear a papery jacket.", "I'm built from layer after layer.", "Cut me and your eyes start to water."] },
  { id: "g-tomato", ingredientId: "tomato", emoji: "🍅", answer: "Tomato", aliases: ["tomato", "tamatar"], clues: ["I'm round, juicy and full of little seeds.", "Botanists call me a fruit, cooks call me a vegetable.", "I'm the red base of ketchup and most curries."] },
  { id: "g-potato", ingredientId: "potato", emoji: "🥔", answer: "Potato", aliases: ["potato", "aloo", "alu"], clues: ["I grow underground and I have 'eyes'.", "I came from the Andes but India adopted me completely.", "Mash me, fry me, or make jeera ___ with me."] },
  { id: "g-garlic", ingredientId: "garlic", emoji: "🧄", answer: "Garlic", aliases: ["garlic", "lehsun", "lahsun"], clues: ["I come as a bulb split into cloves.", "Crush me and I get much stronger.", "Folklore says vampires can't stand me."] },
  { id: "g-ginger", ingredientId: "ginger", emoji: "🫚", answer: "Ginger", aliases: ["ginger", "adrak"], clues: ["I'm a knobbly rhizome with thin beige skin.", "I'm warm, a little spicy, and great in chai.", "I'm half of a famous paste with my friend garlic."] },
  { id: "g-turmeric", ingredientId: "turmeric", emoji: "🟡", answer: "Turmeric", aliases: ["turmeric", "haldi"], clues: ["I'm a root, but you usually meet me as a powder.", "I stain fingers and wooden spoons bright yellow.", "I give dal its golden colour."] },
  { id: "g-cumin", ingredientId: "cumin", emoji: "🟤", answer: "Cumin", aliases: ["cumin", "jeera", "zeera", "cumin seeds"], clues: ["I'm a tiny, ridged brown seed.", "I sizzle in hot oil and smell wonderfully earthy.", "Jeera aloo is named after me."] },
  { id: "g-lemon", ingredientId: "lemon", emoji: "🍋", answer: "Lemon", aliases: ["lemon", "lime", "nimbu", "nimboo"], clues: ["I'm sour enough to make you pucker.", "A squeeze of me brightens chaat, dal and salads.", "I'm yellow (or green), and I stop cut apples turning brown."] },
  { id: "g-coriander", ingredientId: "coriander", emoji: "🌿", answer: "Coriander", aliases: ["coriander", "cilantro", "dhania", "dhaniya"], clues: ["I'm a leafy green herb sprinkled on top of almost everything.", "My seeds are a spice and my leaves are a garnish.", "Some people say I taste like soap!"] },
  { id: "g-egg", ingredientId: "egg", emoji: "🥚", answer: "Egg", aliases: ["egg", "eggs", "anda"], clues: ["I have a shell but I'm not a nut.", "You have to break me before you can use me.", "Omelettes, bhurji and curries all start with me."] },
  { id: "g-paneer", ingredientId: "paneer", emoji: "🧀", answer: "Paneer", aliases: ["paneer", "cottage cheese", "indian cottage cheese"], clues: ["I'm white, soft and cut into cubes.", "I'm made by curdling hot milk with lemon or vinegar.", "Tikka, bhurji and butter masala all star me."] },
  { id: "g-rice", ingredientId: "rice", emoji: "🍚", answer: "Rice", aliases: ["rice", "chawal", "basmati"], clues: ["I'm a grain that grows in flooded fields.", "Half the world eats me every day.", "Biryani, pulao and khichdi are built on me."] },
  { id: "g-mushroom", ingredientId: "mushroom", emoji: "🍄", answer: "Mushroom", aliases: ["mushroom", "mushrooms", "khumb"], clues: ["I'm not a plant at all — I'm a fungus.", "I have a cap and a stem and I love damp, dark places.", "Button, shiitake and oyster are my cousins."] },
  { id: "g-spinach", ingredientId: "spinach", emoji: "🥬", answer: "Spinach", aliases: ["spinach", "palak"], clues: ["I'm a leafy green that shrinks a lot when cooked.", "A big pile of me wilts into a small spoonful.", "Paneer loves to sit in a bowl of me."] },
  { id: "g-peanut", ingredientId: "peanuts", emoji: "🥜", answer: "Peanut", aliases: ["peanut", "peanuts", "groundnut", "groundnuts", "moongphali", "shengdana"], clues: ["People call me a nut, but I'm really a legume.", "I grow underground in a papery shell.", "I add crunch to poha and turn into a famous butter."] },
  { id: "g-pepper", ingredientId: "black-pepper", emoji: "⚫", answer: "Black pepper", aliases: ["black pepper", "pepper", "kali mirch", "peppercorn", "peppercorns"], clues: ["I'm a small, wrinkly, dark berry, dried in the sun.", "I'm native to India's Western Ghats.", "I sit next to salt on almost every dining table."] },
  { id: "g-mustard", ingredientId: "mustard-seeds", emoji: "🟤", answer: "Mustard seeds", aliases: ["mustard seeds", "mustard seed", "mustard", "rai", "sarson"], clues: ["I'm a tiny round seed, black or yellow.", "I pop and jump when I hit hot oil.", "Most South Indian tadkas start with me."] },
];

export const WYR: WyrQ[] = [
  { id: "w1", a: "Eat biryani every Sunday", b: "Eat pizza every Friday", aEmoji: "🍛", bEmoji: "🍕" },
  { id: "w2", a: "Cook an amazing dessert", b: "Cook an incredible main course", aEmoji: "🍰", bEmoji: "🍲" },
  { id: "w3", a: "Travel the world tasting food", b: "Become a professional chef", aEmoji: "✈️", bEmoji: "🧑‍🍳" },
  { id: "w4", a: "Eat only street food for a year", b: "Eat only home-cooked food for a year", aEmoji: "🛺", bEmoji: "🏠" },
  { id: "w5", a: "Give up chai forever", b: "Give up coffee forever", aEmoji: "🫖", bEmoji: "☕" },
  { id: "w6", a: "Cook for a famous chef", b: "Have a famous chef cook for you", aEmoji: "🍳", bEmoji: "🍽️" },
  { id: "w7", a: "Eat only spicy food for a week", b: "Eat only sweet food for a week", aEmoji: "🌶️", bEmoji: "🍬" },
  { id: "w8", a: "Make perfectly round rotis", b: "Make perfectly crisp dosas", aEmoji: "🫓", bEmoji: "🥞" },
  { id: "w9", a: "Have breakfast for dinner every day", b: "Have dinner for breakfast every day", aEmoji: "🥣", bEmoji: "🍛" },
  { id: "w10", a: "Never chop onions again", b: "Never wash dishes again", aEmoji: "🧅", bEmoji: "🧽" },
  { id: "w11", a: "Unlimited mangoes every summer", b: "Unlimited samosas every monsoon", aEmoji: "🥭", bEmoji: "🥟" },
  { id: "w12", a: "Cook in a beach shack", b: "Cook in a mountain cabin", aEmoji: "🏖️", bEmoji: "🏔️" },
  { id: "w13", a: "Have a spice that makes everything tastier", b: "Have a knife that never goes blunt", aEmoji: "✨", bEmoji: "🔪" },
  { id: "w14", a: "Eat with chopsticks forever", b: "Eat with your hands forever", aEmoji: "🥢", bEmoji: "✋" },
  { id: "w15", a: "Only cook one-pot meals", b: "Make every meal five courses", aEmoji: "🥘", bEmoji: "🍷" },
  { id: "w16", a: "Know every recipe in the world", b: "Remember the exact taste of every meal you've had", aEmoji: "📚", bEmoji: "👅" },
];

export const WYR_REACTIONS = [
  "Bold choice, chef! I respect it.",
  "Ooh, I had a feeling you'd say that!",
  "Interesting… the kitchen jury approves.",
  "Ha! That tells me a lot about your taste buds.",
  "Solid pick. I'd have struggled with that one.",
];
export const WYR_FOLLOWUPS = [
  "What's the best thing you've ever eaten?",
  "Which dish would you cook to impress someone?",
  "Sweet tooth or spice lover — which are you?",
  "What's one dish you'd love to learn next?",
];

export const JOKES: Joke[] = [
  { id: "j1", category: "veggies", setup: "Why did the tomato turn red?", punchline: "Because it saw the salad dressing!" },
  { id: "j2", category: "chefs", setup: "Why did the chef bring a ladder into the kitchen?", punchline: "The recipe said to take it to the next level!" },
  { id: "j3", category: "pasta", setup: "What do you call a fake noodle?", punchline: "An impasta." },
  { id: "j4", category: "eggs", setup: "Why don't eggs tell jokes?", punchline: "They'd crack each other up." },
  { id: "j5", category: "veggies", setup: "Why are potatoes such good detectives?", punchline: "They keep their eyes peeled." },
  { id: "j6", category: "veggies", setup: "Why does the mushroom get invited to every party?", punchline: "Because he's such a fun-gi." },
  { id: "j7", category: "dairy", setup: "Why did the paneer go to school?", punchline: "It wanted to become a little more cultured." },
  { id: "j8", category: "kitchen", setup: "What did the pressure cooker say after three whistles?", punchline: "I've let off enough steam for today." },
  { id: "j9", category: "snacks", setup: "Why did the samosa go to therapy?", punchline: "It had too much stuffing bottled up inside." },
  { id: "j10", category: "dairy", setup: "What do you call cheese that isn't yours?", punchline: "Nacho cheese." },
  { id: "j11", category: "fruit", setup: "Why did the banana go to the doctor?", punchline: "It wasn't peeling well." },
  { id: "j12", category: "grains", setup: "Why does rice never lose its cool in an argument?", punchline: "It refuses to get steamed." },
  { id: "j13", category: "spices", setup: "What did the ginger say to the garlic?", punchline: "Together, we make a great paste." },
  { id: "j14", category: "sweets", setup: "Why would a jalebi make a great lawyer?", punchline: "It can twist any argument." },
  { id: "j15", category: "chefs", setup: "Why are chefs terrible at keeping secrets?", punchline: "They always spill the beans." },
  { id: "j16", category: "dal", setup: "I told my dal a joke.", punchline: "It didn't laugh — it just kept simmering." },
  { id: "j17", category: "veggies", setup: "Why was the onion so good at debates?", punchline: "Its arguments always brought people to tears." },
  { id: "j18", category: "fruit", setup: "What do you call a sad strawberry?", punchline: "A blueberry." },
  { id: "j19", category: "kitchen", setup: "Why did the frying pan start a band?", punchline: "It already had the perfect sizzle section." },
  { id: "j20", category: "spices", setup: "What's a chilli's favourite kind of music?", punchline: "Anything with a lot of heat." },
  { id: "j21", category: "bread", setup: "Why did the roti refuse to go to the party?", punchline: "It was feeling a bit flat." },
  { id: "j22", category: "veggies", setup: "Why did the cucumber never panic?", punchline: "It always stayed cool." },
];

export const RIDDLES: Riddle[] = [
  { id: "r-onion", difficulty: "easy", riddle: "I have layers but I'm not a cake. I can make you cry when you cut me. What am I?", answer: "Onion", aliases: ["onion", "pyaaz", "pyaz", "kanda"], hint: "I'm in almost every tadka." },
  { id: "r-potato", difficulty: "easy", riddle: "I'm full of eyes but I can't see a thing. What am I?", answer: "Potato", aliases: ["potato", "aloo", "alu"], hint: "I grow underground." },
  { id: "r-egg", difficulty: "easy", riddle: "You have to break me before you can use me. What am I?", answer: "Egg", aliases: ["egg", "eggs", "anda"], hint: "Breakfast loves me." },
  { id: "r-corn", difficulty: "easy", riddle: "I have an ear but I can't hear. What am I?", answer: "Corn", aliases: ["corn", "sweet corn", "maize", "bhutta", "makka"], hint: "Roasted on the street during monsoon." },
  { id: "r-mushroom", difficulty: "medium", riddle: "What kind of room has no doors and no windows?", answer: "Mushroom", aliases: ["mushroom", "a mushroom", "mushrooms"], hint: "You can eat this room." },
  { id: "r-garlic", difficulty: "easy", riddle: "I come in cloves but I'm not a spice box, and vampires are scared of me. What am I?", answer: "Garlic", aliases: ["garlic", "lehsun", "lahsun"], hint: "I'm white and I come as a bulb." },
  { id: "r-turmeric", difficulty: "medium", riddle: "I'm a yellow powder that stains your fingers and colours your dal. What am I?", answer: "Turmeric", aliases: ["turmeric", "haldi"], hint: "My other name starts with H." },
  { id: "r-lemon", difficulty: "easy", riddle: "I have a peel but I'm no banana. Squeeze me and you'll pucker. What am I?", answer: "Lemon", aliases: ["lemon", "lime", "nimbu", "nimboo"], hint: "I'm sour and yellow-green." },
  { id: "r-teapot", difficulty: "hard", riddle: "What starts with T, ends with T, and is full of T?", answer: "Teapot", aliases: ["teapot", "tea pot", "a teapot", "kettle"], hint: "Think about what 'T' could sound like." },
  { id: "r-roti", difficulty: "medium", riddle: "I'm flat and round, I puff up when I'm hot, and you tear me to scoop your sabzi. What am I?", answer: "Roti", aliases: ["roti", "chapati", "chapatti", "phulka", "puri", "fulka"], hint: "Made from atta." },
  { id: "r-cucumber", difficulty: "medium", riddle: "I'm long, green and mostly water, and I keep raita cool. What am I?", answer: "Cucumber", aliases: ["cucumber", "kheera", "khira"], hint: "People say I'm very 'cool'." },
  { id: "r-mustard", difficulty: "hard", riddle: "I'm tiny and round, I jump and pop in hot oil, and South Indian tadkas begin with me. What am I?", answer: "Mustard seeds", aliases: ["mustard", "mustard seed", "mustard seeds", "rai", "sarson"], hint: "I also become a yellow sauce for hot dogs." },
  { id: "r-poha", difficulty: "medium", riddle: "I'm rice that got squashed flat, and Maharashtra eats me for breakfast. What am I?", answer: "Poha", aliases: ["poha", "flattened rice", "aval", "chivda"], hint: "Often served with peanuts and lemon." },
  { id: "r-pepper", difficulty: "medium", riddle: "I sit next to salt on the table, I'm black, and I can make you sneeze. What am I?", answer: "Black pepper", aliases: ["pepper", "black pepper", "kali mirch"], hint: "I'm ground from peppercorns." },
  { id: "r-salt", difficulty: "easy", riddle: "Without me food tastes flat, but too much of me ruins everything. What am I?", answer: "Salt", aliases: ["salt", "namak"], hint: "I'm white and I come from the sea." },
  { id: "r-chilli", difficulty: "medium", riddle: "I'm green when young and red when old, and the smaller I am, the hotter I can be. What am I?", answer: "Chilli", aliases: ["chilli", "chili", "chillies", "green chilli", "red chilli", "mirchi"], hint: "My heat is measured on the Scoville scale." },
];

/** Food facts knowledge base. Tags are ingredient ids (or topics) so facts can follow the current recipe. */
export const FACTS: Fact[] = [
  { id: "f-tomato", emoji: "🍅", title: "Fruit or vegetable?", tags: ["tomato"], source: "Botany; Nix v. Hedden (US Supreme Court, 1893)", fact: "Botanically a tomato is a fruit — but in 1893 the US Supreme Court ruled it a vegetable for customs-tax purposes, because that's how people cook with it." },
  { id: "f-chilli-heat", emoji: "🌶️", title: "Where the heat comes from", tags: ["green-chilli", "chilli-powder", "chilli-flakes"], source: "Food chemistry", fact: "A chilli's heat comes from capsaicin. It doesn't actually burn you — it tricks the heat sensors in your mouth into firing." },
  { id: "f-chilli-india", emoji: "🛳️", title: "Chillies are immigrants", tags: ["green-chilli", "chilli-powder"], source: "Culinary history", fact: "Chillies are native to the Americas. They reached India only in the 1500s through Portuguese traders — before that, Indian food got its heat from black pepper." },
  { id: "f-potato", emoji: "🥔", title: "An Andean traveller", tags: ["potato"], source: "Crop history", fact: "Potatoes were domesticated in the Andes thousands of years ago and spread worldwide after the 1500s. India is now one of the world's biggest potato growers." },
  { id: "f-onion", emoji: "🧅", title: "Why onions make you cry", tags: ["onion", "spring-onion"], source: "Food chemistry", fact: "Cutting an onion breaks its cells and releases an enzyme that makes a volatile irritant gas. A sharp knife and a chilled onion both reduce the tears." },
  { id: "f-turmeric", emoji: "🟡", title: "Golden pigment", tags: ["turmeric", "dal"], source: "Food chemistry", fact: "Turmeric's colour comes from curcumin. It dissolves much better in fat than in water, which is one reason it's usually bloomed in oil or ghee." },
  { id: "f-maillard", emoji: "🍞", title: "The browning reaction", tags: ["bread", "onion", "potato", "paneer", "chicken", "mushroom"], source: "Food science (L.-C. Maillard, 1912)", fact: "The tasty brown crust on toast, seared paneer and golden onions comes from the Maillard reaction between proteins and sugars — it needs dry heat well above boiling." },
  { id: "f-altitude", emoji: "🏔️", title: "Cooking in the mountains", tags: ["water", "rice", "dal", "pasta"], source: "Physics", fact: "At high altitude the air pressure is lower, so water boils below 100 °C. That's why dal and rice take longer to cook in the hills — and why pressure cookers help." },
  { id: "f-pasta-salt", emoji: "🍝", title: "Salty pasta water", tags: ["pasta"], source: "Food science", fact: "Salting pasta water is for flavour. The amount cooks use barely changes the boiling point — far less than one degree." },
  { id: "f-cumin", emoji: "🟤", title: "Parsley's cousin", tags: ["cumin"], source: "Botany", fact: "Cumin seeds come from a plant in the same family as parsley, carrot and coriander." },
  { id: "f-pepper", emoji: "⚫", title: "Black gold", tags: ["black-pepper"], source: "Trade history", fact: "Black pepper is native to India's Malabar coast. It was so valuable in ancient trade that it was sometimes called 'black gold'." },
  { id: "f-saffron", emoji: "🌸", title: "Hand-picked threads", tags: ["saffron", "rice"], source: "Agriculture", fact: "Saffron is the dried stigma of the crocus flower. Each flower has only three, picked by hand — so it takes many thousands of flowers to make a small amount." },
  { id: "f-egg-peel", emoji: "🥚", title: "Older eggs peel easier", tags: ["egg"], source: "Food science", fact: "As eggs age, carbon dioxide escapes through the shell and the white becomes more alkaline. That's why slightly older eggs are easier to peel after boiling." },
  { id: "f-garlic", emoji: "🧄", title: "Garlic gets stronger when crushed", tags: ["garlic"], source: "Food chemistry", fact: "Whole garlic is fairly mild. Crushing or chopping it starts an enzyme reaction that makes allicin, the compound behind its sharp bite." },
  { id: "f-lemon-browning", emoji: "🍋", title: "Lemon stops browning", tags: ["lemon", "avocado", "apple", "banana"], source: "Food science", fact: "Cut apples and avocados brown because of an enzyme reacting with oxygen. Lemon juice slows it down with acidity and vitamin C." },
  { id: "f-ginger", emoji: "🫚", title: "Not a root", tags: ["ginger"], source: "Botany", fact: "Ginger isn't technically a root — it's a rhizome, an underground stem. Turmeric is a rhizome from the same plant family." },
  { id: "f-paneer", emoji: "🧀", title: "Paneer needs no rennet", tags: ["paneer", "milk"], source: "Dairy science", fact: "Most cheeses use rennet, but paneer is made just by curdling hot milk with an acid like lemon juice — which is why it doesn't melt like mozzarella." },
  { id: "f-pulses", emoji: "🫘", title: "India and pulses", tags: ["dal", "chickpeas", "rajma"], source: "FAO statistics", fact: "India is the world's largest producer and consumer of pulses — dals, chickpeas and beans are a protein backbone for hundreds of millions of people." },
  { id: "f-mushroom", emoji: "🍄", title: "Closer to animals", tags: ["mushroom"], source: "Biology", fact: "Mushrooms are fungi, not plants. On the tree of life, fungi are actually more closely related to animals than to plants." },
  { id: "f-sushi", emoji: "🍣", title: "Sushi started as preserving", tags: ["rice", "fish", "Japanese"], source: "Culinary history", fact: "Sushi began as a way of preserving fish by packing it in fermenting rice. The rice was thrown away — only later did people start eating it too." },
  { id: "f-aldente", emoji: "🦷", title: "To the tooth", tags: ["pasta", "Italian"], source: "Language", fact: "'Al dente' means 'to the tooth' in Italian — pasta that's cooked through but still has a gentle bite." },
  { id: "f-banana", emoji: "🍌", title: "Berry confusing", tags: ["banana"], source: "Botany", fact: "Botanically, bananas count as berries while strawberries don't — botanical names don't always match kitchen ones." },
  { id: "f-peanut", emoji: "🥜", title: "Not a nut", tags: ["peanuts"], source: "Botany", fact: "Peanuts are legumes, like peas and beans. The pods grow underground, which is why they're also called groundnuts." },
  { id: "f-popcorn", emoji: "🍿", title: "Why corn pops", tags: ["corn"], source: "Physics", fact: "Each popcorn kernel holds a little water. When heated it turns to steam, pressure builds inside the hard hull, and the kernel bursts open." },
  { id: "f-cucumber", emoji: "🥒", title: "Mostly water", tags: ["cucumber"], source: "Nutrition data", fact: "Cucumbers are about 95% water, which is why they feel so cooling in raita and salads." },
  { id: "f-soy", emoji: "🥢", title: "Brewed with mould", tags: ["soy-sauce", "tofu", "Chinese", "Japanese"], source: "Food science", fact: "Traditional soy sauce is brewed from soybeans, wheat and salt with a mould called koji, then aged for months." },
  { id: "f-coriander", emoji: "🌿", title: "The soap gene", tags: ["coriander"], source: "Genetics research", fact: "Some people find coriander leaves taste like soap. Studies have linked this to a variation in a smell-receptor gene." },
  { id: "f-basil", emoji: "🌱", title: "Two different basils", tags: ["basil"], source: "Botany", fact: "Sweet basil used in Italian food and tulsi (holy basil) are different species of the same plant genus." },
  { id: "f-poha", emoji: "🍚", title: "How poha is made", tags: ["poha", "rice"], source: "Food processing", fact: "Poha is made by soaking and parboiling rice, then flattening the grains between rollers — that's why it rehydrates in minutes." },
  { id: "f-honey", emoji: "🍯", title: "Long-lasting honey", tags: ["honey"], source: "Food science", fact: "Honey is so low in water and so acidic that most microbes can't grow in it. Sealed and stored well, it keeps for an extraordinarily long time." },
];

export const CHAT_STARTERS = [
  "So tell me — what's your all-time favourite dish?",
  "What's the funniest thing that's ever happened to you in a kitchen?",
  "If you could eat in any city in the world tonight, where would you go?",
  "Who taught you to cook — or are you self-taught?",
  "What's one food you couldn't stand as a kid but love now?",
  "Street food or restaurant food — what wins for you?",
  "What would your 'last meal' look like?",
];

/** A tiny branching story for when the live AI is off. Each node has a short text and up to two choices. */
export interface StoryTree { id: string; title: string; start: string; nodes: Record<string, { text: string; choices?: { label: string; next: string }[] }> }

export const STORIES: StoryTree[] = [
  {
    id: "s-potato", title: "The Potato Who Wanted to Be a Chef", start: "a",
    nodes: {
      a: { text: "In a busy kitchen in Old Delhi lived a small potato named Aalu Singh. Every night he watched the chef work and dreamed of wearing the tall white hat himself. One evening the chef left early — and the stove was still warm.", choices: [{ label: "Climb up and try cooking", next: "b" }, { label: "Ask the wise old onion for help", next: "c" }] },
      b: { text: "Aalu rolled up to the counter, grabbed a tiny spoon and stared at the spice box. Seven little tins stared back. He had no idea which one to open.", choices: [{ label: "Open the red tin", next: "d" }, { label: "Open the yellow tin", next: "e" }] },
      c: { text: "The old onion peeled back a layer and smiled. 'Cooking isn't about the hat,' she said. 'It's about patience.' Then she offered him a secret recipe — or a single piece of advice.", choices: [{ label: "Take the secret recipe", next: "f" }, { label: "Take the advice", next: "g" }] },
      d: { text: "It was chilli powder! One sniff and Aalu sneezed so hard he flew into the bread basket. The chef found him there in the morning, laughed, and named him 'Spicy Aalu' — the official kitchen mascot. The end.", },
      e: { text: "It was turmeric. Aalu sprinkled a little on himself and turned a glorious gold. The chef was so impressed by the colour that she made Jeera Aloo the next day — starring Aalu, of course. The end." },
      f: { text: "The recipe was written in onion-ink and smelled terrible, but it worked. Aalu cooked a perfect dum aloo and the whole vegetable rack cheered. The chef never found out who made it. The end." },
      g: { text: "'Low flame, and don't rush,' said the onion. Aalu waited, stirred gently and waited some more. By sunrise he'd made the smoothest mash in all of Delhi — and learned that waiting is half of cooking. The end." },
    },
  },
  {
    id: "s-jeera", title: "The Case of the Missing Jeera", start: "a",
    nodes: {
      a: { text: "Detective Dhaniya was called to the spice rack at midnight. The jeera tin was empty, and the tadka was due at breakfast. Two suspects stood nervously nearby: Mustard Seed and the Garam Masala jar.", choices: [{ label: "Question Mustard Seed", next: "b" }, { label: "Search the Garam Masala jar", next: "c" }] },
      b: { text: "Mustard Seed was so nervous he kept popping up and down. 'I was at the dal party all night!' he squeaked. Dhaniya noticed a trail of tiny brown seeds leading behind the fridge…", choices: [{ label: "Follow the trail", next: "d" }, { label: "Ask the fridge magnet what it saw", next: "e" }] },
      c: { text: "Inside the jar, Dhaniya found cardamom, cinnamon, cloves… and a suspicious amount of cumin. 'I'm a blend!' Garam Masala protested. 'Jeera is part of me!'", choices: [{ label: "Believe Garam Masala", next: "f" }, { label: "Call in Sniffer Hing", next: "g" }] },
      d: { text: "Behind the fridge sat a mouse, happily crunching jeera seeds. 'They smell so good roasted!' he admitted. Dhaniya let him off with a warning and found a fresh packet in the cupboard. Breakfast was saved. Case closed." },
      e: { text: "The fridge magnet had seen everything: the cook's little nephew had used all the jeera for a 'science experiment'. The jeera was returned, slightly soggy, and the tadka went ahead. Case closed." },
      f: { text: "Dhaniya realised the truth: Garam Masala was innocent — blends are made from whole spices. The real culprit was simply that nobody had refilled the tin. A shopping list was written. Case closed." },
      g: { text: "Sniffer Hing sniffed once and fainted from his own smell. When he woke, he pointed straight at the cook, who'd used the last of the jeera for jeera rice and forgot to tell anyone. Case closed — with a free plate of jeera rice." },
    },
  },
];

/** Original song templates for when live AI is off. {A},{B} = ingredients, {D} = dish. */
export const SONG_TEMPLATES: { style: string; title: string; lines: string[] }[] = [
  { style: "jingle", title: "The {A} Shuffle", lines: ["{A}, {A}, sizzling slow,", "{B} jumps in — here we go!", "Stir it left and stir it right,", "{D} is cooking up just right!"] },
  { style: "chef rap", title: "Mic Check, Spatula", lines: ["Mic check, spatula, one, two, three,", "{A} in the pot is the place to be,", "{B} on the board, chopped nice and clean,", "{D} on the way — best you've ever seen!"] },
  { style: "timer song", title: "Tick-Tock Tadka", lines: ["Tick, tock, the timer's on,", "{A} is bubbling — won't be long,", "Wait a little, tap your feet,", "Soon there's {D} for us to eat!"] },
  { style: "celebration", title: "Hip Hip Hooray for {A}", lines: ["Hip hip hooray for {A} today,", "{B} came along and it's here to stay,", "Pots go clang and spoons go ding,", "{D} makes the whole kitchen sing!"] },
];
