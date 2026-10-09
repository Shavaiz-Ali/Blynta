import type { HighlightDto } from './services/highlight-detection.service';
import { highlightDurationSeconds } from './highlight-duration';

type Choice = { seconds: number; score: number; clips: HighlightDto[] };

/** Weighted interval scheduling with a duration frontier and a separate plan cap. */
export function strongestCombination(
  candidates: HighlightDto[],
  cap: number,
  allowance: number,
): HighlightDto[] {
  const ordered = [...candidates].sort(
    (a, b) => a.endTime - b.endTime || b.score - a.score,
  );
  const empty: Choice[][] = Array.from({ length: cap + 1 }, (_, i) =>
    i === 0 ? [{ seconds: 0, score: 0, clips: [] }] : [],
  );
  const rows: Choice[][][] = [];
  for (let i = 0; i < ordered.length; i++) {
    const clip = ordered[i];
    let previous = i - 1;
    while (previous >= 0 && ordered[previous].endTime > clip.startTime)
      previous--;
    const compatible = rows[previous] ?? empty;
    const skipped = rows[i - 1] ?? empty;
    const row = skipped.map((choices, count) => {
      const added =
        count === 0
          ? []
          : compatible[count - 1]
              .map((choice) => ({
                seconds: Number(
                  (choice.seconds + highlightDurationSeconds(clip)).toFixed(9),
                ),
                score: choice.score + clip.score,
                clips: [...choice.clips, clip],
              }))
              .filter((choice) => choice.seconds <= allowance);
      const possibilities = [...choices, ...added].sort(
        (a, b) => a.seconds - b.seconds || b.score - a.score,
      );
      let bestScore = -1;
      return possibilities.filter((choice) => {
        if (choice.score <= bestScore) return false;
        bestScore = choice.score;
        return true;
      });
    });
    rows.push(row);
  }
  const best = (rows.at(-1) ?? empty)
    .flat()
    .sort((a, b) => b.score - a.score || a.seconds - b.seconds)[0];
  return [...(best?.clips ?? [])].sort(
    (a, b) => b.score - a.score || a.startTime - b.startTime,
  );
}
