import { CustomerTier, Gender, OfficialCell } from '../types/portal';

export interface ParsedCharacterDraft {
  blockIndex: number;
  name: string;
  cell: OfficialCell;
  age: string;
  gender: Gender;
  city: string;
  cardNumber: string;
  customerTier: CustomerTier;
  serviceContext: string;
  temperament: string;
  objectives: string;
  typicalPhrases: string[];
  errors: string[];
}

export interface BatchParseResult {
  format: 'json' | 'text' | 'empty';
  items: ParsedCharacterDraft[];
  validItems: ParsedCharacterDraft[];
  invalidItems: ParsedCharacterDraft[];
  globalErrors: string[];
}

export const BATCH_CHARACTER_TEMPLATE = `NOME: Maria Helena Souza
CELULA: LAB
IDADE: 45 anos
SEXO: Feminino
CIDADE: Itajaí - SC
CARTEIRINHA: 0000.0000.00000-01
CLASSIFICACAO: Mediano
CONTEXTO: Compareceu solicitando o resultado de exame laboratorial com urgência para consulta no mesmo dia.
TEMPERAMENTO: Ansiosa, porém educada e colaborativa
OBJETIVO: Obter a liberação ou previsão exata do laudo antes da consulta médica
FALAS:
- Preciso muito desse resultado hoje, minha consulta é daqui a duas horas.
- Existe alguma forma de priorizar a liberação junto ao laboratório?
---
NOME: Carlos Eduardo Almeida
CELULA: OPERADORA
IDADE: 58 anos
SEXO: Masculino
CIDADE: Florianópolis - SC
CARTEIRINHA: 0000.0000.00000-02
CLASSIFICACAO: Crítico
CONTEXTO: Teve a guia de autorização negada por divergência cadastral e cobra solução imediata no atendimento.
TEMPERAMENTO: Impaciente e exigente com prazos
OBJETIVO: Regularizar a guia sem precisar reagendar o procedimento
FALAS:
- Já liguei três vezes e ninguém resolveu a minha autorização!
- Se não aprovarem hoje, vou registrar reclamação na ouvidoria.`;

function stripAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizeCellValue(raw: string): OfficialCell | null {
  const clean = stripAccents(raw.trim()).toUpperCase();
  if (!clean) return null;
  if (clean === 'LAB' || clean === 'LABORATORIO') return 'LAB';
  if (clean === 'IMG' || clean === 'IMAGEM') return 'IMG';
  if (clean === 'CONSULTA' || clean === 'CONSULTAS') return 'CONSULTA';
  if (clean === 'TERAPIA' || clean === 'TERAPIAS') return 'TERAPIA';
  if (clean === 'OPERADORA') return 'OPERADORA';
  return null;
}

function normalizeGenderValue(raw: string): Gender | null {
  const clean = stripAccents(raw.trim()).toLowerCase();
  if (!clean) return null;
  if (clean === 'masculino') return 'Masculino';
  if (clean === 'feminino') return 'Feminino';
  if (clean === 'outro') return 'Outro';
  return null;
}

function normalizeTierValue(raw: string): CustomerTier | null {
  const clean = stripAccents(raw.trim()).toLowerCase();
  if (!clean) return null;
  if (clean === 'iniciante') return 'Iniciante';
  if (clean === 'simples') return 'Simples';
  if (clean === 'mediano') return 'Mediano';
  if (clean === 'intermediario') return 'Intermediário';
  if (clean === 'critico') return 'Crítico';
  return null;
}

type CanonicalFieldKey =
  | 'name'
  | 'cell'
  | 'age'
  | 'gender'
  | 'city'
  | 'cardNumber'
  | 'customerTier'
  | 'serviceContext'
  | 'temperament'
  | 'objectives'
  | 'typicalPhrases';

const FIELD_KEY_MAP: Record<string, CanonicalFieldKey> = {
  NOME: 'name',
  NAME: 'name',
  CELULA: 'cell',
  CELL: 'cell',
  IDADE: 'age',
  AGE: 'age',
  SEXO: 'gender',
  GENDER: 'gender',
  CIDADE: 'city',
  CITY: 'city',
  CARTEIRINHA: 'cardNumber',
  CARDNUMBER: 'cardNumber',
  CARD_NUMBER: 'cardNumber',
  CLASSIFICACAO: 'customerTier',
  CUSTOMERTIER: 'customerTier',
  CUSTOMER_TIER: 'customerTier',
  CONTEXTO: 'serviceContext',
  SERVICECONTEXT: 'serviceContext',
  SERVICE_CONTEXT: 'serviceContext',
  TEMPERAMENTO: 'temperament',
  TEMPERAMENT: 'temperament',
  HUMOR: 'temperament',
  OBJETIVO: 'objectives',
  OBJETIVOS: 'objectives',
  OBJECTIVE: 'objectives',
  OBJECTIVES: 'objectives',
  FALAS: 'typicalPhrases',
  FALA: 'typicalPhrases',
  OBJECOES: 'typicalPhrases',
  TYPICALPHRASES: 'typicalPhrases',
  TYPICAL_PHRASES: 'typicalPhrases',
};

function resolveFieldKey(rawKey: string): CanonicalFieldKey | null {
  const normalized = stripAccents(rawKey.trim())
    .toUpperCase()
    .replace(/\s+/g, '_');
  return FIELD_KEY_MAP[normalized] || null;
}

function buildDraft(
  blockIndex: number,
  rawFields: {
    name: string;
    cell: string;
    age: string;
    gender: string;
    city: string;
    cardNumber: string;
    customerTier: string;
    serviceContext: string;
    temperament: string;
    objectives: string;
    typicalPhrases: string[];
  }
): ParsedCharacterDraft {
  const errors: string[] = [];

  const name = rawFields.name.trim();
  if (!name) {
    errors.push('Campo NOME é obrigatório.');
  }

  const parsedCell = normalizeCellValue(rawFields.cell);
  if (!rawFields.cell.trim()) {
    errors.push('Campo CELULA é obrigatório (LAB, IMG, CONSULTA, TERAPIA ou OPERADORA).');
  } else if (!parsedCell) {
    errors.push(
      `CELULA inválida ("${rawFields.cell.trim()}"). Valores aceitos: LAB, IMG, CONSULTA, TERAPIA ou OPERADORA.`
    );
  }

  const parsedGender = normalizeGenderValue(rawFields.gender);
  if (!rawFields.gender.trim()) {
    errors.push('Campo SEXO é obrigatório (Masculino, Feminino ou Outro).');
  } else if (!parsedGender) {
    errors.push(
      `SEXO inválido ("${rawFields.gender.trim()}"). Valores aceitos: Masculino, Feminino ou Outro.`
    );
  }

  const parsedTier = normalizeTierValue(rawFields.customerTier);
  if (!rawFields.customerTier.trim()) {
    errors.push(
      'Campo CLASSIFICACAO é obrigatório (Iniciante, Simples, Mediano, Intermediário ou Crítico).'
    );
  } else if (!parsedTier) {
    errors.push(
      `CLASSIFICACAO inválida ("${rawFields.customerTier.trim()}"). Valores aceitos: Iniciante, Simples, Mediano, Intermediário ou Crítico.`
    );
  }

  const serviceContext = rawFields.serviceContext.trim();
  if (!serviceContext) {
    errors.push('Campo CONTEXTO é obrigatório.');
  }

  return {
    blockIndex,
    name,
    cell: parsedCell || 'OPERADORA',
    age: rawFields.age.trim(),
    gender: parsedGender || 'Outro',
    city: rawFields.city.trim(),
    cardNumber: rawFields.cardNumber.trim(),
    customerTier: parsedTier || 'Mediano',
    serviceContext,
    temperament: rawFields.temperament.trim(),
    objectives: rawFields.objectives.trim(),
    typicalPhrases: rawFields.typicalPhrases.map((p) => p.trim()).filter((p) => p.length > 0),
    errors,
  };
}

function parseJsonBatch(trimmed: string): BatchParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro de sintaxe JSON.';
    return {
      format: 'json',
      items: [],
      validItems: [],
      invalidItems: [],
      globalErrors: [`JSON inválido: ${msg}`],
    };
  }

  const rows = Array.isArray(parsed) ? parsed : [parsed];
  if (rows.length === 0) {
    return {
      format: 'json',
      items: [],
      validItems: [],
      invalidItems: [],
      globalErrors: ['O array JSON está vazio.'],
    };
  }

  const items: ParsedCharacterDraft[] = [];
  const globalErrors: string[] = [];

  rows.forEach((row, idx) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      globalErrors.push(`Item #${idx + 1} do JSON não é um objeto válido.`);
      return;
    }

    const record = row as Record<string, unknown>;
    const getVal = (...keys: string[]): string => {
      for (const k of keys) {
        const foundKey = Object.keys(record).find(
          (rk) => stripAccents(rk).toLowerCase() === stripAccents(k).toLowerCase()
        );
        if (foundKey !== undefined && record[foundKey] !== undefined && record[foundKey] !== null) {
          return String(record[foundKey]);
        }
      }
      return '';
    };

    const getPhrases = (): string[] => {
      const candidateKeys = ['falas', 'fala', 'typicalPhrases', 'typical_phrases', 'objecoes'];
      for (const k of candidateKeys) {
        const foundKey = Object.keys(record).find(
          (rk) => stripAccents(rk).toLowerCase() === stripAccents(k).toLowerCase()
        );
        if (foundKey !== undefined) {
          const val = record[foundKey];
          if (Array.isArray(val)) {
            return val.map((item) => String(item ?? '').trim()).filter(Boolean);
          }
          if (typeof val === 'string') {
            return val
              .split('\n')
              .map((line) => line.replace(/^\s*[-*•]\s*/, '').trim())
              .filter(Boolean);
          }
        }
      }
      return [];
    };

    items.push(
      buildDraft(idx + 1, {
        name: getVal('nome', 'name'),
        cell: getVal('celula', 'cell'),
        age: getVal('idade', 'age'),
        gender: getVal('sexo', 'gender'),
        city: getVal('cidade', 'city'),
        cardNumber: getVal('carteirinha', 'cardNumber', 'card_number'),
        customerTier: getVal('classificacao', 'customerTier', 'customer_tier'),
        serviceContext: getVal('contexto', 'serviceContext', 'service_context'),
        temperament: getVal('temperamento', 'humor', 'temperament'),
        objectives: getVal('objetivo', 'objetivos', 'objectives', 'objective'),
        typicalPhrases: getPhrases(),
      })
    );
  });

  const validItems = items.filter((i) => i.errors.length === 0);
  const invalidItems = items.filter((i) => i.errors.length > 0);

  return {
    format: 'json',
    items,
    validItems,
    invalidItems,
    globalErrors,
  };
}

function parseTextBlock(blockText: string, blockIndex: number): ParsedCharacterDraft {
  const fields: {
    name: string;
    cell: string;
    age: string;
    gender: string;
    city: string;
    cardNumber: string;
    customerTier: string;
    serviceContext: string;
    temperament: string;
    objectives: string;
    typicalPhrases: string[];
  } = {
    name: '',
    cell: '',
    age: '',
    gender: '',
    city: '',
    cardNumber: '',
    customerTier: '',
    serviceContext: '',
    temperament: '',
    objectives: '',
    typicalPhrases: [],
  };

  let currentKey: CanonicalFieldKey | null = null;
  const lines = blockText.split('\n');

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    const keyMatch = trimmedLine.match(/^([A-Za-zÀ-ÿ0-9_ ]+?)\s*:\s*(.*)$/);
    if (keyMatch) {
      const candidateKey = resolveFieldKey(keyMatch[1]);
      if (candidateKey) {
        currentKey = candidateKey;
        const valuePart = keyMatch[2].trim();

        if (candidateKey === 'typicalPhrases') {
          if (valuePart) {
            const cleanedPhrase = valuePart.replace(/^\s*[-*•]\s*/, '').trim();
            if (cleanedPhrase) {
              fields.typicalPhrases.push(cleanedPhrase);
            }
          }
        } else {
          fields[candidateKey] = valuePart;
        }
        continue;
      }
    }

    // Linha de continuação do campo atual
    if (currentKey === 'typicalPhrases') {
      const cleanedPhrase = trimmedLine.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim();
      if (cleanedPhrase) {
        fields.typicalPhrases.push(cleanedPhrase);
      }
    } else if (currentKey) {
      fields[currentKey] = fields[currentKey]
        ? `${fields[currentKey]}\n${trimmedLine}`
        : trimmedLine;
    }
  }

  return buildDraft(blockIndex, fields);
}

/**
 * Parser determinístico (sem IA) que converte exatamente o texto estruturado
 * (blocos separados por `---`) ou array JSON em rascunhos de clientes validados.
 */
export function parseBatchCharactersInput(rawInput: string): BatchParseResult {
  const normalized = rawInput.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const trimmed = normalized.trim();

  if (!trimmed) {
    return {
      format: 'empty',
      items: [],
      validItems: [],
      invalidItems: [],
      globalErrors: [],
    };
  }

  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    return parseJsonBatch(trimmed);
  }

  const rawBlocks = normalized
    .split(/^\s*-{3,}\s*$/m)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

  if (rawBlocks.length === 0) {
    return {
      format: 'text',
      items: [],
      validItems: [],
      invalidItems: [],
      globalErrors: ['Nenhum bloco de cliente encontrado.'],
    };
  }

  const items = rawBlocks.map((blockText, idx) => parseTextBlock(blockText, idx + 1));
  const validItems = items.filter((i) => i.errors.length === 0);
  const invalidItems = items.filter((i) => i.errors.length > 0);

  return {
    format: 'text',
    items,
    validItems,
    invalidItems,
    globalErrors: [],
  };
}
