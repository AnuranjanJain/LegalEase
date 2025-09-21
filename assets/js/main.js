// Common JavaScript for LegalEase Website

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initNavigation();
    initFileUpload();
    initChatbot();
    initProcessingAnimation();
    initDarkMode();
    initNotifications();
});

// Navigation functionality
function initNavigation() {
    // Mobile menu toggle
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');
    
    if (mobileMenuButton && mobileMenu) {
        mobileMenuButton.addEventListener('click', function() {
            mobileMenu.classList.toggle('hidden');
        });
        
        // Close mobile menu when clicking outside
        document.addEventListener('click', function(e) {
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
        dropzone.addEventListener('dragover', function(e) {
            e.preventDefault();
            dropzone.classList.add('dragover');
        });
        
        dropzone.addEventListener('dragleave', function(e) {
            e.preventDefault();
            dropzone.classList.remove('dragover');
        });
        
        dropzone.addEventListener('drop', function(e) {
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
            browseButton.addEventListener('click', function() {
                if (fileInput) {
                    fileInput.click();
                }
            });
        }
        
        if (fileInput) {
            fileInput.addEventListener('change', function() {
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
    
    // Simulate upload progress
    simulateUpload(file);
}

// Simulate file upload and redirect to processing page
function simulateUpload(file) {
    let progress = 0;
    const interval = setInterval(() => {
        progress += Math.random() * 20;
        if (progress >= 100) {
            clearInterval(interval);
            showNotification('Document uploaded successfully! Redirecting to processing...', 'success');
            setTimeout(() => {
                window.location.href = 'pages/processing.html';
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
        chatInput.addEventListener('keypress', function(e) {
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
        darkModeToggle.addEventListener('click', function() {
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

// Export functions for use in other scripts
window.LegalEase = {
    showNotification,
    handleFileUpload,
    formatFileSize,
    formatTimeAgo
};
