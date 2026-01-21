# Backend Updates Required - Copy/Paste Code

## File 1: Update websiteEnquiryRoutes.js

Add these endpoints to the existing file:

```javascript
// Add after existing router.post('/submit', ...) endpoint

// ============================================================
// GET: Fetch all website enquiries
// ============================================================
router.get('/all', async (req, res) => {
    try {
        const enquiries = await WebsiteEnquiry.find().sort({ created_at: -1 });

        res.status(200).json({
            success: true,
            count: enquiries.length,
            enquiries: enquiries
        });

    } catch (error) {
        console.error('Error fetching enquiries:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching enquiries',
            error: error.message
        });
    }
});

// ============================================================
// GET: Fetch enquiry by status
// ============================================================
router.get('/by-status/:status', async (req, res) => {
    try {
        const { status } = req.params;
        const enquiries = await WebsiteEnquiry.find({ status }).sort({ created_at: -1 });

        res.status(200).json({
            success: true,
            count: enquiries.length,
            enquiries: enquiries
        });

    } catch (error) {
        console.error('Error fetching enquiries by status:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching enquiries',
            error: error.message
        });
    }
});

// ============================================================
// GET: Fetch single enquiry by ID
// ============================================================
router.get('/:id', async (req, res) => {
    try {
        const enquiry = await WebsiteEnquiry.findById(req.params.id);

        if (!enquiry) {
            return res.status(404).json({
                success: false,
                message: 'Enquiry not found'
            });
        }

        res.status(200).json({
            success: true,
            enquiry: enquiry
        });

    } catch (error) {
        console.error('Error fetching enquiry:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching enquiry',
            error: error.message
        });
    }
});

// ============================================================
// PUT: Update/Approve enquiry
// ============================================================
router.put('/:id', async (req, res) => {
    try {
        const {
            status,
            notes,
            assigned_to,
            assigned_area,
            assigned_date
        } = req.body;

        const updateData = {
            status,
            notes,
            assigned_to: assigned_to || null,
            assigned_area: assigned_area || null,
            assigned_date: assigned_date || null,
            updated_at: new Date()
        };

        const enquiry = await WebsiteEnquiry.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true }
        );

        if (!enquiry) {
            return res.status(404).json({
                success: false,
                message: 'Enquiry not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Enquiry updated successfully',
            enquiry: enquiry
        });

    } catch (error) {
        console.error('Error updating enquiry:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating enquiry',
            error: error.message
        });
    }
});

// ============================================================
// DELETE: Delete enquiry
// ============================================================
router.delete('/:id', async (req, res) => {
    try {
        const enquiry = await WebsiteEnquiry.findByIdAndDelete(req.params.id);

        if (!enquiry) {
            return res.status(404).json({
                success: false,
                message: 'Enquiry not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Enquiry deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting enquiry:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting enquiry',
            error: error.message
        });
    }
});
```

---

## File 2: Update visitDataRoutes.js

Add this endpoint to existing file (around line 200 after other endpoints):

```javascript
// ============================================================
// GET: Fetch approved public visits for website display
// ============================================================
router.get('/public/approved', async (req, res) => {
    try {
        const {
            city,
            area,
            gender,
            propertyType,
            minPrice,
            maxPrice,
            search
        } = req.query;

        // Build filter object
        let filters = { status: 'approved' };

        // Add city filter
        if (city) {
            filters.city = new RegExp(city, 'i');
        }

        // Add area filter
        if (area) {
            filters.area = new RegExp(area, 'i');
        }

        // Add gender filter
        if (gender) {
            filters.genderSuitability = gender;
        }

        // Add property type filter
        if (propertyType) {
            filters.propertyType = new RegExp(propertyType, 'i');
        }

        // Add rent range filters
        if (minPrice || maxPrice) {
            filters.monthlyRent = {};
            if (minPrice) {
                filters.monthlyRent.$gte = parseInt(minPrice);
            }
            if (maxPrice) {
                filters.monthlyRent.$lte = parseInt(maxPrice);
            }
        }

        // Add search filter
        if (search) {
            filters.$or = [
                { propertyName: new RegExp(search, 'i') },
                { description: new RegExp(search, 'i') },
                { area: new RegExp(search, 'i') },
                { address: new RegExp(search, 'i') }
            ];
        }

        // Fetch properties
        const visits = await VisitData.find(filters)
            .sort({ createdAt: -1 })
            .limit(1000);

        res.status(200).json({
            success: true,
            count: visits.length,
            visits: visits,
            properties: visits  // Also return as 'properties' for compatibility
        });

    } catch (error) {
        console.error('Error fetching approved visits:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching approved visits',
            error: error.message
        });
    }
});
```

---

## File 3: Update server.js

Find the line with existing routes registration (around line 48-60):

```javascript
// Routes (API Endpoints)
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/properties', require('./routes/propertyRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/tenants', require('./routes/tenantRoutes'));
app.use('/api/visits', require('./routes/visitDataRoutes'));
app.use('/api/rooms', require('./routes/roomRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/owners', require('./routes/ownerRoutes'));
```

**Add these two lines after the existing routes:**

```javascript
app.use('/api/website-enquiries', require('./routes/websiteEnquiryRoutes'));
app.use('/api/website-properties', require('./routes/websitePropertyRoutes'));
```

**Complete example:**

```javascript
// Routes (API Endpoints)
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/properties', require('./routes/propertyRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/tenants', require('./routes/tenantRoutes'));
app.use('/api/visits', require('./routes/visitDataRoutes'));
app.use('/api/rooms', require('./routes/roomRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/owners', require('./routes/ownerRoutes'));

// NEW: Website enquiry and property routes
app.use('/api/website-enquiries', require('./routes/websiteEnquiryRoutes'));
app.use('/api/website-properties', require('./routes/websitePropertyRoutes'));
```

---

## Summary of Changes

### websiteEnquiryRoutes.js
- ✅ GET /all - Fetch all enquiries
- ✅ GET /by-status/:status - Fetch by status
- ✅ GET /:id - Get single enquiry
- ✅ PUT /:id - Update/approve enquiry
- ✅ DELETE /:id - Delete enquiry

### visitDataRoutes.js
- ✅ GET /public/approved - Fetch approved visits for display (NEW)

### server.js
- ✅ Register /api/website-enquiries route
- ✅ Register /api/website-properties route

### Files Already Complete
- ✅ websitePropertyRoutes.js - No changes needed
- ✅ visit.html - Complete with display
- ✅ enquiry.html - Complete with approval workflow
- ✅ website.html - Complete with submit and display
- ✅ ourproperty.html - Already working with existing routes

---

## Testing After Updates

```bash
# 1. Stop backend if running (Ctrl+C)

# 2. Apply the code changes above to the three files

# 3. Restart backend
npm run dev

# 4. Should see:
# ✅ MongoDB Connected
# ✅ Express server running on port 5000

# 5. Test endpoints with curl or browser
curl http://localhost:5000/api/visits/public/approved
curl http://localhost:5000/api/website-enquiries/all
curl http://localhost:5000/api/website-properties/all

# 6. Each should return: { success: true, ... }
```

---

## Priority Order of Updates

1. **FIRST:** Update `server.js` - Register the routes
2. **SECOND:** Update `websiteEnquiryRoutes.js` - Add endpoints
3. **THIRD:** Update `visitDataRoutes.js` - Add public approved endpoint
4. **FOURTH:** Restart backend and test

---

## Verification Checklist

After applying updates:

- [ ] Backend restarts without errors
- [ ] MongoDB connected message appears
- [ ] curl localhost:5000/api/website-enquiries/all returns data
- [ ] curl localhost:5000/api/website-properties/all returns data
- [ ] curl localhost:5000/api/visits/public/approved returns data
- [ ] visit.html displays submitted visits
- [ ] enquiry.html shows pending enquiries
- [ ] website.html displays properties
- [ ] ourproperty.html displays approved properties

---

## API Base URL in Frontend

Make sure HTML files use correct API base URL:

```javascript
const API_BASE_URL = 'http://localhost:5000/api/visits';
const API_URL = 'http://localhost:5000';
```

These are already set in the HTML files provided.
