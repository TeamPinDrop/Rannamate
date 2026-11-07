import { classifyStep } from './safety';

describe('Cook & Chill safety classifier', () => {
  it.each([
    ['Heat the oil in a frying pan over medium heat until it shimmers.', 60, 'critical'],
    ['Add mustard seeds; once they pop, add onion and green chilli.', 180, 'critical'],
    ['Flip the omelette carefully and cook the other side for about a minute.', 60, 'critical'],
    ['Melt butter in a hot pan, add garlic and cook for 30 seconds.', 30, 'critical'],
    ['Chop the onions finely.', undefined, 'critical'],
    ['Add the rice and soy sauce. Toss on high heat so every grain is coated.', 180, 'active'],
    ['Crack the eggs into a bowl and whisk.', undefined, 'active'],
    ['Bring a large pot of well-salted water to a boil and cook the pasta until al dente.', 600, 'passive'],
    ['Boil the potatoes until just tender, cool slightly, peel and cut into cubes.', 600, 'passive'],
    ['Add the tomatoes and cook until they break down and turn jammy.', 240, 'passive'],
  ])('%s → %s', (text, timer, level) => {
    expect(classifyStep(text as string, timer as number | undefined).level).toBe(level);
  });

  it('treats sautéing as hands-on (no entertainment), in any spelling', () => {
    for (const t of ['Add onion and green chilli and sauté until soft.', 'Saute the onion until golden.', 'Sauté onion, pepper and corn in a little oil until just soft.', 'Keep sautéing for two minutes.']) {
      expect(classifyStep(t, 300).level).not.toBe('passive');
    }
    expect(classifyStep('Simmer the sauce gently.', 300).level).toBe('passive');
  });
  it('adds a whistle reminder for pressure cooking', () => {
    expect(classifyStep('Pressure-cook the dal for 3–4 whistles.', 720)).toEqual({ level: 'passive', note: 'Keep an ear out for the whistles.' });
  });
});
