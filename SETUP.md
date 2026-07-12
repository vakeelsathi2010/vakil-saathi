# VakilSaathi — Setup Guide

Advocates ke liye free case management + reminder app.

---

## Quick Start (15 minutes mein live!)

### Step 1: Supabase Setup (Free)

1. [supabase.com](https://supabase.com) par jaayein → New Project banayein
2. Project name: `vakil-saathi`
3. Password strong rakho (save kar lo)
4. Region: **Southeast Asia (Singapore)** — India ke sabse paas
5. Project banne ke baad: **SQL Editor** kholo
6. `supabase/migrations/001_initial.sql` ka poora content paste karo → Run karo
7. **Settings → API** se copy karo:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

### Step 2: Meta WhatsApp Cloud API (Free)

1. [developers.facebook.com](https://developers.facebook.com) par jaayein
2. New App → Business type → App banayein
3. WhatsApp product add karo
4. **Temporary access token** copy karo → `WHATSAPP_TOKEN`
5. **Phone Number ID** copy karo → `WHATSAPP_PHONE_NUMBER_ID`
6. Test number se shuru karo (production ke liye business verification lagta hai)

### Step 3: Fast2SMS (SMS Backup)

1. [fast2sms.com](https://fast2sms.com) par register karo
2. Free ₹50 credit milta hai (~200 SMS)
3. API Key copy karo → `FAST2SMS_API_KEY`

### Step 4: Environment Variables

`.env.example` ko copy karke `.env.local` banayein:

```bash
cp .env.example .env.local
```

Phir apni values fill karein.

### Step 5: Local Development

```bash
npm install
npm run dev
```

Browser mein kholo: http://localhost:3000

### Step 6: Vercel Deploy (Free)

```bash
npm install -g vercel
vercel
```

Ya [vercel.com](https://vercel.com) par GitHub se connect karo.

**Environment Variables Vercel mein daalein:**
- Vercel Dashboard → Project → Settings → Environment Variables
- Saari `.env.local` ki values wahan copy karo

### Step 7: Cron Job (Auto Daily Reminders)

`vercel.json` already configured hai — Vercel automatically roz subah 7 baje reminder bhejega.

Vercel mein `CRON_SECRET` environment variable zarur daalen — koi bhi random string.

---

## Database Tables

| Table | Description |
|---|---|
| `advocates` | Registered advocates |
| `clients` | Advocate ke clients |
| `cases` | Cases / Mukadme |
| `hearings` | Peshi dates |
| `reminder_logs` | Sent reminders ka record |

---

## Free Tier Limits

| Service | Free Limit |
|---|---|
| Supabase | 500MB DB, 50K users |
| Vercel | Unlimited deployments |
| WhatsApp API | 1,000 utility messages/month |
| Fast2SMS | ₹50 free credit |

---

## Revenue Model (Advocates Ko Free, Aap Kaise Kamaoge)

1. **Bar Association Elections** — Candidates ko aapka advocate database reach chahiye
2. **Kachahri vendors** — Stamp, photocopy shops → in-app ads
3. **Client premium** — Clients ko paid tracking feature
4. **White-label** — Bade law firms ko branded version

---

## Support

Koi dikkat? Issues tab mein report karein ya email karein.
