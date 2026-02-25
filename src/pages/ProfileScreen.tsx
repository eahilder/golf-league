import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Trophy, Target, Hash, TrendingUp, UserPlus, Check, Users, Loader2, RefreshCw, Download } from 'lucide-react';
import { AppPage } from '@/components/AppPage';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useUpdater } from '@/hooks/useUpdater';
import type { Profile, League } from '@/types/database';

interface Stats {
  totalLeagues: number;
  totalRounds: number;
  totalWins: number;
  totalTies: number;
  totalPoints: number;
}

interface SharedLeague extends League {
  season_number: number | null;
}

export function ProfileScreen() {
  const { userId } = useParams<{ userId?: string }>();
  const { profile: myProfile, signOut } = useAuth();

  // If no userId param, show own profile
  const targetId = userId || myProfile?.id;
  const isOwnProfile = !userId || userId === myProfile?.id;

  const [targetProfile, setTargetProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<Stats>({ totalLeagues: 0, totalRounds: 0, totalWins: 0, totalTies: 0, totalPoints: 0 });
  const [sharedLeagues, setSharedLeagues] = useState<SharedLeague[]>([]);
  const [friendStatus, setFriendStatus] = useState<'none' | 'pending_out' | 'pending_in' | 'friends'>('none');
  const [friendshipId, setFriendshipId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const { update, installing, checking, checked, checkNow, installUpdate } = useUpdater();

  useEffect(() => { if (targetId) fetchData(); }, [targetId, myProfile]);

  const fetchData = async () => {
    if (!targetId || !myProfile) return;
    setLoading(true);

    const [{ data: prof }, { data: standingData }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', targetId).single(),
      supabase.from('season_standings').select('total_points, wins, ties, rounds_played').eq('user_id', targetId),
    ]);

    setTargetProfile(prof as Profile | null);

    const totalWins = (standingData || []).reduce((s, r) => s + (r.wins || 0), 0);
    const totalTies = (standingData || []).reduce((s, r) => s + (r.ties || 0), 0);
    const totalPoints = (standingData || []).reduce((s, r) => s + (r.total_points || 0), 0);
    const totalRounds = (standingData || []).reduce((s, r) => s + (r.rounds_played || 0), 0);

    const { count: leagueCount } = await supabase
      .from('league_members')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', targetId);

    setStats({ totalLeagues: leagueCount || 0, totalRounds, totalWins, totalTies, totalPoints });

    // Shared leagues (leagues both users are in)
    if (!isOwnProfile) {
      const [{ data: myMemberships }, { data: theirMemberships }] = await Promise.all([
        supabase.from('league_members').select('league_id').eq('user_id', myProfile.id),
        supabase.from('league_members').select('league_id').eq('user_id', targetId),
      ]);
      const myIds = new Set((myMemberships || []).map((m: { league_id: string }) => m.league_id));
      const sharedIds = (theirMemberships || [])
        .map((m: { league_id: string }) => m.league_id)
        .filter((id: string) => myIds.has(id));

      if (sharedIds.length > 0) {
        const { data: leagues } = await supabase.from('leagues').select('*').in('id', sharedIds);
        const enriched = await Promise.all((leagues || []).map(async (l: League) => {
          const { data: season } = await supabase.from('seasons').select('season_number').eq('league_id', l.id).eq('status', 'active').single();
          return { ...l, season_number: season?.season_number || null };
        }));
        setSharedLeagues(enriched);
      }

      // Friendship status
      const { data: fs } = await supabase
        .from('friendships')
        .select('*')
        .or(`and(requester_id.eq.${myProfile.id},addressee_id.eq.${targetId}),and(requester_id.eq.${targetId},addressee_id.eq.${myProfile.id})`);

      if (fs && fs.length > 0) {
        const f = fs[0];
        setFriendshipId(f.id);
        if (f.status === 'accepted') setFriendStatus('friends');
        else if (f.requester_id === myProfile.id) setFriendStatus('pending_out');
        else setFriendStatus('pending_in');
      } else {
        setFriendStatus('none');
        setFriendshipId(null);
      }
    }

    setLoading(false);
  };

  const sendFriendRequest = async () => {
    if (!myProfile || !targetId) return;
    setActionLoading(true);
    await supabase.from('friendships').insert({ requester_id: myProfile.id, addressee_id: targetId, status: 'pending' });
    setFriendStatus('pending_out');
    setActionLoading(false);
  };

  const acceptFriendRequest = async () => {
    if (!friendshipId) return;
    setActionLoading(true);
    await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId);
    setFriendStatus('friends');
    setActionLoading(false);
  };

  const removeFriend = async () => {
    if (!friendshipId) return;
    setActionLoading(true);
    await supabase.from('friendships').delete().eq('id', friendshipId);
    setFriendStatus('none');
    setFriendshipId(null);
    setActionLoading(false);
  };

  if (loading) return (
    <AppPage title="Profile">
      <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-24 rounded-xl" />)}</div>
    </AppPage>
  );

  if (!targetProfile) return (
    <AppPage title="Profile"><p className="text-[var(--color-text-muted)]">Player not found.</p></AppPage>
  );

  const winRate = stats.totalRounds > 0 ? ((stats.totalWins / stats.totalRounds) * 100).toFixed(0) : '0';

  return (
    <AppPage title={isOwnProfile ? 'Profile' : targetProfile.discord_username} backTo={isOwnProfile ? '/dashboard' : '/friends'}>
      <div className="space-y-6">

        {/* Profile Card */}
        <div className="card-accent p-6 flex items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            {targetProfile.discord_avatar ? (
              <img
                src={`https://cdn.discordapp.com/avatars/${targetProfile.discord_id}/${targetProfile.discord_avatar}.png`}
                alt="Avatar"
                className="w-20 h-20 rounded-2xl"
              />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-[var(--color-primary)] flex items-center justify-center text-3xl font-black text-black">
                {targetProfile.discord_username.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h2 className="font-display text-3xl font-black text-white">{targetProfile.discord_username}</h2>
              <p className="text-[var(--color-text-muted)] text-sm mt-1">Discord</p>
              <div className="mt-2 flex gap-2 flex-wrap">
                <span className="badge badge-yellow">⛳ Golfer</span>
                {friendStatus === 'friends' && <span className="badge badge-green">Friends</span>}
              </div>
            </div>
          </div>

          {/* Friend action button */}
          {!isOwnProfile && (
            <div className="flex-shrink-0">
              {friendStatus === 'none' && (
                <button onClick={sendFriendRequest} disabled={actionLoading} className="btn btn-primary gap-2">
                  {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                  Add Friend
                </button>
              )}
              {friendStatus === 'pending_out' && (
                <span className="badge badge-gray text-sm px-4 py-2">Request Sent</span>
              )}
              {friendStatus === 'pending_in' && (
                <button onClick={acceptFriendRequest} disabled={actionLoading} className="btn btn-primary gap-2">
                  {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  Accept Request
                </button>
              )}
              {friendStatus === 'friends' && (
                <button onClick={removeFriend} disabled={actionLoading} className="btn btn-secondary gap-2 text-[var(--color-text-muted)]">
                  <Users size={16} />
                  Friends
                </button>
              )}
            </div>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="stat-box">
            <span className="stat-box-label">Leagues</span>
            <span className="stat-box-value">{stats.totalLeagues}</span>
            <span className="stat-box-sub">Active memberships</span>
          </div>
          <div className="stat-box">
            <span className="stat-box-label">Total Points</span>
            <span className="stat-box-value text-[var(--color-primary)]">{stats.totalPoints}</span>
            <span className="stat-box-sub">All-time</span>
          </div>
          <div className="stat-box">
            <span className="stat-box-label">Wins</span>
            <span className="stat-box-value">{stats.totalWins}</span>
            <span className="stat-box-sub">{stats.totalRounds} rounds played</span>
          </div>
          <div className="stat-box">
            <span className="stat-box-label">Win Rate</span>
            <span className="stat-box-value">{winRate}%</span>
            <span className="stat-box-sub">{stats.totalTies} ties</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: Trophy, label: 'Wins', value: stats.totalWins },
            { icon: Target, label: 'Rounds', value: stats.totalRounds },
            { icon: Hash, label: 'Ties', value: stats.totalTies },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="card p-4 flex flex-col items-center gap-1">
              <Icon size={20} className="text-[var(--color-primary)]" />
              <span className="font-display text-2xl font-black text-white">{value}</span>
              <span className="text-xs text-[var(--color-text-muted)]">{label}</span>
            </div>
          ))}
        </div>

        {stats.totalRounds > 0 && (
          <div className="card p-4 flex items-center gap-4">
            <TrendingUp size={24} className="text-[var(--color-primary)] flex-shrink-0" />
            <div>
              <p className="font-semibold text-white">Scoring Average</p>
              <p className="text-sm text-[var(--color-text-muted)]">
                {(stats.totalPoints / stats.totalRounds).toFixed(2)} points per round
              </p>
            </div>
          </div>
        )}

        {/* Shared Leagues */}
        {!isOwnProfile && sharedLeagues.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Shared Leagues</h3>
            <div className="card overflow-hidden">
              {sharedLeagues.map(l => (
                <div key={l.id} className="lb-row">
                  <span className="text-xl">{l.format === 'singles' ? '🏌️' : '👥'}</span>
                  <div className="flex-1">
                    <p className="font-semibold text-white">{l.name}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{l.format === 'singles' ? 'Singles' : `Scramble ${l.team_size}v${l.team_size}`}</p>
                  </div>
                  {l.season_number && <span className="badge badge-yellow">S{l.season_number}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Own profile actions */}
        {isOwnProfile && (
          <>
            <div className="divider" />

            {/* Check for Updates */}
            <div className="card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-white">App Updates</p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    {update
                      ? `Version ${update.version} available`
                      : checked && !update
                      ? 'You\'re up to date'
                      : 'Check for the latest version'}
                  </p>
                </div>
                {update ? (
                  <button onClick={installUpdate} disabled={installing} className="btn btn-primary gap-2">
                    {installing ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                    {installing ? 'Installing…' : 'Install'}
                  </button>
                ) : (
                  <button onClick={checkNow} disabled={checking} className="btn btn-secondary gap-2">
                    <RefreshCw size={14} className={checking ? 'animate-spin' : ''} />
                    {checking ? 'Checking…' : 'Check'}
                  </button>
                )}
              </div>
            </div>

            <button onClick={signOut} className="btn btn-danger w-full">Sign Out</button>
          </>
        )}
      </div>
    </AppPage>
  );
}
