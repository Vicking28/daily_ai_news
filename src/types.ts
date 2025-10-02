/**
 * Core data types for the Daily AI News Podcast system
 */

export type Article = {
  id: string;          // Stable deterministic id
  source: string;
  title: string;
  link: string;
  pubDate?: string;
  summary: string;     // plain text
};

export type SelectedArticlesResult = {
  selectedIds: string[];
};

export type ArticleSelectionOptions = {
  maxCount?: number;
};
