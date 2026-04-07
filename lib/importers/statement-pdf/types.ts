import { TransactionInput } from "../../domain/models";

export interface StatementPdfSourceRaw extends Record<string, unknown> {
  kind: "statement_pdf";
  conto: string;
  operation: string;
  normalizedOperation: string;
  bankCategory: string | null;
  bookedFlag: string | null;
  signedAmount: number;
  occurrenceIndex: number;
}

export interface StatementPdfTransaction extends TransactionInput {
  sourceRaw: StatementPdfSourceRaw;
}

export interface ParsedStatementPdfRow {
  date: string;
  operation: string;
  bankCategory: string | null;
  bookedFlag: string | null;
  signedAmount: number;
}

export interface StatementPdfParseResult {
  conto: string;
  rows: ParsedStatementPdfRow[];
  transactions: StatementPdfTransaction[];
}
