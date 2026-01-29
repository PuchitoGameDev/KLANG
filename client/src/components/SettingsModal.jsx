import React from 'react';
import { X, LogOut, Globe, ShieldCheck, Database } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
// Importamos la conexión real desde tu archivo firebase.js
import { auth, provider, signInWithPopup, signOut } from '../firebase';

export default function SettingsModal({ onClose }) {
  const { user, setUser } = usePlayer();

  const handleGoogleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      // Extraemos la información relevante de Google
      const userData = { 
        id: result.user.uid, 
        name: result.user.displayName, 
        photo: result.user.photoURL,
        email: result.user.email 
      };
      
      setUser(userData);
      // Guardamos en el navegador para que no se pierda al recargar
      localStorage.setItem('klang_user', JSON.stringify(userData));
      onClose();
    } catch (error) {
      console.error("Error al iniciar sesión con Google:", error);
      alert("Error al conectar con Google. Verifica que habilitaste el método en la consola de Firebase.");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      localStorage.removeItem('klang_user');
      onClose();
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', 
      backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000
    }}>
      <div style={{ 
        background: '#121212', 
        width: '400px', 
        borderRadius: '24px', 
        padding: '2.5rem', 
        border: '1px solid #27272a',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
      }}>
        {/* Cabecera */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '800', color: 'white' }}>Ajustes</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer' }}>
            <X size={24} />
          </button>
        </div>

        {!user ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ 
              background: 'rgba(88, 101, 242, 0.1)', 
              padding: '1.5rem', 
              borderRadius: '16px', 
              marginBottom: '2rem' 
            }}>
              <ShieldCheck size={40} color="#5865F2" style={{ marginBottom: '1rem' }} />
              <p style={{ color: '#e4e4e7', fontSize: '0.95rem', margin: 0, lineHeight: '1.5' }}>
                Conecta tu cuenta para sincronizar tus playlists con Discord automáticamente.
              </p>
            </div>
            
            <button 
              onClick={handleGoogleLogin}
              style={{
                width: '100%', 
                padding: '14px', 
                background: 'white', 
                color: 'black',
                border: 'none', 
                borderRadius: '12px', 
                fontWeight: 'bold', 
                display: 'flex',
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: '12px', 
                cursor: 'pointer',
                fontSize: '1rem',
                transition: 'transform 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              <Globe size={20} /> Continuar con Google
            </button>
          </div>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: '2.5rem' }}>
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <img 
                  src={user.photo} 
                  style={{ width: 80, height: 80, borderRadius: '50%', border: '3px solid #27272a', marginBottom: '15px' }} 
                  alt="Profile" 
                />
                <div style={{ 
                  position: 'absolute', bottom: 20, right: 0, 
                  width: 18, height: 18, background: '#4ade80', 
                  borderRadius: '50%', border: '3px solid #121212' 
                }} />
              </div>
              <h3 style={{ margin: '0 0 5px 0', color: 'white', fontSize: '1.2rem' }}>{user.name}</h3>
              <p style={{ color: '#71717a', fontSize: '0.8rem', margin: 0 }}>{user.email}</p>
            </div>
            
            <div style={{ 
              background: '#09090b', 
              padding: '12px', 
              borderRadius: '12px', 
              marginBottom: '2rem',
              border: '1px solid #27272a'
            }}>
              <p style={{ fontSize: '0.7rem', color: '#555', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 5px 0' }}>Cloud ID</p>
              <code style={{ color: '#5865F2', fontSize: '0.85rem' }}>{user.id}</code>
            </div>

            <button 
              onClick={handleLogout}
              style={{
                width: '100%', 
                padding: '12px', 
                background: 'transparent', 
                color: '#f87171',
                border: '1px solid rgba(248, 113, 113, 0.2)', 
                borderRadius: '12px', 
                fontWeight: '600',
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: '10px', 
                cursor: 'pointer'
              }}
            >
              <LogOut size={18} /> Cerrar Sesión
            </button>
          </div>
        )}

        <div style={{ 
          marginTop: '2rem', 
          paddingTop: '1.5rem', 
          borderTop: '1px solid #27272a', 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px',
          justifyContent: 'center'
        }}>
          <Database size={14} color="#555" />
          <span style={{ fontSize: '0.75rem', color: '#555' }}>Sincronización Klang Cloud v2.1</span>
        </div>
      </div>
    </div>
  );
}