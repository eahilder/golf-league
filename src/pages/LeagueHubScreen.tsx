import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Settings, Copy, Check, ChevronRight, Trophy, Users, Flag, UserPlus, X, Loader2, LogOut } from 'lucide-react';
import { AppPage } from '@/components/AppPage';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import type { League, Season, Round, SeasonStanding, Profile, Team } from '@/types/database';

interface StandingRow extends SeasonStanding {
  displayName: string;
  avatar?: string | null;
}

interface FriendForInvite {
  id: string;
  discord_username: string;
  discord_avatar: string | null;
  discord_id: string | null;
  inviteStatus: 'none' | 'pending' | 'member';
}

export function LeagueHubScreen() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [league, setLeague] = useState<League | null>(null);
  const [season, setSeason] = useState<Season | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [activeRound, setActiveRound] = useState<Round | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState(false);

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [friends, setFriends] = useState<FriendForInvite[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [sendingInvite, setSendingInvite] = useState<string | null>(null);

  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [leavingLeague, setLeavingLeague] = useState(false);

  useEffect(() => {
    if (leagueId) fetchData();
  }, [leagueId, profile]);

  const fetchData = async () => {
    if (!leagueId || !profile) return;
    setLoading(true);

    const [{ data: leagueData }, { data: memberData }] = await Promise.all([
      supabase.from('leagues').select('*').eq('id', leagueId).single(),
      supabase.from('league_members').select('role').eq('league_id', leagueId).eq('user_id', profile.id).single(),
    ]);

    if (!leagueData) { setLoading(false); return; }
    setLeague(leagueData as League);
    setIsOwner(memberData?.role === 'owner');

    // Active season
    const { data: seasonData } = await supabase
      .from('seasons')
      .select('*')
      .eq('league_id', leagueId)
      .eq('status', 'active')
      .single();

    if (seasonData) {
      setSeason(seasonData as Season);

      // Rounds for this season
      const { data: roundData } = await supabase
        .from('rounds')
        .select('*')
        .eq('season_id', seasonData.id)
        .order('round_number', { ascending: true });

      const roundList = (roundData || []) as Round[];
      setRounds(roundList);
      setActiveRound(roundList.find(r => r.status === 'active') || null);

      // Standings
      await fetchStandings(seasonData.id, leagueData as League);
    }

    setLoading(false);
  };

  const fetchStandings = async (seasonId: string, leagueData: League) => {
    const { data: standingData } = await supabase
      .from('season_standings')
      .select('*')
      .eq('season_id', seasonId)
      .order('total_points', { ascending: false });

    if (!standingData) return;

    if (leagueData.format === 'singles') {
      const userIds = standingData.map(s => s.user_id).filter(Boolean);
      const { data: profiles } = await supabase.from('profiles').select('id, discord_username, discord_avatar').in('id', userIds);
      const profileMap = new Map((profiles || []).map((p: Pick<Profile,'id'|'discord_username'|'discord_avatar'>) => [p.id, p]));

      setStandings(standingData.map(s => ({
        ...s,
        displayName: profileMap.get(s.user_id || '')?.discord_username || 'Unknown',
        avatar: profileMap.get(s.user_id || '')?.discord_avatar,
      })));
    } else {
      const teamIds = standingData.map(s => s.team_id).filter(Boolean);
      const { data: teams } = await supabase.from('teams').select('id, name, emoji').in('id', teamIds);
      const teamMap = new Map((teams || []).map((t: Pick<Team,'id'|'name'|'emoji'>) => [t.id, t]));

      setStandings(standingData.map(s => ({
        ...s,
        displayName: `${teamMap.get(s.team_id || '')?.emoji || '⛳'} ${teamMap.get(s.team_id || '')?.name || 'Unknown'}`,
      })));
    }
  };

  const copyInviteCode = () => {
    if (!league) return;
    navigator.clipboard.writeText(league.invite_code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const openInviteModal = async () => {
    if (!profile || !leagueId) return;
    setShowInviteModal(true);
    setLoadingFriends(true);

    // Fetch accepted friendships
    const { data: friendships } = await supabase
      .from('friendships')
      .select('*')
      .or(`requester_id.eq.${profile.id},addressee_id.eq.${profile.id}`)
      .eq('status', 'accepted');

    if (!friendships || friendships.length === 0) {
      setFriends([]);
      setLoadingFriends(false);
      return;
    }

    const friendIds = friendships.map(f =>
      f.requester_id === profile.id ? f.addressee_id : f.requester_id
    );

    // Fetch friend profiles, current members, and pending invites in parallel
    const [{ data: profiles }, { data: members }, { data: pendingInvites }] = await Promise.all([
      supabase.from('profiles').select('id, discord_username, discord_avatar, discord_id').in('id', friendIds),
      supabase.from('league_members').select('user_id').eq('league_id', leagueId),
      supabase.from('league_invites').select('invited_user_id').eq('league_id', leagueId).eq('status', 'pending'),
    ]);

    const memberIds = new Set((members || []).map((m: { user_id: string }) => m.user_id));
    const pendingIds = new Set((pendingInvites || []).map((i: { invited_user_id: string }) => i.invited_user_id));

    const enriched: FriendForInvite[] = (profiles || []).map((p: Pick<Profile, 'id' | 'discord_username' | 'discord_avatar' | 'discord_id'>) => ({
      id: p.id,
      discord_username: p.discord_username,
      discord_avatar: p.discord_avatar || null,
      discord_id: p.discord_id || null,
      inviteStatus: memberIds.has(p.id) ? 'member' : pendingIds.has(p.id) ? 'pending' : 'none',
    }));

    setFriends(enriched);
    setLoadingFriends(false);
  };

  const sendInvite = async (friendId: string) => {
    if (!profile || !leagueId) return;
    setSendingInvite(friendId);
    await supabase.from('league_invites').insert({
      league_id: leagueId,
      invited_by: profile.id,
      invited_user_id: friendId,
      status: 'pending',
    });
    setFriends(prev => prev.map(f => f.id === friendId ? { ...f, inviteStatus: 'pending' } : f));
    setSendingInvite(null);
  };

  const leaveLeague = async () => {
    if (!profile || !leagueId || !league) return;
    setLeavingLeague(true);
    try {
      // For scramble: remove from team first — DB trigger handles empty-team cleanup
      if (league.format !== 'singles') {
        const { data: teams } = await supabase.from('teams').select('id').eq('league_id', leagueId);
        const teamIds = (teams || []).map((t: { id: string }) => t.id);
        if (teamIds.length > 0) {
          await supabase.from('team_members').delete()
            .eq('user_id', profile.id)
            .in('team_id', teamIds);
        }
      }
      // Remove from league — DB trigger cleans up any active round score
      await supabase.from('league_members').delete()
        .eq('league_id', leagueId)
        .eq('user_id', profile.id);
      navigate('/dashboard');
    } catch (err) {
      console.error('Leave league error:', err);
      setLeavingLeague(false);
      setShowLeaveConfirm(false);
    }
  };

  if (loading) return (
    <AppPage title="League"><div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)}</div></AppPage>
  );

  if (!league) return (
    <AppPage title="League"><p className="text-[var(--color-text-muted)]">League not found.</p></AppPage>
  );

  const completedRounds = rounds.filter(r => r.status === 'completed').length;

  return (
    <AppPage
      title={league.name}
      subtitle={season ? `Season ${season.season_number} • ${completedRounds}/${season.rounds_total} rounds` : 'No active season'}
      headerRight={
        isOwner && (
          <button onClick={() => navigate(`/leagues/${leagueId}/admin`)} className="p-2.5 rounded-lg bg-[var(--color-surface-light)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-white transition-colors">
            <Settings size={18} />
          </button>
        )
      }
    >
      <div className="space-y-6">

        {/* Active Round CTA */}
        {activeRound && (
          <button
            onClick={() => navigate(`/leagues/${leagueId}/round/${activeRound.id}`)}
            className="w-full p-5 rounded-2xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] text-black text-left animate-pulse-glow"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider opacity-70">Round {activeRound.round_number} — Active Now</p>
                <p className="font-display text-2xl font-black mt-0.5">{activeRound.course_name}</p>
                <p className="text-sm opacity-70 mt-0.5">{activeRound.course_location} • Par {activeRound.course_par}</p>
              </div>
              <Flag size={32} className="opacity-70" />
            </div>
          </button>
        )}

        {/* Stats Row */}
        {season && (
          <div className="grid grid-cols-3 gap-3">
            <div className="stat-box">
              <span className="stat-box-label">Round</span>
              <span className="stat-box-value">{completedRounds}/{season.rounds_total}</span>
            </div>
            <div className="stat-box">
              <span className="stat-box-label">Format</span>
              <span className="stat-box-value text-lg">{league.format === 'singles' ? 'Singles' : `${league.team_size}v${league.team_size}`}</span>
            </div>
            <div className="stat-box">
              <span className="stat-box-label">Members</span>
              <span className="stat-box-value">{standings.length}</span>
            </div>
          </div>
        )}

        {/* Season Standings */}
        {standings.length > 0 && (
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
              <div className="flex items-center gap-2">
                <Trophy size={16} className="text-[var(--color-primary)]" />
                <span className="font-bold text-sm uppercase tracking-wider">Standings</span>
              </div>
              <button
                onClick={() => season && navigate(`/leagues/${leagueId}/season/${season.id}/standings`)}
                className="text-xs text-[var(--color-primary)] font-semibold flex items-center gap-1"
              >
                Full <ChevronRight size={14} />
              </button>
            </div>
            <div>
              {standings.slice(0, 5).map((row, i) => (
                <div key={row.id} className="lb-row">
                  <div className={`pos-badge ${i === 0 ? 'pos-1' : i === 1 ? 'pos-2' : i === 2 ? 'pos-3' : 'pos-other'}`}>
                    {i + 1}
                  </div>
                  <span className="flex-1 font-semibold text-white">{row.displayName}</span>
                  <div className="text-right">
                    <span className="font-display text-xl font-bold text-[var(--color-primary)]">{row.total_points}</span>
                    <span className="text-xs text-[var(--color-text-muted)] ml-1">pts</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No season yet */}
        {!season && (
          <div className="card p-10 text-center">
            <Trophy size={40} className="mx-auto mb-4 text-[var(--color-text-muted)]" />
            <p className="font-display text-xl font-bold text-white">No active season</p>
            {isOwner ? (
              <p className="text-[var(--color-text-muted)] text-sm mt-1">Go to Admin to start Season 1.</p>
            ) : (
              <p className="text-[var(--color-text-muted)] text-sm mt-1">Waiting for the league owner to start a season.</p>
            )}
          </div>
        )}

        {/* Schedule / Round History */}
        {rounds.length > 0 && (
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center gap-2">
              <Flag size={16} className="text-[var(--color-text-muted)]" />
              <span className="font-bold text-sm uppercase tracking-wider">Schedule</span>
            </div>
            {[...rounds].reverse().map(round => (
              round.status === 'completed' ? (
                <button
                  key={round.id}
                  onClick={() => navigate(`/leagues/${leagueId}/round/${round.id}`)}
                  className="lb-row w-full text-left"
                >
                  <div className="pos-badge pos-other">R{round.round_number}</div>
                  <div className="flex-1">
                    <p className="font-semibold text-white text-sm">{round.course_name}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{round.course_location} • Par {round.course_par}</p>
                  </div>
                  <span className="badge badge-gray">Done</span>
                </button>
              ) : (
                <div key={round.id} className="lb-row">
                  <div className="pos-badge pos-other">R{round.round_number}</div>
                  <div className="flex-1">
                    <p className={`text-sm font-semibold ${round.status === 'pending' ? 'text-[var(--color-text-muted)]' : 'text-white'}`}>{round.course_name}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{round.course_location} • Par {round.course_par}</p>
                  </div>
                  <span className={`badge ${round.status === 'active' ? 'badge-green' : 'badge-yellow'}`}>
                    {round.status === 'active' ? 'Live' : 'Upcoming'}
                  </span>
                </div>
              )
            ))}
          </div>
        )}

        {/* Invite */}
        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users size={18} className="text-[var(--color-text-muted)]" />
              <div>
                <p className="text-sm font-semibold text-white">Invite Code</p>
                <p className="font-display text-xl font-bold text-[var(--color-primary)] tracking-widest">{league.invite_code}</p>
              </div>
            </div>
            <button onClick={copyInviteCode} className="btn btn-secondary px-3 py-2 text-sm">
              {copiedCode ? <Check size={16} /> : <Copy size={16} />}
              {copiedCode ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div className="border-t border-[var(--color-border)] pt-3">
            <button onClick={openInviteModal} className="btn btn-primary w-full gap-2">
              <UserPlus size={16} />
              Invite a Friend
            </button>
          </div>
        </div>

        {/* Leave League */}
        {!isOwner && (
          <button
            onClick={() => setShowLeaveConfirm(true)}
            className="btn btn-danger w-full gap-2"
          >
            <LogOut size={16} />
            Leave League
          </button>
        )}
      </div>

      {/* Leave League Confirmation */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setShowLeaveConfirm(false)}>
          <div className="w-full max-w-sm bg-[var(--color-surface)] rounded-2xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--color-error)]/15 flex items-center justify-center flex-shrink-0">
                <LogOut size={20} className="text-[var(--color-error)]" />
              </div>
              <div>
                <h2 className="font-display text-lg font-black text-white">Leave League?</h2>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{league.name}</p>
              </div>
            </div>
            <p className="text-sm text-[var(--color-text-muted)]">
              You'll lose your spot and any score you submitted for an active round will be removed. You can rejoin with the invite code.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowLeaveConfirm(false)} className="btn btn-secondary flex-1">Cancel</button>
              <button onClick={leaveLeague} disabled={leavingLeague} className="btn btn-danger flex-1 gap-2">
                {leavingLeague ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
                {leavingLeague ? 'Leaving…' : 'Leave'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Friends Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={() => setShowInviteModal(false)}>
          <div
            className="w-full max-w-md bg-[var(--color-surface)] rounded-t-3xl p-6 pb-8 space-y-4 max-h-[70vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-black text-white">Invite Friends</h2>
              <button onClick={() => setShowInviteModal(false)} className="p-2 text-[var(--color-text-muted)] hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 -mx-6 px-6 space-y-1">
              {loadingFriends ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 size={24} className="animate-spin text-[var(--color-primary)]" />
                </div>
              ) : friends.length === 0 ? (
                <div className="text-center py-10">
                  <Users size={32} className="mx-auto mb-3 text-[var(--color-text-muted)]" />
                  <p className="text-[var(--color-text-muted)] text-sm">No friends yet. Add friends from the Friends screen.</p>
                </div>
              ) : (
                friends.map(friend => (
                  <div key={friend.id} className="lb-row">
                    {friend.discord_avatar && friend.discord_id ? (
                      <img
                        src={`https://cdn.discordapp.com/avatars/${friend.discord_id}/${friend.discord_avatar}.png`}
                        alt={friend.discord_username}
                        className="w-9 h-9 rounded-lg flex-shrink-0"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-[var(--color-surface-lighter)] flex items-center justify-center text-sm font-bold text-[var(--color-primary)] flex-shrink-0">
                        {friend.discord_username.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="flex-1 font-semibold text-white truncate">{friend.discord_username}</span>
                    {friend.inviteStatus === 'member' ? (
                      <span className="badge badge-green text-xs">In League</span>
                    ) : friend.inviteStatus === 'pending' ? (
                      <span className="badge badge-gray text-xs">Invited</span>
                    ) : (
                      <button
                        onClick={() => sendInvite(friend.id)}
                        disabled={sendingInvite === friend.id}
                        className="btn btn-primary py-1.5 px-3 text-xs"
                      >
                        {sendingInvite === friend.id ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                        Invite
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </AppPage>
  );
}
