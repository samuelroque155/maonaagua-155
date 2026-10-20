import test from 'node:test';
import assert from 'node:assert/strict';
import { preencherProdutosDaEmpresa, salvarProdutosEquipe } from '../src/services/equipeService.js';

test('relatório da empresa recupera itens privados sem alterar visitas do autônomo', async () => {
  const visitas = [{ id: 'a', user_id: 'empresa', criado_por: 'funcionario', produtos: [] },
    { id: 'b', user_id: 'empresa', criado_por: 'empresa', produtos: [{ nome: 'Original' }] }];
  const client = { from: tabela => {
    assert.equal(tabela, 'alertas_produtos');
    return { select: () => ({ eq: (campo, uid) => {
      assert.equal(campo, 'user_id'); assert.equal(uid, 'empresa');
      return { in: async (chave, ids) => {
        assert.equal(chave, 'visita_id'); assert.deepEqual(ids, ['a']);
        return { data: [{ visita_id: 'a', produtos: [{ nome: 'Revisado', qtd: 2, preco: 50 }] }] };
      } };
    } }) };
  } };
  const resultado = await preencherProdutosDaEmpresa(client, 'empresa', visitas);
  assert.equal(resultado[0].produtos[0].preco, 50);
  assert.equal(resultado[1], visitas[1]);
  assert.deepEqual(visitas[0].produtos, []);
});

test('revisão altera somente produtos da visita pertencente à empresa e propaga recusa', async () => {
  const filtros = [];
  const consulta = { eq: (campo, valor) => { filtros.push([campo, valor]); return consulta; },
    select: () => ({ single: async () => ({ error: new Error('Sem permissão') }) }) };
  const client = { from: tabela => {
    assert.equal(tabela, 'visitas');
    return { update: dados => { assert.deepEqual(dados, { produtos: [{ nome: 'Cloro', qtd: 2, preco: 30 }] }); return consulta; } };
  } };
  await assert.rejects(salvarProdutosEquipe(client, 'empresa', 'visita', [{ nome: 'Cloro', qtd: '2', preco: '30' }]), /Sem permissão/);
  assert.deepEqual(filtros, [['id', 'visita'], ['user_id', 'empresa']]);
  await assert.rejects(salvarProdutosEquipe(client, 'empresa', 'visita', [{ nome: 'Cloro', qtd: -1 }]), /quantidade válida/);
});
