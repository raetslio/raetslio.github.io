// Supabase Edge Function: support
// Eingeloggte Nutzer schreiben dem Support direkt aus der Website. Versand über Gmail (App-Passwort).
// Die E-Mail-Adresse des Nutzers kommt aus der geprüften Anmeldung (nicht aus dem Formular) und steht im Inhalt der Mail;
// als Antwort-Adresse (Reply-To) ist sie ebenfalls gesetzt.
//
// Einrichten:
//   1) Google-Konto: Bestätigung in zwei Schritten aktivieren, unter https://myaccount.google.com/apppasswords ein App-Passwort erzeugen.
//   2) supabase secrets set GMAIL_USER=deine.adresse@gmail.com GMAIL_APP_PASSWORD="abcd efgh ijkl mnop" SUPPORT_TO=deine.adresse@gmail.com
//      (SUPPORT_TO ist optional, Standard ist GMAIL_USER)
//   3) supabase functions deploy support
// Die Schlüssel SUPABASE_URL, SUPABASE_ANON_KEY und SUPABASE_SERVICE_ROLE_KEY stellt Supabase automatisch bereit.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const MAX_PER_DAY = 5;        // Nachrichten pro Nutzer und Tag
const MAX_LEN = 4000;         // Zeichen pro Nachricht
const TOPICS: Record<string, string> = { question: 'Frage', bug: 'Fehler melden', idea: 'Idee / Wunsch', other: 'Sonstiges' };

const reply = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { ...CORS, 'Content-Type': 'application/json' } });
const oneLine = (s: unknown, n: number) => String(s ?? '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, n);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
    const { data: u, error: ue } = await asUser.auth.getUser();
    if (ue || !u.user || !u.user.email) return reply({ ok: false, error: 'Bitte melde dich an.' });

    const body = await req.json().catch(() => ({}));
    const message = String(body.message ?? '').trim();
    if (message.length < 5) return reply({ ok: false, error: 'Bitte schreibe eine Nachricht (mindestens 5 Zeichen).' });
    if (message.length > MAX_LEN) return reply({ ok: false, error: `Die Nachricht ist zu lang (höchstens ${MAX_LEN} Zeichen).` });
    const topic = TOPICS[String(body.topic)] ?? TOPICS.question;

    // Tageslimit gegen Missbrauch
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const today = new Date().toISOString().slice(0, 10);
    const meta = (u.user.app_metadata ?? {}) as Record<string, any>;
    const count = meta.support_day === today ? Number(meta.support_count ?? 0) : 0;
    if (count >= MAX_PER_DAY) return reply({ ok: false, error: `Du kannst pro Tag höchstens ${MAX_PER_DAY} Nachrichten senden.` });

    const gmail = Deno.env.get('GMAIL_USER')!, pass = Deno.env.get('GMAIL_APP_PASSWORD')!;
    const to = Deno.env.get('SUPPORT_TO') || gmail;
    const email = u.user.email;
    const name = oneLine((u.user.user_metadata as any)?.name ?? '', 60);

    const text = [
      `Von: ${email}${name ? ` (${name})` : ''}`,
      `Thema: ${topic}`,
      `Konto-ID: ${u.user.id}`,
      `Seite: ${oneLine(body.page, 200)}`,
      `Browser: ${oneLine(body.ua, 300)}`,
      '',
      message,
    ].join('\n');

    const client = new SMTPClient({ connection: { hostname: 'smtp.gmail.com', port: 465, tls: true, auth: { username: gmail, password: pass } } });
    try {
      await client.send({ from: gmail, to, replyTo: email, subject: `[Rätslio Support] ${topic} – ${email}`, content: text });
    } finally {
      try { await client.close(); } catch (_e) { /* egal */ }
    }
    await admin.auth.admin.updateUserById(u.user.id, { app_metadata: { ...meta, support_day: today, support_count: count + 1 } });
    return reply({ ok: true });
  } catch (_e) {
    return reply({ ok: false, error: 'Die Nachricht konnte nicht gesendet werden. Bitte versuche es später erneut.' });
  }
});
