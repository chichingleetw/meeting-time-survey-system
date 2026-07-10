import { FIELD_KEYS, REQUIRED_FIELD_KEYS, buildSharedParams, buildUrl, generateId, normalizeFormUrl, parsePrefillUrl, readBaseSettings, saveBaseSettings } from './config.js';
import { fetchSheetEvents } from './google-sheet.js';

const form = document.querySelector('#setup-form');
const prefillUrl = document.querySelector('#prefill-url');
const parsePrefillButton = document.querySelector('#parse-prefill');
const markerButton = document.querySelector('#show-markers');
const status = document.querySelector('#setup-status');
const createLink = document.querySelector('#create-link');
const resultsForm = document.querySelector('#open-existing-form');
const testSheetButton = document.querySelector('#test-sheet');

hydrateSettings();

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const values = readFormValues();
  saveBaseSettings(values);
  const url = buildUrl('./create.html', buildSharedParams({ ...values, meeting_id: generateId('meeting') }));
  createLink.href = url;
  createLink.classList.remove('disabled');
  status.textContent = '設定已儲存，可以建立新的會議調查。';
});

resultsForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const settings = readFormValues();
  const meetingId = new FormData(resultsForm).get('existing_meeting_id');
  const url = buildUrl('./results.html', buildSharedParams({ ...settings, meeting_id: meetingId }));
  window.location.href = url;
});

parsePrefillButton.addEventListener('click', () => {
  const result = parsePrefillUrl(prefillUrl.value);

  for (const [key, entryId] of Object.entries(result.fields)) {
    const input = form.elements.namedItem(`field_${key}`);
    if (input) input.value = entryId;
  }

  if (result.formUrl && !form.elements.namedItem('form_url').value.trim()) {
    form.elements.namedItem('form_url').value = result.formUrl;
  }

  if (result.missing.length === 0) {
    status.textContent = '已自動帶入全部 entry ID。';
  } else {
    status.textContent = `已帶入 ${Object.keys(result.fields).length} 個欄位，尚缺：${result.missing.join('、')}。`;
  }
});

markerButton.addEventListener('click', () => {
  prefillUrl.value = FIELD_KEYS.join('\n');
  status.textContent = '請在 Google Form 預填連結頁依序填入這些欄位名稱，再把產生的預填連結貼回來。';
});

testSheetButton.addEventListener('click', async () => {
  const values = readFormValues();
  status.textContent = '正在測試 Google Sheet 讀取...';

  try {
    const events = await fetchSheetEvents({
      sheetId: values.sheet_id,
      sheetName: values.sheet_name,
      gid: values.gid,
    });
    status.textContent = `Google Sheet 可讀取，目前讀到 ${events.length} 筆事件。`;
  } catch (error) {
    status.textContent = error.message || 'Google Sheet 讀取失敗，請確認公開權限與 Sheet ID。';
  }
});

function hydrateSettings() {
  const settings = readBaseSettings();
  for (const [key, value] of Object.entries(settings)) {
    const input = form.elements.namedItem(key);
    if (input) input.value = value;
  }
}

function readFormValues() {
  const formData = new FormData(form);
  const values = {
    sheet_id: clean(formData.get('sheet_id')),
    sheet_name: clean(formData.get('sheet_name')),
    gid: clean(formData.get('gid')),
    form_url: normalizeFormUrl(clean(formData.get('form_url'))),
  };

  for (const key of FIELD_KEYS) {
    values[`field_${key}`] = clean(formData.get(`field_${key}`));
  }

  for (const key of REQUIRED_FIELD_KEYS) {
    const input = form.elements.namedItem(`field_${key}`);
    if (input && !input.value.trim()) input.setCustomValidity('必填');
    if (input && input.value.trim()) input.setCustomValidity('');
  }

  return values;
}

function clean(value) {
  return String(value || '').trim();
}
