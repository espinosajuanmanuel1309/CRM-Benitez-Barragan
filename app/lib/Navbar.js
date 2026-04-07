'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from './supabase'
import Image from 'next/image'

export default function Sidebar({ rol, nombreUsuario }) {
  const [nombre, setNombre] = useState(nombreUsuario || '')
  const [mobileOpen, setMobileOpen] = useState(false)
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

  // Cerrar sidebar al cambiar de ruta (móvil)
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const isActive = (path) => pathname === path

  const navigate = (path) => {
    router.push(path)
    setMobileOpen(false)
  }

  return (
    <>
      {/* Barra superior móvil */}
      <div className="mobile-topbar">
        <button
          onClick={() => setMobileOpen(true)}
          style={{
            backgroundColor: 'transparent',
            border: 'none',
            color: 'white',
            cursor: 'pointer',
            padding: '8px',
            display: 'flex',
            alignItems: 'center',
            borderRadius: '6px',
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        <div onClick={() => navigate('/dashboard')} style={{ cursor: 'pointer' }}>
          <Image
            src="/logo-white.png"
            alt="BB&A"
            width={70}
            height={22}
            style={{ objectFit: 'contain', display: 'block' }}
          />
        </div>

        {/* Espaciador derecho para centrar logo */}
        <div style={{ width: '38px' }} />
      </div>

      {/* Overlay oscuro al abrir el cajón en móvil */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.45)',
            zIndex: 150,
          }}
        />
      )}

      {/* Sidebar */}
      <div
        className={`sidebar-nav${mobileOpen ? ' sidebar-open' : ''}`}
        style={{
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
          zIndex: 160,
        }}
      >
        {/* Logo */}
        <div style={{
          padding: '5px 10px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }} onClick={() => navigate('/dashboard')}>
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
          <SidebarItem label="Dashboard" icon="📊" isActive={isActive('/dashboard')} onClick={() => navigate('/dashboard')} />
          <SidebarItem label="Nuevo registro" icon="✏️" isActive={isActive('/registro')} onClick={() => navigate('/registro')} />
          <SidebarItem label="Registros" icon="📋" isActive={isActive('/mis-registros')} onClick={() => navigate('/mis-registros')} />

          {rol === 'admin' && (
            <>
              <SidebarSection label="Análisis" />
              <SidebarItem label="Detalle cliente" icon="🔍" isActive={isActive('/admin/cliente-detalle')} onClick={() => navigate('/admin/cliente-detalle')} />

              <SidebarSection label="Administración" />
              <SidebarItem label="Clientes" icon="🏢" isActive={isActive('/admin/clientes')} onClick={() => navigate('/admin/clientes')} />
              <SidebarItem label="Usuarios" icon="👥" isActive={isActive('/admin/usuarios')} onClick={() => navigate('/admin/usuarios')} />
              <SidebarItem label="Honorarios" icon="📁" isActive={isActive('/admin/honorarios')} onClick={() => navigate('/admin/honorarios')} />
              <SidebarItem label="Presupuestos" icon="💰" isActive={isActive('/admin/presupuestos')} onClick={() => navigate('/admin/presupuestos')} />
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
    </>
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
