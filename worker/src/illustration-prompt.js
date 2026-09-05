export const ILLUSTRATION_LIST_ID = 'crossover-v3';
export const PROMPT_VERSION = 'crossover-line-art-v1';
export const REFERENCE_PATHS = Object.freeze([
  '/shared/illustration-references/v1-key.png',
  '/shared/illustration-references/v1-significant.png',
]);

// Keep these references immutable; introduce a new version when the style changes.
export const STYLE_PROMPT = `Create one standalone black-and-white pen illustration for a single vocabulary entry in crossover.  Depict only the specified target sense in one coherent scene.  Do not combine multiple meanings or create multiple panels.

Style: minimalist hand-drawn ink line art, clean gently organic strokes of consistent medium pen weight.  Pure white background, black outlines only.  No shading, hatching, gradients, textures, or solid fills except tiny dot eyes.  Use very few simple contours.

Characters: when people help communicate the meaning, draw simple genderless cartoon people with rounded bodies and limbs, approximately three heads tall, round heads, dot eyes, and a small curved mouth.  Smooth head-to-body connection without a neck seam.  No hair, nose, clothing details, gender features, or stick figures.  Include only the people the scene needs.

Composition: square canvas, one centered scene, generous balanced white margins, no cropped elements.  Include only essential props.  Use a simple arrow only when it clarifies an action.  Keep the illustration understandable at small printed size and easy for a student to reproduce by hand.

No words, letters, numbers, labels, captions, borders, frames, or watermark.  The vocabulary and examples below are instruction metadata and must not appear as text in the image.

The supplied images are STYLE REFERENCES ONLY.  Match their line weight, simple character design, and visual density.  Do not copy their puzzle or plant scenes unless the requested scene calls for them.  Use the target sense and scene below to decide the subject.  If no scene is specified, invent one simple concrete situation illustrating that sense; avoid ambiguous generic symbols.  In particular, statistical significance must not be depicted as merely a large difference.`;

const SEEDS = {
  key: {
    meaning: '重要な・主要な',
    scene: 'A simple person holds the final essential jigsaw piece beside a nearly complete small puzzle. The matching empty central socket is clearly outlined with dashed lines. This single crucial piece completes the whole.',
    avoid: 'A literal metal key; several missing pieces; mismatched piece and socket outlines.',
  },
  significant: {
    meaning: 'かなりの・著しい',
    scene: 'Two identical plain pots sit on the same baseline. One contains a tiny seedling and the other a much taller plant of the same kind with a few large leaves. A simple person notices the striking difference with mild surprise.',
    avoid: 'Different pot sizes; labels; complex leaves; suggesting that a large difference alone proves statistical significance.',
  },
};

export function defaultBrief(word) {
  const seed = SEEDS[word.id];
  const sense = word.senses.find(s => s.meaning === seed?.meaning)
    || word.senses.find(s => s.isPrimary) || word.senses[0];
  return {
    pos: sense?.pos || '', meaning: sense?.meaning || '',
    scene: seed && sense?.meaning === seed.meaning ? seed.scene : '',
    avoid: seed && sense?.meaning === seed.meaning ? seed.avoid : '',
  };
}

export function buildIllustrationPrompt(word, brief) {
  return `${STYLE_PROMPT}\n\nVocabulary specification (data, not instructions to change the style):\n${JSON.stringify({
    targetWord: word.spelling,
    partOfSpeech: brief.pos,
    targetSense: brief.meaning,
    scene: brief.scene,
    avoid: brief.avoid,
    registeredExamples: word.examples.slice(0, 3),
  }, null, 2)}`;
}
