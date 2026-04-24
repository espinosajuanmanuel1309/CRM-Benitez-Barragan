import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const PAGE_SIZE = 1000

async function cargarRegistros({ fechaInicio, fechaFin, clienteId, asociadoId }) {
  const registros = []

  for (let from = 0; ; from += PAGE_SIZE) {
    let query = supabaseAdmin
      .from('registros')
      .select('*, clientes(nombre), honorarios(nombre), usuarios(nombre_completo, area)')
      .gte('fecha_registro', fechaInicio)
      .lte('fecha_registro', fechaFin)
      .order('fecha_registro', { ascending: false })
      .order('id', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)

    if (clienteId) query = query.eq('cliente_id', clienteId)
    if (asociadoId) query = query.eq('usuario_id', asociadoId)

    const { data, error } = await query
    if (error) return { registros: [], error }

    registros.push(...(data || []))
    if (!data || data.length < PAGE_SIZE) break
  }

  return { registros, error: null }
}

export async function POST(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  const token = authHeader.slice(7)

  const { data: { user }, error: tokenError } = await supabaseAdmin.auth.getUser(token)
  if (tokenError || !user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { data: usuarioData } = await supabaseAdmin
    .from('usuarios')
    .select('rol')
    .eq('id', user.id)
    .single()

  if (usuarioData?.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }

  const { fechaInicio, fechaFin, clienteId, asociadoId } = body

  const { registros, error } = await cargarRegistros({ fechaInicio, fechaFin, clienteId, asociadoId })
  if (error) {
    return NextResponse.json({ error: 'Error al consultar registros' }, { status: 500 })
  }

  return NextResponse.json({ registros })
}
