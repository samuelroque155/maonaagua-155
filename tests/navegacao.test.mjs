import test from 'node:test';
import assert from 'node:assert/strict';
import { criarHistoricoTelas, registrarVoltarWeb, executarVoltar, registrarVoltarAndroid } from '../src/services/navegacaoService.js';

test('Voltar percorre as telas anteriores e não sai da agenda inicial', () => {
  const nav = criarHistoricoTelas();
  nav.navegar('gestao_equipe'); nav.navegar('ver_relatorio'); nav.navegar('editar_visita');
  assert.equal(nav.voltar(), 'ver_relatorio');
  assert.equal(nav.voltar(), 'gestao_equipe');
  assert.equal(nav.voltar(), 'lista');
  assert.equal(nav.voltar(), 'lista');
});

test('salvar ou voltar pela seta não reabre limpezas finalizadas e telas de outra conta', () => {
  const nav = criarHistoricoTelas();
  nav.navegar('relatorio'); nav.navegar('ver_relatorio'); nav.navegar('editar_visita');
  nav.navegar('ver_relatorio');
  assert.equal(nav.voltar(), 'relatorio');
  nav.navegar('visita'); nav.navegar('lista');
  assert.equal(nav.voltar(), 'lista');
  nav.navegar('configuracoes'); nav.navegar('lista');
  assert.equal(nav.voltar(), 'lista');
});

test('botão do sistema usa a pausa existente e aguarda o salvamento, sem descartar limpeza', async () => {
  let pausas = 0, voltas = 0, cancelamentos = 0, avisos = 0;
  const opcoes = { tela: 'visita', salvando: false, pausarVisita: async () => { pausas++; },
    voltarTela: () => { voltas++; }, cancelarEdicao: () => { cancelamentos++; }, avisarInicio: () => { avisos++; } };
  await executarVoltar({ ...opcoes, salvando: true }); assert.equal(pausas, 0);
  await executarVoltar(opcoes); assert.equal(pausas, 1); assert.equal(voltas, 0);
  await executarVoltar({ ...opcoes, tela: 'editar_visita' }); assert.equal(cancelamentos, 1);
  await executarVoltar({ ...opcoes, tela: 'configuracoes' }); assert.equal(voltas, 1);
  await executarVoltar({ ...opcoes, tela: 'lista' }); assert.equal(avisos, 1); assert.equal(voltas, 1);
});

test('PWA mantém uma proteção de histórico e preserva os dados de estado existentes', () => {
  const entradas = [{ outraPreferencia: true }];
  const listeners = new Map(); let acoes = 0;
  const janela = { history: {
    get state() { return entradas.at(-1); },
    replaceState(s) { entradas[entradas.length - 1] = s; }, pushState(s) { entradas.push(s); }
  }, addEventListener: (e, fn) => listeners.set(e, fn), removeEventListener: e => listeners.delete(e) };
  const limpar = registrarVoltarWeb(janela, () => acoes++);
  assert.equal(entradas.length, 2);
  assert.equal(janela.history.state.outraPreferencia, true);
  for (let i = 0; i < 5; i++) { entradas.pop(); listeners.get('popstate')(); }
  assert.equal(acoes, 5); assert.equal(entradas.length, 2);
  limpar(); assert.equal(listeners.size, 0);
  registrarVoltarWeb(janela, () => {});
  assert.equal(entradas.length, 2); // Recarregar não acumula entradas.
});

test('Android remove o listener mesmo se o componente fechar durante o registro', async () => {
  let concluir; let removidos = 0;
  const parar = registrarVoltarAndroid({ addListener: (nome, fn) => {
    assert.equal(nome, 'backButton'); assert.equal(typeof fn, 'function');
    return new Promise(resolve => { concluir = resolve; });
  } }, () => {});
  parar(); concluir({ remove: () => removidos++ });
  await Promise.resolve(); assert.equal(removidos, 1);
});
