export interface DateRange {
  startDate?: string;
  endDate?: string;
}

export interface AnalyticsFilters {
  dateRange?: DateRange;
  accountIds?: number[];
  accountGroupIds?: number[];
  categoryIds?: number[];
}

export interface TimeSeriesPoint {
  date: string;
  value: number;
}

export interface SeriesPointByAccount {
  date: string;
  accountId: number;
  value: number;
}

export interface SeriesPointByCategory {
  date: string;
  categoryId: number;
  value: number;
}
