'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'
import Sidebar from '../lib/Navbar'

export default function RegistroPage() {
  const [clientes, setClientes] = useState([])
  const [honorarios, setHonorarios] = useState([])
  const [actividades, setActividades] = useState([])
  const [actividadesFiltradas, setActividadesFiltradas] = useState([])
  const [busquedaCliente, setBusquedaCliente] = useState('')
  const [mostrarListaClientes, setMostrarListaClientes] = useState(false)
  const [usuario, setUsuario] = useState(null)
  const [rol, setRol] = useState('')
  const [form, setForm] = useState({
    cliente_id: '',
    honorario_id: '',
    actividad_id: '',
    fecha_registro: new Date().toISOString().split('T')[0],
    horas: 0,
    minutos: 0,
    comentario: ''
  })
  const [cargando, setCargando] = useState(false)
  const [exito, setExito] = useState(false)
  const router = useRouter()

  useEffect(() => {
    inicializar()
  }, [])

  const inicializar = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: usuarioData } = await supabase.from('usuarios').select('*').eq('id', user.id).single()
    setUsuario(usuarioData)
    setRol(usuarioData?.rol || 'normal')
    cargarDatos()
  }

  useEffect(() => {
    if (form.cliente_id) {
      const cargarHonorarios = async () => {
        const { data } = await supabase
          .from('presupuestos')
          .select('honorario_id, honorarios(id, nombre)')
          .eq('cliente_id', parseInt(form.cliente_id))
        const honorariosFiltrados = data?.map(p => p.honorarios) || []
        setHonorarios(honorariosFiltrados)
        setForm(f => ({ ...f, honorario_id: '', actividad_id: '' }))
      }
      cargarHonorarios()
    }
  }, [form.cliente_id])

  useEffect(() => {
    if (form.honorario_id) {
      const filtradas = actividades.filter(
        a => a.honorario_id === parseInt(form.honorario_id)
      )
      setActividadesFiltradas(filtradas)
      setForm(f => ({ ...f, actividad_id: '' }))
    }
  }, [form.honorario_id, actividades])

  const cargarDatos = async () => {
    const [{ data: clientesData }, { data: actividadesData }] =
      await Promise.all([
        supabase.from('clientes').select('*').eq('activo', true).order('nombre'),
        supabase.from('actividades').select('*').eq('activo', true).order('nombre'),
      ])
    setClientes(clientesData || [])
    setActividades(actividadesData || [])
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  const minutosOpciones = Array.from({ length: 12 }, (_, i) => i * 5)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setCargando(true)
    setExito(false)

    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase.from('registros').insert({
      usuario_id: user.id,
      cliente_id: parseInt(form.cliente_id),
      honorario_id: parseInt(form.honorario_id),
      actividad_id: parseInt(form.actividad_id),
      fecha_registro: form.fecha_registro,
      horas: parseFloat(form.horas),
      minutos: parseInt(form.minutos),
      comentario: form.comentario
    })

    if (!error) {
      setExito(true)
      setBusquedaCliente('')
      setForm({
        cliente_id: '',
        honorario_id: '',
        actividad_id: '',
        fecha_registro: new Date().toISOString().split('T')[0],
        horas: 0,
        minutos: 0,
        comentario: ''
      })
    }
    setCargando(false)
  }

  const formatearFecha = (fecha) => {
    const [anio, mes, dia] = fecha.split('-')
    return `${dia}/${mes}/${anio}`
  }

  const clientesFiltrados = clientes.filter(c =>
    c.nombre.toLowerCase().includes(busquedaCliente.toLowerCase())
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f4f6fa', colorScheme: 'light' }}>
      <Sidebar rol={rol} nombreUsuario={usuario?.nombre_completo} />

      <div className="main-content" style={{ padding: '36px 40px' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>

          <h1 style={{ fontSize: '28px', fontWeight: '800', color: '#1B2A4A', marginBottom: '24px', letterSpacing: '-0.5px' }}>
            Nuevo Registro
          </h1>

          {exito && (
            <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', padding: '12px 16px', borderRadius: '10px', marginBottom: '16px', fontSize: '14px' }}>
              ✅ Registro guardado correctamente
            </div>
          )}

          <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 12px rgba(0,0,0,0.10)', border: '1px solid #d1d5db' }}>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>Fecha</label>
                <input
                  type="date"
                  name="fecha_registro"
                  value={form.fecha_registro}
                  onChange={handleChange}
                  required
                  style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '8px', padding: '9px 12px', fontSize: '14px', backgroundColor: 'white', color: '#1f2937', boxSizing: 'border-box' }}
                />
                {form.fecha_registro && (
                  <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>{formatearFecha(form.fecha_registro)}</p>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>Cliente</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="Escribe para buscar un cliente..."
                    value={busquedaCliente}
                    onChange={e => {
                      setBusquedaCliente(e.target.value)
                      setMostrarListaClientes(true)
                      setForm(f => ({ ...f, cliente_id: '', honorario_id: '', actividad_id: '' }))
                    }}
                    onFocus={() => setMostrarListaClientes(true)}
                    onBlur={() => setTimeout(() => setMostrarListaClientes(false), 150)}
                    style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '8px', padding: '9px 12px', fontSize: '14px', backgroundColor: 'white', color: '#1f2937', boxSizing: 'border-box' }}
                  />
                  {mostrarListaClientes && (
                    <div style={{ position: 'absolute', zIndex: 10, width: '100%', backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.1)', maxHeight: '240px', overflowY: 'auto', marginTop: '4px' }}>
                      {clientesFiltrados.length > 0 ? clientesFiltrados.map(c => (
                        <div
                          key={c.id}
                          onMouseDown={() => {
                            setForm(f => ({ ...f, cliente_id: c.id }))
                            setBusquedaCliente(c.nombre)
                            setMostrarListaClientes(false)
                          }}
                          style={{ padding: '9px 14px', fontSize: '13px', color: '#374151', cursor: 'pointer', borderBottom: '1px solid #f9fafb' }}
                          onMouseEnter={e => e.target.style.backgroundColor = '#eff6ff'}
                          onMouseLeave={e => e.target.style.backgroundColor = 'white'}
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
                  name="honorario_id"
                  value={form.honorario_id}
                  onChange={handleChange}
                  required
                  disabled={!form.cliente_id}
                  style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '8px', padding: '9px 12px', fontSize: '14px', backgroundColor: 'white', color: '#1f2937', boxSizing: 'border-box' }}
                >
                  <option value="">{form.cliente_id ? 'Selecciona un honorario' : 'Primero selecciona un cliente'}</option>
                  {honorarios.map(h => <option key={h.id} value={h.id}>{h.nombre}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>Actividad</label>
                <select
                  name="actividad_id"
                  value={form.actividad_id}
                  onChange={handleChange}
                  required
                  disabled={!form.honorario_id}
                  style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '8px', padding: '9px 12px', fontSize: '14px', backgroundColor: 'white', color: '#1f2937', boxSizing: 'border-box' }}
                >
                  <option value="">{form.honorario_id ? 'Selecciona una actividad' : 'Primero selecciona un honorario'}</option>
                  {actividadesFiltradas.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                </select>
              </div>

              <div className="notranslate" translate="no" style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>Horas</label>
                  <input
                    type="number"
                    name="horas"
                    value={form.horas}
                    onChange={(e) => setForm(prev => ({ ...prev, horas: e.currentTarget.value }))}
                    min="0"
                    max="24"
                    required
                    translate="no"
                    className="notranslate"
                    style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '8px', padding: '9px 12px', fontSize: '14px', backgroundColor: 'white', color: '#1f2937', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>Minutos</label>
                  <select
                    name="minutos"
                    value={form.minutos}
                    onChange={handleChange}
                    translate="no"
                    className="notranslate"
                    style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '8px', padding: '9px 12px', fontSize: '14px', backgroundColor: 'white', color: '#1f2937', boxSizing: 'border-box' }}
                  >
                    {minutosOpciones.map(m => (
                      <option key={m} value={m}>{m.toString().padStart(2, '0')}</option>
                    ))}
                  </select>
                </div>
              </div>

              {(parseFloat(form.horas) > 0 || parseFloat(form.minutos) > 0) && (
                <p className="notranslate" translate="no" style={{ fontSize: '13px', fontWeight: '600', color: '#1B2A4A' }}>
                  Total: {(parseFloat(form.horas) + parseFloat(form.minutos) / 60).toFixed(2).replace(',', '.')} horas
                </p>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>Comentario (opcional)</label>
                <textarea
                  name="comentario"
                  value={form.comentario}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Describe brevemente el trabajo realizado..."
                  style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '8px', padding: '9px 12px', fontSize: '14px', backgroundColor: 'white', color: '#1f2937', boxSizing: 'border-box', resize: 'vertical' }}
                />
              </div>

              <button
                type="submit"
                disabled={cargando}
                style={{ backgroundColor: cargando ? '#93a3b8' : '#1B2A4A', color: 'white', border: 'none', borderRadius: '8px', padding: '11px', fontSize: '14px', fontWeight: '600', cursor: cargando ? 'not-allowed' : 'pointer' }}
              >
                {cargando ? 'Guardando...' : 'Guardar registro'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}