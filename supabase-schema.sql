-- ============================================================
-- League Day - Golf League Management
-- Supabase Schema
-- ============================================================

-- Profiles (linked to Discord via Supabase auth)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  discord_id TEXT UNIQUE,
  discord_username TEXT NOT NULL,
  discord_avatar TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Leagues
CREATE TABLE leagues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES profiles(id),
  format TEXT NOT NULL CHECK (format IN ('singles', 'scramble')),
  team_size INT CHECK (team_size IN (2, 3, 4)),  -- scramble only
  rounds_per_season INT NOT NULL DEFAULT 10,
  is_public BOOLEAN NOT NULL DEFAULT false,
  invite_code TEXT UNIQUE NOT NULL,
  discord_webhook_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- League Members
CREATE TABLE league_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'captain', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(league_id, user_id)
);

-- Seasons
CREATE TABLE seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  season_number INT NOT NULL,
  rounds_total INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(league_id, season_number)
);

-- Teams (scramble leagues only)
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID REFERENCES seasons(id) ON DELETE CASCADE,
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '⛳',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Team Members
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_captain BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(team_id, user_id)
);

-- Handicaps (singles leagues)
CREATE TABLE handicaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  strokes INT NOT NULL DEFAULT 0 CHECK (strokes >= 0 AND strokes <= 54),
  updated_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(league_id, user_id)
);

-- Handicap History
CREATE TABLE handicap_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  old_strokes INT NOT NULL,
  new_strokes INT NOT NULL,
  updated_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rounds
CREATE TABLE rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  round_number INT NOT NULL,
  course_name TEXT NOT NULL,
  course_location TEXT NOT NULL DEFAULT '',
  course_par INT NOT NULL DEFAULT 72,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(season_id, round_number)
);

-- Scores (singles)
CREATE TABLE scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  gross_score INT NOT NULL CHECK (gross_score >= 50 AND gross_score <= 200),
  net_score INT NOT NULL,
  handicap_used INT NOT NULL DEFAULT 0,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(round_id, user_id)
);

-- Team Scores (scramble)
CREATE TABLE team_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  gross_score INT NOT NULL CHECK (gross_score >= 50 AND gross_score <= 200),
  submitted_by UUID REFERENCES profiles(id),
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(round_id, team_id)
);

-- Round Results (match play points)
CREATE TABLE round_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),    -- singles
  team_id UUID REFERENCES teams(id),        -- scramble
  points DECIMAL(3,1) NOT NULL DEFAULT 0 CHECK (points IN (0, 0.5, 1)),
  position INT NOT NULL,
  gross_score INT,
  net_score INT
);

-- Season Standings
CREATE TABLE season_standings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),    -- singles
  team_id UUID REFERENCES teams(id),        -- scramble
  total_points DECIMAL(6,1) NOT NULL DEFAULT 0,
  wins INT NOT NULL DEFAULT 0,
  ties INT NOT NULL DEFAULT 0,
  rounds_played INT NOT NULL DEFAULT 0,
  UNIQUE(season_id, user_id),
  UNIQUE(season_id, team_id)
);

-- ============================================================
-- RPC Functions for upserting standings atomically
-- ============================================================

CREATE OR REPLACE FUNCTION upsert_season_standing_singles(
  p_season_id UUID,
  p_user_id UUID,
  p_points DECIMAL,
  p_win INT,
  p_tie INT
) RETURNS VOID AS $$
BEGIN
  INSERT INTO season_standings (season_id, user_id, total_points, wins, ties, rounds_played)
  VALUES (p_season_id, p_user_id, p_points, p_win, p_tie, 1)
  ON CONFLICT (season_id, user_id) DO UPDATE
    SET total_points = season_standings.total_points + p_points,
        wins = season_standings.wins + p_win,
        ties = season_standings.ties + p_tie,
        rounds_played = season_standings.rounds_played + 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION upsert_season_standing_scramble(
  p_season_id UUID,
  p_team_id UUID,
  p_points DECIMAL,
  p_win INT,
  p_tie INT
) RETURNS VOID AS $$
BEGIN
  INSERT INTO season_standings (season_id, team_id, total_points, wins, ties, rounds_played)
  VALUES (p_season_id, p_team_id, p_points, p_win, p_tie, 1)
  ON CONFLICT (season_id, team_id) DO UPDATE
    SET total_points = season_standings.total_points + p_points,
        wins = season_standings.wins + p_win,
        ties = season_standings.ties + p_tie,
        rounds_played = season_standings.rounds_played + 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE handicaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE handicap_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE round_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE season_standings ENABLE ROW LEVEL SECURITY;

-- Profiles: anyone can read, only owner can update
CREATE POLICY "Profiles are viewable by all" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Leagues: public are viewable by all, private only by members
CREATE POLICY "Public leagues viewable by all" ON leagues FOR SELECT USING (is_public = true OR EXISTS (SELECT 1 FROM league_members WHERE league_id = leagues.id AND user_id = auth.uid()));
CREATE POLICY "Anyone can insert a league" ON leagues FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Only owner can update league" ON leagues FOR UPDATE USING (auth.uid() = owner_id);

-- League Members: viewable by members, insert own membership
CREATE POLICY "Members viewable by league members" ON league_members FOR SELECT USING (EXISTS (SELECT 1 FROM league_members lm WHERE lm.league_id = league_members.league_id AND lm.user_id = auth.uid()));
CREATE POLICY "Users can join leagues" ON league_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner can manage members" ON league_members FOR DELETE USING (EXISTS (SELECT 1 FROM leagues WHERE id = league_members.league_id AND owner_id = auth.uid()));

-- Seasons, teams, rounds: viewable by league members
CREATE POLICY "Seasons viewable by members" ON seasons FOR SELECT USING (EXISTS (SELECT 1 FROM league_members WHERE league_id = seasons.league_id AND user_id = auth.uid()));
CREATE POLICY "Owner can manage seasons" ON seasons FOR ALL USING (EXISTS (SELECT 1 FROM leagues WHERE id = seasons.league_id AND owner_id = auth.uid()));

CREATE POLICY "Teams viewable by members" ON teams FOR SELECT USING (EXISTS (SELECT 1 FROM league_members WHERE league_id = teams.league_id AND user_id = auth.uid()));
CREATE POLICY "Owner can manage teams" ON teams FOR ALL USING (EXISTS (SELECT 1 FROM leagues WHERE id = teams.league_id AND owner_id = auth.uid()));

CREATE POLICY "Team members viewable by league members" ON team_members FOR SELECT USING (EXISTS (SELECT 1 FROM teams t JOIN league_members lm ON lm.league_id = t.league_id WHERE t.id = team_members.team_id AND lm.user_id = auth.uid()));
CREATE POLICY "Owner can manage team members" ON team_members FOR ALL USING (EXISTS (SELECT 1 FROM teams t JOIN leagues l ON l.id = t.league_id WHERE t.id = team_members.team_id AND l.owner_id = auth.uid()));

CREATE POLICY "Rounds viewable by members" ON rounds FOR SELECT USING (EXISTS (SELECT 1 FROM league_members WHERE league_id = rounds.league_id AND user_id = auth.uid()));
CREATE POLICY "Owner can manage rounds" ON rounds FOR ALL USING (EXISTS (SELECT 1 FROM leagues WHERE id = rounds.league_id AND owner_id = auth.uid()));

-- Scores: viewable by league members, insert/update by self
CREATE POLICY "Scores viewable by league members" ON scores FOR SELECT USING (EXISTS (SELECT 1 FROM rounds r JOIN league_members lm ON lm.league_id = r.league_id WHERE r.id = scores.round_id AND lm.user_id = auth.uid()));
CREATE POLICY "Users can submit own score" ON scores FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own score" ON scores FOR UPDATE USING (auth.uid() = user_id);

-- Team scores: viewable by league members, any team member can submit (first wins)
CREATE POLICY "Team scores viewable by members" ON team_scores FOR SELECT USING (EXISTS (SELECT 1 FROM rounds r JOIN league_members lm ON lm.league_id = r.league_id WHERE r.id = team_scores.round_id AND lm.user_id = auth.uid()));
CREATE POLICY "Team members can submit team score" ON team_scores FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM team_members WHERE team_id = team_scores.team_id AND user_id = auth.uid()));

-- Results and standings: viewable by league members
CREATE POLICY "Round results viewable by members" ON round_results FOR SELECT USING (EXISTS (SELECT 1 FROM rounds r JOIN league_members lm ON lm.league_id = r.league_id WHERE r.id = round_results.round_id AND lm.user_id = auth.uid()));
CREATE POLICY "Season standings viewable by members" ON season_standings FOR SELECT USING (EXISTS (SELECT 1 FROM seasons s JOIN league_members lm ON lm.league_id = s.league_id WHERE s.id = season_standings.season_id AND lm.user_id = auth.uid()));

-- Handicaps: viewable by league members, managed by owner
CREATE POLICY "Handicaps viewable by members" ON handicaps FOR SELECT USING (EXISTS (SELECT 1 FROM league_members WHERE league_id = handicaps.league_id AND user_id = auth.uid()));
CREATE POLICY "Owner can manage handicaps" ON handicaps FOR ALL USING (EXISTS (SELECT 1 FROM leagues WHERE id = handicaps.league_id AND owner_id = auth.uid()));
CREATE POLICY "Handicap history viewable by members" ON handicap_history FOR SELECT USING (EXISTS (SELECT 1 FROM league_members WHERE league_id = handicap_history.league_id AND user_id = auth.uid()));
