const mongoose = require('mongoose');

const WebsitePropertySchema = new mongoose.Schema({
    visitId: { type: String, required: true, unique: true }, // Reference to the original visit report
    propertyName: { type: String, required: true },
    propertyType: { type: String, required: true },
    city: { type: String, required: true },
    area: { type: String, required: true },
    gender: { type: String },
    ownerName: { type: String },
    contactPhone: { type: String },
    monthlyRent: { type: Number, required: true },
    professionalPhotos: [{ type: String }], // URLs
    fieldPhotos: [{ type: String }], // URLs
    isLiveOnWebsite: { type: Boolean, default: true },
    status: { type: String, enum: ['online', 'offline'], default: 'online' },
    submittedAt: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Auto-update updatedAt on save
WebsitePropertySchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model('WebsiteProperty', WebsitePropertySchema);