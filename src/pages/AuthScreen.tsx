import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

const DEV_ACCOUNTS = [
  { email: 'testuser1@clubhouse.dev', password: 'testpass123', displayName: 'TestUser1' },
  { email: 'testuser2@clubhouse.dev', password: 'testpass123', displayName: 'TestUser2' },
];

export function AuthScreen() {
  const { signInWithDiscord, signInWithEmail, signingIn, error, statusMessage } = useAuth();

  return (
    <div className="h-full flex flex-col items-center justify-center bg-[var(--color-background)] p-6">
      {/* Logo / Wordmark */}
      <div className="mb-12 text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-[var(--color-primary)] mb-6 shadow-lg shadow-[var(--color-primary-glow)]">
          <span className="text-4xl">⛳</span>
        </div>
        <h1 className="font-display text-5xl font-black uppercase tracking-wider text-white">
          The Clubhouse
        </h1>
        <p className="text-[var(--color-text-muted)] mt-2 text-base">Golf League Management</p>
      </div>

      {/* Auth Card */}
      <div className="w-full max-w-sm space-y-4">
        <button
          onClick={signInWithDiscord}
          disabled={signingIn}
          className="btn btn-primary w-full py-4 text-base gap-3"
        >
          {signingIn ? (
            <Loader2 size={20} className="animate-spin" />
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
            </svg>
          )}
          {signingIn ? (statusMessage || 'Connecting...') : 'Sign in with Discord'}
        </button>

        {error && (
          <div className="p-3 rounded-lg bg-[var(--color-error)]/10 border border-[var(--color-error)]/30 text-[var(--color-error)] text-sm text-center">
            {error}
          </div>
        )}

        <p className="text-center text-xs text-[var(--color-text-muted)]">
          Your Discord username will be used as your display name.
        </p>
      </div>

      {/* Dev-only test accounts */}
      {import.meta.env.DEV && (
        <div className="w-full max-w-sm mt-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-px flex-1 bg-[var(--color-border)]" />
            <span className="text-xs text-[var(--color-text-muted)] font-mono">DEV MODE</span>
            <div className="h-px flex-1 bg-[var(--color-border)]" />
          </div>
          <div className="flex gap-2">
            {DEV_ACCOUNTS.map(acct => (
              <button
                key={acct.email}
                onClick={() => signInWithEmail(acct.email, acct.password, acct.displayName)}
                disabled={signingIn}
                className="flex-1 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-sm font-semibold text-[var(--color-text-secondary)] hover:border-[var(--color-border-light)] hover:text-white transition-colors"
              >
                {signingIn ? <Loader2 size={14} className="animate-spin mx-auto" /> : acct.displayName}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
