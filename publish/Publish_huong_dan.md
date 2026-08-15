Được, giờ publish lại **Backend + Web Frontend** theo đúng cấu hình hiện tại của bạn.

Backend:

```text
Source:   G:\DiaCompanion\Backend\DiaCompanion
Publish:  G:\DiaCompanion\publish\backend
URL:      http://192.168.1.5:8080
```

Frontend:

```text
Source:   G:\DiaCompanion\Frontend
Publish:  G:\DiaCompanion\publish\web
URL:      http://192.168.1.5:8081
```

## 1. Publish Backend

Dừng IIS trước để tránh `w3wp.exe` lock `DiaCompanion.dll`:

```cmd
iisreset /stop
```

Build backend:

```cmd
cd /d G:\DiaCompanion\Backend\DiaCompanion
dotnet build -c Release
```

Nếu `Build succeeded`, publish:

```cmd
dotnet publish -c Release -o "G:\DiaCompanion\publish\backend"
```

Sau publish, **`web.config` sẽ có khả năng bị reset**, nên mở:

```text
G:\DiaCompanion\publish\backend\web.config
```

và thay bằng:

```xml
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <location path="." inheritInChildApplications="false">
    <system.webServer>

      <handlers>
        <add
          name="aspNetCore"
          path="*"
          verb="*"
          modules="AspNetCoreModuleV2"
          resourceType="Unspecified" />
      </handlers>

      <aspNetCore
        processPath="dotnet"
        arguments=".\DiaCompanion.dll"
        stdoutLogEnabled="true"
        stdoutLogFile=".\logs\stdout"
        hostingModel="inprocess">

        <environmentVariables>

          <environmentVariable
            name="ASPNETCORE_ENVIRONMENT"
            value="Production" />

          <environmentVariable
            name="Storage__FundusRoot"
            value="G:\DiaCompanion\storage\fundus" />

          <environmentVariable
            name="Storage__AiMasksRoot"
            value="G:\DiaCompanion\storage\ai_masks" />

          <environmentVariable
            name="AiService__BaseUrl"
            value="http://127.0.0.1:8000" />

          <environmentVariable
            name="SmsGateway__BaseUrl"
            value="http://127.0.0.1:8091/" />

          <environmentVariable
            name="SmsGateway__ApiKey"
            value="YOUR_MAIN_BACKEND_KEY" />

          <environmentVariable
            name="SmsGateway__TimeoutSeconds"
            value="10" />

          <environmentVariable
            name="JWT__SIGNINGKEY"
            value="YOUR_REAL_JWT_SECRET" />

        </environmentVariables>

      </aspNetCore>

    </system.webServer>
  </location>
</configuration>
```

Bạn thay đúng 2 giá trị:

```text
YOUR_MAIN_BACKEND_KEY
YOUR_REAL_JWT_SECRET
```

Không gửi secret thật cho mình.

Nếu chưa có folder log:

```cmd
mkdir G:\DiaCompanion\publish\backend\logs
```

---

## 2. Build Frontend

Trước tiên kiểm tra:

```text
G:\DiaCompanion\Frontend\public\config.js
```

phải là:

```js
window.__DIACOMPANION_API__ = "http://192.168.1.5:8080";
```

Sau đó:

```cmd
cd /d G:\DiaCompanion\Frontend
```

Nếu `dist` cũ bị khóa:

```cmd
taskkill /F /IM node.exe
attrib -R G:\DiaCompanion\Frontend\dist\* /S /D
rmdir /s /q G:\DiaCompanion\Frontend\dist
```

Rồi build:

```cmd
npm run build
```

Phải kết thúc kiểu:

```text
✓ built in ...
```

---

## 3. Copy FE mới sang IIS

Xóa bản web deploy cũ:

```cmd
rmdir /s /q G:\DiaCompanion\publish\web
mkdir G:\DiaCompanion\publish\web
```

Copy:

```cmd
xcopy /E /I /Y G:\DiaCompanion\Frontend\dist\* G:\DiaCompanion\publish\web\
```

Sau đó kiểm tra:

```cmd
type G:\DiaCompanion\publish\web\config.js
```

phải thấy:

```js
window.__DIACOMPANION_API__ = "http://192.168.1.5:8080";
```

Và nhớ giữ file SPA rewrite:

```text
G:\DiaCompanion\publish\web\web.config
```

với:

```xml
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="React Routes" stopProcessing="true">
          <match url=".*" />
          <conditions logicalGrouping="MatchAll">
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
            <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
            <add input="{REQUEST_URI}" pattern="^/api/" negate="true" />
          </conditions>
          <action type="Rewrite" url="/index.html" />
        </rule>
      </rules>
    </rewrite>
  </system.webServer>
</configuration>
```

Vì bạn vừa xóa `publish\web`, file này **phải tạo lại** nếu `dist` không chứa nó.

---

## 4. Bật IIS lại

```cmd
iisreset /start
```

Test backend:

```cmd
curl http://192.168.1.5:8080/health
```

mong muốn:

```json
{"status":"healthy","database":true,...}
```

Test frontend:

```text
http://192.168.1.5:8081
```

và:

```text
http://192.168.1.5:8081/login
```

---

## 5. Test login

Mở F12 → Network.

Request phải là:

```text
POST http://192.168.1.5:8080/api/auth/login
```

Không được là `:8081`.

Nếu login đúng password mà vẫn `500`, đọc log mới nhất:

```cmd
powershell -Command "$f=Get-ChildItem 'G:\DiaCompanion\publish\backend\logs\stdout_*.log' | Sort-Object LastWriteTime -Descending | Select-Object -First 1; Get-Content $f.FullName -Tail 100"
```

Sau khi login chạy được, test tiếp OTP để xác nhận luôn:

```text
Web FE
→ IIS Backend :8080
→ SMS Gateway :8091
→ Android Gateway
→ SMS thật
```

Đừng publish mobile APK lại ở vòng này; trước mắt ổn định **BE + Web FE + login + OTP** trước.
