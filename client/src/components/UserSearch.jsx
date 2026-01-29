import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Search, UserPlus, Check, Loader2 } from 'lucide-react';

const UserSearch = ({ currentUserId }) => {
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
      .neq('id', currentUserId) // No buscarse a uno mismo
      .limit(5);

    setResults(data || []);
    setLoading(false);
  };

  const addFriend = async (friendId) => {
    const { error } = await supabase
      .from('friendships')
      .insert([{ user_id: currentUserId, friend_id: friendId }]);
    
    if (!error) {
      setResults(prev => prev.filter(r => r.id !== friendId));
      alert("¡Amigo añadido!");
    }
  };

  return (
    <div style={styles.searchBox}>
      <div style={styles.inputWrapper}>
        <input 
          placeholder="Buscar amigos por nombre..." 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          style={styles.input}
        />
        <button onClick={handleSearch} style={styles.iconBtn}>
          {loading ? <Loader2 size={18} className="spin" /> : <Search size={18} />}
        </button>
      </div>

      <div style={styles.results}>
        {results.map(u => (
          <div key={u.id} style={styles.userCard}>
            <img src={u.avatar_url} style={styles.miniAvatar} />
            <span style={styles.userName}>{u.username}</span>
            <button onClick={() => addFriend(u.id)} style={styles.addBtn}>
              <UserPlus size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

const styles = {
  searchBox: { padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', marginBottom: '20px' },
  inputWrapper: { display: 'flex', gap: '8px', marginBottom: '10px' },
  input: { flex: 1, background: '#111', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '8px 12px', color: '#fff', fontSize: '0.8rem' },
  iconBtn: { background: 'var(--accent)', border: 'none', borderRadius: '8px', padding: '8px', cursor: 'pointer' },
  results: { display: 'flex', flexDirection: 'column', gap: '8px' },
  userCard: { display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' },
  miniAvatar: { width: '24px', height: '24px', borderRadius: '50%' },
  userName: { flex: 1, fontSize: '0.8rem', color: '#eee' },
  addBtn: { background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer' }
};

export default UserSearch;