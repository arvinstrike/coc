// Expected stars for an attack, keyed by TH difference (attackerTh - defenderTh).
// Positive delta = hitting down (easier), negative = hitting up (harder).
//
// ponytail: static starting heuristic. P7/F3 plan is to replace this with the
// clan's own historical average per delta after ~20 wars, with an admin
// override (F8). Swap the body of expectedStars for a lookup into that table
// when it exists; callers don't change.
const TABLE: Record<number, number> = {
  2: 3.0, // and anything higher
  1: 2.85,
  0: 2.3,
  [-1]: 1.4,
  [-2]: 0.7,
  [-3]: 0.3, // and anything lower
};

export function expectedStars(deltaTh: number): number {
  const d = Math.max(-3, Math.min(2, deltaTh));
  return TABLE[d];
}
