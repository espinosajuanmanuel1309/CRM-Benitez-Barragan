'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import { useAdmin } from '../../lib/useAdmin'
import Sidebar from '../../lib/Navbar'

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm] = useState({ nombre_completo: '', correo: '', contrasena: '', rol: 'normal' })
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')
  const [verContrasena, setVerContrasena] = useState(false)
  const [usuarioEditando, setUsuarioEditando] = useState(null)
  const [guardandoEdicion, setGuardandoEdicion] = useState(false)
  const router = useRouter()
  const { verificando } = useAdmin()

  useEffect(() => { cargarUsuarios() }, [])

  const cargarUsuarios = async () => {
    const { data } = await supabase.from('usuarios').select('*').order('nombre_completo')
    setUsuarios(data || [])
    setCargando(false)
  }

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleGuardar = async (e) => {
    e.preventDefault()
    setGuardando(true)
    setMensaje('')
    setError('')
    const response = await fetch('/api/crear-usuario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    })
    const data = await response.json()
    if (!response.ok) {
      setError('❌ Error: ' + data.error)
    } else {
      setMensaje('✅ Usuario creado correctamente')
      setForm({ nombre_completo: '', correo: '', contrasena: '', rol: 'normal' })
      setMostrarForm(false)
      cargarUsuarios()
    }
    setGuardando(false)
  }

  const handleToggleActivo = async (usuario) => {
    await supabase.from('usuarios').update({ activo: !usuario.activo }).eq('id', usuario.id)
    cargarUsuarios()
  }

  const handleAbrirEditar = (usuario) => {
    if (usuarioEditando?.id === usuario.id) {
      setUsuarioEditando(null)
      return
    }
    setUsuarioEditando({ ...usuario })
  }

  const handleGuardarEdicion = async () => {
    setGuardandoEdicion(true)
    const { error: err } = await supabase
      .from('usuarios')
      .update({
        nombre_completo: usuarioEditando.nombre_completo,
        correo: usuarioEditando.correo,
        rol: usuarioEditando.rol,
      })
      .eq('id', usuarioEditando.id)
    if (err) {
      setError('❌ Error al actualizar: ' + err.message)
    } else {
      setMensaje('✅ Usuario actualizado correctamente')
      setUsuarioEditando(null)
      cargarUsuarios()
    }
    setGuardandoEdicion(false)
  }

  const inputStyle = { width: '100%', border: '1px solid #d1d5db', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', backgroundColor: 'white', color: '#1f2937', boxSizing: 'border-box' }

  if (verificando) return null

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f4f6fa', colorScheme: 'light' }}>
      <Sidebar rol="admin" nombreUsuario="" />

      <div className="main-content" style={{ padding: '36px 40px' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h1 style={{ fontSize: '28px', fontWeight: '800', color: '#1B2A4A', margin: 0, letterSpacing: '-0.5px' }}>Usuarios</h1>
            <button
              onClick={() => setMostrarForm(!mostrarForm)}
              style={{ backgroundColor: '#1B2A4A', color: 'white', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
            >
              + Nuevo usuario
            </button>
          </div>

          {mensaje && (
            <div style={{ marginBottom: '16px', padding: '12px 16px', borderRadius: '8px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', fontSize: '13px' }}>
              {mensaje}
            </div>
          )}

          {error && (
            <div style={{ marginBottom: '16px', padding: '12px 16px', borderRadius: '8px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: '13px' }}>
              {error}
            </div>
          )}

          {mostrarForm && (
            <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', marginBottom: '24px', boxShadow: '0 2px 12px rgba(0,0,0,0.10)', border: '1px solid #d1d5db' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '600', color: '#1B2A4A', marginBottom: '16px' }}>Nuevo usuario</h3>
              <form onSubmit={handleGuardar} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>Nombre completo</label>
                  <input type="text" name="nombre_completo" value={form.nombre_completo} onChange={handleChange} style={inputStyle} required />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>Correo</label>
                  <input type="email" name="correo" value={form.correo} onChange={handleChange} placeholder="nombre@benitezbarragan.com" style={inputStyle} required />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>Contraseña</label>
                  <div style={{ position: 'relative' }}>
                    <input type={verContrasena ? 'text' : 'password'} name="contrasena" value={form.contrasena} onChange={handleChange} placeholder="Mínimo 6 caracteres" style={{ ...inputStyle, paddingRight: '36px' }} required />
                    <button type="button" onClick={() => setVerContrasena(v => !v)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '16px', lineHeight: 1, padding: 0 }}>
                      {verContrasena ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>Rol</label>
                  <select name="rol" value={form.rol} onChange={handleChange} style={inputStyle}>
                    <option value="normal">Normal</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button type="submit" disabled={guardando} style={{ backgroundColor: '#1B2A4A', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 20px', fontSize: '13px', cursor: 'pointer', opacity: guardando ? 0.5 : 1 }}>
                    {guardando ? 'Creando usuario...' : 'Crear usuario'}
                  </button>
                  <button type="button" onClick={() => setMostrarForm(false)} style={{ backgroundColor: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '8px', padding: '8px 20px', fontSize: '13px', cursor: 'pointer' }}>
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          )}

          {cargando ? (
            <p style={{ color: '#6b7280' }}>Cargando usuarios...</p>
          ) : (
            <div style={{ backgroundColor: 'white', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.10)', border: '1px solid #d1d5db' }}>
              <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '520px' }}>
                <thead style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  <tr>
                    {['Nombre', 'Correo', 'Rol', 'Estado', 'Acciones'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: '11px', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map((u) => (
                    <>
                      <tr key={u.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '12px 16px', fontSize: '13px', color: '#374151' }}>{u.nombre_completo}</td>
                        <td style={{ padding: '12px 16px', fontSize: '13px', color: '#374151' }}>{u.correo}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ padding: '3px 10px', borderRadius: '99px', fontSize: '11px', fontWeight: '600', backgroundColor: u.rol === 'admin' ? '#f3e8ff' : '#f3f4f6', color: u.rol === 'admin' ? '#7c3aed' : '#374151' }}>
                            {u.rol === 'admin' ? 'Admin' : 'Normal'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ padding: '3px 10px', borderRadius: '99px', fontSize: '11px', fontWeight: '600', backgroundColor: u.activo ? '#dcfce7' : '#fee2e2', color: u.activo ? '#16a34a' : '#dc2626' }}>
                            {u.activo ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              onClick={() => handleAbrirEditar(u)}
                              style={{ fontSize: '12px', padding: '5px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', backgroundColor: usuarioEditando?.id === u.id ? '#1B2A4A' : '#eff6ff', color: usuarioEditando?.id === u.id ? 'white' : '#1d4ed8' }}
                            >
                              {usuarioEditando?.id === u.id ? 'Cerrar' : 'Editar'}
                            </button>
                            <button
                              onClick={() => handleToggleActivo(u)}
                              style={{ fontSize: '12px', padding: '5px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', backgroundColor: u.activo ? '#fef2f2' : '#f0fdf4', color: u.activo ? '#dc2626' : '#16a34a' }}
                            >
                              {u.activo ? 'Desactivar' : 'Activar'}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {usuarioEditando?.id === u.id && (
                        <tr key={`edit-${u.id}`}>
                          <td colSpan={5} style={{ padding: '16px 20px', backgroundColor: '#eff6ff', borderLeft: '4px solid #1B2A4A', borderTop: '1px solid #bfdbfe' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '12px' }}>
                              <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#374151', marginBottom: '5px' }}>Nombre completo</label>
                                <input
                                  type="text"
                                  value={usuarioEditando.nombre_completo}
                                  onChange={e => setUsuarioEditando({ ...usuarioEditando, nombre_completo: e.target.value })}
                                  style={inputStyle}
                                />
                              </div>
                              <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#374151', marginBottom: '5px' }}>Correo</label>
                                <input
                                  type="email"
                                  value={usuarioEditando.correo}
                                  onChange={e => setUsuarioEditando({ ...usuarioEditando, correo: e.target.value })}
                                  style={inputStyle}
                                />
                              </div>
                              <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#374151', marginBottom: '5px' }}>Rol</label>
                                <select
                                  value={usuarioEditando.rol}
                                  onChange={e => setUsuarioEditando({ ...usuarioEditando, rol: e.target.value })}
                                  style={inputStyle}
                                >
                                  <option value="normal">Normal</option>
                                  <option value="admin">Administrador</option>
                                </select>
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                onClick={handleGuardarEdicion}
                                disabled={guardandoEdicion}
                                style={{ backgroundColor: '#1B2A4A', color: 'white', border: 'none', borderRadius: '8px', padding: '7px 18px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', opacity: guardandoEdicion ? 0.5 : 1 }}
                              >
                                {guardandoEdicion ? 'Guardando...' : 'Guardar cambios'}
                              </button>
                              <button
                                onClick={() => setUsuarioEditando(null)}
                                style={{ backgroundColor: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: '8px', padding: '7px 18px', fontSize: '13px', cursor: 'pointer' }}
                              >
                                Cancelar
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
