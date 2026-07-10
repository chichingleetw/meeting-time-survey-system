const HEADER_ALIASES = {
  Timestamp: 'timestamp_server',
  '時間戳記': 'timestamp_server',
  meeting_id: 'meeting_id',
  event_type: 'event_type',
  meeting_title: 'meeting_title',
  meeting_description: 'meeting_description',
  organizer_name: 'organizer_name',
  start_date: 'start_date',
  end_date: 'end_date',
  start_time: 'start_time',
  end_time: 'end_time',
  slot_minutes: 'slot_minutes',
  include_saturday: 'include_saturday',
  include_sunday: 'include_sunday',
  response_deadline: 'response_deadline',
  participant_name: 'participant_name',
  participant_id: 'participant_id',
  availability_json: 'availability_json',
  note: 'note',
  selected_final_slot: 'selected_final_slot',
  client_timestamp: 'client_timestamp',
  extra_json: 'extra_json',
};

export async function fetchSheetEvents(config) {
  if (config.sheetName) {
    return fetchGvizRows(config.sheetId, config.sheetName);
  }

  if (config.gid) {
    return fetchCsvRows(config.sheetId, config.gid);
  }

  return fetchGvizRows(config.sheetId, '表單回應 1');
}

async function fetchGvizRows(sheetId, sheetName) {
  const url = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
  const response = await fetch(url, { cache: 'no-store' });

  if (!response.ok) {
    throw new Error('無法讀取 Google Sheet');
  }

  const text = await response.text();
  const jsonText = text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1);
  const data = JSON.parse(jsonText);
  const headers = data.table.cols.map((col) => normalizeHeader(col.label || col.id || ''));

  return data.table.rows.map((row, index) => {
    const record = { _rowIndex: index };
    row.c.forEach((cell, cellIndex) => {
      const key = headers[cellIndex];
      if (!key) return;
      record[key] = cell?.f ?? cell?.v ?? '';
    });
    return normalizeEvent(record, index);
  });
}

async function fetchCsvRows(sheetId, gid) {
  const url = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/export?format=csv&gid=${encodeURIComponent(gid)}`;
  const response = await fetch(url, { cache: 'no-store' });

  if (!response.ok) {
    throw new Error('無法讀取 Google Sheet');
  }

  const rows = parseCsv(await response.text());
  const headers = (rows.shift() || []).map(normalizeHeader);

  return rows.map((row, index) => {
    const record = { _rowIndex: index };
    row.forEach((value, cellIndex) => {
      const key = headers[cellIndex];
      if (!key) return;
      record[key] = value;
    });
    return normalizeEvent(record, index);
  });
}

function normalizeHeader(header) {
  const trimmed = String(header).trim();
  return HEADER_ALIASES[trimmed] || trimmed;
}

function normalizeEvent(record, index) {
  return {
    timestamp_server: stringValue(record.timestamp_server),
    meeting_id: stringValue(record.meeting_id),
    event_type: stringValue(record.event_type),
    meeting_title: stringValue(record.meeting_title),
    meeting_description: stringValue(record.meeting_description),
    organizer_name: stringValue(record.organizer_name),
    start_date: stringValue(record.start_date),
    end_date: stringValue(record.end_date),
    start_time: stringValue(record.start_time),
    end_time: stringValue(record.end_time),
    slot_minutes: numberValue(record.slot_minutes, 60),
    include_saturday: booleanValue(record.include_saturday),
    include_sunday: booleanValue(record.include_sunday),
    response_deadline: stringValue(record.response_deadline),
    participant_name: stringValue(record.participant_name),
    participant_id: stringValue(record.participant_id),
    availability: parseAvailability(record.availability_json),
    availability_json: stringValue(record.availability_json),
    note: stringValue(record.note),
    selected_final_slot: stringValue(record.selected_final_slot),
    client_timestamp: stringValue(record.client_timestamp),
    extra_json: stringValue(record.extra_json),
    _rowIndex: index,
  };
}

function parseAvailability(value) {
  try {
    const parsed = JSON.parse(String(value || '[]'));
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => {
      if (typeof item === 'string') return item;
      if (item && item.date && item.start) return `${item.date}T${item.start}`;
      return '';
    }).filter(Boolean);
  } catch {
    return [];
  }
}

function stringValue(value) {
  return value == null ? '' : String(value).trim();
}

function numberValue(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function booleanValue(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === '是';
}

export function parseCsv(csv) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const next = csv[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(cell);
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
      cell = '';
      continue;
    }

    cell += char;
  }

  row.push(cell);
  if (row.some((value) => value !== '')) rows.push(row);
  return rows;
}
