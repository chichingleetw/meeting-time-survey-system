export const ORGANIZER_EVENTS = new Set([
  'meeting_create',
  'meeting_update',
  'survey_open',
  'survey_close',
  'final_time_set',
  'meeting_cancel',
  'meeting_reset',
]);

export const PARTICIPANT_EVENTS = new Set([
  'availability_submit',
  'availability_update',
  'availability_clear',
]);

export function reduceMeetingState(events, meetingId) {
  const meetingEvents = events
    .filter((event) => event.meeting_id === meetingId)
    .sort(compareEvents);

  const state = {
    meeting_id: meetingId,
    title: '',
    description: '',
    organizer_name: '',
    start_date: '',
    end_date: '',
    start_time: '10:00',
    end_time: '17:00',
    slot_minutes: 60,
    include_saturday: false,
    include_sunday: false,
    response_deadline: '',
    status: 'draft',
    selected_final_slot: '',
  };

  for (const event of meetingEvents) {
    if (!ORGANIZER_EVENTS.has(event.event_type)) continue;

    if (event.event_type === 'meeting_reset') {
      state.status = 'draft';
      state.selected_final_slot = '';
      continue;
    }

    if (event.event_type === 'meeting_create' || event.event_type === 'meeting_update' || event.event_type === 'survey_open') {
      if (event.meeting_title) state.title = event.meeting_title;
      if (event.meeting_description) state.description = event.meeting_description;
      if (event.organizer_name) state.organizer_name = event.organizer_name;
      if (event.start_date) state.start_date = event.start_date;
      if (event.end_date) state.end_date = event.end_date;
      if (event.start_time) state.start_time = event.start_time;
      if (event.end_time) state.end_time = event.end_time;
      if (event.slot_minutes) state.slot_minutes = event.slot_minutes;
      state.include_saturday = event.include_saturday;
      state.include_sunday = event.include_sunday;
      if (event.response_deadline) state.response_deadline = event.response_deadline;
      state.status = 'open';
    }
    if (event.event_type === 'survey_close') state.status = 'closed';
    if (event.event_type === 'meeting_cancel') state.status = 'cancelled';
    if (event.event_type === 'final_time_set') {
      state.status = 'finalized';
      state.selected_final_slot = event.selected_final_slot;
    }
  }

  return state;
}

export function reduceParticipantResponses(events, meetingId) {
  const latestByParticipant = new Map();

  events
    .filter((event) => event.meeting_id === meetingId && PARTICIPANT_EVENTS.has(event.event_type) && event.participant_id)
    .forEach((event) => {
      const current = latestByParticipant.get(event.participant_id);
      if (!current || compareEvents(event, current) >= 0) {
        latestByParticipant.set(event.participant_id, event);
      }
    });

  return Array.from(latestByParticipant.values())
    .filter((event) => event.event_type !== 'availability_clear')
    .map((event) => ({
      participant_id: event.participant_id,
      participant_name: event.participant_name || '未命名',
      availability: Array.from(new Set(event.availability || [])),
      note: event.note,
      submitted_at: event.client_timestamp || event.timestamp_server || '',
    }))
    .sort((a, b) => a.participant_name.localeCompare(b.participant_name, 'zh-Hant'));
}

export function buildSlotStatistics(slots, responses, finalSlot = '') {
  const total = responses.length;

  return slots.map((slot) => {
    const matched = responses.filter((response) => response.availability.includes(slot.key));
    const availableCount = matched.length;

    return {
      ...slot,
      slot_key: slot.key,
      available_count: availableCount,
      total_participants: total,
      available_rate: total === 0 ? 0 : Math.round((availableCount / total) * 100),
      participant_names: matched.map((response) => response.participant_name),
      is_all_available: total > 0 && availableCount === total,
      is_final_slot: slot.key === finalSlot,
    };
  });
}

export function getRecommendedSlots(statistics, limit = 3) {
  return [...statistics]
    .sort((a, b) => {
      if (b.available_count !== a.available_count) return b.available_count - a.available_count;
      if (b.available_rate !== a.available_rate) return b.available_rate - a.available_rate;
      return a.slot_key.localeCompare(b.slot_key);
    })
    .slice(0, limit);
}

export function compareEvents(a, b) {
  const aTime = parseEventTime(a);
  const bTime = parseEventTime(b);

  if (aTime !== bTime) return aTime - bTime;
  return (a._rowIndex || 0) - (b._rowIndex || 0);
}

function parseEventTime(event) {
  const client = Date.parse(event.client_timestamp);
  if (Number.isFinite(client)) return client;

  const server = Date.parse(normalizeGoogleTimestamp(event.timestamp_server));
  if (Number.isFinite(server)) return server;

  return 0;
}

function normalizeGoogleTimestamp(value) {
  if (!value) return '';
  return String(value)
    .replace(/上午\s*/, 'AM ')
    .replace(/下午\s*/, 'PM ')
    .replace(/\s+/g, ' ');
}
