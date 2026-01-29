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
    prevTrack,
    isLoading
  } = usePlayer();

  // --- 1. TODOS LOS HOOKS SIEMPRE ARRIBA ---
  useEffect(() => {
    if (window.electron && window.electron.ipcRenderer) {
      const handlePlayerControl = (event, action) => {
        console.log("Comando Electron recibido:", action);
        switch (action) {
          case 'togglePause':
            // Usamos una referencia lógica simple: si está reproduciendo, pausa; si no, resume.
            if (isPlaying) {
              pause();
            } else {
              resume();
            }
            break;
          case 'next':
            nextTrack();
            break;
          case 'prev':
            prevTrack();
            break;
          default:
            break;
        }
      };

      window.electron.ipcRenderer.on('player-control', handlePlayerControl);
      
      return () => {
        window.electron.ipcRenderer.removeListener('player-control', handlePlayerControl);
      };
    }
    // Quitamos isPlaying de las dependencias si causa micro-pausas, 
    // pero lo mantenemos si queremos que el switch tenga el valor real.
  }, [isPlaying, pause, resume, nextTrack, prevTrack]);

  // --- 2. LÓGICA DE VARIABLES ---
  const isAdmin = user?.email === 'puchipuchitos@gmail.com';

  // --- 3. RETORNOS CONDICIONALES (SIEMPRE DESPUÉS DE LOS HOOKS) ---

  // Pantalla de carga
  if (isLoading) {
    return (
      <div style={{
        background: '#09090b',
        height: '100vh',
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ color: 'white', letterSpacing: '4px', fontWeight: 'bold' }}>CARGANDO KLANG...</div>
      </div>
    );
  }

  // Pantalla de Login / Acceso
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
        fontFamily: 'Plus Jakarta Sans, sans-serif'
      }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ letterSpacing: '12px', fontWeight: '900', fontSize: '3.5rem', margin: '0' }}>KLANG</h1>
          <p style={{ color: '#71717a', marginBottom: '40px', marginTop: '10px' }}>Tu música, sin interrupciones.</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
            <button
              onClick={loginWithGoogle}
              style={{
                padding: '14px 28px', backgroundColor: 'white', color: 'black',
                border: 'none', borderRadius: '8px', fontWeight: 'bold', width: '300px', cursor: 'pointer',
                transition: 'transform 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              Entrar con Google
            </button>

            <button
              onClick={enterAsGuest}
              style={{
                padding: '14px 28px', backgroundColor: 'transparent', color: '#a1a1aa',
                border: '1px solid #27272a', borderRadius: '8px', width: '300px', cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = '#52525b'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = '#27272a'}
            >
              Acceder como Invitado (Local)
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- 4. INTERFAZ PRINCIPAL ---
  return (
    <div
      data-theme={settings?.theme || 'dark'}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw',
        backgroundColor: '#09090b',
        overflow: 'hidden',
        color: 'white'
      }}
    >
      {/* BARRA DE TÍTULO SUPERIOR */}
      <TitleBar onToggleSocial={() => setShowSocial(!showSocial)} isSocialOpen={showSocial} />

      {/* CUERPO DE LA APP */}
      <div style={{
        display: 'flex',
        flexDirection: 'row',
        flex: 1,
        marginTop: '55px', // Altura del TitleBar
        height: 'calc(100vh - 55px - 90px)', // Restamos TitleBar y PlayerBar
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
          position: 'relative'
        }}>
          <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '20px' }}>
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

      {/* BARRA DE REPRODUCCIÓN INFERIOR */}
      <PlayerBar onOpenLyrics={() => setShowLyrics(!showLyrics)} />

      {/* COMPONENTES GLOBALES (MODALES/DRAWERS) */}
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