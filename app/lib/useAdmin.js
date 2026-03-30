import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { useRouter } from 'next/navigation'

export function useAdmin() {
  const [verificando, setVerificando] = useState(true)
  const [esAdmin, setEsAdmin] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const verificar = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      const { data } = await supabase
        .from('usuarios')
        .select('rol')
        .eq('id', user.id)
        .single()

      if (!data || data.rol !== 'admin') {
        router.push('/dashboard')
        return
      }
      setEsAdmin(true)
      setVerificando(false)
    }
    verificar()
  }, [])

  return { verificando, esAdmin }
}