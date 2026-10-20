import test from 'node:test';
import assert from 'node:assert/strict';
import { RETORNO_ANDROID, enderecoRetorno, lerRetornoAuth, criarProcessadorRetorno, mensagemErroAuth } from '../src/services/authService.js';
import { mapearPerfil, salvarPerfilProfissional, salvarTipoPerfil } from '../src/services/perfilService.js';
import { mensagemProdutos, resumirProdutos, urlWhatsApp } from '../src/services/whatsappService.js';

test('Google retorna ao navegador atual ou ao deep link exato do Android', () => {
  assert.equal(enderecoRetorno({ nativo: false, origem: 'http://localhost:5173', base: '/' }), 'http://localhost:5173/');
  assert.equal(enderecoRetorno({ nativo: false, origem: 'https://exemplo.com', base: '/app/' }), 'https://exemplo.com/app/');
  assert.equal(enderecoRetorno({ nativo: true, origem: 'https://localhost' }), RETORNO_ANDROID);
  assert.deepEqual(lerRetornoAuth(RETORNO_ANDROID + '?code=retorno', RETORNO_ANDROID), { code: 'retorno' });
  for (const url of ['outro://auth/callback?code=x', 'com.maonaagua.app://outro/callback?code=x', 'com.maonaagua.app://auth/outro?code=x']) {
    assert.equal(lerRetornoAuth(url, RETORNO_ANDROID), null);
  }
});

test('trata erro do Google no fragmento ou na query', () => {
  for (const separador of ['?', '#']) {
    const retorno = lerRetornoAuth(RETORNO_ANDROID + separador + 'error=access_denied&error_description=Login+cancelado', RETORNO_ANDROID);
    assert.equal(retorno.erro.message, 'Login cancelado');
  }
  assert.match(mensagemErroAuth({ message: 'provider is not enabled' }), /habilitado no Supabase/);
  assert.match(mensagemErroAuth({ code: 'email_not_confirmed' }), /Confirme seu email/);
  assert.match(mensagemErroAuth({ code: 'over_email_send_rate_limit' }), /Aguarde/);
  assert.match(mensagemErroAuth({ message: 'Email address not authorized' }), /SMTP próprio/);
});

test('cold start e appUrlOpen trocam o mesmo código uma única vez', async () => {
  const codigos = [];
  const processar = criarProcessadorRetorno({ auth: { exchangeCodeForSession: async code => {
    codigos.push(code); return { error: null };
  } } });
  assert.deepEqual(await Promise.all([processar(RETORNO_ANDROID + '?code=x'), processar(RETORNO_ANDROID + '?code=x')]), [true, true]);
  assert.deepEqual(codigos, ['x']);
  assert.equal(await processar('outro://auth/callback?code=x'), false);
});

test('erro de troca de código chega à tela e não vira sucesso', async () => {
  const processar = criarProcessadorRetorno({ auth: { exchangeCodeForSession: async () => ({ error: new Error('expired') }) } });
  await assert.rejects(processar(RETORNO_ANDROID + '?code=x'), /expired/);
});

function clientePerfil(inicial, usuario = { id: 'u1', user_metadata: {} }) {
  let registro = inicial ? structuredClone(inicial) : null;
  const escritas = [];
  const preferencias = [];
  const client = {
    auth: {
      getUser: async () => ({ data: { user: usuario }, error: null }),
      updateUser: async data => { preferencias.push(data); return { error: null }; }
    },
    from(tabela) {
      assert.equal(tabela, 'perfis');
      let acao = 'read';
      let payload;
      const filtros = [];
      const builder = {
        select() { return builder; },
        eq(campo, valor) { filtros.push([campo, valor]); return builder; },
        is(campo, valor) { filtros.push([campo, valor]); return builder; },
        update(valor) { acao = 'update'; payload = valor; return builder; },
        insert(valor) { acao = 'insert'; payload = valor; return builder; },
        upsert(valor) { acao = 'upsert'; payload = valor; return builder; },
        async maybeSingle() {
          if (acao !== 'read') {
            escritas.push({ acao, payload, filtros });
            registro = { assinatura_ativa: false, empresa: 'Minha Piscina', cidade: 'Brasil', ...registro, ...payload };
          } else assert.ok(filtros.some(([campo, valor]) => campo === 'id' && valor === 'u1'));
          return { data: structuredClone(registro), error: null };
        },
        single() { return builder.maybeSingle(); }
      };
      return builder;
    }
  };
  return { client, escritas, preferencias, registro: () => registro };
}

test('nome e tipo voltam do perfil sem email nem padrão sobrepor nome salvo', () => {
  const perfil = mapearPerfil({ empresa: 'Água Clara Serviços', tipo_conta: 'Autônomo', assinatura_ativa: false }, {}, { empresa: 'Padrão' });
  assert.equal(perfil.empresa, 'Água Clara Serviços');
  assert.equal(perfil.tipoConta, 'autonomo');
  assert.equal(perfil.assinaturaAtiva, false);
  assert.equal(mapearPerfil({ empresa: 'pessoa@exemplo.com' }).empresa, '');
  assert.equal(mapearPerfil(null).tipoConta, null);
});

test('primeiro login salva somente a escolha; acessos seguintes preservam perfil', async () => {
  const mock = clientePerfil(null);
  const novo = await salvarTipoPerfil(mock.client, 'u1', 'empresa', true);
  assert.equal(novo.tipo_conta, 'empresa');
  assert.equal(novo.assinatura_ativa, false);
  assert.deepEqual(mock.escritas[0].payload, { id: 'u1', tipo_conta: 'empresa' });
  await salvarTipoPerfil(mock.client, 'u1', 'autonomo', true);
  assert.equal(mock.registro().tipo_conta, 'empresa');
  assert.equal(mock.escritas.length, 1);
});

test('conta existente sem tipo recebe escolha sem perder nome, cidade ou assinatura', async () => {
  const mock = clientePerfil({ id: 'u1', empresa: 'Água Clara', cidade: 'Jataí', tipo_conta: null, assinatura_ativa: true });
  await salvarTipoPerfil(mock.client, 'u1', 'autonomo', true);
  assert.equal(mock.registro().empresa, 'Água Clara');
  assert.equal(mock.registro().cidade, 'Jataí');
  assert.equal(mock.registro().assinatura_ativa, true);
  assert.deepEqual(mock.escritas[0].filtros, [['id', 'u1'], ['tipo_conta', null]]);
});

test('salvar profissional não envia campos de autorização nem clientes ou visitas', async () => {
  const mock = clientePerfil({ id: 'u1', tipo_conta: 'empresa', assinatura_ativa: false, vinculo_empresa: null, rotas: ['rota'] });
  const salvo = await salvarPerfilProfissional(mock.client, 'u1', {
    empresa: '  Água Clara  ', cidade: 'Jataí', listaProdutos: ['Cloro'], listaAcessorios: ['Peneira'], assinaturaAtiva: true
  });
  assert.deepEqual(mock.escritas[0].payload, { id: 'u1', empresa: 'Água Clara', cidade: 'Jataí' });
  assert.equal(salvo.assinaturaAtiva, false);
  assert.equal(salvo.tipoConta, 'empresa');
  assert.deepEqual(salvo.rotas, ['rota']);
  assert.deepEqual(mock.preferencias[0].data.preferencias_profissionais.listaProdutos, ['Cloro']);
});

test('sessão de outra conta impede qualquer gravação de perfil', async () => {
  const mock = clientePerfil(null, { id: 'u2' });
  await assert.rejects(salvarTipoPerfil(mock.client, 'u1', 'empresa'), /sessão mudou/);
  await assert.rejects(salvarPerfilProfissional(mock.client, 'u1', { empresa: 'X' }), /sessão mudou/);
  assert.equal(mock.escritas.length, 0);
  assert.equal(mock.preferencias.length, 0);
});

const dadosMensagem = {
  cliente: { nome: 'Ana' }, perfil: { empresa: 'Água Clara' },
  produtos: [{ nome: 'Cloro', qtd: 2, preco: 39.9 }, { nome: 'Peneira', qtd: 1, preco: null }]
};

test('lista sem valores contém somente nomes dos itens e o nome profissional', () => {
  const mensagem = mensagemProdutos(dadosMensagem);
  assert.match(mensagem, /Água Clara/);
  assert.match(mensagem, /• Cloro\n• Peneira/);
  assert.doesNotMatch(mensagem, /R\$|total|39|2x|preço/);
});

test('lista com valores identifica preço faltante sem inventar total', () => {
  const mensagem = mensagemProdutos({ ...dadosMensagem, comValores: true });
  assert.match(mensagem, /39,90/);
  assert.match(mensagem, /79,80/);
  assert.match(mensagem, /Peneira — preço não informado/);
  assert.match(mensagem, /Total da lista pendente/);
  assert.doesNotMatch(mensagem, /\*Total da lista:/);
  assert.equal(resumirProdutos([{ qtd: 3, preco: '0,10' }]).total, 0.3);
  assert.equal(resumirProdutos([{ preco: 0 }, { preco: '' }, { preco: -1 }]).semPreco, 3);
});

test('lista completa soma quantidades e recusa assinatura com email', () => {
  const mensagem = mensagemProdutos({ ...dadosMensagem, produtos: [dadosMensagem.produtos[0]], comValores: true });
  assert.match(mensagem, /Total da lista: R\$\s79,80/);
  assert.throws(() => mensagemProdutos({ ...dadosMensagem, perfil: { empresa: 'conta@exemplo.com' } }), /Cadastre e salve/);
  assert.throws(() => mensagemProdutos({ ...dadosMensagem, produtos: [] }), /Selecione/);
});

test('link WhatsApp mantém acentos e trata DDD 55 sem confundir país', () => {
  const url = new URL(urlWhatsApp('(55) 99999-1111', 'Olá! Água Clara'));
  assert.equal(url.searchParams.get('phone'), '5555999991111');
  assert.equal(url.searchParams.get('text'), 'Olá! Água Clara');
  assert.equal(new URL(urlWhatsApp('+55 64 99999-1111', 'X')).searchParams.get('phone'), '5564999991111');
  assert.equal(new URL(urlWhatsApp('', 'X')).searchParams.has('phone'), false);
});
