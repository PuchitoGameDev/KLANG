import React, { useState, useEffect } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { Music, Heart, Loader2, CheckCircle2 } from 'lucide-react';
import Modal from './Modal'; 
import SpotifyImporter from './SpotifyImporter'; 

export default function LibraryView({ onSelectPlaylist }) {
  const { 
    myPlaylists, 
    favoriteTracks, 
    createPlaylist, 
    importSpotifyPlaylist 
  } = usePlayer();
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSpotifyModalOpen, setIsSpotifyModalOpen] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");

  // Estados para feedback visual
  const [isImporting, setIsImporting] = useState(false);
  const [showSuccessBadge, setShowSuccessBadge] = useState(false);

  // Auto-ocultar notificación de éxito
  useEffect(() => {
    if (showSuccessBadge) {
      const timer = setTimeout(() => setShowSuccessBadge(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showSuccessBadge]);

  const handleCreateConfirm = async () => {
    const name = newPlaylistName.trim() || "Nueva Playlist";
    await createPlaylist(name, []);
    setShowCreateModal(false);
    setNewPlaylistName(""); 
  };

  const handleSpotifySuccess = async (playlistData) => {
    setIsSpotifyModalOpen(false);
    setIsImporting(true); // Activa la barra de carga
    
    try {
      const result = await importSpotifyPlaylist(playlistData);
      if (result && result.success) {
        setShowSuccessBadge(true);
      } else {
        alert("Error al importar: " + (result?.error || "Desconocido"));
      }
    } catch (error) {
      console.error("Error en la importación:", error);
    } finally {
      setIsImporting(false); // Desactiva la barra de carga
    }
  };

  // --- ESTILOS ---
  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: '1.5rem',
  };

  const cardStyle = {
    background: '#181818',
    padding: '1rem',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    boxSizing: 'border-box',
    border: '1px solid transparent'
  };

  const imgContainerStyle = {
    width: '100%',
    aspectRatio: '1/1',
    borderRadius: '6px',
    overflow: 'hidden',
    marginBottom: '1rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#282828',
    boxShadow: '0 8px 16px rgba(0,0,0,0.3)'
  };

  const titleStyle = {
    margin: '0 0 4px 0',
    fontSize: '1rem',
    fontWeight: 'bold',
    color: 'white',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  };

  const subtitleStyle = {
    margin: 0,
    color: '#b3b3b3',
    fontSize: '0.85rem'
  };

  return (
    <div style={{ padding: '2rem', color: 'white', minHeight: '100%', position: 'relative' }}>
      
      {/* BARRA DE PROGRESO (Solo visible al importar) */}
      {isImporting && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
          background: 'rgba(29, 185, 84, 0.1)', zIndex: 1000, overflow: 'hidden'
        }}>
          <div style={{
            height: '100%', background: '#1DB954', width: '30%',
            boxShadow: '0 0 10px #1DB954', animation: 'loading-bar 1.5s infinite linear'
          }} />
        </div>
      )}

      {/* NOTIFICACIÓN DE ÉXITO */}
      {showSuccessBadge && (
        <div style={{
          position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
          background: '#1DB954', color: 'white', padding: '12px 24px', borderRadius: '50px',
          display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold', zIndex: 2000,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)', animation: 'popIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
        }}>
          <CheckCircle2 size={20} /> Playlist sincronizada correctamente
        </div>
      )}
      
      {/* Modal de Creación Manual */}
      {showCreateModal && (
        <Modal 
          title="Crear Nueva Playlist"
          description="Escribe el nombre de tu lista de reproducción."
          inputValue={newPlaylistName}
          onChange={setNewPlaylistName}
          onConfirm={handleCreateConfirm}
          onCancel={() => {
            setShowCreateModal(false);
            setNewPlaylistName("");
          }}
          confirmText="Crear Playlist"
        />
      )}

      {/* MODAL DE IMPORTACIÓN SPOTIFY */}
      {isSpotifyModalOpen && (
        <SpotifyImporter 
          onClose={() => setIsSpotifyModalOpen(false)} 
          onImportSuccess={handleSpotifySuccess}
        />
      )}

      {/* Cabecera */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '2rem' 
      }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>Mi Música</h1>
        
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button 
            onClick={() => setIsSpotifyModalOpen(true)} 
            disabled={isImporting}
            style={{
              background: isImporting ? '#15803d' : '#1DB954',
              border: 'none',
              color: 'white',
              padding: '10px 20px',
              borderRadius: '25px',
              cursor: isImporting ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s ease'
            }}
          >
            {isImporting ? <Loader2 size={18} className="spin" /> : null}
            {isImporting ? 'Sincronizando...' : 'Sincronizar Spotify'}
          </button>

          <button 
            onClick={() => setShowCreateModal(true)} 
            style={{ 
              background: '#3b82f6', 
              border: 'none', 
              color: 'white', 
              padding: '10px 20px', 
              borderRadius: '25px', 
              cursor: 'pointer', 
              fontWeight: 'bold',
            }}
          >
            Nueva Playlist
          </button>
        </div>
      </div>

      <div style={gridStyle}>
        {/* SECCIÓN: Favoritos */}
        <div 
          style={cardStyle} 
          onMouseEnter={(e) => e.currentTarget.style.background = '#282828'}
          onMouseLeave={(e) => e.currentTarget.style.background = '#181818'}
          onClick={() => onSelectPlaylist({ 
            name: 'Mis Favoritos', 
            playlist_items: favoriteTracks, 
            isFav: true 
          })}
        >
          <div style={{ ...imgContainerStyle, background: 'linear-gradient(135deg, #450a0a, #991b1b)' }}>
            <Heart size={48} fill="white" color="white" />
          </div>
          <h4 style={titleStyle}>Tus Me Gusta</h4>
          <p style={subtitleStyle}>{favoriteTracks.length} canciones</p>
        </div>

        {/* SECCIÓN: Playlists del Usuario */}
        {myPlaylists.map((pl) => (
          <div 
            key={pl.id} 
            style={cardStyle}
            onMouseEnter={(e) => e.currentTarget.style.background = '#282828'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#181818'}
            onClick={() => onSelectPlaylist(pl)}
          >
            <div style={imgContainerStyle}>
              {pl.playlist_items?.[0] ? (
                <img 
                  src={pl.playlist_items[0].thumbnail} 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                  alt={pl.name} 
                />
              ) : (
                <Music size={40} color="#555" />
              )}
            </div>
            <h4 style={titleStyle}>{pl.name}</h4>
            <p style={subtitleStyle}>
              {pl.playlist_items?.length || 0} canciones
            </p>
          </div>
        ))}
      </div>

      {/* Animaciones CSS */}
      <style>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes loading-bar {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
        @keyframes popIn {
          0% { transform: translate(-50%, 50px); opacity: 0; }
          100% { transform: translate(-50%, 0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}