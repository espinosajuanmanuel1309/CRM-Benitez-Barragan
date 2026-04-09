'use client'

import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import { useAdmin } from '../../lib/useAdmin'
import Sidebar from '../../lib/Navbar'

export default function ClientesPage() {
  const [clientes, setClientes] = useState([])
  const [honorarios, setHonorarios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [mostrarFormNuevo, setMostrarFormNuevo] = useState(false)
  const [clienteEditando, setClienteEditando] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState('activos')
  const [formNuevo, setFormNuevo] = useState({ nombre: '' })
  const [honorariosSeleccionados, setHonorariosSeleccionados] = useState({})
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const router = useRouter()
  const { verificando } = useAdmin()

  useEffect(() => { cargarDatos() }, [])

  const cargarDatos = async () => {
    const [{ data: clientesData }, { data: honorariosData }] = await Promise.all([
      supabase.from('clientes').select('*').order('nombre'),
      supabase.from('honorarios').select('*').eq('activo', true).order('nombre')
    ])
    setClientes(clientesData || [])
    setHonorarios(honorariosData || [])
    setCargando(false)
  }

  const cargarPresupuestosCliente = async (clienteId) => {
    const { data } = await supabase.from('presupuestos').select('*').eq('cliente_id', clienteId).eq('anio', new Date().getFullYear())
    const mapa = {}
    data?.forEach(p => { mapa[p.honorario_id] = p.horas_mes })
    return mapa
  }

  const handleEditarCliente = async (cliente) => {
    if (clienteEditando?.id === cliente.id) { setClienteEditando(null); return }
    const mapa = await cargarPresupuestosCliente(cliente.id)
    setHonorariosSeleccionados(mapa)
    setClienteEditando(cliente)
  }

  const handleToggleHonorario = (honorarioId) => {
    setHonorariosSeleccionados(prev => {
      const nuevo = { ...prev }
      if (nuevo[honorarioId] !== undefined) delete nuevo[honorarioId]
      else nuevo[honorarioId] = 0
      return nuevo
    })
  }

  const handleHorasChange = (honorarioId, horas) => {
    setHonorariosSeleccionados(prev => ({ ...prev, [honorarioId]: parseFloat(horas) || 0 }))
  }

  const handleGuardarEdicion = async () => {
    setGuardando(true)
    await supabase.from('clientes').update({ nombre: clienteEditando.nombre }).eq('id', clienteEditando.id)
    const anioActual = new Date().getFullYear()
    await supabase.from('presupuestos').delete().eq('cliente_id', clienteEditando.id).eq('anio', anioActual)
    const presupuestosNuevos = Object.entries(honorariosSeleccionados).map(([honorarioId, horas]) => ({
      cliente_id: clienteEditando.id, honorario_id: parseInt(honorarioId), horas_mes: horas, anio: anioActual
    }))
    if (presupuestosNuevos.length > 0) await supabase.from('presupuestos').insert(presupuestosNuevos)
    setMensaje('✅ Cliente actualizado')
    setClienteEditando(null)
    cargarDatos()
    setGuardando(false)
  }

  const handleGuardarNuevo = async (e) => {
    e.preventDefault()
    setGuardando(true)
    const { data, error } = await supabase.from('clientes').insert({ nombre: formNuevo.nombre, activo: true }).select().single()
    if (error) { setMensaje('❌ Error al agregar cliente'); setGuardando(false); return }
    const presupuestosNuevos = Object.entries(honorariosSeleccionados).map(([honorarioId, horas]) => ({
      cliente_id: data.id, honorario_id: parseInt(honorarioId), horas_mes: horas, anio: new Date().getFullYear()
    }))
    if (presupuestosNuevos.length > 0) await supabase.from('presupuestos').insert(presupuestosNuevos)
    setMensaje('✅ Cliente agregado correctamente')
    setFormNuevo({ nombre: '' })
    setHonorariosSeleccionados({})
    setMostrarFormNuevo(false)
    cargarDatos()
    setGuardando(false)
  }

  const handleToggleActivo = async (cliente) => {
    await supabase.from('clientes').update({ activo: !cliente.activo }).eq('id', cliente.id)
    cargarDatos()
  }

  const clientesFiltrados = clientes
    .filter(c => filtro === 'todos' ? true : filtro === 'activos' ? c.activo : !c.activo)
    .filter(c => c.nombre.toLowerCase().includes(busqueda.toLowerCase()))

  const inputStyle = { width: '100%', border: '1px solid #d1d5db', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', backgroundColor: 'white', color: '#1f2937', boxSizing: 'border-box' }

  const FormHonorarios = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
      {honorarios.map(h => (
        <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', backgroundColor: '#f9fafb' }}>
          <input type="checkbox" checked={honorariosSeleccionados[h.id] !== undefined} onChange={() => handleToggleHonorario(h.id)} style={{ width: '16px', height: '16px', accentColor: '#1B2A4A' }} />
          <span style={{ fontSize: '13px', color: '#374151', flex: 1 }}>{h.nombre}</span>
          {honorariosSeleccionados[h.id] !== undefined && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="number"
                value={honorariosSeleccionados[h.id]}
                onChange={e => handleHorasChange(h.id, e.target.value)}
                min="0" step="0.5"
                style={{ width: '72px', border: '1px solid #d1d5db', borderRadius: '6px', padding: '4px 8px', fontSize: '13px', backgroundColor: 'white', color: '#1f2937' }}
              />
              <span style={{ fontSize: '11px', color: '#6b7280' }}>hrs/mes</span>
            </div>
          )}
        </div>
      ))}
    </div>
  )

  if (verificando) return null

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f4f6fa', colorScheme: 'light' }}>
      <Sidebar rol="admin" nombreUsuario="" />

      <div className="main-content" style={{ padding: '36px 40px' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h1 style={{ fontSize: '28px', fontWeight: '800', color: '#1B2A4A', margin: 0, letterSpacing: '-0.5px' }}>Clientes</h1>
            <button
              onClick={() => { setMostrarFormNuevo(!mostrarFormNuevo); setHonorariosSeleccionados({}) }}
              style={{ backgroundColor: '#1B2A4A', color: 'white', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
            >
              + Nuevo cliente
            </button>
          </div>

          {mensaje && (
            <div style={{ marginBottom: '16px', padding: '12px 16px', borderRadius: '8px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', fontSize: '13px' }}>
              {mensaje}
            </div>
          )}

          {mostrarFormNuevo && (
            <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', marginBottom: '24px', boxShadow: '0 2px 12px rgba(0,0,0,0.10)', border: '1px solid #d1d5db' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '600', color: '#1B2A4A', marginBottom: '16px' }}>Nuevo cliente</h3>
              <form onSubmit={handleGuardarNuevo} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>Nombre</label>
                  <input type="text" value={formNuevo.nombre} onChange={e => setFormNuevo({ nombre: e.target.value })} style={inputStyle} required />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>Honorarios activos y horas mensuales</label>
                  <FormHonorarios />
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button type="submit" disabled={guardando} style={{ backgroundColor: '#1B2A4A', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 20px', fontSize: '13px', cursor: 'pointer', opacity: guardando ? 0.5 : 1 }}>
                    {guardando ? 'Guardando...' : 'Guardar'}
                  </button>
                  <button type="button" onClick={() => setMostrarFormNuevo(false)} style={{ backgroundColor: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '8px', padding: '8px 20px', fontSize: '13px', cursor: 'pointer' }}>
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          )}

          <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '16px 20px', marginBottom: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.10)', border: '1px solid #d1d5db' }}>
            <p style={{ fontSize: '11px', fontWeight: '700', color: '#9ca3af', letterSpacing: '1px', textTransform: 'uppercase', margin: '0 0 14px' }}>FILTROS</p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <input
                type="text"
                placeholder="Buscar cliente..."
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                style={{ flex: 1, border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', backgroundColor: '#fafafa', color: '#1f2937' }}
              />
              <select
                value={filtro}
                onChange={e => setFiltro(e.target.value)}
                style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', backgroundColor: '#fafafa', color: '#1f2937' }}
              >
                <option value="activos">Solo activos</option>
                <option value="inactivos">Solo inactivos</option>
                <option value="todos">Todos</option>
              </select>
            </div>
          </div>

          {cargando ? (
            <p style={{ color: '#6b7280' }}>Cargando clientes...</p>
          ) : (
            <div style={{ backgroundColor: 'white', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.10)', border: '1px solid #d1d5db' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '11px', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Nombre</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '11px', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Estado</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '11px', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {clientesFiltrados.map((c, i) => (
                    <React.Fragment key={c.id}>
                      <tr style={{ borderTop: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '12px 16px', fontSize: '13px', color: '#374151' }}>{c.nombre}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ padding: '3px 10px', borderRadius: '99px', fontSize: '11px', fontWeight: '600', backgroundColor: c.activo ? '#dcfce7' : '#fee2e2', color: c.activo ? '#16a34a' : '#dc2626' }}>
                            {c.activo ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => handleEditarCliente(c)}
                            style={{ fontSize: '12px', padding: '5px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', backgroundColor: clienteEditando?.id === c.id ? '#1B2A4A' : '#eff6ff', color: clienteEditando?.id === c.id ? 'white' : '#1d4ed8' }}
                          >
                            {clienteEditando?.id === c.id ? 'Cerrar' : 'Editar'}
                          </button>
                          <button
                            onClick={() => handleToggleActivo(c)}
                            style={{ fontSize: '12px', padding: '5px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', backgroundColor: c.activo ? '#fef2f2' : '#f0fdf4', color: c.activo ? '#dc2626' : '#16a34a' }}
                          >
                            {c.activo ? 'Desactivar' : 'Activar'}
                          </button>
                        </td>
                      </tr>
                      {clienteEditando?.id === c.id && (
                        <tr key={`edit-${c.id}`}>
                          <td colSpan={3} style={{ padding: '16px', backgroundColor: '#eff6ff', borderLeft: '4px solid #1B2A4A' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                              <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>Nombre</label>
                                <input
                                  type="text"
                                  value={clienteEditando.nombre}
                                  onChange={e => setClienteEditando({ ...clienteEditando, nombre: e.target.value })}
                                  style={inputStyle}
                                />
                              </div>
                              <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>Honorarios activos y horas mensuales</label>
                                <FormHonorarios />
                              </div>
                              <div style={{ display: 'flex', gap: '12px' }}>
                                <button onClick={handleGuardarEdicion} disabled={guardando} style={{ backgroundColor: '#1B2A4A', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 20px', fontSize: '13px', cursor: 'pointer', opacity: guardando ? 0.5 : 1 }}>
                                  {guardando ? 'Guardando...' : 'Actualizar'}
                                </button>
                                <button onClick={() => setClienteEditando(null)} style={{ backgroundColor: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '8px', padding: '8px 20px', fontSize: '13px', cursor: 'pointer' }}>
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
              <div style={{ padding: '12px 16px', borderTop: '1px solid #f3f4f6', fontSize: '12px', color: '#6b7280' }}>
                {clientesFiltrados.length} clientes
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}