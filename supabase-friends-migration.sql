-- ============================================================
-- League Day - Friends & Direct Invites Migration
-- ============================================================

-- Friendships (bi-directional via status)
CREATE TABLE friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(requester_id, addressee_id)
);

-- Direct league invites (user-to-user)
CREATE TABLE league_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES profiles(id),
  invited_user_id UUID NOT NULL REFERENCES profiles(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(league_id, invited_user_id)
);

-- RLS
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_invites ENABLE ROW LEVEL SECURITY;

-- Friendships: visible to both parties
CREATE POLICY "Friendships visible to participants" ON friendships
  FOR SELECT USING (auth.uid() = requester_id OR auth.uid() = addressee_id);
CREATE POLICY "Users can send friend requests" ON friendships
  FOR INSERT WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "Addressee can update status" ON friendships
  FOR UPDATE USING (auth.uid() = addressee_id OR auth.uid() = requester_id);
CREATE POLICY "Users can remove friendships" ON friendships
  FOR DELETE USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- League invites: visible to invited user and league owner
CREATE POLICY "Invited user can see their invites" ON league_invites
  FOR SELECT USING (auth.uid() = invited_user_id OR auth.uid() = invited_by);
CREATE POLICY "League members can send invites" ON league_invites
  FOR INSERT WITH CHECK (
    auth.uid() = invited_by AND
    EXISTS (SELECT 1 FROM league_members WHERE league_id = league_invites.league_id AND user_id = auth.uid())
  );
CREATE POLICY "Invited user can update invite status" ON league_invites
  FOR UPDATE USING (auth.uid() = invited_user_id);
