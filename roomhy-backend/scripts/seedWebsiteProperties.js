const mongoose = require('mongoose');
const WebsiteProperty = require('../models/WebsiteProperty');

// Connect to MongoDB
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb+srv://roomhydb:roomhydbkota41@cluster0.cj1yqn9.mongodb.net/?appName=Cluster0');
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
};

// Seed test data
const seedWebsiteProperties = async () => {
    try {
        // Clear existing data
        await WebsiteProperty.deleteMany({});
        console.log('Cleared existing website properties');

        // Sample properties
        const properties = [
            {
                visitId: 'TEST001',
                propertyName: 'Green Valley PG',
                propertyType: 'PG',
                city: 'Bangalore',
                area: 'Indiranagar',
                gender: 'Male',
                ownerName: 'Rajesh Kumar',
                contactPhone: '+91-9876543210',
                monthlyRent: 8000,
                professionalPhotos: ['https://example.com/photo1.jpg'],
                fieldPhotos: ['https://example.com/field1.jpg'],
                isLiveOnWebsite: true,
                status: 'online'
            },
            {
                visitId: 'TEST002',
                propertyName: 'Sunset Towers',
                propertyType: 'Hostel',
                city: 'Bangalore',
                area: 'Whitefield',
                gender: 'Female',
                ownerName: 'Priya Sharma',
                contactPhone: '+91-9876543211',
                monthlyRent: 25000,
                professionalPhotos: ['https://example.com/photo2.jpg'],
                fieldPhotos: ['https://example.com/field2.jpg'],
                isLiveOnWebsite: true,
                status: 'online'
            },
            {
                visitId: 'TEST003',
                propertyName: 'Smart Living PG',
                propertyType: 'PG',
                city: 'Bangalore',
                area: 'Marathahalli',
                gender: 'Co-ed',
                ownerName: 'Amit Singh',
                contactPhone: '+91-9876543212',
                monthlyRent: 9000,
                professionalPhotos: [],
                fieldPhotos: ['https://example.com/field3.jpg'],
                isLiveOnWebsite: false,
                status: 'offline'
            },
            {
                visitId: 'TEST004',
                propertyName: 'Hostel Kota',
                propertyType: 'Hostel',
                city: 'Kota',
                area: 'Mahaveer Nagar',
                gender: 'Male',
                ownerName: 'Vikram Rathore',
                contactPhone: '+91-9876543213',
                monthlyRent: 3500,
                professionalPhotos: ['https://example.com/photo4.jpg'],
                fieldPhotos: ['https://example.com/field4.jpg'],
                isLiveOnWebsite: true,
                status: 'online'
            },
            {
                visitId: 'TEST005',
                propertyName: 'Elite Towers Kota',
                propertyType: 'Hostel',
                city: 'Kota',
                area: 'Dadabari',
                gender: 'Female',
                ownerName: 'Sneha Gupta',
                contactPhone: '+91-9876543214',
                monthlyRent: 18000,
                professionalPhotos: ['https://example.com/photo5.jpg'],
                fieldPhotos: ['https://example.com/field5.jpg'],
                isLiveOnWebsite: true,
                status: 'online'
            },
            {
                visitId: 'TEST006',
                propertyName: 'Indore Hub',
                propertyType: 'PG',
                city: 'Indore',
                area: 'Rajwada',
                gender: 'Co-ed',
                ownerName: 'Rohit Jain',
                contactPhone: '+91-9876543215',
                monthlyRent: 5000,
                professionalPhotos: [],
                fieldPhotos: ['https://example.com/field6.jpg'],
                isLiveOnWebsite: false,
                status: 'offline'
            }
        ];

        // Insert properties
        const inserted = await WebsiteProperty.insertMany(properties);
        console.log(`Seeded ${inserted.length} website properties`);

        // Display summary
        const online = await WebsiteProperty.countDocuments({ isLiveOnWebsite: true });
        const offline = await WebsiteProperty.countDocuments({ isLiveOnWebsite: false });
        console.log(`Online properties: ${online}`);
        console.log(`Offline properties: ${offline}`);

        process.exit(0);
    } catch (error) {
        console.error('Seeding error:', error);
        process.exit(1);
    }
};

// Run the seed
connectDB().then(() => {
    seedWebsiteProperties();
});