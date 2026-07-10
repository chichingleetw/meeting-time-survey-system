const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

export function buildSlots(state) {
  if (!state.start_date || !state.end_date) return [];

  const dates = eachDate(state.start_date, state.end_date)
    .filter((date) => shouldIncludeDate(date, state.include_saturday, state.include_sunday));
  const timeStarts = buildTimeStarts(state.start_time || '10:00', state.end_time || '17:00', state.slot_minutes || 60);

  return dates.flatMap((date) => timeStarts.map((start) => {
    const end = addMinutes(start, state.slot_minutes || 60);
    const dateText = toDateKey(date);

    return {
      key: `${dateText}T${start}`,
      date: dateText,
      weekday: `星期${WEEKDAYS[date.getDay()]}`,
      start_time: start,
      end_time: end,
      label: `${formatMonthDay(date)} ${start}-${end}`,
    };
  }));
}

export function groupSlotsByDate(slots) {
  const groups = new Map();
  for (const slot of slots) {
    if (!groups.has(slot.date)) groups.set(slot.date, []);
    groups.get(slot.date).push(slot);
  }
  return Array.from(groups.entries()).map(([date, items]) => ({ date, slots: items }));
}

export function summarizeAvailability(keys, slots) {
  const selected = slots.filter((slot) => keys.includes(slot.key));
  const uniqueDates = new Set(selected.map((slot) => slot.date));

  return {
    dateCount: uniqueDates.size,
    slotCount: selected.length,
    firstSlot: selected[0]?.label || '',
    lastSlot: selected[selected.length - 1]?.label || '',
  };
}

export function formatSlotKey(slotKey, minutes = 60) {
  if (!slotKey) return '';
  const [date, start] = slotKey.split('T');
  return `${date} ${start}-${addMinutes(start, minutes)}`;
}

export function isPastDeadline(deadline) {
  if (!deadline) return false;
  const time = Date.parse(deadline);
  return Number.isFinite(time) && Date.now() > time;
}

function eachDate(startDate, endDate) {
  const dates = [];
  const current = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);

  if (!current || !end || current > end) return dates;

  while (current <= end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

function shouldIncludeDate(date, includeSaturday, includeSunday) {
  if (date.getDay() === 6 && !includeSaturday) return false;
  if (date.getDay() === 0 && !includeSunday) return false;
  return true;
}

function buildTimeStarts(startTime, endTime, minutes) {
  const starts = [];
  let cursor = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);

  while (cursor + minutes <= end) {
    starts.push(minutesToTime(cursor));
    cursor += minutes;
  }

  return starts;
}

function addMinutes(time, amount) {
  return minutesToTime(timeToMinutes(time) + amount);
}

function timeToMinutes(time) {
  const [hours, minutes] = String(time || '00:00').split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

function minutesToTime(total) {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function parseLocalDate(value) {
  const [year, month, day] = String(value || '').split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function toDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatMonthDay(date) {
  return `${date.getMonth() + 1}/${date.getDate()}（${WEEKDAYS[date.getDay()]}）`;
}
