import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ROLES_VALIDOS = ['admin', 'normal']

export async function POST(request) {
  // 1. Verificar sesión activa leyendo las cookies del request
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  // 2. Verificar que el usuario autenticado tiene rol admin en la BD
  // Se usa supabaseAdmin para evitar dependencia de RLS durante la transición
  const { data: usuarioActual } = await supabaseAdmin
    .from('usuarios')
    .select('rol')
    .eq('id', user.id)
    .single()

  if (!usuarioActual || usuarioActual.rol !== 'admin') {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
  }

  // 3. Validar inputs en el servidor
  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo de la solicitud inválido' }, { status: 400 })
  }

  const { nombre_completo, correo, contrasena, rol } = body

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

  // 4. Crear el usuario en Supabase Auth
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

  // 5. Insertar en la tabla usuarios
  const { error: dbError } = await supabaseAdmin
    .from('usuarios')
    .insert({
      id: authData.user.id,
      nombre_completo: nombre_completo.trim(),
      correo: correo.toLowerCase().trim(),
      rol,
      activo: true,
    })

  if (dbError) {
    // Rollback: eliminar el usuario de Auth si falló la inserción en BD
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
    return NextResponse.json({ error: 'No se pudo guardar el usuario' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
