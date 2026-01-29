import React from 'react';
import { usePlayer } from '../context/PlayerContext';
import { Plus, Heart, ListPlus } from 'lucide-react';

export default function TrackOptionsMenu({ track, onClose, position }) {
  const { myPlaylists, addToPlaylist, toggleFavorite, favorites } = usePlayer();
  const isFav = favorites.includes(track.youtubeId || track.song_id || track.id);

  return (
    <>
      {/* Overlay para cerrar al hacer clic fuera */}
      <div 
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 999 }} 
      />
      
      <div style={{
        position: 'fixed',
        top: position.y,
        left: position.x,
        width: '220px',
        background: '#1f1f22',
        border: '1px solid #333',
        borderRadius: '12px',
        padding: '8px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
        zIndex: 1000,
      }}>
        <button 
          onClick={() => { toggleFavorite(track); onClose(); }}
          style={menuItemStyle}
        >
          <Heart size={16} fill={isFav ? "#ef4444" : "none"} color={isFav ? "#ef4444" : "white"} />
          {isFav ? 'Quitar de favoritos' : 'Añadir a favoritos'}
        </button>

        <div style={{ height: '1px', background: '#333', margin: '4px 0' }} />
        
        <p style={{ fontSize: '0.7rem', color: '#71717a', padding: '8px 12px', margin: 0 }}>
          AÑADIR A PLAYLIST
        </p>

        {myPlaylists.map(pl => (
          <button 
            key={pl.id}
            onClick={() => { addToPlaylist(pl.id, track); onClose(); }}
            style={menuItemStyle}
          >
            <ListPlus size={16} /> {pl.name}
          </button>
        ))}
      </div>
    </>
  );
}

const menuItemStyle = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '10px 12px',
  background: 'none',
  border: 'none',
  color: 'white',
  fontSize: '0.9rem',
  cursor: 'pointer',
  borderRadius: '8px',
  textAlign: 'left',
  transition: 'background 0.2s',
  hover: { background: '#2d2d30' }
};