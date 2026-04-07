import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { ParsedStatementPdfRow, StatementPdfParseResult } from "./types";
import { createStatementTransaction } from "./utils";

const execFileAsync = promisify(execFile);

interface SlicedStatementLine {
  raw: string;
  date: string | null;
  operation: string;
  bookedFlag: string;
  category: string;
  amount: string;
}

interface MutableParsedRow {
  amountText: string;
  bookedFlag: string | null;
  categoryParts: string[];
  date: string;
  operationParts: string[];
}

function normalizeContoValue(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function isTableHeaderLine(line: string) {
  return (
    line.includes("OPERAZIONE")
    || line.includes("CONTABILIZZATO")
    || line.includes("IMPORTO")
    || line.trim() === "DATA"
    || line.trim() === "CONTABILE"
  );
}

function isPageNoise(line: string) {
  const trimmed = line.replace(/\f/g, "").trim();
  if (!trimmed) {
    return true;
  }

  return (
    trimmed === "Lista movimenti"
    || trimmed === "I movimenti selezionati sono:"
    || trimmed === "100"
    || trimmed.startsWith("N.B.:")
    || trimmed.startsWith("Conti e Carte:")
    || trimmed.startsWith("Entrate/Uscite:")
    || trimmed.startsWith("Tipo operazione:")
    || trimmed.startsWith("Importo minimo")
    || trimmed.startsWith("Importo massimo")
    || trimmed.startsWith("Data inizio periodo:")
    || trimmed.startsWith("Data fine periodo:")
    || trimmed.startsWith("Finanziamento:")
    || trimmed.startsWith("Investimenti e previdenza:")
  );
}

function sliceStatementLine(line: string): SlicedStatementLine {
  const normalizedLine = line.replace(/\f/g, "");
  const dateToken = normalizedLine.slice(0, 13).trim();
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(dateToken)) {
    const tokens = normalizedLine.trim().split(/\s{2,}/).filter(Boolean);
    const date = tokens.shift() ?? null;
    let amount = "";

    if (tokens.length > 0 && /€|[+-]?\d+[.,]\d{2}$/.test(tokens[tokens.length - 1])) {
      amount = tokens.pop() ?? "";
    }

    let bookedFlag = "";
    const operationParts: string[] = [];
    const categoryParts: string[] = [];

    for (const token of tokens) {
      if (token === "SI" || token === "NO") {
        bookedFlag = token;
        continue;
      }

      const bookedMatch = token.match(/^(SI|NO)\s+(.*)$/);
      if (bookedMatch) {
        bookedFlag = bookedMatch[1];
        if (bookedMatch[2]) {
          categoryParts.push(bookedMatch[2]);
        }
        continue;
      }

      if (!bookedFlag) {
        operationParts.push(token);
      } else {
        categoryParts.push(token);
      }
    }

    return {
      raw: normalizedLine,
      date,
      operation: operationParts.join(" ").trim(),
      bookedFlag,
      category: categoryParts.join(" ").trim(),
      amount: amount.trim(),
    };
  }

  return {
    raw: normalizedLine,
    date: null,
    operation: normalizedLine.slice(13, 49).trim(),
    bookedFlag: normalizedLine.slice(49, 65).trim(),
    category: normalizedLine.slice(65, 86).trim(),
    amount: normalizedLine.slice(86).trim(),
  };
}

function parseEuroAmount(value: string) {
  const normalized = value.replace(/[€\s]/g, "").replace(/\./g, "").replace(",", ".");
  const amount = Number(normalized);
  if (!Number.isFinite(amount)) {
    throw new Error(`Invalid statement amount: ${value}`);
  }

  return Number(amount.toFixed(2));
}

function normalizeSlicedLine(line: SlicedStatementLine): SlicedStatementLine {
  let bookedFlag = line.bookedFlag;
  let category = line.category;
  let amount = line.amount;

  if (!["SI", "NO"].includes(bookedFlag) && bookedFlag.length === 1 && category.length > 0) {
    category = `${bookedFlag}${category}`;
    bookedFlag = "";
  }

  if (category.startsWith("€")) {
    amount = `${category}${amount ? ` ${amount}` : ""}`.trim();
    category = "";
  }

  return {
    ...line,
    bookedFlag: bookedFlag.trim(),
    category: category.trim(),
    amount: amount.trim(),
  };
}

function normalizeDate(value: string) {
  const [day, month, year] = value.split(".");
  return `${year}-${month}-${day}`;
}

function joinParts(parts: string[]) {
  const value = parts.join(" ").replace(/\s+/g, " ").trim();
  return value.length > 0 ? value : null;
}

function appendParts(target: string[], value: string) {
  const trimmed = value.trim();
  if (trimmed) {
    target.push(trimmed);
  }
}

function appendLineToRow(row: MutableParsedRow, line: SlicedStatementLine) {
  appendParts(row.operationParts, line.operation);
  appendParts(row.categoryParts, line.category);

  if (!row.bookedFlag && (line.bookedFlag === "SI" || line.bookedFlag === "NO")) {
    row.bookedFlag = line.bookedFlag;
  }

  if (!row.amountText && line.amount) {
    row.amountText = line.amount;
  }
}

function extractContoFromText(text: string, allowedConti: string[]) {
  const normalizedAllowedConti = new Set(allowedConti.map(normalizeContoValue));
  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    const match = line.match(/Conto\s+(.+?)(?:\s{2,}|$)/);
    if (!match) {
      continue;
    }

    const conto = normalizeContoValue(match[1]);
    if (normalizedAllowedConti.has(conto)) {
      return conto;
    }
  }

  throw new Error("The PDF does not contain an allowed conto.");
}

function parseStatementRows(text: string): ParsedStatementPdfRow[] {
  const lines = text.split(/\r?\n/);
  const slicedLines: SlicedStatementLine[] = [];
  let isInsideTable = false;

  for (const line of lines) {
    if (!isInsideTable && isTableHeaderLine(line)) {
      isInsideTable = true;
      continue;
    }

    if (!isInsideTable || isPageNoise(line) || isTableHeaderLine(line)) {
      continue;
    }

    slicedLines.push(normalizeSlicedLine(sliceStatementLine(line)));
  }

  const dateRows: Array<{ lineIndex: number; row: MutableParsedRow }> = [];

  for (let index = 0; index < slicedLines.length; index += 1) {
    if (slicedLines[index].date) {
      const currentLine = slicedLines[index];
      const currentDate = currentLine.date;
      if (!currentDate || !currentLine.amount) {
        continue;
      }

      const row: MutableParsedRow = {
        date: normalizeDate(currentDate),
        operationParts: [],
        categoryParts: [],
        bookedFlag: currentLine.bookedFlag || null,
        amountText: currentLine.amount,
      };
      appendLineToRow(row, currentLine);
      dateRows.push({
        lineIndex: index,
        row,
      });
    }
  }

  for (let index = 0; index < dateRows.length; index += 1) {
    const currentStartIndex = dateRows[index].lineIndex;
    const nextStartIndex = dateRows[index + 1]?.lineIndex ?? slicedLines.length;
    const currentRow = dateRows[index].row;
    const nextRow = dateRows[index + 1]?.row;
    const gapLines = slicedLines.slice(currentStartIndex + 1, nextStartIndex);
    let gapSplitIndex = gapLines.length;

    if (nextRow) {
      let preludeIndex = gapLines.length - 1;
      const nextDateLine = slicedLines[nextStartIndex];
      const nextRowNeedsOperation = nextDateLine?.operation.length === 0;

      if (preludeIndex >= 0) {
        const lastGapLine = gapLines[preludeIndex];
        if ((lastGapLine.operation || lastGapLine.category) && !lastGapLine.amount) {
          gapSplitIndex = preludeIndex;

          if (nextRowNeedsOperation) {
            while (preludeIndex > 0) {
              const previousGapLine = gapLines[preludeIndex - 1];
              if (!previousGapLine.operation || previousGapLine.amount) {
                break;
              }

              preludeIndex -= 1;
              gapSplitIndex = preludeIndex;
            }
          }

          for (let gapIndex = gapSplitIndex; gapIndex < gapLines.length; gapIndex += 1) {
            appendLineToRow(nextRow, gapLines[gapIndex]);
          }
        }
      }
    }

    for (let gapIndex = 0; gapIndex < gapSplitIndex; gapIndex += 1) {
      appendLineToRow(currentRow, gapLines[gapIndex]);
    }
  }

  return dateRows.map(({ row }) => ({
    date: row.date,
    operation: joinParts(row.operationParts) ?? "Operazione senza descrizione",
    bankCategory: joinParts(row.categoryParts),
    bookedFlag: row.bookedFlag,
    signedAmount: parseEuroAmount(row.amountText),
  }));
}

export async function parseStatementPdfFile(input: {
  allowedConti: string[];
  filePath: string;
}): Promise<StatementPdfParseResult> {
  if (input.allowedConti.length === 0) {
    throw new Error("BANK_STATEMENT_ALLOWED_CONTI is empty.");
  }

  let text: string;

  try {
    const result = await execFileAsync("pdftotext", ["-layout", input.filePath, "-"], {
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
    });
    text = result.stdout;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown pdftotext error";
    throw new Error(`Failed to extract PDF text with pdftotext: ${message}`);
  }

  const conto = extractContoFromText(text, input.allowedConti);
  const parsedRows = parseStatementRows(text);
  if (parsedRows.length === 0) {
    throw new Error("The PDF does not contain any supported statement rows.");
  }

  const signatureCounts = new Map<string, number>();
  const transactions = parsedRows.map((row) => {
    const operation = row.operation;
    const normalizedOperation = operation.replace(/\s+/g, " ").trim().toLocaleLowerCase("it-IT");
    const signature = [conto, row.date, normalizedOperation, row.signedAmount.toFixed(2)].join("|");
    const occurrenceIndex = (signatureCounts.get(signature) ?? 0) + 1;
    signatureCounts.set(signature, occurrenceIndex);

    return createStatementTransaction({
      conto,
      date: row.date,
      operation,
      bankCategory: row.bankCategory,
      bookedFlag: row.bookedFlag,
      signedAmount: row.signedAmount,
      occurrenceIndex,
    });
  });

  return {
    conto,
    rows: parsedRows,
    transactions,
  };
}
