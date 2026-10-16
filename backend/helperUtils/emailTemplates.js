// emailTemplate.js
const APP_NAME = "NomNom Babies";
const BRAND_COLOR = "#F2692B";
const OTP_EXPIRY_MINUTES = 10;
const currentYear = new Date().getFullYear();

// Public https URL of the NomNom Babies icon (S3/CDN). Email clients cannot load local files.
// Set EMAIL_ICON_URL in .env; when unset, the email renders without the background icon.
const iconBackground = () =>
  process.env.EMAIL_ICON_URL
    ? `background-image:url('${process.env.EMAIL_ICON_URL}');background-repeat:repeat;background-position:center;background-size:64px 64px;`
    : "";

// Shared layout for all OTP emails (inline styles for email-client compatibility)
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
              <td style="background:${BRAND_COLOR};color:#ffffff;text-align:center;padding:20px;">
                <h2 style="margin:0;font-size:22px;">${APP_NAME}</h2>
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

// Account verification / registration OTP
const registrationOtpEmailTemplate = (otp) =>
  otpEmailLayout({
    title: `Welcome to ${APP_NAME}`,
    intro: "Thank you for signing up. Use the code below to verify your email address:",
    otp,
  });

// Forgot password OTP
const forgotPasswordOtpEmailTemplate = (otp) =>
  otpEmailLayout({
    title: "Reset your password",
    intro: "We received a request to reset your password. Use the code below to continue:",
    otp,
  });

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

// Export both functions
module.exports = {
  registrationOtpEmailTemplate,
  forgotPasswordOtpEmailTemplate,
  stripeEmailTemplate,
};
