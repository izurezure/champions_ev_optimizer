const MONTH_RE = /^\d{4}-\d{2}$/;
const SAFE_ID_RE = /^[a-z0-9]+$/;
const SAFE_RATING_RE = /^\d+$/;
const MEGA_POLICIES = new Set(['auto', 'always', 'never']);
const NATURE_POLICIES = new Set(['fixed', 'neutral', 'optimize']);
const SETUP_BOOSTS = new Set(['0', '1', '2']);
const SPEED_MODES = new Set(['global', 'fixed']);

export function validateStartupConfig({ defaults, formats }) {
  validateFormatRegistry(formats);
  return validateConfig({}, { defaults, formats });
}

export function validateConfig(input = {}, { defaults, formats }) {
  validateFormatRegistry(formats);
  const source = { ...defaults, ...input };
  const formatId = source.format ?? defaults.format;
  const formatMetadata = findFormat(formats, formatId);
  validateSupportedFormat(formatMetadata);

  const month = validateMonth(source.month ?? defaults.month ?? 'latest');
  const rating = validateRating(source.rating ?? defaults.rating ?? formatMetadata.ratings[0], formatMetadata);
  const megaPolicy = validateSetValue('megaPolicy', source.megaPolicy ?? defaults.megaPolicy ?? 'auto', MEGA_POLICIES);
  const naturePolicy = validateSetValue('naturePolicy', source.naturePolicy ?? defaults.naturePolicy ?? 'fixed', NATURE_POLICIES);
  const setupBoost = validateSetupBoost(source.setupBoost ?? defaults.setupBoost ?? 0);
  const speedMode = validateSetValue('speedMode', source.speedMode ?? defaults.speedMode ?? 'global', SPEED_MODES);
  const speedPoints = validateSpeedPoints(speedMode, source.speedPoints ?? defaults.speedPoints ?? null);
  const excludeOther = validateBoolean('excludeOther', source.excludeOther ?? defaults.excludeOther ?? true);

  return {
    ...source,
    format: formatMetadata.id,
    smogonFormat: formatMetadata.smogonFormat,
    formatLabel: formatMetadata.label,
    formatMetadata,
    month,
    rating,
    megaPolicy,
    naturePolicy,
    setupBoost,
    speedMode,
    speedPoints,
    excludeOther
  };
}

export function findFormat(formats, formatId) {
  const id = String(formatId ?? '');
  const format = formats.find((entry) => entry.id === id);
  if (!format) {
    throw validationError(`Unknown format "${id}". Allowed formats: ${formats.map((entry) => entry.id).join(', ')}`);
  }
  return { ...format, smogonFormat: format.smogonFormat ?? format.id };
}

export function validateMonth(value) {
  const month = String(value ?? '');
  if (month !== 'latest' && !MONTH_RE.test(month)) {
    throw validationError(`Invalid month "${month}". Use "latest" or YYYY-MM.`);
  }
  return month;
}

export function validateRating(value, format) {
  const rating = String(value ?? '');
  if (!SAFE_RATING_RE.test(rating) || !format.ratings.includes(rating)) {
    throw validationError(`Invalid rating "${rating}" for ${format.id}. Allowed ratings: ${format.ratings.join(', ')}`);
  }
  return rating;
}

function validateFormatRegistry(formats) {
  if (!Array.isArray(formats) || formats.length === 0) {
    throw validationError('Format registry must contain at least one format.');
  }
  const seen = new Set();
  for (const format of formats) {
    const smogonFormat = format.smogonFormat ?? format.id;
    if (!SAFE_ID_RE.test(String(format.id ?? ''))) throw validationError(`Invalid format id "${format.id}".`);
    if (!SAFE_ID_RE.test(String(smogonFormat ?? ''))) throw validationError(`Invalid Smogon format id "${smogonFormat}".`);
    if (seen.has(format.id)) throw validationError(`Duplicate format id "${format.id}".`);
    if (!Array.isArray(format.ratings) || format.ratings.length === 0) {
      throw validationError(`Format "${format.id}" must define ratings.`);
    }
    for (const rating of format.ratings) {
      if (!SAFE_RATING_RE.test(String(rating))) throw validationError(`Invalid rating "${rating}" in format "${format.id}".`);
    }
    seen.add(format.id);
  }
}

function validateSupportedFormat(format) {
  if (format.battleType !== 'singles') {
    throw validationError(`Unsupported format "${format.id}": battleType "${format.battleType}" is not supported by this optimizer.`);
  }
  if (format.defaultLevel !== 50) {
    throw validationError(`Unsupported format "${format.id}": defaultLevel "${format.defaultLevel}" is not supported by this optimizer.`);
  }
}

function validateSetValue(name, value, allowed) {
  const text = String(value ?? '');
  if (!allowed.has(text)) {
    throw validationError(`Invalid ${name} "${text}". Allowed values: ${[...allowed].join(', ')}`);
  }
  return text;
}

function validateSetupBoost(value) {
  const text = String(value ?? '');
  if (!SETUP_BOOSTS.has(text)) {
    throw validationError(`Invalid setupBoost "${text}". Allowed values: 0, 1, 2`);
  }
  return Number(text);
}

function validateSpeedPoints(speedMode, value) {
  if (speedMode === 'global') return null;
  if (value === null || value === undefined || value === '') {
    throw validationError('Invalid speedPoints "". Use an integer from 0 to 32 when speedMode is fixed.');
  }
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > 32) {
    throw validationError(`Invalid speedPoints "${value}". Use an integer from 0 to 32 when speedMode is fixed.`);
  }
  return number;
}

function validateBoolean(name, value) {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw validationError(`Invalid ${name} "${value}". Use true or false.`);
}

function validationError(message) {
  const error = new Error(message);
  error.name = 'ValidationError';
  return error;
}
