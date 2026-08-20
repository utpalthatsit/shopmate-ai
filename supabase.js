const SUPABASE_URL = 'https://ntknopebuiskpdlmhqbq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_8Be5kHYMRkPRqKRXbQX4Ew_EkvVHnYE';

window.shopmateSupabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);