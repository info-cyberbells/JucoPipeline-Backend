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

// GET COACH PROFILE
export const getCoachProfile = async (req, res) => {
  try {
    const coachId = req.user.id;
    const coach = await User.findById(coachId).select("-password");
    if (!coach || coach.role !== "coach") {
      return res.status(403).json({ message: "Access denied. Coach role required." });
    }

    const baseURL = `${req.protocol}://${req.get("host")}`;
    const coachData = formatUserData(coach, baseURL);

    res.json({
      message: "Coach profile retrieved successfully",
      coach: coachData
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// UPDATE COACH PROFILE
export const updateCoachProfile = async (req, res) => {
  try {
    const coachId = req.user.id;
    const {
      firstName,
      lastName,
      email,
      password,
      phoneNumber,
      position,
      schoolType,
      division,
      conference,
      state,
      school,
      organization,
      jobTitle
    } = req.body;

    const coach = await User.findById(coachId);
    
    if (!coach || coach.role !== "coach") {
      return res.status(403).json({ message: "Access denied. Coach role required." });
    }

    // Update personal information
    if (firstName !== undefined) coach.firstName = firstName;
    if (lastName !== undefined) coach.lastName = lastName;
    
    // Check if email is being changed and if it's already in use
    if (email !== undefined && email !== coach.email) {
      const existingUser = await User.findOne({ 
        email: email.toLowerCase(), 
        _id: { $ne: coachId } 
      });
      
      if (existingUser) {
        return res.status(400).json({ 
          message: "Email already in use by another user" 
        });
      }
      coach.email = email.toLowerCase();
    }

    // Update password if provided
    if (password !== undefined && password.trim() !== "") {
      if (password.length < 8) {
        return res.status(400).json({ 
          message: "Password must be at least 8 characters" 
        });
      }
      // const salt = await bcrypt.genSalt(10);
      // coach.password = await bcrypt.hash(password, salt);
      coach.password = password;
    }

    if (phoneNumber !== undefined) coach.phoneNumber = phoneNumber;

    // Update professional information
    if (position !== undefined) coach.position = position;
    if (schoolType !== undefined) coach.schoolType = schoolType;
    if (division !== undefined) coach.division = division;
    if (conference !== undefined) coach.conference = conference;
    if (state !== undefined) coach.state = state;
    if (school !== undefined) coach.school = school;
    if (organization !== undefined) coach.organization = organization;
    if (jobTitle !== undefined) coach.jobTitle = jobTitle;

    await coach.save();

    const updatedCoach = await User.findById(coachId).select("-password");
    const baseURL = `${req.protocol}://${req.get("host")}`;
    const coachData = formatUserData(updatedCoach, baseURL);

    res.json({
      message: "Profile updated successfully",
      coach: coachData
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// UPDATE COACH PROFILE IMAGE
export const updateCoachProfileImage = async (req, res) => {
  try {
    const coachId = req.user.id;
    
    if (!req.files || !req.files.profileImage) {
      return res.status(400).json({ message: "No image file uploaded" });
    }

    const coach = await User.findById(coachId);
    
    if (!coach || coach.role !== "coach") {
      return res.status(403).json({ message: "Access denied. Coach role required." });
    }

    // Delete old profile image if exists
    if (coach.profileImage && !coach.profileImage.startsWith("http")) {
      try {
        const oldPath = path.join(process.cwd(), coach.profileImage);
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
    coach.profileImage = `/uploads/profiles/${file.filename}`;

    await coach.save();

    const baseURL = `${req.protocol}://${req.get("host")}`;
    const coachData = formatUserData(coach, baseURL);

    res.json({
      message: "Profile image updated successfully",
      coach: coachData
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// DELETE COACH PROFILE IMAGE
export const deleteCoachProfileImage = async (req, res) => {
  try {
    const coachId = req.user.id;

    const coach = await User.findById(coachId);
    
    if (!coach || coach.role !== "coach") {
      return res.status(403).json({ message: "Access denied. Coach role required." });
    }

    if (!coach.profileImage) {
      return res.status(404).json({ message: "No profile image found" });
    }

    // Don't delete if it's an external URL
    if (!coach.profileImage.startsWith("http")) {
      try {
        const filePath = path.join(process.cwd(), coach.profileImage);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`Profile image deleted: ${filePath}`);
        }
      } catch (err) {
        console.error("Error deleting profile image file:", err);
      }
    }

    coach.profileImage = null;

    await coach.save();

    const baseURL = `${req.protocol}://${req.get("host")}`;
    const coachData = formatUserData(coach, baseURL);

    res.json({
      message: "Profile image deleted successfully",
      coach: coachData
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Change Password
export const changePassword = async (req, res) => {
  try {
    const coachId = req.user.id;
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

    // Get coach with password field
    const coach = await User.findById(coachId).select("+password");
    if (!coach || coach.role !== "coach") {
      return res.status(403).json({ 
        message: "Access denied. Coach role required." 
      });
    }

    // Verify current password
    // const isPasswordValid = await bcrypt.compare(currentPassword, coach.password);
    const isPasswordValid = await bcrypt.compare(currentPassword, coach.password);
    if (!isPasswordValid) {
      return res.status(401).json({ 
        message: "Current password is incorrect" 
      });
    }

    // Hash new password
    // const salt = await bcrypt.genSalt(10);
    // coach.password = await bcrypt.hash(newPassword, salt);
    coach.password = newPassword;

    // Save updated password
    await coach.save();

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
        <p>Hello ${firstName || 'Coach'},</p>
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
    text: `Hello ${firstName || 'Coach'},\n\nYou have requested to reset your password. Please use the following OTP to proceed:\n\n${otp}\n\nThis OTP is valid for 10 minutes.\n\nIf you did not request this, please ignore this email.\n\nBest regards,\nJuco Pipeline`
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

    // Find coach by email
    const coach = await User.findOne({ email: email.toLowerCase(), role: "coach" });
    
    if (!coach) {
      return res.status(404).json({ 
        message: "No coach account found with this email address" 
      });
    }

    // Generate OTP
    const otp = generateOTP();
    
    // Set OTP expiration (10 minutes from now)
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    // Save OTP to database
    coach.resetPasswordToken = otp;
    coach.resetPasswordExpires = otpExpires;
    await coach.save();

    // Send OTP via email
    await sendOTPEmail(email, otp, coach.firstName);

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

    // Find coach by email
    const coach = await User.findOne({ 
      email: email.toLowerCase(), 
      role: "coach" 
    });

    if (!coach) {
      return res.status(404).json({ 
        message: "No coach account found with this email address" 
      });
    }

    // Check if OTP exists
    if (!coach.resetPasswordToken) {
      return res.status(400).json({ 
        message: "No OTP found. Please request a new one." 
      });
    }

    // Check if OTP has expired
    if (coach.resetPasswordExpires < new Date()) {
      coach.resetPasswordToken = null;
      coach.resetPasswordExpires = null;
      await coach.save();
      
      return res.status(400).json({ 
        message: "OTP has expired. Please request a new one." 
      });
    }

    // Verify OTP
    if (coach.resetPasswordToken !== otp) {
      return res.status(400).json({ 
        message: "Invalid OTP. Please check and try again." 
      });
    }

    // Generate a temporary reset token (valid for 15 minutes)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Save reset token (replace OTP with reset token)
    coach.resetPasswordToken = resetToken;
    coach.resetPasswordExpires = resetTokenExpires;
    await coach.save();

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

    // Find coach by reset token
    const coach = await User.findOne({ 
      resetPasswordToken: resetToken,
      role: "coach",
      resetPasswordExpires: { $gt: new Date() } // Token must not be expired
    }).select("+password");

    if (!coach) {
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
    const isSameAsOld = await bcrypt.compare(newPassword, coach.password);
    if (isSameAsOld) {
      return res.status(400).json({ 
        message: "New password cannot be the same as your previous password" 
      });
    }

    // Update password (assuming your User model has pre-save hook for hashing)
    coach.password = newPassword;
    
    // Clear reset token fields
    coach.resetPasswordToken = null;
    coach.resetPasswordExpires = null;
    
    await coach.save();

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