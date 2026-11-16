import { jsPDF } from 'jspdf';
import { Character, Checklist, Exercise, getCellName } from '../types/portal';

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
  pageNumber: number = 1,
  totalPages: number = 1
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

  // ============================================================================
  // E) RODAPÉ LIMPO E INSTITUCIONAL
  // ============================================================================
  const footerY = 282;
  doc.setDrawColor(...slateBorder);
  doc.setLineWidth(0.3);
  doc.line(leftMargin, footerY, leftMargin + contentWidth, footerY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...slateMuted);
  const exRef = exerciseTitle ? `Exercício: ${exerciseTitle.slice(0, 45)}` : 'Perfil Cadastral do Cliente';
  doc.text(`Portal de Desempenho Operacional   ·   ${exRef}`, leftMargin, footerY + 5);

  doc.setFont('helvetica', 'bold');
  doc.text(`Página ${pageNumber} de ${totalPages}`, leftMargin + contentWidth - 24, footerY + 5);
}

/**
 * Gera e dispara o download do PDF estilizado da Ficha do Cliente / Roteiro individual
 */
export function downloadGuidePdf(char: Character, exerciseTitle?: string): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  renderCharacterSheetOnDoc(doc, char, exerciseTitle, 1, 1);
  const safeName = char.name.replace(/[^a-zA-Z0-9_\u00C0-\u017F]+/g, '_');
  doc.save(`Cliente_${safeName}.pdf`);
}

/**
 * Gera e dispara o download de múltiplos roteiros/clientes consolidados em um ÚNICO PDF
 */
export function downloadMultipleGuidesPdf(
  characters: Character[],
  exerciseTitle?: string,
  batchTitle?: string
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
  characters: Character[] = []
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

  // Rodapé
  const footerY = 282;
  doc.setDrawColor(...slateBorder);
  doc.setLineWidth(0.3);
  doc.line(leftMargin, footerY, leftMargin + contentWidth, footerY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...slateMuted);
  doc.text('Portal de Desempenho e Capacitação Operacional   ·   Instrumento de Auditoria e Qualidade', leftMargin, footerY + 4);
  doc.text('Documento oficial para monitoramento e feedback continuado.', leftMargin, footerY + 7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Página 1 de 1', leftMargin + contentWidth - 16, footerY + 4);

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
  items: Array<{ name: string; weight: number; checked: boolean }>;
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
  doc.text(`Categoria: ${reportData.checklistCategory || 'Geral'}`, leftMargin + 4, currentY + 15.5);

  // Box Nota Final
  const scoreBoxX = leftMargin + 130;
  const isApproved = reportData.finalScore >= 70;
  doc.setFillColor(isApproved ? 236 : 254, isApproved ? 253 : 242, isApproved ? 245 : 242);
  doc.setDrawColor(isApproved ? 4 : 220, isApproved ? 120 : 38, isApproved ? 87 : 38);
  doc.roundedRect(scoreBoxX, currentY + 3, 48, 16, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(isApproved ? 4 : 220, isApproved ? 120 : 38, isApproved ? 87 : 38);
  doc.text(isApproved ? 'APROVADO / CONFORME' : 'ATENÇÃO / RECICLAGEM', scoreBoxX + 24, currentY + 7.5, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`${reportData.finalScore.toFixed(1)}%`, scoreBoxX + 24, currentY + 14, { align: 'center' });

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
    const nameShort = item.name.length > 80 ? item.name.slice(0, 77) + '...' : item.name;
    doc.text(nameShort, leftMargin + 14, currentY + 4.5);

    doc.setFont('helvetica', 'bold');
    doc.text(`${item.weight} pt${item.weight > 1 ? 's' : ''}`, leftMargin + 145, currentY + 4.5);

    if (item.checked) {
      doc.setTextColor(4, 120, 87);
      doc.text('CONFORME', leftMargin + 162, currentY + 4.5);
    } else {
      doc.setTextColor(220, 38, 38);
      doc.text('NÃO CONFORME', leftMargin + 162, currentY + 4.5);
    }

    currentY += 6.5;
  });

  // Rodapé
  const footerY = 282;
  doc.setDrawColor(...slateBorder);
  doc.setLineWidth(0.3);
  doc.line(leftMargin, footerY, leftMargin + contentWidth, footerY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...slateMuted);
  doc.text('Portal de Desempenho Operacional   ·   Relatório Formal de Avaliação de Competências', leftMargin, footerY + 4);
  doc.text('Documento oficial registrado no histórico de capacitação profissional do colaborador.', leftMargin, footerY + 7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Página 1 de 1', leftMargin + contentWidth - 16, footerY + 4);

  const safeName = reportData.collaboratorName.replace(/[^a-zA-Z0-9_\u00C0-\u017F]+/g, '_');
  doc.save(`Relatorio_Avaliacao_${safeName}.pdf`);
}

/**
 * Funções de compatibilidade (substituindo .txt por .pdf)
 */
export function downloadGuideTxt(char: Character, exerciseTitle?: string): void {
  downloadGuidePdf(char, exerciseTitle);
}

export function downloadChecklistTxt(
  checklist: Checklist,
  exercises: Exercise[] = [],
  characters: Character[] = []
): void {
  downloadChecklistPdf(checklist, exercises, characters);
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
  items: Array<{ name: string; weight: number; checked: boolean }>;
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
  score?: number;
  completedAt?: string;
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
  generatedAt: string;
}

/**
 * Gera e exporta o Dossiê Completo do Colaborador em formato PDF institucional
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

  // 1. Cabeçalho Corporativo Institucional
  doc.setFillColor(...primaryEmerald);
  doc.roundedRect(leftMargin, currentY, contentWidth, 24, 2, 2, 'F');

  doc.setFillColor(...mediumEmerald);
  doc.roundedRect(120, currentY + 3.5, 72, 5.5, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...white);
  doc.text('DOSSIÊ OFICIAL DO COLABORADOR', 156, currentY + 7.5, { align: 'center' });

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

  // Status Badge com cor semântica (#064E3B / amber / slate)
  const stLower = dossier.status.toLowerCase();
  const statusColor = stLower.includes('conclu')
    ? [16, 185, 129]
    : stLower.includes('treinamento')
    ? [217, 119, 6]
    : [100, 116, 139];
  doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
  doc.roundedRect(leftMargin + contentWidth - 42, currentY + 4, 38, 6, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...white);
  doc.text(dossier.status.toUpperCase(), leftMargin + contentWidth - 23, currentY + 8, { align: 'center' });

  currentY += 26;

  // 3. Resumo Executivo de Indicadores
  const metricBoxWidth = (contentWidth - 6) / 3;
  const metrics = [
    {
      label: '% CONCLUÍDO',
      val: `${dossier.completionRate ?? (dossier.trackSteps.length > 0 ? Math.round((dossier.trackSteps.filter((s) => s.status === 'concluido').length / dossier.trackSteps.length) * 100) : 0)}%`,
      sub: 'Evolução na trilha',
    },
    {
      label: 'MÉDIA GERAL DAS NOTAS',
      val: `${dossier.averageScore.toFixed(1)} / 10`,
      sub: `${Math.round(dossier.averageScore * 10)}% de aproveitamento`,
    },
    {
      label: 'TOTAL DE ETAPAS',
      val: `${dossier.totalTrackSteps ?? dossier.trackSteps.length}`,
      sub: `${dossier.totalEvaluations} avaliações realizadas`,
    },
  ];

  metrics.forEach((m, idx) => {
    const bx = leftMargin + idx * (metricBoxWidth + 3);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...slateBorder);
    doc.roundedRect(bx, currentY, metricBoxWidth, 16, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
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

  // 4. Trilha de Desenvolvimento (Lista ordenada de etapas)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...primaryEmerald);
  doc.text('1. TRILHA DE DESENVOLVIMENTO & LINHA DO TEMPO', leftMargin, currentY + 3);

  currentY += 5.5;

  // Cabeçalho da Tabela da Trilha
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(...slateBorder);
  doc.roundedRect(leftMargin, currentY, contentWidth, 6, 1, 1, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...slateDark);
  doc.text('#', leftMargin + 3, currentY + 4);
  doc.text('ETAPA / TÍTULO', leftMargin + 12, currentY + 4);
  doc.text('TIPO', leftMargin + 95, currentY + 4);
  doc.text('STATUS', leftMargin + 125, currentY + 4);
  doc.text('PONTUAÇÃO', leftMargin + 152, currentY + 4);

  currentY += 6.5;

  if (dossier.trackSteps.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(...slateMuted);
    doc.text('Nenhuma etapa cadastrada na trilha do colaborador.', leftMargin + 4, currentY + 4);
    currentY += 8;
  } else {
    dossier.trackSteps.forEach((step, idx) => {
      if (currentY > 265) {
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
      const titleShort = step.title.length > 55 ? step.title.slice(0, 52) + '...' : step.title;
      doc.text(titleShort, leftMargin + 12, currentY + 4);

      doc.text(step.type === 'survey' ? 'Pesquisa' : 'Checklist', leftMargin + 95, currentY + 4);

      const stLabel = step.status === 'concluido' ? 'Concluído' : step.status === 'em_andamento' ? 'Em Andamento' : step.status === 'disponivel' ? 'Disponível' : 'Bloqueado';
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
      doc.text(step.score !== undefined ? `${step.score.toFixed(1)}/10` : '—', leftMargin + 155, currentY + 4);

      currentY += 6.5;
    });
  }

  currentY += 4;

  // 5. Histórico Detalhado de Avaliações
  if (currentY > 235) {
    doc.addPage();
    currentY = 15;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...primaryEmerald);
  doc.text('2. HISTÓRICO DETALHADO DE AVALIAÇÕES REALIZADAS', leftMargin, currentY + 3);

  currentY += 6;

  if (dossier.evaluationHistory.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(...slateMuted);
    doc.text('Nenhuma avaliação individual registrada para este colaborador até o momento.', leftMargin + 4, currentY + 4);
    currentY += 12;
  } else {
    dossier.evaluationHistory.forEach((evalItem, idx) => {
      const hasCriteria = Boolean(evalItem.criteriaAnswers && evalItem.criteriaAnswers.length > 0);
      const criteriaList = (evalItem.criteriaAnswers || []).slice(0, 8);
      const extraHeight = hasCriteria ? criteriaList.length * 4.5 + 5 : 0;
      const cardHeight = 24 + extraHeight;

      if (currentY + cardHeight > 275) {
        doc.addPage();
        currentY = 15;
      }

      doc.setFillColor(...bgLight);
      doc.setDrawColor(...slateBorder);
      doc.roundedRect(leftMargin, currentY, contentWidth, cardHeight, 1.5, 1.5, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...slateDark);
      doc.text(`${idx + 1}. ${evalItem.checklistTitle}`, leftMargin + 4, currentY + 5.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(...slateMuted);
      doc.text(`Data: ${evalItem.completedAt}   ·   Avaliador: ${evalItem.evaluatorName}`, leftMargin + 4, currentY + 9.5);

      if (evalItem.exerciseTitle || evalItem.characterName) {
        doc.text(`Cenário: ${evalItem.exerciseTitle || 'Padrão'}   ·   Cliente Atendido: ${evalItem.characterName || 'N/A'}`, leftMargin + 4, currentY + 13.5);
      }

      if (evalItem.observations) {
        const obsShort = evalItem.observations.length > 115 ? evalItem.observations.slice(0, 112) + '...' : evalItem.observations;
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(51, 65, 85);
        doc.text(`Obs: "${obsShort}"`, leftMargin + 4, currentY + 18);
      }

      // Nota Box
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(...slateBorder);
      doc.roundedRect(leftMargin + contentWidth - 32, currentY + 4, 28, 14, 1, 1, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
      doc.setTextColor(...slateMuted);
      doc.text('NOTA FINAL', leftMargin + contentWidth - 18, currentY + 8, { align: 'center' });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(evalItem.finalScore >= 7 ? 4 : 220, evalItem.finalScore >= 7 ? 120 : 38, evalItem.finalScore >= 7 ? 87 : 38);
      doc.text(`${evalItem.finalScore.toFixed(1)}/10`, leftMargin + contentWidth - 18, currentY + 14, { align: 'center' });

      // Detalhamento de critérios avaliados
      if (hasCriteria) {
        let critY = currentY + (evalItem.observations ? 22 : 18);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6);
        doc.setTextColor(...slateDark);
        doc.text('CRITÉRIOS AVALIADOS:', leftMargin + 4, critY);
        critY += 3.5;

        criteriaList.forEach((c) => {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(5.8);
          if (c.checked) {
            doc.setTextColor(4, 120, 87);
            doc.text(`[CONFORME] ${c.name}${c.notes ? ` - "${c.notes}"` : ''}`, leftMargin + 6, critY);
          } else {
            doc.setTextColor(185, 28, 28);
            doc.text(`[NÃO CONFORME] ${c.name}${c.notes ? ` - "${c.notes}"` : ''}`, leftMargin + 6, critY);
          }
          critY += 4;
        });
      }

      currentY += cardHeight + 3.5;
    });
  }

  // 3. Resumo das Pesquisas de Satisfação & Feedback do Aluno
  if (dossier.surveyResponsesSummary && dossier.surveyResponsesSummary.length > 0) {
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
      const qCount = surveyItem.questions.length;
      const srvCardHeight = 12 + qCount * 8;

      if (currentY + srvCardHeight > 275) {
        doc.addPage();
        currentY = 15;
      }

      doc.setFillColor(...bgLight);
      doc.setDrawColor(...slateBorder);
      doc.roundedRect(leftMargin, currentY, contentWidth, srvCardHeight, 1.5, 1.5, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...slateDark);
      doc.text(surveyItem.surveyTitle, leftMargin + 4, currentY + 5.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(...slateMuted);
      doc.text(`Data de Resposta: ${surveyItem.completedAt}`, leftMargin + 4, currentY + 9.5);

      let qY = currentY + 14;
      surveyItem.questions.forEach((q, qIdx) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.2);
        doc.setTextColor(51, 65, 85);
        doc.text(`${qIdx + 1}. ${q.questionText}`, leftMargin + 4, qY);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6);
        doc.setTextColor(4, 120, 87);
        doc.text(`Resposta: ${q.answer}${q.notes ? `   ·   Justificativa: "${q.notes}"` : ''}`, leftMargin + 6, qY + 3.5);

        qY += 8;
      });

      currentY += srvCardHeight + 4;
    });
  }

  // Rodapé institucional
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const footerY = 284;
    doc.setDrawColor(...slateBorder);
    doc.setLineWidth(0.3);
    doc.line(leftMargin, footerY, leftMargin + contentWidth, footerY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(...slateMuted);
    doc.text('Portal de Desempenho Operacional   ·   Dossiê Confidencial de Capacitação Profissional', leftMargin, footerY + 4);
    doc.setFont('helvetica', 'bold');
    doc.text(`Página ${i} de ${pageCount}`, leftMargin + contentWidth - 18, footerY + 4);
  }

  const safeCollabName = dossier.collaboratorName.replace(/[^a-zA-Z0-9_\u00C0-\u017F]+/g, '_');
  doc.save(`Dossie_${safeCollabName}.pdf`);
}

