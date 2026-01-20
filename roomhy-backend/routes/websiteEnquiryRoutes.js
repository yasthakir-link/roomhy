const express = require('express');
const router = express.Router();
const WebsiteEnquiry = require('../models/WebsiteEnquiry');
// const Owner = require('../models/Owner');

// ============================================================
// POST: Submit a new website enquiry
// ============================================================
router.post('/submit', async (req, res) => {
    try {
        const {
            property_type,
            property_name,
            city,
            locality,
            address,
            pincode,
            description,
            amenities,
            gender_suitability,
            rent,
            deposit,
            owner_name,
            owner_email,
            owner_phone,
            photos
        } = req.body;

        // Validate required fields
        if (!property_name || !city || !owner_name || !owner_phone) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: property_name, city, owner_name, owner_phone'
            });
        }

        // Create unique enquiry ID
        const enquiry_id = Date.now() + '_' + Math.random().toString(36).substr(2, 9);

        // Create new enquiry
        const enquiry = new WebsiteEnquiry({
            enquiry_id,
            property_type,
            property_name,
            city,
            locality,
            address,
            pincode,
            description,
            amenities: amenities || [],
            gender_suitability,
            rent: parseInt(rent) || 0,
            deposit,
            owner_name,
            owner_email,
            owner_phone,
            photos: photos || [],
            status: 'pending'
        });

        // Save to MongoDB
        await enquiry.save();

        // Send email notification to superadmin
        try {
            const mailer = require('../utils/mailer');
            const superadminEmail = 'roomhy01@gmail.com';
            const subject = 'New Website Enquiry Submitted';
            const html = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333;">New Website Enquiry</h2>
                    <p>A new property enquiry has been submitted on the website.</p>
                    <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
                        <p><strong>Property:</strong> ${property_name}</p>
                        <p><strong>Owner:</strong> ${owner_name}</p>
                        <p><strong>City:</strong> ${city}</p>
                        <p><strong>Rent:</strong> ₹${rent}</p>
                        <p><strong>Phone:</strong> ${owner_phone}</p>
                        <p><strong>Email:</strong> ${owner_email || 'Not provided'}</p>
                    </div>
                    <p>Please review this enquiry in the superadmin panel.</p>
                </div>
            `;
            await mailer.sendMail(superadminEmail, subject, '', html);
        } catch (emailError) {
            console.error('Failed to send enquiry notification email:', emailError);
        }

        res.status(201).json({
            success: true,
            message: 'Enquiry submitted successfully',
            enquiry_id: enquiry_id,
            enquiry: enquiry
        });

    } catch (error) {
        console.error('Error submitting enquiry:', error);
        res.status(500).json({
            success: false,
            message: 'Error submitting enquiry',
            error: error.message
        });
    }
});

// ============================================================
// GET: Fetch all website enquiries
// ============================================================
router.get('/all', async (req, res) => {
    try {
        console.log('🔍 [websiteEnquiry/all] Fetching all enquiries from MongoDB...');
        const enquiries = await WebsiteEnquiry.find().sort({ created_at: -1 });
        console.log('✅ [websiteEnquiry/all] Found', enquiries.length, 'enquiries');

        res.status(200).json({
            success: true,
            count: enquiries.length,
            enquiries: enquiries
        });

    } catch (error) {
        console.error('❌ [websiteEnquiry/all] Error fetching enquiries:', error.message);
        console.error('   Stack:', error.stack);
        res.status(500).json({
            success: false,
            message: 'Error fetching enquiries',
            error: error.message
        });
    }
});

// ============================================================
// GET: Fetch enquiries by city
// ============================================================
router.get('/city/:city', async (req, res) => {
    try {
        const { city } = req.params;
        console.log('🔍 [websiteEnquiry/city] Fetching enquiries for city:', city);
        
        const enquiries = await WebsiteEnquiry.find({ city }).sort({ created_at: -1 });
        console.log('✅ [websiteEnquiry/city] Found', enquiries.length, 'enquiries for city:', city);

        res.status(200).json({
            success: true,
            count: enquiries.length,
            enquiries: enquiries
        });

    } catch (error) {
        console.error('❌ [websiteEnquiry/city] Error fetching enquiries by city:', error.message);
        console.error('   Stack:', error.stack);
        res.status(500).json({
            success: false,
            message: 'Error fetching enquiries',
            error: error.message
        });
    }
});

// ============================================================
// GET: Fetch enquiries by status
// ============================================================
router.get('/status/:status', async (req, res) => {
    try {
        const { status } = req.params;
        const enquiries = await WebsiteEnquiry.find({ status }).sort({ created_at: -1 });

        res.status(200).json({
            success: true,
            count: enquiries.length,
            enquiries: enquiries
        });

    } catch (error) {
        console.error('Error fetching enquiries by status:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching enquiries',
            error: error.message
        });
    }
});

// ============================================================
// GET: Fetch enquiries assigned to specific employee
// ============================================================
router.get('/assigned-to/:loginId', async (req, res) => {
    try {
        const { loginId } = req.params;
        const enquiries = await WebsiteEnquiry.find({ assigned_to: loginId }).sort({ created_at: -1 });

        res.status(200).json({
            success: true,
            count: enquiries.length,
            enquiries: enquiries
        });

    } catch (error) {
        console.error('Error fetching enquiries assigned to employee:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching enquiries',
            error: error.message
        });
    }
});

// ============================================================
// GET: Fetch enquiries by owner email/id and status (for chat integration)
// ============================================================
router.get('/', async (req, res) => {
    try {
        const { owner_email, owner_id, status } = req.query;

        let query = {};
        if (owner_email) {
            query.owner_email = owner_email;
        } else if (owner_id) {
            // If owner_id is provided, we need to find enquiries by owner_id
            // Since the model stores owner_email, we need to find enquiries where owner_email matches
            // For now, we'll assume owner_id might be stored differently or we need to handle this case
            // Let's check if owner_id is actually an email or if we need to look up the owner
            if (owner_id.includes('@')) {
                // If owner_id contains @, treat it as email
                query.owner_email = owner_id;
            } else {
                // If it's a loginId like ROOMHY9603, we need to find enquiries by this ID
                // For now, let's assume the owner_id is stored in a way we can query
                // This might need adjustment based on how enquiries are actually stored
                // Look up the owner by loginId to get their email
                // const owner = await Owner.findOne({ loginId: owner_id });
                // if (owner && owner.email) {
                //     query.owner_email = owner.email;
                // } else {
                    // If owner not found or no email, return empty result
                    return res.status(200).json({
                        success: true,
                        count: 0,
                        enquiries: []
                    });
                // }
            }
        }
        if (status) query.status = status;

        const enquiries = await WebsiteEnquiry.find(query).sort({ created_at: -1 });

        res.status(200).json({
            success: true,
            count: enquiries.length,
            enquiries: enquiries
        });

    } catch (error) {
        console.error('Error fetching enquiries:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching enquiries',
            error: error.message
        });
    }
});

// ============================================================
// PUT: Update enquiry (assign to manager)
// ============================================================
router.put('/:enquiry_id', async (req, res) => {
    try {
        const { enquiry_id } = req.params;
        const { assigned_to, assigned_area, status, notes } = req.body;

        const enquiry = await WebsiteEnquiry.findOneAndUpdate(
            { enquiry_id },
            {
                assigned_to: assigned_to || undefined,
                assigned_area: assigned_area || undefined,
                status: status || undefined,
                notes: notes || undefined,
                assigned_date: (assigned_to && new Date()) || undefined
            },
            { new: true, runValidators: true }
        );

        if (!enquiry) {
            return res.status(404).json({
                success: false,
                message: 'Enquiry not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Enquiry updated successfully',
            enquiry: enquiry
        });

    } catch (error) {
        console.error('Error updating enquiry:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating enquiry',
            error: error.message
        });
    }
});

// ============================================================
// DELETE: Delete an enquiry
// ============================================================
router.delete('/:enquiry_id', async (req, res) => {
    try {
        const { enquiry_id } = req.params;

        const enquiry = await WebsiteEnquiry.findOneAndDelete({ enquiry_id });

        if (!enquiry) {
            return res.status(404).json({
                success: false,
                message: 'Enquiry not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Enquiry deleted successfully',
            enquiry: enquiry
        });

    } catch (error) {
        console.error('Error deleting enquiry:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting enquiry',
            error: error.message
        });
    }
});

// ============================================================
// POST: Seed test data (development endpoint)
// ============================================================
router.post('/seed', async (req, res) => {
    try {
        console.log('🌱 [websiteEnquiry/seed] Starting data seed...');
        
        // Check if data already seeded
        const existingCount = await WebsiteEnquiry.countDocuments();
        if (existingCount > 0) {
            console.log('ℹ️ [websiteEnquiry/seed] Data already exists. Skipping seed.');
            return res.status(200).json({
                success: true,
                message: 'Data already seeded',
                count: existingCount
            });
        }
        
        // Create test enquiries one by one to avoid timeout
        const enquiries = [];
        const testData = [
            {
                property_type: 'Apartment',
                property_name: 'Cozy 1-BHK Near Railway Station',
                city: 'Bangalore',
                locality: 'Indiranagar',
                rent: 8000,
                gender_suitability: 'Female',
                owner_name: 'Raj Kumar'
            },
            {
                property_type: 'Shared Room',
                property_name: 'Spacious Shared Room',
                city: 'Bangalore',
                locality: 'Koramangala',
                rent: 5500,
                gender_suitability: 'Male',
                owner_name: 'Meera Singh'
            },
            {
                property_type: 'PG',
                property_name: 'Modern 1-BHK with Gym',
                city: 'Bangalore',
                locality: 'Whitefield',
                rent: 12000,
                gender_suitability: 'Female',
                owner_name: 'Arjun Nair'
            },
            {
                property_type: 'Hostel',
                property_name: 'Budget Hostel Downtown',
                city: 'Bangalore',
                locality: 'MG Road',
                rent: 3500,
                gender_suitability: 'Co-ed',
                owner_name: 'Priya Sharma'
            },
            {
                property_type: 'Apartment',
                property_name: 'Studio Flat Near Tech Park',
                city: 'Bangalore',
                locality: 'Electronic City',
                rent: 9500,
                gender_suitability: 'Male',
                owner_name: 'Vijay Kumar'
            }
        ];

        for (let i = 0; i < testData.length; i++) {
            try {
                const data = testData[i];
                const timestamp = Date.now();
                const enquiry = new WebsiteEnquiry({
                    enquiry_id: `WE_${timestamp}_${i}_${Math.random().toString(36).substr(2, 9)}`,
                    property_type: data.property_type,
                    property_name: data.property_name,
                    city: data.city,
                    locality: data.locality || data.property_name,
                    address: '123 ' + data.property_name,
                    pincode: '560001',
                    description: 'Test property - ' + data.property_name,
                    amenities: ['WiFi', 'AC', 'Kitchen', 'Parking'],
                    gender_suitability: data.gender_suitability,
                    rent: data.rent,
                    deposit: (data.rent * 2).toString(),
                    owner_name: data.owner_name,
                    owner_email: data.owner_name.replace(' ', '.') + '@example.com',
                    owner_phone: '9876543210',
                    photos: ['https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=500'],
                    professionalPhotos: ['https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=500', 'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=500'],
                    status: 'completed',
                    rating: 4.5,
                    reviewsCount: 12,
                    isVerified: true
                });
                await enquiry.save();
                enquiries.push(enquiry);
                console.log('✅ Created:', enquiry.property_name);
            } catch (itemErr) {
                console.error('⚠️ Error creating item', i, ':', itemErr.message);
            }
        }

        console.log('✅ [websiteEnquiry/seed] Seeded', enquiries.length, 'enquiries');

        res.status(200).json({
            success: true,
            message: 'Data seeded successfully',
            count: enquiries.length,
            enquiries: enquiries
        });
    } catch (error) {
        console.error('❌ [websiteEnquiry/seed] Seed error:', error.message);
        console.error('Stack:', error.stack);
        res.status(500).json({
            success: false,
            message: 'Error seeding data',
            error: error.message
        });
    }
});

// ============================================================
// Website User Notifications
// ============================================================

// In-memory notification storage (use MongoDB in production)
const websiteNotifications = new Map();

/**
 * GET /api/website-enquiry/notifications/:userId
 * Get all notifications for a website user
 */
router.get('/notifications/:userId', (req, res) => {
    try {
        const { userId } = req.params;
        const userNotifications = websiteNotifications.get(userId) || [];
        
        res.json({
            success: true,
            notifications: userNotifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
            count: userNotifications.length
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * POST /api/website-enquiry/notifications/create
 * Create a notification for a user
 */
router.post('/notifications/create', (req, res) => {
    try {
        const { userId, title, message, type, relatedId, actionUrl } = req.body;
        
        if (!userId || !title) {
            return res.status(400).json({ success: false, message: 'userId and title required' });
        }

        const notification = {
            id: Date.now().toString(),
            userId,
            title,
            message,
            type, // 'booking_accept', 'new_message', 'owner_request'
            relatedId,
            actionUrl,
            read: false,
            createdAt: new Date()
        };

        if (!websiteNotifications.has(userId)) {
            websiteNotifications.set(userId, []);
        }

        websiteNotifications.get(userId).push(notification);

        // Keep only last 50 notifications
        const userNotifs = websiteNotifications.get(userId);
        if (userNotifs.length > 50) {
            websiteNotifications.set(userId, userNotifs.slice(-50));
        }

        res.json({ success: true, notification });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * GET /api/website-enquiry/booking-status/:userId
 * Check for newly accepted bookings
 */
router.get('/booking-status/:userId', (req, res) => {
    try {
        // This would query the booking collection to find accepted bookings
        // For now, returning empty array (implement with real booking model)
        res.json({
            success: true,
            acceptedBookings: []
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
