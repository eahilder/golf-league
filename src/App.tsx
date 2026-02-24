import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { AuthScreen } from '@/pages/AuthScreen';
import { DashboardScreen } from '@/pages/DashboardScreen';
import { CreateLeagueScreen } from '@/pages/CreateLeagueScreen';
import { LeagueHubScreen } from '@/pages/LeagueHubScreen';
import { RoundScreen } from '@/pages/RoundScreen';
import { AdminScreen } from '@/pages/AdminScreen';
import { SeasonStandingsScreen } from '@/pages/SeasonStandingsScreen';
import { ProfileScreen } from '@/pages/ProfileScreen';
import { FriendsScreen } from '@/pages/FriendsScreen';

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 rounded-full border-2 border-t-[var(--color-primary)] border-[var(--color-border)] animate-spin mx-auto" />
          <p className="text-[var(--color-text-muted)] text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<AuthScreen />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<DashboardScreen />} />
      <Route path="/leagues/create" element={<CreateLeagueScreen />} />
      <Route path="/leagues/:leagueId" element={<LeagueHubScreen />} />
      <Route path="/leagues/:leagueId/round/:roundId" element={<RoundScreen />} />
      <Route path="/leagues/:leagueId/admin" element={<AdminScreen />} />
      <Route path="/leagues/:leagueId/season/:seasonId/standings" element={<SeasonStandingsScreen />} />
      <Route path="/profile" element={<ProfileScreen />} />
      <Route path="/profile/:userId" element={<ProfileScreen />} />
      <Route path="/friends" element={<FriendsScreen />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="h-full w-full overflow-hidden bg-[var(--color-background)]">
          <AppRoutes />
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}
