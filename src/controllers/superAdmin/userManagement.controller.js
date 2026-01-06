import User from "../../models/user.model.js";
import mongoose from "mongoose";

// Helper to format user data
const formatUserData = (user, baseURL) => {
  const userData = user.toObject();
  
  if (userData.profileImage && !userData.profileImage.startsWith("http")) {
    userData.profileImage = `${baseURL}${userData.profileImage}`;
  }
  
  delete userData.password;
  return userData;
};

// GET ALL USERS (WITH FILTERS)
export const getAllUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      role,
      status,
      commitmentStatus,
      search,
      sortBy = "updatedAt",
      sortOrder = "desc"
    } = req.query;

    const filter = {};

    // Filter by role
    if (role && role !== "all") {
      filter.role = role;
    }

    // Filter by registration status
    if (status && status !== "all") {
      filter.registrationStatus = status;
    }

    // Filter by commitment status
    if (commitmentStatus && commitmentStatus !== "all") {
      filter.commitmentStatus = commitmentStatus;
    }

    // Search functionality
    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { teamName: { $regex: search, $options: 'i' } },
        { school: { $regex: search, $options: 'i' } },
        { organization: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

    const [users, totalCount] = await Promise.all([
      User.find(filter)
        .select("-password")
        .populate('manualEditBy', 'firstName lastName email role')
        .populate('approvedBy', 'firstName lastName email role')
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments(filter)
    ]);

    const baseURL = `${req.protocol}://${req.get("host")}`;
    const formattedUsers = users.map(user => formatUserData(user, baseURL));

    res.json({
      message: "Users retrieved successfully",
      users: formattedUsers,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalCount,
        limit: parseInt(limit),
        hasMore: skip + formattedUsers.length < totalCount
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET USER BY ID
export const getUserById = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const user = await User.findById(userId)
      .select("-password")
      .populate('approvedBy', 'firstName lastName email role')
      .populate('manualEditBy', 'firstName lastName email role');

    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    const baseURL = `${req.protocol}://${req.get("host")}`;
    const userData = formatUserData(user, baseURL);

    res.json({
      message: "User retrieved successfully",
      user: userData
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// UPDATE USER (MANUAL EDIT)
export const updateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const {
      firstName,
      lastName,
      email,
      phoneNumber,
      organization,
      role,
      certificate,
      registrationStatus,
      commitmentStatus,
      committedTo
    } = req.body;
    const adminId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    // Prevent role escalation to superAdmin
    if (role === "superAdmin" && user.role !== "superAdmin") {
      return res.status(403).json({ 
        message: "Cannot assign superAdmin role" 
      });
    }

    // Update fields
    if (firstName !== undefined) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;
    
    if (email !== undefined && email !== user.email) {
      // Check if email already exists
      const existingUser = await User.findOne({ 
        email: email.toLowerCase(), 
        _id: { $ne: userId } 
      });
      
      if (existingUser) {
        return res.status(400).json({ 
          message: "Email already in use by another user" 
        });
      }
      user.email = email.toLowerCase();
    }

    if (phoneNumber !== undefined) user.phoneNumber = phoneNumber;
    if (organization !== undefined) user.organization = organization;
    if (role !== undefined) user.role = role;
    if (certificate !== undefined) user.certificate = certificate;
    
    if (registrationStatus !== undefined) {
      user.registrationStatus = registrationStatus;
      if (registrationStatus === "approved") {
        user.approvedBy = adminId;
        user.approvedAt = new Date();
      }
    }

    if (commitmentStatus !== undefined) user.commitmentStatus = commitmentStatus;
    if (committedTo !== undefined) user.committedTo = committedTo;

    // Update manual edit tracking
    user.lastManualEdit = new Date();
    user.manualEditBy = adminId;

    await user.save();

    const updatedUser = await User.findById(userId)
      .select("-password")
      .populate('approvedBy', 'firstName lastName email role')
      .populate('manualEditBy', 'firstName lastName email role');

    const baseURL = `${req.protocol}://${req.get("host")}`;
    const userData = formatUserData(updatedUser, baseURL);

    res.json({
      message: "User updated successfully",
      user: userData
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// UPDATE USER STATUS
export const updateUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { isActive } = req.body;
    const adminId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    user.isActive = isActive;
    user.lastManualEdit = new Date();
    user.manualEditBy = adminId;

    await user.save();

    res.json({
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        isActive: user.isActive
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// DELETE USER
export const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    // Prevent deleting superAdmin
    if (user.role === "superAdmin") {
      return res.status(403).json({ 
        message: "Cannot delete super admin account" 
      });
    }

    await User.findByIdAndDelete(userId);

    res.json({
      message: "User deleted successfully"
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET USER COUNTS BY ROLE
export const getUserCountsByRole = async (req, res) => {
  try {
    const [
      totalUsers, 
      players, 
      coaches, 
      scouts, 
      approved, 
      pending, 
      rejected,
      activeUsers,
      inactiveUsers
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: "player" }),
      User.countDocuments({ role: "coach" }),
      User.countDocuments({ role: "scout" }),
      User.countDocuments({ registrationStatus: "approved" }),
      User.countDocuments({ registrationStatus: "pending" }),
      User.countDocuments({ registrationStatus: "rejected" }),
      User.countDocuments({ isActive: true }),
      User.countDocuments({ isActive: false })
    ]);

    res.json({
      message: "User counts retrieved successfully",
      counts: {
        total: totalUsers,
        players,
        coaches,
        scouts,
        approved,
        pending,
        rejected,
        active: activeUsers,
        inactive: inactiveUsers
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET RECENTLY EDITED USERS
export const getRecentlyEditedUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const filter = {
      lastManualEdit: { $ne: null }
    };

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [users, totalCount] = await Promise.all([
      User.find(filter)
        .select("-password")
        .populate('manualEditBy', 'firstName lastName email role')
        .sort({ lastManualEdit: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments(filter)
    ]);

    const baseURL = `${req.protocol}://${req.get("host")}`;
    const formattedUsers = users.map(user => formatUserData(user, baseURL));

    res.json({
      message: "Recently edited users retrieved successfully",
      users: formattedUsers,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalCount,
        limit: parseInt(limit),
        hasMore: skip + formattedUsers.length < totalCount
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET Manual Edit USERS BY Admin
export const manualEditListing = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      role,
      status,
      commitmentStatus,
      search,
      sortBy = "updatedAt",
      sortOrder = "desc"
    } = req.query;

    const filter = {
      commitmentUpdatedByAdmin : true,
    };

    // Filter by role
    if (role && role !== "all") {
      filter.role = role;
    }

    // Filter by registration status
    if (status && status !== "all") {
      filter.registrationStatus = status;
    }

    // Filter by commitment status
    if (commitmentStatus && commitmentStatus !== "all") {
      filter.commitmentStatus = commitmentStatus;
    }

    // Search functionality
    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { teamName: { $regex: search, $options: 'i' } },
        { school: { $regex: search, $options: 'i' } },
        { organization: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

    const [users, totalCount] = await Promise.all([
      User.find(filter)
        .select("-password")
        .populate('manualEditBy', 'firstName lastName email role')
        .populate('approvedBy', 'firstName lastName email role')
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments(filter)
    ]);

    const baseURL = `${req.protocol}://${req.get("host")}`;
    const formattedUsers = users.map(user => formatUserData(user, baseURL));

    res.json({
      message: "Users retrieved successfully",
      users: formattedUsers,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalCount,
        limit: parseInt(limit),
        hasMore: skip + formattedUsers.length < totalCount
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};