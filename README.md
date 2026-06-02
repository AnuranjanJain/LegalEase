# ⚖️ LegalEase

<p align="center">
  <img src="assets/homepage.png" alt="LegalEase Banner" width="800"/>
</p>

<p align="center">
  AI-powered legal document analysis platform that simplifies complex legal documents, provides intelligent summaries, and offers chatbot-based assistance.
</p>

<p align="center">
  <img src="https://img.shields.io/github/stars/AnuranjanJain/LegalEase?style=for-the-badge" />
  <img src="https://img.shields.io/github/forks/AnuranjanJain/LegalEase?style=for-the-badge" />
  <img src="https://img.shields.io/github/issues/AnuranjanJain/LegalEase?style=for-the-badge" />
  <img src="https://img.shields.io/github/license/AnuranjanJain/LegalEase?style=for-the-badge" />
</p>

## 🎯 Why LegalEase?

Legal documents are often difficult for ordinary users to understand because of legal jargon and lengthy clauses.

LegalEase helps users by:

- Simplifying complex legal language
- Generating concise summaries
- Highlighting risks and important clauses
- Providing AI-powered legal assistance
- Improving accessibility and understanding

## 📚 Table of Contents

- About LegalEase
- Live Demo
- Features
- Screenshots
- Technology Stack
- Project Structure
- Installation
- Usage
- Testing
- Configuration
- [Tailwind Theme Guide](docs/tailwind-theme-guide.md)
- Security
- Contributing
- Code of Conduct
- Future Enhancements
- License

# LegalEase Website

A comprehensive legal document analysis platform that combines AI-powered document processing, chatbot assistance, and user-friendly interfaces.
## 🌐 Live Demo

Check out the live project here:  
👉 [visit Live Demo](https://legal-ease-silk.vercel.app)

Explore the LegalEase platform to upload documents,view summaries,and interact with the AI chatbot interface.

## 📸 Screenshots

### 🏠 Homepage
![Homepage](assets/homepage.png)

### 🤖 AI Chatbot
![AI Chatbot](assets/aichatbot.png)

### 📄 Document Simplifier
![Document Simplifier](assets/documentmodifier.png)

### ⚙️ Features Page
![Features](assets/features.png)


## Project Structure

```
LegalEase/
├── src/                        # React/TypeScript frontend
│   ├── components/             # Reusable UI components
│   │   ├── Header.tsx          # Navigation header
│   │   ├── Footer.tsx          # Site footer
│   │   ├── ErrorBoundary.tsx   # Error handling wrapper
│   │   └── ...
│   ├── pages/                  # Route-level page components
│   │   ├── HomePage.tsx        # Landing page
│   │   ├── DashboardPage.tsx   # User dashboard
│   │   ├── DocumentsPage.tsx   # Document upload & management
│   │   ├── ChatbotPage.tsx     # AI legal assistant
│   │   ├── ProcessingPage.tsx  # Document processing status
│   │   ├── ProfilePage.tsx     # User profile & settings
│   │   ├── Login.tsx           # Authentication
│   │   ├── Signup.tsx          # User registration
│   │   └── ...
│   ├── contexts/               # React context providers
│   ├── hooks/                  # Custom React hooks
│   ├── layouts/                # Page layout wrappers
│   ├── services/               # API and storage services
│   ├── config/                 # Site configuration
│   └── test/                   # Frontend test suite
├── backend/                    # Python/FastAPI backend
│   ├── main.py                 # FastAPI application entry
│   ├── auth.py                 # Authentication logic
│   ├── models.py               # Database models
│   ├── database.py             # Database connection
│   ├── routers/                # API route handlers
│   │   ├── auth_routes.py      # Authentication endpoints
│   │   └── legal_routes.py     # Legal document endpoints
│   ├── services/               # Business logic services
│   │   ├── ai_service.py       # AI/LLM integration
│   │   └── legal_mapping.py    # Legal document mapping
│   ├── middleware/              # Request middleware
│   │   └── rate_limit.py       # Rate limiting
│   ├── core/                   # Core utilities
│   ├── utils/                  # Helper functions
│   └── tests/                  # Backend test suite
├── docs/                       # Project documentation
├── public/                     # Static assets
├── tailwind.config.js          # Tailwind CSS configuration
├── vite.config.ts              # Vite build configuration
├── tsconfig.json               # TypeScript configuration
└── package.json                # Frontend dependencies
```

## Features

### 🏠 Home Page (`HomePage.tsx`)
- **Hero Section**: Compelling introduction with call-to-action buttons
- **Features Overview**: Document summary, jargon explanations, and risk alerts
- **Quick Actions**: Direct access to main features
- **Security Information**: Trust indicators and compliance details
- **Responsive Design**: Mobile-friendly layout

### 📊 Dashboard (`DashboardPage.tsx`)
- **Statistics Overview**: Document counts, processing status, and time saved
- **Quick Actions**: Fast access to upload, chat, and processing
- **Recent Activity**: Timeline of user actions
- **Recent Documents**: Latest uploaded files with status indicators

### 📄 Document Upload (`DocumentsPage.tsx`)
- **Drag & Drop Interface**: Intuitive file upload experience
- **File Validation**: Type and size checking (PDF, DOCX, TXT up to 25MB)
- **Feature Explanation**: Clear description of AI capabilities
- **Recent Documents**: History with processing status

### 🤖 AI Chatbot (`ChatbotPage.tsx`)
- **Interactive Chat Interface**: Real-time conversation with AI
- **Legal Topics Sidebar**: Quick access to common questions
- **Message History**: Persistent conversation log
- **Legal Disclaimer**: Important usage guidelines

### ⚙️ Processing Status (`ProcessingPage.tsx`)
- **Real-time Progress**: Step-by-step processing visualization
- **Animated Progress Bars**: Visual feedback for each stage
- **Processing History**: Past document processing records
- **Status Management**: Cancel, retry, and download options

### 👤 User Profile (`ProfilePage.tsx`)
- **Personal Information**: Complete profile management
- **Address Details**: Billing and contact information
- **Preferences**: Language, timezone, and notification settings
- **Account Statistics**: Usage metrics and achievements

## Technology Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS 3.4 with custom theme extensions
- **Routing**: React Router DOM 6
- **Charts**: Recharts
- **Icons**: Lucide React
- **Testing**: Vitest, React Testing Library, jsdom
- **Backend**: Python 3.11+, FastAPI, Uvicorn
- **Database**: SQLAlchemy (with Supabase support)
- **Auth**: python-jose (JWT), bcrypt
- **Document Processing**: PyMuPDF (PDF), python-docx (DOCX)
- **Rate Limiting**: SlowAPI
- **Linting**: ESLint (frontend), Flake8 (backend)

## Key Features

### 🎨 Design Elements
- **Consistent Color Scheme**: Tailwind-based theme with light/dark mode support
- **Lucide Icons**: Modern, consistent icon set
- **Smooth Animations**: CSS transitions and React-powered interactions
- **Accessibility**: Proper ARIA labels and keyboard navigation

### 📱 Responsive Design
- **Mobile Navigation**: Collapsible menu for smaller screens
- **Flexible Layouts**: CSS Grid and Flexbox for optimal viewing
- **Touch-Friendly**: Appropriately sized interactive elements

### 🔧 Interactive Features
- **File Upload**: Drag & drop with progress indication
- **Chat Interface**: Real-time AI-powered conversation
- **Processing Animation**: Step-by-step progress visualization
- **Notifications**: Toast-style messages for user feedback

## Browser Support

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## Setup Instructions

### Prerequisites
- Node.js 18+ and npm (or pnpm)
- Python 3.11+

### Frontend Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The frontend runs on `http://localhost:5173` by default.

### Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/macOS
# venv\Scripts\activate   # Windows

# Install dependencies
pip install -r requirements.txt

# Copy environment variables
cp .env.example .env
# Edit .env with your API keys

# Start the server
uvicorn main:app --reload
```

The backend runs on `http://localhost:8000` by default.

### Environment Variables

Copy `backend/.env.example` to `backend/.env` and configure:
- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_KEY` — Supabase anonymous key
- `AI_API_KEY` — AI service API key

## Testing

This project includes comprehensive test suites for both backend and frontend to ensure code quality and prevent regressions.

### Backend Testing (Python/FastAPI)

The backend uses **pytest** as the testing framework with the following test structure:

```bash
backend/
├── tests/
│   ├── test_security.py       # Security and authentication tests
│   ├── test_rate_limiter.py   # Rate limiting functionality tests
│   ├── test_api_validation.py # API key validation tests
│   ├── test_endpoints.py      # API endpoint tests
│   └── test_integration.py    # Integration tests for user flows
```

#### Running Backend Tests

```bash
# Navigate to backend directory
cd backend

# Install test dependencies
pip install -r requirements.txt

# Run all tests
pytest

# Run tests with coverage
pytest --cov=. --cov-report=html

# Run only unit tests
pytest -m unit

# Run only integration tests
pytest -m integration

# Run tests with verbose output
pytest -v
```

#### Test Coverage

- **Unit Tests**: Test individual functions and classes in isolation
  - Rate limiter functionality
  - API key validation
  - Request model validation
  - Health endpoint

- **Integration Tests**: Test complete user flows
  - Document upload and summarization
  - Document upload and chat interaction
  - Multiple document uploads
  - Error recovery scenarios

- **Security Tests**: Verify security measures
  - API key authentication
  - File size limits
  - Rate limiting
  - Invalid file rejection

### Frontend Testing (React/TypeScript)

The frontend uses **Vitest** as the testing framework with React Testing Library:

```bash
src/
├── test/
│   ├── setup.ts              # Test configuration and mocks
│   └── services/
│       ├── storage.test.ts   # Storage service tests
│       └── api.test.ts       # API service tests
```

#### Running Frontend Tests

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage

# Run tests for a specific file
npm test -- storage.test.ts
```

#### Test Coverage

- **Service Tests**: Test utility functions and services
  - Storage service (localStorage operations)
  - API service (HTTP requests)
  - Error handling
  - Data transformation

### Test Configuration Files

- **Backend**: `backend/pytest.ini` - Pytest configuration
- **Frontend**: `vite.config.ts` - Vitest configuration
- **Frontend Setup**: `src/test/setup.ts` - Test environment setup

### CI/CD Integration

Tests are automatically run on GitHub Actions for every pull request. See `.github/workflows/test.yml` for the CI configuration.

### Writing New Tests

When adding new features, please include:

1. **Unit tests** for individual functions/components
2. **Integration tests** for complete user flows
3. **Edge case tests** for error scenarios

Follow the existing test patterns and maintain test coverage above 80%.

## Configuration

Follow these steps to configure environment variables required to run the project locally and in CI. Do not commit your real secrets.

- **Create a Python virtualenv (recommended):**

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

- **Create a frontend environment (Node):**

```bash
npm install
```

- **Create a local .env from the example:**

```bash
cp .env.example .env
# Edit .env and replace placeholders with real values (DO NOT commit .env)
```

- **Important environment variables** (see `.env.example`):
    - `BYTEZ_API_KEY` — required by the backend to access the Bytez SDK. Keep this secret.
    - `FRONTEND_URL` — frontend origin used for CORS (default: `http://localhost:5173`).
    - `BYTEZ_API_KEY` — required by the backend to access the Bytez SDK. Keep this secret.
    - `FRONTEND_URL` — frontend origin used for CORS (default: `http://localhost:5173`).
    - `API_KEYS` — comma-separated list of valid API keys for server endpoints (recommended in production).
    - `DEV_API_KEY` — developer API key allowed when `ALLOW_DEV` is enabled (default: `dev-token`).
    - `ALLOW_DEV` — allow using `DEV_API_KEY` for local development (`true`/`false`, default `true`).
    - `MAX_UPLOAD_SIZE` — maximum allowed upload size in bytes (default 26214400 = 25MB).
    - `RATE_LIMIT_IP_CALLS`, `RATE_LIMIT_KEY_CALLS`, `RATE_LIMIT_PERIOD` — simple rate-limiting configuration (defaults: 60, 30, 60).

- **Run backend (development):**

```bash
# from the project root
cd backend
uvicorn main:app --reload --port 8000

Security notes (backend)
- Authentication: backend endpoints (`/chat`, `/upload`, `/summarize`) require an API key in `Authorization: Bearer <key>` or `X-API-Key` header. Set `API_KEYS` or use `DEV_API_KEY` with `ALLOW_DEV` enabled for local development.
- Upload limits: server enforces `MAX_UPLOAD_SIZE` and basic file-type validation (PDF, DOCX, text). Oversized uploads return HTTP 413.
- Rate limiting: server applies per-IP and per-API-key rate limits; exceeding the limit returns HTTP 429.
- Error codes: AI/service dependency failures return 5xx (503/502) rather than 200.
- Health check: `/health` returns dependency status (useful for orchestration and monitoring).

Logging and secrets
- Do not commit real secrets. Use environment variables or your secret manager.
- The server will log degraded status when AI dependencies are unavailable but will not print secret values.
```

- **Run frontend (development):**

```bash
# from the project root
npm run dev
```

- **Running in CI / Production:**
    - Provide secrets via your CI environment variables/secrets (do not store real secrets in the repository).
    - Use the environment variables directly in your process manager (systemd, Docker, Kubernetes, etc.).

**Security notes**

- `.env` and other secret files are ignored by `.gitignore` by default. The repo includes `!.env.example` so the example can be committed while real secrets remain ignored.
- Avoid printing secrets to stdout or logs. The backend no longer prints the API key at startup.


## File Organization

### HTML Files
- Semantic HTML5 structure
- Consistent navigation across pages
- Proper meta tags for SEO and responsiveness

### CSS Architecture
- Tailwind CSS for utility-first styling
- Custom animations and transitions
- Dark mode support
- Print styles included

### JavaScript Functionality
- Modular code organization
- Event-driven architecture
- Local storage for preferences
- Simulated API interactions

## Customization

### Tailwind Theme

For a complete guide to all custom theme values (colors, fonts, animations, container settings), see the **[Tailwind Theme Guide](docs/tailwind-theme-guide.md)**.

### Colors
The primary color scheme can be modified in the Tailwind config (`tailwind.config.js`):
```javascript
colors: {
    primary: { DEFAULT: '#2563EB', /* ...shades */ },  // Brand blue
    success: { DEFAULT: '#16A34A', /* ...shades */ },  // Positive states
    warning: { DEFAULT: '#CA8A04', /* ...shades */ },  // Caution states
    error:   { DEFAULT: '#DC2626', /* ...shades */ },  // Error states
    info:    { DEFAULT: '#0EA5E9', /* ...shades */ },  // Informational
    background: { light: '#F3F4F6', dark: '#111827' }, // Page backgrounds
}
```

### Content
- Update company information in headers/footers
- Modify feature descriptions and benefits
- Customize legal disclaimers and privacy notices

### Functionality
- Integrate with actual backend APIs
- Add real authentication
- Implement document processing workflows

## Performance Optimizations

- **CDN Resources**: Fonts and Tailwind CSS from CDN
- **Optimized Images**: Proper sizing and lazy loading
- **Minimal JavaScript**: Essential functionality only
- **CSS Efficiency**: Utility-first approach reduces custom CSS

## Security Considerations

- **Input Validation**: File type and size checking
- **XSS Prevention**: Proper content sanitization
- **Secure Headers**: Content Security Policy recommendations
- **Privacy**: No sensitive data stored locally

## Future Enhancements

- **Backend Integration**: Real document processing API
- **User Authentication**: Login/registration system
- **Payment Processing**: Subscription management
- **Advanced Analytics**: Usage tracking and insights
- **Mobile App**: React Native or Flutter application

## Support

For questions or issues:
1. Check the browser console for JavaScript errors
2. Ensure files are served via HTTP (not file://)
3. Verify Tailwind CSS is loading correctly
4. Test with different browsers and devices

## 🧑‍💻 How to Contribute

Please follow the steps below to contribute to this project.

## 🤝 Contributing Guide (For Beginners)

We welcome contributions from beginners and open-source enthusiasts! Follow these steps to get started:

### 1️⃣ Fork the Repository

* Go to the project repository
* Click on the **Fork** button (top right)
* This creates a copy of the repository in your GitHub account

---

### 2️⃣ Clone the Repository

Open your terminal and run:

```bash
git clone https://github.com/YOUR-USERNAME/LegalEase.git
cd LegalEase
```

---

### 3️⃣ Create a New Branch

Always create a new branch before making changes:

```bash
git checkout -b your-branch-name
```

---

### 4️⃣ Make Changes

* Open the project in a code editor (e.g., VS Code)
* Make your desired changes (e.g., improve README, fix UI, add features)

---

### 5️⃣ Stage and Commit Changes

```bash
git add .
git commit -m "Describe your changes clearly"
```

---

### 6️⃣ Push Changes to GitHub

```bash
git push origin your-branch-name
```

---

### 7️⃣ Create a Pull Request (PR)

* Go to your forked repository on GitHub
* Click on **Compare & Pull Request**
* Add a clear title and description
* Submit the PR for review

---

### 8️⃣ Raising an Issue

Before starting work:

* Go to the **Issues** tab
* Check if the issue already exists
* If not, click **New Issue**
* Clearly describe the problem or improvement

---

### ✅ Contribution Tips

* Keep your PR small and focused
* Follow proper commit message format
* Avoid making unrelated changes
* Be respectful in discussions

---

Thank you for contributing to LegalEase! 🚀

## 🚀 First Time Contributor?

If you're new to open source:

- Look for beginner-friendly issues
- Read CONTRIBUTING.md
- Ask questions through Issues
- Submit your first PR

Every contribution matters!

## 📜 Code of Conduct

Please read our CODE_OF_CONDUCT.md before participating in the community.

By contributing, you agree to maintain a respectful and inclusive environment.


## ♿ Accessibility

LegalEase is committed to web accessibility best practices:

- **Reduced Motion Support**: Custom animations (`slide-up`, `spin-slow`) and CSS transitions are automatically disabled when users enable the `prefers-reduced-motion: reduce` system setting. This ensures a comfortable experience for users with motion sensitivity or vestibular disorders.
- **Semantic Color Tokens**: Success, warning, error, and info states use accessible color contrasts (see #184).
- **Keyboard Navigation**: All interactive elements are keyboard-accessible.

To enable reduced motion on your system:
- **macOS**: System Settings → Accessibility → Display → Reduce motion
- **Windows**: Settings → Accessibility → Visual effects → Animation effects
- **Linux**: Varies by desktop environment (GNOME: Accessibility → Reduce Animation)

## License

This project is intended for demonstration purposes. Please ensure proper licensing for any production use.

---

**LegalEase** - Making legal documents accessible and understandable for everyone.
