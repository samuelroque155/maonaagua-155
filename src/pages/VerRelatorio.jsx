import React, { useContext, useState } from 'react';
import { AppContext } from '../context/AppContext.jsx';
import { gerarRelatorioPDF } from '../services/pdfService';
import { 
  ArrowLeft, Share2, Camera, CalendarDays, Droplets, Clock, MessageSquare, Loader2, MapPin, CheckCircle, AlertTriangle
} from 'lucide-react';

export default function VerRelatorio({ setTela, cliente, historico, carregando, enviarAvisoWhatsApp }) {
  const { perfil, modoImpressao, setModoImpressao } = useContext(AppContext);
  const [loadingPDF, setLoadingPDF] = useState(false);

  const handleSharePDF = async () => {
    setLoadingPDF(true);
    await gerarRelatorioPDF(cliente, historico, perfil);
    setLoadingPDF(false);
  };

  const formatarDataCurta = (dataStr) => {
    if (!dataStr) return '';
    const partes = dataStr.split(/[/\-\s]+/);
    if (partes.length >= 2) {
      const dia = partes[0];
      const mesOriginal = partes[1].toLowerCase().trim().replace('.', '');
      
      // Tenta converter se for número
      const mesNum = parseInt(mesOriginal, 10);
      if (!isNaN(mesNum)) {
        const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
        if (mesNum >= 1 && mesNum <= 12) {
          return `${dia}/${meses[mesNum - 1]}`;
        }
      }
      
      // Se for string
      const mesesMap = {
        'jan': 'Jan', 'january': 'Jan', 'janeiro': 'Jan',
        'feb': 'Fev', 'february': 'Fev', 'fevereiro': 'Fev', 'fev': 'Fev',
        'mar': 'Mar', 'march': 'Mar', 'março': 'Mar',
        'apr': 'Abr', 'april': 'Abr', 'abril': 'Abr',
        'may': 'Mai', 'maio': 'Mai', 'mai': 'Mai',
        'jun': 'Jun', 'june': 'Jun', 'junho': 'Jun',
        'jul': 'Jul', 'july': 'Jul', 'julho': 'Jul',
        'aug': 'Ago', 'august': 'Ago', 'agosto': 'Ago', 'ago': 'Ago',
        'sep': 'Set', 'september': 'Set', 'setembro': 'Set', 'set': 'Set',
        'oct': 'Out', 'october': 'Out', 'outubro': 'Out', 'out': 'Out',
        'nov': 'Nov', 'november': 'Nov', 'novembro': 'Nov',
        'dec': 'Dez', 'december': 'Dez', 'dezembro': 'Dez', 'dez': 'Dez'
      };
      
      const mesFormatado = mesesMap[mesOriginal];
      if (mesFormatado) {
        return `${dia}/${mesFormatado}`;
      }
    }
    return dataStr;
  };

  const extrairDadosRegistro = (v) => {
    if (!v) return { hora: '', duracao: '', temp: '--' };
    let hora = '';
    let duracao = '';
    let temp;

    if (v.h) {
      const match = v.h.match(/(.*) \((.*)\)/);
      if (match) {
        hora = match[1];
        duracao = match[2];
      } else {
        hora = v.h;
      }
    }

    if (v.t) {
      const tStr = String(v.t).trim();
      if (tStr.endsWith('m')) {
        if (!duracao) {
          duracao = tStr;
        }
        temp = '--';
      } else {
        temp = tStr.includes('°') ? tStr : `${tStr}°C`;
      }
    } else {
      temp = '--';
    }

    return { hora, duracao, temp };
  };

  if (!cliente) return null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 font-sans pb-24">
       {/* UI Buttons */}
       {!modoImpressao && (
          <header className="bg-white dark:bg-zinc-900 sticky top-0 z-30 border-b border-zinc-200 dark:border-zinc-800 px-6 py-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => setTela('relatorio')} className="w-10 h-10 bg-slate-50 dark:bg-zinc-800 rounded-xl flex items-center justify-center text-zinc-500"><ArrowLeft size={20} /></button>
              <h1 className="text-xl font-black uppercase tracking-tight dark:text-white">Relatório</h1>
            </div>
          </header>
       )}

       <main className="p-6 max-w-md mx-auto space-y-6">
          <div className="flex gap-2">
            <button onClick={() => enviarAvisoWhatsApp(cliente)} className="flex-1 bg-green-500 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all">
              <MessageSquare size={18} /> WhatsApp
            </button>
            <button onClick={handleSharePDF} disabled={loadingPDF} className="flex-1 bg-zinc-800 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all disabled:opacity-50">
              {loadingPDF ? <Loader2 size={18} className="animate-spin" /> : <Share2 size={18} />} PDF Completo
            </button>
          </div>

          {/* NOVO LAYOUT DO RELATÓRIO */}
          <div className="bg-slate-50">
            {/* Card Topo */}
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-zinc-200">
               <div className="flex justify-between items-start">
                 <div className="flex-1">
                   <h2 className="text-3xl font-black text-zinc-900 leading-tight">{cliente.nome}</h2>
                   <p className="text-xs text-zinc-500 font-medium flex items-center gap-1 mt-3"><MapPin size={12} /> {cliente.endereco}</p>
                 </div>

               </div>
            </div>

            {/* HISTÓRICO DE PARÂMETROS */}
            <div className="mt-10">
              <h3 className="text-sm font-black text-zinc-800 uppercase flex items-center gap-2 mb-4">
                 <div className="bg-sky-100 text-sky-500 p-1.5 rounded-lg"><Droplets size={16}/></div> Histórico de Parâmetros
              </h3>
              
              <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-sm">
                 {carregando ? (
                    <div className="flex justify-center py-10 text-zinc-300 animate-pulse"><Loader2 size={32} className="animate-spin" /></div>
                 ) : historico.filter(v => v.tipo !== 'problema').length === 0 ? (
                    <div className="text-center py-10 text-zinc-400 text-sm">Nenhuma visita registrada este mês.</div>
                 ) : (
                    <table className="w-full text-center text-[10px]">
                      <thead className="bg-zinc-900 text-white text-[9px] uppercase tracking-wider">
                        <tr>
                          <th className="py-3 font-black px-1">Data</th>
                          <th className="py-3 font-black px-1">Status</th>
                          <th className="py-3 font-black px-1 text-sky-400">Horário</th>
                          <th className="py-3 font-black px-1">CL</th>
                          <th className="py-3 font-black px-1">PH</th>
                          <th className="py-3 font-black px-1">ALC</th>
                          <th className="py-3 font-black px-1">TEMP</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 bg-white">
                         {historico.filter(v => v.tipo !== 'problema').map((v, i) => {
                           const aspText = v.asp || v.a || '';
                           const aspLower = aspText.toLowerCase();
                           let aspColor = 'text-zinc-400';
                           if(aspLower.includes('cristalina')) aspColor = 'text-teal-500';
                           else if(aspLower.includes('verde')) aspColor = 'text-emerald-500';
                           else if(aspLower.includes('turva')) aspColor = 'text-amber-500';

                           const { hora, duracao, temp } = extrairDadosRegistro(v);

                           return (
                             <tr key={i} className="font-bold text-zinc-700">
                                <td className="py-4 px-1">{formatarDataCurta(v.d)}</td>
                                <td className={`py-4 px-1 uppercase ${aspColor}`}>{aspText}</td>
                                <td className="py-4 px-1">
                                   <div className="flex flex-col items-center">
                                     <span>{hora}</span>
                                     {duracao && <span className="text-emerald-500 text-[8px] flex items-center gap-0.5 mt-0.5"><Clock size={8}/> {duracao}</span>}
                                   </div>
                                </td>
                                <td className="py-4 px-1">{v.c}</td>
                                <td className="py-4 px-1">{v.p}</td>
                                <td className="py-4 px-1">{v.al}</td>
                                <td className="py-4 px-1">{temp}</td>
                             </tr>
                           );
                         })}
                      </tbody>
                    </table>
                 )}
              </div>
            </div>

            {/* RESUMO FOTOGRÁFICO */}
            {historico.some(v => (v.fotos && v.fotos.length > 0) || (v.fotosBase64 && v.fotosBase64.length > 0)) && (
              <div className="mt-10">
                <h3 className="text-sm font-black text-zinc-800 uppercase flex items-center gap-2 mb-4">
                   <div className="bg-emerald-100 text-emerald-500 p-1.5 rounded-lg"><Camera size={16}/></div> Resumo Fotográfico (Visitas)
                </h3>
                
                <div className="grid grid-cols-3 gap-3">
                   {historico.filter(v => v.tipo !== 'problema').map(v => {
                     const fotosPiscina = [];
                     if (v.fotosBase64 && v.fotosBase64.length > 0) fotosPiscina.push(...v.fotosBase64);
                     if (v.fotos && v.fotos.length > 0) fotosPiscina.push(...v.fotos);
                     
                     return fotosPiscina.slice(0,3).map((f, fi) => (
                       <div key={`${v.id || v.vId}-${fi}`} className="relative aspect-square rounded-2xl overflow-hidden shadow-sm">
                         <img src={f} className="w-full h-full object-cover" alt="piscina" crossOrigin="anonymous" />
                         <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
                         <span className="absolute bottom-2 left-0 right-0 text-center text-[10px] font-black text-white uppercase tracking-widest">{formatarDataCurta(v.d)}</span> 
                       </div>
                     ));
                   })}
                </div>
              </div>
            )}

            {/* OCORRÊNCIAS TÉCNICAS E ALERTAS */}
            {historico.some(v => v.tipo === 'problema' || (v.txtA && v.txtA.trim()) || (v.fotosA && v.fotosA.length > 0) || (v.fotosAlertaBase64 && v.fotosAlertaBase64.length > 0)) && (
              <div className="mt-10">
                <h3 className="text-sm font-black text-rose-600 uppercase flex items-center gap-2 mb-4">
                  <div className="bg-rose-100 text-rose-500 p-1.5 rounded-lg"><AlertTriangle size={16}/></div> Ocorrências e Alertas
                </h3>
                <div className="space-y-4">
                  {historico.filter(v => v.tipo === 'problema' || (v.txtA && v.txtA.trim()) || (v.fotosA && v.fotosA.length > 0) || (v.fotosAlertaBase64 && v.fotosAlertaBase64.length > 0)).map((o, idx) => {
                    const descTexto = o.txtA || "Nenhuma descrição fornecida.";
                    const fotosAlertaList = [];
                    if (o.fotosAlertaBase64 && o.fotosAlertaBase64.length > 0) fotosAlertaList.push(...o.fotosAlertaBase64);
                    if (o.fotosA && o.fotosA.length > 0) fotosAlertaList.push(...o.fotosA);

                    return (
                      <div key={o.id || idx} className="bg-rose-50 border border-rose-200 rounded-2xl p-4 shadow-sm">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[10px] font-black text-rose-600 uppercase tracking-wider">
                            Data: {o.d} {o.h ? `às ${o.h}` : ''}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-700 leading-relaxed font-medium mb-3">{descTexto}</p>
                        {fotosAlertaList.length > 0 && (
                          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                            {fotosAlertaList.map((f, fi) => (
                              <div key={fi} className="relative w-16 h-16 rounded-xl overflow-hidden shadow-sm border border-rose-200 flex-shrink-0">
                                <img src={f} className="w-full h-full object-cover" alt="Ocorrência" />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* RODAPÉ PRETO */}
            <div className="mt-12 bg-zinc-900 text-center p-8 rounded-t-[2rem] border-t-4 border-teal-500">
               <h3 className="text-white text-lg font-black mb-3">Obrigado pela confiança!</h3>
               <p className="text-zinc-400 text-[10px] font-medium leading-relaxed max-w-[200px] mx-auto">
                 Este serviço utiliza a tecnologia e o padrão de qualidade **Mão Na Água**.
               </p>
               <div className="mt-6 bg-zinc-800/50 rounded-xl p-4">
                  <p className="text-zinc-500 text-[8px] font-bold">
                    Para visualizar a galeria fotográfica completa em alta resolução, solicite acesso à sua pasta virtual.
                  </p>
               </div>
            </div>
          </div>
       </main>
    </div>
  );
}
