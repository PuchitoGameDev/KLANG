import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Trash2, AlertCircle, Music, User, Check, Edit3, Sparkles } from 'lucide-react';

export default function AdminPanel() {
  const [reports, setReports] = useState([]);
  const [editingReport, setEditingReport] = useState(null);
  const [lyricInput, setLyricInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [isAutoLoading, setIsAutoLoading] = useState(false);

  useEffect(() => { fetchReports(); }, []);

  const fetchReports = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('lyric_reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error) setReports(data || []);
    setLoading(false);
  };

  // --- FUNCIÓN DE AUTOCOMPLETADO (NUEVA) ---
  const fetchAutoLyrics = async (trackId) => {
    if (!trackId || !editingReport) return;
    
    setIsAutoLoading(true);
    setLyricInput("Buscando en la base de datos global...");

    // Forzamos la lectura de las columnas exactas de tu tabla
    const title = editingReport.song_title || "";
    const artist = editingReport.song_artist || "";
    
    // Creamos la búsqueda: "Título Artista"
    const fullSearch = `${title} ${artist}`.trim();

    console.log("Enviando al servidor:", { id: trackId, q: fullSearch });

    try {
      const response = await fetch(
        `http://localhost:5002/api/lyrics?id=${trackId}&q=${encodeURIComponent(fullSearch)}`
      );
      
      if (!response.ok) throw new Error("No se encontró la letra");

      const data = await response.json();
      if (data.lyrics) {
        setLyricInput(data.lyrics);
      }
    } catch (err) {
      alert("No se encontró la letra automática. Verifica que el título y artista sean correctos.");
      setLyricInput("");
    } finally {
      setIsAutoLoading(false);
    }
  };

  const validateLRC = (text) => {
    if (!text.trim()) return { valid: false, msg: "La letra no puede estar vacía." };
    const lrcRegex = /\[\d{2,}:\d{2}(.\d{2,3})?\]/;
    if (!lrcRegex.test(text)) {
      return { valid: false, msg: "Formato inválido. Usa marcas de tiempo como [00:12.30]" };
    }
    return { valid: true };
  };

  const openEditor = async (report) => {
    const trackId = report?.song_id;
    if (!trackId) return alert("ID no encontrado.");

    setEditingReport(report);
    setLyricInput("Cargando...");

    try {
      const { data, error } = await supabase
        .from('community_lyrics')
        .select('lyrics_lrc')
        .eq('song_id', String(trackId))
        .maybeSingle();

      if (error) throw error;
      setLyricInput(data?.lyrics_lrc || "");
    } catch (err) {
      console.error("Error:", err.message);
      setLyricInput("");
    }
  };

  const saveCorrection = async () => {
    if (!editingReport) return;
    const validation = validateLRC(lyricInput);
    if (!validation.valid) return alert(validation.msg);

    try {
      const { error: err1 } = await supabase
        .from('community_lyrics')
        .upsert({ 
          song_id: editingReport.song_id, 
          lyrics_lrc: lyricInput, 
          updated_at: new Date(),
          title: editingReport.song_title || "Actualizado por Admin"
        }, { onConflict: 'song_id' });

      if (err1) throw err1;

      await supabase.from('lyric_reports').delete().eq('id', editingReport.id);

      setReports(prev => prev.filter(r => r.id !== editingReport.id));
      setEditingReport(null);
      alert("¡Letra guardada y reporte cerrado!");
    } catch (error) {
      alert("Error: " + error.message);
    }
  };

  const deleteLyricsAndReport = async (songId, reportId) => {
    if (!window.confirm("¿Eliminar letra y reporte?")) return;
    await supabase.from('community_lyrics').delete().eq('song_id', songId);
    await supabase.from('lyric_reports').delete().eq('id', reportId);
    setReports(prev => prev.filter(r => r.id !== reportId));
    if (editingReport?.id === reportId) setEditingReport(null);
  };

  if (loading && reports.length === 0) return <div className="loading">Cargando moderación...</div>;

  return (
    <div className="admin-container">
      <header className="admin-header">
        <h1><AlertCircle color="#ff4444" size={32} /> Moderación Klang</h1>
      </header>

      <div className="admin-layout">
        <aside className="reports-list">
          {reports.length === 0 && <p className="placeholder">No hay reportes pendientes.</p>}
          {reports.map(report => (
            <div key={report.id} className={`report-card ${editingReport?.id === report.id ? 'active' : ''}`}>
              <span className="badge">{report.reason}</span>
              <div className="meta">
                <p><Music size={12}/> {report.song_id}</p>
                <p><User size={12}/> {new Date(report.created_at).toLocaleDateString()}</p>
              </div>
              <div className="actions">
                <button onClick={() => openEditor(report)} className="btn-edit"><Edit3 size={16}/> Revisar</button>
                <button onClick={() => deleteLyricsAndReport(report.song_id, report.id)} className="btn-del"><Trash2 size={16}/></button>
              </div>
            </div>
          ))}
        </aside>

        <main className="admin-editor">
          {editingReport ? (
            <div className="editor-content">
              <div className="editor-header-box">
                <div>
                  <h3>Editor LRC</h3>
                  <p>ID: <code>{editingReport.song_id}</code></p>
                </div>
                <button 
                  onClick={() => fetchAutoLyrics(editingReport.song_id)} 
                  disabled={isAutoLoading}
                  className="btn-auto"
                >
                  <Sparkles size={16} /> {isAutoLoading ? "Buscando..." : "Auto-completar letra"}
                </button>
              </div>

              <textarea 
                value={lyricInput}
                onChange={(e) => setLyricInput(e.target.value)}
                placeholder="[00:00.00] Primera línea..."
              />
              <div className="editor-footer">
                <button onClick={() => setEditingReport(null)} className="btn-cancel">Descartar</button>
                <button onClick={saveCorrection} className="btn-save"><Check size={18}/> Guardar Cambios</button>
              </div>
            </div>
          ) : (
            <div className="placeholder">Selecciona un reporte para editar</div>
          )}
        </main>
      </div>

      <style>{`
        .admin-container { padding: 40px; background: #000; min-height: 100vh; color: white; font-family: sans-serif; }
        .admin-layout { display: grid; grid-template-columns: 350px 1fr; gap: 20px; margin-top: 20px; }
        .report-card { background: #111; padding: 15px; border-radius: 10px; margin-bottom: 10px; border: 1px solid #222; transition: 0.2s; }
        .report-card:hover { border-color: #444; }
        .report-card.active { border-color: #3b82f6; background: #1a1a1a; }
        .badge { background: #ff444422; color: #ff4444; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: bold; }
        .meta { margin-top: 10px; color: #888; font-size: 13px; }
        .actions { display: flex; gap: 10px; margin-top: 10px; }
        .btn-edit { flex: 1; background: #3b82f6; border: none; color: white; padding: 8px; border-radius: 5px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px; }
        .btn-del { background: #222; border: none; color: #ff4444; padding: 8px; border-radius: 5px; cursor: pointer; }
        
        .editor-header-box { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px; }
        .btn-auto { background: #1db954; color: white; border: none; padding: 8px 16px; border-radius: 20px; font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: 0.3s; }
        .btn-auto:hover { background: #1ed760; transform: scale(1.02); }
        .btn-auto:disabled { background: #333; cursor: not-allowed; }

        textarea { width: 100%; height: 450px; background: #080808; color: #1db954; border: 1px solid #333; padding: 20px; font-family: 'Courier New', monospace; border-radius: 10px; line-height: 1.5; font-size: 14px; }
        textarea:focus { border-color: #1db954; outline: none; }
        
        .editor-footer { display: flex; justify-content: flex-end; gap: 15px; margin-top: 20px; }
        .btn-cancel { background: transparent; color: #888; border: none; cursor: pointer; }
        .btn-save { background: #fff; color: #000; border: none; padding: 10px 25px; border-radius: 30px; font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 8px; }
        .loading { height: 100vh; display: flex; align-items: center; justify-content: center; background: #000; color: #3b82f6; font-size: 20px; }
        .placeholder { display: flex; height: 100%; align-items: center; justify-content: center; color: #444; font-style: italic; }
      `}</style>
    </div>
  );
}