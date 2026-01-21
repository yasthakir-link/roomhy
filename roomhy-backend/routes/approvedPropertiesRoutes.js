const express = require('express');
const router = express.Router();
const ApprovedProperty = require('../models/ApprovedProperty');

// ============================================================
// POST: Save an approved property to MongoDB
// ============================================================
router.post('/save', async (req, res) => {
    try {
        const {
            visitId,
            propertyInfo,
            generatedCredentials,
            isLiveOnWebsite,
            approvedBy
        } = req.body;

        if (!visitId || !propertyInfo) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: visitId, propertyInfo'
            });
        }

        // Check if already approved
        const existing = await ApprovedProperty.findOne({ visitId });
        if (existing) {
            // Update existing approval
            existing.propertyInfo = propertyInfo;
            existing.isLiveOnWebsite = isLiveOnWebsite || existing.isLiveOnWebsite;
            existing.status = isLiveOnWebsite ? 'live' : 'approved';
            existing.approvedBy = approvedBy || existing.approvedBy;
            if (generatedCredentials) {
                existing.generatedCredentials = generatedCredentials;
            }
            await existing.save();
            console.log('✅ [approved-properties/save] Updated existing approval:', visitId);
            return res.status(200).json({
                success: true,
                message: 'Property approval updated',
                property: existing
            });
        }

        // Create new approved property
        const approvedProperty = new ApprovedProperty({
            visitId,
            propertyInfo,
            generatedCredentials: generatedCredentials || {},
            isLiveOnWebsite: isLiveOnWebsite || false,
            status: isLiveOnWebsite ? 'live' : 'approved',
            approvedBy: approvedBy || 'superadmin'
        });

        await approvedProperty.save();
        console.log('✅ [approved-properties/save] Property approved and saved:', visitId);

        res.status(201).json({
            success: true,
            message: 'Property approved and saved to database',
            property: approvedProperty
        });

    } catch (error) {
        console.error('❌ [approved-properties/save] Error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Error saving approved property',
            error: error.message
        });
    }
});

// ============================================================
// GET: Fetch all approved properties (for website display)
// ============================================================
router.get('/all', async (req, res) => {
    try {
        console.log('🔍 [approved-properties/all] Fetching all approved properties...');
        
        const properties = await ApprovedProperty.find({ 
            isLiveOnWebsite: true 
        }).sort({ approvedAt: -1 });
        
        console.log('✅ [approved-properties/all] Found', properties.length, 'live properties');

        res.status(200).json({
            success: true,
            count: properties.length,
            properties: properties
        });

    } catch (error) {
        console.error('❌ [approved-properties/all] Error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Error fetching properties',
            error: error.message
        });
    }
});

// ============================================================
// GET: Fetch approved properties by city
// ============================================================
router.get('/city/:city', async (req, res) => {
    try {
        const { city } = req.params;
        console.log('🔍 [approved-properties/city] Fetching properties for city:', city);
        
        const properties = await ApprovedProperty.find({
            'propertyInfo.city': city,
            isLiveOnWebsite: true
        }).sort({ approvedAt: -1 });
        
        console.log('✅ [approved-properties/city] Found', properties.length, 'properties for city:', city);

        res.status(200).json({
            success: true,
            count: properties.length,
            properties: properties
        });

    } catch (error) {
        console.error('❌ [approved-properties/city] Error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Error fetching properties by city',
            error: error.message
        });
    }
});

// ============================================================
// GET: Public approved properties (for ourproperty.html)
// ============================================================
router.get('/public/approved', async (req, res) => {
    try {
        console.log('🔍 [approved-properties/public/approved] Fetching public approved properties...');

        const properties = await ApprovedProperty.find({
            status: { $in: ['approved', 'live'] },
            isLiveOnWebsite: true
        }).sort({ approvedAt: -1 });

        console.log('✅ [approved-properties/public/approved] Found', properties.length, 'live approved properties');

        // Transform to match ourproperty.html expectations
        const transformedProperties = properties.map(prop => ({
            _id: prop.visitId,
            enquiry_id: prop.visitId,
            property_name: prop.propertyInfo?.name || 'Property',
            property_type: prop.propertyInfo?.propertyType || '',
            locality: prop.propertyInfo?.area || '',
            city: prop.propertyInfo?.city || '',
            rent: prop.monthlyRent || prop.propertyInfo?.monthlyRent || 0,
            photos: prop.photos || [],
            professionalPhotos: prop.professionalPhotos || [],
            isVerified: true,
            rating: 4.5,
            reviewsCount: 10,
            propertyInfo: prop.propertyInfo,
            monthlyRent: prop.monthlyRent || prop.propertyInfo?.monthlyRent || 0,
            gender: prop.propertyInfo?.gender || 'Co-ed',
            status: prop.status,
            isLiveOnWebsite: prop.isLiveOnWebsite
        }));

        res.status(200).json(transformedProperties);

    } catch (error) {
        console.error('❌ [approved-properties/public/approved] Error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Error fetching public approved properties',
            error: error.message
        });
    }
});

// ============================================================
// GET: Fetch all approved properties (including offline)
// ============================================================
router.get('/approved/all', async (req, res) => {
    try {
        console.log('🔍 [approved-properties/approved/all] Fetching all approved properties...');

        const properties = await ApprovedProperty.find({
            status: { $in: ['approved', 'live'] }
        }).sort({ approvedAt: -1 });

        console.log('✅ [approved-properties/approved/all] Found', properties.length, 'approved properties');

        res.status(200).json({
            success: true,
            count: properties.length,
            properties: properties
        });

    } catch (error) {
        console.error('❌ [approved-properties/approved/all] Error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Error fetching approved properties',
            error: error.message
        });
    }
});

// ============================================================
// GET: Fetch a specific approved property by visitId
// ============================================================
router.get('/:visitId', async (req, res) => {
    try {
        const { visitId } = req.params;
        console.log('🔍 [approved-properties/:visitId] Fetching property:', visitId);
        
        const property = await ApprovedProperty.findOne({ visitId });
        
        if (!property) {
            return res.status(404).json({
                success: false,
                message: 'Property not found'
            });
        }

        console.log('✅ [approved-properties/:visitId] Found property:', visitId);

        res.status(200).json({
            success: true,
            property: property
        });

    } catch (error) {
        console.error('❌ [approved-properties/:visitId] Error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Error fetching property',
            error: error.message
        });
    }
});

// ============================================================
// PUT: Update property to toggle live status
// ============================================================
router.put('/:visitId/toggle-live', async (req, res) => {
    try {
        const { visitId } = req.params;
        const { isLiveOnWebsite } = req.body;

        const property = await ApprovedProperty.findOne({ visitId });
        if (!property) {
            return res.status(404).json({
                success: false,
                message: 'Property not found'
            });
        }

        property.isLiveOnWebsite = isLiveOnWebsite;
        property.status = isLiveOnWebsite ? 'live' : 'approved';
        await property.save();

        console.log('✅ [approved-properties/toggle-live] Updated property:', visitId, 'isLive:', isLiveOnWebsite);

        res.status(200).json({
            success: true,
            message: 'Property status updated',
            property: property
        });

    } catch (error) {
        console.error('❌ [approved-properties/toggle-live] Error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Error updating property',
            error: error.message
        });
    }
});

// ============================================================
// DELETE: Remove an approved property
// ============================================================
router.delete('/:visitId', async (req, res) => {
    try {
        const { visitId } = req.params;

        const result = await ApprovedProperty.findOneAndDelete({ visitId });
        if (!result) {
            return res.status(404).json({
                success: false,
                message: 'Property not found'
            });
        }

        console.log('✅ [approved-properties/delete] Property deleted:', visitId);

        res.status(200).json({
            success: true,
            message: 'Property deleted successfully'
        });

    } catch (error) {
        console.error('❌ [approved-properties/delete] Error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Error deleting property',
            error: error.message
        });
    }
});

module.exports = router;
