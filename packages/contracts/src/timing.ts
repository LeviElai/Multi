/** Shared server deadlines; animation never changes scores or advances a room. */
export const READING_MS = 5000;
export const ANSWER_MS = 2000;
export const COMPARISON_MS = 2000;
export const POINTS_MS = 1500;
export const REVEAL_MS = ANSWER_MS + COMPARISON_MS + POINTS_MS;
export const STANDINGS_MS = 10000;
export function revealStep(remainingMs:number) {
 const elapsed=REVEAL_MS-Math.max(0,remainingMs);
 return elapsed<ANSWER_MS?'answer':elapsed<ANSWER_MS+COMPARISON_MS?'comparison':'points';
}
