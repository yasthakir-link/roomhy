# Quick Start - MongoDB Integration for Property Management

## Files Modified/Created

### HTML Files Updated
- ✅ **visit.html** - Submit & Display visits from MongoDB
- ✅ **enquiry.html** - Fetch, Approve & Store enquiry data 
- ✅ **website.html** - Fetch & Store properties with filters
- ✅ **ourproperty.html** - Display fetched properties (already working)

### Backend Routes
- ✅ `websitePropertyRoutes.js` - Property CRUD operations
- ✅ `websiteEnquiryRoutes.js` - Enhanced with approval workflow
- Update `visitDataRoutes.js` - Add public approved endpoint
- Update `server.js` - Register new routes

---

## Data Flow Summary

### 1. visit.html Flow
```
User fills form → POST /api/visits/submit → Store in MongoDB
View button → GET /api/visits/all → Display cards with status badges
```

**Stored Fields:** visitId, visitorName, propertyName, city, photos, status, approvedAt

---

### 2. enquiry.html Flow  
```
Load page → GET /api/website-enquiries/all → Show pending enquiries
Click Approve → Open modal with notes & assignment fields
Submit → PUT /api/website-enquiries/:id → Update status to "assigned"
View Approved → GET /api/website-enquiries/by-status/assigned → Display approved
```

**Stored Fields:** enquiry_id, property_name, status, assigned_to, assigned_area, notes, assigned_date

---

### 3. website.html Flow
```
Load page → GET /api/website-properties/all → Fetch and display
Apply filters → Client-side filtering by city, type, rent
Click Submit Property → POST /api/website-properties/add → Store new property
```

**Stored Fields:** property_id, property_name, city, rent, owner_name, photos, status

---

### 4. ourproperty.html Flow
```
Load page → GET /api/visits/public/approved → Fetch approved properties
User selects city → Populate areas → Filter properties
Display cards with professional photos & bid button
```

---

## Testing Checklist

### Step 1: Verify Backend Routes
```bash
# Start backend server
cd roomhy-backend
npm run dev

# Check terminal for:
# ✅ MongoDB Connected
# ✅ Express server running on port 5000
```

### Step 2: Test visit.html
```
1. Navigate to http://localhost:3000/website/visit.html
2. Fill all required fields
3. Upload sample photos
4. Click "Submit Visit"
5. Verify success message
6. Click "View Submitted Visits" tab
7. Confirm your visit appears in the list with correct status
```

**Expected MongoDB Document:**
```json
{
  "_id": "ObjectId",
  "visitId": "timestamp_random",
  "visitorName": "John",
  "propertyName": "Sunset Apartment",
  "city": "Bangalore",
  "status": "submitted",
  "photos": ["base64_encoded_photo"],
  "createdAt": "2025-01-21T12:00:00Z"
}
```

### Step 3: Test enquiry.html
```
1. Navigate to http://localhost:3000/website/enquiry.html
2. You should see "Pending Enquiries" loaded from MongoDB
3. Click "Approve" on any enquiry
4. Fill the approval modal:
   - Add notes: "Verified property condition"
   - Assign to: "Raj Kumar"
   - Assign area: "Whitefield"
5. Click "Approve" button
6. Verify success message
7. Switch to "Approved" tab
8. Confirm enquiry moved to approved list
9. Check MongoDB: status changed to "assigned"
```

**Expected MongoDB Update:**
```json
{
  "status": "assigned",
  "assigned_to": "Raj Kumar",
  "assigned_area": "Whitefield",
  "assigned_date": "2025-01-21T12:05:00Z",
  "notes": "Verified property condition"
}
```

### Step 4: Test website.html
```
1. Navigate to http://localhost:3000/website/website.html
2. You should see property cards displaying
3. Apply filters:
   - Select city
   - Adjust price range
   - See results update
4. Click "+ Submit Property" button
5. Fill form:
   - Property Name: "Modern Studio"
   - City: "Bangalore"
   - Type: "Apartment"
   - Rent: 25000
   - Owner Name: "Alice"
   - Owner Phone: "9876543210"
6. Click "Submit Property"
7. Verify success message
8. Confirm new property appears in list
```

**Expected MongoDB Document:**
```json
{
  "_id": "ObjectId",
  "property_id": "timestamp_random",
  "property_name": "Modern Studio",
  "city": "Bangalore",
  "rent": 25000,
  "owner_name": "Alice",
  "status": "active",
  "created_at": "2025-01-21T12:10:00Z"
}
```

### Step 5: Test ourproperty.html
```
1. Navigate to http://localhost:3000/website/ourproperty.html
2. Filter section should load
3. Select a city from dropdown
4. Properties should load from MongoDB
5. Try:
   - Filter by area
   - Filter by price range
   - Filter by property type
   - Search by name
6. Verify properties display with photos
7. Click "Bid Now" to see functionality
```

---

## Backend Checklist - What Needs To Be Done

### ✅ Files Already Complete
- [x] websitePropertyRoutes.js - Create/Read/Update/Delete properties
- [x] websiteEnquiryRoutes.js - Basic submit/fetch (needs approval endpoints)
- [x] Website properties model exists

### 📋 Still TODO in Backend

#### 1. Update `websiteEnquiryRoutes.js` - Add these endpoints
```javascript
// GET by status (line should be added)
router.get('/by-status/:status', async (req, res) => {
    // Return enquiries filtered by status
});

// PUT update/approve (line should be added)
router.put('/:id', async (req, res) => {
    // Update status, assigned_to, notes, etc.
});
```

#### 2. Update `visitDataRoutes.js` - Add this endpoint
```javascript
// GET public approved visits
router.get('/public/approved', async (req, res) => {
    // Return approved visits with filters
});
```

#### 3. Update `server.js` - Register routes
```javascript
app.use('/api/website-properties', require('./routes/websitePropertyRoutes'));
app.use('/api/website-enquiries', require('./routes/websiteEnquiryRoutes'));
```

---

## Environment Setup

### .env File (Already Should Have)
```
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/roomhy_db?retryWrites=true&w=majority
PORT=5000
NODE_ENV=development
```

### Verify Connection
```bash
# In backend folder
npm run dev

# Should see:
# ✅ MongoDB Connected
```

---

## Troubleshooting

### Issue: "Cannot GET /api/visits/all"
**Solution:** 
- Check route is registered in server.js
- Restart backend server

### Issue: "Failed to fetch from API"
**Solution:**
- Check backend server is running on port 5000
- Check browser console for CORS errors
- Verify API_BASE_URL in HTML matches backend

### Issue: "No properties displayed"
**Solution:**
- Check MongoDB has data in collections
- Verify fetch request in browser DevTools Network tab
- Check backend console for errors

### Issue: "Photos not showing"
**Solution:**
- Verify photos saved as base64 in MongoDB
- Check WebsiteProperty model includes photos field
- Verify frontend sends photos in request

### Issue: "Approval status not updating"
**Solution:**
- Verify PUT endpoint is registered
- Check request body in browser Network tab
- Verify MongoDB document structure includes status field

---

## Quick Commands

```bash
# Start backend
cd roomhy-backend && npm run dev

# Check MongoDB connection
# Look for "✅ MongoDB Connected" message

# Clear cache if needed
# Ctrl+Shift+Delete in browser or Cmd+Shift+Delete on Mac

# Test API directly
curl http://localhost:5000/api/visits/all
curl http://localhost:5000/api/website-enquiries/all
curl http://localhost:5000/api/website-properties/all
```

---

## Collection Verification

Check MongoDB Atlas dashboard:

```
Database: roomhy_db
├── VisitData (visits collection)
│   ├── visitId (indexed)
│   ├── visitorName
│   ├── propertyName
│   ├── city
│   ├── status: "submitted|approved|rejected"
│   └── createdAt
│
├── WebsiteEnquiry (website_enquiries collection)  
│   ├── enquiry_id (indexed)
│   ├── property_name
│   ├── status: "pending|assigned|accepted|completed|rejected"
│   ├── assigned_to
│   ├── assigned_area
│   └── notes
│
└── WebsiteProperty (website_properties collection)
    ├── property_id (indexed)
    ├── property_name
    ├── city
    ├── rent
    ├── owner_name
    └── status: "active|inactive"
```

---

## Success Indicators

✅ **visit.html** 
- Form submits without error
- Data appears in MongoDB
- "View Submitted Visits" displays cards
- Status badges show correctly

✅ **enquiry.html**
- Loads pending enquiries from MongoDB
- Approval modal opens with correct fields
- Approve button updates MongoDB
- Enquiries move between tabs based on status

✅ **website.html**
- Properties display in grid
- Filters work (city, price, type)
- Submit modal saves to MongoDB
- New properties appear in list immediately

✅ **ourproperty.html**
- Displays approved/live properties
- City filter populates correctly
- Area filter shows available areas
- Search functionality works
- Bid button is clickable

---

## Next Steps

1. **Complete Backend Routes** - Add missing PUT/GET endpoints
2. **Test Each Page** - Follow testing checklist above
3. **Monitor Logs** - Check browser console and backend logs for errors
4. **Deploy** - Once testing passes, deploy to production with MongoDB Atlas

---

## Support

If you encounter any issues:
1. Check browser console (F12 > Console)
2. Check backend terminal for errors
3. Verify MongoDB collections in Atlas dashboard
4. Check that all routes are registered in server.js
5. Ensure MONGO_URI is correct in .env
