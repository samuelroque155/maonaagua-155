export function mensagemLembrete(item) {
  const limpar = v => String(v || '').replace(/[\r\n\t]/g, ' ').slice(0, 60);
  const lista = (item.clientes || []).slice(0, 5);
  const linhas = lista.map(c => `${limpar(c.hora) || 'Sem horário'} — ${limpar(c.nome)}`);
  const individual = item.tipo === 'individual';
  const texto = individual ? `Sua próxima limpeza será às ${limpar(lista[0]?.hora)}.\nCliente: ${limpar(lista[0]?.nome)}.\nAbra o aplicativo para iniciar o atendimento.` : `Você tem ${item.quantidade} piscina(s) para limpar hoje.\n${linhas.join('\n')}${Number(item.quantidade) > lista.length ? `\nE mais ${Number(item.quantidade) - lista.length} atendimento(s).` : ''}\nAbra o aplicativo para visualizar sua agenda.`;
  return { id: `${item.dispositivo_id}:${item.evento}`, title: individual ? 'Mão na Água — próxima limpeza' : 'Mão na Água — agenda de hoje', body: texto, tag: item.evento };
}
