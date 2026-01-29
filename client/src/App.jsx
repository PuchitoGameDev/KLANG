import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import PlayerBar from './components/PlayerBar';
import MainView from './components/MainView'; 
import LyricsView from './components/LyricsView';
import AdminPanel from './components/AdminPanel';
import SocialPanel from './components/SocialPanel';
import BandsView from './components/BandsView'; 
import { PlayerProvider, usePlayer } from './context/PlayerContext';
import SettingsPanel from './components/SettingsPanel';
import TitleBar from './components/TitleBar';
import QueueDrawer from './components/QueueDrawer';


const ADMIN_EMAIL = "puchipuchitos@gmail.com";

function AppContent() {
  const [activeView, setActiveView] = useState('main');
  const [showLyrics, setShowLyrics] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSocial, setShowSocial] = useState(false); 
  
  const { 
    user, 
    isGuest,           
    enterAsGuest,      
    loginWithGoogle,
    settings, 
    isPlaying, 
    pause, 
    resume, 
    nextTrack, 
    prevTrack 
  } = usePlayer(); 

  const isAdmin = user?.email === 'puchipuchitos@gmail.com';

  // Sincronización con Electron IPC para atajos de teclado
  useEffect(() => {
    if (window.electron && window.electron.ipcRenderer) {
      const handlePlayerControl = (event, action) => {
        switch (action) {
          case 'togglePause': isPlaying ? pause() : resume(); break;
          case 'next': nextTrack(); break;
          case 'prev': prevTrack(); break;
          default: break;
        }
      };
      
      window.electron.ipcRenderer.on('player-control', handlePlayerControl);
      return () => window.electron.ipcRenderer.removeListener('player-control', handlePlayerControl);
    }
  }, [isPlaying, pause, resume, nextTrack, prevTrack]);

  // --- PROTECCIÓN DE RUTA: SI NO HAY USUARIO NI ES INVITADO, MOSTRAR LOGIN ---
  if (!user && !isGuest) {
    return (
      <div style={{ 
        height: '100vh', 
        width: '100vw', 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center', 
        justifyContent: 'center', 
        backgroundColor: '#09090b', 
        color: 'white',
        fontFamily: 'sans-serif'
      }}>
        <div style={{ textAlign: 'center', animation: 'fadeIn 0.5s ease-in' }}>
          <h1 style={{ letterSpacing: '12px', fontWeight: '900', fontSize: '3rem', margin: '0' }}>KLANG</h1>
          <p style={{ color: '#71717a', marginBottom: '40px', marginTop: '10px' }}>Tu música, sin interrupciones.</p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
            <button 
              onClick={loginWithGoogle}
              style={{
                padding: '14px 28px',
                backgroundColor: 'white',
                color: 'black',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 'bold',
                fontSize: '1rem',
                cursor: 'pointer',
                transition: 'transform 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                width: '280px',
                justifyContent: 'center'
              }}
              onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
              onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" width="18" />
              Entrar con Google
            </button>

            <button 
              onClick={enterAsGuest}
              style={{
                padding: '14px 28px',
                backgroundColor: 'transparent',
                color: '#a1a1aa',
                border: '1px solid #27272a',
                borderRadius: '8px',
                fontWeight: '600',
                fontSize: '0.9rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
                width: '280px'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.borderColor = '#52525b';
                e.currentTarget.style.color = 'white';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.borderColor = '#27272a';
                e.currentTarget.style.color = '#a1a1aa';
              }}
            >
              Acceder como Invitado (Local)
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- INTERFAZ PRINCIPAL (SI HAY USER O ES GUEST) ---
  return (
    <div 
      data-theme={settings?.theme || 'dark'} 
      style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        height: '100vh', 
        width: '100vw', 
        backgroundColor: 'var(--bg-dark)', 
        overflow: 'hidden'
      }}
    >
      {/* 1. BARRA DE TÍTULO */}
      <TitleBar onToggleSocial={() => setShowSocial(!showSocial)} isSocialOpen={showSocial} />

      {/* 2. ÁREA DE TRABAJO */}
      <div style={{ 
        display: 'flex', 
        flexDirection: 'row', 
        flex: 1, 
        marginTop: '55px', 
        height: 'calc(100vh - 55px - 90px)', 
        overflow: 'hidden'
      }}>
        
        <Sidebar 
          activeView={activeView} 
          setView={setActiveView} 
          onOpenSettings={() => setShowSettings(true)}
          isAdmin={isAdmin}
          toggleSocial={() => setShowSocial(!showSocial)}
          isSocialOpen={showSocial}
        />
        
        <main style={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          overflow: 'hidden',
          background: 'linear-gradient(to bottom, rgba(255,255,255,0.01), transparent)'
        }}>
          <div style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
            {/* Aquí implementamos las rutas dentro del main */}
            <Routes>
              <Route path="/" element={
                activeView === 'admin' && isAdmin ? (
                  <AdminPanel />
                ) : activeView === 'bands' ? (
                  <BandsView />
                ) : (
                  <MainView activeView={activeView} setView={setActiveView} />
                )
              } />
            </Routes>
            
            {showLyrics && <LyricsView onClose={() => setShowLyrics(false)} />}
            {showSocial && <SocialPanel />}
          </div>
        </main>
      </div>

      {/* 3. PLAYER BAR */}
      <PlayerBar onOpenLyrics={() => setShowLyrics(!showLyrics)} />

      {/* COMPONENTES FLOTANTES */}
      <SettingsPanel isOpen={showSettings} onClose={() => setShowSettings(false)} />
      <QueueDrawer />
    </div>
  );
}

export default function App() {
  return (
      <PlayerProvider>
        <AppContent />
      </PlayerProvider>
  );
}