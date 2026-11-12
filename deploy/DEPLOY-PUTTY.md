# Выгрузка Munara через WinSCP и PuTTY

Домен: `kutbilim.gps.gov.kg`

Архив приложения и TLS-файлы загружаются раздельно. Приватный ключ нельзя
хранить в Git, отправлять в мессенджерах или помещать в публичный каталог.

## 1. Загрузка через WinSCP

Создайте на сервере временный каталог:

```bash
mkdir -p /tmp/munara-upload
```

Загрузите в `/tmp/munara-upload/`:

- `munara-release.zip`;
- `kutbilim.gps.gov.kg.crt`;
- `kutbilim.gps.gov.kg.key`;

Промежуточный сертификат Sectigo уже находится внутри архива в каталоге
`deploy/`.

## 2. Установка пакетов

Команды рассчитаны на Ubuntu/Debian:

```bash
sudo apt update
sudo apt install -y nginx python3-venv python3-pip unzip
sudo mkdir -p /opt/munara/current /etc/munara /etc/ssl/munara
if [ -f /opt/munara/current/backend/db.sqlite3 ]; then sudo cp /opt/munara/current/backend/db.sqlite3 "/opt/munara/db.sqlite3.$(date +%Y%m%d-%H%M%S).backup"; fi
if [ -d /opt/munara/current/backend/media ]; then sudo cp -a /opt/munara/current/backend/media "/opt/munara/media.$(date +%Y%m%d-%H%M%S).backup"; fi
sudo unzip -o /tmp/munara-upload/munara-release.zip -d /opt/munara/current
sudo chown -R www-data:www-data /opt/munara
```

## 3. Python, база и статика

```bash
sudo python3 -m venv /opt/munara/venv
sudo /opt/munara/venv/bin/pip install --upgrade pip
sudo /opt/munara/venv/bin/pip install -r /opt/munara/current/backend/requirements.txt
sudo test -f /etc/munara/munara.env || sudo cp /opt/munara/current/deploy/munara.env.example /etc/munara/munara.env
sudo chmod 640 /etc/munara/munara.env
sudo chown root:www-data /etc/munara/munara.env
sudo nano /etc/munara/munara.env
```

В `nano` обязательно замените `DJANGO_SECRET_KEY`. Сгенерировать секрет можно:

```bash
/opt/munara/venv/bin/python -c "import secrets; print(secrets.token_urlsafe(64))"
```

Затем:

```bash
sudo -u www-data /opt/munara/venv/bin/python /opt/munara/current/backend/manage.py migrate
sudo -u www-data /opt/munara/venv/bin/python /opt/munara/current/backend/manage.py collectstatic --noinput
```

Если суперпользователя ещё нет:

```bash
sudo -u www-data /opt/munara/venv/bin/python /opt/munara/current/backend/manage.py createsuperuser
```

## 4. SSL

Промежуточный сертификат Sectigo поставляется в формате DER. Сначала
преобразуйте его в PEM, затем объедините сертификаты именно в таком порядке:

```bash
openssl x509 -inform DER -in /opt/munara/current/deploy/SectigoPublicServerAuthenticationCADVR36.crt -out /tmp/sectigo-intermediate.pem
sudo sh -c 'cat /tmp/munara-upload/kutbilim.gps.gov.kg.crt /tmp/sectigo-intermediate.pem > /etc/ssl/munara/fullchain.pem'
sudo install -o root -g root -m 600 /tmp/munara-upload/kutbilim.gps.gov.kg.key /etc/ssl/munara/kutbilim.gps.gov.kg.key
sudo chmod 644 /etc/ssl/munara/fullchain.pem
```

После успешной установки удалите приватный ключ из временного каталога:

```bash
rm /tmp/munara-upload/kutbilim.gps.gov.kg.key
```

## 5. Gunicorn и Nginx

```bash
sudo cp /opt/munara/current/deploy/munara.service /etc/systemd/system/munara.service
sudo cp /opt/munara/current/deploy/nginx-kutbilim.conf /etc/nginx/sites-available/kutbilim
sudo ln -sfn /etc/nginx/sites-available/kutbilim /etc/nginx/sites-enabled/kutbilim
sudo systemctl daemon-reload
sudo systemctl enable --now munara
sudo nginx -t
sudo systemctl enable --now nginx
sudo systemctl reload nginx
```

## 6. Проверка

```bash
systemctl --no-pager --full status munara
curl -I https://kutbilim.gps.gov.kg/
curl -I https://kutbilim.gps.gov.kg/admin/login/
sudo journalctl -u munara -n 100 --no-pager
```

До запуска проверьте, что DNS-запись `kutbilim.gps.gov.kg` указывает на IP
сервера и входящие TCP-порты 80 и 443 открыты.

## Существующая SQLite и медиа

Архив содержит текущие `backend/db.sqlite3` и `backend/media`. Команды выше
автоматически создают резервные копии существующей серверной базы и медиа перед
распаковкой. Для последующих релизов следует отдельно решить, нужно ли заменять
серверные данные локальной копией.
