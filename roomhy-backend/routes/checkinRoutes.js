const express = require('express');
const router = express.Router();
const path = require('path');
const PDFDocument = require('pdfkit');
const CheckinRecord = require('../models/CheckinRecord');
const Owner = require('../models/Owner');
const Property = require('../models/Property');
const Tenant = require('../models/Tenant');
const { normalizeRoomInventory, summarizeRoomInventory, syncOwnerPropertyOccupancy } = require('../utils/ownerOccupancy');
const { sendMail } = require('../utils/mailer');
const { sendDocumentToResolvedUser, sendTemplateMessage, sendTemplateToResolvedUser } = require('../utils/whatsappBot');
const { otpLimiter } = require('../middleware/security');
const { requestAadhaarOtp, verifyAadhaarOtp, aadhaarOcr } = require('../services/cashfreeKycService');
const { generateAgreementPdfBuffer } = require('../utils/generateAgreementPdf');
const cloudinary = require('../utils/cloudinary');
const {
    verifyDigilockerAccount,
    createDigilockerUrl,
    getDigilockerVerificationStatus,
    getDigilockerDocument
} = require('../services/cashfreeDigilockerService');
const {
    createOwnerAgreementRequest
} = require('../services/zohoSignService');

const WEBSITE_URL = process.env.WEBSITE_URL || 'https://roomhy.com';
const ADMIN_URL = process.env.ADMIN_URL || process.env.FRONTEND_URL || 'https://admin.roomhy.com';
const APP_URL = process.env.APP_URL || process.env.APP_BASE_URL || process.env.WEB_APP_URL || 'https://app.roomhy.com';
const DIGITAL_CHECKIN_URL = process.env.DIGITAL_CHECKIN_URL || ADMIN_URL;
const BACKEND_URL = process.env.BACKEND_URL || process.env.API_BASE_URL || 'https://api.roomhy.com';

const otpStore = new Map();

// Verhoeff checksum — UIDAI uses this for all 12-digit Aadhaar numbers
const _VD = [
    [0,1,2,3,4,5,6,7,8,9],[1,2,3,4,0,6,7,8,9,5],[2,3,4,0,1,7,8,9,5,6],
    [3,4,0,1,2,8,9,5,6,7],[4,0,1,2,3,9,5,6,7,8],[5,9,8,7,6,0,4,3,2,1],
    [6,5,9,8,7,1,0,4,3,2],[7,6,5,9,8,2,1,0,4,3],[8,7,6,5,9,3,2,1,0,4],
    [9,8,7,6,5,4,3,2,1,0]
];
const _VP = [
    [0,1,2,3,4,5,6,7,8,9],[1,5,7,6,2,8,3,0,9,4],[5,8,0,3,7,9,6,1,4,2],
    [8,9,1,6,0,4,3,5,2,7],[9,4,5,3,1,2,6,8,7,0],[4,2,8,6,5,7,3,9,0,1],
    [2,7,9,3,8,0,6,4,1,5],[7,0,4,6,9,1,3,2,5,8]
];
function verhoeffCheck(number) {
    const digits = String(number).replace(/\D/g, '').split('').reverse().map(Number);
    if (digits.length !== 12) return false;
    let c = 0;
    for (let i = 0; i < digits.length; i++) c = _VD[c][_VP[i % 8][digits[i]]];
    return c === 0;
}

function keyFor(role, loginId, aadhaarNumber) {
    return `${role}:${String(loginId || '').toUpperCase()}:${String(aadhaarNumber || '')}`;
}

function ensureRole(role) {
    return role === 'owner' || role === 'tenant';
}

async function upsertRecord(loginId, role, update) {
    return CheckinRecord.findOneAndUpdate(
        { loginId: String(loginId || '').toUpperCase(), role },
        { $set: update, $setOnInsert: { loginId: String(loginId || '').toUpperCase(), role } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    );
}

function createDigilockerRef(loginId) {
    const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `DL-${String(loginId || '').toUpperCase()}-${Date.now()}-${suffix}`;
}

function isOwnerKycVerified(record) {
    return Boolean(record?.ownerKyc?.otpVerified || record?.ownerKyc?.digilockerVerified);
}

function isTenantKycVerified(record) {
    return Boolean(record?.tenantKyc?.otpVerified || record?.tenantKyc?.digilockerVerified);
}

function extractAadhaarNumber(value) {
    if (!value) return '';
    if (typeof value === 'string') {
        const digits = value.replace(/\D/g, '');
        return digits.length === 12 ? digits : '';
    }
    if (Array.isArray(value)) {
        for (const item of value) {
            const extracted = extractAadhaarNumber(item);
            if (extracted) return extracted;
        }
        return '';
    }
    if (typeof value === 'object') {
        const keys = [
            'aadhaar_number',
            'aadhaarNumber',
            'aadhar_number',
            'aadharNumber',
            'document_number',
            'documentNumber',
            'id_number',
            'idNumber',
            'uid',
            'number',
            'value'
        ];
        for (const key of keys) {
            const extracted = extractAadhaarNumber(value[key]);
            if (extracted) return extracted;
        }
        for (const nested of Object.values(value)) {
            const extracted = extractAadhaarNumber(nested);
            if (extracted) return extracted;
        }
    }
    return '';
}

function buildOtpEmail({ otp, name, loginId, role = 'Owner', expiryMinutes = 10 }) {
    const isSandbox = Boolean(otp);
    const otpDisplay = isSandbox ? String(otp) : null;
    const logoUrl = `${APP_URL}/website/images/roomhy.png`;
    const year = new Date().getFullYear();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>OTP Verification — RoomHy</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f4;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border:1px solid #dddddd;">

        <!-- Logo Header -->
        <tr>
          <td style="padding:24px 32px;border-bottom:1px solid #dddddd;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="vertical-align:middle;">
                  <img src="${logoUrl}" alt="RoomHy" height="32" style="display:block;height:32px;max-width:140px;border:0;" />
                </td>
                <td align="right" style="vertical-align:middle;font-size:11px;color:#999999;font-family:Arial,Helvetica,sans-serif;">
                  Digital Check-In Portal
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 32px 0;">
            <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#111111;font-family:Arial,Helvetica,sans-serif;">OTP Verification</h1>
            <p style="margin:0 0 8px;font-size:15px;color:#333333;font-family:Arial,Helvetica,sans-serif;">Dear <strong>${name || loginId || 'Applicant'}</strong>,</p>
            <p style="margin:0 0 24px;font-size:14px;color:#555555;line-height:1.7;font-family:Arial,Helvetica,sans-serif;">
              ${isSandbox
                ? `You have requested an Aadhaar OTP verification for your RoomHy <strong>${role}</strong> account. Please use the One-Time Password below to complete your identity verification.`
                : `You have requested an Aadhaar OTP verification for your RoomHy <strong>${role}</strong> account. Your OTP has been dispatched to your Aadhaar-linked mobile number. Please enter it on the verification page to proceed.`
              }
            </p>
          </td>
        </tr>

        ${isSandbox && otpDisplay ? `
        <!-- OTP Box -->
        <tr>
          <td style="padding:0 32px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #cccccc;background-color:#f9f9f9;">
              <tr>
                <td align="center" style="padding:28px 24px;">
                  <p style="margin:0 0 14px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#888888;font-family:Arial,Helvetica,sans-serif;">Your One-Time Password</p>
                  <p style="margin:0;font-size:42px;font-weight:700;letter-spacing:0.24em;color:#111111;font-family:'Courier New',Courier,monospace;line-height:1.1;">${otpDisplay}</p>
                  <p style="margin:16px 0 0;font-size:12px;color:#888888;font-family:Arial,Helvetica,sans-serif;">Valid for ${expiryMinutes} minutes &nbsp;&#183;&nbsp; Do not share this code with anyone</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>` : `
        <!-- Validity Note -->
        <tr>
          <td style="padding:0 32px 24px;">
            <p style="margin:0;font-size:14px;color:#555555;line-height:1.7;font-family:Arial,Helvetica,sans-serif;">
              The OTP is valid for <strong>${expiryMinutes} minutes</strong> from the time of request. If you did not initiate this verification, please disregard this message.
            </p>
          </td>
        </tr>`}

        <!-- Account Info -->
        <tr>
          <td style="padding:0 32px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #dddddd;">
              <tr>
                <td colspan="2" style="padding:12px 18px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#888888;background-color:#f4f4f4;border-bottom:1px solid #dddddd;font-family:Arial,Helvetica,sans-serif;">Account Information</td>
              </tr>
              <tr>
                <td style="padding:10px 18px;font-size:13px;color:#888888;border-bottom:1px solid #eeeeee;width:140px;font-family:Arial,Helvetica,sans-serif;">Login ID</td>
                <td style="padding:10px 18px;font-size:13px;font-weight:700;color:#111111;border-bottom:1px solid #eeeeee;font-family:'Courier New',Courier,monospace;">${loginId || '—'}</td>
              </tr>
              <tr>
                <td style="padding:10px 18px;font-size:13px;color:#888888;border-bottom:1px solid #eeeeee;font-family:Arial,Helvetica,sans-serif;">Account Type</td>
                <td style="padding:10px 18px;font-size:13px;font-weight:700;color:#111111;border-bottom:1px solid #eeeeee;font-family:Arial,Helvetica,sans-serif;">${role}</td>
              </tr>
              <tr>
                <td style="padding:10px 18px;font-size:13px;color:#888888;font-family:Arial,Helvetica,sans-serif;">OTP Validity</td>
                <td style="padding:10px 18px;font-size:13px;font-weight:700;color:#111111;font-family:Arial,Helvetica,sans-serif;">${expiryMinutes} minutes from time of issue</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Security Notice -->
        <tr>
          <td style="padding:0 32px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #dddddd;border-left:3px solid #111111;">
              <tr>
                <td style="padding:14px 18px;font-size:13px;color:#333333;line-height:1.7;font-family:Arial,Helvetica,sans-serif;">
                  <strong>Security Notice:</strong> RoomHy will never contact you by phone or message to request your OTP. Do not share this code with any individual or organisation under any circumstances.
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="border-top:1px solid #dddddd;padding:20px 32px;background-color:#f9f9f9;">
            <p style="margin:0;font-size:12px;color:#888888;line-height:1.8;font-family:Arial,Helvetica,sans-serif;">
              <strong style="color:#555555;">RoomHy Support Team</strong><br>
              Email: support@roomhy.com &nbsp;&#124;&nbsp; Website: www.roomhy.com<br>
              &copy; ${year} RoomHy. All rights reserved.<br>
              This is an automated message. Please do not reply to this email.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildOwnerLoginEmail(owner, dashboardUrl) {
    const logoUrl = `${APP_URL}/website/images/roomhy.png`;
    const year = new Date().getFullYear();
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Owner Account Activated — RoomHy</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f4;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border:1px solid #dddddd;">

        <!-- Logo Header -->
        <tr>
          <td style="padding:24px 32px;border-bottom:1px solid #dddddd;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="vertical-align:middle;">
                  <img src="${logoUrl}" alt="RoomHy" height="32" style="display:block;height:32px;max-width:140px;border:0;" />
                </td>
                <td align="right" style="vertical-align:middle;font-size:11px;color:#999999;font-family:Arial,Helvetica,sans-serif;">
                  Property Owner Portal
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Heading -->
        <tr>
          <td style="padding:32px 32px 8px;">
            <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#111111;font-family:Arial,Helvetica,sans-serif;">Owner Account Activated</h1>
            <p style="margin:0 0 8px;font-size:15px;color:#333333;font-family:Arial,Helvetica,sans-serif;">Dear <strong>${owner.name || 'Property Owner'}</strong>,</p>
            <p style="margin:0 0 24px;font-size:14px;color:#555555;line-height:1.7;font-family:Arial,Helvetica,sans-serif;">
              Your owner profile, KYC verification, and agreement acceptance have been completed successfully. Your RoomHy Property Owner account is now fully activated.
            </p>
          </td>
        </tr>

        <!-- Credentials Table -->
        <tr>
          <td style="padding:0 32px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #dddddd;">
              <tr>
                <td colspan="2" style="padding:12px 18px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#888888;background-color:#f4f4f4;border-bottom:1px solid #dddddd;font-family:Arial,Helvetica,sans-serif;">Login Credentials</td>
              </tr>
              <tr>
                <td style="padding:12px 18px;font-size:13px;color:#888888;border-bottom:1px solid #eeeeee;width:130px;font-family:Arial,Helvetica,sans-serif;">Login ID</td>
                <td style="padding:12px 18px;font-size:14px;font-weight:700;color:#111111;border-bottom:1px solid #eeeeee;font-family:'Courier New',Courier,monospace;">${owner.loginId || '—'}</td>
              </tr>
              <tr>
                <td style="padding:12px 18px;font-size:13px;color:#888888;border-bottom:1px solid #eeeeee;font-family:Arial,Helvetica,sans-serif;">Password</td>
                <td style="padding:12px 18px;font-size:14px;font-weight:700;color:#111111;border-bottom:1px solid #eeeeee;font-family:'Courier New',Courier,monospace;">${owner.checkinPassword || owner.credentials?.password || '—'}</td>
              </tr>
              <tr>
                <td style="padding:12px 18px;font-size:13px;color:#888888;font-family:Arial,Helvetica,sans-serif;">Email</td>
                <td style="padding:12px 18px;font-size:13px;color:#111111;font-family:Arial,Helvetica,sans-serif;">${owner.email || '—'}</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Button -->
        <tr>
          <td style="padding:0 32px 12px;">
            <table cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="background-color:#111111;">
                  <a href="${dashboardUrl}" style="display:inline-block;background-color:#111111;color:#ffffff;text-decoration:none;padding:13px 28px;font-size:14px;font-weight:600;font-family:Arial,Helvetica,sans-serif;white-space:nowrap;">Open Owner Dashboard</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 24px;">
            <p style="margin:0;font-size:12px;color:#888888;line-height:1.6;font-family:Arial,Helvetica,sans-serif;">If the button above does not work, copy and paste the following link into your browser:<br><span style="color:#333333;">${dashboardUrl}</span></p>
          </td>
        </tr>

        <!-- Security Notice -->
        <tr>
          <td style="padding:0 32px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #dddddd;border-left:3px solid #111111;">
              <tr>
                <td style="padding:14px 18px;font-size:13px;color:#333333;line-height:1.7;font-family:Arial,Helvetica,sans-serif;">
                  Please change your password upon your first login. Keep your credentials confidential and do not share them with any third party. Sign out from shared or public devices after use.
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="border-top:1px solid #dddddd;padding:20px 32px;background-color:#f9f9f9;">
            <p style="margin:0;font-size:12px;color:#888888;line-height:1.8;font-family:Arial,Helvetica,sans-serif;">
              <strong style="color:#555555;">RoomHy Support Team</strong><br>
              Email: support@roomhy.com &nbsp;&#124;&nbsp; Website: www.roomhy.com<br>
              &copy; ${year} RoomHy. All rights reserved.<br>
              This is an automated message. Please do not reply to this email.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildTenantLoginEmail(tenant, dashboardUrl, record = {}) {
    const logoUrl = `${APP_URL}/website/images/roomhy.png`;
    const year = new Date().getFullYear();
    const tenantName = tenant.name || 'Tenant';
    const propertyName = tenant.propertyTitle || tenant.digitalCheckin?.profile?.propertyName || 'RoomHy Property';
    const roomNo = tenant.roomNo || '';
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Digital Check-In Complete — RoomHy</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f4;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border:1px solid #dddddd;">

        <!-- Logo Header -->
        <tr>
          <td style="padding:24px 32px;border-bottom:1px solid #dddddd;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="vertical-align:middle;">
                  <img src="${logoUrl}" alt="RoomHy" height="32" style="display:block;height:32px;max-width:140px;border:0;" />
                </td>
                <td align="right" style="vertical-align:middle;font-size:11px;color:#999999;font-family:Arial,Helvetica,sans-serif;">
                  Tenant Portal
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Heading -->
        <tr>
          <td style="padding:32px 32px 8px;">
            <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#111111;font-family:Arial,Helvetica,sans-serif;">Digital Check-In Complete</h1>
            <p style="margin:0 0 8px;font-size:15px;color:#333333;font-family:Arial,Helvetica,sans-serif;">Dear <strong>${tenantName}</strong>,</p>
            <p style="margin:0 0 24px;font-size:14px;color:#555555;line-height:1.7;font-family:Arial,Helvetica,sans-serif;">
              Your digital check-in and Licence &amp; Subscription Agreement signing have been completed successfully. Your RoomHy Tenant account is now active. Your login credentials and a copy of the signed agreement are provided below.
            </p>
          </td>
        </tr>

        <!-- Credentials Table -->
        <tr>
          <td style="padding:0 32px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #dddddd;">
              <tr>
                <td colspan="2" style="padding:12px 18px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#888888;background-color:#f4f4f4;border-bottom:1px solid #dddddd;font-family:Arial,Helvetica,sans-serif;">Account &amp; Property Details</td>
              </tr>
              <tr>
                <td style="padding:11px 18px;font-size:13px;color:#888888;border-bottom:1px solid #eeeeee;width:150px;font-family:Arial,Helvetica,sans-serif;">Login ID</td>
                <td style="padding:11px 18px;font-size:14px;font-weight:700;color:#111111;border-bottom:1px solid #eeeeee;font-family:'Courier New',Courier,monospace;">${tenant.loginId || '—'}</td>
              </tr>
              <tr>
                <td style="padding:11px 18px;font-size:13px;color:#888888;border-bottom:1px solid #eeeeee;font-family:Arial,Helvetica,sans-serif;">Email</td>
                <td style="padding:11px 18px;font-size:13px;color:#111111;border-bottom:1px solid #eeeeee;font-family:Arial,Helvetica,sans-serif;">${tenant.email || '—'}</td>
              </tr>
              <tr>
                <td style="padding:11px 18px;font-size:13px;color:#888888;border-bottom:1px solid #eeeeee;font-family:Arial,Helvetica,sans-serif;">Property</td>
                <td style="padding:11px 18px;font-size:13px;font-weight:700;color:#111111;border-bottom:1px solid #eeeeee;font-family:Arial,Helvetica,sans-serif;">${propertyName}</td>
              </tr>
              ${roomNo ? `<tr>
                <td style="padding:11px 18px;font-size:13px;color:#888888;font-family:Arial,Helvetica,sans-serif;">Room</td>
                <td style="padding:11px 18px;font-size:13px;font-weight:700;color:#111111;font-family:Arial,Helvetica,sans-serif;">${roomNo}</td>
              </tr>` : ''}
            </table>
          </td>
        </tr>

        <!-- Button -->
        <tr>
          <td style="padding:0 32px 12px;">
            <table cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="background-color:#111111;">
                  <a href="${dashboardUrl}" style="display:inline-block;background-color:#111111;color:#ffffff;text-decoration:none;padding:13px 28px;font-size:14px;font-weight:600;font-family:Arial,Helvetica,sans-serif;white-space:nowrap;">Open Tenant Dashboard</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 24px;">
            <p style="margin:0;font-size:12px;color:#888888;line-height:1.6;font-family:Arial,Helvetica,sans-serif;">If the button above does not work, copy and paste the following link into your browser:<br><span style="color:#333333;">${dashboardUrl}</span></p>
          </td>
        </tr>

        <!-- PDF Notice -->
        <tr>
          <td style="padding:0 32px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #dddddd;border-left:3px solid #111111;background-color:#f9f9f9;">
              <tr>
                <td style="padding:14px 18px;font-size:13px;color:#333333;line-height:1.7;font-family:Arial,Helvetica,sans-serif;">
                  Your signed Licence &amp; Subscription Agreement has been generated and is attached to this email as a PDF document. Please retain this document for your records.
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Support Note -->
        <tr>
          <td style="padding:0 32px 32px;">
            <p style="margin:0;font-size:13px;color:#555555;line-height:1.7;font-family:Arial,Helvetica,sans-serif;">
              For any questions or assistance, please contact our support team at <strong>support@roomhy.com</strong>.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="border-top:1px solid #dddddd;padding:20px 32px;background-color:#f9f9f9;">
            <p style="margin:0;font-size:12px;color:#888888;line-height:1.8;font-family:Arial,Helvetica,sans-serif;">
              <strong style="color:#555555;">RoomHy Support Team</strong><br>
              Email: support@roomhy.com &nbsp;&#124;&nbsp; Website: www.roomhy.com<br>
              &copy; ${year} RoomHy. All rights reserved.<br>
              This is an automated message. Please do not reply to this email.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ======================================================
// DYNAMIC FIELD MAPPING — tenant agreement (post-signing)
// Maps Tenant model + CheckinRecord to the shared
// generateAgreementPdfBuffer field schema.
// ======================================================
function generateTenantAgreementPdfBuffer(tenant, record = {}) {
    const agreement = record?.tenantAgreement || {};
    const profile   = tenant?.digitalCheckin?.profile || {};
    // DYNAMIC FIELD MAPPING — agreement details saved from tenant profile form
    const details   = tenant?.digitalCheckin?.agreementDetails || {};

    return generateAgreementPdfBuffer({
        tenantName:          details.tenantName          || tenant.name            || profile.name            || 'Tenant',
        tenantAddress:       details.tenantAddress       || tenant.address         || '-',
        tenantEmail:         details.tenantEmail         || tenant.email           || '-',
        tenantPhone:         details.tenantPhone         || tenant.phone           || '-',
        backupEmail:         details.backupEmail         || '-',
        backupPhone:         details.backupPhone         || '-',
        propertyName:        details.propertyName        || tenant.propertyTitle   || profile.propertyName    || 'RoomHy Property',
        propertyAddress:     details.propertyAddress     || '-',
        accommodationType:   details.accommodationType   || tenant.roomType        || (tenant.roomNo ? `Room ${tenant.roomNo}` : '-'),
        roomNumber:          details.roomNumber          || tenant.roomNo          || profile.roomNo          || '-',
        ownerName:           details.ownerName           || tenant.ownerName       || '-',
        rentAmount:          details.rentAmount          || String(tenant.agreedRent || profile.agreedRent || '-'),
        duration:            details.duration            || '-',
        licenseStartDate:    details.licenseStartDate    || (tenant.moveInDate ? new Date(tenant.moveInDate).toISOString().slice(0, 10) : '-'),
        licenseEndDate:      details.licenseEndDate      || '-',
        licenseFeeDueDate:   details.licenseFeeDueDate   || '5',
        moveOutCharges:      details.moveOutCharges      || '-',
        noticePeriodCharges: details.noticePeriodCharges || '-',
        securityDeposit:     details.securityDeposit     || String(tenant.securityDepositTotal || '-'),
        inclusions:          details.inclusions          || '-',
        minimumStayDuration: details.minimumStayDuration || '3 Months',
        gstCharges:          details.gstCharges          || '0',
        signatureDataUrl:    agreement.signatureDataUrl  || tenant?.digitalCheckin?.agreement?.signatureDataUrl || '',
        eSignName:           tenant.agreementESignName   || agreement.eSignName    || tenant.name || '',
        signedDate:          agreement.signedAt ? new Date(agreement.signedAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)
    });
}

function buildTenantAgreementHtml(tenant, record = {}) {
    const agreement = record?.tenantAgreement || {};
    const profile = tenant?.digitalCheckin?.profile || {};
    const propertyName = tenant.propertyTitle || profile.propertyName || 'RoomHy Property';
    const tenantName = tenant.name || profile.name || 'Tenant';
    const moveInDate = tenant.moveInDate ? new Date(tenant.moveInDate).toISOString().slice(0, 10) : (profile.moveInDate || '-');
    const signedDate = agreement.signedAt ? new Date(agreement.signedAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
    const signatureDataUrl = agreement.signatureDataUrl || tenant?.digitalCheckin?.agreement?.signatureDataUrl || '';
    const eSignName = tenant.agreementESignName || agreement.eSignName || tenantName;
    const aadhaarNumber = tenant?.kyc?.aadhaarNumber || tenant?.kyc?.aadhar || record?.tenantKyc?.aadhaarNumber || '-';
    const securityDepositTotal = tenant.securityDepositTotal || profile.securityDepositTotal || 0;
    const securityDepositPaid = tenant.securityDepositPaid || profile.securityDepositPaid || 0;
    const securityDepositBalance = tenant.securityDepositBalance || profile.securityDepositBalance || 0;
    const electricityCharge = tenant.electricityCharge || profile.electricityCharge || 0;
    const maintenanceCharge = tenant.maintenanceCharge || profile.maintenanceCharge || 0;

    const clauseStyle = 'margin:0 0 10px;font-size:14px;line-height:1.7;color:#111827;';
    return `
        <div style="font-family:Arial,sans-serif;max-width:760px;margin:24px auto;border:1px solid #dbe3ef;border-radius:20px;overflow:hidden;background:#ffffff;">
            <div style="padding:24px 28px;background:linear-gradient(135deg,#eff6ff,#ffffff);border-bottom:1px solid #dbe3ef;display:flex;justify-content:space-between;align-items:flex-start;gap:16px;">
                <div>
                    <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.08em;color:#2563eb;font-weight:800;">ROOMHY RENTAL RECORD</p>
                    <h2 style="margin:0;font-size:26px;color:#0f172a;">LICENCE & SUBSCRIPTION AGREEMENT</h2>
                    <p style="margin:10px 0 0;font-size:14px;color:#475569;">Executed between RoomHy and ${tenantName}.</p>
                </div>
                <div style="min-width:140px;text-align:center;border:2px solid #1d4ed8;border-radius:18px;padding:12px 14px;color:#1d4ed8;font-weight:800;letter-spacing:0.08em;">
                    ROOMHY
                    <div style="font-size:11px;font-weight:700;letter-spacing:0.02em;">OFFICIAL SEAL</div>
                </div>
            </div>
            <div style="padding:24px 28px;">
                <p style="${clauseStyle}">This License & Subscription Agreement is executed between RoomHy and the Tenant named in Annexure A. The tenant occupies the allotted premises for residential purposes subject to the conditions below.</p>
                <p style="${clauseStyle}"><strong>1. TERM:</strong> As per Annexure A.</p>
                <p style="${clauseStyle}"><strong>2. PREMISES:</strong> As per Annexure A.</p>
                <p style="${clauseStyle}"><strong>3. LICENSE FEE / RENT:</strong> As per Annexure A. Rent is payable in advance on or before the due date.</p>
                <p style="${clauseStyle}"><strong>4. REFUNDABLE SECURITY DEPOSIT:</strong> As per Annexure A. Refund is processed after applicable deductions for dues or damages.</p>
                <p style="${clauseStyle}"><strong>5. MINIMUM STAY DURATION:</strong> As per Annexure A. Early move-out before minimum stay may lead to deposit withholding.</p>
                <p style="${clauseStyle}"><strong>6. LIMITED LICENSE:</strong> Tenant receives a limited right to use the premises subject to compliance and timely payments.</p>
                <p style="${clauseStyle}"><strong>7. RENT DEFAULT:</strong> Delayed or unpaid rent may result in lockout, penalties, restricted services, and termination.</p>
                <p style="${clauseStyle}"><strong>8. TERMINATION WITHOUT CAUSE:</strong> Either party may terminate subject to lock-in and notice requirements.</p>
                <p style="${clauseStyle}"><strong>9. TERMINATION FOR CAUSE:</strong> RoomHy may terminate for illegal activity, non-payment, damage, nuisance, or policy breach.</p>
                <p style="${clauseStyle}"><strong>10. MAINTENANCE OF PREMISES:</strong> Tenant must maintain the premises and is liable for damages beyond ordinary wear and tear.</p>
                <p style="${clauseStyle}"><strong>11. RENEWAL:</strong> Renewal may occur with revised rent or updated terms based on market conditions.</p>
                <p style="${clauseStyle}"><strong>12. NOTICES:</strong> Notices may be sent by email or physical delivery.</p>
                <p style="${clauseStyle}"><strong>13. ENTIRE AGREEMENT:</strong> This document and Annexure A form the complete agreement between parties.</p>
                <p style="${clauseStyle}"><strong>14. SEVERABILITY:</strong> Invalidity of one clause does not affect the balance of the agreement.</p>
                <p style="${clauseStyle}"><strong>15. GOVERNING LAW & JURISDICTION:</strong> Laws of India apply and jurisdiction lies where the premises are situated.</p>
                <p style="${clauseStyle}"><strong>16. ASSIGNING OF RECEIVABLES:</strong> RoomHy may assign receivables under this agreement.</p>
                <p style="${clauseStyle}"><strong>17. STAMP DUTY:</strong> Any applicable stamp duty responsibility lies with the tenant.</p>
                <p style="${clauseStyle}"><strong>18. OTHER TERMS & CONDITIONS:</strong> RoomHy policies may be updated from time to time.</p>

                <div style="margin-top:24px;padding:18px;border:1px solid #dbe3ef;border-radius:16px;background:#f8fafc;">
                    <h3 style="margin:0 0 12px;font-size:18px;color:#0f172a;">ANNEXURE A</h3>
                    <p style="${clauseStyle}"><strong>Name of Tenant:</strong> ${tenantName}</p>
                    <p style="${clauseStyle}"><strong>Tenant Email:</strong> ${tenant.email || '-'}</p>
                    <p style="${clauseStyle}"><strong>Tenant Phone Number:</strong> ${tenant.phone || '-'}</p>
                    <p style="${clauseStyle}"><strong>Tenant Aadhaar Number:</strong> ${aadhaarNumber}</p>
                    <p style="${clauseStyle}"><strong>Helloworld Premises name and address:</strong> ${propertyName}</p>
                    <p style="${clauseStyle}"><strong>Type of accommodation:</strong> ${tenant.roomNo ? `Room ${tenant.roomNo}` : 'RoomHy accommodation'}</p>
                    <p style="${clauseStyle}"><strong>Monthly License Fee/Rent:</strong> ${tenant.agreedRent || profile.agreedRent || 0}</p>
                    <p style="${clauseStyle}"><strong>License Start Date:</strong> ${moveInDate}</p>
                    <p style="${clauseStyle}"><strong>Security Deposit Total:</strong> ${securityDepositTotal}</p>
                    <p style="${clauseStyle}"><strong>Security Deposit Paid:</strong> ${securityDepositPaid}</p>
                    <p style="${clauseStyle}"><strong>Security Deposit Balance:</strong> ${securityDepositBalance}</p>
                    <p style="${clauseStyle}"><strong>Electricity Charge:</strong> ${electricityCharge}</p>
                    <p style="${clauseStyle}"><strong>Maintenance Charge:</strong> ${maintenanceCharge}</p>
                    <p style="${clauseStyle}"><strong>Minimum Stay Duration:</strong> 3 Months</p>
                </div>

                <div style="margin-top:28px;display:flex;justify-content:space-between;align-items:flex-end;gap:24px;flex-wrap:wrap;">
                    <div>
                        <p style="margin:0 0 8px;font-size:13px;color:#475569;"><strong>Tenant E-sign:</strong> ${eSignName}</p>
                        ${signatureDataUrl ? `<img src="${signatureDataUrl}" alt="Tenant Signature" style="display:block;width:220px;max-width:100%;height:90px;object-fit:contain;border-bottom:1px solid #94a3b8;padding-bottom:6px;" />` : ''}
                        <p style="margin:8px 0 0;font-size:12px;color:#64748b;">Signed by ${eSignName} on ${signedDate}</p>
                    </div>
                    <div style="text-align:center;border:2px solid #1d4ed8;border-radius:18px;padding:16px 20px;color:#1d4ed8;font-weight:800;letter-spacing:0.08em;">
                        ROOMHY
                        <div style="font-size:11px;font-weight:700;letter-spacing:0.02em;">DIGITAL SEAL</div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function buildOwnerTenantSignedEmail(ownerName, tenant) {
    const logoUrl = `${APP_URL}/website/images/roomhy.png`;
    const year = new Date().getFullYear();
    const tenantName = tenant.name || tenant.loginId || 'Tenant';
    const propertyName = tenant.propertyTitle || 'your property';
    const roomNo = tenant.roomNo || '';
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Tenant Agreement Signed — RoomHy</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f4;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border:1px solid #dddddd;">

        <!-- Logo Header -->
        <tr>
          <td style="padding:24px 32px;border-bottom:1px solid #dddddd;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="vertical-align:middle;">
                  <img src="${logoUrl}" alt="RoomHy" height="32" style="display:block;height:32px;max-width:140px;border:0;" />
                </td>
                <td align="right" style="vertical-align:middle;font-size:11px;color:#999999;font-family:Arial,Helvetica,sans-serif;">
                  Property Owner Portal
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Heading -->
        <tr>
          <td style="padding:32px 32px 8px;">
            <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#111111;font-family:Arial,Helvetica,sans-serif;">Tenant Agreement Signed</h1>
            <p style="margin:0 0 8px;font-size:15px;color:#333333;font-family:Arial,Helvetica,sans-serif;">Dear <strong>${ownerName}</strong>,</p>
            <p style="margin:0 0 24px;font-size:14px;color:#555555;line-height:1.7;font-family:Arial,Helvetica,sans-serif;">
              Your tenant <strong style="color:#111111;">${tenantName}</strong> has completed the digital check-in process and signed the Licence &amp; Subscription Agreement for <strong style="color:#111111;">${propertyName}</strong>${roomNo ? `, Room ${roomNo}` : ''}.
            </p>
          </td>
        </tr>

        <!-- Tenant Details Table -->
        <tr>
          <td style="padding:0 32px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #dddddd;">
              <tr>
                <td colspan="2" style="padding:12px 18px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#888888;background-color:#f4f4f4;border-bottom:1px solid #dddddd;font-family:Arial,Helvetica,sans-serif;">Tenant Details</td>
              </tr>
              <tr>
                <td style="padding:11px 18px;font-size:13px;color:#888888;border-bottom:1px solid #eeeeee;width:150px;font-family:Arial,Helvetica,sans-serif;">Tenant Name</td>
                <td style="padding:11px 18px;font-size:13px;font-weight:700;color:#111111;border-bottom:1px solid #eeeeee;font-family:Arial,Helvetica,sans-serif;">${tenantName}</td>
              </tr>
              <tr>
                <td style="padding:11px 18px;font-size:13px;color:#888888;border-bottom:1px solid #eeeeee;font-family:Arial,Helvetica,sans-serif;">Property</td>
                <td style="padding:11px 18px;font-size:13px;font-weight:700;color:#111111;border-bottom:1px solid #eeeeee;font-family:Arial,Helvetica,sans-serif;">${propertyName}</td>
              </tr>
              ${roomNo ? `<tr>
                <td style="padding:11px 18px;font-size:13px;color:#888888;border-bottom:1px solid #eeeeee;font-family:Arial,Helvetica,sans-serif;">Room</td>
                <td style="padding:11px 18px;font-size:13px;font-weight:700;color:#111111;border-bottom:1px solid #eeeeee;font-family:Arial,Helvetica,sans-serif;">${roomNo}</td>
              </tr>` : ''}
              <tr>
                <td style="padding:11px 18px;font-size:13px;color:#888888;font-family:Arial,Helvetica,sans-serif;">Login ID</td>
                <td style="padding:11px 18px;font-size:13px;font-weight:700;color:#111111;font-family:'Courier New',Courier,monospace;">${tenant.loginId || '—'}</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- PDF Notice -->
        <tr>
          <td style="padding:0 32px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #dddddd;border-left:3px solid #111111;background-color:#f9f9f9;">
              <tr>
                <td style="padding:14px 18px;font-size:13px;color:#333333;line-height:1.7;font-family:Arial,Helvetica,sans-serif;">
                  The signed Tenant Agreement has been generated and is attached to this email as a PDF document. Please retain this document for your records.
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Note -->
        <tr>
          <td style="padding:0 32px 32px;">
            <p style="margin:0;font-size:13px;color:#555555;line-height:1.7;font-family:Arial,Helvetica,sans-serif;">
              This is a system-generated legal record. For any queries regarding this agreement or the tenant account, please contact RoomHy support at <strong>support@roomhy.com</strong>.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="border-top:1px solid #dddddd;padding:20px 32px;background-color:#f9f9f9;">
            <p style="margin:0;font-size:12px;color:#888888;line-height:1.8;font-family:Arial,Helvetica,sans-serif;">
              <strong style="color:#555555;">RoomHy Support Team</strong><br>
              Email: support@roomhy.com &nbsp;&#124;&nbsp; Website: www.roomhy.com<br>
              &copy; ${year} RoomHy. All rights reserved.<br>
              This is an automated message. Please do not reply to this email.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function completeOwnerCheckinAndNotify(loginId) {
    const normalizedLoginId = String(loginId || '').toUpperCase();
    const record = await CheckinRecord.findOne({ loginId: normalizedLoginId, role: 'owner' });
    if (!record) throw new Error('Owner check-in record not found');

    const owner = await Owner.findOne({ loginId: normalizedLoginId });
    if (!owner) throw new Error('Owner not found');

    record.ownerFinalVerified = true;
    record.ownerSubmittedAt = new Date();
    record.ownerAgreement = {
        ...(record.ownerAgreement || {}),
        provider: record.ownerAgreement?.provider || 'owner-terms',
        status: record.ownerAgreement?.status || 'accepted_terms',
        completedAt: record.ownerAgreement?.completedAt || new Date()
    };
    await record.save();

    owner.agreementStatus = owner.agreementStatus || 'accepted_terms';
    owner.isActive = true;
    owner.kyc = owner.kyc || {};
    owner.kyc.status = owner.kyc.status || 'submitted';
    await owner.save();

    const dashboardUrl = `${APP_URL}/propertyowner/index`;
    let loginEmailSent = false;
    if (owner.email) {
        try {
            await sendMail(owner.email, 'RoomHy Owner Login Link', '', buildOwnerLoginEmail(owner, dashboardUrl));
            loginEmailSent = true;
        } catch (emailErr) {
            console.error('[OWNER CHECKIN COMPLETE] Email send error:', emailErr.message);
        }
    }

    try {
        await sendTemplateToResolvedUser({
            phone: owner.phone || owner.profile?.phone || '',
            email: owner.email || owner.profile?.email || '',
            userId: owner.loginId || '',
            templateName: 'roomhy_owner_checkin_complete',
            variables: [owner.name || owner.profile?.name || 'Owner', owner.loginId || '', dashboardUrl]
        });
    } catch (whatsAppErr) {
        console.error('[OWNER CHECKIN COMPLETE] WhatsApp send error:', whatsAppErr.message);
    }

    return { record, owner, dashboardUrl, loginEmailSent };
}

async function completeOwnerAgreementAndNotify(loginId, { requestId = '', provider = '', callbackPayload = null } = {}) {
    const normalizedLoginId = String(loginId || '').toUpperCase();
    const record = await CheckinRecord.findOne({ loginId: normalizedLoginId, role: 'owner' });
    if (!record) throw new Error('Owner check-in record not found');

    const owner = await Owner.findOne({ loginId: normalizedLoginId });
    if (!owner) throw new Error('Owner not found');

    record.ownerAgreement = {
        ...(record.ownerAgreement || {}),
        provider: provider || record.ownerAgreement?.provider || 'zoho-sign',
        requestId: requestId || record.ownerAgreement?.requestId || '',
        status: 'signed',
        signedAt: new Date(),
        completedAt: new Date(),
        callbackPayload: callbackPayload || record.ownerAgreement?.callbackPayload || null
    };
    record.ownerFinalVerified = true;
    record.ownerSubmittedAt = new Date();
    await record.save();

    owner.agreementRequestId = requestId || owner.agreementRequestId || '';
    owner.agreementStatus = 'signed';
    owner.agreementSignedAt = new Date();
    owner.isActive = true;
    owner.kyc = owner.kyc || {};
    owner.kyc.status = owner.kyc.status || 'submitted';
    await owner.save();

    const dashboardUrl = `${APP_URL}/propertyowner/index`;
    let loginEmailSent = false;
    if (owner.email) {
        try {
            await sendMail(owner.email, 'RoomHy Owner Login Link', '', buildOwnerLoginEmail(owner, dashboardUrl));
            loginEmailSent = true;
        } catch (emailErr) {
            console.error('[OWNER AGREEMENT COMPLETE] Email send error:', emailErr.message);
        }
    }

    try {
        await sendTemplateToResolvedUser({
            phone: owner.phone || owner.profile?.phone || '',
            email: owner.email || owner.profile?.email || '',
            userId: owner.loginId || '',
            templateName: 'roomhy_owner_checkin_complete',
            variables: [owner.name || owner.profile?.name || 'Owner', owner.loginId || '', dashboardUrl]
        });
    } catch (whatsAppErr) {
        console.error('[OWNER AGREEMENT COMPLETE] WhatsApp send error:', whatsAppErr.message);
    }

    return { record, owner, dashboardUrl, loginEmailSent };
}

async function completeTenantAgreementAndNotify(loginId, { requestId = '', provider = '', callbackPayload = null } = {}) {
    const normalizedLoginId = String(loginId || '').toUpperCase();
    const record = await CheckinRecord.findOne({ loginId: normalizedLoginId, role: 'tenant' });
    if (!record) throw new Error('Tenant check-in record not found');

    const tenant = await Tenant.findOne({ loginId: normalizedLoginId });
    if (!tenant) throw new Error('Tenant not found');

    record.tenantAgreement = {
        ...(record.tenantAgreement || {}),
        provider: provider || record.tenantAgreement?.provider || 'zoho-sign',
        requestId: requestId || record.tenantAgreement?.requestId || '',
        status: 'signed',
        signedAt: new Date(),
        completedAt: new Date(),
        callbackPayload: callbackPayload || record.tenantAgreement?.callbackPayload || null
    };
    record.tenantSubmittedAt = new Date();
    await record.save();

    tenant.agreementSigned = true;
    tenant.agreementSignedAt = new Date();
    tenant.agreementRequestId = requestId || tenant.agreementRequestId || '';
    tenant.agreementStatus = 'signed';
    tenant.digitalCheckin = tenant.digitalCheckin || {};
    tenant.digitalCheckin.agreement = {
        ...(tenant.digitalCheckin.agreement || {}),
        acceptedAt: tenant.digitalCheckin.agreement?.acceptedAt || record.tenantAgreement?.acceptedAt || new Date(),
        eSignName: tenant.agreementESignName || record.tenantAgreement?.eSignName || tenant.name || '',
        signatureDataUrl: record.tenantAgreement?.signatureDataUrl || tenant.digitalCheckin.agreement?.signatureDataUrl || ''
    };
    tenant.digitalCheckin.submittedAt = new Date();
    tenant.status = 'active';
    tenant.kycStatus = tenant.kycStatus || 'submitted';
    tenant.updatedAt = new Date();
    await tenant.save();

    const dashboardUrl = `${APP_URL}/tenant/tenantdashboard`;
    const tenantLoginUrl = `${APP_URL}/tenant/tenantlogin`;
    let loginEmailSent = false;
    let agreementPdfBuffer = null;
    if (tenant.email) {
        try {
            agreementPdfBuffer = await generateTenantAgreementPdfBuffer(tenant, record);
            await sendMail(
                tenant.email,
                'RoomHy Tenant Agreement & Login Details',
                '',
                buildTenantLoginEmail(tenant, dashboardUrl, record),
                {
                    skipWhatsApp: true,
                    attachments: [
                        {
                            filename: `RoomHy-Tenant-Agreement-${tenant.loginId || normalizedLoginId}.pdf`,
                            content: agreementPdfBuffer,
                            contentType: 'application/pdf'
                        }
                    ]
                }
            );
            loginEmailSent = true;
        } catch (emailErr) {
            console.error('[TENANT AGREEMENT COMPLETE] Email send error:', emailErr.message);
        }
    }

    // Send signed agreement PDF copy to owner
    try {
        const ownerLoginId = tenant.ownerLoginId ? String(tenant.ownerLoginId).toUpperCase() : null;
        if (ownerLoginId) {
            const ownerDoc = await Owner.findOne({ loginId: ownerLoginId });
            if (ownerDoc && ownerDoc.email) {
                const ownerPdfBuffer = agreementPdfBuffer || await generateTenantAgreementPdfBuffer(tenant, record);
                const ownerName = ownerDoc.name || ownerDoc.profile?.name || 'Owner';
                await sendMail(
                    ownerDoc.email,
                    `Tenant Agreement Signed — ${tenant.propertyTitle || 'RoomHy Property'}`,
                    `Your tenant ${tenant.name || normalizedLoginId} has signed their agreement. Please find the signed agreement PDF attached.`,
                    buildOwnerTenantSignedEmail(ownerName, tenant),
                    {
                        skipWhatsApp: true,
                        attachments: [
                            {
                                filename: `RoomHy-Tenant-Agreement-${tenant.loginId || normalizedLoginId}.pdf`,
                                content: ownerPdfBuffer,
                                contentType: 'application/pdf'
                            }
                        ]
                    }
                );
            }
        }
    } catch (ownerEmailErr) {
        console.error('[TENANT AGREEMENT COMPLETE] Owner email send error:', ownerEmailErr.message);
    }

    // Use aadhaar-linked phone for all WhatsApp notifications so messages reach the tenant's active number
    const aadhaarPhone = tenant.kyc?.aadhaarLinkedPhone || tenant.digitalCheckin?.kyc?.aadhaarLinkedPhone || tenant.phone || '';

    try {
        await sendTemplateToResolvedUser({
            phone: aadhaarPhone,
            email: tenant.email || '',
            userId: tenant.loginId || '',
            templateName: 'roomhy_tenant_checkin_complete',
            options: {
                namedParams: {
                    tenant_name: tenant.name || 'Tenant',
                    login_id: tenant.loginId || '',
                    login_url: tenantLoginUrl
                }
            }
        });
    } catch (whatsAppErr) {
        console.error('[TENANT AGREEMENT COMPLETE] WhatsApp send error:', whatsAppErr.message);
    }

    try {
        await sendDocumentToResolvedUser({
            phone: aadhaarPhone,
            email: tenant.email || '',
            userId: tenant.loginId || '',
            link: `${BACKEND_URL}/api/checkin/tenant/agreement/pdf/${encodeURIComponent(normalizedLoginId)}`,
            filename: `RoomHy-Licence-Subscription-Agreement-${tenant.loginId || normalizedLoginId}.pdf`,
            caption: [
                'RoomHy Licence & Subscription Agreement',
                `Tenant: ${tenant.name || normalizedLoginId}`,
                tenant.propertyTitle ? `Property: ${tenant.propertyTitle}` : '',
                tenant.roomNo ? `Room: ${tenant.roomNo}` : '',
                `Login ID: ${tenant.loginId || normalizedLoginId}`,
                'Please retain this document for your records.'
            ].filter(Boolean).join('\n')
        });
    } catch (whatsAppDocErr) {
        console.error('[TENANT AGREEMENT COMPLETE] WhatsApp PDF send error:', whatsAppDocErr.message);
    }

    return { record, tenant, dashboardUrl, tenantLoginUrl, loginEmailSent };
}

router.get('/tenant/agreement/pdf/:loginId', async (req, res) => {
    try {
        const normalizedLoginId = String(req.params.loginId || '').toUpperCase();
        if (!normalizedLoginId) {
            return res.status(400).json({ success: false, message: 'Missing loginId' });
        }

        const record = await CheckinRecord.findOne({ loginId: normalizedLoginId, role: 'tenant' }).lean();
        const tenant = await Tenant.findOne({ loginId: normalizedLoginId }).lean();
        if (!record || !tenant) {
            return res.status(404).json({ success: false, message: 'Tenant agreement not found' });
        }
        if (record?.tenantAgreement?.status !== 'signed' && !tenant.agreementSigned) {
            return res.status(400).json({ success: false, message: 'Tenant agreement is not signed yet' });
        }

        const pdfBuffer = await generateTenantAgreementPdfBuffer(tenant, record);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="RoomHy-Tenant-Agreement-${normalizedLoginId}.pdf"`);
        return res.send(pdfBuffer);
    } catch (err) {
        console.error('tenant/agreement/pdf error:', err);
        return res.status(500).json({ success: false, message: err.message || 'Failed to generate tenant agreement PDF' });
    }
});

router.post('/owner/profile', async (req, res) => {
    try {
        const {
            loginId,
            name,
            dob,
            email,
            phone,
            address,
            area,
            password,
            payment = {},
            vacantRooms = 0,
            vacantBeds = 0,
            occupiedRooms = 0,
            occupiedBeds = 0,
            roomInventory = []
        } = req.body || {};
        if (!loginId || !name || !dob || !email || !phone || !address || !area || !payment.bankAccountNumber || !payment.ifscCode || !payment.accountHolderName) {
            return res.status(400).json({ success: false, message: 'Missing required owner profile fields' });
        }
        
        // Ensure roomInventory is always an array
        let safeRoomInventory = roomInventory;
        if (typeof roomInventory === 'string') {
            try {
                safeRoomInventory = JSON.parse(roomInventory);
                if (!Array.isArray(safeRoomInventory)) safeRoomInventory = [];
            } catch (parseErr) {
                console.warn('Failed to parse roomInventory from string:', parseErr.message);
                safeRoomInventory = [];
            }
        } else if (!Array.isArray(roomInventory)) {
            safeRoomInventory = [];
        }
        
        const normalizedRoomInventory = normalizeRoomInventory(safeRoomInventory);
        const derivedOccupancy = normalizedRoomInventory.length > 0
            ? summarizeRoomInventory(normalizedRoomInventory)
            : {
                vacantRooms: Number(vacantRooms || 0),
                vacantBeds: Number(vacantBeds || 0),
                occupiedRooms: Number(occupiedRooms || 0),
                occupiedBeds: Number(occupiedBeds || 0),
                roomCount: Number(vacantRooms || 0) + Number(occupiedRooms || 0),
                bedCount: Number(vacantBeds || 0) + Number(occupiedBeds || 0)
            };
        const record = await upsertRecord(loginId, 'owner', {
            ownerProfile: {
                name,
                dob,
                email,
                phone,
                address,
                area,
                password,
                payment,
                roomInventory: normalizedRoomInventory,
                ...derivedOccupancy
            }
        });

        // Mirror to Owner collection so superadmin owner list can show this data
        const existingOwner = await Owner.findOne({ loginId: String(loginId).toUpperCase() }).lean();
        const existingProfile = existingOwner?.profile || {};
        
        const updatedOwner = await Owner.findOneAndUpdate(
            { loginId: String(loginId).toUpperCase() },
            {
                $set: {
                    loginId: String(loginId).toUpperCase(),
                    name: name,
                    email: email,
                    phone: phone,
                    address: address,
                    locationCode: area,
                    profileFilled: true,
                    // Store with "checkin" prefix for frontend display
                    checkinDob: dob,
                    checkinPhone: phone,
                    checkinAddress: address,
                    checkinArea: area,
                    checkinPassword: password || '',
                    checkinAccountHolderName: payment.accountHolderName || '',
                    checkinBankAccountNumber: payment.bankAccountNumber || '',
                    checkinIfscCode: payment.ifscCode || '',
                    checkinBankName: payment.bankName || '',
                    checkinBranchName: payment.branchName || '',
                    checkinUpiId: payment.upiId || '',
                    checkinCancelledCheque: payment.cancelledCheque || {},
                    ...derivedOccupancy,
                    // Also set top-level fields for backward compatibility
                    accountNumber: payment.bankAccountNumber || '',
                    ifscCode: payment.ifscCode || '',
                    bankName: payment.bankName || '',
                    branchName: payment.branchName || '',
                    profile: {
                        ...existingProfile,
                        name,
                        email,
                        phone,
                        address,
                        locationCode: area,
                        accountNumber: payment.bankAccountNumber || '',
                        ifscCode: payment.ifscCode || '',
                        bankName: payment.bankName || '',
                        branchName: payment.branchName || '',
                        accountHolderName: payment.accountHolderName || '',
                        upiId: payment.upiId || ''
                    },
                    credentials: {
                        password: password || (existingOwner?.credentials && existingOwner.credentials.password) || '',
                        firstTime: true
                    },
                    roomInventory: normalizedRoomInventory
                },
                $setOnInsert: {
                    kyc: { status: 'pending' }
                }
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        const primaryProperty = await Property.findOne({ ownerLoginId: String(loginId).toUpperCase() }).sort({ createdAt: 1 });
        if (normalizedRoomInventory.length > 0 || primaryProperty) {
            await syncOwnerPropertyOccupancy({
                loginId,
                roomInventory: normalizedRoomInventory,
                propertyId: primaryProperty?._id ? String(primaryProperty._id) : '',
                propertyTitle: primaryProperty?.title || '',
                propertyLocationCode: primaryProperty?.locationCode || area
            });
        }
        return res.json({ success: true, record, owner: updatedOwner });
    } catch (err) {
        console.error('owner/profile error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
});

router.post('/owner/documents', async (req, res) => {
    try {
        const { loginId, ownerPhoto, bankProof, aadhaarImage } = req.body || {};
        if (!loginId) return res.status(400).json({ success: false, message: 'loginId required' });

        const upper = String(loginId).toUpperCase();
        const update = {};
        const result = {};

        const uploadDoc = async (dataUrl, folder) => {
            const uploaded = await cloudinary.uploader.upload(dataUrl, { folder, resource_type: 'image' });
            return uploaded.secure_url;
        };

        if (ownerPhoto && ownerPhoto.dataUrl) {
            const url = await uploadDoc(ownerPhoto.dataUrl, 'owner_documents/photos');
            update.checkinOwnerPhoto = url;
            update.checkinOwnerPhotoName = ownerPhoto.name || '';
            update.checkinOwnerPhotoType = ownerPhoto.type || '';
            result.ownerPhotoUrl = url;
        }

        if (bankProof && bankProof.dataUrl) {
            const url = await uploadDoc(bankProof.dataUrl, 'owner_documents/bank');
            update.checkinBankProof = url;
            update.checkinBankProofName = bankProof.name || '';
            update.checkinBankProofType = bankProof.type || '';
            result.bankProofUrl = url;
        }

        if (aadhaarImage && aadhaarImage.dataUrl) {
            const url = await uploadDoc(aadhaarImage.dataUrl, 'owner_documents/aadhaar');
            update.checkinAadhaarImage = url;
            update.checkinAadhaarImageName = aadhaarImage.name || '';
            update.checkinAadhaarImageType = aadhaarImage.type || '';
            result.aadhaarImageUrl = url;

            try {
                const base64Only = aadhaarImage.dataUrl.replace(/^data:[^;]+;base64,/, '');
                const ocrData = await aadhaarOcr(base64Only);
                result.ocrResult = ocrData;
                if (ocrData && !ocrData.sandbox) {
                    const extractedNum = extractAadhaarNumber(ocrData);
                    if (extractedNum) {
                        update.checkinAadhaarNumber = extractedNum;
                        update['kyc.aadharNumber'] = extractedNum;
                    }
                }
            } catch (ocrErr) {
                console.warn('Aadhaar OCR failed:', ocrErr.message);
                result.ocrError = ocrErr.message;
            }
        }

        if (Object.keys(update).length > 0) {
            await Owner.findOneAndUpdate(
                { loginId: upper },
                { $set: update },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
        }

        return res.json({ success: true, ...result });
    } catch (err) {
        console.error('owner/documents error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
});

// POST /owner/aadhaar/ocr — Layer 1: Cashfree OCR → Verhoeff → verdict
router.post('/owner/aadhaar/ocr', async (req, res) => {
    try {
        const { image } = req.body || {};
        if (!image) return res.status(400).json({ success: false, message: 'image is required' });

        const env = String(process.env.CASHFREE_ENV || 'sandbox').toLowerCase();
        if (env === 'sandbox') {
            return res.json({ success: true, verdict: 'sandbox' });
        }

        let ocrData;
        try {
            ocrData = await aadhaarOcr(image);
        } catch (ocrErr) {
            return res.json({ success: true, verdict: 'invalid', message: ocrErr.message });
        }

        if (!ocrData || ocrData.sandbox) {
            return res.json({ success: true, verdict: 'sandbox' });
        }

        const aadhaarNum = extractAadhaarNumber(ocrData);
        if (!aadhaarNum) {
            return res.json({ success: true, verdict: 'unreadable' });
        }

        if (!verhoeffCheck(aadhaarNum)) {
            return res.json({ success: true, verdict: 'checksum_failed', aadhaarNumber: aadhaarNum });
        }

        return res.json({ success: true, verdict: 'verified', aadhaarNumber: aadhaarNum });
    } catch (err) {
        console.error('owner/aadhaar/ocr error:', err);
        return res.status(500).json({ success: false, verdict: 'invalid', message: err.message });
    }
});

// POST /owner/aadhaar/validate — Layer 2: validate number from Tesseract fallback
router.post('/owner/aadhaar/validate', async (req, res) => {
    try {
        const { aadhaarNumber } = req.body || {};
        const raw = String(aadhaarNumber || '').replace(/\D/g, '');
        if (!/^\d{12}$/.test(raw)) {
            return res.status(400).json({ success: false, error: 'Aadhaar must be 12 digits' });
        }
        if (!/^[2-9]/.test(raw)) {
            return res.status(400).json({ success: false, error: 'Invalid Aadhaar number — must start with 2–9' });
        }
        if (!verhoeffCheck(raw)) {
            return res.status(400).json({ success: false, error: 'Aadhaar checksum validation failed' });
        }
        return res.json({ success: true });
    } catch (err) {
        console.error('owner/aadhaar/validate error:', err);
        return res.status(500).json({ success: false, error: err.message });
    }
});


router.post('/owner/kyc/send-otp', otpLimiter, async (req, res) => {
    try {
        const { loginId, aadhaarLinkedPhone, aadhaarNumber, email } = req.body || {};
        console.log('[CHECKIN KYC] Received send-otp request:', { loginId, aadhaarLinkedPhone, aadhaarNumber, email });
        
        if (!loginId || !aadhaarLinkedPhone || !aadhaarNumber) {
            console.log('[CHECKIN KYC] Missing fields - loginId:', !!loginId, 'phone:', !!aadhaarLinkedPhone, 'aadhaar:', !!aadhaarNumber);
            return res.status(400).json({ success: false, message: 'Missing KYC fields' });
        }
        
        // Validate Aadhaar format (12 digits)
        if (!/^\d{12}$/.test(aadhaarNumber)) {
            console.log('[CHECKIN KYC] Invalid aadhaar format:', aadhaarNumber, 'length:', aadhaarNumber.length);
            return res.status(400).json({ success: false, message: 'Aadhaar must be 12 digits' });
        }

        await upsertRecord(loginId, 'owner', {
            ownerKyc: { aadhaarLinkedPhone, aadhaarNumber, otpVerified: false }
        });

        // Get owner details including email
        let owner = await Owner.findOne({ loginId: String(loginId).toUpperCase() }).lean();

        // Fallback: if email is missing in DB but provided by frontend, backfill it.
        if ((!owner || !owner.email) && email) {
            owner = await Owner.findOneAndUpdate(
                { loginId: String(loginId).toUpperCase() },
                { $set: { email: String(email).trim() } },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            ).lean();
        }

        if (!owner || !owner.email) {
            return res.status(400).json({ success: false, message: 'Owner email not found. Complete profile first.' });
        }

        // Update Owner model with Aadhaar info and checkin fields
        await Owner.findOneAndUpdate(
            { loginId: String(loginId).toUpperCase() },
            {
                $set: {
                    loginId: String(loginId).toUpperCase(),
                    // Store with "checkin" prefix for frontend display
                    checkinAadhaarLinkedPhone: aadhaarLinkedPhone,
                    checkinAadhaarNumber: aadhaarNumber,
                    kyc: {
                        aadharNumber: aadhaarNumber,
                        aadhaarLinkedPhone: aadhaarLinkedPhone,
                        status: 'pending'
                    }
                }
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        const { referenceId, raw } = await requestAadhaarOtp(aadhaarNumber);
        const k = keyFor('owner', loginId, aadhaarNumber);
        otpStore.set(k, { referenceId, mockOtp: raw?.mockOtp || null, expiresAt: Date.now() + 10 * 60 * 1000 });

        let whatsappSent = false;
        try {
            whatsappSent = await sendTemplateToResolvedUser({
                phone: aadhaarLinkedPhone,
                email: owner.email || email || '',
                userId: String(loginId || '').toUpperCase(),
                templateName: 'roomhy_otp_verification',
                variables: [raw?.mockOtp || 'OTP Sent'],
                options: { urlButtons: [[raw?.mockOtp || 'OTP Sent']] }
            });
        } catch (whatsAppErr) {
            console.warn('owner kyc send otp whatsapp failed:', whatsAppErr.message);
        }

        if (!whatsappSent) {
            const ownerEmail = owner.email || email || '';
            if (ownerEmail) {
                try {
                    await sendMail(
                        ownerEmail,
                        'RoomHy Owner KYC — OTP Verification',
                        `Your OTP is: ${raw?.mockOtp || '(check your Aadhaar-linked mobile)'}. Valid for 10 minutes.`,
                        buildOtpEmail({ otp: raw?.mockOtp, name: owner.name, loginId, role: 'Owner' })
                    );
                } catch (mailErr) {
                    console.warn('owner kyc send otp email fallback failed:', mailErr.message);
                }
            }
        }

        return res.json({
            success: true,
            message: 'OTP sent to Aadhaar linked mobile number',
            provider: 'cashfree'
        });
    } catch (err) {
        console.error('owner/kyc/send-otp error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
});

router.post('/owner/kyc/verify-otp', otpLimiter, async (req, res) => {
    try {
        const { loginId, aadhaarNumber, otp } = req.body || {};
        const k = keyFor('owner', loginId, aadhaarNumber);
        const entry = otpStore.get(k);
        if (!entry || Date.now() > entry.expiresAt) {
            return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
        }
        await verifyAadhaarOtp(entry.referenceId, otp, entry.mockOtp);
        otpStore.delete(k);

        const record = await upsertRecord(loginId, 'owner', { 'ownerKyc.otpVerified': true });
        
        // Get owner details
        const owner = await Owner.findOne({ loginId: String(loginId).toUpperCase() }).lean();
        
        const updatedOwner = await Owner.findOneAndUpdate(
            { loginId: String(loginId).toUpperCase() },
            { $set: { 'kyc.status': 'submitted', 'kyc.submittedAt': new Date() } },
            { new: true }
        );

        try {
            await sendTemplateToResolvedUser({
                phone: updatedOwner?.checkinAadhaarLinkedPhone || updatedOwner?.phone || '',
                email: owner?.email || updatedOwner?.email || '',
                userId: String(loginId || '').toUpperCase(),
                templateName: 'roomhy_kyc_verified',
                variables: [owner?.name || updatedOwner?.name || 'Owner']
            });
        } catch (whatsAppErr) {
            console.warn('owner kyc verified whatsapp failed:', whatsAppErr.message);
        }

        return res.json({
            success: true,
            record,
            owner: updatedOwner,
            message: owner?.email
                ? 'OTP verified successfully. Continue to owner terms acceptance.'
                : 'OTP verified successfully.'
        });

        return res.json({ success: true, record, owner: updatedOwner, message: 'OTP verified. Check your email for login details.' });
    } catch (err) {
        console.error('owner/kyc/verify-otp error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
});

router.post('/owner/kyc/digilocker/start', otpLimiter, async (req, res) => {
    try {
        const { loginId, aadhaarLinkedPhone, aadhaarNumber, email, redirectUrl: clientRedirectUrl } = req.body || {};
        if (!loginId || !aadhaarNumber) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }
        if (!/^\d{12}$/.test(String(aadhaarNumber))) {
            return res.status(400).json({ success: false, message: 'Aadhaar must be 12 digits' });
        }

        const ref = createDigilockerRef(loginId);
        const redirectUrl = clientRedirectUrl || process.env.DIGILOCKER_REDIRECT_URL || `${DIGITAL_CHECKIN_URL}/digital-checkin/ownerkyc`;

        const accountCheck = await verifyDigilockerAccount({
            verificationId: ref,
            mobileNumber: aadhaarLinkedPhone,
            aadhaarNumber
        });
        const userFlow = accountCheck?.account_exists ? 'signin' : 'signup';
        const digilockerInit = await createDigilockerUrl({
            verificationId: ref,
            redirectUrl,
            userFlow,
            documents: ['AADHAAR']
        });

        const cashfreeVerificationId = digilockerInit?.verification_id || ref;
        const cashfreeReferenceId = digilockerInit?.reference_id || digilockerInit?.ref_id || '';
        const verifyUrl = digilockerInit?.url || digilockerInit?.verification_url || digilockerInit?.link || '';

        await upsertRecord(loginId, 'owner', {
            ownerKyc: {
                aadhaarLinkedPhone: aadhaarLinkedPhone || '',
                aadhaarNumber: String(aadhaarNumber),
                otpVerified: false,
                digilockerVerified: false,
                digilockerStatus: 'pending',
                digilockerRef: ref,
                digilockerVerificationId: cashfreeVerificationId,
                digilockerReferenceId: cashfreeReferenceId,
                digilockerUrl: verifyUrl,
                digilockerStartedAt: new Date()
            }
        });

        await Owner.findOneAndUpdate(
            { loginId: String(loginId).toUpperCase() },
            {
                $set: {
                    loginId: String(loginId).toUpperCase(),
                    email: email || undefined,
                    checkinAadhaarLinkedPhone: aadhaarLinkedPhone || '',
                    checkinAadhaarNumber: String(aadhaarNumber),
                    'kyc.status': 'pending',
                    'kyc.provider': 'digilocker'
                }
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        return res.json({
            success: true,
            provider: 'digilocker',
            referenceId: cashfreeReferenceId || ref,
            verificationId: cashfreeVerificationId,
            verifyUrl,
            userFlow,
            message: 'DigiLocker verification initiated. Complete DigiLocker auth and return to this page.'
        });
    } catch (err) {
        console.error('owner/kyc/digilocker/start error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
});

router.post('/owner/kyc/digilocker/complete', otpLimiter, async (req, res) => {
    try {
        const { loginId, aadhaarNumber, referenceId, verificationId } = req.body || {};
        if (!loginId || !aadhaarNumber || (!referenceId && !verificationId)) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }
        const normalizedLoginId = String(loginId).toUpperCase();
        const record = await CheckinRecord.findOne({ loginId: normalizedLoginId, role: 'owner' });
        if (!record || !record.ownerKyc) {
            return res.status(404).json({ success: false, message: 'Owner KYC record not found' });
        }
        if (String(record.ownerKyc.aadhaarNumber || '') !== String(aadhaarNumber)) {
            return res.status(400).json({ success: false, message: 'Aadhaar mismatch' });
        }
        const storedVerificationId = record.ownerKyc.digilockerVerificationId || record.ownerKyc.digilockerRef;
        const storedReferenceId = record.ownerKyc.digilockerReferenceId || record.ownerKyc.digilockerRef;
        const checkVerificationId = verificationId || storedVerificationId;
        const checkReferenceId = referenceId || storedReferenceId;
        if (!checkVerificationId && !checkReferenceId) {
            return res.status(400).json({ success: false, message: 'Missing DigiLocker verification context' });
        }

        const statusResp = await getDigilockerVerificationStatus({
            verificationId: checkVerificationId,
            referenceId: checkReferenceId
        });
        const verificationStatus = String(
            statusResp?.status ||
            statusResp?.verification_status ||
            statusResp?.data?.status ||
            ''
        ).toUpperCase();
        const validStatuses = ['AUTHENTICATED', 'SUCCESS', 'COMPLETED', 'VERIFIED'];
        if (!validStatuses.includes(verificationStatus)) {
            return res.status(400).json({
                success: false,
                message: `DigiLocker verification not completed yet (status: ${verificationStatus || 'PENDING'})`
            });
        }

        let aadhaarDocument = null;
        try {
            aadhaarDocument = await getDigilockerDocument({
                documentType: 'AADHAAR',
                verificationId: checkVerificationId,
                referenceId: checkReferenceId
            });
        } catch (docErr) {
            console.warn('owner digilocker document fetch warning:', docErr.message);
        }

        record.ownerKyc.digilockerVerified = true;
        record.ownerKyc.digilockerStatus = 'verified';
        record.ownerKyc.digilockerVerifiedAt = new Date();
        record.ownerKyc.digilockerVerificationId = checkVerificationId || '';
        record.ownerKyc.digilockerReferenceId = checkReferenceId || '';
        const fetchedAadhaarNumber = extractAadhaarNumber(aadhaarDocument) || String(aadhaarNumber);
        record.ownerKyc.aadhaarNumber = fetchedAadhaarNumber;
        if (aadhaarDocument) {
            record.ownerKyc.digilockerDocument = aadhaarDocument;
        }
        await record.save();

        const owner = await Owner.findOneAndUpdate(
            { loginId: normalizedLoginId },
            {
                $set: {
                    checkinAadhaarNumber: fetchedAadhaarNumber,
                    'kyc.status': 'submitted',
                    'kyc.provider': 'digilocker',
                    'kyc.submittedAt': new Date(),
                    'kyc.aadharNumber': fetchedAadhaarNumber
                }
            },
            { new: true }
        );

        return res.json({
            success: true,
            message: 'DigiLocker verification completed successfully',
            aadhaarNumber: fetchedAadhaarNumber,
            verificationStatus,
            record,
            owner
        });
    } catch (err) {
        console.error('owner/kyc/digilocker/complete error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
});

router.post('/owner/terms-accept', async (req, res) => {
    try {
        const { loginId, accepted } = req.body || {};
        if (!loginId || accepted !== true) {
            return res.status(400).json({ success: false, message: 'Terms must be accepted' });
        }
        const record = await upsertRecord(loginId, 'owner', { ownerTermsAcceptedAt: new Date() });
        return res.json({ success: true, record });
    } catch (err) {
        console.error('owner/terms-accept error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
});

router.post('/owner/final-submit', async (req, res) => {
    try {
        const { loginId, finalVerified } = req.body || {};
        if (!loginId || finalVerified !== true) {
            return res.status(400).json({ success: false, message: 'Final verification required' });
        }
        const normalizedLoginId = String(loginId).toUpperCase();
        const record = await upsertRecord(normalizedLoginId, 'owner', {});
        const ownerDoc = await Owner.findOne({ loginId: normalizedLoginId }).lean();
        const ownerModelVerified = ownerDoc?.kyc?.status === 'submitted';
        if (!record.ownerKyc || (!isOwnerKycVerified(record) && !ownerModelVerified)) {
            return res.status(400).json({ success: false, message: 'Complete KYC verification first (OTP or DigiLocker)' });
        }
        if (ownerModelVerified && !isOwnerKycVerified(record)) {
            record.ownerKyc = record.ownerKyc || {};
            record.ownerKyc.digilockerVerified = true;
            record.ownerKyc.digilockerStatus = 'verified';
            record.ownerKyc.digilockerVerifiedAt = new Date();
        }
        if (!record.ownerTermsAcceptedAt) {
            return res.status(400).json({ success: false, message: 'Accept terms and conditions first' });
        }
        if (record.ownerFinalVerified) {
            const dashboardUrl = `${APP_URL}/propertyowner/index`;
            return res.json({
                success: true,
                message: 'Owner check-in already completed',
                record,
                dashboardUrl,
                agreementStatus: record.ownerAgreement?.status || 'accepted_terms'
            });
        }

        const result = await completeOwnerCheckinAndNotify(normalizedLoginId);

        return res.json({
            success: true,
            message: 'Owner terms accepted and check-in completed.',
            ...result,
            agreementStatus: result.record?.ownerAgreement?.status || 'accepted_terms'
        });
    } catch (err) {
        console.error('owner/final-submit error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
});

router.post('/owner/agreement/complete', async (req, res) => {
    try {
        const { loginId, requestId, provider, callbackPayload } = req.body || {};
        if (!loginId) {
            return res.status(400).json({ success: false, message: 'Missing loginId' });
        }
        const result = await completeOwnerAgreementAndNotify(loginId, {
            requestId,
            provider,
            callbackPayload
        });
        return res.json({
            success: true,
            message: 'Owner agreement completed',
            ...result
        });
    } catch (err) {
        console.error('owner/agreement/complete error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
});

async function handleOwnerAgreementCallback(req, res) {
    try {
        const payload = {
            ...(req.query || {}),
            ...(req.body || {})
        };
        const loginId = payload.loginId || payload.loginid || payload.ownerLoginId || payload.owner_login_id || '';
        const requestId = payload.requestId || payload.request_id || payload.document_id || payload.documentId || '';
        const status = String(payload.status || payload.action_status || payload.request_status || 'completed').toLowerCase();

        console.log('[ZOHO CALLBACK] owner agreement callback received', {
            method: req.method,
            loginId,
            requestId,
            status
        });

        if (!loginId) {
            return res.status(400).send('Missing loginId');
        }

        if (!['completed', 'complete', 'signed', 'success'].includes(status)) {
            return res.redirect(`${DIGITAL_CHECKIN_URL}/digital-checkin/owner-success?loginId=${encodeURIComponent(String(loginId).toUpperCase())}&agreementPending=1`);
        }

        await completeOwnerAgreementAndNotify(loginId, {
            requestId,
            provider: 'zoho-sign',
            callbackPayload: payload
        });

        return res.redirect(`${DIGITAL_CHECKIN_URL}/digital-checkin/owner-success?loginId=${encodeURIComponent(String(loginId).toUpperCase())}&agreementSigned=1`);
    } catch (err) {
        console.error('owner/agreement/callback error:', err);
        return res.status(500).send(err.message);
    }
}

router.get('/owner/agreement/callback', handleOwnerAgreementCallback);
router.post('/owner/agreement/callback', handleOwnerAgreementCallback);

router.post('/tenant/profile', async (req, res) => {
    try {
        const {
            loginId,
            name,
            dob,
            guardianNumber,
            moveInDate,
            email,
            propertyName,
            roomNo,
            agreedRent,
            securityDepositTotal,
            securityDepositPaid,
            securityDepositBalance,
            electricityCharge,
            maintenanceCharge,
            agreementDetails
        } = req.body || {};
        if (!loginId || !name || !dob || !guardianNumber || !moveInDate) {
            return res.status(400).json({ success: false, message: 'Missing required tenant profile fields' });
        }
        const normalizedLoginId = String(loginId).toUpperCase();
        const record = await upsertRecord(normalizedLoginId, 'tenant', {
            tenantProfile: {
                name,
                dob,
                guardianNumber,
                moveInDate,
                email: email || '',
                propertyName: propertyName || '',
                roomNo: roomNo || '',
                agreedRent: agreedRent || null,
                securityDepositTotal: securityDepositTotal || 0,
                securityDepositPaid: securityDepositPaid || 0,
                securityDepositBalance: securityDepositBalance || 0,
                electricityCharge: electricityCharge || 0,
                maintenanceCharge: maintenanceCharge || 0,
                agreementDetails: agreementDetails || {}
            }
        });

        const tenant = await Tenant.findOne({ loginId: normalizedLoginId });
        if (!tenant) {
            return res.status(404).json({ success: false, message: 'Tenant not found for this login ID' });
        }

        tenant.name = name || tenant.name;
        if (email) tenant.email = email;
        tenant.dob = dob || tenant.dob;
        tenant.guardianNumber = guardianNumber || tenant.guardianNumber;
        if (propertyName) tenant.propertyTitle = propertyName;
        if (roomNo) tenant.roomNo = roomNo;
        if (agreedRent !== undefined && agreedRent !== null && agreedRent !== '') tenant.agreedRent = Number(agreedRent);
        if (securityDepositTotal !== undefined && securityDepositTotal !== null && securityDepositTotal !== '') tenant.securityDepositTotal = Number(securityDepositTotal);
        if (securityDepositPaid !== undefined && securityDepositPaid !== null && securityDepositPaid !== '') tenant.securityDepositPaid = Number(securityDepositPaid);
        if (securityDepositBalance !== undefined && securityDepositBalance !== null && securityDepositBalance !== '') tenant.securityDepositBalance = Number(securityDepositBalance);
        if (electricityCharge !== undefined && electricityCharge !== null && electricityCharge !== '') tenant.electricityCharge = Number(electricityCharge);
        if (maintenanceCharge !== undefined && maintenanceCharge !== null && maintenanceCharge !== '') tenant.maintenanceCharge = Number(maintenanceCharge);
        if (moveInDate) tenant.moveInDate = new Date(moveInDate);
        tenant.digitalCheckin = tenant.digitalCheckin || {};
        tenant.digitalCheckin.profile = {
            ...(tenant.digitalCheckin.profile || {}),
            name,
            dob,
            guardianNumber,
            moveInDate,
            email: email || tenant.email || '',
            propertyName: propertyName || tenant.propertyTitle || '',
            roomNo: roomNo || tenant.roomNo || '',
            agreedRent: Number(agreedRent || tenant.agreedRent || 0),
            securityDepositTotal: Number(securityDepositTotal || tenant.securityDepositTotal || 0),
            securityDepositPaid: Number(securityDepositPaid || tenant.securityDepositPaid || 0),
            securityDepositBalance: Number(securityDepositBalance || tenant.securityDepositBalance || 0),
            electricityCharge: Number(electricityCharge || tenant.electricityCharge || 0),
            maintenanceCharge: Number(maintenanceCharge || tenant.maintenanceCharge || 0),
            submittedAt: new Date()
        };
        if (agreementDetails && typeof agreementDetails === 'object') {
            tenant.digitalCheckin.agreementDetails = { ...(tenant.digitalCheckin.agreementDetails || {}), ...agreementDetails };
            tenant.markModified('digitalCheckin.agreementDetails');
        }
        tenant.updatedAt = new Date();
        await tenant.save();

        return res.json({ success: true, record, tenant });
    } catch (err) {
        console.error('tenant/profile error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
});

router.post('/tenant/kyc/send-otp', otpLimiter, async (req, res) => {
    try {
        const { loginId, aadhaarLinkedPhone, aadhaarNumber, aadhaarFront, aadhaarBack } = req.body || {};
        if (!loginId || !aadhaarLinkedPhone || !aadhaarNumber) {
            return res.status(400).json({ success: false, message: 'Missing tenant KYC fields' });
        }
        const normalizedLoginId = String(loginId).toUpperCase();
        await upsertRecord(normalizedLoginId, 'tenant', {
            tenantKyc: { aadhaarLinkedPhone, aadhaarNumber, aadhaarFront, aadhaarBack, otpVerified: false }
        });

        const tenant = await Tenant.findOne({ loginId: normalizedLoginId });
        if (!tenant) {
            return res.status(404).json({ success: false, message: 'Tenant not found for this login ID' });
        }

        tenant.kyc = tenant.kyc || {};
        tenant.kyc.aadhaarNumber = aadhaarNumber;
        tenant.kyc.aadhar = aadhaarNumber;
        tenant.kyc.aadhaarLinkedPhone = aadhaarLinkedPhone;
        tenant.kyc.aadhaarFront = aadhaarFront || tenant.kyc.aadhaarFront || null;
        tenant.kyc.aadhaarBack = aadhaarBack || tenant.kyc.aadhaarBack || null;
        tenant.kyc.otpVerified = false;
        tenant.kyc.uploadedAt = new Date();
        const isFirstKycSubmission = !tenant.kycStatus || !['submitted', 'verified'].includes(tenant.kycStatus);
        tenant.kycStatus = 'submitted';

        tenant.digitalCheckin = tenant.digitalCheckin || {};
        tenant.digitalCheckin.kyc = {
            ...(tenant.digitalCheckin.kyc || {}),
            aadhaarLinkedPhone,
            aadhaarNumber,
            aadhaarFront: aadhaarFront || tenant.digitalCheckin?.kyc?.aadhaarFront || null,
            aadhaarBack: aadhaarBack || tenant.digitalCheckin?.kyc?.aadhaarBack || null,
            otpVerified: false
        };
        tenant.updatedAt = new Date();
        await tenant.save();

        const otp = String(Math.floor(100000 + Math.random() * 900000));
        const k = keyFor('tenant', normalizedLoginId, aadhaarNumber);
        otpStore.set(k, { otp, expiresAt: Date.now() + 10 * 60 * 1000 });
        console.log('[CHECKIN OTP] tenant', normalizedLoginId, aadhaarNumber, 'internal OTP generated');

        let whatsappOtpSent = false;
        try {
            whatsappOtpSent = await sendTemplateToResolvedUser({
                phone: aadhaarLinkedPhone,
                email: tenant.email || '',
                userId: normalizedLoginId,
                templateName: 'roomhy_otp_verification',
                variables: [otp],
                options: { urlButtons: [[otp]] }
            });
        } catch (whatsAppErr) {
            console.warn('tenant kyc send otp whatsapp failed:', whatsAppErr.message);
        }

        if (!whatsappOtpSent && tenant.email) {
            try {
                await sendMail(
                    tenant.email,
                    'RoomHy Tenant KYC — OTP Verification',
                    `Your OTP is: ${otp}. Valid for 10 minutes.`,
                    buildOtpEmail({ otp, name: tenant.name, loginId: normalizedLoginId, role: 'Tenant' })
                );
            } catch (mailErr) {
                console.warn('tenant kyc send otp email fallback failed:', mailErr.message);
            }
        }

        if (isFirstKycSubmission) {
            try {
                await sendTemplateToResolvedUser({
                    phone: aadhaarLinkedPhone || tenant.phone || '',
                    email: tenant.email || '',
                    userId: normalizedLoginId,
                    templateName: 'roomhy_kyc_pending',
                    options: {
                        namedParams: {
                            tenant_name: tenant.name || 'Tenant',
                            kyc_url: `${DIGITAL_CHECKIN_URL}/digital-checkin/tenantkyc?loginId=${encodeURIComponent(normalizedLoginId)}`
                        }
                    }
                });
            } catch (whatsAppErr) {
                console.warn('tenant kyc pending whatsapp failed:', whatsAppErr.message);
            }
        }

        return res.json({
            success: true,
            message: 'OTP sent to Aadhaar linked mobile number',
            provider: 'internal'
        });
    } catch (err) {
        console.error('tenant/kyc/send-otp error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
});

router.post('/tenant/kyc/verify-otp', otpLimiter, async (req, res) => {
    try {
        const { loginId, aadhaarNumber, otp } = req.body || {};
        const normalizedLoginId = String(loginId || '').toUpperCase();
        const k = keyFor('tenant', normalizedLoginId, aadhaarNumber);
        const entry = otpStore.get(k);
        if (!entry || Date.now() > entry.expiresAt) {
            return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
        }
        if (String(otp).trim() !== String(entry.otp).trim()) {
            return res.status(400).json({ success: false, message: 'Incorrect OTP. Please try again.' });
        }
        otpStore.delete(k);
        const record = await upsertRecord(normalizedLoginId, 'tenant', { 'tenantKyc.otpVerified': true });

        const tenant = await Tenant.findOne({ loginId: normalizedLoginId });
        if (!tenant) {
            return res.status(404).json({ success: false, message: 'Tenant not found for this login ID' });
        }

        tenant.kyc = tenant.kyc || {};
        tenant.kyc.otpVerified = true;
        tenant.kyc.otpVerifiedAt = new Date();
        tenant.kycStatus = 'verified';

        tenant.digitalCheckin = tenant.digitalCheckin || {};
        tenant.digitalCheckin.kyc = {
            ...(tenant.digitalCheckin.kyc || {}),
            otpVerified: true,
            otpVerifiedAt: new Date()
        };
        tenant.updatedAt = new Date();
        await tenant.save();

        try {
            await sendTemplateToResolvedUser({
                phone: tenant.phone || tenant.kyc?.aadhaarLinkedPhone || '',
                email: tenant.email || '',
                userId: normalizedLoginId,
                templateName: 'roomhy_kyc_verified',
                variables: [tenant.name || 'Tenant']
            });
        } catch (whatsAppErr) {
            console.warn('tenant kyc verified whatsapp failed:', whatsAppErr.message);
        }

        return res.json({ success: true, record, tenant });
    } catch (err) {
        console.error('tenant/kyc/verify-otp error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
});

router.post('/tenant/kyc/digilocker/start', otpLimiter, async (req, res) => {
    try {
        const { loginId, aadhaarLinkedPhone, aadhaarNumber, aadhaarFront, aadhaarBack, redirectUrl: clientRedirectUrl } = req.body || {};
        if (!loginId || !aadhaarNumber) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }
        if (!/^\d{12}$/.test(String(aadhaarNumber))) {
            return res.status(400).json({ success: false, message: 'Aadhaar must be 12 digits' });
        }
        const normalizedLoginId = String(loginId).toUpperCase();
        const ref = createDigilockerRef(normalizedLoginId);
        const redirectUrl = clientRedirectUrl || process.env.DIGILOCKER_REDIRECT_URL || `${DIGITAL_CHECKIN_URL}/digital-checkin/tenantkyc`;

        const accountCheck = await verifyDigilockerAccount({
            verificationId: ref,
            mobileNumber: aadhaarLinkedPhone,
            aadhaarNumber
        });
        const userFlow = accountCheck?.account_exists ? 'signin' : 'signup';
        const digilockerInit = await createDigilockerUrl({
            verificationId: ref,
            redirectUrl,
            userFlow,
            documents: ['AADHAAR']
        });

        const cashfreeVerificationId = digilockerInit?.verification_id || ref;
        const cashfreeReferenceId = digilockerInit?.reference_id || digilockerInit?.ref_id || '';
        const verifyUrl = digilockerInit?.url || digilockerInit?.verification_url || digilockerInit?.link || '';

        await upsertRecord(normalizedLoginId, 'tenant', {
            tenantKyc: {
                aadhaarLinkedPhone: aadhaarLinkedPhone || '',
                aadhaarNumber: String(aadhaarNumber),
                aadhaarFront: aadhaarFront || null,
                aadhaarBack: aadhaarBack || null,
                otpVerified: false,
                digilockerVerified: false,
                digilockerStatus: 'pending',
                digilockerRef: ref,
                digilockerVerificationId: cashfreeVerificationId,
                digilockerReferenceId: cashfreeReferenceId,
                digilockerUrl: verifyUrl,
                digilockerStartedAt: new Date()
            }
        });

        const tenant = await Tenant.findOne({ loginId: normalizedLoginId });
        if (!tenant) {
            return res.status(404).json({ success: false, message: 'Tenant not found for this login ID' });
        }

        tenant.kyc = tenant.kyc || {};
        tenant.kyc.aadhaarNumber = String(aadhaarNumber);
        tenant.kyc.aadhar = String(aadhaarNumber);
        tenant.kyc.aadhaarLinkedPhone = aadhaarLinkedPhone || '';
        tenant.kyc.aadhaarFront = aadhaarFront || tenant.kyc.aadhaarFront || null;
        tenant.kyc.aadhaarBack = aadhaarBack || tenant.kyc.aadhaarBack || null;
        tenant.kyc.otpVerified = false;
        tenant.kyc.digilockerVerified = false;
        tenant.kycStatus = 'submitted';
        tenant.digitalCheckin = tenant.digitalCheckin || {};
        tenant.digitalCheckin.kyc = {
            ...(tenant.digitalCheckin.kyc || {}),
            aadhaarLinkedPhone: aadhaarLinkedPhone || '',
            aadhaarNumber: String(aadhaarNumber),
            aadhaarFront: aadhaarFront || tenant.digitalCheckin?.kyc?.aadhaarFront || null,
            aadhaarBack: aadhaarBack || tenant.digitalCheckin?.kyc?.aadhaarBack || null,
            digilockerRef: ref,
            digilockerVerificationId: cashfreeVerificationId,
            digilockerReferenceId: cashfreeReferenceId,
            digilockerUrl: verifyUrl,
            digilockerStatus: 'pending',
            digilockerVerified: false
        };
        await tenant.save();

        return res.json({
            success: true,
            provider: 'digilocker',
            referenceId: cashfreeReferenceId || ref,
            verificationId: cashfreeVerificationId,
            verifyUrl,
            userFlow,
            message: 'DigiLocker verification initiated. Complete DigiLocker auth and return to this page.'
        });
    } catch (err) {
        console.error('tenant/kyc/digilocker/start error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
});

router.post('/tenant/kyc/digilocker/complete', otpLimiter, async (req, res) => {
    try {
        const { loginId, aadhaarNumber, referenceId, verificationId } = req.body || {};
        if (!loginId || !aadhaarNumber || (!referenceId && !verificationId)) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }
        const normalizedLoginId = String(loginId).toUpperCase();
        const record = await CheckinRecord.findOne({ loginId: normalizedLoginId, role: 'tenant' });
        if (!record || !record.tenantKyc) {
            return res.status(404).json({ success: false, message: 'Tenant KYC record not found' });
        }
        if (String(record.tenantKyc.aadhaarNumber || '') !== String(aadhaarNumber)) {
            return res.status(400).json({ success: false, message: 'Aadhaar mismatch' });
        }
        const storedVerificationId = record.tenantKyc.digilockerVerificationId || record.tenantKyc.digilockerRef;
        const storedReferenceId = record.tenantKyc.digilockerReferenceId || record.tenantKyc.digilockerRef;
        const checkVerificationId = verificationId || storedVerificationId;
        const checkReferenceId = referenceId || storedReferenceId;
        if (!checkVerificationId && !checkReferenceId) {
            return res.status(400).json({ success: false, message: 'Missing DigiLocker verification context' });
        }

        const statusResp = await getDigilockerVerificationStatus({
            verificationId: checkVerificationId,
            referenceId: checkReferenceId
        });
        const verificationStatus = String(
            statusResp?.status ||
            statusResp?.verification_status ||
            statusResp?.data?.status ||
            ''
        ).toUpperCase();
        const validStatuses = ['AUTHENTICATED', 'SUCCESS', 'COMPLETED', 'VERIFIED'];
        if (!validStatuses.includes(verificationStatus)) {
            return res.status(400).json({
                success: false,
                message: `DigiLocker verification not completed yet (status: ${verificationStatus || 'PENDING'})`
            });
        }

        let aadhaarDocument = null;
        try {
            aadhaarDocument = await getDigilockerDocument({
                documentType: 'AADHAAR',
                verificationId: checkVerificationId,
                referenceId: checkReferenceId
            });
        } catch (docErr) {
            console.warn('tenant digilocker document fetch warning:', docErr.message);
        }

        record.tenantKyc.digilockerVerified = true;
        record.tenantKyc.digilockerStatus = 'verified';
        record.tenantKyc.digilockerVerifiedAt = new Date();
        record.tenantKyc.digilockerVerificationId = checkVerificationId || '';
        record.tenantKyc.digilockerReferenceId = checkReferenceId || '';
        if (aadhaarDocument) {
            record.tenantKyc.digilockerDocument = aadhaarDocument;
        }
        await record.save();

        const tenant = await Tenant.findOne({ loginId: normalizedLoginId });
        if (!tenant) {
            return res.status(404).json({ success: false, message: 'Tenant not found for this login ID' });
        }
        tenant.kyc = tenant.kyc || {};
        tenant.kyc.digilockerVerified = true;
        tenant.kyc.digilockerVerifiedAt = new Date();
        tenant.kyc.otpVerified = Boolean(tenant.kyc.otpVerified);
        tenant.kycStatus = 'verified';
        tenant.digitalCheckin = tenant.digitalCheckin || {};
        tenant.digitalCheckin.kyc = {
            ...(tenant.digitalCheckin.kyc || {}),
            digilockerVerified: true,
            digilockerVerifiedAt: new Date(),
            digilockerStatus: 'verified',
            digilockerVerificationId: checkVerificationId || '',
            digilockerReferenceId: checkReferenceId || ''
        };
        await tenant.save();

        try {
            await sendTemplateToResolvedUser({
                phone: tenant.phone || tenant.kyc?.aadhaarLinkedPhone || '',
                email: tenant.email || '',
                userId: normalizedLoginId,
                templateName: 'roomhy_kyc_verified',
                variables: [tenant.name || 'Tenant']
            });
        } catch (whatsAppErr) {
            console.warn('tenant digilocker verified whatsapp failed:', whatsAppErr.message);
        }

        return res.json({ success: true, message: 'DigiLocker verification completed successfully', verificationStatus, record, tenant });
    } catch (err) {
        console.error('tenant/kyc/digilocker/complete error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
});

router.post('/tenant/agreement', async (req, res) => {
    try {
        const { loginId, eSignName, accepted, signatureDataUrl } = req.body || {};
        if (!loginId || !eSignName || accepted !== true || !signatureDataUrl) {
            return res.status(400).json({ success: false, message: 'Agreement acceptance, e-sign, and tenant signature are required' });
        }
        const normalizedLoginId = String(loginId).toUpperCase();
        const acceptedAt = new Date();
        const existingRecord = await CheckinRecord.findOne({ loginId: normalizedLoginId, role: 'tenant' }).lean();
        let record = await upsertRecord(normalizedLoginId, 'tenant', {
            tenantAgreement: {
                ...((existingRecord && existingRecord.tenantAgreement) || {}),
                eSignName,
                acceptedAt,
                signatureDataUrl,
                provider: 'roomhy-esign',
                status: 'signed',
                signedAt: acceptedAt,
                completedAt: acceptedAt
            }
        });

        const tenant = await Tenant.findOne({ loginId: normalizedLoginId });
        if (!tenant) {
            return res.status(404).json({ success: false, message: 'Tenant not found for this login ID' });
        }
        const kycVerified = Boolean(
            record?.tenantKyc?.otpVerified ||
            record?.tenantKyc?.digilockerVerified ||
            tenant?.kyc?.otpVerified ||
            tenant?.kyc?.digilockerVerified ||
            tenant?.kycStatus === 'verified'
        );
        if (!kycVerified) {
            return res.status(400).json({ success: false, message: 'Complete tenant KYC verification first' });
        }

        tenant.agreementESignName = eSignName;
        tenant.digitalCheckin = tenant.digitalCheckin || {};
        tenant.digitalCheckin.agreement = {
            ...(tenant.digitalCheckin.agreement || {}),
            eSignName,
            acceptedAt,
            signatureDataUrl
        };
        tenant.agreementSigned = true;
        tenant.agreementSignedAt = acceptedAt;
        tenant.agreementStatus = 'signed';
        tenant.updatedAt = new Date();
        await tenant.save();
        const completion = await completeTenantAgreementAndNotify(normalizedLoginId, {
            requestId: '',
            provider: 'roomhy-esign',
            callbackPayload: { source: 'roomhy-custom-esign' }
        });
        record = completion.record;

        return res.json({
            success: true,
            message: 'Tenant rental agreement completed successfully.',
            record,
            tenant: completion.tenant,
            agreementStatus: 'signed',
            provider: 'roomhy-esign',
            nextUrl: `${DIGITAL_CHECKIN_URL}/digital-checkin/tenant-confirmation?loginId=${encodeURIComponent(normalizedLoginId)}&agreementSigned=1`
        });
    } catch (err) {
        console.error('tenant/agreement error:', err);
        return res.status(err.status || 500).json({
            success: false,
            message: err?.data?.message || err?.data?.error || err.message || 'Tenant agreement request failed',
            details: err?.data || null
        });
    }
});

router.post('/tenant/final-submit', async (req, res) => {
    try {
        const { loginId } = req.body || {};
        if (!loginId) return res.status(400).json({ success: false, message: 'Missing loginId' });
        const normalizedLoginId = String(loginId).toUpperCase();
        const record = await CheckinRecord.findOne({ loginId: normalizedLoginId, role: 'tenant' });
        if (!record) return res.status(404).json({ success: false, message: 'Tenant check-in record not found' });
        const tenantModel = await Tenant.findOne({ loginId: normalizedLoginId });
        if (!record.tenantAgreement || !record.tenantAgreement.acceptedAt) {
            return res.status(400).json({ success: false, message: 'Accept rental agreement first' });
        }
        if (record.tenantAgreement?.status !== 'signed' && !(tenantModel && tenantModel.agreementSigned)) {
            return res.status(400).json({ success: false, message: 'Tenant rental agreement signature is still pending' });
        }

        const result = await completeTenantAgreementAndNotify(normalizedLoginId, {
            requestId: record.tenantAgreement?.requestId || tenantModel?.agreementRequestId || '',
            provider: record.tenantAgreement?.provider || tenantModel?.agreementStatus || 'zoho-sign',
            callbackPayload: { source: 'tenant-final-submit' }
        });

        return res.json({
            success: true,
            message: 'Tenant digital check-in submitted',
            ...result
        });
    } catch (err) {
        console.error('tenant/final-submit error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
});

router.post('/tenant/agreement/complete', async (req, res) => {
    try {
        const { loginId, requestId, provider, callbackPayload } = req.body || {};
        if (!loginId) {
            return res.status(400).json({ success: false, message: 'Missing loginId' });
        }
        const result = await completeTenantAgreementAndNotify(loginId, {
            requestId,
            provider,
            callbackPayload
        });
        return res.json({
            success: true,
            message: 'Tenant agreement completed',
            ...result
        });
    } catch (err) {
        console.error('tenant/agreement/complete error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
});

async function handleTenantAgreementCallback(req, res) {
    try {
        const payload = {
            ...(req.query || {}),
            ...(req.body || {})
        };
        const loginId = payload.loginId || payload.loginid || payload.tenantLoginId || payload.tenant_login_id || '';
        const requestId = payload.requestId || payload.request_id || payload.document_id || payload.documentId || '';
        const status = String(payload.status || payload.action_status || payload.request_status || 'completed').toLowerCase();

        console.log('[ZOHO CALLBACK] tenant agreement callback received', {
            method: req.method,
            loginId,
            requestId,
            status
        });

        if (!loginId) {
            return res.status(400).send('Missing loginId');
        }

        if (!['completed', 'complete', 'signed', 'success'].includes(status)) {
            return res.redirect(`${DIGITAL_CHECKIN_URL}/digital-checkin/tenant-confirmation?loginId=${encodeURIComponent(String(loginId).toUpperCase())}&agreementPending=1`);
        }

        await completeTenantAgreementAndNotify(loginId, {
            requestId,
            provider: 'zoho-sign',
            callbackPayload: payload
        });

        return res.redirect(`${DIGITAL_CHECKIN_URL}/digital-checkin/tenant-confirmation?loginId=${encodeURIComponent(String(loginId).toUpperCase())}&agreementSigned=1`);
    } catch (err) {
        console.error('tenant/agreement/callback error:', err);
        return res.status(500).send(err.message);
    }
}

router.get('/tenant/agreement/callback', handleTenantAgreementCallback);
router.post('/tenant/agreement/callback', handleTenantAgreementCallback);

// GET /tenant/prefill/:loginId — returns Tenant model fields the owner filled during room assignment.
// Frontend uses this to pre-populate the digital check-in profile form and lock those fields.
router.get('/tenant/prefill/:loginId', async (req, res) => {
    try {
        const normalizedLoginId = String(req.params.loginId || '').toUpperCase();
        if (!normalizedLoginId) return res.status(400).json({ success: false, message: 'loginId required' });

        const tenant = await Tenant.findOne({ loginId: normalizedLoginId }).lean();
        if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found' });

        // Fetch owner name using ownerLoginId
        let ownerName = '';
        if (tenant.ownerLoginId) {
            try {
                const owner = await Owner.findOne({ loginId: String(tenant.ownerLoginId).toUpperCase() })
                    .select('name profile').lean();
                ownerName = owner?.name || owner?.profile?.name || '';
            } catch (_) {}
        }

        // Structured map of every field the owner fills when assigning a room to the tenant
        const prefillData = {
            name:                   tenant.name || '',
            email:                  tenant.email || '',
            tenantPhone:            tenant.phone || '',
            dob:                    tenant.dob || '',
            guardianNumber:         tenant.guardianNumber || '',
            moveInDate:             tenant.moveInDate ? new Date(tenant.moveInDate).toISOString().slice(0, 10) : '',
            agreedRent:             tenant.agreedRent            ? `INR ${tenant.agreedRent}` : '',
            securityDepositTotal:   tenant.securityDepositTotal  ? `INR ${tenant.securityDepositTotal}` : '',
            securityDepositPaid:    tenant.securityDepositPaid   ? `INR ${tenant.securityDepositPaid}` : '',
            securityDepositBalance: tenant.securityDepositBalance ? `INR ${tenant.securityDepositBalance}` : '',
            electricityCharge:      tenant.electricityCharge     ? `INR ${tenant.electricityCharge}` : '',
            maintenanceCharge:      tenant.maintenanceCharge     ? `INR ${tenant.maintenanceCharge}` : '',
            propertyName:           tenant.propertyTitle || '',
            roomNo:                 tenant.roomNo || '',
            ownerName:              ownerName,
            licenseStartDate:       tenant.moveInDate ? new Date(tenant.moveInDate).toISOString().slice(0, 10) : '',
            securityDeposit:        tenant.securityDepositTotal  ? `INR ${tenant.securityDepositTotal}` : '',
        };

        // Only flag fields that actually have a value as owner-filled (so empty fields remain editable)
        const ownerFilledFields = Object.keys(prefillData).filter(k => {
            const v = prefillData[k];
            return v !== '' && v !== null && v !== undefined;
        });

        return res.json({ success: true, prefillData, ownerFilledFields });
    } catch (err) {
        console.error('[tenant/prefill] error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
});

router.get('/:role/:loginId', async (req, res) => {
    try {
        const { role, loginId } = req.params;
        if (!ensureRole(role)) return res.status(400).json({ success: false, message: 'Invalid role' });
        const record = await CheckinRecord.findOne({ loginId: String(loginId).toUpperCase(), role }).lean();
        return res.json({ success: true, record: record || null });
    } catch (err) {
        console.error('checkin get error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
