import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tzxblbmwaxygfxucqnbz.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6eGJsYm13YXh5Z2Z4dWNxbmJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0ODYzOTAsImV4cCI6MjA4ODA2MjM5MH0.qa1W5GC4SjO_tbLmgObfGDi8xXALAnSQO6_ivpJQof0';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export const GYM_ID = process.env.NEXT_PUBLIC_GYM_ID || 'a0000000-0000-0000-0000-000000000001';
