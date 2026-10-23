import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { criarBancoSupabaseTeste, owner, worker, other } from './helpers/supabaseFixture.mjs';
import { dataBrasil, diaSemanaAgenda, somarDiasAgenda, estadoAgendaCliente, semanaDaData } from '../src/services/agendaService.js';
import { prepararRascunhoCancelamento, cancelarAtendimento } from '../src/services/cancelamentoVisitaService.js';

const migracoes = ['scripts/adiamentos-visitas.sql', 'supabase/migrations/20261021053105_lembretes_push.sql', 'supabase/migrations/20261021060829_permissao_lembretes_auth.sql', 'supabase/migrations/20261021164523_antecipacoes_lembretes_inteligentes.sql', 'supabase/migrations/20261023232856_cancelamentos_atendimentos.sql'];
async function banco(incluirCancelamento = true) {
  const db = await criarBancoSupabaseTeste();
  await db.exec('create role service_role bypassrls;');
  for (const path of migracoes) { if (!incluirCancelamento && path.includes('20261023232856_cancelamentos_atendimentos.sql')) continue; await db.exec(await readFile(new URL('../'+path,import.meta.url),'utf8')); }
  const hoje = dataBrasil();
  await db.exec(`update clientes set dias_visita=array[${diaSemanaAgenda(hoje)}]; insert into equipes_links(nome,email_funcionario,employer_uid,rotas) values('Funcionário','worker@example.test','${owner}','["1"]');`);
  return db;
}
async function como(db, uid, sql) {
  await db.exec(`begin; set local role authenticated; select set_config('request.jwt.claim.sub','${uid}',true);`);
  try { const r = await db.query(sql); await db.exec('commit'); return r.rows; } catch(e) { await db.exec('rollback'); throw e; }
}
function inserir(id, cliente=1, nova=null, rascunho='{}') {
  return `insert into cancelamentos_visitas(id,user_id,cliente_id,iniciado_em,data_original,nova_data,motivo,rascunho) values('${id}','${owner}',${cliente},now()-interval '10 minutes','${dataBrasil()}',${nova ? `'${nova}'` : 'null'},'Cliente saindo','${rascunho}') returning *`;
}

test('cancelamento sem limpeza é auditado, isolado e não altera a pendência ou indicadores', async()=>{
  const db = await banco();
  try {
    const id=crypto.randomUUID();
    const [r] = await como(db,worker,inserir(id));
    assert.equal(r.criado_por,worker);
    assert.equal((await db.query('select count(*)::int n from visitas')).rows[0].n,0);
    assert.equal((await db.query('select count(*)::int n from adiamentos_visitas')).rows[0].n,0);
    assert.equal((await como(db,other,'select * from cancelamentos_visitas')).length,0);
    await assert.rejects(como(db,worker,inserir(crypto.randomUUID(),2)),/permissão|row-level/);
    await assert.rejects(como(db,worker,`update cancelamentos_visitas set motivo='Outra coisa' where id='${id}'`),/permission/);
    await assert.rejects(como(db,owner,`delete from cancelamentos_visitas where id='${id}'`),/permission/);
    assert.equal(estadoAgendaCliente({id:1,diasVisita:[diaSemanaAgenda(dataBrasil())]},dataBrasil()).pendente,true);
  } finally {await db.close();}
});

test('cancelar e remarcar para sábado é atômico e conserva recorrência e conclusão posterior', async()=>{
  const db = await banco();
  try {
    const hoje=dataBrasil();
    const sabado=somarDiasAgenda(hoje,(6-diaSemanaAgenda(hoje)+7)%7 || 7);
    const id=crypto.randomUUID();
    await como(db,owner,inserir(id,1,sabado));
    await como(db,owner,inserir(id,1,sabado));
    const cancelamentos=(await db.query('select motivo,data_original::text,nova_data::text from cancelamentos_visitas')).rows;
    assert.equal(cancelamentos.length,1); assert.equal(cancelamentos[0].motivo,'Cliente saindo'); assert.equal(cancelamentos[0].nova_data,sabado);
    const a=(await db.query("select id,cliente_id,data_original::text,nova_data::text from adiamentos_visitas")).rows;
    assert.equal(a.length,1);
    const c={id:1,diasVisita:[diaSemanaAgenda(hoje)]};
    assert.equal(estadoAgendaCliente(c,hoje,a).pendente,false);
    assert.equal(estadoAgendaCliente(c,sabado,a).pendente,true);
    assert.equal(estadoAgendaCliente(c,somarDiasAgenda(hoje,7),a).pendente,true);
    // Avança apenas o relógio deste Postgres descartável para o dia remarcado.
    await db.exec(`create or replace function pg_catalog.now() returns timestamptz language sql stable as $$ select '${sabado}T15:00:00Z'::timestamptz $$;`);
    await como(db,owner,`insert into visitas(user_id,cliente_id,tipo,data_visita,data_agendada) values('${owner}',1,'visita',now(),'${sabado}')`);
    assert.equal((await db.query("select count(*)::int n from visitas where tipo='visita'")).rows[0].n,1);
  } finally {await db.close();}
});

test('falha ao remarcar desfaz também a auditoria; visita concluída e foto de outra conta são recusadas', async()=>{
  const db = await banco();
  try {
    await assert.rejects(como(db,owner,inserir(crypto.randomUUID(),1,dataBrasil())),/data|futura|check/);
    assert.equal((await db.query('select count(*)::int n from cancelamentos_visitas')).rows[0].n,0);
    const foto=JSON.stringify({fotos:[`${other}/visitas/${crypto.randomUUID()}.jpg`]});
    await assert.rejects(como(db,owner,inserir(crypto.randomUUID(),1,null,foto)),/fotografia/);
    await como(db,owner,`insert into visitas(user_id,cliente_id,tipo,data_visita,data_agendada) values('${owner}',1,'visita',now(),'${dataBrasil()}')`);
    await assert.rejects(como(db,owner,inserir(crypto.randomUUID())),/concluída/);
    assert.equal((await db.query('select count(*)::int n from cancelamentos_visitas')).rows[0].n,0);
  } finally {await db.close();}
});

test('rascunho preservado guarda caminhos duráveis; envio pendente e fotos de outra conta são recusados',()=>{
  assert.throws(()=>prepararRascunhoCancelamento({fotosVisita:[{status:'uploading'}]},owner,1),/Aguarde/);
  assert.throws(()=>prepararRascunhoCancelamento({fotosVisita:[{userId:other,status:'ready',caminho:'x'}]},owner,1),/outro/);
  const r=prepararRascunhoCancelamento({ph:'7.4',fotosVisita:[{userId:owner,clienteId:1,status:'ready',caminho:`${owner}/visitas/a.jpg`,url:'blob:temporario'}]},owner,1);
  assert.equal(r.ph,'7.4'); assert.doesNotMatch(JSON.stringify(r),/blob:/);
});

test('serviço mantém o rascunho quando o banco está ausente ou a sessão mudou',async()=>{
  const client={auth:{getUser:async()=>({data:{user:{id:owner}}})},from:()=>({insert:async()=>({error:{code:'PGRST205'}})})};
  const dados={id:crypto.randomUUID(),userId:owner,ownerId:owner,clienteId:1,iniciadoEm:new Date().toISOString(),dataOriginal:dataBrasil(),motivo:'Cliente saiu'};
  await assert.rejects(cancelarAtendimento(client,dados),/rascunho foram mantidos/);
  await assert.rejects(cancelarAtendimento(client,{...dados,userId:other}),/sessão mudou/);
});

test('agenda localiza ocorrência meses à frente e transfere somente a data selecionada',()=>{
  const hoje='2026-10-22',original='2026-12-18',nova='2026-12-16';
  assert.equal(semanaDaData(original,hoje),8);
  const c={id:1,diasVisita:[2,5]};
  const a=[{cliente_id:1,data_original:original,nova_data:nova}];
  assert.equal(estadoAgendaCliente(c,nova,[],a).pendente,true);
  assert.equal(estadoAgendaCliente(c,original,[],a).pendente,false);
  assert.equal(estadoAgendaCliente(c,'2026-12-22',[],a).pendente,true);
  assert.equal(estadoAgendaCliente(c,'2026-12-25',[],a).pendente,true);
});

test('migration preserves existing completed visits and photo objects', async()=>{
 const db=await banco(false);
 try {
  const photo='11111111-1111-4111-8111-111111111111/visitas/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg';
  await como(db,owner,"insert into visitas(id,user_id,cliente_id,tipo,data_visita) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111',1,'visita',now())");
  await db.exec("insert into storage.objects(bucket_id,name) values('fotos-visitas','"+photo+"')");
  const visits=(await db.query('select id,cliente_id,tipo from visitas')).rows;
  const photos=(await db.query('select bucket_id,name from storage.objects')).rows;
  await db.exec(await readFile(new URL('../supabase/migrations/20261023232856_cancelamentos_atendimentos.sql',import.meta.url),'utf8'));
  assert.deepEqual((await db.query('select id,cliente_id,tipo from visitas')).rows,visits);
  assert.deepEqual((await db.query('select bucket_id,name from storage.objects')).rows,photos);
 } finally { await db.close(); }
});
