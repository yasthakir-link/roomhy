
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');

dotenv.config();

const app = express();
const server = http.createServer(app);

// Middleware (JSON parsing & Security)
app.use(express.json());
app.use(cors());

// Serve Static Files (HTML, CSS, JS, Images)
app.use(express.static('.')); // Serve all files from root directory
app.use('/Areamanager', express.static('./Areamanager'));
app.use('/propertyowner', express.static('./propertyowner'));
app.use('/tenant', express.static('./tenant'));
app.use('/superadmin', express.static('./superadmin'));
app.use('/images', express.static('./images'));
app.use('/js', express.static('./js'));

// Database Connection
const mongoOptions = {
    serverSelectionTimeoutMS: 15000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 10000,
    maxPoolSize: 10,
    minPoolSize: 2
};

mongoose.connect(process.env.MONGO_URI, mongoOptions)
    .then(() => {
        console.log('✅ MongoDB Connected (root server)');
        startServer();
    })
    .catch(err => {
        console.error('❌ MongoDB connection error:', err.message);
        console.warn('Starting server anyway; API calls may fail until DB reconnects');
        startServer();
    });

mongoose.connection.on('connected', () => console.log('Mongoose event: connected'));
mongoose.connection.on('error', (err) => console.error('Mongoose event: error', err && err.message));
mongoose.connection.on('disconnected', () => console.warn('Mongoose event: disconnected'));
mongoose.connection.on('reconnected', () => console.log('Mongoose event: reconnected'));

// Run seeder (creates a default superadmin) - best effort, non-blocking
// Disabled for debugging - uncomment if needed
/*
try {
    const seed = require('./roomhy-backend/seeder');
    seed().catch(err => console.error('Seeder error:', err));
} catch (err) {
    console.warn('Seeder not available or failed to load:', err.message);
}
*/

// Routes (Endpoints)
// Routes live under the `roomhy-backend/routes` folder
app.use('/api/auth', require('./roomhy-backend/routes/authRoutes'));
app.use('/api/properties', require('./roomhy-backend/routes/propertyRoutes'));
app.use('/api/admin', require('./roomhy-backend/routes/adminRoutes'));
app.use('/api/tenants', require('./roomhy-backend/routes/tenantRoutes'));
app.use('/api/visits', require('./roomhy-backend/routes/visitRoutes'));
app.use('/api/rooms', require('./roomhy-backend/routes/roomRoutes'));
app.use('/api/notifications', require('./roomhy-backend/routes/notificationRoutes'));
app.use('/api/owners', require('./roomhy-backend/routes/ownerRoutes'));
app.use('/api/booking', require('./roomhy-backend/routes/bookingRoutes'));
app.use('/api/employees', require('./roomhy-backend/routes/employeeRoutes'));
app.use('/api/complaints', require('./roomhy-backend/routes/complaintRoutes'));
app.use('/api/favorites', require('./roomhy-backend/routes/favoritesRoutes'));
app.use('/api/bids', require('./roomhy-backend/routes/bidsRoutes'));
app.use('/api/kyc', require('./roomhy-backend/routes/kycRoutes'));
app.use('/api/cities', require('./roomhy-backend/routes/citiesRoutes'));
app.use('/api/locations', require('./roomhy-backend/routes/locationRoutes'));
app.use('/api', require('./roomhy-backend/routes/uploadRoutes'));

// NEW: Website Enquiry Routes (for property enquiries from website form)
app.use('/api/website-enquiry', require('./roomhy-backend/routes/websiteEnquiryRoutes'));

// NEW: Data Sync Routes (for MongoDB Atlas integration)
app.use('/api/data', require('./roomhy-backend/routes/dataSync'));

// Email API Routes
app.use('/api/email', require('./roomhy-backend/routes/emailRoutes'));

// Test endpoint: seed a test owner for development
app.post('/api/test/seed-owner', async (req, res) => {
    try {
        const Owner = require('./roomhy-backend/models/Owner');
        const testOwner = await Owner.create({
            loginId: 'TESTOWNER2024',
            name: 'Test Property Owner',
            phone: '9999999999',
            address: '123 Test Street, Test City',
            locationCode: 'LOC001',
            credentials: { password: 'test@123' },
            kyc: { status: 'verified' }
        });
        res.status(201).json({ message: 'Test owner created', owner: testOwner });
    } catch (err) {
        if (err.code === 11000) {
            res.status(200).json({ message: 'Test owner already exists' });
        } else {
            res.status(500).json({ error: err.message });
        }
    }
});

const PORT = process.env.PORT || 5000;

// Global error handlers
process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

app.use((err, req, res, next) => {
    console.error('Express Error:', err);
    res.status(500).json({
        success: false,
        message: err.message || 'Internal Server Error'
    });
});

// Fallback middleware: serve index.html for any unmatched route (SPA fallback)
// Must come AFTER all other routes and static middleware
const path = require('path');
const fs = require('fs');
app.use((req, res, next) => {
    // Only respond to requests for non-API, non-static routes
    if (req.path.startsWith('/api/')) {
        return next(); // Pass API requests to 404 handler
    }
    const indexPath = path.join(__dirname, 'index.html');
    if (fs.existsSync(indexPath)) {
        return res.sendFile(indexPath);
    }
    return res.status(404).send('Not Found');
});

function startServer() {
    if (server.listening) return;
    server.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
}

