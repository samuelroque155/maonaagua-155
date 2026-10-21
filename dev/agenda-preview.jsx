// Ambiente de validação em memória. Não autentica, não grava no Supabase e não envia mensagens.
import { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { AppContext } from '../src/context/AppContext';
import Home from '../src/pages/Home';
import Agenda from '../src/pages/Agenda';
import AdiarVisita from '../src/pages/AdiarVisita';
import VerRelatorio from '../src/pages/VerRelatorio';
import { adiamentoParaRelatorio } from '../src/services/adiamentoService';
import { diaSemanaAgenda, somarDiasAgenda } from '../src/services/agendaService';
import { fileToBase64 } from '../src/utils/imageUtils';
import '../src/index.css';

export default function PreviewAgenda() {
  const [tela, setTela] = useState('lista');
  const [data, setData] = useState('2026-10-21');
  const [funcionario, setFuncionario] = useState(false);
  const [clientes, setClientes] = useState([
    { id: 1, nome: 'Ana (exemplo)', telefone: '64999999999', endereco: 'Endereço fictício', diasVisita: [3], horaVisita: '09:00', datasConcluidas: [] },
    { id: 2, nome: 'Bruno (exemplo)', telefone: '', endereco: 'Endereço fictício', diasVisita: [3], horaVisita: '10:00', datasConcluidas: [] },
    { id: 3, nome: 'Cliente de segunda', telefone: '', endereco: 'Endereço fictício', diasVisita: [1], ultimaVisita: '2026-10-19T13:00:00-03:00', datasConcluidas: ['2026-10-19'] }
  ]);
  const [adiamentos, setAdiamentos] = useState([]);
  const [cliente, setCliente] = useState(null);
  const [mensagem, setMensagem] = useState('');
  const perfil = { empresa: 'Água Clara (exemplo)', tipoConta: funcionario ? 'funcionario' : 'empresa', cidade: 'JATAÍ-GO', cidadeEmpresa: 'JATAÍ-GO', rotas: ['1', '2', '3'], listaProdutos: [], listaAcessorios: [] };
  const contexto = { user: { id: 'local-demo' }, perfil, clientes, adiamentos,
    gradText: 'text-teal-600', gradBtn: 'bg-teal-500 text-white', tela, setTela,
    diaAtual: diaSemanaAgenda(data), dataHojeISO: data, dataHojeStr: new Date(`${data}T12:00:00`).toDateString(),
    modoEscuro: false, setModoEscuro: () => {}, pendentesCount: 0, pendentesLegados: 6 };
  const historico = [...adiamentos.filter(a => a.cliente_id === cliente?.id).map(a => adiamentoParaRelatorio(a, a.fotoDemo)),
    ...(cliente?.datasConcluidas || []).map(d => ({ id: `visita:${d}`, clienteId: cliente.id, tipo: 'visita', dataISO: d, d: d.split('-').reverse().join('/'), ts: new Date(`${d}T12:00:00-03:00`).getTime(), h: '09:00 - 09:45 (45m)', p: '7.4', c: '2', al: '100', prods: [{ nome: 'Cloro', qtd: 1, preco: 99 }, { nome: 'Clarificante', qtd: 2, preco: 20 }], fotos: [], fotosA: [] }))];
  useEffect(() => {
    const abrir = window.open;
    window.open = url => { setMensagem(new URL(url).searchParams.get('text') || String(url)); return null; };
    return () => { window.open = abrir; };
  }, []);
  return <AppContext.Provider value={contexto}>
    <aside className="bg-amber-100 text-zinc-900 p-3 text-xs space-y-2">
      <p className="font-bold">PRÉVIA LOCAL · dados fictícios · nenhuma gravação ou envio externo</p>
      <div className="flex gap-3 flex-wrap items-center">
        <label>Data simulada <input aria-label="Data simulada" type="date" value={data} onChange={e => setData(e.target.value)} /></label>
        <button onClick={() => setData(d => somarDiasAgenda(d, 1))}>Avançar um dia</button>
        <button onClick={() => { setFuncionario(v => !v); setTela('lista'); }}>{funcionario ? 'Testar como empresa' : 'Testar como funcionário'}</button>
        <button onClick={() => { setClientes(prev => prev.map((c, i) => i === 0 ? { ...c, datasConcluidas: [...new Set([...c.datasConcluidas, data])] } : c)); setTela('lista'); }}>Finalizar Ana (simulação)</button>
        <button onClick={() => { setCliente(clientes[0]); setTela('historico'); }}>Histórico de Ana</button>
        <button onClick={() => setTela('lista')}>Agenda inicial</button>
      </div>
    </aside>
    {tela === 'adiar' ? <AdiarVisita key={data} cliente={cliente} dataOriginal={data} voltar={() => setTela('lista')} salvar={async valores => {
      const agora = `${data}T09:20:00-03:00`;
      const fotoDemo = valores.foto ? await fileToBase64(valores.foto) : '';
      setAdiamentos(prev => [...prev, { id: crypto.randomUUID(), user_id: 'local-demo', criado_por: 'local-demo', cliente_id: cliente.id, data_original: data, horario_original: cliente.horaVisita, nova_data: valores.novaData, motivo: valores.motivo, criado_em: agora, comparecimento_em: valores.compareceu ? agora : null, fotoDemo }]); setTela('lista');
    }} /> : tela === 'agenda' ? <Agenda setTela={setTela} /> : tela === 'historico' ? <VerRelatorio cliente={cliente} historico={historico} setTela={setTela} editarVisitaFinalizada={() => setMensagem('Prévia: edição existente preservada.')} /> : <Home iniciarVisita={c => setMensagem(`Prévia: iniciar limpeza de ${c.nome}`)} setTela={setTela} adiarVisita={c => { setCliente(c); setTela('adiar'); }} />}
    {mensagem && <dialog open className="fixed inset-0 m-auto bg-white p-5 border rounded-2xl max-w-md w-full z-[200] shadow-lg"><h2 className="font-bold mb-3">Prévia local — nenhuma mensagem enviada</h2><pre className="whitespace-pre-wrap text-sm">{mensagem}</pre><button onClick={() => setMensagem('')} className="mt-4 p-2 bg-teal-500 text-white rounded-lg">Fechar prévia</button></dialog>}
  </AppContext.Provider>;
}
createRoot(document.getElementById('root')).render(<PreviewAgenda />);
