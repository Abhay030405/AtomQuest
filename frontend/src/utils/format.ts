export const formatPercent = (value: number) => `${value}%`;

export const formatWithUnit = (value: number, symbol: string) =>
  `${value} ${symbol}`;

export const truncate = (str: string, maxLen = 60) =>
  str.length > maxLen ? `${str.slice(0, maxLen)}…` : str;
