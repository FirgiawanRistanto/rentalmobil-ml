import { getCarCategoryDisplayLabel } from './carCategoryUi';
import { formatRupiahId } from './paymentUi';

export const ADMIN_MACHINE_LEARNING_ROUTE = '/admin/machine-learning';

export type AdminMlSplit = '70_30' | '80_20' | '90_10';

export interface AdminMlQuery {
  split: AdminMlSplit;
  evaluated: boolean;
  trainPage: number;
  trainPageSize: number;
  trainQ: string;
  testPage: number;
  testPageSize: number;
  testQ: string;
  predictionPage: number;
  predictionPageSize: number;
  predictionQ: string;
}

export const ADMIN_ML_SPLITS: Array<{
  value: AdminMlSplit;
  label: string;
  folder: string;
}> = [
  { value: '70_30', label: '70% Training / 30% Testing', folder: 'split_70_30' },
  { value: '80_20', label: '80% Training / 20% Testing', folder: 'split_80_20' },
  { value: '90_10', label: '90% Training / 10% Testing', folder: 'split_90_10' },
];

export const DEFAULT_ADMIN_ML_QUERY: AdminMlQuery = {
  split: '80_20',
  evaluated: false,
  trainPage: 1,
  trainPageSize: 10,
  trainQ: '',
  testPage: 1,
  testPageSize: 10,
  testQ: '',
  predictionPage: 1,
  predictionPageSize: 10,
  predictionQ: '',
};

const VALID_SPLITS = new Set<AdminMlSplit>(ADMIN_ML_SPLITS.map((split) => split.value));

function readParam(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const value = params instanceof URLSearchParams ? params.get(key) ?? undefined : params[key];
  return Array.isArray(value) ? value[0] : value;
}

function clampPositiveInt(value: string | undefined, fallback: number, max: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(parsed, max);
}

export function parseAdminMlQuery(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
): AdminMlQuery {
  const split = readParam(params, 'split');

  return {
    split: VALID_SPLITS.has(split as AdminMlSplit) ? (split as AdminMlSplit) : DEFAULT_ADMIN_ML_QUERY.split,
    evaluated: readParam(params, 'evaluated') === '1',
    trainPage: clampPositiveInt(readParam(params, 'trainPage'), DEFAULT_ADMIN_ML_QUERY.trainPage, 100000),
    trainPageSize: clampPositiveInt(readParam(params, 'trainPageSize'), DEFAULT_ADMIN_ML_QUERY.trainPageSize, 50),
    trainQ: (readParam(params, 'trainQ') ?? '').trim().slice(0, 120),
    testPage: clampPositiveInt(readParam(params, 'testPage'), DEFAULT_ADMIN_ML_QUERY.testPage, 100000),
    testPageSize: clampPositiveInt(readParam(params, 'testPageSize'), DEFAULT_ADMIN_ML_QUERY.testPageSize, 50),
    testQ: (readParam(params, 'testQ') ?? '').trim().slice(0, 120),
    predictionPage: clampPositiveInt(readParam(params, 'predictionPage'), DEFAULT_ADMIN_ML_QUERY.predictionPage, 100000),
    predictionPageSize: clampPositiveInt(readParam(params, 'predictionPageSize'), DEFAULT_ADMIN_ML_QUERY.predictionPageSize, 50),
    predictionQ: (readParam(params, 'predictionQ') ?? '').trim().slice(0, 120),
  };
}

export function getAdminMlSplitFolder(split: AdminMlSplit): string {
  return ADMIN_ML_SPLITS.find((item) => item.value === split)?.folder ?? 'split_80_20';
}

export function getAdminMlSplitLabel(split: AdminMlSplit): string {
  return ADMIN_ML_SPLITS.find((item) => item.value === split)?.label ?? '80% Training / 20% Testing';
}

export function buildAdminMlPath(query: Partial<AdminMlQuery> = {}): string {
  const nextQuery = { ...DEFAULT_ADMIN_ML_QUERY, ...query };
  const params = new URLSearchParams();

  params.set('split', nextQuery.split);
  if (nextQuery.evaluated) params.set('evaluated', '1');
  if (nextQuery.trainPage !== DEFAULT_ADMIN_ML_QUERY.trainPage) params.set('trainPage', String(nextQuery.trainPage));
  if (nextQuery.trainPageSize !== DEFAULT_ADMIN_ML_QUERY.trainPageSize) params.set('trainPageSize', String(nextQuery.trainPageSize));
  if (nextQuery.trainQ) params.set('trainQ', nextQuery.trainQ);
  if (nextQuery.testPage !== DEFAULT_ADMIN_ML_QUERY.testPage) params.set('testPage', String(nextQuery.testPage));
  if (nextQuery.testPageSize !== DEFAULT_ADMIN_ML_QUERY.testPageSize) params.set('testPageSize', String(nextQuery.testPageSize));
  if (nextQuery.testQ) params.set('testQ', nextQuery.testQ);
  if (nextQuery.predictionPage !== DEFAULT_ADMIN_ML_QUERY.predictionPage) params.set('predictionPage', String(nextQuery.predictionPage));
  if (nextQuery.predictionPageSize !== DEFAULT_ADMIN_ML_QUERY.predictionPageSize) params.set('predictionPageSize', String(nextQuery.predictionPageSize));
  if (nextQuery.predictionQ) params.set('predictionQ', nextQuery.predictionQ);

  const serialized = params.toString();
  return serialized ? `${ADMIN_MACHINE_LEARNING_ROUTE}?${serialized}` : ADMIN_MACHINE_LEARNING_ROUTE;
}

export function formatAdminMlCategory(category: string): string {
  return getCarCategoryDisplayLabel(category);
}

export function formatAdminMlTripType(tripType: string): string {
  switch (tripType) {
    case 'dalam_kota':
      return 'Dalam Kota';
    case 'luar_kota':
      return 'Luar Kota';
    default:
      return tripType;
  }
}

export function formatAdminMlBooleanFlag(value: string | number | boolean): string {
  return value === true || value === 1 || value === '1' ? 'Ya' : 'Tidak';
}

export function formatAdminMlPercent(value: number, fractionDigits = 2): string {
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function formatAdminMlSignedPercent(value: number): string {
  const formatted = formatAdminMlPercent(value);
  return value > 0 ? `+${formatted}%` : `${formatted}%`;
}

export function formatAdminMlPctPoint(value: number): string {
  return `${formatAdminMlPercent(value)} poin persentase`;
}

export function formatAdminMlR2(value: number): string {
  return `${formatAdminMlPercent(value)}%`;
}

export function formatAdminMlUtilization(value: number): string {
  return `${formatAdminMlPercent(value * 100, 1)}%`;
}

export { formatRupiahId };
