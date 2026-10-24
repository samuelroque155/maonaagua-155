import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import webpush from 'npm:web-push@3.6.7';
import { mensagemLembrete } from './mensagem.js';

Deno.serve(async request => {
  const segredo = Deno.env.get('LEMBRETES_CRON_SECRET');
  if (request.method !== 'POST' || !segredo || request.headers.get('x-cron-secret') !== segredo) {
    return new Response('Unauthorized', { status: 401 });
  }
  const publica = Deno.env.get('WEB_PUSH_PUBLIC_KEY');
  const privada = Deno.env.get('WEB_PUSH_PRIVATE_KEY');
  const contato = Deno.env.get('WEB_PUSH_SUBJECT');
  if (!publica || !privada || !contato) return new Response('Push not configured', { status: 503 });
  webpush.setVapidDetails(contato, publica, privada);
  const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.rpc('reivindicar_lembretes_v2');
  if (error) return new Response('Could not load reminders', { status: 500 });
  let enviados = 0, falhas = 0;
  // Batches pequenos limitam memória, conexões e duração do serviço.
  for (let inicio = 0; inicio < (data || []).length; inicio += 10) {
    await Promise.all(data.slice(inicio, inicio + 10).map(async item => {
      try {
        const { data: atuais, error: erroAtual } = await client.rpc('preparar_envio_lembrete', { p_dispositivo: item.dispositivo_id, p_evento: item.evento, p_token: item.token });
        if (erroAtual) { falhas++; return; }
        const atual = atuais?.[0];
        if (!atual) return;
        const ttl = Math.min(3600, Math.floor((new Date(atual.validade).getTime() - Date.now()) / 1000));
        if (ttl <= 0) return;
        await webpush.sendNotification(atual.assinatura, JSON.stringify(mensagemLembrete(atual)), { TTL: ttl, timeout: 10000, urgency: 'normal' });
        const resultado = await client.from('notificacoes_entregas').update({ enviado_em: new Date().toISOString() }).eq('dispositivo_id', item.dispositivo_id).eq('evento', item.evento).eq('token', item.token);
        if (resultado.error) { falhas++; return; }
        if (item.tipo === 'resumo') {
          // Mantém a marca antiga para uma eventual reversão da Edge Function.
          const legado = await client.from('notificacoes_dispositivos').update({ ultimo_envio: item.evento.slice('resumo:'.length) }).eq('id', item.dispositivo_id);
          if (legado.error) { falhas++; return; }
        }
        enviados++;
      } catch (erro) {
        falhas++;
        if ([404, 410].includes(erro.statusCode)) {
          await client.from('notificacoes_dispositivos').update({ ativo: false, bloqueado_ate: null }).eq('id', item.dispositivo_id);
        }
        // Demais falhas: a reserva expira em 5 minutos e o cron tenta novamente.
      }
    }));
  }
  return Response.json({ enviados, falhas });
});
