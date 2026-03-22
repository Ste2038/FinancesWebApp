import { AccountGroupInput, AccountInput, CategoryInput, TransactionInput } from "../../domain/models";

export interface PhoneAssetGroupRow {
  DEVICE_ID?: number | null;
  uid?: string | null;
  IS_DEL?: number | null;
  USETIME?: number | null;
  ACC_GROUP_NAME?: string | null;
  TYPE?: number | null;
  ORDERSEQ?: number | null;
  isSynced?: number | null;
  syncTime?: number | null;
  syncVersion?: number | null;
  [key: string]: unknown;
}

export interface PhoneAssetRow {
  ID?: number | null;
  uid?: string | null;
  groupUid?: string | null;
  currencyUid?: string | null;
  NIC_NAME?: string | null;
  CARD_DAY_FIN?: string | null;
  CARD_DAY_PAY?: string | null;
  APP_PACKAGE?: string | null;
  APP_NAME?: string | null;
  SMS_TEL?: string | null;
  SMS_STRING?: string | null;
  IS_TRANS_EXPENSE?: number | null;
  IS_CARD_AUTO_PAY?: number | null;
  CARD_USAGE_HURDLE_TYPE?: number | null;
  ORDERSEQ?: number | null;
  isSynced?: number | null;
  syncTime?: number | null;
  syncVersion?: number | null;
  [key: string]: unknown;
}

export interface PhoneCategoryRow {
  ID?: number | null;
  uid?: string | null;
  pUid?: string | null;
  NAME?: string | null;
  TYPE?: number | null;
  STATUS?: number | null;
  ORDERSEQ?: number | null;
  C_IS_DEL?: number | null;
  C_UTIME?: number | null;
  [key: string]: unknown;
}

export interface PhoneIncomeOutcomeRow {
  AID?: number | null;
  uid?: string | null;
  assetUid?: string | null;
  toAssetUid?: string | null;
  ctgUid?: string | null;
  DO_TYPE?: string | null;
  ZDATE?: string | null;
  WDATE?: string | null;
  paid?: string | null;
  ZMONEY?: string | null;
  IN_ZMONEY?: string | null;
  ZCONTENT?: string | null;
  ZDATA?: string | null;
  SMS_RDATE?: string | null;
  SMS_ORIGIN?: string | null;
  SMS_PARSE_CONTENT?: string | null;
  AMOUNT_ACCOUNT?: number | null;
  MARK?: number | null;
  IS_DEL?: number | null;
  UTIME?: number | null;
  currencyUid?: string | null;
  txUidTrans?: string | null;
  txUidFee?: string | null;
  cardDivideUid?: string | null;
  CARD_DIVIDE_MONTH_STR?: string | null;
  [key: string]: unknown;
}

export interface PhoneDatabaseSnapshot {
  assetGroups: PhoneAssetGroupRow[];
  assets: PhoneAssetRow[];
  categories: PhoneCategoryRow[];
  transactions: PhoneIncomeOutcomeRow[];
}

export interface NormalizedPhoneSnapshot {
  accountGroups: AccountGroupInput[];
  accounts: AccountInput[];
  categories: CategoryInput[];
  transactions: TransactionInput[];
}
