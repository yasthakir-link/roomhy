const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema({
    tenantId: {
        type: String,
        required: true,
        index: true
    },
    tenantLoginId: {
        type: String,
        default: '',
        index: true
    },
    tenantName: {
        type: String,
        required: true
    },
    tenantPhone: {
        type: String,
        required: true
    },
    tenantEmail: {
        type: String,
        default: ''
    },
    property: {
        type: String,
        required: true
    },
    propertyId: {
        type: String,
        default: '',
        index: true
    },
    ownerLoginId: {
        type: String,
        default: '',
        index: true
    },
    roomNo: {
        type: String,
        required: true
    },
    bedNo: {
        type: String,
        required: true
    },
    category: {
        type: String,
        required: true,
        enum: ['Plumbing', 'Electrical', 'Furniture', 'Appliances', 'Cleaning', 'Internet', 'Ragging', 'Food Issue', 'Major Issue', 'Other']
    },
    issueType: {
        type: String,
        default: ''
    },
    description: {
        type: String,
        required: true
    },
    imageStr: {
        type: String,
        default: ''
    },
    priority: {
        type: String,
        required: true,
        enum: ['Low', 'Medium', 'High'],
        default: 'Low'
    },
    status: {
        type: String,
        required: true,
        enum: ['Open', 'Taken', 'In Progress', 'Resolved', 'Rejected'],
        default: 'Open'
    },
    assignedTo: {
        type: String,
        default: null
    },
    ownerResponse: {
        type: String,
        default: ''
    },
    ownerResponseBy: {
        type: String,
        default: ''
    },
    ownerResponseByLoginId: {
        type: String,
        default: ''
    },
    escalated: {
        type: Boolean,
        default: false
    },
    escalatedAt: {
        type: Date,
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    resolvedAt: {
        type: Date,
        default: null
    }
});

module.exports = mongoose.model('Complaint', complaintSchema);
