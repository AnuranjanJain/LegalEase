#!/bin/bash
# LegalEase Vercel Deployment Script
# This script guides you through deploying LegalEase to Vercel with AI services

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    print_header "Checking Prerequisites"
    
    # Check Node.js
    if command -v node &> /dev/null; then
        print_success "Node.js installed: $(node --version)"
    else
        print_error "Node.js not found. Please install Node.js from https://nodejs.org"
        exit 1
    fi
    
    # Check npm
    if command -v npm &> /dev/null; then
        print_success "npm installed: $(npm --version)"
    else
        print_error "npm not found. Please install npm."
        exit 1
    fi
    
    # Check Python
    if command -v python3 &> /dev/null; then
        print_success "Python installed: $(python3 --version)"
    else
        print_error "Python not found. Please install Python 3.8+ from https://python.org"
        exit 1
    fi
    
    # Check Git
    if command -v git &> /dev/null; then
        print_success "Git installed: $(git --version)"
    else
        print_error "Git not found. Please install Git."
        exit 1
    fi
}

# Install Vercel CLI
install_vercel_cli() {
    print_header "Installing Vercel CLI"
    
    if command -v vercel &> /dev/null; then
        print_success "Vercel CLI already installed: $(vercel --version)"
    else
        print_info "Installing Vercel CLI globally..."
        npm install -g vercel
        print_success "Vercel CLI installed"
    fi
}

# Login to Vercel
login_vercel() {
    print_header "Vercel Authentication"
    
    if vercel whoami &> /dev/null; then
        print_success "Already logged in to Vercel"
        vercel whoami
    else
        print_info "Please log in to Vercel..."
        vercel login
    fi
}

# Generate secure keys
generate_keys() {
    print_header "Generating Secure Keys"
    
    JWT_SECRET=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")
    ENCRYPTION_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")
    
    print_success "JWT_SECRET_KEY generated"
    print_success "DOCUMENT_ENCRYPTION_KEY generated"
    
    # Store in temporary file for reference
    cat > /tmp/legalease_keys.txt << EOF
JWT_SECRET_KEY=$JWT_SECRET
DOCUMENT_ENCRYPTION_KEY=$ENCRYPTION_KEY
EOF
    
    print_info "Keys saved to /tmp/legalease_keys.txt (for reference)"
    echo ""
    echo "JWT_SECRET_KEY=$JWT_SECRET"
    echo "DOCUMENT_ENCRYPTION_KEY=$ENCRYPTION_KEY"
}

# Link Vercel project
link_project() {
    print_header "Linking Vercel Project"
    
    if [ -d ".vercel" ]; then
        print_success "Project already linked to Vercel"
        cat .vercel/project.json | head -5
    else
        print_info "Linking project to Vercel..."
        vercel link
    fi
}

# Validate project configuration
validate_config() {
    print_header "Validating Project Configuration"
    
    local errors=0
    
    # Check vercel.json
    if [ -f "vercel.json" ]; then
        print_success "vercel.json found"
    else
        print_error "vercel.json not found"
        ((errors++))
    fi
    
    # Check backend/requirements.txt
    if [ -f "backend/requirements.txt" ]; then
        print_success "backend/requirements.txt found"
    else
        print_error "backend/requirements.txt not found"
        ((errors++))
    fi
    
    # Check api/index.py
    if [ -f "api/index.py" ]; then
        print_success "api/index.py found"
    else
        print_error "api/index.py not found"
        ((errors++))
    fi
    
    # Check package.json
    if [ -f "package.json" ]; then
        print_success "package.json found"
    else
        print_error "package.json not found"
        ((errors++))
    fi
    
    if [ $errors -gt 0 ]; then
        print_error "Configuration validation failed. Please fix the errors above."
        exit 1
    fi
}

# Test Python dependencies
test_python_deps() {
    print_header "Testing Python Dependencies"
    
    print_info "Installing Python dependencies locally..."
    cd backend
    
    if [ -f "requirements.txt" ]; then
        # Create virtual environment if it doesn't exist
        if [ ! -d "venv" ]; then
            python3 -m venv venv
        fi
        
        # Activate virtual environment
        source venv/bin/activate
        
        # Install dependencies
        pip install -q -r requirements.txt
        print_success "Python dependencies installed"
        
        # Test imports
        python3 -c "import fastapi; import pydantic; import sqlalchemy" 2>/dev/null
        if [ $? -eq 0 ]; then
            print_success "Core dependencies can be imported"
        else
            print_error "Some Python dependencies failed to import"
        fi
        
        deactivate
    fi
    
    cd ..
}

# Test frontend build
test_frontend_build() {
    print_header "Testing Frontend Build"
    
    print_info "Installing frontend dependencies..."
    npm install -q
    print_success "Frontend dependencies installed"
    
    print_info "Building frontend..."
    npm run build
    
    if [ -d "dist" ]; then
        print_success "Frontend build successful"
        echo "Build output size: $(du -sh dist | cut -f1)"
    else
        print_error "Frontend build failed"
        exit 1
    fi
}

# Create environment template
create_env_template() {
    print_header "Creating Environment Variables Template"
    
    cat > /tmp/vercel-env-template.txt << 'EOF'
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

# REQUIRED for Vercel document uploads; also enables distributed rate limiting
REDIS_URL=redis://<host>:<port>

# OPTIONAL: Configuration
ALLOW_DEV=false
STUB_MODE=false
ALLOW_LOCALHOST_CORS=false
EOF
    
    print_success "Environment template created"
    print_info "Template saved to: /tmp/vercel-env-template.txt"
    cat /tmp/vercel-env-template.txt
}

# Show deployment commands
show_deployment_commands() {
    print_header "Deployment Commands"
    
    cat << 'EOF'
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
EOF
}

# Main deployment flow
main() {
    print_header "LegalEase Vercel Deployment Assistant"
    
    echo "This script will prepare your project for deployment to Vercel with:"
    echo "  ✓ Full AI capabilities (Bytez API)"
    echo "  ✓ PostgreSQL database"
    echo "  ✓ FastAPI backend"
    echo "  ✓ React frontend"
    echo ""
    
    read -p "Continue? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_error "Deployment cancelled"
        exit 1
    fi
    
    # Run checks and setup
    check_prerequisites
    install_vercel_cli
    login_vercel
    validate_config
    
    # Build and test
    test_python_deps
    test_frontend_build
    
    # Generate keys and template
    generate_keys
    create_env_template
    
    # Link project
    link_project
    
    # Show final instructions
    print_header "Pre-Deployment Complete!"
    
    echo "Next steps:"
    echo ""
    echo "1. Add environment variables to Vercel:"
    echo "   Visit: https://vercel.com/dashboard/[PROJECT]/settings/environment-variables"
    echo ""
    echo "2. For each variable from the template above, add:"
    echo "   - JWT_SECRET_KEY: <from /tmp/legalease_keys.txt>"
    echo "   - DOCUMENT_ENCRYPTION_KEY: <from /tmp/legalease_keys.txt>"
    echo "   - BYTEZ_API_KEY: <your-api-key>"
    echo "   - DATABASE_URL: <your-postgres-url>"
    echo "   - FRONTEND_URL: https://your-domain.vercel.app"
    echo "   - And others from template"
    echo ""
    echo "3. Deploy to staging first:"
    echo "   vercel --env ENVIRONMENT=staging"
    echo ""
    echo "4. Test staging deployment"
    echo ""
    echo "5. Deploy to production:"
    echo "   vercel --prod"
    echo ""
    
    print_success "Project is ready for deployment!"
}

# Run main function
main
