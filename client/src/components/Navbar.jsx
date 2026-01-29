import React, { useState } from 'react';
import { usePlayer } from '../context/PlayerContext';

function Navbar({ setView }) {
  const { searchQuery, setSearchQuery, searchFilter, setSearchFilter } = usePlayer();

  const categories = [
    { id: 'songs', label: 'Canciones' },
    { id: 'albums', label: 'Álbumes' },
    { id: 'artists', label: 'Artistas' }
  ];

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: '15px',
      padding: '15px 30px', background: 'rgba(0,0,0,0.5)',
      backdropFilter: 'blur(10px)', position: 'sticky', top: 0, zIndex: 10,
      borderBottom: '1px solid #1f1f1f'
    }}>
      {/* Input de Búsqueda */}
      <div style={{ position: 'relative', width: '100%', maxWidth: '500px', margin: '0 auto' }}>
        <input 
          type="text" placeholder="¿Qué quieres escuchar hoy?" 
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (e.target.value) setView('search');
          }}
          style={{
            width: '100%', padding: '10px 45px', borderRadius: '25px',
            border: '1px solid #333', background: '#121212', color: '#fff', outline: 'none'
          }}
        />
        <span style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)' }}>🔍</span>
      </div>

      {/* Chips de Categoría */}
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setSearchFilter(cat.id)}
            style={{
              padding: '6px 16px', borderRadius: '20px', border: 'none',
              cursor: 'pointer', fontSize: '0.85rem', fontWeight: '500',
              transition: '0.3s',
              background: searchFilter === cat.id ? '#fff' : '#222',
              color: searchFilter === cat.id ? '#000' : '#fff'
            }}
          >
            {cat.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default Navbar;