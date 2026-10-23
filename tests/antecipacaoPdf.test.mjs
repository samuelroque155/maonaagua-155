import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { gerarRelatorioPDF } from '../src/services/pdfService.js';
import { PDFDocument } from 'pdf-lib';
test('PDF antecipado mantém datas original/efetiva, motivo, parâmetros, fotos e histórico de cancelamento',async()=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'navigator');
 let arquivo;
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{canShare:()=>true,share:async({files})=>{arquivo=Buffer.from(await files[0].arrayBuffer());}}});
 try{
 const foto=`data:image/png;base64,${(await readFile(new URL('../public/logo.png',import.meta.url))).toString('base64')}`;
 const descricao='Visita prevista: 22/10/2026 · antecipada para 21/10/2026 · Motivo: Feriado';
 await gerarRelatorioPDF({nome:'Cliente de exemplo',endereco:'Endereco de exemplo'},[
 {tipo:'visita',d:'21/10/2026',h:'08:00 - 09:00 (60m)',p:'7.4',c:'2',al:'100',asp:'Cristalina',fotos:[foto,foto,foto],fotosA:[],prods:[{nome:'Cloro',qtd:1}],antecipacaoDescricao:descricao},
 {tipo:'antecipacao',d:'21/10/2026',dataISO:'2026-10-21',descricao,status:'Limpeza concluída',criadoEm:'2026-10-21T10:00:00Z',fotos:[],fotosA:[]},
 {tipo:'antecipacao',d:'20/10/2026',descricao:'Visita prevista: 22/10/2026. Antecipação cancelada.',status:'Cancelada; data original restaurada',criadoEm:'2026-10-20T10:00:00Z',fotos:[],fotosA:[]}
 ],{empresa:'Empresa de exemplo',cidade:'Jatai'});
 const texto=arquivo.toString('latin1');
 assert.match(texto,/Visita antecipada/); assert.match(texto,/22\/10\/2026/); assert.match(texto,/21\/10\/2026/); assert.match(texto,/Realizada:/); assert.equal((texto.match(/Feriado/g)||[]).length,1); assert.match(texto,/HISTORICO DE PARAMETROS/); assert.match(texto,/\/Subtype \/Image/); assert.match(texto,/data original restaurada/);
 assert.ok((await PDFDocument.load(arquivo)).getPageCount()>=1);
 if(process.env.PREVIEW_PDF){await mkdir('output/pdf',{recursive:true});await writeFile('output/pdf/visita-antecipada.pdf',arquivo);}
 }finally{if(original)Object.defineProperty(globalThis,'navigator',original);else delete globalThis.navigator;}
});
