import React, { useState } from 'react';
import { Users, Edit2, UserPlus } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import Pagination from '../../components/Pagination';
import { TabBtn, Modal, ModalHeader, labelStyle } from './adminHelpers';

export default function UsuariosView({ usuarios, conjuntos, isSuperAdmin, showToast, openConfirm, closeConfirm }) {
  const queryClient = useQueryClient();

  const [usuariosPage, setUsuariosPage] = useState(1);
  const [usuariosPageSize, setUsuariosPageSize] = useState(10);
  const [usuariosConjuntoFilter, setUsuariosConjuntoFilter] = useState('todos');

  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({});
  const [editMode, setEditMode] = useState(false);
  const [editUserId, setEditUserId] = useState(null);

  const usuariosBase = (usuarios || []).filter(u => u.rol !== 'superadmin');
  const usuariosFiltrados = usuariosBase.filter(u => {
    if (usuariosConjuntoFilter === 'todos') return true;
    const cId = typeof u.conjunto === 'object' ? u.conjunto?._id : u.conjunto;
    return cId === usuariosConjuntoFilter;
  });
  const usuariosPaginados = usuariosFiltrados.slice(
    (usuariosPage - 1) * usuariosPageSize,
    usuariosPage * usuariosPageSize
  );

  const contarPorConjunto = (cId) => {
    if (cId === 'todos') return usuariosBase.length;
    return usuariosBase.filter(u => {
      const id = typeof u.conjunto === 'object' ? u.conjunto?._id : u.conjunto;
      return id === cId;
    }).length;
  };

  const rolBadge = (rol) => {
    const map = {
      admin:    { bg: 'rgba(139,92,246,0.12)', color: '#7C3AED' },
      porteria: { bg: 'rgba(245,158,11,0.12)',  color: '#B45309' },
      residente:{ bg: 'var(--se-accent-dim)',   color: '#0369A1' },
    };
    return map[rol?.toLowerCase()] || { bg: '#F1F5F9', color: 'var(--se-text-secondary)' };
  };

  const handleCrearUsuario = async (e) => {
    e.preventDefault();
    try {
      if (formData.rol === 'ADMIN') formData.rol = 'admin';
      if (formData.rol === 'PORTERO') formData.rol = 'porteria';
      if (formData.rol === 'RESIDENTE') formData.rol = 'residente';
      if (editMode && editUserId) {
        await api.put(`/usuarios/${editUserId}`, formData);
        showToast('Usuario actualizado correctamente', 'success');
      } else {
        await api.post('/usuarios/crear', formData);
        showToast('Usuario creado correctamente', 'success');
      }
      setShowModal(false);
      setEditMode(false);
      setEditUserId(null);
      setFormData({});
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
    } catch (error) {
      showToast('Error al guardar usuario: ' + (error.response?.data?.details?.[0]?.msg || error.response?.data?.error || error.message), 'error');
    }
  };

  const handleEditarUsuario = (usuario) => {
    setEditMode(true);
    setEditUserId(usuario._id || usuario.id);
    setFormData({
      nombre: usuario.nombre || '',
      apellido: usuario.apellido || '',
      cedula: usuario.cedula || '',
      rol: usuario.rol?.toUpperCase() || 'RESIDENTE',
      torre: usuario.torre || '',
      apartamento: usuario.apartamento || '',
      telefono: usuario.telefono || '',
      email: usuario.email || '',
    });
    setShowModal(true);
  };

  const handleEliminarUsuario = (usuario) => {
    openConfirm(
      'Eliminar usuario',
      `¿Estás seguro de eliminar al usuario ${usuario.nombre} ${usuario.apellido}? Esta acción no se puede deshacer.`,
      async () => {
        closeConfirm();
        try {
          await api.delete(`/usuarios/${usuario._id || usuario.id}`);
          showToast('Usuario eliminado correctamente', 'success');
          queryClient.invalidateQueries({ queryKey: ['usuarios'] });
        } catch (error) {
          showToast('Error al eliminar usuario: ' + (error.response?.data?.error || error.message), 'error');
        }
      },
      'danger'
    );
  };

  return (
    <>
      <div className="se-card se-fade-in" style={{ borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ height: 3, background: 'linear-gradient(90deg, #0EA5E9, #6366F1)' }} />
        <div className="se-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--se-accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={18} style={{ color: 'var(--se-accent)' }} />
            </div>
            <h2 className="se-heading" style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--se-text-primary)' }}>
              Residentes y Personal
            </h2>
          </div>
          <button
            onClick={() => { setEditMode(false); setEditUserId(null); setFormData({}); setShowModal(true); }}
            className="se-btn-primary"
            style={{ borderRadius: 10 }}
          >
            <UserPlus size={16} /> Agregar Usuario
          </button>
        </div>

        <div style={{ padding: '1rem 1.25rem 0' }}>
          <div style={{ marginBottom: '1.25rem' }}>
            <p style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--se-text-muted)', marginBottom: 8 }}>
              Filtrar por conjunto
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <TabBtn active={usuariosConjuntoFilter === 'todos'} onClick={() => { setUsuariosConjuntoFilter('todos'); setUsuariosPage(1); }} count={contarPorConjunto('todos')} accentColor="#64748B">
                Todos
              </TabBtn>
              {conjuntos.map(c => (
                <TabBtn
                  key={c._id}
                  active={usuariosConjuntoFilter === c._id}
                  onClick={() => { setUsuariosConjuntoFilter(c._id); setUsuariosPage(1); }}
                  count={contarPorConjunto(c._id)}
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
                <th style={{ textAlign: 'left' }}>Nombre</th>
                <th className="hidden sm:table-cell" style={{ textAlign: 'left' }}>Documento</th>
                <th style={{ textAlign: 'left' }}>Rol</th>
                <th className="hidden md:table-cell" style={{ textAlign: 'left' }}>Ubicación</th>
                <th style={{ textAlign: 'left' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuariosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '3rem', color: 'var(--se-text-muted)' }}>
                    No hay usuarios en este conjunto.
                  </td>
                </tr>
              ) : usuariosPaginados.map((u, i) => {
                const badge = rolBadge(u.rol);
                return (
                  <tr key={u._id || i}>
                    <td style={{ fontWeight: 600, color: 'var(--se-text-primary)' }}>{u.nombre} {u.apellido}</td>
                    <td className="hidden sm:table-cell" style={{ color: 'var(--se-text-secondary)', fontFamily: 'monospace', fontSize: '0.82rem' }}>{u.cedula}</td>
                    <td>
                      <span className="se-badge" style={{ background: badge.bg, color: badge.color }}>
                        {u.rol}
                      </span>
                    </td>
                    <td className="hidden md:table-cell" style={{ color: 'var(--se-text-muted)', fontSize: '0.82rem' }}>
                      T{u.torre || '—'} / Apto {u.apartamento || '—'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => handleEditarUsuario(u)}
                          title="Editar"
                          style={{
                            width: 32, height: 32, borderRadius: 8,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: 'var(--se-bg)', border: '1px solid var(--se-border)',
                            color: 'var(--se-text-secondary)',
                            cursor: 'pointer', transition: 'all 0.15s',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--se-accent-dim)'; e.currentTarget.style.color = 'var(--se-accent)'; e.currentTarget.style.borderColor = 'rgba(14,165,233,0.3)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'var(--se-bg)'; e.currentTarget.style.color = 'var(--se-text-secondary)'; e.currentTarget.style.borderColor = 'var(--se-border)'; }}
                        >
                          <Edit2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '0.5rem 1.25rem 1rem' }}>
          <Pagination
            currentPage={usuariosPage}
            totalItems={usuariosFiltrados.length}
            pageSize={usuariosPageSize}
            onPageChange={setUsuariosPage}
            onPageSizeChange={(s) => { setUsuariosPageSize(s); setUsuariosPage(1); }}
          />
        </div>
      </div>

      {showModal && (
        <Modal
          onClose={() => { setShowModal(false); setEditMode(false); setEditUserId(null); }}
          accentColor="var(--se-accent)"
        >
          <ModalHeader
            icon={UserPlus}
            iconBg="var(--se-accent-dim)"
            iconColor="var(--se-accent)"
            title={editMode ? 'Editar Usuario' : 'Registrar Usuario'}
            onClose={() => { setShowModal(false); setEditMode(false); setEditUserId(null); }}
          />
          <form onSubmit={handleCrearUsuario} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label style={labelStyle}>Nombre</label>
                <input required value={formData.nombre || ''} className="se-input" onChange={e => setFormData({ ...formData, nombre: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Apellido</label>
                <input required value={formData.apellido || ''} className="se-input" onChange={e => setFormData({ ...formData, apellido: e.target.value })} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Cédula</label>
              <input required value={formData.cedula || ''} className="se-input" onChange={e => setFormData({ ...formData, cedula: e.target.value })} />
            </div>
            {!editMode && (
              <div>
                <label style={labelStyle}>Contraseña</label>
                <input required type="password" className="se-input" onChange={e => setFormData({ ...formData, password: e.target.value })} />
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label style={labelStyle}>Torre</label>
                <input value={formData.torre || ''} className="se-input" onChange={e => setFormData({ ...formData, torre: e.target.value })} placeholder="Ej: 1" />
              </div>
              <div>
                <label style={labelStyle}>Apartamento</label>
                <input value={formData.apartamento || ''} className="se-input" onChange={e => setFormData({ ...formData, apartamento: e.target.value })} placeholder="Ej: 101" />
              </div>
            </div>
            {isSuperAdmin && (
              <div>
                <label style={labelStyle}>Conjunto Residencial</label>
                <select
                  className="se-input"
                  value={formData.conjuntoId || ''}
                  onChange={e => setFormData({ ...formData, conjuntoId: e.target.value })}
                >
                  <option value="">Selecciona el conjunto</option>
                  {conjuntos && conjuntos.map(c => (
                    <option key={c._id || c.id} value={c._id || c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label style={labelStyle}>Rol</label>
              <select required value={formData.rol || ''} className="se-input" onChange={e => setFormData({ ...formData, rol: e.target.value })}>
                <option value="">Seleccione Rol</option>
                <option value="admin">Administrador</option>
                <option value="porteria">Portero</option>
                <option value="residente">Residente</option>
              </select>
            </div>
            <button type="submit" className="se-btn-primary" style={{ width: '100%', justifyContent: 'center', borderRadius: 12 }}>
              {editMode ? 'Actualizar Usuario' : 'Guardar Usuario'}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
