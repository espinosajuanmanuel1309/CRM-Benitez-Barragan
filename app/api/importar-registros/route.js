import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const BATCH_SIZE = 500

async function validarAdmin(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null

  const token = authHeader.slice(7)
  const { data: { user }, error: tokenError } = await supabaseAdmin.auth.getUser(token)
  if (tokenError || !user) return null

  const { data: usuarioActual } = await supabaseAdmin
    .from('usuarios')
    .select('rol')
    .eq('id', user.id)
    .single()

  return usuarioActual?.rol === 'admin' ? user : null
}

function validarRegistro(registro) {
  return (
    registro &&
    typeof registro.usuario_id === 'string' &&
    Number.isInteger(registro.cliente_id) &&
    Number.isInteger(registro.honorario_id) &&
    Number.isInteger(registro.actividad_id) &&
    typeof registro.fecha_registro === 'string' &&
    Number.isInteger(registro.horas) &&
    Number.isInteger(registro.minutos) &&
    registro.horas >= 0 &&
    registro.minutos >= 0 &&
    registro.minutos < 60
  )
}

export async function POST(request) {
  const admin = await validarAdmin(request)
  if (!admin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo invalido' }, { status: 400 })
  }

  const registros = Array.isArray(body?.registros) ? body.registros : []
  if (registros.length === 0) {
    return NextResponse.json({ error: 'No hay registros para importar' }, { status: 400 })
  }

  if (registros.length > 10000) {
    return NextResponse.json({ error: 'El archivo excede el limite de 10000 registros' }, { status: 400 })
  }

  const invalidos = registros.filter(r => !validarRegistro(r))
  if (invalidos.length > 0) {
    return NextResponse.json({ error: `${invalidos.length} registros tienen formato invalido` }, { status: 400 })
  }

  let insertados = 0
  for (let i = 0; i < registros.length; i += BATCH_SIZE) {
    const lote = registros.slice(i, i + BATCH_SIZE).map(r => ({
      usuario_id: r.usuario_id,
      cliente_id: r.cliente_id,
      honorario_id: r.honorario_id,
      actividad_id: r.actividad_id,
      fecha_registro: r.fecha_registro,
      horas: r.horas,
      minutos: r.minutos,
      comentario: r.comentario || null,
    }))

    const { error } = await supabaseAdmin.from('registros').insert(lote)
    if (error) {
      return NextResponse.json(
        { error: 'No se pudo importar el lote de registros', detail: error.message },
        { status: 500 }
      )
    }
    insertados += lote.length
  }

  return NextResponse.json({ ok: true, insertados })
}
