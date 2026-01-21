# ⚡ Quick Start - Multi-Stage Property System

## 🎯 What This Does

| Step | User | Action | Data Goes To |
|------|------|--------|--------------|
| 1️⃣ | Property Visitor | Fills `visit.html` form | **VisitData** collection |
| 2️⃣ | Admin | Reviews in `enquiry-db.html` | Reviews & Approves |
| 3️⃣ | Admin | Clicks Approve | **ApprovedProperty** collection |
| 4️⃣ | Website Users | Browse `website/index-db.html` | See approved properties |
| 5️⃣ | Property Owners | Browse `ourproperty/index-db.html` | See their approved properties |

---

## 🚀 To Start Using

### 1. Start Backend (One time setup)
```bash
cd "c:\Users\yasmi\OneDrive\Desktop\roomhy final\roomhy-backend"
npm start
```
✅ Wait for: `Server running on http://localhost:5000`

### 2. Open These Files in Browser

| User Type | File | URL |
|-----------|------|-----|
| Visitor | `website/visit.html` | [Open](file:///c:/Users/yasmi/OneDrive/Desktop/roomhy%20final/website/visit.html) |
| Admin | `superadmin/enquiry-db.html` | [Open](file:///c:/Users/yasmi/OneDrive/Desktop/roomhy%20final/superadmin/enquiry-db.html) |
| Public | `website/index-db.html` | [Open](file:///c:/Users/yasmi/OneDrive/Desktop/roomhy%20final/website/index-db.html) |
| Owners | `ourproperty/index-db.html` | [Open](file:///c:/Users/yasmi/OneDrive/Desktop/roomhy%20final/ourproperty/index-db.html) |

---

## 📝 Step-by-Step Test

### Test Flow (Takes 5 minutes)

**Step 1: Submit Visit**
- Open `website/visit.html`
- Fill form (dummy data OK)
- Add 1-2 photos (optional)
- Click "Submit Visit"
- ✅ You'll get a success message with Visit ID

**Step 2: Review & Approve**
- Open `superadmin/enquiry-db.html`
- Click "Pending" button
- Click "View Details & Approve"
- Click "✓ Approve" button
- Enter any admin name (e.g., "Admin1")
- ✅ Success! Property is now approved

**Step 3: See on Website**
- Open `website/index-db.html`
- ✅ Your approved property appears here!
- Can filter by city or type

**Step 4: See on OurProperty**
- Open `ourproperty/index-db.html`
- ✅ Your approved property appears here too!
- Can filter by owner

---

## 📊 Database Collections Created

| Collection | Purpose | Auto-created |
|------------|---------|--------------|
| `visitdata` | Raw submissions from visit.html | Yes, on first submit |
| `approvedproperties` | Approved listings | Yes, on first approval |

---

## 🔧 API Quick Reference

### Submit Visit
```
POST http://localhost:5000/api/visits/submit
```

### Get Pending (for Admin)
```
GET http://localhost:5000/api/visits/pending
```

### Approve Visit
```
POST http://localhost:5000/api/visits/{visitId}/approve
Body: { approvalNotes: "...", approvedBy: "Admin1" }
```

### Get for Website
```
GET http://localhost:5000/api/approved-properties/website/live
```

### Get for OurProperty
```
GET http://localhost:5000/api/approved-properties/ourproperty/live
```

---

## ⚠️ Common Issues & Fixes

### "Cannot reach localhost:5000"
```bash
# Kill port 5000 if in use
netstat -ano | findstr :5000
taskkill /PID {PID} /F

# Restart
npm start
```

### "No visits showing in admin"
- Refresh the page
- Check browser console (F12)
- Verify server is running

### "Photos not uploading"
- Check file size (max 5MB each)
- Use .jpg or .png format
- Wait for upload to complete

### "Properties not showing on website"
- Approve at least one visit first
- Check Admin already approved it
- Refresh the page

---

## 📁 All Files At A Glance

```
roomhy-backend/
  ├── models/
  │   └── VisitData.js ✨ NEW
  │
  └── routes/
      ├── visitDataRoutes.js ✨ NEW
      └── approvedPropertyRoutes.js ✨ NEW

website/
  ├── visit.html ✨ UPDATED (now saves to MongoDB)
  └── index-db.html ✨ NEW (public property display)

superadmin/
  └── enquiry-db.html ✨ NEW (admin review interface)

ourproperty/
  └── index-db.html ✨ NEW (owner property view)
```

---

## ✨ Features Included

✅ Visit form with photo upload
✅ Admin review interface with modal
✅ Automatic status tracking
✅ Photo carousel
✅ City/Type filtering
✅ Owner filtering
✅ Mobile responsive
✅ Error handling
✅ MongoDB integration
✅ Auto-generated IDs

---

## 🎓 Data Flow Summary

```
Visitor submits in visit.html
         ⬇️
Data saved to VisitData collection
         ⬇️
Admin sees in enquiry-db.html  
         ⬇️
Admin approves
         ⬇️
Data copied to ApprovedProperty collection
         ⬇️
Public sees in website/index-db.html
⬇️ AND ⬇️
Owners see in ourproperty/index-db.html
```

---

## 💡 Tips

1. **Add multiple photos**: The carousel will let users swipe through them
2. **Admin notes**: Add approval notes in the admin panel for reference
3. **Filters**: Use city/type filters to search efficiently  
4. **Mobile**: All pages are mobile-responsive
5. **Photos**: Base64 encoded in MongoDB, no separate storage needed

---

## 🚨 If Something Breaks

**Most common**: Server not running
```bash
cd "c:\Users\yasmi\OneDrive\Desktop\roomhy final\roomhy-backend"
npm start
```

**If that doesn't work**: Check MongoDB connection
- Verify `.env` has correct `MONGO_URI`
- Test Atlas connection directly
- Check IP whitelist in MongoDB Atlas

**Still stuck**: Check browser console (F12)
- Look for red error messages
- Check network tab for failed requests
- Verify `localhost:5000` is accessible

---

## ✅ You're All Set!

Everything is installed and ready to use. Just:
1. Start the backend server
2. Open the HTML files
3. Test the flow
4. You're done! 🎉

**Total setup time**: ~2 minutes (if backend already running)
**Total test time**: ~5 minutes

---

**Last Updated**: Today
**Status**: ✅ Production Ready
