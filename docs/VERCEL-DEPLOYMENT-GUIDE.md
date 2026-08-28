# LegalEase Vercel Deployment Guide

## Overview

LegalEase is a full-stack application deployed on Vercel with:
- **Frontend**: React + Vite (TypeScript)
- **Backend**: FastAPI Python serverless functions
- **AI Services**: Bytez API integration for legal document analysis
- **Database**: PostgreSQL (production) / SQLite (development)
- **Caching**: Redis integration (optional, for distributed rate limiting)

## Pre-Deployment Checklist

### 1. Vercel CLI Installation
```bash
npm install -g vercel
vercel login
```

### 2. Required Environment Variables

Create these in Vercel Project Settings → Environment Variables:

#### Security & Authentication
```
JWT_SECRET_KEY=<generate-strong-secret-key>
DOCUMENT_ENCRYPTION_KEY=<generate-strong-encryption-key>
```

Generate secure keys:
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

#### AI Services
```
BYTEZ_API_KEY=<your-bytez-api-key>
```

#### Database (Production)
```
DATABASE_URL=postgresql://<user>:<password>@<host>:<port>/<database>
VERCEL=true
```

#### CORS & Frontend
```
FRONTEND_URL=https://your-domain.vercel.app
ALLOWED_ORIGINS=https://your-domain.vercel.app,https://www.your-domain.vercel.app
ALLOW_LOCALHOST_CORS=false
```

#### Optional: Redis (for distributed rate limiting)
```
REDIS_URL=redis://<host>:<port>
RATE_LIMIT_BACKEND=redis
```

#### Configuration Modes
```
ALLOW_DEV=false
STUB_MODE=false
ENVIRONMENT=production
```

## Deployment Steps

### Step 1: Prepare the Repository
```bash
cd LegalEase
git push origin main  # Ensure all changes are committed
```

### Step 2: Deploy to Vercel
```bash
vercel --prod
```

Or link the repository:
```bash
vercel link
vercel --prod
```

### Step 3: Configure Environment Variables
1. Go to Vercel Dashboard → Your Project
2. Settings → Environment Variables
3. Add all variables from Pre-Deployment Checklist
4. Redeploy after adding variables

### Step 4: Verify Deployment
```bash
vercel logs <deployment-url>
```

## Architecture Overview

### Frontend Deployment
- **Build Command**: `npm run build`
- **Output Directory**: `dist/`
- **Framework**: React + Vite
- **Routing**: React Router with fallback to index.html

### Backend Deployment
- **Serverless Functions**: Python via `/api/**/*.py`
- **Entry Point**: `api/index.py`
- **Framework**: FastAPI
- **Timeout**: 60 seconds (Vercel Pro: up to 900 seconds)
- **Memory**: 3GB per function

### Project Structure in Vercel
```
├── src/                    # React frontend
├── api/
│   └── index.py           # Serverless function entry point
├── backend/               # FastAPI application
│   ├── main.py           # FastAPI app setup
│   ├── routers/          # API route handlers
│   ├── services/         # Business logic (AI, RAG, etc.)
│   ├── models.py         # Database models
│   └── config.py         # Configuration management
├── vercel.json           # Vercel configuration
├── package.json          # Frontend dependencies
├── requirements.txt          # Vercel Python runtime dependencies
└── backend/requirements.txt  # Full local/test dependency set
```

The root `requirements.txt` includes the core PyMuPDF dependency so PDF
uploads remain supported on Vercel. It omits heavyweight optional RAG,
BM25, dense-search, and web-search packages so the single serverless
function stays within the platform size limit. The backend degrades those
optional features cleanly when they are absent; deploy the full
`backend/requirements.txt` set on a separate backend host when those
features are required in production.

## AI Services Configuration

### Bytez API Integration
LegalEase uses Bytez for:
- **Legal Document Analysis**: Contract clause extraction and analysis
- **Document Summarization**: Generate legal summaries
- **Text Simplification**: Make complex legal terms accessible
- **Entity Extraction**: Identify key parties, dates, obligations

### Configuration in Backend
```python
# backend/services/ai_service.py
- Chat Model: Configured via CHAT_MODEL env var
- Summarize Model: Configured via SUMMARIZE_MODEL env var
- Timeout: 30 seconds (configurable via PROVIDER_TIMEOUT)
- Retries: 3 attempts with exponential backoff
- Graceful Degradation: Falls back to stub mode if API unavailable
```

### Environment Variables for AI
```
BYTEZ_API_KEY=<your-api-key>
CHAT_MODEL=Equall/Saul-7B-Instruct-v1
SUMMARIZE_MODEL=Equall/Saul-7B-Instruct-v1
PROVIDER_TIMEOUT=30
PROVIDER_RETRIES=3
STUB_MODE=false
```

## Database Setup

### PostgreSQL on Vercel (Recommended for Production)

1. **Use Vercel Postgres** (simplest):
   ```bash
   vercel env add DATABASE_URL
   # Copy the connection string from Vercel Postgres
   ```

2. **External PostgreSQL**:
   ```
   DATABASE_URL=postgresql://user:password@host.com:5432/legalease
   ```

3. **Initialize Database**:
   - First deployment creates tables automatically via SQLAlchemy
   - Verify with: `vercel logs --output=raw | grep "Creating tables"`

### SQLite (Development Only)
- Used only for local development and tests.
- Vercel uses a temporary filesystem, so SQLite cannot provide persistent accounts.
- Login and signup return `503 Persistent database is not configured for this deployment` until `DATABASE_URL` points to hosted PostgreSQL.

### Required Vercel production values

Set these in the Vercel project for the **Production** environment, then redeploy:

```text
ENVIRONMENT=production
VERCEL=1
JWT_SECRET_KEY=<unique-random-secret>
DOCUMENT_ENCRYPTION_KEY=<different-unique-random-secret>
DATABASE_URL=postgresql://<user>:<password>@<host>:<port>/<database>
FRONTEND_URL=https://<your-project>.vercel.app
ALLOWED_ORIGINS=https://<your-project>.vercel.app
ALLOW_DEV=false
STUB_MODE=false
```

For production rate limiting and upload task state, also configure Redis:

```text
REDIS_URL=rediss://<user>:<password>@<host>:<port>
RATE_LIMIT_BACKEND=redis
REQUIRE_REDIS_IN_PRODUCTION=true
REDIS_FAIL_FAST=true
```

Vercel cannot host the repository's long-running `worker.py` process. When
`VERCEL=1`, uploads therefore require Redis and are processed during the
serverless invocation; without Redis the endpoint returns a clear `503`
instead of accepting a task that can never be completed.

Do not copy the local `.env` file into Vercel. Vercel only receives variables configured in Project Settings or with `vercel env`, and changing them requires a new deployment.

## Rate Limiting & Caching

### Local (Default)
- In-memory rate limiting
- Per-function instance
- Good for single-instance or low-traffic apps

### Redis (Recommended for Production)
- Distributed rate limiting across functions
- Persistent cache layer
- Supports multiple concurrent requests

**Setup Redis on Vercel**:
```bash
vercel env add REDIS_URL
# Use a service like Upstash, Redis Labs, or AWS ElastiCache
```

## Monitoring & Debugging

### View Logs
```bash
# Real-time logs
vercel logs <project-name>

# Specific deployment logs
vercel logs <deployment-url>

# With filters
vercel logs <project-name> --n 100
```

### Check Function Status
```bash
vercel status
```

### Common Issues

#### Issue: Timeout on AI Requests
- **Cause**: Bytez API requests exceed 60-second timeout
- **Solution**: Upgrade to Vercel Pro (supports up to 900s timeout) or optimize prompts

#### Issue: Database Connection Failed
- **Cause**: DATABASE_URL not set or invalid
- **Solution**: Add a hosted PostgreSQL connection string to the Vercel Production environment, verify its SSL/network access, and redeploy. Do not use `sqlite:///./legalease.db` in Vercel.

#### Issue: `FUNCTION_INVOCATION_FAILED` on `/api/health` or `/api/auth/login`
- **Cause**: The Python function crashed during import, commonly because optional ML packages attempted to load a model at cold start or because a production environment variable is invalid.
- **Solution**: Deploy the current `vercel.json` and runtime requirements, then inspect the Vercel function log. `/api/health` should return JSON rather than Vercel's plain-text invocation error.

#### Issue: Bytez API Key Invalid
- **Cause**: BYTEZ_API_KEY not set or expired
- **Solution**: Update API key in Vercel Environment Variables

#### Issue: Rate Limiting Not Distributed
- **Cause**: REDIS_URL not set
- **Solution**: Add Redis connection string or use local rate limiting

## Performance Optimization

### Frontend
- ✅ Vite builds optimized bundles
- ✅ React Router lazy loading
- ✅ CSS minification with PostCSS/Tailwind

### Backend
- ✅ FastAPI async/await for I/O operations
- ✅ Request correlation IDs for debugging
- ✅ Semantic cache for repeated queries
- ✅ Rate limiting to prevent abuse

### Database
- ✅ Connection pooling (SQLAlchemy)
- ✅ Indexed queries for legal document search
- ✅ Lazy loading relationships

### AI/LLM
- ✅ Semantic cache reduces API calls
- ✅ Timeout configuration prevents hanging requests
- ✅ Retry strategy with exponential backoff
- ✅ Graceful degradation if provider unavailable

## Security Best Practices

1. **Secrets Management**
   - Never commit `.env` files
   - Use Vercel's Environment Variables UI
   - Rotate keys periodically

2. **CORS Configuration**
   - Only allow verified frontend domains
   - `ALLOWED_ORIGINS` validated at startup
   - Localhost blocked in production

3. **Rate Limiting**
   - Enabled by default: 100 req/min per IP
   - Protects against abuse and DDoS
   - Distributed via Redis in production

4. **Encryption**
   - JWT tokens signed with `JWT_SECRET_KEY`
   - Documents encrypted with `DOCUMENT_ENCRYPTION_KEY`
   - HTTPS enforced on all connections

## Rollback & Monitoring

### Rollback to Previous Version
```bash
vercel rollback
```

### Monitor in Real-Time
- Vercel Dashboard → Analytics
- Check CPU, Memory, Duration metrics
- Set up Slack notifications for errors

## Troubleshooting Deployment

### Verify Python Dependencies
```bash
cd backend
pip install -r requirements.txt  # Ensure all packages install locally
```

### Test API Locally Before Deploy
```bash
# Terminal 1: Python backend
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --reload

# Terminal 2: React frontend
npm run dev

# Terminal 3: Test API
curl http://localhost:8000/api/health
```

### Check Deployment Logs
```bash
vercel logs --follow
```

## Next Steps

1. ✅ Set up PostgreSQL database
2. ✅ Configure Bytez API credentials
3. ✅ Set up Redis (optional but recommended)
4. ✅ Deploy to Vercel
5. ✅ Monitor logs and performance
6. ✅ Collect user feedback

## Support & Resources

- **Vercel Docs**: https://vercel.com/docs
- **FastAPI**: https://fastapi.tiangolo.com/
- **Bytez API**: https://bytez.com/docs
- **React**: https://react.dev
- **Vite**: https://vitejs.dev

---

**Last Updated**: 2026-08-26
**Deployment Status**: Ready for production
