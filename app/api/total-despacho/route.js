import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const PAGE_SIZE = 1000

async function cargarRegistros({ clienteIds, fechaInicio, fechaFin }) {
  const registros = []

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from('registros')
      .select('cliente_id, honorario_id, horas, minutos')
      .in('cliente_id', clienteIds)
      .gte('fecha_registro', fechaInicio)
      .lte('fecha_registro', fechaFin)
      .order('fecha_registro', { ascending: false })
      .order('id', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)

    if (error) return { registros: [], error }

    registros.push(...(data || []))
    if (!data || data.length < PAGE_SIZE) break
  }

  return { registros, error: null }
}

export async function POST(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  const token = authHeader.slice(7)

  const { data: { user }, error: tokenError } = await supabaseAdmin.auth.getUser(token)
  if (tokenError || !user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }

  const { clienteIds, fechaInicio, fechaFin } = body
  if (!Array.isArray(clienteIds) || clienteIds.length === 0) {
    return NextResponse.json({ totalDespacho: {} })
  }

  const { registros, error } = await cargarRegistros({ clienteIds, fechaInicio, fechaFin })

  if (error) {
    return NextResponse.json({ error: 'Error al consultar registros' }, { status: 500 })
  }

  const totalDespacho = {}
  registros?.forEach(r => {
    const clave = `${r.cliente_id}_${r.honorario_id}`
    totalDespacho[clave] = (totalDespacho[clave] || 0) + r.horas + r.minutos / 60
  })

  return NextResponse.json({ totalDespacho })
}
