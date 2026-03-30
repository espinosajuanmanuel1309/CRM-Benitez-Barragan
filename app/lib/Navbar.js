'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from './supabase'
import Image from 'next/image'

export default function Sidebar({ rol, nombreUsuario }) {
  const [nombre, setNombre] = useState(nombreUsuario || '')
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (nombreUsuario) return
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('usuarios').select('nombre_completo').eq('id', user.id).single()
        .then(({ data }) => { if (data) setNombre(data.nombre_completo) })
    })
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const isActive = (path) => pathname === path

  return (
    <div style={{
      width: '240px',
      minWidth: '240px',
      backgroundColor: '#1B2A4A',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      position: 'fixed',
      top: 0,
      left: 0,
      bottom: 0,
      zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{
       padding: '5px 10px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer'
      }} onClick={() => router.push('/dashboard')}>
        <Image
            src="/logo-white.png"
            alt="BB&A"
            width={80}
            height={20}
            style={{ objectFit: 'contain' }}
        />
      </div>

      {/* Navegación */}
      <div style={{ flex: 1, padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>

        <SidebarSection label="Principal" />
        <SidebarItem label="Dashboard" icon="📊" path="/dashboard" isActive={isActive('/dashboard')} onClick={() => router.push('/dashboard')} />
        <SidebarItem label="Nuevo registro" icon="✏️" path="/registro" isActive={isActive('/registro')} onClick={() => router.push('/registro')} />
        <SidebarItem label="Registros" icon="📋" path="/mis-registros" isActive={isActive('/mis-registros')} onClick={() => router.push('/mis-registros')} />

        {rol === 'admin' && (
          <>
            <SidebarSection label="Análisis" />
            <SidebarItem label="Detalle cliente" icon="🔍" path="/admin/cliente-detalle" isActive={isActive('/admin/cliente-detalle')} onClick={() => router.push('/admin/cliente-detalle')} />

            <SidebarSection label="Administración" />
            <SidebarItem label="Clientes" icon="🏢" path="/admin/clientes" isActive={isActive('/admin/clientes')} onClick={() => router.push('/admin/clientes')} />
            <SidebarItem label="Usuarios" icon="👥" path="/admin/usuarios" isActive={isActive('/admin/usuarios')} onClick={() => router.push('/admin/usuarios')} />
            <SidebarItem label="Honorarios" icon="📁" path="/admin/honorarios" isActive={isActive('/admin/honorarios')} onClick={() => router.push('/admin/honorarios')} />
            <SidebarItem label="Presupuestos" icon="💰" path="/admin/presupuestos" isActive={isActive('/admin/presupuestos')} onClick={() => router.push('/admin/presupuestos')} />
          </>
        )}
      </div>

      {/* Usuario y logout */}
      <div style={{
        padding: '16px',
        borderTop: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ color: 'white', fontSize: '13px', fontWeight: '500', margin: 0 }}>{nombre}</p>
            <p style={{ color: '#64748b', fontSize: '11px', margin: 0 }}>{rol === 'admin' ? 'Administrador' : 'Usuario'}</p>
          </div>
          <button
            onClick={handleLogout}
            style={{
              backgroundColor: 'transparent',
              border: '1px solid rgba(255,255,255,0.15)',
              color: '#94a3b8',
              borderRadius: '6px',
              padding: '6px 10px',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            Salir
          </button>
        </div>
      </div>
    </div>
  )
}

function SidebarSection({ label }) {
  return (
    <p style={{
      color: '#d8dadd',
      fontSize: '10px',
      fontWeight: '700',
      letterSpacing: '1.5px',
      textTransform: 'uppercase',
      margin: '16px 8px 4px',
    }}>
      {label}
    </p>
  )
}

function SidebarItem({ label, icon, onClick, isActive }) {
  const [hover, setHover] = useState(false)

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '9px 12px',
        borderRadius: '8px',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        backgroundColor: isActive ? '#2E4A8C' : hover ? 'rgba(255,255,255,0.06)' : 'transparent',
        color: isActive ? 'white' : '#94a3b8',
        fontSize: '13px',
        fontWeight: isActive ? '600' : '400',
        transition: 'all 0.15s',
      }}
    >
      <span style={{ fontSize: '15px' }}>{icon}</span>
      {label}
    </button>
  )
}