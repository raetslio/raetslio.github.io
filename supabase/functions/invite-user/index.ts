// Supabase Edge Function: invite-user
// Eingeloggte Nutzer können per E-Mail andere einladen (nutzt die Vorlage "Invite user").
// Deploy:  supabase functions deploy invite-user
// Die Schlüssel SUPABASE_URL, SUPABASE_ANON_KEY und SUPABASE_SERVICE_ROLE_KEY stellt Supabase automatisch bereit.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const MAX_PER_DAY = 5;                                  // Einladungen pro Nutzer und Tag
const REDIRECT = 'https://raetslio.github.io/sudoku/';  // Wohin der Link in der Mail führt

const reply = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const authHeader = req.headers.get('Authorization') ?? '';
    const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const { data: u, error: ue } = await asUser.auth.getUser();
    if (ue || !u.user) return reply({ ok: false, error: 'Bitte melde dich an.' });

    const { email } = await req.json().catch(() => ({}));
    const to = String(email ?? '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) || to.length > 254) return reply({ ok: false, error: 'Bitte gib eine gültige E-Mail-Adresse ein.' });
    if (to === (u.user.email ?? '').toLowerCase()) return reply({ ok: false, error: 'Das ist deine eigene Adresse.' });

    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Tageslimit gegen Missbrauch
    const today = new Date().toISOString().slice(0, 10);
    const meta = (u.user.app_metadata ?? {}) as Record<string, any>;
    const count = meta.invite_day === today ? Number(meta.invite_count ?? 0) : 0;
    if (count >= MAX_PER_DAY) return reply({ ok: false, error: `Du kannst pro Tag höchstens ${MAX_PER_DAY} Einladungen verschicken.` });

    const { error } = await admin.auth.admin.inviteUserByEmail(to, { redirectTo: REDIRECT, data: { invited_by: u.user.email } });
    if (error) {
      if (/already|registered|exists/i.test(error.message)) return reply({ ok: false, error: 'Diese Adresse hat bereits ein Konto.' });
      return reply({ ok: false, error: 'Die Einladung konnte nicht gesendet werden.' });
    }
    await admin.auth.admin.updateUserById(u.user.id, { app_metadata: { ...meta, invite_day: today, invite_count: count + 1 } });
    return reply({ ok: true, left: MAX_PER_DAY - count - 1 });
  } catch (_e) {
    return reply({ ok: false, error: 'Unerwarteter Fehler. Bitte versuche es später erneut.' });
  }
});
