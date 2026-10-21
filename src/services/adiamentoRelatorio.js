import { dataBrasil, formatarDataAgenda, horaBrasil } from './agendaService.js';

export function desenharAdiamentosPDF(pdf, registros, { y, margem = 15, larguraConteudo = 180, topo = 20, limite = 282 }) {
  if (!registros.length) return y;
  const espaco = altura => { if (y + altura > limite) { pdf.addPage(); y = topo; } };
  const escrever = (texto, negrito = false) => {
    pdf.setFont('helvetica', negrito ? 'bold' : 'normal');
    pdf.setFontSize(negrito ? 11 : 9);
    pdf.setTextColor(45, 45, 45);
    for (const linha of pdf.splitTextToSize(texto, larguraConteudo)) { espaco(6); pdf.text(linha, margem, y); y += 5; }
  };
  espaco(25); escrever('HISTORICO DE ADIAMENTOS', true); y += 3;
  for (const a of registros) {
    espaco(30);
    escrever('Visita adiada', true);
    escrever(`Data original: ${formatarDataAgenda(a.dataOriginal)} | Horario: ${a.horarioOriginal || 'Nao informado'}`);
    escrever(`Registrado em: ${formatarDataAgenda(dataBrasil(a.criadoEm))} ${horaBrasil(a.criadoEm)}`);
    if (a.comparecimentoEm) escrever(`Comparecimento: ${formatarDataAgenda(dataBrasil(a.comparecimentoEm))} ${horaBrasil(a.comparecimentoEm)}`);
    escrever(`Motivo: ${a.motivo}`);
    escrever(`Nova data programada: ${formatarDataAgenda(a.novaData)}`);
    const imagens = a.imagensPrincipais || [];
    if (a.fotos?.length && !imagens.length) escrever('Fotografia de comprovacao indisponivel no momento.');
    for (const imagem of imagens) {
      const info = pdf.getImageProperties(imagem);
      const escala = Math.min(80 / info.width, 65 / info.height);
      const largura = info.width * escala, altura = info.height * escala;
      espaco(altura + 5);
      pdf.addImage(imagem, info.fileType, margem, y, largura, altura);
      y += altura + 5;
    }
    y += 7;
  }
  return y;
}
