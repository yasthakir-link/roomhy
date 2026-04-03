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
const { requestAadhaarOtp, verifyAadhaarOtp } = require('../services/cashfreeKycService');
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

function buildOwnerLoginEmail(owner, dashboardUrl) {
    return `
        <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
            <div style="background:#1d4ed8;color:#fff;padding:18px 20px;">
                <h2 style="margin:0;font-size:20px;">RoomHy Owner Login Ready</h2>
            </div>
            <div style="padding:18px 20px;color:#111827;line-height:1.55;">
                <p style="margin-top:0;">Your owner profile, DigiLocker Aadhaar verification, and agreement signing are complete.</p>
                <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:14px 16px;margin:14px 0;">
                    <p style="margin:0 0 8px;"><strong>Login ID:</strong> ${owner.loginId || '-'}</p>
                    <p style="margin:0 0 8px;"><strong>Password:</strong> ${owner.checkinPassword || owner.credentials?.password || '-'}</p>
                    <p style="margin:0;"><strong>Email:</strong> ${owner.email || '-'}</p>
                </div>
                <p style="margin:14px 0 18px;">
                    <a href="${dashboardUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;font-weight:700;">Open Owner Login</a>
                </p>
                <p style="font-size:12px;color:#6b7280;">If button does not work, copy this link: ${dashboardUrl}</p>
            </div>
        </div>
    `;
}

function buildTenantLoginEmail(tenant, dashboardUrl) {
    return `
        <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
            <div style="background:#16a34a;color:#fff;padding:16px 20px;">
                <h2 style="margin:0;font-size:20px;">RoomHy Tenant Check-in Completed</h2>
            </div>
            <div style="padding:18px 20px;color:#111827;line-height:1.55;">
                <p style="margin-top:0;">Your tenant digital check-in and rental agreement signing are complete.</p>
                <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px 16px;margin:14px 0;">
                    <p style="margin:0 0 8px;"><strong>Login ID:</strong> ${tenant.loginId || '-'}</p>
                    <p style="margin:0 0 8px;"><strong>Email:</strong> ${tenant.email || '-'}</p>
                    <p style="margin:0;"><strong>Property:</strong> ${tenant.propertyTitle || '-'}</p>
                </div>
                <p style="margin:14px 0 18px;">
                    <a href="${dashboardUrl}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;font-weight:700;">Open Tenant Login</a>
                </p>
                <p style="font-size:12px;color:#6b7280;">If button does not work, copy this link: ${dashboardUrl}</p>
            </div>
        </div>
    `;
}

function generateTenantAgreementPdfBuffer(tenant, record = {}) {
    return new Promise((resolve, reject) => {
        try {
            const agreement = record?.tenantAgreement || {};
            const profile = tenant?.digitalCheckin?.profile || {};
            const propertyName = tenant.propertyTitle || profile.propertyName || 'RoomHy Property';
            const tenantName = tenant.name || profile.name || 'Tenant';
            const moveInDate = tenant.moveInDate ? new Date(tenant.moveInDate).toISOString().slice(0, 10) : (profile.moveInDate || '-');
            const signedDate = agreement.signedAt ? new Date(agreement.signedAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
            const aadhaarNumber = tenant?.kyc?.aadhaarNumber || tenant?.kyc?.aadhar || record?.tenantKyc?.aadhaarNumber || '-';
            const securityDepositTotal = tenant.securityDepositTotal || profile.securityDepositTotal || 0;
            const securityDepositPaid = tenant.securityDepositPaid || profile.securityDepositPaid || 0;
            const securityDepositBalance = tenant.securityDepositBalance || profile.securityDepositBalance || 0;
            const electricityCharge = tenant.electricityCharge || profile.electricityCharge || 0;
            const maintenanceCharge = tenant.maintenanceCharge || profile.maintenanceCharge || 0;
            const eSignName = tenant.agreementESignName || agreement.eSignName || tenantName;
            const signatureDataUrl = agreement.signatureDataUrl || tenant?.digitalCheckin?.agreement?.signatureDataUrl || '';
            const logoPath = path.join(__dirname, '../../react-app/public/website/images/logoroomhy.jpg');
            let signatureBuffer = null;

            if (signatureDataUrl.startsWith('data:image/')) {
                const base64Part = signatureDataUrl.split(',')[1] || '';
                if (base64Part) {
                    signatureBuffer = Buffer.from(base64Part, 'base64');
                }
            }

            const doc = new PDFDocument({ size: 'A4', margin: 44 });
            const chunks = [];
            doc.on('data', (chunk) => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            const left = doc.page.margins.left;
            const right = doc.page.width - doc.page.margins.right;
            const pageWidth = right - left;
            const currency = (value) => `Rs ${Number(value || 0)}`;
            const drawField = (label, value) => {
                doc.font('Helvetica-Bold').fontSize(10).fillColor('#0f172a').text(`${label}: `, { continued: true });
                doc.font('Helvetica').fontSize(10).fillColor('#334155').text(String(value || '-'));
                doc.moveDown(0.35);
            };

            doc.roundedRect(left, 32, pageWidth, 92, 18).fillAndStroke('#eff6ff', '#bfdbfe');
            try {
                doc.image(logoPath, left + 16, 48, { fit: [140, 56], align: 'left', valign: 'center' });
            } catch (_) {}
            doc.font('Helvetica-Bold').fontSize(20).fillColor('#0f172a').text('LICENCE & SUBSCRIPTION AGREEMENT', left + 180, 50, {
                width: pageWidth - 196,
                align: 'left'
            });
            doc.font('Helvetica').fontSize(10).fillColor('#475569').text('RoomHy rental agreement with digital signature record', left + 180, 78, {
                width: pageWidth - 196,
                align: 'left'
            });
            doc.roundedRect(right - 126, 44, 110, 38, 12).fillAndStroke('#ffffff', '#1d4ed8');
            doc.font('Helvetica-Bold').fontSize(12).fillColor('#1d4ed8').text('ROOMHY', right - 112, 54, { width: 82, align: 'center' });
            doc.font('Helvetica-Bold').fontSize(7).fillColor('#1d4ed8').text('DIGITAL SEAL', right - 110, 69, { width: 78, align: 'center' });
            doc.y = 144;

            doc.font('Helvetica').fontSize(11).fillColor('#334155').text(
                `This License & Subscription Agreement is executed between RoomHy and ${tenantName}. The tenant occupies the allotted premises for residential purposes subject to the conditions below.`,
                left,
                doc.y,
                { width: pageWidth, lineGap: 2 }
            );
            doc.moveDown(1.1);

            const clauses = [
                '1. TERM: As per Annexure A.',
                '2. PREMISES: As per Annexure A.',
                '3. LICENSE FEE / RENT: As per Annexure A. Rent is payable in advance on or before the due date.',
                '4. REFUNDABLE SECURITY DEPOSIT: As per Annexure A. Refund is processed after applicable deductions for dues or damages.',
                '5. MINIMUM STAY DURATION: As per Annexure A. Early move-out before minimum stay may lead to deposit withholding.',
                '6. LIMITED LICENSE: Tenant receives a limited right to use the premises subject to compliance and timely payments.',
                '7. RENT DEFAULT: Delayed or unpaid rent may result in lockout, penalties, restricted services, and termination.',
                '8. TERMINATION WITHOUT CAUSE: Either party may terminate subject to lock-in and notice requirements.',
                '9. TERMINATION FOR CAUSE: RoomHy may terminate for illegal activity, non-payment, damage, nuisance, or policy breach.',
                '10. MAINTENANCE OF PREMISES: Tenant must maintain the premises and is liable for damages beyond ordinary wear and tear.',
                '11. RENEWAL: Renewal may occur with revised rent or updated terms based on market conditions.',
                '12. NOTICES: Notices may be sent by email or physical delivery.',
                '13. ENTIRE AGREEMENT: This document and Annexure A form the complete agreement between parties.',
                '14. SEVERABILITY: Invalidity of one clause does not affect the balance of the agreement.',
                '15. GOVERNING LAW & JURISDICTION: Laws of India apply and jurisdiction lies where the premises are situated.',
                '16. ASSIGNING OF RECEIVABLES: RoomHy may assign receivables under this agreement.',
                '17. STAMP DUTY: Any applicable stamp duty responsibility lies with the tenant.',
                '18. OTHER TERMS & CONDITIONS: RoomHy policies may be updated from time to time.'
            ];

            doc.font('Helvetica').fontSize(10).fillColor('#111827');
            clauses.forEach((line) => {
                doc.text(line, left, doc.y, { width: pageWidth, lineGap: 2 });
                doc.moveDown(0.4);
            });

            doc.moveDown(0.4);
            const annexureTop = doc.y;
            const annexureHeight = 200;
            doc.roundedRect(left, annexureTop, pageWidth, annexureHeight, 16).fillAndStroke('#f8fafc', '#dbeafe');
            doc.font('Helvetica-Bold').fontSize(14).fillColor('#0f172a').text('ANNEXURE A', left + 18, annexureTop + 16);
            doc.y = annexureTop + 42;

            const leftColX = left + 18;
            const rightColX = left + pageWidth / 2 + 8;
            const fieldWidth = pageWidth / 2 - 32;
            const rows = [
                ['Name of Tenant', tenantName, 'Property Name', propertyName],
                ['Tenant Email', tenant.email || '-', 'Room Number', tenant.roomNo || profile.roomNo || '-'],
                ['Tenant Phone', tenant.phone || '-', 'Monthly Rent', currency(tenant.agreedRent || profile.agreedRent || 0)],
                ['Tenant Aadhaar', aadhaarNumber, 'License Start Date', moveInDate],
                ['Security Deposit Total', currency(securityDepositTotal), 'Security Deposit Paid', currency(securityDepositPaid)],
                ['Security Deposit Balance', currency(securityDepositBalance), 'Electricity Charge', currency(electricityCharge)],
                ['Maintenance Charge', currency(maintenanceCharge), 'Minimum Stay Duration', '3 Months']
            ];

            rows.forEach(([l1, v1, l2, v2]) => {
                const rowY = doc.y;
                doc.font('Helvetica-Bold').fontSize(9).fillColor('#475569').text(l1, leftColX, rowY, { width: fieldWidth });
                doc.font('Helvetica').fontSize(10).fillColor('#0f172a').text(String(v1 || '-'), leftColX, rowY + 12, { width: fieldWidth });
                doc.font('Helvetica-Bold').fontSize(9).fillColor('#475569').text(l2, rightColX, rowY, { width: fieldWidth });
                doc.font('Helvetica').fontSize(10).fillColor('#0f172a').text(String(v2 || '-'), rightColX, rowY + 12, { width: fieldWidth });
                doc.y = rowY + 34;
            });

            doc.y = annexureTop + annexureHeight + 20;

            if (doc.y > 680) doc.addPage();
            doc.roundedRect(left, doc.y, pageWidth, 112, 16).fillAndStroke('#ffffff', '#e2e8f0');
            const signatureCardTop = doc.y;
            doc.font('Helvetica-Bold').fontSize(12).fillColor('#0f172a').text('Digital Signature', left + 18, signatureCardTop + 16);
            doc.font('Helvetica').fontSize(10).fillColor('#475569').text(`Signed by ${eSignName} on ${signedDate}`, left + 18, signatureCardTop + 34);

            if (signatureBuffer) {
                const signatureTop = signatureCardTop + 52;
                doc.font('Helvetica').fontSize(9).fillColor('#64748b').text('Tenant Signature', left + 18, signatureTop - 10);
                doc
                    .moveTo(left + 18, signatureTop + 44)
                    .lineTo(left + 198, signatureTop + 44)
                    .lineWidth(1)
                    .strokeColor('#94a3b8')
                    .stroke();
                doc.image(signatureBuffer, left + 18, signatureTop, {
                    fit: [170, 34],
                    align: 'left',
                    valign: 'center'
                });
            } else {
                doc
                    .moveTo(left + 18, signatureCardTop + 96)
                    .lineTo(left + 198, signatureCardTop + 96)
                    .lineWidth(1)
                    .strokeColor('#94a3b8')
                    .stroke();
            }

            doc
                .roundedRect(right - 156, signatureCardTop + 28, 128, 54, 14)
                .fillAndStroke('#eff6ff', '#1d4ed8');
            try {
                doc.image(logoPath, right - 142, signatureCardTop + 37, { fit: [100, 22], align: 'center', valign: 'center' });
            } catch (_) {
                doc.font('Helvetica-Bold').fontSize(14).fillColor('#1d4ed8').text('ROOMHY', right - 130, signatureCardTop + 44, { width: 90, align: 'center' });
            }
            doc.font('Helvetica-Bold').fontSize(8).fillColor('#1d4ed8').text('APPROVED DIGITAL SEAL', right - 144, signatureCardTop + 62, { width: 104, align: 'center' });
            doc.y = signatureCardTop + 128;

            doc.font('Helvetica').fontSize(9).fillColor('#64748b').text(
                `Agreement reference: ${tenant.loginId || tenantName} | Generated by RoomHy digital check-in`,
                left,
                doc.y,
                { width: pageWidth, align: 'center' }
            );

            doc.end();
        } catch (error) {
            reject(error);
        }
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
    if (tenant.email) {
        try {
            const agreementPdfBuffer = await generateTenantAgreementPdfBuffer(tenant, record);
            await sendMail(
                tenant.email,
                'RoomHy Tenant Agreement & Login Details',
                '',
                `${buildTenantLoginEmail(tenant, dashboardUrl)}${buildTenantAgreementHtml(tenant, record)}`,
                {
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

    try {
        await sendTemplateToResolvedUser({
            phone: tenant.phone || '',
            email: tenant.email || '',
            userId: tenant.loginId || '',
            templateName: 'roomhy_tenant_checkin_complete',
            variables: [tenant.name || 'Tenant', tenant.loginId || '', tenantLoginUrl]
        });
    } catch (whatsAppErr) {
        console.error('[TENANT AGREEMENT COMPLETE] WhatsApp send error:', whatsAppErr.message);
    }

    try {
        await sendDocumentToResolvedUser({
            phone: tenant.phone || '',
            email: tenant.email || '',
            userId: tenant.loginId || '',
            link: `${BACKEND_URL}/api/checkin/tenant/agreement/pdf/${encodeURIComponent(normalizedLoginId)}`,
            filename: `RoomHy-Tenant-Agreement-${tenant.loginId || normalizedLoginId}.pdf`,
            caption: `RoomHy tenant agreement PDF for ${tenant.name || normalizedLoginId}`
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
        otpStore.set(k, { referenceId, expiresAt: Date.now() + 10 * 60 * 1000 });

        try {
            await sendTemplateToResolvedUser({
                phone: aadhaarLinkedPhone,
                email: owner.email || email || '',
                userId: String(loginId || '').toUpperCase(),
                templateName: 'roomhy_otp_verification',
                variables: [raw?.mockOtp || 'OTP Sent', '10']
            });
        } catch (whatsAppErr) {
            console.warn('owner kyc send otp whatsapp failed:', whatsAppErr.message);
        }

        return res.json({
            success: true,
            message: 'OTP sent to Aadhaar linked mobile number',
            provider: 'cashfree',
            mockOtp: raw?.mockOtp || undefined
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
        await verifyAadhaarOtp(entry.referenceId, otp);
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

        // Send login credentials email
        if (owner && owner.email) {
            const baseUrl = APP_URL;
            const ownerPassword = owner.checkinPassword || owner.credentials?.password || 'default';
            const fullLoginUrl = `${baseUrl}/propertyowner/index`;
            
            const emailHtml = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <style>
                        body { font-family: 'Arial', sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; }
                        .header { background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
                        .header h1 { margin: 0; font-size: 28px; }
                        .content { padding: 30px; background: #f8fafc; }
                        .credentials { background: white; border-left: 4px solid #4caf50; padding: 15px; margin: 20px 0; border-radius: 4px; }
                        .credentials p { margin: 8px 0; }
                        .label { font-weight: bold; color: #333; }
                        .value { font-family: monospace; color: #2563eb; }
                        .button { display: inline-block; background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; margin-top: 15px; font-weight: bold; }
                        .footer { text-align: center; padding: 20px; font-size: 12px; color: #999; border-top: 1px solid #eee; }
                        .success { color: #4caf50; font-weight: bold; font-size: 18px; margin-bottom: 15px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>✓ KYC Verified Successfully!</h1>
                        </div>
                        <div class="content">
                            <p>Hi <strong>${owner.name || 'Owner'}</strong>,</p>
                            
                            <div class="success">🎉 Your Aadhaar verification is complete!</div>
                            
                            <p>Your RoomHy owner account has been activated. You can now log in to manage your properties and respond to tenant inquiries.</p>
                            
                            <div class="credentials">
                                <p><span class="label">Login ID:</span> <span class="value">${owner.loginId}</span></p>
                                <p><span class="label">Password:</span> <span class="value">${owner.checkinPassword || owner.credentials?.password || '[Set during registration]'}</span></p>
                                <p><span class="label">Email:</span> <span class="value">${owner.email}</span></p>
                                <p><span class="label">Area:</span> <span class="value">${owner.checkinArea || '-'}</span></p>
                            </div>

                            <p style="color: #d32f2f; font-weight: bold;">⚠️ Important:</p>
                            <ul>
                                <li>Keep your login credentials secure</li>
                                <li>You can change your password after first login</li>
                                <li>For security, sign out from shared devices</li>
                            </ul>

                            <p style="margin-top: 20px;">
                                <a href="${fullLoginUrl}" class="button">🔓 Go to Owner Dashboard</a>
                            </p>

                            <p style="margin-top: 20px; font-size: 12px;">
                                Or copy and paste this link in your browser:<br>
                                <span class="value">${fullLoginUrl}</span>
                            </p>

                            <p>What's next?</p>
                            <ol>
                                <li>Log in to your owner dashboard</li>
                                <li>Add your property details</li>
                                <li>Complete bank account verification</li>
                                <li>Start receiving tenant inquiries!</li>
                            </ol>

                            <p>If you have any questions or need support, contact us at <strong>support@roomhy.com</strong></p>
                        </div>
                        <div class="footer">
                            <p>&copy; 2025 RoomHy Owner Platform. All rights reserved.</p>
                            <p>Made with ❤️ for property owners in India</p>
                        </div>
                    </div>
                </body>
                </html>
            `;

            try {
                await sendMail(owner.email, '✓ Welcome to RoomHy Owner Platform - Your login details', '', emailHtml);
                console.log('[CHECKIN KYC] Sent login email to:', owner.email);
            } catch (emailErr) {
                console.error('[CHECKIN KYC] Email send error:', emailErr.message);
            }
        }

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
            maintenanceCharge
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
                maintenanceCharge: maintenanceCharge || 0
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

        const { referenceId, raw } = await requestAadhaarOtp(aadhaarNumber);
        const k = keyFor('tenant', normalizedLoginId, aadhaarNumber);
        otpStore.set(k, { referenceId, expiresAt: Date.now() + 10 * 60 * 1000 });
        console.log('[CHECKIN OTP] tenant', normalizedLoginId, aadhaarNumber, 'Cashfree OTP requested');

        try {
            await sendTemplateToResolvedUser({
                phone: aadhaarLinkedPhone,
                email: tenant.email || '',
                userId: normalizedLoginId,
                templateName: 'roomhy_otp_verification',
                variables: [raw?.mockOtp || 'OTP Sent', '10']
            });
        } catch (whatsAppErr) {
            console.warn('tenant kyc send otp whatsapp failed:', whatsAppErr.message);
        }

        try {
            await sendTemplateToResolvedUser({
                phone: tenant.phone || aadhaarLinkedPhone || '',
                email: tenant.email || '',
                userId: normalizedLoginId,
                templateName: 'roomhy_kyc_pending',
                variables: [
                    tenant.name || 'Tenant',
                    `${DIGITAL_CHECKIN_URL}/digital-checkin/tenantkyc?loginId=${encodeURIComponent(normalizedLoginId)}`
                ]
            });
        } catch (whatsAppErr) {
            console.warn('tenant kyc pending whatsapp failed:', whatsAppErr.message);
        }

        return res.json({
            success: true,
            message: 'OTP sent to Aadhaar linked mobile number',
            provider: 'cashfree',
            mockOtp: raw?.mockOtp || undefined
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
        await verifyAadhaarOtp(entry.referenceId, otp);
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
