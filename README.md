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
legal-ease-website/
├── index.html                 # Main home page
├── assets/
│   ├── css/
│   │   └── styles.css         # Common styles and animations
│   └── js/
│       └── main.js            # JavaScript functionality
└── pages/
    ├── dashboard.html         # User dashboard
    ├── documents.html         # Document upload & management
    ├── chatbot.html           # AI legal assistant
    ├── processing.html        # Document processing status
    └── profile.html           # User profile & settings
```

## Features

### 🏠 Home Page (`index.html`)

- **Hero Section**: Compelling introduction with call-to-action buttons
- **Features Overview**: Document summary, jargon explanations, and risk alerts
- **Quick Actions**: Direct access to main features
- **Security Information**: Trust indicators and compliance details
- **Responsive Design**: Mobile-friendly layout

### 📊 Dashboard (`pages/dashboard.html`)

- **Statistics Overview**: Document counts, processing status, and time saved
- **Quick Actions**: Fast access to upload, chat, and processing
- **Recent Activity**: Timeline of user actions
- **Recent Documents**: Latest uploaded files with status indicators

### 📄 Document Upload (`pages/documents.html`)

- **Drag & Drop Interface**: Intuitive file upload experience
- **File Validation**: Type and size checking (PDF, DOCX, TXT up to 25MB)
- **Feature Explanation**: Clear description of AI capabilities
- **Recent Documents**: History with processing status

### 🤖 AI Chatbot (`pages/chatbot.html`)

- **Interactive Chat Interface**: Real-time conversation with AI
- **Legal Topics Sidebar**: Quick access to common questions
- **Message History**: Persistent conversation log
- **Legal Disclaimer**: Important usage guidelines

### ⚙️ Processing Status (`pages/processing.html`)

- **Real-time Progress**: Step-by-step processing visualization
- **Animated Progress Bars**: Visual feedback for each stage
- **Processing History**: Past document processing records
- **Status Management**: Cancel, retry, and download options

### 👤 User Profile (`pages/profile.html`)

- **Personal Information**: Complete profile management
- **Address Details**: Billing and contact information
- **Preferences**: Language, timezone, and notification settings
- **Account Statistics**: Usage metrics and achievements

## Technology Stack

- **Frontend**: HTML5, CSS3 (Tailwind CSS), JavaScript (ES6+)
- **Icons**: Material Symbols Outlined
- **Fonts**: Inter (Google Fonts)
- **Styling**: Tailwind CSS with custom utility classes
- **Responsive**: Mobile-first design approach

## Key Features

### 🎨 Design Elements

- **Consistent Color Scheme**: Primary blue (#197fe6) with light/dark theme support
- **Material Design Icons**: Google Material Symbols
- **Smooth Animations**: CSS transitions and JavaScript-powered interactions
- **Accessibility**: Proper ARIA labels and keyboard navigation

### 📱 Responsive Design

- **Mobile Navigation**: Collapsible menu for smaller screens
- **Flexible Layouts**: CSS Grid and Flexbox for optimal viewing
- **Touch-Friendly**: Appropriately sized interactive elements

### 🔧 Interactive Features

- **File Upload**: Drag & drop with progress indication
- **Chat Interface**: Real-time messaging simulation
- **Processing Animation**: Step-by-step progress visualization
- **Notifications**: Toast-style messages for user feedback

## Browser Support

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## Setup Instructions

1. **Clone or Download**: Get the project files
2. **Web Server**: Serve the files through a web server (not file://)
   - Python: `python -m http.server 8000`
   - Node.js: `npx http-server`
   - PHP: `php -S localhost:8000`
3. **Open Browser**: Navigate to `http://localhost:8000`

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

### Colors

The primary color scheme can be modified in the Tailwind config:

```javascript
colors: {
    "primary": "#197fe6",        // Main brand color
    "background-light": "#f6f7f8", // Light theme background
    "background-dark": "#111921",   // Dark theme background
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

- Go to the project repository
- Click on the **Fork** button (top right)
- This creates a copy of the repository in your GitHub account

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

- Open the project in a code editor (e.g., VS Code)
- Make your desired changes (e.g., improve README, fix UI, add features)

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

- Go to your forked repository on GitHub
- Click on **Compare & Pull Request**
- Add a clear title and description
- Submit the PR for review

---

### 8️⃣ Raising an Issue

Before starting work:

- Go to the **Issues** tab
- Check if the issue already exists
- If not, click **New Issue**
- Clearly describe the problem or improvement

---

### ✅ Contribution Tips

- Keep your PR small and focused
- Follow proper commit message format
- Avoid making unrelated changes
- Be respectful in discussions

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



## License

This project is intended for demonstration purposes. Please ensure proper licensing for any production use.

---

**LegalEase** - Making legal documents accessible and understandable for everyone.
