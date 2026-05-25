lucide.createIcons();

function isWebsiteLoggedIn() {
    try {
        const userRaw = localStorage.getItem('website_user') || sessionStorage.getItem('website_user') || localStorage.getItem('user') || sessionStorage.getItem('user');
        const token = localStorage.getItem('website_token') || sessionStorage.getItem('website_token') || localStorage.getItem('token') || sessionStorage.getItem('token');
        return !!userRaw && !!token;
    } catch (_error) {
        return false;
    }
}

function getWebsiteUser() {
    try {
        const raw = localStorage.getItem('website_user') || sessionStorage.getItem('website_user') || localStorage.getItem('user') || sessionStorage.getItem('user');
        return raw ? JSON.parse(raw) : null;
    } catch (_error) {
        return null;
    }
}

function syncMenuState() {
    const loggedIn = isWebsiteLoggedIn();
    const menuLoggedIn = document.getElementById('menu-logged-in');
    const menuLoggedOut = document.getElementById('menu-logged-out');
    const welcomeUserName = document.getElementById('welcomeUserName');
    const userIdDisplay = document.getElementById('userIdDisplay');
    const user = getWebsiteUser();

    if (menuLoggedIn) {
        menuLoggedIn.classList.toggle('hidden', !loggedIn);
    }
    if (menuLoggedOut) {
        menuLoggedOut.classList.toggle('hidden', loggedIn);
    }
    if (welcomeUserName) {
        welcomeUserName.textContent = loggedIn
            ? `Hi, ${user?.name || user?.firstName || user?.email || 'welcome'} 👋`
            : 'Hi, welcome 👋';
    }
    if (userIdDisplay) {
        userIdDisplay.textContent = loggedIn ? `ID: ${user?.loginId || user?.id || ''}` : '';
    }
}
        
        /*
        ============================================================
        JavaScript for Mobile Side Menu (from index)
        ============================================================
        */
        const menuToggle = document.getElementById('menu-toggle');
        const menuClose = document.getElementById('menu-close');
        const mobileMenu = document.getElementById('mobile-menu');
        const menuOverlay = document.getElementById('menu-overlay');

        if (menuToggle && mobileMenu && menuClose && menuOverlay) {
            menuToggle.addEventListener('click', () => {
                syncMenuState();
                mobileMenu.classList.remove('translate-x-full');
                menuOverlay.classList.remove('hidden');
                document.body.style.overflow = 'hidden'; // Prevent background scroll
            });

            const closeMenu = () => {
                mobileMenu.classList.add('translate-x-full');
                menuOverlay.classList.add('hidden');
                document.body.style.overflow = ''; // Restore background scroll
            };

            menuClose.addEventListener('click', closeMenu);
            menuOverlay.addEventListener('click', closeMenu);

            mobileMenu.querySelectorAll('a').forEach(link => {
                // Close menu on any link click
                link.addEventListener('click', closeMenu);
            });
        }

        syncMenuState();
        window.addEventListener('storage', syncMenuState);
        window.addEventListener('roomhy:website-session-changed', syncMenuState);
        
        /*
        ============================================================
        Intersection Observer for animations (from index)
        ============================================================
        */
        if ('IntersectionObserver' in window) {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        // Keep elements visible and let the CSS animation run naturally.
                        entry.target.classList.add('animate-slide-in');
                        entry.target.style.opacity = '1';
                        observer.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.1 }); // Trigger when 10% of the element is visible

            // Select all elements that should animate
            document.querySelectorAll('.animate-slide-in').forEach(el => {
                observer.observe(el);
            });
        } else {
            // Fallback for older browsers: just show the elements
            document.querySelectorAll('.animate-slide-in').forEach(el => {
                el.style.opacity = '1';
            });
        }


        /*
        ============================================================
        Hero Slideshow (from index)
        ============================================================
        */
        const heroWrapper = document.getElementById('hero-image-wrapper');
        if (heroWrapper) {
            const heroImages = heroWrapper.querySelectorAll('img');
            const totalHeroImages = heroImages.length;
            let currentHeroIndex = 0;

            if (totalHeroImages > 1) {
                setInterval(() => {
                    const nextHeroIndex = (currentHeroIndex + 1) % totalHeroImages;
                    
                    heroImages[currentHeroIndex].classList.remove('opacity-100');
                    heroImages[currentHeroIndex].classList.add('opacity-0');
                    
                    heroImages[nextHeroIndex].classList.remove('opacity-0');
                    heroImages[nextHeroIndex].classList.add('opacity-100');
                    
                    currentHeroIndex = nextHeroIndex;
                }, 5000); // Change image every 5 seconds
            }
        }
