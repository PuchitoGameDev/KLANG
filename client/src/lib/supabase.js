import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://brsmklxvdoudcwvjkxxj.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyc21rbHh2ZG91ZGN3dmpreHhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwMTY0NTMsImV4cCI6MjA4NDU5MjQ1M30.M1-aGT_riSuZ_NJ0iBRz1Du3hOJqLhxN-7Wh68TT31Y'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true, // Forzamos a que guarde la sesión
    autoRefreshToken: true,
    detectSessionInUrl: true // ¡ESTO ES VITAL!
  }
})