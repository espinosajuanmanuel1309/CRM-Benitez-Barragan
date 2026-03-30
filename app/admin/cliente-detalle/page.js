'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import { useAdmin } from '../../lib/useAdmin'
import Sidebar from '../../lib/Navbar'

export default function ClienteDetallePage() {
  const { verificando } = useAdmin()
  const [clientes, setClientes] = useState([])
  const [clienteSeleccionado, setClienteSeleccionado] = useState('')
  const [busquedaCliente, setBusquedaCliente] = useState('')
  const [mostrarLista, setMostrarLista] = useState(false)
  const [mes, setMes] = useState(new Date().getMonth() + 1)
  const [anio, setAnio] = useState(new Date().getFullYear())
  const [detalle, setDetalle] = useState([])
  const [totalHoras, setTotalHoras] = useState(0)
  const [cargando, setCargando] = useState(false)
  const [clienteNombre, setClienteNombre] = useState('')
  const router = useRouter()

  const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

  useEffect(() => { cargarClientes() }, [])

  const cargarClientes = async () => {
    const { data } = await supabase.from('clientes').select('*').eq('activo', true).order('nombre')
    setClientes(data || [])
  }

  const cargarDetalle = async (clienteId, mesNum, anioNum) => {
    setCargando(true)
    const primerDia = `${anioNum}-${String(mesNum).padStart(2, '0')}-01`
    const ultimoDia = new Date(anioNum, mesNum, 0).toISOString().split('T')[0]

    const [{ data: registros }, { data: presupuestos }] = await Promise.all([
      supabase.from('registros').select('*, honorarios(id, nombre), usuarios(nombre_completo)').eq('cliente_id', clienteId).gte('fecha_registro', primerDia).lte('fecha_registro', ultimoDia),
      supabase.from('presupuestos').select('*, honorarios(id, nombre)').eq('cliente_id', clienteId).eq('anio', anioNum)
    ])

    const porHonorario = {}
    registros?.forEach(r => {
      const hId = r.honorarios?.id
      const hNombre = r.honorarios?.nombre || 'Sin honorario'
      if (!porHonorario[hId]) porHonorario[hId] = { honorario: hNombre, honorario_id: hId, totalHoras: 0, asociados: {} }
      const horas = r.horas + r.minutos / 60
      porHonorario[hId].totalHoras += horas
      const asociado = r.usuarios?.nombre_completo || 'Sin nombre'
      porHonorario[hId].asociados[asociado] = (porHonorario[hId].asociados[asociado] || 0) + horas
    })

    presupuestos?.forEach(p => {
      const hId = p.honorarios?.id
      if (porHonorario[hId]) porHonorario[hId].presupuesto = p.horas_mes
      else if (p.horas_mes > 0) porHonorario[hId] = { honorario: p.honorarios?.nombre, honorario_id: hId, totalHoras: 0, asociados: {}, presupuesto: p.horas_mes }
    })

    const detalleArray = Object.values(porHonorario).filter(h => h.totalHoras > 0).sort((a, b) => b.totalHoras - a.totalHoras)
    setDetalle(detalleArray)
    setTotalHoras(detalleArray.reduce((acc, h) => acc + h.totalHoras, 0))
    setCargando(false)
  }

  const handleSeleccionarCliente = (cliente) => {
    setClienteSeleccionado(cliente.id)
    setClienteNombre(cliente.nombre)
    setBusquedaCliente(cliente.nombre)
    setMostrarLista(false)
    cargarDetalle(cliente.id, mes, anio)
  }

  const handleCambiarPeriodo = () => {
    if (clienteSeleccionado) cargarDetalle(clienteSeleccionado, mes, anio)
  }

  const clientesFiltrados = clientes.filter(c => c.nombre.toLowerCase().includes(busquedaCliente.toLowerCase()))

  if (verificando) return null

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f4f6fa', colorScheme: 'light' }}>
      <Sidebar rol="admin" nombreUsuario="" />

      <div style={{ marginLeft: '240px', flex: 1, padding: '36px 40px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>

          <h1 style={{ fontSize: '28px', fontWeight: '800', color: '#1B2A4A', marginBottom: '24px', letterSpacing: '-0.5px' }}>Detalle por Cliente</h1>

          {/* Filtros */}
          <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '20px', marginBottom: '24px', boxShadow: '0 2px 12px rgba(0,0,0,0.10)', border: '1px solid #d1d5db' }}>
            <p style={{ fontSize: '11px', fontWeight: '700', color: '#9ca3af', letterSpacing: '1px', textTransform: 'uppercase', margin: '0 0 14px' }}>FILTROS</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end' }}>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#6b7280', marginBottom: '4px' }}>Cliente</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="Buscar cliente..."
                    value={busquedaCliente}
                    onChange={e => { setBusquedaCliente(e.target.value); setMostrarLista(true) }}
                    onFocus={() => setMostrarLista(true)}
                    onBlur={() => setTimeout(() => setMostrarLista(false), 150)}
                    style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', backgroundColor: '#fafafa', color: '#1f2937', boxSizing: 'border-box' }}
                  />
                  {mostrarLista && (
                    <div style={{ position: 'absolute', zIndex: 10, width: '100%', backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.1)', maxHeight: '210px', overflowY: 'auto', marginTop: '4px' }}>
                      {clientesFiltrados.map(c => (
                        <div
                          key={c.id}
                          onMouseDown={() => handleSeleccionarCliente(c)}
                          style={{ padding: '9px 14px', fontSize: '13px', color: '#374151', cursor: 'pointer', borderBottom: '1px solid #f9fafb' }}
                          onMouseEnter={e => e.currentTarget.style.backgroundColor = '#eff6ff'}
                          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'white'}
                        >
                          {c.nombre}
                        </div>
                      ))}
                      {clientesFiltrados.length === 0 && (
                        <p style={{ padding: '9px 14px', fontSize: '13px', color: '#9ca3af' }}>No se encontró ningún cliente</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#6b7280', marginBottom: '4px' }}>Mes</label>
                <select value={mes} onChange={e => setMes(parseInt(e.target.value))} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', backgroundColor: '#fafafa', color: '#1f2937' }}>
                  {meses.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#6b7280', marginBottom: '4px' }}>Año</label>
                <select value={anio} onChange={e => setAnio(parseInt(e.target.value))} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', backgroundColor: '#fafafa', color: '#1f2937' }}>
                  <option value={2025}>2025</option>
                  <option value={2026}>2026</option>
                  <option value={2027}>2027</option>
                </select>
              </div>
              <button
                onClick={handleCambiarPeriodo}
                disabled={!clienteSeleccionado}
                style={{ backgroundColor: '#1B2A4A', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 18px', fontSize: '13px', cursor: clienteSeleccionado ? 'pointer' : 'not-allowed', opacity: clienteSeleccionado ? 1 : 0.5 }}
              >
                Ver detalle
              </button>
            </div>
          </div>

          {/* Detalle */}
          {cargando ? (
            <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '40px', textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.10)', border: '1px solid #d1d5db' }}>
              <p style={{ color: '#6b7280' }}>Cargando detalle...</p>
            </div>
          ) : !clienteSeleccionado ? (
            <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '40px', textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.10)', border: '1px solid #d1d5db' }}>
              <p style={{ color: '#9ca3af' }}>Selecciona un cliente para ver su detalle</p>
            </div>
          ) : detalle.length === 0 ? (
            <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '40px', textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.10)', border: '1px solid #d1d5db' }}>
              <p style={{ color: '#9ca3af' }}>No hay registros para {clienteNombre} en {meses[mes - 1]} {anio}</p>
            </div>
          ) : (
            <div style={{ backgroundColor: 'white', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.10)', border: '1px solid #d1d5db' }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid #f3f4f6' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1B2A4A', margin: 0 }}>{clienteNombre}</h3>
                <p style={{ fontSize: '13px', color: '#6b7280', margin: '4px 0 0' }}>{meses[mes - 1]} {anio}</p>
              </div>

              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {detalle.map((h, i) => {
                  const porcentaje = h.presupuesto > 0 ? (h.totalHoras / h.presupuesto * 100).toFixed(0) : null
                  const excede = porcentaje > 100

                  return (
                    <div key={i}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontSize: '14px', fontWeight: '600', color: '#1B2A4A' }}>{h.honorario}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ fontSize: '15px', fontWeight: '700', color: '#1B2A4A' }}>{h.totalHoras.toFixed(2)}h</span>
                          {h.presupuesto > 0 && (
                            <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '99px', fontWeight: '600', backgroundColor: excede ? '#fef2f2' : '#f0fdf4', color: excede ? '#dc2626' : '#16a34a' }}>
                              {porcentaje}% de {h.presupuesto}h
                            </span>
                          )}
                        </div>
                      </div>

                      {h.presupuesto > 0 && (
                        <div style={{ width: '100%', backgroundColor: '#f3f4f6', borderRadius: '99px', height: '6px', marginBottom: '10px' }}>
                          <div style={{ backgroundColor: excede ? '#dc2626' : '#1B2A4A', height: '6px', borderRadius: '99px', width: `${Math.min(parseFloat(porcentaje), 100)}%` }} />
                        </div>
                      )}

                      <div style={{ marginLeft: '16px' }}>
                        {Object.entries(h.asociados).sort((a, b) => b[1] - a[1]).map(([nombre, horas], j) => (
                          <div key={j} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f9fafb' }}>
                            <span style={{ fontSize: '13px', color: '#6b7280' }}>{nombre}</span>
                            <span style={{ fontSize: '13px', fontWeight: '600', color: '#2E4A8C' }}>{horas.toFixed(2)}h</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>

              <div style={{ padding: '16px 24px', backgroundColor: '#f9fafb', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '14px', fontWeight: '700', color: '#1B2A4A' }}>Total</span>
                <span style={{ fontSize: '20px', fontWeight: '700', color: '#1B2A4A' }}>{totalHoras.toFixed(2)}h</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}