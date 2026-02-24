/**
 * Discord webhook integration.
 * Posts round results to a configured Discord channel.
 */

interface WebhookEmbed {
  title?: string;
  description?: string;
  color?: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string };
  timestamp?: string;
}

interface WebhookPayload {
  username?: string;
  avatar_url?: string;
  content?: string;
  embeds?: WebhookEmbed[];
}

async function sendWebhook(url: string, payload: WebhookPayload): Promise<void> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    console.error('Discord webhook failed:', res.status, await res.text());
  }
}

// Yellow color for Uneekor theme
const LEAGUE_COLOR = 0xF5C300;

export interface RoundResultEntry {
  name: string;       // player or team name
  score: number;      // gross score
  netScore?: number;  // singles net score
  points: number;     // 0, 0.5, or 1
  position: number;
}

export async function postRoundComplete(
  webhookUrl: string,
  leagueName: string,
  roundNumber: number,
  seasonNumber: number,
  courseName: string,
  coursePar: number,
  format: 'singles' | 'scramble',
  results: RoundResultEntry[]
): Promise<void> {
  const posEmoji = (pos: number) => pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : `${pos}.`;
  const pointsStr = (pts: number) => pts === 1 ? '**1 pt**' : pts === 0.5 ? '**½ pt**' : '0 pts';

  const rows = results
    .sort((a, b) => a.position - b.position)
    .map(r => {
      const scoreLabel = format === 'singles' && r.netScore !== undefined
        ? `${r.score} gross / ${r.netScore} net`
        : `${r.score}`;
      return `${posEmoji(r.position)} **${r.name}** — ${scoreLabel} — ${pointsStr(r.points)}`;
    })
    .join('\n');

  await sendWebhook(webhookUrl, {
    username: 'The Clubhouse',
    embeds: [{
      title: `⛳ Round ${roundNumber} Complete — ${leagueName}`,
      description: `**${courseName}** (Par ${coursePar})\nSeason ${seasonNumber}\n\n${rows}`,
      color: LEAGUE_COLOR,
      footer: { text: 'The Clubhouse' },
      timestamp: new Date().toISOString(),
    }],
  });
}

export async function postRoundOpen(
  webhookUrl: string,
  leagueName: string,
  roundNumber: number,
  seasonNumber: number,
  courseName: string,
  coursePar: number,
  memberNames: string[]
): Promise<void> {
  await sendWebhook(webhookUrl, {
    username: 'The Clubhouse',
    embeds: [{
      title: `🏌️ Round ${roundNumber} Is Live — ${leagueName}`,
      description: `**Course:** ${courseName} (Par ${coursePar})\n**Season:** ${seasonNumber}\n\nGet your scores in!\n\n${memberNames.map(n => `• ${n}`).join('\n')}`,
      color: LEAGUE_COLOR,
      footer: { text: 'The Clubhouse' },
      timestamp: new Date().toISOString(),
    }],
  });
}

export async function postSeasonComplete(
  webhookUrl: string,
  leagueName: string,
  seasonNumber: number,
  champion: string,
  totalPoints: number
): Promise<void> {
  await sendWebhook(webhookUrl, {
    username: 'The Clubhouse',
    embeds: [{
      title: `🏆 Season ${seasonNumber} Champion — ${leagueName}`,
      description: `**${champion}** wins Season ${seasonNumber} with **${totalPoints} points**!\n\nCongratulations! 🎉`,
      color: LEAGUE_COLOR,
      footer: { text: 'The Clubhouse' },
      timestamp: new Date().toISOString(),
    }],
  });
}
