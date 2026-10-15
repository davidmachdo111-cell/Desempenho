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

/**
 * Retorna orientações padronizadas de preparo e coleta para a guia
 */
export function getPreparationGuidelines(char: Character): string[] {
  const cell = char.cell;
  const guidelines: string[] = [];

  if (cell === 'LAB') {
    guidelines.push(
      'Requisitos de Jejum: Manter jejum metabólico de 8 a 12 horas para dosagens de glicemia e perfil lipídico. Não exceder 14 horas de jejum.'
    );
    guidelines.push(
      'Frascos & Amostras: Amostras biológicas (urina, fezes, escarro) devem ser colhidas em frascos estéreis fornecidos pela unidade. Para urina tipo 1 ou urocultura, coletar a primeira urina da manhã em jato médio.'
    );
    guidelines.push(
      'Prazos da ANS (RN 566/2022): Garantia de atendimento para exames laboratoriais básicos em até 03 dias úteis nos núcleos próprios ou rede referenciada.'
    );
    guidelines.push(
      'Orientações dos Núcleos: Comparecer munido de documento oficial com foto e requisição médica com CRM legível. Validade da guia: 30 a 90 dias a contar da emissão.'
    );
  } else if (cell === 'IMG') {
    guidelines.push(
      'Preparo de Imagem: Para exames contrastados ou ultrassonografia abdominal, seguir jejum absoluto de 6 a 8 horas e retenção urinária conforme indicação.'
    );
    guidelines.push(
      'Prazos da ANS (RN 566/2022): Exames complementares de imagem de alta complexidade (RM / TC) possuem garantia em até 10 dias úteis.'
    );
    guidelines.push(
      'Remoção de Adornos: Proibido o uso de joias, relógios ou piercings metálicos nas salas de exames radiológicos ou de ressonância magnética.'
    );
  } else {
    guidelines.push(
      'Identificação & Documentação: Apresentar carteira física ou digital no app oficial, acompanhada de documento oficial com foto válido em território nacional.'
    );
    guidelines.push(
      'Prazos da ANS (RN 566/2022 e RN 259): Consultas básicas garantidas em até 7 dias úteis e especialidades médicas em até 14 dias úteis.'
    );
    guidelines.push(
      'Orientações Operacionais: Acolhimento preferencial a idosos, gestantes, lactantes e pessoas com deficiência conforme Lei 10.048/2000.'
    );
  }

  return guidelines;
}

/**
 * Gera e dispara o download do PDF estilizado da Guia Médica / Ficha de Simulação
 */
export function downloadGuidePdf(char: Character, exerciseTitle?: string): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
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
  let currentY = 10;

  // ============================================================================
  // A) CABEÇALHO INSTITUCIONAL
  // ============================================================================
  // Faixa superior no verde corporativo (#064E3B)
  doc.setFillColor(...primaryEmerald);
  doc.roundedRect(leftMargin, currentY, contentWidth, 24, 2, 2, 'F');

  // Carimbo / Badge discreto no topo direito: "DOCUMENTO FICTÍCIO PARA TREINAMENTO"
  doc.setFillColor(...mediumEmerald);
  doc.roundedRect(122, currentY + 3, 70, 5.5, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...white);
  doc.text('DOCUMENTO FICTÍCIO PARA TREINAMENTO', 157, currentY + 7, { align: 'center' });

  // Título Institucional
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...white);
  doc.text('PORTAL DE DESEMPENHO — GUIA DE ATENDIMENTO E SIMULAÇÃO', leftMargin + 5, currentY + 9);

  // Subtítulo com número fictício do protocolo e data/hora da emissão
  const simulatedHash = Math.abs(
    char.id.split('').reduce((acc, c) => ((acc << 5) - acc + c.charCodeAt(0)) | 0, 0)
  ).toString().padStart(6, '0').slice(-6);
  const now = new Date();
  const protocolNumber = `TISS-SIM-${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}-${simulatedHash}`;
  const emissionDate = `${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(209, 250, 229); // #D1FAE5
  doc.text(`Protocolo: ${protocolNumber}   ·   Emissão: ${emissionDate}   ·   Célula: ${cellName}`, leftMargin + 5, currentY + 15.5);
  doc.text('Padrão TISS Digital Integrado — Simulação Prática de Atendimento ao Beneficiário', leftMargin + 5, currentY + 20);

  currentY += 28;

  // ============================================================================
  // B) DADOS DO BENEFICIÁRIO (QUADRO DESTACADO)
  // ============================================================================
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...primaryEmerald);
  doc.text('1. DADOS CADASTRAIS DO BENEFICIÁRIO', leftMargin, currentY);

  currentY += 3.5;

  // Quadro de destaque
  doc.setFillColor(...bgLight);
  doc.setDrawColor(...slateBorder);
  doc.setLineWidth(0.3);
  doc.roundedRect(leftMargin, currentY, contentWidth, 23, 2, 2, 'FD');

  // Linha 1 de dados
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
  doc.text(char.name, col1, currentY + 9);
  doc.text(char.cardNumber, col2, currentY + 9);
  doc.text(`${char.age} anos · ${char.gender}`, col3, currentY + 9);

  // Linha 2 de dados
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...slateMuted);
  doc.text('CIDADE / POLO:', col1, currentY + 14.5);
  doc.text('CÉLULA:', col2, currentY + 14.5);
  doc.text('CLASSIFICAÇÃO / TIER:', col3, currentY + 14.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...slateDark);
  doc.text(char.city, col1, currentY + 18.5);

  // Badge da Célula
  doc.setFillColor(...softEmerald);
  doc.setDrawColor(...mediumEmerald);
  doc.roundedRect(col2, currentY + 15.5, 30, 4.5, 1, 1, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...primaryEmerald);
  doc.text(cellName, col2 + 15, currentY + 18.8, { align: 'center' });

  // Badge da Classificação
  doc.setFillColor(254, 243, 199); // #FEF3C7
  doc.setDrawColor(217, 119, 6); // #D97706
  doc.roundedRect(col3, currentY + 15.5, 32, 4.5, 1, 1, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(146, 64, 14); // #92400E
  doc.text(char.customerTier || 'Intermediário', col3 + 16, currentY + 18.8, { align: 'center' });

  currentY += 28;

  // ============================================================================
  // C) DADOS CLÍNICOS E EXAMES SOLICITADOS (TABELA FORMATADA)
  // ============================================================================
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...primaryEmerald);
  doc.text('2. DADOS CLÍNICOS E EXAMES SOLICITADOS', leftMargin, currentY);

  const guideTitle = char.guideAttachmentName || 'Guia de Atendimento e Procedimentos TISS';
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...slateMuted);
  doc.text(`Documento Anexo: ${guideTitle}`, leftMargin + 80, currentY);

  currentY += 3.5;

  // Cabeçalho da Tabela
  doc.setFillColor(...primaryEmerald);
  doc.rect(leftMargin, currentY, contentWidth, 6, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...white);
  doc.text('ITEM', leftMargin + 3, currentY + 4.2);
  doc.text('EXAME / PROCEDIMENTO SOLICITADO', leftMargin + 16, currentY + 4.2);
  doc.text('CÓDIGO TUSS', leftMargin + 105, currentY + 4.2);
  doc.text('PRAZO ANS (RN 566)', leftMargin + 133, currentY + 4.2);
  doc.text('SITUAÇÃO', leftMargin + 163, currentY + 4.2);

  currentY += 6;

  // Linhas da Tabela
  const examItems = extractExamsFromCharacter(char);
  examItems.forEach((exam, idx) => {
    const isEven = idx % 2 === 0;
    doc.setFillColor(isEven ? 255 : 248, isEven ? 255 : 250, isEven ? 255 : 252);
    doc.rect(leftMargin, currentY, contentWidth, 6, 'F');
    doc.setDrawColor(...slateBorder);
    doc.setLineWidth(0.15);
    doc.line(leftMargin, currentY + 6, leftMargin + contentWidth, currentY + 6);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...slateDark);
    doc.text(exam.itemNumber, leftMargin + 4, currentY + 4.2);

    doc.setFont('helvetica', 'normal');
    const examNameShort = exam.name.length > 55 ? exam.name.slice(0, 52) + '...' : exam.name;
    doc.text(examNameShort, leftMargin + 16, currentY + 4.2);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...slateMuted);
    doc.text(exam.tussCode, leftMargin + 105, currentY + 4.2);
    doc.text(exam.deadlineAns, leftMargin + 133, currentY + 4.2);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(exam.status.includes('Liberado') ? 4 : 180, exam.status.includes('Liberado') ? 120 : 83, exam.status.includes('Liberado') ? 87 : 9);
    doc.text(exam.status, leftMargin + 163, currentY + 4.2);

    currentY += 6;
  });

  // Caixa de Indicação Clínica e Contexto do Pedido Médico
  currentY += 2;
  doc.setFillColor(...bgLight);
  doc.setDrawColor(...slateBorder);
  doc.setLineWidth(0.2);
  doc.roundedRect(leftMargin, currentY, contentWidth, 16, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...primaryEmerald);
  doc.text('INDICAÇÃO CLÍNICA & CONTEXTO DA SOLICITAÇÃO MÉDICA:', leftMargin + 3, currentY + 4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(...slateDark);
  const contextLines = doc.splitTextToSize(
    char.serviceContext || 'Solicitação médica ambulatorial de rotina para acompanhamento clínico preventivo.',
    contentWidth - 6
  );
  doc.text(contextLines.slice(0, 3), leftMargin + 3, currentY + 8);

  currentY += 20;

  // ============================================================================
  // D) ORIENTAÇÕES DE COLETA E PREPARO
  // ============================================================================
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...primaryEmerald);
  doc.text('3. ORIENTAÇÕES DE COLETA, PREPARO E REGRAS OPERACIONAIS', leftMargin, currentY);

  currentY += 3.5;

  const guidelines = getPreparationGuidelines(char);
  const prepBoxHeight = guidelines.length * 6.5 + 4;
  doc.setFillColor(...bgLight);
  doc.setDrawColor(...slateBorder);
  doc.setLineWidth(0.25);
  doc.roundedRect(leftMargin, currentY, contentWidth, prepBoxHeight, 1.5, 1.5, 'FD');

  let prepY = currentY + 4.5;
  guidelines.forEach((g) => {
    doc.setFillColor(...mediumEmerald);
    doc.circle(leftMargin + 4, prepY - 1, 0.9, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(...slateDark);
    const splitted = doc.splitTextToSize(g, contentWidth - 12);
    doc.text(splitted, leftMargin + 8, prepY);
    prepY += splitted.length > 1 ? 7.5 : 6;
  });

  currentY += prepBoxHeight + 4;

  // ============================================================================
  // FALAS E OBJEÇÕES DO PACIENTE NA SIMULAÇÃO
  // ============================================================================
  const rawPhrases = Array.isArray(char.typicalPhrases)
    ? char.typicalPhrases
    : char.typicalPhrases
    ? [char.typicalPhrases]
    : [];

  if (rawPhrases.length > 0 && currentY < 240) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...primaryEmerald);
    doc.text('4. ROTEIRO DE SIMULAÇÃO (FALAS & OBJEÇÕES TÍPICAS)', leftMargin, currentY);

    currentY += 3;
    const phraseBoxHeight = Math.min(rawPhrases.slice(0, 3).length * 6 + 3, 22);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...slateBorder);
    doc.roundedRect(leftMargin, currentY, contentWidth, phraseBoxHeight, 1.5, 1.5, 'FD');

    let phY = currentY + 4;
    rawPhrases.slice(0, 3).forEach((phrase, idx) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(...mediumEmerald);
      doc.text(`[Fala ${idx + 1}]`, leftMargin + 3, phY);

      doc.setFont('helvetica', 'italic');
      doc.setFontSize(6.8);
      doc.setTextColor(...slateDark);
      const pLines = doc.splitTextToSize(`"${phrase}"`, contentWidth - 25);
      doc.text(pLines[0] || '', leftMargin + 16, phY);
      phY += 5.5;
    });

    currentY += phraseBoxHeight + 5;
  }

  // ============================================================================
  // E) RODAPÉ OFICIAL
  // ============================================================================
  const footerY = 282;
  doc.setDrawColor(...slateBorder);
  doc.setLineWidth(0.3);
  doc.line(leftMargin, footerY, leftMargin + contentWidth, footerY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...slateMuted);
  const exRef = exerciseTitle ? `Exercício: ${exerciseTitle.slice(0, 45)}` : 'Simulação de Atendimento Clínico';
  doc.text(`Portal de Desempenho e Capacitação Operacional   ·   ${exRef}`, leftMargin, footerY + 4);
  doc.text('Aviso Legal: Documento gerado estritamente para capacitação, simulação e avaliação. RN ANS 566/2022.', leftMargin, footerY + 7.5);

  doc.setFont('helvetica', 'bold');
  doc.text('Página 1 de 1', leftMargin + contentWidth - 16, footerY + 4);

  // Nome padronizado do arquivo: Guia_{nome_cliente}.pdf
  const safeName = char.name.replace(/[^a-zA-Z0-9_\u00C0-\u017F]+/g, '_');
  doc.save(`Guia_${safeName}.pdf`);
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
  roleTitle: string;
  registrationCode: string;
  cellTeam: string;
  status: string;
  averageScore: number;
  totalEvaluations: number;
  totalSurveys: number;
  trackSteps: DossierTrackItem[];
  evaluationHistory: DossierEvaluationHistoryItem[];
  generatedAt: string;
}

/**
 * Gera e exporta o Dossiê Completo do Colaborador em formato PDF institucional
 */
export function downloadCollaboratorDossierPdf(dossier: CollaboratorDossierData): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const primaryEmerald = [15, 62, 46] as const; // #0f3e2e
  const mediumEmerald = [4, 120, 87] as const;
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
  doc.text(dossier.collaboratorName, leftMargin + 4, currentY + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...slateMuted);
  doc.text(`Cargo: ${dossier.roleTitle}   ·   Matrícula: ${dossier.registrationCode || 'N/A'}   ·   Célula: ${dossier.cellTeam}`, leftMargin + 4, currentY + 12);
  doc.text(`Status Oficial de Desempenho: ${dossier.status.toUpperCase()}`, leftMargin + 4, currentY + 17);

  // Status Badge
  const statusColor = dossier.status === 'aprovado' ? [16, 185, 129] : dossier.status === 'necessita_reforco' ? [239, 68, 68] : [59, 130, 246];
  doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
  doc.roundedRect(leftMargin + contentWidth - 36, currentY + 4, 32, 6, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...white);
  doc.text(dossier.status.replace('_', ' ').toUpperCase(), leftMargin + contentWidth - 20, currentY + 8, { align: 'center' });

  currentY += 26;

  // 3. Resumo Executivo de Métricas
  const metricBoxWidth = (contentWidth - 6) / 3;
  const metrics = [
    { label: 'MÉDIA GERAL DE NOTAS', val: `${dossier.averageScore.toFixed(1)} / 10`, sub: `${Math.round(dossier.averageScore * 10)}% de conformidade` },
    { label: 'AVALIAÇÕES CONCLUÍDAS', val: `${dossier.totalEvaluations}`, sub: 'Checklists aplicados' },
    { label: 'PESQUISAS DE SATISFAÇÃO', val: `${dossier.totalSurveys}`, sub: 'Respostas registradas' },
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
      if (currentY > 235) {
        doc.addPage();
        currentY = 15;
      }

      doc.setFillColor(...bgLight);
      doc.setDrawColor(...slateBorder);
      doc.roundedRect(leftMargin, currentY, contentWidth, 24, 1.5, 1.5, 'FD');

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

      currentY += 27;
    });
  }

  // 6. Espaço Formal de Assinaturas
  if (currentY > 240) {
    doc.addPage();
    currentY = 25;
  } else {
    currentY += 6;
  }

  const sigWidth = 75;
  const sig1X = leftMargin + 10;
  const sig2X = leftMargin + contentWidth - sigWidth - 10;

  doc.setDrawColor(...slateBorder);
  doc.setLineWidth(0.4);
  doc.line(sig1X, currentY + 14, sig1X + sigWidth, currentY + 14);
  doc.line(sig2X, currentY + 14, sig2X + sigWidth, currentY + 14);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...slateDark);
  doc.text('Avaliador / Coordenador Responsável', sig1X + sigWidth / 2, currentY + 18, { align: 'center' });
  doc.text('Colaborador Avaliado', sig2X + sigWidth / 2, currentY + 18, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(...slateMuted);
  doc.text('Assinatura e Carimbo', sig1X + sigWidth / 2, currentY + 21.5, { align: 'center' });
  doc.text(dossier.collaboratorName, sig2X + sigWidth / 2, currentY + 21.5, { align: 'center' });

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

