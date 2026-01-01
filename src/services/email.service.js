import sgMail from "@sendgrid/mail";
import dotenv from "dotenv";

dotenv.config();

// Configure SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

/**
 * Send approval email with temporary password to player
 */
export const sendApprovalEmail = async (user, tempPassword) => {
  try {
    const msg = {
      to: user.email,
      from: process.env.SENDGRID_FROM_EMAIL || "noreply@jucopipeline.com",
      subject: "🎉 Your JucoPipeline Account Has Been Approved!",
      text: `
Hello ${user.firstName},

Congratulations! Your JucoPipeline account has been approved by our admin team.

You can now login to your account using the following credentials:

Email: ${user.email}
Temporary Password: ${tempPassword}

Please login at: ${process.env.FRONTEND_URL}/login

IMPORTANT: For security reasons, please change your password immediately after logging in.

Welcome to JucoPipeline!

Best regards,
The JucoPipeline Team
      `,
      html: `
<!DOCTYPE html>
<html>
<head>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 10px 10px 0 0;
        }
        .content {
            background: #f9f9f9;
            padding: 30px;
            border-radius: 0 0 10px 10px;
        }
        .credentials {
            background: white;
            padding: 20px;
            border-left: 4px solid #667eea;
            margin: 20px 0;
            border-radius: 5px;
        }
        .credentials p {
            margin: 10px 0;
        }
        .credentials strong {
            color: #667eea;
        }
        .button {
            display: inline-block;
            padding: 12px 30px;
            background: #667eea;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
            font-weight: bold;
        }
        .warning {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 20px 0;
            border-radius: 5px;
        }
        .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            color: #666;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🎉 Account Approved!</h1>
    </div>
    <div class="content">
        <p>Hello <strong>${user.firstName}</strong>,</p>
        
        <p>Congratulations! Your JucoPipeline account has been approved by our admin team.</p>
        
        <p>You can now login to your account using the following credentials:</p>
        
        <div class="credentials">
            <p><strong>Email:</strong> ${user.email}</p>
            <p><strong>Temporary Password:</strong> <code>${tempPassword}</code></p>
        </div>
        
        <center>
            <a href="${process.env.FRONTEND_URL}/login" class="button">Login Now</a>
        </center>
        
        <div class="warning">
            <strong>⚠️ IMPORTANT:</strong> For security reasons, please change your password immediately after logging in.
        </div>
        
        <p>Welcome to JucoPipeline! We're excited to have you on board.</p>
        
        <p>Best regards,<br><strong>The JucoPipeline Team</strong></p>
    </div>
    <div class="footer">
        <p>This is an automated message. Please do not reply to this email.</p>
        <p>If you have any questions, please contact our support team.</p>
    </div>
</body>
</html>
      `,
    };

    await sgMail.send(msg);
    console.log(`✅ Approval email sent to ${user.email}`);
    return { success: true };
  } catch (error) {
    console.error("❌ SendGrid Error:", error);
    if (error.response) {
      console.error("SendGrid Response:", error.response.body);
    }
    throw new Error("Failed to send approval email");
  }
};

/**
 * Send rejection email to player
 */
export const sendRejectionEmail = async (user, reason) => {
  try {
    const msg = {
      to: user.email,
      from: process.env.SENDGRID_FROM_EMAIL || "noreply@jucopipeline.com",
      subject: "JucoPipeline Registration Update",
      text: `
Hello ${user.firstName},

We regret to inform you that your JucoPipeline registration has not been approved at this time.

Reason: ${reason || "Not specified"}

If you believe this is an error or have questions, please contact our support team.

Best regards,
The JucoPipeline Team
      `,
      html: `
<!DOCTYPE html>
<html>
<head>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background: #dc3545;
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 10px 10px 0 0;
        }
        .content {
            background: #f9f9f9;
            padding: 30px;
            border-radius: 0 0 10px 10px;
        }
        .reason-box {
            background: white;
            padding: 20px;
            border-left: 4px solid #dc3545;
            margin: 20px 0;
            border-radius: 5px;
        }
        .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            color: #666;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Registration Update</h1>
    </div>
    <div class="content">
        <p>Hello <strong>${user.firstName}</strong>,</p>
        
        <p>We regret to inform you that your JucoPipeline registration has not been approved at this time.</p>
        
        <div class="reason-box">
            <strong>Reason:</strong> ${reason || "Not specified"}
        </div>
        
        <p>If you believe this is an error or have questions, please contact our support team.</p>
        
        <p>Best regards,<br><strong>The JucoPipeline Team</strong></p>
    </div>
    <div class="footer">
        <p>This is an automated message. Please do not reply to this email.</p>
    </div>
</body>
</html>
      `,
    };

    await sgMail.send(msg);
    console.log(`✅ Rejection email sent to ${user.email}`);
    return { success: true };
  } catch (error) {
    console.error("❌ SendGrid Error:", error);
    throw new Error("Failed to send rejection email");
  }
};