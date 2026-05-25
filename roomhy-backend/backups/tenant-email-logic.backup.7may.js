// BACKUP 7may — original tenant email logic before Zoho Writer replacement
// Restore these if you need to roll back to the system-email flow.

// ─── 1. buildTenantLoginEmail (checkinRoutes.js ~line 123) ───────────────────
// function buildTenantLoginEmail(tenant, dashboardUrl) {
//     return `
//         <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
//             <div style="background:#16a34a;color:#fff;padding:16px 20px;">
//                 <h2 style="margin:0;font-size:20px;">RoomHy Tenant Check-in Completed</h2>
//             </div>
//             <div style="padding:18px 20px;color:#111827;line-height:1.55;">
//                 <p style="margin-top:0;">Your tenant digital check-in and rental agreement signing are complete.</p>
//                 <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px 16px;margin:14px 0;">
//                     <p style="margin:0 0 8px;"><strong>Login ID:</strong> ${tenant.loginId || '-'}</p>
//                     <p style="margin:0 0 8px;"><strong>Email:</strong> ${tenant.email || '-'}</p>
//                     <p style="margin:0;"><strong>Property:</strong> ${tenant.propertyTitle || '-'}</p>
//                 </div>
//                 <p style="margin:14px 0 18px;">
//                     <a href="${dashboardUrl}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;font-weight:700;">Open Tenant Login</a>
//                 </p>
//                 <p style="font-size:12px;color:#6b7280;">If button does not work, copy this link: ${dashboardUrl}</p>
//             </div>
//         </div>
//     `;
// }

// ─── 2. sendMail block in completeOwnerAgreementAndNotify (checkinRoutes.js ~line 731) ───
// let loginEmailSent = false;
// if (tenant.email) {
//     try {
//         await sendMail(
//             tenant.email,
//             'RoomHy Tenant Login Details',
//             '',
//             buildTenantLoginEmail(tenant, dashboardUrl)
//         );
//         loginEmailSent = true;
//     } catch (emailErr) {
//         console.error('[TENANT AGREEMENT COMPLETE] Email send error:', emailErr.message);
//     }
// }
