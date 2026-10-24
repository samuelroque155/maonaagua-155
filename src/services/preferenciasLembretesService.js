export const padraoLembretes = { ativo: false, modo: 'resumo', horario: '07:00', antecedencia: 30, fuso: 'America/Sao_Paulo' };
export function validarPreferencias(valor) {
  if (!['resumo', 'individual', 'ambos'].includes(valor.modo) || ![15, 30, 60].includes(Number(valor.antecedencia)) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(valor.horario)) throw new Error('Confira o modo, o horário e a antecedência.');
  try { new Intl.DateTimeFormat('pt-BR', { timeZone: valor.fuso }).format(); } catch { throw new Error('Escolha um fuso horário válido.'); }
  return { ...valor, ativo: valor.ativo === true, antecedencia: Number(valor.antecedencia) };
}
export async function carregarPreferencias(client, uid, locais) {
  const { data, error } = await client.from('notificacoes_preferencias').select('*').eq('user_id', uid).maybeSingle();
  if (error) throw error;
  return data ? { ...padraoLembretes, ...data, horario: data.horario.slice(0, 5) } : { ...padraoLembretes, ...locais };
}
export async function salvarPreferencias(client, uid, valor) {
  const v = validarPreferencias(valor);
  const { error } = await client.from('notificacoes_preferencias').upsert({ user_id: uid, ativo: v.ativo, modo: v.modo, horario: v.horario, antecedencia: v.antecedencia, fuso: v.fuso }, { onConflict: 'user_id' });
  if (error) throw error;
}
