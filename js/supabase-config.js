// ═══════════════════════════════════════════════════
// SUPABASE KONFIGURATION
// ═══════════════════════════════════════════════════
const SUPABASE_URL  = 'https://ofwnxfgovondlvcpsimt.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9md254Zmdvdm9uZGx2Y3BzaW10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4MzY5NTIsImV4cCI6MjA4ODQxMjk1Mn0.DxdIoy3B1mq6JvRRzJn9KS_699dzcC6P8ziayo6jUnU';

// "db" statt "supabase" um Konflikt mit window.supabase CDN zu vermeiden
// detectSessionInUrl: false — verhindert iframe-Erstellung bei file://-Protokoll
// (Supabase PKCE-Flow würde sonst versuchen index.html in einem Frame zu laden)
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    detectSessionInUrl: false,
    persistSession: true,
    storageKey: 'propmanager-auth',
  }
});

window.db = db;
