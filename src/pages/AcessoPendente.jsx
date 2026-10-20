import { useContext, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { AppContext } from '../context/AppContext';
import { checkoutKiwify } from '../services/assinaturaService';

export default function AcessoPendente({ handleSair }) {
  const { user, gradBtn, setTela, recarregarAssinatura, verificandoAssinatura, erroAssinatura } = useContext(AppContext);
  const [consultou, setConsultou] = useState(false);
  const checkout = checkoutKiwify(import.meta.env.VITE_KIWIFY_CHECKOUT_URL);
  const verificar = async () => {
    setConsultou(false);
    const ativa = await recarregarAssinatura();
    if (ativa === false) setConsultou(true);
  };
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-8 text-white text-center">
      <AlertTriangle size={64} className="text-rose-500 mb-6" />
      <h2 className="text-2xl font-black mb-4">Assinatura não ativada</h2>
      <p className="text-zinc-400 mb-3 max-w-xs">Seu login funcionou, mas sua conta ainda não tem acesso ativo registrado.</p>
      <p className="text-sm text-zinc-400 mb-6 break-all">Conta conectada: {user?.email}</p>
      <p className="text-zinc-400 mb-6 max-w-xs">Se você já pagou, confira se o email da compra é o mesmo desta conta e verifique o acesso novamente.</p>
      <p role="status" aria-live="polite" className="text-sm text-rose-300 mb-4 max-w-xs">{erroAssinatura || (consultou ? 'O acesso ainda não foi ativado no cadastro. Confira a confirmação da compra com o responsável pela assinatura.' : '')}</p>
      <button onClick={verificar} disabled={verificandoAssinatura} className={`w-full max-w-xs py-4 rounded-xl font-bold ${gradBtn} flex items-center justify-center gap-2 disabled:opacity-50`}>
        <RefreshCw size={18} className={verificandoAssinatura ? 'animate-spin' : ''} />
        {verificandoAssinatura ? 'VERIFICANDO...' : 'VERIFICAR ACESSO NOVAMENTE'}
      </button>
      {checkout && <button onClick={() => window.open(checkout, '_blank', 'noopener,noreferrer')} className="w-full max-w-xs py-4 mt-4 rounded-xl border border-teal-500 text-teal-300 font-bold">CONHECER A ASSINATURA</button>}
      <button onClick={() => setTela('configuracoes')} className="mt-6 text-teal-400 font-bold">Meu perfil</button>
      <button onClick={handleSair} className="mt-6 text-zinc-500 font-bold">Sair da conta</button>
    </div>
  );
}
