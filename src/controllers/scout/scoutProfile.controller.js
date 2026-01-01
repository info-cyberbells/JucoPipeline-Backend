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

// GET SCOUT PROFILE
export const getScoutProfile = async (req, res) => {
  try {
    const scoutId = req.user.id;
    const scout = await User.findById(scoutId).select("-password");
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
      return res.status(404).json({ message: "No profile image found" });
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