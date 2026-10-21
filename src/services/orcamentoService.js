import { jsPDF } from 'jspdf';
import { desenharIdentidadeProfissional } from './identidadeRelatorio.js';
import { imagemDocumento } from './documentoPdfService.js';

export function validarOrcamento(dados) {
  if (!String(dados.nome || '').trim()) throw new Error('Informe o nome do cliente avulso.');
  if (!String(dados.descricao || '').trim() && !dados.pdf) throw new Error('Descreva o orçamento ou adicione um PDF.');
  if (dados.valor !== '' && dados.valor != null && (!Number.isFinite(Number(dados.valor)) || Number(dados.valor) < 0)) throw new Error('Informe um valor válido.');
}
export async function validarAnexoPDF(arquivo) {
  const { PDFDocument } = await import('pdf-lib');
  if (!arquivo || arquivo.size > 10 * 1024 * 1024) throw new Error('Escolha um PDF com até 10 MB.');
  try { await PDFDocument.load(await arquivo.arrayBuffer()); }
  catch { throw new Error('Não foi possível abrir o PDF. Use um arquivo válido e sem senha.'); }
}
export async function criarOrcamentoPDF(dados, perfil) {
  const { PDFDocument } = await import('pdf-lib');
  validarOrcamento(dados);
  if (!String(perfil.empresa || '').trim()) throw new Error('Salve o nome profissional ou da empresa nas configurações.');
  const pdf = new jsPDF();
  let y = desenharIdentidadeProfissional(pdf, perfil, await imagemDocumento(perfil.fotoPerfilUrl), 15, 22, 180);
  const escrever = (texto, tamanho = 11) => {
    pdf.setFontSize(tamanho);
    for (const linha of pdf.splitTextToSize(String(texto), 180)) {
      if (y > 275) { pdf.addPage(); y = 23; }
      pdf.text(linha, 15, y); y += tamanho * 0.5;
    }
    y += 7;
  };
  pdf.setTextColor(13, 148, 136); pdf.setFont('helvetica', 'bold'); escrever('ORCAMENTO', 20);
  pdf.setTextColor(35); escrever(`Cliente: ${dados.nome}`, 13);
  pdf.setFont('helvetica', 'normal');
  escrever(`Emitido em: ${new Date(dados.criadoEm || Date.now()).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
  if (dados.telefone) escrever(`Contato: ${dados.telefone}`);
  if (dados.descricao) escrever(dados.descricao);
  if (dados.valor !== '' && dados.valor != null) {
    pdf.setFont('helvetica', 'bold'); escrever(`Valor do orcamento: ${Number(dados.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`, 14);
  }
  escrever('Orcamento sujeito a aprovacao do cliente.');
  const documento = await PDFDocument.load(pdf.output('arraybuffer'));
  if (dados.pdf) {
    const anexo = await PDFDocument.load(await dados.pdf.arrayBuffer());
    for (const pagina of await documento.copyPages(anexo, anexo.getPageIndices())) documento.addPage(pagina);
  }
  return new Blob([await documento.save()], { type: 'application/pdf' });
}
