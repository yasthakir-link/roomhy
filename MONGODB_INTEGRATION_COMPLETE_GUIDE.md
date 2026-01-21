# MongoDB Atlas Integration Guide - Complete Implementation

## Overview
This guide provides a comprehensive setup for integrating MongoDB Atlas with your property management system for:
1. **visit.html** - Store and display property visits
2. **enquiry.html** - Fetch, approve, and manage enquiries
3. **website.html** - Fetch and store website properties
4. **ourproperty.html** - Display fetched properties

---

## Database Structure

### Collections

#### 1. VisitData (visits collection)
```json
{
  "_id": ObjectId,
  "visitId": "timestamp_random",
  "visitorName": "string",
  "visitorEmail": "string",
  "visitorPhone": "string",
  "propertyName": "string",
  "propertyType": "apartment|house|room|commercial",
  "city": "string",
  "area": "string",
  "address": "string",
  "pincode": "string",
  "description": "string",
  "amenities": ["string"],
  "genderSuitability": "any|male|female|families",
  "monthlyRent": number,
  "deposit": "string",
  "ownerName": "string",
  "ownerEmail": "string",
  "ownerPhone": "string",
  "ownerCity": "string",
  "photos": ["base64_strings"],
  "professionalPhotos": ["base64_strings"],
  "status": "submitted|pending_review|approved|rejected",
  "approvedAt": Date,
  "approvedBy": "string",
  "createdAt": Date,
  "updatedAt": Date
}
```

#### 2. WebsiteEnquiry (website_enquiries collection)
```json
{
  "_id": ObjectId,
  "enquiry_id": "timestamp_random",
  "property_type": "string",
  "property_name": "string",
  "city": "string",
  "locality": "string",
  "address": "string",
  "pincode": "string",
  "description": "string",
  "amenities": ["string"],
  "gender_suitability": "string",
  "rent": number,
  "deposit": "string",
  "owner_name": "string",
  "owner_email": "string",
  "owner_phone": "string",
  "photos": ["base64_strings"],
  "status": "pending|assigned|accepted|completed|rejected",
  "assigned_to": "string|null",
  "assigned_area": "string|null",
  "assigned_date": Date|null,
  "notes": "string",
  "created_at": Date,
  "updated_at": Date
}
```

#### 3. WebsiteProperty (website_properties collection)
```json
{
  "_id": ObjectId,
  "property_id": "string",
  "property_type": "string",
  "property_name": "string",
  "city": "string",
  "locality": "string",
  "address": "string",
  "pincode": "string",
  "description": "string",
  "amenities": ["string"],
  "gender_suitability": "string",
  "rent": number,
  "deposit": "string",
  "owner_name": "string",
  "owner_email": "string",
  "owner_phone": "string",
  "photos": ["base64_strings"],
  "status": "active|inactive",
  "created_at": Date,
  "updated_at": Date
}
```

---

## API Endpoints Required

### Visit Management (Backend)
```
POST   /api/visits/submit              - Submit a visit (DONE)
GET    /api/visits/all                  - Get all visits
GET    /api/visits/:id                  - Get visit by ID
PUT    /api/visits/:id                  - Update visit status/approval
GET    /api/visits/public/approved      - Get approved visits (for display)
```

### Enquiry Management (Backend)
```
POST   /api/website-enquiries/submit    - Submit new enquiry
GET    /api/website-enquiries/all       - Get all enquiries
GET    /api/website-enquiries/:id       - Get enquiry by ID
PUT    /api/website-enquiries/:id       - Update enquiry (approval, status)
GET    /api/website-enquiries/by-status/:status - Get by status
```

### Website Properties (Backend)
```
POST   /api/website-properties/add      - Add new property
GET    /api/website-properties/all      - Get all properties
GET    /api/website-properties/:id      - Get property by ID
PUT    /api/website-properties/:id      - Update property
DELETE /api/website-properties/:id      - Delete property
```

---

## Frontend Implementation

### 1. visit.html - STORE & DISPLAY
**Location:** `website/visit.html`

**Features:**
- ✅ Submit property visits to MongoDB
- ✅ Display all submitted visits in card format
- ✅ View visit details
- ✅ Filter by status

**API Calls:**
```javascript
// Store visit
POST /api/visits/submit
Body: { visitorName, visitorEmail, propertyName, city, ... }

// Fetch visits
GET /api/visits/all
Response: { success: true, visits: [...] }

// Display visits with photos and status badges
```

---

### 2. enquiry.html - FETCH, APPROVE & STORE
**Location:** `website/enquiry.html`

**Workflow:**
1. ✅ Fetch pending enquiries from MongoDB
2. ✅ Display enquiry cards by status
3. ✅ Open approval modal with notes & assignment fields
4. ✅ Submit approval - UPDATE enquiry status in MongoDB
5. ✅ Track approval data (assigned_to, assigned_area, assigned_date, notes)
6. ✅ Show approved enquiries in separate tab

**API Calls:**
```javascript
// Fetch all enquiries
GET /api/website-enquiries/all

// Get by status (pending, assigned, accepted, completed, rejected)
GET /api/website-enquiries/by-status/:status

// Update/Approve enquiry
PUT /api/website-enquiries/:id
Body: {
  status: "assigned|approved|rejected",
  notes: "approval notes",
  assigned_to: "manager name",
  assigned_area: "area name",
  assigned_date: new Date()
}
```

---

### 3. website.html - FETCH & STORE
**Location:** `website/website.html`

**Features:**
- ✅ Fetch all properties from MongoDB
- ✅ Display in filterable grid
- ✅ Show statistics (total, filtered, average rent, unique cities)
- ✅ Submit new property modal
- ✅ Store new properties in MongoDB

**API Calls:**
```javascript
// Fetch all properties
GET /api/website-properties/all

// Add new property
POST /api/website-properties/add
Body: { property_type, property_name, city, rent, owner_name, ... }

// Apply filters client-side
filter by: city, type, rent range
```

---

### 4. ourproperty.html - FETCH & DISPLAY
**Location:** `website/ourproperty.html`

**Features:**
- ✅ Fetch approved properties from `/api/visits/public/approved`
- ✅ Display with filters (city, area, price, gender, type)
- ✅ Dynamic area population based on selected city
- ✅ Search functionality
- ✅ Bid on properties

**Current Implementation:**
```javascript
// Fetches from MongoDB (already implemented)
GET /api/visits/public/approved
Filters: city, area, gender, propertyType, minPrice, maxPrice
```

---

## Backend Route Implementation (Required Updates)

### Routes to Create/Update:

#### 1. `roomhy-backend/routes/websiteEnquiryRoutes.js` - UPDATE
```javascript
// GET by status
router.get('/by-status/:status', async (req, res) => {
    const { status } = req.params;
    const enquiries = await WebsiteEnquiry.find({ status }).sort({ created_at: -1 });
    res.json({ success: true, enquiries });
});

// GET single
router.get('/:id', async (req, res) => {
    const enquiry = await WebsiteEnquiry.findById(req.params.id);
    res.json({ success: true, enquiry });
});

// PUT update/approve
router.put('/:id', async (req, res) => {
    const { status, notes, assigned_to, assigned_area, assigned_date } = req.body;
    const enquiry = await WebsiteEnquiry.findByIdAndUpdate(
        req.params.id,
        { status, notes, assigned_to, assigned_area, assigned_date, updated_at: new Date() },
        { new: true }
    );
    res.json({ success: true, enquiry });
});
```

#### 2. `roomhy-backend/routes/websitePropertyRoutes.js` - CREATE
```javascript
const express = require('express');
const router = express.Router();
const WebsiteProperty = require('../models/WebsiteProperty');

// GET all properties
router.get('/all', async (req, res) => {
    try {
        const properties = await WebsiteProperty.find().sort({ created_at: -1 });
        res.json({ success: true, properties });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET single property
router.get('/:id', async (req, res) => {
    try {
        const property = await WebsiteProperty.findById(req.params.id);
        res.json({ success: true, property });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ADD new property
router.post('/add', async (req, res) => {
    try {
        const property = new WebsiteProperty({
            property_id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            ...req.body,
            created_at: new Date(),
            updated_at: new Date()
        });
        await property.save();
        res.status(201).json({ success: true, property });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// UPDATE property
router.put('/:id', async (req, res) => {
    try {
        const property = await WebsiteProperty.findByIdAndUpdate(
            req.params.id,
            { ...req.body, updated_at: new Date() },
            { new: true }
        );
        res.json({ success: true, property });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// DELETE property
router.delete('/:id', async (req, res) => {
    try {
        await WebsiteProperty.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Property deleted' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
```

#### 3. `roomhy-backend/routes/visitDataRoutes.js` - UPDATE
```javascript
// Add this endpoint
router.get('/public/approved', async (req, res) => {
    try {
        const { city, area, gender, propertyType, minPrice, maxPrice, search } = req.query;
        let filters = { status: 'approved' };
        
        if (city) filters.city = new RegExp(city, 'i');
        if (area) filters.area = new RegExp(area, 'i');
        if (gender) filters.genderSuitability = gender;
        if (propertyType) filters.propertyType = propertyType;
        if (minPrice) filters.monthlyRent = { $gte: parseInt(minPrice) };
        if (maxPrice) filters.monthlyRent = { $lte: parseInt(maxPrice) };
        
        const visits = await VisitData.find(filters).sort({ createdAt: -1 });
        res.json({ success: true, visits });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
```

---

## Server.js Registration (Backend)

Add these routes to your `roomhy-backend/server.js`:

```javascript
// Add after existing routes
app.use('/api/website-enquiries', require('./routes/websiteEnquiryRoutes'));
app.use('/api/website-properties', require('./routes/websitePropertyRoutes'));

// Register the GET route for visits
```

---

## Testing Workflow

### 1. Test Visit Storage (visit.html)
```
1. Go to http://localhost:3000/website/visit.html
2. Fill form with sample data
3. Upload photos (optional)
4. Submit
5. Check MongoDB: Should see new document in VisitData collection
6. Click "View Submitted Visits" to see display
```

### 2. Test Enquiry Approval (enquiry.html)
```
1. Go to http://localhost:3000/website/enquiry.html
2. View pending enquiries
3. Click Approve on any enquiry
4. Fill approval modal:
   - Add approval notes
   - Assign to area manager (optional)
   - Assign area (optional)
5. Click Approve
6. Check MongoDB: Status should change to "assigned"
7. View in "Approved" tab
```

### 3. Test Website Properties (website.html)
```
1. Go to http://localhost:3000/website/website.html
2. Browse existing properties
3. Apply filters (city, type, rent range)
4. Click "+ Submit Property"
5. Fill form and submit
6. Check MongoDB: New document in WebsiteProperty
7. Verify it appears in properties list
```

### 4. Test Display (ourproperty.html)
```
1. Go to http://localhost:3000/website/ourproperty.html
2. Select city from filter dropdown
3. View properties fetched from MongoDB
4. Apply filters and verify filtering works
5. Search for properties by name/location
```

---

## MongoDB Atlas Setup Checklist

- [ ] Create MongoDB Atlas cluster
- [ ] Create database: `roomhy_db`
- [ ] Collections created:
  - [ ] VisitData
  - [ ] WebsiteEnquiry
  - [ ] WebsiteProperty
- [ ] Connection string in `.env`
- [ ] MONGO_URI=`mongodb+srv://user:password@cluster.mongodb.net/roomhy_db?retryWrites=true&w=majority`
- [ ] Test connection: `npm run dev` or `npm start`

---

## Common Issues & Solutions

### Issue 1: API Returns 404
**Solution:** Ensure routes are registered in `server.js` and route paths match frontend calls

### Issue 2: CORS Errors
**Solution:** Ensure CORS is enabled in `server.js`:
```javascript
app.use(cors());
```

### Issue 3: Photos Not Showing
**Solution:** Verify photos are stored as base64 and endpoints return them correctly

### Issue 4: Filters Not Working
**Solution:** Check MongoDB query filters and ensure field names match collection schema

---

## Data Flow Diagram

```
visit.html ──→ POST /api/visits/submit ──→ MongoDB VisitData ──→ GET /api/visits/all ──→ Display Cards

enquiry.html ──→ GET /api/website-enquiries/all ──→ Display by Status ──→ PUT /api/website-enquiries/:id (Approve) ──→ MongoDB (Updated)

website.html ──→ POST /api/website-properties/add ──→ MongoDB WebsiteProperty
                GET /api/website-properties/all ──→ Display & Filter

ourproperty.html ──→ GET /api/visits/public/approved ──→ Display Filtered Properties
```

---

## Next Steps

1. ✅ Update backend routes (websiteEnquiryRoutes.js with approval endpoints)
2. ✅ Create websitePropertyRoutes.js file
3. ✅ Register routes in server.js
4. ✅ Test each HTML file with actual MongoDB data
5. ✅ Deploy to production with MongoDB Atlas

---

## Support

For issues or questions:
- Check browser console for errors (F12)
- Check server logs: `npm run dev`
- Verify MongoDB connection in .env
- Ensure all required fields are being sent in requests
