import User from "../../models/user.model.js";
import Follow from "../../models/follow.model.js";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";

// Helper function to calculate profile completeness
const calculateProfileCompleteness = (player) => {
  let score = 0;
  const completionItems = [];
  const missingItems = [];

  // Base profile info (assumed complete if player is registered) - 75%
  const baseProfileScore = 75;
  score = baseProfileScore;

  // Critical items for 100% completion (25% total)
  const criticalItems = [
    {
      key: 'videos',
      label: 'highlight video',
      weight: 8,
      check: () => player.videos && player.videos.length > 0
    },
    {
      key: 'coachRecommendation',
      label: 'coach recommendation',
      weight: 9,
      check: () => player.coachRecommendation && player.coachRecommendation.url
    },
    {
      key: 'awards',
      label: 'awards & achievements',
      weight: 8,
      check: () => player.awardsAchievements && player.awardsAchievements.length > 0
    }
  ];

  // Check each critical item
  criticalItems.forEach(item => {
    if (item.check()) {
      score += item.weight;
      completionItems.push(item.label);
    } else {
      missingItems.push(item.label);
    }
  });

  return {
    percentage: Math.min(score, 100),
    completionItems,
    missingItems
  };
};

// Helper to format user data with full URLs
const formatPlayerData = (player, baseURL) => {
  const playerData = player.toObject();
  console.log('playerData',playerData)
  // Format profile image
  if (playerData.profileImage && !playerData.profileImage.startsWith("http")) {
    playerData.profileImage = `${baseURL}${playerData.profileImage}`;
  }
  
  // Format videos
  if (playerData.videos && playerData.videos.length > 0) {
    playerData.videos = playerData.videos.map(video => ({
      ...video,
      url: video.url.startsWith("http") ? video.url : `${baseURL}${video.url}`
    }));
  }
  
  // Format coach recommendation
  if (playerData.coachRecommendation && playerData.coachRecommendation.url) {
    if (!playerData.coachRecommendation.url.startsWith("http")) {
      playerData.coachRecommendation.url = `${baseURL}${playerData.coachRecommendation.url}`;
    }
  }

  if (playerData.acedemicInfo && playerData.acedemicInfo.url) {
    if (!playerData.acedemicInfo.url.startsWith("http")) {
      playerData.acedemicInfo.url = `${baseURL}${playerData.acedemicInfo.url}`;
    }
  }

  if (playerData.photoIdDocument && playerData.photoIdDocument.documentUrl) {
    if (!playerData.photoIdDocument.documentUrl.startsWith("http")) {
      playerData.photoIdDocument.documentUrl = `${baseURL}${playerData.photoIdDocument.documentUrl}`;
    }
  }
  
  // Calculate profile completeness
  const completeness = calculateProfileCompleteness(player);
  playerData.profileCompleteness = completeness.percentage;
  playerData.profileCompletion = {
    percentage: completeness.percentage,
    completedItems: completeness.completionItems,
    missingItems: completeness.missingItems,
    isComplete: completeness.percentage === 100
  };
  
  delete playerData.password;
  return playerData;
};

/**
 * Helper function to normalize season year
 * Converts: 2024 -> 2024, 2024-25 -> 2024, 2017-18 -> 2017
 */
const normalizeSeasonYear = (seasonYear) => {
  if (!seasonYear) return null;
  
  // If it's already a simple year like "2024"
  if (/^\d{4}$/.test(seasonYear)) {
    return seasonYear;
  }
  
  // If it's a range like "2024-25" or "2017-18", extract first year
  const match = seasonYear.match(/^(\d{4})-\d{2}$/);
  if (match) {
    return match[1];
  }
  
  return seasonYear;
};

/**
 * Filter stats array by season year
 */
const filterStatsByYear = (statsArray, targetYear) => {
  if (!targetYear || !statsArray || statsArray.length === 0) {
    return statsArray;
  }

  return statsArray.filter(stat => {
    const statYear = normalizeSeasonYear(stat.seasonYear);
    return statYear === targetYear;
  });
};

// Get player profile
export const getPlayerProfile = async (req, res) => {
  try {
    const playerId = req.user.id;
    
    const player = await User.findById(playerId).populate('team').select("-password");
    
    if (!player || player.role !== "player") {
      return res.status(400).json({ message: "Player not found" });
    }

    const baseURL = `${req.protocol}://${req.get("host")}`;
    const playerData = formatPlayerData(player, baseURL);

    res.json({
      message: "Player profile retrieved successfully",
      player: playerData
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update player profile
export const updatePlayerProfile = async (req, res) => {
  try {
    const playerId = req.user.id;
    const {
      title,
      description,
      primaryPosition,
      strengths,
      awardsAchievements,
      hometown,
      highSchool,
      previousSchool,
      instaURL,
      xURL, 
      gpa, sat, act, transferStatus, height, weight, commitmentStatus, playerClass
    } = req.body;

    const player = await User.findById(playerId);
    
    if (!player || player.role !== "player") {
      return res.status(400).json({ message: "Player not found" });
    }

    // Update fields
    if (title !== undefined) player.title = title;
    if (description !== undefined) player.description = description;
    if (primaryPosition !== undefined) player.primaryPosition = primaryPosition;
    if (strengths !== undefined) player.strengths = Array.isArray(strengths) ? strengths : [];
    if (awardsAchievements !== undefined) player.awardsAchievements = Array.isArray(awardsAchievements) ? awardsAchievements : [];
    if (hometown !== undefined) player.hometown = hometown;
    if (highSchool !== undefined) player.highSchool = highSchool;
    if (previousSchool !== undefined) player.previousSchool = previousSchool;
    if (instaURL !== undefined) player.instaURL = instaURL;
    if (xURL !== undefined) player.xURL = xURL;

    if (gpa !== undefined) player.gpa = gpa;
    if (sat !== undefined) player.sat = sat;
    if (act !== undefined) player.act = act;
    if (transferStatus !== undefined) player.transferStatus = transferStatus;
    if (height !== undefined) player.height = height;
    if (weight !== undefined) player.weight = weight;
    if (commitmentStatus !== undefined) player.commitmentStatus = commitmentStatus;
    if (playerClass !== undefined) player.playerClass = playerClass;

    if (player.highSchool?.trim()) {
      player.commitmentStatus = 'committed';
    }

    // Calculate and save profile completeness
    const completeness = calculateProfileCompleteness(player);
    player.profileCompleteness = completeness.percentage;

    await player.save();

    const baseURL = `${req.protocol}://${req.get("host")}`;
    const playerData = formatPlayerData(player, baseURL);

    res.json({
      message: "Profile updated successfully",
      player: playerData
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Upload player videos
export const uploadPlayerVideos = async (req, res) => {
  try {
    const playerId = req.user.id;
    
    if (!req.files || !req.files.videos || req.files.videos.length === 0) {
      return res.status(400).json({ message: "No video files uploaded" });
    }

    const player = await User.findById(playerId);
    
    if (!player || player.role !== "player") {
      return res.status(400).json({ message: "Player not found" });
    }

    // Limit to 2 videos total
    const currentVideoCount = player.videos ? player.videos.length : 0;
    const newVideoCount = req.files.videos.length;
    
    if (currentVideoCount + newVideoCount > 6) {
      // Delete uploaded files
      req.files.videos.forEach(file => {
        fs.unlinkSync(file.path);
      });
      return res.status(400).json({ 
        message: "Maximum 6 videos allowed. Please delete existing videos first." 
      });
    }

    // Add new videos
    const newVideos = req.files.videos.map(file => ({
      url: `/uploads/videos/${file.filename}`,
      title: req.body.videoTitle || file.originalname,
      uploadedAt: new Date(),
      fileSize: file.size
    }));

    if (!player.videos) player.videos = [];
    player.videos.push(...newVideos);

    // Calculate and save profile completeness
    const completeness = calculateProfileCompleteness(player);
    player.profileCompleteness = completeness.percentage;

    await player.save();

    const baseURL = `${req.protocol}://${req.get("host")}`;
    const playerData = formatPlayerData(player, baseURL);

    res.json({
      message: "Videos uploaded successfully",
      player: playerData
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete player video
export const deletePlayerVideo = async (req, res) => {
  try {
    const playerId = req.user.id;
    const { videoId } = req.params;

    const player = await User.findById(playerId);
    
    if (!player || player.role !== "player") {
      return res.status(400).json({ message: "Player not found" });
    }

    if (!player.videos || player.videos.length === 0) {
      return res.status(400).json({ message: "No videos found" });
    }

    // Find video by _id
    const videoIndex = player.videos.findIndex(
      video => video._id.toString() === videoId
    );

    if (videoIndex === -1) {
      return res.status(400).json({ message: "Video not found" });
    }

    const videoUrl = player.videos[videoIndex].url;
    
    // Delete file from filesystem
    try {
      // Remove the base URL if present
      const cleanUrl = videoUrl.replace(/^https?:\/\/[^\/]+/, '');
      const filePath = path.join(process.cwd(), cleanUrl);
      
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`Video file deleted: ${filePath}`);
      }
    } catch (err) {
      console.error("Error deleting video file:", err);
      // Continue even if file deletion fails
    }

    // Remove from array using _id
    player.videos = player.videos.filter(
      video => video._id.toString() !== videoId
    );

    // Calculate and save profile completeness
    const completeness = calculateProfileCompleteness(player);
    player.profileCompleteness = completeness.percentage;

    await player.save();

    const baseURL = `${req.protocol}://${req.get("host")}`;
    const playerData = formatPlayerData(player, baseURL);

    res.json({
      message: "Video deleted successfully",
      player: playerData
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Upload coach recommendation
export const uploadCoachRecommendation = async (req, res) => {
  try {
    const playerId = req.user.id;
    
    if (!req.files || !req.files.recommendation) {
      return res.status(400).json({ message: "No PDF file uploaded" });
    }

    const player = await User.findById(playerId);
    
    if (!player || player.role !== "player") {
      return res.status(400).json({ message: "Player not found" });
    }

    // Delete old recommendation if exists
    if (player.coachRecommendation && player.coachRecommendation.url) {
      try {
        const oldPath = path.join(process.cwd(), player.coachRecommendation.url);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      } catch (err) {
        console.error("Error deleting old recommendation:", err);
      }
    }

    const file = req.files.recommendation[0];
    
    player.coachRecommendation = {
      url: `/uploads/recommendations/${file.filename}`,
      filename: file.originalname,
      uploadedAt: new Date(),
      fileSize: file.size
    };

    // Calculate and save profile completeness
    const completeness = calculateProfileCompleteness(player);
    player.profileCompleteness = completeness.percentage;

    await player.save();

    const baseURL = `${req.protocol}://${req.get("host")}`;
    const playerData = formatPlayerData(player, baseURL);

    res.json({
      message: "Coach recommendation uploaded successfully",
      player: playerData
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete coach recommendation
export const deleteCoachRecommendation = async (req, res) => {
  try {
    const playerId = req.user.id;

    const player = await User.findById(playerId);
    
    if (!player || player.role !== "player") {
      return res.status(400).json({ message: "Player not found" });
    }

    if (!player.coachRecommendation || !player.coachRecommendation.url) {
      return res.status(400).json({ message: "No recommendation found" });
    }

    // Delete file from filesystem
    try {
      const filePath = path.join(process.cwd(), player.coachRecommendation.url);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (err) {
      console.error("Error deleting recommendation file:", err);
    }

    player.coachRecommendation = undefined;

    // Calculate and save profile completeness
    const completeness = calculateProfileCompleteness(player);
    player.profileCompleteness = completeness.percentage;

    await player.save();

    const baseURL = `${req.protocol}://${req.get("host")}`;
    const playerData = formatPlayerData(player, baseURL);

    res.json({
      message: "Coach recommendation deleted successfully",
      player: playerData
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Upload AcademicInfo
export const uploadAcademicInfo = async (req, res) => {
  try {
    const playerId = req.user.id;
    if (!req.files || !req.files.academicInfo) {
      return res.status(400).json({ message: "No PDF file uploaded" });
    }

    const player = await User.findById(playerId);
    
    if (!player || player.role !== "player") {
      return res.status(400).json({ message: "Player not found" });
    }

    // Delete old recommendation if exists
    if (player.acedemicInfo && player.acedemicInfo.url) {
      try {
        const oldPath = path.join(process.cwd(), player.acedemicInfo.url);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      } catch (err) {
        console.error("Error deleting old academic info:", err);
      }
    }

    const file = req.files.academicInfo[0];
    
    player.acedemicInfo = {
      url: `/uploads/academicinfos/${file.filename}`,
      filename: file.originalname,
      uploadedAt: new Date(),
      fileSize: file.size
    };

    await player.save();

    const baseURL = `${req.protocol}://${req.get("host")}`;
    const playerData = formatPlayerData(player, baseURL);

    res.json({
      message: "AcademicInfo uploaded successfully",
      player: playerData
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete AcademicInfo
export const deleteAcademicInfo = async (req, res) => {
  try {
    const playerId = req.user.id;
    const player = await User.findById(playerId);
    
    if (!player || player.role !== "player") {
      return res.status(400).json({ message: "Player not found" });
    }

    if (!player.acedemicInfo || !player.acedemicInfo.url) {
      return res.status(400).json({ message: "No Acedemic Information found" });
    }

    // Delete file from filesystem
    try {
      const filePath = path.join(process.cwd(), player.acedemicInfo.url);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (err) {
      console.error("Error deleting recommendation file:", err);
    }

    player.acedemicInfo = undefined;
    await player.save();

    const baseURL = `${req.protocol}://${req.get("host")}`;
    const playerData = formatPlayerData(player, baseURL);

    res.json({
      message: "Coach recommendation deleted successfully",
      player: playerData
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Add award
export const addAward = async (req, res) => {
  try {
    const playerId = req.user.id;
    const { award } = req.body;

    if (!award || !award.trim()) {
      return res.status(400).json({ message: "Award cannot be empty" });
    }

    const player = await User.findById(playerId);
    
    if (!player || player.role !== "player") {
      return res.status(400).json({ message: "Player not found" });
    }

    if (!player.awardsAchievements) player.awardsAchievements = [];
    
    if (player.awardsAchievements.includes(award.trim())) {
      return res.status(400).json({ message: "Award already exists" });
    }

    player.awardsAchievements.push(award.trim());
    
    // Calculate and save profile completeness
    const completeness = calculateProfileCompleteness(player);
    player.profileCompleteness = completeness.percentage;

    await player.save();

    const baseURL = `${req.protocol}://${req.get("host")}`;
    const playerData = formatPlayerData(player, baseURL);

    res.json({
      message: "Award added successfully",
      player: playerData
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Remove award
export const removeAward = async (req, res) => {
  try {
    const playerId = req.user.id;
    const { award } = req.body;

    const player = await User.findById(playerId);
    
    if (!player || player.role !== "player") {
      return res.status(400).json({ message: "Player not found" });
    }

    if (!player.awardsAchievements || player.awardsAchievements.length === 0) {
      return res.status(400).json({ message: "No awards found" });
    }

    player.awardsAchievements = player.awardsAchievements.filter(a => a !== award);
    
    // Calculate and save profile completeness
    const completeness = calculateProfileCompleteness(player);
    player.profileCompleteness = completeness.percentage;

    await player.save();

    const baseURL = `${req.protocol}://${req.get("host")}`;
    const playerData = formatPlayerData(player, baseURL);

    res.json({
      message: "Award removed successfully",
      player: playerData
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Add strength
export const addStrength = async (req, res) => {
  try {
    const playerId = req.user.id;
    const { strength } = req.body;

    if (!strength || !strength.trim()) {
      return res.status(400).json({ message: "Strength cannot be empty" });
    }

    const player = await User.findById(playerId);
    
    if (!player || player.role !== "player") {
      return res.status(400).json({ message: "Player not found" });
    }

    if (!player.strengths) player.strengths = [];
    
    // Check for duplicates
    if (player.strengths.includes(strength.trim())) {
      return res.status(400).json({ message: "Strength already exists" });
    }

    player.strengths.push(strength.trim());
    player.profileCompleteness = calculateProfileCompleteness(player);

    await player.save();

    const baseURL = `${req.protocol}://${req.get("host")}`;
    const playerData = formatPlayerData(player, baseURL);

    res.json({
      message: "Strength added successfully",
      player: playerData
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Remove strength
export const removeStrength = async (req, res) => {
  try {
    const playerId = req.user.id;
    const { strength } = req.body;

    const player = await User.findById(playerId);
    
    if (!player || player.role !== "player") {
      return res.status(400).json({ message: "Player not found" });
    }

    if (!player.strengths || player.strengths.length === 0) {
      return res.status(400).json({ message: "No strengths found" });
    }

    player.strengths = player.strengths.filter(s => s !== strength);
    player.profileCompleteness = calculateProfileCompleteness(player);

    await player.save();

    const baseURL = `${req.protocol}://${req.get("host")}`;
    const playerData = formatPlayerData(player, baseURL);

    res.json({
      message: "Strength removed successfully",
      player: playerData
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update player profile image
export const updatePlayerProfileImage = async (req, res) => {
  try {
    const playerId = req.user.id;
    
    if (!req.files || !req.files.profileImage) {
      return res.status(400).json({ message: "No image file uploaded" });
    }

    const player = await User.findById(playerId);
    
    if (!player || player.role !== "player") {
      return res.status(400).json({ message: "Player not found" });
    }

    // Delete old profile image if exists
    if (player.profileImage && !player.profileImage.startsWith("http")) {
      try {
        const oldPath = path.join(process.cwd(), player.profileImage);
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
    player.profileImage = `/uploads/profiles/${file.filename}`;

    await player.save();

    const baseURL = `${req.protocol}://${req.get("host")}`;
    const playerData = formatPlayerData(player, baseURL);

    res.json({
      message: "Profile image updated successfully",
      player: playerData
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete player profile image
export const deletePlayerProfileImage = async (req, res) => {
  try {
    const playerId = req.user.id;

    const player = await User.findById(playerId);
    
    if (!player || player.role !== "player") {
      return res.status(400).json({ message: "Player not found" });
    }

    if (!player.profileImage) {
      return res.status(400).json({ message: "No profile image found" });
    }

    // Don't delete if it's an external URL (from CSV import)
    if (!player.profileImage.startsWith("http")) {
      try {
        const filePath = path.join(process.cwd(), player.profileImage);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`Profile image deleted: ${filePath}`);
        }
      } catch (err) {
        console.error("Error deleting profile image file:", err);
      }
    }

    player.profileImage = null;

    await player.save();

    const baseURL = `${req.protocol}://${req.get("host")}`;
    const playerData = formatPlayerData(player, baseURL);

    res.json({
      message: "Profile image deleted successfully",
      player: playerData
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET PLAYER FULL DETAILS BY ID || NOT FOR AUTH USER
export const getPlayerById = async (req, res) => {
  try {
    const { playerId } = req.params;

    // Validate player ID format
    if (!mongoose.Types.ObjectId.isValid(playerId)) {
      return res.status(400).json({ message: "Invalid player ID format" });
    }

    // Find player and populate team data
    const player = await User.findOne({ _id: playerId, role: "player" }).populate('team', 'name logo location division region rank coachName home away neutral conference');

    if (!player) {
      return res.status(400).json({ message: "Player not found" });
    }

    // Format data
    const baseURL = `${req.protocol}://${req.get("host")}`;
    const playerData = player.toObject();

    // Format profile image
    if (playerData.profileImage && !playerData.profileImage.startsWith("http")) {
      playerData.profileImage = `${baseURL}${playerData.profileImage}`;
    }

    // Format team logo
    if (playerData.team?.logo && !playerData.team.logo.startsWith("http")) {
      playerData.team.logo = `${baseURL}${playerData.team.logo}`;
    }

    // Format videos
    if (playerData.videos && playerData.videos.length > 0) {
      playerData.videos = playerData.videos.map(video => ({
        _id: video._id,
        url: video.url.startsWith("http") ? video.url : `${baseURL}${video.url}`,
        title: video.title,
        uploadedAt: video.uploadedAt,
        fileSize: video.fileSize
      }));
    }

    // Format coach recommendation
    if (playerData.coachRecommendation?.url && !playerData.coachRecommendation.url.startsWith("http")) {
      playerData.coachRecommendation.url = `${baseURL}${playerData.coachRecommendation.url}`;
    }

    // Remove sensitive data
    delete playerData.password;
    delete playerData.photoIdDocuments;

    res.json({
      message: "Player details retrieved successfully",
      player: playerData
    });
  } catch (error) {
    console.error("Get Player Error:", error);
    res.status(500).json({ message: error.message });
  }
};

// GET UNCOMMITTED PLAYERS WITH FILTERS AND PAGINATION
export const getUncommittedPLayer = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      
      // === SEASON YEAR FILTER ===
      seasonYear,
      
      // === BATTING FILTERS ===
      batting_average_min,
      batting_average_max,
      on_base_percentage_min,
      on_base_percentage_max,
      slugging_percentage_min,
      slugging_percentage_max,
      home_runs_min,
      home_runs_max,
      rbi_min,
      rbi_max,
      hits_min,
      hits_max,
      runs_min,
      runs_max,
      doubles_min,
      doubles_max,
      triples_min,
      triples_max,
      walks_min,
      walks_max,
      strikeouts_min,
      strikeouts_max,
      stolen_bases_min,
      stolen_bases_max,
      
      // === PITCHING FILTERS ===
      era_min,
      era_max,
      wins_min,
      wins_max,
      losses_min,
      losses_max,
      strikeouts_pitched_min,
      strikeouts_pitched_max,
      innings_pitched_min,
      innings_pitched_max,
      walks_allowed_min,
      walks_allowed_max,
      hits_allowed_min,
      hits_allowed_max,
      saves_min,
      saves_max,
      
      // === FIELDING FILTERS ===
      fielding_percentage_min,
      fielding_percentage_max,
      errors_min,
      errors_max,
      putouts_min,
      putouts_max,
      assists_min,
      assists_max,
      double_plays_min,
      double_plays_max,

      commitmentStatus,
      name
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Base filter for uncommitted players
    const filter = {
      role: "player",
      registrationStatus : "approved"
    };

    // === COMMITMENT STATUS FILTER ===
    if (commitmentStatus) {
      filter.commitmentStatus = commitmentStatus; // committed | uncommitted
    }

    // === SEASON YEAR FILTER (CRITICAL FIX) ===
    if (seasonYear && seasonYear !== "all") {
      const normalizedYear = normalizeSeasonYear(seasonYear);

      filter.$or = [
        { battingStats: { $elemMatch: { seasonYear: { $regex: `^${normalizedYear}` } } } },
        { fieldingStats: { $elemMatch: { seasonYear: { $regex: `^${normalizedYear}` } } } },
        { pitchingStats: { $elemMatch: { seasonYear: { $regex: `^${normalizedYear}` } } } }
      ];
    }

    if (name) {
      const parts = name.trim().split(/\s+/);
      // console.log('parts',parts);
      if (parts.length === 1) {
        const regex = new RegExp(parts[0], "i");
        filter.$or = [
          { firstName: regex },
          { lastName: regex }
        ];
      } else {
        const firstName = parts[0];
        const lastName = parts[1];
        // console.log('FullName',firstName,lastName);
        filter.$and = [
          { firstName: new RegExp(firstName, "i") },
          { lastName: new RegExp(lastName, "i") }
        ];
      }
    }

    // === APPLY BATTING FILTERS ===
    if (batting_average_min || batting_average_max) {
      filter['battingStats.0.batting_average'] = {};
      if (batting_average_min) {
        filter['battingStats.0.batting_average'].$gte = parseFloat(batting_average_min);
      }
      if (batting_average_max) {
        filter['battingStats.0.batting_average'].$lte = parseFloat(batting_average_max);
      }
    }

    if (on_base_percentage_min || on_base_percentage_max) {
      filter['battingStats.0.on_base_percentage'] = {};
      if (on_base_percentage_min) {
        filter['battingStats.0.on_base_percentage'].$gte = parseFloat(on_base_percentage_min);
      }
      if (on_base_percentage_max) {
        filter['battingStats.0.on_base_percentage'].$lte = parseFloat(on_base_percentage_max);
      }
    }

    if (slugging_percentage_min || slugging_percentage_max) {
      filter['battingStats.0.slugging_percentage'] = {};
      if (slugging_percentage_min) {
        filter['battingStats.0.slugging_percentage'].$gte = parseFloat(slugging_percentage_min);
      }
      if (slugging_percentage_max) {
        filter['battingStats.0.slugging_percentage'].$lte = parseFloat(slugging_percentage_max);
      }
    }

    if (home_runs_min || home_runs_max) {
      filter['battingStats.0.home_runs'] = {};
      if (home_runs_min) {
        filter['battingStats.0.home_runs'].$gte = parseInt(home_runs_min);
      }
      if (home_runs_max) {
        filter['battingStats.0.home_runs'].$lte = parseInt(home_runs_max);
      }
    }

    if (rbi_min || rbi_max) {
      filter['battingStats.0.rbi'] = {};
      if (rbi_min) {
        filter['battingStats.0.rbi'].$gte = parseInt(rbi_min);
      }
      if (rbi_max) {
        filter['battingStats.0.rbi'].$lte = parseInt(rbi_max);
      }
    }

    if (hits_min || hits_max) {
      filter['battingStats.0.hits'] = {};
      if (hits_min) {
        filter['battingStats.0.hits'].$gte = parseInt(hits_min);
      }
      if (hits_max) {
        filter['battingStats.0.hits'].$lte = parseInt(hits_max);
      }
    }

    if (runs_min || runs_max) {
      filter['battingStats.0.runs'] = {};
      if (runs_min) {
        filter['battingStats.0.runs'].$gte = parseInt(runs_min);
      }
      if (runs_max) {
        filter['battingStats.0.runs'].$lte = parseInt(runs_max);
      }
    }

    if (doubles_min || doubles_max) {
      filter['battingStats.0.doubles'] = {};
      if (doubles_min) {
        filter['battingStats.0.doubles'].$gte = parseInt(doubles_min);
      }
      if (doubles_max) {
        filter['battingStats.0.doubles'].$lte = parseInt(doubles_max);
      }
    }

    if (triples_min || triples_max) {
      filter['battingStats.0.triples'] = {};
      if (triples_min) {
        filter['battingStats.0.triples'].$gte = parseInt(triples_min);
      }
      if (triples_max) {
        filter['battingStats.0.triples'].$lte = parseInt(triples_max);
      }
    }

    if (walks_min || walks_max) {
      filter['battingStats.0.walks'] = {};
      if (walks_min) {
        filter['battingStats.0.walks'].$gte = parseInt(walks_min);
      }
      if (walks_max) {
        filter['battingStats.0.walks'].$lte = parseInt(walks_max);
      }
    }

    if (strikeouts_min || strikeouts_max) {
      filter['battingStats.0.strikeouts'] = {};
      if (strikeouts_min) {
        filter['battingStats.0.strikeouts'].$gte = parseInt(strikeouts_min);
      }
      if (strikeouts_max) {
        filter['battingStats.0.strikeouts'].$lte = parseInt(strikeouts_max);
      }
    }

    if (stolen_bases_min || stolen_bases_max) {
      filter['battingStats.0.stolen_bases'] = {};
      if (stolen_bases_min) {
        filter['battingStats.0.stolen_bases'].$gte = parseInt(stolen_bases_min);
      }
      if (stolen_bases_max) {
        filter['battingStats.0.stolen_bases'].$lte = parseInt(stolen_bases_max);
      }
    }

    // === APPLY PITCHING FILTERS ===
    if (era_min || era_max) {
      filter['pitchingStats.0.era'] = {};
      if (era_min) {
        filter['pitchingStats.0.era'].$gte = parseFloat(era_min);
      }
      if (era_max) {
        filter['pitchingStats.0.era'].$lte = parseFloat(era_max);
      }
    }

    if (wins_min || wins_max) {
      filter['pitchingStats.0.wins'] = {};
      if (wins_min) {
        filter['pitchingStats.0.wins'].$gte = parseInt(wins_min);
      }
      if (wins_max) {
        filter['pitchingStats.0.wins'].$lte = parseInt(wins_max);
      }
    }

    if (losses_min || losses_max) {
      filter['pitchingStats.0.losses'] = {};
      if (losses_min) {
        filter['pitchingStats.0.losses'].$gte = parseInt(losses_min);
      }
      if (losses_max) {
        filter['pitchingStats.0.losses'].$lte = parseInt(losses_max);
      }
    }

    if (strikeouts_pitched_min || strikeouts_pitched_max) {
      filter['pitchingStats.0.strikeouts_pitched'] = {};
      if (strikeouts_pitched_min) {
        filter['pitchingStats.0.strikeouts_pitched'].$gte = parseInt(strikeouts_pitched_min);
      }
      if (strikeouts_pitched_max) {
        filter['pitchingStats.0.strikeouts_pitched'].$lte = parseInt(strikeouts_pitched_max);
      }
    }

    if (innings_pitched_min || innings_pitched_max) {
      filter['pitchingStats.0.innings_pitched'] = {};
      if (innings_pitched_min) {
        filter['pitchingStats.0.innings_pitched'].$gte = parseFloat(innings_pitched_min);
      }
      if (innings_pitched_max) {
        filter['pitchingStats.0.innings_pitched'].$lte = parseFloat(innings_pitched_max);
      }
    }

    if (walks_allowed_min || walks_allowed_max) {
      filter['pitchingStats.0.walks_allowed'] = {};
      if (walks_allowed_min) {
        filter['pitchingStats.0.walks_allowed'].$gte = parseInt(walks_allowed_min);
      }
      if (walks_allowed_max) {
        filter['pitchingStats.0.walks_allowed'].$lte = parseInt(walks_allowed_max);
      }
    }

    if (hits_allowed_min || hits_allowed_max) {
      filter['pitchingStats.0.hits_allowed'] = {};
      if (hits_allowed_min) {
        filter['pitchingStats.0.hits_allowed'].$gte = parseInt(hits_allowed_min);
      }
      if (hits_allowed_max) {
        filter['pitchingStats.0.hits_allowed'].$lte = parseInt(hits_allowed_max);
      }
    }

    if (saves_min || saves_max) {
      filter['pitchingStats.0.saves'] = {};
      if (saves_min) {
        filter['pitchingStats.0.saves'].$gte = parseInt(saves_min);
      }
      if (saves_max) {
        filter['pitchingStats.0.saves'].$lte = parseInt(saves_max);
      }
    }

    // === APPLY FIELDING FILTERS ===
    if (fielding_percentage_min || fielding_percentage_max) {
      filter['fieldingStats.0.fielding_percentage'] = {};
      if (fielding_percentage_min) {
        filter['fieldingStats.0.fielding_percentage'].$gte = parseFloat(fielding_percentage_min);
      }
      if (fielding_percentage_max) {
        filter['fieldingStats.0.fielding_percentage'].$lte = parseFloat(fielding_percentage_max);
      }
    }

    if (errors_min || errors_max) {
      filter['fieldingStats.0.errors'] = {};
      if (errors_min) {
        filter['fieldingStats.0.errors'].$gte = parseInt(errors_min);
      }
      if (errors_max) {
        filter['fieldingStats.0.errors'].$lte = parseInt(errors_max);
      }
    }

    if (putouts_min || putouts_max) {
      filter['fieldingStats.0.putouts'] = {};
      if (putouts_min) {
        filter['fieldingStats.0.putouts'].$gte = parseInt(putouts_min);
      }
      if (putouts_max) {
        filter['fieldingStats.0.putouts'].$lte = parseInt(putouts_max);
      }
    }

    if (assists_min || assists_max) {
      filter['fieldingStats.0.assists'] = {};
      if (assists_min) {
        filter['battingStats.0.assists'].$gte = parseInt(assists_min);
      }
      if (assists_max) {
        filter['fieldingStats.0.assists'].$lte = parseInt(assists_max);
      }
    }

    if (double_plays_min || double_plays_max) {
      filter['fieldingStats.0.double_plays'] = {};
      if (double_plays_min) {
        filter['fieldingStats.0.double_plays'].$gte = parseInt(double_plays_min);
      }
      if (double_plays_max) {
        filter['fieldingStats.0.double_plays'].$lte = parseInt(double_plays_max);
      }
    }

    // === COUNT AND FETCH PLAYERS ===
    const totalPlayers = await User.countDocuments(filter);
    const players = await User.find(filter).populate("team").skip(skip).limit(parseInt(limit)).sort({ createdAt: -1 });
    if (!players?.length) {
      if(name){
        return res.status(400).json({ message: "No uncommitted players found with this name" });
      } else if(seasonYear){
        return res.status(400).json({ message: "No uncommitted players found with this year" });
      } else {
        return res.status(400).json({ message: "No uncommitted players found" });
      }
    }

    // NORMALIZE SEASON YEAR FOR FILTERING
    const normalizedYear = seasonYear ? normalizeSeasonYear(seasonYear) : null;

    // Format players
    const baseURL = `${req.protocol}://${req.get("host")}`;
    const formattedPlayers = players
      .map(player => {
        const data = player.toObject();
        
        // FILTER STATS BY SEASON YEAR
        if (normalizedYear) {
          data.battingStats = filterStatsByYear(data.battingStats, normalizedYear);
          data.fieldingStats = filterStatsByYear(data.fieldingStats, normalizedYear);
          data.pitchingStats = filterStatsByYear(data.pitchingStats, normalizedYear);
        }
        
        if (data.profileImage && !data.profileImage.startsWith("http")) {
          data.profileImage = `${baseURL}${data.profileImage}`;
        }

        if (data.team?.logo && !data.team.logo.startsWith("http")) {
          data.team.logo = `${baseURL}${data.team.logo}`;
        }

        delete data.password;
        delete data.photoIdDocuments;
        return data;
      })
      // FILTER OUT PLAYERS WITH NO STATS FOR THE REQUESTED YEAR
      .filter(player => {
        // If no seasonYear filter, keep all players
        if (!normalizedYear) {
          return true;
        }
        
        // If seasonYear filter is applied, only keep players who have at least one stat for that year
        const hasBattingStats = player.battingStats && player.battingStats.length > 0;
        const hasFieldingStats = player.fieldingStats && player.fieldingStats.length > 0;
        const hasPitchingStats = player.pitchingStats && player.pitchingStats.length > 0;
        
        return hasBattingStats || hasFieldingStats || hasPitchingStats;
      });

    // CHECK IF NO PLAYERS AFTER FILTERING
    if (formattedPlayers.length === 0) {
      const seasonStartYear = parseInt(seasonYear);
      const seasonEndYear = (seasonStartYear + 1).toString().slice(-2);
      const seasonLabel = `${seasonStartYear}-${seasonEndYear}`;

      return res.status(400).json({ 
        message: `No players found with stats for season year ${seasonYear}`,
        formattedPlayers,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(formattedPlayers / parseInt(limit)),
          formattedPlayers,
          limit: parseInt(limit),
          hasMore: skip + formattedPlayers.length < formattedPlayers.length
        }
      });
    }

    res.json({
      message: "Uncommitted players retrieved successfully",
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalPlayers / parseInt(limit)),
      totalPlayers,
      limit: parseInt(limit),
      players: formattedPlayers
    });

  } catch (error) {
    console.error("Get Uncommitted Players Error:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Player Statistics
*/
// Helper to format user data
const formatUserData = (user, baseURL) => {
  const userData = user.toObject();
  
  if (userData.profileImage && !userData.profileImage.startsWith("http")) {
    userData.profileImage = `${baseURL}${userData.profileImage}`;
  }
  
  if (userData.team?.logo && !userData.team.logo.startsWith("http")) {
    userData.team.logo = `${baseURL}${userData.team.logo}`;
  }
  
  delete userData.password;
  return userData;
};

// GET TOP 10 PLAYERS BY METRIC
export const getTop10PlayersByMetric = async (req, res) => {
  try {
    const coachId = req.user.id;
    const {
      metric = "batting_average", // Default metric
      category = "batting", // batting, pitching, fielding
      position = "all",
      limit = 10
    } = req.query;

    const baseURL = `${req.protocol}://${req.get("host")}`;

    // Build filter
    const filter = { role: "player", registrationStatus: "approved", isActive: true};
    // Filter by position if specified
    if (position && position !== "all") {
      filter.position = { $regex: new RegExp(position, 'i') };
    }

    // Build sort field based on category and metric
    let sortField;
    let statsField;

    if (category === "batting") {
      sortField = `battingStats.0.${metric}`;
      statsField = "battingStats";
      filter['battingStats.0'] = { $exists: true };
    } else if (category === "pitching") {
      sortField = `pitchingStats.0.${metric}`;
      statsField = "pitchingStats";
      filter['pitchingStats.0'] = { $exists: true };
    } else if (category === "fielding") {
      sortField = `fieldingStats.0.${metric}`;
      statsField = "fieldingStats";
      filter['fieldingStats.0'] = { $exists: true };
    }

    // Determine sort order (lower is better for ERA, higher for others)
    const sortOrder = metric === "era" ? 1 : -1;

    // Get top players
    const players = await User.find(filter).populate('team').select(`firstName lastName profileImage position videos team ${statsField}`).sort({ [sortField]: sortOrder }).limit(parseInt(limit));
    // Get following status for players
    const playerIds = players.map(p => p._id);
    const followedPlayers = await Follow.find({ follower: coachId, following: { $in: playerIds }}).distinct('following');
    const followedSet = new Set(followedPlayers.map(id => id.toString()));

    // Format response
    const formattedPlayers = players.map((player, index) => {
      const userData = formatUserData(player, baseURL);
      // Get latest stats based on category
      let latestStats = {};
      let metricValue = 0;
      if (category === "batting") {
        latestStats = userData.battingStats?.[0] || {};
        metricValue = latestStats[metric] || 0;
      } else if (category === "pitching") {
        latestStats = userData.pitchingStats?.[0] || {};
        metricValue = latestStats[metric] || 0;
      } else if (category === "fielding") {
        latestStats = userData.fieldingStats?.[0] || {};
        metricValue = latestStats[metric] || 0;
      }

      return {
        rank: index + 1,
        _id: userData._id,
        name: `${userData.firstName} ${userData.lastName}`,
        profileImage: userData.profileImage,
        position: userData.position || "N/A",
        team: userData.team,
        previousSchool: latestStats.previousSchool || "-",
        newSchool: userData.team?.name || "-",
        gpa: latestStats.gpa || "3.8",
        region: userData.team?.region || "-",
        lastUpdate: userData.updatedAt,
        videos: userData.videos,
        metricValue: metricValue,
        era: category === "pitching" ? latestStats.era || 0 : null,
        record: category === "pitching" ? `${latestStats.wins || 0}-${latestStats.losses || 0}` : null,
        whip: category === "pitching" ? latestStats.whip || 0 : null,
        isFollowing: followedSet.has(userData._id.toString())
      };
    });

    res.json({
      message: "Top players retrieved successfully",
      category,
      metric,
      players: formattedPlayers,
      totalPlayers: formattedPlayers.length
    });
  } catch (error) {
    console.error("Get Top Players Error:", error);
    res.status(500).json({ message: error.message });
  }
};

// GET AVAILABLE METRICS
export const getAvailableMetrics = async (req, res) => {
  try {
    const metrics = {
      batting: [
        { value: "batting_average", label: "Batting AVG", sortOrder: "desc" },
        { value: "on_base_percentage", label: "On Base %", sortOrder: "desc" },
        { value: "slugging_percentage", label: "Slugging %", sortOrder: "desc" },
        { value: "home_runs", label: "Home Runs", sortOrder: "desc" },
        { value: "rbi", label: "RBI", sortOrder: "desc" },
        { value: "hits", label: "Hits", sortOrder: "desc" },
        { value: "runs", label: "Runs", sortOrder: "desc" },
        { value: "stolen_bases", label: "Stolen Bases", sortOrder: "desc" },
        { value: "walks", label: "Walks", sortOrder: "desc" }
      ],
      pitching: [
        { value: "era", label: "ERA", sortOrder: "asc" },
        { value: "wins", label: "Wins", sortOrder: "desc" },
        { value: "strikeouts_pitched", label: "Strikeouts", sortOrder: "desc" },
        { value: "saves", label: "Saves", sortOrder: "desc" },
        { value: "innings_pitched", label: "Innings Pitched", sortOrder: "desc" },
        { value: "complete_games", label: "Complete Games", sortOrder: "desc" },
        { value: "shutouts", label: "Shutouts", sortOrder: "desc" }
      ],
      fielding: [
        { value: "fielding_percentage", label: "Fielding %", sortOrder: "desc" },
        { value: "putouts", label: "Putouts", sortOrder: "desc" },
        { value: "assists", label: "Assists", sortOrder: "desc" },
        { value: "double_plays", label: "Double Plays", sortOrder: "desc" },
        { value: "errors", label: "Errors", sortOrder: "asc" }
      ]
    };

    res.json({
      message: "Available metrics retrieved successfully",
      metrics
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// SEARCH PLAYERS (For Statistics Page)
export const searchPlayersForStatistics = async (req, res) => {
  try {
    const coachId = req.user.id;
    const {
      search,
      category = "batting",
      metric = "batting_average",
      position = "all",
      team,
      page = 1,
      limit = 20
    } = req.query;

    const baseURL = `${req.protocol}://${req.get("host")}`;

    // Build filter
    const filter = {
      role: "player",
      registrationStatus: "approved",
      isActive: true
    };

    // Search by name
    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } }
      ];
    }

    // Filter by position
    if (position && position !== "all") {
      filter.position = { $regex: new RegExp(position, 'i') };
    }

    // Filter by team
    if (team && mongoose.Types.ObjectId.isValid(team)) {
      filter.team = team;
    }

    // Ensure stats exist
    if (category === "batting") {
      filter['battingStats.0'] = { $exists: true };
    } else if (category === "pitching") {
      filter['pitchingStats.0'] = { $exists: true };
    } else if (category === "fielding") {
      filter['fieldingStats.0'] = { $exists: true };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build sort
    let sortField;
    let statsField;

    if (category === "batting") {
      sortField = `battingStats.0.${metric}`;
      statsField = "battingStats";
    } else if (category === "pitching") {
      sortField = `pitchingStats.0.${metric}`;
      statsField = "pitchingStats";
    } else if (category === "fielding") {
      sortField = `fieldingStats.0.${metric}`;
      statsField = "fieldingStats";
    }

    const sortOrder = metric === "era" ? 1 : -1;

    const [players, totalCount] = await Promise.all([
      User.find(filter)
        .populate('team', 'name logo location division region')
        .select(`firstName lastName profileImage position team ${statsField} videos updatedAt`)
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments(filter)
    ]);

    // Get following status
    const playerIds = players.map(p => p._id);
    const followedPlayers = await Follow.find({
      follower: coachId,
      following: { $in: playerIds }
    }).distinct('following');

    const followedSet = new Set(followedPlayers.map(id => id.toString()));

    // Format response
    const formattedPlayers = players.map(player => {
      const userData = formatUserData(player, baseURL);
      
      let latestStats = {};
      let metricValue = 0;

      if (category === "batting") {
        latestStats = userData.battingStats?.[0] || {};
        metricValue = latestStats[metric] || 0;
      } else if (category === "pitching") {
        latestStats = userData.pitchingStats?.[0] || {};
        metricValue = latestStats[metric] || 0;
      } else if (category === "fielding") {
        latestStats = userData.fieldingStats?.[0] || {};
        metricValue = latestStats[metric] || 0;
      }

      return {
        _id: userData._id,
        name: `${userData.firstName} ${userData.lastName}`,
        profileImage: userData.profileImage,
        position: userData.position || "N/A",
        team: userData.team,
        gpa: "3.8",
        region: userData.team?.region || "-",
        lastUpdate: userData.updatedAt,
        videos: userData.videos?.length || 0,
        metricValue: metricValue,
        era: category === "pitching" ? latestStats.era || 0 : null,
        record: category === "pitching" 
          ? `${latestStats.wins || 0}-${latestStats.losses || 0}` 
          : null,
        whip: category === "pitching" ? latestStats.whip || 0 : null,
        isFollowing: followedSet.has(userData._id.toString())
      };
    });

    res.json({
      message: "Players retrieved successfully",
      category,
      metric,
      players: formattedPlayers,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalCount,
        limit: parseInt(limit),
        hasMore: skip + formattedPlayers.length < totalCount
      }
    });
  } catch (error) {
    console.error("Search Players Error:", error);
    res.status(500).json({ message: error.message });
  }
};
