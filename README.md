# Suhube EV Şarj Rezervasyon Sistemi

Site sakinlerinin tek şarj cihazı (`SUHUBE EVLERİ 22kW-1`) için 30 dakikalık
slotlar ayırtabildiği, çakışmaların veritabanı seviyesinde engellendiği
full-stack bir rezervasyon uygulaması.

- **Backend:** Go (stdlib `net/http`), PostgreSQL (pgx), JWT + rotating refresh
  token auth.
- **Frontend:** React (Vite), mobil-öncelikli, nginx ile servis edilir.
- **Çalıştırma:** Docker Compose — tek komutla db + backend + frontend.

## Kurulum ve çalıştırma

Temiz bir makinede yalnızca Docker gerekir:

```bash
git clone <repo>
cd ev-charger-reservation
cp .env.example .env      # değerleri düzenle (aşağıya bak)
docker compose up --build
```

Tarayıcıda **http://localhost:8080** açılır.

`.env`'de düzenlenecekler:

| Değişken | Açıklama |
|---|---|
| `POSTGRES_USER/PASSWORD/DB` | Veritabanı kimlik bilgileri |
| `JWT_SECRET` | Uzun rastgele değer — `openssl rand -base64 48` |
| `ADMIN_PLATE` | İlk yöneticinin (superadmin) plakası |
| `ADMIN_NAME` | İlk yöneticinin adı |

## Giriş

**Hızlı deneme (demo hesabı):** yönetici olarak plaka `34ABC000`, PIN `0123`
ile gir. Bu hesap seed verisiyle gelen bir **superadmin**; "Komşular"
sekmesinden sakin ekleyebilir, birini yönetici yapabilir, PIN sıfırlayabilir.

**Gerçek kurulum:** `.env`'de `ADMIN_PLATE`'i kendi plakanla değiştir (seed'de
olmayan bir plaka). Sistemde şifre saklanmaz — o plaka **PIN'siz** oluşturulur:
ilk girişte plakanı yazarsın, doğrudan "Yeni PIN belirle" ekranına düşer, kendi
PIN'ini koyarsın. Eklediğin her komşu da aynı şekilde ilk girişinde kendi
PIN'ini belirler. (Prod'da seed'deki demo hesapları silebilirsin.)

## Mimari

```
frontend (nginx) ──/api──> backend (Go) ──> db (Postgres)
```

- `frontend/` — React uygulaması; nginx statik dosyaları servis eder ve `/api`
  isteklerini backend'e proxy'ler (CSP + güvenlik başlıklarıyla).
- `backend/` — katmanlı: `handlers → service → store`. Migration'lar
  (`backend/migrations/`) ilk açılışta Postgres tarafından dosya sırasıyla
  uygulanır.
- Rezervasyon kuralları (30 dk slot, 1–4 slot ya da 22:30–05:00 gece bloğu,
  kullanıcı başına 2 aktif, geçmişe rezervasyon yok, çakışma yok) hem serviste
  hem de DB constraint'i ile güvence altında.

## API

Endpoint dokümanı: [`docs/api.md`](docs/api.md).

## Testler

```bash
cd backend
DB_URL="postgres://user:password@localhost:5432/database" go test ./...
```

Rezervasyon iş kuralı testleri gerçek bir Postgres'e karşı çalışır; `DB_URL`
ayarlı değilse atlanır.
