import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { usePlayer } from '../context/PlayerContext';
import { Users, Music2, UserPlus, Search, Loader2, Ghost, Eye, Bell, Check, X, Plus } from 'lucide-react';

const UserSearch = ({ currentUserId, onAction }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (query.length < 3) return;
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .ilike('username', `%${query}%`)
      .neq('id', currentUserId)
      .limit(5);
    setResults(data || []);
    setLoading(false);
  };

  const sendFriendRequest = async (friendId) => {
    const { error } = await supabase
      .from('notifications')
      .insert([{ 
        user_id: friendId, 
        actor_id: currentUserId, 
        type: 'friend_request' 
      }]);
    
    if (!error) {
      alert("Solicitud enviada a la bandeja");
      setResults(prev => prev.filter(r => r.id !== friendId));
    }
  };

  return (
    <div style={styles.searchBox}>
      <div style={styles.inputWrapper}>
        <input 
          placeholder="Buscar amigos..." 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          style={styles.searchInput}
        />
        <button onClick={handleSearch} style={styles.searchIconBtn}>
          {loading ? <Loader2 size={16} className="spin" /> : <Search size={16} />}
        </button>
      </div>
      {results.length > 0 && (
        <div style={styles.resultsList}>
          {results.map(u => (
            <div key={u.id} style={styles.userResultCard} onClick={() => sendFriendRequest(u.id)}>
              <img src={u.avatar_url || 'https://via.placeholder.com/24'} style={styles.miniAvatar} alt="avatar" />
              <span style={styles.resultName}>{u.username}</span>
              <UserPlus size={14} color="var(--accent)" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const SocialPanel = () => {
  const { user, setSearchQuery } = usePlayer();
  const [activeTab, setActiveTab] = useState('activity'); 
  const [friendsActivity, setFriendsActivity] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [bands, setBands] = useState([]);
  const [isCreatingBand, setIsCreatingBand] = useState(false);
  const [newBandName, setNewBandName] = useState('');
  const [isIncognito, setIsIncognito] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchActivity = async () => {
    if (!user) return;
    try {
      const { data: friendships } = await supabase.from('friendships').select('friend_id').eq('user_id', user.id);
      const friendIds = friendships?.map(f => f.friend_id) || [];

      if (friendIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('*')
          .in('id', friendIds)
          .eq('is_online', true)
          .order('updated_at', { ascending: false });
        setFriendsActivity(profiles || []);
      }
    } catch (err) { console.error(err); } 
    finally { setLoading(false); }
  };

  const fetchNotifications = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('notifications')
      .select('*, actor:profiles!actor_id(*)')
      .eq('user_id', user.id)
      .eq('is_read', false);
    setNotifications(data || []);
  };

  const fetchBands = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('band_members')
      .select('band_id, bands:bands(*)')
      .eq('user_id', user.id);
    
    if (data) {
        // Mapeamos para obtener la información de la banda directamente
        setBands(data.map(item => item.bands).filter(b => b !== null));
    }
  };

  const createBand = async () => {
    if (!newBandName.trim() || !user) return;
    
    try {
        // 1. Insertar la banda
        const { data: band, error: bandError } = await supabase
          .from('bands')
          .insert([{ name: newBandName, creator_id: user.id }])
          .select()
          .single();

        if (bandError) throw bandError;

        if (band) {
          // 2. Insertar al creador como miembro
          const { error: memberError } = await supabase
            .from('band_members')
            .insert([{ band_id: band.id, user_id: user.id }]);

          if (memberError) throw memberError;

          // 3. Limpiar y refrescar
          setNewBandName('');
          setIsCreatingBand(false);
          await fetchBands();
        }
    } catch (err) {
        console.error("Error creando banda:", err.message);
        alert("No se pudo crear la banda. Revisa tu conexión.");
    }
  };

  const acceptFriend = async (notif) => {
    await supabase.from('friendships').insert([
      { user_id: user.id, friend_id: notif.actor_id },
      { user_id: notif.actor_id, friend_id: user.id }
    ]);
    await supabase.from('notifications').update({ is_read: true }).eq('id', notif.id);
    fetchNotifications();
    fetchActivity();
  };

  const toggleIncognito = async () => {
    const nextState = !isIncognito;
    setIsIncognito(nextState);
    await supabase.from('profiles').update({ is_online: !nextState }).eq('id', user.id);
  };

  useEffect(() => {
    if (!user) return;
    fetchActivity();
    fetchNotifications();
    fetchBands();

    const channel = supabase.channel('social_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, fetchActivity)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, fetchNotifications)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [user]);

  return (
    <aside style={styles.floatingContainer}>
      <div style={styles.tabSelector}>
        <button onClick={() => setActiveTab('activity')} style={{...styles.tabBtn, color: activeTab === 'activity' ? 'var(--accent)' : '#888'}}>
          <Users size={16} /> Actividad
        </button>
        <button onClick={() => setActiveTab('bands')} style={{...styles.tabBtn, color: activeTab === 'bands' ? 'var(--accent)' : '#888'}}>
          <Music2 size={16} /> Bands
        </button>
        <button onClick={() => setActiveTab('inbox')} style={{...styles.tabBtn, color: activeTab === 'inbox' ? 'var(--accent)' : '#888'}}>
          <Bell size={16} /> 
          {notifications.length > 0 && <span style={styles.badge}>{notifications.length}</span>}
        </button>
      </div>

      <div style={{ padding: '15px 15px 0 15px' }}>
        <UserSearch currentUserId={user?.id} onAction={fetchNotifications} />
      </div>

      <div style={styles.list}>
        {activeTab === 'activity' && (
          loading ? <div style={styles.center}><Loader2 size={20} className="spin" /></div> :
          friendsActivity.length === 0 ? <div style={styles.emptyState}>No hay amigos activos</div> :
          friendsActivity.map(friend => (
            <div key={friend.id} style={styles.friendCard} onClick={() => friend.last_track_title && setSearchQuery(`${friend.last_track_title} ${friend.last_track_artist}`)}>
              <div style={styles.avatarWrapper}>
                <img src={friend.avatar_url || 'https://via.placeholder.com/40'} style={styles.mainAvatar} alt="avatar" />
                <div style={styles.onlineBadge} />
              </div>
              <div style={styles.trackDetails}>
                <p style={styles.friendName}>{friend.username}</p>
                <div style={styles.songRow}>
                  <Music2 size={12} color="var(--accent)" />
                  <span style={styles.songTitle}>{friend.last_track_title || 'En silencio'}</span>
                </div>
              </div>
            </div>
          ))
        )}

        {activeTab === 'bands' && (
          <div style={styles.bandsWrapper}>
            <button onClick={() => setIsCreatingBand(!isCreatingBand)} style={styles.createBandMainBtn}>
              {isCreatingBand ? 'Cancelar' : '+ Nueva Band'}
            </button>
            {isCreatingBand && (
              <div style={styles.createBandForm}>
                <input 
                    placeholder="Nombre de la Band..." 
                    value={newBandName} 
                    onChange={(e) => setNewBandName(e.target.value)} 
                    style={styles.bandInput} 
                />
                <button onClick={createBand} style={styles.fundarBtn}>Fundar</button>
              </div>
            )}
            {bands.length === 0 ? <p style={styles.emptyState}>No perteneces a ninguna band</p> :
              bands.map(b => (
                <div key={b.id} style={styles.bandCard}>
                  <div style={styles.bandAvatar}>{b.name ? b.name[0].toUpperCase() : 'B'}</div>
                  <div style={{flex: 1}}><p style={styles.friendName}>{b.name}</p></div>
                </div>
              ))
            }
          </div>
        )}

        {activeTab === 'inbox' && (
          <div style={styles.inboxWrapper}>
            {notifications.length === 0 ? <p style={styles.emptyState}>Bandeja vacía</p> :
              notifications.map(n => (
                <div key={n.id} style={styles.notifCard}>
                  <img src={n.actor?.avatar_url} style={styles.miniAvatar} alt="avatar" />
                  <div style={{ flex: 1 }}>
                    <p style={styles.notifText}><b>{n.actor?.username}</b> quiere ser tu amigo</p>
                    <div style={styles.btnRow}>
                      <button onClick={() => acceptFriend(n)} style={styles.acceptBtn}><Check size={12}/> Sí</button>
                    </div>
                  </div>
                </div>
              ))
            }
          </div>
        )}
      </div>

      <div style={styles.footer}>
        <button onClick={toggleIncognito} style={styles.incognitoBtn}>
          {isIncognito ? <Ghost size={16} color="#ff4444" /> : <Eye size={16} color="#888" />}
          <span style={{fontSize: '0.7rem', color: isIncognito ? '#ff4444' : '#888'}}>
            {isIncognito ? 'Invisible' : 'Visible'}
          </span>
        </button>
      </div>
    </aside>
  );
};

const styles = {
  floatingContainer: { position: 'absolute', top: '70px', right: '20px', width: '280px', height: '520px', background: 'rgba(15, 15, 15, 0.95)', backdropFilter: 'blur(20px)', borderRadius: '16px', border: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', zIndex: 9999, boxShadow: '0 10px 40px rgba(0,0,0,0.6)', overflow: 'hidden' },
  tabSelector: { display: 'flex', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--glass-border)' },
  tabBtn: { flex: 1, background: 'none', border: 'none', padding: '12px', fontSize: '0.65rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' },
  badge: { background: 'var(--accent)', color: '#000', padding: '1px 5px', borderRadius: '10px', fontSize: '0.6rem', marginLeft: '3px' },
  list: { flex: 1, overflowY: 'auto', padding: '15px' },
  searchBox: { position: 'relative', marginBottom: '10px' },
  inputWrapper: { display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', border: '1px solid var(--glass-border)' },
  searchInput: { flex: 1, background: 'none', border: 'none', padding: '8px', color: '#fff', fontSize: '0.75rem', outline: 'none' },
  bandInput: { flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: '6px', padding: '8px', color: '#fff', fontSize: '0.75rem' },
  searchIconBtn: { background: 'none', border: 'none', color: '#888', padding: '0 10px' },
  resultsList: { position: 'absolute', top: '42px', left: 0, right: 0, background: '#181818', borderRadius: '8px', border: '1px solid var(--glass-border)', zIndex: 100, padding: '4px' },
  userResultCard: { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', cursor: 'pointer', borderRadius: '6px' },
  miniAvatar: { width: '24px', height: '24px', borderRadius: '50%' },
  resultName: { flex: 1, fontSize: '0.75rem', color: '#eee' },
  friendCard: { display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center', cursor: 'pointer' },
  avatarWrapper: { position: 'relative' },
  mainAvatar: { width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover' },
  onlineBadge: { position: 'absolute', bottom: 1, right: 1, width: '9px', height: '9px', background: 'var(--accent)', borderRadius: '50%', border: '2px solid #0f0f0f' },
  trackDetails: { flex: 1, overflow: 'hidden' },
  friendName: { margin: 0, fontSize: '0.8rem', fontWeight: 'bold' },
  songRow: { display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' },
  songTitle: { fontSize: '0.7rem', color: '#aaa', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  inboxWrapper: { display: 'flex', flexDirection: 'column', gap: '10px' },
  notifCard: { padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', display: 'flex', gap: '10px' },
  notifText: { fontSize: '0.7rem', margin: '0 0 8px 0', lineHeight: '1.2' },
  btnRow: { display: 'flex', gap: '5px' },
  acceptBtn: { background: 'var(--accent)', border: 'none', borderRadius: '4px', padding: '3px 8px', fontSize: '0.65rem', fontWeight: 'bold', cursor: 'pointer' },
  fundarBtn: { background: 'var(--accent)', color: '#000', border: 'none', borderRadius: '6px', padding: '0 12px', fontSize: '0.7rem', fontWeight: 'bold', cursor: 'pointer' },
  footer: { padding: '10px', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'center' },
  incognitoBtn: { background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: '20px', padding: '5px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' },
  emptyState: { textAlign: 'center', color: '#666', fontSize: '0.75rem', marginTop: '20px' },
  center: { display: 'flex', justifyContent: 'center', padding: '20px' },
  bandsWrapper: { display: 'flex', flexDirection: 'column' },
  createBandMainBtn: { width: '100%', padding: '8px', background: 'none', border: '1px dashed #444', borderRadius: '8px', color: '#aaa', fontSize: '0.7rem', cursor: 'pointer', marginBottom: '10px' },
  createBandForm: { display: 'flex', gap: '8px', marginBottom: '15px' },
  bandCard: { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', marginBottom: '8px' },
  bandAvatar: { width: '32px', height: '32px', background: 'var(--accent)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontWeight: 'bold', fontSize: '0.8rem' }
};

export default SocialPanel;