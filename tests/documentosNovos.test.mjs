import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';
import { jsPDF } from 'jspdf';
import { criarOcorrenciaPDF } from '../src/services/ocorrenciaPdfService.js';
import { criarOrcamentoPDF, validarAnexoPDF, validarOrcamento } from '../src/services/orcamentoService.js';
import { mapearPerfil } from '../src/services/perfilService.js';
import { resumoLembrete, salvarLembretes, lerLembretes } from '../src/services/lembretesService.js';
import { configurarPush } from '../src/services/pushService.js';

test('preços de acessórios sobrevivem ao mapeamento sem mudar o catálogo antigo', () => {
  const perfil = mapearPerfil({ empresa: 'Empresa' }, { listaAcessorios: ['Peneira'], precosAcessorios: { Peneira: 49.9 } });
  assert.equal(perfil.precosAcessorios.Peneira, 49.9);
  assert.deepEqual(perfil.listaAcessorios, ['Peneira']);
  assert.deepEqual(mapearPerfil(null).precosAcessorios, {});
});
test('PDF técnico tem alerta, cliente, empresa, texto e imagem; texto longo pagina', async () => {
  const imagem = `data:image/png;base64,${(await readFile(new URL('../public/logo.png', import.meta.url))).toString('base64')}`;
  const perfil = { empresa: 'Empresa de exemplo', cidade: 'Jatai - GO', fotoPerfilUrl: imagem };
  const registro = { d: '21/10/2026', h: '09:10', txtA: 'Vazamento identificado no filtro.', fotosAlertaBase64: [imagem] };
  const blob = await criarOcorrenciaPDF({ nome: 'Ana' }, registro, perfil);
  const bytes = Buffer.from(await blob.arrayBuffer());
  assert.match(bytes.toString('latin1'), /ATENCAO: OCORRENCIA TECNICA/);
  assert.match(bytes.toString('latin1'), /Empresa de exemplo/);
  assert.match(bytes.toString('latin1'), /Cliente: Ana/);
  assert.match(bytes.toString('latin1'), /Vazamento identificado/);
  assert.match(bytes.toString('latin1'), /\/Subtype \/Image/);
  const longo = await criarOcorrenciaPDF({ nome: 'Ana' }, { ...registro, txtA: 'Problema identificado. '.repeat(1200) }, perfil);
  assert.ok((await PDFDocument.load(await longo.arrayBuffer())).getPageCount() > 2);
  if (process.env.PREVIEW_PDF) { await mkdir('tmp/pdfs', { recursive: true }); await writeFile('tmp/pdfs/ocorrencia-tecnica.pdf', bytes); }
});
test('orçamento cria apresentação e copia páginas do PDF sem alterar o anexo', async () => {
  const original = new jsPDF(); original.text('Detalhes do orcamento anexo', 15, 20);
  const anexo = original.output('blob');
  const antes = Buffer.from(await anexo.arrayBuffer());
  await validarAnexoPDF(anexo);
  const dados = { nome: 'Cliente avulso', descricao: 'Troca do filtro e instalacao.', valor: '250.50', pdf: anexo };
  const blob = await criarOrcamentoPDF(dados, { empresa: 'Empresa de exemplo', cidade: 'Jatai' });
  assert.equal((await PDFDocument.load(await blob.arrayBuffer())).getPageCount(), 2);
  assert.deepEqual(Buffer.from(await anexo.arrayBuffer()), antes);
  await assert.rejects(validarAnexoPDF(new Blob(['nao e PDF'])), /arquivo válido/);
  assert.throws(() => validarOrcamento({ nome: 'Ana', descricao: 'Filtro', valor: -1 }), /valor válido/);
  if (process.env.PREVIEW_PDF) await writeFile('tmp/pdfs/orcamento-avulso.pdf', Buffer.from(await blob.arrayBuffer()));
});
test('lembrete segue horário brasileiro, pendências e opção desligar', () => {
  const clientes = [{ id: 1, diasVisita: [3] }, { id: 2, diasVisita: [3], datasConcluidas: ['2026-10-21'] }];
  const opcoes = { ativo: true, horario: '08:00' };
  assert.equal(resumoLembrete(clientes, [], opcoes, new Date('2026-10-21T10:59:00Z')), null);
  assert.match(resumoLembrete(clientes, [], opcoes, new Date('2026-10-21T11:00:00Z')).texto, /1 piscina/);
  assert.equal(resumoLembrete(clientes, [{ cliente_id: 1, data_original: '2026-10-21', nova_data: '2026-10-23' }], opcoes, new Date('2026-10-21T11:00:00Z')), null);
  assert.equal(resumoLembrete(clientes, [], { ...opcoes, ativo: false }, new Date('2026-10-21T11:00:00Z')), null);
  const mapa = new Map(); const storage = { getItem: k => mapa.get(k), setItem: (k, v) => mapa.set(k, v) };
  salvarLembretes('u1', opcoes, storage);
  assert.deepEqual(lerLembretes('u1', storage), opcoes);
  assert.equal(lerLembretes('u2', storage).ativo, false);
});
test('cancelar push remove entrega do aparelho e ativação sem servidor não vira sucesso', async () => {
  let cancelada = false;
  const inscricao = { endpoint: 'https://fcm.googleapis.com/exemplo', unsubscribe: async () => { cancelada = true; } };
  const registro = { pushManager: { getSubscription: async () => inscricao } };
  const ambiente = { navigator: { serviceWorker: { ready: Promise.resolve(registro), getRegistration: async () => registro } } };
  const client = { from: () => ({ update: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }) }) };
  await configurarPush(client, 'u1', { ativo: false }, '', ambiente);
  assert.equal(cancelada, true);
  await assert.rejects(configurarPush(client, 'u1', { ativo: true }, '', ambiente), /ativados no servidor/);
});
