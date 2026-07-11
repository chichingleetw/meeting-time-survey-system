# 會議時間調查系統

![會議時間調查系統介紹](./Intro.png)

直接使用：https://chichingleetw.github.io/meeting-time-survey-system/

這是一個可部署在 GitHub Pages 的會議時間調查工具。系統不需要自有後端、不使用 Google Apps Script，也不要求 Google OAuth；資料透過 Google Form 寫入，並從公開檢視權限的 Google Sheet 讀取 event log 來還原會議設定、參加者回覆與統計結果。

## 功能

安排多人會議時間，常常比想像中麻煩。使用一般線上調查工具，可能會遇到廣告或功能限制；使用 LINE 投票，又需要逐一建立每個日期與時段，而且並非所有與會者都互加 LINE，後續整理結果也不方便。
這套完全開源、無廣告的會議時間調查系統，讓發起人可以快速建立可選時段，並透過網址或 QR Code 分享給與會者，輕鬆彙整大家可以參加的時間。
所有調查資料都只會儲存在發起人自己的 Google Sheet 中，不會另外上傳到其他伺服器，使用上更安心。您可以直接使用我們分享的線上版本，也可以將完整程式碼複製到自己的 GitHub 帳號，自行部署、修改與擴充；無論直接使用或二次開發，都非常歡迎。

1. 發起人設定日期區間。
2. 系統自動產生每天七個一小時時段。
3. 與會者可一次勾選多個時段。
4. 同一參加者再次填寫時，以最新回覆為準。
5. 結果頁自動計算全員可行及最多人可行的時間。
6. 不使用登入與後端，因此需清楚提示公開資料與身份辨識限制。

## 頁面

```text
index.html    Google Form / Google Sheet 中繼資料設定
create.html   建立會議調查
respond.html  參加者填寫可參加時間
results.html  發起人查看統計與設定最終時間
```

## Google Form 欄位

請建立 Google Form，欄位建議全部使用簡答或段落，並依照下列欄位名稱設定：

```text
meeting_id
event_type
meeting_title
meeting_description
organizer_name
start_date
end_date
start_time
end_time
slot_minutes
include_saturday
include_sunday
response_deadline
participant_name
participant_id
availability_json
note
selected_final_slot
client_timestamp
extra_json
```

建立表單後，將回應連結到 Google Sheet，並把 Sheet 權限設為「知道連結的人可以檢視」。

## 使用方式

1. 打開 `index.html`。
2. 輸入 Google Sheet ID、Sheet 名稱或 gid、Google Form submit URL。
3. 在 Google Form 使用「取得預填連結」，每題填入對應欄位名稱，貼回首頁自動帶入 entry ID。
4. 儲存設定後進入 `create.html` 建立調查。
5. 分享產生的 `respond.html` 連結或 QR Code 給參加者。
6. 使用 `results.html` 查看統計與設定最終時間。

## 本機預覽

```bash
python3 -m http.server 8080
```

然後開啟：

```text
http://localhost:8080/
```

## 重要限制

- 這是公開匿名工具，請勿收集敏感個資。
- Google Sheet 設為公開檢視後，知道連結的人可能讀取資料。
- Google Form URL 若外流，可能被他人送出資料。
- `no-cors` 寫入無法由前端確認 Google Form 是否真的接收成功，需等待 Sheet 同步判斷。

## 授權

MIT License
