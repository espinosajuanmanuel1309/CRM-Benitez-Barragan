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
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [filtroCliente, setFiltroCliente] = useState('')
  const [filtroUsuario, setFiltroUsuario] = useState('')
  const router = useRouter()

  useEffect(() => {
    inicializar()
  }, [])

  const inicializar = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: usuarioData } = await supabase.from('usuarios').select('*').eq('id', user.id).single()
    setUsuarioActual(usuarioData)
    setRolUsuario(usuarioData?.rol || 'normal')
    const [{ data: clientesData }, { data: usuariosData }] = await Promise.all([
      supabase.from('clientes').select('*').eq('activo', true).order('nombre'),
      supabase.from('usuarios').select('*').eq('activo', true).order('nombre_completo')
    ])
    setClientes(clientesData || [])
    setUsuarios(usuariosData || [])
    await cargarRegistros(usuarioData)
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
    setFechaInicio(''); setFechaFin(''); setFiltroCliente(''); setFiltroUsuario('')
    cargarRegistros(usuarioActual)
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

  const inputStyle = { border: '1px solid #e5e7eb', borderRadius: '8px', padding: '7px 12px', fontSize: '13px', backgroundColor: '#fafafa', color: '#1f2937' }
  const btnStyle = (color) => ({ backgroundColor: color, color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', cursor: 'pointer' })

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f4f6fa', colorScheme: 'light' }}>
      <Sidebar rol={rolUsuario} nombreUsuario={usuarioActual?.nombre_completo} />

      <div style={{ marginLeft: '240px', flex: 1, padding: '36px 40px' }}>
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
                  {['Fecha', 'Asociado', 'Cliente', 'Honorario', 'Actividad', 'Horas', 'Comentario'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: '11px', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {registros.map((r, i) => (
                  <tr key={r.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#374151' }}>{formatearFecha(r.fecha_registro)}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#374151' }}>{r.usuarios?.nombre_completo}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#374151' }}>{r.clientes?.nombre}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#374151' }}>{r.honorarios?.nombre}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#374151' }}>{r.actividades?.nombre}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '600', color: '#1B2A4A' }}>{formatearTiempo(r.horas, r.minutos)}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#6b7280' }}>{r.comentario || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}