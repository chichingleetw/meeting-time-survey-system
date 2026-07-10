import { buildConfigFromParams, generateId } from './config.js';
import { fetchSheetEvents } from './google-sheet.js';
import { submitMeetingEvent } from './google-form.js';
import { buildSlots, groupSlotsByDate, isPastDeadline, summarizeAvailability } from './calendar.js';
import { reduceMeetingState } from './meeting-store.js';

const configResult = buildConfigFromParams();
const configError = document.querySelector('#config-error');
const app = document.querySelector('#respond-app');
const info = document.querySelector('#meeting-info');
const form = document.querySelector('#response-form');
const slotGrid = document.querySelector('#slot-grid');
const summary = document.querySelector('#selection-summary');
const status = document.querySelector('#response-status');
const quickButtons = document.querySelectorAll('[data-quick]');

let config;
let meeting;
let slots = [];
let selected = new Set();
let participantId = localStorage.getItem('meetingSchedulerParticipantId');

if (!participantId) {
  participantId = generateId('person');
  localStorage.setItem('meetingSchedulerParticipantId', participantId);
}

if (!configResult.ok) {
  configError.classList.remove('hidden');
} else {
  config = configResult.config;
  app.classList.remove('hidden');
  loadMeeting();
}

form?.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (isPastDeadline(meeting.response_deadline)) {
    status.textContent = '已超過回覆截止時間，無法送出。';
    return;
  }

  const data = new FormData(form);
  const participantName = clean(data.get('participant_name'));
  const note = clean(data.get('note'));

  if (!participantName) {
    status.textContent = '請先輸入姓名。';
    return;
  }

  status.textContent = '正在送出回覆...';

  try {
    await submitMeetingEvent(config, {
      event_type: 'availability_submit',
      meeting_title: meeting.title,
      meeting_description: meeting.description,
      organizer_name: meeting.organizer_name,
      start_date: meeting.start_date,
      end_date: meeting.end_date,
      start_time: meeting.start_time,
      end_time: meeting.end_time,
      slot_minutes: String(meeting.slot_minutes),
      include_saturday: String(meeting.include_saturday),
      include_sunday: String(meeting.include_sunday),
      response_deadline: meeting.response_deadline,
      participant_name: participantName,
      participant_id: participantId,
      availability_json: JSON.stringify(Array.from(selected).sort()),
      note,
    });
    localStorage.setItem(`meetingSchedulerDraft:${config.meetingId}`, JSON.stringify({
      participantName,
      note,
      availability: Array.from(selected),
    }));
    status.textContent = `回覆已送出：${participantName}，已選擇 ${selected.size} 個時段。`;
  } catch (error) {
    status.textContent = error.message || '送出失敗，請稍後再試。';
  }
});

quickButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const action = button.dataset.quick;
    if (action === 'all') selected = new Set(slots.map((slot) => slot.key));
    if (action === 'clear') selected.clear();
    if (action === 'weekdays') selected = new Set(slots.filter((slot) => {
      const day = new Date(`${slot.date}T00:00:00`).getDay();
      return day !== 0 && day !== 6;
    }).map((slot) => slot.key));
    renderSlots();
  });
});

async function loadMeeting() {
  status.textContent = '正在讀取會議設定...';

  try {
    const events = await fetchSheetEvents(config);
    meeting = reduceMeetingState(events, config.meetingId);
    slots = buildSlots(meeting);
    restoreDraft();
    renderInfo();
    renderSlots();
    status.textContent = '會議設定已載入。';
  } catch (error) {
    status.textContent = error.message || '無法載入會議設定。';
  }
}

function restoreDraft() {
  try {
    const draft = JSON.parse(localStorage.getItem(`meetingSchedulerDraft:${config.meetingId}`) || '{}');
    if (draft.participantName) form.elements.namedItem('participant_name').value = draft.participantName;
    if (draft.note) form.elements.namedItem('note').value = draft.note;
    selected = new Set((draft.availability || []).filter((key) => slots.some((slot) => slot.key === key)));
  } catch {
    selected = new Set();
  }
}

function renderInfo() {
  info.innerHTML = `
    <h1>${escapeHtml(meeting.title || '未命名會議')}</h1>
    <dl>
      <div><dt>發起人</dt><dd>${escapeHtml(meeting.organizer_name || '未填')}</dd></div>
      <div><dt>日期</dt><dd>${escapeHtml(meeting.start_date)} 至 ${escapeHtml(meeting.end_date)}</dd></div>
      <div><dt>截止</dt><dd>${escapeHtml(meeting.response_deadline || '未設定')}</dd></div>
      <div><dt>狀態</dt><dd>${escapeHtml(statusLabel(meeting.status))}</dd></div>
    </dl>
    ${meeting.description ? `<p>${escapeHtml(meeting.description)}</p>` : ''}
  `;

  if (meeting.status === 'closed' || meeting.status === 'cancelled' || isPastDeadline(meeting.response_deadline)) {
    form.querySelector('button[type="submit"]').disabled = true;
  }
}

function renderSlots() {
  const groups = groupSlotsByDate(slots);
  slotGrid.innerHTML = groups.map((group) => `
    <section class="day-card">
      <h3>${group.date} <span>${group.slots[0].weekday}</span></h3>
      <div class="slot-list">
        ${group.slots.map((slot) => `
          <button class="slot-button ${selected.has(slot.key) ? 'selected' : ''}" type="button" data-slot="${slot.key}">
            ${slot.start_time}-${slot.end_time}
          </button>
        `).join('')}
      </div>
    </section>
  `).join('');

  slotGrid.querySelectorAll('[data-slot]').forEach((button) => {
    button.addEventListener('click', () => {
      const key = button.dataset.slot;
      if (selected.has(key)) selected.delete(key);
      else selected.add(key);
      renderSlots();
    });
  });

  renderSummary();
}

function renderSummary() {
  const data = summarizeAvailability(Array.from(selected), slots);
  summary.innerHTML = `
    <span>已選日期：${data.dateCount}</span>
    <span>已選時段：${data.slotCount}</span>
    <span>最早：${data.firstSlot || '-'}</span>
    <span>最晚：${data.lastSlot || '-'}</span>
  `;
}

function statusLabel(value) {
  return {
    draft: '草稿',
    open: '開放填寫',
    closed: '已關閉',
    finalized: '已定案',
    cancelled: '已取消',
  }[value] || value;
}

function clean(value) {
  return String(value || '').trim();
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }[char]));
}
