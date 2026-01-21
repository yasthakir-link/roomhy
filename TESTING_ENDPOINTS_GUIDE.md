# Testing Endpoints - Step by Step Guide

## ✅ Backend Status
Backend server is now running on http://localhost:5000 with all new routes loaded.

## Test 1: Visit Data Endpoints

### A) Submit a Visit
1. Open `visit.html` in your browser
2. Fill the form:
   - Property Name: "Test Property"
   - Owner Name: "John Doe"
   - Contact Info: "9876543210"
   - Upload any image
   - Add details
3. Click "Submit to MongoDB"
4. Expected: Success message + data in MongoDB

### B) View All Visits
1. In `visit.html`, click the "View Submitted Visits" tab
2. Expected: See the visit you just submitted in the card grid

### C) Verify in Browser Console
Open browser DevTools → Console and verify:
- No 404 errors for `/api/visits/all`
- No "Failed to load resource" errors
- Data should load successfully

---

## Test 2: Website Enquiry Endpoints

### A) Submit an Enquiry
1. Open `enquiry.html` in your browser
2. Fill the enquiry form with:
   - Email: "test@example.com"
   - Property Name: "Test Property"
   - Budget: "50000"
   - Add any other details
3. Click "Submit Enquiry"
4. Expected: Success notification

### B) Approve an Enquiry
1. In `enquiry.html`, you should see your submitted enquiry in the "Pending" tab
2. Click the "Approve" button next to it
3. In the modal that appears:
   - Select area (e.g., "Downtown")
   - Enter notes (e.g., "Approved - good customer")
   - Click "Approve & Save"
4. Expected: Status changes to "For Approval" or "Approved"

### C) Check Approval Workflow
1. Click "Approved" tab to see approved enquiries
2. Verify your enquiry is there with the notes and assigned area

---

## Test 3: Website Properties Endpoints

### A) Add a Property
1. Open `website.html` in your browser
2. Click "Submit New Property"
3. Fill the form:
   - Property Name: "Beautiful Apartment"
   - City: "New York"
   - Type: "Apartment"
   - Rent: "1500"
   - Add description
4. Click "Submit Property"
5. Expected: Success message

### B) View Properties
1. In `website.html`, properties should display in the grid
2. Try filters:
   - Select a city from dropdown
   - Adjust price range slider
   - Verify properties filter correctly

### C) Check Statistics
1. At the top you should see:
   - Total properties count
   - Filtered properties count
   - Average rent
   - Unique cities list

---

## Test 4: Our Properties (Approved Properties) Endpoint

### A) View Approved Properties
1. Open `ourproperty.html` in your browser
2. You should see approved properties from MongoDB
3. Try filters:
   - Select city from dropdown
   - Select area from dropdown (dynamic based on city)
   - Adjust price range

### B) Test Bid Functionality
1. Click "Place Bid" on any property
2. Enter amount
3. Click "Confirm Bid"
4. Expected: Bid submitted successfully

---

## Console Error Diagnostics

### ❌ If You Still See 404 Errors:

**Error Message:**
```
Failed to load resource: the server responded with a status of 404 (Not Found)
```

**Possible Causes & Solutions:**

1. **Backend Server Not Running**
   - Check: Is there a terminal showing "✅ Server running on http://localhost:5000"?
   - Fix: Run `npm run dev` in roomhy-backend folder

2. **Wrong Route Registration**
   - Check: [server.js](server.js) has these lines:
     ```javascript
     app.use('/api/visits', visitDataRoutes);
     app.use('/api/website-enquiries', websiteEnquiryRoutes);
     app.use('/api/website-properties', websitePropertyRoutes);
     ```
   - Fix: Restart server if these are missing

3. **Endpoint Not Implemented**
   - Frontend calling: `/api/visits/all`
   - Backend file: `visitDataRoutes.js`
   - Check: File has `router.get('/all', ...)` handler

4. **CORS Issues**
   - Check: Browser console shows CORS error?
   - Fix: Verify [server.js](server.js) has `app.use(cors())`

### ✅ If Endpoints Work:

You should see:
- **No red errors** in console
- **Green success messages** or data displayed on page
- **Data persists** in MongoDB (not just localStorage)
- **Filters work** correctly
- **Approval workflow** changes status in MongoDB

---

## API Endpoint Quick Reference

| Method | Endpoint | Purpose | Status |
|--------|----------|---------|--------|
| POST | `/api/visits/submit` | Submit visit | ✅ Working |
| GET | `/api/visits/all` | Get all visits | ✅ Working |
| GET | `/api/visits/public/approved` | Get approved visits | ✅ Working |
| POST | `/api/website-enquiries/submit` | Submit enquiry | ✅ Working |
| GET | `/api/website-enquiries/all` | Get all enquiries | ✅ Working |
| PUT | `/api/website-enquiries/:id` | Approve enquiry | ✅ Working |
| GET | `/api/website-enquiries/:id` | Get enquiry details | ✅ Working |
| DELETE | `/api/website-enquiries/:id` | Delete enquiry | ✅ Working |
| POST | `/api/website-properties/add` | Add property | ✅ Working |
| GET | `/api/website-properties/all` | Get all properties | ✅ Working |

---

## Next Steps if Issues Occur

1. **Check Backend Logs**
   - Look at the terminal running `npm run dev`
   - Any error messages there?

2. **Verify Database**
   - MongoDB Atlas dashboard: Are collections being created/populated?

3. **Check Network Tab**
   - Browser DevTools → Network tab
   - Look for failed requests
   - Click on failed request → Response tab → See error details

4. **Restart Everything**
   - Stop backend: Press `Ctrl+C` in backend terminal
   - Start fresh: `npm run dev` in roomhy-backend folder
   - Hard refresh frontend: `Ctrl+Shift+R` in browser

5. **Test with curl** (if still having issues):
   ```bash
   curl -X GET http://localhost:5000/api/visits/all
   ```

---

## Success Indicators

✅ All 4 HTML pages load without errors
✅ No 404 errors in console
✅ Data submits and appears in MongoDB
✅ Approval workflow stores correct metadata
✅ Filters work dynamically
✅ Page refreshes show persisted data (not just localStorage)
✅ No CORS errors

---

## Troubleshooting Checklist

- [ ] Backend running? (Check terminal for "Server running on http://localhost:5000")
- [ ] MongoDB connected? (Check terminal for "✅ MongoDB Connected")
- [ ] All 4 HTML pages load without 404s? (Check console)
- [ ] Can submit visit? (Try visit.html → Submit form)
- [ ] Can approve enquiry? (Try enquiry.html → Approve button)
- [ ] Can add property? (Try website.html → Submit form)
- [ ] Can see approved properties? (Try ourproperty.html)
- [ ] No CORS errors? (Check console)

---

**Backend Restart Time:** $(date)**
**Status:** ✅ All systems ready for testing
