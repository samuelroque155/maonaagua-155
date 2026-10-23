// Composição para apresentação: não altera nem elimina o histórico armazenado.
export function antecipacoesUnicas(historico) {
  const grupos = new Map();
  const aliases = new Map();
  for (const v of historico) {
    if (v.tipo !== 'antecipacao' && !v.antecipacaoDescricao && !v.antecipacaoDados) continue;
    const descricao = v.antecipacaoDescricao || v.descricao || '';
    const id = v.antecipacaoId || (v.tipo === 'antecipacao' && String(v.id || '').replace(/^antecipacao:/, ''));
    // Identificadores diferentes representam ocorrências diferentes, mesmo
    // quando possuem exatamente as mesmas datas e o mesmo motivo.
    const chave = id ? (aliases.get(id) || id) : (aliases.get(descricao) || descricao);
    if (!chave) continue;
    if (id) aliases.set(id, chave);
    if (descricao) aliases.set(descricao, chave);
    const anterior = grupos.get(chave) || {};
    const dados = v.antecipacaoDados || {};
    const prevista = dados.data_original || v.dataOriginal;
    const nova = dados.nova_data || v.novaData;
    const formatar = d => /^\d{4}-\d{2}-\d{2}$/.test(d || '') ? d.split('-').reverse().join('/') : d;
    grupos.set(chave, {
      ...anterior,
      prevista: formatar(prevista) || anterior.prevista || descricao.match(/prevista: (\d{2}\/\d{2}\/\d{4})/i)?.[1],
      novaData: formatar(nova) || anterior.novaData || descricao.match(/antecipada para (\d{2}\/\d{2}\/\d{4})/i)?.[1],
      motivo: dados.motivo || v.motivo || anterior.motivo || descricao.match(/Motivo: ([\s\S]*?)(?: · Antecipação cancelada|$)/i)?.[1],
      realizada: (v.tipo === 'visita' || !v.tipo ? v.d : v.dataEfetiva) || anterior.realizada,
      cancelada: Boolean(dados.cancelado_em || v.canceladoEm || /cancelada/i.test(v.status || descricao) || anterior.cancelada)
    });
  }
  return [...grupos.values()];
}
