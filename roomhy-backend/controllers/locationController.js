const express = require('express');

// ==================== LOCATION OPERATIONS ====================

/**
 * GET ALL CITIES
 * Returns all cities from localStorage
 */
exports.getCities = async (req, res) => {
    try {
        // Since locations are stored in localStorage (client-side),
        // we'll need to get them from the client or use a different approach
        // For now, return the default cities that are seeded in location.html

        const cities = [
            { id: 'ct_1', name: 'Bangalore', state: 'Karnataka', status: 'Active', image: null },
            { id: 'ct_2', name: 'Chennai', state: 'Tamil Nadu', status: 'Active', image: null },
            { id: 'ct_3', name: 'Coimbatore', state: 'Tamil Nadu', status: 'Active', image: null },
            { id: 'ct_4', name: 'Tirunelveli', state: 'Tamil Nadu', status: 'Active', image: null },
            { id: 'ct_5', name: 'Kota', state: 'Rajasthan', status: 'Active', image: null },
            { id: 'ct_6', name: 'Sikar', state: 'Rajasthan', status: 'Active', image: null },
            { id: 'ct_7', name: 'Indore', state: 'Madhya Pradesh', status: 'Active', image: null },
            { id: 'ct_8', name: 'Pune', state: 'Maharashtra', status: 'Active', image: null },
            { id: 'ct_9', name: 'Delhi', state: 'Delhi', status: 'Active', image: null }
        ];

        res.status(200).json({
            success: true,
            data: cities
        });
    } catch (error) {
        console.error('Error fetching cities:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * GET ALL AREAS
 * Returns all areas from localStorage
 */
exports.getAreas = async (req, res) => {
    try {
        // Return the default areas that are seeded in location.html
        const areas = [
            { id: 'ar_1', name: 'Koramangala', city: 'Bangalore', photo: null, status: 'Active' },
            { id: 'ar_2', name: 'Indiranagar', city: 'Bangalore', photo: null, status: 'Active' },
            { id: 'ar_3', name: 'Anna Nagar', city: 'Chennai', photo: null, status: 'Active' },
            { id: 'ar_4', name: 'T Nagar', city: 'Chennai', photo: null, status: 'Active' },
            { id: 'ar_5', name: 'Gandhipuram', city: 'Coimbatore', photo: null, status: 'Active' }
        ];

        res.status(200).json({
            success: true,
            data: areas
        });
    } catch (error) {
        console.error('Error fetching areas:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * GET AREAS BY CITY
 * Returns areas filtered by city name
 */
exports.getAreasByCity = async (req, res) => {
    try {
        const { city } = req.params;

        if (!city) {
            return res.status(400).json({
                success: false,
                message: 'City parameter is required'
            });
        }

        // Return areas filtered by city
        const allAreas = [
            { id: 'ar_1', name: 'Koramangala', city: 'Bangalore', photo: null, status: 'Active' },
            { id: 'ar_2', name: 'Indiranagar', city: 'Bangalore', photo: null, status: 'Active' },
            { id: 'ar_3', name: 'Anna Nagar', city: 'Chennai', photo: null, status: 'Active' },
            { id: 'ar_4', name: 'T Nagar', city: 'Chennai', photo: null, status: 'Active' },
            { id: 'ar_5', name: 'Gandhipuram', city: 'Coimbatore', photo: null, status: 'Active' }
        ];

        const filteredAreas = allAreas.filter(area =>
            area.city.toLowerCase() === city.toLowerCase()
        );

        res.status(200).json({
            success: true,
            data: filteredAreas
        });
    } catch (error) {
        console.error('Error fetching areas by city:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};