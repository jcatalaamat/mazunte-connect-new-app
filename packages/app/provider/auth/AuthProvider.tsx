import { Database } from '@my/supabase/types'
import { createBrowserClient, type SupabaseClient } from '@supabase/ssr'
import { createContext, useContext, useState } from 'react'

import { AuthStateChangeHandler } from './AuthStateChangeHandler'

export type AuthProviderProps = {
  children?: React.ReactNode
}

type SupabaseContext = {
  supabase: SupabaseClient<Database>
}

const Context = createContext<SupabaseContext | undefined>(undefined)

export const AuthProvider = ({ children }: AuthProviderProps) => {
  // Create a new supabase browser client on every first render.
  const [supabase] = useState(() =>
    createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  )

  return (
    <Context.Provider value={{ supabase }}>
      <AuthStateChangeHandler />
      {children}
    </Context.Provider>
  )
}

export const useSupabaseClient = () => {
  const context = useContext(Context)
  if (context === undefined) {
    throw new Error('useSupabaseClient must be used within AuthProvider')
  }
  return context.supabase
}
