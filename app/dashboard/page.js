'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import Sidebar from '../lib/Navbar'

const REGISTROS_PAGE_SIZE = 1000

export default function DashboardPage() {
  const [usuario, setUsuario] = useState(null)
  const [rol, setRol] = useState('')
  const [cargando, setCargando] = useState(true)
  const [kpis, setKpis] = useState({ horasMes: 0, horasMesAnterior: 0, clientesActivos: 0, asociadosActivos: 0 })
  const [horasPorCliente, setHorasPorCliente] = useState([])
  const [horasPorAsociado, setHorasPorAsociado] = useState([])
  const [horasPorHonorario, setHorasPorHonorario] = useState([])
  const [horasPorArea, setHorasPorArea] = useState([])
  const [alertas, setAlertas] = useState([])
  const [misHoras, setMisHoras] = useState({ total: 0, porCliente: [] })
  const [clientes, setClientes] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [filtroMes, setFiltroMes] = useState(new Date().getMonth() + 1)
  const [filtroAnio, setFiltroAnio] = useState(new Date().getFullYear())
  const [filtroCliente, setFiltroCliente] = useState('')
  const [filtroAsociado, setFiltroAsociado] = useState('')
  const [usuarioActualId, setUsuarioActualId] = useState(null)
  const router = useRouter()

  const mesActual = new Date().getMonth() + 1
  const anioActual = new Date().getFullYear()
  const mesAnterior = mesActual === 1 ? 12 : mesActual - 1
  const anioMesAnterior = mesActual === 1 ? anioActual - 1 : anioActual

  const primerDiaMes = `${anioActual}-${String(mesActual).padStart(2, '0')}-01`
  const ultimoDiaMes = new Date(anioActual, mesActual, 0).toISOString().split('T')[0]
  const primerDiaMesAnterior = `${anioMesAnterior}-${String(mesAnterior).padStart(2, '0')}-01`
  const ultimoDiaMesAnterior = new Date(anioMesAnterior, mesAnterior, 0).toISOString().split('T')[0]

  const inicializar = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: usuarioData } = await supabase
      .from('usuarios')
      .select('*')
      .eq('id', user.id)
      .single()

    setUsuario(usuarioData)
    setRol(usuarioData?.rol || 'normal')
    setUsuarioActualId(user.id)

    const [{ data: clientesData }, { data: usuariosData }] = await Promise.all([
      supabase.from('clientes').select('*').eq('activo', true).order('nombre'),
      supabase.from('usuarios').select('*').eq('activo', true).order('nombre_completo')
    ])
    setClientes(clientesData || [])
    setUsuarios(usuariosData || [])

    if (usuarioData?.rol === 'admin') {
      await cargarDatosAdmin({ fechaInicio: primerDiaMes, fechaFin: ultimoDiaMes })
    } else {
      await cargarDatosNormal(user.id, { fechaInicio: primerDiaMes, fechaFin: ultimoDiaMes })
    }
    setCargando(false)
  }

  useEffect(() => {
    inicializar()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const cargarDatosAdmin = async (filtros = {}) => {
    setCargando(true)
    const fechaInicio = filtros.fechaInicio || primerDiaMes
    const fechaFin = filtros.fechaFin || ultimoDiaMes
    const anioFiltro = parseInt(fechaInicio.split('-')[0])

    const { data: { session } } = await supabase.auth.getSession()
    const cargarRegistrosAdmin = async (params) => {
      const response = await fetch('/api/admin-registros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify(params)
      })
      const data = await response.json()
      return data.registros || []
    }

    const registrosMes = await cargarRegistrosAdmin({
      fechaInicio,
      fechaFin,
      clienteId: filtros.cliente ? parseInt(filtros.cliente) : null,
      asociadoId: filtros.asociado || null
    })

    const registrosMesAnterior = await cargarRegistrosAdmin({
      fechaInicio: primerDiaMesAnterior,
      fechaFin: ultimoDiaMesAnterior,
      clienteId: null,
      asociadoId: null
    })

    const [
      { data: clientesData },
      { data: usuariosData },
      { data: presupuestos }
    ] = await Promise.all([
      supabase.from('clientes').select('*').eq('activo', true),
      supabase.from('usuarios').select('*').eq('activo', true),
      supabase.from('presupuestos').select('*, clientes(nombre), honorarios(nombre)').eq('anio', anioFiltro)
    ])

    const totalHorasMes = registrosMes.reduce((acc, r) => acc + r.horas + r.minutos / 60, 0)
    const totalHorasMesAnterior = registrosMesAnterior.reduce((acc, r) => acc + r.horas + r.minutos / 60, 0)

    setKpis({
      horasMes: totalHorasMes,
      horasMesAnterior: totalHorasMesAnterior,
      clientesActivos: clientesData?.length || 0,
      asociadosActivos: usuariosData?.length || 0
    })

    const porCliente = {}
    registrosMes.forEach(r => {
      const nombre = r.clientes?.nombre || 'Sin cliente'
      porCliente[nombre] = (porCliente[nombre] || 0) + r.horas + r.minutos / 60
    })
    setHorasPorCliente(
      Object.entries(porCliente)
        .map(([nombre, horas]) => ({ nombre: nombre.length > 20 ? nombre.substring(0, 20) + '...' : nombre, horas: parseFloat(horas.toFixed(2)) }))
        .sort((a, b) => b.horas - a.horas)
        .slice(0, 10)
    )

    const porAsociado = {}
    registrosMes.forEach(r => {
      const nombre = r.usuarios?.nombre_completo || 'Sin nombre'
      porAsociado[nombre] = (porAsociado[nombre] || 0) + r.horas + r.minutos / 60
    })
    setHorasPorAsociado(
      Object.entries(porAsociado)
        .map(([nombre, horas]) => ({ nombre, horas: parseFloat(horas.toFixed(2)) }))
        .sort((a, b) => b.horas - a.horas)
    )

    const porArea = {}
    registrosMes.forEach(r => {
      const area = r.usuarios?.area || 'sin área'
      porArea[area] = (porArea[area] || 0) + r.horas + r.minutos / 60
    })
    setHorasPorArea(
      Object.entries(porArea)
        .map(([nombre, horas]) => ({ nombre: nombre.charAt(0).toUpperCase() + nombre.slice(1), horas: parseFloat(horas.toFixed(2)) }))
        .sort((a, b) => b.horas - a.horas)
    )

    const porHonorario = {}
    registrosMes.forEach(r => {
      const nombre = r.honorarios?.nombre || 'Sin honorario'
      porHonorario[nombre] = (porHonorario[nombre] || 0) + r.horas + r.minutos / 60
    })
    setHorasPorHonorario(
      Object.entries(porHonorario)
        .map(([nombre, horas]) => ({ nombre: nombre.replace('Honorarios por ', '').replace('Honorarios ', ''), horas: parseFloat(horas.toFixed(2)) }))
        .sort((a, b) => b.horas - a.horas)
    )

    const horasPorClienteCompleto = {}
    registrosMes.forEach(r => {
      const clave = `${r.cliente_id}_${r.honorario_id}`
      horasPorClienteCompleto[clave] = (horasPorClienteCompleto[clave] || 0) + r.horas + r.minutos / 60
    })

    const alertasData = []
    presupuestos?.forEach(p => {
      if (p.horas_mes > 0) {
        const clave = `${p.cliente_id}_${p.honorario_id}`
        const horasUsadas = horasPorClienteCompleto[clave] || 0
        const porcentaje = (horasUsadas / p.horas_mes) * 100
        if (porcentaje > 100) {
          alertasData.push({
            cliente: p.clientes?.nombre,
            honorario: p.honorarios?.nombre,
            horasUsadas: parseFloat(horasUsadas.toFixed(2)),
            horasPresupuesto: p.horas_mes,
            porcentaje: parseFloat(porcentaje.toFixed(0))
          })
        }
      }
    })
    setAlertas(alertasData.sort((a, b) => (b.horasUsadas - b.horasPresupuesto) - (a.horasUsadas - a.horasPresupuesto)))
    setCargando(false)
  }

  const cargarDatosNormal = async (userId, filtros = {}) => {
    setCargando(true)
    const fechaInicio = filtros.fechaInicio || primerDiaMes
    const fechaFin = filtros.fechaFin || ultimoDiaMes
    const registrosMes = []

    for (let from = 0; ; from += REGISTROS_PAGE_SIZE) {
      let query = supabase
        .from('registros')
        .select('*, clientes(id, nombre), honorarios(id, nombre)')
        .eq('usuario_id', userId)
        .gte('fecha_registro', fechaInicio)
        .lte('fecha_registro', fechaFin)
        .order('fecha_registro', { ascending: false })
        .order('id', { ascending: false })
        .range(from, from + REGISTROS_PAGE_SIZE - 1)

      if (filtros.cliente) query = query.eq('cliente_id', parseInt(filtros.cliente))

      const { data, error } = await query
      if (error) {
        console.error(error)
        break
      }

      registrosMes.push(...(data || []))
      if (!data || data.length < REGISTROS_PAGE_SIZE) break
    }

    const totalHoras = registrosMes.reduce((acc, r) => acc + r.horas + r.minutos / 60, 0)

    // Agrupar mis horas por cliente y honorario
    const porCliente = {}
    registrosMes.forEach(r => {
      const cId = r.cliente_id
      const hId = r.honorario_id
      if (!porCliente[cId]) porCliente[cId] = { nombre: r.clientes?.nombre, cliente_id: cId, misHoras: 0, honorarios: {} }
      porCliente[cId].misHoras += r.horas + r.minutos / 60
      if (!porCliente[cId].honorarios[hId]) porCliente[cId].honorarios[hId] = { nombre: r.honorarios?.nombre, honorario_id: hId, misHoras: 0, totalDespacho: 0, presupuesto: null }
      porCliente[cId].honorarios[hId].misHoras += r.horas + r.minutos / 60
    })

    const clienteIds = Object.keys(porCliente).map(Number)

    if (clienteIds.length > 0) {
      // Total despacho (todos los asociados) por cliente+honorario en el período
      // Se usa API con service key para saltar RLS y obtener registros de todos los usuarios
      const { data: { session } } = await supabase.auth.getSession()
      const resDespacho = await fetch('/api/total-despacho', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ clienteIds, fechaInicio, fechaFin })
      })
      const { totalDespacho: tdMap } = await resDespacho.json()

      Object.entries(tdMap || {}).forEach(([clave, horas]) => {
        const [cId, hId] = clave.split('_').map(Number)
        if (porCliente[cId]?.honorarios[hId]) {
          porCliente[cId].honorarios[hId].totalDespacho = horas
        }
      })

      // Presupuestos del año para estos clientes
      const { data: presupuestos } = await supabase
        .from('presupuestos')
        .select('cliente_id, honorario_id, horas_mes')
        .in('cliente_id', clienteIds)
        .eq('anio', anioActual)

      presupuestos?.forEach(p => {
        if (porCliente[p.cliente_id]?.honorarios[p.honorario_id]) {
          porCliente[p.cliente_id].honorarios[p.honorario_id].presupuesto = p.horas_mes
        }
      })
    }

    const porClienteArray = Object.values(porCliente).map(c => ({
      ...c,
      misHoras: parseFloat(c.misHoras.toFixed(2)),
      honorarios: Object.values(c.honorarios).map(h => ({
        ...h,
        misHoras: parseFloat(h.misHoras.toFixed(2)),
        totalDespacho: parseFloat(h.totalDespacho.toFixed(2))
      })).sort((a, b) => b.misHoras - a.misHoras)
    })).sort((a, b) => b.misHoras - a.misHoras)

    setMisHoras({ total: totalHoras, porCliente: porClienteArray })
    setCargando(false)
  }

  const handleFiltrar = () => {
    const primerDiaMesFiltro = `${filtroAnio}-${String(filtroMes).padStart(2, '0')}-01`
    const ultimoDiaMesFiltro = new Date(filtroAnio, filtroMes, 0).toISOString().split('T')[0]
    const filtros = {
      fechaInicio: primerDiaMesFiltro,
      fechaFin: ultimoDiaMesFiltro,
      cliente: filtroCliente || null,
      asociado: filtroAsociado || null
    }
    if (rol === 'admin') {
      cargarDatosAdmin(filtros)
    } else {
      cargarDatosNormal(usuarioActualId, filtros)
    }
  }

  const handleLimpiar = () => {
    setFiltroMes(mesActual)
    setFiltroAnio(anioActual)
    setFiltroCliente('')
    setFiltroAsociado('')
    if (rol === 'admin') {
      cargarDatosAdmin({ fechaInicio: primerDiaMes, fechaFin: ultimoDiaMes })
    } else {
      cargarDatosNormal(usuarioActualId, { fechaInicio: primerDiaMes, fechaFin: ultimoDiaMes })
    }
  }

  const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  const COLORS = ['#1B2A4A', '#2E4A8C', '#4A7CC9', '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981']

  const nombreMes = new Date(anioActual, mesActual - 1).toLocaleString('es-MX', { month: 'long', year: 'numeric' })
  const variacionMes = kpis.horasMesAnterior > 0 ? ((kpis.horasMes - kpis.horasMesAnterior) / kpis.horasMesAnterior * 100).toFixed(1) : null

  if (cargando) return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f4f6fa', colorScheme: 'light' }}>
      <Sidebar rol={rol} nombreUsuario={usuario?.nombre_completo} />
      <div className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#6b7280' }}>Cargando dashboard...</p>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f4f6fa', colorScheme: 'light' }}>
      <Sidebar rol={rol} nombreUsuario={usuario?.nombre_completo} />

      <div className="main-content" style={{ padding: '36px 40px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

          {/* Header */}
          <div style={{ marginBottom: '32px' }}>
            <p style={{ fontSize: '13px', color: '#9ca3af', margin: '0 0 6px', fontWeight: '500' }}>
              Bienvenido, {usuario?.nombre_completo}
            </p>
            <h1 style={{ fontSize: '28px', fontWeight: '800', color: '#1B2A4A', margin: '0 0 2px', textTransform: 'capitalize', letterSpacing: '-0.5px' }}>
              Dashboard
            </h1>
            <p style={{ fontSize: '14px', color: '#6b7280', margin: 0, textTransform: 'capitalize' }}>{nombreMes}</p>
          </div>

          {/* Filtros */}
          <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '18px 20px', marginBottom: '28px', boxShadow: '0 2px 12px rgba(0,0,0,0.10)', border: '1px solid #d1d5db' }}>
            <p style={{ fontSize: '11px', fontWeight: '700', color: '#9ca3af', letterSpacing: '1px', textTransform: 'uppercase', margin: '0 0 14px' }}>Filtros</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#6b7280', marginBottom: '4px' }}>Mes</label>
                <select value={filtroMes} onChange={e => setFiltroMes(parseInt(e.target.value))}
                  style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '7px 12px', fontSize: '13px', backgroundColor: '#fafafa', color: '#1f2937' }}>
                  {meses.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#6b7280', marginBottom: '4px' }}>Año</label>
                <input type="number" value={filtroAnio} onChange={e => setFiltroAnio(parseInt(e.target.value))} min="2020" max="2099"
                  style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '7px 12px', fontSize: '13px', backgroundColor: '#fafafa', color: '#1f2937', width: '90px' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#6b7280', marginBottom: '4px' }}>Cliente</label>
                <select value={filtroCliente} onChange={e => setFiltroCliente(e.target.value)}
                  style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '7px 12px', fontSize: '13px', backgroundColor: '#fafafa', color: '#1f2937' }}>
                  <option value="">Todos los clientes</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              {rol === 'admin' && (
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#6b7280', marginBottom: '4px' }}>Asociado</label>
                  <select value={filtroAsociado} onChange={e => setFiltroAsociado(e.target.value)}
                    style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '7px 12px', fontSize: '13px', backgroundColor: '#fafafa', color: '#1f2937' }}>
                    <option value="">Todos los asociados</option>
                    {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre_completo}</option>)}
                  </select>
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={handleFiltrar}
                  style={{ backgroundColor: '#1B2A4A', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 20px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                  Aplicar
                </button>
                <button onClick={handleLimpiar}
                  style={{ backgroundColor: '#f3f4f6', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', cursor: 'pointer' }}>
                  Limpiar
                </button>
              </div>
            </div>
          </div>

          {rol === 'admin' ? (
            <>
              {/* KPIs */}
              <div className="kpi-grid" style={{ gap: '16px', marginBottom: '28px' }}>
                {[
                  { label: 'Horas del período', value: `${kpis.horasMes.toFixed(1)}h`, icon: '⏱', bg: '#1B2A4A', sub: variacionMes && filtroMes === mesActual && filtroAnio === anioActual ? `${parseFloat(variacionMes) >= 0 ? '↑' : '↓'} ${Math.abs(variacionMes)}% vs mes anterior` : null, subOk: parseFloat(variacionMes) >= 0 },
                  { label: 'Mes anterior', value: `${kpis.horasMesAnterior.toFixed(1)}h`, icon: '📅', bg: '#2E4A8C' },
                  { label: 'Clientes activos', value: kpis.clientesActivos, icon: '🏢', bg: '#1B2A4A' },
                  { label: 'Asociados activos', value: kpis.asociadosActivos, icon: '👥', bg: '#2E4A8C' },
                ].map((kpi, i) => (
                  <div key={i} style={{ backgroundColor: kpi.bg, borderRadius: '16px', padding: '22px 24px', boxShadow: '0 4px 16px rgba(27,42,74,0.25)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                      <p style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.55)', margin: 0, textTransform: 'uppercase', letterSpacing: '1px' }}>{kpi.label}</p>
                      <span style={{ fontSize: '20px', opacity: 0.8 }}>{kpi.icon}</span>
                    </div>
                    <p style={{ fontSize: '34px', fontWeight: '800', color: 'white', margin: 0, letterSpacing: '-1.5px', lineHeight: 1 }}>{kpi.value}</p>
                    {kpi.sub && (
                      <p style={{ fontSize: '11px', fontWeight: '600', marginTop: '10px', margin: '10px 0 0', color: kpi.subOk ? '#86efac' : '#fca5a5' }}>{kpi.sub}</p>
                    )}
                  </div>
                ))}
              </div>

              {/* Alertas */}
              {alertas.length > 0 && (
                <div style={{ borderRadius: '16px', marginBottom: '28px', overflow: 'hidden', boxShadow: '0 4px 16px rgba(234,88,12,0.15)', border: '1px solid #fed7aa' }}>
                  <div style={{ backgroundColor: '#ea580c', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '16px' }}>⚠️</span>
                    <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'white', margin: 0 }}>Alertas de presupuesto</h3>
                    <span style={{ marginLeft: 'auto', fontSize: '11px', fontWeight: '800', backgroundColor: 'rgba(255,255,255,0.2)', color: 'white', padding: '3px 12px', borderRadius: '99px' }}>{alertas.length} {alertas.length === 1 ? 'alerta' : 'alertas'}</span>
                  </div>
                  <div style={{ backgroundColor: 'white', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {alertas.map((a, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderRadius: '10px', backgroundColor: a.porcentaje >= 100 ? '#fef2f2' : '#fff7ed', border: `1px solid ${a.porcentaje >= 100 ? '#fecaca' : '#fed7aa'}` }}>
                        <div>
                          <p style={{ fontSize: '13px', fontWeight: '700', color: '#1f2937', margin: 0 }}>{a.cliente}</p>
                          <p style={{ fontSize: '11px', color: '#9ca3af', margin: '3px 0 0' }}>{a.honorario}</p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                          <div style={{ textAlign: 'right' }}>
                            <p style={{ fontSize: '11px', color: '#9ca3af', margin: '0 0 2px' }}>{a.horasUsadas}h / {a.horasPresupuesto}h</p>
                            <div style={{ width: '100px', backgroundColor: '#e5e7eb', borderRadius: '99px', height: '5px' }}>
                              <div style={{ backgroundColor: a.porcentaje >= 100 ? '#dc2626' : '#f97316', height: '5px', borderRadius: '99px', width: `${Math.min(a.porcentaje, 100)}%` }} />
                            </div>
                          </div>
                          <span style={{ fontSize: '16px', fontWeight: '800', color: a.porcentaje >= 100 ? '#dc2626' : '#ea580c', minWidth: '44px', textAlign: 'right' }}>{a.porcentaje}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Gráficas */}
              <div className="charts-grid" style={{ gap: '20px', marginBottom: '20px' }}>
                <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '20px 24px', boxShadow: '0 2px 12px rgba(0,0,0,0.10)', border: '1px solid #d1d5db' }}>
                  <h3 style={{ fontSize: '13px', fontWeight: '700', color: '#1B2A4A', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Top 10 clientes</h3>
                  <p style={{ fontSize: '12px', color: '#9ca3af', margin: '0 0 16px' }}>Por horas registradas</p>
                  <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '16px' }}>
                    {horasPorCliente.length === 0 ? <p style={{ color: '#9ca3af', fontSize: '13px' }}>Sin datos para este período</p> : (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={horasPorCliente} layout="vertical" margin={{ left: 10, right: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                          <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                          <YAxis type="category" dataKey="nombre" tick={{ fontSize: 11, fill: '#6b7280' }} width={120} axisLine={false} tickLine={false} />
                          <Tooltip contentStyle={{ borderRadius: '10px', border: '1px solid #e5e7eb', fontSize: '13px' }} formatter={(v) => [`${v}h`, 'Horas']} />
                          <Bar dataKey="horas" fill="#1B2A4A" radius={[0, 6, 6, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '20px 24px', boxShadow: '0 2px 12px rgba(0,0,0,0.10)', border: '1px solid #d1d5db' }}>
                  <h3 style={{ fontSize: '13px', fontWeight: '700', color: '#1B2A4A', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Por honorario</h3>
                  <p style={{ fontSize: '12px', color: '#9ca3af', margin: '0 0 16px' }}>Distribución de horas</p>
                  <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '16px' }}>
                    {horasPorHonorario.length === 0 ? <p style={{ color: '#9ca3af', fontSize: '13px' }}>Sin datos para este período</p> : (
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie data={horasPorHonorario} dataKey="horas" nameKey="nombre" cx="50%" cy="50%" outerRadius={110} innerRadius={50} paddingAngle={2} label={({ percent }) => `${(percent * 100).toFixed(0)}%`} labelLine={false}>
                            {horasPorHonorario.map((_, index) => (
                              <Cell key={index} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ borderRadius: '10px', border: '1px solid #e5e7eb', fontSize: '13px' }} formatter={(value, name) => [`${value}h`, name]} />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </div>

              {/* Horas por asociado */}
              <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '20px 24px', boxShadow: '0 2px 12px rgba(0,0,0,0.10)', border: '1px solid #d1d5db' }}>
                <h3 style={{ fontSize: '13px', fontWeight: '700', color: '#1B2A4A', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Horas por asociado</h3>
                <p style={{ fontSize: '12px', color: '#9ca3af', margin: '0 0 16px' }}>Rendimiento del equipo en el período</p>
                <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '16px' }}>
                  {horasPorAsociado.length === 0 ? <p style={{ color: '#9ca3af', fontSize: '13px' }}>Sin datos para este período</p> : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      {horasPorAsociado.map((a, i) => {
                        const pct = Math.min((a.horas / (horasPorAsociado[0]?.horas || 1)) * 100, 100)
                        return (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                            <span style={{ fontSize: '11px', fontWeight: '700', color: '#d1d5db', width: '18px', flexShrink: 0 }}>#{i + 1}</span>
                            <span style={{ fontSize: '13px', color: '#374151', width: '180px', flexShrink: 0, fontWeight: i === 0 ? '600' : '400' }}>{a.nombre}</span>
                            <div style={{ flex: 1, backgroundColor: '#f3f4f6', borderRadius: '99px', height: '8px' }}>
                              <div style={{ backgroundColor: i === 0 ? '#1B2A4A' : '#4A7CC9', height: '8px', borderRadius: '99px', width: `${pct}%`, transition: 'width 0.4s ease' }} />
                            </div>
                            <span style={{ fontSize: '13px', fontWeight: '700', color: '#1B2A4A', width: '52px', textAlign: 'right' }}>{a.horas}h</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Horas por área */}
              <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '20px 24px', boxShadow: '0 2px 12px rgba(0,0,0,0.10)', border: '1px solid #d1d5db', marginTop: '24px' }}>
                <h3 style={{ fontSize: '13px', fontWeight: '700', color: '#1B2A4A', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Horas por área</h3>
                <p style={{ fontSize: '12px', color: '#9ca3af', margin: '0 0 16px' }}>Distribución del trabajo por área del despacho</p>
                <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '16px' }}>
                  {horasPorArea.length === 0 ? <p style={{ color: '#9ca3af', fontSize: '13px' }}>Sin datos para este período</p> : (
                    <div style={{ display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={horasPorArea} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                          <XAxis dataKey="nombre" tick={{ fontSize: 13, fill: '#6b7280' }} />
                          <YAxis tick={{ fontSize: 12, fill: '#9ca3af' }} />
                          <Tooltip formatter={(v) => [`${v}h`, 'Horas']} contentStyle={{ fontSize: '13px', borderRadius: '8px', border: '1px solid #e5e7eb' }} />
                          <Bar dataKey="horas" radius={[6, 6, 0, 0]}>
                            {horasPorArea.map((entry, index) => {
                              const blueScale = ['#1B2A4A', '#2563eb', '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe']
                              return <Cell key={index} fill={blueScale[index % blueScale.length]} />
                            })}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                {[
                  { label: 'Mis horas en el período', value: `${misHoras.total.toFixed(1)}h`, icon: '⏱', bg: '#1B2A4A', invertIcon: true },
                  { label: 'Clientes trabajados', value: misHoras.porCliente.length, icon: '🏢', bg: '#2E4A8C', invertIcon: false },
                ].map((kpi, i) => (
                  <div key={i} style={{ backgroundColor: kpi.bg, borderRadius: '16px', padding: '22px 24px', boxShadow: '0 4px 16px rgba(27,42,74,0.25)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                      <p style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.55)', margin: 0, textTransform: 'uppercase', letterSpacing: '1px' }}>{kpi.label}</p>
                      <span style={{ fontSize: '20px', opacity: 0.8, filter: kpi.invertIcon ? 'brightness(0) invert(1)' : 'none' }}>{kpi.icon}</span>
                    </div>
                    <p style={{ fontSize: '34px', fontWeight: '800', color: 'white', margin: 0, letterSpacing: '-1.5px', lineHeight: 1 }}>{kpi.value}</p>
                  </div>
                ))}
              </div>

              <div style={{ backgroundColor: 'white', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.10)', border: '1px solid #d1d5db' }}>
                <div style={{ padding: '20px 24px', borderBottom: '1px solid #f3f4f6' }}>
                  <h3 style={{ fontSize: '13px', fontWeight: '700', color: '#1B2A4A', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Mis horas por cliente</h3>
                </div>
                {misHoras.porCliente.length === 0 ? (
                  <p style={{ color: '#6b7280', fontSize: '13px', padding: '24px' }}>No hay registros en este período.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {misHoras.porCliente.map((c, i) => (
                      <div key={i} style={{ padding: '20px 24px', borderTop: i > 0 ? '1px solid #f3f4f6' : 'none' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                          <span style={{ fontSize: '14px', fontWeight: '700', color: '#1B2A4A' }}>{c.nombre}</span>
                          <span style={{ fontSize: '13px', fontWeight: '700', color: '#1B2A4A' }}>{c.misHoras}h mis horas</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                          {c.honorarios.map((h, j) => {
                            const porcentaje = h.presupuesto > 0 ? (h.totalDespacho / h.presupuesto * 100).toFixed(0) : null
                            const excede = porcentaje > 100
                            return (
                              <div key={j}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                  <span style={{ fontSize: '13px', color: '#374151', fontWeight: '500' }}>{h.nombre}</span>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ fontSize: '12px', color: '#6b7280' }}>Mis horas: <strong style={{ color: '#1B2A4A' }}>{h.misHoras}h</strong></span>
                                    {porcentaje !== null && (
                                      <span style={{ fontSize: '11px', padding: '2px 9px', borderRadius: '99px', fontWeight: '700', backgroundColor: excede ? '#fef2f2' : '#f0fdf4', color: excede ? '#dc2626' : '#16a34a' }}>
                                        {porcentaje}% de {h.presupuesto}h
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {porcentaje !== null && (
                                  <div style={{ width: '100%', backgroundColor: '#f3f4f6', borderRadius: '99px', height: '5px' }}>
                                    <div style={{ backgroundColor: excede ? '#dc2626' : '#16a34a', height: '5px', borderRadius: '99px', width: `${Math.min(parseFloat(porcentaje), 100)}%` }} />
                                  </div>
                                )}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                                  <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: '500' }}>Total despacho:</span>
                                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#374151' }}>{h.totalDespacho}h</span>
                                  {h.presupuesto > 0 && (
                                    <>
                                      <span style={{ fontSize: '11px', color: '#d1d5db' }}>/</span>
                                      <span style={{ fontSize: '12px', fontWeight: '700', color: '#6b7280' }}>{h.presupuesto}h presupuestado</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
