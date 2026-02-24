// AI-powered scorecard parsing via Cloudflare Worker proxy
const WORKER_URL = import.meta.env.VITE_SCORECARD_WORKER_URL || '';

export interface ScorecardStats {
  score: number;
}

export interface ParseResult {
  success: boolean;
  stats?: ScorecardStats;
  error?: string;
}

export async function parseScorecard(
  imageBase64: string,
  playerName: string
): Promise<ParseResult> {
  if (!WORKER_URL) {
    return { success: false, error: 'Scorecard worker URL not configured' };
  }
  try {
    const response = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_base64: imageBase64, player_name: playerName }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }));
      return { success: false, error: `Worker error: ${(errorData as { error?: string }).error || response.statusText}` };
    }
    return await response.json() as ParseResult;
  } catch (err) {
    return { success: false, error: `Network error: ${err}` };
  }
}
