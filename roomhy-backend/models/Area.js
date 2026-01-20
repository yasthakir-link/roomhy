const mongoose = require('mongoose');

const AreaSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        city: { type: mongoose.Schema.Types.ObjectId, ref: 'City', required: true },
        cityName: { type: String, required: true }, // Denormalized for easier querying
        imageUrl: { type: String, default: null }, // Cloudinary image URL
        imagePublicId: { type: String, default: null }, // Cloudinary public ID for deletion
        status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
        createdBy: { type: String, default: 'superadmin' },
        lastModifiedBy: { type: String, default: 'superadmin' }
    },
    { timestamps: true }
);

// Compound index for unique area per city
AreaSchema.index({ name: 1, city: 1 }, { unique: true });

module.exports = mongoose.model('Area', AreaSchema);
