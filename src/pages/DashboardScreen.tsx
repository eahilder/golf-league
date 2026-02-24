import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Globe, Lock, Trophy, ChevronRight, LogOut, User, Users, Bell, HelpCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import type { League, Profile } from '@/types/database';
import { TutorialModal, useTutorial } from '@/components/TutorialModal';

interface LeagueWithMeta extends League {
  member_count: number;
  active_season: number | null;
  owner_name: string;
  is_member: boolean;
}

interface PendingInvite {
  id: string;
  league_id: string;
  league_name: string;
  invited_by_name: string;
  created_at: string;
}

interface FriendLeague extends LeagueWithMeta {
  friend_name: string;
}

export function DashboardScreen() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { seenBefore } = useTutorial();
  const [myLeagues, setMyLeagues] = useState<LeagueWithMeta[]>([]);
  const [publicLeagues, setPublicLeagues] = useState<LeagueWithMeta[]>([]);
  const [friendLeagues, setFriendLeagues] = useState<FriendLeague[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'my' | 'friends' | 'discover'>('my');
  const [inviteCode, setInviteCode] = useState('');
  const [joiningCode, setJoiningCode] = useState(false);
  const [acceptingInvite, setAcceptingInvite] = useState<string | null>(null);
  const [joinError, setJoinError] = useState('');
  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => { if (profile) fetchAll(); }, [profile]);

  // Auto-show tutorial on first ever visit
  useEffect(() => {
    if (profile && !seenBefore) setShowTutorial(true);
  }, [profile, seenBefore]);

  const fetchAll = async () => {
    if (!profile) return;
    setLoading(true);
    await Promise.all([fetchLeagues(), fetchPendingInvites()]);
    setLoading(false);
  };

  const fetchLeagues = async () => {
    if (!profile) return;

    const { data: memberships, error: memberErr } = await supabase
      .from('league_members').select('league_id').eq('user_id', profile.id);
    if (memberErr) console.error('[Dashboard] memberships error:', memberErr.code, memberErr.message);
    const myLeagueIds = memberships?.map(m => m.league_id) || [];
    console.log('[Dashboard] myLeagueIds:', myLeagueIds.length);

    // My leagues
    if (myLeagueIds.length > 0) {
      const { data: leagues, error: leaguesErr } = await supabase.from('leagues').select('*').in('id', myLeagueIds);
      if (leaguesErr) console.error('[Dashboard] my leagues error:', leaguesErr.code, leaguesErr.message);
      if (leagues) {
        const enriched = await Promise.all(leagues.map(l => enrichLeague(l, true)));
        setMyLeagues(enriched);
      }
    } else {
      setMyLeagues([]);
    }

    // Public leagues not already in
    let publicQuery = supabase.from('leagues').select('*').eq('is_public', true);
    if (myLeagueIds.length > 0) {
      publicQuery = publicQuery.not('id', 'in', `(${myLeagueIds.join(',')})`);
    }
    const { data: publicL, error: publicErr } = await publicQuery;
    if (publicErr) console.error('[Dashboard] leagues error:', publicErr.code, publicErr.message);
    if (publicL) {
      const enriched = await Promise.all(publicL.map(l => enrichLeague(l, false)));
      setPublicLeagues(enriched);
    }

    // Friends' leagues
    const { data: friendships } = await supabase
      .from('friendships')
      .select('requester_id, addressee_id')
      .or(`requester_id.eq.${profile.id},addressee_id.eq.${profile.id}`)
      .eq('status', 'accepted');

    if (friendships && friendships.length > 0) {
      const friendIds = friendships.map(f => f.requester_id === profile.id ? f.addressee_id : f.requester_id);
      const { data: friendProfiles } = await supabase.from('profiles').select('id, discord_username').in('id', friendIds);
      const friendMap = new Map((friendProfiles || []).map((p: Pick<Profile,'id'|'discord_username'>) => [p.id, p.discord_username]));

      const { data: friendMemberships } = await supabase
        .from('league_members').select('league_id, user_id').in('user_id', friendIds);
      const friendLeagueIds = [...new Set((friendMemberships || [])
        .map((m: {league_id: string; user_id: string}) => m.league_id)
        .filter((id: string) => !myLeagueIds.includes(id)))];

      if (friendLeagueIds.length > 0) {
        const { data: fLeagues } = await supabase.from('leagues').select('*').in('id', friendLeagueIds);
        if (fLeagues) {
          const enriched = await Promise.all(fLeagues.map(async l => {
            const base = await enrichLeague(l, false);
            const memberRow = (friendMemberships || []).find((m: {league_id: string; user_id: string}) => m.league_id === l.id);
            return { ...base, friend_name: friendMap.get(memberRow?.user_id || '') || 'Friend' };
          }));
          setFriendLeagues(enriched);
        }
      }
    }
  };

  const enrichLeague = async (l: League, isMember: boolean): Promise<LeagueWithMeta> => {
    const [{ count }, { data: season }, { data: owner }] = await Promise.all([
      supabase.from('league_members').select('*', { count: 'exact', head: true }).eq('league_id', l.id),
      supabase.from('seasons').select('season_number').eq('league_id', l.id).eq('status', 'active').single(),
      supabase.from('profiles').select('discord_username').eq('id', l.owner_id).single(),
    ]);
    return { ...l, member_count: count || 0, active_season: season?.season_number || null, owner_name: owner?.discord_username || 'Unknown', is_member: isMember };
  };

  const fetchPendingInvites = async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('league_invites')
      .select('id, league_id, invited_by, created_at')
      .eq('invited_user_id', profile.id)
      .eq('status', 'pending');

    if (!data || data.length === 0) { setPendingInvites([]); return; }

    const leagueIds = data.map((i: {league_id: string}) => i.league_id);
    const inviterIds = data.map((i: {invited_by: string}) => i.invited_by);

    const [{ data: leagues }, { data: inviters }] = await Promise.all([
      supabase.from('leagues').select('id, name').in('id', leagueIds),
      supabase.from('profiles').select('id, discord_username').in('id', inviterIds),
    ]);

    const leagueMap = new Map((leagues || []).map((l: {id:string;name:string}) => [l.id, l.name]));
    const inviterMap = new Map((inviters || []).map((p: {id:string;discord_username:string}) => [p.id, p.discord_username]));

    setPendingInvites(data.map((i: {id:string;league_id:string;invited_by:string;created_at:string}) => ({
      id: i.id,
      league_id: i.league_id,
      league_name: leagueMap.get(i.league_id) || 'Unknown League',
      invited_by_name: inviterMap.get(i.invited_by) || 'Someone',
      created_at: i.created_at,
    })));
  };

  const acceptInvite = async (invite: PendingInvite) => {
    if (!profile) return;
    setAcceptingInvite(invite.id);
    await supabase.from('league_invites').update({ status: 'accepted' }).eq('id', invite.id);
    await supabase.from('league_members').insert({ league_id: invite.league_id, user_id: profile.id, role: 'member' });
    setPendingInvites(prev => prev.filter(i => i.id !== invite.id));
    await fetchLeagues();
    setAcceptingInvite(null);
  };

  const declineInvite = async (inviteId: string) => {
    await supabase.from('league_invites').update({ status: 'declined' }).eq('id', inviteId);
    setPendingInvites(prev => prev.filter(i => i.id !== inviteId));
  };

  const joinByCode = async () => {
    if (!inviteCode.trim() || !profile) return;
    setJoiningCode(true);
    setJoinError('');
    const { data: league } = await supabase.from('leagues').select('*').eq('invite_code', inviteCode.trim().toUpperCase()).single();
    if (!league) { setJoinError('Invalid invite code.'); setJoiningCode(false); return; }
    const { error } = await supabase.from('league_members').insert({ league_id: league.id, user_id: profile.id, role: 'member' });
    if (error) { setJoinError('Already a member or error joining.'); } else { setInviteCode(''); fetchLeagues(); }
    setJoiningCode(false);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Top Bar */}
      <div className="flex-shrink-0 px-6 py-4 flex items-center justify-between border-b border-[var(--color-border)]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[var(--color-primary)] flex items-center justify-center text-lg">⛳</div>
          <div>
            <h1 className="font-display text-xl font-black uppercase tracking-wide text-white">The Clubhouse</h1>
            <p className="text-xs text-[var(--color-text-muted)]">{profile?.discord_username}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowTutorial(true)} className="p-2.5 rounded-lg bg-[var(--color-surface-light)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-white transition-colors" title="How to use The Clubhouse">
            <HelpCircle size={18} />
          </button>
          <button onClick={() => navigate('/friends')} className="p-2.5 rounded-lg bg-[var(--color-surface-light)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-white transition-colors relative">
            <Users size={18} />
          </button>
          <button onClick={() => navigate('/profile')} className="p-2.5 rounded-lg bg-[var(--color-surface-light)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-white transition-colors">
            <User size={18} />
          </button>
          <button onClick={signOut} className="p-2.5 rounded-lg bg-[var(--color-surface-light)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-error)] transition-colors">
            <LogOut size={18} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-6 space-y-5 animate-fade-in">

          {/* Pending Invites */}
          {pendingInvites.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-muted)] flex items-center gap-2">
                <Bell size={14} className="text-[var(--color-primary)]" />
                League Invites
                <span className="w-5 h-5 rounded-full bg-[var(--color-primary)] text-black text-xs flex items-center justify-center font-bold">{pendingInvites.length}</span>
              </h3>
              <div className="card overflow-hidden">
                {pendingInvites.map(inv => (
                  <div key={inv.id} className="lb-row">
                    <div className="w-9 h-9 rounded-lg bg-[var(--color-primary)]/20 flex items-center justify-center text-lg flex-shrink-0">⛳</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white truncate">{inv.league_name}</p>
                      <p className="text-xs text-[var(--color-text-muted)]">Invited by {inv.invited_by_name}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => acceptInvite(inv)}
                        disabled={acceptingInvite === inv.id}
                        className="btn btn-primary py-1.5 px-3 text-xs"
                      >
                        Accept
                      </button>
                      <button onClick={() => declineInvite(inv.id)} className="btn btn-ghost py-1.5 px-3 text-xs">
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Create + Join */}
          <div className="flex gap-3">
            <button onClick={() => navigate('/leagues/create')} className="btn btn-primary flex-1">
              <Plus size={18} /> Create League
            </button>
            <div className="flex gap-2 flex-1">
              <input className="input flex-1 text-sm" placeholder="Invite code" value={inviteCode} onChange={e => setInviteCode(e.target.value.toUpperCase())} onKeyDown={e => e.key === 'Enter' && joinByCode()} maxLength={8} />
              <button onClick={joinByCode} disabled={joiningCode || !inviteCode} className="btn btn-secondary px-4">Join</button>
            </div>
          </div>
          {joinError && <p className="text-[var(--color-error)] text-sm">{joinError}</p>}

          {/* Tabs */}
          <div className="tab-bar">
            <button className={`tab-item ${tab === 'my' ? 'active' : ''}`} onClick={() => setTab('my')}>
              My Leagues {myLeagues.length > 0 && `(${myLeagues.length})`}
            </button>
            <button className={`tab-item ${tab === 'friends' ? 'active' : ''}`} onClick={() => setTab('friends')}>
              Friends {friendLeagues.length > 0 && `(${friendLeagues.length})`}
            </button>
            <button className={`tab-item ${tab === 'discover' ? 'active' : ''}`} onClick={() => setTab('discover')}>
              Discover
            </button>
          </div>

          {loading ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-20 rounded-xl" />)}</div>
          ) : tab === 'my' ? (
            myLeagues.length === 0 ? (
              <div className="card p-10 text-center">
                <Trophy size={40} className="mx-auto mb-4 text-[var(--color-text-muted)]" />
                <p className="font-display text-xl font-bold text-white">No leagues yet</p>
                <p className="text-[var(--color-text-muted)] text-sm mt-1">Create a league or join one with an invite code.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {myLeagues.map(l => <LeagueCard key={l.id} league={l} onClick={() => navigate(`/leagues/${l.id}`)} />)}
              </div>
            )
          ) : tab === 'friends' ? (
            friendLeagues.length === 0 ? (
              <div className="card p-10 text-center">
                <Users size={40} className="mx-auto mb-4 text-[var(--color-text-muted)]" />
                <p className="font-display text-xl font-bold text-white">No friends' leagues</p>
                <p className="text-[var(--color-text-muted)] text-sm mt-1">Add friends to see their leagues here.</p>
                <button onClick={() => navigate('/friends')} className="btn btn-secondary mt-4 mx-auto">Find Friends</button>
              </div>
            ) : (
              <div className="space-y-3">
                {friendLeagues.map(l => (
                  <div key={l.id}>
                    <p className="text-xs text-[var(--color-text-muted)] mb-1.5 px-1">{l.friend_name}'s league</p>
                    <LeagueCard league={l} onClick={() => navigate(`/leagues/${l.id}`)} />
                  </div>
                ))}
              </div>
            )
          ) : (
            publicLeagues.length === 0 ? (
              <div className="card p-10 text-center">
                <Globe size={40} className="mx-auto mb-4 text-[var(--color-text-muted)]" />
                <p className="font-display text-xl font-bold text-white">No public leagues</p>
              </div>
            ) : (
              <div className="space-y-3">
                {publicLeagues.map(l => <LeagueCard key={l.id} league={l} onClick={() => navigate(`/leagues/${l.id}`)} />)}
              </div>
            )
          )}
        </div>
      </div>

      <TutorialModal open={showTutorial} onClose={() => setShowTutorial(false)} />
    </div>
  );
}

function LeagueCard({ league, onClick }: { league: LeagueWithMeta; onClick: () => void }) {
  return (
    <div onClick={onClick} className="card-hover p-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-[var(--color-surface-lighter)] flex items-center justify-center text-2xl flex-shrink-0">
          {league.format === 'singles' ? '🏌️' : '👥'}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-white">{league.name}</span>
            {league.is_public ? <Globe size={13} className="text-[var(--color-text-muted)]" /> : <Lock size={13} className="text-[var(--color-text-muted)]" />}
          </div>
          <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)] mt-0.5">
            <span>{league.format === 'singles' ? 'Singles' : `Scramble ${league.team_size}v${league.team_size}`}</span>
            <span>•</span>
            <span>{league.member_count} members</span>
            <span>•</span>
            <span>by {league.owner_name}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        {league.active_season && <span className="badge badge-yellow">S{league.active_season}</span>}
        <ChevronRight size={18} className="text-[var(--color-text-muted)]" />
      </div>
    </div>
  );
}
