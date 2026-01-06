import User from "../../models/user.model.js";
import mongoose from "mongoose";

// GET ALL SCRAPE JOBS
export const getAllScrapeJobs = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, status, sortBy = "lastCsvImport", sortOrder = "desc" } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build filter
    const filter = {
      csvImported: true,
      lastCsvImport: { $exists: true, $ne: null }
    };

    // Search filter
    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } }
      ];
    }

    // Status filter (registration status)
    if (status && status !== "all") {
      filter.registrationStatus = status;
    }

    // Build sort
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "asc" ? 1 : -1;

    // Get scrape jobs (players imported via CSV)
    const [scrapeJobs, totalCount] = await Promise.all([
      User.find(filter)
        .populate('team', 'name logo location division')
        .select("firstName lastName email team position jerseyNumber profileImage registrationStatus lastCsvImport csvImported createdAt")
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments(filter)
    ]);

    const baseURL = `${req.protocol}://${req.get("host")}`;

    // Format scrape jobs
    const formattedJobs = scrapeJobs.map(player => {
      const data = player.toObject();

      // Format profile image
      if (data.profileImage && !data.profileImage.startsWith("http")) {
        data.profileImage = `${baseURL}${data.profileImage}`;
      }

      // Format team logo
      if (data.team?.logo && !data.team.logo.startsWith("http")) {
        data.team.logo = `${baseURL}${data.team.logo}`;
      }

      // Format date (e.g., "Aug 5, 2025")
      const lastRun = data.lastCsvImport 
        ? new Date(data.lastCsvImport).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          })
        : "N/A";

      return {
        _id: data._id,
        jobName: `${data.firstName} ${data.lastName}`,
        playerName: `${data.firstName} ${data.lastName}`,
        sourceUrl: data.team ? `Team: ${data.team.name}` : "N/A",
        schedule: "CSV Import",
        mappingSet: "Player Stats",
        lastRun: lastRun,
        status: data.registrationStatus === "approved" ? "Active" : "Pending",
        registrationStatus: data.registrationStatus,
        team: data.team,
        position: data.position || "N/A",
        jerseyNumber: data.jerseyNumber || "N/A",
        profileImage: data.profileImage,
        csvImported: data.csvImported,
        lastCsvImport: data.lastCsvImport,
        createdAt: data.createdAt
      };
    });

    res.json({
      message: "Scrape jobs retrieved successfully",
      scrapeJobs: formattedJobs,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalCount,
        limit: parseInt(limit),
        hasMore: skip + formattedJobs.length < totalCount
      }
    });
  } catch (error) {
    console.error("Get Scrape Jobs Error:", error);
    res.status(500).json({ message: error.message });
  }
};

// GET SCRAPE JOB BY ID
export const getScrapeJobById = async (req, res) => {
  try {
    const { jobId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(jobId)) {
      return res.status(400).json({ message: "Invalid job ID format" });
    }

    const player = await User.findById(jobId)
      .populate('team', 'name logo location division region rank coachName')
      .select("-password -photoIdDocuments");

    if (!player) {
      return res.status(400).json({ message: "Scrape job not found" });
    }

    const baseURL = `${req.protocol}://${req.get("host")}`;
    const data = player.toObject();

    // Format profile image
    if (data.profileImage && !data.profileImage.startsWith("http")) {
      data.profileImage = `${baseURL}${data.profileImage}`;
    }

    // Format team logo
    if (data.team?.logo && !data.team.logo.startsWith("http")) {
      data.team.logo = `${baseURL}${data.team.logo}`;
    }

    // Format date
    const lastRun = data.lastCsvImport 
      ? new Date(data.lastCsvImport).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        })
      : "N/A";

    res.json({
      message: "Scrape job retrieved successfully",
      scrapeJob: {
        ...data,
        jobName: `${data.firstName} ${data.lastName}`,
        lastRun: lastRun
      }
    });
  } catch (error) {
    console.error("Get Scrape Job Error:", error);
    res.status(500).json({ message: error.message });
  }
};

// DELETE SCRAPE JOB
export const deleteScrapeJob = async (req, res) => {
  try {
    const { jobId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(jobId)) {
      return res.status(400).json({ message: "Invalid job ID format" });
    }

    const player = await User.findByIdAndDelete(jobId);

    if (!player) {
      return res.status(400).json({ message: "Scrape job not found" });
    }

    res.json({
      message: "Scrape job deleted successfully",
      deletedJob: {
        _id: player._id,
        jobName: `${player.firstName} ${player.lastName}`
      }
    });
  } catch (error) {
    console.error("Delete Scrape Job Error:", error);
    res.status(500).json({ message: error.message });
  }
};

// GET SCRAPE JOBS STATISTICS
export const getScrapeJobsStats = async (req, res) => {
  try {
    const [totalJobs, activeJobs, pendingJobs, recentImports] = await Promise.all([
      // Total CSV imported players
      User.countDocuments({ csvImported: true }),
      
      // Active (approved) players
      User.countDocuments({ csvImported: true, registrationStatus: "approved" }),
      
      // Pending players
      User.countDocuments({ csvImported: true, registrationStatus: "pending" }),
      
      // Recent imports (last 7 days)
      User.countDocuments({
        csvImported: true,
        lastCsvImport: {
          $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        }
      })
    ]);

    res.json({
      message: "Scrape jobs statistics retrieved successfully",
      stats: {
        totalJobs,
        activeJobs,
        pendingJobs,
        recentImports
      }
    });
  } catch (error) {
    console.error("Get Scrape Jobs Stats Error:", error);
    res.status(500).json({ message: error.message });
  }
};

// UPDATE PLAYER FROM SCRAPE JOB
export const updateScrapeJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { registrationStatus } = req.body;

    if (!mongoose.Types.ObjectId.isValid(jobId)) {
      return res.status(400).json({ message: "Invalid job ID format" });
    }

    if (!["pending", "approved", "rejected"].includes(registrationStatus)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const player = await User.findByIdAndUpdate(
      jobId,
      { 
        commitmentStatus: registrationStatus === 'approved' ? 'committed' : 'uncommitted',
        commitmentUpdatedByAdmin: true,
        registrationStatus,
        approvedBy: req.user.id,
        approvedAt: new Date()
      },
      { new: true }
    ).populate('team', 'name logo location division');

    if (!player) {
      return res.status(400).json({ message: "Scrape job not found" });
    }

    const baseURL = `${req.protocol}://${req.get("host")}`;
    const data = player.toObject();

    // Format images
    if (data.profileImage && !data.profileImage.startsWith("http")) {
      data.profileImage = `${baseURL}${data.profileImage}`;
    }
    if (data.team?.logo && !data.team.logo.startsWith("http")) {
      data.team.logo = `${baseURL}${data.team.logo}`;
    }

    res.json({
      message: "Scrape job status updated successfully",
      scrapeJob: {
        _id: data._id,
        jobName: `${data.firstName} ${data.lastName}`,
        registrationStatus: data.registrationStatus,
        status: data.registrationStatus === "approved" ? "Active" : "Pending"
      }
    });
  } catch (error) {
    console.error("Update Scrape Job Status Error:", error);
    res.status(500).json({ message: error.message });
  }
};


export const getAllUsersByRole = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      role = "all",
      sortBy = "createdAt",
      sortOrder = "desc"
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Default allowed roles
    const allowedRoles = ["player", "coach", "scout"];

    // Build filter
    const filter = {};

    // Role filter
    if (role !== "all") {
      filter.role = role;
    } else {
      filter.role = { $in: allowedRoles };
    }

    // Sort
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "asc" ? 1 : -1;

    // Fetch users
    const [users, totalCount] = await Promise.all([
      User.find(filter)
        .select("-password -resetPasswordToken -resetPasswordExpires")
        .populate("team", "name logo division location")
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments(filter)
    ]);

    const baseURL = `${req.protocol}://${req.get("host")}`;

    // Format response
    const formattedUsers = users.map(user => {
      const data = user.toObject();

      if (data.profileImage && !data.profileImage.startsWith("http")) {
        data.profileImage = `${baseURL}${data.profileImage}`;
      }

      if (data.team?.logo && !data.team.logo.startsWith("http")) {
        data.team.logo = `${baseURL}${data.team.logo}`;
      }

      return data;
    });

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
    console.error("Get Users Error:", error);
    res.status(500).json({ message: error.message });
  }
};
