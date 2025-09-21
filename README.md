# LegalEase Website

A comprehensive legal document analysis platform that combines AI-powered document processing, chatbot assistance, and user-friendly interfaces.

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

## License

This project is intended for demonstration purposes. Please ensure proper licensing for any production use.

---

**LegalEase** - Making legal documents accessible and understandable for everyone.
