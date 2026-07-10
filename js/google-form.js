import { FIELD_KEYS } from './config.js';

export async function submitMeetingEvent(config, event) {
  const formData = new FormData();
  const fullEvent = {
    meeting_id: config.meetingId,
    event_type: '',
    meeting_title: '',
    meeting_description: '',
    organizer_name: '',
    start_date: '',
    end_date: '',
    start_time: '',
    end_time: '',
    slot_minutes: '',
    include_saturday: '',
    include_sunday: '',
    response_deadline: '',
    participant_name: '',
    participant_id: '',
    availability_json: '',
    note: '',
    selected_final_slot: '',
    client_timestamp: new Date().toISOString(),
    extra_json: '{}',
    ...event,
  };

  for (const key of FIELD_KEYS) {
    const entryId = config.fields[key];
    if (!entryId) continue;
    formData.append(entryId, stringifyValue(fullEvent[key]));
  }

  await fetch(config.formUrl, {
    method: 'POST',
    mode: 'no-cors',
    body: formData,
  });
}

function stringifyValue(value) {
  if (Array.isArray(value) || (value && typeof value === 'object')) {
    return JSON.stringify(value);
  }
  if (value == null) return '';
  return String(value);
}
