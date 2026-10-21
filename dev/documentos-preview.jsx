import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../src/index.css';
import { AppContext } from '../src/context/AppContext.jsx';
import Configuracoes from '../src/pages/Configuracoes.jsx';
import NovoCliente from '../src/pages/NovoCliente.jsx';
import Visita from '../src/pages/Visita.jsx';
import { salvarArquivoLocal, lerArquivoLocal } from '../src/services/arquivoLocalService';

const usuario = { id: 'previa-documentos-ficticios' };
const imagem = await fetch('/logo.png').then(r => r.blob()).then(b => new Promise(resolve => { const f = new FileReader(); f.onload = () => resolve(f.result); f.readAsDataURL(b); }));
if (!await lerArquivoLocal(usuario.id, 'ocorrencia', `${usuario.id}:previa-cliente:nova`)) await salvarArquivoLocal(usuario.id, 'ocorrencia', `${usuario.id}:previa-cliente:nova`, {
 foto: { base64: imagem, url: imagem, status: 'ready' }, texto: 'Vazamento identificado no filtro. Necessária avaliação técnica.',
 registro: { d: '21/10/2026', h: '09:10', txtA: 'Vazamento identificado no filtro. Necessária avaliação técnica.', fotosAlertaBase64: [imagem] }
});
export default function Previa() {
 const [escuro, setEscuro] = useState(true);
 const [tela, setTela] = useState('configuracoes');
 const [perfil, setPerfil] = useState({ empresa: 'Empresa de exemplo', cidade: 'Jataí - GO', tipoConta: 'autonomo', fotoPerfilUrl: imagem, listaProdutos: ['Cloro'], listaAcessorios: ['Peneira', 'Aspirador'], precosProdutos: { Cloro: 50 }, precosAcessorios: { Peneira: 49.9 } });
 const [textoAlerta, setTextoAlerta] = useState('');
 const noop = () => {};
 return <div className={escuro ? 'dark' : ''}><AppContext.Provider value={{ user: usuario, targetUid: usuario.id, perfil, setPerfil, gradText: 'text-teal-500', gradBtn: 'bg-teal-500 text-white', nomeEmpresaSalvo: perfil.empresa, definirTipoPerfil: noop }}>
 <nav className="sticky top-0 z-50 bg-slate-100 p-3 flex flex-wrap gap-3 text-sm"><span>Dados fictícios</span><button onClick={() => setEscuro(atual => !atual)}>{escuro ? 'Usar tema claro' : 'Usar tema escuro'}</button><button onClick={() => setTela('configuracoes')}>Configurações</button><button onClick={() => setTela('novo_cliente')}>Novo cliente</button><button onClick={() => setTela('visita')}>Ocorrência</button><a href="/tmp/pdfs/ocorrencia-tecnica.pdf">PDF técnico</a><a href="/tmp/pdfs/orcamento-avulso.pdf">PDF orçamento</a></nav>
 {tela === 'configuracoes' ? <Configuracoes setTela={setTela} salvarConfiguracoes={() => alert('Simulação: nada enviado ao Supabase.')} handleSair={noop} /> : tela === 'visita' ? <Visita setTela={setTela} clienteAtual={{ id: 'previa-cliente', nome: 'Ana (exemplo)', endereco: 'Endereço fictício' }} salvarVisita={noop} handleNovaFoto={noop} removerFoto={noop} handleFotoAlerta={noop} removerFotoAlerta={noop} toggleProduto={noop} updateQtdProduto={noop} aspecto="Cristalina" setAspecto={noop} ph="7.4" setPh={noop} cloro="2" setCloro={noop} alcalinidade="100" setAlcalinidade={noop} temperatura="28" setTemperatura={noop} fotosVisita={[]} fotosContagem={0} fotosAlerta={[]} textoAlerta={textoAlerta} setTextoAlerta={setTextoAlerta} produtosFaltando={[]} salvando={false} updatePrecoProduto={noop} pausarVisita={() => setTela('configuracoes')} enviarOcorrenciaImediata={async () => false} /> : <NovoCliente setTela={setTela} adicionarCliente={() => alert('Simulação: cliente não cadastrado.')} />}
 </AppContext.Provider></div>;
}
createRoot(document.getElementById('root')).render(<Previa />);
