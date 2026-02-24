import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Trophy, Medal } from 'lucide-react';
import { AppPage } from '@/components/AppPage';
import { supabase } from '@/lib/supabase';
import { formatPoints } from '@/lib/scoring';
import type { League, Season, SeasonStanding, RoundResult, Round, Profile, Team } from '@/types/database';

interface StandingRow extends SeasonStanding {
  displayName: string;
  roundHistory: { roundNumber: number; points: number; score: number | null }[];
}

export function SeasonStandingsScreen() {
  const { leagueId, seasonId } = useParams<{ leagueId: string; seasonId: string }>();
  const [league, setLeague] = useState<League | null>(null);
  const [season, setSeason] = useState<Season | null>(null);
  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (seasonId && leagueId) fetchData(); }, [seasonId, leagueId]);

  const fetchData = async () => {
    if (!seasonId || !leagueId) return;
    setLoading(true);

    const [{ data: leagueData }, { data: seasonData }, { data: roundData }, { data: standingData }] = await Promise.all([
      supabase.from('leagues').select('*').eq('id', leagueId).single(),
      supabase.from('seasons').select('*').eq('id', seasonId).single(),
      supabase.from('rounds').select('*').eq('season_id', seasonId).eq('status', 'completed').order('round_number'),
      supabase.from('season_standings').select('*').eq('season_id', seasonId).order('total_points', { ascending: false }),
    ]);

    if (!leagueData || !standingData) { setLoading(false); return; }
    setLeague(leagueData as League);
    setSeason(seasonData as Season);
    setRounds((roundData || []) as Round[]);

    // Fetch round results for all rounds
    const { data: results } = await supabase
      .from('round_results')
      .select('*')
      .in('round_id', ((roundData || []) as Round[]).map(r => r.id));

    // Build display names
    let nameMap = new Map<string, string>();
    if (leagueData.format === 'singles') {
      const ids = standingData.map((s: SeasonStanding) => s.user_id).filter(Boolean);
      const { data: profiles } = await supabase.from('profiles').select('id, discord_username').in('id', ids);
      nameMap = new Map((profiles || []).map((p: Pick<Profile,'id'|'discord_username'>) => [p.id, p.discord_username]));
    } else {
      const ids = standingData.map((s: SeasonStanding) => s.team_id).filter(Boolean);
      const { data: teams } = await supabase.from('teams').select('id, name, emoji').in('id', ids);
      nameMap = new Map((teams || []).map((t: Pick<Team,'id'|'name'|'emoji'>) => [t.id, `${t.emoji} ${t.name}`]));
    }

    const enriched: StandingRow[] = standingData.map((s: SeasonStanding) => {
      const entityId = leagueData.format === 'singles' ? s.user_id : s.team_id;
      const roundHistory = ((roundData || []) as Round[]).map((r) => {
        const result = (results || []).find((res: RoundResult) =>
          res.round_id === r.id && (leagueData.format === 'singles' ? res.user_id === entityId : res.team_id === entityId)
        );
        return {
          roundNumber: r.round_number,
          points: result?.points ?? 0,
          score: result?.net_score ?? result?.gross_score ?? null,
        };
      });
      return {
        ...s,
        displayName: nameMap.get(entityId || '') || 'Unknown',
        roundHistory,
      };
    });

    setStandings(enriched);
    setLoading(false);
  };

  if (loading) return <AppPage title="Standings"><div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="skeleton h-14 rounded-xl" />)}</div></AppPage>;
  if (!league || !season) return <AppPage title="Standings"><p className="text-[var(--color-text-muted)]">Not found.</p></AppPage>;

  return (
    <AppPage title="Season Standings" subtitle={`${league.name} • Season ${season.season_number}`} backTo={`/leagues/${leagueId}`}>
      <div className="space-y-5">

        {/* Top 3 Podium */}
        {standings.length >= 3 && (
          <div className="grid grid-cols-3 gap-3">
            {[standings[1], standings[0], standings[2]].map((s, idx) => {
              const rank = idx === 1 ? 1 : idx === 0 ? 2 : 3;
              return (
                <div key={s.id} className={`card p-4 text-center ${rank === 1 ? 'card-accent' : ''}`}>
                  <div className="text-2xl mb-1">
                    {rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'}
                  </div>
                  <p className="font-bold text-sm text-white truncate">{s.displayName}</p>
                  <p className={`font-display text-2xl font-black ${rank === 1 ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'}`}>
                    {s.total_points}
                    <span className="text-sm font-normal ml-0.5">pts</span>
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {/* Full Standings Table */}
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center gap-2">
            <Trophy size={16} className="text-[var(--color-primary)]" />
            <span className="font-bold text-sm uppercase tracking-wider">Full Standings</span>
          </div>

          {/* Header row */}
          {rounds.length > 0 && (
            <div className="flex items-center px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-surface-light)]">
              <div className="w-8 flex-shrink-0" />
              <div className="flex-1 text-xs text-[var(--color-text-muted)] font-semibold uppercase tracking-wider ml-3">Player/Team</div>
              {rounds.map(r => (
                <div key={r.id} className="w-10 text-center text-xs text-[var(--color-text-muted)] font-semibold">R{r.round_number}</div>
              ))}
              <div className="w-12 text-right text-xs text-[var(--color-primary)] font-semibold uppercase tracking-wider">Pts</div>
            </div>
          )}

          {standings.map((s, i) => (
            <div key={s.id} className={`flex items-center px-4 py-3 border-b border-[var(--color-border)] last:border-0 ${i === 0 ? 'bg-[rgba(245,195,0,0.04)]' : ''}`}>
              <div className={`pos-badge flex-shrink-0 ${i === 0 ? 'pos-1' : i === 1 ? 'pos-2' : i === 2 ? 'pos-3' : 'pos-other'}`}>
                {i < 3 ? <Medal size={14} /> : i + 1}
              </div>
              <div className="flex-1 font-semibold text-white text-sm ml-3 truncate">{s.displayName}</div>
              {s.roundHistory.map(rh => (
                <div key={rh.roundNumber} className="w-10 text-center">
                  <span className={`font-display text-base font-bold ${rh.points === 1 ? 'text-[var(--color-primary)]' : rh.points === 0.5 ? 'text-[var(--color-text-secondary)]' : 'text-[var(--color-text-muted)]'}`}>
                    {formatPoints(rh.points)}
                  </span>
                </div>
              ))}
              <div className="w-12 text-right font-display text-xl font-black text-[var(--color-primary)]">
                {s.total_points}
              </div>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-6 text-xs text-[var(--color-text-muted)]">
          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-[var(--color-primary)]">1</span>
            <span>Win</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-[var(--color-text-secondary)]">½</span>
            <span>Tie</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-[var(--color-text-muted)]">0</span>
            <span>Loss</span>
          </div>
        </div>
      </div>
    </AppPage>
  );
}
