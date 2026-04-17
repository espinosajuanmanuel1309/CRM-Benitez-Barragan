'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import { useAdmin } from '../../lib/useAdmin'
import Sidebar from '../../lib/Navbar'

export default function PresupuestosPage() {
  const [clientes, setClientes] = useState([])
  const [honorarios, setHonorarios] = useState([])
  const [presupuestos, setPresupuestos] = useState([])
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const anioActual = new Date().getFullYear()
  const [anio, setAnio] = useState(anioActual)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const router = useRouter()
  const { verificando } = useAdmin()

  useEffect(() => { cargarDatos() }, [])
  useEffect(() => { if (clienteSeleccionado) cargarPresupuestos() }, [clienteSeleccionado, anio])

  const cargarDatos = async () => {
    const [{ data: clientesData }, { data: honorariosData }] = await Promise.all([
      supabase.from('clientes').select('*').eq('activo', true).order('nombre'),
      supabase.from('honorarios').select('*').eq('activo', true).order('nombre')
    ])
    setClientes(clientesData || [])
    setHonorarios(honorariosData || [])
    setCargando(false)
  }

  const cargarPresupuestos = async () => {
    const { data } = await supabase.from('presupuestos').select('*').eq('cliente_id', clienteSeleccionado.id).eq('anio', anio)
    setPresupuestos(data || [])
  }

  const getHoras = (honorario_id) => {
    const p = presupuestos.find(p => p.honorario_id === honorario_id)
    return p ? p.horas_mes : 0
  }

  const handleGuardar = async (honorario_id, horas) => {
    setGuardando(true)
    setMensaje('')
    const existente = presupuestos.find(p => p.honorario_id === honorario_id)
    if (existente) {
      await supabase.from('presupuestos').update({ horas_mes: parseFloat(horas) }).eq('id', existente.id)
    } else {
      await supabase.from('presupuestos').insert({ cliente_id: clienteSeleccionado.id, honorario_id, horas_mes: parseFloat(horas), anio })
    }
    setMensaje('✅ Presupuesto guardado')
    cargarPresupuestos()
    setGuardando(false)
  }

  const clientesFiltrados = clientes.filter(c => c.nombre.toLowerCase().includes(busqueda.toLowerCase()))

  if (verificando) return null

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f4f6fa', colorScheme: 'light' }}>
      <Sidebar rol="admin" nombreUsuario="" />

      <div className="main-content" style={{ padding: '36px 40px' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h1 style={{ fontSize: '28px', fontWeight: '800', color: '#1B2A4A', margin: 0, letterSpacing: '-0.5px' }}>Presupuestos por Cliente</h1>
            <select
              value={anio}
              onChange={e => setAnio(parseInt(e.target.value))}
              style={{ border: '1px solid #d1d5db', borderRadius: '8px', padding: '7px 12px', fontSize: '13px', backgroundColor: 'white', color: '#1f2937' }}
            >
              {Array.from({ length: 5 }, (_, i) => anioActual - 2 + i).map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          {mensaje && (
            <div style={{ marginBottom: '16px', padding: '12px 16px', borderRadius: '8px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', fontSize: '13px' }}>
              {mensaje}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>

            {/* Lista de clientes */}
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#1B2A4A', marginBottom: '12px' }}>Clientes</h3>
              <input
                type="text"
                placeholder="Buscar cliente..."
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', marginBottom: '12px', backgroundColor: '#fafafa', color: '#1f2937', boxSizing: 'border-box' }}
              />
              <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.10)', border: '1px solid #d1d5db', overflow: 'hidden', maxHeight: '500px', overflowY: 'auto' }}>
                {clientesFiltrados.map((c, i) => (
                  <div
                    key={c.id}
                    onClick={() => setClienteSeleccionado(c)}
                    style={{
                      padding: '11px 16px', cursor: 'pointer',
                      borderTop: i === 0 ? 'none' : '1px solid #f3f4f6',
                      fontSize: '13px', color: '#374151',
                      backgroundColor: clienteSeleccionado?.id === c.id ? '#eff6ff' : 'white',
                      borderLeft: clienteSeleccionado?.id === c.id ? '4px solid #1B2A4A' : '4px solid transparent',
                      fontWeight: clienteSeleccionado?.id === c.id ? '600' : 'normal'
                    }}
                  >
                    {c.nombre}
                  </div>
                ))}
              </div>
            </div>

            {/* Presupuestos del cliente */}
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#1B2A4A', marginBottom: '12px' }}>
                {clienteSeleccionado ? `Presupuesto — ${clienteSeleccionado.nombre}` : 'Presupuestos'}
              </h3>
              <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.10)', border: '1px solid #d1d5db', overflow: 'hidden' }}>
                {!clienteSeleccionado ? (
                  <p style={{ padding: '16px', color: '#6b7280', fontSize: '13px' }}>Selecciona un cliente para ver sus presupuestos</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                      <tr>
                        <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '11px', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Honorario</th>
                        <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '11px', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Horas/mes</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {honorarios.map((h, i) => (
                        <PresupuestoRow
                          key={h.id}
                          honorario={h}
                          horas={getHoras(h.id)}
                          onGuardar={(horas) => handleGuardar(h.id, horas)}
                          guardando={guardando}
                          index={i}
                        />
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function PresupuestoRow({ honorario, horas, onGuardar, guardando, index }) {
  const [valor, setValor] = useState(horas)

  useEffect(() => { setValor(horas) }, [horas])

  return (
    <tr style={{ borderTop: '1px solid #f3f4f6' }}>
      <td style={{ padding: '10px 16px', fontSize: '13px', color: '#374151' }}>{honorario.nombre}</td>
      <td style={{ padding: '10px 16px' }}>
        <input
          type="number"
          value={valor}
          onChange={e => setValor(e.target.value)}
          min="0"
          step="0.5"
          style={{ width: '72px', border: '1px solid #d1d5db', borderRadius: '6px', padding: '5px 8px', fontSize: '13px', backgroundColor: 'white', color: '#1f2937' }}
        />
      </td>
      <td style={{ padding: '10px 16px' }}>
        <button
          onClick={() => onGuardar(valor)}
          disabled={guardando}
          style={{ fontSize: '12px', backgroundColor: '#1B2A4A', color: 'white', padding: '5px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', opacity: guardando ? 0.5 : 1 }}
        >
          Guardar
        </button>
      </td>
    </tr>
  )
}