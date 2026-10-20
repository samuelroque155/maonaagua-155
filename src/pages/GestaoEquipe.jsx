import React, { useState, useEffect, useContext } from 'react';
import { AppContext } from '../context/AppContext.jsx';
import { supabase } from '../supabase';
import { listarFuncionarios, listarRelatoriosEquipe, listarAlertas, resolverAlerta, salvarProdutosEquipe, salvarFuncionario as gravarFuncionario, removerFuncionario as excluirFuncionario } from '../services/equipeService';
import { UserPlus, UserMinus, ShieldAlert, CheckCircle, Bell, Users, Pencil } from 'lucide-react';
import { abrirWhatsApp } from '../utils/whatsapp';
import { mensagemProdutos } from '../services/whatsappService';

export default function GestaoEquipe({ setTela, abrirRelatorio }) {
  const { user, perfil, clientes, gradText, gradBtn } = useContext(AppContext);
  const [editandoProdutos, setEditandoProdutos] = useState(null);
  const [itensProdutos, setItensProdutos] = useState([]);
  const [salvandoProdutos, setSalvandoProdutos] = useState(false);
  const [funcionarios, setFuncionarios] = useState([]);
  const [alertas, setAlertas] = useState([]);
  const [relatorios, setRelatorios] = useState([]);
  const [filtroFuncionario, setFiltroFuncionario] = useState('');
  const [loading, setLoading] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState('');
  const [tab, setTab] = useState('equipe'); // 'equipe' ou 'alertas'
  
  // Form estado
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [rotasSelecionadas, setRotasSelecionadas] = useState([]);
  const [isAdding, setIsAdding] = useState(false);
  const [funcionarioEditando, setFuncionarioEditando] = useState(null);

  const carregarAlertas = async () => {
    try {
      setAlertas(await listarAlertas(supabase, user.id));
    } catch (e) {
      console.error(e);
      setErroCarregamento('Não foi possível carregar os alertas: ' + e.message);
    }
  };

  const marcarAlertaComoLido = async (alertaId) => {
    try {
      await resolverAlerta(supabase, user.id, alertaId);
      carregarAlertas();
    } catch (e) {
      alert("Erro ao marcar como lido: " + e.message);
    }
  };

  const salvarProdutos = async (alerta) => {
    setSalvandoProdutos(true);
    try {
      await salvarProdutosEquipe(supabase, user.id, alerta.visita_id, itensProdutos);
      setEditandoProdutos(null);
      await carregarAlertas();
    } catch (e) { alert('Não foi possível salvar os produtos: ' + e.message); }
    finally { setSalvandoProdutos(false); }
  };

  const enviarProdutos = (alerta, comValores) => {
    try {
      const mensagem = mensagemProdutos({ cliente: { nome: alerta.clienteNome }, perfil, produtos: alerta.produtos, comValores });
      if (!abrirWhatsApp(alerta.clienteTel, mensagem)) alert('O telefone deste cliente precisa ter DDD para abrir o WhatsApp.');
    } catch (e) { alert(e.message); }
  };

  const carregarFuncionarios = async () => {
    try {
      const [equipe, recebidos] = await Promise.all([
        listarFuncionarios(supabase, user.id), listarRelatoriosEquipe(supabase, user.id)
      ]);
      setFuncionarios(equipe);
      setRelatorios(recebidos);
    } catch (e) {
      console.error(e);
      setErroCarregamento('Não foi possível carregar a equipe: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const limparFormulario = () => {
    setNome('');
    setEmail('');
    setRotasSelecionadas([]);
    setIsAdding(false);
    setFuncionarioEditando(null);
  };

  useEffect(() => {
    if (user) {
      // Os estados são atualizados após as leituras assíncronas do Supabase.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      carregarFuncionarios();
      carregarAlertas();
    }
    // As funções carregam apenas os dados do usuário autenticado atual.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const abrirEdicao = (funcionario) => {
    setFuncionarioEditando(funcionario);
    setNome(funcionario.nome || '');
    setEmail(funcionario.email || '');
    setRotasSelecionadas((funcionario.rotas || []).map(String));
    setIsAdding(true);
  };

  const salvarFuncionario = async () => {
    if (!nome || !email) return alert("Preencha o nome e o e-mail do funcionário.");
    const emailFormatado = email.trim().toLowerCase();
    
    try {
      await gravarFuncionario(supabase, user.id, {
        id: funcionarioEditando?.id, nome, email: emailFormatado, rotas: rotasSelecionadas
      });

      alert(funcionarioEditando ? "Rotas do funcionário atualizadas!" : "Funcionário adicionado! Ele já pode criar uma conta com esse e-mail.");
      limparFormulario();
      await carregarFuncionarios();
    } catch (e) {
      alert("Erro ao salvar funcionário: " + e.message);
    }
  };

  const removerFuncionario = async (funcId) => {
    if (!window.confirm("Remover este funcionário?")) return;
    try {
      await excluirFuncionario(supabase, user.id, funcId);
      carregarFuncionarios();
    } catch (e) {
      alert("Erro ao remover: " + e.message);
    }
  };

  const toggleRota = (clienteId) => {
    if (rotasSelecionadas.includes(String(clienteId))) {
      setRotasSelecionadas(rotasSelecionadas.filter(id => id !== String(clienteId)));
    } else {
      setRotasSelecionadas([...rotasSelecionadas, String(clienteId)]);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 font-sans pb-24 transition-colors duration-300">
      <header className="bg-white dark:bg-zinc-900/80 backdrop-blur-md sticky top-0 z-30 border-b border-zinc-200 dark:border-zinc-800/50 px-6 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className={`text-xl font-black uppercase tracking-tight ${gradText}`}>Gestão de Equipe</h1>
            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Painel Empresa</p>
          </div>
          <button onClick={() => setTela('lista')} className="text-xs font-bold text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-4 py-2 rounded-xl">Voltar</button>
        </div>
      </header>

      <main className="p-6 max-w-md mx-auto space-y-6">
        {erroCarregamento && <p role="alert" className="text-sm text-rose-500">{erroCarregamento}</p>}
        {/* Tabs */}
        <p className="text-xs text-zinc-500">Você controla os clientes, as rotas e os relatórios. O funcionário recebe os atendimentos e envia os parâmetros e fotos para sua empresa.</p>
        <button onClick={() => { setFiltroFuncionario(''); setTab('relatorios'); }} className={`w-full p-4 rounded-2xl font-bold ${gradBtn}`}>Relatórios recebidos ({relatorios.length})</button>
        <div className="flex bg-zinc-200 dark:bg-zinc-900 p-1 rounded-2xl">
          <button 
            onClick={() => setTab('equipe')} 
            className={`flex-1 py-3 text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all ${tab === 'equipe' ? 'bg-white dark:bg-zinc-800 text-teal-500 shadow-sm' : 'text-zinc-500'}`}
          >
            <Users size={18} /> Equipe
          </button>
          <button 
            onClick={() => setTab('alertas')} 
            className={`flex-1 py-3 text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all ${tab === 'alertas' ? 'bg-white dark:bg-zinc-800 text-amber-500 shadow-sm' : 'text-zinc-500'}`}
          >
            <Bell size={18} /> Alertas 
            {alertas.filter(a => !a.lido).length > 0 && (
              <span className="bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{alertas.filter(a => !a.lido).length}</span>
            )}
          </button>
        </div>

        {tab === 'relatorios' ? (
          <section className="space-y-4">
            <h2 className="font-bold text-zinc-800 dark:text-zinc-100">Relatórios dos funcionários</h2>
            <select aria-label="Filtrar relatórios por funcionário" value={filtroFuncionario} onChange={e => setFiltroFuncionario(e.target.value)} className="w-full p-3 rounded-xl bg-white dark:bg-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-800">
              <option value="">Todos os funcionários</option>
              {funcionarios.filter(f => f.usuario_id).map(f => <option key={f.id} value={f.usuario_id}>{f.nome}</option>)}
            </select>
            {loading ? <p className="text-zinc-500">Carregando relatórios...</p> : relatorios.filter(v => !filtroFuncionario || v.criado_por === filtroFuncionario).length === 0 ? <p className="text-sm text-zinc-500">Nenhum relatório recebido{filtroFuncionario ? ' deste funcionário' : ''}. Após concluir e sincronizar uma limpeza, o atendimento aparecerá aqui.</p> : relatorios.filter(v => !filtroFuncionario || v.criado_por === filtroFuncionario).map(v => {
              const nome = funcionarios.find(f => f.usuario_id === v.criado_por)?.nome || 'Funcionário (vínculo encerrado)';
              const cliente = clientes.find(c => String(c.id) === String(v.cliente_id)) || { id: v.cliente_id, nome: v.clientes?.nome || 'Cliente' };
              return <article key={v.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 space-y-2">
                <h3 className="font-bold text-zinc-800 dark:text-zinc-100">Cliente: {cliente.nome}</h3>
                <p className="text-sm text-teal-600">Responsável: {nome}</p>
                <p className="text-xs text-zinc-500">{new Date(v.data_visita).toLocaleDateString('pt-BR')} · {v.horario || ''} · {v.tipo === 'problema' ? 'Ocorrência' : 'Limpeza'}</p>
                <button onClick={() => abrirRelatorio(cliente, { visitaId: v.id, nome })} className={`w-full p-3 rounded-xl font-bold ${gradBtn}`}>Abrir relatório e fotos</button>
              </article>;
            })}
          </section>
        ) : tab === 'equipe' ? (
          <>
            {isAdding ? (
              <div className="bg-white dark:bg-zinc-900 p-5 rounded-[2rem] border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 mb-4">{funcionarioEditando ? 'Editar funcionário e rotas' : 'Novo Funcionário'}</h2>
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-teal-500 uppercase tracking-wider ml-2">Nome Completo</label>
                    <input type="text" value={nome} onChange={e => setNome(e.target.value)} className="w-full bg-slate-50 dark:bg-zinc-950/80 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl outline-none focus:border-teal-400 dark:text-white" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-teal-500 uppercase tracking-wider ml-2">E-mail de Login</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-50 dark:bg-zinc-950/80 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl outline-none focus:border-teal-400 dark:text-white" />
                    <p className="text-xs text-zinc-500 mt-2">Use exatamente o email com que o funcionário entra no app. Ao corrigir o email, as rotas passam para a conta correspondente.</p>
                  </div>
                  
                  <div className="pt-2">
                    <label className="text-[10px] font-bold text-sky-500 uppercase tracking-wider ml-2 mb-2 block">Atribuir Rotas (Clientes)</label>
                    <div className="max-h-48 overflow-y-auto space-y-2 pr-2">
                      {clientes.map(c => (
                        <button key={c.id} onClick={() => toggleRota(c.id)} className={`w-full text-left p-3 rounded-xl border flex items-center justify-between transition-colors ${rotasSelecionadas.includes(String(c.id)) ? 'bg-sky-50 dark:bg-sky-900/20 border-sky-300 dark:border-sky-700' : 'bg-transparent border-zinc-200 dark:border-zinc-800'}`}>
                          <span className={`font-bold text-sm ${rotasSelecionadas.includes(String(c.id)) ? 'text-sky-600 dark:text-sky-400' : 'text-zinc-600 dark:text-zinc-400'}`}>{c.nome}</span>
                          {rotasSelecionadas.includes(String(c.id)) && <CheckCircle size={16} className="text-sky-500" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-4">
                    <button onClick={limparFormulario} className="flex-1 py-4 rounded-2xl font-bold text-zinc-500 bg-zinc-100 dark:bg-zinc-800">Cancelar</button>
                    <button onClick={salvarFuncionario} className={`flex-1 py-4 rounded-2xl font-bold ${gradBtn}`}>Salvar</button>
                  </div>
                </div>
              </div>
            ) : (
              <button onClick={() => { limparFormulario(); setIsAdding(true); }} className="w-full bg-sky-50 dark:bg-sky-900/20 border border-dashed border-sky-300 dark:border-sky-700 p-6 rounded-[2rem] flex flex-col items-center justify-center text-sky-500 hover:bg-sky-100 dark:hover:bg-sky-900/40 transition-colors">
                <UserPlus size={32} className="mb-2" />
                <span className="font-bold">Adicionar Funcionário</span>
              </button>
            )}

            <div className="space-y-4 pt-4">
              <h2 className="text-xs font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em] ml-2">Sua Equipe</h2>
              {loading ? (
                <p className="text-center text-zinc-400">Carregando...</p>
              ) : funcionarios.length === 0 ? (
                <p className="text-center text-zinc-400 text-sm">Nenhum funcionário cadastrado.</p>
              ) : (
                funcionarios.map(f => (
                  <div key={f.id} className="bg-white dark:bg-zinc-900 p-5 rounded-[2rem] border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-wrap gap-3 items-center justify-between">
                    <div>
                      <h3 className="font-bold text-zinc-800 dark:text-zinc-100">{f.nome}</h3>
                      <p className="text-xs text-zinc-400">{f.email}</p>
                      <p className="text-[10px] font-bold text-sky-500 mt-1">{f.rotas?.length || 0} rota(s) atribuída(s)</p>
                      {!f.usuario_id && <p className="text-xs text-amber-600">Aguardando cadastro com este email confirmado.</p>}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => abrirEdicao(f)} aria-label={`Editar rotas de ${f.nome}`} className="w-10 h-10 bg-sky-50 dark:bg-sky-900/20 text-sky-500 rounded-xl flex items-center justify-center hover:bg-sky-100 dark:hover:bg-sky-900/40">
                        <Pencil size={18} />
                      </button>
                      <button onClick={() => removerFuncionario(f.id, f.email)} aria-label={`Remover ${f.nome}`} className="w-10 h-10 bg-rose-50 dark:bg-rose-900/20 text-rose-500 rounded-xl flex items-center justify-center hover:bg-rose-100 dark:hover:bg-rose-900/40">
                        <UserMinus size={18} />
                      </button>
                    </div>
                    <div className="w-full space-y-2 border-t border-zinc-100 dark:border-zinc-800 pt-3">
                      <button disabled={!f.usuario_id} onClick={() => { setFiltroFuncionario(f.usuario_id); setTab('relatorios'); }} className="text-sm font-bold text-teal-600 disabled:opacity-40">Ver relatórios de {f.nome}</button>
                      <p className="text-xs text-zinc-500">Clientes atribuídos: {(f.rotas || []).map(id => clientes.find(c => String(c.id) === String(id))?.nome || `Cliente ${id}`).join(', ') || 'Nenhum'}</p>
                      <button onClick={() => abrirEdicao(f)} className="text-xs font-bold text-sky-600">Adicionar ou retirar clientes da rota</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <h2 className="text-xs font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em] ml-2">Solicitações da Equipe</h2>
            {alertas.length === 0 ? (
              <div className="bg-white dark:bg-zinc-900 p-10 rounded-[2.5rem] border border-dashed border-zinc-200 dark:border-zinc-800 text-center">
                <ShieldAlert size={32} className="mx-auto text-emerald-500/50 mb-4" />
                <p className="text-sm font-bold text-zinc-400">Nenhum produto faltando relatado.</p>
              </div>
            ) : (
              alertas.map(a => (
                <div key={a.id} className={`bg-white dark:bg-zinc-900 p-5 rounded-[2rem] border ${a.lido ? 'border-zinc-200 dark:border-zinc-800 opacity-70' : 'border-amber-300 dark:border-amber-700 shadow-lg'} transition-all`}>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-bold text-zinc-800 dark:text-zinc-100">{a.clienteNome}</h3>
                      <p className="text-[10px] text-zinc-400 uppercase tracking-wider">{a.data} • Func: {a.funcionarioAtivo}</p>
                    </div>
                    {!a.lido && <span className="bg-amber-100 text-amber-700 text-[9px] px-2 py-1 rounded-md font-bold uppercase animate-pulse">Novo</span>}
                  </div>
                  
                  <div className="bg-slate-50 dark:bg-zinc-950/50 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800 mb-4">
                    <p className="text-xs font-bold text-zinc-500 mb-2 uppercase tracking-wider">Produtos Faltando:</p>
                    {editandoProdutos === a.id ? <div className="space-y-3">
                      {itensProdutos.map((p, i) => <div key={i} className="space-y-2 border-b border-zinc-200 dark:border-zinc-800 pb-3">
                        <input aria-label={`Produto ${i + 1}`} value={p.nome} onChange={e => setItensProdutos(prev => prev.map((item, n) => n === i ? { ...item, nome: e.target.value } : item))} className="w-full p-2 rounded-lg bg-white dark:bg-zinc-900 text-sm" />
                        <div className="flex gap-2">
                          <label className="text-xs text-zinc-500">Quantidade<input type="number" min="1" aria-label={`Quantidade do produto ${i + 1}`} value={p.qtd} onChange={e => setItensProdutos(prev => prev.map((item, n) => n === i ? { ...item, qtd: e.target.value } : item))} className="w-full p-2 rounded-lg bg-white dark:bg-zinc-900" /></label>
                          <label className="text-xs text-zinc-500">Preço unitário (R$)<input type="number" min="0" step="0.01" aria-label={`Preço do produto ${i + 1}`} value={p.preco ?? ''} onChange={e => setItensProdutos(prev => prev.map((item, n) => n === i ? { ...item, preco: e.target.value } : item))} className="w-full p-2 rounded-lg bg-white dark:bg-zinc-900" /></label>
                        </div>
                        <button onClick={() => setItensProdutos(prev => prev.filter((_, n) => n !== i))} className="text-xs text-rose-500">Remover item</button>
                      </div>)}
                      <button onClick={() => setItensProdutos(prev => [...prev, { nome: '', qtd: 1, preco: null }])} className="text-sm font-bold text-teal-600">Adicionar item</button>
                      <div className="flex gap-3">
                        <button disabled={salvandoProdutos} onClick={() => salvarProdutos(a)} className="p-3 rounded-xl bg-teal-500 text-white font-bold text-sm">{salvandoProdutos ? 'Salvando...' : 'Salvar revisão'}</button>
                        <button disabled={salvandoProdutos} onClick={() => setEditandoProdutos(null)} className="text-sm text-zinc-500">Cancelar</button>
                      </div>
                    </div> : <ul className="space-y-1">
                      {a.produtos.map((p, idx) => (
                        <li key={idx} className="text-sm text-zinc-700 dark:text-zinc-300 font-medium flex justify-between">
                          <span>{p.nome}</span>
                          <span className="text-amber-500 font-bold">{p.qtd}x</span>
                        </li>
                      ))}
                    </ul>}
                  </div>

                  {editandoProdutos !== a.id && <button onClick={() => { setEditandoProdutos(a.id); setItensProdutos(a.produtos.map(p => ({ ...p }))); }} className="text-sm font-bold text-teal-600 mb-3">Revisar produtos, quantidades e valores</button>}
                  {editandoProdutos !== a.id && <div className="flex flex-wrap gap-2">
                    {a.clienteTel && a.produtos.length > 0 && <>
                      <button onClick={() => enviarProdutos(a, false)} className="flex-1 py-3 text-xs font-bold bg-teal-50 dark:bg-teal-900/20 text-teal-600 rounded-xl">Enviar ao cliente sem valores</button>
                      <button onClick={() => enviarProdutos(a, true)} className="flex-1 py-3 text-xs font-bold bg-teal-50 dark:bg-teal-900/20 text-teal-600 rounded-xl">Enviar ao cliente com valores</button>
                    </>}
                    {!a.lido && (
                      <button onClick={() => marcarAlertaComoLido(a.id)} className="flex-1 py-3 text-xs font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700">
                        Marcar Resolvido
                      </button>
                    )}
                  </div>}
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}
