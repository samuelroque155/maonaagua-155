import jsPDF from 'jspdf';
import { applyPlugin } from 'jspdf-autotable';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

applyPlugin(jsPDF);

// Helper for converting network image URLs to base64
const urlToBase64 = async (url) => {
  if (!url) return null;
  if (url.startsWith('data:')) return url; // Already base64
  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Imagem indisponível (${response.status})`);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("Erro ao converter URL de imagem para base64:", error);
    return null;
  }
};

const formatoDaImagem = (imagem) => {
  const tipo = String(imagem || '').match(/^data:image\/([a-zA-Z0-9+.-]+);/i)?.[1]?.toLowerCase();
  if (tipo === 'png') return 'PNG';
  if (tipo === 'webp') return 'WEBP';
  return 'JPEG';
};

// Mostra qualquer foto dentro da área reservada, sem cortar a imagem ou
// distorcê-la. Assim as fotos verticais e horizontais ficam boas no relatório.
const adicionarMiniatura = (pdf, imagem, x, y, largura, altura) => {
  try {
    const propriedades = pdf.getImageProperties(imagem);
    const escala = Math.min(largura / propriedades.width, altura / propriedades.height);
    const larguraImagem = propriedades.width * escala;
    const alturaImagem = propriedades.height * escala;
    const posicaoX = x + (largura - larguraImagem) / 2;
    const posicaoY = y + (altura - alturaImagem) / 2;

    pdf.setFillColor(245, 245, 245);
    pdf.rect(x, y, largura, altura, 'F');
    pdf.addImage(imagem, formatoDaImagem(imagem), posicaoX, posicaoY, larguraImagem, alturaImagem, undefined, 'FAST');
    pdf.setDrawColor(220, 220, 220);
    pdf.rect(x, y, largura, altura, 'S');
    return true;
  } catch (error) {
    console.warn('Erro ao inserir miniatura no PDF', error);
    return false;
  }
};

// Helper for date formatting
const formatarDataCurta = (dataStr) => {
  if (!dataStr) return '';
  const partes = dataStr.split(/[/\-\s]+/);
  if (partes.length >= 2) {
    const dia = partes[0];
    const mesOriginal = partes[1].toLowerCase().trim().replace('.', '');
    
    // Tenta converter se for número
    const mesNum = parseInt(mesOriginal, 10);
    if (!isNaN(mesNum)) {
      const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
      if (mesNum >= 1 && mesNum <= 12) {
        return `${dia}/${meses[mesNum - 1]}`;
      }
    }
    
    // Se for string
    const mesesMap = {
      'jan': 'Jan', 'january': 'Jan', 'janeiro': 'Jan',
      'feb': 'Fev', 'february': 'Fev', 'fevereiro': 'Fev', 'fev': 'Fev',
      'mar': 'Mar', 'march': 'Mar', 'março': 'Mar',
      'apr': 'Abr', 'april': 'Abr', 'abril': 'Abr',
      'may': 'Mai', 'maio': 'Mai', 'mai': 'Mai',
      'jun': 'Jun', 'june': 'Jun', 'junho': 'Jun',
      'jul': 'Jul', 'july': 'Jul', 'julho': 'Jul',
      'aug': 'Ago', 'august': 'Ago', 'agosto': 'Ago', 'ago': 'Ago',
      'sep': 'Set', 'september': 'Set', 'setembro': 'Set', 'set': 'Set',
      'oct': 'Out', 'october': 'Out', 'outubro': 'Out', 'out': 'Out',
      'nov': 'Nov', 'november': 'Nov', 'novembro': 'Nov',
      'dec': 'Dez', 'december': 'Dez', 'dezembro': 'Dez', 'dez': 'Dez'
    };
    
    const mesFormatado = mesesMap[mesOriginal];
    if (mesFormatado) {
      return `${dia}/${mesFormatado}`;
    }
  }
  return dataStr;
};

const extrairDadosRegistro = (v) => {
  if (!v) return { hora: '', duracao: '', temp: '--' };
  let hora = '';
  let duracao = '';
  let temp;

  if (v.h) {
    const match = v.h.match(/(.*) \((.*)\)/);
    if (match) {
      hora = match[1];
      duracao = match[2];
    } else {
      hora = v.h;
    }
  }

  if (v.t) {
    const tStr = String(v.t).trim();
    if (tStr.endsWith('m')) {
      if (!duracao) {
        duracao = tStr;
      }
      temp = '--';
    } else {
      temp = tStr.includes('°') ? tStr : `${tStr}°C`;
    }
  } else {
    temp = '--';
  }

  return { hora, duracao, temp };
};

export const gerarRelatorioPDF = async (cliente, historico, perfil) => {
  try {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.width;
    let y = 20;

    // Cabeçalho (Empresa e Cidade)
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(22);
    pdf.setTextColor(13, 148, 136); // teal-600
    pdf.text(perfil.empresa || 'Mão Na Água', 15, y);
    
    y += 6;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(100, 100, 100);
    pdf.text(perfil.cidade || 'Sua Cidade', 15, y);

    y += 12;

    // Card do Cliente
    pdf.setFillColor(250, 250, 250);
    pdf.roundedRect(15, y, pageWidth - 30, 25, 3, 3, 'F');
    
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.setTextColor(30, 30, 30);
    pdf.text(cliente.nome, 20, y + 10);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(100, 100, 100);
    pdf.text(cliente.endereco, 20, y + 18);

    y += 35;

    // Pré-carrega todas as imagens para converter em Base64 assincronamente
    const historicoComImagens = await Promise.all(
      historico.map(async (v) => {
        const imagensPrincipais = [];
        const imagensAlerta = [];

        const carregarImagens = async (miniaturas, originais, destino) => {
          // As miniaturas são guardadas junto à visita. Assim o PDF não fica
          // dependente de converter uma URL remota durante a geração.
          const fontes = miniaturas?.length
            ? [...miniaturas, ...(originais || []).slice(miniaturas.length)]
            : originais;
          for (const fonte of fontes || []) {
            if (!fonte) continue;
            if (typeof fonte === 'string' && fonte.startsWith('data:image')) {
              destino.push(fonte);
              continue;
            }
            const b64 = await urlToBase64(fonte);
            if (b64) destino.push(b64);
          }
        };

        // Fotos normais da piscina
        await carregarImagens(
          v.fotosMiniaturas,
          v.fotosBase64?.length ? v.fotosBase64 : v.fotos,
          imagensPrincipais
        );

        // Fotos de alerta / ocorrência
        await carregarImagens(
          v.fotosAlertaMiniaturas,
          v.fotosAlertaBase64?.length ? v.fotosAlertaBase64 : v.fotosA,
          imagensAlerta
        );

        return { ...v, imagensPrincipais, imagensAlerta };
      })
    );

    // HISTÓRICO DE PARÂMETROS Title
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(50, 50, 50);
    pdf.text("HISTORICO DE PARAMETROS", 15, y);
    
    y += 5;

    // Filtra registros que são apenas ocorrências (tipo === 'problema') para a tabela de parâmetros
    const visitasNormais = historicoComImagens.filter(v => v.tipo !== 'problema');

    // Tabela usando jspdf-autotable
    const tableData = visitasNormais.map(v => {
      const { hora, duracao, temp } = extrairDadosRegistro(v);
      const asp = (v.asp || v.a || '').toUpperCase();
      const horaCell = duracao ? `${hora}\n${duracao}` : hora;
      return [
        formatarDataCurta(v.d),
        asp,
        horaCell,
        v.c || '-',
        v.p || '-',
        v.al || '-',
        temp
      ];
    });

    pdf.autoTable({
      startY: y,
      head: [['DATA', 'STATUS', 'HORARIO', 'CL', 'PH', 'ALC', 'TEMP']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [24, 24, 27], textColor: 255, fontStyle: 'bold', fontSize: 8, halign: 'center' },
      bodyStyles: { textColor: 80, fontSize: 8, halign: 'center', valign: 'middle' },
      columnStyles: {
        1: { fontStyle: 'bold' } // Status column
      },
      didParseCell: function (data) {
        if (data.section === 'body' && data.column.index === 1) {
          const text = data.cell.raw;
          if (text.includes('CRISTALINA')) data.cell.styles.textColor = [20, 184, 166];
          else if (text.includes('VERDE')) data.cell.styles.textColor = [16, 185, 129];
          else if (text.includes('TURVA')) data.cell.styles.textColor = [245, 158, 11];
        }
      },
      margin: { left: 15, right: 15 }
    });

    y = pdf.lastAutoTable.finalY + 15;

    // RESUMO FOTOGRÁFICO (VISITAS)
    const visitasComFotos = historicoComImagens.filter(v => v.imagensPrincipais.length > 0);
    if (visitasComFotos.length > 0) {
      if (y > 240) {
        pdf.addPage();
        y = 20;
      }
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.setTextColor(50, 50, 50);
      pdf.text("RESUMO FOTOGRAFICO (VISITAS)", 15, y);
      y += 8;

      let x = 15;
      const imgWidth = 40;
      const imgHeight = 36;
      const gap = 5;

      for (let v of visitasComFotos) {
        for (let base64 of v.imagensPrincipais) {
          if (x + imgWidth > pageWidth - 15) {
            x = 15;
            y += imgHeight + 12;
            if (y + imgHeight + 10 > 280) {
              pdf.addPage();
              y = 20;
            }
          }

          if (adicionarMiniatura(pdf, base64, x, y, imgWidth, imgHeight)) {
            pdf.setFillColor(0, 0, 0);
            pdf.rect(x, y + imgHeight, imgWidth, 7, 'F');
            pdf.setFontSize(7);
            pdf.setTextColor(255, 255, 255);
            pdf.text(formatarDataCurta(v.d).toUpperCase(), x + (imgWidth / 2), y + imgHeight + 4.8, { align: 'center' });
          }

          x += imgWidth + gap;
        }
      }
      if (x !== 15) y += imgHeight + 15;
    }

    // SEÇÃO DEDICADA A OCORRÊNCIAS TÉCNICAS E ALERTAS
    const ocorrencias = historicoComImagens.filter(v => v.tipo === 'problema' || (v.txtA && v.txtA.trim()) || v.imagensAlerta.length > 0);
    if (ocorrencias.length > 0) {
      if (y > 230) {
        pdf.addPage();
        y = 20;
      }
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.setTextColor(190, 24, 74); // rose-700
      pdf.text("OCORRENCIAS E ALERTAS REGISTRADOS", 15, y);
      y += 8;

      for (let o of ocorrencias) {
        if (y > 230) {
          pdf.addPage();
          y = 20;
        }

        const descTexto = o.txtA || "Nenhuma descrição fornecida.";
        const linhasTexto = pdf.splitTextToSize(descTexto, pageWidth - 40);
        const textoHeight = linhasTexto.length * 4.5;
        const boxHeight = o.imagensAlerta.length > 0 ? (20 + textoHeight + 25) : (14 + textoHeight);

        // Caixa vermelha clara para o card de ocorrência
        pdf.setFillColor(254, 242, 242); 
        pdf.setDrawColor(252, 165, 165);
        pdf.roundedRect(15, y, pageWidth - 30, boxHeight, 2, 2, 'FD');

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(9);
        pdf.setTextColor(185, 28, 28); // red-700
        pdf.text(`DATA: ${o.d} ${o.h ? `às ${o.h}` : ''} - OCORRÊNCIA`, 20, y + 6);

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8.5);
        pdf.setTextColor(60, 60, 60);
        pdf.text(linhasTexto, 20, y + 12);

        if (o.imagensAlerta.length > 0) {
          let ox = 20;
          const oimgWidth = 22;
          const oimgHeight = 22;
          const ogap = 3;

          for (let img of o.imagensAlerta) {
            adicionarMiniatura(pdf, img, ox, y + 14 + textoHeight, oimgWidth, oimgHeight);
            ox += oimgWidth + ogap;
          }
        }

        y += boxHeight + 6;
      }
      y += 10;
    }

    // FOOTER (Always at the bottom of page)
    if (y > 260) {
      pdf.addPage();
      y = 20;
    } else {
      y = 260; // Push to bottom
    }

    pdf.setFillColor(24, 24, 27); // zinc-900
    pdf.rect(15, y, pageWidth - 30, 30, 'F');
    // Top border teal
    pdf.setFillColor(20, 184, 166);
    pdf.rect(15, y, pageWidth - 30, 2, 'F');

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.setTextColor(255, 255, 255);
    pdf.text("Obrigado pela confianca!", pageWidth / 2, y + 10, { align: 'center' });

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(161, 161, 170); // zinc-400
    pdf.text("Este servico utiliza a tecnologia e o padrao de qualidade Mao Na Agua.", pageWidth / 2, y + 16, { align: 'center' });
    pdf.text("Para visualizar as fotos originais, acesse a plataforma.", pageWidth / 2, y + 22, { align: 'center' });

    const fileName = `Relatorio_${cliente.nome.replace(/\s+/g, '_')}.pdf`;

    if (Capacitor.isNativePlatform()) {
      const pdfBase64 = pdf.output('datauristring').split(',')[1];
      const writeRes = await Filesystem.writeFile({
        path: fileName,
        data: pdfBase64,
        directory: Directory.Cache
      });
      
      await Share.share({
        title: `Relatório - ${cliente.nome}`,
        text: 'Segue em anexo o relatório de manutenção da piscina.',
        url: writeRes.uri,
        dialogTitle: 'Compartilhar Relatório'
      });
    } else {
      const pdfBlob = pdf.output('blob');
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
      
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ 
          title: `Relatório - ${cliente.nome}`, 
          text: 'Relatório de manutenção de piscina.',
          files: [file] 
        });
      } else {
        pdf.save(fileName);
      }
    }

  } catch (error) {
    if (error.name !== 'AbortError') {
      console.error("Erro ao processar PDF:", error);
      alert("Erro ao processar PDF: " + error.message);
    }
  }
};
