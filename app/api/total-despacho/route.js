import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

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

  const { data: registros, error } = await supabaseAdmin
    .from('registros')
    .select('cliente_id, honorario_id, horas, minutos')
    .in('cliente_id', clienteIds)
    .gte('fecha_registro', fechaInicio)
    .lte('fecha_registro', fechaFin)

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
