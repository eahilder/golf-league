import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, Plus, Edit2, Check, X, Users, Trophy, Zap } from 'lucide-react';
import { AppPage } from '@/components/AppPage';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { getRandomCourses } from '@/data/courses';
import { postRoundOpen } from '@/lib/discord';
import type { League, Season, Team, Profile, Handicap } from '@/types/database';

export function AdminScreen() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const { profile } = useAuth();

  const [league, setLeague] = useState<League | null>(null);
  const [season, setSeason] = useState<Season | null>(null);
  const [members, setMembers] = useState<Profile[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [handicaps, setHandicaps] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'rounds' | 'teams' | 'handicaps'>('rounds');

  // Editing state — singles handicaps
  const [editingHandicap, setEditingHandicap] = useState<string | null>(null);
  const [handicapInput, setHandicapInput] = useState('');
  const [savingHandicap, setSavingHandicap] = useState(false);

  // Editing state — team handicaps (scramble)
  const [editingTeamHandicap, setEditingTeamHandicap] = useState<string | null>(null);
  const [teamHandicapInput, setTeamHandicapInput] = useState('');
  const [savingTeamHandicap, setSavingTeamHandicap] = useState(false);

  // New team
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamEmoji, setNewTeamEmoji] = useState('⛳');
  const [savingTeam, setSavingTeam] = useState(false);

  // Round / season
  const [startingSeason, setStartingSeason] = useState(false);
  const [completingSeason, setCompletingSeason] = useState(false);

  useEffect(() => { if (leagueId) fetchData(); }, [leagueId]);

  const fetchData = async () => {
    if (!leagueId) return;
    setLoading(true);

    const { data: leagueData } = await supabase.from('leagues').select('*').eq('id', leagueId).single();
    if (!leagueData) { setLoading(false); return; }
    setLeague(leagueData as League);

    const { data: seasonData } = await supabase.from('seasons').select('*').eq('league_id', leagueId).eq('status', 'active').single();
    setSeason(seasonData as Season | null);

    const { data: memberRows } = await supabase.from('league_members').select('user_id').eq('league_id', leagueId);
    const userIds = (memberRows || []).map((m: { user_id: string }) => m.user_id);
    const { data: profileRows } = await supabase.from('profiles').select('*').in('id', userIds);
    setMembers((profileRows || []) as Profile[]);

    if (leagueData.format === 'scramble') {
      const { data: teamData } = await supabase.from('teams').select('*').eq('league_id', leagueId);
      setTeams((teamData || []) as Team[]);
    }

    // Handicaps
    const { data: hcData } = await supabase.from('handicaps').select('user_id, strokes').eq('league_id', leagueId);
    const hcMap = new Map((hcData || []).map((h: Pick<Handicap,'user_id'|'strokes'>) => [h.user_id, h.strokes]));
    setHandicaps(hcMap);

    setLoading(false);
  };

  const startNewSeason = async () => {
    if (!league || !profile) return;
    setStartingSeason(true);
    try {
      const { data: existing } = await supabase.from('seasons').select('season_number').eq('league_id', leagueId!).order('season_number', { ascending: false }).limit(1).single();
      const nextSeason = (existing?.season_number || 0) + 1;

      const { data: newSeason, error } = await supabase.from('seasons').insert({
        league_id: leagueId,
        season_number: nextSeason,
        rounds_total: league.rounds_per_season,
        status: 'active',
      }).select().single();

      if (error || !newSeason) throw error || new Error('Failed to create season');

      // Pre-generate all rounds — Round 1 starts active immediately
      const courses = getRandomCourses(league.rounds_per_season);
      await supabase.from('rounds').insert(
        courses.map((course, i) => ({
          season_id: newSeason.id,
          league_id: leagueId,
          round_number: i + 1,
          course_name: course.name,
          course_location: course.location,
          course_par: course.par,
          status: i === 0 ? 'active' : 'pending',
        }))
      );

      // For scramble leagues, copy teams to this season
      if (league.format === 'scramble' && teams.length > 0) {
        await supabase.from('teams').update({ season_id: newSeason.id }).in('id', teams.map(t => t.id));
      }

      setSeason(newSeason as Season);

      // Initialize standings
      if (league.format === 'singles') {
        for (const m of members) {
          await supabase.from('season_standings').insert({ season_id: newSeason.id, user_id: m.id, total_points: 0, wins: 0, ties: 0, rounds_played: 0 });
        }
      } else if (league.format === 'scramble' && teams.length > 0) {
        for (const t of teams) {
          await supabase.from('season_standings').insert({ season_id: newSeason.id, team_id: t.id, total_points: 0, wins: 0, ties: 0, rounds_played: 0 });
        }
      }

      // Post Discord notification for Round 1
      if (league.discord_webhook_url) {
        await postRoundOpen(league.discord_webhook_url, league.name, 1, nextSeason, courses[0].name, courses[0].par, members.map(m => m.discord_username));
      }
    } finally {
      setStartingSeason(false);
      fetchData();
    }
  };

  const completeSeason = async () => {
    if (!season) return;
    setCompletingSeason(true);
    await supabase.from('seasons').update({ status: 'completed' }).eq('id', season.id);
    setSeason(null);
    setCompletingSeason(false);
    fetchData();
  };

  const saveHandicap = async (userId: string) => {
    if (!leagueId || !profile) return;
    setSavingHandicap(true);
    const strokes = parseInt(handicapInput);
    if (isNaN(strokes) || strokes < 0 || strokes > 54) { setSavingHandicap(false); return; }

    const oldStrokes = handicaps.get(userId) || 0;
    await supabase.from('handicaps').upsert({ league_id: leagueId, user_id: userId, strokes, updated_by: profile.id }, { onConflict: 'league_id,user_id' });
    await supabase.from('handicap_history').insert({ league_id: leagueId, user_id: userId, old_strokes: oldStrokes, new_strokes: strokes, updated_by: profile.id });

    setHandicaps(prev => new Map(prev).set(userId, strokes));
    setEditingHandicap(null);
    setSavingHandicap(false);
  };

  const saveTeamHandicap = async (teamId: string) => {
    setSavingTeamHandicap(true);
    const strokes = parseInt(teamHandicapInput);
    if (isNaN(strokes) || strokes < 0 || strokes > 54) { setSavingTeamHandicap(false); return; }
    await supabase.from('teams').update({ handicap: strokes }).eq('id', teamId);
    setTeams(prev => prev.map(t => t.id === teamId ? { ...t, handicap: strokes } : t));
    setEditingTeamHandicap(null);
    setSavingTeamHandicap(false);
  };

  const addTeam = async () => {
    if (!newTeamName.trim() || !season) return;
    setSavingTeam(true);
    const { data } = await supabase.from('teams').insert({
      season_id: season.id,
      league_id: leagueId,
      name: newTeamName.trim(),
      emoji: newTeamEmoji,
    }).select().single();
    if (data) setTeams(prev => [...prev, data as Team]);
    setNewTeamName('');
    setNewTeamEmoji('⛳');
    setSavingTeam(false);
  };

  const deleteTeam = async (teamId: string) => {
    await supabase.from('teams').delete().eq('id', teamId);
    setTeams(prev => prev.filter(t => t.id !== teamId));
  };


  if (loading) return <AppPage title="Admin"><div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)}</div></AppPage>;
  if (!league) return <AppPage title="Admin"><p className="text-[var(--color-text-muted)]">League not found.</p></AppPage>;

  return (
    <AppPage title="Admin Panel" subtitle={league.name} backTo={`/leagues/${leagueId}`}>
      <div className="space-y-5">

        {/* Season Actions */}
        <div className="card p-4 space-y-3">
          <h3 className="font-display font-bold uppercase tracking-wider flex items-center gap-2">
            <Trophy size={16} className="text-[var(--color-primary)]" /> Season
          </h3>
          {season ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-surface-light)]">
                <span className="text-white font-semibold">Season {season.season_number} — Active</span>
                <span className="badge badge-green">Active</span>
              </div>
              <button onClick={completeSeason} disabled={completingSeason} className="btn btn-secondary w-full">
                {completingSeason ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                End Season
              </button>
            </div>
          ) : (
            <button onClick={startNewSeason} disabled={startingSeason} className="btn btn-primary w-full">
              {startingSeason ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
              Start New Season
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="tab-bar">
          <button className={`tab-item ${tab === 'rounds' ? 'active' : ''}`} onClick={() => setTab('rounds')}>Rounds</button>
          {league.format === 'scramble' && <button className={`tab-item ${tab === 'teams' ? 'active' : ''}`} onClick={() => setTab('teams')}>Teams</button>}
          {league.format === 'singles' && <button className={`tab-item ${tab === 'handicaps' ? 'active' : ''}`} onClick={() => setTab('handicaps')}>Handicaps</button>}
        </div>

        {/* Rounds Tab */}
        {tab === 'rounds' && (
          <RoundsTab leagueId={leagueId!} seasonId={season?.id} />
        )}

        {/* Teams Tab (scramble) */}
        {tab === 'teams' && league.format === 'scramble' && (
          <div className="space-y-4">
            <div className="card p-4 space-y-3">
              <h4 className="font-semibold text-[var(--color-text-secondary)] text-sm uppercase tracking-wider">Add Team</h4>
              <div className="flex gap-2">
                <input className="input w-16 text-center text-xl" value={newTeamEmoji} onChange={e => setNewTeamEmoji(e.target.value)} placeholder="⛳" maxLength={2} />
                <input className="input flex-1" placeholder="Team name" value={newTeamName} onChange={e => setNewTeamName(e.target.value)} />
                <button onClick={addTeam} disabled={savingTeam || !newTeamName.trim()} className="btn btn-primary px-4">
                  {savingTeam ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                </button>
              </div>
            </div>
            <div className="card overflow-hidden">
              {teams.length === 0 ? (
                <div className="p-8 text-center text-[var(--color-text-muted)]">
                  <Users size={32} className="mx-auto mb-2" />
                  <p>No teams yet. Add up to 5 teams.</p>
                </div>
              ) : (
                teams.map(team => (
                  <div key={team.id} className="lb-row">
                    <span className="text-2xl">{team.emoji}</span>
                    <span className="flex-1 font-semibold text-white">{team.name}</span>
                    {editingTeamHandicap === team.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          className="input w-16 text-center text-sm py-1.5"
                          type="number" min={0} max={54}
                          value={teamHandicapInput}
                          onChange={e => setTeamHandicapInput(e.target.value)}
                          autoFocus
                        />
                        <button onClick={() => saveTeamHandicap(team.id)} disabled={savingTeamHandicap} className="p-1.5 text-[var(--color-success)] hover:opacity-80">
                          {savingTeamHandicap ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                        </button>
                        <button onClick={() => setEditingTeamHandicap(null)} className="p-1.5 text-[var(--color-text-muted)] hover:opacity-80">
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-[var(--color-text-muted)]">
                          {team.handicap > 0 ? `-${team.handicap} hcp` : 'no hcp'}
                        </span>
                        <button onClick={() => { setEditingTeamHandicap(team.id); setTeamHandicapInput(String(team.handicap ?? 0)); }} className="p-1.5 text-[var(--color-text-muted)] hover:text-white transition-colors">
                          <Edit2 size={15} />
                        </button>
                        <button onClick={() => deleteTeam(team.id)} className="p-2 text-[var(--color-text-muted)] hover:text-[var(--color-error)] transition-colors">
                          <X size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Handicaps Tab (singles) */}
        {tab === 'handicaps' && league.format === 'singles' && (
          <div className="card overflow-hidden">
            {members.length === 0 ? (
              <div className="p-8 text-center text-[var(--color-text-muted)]">
                <Users size={32} className="mx-auto mb-2" />
                <p>No members yet.</p>
              </div>
            ) : (
              members.map(member => (
                <div key={member.id} className="lb-row">
                  <div className="w-8 h-8 rounded-full bg-[var(--color-surface-lighter)] flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {member.discord_username.charAt(0).toUpperCase()}
                  </div>
                  <span className="flex-1 font-semibold text-white">{member.discord_username}</span>
                  {editingHandicap === member.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        className="input w-16 text-center text-sm py-1.5"
                        type="number" min={0} max={54}
                        value={handicapInput}
                        onChange={e => setHandicapInput(e.target.value)}
                        autoFocus
                      />
                      <button onClick={() => saveHandicap(member.id)} disabled={savingHandicap} className="p-1.5 text-[var(--color-success)] hover:opacity-80">
                        {savingHandicap ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                      </button>
                      <button onClick={() => setEditingHandicap(null)} className="p-1.5 text-[var(--color-text-muted)] hover:opacity-80">
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className="font-display text-xl font-bold text-[var(--color-primary)]">
                        {handicaps.get(member.id) ?? 0}
                      </span>
                      <button onClick={() => { setEditingHandicap(member.id); setHandicapInput(String(handicaps.get(member.id) ?? 0)); }} className="p-1.5 text-[var(--color-text-muted)] hover:text-white transition-colors">
                        <Edit2 size={15} />
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </AppPage>
  );
}

function RoundsTab({ seasonId }: { leagueId: string; seasonId?: string }) {
  const [rounds, setRounds] = useState<Array<{ id: string; round_number: number; course_name: string; course_location: string; course_par: number; status: string }>>([]);

  useEffect(() => {
    if (!seasonId) return;
    supabase.from('rounds').select('*').eq('season_id', seasonId).order('round_number').then(({ data }) => {
      if (data) setRounds(data);
    });
  }, [seasonId]);

  if (!seasonId) return <div className="card p-6 text-center text-[var(--color-text-muted)]">No active season.</div>;
  if (rounds.length === 0) return <div className="card p-6 text-center text-[var(--color-text-muted)]">No rounds yet. Start one above.</div>;

  return (
    <div className="card overflow-hidden">
      {rounds.map(r => (
        <div key={r.id} className="lb-row">
          <div className="pos-badge pos-other">R{r.round_number}</div>
          <div className="flex-1">
            <p className={`font-semibold text-sm ${r.status === 'pending' ? 'text-[var(--color-text-muted)]' : 'text-white'}`}>{r.course_name}</p>
            <p className="text-xs text-[var(--color-text-muted)]">{r.course_location} • Par {r.course_par}</p>
          </div>
          <span className={`badge ${r.status === 'active' ? 'badge-green' : r.status === 'pending' ? 'badge-yellow' : 'badge-gray'}`}>
            {r.status === 'active' ? 'Active' : r.status === 'pending' ? 'Upcoming' : 'Done'}
          </span>
        </div>
      ))}
    </div>
  );
}
