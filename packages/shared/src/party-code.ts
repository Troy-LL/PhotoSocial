export const PARTY_WORDS = [
  "PINE",
  "LEAF",
  "MOON",
  "STAR",
  "DAWN",
  "GLOW",
  "WAVE",
  "MIST",
  "FERN",
  "ROSE",
  "SNOW",
  "GOLD",
  "BLUE",
  "COZY",
  "WARM",
  "BLOOM",
  "SPARK",
  "PEARL",
  "CLOUD",
  "FIELD",
] as const;

export function generatePartyCode(): string {
  const word = PARTY_WORDS[Math.floor(Math.random() * PARTY_WORDS.length)];
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${word}-${num}`;
}
