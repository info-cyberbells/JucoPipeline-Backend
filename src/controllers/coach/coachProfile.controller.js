import User from "../../models/user.model.js";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";

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