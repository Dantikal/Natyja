# Развёртывание на сервере

Подготовлено для Linux с Node.js 22, npm, PostgreSQL 16+, Nginx и systemd. Другой сервер потребует адаптации команд. Публикация через GitHub сама по себе сайт не запускает.

## 1. Исходники и зависимости

Разместите проект в `/opt/natyja`. Создайте отдельного системного пользователя `natyyzha`, которому принадлежит каталог; не запускайте приложение от root.

```bash
cd /opt/natyja/backend
npm ci --omit=dev
cp .env.example .env
chmod 600 .env
cd ../frontend
npm ci
npm run build
```

Заполните `backend/.env`. Секрет JWT сгенерируйте на сервере:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Не переносите секрет из примера буквально. Задайте отдельный пароль БД. PostgreSQL, backend (5000), шлюз (8080) и Ollama (11434) должны оставаться доступны только локально. Интернет направляйте через Nginx с HTTPS. В этой конфигурации `TRUST_CLOUDFLARE_HEADERS=false`.

## 2. Пустая база

Создайте отдельного пользователя и базу PostgreSQL (например, на Ubuntu):

```bash
sudo -u postgres createuser --pwprompt natyyzha
sudo -u postgres createdb --owner=natyyzha natyyzha
```

Пользователю приложения не нужны права superuser или создание других баз. В backend/.env задайте DB_HOST=127.0.0.1, DB_PORT=5432, DB_NAME=natyyzha, DB_USER=natyyzha и новый пароль, введённый при создании роли. Вместо DB_* допускается DATABASE_URL. Для удалённого PostgreSQL используйте проверенный TLS по правилам провайдера, не отключайте проверку сертификата.

Импортируйте структуру в новую пустую базу:

```bash
cd /opt/natyja
psql -h 127.0.0.1 -U natyyzha -d natyyzha -v ON_ERROR_STOP=1 -f database/schema.sql
```

Схема также создаётся сервером автоматически при первом запуске под блокировкой миграций. Повторный запуск безопасен. В schema.sql нет пользователей, фотографий и отчётов. Справочники заполните в панели администратора.

### Перенос существующей базы MySQL

Перед переносом остановите старый backend, чтобы он не добавлял записи во время копирования. Сделайте резервную копию MySQL и файлов загрузок. Секретный старый .env храните отдельно от репозитория. Для скрипта миграции нужен mysql2 из devDependencies, поэтому выполните npm ci без --omit=dev. Перенос выполняется только в пустую базу PostgreSQL, иначе скрипт завершается без изменений.

```bash
cd /opt/natyja/backend
npm ci
export MYSQL_ENV_FILE=/secure/path/old-mysql.env
read -r -s -p 'Target PostgreSQL URL: ' DATABASE_URL
printf '\n'
export DATABASE_URL
npm run migrate:mysql
unset MYSQL_ENV_FILE DATABASE_URL
```

URL должен указывать на новую базу; специальные символы пароля в URL нужно percent-encode. Скрипт копирует 14 таблиц в одной транзакции PostgreSQL, проверяет количество записей, сохраняет ID и хеши паролей, пересчитывает последовательности. Generated-поле useful_percent вычисляется PostgreSQL. Исходные записи MySQL не изменяются. При ошибке PostgreSQL-транзакция откатывается. Время timestamp исходной MySQL интерпретируется в часовом поясе её текущего сеанса; проверьте старый timezone перед переносом.

Перенесите backend/uploads и backend/assistant-data отдельным защищённым способом. Сохраните прежний JWT_SECRET, если требуется сохранить сеансы; смена JWT_SECRET завершает старые сеансы. После проверки входа, задач, отчётов, идей и рейтинга переключите сервер на PostgreSQL. Не удаляйте резервную копию MySQL до завершения проверки. Эти данные и ключи не публикуются в GitHub.

Создание первого администратора без стандартного пароля:

```bash
cd /opt/natyja/backend
read -r -p 'Admin email: ' ADMIN_EMAIL
read -r -s -p 'Admin password (12+ characters): ' ADMIN_PASSWORD
printf '\n'
export ADMIN_EMAIL ADMIN_PASSWORD
node scripts/create-admin.cjs
unset ADMIN_EMAIL ADMIN_PASSWORD
```

Скрипт создаёт только новую запись и не сбрасывает пароли существующих пользователей.

## 3. Постоянные процессы

Пример `/etc/systemd/system/natyja-api.service`:

```ini
[Unit]
Description=Natyyzha API
After=network.target postgresql.service

[Service]
User=natyyzha
WorkingDirectory=/opt/natyja/backend
ExecStart=/usr/bin/node src/server.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Пример `/etc/systemd/system/natyja-web.service`:

```ini
[Unit]
Description=Natyyzha production gateway
After=network.target natyja-api.service

[Service]
User=natyyzha
WorkingDirectory=/opt/natyja/backend
ExecStart=/usr/bin/node public-site.cjs
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Проверьте путь к node командой `command -v node`, при необходимости исправьте `ExecStart`.

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now natyja-api natyja-web
sudo journalctl -u natyja-api -u natyja-web -n 50
```

## 4. Домен и HTTPS

Настройте DNS домена на сервер. В конфигурации Nginx для домена используйте:

```nginx
location / {
    client_max_body_size 12m;
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;
    # Gateway trusts this header only when explicitly enabled.
    proxy_set_header CF-Connecting-IP $remote_addr;
    proxy_read_timeout 130s;
}
```

Включите TLS с сертификатом вашего домена и перенаправление HTTP на HTTPS. При этой схеме шлюз по умолчанию группирует внешние запросы под локальным IP Nginx. Для корректных индивидуальных лимитов можно установить `TRUST_CLOUDFLARE_HEADERS=true`: это разрешено только если 8080 закрыт для внешних подключений, а Nginx всегда перезаписывает `CF-Connecting-IP` значением `$remote_addr`, как выше. Перезапустите natyja-web после изменения `.env`.

## 5. ИИ и OCR

Для анализа идей и справочного помощника требуется Ollama на `127.0.0.1:11434` с моделью `qwen3:4b-instruct`. Код `supportAssistant.js` использует именно это имя. Установите модель или создайте соответствующий alias из совместимой установленной модели средствами Ollama. Не открывайте порт Ollama в интернет. Модель требует отдельной памяти и вычислительных ресурсов; её файлы не входят в GitHub.

Основной экспериментальный помощник использует `ASSISTANT_MODEL` из `.env`. Его значение нужно согласовать с установленными моделями. Без Ollama обычные задачи и учёт работают, но функции ИИ недоступны. OCR использует включённые `backend/ocr-data/*.traineddata`.

## 6. Проверка и обновление

```bash
curl -i http://127.0.0.1:5000/
curl -I https://YOUR_DOMAIN/login
curl -i https://YOUR_DOMAIN/api/tasks/my
```

Последний запрос без токена должен вернуть 401. В браузере проверьте регистрацию, вход администратора, создание справочников, задачи, загрузки и ИИ.

Перед обновлением сохраните резервную копию БД, uploads и assistant-data. Обновите исходники и выполните `npm ci` в обеих папках, `npm run build` во frontend, затем перезапустите оба сервиса. После обновления повторите проверки. Известные незакрытые вопросы перечислены в `SECURITY-REVIEW.md`; production-аудит не завершён.

## Проверки PostgreSQL

Изолированная тестовая база должна иметь имя, заканчивающееся на _test. Задайте TEST_DATABASE_URL и выполните npm run test:postgres из backend. Тест очищает только эту тестовую базу, проверяет регистрацию, права, делегирование задач, отчёты, идеи, рейтинг, транзакции и отзыв сеанса после смены пароля. Не используйте рабочую базу.
