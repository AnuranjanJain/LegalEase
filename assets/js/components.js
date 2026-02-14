/**
 * Shared Components for LegalEase
 * Handles dynamic injection of common UI elements like Header and Footer.
 */

function initHeader() {
    const headerContainer = document.getElementById('global-header');
    if (!headerContainer) return;

    const isSubPage = window.location.pathname.includes('/pages/');
    const basePath = isSubPage ? '../' : './';
    const pagesPath = isSubPage ? '' : 'pages/';

    headerContainer.innerHTML = `
        <div class="container mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex items-center justify-between h-16">
                <!-- Logo & Brand -->
                <div class="flex items-center gap-4">
                    <a href="${basePath}index.html" class="flex items-center gap-4">
                        <div class="text-primary">
                            <svg class="h-8 w-8" fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                                <path d="M44 11.2727C44 14.0109 39.8386 16.3957 33.69 17.6364C39.8386 18.877 44 21.2618 44 24C44 26.7382 39.8386 29.123 33.69 30.3636C39.8386 31.6043 44 33.9891 44 36.7273C44 40.7439 35.0457 44 24 44C12.9543 44 4 40.7439 4 36.7273C4 33.9891 8.16144 31.6043 14.31 30.3636C8.16144 29.123 4 26.7382 4 24C4 21.2618 8.16144 18.877 14.31 17.6364C8.16144 16.3957 4 14.0109 4 11.2727C4 7.25611 12.9543 4 24 4C35.0457 4 44 7.25611 44 11.2727Z" fill="currentColor"></path>
                            </svg>
                        </div>
                        <h1 class="text-xl font-bold text-gray-900 dark:text-white">LegalEase</h1>
                    </a>
                </div>

                <!-- Desktop Navigation -->
                <nav class="hidden md:flex items-center space-x-8">
                    <a class="nav-link text-sm font-medium transition-colors" href="${basePath}index.html">Home</a>
                    <a class="nav-link text-sm font-medium transition-colors" href="${basePath}${pagesPath}dashboard.html">Dashboard</a>
                    <a class="nav-link text-sm font-medium transition-colors" href="${basePath}${pagesPath}documents.html">Documents</a>
                    <a class="nav-link text-sm font-medium transition-colors" href="${basePath}${pagesPath}chatbot.html">Chatbot</a>
                    <a class="nav-link text-sm font-medium transition-colors" href="${basePath}${pagesPath}profile.html">Profile</a>
                </nav>

                <!-- Actions -->
                <div class="flex items-center gap-2 sm:gap-4">
                    <button id="dark-mode-toggle" class="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" aria-label="Toggle dark mode">
                        <span class="material-symbols-outlined">dark_mode</span>
                    </button>
                    
                    <button class="hidden sm:flex p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" aria-label="View notifications">
                        <span class="material-symbols-outlined">notifications</span>
                    </button>

                    <!-- Mobile Menu Button -->
                    <button id="mobile-menu-button" class="flex md:hidden p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" aria-expanded="false" aria-label="Open main menu">
                        <span class="material-symbols-outlined">menu</span>
                    </button>

                    <!-- Profile Dropdown Container -->
                    <div class="relative ml-2">
                        <button id="user-menu-button" class="flex items-center focus:outline-none" aria-haspopup="true" aria-expanded="false" aria-label="Open user profile menu">
                            <img alt="User profile picture" class="h-10 w-10 rounded-full border-2 border-transparent hover:border-primary transition-all object-cover" src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&auto=format&fit=crop&w=128&q=80"/>
                        </button>
                        <!-- Dropdown (Hidden by default) -->
                        <div id="user-menu" class="hidden absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 focus:outline-none z-50 animate-slide-up">
                            <a href="${basePath}${pagesPath}profile.html" class="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">Your Profile</a>
                            <a href="#" class="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">Settings</a>
                            <hr class="border-gray-200 dark:border-gray-700 my-1">
                            <a href="#" class="block px-4 py-2 text-sm text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700">Sign out</a>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Mobile menu -->
            <div id="mobile-menu" class="hidden md:hidden pb-4 pt-2">
                <div class="flex flex-col space-y-1">
                    <a class="nav-link block px-3 py-2 rounded-md text-base font-medium transition-colors" href="${basePath}index.html">Home</a>
                    <a class="nav-link block px-3 py-2 rounded-md text-base font-medium transition-colors" href="${basePath}${pagesPath}dashboard.html">Dashboard</a>
                    <a class="nav-link block px-3 py-2 rounded-md text-base font-medium transition-colors" href="${basePath}${pagesPath}documents.html">Documents</a>
                    <a class="nav-link block px-3 py-2 rounded-md text-base font-medium transition-colors" href="${basePath}${pagesPath}chatbot.html">Chatbot</a>
                    <a class="nav-link block px-3 py-2 rounded-md text-base font-medium transition-colors" href="${basePath}${pagesPath}profile.html">Profile</a>
                </div>
            </div>
        </div>
    `;

    // Highlight active link
    const currentPath = window.location.pathname;
    document.querySelectorAll('.nav-link').forEach(link => {
        const linkHref = link.getAttribute('href').split('/').pop();
        if (currentPath.endsWith(linkHref) || (currentPath.endsWith('/') && linkHref === 'index.html')) {
            link.classList.add('text-primary');
            link.classList.remove('text-gray-600', 'dark:text-gray-300');
        } else {
            link.classList.add('text-gray-600', 'dark:text-gray-300');
            link.classList.remove('text-primary');
        }
    });

    // Profile Dropdown functionality
    const userMenuButton = document.getElementById('user-menu-button');
    const userMenu = document.getElementById('user-menu');
    if (userMenuButton && userMenu) {
        userMenuButton.addEventListener('click', (e) => {
            e.stopPropagation();
            userMenu.classList.toggle('hidden');
        });
        document.addEventListener('click', () => userMenu.classList.add('hidden'));
    }

    // Mobile Menu functionality
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');
    if (mobileMenuButton && mobileMenu) {
        mobileMenuButton.addEventListener('click', (e) => {
            e.stopPropagation();
            const isHidden = mobileMenu.classList.toggle('hidden');
            mobileMenuButton.setAttribute('aria-expanded', !isHidden);
            mobileMenuButton.querySelector('.material-symbols-outlined').textContent = isHidden ? 'menu' : 'close';
        });
        document.addEventListener('click', () => {
            mobileMenu.classList.add('hidden');
            mobileMenuButton.setAttribute('aria-expanded', 'false');
            mobileMenuButton.querySelector('.material-symbols-outlined').textContent = 'menu';
        });
    }
}

function initFooter() {
    const footerContainer = document.getElementById('global-footer');
    if (!footerContainer) return;

    const isSubPage = window.location.pathname.includes('/pages/');
    const basePath = isSubPage ? '../' : './';
    const pagesPath = isSubPage ? '' : 'pages/';

    footerContainer.innerHTML = `
        <div class="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div class="grid grid-cols-1 md:grid-cols-4 gap-8">
                <div class="col-span-1 md:col-span-1">
                    <a href="${basePath}index.html" class="flex items-center gap-4 mb-4">
                        <div class="text-primary">
                            <svg class="h-6 w-6" fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                                <path d="M44 11.2727C44 14.0109 39.8386 16.3957 33.69 17.6364C39.8386 18.877 44 21.2618 44 24C44 26.7382 39.8386 29.123 33.69 30.3636C39.8386 31.6043 44 33.9891 44 36.7273C44 40.7439 35.0457 44 24 44C12.9543 44 4 40.7439 4 36.7273C4 33.9891 8.16144 31.6043 14.31 30.3636C8.16144 29.123 4 26.7382 4 24C4 21.2618 8.16144 18.877 14.31 17.6364C8.16144 16.3957 4 14.0109 4 11.2727C4 7.25611 12.9543 4 24 4C35.0457 4 44 7.25611 44 11.2727Z" fill="currentColor"></path>
                            </svg>
                        </div>
                        <h2 class="text-lg font-bold text-gray-900 dark:text-white">LegalEase</h2>
                    </a>
                    <p class="text-sm text-gray-600 dark:text-gray-400">Revolutionizing legal document processing with AI-powered insights and automation.</p>
                </div>
                <div>
                    <h3 class="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">Product</h3>
                    <ul class="space-y-2">
                        <li><a href="${basePath}${pagesPath}dashboard.html" class="text-sm text-gray-600 dark:text-gray-400 hover:text-primary transition-colors">Dashboard</a></li>
                        <li><a href="${basePath}${pagesPath}documents.html" class="text-sm text-gray-600 dark:text-gray-400 hover:text-primary transition-colors">Documents</a></li>
                        <li><a href="${basePath}${pagesPath}chatbot.html" class="text-sm text-gray-600 dark:text-gray-400 hover:text-primary transition-colors">Legal AI Chat</a></li>
                    </ul>
                </div>
                <div>
                    <h3 class="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">Support</h3>
                    <ul class="space-y-2">
                        <li><a href="#" class="text-sm text-gray-600 dark:text-gray-400 hover:text-primary transition-colors">Documentation</a></li>
                        <li><a href="#" class="text-sm text-gray-600 dark:text-gray-400 hover:text-primary transition-colors">Help Center</a></li>
                        <li><a href="#" class="text-sm text-gray-600 dark:text-gray-400 hover:text-primary transition-colors">Privacy Policy</a></li>
                    </ul>
                </div>
                <div>
                    <h3 class="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">Connect</h3>
                    <div class="flex space-x-4">
                        <a href="#" class="text-gray-400 hover:text-primary transition-colors" aria-label="Follow us on Twitter">
                            <svg class="h-6 w-6" fill="currentColor" viewBox="0 0 24 24"><path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/></svg>
                        </a>
                        <a href="#" class="text-gray-400 hover:text-primary transition-colors" aria-label="Join our LinkedIn">
                            <svg class="h-6 w-6" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
                        </a>
                    </div>
                </div>
            </div>
            <div class="mt-12 pt-8 border-t border-gray-200 dark:border-gray-800 flex flex-col md:flex-row justify-between items-center gap-4">
                <p class="text-sm text-gray-500 dark:text-gray-400">&copy; 2024 LegalEase Inc. All rights reserved.</p>
                <div class="flex gap-6">
                    <a href="#" class="text-xs text-gray-500 dark:text-gray-400 hover:text-primary transition-colors">Terms of Service</a>
                    <a href="#" class="text-xs text-gray-500 dark:text-gray-400 hover:text-primary transition-colors">Privacy</a>
                </div>
            </div>
        </div>
    `;
}

// Export for main.js
window.LegalEaseComponents = {
    initHeader,
    initFooter
};
