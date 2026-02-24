export interface Profile {
  id: string;
  discord_id: string;
  discord_username: string;
  discord_avatar: string | null;
  created_at: string;
}

export interface League {
  id: string;
  name: string;
  owner_id: string;
  format: 'singles' | 'scramble';
  team_size: number | null; // 2, 3, or 4 — only for scramble
  rounds_per_season: number;
  is_public: boolean;
  invite_code: string;
  discord_webhook_url: string | null;
  created_at: string;
}

export interface LeagueMember {
  id: string;
  league_id: string;
  user_id: string;
  role: 'owner' | 'captain' | 'member';
  joined_at: string;
}

export interface Season {
  id: string;
  league_id: string;
  season_number: number;
  rounds_total: number;
  status: 'active' | 'completed';
  created_at: string;
}

export interface Team {
  id: string;
  season_id: string;
  league_id: string;
  name: string;
  emoji: string;
  handicap: number;
  created_at: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  is_captain: boolean;
}

export interface Handicap {
  id: string;
  league_id: string;
  user_id: string;
  strokes: number;
  updated_by: string;
  updated_at: string;
}

export interface HandicapHistory {
  id: string;
  league_id: string;
  user_id: string;
  old_strokes: number;
  new_strokes: number;
  updated_by: string;
  updated_at: string;
}

export interface Round {
  id: string;
  season_id: string;
  league_id: string;
  round_number: number;
  course_name: string;
  course_location: string;
  course_par: number;
  status: 'pending' | 'active' | 'completed';
  created_at: string;
}

// For singles leagues
export interface Score {
  id: string;
  round_id: string;
  user_id: string;
  gross_score: number;
  net_score: number;
  handicap_used: number;
  scorecard_image_url: string | null;
  submitted_at: string;
}

// For scramble leagues
export interface TeamScore {
  id: string;
  round_id: string;
  team_id: string;
  gross_score: number;
  submitted_by: string;
  scorecard_image_url: string | null;
  submitted_at: string;
}

// Match play results per round
export interface RoundResult {
  id: string;
  round_id: string;
  user_id: string | null;   // singles
  team_id: string | null;   // scramble
  points: number;           // 1, 0.5, or 0
  position: number;
  gross_score: number | null;
  net_score: number | null;
}

// Season-long standings
export interface SeasonStanding {
  id: string;
  season_id: string;
  user_id: string | null;   // singles
  team_id: string | null;   // scramble
  total_points: number;
  wins: number;
  ties: number;
  rounds_played: number;
}
