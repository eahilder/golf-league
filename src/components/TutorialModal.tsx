import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

const STEPS = [
  {
    emoji: '👋',
    title: 'Welcome to The Clubhouse',
    subtitle: 'A quick tour of how everything works. You can relaunch this any time from the dashboard.',
    items: [],
  },
  {
    emoji: '🏠',
    title: 'Dashboard',
    subtitle: 'Your home base. Find and manage all your leagues from here.',
    items: [
      { icon: '🏆', label: 'My Leagues', desc: 'All leagues you\'ve joined or created' },
      { icon: '👥', label: 'Friends tab', desc: 'Leagues your friends are in — join them with one tap' },
      { icon: '🔍', label: 'Discover tab', desc: 'Browse all public leagues open to anyone' },
      { icon: '🔗', label: 'Join by Code', desc: 'Enter a 6-character invite code from a friend' },
    ],
  },
  {
    emoji: '⛳',
    title: 'League Hub',
    subtitle: 'The center of each league. Everything lives here.',
    items: [
      { icon: '🟡', label: 'Active Round card', desc: 'Appears when a round is live — tap it to submit your score' },
      { icon: '⚙️', label: 'Admin Panel', desc: 'Owners only — manage seasons, handicaps, and teams' },
      { icon: '📊', label: 'Season standings', desc: 'Live leaderboard and per-round points history' },
      { icon: '📋', label: 'Schedule', desc: 'All rounds for the season — upcoming, live, and completed' },
      { icon: '🔗', label: 'Invite Code', desc: 'Share with friends or send direct invites to your friend list' },
    ],
  },
  {
    emoji: '⚙️',
    title: 'Admin Panel',
    subtitle: 'League owners manage everything from here. Members don\'t see this.',
    items: [
      { icon: '🚀', label: 'Start New Season', desc: 'Generates all rounds with courses — Round 1 opens immediately, no manual start needed' },
      { icon: '🏁', label: 'End Season', desc: 'Close out the season once all rounds are done' },
      { icon: '✏️', label: 'Handicaps tab', desc: 'Set and adjust player handicaps (singles leagues only)' },
      { icon: '👥', label: 'Teams tab', desc: 'Create and manage teams (scramble leagues only)' },
    ],
  },
  {
    emoji: '🏌️',
    title: 'Round Screen',
    subtitle: 'Submit your score and watch the live leaderboard update in real time.',
    items: [
      { icon: '−/+', label: 'Score stepper', desc: 'Tap + or − to set your gross score — shows how you\'re doing vs par' },
      { icon: '📸', label: 'Capture from GameDay', desc: 'Take a screenshot and AI reads your scorecard automatically' },
      { icon: '✅', label: 'Submit', desc: 'Locks in your score — you can resubmit any time to update it' },
      { icon: '📷', label: 'Camera icon on leaderboard', desc: 'Tap to view that player\'s captured scorecard image' },
    ],
  },
  {
    emoji: '🏆',
    title: 'How Scoring Works',
    subtitle: 'Each round is a "hole" in match play. The season is one long match.',
    items: [
      { icon: '1️⃣', label: '1 point', desc: 'Win the week outright with the lowest net score (singles) or gross (scramble)' },
      { icon: '½', label: '½ point each', desc: 'Two or more players tie for the lowest score that week' },
      { icon: '0️⃣', label: '0 points', desc: 'Everyone else — no partial credit for being close' },
      { icon: '🥇', label: 'Season winner', desc: 'Most points accumulated after all rounds = champion' },
    ],
  },
];

const TUTORIAL_KEY = 'clubhouse_tutorial_seen';

interface TutorialModalProps {
  open: boolean;
  onClose: () => void;
}

export function TutorialModal({ open, onClose }: TutorialModalProps) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  if (!open) return null;

  const current = STEPS[step];
  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;

  const handleClose = () => {
    localStorage.setItem(TUTORIAL_KEY, 'true');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
      <div className="w-full max-w-sm bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl overflow-hidden shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          {/* Step dots */}
          <div className="flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`rounded-full transition-all ${
                  i === step
                    ? 'w-5 h-2 bg-[var(--color-primary)]'
                    : 'w-2 h-2 bg-[var(--color-border-light)] hover:bg-[var(--color-text-muted)]'
                }`}
              />
            ))}
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 text-[var(--color-text-muted)] hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 pb-2">
          <div className="text-4xl mb-3">{current.emoji}</div>
          <h2 className="font-display text-2xl font-black text-white leading-tight">{current.title}</h2>
          <p className="text-sm text-[var(--color-text-muted)] mt-1.5 leading-relaxed">{current.subtitle}</p>

          {current.items.length > 0 && (
            <div className="mt-4 space-y-2.5">
              {current.items.map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[var(--color-surface-lighter)] flex items-center justify-center text-sm flex-shrink-0 font-bold text-[var(--color-primary)]">
                    {item.icon}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white leading-tight">{item.label}</p>
                    <p className="text-xs text-[var(--color-text-muted)] leading-relaxed mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-5 py-4 mt-2 border-t border-[var(--color-border)]">
          {!isFirst ? (
            <button
              onClick={() => setStep(s => s - 1)}
              className="btn btn-secondary flex-1 gap-1"
            >
              <ChevronLeft size={16} /> Back
            </button>
          ) : (
            <button onClick={handleClose} className="flex-1 text-sm text-[var(--color-text-muted)] hover:text-white transition-colors">
              Skip
            </button>
          )}

          {isLast ? (
            <button onClick={handleClose} className="btn btn-primary flex-1">
              Let's play ⛳
            </button>
          ) : (
            <button
              onClick={() => setStep(s => s + 1)}
              className="btn btn-primary flex-1 gap-1"
            >
              Next <ChevronRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function useTutorial() {
  const seen = localStorage.getItem(TUTORIAL_KEY) === 'true';
  return { seenBefore: seen };
}
