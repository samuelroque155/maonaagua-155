import test from 'node:test';
import assert from 'node:assert/strict';
import { cadastrarComEmail, mensagemErroAuth } from '../src/services/authService.js';
import { aplicarContextoEquipe } from '../src/services/equipeService.js';

test('cadastro novo pede confirmação sem gravar perfil nem autenticar por senha', async () => {
  const client = { auth: { signUp: async pedido => {
    assert.deepEqual(pedido, { email: 'novo@example.test', password: 'senha123', options: { emailRedirectTo: 'https://maonaagua.com/' } });
    return { data: { user: { identities: [{ provider: 'email' }] }, session: null }, error: null };
  } } };
  assert.match(await cadastrarComEmail(client, { email: ' Novo@example.test ', senha: 'senha123', redirectTo: 'https://maonaagua.com/' }), /confirmar o cadastro/);
});

test('recadastro ocultado pelo Auth orienta usar a conta existente sem sobrescrever senha', async () => {
  const client = { auth: { signUp: async () => ({ data: { user: { identities: [] }, session: null } }) } };
  assert.match(await cadastrarComEmail(client, { email: 'google@example.test', senha: 'senha123' }), /já está cadastrado/);
  assert.match(mensagemErroAuth({ code: 'invalid_credentials' }), /Google/);
  assert.match(mensagemErroAuth({ code: 'user_already_exists' }), /já está cadastrado/);
});

test('validação local e erros do Auth não viram cadastro bem sucedido', async () => {
  const client = { auth: { signUp: async () => { throw new Error('Não deveria chamar'); } } };
  await assert.rejects(cadastrarComEmail(client, { email: 'incorreto', senha: 'senha123' }), /email válido/);
  await assert.rejects(cadastrarComEmail(client, { email: 'novo@example.test', senha: '123' }), /6 caracteres/);
  const erro = { code: 'weak_password' };
  client.auth.signUp = async () => ({ error: erro });
  await assert.rejects(cadastrarComEmail(client, { email: 'novo@example.test', senha: 'senha123' }), e => e === erro);
  assert.match(mensagemErroAuth(erro), /requisitos de segurança/);
  assert.match(mensagemErroAuth({ code: 'email_not_confirmed' }), /Confirme/);
  assert.match(mensagemErroAuth({ code: 'email_address_not_authorized' }), /SMTP/);
});

test('vínculo prevalece após cada login e remoção devolve perfil próprio', () => {
  for (const tipoConta of ['autonomo', 'empresa', null]) {
    const proprio = { tipoConta, empresa: 'Profissional' };
    const vinculo = { employer_uid: 'empresa', rotas: ['1'] };
    assert.equal(aplicarContextoEquipe(proprio, vinculo).tipoConta, 'funcionario');
    assert.equal(aplicarContextoEquipe(proprio, vinculo).vinculoEmpresa, 'empresa');
    assert.equal(aplicarContextoEquipe(proprio, null).tipoConta, tipoConta);
    assert.deepEqual(aplicarContextoEquipe(proprio, null).rotas, []);
  }
  assert.equal(aplicarContextoEquipe({ tipoConta: 'funcionario' }, null).tipoConta, null);
});
