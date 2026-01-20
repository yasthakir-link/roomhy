# VISIT DATA SYNC - QUICK ACTION GUIDE

## Status: ✅ READY TO TEST

Your backend is now running at: `http://localhost:5000`

---

## How to Test the Data Sync

### **Step 1: Open Developer Console**
1. Go to any website page (e.g., Areamanager/visit.html)
2. Press `F12` to open DevTools
3. Click the "Console" tab
4. Keep this open while testing

### **Step 2: Submit a Test Visit**
1. Open `Areamanager/visit.html` in your browser
2. Fill in the visit form with test data
3. Click "Submit Report" button
4. **Look at Console** - you should see:
   ```
   📋 Form submission started. Mode: create
   📝 New visit created: v_TIMESTAMP
   💾 Attempting to save visit to backend...
   ✅ Visit saved to backend database
   ```

### **Step 3: Check Superadmin Enquiry**
1. Open `superadmin/enquiry.html` in the browser
2. Press F12 again to check console
3. Click the **"Refresh"** button (top right)
4. **Look at Console** - you should see:
   ```
   🔄 fetchEnquiries() called
   🔗 Fetching from API: http://localhost:5000/api/visits/pending
   📡 API response: { success: true, visits: [ ... ] }
   ✅ Loaded from API: 1 visits
   ? Filtered to pending/submitted: 1 visits
   ```

### **Step 4: Verify Data Displayed**
- Check if your submitted visit appears in the enquiry.html table
- If it shows, **SUCCESS!** ✅
- If not, check the console for error messages

---

## What Each Console Log Means

### ✅ Good Logs (Expected)
```
✅ Visit saved to backend database
✅ Loaded from API: 5 visits
✓ Filtered to pending/submitted: 5 visits
📋 Rendering 5 visits to table
```

### ⚠️ Warning Logs (Check These)
```
⚠️ No pending visits found
⚠️ Backend save failed: 500
⚠️ Could not save to backend
⏭️ Skipping visit (non-pending status)
```

### ❌ Error Logs (Must Fix)
```
❌ Submit Visit Error
❌ Pending Visits Error
❌ Failed saving visits
❌ Table body element not found
```

---

## If Data is NOT Showing

### **Check 1: Console Errors**
1. Look for RED error messages in console
2. Copy the error text
3. Check troubleshooting guide for that error

### **Check 2: Network Tab**
1. Click "Network" tab in DevTools
2. In enquiry.html, click "Refresh"
3. Look for request to `/api/visits/pending`
4. Check response status:
   - ✅ 200 = Good
   - ❌ 404 = Endpoint not found
   - ❌ 500 = Server error

### **Check 3: Browser Storage**
1. Click "Storage" or "Application" tab in DevTools
2. Click "LocalStorage" → select your site
3. Look for key: `roomhy_visits`
4. Should show your submitted visit data

### **Check 4: Backend Console**
1. Look at terminal where you ran `npm start`
2. Should show logs like:
   ```
   📝 [submitVisit] Received visit data
   ✅ [submitVisit] Visit created successfully
   🔍 [getPendingVisits] Found 1 submitted visits
   ```
3. If showing errors here, data isn't reaching backend

---

## Quick Fixes

### Fix 1: Refresh Everything
```
1. Stop backend: Ctrl+C in terminal
2. Wait 2 seconds
3. Restart: npm start
4. Refresh browser page
5. Try again
```

### Fix 2: Clear Browser Storage
```
1. Press F12
2. Storage tab → LocalStorage → Clear All
3. Restart pages
4. Try submitting again
```

### Fix 3: Check API URL
In enquiry.html or visit.html, first line should show:
```
✅ API_URL: http://localhost:5000
```
If different, check the API_URL configuration.

---

## Expected Behavior

### ✅ Success Scenario
1. Area Manager submits visit from visit.html
2. Visit appears in localStorage (backup)
3. Visit syncs to backend MongoDB (primary)
4. Super Admin opens enquiry.html
5. Click "Refresh"
6. Visit appears in table immediately

### Data Flow
```
visit.html (submit)
    ↓
localStorage saved ✅
    ↓
POST /api/visits/submit ✅
    ↓
MongoDB VisitReport collection ✅
    ↓
enquiry.html (fetch)
    ↓
GET /api/visits/pending ✅
    ↓
Table displays data ✅
```

---

## Important Notes

- **Backend must be running** for sync to work
- **port 5000** must be free
- **MongoDB** must be connected (check backend console)
- **Status** must be 'submitted' (automatically set)
- **Fallback**: Data shows from localStorage even if API fails

---

## Next Steps if Problem Found

1. **Check all console logs** - both visit.html and enquiry.html
2. **Check Network tab** - ensure API call gets 200 response
3. **Check backend terminal** - should show request logs
4. **Check MongoDB** - verify data exists with status: 'submitted'
5. **Read VISIT_ENQUIRY_SYNC_GUIDE.md** - comprehensive troubleshooting

---

## Success Indicators

✅ Console shows no RED errors  
✅ Network shows `/api/visits/pending` returns 200  
✅ Backend console shows visit created & retrieved logs  
✅ Data appears in enquiry.html table immediately  
✅ Can see visit details in browser  

---

## Testing Checklist

- [ ] Backend running (shows "Server running on port 5000")
- [ ] MongoDB connected (shows "MongoDB Connected")
- [ ] Submitted a test visit from visit.html
- [ ] Console shows "✅ Visit saved to backend database"
- [ ] Opened enquiry.html
- [ ] Clicked "Refresh" button
- [ ] New visit appears in table
- [ ] Can see all visit details displayed correctly

---

**Status**: Ready to test  
**Backend**: Running on http://localhost:5000  
**Next**: Submit test visit and verify sync!

