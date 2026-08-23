import React, { useContext, useState, useEffect } from 'react';
import { AppContext } from '../context/AppContext.jsx';
import { 
  ArrowLeft, Camera, AlertTriangle, Droplets, ShoppingCart, Check, Minus, Plus, Trash2, Wrench, Loader2, Clock, Pause, Send
} from 'lucide-react';
import { compressImage, fileToBase64 } from '../utils/imageUtils';

export default function Visita({ 
  setTela, clienteAtual, salvarVisita, handleNovaFoto, removerFoto, 
  handleFotoAlerta, removerFotoAlerta, toggleProduto, updateQtdProduto,
  aspecto, setAspecto, ph, setPh, cloro, setCloro, alcalinidade, setAlcalinidade,
  temperatura, setTemperatura, fotosVisita, fotosContagem, fotosAlerta, textoAlerta, setTextoAlerta,
  produtosFaltando, salvando,
  updatePrecoProduto, pausarVisita, enviarOcorrenciaImediata
}) {
  const { perfil, gradBtn } = useContext(AppContext);
  const gradIconBg = "bg-teal-500/10 text-teal-500";

  const [segundosExibicao, setSegundosExibicao] = useState(0);
  const [fotoOcorrencia, setFotoOcorrencia] = useState(null);
  const [textoOcorrencia, setTextoOcorrencia] = useState('');
  const [enviandoOcorrencia, setEnviandoOcorrencia] = useState(false);

  useEffect(() => {
    const tempoAcumulado = clienteAtual?.tempoTrabalhadoAcumulado || 0;
    const inicioMs = clienteAtual?.horaInicioVisitaMs || Date.now();
    
    const atualizarTimer = () => {
      const agora = Date.now();
      const decorrido = Math.floor((agora - inicioMs) / 1000);
      setSegundosExibicao(tempoAcumulado + Math.max(0, decorrido));
    };

    atualizarTimer();
    const interval = setInterval(atualizarTimer, 1000);
    return () => clearInterval(interval);
  }, [clienteAtual]);

  const formatarTempo = (totalSegundos) => {
    const horas = Math.floor(totalSegundos / 3600);
    const minutos = Math.floor((totalSegundos % 3600) / 60);
    const segundos = totalSegundos % 60;
    
    const zeroPad = (num) => String(num).padStart(2, '0');
    if (horas > 0) {
      return `${zeroPad(horas)}:${zeroPad(minutos)}:${zeroPad(segundos)}`;
    }
    return `${zeroPad(minutos)}:${zeroPad(segundos)}`;
  };

  const enviarPedidoWhatsApp = () => {
    if (produtosFaltando.length === 0) return alert("Selecione pelo menos um produto/acessório para fazer o pedido.");
    let msg = `Olá, ${clienteAtual.nome}! 🌊\n`;
    msg += `Gostaria de solicitar a reposição dos seguintes itens para a sua piscina:\n\n`;
    let total = 0;
    produtosFaltando.forEach(p => {
      const itemTotal = p.qtd * (p.preco || 0);
      total += itemTotal;
      msg += `• ${p.qtd}x ${p.nome}${p.preco ? ` - R$ ${p.preco.toFixed(2)} un. (Subtotal: R$ ${itemTotal.toFixed(2)})` : ''}\n`;
    });
    msg += `\n*Valor Total: R$ ${total.toFixed(2)}*\n\n`;
    msg += `Podemos confirmar o pedido?`;
    
    let fone = clienteAtual.telefone || '';
    fone = fone.replace(/\D/g, '');
    if (fone && !fone.startsWith('55') && fone.length >= 10) {
      fone = '55' + fone;
    }
    
    const url = fone 
      ? `https://wa.me/${fone}?text=${encondeURLComponent(msg)}`
      : `https://wa.me/?tet=${encondeURLComponent(msg)}`;
      
    window.open(url, '_blank');
  };

  const handleFotoOcorrenciaInput = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const localUrl = URL.createObjectURL(file);
      setFotoOcorrencia({ url: localUrl, status: 'compressing' });
      try {
        const compressedFile = await compressImage(file);
        const base64 = await fileToBase64(compressedFile);
        const compressedUrl = URL.createObjectURL(compressedFile);
        setFotoOcorrencia({ url: compressedUrl, base64, status: 'ready' });
      } catch (error) {
        console.error("Erro na compressão da ocorrência:", error);
        setFotoOcorrencia({ url: localUrl, status: 'error' });
      }
    }
  };

  const salvarEEnviarOcorrencia = async () => {
    if (!fotoOcorrencia || fotoOcorrencia.status !== 'ready') {
      return alert("Tire ou anexe uma foto antes de relatar a ocorrência.");
    }
    if (!textoOcorrencia.trim()) {
      return alert("Por favor, descreva o problema/defeito constatado.");
    }
    
    setEnviandoOcorrencia(true);
    const sucesso = await enviarOcorrenciaImediata(fotoOcorrencia.base64, textoOcorrencia.trim());
    setEnviandoOcorrencia(false);
    if (sucesso) {
      setFotoOcorrencia(null);
      setTextoOcorrencia('');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 max-w-md mx-auto pb-32 font-sans transition-colors duration-300">
      <header className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between sticky top-0 z-20 shadow-sm dark:shadow-none">
        <div className="flex items-center gap-2">
          <button onClick={pausarVisita} className="p-2 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"><ArrowLeft size={20} /></button>
          <div className="flex flex-col">
            <h2 className="font-black text-sm text-teal-600 dark:text-teal-400 line-clamp-1">{clienteAtual?.nome}</h2>
            <div className="flex items-center gap-1 text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
              <Clock size={10} className="text-teal-500" />
              <span>{formatarTempo(segundosExibicao)}</span>
            </div>
          </div>
        </div>
        <button onClick={pausarVisita} className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/25 rounded-lg text-xs font-bold transition-all">
          <Pause size={12} />
          PAUSAR
        </button>
      </header>

      <div className="p-5 space-y-8">
        <section>
          <label className="block text-xs font-bold text-teal-600 dark:text-teal-500 mb-3 uppercase tracking-wider">Aspecto da Água</label>
          <div className="grid grid-cols-3 gap-3">
            {['Cristalina', 'Turva', 'Verde'].map(opt => (
              <button key={opt} onClick={() => setAspecto(opt)} className={`py-4 rounded-[1.25rem] font-bold text-sm transition-all ${aspecto === opt ? gradBtn + " shadow-md" : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 hover:border-teal-300'}`}>{opt}</button>
            ))}
          </div>
        </section>

        <section className="bg-white dark:bg-zinc-900 p-6 rounded-[1.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm transition-colors relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-sky-400/10 to-transparent rounded-bl-full pointer-events-none"></div>
          <div className="flex justify-between items-center mb-5">
            <h3 className="font-bold flex items-center gap-2.5 text-zinc-800 dark:text-zinc-200"><div className={`p-1.5 rounded-lg ${gradIconBg}`}><Camera size={16} /></div> Fotos Principais (Mín. 3)</h3>
            <span className={`text-xs px-2.5 py-1 rounded-md font-bold uppercase tracking-wider ${fotosContagem >= 3 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border border-rose-200 dark:border-rose-800'}`}>{fotosContagem}/3</span>
          </div>
          <label className="w-full bg-slate-50 dark:bg-zinc-950 border-2 border-dashed border-teal-300/50 dark:border-teal-700/50 py-10 rounded-[1.25rem] flex flex-col items-center gap-3 text-teal-500 cursor-pointer hover:bg-teal-50 dark:hover:bg-teal-900/10 transition-colors">
            <Camera size={36} className="text-teal-400" /> <span className="text-sm font-bold tracking-wide">Adicionar Foto da Piscina</span>
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleNovaFoto} />
          </label>          {fotosVisita.length > 0 && (
            <div className="flex gap-3 overflow-x-auto mt-5 pb-2 scrollbar-hide">
              {fotosVisita.map((foto, index) => (
                <div key={foto.id || index} className={`relative min-w-[80px] h-20 rounded-xl overflow-hidden border shadow-sm flex-shrink-0 ${(foto.status === 'uploading' || foto.status === 'compressing') ? 'border-teal-400' : foto.status === 'error' ? 'border-rose-500' : 'border-zinc-200 dark:border-zinc-700'}`}>
                  <img src={foto.url} className="w-full h-full object-cover" alt={`Foto ${index + 1}`} />
                  {(foto.status === 'uploading' || foto.status === 'compressing') && (
                    <div className="absolute inset-0 bg-zinc-950/50 flex items-center justify-center">
                      <Loader2 className="animate-spin text-teal-400" size={18} />
                    </div>
                  )}
                  {foto.status === 'error' && (
                    <div className="absolute inset-0 bg-rose-950/50 flex items-center justify-center">
                      <AlertTriangle className="text-rose-500 animate-pulse" size={18} />
                    </div>
                  )}
                  <button onClick={() => removerFoto(index)} className="absolute top-1 right-1 bg-rose-500/90 text-white rounded-md p-1 shadow-sm hover:bg-rose-600 transition-colors backdrop-blur-sm"><Trash2 size={12} /></button>
                </div>
              ))}
            </div>
          )}
        </section>
 
        <section className="bg-white dark:bg-zinc-900 p-6 rounded-[1.5rem] border border-rose-200 dark:border-rose-900/30 relative overflow-hidden transition-colors shadow-sm">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-rose-400 to-rose-600"></div>
          <h3 className="font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-2.5 mb-4 ml-3">
            <div className="p-1.5 rounded-lg bg-rose-100 dark:bg-rose-900/30 text-rose-500">
              <AlertTriangle size={16} />
            </div> 
            Ocorrência Técnica (Envio Imediato)
          </h3>
          
          <label className="ml-3 w-[calc(100%-12px)] bg-slate-50 dark:bg-zinc-950 border-2 border-dashed border-rose-300/50 dark:border-rose-700/50 py-8 rounded-[1.25rem] flex flex-col items-center gap-3 text-rose-500 cursor-pointer hover:bg-rose-50 dark:hover:bg-rose-900/10 transition-colors">
            <Camera size={30} className="text-rose-400" />
            <span className="text-sm font-bold tracking-wide">Tirar Foto do Problema</span>
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFotoOcorrenciaInput} />
          </label>

          {fotoOcorrencia && (
            <div className="ml-3 mr-3 mt-4 flex items-center gap-3">
              <div className={`relative w-20 h-20 rounded-xl overflow-hidden border shadow-sm flex-shrink-0 ${fotoOcorrencia.status === 'compressing' ? 'border-rose-400 animate-pulse' : fotoOcorrencia.status === 'error' ? 'border-rose-500' : 'border-zinc-200 dark:border-zinc-700'}`}>
                <img src={fotoOcorrencia.url} className="w-full h-full object-cover" alt="Ocorrência" />
                {fotoOcorrencia.status === 'compressing' && (
                  <div className="absolute inset-0 bg-zinc-950/50 flex items-center justify-center">
                    <Loader2 className="animate-spin text-rose-400" size={18} />
                  </div>
                )}
                <button onClick={() => setFotoOcorrencia(null)} className="absolute top-1 right-1 bg-rose-500/90 text-white rounded-md p-1 shadow-sm hover:bg-rose-600 transition-colors"><Trash2 size={12} /></button>
              </div>
              <span className="text-xs text-zinc-500 font-medium">Foto pronta para envio.</span>
            </div>
          )}

          <div className="ml-3 mr-3 mt-4">
            <textarea 
              placeholder="Descreva o problema (Ex: Motor barulhento, vazamento no filtro, peça quebrada...)" 
              value={textoOcorrencia} 
              onChange={e => setTextoOcorrencia(e.target.value)} 
              className="w-full bg-slate-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-4 rounded-[1.25rem] text-sm outline-none focus:border-rose-400 text-zinc-800 dark:text-zinc-200 min-h-[100px] transition-all shadow-inner" 
            />
          </div>

          <div className="ml-3 mr-3 mt-3">
            <button
              onClick={salvarEEnviarOcorrencia}
              disabled={enviandoOcorrencia || !fotoOcorrencia || fotoOcorrencia.status !== 'ready' || !textoOcorrencia.trim()}
              className="w-full py-3.5 bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white font-bold rounded-xl shadow-md disabled:opacity-50 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-sm"
            >
              {enviandoOcorrencia ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  ENVIANDO...
                </>
              ) : (
                <>
                  <Send size={16} />
                  ENVIAR OCORRÊNCIA AGORA
                </>
              )}
            </button>
          </div>
        </section>

        <section className="space-y-4">
          <p className="text-xs font-bold text-teal-600 dark:text-teal-500 uppercase tracking-wider flex items-center gap-2"><Droplets size={14} /> Parâmetros da Água</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5"><span className="text-[10px] text-zinc-500 dark:text-zinc-400 text-center font-bold tracking-widest uppercase">pH</span><input type="number" placeholder="7.2" value={ph} onChange={e => setPh(e.target.value)} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-[1.25rem] text-center focus:border-teal-400 outline-none text-teal-600 dark:text-teal-400 font-bold text-lg shadow-sm" /></div>
            <div className="flex flex-col gap-1.5"><span className="text-[10px] text-zinc-500 dark:text-zinc-400 text-center font-bold tracking-widest uppercase">Cloro</span><input type="number" placeholder="2.0" value={cloro} onChange={e => setCloro(e.target.value)} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-[1.25rem] text-center focus:border-sky-400 outline-none text-sky-600 dark:text-sky-400 font-bold text-lg shadow-sm" /></div>
            <div className="flex flex-col gap-1.5"><span className="text-[10px] text-zinc-500 dark:text-zinc-400 text-center font-bold tracking-widest uppercase">Alc</span><input type="number" placeholder="100" value={alcalinidade} onChange={e => setAlcalinidade(e.target.value)} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-[1.25rem] text-center focus:border-emerald-400 outline-none text-emerald-600 dark:text-emerald-400 font-bold text-lg shadow-sm" /></div>
          </div>
          <div className="mt-4">
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-bold tracking-widest block mb-1.5 ml-2 uppercase">Temperatura da Água (°C)</span>
            <input type="number" placeholder="28" value={temperatura} onChange={e => setTemperatura(e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-[1.25rem] focus:border-orange-400 outline-none text-orange-600 dark:text-orange-400 font-bold text-lg shadow-sm" />
          </div>
        </section>

        <section className="bg-white dark:bg-zinc-900 p-6 rounded-[1.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm transition-colors relative overflow-hidden">
          <p className="font-bold text-sm mb-5 flex items-center gap-2.5 text-zinc-800 dark:text-zinc-200"><div className={`p-1.5 rounded-lg ${gradIconBg}`}><ShoppingCart size={16} /></div> Produtos a Repor</p>
          <div className="space-y-3">
            {perfil.listaProdutos.map(q => {
              const item = produtosFaltando.find(p => p.nome === q);
              return (
                <div key={q} className={`flex flex-col p-3 rounded-[1.25rem] border transition-colors ${item ? 'bg-gradient-to-r from-sky-50 to-teal-50 dark:from-sky-900/10 dark:to-teal-900/10 border-teal-300 dark:border-teal-700/50' : 'bg-slate-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800'}`}>
                  <div className="flex items-center justify-between">
                    <button onClick={() => toggleProduto(q)} className="flex items-center gap-3.5 flex-1 text-left">
                      <div className={`w-6 h-6 rounded-md flex items-center justify-center border ${item ? 'bg-gradient-to-br from-sky-400 to-teal-400 border-transparent' : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900'}`}>{item && <Check size={14} className="text-white font-black" />}</div>
                      <span className={`text-sm font-medium ${item ? 'text-teal-800 dark:text-teal-300 font-bold' : 'text-zinc-600 dark:text-zinc-400'}`}>{q}</span>
                    </button>
                    {item && (
                      <div className="flex flex-col items-end gap-2 bg-white dark:bg-zinc-900 rounded-xl p-1.5 border border-teal-100 dark:border-teal-800">
                        <div className="flex items-center gap-3">
                          <button onClick={() => updateQtdProduto(q, -1)} className="w-8 h-8 flex items-center justify-center bg-slate-50 dark:bg-zinc-800 rounded-lg text-zinc-700 dark:text-zinc-300"><Minus size={14} /></button>
                          <span className="font-bold text-sm w-4 text-center text-teal-700 dark:text-teal-400">{item.qtd}</span>
                          <button onClick={() => updateQtdProduto(q, 1)} className="w-8 h-8 flex items-center justify-center bg-slate-50 dark:bg-zinc-800 rounded-lg text-zinc-700 dark:text-zinc-300"><Plus size={14} /></button>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 border-t border-zinc-100 dark:border-zinc-800 pt-1.5 w-full justify-end">
                          <span className="text-[10px] text-zinc-500 font-bold">R$</span>
                          <input 
                            type="number" 
                            placeholder="Preço un." 
                            value={item.preco || ''} 
                            onChange={e => updatePrecoProduto(q, parseFloat(e.target.value) || 0)} 
                            className="w-20 bg-slate-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs font-bold rounded-lg p-1.5 text-center outline-none focus:border-teal-400 text-zinc-800 dark:text-zinc-200"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="bg-white dark:bg-zinc-900 p-6 rounded-[1.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm transition-colors relative overflow-hidden">
          <p className="font-bold text-sm mb-5 flex items-center gap-2.5 text-zinc-800 dark:text-zinc-200"><div className={`p-1.5 rounded-lg ${gradIconBg}`}><Wrench size={16} /></div> Acessórios a Repor</p>
          <div className="space-y-3">
            {perfil.listaAcessorios?.map(q => {
              const item = produtosFaltando.find(p => p.nome === q);
              return (
                <div key={q} className={`flex flex-col p-3 rounded-[1.25rem] border transition-colors ${item ? 'bg-gradient-to-r from-sky-50 to-teal-50 dark:from-sky-900/10 dark:to-teal-900/10 border-teal-300 dark:border-teal-700/50' : 'bg-slate-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800'}`}>
                  <div className="flex items-center justify-between">
                    <button onClick={() => toggleProduto(q)} className="flex items-center gap-3.5 flex-1 text-left">
                      <div className={`w-6 h-6 rounded-md flex items-center justify-center border ${item ? 'bg-gradient-to-br from-sky-400 to-teal-400 border-transparent' : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900'}`}>{item && <Check size={14} className="text-white font-black" />}</div>
                      <span className={`text-sm font-medium ${item ? 'text-teal-800 dark:text-teal-300 font-bold' : 'text-zinc-600 dark:text-zinc-400'}`}>{q}</span>
                    </button>
                    {item && (
                      <div className="flex flex-col items-end gap-2 bg-white dark:bg-zinc-900 rounded-xl p-1.5 border border-teal-100 dark:border-teal-800">
                        <div className="flex items-center gap-3">
                          <button onClick={() => updateQtdProduto(q, -1)} className="w-8 h-8 flex items-center justify-center bg-slate-50 dark:bg-zinc-800 rounded-lg text-zinc-700 dark:text-zinc-300"><Minus size={14} /></button>
                          <span className="font-bold text-sm w-4 text-center text-teal-700 dark:text-teal-400">{item.qtd}</span>
                          <button onClick={() => updateQtdProduto(q, 1)} className="w-8 h-8 flex items-center justify-center bg-slate-50 dark:bg-zinc-800 rounded-lg text-zinc-700 dark:text-zinc-300"><Plus size={14} /></button>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 border-t border-zinc-100 dark:border-zinc-800 pt-1.5 w-full justify-end">
                          <span className="text-[10px] text-zinc-500 font-bold">R$</span>
                          <input 
                            type="number" 
                            placeholder="Preço un." 
                            value={item.preco || ''} 
                            onChange={e => updatePrecoProduto(q, parseFloat(e.target.value) || 0)} 
                            className="w-20 bg-slate-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs font-bold rounded-lg p-1.5 text-center outline-none focus:border-teal-400 text-zinc-800 dark:text-zinc-200"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {produtosFaltando.length > 0 && (
          <section className="bg-gradient-to-br from-teal-500/5 to-emerald-500/5 dark:from-teal-950/10 dark:to-emerald-950/10 p-6 rounded-[1.5rem] border border-teal-200 dark:border-teal-800/50 shadow-sm transition-colors relative overflow-hidden flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Total do Pedido:</span>
              <span className="text-lg font-black text-teal-600 dark:text-teal-400">
                R$ {produtosFaltando.reduce((acc, curr) => acc + (curr.qtd * (curr.preco || 0)), 0).toFixed(2)}
              </span>
            </div>
            <button
              onClick={enviarPedidoWhatsApp}
              className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-sm"
            >
              <Send size={16} />
              SOLICITAR PRODUTOS VIA WHATSAPP
            </button>
          </section>
        )}

        <button 
          onClick={salvarVisita} 
          disabled={salvando}
          className={`w-full py-5 rounded-[1.25rem] font-bold text-lg mt-8 ${gradBtn} disabled:opacity-50 flex items-center justify-center gap-2`}
        >
          {salvando ? (
            <>
              <Loader2 className="animate-spin" size={20} />
              SALVANDO VISITA...
            </>
          ) : (
            "SALVAR E FINALIZAR"
          )}
        </button>
      </div>
    </div>
  );
}
