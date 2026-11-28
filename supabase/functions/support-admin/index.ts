// Supabase Edge Function: support-admin
// Nur für dich (Admin): lädt eine Support-Nachricht anhand der Answer-ID und schickt die Antwort als schöne HTML-Mail an den Nutzer.
// Aufgerufen von https://raetslio.github.io/answer/<ID>/
//
// Geheimnisse (zusätzlich zu GMAIL_USER, GMAIL_APP_PASSWORD, SUPPORT_TO der Funktion "support"):
//   supabase secrets set ADMIN_EMAILS=deine.rätslio-konto@mail.de      (Komma-getrennt; Standard: SUPPORT_TO bzw. GMAIL_USER)
// Deploy:  supabase functions deploy support-admin
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const SITE = 'https://raetslio.github.io';
const MAX_LEN = 5000;
const DENIED = { ok: false, error: 'Kein Zugriff oder unbekannte Answer-ID.' };

const reply = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { ...CORS, 'Content-Type': 'application/json' } });
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const para = (t: string) => esc(t).split(/\n{2,}/).map((p) =>
  `<p style="margin:0 0 14px;font-size:17px;line-height:1.65;color:#3f4a53">${p.replace(/\n/g, '<br>')}</p>`).join('');

/** Antwort-Mail im Look der Rätslio?-Bestätigungsmails: Logo oben, weiße Karte mit dunklem Balken, Knopf, Fußnote. */
function mailHtml(name: string, answer: string, topic: string, original: string) {
  const hello = name ? `Hallo ${esc(name)},` : 'Hallo,';
  return `<!doctype html><html lang="de"><body style="margin:0;padding:0;background:#e9edf2">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e9edf2"><tr><td align="center" style="padding:36px 14px 28px;font-family:-apple-system,'Segoe UI',Arial,sans-serif">
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 26px"><tr>
    <td style="font-size:44px;line-height:1;font-weight:800;color:#3c5a6e;padding-right:10px;letter-spacing:-1px">Rätslio</td>
    <td><img src="${SITE}/icons/rl-180.png" width="50" height="50" alt="?" style="display:block;border-radius:12px"></td>
  </tr></table>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-top:10px solid #44596b;border-radius:26px"><tr><td style="padding:34px 34px 30px">
    <h1 style="margin:0 0 20px;font-size:28px;line-height:1.25;color:#3a4b5a">Antwort von deinem Rätslio?-Support</h1>
    <p style="margin:0 0 14px;font-size:17px;line-height:1.65;color:#3f4a53">${hello}</p>
    ${para(answer)}
    <p style="margin:20px 0 0;font-size:17px;line-height:1.65;color:#3f4a53">Viele Grüße<br><b>Dein Rätslio?-Team</b></p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0 0"><tr><td align="center">
      <a href="${SITE}/" style="display:block;background:#44596b;color:#ffffff;text-decoration:none;font-size:19px;font-weight:700;padding:18px 24px;border-radius:18px;text-align:center">Zu Rätslio?</a>
    </td></tr></table>
    <div style="border-top:2px solid #e3e8ee;margin:30px 0 20px"></div>
    <div style="border-left:4px solid #d9946e;background:#f6f2ee;border-radius:6px;padding:12px 16px;margin:0 0 18px">
      <div style="font-size:12px;color:#7a7268;margin-bottom:6px;text-transform:uppercase;letter-spacing:.6px">Deine Nachricht an uns · ${esc(topic)}</div>
      <div style="font-size:15px;line-height:1.55;color:#4a4a48;white-space:pre-wrap">${esc(original)}</div>
    </div>
    <p style="margin:0;font-size:15px;line-height:1.6;color:#7b8590">Noch eine Frage? Schreib uns einfach nochmal über die <a href="${SITE}/konto/" style="color:#3c5a6e;font-weight:600">Kontoseite</a> bei Rätslio?. Antworten auf diese E-Mail werden nicht gelesen.</p>
  </td></tr></table>
  <p style="margin:26px 0 0;font-size:15px;color:#8a929a">Rätslio?</p>
</td></tr></table></body></html>`;
}

function mailText(name: string, answer: string, topic: string, original: string) {
  return `${name ? `Hallo ${name},` : 'Hallo,'}\n\n${answer}\n\nViele Grüße\nDein Rätslio?-Team\n\n---\nDeine Nachricht an uns (${topic}):\n${original}\n\nNoch eine Frage? Schreib uns einfach nochmal über die Kontoseite bei Rätslio? (${SITE}/konto/). Antworten auf diese E-Mail werden nicht gelesen.\n`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
    const { data: u, error: ue } = await asUser.auth.getUser();
    if (ue || !u.user || !u.user.email) return reply(DENIED);

    const gmail = Deno.env.get('GMAIL_USER')!;
    const admins = (Deno.env.get('ADMIN_EMAILS') || Deno.env.get('SUPPORT_TO') || gmail).split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
    if (!admins.includes(u.user.email.toLowerCase())) return reply(DENIED);

    const b = await req.json().catch(() => ({}));
    const id = String(b.id ?? '').trim();
    if (!/^ID-[A-Za-z0-9]{6,40}$/.test(id)) return reply(DENIED);
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: t } = await admin.from('support_tickets').select('*').eq('id', id).maybeSingle();
    if (!t) return reply(DENIED);

    if (b.action === 'get') {
      return reply({ ok: true, ticket: { id: t.id, email: t.email, name: t.name, topic: t.topic, message: t.message, created_at: t.created_at, replies: t.replies ?? [] } });
    }

    if (b.action === 'send') {
      const answer = String(b.text ?? '').trim();
      if (answer.length < 2) return reply({ ok: false, error: 'Bitte schreibe eine Antwort.' });
      if (answer.length > MAX_LEN) return reply({ ok: false, error: `Die Antwort ist zu lang (höchstens ${MAX_LEN} Zeichen).` });
      const topic = String(t.topic ?? 'Support');
      const client = new SMTPClient({ connection: { hostname: 'smtp.gmail.com', port: 465, tls: true, auth: { username: gmail, password: (Deno.env.get('GMAIL_APP_PASSWORD') ?? '').replace(/\s+/g, '') } } });
      try {
        await client.send({
          from: `Rätslio? Support <${gmail}>`, to: t.email,
          subject: `Re: ${topic} – Rätslio? Support`,
          content: mailText(t.name ?? '', answer, topic, t.message), html: mailHtml(t.name ?? '', answer, topic, t.message),
        });
      } finally { try { await client.close(); } catch (_e) { /* egal */ } }
      const replies = [...(t.replies ?? []), { at: new Date().toISOString(), text: answer }];
      await admin.from('support_tickets').update({ replies }).eq('id', id);
      return reply({ ok: true, replies });
    }
    return reply(DENIED);
  } catch (_e) {
    return reply({ ok: false, error: 'Unerwarteter Fehler. Bitte versuche es später erneut.' });
  }
});
