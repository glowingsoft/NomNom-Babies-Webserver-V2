const APP_NAME = "NomNom Babies";
const BRAND_COLOR = "#F2692B";
const OTP_EXPIRY_MINUTES = 10;
const currentYear = new Date().getFullYear();

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const toHtmlText = (value) =>
  escapeHtml(value).split(/\r\n|\r|\n/).join("<br />");

const EMAIL_LOGO_CID = "nomnom-logo";

const logoBadge = (width = 120) => `<table role="presentation" cellpadding="0" cellspacing="0" align="center">
                  <tr>
                    <td align="center" bgcolor="#ffffff" style="background:#ffffff;border-radius:14px;padding:10px 18px;">
                      <img src="cid:${EMAIL_LOGO_CID}" width="${width}" alt="${APP_NAME}" style="display:block;border:0;outline:none;height:auto;" />
                    </td>
                  </tr>
                </table>`;

const iconBackground = () =>
  process.env.EMAIL_ICON_URL
    ? `background-image:url('${process.env.EMAIL_ICON_URL}');background-repeat:repeat;background-position:center;background-size:64px 64px;`
    : "";

const otpEmailLayout = ({ title, intro, otp }) => `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#333;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:24px 0;">
      <tr>
        <td align="center">
          <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;">
            <tr>
              <td align="center" bgcolor="${BRAND_COLOR}" style="background:${BRAND_COLOR};color:#ffffff;text-align:center;padding:22px 20px;">
                ${logoBadge(110)}
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px;line-height:1.6;font-size:15px;background-color:#ffffff;${iconBackground()}">
                <h3 style="margin:0 0 12px;font-size:18px;">${title}</h3>
                <p style="margin:0 0 20px;">Hello,</p>
                <p style="margin:0 0 20px;">${intro}</p>
                <p style="margin:0 0 20px;text-align:center;">
                  <span style="display:inline-block;font-size:32px;font-weight:bold;letter-spacing:8px;color:${BRAND_COLOR};background:#e6f6f0;border-radius:8px;padding:12px 24px;">${otp}</span>
                </p>
                <p style="margin:0 0 12px;">This code expires in ${OTP_EXPIRY_MINUTES} minutes. Please do not share it with anyone.</p>
                <p style="margin:0;color:#777;font-size:13px;">If you did not request this, you can safely ignore this email.</p>
              </td>
            </tr>
            <tr>
              <td style="text-align:center;color:#888;font-size:12px;padding:16px;background:#fafafa;">
                &copy; ${currentYear} ${APP_NAME}. All rights reserved.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

const registrationOtpEmailTemplate = (otp) =>
  otpEmailLayout({
    title: `Welcome to ${APP_NAME}`,
    intro: "Thank you for signing up. Use the code below to verify your email address:",
    otp,
  });

const forgotPasswordOtpEmailTemplate = (otp) =>
  otpEmailLayout({
    title: "Reset your password",
    intro: "We received a request to reset your password. Use the code below to continue:",
    otp,
  });

const accountDeletionOtpEmailTemplate = (otp) =>
  otpEmailLayout({
    title: "Confirm account deletion",
    intro:
      "We received a request to delete your NomNom Babies account. Enter this code on the deletion page to continue. If this wasn't you, ignore this email and your account stays safe:",
    otp,
  });

const accountDeletedEmailTemplate = () => `
  <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#12110D">
    <h2 style="color:#F2692B">Your account has been deleted</h2>
    <p>Your NomNom Babies account and its personal data have been deleted as requested. You can no longer sign in with it.</p>
    <p>If you didn't request this, please contact us at support@nomnombabies.com.</p>
    <p style="color:#797979;font-size:12px">© ${currentYear} NomNom Babies</p>
  </div>`;

const stripeEmailTemplate = ({ name, link }) => `
  <!DOCTYPE html>
  <html>
    <head>
      <style>
        .email-container {
          font-family: Arial, sans-serif;
          line-height: 1.5;
          color: #333;
        }
        .email-header {
          background-color: #F2692B;
          color: white;
          text-align: center;
          padding: 10px 0;
        }
        .email-body {
          margin: 20px;
        }
        .otp {
          font-size: 1.5em;
          color: #F2692B;
        }
        .footer {
          text-align: center;
          margin-top: 20px;
          color: #888;
        }
      </style>
    </head>
    <body>
      <div class="email-container">
        <div class="email-header">
          <div style="padding:14px 0 6px;">${logoBadge(110)}</div>
          <h2>Stripe Account Completion</h2>
        </div>
        <div class="email-body">
         <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;margin:0 auto" bgcolor="#fff">
	<tbody>
	<tr>
		<td colspan="2" style="padding:20px 20px 20px 20px">
			<p style="font-family: 'Montserrat', sans-serif; font-size: 15px;">Hey ${name},</p>
			<p style="font-family: 'Montserrat', sans-serif;font-size: 15px;text-align: justify;">
				You’re almost ready to start a whole new boilerplate experience
			</p>
			<p style="font-family: 'Montserrat', sans-serif;font-size: 15px;text-align: justify;">
				Simply click the big blue button below to verify the details you have provided to us, so you can be paid on time.
			</p>
			<p style="font-family: 'Montserrat', sans-serif;font-size: 15px;text-align: justify;">
				Before clicking, it is important to remember to have a copy of your <b>ID and a Proof of Address</b> for the verification stage. This is an important anti-fraud measure that helps us to keep your money safe and comply with regulations.
			</p>
			<b style="font-family: 'Montserrat', sans-serif;text-align: justify;">Please see a list of accepted IDs below:</b>
			<ul style="padding-left: 14px;font-family: 'Montserrat', sans-serif; font-size: 15px;text-align: justify; ">
				<li>Valid passport (all four corners must be showing)</li>
				<li>Valid photocard driving licence (not provisional and only if not used for proof of address)</li>
				<li>Valid Government issued national identity card bearing a photograph (electronic copy only - both sides)</li>
			</ul>
			<b style="font-family: 'Montserrat', sans-serif;text-align: justify;">
				We can accept a clear scan of your document or a photo upload
			</b>
			<p style="font-family: 'Montserrat', sans-serif; font-size: 15px;text-align: justify;">Acceptable proof of business or individual address:</p>
			<ul style="padding-left: 14px;font-family: 'Montserrat', sans-serif; font-size: 15px;text-align: justify; ">
				<li>Gas bill / electricity bill / landline telephone bill (maximum 90 days old; may be printed online)</li>
				<li>Council tax bill / water bill (must relate to the current charging period)</li>
			</ul>
			<p style="font-family: 'Montserrat', sans-serif; font-size: 15px;text-align: justify;">
				We are happy to accept a PDF download or screenshot of these documents if your accounts are online and paperless
			</p>
			<a href="${link}" style="font-family: 'Montserrat', sans-serif;background: #F2692B;border: none;height: 30px;width: 60%;border-radius: 12px;text-align: center;margin: 0 auto;display: block;color: #fff;cursor: pointer; padding-top:10px">Verify your account</a>
			<p style="font-family: 'Montserrat', sans-serif; font-size: 15px;">
				We wish you a boilerplate experience
			</p>
         <p style="font-family: 'Montserrat', sans-serif; font-size: 15px;">
        Best Regards,
        <br>
         boilerplate Team
        </p>
		</td>
	</tr>
	</tbody></table>
        </div>
        <div class="footer">
          &copy; ${currentYear} ${APP_NAME}. All rights reserved.
        </div>
      </div>
    </body>
  </html>
`;

const supportReplyEmailTemplate = ({
  name,
  subject,
  reply,
  originalMessage,
  reference,
  submittedAt,
}) => {
  const preheader = escapeHtml(String(reply).replace(/\s+/g, " ").slice(0, 110));

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <title>Re: ${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f1ee;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#2b2b2b;-webkit-text-size-adjust:100%;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#f4f1ee;">${preheader}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f4f1ee" style="background:#f4f1ee;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;">
            <tr>
              <td align="center" bgcolor="${BRAND_COLOR}" style="background:${BRAND_COLOR};padding:26px 24px 22px;">
                ${logoBadge(120)}
                <div style="margin-top:12px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#ffffff;opacity:0.9;">Customer Support</div>
              </td>
            </tr>
            <tr>
              <td height="4" bgcolor="#D9531A" style="background:#D9531A;font-size:0;line-height:0;">&nbsp;</td>
            </tr>
            <tr>
              <td style="padding:32px 36px 8px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="font-size:12px;color:#8a8a8a;">Reference <strong style="color:#555;">${escapeHtml(reference)}</strong></td>
                    <td align="right"><span style="display:inline-block;background:#e6f6ee;color:#15803d;font-size:12px;font-weight:bold;padding:4px 12px;border-radius:999px;">Replied</span></td>
                  </tr>
                </table>
                <h1 style="margin:18px 0 6px;font-size:22px;line-height:1.3;color:#222222;">We've replied to your message</h1>
                <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#555555;">Hello ${escapeHtml(name)}, thanks for getting in touch. Here is our answer:</p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td bgcolor="#FFF4EE" style="background:#FFF4EE;border-left:4px solid ${BRAND_COLOR};border-radius:8px;padding:18px 20px;font-size:15.5px;line-height:1.7;color:#2b2b2b;">${toHtmlText(reply)}</td>
                  </tr>
                </table>
                <p style="margin:24px 0 0;font-size:15px;line-height:1.6;color:#2b2b2b;">Kind regards,<br /><strong>The ${APP_NAME} Support Team</strong></p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 36px 8px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td bgcolor="#f7f7f8" style="background:#f7f7f8;border-radius:10px;padding:16px 18px;">
                      <div style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#9a9a9a;margin-bottom:8px;">Your original message${submittedAt ? ` &middot; ${escapeHtml(submittedAt)}` : ""}</div>
                      <div style="font-size:14px;font-weight:bold;color:#444444;margin-bottom:6px;">${escapeHtml(subject)}</div>
                      <div style="font-size:14px;line-height:1.6;color:#666666;">${toHtmlText(originalMessage)}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 36px 32px;font-size:13px;line-height:1.6;color:#777777;">
                Still need help? Contact us from the ${APP_NAME} app and mention reference <strong>${escapeHtml(reference)}</strong>.
              </td>
            </tr>
            <tr>
              <td align="center" bgcolor="#fafafa" style="background:#fafafa;padding:18px 24px;font-size:12px;line-height:1.6;color:#8a8a8a;">
                You received this email because you contacted ${APP_NAME} support.<br />
                &copy; ${currentYear} ${APP_NAME}. All rights reserved.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
};

module.exports = {
  accountDeletionOtpEmailTemplate,
  accountDeletedEmailTemplate,
  supportReplyEmailTemplate,
  EMAIL_LOGO_CID,
  registrationOtpEmailTemplate,
  forgotPasswordOtpEmailTemplate,
  stripeEmailTemplate,
};
