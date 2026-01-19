const VisitReport = require('../models/VisitReport');
const Notification = require('../models/Notification');
const User = require('../models/user');

// 1. Submit a visit report (Area Manager)
exports.submitVisit = async (req, res) => {
    try {
        // Save the full visit data from frontend
        const visitData = req.body;

        // Ensure status is submitted
        visitData.status = 'submitted';
        visitData.submittedAt = new Date();
        visitData.submittedToAdmin = true;

        const report = await VisitReport.create(visitData);

        // Send email notification to superadmin
        try {
            const mailer = require('../utils/mailer');
            const superadminEmail = process.env.SMTP_USER || 'roomhy01@gmail.com';
            const subject = 'New Enquiry/Visit Report Submitted';
            const html = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333;">New Enquiry/Visit Report Submitted</h2>
                    <p>A new visit report/enquiry has been submitted and requires your review.</p>
                    <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
                        <p><strong>Property:</strong> ${visitData.propertyName || 'N/A'}</p>
                        <p><strong>Owner:</strong> ${visitData.ownerName || 'N/A'}</p>
                        <p><strong>City:</strong> ${visitData.city || 'N/A'}</p>
                        <p><strong>Area:</strong> ${visitData.area || 'N/A'}</p>
                        <p><strong>Visit Date:</strong> ${visitData.visitDate || 'N/A'}</p>
                        <p><strong>Submitted By:</strong> ${visitData.areaManagerName || 'Area Manager'}</p>
                        <p><strong>Submitted At:</strong> ${new Date().toLocaleString()}</p>
                    </div>
                    <p>Please review this enquiry in the superadmin enquiry panel.</p>
                </div>
            `;
            await mailer.sendMail(superadminEmail, subject, '', html);
            console.log('Enquiry notification email sent successfully');
        } catch (emailError) {
            console.error('Failed to send enquiry notification email:', emailError);
        }

        return res.status(201).json({ success: true, report });
    } catch (err) {
        console.error("Submit Visit Error:", err);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

// 2. Get Pending Visits (Super Admin)
exports.getPendingVisits = async (req, res) => {
    try {
        const visits = await VisitReport.find({ status: 'submitted' })
            .populate('areaManager', 'name email') 
            .sort({ submittedAt: 1 })
            .lean();
        res.json({ success: true, visits });
    } catch (err) {
        console.error("Pending Visits Error:", err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// 3. Get My Reports (Area Manager)
exports.getMyVisits = async (req, res) => {
    try {
        // Use staffId from query parameter (sent by frontend)
        // Falls back to req.user._id if authentication middleware provides it
        const userId = req.query.staffId || (req.user && (req.user._id || req.user.id));
        
        if (!userId) {
            return res.status(400).json({ success: false, message: 'Staff ID is required' });
        }
        
        const visits = await VisitReport.find({
            $or: [
                { submittedById: userId },
                { staffId: userId }
            ]
        }).sort({ submittedAt: -1 });
        res.json({ success: true, visits });
    } catch (err) {
        console.error('Get My Visits Error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Public fallbacks (for demo without auth middleware)
exports.submitVisitPublic = async (req, res) => {
    // Logic for demo submission without strict auth
    // ... (Implementation same as standard submit but relaxed checks)
    res.json({ success: true, message: "Demo submission received" }); 
};

// 4. Get Approved Properties for Website (Public Endpoint)
// Used by ourproperty.html to fetch live properties from database
exports.getApprovedPropertiesForWebsite = async (req, res) => {
    try {
        // Optional query parameters for filtering
        const { city, area, gender, propertyType, minPrice, maxPrice, occupancy, search } = req.query;
        
        // Build filter object
        let filter = {
            status: 'approved',
            isLiveOnWebsite: true
        };

        // Apply optional filters
        if (city) {
            filter['propertyInfo.city'] = { $regex: city, $options: 'i' }; // Case-insensitive
        }
        
        if (area) {
            filter['propertyInfo.area'] = area;
        }
        
        if (gender) {
            // Match specific gender or co-ed
            if (gender.toLowerCase() === 'co-ed') {
                filter['propertyInfo.gender'] = 'co-ed';
            } else {
                filter['propertyInfo.gender'] = { $in: [gender, 'co-ed'] };
            }
        }
        
        if (propertyType) {
            filter['propertyInfo.propertyType'] = { $regex: propertyType, $options: 'i' };
        }
        
        if (occupancy) {
            filter['roomInfo.occupancy'] = occupancy;
        }
        
        // Price range filtering
        if (minPrice || maxPrice) {
            filter.monthlyRent = {};
            if (minPrice) {
                filter.monthlyRent.$gte = parseInt(minPrice);
            }
            if (maxPrice && maxPrice !== '50000_plus') {
                filter.monthlyRent.$lte = parseInt(maxPrice);
            }
        }
        
        // Text search in property name or area
        if (search) {
            filter.$or = [
                { 'propertyInfo.name': { $regex: search, $options: 'i' } },
                { 'propertyInfo.area': { $regex: search, $options: 'i' } },
                { 'propertyInfo.city': { $regex: search, $options: 'i' } }
            ];
        }

        // Fetch properties from database
        const properties = await VisitReport.find(filter)
            .select('_id propertyInfo roomInfo monthlyRent rent rating reviewsCount isVerified photos professionalPhotos')
            .sort({ createdAt: -1 })
            .lean();

        // Transform data to match frontend expectations
        const transformedProperties = properties.map(prop => ({
            _id: prop._id,
            propertyInfo: prop.propertyInfo,
            roomInfo: prop.roomInfo,
            monthlyRent: prop.monthlyRent || prop.rent || 0,
            rent: prop.rent || prop.monthlyRent || 0,
            rating: prop.rating || 4.5,
            reviewsCount: prop.reviewsCount || 0,
            isVerified: prop.isVerified || false,
            photos: prop.professionalPhotos || prop.photos || [],
            status: 'approved',
            isLiveOnWebsite: true
        }));

        res.json({ 
            success: true, 
            count: transformedProperties.length,
            properties: transformedProperties 
        });

    } catch (err) {
        console.error("Get Approved Properties Error:", err);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching properties',
            error: err.message 
        });
    }
};