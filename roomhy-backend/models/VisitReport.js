const mongoose = require('mongoose');

const VisitReportSchema = new mongoose.Schema({
    _id: { type: mongoose.Schema.Types.Mixed },
    areaManager: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    
    // Property Information (Extended for website display)
    propertyInfo: {
        propertyId: { type: String },
        propertyType: { type: String }, // PG, Hostel, Apartment, etc.
        name: { type: String },
        ownerName: { type: String },
        contactPhone: { type: String },
        ownerGmail: { type: String },
        area: { type: String },
        landmark: { type: String },
        locationCode: { type: String },
        nearbyLocation: { type: String },
        city: { type: String },
        locality: { type: String },
        address: { type: String },
        gender: { type: String }, // Male, Female, Co-ed
        description: { type: String }
    },
    
    // Location
    latitude: { type: String },
    longitude: { type: String },
    
    // Ratings and Reviews
    cleanlinessRating: { type: String },
    ownerBehaviourPublic: { type: String },
    studentReviewsRating: { type: String },
    studentReviews: { type: String },
    employeeRating: { type: String },
    
    // Property Details
    gender: { type: String },
    furnishing: { type: String },
    ventilation: { type: String },
    amenities: [{ type: String }],
    monthlyRent: { type: Number },
    deposit: { type: String },
    electricityCharges: { type: String },
    foodCharges: { type: String },
    maintenanceCharges: { type: String },
    minStay: { type: String },
    entryExit: { type: String },
    visitorsAllowed: { type: String },
    cookingAllowed: { type: String },
    smokingAllowed: { type: String },
    petsAllowed: { type: String },
    
    // Notes
    internalRemarks: { type: String },
    cleanlinessNote: { type: String },
    ownerBehaviour: { type: String },
    
    // Media
    photos: [{ type: String }],
    professionalPhotos: [{ type: String }],
    
    // Staff Info
    submittedBy: { type: String },
    submittedById: { type: String },
    staffName: { type: String },
    staffId: { type: String },
    ownerLoginId: { type: String },
    propertyArea: { type: String },
    verifiedByCompany: { type: Boolean, default: true },
    
    // Room/Occupancy Information
    roomInfo: {
        occupancy: { type: String }, // Single, Double, Triple, etc.
        bedCount: { type: Number }
    },
    
    // Financial Info
    rent: { type: Number, default: 0 },
    
    // Website Listing Info
    isLiveOnWebsite: { type: Boolean, default: false },
    isVerified: { type: Boolean, default: false },
    rating: { type: Number, default: 4.5 },
    reviewsCount: { type: Number, default: 0 },
    
    // Status & Notes
    notes: { type: String },
    status: { type: String, enum: ['submitted','pending','approved','rejected'], default: 'submitted' },
    
    // Generated Owner Credentials (when property is approved)
    generatedCredentials: {
        loginId: { type: String },
        tempPassword: { type: String }
    },
    
    // Link to created Property (if approved)
    property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property' },

    submittedAt: { type: Date, default: Date.now },
    submittedToAdmin: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('VisitReport', VisitReportSchema);