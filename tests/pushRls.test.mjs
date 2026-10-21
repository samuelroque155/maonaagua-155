import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { criarBancoSupabaseTeste, owner, worker, other } from './helpers/supabaseFixture.mjs';

test('push: RLS por conta, horário, conclusão, adiamento, vínculo e reserva de entrega', async () => {
  const db = await criarBancoSupabaseTeste();
  try {
    await db.exec('create role service_role bypassrls;');
    await db.exec(await readFile(new URL('../scripts/adiamentos-visitas.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/20261021053105_lembretes_push.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/20261021060829_permissao_lembretes_auth.sql', import.meta.url), 'utf8'));
    await db.exec(`grant usage on schema auth to service_role; grant select on all tables in schema public to service_role;
      update clientes set dias_visita=array[extract(dow from (now() at time zone 'America/Sao_Paulo')::date)::int];
      insert into equipes_links(nome,email_funcionario,employer_uid,rotas) values('Funcionario','worker@example.test','${owner}','["1"]');`);
    const asUser = async (uid, acao, role = 'authenticated') => {
      await db.exec(`begin;set local role ${role};select set_config('request.jwt.claim.sub','${uid}',true);`);
      try { return await acao(); } finally { await db.exec('rollback'); }
    };
    const inserir = uid => `insert into notificacoes_dispositivos(user_id,endpoint,assinatura,horario,ativo) values('${uid}','https://fcm.googleapis.com/${uid}',jsonb_build_object('endpoint','https://fcm.googleapis.com/${uid}','keys',jsonb_build_object('p256dh',repeat('a',88),'auth',repeat('a',22))),'00:00',true)`;
    await asUser(worker, async () => {
      await assert.rejects(db.exec(inserir(other)), /row-level security/);
    });
    for (const uid of [owner, worker, other]) await db.exec(inserir(uid));
    await asUser(worker, async () => {
      assert.equal((await db.query('select * from notificacoes_dispositivos')).rows.length, 1);
      assert.equal((await db.query(`update notificacoes_dispositivos set ativo=false where user_id='${owner}' returning id`)).rows.length, 0);
      await assert.rejects(db.exec('select * from reivindicar_lembretes()'), /permission denied/);
    });
    const reclamar = async () => {
      await db.exec('set role service_role');
      try { return await db.query('select n.user_id,r.quantidade from reivindicar_lembretes() r join notificacoes_dispositivos n on n.id=r.id'); }
      finally { await db.exec('reset role'); }
    };
    const avisos = (await reclamar()).rows;
    assert.equal(avisos.find(x => x.user_id === owner).quantidade, 2);
    assert.equal(avisos.find(x => x.user_id === worker).quantidade, 1);
    assert.equal((await reclamar()).rows.length, 0, 'não reserva outra vez durante o envio');
    await db.exec(`update notificacoes_dispositivos set bloqueado_ate=null; insert into visitas(user_id,cliente_id,tipo) values('${owner}',1,'visita');`);
    const depois = (await reclamar()).rows;
    assert.equal(depois.find(x => x.user_id === owner).quantidade, 1);
    assert.equal(depois.some(x => x.user_id === worker), false);
    await db.exec(`begin;set local role authenticated;select set_config('request.jwt.claim.sub','${owner}',true);
      insert into adiamentos_visitas(user_id,cliente_id,data_original,nova_data,motivo) values('${owner}',2,(now() at time zone 'America/Sao_Paulo')::date,(now() at time zone 'America/Sao_Paulo')::date+1,'Portao fechado');commit;
      update notificacoes_dispositivos set bloqueado_ate=null;`);
    assert.equal((await reclamar()).rows.some(x => x.user_id === owner), false, 'adiamento sai da pendência do dia original');
    await db.exec(`update notificacoes_dispositivos set bloqueado_ate=null; delete from equipes_links;`);
    assert.equal((await reclamar()).rows.some(x => x.user_id === worker), false);
    await db.exec(`update notificacoes_dispositivos set bloqueado_ate=null,ultimo_envio=(now() at time zone 'America/Sao_Paulo')::date;`);
    assert.equal((await reclamar()).rows.length, 0);
    await asUser('', async () => { await assert.rejects(db.exec('select * from notificacoes_dispositivos'), /permission denied/); }, 'anon');
  } finally { await db.close(); }
});
