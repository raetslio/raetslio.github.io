// Supabase Edge Function: support
// Eingeloggte Nutzer schreiben dem Support direkt aus der Website. Versand über Gmail (App-Passwort).
// Die E-Mail-Adresse des Nutzers kommt aus der geprüften Anmeldung (nicht aus dem Formular) und steht im Inhalt der Mail.
// Jede Nachricht bekommt eine zufällige Answer-ID und wird in der Tabelle support_tickets gespeichert (supabase/support_tickets.sql).
// Die Mail an dich enthält den Link https://raetslio.github.io/answer/<ID>/ – dort antwortest du (Edge Function support-admin).
// Der Nutzer erfährt die ID nie.
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
const SITE = 'https://raetslio.github.io';
const MAX_PER_DAY = 5;        // Nachrichten pro Nutzer und Tag
const MAX_LEN = 4000;         // Zeichen pro Nachricht
const TOPICS: Record<string, string> = { question: 'Frage', bug: 'Fehler melden', idea: 'Idee / Wunsch', other: 'Sonstiges' };

const FAIL = 'Die Nachricht konnte nicht gesendet werden. Bitte versuche es später erneut.';
const reply = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { ...CORS, 'Content-Type': 'application/json' } });
const newId = () => {
  const b = crypto.getRandomValues(new Uint8Array(12));
  return 'ID-' + Array.from(b, (x) => 'abcdefghjkmnpqrstuvwxyz23456789'[x % 31]).join('');
};
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const subj = (s: string) => s.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue').replace(/ß/g, 'ss').replace(/[–—]/g, '-').replace(/[^\x20-\x7E]/g, '').replace(/[?=]/g, '').replace(/\s+/g, ' ').trim();
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

    const gmail = Deno.env.get('GMAIL_USER') ?? '', pass = Deno.env.get('GMAIL_APP_PASSWORD') ?? '';
    if (!gmail || !pass) { console.error('support: Geheimnisse GMAIL_USER / GMAIL_APP_PASSWORD fehlen'); return reply({ ok: false, code: 'secrets', error: FAIL }); }
    const to = Deno.env.get('SUPPORT_TO') || gmail;
    const email = u.user.email;
    const name = oneLine((u.user.user_metadata as any)?.name ?? '', 60);

    const id = newId();
    const page = oneLine(body.page, 200), ua = oneLine(body.ua, 300);
    const { error: ie } = await admin.from('support_tickets').insert({ id, user_id: u.user.id, email, name: name || null, topic, message });
    if (ie) { console.error('support: Datenbank (Tabelle support_tickets angelegt?):', ie.message); return reply({ ok: false, code: 'db', error: FAIL }); }
    const link = `${SITE}/answer/${id}/`;

    const text = [
      `Neue Support-Nachricht`,
      ``,
      `Von: ${email}${name ? ` (${name})` : ''}`,
      `Thema: ${topic}`,
      `Seite: ${page}`,
      `Browser: ${ua}`,
      ``,
      message,
      ``,
      `Antworten: ${link}`,
    ].join('\n');
    const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#23272a;max-width:560px">
<p style="margin:0 0 12px"><b>Neue Support-Nachricht</b></p>
<p style="margin:0 0 12px;color:#555">Von <b>${esc(email)}</b>${name ? ` (${esc(name)})` : ''}<br>Thema: ${esc(topic)}<br>Seite: ${esc(page)}</p>
<div style="border-left:4px solid #d9946e;background:#f6f2ee;padding:12px 14px;border-radius:6px;white-space:pre-wrap">${esc(message)}</div>
<p style="margin:18px 0"><a href="${link}" style="background:#3c5a6e;color:#fff;text-decoration:none;padding:11px 18px;border-radius:8px;display:inline-block">Jetzt antworten</a></p>
<p style="margin:0;color:#888;font-size:12px">Browser: ${esc(ua)}</p></div>`;

    const client = new SMTPClient({ connection: { hostname: 'smtp.gmail.com', port: 465, tls: true, auth: { username: gmail, password: pass.replace(/\s+/g, '') } } });
    try {
      await client.send({ from: gmail, to, replyTo: email, subject: subj(`[Raetslio Support] ${topic} - ${email}`), content: text, html });
    } catch (e) {
      console.error('support: E-Mail-Versand (Gmail) fehlgeschlagen:', (e as Error).message);
      await admin.from('support_tickets').delete().eq('id', id);
      return reply({ ok: false, code: 'smtp', error: FAIL });
    } finally {
      try { await client.close(); } catch (_e) { /* egal */ }
    }
    await admin.auth.admin.updateUserById(u.user.id, { app_metadata: { ...meta, support_day: today, support_count: count + 1 } });
    return reply({ ok: true });
  } catch (e) {
    console.error('support: unerwarteter Fehler:', (e as Error).message);
    return reply({ ok: false, code: 'crash', error: FAIL });
  }
});
