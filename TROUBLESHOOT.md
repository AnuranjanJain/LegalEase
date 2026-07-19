# Troubleshooting

This guide helps resolve common issues while setting up and running **LegalEase** locally.

---

# Table of Contents

- Prerequisites
- Frontend Issues
- Backend Issues
- Environment Variables
- AI API Issues
- Authentication Issues
- Database Issues
- File Upload Issues
- PDF Export Issues
- Testing Issues
- Docker Issues
- Build Errors
- Common Errors
- FAQ

---

# Prerequisites

Ensure you have the following installed:

- Node.js 18+
- npm or pnpm
- Python 3.11+
- pip
- Git

Verify versions:

```bash
node -v
npm -v
python --version
pip --version
```

---

# Frontend Issues

## npm install fails

Remove existing dependencies and reinstall:

```bash
rm -rf node_modules
rm package-lock.json
npm install
```

---

## Development server won't start

Run

```bash
npm run dev
```

If another application is using port **5173**, stop it or use another port:

```bash
npm run dev -- --port 5174
```

---

## Blank page after startup

Try clearing Vite cache:

```bash
rm -rf node_modules/.vite
npm run dev
```

---

# Backend Issues

## Backend won't start

Navigate to backend:

```bash
cd backend
```

Create virtual environment:

Linux/macOS

```bash
python -m venv venv
source venv/bin/activate
```

Windows

```powershell
python -m venv venv
venv\Scripts\activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Start server:

```bash
uvicorn main:app --reload
```

---

## ModuleNotFoundError

Install dependencies again:

```bash
pip install -r requirements.txt
```

---

# Environment Variables

Copy example file:

```bash
cp .env.example .env
```

Update required values:

```env
SUPABASE_URL=
SUPABASE_KEY=
AI_API_KEY=
BYTEZ_API_KEY=
JWT_SECRET_KEY=
DATABASE_URL=
```

Restart both frontend and backend after changing environment variables.

---

# AI API Issues

## AI responses are unavailable

Possible causes:

- Missing AI_API_KEY
- Missing BYTEZ_API_KEY
- Invalid API key
- External AI service unavailable

Verify the API keys in `.env`.

Restart backend:

```bash
uvicorn main:app --reload
```

---

# Authentication Issues

## Login fails

Verify:

- JWT_SECRET_KEY
- DATABASE_URL
- Backend server running

Restart backend after updating `.env`.

---

## Unauthorized (401)

Check that requests include:

```
Authorization: Bearer <token>
```

or

```
X-API-Key
```

depending on your backend configuration.

---

# Database Issues

## Database connection failed

Verify:

```
DATABASE_URL
```

is correctly configured.

Ensure your database server is running.

---

## Supabase connection error

Check:

```
SUPABASE_URL
SUPABASE_KEY
```

Confirm the project is active and credentials are correct.

---

# File Upload Issues

## Upload rejected

Supported formats include:

- PDF
- DOCX
- TXT

Large files exceeding the configured upload limit are rejected.

If needed, increase:

```env
MAX_UPLOAD_SIZE
```

---

## Upload returns 413

The uploaded file exceeds the maximum allowed size.

Reduce file size or increase:

```env
MAX_UPLOAD_SIZE
```

---

# PDF Export Issues

## Export PDF button doesn't work

Verify:

- Backend is running.
- User is authenticated.
- AI summary has been generated.

Restart backend if PDF generation fails.

---

# Testing Issues

## Backend tests fail

Navigate:

```bash
cd backend
```

Run:

```bash
pytest
```

If dependencies are missing:

```bash
pip install -r requirements.txt
```

---

## Frontend tests fail

Install dependencies:

```bash
npm install
```

Run:

```bash
npm test
```

or

```bash
npm run test:coverage
```

---

# Docker Issues

If Docker services fail:

```bash
docker compose up --build
```

Check running containers:

```bash
docker ps
```

---

# Build Errors

Frontend:

```bash
npm run build
```

Backend:

Ensure all Python dependencies are installed.

Check terminal output for missing modules.

---

# Common Errors

## Port already in use

Linux/macOS

```bash
lsof -i :5173
kill -9 <PID>
```

Windows

```powershell
netstat -ano | findstr :5173
taskkill /PID <PID> /F
```

---

## CORS Error

Verify:

```
FRONTEND_URL
```

matches your frontend origin.

Restart backend after changes.

---

## Rate Limit Exceeded (429)

Wait for the configured rate limit window to expire.

Or adjust:

```env
RATE_LIMIT_IP_CALLS
RATE_LIMIT_KEY_CALLS
RATE_LIMIT_PERIOD
```

for development.

---

## Health endpoint reports degraded

Usually indicates:

- Missing AI service credentials
- AI provider unavailable
- Database unavailable

Check backend logs for more information.

---

# FAQ

## Which Node.js version is supported?

```
18 or newer
```

---

## Which Python version is required?

```
3.11+
```

---

## Where are backend environment variables stored?

```
backend/.env
```

---

## How do I reset frontend dependencies?

```bash
rm -rf node_modules
rm package-lock.json
npm install
```

---

## How do I recreate the Python environment?

```bash
rm -rf venv
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

---

## Still having issues?

1. Verify Node.js and Python versions.
2. Check all required environment variables.
3. Ensure backend is running.
4. Ensure frontend is running.
5. Run backend and frontend tests.
6. Check existing GitHub Issues before opening a new one.