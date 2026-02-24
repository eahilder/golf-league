/**
 * Match play style weekly scoring.
 *
 * Each round is like a "hole" in match play:
 *   - Lowest score wins the week → 1 point
 *   - Ties for the lead → 0.5 points each
 *   - Everyone else → 0 points
 *
 * For singles, scores are compared by net (gross - handicap).
 * For scramble, scores are compared by gross (the team's stroke total).
 */

export interface ScoringEntry {
  id: string;         // user_id or team_id
  grossScore: number;
  netScore?: number;  // undefined for scramble (use grossScore)
}

export interface ScoringResult {
  id: string;
  points: number;     // 1, 0.5, or 0
  position: number;
  grossScore: number;
  netScore: number | null;
}

export function calculateRoundPoints(
  entries: ScoringEntry[],
  format: 'singles' | 'scramble'
): ScoringResult[] {
  if (entries.length === 0) return [];

  // Determine the comparison score for each entry
  // Use net score when available (singles always, scramble when team handicap is set)
  const scored = entries.map(e => ({
    ...e,
    compareScore: e.netScore ?? e.grossScore,
  }));

  // Sort ascending (lower = better in stroke play)
  scored.sort((a, b) => a.compareScore - b.compareScore);

  // Find the lowest score
  const lowestScore = scored[0].compareScore;

  // Assign positions and points
  const results: ScoringResult[] = [];
  let position = 1;

  for (let i = 0; i < scored.length; i++) {
    const entry = scored[i];
    const isTiedForLead = entry.compareScore === lowestScore;

    results.push({
      id: entry.id,
      points: isTiedForLead ? (scored.filter(e => e.compareScore === lowestScore).length > 1 ? 0.5 : 1) : 0,
      position,
      grossScore: entry.grossScore,
      netScore: format === 'singles' ? (entry.netScore ?? null) : null,
    });

    // Advance position counter
    if (i < scored.length - 1 && scored[i + 1].compareScore !== entry.compareScore) {
      position = i + 2;
    }
  }

  // Attach net score to results
  return results.map(r => ({
    ...r,
    netScore: scored.find(e => e.id === r.id)?.netScore ?? null,
  }));
}

export function formatPoints(points: number): string {
  if (points === 1) return '1';
  if (points === 0.5) return '½';
  return '0';
}

export function formatPointsLong(points: number): string {
  if (points === 1) return '1 pt';
  if (points === 0.5) return '½ pt';
  return '0 pts';
}
