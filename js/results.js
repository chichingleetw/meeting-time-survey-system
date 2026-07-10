import { buildConfigFromParams } from './config.js';
import { fetchSheetEvents } from './google-sheet.js';
import { submitMeetingEvent } from './google-form.js';
import { buildSlots, formatSlotKey, groupSlotsByDate } from './calendar.js';
import { buildSlotStatistics, getRecommendedSlots, reduceMeetingState, reduceParticipantResponses } from './meeting-store.js';
import { renderQr } from './qr.js';

const configResult = buildConfigFromParams();
const configError = document.querySelector('#config-error');
const app = document.querySelector('#results-app');
const info = document.querySelector('#result-info');
const statsGrid = document.querySelector('#stats-grid');
const participantTable = document.querySelector('#participant-table tbody');
const recommendations = document.querySelector('#recommendations');
const finalPanel = document.querySelector('#final-panel');
const status = document.querySelector('#sync-status');
const refreshButton = document.querySelector('#refresh-results');
const qrCode = document.querySelector('#qr-code');
const participantLink = document.querySelector('#participant-link');

let config;
let meeting;
let responses = [];
let statistics = [];

if (!configResult.ok) {
  configError.classList.remove('hidden');
} else {
  config = configResult.config;
  app.classList.remove('hidden');
  loadResults();
  setInterval(loadResults, 5000);
}

refreshButton?.addEventListener('click', loadResults);

statsGrid?.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-final-slot]');
  if (!button) return;
  const slotKey = button.dataset.finalSlot;
  status.textContent = '正在寫入 final_time_set 事件...';

  try {
    await submitMeetingEvent(config, {
      event_type: 'final_time_set',
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
      selected_final_slot: slotKey,
    });
    status.textContent = '最終時間已送出，等待 Google Sheet 同步。';
    setTimeout(loadResults, 1200);
  } catch (error) {
    status.textContent = error.message || '寫入最終時間失敗。';
  }
});

async function loadResults() {
  status.textContent = '同步中...';

  try {
    const events = await fetchSheetEvents(config);
    meeting = reduceMeetingState(events, config.meetingId);
    responses = reduceParticipantResponses(events, config.meetingId);
    const slots = buildSlots(meeting);
    statistics = buildSlotStatistics(slots, responses, meeting.selected_final_slot);
    renderAll();
    status.textContent = `最後同步：${new Date().toLocaleTimeString('zh-TW')}`;
  } catch (error) {
    status.textContent = error.message || '同步失敗。';
  }
}

function renderAll() {
  renderInfo();
  renderStats();
  renderParticipants();
  renderRecommendations();
  renderFinal();
}

function renderInfo() {
  const respondUrl = new URL('./respond.html', window.location.href);
  respondUrl.search = window.location.search;
  participantLink.value = respondUrl.toString();
  renderQr(qrCode, respondUrl.toString());

  info.innerHTML = `
    <h1>${escapeHtml(meeting.title || '未命名會議')}</h1>
    <dl>
      <div><dt>meeting_id</dt><dd>${escapeHtml(config.meetingId)}</dd></div>
      <div><dt>日期</dt><dd>${escapeHtml(meeting.start_date)} 至 ${escapeHtml(meeting.end_date)}</dd></div>
      <div><dt>回覆人數</dt><dd>${responses.length}</dd></div>
      <div><dt>截止</dt><dd>${escapeHtml(meeting.response_deadline || '未設定')}</dd></div>
    </dl>
  `;
}

function renderStats() {
  const groups = groupSlotsByDate(statistics);
  statsGrid.innerHTML = groups.map((group) => `
    <section class="day-card">
      <h3>${group.date} <span>${group.slots[0].weekday}</span></h3>
      <div class="slot-list vertical">
        ${group.slots.map((slot) => renderStatSlot(slot)).join('')}
      </div>
    </section>
  `).join('');
}

function renderStatSlot(slot) {
  const intensity = slot.total_participants === 0 ? 0 : slot.available_count / slot.total_participants;
  const names = slot.participant_names.length ? slot.participant_names.join('、') : '無';
  const style = `--heat:${intensity.toFixed(2)}`;

  return `
    <article class="stat-slot ${slot.is_all_available ? 'all-available' : ''} ${slot.is_final_slot ? 'final' : ''}" style="${style}">
      <div>
        <strong>${slot.start_time}-${slot.end_time}</strong>
        <span>${slot.available_count}/${slot.total_participants} 人，${slot.available_rate}%</span>
        <small>${escapeHtml(names)}</small>
      </div>
      <button class="ghost-btn small-btn" type="button" data-final-slot="${slot.slot_key}">設為最終</button>
    </article>
  `;
}

function renderParticipants() {
  participantTable.innerHTML = responses.map((response) => `
    <tr>
      <td>${escapeHtml(response.participant_name)}</td>
      <td>${response.availability.length}</td>
      <td>${escapeHtml(response.submitted_at || '-')}</td>
      <td>${escapeHtml(response.note || '')}</td>
    </tr>
  `).join('');
}

function renderRecommendations() {
  const items = getRecommendedSlots(statistics, 3);
  recommendations.innerHTML = items.map((slot, index) => `
    <li>
      <strong>推薦 ${index + 1}</strong>
      <span>${escapeHtml(formatSlotKey(slot.slot_key, meeting.slot_minutes))}</span>
      <em>${slot.available_count}/${slot.total_participants} 人可參加</em>
    </li>
  `).join('');
}

function renderFinal() {
  if (!meeting.selected_final_slot) {
    finalPanel.innerHTML = '<p class="empty-text">尚未設定最終會議時間。</p>';
    return;
  }

  const slot = statistics.find((item) => item.slot_key === meeting.selected_final_slot);
  const unavailable = responses
    .filter((response) => !response.availability.includes(meeting.selected_final_slot))
    .map((response) => response.participant_name);

  finalPanel.innerHTML = `
    <h3>${escapeHtml(formatSlotKey(meeting.selected_final_slot, meeting.slot_minutes))}</h3>
    <p>${slot?.available_count || 0}/${responses.length} 人可參加</p>
    <textarea readonly rows="3">會議時間已確定為 ${formatSlotKey(meeting.selected_final_slot, meeting.slot_minutes)}。</textarea>
    <p class="muted-text">無法參加：${escapeHtml(unavailable.join('、') || '無')}</p>
  `;
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
