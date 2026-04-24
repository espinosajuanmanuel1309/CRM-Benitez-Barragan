'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import { useAdmin } from '../../lib/useAdmin'
import Sidebar from '../../lib/Navbar'

export default function HonorariosPage() {
  const [honorarios, setHonorarios] = useState([])
  const [actividades, setActividades] = useState([])
  const [cargando, setCargando] = useState(true)
  const [honorarioSeleccionado, setHonorarioSeleccionado] = useState(null)
  const [mostrarFormHonorario, setMostrarFormHonorario] = useState(false)
  const [mostrarFormActividad, setMostrarFormActividad] = useState(false)
  const [formHonorario, setFormHonorario] = useState({ nombre: '' })
  const [formActividad, setFormActividad] = useState({ nombre: '' })
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const router = useRouter()
  const { verificando } = useAdmin()

  const cargarDatos = async () => {
    const [{ data: honorariosData }, { data: actividadesData }] = await Promise.all([
      supabase.from('honorarios').select('*').order('nombre'),
      supabase.from('actividades').select('*').order('nombre')
    ])
    setHonorarios(honorariosData || [])
    setActividades(actividadesData || [])
    setCargando(false)
  }

  useEffect(() => { cargarDatos() }, []) // eslint-disable-line react-hooks/set-state-in-effect

  const handleGuardarHonorario = async (e) => {
    e.preventDefault()
    setGuardando(true)
    const { error } = await supabase.from('honorarios').insert({ nombre: formHonorario.nombre, activo: true })
    if (!error) {
      setMensaje('✅ Honorario agregado')
      setFormHonorario({ nombre: '' })
      setMostrarFormHonorario(false)
      cargarDatos()
    }
    setGuardando(false)
  }

  const handleGuardarActividad = async (e) => {
    e.preventDefault()
    setGuardando(true)
    const { error } = await supabase.from('actividades').insert({
      nombre: formActividad.nombre,
      honorario_id: honorarioSeleccionado.id,
      activo: true
    })
    if (!error) {
      setMensaje('✅ Actividad agregada')
      setFormActividad({ nombre: '' })
      setMostrarFormActividad(false)
      cargarDatos()
    }
    setGuardando(false)
  }

  const handleToggleHonorario = async (honorario) => {
    await supabase.from('honorarios').update({ activo: !honorario.activo }).eq('id', honorario.id)
    cargarDatos()
  }

  const handleToggleActividad = async (actividad) => {
    await supabase.from('actividades').update({ activo: !actividad.activo }).eq('id', actividad.id)
    cargarDatos()
  }

  const actividadesDelHonorario = honorarioSeleccionado
    ? actividades.filter(a => a.honorario_id === honorarioSeleccionado.id)
    : []

  const inputStyle = { width: '100%', border: '1px solid #d1d5db', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', backgroundColor: 'white', color: '#1f2937', boxSizing: 'border-box' }

  if (verificando) return null

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f4f6fa', colorScheme: 'light' }}>
      <Sidebar rol="admin" nombreUsuario="" />

      <div className="main-content" style={{ padding: '36px 40px' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>

          <h1 style={{ fontSize: '28px', fontWeight: '800', color: '#1B2A4A', marginBottom: '24px', letterSpacing: '-0.5px' }}>Honorarios y Actividades</h1>

          {mensaje && (
            <div style={{ marginBottom: '16px', padding: '12px 16px', borderRadius: '8px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', fontSize: '13px' }}>
              {mensaje}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>

            {/* Honorarios */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#1B2A4A' }}>Honorarios</h3>
                <button
                  onClick={() => setMostrarFormHonorario(!mostrarFormHonorario)}
                  style={{ backgroundColor: '#1B2A4A', color: 'white', border: 'none', borderRadius: '6px', padding: '5px 12px', fontSize: '12px', cursor: 'pointer' }}
                >
                  + Nuevo
                </button>
              </div>

              {mostrarFormHonorario && (
                <form onSubmit={handleGuardarHonorario} style={{ backgroundColor: 'white', borderRadius: '12px', padding: '16px', marginBottom: '12px', boxShadow: '0 2px 12px rgba(0,0,0,0.10)', border: '1px solid #d1d5db', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <input
                    type="text"
                    placeholder="Nombre del honorario"
                    value={formHonorario.nombre}
                    onChange={e => setFormHonorario({ nombre: e.target.value })}
                    style={inputStyle}
                    required
                  />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="submit" disabled={guardando} style={{ backgroundColor: '#1B2A4A', color: 'white', border: 'none', borderRadius: '6px', padding: '6px 14px', fontSize: '12px', cursor: 'pointer', opacity: guardando ? 0.5 : 1 }}>
                      Guardar
                    </button>
                    <button type="button" onClick={() => setMostrarFormHonorario(false)} style={{ backgroundColor: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '6px', padding: '6px 14px', fontSize: '12px', cursor: 'pointer' }}>
                      Cancelar
                    </button>
                  </div>
                </form>
              )}

              <div style={{ backgroundColor: 'white', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.10)', border: '1px solid #d1d5db' }}>
                {cargando ? (
                  <p style={{ padding: '16px', color: '#6b7280', fontSize: '13px' }}>Cargando...</p>
                ) : (
                  honorarios.map((h, i) => (
                    <div
                      key={h.id}
                      onClick={() => { setHonorarioSeleccionado(h); setMostrarFormActividad(false) }}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '11px 16px', cursor: 'pointer',
                        borderTop: i === 0 ? 'none' : '1px solid #f3f4f6',
                        borderLeft: honorarioSeleccionado?.id === h.id ? '4px solid #1B2A4A' : '4px solid transparent',
                        backgroundColor: honorarioSeleccionado?.id === h.id ? '#eff6ff' : 'white',
                        transition: 'all 0.1s'
                      }}
                    >
                      <span style={{ fontSize: '13px', color: h.activo ? '#374151' : '#9ca3af', textDecoration: h.activo ? 'none' : 'line-through' }}>
                        {h.nombre}
                      </span>
                      <button
                        onClick={e => { e.stopPropagation(); handleToggleHonorario(h) }}
                        style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', marginLeft: '8px', backgroundColor: h.activo ? '#fef2f2' : '#f0fdf4', color: h.activo ? '#dc2626' : '#16a34a' }}
                      >
                        {h.activo ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Actividades */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#1B2A4A' }}>
                  {honorarioSeleccionado ? `Actividades — ${honorarioSeleccionado.nombre}` : 'Actividades'}
                </h3>
                {honorarioSeleccionado && (
                  <button
                    onClick={() => setMostrarFormActividad(!mostrarFormActividad)}
                    style={{ backgroundColor: '#1B2A4A', color: 'white', border: 'none', borderRadius: '6px', padding: '5px 12px', fontSize: '12px', cursor: 'pointer' }}
                  >
                    + Nueva
                  </button>
                )}
              </div>

              {mostrarFormActividad && (
                <form onSubmit={handleGuardarActividad} style={{ backgroundColor: 'white', borderRadius: '12px', padding: '16px', marginBottom: '12px', boxShadow: '0 2px 12px rgba(0,0,0,0.10)', border: '1px solid #d1d5db', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <input
                    type="text"
                    placeholder="Nombre de la actividad"
                    value={formActividad.nombre}
                    onChange={e => setFormActividad({ nombre: e.target.value })}
                    style={inputStyle}
                    required
                  />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="submit" disabled={guardando} style={{ backgroundColor: '#1B2A4A', color: 'white', border: 'none', borderRadius: '6px', padding: '6px 14px', fontSize: '12px', cursor: 'pointer', opacity: guardando ? 0.5 : 1 }}>
                      Guardar
                    </button>
                    <button type="button" onClick={() => setMostrarFormActividad(false)} style={{ backgroundColor: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '6px', padding: '6px 14px', fontSize: '12px', cursor: 'pointer' }}>
                      Cancelar
                    </button>
                  </div>
                </form>
              )}

              <div style={{ backgroundColor: 'white', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.10)', border: '1px solid #d1d5db' }}>
                {!honorarioSeleccionado ? (
                  <p style={{ padding: '16px', color: '#6b7280', fontSize: '13px' }}>Selecciona un honorario para ver sus actividades</p>
                ) : actividadesDelHonorario.length === 0 ? (
                  <p style={{ padding: '16px', color: '#6b7280', fontSize: '13px' }}>No hay actividades para este honorario</p>
                ) : (
                  actividadesDelHonorario.map((a, i) => (
                    <div key={a.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '11px 16px',
                      borderTop: i === 0 ? 'none' : '1px solid #f3f4f6',
                      backgroundColor: 'white'
                    }}>
                      <span style={{ fontSize: '13px', color: a.activo ? '#374151' : '#9ca3af', textDecoration: a.activo ? 'none' : 'line-through' }}>
                        {a.nombre}
                      </span>
                      <button
                        onClick={() => handleToggleActividad(a)}
                        style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', marginLeft: '8px', backgroundColor: a.activo ? '#fef2f2' : '#f0fdf4', color: a.activo ? '#dc2626' : '#16a34a' }}
                      >
                        {a.activo ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}