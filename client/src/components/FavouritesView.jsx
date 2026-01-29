import React from 'react';
import { usePlayer } from '../context/PlayerContext';
import { Play, TRASH2, Music } from 'lucide-react';

export default function FavoritesView() {
  const { favoriteTracks, setQueueAndPlay, toggleFavorite } = usePlayer();

  if (favoriteTracks.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#a1a1aa' }}>
        <Music size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
        <h3>Tu lista de favoritos está vacía</h3>
        <p>¡Empieza a explorar y dale al corazón!</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ color: 'white', marginBottom: '1.5rem' }}>Mis Favoritos</h1>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {favoriteTracks.map((track, index) => (
          <div 
            key={track.song_id}
            className="track-row"
            style={{
              display: 'flex', alignItems: 'center', gap: '15px',
              padding: '10px', borderRadius: '8px', cursor: 'pointer',
              transition: 'background 0.2s'
            }}
            onClick={() => setQueueAndPlay(favoriteTracks.slice(index))}
          >
            <img src={track.thumbnail} style={{ width: '45px', height: '45px', borderRadius: '4px' }} />
            <div style={{ flex: 1 }}>
              <div style={{ color: 'white', fontSize: '0.95rem' }}>{track.title}</div>
              <div style={{ color: '#a1a1aa', fontSize: '0.85rem' }}>{track.artist}</div>
            </div>
            <button 
              onClick={(e) => { e.stopPropagation(); toggleFavorite(track); }}
              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}
            >
              ❤️
            </button>
          </div>
        ))}
      </div>

      <style>{`
        .track-row:hover { background: rgba(255,255,255,0.1); }
      `}</style>
    </div>
  );
}