import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  getAdminMlSplitFolder,
  parseAdminMlQuery,
  type AdminMlQuery,
  type AdminMlSplit,
} from '@/lib/adminMachineLearningUi';
import { PaymentServiceError } from './paymentService';

export interface AdminMachineLearningUser {
  id: string;
  role?: string | null;
}

export interface AdminMlEvaluationSummary {
  split: string;
  trainRatio: number;
  testRatio: number;
  model: {
    type: string;
    params: Record<string, unknown>;
  };
  randomState: number;
  totalRows: number;
  trainRows: number;
  testRows: number;
  uniqueSourceVehicles: number;
  trainSourceVehicles: number;
  testSourceVehicles: number;
  sourceVehicleOverlap: number;
  features: string[];
  target: string;
  generatedAt: string;
}

export interface AdminMlTrainRow {
  idData: string;
  sourceVehicleId: string;
  vehicleCategory: string;
  tripType: string;
  durationDays: number;
  isWeekend: number;
  isHoliday: number;
  isPeakSeason: number;
  utilizationRate: number;
  bookingLeadDays: number;
  targetAdjustmentPct: number;
  dynamicPriceDisplayPerDay: number;
  totalInvoiceDisplay: number;
}

export interface AdminMlTestRow {
  idData: string;
  sourceVehicleId: string;
  vehicleCategory: string;
  tripType: string;
  durationDays: number;
  isWeekend: number;
  isHoliday: number;
  isPeakSeason: number;
  utilizationRate: number;
  actualAdjustmentPct: number;
  predictedAdjustmentPct: number;
  absoluteErrorPctPoint: number;
  absoluteErrorIdr: number;
}

export interface AdminMlPage<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface AdminMlComputedEvaluation {
  maePctPoint: number;
  r2Percent: number;
  evaluatedRows: number;
}

export interface AdminMachineLearningResponse {
  query: AdminMlQuery;
  evaluation: AdminMlEvaluationSummary;
  training: AdminMlPage<AdminMlTrainRow>;
  testing: AdminMlPage<AdminMlTestRow>;
  prediction: AdminMlPage<AdminMlTestRow>;
  computedEvaluation: AdminMlComputedEvaluation | null;
}

interface AdminMachineLearningDependencies {
  query?: URLSearchParams | Record<string, string | string[] | undefined> | Partial<AdminMlQuery>;
  artifactRoot?: string;
}

type CsvRow = Record<string, string>;

const SEARCH_COLUMNS = ['id_data', 'source_vehicle_id', 'vehicle_category', 'trip_type'];

function assertAdminUser(user: AdminMachineLearningUser | null | undefined): void {
  if (!user?.id) {
    throw new PaymentServiceError('AUTHENTICATION_REQUIRED', 'Login admin diperlukan untuk membaca artifact machine learning.');
  }

  if (user.role !== 'ADMIN') {
    throw new PaymentServiceError('ADMIN_AUTHORIZATION_REQUIRED', 'Hanya admin yang dapat membaca artifact machine learning.');
  }
}

function normalizeQuery(query: AdminMachineLearningDependencies['query']): AdminMlQuery {
  if (!query) {
    return parseAdminMlQuery({});
  }

  if (query instanceof URLSearchParams) {
    return parseAdminMlQuery(query);
  }

  return parseAdminMlQuery(
    Object.fromEntries(
      Object.entries(query).map(([key, value]) => [key, Array.isArray(value) ? value : String(value ?? '')]),
    ),
  );
}

function getArtifactRoot(override?: string): string {
  return override ?? path.join(process.cwd(), 'ml-service', 'artifacts', 'ml_evaluation');
}

function resolveSplitPath(root: string, split: AdminMlSplit, fileName: string): string {
  return path.join(root, getAdminMlSplitFolder(split), fileName);
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current);
  return values;
}

async function readCsvRows(filePath: string): Promise<CsvRow[]> {
  const content = await readFile(filePath, 'utf-8');
  const lines = content.trimEnd().split(/\r?\n/);
  const [headerLine, ...dataLines] = lines;
  if (!headerLine) {
    return [];
  }

  const headers = parseCsvLine(headerLine);
  return dataLines
    .filter(Boolean)
    .map((line) => {
      const values = parseCsvLine(line);
      return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
    });
}

async function readEvaluation(filePath: string): Promise<AdminMlEvaluationSummary> {
  return JSON.parse(await readFile(filePath, 'utf-8')) as AdminMlEvaluationSummary;
}

function numberValue(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function matchesSearch(row: CsvRow, q: string): boolean {
  if (!q) {
    return true;
  }

  const normalized = q.toLowerCase();
  return SEARCH_COLUMNS.some((column) => row[column]?.toLowerCase().includes(normalized));
}

function paginateRows<T>(
  items: T[],
  page: number,
  pageSize: number,
): AdminMlPage<T> {
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;

  return {
    items: items.slice(start, start + pageSize),
    page: safePage,
    pageSize,
    totalItems,
    totalPages,
    hasNextPage: safePage < totalPages,
    hasPreviousPage: safePage > 1,
  };
}

function mapTrainRow(row: CsvRow): AdminMlTrainRow {
  return {
    idData: row.id_data,
    sourceVehicleId: row.source_vehicle_id,
    vehicleCategory: row.vehicle_category,
    tripType: row.trip_type,
    durationDays: numberValue(row.duration_days),
    isWeekend: numberValue(row.is_weekend),
    isHoliday: numberValue(row.is_holiday),
    isPeakSeason: numberValue(row.is_peak_season),
    utilizationRate: numberValue(row.utilization_rate),
    bookingLeadDays: numberValue(row.booking_lead_days),
    targetAdjustmentPct: numberValue(row.target_adjustment_pct),
    dynamicPriceDisplayPerDay: numberValue(row.dynamic_price_display_per_day),
    totalInvoiceDisplay: numberValue(row.total_invoice_display),
  };
}

function mapTestRow(row: CsvRow): AdminMlTestRow {
  return {
    idData: row.id_data,
    sourceVehicleId: row.source_vehicle_id,
    vehicleCategory: row.vehicle_category,
    tripType: row.trip_type,
    durationDays: numberValue(row.duration_days),
    isWeekend: numberValue(row.is_weekend),
    isHoliday: numberValue(row.is_holiday),
    isPeakSeason: numberValue(row.is_peak_season),
    utilizationRate: numberValue(row.utilization_rate),
    actualAdjustmentPct: numberValue(row.actual_adjustment_pct),
    predictedAdjustmentPct: numberValue(row.predicted_adjustment_pct),
    absoluteErrorPctPoint: numberValue(row.absolute_error_pct_point),
    absoluteErrorIdr: numberValue(row.absolute_error_idr),
  };
}

function calculateEvaluationFromPredictions(rows: CsvRow[]): AdminMlComputedEvaluation {
  if (rows.length === 0) {
    return {
      maePctPoint: 0,
      r2Percent: 0,
      evaluatedRows: 0,
    };
  }

  const actualValues = rows.map((row) => numberValue(row.actual_adjustment_pct));
  const predictedValues = rows.map((row) => numberValue(row.predicted_adjustment_pct));
  const absoluteErrors = rows.map((row, index) => {
    const explicitError = Number(row.absolute_error_pct_point);
    if (Number.isFinite(explicitError)) {
      return explicitError;
    }

    return Math.abs(actualValues[index] - predictedValues[index]);
  });

  const maePctPoint = absoluteErrors.reduce((total, value) => total + value, 0) / absoluteErrors.length;
  const actualMean = actualValues.reduce((total, value) => total + value, 0) / actualValues.length;
  const ssRes = actualValues.reduce((total, actual, index) => total + ((actual - predictedValues[index]) ** 2), 0);
  const ssTot = actualValues.reduce((total, actual) => total + ((actual - actualMean) ** 2), 0);
  const r2 = ssTot === 0 ? 0 : 1 - (ssRes / ssTot);

  return {
    maePctPoint,
    r2Percent: r2 * 100,
    evaluatedRows: rows.length,
  };
}

export async function readAdminMachineLearning(
  user: AdminMachineLearningUser | null | undefined,
  dependencies: AdminMachineLearningDependencies = {},
): Promise<AdminMachineLearningResponse> {
  assertAdminUser(user);

  const query = normalizeQuery(dependencies.query);
  const root = getArtifactRoot(dependencies.artifactRoot);
  const [evaluation, trainRows, testRows] = await Promise.all([
    readEvaluation(resolveSplitPath(root, query.split, 'evaluation.json')),
    readCsvRows(resolveSplitPath(root, query.split, 'train_dataset.csv')),
    readCsvRows(resolveSplitPath(root, query.split, 'test_predictions.csv')),
  ]);

  const filteredTrainRows = trainRows
    .filter((row) => matchesSearch(row, query.trainQ))
    .map(mapTrainRow);
  const filteredTestRows = testRows
    .filter((row) => matchesSearch(row, query.testQ))
    .map(mapTestRow);
  const filteredPredictionRows = query.evaluated
    ? testRows
      .filter((row) => matchesSearch(row, query.predictionQ))
      .map(mapTestRow)
    : [];

  return {
    query,
    evaluation,
    training: paginateRows(filteredTrainRows, query.trainPage, query.trainPageSize),
    testing: paginateRows(filteredTestRows, query.testPage, query.testPageSize),
    prediction: paginateRows(filteredPredictionRows, query.predictionPage, query.predictionPageSize),
    computedEvaluation: query.evaluated ? calculateEvaluationFromPredictions(testRows) : null,
  };
}
