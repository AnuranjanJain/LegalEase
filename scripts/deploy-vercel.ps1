# LegalEase Vercel Deployment Script for Windows PowerShell
# This script guides you through deploying LegalEase to Vercel with AI services

$ErrorActionPreference = "Stop"

# Colors for output
function Write-Header {
    param([string]$Message)
    Write-Host "`n========================================" -ForegroundColor Blue
    Write-Host $Message -ForegroundColor Blue
    Write-Host "========================================`n" -ForegroundColor Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "✓ $Message" -ForegroundColor Green
}

function Write-Error {
    param([string]$Message)
    Write-Host "✗ $Message" -ForegroundColor Red
}

function Write-Warning {
    param([string]$Message)
    Write-Host "⚠ $Message" -ForegroundColor Yellow
}

function Write-Info {
    param([string]$Message)
    Write-Host "ℹ $Message" -ForegroundColor Cyan
}

# Check prerequisites
function Check-Prerequisites {
    Write-Header "Checking Prerequisites"
    
    $failed = 0
    
    # Check Node.js
    try {
        $nodeVersion = node --version
        Write-Success "Node.js installed: $nodeVersion"
    } catch {
        Write-Error "Node.js not found. Please install from https://nodejs.org"
        $failed++
    }
    
    # Check npm
    try {
        $npmVersion = npm --version
        Write-Success "npm installed: $npmVersion"
    } catch {
        Write-Error "npm not found. Please install npm."
        $failed++
    }
    
    # Check Python
    try {
        $pythonVersion = python --version
        Write-Success "Python installed: $pythonVersion"
    } catch {
        Write-Error "Python not found. Please install from https://python.org"
        $failed++
    }
    
    # Check Git
    try {
        $gitVersion = git --version
        Write-Success "Git installed: $gitVersion"
    } catch {
        Write-Error "Git not found. Please install Git."
        $failed++
    }
    
    if ($failed -gt 0) {
        exit 1
    }
}

# Install Vercel CLI
function Install-VercelCLI {
    Write-Header "Installing Vercel CLI"
    
    try {
        $vercelVersion = vercel --version
        Write-Success "Vercel CLI already installed: $vercelVersion"
    } catch {
        Write-Info "Installing Vercel CLI globally..."
        npm install -g vercel
        Write-Success "Vercel CLI installed"
    }
}

# Login to Vercel
function Login-Vercel {
    Write-Header "Vercel Authentication"
    
    try {
        vercel whoami | Out-Null
        Write-Success "Already logged in to Vercel"
        vercel whoami
    } catch {
        Write-Info "Please log in to Vercel..."
        vercel login
    }
}

# Generate secure keys
function Generate-Keys {
    Write-Header "Generating Secure Keys"
    
    $jwt_secret = python -c "import secrets; print(secrets.token_urlsafe(32))"
    $encryption_key = python -c "import secrets; print(secrets.token_urlsafe(32))"
    
    Write-Success "JWT_SECRET_KEY generated"
    Write-Success "DOCUMENT_ENCRYPTION_KEY generated"
    
    # Store in temporary file for reference
    $tempFile = "$env:TEMP\legalease_keys.txt"
    @"
JWT_SECRET_KEY=$jwt_secret
DOCUMENT_ENCRYPTION_KEY=$encryption_key
"@ | Out-File $tempFile
    
    Write-Info "Keys saved to: $tempFile"
    Write-Host ""
    Write-Host "JWT_SECRET_KEY=$jwt_secret" -ForegroundColor Yellow
    Write-Host "DOCUMENT_ENCRYPTION_KEY=$encryption_key" -ForegroundColor Yellow
    
    return @{
        JWT_SECRET = $jwt_secret
        ENCRYPTION_KEY = $encryption_key
    }
}

# Link Vercel project
function Link-VercelProject {
    Write-Header "Linking Vercel Project"
    
    if (Test-Path ".vercel\project.json") {
        Write-Success "Project already linked to Vercel"
        Get-Content ".vercel\project.json" -Head 5
    } else {
        Write-Info "Linking project to Vercel..."
        vercel link
    }
}

# Validate project configuration
function Validate-Configuration {
    Write-Header "Validating Project Configuration"
    
    $errors = 0
    
    # Check vercel.json
    if (Test-Path "vercel.json") {
        Write-Success "vercel.json found"
    } else {
        Write-Error "vercel.json not found"
        $errors++
    }
    
    # Check backend/requirements.txt
    if (Test-Path "backend/requirements.txt") {
        Write-Success "backend/requirements.txt found"
    } else {
        Write-Error "backend/requirements.txt not found"
        $errors++
    }
    
    # Check api/index.py
    if (Test-Path "api/index.py") {
        Write-Success "api/index.py found"
    } else {
        Write-Error "api/index.py not found"
        $errors++
    }
    
    # Check package.json
    if (Test-Path "package.json") {
        Write-Success "package.json found"
    } else {
        Write-Error "package.json not found"
        $errors++
    }
    
    if ($errors -gt 0) {
        Write-Error "Configuration validation failed. Please fix the errors above."
        exit 1
    }
}

# Test Python dependencies
function Test-PythonDependencies {
    Write-Header "Testing Python Dependencies"
    
    Write-Info "Installing Python dependencies..."
    Push-Location backend
    
    if (Test-Path "requirements.txt") {
        # Create virtual environment if needed
        if (-not (Test-Path "venv")) {
            python -m venv venv
        }
        
        # Activate virtual environment
        & "venv\Scripts\Activate.ps1"
        
        # Install dependencies
        pip install -q -r requirements.txt
        Write-Success "Python dependencies installed"
        
        # Test imports
        try {
            python -c "import fastapi; import pydantic; import sqlalchemy"
            Write-Success "Core dependencies can be imported"
        } catch {
            Write-Error "Some Python dependencies failed to import"
        }
        
        # Deactivate virtual environment
        & "venv\Scripts\Deactivate.ps1"
    }
    
    Pop-Location
}

# Test frontend build
function Test-FrontendBuild {
    Write-Header "Testing Frontend Build"
    
    Write-Info "Installing frontend dependencies..."
    npm install -q
    Write-Success "Frontend dependencies installed"
    
    Write-Info "Building frontend..."
    npm run build
    
    if (Test-Path "dist") {
        Write-Success "Frontend build successful"
        $size = (Get-Item dist | Measure-Object -Property Length -Recurse).Sum / 1MB
        Write-Host "Build output size: $([Math]::Round($size, 2)) MB"
    } else {
        Write-Error "Frontend build failed"
        exit 1
    }
}

# Create environment template
function Create-EnvironmentTemplate {
    Write-Header "Creating Environment Variables Template"
    
    $template = @"
# REQUIRED: Security & Authentication
JWT_SECRET_KEY=<generate-secure-key>
DOCUMENT_ENCRYPTION_KEY=<generate-secure-key>

# REQUIRED: AI Services
BYTEZ_API_KEY=<your-bytez-api-key>

# REQUIRED: Database
DATABASE_URL=postgresql://<user>:<password>@<host>:<port>/<database>

# REQUIRED: Frontend Configuration
FRONTEND_URL=https://your-domain.vercel.app
ALLOWED_ORIGINS=https://your-domain.vercel.app

# REQUIRED: Environment
ENVIRONMENT=production

# OPTIONAL: Redis (recommended for distributed rate limiting)
REDIS_URL=redis://<host>:<port>

# OPTIONAL: Configuration
ALLOW_DEV=false
STUB_MODE=false
ALLOW_LOCALHOST_CORS=false
"@
    
    $templateFile = "$env:TEMP\vercel-env-template.txt"
    $template | Out-File $templateFile
    
    Write-Success "Environment template created"
    Write-Info "Template saved to: $templateFile"
    Write-Host $template
}

# Show deployment commands
function Show-DeploymentCommands {
    Write-Header "Deployment Commands"
    
    $commands = @"
Ready to deploy! Here are your options:

1. STAGING DEPLOYMENT (recommended first):
   vercel --env ENVIRONMENT=staging --message "Staging deployment"

2. PRODUCTION DEPLOYMENT:
   vercel --prod --message "Production deployment"

3. PREVIEW DEPLOYMENT:
   vercel --message "Preview deployment"

4. VIEW DEPLOYMENT LOGS:
   vercel logs
   vercel logs --follow  (real-time)

5. ROLLBACK TO PREVIOUS:
   vercel rollback

NOTE: Before deploying, add all environment variables in:
https://vercel.com/dashboard/[PROJECT]/settings/environment-variables
"@
    
    Write-Host $commands
}

# Main deployment flow
function Main {
    Write-Header "LegalEase Vercel Deployment Assistant"
    
    Write-Host "This script will prepare your project for deployment to Vercel with:"
    Write-Host "  ✓ Full AI capabilities (Bytez API)" -ForegroundColor Green
    Write-Host "  ✓ PostgreSQL database" -ForegroundColor Green
    Write-Host "  ✓ FastAPI backend" -ForegroundColor Green
    Write-Host "  ✓ React frontend" -ForegroundColor Green
    Write-Host ""
    
    $continue = Read-Host "Continue? (y/n)"
    if ($continue -ne "y") {
        Write-Error "Deployment cancelled"
        exit 1
    }
    
    # Run checks and setup
    Check-Prerequisites
    Install-VercelCLI
    Login-Vercel
    Validate-Configuration
    
    # Build and test
    Test-PythonDependencies
    Test-FrontendBuild
    
    # Generate keys and template
    $keys = Generate-Keys
    Create-EnvironmentTemplate
    
    # Link project
    Link-VercelProject
    
    # Show final instructions
    Write-Header "Pre-Deployment Complete!"
    
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "1. Add environment variables to Vercel:" -ForegroundColor Yellow
    Write-Host "   Visit: https://vercel.com/dashboard/[PROJECT]/settings/environment-variables"
    Write-Host ""
    Write-Host "2. For each variable from the template above, add:" -ForegroundColor Yellow
    Write-Host "   - JWT_SECRET_KEY: (from above)" -ForegroundColor Gray
    Write-Host "   - DOCUMENT_ENCRYPTION_KEY: (from above)" -ForegroundColor Gray
    Write-Host "   - BYTEZ_API_KEY: <your-api-key>" -ForegroundColor Gray
    Write-Host "   - DATABASE_URL: <your-postgres-url>" -ForegroundColor Gray
    Write-Host "   - FRONTEND_URL: https://your-domain.vercel.app" -ForegroundColor Gray
    Write-Host "   - And others from template" -ForegroundColor Gray
    Write-Host ""
    Write-Host "3. Deploy to staging first:" -ForegroundColor Yellow
    Write-Host "   vercel --env ENVIRONMENT=staging" -ForegroundColor Gray
    Write-Host ""
    Write-Host "4. Test staging deployment" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "5. Deploy to production:" -ForegroundColor Yellow
    Write-Host "   vercel --prod" -ForegroundColor Gray
    Write-Host ""
    
    Write-Success "Project is ready for deployment!"
}

# Run main function
Main
