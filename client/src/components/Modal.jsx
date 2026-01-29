import React from 'react';

export default function Modal({ title, description, inputValue, onChange, onConfirm, onCancel, confirmText = "Aceptar", isDanger = false }) {
    return (
        <div style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000,
            backdropFilter: 'blur(4px)'
        }}>
            <div style={{
                backgroundColor: '#282828', padding: '32px', borderRadius: '12px',
                width: '90%', maxWidth: '400px', boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                border: '1px solid rgba(255,255,255,0.1)'
            }}>
                <h2 style={{ margin: '0 0 8px 0', fontSize: '1.5rem', color: 'white' }}>{title}</h2>
                <p style={{ margin: '0 0 24px 0', color: '#a1a1aa', fontSize: '0.95rem' }}>{description}</p>
                
                {onChange && (
                    <input 
                        autoFocus
                        value={inputValue}
                        onChange={(e) => onChange(e.target.value)}
                        style={{
                            width: '100%', padding: '12px', backgroundColor: '#3e3e3e',
                            border: '1px solid transparent', borderRadius: '6px',
                            color: 'white', marginBottom: '24px', outline: 'none'
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && onConfirm()}
                    />
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <button onClick={onCancel} style={{
                        background: 'none', border: 'none', color: 'white',
                        padding: '10px 20px', cursor: 'pointer', fontWeight: 'bold'
                    }}>Cancelar</button>
                    <button 
                        onClick={onConfirm}
                        style={{
                            backgroundColor: isDanger ? '#ef4444' : '#3b82f6',
                            color: 'white', border: 'none', padding: '10px 24px',
                            borderRadius: '500px', cursor: 'pointer', fontWeight: 'bold'
                        }}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}