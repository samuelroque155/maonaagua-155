import test from 'node:test';
import assert from 'node:assert/strict';
import { verificarGoogleDisponivel, mensagemErroAuth } from '../src/services/authService.js';
import { consultarAssinatura, checkoutKiwify, temAcessoAoApp } from '../src/services/assinaturaService.js';

test('acesso exige assinatura ativa ou papel administrativo do servidor', () => {
  assert.equal(temAcessoAoApp({ id: 'u1' }, { assinaturaAtiva: false }), false);
  assert.equal(temAcessoAoApp({ id: 'u1' }, { assinaturaAtiva: true }), true);
  assert.equal(temAcessoAoApp({ id: 'dono', app_metadata: { role: 'admin' } }, { assinaturaAtiva: false }), true);
  assert.equal(temAcessoAoApp({ id: 'u1', email: 'dono@exemplo.com', user_metadata: { role: 'admin', assinaturaAtiva: true } }, { assinaturaAtiva: false }), false);
  assert.equal(temAcessoAoApp(null, { assinaturaAtiva: true }), false);
});

test('Google desabilitado é informado antes do redirecionamento', async () => {
  let consultou = false;
  await assert.rejects(verificarGoogleDisponivel({
    supabaseUrl: 'https://projeto.supabase.co', publishableKey: 'chave-publica-ficticia',
    fetcher: async (url, options) => {
      consultou = true;
      assert.equal(url, 'https://projeto.supabase.co/auth/v1/settings');
      assert.equal(options.headers.apikey, 'chave-publica-ficticia');
      return { ok: true, json: async () => ({ external: { google: false } }) };
    }
  }), /provider is not enabled/);
  assert.equal(consultou, true);
  assert.match(mensagemErroAuth({ code: 400, error_code: 'validation_failed', msg: 'Unsupported provider: provider is not enabled' }), /habilitado no Supabase/);
});

test('Google habilitado segue; falha da consulta não vira liberação', async () => {
  await verificarGoogleDisponivel({ supabaseUrl: 'https://projeto.supabase.co', publishableKey: 'publica', fetcher: async () => ({ ok: true, json: async () => ({ external: { google: true } }) }) });
  await assert.rejects(verificarGoogleDisponivel({ supabaseUrl: 'https://projeto.supabase.co', publishableKey: 'publica', fetcher: async () => ({ ok: false }) }), /Não foi possível verificar/);
});

function mockAssinatura(usuario, resposta, erro = null) {
  const chamadas = [];
  const client = {
    auth: { getUser: async () => ({ data: { user: usuario }, error: null }) },
    from(tabela) {
      chamadas.push(tabela);
      return { select(colunas) {
        chamadas.push(colunas);
        return { eq(campo, valor) {
          chamadas.push([campo, valor]);
          return { maybeSingle: async () => ({ data: resposta, error: erro }) };
        } };
      } };
    }
  };
  return { client, chamadas };
}

test('atualização de acesso consulta somente a própria assinatura, sem gravar', async () => {
  const mock = mockAssinatura({ id: 'u1' }, { id: 'u1', assinatura_ativa: false });
  assert.equal(await consultarAssinatura(mock.client, 'u1'), false);
  assert.deepEqual(mock.chamadas, ['perfis', 'id, assinatura_ativa', ['id', 'u1']]);
  const pago = mockAssinatura({ id: 'u1' }, { id: 'u1', assinatura_ativa: true });
  assert.equal(await consultarAssinatura(pago.client, 'u1'), true);
});

test('conta trocada, resposta de outro usuário e perfil ausente não liberam acesso', async () => {
  const outra = mockAssinatura({ id: 'u2' }, null);
  await assert.rejects(consultarAssinatura(outra.client, 'u1'), /sessão mudou/);
  assert.deepEqual(outra.chamadas, []);
  for (const resposta of [null, { id: 'u2', assinatura_ativa: true }, { id: 'u1', assinatura_ativa: 'true' }]) {
    await assert.rejects(consultarAssinatura(mockAssinatura({ id: 'u1' }, resposta).client, 'u1'), /Não foi possível confirmar/);
  }
});

test('erro de rede não é tratado como assinatura paga nem como cancelamento confirmado', async () => {
  const mock = mockAssinatura({ id: 'u1' }, null, new Error('rede indisponível'));
  await assert.rejects(consultarAssinatura(mock.client, 'u1'), /rede indisponível/);
});

test('contratação só abre um checkout real e HTTPS da Kiwify', () => {
  for (const url of ['', undefined, 'https://kiwify.com.br', 'javascript:alert(1)', 'http://pay.kiwify.com.br/produto', 'https://pay.kiwify.com.br.evil.com/produto', 'https://pay.kiwify.com.br/']) {
    assert.equal(checkoutKiwify(url), null);
  }
  assert.equal(checkoutKiwify('https://pay.kiwify.com.br/exemplo-teste'), 'https://pay.kiwify.com.br/exemplo-teste');
});
