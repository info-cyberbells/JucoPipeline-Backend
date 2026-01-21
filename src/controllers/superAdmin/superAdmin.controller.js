import User from "../../models/user.model.js";
import VideoRequest from "../../models/videoRequest.model.js";
import { sendApprovalEmail, sendRejectionEmail } from "../../services/email.service.js";
import { generateSuperStrongPassword } from "../../utils/passwordGenerator.js";

// Helper to format user data with full URLs
const formatUserData = (user, baseURL) => {
  const userData = user.toObject();
  
  if (userData.profileImage && !userData.profileImage.startsWith("http")) {
    userData.profileImage = `${baseURL}${userData.profileImage}`;
  }
  
  if (userData.photoIdDocuments && userData.photoIdDocuments.length > 0) {
    userData.photoIdDocuments = userData.photoIdDocuments.map(doc => ({
      ...doc,
      documentUrl: doc.documentUrl.startsWith("http") ? doc.documentUrl : `${baseURL}${doc.documentUrl}`
    }));
  }
  
  delete userData.password;
  return userData;
};

// ============= PENDING APPROVALS =============

// Get all pending approvals
export const getPendingApprovalsOLDWITHOUTCOUNTKEY = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      sortBy = "createdAt", 
      sortOrder = "desc",
      role 
    } = req.query;

    const filter = { registrationStatus: "pending" };
    
    // Filter by role if provided
    if (role && role !== "all") {
      filter.role = role;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

    const [pendingUsers, totalCount] = await Promise.all([
      User.find(filter)
        .select("firstName lastName email role teamName phoneNumber createdAt registrationStatus profileImage")
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments(filter)
    ]);

    const baseURL = `${req.protocol}://${req.get("host")}`;
    const formattedUsers = pendingUsers.map(user => formatUserData(user, baseURL));

    res.json({
      message: "Pending approvals retrieved successfully",
      pendingApprovals: formattedUsers,
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

export const getPendingApprovals = async (req, res) => {
  try {
    const { page = 1, limit = 10,  sortBy = "createdAt",  sortOrder = "desc", role } = req.query;
    const filter = { registrationStatus: "pending" };
    if (role && role !== "all") {
      filter.role = role;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = { [sortBy]: sortOrder === "asc" ? 1 : -1 };
    const [ pendingUsers, totalPendingCount, totalUsers, totalPlayers, totalCoaches, totalScouts, totalPendingPlayers] = await Promise.all([User.find(filter).populate("team", "name").select("firstName lastName email role team phoneNumber createdAt registrationStatus profileImage").sort(sortOptions).skip(skip).limit(parseInt(limit)),
      User.countDocuments(filter),
      // Counts
      User.countDocuments({ role: { $in: ["player", "coach", "scout"] } }),
      User.countDocuments({ role: "player" }),
      User.countDocuments({ role: "coach" }),
      User.countDocuments({ role: "scout" }),
      User.countDocuments({ role: "player", registrationStatus: "pending" })
    ]);

    const baseURL = `${req.protocol}://${req.get("host")}`;
    const formattedUsers = pendingUsers.map(user =>
      formatUserData(user, baseURL)
    );

    res.json({
      message: "Pending approvals retrieved successfully",
      summary: {
        totalUsers,
        totalPlayers,
        totalCoaches,
        totalScouts,
        pendingApprovals: totalPendingPlayers,
        scrapeJobsInProgress: "",
        videoUploadRequests: ""
      },

      // List data
      pendingApprovals: formattedUsers,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalPendingCount / parseInt(limit)),
        totalCount: totalPendingCount,
        limit: parseInt(limit),
        hasMore: skip + formattedUsers.length < totalPendingCount
      }
    });
  } catch (error) {
    console.error("Pending Approval Error:", error);
    res.status(500).json({ message: error.message });
  }
};


// Get user details by ID (for "View Profile" action)
export const getUserDetails = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).populate("team", "name").select("-password");
    
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    const baseURL = `${req.protocol}://${req.get("host")}`;
    const userData = formatUserData(user, baseURL);

    res.json({
      message: "User details retrieved successfully",
      user: userData
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Approve user
export const approveUserOLDDDFUNCATION = async (req, res) => {
  try {
    const { userId } = req.params;
    const adminId = req.user.id;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    if (user.registrationStatus === "approved") {
      return res.status(400).json({ message: "User already approved" });
    }

    // Update user status
    user.registrationStatus = "approved";
    user.approvedBy = adminId;
    user.approvedAt = new Date();
    await user.save();

    // TODO: Send approval email to user
    // await sendApprovalEmail(user);

    const baseURL = `${req.protocol}://${req.get("host")}`;
    const userData = formatUserData(user, baseURL);

    res.json({
      message: "User approved successfully",
      user: userData
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const approveUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const adminId = req.user.id;
    
    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    // Check if already approved
    if (user.registrationStatus === "approved") {
      return res.status(400).json({ message: "User already approved" });
    }

    // Check if user has email
    if (!user.email) {
      return res.status(400).json({ 
        message: "Cannot approve user without email address" 
      });
    }

    // Generate temporary password
    const tempPassword = generateSuperStrongPassword();
    //console.log('tempPassword',tempPassword);
    // Update user with temp password
    user.password = tempPassword;
    user.tempPassword = tempPassword;
    user.registrationStatus = "approved";
    user.approvedBy = adminId;
    user.approvedAt = new Date();
    await user.save();

    // Send approval email
    try {
      await sendApprovalEmail(user, tempPassword);
    } catch (emailError) {
      console.error("Email sending failed:", emailError);
      return res.status(200).json({
        message: "User approved successfully, but email notification failed. Please contact the user manually.",
        user: formatUserData(user, `${req.protocol}://${req.get("host")}`),
        warning: "Email delivery failed"
      });
    }

    const baseURL = `${req.protocol}://${req.get("host")}`;
    const userData = formatUserData(user, baseURL);
    res.json({
      message: "User approved successfully and credentials sent via email",
      user: userData
    });

  } catch (error) {
    console.error("Approve User Error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Reject user
export const rejectUserOLLDDDDD = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    if (user.registrationStatus === "rejected") {
      return res.status(400).json({ message: "User already rejected" });
    }

    // Update user status
    user.registrationStatus = "rejected";
    user.rejectionReason = reason || "Not specified";
    await user.save();

    // TODO: Send rejection email to user
    // await sendRejectionEmail(user);

    const baseURL = `${req.protocol}://${req.get("host")}`;
    const userData = formatUserData(user, baseURL);

    res.json({
      message: "User rejected successfully",
      user: userData
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const rejectUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;
    const adminId = req.user.id;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    if (user.registrationStatus === "rejected") {
      return res.status(400).json({ message: "User already rejected" });
    }

    // Update user status
    user.registrationStatus = "rejected";
    user.rejectionReason = reason || "Not specified";
    user.approvedBy = adminId; // Track who rejected
    user.approvedAt = new Date();
    
    await user.save();

    // Send rejection email if user has email
    if (user.email) {
      try {
        await sendRejectionEmail(user, reason);
      } catch (emailError) {
        console.error("Rejection email failed:", emailError);
      }
    }

    const baseURL = `${req.protocol}://${req.get("host")}`;
    const userData = formatUserData(user, baseURL);

    res.json({
      message: "User rejected successfully",
      user: userData
    });

  } catch (error) {
    console.error("Reject User Error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Get counts for dashboard summary
export const getPendingCounts = async (req, res) => {
  try {
    const [totalPending, playersPending, coachPending, scoutPending] = await Promise.all([
      User.countDocuments({ registrationStatus: "pending" }),
      User.countDocuments({ registrationStatus: "pending", role: "player" }),
      User.countDocuments({ registrationStatus: "pending", role: "coach" }),
      User.countDocuments({ registrationStatus: "pending", role: "scout" })
    ]);

    res.json({
      message: "Pending counts retrieved successfully",
      counts: {
        total: totalPending,
        players: playersPending,
        coaches: coachPending,
        scouts: scoutPending
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// Requests Video
export const getVideoRequestsOLDD = async (req, res) => {
  try {
    if (req.user.role !== "superAdmin") {
      return res.status(403).json({ message: "Admin access required" });
    }
    
    const requests = await VideoRequest.find()
      .populate("player", "firstName lastName email phoneNumber profileImage")
      .populate("requestedBy", "firstName lastName email phoneNumber profileImage")
      .sort({ createdAt: -1 });

    res.json({
      message: "Video requests retrieved successfully",
      requests
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getVideoRequests = async (req, res) => {
  try {
    if (req.user.role !== "superAdmin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    const BASE_URL = `${req.protocol}://${req.get("host")}`;
    const requests = await VideoRequest.find().populate("player", "firstName lastName email phoneNumber profileImage").populate("requestedBy", "firstName lastName email phoneNumber profileImage").sort({ createdAt: -1 }).lean();
    const formattedRequests = requests.map(reqItem => ({
      ...reqItem,
      player: reqItem.player && {
        ...reqItem.player,
        profileImage: reqItem.player.profileImage
          ? reqItem.player.profileImage.startsWith("http")
            ? reqItem.player.profileImage
            : `${BASE_URL}${reqItem.player.profileImage}`
          : null
      },
      requestedBy: reqItem.requestedBy && {
        ...reqItem.requestedBy,
        profileImage: reqItem.requestedBy.profileImage
          ? reqItem.requestedBy.profileImage.startsWith("http")
            ? reqItem.requestedBy.profileImage
            : `${BASE_URL}${reqItem.requestedBy.profileImage}`
          : null
      }
    }));

    res.json({
      message: "Video requests retrieved successfully",
      requests: formattedRequests
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Requests Video Update
export const updateVideoRequestStatus = async (req, res) => {
  try {
    const adminId = req.user.id;
    const { status } = req.body;

    if (!["approved", "rejected", "completed"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const request = await VideoRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    request.status = status;
    request.handledBy = adminId;
    request.handledAt = new Date();
    await request.save();

    res.json({
      message: "Video request updated successfully",
      request
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};