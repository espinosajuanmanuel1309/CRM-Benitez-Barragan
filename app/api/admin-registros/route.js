import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

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

  let query = supabaseAdmin
    .from('registros')
    .select('*, clientes(nombre), honorarios(nombre), usuarios(nombre_completo, area)')
    .gte('fecha_registro', fechaInicio)
    .lte('fecha_registro', fechaFin)

  if (clienteId) query = query.eq('cliente_id', clienteId)
  if (asociadoId) query = query.eq('usuario_id', asociadoId)

  const { data: registros, error } = await query
  if (error) {
    return NextResponse.json({ error: 'Error al consultar registros' }, { status: 500 })
  }

  return NextResponse.json({ registros })
}
