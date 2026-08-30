# DiaCompanion SMS Gateway Service

Standalone FastAPI service used between the main DiaCompanion backend and the Android SMS Gateway APK.

It intentionally runs as a separate service, similar to an AI microservice:

```text
DiaCompanion Main Backend
        |
        | POST /api/sms/enqueue
        v
SMS Gateway Service (FastAPI + SQLite)
        ^
        | GET /api/gateway/pending
        | POST /api/gateway/{id}/result
        |
Android Gateway APK -> SIM -> SMS
```

## 1. Configure

Copy:

```text
.env.example -> .env
```

Set strong random keys:

```env
SMS_GATEWAY_KEY=phone-app-secret
MAIN_BACKEND_KEY=main-backend-secret
```

For a capstone demo, lock recipients:

```env
ALLOWED_RECIPIENTS=+84335571221,+84901234567
```

Leaving it empty allows any Vietnam number, which is not recommended.

## 2. Run on Windows

Double click:

```text
run.bat
```

or PowerShell:

```powershell
./run.ps1
```

Default URL:

```text
http://0.0.0.0:8091
```

From another device use the laptop LAN IP, for example:

```text
http://192.168.1.10:8091
```

## 3. Health test

```cmd
curl.exe http://127.0.0.1:8091/health
```

## 4. Enqueue one OTP SMS

```cmd
curl.exe -X POST "http://127.0.0.1:8091/api/sms/enqueue" -H "Content-Type: application/json" -H "X-MAIN-BACKEND-KEY: change-this-main-backend-key" -d "{\"phoneNumber\":\"0335571221\",\"message\":\"DiaCompanion: Ma OTP cua ban la 123456. Ma co hieu luc trong 5 phut.\",\"source\":\"manual-test\"}"
```

The service normalizes `033...` into `+8433...`.

## 5. Android polling

The APK calls:

```text
GET /api/gateway/pending
X-SMS-GATEWAY-KEY: <SMS_GATEWAY_KEY>
```

A picked message is leased for `LEASE_SECONDS`. If the phone/app dies before reporting a result, the job becomes eligible again after the lease expires.

After Android receives a telephony send result it calls:

```text
POST /api/gateway/{id}/result
```

## 6. Query status from main backend

```cmd
curl.exe "http://127.0.0.1:8091/api/sms/<SMS_ID>" -H "X-MAIN-BACKEND-KEY: change-this-main-backend-key"
```

## Safety defaults

- `ALLOWED_RECIPIENTS` can restrict all recipients.
- Global queue rate limit defaults to 5 SMS/minute.
- Gateway and main backend use different API keys.
- SQLite persists the queue.
- No internet exposure is needed for a LAN capstone demo.
