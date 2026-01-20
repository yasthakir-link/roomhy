const WebsiteProperty = require('../models/WebsiteProperty');

// Get all website properties
exports.getAllWebsiteProperties = async (req, res) => {
    try {
        const properties = await WebsiteProperty.find().sort({ createdAt: -1 });
        res.json({
            success: true,
            properties: properties
        });
    } catch (err) {
        console.error('Error fetching website properties:', err);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// Get website properties by status (online/offline)
exports.getWebsitePropertiesByStatus = async (req, res) => {
    try {
        const { status } = req.params; // 'online' or 'offline'
        const isLive = status === 'online';

        const properties = await WebsiteProperty.find({ isLiveOnWebsite: isLive }).sort({ createdAt: -1 });
        res.json({
            success: true,
            properties: properties
        });
    } catch (err) {
        console.error('Error fetching website properties by status:', err);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// Add property to website
exports.addWebsiteProperty = async (req, res) => {
    try {
        const propertyData = req.body;

        // Check if property already exists
        const existing = await WebsiteProperty.findOne({ visitId: propertyData.visitId });
        if (existing) {
            return res.status(400).json({
                success: false,
                message: 'Property already exists on website'
            });
        }

        const websiteProperty = new WebsiteProperty(propertyData);
        await websiteProperty.save();

        res.json({
            success: true,
            property: websiteProperty
        });
    } catch (err) {
        console.error('Error adding website property:', err);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// Toggle property status (online/offline)
exports.toggleWebsiteStatus = async (req, res) => {
    try {
        const { visitId } = req.params;

        const property = await WebsiteProperty.findOne({ visitId });
        if (!property) {
            return res.status(404).json({
                success: false,
                message: 'Property not found'
            });
        }

        property.isLiveOnWebsite = !property.isLiveOnWebsite;
        property.status = property.isLiveOnWebsite ? 'online' : 'offline';
        await property.save();

        res.json({
            success: true,
            property: property
        });
    } catch (err) {
        console.error('Error toggling website status:', err);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// Delete property from website
exports.deleteWebsiteProperty = async (req, res) => {
    try {
        const { visitId } = req.params;

        const result = await WebsiteProperty.findOneAndDelete({ visitId });
        if (!result) {
            return res.status(404).json({
                success: false,
                message: 'Property not found'
            });
        }

        res.json({
            success: true,
            message: 'Property removed from website'
        });
    } catch (err) {
        console.error('Error deleting website property:', err);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// Get properties for public website (only online ones)
exports.getPublicWebsiteProperties = async (req, res) => {
    try {
        const { city, area, minPrice, maxPrice, gender, propertyType } = req.query;

        let filter = { isLiveOnWebsite: true };

        if (city) filter.city = new RegExp(city, 'i');
        if (area) filter.area = new RegExp(area, 'i');
        if (gender) filter.gender = new RegExp(gender, 'i');
        if (propertyType) filter.propertyType = new RegExp(propertyType, 'i');
        if (minPrice) filter.monthlyRent = { ...filter.monthlyRent, $gte: parseInt(minPrice) };
        if (maxPrice) {
            if (maxPrice === '50000_plus') {
                filter.monthlyRent = { ...filter.monthlyRent, $gte: 50000 };
            } else {
                filter.monthlyRent = { ...filter.monthlyRent, $lte: parseInt(maxPrice) };
            }
        }

        const properties = await WebsiteProperty.find(filter).sort({ createdAt: -1 });

        res.json({
            success: true,
            properties: properties
        });
    } catch (err) {
        console.error('Error fetching public website properties:', err);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};