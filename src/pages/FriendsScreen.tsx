import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, UserPlus, Check, X, Users, ChevronRight, Loader2 } from 'lucide-react';
import { AppPage } from '@/components/AppPage';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types/database';

type FriendshipStatus = 'pending' | 'accepted' | 'declined';

interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: FriendshipStatus;
  created_at: string;
  other: Profile;
}

export function FriendsScreen() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [friends, setFriends] = useState<Friendship[]>([]);
  const [pendingIn, setPendingIn] = useState<Friendship[]>([]);
  const [pendingOut, setPendingOut] = useState<Friendship[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);

  useEffect(() => { if (profile) fetchFriends(); }, [profile]);

  const fetchFriends = async () => {
    if (!profile) return;
    setLoading(true);

    const { data } = await supabase
      .from('friendships')
      .select('*')
      .or(`requester_id.eq.${profile.id},addressee_id.eq.${profile.id}`);

    if (!data) { setLoading(false); return; }

    // Collect all other user IDs
    const otherIds = data.map(f => f.requester_id === profile.id ? f.addressee_id : f.requester_id);
    const { data: otherProfiles } = await supabase.from('profiles').select('*').in('id', otherIds);
    const profileMap = new Map((otherProfiles || []).map((p: Profile) => [p.id, p]));

    const enriched: Friendship[] = data.map(f => ({
      ...f,
      other: profileMap.get(f.requester_id === profile.id ? f.addressee_id : f.requester_id)!,
    })).filter(f => f.other);

    setFriends(enriched.filter(f => f.status === 'accepted'));
    setPendingIn(enriched.filter(f => f.status === 'pending' && f.addressee_id === profile.id));
    setPendingOut(enriched.filter(f => f.status === 'pending' && f.requester_id === profile.id));
    setLoading(false);
  };

  const searchUsers = async () => {
    if (!searchQuery.trim() || !profile) return;
    setSearching(true);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .ilike('discord_username', `%${searchQuery.trim()}%`)
      .neq('id', profile.id)
      .limit(10);
    setSearchResults((data || []) as Profile[]);
    setSearching(false);
  };

  const sendRequest = async (toUserId: string) => {
    if (!profile) return;
    setSendingTo(toUserId);
    await supabase.from('friendships').insert({
      requester_id: profile.id,
      addressee_id: toUserId,
      status: 'pending',
    });
    setSendingTo(null);
    setSearchResults(prev => prev.filter(p => p.id !== toUserId));
    fetchFriends();
  };

  const acceptRequest = async (friendshipId: string) => {
    await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId);
    fetchFriends();
  };

  const declineRequest = async (friendshipId: string) => {
    await supabase.from('friendships').update({ status: 'declined' }).eq('id', friendshipId);
    fetchFriends();
  };

  const removeFriend = async (friendshipId: string) => {
    await supabase.from('friendships').delete().eq('id', friendshipId);
    fetchFriends();
  };

  // Check if already friends/pending with a search result
  const getRelationship = (userId: string): 'friend' | 'pending' | null => {
    if (friends.some(f => f.other.id === userId)) return 'friend';
    if (pendingOut.some(f => f.other.id === userId)) return 'pending';
    if (pendingIn.some(f => f.other.id === userId)) return 'pending';
    return null;
  };

  return (
    <AppPage
      title="Friends"
      backTo="/dashboard"
      headerRight={
        <span className="badge badge-yellow">{friends.length} friends</span>
      }
    >
      <div className="space-y-6">

        {/* Search */}
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              className="input flex-1"
              placeholder="Search by Discord username..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && searchUsers()}
            />
            <button onClick={searchUsers} disabled={searching || !searchQuery.trim()} className="btn btn-primary px-4">
              {searching ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
            </button>
          </div>

          {searchResults.length > 0 && (
            <div className="card overflow-hidden animate-slide-up">
              {searchResults.map(user => {
                const rel = getRelationship(user.id);
                return (
                  <div key={user.id} className="lb-row">
                    <Avatar user={user} />
                    <div className="flex-1 min-w-0">
                      <p
                        className="font-semibold text-white cursor-pointer hover:text-[var(--color-primary)] transition-colors truncate"
                        onClick={() => navigate(`/profile/${user.id}`)}
                      >
                        {user.discord_username}
                      </p>
                    </div>
                    {rel === 'friend' ? (
                      <span className="badge badge-green">Friends</span>
                    ) : rel === 'pending' ? (
                      <span className="badge badge-gray">Pending</span>
                    ) : (
                      <button
                        onClick={() => sendRequest(user.id)}
                        disabled={sendingTo === user.id}
                        className="btn btn-primary py-1.5 px-3 text-xs"
                      >
                        {sendingTo === user.id ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                        Add
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Incoming Requests */}
        {pendingIn.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-muted)] flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[var(--color-primary)] text-black text-xs flex items-center justify-center font-bold">{pendingIn.length}</span>
              Friend Requests
            </h3>
            <div className="card overflow-hidden">
              {pendingIn.map(f => (
                <div key={f.id} className="lb-row">
                  <Avatar user={f.other} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white truncate">{f.other.discord_username}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">Wants to be friends</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => acceptRequest(f.id)} className="p-2 rounded-lg bg-[var(--color-success)]/20 text-[var(--color-success)] hover:bg-[var(--color-success)]/30 transition-colors">
                      <Check size={16} />
                    </button>
                    <button onClick={() => declineRequest(f.id)} className="p-2 rounded-lg bg-[var(--color-error)]/10 text-[var(--color-error)] hover:bg-[var(--color-error)]/20 transition-colors">
                      <X size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sent Requests */}
        {pendingOut.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Sent Requests</h3>
            <div className="card overflow-hidden">
              {pendingOut.map(f => (
                <div key={f.id} className="lb-row">
                  <Avatar user={f.other} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white truncate cursor-pointer hover:text-[var(--color-primary)]" onClick={() => navigate(`/profile/${f.other.id}`)}>
                      {f.other.discord_username}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">Pending...</p>
                  </div>
                  <button onClick={() => removeFriend(f.id)} className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-error)] transition-colors">
                    Cancel
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Friends List */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-muted)] flex items-center gap-2">
            <Users size={14} />
            Friends
          </h3>
          {loading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-14 rounded-xl" />)}</div>
          ) : friends.length === 0 ? (
            <div className="card p-8 text-center">
              <Users size={32} className="mx-auto mb-3 text-[var(--color-text-muted)]" />
              <p className="font-display text-lg font-bold text-white">No friends yet</p>
              <p className="text-sm text-[var(--color-text-muted)] mt-1">Search for players by Discord username above.</p>
            </div>
          ) : (
            <div className="card overflow-hidden">
              {friends.map(f => (
                <div key={f.id} className="lb-row group">
                  <Avatar user={f.other} />
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => navigate(`/profile/${f.other.id}`)}
                  >
                    <p className="font-semibold text-white group-hover:text-[var(--color-primary)] transition-colors truncate">
                      {f.other.discord_username}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => navigate(`/profile/${f.other.id}`)}
                      className="p-2 text-[var(--color-text-muted)] hover:text-white transition-colors"
                    >
                      <ChevronRight size={16} />
                    </button>
                    <button
                      onClick={() => removeFriend(f.id)}
                      className="p-2 text-[var(--color-text-muted)] hover:text-[var(--color-error)] transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppPage>
  );
}

function Avatar({ user }: { user: Profile }) {
  return user.discord_avatar ? (
    <img
      src={`https://cdn.discordapp.com/avatars/${user.discord_id}/${user.discord_avatar}.png`}
      alt={user.discord_username}
      className="w-9 h-9 rounded-lg flex-shrink-0"
    />
  ) : (
    <div className="w-9 h-9 rounded-lg bg-[var(--color-surface-lighter)] flex items-center justify-center text-sm font-bold text-[var(--color-primary)] flex-shrink-0">
      {user.discord_username.charAt(0).toUpperCase()}
    </div>
  );
}
