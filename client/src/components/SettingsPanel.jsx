import React from 'react';
import { X, Volume2, Activity, Shield, LogOut, Moon, Zap, Globe, Bell } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import Equalizer from './Equalizer'; // Asegúrate de haber creado este componente

export default function SettingsPanel({ isOpen, onClose }) {
  const { 
    showWaveform, toggleWaveform, 
    boost, setBoost, 
    settings, updateSetting,
    user, logout 
  } = usePlayer();

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay oscuro de fondo */}
      <div onClick={onClose} style={overlayStyle} />
      
      <div style={panelStyle} className="glass-panel">
        <div style={headerStyle}>
          <h2 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--text-main)' }}>Ajustes</h2>
          <button onClick={onClose} style={closeBtnStyle}><X /></button>
        </div>

        <div style={contentStyle}>
          
          {/* SECCIÓN: ECUALIZADOR EN VIVO */}
          <section style={sectionStyle}>
            <h3 style={sectionTitleStyle}><Activity size={18} /> Sonido</h3>
            <div style={{...settingRowStyle, marginTop: '15px'}}>
              <span>Refuerzo de Graves (Boost)</span>
              <span style={{color: 'var(--accent)', fontWeight: 'bold'}}>{boost}x</span>
            </div>
            <input 
              type="range" min="1" max="3" step="0.1" 
              value={boost} 
              onChange={(e) => setBoost(parseFloat(e.target.value))}
              style={rangeStyle}
            />
          </section>

          {/* SECCIÓN: AUDIO & RENDIMIENTO */}
          <section style={sectionStyle}>
            <h3 style={sectionTitleStyle}><Zap size={18} /> Rendimiento</h3>
            <div style={settingRowStyle}>
              <span>Calidad de Streaming</span>
              <select 
                value={settings.quality} 
                onChange={(e) => updateSetting('quality', e.target.value)}
                style={selectStyle}
              >
                <option value="low">Baja (Ahorro)</option>
                <option value="high">Alta (Fidelidad)</option>
              </select>
            </div>
            <div style={settingRowStyle}>
              <span>Velocidad</span>
              <select 
                value={settings.playbackSpeed} 
                onChange={(e) => updateSetting('playbackSpeed', parseFloat(e.target.value))}
                style={selectStyle}
              >
                <option value="0.5">0.5x</option>
                <option value="1">Normal</option>
                <option value="1.5">1.5x</option>
                <option value="2">2x</option>
              </select>
            </div>
          </section>

          {/* SECCIÓN: PERSONALIZACIÓN */}
          <section style={sectionStyle}>
            <h3 style={sectionTitleStyle}><Moon size={18} /> Personalización</h3>
            <div style={settingRowStyle}>
              <span>Tema Visual</span>
              <select 
                value={settings.theme} 
                onChange={(e) => updateSetting('theme', e.target.value)}
                style={selectStyle}
              >
                <option value="dark">Deep Black</option>
                <option value="blue">Midnight Blue</option>
                <option value="purple">Vaporwave</option>
              </select>
            </div>
            <div style={settingRowStyle}>
              <span>Waveform visual</span>
              <button 
                onClick={toggleWaveform}
                style={{ ...toggleStyle, background: showWaveform ? 'var(--accent)' : '#3f3f46' }}
              >
                {showWaveform ? 'ON' : 'OFF'}
              </button>
            </div>
          </section>

          {/* SECCIÓN: NOTIFICACIONES */}
          <section style={sectionStyle}>
            <h3 style={sectionTitleStyle}><Bell size={18} /> Notificaciones</h3>
            <div style={settingRowStyle}>
              <span>Avisos de escritorio</span>
              <button 
                onClick={() => {
                  if (!settings.showNotifications) Notification.requestPermission();
                  updateSetting('showNotifications', !settings.showNotifications);
                }}
                style={{ ...toggleStyle, background: settings.showNotifications ? 'var(--accent)' : '#3f3f46' }}
              >
                {settings.showNotifications ? 'ON' : 'OFF'}
              </button>
            </div>
          </section>

          {/* SECCIÓN: CUENTA */}
          <section style={sectionStyle}>
            <h3 style={sectionTitleStyle}><Shield size={18} /> Cuenta</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '10px' }}>
              Conectado como:<br/><strong>{user?.email}</strong>
            </p>
            <button onClick={logout} style={logoutBtnStyle}>
              <LogOut size={16} /> Cerrar Sesión
            </button>
          </section>
        </div>
      </div>
    </>
  );
}

// --- ESTILOS MEJORADOS ---
const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 998 };
const panelStyle = { position: 'fixed', top: 0, right: 0, height: '100%', width: '350px', background: 'var(--bg-card)', zIndex: 999, boxShadow: '-10px 0 30px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--glass-border)' };
const headerStyle = { padding: '20px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const closeBtnStyle = { background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' };
const contentStyle = { padding: '20px', flex: 1, overflowY: 'auto' };
const sectionStyle = { marginBottom: '35px', paddingBottom: '15px', borderBottom: '1px solid rgba(255,255,255,0.03)' };
const sectionTitleStyle = { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', color: 'var(--accent)', marginBottom: '20px', textTransform: 'uppercase', letterSpacing: '1px' };
const settingRowStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', fontSize: '0.95rem', color: 'var(--text-main)' };
const selectStyle = { background: 'var(--bg-dark)', color: 'white', border: '1px solid var(--glass-border)', padding: '5px 10px', borderRadius: '6px', outline: 'none' };
const rangeStyle = { width: '100%', accentColor: 'var(--accent)', cursor: 'pointer' };
const toggleStyle = { border: 'none', padding: '4px 12px', borderRadius: '12px', color: 'white', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', transition: '0.3s' };
const logoutBtnStyle = { width: '100%', padding: '12px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginTop: '10px', fontWeight: 'bold', transition: '0.2s' };