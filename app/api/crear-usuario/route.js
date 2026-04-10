import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ROLES_VALIDOS = ['admin', 'normal']

export async function POST(request) {
  // 1. Leer el token del header Authorization enviado por el cliente
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  const token = authHeader.slice(7)

  // 2. Validar el token contra Supabase Auth (verificación server-side real)
  const { data: { user }, error: tokenError } = await supabaseAdmin.auth.getUser(token)
  if (tokenError || !user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  // 3. Verificar que el usuario autenticado tiene rol admin en la BD
  const { data: usuarioActual } = await supabaseAdmin
    .from('usuarios')
    .select('rol')
    .eq('id', user.id)
    .single()

  if (!usuarioActual || usuarioActual.rol !== 'admin') {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
  }

  // 4. Parsear y validar inputs
  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo de la solicitud inválido' }, { status: 400 })
  }

  const { nombre_completo, correo, contrasena, rol, area } = body

  if (!nombre_completo || typeof nombre_completo !== 'string' || nombre_completo.trim().length < 2) {
    return NextResponse.json({ error: 'El nombre debe tener al menos 2 caracteres' }, { status: 400 })
  }

  if (!correo || !EMAIL_REGEX.test(correo)) {
    return NextResponse.json({ error: 'El correo no tiene un formato válido' }, { status: 400 })
  }

  if (!contrasena || typeof contrasena !== 'string' || contrasena.length < 6) {
    return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 })
  }

  if (!ROLES_VALIDOS.includes(rol)) {
    return NextResponse.json({ error: 'El rol especificado no es válido' }, { status: 400 })
  }

  // 5. Crear el usuario en Supabase Auth
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: correo.toLowerCase().trim(),
    password: contrasena,
    email_confirm: true,
  })

  if (authError) {
    const esCorreoDuplicado =
      authError.message?.toLowerCase().includes('already registered') ||
      authError.code === 'email_exists'

    return NextResponse.json(
      { error: esCorreoDuplicado ? 'Este correo ya está registrado' : 'No se pudo crear el usuario' },
      { status: 400 }
    )
  }

  // 6. Insertar en la tabla usuarios (upsert para sobrescribir si un trigger ya creó la fila)
  const { error: dbError } = await supabaseAdmin
    .from('usuarios')
    .upsert({
      id: authData.user.id,
      nombre_completo: nombre_completo.trim(),
      correo: correo.toLowerCase().trim(),
      rol,
      area: area || null,
      activo: true,
    }, { onConflict: 'id' })

  if (dbError) {
    // Rollback: eliminar el usuario de Auth si falló la inserción en BD
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
    return NextResponse.json({ error: 'No se pudo guardar el usuario' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
