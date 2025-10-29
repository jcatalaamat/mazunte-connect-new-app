import { useSupabaseClient } from '../../provider/auth/AuthProvider'

export const useSupabase = () => {
  return useSupabaseClient()
}
