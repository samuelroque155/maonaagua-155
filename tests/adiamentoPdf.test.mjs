import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { jsPDF } from 'jspdf';
import { desenharAdiamentosPDF } from '../src/services/adiamentoRelatorio.js';
import { gerarRelatorioPDF } from '../src/services/pdfService.js';

test('PDF preserva motivo longo, datas, status e foto com paginação sem ultrapassar as margens', async () => {
  const pdf = new jsPDF();
  const desenhados = [];
  const original = pdf.text.bind(pdf);
  pdf.text = (texto, x, y, ...opcoes) => { desenhados.push({ texto, x, y }); return original(texto, x, y, ...opcoes); };
  const imagem = `data:image/png;base64,${(await readFile(new URL('../public/logo.png', import.meta.url))).toString('base64')}`;
  const registro = { dataOriginal: '2026-10-21', novaData: '2026-10-23', criadoEm: '2026-10-21T12:30:00Z',
    horarioOriginal: '09:00', comparecimentoEm: '2026-10-21T12:30:00Z', motivo: 'Portão fechado. '.repeat(160), imagensPrincipais: [imagem], fotos: ['foto'] };
  const y = desenharAdiamentosPDF(pdf, [registro], { y: 250 });
  assert.ok(pdf.getNumberOfPages() >= 2); assert.ok(y <= 282);
  assert.ok(desenhados.every(d => d.y >= 20 && d.y <= 282));
  const texto = desenhados.map(d => d.texto).join('\n');
  assert.match(texto, /Visita adiada/); assert.match(texto, /21\/10\/2026/); assert.match(texto, /23\/10\/2026/); assert.match(texto, /Comparecimento/);
  assert.match(pdf.output(), /\/Subtype \/Image/);
  assert.doesNotMatch(texto, /pH|Cloro|concluída/);
});

test('gerador completo inclui adiamento e foto sem misturá-los aos parâmetros da limpeza', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  let arquivo;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {
    canShare: () => true, share: async ({ files }) => { arquivo = Buffer.from(await files[0].arrayBuffer()); }
  } });
  try {
    const imagem = `data:image/png;base64,${(await readFile(new URL('../public/logo.png', import.meta.url))).toString('base64')}`;
    await gerarRelatorioPDF({ nome: 'Ana', endereco: 'Endereco de exemplo' }, [
      { tipo: 'visita', d: '23/10/2026', p: '7.4', c: '2', asp: 'Cristalina', fotos: [], fotosA: [] },
      { tipo: 'adiamento', dataOriginal: '2026-10-21', novaData: '2026-10-23', horarioOriginal: '09:00', motivo: 'Portao fechado', criadoEm: '2026-10-21T12:20:00Z', comparecimentoEm: '2026-10-21T12:20:00Z', fotos: [imagem], fotosA: [] }
    ], { empresa: 'Empresa de exemplo', cidade: 'Jatai' });
    const texto = arquivo.toString('latin1');
    assert.match(texto, /HISTORICO DE ADIAMENTOS/); assert.match(texto, /Portao fechado/);
    assert.match(texto, /Visita adiada/); assert.match(texto, /\/Subtype \/Image/);
    assert.match(texto, /HISTORICO DE PARAMETROS/);
  } finally {
    if (original) Object.defineProperty(globalThis, 'navigator', original);
    else delete globalThis.navigator;
  }
});
