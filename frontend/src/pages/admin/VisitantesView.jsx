import React, { useState } from 'react';
import { UserCheck, QrCode } from 'lucide-react';
import api from '../../services/api';
import Pagination from '../../components/Pagination';
import { TabBtn, Modal, ModalHeader } from './adminHelpers';

export default function VisitantesView({ visitantes, conjuntos, showToast }) {
  const [visitantesPage, setVisitantesPage] = useState(1);
  const [visitantesPageSize, setVisitantesPageSize] = useState(10);
  const [visitantesConjuntoFilter, setVisitantesConjuntoFilter] = useState('todos');

  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedVisitante, setSelectedVisitante] = useState(null);
  const [qrData, setQrData] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);

  const visitantesFiltrados = (visitantes || []).filter(v => {
    if (visitantesConjuntoFilter === 'todos') return true;
    const cId = typeof v.conjunto === 'object' ? v.conjunto?._id : v.conjunto;
    return cId === visitantesConjuntoFilter;
  });
  const visitantesPaginados = visitantesFiltrados.slice(
    (visitantesPage - 1) * visitantesPageSize,
    visitantesPage * visitantesPageSize
  );

  const contar = (cId) => {
    if (cId === 'todos') return (visitantes || []).length;
    return (visitantes || []).filter(v => {
      const id = typeof v.conjunto === 'object' ? v.conjunto?._id : v.conjunto;
      return id === cId;
    }).length;
  };

  const handleVerQR = async (visitante) => {
    setSelectedVisitante(visitante);
    setShowQRModal(true);
    setQrLoading(true);
    setQrData(null);
    try {
      const res = await api.post(`/visitantes/qr/generar/${visitante._id || visitante.id}`, { horasValidez: 24 });
      setQrData(res.data?.qr || res.data);
    } catch (error) {
      showToast('Error al generar QR: ' + (error.response?.data?.error || error.message), 'error');
    } finally {
      setQrLoading(false);
    }
  };

  return (
    <>
      <div className="se-card se-fade-in" style={{ borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ height: 3, background: 'linear-gradient(90deg, #10B981, #0EA5E9)' }} />
        <div className="se-section-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <UserCheck size={18} style={{ color: '#10B981' }} />
          </div>
          <h2 className="se-heading" style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--se-text-primary)' }}>
            Control de Visitantes
          </h2>
        </div>

        <div style={{ padding: '1rem 1.25rem 0' }}>
          <div style={{ marginBottom: '1.25rem' }}>
            <p style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--se-text-muted)', marginBottom: 8 }}>
              Filtrar por conjunto
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <TabBtn active={visitantesConjuntoFilter === 'todos'} onClick={() => { setVisitantesConjuntoFilter('todos'); setVisitantesPage(1); }} count={contar('todos')} accentColor="#64748B">
                Todos
              </TabBtn>
              {conjuntos.map(c => (
                <TabBtn
                  key={c._id}
                  active={visitantesConjuntoFilter === c._id}
                  onClick={() => { setVisitantesConjuntoFilter(c._id); setVisitantesPage(1); }}
                  count={contar(c._id)}
                  accentColor="#10B981"
                >
                  {c.nombre}
                </TabBtn>
              ))}
            </div>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="w-full se-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Visitante</th>
                <th style={{ textAlign: 'left' }}>Cédula</th>
                <th style={{ textAlign: 'left' }}>Placa Vehículo</th>
                <th style={{ textAlign: 'left' }}>Autoriza</th>
                <th style={{ textAlign: 'left' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visitantesFiltrados.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '3rem', color: 'var(--se-text-muted)' }}>
                    No hay visitantes en este conjunto
                  </td>
                </tr>
              ) : visitantesPaginados.map((v, i) => (
                <tr key={v._id || i}>
                  <td style={{ fontWeight: 600, color: 'var(--se-text-primary)' }}>
                    {v.nombreVisitante || v.nombre} {v.apellidoVisitante || v.apellido}
                  </td>
                  <td className="hidden sm:table-cell" style={{ color: 'var(--se-text-secondary)' }}>{v.cedulaVisitante || v.cedula}</td>
                  <td>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.82rem', fontWeight: 700, color: 'var(--se-text-primary)', background: 'var(--se-bg)', padding: '2px 8px', borderRadius: 6, border: '1px solid var(--se-border)' }}>
                      {v.placaVisitante || v.placaVehiculo || 'N/A'}
                    </span>
                  </td>
                  <td className="hidden md:table-cell" style={{ color: 'var(--se-text-muted)', fontSize: '0.82rem' }}>
                    {v.usuarioId?.nombre || v.residenteId?.nombre || '—'}
                  </td>
                  <td>
                    <button
                      onClick={() => handleVerQR(v)}
                      className="se-btn-primary"
                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', borderRadius: 8, background: 'linear-gradient(135deg, #10B981, #0EA5E9)', boxShadow: '0 2px 8px rgba(16,185,129,0.25)' }}
                    >
                      <QrCode size={13} /> Ver QR
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '0.5rem 1.25rem 1rem' }}>
          <Pagination
            currentPage={visitantesPage}
            totalItems={visitantesFiltrados.length}
            pageSize={visitantesPageSize}
            onPageChange={setVisitantesPage}
            onPageSizeChange={(s) => { setVisitantesPageSize(s); setVisitantesPage(1); }}
          />
        </div>
      </div>

      {showQRModal && (
        <Modal onClose={() => { setShowQRModal(false); setQrData(null); setSelectedVisitante(null); }}>
          <ModalHeader
            icon={QrCode} iconBg="rgba(16,185,129,0.12)" iconColor="#10B981"
            title="Código QR de Visitante"
            onClose={() => { setShowQRModal(false); setQrData(null); setSelectedVisitante(null); }}
          />
          {selectedVisitante && (
            <div style={{ background: 'var(--se-bg)', border: '1px solid var(--se-border)', borderRadius: 12, padding: '0.875rem 1rem', marginBottom: '1.25rem' }}>
              <p style={{ fontWeight: 700, color: 'var(--se-text-primary)' }}>
                {selectedVisitante.nombreVisitante || selectedVisitante.nombre} {selectedVisitante.apellidoVisitante || selectedVisitante.apellido}
              </p>
              <p style={{ fontSize: '0.8rem', color: 'var(--se-text-muted)', marginTop: 3 }}>
                Cédula: {selectedVisitante.cedulaVisitante || selectedVisitante.cedula}
              </p>
            </div>
          )}
          {qrLoading ? (
            <div style={{ textAlign: 'center', padding: '2.5rem 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, border: '3px solid var(--se-border)', borderTopColor: '#10B981', borderRadius: '50%', animation: 'se-arc-spin 0.8s linear infinite' }} />
              <span style={{ color: 'var(--se-text-secondary)', fontSize: '0.85rem' }}>Generando código QR...</span>
            </div>
          ) : qrData ? (
            <div className="space-y-3">
              <div style={{ background: 'var(--se-bg)', border: '1px solid var(--se-border)', borderRadius: 12, padding: '0.875rem 1rem' }}>
                <p style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--se-text-muted)', marginBottom: 6 }}>Token de acceso:</p>
                <code style={{ fontSize: '0.72rem', wordBreak: 'break-all', color: 'var(--se-text-secondary)', background: '#fff', padding: '0.5rem', borderRadius: 8, border: '1px solid var(--se-border)', display: 'block' }}>
                  {qrData.token}
                </code>
              </div>
              <div style={{ background: 'var(--se-bg)', border: '1px solid var(--se-border)', borderRadius: 12, padding: '0.875rem 1rem' }}>
                <p style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--se-text-muted)', marginBottom: 6 }}>URL de verificación:</p>
                <code style={{ fontSize: '0.72rem', wordBreak: 'break-all', color: 'var(--se-accent)', background: '#fff', padding: '0.5rem', borderRadius: 8, border: '1px solid var(--se-border)', display: 'block' }}>
                  {qrData.url}
                </code>
              </div>
            </div>
          ) : (
            <p style={{ textAlign: 'center', color: 'var(--se-text-muted)', padding: '1.5rem 0' }}>No se pudo generar el código QR</p>
          )}
        </Modal>
      )}
    </>
  );
}
