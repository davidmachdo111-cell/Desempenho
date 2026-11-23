import { jsPDF } from 'jspdf';
import { Character, Checklist, Exercise, getCellName } from '../types/portal';

export interface PdfGeneratedBy {
  fullName: string;
  username: string;
}

/**
 * Aplica o rodapé institucional de rastreabilidade e paginação em TODAS as páginas do PDF
 */
export function applyPdfTraceabilityFooter(
  doc: jsPDF,
  generatedBy?: PdfGeneratedBy
): void {
  const totalPages = doc.getNumberOfPages();
  const fullName = generatedBy?.fullName?.trim() || 'Sistema';
  const username = generatedBy?.username?.trim() || 'portal';
  const issuedAt = new Date().toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  const leftMargin = 14;
  const contentWidth = 182;
  const footerY = 283;

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.line(leftMargin, footerY, leftMargin + contentWidth, footerY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Emitido por: ${fullName} (@${username}) • ${issuedAt}`,
      leftMargin,
      footerY + 4.5
    );

    doc.setFont('helvetica', 'bold');
    doc.text(
      `Página ${i} de ${totalPages}`,
      leftMargin + contentWidth,
      footerY + 4.5,
      { align: 'right' }
    );
  }
}

/**
 * Interface para exames extraídos da guia
 */
export interface GuideExamItem {
  itemNumber: string;
  name: string;
  tussCode: string;
  deadlineAns: string;
  status: string;
}

/**
 * Extrai e estrutura a lista de exames/procedimentos a partir dos dados do personagem
 */
export function extractExamsFromCharacter(char: Character): GuideExamItem[] {
  const text = char.objectives || '';
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  let rawExamStrings: string[] = [];

  // Tenta extrair a linha "Exames solicitados: ..."
  const examLine = lines.find((l) => /exames?(\s+solicitados?)?:/i.test(l) || /solicita[çc][ãa]o:/i.test(l));
  if (examLine) {
    const afterColon = examLine.replace(/^[^:]+:\s*/i, '');
    // Separa por vírgula ou ponto-e-vírgula ou ' e '
    const parts = afterColon.split(/[,;]|\be\b/i).map((p) => p.trim()).filter((p) => p.length > 2);
    if (parts.length > 0) {
      rawExamStrings = parts;
    }
  }

  // Se não achou na linha específica, divide o texto por frases ou tópicos
  if (rawExamStrings.length === 0) {
    const bullets = lines.filter((l) => l.startsWith('•') || l.startsWith('-') || /^\d+\./.test(l));
    if (bullets.length > 0) {
      rawExamStrings = bullets.map((b) => b.replace(/^[•\-\d.]\s*/, ''));
    } else {
      // Pega primeiras sentenças
      rawExamStrings = [text.slice(0, 80)];
    }
  }

  // Mapeia códigos TUSS e prazos simulados condizentes com a ANS RN 566/2022
  const sampleTussCodes = ['40301630', '40302016', '40316288', '40304360', '40311219', '40306126', '40307246'];
  const cellDeadlines: Record<string, string> = {
    LAB: 'Até 03 dias úteis',
    IMG: 'Até 05 dias úteis',
    CONSULTA: 'Até 07 dias úteis',
    TERAPIA: 'Até 10 dias úteis',
    OPERADORA: 'Até 05 dias úteis',
  };

  const defaultDeadline = cellDeadlines[char.cell] || 'Até 03 dias úteis';

  return rawExamStrings.slice(0, 5).map((examName, idx) => ({
    itemNumber: String(idx + 1).padStart(2, '0'),
    name: examName.replace(/[.]*$/, '').trim(),
    tussCode: sampleTussCodes[idx % sampleTussCodes.length],
    deadlineAns: idx === 0 ? defaultDeadline : 'Até 03 dias úteis',
    status: idx % 2 === 0 ? 'Liberado / Apto' : 'Em Análise / Jejum',
  }));
}

export function getPreparationGuidelines(_char?: Character): string[] {
  return [];
}

/**
 * Renderiza uma página com a Ficha do Cliente / Roteiro no documento PDF
 */
export function renderCharacterSheetOnDoc(
  doc: jsPDF,
  char: Character,
  exerciseTitle?: string,
  _pageNumber: number = 1,
  _totalPages: number = 1
): void {
  const cellName = getCellName(char.cell);

  // Paleta corporativa esmeralda e cinza institucional
  const primaryEmerald = [6, 78, 59] as const; // #064E3B
  const mediumEmerald = [4, 120, 87] as const; // #047857
  const softEmerald = [236, 253, 245] as const; // #ECFDF5
  const slateDark = [15, 23, 42] as const; // #0F172A
  const slateMuted = [100, 116, 139] as const; // #64748B
  const slateBorder = [203, 213, 225] as const; // #CBD5E1
  const bgLight = [248, 250, 252] as const; // #F8FAFC
  const white = [255, 255, 255] as const;

  const leftMargin = 14;
  const contentWidth = 182;
  let currentY = 12;

  // ============================================================================
  // A) CABEÇALHO LIMPO E INSTITUCIONAL
  // ============================================================================
  doc.setFillColor(...primaryEmerald);
  doc.roundedRect(leftMargin, currentY, contentWidth, 18, 2, 2, 'F');

  // Título Institucional
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...white);
  doc.text('PORTAL DE DESEMPENHO — FICHA DO CLIENTE / ROTEIRO', leftMargin + 6, currentY + 8);

  // Subtítulo: Somente a Célula (e título do exercício se fornecido)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(209, 250, 229); // #D1FAE5
  const headerSubtitle = exerciseTitle
    ? `Célula: ${cellName}   ·   Cenário: ${exerciseTitle.slice(0, 50)}`
    : `Célula: ${cellName}`;
  doc.text(headerSubtitle, leftMargin + 6, currentY + 13.5);

  currentY += 24;

  // ============================================================================
  // B) DADOS CADASTRAIS DO CLIENTE
  // ============================================================================
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...primaryEmerald);
  doc.text('1. DADOS CADASTRAIS DO CLIENTE', leftMargin, currentY);

  currentY += 3.5;

  const hasObjectives = Boolean(char.objectives?.trim());
  const cardBoxHeight = hasObjectives ? 44 : 34;

  doc.setFillColor(...bgLight);
  doc.setDrawColor(...slateBorder);
  doc.setLineWidth(0.3);
  doc.roundedRect(leftMargin, currentY, contentWidth, cardBoxHeight, 2, 2, 'FD');

  const col1 = leftMargin + 4;
  const col2 = leftMargin + 65;
  const col3 = leftMargin + 125;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...slateMuted);
  doc.text('NOME COMPLETO:', col1, currentY + 5);
  doc.text('NÚMERO DA CARTEIRINHA:', col2, currentY + 5);
  doc.text('IDADE / SEXO:', col3, currentY + 5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...slateDark);
  doc.text(char.name || '---', col1, currentY + 9);
  doc.text(char.cardNumber || '---', col2, currentY + 9);
  const ageDisplay = char.age ? (char.age.toLowerCase().includes('ano') ? char.age : `${char.age} anos`) : '---';
  doc.text(`${ageDisplay} · ${char.gender || '---'}`, col3, currentY + 9);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...slateMuted);
  doc.text('CIDADE / POLO:', col1, currentY + 14.5);
  doc.text('CÉLULA:', col2, currentY + 14.5);
  doc.text('CLASSIFICAÇÃO / COMPLEXIDADE:', col3, currentY + 14.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...slateDark);
  doc.text(char.city || '---', col1, currentY + 18.5);

  // Badge da Célula
  doc.setFillColor(...softEmerald);
  doc.setDrawColor(...mediumEmerald);
  doc.roundedRect(col2, currentY + 15.5, 32, 4.5, 1, 1, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...primaryEmerald);
  doc.text(cellName, col2 + 16, currentY + 18.8, { align: 'center' });

  // Badge da Classificação
  doc.setFillColor(254, 243, 199); // #FEF3C7
  doc.setDrawColor(217, 119, 6); // #D97706
  doc.roundedRect(col3, currentY + 15.5, 34, 4.5, 1, 1, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(146, 64, 14); // #92400E
  doc.text(char.customerTier || 'Mediano', col3 + 17, currentY + 18.8, { align: 'center' });

  // Linha 3 de dados: Perfil / Temperamento
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...slateMuted);
  doc.text('PERFIL / TEMPERAMENTO COMPORTAMENTAL:', col1, currentY + 23.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...slateDark);
  const tempLines = doc.splitTextToSize(char.temperament || 'Neutro, aguarda orientações.', contentWidth - 8);
  doc.text(tempLines.slice(0, 2), col1, currentY + 27.5);

  if (hasObjectives) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...slateMuted);
    doc.text('OBJETIVOS DA SIMULAÇÃO:', col1, currentY + 33.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...slateDark);
    const objLines = doc.splitTextToSize(char.objectives, contentWidth - 8);
    doc.text(objLines.slice(0, 2), col1, currentY + 37.5);
  }

  currentY += cardBoxHeight + 6;

  // ============================================================================
  // C) CONTEXTO DO ATENDIMENTO & HISTÓRICO
  // ============================================================================
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...primaryEmerald);
  doc.text('2. CONTEXTO DO ATENDIMENTO & HISTÓRICO', leftMargin, currentY);

  currentY += 3.5;

  const contextText = char.serviceContext?.trim() || 'Sem contexto adicional informado para este atendimento.';
  const contextLines = doc.splitTextToSize(contextText, contentWidth - 8);
  const contextBoxHeight = Math.max(contextLines.length * 4.2 + 7, 18);

  doc.setFillColor(...bgLight);
  doc.setDrawColor(...slateBorder);
  doc.setLineWidth(0.25);
  doc.roundedRect(leftMargin, currentY, contentWidth, contextBoxHeight, 2, 2, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...slateDark);
  doc.text(contextLines, leftMargin + 4, currentY + 5.5);

  currentY += contextBoxHeight + 6;

  // ============================================================================
  // D) ROTEIRO DE SIMULAÇÃO (FALAS & OBJEÇÕES TÍPICAS)
  // ============================================================================
  const rawPhrases = Array.isArray(char.typicalPhrases)
    ? char.typicalPhrases
    : char.typicalPhrases
    ? [char.typicalPhrases]
    : [];

  if (rawPhrases.length > 0 && currentY < 235) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...primaryEmerald);
    doc.text('3. ROTEIRO DE SIMULAÇÃO (FALAS & OBJEÇÕES TÍPICAS)', leftMargin, currentY);

    currentY += 3.5;

    let totalLinesCount = 0;
    const formattedPhrases = rawPhrases.map((phrase, idx) => {
      const pLines = doc.splitTextToSize(`"${phrase}"`, contentWidth - 25);
      totalLinesCount += pLines.length;
      return { idx: idx + 1, lines: pLines };
    });

    const maxPhrasesHeight = 270 - currentY;
    const phraseBoxHeight = Math.min(totalLinesCount * 5 + formattedPhrases.length * 2.5 + 6, maxPhrasesHeight);

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...slateBorder);
    doc.setLineWidth(0.25);
    doc.roundedRect(leftMargin, currentY, contentWidth, phraseBoxHeight, 2, 2, 'FD');

    let phY = currentY + 5;
    for (const item of formattedPhrases) {
      if (phY > currentY + phraseBoxHeight - 6) break;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(...mediumEmerald);
      doc.text(`[Fala ${item.idx}]`, leftMargin + 4, phY);

      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.2);
      doc.setTextColor(...slateDark);
      doc.text(item.lines, leftMargin + 18, phY);
      phY += item.lines.length * 4.2 + 3.2;
    }

    currentY += phraseBoxHeight + 6;
  }

}

/**
 * Gera e dispara o download do PDF estilizado da Ficha do Cliente / Roteiro individual
 */
export function downloadGuidePdf(
  char: Character,
  exerciseTitle?: string,
  generatedBy?: PdfGeneratedBy
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  renderCharacterSheetOnDoc(doc, char, exerciseTitle, 1, 1);
  applyPdfTraceabilityFooter(doc, generatedBy);
  const safeName = char.name.replace(/[^a-zA-Z0-9_\u00C0-\u017F]+/g, '_');
  doc.save(`Cliente_${safeName}.pdf`);
}

/**
 * Gera e dispara o download de múltiplos roteiros/clientes consolidados em um ÚNICO PDF
 */
export function downloadMultipleGuidesPdf(
  characters: Character[],
  exerciseTitle?: string,
  batchTitle?: string,
  generatedBy?: PdfGeneratedBy
): void {
  if (!characters || characters.length === 0) return;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const total = characters.length;

  characters.forEach((char, index) => {
    if (index > 0) {
      doc.addPage();
    }
    renderCharacterSheetOnDoc(doc, char, exerciseTitle, index + 1, total);
  });

  applyPdfTraceabilityFooter(doc, generatedBy);
  const baseTitle = batchTitle || (exerciseTitle ? `Roteiros_${exerciseTitle}` : 'Roteiros_Consolidados');
  const safeTitle = baseTitle.replace(/[^a-zA-Z0-9_\u00C0-\u017F]+/g, '_');
  doc.save(`${safeTitle}.pdf`);
}

/**
 * Dispara o download de um Checklist estilizado em formato PDF
 */
export function downloadChecklistPdf(
  checklist: Checklist,
  exercises: Exercise[] = [],
  characters: Character[] = [],
  generatedBy?: PdfGeneratedBy
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const cellName = getCellName(checklist.cell);

  const primaryEmerald = [6, 78, 59] as const;
  const mediumEmerald = [4, 120, 87] as const;
  const slateDark = [15, 23, 42] as const;
  const slateMuted = [100, 116, 139] as const;
  const slateBorder = [203, 213, 225] as const;
  const bgLight = [248, 250, 252] as const;
  const white = [255, 255, 255] as const;

  const leftMargin = 14;
  const contentWidth = 182;
  let currentY = 10;

  // Cabeçalho Institucional
  doc.setFillColor(...primaryEmerald);
  doc.roundedRect(leftMargin, currentY, contentWidth, 24, 2, 2, 'F');

  doc.setFillColor(...mediumEmerald);
  doc.roundedRect(125, currentY + 3, 67, 5.5, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...white);
  doc.text('CHECKLIST OFICIAL DE AVALIAÇÃO', 158, currentY + 7, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...white);
  doc.text('PORTAL DE DESEMPENHO — INSTRUMENTO DE AVALIAÇÃO', leftMargin + 5, currentY + 9);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(209, 250, 229);
  doc.text(`Célula: ${cellName}   ·   Categoria: ${checklist.categoryName || 'Geral'}   ·   Status: ${checklist.isActive ? 'Ativo' : 'Inativo'}`, leftMargin + 5, currentY + 15.5);
  doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`, leftMargin + 5, currentY + 20);

  currentY += 28;

  // Detalhes do Checklist
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...primaryEmerald);
  doc.text('1. IDENTIFICAÇÃO DO CHECKLIST', leftMargin, currentY);

  currentY += 3.5;
  doc.setFillColor(...bgLight);
  doc.setDrawColor(...slateBorder);
  doc.roundedRect(leftMargin, currentY, contentWidth, 18, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...slateDark);
  doc.text(checklist.title, leftMargin + 4, currentY + 5.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...slateMuted);
  const descLines = doc.splitTextToSize(checklist.description || 'Critérios padronizados de qualidade operacional.', contentWidth - 8);
  doc.text(descLines.slice(0, 2), leftMargin + 4, currentY + 11);

  currentY += 22;

  // Critérios de Avaliação
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...primaryEmerald);
  doc.text(`2. CRITÉRIOS DE AVALIAÇÃO (${checklist.criteria.length} itens)`, leftMargin, currentY);

  currentY += 3.5;
  doc.setFillColor(...primaryEmerald);
  doc.rect(leftMargin, currentY, contentWidth, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...white);
  doc.text('#', leftMargin + 3, currentY + 4.2);
  doc.text('DESCRIÇÃO DO CRITÉRIO', leftMargin + 14, currentY + 4.2);
  doc.text('PESO', leftMargin + 155, currentY + 4.2);
  doc.text('CONFORMIDADE', leftMargin + 168, currentY + 4.2);

  currentY += 6;

  checklist.criteria.forEach((crit, idx) => {
    if (currentY > 268) {
      doc.addPage();
      currentY = 14;
    }
    const isEven = idx % 2 === 0;
    doc.setFillColor(isEven ? 255 : 248, isEven ? 255 : 250, isEven ? 255 : 252);
    doc.rect(leftMargin, currentY, contentWidth, 6.5, 'F');
    doc.setDrawColor(...slateBorder);
    doc.setLineWidth(0.15);
    doc.line(leftMargin, currentY + 6.5, leftMargin + contentWidth, currentY + 6.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...slateDark);
    doc.text(String(idx + 1).padStart(2, '0'), leftMargin + 3, currentY + 4.5);

    doc.setFont('helvetica', 'normal');
    const critName = crit.name.length > 85 ? crit.name.slice(0, 82) + '...' : crit.name;
    doc.text(critName, leftMargin + 14, currentY + 4.5);

    doc.setFont('helvetica', 'bold');
    doc.text(`${crit.weight} pt${crit.weight > 1 ? 's' : ''}`, leftMargin + 155, currentY + 4.5);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...slateMuted);
    doc.text('[  ] C   [  ] NC', leftMargin + 168, currentY + 4.5);

    currentY += 6.5;
  });

  // Casos Vinculados
  const linkedExercises = exercises.filter((ex) => checklist.exerciseIds?.includes(ex.id));
  if (linkedExercises.length > 0 && currentY < 235) {
    currentY += 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...primaryEmerald);
    doc.text(`3. CASOS PRÁTICOS VINCULADOS (${linkedExercises.length})`, leftMargin, currentY);

    currentY += 3.5;
    linkedExercises.slice(0, 3).forEach((ex, idx) => {
      const exChars = characters.filter((c) => ex.characterIds?.includes(c.id));
      doc.setFillColor(...bgLight);
      doc.setDrawColor(...slateBorder);
      doc.roundedRect(leftMargin, currentY, contentWidth, 12, 1, 1, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...slateDark);
      doc.text(`[Caso ${idx + 1}] ${ex.title} (Dificuldade: ${ex.difficulty})`, leftMargin + 3, currentY + 4.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(...slateMuted);
      const charsText = exChars.length > 0 ? exChars.map((c) => `${c.name} (${c.cardNumber})`).join('; ') : 'Nenhum';
      doc.text(`Clientes associados: ${charsText.slice(0, 90)}`, leftMargin + 3, currentY + 9);

      currentY += 14;
    });
  }

  applyPdfTraceabilityFooter(doc, generatedBy);

  const safeTitle = checklist.title.replace(/[^a-zA-Z0-9_\u00C0-\u017F]+/g, '_');
  doc.save(`Checklist_${safeTitle}.pdf`);
}

/**
 * Dispara o download do relatório oficial de avaliação de um colaborador via PDF
 */
export function downloadReportPdf(reportData: {
  collaboratorName: string;
  department: string;
  cell: string;
  checklistTitle: string;
  checklistCategory: string;
  finalScore: number;
  evaluatedAt: string;
  evaluatorName: string;
  notes?: string;
  items: Array<{ name: string; weight: number; checked: boolean; notes?: string }>;
  generatedBy?: PdfGeneratedBy;
}): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const primaryEmerald = [6, 78, 59] as const;
  const mediumEmerald = [4, 120, 87] as const;
  const slateDark = [15, 23, 42] as const;
  const slateMuted = [100, 116, 139] as const;
  const slateBorder = [203, 213, 225] as const;
  const bgLight = [248, 250, 252] as const;
  const white = [255, 255, 255] as const;

  const leftMargin = 14;
  const contentWidth = 182;
  let currentY = 10;

  // Top Banner
  doc.setFillColor(...primaryEmerald);
  doc.roundedRect(leftMargin, currentY, contentWidth, 24, 2, 2, 'F');

  doc.setFillColor(...mediumEmerald);
  doc.roundedRect(122, currentY + 3, 70, 5.5, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...white);
  doc.text('RELATÓRIO CONSOLIDADO DE DESEMPENHO', 157, currentY + 7, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...white);
  doc.text('PORTAL DE DESEMPENHO — LAUDO DE AVALIAÇÃO INDIVIDUAL', leftMargin + 5, currentY + 9);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(209, 250, 229);
  doc.text(`Colaborador: ${reportData.collaboratorName}   ·   Célula: ${reportData.cell}   ·   Data: ${reportData.evaluatedAt}`, leftMargin + 5, currentY + 15.5);
  doc.text(`Avaliador Responsável: ${reportData.evaluatorName}   ·   Departamento: ${reportData.department}`, leftMargin + 5, currentY + 20);

  currentY += 28;

  // Quadro de Resumo & Nota Final
  doc.setFillColor(...bgLight);
  doc.setDrawColor(...slateBorder);
  doc.roundedRect(leftMargin, currentY, contentWidth, 22, 2, 2, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...slateMuted);
  doc.text('INSTRUMENTO DE AVALIAÇÃO:', leftMargin + 4, currentY + 5.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...slateDark);
  doc.text(reportData.checklistTitle, leftMargin + 4, currentY + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...slateMuted);
  doc.text(`Categoria: ${reportData.checklistCategory || 'Geral'}`, leftMargin + 4, currentY + 14.5);

  const rawScore = typeof reportData.finalScore === 'number' ? reportData.finalScore : 0;
  const verdict: {
    label: string;
    desc: string;
    fill: [number, number, number];
    color: [number, number, number];
  } =
    rawScore >= 7.0
      ? {
          label: 'APROVADO',
          desc: 'Apto para o fluxo operacional padrão.',
          fill: [236, 253, 245],
          color: [4, 120, 87],
        }
      : rawScore >= 5.0
      ? {
          label: 'VALIDAÇÃO DA LIDERANÇA',
          desc: 'Verificar a continuidade com a liderança do colaborador.',
          fill: [255, 251, 235],
          color: [180, 83, 9],
        }
      : {
          label: 'REPROVADO',
          desc: 'Abaixo do padrão mínimo exigido; necessária reciclagem e reavaliação.',
          fill: [254, 242, 242],
          color: [185, 28, 28],
        };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(...verdict.color);
  doc.text(verdict.desc, leftMargin + 4, currentY + 19);

  // Box Nota Final (escala 0 a 10)
  const scoreBoxX = leftMargin + 130;
  doc.setFillColor(...verdict.fill);
  doc.setDrawColor(...verdict.color);
  doc.roundedRect(scoreBoxX, currentY + 3, 48, 16, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(verdict.label.length > 16 ? 5.6 : 6.5);
  doc.setTextColor(...verdict.color);
  doc.text(verdict.label, scoreBoxX + 24, currentY + 7.5, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`${rawScore.toFixed(1)} / 10`, scoreBoxX + 24, currentY + 14, { align: 'center' });

  currentY += 26;

  // Parecer Técnico
  if (reportData.notes) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...primaryEmerald);
    doc.text('PARECER TÉCNICO E OBSERVAÇÕES DO AVALIADOR', leftMargin, currentY);

    currentY += 3.5;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...slateBorder);
    doc.roundedRect(leftMargin, currentY, contentWidth, 14, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(...slateDark);
    const noteLines = doc.splitTextToSize(reportData.notes, contentWidth - 8);
    doc.text(noteLines.slice(0, 2), leftMargin + 4, currentY + 5.5);

    currentY += 18;
  }

  // Tabela de Critérios
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...primaryEmerald);
  doc.text(`DETALHAMENTO DOS CRITÉRIOS AVALIADOS (${reportData.items.length} itens)`, leftMargin, currentY);

  currentY += 3.5;
  doc.setFillColor(...primaryEmerald);
  doc.rect(leftMargin, currentY, contentWidth, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...white);
  doc.text('#', leftMargin + 3, currentY + 4.2);
  doc.text('CRITÉRIO DE COMPETÊNCIA', leftMargin + 14, currentY + 4.2);
  doc.text('PESO', leftMargin + 145, currentY + 4.2);
  doc.text('STATUS', leftMargin + 162, currentY + 4.2);

  currentY += 6;

  reportData.items.forEach((item, idx) => {
    const trimmedNote = item.notes?.trim() || '';
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    const nameLines = doc.splitTextToSize(item.name, 126);
    const baseRowHeight = Math.max(6.5, nameLines.length * 3.4 + 2.8);

    let noteLines: string[] = [];
    let noteBoxHeight = 0;
    if (trimmedNote) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(6.4);
      noteLines = doc.splitTextToSize(`Observação do Avaliador: ${trimmedNote}`, contentWidth - 18);
      noteBoxHeight = Math.max(5.5, noteLines.length * 3.2 + 2.4);
    }

    const totalItemHeight = baseRowHeight + (trimmedNote ? noteBoxHeight + 1.2 : 0);
    if (currentY + totalItemHeight > 270) {
      doc.addPage();
      currentY = 14;
    }

    const isEven = idx % 2 === 0;
    doc.setFillColor(isEven ? 255 : 248, isEven ? 255 : 250, isEven ? 255 : 252);
    doc.rect(leftMargin, currentY, contentWidth, baseRowHeight, 'F');
    doc.setDrawColor(...slateBorder);
    doc.setLineWidth(0.15);
    doc.line(leftMargin, currentY + baseRowHeight, leftMargin + contentWidth, currentY + baseRowHeight);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...slateDark);
    doc.text(String(idx + 1).padStart(2, '0'), leftMargin + 3, currentY + 4.3);

    doc.setFont('helvetica', 'normal');
    doc.text(nameLines, leftMargin + 14, currentY + 4.3);

    doc.setFont('helvetica', 'bold');
    doc.text(`${item.weight} pt${item.weight > 1 ? 's' : ''}`, leftMargin + 145, currentY + 4.3);

    if (item.checked) {
      doc.setTextColor(4, 120, 87);
      doc.text('CONFORME', leftMargin + 162, currentY + 4.3);
    } else {
      doc.setTextColor(220, 38, 38);
      doc.text('NÃO CONFORME', leftMargin + 162, currentY + 4.3);
    }

    currentY += baseRowHeight;

    if (trimmedNote) {
      const noteFill: [number, number, number] = item.checked ? [240, 253, 244] : [255, 251, 235];
      const noteAccent: [number, number, number] = item.checked ? [6, 78, 59] : [180, 83, 9];
      doc.setFillColor(...noteFill);
      doc.setDrawColor(...slateBorder);
      doc.rect(leftMargin + 12, currentY + 0.5, contentWidth - 12, noteBoxHeight, 'FD');
      doc.setFillColor(...noteAccent);
      doc.rect(leftMargin + 12, currentY + 0.5, 1.3, noteBoxHeight, 'F');

      doc.setFont('helvetica', 'italic');
      doc.setFontSize(6.4);
      doc.setTextColor(51, 65, 85);
      doc.text(noteLines, leftMargin + 15.5, currentY + 4.0);
      currentY += noteBoxHeight + 1.2;
    }
  });

  applyPdfTraceabilityFooter(doc, reportData.generatedBy);

  const safeName = reportData.collaboratorName.replace(/[^a-zA-Z0-9_\u00C0-\u017F]+/g, '_');
  doc.save(`Relatorio_Avaliacao_${safeName}.pdf`);
}

/**
 * Funções de compatibilidade (substituindo .txt por .pdf)
 */
export function downloadGuideTxt(
  char: Character,
  exerciseTitle?: string,
  generatedBy?: PdfGeneratedBy
): void {
  downloadGuidePdf(char, exerciseTitle, generatedBy);
}

export function downloadChecklistTxt(
  checklist: Checklist,
  exercises: Exercise[] = [],
  characters: Character[] = [],
  generatedBy?: PdfGeneratedBy
): void {
  downloadChecklistPdf(checklist, exercises, characters, generatedBy);
}

export function downloadReportTxt(reportData: {
  collaboratorName: string;
  department: string;
  cell: string;
  checklistTitle: string;
  checklistCategory: string;
  finalScore: number;
  evaluatedAt: string;
  evaluatorName: string;
  notes?: string;
  items: Array<{ name: string; weight: number; checked: boolean; notes?: string }>;
  generatedBy?: PdfGeneratedBy;
}): void {
  downloadReportPdf(reportData);
}

export interface DossierEvaluationHistoryItem {
  checklistTitle: string;
  categoryName?: string;
  exerciseTitle?: string;
  characterName?: string;
  evaluatorName: string;
  finalScore: number;
  completedAt: string;
  observations?: string;
  isRestricted?: boolean;
  criteriaAnswers?: Array<{
    name: string;
    checked: boolean;
    weight: number;
    notes?: string;
  }>;
}

export interface DossierSurveySummaryItem {
  surveyTitle: string;
  completedAt: string;
  isRestricted?: boolean;
  questions: Array<{
    questionText: string;
    answer: string;
    notes?: string;
  }>;
}

export interface DossierTrackItem {
  orderIndex: number;
  title: string;
  type: 'checklist' | 'survey';
  status: 'concluido' | 'disponivel' | 'bloqueado' | 'em_andamento';
  stageName?: string;
  score?: number;
  completedAt?: string;
}

export interface DossierStageChapter {
  stageName: string;
  completedSteps: number;
  totalSteps: number;
  stageAverage: number | null;
  trackSteps: DossierTrackItem[];
  evaluations: DossierEvaluationHistoryItem[];
  surveys: DossierSurveySummaryItem[];
}

export interface StageDossierData {
  collaboratorName: string;
  corporateUsername?: string;
  roleTitle: string;
  registrationCode: string;
  cellTeam: string;
  stageName: string;
  completedSteps: number;
  totalSteps: number;
  stageAverage: number | null;
  trackSteps: DossierTrackItem[];
  evaluations: DossierEvaluationHistoryItem[];
  surveys: DossierSurveySummaryItem[];
  generatedBy?: PdfGeneratedBy;
  generatedAt: string;
}

export interface CollaboratorDossierData {
  collaboratorName: string;
  corporateUsername?: string;
  roleTitle: string;
  registrationCode: string;
  cellTeam: string;
  status: string;
  averageScore: number;
  completionRate?: number;
  totalTrackSteps?: number;
  totalEvaluations: number;
  totalSurveys: number;
  trackSteps: DossierTrackItem[];
  evaluationHistory: DossierEvaluationHistoryItem[];
  surveyResponsesSummary?: DossierSurveySummaryItem[];
  stages?: DossierStageChapter[];
  guardianFinalization?: {
    isFinalized: boolean;
    hideVerdict?: boolean;
    verdict?: 'aprovado' | 'necessita_reforco';
    opinion?: string;
    finalizedBy?: string;
    finalizedAt?: string;
  };
  isTrackFinalized?: boolean;
  isTrackComplete?: boolean;
  generatedBy?: PdfGeneratedBy;
  generatedAt: string;
}

/**
 * Helper interno para desenhar a tabela de etapas de uma lista ou capítulo
 */
function drawDossierTrackStepsTable(
  doc: jsPDF,
  steps: DossierTrackItem[],
  startY: number,
  leftMargin: number,
  contentWidth: number
): number {
  const slateDark = [15, 23, 42] as const;
  const slateMuted = [100, 116, 139] as const;
  const slateBorder = [203, 213, 225] as const;
  let currentY = startY;

  if (currentY > 258) {
    doc.addPage();
    currentY = 15;
  }

  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(...slateBorder);
  doc.roundedRect(leftMargin, currentY, contentWidth, 6, 1, 1, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...slateDark);
  doc.text('#', leftMargin + 3, currentY + 4);
  doc.text('ATIVIDADE / TÍTULO', leftMargin + 12, currentY + 4);
  doc.text('TIPO', leftMargin + 98, currentY + 4);
  doc.text('STATUS', leftMargin + 125, currentY + 4);
  doc.text('NOTA', leftMargin + 156, currentY + 4);

  currentY += 6.5;

  if (steps.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(...slateMuted);
    doc.text('Nenhuma atividade vinculada nesta etapa.', leftMargin + 4, currentY + 4);
    return currentY + 8;
  }

  steps.forEach((step, idx) => {
    if (currentY > 268) {
      doc.addPage();
      currentY = 15;
    }

    doc.setFillColor(idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 252, idx % 2 === 0 ? 255 : 254);
    doc.setDrawColor(241, 245, 249);
    doc.roundedRect(leftMargin, currentY, contentWidth, 6, 0.5, 0.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...slateDark);
    doc.text(String(step.orderIndex).padStart(2, '0'), leftMargin + 3, currentY + 4);

    doc.setFont('helvetica', 'normal');
    const titleShort = step.title.length > 54 ? step.title.slice(0, 51) + '...' : step.title;
    doc.text(titleShort, leftMargin + 12, currentY + 4);

    doc.text(step.type === 'survey' ? 'Pesquisa' : 'Checklist', leftMargin + 98, currentY + 4);

    const stLabel =
      step.status === 'concluido'
        ? 'Concluído'
        : step.status === 'em_andamento'
        ? 'Em Andamento'
        : step.status === 'disponivel'
        ? 'Disponível'
        : 'Bloqueado';
    if (step.status === 'concluido') {
      doc.setTextColor(4, 120, 87);
    } else if (step.status === 'em_andamento') {
      doc.setTextColor(217, 119, 6);
    } else {
      doc.setTextColor(...slateMuted);
    }
    doc.text(stLabel, leftMargin + 125, currentY + 4);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...slateDark);
    doc.text(step.score !== undefined ? `${step.score.toFixed(1)}/10` : '—', leftMargin + 156, currentY + 4);

    currentY += 6.5;
  });

  return currentY + 3;
}

/**
 * Helper interno para desenhar uma avaliação com critérios detalhados, pesos e apontamentos
 */
function drawDetailedEvaluationBlock(
  doc: jsPDF,
  evalItem: DossierEvaluationHistoryItem,
  idx: number,
  startY: number,
  leftMargin: number,
  contentWidth: number
): number {
  const slateDark = [15, 23, 42] as const;
  const slateMuted = [100, 116, 139] as const;
  const slateBorder = [203, 213, 225] as const;
  const bgLight = [248, 250, 252] as const;
  let currentY = startY;

  const cardTextMaxWidth = contentWidth - 42;
  const titleLabel = `${idx + 1}. ${evalItem.isRestricted ? '[RESTRITO] ' : ''}${evalItem.checklistTitle}`;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  const titleLines = doc.splitTextToSize(titleLabel, cardTextMaxWidth);

  const metaLine = `Data: ${evalItem.completedAt}   ·   Avaliador: ${evalItem.evaluatorName}`;
  const hasScenario = Boolean(evalItem.exerciseTitle || evalItem.characterName);
  const scenarioText = `Cenário: ${evalItem.exerciseTitle || 'Padrão'}   ·   Cliente: ${evalItem.characterName || 'N/A'}`;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  const scenarioLines = hasScenario ? doc.splitTextToSize(scenarioText, cardTextMaxWidth) : [];

  const obsContent = evalItem.observations?.trim() || 'Sem observações gerais registradas';
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.5);
  const obsLines = doc.splitTextToSize(`Observações Gerais: ${obsContent}`, cardTextMaxWidth);

  const textHeight =
    titleLines.length * 3.8 +
    4.2 +
    (scenarioLines.length > 0 ? scenarioLines.length * 3.6 + 1 : 0) +
    obsLines.length * 3.6 +
    6;
  const cardHeight = Math.max(24, textHeight);

  if (currentY + cardHeight > 272) {
    doc.addPage();
    currentY = 15;
  }

  doc.setFillColor(...bgLight);
  doc.setDrawColor(...slateBorder);
  doc.roundedRect(leftMargin, currentY, contentWidth, cardHeight, 1.5, 1.5, 'FD');

  let lineY = currentY + 5.2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...slateDark);
  doc.text(titleLines, leftMargin + 4, lineY);
  lineY += titleLines.length * 3.8 + 0.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...slateMuted);
  doc.text(metaLine, leftMargin + 4, lineY);
  lineY += 4.0;

  if (scenarioLines.length > 0) {
    doc.text(scenarioLines, leftMargin + 4, lineY);
    lineY += scenarioLines.length * 3.6 + 0.8;
  }

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.5);
  doc.setTextColor(51, 65, 85);
  doc.text(obsLines, leftMargin + 4, lineY);

  // Score Box (Semáforo Institucional)
  const scoreColors: {
    fill: [number, number, number];
    border: [number, number, number];
    text: [number, number, number];
  } =
    evalItem.finalScore >= 7.0
      ? { fill: [236, 253, 245], border: [4, 120, 87], text: [4, 120, 87] }
      : evalItem.finalScore >= 5.0
      ? { fill: [255, 251, 235], border: [180, 83, 9], text: [180, 83, 9] }
      : { fill: [254, 242, 242], border: [185, 28, 28], text: [185, 28, 28] };

  doc.setFillColor(scoreColors.fill[0], scoreColors.fill[1], scoreColors.fill[2]);
  doc.setDrawColor(scoreColors.border[0], scoreColors.border[1], scoreColors.border[2]);
  doc.roundedRect(leftMargin + contentWidth - 33, currentY + 4, 29, 14.5, 1, 1, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.8);
  doc.setTextColor(...slateMuted);
  doc.text('NOTA FINAL', leftMargin + contentWidth - 18.5, currentY + 8.2, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(scoreColors.text[0], scoreColors.text[1], scoreColors.text[2]);
  doc.text(`${evalItem.finalScore.toFixed(1)}/10`, leftMargin + contentWidth - 18.5, currentY + 14.5, { align: 'center' });

  currentY += cardHeight + 1.5;

  // Tabela detalhada de critérios avaliados (marcados/não marcados, pesos e observações individuais)
  if (evalItem.criteriaAnswers && evalItem.criteriaAnswers.length > 0) {
    if (currentY + 14 > 272) {
      doc.addPage();
      currentY = 15;
    }

    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(...slateBorder);
    doc.roundedRect(leftMargin + 2, currentY, contentWidth - 4, 5.4, 0.8, 0.8, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.9);
    doc.setTextColor(...slateDark);
    doc.text('CRITÉRIO AVALIADO', leftMargin + 4.5, currentY + 3.7);
    doc.text('PESO', leftMargin + 135, currentY + 3.7);
    doc.text('RESULTADO', leftMargin + 152, currentY + 3.7);
    currentY += 5.8;

    evalItem.criteriaAnswers.forEach((crit, cIdx) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.1);
      const critNameLines = doc.splitTextToSize(`${cIdx + 1}. ${crit.name}`, 126);
      const baseRowHeight = Math.max(5.8, critNameLines.length * 3.2 + 2.4);

      const trimmedNote = crit.notes?.trim() || '';
      let noteLines: string[] = [];
      let noteHeight = 0;

      if (trimmedNote) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.0);
        noteLines = doc.splitTextToSize(trimmedNote, contentWidth - 15);
        noteHeight = Math.max(6.8, noteLines.length * 3.1 + 4.4);
      }

      const blockTotalHeight = baseRowHeight + (trimmedNote ? noteHeight + 1.0 : 0);

      if (currentY + blockTotalHeight > 272) {
        doc.addPage();
        currentY = 15;
      }

      // Linha principal do critério
      doc.setFillColor(cIdx % 2 === 0 ? 255 : 250, cIdx % 2 === 0 ? 255 : 252, cIdx % 2 === 0 ? 255 : 254);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(leftMargin + 2, currentY, contentWidth - 4, baseRowHeight, 0.6, 0.6, 'FD');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.1);
      doc.setTextColor(...slateDark);
      doc.text(critNameLines, leftMargin + 4.5, currentY + 3.7);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.9);
      doc.setTextColor(...slateMuted);
      doc.text(`Peso ${crit.weight}`, leftMargin + 135, currentY + 3.7);

      if (crit.checked) {
        doc.setTextColor(4, 120, 87);
        doc.text('Atendido', leftMargin + 152, currentY + 3.7);
      } else {
        doc.setTextColor(185, 28, 28);
        doc.text('Não Atendido', leftMargin + 152, currentY + 3.7);
      }

      currentY += baseRowHeight;

      // Sub-bloco dedicado para Observação do Avaliador diretamente abaixo do critério
      if (trimmedNote) {
        const noteBg: [number, number, number] = crit.checked ? [240, 253, 244] : [255, 251, 235];
        const noteBorder: [number, number, number] = crit.checked ? [167, 243, 208] : [253, 230, 138];
        const noteAccent: [number, number, number] = crit.checked ? [6, 78, 59] : [180, 83, 9];

        doc.setFillColor(noteBg[0], noteBg[1], noteBg[2]);
        doc.setDrawColor(noteBorder[0], noteBorder[1], noteBorder[2]);
        doc.roundedRect(leftMargin + 5, currentY + 0.4, contentWidth - 7, noteHeight, 0.6, 0.6, 'FD');

        doc.setFillColor(noteAccent[0], noteAccent[1], noteAccent[2]);
        doc.rect(leftMargin + 5, currentY + 0.4, 1.3, noteHeight, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(5.6);
        doc.setTextColor(noteAccent[0], noteAccent[1], noteAccent[2]);
        doc.text('OBSERVAÇÃO DO AVALIADOR:', leftMargin + 8.5, currentY + 3.3);

        doc.setFont('helvetica', 'italic');
        doc.setFontSize(6.0);
        doc.setTextColor(30, 41, 59);
        doc.text(noteLines, leftMargin + 8.5, currentY + 6.4);

        currentY += noteHeight + 1.0;
      }

      currentY += 0.6;
    });
  }

  return currentY + 3;
}

/**
 * Helper interno para desenhar um bloco de Pesquisa de Satisfação
 */
function drawDetailedSurveyBlock(
  doc: jsPDF,
  surveyItem: DossierSurveySummaryItem,
  startY: number,
  leftMargin: number,
  contentWidth: number
): number {
  const slateDark = [15, 23, 42] as const;
  const slateMuted = [100, 116, 139] as const;
  const slateBorder = [203, 213, 225] as const;
  const bgLight = [248, 250, 252] as const;
  let currentY = startY;

  const surveyHeading = `${surveyItem.isRestricted ? '[RESTRITO] ' : ''}${surveyItem.surveyTitle}`;
  const innerWidth = contentWidth - 10;

  const preparedQuestions = surveyItem.questions.map((q, qIdx) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.2);
    const qLines = doc.splitTextToSize(`${qIdx + 1}. ${q.questionText}`, innerWidth);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    const ansString = `Resposta: ${q.answer}${q.notes ? `   ·   Justificativa / Obs.: "${q.notes}"` : ''}`;
    const aLines = doc.splitTextToSize(ansString, innerWidth - 2);
    return { qLines, aLines };
  });

  const questionsHeight = preparedQuestions.reduce(
    (acc, item) => acc + item.qLines.length * 3.3 + item.aLines.length * 3.2 + 2.2,
    0
  );
  const srvCardHeight = 14 + questionsHeight;

  if (currentY + srvCardHeight > 272) {
    doc.addPage();
    currentY = 15;
  }

  doc.setFillColor(...bgLight);
  doc.setDrawColor(...slateBorder);
  doc.roundedRect(leftMargin, currentY, contentWidth, srvCardHeight, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...slateDark);
  doc.text(surveyHeading, leftMargin + 4, currentY + 5.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...slateMuted);
  doc.text(`Data de Resposta: ${surveyItem.completedAt}`, leftMargin + 4, currentY + 9.5);

  let qY = currentY + 14;
  preparedQuestions.forEach((pq) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.2);
    doc.setTextColor(51, 65, 85);
    doc.text(pq.qLines, leftMargin + 4, qY);
    qY += pq.qLines.length * 3.3;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(4, 120, 87);
    doc.text(pq.aLines, leftMargin + 6, qY);
    qY += pq.aLines.length * 3.2 + 2.2;
  });

  return currentY + srvCardHeight + 3.5;
}

/**
 * Gera e exporta o Dossiê Individual de uma Etapa/Semana específica em PDF
 */
export function downloadStageDossierPdf(stageData: StageDossierData): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const primaryEmerald = [6, 78, 59] as const;
  const mediumEmerald = [5, 150, 105] as const;
  const slateDark = [15, 23, 42] as const;
  const slateMuted = [100, 116, 139] as const;
  const slateBorder = [203, 213, 225] as const;
  const bgLight = [248, 250, 252] as const;
  const white = [255, 255, 255] as const;

  const leftMargin = 14;
  const contentWidth = 182;
  let currentY = 12;

  // 1. Cabeçalho Institucional da Etapa
  doc.setFillColor(...primaryEmerald);
  doc.roundedRect(leftMargin, currentY, contentWidth, 24, 2, 2, 'F');

  doc.setFillColor(...mediumEmerald);
  doc.roundedRect(122, currentY + 3.5, 70, 5.5, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...white);
  doc.text('DOSSIÊ INDIVIDUAL POR ETAPA', 157, currentY + 7.5, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...white);
  doc.text(`ETAPA: ${stageData.stageName.toUpperCase()}`, leftMargin + 5, currentY + 9.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(209, 250, 229);
  doc.text('Relatório Detalhado de Checklists, Critérios, Apontamentos e Pesquisas da Etapa', leftMargin + 5, currentY + 15.5);
  doc.text(`Emissão: ${stageData.generatedAt}`, leftMargin + 5, currentY + 20);

  currentY += 28;

  // 2. Identificação do Colaborador
  doc.setFillColor(...bgLight);
  doc.setDrawColor(...slateBorder);
  doc.roundedRect(leftMargin, currentY, contentWidth, 18, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...slateDark);
  const collabHeader = stageData.corporateUsername
    ? `${stageData.collaboratorName} (${stageData.corporateUsername})`
    : stageData.collaboratorName;
  doc.text(collabHeader, leftMargin + 4, currentY + 6.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...slateMuted);
  doc.text(
    `Cargo: ${stageData.roleTitle}   ·   Matrícula: ${stageData.registrationCode || 'N/A'}   ·   Célula: ${stageData.cellTeam}`,
    leftMargin + 4,
    currentY + 12.5
  );

  currentY += 22;

  // 3. Indicadores da Etapa
  const stagePct =
    stageData.totalSteps > 0 ? Math.round((stageData.completedSteps / stageData.totalSteps) * 100) : 0;
  const metricBoxWidth = (contentWidth - 6) / 3;
  const stageMetrics = [
    {
      label: 'ETAPA / FASE',
      val: stageData.stageName,
      sub: `${stageData.completedSteps} de ${stageData.totalSteps} concluída(s)`,
    },
    {
      label: 'PROGRESSO DA ETAPA',
      val: `${stagePct}%`,
      sub: `${stageData.evaluations.length} avaliação(ões) · ${stageData.surveys.length} pesquisa(s)`,
    },
    {
      label: 'MÉDIA PARCIAL DA ETAPA',
      val: stageData.stageAverage !== null ? `${stageData.stageAverage.toFixed(1)} / 10` : 'Pendente',
      sub:
        stageData.stageAverage !== null
          ? `${Math.round(stageData.stageAverage * 10)}% de aproveitamento`
          : 'Sem notas lançadas',
    },
  ];

  stageMetrics.forEach((m, idx) => {
    const bx = leftMargin + idx * (metricBoxWidth + 3);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...slateBorder);
    doc.roundedRect(bx, currentY, metricBoxWidth, 16, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.2);
    doc.setTextColor(...slateMuted);
    doc.text(m.label, bx + 3, currentY + 4.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...primaryEmerald);
    const valShort = m.val.length > 22 ? m.val.slice(0, 19) + '...' : m.val;
    doc.text(valShort, bx + 3, currentY + 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(...slateMuted);
    doc.text(m.sub, bx + 3, currentY + 14);
  });

  currentY += 20;

  // 4. Atividades da Etapa
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...primaryEmerald);
  doc.text(`1. ATIVIDADES DA ETAPA — ${stageData.stageName.toUpperCase()}`, leftMargin, currentY + 3);
  currentY += 5.5;

  currentY = drawDossierTrackStepsTable(doc, stageData.trackSteps, currentY, leftMargin, contentWidth);
  currentY += 2;

  // 5. Detalhamento das Avaliações (Critérios, Pesos e Apontamentos)
  if (currentY > 245) {
    doc.addPage();
    currentY = 15;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...primaryEmerald);
  doc.text('2. DETALHAMENTO COMPLETO DAS AVALIAÇÕES & CRITÉRIOS', leftMargin, currentY + 3);
  currentY += 6;

  if (stageData.evaluations.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(...slateMuted);
    doc.text('Nenhuma avaliação concluída nesta etapa até o momento.', leftMargin + 4, currentY + 4);
    currentY += 10;
  } else {
    stageData.evaluations.forEach((evalItem, idx) => {
      currentY = drawDetailedEvaluationBlock(doc, evalItem, idx, currentY, leftMargin, contentWidth);
    });
  }

  // 6. Pesquisas de Satisfação da Etapa
  if (stageData.surveys.length > 0) {
    if (currentY > 235) {
      doc.addPage();
      currentY = 15;
    } else {
      currentY += 3;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...primaryEmerald);
    doc.text('3. PESQUISAS DE SATISFAÇÃO DA ETAPA', leftMargin, currentY + 3);
    currentY += 6;

    stageData.surveys.forEach((srvItem) => {
      currentY = drawDetailedSurveyBlock(doc, srvItem, currentY, leftMargin, contentWidth);
    });
  }

  applyPdfTraceabilityFooter(doc, stageData.generatedBy);

  const safeStageName = stageData.stageName.replace(/[^a-zA-Z0-9_\u00C0-\u017F]+/g, '_');
  const safeCollabName = stageData.collaboratorName.replace(/[^a-zA-Z0-9_\u00C0-\u017F]+/g, '_');
  doc.save(`Dossie_${safeStageName}_${safeCollabName}.pdf`);
}

/**
 * Gera e exporta o Dossiê Completo Consolidado do Colaborador em formato PDF institucional
 */
export function downloadCollaboratorDossierPdf(dossier: CollaboratorDossierData): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const primaryEmerald = [6, 78, 59] as const; // #064E3B corporativo
  const mediumEmerald = [5, 150, 105] as const; // #059669
  const slateDark = [15, 23, 42] as const;
  const slateMuted = [100, 116, 139] as const;
  const slateBorder = [203, 213, 225] as const;
  const bgLight = [248, 250, 252] as const;
  const white = [255, 255, 255] as const;

  const leftMargin = 14;
  const contentWidth = 182;
  let currentY = 12;

  const hasChapters = Boolean(dossier.stages && dossier.stages.length > 0);

  // 1. Cabeçalho Corporativo Institucional
  doc.setFillColor(...primaryEmerald);
  doc.roundedRect(leftMargin, currentY, contentWidth, 24, 2, 2, 'F');

  doc.setFillColor(...mediumEmerald);
  doc.roundedRect(118, currentY + 3.5, 74, 5.5, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...white);
  doc.text(
    hasChapters ? 'DOSSIÊ FINAL CONSOLIDADO' : 'DOSSIÊ OFICIAL DO COLABORADOR',
    155,
    currentY + 7.5,
    { align: 'center' }
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...white);
  doc.text('PORTAL DE DESEMPENHO CORPORATIVO', leftMargin + 5, currentY + 9.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(209, 250, 229);
  doc.text('Relatório Consolidado de Desenvolvimento, Capacitação e Auditoria de Desempenho', leftMargin + 5, currentY + 15.5);
  doc.text(`Data de Emissão: ${dossier.generatedAt}   ·   Documento Autenticado`, leftMargin + 5, currentY + 20);

  currentY += 28;

  // Alerta de Integridade / Finalização da Trilha no topo do documento
  const isFinalizedFlag = Boolean(dossier.isTrackFinalized);
  const isCompleteFlag = Boolean(dossier.isTrackComplete);
  if (!isFinalizedFlag || !isCompleteFlag) {
    const alertText = !isFinalizedFlag
      ? 'ATENÇÃO: TRILHA NÃO FINALIZADA (DOCUMENTO PARCIAL)'
      : 'TRILHA FINALIZADA COM ETAPAS PENDENTES';
    doc.setFillColor(254, 243, 199);
    doc.setDrawColor(217, 119, 6);
    doc.roundedRect(leftMargin, currentY, contentWidth, 8, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(146, 64, 14);
    doc.text(alertText, leftMargin + contentWidth / 2, currentY + 5.2, { align: 'center' });
    currentY += 11;
  }

  // 2. Ficha Cadastral do Colaborador
  doc.setFillColor(...bgLight);
  doc.setDrawColor(...slateBorder);
  doc.roundedRect(leftMargin, currentY, contentWidth, 22, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...slateDark);
  const collabHeader = dossier.corporateUsername
    ? `${dossier.collaboratorName} (${dossier.corporateUsername})`
    : dossier.collaboratorName;
  doc.text(collabHeader, leftMargin + 4, currentY + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...slateMuted);
  doc.text(`Cargo: ${dossier.roleTitle}   ·   Matrícula: ${dossier.registrationCode || 'N/A'}   ·   Célula: ${dossier.cellTeam}`, leftMargin + 4, currentY + 12);
  doc.text(`Status Oficial de Desempenho: ${dossier.status}`, leftMargin + 4, currentY + 17);

  const stLower = dossier.status.toLowerCase();
  const statusColor =
    stLower === 'finalizado'
      ? [100, 116, 139]
      : stLower.includes('aprovado') || stLower.includes('conclu')
      ? [16, 185, 129]
      : stLower.includes('validação') || stLower.includes('validacao') || stLower.includes('treinamento')
      ? [217, 119, 6]
      : [100, 116, 139];
  const statusBadgeW = dossier.status.length > 16 ? 48 : 38;
  const statusBadgeX = leftMargin + contentWidth - statusBadgeW - 4;
  doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
  doc.roundedRect(statusBadgeX, currentY + 4, statusBadgeW, 6, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(dossier.status.length > 16 ? 5.6 : 6.5);
  doc.setTextColor(...white);
  doc.text(dossier.status.toUpperCase(), statusBadgeX + statusBadgeW / 2, currentY + 8, { align: 'center' });

  currentY += 26;

  // 3. Resumo Executivo de Indicadores
  const metricBoxWidth = (contentWidth - 6) / 3;
  const metrics = [
    {
      label: '% CONCLUÍDO',
      val: `${dossier.completionRate ?? (dossier.trackSteps.length > 0 ? Math.round((dossier.trackSteps.filter((s) => s.status === 'concluido').length / dossier.trackSteps.length) * 100) : 0)}%`,
      sub: hasChapters ? `${dossier.stages!.length} etapa(s)/semana(s) registrada(s)` : 'Evolução na trilha',
    },
    {
      label: 'MÉDIA GERAL ACUMULADA',
      val: dossier.totalEvaluations > 0 ? `${dossier.averageScore.toFixed(1)} / 10` : 'Pendente',
      sub: dossier.totalEvaluations > 0 ? `${Math.round(dossier.averageScore * 10)}% de aproveitamento` : 'Sem avaliações concluídas',
    },
    {
      label: 'ATIVIDADES & AVALIAÇÕES',
      val: `${dossier.totalTrackSteps ?? dossier.trackSteps.length} atividade(s)`,
      sub: `${dossier.totalEvaluations} avaliação(ões) · ${dossier.totalSurveys} pesquisa(s)`,
    },
  ];

  metrics.forEach((m, idx) => {
    const bx = leftMargin + idx * (metricBoxWidth + 3);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...slateBorder);
    doc.roundedRect(bx, currentY, metricBoxWidth, 16, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.2);
    doc.setTextColor(...slateMuted);
    doc.text(m.label, bx + 3, currentY + 4.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...primaryEmerald);
    doc.text(m.val, bx + 3, currentY + 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(...slateMuted);
    doc.text(m.sub, bx + 3, currentY + 14);
  });

  currentY += 20;

  // Parecer Oficial do Guardião Anfitrião (exibido no Resumo Executivo quando finalizado e autorizado)
  const renderGuardianVerdictSection = (sectionLabel: string) => {
    if (!(dossier.guardianFinalization?.isFinalized && !dossier.guardianFinalization.hideVerdict)) {
      return;
    }

    const isApproved = dossier.guardianFinalization.verdict === 'aprovado';
    const opinionText = dossier.guardianFinalization.opinion?.trim() || 'Sem parecer descritivo registrado.';

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    const opinionLines = doc.splitTextToSize(opinionText, contentWidth - 10);
    const subtitleHeight = isApproved ? 0 : 5;
    const opinionCardHeight = Math.max(28, 22 + subtitleHeight + opinionLines.length * 3.8);

    if (currentY + opinionCardHeight + 10 > 272) {
      doc.addPage();
      currentY = 15;
    } else {
      currentY += 2;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...primaryEmerald);
    doc.text(sectionLabel, leftMargin, currentY + 3);
    currentY += 6;

    doc.setFillColor(isApproved ? 236 : 255, isApproved ? 253 : 251, isApproved ? 245 : 235);
    doc.setDrawColor(isApproved ? 4 : 180, isApproved ? 120 : 83, isApproved ? 87 : 9);
    doc.setLineWidth(0.4);
    doc.roundedRect(leftMargin, currentY, contentWidth, opinionCardHeight, 2, 2, 'FD');

    const verdictBadgeW = isApproved ? 34 : 52;
    doc.setFillColor(isApproved ? 4 : 180, isApproved ? 120 : 83, isApproved ? 87 : 9);
    doc.roundedRect(leftMargin + 4, currentY + 4, verdictBadgeW, 5.5, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.3);
    doc.setTextColor(...white);
    doc.text(
      isApproved ? 'APROVADO' : 'VALIDAÇÃO DA LIDERANÇA',
      leftMargin + 4 + verdictBadgeW / 2,
      currentY + 7.8,
      { align: 'center' }
    );

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...slateMuted);
    doc.text(
      `Finalizado por: ${dossier.guardianFinalization.finalizedBy || 'Guardião Anfitrião'}   ·   Em: ${dossier.guardianFinalization.finalizedAt || ''}`,
      leftMargin + 8 + verdictBadgeW,
      currentY + 7.8
    );

    let textStartY = currentY + 14.5;
    if (!isApproved) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.8);
      doc.setTextColor(180, 83, 9);
      doc.text(
        'Verificar a continuidade com a liderança do colaborador.',
        leftMargin + 4,
        currentY + 13.5
      );
      textStartY = currentY + 18.5;
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(...slateDark);
    doc.text(opinionLines, leftMargin + 4, textStartY);

    currentY += opinionCardHeight + 5;
  };

  if (hasChapters && dossier.stages) {
    renderGuardianVerdictSection('PARECER OFICIAL DA LIDERANÇA / GUARDIÃO ANFITRIÃO');

    // Sumário rápido das etapas / semanas
    if (currentY > 245) {
      doc.addPage();
      currentY = 15;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...primaryEmerald);
    doc.text('RESUMO POR ETAPAS / SEMANAS', leftMargin, currentY + 3);
    currentY += 6;

    dossier.stages.forEach((chapter, chIdx) => {
      if (currentY > 266) {
        doc.addPage();
        currentY = 15;
      }
      const chPct = chapter.totalSteps > 0 ? Math.round((chapter.completedSteps / chapter.totalSteps) * 100) : 0;
      doc.setFillColor(chIdx % 2 === 0 ? 255 : 248, chIdx % 2 === 0 ? 255 : 250, chIdx % 2 === 0 ? 255 : 252);
      doc.setDrawColor(...slateBorder);
      doc.roundedRect(leftMargin, currentY, contentWidth, 7, 1, 1, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...slateDark);
      doc.text(`Capítulo ${chIdx + 1}: ${chapter.stageName}`, leftMargin + 4, currentY + 4.7);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(...slateMuted);
      doc.text(
        `${chapter.completedSteps}/${chapter.totalSteps} atividade(s) (${chPct}%)`,
        leftMargin + 104,
        currentY + 4.7
      );

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...primaryEmerald);
      doc.text(
        chapter.stageAverage !== null ? `Média: ${chapter.stageAverage.toFixed(1)}/10` : 'Sem notas',
        leftMargin + contentWidth - 4,
        currentY + 4.7,
        { align: 'right' }
      );
      currentY += 8;
    });

    currentY += 4;

    // Capítulos sequenciais por Etapa/Semana com detalhes completos
    dossier.stages.forEach((chapter, chIdx) => {
      if (currentY > 230) {
        doc.addPage();
        currentY = 15;
      }

      // Faixa de Capítulo
      doc.setFillColor(...primaryEmerald);
      doc.roundedRect(leftMargin, currentY, contentWidth, 10, 1.5, 1.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...white);
      doc.text(
        `CAPÍTULO ${chIdx + 1} — ${chapter.stageName.toUpperCase()}`,
        leftMargin + 4,
        currentY + 6.4
      );
      doc.setFontSize(7);
      doc.setTextColor(209, 250, 229);
      doc.text(
        chapter.stageAverage !== null
          ? `${chapter.completedSteps}/${chapter.totalSteps} concluída(s) · Média da Etapa: ${chapter.stageAverage.toFixed(1)}/10`
          : `${chapter.completedSteps}/${chapter.totalSteps} concluída(s)`,
        leftMargin + contentWidth - 4,
        currentY + 6.4,
        { align: 'right' }
      );
      currentY += 12.5;

      currentY = drawDossierTrackStepsTable(doc, chapter.trackSteps, currentY, leftMargin, contentWidth);

      if (chapter.evaluations.length > 0) {
        if (currentY > 250) {
          doc.addPage();
          currentY = 15;
        }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(...primaryEmerald);
        doc.text(`Avaliações e Critérios — ${chapter.stageName}`, leftMargin, currentY + 2.5);
        currentY += 5;

        chapter.evaluations.forEach((evalItem, evalIdx) => {
          currentY = drawDetailedEvaluationBlock(doc, evalItem, evalIdx, currentY, leftMargin, contentWidth);
        });
      }

      if (chapter.surveys.length > 0) {
        if (currentY > 245) {
          doc.addPage();
          currentY = 15;
        }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(...primaryEmerald);
        doc.text(`Pesquisas de Satisfação — ${chapter.stageName}`, leftMargin, currentY + 2.5);
        currentY += 5;

        chapter.surveys.forEach((srvItem) => {
          currentY = drawDetailedSurveyBlock(doc, srvItem, currentY, leftMargin, contentWidth);
        });
      }

      currentY += 4;
    });
  } else {
    // Fallback legado sem capítulos
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...primaryEmerald);
    doc.text('1. TRILHA DE DESENVOLVIMENTO & LINHA DO TEMPO', leftMargin, currentY + 3);
    currentY += 5.5;

    currentY = drawDossierTrackStepsTable(doc, dossier.trackSteps, currentY, leftMargin, contentWidth);
    currentY += 2;

    if (currentY > 240) {
      doc.addPage();
      currentY = 15;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...primaryEmerald);
    doc.text('2. HISTÓRICO DE AVALIAÇÕES REALIZADAS', leftMargin, currentY + 3);
    currentY += 6;

    if (dossier.evaluationHistory.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7);
      doc.setTextColor(...slateMuted);
      doc.text('Nenhuma avaliação individual registrada para este colaborador até o momento.', leftMargin + 4, currentY + 4);
      currentY += 12;
    } else {
      dossier.evaluationHistory.forEach((evalItem, idx) => {
        currentY = drawDetailedEvaluationBlock(doc, evalItem, idx, currentY, leftMargin, contentWidth);
      });
    }

    const hasSurveys = Boolean(dossier.surveyResponsesSummary && dossier.surveyResponsesSummary.length > 0);
    if (hasSurveys && dossier.surveyResponsesSummary) {
      if (currentY > 235) {
        doc.addPage();
        currentY = 15;
      } else {
        currentY += 4;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...primaryEmerald);
      doc.text('3. PESQUISAS DE SATISFAÇÃO & RESPOSTAS DO ALUNO', leftMargin, currentY + 3);
      currentY += 6;

      dossier.surveyResponsesSummary.forEach((surveyItem) => {
        currentY = drawDetailedSurveyBlock(doc, surveyItem, currentY, leftMargin, contentWidth);
      });
    }

    const opinionSectionNum = hasSurveys ? 4 : 3;
    renderGuardianVerdictSection(`${opinionSectionNum}. PARECER OFICIAL DO GUARDIÃO ANFITRIÃO`);
  }

  applyPdfTraceabilityFooter(doc, dossier.generatedBy);

  const safeCollabName = dossier.collaboratorName.replace(/[^a-zA-Z0-9_\u00C0-\u017F]+/g, '_');
  doc.save(`Dossie_Completo_${safeCollabName}.pdf`);
}

