# Vercel Deployment Checklist - LegalEase

## 🚀 Pre-Deployment Setup

### Step 1: Prepare Vercel Project
- [ ] Vercel CLI installed: `npm install -g vercel`
- [ ] Logged into Vercel: `vercel login`
- [ ] Git repository committed and pushed: `git push origin main`

### Step 2: Create Vercel Project
```bash
cd LegalEase
vercel link
```
- [ ] Project created or linked to existing project
- [ ] Vercel project name: _______________
- [ ] Production domain: _______________

## 🔐 Environment Variables Setup

### Step 3: Configure Secrets & Keys
**Generate secure values before adding to Vercel:**

```bash
# Generate JWT_SECRET_KEY (run in terminal)
python -c "import secrets; print('JWT_SECRET_KEY=' + secrets.token_urlsafe(32))"

# Generate DOCUMENT_ENCRYPTION_KEY
python -c "import secrets; print('DOCUMENT_ENCRYPTION_KEY=' + secrets.token_urlsafe(32))"
```

**Add to Vercel Dashboard → Settings → Environment Variables:**

| Variable | Value | Example | Required |
|----------|-------|---------|----------|
| `JWT_SECRET_KEY` | Generate above | `gssoc26_...` | ✅ Yes |
| `DOCUMENT_ENCRYPTION_KEY` | Generate above | `gssoc26_...` | ✅ Yes (Production) |
| `BYTEZ_API_KEY` | Your Bytez API key | `bz_live_...` | ✅ Yes |
| `DATABASE_URL` | PostgreSQL connection | `postgresql://...` | ✅ Yes |
| `REDIS_URL` | Redis connection (Upstash) | `rediss://...` | ✅ Required for Vercel uploads |
| `FRONTEND_URL` | Your Vercel domain | `https://legal-ease.vercel.app` | ✅ Yes |
| `ALLOWED_ORIGINS` | Frontend URLs | `https://legal-ease.vercel.app` | ✅ Yes |
| `ENVIRONMENT` | Environment type | `production` | ✅ Yes |
| `ALLOW_DEV` | Dev mode flag | `false` | ⭕ Optional |
| `STUB_MODE` | Stub mode flag | `false` | ⭕ Optional |
| `ALLOW_LOCALHOST_CORS` | Localhost CORS | `false` | ⭕ Optional |

### Step 4: Add Environment Variables in Vercel
```bash
# Option A: Via CLI
vercel env add

# Option B: Via Dashboard
# 1. Go to https://vercel.com/dashboard
# 2. Select your project
# 3. Settings → Environment Variables
# 4. Add each variable above
```

- [ ] All required environment variables added
- [ ] Variables set for Production environment
- [ ] Sensitive keys stored securely
- [ ] A new deployment was created after adding or changing variables

## 🗄️ Database Setup

### Step 5: Configure PostgreSQL Database

#### Option A: Vercel Postgres (Recommended)
```bash
vercel postgres create
# Follow prompts and get DATABASE_URL
vercel env add DATABASE_URL
```

- [ ] Vercel Postgres database created
- [ ] DATABASE_URL environment variable set
- [ ] Connection tested from local machine

#### Option B: External PostgreSQL (Fly.io, Railway, etc.)
```
DATABASE_URL=postgresql://user:password@host.region.compute.amazonaws.com:5432/legalease
```

- [ ] External PostgreSQL database created
- [ ] DATABASE_URL configured
- [ ] DATABASE_URL is hosted PostgreSQL, not SQLite
- [ ] Database user permissions verified
- [ ] SSL/TLS connection enabled

#### Step 6: Initialize Database Schema
First deployment will auto-create tables via SQLAlchemy, but verify:
```bash
# After first deployment, check logs
vercel logs
# Look for: "Creating tables..." messages
```

- [ ] Database initialized on first deployment
- [ ] Tables created successfully
- [ ] No database connection errors in logs

## 💾 Redis Setup (Required for Vercel Uploads)

### Step 7: Configure Redis
**Using Upstash Redis (free tier available):**

1. Go to https://console.upstash.com
2. Create new Redis database
3. Copy connection string (Redis URL)

```bash
vercel env add REDIS_URL
# Paste: redis://default:password@host:port
```

Alternatively:
- Redis Labs: https://app.redislabs.com
- AWS ElastiCache: https://console.aws.amazon.com
- Local Redis (development only)

- [ ] Redis database created
- [ ] REDIS_URL environment variable set
- [ ] RATE_LIMIT_BACKEND=redis configured (recommended for distributed rate limiting)
- [ ] Redis connectivity verified before testing document uploads

## 🤖 AI Services Setup

### Step 8: Configure Bytez API

1. Go to https://bytez.com
2. Create account and get API key
3. Add to Vercel:

```bash
vercel env add BYTEZ_API_KEY
# Paste your key: bz_live_...
```

**Optional: Configure specific models**
```bash
vercel env add AI_CHAT_MODEL
vercel env add AI_SUMMARIZE_MODEL
```

- [ ] Bytez account created
- [ ] API key obtained
- [ ] BYTEZ_API_KEY added to environment
- [ ] (Optional) Custom models configured

## 🚀 Deployment & Testing

### Step 9: Deploy to Staging
```bash
vercel --env ENVIRONMENT=staging
```

- [ ] Staging deployment successful
- [ ] No build errors
- [ ] All environment variables loaded
- [ ] Frontend loads correctly

### Step 10: Test API Endpoints
```bash
# After staging deployment URL:
STAGING_URL="https://your-staging-url.vercel.app"

# Test health check
curl $STAGING_URL/api/health

# Test authentication (if health endpoint exists)
curl -H "Authorization: Bearer test" $STAGING_URL/api/users/me
```

- [ ] API responds to health check
- [ ] CORS headers present
- [ ] No 502/503 errors
- [ ] AI services initialized

### Step 11: Deploy to Production
```bash
vercel --prod
```

**Configuration confirmation:**
- [ ] Production deployment successful
- [ ] Environment set to `production`
- [ ] Build size within limits
- [ ] No errors in function deployment
- [ ] DNS configured correctly

### Step 12: Post-Deployment Verification
```bash
# Check deployment
vercel ls

# View logs
vercel logs

# Check status
vercel status
```

**Verification checklist:**
- [ ] Frontend loads at production URL
- [ ] All API endpoints responding
- [ ] AI services processing requests
- [ ] Database queries working
- [ ] Rate limiting active
- [ ] Error logging functional
- [ ] CORS properly configured
- [ ] `/api/health` returns JSON and does not show `FUNCTION_INVOCATION_FAILED`

## 📊 Performance & Monitoring

### Step 13: Set Up Monitoring
- [ ] Enable Vercel Analytics (Dashboard → Analytics)
- [ ] Monitor: CPU, Memory, Duration, Errors
- [ ] Set up alerts for:
  - [ ] High error rate (>5%)
  - [ ] Function timeout
  - [ ] Database connection issues
  - [ ] API key failures

### Step 14: Configure Logging
- [ ] Install Sentry or similar for error tracking
- [ ] View logs: `vercel logs --follow`
- [ ] Set up daily log review process

```bash
# Watch logs in real-time
vercel logs --follow

# Last N logs
vercel logs --n 50

# Filter by severity
vercel logs | grep ERROR
```

## 🔒 Security Hardening

### Step 15: Security Configuration

- [ ] HTTPS enforced (automatic with Vercel)
- [ ] CORS restricted to production domain only
- [ ] JWT_SECRET_KEY is strong (32+ chars)
- [ ] DOCUMENT_ENCRYPTION_KEY unique and strong
- [ ] No secrets in git history: `git log --all --full-history --source -- secrets.json`
- [ ] Rate limiting enabled (default: 100 req/min)
- [ ] API keys rotated (plan monthly rotation)
- [ ] Database password changed from default
- [ ] Redis password set (if using)

### Step 16: Compliance Check

- [ ] Terms of Service updated (if needed)
- [ ] Privacy Policy reflects data handling
- [ ] Cookie consent implemented
- [ ] GDPR compliance verified (if EU users)
- [ ] Data retention policies documented

## 🧪 Post-Deployment Testing

### Step 17: Full System Test

**API Tests:**
```bash
# Test document upload
curl -X POST $PROD_URL/api/documents/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test-contract.pdf"

# Test legal analysis
curl -X POST $PROD_URL/api/legal/analyze \
  -H "Content-Type: application/json" \
  -d '{"text":"contract text here"}'
```

- [ ] Document upload works
- [ ] Legal analysis returns results
- [ ] Chat functionality operational
- [ ] Collaboration features working
- [ ] Export/PDF generation works
- [ ] Search functionality responsive

**UI Tests:**
- [ ] Frontend loads without errors
- [ ] Navigation works
- [ ] Forms submit successfully
- [ ] Real-time features functional
- [ ] Mobile responsive

## 📋 Maintenance & Scaling

### Step 18: Scaling Considerations

- [ ] Monitor function duration
- [ ] Plan for scaling if needed:
  - [ ] Upgrade to Vercel Pro (longer timeouts)
  - [ ] Implement queue system for long tasks
  - [ ] Cache frequently accessed data
  - [ ] Optimize database queries

### Step 19: Backup & Disaster Recovery

- [ ] Database automated backups enabled
- [ ] Document backups configured
- [ ] Rollback plan documented: `vercel rollback`
- [ ] Incident response plan created

## ✅ Final Checklist

- [ ] All environment variables configured
- [ ] Database initialized and tested
- [ ] AI services responding
- [ ] Frontend accessible
- [ ] API working correctly
- [ ] Monitoring active
- [ ] Security hardened
- [ ] Performance acceptable (<500ms p99)
- [ ] Logging functional
- [ ] Team trained on deployment process

## 🆘 Troubleshooting

### Common Issues & Solutions

**Issue: Build fails with "module not found"**
```bash
# Solution: Check Python dependencies
cd backend
pip install -r requirements.txt
python -c "import <module>"  # Test each import
```

**Issue: API returns 502 Bad Gateway**
- Check `vercel logs` for errors
- Verify `BYTEZ_API_KEY` is set
- Ensure database connection string is valid
- Check for timeout issues (60s limit)

**Issue: CORS errors on frontend**
- Verify `ALLOWED_ORIGINS` includes your domain
- Check that FRONTEND_URL matches production URL
- Look for protocol mismatch (http vs https)

**Issue: Database not initialized**
```bash
# Check logs for SQLAlchemy initialization
vercel logs | grep -i "database\|table"

# Manually initialize (if needed - usually auto)
curl -X POST $URL/api/admin/init-db
```

**Issue: Rate limiting too strict**
- Increase limits in backend config
- Set `REDIS_URL` for distributed rate limiting
- Contact support for higher tier

## 📞 Support & Resources

- **Vercel Support**: https://vercel.com/help
- **FastAPI Docs**: https://fastapi.tiangolo.com/
- **PostgreSQL**: https://www.postgresql.org/docs/
- **Upstash Redis**: https://upstash.com/docs/redis/overview
- **Bytez API**: https://bytez.com/docs

---

**Created**: 2026-08-26  
**Status**: Ready for deployment  
**Next Step**: Start with Step 1 above
