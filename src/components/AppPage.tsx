import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Home } from 'lucide-react';

interface AppPageProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  showBack?: boolean;
  backTo?: string;
  headerRight?: React.ReactNode;
}

export function AppPage({ title, subtitle, children, showBack = true, backTo = '/dashboard', headerRight }: AppPageProps) {
  const navigate = useNavigate();

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 flex items-center justify-between border-b border-[var(--color-border)]">
        <div className="flex items-center gap-3">
          {showBack && (
            <button
              onClick={() => navigate(backTo)}
              className="p-2.5 rounded-lg bg-[var(--color-surface-light)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-white hover:border-[var(--color-border-light)] transition-colors"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <div>
            <h1 className="text-xl font-bold font-display tracking-wide text-white">{title}</h1>
            {subtitle && <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {headerRight}
          <button
            onClick={() => navigate('/dashboard')}
            className="p-2.5 rounded-lg bg-[var(--color-surface-light)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-white hover:border-[var(--color-border-light)] transition-colors"
          >
            <Home size={18} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-6 animate-fade-in">
          {children}
        </div>
      </div>
    </div>
  );
}
