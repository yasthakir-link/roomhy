const VisitReport = require('../models/VisitReport');
const Notification = require('../models/Notification');
const User = require('../models/user');

// 1. Submit a visit report (Area Manager)
exports.submitVisit = async (req, res) => {
    try {
        // Save the full visit data from frontend
        const visitData = req.body;
        
        console.log('📝 [submitVisit] Received visit data with _id:', visitData._id);

        // Ensure status is submitted
        visitData.status = 'submitted';
        visitData.submittedAt = new Date();
        visitData.submittedToAdmin = true;
        
        console.log('📝 [submitVisit] Setting status to: submitted');

        const report = await VisitReport.create(visitData);
        
        console.log('✅ [submitVisit] Visit created successfully with _id:', report._id, 'Status:', report.status);

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
                        <p><strong>Property:</strong> ${visitData.propertyInfo?.name || visitData.propertyName || 'N/A'}</p>
                        <p><strong>Owner:</strong> ${visitData.propertyInfo?.ownerName || visitData.ownerName || 'N/A'}</p>
                        <p><strong>City:</strong> ${visitData.propertyInfo?.city || visitData.city || 'N/A'}</p>
                        <p><strong>Area:</strong> ${visitData.propertyInfo?.area || visitData.area || 'N/A'}</p>
                        <p><strong>Submitted By:</strong> ${visitData.submittedBy || 'Area Manager'}</p>
                        <p><strong>Submitted At:</strong> ${new Date().toLocaleString()}</p>
                    </div>
                    <p>Please review this enquiry in the superadmin enquiry panel.</p>
                </div>
            `;
            await mailer.sendMail(superadminEmail, subject, '', html);
            console.log('📧 Enquiry notification email sent successfully');
        } catch (emailError) {
            console.error('⚠️ Failed to send enquiry notification email:', emailError.message);
        }

        return res.status(201).json({ 
            success: true, 
            report,
            message: 'Visit submitted successfully'
        });
    } catch (err) {
        console.error("❌ Submit Visit Error:", err);
        return res.status(500).json({ success: false, message: 'Server error', error: err.message });
    }
};

// 2. Get Pending Visits (Super Admin)
exports.getPendingVisits = async (req, res) => {
    try {
        console.log('🔍 [getPendingVisits] Fetching visits with status: submitted');
        
        const visits = await VisitReport.find({ status: 'submitted' })
            .populate('areaManager', 'name email') 
            .sort({ submittedAt: -1 })
            .lean();
        
        console.log('✅ [getPendingVisits] Found', visits.length, 'submitted visits');
        
        if (visits.length > 0) {
            console.log('📋 First visit preview:', {
                _id: visits[0]._id,
                status: visits[0].status,
                propertyName: visits[0].propertyInfo?.name || 'N/A',
                submittedAt: visits[0].submittedAt
            });
        }
        
        res.json({ 
            success: true, 
            visits: visits,
            count: visits.length
        });
    } catch (err) {
        console.error("❌ Pending Visits Error:", err);
        res.status(500).json({ success: false, message: 'Server error', error: err.message });
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

// Approve Visit and Create User Account
exports.approveVisit = async (req, res) => {
    try {
        const { visitId, status, isLiveOnWebsite, loginId, tempPassword } = req.body;

        // Update visit status
        const visit = await VisitReport.findByIdAndUpdate(
            visitId,
            {
                status: 'approved',
                isLiveOnWebsite: isLiveOnWebsite || false,
                generatedCredentials: { loginId, tempPassword }
            },
            { new: true }
        );

        if (!visit) {
            return res.status(404).json({ success: false, message: 'Visit not found' });
        }

        // If approved for website, create WebsiteEnquiry record
        if (isLiveOnWebsite) {
            const WebsiteEnquiry = require('../models/WebsiteEnquiry');
            
            // Generate unique enquiry_id
            const enquiryId = `ENQ${Date.now()}${Math.floor(Math.random() * 1000)}`;
            
            // Map VisitReport data to WebsiteEnquiry format
            const enquiryData = {
                enquiry_id: enquiryId,
                property_type: visit.propertyInfo?.propertyType || visit.propertyType || 'PG',
                property_name: visit.propertyInfo?.name || visit.propertyName || 'Property',
                city: visit.propertyInfo?.city || visit.city || '',
                locality: visit.propertyInfo?.area || visit.area || '',
                address: visit.propertyInfo?.address || visit.address || '',
                pincode: visit.propertyInfo?.pincode || visit.pincode || '',
                description: visit.propertyInfo?.description || visit.description || '',
                amenities: visit.propertyInfo?.amenities || visit.amenities || [],
                gender_suitability: visit.propertyInfo?.gender || visit.gender || '',
                rent: visit.propertyInfo?.monthlyRent || visit.monthlyRent || 0,
                deposit: visit.propertyInfo?.deposit || visit.deposit || '',
                owner_name: visit.propertyInfo?.ownerName || visit.ownerName || '',
                owner_email: visit.propertyInfo?.ownerGmail || visit.ownerGmail || '',
                owner_phone: visit.propertyInfo?.contactPhone || visit.contactPhone || '',
                photos: [
                    ...(visit.propertyInfo?.professionalPhotos || []),
                    ...(visit.propertyInfo?.fieldPhotos || [])
                ],
                status: 'accepted' // Set as accepted since it's approved
            };

            // Check if enquiry already exists
            const existingEnquiry = await WebsiteEnquiry.findOne({ 
                property_name: enquiryData.property_name,
                city: enquiryData.city,
                owner_email: enquiryData.owner_email
            });

            if (!existingEnquiry) {
                const newEnquiry = new WebsiteEnquiry(enquiryData);
                await newEnquiry.save();
                console.log('✅ Created WebsiteEnquiry record for approved visit:', enquiryId);
            } else {
                console.log('ℹ️ WebsiteEnquiry already exists for this property');
            }
        }

        res.json({
            success: true,
            message: 'Visit approved successfully',
            visit: visit,
            credentials: { loginId, tempPassword }
        });

    } catch (err) {
        console.error('Approve Visit Error:', err);
        res.status(500).json({
            success: false,
            message: 'Error approving visit',
            error: err.message
        });
    }
};

// Hold Visit
exports.holdVisit = async (req, res) => {
    try {
        const { visitId, holdReason } = req.body;

        const visit = await VisitReport.findByIdAndUpdate(
            visitId,
            {
                status: 'hold',
                holdReason: holdReason || '',
                heldAt: new Date()
            },
            { new: true }
        );

        if (!visit) {
            return res.status(404).json({ success: false, message: 'Visit not found' });
        }

        res.json({
            success: true,
            message: 'Visit held successfully',
            visit: visit
        });

    } catch (err) {
        console.error('Hold Visit Error:', err);
        res.status(500).json({
            success: false,
            message: 'Error holding visit',
            error: err.message
        });
    }
};

// Reject Visit
exports.rejectVisit = async (req, res) => {
    try {
        const { visitId, rejectReason } = req.body;

        const visit = await VisitReport.findByIdAndUpdate(
            visitId,
            {
                status: 'rejected',
                rejectReason: rejectReason || '',
                rejectedAt: new Date()
            },
            { new: true }
        );

        if (!visit) {
            return res.status(404).json({ success: false, message: 'Visit not found' });
        }

        res.json({
            success: true,
            message: 'Visit rejected successfully',
            visit: visit
        });

    } catch (err) {
        console.error('Reject Visit Error:', err);
        res.status(500).json({
            success: false,
            message: 'Error rejecting visit',
            error: err.message
        });
    }
};