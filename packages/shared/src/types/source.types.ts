export interface SourceWithCount {
  id: string;
  name: string;
  count: number;
}

export interface SourcesSummary {
  // Total number of articles (DONE) across all sources.
  total: number;
  sources: SourceWithCount[];
}

