import React, { useEffect, useRef } from 'react';

export default function DropdownMenu({ x, y, onClose, options }) {
    const menuRef = useRef(null);

    // Cerrar al hacer clic fuera
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    return (
        <div 
            ref={menuRef}
            style={{
                position: 'fixed',
                top: y,
                left: x,
                transform: 'translateX(-100%)', // Aparece a la izquierda del clic
                backgroundColor: '#282828',
                minWidth: '180px',
                borderRadius: '4px',
                padding: '5px',
                boxShadow: '0 8px 16px rgba(0,0,0,0.5)',
                zIndex: 9999,
                border: '1px solid rgba(255,255,255,0.1)'
            }}
        >
            {options.map((opt, i) => (
                <button
                    key={i}
                    onClick={() => { opt.onClick(); onClose(); }}
                    style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '12px 15px',
                        background: 'none',
                        border: 'none',
                        color: opt.variant === 'danger' ? '#ff4444' : 'white',
                        fontSize: '0.9rem',
                        cursor: 'pointer',
                        borderRadius: '2px',
                        transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.1)'}
                    onMouseLeave={(e) => e.target.style.background = 'none'}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    );
}