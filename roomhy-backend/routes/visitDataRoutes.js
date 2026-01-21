const express = require('express');
const router = express.Router();
const VisitData = require('../models/VisitData');

// ============================================================
// POST: Save visit data (used by visit.html)
// ============================================================
router.post('/', async (req, res) => {
    try {
        const visitData = req.body;

        // Generate visitId if not provided
        const visitId = visitData.visitId || visitData._id || ('v_' + Date.now());

        // Create new visit document
        const newVisit = new VisitData({
            ...visitData,
            visitId: visitId,
            submittedAt: new Date(),
            status: visitData.status || 'submitted'
        });

        await newVisit.save();

        console.log('✅ [visits/POST] Visit saved to MongoDB:', newVisit._id);

        res.status(201).json({
            success: true,
            message: 'Visit saved successfully',
            visit: newVisit
        });

    } catch (error) {
        console.error('❌ [visits/POST] Error saving visit:', error.message);
        res.status(500).json({
            success: false,
            message: 'Error saving visit',
            error: error.message
        });
    }
});

// ============================================================
// GET: Root endpoint - returns all visits (alias for /all)
// Used by Area Manager dashboard
// Supports optional ?staffId parameter to filter by staff
// ============================================================
router.get('/', async (req, res) => {
    try {
        const staffId = req.query.staffId;
        
        let query = {};
        if (staffId) {
            query.staffId = staffId;
            console.log(`📥 [visits/GET] Fetching visits for staffId: ${staffId}`);
        } else {
            console.log('📥 [visits/GET] Fetching all visits');
        }
        
        const visits = await VisitData.find(query).sort({ submittedAt: -1 });
        
        console.log(`✅ [visits/GET] Returning ${visits.length} visits`);
        
        res.json({
            success: true,
            count: visits.length,
            visits: visits
        });
    } catch (error) {
        console.error('Error fetching visits:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching visits',
            error: error.message
        });
    }
});

// ============================================================
// GET: Pending visits (for superadmin enquiry)
// ============================================================
router.get('/pending', async (req, res) => {
    try {
        const visits = await VisitData.find({
            status: { $in: ['submitted', 'pending_review'] }
        }).sort({ submittedAt: -1 });

        console.log(`✅ [visits/pending] Returning ${visits.length} pending visits`);

        res.json({
            success: true,
            count: visits.length,
            visits: visits
        });
    } catch (error) {
        console.error('Error fetching pending visits:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching pending visits',
            error: error.message
        });
    }
});

// ============================================================
// POST: Approve a visit
// ============================================================
router.post('/approve', async (req, res) => {
    try {
        const { visitId, status, isLiveOnWebsite, loginId, tempPassword } = req.body;

        if (!visitId) {
            return res.status(400).json({
                success: false,
                message: 'Missing visitId'
            });
        }

        // Generate credentials if not provided
        const finalLoginId = loginId || `ROOMHY${Math.floor(1000 + Math.random() * 9000)}`;
        const finalPassword = tempPassword || Math.random().toString(36).slice(-8);

        // Find and update visit status to approved
        const visit = await VisitData.findOneAndUpdate(
            { $or: [{ _id: visitId }, { visitId: visitId }] },
            {
                status: status || 'approved',
                approvedAt: new Date(),
                isLiveOnWebsite: isLiveOnWebsite !== undefined ? isLiveOnWebsite : false,
                generatedCredentials: {
                    loginId: finalLoginId,
                    tempPassword: finalPassword
                }
            },
            { new: true }
        );

        if (!visit) {
            return res.status(404).json({
                success: false,
                message: 'Visit not found'
            });
        }

        // If approved and live on website, also save to ApprovedProperty collection
        if (status === 'approved' && isLiveOnWebsite) {
            const ApprovedProperty = require('../models/ApprovedProperty');

            await ApprovedProperty.findOneAndUpdate(
                { visitId: visit._id || visit.visitId },
                {
                    visitId: visit._id || visit.visitId,
                    propertyInfo: visit.propertyInfo || {
                        name: visit.propertyName,
                        propertyType: visit.propertyType,
                        area: visit.area,
                        ownerName: visit.ownerName,
                        contactPhone: visit.ownerPhone,
                        address: visit.address
                    },
                    generatedCredentials: {
                        loginId: finalLoginId,
                        tempPassword: finalPassword
                    },
                    isLiveOnWebsite: true,
                    status: 'approved',
                    approvedAt: new Date()
                },
                { upsert: true, new: true }
            );
        }

        console.log('✅ [visits/approve] Visit approved:', visitId);

        res.json({
            success: true,
            message: 'Visit approved successfully',
            visit: visit,
            credentials: {
                loginId: finalLoginId,
                tempPassword: finalPassword
            }
        });
    } catch (error) {
        console.error('❌ [visits/approve] Error approving visit:', error);
        res.status(500).json({
            success: false,
            message: 'Error approving visit',
            error: error.message
        });
    }
});

// ============================================================
// POST: Hold a visit
// ============================================================
router.post('/hold', async (req, res) => {
    try {
        const { visitId, holdReason } = req.body;

        if (!visitId) {
            return res.status(400).json({
                success: false,
                message: 'Missing visitId'
            });
        }

        // Find and update visit status to hold
        const visit = await VisitData.findOneAndUpdate(
            { $or: [{ _id: visitId }, { visitId: visitId }] },
            {
                status: 'hold',
                holdReason: holdReason || '',
                holdAt: new Date()
            },
            { new: true }
        );

        if (!visit) {
            return res.status(404).json({
                success: false,
                message: 'Visit not found'
            });
        }

        console.log('✅ [visits/hold] Visit held:', visitId);

        res.json({
            success: true,
            message: 'Visit held successfully',
            visit: visit
        });
    } catch (error) {
        console.error('❌ [visits/hold] Error holding visit:', error);
        res.status(500).json({
            success: false,
            message: 'Error holding visit',
            error: error.message
        });
    }
});

// ============================================================
// POST: Submit a new visit
// Supports both old (Area Manager) and new (clean form) formats
// ============================================================
router.post('/submit', async (req, res) => {
    try {
        let {
            visitorName,
            visitorEmail,
            visitorPhone,
            propertyName,
            propertyType,
            city,
            area,
            address,
            pincode,
            description,
            amenities,
            genderSuitability,
            monthlyRent,
            deposit,
            ownerName,
            ownerEmail,
            ownerPhone,
            ownerCity,
            photos,
            professionalPhotos,
            // Old format support
            staffName,
            staffId,
            propertyInfo,
            name,
            contactPhone,
            ownerGmail,
            landmark,
            nearbyLocation,
            cleanlinessRating,
            studentReviewsRating,
            studentReviews,
            furnishing,
            ventilation,
            minStay,
            entryExit,
            visitorsAllowed,
            cookingAllowed,
            smokingAllowed,
            petsAllowed,
            internalRemarks,
            cleanlinessNote,
            ownerBehaviour,
            latitude,
            longitude
        } = req.body;

        // Support both old and new formats
        if (propertyInfo) {
            // Old Area Manager format
            propertyName = propertyName || propertyInfo.name || name;
            propertyType = propertyType || propertyInfo.propertyType;
            city = city || propertyInfo.city;
            area = area || propertyInfo.area;
            ownerName = ownerName || propertyInfo.ownerName;
            ownerEmail = ownerEmail || propertyInfo.ownerGmail || propertyInfo.ownerEmail;
            ownerPhone = ownerPhone || propertyInfo.contactPhone;
            address = address || propertyInfo.address;
            pincode = pincode || propertyInfo.pincode;
        } else {
            // New format - ensure propertyName is set
            propertyName = propertyName || name;
        }

        // Validate required fields
        // propertyName is required. city is optional if area is provided.
        if (!propertyName) {
            return res.status(400).json({
                success: false,
                message: 'Missing required field: propertyName'
            });
        }
        
        // If city is not provided, use area as city (for Area Manager visits)
        if (!city && area) {
            city = area;
        } else if (!city) {
            city = 'Unknown'; // Fallback city
        }

        // Create unique visit ID (use existing _id if provided)
        const visitId = req.body._id || (Date.now() + '_' + Math.random().toString(36).substr(2, 9));

        // Create new visit
        const visit = new VisitData({
            visitId,
            visitorName: visitorName || staffName,
            visitorEmail,
            visitorPhone,
            propertyName,
            propertyType,
            city,
            area,
            address,
            pincode,
            description,
            amenities: (amenities && Array.isArray(amenities)) ? amenities : (amenities ? [amenities] : []),
            genderSuitability,
            monthlyRent: parseInt(monthlyRent) || 0,
            deposit,
            ownerName,
            ownerEmail,
            ownerPhone,
            ownerCity: ownerCity || city,
            photos: (photos && Array.isArray(photos)) ? photos : (photos ? [photos] : []),
            professionalPhotos: (professionalPhotos && Array.isArray(professionalPhotos)) ? professionalPhotos : (professionalPhotos ? [professionalPhotos] : []),
            status: 'submitted',
            // Additional fields from old format
            ...(staffId && { staffId }),
            ...(staffName && { staffName }),
            ...(latitude && { latitude }),
            ...(longitude && { longitude }),
            ...(landmark && { landmark }),
            ...(nearbyLocation && { nearbyLocation }),
            ...(cleanlinessRating && { cleanlinessRating }),
            ...(studentReviewsRating && { studentReviewsRating }),
            ...(studentReviews && { studentReviews }),
            ...(furnishing && { furnishing }),
            ...(ventilation && { ventilation }),
            ...(minStay && { minStay }),
            ...(entryExit && { entryExit }),
            ...(visitorsAllowed && { visitorsAllowed }),
            ...(cookingAllowed && { cookingAllowed }),
            ...(smokingAllowed && { smokingAllowed }),
            ...(petsAllowed && { petsAllowed }),
            ...(internalRemarks && { internalRemarks }),
            ...(cleanlinessNote && { cleanlinessNote }),
            ...(ownerBehaviour && { ownerBehaviour })
        });

        // Save to MongoDB
        await visit.save();

        res.status(201).json({
            success: true,
            message: 'Visit submitted successfully',
            visitId: visitId,
            data: visit
        });

    } catch (error) {
        console.error('Error submitting visit:', error);
        res.status(500).json({
            success: false,
            message: 'Error submitting visit',
            error: error.message
        });
    }
});

// ============================================================
// GET: Get all visits
// ============================================================
router.get('/all', async (req, res) => {
    try {
        const visits = await VisitData.find({}).sort({ submittedAt: -1 });
        res.json({
            success: true,
            count: visits.length,
            visits: visits
        });
    } catch (error) {
        console.error('Error fetching visits:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching visits',
            error: error.message
        });
    }
});

// ============================================================
// GET: Get pending visits (for enquiry.html)
// ============================================================
router.get('/pending', async (req, res) => {
    try {
        console.log('📥 [visits/pending/GET] Fetching pending visits...');
        const visits = await VisitData.find({ 
            status: { $in: ['submitted', 'pending_review'] }
        }).sort({ submittedAt: -1 });
        
        console.log(`✅ [visits/pending/GET] Found ${visits.length} pending visits`);
        
        res.json({
            success: true,
            count: visits.length,
            visits: visits
        });
    } catch (error) {
        console.error('Error fetching pending visits:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching pending visits',
            error: error.message
        });
    }
});

// ============================================================
// GET: Get approved visits
// ============================================================
// GET: Get approved visits (for public display on ourproperty.html)
// ============================================================
router.get('/public/approved', async (req, res) => {
    try {
        const visits = await VisitData.find({ 
            status: 'approved'
        }).sort({ submittedAt: -1 });
        res.json({
            success: true,
            count: visits.length,
            visits: visits,
            properties: visits  // Alias for compatibility
        });
    } catch (error) {
        console.error('Error fetching public approved visits:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching approved visits',
            error: error.message
        });
    }
});

// ============================================================
router.get('/approved', async (req, res) => {
    try {
        const visits = await VisitData.find({ 
            status: 'approved'
        }).sort({ submittedAt: -1 });
        res.json({
            success: true,
            count: visits.length,
            visits: visits
        });
    } catch (error) {
        console.error('Error fetching approved visits:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching approved visits',
            error: error.message
        });
    }
});

// ============================================================
// GET: Get a single visit by ID
// ============================================================
router.get('/:visitId', async (req, res) => {
    try {
        const visit = await VisitData.findOne({ visitId: req.params.visitId });
        
        if (!visit) {
            return res.status(404).json({
                success: false,
                message: 'Visit not found'
            });
        }

        res.json({
            success: true,
            visit: visit
        });
    } catch (error) {
        console.error('Error fetching visit:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching visit',
            error: error.message
        });
    }
});

// ============================================================
// PUT: Update visit status
// ============================================================
router.put('/:visitId/status', async (req, res) => {
    try {
        const { status } = req.body;
        
        if (!status) {
            return res.status(400).json({
                success: false,
                message: 'status is required'
            });
        }

        const visit = await VisitData.findOneAndUpdate(
            { visitId: req.params.visitId },
            { status, updatedAt: new Date() },
            { new: true }
        );

        if (!visit) {
            return res.status(404).json({
                success: false,
                message: 'Visit not found'
            });
        }

        res.json({
            success: true,
            message: 'Visit status updated',
            visit: visit
        });
    } catch (error) {
        console.error('Error updating visit status:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating visit status',
            error: error.message
        });
    }
});

// ============================================================
// POST: Approve a visit (from enquiry.html)
// ============================================================
router.post('/:visitId/approve', async (req, res) => {
    try {
        const { approvalNotes, approvedBy } = req.body;
        
        const visit = await VisitData.findOneAndUpdate(
            { visitId: req.params.visitId },
            {
                status: 'approved',
                approvedAt: new Date(),
                approvalNotes,
                approvedBy,
                updatedAt: new Date()
            },
            { new: true }
        );

        if (!visit) {
            return res.status(404).json({
                success: false,
                message: 'Visit not found'
            });
        }

        // Now also create/update in ApprovedProperty collection
        const ApprovedProperty = require('../models/ApprovedProperty');
        
        const approvedProperty = await ApprovedProperty.findOneAndUpdate(
            { propertyId: visit.visitId },
            {
                propertyId: visit.visitId,
                visitDataId: visit.visitId,
                propertyName: visit.propertyName,
                propertyType: visit.propertyType,
                city: visit.city,
                area: visit.area,
                address: visit.address,
                pincode: visit.pincode,
                description: visit.description,
                amenities: visit.amenities,
                genderSuitability: visit.genderSuitability,
                monthlyRent: visit.monthlyRent,
                deposit: visit.deposit,
                ownerName: visit.ownerName,
                ownerEmail: visit.ownerEmail,
                ownerPhone: visit.ownerPhone,
                ownerCity: visit.ownerCity,
                photos: visit.photos,
                professionalPhotos: visit.professionalPhotos,
                approvedAt: new Date(),
                approvalNotes: approvalNotes,
                approvedBy: approvedBy,
                submittedAt: visit.submittedAt
            },
            { upsert: true, new: true }
        );

        res.json({
            success: true,
            message: 'Visit approved and added to approved properties',
            visit: visit,
            approvedProperty: approvedProperty
        });

    } catch (error) {
        console.error('Error approving visit:', error);
        res.status(500).json({
            success: false,
            message: 'Error approving visit',
            error: error.message
        });
    }
});

// ============================================================
// POST: Reject a visit
// ============================================================
router.post('/:visitId/reject', async (req, res) => {
    try {
        const { approvalNotes, approvedBy } = req.body;
        
        const visit = await VisitData.findOneAndUpdate(
            { visitId: req.params.visitId },
            {
                status: 'rejected',
                approvalNotes,
                approvedBy,
                updatedAt: new Date()
            },
            { new: true }
        );

        if (!visit) {
            return res.status(404).json({
                success: false,
                message: 'Visit not found'
            });
        }

        res.json({
            success: true,
            message: 'Visit rejected',
            visit: visit
        });

    } catch (error) {
        console.error('Error rejecting visit:', error);
        res.status(500).json({
            success: false,
            message: 'Error rejecting visit',
            error: error.message
        });
    }
});

// ============================================================
// DELETE: Delete a visit
// ============================================================
router.delete('/:visitId', async (req, res) => {
    try {
        const visit = await VisitData.findOneAndDelete({ visitId: req.params.visitId });
        
        if (!visit) {
            return res.status(404).json({
                success: false,
                message: 'Visit not found'
            });
        }

        res.json({
            success: true,
            message: 'Visit deleted successfully',
            visit: visit
        });
    } catch (error) {
        console.error('Error deleting visit:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting visit',
            error: error.message
        });
    }
});

module.exports = router;
