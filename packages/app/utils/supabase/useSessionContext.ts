import { useSupabaseClient } from '../../provider/auth/AuthProvider'
import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'

export const useSessionContext = () => {
  const supabase = useSupabaseClient()
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setIsLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  return { session, isLoading, supabaseClient: supabase }
}
