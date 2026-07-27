import React, { useContext, useState } from 'react';
import { AppContext } from '../context/AppContext.jsx';
import { 
  ArrowLeft
} from 'lucide-react';

export default function NovoCliente({ setTela, adicionarCliente, clienteExistente = null, salvarEdicaoCliente }) {
  const { gradText, gradBtn } = useContext(AppContext);
  const diasDaSemanaNomes = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

  const [nome, setNome] = useState(clienteExistente?.nome || '');
  const [rua, setRua] = useState(clienteExistente?.rua || '');
  const [numero, setNumero] = useState(clienteExistente?.numero || '');
  const [bairro, setBairro] = useState(clienteExistente?.bairro || '');
  const [hora, setHora] = useState(clienteExistente?.horaVisita || '');
  const [dias, setDias] = useState(clienteExistente?.diasVisita || []);
  const [telefone, setTelefone] = useState(clienteExistente?.telefone || '');

  const alternarDia = (i) => {
    if (dias.includes(i)) setDias(dias.filter(d => d !== i));
    else setDias([...dias, i]);
  };

  const handleSalvar = () => {
    const dados = { nome, rua, numero, bairro, dias, hora, telefone };
    if (clienteExistente) salvarEdicaoCliente(clienteExistente.id, dados);
    else adicionarCliente(dados);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 p-6 text-zinc-900 dark:text-zinc-100 max-w-md mx-auto font-sans pb-10 transition-colors duration-300">
      <header className="flex items-center gap-4 mb-10 mt-2">
        <button onClick={() => setTela(clienteExistente ? 'relatorio' : 'lista')} className="p-2 text-zinc-500 dark:text-zinc-400 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm"><ArrowLeft size={20} /></button>
        <h2 className={`text-2xl font-black ${gradText}`}>{clienteExistente ? 'Editar Cadastro' : 'Novo Cliente'}</h2>
      </header>

      <div className="space-y-6">
        <div className="space-y-2">
          <span className="text-xs font-bold text-teal-600 dark:text-teal-500 ml-2 uppercase tracking-wider">Nome Completo</span>
          <input placeholder="Ex: Samuel Silva" value={nome} onChange={e => setNome(e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-[1.25rem] outline-none focus:border-teal-400 text-zinc-900 dark:text-white transition-all shadow-sm" />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-bold text-teal-600 dark:text-teal-500 ml-2 uppercase tracking-wider">Rua</span>
          <input placeholder="Ex: Rua das Flores" value={rua} onChange={e => setRua(e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-[1.25rem] outline-none focus:border-teal-400 text-zinc-900 dark:text-white transition-all shadow-sm" />
        </div>

        <div className="flex gap-3">
          <div className="space-y-2 flex-1">
            <span className="text-xs font-bold text-teal-600 dark:text-teal-500 ml-2 uppercase tracking-wider">Número</span>
            <input placeholder="Ex: 123" value={numero} onChange={e => setNumero(e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-[1.25rem] outline-none focus:border-teal-400 text-zinc-900 dark:text-white transition-all shadow-sm" />
          </div>
          <div className="space-y-2 flex-[2]">
            <span className="text-xs font-bold text-teal-600 dark:text-teal-500 ml-2 uppercase tracking-wider">Bairro</span>
            <input placeholder="Ex: Setor Central" value={bairro} onChange={e => setBairro(e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-[1.25rem] outline-none focus:border-teal-400 text-zinc-900 dark:text-white transition-all shadow-sm" />
          </div>
        </div>

        <div className="space-y-2">
          <span className="text-xs font-bold text-teal-600 dark:text-teal-500 ml-2 uppercase tracking-wider">Hora da Visita</span>
          <input type="time" value={hora} onChange={e => setHora(e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-[1.25rem] outline-none focus:border-teal-400 text-zinc-900 dark:text-white transition-all shadow-sm" />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-bold text-teal-600 dark:text-teal-500 ml-2 uppercase tracking-wider">Telefone / WhatsApp</span>
          <input placeholder="Ex: 5564999999999" value={telefone} onChange={e => setTelefone(e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-[1.25rem] outline-none focus:border-teal-400 text-zinc-900 dark:text-white transition-all shadow-sm" />
        </div>

        <div className="pt-4">
          <p className="text-xs font-bold text-teal-600 dark:text-teal-500 mb-3 ml-2 uppercase tracking-wider">Dias de Limpeza Mensal</p>
          <div className="grid grid-cols-4 gap-2.5">
            {diasDaSemanaNomes.map((d, i) => (
              <button key={i} onClick={() => alternarDia(i)} className={`py-3.5 rounded-[1rem] text-xs font-bold border transition-all ${dias.includes(i) ? gradBtn + " shadow-md" : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:border-teal-300'}`}>{d.substring(0, 3)}</button>
            ))}
          </div>
        </div>

        <button onClick={handleSalvar} className={`w-full py-5 rounded-[1.25rem] font-bold text-lg mt-8 ${gradBtn}`}>{clienteExistente ? 'SALVAR ALTERAÇÕES' : 'CADASTRAR CLIENTE'}</button>
      </div>
    </div>
  );
}
