import test from 'node:test';
import assert from 'node:assert/strict';
import { criarBancoSupabaseTeste } from './helpers/supabaseFixture.mjs';

const owner = '11111111-1111-4111-8111-111111111111';
const worker = '22222222-2222-4222-8222-222222222222';
const other = '33333333-3333-4333-8333-333333333333';

test('migração SQL: empresa, funcionário, rotas, fotos, alertas e revogação com RLS real', async () => {
  const db = await criarBancoSupabaseTeste();
  try {
    const asUser = async (id, fn, role = 'authenticated') => {
      await db.exec(`begin; set local role ${role}; select set_config('request.jwt.claim.sub','${id}',true);`);
      try { return await fn(); } finally { await db.exec('rollback'); }
    };
    const rows = async sql => (await db.query(sql)).rows;
    // Convite persistido em memória para as verificações seguintes.
    await db.exec(`begin; set local role authenticated; select set_config('request.jwt.claim.sub','${owner}',true);
      insert into equipes_links(nome,email_funcionario,employer_uid,rotas) values('Piscineiro',' WORKER@example.test ','${owner}','["1"]');commit;`);
    await asUser(owner, async () => {
      assert.equal((await rows('select * from equipes_links')).length, 1);
      await assert.rejects(db.exec(`insert into equipes_links(nome,email_funcionario,employer_uid,rotas) values('X','x@example.test','${owner}','["3"]')`), /rotas precisam/);
    });
    await asUser(worker, async () => {
      assert.deepEqual((await rows('select id from clientes order by id')).map(r => r.id), [1]);
      const contexto = await rows('select * from contexto_equipe()');
      assert.equal(contexto[0].employer_uid, owner);
      assert.equal(contexto[0].assinatura_ativa, true);
      assert.equal((await rows('select * from equipes_links')).length, 0);
      const painel = (await rows('select dados_equipe() as dados'))[0].dados;
      assert.equal(painel.empresa.nome, 'Empresa');
      assert.deepEqual(painel.funcionarios, []);
    });
    await db.exec(`begin; set local role authenticated; select set_config('request.jwt.claim.sub','${worker}',true);
      insert into visitas(id,user_id,cliente_id,produtos,fotos) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','${owner}',1,'[{"nome":"Cloro","qtd":2}]','["${worker}/visitas/foto.jpg"]');commit;`);
    await db.exec(`update perfis set tipo_conta='autonomo' where id='${owner}'`);
    await asUser(worker, async () => {
      assert.deepEqual((await rows('select id from clientes order by id')).map(r => r.id), [1]);
      assert.equal((await rows('select tipo_conta from perfis'))[0].tipo_conta, 'autonomo');
      assert.equal((await rows('select * from contexto_equipe()'))[0].employer_uid, owner);
      await db.exec(`insert into visitas(user_id,cliente_id) values('${owner}',1)`);
    });
    await db.exec(`insert into storage.objects(bucket_id,name) values('fotos-visitas','${worker}/visitas/foto.jpg'),('fotos-visitas','${other}/visitas/privada.jpg');`);
    await asUser(owner, async () => {
      assert.equal((await rows('select * from visitas')).length, 1);
      const painel = (await rows('select dados_equipe() as dados'))[0].dados;
      assert.equal(painel.funcionarios[0].usuario_id, worker);
      assert.equal(painel.empresa, null);
      // O dono mantém o controle da equipe mesmo no modo autônomo.
      await db.exec(`update equipes_links set rotas='[]'`);
      assert.equal((await rows('select * from visitas')).length, 1);
      assert.equal((await rows('select * from alertas_produtos'))[0].funcionario_nome, 'Piscineiro');
      await db.exec(`update visitas set produtos='[{"nome":"Cloro revisado pela empresa","qtd":3,"preco":70}]'`);
      assert.equal((await rows('select produtos from alertas_produtos'))[0].produtos[0].preco, 70);
      assert.equal((await rows('select * from storage.objects')).length, 1);
      await db.exec('update alertas_produtos set lido=true');
    });
    await asUser(other, async () => {
      assert.equal((await rows('select * from visitas')).length, 0);
      assert.equal((await rows('select * from alertas_produtos')).length, 0);
      assert.deepEqual((await rows('select dados_equipe() as dados'))[0].dados, { funcionarios: [], empresa: null });
    });
    await db.exec(`begin; set local role authenticated; select set_config('request.jwt.claim.sub','${owner}',true);
      update visitas set produtos='[{"nome":"Revisão da empresa","qtd":3,"preco":70}]';
      insert into visitas(user_id,cliente_id,produtos) values('${owner}',1,'[{"nome":"Pedido da empresa","qtd":1,"preco":90}]');commit;`);
    await asUser(worker, async () => {
      // Uma repetição da fila não recupera nem sobrescreve os valores revisados.
      await db.exec(`insert into visitas(id,user_id,cliente_id,produtos) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','${owner}',1,'[{"nome":"Pedido antigo","qtd":1}]') on conflict(id) do nothing`);
      assert.equal((await rows('select * from visitas')).length, 1);
    });
    await asUser(owner, async () => {
      assert.equal((await rows("select produtos from alertas_produtos where visita_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'"))[0].produtos[0].preco, 70);
    });
    await asUser(worker, async () => {
      assert.deepEqual((await rows('select produtos from visitas'))[0].produtos, []);
      assert.equal((await rows('update visitas set observacoes=\'alterada\' returning id')).length, 0);
      assert.equal((await rows('select * from alertas_produtos')).length, 0);
      await assert.rejects(db.exec(`insert into visitas(user_id,cliente_id) values('${owner}',2)`), /row-level security/);
    });
    await asUser(worker, async () => {
      await assert.rejects(db.exec(`insert into visitas(user_id,cliente_id,criado_por) values('${owner}',1,'${owner}')`), /row-level security/);
    });
    await asUser(worker, async () => {
      await assert.rejects(db.exec(`insert into equipes_links(nome,email_funcionario,employer_uid) values('X','x@example.test','${worker}')`), /row-level security/);
    });
    await asUser(worker, async () => {
      await assert.rejects(db.exec(`insert into clientes(user_id,nome) values('${worker}','Não autorizado')`), /row-level security/);
    });
    await asUser(worker, async () => {
      assert.equal((await rows(`update perfis set tipo_conta='empresa' returning id`)).length, 0);
      assert.equal((await rows('delete from visitas returning id')).length, 0);
      assert.equal((await rows('delete from clientes returning id')).length, 0);
    });
    // Retirar a rota revoga o acesso sem apagar o relatório da empresa.
    await db.exec(`update equipes_links set rotas='[]'`);
    await asUser(worker, async () => {
      assert.equal((await rows('select * from clientes')).length, 0);
      assert.equal((await rows('select * from visitas')).length, 0);
    });
    await asUser(owner, async () => assert.equal((await rows('select * from visitas')).length, 2));
    await db.exec(`update equipes_links set rotas='["1"]'`);
    await asUser('', async () => {
      await assert.rejects(db.exec('select * from contexto_equipe()'), /permission denied/);
    }, 'anon');
    await asUser('', async () => {
      await assert.rejects(db.exec('select dados_equipe()'), /permission denied/);
    }, 'anon');
    await db.exec(`update auth.users set email_confirmed_at=null where id='${worker}'`);
    await asUser(worker, async () => assert.equal((await rows('select * from contexto_equipe()')).length, 0));
    await db.exec(`update auth.users set email_confirmed_at=now() where id='${worker}'; update perfis set assinatura_ativa=false where id='${owner}'`);
    await asUser(worker, async () => {
      assert.equal((await rows('select * from contexto_equipe()'))[0].assinatura_ativa, false);
      assert.equal((await rows('select * from clientes')).length, 1);
      await db.exec(`insert into visitas(user_id,cliente_id) values('${owner}',1)`);
    });
    await db.exec(`delete from equipes_links; update perfis set vinculo_empresa='${owner}',rotas='[1]',tipo_conta='funcionario' where id='${worker}'`);
    await asUser(worker, async () => {
      assert.equal((await rows('select * from contexto_equipe()')).length, 0);
      assert.equal((await rows('select * from clientes')).length, 0);
    });
  } finally { await db.close(); }
});
