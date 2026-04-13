import{j as L}from"./index-CgJryze2.js";import{r as R}from"./router-MpwSQkXQ.js";import{u as O}from"./useHeadAssets-nEhIiSZK.js";import{i as _,r as M}from"./htmlPage-BclIarCP.js";const P=()=>{R.useEffect(()=>{try{_()}catch{}const i=()=>{try{M()}catch{}};i();const r=setTimeout(i,100),a=setTimeout(i,300);return()=>{clearTimeout(r),clearTimeout(a)}},[])},$="Roomhy - Super Admin Dashboard",z=[{charset:"UTF-8"},{name:"viewport",content:"width=device-width, initial-scale=1.0"}],J=[{rel:"preconnect",href:"https://fonts.googleapis.com"},{rel:"preconnect",href:"https://fonts.gstatic",crossorigin:!0},{href:"https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap",rel:"stylesheet"},{rel:"stylesheet",href:"/superadmin/assets/css/superadmin.css"}],H=[{src:"https://cdn.tailwindcss.com"},{src:"https://unpkg.com/lucide@latest"},{src:"https://cdn.jsdelivr.net/npm/chart.js"},{content:`const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')\r
            ? 'http://localhost:5001'\r
            : 'https://api.roomhy.com';\r
\r
        // --- Sidebar Submenu Toggle ---\r
        function toggleSubmenu(id, element) {\r
            const submenu = document.getElementById(id);\r
            const chevron = element.querySelector('.lucide-chevron-down');\r
            \r
            // Close all other submenus first\r
            document.querySelectorAll('.submenu').forEach(sub => {\r
                if(sub.id !== id) sub.classList.remove('open');\r
            });\r
            document.querySelectorAll('.lucide-chevron-down').forEach(ch => {\r
                if(ch !== chevron) ch.style.transform = 'rotate(0deg)';\r
            });\r
\r
            if (submenu.classList.contains('open')) {\r
                submenu.classList.remove('open');\r
                chevron.style.transform = 'rotate(0deg)';\r
            } else {\r
                submenu.classList.add('open');\r
                chevron.style.transform = 'rotate(180deg)';\r
            }\r
        }\r
\r
        // --- Data Seeding & Loading ---\r
        function initializeMockData() {\r
            if (!localStorage.getItem('roomhy_tenants')) {\r
                localStorage.setItem('roomhy_tenants', JSON.stringify([\r
                    { name: "Rahul Sharma", role: "tenant", moveInDate: "2024-10-20", kycStatus: "verified" },\r
                    { name: "Priya Singh", role: "tenant", moveInDate: "2024-10-22", kycStatus: "pending" },\r
                    { name: "Amit Patel", role: "tenant", moveInDate: "2024-10-25", kycStatus: "verified" }\r
                ]));\r
            }\r
            if (!localStorage.getItem('roomhy_owners_db')) {\r
                const mockOwners = {\r
                    "OWNER001": { profile: { name: "Vijay Khanna" }, properties: [{}, {}] },\r
                    "OWNER002": { profile: { name: "Anil Kapoor" }, properties: [{}] }\r
                };\r
                localStorage.setItem('roomhy_owners_db', JSON.stringify(mockOwners));\r
            }\r
            if (!localStorage.getItem('roomhy_properties')) {\r
                localStorage.setItem('roomhy_properties', JSON.stringify([\r
                    { name: "Green View Villa", owner: "Vijay Khanna", area: "Koramangala" },\r
                    { name: "Skyline Heights", owner: "Anil Kapoor", area: "Indiranagar" }\r
                ]));\r
            }\r
        }\r
\r
        function loadDashboard() {\r
            const tenants = JSON.parse(localStorage.getItem('roomhy_tenants') || '[]');\r
            const ownersDB = JSON.parse(localStorage.getItem('roomhy_owners_db') || '{}');\r
            const properties = JSON.parse(localStorage.getItem('roomhy_properties') || '[]');\r
            \r
            document.getElementById('stat-tenants').innerText = tenants.length;\r
            document.getElementById('stat-properties').innerText = properties.length;\r
            document.getElementById('stat-owners').innerText = Object.keys(ownersDB).length;\r
            \r
            // Calculate revenue from bookings\r
            calculateRevenue();\r
\r
            const signupList = document.getElementById('recent-signups-list');\r
            const recent = tenants.slice(-5).reverse();\r
            if (recent.length > 0) {\r
                signupList.innerHTML = recent.map(user => \`\r
                    <tr class="hover:bg-slate-50 transition-colors">\r
                        <td class="px-6 py-4">\r
                            <div class="flex items-center gap-3">\r
                                <div class="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center font-bold text-xs">\r
                                    \${user.name[0]}\r
                                </div>\r
                                <span class="text-sm font-bold text-slate-700">\${user.name}</span>\r
                            </div>\r
                        </td>\r
                        <td class="px-6 py-4 text-sm text-slate-500 capitalize">\${user.role}</td>\r
                        <td class="px-6 py-4 text-sm text-slate-500">\${user.moveInDate || 'Today'}</td>\r
                        <td class="px-6 py-4">\r
                            <span class="px-2 py-1 rounded-full text-[10px] font-bold \${user.kycStatus === 'verified' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'} uppercase">\r
                                \${user.kycStatus || 'pending'}\r
                            </span>\r
                        </td>\r
                        <td class="px-6 py-4 text-right">\r
                            <button class="text-slate-400 hover:text-purple-600"><i data-lucide="eye" class="w-4 h-4"></i></button>\r
                        </td>\r
                    </tr>\r
                \`).join('');\r
            } else {\r
                signupList.innerHTML = '<tr><td colspan="5" class="px-6 py-8 text-center text-slate-400">No recent signups found</td></tr>';\r
            }\r
            renderCharts();\r
            lucide.createIcons();\r
        }\r
\r
                // Calculate platform revenue from live rent + commission data\r
        async function calculateRevenue() {\r
            try {\r
                let rents = [];\r
                try {\r
                    const response = await fetch(\`\${API_URL}/api/rents\`);\r
                    if (response.ok) {\r
                        const data = await response.json();\r
                        rents = data.rents || data || [];\r
                        console.log('Rents fetched from DB:', rents.length);\r
                    } else {\r
                        console.warn('Failed to fetch rents from API');\r
                    }\r
                } catch (e) {\r
                    console.warn('Could not fetch rents from API:', e.message);\r
                }\r
\r
                let totalBookingAmount = 0;\r
                let platformCommission = 0;\r
                let serviceFee = 0;\r
                const monthBuckets = {};\r
\r
                rents.forEach((rent) => {\r
                    const rentAmount = Number(rent.rentAmount || rent.totalDue || 0);\r
                    const commission = Number(rent.commissionAmount || (rentAmount * 0.10));\r
                    const fee = Number(rent.serviceFeeAmount || 50);\r
                    const month = (rent.collectionMonth || '').trim() || 'Unknown';\r
\r
                    totalBookingAmount += rentAmount;\r
                    platformCommission += commission;\r
                    serviceFee += fee;\r
                    monthBuckets[month] = (monthBuckets[month] || 0) + commission + fee;\r
                });\r
\r
                const netRevenue = platformCommission + serviceFee;\r
                const months = Object.keys(monthBuckets).sort().slice(-6);\r
                if (window.revenueChartInstance && months.length) {\r
                    window.revenueChartInstance.data.labels = months;\r
                    window.revenueChartInstance.data.datasets[0].data = months.map((m) => Math.round(monthBuckets[m]));\r
                    window.revenueChartInstance.update();\r
                }\r
\r
                document.getElementById('booking-amount').innerText = '?' + totalBookingAmount.toLocaleString();\r
                document.getElementById('platform-commission').innerText = '?' + platformCommission.toLocaleString();\r
                document.getElementById('service-fee').innerText = '?' + serviceFee.toLocaleString();\r
                document.getElementById('net-revenue').innerText = '?' + netRevenue.toLocaleString();\r
                document.getElementById('stat-revenue').innerText = '?' + netRevenue.toLocaleString();\r
\r
                console.log(\`Revenue calculated: Total=\${totalBookingAmount}, Net=\${netRevenue}\`);\r
            } catch (error) {\r
                console.error('Error calculating revenue:', error);\r
            }\r
        }\r
\r
        function renderCharts() {\r
            const revCtx = document.getElementById('revenueChart').getContext('2d');\r
            window.revenueChartInstance = new Chart(revCtx, {\r
                type: 'line',\r
                data: {\r
                    labels: ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'],\r
                    datasets: [{\r
                        label: 'Revenue (?)',\r
                        data: [120000, 190000, 170000, 250000, 310000, 425000],\r
                        borderColor: '#a855f7',\r
                        tension: 0.4,\r
                        fill: true,\r
                        backgroundColor: 'rgba(168, 85, 247, 0.1)',\r
                        pointRadius: 4,\r
                        pointBackgroundColor: '#a855f7'\r
                    }]\r
                },\r
                options: { \r
                    responsive: true, \r
                    maintainAspectRatio: false,\r
                    plugins: { legend: { display: false } },\r
                    scales: {\r
                        y: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } },\r
                        x: { grid: { display: false }, ticks: { font: { size: 10 } } }\r
                    }\r
                }\r
            });\r
\r
            const distCtx = document.getElementById('userDistChart').getContext('2d');\r
            new Chart(distCtx, {\r
                type: 'doughnut',\r
                data: {\r
                    labels: ['Tenants', 'Owners', 'Staff'],\r
                    datasets: [{\r
                        data: [65, 25, 10],\r
                        backgroundColor: ['#a855f7', '#3b82f6', '#f59e0b'],\r
                        borderWidth: 0\r
                    }]\r
                },\r
                options: { \r
                    responsive: true, \r
                    maintainAspectRatio: false,\r
                    cutout: '70%',\r
                    plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } }\r
                }\r
            });\r
        }\r
\r
        // --- Header Population ---\r
        function populateHeader() {\r
            const user = JSON.parse(localStorage.getItem('user') || localStorage.getItem('admin_user') || '{}');\r
\r
            const avatarElement = document.getElementById('admin-avatar-header');\r
            if (user.name && avatarElement) {\r
                avatarElement.src = \`https://i.pravatar.cc/150?u=\${encodeURIComponent(user.name)}\`;\r
            }\r
        }\r
\r
        document.addEventListener('DOMContentLoaded', () => {\r
            initializeMockData();\r
            populateHeader();\r
            loadDashboard();\r
            lucide.createIcons();\r
            \r
            // Mobile sidebar toggle\r
        });`},{src:"/superadmin/js/SuperAdminNotificationManager.js"},{src:"/superadmin/assets/js/superadmin.js"},{content:`// Trigger Tailwind CSS to process dynamically added content
if (window.tailwind) {
  setTimeout(() => {
    if (window.tailwind.config && window.tailwind.config._()) {
      console.log('Tailwind CSS reprocessed');
    }
  }, 100);
}
// Also try postcss or just force a reflow to trigger Tailwind
setTimeout(() => {
  document.documentElement.style.opacity = '1';
}, 50);`}],F={lang:"en"},U={class:"text-slate-800"},q=`<!-- Mobile Overlay -->
    <div id="mobile-sidebar-overlay" class="fixed inset-0 bg-black/50 z-30 hidden md:hidden"></div>
    
    <div class="flex h-screen overflow-hidden">
                <!-- Sidebar -->
        <aside id="mobile-sidebar" class="sidebar w-72 flex-shrink-0 hidden md:flex flex-col z-20 overflow-y-auto custom-scrollbar fixed md:static inset-y-0 left-0 transform -translate-x-full md:translate-x-0 transition-transform duration-300">
            <div class="h-16 flex items-center px-6 border-b border-gray-800 sticky top-0 bg-[#111827] z-10">
                 <div class="flex items-center gap-3">
                     
                     <div><img src="/website/images/whitelogo.jpeg" alt="Roomhy Logo" class="h-16 w-auto"><span class="text-[10px] text-gray-500">SUPER ADMIN</span></div>
                 </div>
                 <button id="mobile-sidebar-close" class="md:hidden ml-auto p-2 text-gray-400 hover:text-white">
                     <i data-lucide="x" class="w-5 h-5"></i>
                 </button>
            </div>
            <nav class="flex-1 py-6 space-y-1">
                <div class="px-6 pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Overview</div>
                <a href="/superadmin/superadmin" class="sidebar-link"><i data-lucide="layout-dashboard" class="w-5 h-5 mr-3"></i> Dashboard</a>
                <div class="mt-6 px-6 pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Management</div>
                <a href="/superadmin/manager" class="sidebar-link"><i data-lucide="map-pin" class="w-5 h-5 mr-3"></i> Teams</a>
                <a href="/superadmin/owner" class="sidebar-link"><i data-lucide="briefcase" class="w-5 h-5 mr-3"></i> Property Owners</a>
                <a href="/superadmin/properties" class="sidebar-link"><i data-lucide="home" class="w-5 h-5 mr-3"></i> Properties</a>
                <a href="/superadmin/tenant" class="sidebar-link"><i data-lucide="users" class="w-5 h-5 mr-3"></i> Tenants</a>
                <a href="/superadmin/new_signups" class="sidebar-link"><i data-lucide="file-badge" class="w-5 h-5 mr-3"></i> New Signups</a>
                <div class="mt-6 px-6 pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Operations</div>
                <a href="/superadmin/websiteenq" class="sidebar-link"><i data-lucide="folder-open" class="w-5 h-5 mr-3"></i> Web Enquiry</a>
                <a href="/superadmin/enquiry" class="sidebar-link"><i data-lucide="help-circle" class="w-5 h-5 mr-3"></i> Enquiries</a>
                <a href="/superadmin/booking" class="sidebar-link"><i data-lucide="calendar-check" class="w-5 h-5 mr-3"></i> Bookings</a>
                <a href="/superadmin/reviews" class="sidebar-link"><i data-lucide="star" class="w-5 h-5 mr-3"></i> Reviews</a>
                <a href="/superadmin/complaint-history" class="sidebar-link"><i data-lucide="alert-circle" class="w-5 h-5 mr-3"></i> Complaint History</a>
                <div class="mt-6 px-6 pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Website</div>
                <a href="/superadmin/website" class="sidebar-link"><i data-lucide="globe" class="w-5 h-5 mr-3"></i> Live Properties</a>
                <div class="mt-6 px-6 pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Finance</div>
                <div class="group">
                    <div class="sidebar-link justify-between" onclick="toggleSubmenu('finance-submenu', this)">
                        <div class="flex items-center"><i data-lucide="wallet" class="w-5 h-5 mr-3"></i> Finance</div>
                        <i data-lucide="chevron-down" class="w-4 h-4 transition-transform duration-200"></i>
                    </div>
                    <div id="finance-submenu" class="submenu">
                        <a href="/superadmin/rentcollection" class="sidebar-link text-sm hover:text-white">Rent Collections</a>
                        <a href="/superadmin/platform" class="sidebar-link text-sm hover:text-white">Commissions</a>
                        <a href="/superadmin/refund" class="sidebar-link text-sm hover:text-white">Refunds</a>
                    </div>
                </div>
                <div class="mt-6 px-6 pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">System</div>
                 <a href="/superadmin/location" class="sidebar-link"><i data-lucide="globe" class="w-5 h-5 mr-3"></i> Locations</a>
            </nav>
        </aside>

        <!-- Main Content -->
        <div class="flex-1 flex flex-col overflow-hidden bg-[#f3f4f6]">
            <!-- Top Header -->
            <header class="bg-white h-16 flex items-center justify-between px-6 shadow-sm z-10">
                <div class="flex items-center">
                    <button id="mobile-menu-open" class="md:hidden mr-4 text-slate-500">
                        <i data-lucide="menu" class="w-6 h-6"></i>
                    </button>
                    <h2 class="text-lg font-semibold text-slate-800 flex items-center gap-2">
                        Platform Dashboard <span class="text-gray-400">/</span> <span class="text-purple-600">Overview</span>
                    </h2>
                </div>
                <div class="flex items-center gap-4">
                    <!-- Notification Bell with Badge -->
    <div class="relative">
        <button id="notificationBellBtn" class="relative p-2 text-slate-400 hover:text-slate-600 hover:bg-gray-100 rounded-lg transition-colors">
            <i data-lucide="bell" class="w-5 h-5"></i>
            <span id="notificationBadge" class="hidden absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">0</span>
        </button>
        
        <!-- Notification Dropdown -->
        <div id="notificationDropdown" class="hidden absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg py-2 ring-1 ring-black ring-opacity-5 z-50">
            <div class="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <h3 class="font-semibold text-gray-800">Notifications</h3>
                <div class="flex gap-2">
                    <button onclick="markAllRead()" class="text-xs text-purple-600 hover:text-purple-800">Mark all read</button>
                    <button onclick="clearAll()" class="text-xs text-gray-400 hover:text-gray-600">Clear</button>
                </div>
            </div>
            <div id="notificationList" class="max-h-96 overflow-y-auto custom-scrollbar">
                <div class="px-4 py-8 text-center text-gray-400">
                    <i data-lucide="bell-off" class="w-12 h-12 mx-auto mb-2 opacity-50"></i>
                    <p>No notifications yet</p>
                    <button id="enable-notifications-btn" onclick="requestNotificationPermission()" class="mt-3 text-purple-600 hover:text-purple-800 text-sm font-medium">
                        Enable Notifications
                    </button>
                </div>
            </div>
        </div>
    </div>
    
    <span class="w-8 h-8 rounded-full border border-slate-200 bg-purple-600 text-white flex items-center justify-center font-bold">SA</span>
                </div>
            </header>

            <!-- Dashboard Content -->
            <main class="flex-1 overflow-y-auto p-6 md:p-8">
                <div class="max-w-7xl mx-auto">
                    <!-- Page Header -->
                    <div class="mb-8">
                        <h1 class="text-2xl font-bold text-slate-800">Platform Overview</h1>
                        <p class="text-sm text-slate-500 mt-1">Real-time performance metrics and platform growth statistics.</p>
                    </div>

                    <!-- Stats Grid -->
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                        <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100 transition-all hover:shadow-md">
                            <div class="flex items-center justify-between mb-4">
                                <div class="p-2 bg-purple-50 text-purple-600 rounded-lg"><i data-lucide="users" class="w-6 h-6"></i></div>
                                <span class="text-xs font-bold text-green-500 bg-green-50 px-2 py-1 rounded-full">+12%</span>
                            </div>
                            <h3 class="text-slate-500 text-sm font-medium">Total Tenants</h3>
                            <p id="stat-tenants" class="text-2xl font-bold text-slate-800">0</p>
                        </div>
                        <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100 transition-all hover:shadow-md">
                            <div class="flex items-center justify-between mb-4">
                                <div class="p-2 bg-blue-50 text-blue-600 rounded-lg"><i data-lucide="home" class="w-6 h-6"></i></div>
                                <span class="text-xs font-bold text-blue-500 bg-blue-50 px-2 py-1 rounded-full">Active</span>
                            </div>
                            <h3 class="text-slate-500 text-sm font-medium">Total Properties</h3>
                            <p id="stat-properties" class="text-2xl font-bold text-slate-800">0</p>
                        </div>
                        <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100 transition-all hover:shadow-md">
                            <div class="flex items-center justify-between mb-4">
                                <div class="p-2 bg-orange-50 text-orange-600 rounded-lg"><i data-lucide="briefcase" class="w-6 h-6"></i></div>
                                <span class="text-xs font-bold text-gray-500 bg-gray-50 px-2 py-1 rounded-full">Owners</span>
                            </div>
                            <h3 class="text-slate-500 text-sm font-medium">Property Owners</h3>
                            <p id="stat-owners" class="text-2xl font-bold text-slate-800">0</p>
                        </div>
                        <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100 transition-all hover:shadow-md">
                            <div class="flex items-center justify-between mb-4">
                                <div class="p-2 bg-green-50 text-green-600 rounded-lg"><i data-lucide="indian-rupee" class="w-6 h-6"></i></div>
                                <span class="text-xs font-bold text-green-500 bg-green-50 px-2 py-1 rounded-full">Monthly</span>
                            </div>
                            <h3 class="text-slate-500 text-sm font-medium">Platform Revenue</h3>
                            <p id="stat-revenue" class="text-2xl font-bold text-slate-800">&#8377;0</p>
                            
                            <!-- Revenue Breakdown -->
                            <div id="revenue-breakdown" class="mt-4 pt-4 border-t border-gray-100 space-y-2">
                                <div class="flex justify-between text-xs">
                                    <span class="text-gray-500">Booking Amount</span>
                                    <span id="booking-amount" class="font-medium">&#8377;0</span>
                                </div>
                                <div class="flex justify-between text-xs">
                                    <span class="text-gray-500">Platform Commission (10%)</span>
                                    <span id="platform-commission" class="font-medium text-purple-600">&#8377;0</span>
                                </div>
                                <div class="flex justify-between text-xs">
                                    <span class="text-gray-500">Service Fee (5%)</span>
                                    <span id="service-fee" class="font-medium text-blue-600">&#8377;0</span>
                                </div>
                                <div class="flex justify-between text-sm font-semibold pt-2 border-t border-gray-100">
                                    <span>Net Revenue</span>
                                    <span id="net-revenue" class="text-green-600">&#8377;0</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Charts Row -->
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                        <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <div class="flex justify-between items-center mb-6">
                                <h3 class="text-lg font-bold text-slate-800">Revenue Growth</h3>
                                <select class="text-xs border-gray-300 rounded p-1">
                                    <option>Last 6 Months</option>
                                    <option>Last Year</option>
                                </select>
                            </div>
                            <div class="h-64"><canvas id="revenueChart"></canvas></div>
                        </div>
                        <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <div class="flex justify-between items-center mb-6">
                                <h3 class="text-lg font-bold text-slate-800">User Distribution</h3>
                                <button class="text-xs text-purple-600 font-bold hover:underline">Download CSV</button>
                            </div>
                            <div class="h-64 flex items-center justify-center">
                                <div class="w-full h-full max-w-[250px]"><canvas id="userDistChart"></canvas></div>
                            </div>
                        </div>
                    </div>

                    <!-- Recent Activity Section -->
                    <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <div class="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                            <h3 class="text-lg font-bold text-slate-800">Recent Signups</h3>
                            <a href="/superadmin/superadmin/new_signups" class="text-purple-600 text-sm font-bold hover:underline">View All</a>
                        </div>
                        <div class="overflow-x-auto">
                            <table class="w-full text-left">
                                <thead class="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                                    <tr>
                                        <th class="px-6 py-3">User</th>
                                        <th class="px-6 py-3">Role</th>
                                        <th class="px-6 py-3">Date</th>
                                        <th class="px-6 py-3">Status</th>
                                        <th class="px-6 py-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody id="recent-signups-list" class="divide-y divide-gray-100">
                                    <!-- Populated by JS -->
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    </div>

    
    
    <!-- Notification System -->`;function Y(){return O({title:$,metas:z,links:J,scripts:H,htmlAttrs:F,bodyAttrs:U}),P(),R.useEffect(()=>{let i=!1;const r=e=>Array.isArray(e)?e:e&&Array.isArray(e.data)?e.data:e&&Array.isArray(e.tenants)?e.tenants:e&&Array.isArray(e.owners)?e.owners:e&&Array.isArray(e.properties)?e.properties:e&&Array.isArray(e.rents)?e.rents:e&&Array.isArray(e.users)?e.users:[],a=(e,n)=>{const o=document.getElementById(e);!o||i||(o.textContent=n)},g=e=>{var l,u;const n=document.getElementById("recent-signups-list");if(!n||i)return;const o=r(e).slice(-5).reverse();if(!o.length){n.innerHTML='<tr><td colspan="5" class="px-6 py-8 text-center text-slate-400">No recent signups found</td></tr>';return}n.innerHTML=o.map(t=>{var d,m;const p=String((t==null?void 0:t.name)||(t==null?void 0:t.firstName)||(t==null?void 0:t.fullName)||"User").trim(),f=p.charAt(0).toUpperCase()||"U",c=String((t==null?void 0:t.kycStatus)||(t==null?void 0:t.status)||"pending").toLowerCase(),h=c==="verified"?"bg-green-100 text-green-700":c==="rejected"?"bg-red-100 text-red-700":"bg-yellow-100 text-yellow-700";return`
            <tr class="hover:bg-slate-50 transition-colors">
              <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center font-bold text-xs">
                    ${f}
                  </div>
                  <span class="text-sm font-bold text-slate-700">${p}</span>
                </div>
              </td>
              <td class="px-6 py-4 text-sm text-slate-500 capitalize">${String((t==null?void 0:t.role)||"tenant")}</td>
              <td class="px-6 py-4 text-sm text-slate-500">${(t==null?void 0:t.moveInDate)||((m=(d=t==null?void 0:t.createdAt)==null?void 0:d.slice)==null?void 0:m.call(d,0,10))||"Today"}</td>
              <td class="px-6 py-4">
                <span class="px-2 py-1 rounded-full text-[10px] font-bold ${h} uppercase">
                  ${c}
                </span>
              </td>
              <td class="px-6 py-4 text-right">
                <button class="text-slate-400 hover:text-purple-600"><i data-lucide="eye" class="w-4 h-4"></i></button>
              </td>
            </tr>
          `}).join(""),(u=(l=window.lucide)==null?void 0:l.createIcons)==null||u.call(l)},v=e=>{e&&typeof e.destroy=="function"&&e.destroy()},x=(e,n,o,l)=>{if(i||typeof window.Chart!="function")return;const u=document.getElementById("revenueChart"),t=document.getElementById("userDistChart");if(!u||!t)return;const p=Array.isArray(e)&&e.length?e:["Jun","Jul","Aug","Sep","Oct","Nov"],f=p.map(m=>Math.round((n==null?void 0:n[m])||0));v(window.revenueChartInstance),v(window.userDistChartInstance),window.revenueChartInstance=new window.Chart(u.getContext("2d"),{type:"line",data:{labels:p,datasets:[{label:"Revenue (₹)",data:f.some(m=>m>0)?f:[12e4,19e4,17e4,25e4,31e4,425e3],borderColor:"#a855f7",tension:.4,fill:!0,backgroundColor:"rgba(168, 85, 247, 0.1)",pointRadius:4,pointBackgroundColor:"#a855f7"}]},options:{responsive:!0,maintainAspectRatio:!1,plugins:{legend:{display:!1}},scales:{y:{grid:{color:"#f1f5f9"},ticks:{font:{size:10}}},x:{grid:{display:!1},ticks:{font:{size:10}}}}}});const c=Array.isArray(o)?o.length:0,h=Array.isArray(l)?l.length:0,d=Math.max(1,Math.round((c+h)*.15)||1);window.userDistChartInstance=new window.Chart(t.getContext("2d"),{type:"doughnut",data:{labels:["Tenants","Owners","Staff"],datasets:[{data:[c,h,d],backgroundColor:["#a855f7","#3b82f6","#f59e0b"],borderWidth:0}]},options:{responsive:!0,maintainAspectRatio:!1,cutout:"70%",plugins:{legend:{position:"bottom",labels:{boxWidth:10,font:{size:10}}}}}})},C=async()=>{var e,n;try{const o=window.location.hostname==="localhost"||window.location.hostname==="127.0.0.1"?"http://localhost:5001":"https://api.roomhy.com",l=localStorage.getItem("token")||localStorage.getItem("areaAdminToken")||localStorage.getItem("superAdminToken")||"",u=l?{Authorization:`Bearer ${l}`}:{},t=async s=>{const b=await fetch(`${o}${s}`,{headers:u}),S=await b.text();let w={};try{w=S?JSON.parse(S):{}}catch{w={}}if(!b.ok)throw new Error(`Request failed: ${b.status}`);return w},[p,f,c,h]=await Promise.allSettled([t("/api/tenants"),t("/api/owners"),t("/api/approved-properties/public/approved"),t("/api/rents")]),d=p.status==="fulfilled"?r(p.value):JSON.parse(localStorage.getItem("roomhy_tenants")||"[]"),m=f.status==="fulfilled"?r(f.value):Object.values(JSON.parse(localStorage.getItem("roomhy_owners_db")||"{}")),N=c.status==="fulfilled"?r(c.value):JSON.parse(localStorage.getItem("roomhy_properties")||"[]"),D=h.status==="fulfilled"?r(h.value):[];a("stat-tenants",String(r(d).length)),a("stat-properties",String(r(N).length)),a("stat-owners",String(r(m).length));let E=0,A=0,I=0;const y={};r(D).forEach(s=>{const b=Number((s==null?void 0:s.rentAmount)||(s==null?void 0:s.totalDue)||0),S=Number((s==null?void 0:s.commissionAmount)||b*.1||0),w=Number((s==null?void 0:s.serviceFeeAmount)||50),B=String((s==null?void 0:s.collectionMonth)||(s==null?void 0:s.paidAt)||(s==null?void 0:s.createdAt)||"").slice(0,7)||"Unknown";E+=b,A+=S,I+=w,y[B]=(y[B]||0)+S+w});const k=s=>`₹${Math.round(Number(s||0)).toLocaleString()}`;a("booking-amount",k(E)),a("platform-commission",k(A)),a("service-fee",k(I)),a("net-revenue",k(A+I)),a("stat-revenue",k(A+I));const T=Object.keys(y).slice(-6);window.revenueChartInstance&&T.length&&(window.revenueChartInstance.data.labels=T,window.revenueChartInstance.data.datasets[0].data=T.map(s=>Math.round(y[s]||0)),window.revenueChartInstance.update()),x(T,y,d,m),g(d),(n=(e=window.lucide)==null?void 0:e.createIcons)==null||n.call(e)}catch(o){console.error("Failed to load superadmin dashboard data:",o)}},j=window.setTimeout(C,150);return()=>{i=!0,window.clearTimeout(j)}},[]),R.useEffect(()=>{const i=()=>{var a,g,v,x,C;try{(a=window.initializeMockData)==null||a.call(window),(g=window.populateHeader)==null||g.call(window),(v=window.loadDashboard)==null||v.call(window),(C=(x=window.lucide)==null?void 0:x.createIcons)==null||C.call(x)}catch{}},r=window.setTimeout(i,80);return()=>window.clearTimeout(r)},[]),L.jsx("div",{dangerouslySetInnerHTML:{__html:q.replace("/superadmin/superadmin/new_signups","/superadmin/new_signups")}})}export{Y as default};
