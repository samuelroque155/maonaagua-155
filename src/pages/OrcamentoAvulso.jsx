import { useContext, useEffect, useState } from 'react';
import { AppContext } from '../context/AppContext.jsx';
import { lerArquivoLocal, salvarArquivoLocal } from '../services/arquivoLocalService';
import { validarOrcamento, validarAnexoPDF, criarOrcamentoPDF } from '../services/orcamentoService';
import { compartilharDocumento } from '../services/documentoPdfService';

const vazio = { nome: '', telefone: '', descricao: '', valor: '', pdf: null, nomePdf: '' };
export default function OrcamentoAvulso({ voltar }) {
  const { user, perfil, gradBtn } = useContext(AppContext);
  const [dados, setDados] = useState(vazio);
  const [lista, setLista] = useState([]);
  const [pronto, setPronto] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  useEffect(() => {
    let ativo = true;
    if (!user?.id) return;
    lerArquivoLocal(user.id, 'orcamentos', 'lista').then(salvos => { if (ativo) { setLista(salvos || []); setPronto(true); } }).catch(() => { if (ativo) setErro('Não foi possível carregar os orçamentos deste aparelho.'); });
    return () => { ativo = false; };
  }, [user?.id]);
  if (perfil.tipoConta === 'funcionario') return <p>Orçamentos são gerenciados pela empresa.</p>;
  const executar = async acao => { if (ocupado) return; setOcupado(true); setErro(''); try { await acao(); } catch (e) { setErro(e.message); } finally { setOcupado(false); } };
  const salvar = () => executar(async () => {
    validarOrcamento(dados);
    const registro = { ...dados, id: dados.id || crypto.randomUUID(), criadoEm: dados.criadoEm || new Date().toISOString() };
    const novos = [registro, ...lista.filter(o => o.id !== registro.id)];
    await salvarArquivoLocal(user.id, 'orcamentos', 'lista', novos); setLista(novos); setDados(registro);
  });
  const enviar = prontoPDF => executar(async () => {
    validarOrcamento(dados);
    if (!perfil.empresa?.trim()) throw new Error('Salve o nome da empresa nas configurações.');
    if (prontoPDF && !dados.pdf) throw new Error('Adicione o PDF pronto antes de compartilhar.');
    const blob = prontoPDF ? dados.pdf : await criarOrcamentoPDF(dados, perfil);
    await compartilharDocumento(blob, 'Orcamento.pdf', `Orçamento - ${perfil.empresa}`, `Olá, ${dados.nome}! Segue o orçamento de ${perfil.empresa}.`);
  });
  const classe = 'w-full p-3 mt-1 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100';
  return <div className="min-h-screen max-w-md mx-auto bg-slate-50 dark:bg-zinc-950 p-6 pb-24 space-y-5 text-zinc-800 dark:text-zinc-100">
    <button onClick={voltar} className="text-teal-600 font-bold">← Voltar</button>
    <h1 className="font-black text-2xl text-teal-600">Orçamento avulso</h1>
    <p className="text-sm text-zinc-600 dark:text-zinc-400">Cadastro separado: não cria cliente recorrente, rota ou limpeza. Orçamentos e anexos ficam salvos nesta conta, neste aparelho.</p>
    <fieldset disabled={!pronto || ocupado} className="space-y-4 disabled:opacity-60">
      <label className="block text-sm">Nome do cliente<input className={classe} value={dados.nome} onChange={e => setDados({ ...dados, nome: e.target.value })} /></label>
      <label className="block text-sm">Telefone<input type="tel" className={classe} value={dados.telefone} onChange={e => setDados({ ...dados, telefone: e.target.value })} /></label>
      <label className="block text-sm">Descrição do orçamento<textarea className={classe} rows={5} value={dados.descricao} onChange={e => setDados({ ...dados, descricao: e.target.value })} /></label>
      <label className="block text-sm">Valor total (opcional)<input type="number" min="0" step="0.01" className={classe} value={dados.valor} onChange={e => setDados({ ...dados, valor: e.target.value })} /></label>
      <label className="block text-sm">Adicionar PDF (opcional, até 10 MB)<input type="file" accept="application/pdf,.pdf" className="block w-full mt-2 text-xs" onChange={e => { const arquivo = e.target.files?.[0]; e.target.value = ''; if (arquivo) executar(async () => { await validarAnexoPDF(arquivo); setDados(atual => ({ ...atual, pdf: arquivo, nomePdf: arquivo.name })); }); }} /></label>
      {dados.nomePdf && <p className="text-xs break-all">Anexo: {dados.nomePdf} <button onClick={() => setDados({ ...dados, pdf: null, nomePdf: '' })} className="text-rose-500">Remover anexo</button></p>}
      <button onClick={salvar} className={`w-full rounded-xl p-3 font-bold ${gradBtn}`}>Salvar orçamento neste aparelho</button>
      <button onClick={() => enviar(false)} className="w-full rounded-xl p-3 border border-teal-400 text-teal-600 font-bold">Compartilhar PDF com empresa e logo + anexo</button>
      <button disabled={!dados.pdf} onClick={() => enviar(true)} className="w-full rounded-xl p-3 border border-teal-400 text-teal-600 font-bold disabled:opacity-40">Compartilhar PDF pronto com mensagem da empresa</button>
    </fieldset>
    {erro && <p role="alert" className="text-sm text-rose-600">{erro}</p>}
    <button onClick={() => setDados({ ...vazio })} className="text-teal-600 font-bold text-sm">Novo orçamento avulso</button>
    <h2 className="font-bold">Orçamentos salvos</h2>
    {lista.map(o => <button key={o.id} disabled={ocupado} onClick={() => setDados(o)} className="w-full text-left rounded-xl border border-zinc-200 dark:border-zinc-800 p-3"><strong>{o.nome}</strong><p className="text-xs text-zinc-500">{new Date(o.criadoEm).toLocaleDateString('pt-BR')}</p></button>)}
  </div>;
}
