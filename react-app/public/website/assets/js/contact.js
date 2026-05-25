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
        JavaScript for Mobile Side Menu (Copied from index)
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
            });

            const closeMenu = () => {
                mobileMenu.classList.add('translate-x-full');
                menuOverlay.classList.add('hidden');
            };

            menuClose.addEventListener('click', closeMenu);
            menuOverlay.addEventListener('click', closeMenu);

            mobileMenu.querySelectorAll('a').forEach(link => {
                link.addEventListener('click', (e) => {
                    if (link.href.includes('#')) {
                        setTimeout(closeMenu, 100);
                    }
                    closeMenu();
                });
            });
        }

        syncMenuState();
        window.addEventListener('storage', syncMenuState);
        window.addEventListener('roomhy:website-session-changed', syncMenuState);
        
        /*
        ============================================================
        Hero Slideshow (Copied from index)
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
                }, 5000);
            }
        }
