// Common JavaScript for LegalEase Website

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', function () {
    // Initialize services
    if (!StorageService.getDocuments().length) {
        StorageService.initSampleData();
    }

    initNavigation();
    initFileUpload();
    initChatbot();
    initProcessingAnimation();
    initDarkMode();
    initNotifications();

    // Page-specific initializations
    const path = window.location.pathname;
    if (path.includes('dashboard.html')) {
        renderDashboard();
    } else if (path.includes('documents.html')) {
        renderDocumentsPage();
    } else if (path.includes('profile.html')) {
        renderProfilePage();
    } else if (path.includes('processing.html')) {
        renderProcessingPage();
    }
});

// Storage Service for persistence
const StorageService = {
    getDocuments: function () {
        const docs = localStorage.getItem('le_documents');
        return docs ? JSON.parse(docs) : [];
    },

    saveDocument: function (doc) {
        const docs = this.getDocuments();
        docs.unshift(doc); // Add to beginning
        localStorage.setItem('le_documents', JSON.stringify(docs));

        // Trigger re-render if on relevant pages
        if (window.location.pathname.includes('dashboard.html')) renderDashboard();
        if (window.location.pathname.includes('documents.html')) renderDocumentsPage();
    },

    getDocument: function (id) {
        const docs = this.getDocuments();
        return docs.find(d => d.id === id);
    },

    updateDocumentStatus: function (id, status) {
        const docs = this.getDocuments();
        const docIndex = docs.findIndex(d => d.id === id);
        if (docIndex !== -1) {
            docs[docIndex].status = status;
            docs[docIndex].processedDate = new Date().toISOString();
            localStorage.setItem('le_documents', JSON.stringify(docs));

            if (window.location.pathname.includes('dashboard.html')) renderDashboard();
            if (window.location.pathname.includes('documents.html')) renderDocumentsPage();
        }
    },

    getProfile: function () {
        const profile = localStorage.getItem('le_profile');
        return profile ? JSON.parse(profile) : this.initSampleProfile();
    },

    saveProfile: function (profile) {
        localStorage.setItem('le_profile', JSON.stringify(profile));
        showNotification('Profile saved successfully!', 'success');
    },

    initSampleProfile: function () {
        const defaultProfile = {
            firstName: 'Sarah',
            lastName: 'Johnson',
            email: 'sarah.johnson@email.com',
            phone: '+1 (555) 123-4567',
            bio: 'Legal professional with 5+ years of experience in contract law and compliance.',
            address: {
                street: '123 Main Street, Apt 4B',
                city: 'New York',
                state: 'NY',
                zip: '10001'
            },
            preferences: {
                language: 'en',
                timezone: 'EST',
                notifications: {
                    documents: true,
                    security: true,
                    marketing: false
                }
            }
        };
        localStorage.setItem('le_profile', JSON.stringify(defaultProfile));
        return defaultProfile;
    },

    initSampleData: function () {
        const sampleDocs = [
            {
                id: 'doc_1',
                name: 'Lease Agreement - Apartment 4B.pdf',
                type: 'pdf',
                size: 2400000,
                uploadDate: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
                status: 'processed'
            },
            {
                id: 'doc_2',
                name: 'Employment Contract - TechCorp.docx',
                type: 'docx',
                size: 1800000,
                uploadDate: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
                status: 'processing'
            },
            {
                id: 'doc_3',
                name: 'Privacy Policy Update.pdf',
                type: 'pdf',
                size: 952000,
                uploadDate: new Date(Date.now() - 259200000).toISOString(), // 3 days ago
                status: 'processed'
            }
        ];
        localStorage.setItem('le_documents', JSON.stringify(sampleDocs));
    }
};

// Rendering Functions
function renderProfilePage() {
    const profile = StorageService.getProfile();

    // Helper to safely set value
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val || '';
    };

    const setCheck = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.checked = !!val;
    };

    // Load values
    setVal('first-name', profile.firstName);
    setVal('last-name', profile.lastName);
    setVal('email', profile.email);
    setVal('phone-number', profile.phone);
    setVal('bio', profile.bio);

    setVal('street-address', profile.address.street);
    setVal('city', profile.address.city);
    setVal('region', profile.address.state);
    setVal('postal-code', profile.address.zip);

    setVal('language', profile.preferences.language);
    setVal('timezone', profile.preferences.timezone);

    setCheck('email-documents', profile.preferences.notifications.documents);
    setCheck('email-security', profile.preferences.notifications.security);
    setCheck('email-marketing', profile.preferences.notifications.marketing);

    // Bind Save Button
    const saveBtn = document.getElementById('save-profile-btn');
    if (saveBtn) {
        // Remove old listeners to avoid duplicates if re-initialized (though mostly page reload)
        const newBtn = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newBtn, saveBtn);

        newBtn.addEventListener('click', function () {
            const getVal = (id) => document.getElementById(id)?.value || '';
            const getCheck = (id) => document.getElementById(id)?.checked || false;

            const updatedProfile = {
                firstName: getVal('first-name'),
                lastName: getVal('last-name'),
                email: getVal('email'),
                phone: getVal('phone-number'),
                bio: getVal('bio'),
                address: {
                    street: getVal('street-address'),
                    city: getVal('city'),
                    state: getVal('region'),
                    zip: getVal('postal-code')
                },
                preferences: {
                    language: getVal('language'),
                    timezone: getVal('timezone'),
                    notifications: {
                        documents: getCheck('email-documents'),
                        security: getCheck('email-security'),
                        marketing: getCheck('email-marketing')
                    }
                }
            };

            StorageService.saveProfile(updatedProfile);
        });
    }
}

function renderProcessingPage() {
    const container = document.getElementById('processing-history-list');

    const docs = StorageService.getDocuments();

    // Filter out the current one if we are processing one
    const urlParams = new URLSearchParams(window.location.search);
    const currentDocId = urlParams.get('id');

    // Update current doc info if available
    if (currentDocId) {
        const currentDoc = StorageService.getDocument(currentDocId);
        if (currentDoc) {
            const nameEl = document.getElementById('processing-doc-name');
            const metaEl = document.getElementById('processing-doc-meta');
            if (nameEl) nameEl.textContent = currentDoc.name;
            if (metaEl) metaEl.textContent = `${formatFileSize(currentDoc.size)} • ${currentDoc.type.toUpperCase()}`;
        }
    }

    if (!container) return;

    const displayDocs = docs.filter(d => d.id !== currentDocId).slice(0, 5); // Show last 5

    if (displayDocs.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-500">No recent history.</p>';
        return;
    }

    container.innerHTML = displayDocs.map(doc => {
        // Simple status color logic reusing existing global function or inline
        const getStatusColor = (s) => s === 'processed' ? 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400' : (s === 'processing' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400');
        const getStatusIcon = (s) => s === 'processed' ? 'check_circle' : (s === 'processing' ? 'autorenew' : 'error');
        const getStatusBadgeColor = (s) => s === 'processed' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : (s === 'processing' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200');

        return `
        <div class="bg-white dark:bg-background-dark rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-4">
                    <div class="flex h-10 w-10 items-center justify-center rounded-lg ${getStatusColor(doc.status)}">
                        <span class="material-symbols-outlined">${getStatusIcon(doc.status)}</span>
                    </div>
                    <div>
                        <h3 class="font-medium text-gray-900 dark:text-white">${doc.name}</h3>
                        <p class="text-sm text-gray-500 dark:text-gray-400">${doc.status} • ${formatTimeAgo(new Date(doc.uploadDate))}</p>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(doc.status)}">
                        ${doc.status}
                    </span>
                    ${doc.status === 'processed' ? `
                    <button class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                        <span class="material-symbols-outlined">download</span>
                    </button>` : ''}
                </div>
            </div>
        </div>
    `}).join('');
}

function renderDashboard() {
    const docs = StorageService.getDocuments();

    // Update Stats
    const totalDocs = docs.length;
    const processedDocs = docs.filter(d => d.status === 'processed').length;
    const processingDocs = docs.filter(d => d.status === 'processing').length;

    const totalEl = document.getElementById('stats-total');
    const processedEl = document.getElementById('stats-processed');
    const processingEl = document.getElementById('stats-processing');

    if (totalEl) totalEl.textContent = totalDocs;
    if (processedEl) processedEl.textContent = processedDocs;
    if (processingEl) processingEl.textContent = processingDocs;

    // Render Recent Documents
    const listContainer = document.getElementById('recent-documents-list');
    if (listContainer) {
        listContainer.innerHTML = '';
        docs.slice(0, 5).forEach(doc => {
            const html = createDocumentItemHTML(doc);
            listContainer.insertAdjacentHTML('beforeend', html);
        });
    }
}

function renderDocumentsPage() {
    const docs = StorageService.getDocuments();
    const listContainer = document.getElementById('documents-list');

    if (listContainer) {
        listContainer.innerHTML = '';
        docs.forEach(doc => {
            const html = createDocumentItemHTML(doc);
            listContainer.insertAdjacentHTML('beforeend', html);
        });
    }
}

function createDocumentItemHTML(doc) {
    const iconClass = doc.type === 'pdf' ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30' : 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30';
    const iconName = doc.type === 'pdf' ? 'picture_as_pdf' : 'description';

    const statusClass = doc.status === 'processed'
        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';

    return `
        <div class="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-background-dark/50 mb-4 transition-all hover:shadow-md">
            <div class="flex items-center gap-4">
                <div class="flex h-10 w-10 items-center justify-center rounded-lg ${iconClass}">
                    <span class="material-symbols-outlined">${iconName}</span>
                </div>
                <div>
                    <h3 class="font-medium text-gray-900 dark:text-white">${doc.name}</h3>
                    <p class="text-sm text-gray-500 dark:text-gray-400">Uploaded ${formatTimeAgo(new Date(doc.uploadDate))} • ${formatFileSize(doc.size)}</p>
                </div>
            </div>
            <div class="flex items-center gap-2">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusClass}">
                    ${doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}
                </span>
                <button class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                    <span class="material-symbols-outlined">more_vert</span>
                </button>
            </div>
        </div>
    `;
}

// Navigation functionality
function initNavigation() {
    // Mobile menu toggle
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');

    if (mobileMenuButton && mobileMenu) {
        mobileMenuButton.addEventListener('click', function () {
            mobileMenu.classList.toggle('hidden');
        });

        // Close mobile menu when clicking outside
        document.addEventListener('click', function (e) {
            if (!mobileMenuButton.contains(e.target) && !mobileMenu.contains(e.target)) {
                mobileMenu.classList.add('hidden');
            }
        });
    }

    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });
}

// File upload functionality
function initFileUpload() {
    const dropzone = document.querySelector('.dropzone');
    const fileInput = document.getElementById('file-input');

    if (dropzone) {
        // Drag and drop handlers
        dropzone.addEventListener('dragover', function (e) {
            e.preventDefault();
            dropzone.classList.add('dragover');
        });

        dropzone.addEventListener('dragleave', function (e) {
            e.preventDefault();
            dropzone.classList.remove('dragover');
        });

        dropzone.addEventListener('drop', function (e) {
            e.preventDefault();
            dropzone.classList.remove('dragover');

            const files = e.dataTransfer.files;
            if (files.length > 0) {
                handleFileUpload(files[0]);
            }
        });

        // Click to upload
        const browseButton = dropzone.querySelector('button');
        if (browseButton) {
            browseButton.addEventListener('click', function () {
                if (fileInput) {
                    fileInput.click();
                }
            });
        }

        if (fileInput) {
            fileInput.addEventListener('change', function () {
                if (this.files.length > 0) {
                    handleFileUpload(this.files[0]);
                }
            });
        }
    }
}

// Handle file upload
function handleFileUpload(file) {
    // Validate file type
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
    if (!allowedTypes.includes(file.type)) {
        showNotification('Please upload a PDF, DOCX, or TXT file.', 'error');
        return;
    }

    // Validate file size (25MB max)
    const maxSize = 25 * 1024 * 1024; // 25MB in bytes
    if (file.size > maxSize) {
        showNotification('File size must be less than 25MB.', 'error');
        return;
    }

    // Show upload progress
    showNotification('Uploading document...', 'info');

    // Create new document object
    const newDoc = {
        id: 'doc_' + Date.now(),
        name: file.name,
        type: file.name.endsWith('.pdf') ? 'pdf' : (file.name.endsWith('.docx') ? 'docx' : 'txt'),
        size: file.size,
        uploadDate: new Date().toISOString(),
        status: 'uploading'
    };

    // Save initial state
    StorageService.saveDocument(newDoc);

    // Simulate upload progress
    simulateUpload(newDoc.id);
}

// Simulate file upload and redirect to processing page
function simulateUpload(docId) {
    let progress = 0;
    const interval = setInterval(() => {
        progress += Math.random() * 20;
        if (progress >= 100) {
            clearInterval(interval);

            // Update status to processing
            StorageService.updateDocumentStatus(docId, 'processing');

            showNotification('Document uploaded successfully! Redirecting to processing...', 'success');

            // Simulate processing completion after a delay
            setTimeout(() => {
                StorageService.updateDocumentStatus(docId, 'processed');
                showNotification('Document analysis complete!', 'success');
            }, 5000);

            setTimeout(() => {
                window.location.href = 'processing.html?id=' + docId;
            }, 1500);
        }
    }, 200);
}

// Chatbot functionality
function initChatbot() {
    const chatInput = document.querySelector('.chat-input input');
    const sendButton = document.querySelector('.chat-send-button');
    const chatMessages = document.querySelector('.chat-messages');

    if (chatInput && sendButton) {
        // Send message on button click
        sendButton.addEventListener('click', sendMessage);

        // Send message on Enter key
        chatInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    }

    function sendMessage() {
        const message = chatInput.value.trim();
        if (message) {
            addChatMessage(message, 'user');
            chatInput.value = '';

            // Simulate AI response
            setTimeout(() => {
                const responses = [
                    "I understand your question. Let me help you with that legal matter.",
                    "That's a great question about legal rights. Here's what you need to know...",
                    "Based on general legal principles, I can provide you with some guidance.",
                    "For this type of legal issue, you should consider the following points..."
                ];
                const randomResponse = responses[Math.floor(Math.random() * responses.length)];
                addChatMessage(randomResponse, 'ai');
            }, 1000);
        }
    }

    function addChatMessage(message, sender) {
        if (chatMessages) {
            const messageDiv = document.createElement('div');
            messageDiv.className = `chat-message ${sender}`;
            messageDiv.innerHTML = `
                <div class="chat-bubble ${sender}">
                    <p>${message}</p>
                </div>
            `;
            chatMessages.appendChild(messageDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }
}

// Processing animation
function initProcessingAnimation() {
    const processingSteps = document.querySelectorAll('.processing-step');

    if (processingSteps.length > 0) {
        animateProcessingSteps(processingSteps);
    }
}

function animateProcessingSteps(steps) {
    let currentStep = 0;

    const interval = setInterval(() => {
        if (currentStep < steps.length) {
            // Mark current step as active
            steps[currentStep].classList.add('active');
            steps[currentStep].classList.remove('inactive');

            // Update progress bar if exists
            const progressBar = steps[currentStep].querySelector('.progress-bar');
            if (progressBar) {
                progressBar.style.width = '100%';
            }

            // Mark as completed after animation
            setTimeout(() => {
                steps[currentStep].classList.add('completed');
                const icon = steps[currentStep].querySelector('.step-icon');
                if (icon) {
                    icon.innerHTML = '<span class="material-symbols-outlined">check_circle</span>';
                }
                currentStep++;
            }, 2000);
        } else {
            clearInterval(interval);
            // Redirect to results or dashboard after completion
            setTimeout(() => {
                showNotification('Document processing completed!', 'success');
            }, 1000);
        }
    }, 2500);
}

// Dark mode toggle
function initDarkMode() {
    const darkModeToggle = document.getElementById('dark-mode-toggle');

    // Check for saved dark mode preference
    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    if (isDarkMode) {
        document.documentElement.classList.add('dark');
    }

    if (darkModeToggle) {
        darkModeToggle.addEventListener('click', function () {
            document.documentElement.classList.toggle('dark');
            const isDark = document.documentElement.classList.contains('dark');
            localStorage.setItem('darkMode', isDark);
        });
    }
}

// Notification system
function initNotifications() {
    // Create notification container if it doesn't exist
    if (!document.getElementById('notification-container')) {
        const container = document.createElement('div');
        container.id = 'notification-container';
        container.className = 'fixed top-4 right-4 z-50 space-y-2';
        document.body.appendChild(container);
    }
}

function showNotification(message, type = 'info', duration = 3000) {
    const container = document.getElementById('notification-container');
    if (!container) return;

    const notification = document.createElement('div');
    notification.className = `
        notification 
        bg-white dark:bg-gray-800 
        border border-gray-200 dark:border-gray-700 
        rounded-lg 
        shadow-lg 
        p-4 
        max-w-sm 
        transform 
        translate-x-full 
        transition-transform 
        duration-300 
        ease-in-out
    `;

    // Add type-specific styling
    const typeClasses = {
        success: 'border-green-500 text-green-800 dark:text-green-200',
        error: 'border-red-500 text-red-800 dark:text-red-200',
        warning: 'border-yellow-500 text-yellow-800 dark:text-yellow-200',
        info: 'border-blue-500 text-blue-800 dark:text-blue-200'
    };

    notification.className += ' ' + typeClasses[type];

    notification.innerHTML = `
        <div class="flex items-center gap-3">
            <div class="flex-1">
                <p class="text-sm font-medium">${message}</p>
            </div>
            <button class="notification-close text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <span class="material-symbols-outlined text-sm">close</span>
            </button>
        </div>
    `;

    container.appendChild(notification);

    // Animate in
    setTimeout(() => {
        notification.classList.remove('translate-x-full');
    }, 100);

    // Add close button functionality
    const closeButton = notification.querySelector('.notification-close');
    closeButton.addEventListener('click', () => removeNotification(notification));

    // Auto remove after duration
    if (duration > 0) {
        setTimeout(() => removeNotification(notification), duration);
    }
}

function removeNotification(notification) {
    notification.classList.add('translate-x-full');
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 300);
}

// Utility functions
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatTimeAgo(date) {
    const now = new Date();
    const diff = now - date;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
}

// Profile Persistence Service
const ProfileService = {
    getProfile: function () {
        const defaultProfile = {
            firstName: 'Sarah',
            lastName: 'Johnson',
            email: 'sarah.johnson@email.com',
            phone: '+1 (555) 123-4567',
            bio: 'Legal professional with 5+ years of experience in contract law and compliance.',
            address: {
                street: '123 Main Street, Apt 4B',
                city: 'New York',
                state: 'NY',
                zip: '10001'
            },
            preferences: {
                language: 'en',
                timezone: 'EST',
                notifications: {
                    documents: true,
                    security: true,
                    marketing: false
                }
            }
        };
        const stored = localStorage.getItem('legalEase_profile');
        return stored ? { ...defaultProfile, ...JSON.parse(stored) } : defaultProfile;
    },

    saveProfile: function (profile) {
        localStorage.setItem('legalEase_profile', JSON.stringify(profile));
        // Update header immediately if applicable
        updateHeaderProfile(profile);
        return profile;
    }
};

// Update Header Profile Info
function updateHeaderProfile(profile) {
    if (!profile) profile = ProfileService.getProfile();

    // This assumes specific classes or IDs in the header. 
    // Since the header is static HTML in every file, we need to target it broadly.
    // However, the current header doesn't actually display the NAME, only the avatar.
    // The Dashboard "Welcome back, Sarah!" needs updating.

    const welcomeMsg = document.querySelector('h1.text-3xl.font-bold'); // Targeting Dashboard Welcome
    if (welcomeMsg && welcomeMsg.textContent.includes('Welcome back,')) {
        welcomeMsg.textContent = `Welcome back, ${profile.firstName}!`;
    }
}

// Initialize Profile related things
function initUserProfile() {
    updateHeaderProfile();
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', function () {
    initNavigation();
    initFileUpload();
    initChatbot();
    initProcessingAnimation();
    initDarkMode();
    initNotifications();
    initUserProfile();
});

// Export functions for use in other scripts
window.LegalEase = {
    showNotification,
    handleFileUpload,
    formatFileSize,
    formatTimeAgo,
    DocumentService,
    ProfileService
};
