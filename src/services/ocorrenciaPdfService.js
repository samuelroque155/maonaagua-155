import { jsPDF } from 'jspdf';
import { desenharIdentidadeProfissional, identificacaoCliente } from './identidadeRelatorio.js';
import { compartilharDocumento, imagemDocumento } from './documentoPdfService.js';

export async function criarOcorrenciaPDF(cliente, ocorrencia, perfil) {
  const pdf = new jsPDF();
  let y = desenharIdentidadeProfissional(pdf, perfil, await imagemDocumento(perfil?.fotoPerfilUrl), 15, 22, 180);
  const espaco = altura => { if (y + altura > 280) { pdf.addPage(); y = 20; } };
  espaco(43);
  pdf.setFillColor(190, 24, 45); pdf.roundedRect(15, y, 180, 28, 3, 3, 'F');
  pdf.setTextColor(255); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(16);
  pdf.text('ATENCAO: OCORRENCIA TECNICA', 21, y + 11);
  pdf.setFontSize(10); pdf.text('Problema identificado na piscina. Confira o registro abaixo.', 21, y + 20);
  y += 39; pdf.setTextColor(30); pdf.setFontSize(12);
  for (const texto of [identificacaoCliente(cliente), `Data: ${ocorrencia.d || ''} ${ocorrencia.h || ''}`, ocorrencia.txtA || '']) {
    const linhas = pdf.splitTextToSize(texto, 178);
    for (const linha of linhas) { espaco(7); pdf.text(linha, 16, y); y += 6; }
    y += 5;
  }
  const fontes = ocorrencia.fotosAlertaBase64?.length ? ocorrencia.fotosAlertaBase64 : ocorrencia.fotosA || [];
  for (const fonte of fontes) {
    const imagem = await imagemDocumento(fonte);
    const props = pdf.getImageProperties(imagem);
    const escala = Math.min(178 / props.width, 125 / props.height);
    const largura = props.width * escala, altura = props.height * escala;
    espaco(altura + 9); pdf.addImage(imagem, props.fileType, 16, y, largura, altura); y += altura + 9;
  }
  for (let i = 1; i <= pdf.getNumberOfPages(); i++) {
    pdf.setPage(i); pdf.setFontSize(8); pdf.setTextColor(110);
    pdf.text(`Registro tecnico - ${perfil?.empresa || 'Mao Na Agua'} - ${i}/${pdf.getNumberOfPages()}`, 15, 290);
  }
  return pdf.output('blob');
}
export async function enviarOcorrenciaPDF(cliente, ocorrencia, perfil) {
  const blob = await criarOcorrenciaPDF(cliente, ocorrencia, perfil);
  await compartilharDocumento(blob, `Ocorrencia_${String(cliente.nome || 'Cliente').replace(/[^\p{L}\p{N}_-]/gu, '_')}.pdf`, 'Ocorrência técnica', `Atenção: ocorrência técnica registrada por ${perfil.empresa || 'Mão Na Água'}.`);
}
