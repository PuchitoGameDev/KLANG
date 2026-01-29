import React, { useState, useEffect, useCallback } from 'react';
import { X, Zap, Loader2, ClipboardCheck, DownloadCloud, MousePointer2 } from 'lucide-react';

export default function SpotifyImporter({ onClose, onImportSuccess }) {
  const [isProcessing, setIsProcessing] = useState(false);

  // --- UTILIDAD DE LOGS PARA TERMINAL (ELECTRON) ---
  const terminal = (msg, type = 'log') => {
    if (window.electron && window.electron.ipcRenderer) {
      // Envía el mensaje al proceso principal de Node.js
      window.electron.ipcRenderer.send(type === 'error' ? 'terminal-error' : 'terminal-log', msg);
    } else {
      // Fallback por si lo corres en navegador
      console[type === 'error' ? 'error' : 'log'](`[Importer]: ${msg}`);
    }
  };

  const processCSV = useCallback((csvText, name = "Playlist Importada") => {
    setIsProcessing(true);
    terminal(`🚀 Iniciando importación de archivo: "${name}"`);

    try {
      // 1. Limpieza inicial y separación por líneas
      const lines = csvText.trim().split(/\r?\n/);
      if (lines.length < 2) throw new Error("El archivo CSV parece estar vacío.");

      // 2. Normalizar cabeceras para encontrar las columnas correctas
      const headers = lines[0].toLowerCase().replace(/"/g, '').split(',');
      terminal(`📊 Cabeceras detectadas: ${headers.join(' | ')}`);

      const iTitle = headers.findIndex(h => h.includes('track name') || h.includes('nombre de la canción'));
      const iArtist = headers.findIndex(h => h.includes('artist name') || (h.includes('nombre') && h.includes('artista')));
      const iImage = headers.findIndex(h => h.includes('url de la imagen') || h.includes('track image'));

      if (iTitle === -1 || iArtist === -1) {
        terminal("❌ Error: No se encontraron las columnas necesarias (Track/Artist).", "error");
        throw new Error("Formato no compatible. El CSV debe tener nombres de pista y artista.");
      }

      // 3. Procesar filas con Regex para manejar comas internas (ej: "Song, The")
      const tracks = lines.slice(1)
        .filter(line => line.trim() !== '' && line.includes(','))
        .map((line, index) => {
          // Este regex separa por comas pero respeta lo que esté dentro de comillas
          const col = line.match(/(".*?"|[^",\n\r]+)(?=\s*,|\s*$)/g) || [];
          
          const track = { 
            title: col[iTitle]?.replace(/"/g, '').trim(), 
            artist: col[iArtist]?.replace(/"/g, '').split(',')[0].trim(),
            image: col[iImage]?.replace(/"/g, '').trim() || null,
            youtubeId: null 
          };

          if (index % 25 === 0 && index > 0) terminal(`🔹 Procesados ${index} temas...`);
          return track;
        })
        .filter(t => t.title && t.artist && !t.artist.includes('spotify:'));

      // 4. Finalizar
      if (tracks.length > 0) {
        terminal(`✅ Importación exitosa: ${tracks.length} canciones listas para Klang.`);
        onImportSuccess({ 
          id: `pl-${Date.now()}`,
          name: name.replace('.csv', ''), 
          image: tracks[0]?.image || null, 
          tracks 
        });
        onClose();
      } else {
        throw new Error("No se pudo extraer ninguna canción válida.");
      }
    } catch (e) {
      terminal(`❌ FALLO: ${e.message}`, "error");
      alert("Error en la importación: " + e.message);
      setIsProcessing(false);
    }
  }, [onClose, onImportSuccess]);

  // --- AUTO-IMPORTAR AL COPIAR (CLIPBOARD SYNC) ---
  useEffect(() => {
    const checkClipboard = async () => {
      if (isProcessing) return;
      try {
        const text = await navigator.clipboard.readText();
        const isSpotifyCSV = text.toLowerCase().includes('track name') || 
                            text.toLowerCase().includes('nombre de la canción');

        if (isSpotifyCSV) {
          terminal("📋 Contenido de Spotify detectado en portapapeles. Procesando automáticamente...");
          processCSV(text, "Copiado desde Spotify");
        }
      } catch (err) {
        // Silencioso: el usuario no ha dado permiso de portapapeles aún
      }
    };

    window.addEventListener('focus', checkClipboard);
    return () => window.removeEventListener('focus', checkClipboard);
  }, [isProcessing, processCSV]);

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.name.endsWith('.csv')) {
      terminal(`📄 Archivo soltado: ${file.name}`);
      const reader = new FileReader();
      reader.onload = (ev) => processCSV(ev.target.result, file.name);
      reader.readAsText(file);
    }
  };

  return (
    <div className="auto-import-overlay" onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}>
      <div className="auto-import-card glass-panel">
        <header className="header">
          <div className="brand">
            <Zap size={18} fill="#1DB954" color="#1DB954" /> 
            <span>Klang Importer <small style={{fontSize:'0.6rem', opacity:0.5}}>ELECTRON</small></span>
          </div>
          <button onClick={onClose} className="close-btn"><X size={20} /></button>
        </header>

        <div className="body">
          {isProcessing ? (
            <div className="state-ui">
              <Loader2 className="spin" size={40} color="#1DB954" />
              <p>Procesando datos...</p>
              <span style={{fontSize: '0.7rem', color: '#555'}}>Revisa la terminal de VS Code</span>
            </div>
          ) : (
            <div className="state-ui">
              <DownloadCloud size={48} className="float" style={{color: '#1DB954', marginBottom: '15px'}} />
              <h3>Importación de Spotify</h3>
              <p>Arrastra el CSV de Exportify o copia el contenido y enfoca esta ventana.</p>
              
              <div className="options-grid">
                <div className="opt-card" onClick={() => window.open('https://watsonbox.github.io/exportify/', '_blank')}>
                  <MousePointer2 size={18} color="#1DB954" />
                  <h4>1. Exportar</h4>
                  <span>Abrir Exportify</span>
                </div>
                <div className="opt-card highlight">
                  <ClipboardCheck size={18} color="#1DB954" />
                  <h4>2. Sincronizar</h4>
                  <span>Pega o arrastra aquí</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .auto-import-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(12px); z-index: 9999; display: flex; align-items: center; justify-content: center; }
        .auto-import-card { width: 420px; background: #0f0f0f; border: 1px solid #222; border-radius: 28px; padding: 30px; color: white; box-shadow: 0 20px 50px rgba(0,0,0,0.5); }
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; }
        .brand { display: flex; align-items: center; gap: 10px; font-weight: 800; color: #1DB954; text-transform: uppercase; letter-spacing: 1px; }
        .state-ui { text-align: center; display: flex; flexDirection: column; align-items: center; }
        .state-ui h3 { margin: 15px 0 5px; font-size: 1.3rem; font-weight: 700; }
        .state-ui p { color: #888; font-size: 0.9rem; margin-bottom: 25px; line-height: 1.4; }
        .options-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; width: 100%; }
        .opt-card { background: #161616; padding: 20px; border-radius: 20px; border: 1px solid #222; cursor: pointer; transition: all 0.3s ease; text-align: left; }
        .opt-card:hover { background: #1f1f1f; border-color: #333; transform: translateY(-3px); }
        .opt-card.highlight { border-color: rgba(29, 185, 84, 0.4); background: rgba(29, 185, 84, 0.03); }
        .opt-card h4 { margin: 10px 0 4px; font-size: 0.95rem; font-weight: 600; }
        .opt-card span { font-size: 0.75rem; color: #555; }
        .spin { animation: spin 1s linear infinite; }
        .float { animation: float 3s ease-in-out infinite; }
        .close-btn { background: #1a1a1a; border: none; color: #555; cursor: pointer; padding: 8px; borderRadius: 50%; display: flex; transition: 0.2s; }
        .close-btn:hover { background: #222; color: #fff; }
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}