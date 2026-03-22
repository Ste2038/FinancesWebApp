export interface PhoneTableMapping {
  sourceTable: string;
  targetEntity: "account_group" | "account" | "category" | "transaction";
  uniqueSourceKey: string;
  notes: string;
}

export const PHONE_TABLE_MAPPINGS: PhoneTableMapping[] = [
  {
    sourceTable: "ASSETGROUP",
    targetEntity: "account_group",
    uniqueSourceKey: "uid",
    notes: "Maps source account grouping records to internal account groups.",
  },
  {
    sourceTable: "ASSETS",
    targetEntity: "account",
    uniqueSourceKey: "uid",
    notes: "Maps source account records to internal accounts.",
  },
  {
    sourceTable: "ZCATEGORY",
    targetEntity: "category",
    uniqueSourceKey: "uid",
    notes: "Maps source category tree to internal categories.",
  },
  {
    sourceTable: "INOUTCOME",
    targetEntity: "transaction",
    uniqueSourceKey: "uid",
    notes: "Maps source transaction ledger rows to internal transactions.",
  },
];
