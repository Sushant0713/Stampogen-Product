const nodemailer = require('nodemailer');
const config = require('@config');

let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;

  if (!config.smtp.host || !config.smtp.user) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: {
      user: config.smtp.user,
      pass: config.smtp.pass,
    },
  });

  return transporter;
};

const sendMail = async ({ to, subject, html, text, attachments = [], bcc } = {}) => {
  const transport = getTransporter();

  if (!transport) {
    console.info(`[EMAIL:DEV] To: ${to} | Subject: ${subject}${bcc ? ` | Bcc: ${bcc}` : ''}`);
    console.info(`[EMAIL:DEV] ${text || html}`);
    if (attachments?.length) {
      console.info(
        `[EMAIL:DEV] Attachments: ${attachments.map((a) => a.filename || 'file').join(', ')}`
      );
    }
    return { preview: true };
  }

  try {
    const result = await transport.sendMail({
      from: config.smtp.from,
      to,
      ...(bcc ? { bcc } : {}),
      subject,
      html,
      text,
      attachments,
    });
    console.info(
      `[EMAIL:SENT] To: ${to}${bcc ? ` | Bcc: ${bcc}` : ''} | Subject: ${subject} | id: ${result.messageId || 'n/a'}`
    );
    return result;
  } catch (error) {
    console.error(`[EMAIL:FAIL] To: ${to} | Subject: ${subject} |`, error.message || error);
    throw error;
  }
};

const sendOtpEmail = async ({ to, code, purpose = 'email_verification' }) => {
  const subjectByPurpose = {
    login: 'Your Stampogen login code',
    password_reset: 'Reset your Stampogen password',
    email_verification: 'Verify your Stampogen email',
  };
  const subject = subjectByPurpose[purpose] || subjectByPurpose.email_verification;

  const introByPurpose = {
    login: 'Use this one-time code to sign in:',
    password_reset: 'Use this one-time code to reset your password:',
    email_verification: 'Use this one-time code to continue:',
  };
  const intro = introByPurpose[purpose] || introByPurpose.email_verification;

  const text = `${intro} ${code}. It expires in 10 minutes.`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #000;">
      <div style="background: #021A54; color: #fff; padding: 20px 24px;">
        <h1 style="margin: 0; font-size: 20px;">Stampogen</h1>
      </div>
      <div style="border: 1px solid #E5E7EB; padding: 24px;">
        <p style="margin: 0 0 12px;">${intro}</p>
        <p style="font-size: 32px; letter-spacing: 8px; font-weight: 700; color: #021A54; margin: 16px 0;">
          ${code}
        </p>
        <p style="margin: 0; color: #6B7280; font-size: 14px;">
          This code expires in 10 minutes. If you did not request it, you can ignore this email.
        </p>
      </div>
    </div>
  `;

  return sendMail({ to, subject, html, text });
};

const sendAffiliateInterviewEmail = async ({
  to,
  name,
  meetLink,
  interviewAt,
  note = '',
}) => {
  const subject = 'Stampogen affiliate interview invitation';
  const safeName = name || 'there';
  const whenLabel = formatInterviewAt(interviewAt);
  const noteBlock = note
    ? `<p style="margin: 16px 0 0; color: #344054;">Note from our team: ${note}</p>`
    : '';
  const text = `Hi ${safeName},

Your Stampogen affiliate application has been accepted for an interview.

When: ${whenLabel}
Google Meet: ${meetLink}

${note ? `Note: ${note}` : ''}

After the interview, we will email you with the final decision. You will be able to sign in only after approval.

— Stampogen`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; color: #101828;">
      <div style="background: #021A54; color: #fff; padding: 20px 24px;">
        <h1 style="margin: 0; font-size: 20px;">Stampogen</h1>
      </div>
      <div style="border: 1px solid #E5E7EB; padding: 24px;">
        <p style="margin: 0 0 12px;">Hi ${safeName},</p>
        <p style="margin: 0 0 12px;">
          Your affiliate application has been accepted for an interview.
        </p>
        <p style="margin: 0 0 8px; font-weight: 600;">Interview date & time</p>
        <p style="margin: 0 0 16px;">${whenLabel}</p>
        <p style="margin: 0 0 8px; font-weight: 600;">Google Meet link</p>
        <p style="margin: 0 0 16px;">
          <a href="${meetLink}" style="color: #021A54; word-break: break-all;">${meetLink}</a>
        </p>
        ${noteBlock}
        <p style="margin: 20px 0 0; color: #667085; font-size: 14px;">
          After the interview, we will share the final decision by email.
          Login access is enabled only if your application is approved.
        </p>
      </div>
    </div>
  `;

  return sendMail({ to, subject, html, text });
};

function formatInterviewAt(value) {
  if (!value) return 'To be confirmed';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'To be confirmed';
  return date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

const buildSuperAdminInterviewEmail = ({
  affiliateName,
  affiliateEmail,
  meetLink,
  interviewAt,
  pendingUrl,
}) => {
  const whenLabel = formatInterviewAt(interviewAt);
  const subject = `Affiliate interview scheduled — ${affiliateName}`;
  const text = `An affiliate interview has been scheduled.

Applicant: ${affiliateName} (${affiliateEmail})
When: ${whenLabel}
Meet: ${meetLink}

Open pending approvals: ${pendingUrl}

— Stampogen`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; color: #101828;">
      <div style="background: #021A54; color: #fff; padding: 20px 24px;">
        <h1 style="margin: 0; font-size: 20px;">Stampogen</h1>
      </div>
      <div style="border: 1px solid #E5E7EB; padding: 24px;">
        <p style="margin: 0 0 12px;">An affiliate interview has been scheduled.</p>
        <p style="margin: 0 0 8px;"><strong>Applicant:</strong> ${affiliateName}</p>
        <p style="margin: 0 0 8px;"><strong>Email:</strong> ${affiliateEmail}</p>
        <p style="margin: 0 0 8px;"><strong>When:</strong> ${whenLabel}</p>
        <p style="margin: 0 0 16px;"><strong>Meet:</strong>
          <a href="${meetLink}" style="color: #021A54; word-break: break-all;">${meetLink}</a>
        </p>
        <p style="margin: 0;">
          <a href="${pendingUrl}" style="display:inline-block;background:#021A54;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600;">
            Open pending approvals
          </a>
        </p>
      </div>
    </div>
  `;
  return { subject, html, text };
};

const sendAffiliateDecisionEmail = async ({
  to,
  name,
  approved,
  note = '',
  email = '',
  temporaryPassword = '',
}) => {
  const config = require('@config');
  const safeName = name || 'there';
  const loginUrl = `${config.frontendUrl}/affiliate/login`;
  const loginEmail = String(email || to || '').trim();
  const reason = String(note || '').trim();
  const subject = approved
    ? 'Congratulations — your Stampogen affiliate application is approved'
    : 'Your Stampogen affiliate application was not approved';
  const body = approved
    ? 'Congratulations! Your affiliate partner application has been approved. You can now sign in to the Stampogen affiliate portal with the login details below.'
    : 'Thank you for your interest in joining Stampogen as an affiliate partner. After review, we are unable to approve your application at this time.';
  const noteBlock = approved
    ? reason
      ? `<p style="margin: 16px 0 0; color: #344054;">${reason}</p>`
      : ''
    : `<div style="margin: 16px 0 0; padding: 14px 16px; background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px;">
        <p style="margin: 0 0 6px; font-size: 13px; font-weight: 600; color: #344054;">Reason for rejection</p>
        <p style="margin: 0; color: #101828; white-space: pre-wrap;">${reason}</p>
      </div>`;
  const credentialsBlock =
    approved && loginEmail
      ? `<div style="margin: 20px 0 0; padding: 16px; background: #F0F9FF; border: 1px solid #BAE6FD; border-radius: 8px;">
        <p style="margin: 0 0 10px; font-size: 14px; font-weight: 700; color: #021A54;">Your login credentials</p>
        <p style="margin: 0 0 6px; color: #101828;"><strong>Portal:</strong> Affiliate Partner</p>
        <p style="margin: 0 0 6px; color: #101828;"><strong>Email:</strong> ${loginEmail}</p>
        ${
          temporaryPassword
            ? `<p style="margin: 0 0 6px; color: #101828;"><strong>Password:</strong> <code style="font-size: 14px; background:#fff; padding:2px 6px; border-radius:4px;">${temporaryPassword}</code></p>`
            : ''
        }
        <p style="margin: 12px 0 0; font-size: 13px; color: #667085;">
          Sign in at the link below using this email and password. If you registered with Google, you can also use Continue with Google.
        </p>
      </div>`
      : '';
  const text = approved
    ? `Hi ${safeName},

${body}
${reason ? `\n${reason}\n` : ''}
Login credentials
Email: ${loginEmail}
${temporaryPassword ? `Password: ${temporaryPassword}\n` : ''}
Sign in: ${loginUrl}

— Stampogen`
    : `Hi ${safeName},

${body}

Reason for rejection:
${reason}

— Stampogen`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; color: #101828;">
      <div style="background: #021A54; color: #fff; padding: 20px 24px;">
        <h1 style="margin: 0; font-size: 20px;">Stampogen</h1>
      </div>
      <div style="border: 1px solid #E5E7EB; padding: 24px;">
        <p style="margin: 0 0 12px;">Hi ${safeName},</p>
        <p style="margin: 0 0 12px;">${body}</p>
        ${noteBlock}
        ${credentialsBlock}
        ${
          approved
            ? `<p style="margin: 20px 0 0;"><a href="${loginUrl}" style="display:inline-block;background:#021A54;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600;">Sign in to affiliate portal</a></p>`
            : ''
        }
      </div>
    </div>
  `;

  return sendMail({ to, subject, html, text });
};

const sendAffiliateLoginCredentialsEmail = async ({
  to,
  name,
  email = '',
  isResend = false,
  affiliateDiscountCode = '',
  affiliateDiscountPercent = 20,
  claimUrl = '',
  claimExpiresAt = null,
}) => {
  const config = require('@config');
  const safeName = name || 'there';
  const loginUrl = `${config.frontendUrl}/affiliate/login`;
  const loginEmail = String(email || to || '').trim();
  const discountCode = String(affiliateDiscountCode || '').trim().toUpperCase();
  const discountPct = Number(affiliateDiscountPercent) || 20;
  const accessUrl = String(claimUrl || '').trim();
  const expiresLabel = claimExpiresAt
    ? new Date(claimExpiresAt).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })
    : '';

  // No password in the email body — college filters drop those messages.
  // Same pattern as hold/upload emails (link-based), which do arrive.
  const subject = isResend
    ? 'Stampogen — open your affiliate portal access link'
    : 'Congratulations — Stampogen affiliate application approved';
  const intro = isResend
    ? 'Your Stampogen affiliate portal access was reset. Open the secure link below to view your login email and temporary access code.'
    : 'Congratulations! Your Stampogen affiliate partner application has been approved. Open the secure link below to view your portal login details.';

  const discountText = discountCode
    ? `

Affiliate Discount Code: ${discountCode}
(Share this code with customers — ${discountPct}% off all Stampogen plans)`
    : '';

  const discountHtml = discountCode
    ? `<div style="margin: 16px 0 0; padding: 16px; background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 8px;">
          <p style="margin: 0 0 10px; font-size: 14px; font-weight: 700; color: #1E40AF;">Affiliate Discount Code</p>
          <p style="margin: 0 0 8px; color: #101828;">
            <code style="font-size: 16px; background:#fff; padding:4px 10px; border-radius:4px; letter-spacing: 0.03em; font-weight: 700;">${discountCode}</code>
          </p>
          <p style="margin: 0; font-size: 13px; color: #667085;">
            Share this code with customers for <strong>${discountPct}% off</strong> all Stampogen plans at checkout.
          </p>
        </div>`
    : '';

  const text = `Hi ${safeName},

${intro}

Portal email: ${loginEmail}
${accessUrl ? `View login details: ${accessUrl}` : `Sign in: ${loginUrl}`}
${expiresLabel ? `Link expires: ${expiresLabel}` : ''}
${discountText}

If you signed up with Google, you can also use Continue with Google on the login page.

— Stampogen`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; color: #101828;">
      <div style="background: #021A54; color: #fff; padding: 20px 24px;">
        <h1 style="margin: 0; font-size: 20px;">Stampogen</h1>
        ${
          isResend
            ? ''
            : '<p style="margin: 8px 0 0; font-size: 14px; opacity: 0.95;">Congratulations — you are approved</p>'
        }
      </div>
      <div style="border: 1px solid #E5E7EB; padding: 24px;">
        <p style="margin: 0 0 12px;">Hi ${safeName},</p>
        <p style="margin: 0 0 16px;">${intro}</p>
        <div style="margin: 0; padding: 16px; background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px;">
          <p style="margin: 0 0 8px; color: #101828;"><strong>Portal email:</strong> ${loginEmail}</p>
          ${
            expiresLabel
              ? `<p style="margin: 0; font-size: 13px; color: #667085;">Access link expires ${expiresLabel}</p>`
              : ''
          }
        </div>
        ${discountHtml}
        <p style="margin: 20px 0 0;">
          <a href="${accessUrl || loginUrl}" style="display:inline-block;background:#021A54;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600;">
            ${accessUrl ? 'View your portal access' : 'Sign in to affiliate portal'}
          </a>
        </p>
        <p style="margin: 16px 0 0; font-size: 13px; color: #667085;">
          After opening the link, sign in at the affiliate portal. If you signed up with Google, you can also use Continue with Google.
        </p>
      </div>
    </div>
  `;

  const bcc = config.smtp.user && config.smtp.user !== to ? config.smtp.user : undefined;
  return sendMail({ to, subject, html, text, bcc });
};

const sendAffiliateHoldAgreementEmail = async ({
  to,
  name,
  note = '',
  attachments = [],
  agreementTitle = 'Affiliate Partner Agreement',
  uploadUrl = '',
  expiresAt = null,
}) => {
  const safeName = name || 'there';
  const reason = String(note || '').trim();
  const expiresLabel = expiresAt
    ? new Date(expiresAt).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })
    : '';
  const subject = 'Your Stampogen affiliate application is on hold — agreement & upload link';
  const body =
    'Your affiliate partner application has been placed on hold. Please find the Affiliate Partner Agreement attached as a PDF. Sign it, then upload a clear photo or PDF of the signed copy using the secure link below.';
  const noteBlock = reason
    ? `<div style="margin: 16px 0 0; padding: 14px 16px; background: #FFF7ED; border: 1px solid #FED7AA; border-radius: 8px;">
        <p style="margin: 0 0 6px; font-size: 13px; font-weight: 600; color: #9A3412;">Note from Stampogen</p>
        <p style="margin: 0; color: #101828; white-space: pre-wrap;">${reason}</p>
      </div>`
    : '';
  const uploadBlock = uploadUrl
    ? `<p style="margin: 20px 0 0;">
          <a href="${uploadUrl}" style="display:inline-block;background:#021A54;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600;">
            Upload signed agreement
          </a>
        </p>
        ${
          expiresLabel
            ? `<p style="margin: 12px 0 0; color: #667085; font-size: 13px;">Upload link expires on ${expiresLabel}. JPG, PNG, WEBP, or PDF · max 5MB.</p>`
            : ''
        }`
    : '';
  const text = `Hi ${safeName},

${body}

Document: ${agreementTitle}
${reason ? `\nNote from Stampogen:\n${reason}\n` : ''}
${uploadUrl ? `\nUpload signed agreement:\n${uploadUrl}\n` : ''}${
    expiresLabel ? `Link expires on ${expiresLabel}.\n` : ''
  }
— Stampogen`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; color: #101828;">
      <div style="background: #021A54; color: #fff; padding: 20px 24px;">
        <h1 style="margin: 0; font-size: 20px;">Stampogen</h1>
      </div>
      <div style="border: 1px solid #E5E7EB; padding: 24px;">
        <p style="margin: 0 0 12px;">Hi ${safeName},</p>
        <p style="margin: 0 0 12px;">${body}</p>
        <p style="margin: 0 0 12px; color: #344054;">
          Attached: <strong>${agreementTitle}</strong> (PDF)
        </p>
        ${noteBlock}
        ${uploadBlock}
        <p style="margin: 20px 0 0; color: #667085; font-size: 13px;">
          Login stays blocked until your application is approved.
        </p>
      </div>
    </div>
  `;

  return sendMail({ to, subject, html, text, attachments });
};

const sendAffiliateSignedAgreementUploadEmail = async ({
  to,
  name,
  uploadUrl,
  expiresAt,
}) => {
  const safeName = name || 'there';
  const expiresLabel = expiresAt
    ? new Date(expiresAt).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })
    : '';
  const subject = 'Stampogen onboarding — upload your signed affiliate agreement';
  const body =
    'Please sign the Affiliate Partner Agreement we emailed earlier, then upload a clear photo or PDF of the signed document using the secure link below.';
  const text = `Hi ${safeName},

${body}

Upload link:
${uploadUrl}
${expiresLabel ? `\nThis link expires on ${expiresLabel}.\n` : ''}
— Stampogen`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; color: #101828;">
      <div style="background: #021A54; color: #fff; padding: 20px 24px;">
        <h1 style="margin: 0; font-size: 20px;">Stampogen</h1>
      </div>
      <div style="border: 1px solid #E5E7EB; padding: 24px;">
        <p style="margin: 0 0 12px;">Hi ${safeName},</p>
        <p style="margin: 0 0 12px;">${body}</p>
        <p style="margin: 20px 0 0;">
          <a href="${uploadUrl}" style="display:inline-block;background:#021A54;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600;">
            Upload signed agreement
          </a>
        </p>
        ${
          expiresLabel
            ? `<p style="margin: 16px 0 0; color: #667085; font-size: 13px;">Link expires on ${expiresLabel}.</p>`
            : ''
        }
        <p style="margin: 16px 0 0; color: #667085; font-size: 13px;">
          Accepted formats: JPG, PNG, WEBP, or PDF (max 5MB).
        </p>
      </div>
    </div>
  `;

  return sendMail({ to, subject, html, text });
};

const sendAffiliateRedeemPaidEmail = async ({ to, name, amount, payoutMethod = '' }) => {
  const safeName = name || 'there';
  const amountLabel = `₹${Number(amount || 0).toLocaleString('en-IN')}`;
  const methodLabel =
    payoutMethod === 'both'
      ? 'bank transfer / UPI'
      : payoutMethod === 'upi'
        ? 'UPI'
        : payoutMethod === 'bank'
          ? 'bank transfer'
          : 'your registered payout method';
  const subject = `Stampogen payout completed — ${amountLabel}`;
  const text = `Hi ${safeName},

Your affiliate redeem request for ${amountLabel} has been marked as paid.

We have completed the payout via ${methodLabel}.

Thank you for partnering with Stampogen.

— Stampogen`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; color: #101828;">
      <div style="background: #021A54; color: #fff; padding: 20px 24px;">
        <h1 style="margin: 0; font-size: 20px;">Stampogen</h1>
      </div>
      <div style="border: 1px solid #E5E7EB; padding: 24px;">
        <p style="margin: 0 0 12px;">Hi ${safeName},</p>
        <p style="margin: 0 0 12px;">
          Your affiliate redeem request for
          <strong style="color:#021A54;">${amountLabel}</strong>
          has been <strong style="color:#065F46;">paid</strong>.
        </p>
        <p style="margin: 0 0 12px;">
          Payout method: ${methodLabel}.
        </p>
        <p style="margin: 20px 0 0; color: #667085; font-size: 14px;">
          Thank you for partnering with Stampogen.
        </p>
      </div>
    </div>
  `;
  return sendMail({ to, subject, html, text });
};

const sendAffiliateRedeemRejectedEmail = async ({
  to,
  name,
  amount,
  note = '',
}) => {
  const safeName = name || 'there';
  const amountLabel = `₹${Number(amount || 0).toLocaleString('en-IN')}`;
  const noteBlock = note
    ? `<p style="margin: 16px 0 0; color: #344054;"><strong>Reason:</strong> ${note}</p>`
    : '';
  const subject = `Stampogen redeem request update — ${amountLabel}`;
  const text = `Hi ${safeName},

Your affiliate redeem request for ${amountLabel} was not approved.

${note ? `Reason: ${note}` : ''}

The amount has been returned to your current earnings balance so you can redeem again after updating details if needed.

— Stampogen`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; color: #101828;">
      <div style="background: #021A54; color: #fff; padding: 20px 24px;">
        <h1 style="margin: 0; font-size: 20px;">Stampogen</h1>
      </div>
      <div style="border: 1px solid #E5E7EB; padding: 24px;">
        <p style="margin: 0 0 12px;">Hi ${safeName},</p>
        <p style="margin: 0 0 12px;">
          Your affiliate redeem request for
          <strong style="color:#021A54;">${amountLabel}</strong>
          was <strong style="color:#B42318;">not approved</strong>.
        </p>
        ${noteBlock}
        <p style="margin: 16px 0 0; color: #667085; font-size: 14px;">
          The amount has been returned to your current earnings balance so you can redeem again
          after updating payout details if needed.
        </p>
      </div>
    </div>
  `;
  return sendMail({ to, subject, html, text });
};

module.exports = {
  sendMail,
  sendOtpEmail,
  sendAffiliateInterviewEmail,
  sendAffiliateDecisionEmail,
  sendAffiliateLoginCredentialsEmail,
  sendAffiliateHoldAgreementEmail,
  sendAffiliateSignedAgreementUploadEmail,
  sendAffiliateRedeemPaidEmail,
  sendAffiliateRedeemRejectedEmail,
  buildSuperAdminInterviewEmail,
  formatInterviewAt,
};
