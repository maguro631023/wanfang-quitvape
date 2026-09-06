# Capacitor 打包與通知設定

從單檔 HTML 到可上架的 Android App Bundle。

## 0. 前置需求

- Node.js 20 以上
- JDK 21
- Android Studio（含 Android SDK Platform 36）

## 1. 建立專案

```bash
mkdir quit-vape-app && cd quit-vape-app
npm init -y
npm i @capacitor/core @capacitor/cli @capacitor/app @capacitor/local-notifications

mkdir www
cp ../quit-vape-tw.html www/index.html          # 檔名必須是 index.html
cp ../capacitor.config.json .                    # appId 已設為 tw.gov.wanfang.quitvape

npx cap add android
npx cap sync
```

`appId` 取自萬芳醫院網域 `wanfang.gov.tw` 的反向寫法。這個值一旦上架就永久固定，改動等同新上架一個 app。若最後決定改掛北醫的開發者帳號發布，要在 `npx cap add android` 之前改掉，之後再改就得重建 android 目錄。

## 2. 設定 targetSdk

編輯 `android/variables.gradle`：

```gradle
ext {
    minSdkVersion = 26
    compileSdkVersion = 36
    targetSdkVersion = 36
}
```

Play 從 2026-08-31 起要求新上架與更新都要 target API 36。minSdk 設 26 是為了直接使用系統原生的通知頻道，涵蓋率也還夠。

## 3. AndroidManifest 權限

編輯 `android/app/src/main/AndroidManifest.xml`，在 `<manifest>` 底下加入：

```xml
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
```

`POST_NOTIFICATIONS` 是 Android 13 以上發送通知的必要權限，程式會在使用者按下「開啟每日提醒」時才要求，不在啟動時要。`RECEIVE_BOOT_COMPLETED` 讓外掛內建的開機還原機制生效。

### 不要加的兩個權限

```xml
<!-- 不要加這兩行 -->
<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />
<uses-permission android:name="android.permission.USE_EXACT_ALARM" />
```

沒有這兩者，排程會是 inexact，實際送達可能有幾分鐘誤差——對每日衛教提醒完全夠用。加了它們的代價是：`USE_EXACT_ALARM` 在 Play 的政策上僅開放給鬧鐘、行事曆、計時器這類「精準時間是核心功能」的 app，戒菸提醒申報這個權限很可能在審查時被質疑或退件。程式碼裡的 `allowWhileIdle: false` 就是配合這個決定。

## 4. 通知小圖示

Android 的狀態列圖示只吃單色去背 PNG，直接用 App icon 會變成一團白塊。用 Android Studio 的 Image Asset（Notification Icons）產生 `ic_stat_breathe`，放進 `android/app/src/main/res/drawable-*`。名稱要跟 `capacitor.config.json` 裡的 `smallIcon` 一致。

## 5. 建置與執行

```bash
npx cap sync          # 每次改完 www/index.html 都要跑
npx cap open android  # 在 Android Studio 中執行
```

## 6. 測試檢查表

通知在 Android 上最容易在這些地方壞掉，實機逐項確認：

- [ ] 首次按「開啟每日提醒」會跳出系統權限對話框
- [ ] 拒絕權限後，狀態文字有正確反映，程式不會當掉
- [ ] 開啟後回到「我的」，顯示「已排入 N 則提醒」
- [ ] 改戒菸日再存檔 → 舊排程被清掉、N 值重新計算
- [ ] 切換提醒時間 → 隔天的通知在新時間送達
- [ ] 低調模式開啟 → 通知只顯示「今天有一則訊息」
- [ ] **手機重開機後，排程還在**（`adb shell dumpsys alarm | grep <appId>`）
- [ ] **省電／勿擾模式下仍會送達**，延遲在可接受範圍
- [ ] 手動把系統日期往後調一天，確認當天訊息與 app 內顯示的是同一則
- [ ] 出國情境：改時區後回到前景，排程有重算

最後兩項是最常被漏掉的。程式在 `appStateChange` 時會重排一次，就是為了這個。

## 7. 產出 AAB

```bash
keytool -genkey -v -keystore quitvape-upload.jks \
        -keyalg RSA -keysize 2048 -validity 10000 -alias upload
```

keystore 與密碼要離線備份，遺失就無法更新已上架的 app。之後在 Android Studio 用 Build → Generate Signed App Bundle 產出 `.aab`，或設定 `android/app/build.gradle` 的 `signingConfigs` 後跑 `./gradlew bundleRelease`。

正式簽章交給 Play App Signing 管理，你保管的是 upload key。

## 8. 已知限制

- **通知只在安裝版運作**。用瀏覽器開 `www/index.html` 時整段排程會靜默略過，其餘功能正常，方便開發時快速迭代。
- **排程筆數**：戒菸日前 6 週到後 8 週共 99 天，加上 8 則追蹤提醒，上限約 107 筆，遠低於 Android 每個 app 的待處理鬧鐘數量限制。程式仍以每批 50 筆送出。
- **訊息內容在排程當下就固定**。若日後改寫訊息庫，已排入的通知不會自動更新，需要使用者回到程式觸發重排。要避免這點的話，可以改成只推「今天有一則訊息」、內容一律在 app 內讀取——這也正是低調模式的行為。
- **iOS 尚未處理**。`npx cap add ios` 後大致可用，但通知權限流程、以及 App Store 對未成年健康類 app 的審查標準都不同，要另外評估。

## 9. 與預期用途的關係

通知內容取自共用的固定訊息庫，依日期偏移量選取，不依使用者的健康狀態產生或調整——這與 `INTENDED_USE.md` 第 4 節第 1 項的描述一致。若日後要讓通知內容隨自我檢視結果或紀錄內容變化，那會落入第 5 節的排除事項，須先重新評估法規定位。

低調模式的存在也不只是體驗設計：使用者的電子煙使用在我國屬違法行為，鎖定畫面上的通知可能被他人看見，因此保留一個不外露內容的選項。
