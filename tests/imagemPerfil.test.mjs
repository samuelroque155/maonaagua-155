import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { jsPDF } from 'jspdf';
import { enviarImagemPerfil, resolverImagemPerfil, caminhoImagemPerfilValido } from '../src/services/imagemPerfilService.js';
import { mapearPerfil, salvarPerfilProfissional } from '../src/services/perfilService.js';
import { desenharIdentidadeProfissional, identificacaoCliente } from '../src/services/identidadeRelatorio.js';

test('foto pertence à conta e usa upload privado, sem substituir arquivos existentes', async () => {
  const uploads = [];
  const client = { auth: { getUser: async () => ({ data: { user: { id: 'conta-a' } } }) },
    storage: { from: bucket => ({ upload: async (path, file, options) => { uploads.push({ bucket, path, file, options }); return {}; } }) } };
  const arquivo = new Blob(['imagem'], { type: 'image/png' });
  const caminho = await enviarImagemPerfil(client, 'conta-a', arquivo);
  assert.match(caminho, /^conta-a\/perfil\/.*\.png$/);
  assert.equal(uploads[0].bucket, 'fotos-visitas');
  assert.equal(uploads[0].options.upsert, false);
  await assert.rejects(enviarImagemPerfil(client, 'conta-b', arquivo), /sessão mudou/);
  await assert.rejects(enviarImagemPerfil(client, 'conta-a', new Blob(['svg'], { type: 'image/svg+xml' })), /JPEG/);
  await assert.rejects(enviarImagemPerfil(client, 'conta-a', new Blob([new Uint8Array(210 * 1024)], { type: 'image/jpeg' })), /200 KB/);
  assert.equal(uploads.length, 1);
  assert.equal(caminhoImagemPerfilValido('conta-b/perfil/x.png', 'conta-a'), false);
  assert.equal(caminhoImagemPerfilValido('conta-a/perfil/../x.png', 'conta-a'), false);
});

test('link de imagem é temporário e falha não impede perfis sem imagem', async () => {
  const client = { storage: { from: () => ({ createSignedUrl: async (path, seconds) => {
    assert.equal(path, 'a/perfil/logo.png'); assert.equal(seconds, 3600); return { data: { signedUrl: 'https://foto.test/temporaria' } };
  } }) } };
  assert.equal(await resolverImagemPerfil(client, {}), '');
  assert.equal(await resolverImagemPerfil(client, { fotoPerfilCaminho: 'a/perfil/logo.png' }), 'https://foto.test/temporaria');
  const falha = { storage: { from: () => ({ createSignedUrl: async () => ({ error: new Error('Sem rede') }) }) } };
  assert.equal(await resolverImagemPerfil(falha, { fotoPerfilCaminho: 'a/perfil/logo.png' }), '');
  await assert.rejects(resolverImagemPerfil(falha, { fotoPerfilCaminho: 'a/perfil/logo.png' }, true), /carregar sua foto/);
});

test('perfil recarregado mantém somente caminho, sem blob ou URL expirada', () => {
  const perfil = mapearPerfil({ empresa: 'Água Clara', assinatura_ativa: true }, { fotoPerfilCaminho: 'a/perfil/logo.png' },
    { fotoPerfilNova: new Blob(['x']), fotoPerfilUrl: 'https://expirada.test/' });
  assert.equal(perfil.fotoPerfilCaminho, 'a/perfil/logo.png');
  assert.equal(perfil.fotoPerfilNova, null); assert.equal(perfil.fotoPerfilUrl, '');
  assert.equal(perfil.assinaturaAtiva, true);
});

test('salvar perfil preserva foto atual e remoção grava somente preferência vazia', async () => {
  let preferencias;
  const client = { auth: {
    getUser: async () => ({ data: { user: { id: 'a', user_metadata: { preferencias_profissionais: { fotoPerfilCaminho: 'a/perfil/logo.png' } } } } }),
    updateUser: async pedido => { preferencias = pedido.data.preferencias_profissionais; return {}; }
  }, from: () => ({ upsert(payload) {
    assert.deepEqual(Object.keys(payload).sort(), ['cidade', 'empresa', 'id']);
    return { select: () => ({ single: async () => ({ data: { ...payload, assinatura_ativa: false } }) }) };
  } }) };
  const atual = await salvarPerfilProfissional(client, 'a', { empresa: 'Água Clara', cidade: 'Jataí', listaProdutos: [], listaAcessorios: [] });
  assert.equal(atual.fotoPerfilCaminho, 'a/perfil/logo.png');
  await salvarPerfilProfissional(client, 'a', { empresa: 'Água Clara', fotoPerfilRemover: true });
  assert.equal(preferencias.fotoPerfilCaminho, '');
});

test('PDF incorpora a logo e reserva espaço para nome longo; sem foto continua funcionando', async () => {
  const imagem = `data:image/png;base64,${(await readFile(new URL('../public/logo.png', import.meta.url))).toString('base64')}`;
  const pdf = new jsPDF();
  const y = desenharIdentidadeProfissional(pdf, { empresa: 'Água Clara Manutenção Profissional de Piscinas e Serviços Especializados', cidade: 'Jataí - GO' }, imagem, 15, 20, 180);
  pdf.text(identificacaoCliente({ nome: 'Ana Silva' }), 15, y + 10);
  const conteudo = pdf.output();
  assert.match(conteudo, /\/Subtype \/Image/);
  assert.match(conteudo, /Cliente: Ana Silva/);
  assert.ok(y >= 47 && y < 100);
  const semFoto = new jsPDF();
  assert.ok(desenharIdentidadeProfissional(semFoto, { empresa: 'Piscineiro' }, null, 15, 20, 180) > 20);
  assert.equal(identificacaoCliente({ nome: 'Ana Silva' }), 'Cliente: Ana Silva');
  assert.equal(identificacaoCliente({}), 'Cliente: Nome não informado');
});
