export const DEFAULT_ML_MODEL_TIMEOUT_MS = 15_000;

export type MlModelClientErrorCode =
  | 'ML_SERVICE_UNAVAILABLE'
  | 'ML_MODEL_NOT_READY'
  | 'ML_CONTRACT_MISMATCH'
  | 'ML_TREE_INDEX_INVALID'
  | 'AUTHENTICATION_REQUIRED'
  | 'ADMIN_AUTHORIZATION_REQUIRED';

export class MlModelClientError extends Error {
  constructor(
    public readonly code: MlModelClientErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'MlModelClientError';
  }
}

export interface MlModelParameters {
  n_estimators: number;
  max_depth: number | null;
  max_features: string | number | null;
  min_samples_split: number;
  min_samples_leaf: number;
}

export interface MlModelMetrics {
  test_mae_percentage_points: number;
  test_rmse_percentage_points: number;
  test_r2: number;
}

export interface MlModelInfo {
  model_name: string;
  model_version: string;
  target_name: string;
  feature_contract_version: string;
  n_estimators: number;
  parameters: MlModelParameters;
  raw_input_features: string[];
  preprocessed_features: string[];
  dataset_rows: number;
  train_rows: number;
  test_rows: number;
  metrics: MlModelMetrics;
}

export interface MlModelTreeNode {
  id: number;
  depth: number;
  is_leaf: boolean;
  feature_index: number | null;
  feature: string | null;
  threshold: number | null;
  left: number | null;
  right: number | null;
  prediction: number | null;
}

export interface MlModelTreeStatistics {
  tree_index: number;
  max_depth: number;
  node_count: number;
  leaf_count: number;
}

export interface MlModelTreeStructure {
  tree_index: number;
  tree_statistics: MlModelTreeStatistics;
  nodes: MlModelTreeNode[];
  feature_names: string[];
}

export interface MlModelClientOptions {
  baseUrl?: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

interface MlModelBrowserClientOptions {
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

function requiredString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new MlModelClientError('ML_CONTRACT_MISMATCH', `Response ML tidak memiliki field ${key} yang valid.`);
  }
  return value;
}

function requiredNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new MlModelClientError('ML_CONTRACT_MISMATCH', `Response ML tidak memiliki field ${key} yang valid.`);
  }
  return value;
}

function requiredInteger(record: Record<string, unknown>, key: string): number {
  const value = requiredNumber(record, key);
  if (!Number.isInteger(value)) {
    throw new MlModelClientError('ML_CONTRACT_MISMATCH', `Response ML field ${key} harus integer.`);
  }
  return value;
}

function optionalString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') {
    throw new MlModelClientError('ML_CONTRACT_MISMATCH', `Response ML field ${key} harus string atau null.`);
  }
  return value;
}

function optionalNumber(record: Record<string, unknown>, key: string): number | null {
  const value = record[key];
  if (value === undefined || value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new MlModelClientError('ML_CONTRACT_MISMATCH', `Response ML field ${key} harus number atau null.`);
  }
  return value;
}

function optionalInteger(record: Record<string, unknown>, key: string): number | null {
  const value = record[key];
  if (value === undefined || value === null) return null;
  return requiredInteger(record, key);
}

function assertSafeResponseObject(value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new MlModelClientError('ML_CONTRACT_MISMATCH', 'Response ML harus berupa object JSON.');
  }
}

function parseParameters(value: unknown): MlModelParameters {
  assertSafeResponseObject(value);
  return {
    n_estimators: requiredInteger(value, 'n_estimators'),
    max_depth: optionalInteger(value, 'max_depth'),
    max_features: (() => {
      const mf = value.max_features;
      if (mf === undefined || mf === null) return null;
      if (typeof mf === 'string' || typeof mf === 'number') return mf;
      throw new MlModelClientError('ML_CONTRACT_MISMATCH', 'Field max_features harus string/number atau null.');
    })(),
    min_samples_split: requiredInteger(value, 'min_samples_split'),
    min_samples_leaf: requiredInteger(value, 'min_samples_leaf'),
  };
}

function parseMetrics(value: unknown): MlModelMetrics {
  assertSafeResponseObject(value);
  return {
    test_mae_percentage_points: requiredNumber(value, 'test_mae_percentage_points'),
    test_rmse_percentage_points: requiredNumber(value, 'test_rmse_percentage_points'),
    test_r2: requiredNumber(value, 'test_r2'),
  };
}

export function parseMlModelInfoResponse(value: unknown): MlModelInfo {
  assertSafeResponseObject(value);

  const rawFeatures = value.raw_input_features;
  if (!Array.isArray(rawFeatures) || !rawFeatures.every((v) => typeof v === 'string')) {
    throw new MlModelClientError('ML_CONTRACT_MISMATCH', 'Field raw_input_features harus array string.');
  }

  const preprocessed = value.preprocessed_features;
  if (!Array.isArray(preprocessed) || !preprocessed.every((v) => typeof v === 'string')) {
    throw new MlModelClientError('ML_CONTRACT_MISMATCH', 'Field preprocessed_features harus array string.');
  }

  return {
    model_name: requiredString(value, 'model_name'),
    model_version: requiredString(value, 'model_version'),
    target_name: requiredString(value, 'target_name'),
    feature_contract_version: requiredString(value, 'feature_contract_version'),
    n_estimators: requiredInteger(value, 'n_estimators'),
    parameters: parseParameters(value.parameters),
    raw_input_features: rawFeatures,
    preprocessed_features: preprocessed,
    dataset_rows: requiredInteger(value, 'dataset_rows'),
    train_rows: requiredInteger(value, 'train_rows'),
    test_rows: requiredInteger(value, 'test_rows'),
    metrics: parseMetrics(value.metrics),
  };
}

export function parseMlModelTreeStructureResponse(value: unknown): MlModelTreeStructure {
  assertSafeResponseObject(value);

  const stats = value.tree_statistics;
  assertSafeResponseObject(stats);

  const featureNames = value.feature_names;
  if (!Array.isArray(featureNames) || !featureNames.every((v) => typeof v === 'string')) {
    throw new MlModelClientError('ML_CONTRACT_MISMATCH', 'Field feature_names harus array string.');
  }

  const rawNodes = value.nodes;
  if (!Array.isArray(rawNodes)) {
    throw new MlModelClientError('ML_CONTRACT_MISMATCH', 'Field nodes harus array.');
  }

  const nodes: MlModelTreeNode[] = rawNodes.map((raw) => {
    assertSafeResponseObject(raw);
    const isLeaf = Boolean(raw.is_leaf);
    return {
      id: requiredInteger(raw, 'id'),
      depth: requiredInteger(raw, 'depth'),
      is_leaf: isLeaf,
      feature_index: optionalInteger(raw, 'feature_index'),
      feature: optionalString(raw, 'feature'),
      threshold: optionalNumber(raw, 'threshold'),
      left: optionalInteger(raw, 'left'),
      right: optionalInteger(raw, 'right'),
      prediction: optionalNumber(raw, 'prediction'),
    };
  });

  return {
    tree_index: requiredInteger(value, 'tree_index'),
    tree_statistics: {
      tree_index: requiredInteger(stats, 'tree_index'),
      max_depth: requiredInteger(stats, 'max_depth'),
      node_count: requiredInteger(stats, 'node_count'),
      leaf_count: requiredInteger(stats, 'leaf_count'),
    },
    nodes,
    feature_names: featureNames,
  };
}

async function parseErrorBody(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (body && typeof body === 'object' && 'detail' in body) {
      return String((body as { detail: unknown }).detail);
    }
  } catch {
    // Keep generic error
  }
  return response.statusText || `HTTP ${response.status}`;
}

async function parseAdminApiError(response: Response): Promise<MlModelClientError> {
  try {
    const body = await response.json();
    if (body && typeof body === 'object' && 'error' in body) {
      const error = (body as { error?: { code?: unknown; message?: unknown } }).error;
      const code = typeof error?.code === 'string' ? error.code : 'ML_SERVICE_UNAVAILABLE';
      const message = typeof error?.message === 'string' ? error.message : response.statusText;

      if (
        code === 'ML_SERVICE_UNAVAILABLE' ||
        code === 'ML_MODEL_NOT_READY' ||
        code === 'ML_CONTRACT_MISMATCH' ||
        code === 'ML_TREE_INDEX_INVALID' ||
        code === 'AUTHENTICATION_REQUIRED' ||
        code === 'ADMIN_AUTHORIZATION_REQUIRED'
      ) {
        return new MlModelClientError(code, message);
      }

      return new MlModelClientError('ML_SERVICE_UNAVAILABLE', message || `HTTP ${response.status}`);
    }
  } catch {
    // Fall through to status text below.
  }

  return new MlModelClientError('ML_SERVICE_UNAVAILABLE', response.statusText || `HTTP ${response.status}`);
}

async function fetchAdminMlModelJson(
  endpoint: string,
  options: MlModelBrowserClientOptions,
): Promise<unknown> {
  const fetchFn = options.fetchFn ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_ML_MODEL_TIMEOUT_MS;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchFn(endpoint, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw await parseAdminApiError(response);
    }

    return response.json();
  } catch (error) {
    if (error instanceof MlModelClientError) throw error;
    throw new MlModelClientError('ML_SERVICE_UNAVAILABLE', 'API admin model Random Forest tidak tersedia atau timeout.');
  } finally {
    clearTimeout(timeout);
  }
}

export async function requestAdminMlModelInfo(
  options: MlModelBrowserClientOptions = {},
): Promise<MlModelInfo> {
  return parseMlModelInfoResponse(await fetchAdminMlModelJson('/api/admin/ml-model/info', options));
}

export async function requestAdminMlModelTree(
  treeIndex: number,
  options: MlModelBrowserClientOptions = {},
): Promise<MlModelTreeStructure> {
  if (!Number.isInteger(treeIndex) || treeIndex < 0) {
    throw new MlModelClientError('ML_TREE_INDEX_INVALID', `Tree index tidak valid: ${treeIndex}.`);
  }

  return parseMlModelTreeStructureResponse(
    await fetchAdminMlModelJson(`/api/admin/ml-model/tree/${encodeURIComponent(treeIndex)}`, options),
  );
}

export async function requestMlModelInfo(options: MlModelClientOptions = {}): Promise<MlModelInfo> {
  const baseUrl = options.baseUrl ?? process.env.ML_SERVICE_BASE_URL;
  if (!baseUrl) {
    throw new MlModelClientError(
      'ML_SERVICE_UNAVAILABLE',
      'ML_SERVICE_BASE_URL belum dikonfigurasi pada server.',
    );
  }

  const fetchFn = options.fetchFn ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_ML_MODEL_TIMEOUT_MS;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = new URL('/v1/model/info', baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
    const response = await fetchFn(url.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    if (response.status === 503) {
      throw new MlModelClientError('ML_MODEL_NOT_READY', 'Model ML v4 belum siap digunakan.');
    }
    if (!response.ok) {
      throw new MlModelClientError('ML_SERVICE_UNAVAILABLE', `ML service gagal memuat info model: ${await parseErrorBody(response)}`);
    }

    return parseMlModelInfoResponse(await response.json());
  } catch (error) {
    if (error instanceof MlModelClientError) throw error;
    throw new MlModelClientError('ML_SERVICE_UNAVAILABLE', 'ML service tidak tersedia atau timeout saat memuat info model.');
  } finally {
    clearTimeout(timeout);
  }
}

export async function requestMlModelTree(
  treeIndex: number,
  options: MlModelClientOptions = {},
): Promise<MlModelTreeStructure> {
  const baseUrl = options.baseUrl ?? process.env.ML_SERVICE_BASE_URL;
  if (!baseUrl) {
    throw new MlModelClientError(
      'ML_SERVICE_UNAVAILABLE',
      'ML_SERVICE_BASE_URL belum dikonfigurasi pada server.',
    );
  }

  if (!Number.isInteger(treeIndex) || treeIndex < 0) {
    throw new MlModelClientError('ML_TREE_INDEX_INVALID', `Tree index tidak valid: ${treeIndex}.`);
  }

  const fetchFn = options.fetchFn ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_ML_MODEL_TIMEOUT_MS;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = new URL(`/v1/model/tree/${encodeURIComponent(treeIndex)}`, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
    const response = await fetchFn(url.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    if (response.status === 503) {
      throw new MlModelClientError('ML_MODEL_NOT_READY', 'Model ML v4 belum siap digunakan.');
    }
    if (response.status === 400) {
      throw new MlModelClientError('ML_TREE_INDEX_INVALID', `Tree index tidak valid: ${await parseErrorBody(response)}`);
    }
    if (!response.ok) {
      throw new MlModelClientError('ML_SERVICE_UNAVAILABLE', `ML service gagal memuat struktur tree: ${await parseErrorBody(response)}`);
    }

    return parseMlModelTreeStructureResponse(await response.json());
  } catch (error) {
    if (error instanceof MlModelClientError) throw error;
    throw new MlModelClientError('ML_SERVICE_UNAVAILABLE', 'ML service tidak tersedia atau timeout saat memuat struktur tree.');
  } finally {
    clearTimeout(timeout);
  }
}
