'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import Sidebar from '../lib/Navbar'

export default function MisRegistrosPage() {
  const [registros, setRegistros] = useState([])
  const [clientes, setClientes] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [rolUsuario, setRolUsuario] = useState('')
  const [usuarioActual, setUsuarioActual] = useState(null)
  const [cargando, setCargando] = useState(true)
  const mesActual = new Date().getMonth() + 1
  const anioActual = new Date().getFullYear()
  const primerDiaMes = `${anioActual}-${String(mesActual).padStart(2, '0')}-01`
  const ultimoDiaMes = new Date(anioActual, mesActual, 0).toISOString().split('T')[0]

  const [fechaInicio, setFechaInicio] = useState(primerDiaMes)
  const [fechaFin, setFechaFin] = useState(ultimoDiaMes)
  const [filtroCliente, setFiltroCliente] = useState('')
  const [filtroUsuario, setFiltroUsuario] = useState('')

  // Estado modal edición
  const [registroEditando, setRegistroEditando] = useState(null)
  const [formEditar, setFormEditar] = useState({})
  const [honorariosEditar, setHonorariosEditar] = useState([])
  const [actividadesAll, setActividadesAll] = useState([])
  const [actividadesEditar, setActividadesEditar] = useState([])
  const [busquedaClienteEditar, setBusquedaClienteEditar] = useState('')
  const [mostrarListaClientesEditar, setMostrarListaClientesEditar] = useState(false)
  const [guardandoEdicion, setGuardandoEdicion] = useState(false)

  const router = useRouter()

  useEffect(() => {
    inicializar()
  }, [])

  // Cargar honorarios cuando cambia cliente en el modal
  useEffect(() => {
    if (!formEditar.cliente_id) return
    const cargar = async () => {
      const { data } = await supabase
        .from('presupuestos')
        .select('honorario_id, honorarios(id, nombre)')
        .eq('cliente_id', parseInt(formEditar.cliente_id))
      setHonorariosEditar(data?.map(p => p.honorarios) || [])
      setFormEditar(f => ({ ...f, honorario_id: '', actividad_id: '' }))
      setActividadesEditar([])
    }
    cargar()
  }, [formEditar.cliente_id])

  // Filtrar actividades cuando cambia honorario en el modal
  useEffect(() => {
    if (!formEditar.honorario_id) return
    const filtradas = actividadesAll.filter(a => a.honorario_id === parseInt(formEditar.honorario_id))
    setActividadesEditar(filtradas)
    setFormEditar(f => ({ ...f, actividad_id: '' }))
  }, [formEditar.honorario_id])

  const inicializar = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: usuarioData } = await supabase.from('usuarios').select('*').eq('id', user.id).single()
    setUsuarioActual(usuarioData)
    setRolUsuario(usuarioData?.rol || 'normal')
    const [{ data: clientesData }, { data: usuariosData }, { data: actividadesData }] = await Promise.all([
      supabase.from('clientes').select('*').eq('activo', true).order('nombre'),
      supabase.from('usuarios').select('*').eq('activo', true).order('nombre_completo'),
      supabase.from('actividades').select('*').eq('activo', true).order('nombre'),
    ])
    setClientes(clientesData || [])
    setUsuarios(usuariosData || [])
    setActividadesAll(actividadesData || [])
    await cargarRegistros(usuarioData, { fechaInicio: primerDiaMes, fechaFin: ultimoDiaMes })
  }

  const cargarRegistros = async (usuarioData = usuarioActual, filtros = {}) => {
    setCargando(true)
    const rol = usuarioData?.rol || rolUsuario
    const userId = usuarioData?.id
    let query = supabase
      .from('registros')
      .select(`*, clientes(nombre), honorarios(nombre), actividades(nombre), usuarios(nombre_completo)`)
      .order('fecha_registro', { ascending: false })
    if (rol === 'normal') query = query.eq('usuario_id', userId)
    if (filtros.fechaInicio) query = query.gte('fecha_registro', filtros.fechaInicio)
    if (filtros.fechaFin) query = query.lte('fecha_registro', filtros.fechaFin)
    if (filtros.filtroCliente) query = query.eq('cliente_id', parseInt(filtros.filtroCliente))
    if (filtros.filtroUsuario && rol === 'admin') query = query.eq('usuario_id', filtros.filtroUsuario)
    const { data } = await query
    setRegistros(data || [])
    setCargando(false)
  }

  const handleFiltrar = () => cargarRegistros(usuarioActual, { fechaInicio, fechaFin, filtroCliente, filtroUsuario })

  const handleLimpiar = () => {
    setFechaInicio(primerDiaMes); setFechaFin(ultimoDiaMes); setFiltroCliente(''); setFiltroUsuario('')
    cargarRegistros(usuarioActual, { fechaInicio: primerDiaMes, fechaFin: ultimoDiaMes })
  }

  const puedeModificar = (r) => rolUsuario === 'admin' || r.usuario_id === usuarioActual?.id

  const handleEliminar = async (r) => {
    if (!puedeModificar(r)) return
    if (!confirm('¿Seguro que deseas eliminar este registro?')) return
    await supabase.from('registros').delete().eq('id', r.id)
    setRegistros(prev => prev.filter(x => x.id !== r.id))
  }

  const handleAbrirEditar = async (r) => {
    if (!puedeModificar(r)) return
    // Cargar honorarios del cliente del registro
    const { data: presupuestos } = await supabase
      .from('presupuestos')
      .select('honorario_id, honorarios(id, nombre)')
      .eq('cliente_id', r.cliente_id)
    const hons = presupuestos?.map(p => p.honorarios) || []
    setHonorariosEditar(hons)

    const filtradas = actividadesAll.filter(a => a.honorario_id === r.honorario_id)
    setActividadesEditar(filtradas)

    setBusquedaClienteEditar(r.clientes?.nombre || '')
    setFormEditar({
      cliente_id: r.cliente_id,
      honorario_id: r.honorario_id,
      actividad_id: r.actividad_id,
      fecha_registro: r.fecha_registro,
      horas: r.horas,
      minutos: r.minutos,
      comentario: r.comentario || ''
    })
    setRegistroEditando(r)
  }

  const handleGuardarEdicion = async () => {
    setGuardandoEdicion(true)
    const { error } = await supabase.from('registros').update({
      cliente_id: parseInt(formEditar.cliente_id),
      honorario_id: parseInt(formEditar.honorario_id),
      actividad_id: parseInt(formEditar.actividad_id),
      fecha_registro: formEditar.fecha_registro,
      horas: parseInt(formEditar.horas),
      minutos: parseInt(formEditar.minutos),
      comentario: formEditar.comentario
    }).eq('id', registroEditando.id)

    if (!error) {
      setRegistroEditando(null)
      cargarRegistros(usuarioActual, { fechaInicio, fechaFin, filtroCliente, filtroUsuario })
    }
    setGuardandoEdicion(false)
  }

  const formatearFecha = (fecha) => {
    const [anio, mes, dia] = fecha.split('-')
    return `${dia}/${mes}/${anio}`
  }

  const formatearTiempo = (horas, minutos) => (horas + minutos / 60).toFixed(2)

  const handleDescargarExcel = () => {
    const datos = registros.map(r => ({
      Fecha: formatearFecha(r.fecha_registro),
      Usuario: r.usuarios?.nombre_completo,
      Cliente: r.clientes?.nombre,
      Honorario: r.honorarios?.nombre,
      Actividad: r.actividades?.nombre,
      Horas: (r.horas + r.minutos / 60).toFixed(2),
      Comentario: r.comentario || ''
    }))
    const worksheet = XLSX.utils.json_to_sheet(datos)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Registros')
    XLSX.writeFile(workbook, `registros-${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const totalHoras = registros.reduce((acc, r) => acc + r.horas + r.minutos / 60, 0)
  const minutosOpciones = Array.from({ length: 12 }, (_, i) => i * 5)
  const clientesFiltradosEditar = clientes.filter(c =>
    c.nombre.toLowerCase().includes(busquedaClienteEditar.toLowerCase())
  )

  const inputStyle = { border: '1px solid #e5e7eb', borderRadius: '8px', padding: '7px 12px', fontSize: '13px', backgroundColor: '#fafafa', color: '#1f2937' }
  const inputModalStyle = { width: '100%', border: '1px solid #d1d5db', borderRadius: '8px', padding: '9px 12px', fontSize: '14px', backgroundColor: 'white', color: '#1f2937', boxSizing: 'border-box' }
  const btnStyle = (color) => ({ backgroundColor: color, color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', cursor: 'pointer' })

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f4f6fa', colorScheme: 'light' }}>
      <Sidebar rol={rolUsuario} nombreUsuario={usuarioActual?.nombre_completo} />

      <div className="main-content" style={{ padding: '36px 40px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '800', color: '#1B2A4A', marginBottom: '24px', letterSpacing: '-0.5px' }}>
          {rolUsuario === 'admin' ? 'Registros' : 'Mis Registros'}
        </h1>

        {/* Filtros */}
        <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '16px 20px', marginBottom: '24px', boxShadow: '0 2px 12px rgba(0,0,0,0.10)', border: '1px solid #d1d5db' }}>
          <p style={{ fontSize: '11px', fontWeight: '700', color: '#9ca3af', letterSpacing: '1px', textTransform: 'uppercase', margin: '0 0 14px' }}>FILTROS</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#6b7280', marginBottom: '4px' }}>Fecha inicio</label>
              <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#6b7280', marginBottom: '4px' }}>Fecha fin</label>
              <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#6b7280', marginBottom: '4px' }}>Cliente</label>
              <select value={filtroCliente} onChange={e => setFiltroCliente(e.target.value)} style={inputStyle}>
                <option value="">Todos los clientes</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            {rolUsuario === 'admin' && (
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#6b7280', marginBottom: '4px' }}>Asociado</label>
                <select value={filtroUsuario} onChange={e => setFiltroUsuario(e.target.value)} style={inputStyle}>
                  <option value="">Todos los asociados</option>
                  {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre_completo}</option>)}
                </select>
              </div>
            )}
            <button onClick={handleFiltrar} style={btnStyle('#1B2A4A')}>Filtrar</button>
            <button onClick={handleLimpiar} style={{ ...btnStyle('#6b7280'), backgroundColor: '#f3f4f6', color: '#374151' }}>Limpiar</button>
            <button onClick={handleDescargarExcel} disabled={registros.length === 0} style={{ ...btnStyle('#16a34a'), opacity: registros.length === 0 ? 0.5 : 1 }}>
              ⬇ Descargar Excel
            </button>
            {registros.length > 0 && (
              <div style={{ marginLeft: 'auto', fontSize: '13px', color: '#6b7280' }}>
                <span style={{ fontWeight: '600', color: '#1B2A4A' }}>{registros.length}</span> registros ·
                <span style={{ fontWeight: '600', color: '#1B2A4A' }}> {totalHoras.toFixed(1)}h</span> total
              </div>
            )}
          </div>
        </div>

        {cargando ? (
          <p style={{ color: '#6b7280' }}>Cargando registros...</p>
        ) : registros.length === 0 ? (
          <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '40px', textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.10)', border: '1px solid #d1d5db' }}>
            <p style={{ color: '#6b7280' }}>No hay registros en este período.</p>
          </div>
        ) : (
          <div style={{ backgroundColor: 'white', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.10)', border: '1px solid #d1d5db' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                <tr>
                  {['Fecha', 'Asociado', 'Cliente', 'Honorario', 'Actividad', 'Horas', 'Comentario', 'Acciones'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: '11px', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {registros.map((r) => (
                  <tr key={r.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#374151' }}>{formatearFecha(r.fecha_registro)}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#374151' }}>{r.usuarios?.nombre_completo}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#374151' }}>{r.clientes?.nombre}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#374151' }}>{r.honorarios?.nombre}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#374151' }}>{r.actividades?.nombre}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '600', color: '#1B2A4A' }}>{formatearTiempo(r.horas, r.minutos)}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#6b7280' }}>{r.comentario || '—'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      {puedeModificar(r) && (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => handleAbrirEditar(r)}
                            style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '4px 10px', fontSize: '12px', cursor: 'pointer', fontWeight: '500' }}
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleEliminar(r)}
                            style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '6px', padding: '4px 10px', fontSize: '12px', cursor: 'pointer', fontWeight: '500' }}
                          >
                            Eliminar
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de edición */}
      {registroEditando && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '500px', boxShadow: '0 8px 40px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#1B2A4A', margin: 0 }}>Editar Registro</h2>
              <button onClick={() => setRegistroEditando(null)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#6b7280' }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>Fecha</label>
                <input
                  type="date"
                  value={formEditar.fecha_registro || ''}
                  onChange={e => setFormEditar(f => ({ ...f, fecha_registro: e.target.value }))}
                  style={inputModalStyle}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>Cliente</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="Escribe para buscar un cliente..."
                    value={busquedaClienteEditar}
                    onChange={e => {
                      setBusquedaClienteEditar(e.target.value)
                      setMostrarListaClientesEditar(true)
                      setFormEditar(f => ({ ...f, cliente_id: '', honorario_id: '', actividad_id: '' }))
                    }}
                    onFocus={() => setMostrarListaClientesEditar(true)}
                    onBlur={() => setTimeout(() => setMostrarListaClientesEditar(false), 150)}
                    style={inputModalStyle}
                  />
                  {mostrarListaClientesEditar && (
                    <div style={{ position: 'absolute', zIndex: 10, width: '100%', backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.1)', maxHeight: '200px', overflowY: 'auto', marginTop: '4px' }}>
                      {clientesFiltradosEditar.length > 0 ? clientesFiltradosEditar.map(c => (
                        <div
                          key={c.id}
                          onMouseDown={() => {
                            setFormEditar(f => ({ ...f, cliente_id: c.id, honorario_id: '', actividad_id: '' }))
                            setBusquedaClienteEditar(c.nombre)
                            setMostrarListaClientesEditar(false)
                          }}
                          style={{ padding: '9px 14px', fontSize: '13px', color: '#374151', cursor: 'pointer', borderBottom: '1px solid #f9fafb' }}
                          onMouseEnter={e => e.currentTarget.style.backgroundColor = '#eff6ff'}
                          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'white'}
                        >
                          {c.nombre}
                        </div>
                      )) : (
                        <p style={{ padding: '9px 14px', fontSize: '13px', color: '#9ca3af' }}>No se encontró ningún cliente</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>Honorario</label>
                <select
                  value={formEditar.honorario_id || ''}
                  onChange={e => setFormEditar(f => ({ ...f, honorario_id: e.target.value }))}
                  disabled={!formEditar.cliente_id}
                  style={inputModalStyle}
                >
                  <option value="">{formEditar.cliente_id ? 'Selecciona un honorario' : 'Primero selecciona un cliente'}</option>
                  {honorariosEditar.map(h => <option key={h.id} value={h.id}>{h.nombre}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>Actividad</label>
                <select
                  value={formEditar.actividad_id || ''}
                  onChange={e => setFormEditar(f => ({ ...f, actividad_id: e.target.value }))}
                  disabled={!formEditar.honorario_id}
                  style={inputModalStyle}
                >
                  <option value="">{formEditar.honorario_id ? 'Selecciona una actividad' : 'Primero selecciona un honorario'}</option>
                  {actividadesEditar.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>Horas</label>
                  <input
                    type="number"
                    value={formEditar.horas ?? 0}
                    onChange={e => setFormEditar(f => ({ ...f, horas: e.target.value }))}
                    min="0" max="24"
                    style={inputModalStyle}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>Minutos</label>
                  <select
                    value={formEditar.minutos ?? 0}
                    onChange={e => setFormEditar(f => ({ ...f, minutos: e.target.value }))}
                    style={inputModalStyle}
                  >
                    {minutosOpciones.map(m => <option key={m} value={m}>{m.toString().padStart(2, '0')}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>Comentario (opcional)</label>
                <textarea
                  value={formEditar.comentario || ''}
                  onChange={e => setFormEditar(f => ({ ...f, comentario: e.target.value }))}
                  rows={3}
                  style={{ ...inputModalStyle, resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '4px' }}>
                <button onClick={() => setRegistroEditando(null)} style={{ backgroundColor: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '13px', cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button
                  onClick={handleGuardarEdicion}
                  disabled={guardandoEdicion || !formEditar.cliente_id || !formEditar.honorario_id || !formEditar.actividad_id}
                  style={{ backgroundColor: guardandoEdicion ? '#93a3b8' : '#1B2A4A', color: 'white', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '13px', fontWeight: '600', cursor: guardandoEdicion ? 'not-allowed' : 'pointer' }}
                >
                  {guardandoEdicion ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
