import React, { useState } from 'react';
import { Building, Plus } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { Modal, ModalHeader, labelStyle } from './adminHelpers';

export default function ConjuntosView({ conjuntos, showToast }) {
  const queryClient = useQueryClient();
  const [showConjuntoModal, setShowConjuntoModal] = useState(false);
  const [conjuntoData, setConjuntoData] = useState({ estado: 'activo' });

  const handleCrearConjunto = async (e) => {
    e.preventDefault();
    try {
      await api.post('/conjuntos', conjuntoData);
      showToast('Conjunto creado correctamente', 'success');
      setShowConjuntoModal(false);
      setConjuntoData({ estado: 'activo' });
      queryClient.invalidateQueries({ queryKey: ['conjuntos'] });
    } catch (error) {
      showToast('Error al crear conjunto.', 'error');
    }
  };

  return (
    <>
      <div className="se-card se-fade-in" style={{ borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ height: 3, background: 'linear-gradient(90deg, #8B5CF6, #6366F1)' }} />
        <div className="se-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(139,92,246,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Building size={18} style={{ color: '#8B5CF6' }} />
            </div>
            <h2 className="se-heading" style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--se-text-primary)' }}>
              Gestión de Conjuntos
            </h2>
          </div>
          <button
            onClick={() => setShowConjuntoModal(true)}
            className="se-btn-primary"
            style={{ borderRadius: 10, background: 'linear-gradient(135deg, #8B5CF6, #6366F1)', boxShadow: '0 4px 14px rgba(99,102,241,0.35)' }}
          >
            <Plus size={16} /> Nuevo Conjunto
          </button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="w-full se-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Nombre</th>
                <th className="hidden sm:table-cell" style={{ textAlign: 'left' }}>NIT</th>
                <th className="hidden md:table-cell" style={{ textAlign: 'left' }}>Ciudad</th>
                <th style={{ textAlign: 'left' }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {conjuntos.map((c, i) => (
                <tr key={c._id || i}>
                  <td style={{ fontWeight: 700, color: 'var(--se-text-primary)' }}>{c.nombre}</td>
                  <td className="hidden sm:table-cell" style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--se-text-secondary)' }}>{c.nit || 'S/N'}</td>
                  <td className="hidden md:table-cell" style={{ color: 'var(--se-text-secondary)' }}>{c.ciudad || '—'}</td>
                  <td>
                    <span className="se-badge" style={
                      c.estado === 'activo'
                        ? { background: 'rgba(16,185,129,0.10)', color: '#065F46' }
                        : { background: 'var(--se-error-dim)', color: 'var(--se-error)' }
                    }>
                      {c.estado ? c.estado.toUpperCase() : 'ACTIVO'}
                    </span>
                  </td>
                </tr>
              ))}
              {conjuntos.length === 0 && (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '3rem', color: 'var(--se-text-muted)' }}>
                    No hay conjuntos registrados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showConjuntoModal && (
        <Modal onClose={() => setShowConjuntoModal(false)} accentColor="#8B5CF6">
          <ModalHeader
            icon={Building} iconBg="rgba(139,92,246,0.12)" iconColor="#8B5CF6"
            title="Nuevo Conjunto"
            onClose={() => setShowConjuntoModal(false)}
          />
          <form onSubmit={handleCrearConjunto} className="grid grid-cols-2 gap-4">
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Nombre del Conjunto *</label>
              <input
                required className="se-input"
                onChange={e => setConjuntoData({ ...conjuntoData, nombre: e.target.value })}
                placeholder="Ej: Torres del Parque"
              />
            </div>
            <div>
              <label style={labelStyle}>NIT</label>
              <input
                className="se-input"
                onChange={e => setConjuntoData({ ...conjuntoData, nit: e.target.value })}
                placeholder="900123456-1"
              />
            </div>
            <div>
              <label style={labelStyle}>Estado</label>
              <select
                className="se-input"
                value={conjuntoData.estado}
                onChange={e => setConjuntoData({ ...conjuntoData, estado: e.target.value })}
              >
                <option value="activo">Activo</option>
                <option value="suspendido">Suspendido</option>
                <option value="inactivo">Inactivo</option>
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Dirección</label>
              <input
                className="se-input"
                onChange={e => setConjuntoData({ ...conjuntoData, direccion: e.target.value })}
                placeholder="Calle 100 #15-25"
              />
            </div>
            <button
              type="submit"
              className="se-btn-primary"
              style={{ gridColumn: '1 / -1', justifyContent: 'center', borderRadius: 12, background: 'linear-gradient(135deg, #8B5CF6, #6366F1)', boxShadow: '0 4px 14px rgba(99,102,241,0.3)' }}
            >
              Guardar Conjunto
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
