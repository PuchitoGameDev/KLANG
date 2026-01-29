import React, { useState } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { Plus, Heart, Music, ListMusic, MoreVertical, ListPlus } from 'lucide-react';

// --- SUB-COMPONENTE: MENÚ DE OPCIONES ---
function TrackOptionsMenu({ track, onClose, position }) {
  const { myPlaylists, addToPlaylist, toggleFavorite, favorites } = usePlayer();
  const trackId = track.youtubeId || track.song_id || track.id;
  const isFav = favorites.includes(trackId);

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 999 }} />
      <div style={{
        position: 'fixed', top: position.y, left: position.x - 180,
        width: '200px', background: '#1f1f22', border: '1px solid #333',
        borderRadius: '10px', padding: '6px', boxShadow: '0 8px 20px rgba(0,0,0,0.6)',
        zIndex: 1000,
      }}>
        <button onClick={() => { toggleFavorite(track); onClose(); }} className="menu-item">
          <Heart size={14} fill={isFav ? "#ef4444" : "none"} color={isFav ? "#ef4444" : "white"} />
          {isFav ? 'Quitar favorito' : 'Favorito'}
        </button>
        <div style={{ height: '1px', background: '#333', margin: '4px 8px' }} />
        <p style={{ fontSize: '0.65rem', color: '#71717a', padding: '4px 10px', margin: 0 }}>AÑADIR A PLAYLIST</p>
        {myPlaylists.map(pl => (
          <button key={pl.id} onClick={() => { addToPlaylist(pl.id, track); onClose(); }} className="menu-item">
            <ListPlus size={14} /> {pl.name}
          </button>
        ))}
      </div>
    </>
  );
}

export default function HomeView({ onSelectPlaylist, onGoToLibrary }) {
  const { user, setQueueAndPlay, favoriteTracks, myPlaylists } = usePlayer();
  const [menuConfig, setMenuConfig] = useState(null);

  // --- SOLUCIÓN AL ERROR: Definición de openMenu ---
  const openMenu = (e, track) => {
    e.stopPropagation();
    setMenuConfig({
      track,
      position: { x: e.clientX, y: e.clientY }
    });
  };

  // Definimos el objeto de favoritos como si fuera una playlist real
  const favPlaylistObject = {
    id: 'fav-special',
    name: 'Tus favoritos',
    isFav: true,
    playlist_items: favoriteTracks // Aquí ya tiene las canciones
  };

  const displayPlaylists = [favPlaylistObject, ...myPlaylists.slice(0, 4)];

  return (
    <div style={{ width: '100%', padding: '1.5rem', boxSizing: 'border-box', color: 'white' }}>
      <header style={{ marginBottom: '2.5rem' }}>
        <h1 style={{ fontSize: 'clamp(1.5rem, 5vw, 2rem)', fontWeight: 'bold', margin: '0 0 0.5rem 0' }}>
          {user ? `¡Hola, ${user.user_metadata?.full_name?.split(' ')[0] || 'músico'}!` : 'Bienvenido a Klang'}
        </h1>
        <p style={{ color: '#a1a1aa', margin: 0 }}>¿Qué te apetece escuchar hoy?</p>
      </header>

      {/* SECCIÓN: PLAYLISTS RECIENTES (Limitado a 5) */}
      <section style={{ marginBottom: '3rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
          <h2 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
            <ListMusic size={20} color="#3b82f6" /> Recientes
          </h2>
          <button onClick={onGoToLibrary} className="view-all-btn">Ver todo</button>
        </div>

        <div className="grid-responsive">
          {displayPlaylists.map((pl) => (
            <div 
              key={pl.id} 
              className="card-item" 
              onClick={() => onSelectPlaylist(pl)}
            >
              <div className="img-container">
                {pl.isFav ? (
                  <div className="empty-cover" style={{ background: 'linear-gradient(135deg, #450af5, #c4efd9)' }}>
                    <Heart size={40} fill="white" />
                  </div>
                ) : (
                  pl.playlist_items?.[0] ? (
                    <img src={pl.playlist_items[0].thumbnail} className="cover-img" alt={pl.name} />
                  ) : (
                    <div className="empty-cover"><Music size={32} /></div>
                  )
                )}
                <div className="play-overlay"><div className="play-btn-inner">▶</div></div>
              </div>
              <h4 className="title-text">{pl.name}</h4>
              <p className="subtitle-text">{pl.playlist_items?.length || 0} canciones</p>
            </div>
          ))}
        </div>
      </section>

      {/* SECCIÓN: CANCIONES FAVORITAS */}
      <section>
        <h2 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.2rem', margin: 0 }}>
          <Heart color="#ef4444" fill="#ef4444" size={20} /> Canciones que te gustan
        </h2>
        {favoriteTracks.length > 0 ? (
          <div className="grid-responsive">
            {favoriteTracks.slice(0, 5).map((track, index) => (
              <div key={track.song_id || index} onClick={() => setQueueAndPlay(favoriteTracks, index)} className="card-item">
                <div className="img-container">
                  <img src={track.thumbnail} className="cover-img" alt={track.title} />
                  <div className="play-overlay"><div className="play-btn-inner">▶</div></div>
                  {/* Botón corregido */}
                  <button onClick={(e) => openMenu(e, track)} className="more-btn"><MoreVertical size={18} /></button>
                </div>
                <h4 className="title-text">{track.title}</h4>
                <p className="subtitle-text">{track.artist}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state"><p>Dale al ❤️ en cualquier canción para guardarla aquí.</p></div>
        )}
      </section>

      {menuConfig && <TrackOptionsMenu track={menuConfig.track} position={menuConfig.position} onClose={() => setMenuConfig(null)} />}

      <style>{`
        .grid-responsive { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 20px; width: 100%; }
        .card-item { cursor: pointer; background: #18181b; padding: 14px; border-radius: 12px; transition: all 0.3s ease; position: relative; }
        .card-item:hover { background: #27272a; transform: translateY(-5px); }
        .img-container { position: relative; aspect-ratio: 1/1; border-radius: 8px; overflow: hidden; margin-bottom: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.4); }
        .cover-img { width: 100%; height: 100%; object-fit: cover; }
        .empty-cover { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: #3f3f46; background: #111; }
        .title-text { margin: 0 0 4px 0; font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 600; color: #fff; }
        .subtitle-text { margin: 0; font-size: 0.8rem; color: #a1a1aa; }
        
        .play-overlay { position: absolute; bottom: 10px; right: 10px; opacity: 0; transition: 0.3s; transform: translateY(10px); }
        .card-item:hover .play-overlay { opacity: 1; transform: translateY(0); }
        .play-btn-inner { background: #3b82f6; width: 40px; height: 40px; border-radius: 50%; color: white; display: flex; align-items: center; justify-content: center; font-size: 14px; box-shadow: 0 4px 10px rgba(0,0,0,0.3); }
        
        .more-btn { position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.6); border: none; color: white; border-radius: 50%; padding: 5px; cursor: pointer; opacity: 0; transition: 0.2s; }
        .card-item:hover .more-btn { opacity: 1; }
        
        .view-all-btn { background: none; border: none; color: #3b82f6; cursor: pointer; font-size: 0.85rem; font-weight: 600; transition: 0.2s; }
        .view-all-btn:hover { color: #60a5fa; text-decoration: underline; }
        
        .empty-state { padding: 2rem; text-align: center; background: #111113; border-radius: 12px; border: 1px dashed #27272a; color: #71717a; font-size: 0.9rem; }
        .menu-item { width: 100%; display: flex; align-items: center; gap: 10px; padding: 10px; background: none; border: none; color: white; font-size: 0.85rem; cursor: pointer; border-radius: 6px; text-align: left; }
        .menu-item:hover { background: #3b82f6; }
      `}</style>
    </div>
  );
}