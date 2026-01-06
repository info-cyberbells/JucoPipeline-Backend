import fs from 'fs';
import path from 'path';
import User from "../models/user.model.js";
import { validateUpdateProfile } from "../validation/profile.validation.js";

/**
 * Get : Method
 * Common Function
 * Get Profile data of users
 */
export const getProfile = async (req, res) => {
  try {
    const authUser = req.user;
    
    // Support both authUser.id and authUser._id
    const userId = authUser.id || authUser._id;
    
    const user = await User.findById(userId).select("-password -social_token");
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "User not found",
      });
    }

    const baseURL = `${req.protocol}://${req.get("host")}`;

    // Single role (string)
    const role = user.role?.toLowerCase();
    let roleData = {};

    // Role-specific data handling
    switch (role) {
      case "driver":
        roleData = {
          phoneNumber: user.phoneNumber || null,
          licenseNumber: user.licenseNumber || null,
          municipality: user.municipality || null,
          vehicleRegistration: user.vehicleRegistration || null,
          validUntil: user.validUntil || null,
          city: user.city,
          country: user.country,
          dob: user.dob,
          licensePhoto: `${baseURL}${user.licensePhoto}` || `${baseURL}${user.licensePhoto}`,
        };
        break;

      case "owner":
        roleData = {
          phoneNumber: user.phoneNumber || null,
          companyName: user.companyName || null,
          correspondedMe: user.correspondedMe || null,
        };
        break;

      case "superadmin":
        roleData = {
          message: "Super admin access granted",
          phoneNumber: user.phoneNumber || null,
          city: user.city,
          country: user.country,
        };
        break;

      default:
        roleData = {
          message: "Standard user profile",
        };
    }

    return res.status(200).json({
      success: true,
      message: "Profile fetched successfully",
      user: {
        id: user._id,
        // name: user.name,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        avatar: `${baseURL}${user.profileImage}` || `${baseURL}${user.avatar}`,
        profileImage: `${baseURL}${user.profileImage}` || `${baseURL}${user.avatar}`,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        ...roleData,
      },
    });
  } catch (error) {
    console.error("Error fetching profile:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * PUT : Method
 * Common Function
 * Update Profile data of users
 */
export const updateProfile = async (req, res) => {
  try {
    const authUser = req.user;
    const userId = authUser.id || authUser._id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(400).json({ success: false, message: "User not found" });
    }

    const role = user.role?.toLowerCase();
    const data = req.body;
    
    // Validate based on role
    const { error } = validateUpdateProfile(data, role);
    if (error) {
      // Delete uploaded file if validation fails
      if (req.file) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (err) {
          console.warn('Error deleting file:', err);
        }
      }
      return res.status(400).json({
        success: false,
        message: error.details ? error.details[0].message : error.message,
      });
    }

    // Check email uniqueness if being changed
    if (data.email && data.email !== user.email) {
      const existingUser = await User.findOne({ email: data.email });
      if (existingUser) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(400).json({
          success: false,
          message: "Email already exists",
        });
      }
    }

    // --- Update logic per role ---
    switch (role) {
      case "driver":
        if (data.fullName) user.fullName = data.fullName;
        if (data.phoneNumber) user.phoneNumber = data.phoneNumber;
        if (data.email) user.email = data.email;
        
        // Driver-specific fields
        if (data.licenseNumber) {
          // Check license uniqueness
          if (data.licenseNumber !== user.licenseNumber) {
            const existingLicense = await User.findOne({ licenseNumber: data.licenseNumber });
            if (existingLicense) {
              if (req.file) fs.unlinkSync(req.file.path);
              return res.status(400).json({
                success: false,
                message: "License number already exists",
              });
            }
          }
          user.licenseNumber = data.licenseNumber;
        }
        if (data.municipality) user.municipality = data.municipality;
        // if (data.vehicleRegistration !== undefined) user.vehicleRegistration = data.vehicleRegistration;
        if (data.validUntil) {
          if (new Date(data.validUntil) <= new Date()) {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(400).json({
              success: false,
              message: "Valid Until date must be in the future",
            });
          }
          user.validUntil = data.validUntil;
        }
        if (data.city) user.city = data.city;
        if (data.country) user.country = data.country;
        if (data.dob) user.dob = data.dob;
        break;

      case "owner":
        if (data.fullName) user.fullName = data.fullName;
        if (data.phoneNumber) user.phoneNumber = data.phoneNumber;
        if (data.email) user.email = data.email;
        if (data.companyName) user.companyName = data.companyName;
        if (data.correspondedMe) user.correspondedMe = data.correspondedMe;
        break;

      case "superadmin":
        if (data.fullName) user.fullName = data.fullName;
        // if (data.surname) user.surname = data.surname;
        if (data.phoneNumber) user.phoneNumber = data.phoneNumber;
        if (data.email) user.email = data.email;
        if (data.city) user.city = data.city;
        if (data.country) user.country = data.country;
        break;

      default:
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(403).json({
          success: false,
          message: "You are not allowed to update this profile.",
        });
    }

    // Handle file upload (support both avatar and profileImage)
    if (req.file) {
      // Delete old avatar/profileImage
      const oldImagePath = user.avatar || user.profileImage;
      if (oldImagePath) {
        try {
          const oldPath = path.join(process.cwd(), oldImagePath);
          if (fs.existsSync(oldPath)) {
            fs.unlinkSync(oldPath);
          }
        } catch (err) {
          console.warn('Error deleting old image:', err);
        }
      }
      
      // Save new image path (support both fields)
      const newImagePath = `/uploads/profiles/${req.file.filename}`;
      user.avatar = newImagePath;
      user.profileImage = newImagePath;
    }

    await user.save();
    const baseURL = `${req.protocol}://${req.get("host")}`;

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully!",
      user: {
        id: user._id,
        name: user.name,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        phoneNumber: user.phoneNumber,
        avatar: `${baseURL}${user.avatar}` || `${baseURL}${user.profileImage}`,
        profileImage: `${baseURL}${user.profileImage}` || `${baseURL}${user.avatar}`,
        ...(role === "driver" && {
          licenseNumber: user.licenseNumber,
          municipality: user.municipality,
          // vehicleRegistration: user.vehicleRegistration,
          validUntil: user.validUntil,
          city: user.city,
          country: user.country,
          dob: user.dob,
        }),
        ...(role === "owner" && {
          companyName: user.companyName,
          correspondedMe: user.correspondedMe,
        }),
        ...(role === "superadmin" && {
          city: user.city,
          country: user.country,
        }),
      },
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    
    // Delete uploaded file on error
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (err) {
        console.warn('Error deleting file:', err);
      }
    }
    
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * PUT : Method
 * Change Password
 */
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const authUser = req.user;
    const userId = authUser.id || authUser._id;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters long",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "User not found",
      });
    }

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    // Update password (will be hashed by pre-save hook)
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * DELETE : Method
 * Delete profile image/avatar
 */
export const deleteProfileImage = async (req, res) => {
  try {
    const authUser = req.user;
    const userId = authUser.id || authUser._id;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "User not found",
      });
    }

    const imagePath = user.avatar || user.profileImage;
    if (!imagePath) {
      return res.status(400).json({
        success: false,
        message: "No profile image to delete",
      });
    }

    // Delete image file
    try {
      const fullPath = path.join(process.cwd(), imagePath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    } catch (err) {
      console.warn('Error deleting image file:', err);
    }

    user.avatar = null;
    user.profileImage = null;
    await user.save();

    res.json({
      success: true,
      message: "Profile image deleted successfully",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};