
import jsPDF from 'jspdf';
import { applyPlugin } from 'jspdf-autotable';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { desenharIdentidadeProfissional, identificacaoCliente } from './identidadeRelatorio';

applyPlugin(jsPDF);

// Converte imagens remotas em Base64.
const urlToBase64 = async (url) => {
  if (!url) return null;
  if (url.startsWith('data:')) return url;

  try {
    const response = await fetch(url, { cache: 'no-store' });

    if (!response.ok) {
      throw new Error(`Erro ao carregar imagem: ${response.status}`);
    }

    const blob = await response.blob();

    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Erro ao converter imagem:', error);
    return null;
  }
};

// Formata a data do histórico.
const formatarDataCurta = (dataStr) => {
  if (!dataStr) return '';

  const partes = String(dataStr).split(/[/\-\s]+/);

  if (partes.length >= 2) {
    const dia = partes[0];
    const mesOriginal = partes[1]
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{N}\s_-]/gu, '')

    const mesNum = parseInt(mesOriginal, 10);

    if (!isNaN(mesNum)) {
      const meses = [
        'Jan', 'Fev', 'Mar', 'Abr',
        'Mai', 'Jun', 'Jul', 'Ago',
        'Set', 'Out', 'Nov', 'Dez'
      ];

      if (mesNum >= 1 && mesNum <= 12) {
        return `${dia}/${meses[mesNum - 1]}`;
      }
    }

    const mesesMap = {
      jan: 'Jan', january: 'Jan', janeiro: 'Jan',
      feb: 'Fev', february: 'Fev', fevereiro: 'Fev', fev: 'Fev',
      mar: 'Mar', march: 'Mar', marco: 'Mar', 'março': 'Mar',
      apr: 'Abr', april: 'Abr', abril: 'Abr',
      may: 'Mai', maio: 'Mai', mai: 'Mai',
      jun: 'Jun', june: 'Jun', junho: 'Jun',
      jul: 'Jul', july: 'Jul', julho: 'Jul',
      aug: 'Ago', august: 'Ago', agosto: 'Ago', ago: 'Ago',
      sep: 'Set', september: 'Set', setembro: 'Set', set: 'Set',
      oct: 'Out', october: 'Out', outubro: 'Out', out: 'Out',
      nov: 'Nov', november: 'Nov', novembro: 'Nov',
      dec: 'Dez', december: 'Dez', dezembro: 'Dez'
    };

    const mesFormatado = mesesMap[mesOriginal];

    if (mesFormatado) {
      return `${dia}/${mesFormatado}`;
    }
  }

  return String(dataStr);
};

// Extrai horário, duração e temperatura.
const extrairDadosRegistro = (v) => {
  if (!v) {
    return { hora: '', duracao: '', temp: '--' };
  }

  let hora = '';
  let duracao = '';
  let temp = '--';

  if (v.h) {
    const match = String(v.h).match(/^(.*?)\s*\((.*?)\)/);

    if (match) {
      hora = match[1].trim();
      duracao = match[2].trim();
    } else {
      hora = String(v.h);
    }
  }

  if (v.t) {
    const tStr = String(v.t).trim();

    if (tStr.endsWith('m')) {
      if (!duracao) duracao = tStr;
    } else {
      temp = tStr.includes('°') ? tStr : `${tStr}°C`;
    }
  }

  return { hora, duracao, temp };
};

// Descobre o formato da imagem.
const obterFormatoImagem = (base64) => {
  if (
    typeof base64 === 'string' &&
    base64.startsWith('data:image/png')
  ) {
    return 'PNG';
  }

  if (
    typeof base64 === 'string' &&
    base64.startsWith('data:image/webp')
  ) {
    return 'WEBP';
  }

  return 'JPEG';
};

// FUNÇÃO PRINCIPAL
export const gerarRelatorioPDF = async (
  cliente,
  historico,
  perfil
) => {
  try {
    const pdf = new jsPDF('p', 'mm', 'a4');

    const pageWidth = pdf.internal.pageSize.width;
    const pageHeight = pdf.internal.pageSize.height;

    const margem = 15;
    const larguraConteudo = pageWidth - margem * 2;
    const topoPagina = 20;
    const limiteConteudo = pageHeight - 15;

    let y = topoPagina;

    const garantirEspaco = (alturaNecessaria) => {
      if (y + alturaNecessaria > limiteConteudo) {
        pdf.addPage();
        y = topoPagina;
      }
    };

    // A foto é incorporada no PDF; o arquivo compartilhado não depende do link temporário.
    const imagemPerfil = perfil?.fotoPerfilUrl ? await urlToBase64(perfil.fotoPerfilUrl) : null;
    if (perfil?.fotoPerfilUrl && !imagemPerfil) throw new Error('Não foi possível carregar a foto ou logo para o relatório. Tente novamente.');
    y = desenharIdentidadeProfissional(pdf, perfil, imagemPerfil, margem, y, larguraConteudo);

    // CARD DO CLIENTE
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    const linhasCliente = pdf.splitTextToSize(identificacaoCliente(cliente), larguraConteudo - 10);
    const alturaCliente = 25 + Math.max(0, linhasCliente.length - 1) * 6;
    pdf.setFillColor(250, 250, 250);

    pdf.roundedRect(
      margem,
      y,
      larguraConteudo,
      alturaCliente,
      3,
      3,
      'F'
    );

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.setTextColor(30, 30, 30);

    const nomeCliente = String(cliente?.nome || 'Cliente');

    pdf.text(
      linhasCliente,
      margem + 5,
      y + 10
    );

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(100, 100, 100);

    const endereco = String(cliente?.endereco || '');

    pdf.text(
      pdf.splitTextToSize(
        endereco,
        larguraConteudo - 10
      ).slice(0, 1),
      margem + 5,
      y + alturaCliente - 7
    );

    y += alturaCliente + 10;
    const responsaveis = [...new Set((historico || []).map(v => v.funcionarioNome).filter(Boolean))];
    if (responsaveis.length) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      const linhas = pdf.splitTextToSize(`Responsavel: ${responsaveis.join(', ')}`, larguraConteudo);
      garantirEspaco(linhas.length * 5 + 5);
      pdf.text(linhas, margem, y);
      y += linhas.length * 5 + 5;
    }

    // CARREGAMENTO DAS FOTOS
    const historicoComImagens = await Promise.all(
      (historico || []).map(async (v) => {
        const imagensPrincipais = [];
        const imagensAlerta = [];

        const carregarImagens = async (miniaturas, originais, destino) => {
          const fontes = miniaturas?.length
            ? [...miniaturas, ...(originais || []).slice(miniaturas.length)]
            : originais || [];
          for (const fonte of fontes) {
            const base64 = await urlToBase64(fonte);
            if (base64) destino.push(base64);
          }
        };
        await carregarImagens(v.fotosMiniaturas, v.fotosBase64?.length ? v.fotosBase64 : v.fotos, imagensPrincipais);
        await carregarImagens(v.fotosAlertaMiniaturas, v.fotosAlertaBase64?.length ? v.fotosAlertaBase64 : v.fotosA, imagensAlerta);

        return {
          ...v,
          imagensPrincipais,
          imagensAlerta
        };
      })
    );

    // HISTÓRICO DE PARÂMETROS
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(50, 50, 50);

    pdf.text(
      'HISTORICO DE PARAMETROS',
      margem,
      y
    );

    y += 5;

    const visitasNormais = historicoComImagens.filter(
      v => v.tipo !== 'problema'
    );

    const tableData = visitasNormais.map(v => {
      const { hora, duracao, temp } = extrairDadosRegistro(v);

      const asp = String(v.asp || v.a || '').toUpperCase();

      const horaCell = duracao
        ? `${hora}\n${duracao}`
        : hora;

      return [
        [formatarDataCurta(v.d), v.funcionarioNome].filter(Boolean).join('\n'),
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

      head: [[
        'DATA',
        'STATUS',
        'HORARIO',
        'CL',
        'PH',
        'ALC',
        'TEMP'
      ]],

      body: tableData,
      theme: 'grid',

      headStyles: {
        fillColor: [24, 24, 27],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'center'
      },

      bodyStyles: {
        textColor: 80,
        fontSize: 8,
        halign: 'center',
        valign: 'middle'
      },

      columnStyles: {
        1: { fontStyle: 'bold' }
      },

      didParseCell: function (data) {
        if (
          data.section === 'body' &&
          data.column.index === 1
        ) {
          const texto = String(data.cell.raw || '');

          if (texto.includes('CRISTALINA')) {
            data.cell.styles.textColor = [20, 184, 166];
          } else if (texto.includes('VERDE')) {
            data.cell.styles.textColor = [16, 185, 129];
          } else if (texto.includes('TURVA')) {
            data.cell.styles.textColor = [245, 158, 11];
          }
        }
      },

      margin: {
        left: margem,
        right: margem
      }
    });

    y = pdf.lastAutoTable.finalY + 15;

    // ==========================================
    // RESUMO FOTOGRÁFICO ORGANIZADO POR VISITA
    // ==========================================

    // Correção: numerar pelo histórico completo.
    // O histórico está ordenado do mais recente ao mais antigo.
    const visitasComFotos = visitasNormais
      .map((v, indice) => ({
        ...v,
        numeroVisita: visitasNormais.length - indice
      }))
      .filter(v => v.imagensPrincipais.length > 0);

    if (visitasComFotos.length > 0) {
      garantirEspaco(22);

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.setTextColor(50, 50, 50);

      pdf.text(
        'RESUMO FOTOGRAFICO (VISITAS)',
        margem,
        y
      );

      y += 9;

      const colunas = 3;
      const espacoFotos = 4;
      const larguraInterna = larguraConteudo - 12;

      const larguraFoto = (
        larguraInterna -
        espacoFotos * (colunas - 1)
      ) / colunas;

      const alturaFoto = 49;
      const alturaLinha = alturaFoto + 4;
      const alturaCabecalho = 18;
      const paddingCard = 6;
      const espacoEntreCards = 9;

      for (
        let indiceVisita = 0;
        indiceVisita < visitasComFotos.length;
        indiceVisita++
      ) {
        const visita = visitasComFotos[indiceVisita];

        // Variáveis restauradas.
        const fotos = visita.imagensPrincipais;
        const { hora, duracao } = extrairDadosRegistro(visita);

        const quantidadeLinhas = Math.ceil(
          fotos.length / colunas
        );

        const alturaFotos =
          quantidadeLinhas * alturaLinha - 4;

        const alturaCard =
          alturaCabecalho +
          paddingCard +
          alturaFotos +
          paddingCard;

        const alturaUtilPagina =
          limiteConteudo - topoPagina;

        if (alturaCard <= alturaUtilPagina) {
          garantirEspaco(
            alturaCard + espacoEntreCards
          );
        } else {
          garantirEspaco(
            alturaCabecalho +
            paddingCard +
            alturaFoto +
            5
          );
        }

        let cardY = y;

        const desenharCabecalho = (
          continuacao = false
        ) => {
          cardY = y;

          pdf.setFillColor(250, 250, 250);
          pdf.setDrawColor(225, 225, 225);

          pdf.roundedRect(
            margem,
            cardY,
            larguraConteudo,
            alturaCabecalho + 4,
            3,
            3,
            'FD'
          );

          pdf.setFillColor(24, 24, 27);

          pdf.roundedRect(
            margem,
            cardY,
            larguraConteudo,
            alturaCabecalho,
            3,
            3,
            'F'
          );

          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(11);
          pdf.setTextColor(255, 255, 255);

          const dataCompleta = String(
            visita.d || 'Data não informada'
          );

          // NUMERAÇÃO CORRIGIDA
          const tituloVisita =
            `${dataCompleta} - VISITA ${visita.numeroVisita}` +
            (continuacao ? ' (CONT.)' : '');

          pdf.text(
            tituloVisita,
            margem + 5,
            cardY + 7
          );

          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(8);
          pdf.setTextColor(190, 190, 190);

          const detalhes = [
            hora,
            duracao ? `Duracao: ${duracao}` : ''
          ].filter(Boolean).join('  |  ');

          if (detalhes) {
            pdf.text(
              detalhes,
              margem + 5,
              cardY + 13
            );
          }

          pdf.setFillColor(13, 148, 136);

          pdf.roundedRect(
            pageWidth - margem - 34,
            cardY + 5,
            29,
            8,
            2,
            2,
            'F'
          );

          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(8);
          pdf.setTextColor(255, 255, 255);

          pdf.text(
            `${fotos.length} FOTOS`,
            pageWidth - margem - 19.5,
            cardY + 10.5,
            { align: 'center' }
          );

          y =
            cardY +
            alturaCabecalho +
            paddingCard;
        };

        desenharCabecalho();

        // FOTOS DA VISITA
        for (
          let linha = 0;
          linha < quantidadeLinhas;
          linha++
        ) {
          if (
            y + alturaFoto + paddingCard >
            limiteConteudo
          ) {
            pdf.addPage();
            y = topoPagina;
            desenharCabecalho(true);
          }

          for (
            let coluna = 0;
            coluna < colunas;
            coluna++
          ) {
            const indiceFoto =
              linha * colunas + coluna;

            if (indiceFoto >= fotos.length) {
              break;
            }

            const base64 = fotos[indiceFoto];

            const x =
              margem +
              paddingCard +
              coluna * (
                larguraFoto + espacoFotos
              );

            try {
              const formato = obterFormatoImagem(base64);

              pdf.addImage(
                base64,
                formato,
                x,
                y,
                larguraFoto,
                alturaFoto
              );

              pdf.setFillColor(0, 0, 0);

              pdf.rect(
                x,
                y + alturaFoto - 7,
                larguraFoto,
                7,
                'F'
              );

              pdf.setFont('helvetica', 'bold');
              pdf.setFontSize(8);
              pdf.setTextColor(255, 255, 255);

              pdf.text(
                `FOTO ${indiceFoto + 1}`,
                x + larguraFoto / 2,
                y + alturaFoto - 2.5,
                { align: 'center' }
              );
            } catch (erro) {
              console.warn(
                'Erro ao inserir foto no PDF:',
                erro
              );

              pdf.setDrawColor(220, 220, 220);

              pdf.rect(
                x,
                y,
                larguraFoto,
                alturaFoto
              );

              pdf.setFontSize(8);
              pdf.setTextColor(120, 120, 120);

              pdf.text(
                'Imagem indisponivel',
                x + larguraFoto / 2,
                y + alturaFoto / 2,
                { align: 'center' }
              );
            }
          }

          y += alturaLinha;
        }

        y += 2;

        pdf.setDrawColor(225, 225, 225);

        pdf.line(
          margem,
          y,
          pageWidth - margem,
          y
        );

        y += espacoEntreCards;
      }

      y += 5;
    }

    // ==========================================
    // OCORRÊNCIAS E ALERTAS
    // ==========================================

    const ocorrencias = historicoComImagens.filter(
      v =>
        v.tipo === 'problema' ||
        Boolean(String(v.txtA || '').trim()) ||
        v.imagensAlerta.length > 0
    );

    if (ocorrencias.length > 0) {
      garantirEspaco(25);

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.setTextColor(190, 24, 74);

      pdf.text(
        'OCORRENCIAS E ALERTAS REGISTRADOS',
        margem,
        y
      );

      y += 8;

      for (const ocorrencia of ocorrencias) {
        const descricao = String(
          ocorrencia.txtA ||
          'Nenhuma descrição fornecida.'
        );

        const linhasTexto = pdf.splitTextToSize(
          descricao,
          larguraConteudo - 10
        );

        const alturaTexto =
          linhasTexto.length * 4.5;

        const fotosOcorrencia =
          ocorrencia.imagensAlerta;

        const larguraFotoOcorrencia = 22;
        const alturaFotoOcorrencia = 22;
        const gapOcorrencia = 3;
        const fotosPorLinha = 6;

        const linhasFotos = Math.ceil(
          fotosOcorrencia.length / fotosPorLinha
        );

        const alturaFotosOcorrencia =
          linhasFotos > 0
            ? 5 +
              linhasFotos * (
                alturaFotoOcorrencia +
                gapOcorrencia
              )
            : 0;

        const alturaCard =
          14 +
          alturaTexto +
          alturaFotosOcorrencia +
          5;

        const alturaMaxima =
          limiteConteudo - topoPagina;

        if (alturaCard <= alturaMaxima) {
          garantirEspaco(alturaCard + 6);
        } else {
          garantirEspaco(30);
        }

        const cardInicioY = y;

        const alturaVisivel = Math.min(
          alturaCard,
          limiteConteudo - cardInicioY
        );

        pdf.setFillColor(254, 242, 242);
        pdf.setDrawColor(252, 165, 165);

        pdf.roundedRect(
          margem,
          cardInicioY,
          larguraConteudo,
          alturaVisivel,
          2,
          2,
          'FD'
        );

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(9);
        pdf.setTextColor(185, 28, 28);

        const tituloOcorrencia =
          `DATA: ${ocorrencia.d || ''} ` +
          `${ocorrencia.h || ''} - OCORRENCIA`;

        pdf.text(
          pdf.splitTextToSize(
            tituloOcorrencia,
            larguraConteudo - 10
          )[0],
          margem + 5,
          y + 6
        );

        y += 12;

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8.5);
        pdf.setTextColor(60, 60, 60);

        for (const linhaTexto of linhasTexto) {
          garantirEspaco(5);

          pdf.text(
            linhaTexto,
            margem + 5,
            y
          );

          y += 4.5;
        }

        if (fotosOcorrencia.length > 0) {
          y += 5;

          for (
            let indice = 0;
            indice < fotosOcorrencia.length;
            indice++
          ) {
            const coluna =
              indice % fotosPorLinha;

            if (coluna === 0) {
              garantirEspaco(
                alturaFotoOcorrencia + 4
              );
            }

            const x =
              margem +
              5 +
              coluna * (
                larguraFotoOcorrencia +
                gapOcorrencia
              );

            try {
              pdf.addImage(
                fotosOcorrencia[indice],
                obterFormatoImagem(
                  fotosOcorrencia[indice]
                ),
                x,
                y,
                larguraFotoOcorrencia,
                alturaFotoOcorrencia
              );
            } catch (erro) {
              console.warn(
                'Erro ao inserir foto da ocorrência:',
                erro
              );
            }

            const ultimaColuna =
              coluna === fotosPorLinha - 1;

            const ultimaFoto =
              indice === fotosOcorrencia.length - 1;

            if (ultimaColuna || ultimaFoto) {
              y +=
                alturaFotoOcorrencia +
                gapOcorrencia;
            }
          }
        }

        y += 10;
      }

      y += 5;
    }

    // ==========================================
    // RODAPÉ
    // ==========================================

    if (y > 260) {
      pdf.addPage();
    }

    const rodapeY = 260;

    pdf.setFillColor(24, 24, 27);

    pdf.rect(
      margem,
      rodapeY,
      larguraConteudo,
      30,
      'F'
    );

    pdf.setFillColor(20, 184, 166);

    pdf.rect(
      margem,
      rodapeY,
      larguraConteudo,
      2,
      'F'
    );

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.setTextColor(255, 255, 255);

    pdf.text(
      'Obrigado pela confianca!',
      pageWidth / 2,
      rodapeY + 10,
      { align: 'center' }
    );

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(161, 161, 170);

    pdf.text(
      'Este servico utiliza a tecnologia e o padrao de qualidade Mao Na Agua.',
      pageWidth / 2,
      rodapeY + 16,
      { align: 'center' }
    );

    pdf.text(
      'Para visualizar as fotos originais, acesse a plataforma.',
      pageWidth / 2,
      rodapeY + 22,
      { align: 'center' }
    );

    // ==========================================
    // SALVAR OU COMPARTILHAR
    // ==========================================

    const nomeArquivoSeguro = nomeCliente
  .replace(/[^\p{L}\p{N}\s_-]/gu, '')
  .trim()
  .replace(/\s+/g, '_');

const fileName =
  `Relatorio_${nomeArquivoSeguro || 'Cliente'}.pdf`;

    if (Capacitor.isNativePlatform()) {
      const pdfBase64 = pdf
        .output('datauristring')
        .split(',')[1];

      const writeRes = await Filesystem.writeFile({
        path: fileName,
        data: pdfBase64,
        directory: Directory.Cache
      });

      await Share.share({
        title: `Relatório - ${nomeCliente}`,
        text:
          'Segue em anexo o relatório de manutenção da piscina.',
        url: writeRes.uri,
        dialogTitle: 'Compartilhar Relatório'
      });
    } else {
      const pdfBlob = pdf.output('blob');

      const file = new File(
        [pdfBlob],
        fileName,
        { type: 'application/pdf' }
      );

      const podeCompartilhar =
        typeof navigator.share === 'function' &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [file] });

      if (podeCompartilhar) {
        await navigator.share({
          title: `Relatório - ${nomeCliente}`,
          text: 'Relatório de manutenção de piscina.',
          files: [file]
        });
      } else {
        pdf.save(fileName);
      }
    }
  } catch (error) {
    if (error.name !== 'AbortError') {
      console.error(
        'Erro ao processar PDF:',
        error
      );

      alert(
        'Erro ao processar PDF: ' +
        error.message
      );
    }
  }
};
