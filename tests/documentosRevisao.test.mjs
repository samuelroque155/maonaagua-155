import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { imagemProfissionalPDF, imagensRelatorioPDF } from '../src/services/imagemPerfilService.js';
import { antecipacoesUnicas } from '../src/services/antecipacaoRelatorio.js';
import { mensagemProdutos, mensagemProdutosSimples } from '../src/services/whatsappService.js';
import { criarOrcamentoPDF } from '../src/services/orcamentoService.js';
import { gerarRelatorioPDF } from '../src/services/pdfService.js';
import { PDFDocument } from 'pdf-lib';

test('PDF obtém a logo privada novamente e ignora URL assinada expirada',async()=>{
  const png=new Blob([await readFile(new URL('../public/logo.png',import.meta.url))],{type:'image/png'});
  let downloads=0;
  const client={storage:{from:bucket=>({download:async caminho=>{assert.equal(bucket,'fotos-visitas'); assert.equal(caminho,'a/perfil/logo.png'); downloads++;return{data:png};}})}};
  const resultado=await imagemProfissionalPDF(client,{fotoPerfilCaminho:'a/perfil/logo.png',fotoPerfilUrl:'https://expirada.invalid/'});
  assert.equal(downloads,1); assert.match(resultado.imagem,/^data:image\/png;base64,/); assert.equal(resultado.aviso,'');
  const blob=await criarOrcamentoPDF({nome:'Ana',descricao:'Troca do filtro'},{empresa:'Empresa de exemplo',fotoPerfilUrl:resultado.imagem});
  const bytes=Buffer.from(await blob.arrayBuffer());
  assert.match(bytes.toString('latin1'),/\/Subtype \/Image/);
  assert.ok((await PDFDocument.load(bytes)).getPageCount()>0);
});

test('falha de logo tem aviso e orçamento continua com a identidade padrão, sem outra foto',async()=>{
  const client={storage:{from:()=>({download:async()=>({error:new Error('Sem rede')})})}};
  const resultado=await imagemProfissionalPDF(client,{fotoPerfilCaminho:'a/perfil/logo.png'});
  assert.equal(resultado.imagem,null); assert.match(resultado.aviso,/identidade padrão/);
  const blob=await criarOrcamentoPDF({nome:'Ana',descricao:'Filtro'},{empresa:'Empresa de exemplo',fotoPerfilUrl:'data:image/png;base64,invalida'});
  const bytes=Buffer.from(await blob.arrayBuffer());
  assert.match(bytes.toString('latin1'),/MNA/); assert.doesNotMatch(bytes.toString('latin1'),/\/Subtype \/Image/);
});

test('fotografias são renovadas separadamente; falhas não apagam os caminhos originais',async()=>{
  const png=new Blob([await readFile(new URL('../public/logo.png',import.meta.url))],{type:'image/png'});
  const client={storage:{from:()=>({download:async caminho=>caminho==='indisponivel'?{error:new Error('404')}:{data:png}})}};
  const original=[{tipo:'visita',fotosCaminhos:['ok','indisponivel'],fotos:['https://expirada.invalid']}];
  const [v]=await imagensRelatorioPDF(client,original);
  assert.equal(v.fotosBase64.length,1); assert.equal(v.fotosIndisponiveis,1);
  assert.deepEqual(original[0].fotosCaminhos,['ok','indisponivel']);
});

test('antecipação é composta uma vez por identidade da ocorrência, independente da ordem',()=>{
  const dados={id:'a',data_original:'2026-12-18',nova_data:'2026-12-16',motivo:'Feriado'};
  const evento={tipo:'antecipacao',antecipacaoId:'a',antecipacaoDados:dados,criadoEm:'SEGREDO',descricao:'Duplicada'};
  const visita={tipo:'visita',antecipacaoId:'a',antecipacaoDados:dados,d:'16/12/2026'};
  for(const historico of [[evento,visita],[visita,evento]]){
    const unicas=antecipacoesUnicas(historico);assert.equal(unicas.length,1);assert.equal(unicas[0].realizada,'16/12/2026');assert.equal(unicas[0].prevista,'18/12/2026');assert.doesNotMatch(JSON.stringify(unicas),/SEGREDO/);
  }
});

test('WhatsApp leva somente faltantes, preserva quantidades e valores reais sem campos técnicos',()=>{
  const dados={cliente:{nome:'André'},perfil:{empresa:'Piscinas Clara'},produtos:[{nome:'Cloro',qtd:2,preco:12.34},{nome:'Algicida',qtd:1,preco:null},{nome:'Não faltou',qtd:9,preco:999,faltando:false}],ph:'7.4',fotos:['SEGREDO'],antecipacaoDescricao:'SEGREDO'};
  const simples=mensagemProdutosSimples(dados),precos=mensagemProdutos({...dados,comValores:true});
  assert.match(simples,/• 2 — Cloro/);assert.doesNotMatch(simples,/R\$|12,34|pH|SEGREDO|Não faltou/);
  assert.match(precos,/24,68/);assert.match(precos,/preço não informado/);assert.doesNotMatch(precos,/pH|SEGREDO|Não faltou|\*Total da lista:/);
  assert.throws(()=>mensagemProdutosSimples({...dados,produtos:[]}),/não tem produtos/);
});

test('composição do PDF não funde ocorrências distintas que tenham descrição igual',()=>{
 const descricao='Visita prevista: 23/10/2026 · antecipada para 22/10/2026 · Motivo: Feriado';
 const historico=[
  {tipo:'antecipacao',antecipacaoId:'primeira',descricao},
  {tipo:'visita',antecipacaoId:'primeira',antecipacaoDescricao:descricao,d:'22/10/2026'},
  {tipo:'antecipacao',antecipacaoId:'segunda',descricao}
 ];
 assert.equal(antecipacoesUnicas(historico).length,2);
});

test('cancelamento administrativo não pode gerar um relatório técnico de limpeza realizada',async()=>{
  await assert.rejects(gerarRelatorioPDF({nome:'Ana'},[{tipo:'cancelamento',motivo:'Cliente saiu'}],{empresa:'Empresa'}),/Não há limpeza/);
});
