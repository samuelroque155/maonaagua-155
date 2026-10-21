export function criarHistoricoTelas(inicial = 'lista') {
  let telas = [inicial];
  const atual = () => telas[telas.length - 1];
  return {
    atual,
    navegar(destino) {
      const proxima = typeof destino === 'function' ? destino(atual()) : destino;
      if (typeof proxima !== 'string' || !proxima) return atual();
      const indice = telas.lastIndexOf(proxima);
      if (proxima === inicial) telas = [inicial];
      else if (indice >= 0) telas = telas.slice(0, indice + 1);
      else telas.push(proxima);
      return atual();
    },
    voltar() {
      if (telas.length > 1) telas.pop();
      return atual();
    }
  };
}

// O navegador precisa de uma entrada interna para o Voltar do Android/PWA.
// As telas continuam em memória: um relatório encerrado nunca é reaberto pelo histórico do navegador.
export function registrarVoltarWeb(janela, voltar) {
  const marca = 'maoNaAguaVoltar';
  const estado = () => janela.history.state && typeof janela.history.state === 'object' ? janela.history.state : {};
  if (estado()[marca] !== 'ativo') {
    janela.history.replaceState({ ...estado(), [marca]: 'base' }, '');
    janela.history.pushState({ ...estado(), [marca]: 'ativo' }, '');
  }
  const aoVoltar = () => {
    // Recoloca a proteção antes de qualquer salvamento assíncrono da limpeza.
    janela.history.pushState({ ...estado(), [marca]: 'ativo' }, '');
    voltar();
  };
  janela.addEventListener('popstate', aoVoltar);
  return () => janela.removeEventListener('popstate', aoVoltar);
}

export async function executarVoltar({ tela, salvando, pausarVisita, cancelarEdicao, voltarTela, avisarInicio }) {
  if (salvando) return;
  if (tela === 'visita') return pausarVisita();
  if (tela === 'editar_visita') return cancelarEdicao();
  if (tela === 'lista') return avisarInicio();
  return voltarTela();
}

export function registrarVoltarAndroid(app, voltar, aoErro = console.error) {
  let ativo = true;
  let listener;
  app.addListener('backButton', voltar).then(handle => {
    if (ativo) listener = handle;
    else handle.remove();
  }).catch(aoErro);
  return () => { ativo = false; listener?.remove(); };
}
