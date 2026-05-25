const https = require('https');
const nodemailer = require('nodemailer');

function parseBooleanEnv(value, fallback = false) {
    if (typeof value === 'undefined' || value === null || value === '') return fallback;
    return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function getMailerConfig() {
    return {
        fromEmail: process.env.FROM_EMAIL || 'no-reply@roomhy.com',
        fromName: process.env.FROM_NAME || 'RoomHy',
        smtpHost: (process.env.SMTP_HOST || process.env.EMAIL_HOST || '').trim(),
        smtpPort: Number(process.env.SMTP_PORT || 587),
        smtpSecure: parseBooleanEnv(process.env.SMTP_SECURE, false),
        smtpUser: (process.env.SMTP_USER || '').trim(),
        smtpPass: (process.env.SMTP_PASS || process.env.EMAIL_PASS || '').replace(/\s+/g, ''),
        smtpDebug: parseBooleanEnv(process.env.SMTP_DEBUG, false),
        smtpLogger: parseBooleanEnv(process.env.SMTP_LOGGER, false),
        smtpRequireTls: parseBooleanEnv(process.env.SMTP_REQUIRE_TLS, false),
        smtpIgnoreTls: parseBooleanEnv(process.env.SMTP_IGNORE_TLS, false),
        smtpTlsRejectUnauthorized: parseBooleanEnv(process.env.SMTP_TLS_REJECT_UNAUTHORIZED, true),
        smtpConnectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT || 30000),
        smtpGreetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT || 30000),
        smtpSocketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT || 30000),
        smtpName: (process.env.SMTP_NAME || '').trim(),
        smtpService: (process.env.SMTP_SERVICE || '').trim(),
        whatsappAccessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
        whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
        whatsappApiVersion: process.env.WHATSAPP_API_VERSION || 'v21.0',
        whatsappDefaultCountryCode: process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || '91'
    };
}

function isSmtpConfigured(cfg) {
    return Boolean((cfg.smtpHost || cfg.smtpService) && cfg.smtpUser && cfg.smtpPass);
}

function isWhatsAppConfigured(cfg) {
    return Boolean(cfg.whatsappAccessToken && cfg.whatsappPhoneNumberId);
}


function normalizeRecipients(to) {
    if (!to) return [];
    if (Array.isArray(to)) {
        return to
            .map((x) => (x || '').toString().trim())
            .filter(Boolean)
            .map((email) => ({ Email: email }));
    }
    return to
        .toString()
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean)
        .map((email) => ({ Email: email }));
}

function postJson(urlString, body, headers = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(urlString);
        const payload = JSON.stringify(body);
        const req = https.request(
            {
                protocol: url.protocol,
                hostname: url.hostname,
                port: url.port || 443,
                path: `${url.pathname}${url.search}`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(payload),
                    ...headers
                }
            },
            (res) => {
                const chunks = [];
                res.on('data', (d) => chunks.push(d));
                res.on('end', () => {
                    resolve({
                        status: res.statusCode || 500,
                        body: Buffer.concat(chunks).toString('utf8')
                    });
                });
            }
        );
        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}

function getSmtpHint(err, cfg) {
    const message = String(err && err.message ? err.message : '');
    if (/535-5\.7\.8|username and password not accepted|badcredentials/i.test(message)) {
        if ((cfg.smtpHost || '').toLowerCase().includes('gmail')) {
            return 'Gmail rejected the SMTP login. Use a Gmail App Password, not the normal account password.';
        }
        return 'SMTP authentication failed. Check SMTP_USER and SMTP_PASS for the configured provider.';
    }
    return '';
}

function getWhatsAppHint(responseBody, cfg) {
    const body = String(responseBody || '');
    if (!body) return '';

    if (/Unsupported post request/i.test(body) || /cannot be loaded due to missing permissions/i.test(body)) {
        return 'Verify WHATSAPP_PHONE_NUMBER_ID is the numeric WhatsApp phone number ID, not the business account ID or another Graph object ID.';
    }

    if (/OAuthException|Invalid OAuth access token|permissions/i.test(body)) {
        return 'Verify WHATSAPP_ACCESS_TOKEN has whatsapp_business_messaging permission and is not expired.';
    }

    if (!cfg.whatsappPhoneNumberId) {
        return 'Set WHATSAPP_PHONE_NUMBER_ID in the environment.';
    }

    return '';
}

function normalizePhoneNumber(rawPhone, defaultCountryCode = '91') {
    if (!rawPhone) return '';
    const cleaned = String(rawPhone).trim().replace(/[^0-9+]/g, '');
    const digitsOnly = cleaned.replace(/\D/g, '');
    if (!digitsOnly) return '';

    if (digitsOnly.length === 10) {
        return `${defaultCountryCode}${digitsOnly}`;
    }

    if (digitsOnly.length === 11 && digitsOnly.startsWith('0')) {
        return `${defaultCountryCode}${digitsOnly.slice(1)}`;
    }

    if (digitsOnly.length >= 11 && digitsOnly.length <= 15) {
        return digitsOnly;
    }

    return '';
}

function stripHtmlTags(html) {
    return String(html || '')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<\/li>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\r/g, '')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function normalizeWhatsAppText(value, maxLength = 3900) {
    return String(value || '')
        .replace(/\r/g, '')
        .replace(/\u00a0/g, ' ')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n[ \t]+/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]{2,}/g, ' ')
        .trim()
        .slice(0, maxLength);
}

function buildWhatsAppMessage(subject, text, html) {
    const plain = normalizeWhatsAppText(String(text || '').trim() || stripHtmlTags(html), 3300);
    const heading = normalizeWhatsAppText(subject || 'RoomHy Notification', 250);
    const body = plain ? `${heading}\n\n${plain}` : heading;
    return normalizeWhatsAppText(body, 3900);
}

async function resolvePhoneByEmail(email) {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail) return '';

    try {
        const User = require('../models/user');
        const userDoc = await User.findOne({ email: normalizedEmail }).select('phone').lean();
        if (userDoc && userDoc.phone) return userDoc.phone;
    } catch (_) {}

    try {
        const Tenant = require('../models/Tenant');
        const tenantDoc = await Tenant.findOne({ email: normalizedEmail }).select('phone').lean();
        if (tenantDoc && tenantDoc.phone) return tenantDoc.phone;
    } catch (_) {}

    try {
        const Owner = require('../models/Owner');
        const ownerDoc = await Owner.findOne({
            $or: [{ email: normalizedEmail }, { 'profile.email': normalizedEmail }]
        }).select('phone profile.phone').lean();
        if (ownerDoc) {
            return ownerDoc.phone || (ownerDoc.profile && ownerDoc.profile.phone) || '';
        }
    } catch (_) {}

    try {
        const AreaManager = require('../models/AreaManager');
        const managerDoc = await AreaManager.findOne({ email: normalizedEmail }).select('phone').lean();
        if (managerDoc && managerDoc.phone) return managerDoc.phone;
    } catch (_) {}

    return '';
}

async function sendWhatsAppMessage(toPhone, body, cfg) {
    if (!toPhone || !body) return false;

    const endpoint = `https://graph.facebook.com/${cfg.whatsappApiVersion}/${cfg.whatsappPhoneNumberId}/messages`;
    const payload = {
        messaging_product: 'whatsapp',
        to: toPhone,
        type: 'text',
        text: {
            preview_url: false,
            body
        }
    };

    const response = await postJson(endpoint, payload, {
        Authorization: `Bearer ${cfg.whatsappAccessToken}`
    });

    if (response.status >= 200 && response.status < 300) {
        console.log('WhatsApp sent to', toPhone);
        return true;
    }

    console.warn('WhatsApp send failed:', response.status, response.body);
    const hint = getWhatsAppHint(response.body, cfg);
    if (hint) {
        console.warn('WhatsApp hint:', hint);
    }
    return false;
}

async function sendWhatsAppByEmailRecipients(recipients, subject, text, html, cfg) {
    if (!isWhatsAppConfigured(cfg) || !Array.isArray(recipients) || !recipients.length) {
        return 0;
    }

    const message = buildWhatsAppMessage(subject, text, html);
    const deliveredPhones = new Set();

    for (const recipient of recipients) {
        const email = recipient && recipient.Email ? recipient.Email : '';
        if (!email) continue;

        try {
            const resolvedPhone = await resolvePhoneByEmail(email);
            const toPhone = normalizePhoneNumber(resolvedPhone, cfg.whatsappDefaultCountryCode);
            if (!toPhone || deliveredPhones.has(toPhone)) continue;

            const delivered = await sendWhatsAppMessage(toPhone, message, cfg);
            if (delivered) deliveredPhones.add(toPhone);
        } catch (err) {
            console.warn('WhatsApp dispatch error for recipient', email, '-', err && err.message);
        }
    }

    return deliveredPhones.size;
}


function buildSmtpLabel(cfg) {
    if (cfg.smtpService) return `${cfg.smtpService} SMTP`;
    if (cfg.smtpHost) return `${cfg.smtpHost}:${cfg.smtpPort}`;
    return 'SMTP';
}

function getDefaultSmtpService(cfg) {
    const host = String(cfg.smtpHost || '').toLowerCase();
    if (cfg.smtpService) return cfg.smtpService;
    if (host.includes('gmail.com')) return 'gmail';
    if (host.includes('outlook.com') || host.includes('hotmail.com') || host.includes('live.com')) return 'hotmail';
    if (host.includes('yahoo.com')) return 'yahoo';
    return '';
}

function buildTransportOptions({ host, port, secure, user, pass, cfg, service = '', name = '' }) {
    const options = {
        host,
        port,
        secure,
        connectionTimeout: cfg.smtpConnectionTimeout,
        greetingTimeout: cfg.smtpGreetingTimeout,
        socketTimeout: cfg.smtpSocketTimeout,
        requireTLS: cfg.smtpRequireTls,
        ignoreTLS: cfg.smtpIgnoreTls,
        tls: {
            rejectUnauthorized: cfg.smtpTlsRejectUnauthorized
        },
        auth: {
            user,
            pass
        },
        debug: cfg.smtpDebug,
        logger: cfg.smtpLogger
    };

    if (service) options.service = service;
    if (name) options.name = name;
    if (host) options.tls.servername = host;

    return options;
}

let cachedTransporter = null;
let cachedTransporterKey = '';

function getTransporter({ cfg, host, port, secure, user, pass, service = '', name = '' }) {
    const key = JSON.stringify({ host, port, secure, user, pass, service, name, tls: cfg.smtpTlsRejectUnauthorized, requireTLS: cfg.smtpRequireTls, ignoreTLS: cfg.smtpIgnoreTls });
    if (!cachedTransporter || cachedTransporterKey !== key) {
        cachedTransporter = nodemailer.createTransport(
            buildTransportOptions({ host, port, secure, user, pass, cfg, service, name })
        );
        cachedTransporterKey = key;
    }
    return cachedTransporter;
}

async function sendViaSmtp({ cfg, host, port, secure, user, pass, label, service = '', name = '' }, mailOptions) {
    const transporter = getTransporter({ cfg, host, port, secure, user, pass, service, name });
    await transporter.sendMail(mailOptions);
    console.log(`Email sent via ${label} to`, mailOptions.to, 'subject:', mailOptions.subject);
    return true;
}

async function sendMail(to, subject, text, html, options = {}) {
    const cfg = getMailerConfig();
    const recipients = normalizeRecipients(to);
    if (!recipients.length) {
        console.warn('sendMail skipped: no valid recipients');
        return false;
    }
    let emailSent = false;
    const mailOptions = {
        from: `"${cfg.fromName}" <${cfg.fromEmail}>`,
        to: recipients.map((x) => x.Email).join(', '),
        subject: subject || 'RoomHy Notification',
        text: text || '',
        html: html || '',
        attachments: Array.isArray(options.attachments) ? options.attachments : undefined
    };

    if (!emailSent && isSmtpConfigured(cfg)) {
        try {
            await sendViaSmtp({
                cfg,
                host: cfg.smtpHost,
                port: cfg.smtpPort,
                secure: cfg.smtpSecure,
                user: cfg.smtpUser,
                pass: cfg.smtpPass,
                label: buildSmtpLabel(cfg),
                service: getDefaultSmtpService(cfg),
                name: cfg.smtpName
            }, mailOptions);
            emailSent = true;
        } catch (err) {
            console.error('Failed sending email via SMTP:', err && err.message);
            const smtpHint = getSmtpHint(err, cfg);
            if (smtpHint) {
                console.error('SMTP hint:', smtpHint);
            }
        }
    }


    // WhatsApp copy for the same recipient (resolved by email -> phone), if configured.
    // Pass skipWhatsApp: true in options to suppress this (e.g. when caller sends WhatsApp separately).
    let whatsappSent = false;
    if (!options.skipWhatsApp) {
        try {
            const whatsappDeliveredCount = await sendWhatsAppByEmailRecipients(recipients, subject, text, html, cfg);
            whatsappSent = whatsappDeliveredCount > 0;
        } catch (err) {
            console.warn('WhatsApp notification copy failed:', err && err.message);
        }
    }

    if (!emailSent && !isSmtpConfigured(cfg)) {
        console.warn('sendMail skipped: no SMTP provider configured (set SMTP_HOST/SMTP_USER/SMTP_PASS or SMTP_SERVICE)');
    }

    return emailSent || whatsappSent;
}

function credentialsHtml(loginId, password, role = 'Account') {
    const year = new Date().getFullYear();
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Login Credentials — RoomHy</title>
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
                  <strong style="font-size:20px;color:#111111;font-family:Arial,Helvetica,sans-serif;letter-spacing:-0.01em;">RoomHy</strong>
                </td>
                <td align="right" style="vertical-align:middle;font-size:11px;color:#999999;font-family:Arial,Helvetica,sans-serif;">
                  Account Portal
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Heading -->
        <tr>
          <td style="padding:32px 32px 8px;">
            <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#111111;font-family:Arial,Helvetica,sans-serif;">Account Created</h1>
            <p style="margin:0 0 24px;font-size:14px;color:#555555;line-height:1.7;font-family:Arial,Helvetica,sans-serif;">
              Your RoomHy <strong>${role}</strong> account has been created successfully. Please find your login credentials below.
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
                <td style="padding:12px 18px;font-size:14px;font-weight:700;color:#111111;border-bottom:1px solid #eeeeee;font-family:'Courier New',Courier,monospace;">${loginId}</td>
              </tr>
              <tr>
                <td style="padding:12px 18px;font-size:13px;color:#888888;font-family:Arial,Helvetica,sans-serif;">Password</td>
                <td style="padding:12px 18px;font-size:14px;font-weight:700;color:#111111;font-family:'Courier New',Courier,monospace;">${password}</td>
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
                  <a href="https://admin.roomhy.com" style="display:inline-block;background-color:#111111;color:#ffffff;text-decoration:none;padding:13px 28px;font-size:14px;font-weight:600;font-family:Arial,Helvetica,sans-serif;white-space:nowrap;">Login to RoomHy</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #dddddd;border-left:3px solid #111111;">
              <tr>
                <td style="padding:14px 18px;font-size:13px;color:#333333;line-height:1.7;font-family:Arial,Helvetica,sans-serif;">
                  Please change your password upon your first login. Keep your credentials confidential and do not share them with any third party.
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

async function sendCredentials(toEmail, loginId, password, role = 'Account', options = {}) {
    if (!toEmail) return;
    const subject = `${role} credentials for RoomHy`;
    const html = credentialsHtml(loginId, password, role);
    const text = `Your ${role} credentials\nLogin ID: ${loginId}\nPassword: ${password}`;
    return sendMail(toEmail, subject, text, html, options);
}

async function sendKycLinkEmail(toEmail, ownerName, propertyName, kycLink) {
    if (!toEmail) return false;
    const subject = 'RoomHy — KYC Verification Required for Property Approval';
    const year = new Date().getFullYear();
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>KYC Verification Required — RoomHy</title>
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
                  <strong style="font-size:20px;color:#111111;font-family:Arial,Helvetica,sans-serif;letter-spacing:-0.01em;">RoomHy</strong>
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
            <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#111111;font-family:Arial,Helvetica,sans-serif;">KYC Verification Required</h1>
            <p style="margin:0 0 8px;font-size:15px;color:#333333;font-family:Arial,Helvetica,sans-serif;">Dear <strong>${ownerName}</strong>,</p>
            <p style="margin:0 0 24px;font-size:14px;color:#555555;line-height:1.7;font-family:Arial,Helvetica,sans-serif;">
              Your visit report has been received. To proceed with property approval, please complete your KYC verification by submitting your identity documents.
            </p>
          </td>
        </tr>

        <!-- Property Details -->
        <tr>
          <td style="padding:0 32px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #dddddd;">
              <tr>
                <td colspan="2" style="padding:12px 18px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#888888;background-color:#f4f4f4;border-bottom:1px solid #dddddd;font-family:Arial,Helvetica,sans-serif;">Property Details</td>
              </tr>
              <tr>
                <td style="padding:12px 18px;font-size:13px;color:#888888;width:130px;font-family:Arial,Helvetica,sans-serif;">Property</td>
                <td style="padding:12px 18px;font-size:13px;font-weight:700;color:#111111;font-family:Arial,Helvetica,sans-serif;">${propertyName}</td>
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
                  <a href="${kycLink}" style="display:inline-block;background-color:#111111;color:#ffffff;text-decoration:none;padding:13px 28px;font-size:14px;font-weight:600;font-family:Arial,Helvetica,sans-serif;white-space:nowrap;">Complete KYC Verification</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 24px;">
            <p style="margin:0;font-size:12px;color:#888888;line-height:1.6;font-family:Arial,Helvetica,sans-serif;">If the button above does not work, copy and paste the following link into your browser:<br><span style="color:#333333;">${kycLink}</span></p>
          </td>
        </tr>

        <!-- Notice -->
        <tr>
          <td style="padding:0 32px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #dddddd;border-left:3px solid #111111;">
              <tr>
                <td style="padding:14px 18px;font-size:13px;color:#333333;line-height:1.7;font-family:Arial,Helvetica,sans-serif;">
                  This verification link is valid for 7 days. If you did not expect this email or have any concerns, please contact us at support@roomhy.com.
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
    const text = `Dear ${ownerName},\n\nYour visit report for "${propertyName}" has been received.\n\nPlease complete your KYC verification by visiting:\n${kycLink}\n\nThis link is valid for 7 days.\n\nRoomHy Support Team\nsupport@roomhy.com`;
    return sendMail(toEmail, subject, text, html);
}

module.exports = { sendCredentials, sendMail, sendKycLinkEmail };
