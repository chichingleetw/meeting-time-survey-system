export const FIELD_KEYS = [
  'meeting_id',
  'event_type',
  'meeting_title',
  'meeting_description',
  'organizer_name',
  'start_date',
  'end_date',
  'start_time',
  'end_time',
  'slot_minutes',
  'include_saturday',
  'include_sunday',
  'response_deadline',
  'participant_name',
  'participant_id',
  'availability_json',
  'note',
  'selected_final_slot',
  'client_timestamp',
  'extra_json',
];

export const REQUIRED_FIELD_KEYS = FIELD_KEYS;

export const REQUIRED_PARAMS = [
  'meeting_id',
  'sheet_id',
  'form_url',
  ...REQUIRED_FIELD_KEYS.map((key) => `field_${key}`),
];

export function generateId(prefix) {
  const values = crypto.getRandomValues(new Uint32Array(2));
  return `${prefix}_${Date.now().toString(36)}_${Array.from(values, (value) => value.toString(36)).join('')}`;
}

export function normalizeFormUrl(url) {
  if (!url) return '';
  return String(url).trim().replace('/viewform', '/formResponse').replace('/edit', '/formResponse');
}

export function buildConfigFromParams(search = window.location.search) {
  const params = new URLSearchParams(search);
  const missing = REQUIRED_PARAMS.filter((key) => !params.get(key));

  if (missing.length > 0) {
    return { ok: false, missing };
  }

  const fields = {};
  for (const key of FIELD_KEYS) {
    fields[key] = params.get(`field_${key}`) || '';
  }

  return {
    ok: true,
    config: {
      meetingId: params.get('meeting_id'),
      sheetId: params.get('sheet_id'),
      sheetName: params.get('sheet_name') || '',
      gid: params.get('gid') || '',
      formUrl: normalizeFormUrl(params.get('form_url')),
      fields,
    },
  };
}

export function readBaseSettings(storage = localStorage) {
  try {
    return JSON.parse(storage.getItem('meetingSchedulerSettings') || '{}');
  } catch {
    return {};
  }
}

export function saveBaseSettings(settings, storage = localStorage) {
  storage.setItem('meetingSchedulerSettings', JSON.stringify(settings));
}

export function buildUrl(page, values, baseHref = window.location.href) {
  const url = new URL(page, baseHref);
  url.search = '';

  for (const [key, value] of Object.entries(values)) {
    if (value != null && String(value).trim() !== '') {
      url.searchParams.set(key, String(value).trim());
    }
  }

  return url.toString();
}

export function buildSharedParams(configOrValues) {
  const fields = configOrValues.fields || {};
  const params = {
    meeting_id: configOrValues.meetingId || configOrValues.meeting_id,
    sheet_id: configOrValues.sheetId || configOrValues.sheet_id,
    sheet_name: configOrValues.sheetName || configOrValues.sheet_name || '',
    gid: configOrValues.gid || '',
    form_url: normalizeFormUrl(configOrValues.formUrl || configOrValues.form_url),
  };

  for (const key of FIELD_KEYS) {
    params[`field_${key}`] = fields[key] || configOrValues[`field_${key}`] || '';
  }

  return params;
}

export function parsePrefillUrl(rawUrl) {
  const fields = {};
  const missing = [];

  try {
    const url = new URL(String(rawUrl || '').trim());
    const formUrl = normalizeFormUrl(`${url.origin}${url.pathname}`);

    for (const [paramKey, paramValue] of url.searchParams.entries()) {
      if (!paramKey.startsWith('entry.')) continue;
      const marker = normalizeMarker(paramValue);
      const matchedKey = FIELD_KEYS.find((key) => normalizeMarker(key) === marker);
      if (matchedKey) fields[matchedKey] = paramKey;
    }

    for (const key of FIELD_KEYS) {
      if (!fields[key]) missing.push(key);
    }

    return { fields, missing, formUrl };
  } catch {
    return { fields, missing: [...FIELD_KEYS], formUrl: '' };
  }
}

export function normalizeMarker(value) {
  return String(value || '').trim().toLowerCase().replaceAll('-', '_').replaceAll(' ', '_');
}
