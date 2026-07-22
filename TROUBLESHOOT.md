# Troubleshooting Guide

This guide provides solutions to common issues encountered while setting up, running, and contributing to the LegalEase project.

---

# Table of Contents

- Prerequisites
- Installation Issues
- Environment Variables
- Backend Issues
- Frontend Issues
- Database Issues
- Authentication Issues
- Docker Issues
- Git Issues
- Common Runtime Errors
- Still Need Help?

---

# Prerequisites

Before starting, make sure the following tools are installed:

- Python 3.10+
- Node.js (LTS version recommended)
- npm
- Git
- Docker (Optional)

Verify installations:

```bash
python --version
node --version
npm --version
git --version
```

---

# Installation Issues

## Python dependencies fail to install

### Error

```
ModuleNotFoundError
```

### Solution

Create and activate a virtual environment.

Windows

```bash
python -m venv .venv
.venv\Scripts\activate
```

Linux/macOS

```bash
python -m venv .venv
source .venv/bin/activate
```

Install dependencies.

```bash
pip install -r requirements.txt
```

---

## npm install fails

Delete existing dependencies.

```bash
rm -rf node_modules package-lock.json
```

Then reinstall.

```bash
npm install
```

---

# Environment Variables

If the application reports missing configuration values:

- Ensure the `.env` file exists.
- Copy values from `.env.example` if available.
- Verify API keys and database URLs.
- Restart both frontend and backend after modifying `.env`.

---

# Backend Issues

## FastAPI server won't start

Run:

```bash
uvicorn backend.main:app --reload
```

If the port is already in use:

Windows

```bash
netstat -ano | findstr :8000
```

Linux/macOS

```bash
lsof -i :8000
```

Terminate the conflicting process or use another port.

---

## Import Errors

If Python cannot find project modules:

```bash
pip install -r requirements.txt
```

Ensure the virtual environment is activated before starting the backend.

---

# Frontend Issues

## Frontend does not start

Install dependencies.

```bash
npm install
```

Run development server.

```bash
npm run dev
```

---

## API requests fail

Verify that:

- Backend server is running.
- Frontend API URL matches the backend.
- CORS configuration is correct.

---

# Database Issues

## Database connection failed

Check:

- Database service is running.
- Connection string in `.env` is correct.
- Database credentials are valid.

Run pending migrations if required.

---

# Authentication Issues

## 401 Unauthorized

Possible causes:

- Expired authentication token
- Invalid API key
- Missing Authorization header

Log in again or regenerate credentials.

---

# Docker Issues

## Docker containers fail to start

Rebuild the containers.

```bash
docker compose down
docker compose up --build
```

Check logs.

```bash
docker compose logs
```

---

# Git Issues

## Unable to switch branches

Fetch all branches.

```bash
git fetch --all
```

List available branches.

```bash
git branch -a
```

Switch branch.

```bash
git checkout <branch-name>
```

---

## Merge conflicts

Check conflicted files.

```bash
git status
```

Resolve conflicts manually, then stage and commit.

```bash
git add .
git commit
```

---

# Common Runtime Errors

## Port already in use

Find the conflicting process.

Windows

```bash
netstat -ano | findstr :8000
```

Linux/macOS

```bash
lsof -i :8000
```

---

## Internal Server Error (500)

Review backend logs.

Common causes include:

- Missing environment variables
- Database connection failures
- Invalid request payloads
- Third-party service failures

---

# Logging

Enable debug logging while developing.

```python
import logging

logging.basicConfig(level=logging.DEBUG)
```

Logs can help identify configuration and runtime issues more quickly.

---

# Still Need Help?

If your issue persists:

1. Check existing GitHub Issues.
2. Review the project documentation.
3. Create a new issue including:
   - Operating System
   - Python version
   - Node.js version
   - Steps to reproduce
   - Complete error message
   - Relevant logs or screenshots

Providing complete information helps maintainers diagnose and resolve issues more efficiently.

---

# Contributing

If you discover a new issue and its solution, please consider updating this document so future contributors can benefit from your findings.