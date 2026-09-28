'use client';

import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { TicketEditFormProps } from '../types/grid';

export function TicketEditForm({ publicacion, onSave, onCancel }: TicketEditFormProps) {
  const [editTitulo, setEditTitulo] = useState(publicacion.titulo);
  const [editFecha, setEditFecha] = useState(publicacion.fecha_publicacion);
  const [editError, setEditError] = useState<string | null>(null);

  const handleSave = () => {
    if (!editTitulo.trim() || !editFecha) {
      setEditError('Título y fecha son requeridos.');
      return;
    }
    onSave(editTitulo.trim(), editFecha);
  };

  return (
    <div className="space-y-2 mb-2">
      <input
        type="text"
        value={editTitulo}
        onChange={(e) => setEditTitulo(e.target.value)}
        aria-label="Título de la publicación"
        className="ui-control w-full text-sm font-semibold px-2.5 py-1.5 focus:outline-none ui-focus-ring"
        style={{ borderColor: 'var(--azul)', color: 'var(--tinta)' }}
        autoFocus
      />
      <input
        type="date"
        value={editFecha}
        onChange={(e) => setEditFecha(e.target.value)}
        aria-label="Fecha de publicación"
        className="ui-control w-full text-xs px-2.5 py-1.5 focus:outline-none ui-focus-ring"
        style={{ borderColor: 'var(--azul)', color: 'var(--tinta)' }}
      />
      {editError && (
        <p role="alert" className="text-[11px]" style={{ color: '#A32D2D' }}>{editError}</p>
      )}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={handleSave}
          aria-label="Guardar cambios"
          className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg focus:outline-none ui-focus-ring"
          style={{ background: 'var(--verde)', color: '#fff' }}
        >
          <Check size={13} aria-hidden="true" />
          Guardar
        </button>
        <button
          onClick={onCancel}
          aria-label="Cancelar edición"
          className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg focus:outline-none ui-focus-ring"
          style={{ background: 'var(--hueso)', color: 'var(--gris)' }}
        >
          <X size={13} aria-hidden="true" />
          Cancelar
        </button>
      </div>
    </div>
  );
}
