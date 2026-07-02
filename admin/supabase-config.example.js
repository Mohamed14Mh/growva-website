// Do not commit real production secrets if this repo is public.
// Supabase anon key is safe only with strict RLS policies.
window.GROWVA_SUPABASE_CONFIG = {
  url: "https://YOUR_PROJECT.supabase.co",
  anonKey: "YOUR_SUPABASE_ANON_KEY"
};
