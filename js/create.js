import { buildConfigFromParams, buildSharedParams, buildUrl, generateId } from './config.js';
import { submitMeetingEvent } from './google-form.js';
import { buildSlots, groupSlotsByDate } from './calendar.js';
import { renderQr } from './qr.js';

const configResult = buildConfigFromParams();
const configError = document.querySelector('#config-error');
const app = document.querySelector('#create-app');
const form = document.querySelector('#meeting-form');
const preview = document.querySelector('#slot-preview');
const resultPanel = document.querySelector('#created-panel');
const respondLink = document.querySelector('#respond-link');
const resultsLink = document.querySelector('#results-link');
const meetingIdOutput = document.querySelector('#meeting-id-output');
const qrCode = document.querySelector('#qr-code');
const createStatus = document.querySelector('#create-status');
const copyButtons = document.querySelectorAll('[data-copy-target]');

let meetingId = generateId('meeting');

if (!configResult.ok) {
  configError.classList.remove('hidden');
} else {
  app.classList.remove('hidden');
  form.elements.namedItem('start_time').value = '10:00';
  form.elements.namedItem('end_time').value = '17:00';
  form.elements.namedItem('slot_minutes').value = '60';
  form.elements.namedItem('include_saturday').checked = false;
  form.elements.namedItem('include_sunday').checked = false;
  renderPreview();
}

form?.addEventListener('input', renderPreview);

form?.addEventListener('reset', () => {
  setTimeout(renderPreview, 0);
});

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const config = configResult.config;
  config.meetingId = meetingId;
  const meeting = readMeetingForm();

  createStatus.textContent = '正在寫入 meeting_create 事件...';

  try {
    await submitMeetingEvent(config, {
      event_type: 'meeting_create',
      ...meeting,
      include_saturday: String(meeting.include_saturday),
      include_sunday: String(meeting.include_sunday),
    });

    const shared = buildSharedParams(config);
    const respondUrl = buildUrl('./respond.html', shared);
    const resultsUrl = buildUrl('./results.html', shared);
    meetingIdOutput.value = meetingId;
    respondLink.value = respondUrl;
    resultsLink.value = resultsUrl;
    renderQr(qrCode, respondUrl);
    resultPanel.classList.remove('hidden');
    createStatus.textContent = '調查已建立。Google Sheet 同步可能需要幾秒鐘。';
    meetingId = generateId('meeting');
  } catch (error) {
    createStatus.textContent = error.message || '寫入失敗，請確認 Google Form URL 與 entry ID。';
  }
});

copyButtons.forEach((button) => {
  button.addEventListener('click', async () => {
    const target = document.querySelector(button.dataset.copyTarget);
    if (!target?.value) return;
    await navigator.clipboard.writeText(target.value);
    createStatus.textContent = '已複製。';
  });
});

function renderPreview() {
  const slots = buildSlots(readMeetingForm());
  const groups = groupSlotsByDate(slots);

  if (groups.length === 0) {
    preview.innerHTML = '<p class="empty-text">請選擇有效日期區間。</p>';
    return;
  }

  preview.innerHTML = groups.map((group) => `
    <article class="day-card">
      <h3>${group.date} <span>${group.slots[0].weekday}</span></h3>
      <div class="slot-list">
        ${group.slots.map((slot) => `<span class="slot-chip">${slot.start_time}-${slot.end_time}</span>`).join('')}
      </div>
    </article>
  `).join('');
}

function readMeetingForm() {
  const data = new FormData(form);
  return {
    meeting_title: clean(data.get('meeting_title')),
    meeting_description: clean(data.get('meeting_description')),
    organizer_name: clean(data.get('organizer_name')),
    start_date: clean(data.get('start_date')),
    end_date: clean(data.get('end_date')),
    start_time: clean(data.get('start_time')) || '10:00',
    end_time: clean(data.get('end_time')) || '17:00',
    slot_minutes: clean(data.get('slot_minutes')) || '60',
    include_saturday: data.get('include_saturday') === 'on',
    include_sunday: data.get('include_sunday') === 'on',
    response_deadline: clean(data.get('response_deadline')),
    extra_json: '{}',
  };
}

function clean(value) {
  return String(value || '').trim();
}
