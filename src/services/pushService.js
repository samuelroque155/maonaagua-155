export function chaveVapidBytes(chave) {
  const base64 = chave.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64 + '='.repeat((4 - base64.length % 4) % 4)), c => c.charCodeAt(0));
}
export async function configurarPush(client, uid, opcoes, chavePublica, ambiente = globalThis) {
  const registro = opcoes.ativo ? await ambiente.navigator.serviceWorker.ready : await ambiente.navigator.serviceWorker.getRegistration();
  if (!registro?.pushManager) {
    if (!opcoes.ativo) return;
    throw new Error('Este navegador não permite notificações com o app fechado.');
  }
  const inscricao = await registro.pushManager.getSubscription();
  if (!opcoes.ativo) {
    // Configuração nova pausa no servidor e conserva a inscrição; clientes legados mantêm o cancelamento local.
    if (inscricao && !opcoes.preservarInscricao) await inscricao.unsubscribe();
    if (inscricao) {
      const { error } = await client.from('notificacoes_dispositivos').update({ ativo: false }).eq('user_id', uid).eq('endpoint', inscricao.endpoint);
      if (error) throw new Error('Avisos cancelados neste aparelho. Não foi possível atualizar o servidor; tente desligar novamente.');
    }
    return;
  }
  if (!chavePublica) throw new Error('Os lembretes com o app fechado ainda precisam ser ativados no servidor. Nenhuma notificação foi agendada.');
  if (!registro.pushManager) throw new Error('Este navegador não permite notificações com o app fechado.');
  const assinatura = inscricao || await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveVapidBytes(chavePublica) });
  const { error } = await client.from('notificacoes_dispositivos').upsert({
    user_id: uid, endpoint: assinatura.endpoint, assinatura: assinatura.toJSON(), horario: opcoes.horario, ativo: true
  }, { onConflict: 'user_id,endpoint' });
  if (error) {
    if (!inscricao) await assinatura.unsubscribe();
    throw new Error('Não foi possível agendar no servidor. Confira a conexão e a configuração das notificações.');
  }
}
