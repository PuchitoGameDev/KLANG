import React from 'react';
import { Search, Minus, Square, X, Users } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';

// IMPORTANTE: Recibimos las funciones desde App.jsx
const TitleBar = ({ onToggleSocial, isSocialOpen }) => { 
  const { searchQuery, setSearchQuery } = usePlayer();

  const handleControl = (action) => {
    // Intentamos acceder a ipcRenderer de las dos formas posibles en Electron
    const ipc = window.ipcRenderer || (window.require && window.require('electron').ipcRenderer);

    if (ipc) {
      console.log("Enviando acción a Electron:", action);
      ipc.send(action);
    } else {
      console.warn("No se detectó el entorno de Electron para:", action);
    }
  };

  const BAR_HEIGHT = '55px';

  return (
    <header className="ignore-grid custom-titlebar" style={{
      position: 'fixed', top: 0, left: 0, right: 0, height: BAR_HEIGHT,
      backgroundColor: '#09090b', zIndex: 9999, WebkitAppRegion: 'drag',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      borderBottom: '1px solid rgba(255,255,255,0.08)', paddingLeft: '20px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', minWidth: '180px' }}>
        <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--accent)', marginRight: '15px' }} />
        <span style={{ fontSize: '12px', fontWeight: '900', letterSpacing: '5px' }}>KLANG</span>
      </div>

      {/* 2. CENTRO: BUSCADOR */}
      {/* Mantenemos el flex: 1 aquí para que el buscador sea el protagonista */}
      <div style={{ 
        flex: 1, 
        display: 'flex', 
        justifyContent: 'center', 
        WebkitAppRegion: 'no-drag', 
        padding: '0 20px' 
      }}>
        <div className="search-pill" style={{ 
          width: '100%', 
          maxWidth: '800px', // Un tamaño razonable para que no se coma toda la barra
          height: '34px', 
          display: 'flex', 
          alignItems: 'center', 
          padding: '0 20px' 
        }}>
          <Search size={16} />
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ background: 'transparent', border: 'none', outline: 'none', color: 'white', width: '100%', paddingLeft: '15px' }}
            placeholder="BUSCAR..." 
          />
        </div>
      </div>

      {/* 3. DERECHA: Los botones se empujan al final, dejando el hueco de en medio arrastrable */}
      <div style={{ 
        display: 'flex', 
        height: '100%', 
        marginLeft: 'auto', // <--- Esto empuja este div a la derecha del todo
        WebkitAppRegion: 'no-drag' 
      }}>
        
        {/* Este margen negativo o espaciador previo sin no-drag es lo que buscamos */}
        <div style={{ width: '40px', height: '100%', WebkitAppRegion: 'drag', cursor: 'move' }} />

        <button 
          className="titlebar-button btn-wide" 
          onClick={onToggleSocial}
          style={{ 
            color: isSocialOpen ? 'var(--accent)' : 'var(--text-muted)',
            backgroundColor: isSocialOpen ? 'rgba(255,255,255,0.08)' : 'transparent'
          }}
        >
          <Users size={18}/>
        </button>
        
        <div style={{ width: '10px', height: '100%' }} />

        <button className="titlebar-button btn-wide" onClick={() => handleControl('window-minimize')}><Minus size={20}/></button>
        <button className="titlebar-button btn-wide" onClick={() => handleControl('window-maximize')}><Square size={14}/></button>
        <button className="titlebar-button btn-wide btn-close" onClick={() => handleControl('window-close')}><X size={20}/></button>
      </div>

      <style>{`
        .custom-titlebar .btn-wide {
          width: 80px !important;
          min-width: 80px !important;
          height: 100% !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          transition: background 0.2s !important;
          border: none !important;
          background: transparent;
          cursor: pointer !important;
        }
        .custom-titlebar .btn-close:hover { background-color: #e81123 !important; }
        header.ignore-grid { display: flex !important; flex-direction: row !important; }
      `}</style>
    </header>
  );
};

export default TitleBar;