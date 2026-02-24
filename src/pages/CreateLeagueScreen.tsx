import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { AppPage } from '@/components/AppPage';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

function generateInviteCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export function CreateLeagueScreen() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [format, setFormat] = useState<'singles' | 'scramble'>('singles');
  const [teamSize, setTeamSize] = useState<2 | 3 | 4>(2);
  const [roundsPerSeason, setRoundsPerSeason] = useState(10);
  const [isPublic, setIsPublic] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!profile) return;
    if (!name.trim()) { setError('League name is required.'); return; }
    setSaving(true);
    setError('');

    try {
      const { data: league, error: leagueErr } = await supabase
        .from('leagues')
        .insert({
          name: name.trim(),
          owner_id: profile.id,
          format,
          team_size: format === 'scramble' ? teamSize : null,
          rounds_per_season: roundsPerSeason,
          is_public: isPublic,
          invite_code: generateInviteCode(),
          discord_webhook_url: webhookUrl.trim() || null,
        })
        .select()
        .single();

      if (leagueErr || !league) throw new Error(leagueErr?.message || leagueErr?.code || 'Failed to create league');

      // Add owner as member
      await supabase.from('league_members').insert({
        league_id: league.id,
        user_id: profile.id,
        role: 'owner',
      });

      navigate(`/leagues/${league.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create league');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppPage title="Create League" backTo="/dashboard">
      <div className="space-y-6 max-w-lg">

        {/* League Name */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
            League Name
          </label>
          <input
            className="input"
            placeholder="e.g. Friday Night Scramble"
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={60}
          />
        </div>

        {/* Format */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
            Format
          </label>
          <div className="grid grid-cols-2 gap-3">
            {(['singles', 'scramble'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFormat(f)}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  format === f
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary-glow)]'
                    : 'border-[var(--color-border)] bg-[var(--color-surface)]'
                }`}
              >
                <div className="text-2xl mb-2">{f === 'singles' ? '🏌️' : '👥'}</div>
                <div className="font-bold text-white capitalize">{f}</div>
                <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                  {f === 'singles' ? 'Individual stroke play with handicaps' : 'Team scramble, stroke play'}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Team Size (scramble only) */}
        {format === 'scramble' && (
          <div className="space-y-2">
            <label className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
              Team Size
            </label>
            <div className="flex gap-3">
              {([2, 3, 4] as const).map(size => (
                <button
                  key={size}
                  onClick={() => setTeamSize(size)}
                  className={`flex-1 py-3 rounded-xl border-2 font-display font-bold text-xl transition-all ${
                    teamSize === size
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary-glow)] text-[var(--color-primary)]'
                      : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)]'
                  }`}
                >
                  {size}v{size}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Rounds per Season */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
            Rounds Per Season
          </label>
          <div className="flex items-center gap-4">
            <input
              type="range" min={2} max={26} value={roundsPerSeason}
              onChange={e => setRoundsPerSeason(Number(e.target.value))}
              className="flex-1 accent-[var(--color-primary)]"
            />
            <span className="font-display text-3xl font-bold text-[var(--color-primary)] w-12 text-right">
              {roundsPerSeason}
            </span>
          </div>
        </div>

        {/* Visibility */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]">
          <div>
            <p className="font-semibold text-white">Public League</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Anyone can find and join this league</p>
          </div>
          <button
            onClick={() => setIsPublic(!isPublic)}
            className={`w-12 h-6 rounded-full transition-colors relative ${isPublic ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-surface-lighter)]'}`}
          >
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${isPublic ? 'translate-x-6' : 'translate-x-0.5'}`} />
          </button>
        </div>

        {/* Discord Webhook */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
            Discord Webhook <span className="text-[var(--color-text-muted)] font-normal normal-case">(optional)</span>
          </label>
          <input
            className="input"
            placeholder="https://discord.com/api/webhooks/..."
            value={webhookUrl}
            onChange={e => setWebhookUrl(e.target.value)}
          />
          <p className="text-xs text-[var(--color-text-muted)]">
            Round results will be posted to this channel automatically.
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-[var(--color-error)]/10 border border-[var(--color-error)]/30 text-[var(--color-error)] text-sm">
            {error}
          </div>
        )}

        <button onClick={handleCreate} disabled={saving || !name.trim()} className="btn btn-primary w-full py-4 text-base">
          {saving ? <Loader2 size={18} className="animate-spin" /> : 'Create League'}
        </button>
      </div>
    </AppPage>
  );
}
