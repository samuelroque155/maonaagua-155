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
  let imagem = null;
  try { imagem = await imagemDocumento(perfil.fotoPerfilUrl); } catch { /* Identidade padrão mantém o orçamento disponível. */ }
  let y = desenharIdentidadeProfissional(pdf, perfil, imagem, 15, 22, 180);
  const escrever = (texto, tamanho = 11, estilo = 'normal') => {
    pdf.setFont('helvetica', estilo);
    pdf.setFontSize(tamanho);
    for (const linha of pdf.splitTextToSize(String(texto), 180)) {
      if (y > 270) { pdf.addPage(); y = 23; }
      pdf.text(linha, 15, y); y += tamanho * 0.55;
    }
    y += 7;
  };
  // Rótulos em negrito e valores normais, dentro de uma caixa própria.
  pdf.setFontSize(11); pdf.setFont('helvetica', 'normal');
  const campos = [
    ['Cliente:', dados.nome],
    ...(dados.telefone ? [['Contato:', dados.telefone]] : []),
    ['Emitido em:', new Date(dados.criadoEm || Date.now()).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })]
  ];
  const linhasCliente = campos.flatMap(([rotulo, valor]) => pdf.splitTextToSize(String(valor), 139).map((linha, i) => ({ rotulo: i ? '' : rotulo, linha })));
  while (linhasCliente.length) {
    if (y > 235) { pdf.addPage(); y = 23; }
    const linhas = linhasCliente.splice(0, Math.max(1, Math.floor((270 - y - 22) / 7)));
    const altura = 22 + linhas.length * 7;
    pdf.setFillColor(245, 249, 249); pdf.setDrawColor(214, 229, 227);
    pdf.roundedRect(15, y, 180, altura, 3, 3, 'FD');
    pdf.setFontSize(9); pdf.setTextColor(13, 120, 110); pdf.setFont('helvetica', 'bold');
    pdf.text('DADOS DO CLIENTE', 22, y + 10);
    let linhaY = y + 21;
    for (const { rotulo, linha } of linhas) {
      pdf.setFontSize(11); pdf.setTextColor(35); pdf.setFont('helvetica', 'bold');
      pdf.text(rotulo, 22, linhaY);
      pdf.setFont('helvetica', 'normal'); pdf.text(linha, 49, linhaY);
      linhaY += 7;
    }
    y += altura + 16;
  }
  if (y > 235) { pdf.addPage(); y = 23; }
  pdf.setTextColor(13, 120, 110); escrever('ORÇAMENTO', 18, 'bold');
  pdf.setTextColor(35);
  if (String(dados.titulo || '').trim()) escrever(dados.titulo.trim(), 13, 'bold');
  if (dados.descricao) escrever(dados.descricao, 11, 'normal');
  if (dados.valor !== '' && dados.valor != null) {
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(14);
    const linhasTotal = pdf.splitTextToSize(`Valor total: ${Number(dados.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`, 166);
    const alturaTotal = 14 + linhasTotal.length * 7;
    if (y + alturaTotal > 270) { pdf.addPage(); y = 23; }
    pdf.setFillColor(232, 246, 242); pdf.roundedRect(15, y, 180, alturaTotal, 3, 3, 'F');
    pdf.setTextColor(13, 100, 90);
    linhasTotal.forEach((linha, i) => pdf.text(linha, 22, y + 11 + i * 7));
    y += alturaTotal + 12;
  }
  pdf.setTextColor(100); escrever('Orçamento sujeito à aprovação do cliente.', 9, 'normal');
  for (let pagina = 1; pagina <= pdf.getNumberOfPages(); pagina++) {
    pdf.setPage(pagina); pdf.setDrawColor(225); pdf.line(15, 282, 195, 282);
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(110);
    pdf.text(`Orçamento | ${pagina}/${pdf.getNumberOfPages()}`, 195, 289, { align: 'right' });
  }
  const documento = await PDFDocument.load(pdf.output('arraybuffer'));
  if (dados.pdf) {
    const anexo = await PDFDocument.load(await dados.pdf.arrayBuffer());
    for (const pagina of await documento.copyPages(anexo, anexo.getPageIndices())) documento.addPage(pagina);
  }
  return new Blob([await documento.save()], { type: 'application/pdf' });
}
