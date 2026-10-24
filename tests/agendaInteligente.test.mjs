import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { criarBancoSupabaseTeste, owner, worker, other } from './helpers/supabaseFixture.mjs';
import { estadoAgendaCliente, somarDiasAgenda, dataBrasil, diaSemanaAgenda } from '../src/services/agendaService.js';
import { mensagemLembrete } from '../supabase/functions/enviar-lembretes/mensagem.js';
import { validarPreferencias, padraoLembretes } from '../src/services/preferenciasLembretesService.js';
import { configurarPush } from '../src/services/pushService.js';

test('antecipação: ocorrência da quinta muda para quarta; próxima semana e outros dias preservados', () => {
 const c={id:1,diasVisita:[2,4],datasConcluidas:[]};
 const a=[{id:'a',cliente_id:1,data_original:'2026-10-22',nova_data:'2026-10-21'}];
 assert.equal(estadoAgendaCliente(c,'2026-10-21',[],a).pendente,true);
 assert.equal(estadoAgendaCliente(c,'2026-10-22',[],a).pendente,false);
 assert.equal(estadoAgendaCliente(c,'2026-10-29',[],a).pendente,true);
 assert.equal(estadoAgendaCliente(c,'2026-10-27',[],a).pendente,true);
 assert.equal(estadoAgendaCliente({...c,datasConcluidas:['2026-10-21']},'2026-10-21',[],a).pendente,false);
 assert.equal(estadoAgendaCliente(c,'2026-10-22',[],[{...a[0],cancelado_em:'agora'}]).pendente,true);
 assert.deepEqual(c.diasVisita,[2,4]);
 assert.equal(estadoAgendaCliente(c,'2026-10-23',[{cliente_id:1,data_original:'2026-10-21',nova_data:'2026-10-23'}],a).pendente,true);
});
test('lembretes: preferências e mensagens limitadas sem dados privados',()=>{
 assert.equal(validarPreferencias({...padraoLembretes,modo:'ambos',antecedencia:'60'}).antecedencia,60);
 assert.throws(()=>validarPreferencias({...padraoLembretes,fuso:'errado'}));
 assert.throws(()=>validarPreferencias({...padraoLembretes,antecedencia:10}));
 const m=mensagemLembrete({dispositivo_id:'d',evento:'resumo:dia',tipo:'resumo',quantidade:8,clientes:Array.from({length:8},()=>({nome:'Cliente',hora:'08:00',endereco:'SEGREDO',telefone:'SEGREDO'}))});
 assert.match(m.body,/mais 3/); assert.doesNotMatch(m.body,/SEGREDO/); assert.equal(m.body.match(/08:00/g).length,5);
 assert.notEqual(m.tag,mensagemLembrete({dispositivo_id:'d',evento:'individual:1:dia',tipo:'individual',clientes:[{nome:'A',hora:'08:00'}]}).tag);
});
test('push existente é reutilizado ao salvar preferências e preservado ao pausar',async()=>{
 let criadas=0,canceladas=0;
 const inscricao={endpoint:'https://fcm.googleapis.com/exemplo',toJSON:()=>({endpoint:'https://fcm.googleapis.com/exemplo',keys:{}}),unsubscribe:async()=>{canceladas++;}};
 const registro={pushManager:{getSubscription:async()=>inscricao,subscribe:async()=>{criadas++;return inscricao;}}};
 const ambiente={navigator:{serviceWorker:{ready:Promise.resolve(registro),getRegistration:async()=>registro}}};
 const client={from:()=>({upsert:async()=>({error:null}),update:()=>({eq:()=>({eq:async()=>({error:null})})})})};
 await configurarPush(client,owner,{ativo:true,horario:'08:00',preservarInscricao:true},'mesma-chave-publica',ambiente);
 await configurarPush(client,owner,{ativo:false,preservarInscricao:true},'mesma-chave-publica',ambiente);
 assert.equal(criadas,0);assert.equal(canceladas,0);
});

async function banco() {
 const db=await criarBancoSupabaseTeste();
 try {
 await db.exec('create role service_role bypassrls;');
 for(const path of ['scripts/adiamentos-visitas.sql','supabase/migrations/20261021053105_lembretes_push.sql','supabase/migrations/20261021060829_permissao_lembretes_auth.sql','supabase/migrations/20261021190701_antecipacoes_lembretes_inteligentes.sql']) await db.exec(await readFile(new URL('../'+path,import.meta.url),'utf8'));
 await db.exec(`grant usage on schema auth,private to service_role; grant select on all tables in schema public to service_role;
 insert into equipes_links(nome,email_funcionario,employer_uid,rotas) values('Funcionário','worker@example.test','${owner}','["1"]');`);
 return db;
 }catch(e){await db.close();throw e;}
}
async function como(db,uid,acao,role='authenticated'){
 await db.exec(`begin;set local role ${role};select set_config('request.jwt.claim.sub','${uid}',true);`);
 try {const r=await acao();await db.exec('commit');return r;}catch(e){await db.exec('rollback');throw e;}
}

test('banco: isolamento, autorização, cancelamento, conclusão com fotos e retorno semanal',async()=>{
 const db=await banco();
 try {
 const hoje=dataBrasil(),original=somarDiasAgenda(hoje,1),nova=hoje;
 await db.exec(`update clientes set dias_visita=array[${diaSemanaAgenda(original)}];`);
 const inserir=cid=>`insert into antecipacoes_visitas(user_id,cliente_id,data_original,nova_data,motivo) values('${owner}',${cid},'${original}','${nova}','Feriado') returning *`;
 await assert.rejects(como(db,worker,()=>db.query(inserir(2))),/permissão|row-level security/);
 const a=(await como(db,worker,()=>db.query(inserir(1)))).rows[0];
 assert.equal(a.criado_por,worker);
 assert.equal((await como(db,other,()=>db.query('select * from antecipacoes_visitas'))).rows.length,0);
 await assert.rejects(como(db,owner,()=>db.query(inserir(1))),/disponível|unique/);
 await assert.rejects(como(db,worker,()=>db.exec(`update antecipacoes_visitas set motivo='falso' where id='${a.id}'`)),/permission denied/);
 await como(db,worker,()=>db.exec(`update antecipacoes_visitas set cancelado_em=now() where id='${a.id}'`));
 const b=(await como(db,owner,()=>db.query(inserir(1)))).rows[0];
 await como(db,worker,()=>db.exec(`insert into visitas(user_id,cliente_id,tipo,data_visita,fotos) values('${owner}',1,'visita','${hoje}T15:00:00Z','["foto1","foto2","foto3"]')`));
 const v=(await db.query('select antecipacao_id,fotos from visitas where cliente_id=1')).rows[0];
 assert.equal(v.antecipacao_id,b.id); assert.equal(v.fotos.length,3);
 await assert.rejects(como(db,owner,()=>db.exec(`update visitas set antecipacao_id=null where cliente_id=1`)),/ocorrência/);
 await assert.rejects(como(db,owner,()=>db.exec(`update antecipacoes_visitas set cancelado_em=now() where id='${b.id}'`)),/realizada/);
 await assert.rejects(como(db,worker,()=>db.exec(`insert into visitas(user_id,cliente_id,tipo,data_visita) values('${owner}',1,'visita','${original}T15:00:00Z')`)),/antecipada/);
 await assert.rejects(como(db,owner,()=>db.exec(`insert into visitas(user_id,cliente_id,tipo,data_visita) values('${owner}',1,'visita','${hoje}T15:00:00Z')`)),/concluída/);
 assert.deepEqual((await db.query('select dias_visita from clientes where id=1')).rows[0].dias_visita,[diaSemanaAgenda(original)]);
 await como(db,owner,()=>db.exec(`insert into notificacoes_preferencias(user_id,modo) values('${owner}','ambos')`));
 assert.equal((await como(db,worker,()=>db.query('select * from notificacoes_preferencias'))).rows.length,0);
 await assert.rejects(como(db,worker,()=>db.exec(`insert into notificacoes_preferencias(user_id) values('${other}')`)),/row-level security/);
 await assert.rejects(como(db,owner,()=>db.exec(`select * from reivindicar_lembretes_v2()`)),/permission denied/);
 await assert.rejects(como(db,'',()=>db.exec('select * from antecipacoes_visitas'),'anon'),/permission denied/);
 }finally{await db.close();}
});

test('banco: conclusão após meia-noite conserva a ocorrência iniciada e sua data efetiva',async()=>{
 const db=await banco();
 try{
 const hoje=dataBrasil(),original=somarDiasAgenda(hoje,1);
 await db.exec(`update clientes set dias_visita=array[${diaSemanaAgenda(original)}] where id=1;`);
 const a=(await como(db,owner,()=>db.query(`insert into antecipacoes_visitas(user_id,cliente_id,data_original,nova_data) values('${owner}',1,'${original}','${hoje}') returning id`))).rows[0];
 await como(db,worker,()=>db.exec(`insert into visitas(user_id,cliente_id,tipo,data_agendada,data_visita,fotos) values('${owner}',1,'visita','${hoje}','${original}T00:15:00-03:00','["a","b","c"]')`));
 const v=(await db.query('select * from visitas where cliente_id=1')).rows[0];
 assert.equal(v.antecipacao_id,a.id); assert.equal(dataBrasil(v.data_visita),original);
 const conclusao=(await como(db,worker,()=>db.query(`select * from conclusoes_agenda('${owner}')`))).rows[0];
 assert.equal(dataBrasil(conclusao.data_visita),hoje);
 }finally{await db.close();}
});

test('banco: resumo, individuais, ambos, fuso, rotas e reserva sem duplicidade',async()=>{
 const db=await banco();
 try {
 const hoje=dataBrasil();
 await db.exec(`update clientes set dias_visita=array[${diaSemanaAgenda(hoje)}],hora_visita='08:00';update clientes set hora_visita='' where id=2;`);
 for(const uid of [owner,worker,other]) await db.exec(`insert into notificacoes_dispositivos(user_id,endpoint,assinatura,horario,ativo) values('${uid}','https://fcm.googleapis.com/${uid}',jsonb_build_object('endpoint','https://fcm.googleapis.com/${uid}','keys',jsonb_build_object('p256dh',repeat('a',88),'auth',repeat('a',22))),'07:00',true);insert into notificacoes_preferencias(user_id,modo,horario) values('${uid}','ambos','07:00');`);
 const reclamar=hora=>como(db,'',()=>db.query(`select n.user_id,r.* from reivindicar_lembretes_v2('${hoje}T${hora}:00-03:00') r join notificacoes_dispositivos n on n.id=r.dispositivo_id`),'service_role');
 const avisos=(await reclamar('07:30')).rows;
 assert.equal(avisos.length,6);
 assert.equal(Number(avisos.find(r=>r.user_id===owner&&r.tipo==='resumo').quantidade),2);
 assert.equal(Number(avisos.find(r=>r.user_id===worker&&r.tipo==='resumo').quantidade),1);
 assert.equal((await reclamar('07:30')).rows.length,0);
 await db.exec('update notificacoes_entregas set enviado_em=now();');
 assert.equal((await reclamar('07:40')).rows.length,0);
 await db.exec(`delete from notificacoes_entregas;update notificacoes_preferencias set modo='individual',antecedencia=15;`);
 assert.equal((await reclamar('07:30')).rows.length,0);
 assert.equal((await reclamar('07:45')).rows.length,3);
 await db.exec(`delete from notificacoes_entregas;update notificacoes_preferencias set modo='resumo';update notificacoes_dispositivos set ultimo_envio='${hoje}';`);
 assert.equal((await reclamar('07:45')).rows.length,0,'compatibilidade com resumo já entregue pelo envio antigo');
 await db.exec(`update notificacoes_dispositivos set ultimo_envio=null;update notificacoes_preferencias set fuso='America/Manaus',horario='07:00';`);
 assert.equal((await reclamar('07:45')).rows.length,0,'Manaus ainda antes das 07:00');
 assert.equal((await reclamar('08:00')).rows.length,3);
 }finally{await db.close();}
});
test('banco: antecedência de 60 minutos atravessa a meia-noite sem inventar horário para clientes',async()=>{
 const db=await banco();
 try{
 const hoje=dataBrasil(),amanha=somarDiasAgenda(hoje,1);
 await db.exec(`update clientes set dias_visita=array[${diaSemanaAgenda(amanha)}],hora_visita='00:10';update clientes set hora_visita='' where id=2;`);
 for(const uid of [owner,worker,other]) await db.exec(`insert into notificacoes_dispositivos(user_id,endpoint,assinatura,ativo) values('${uid}','https://fcm.googleapis.com/${uid}',jsonb_build_object('endpoint','https://fcm.googleapis.com/${uid}','keys',jsonb_build_object('p256dh',repeat('a',88),'auth',repeat('a',22))),true);insert into notificacoes_preferencias(user_id,modo,antecedencia) values('${uid}','individual',60);`);
 const reclamar=hora=>como(db,'',()=>db.query(`select * from reivindicar_lembretes_v2('${hoje}T${hora}:00-03:00')`),'service_role');
 assert.equal((await reclamar('23:09')).rows.length,0);
 const avisos=(await reclamar('23:10')).rows;
 assert.equal(avisos.length,3);
 assert.ok(avisos.every(r=>r.tipo==='individual'&&r.clientes.length===1&&r.clientes[0].hora==='00:10'));
 assert.equal((await reclamar('23:10')).rows.length,0);
 }finally{await db.close();}
});

test('banco: Adiar mantém o fluxo antigo e aceita a ocorrência antecipada sem perder a identidade',async()=>{
 const db=await banco();
 try {
 const hoje=dataBrasil(),original=somarDiasAgenda(hoje,2),destino=somarDiasAgenda(hoje,3);
 await db.exec(`update clientes set dias_visita=array[${diaSemanaAgenda(original)}] where id=1;update clientes set dias_visita=array[${diaSemanaAgenda(hoje)}] where id=2;`);
 const a=(await como(db,worker,()=>db.query(`insert into antecipacoes_visitas(user_id,cliente_id,data_original,nova_data) values('${owner}',1,'${original}','${hoje}') returning id`))).rows[0];
 await como(db,owner,()=>db.exec(`insert into adiamentos_visitas(user_id,cliente_id,data_original,nova_data,motivo) values('${owner}',2,'${hoje}','${destino}','Portão fechado');`));
 await assert.rejects(como(db,worker,()=>db.exec(`insert into adiamentos_visitas(user_id,cliente_id,data_original,nova_data,motivo) values('${owner}',1,'${hoje}','${original}','Chuva')`)),/ocorrência já antecipada/);
 await como(db,worker,()=>db.exec(`insert into adiamentos_visitas(user_id,cliente_id,data_original,nova_data,motivo) values('${owner}',1,'${hoje}','${destino}','Chuva')`));
 const origem=(await db.query(`select * from private.origem_ocorrencia('${owner}',1,'${destino}')`)).rows[0];
 assert.equal(origem.antecipacao,a.id);
 assert.equal(new Date(origem.original).toISOString().slice(0,10),original);
 await assert.rejects(como(db,worker,()=>db.exec(`update antecipacoes_visitas set cancelado_em=now() where id='${a.id}'`)),/adiada/);
 await como(db,worker,()=>db.exec(`insert into visitas(user_id,cliente_id,tipo,data_visita,fotos) values('${owner}',1,'visita','${destino}T15:00:00Z','["1","2","3"]')`));
 assert.equal((await db.query('select antecipacao_id from visitas where cliente_id=1')).rows[0].antecipacao_id,a.id);
 }finally{await db.close();}
});

test('banco: lembretes consideram antecipação, próxima semana e revalidam conclusão e rotas antes de enviar',async()=>{
 const db=await banco();
 try {
 const hoje=dataBrasil(),original=somarDiasAgenda(hoje,1),seguinte=somarDiasAgenda(original,7);
 await db.exec(`update clientes set dias_visita=array[${diaSemanaAgenda(original)}],hora_visita='08:00';`);
 await como(db,worker,()=>db.exec(`insert into antecipacoes_visitas(user_id,cliente_id,data_original,nova_data) values('${owner}',1,'${original}','${hoje}')`));
 for(const uid of [owner,worker]) await db.exec(`insert into notificacoes_dispositivos(user_id,endpoint,assinatura,horario,ativo) values('${uid}','https://fcm.googleapis.com/${uid}',jsonb_build_object('endpoint','https://fcm.googleapis.com/${uid}','keys',jsonb_build_object('p256dh',repeat('a',88),'auth',repeat('a',22))),'07:00',true);insert into notificacoes_preferencias(user_id,modo) values('${uid}','ambos');`);
 const reclamar=dia=>como(db,'',()=>db.query(`select * from reivindicar_lembretes_v2('${dia}T07:30:00-03:00')`),'service_role');
 const hojeAvisos=(await reclamar(hoje)).rows;
 assert.equal(hojeAvisos.length,4);
 assert.ok(hojeAvisos.every(r=>Number(r.quantidade)===1));
 const preparar=r=>como(db,'',()=>db.query(`select * from preparar_envio_lembrete('${r.dispositivo_id}','${r.evento}','${r.token}','${hoje}T07:30:00-03:00')`),'service_role');
 assert.equal((await preparar(hojeAvisos[0])).rows.length,1);
 await como(db,worker,()=>db.exec(`insert into visitas(user_id,cliente_id,tipo,data_visita) values('${owner}',1,'visita','${hoje}T15:00:00Z')`));
 assert.equal((await preparar(hojeAvisos[0])).rows.length,0,'finalizar durante a reserva impede envio');
 const amanha=(await reclamar(original)).rows;
 assert.ok(amanha.every(r=>r.clientes.every(c=>c.nome!=='Rota atribuída')),'a origem transferida não gera aviso');
 assert.equal((await reclamar(seguinte)).rows.length,5,'recorrência da próxima semana preservada');
 await db.exec('delete from notificacoes_entregas;delete from equipes_links;');
 assert.equal((await reclamar(seguinte)).rows.length,3,'funcionário perde acesso após encerramento do vínculo');
 await db.exec('delete from notificacoes_entregas;update notificacoes_preferencias set ativo=false;');
 assert.equal((await reclamar(seguinte)).rows.length,0);
 }finally{await db.close();}
});
