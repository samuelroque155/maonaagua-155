export function identificacaoCliente(cliente) {
  return `Cliente: ${String(cliente?.nome || '').trim() || 'Nome não informado'}`;
}

export function desenharIdentidadeProfissional(pdf, perfil, imagem, margem, topo, largura) {
  let imagemDesenhada = false;
  try { if (imagem) {
    const propriedades = pdf.getImageProperties(imagem);
    const escala = Math.min(24 / propriedades.width, 24 / propriedades.height);
    const w = propriedades.width * escala;
    const h = propriedades.height * escala;
    pdf.addImage(imagem, propriedades.fileType, margem + (24 - w) / 2, topo - 5 + (24 - h) / 2, w, h);
    imagemDesenhada = true;
  } } catch { /* Imagem inválida não impede a emissão do documento. */ }
  if (!imagemDesenhada) {
    pdf.setFillColor(13, 148, 136);
    pdf.roundedRect(margem, topo - 5, 24, 24, 5, 5, 'F');
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10); pdf.setTextColor(255);
    pdf.text('MNA', margem + 12, topo + 9, { align: 'center' });
  }
  const inicioTexto = margem + 31;
  const larguraTexto = largura - 31;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(20);
  pdf.setTextColor(13, 148, 136);
  const nome = pdf.splitTextToSize(String(perfil?.empresa || 'Mão Na Água'), larguraTexto);
  pdf.text(nome, inicioTexto, topo);
  const yCidade = topo + nome.length * 8;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(100, 100, 100);
  const cidade = pdf.splitTextToSize(String(perfil?.cidade || ''), larguraTexto);
  pdf.text(cidade, inicioTexto, yCidade);
  return Math.max(yCidade + cidade.length * 5, topo + 19) + 8;
}
