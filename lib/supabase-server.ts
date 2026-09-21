import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { requireEnv } from './supabase'

// Service role bypasses RLS: only for server routes that write.
export function serviceClient() {
  return createClient(requireEnv('NEXT_PUBLIC_SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  })
}
