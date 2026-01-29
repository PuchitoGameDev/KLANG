import React, { useState } from 'react';
import { usePlayer } from '../context/PlayerContext'; 
import { Home, Search, Library, Settings, LogOut, LogIn, Music, ShieldCheck, Plus, Users, Music2 } from 'lucide-react';
import SpotifyImporter from './SpotifyImporter'; 

export default function Sidebar({ setView, activeView, onOpenSettings, isAdmin, toggleSocial, isSocialOpen }) {
  const { user, loginWithGoogle, logout, importSpotifyPlaylist } = usePlayer();
  const [isSpotifyModalOpen, setIsSpotifyModalOpen] = useState(false);

  const menuItems = [
    { id: 'main', label: 'Inicio', icon: <Home size={20} strokeWidth={1.5} /> },
    { id: 'search', label: 'Explorar', icon: <Search size={20} strokeWidth={1.5} /> },
    { id: 'library', label: 'Mi Música', icon: <Library size={20} strokeWidth={1.5} /> },
    { id: 'bands', label: 'Mis Bands', icon: <Music2 size={20} strokeWidth={1.5} /> }
  ];

  const handleImportSuccess = async (playlistData) => {
    const result = await importSpotifyPlaylist(playlistData);
    if (result.success) {
      setIsSpotifyModalOpen(false);
      setView('library');
    } else {
      alert("Error al importar: " + result.error);
    }
  };

  return (
    <aside className="sidebar-container" style={{ 
      width: '260px', background: 'var(--bg-dark)', display: 'flex', flexDirection: 'column', 
      borderRight: '1px solid var(--glass-border)', height: '100%', padding: '24px 16px',
      position: 'relative', transition: 'all 0.4s ease', flexShrink: 0
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '0 12px 32px 12px', color: 'var(--accent)' }}>
        <div style={{ background: 'var(--accent)', padding: '6px', borderRadius: '8px' }}>
          <Music size={22} color="black" fill="black" />
        </div>
        <span style={{ fontSize: '1.4rem', fontWeight: '900', color: 'var(--text-main)', letterSpacing: '-1px' }}>Klang</span>
      </div>

      {/* Navegación Principal */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
        {menuItems.map(item => (
          <button 
            key={item.id}
            onClick={() => setView(item.id)}
            className="sidebar-link"
            style={{
              display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 16px',
              background: activeView === item.id ? 'var(--glass-bg)' : 'transparent',
              color: activeView === item.id ? 'var(--text-main)' : 'var(--text-muted)',
              border: 'none', borderRadius: '10px', fontSize: '0.95rem', 
              fontWeight: activeView === item.id ? '600' : '500', cursor: 'pointer', textAlign: 'left',
              transition: 'all 0.2s'
            }}
          >
            {item.icon} {item.label}
          </button>
        ))}

        <button 
          onClick={toggleSocial}
          className="sidebar-link"
          style={{
            display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 16px',
            background: isSocialOpen ? 'var(--glass-bg)' : 'transparent',
            color: isSocialOpen ? 'var(--accent)' : 'var(--text-muted)',
            border: 'none', borderRadius: '10px', fontSize: '0.95rem', 
            fontWeight: isSocialOpen ? '600' : '500', cursor: 'pointer', textAlign: 'left',
            transition: 'all 0.2s', marginTop: '4px'
          }}
        >
          <Users size={20} strokeWidth={1.5} />
          <span>Amigos</span>
        </button>

        <button 
          onClick={() => setIsSpotifyModalOpen(true)}
          className="spotify-sync-btn"
          style={{
            display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 16px', marginTop: '12px',
            background: 'rgba(29, 185, 84, 0.1)', border: '1px solid rgba(29, 185, 84, 0.15)',
            color: '#1DB954', borderRadius: '10px', fontSize: '0.95rem', fontWeight: '600',
            cursor: 'pointer', transition: '0.2s', textAlign: 'left'
          }}
        >
          <Plus size={16} />
          <span>Spotify Sync</span>
        </button>

        {isAdmin && (
          <button 
            onClick={() => setView('admin')}
            className="sidebar-link admin-link"
            style={{
              display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 16px', marginTop: '8px',
              background: activeView === 'admin' ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
              color: '#ef4444', borderRadius: '10px', fontSize: '0.95rem', fontWeight: '600', cursor: 'pointer',
              border: activeView === 'admin' ? '1px solid rgba(239, 68, 68, 0.5)' : '1px dashed rgba(239, 68, 68, 0.3)',
              textAlign: 'left', transition: 'all 0.2s'
            }}
          >
            <ShieldCheck size={20} strokeWidth={2} /> Moderación
          </button>
        )}
      </nav>

      {/* Footer del Sidebar */}
      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', paddingTop: '20px', borderTop: '1px solid var(--glass-border)' }}>
        {user ? (
          <div style={{ 
            padding: '12px', background: 'var(--glass-bg)', borderRadius: '14px', border: '1px solid var(--glass-border)',
            display: 'flex', alignItems: 'center', gap: '12px' 
          }}>
            <img src={user.user_metadata?.avatar_url} alt="Avatar" style={{ width: '36px', height: '36px', borderRadius: '50%', border: '2px solid var(--bg-hover)' }} />
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user.user_metadata?.full_name || 'Usuario'}
              </div>
              <button onClick={logout} className="logout-simple-btn">
                <LogOut size={14} /> Salir
              </button>
            </div>
          </div>
        ) : (
          <button onClick={loginWithGoogle} className="login-google-btn">
            <LogIn size={18} /> Iniciar con Google
          </button>
        )}

        <button onClick={onOpenSettings} className="settings-btn-sidebar">
          <Settings size={20} strokeWidth={1.5} />
          <span>Configuración</span>
        </button>
      </div>

      {isSpotifyModalOpen && (
        <SpotifyImporter 
          onClose={() => setIsSpotifyModalOpen(false)} 
          onImportSuccess={handleImportSuccess}
        />
      )}

      <style>{`
        .sidebar-link:hover { color: var(--text-main) !important; background: var(--bg-hover) !important; }
        .spotify-sync-btn:hover { background: rgba(29, 185, 84, 0.2) !important; transform: translateY(-1px); color: #1ed760 !important; }
        .admin-link:hover { background: rgba(239, 68, 68, 0.25) !important; color: #ff5f5f !important; }
        .logout-simple-btn { background: none; border: none; color: var(--text-muted); font-size: 0.75rem; cursor: pointer; padding: 0; display: flex; align-items: center; gap: 4px; transition: 0.2s; }
        .logout-simple-btn:hover { color: #ef4444; }
        .login-google-btn { padding: 12px; background: var(--text-main); color: var(--bg-dark); border-radius: 12px; border: none; display: flex; align-items: center; justify-content: center; gap: 10px; font-weight: 700; cursor: pointer; transition: 0.2s; }
        .login-google-btn:hover { transform: translateY(-2px); box-shadow: 0 4px 15px rgba(255,255,255,0.1); }
        .settings-btn-sidebar { display: flex; align-items: center; gap: 16px; padding: 10px 16px; background: transparent; color: var(--text-muted); border: none; cursor: pointer; transition: 0.2s; text-align: left; }
        .settings-btn-sidebar:hover { color: var(--text-main); }
      `}</style>
    </aside>
  );
}