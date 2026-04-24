'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function LoginPage() {
  const [correo, setCorreo] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) router.push('/dashboard')
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleLogin = async (e) => {
    e.preventDefault()
    setCargando(true)
    setError('')

    const { data, error } = await supabase.auth.signInWithPassword({
      email: correo,
      password: contrasena,
    })

    if (error) {
      setError('Correo o contraseña incorrectos')
      setCargando(false)
      return
    }

    router.push('/dashboard')
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', colorScheme: 'light' }}
      className="login-wrapper">

      <style>{`
        @media (min-width: 768px) {
          .login-wrapper { flex-direction: row !important; }
          .login-brand { width: 50% !important; padding: 48px !important; min-height: 100vh !important; }
          .login-form-panel { width: 50% !important; }
        }
      `}</style>

      {/* Panel izquierdo — azul marino */}
      <div className="login-brand" style={{
        backgroundColor: '#1B2A4A',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 32px',
      }}>
        <Image
          src="/logo-white.png"
          alt="BB&A Logo"
          width={220}
          height={220}
          style={{ marginBottom: '24px', maxWidth: '60vw', height: 'auto' }}
        />
        <h1 style={{ color: 'white', fontSize: '22px', fontWeight: '700', textAlign: 'center', marginBottom: '12px' }}>
          Benítez Barragán & Asociados
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '14px', textAlign: 'center', maxWidth: '280px', lineHeight: '1.6' }}>
          Plataforma interna de control de horas y gestión de clientes
        </p>
      </div>

      {/* Panel derecho — formulario */}
      <div className="login-form-panel" style={{
        backgroundColor: '#f4f6fa',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '40px',
          width: '100%',
          maxWidth: '400px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
        }}>
          <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#1B2A4A', marginBottom: '8px' }}>
            Iniciar sesión
          </h2>
          <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '28px' }}>
            Ingresa con tu cuenta del despacho
          </p>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>
                Correo
              </label>
              <input
                type="email"
                value={correo}
                onChange={e => setCorreo(e.target.value)}
                placeholder="tu@benitezbarragan.com"
                required
                style={{
                  width: '100%',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  fontSize: '14px',
                  backgroundColor: 'white',
                  color: '#1f2937',
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>
                Contraseña
              </label>
              <input
                type="password"
                value={contrasena}
                onChange={e => setContrasena(e.target.value)}
                placeholder="••••••••"
                required
                style={{
                  width: '100%',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  fontSize: '14px',
                  backgroundColor: 'white',
                  color: '#1f2937',
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              />
            </div>

            {error && (
              <p style={{ fontSize: '13px', color: '#dc2626', backgroundColor: '#fef2f2', padding: '10px 14px', borderRadius: '8px', border: '1px solid #fecaca' }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={cargando}
              style={{
                backgroundColor: cargando ? '#93a3b8' : '#1B2A4A',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '12px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: cargando ? 'not-allowed' : 'pointer',
                marginTop: '8px',
              }}
            >
              {cargando ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>

        <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '24px' }}>
          © 2026 Benítez Barragán & Asociados
        </p>
      </div>
    </div>
  )
}