import User from "../../models/user.model.js";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import sgMail from "@sendgrid/mail";

// Helper to format user data
const formatUserData = (user, baseURL) => {
  const userData = user.toObject();
  if (userData.profileImage && !userData.profileImage.startsWith("http")) {
    userData.profileImage = `${baseURL}${userData.profileImage}`;
  }
  delete userData.password;
  return userData;
};

// GET SCOUT PROFILE
export const getScoutProfile = async (req, res) => {
  try {
    const scoutId = req.user.id;
    const scout = await User.findById(scoutId).populate('team').select("-password");
    if (!scout || scout.role !== "scout") {
      return res.status(403).json({ message: "Access denied. scout role required." });
    }

    const baseURL = `${req.protocol}://${req.get("host")}`;
    const scoutData = formatUserData(scout, baseURL);

    res.json({
      message: "scout profile retrieved successfully",
      scout: scoutData
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// UPDATE SCOUT PROFILE
export const updateScoutProfile = async (req, res) => {
    try {
        const scoutId = req.user.id;
        const { firstName, lastName, email, password, teamId, jobTitle, state } = req.body;
        const scout = await User.findById(scoutId);
        if (!scout || scout.role !== "scout") {
            return res.status(403).json({ message: "Access denied. Scout role required." });
        }

        // ===== Personal Information =====
        if (firstName !== undefined) scout.firstName = firstName;
        if (lastName !== undefined) scout.lastName = lastName;
        // If email changed, check if already used
        if (email !== undefined && email !== scout.email) {
            const existingUser = await User.findOne({
                email: email.toLowerCase(),
                _id: { $ne: scoutId }
            });

            if (existingUser) {
                return res.status(400).json({
                message: "Email already in use by another user"
                });
            }
            scout.email = email.toLowerCase();
        }

        // Update password if provided
        if (password !== undefined && password.trim() !== "") {
            if (password.length < 8) {
                return res.status(400).json({
                message: "Password must be at least 8 characters"
                });
            }
            scout.password = password;
        }

        // ===== Professional Information =====
        if (teamId !== undefined) scout.team = teamId;
        if (jobTitle !== undefined) scout.jobTitle = jobTitle;
        if (state !== undefined) scout.state = state;
        await scout.save();

        const updatedScout = await User.findById(scoutId).select("-password");
        const baseURL = `${req.protocol}://${req.get("host")}`;
        const scoutData = formatUserData(updatedScout, baseURL);
        res.json({
            message: "Scout profile updated successfully",
            scout: scoutData
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// UPDATE SCOUNT PROFILE IMAGE
export const updateScoutProfileImage = async (req, res) => {
  try {
    const scoutId = req.user.id;
    
    if (!req.files || !req.files.profileImage) {
      return res.status(400).json({ message: "No image file uploaded" });
    }

    const scout = await User.findById(scoutId);
    
    if (!scout || scout.role !== "scout") {
      return res.status(403).json({ message: "Access denied. scout role required." });
    }

    // Delete old profile image if exists
    if (scout.profileImage && !scout.profileImage.startsWith("http")) {
      try {
        const oldPath = path.join(process.cwd(), scout.profileImage);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
          console.log(`Old profile image deleted: ${oldPath}`);
        }
      } catch (err) {
        console.error("Error deleting old profile image:", err);
      }
    }

    const file = req.files.profileImage[0];
    
    // Update profile image
    scout.profileImage = `/uploads/profiles/${file.filename}`;

    await scout.save();

    const baseURL = `${req.protocol}://${req.get("host")}`;
    const scoutData = formatUserData(scout, baseURL);

    res.json({
      message: "Profile image updated successfully",
      scout: scoutData
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// DELETE SCOUT PROFILE IMAGE
export const deleteScoutProfileImage = async (req, res) => {
  try {
    const scoutId = req.user.id;
    const scout = await User.findById(scoutId);
    if (!scout || scout.role !== "scout") {
      return res.status(403).json({ message: "Access denied. scout role required." });
    }

    if (!scout.profileImage) {
      return res.status(400).json({ message: "No profile image found" });
    }

    // Don't delete if it's an external URL
    if (!scout.profileImage.startsWith("http")) {
      try {
        const filePath = path.join(process.cwd(), scout.profileImage);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`Profile image deleted: ${filePath}`);
        }
      } catch (err) {
        console.error("Error deleting profile image file:", err);
      }
    }

    scout.profileImage = null;
    await scout.save();

    const baseURL = `${req.protocol}://${req.get("host")}`;
    const scoutData = formatUserData(scout, baseURL);
    res.json({
      message: "Profile image deleted successfully",
      scout: scoutData
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Change Password for Scout 
export const changePassword = async (req, res) => {
  try {
    const scoutId = req.user.id;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    // Validate required fields
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ 
        message: "All fields are required" 
      });
    }

    // Validate new password length
    if (newPassword.length < 8) {
      return res.status(400).json({ 
        message: "New password must be at least 8 characters long" 
      });
    }

    // Check if new password and confirm password match
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ 
        message: "New password and confirm password do not match" 
      });
    }

    // Check if new password is same as current password
    if (currentPassword === newPassword) {
      return res.status(400).json({ 
        message: "New password cannot be the same as current password" 
      });
    }

    // Get scout with password field
    const scout = await User.findById(scoutId).select("+password");
    if (!scout || scout.role !== "scout") {
      return res.status(403).json({ 
        message: "Access denied. scout role required." 
      });
    }

    // Verify current password
    // const isPasswordValid = await bcrypt.compare(currentPassword, scout.password);
    const isPasswordValid = await bcrypt.compare(currentPassword, scout.password);
    if (!isPasswordValid) {
      return res.status(401).json({ 
        message: "Current password is incorrect" 
      });
    }

    // Hash new password
    // const salt = await bcrypt.genSalt(10);
    // scout.password = await bcrypt.hash(newPassword, salt);
    scout.password = newPassword;

    // Save updated password
    await scout.save();

    res.json({
      message: "Password changed successfully"
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};



// Helper function to generate 6-digit OTP
const generateOTP = () => {
  return crypto.randomInt(100000, 999999).toString();
};

// Configure SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);
const sendOTPEmail = async (email, otp, firstName) => {
  const msg = {
    to: email,
    from: process.env.SENDGRID_FROM_EMAIL,
    subject: 'Password Reset OTP',
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Password Reset Request</h2>
        <p>Hello ${firstName || 'scout'},</p>
        <p>You have requested to reset your password. Please use the following OTP to proceed:</p>
        <div style="background-color: #f5f5f5; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
          <h1 style="color: #4CAF50; font-size: 36px; letter-spacing: 8px; margin: 0;">${otp}</h1>
        </div>
        <p style="color: #666;">This OTP is valid for <strong>10 minutes</strong>.</p>
        <p style="color: #999; font-size: 14px;">If you did not request this, please ignore this email and your password will remain unchanged.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #999; font-size: 12px;">Best regards,<br>Juco Pipeline</p>
      </div>
    `,
    text: `Hello ${firstName || 'scout'},\n\nYou have requested to reset your password. Please use the following OTP to proceed:\n\n${otp}\n\nThis OTP is valid for 10 minutes.\n\nIf you did not request this, please ignore this email.\n\nJuco Pipeline,\nJuco Pipeline`
  };

  try {
    await sgMail.send(msg);
    console.log(`OTP email sent successfully to ${email}`);
  } catch (error) {
    console.error('SendGrid error:', error.response?.body || error);
    throw new Error('Failed to send email');
  }
};

// FORGOT PASSWORD - SEND OTP
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // Find scout by email
    const scout = await User.findOne({ email: email.toLowerCase(), role: "scout" });
    
    if (!scout) {
      return res.status(400).json({ 
        message: "No scout account found with this email address" 
      });
    }

    // Generate OTP
    const otp = generateOTP();
    
    // Set OTP expiration (10 minutes from now)
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    // Save OTP to database
    scout.resetPasswordToken = otp;
    scout.resetPasswordExpires = otpExpires;
    await scout.save();

    // Send OTP via email
    await sendOTPEmail(email, otp, scout.firstName);

    res.status(200).json({
      message: "OTP has been sent to your email address",
      email: email
    });

  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ 
      message: "Failed to send OTP. Please try again later." 
    });
  }
};

// VERIFY OTP
export const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    // Find scout by email
    const scout = await User.findOne({ 
      email: email.toLowerCase(), 
      role: "scout" 
    });

    if (!scout) {
      return res.status(400).json({ 
        message: "No scout account found with this email address" 
      });
    }

    // Check if OTP exists
    if (!scout.resetPasswordToken) {
      return res.status(400).json({ 
        message: "No OTP found. Please request a new one." 
      });
    }

    // Check if OTP has expired
    if (scout.resetPasswordExpires < new Date()) {
      scout.resetPasswordToken = null;
      scout.resetPasswordExpires = null;
      await scout.save();
      
      return res.status(400).json({ 
        message: "OTP has expired. Please request a new one." 
      });
    }

    // Verify OTP
    if (scout.resetPasswordToken !== otp) {
      return res.status(400).json({ 
        message: "Invalid OTP. Please check and try again." 
      });
    }

    // Generate a temporary reset token (valid for 15 minutes)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Save reset token (replace OTP with reset token)
    scout.resetPasswordToken = resetToken;
    scout.resetPasswordExpires = resetTokenExpires;
    await scout.save();

    res.status(200).json({
      message: "OTP verified successfully. You can now reset your password.",
      resetToken: resetToken
    });

  } catch (error) {
    console.error("Verify OTP error:", error);
    res.status(500).json({ 
      message: "Failed to verify OTP. Please try again later." 
    });
  }
};

// RESET PASSWORD
export const resetPassword = async (req, res) => {
  try {
    const { resetToken, newPassword, confirmPassword } = req.body;

    // Find scout by reset token
    const scout = await User.findOne({ 
      resetPasswordToken: resetToken,
      role: "scout",
      resetPasswordExpires: { $gt: new Date() } // Token must not be expired
    }).select("+password");

    if (!scout) {
      return res.status(400).json({ 
        message: "Invalid or expired reset token. Please request a new OTP." 
      });
    }

    // Check if new password matches confirm password (already validated by Joi)
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ 
        message: "New password and confirm password do not match" 
      });
    }

    // Optional: Check if new password is same as old password
    const isSameAsOld = await bcrypt.compare(newPassword, scout.password);
    if (isSameAsOld) {
      return res.status(400).json({ 
        message: "New password cannot be the same as your previous password" 
      });
    }

    // Update password (assuming your User model has pre-save hook for hashing)
    scout.password = newPassword;
    
    // Clear reset token fields
    scout.resetPasswordToken = null;
    scout.resetPasswordExpires = null;
    
    await scout.save();

    res.status(200).json({
      message: "Password has been reset successfully. You can now login with your new password."
    });

  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ 
      message: "Failed to reset password. Please try again later." 
    });
  }
};