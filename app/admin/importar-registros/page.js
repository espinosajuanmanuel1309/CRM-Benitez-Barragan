'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../../lib/supabase'
import { useAdmin } from '../../lib/useAdmin'
import Sidebar from '../../lib/Navbar'

const COLUMNAS_REQUERIDAS = [
  'Cliente Nombre',
  'Actividad',
  'Asociado',
  'Horas Total',
  'Fecha',
  'Honorario Nombre',
]

const ALIAS_USUARIOS = {
  'juan manuel': 'juan manuel espinosa cardenas',
  'juan sandoval': 'juan pablo sandoval',
}

const ALIAS_HONORARIOS = {
  'honorarios por asesoria de juridica': 'honorarios por asesoria juridica',
}

function normalizar(valor) {
  return String(valor || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,;:'"!?¿¡()]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function valorTexto(row, columna) {
  return String(row[columna] ?? '').trim()
}

function parseFecha(valor) {
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    return valor.toISOString().split('T')[0]
  }

  const texto = String(valor || '').trim()
  const partes = texto.split(/[/-]/).map(Number)
  if (partes.length !== 3 || partes.some(Number.isNaN)) return null

  const [dia, mes, anioRaw] = partes
  const anio = anioRaw < 100 ? 2000 + anioRaw : anioRaw
  if (dia < 1 || dia > 31 || mes < 1 || mes > 12 || anio < 2000) return null

  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

function parseHoras(valor) {
  const numero = parseFloat(String(valor || '').replace(',', '.'))
  if (!Number.isFinite(numero) || numero < 0) return null
  const totalMinutos = Math.round(numero * 60)
  return {
    horas: Math.floor(totalMinutos / 60),
    minutos: totalMinutos % 60,
    decimal: totalMinutos / 60,
  }
}

function crearMapa(items, campo) {
  const mapa = new Map()
  items.forEach(item => mapa.set(normalizar(item[campo]), item))
  return mapa
}

export default function ImportarRegistrosPage() {
  const { verificando } = useAdmin()
  const fileInputRef = useRef(null)
  const [catalogos, setCatalogos] = useState({ usuarios: [], clientes: [], honorarios: [], actividades: [] })
  const [filas, setFilas] = useState([])
  const [archivoNombre, setArchivoNombre] = useState('')
  const [erroresArchivo, setErroresArchivo] = useState([])
  const [importando, setImportando] = useState(false)
  const [resultado, setResultado] = useState(null)

  useEffect(() => {
    let activo = true

    Promise.all([
      supabase.from('usuarios').select('id, nombre_completo, activo').order('nombre_completo'),
      supabase.from('clientes').select('id, nombre, activo').eq('activo', true).order('nombre'),
      supabase.from('honorarios').select('id, nombre, activo').eq('activo', true).order('nombre'),
      supabase.from('actividades').select('id, nombre, honorario_id, activo').eq('activo', true).order('nombre'),
    ]).then(([{ data: usuarios }, { data: clientes }, { data: honorarios }, { data: actividades }]) => {
      if (!activo) return
      setCatalogos({
        usuarios: usuarios || [],
        clientes: clientes || [],
        honorarios: honorarios || [],
        actividades: actividades || [],
      })
    })

    return () => { activo = false }
  }, [])

  const preview = useMemo(() => {
    if (filas.length === 0) return null

    const usuariosMap = crearMapa(catalogos.usuarios, 'nombre_completo')
    const clientesMap = crearMapa(catalogos.clientes, 'nombre')
    const honorariosMap = crearMapa(catalogos.honorarios, 'nombre')
    const actividadesPorHonorario = new Map()

    catalogos.actividades.forEach(actividad => {
      actividadesPorHonorario.set(`${actividad.honorario_id}:${normalizar(actividad.nombre)}`, actividad)
    })

    const importables = []
    const noEncontrados = {
      usuarios: new Map(),
      clientes: new Map(),
      honorarios: new Map(),
      actividades: new Map(),
      fechas: 0,
      horas: 0,
    }
    const ids = new Set()
    const idsDuplicados = new Set()

    filas.forEach((row, index) => {
      const idAnterior = valorTexto(row, 'Id')
      if (idAnterior) {
        if (ids.has(idAnterior)) idsDuplicados.add(idAnterior)
        ids.add(idAnterior)
      }

      const usuarioRaw = valorTexto(row, 'Asociado')
      const clienteRaw = valorTexto(row, 'Cliente Nombre')
      const honorarioRaw = valorTexto(row, 'Honorario Nombre')
      const actividadRaw = valorTexto(row, 'Actividad')
      const comentarioRaw = valorTexto(row, 'Comentario')

      const usuarioKey = ALIAS_USUARIOS[normalizar(usuarioRaw)] || normalizar(usuarioRaw)
      const honorarioKey = ALIAS_HONORARIOS[normalizar(honorarioRaw)] || normalizar(honorarioRaw)

      const usuario = usuariosMap.get(usuarioKey)
      const cliente = clientesMap.get(normalizar(clienteRaw))
      const honorario = honorariosMap.get(honorarioKey)
      const actividad = honorario
        ? actividadesPorHonorario.get(`${honorario.id}:${normalizar(actividadRaw)}`)
        : null
      const fecha = parseFecha(row.Fecha)
      const tiempo = parseHoras(row['Horas Total'])

      if (!usuario) noEncontrados.usuarios.set(usuarioRaw, (noEncontrados.usuarios.get(usuarioRaw) || 0) + 1)
      if (!cliente) noEncontrados.clientes.set(clienteRaw, (noEncontrados.clientes.get(clienteRaw) || 0) + 1)
      if (!honorario) noEncontrados.honorarios.set(honorarioRaw, (noEncontrados.honorarios.get(honorarioRaw) || 0) + 1)
      if (honorario && !actividad) noEncontrados.actividades.set(`${honorarioRaw} / ${actividadRaw}`, (noEncontrados.actividades.get(`${honorarioRaw} / ${actividadRaw}`) || 0) + 1)
      if (!fecha) noEncontrados.fechas += 1
      if (!tiempo) noEncontrados.horas += 1

      if (usuario && cliente && honorario && actividad && fecha && tiempo) {
        importables.push({
          usuario_id: usuario.id,
          cliente_id: cliente.id,
          honorario_id: honorario.id,
          actividad_id: actividad.id,
          fecha_registro: fecha,
          horas: tiempo.horas,
          minutos: tiempo.minutos,
          comentario: comentarioRaw || null,
          _preview: {
            fila: index + 2,
            idAnterior,
            usuario: usuario.nombre_completo,
            cliente: cliente.nombre,
            honorario: honorario.nombre,
            actividad: actividad.nombre,
            horas: tiempo.decimal,
            fecha,
          },
        })
      }
    })

    const totalHoras = importables.reduce((acc, r) => acc + r.horas + r.minutos / 60, 0)

    return {
      totalFilas: filas.length,
      importables,
      totalHoras,
      idsDuplicados: Array.from(idsDuplicados),
      noEncontrados,
    }
  }, [filas, catalogos])

  const handleArchivo = async (event) => {
    const file = event.target.files?.[0]
    setResultado(null)
    setErroresArchivo([])
    setFilas([])
    setArchivoNombre(file?.name || '')

    if (!file) return

    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const data = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false })
    const encabezados = Object.keys(data[0] || {})
    const faltantes = COLUMNAS_REQUERIDAS.filter(col => !encabezados.includes(col))

    if (faltantes.length > 0) {
      setErroresArchivo([`Faltan columnas requeridas: ${faltantes.join(', ')}`])
      return
    }

    setFilas(data)
  }

  const handleImportar = async () => {
    if (!preview || preview.importables.length === 0 || importando) return
    if (!confirm(`Se importaran ${preview.importables.length} registros. Esta accion guardara datos en el CRM. ¿Continuar?`)) return

    setImportando(true)
    setResultado(null)

    const { data: { session } } = await supabase.auth.getSession()
    const response = await fetch('/api/importar-registros', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({
        registros: preview.importables.map(({ _preview, ...registro }) => registro),
      }),
    })

    const data = await response.json()
    setResultado(response.ok ? { ok: true, mensaje: `${data.insertados} registros importados` } : { ok: false, mensaje: data.error || 'No se pudo importar' })
    setImportando(false)
  }

  const tieneBloqueos = preview && (
    preview.idsDuplicados.length > 0 ||
    preview.noEncontrados.usuarios.size > 0 ||
    preview.noEncontrados.clientes.size > 0 ||
    preview.noEncontrados.honorarios.size > 0 ||
    preview.noEncontrados.actividades.size > 0 ||
    preview.noEncontrados.fechas > 0 ||
    preview.noEncontrados.horas > 0
  )

  if (verificando) return null

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f4f6fa', colorScheme: 'light' }}>
      <Sidebar rol="admin" nombreUsuario="" />

      <div className="main-content" style={{ padding: '36px 40px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div>
              <h1 style={{ fontSize: '28px', fontWeight: '800', color: '#1B2A4A', margin: 0 }}>Importar registros</h1>
              <p style={{ fontSize: '13px', color: '#6b7280', margin: '6px 0 0' }}>Carga historicos desde Excel y valida coincidencias antes de guardar.</p>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{ backgroundColor: '#1B2A4A', color: 'white', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
            >
              Seleccionar Excel
            </button>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleArchivo} style={{ display: 'none' }} />
          </div>

          <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.10)', border: '1px solid #d1d5db', marginBottom: '20px' }}>
            <p style={{ fontSize: '11px', fontWeight: '700', color: '#9ca3af', letterSpacing: '1px', textTransform: 'uppercase', margin: '0 0 12px' }}>Archivo</p>
            <p style={{ margin: 0, fontSize: '14px', color: archivoNombre ? '#1f2937' : '#9ca3af' }}>{archivoNombre || 'No has seleccionado un archivo'}</p>
            <p style={{ margin: '10px 0 0', fontSize: '12px', color: '#6b7280' }}>Columnas necesarias: Id, Fecha, Asociado, Cliente Nombre, Honorario Nombre, Actividad, Horas Total, Comentario.</p>
          </div>

          {erroresArchivo.map(error => (
            <div key={error} style={{ marginBottom: '16px', padding: '12px 16px', borderRadius: '8px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: '13px' }}>
              {error}
            </div>
          ))}

          {resultado && (
            <div style={{ marginBottom: '16px', padding: '12px 16px', borderRadius: '8px', backgroundColor: resultado.ok ? '#f0fdf4' : '#fef2f2', border: `1px solid ${resultado.ok ? '#bbf7d0' : '#fecaca'}`, color: resultado.ok ? '#15803d' : '#dc2626', fontSize: '13px' }}>
              {resultado.mensaje}
            </div>
          )}

          {preview && (
            <>
              <div className="kpi-grid" style={{ gap: '16px', marginBottom: '20px' }}>
                <Kpi label="Filas en archivo" value={preview.totalFilas} />
                <Kpi label="Listas para importar" value={preview.importables.length} />
                <Kpi label="Horas validas" value={`${preview.totalHoras.toFixed(2)}h`} />
                <Kpi label="Bloqueos" value={tieneBloqueos ? 'Revisar' : '0'} danger={tieneBloqueos} />
              </div>

              {tieneBloqueos && (
                <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.10)', border: '1px solid #d1d5db', marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#1B2A4A', margin: '0 0 14px' }}>Pendientes antes de importar</h3>
                  <Problemas titulo="Usuarios no encontrados" items={preview.noEncontrados.usuarios} />
                  <Problemas titulo="Clientes no encontrados" items={preview.noEncontrados.clientes} />
                  <Problemas titulo="Honorarios no encontrados" items={preview.noEncontrados.honorarios} />
                  <Problemas titulo="Actividades no encontradas" items={preview.noEncontrados.actividades} />
                  {preview.idsDuplicados.length > 0 && <p style={{ fontSize: '13px', color: '#b45309' }}>Ids duplicados: {preview.idsDuplicados.slice(0, 20).join(', ')}</p>}
                  {preview.noEncontrados.fechas > 0 && <p style={{ fontSize: '13px', color: '#b45309' }}>{preview.noEncontrados.fechas} filas con fecha invalida</p>}
                  {preview.noEncontrados.horas > 0 && <p style={{ fontSize: '13px', color: '#b45309' }}>{preview.noEncontrados.horas} filas con horas invalidas</p>}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
                <button
                  onClick={handleImportar}
                  disabled={importando || tieneBloqueos || preview.importables.length === 0}
                  style={{ backgroundColor: tieneBloqueos ? '#9ca3af' : '#16a34a', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '13px', fontWeight: '700', cursor: tieneBloqueos ? 'not-allowed' : 'pointer', opacity: importando ? 0.6 : 1 }}
                >
                  {importando ? 'Importando...' : 'Importar registros validados'}
                </button>
              </div>

              <div style={{ backgroundColor: 'white', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.10)', border: '1px solid #d1d5db' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
                    <thead style={{ backgroundColor: '#f9fafb' }}>
                      <tr>
                        {['Fila', 'Fecha', 'Asociado', 'Cliente', 'Honorario', 'Actividad', 'Horas'].map(h => (
                          <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: '11px', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.importables.slice(0, 50).map(r => (
                        <tr key={`${r._preview.fila}-${r._preview.idAnterior}`} style={{ borderTop: '1px solid #f3f4f6' }}>
                          <td style={td}>{r._preview.fila}</td>
                          <td style={td}>{r._preview.fecha}</td>
                          <td style={td}>{r._preview.usuario}</td>
                          <td style={td}>{r._preview.cliente}</td>
                          <td style={td}>{r._preview.honorario}</td>
                          <td style={td}>{r._preview.actividad}</td>
                          <td style={{ ...td, fontWeight: '700', color: '#1B2A4A' }}>{r._preview.horas.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ padding: '12px 16px', borderTop: '1px solid #f3f4f6', fontSize: '12px', color: '#6b7280' }}>
                  Mostrando los primeros {Math.min(50, preview.importables.length)} registros validos.
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const td = { padding: '12px 16px', fontSize: '13px', color: '#374151' }

function Kpi({ label, value, danger = false }) {
  return (
    <div style={{ backgroundColor: danger ? '#b91c1c' : '#1B2A4A', borderRadius: '16px', padding: '20px 22px', boxShadow: '0 4px 16px rgba(27,42,74,0.20)' }}>
      <p style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.60)', margin: '0 0 14px', textTransform: 'uppercase', letterSpacing: '1px' }}>{label}</p>
      <p style={{ fontSize: '28px', fontWeight: '800', color: 'white', margin: 0 }}>{value}</p>
    </div>
  )
}

function Problemas({ titulo, items }) {
  if (!items || items.size === 0) return null
  return (
    <div style={{ marginBottom: '14px' }}>
      <p style={{ fontSize: '13px', fontWeight: '700', color: '#b45309', margin: '0 0 6px' }}>{titulo}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {Array.from(items.entries()).slice(0, 30).map(([nombre, total]) => (
          <span key={nombre} style={{ fontSize: '12px', color: '#92400e', backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '99px', padding: '4px 10px' }}>
            {nombre || 'Sin valor'} ({total})
          </span>
        ))}
      </div>
    </div>
  )
}
