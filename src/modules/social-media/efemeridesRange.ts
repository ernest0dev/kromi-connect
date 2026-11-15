export interface EfemerideRangeResult<T> {
  key: string;
  options: T[];
  error: string;
}

export function getEfemeridesRangeKey(
  campaignType: string,
  startDate: string,
  endDate: string,
): string | null {
  if (campaignType !== "EFEMERIDE" || !startDate || !endDate) return null;

  const isValidDate = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  };
  if (!isValidDate(startDate) || !isValidDate(endDate) || endDate < startDate) return null;

  const startYear = Number(startDate.slice(0, 4));
  const endYear = Number(endDate.slice(0, 4));
  if (!Number.isInteger(startYear) || !Number.isInteger(endYear) || startYear < 1 || endYear > 9999) return null;

  return `${startDate}/${endDate}`;
}

export function getEfemeridesRangeView<T>(
  key: string | null,
  result: EfemerideRangeResult<T> | null,
  requestPending: boolean,
) {
  const matchesCurrentRange = key !== null && result?.key === key;
  const loading = key !== null && (requestPending || !matchesCurrentRange);

  return {
    loading,
    options: !loading && matchesCurrentRange && result ? result.options : [],
    error: !loading && matchesCurrentRange && result ? result.error : "",
  };
}
