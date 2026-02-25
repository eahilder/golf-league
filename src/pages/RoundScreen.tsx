import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Camera, Loader2, Check, Clock, Trophy, MapPin, Minus, Plus } from 'lucide-react';
import { AppPage } from '@/components/AppPage';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { parseScorecard } from '@/lib/scorecardAI';
import { calculateRoundPoints, formatPoints } from '@/lib/scoring';
import { postRoundComplete, postRoundOpen } from '@/lib/discord';
import { getCourseByName, type CourseCategory } from '@/data/courses';
import { invoke } from '@tauri-apps/api/core';
import type { Round, League, Score, TeamScore, Team, Profile } from '@/types/database';

interface CaptureResult { text: string; image_base64: string; image_path: string | null; }

interface LeaderboardEntry {
  id: string;
  displayName: string;
  grossScore: number | null;
  netScore: number | null;
  points: number | null;
  position: number | null;
  submitted: boolean;
  scorecardUrl: string | null;
}

async function uploadScorecard(base64: string, roundId: string, userId: string): Promise<string | null> {
  try {
    const byteChars = atob(base64);
    const byteArr = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
    const blob = new Blob([byteArr], { type: 'image/png' });
    const path = `${userId}/${roundId}.png`;
    const { error } = await supabase.storage.from('scorecards').upload(path, blob, { contentType: 'image/png', upsert: true });
    if (error) { console.error('Scorecard upload failed:', error); return null; }
    return supabase.storage.from('scorecards').getPublicUrl(path).data.publicUrl;
  } catch (err) {
    console.error('Scorecard upload error:', err);
    return null;
  }
}

const CATEGORY_CONFIG: Record<CourseCategory, { gradient: [string, string]; badgeColor: string; badgeText: string; label: string }> = {
  coastal:      { gradient: ['#001829', '#003050'], badgeColor: '#3b82f6', badgeText: '#93c5fd', label: 'Coastal' },
  links:        { gradient: ['#1a1200', '#2e2000'], badgeColor: '#d97706', badgeText: '#fcd34d', label: 'Links' },
  parkland:     { gradient: ['#001a08', '#002d14'], badgeColor: '#16a34a', badgeText: '#86efac', label: 'Parkland' },
  desert:       { gradient: ['#1a0800', '#2e1400'], badgeColor: '#ea580c', badgeText: '#fdba74', label: 'Desert' },
  resort:       { gradient: ['#0f0620', '#1c0a38'], badgeColor: '#7c3aed', badgeText: '#c4b5fd', label: 'Resort' },
  championship: { gradient: ['#120a00', '#241500'], badgeColor: '#ca8a04', badgeText: '#fde68a', label: 'Championship' },
};

function toParLabel(score: number, par: number): string {
  const diff = score - par;
  if (diff === 0) return 'E';
  return diff > 0 ? `+${diff}` : `${diff}`;
}

export function RoundScreen() {
  const { leagueId, roundId } = useParams<{ leagueId: string; roundId: string }>();
  const { profile } = useAuth();

  const [round, setRound] = useState<Round | null>(null);
  const [league, setLeague] = useState<League | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [myScore, setMyScore] = useState<Score | TeamScore | null>(null);
  const [myTeam, setMyTeam] = useState<Team | null>(null);
  const [myHandicap, setMyHandicap] = useState(0);

  const [scoreValue, setScoreValue] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [capturePreview, setCapturePreview] = useState<string | null>(null);
  const [scoreFromOCR, setScoreFromOCR] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [viewingScorecard, setViewingScorecard] = useState<string | null>(null);

  useEffect(() => {
    if (roundId && leagueId) fetchData();
  }, [roundId, leagueId, profile]);

  const fetchData = async () => {
    if (!roundId || !leagueId || !profile) return;
    setLoading(true);

    const [{ data: roundData }, { data: leagueData }, { data: memberData }] = await Promise.all([
      supabase.from('rounds').select('*').eq('id', roundId).single(),
      supabase.from('leagues').select('*').eq('id', leagueId).single(),
      supabase.from('league_members').select('role').eq('league_id', leagueId).eq('user_id', profile.id).single(),
    ]);

    if (!roundData || !leagueData) { setLoading(false); return; }
    setRound(roundData as Round);
    setLeague(leagueData as League);
    setIsOwner(memberData?.role === 'owner');
    setScoreValue(sv => sv ?? (roundData as Round).course_par);

    if (leagueData.format === 'singles') {
      await fetchSinglesData(roundData as Round, leagueData as League);
    } else {
      await fetchScrambleData(roundData as Round, leagueData as League);
    }
    setLoading(false);
  };

  const fetchSinglesData = async (r: Round, l: League) => {
    if (!profile) return;
    const [{ data: scores }, { data: handicapData }, { data: members }] = await Promise.all([
      supabase.from('scores').select('*').eq('round_id', r.id),
      supabase.from('handicaps').select('strokes').eq('league_id', l.id).eq('user_id', profile.id).single(),
      supabase.from('league_members').select('user_id').eq('league_id', l.id),
    ]);

    setMyHandicap(handicapData?.strokes || 0);
    const myS = (scores || []).find((s: Score) => s.user_id === profile.id);
    setMyScore(myS || null);

    const userIds = (members || []).map((m: { user_id: string }) => m.user_id);
    const { data: profiles } = await supabase.from('profiles').select('id, discord_username').in('id', userIds);
    const profileMap = new Map((profiles || []).map((p: Pick<Profile,'id'|'discord_username'>) => [p.id, p]));

    const submitted = (scores || []).filter((s: Score) => s.gross_score);
    const pointResults = submitted.length > 0
      ? calculateRoundPoints(submitted.map((s: Score) => ({ id: s.user_id, grossScore: s.gross_score, netScore: s.net_score })), 'singles')
      : [];
    const pointMap = new Map(pointResults.map(r => [r.id, r]));

    setLeaderboard(userIds.map(uid => {
      const score = (scores || []).find((s: Score) => s.user_id === uid);
      const pts = pointMap.get(uid);
      return {
        id: uid,
        displayName: profileMap.get(uid)?.discord_username || 'Unknown',
        grossScore: score?.gross_score || null,
        netScore: score?.net_score || null,
        points: pts?.points ?? null,
        position: pts?.position ?? null,
        submitted: !!score?.gross_score,
        scorecardUrl: score?.scorecard_image_url || null,
      };
    }));
  };

  const fetchScrambleData = async (r: Round, l: League) => {
    if (!profile) return;
    const [{ data: teamScores }, { data: myTeamMember }, { data: teamList }] = await Promise.all([
      supabase.from('team_scores').select('*').eq('round_id', r.id),
      supabase.from('team_members').select('team_id, is_captain').eq('user_id', profile.id)
        .in('team_id', (await supabase.from('teams').select('id').eq('league_id', l.id)).data?.map((t: {id: string}) => t.id) || [])
        .single(),
      supabase.from('teams').select('*').eq('league_id', l.id),
    ]);

    const myT = (teamList || []).find((t: Team) => t.id === myTeamMember?.team_id);
    setMyTeam(myT || null);

    const myTS = (teamScores || []).find((s: TeamScore) => s.team_id === myTeamMember?.team_id);
    setMyScore(myTS || null);

    const pointResults = (teamScores || []).length > 0
      ? calculateRoundPoints((teamScores || []).map((s: TeamScore) => {
          const team = (teamList || []).find((t: Team) => t.id === s.team_id);
          const net = team?.handicap ? s.gross_score - team.handicap : undefined;
          return { id: s.team_id, grossScore: s.gross_score, netScore: net };
        }), 'scramble')
      : [];
    const pointMap = new Map(pointResults.map(r => [r.id, r]));

    setLeaderboard((teamList || []).map((t: Team) => {
      const score = (teamScores || []).find((s: TeamScore) => s.team_id === t.id);
      const pts = pointMap.get(t.id);
      const net = score && t.handicap ? score.gross_score - t.handicap : null;
      return {
        id: t.id,
        displayName: `${t.emoji} ${t.name}`,
        grossScore: score?.gross_score || null,
        netScore: net,
        points: pts?.points ?? null,
        position: pts?.position ?? null,
        submitted: !!score?.gross_score,
        scorecardUrl: score?.scorecard_image_url || null,
      };
    }));
  };

  const handleCapture = async () => {
    setCapturing(true);
    setError('');
    try {
      const result = await invoke<CaptureResult>('capture_gameday');
      setCapturePreview(result.image_base64);

      if (result.image_base64 && profile) {
        const parsed = await parseScorecard(result.image_base64, profile.discord_username);
        if (parsed.success && parsed.stats) {
          setScoreFromOCR(parsed.stats.score);
          setScoreValue(parsed.stats.score);
        } else if (!parsed.success) {
          setError(`OCR couldn't read score: ${parsed.error || 'unknown error'}. Adjust manually.`);
        }
      }
    } catch (err) {
      setError(`Capture failed: ${err}`);
    } finally {
      setCapturing(false);
    }
  };

  const handleSubmitScore = async () => {
    if (!profile || !round || !league) return;
    const gross = scoreValue;
    if (!gross || gross < 50 || gross > 150) {
      setError('Score must be between 50 and 150.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      // Upload scorecard capture if one was taken
      let scorecardImageUrl: string | null = null;
      if (capturePreview) {
        scorecardImageUrl = await uploadScorecard(capturePreview, round.id, profile.id);
      }

      if (league.format === 'singles') {
        const net = gross - myHandicap;
        const { error: err } = await supabase.from('scores').upsert({
          round_id: round.id,
          user_id: profile.id,
          gross_score: gross,
          net_score: net,
          handicap_used: myHandicap,
          ...(scorecardImageUrl && { scorecard_image_url: scorecardImageUrl }),
        }, { onConflict: 'round_id,user_id' });
        if (err) throw err;
      } else {
        if (!myTeam) throw new Error('You are not on a team.');
        const { error: err } = await supabase.from('team_scores').upsert({
          round_id: round.id,
          team_id: myTeam.id,
          gross_score: gross,
          submitted_by: profile.id,
          ...(scorecardImageUrl && { scorecard_image_url: scorecardImageUrl }),
        }, { onConflict: 'round_id,team_id' });
        if (err) throw err;
      }

      setCapturePreview(null);
      setScoreFromOCR(null);
      await fetchData();
      await checkAutoComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit score');
    } finally {
      setSubmitting(false);
    }
  };

  const checkAutoComplete = async () => {
    if (!round || !league) return;
    const allSubmitted = leaderboard.every(e => e.submitted);
    if (allSubmitted && round.status === 'active') {
      await completeRound();
    }
  };

  const completeRound = async () => {
    if (!round || !league) return;
    setCompleting(true);
    try {
      let allSubmitted = true;
      if (league.format === 'singles') {
        const { data: scores } = await supabase.from('scores').select('*').eq('round_id', round.id);
        const { data: members } = await supabase.from('league_members').select('user_id').eq('league_id', leagueId!);
        allSubmitted = (members || []).every((m: { user_id: string }) => (scores || []).some((s: Score) => s.user_id === m.user_id));
      } else {
        const { data: teams } = await supabase.from('teams').select('id').eq('league_id', leagueId!);
        const { data: teamScores } = await supabase.from('team_scores').select('*').eq('round_id', round.id);
        allSubmitted = (teams || []).every((t: {id: string}) => (teamScores || []).some((s: TeamScore) => s.team_id === t.id));
      }

      if (!allSubmitted) { setCompleting(false); return; }

      await saveRoundResults();
      await supabase.from('rounds').update({ status: 'completed' }).eq('id', round.id);

      if (league.discord_webhook_url) {
        const { data: seasonData } = await supabase.from('seasons').select('season_number').eq('id', round.season_id).single();
        await postRoundComplete(
          league.discord_webhook_url, league.name, round.round_number,
          seasonData?.season_number || 1, round.course_name, round.course_par,
          league.format,
          leaderboard.filter(e => e.submitted).map(e => ({
            name: e.displayName,
            score: e.grossScore || 0,
            netScore: e.netScore ?? undefined,
            points: e.points || 0,
            position: e.position || 99,
          }))
        );
      }

      // Auto-activate the next pending round
      const { data: nextRound } = await supabase
        .from('rounds')
        .select('*')
        .eq('season_id', round.season_id)
        .eq('status', 'pending')
        .order('round_number', { ascending: true })
        .limit(1)
        .single();

      if (nextRound) {
        await supabase.from('rounds').update({ status: 'active' }).eq('id', nextRound.id);
        if (league.discord_webhook_url) {
          const memberNames = leaderboard.map(e => e.displayName);
          const { data: sd } = await supabase.from('seasons').select('season_number').eq('id', round.season_id).single();
          await postRoundOpen(
            league.discord_webhook_url, league.name, nextRound.round_number,
            sd?.season_number || 1, nextRound.course_name, nextRound.course_par,
            memberNames
          );
        }
      }

      await fetchData();
    } finally {
      setCompleting(false);
    }
  };

  const saveRoundResults = async () => {
    if (!round || !league) return;

    if (league.format === 'singles') {
      const { data: scores } = await supabase.from('scores').select('*').eq('round_id', round.id);
      const results = calculateRoundPoints(
        (scores || []).map((s: Score) => ({ id: s.user_id, grossScore: s.gross_score, netScore: s.net_score })),
        'singles'
      );
      for (const r of results) {
        await supabase.from('round_results').insert({ round_id: round.id, user_id: r.id, points: r.points, position: r.position, gross_score: r.grossScore, net_score: r.netScore });
        await supabase.rpc('upsert_season_standing_singles', { p_season_id: round.season_id, p_user_id: r.id, p_points: r.points, p_win: r.points === 1 ? 1 : 0, p_tie: r.points === 0.5 ? 1 : 0 });
      }
    } else {
      const { data: teamScores } = await supabase.from('team_scores').select('*').eq('round_id', round.id);
      const results = calculateRoundPoints(
        (teamScores || []).map((s: TeamScore) => ({ id: s.team_id, grossScore: s.gross_score })),
        'scramble'
      );
      for (const r of results) {
        await supabase.from('round_results').insert({ round_id: round.id, team_id: r.id, points: r.points, position: r.position, gross_score: r.grossScore });
        await supabase.rpc('upsert_season_standing_scramble', { p_season_id: round.season_id, p_team_id: r.id, p_points: r.points, p_win: r.points === 1 ? 1 : 0, p_tie: r.points === 0.5 ? 1 : 0 });
      }
    }
  };

  const alreadySubmitted = !!myScore;
  const isComplete = round?.status === 'completed';
  const courseData = round ? getCourseByName(round.course_name) : null;
  const catConfig = CATEGORY_CONFIG[courseData?.category ?? 'parkland'];

  const parDiff = scoreValue !== null && round ? scoreValue - round.course_par : 0;
  const netScore = scoreValue !== null ? scoreValue - myHandicap : null;

  if (loading) return <AppPage title="Round"><div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)}</div></AppPage>;
  if (!round || !league) return <AppPage title="Round"><p className="text-[var(--color-text-muted)]">Round not found.</p></AppPage>;

  return (
    <AppPage
      title={`Round ${round.round_number}`}
      subtitle={league.name}
      backTo={`/leagues/${leagueId}`}
    >
      <div className="space-y-4">

        {/* Course Hero Card */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: `linear-gradient(145deg, ${catConfig.gradient[0]}, ${catConfig.gradient[1]})` }}
        >
          <div className="p-5">
            {/* Category badge + flag */}
            <div className="flex items-start justify-between mb-4">
              <span
                className="text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider"
                style={{ background: `${catConfig.badgeColor}22`, color: catConfig.badgeText, border: `1px solid ${catConfig.badgeColor}44` }}
              >
                {catConfig.label}
              </span>
              <span className="text-3xl leading-none">{courseData?.flag ?? '⛳'}</span>
            </div>

            {/* Course name + location */}
            <h2 className="font-display text-3xl font-black text-white leading-tight">{round.course_name}</h2>
            <p className="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] mt-1">
              <MapPin size={13} />
              {round.course_location}
            </p>

            {/* Description */}
            {courseData?.description && (
              <p className="text-sm text-[var(--color-text-secondary)] mt-3 leading-relaxed opacity-90">
                {courseData.description}
              </p>
            )}
          </div>

          {/* Stats footer */}
          <div className="border-t px-5 py-3 flex items-center gap-6" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <div>
              <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">Par</p>
              <p className="font-display text-2xl font-black text-[var(--color-primary)]">{round.course_par}</p>
            </div>
            {league.format === 'singles' && myHandicap > 0 && (
              <>
                <div>
                  <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">Handicap</p>
                  <p className="font-display text-2xl font-black text-white">-{myHandicap}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">Net Par</p>
                  <p className="font-display text-2xl font-black text-white">{round.course_par - myHandicap}</p>
                </div>
              </>
            )}
            {league.format === 'scramble' && myTeam && (
              <>
                <div>
                  <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">Your Team</p>
                  <p className="font-bold text-white">{myTeam.emoji} {myTeam.name}</p>
                </div>
                {myTeam.handicap > 0 && (
                  <div>
                    <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">Team Handicap</p>
                    <p className="font-display text-2xl font-black text-white">-{myTeam.handicap}</p>
                  </div>
                )}
              </>
            )}
            <div className="ml-auto">
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                isComplete
                  ? 'bg-[var(--color-success)]/15 text-[var(--color-success)]'
                  : 'bg-[var(--color-warning)]/15 text-[var(--color-warning)]'
              }`}>
                {isComplete ? 'Completed' : 'Live'}
              </span>
            </div>
          </div>
        </div>

        {/* Score Submission */}
        {!isComplete && !alreadySubmitted && (
          <div className="card p-5 space-y-5">
            <h3 className="font-display text-lg font-bold uppercase tracking-wider text-center">Your Score</h3>

            {/* Score stepper */}
            <div className="flex items-center justify-center gap-5">
              <button
                onClick={() => setScoreValue(v => Math.max(50, (v ?? round.course_par) - 1))}
                className="w-14 h-14 rounded-full bg-[var(--color-surface-lighter)] text-white flex items-center justify-center active:scale-95 transition-transform hover:bg-[var(--color-border-light)]"
              >
                <Minus size={22} />
              </button>

              <div className="text-center min-w-[100px]">
                <div className="font-display text-6xl font-black text-white tabular-nums leading-none">
                  {scoreValue ?? round.course_par}
                </div>
                <div className={`text-base font-bold mt-1.5 ${
                  parDiff > 0 ? 'text-red-400' : parDiff < 0 ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'
                }`}>
                  {scoreValue !== null ? toParLabel(scoreValue, round.course_par) : 'E'}
                </div>
                {league.format === 'singles' && myHandicap > 0 && netScore !== null && (
                  <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    {netScore} net
                  </div>
                )}
              </div>

              <button
                onClick={() => setScoreValue(v => Math.min(150, (v ?? round.course_par) + 1))}
                className="w-14 h-14 rounded-full bg-[var(--color-surface-lighter)] text-white flex items-center justify-center active:scale-95 transition-transform hover:bg-[var(--color-border-light)]"
              >
                <Plus size={22} />
              </button>
            </div>

            {/* OCR Capture */}
            <button
              onClick={handleCapture}
              disabled={capturing}
              className="btn btn-secondary w-full gap-2"
            >
              {capturing ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
              {capturing ? 'Capturing...' : 'Capture from GameDay'}
            </button>

            {capturePreview && (
              <div className="space-y-2">
                <div className="rounded-lg overflow-hidden border border-[var(--color-border)]">
                  <img src={`data:image/png;base64,${capturePreview}`} alt="Scorecard capture" className="w-full" />
                </div>
                {scoreFromOCR !== null && (
                  <p className="text-sm text-[var(--color-success)] text-center">
                    Detected: <strong>{scoreFromOCR}</strong> ({toParLabel(scoreFromOCR, round.course_par)})
                  </p>
                )}
              </div>
            )}

            {error && <p className="text-[var(--color-error)] text-sm text-center">{error}</p>}

            <button
              onClick={handleSubmitScore}
              disabled={submitting || scoreValue === null}
              className="btn btn-primary w-full py-4 text-base gap-2"
            >
              {submitting ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
              {submitting ? 'Saving...' : `Submit ${scoreValue ?? round.course_par}`}
            </button>
          </div>
        )}

        {/* Already submitted */}
        {!isComplete && alreadySubmitted && (
          <div className="card p-5">
            <div className="flex items-center gap-3 text-[var(--color-success)]">
              <div className="w-10 h-10 rounded-full bg-[var(--color-success)]/15 flex items-center justify-center shrink-0">
                <Check size={20} />
              </div>
              <div>
                <p className="font-bold text-white">Score submitted!</p>
                <p className="text-sm text-[var(--color-text-muted)]">
                  {'gross_score' in myScore! ? `${(myScore as Score).gross_score} gross` : `${(myScore as TeamScore).gross_score} strokes`}
                  {league.format === 'singles' && 'net_score' in myScore! && ` · ${(myScore as Score).net_score} net`}
                  {league.format === 'singles' && 'gross_score' in myScore! && ` (${toParLabel((myScore as Score).gross_score, round.course_par)})`}
                </p>
              </div>
            </div>
            {leaderboard.some(e => !e.submitted) && (
              <div className="mt-3 pt-3 border-t border-[var(--color-border)] flex items-center gap-2 text-[var(--color-text-muted)] text-sm">
                <Clock size={14} />
                Waiting for {leaderboard.filter(e => !e.submitted).length} more player{leaderboard.filter(e => !e.submitted).length !== 1 ? 's' : ''}…
              </div>
            )}
          </div>
        )}

        {/* Owner manual complete button */}
        {isOwner && !isComplete && leaderboard.length > 0 && leaderboard.every(e => e.submitted) && (
          <button onClick={completeRound} disabled={completing} className="btn btn-primary w-full py-4">
            {completing ? <Loader2 size={18} className="animate-spin" /> : <Trophy size={18} />}
            {completing ? 'Finalizing…' : 'Complete Round'}
          </button>
        )}

        {/* Leaderboard */}
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center gap-2">
            <Trophy size={16} className="text-[var(--color-primary)]" />
            <span className="font-bold text-sm uppercase tracking-wider">
              {isComplete ? 'Final Results' : 'Live Board'}
            </span>
            <span className="ml-auto text-xs text-[var(--color-text-muted)]">
              {leaderboard.filter(e => e.submitted).length}/{leaderboard.length} in
            </span>
          </div>
          {leaderboard.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-[var(--color-text-muted)]">No scores yet</p>
          )}
          {leaderboard.map((entry, i) => (
            <div key={entry.id} className={`lb-row ${i === 0 && entry.submitted ? 'lb-row-winner' : ''}`}>
              <div className={`pos-badge ${entry.submitted ? (i === 0 ? 'pos-1' : i === 1 ? 'pos-2' : i === 2 ? 'pos-3' : 'pos-other') : 'pos-other'}`}>
                {entry.submitted ? (entry.position || i + 1) : <Clock size={13} />}
              </div>
              <span className="flex-1 font-semibold text-white">{entry.displayName}</span>
              {entry.submitted ? (
                <div className="text-right flex items-center gap-3">
                  {entry.scorecardUrl && (
                    <button
                      onClick={() => setViewingScorecard(entry.scorecardUrl!)}
                      className="p-2 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
                      title="View scorecard"
                    >
                      <Camera size={17} />
                    </button>
                  )}
                  {league.format === 'singles' && entry.netScore !== null ? (
                    <div className="text-right">
                      <div className="font-bold text-white">{entry.netScore} <span className="text-xs font-normal text-[var(--color-text-muted)]">net</span></div>
                      <div className="text-xs text-[var(--color-text-muted)]">{entry.grossScore} gross</div>
                    </div>
                  ) : (
                    <span className="font-bold text-white">{entry.grossScore}</span>
                  )}
                  {isComplete && entry.points !== null && (
                    <span className={`font-display text-xl font-bold w-10 text-right ${entry.points > 0 ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'}`}>
                      {formatPoints(entry.points)}
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-xs text-[var(--color-text-muted)]">Pending</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Fullscreen scorecard viewer */}
      {viewingScorecard && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4"
          onClick={() => setViewingScorecard(null)}
        >
          <div className="relative max-w-2xl w-full" onClick={e => e.stopPropagation()}>
            <img
              src={viewingScorecard}
              alt="Scorecard"
              className="w-full rounded-xl border border-[var(--color-border)]"
            />
            <button
              onClick={() => setViewingScorecard(null)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-[var(--color-surface-lighter)] text-[var(--color-text-muted)] hover:text-white flex items-center justify-center"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </AppPage>
  );
}
