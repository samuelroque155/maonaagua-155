import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { criarBancoSupabaseTeste, owner, worker, other } from './helpers/supabaseFixture.mjs';

test('adiamentos no Postgres isolado: três perfis, histórico, fotos, idempotência e isolamento', async () => {
  const db = await criarBancoSupabaseTeste();
  const rows = async sql => (await db.query(sql)).rows;
  const asUser = async (id, fn, persistir = false, role = 'authenticated') => {
    await db.exec(`begin; set local role ${role}; select set_config('request.jwt.claim.sub','${id}',true);`);
    try { const resultado = await fn(); await db.exec(persistir ? 'commit' : 'rollback'); return resultado; }
    catch (e) { await db.exec('rollback'); throw e; }
  };
  try {
    await db.exec(await readFile(new URL('../scripts/adiamentos-visitas.sql', import.meta.url), 'utf8'));
    const hoje = "(now() at time zone 'America/Sao_Paulo')::date";
    await db.exec(`update clientes set dias_visita=array[extract(dow from ${hoje})::int],hora_visita='09:30';
      insert into clientes(id,user_id,nome,dias_visita) values
      (4,'${owner}','Cliente da empresa',array[extract(dow from ${hoje})::int]),
      (5,'${owner}','Somente reagendado',array[]::integer[]),
      (6,'${owner}','Já finalizado',array[extract(dow from ${hoje})::int]),
      (7,'${worker}','Cliente pessoal antigo',array[extract(dow from ${hoje})::int]);
      update perfis set tipo_conta='autonomo' where id='${other}';`);
    await asUser(owner, () => db.exec(`insert into equipes_links(nome,email_funcionario,employer_uid,rotas) values('Funcionário','worker@example.test','${owner}','["1"]');
      insert into visitas(user_id,cliente_id,data_visita,produtos) values('${owner}',1,now()-interval '1 day','[{"nome":"Produto privado da empresa","qtd":1,"preco":99}]');`), true);
    const foto = `${worker}/adiamentos/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg`;
    await asUser(worker, () => db.exec(`insert into adiamentos_visitas(id,user_id,cliente_id,data_original,nova_data,motivo,horario_original,criado_em,comparecimento_em,foto_caminho)
      values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','${owner}',1,${hoje},${hoje}+2,'Portão fechado','horário forjado','2000-01-01','2000-01-01','${foto}');`), true);
    await db.exec(`insert into storage.objects(bucket_id,name) values('fotos-visitas','${foto}'),('fotos-visitas','${worker}/adiamentos/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.jpg');`);
    await asUser(owner, async () => {
      const [a] = await rows('select * from adiamentos_visitas');
      assert.equal(a.horario_original, '09:30'); assert.equal(a.criado_por, worker);
      assert.ok(new Date(a.criado_em).getFullYear() > 2020);
      assert.equal(new Date(a.comparecimento_em).getTime(), new Date(a.criado_em).getTime());
      assert.equal((await rows('select * from visitas')).length, 1); // Adiar não cria limpeza.
      assert.equal((await rows('select * from storage.objects')).length, 1);
    });
    await asUser(worker, async () => {
      assert.equal((await rows('select * from adiamentos_visitas')).length, 1);
      assert.equal((await rows('select * from visitas')).length, 0); // Não recebe relatórios/produtos alheios.
      const conclusoes = await rows(`select * from conclusoes_agenda('${owner}')`);
      assert.equal(conclusoes.length, 1);
      assert.deepEqual(Object.keys(conclusoes[0]).sort(), ['cliente_id', 'data_visita', 'id']);
    });
    await asUser(other, async () => {
      assert.equal((await rows(`select * from adiamentos_visitas where user_id='${owner}'`)).length, 0);
      assert.equal((await rows(`select * from conclusoes_agenda('${owner}')`)).length, 0);
      assert.equal((await rows('select * from storage.objects')).length, 0);
    });
    const adiar = (dono, cliente, extras = '') => `insert into adiamentos_visitas(user_id,cliente_id,data_original,nova_data,motivo${extras ? ',foto_caminho,comparecimento_em' : ''}) values('${dono}',${cliente},${hoje},${hoje}+2,'Sem acesso'${extras});`;
    await assert.rejects(asUser(worker, () => db.exec(adiar(owner, 1))), /unique constraint/);
    await assert.rejects(asUser(worker, () => db.exec(adiar(owner, 2))), /Sem permissão/);
    await assert.rejects(asUser(worker, () => db.exec(adiar(other, 3))), /Sem permissão/);
    await assert.rejects(asUser(worker, () => db.exec(adiar(worker, 7))), /row-level security|programada/);
    await assert.rejects(asUser(owner, () => db.exec(adiar(owner, 5))), /programada/);
    await assert.rejects(asUser(owner, () => db.exec(adiar(owner, 4, `,'${other}/adiamentos/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg',now()`))), /fotografia/);
    await assert.rejects(asUser(worker, () => db.exec(`insert into adiamentos_visitas(user_id,criado_por,cliente_id,data_original,nova_data,motivo) values('${owner}','${owner}',1,${hoje},${hoje}+2,'Forjado')`)), /Sem permissão/);
    await assert.rejects(asUser(owner, () => db.exec('update adiamentos_visitas set motivo=\'Apagar evidência\'')), /permission denied/);
    await assert.rejects(asUser(owner, () => db.exec('delete from adiamentos_visitas')), /permission denied/);
    await assert.rejects(asUser(owner, () => db.exec(`insert into visitas(user_id,cliente_id,data_visita) values('${owner}',1,now())`)), /visita foi adiada/);
    await asUser(owner, () => db.exec(`insert into visitas(user_id,cliente_id,data_visita) values('${owner}',6,now())`), true);
    await assert.rejects(asUser(owner, () => db.exec(adiar(owner, 6))), /já foi finalizada/);
    await asUser(owner, () => db.exec(adiar(owner, 4)), true);
    await asUser(other, () => db.exec(adiar(other, 3)), true);
    // Fixture histórica somente no banco descartável: nova ocorrência fora dos dias fixos.
    await db.exec(`alter table adiamentos_visitas disable trigger validar_adiamento;
      insert into adiamentos_visitas(user_id,criado_por,cliente_id,data_original,nova_data,motivo) values('${owner}','${owner}',5,${hoje}-2,${hoje},'Adiamento anterior');
      alter table adiamentos_visitas enable trigger validar_adiamento;`);
    await asUser(owner, () => db.exec(adiar(owner, 5)), true);
    assert.equal((await rows('select * from adiamentos_visitas')).length, 5);
    assert.equal((await rows('select * from visitas')).length, 2);
    assert.equal((await rows('select dias_visita from clientes where id=5'))[0].dias_visita.length, 0);
    await assert.rejects(asUser('', () => db.exec('select * from adiamentos_visitas'), false, 'anon'), /permission denied/);
    await assert.rejects(asUser('', () => db.exec(`select * from conclusoes_agenda('${owner}')`), false, 'anon'), /permission denied/);
    await asUser(owner, () => db.exec("update equipes_links set rotas='[]'"), true);
    await asUser(worker, async () => {
      assert.equal((await rows('select * from adiamentos_visitas')).length, 0);
      assert.equal((await rows(`select * from conclusoes_agenda('${owner}')`)).length, 0);
    });
  } finally { await db.close(); }
});
