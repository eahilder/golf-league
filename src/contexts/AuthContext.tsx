import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-shell';
import type { Profile } from '@/types/database';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signingIn: boolean;
  error: string;
  statusMessage: string;
  signInWithDiscord: () => Promise<void>;
  signInWithEmail: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (data) setProfile(data as Profile);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithDiscord = async () => {
    setSigningIn(true);
    setError('');
    setStatusMessage('Starting authentication server...');

    try {
      // Start local OAuth callback server
      const port = await invoke<number>('start_oauth_server');
      const redirectUri = `http://127.0.0.1:${port}`;

      setStatusMessage('Opening Discord login...');

      // Get OAuth URL from Supabase
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'discord',
        options: {
          redirectTo: redirectUri,
          skipBrowserRedirect: true,
        },
      });

      if (oauthError || !data?.url) {
        throw new Error(oauthError?.message || 'Failed to get OAuth URL');
      }

      // Check that PKCE verifier was stored
      const verifierKey = Object.keys(localStorage).find(k => k.endsWith('-code-verifier'));
      console.log('[Auth] PKCE verifier key in localStorage:', verifierKey || 'NOT FOUND');

      // Open in system browser
      await open(data.url);
      setStatusMessage('Complete login in your browser...');

      // Poll for tokens
      const maxAttempts = 60;
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise(r => setTimeout(r, 1000));
        const tokens = await invoke<string | null>('get_oauth_tokens');

        if (tokens) {
          setStatusMessage('Signing in...');
          const params = new URLSearchParams(tokens);
          const code = params.get('code');
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');

          let sessionUser = null;

          if (code) {
            // PKCE flow — exchange code for a proper Supabase session
            console.log('[Auth] PKCE code received:', code.substring(0, 10));
            const { data: sessionData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
            console.log('[Auth] exchange error:', exchangeError?.message);
            console.log('[Auth] exchange user:', sessionData?.user?.id);
            const tok = sessionData?.session?.access_token;
            if (tok) {
              const hdr = JSON.parse(atob(tok.split('.')[0].replace(/-/g, '+').replace(/_/g, '/')));
              console.log('[Auth] new token alg:', hdr.alg);
            }
            if (exchangeError) throw exchangeError;
            sessionUser = sessionData.user;
          } else if (accessToken && refreshToken) {
            // Implicit flow fallback
            const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (sessionError) throw sessionError;
            sessionUser = sessionData.user;
          }

          if (sessionUser) {
            const discordMeta = sessionUser.user_metadata;
            await supabase.from('profiles').upsert({
              id: sessionUser.id,
              discord_id: discordMeta?.provider_id || discordMeta?.sub,
              discord_username: discordMeta?.full_name || discordMeta?.name || discordMeta?.custom_claims?.global_name || 'Unknown',
              discord_avatar: discordMeta?.avatar_url || null,
            }, { onConflict: 'id' });

            await fetchProfile(sessionUser.id);
            setStatusMessage('');
            break;
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
      setStatusMessage('');
    } finally {
      setSigningIn(false);
    }
  };

  const signInWithEmail = async (email: string, password: string, displayName: string) => {
    setSigningIn(true);
    setError('');
    try {
      let sessionUser: User | null = null;
      const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
      if (signInErr) {
        // Account doesn't exist yet — sign up
        const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({ email, password });
        if (signUpErr) throw signUpErr;
        sessionUser = signUpData.user;
      } else {
        sessionUser = signInData.user;
      }
      if (sessionUser) {
        await supabase.from('profiles').upsert({
          id: sessionUser.id,
          discord_id: null,
          discord_username: displayName,
          discord_avatar: null,
        }, { onConflict: 'id' });
        await fetchProfile(sessionUser.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setSigningIn(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  return (
    <AuthContext.Provider value={{
      user, session, profile, loading, signingIn, error, statusMessage,
      signInWithDiscord, signInWithEmail, signOut, refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
