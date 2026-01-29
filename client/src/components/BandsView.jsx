import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { usePlayer } from '../context/PlayerContext';
import { 
  Plus, Users, ArrowLeft, Music, Radio, Loader2, 
  UserPlus, Copy, Check, Trash2, LogOut 
} from 'lucide-react';

const BandsView = () => {
  const { 
    user, 
    currentBandeTracks, 
    loadBandeTracks, 
    subscribeToBande, 
    setQueueAndPlay 
  } = usePlayer();

  const [bands, setBands] = useState([]);
  const [selectedBand, setSelectedBand] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [newBandName, setNewBandName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedBand) {
      loadBandeTracks(selectedBand.id);
      const unsubscribe = subscribeToBande(selectedBand.id);
      return () => { if (unsubscribe) unsubscribe(); };
    }
  }, [selectedBand]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { data: membershipData, error: memError } = await supabase
        .from('band_members')
        .select('band_id')
        .eq('user_id', session.user.id);

      if (membershipData?.length > 0) {
        const bandIds = membershipData.map(m => m.band_id);
        const { data: bandsData } = await supabase
          .from('bands')
          .select('*')
          .in('id', bandIds);
        setBands(bandsData || []);
      }
    } catch (err) {
      console.error("Error cargando bandas:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBand = async (e) => {
    e.preventDefault();
    if (!newBandName.trim()) return;

    try {
      const { data: newBand, error: bErr } = await supabase
        .from('bands')
        .insert([{ 
          name: newBandName.trim(), 
          creator_id: user.id 
        }])
        .select().single();

      if (bErr) throw bErr;

      await supabase.from('band_members').insert([
        { band_id: newBand.id, user_id: user.id, role: 'admin' }
      ]);

      setBands([...bands, newBand]);
      setShowCreateModal(false);
      setNewBandName('');
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  const handleJoinBand = async (e) => {
    e.preventDefault();
    try {
      // En un sistema real, buscaríamos el ID de la banda por un código corto.
      // Aquí usaremos el ID directo de la banda como "código" por ahora.
      const { data: bandToJoin, error: bErr } = await supabase
        .from('bands')
        .select('*')
        .eq('id', joinCode.trim())
        .single();

      if (bErr || !bandToJoin) throw new Error("Código no válido");

      await supabase.from('band_members').insert([
        { band_id: bandToJoin.id, user_id: user.id, role: 'member' }
      ]);

      setBands([...bands, bandToJoin]);
      setShowJoinModal(false);
      setJoinCode('');
    } catch (err) {
      alert(err.message);
    }
  };

  const copyInviteCode = () => {
    navigator.clipboard.writeText(selectedBand.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return (
    <div style={styles.loaderContainer}>
      <Loader2 className="spin" size={40} color="var(--accent)" />
    </div>
  );

  return (
    <div style={styles.container}>
      {selectedBand ? (
        // --- VISTA BÚNKER (DENTRO DE UNA BAND) ---
        <div className="fade-in">
          <button onClick={() => setSelectedBand(null)} style={styles.backBtn}>
            <ArrowLeft size={18}/> Volver a mis grupos
          </button>
          
          <div style={styles.bunkerHeader}>
            <h1 style={styles.title}>{selectedBand.name}</h1>
            <div style={styles.inviteBadge} onClick={copyInviteCode}>
              <UserPlus size={14} />
              <span>{copied ? '¡Copiado!' : 'Invitar amigo'}</span>
            </div>
          </div>

          <div style={styles.bunkerGrid}>
            {/* PANEL IZQUIERDO: PLAYLIST COLABORATIVA */}
            <div style={styles.panel}>
              <div style={styles.panelHeader}>
                <Music size={20} color="var(--accent)" />
                <h2 style={styles.panelTitle}>Playlist Compartida</h2>
              </div>
              
              <div style={styles.trackList}>
                {(!currentBandeTracks || currentBandeTracks.length === 0) ? (
                  <div style={styles.emptyState}>La playlist está vacía. Añade temas desde el buscador.</div>
                ) : (
                  currentBandeTracks.map((track, index) => (
                    <div 
                      key={track?.id || index} 
                      onClick={() => setQueueAndPlay(currentBandeTracks, index)}
                      style={styles.trackRow}
                    >
                      <img src={track?.thumbnail} style={styles.trackThumb} alt="" />
                      <div style={{ flex: 1 }}>
                        <div style={styles.trackName}>{track?.title}</div>
                        <div style={styles.trackArtist}>{track?.artist}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* PANEL DERECHO: KREISE & MIEMBROS */}
            <div style={styles.panel}>
              <div style={styles.panelHeader}>
                <Radio size={20} color="#ff4444" />
                <h2 style={styles.panelTitle}>Kreise Activos</h2>
              </div>
              <div style={styles.emptyState}>No hay Jams en directo ahora mismo.</div>
              
              <div style={{...styles.panelHeader, marginTop: '30px'}}>
                <Users size={20} color="#0078ff" />
                <h2 style={styles.panelTitle}>Miembros</h2>
              </div>
              <p style={{fontSize: '0.8rem', color: '#666'}}>ID de Invitación: 
                <code style={styles.codeBlock}>{selectedBand.id.slice(0,8)}...</code>
              </p>
            </div>
          </div>
        </div>
      ) : (
        // --- VISTA LISTA DE BANDES ---
        <div className="fade-in">
          <header style={styles.header}>
            <div>
              <h1 style={styles.title}>Bandes</h1>
              <p style={{color: '#666', marginTop: '5px'}}>Tus comunidades musicales.</p>
            </div>
            <div style={{display: 'flex', gap: '10px'}}>
               <button onClick={() => setShowJoinModal(true)} style={styles.joinBtn}>Unirse</button>
               <button onClick={() => setShowCreateModal(true)} style={styles.createBtn}>+ Fundar Band</button>
            </div>
          </header>

          <div style={styles.grid}>
            {bands.length === 0 ? (
              <div style={styles.emptyBig}>
                <Users size={48} color="#222" />
                <p>Aún no perteneces a ninguna Bande.</p>
              </div>
            ) : (
              bands.map(band => (
                <div key={band.id} onClick={() => setSelectedBand(band)} style={styles.card}>
                  <div style={styles.icon}>{band.name[0].toUpperCase()}</div>
                  <h3 style={{margin: 0}}>{band.name}</h3>
                  <div style={styles.cardFooter}>
                    <Users size={12} /> Miembros activos
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* MODAL CREAR */}
      {showCreateModal && (
        <div style={styles.overlay}>
          <form onSubmit={handleCreateBand} style={styles.modal}>
            <h3 style={{marginTop: 0}}>Fundar nueva Bande</h3>
            <input 
              style={styles.input} 
              value={newBandName} 
              onChange={e => setNewBandName(e.target.value)} 
              placeholder="Nombre del grupo..."
              autoFocus
            />
            <div style={styles.modalBtns}>
              <button type="button" onClick={() => setShowCreateModal(false)} style={styles.btnSec}>Cancelar</button>
              <button type="submit" style={styles.btnPri}>Fundar</button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL UNIRSE */}
      {showJoinModal && (
        <div style={styles.overlay}>
          <form onSubmit={handleJoinBand} style={styles.modal}>
            <h3 style={{marginTop: 0}}>Unirse a una Bande</h3>
            <p style={{fontSize: '0.8rem', color: '#666'}}>Pega el código que te pasó tu amigo.</p>
            <input 
              style={styles.input} 
              value={joinCode} 
              onChange={e => setJoinCode(e.target.value)} 
              placeholder="Código o ID..."
              autoFocus
            />
            <div style={styles.modalBtns}>
              <button type="button" onClick={() => setShowJoinModal(false)} style={styles.btnSec}>Cancelar</button>
              <button type="submit" style={styles.btnPri}>Entrar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: { padding: '40px', maxWidth: '1100px', margin: '0 auto', color: 'white' },
  loaderContainer: { display: 'flex', justifyContent: 'center', paddingTop: '100px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' },
  title: { fontSize: '2.5rem', fontWeight: '900', margin: 0, letterSpacing: '-1px' },
  createBtn: { background: 'white', border: 'none', padding: '12px 24px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', color: 'black' },
  joinBtn: { background: 'transparent', border: '1px solid #333', color: 'white', padding: '12px 24px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '20px' },
  card: { background: '#0a0a0a', padding: '30px', borderRadius: '24px', border: '1px solid #1a1a1a', cursor: 'pointer', transition: '0.3s' },
  cardFooter: { display: 'flex', alignItems: 'center', gap: '5px', marginTop: '15px', fontSize: '0.7rem', color: '#444' },
  icon: { width: '45px', height: '45px', background: 'linear-gradient(135deg, #0078ff, #00c6ff)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', marginBottom: '20px' },
  bunkerHeader: { display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '30px' },
  inviteBadge: { background: 'rgba(255,255,255,0.05)', padding: '6px 14px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)' },
  bunkerGrid: { display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '25px' },
  panel: { background: 'rgba(10, 10, 10, 0.5)', backdropFilter: 'blur(10px)', border: '1px solid #1a1a1a', padding: '25px', borderRadius: '28px', minHeight: '400px' },
  panelHeader: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' },
  panelTitle: { fontSize: '1.1rem', margin: 0, fontWeight: '700' },
  trackList: { display: 'flex', flexDirection: 'column', gap: '8px' },
  trackRow: { display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', borderRadius: '14px', cursor: 'pointer', hover: {background: '#111'} },
  trackThumb: { width: '44px', height: '44px', borderRadius: '8px', objectFit: 'cover' },
  trackName: { fontSize: '0.9rem', fontWeight: '600' },
  trackArtist: { fontSize: '0.75rem', color: '#555' },
  emptyState: { color: '#333', textAlign: 'center', paddingTop: '40px', fontSize: '0.9rem' },
  emptyBig: { gridColumn: '1/-1', textAlign: 'center', padding: '100px', color: '#222' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(5px)' },
  modal: { background: '#0a0a0a', padding: '30px', borderRadius: '30px', width: '340px', border: '1px solid #222' },
  input: { width: '100%', padding: '15px', background: '#000', border: '1px solid #333', color: 'white', borderRadius: '15px', marginTop: '15px', outline: 'none' },
  modalBtns: { display: 'flex', gap: '10px', marginTop: '25px' },
  btnPri: { flex: 1, padding: '12px', background: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', color: 'black' },
  btnSec: { flex: 1, padding: '12px', background: '#1a1a1a', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer' },
  backBtn: { background: 'none', border: 'none', color: '#444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '15px', fontSize: '0.9rem' },
  codeBlock: { background: '#000', padding: '2px 6px', borderRadius: '4px', marginLeft: '5px', color: 'var(--accent)' }
};

export default BandsView;