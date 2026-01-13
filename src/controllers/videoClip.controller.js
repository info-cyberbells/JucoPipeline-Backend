import VideoClip from "../models/videoClip.model.js";
import User from "../models/user.model.js";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { createVideoClip as processVideoClip, ensureDirectoryExists } from "../utils/videoProcessor.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * @desc    Create a new video clip
 * @route   POST /api/coach/video-clips
 * @access  Private (Coach only)
 */
export const createVideoClip = async (req, res) => {
  try {
    const { videoId, playerId, inTime, outTime, duration, notes } = req.body;
    const coachId = req.user._id;

    // Validation
    if (!videoId || !playerId || inTime === undefined || outTime === undefined) {
      return res.status(400).json({
        success: false,
        message: "videoId, playerId, inTime, and outTime are required"
      });
    }

    // Validate playerId ObjectId
    if (!mongoose.Types.ObjectId.isValid(playerId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid playerId"
      });
    }

    // Validate inTime and outTime
    if (inTime < 0) {
      return res.status(400).json({
        success: false,
        message: "inTime must be greater than or equal to 0"
      });
    }

    if (outTime <= inTime) {
      return res.status(400).json({
        success: false,
        message: "outTime must be greater than inTime"
      });
    }

    // Calculate duration if not provided
    const clipDuration = duration || (outTime - inTime);

    if (clipDuration <= 0) {
      return res.status(400).json({
        success: false,
        message: "duration must be greater than 0"
      });
    }

    // Check if coach role
    if (req.user.role !== "coach") {
      return res.status(403).json({
        success: false,
        message: "Only coaches can create video clips"
      });
    }

    // Verify player exists and get video
    const player = await User.findById(playerId).select("role videos");
    if (!player || player.role !== "player") {
      return res.status(404).json({
        success: false,
        message: "Player not found"
      });
    }

    // Verify video exists in player's videos array
    const video = player.videos.id(videoId);
    if (!video) {
      return res.status(404).json({
        success: false,
        message: "Video not found in player's videos"
      });
    }

    // Validate clip duration doesn't exceed video duration
    if (video.duration && outTime > video.duration) {
      return res.status(400).json({
        success: false,
        message: `outTime (${outTime}ms) cannot exceed video duration (${video.duration}ms)`
      });
    }

    // Create video clip record (status: processing)
    const videoClip = await VideoClip.create({
      coachId,
      videoId: videoId,
      playerId,
      inTime,
      outTime,
      duration: clipDuration,
      notes: notes || undefined,
      status: "processing"
    });

    // Start video processing asynchronously
    const clipUrl = await processClipAsync(videoClip._id, video.url, inTime, clipDuration, req);

    // Generate response
    const baseURL = `${req.protocol}://${req.get("host")}`;
    
    res.status(201).json({
      success: true,
      message: "Video clip saved successfully and processing started",
      data: {
        _id: videoClip._id,
        coachId: videoClip.coachId,
        videoId: videoClip.videoId,
        playerId: videoClip.playerId,
        inTime: videoClip.inTime,
        outTime: videoClip.outTime,
        duration: videoClip.duration,
        clipUrl: clipUrl,
        status: "ready",
        notes: videoClip.notes,
        createdAt: videoClip.createdAt,
        updatedAt: videoClip.updatedAt
      }
    });

  } catch (error) {
    console.error("Create Video Clip Error:", error);
    
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: messages.join(", ")
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to create video clip",
      error: error.message
    });
  }
};

/**
 * Process video clip asynchronously
 * @param {string} clipId - Video clip ID
 * @param {string} originalVideoPath - Path to original video
 * @param {number} startTime - Start time in milliseconds
 * @param {number} duration - Duration in milliseconds
 * @param {Object} req - Request object for baseURL
 */
const processClipAsync = async (clipId, originalVideoPath, startTime, duration, req) => {
  try {
    // Resolve original video path
    const rootDir = path.resolve(__dirname, '../../'); // Adjust based on your project structure
    const fullInputPath = path.join(rootDir, originalVideoPath.replace(/^\//, ''));
    // Check if input file exists
    const fs = await import('fs/promises');
    try {
      await fs.access(fullInputPath);
    } catch {
      throw new Error(`Original video not found at: ${fullInputPath}`);
    }

    // Create clips directory
    const clipsDir = path.join(rootDir, 'uploads', 'clips');
    await ensureDirectoryExists(clipsDir);

    // Generate unique filename for clip
    const timestamp = Date.now();
    const clipFilename = `clip-${clipId}-${timestamp}.mp4`;
    const outputPath = path.join(clipsDir, clipFilename);

    // Process video clip
    await processVideoClip(fullInputPath, startTime, duration, outputPath);

    // Generate clip URL
    const baseURL = `${req.protocol}://${req.get("host")}`;
    const clipUrl = `${baseURL}/uploads/clips/${clipFilename}`;

    // Update video clip status and URL
    await VideoClip.findByIdAndUpdate(clipId, {
      status: "ready",
      clipUrl: clipUrl
    });

    return clipUrl;
  } catch (error) {
    console.error(`❌ Video processing failed for clip ${clipId}:`, error);

    // Update status to failed
    await VideoClip.findByIdAndUpdate(clipId, {
      status: "failed"
    });
  }
};

/**
 * @desc    Get video clips for logged-in coach
 * @route   GET /api/coach/video-clips
 * @access  Private (Coach only)
 */
export const getVideoClips = async (req, res) => {
  try {
    const coachId = req.user._id;
    const { videoId, playerId, status, page = 1, limit = 20 } = req.query;

    if (req.user.role !== "coach") {
      return res.status(403).json({
        success: false,
        message: "Only coaches can view video clips"
      });
    }

    // Build query
    const query = { coachId };

    if (videoId) {
      query.videoId = videoId;
    }

    if (playerId) {
      if (!mongoose.Types.ObjectId.isValid(playerId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid playerId"
        });
      }
      query.playerId = playerId;
    }

    if (status) {
      if (!["processing", "ready", "failed"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid status. Must be: processing, ready, or failed"
        });
      }
      query.status = status;
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get clips with pagination
    const [clips, totalClips] = await Promise.all([
      VideoClip.find(query)
        .populate("playerId", "firstName lastName profileImage videos")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      VideoClip.countDocuments(query)
    ]);

    // Generate baseURL
    const baseURL = `${req.protocol}://${req.get("host")}`;

    // Format clips
    const formattedClips = clips.map(clip => {
      let videoData = null;

      if (clip.playerId && clip.playerId.videos) {
        const video = clip.playerId.videos.find(
          v => v._id.toString() === clip.videoId
        );

        if (video) {
          let videoUrl = video.url;
          if (videoUrl && !videoUrl.startsWith("http")) {
            videoUrl = `${baseURL}${videoUrl}`;
          }

          videoData = {
            id: video._id,
            title: video.title,
            videoUrl: videoUrl,
            duration: video.duration,
            fileSize: video.fileSize,
            uploadedAt: video.uploadedAt
          };
        }
      }

      let playerProfileImage = null;
      if (clip.playerId?.profileImage) {
        playerProfileImage = clip.playerId.profileImage;
        if (!playerProfileImage.startsWith("http")) {
          playerProfileImage = `${baseURL}${playerProfileImage}`;
        }
      }

      let clipUrl = clip.clipUrl;
      if (clipUrl && !clipUrl.startsWith("http")) {
        clipUrl = `${baseURL}${clipUrl}`;
      }

      return {
        _id: clip._id,
        coachId: clip.coachId,
        video: videoData,
        player: clip.playerId ? {
          id: clip.playerId._id,
          firstName: clip.playerId.firstName,
          lastName: clip.playerId.lastName,
          profileImage: playerProfileImage
        } : null,
        inTime: clip.inTime,
        outTime: clip.outTime,
        duration: clip.duration,
        clipUrl: clipUrl,
        status: clip.status,
        notes: clip.notes,
        createdAt: clip.createdAt,
        updatedAt: clip.updatedAt
      };
    });

    res.status(200).json({
      success: true,
      message: "Video clips retrieved successfully",
      data: formattedClips,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalClips / parseInt(limit)),
        totalClips,
        limit: parseInt(limit),
        hasMore: skip + clips.length < totalClips
      }
    });

  } catch (error) {
    console.error("Get Video Clips Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve video clips",
      error: error.message
    });
  }
};

/**
 * @desc    Get a single video clip by ID
 * @route   GET /api/coach/video-clips/:clipId
 * @access  Private (Coach only)
 */
export const getSingleVideoClip = async (req, res) => {
  try {
    const { clipId } = req.params;
    const coachId = req.user._id;

    // Validate clipId
    if (!mongoose.Types.ObjectId.isValid(clipId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid clip ID"
      });
    }

    // Check if coach role
    if (req.user.role !== "coach") {
      return res.status(403).json({
        success: false,
        message: "Only coaches can view video clips"
      });
    }

    // Find clip and populate player
    const clip = await VideoClip.findById(clipId)
      .populate("playerId", "firstName lastName profileImage videos")
      .lean();

    if (!clip) {
      return res.status(400).json({
        success: false,
        message: "Video clip not found"
      });
    }

    // Check ownership
    if (clip.coachId.toString() !== coachId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to view this clip"
      });
    }

    // Generate baseURL
    const baseURL = `${req.protocol}://${req.get("host")}`;

    // Manually populate video data
    let videoData = null;
    if (clip.playerId && clip.playerId.videos) {
      const video = clip.playerId.videos.find(
        v => v._id.toString() === clip.videoId
      );

      if (video) {
        // Format video URL with baseURL
        let videoUrl = video.url;
        if (videoUrl && !videoUrl.startsWith("http")) {
          videoUrl = `${baseURL}${videoUrl}`;
        }

        videoData = {
          id: video._id,
          title: video.title,
          videoUrl: videoUrl,
          duration: video.duration,
          fileSize: video.fileSize,
          uploadedAt: video.uploadedAt
        };
      }
    }

    // Format player profile image with baseURL
    let playerProfileImage = null;
    if (clip.playerId?.profileImage) {
      playerProfileImage = clip.playerId.profileImage;
      if (!playerProfileImage.startsWith("http")) {
        playerProfileImage = `${baseURL}${playerProfileImage}`;
      }
    }

    // Format clipUrl with baseURL
    let clipUrl = clip.clipUrl;
    if (clipUrl && !clipUrl.startsWith("http")) {
      clipUrl = `${baseURL}${clipUrl}`;
    }

    // Format response
    const formattedClip = {
      _id: clip._id,
      coachId: clip.coachId,
      video: videoData,
      player: clip.playerId ? {
        id: clip.playerId._id,
        firstName: clip.playerId.firstName,
        lastName: clip.playerId.lastName,
        profileImage: playerProfileImage
      } : null,
      inTime: clip.inTime,
      outTime: clip.outTime,
      duration: clip.duration,
      clipUrl: clipUrl,
      status: clip.status,
      notes: clip.notes,
      createdAt: clip.createdAt,
      updatedAt: clip.updatedAt
    };

    res.status(201).json({
      success: true,
      message: "Video clip retrieved successfully",
      data: formattedClip
    });

  } catch (error) {
    console.error("Get Single Video Clip Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve video clip",
      error: error.message
    });
  }
};

/**
 * @desc    Update video clip
 * @route   PUT /api/coach/video-clips/:clipId
 * @access  Private (Coach only)
 */
export const updateVideoClip = async (req, res) => {
  try {
    const { clipId } = req.params;
    const { inTime, outTime, duration, status } = req.body;
    const coachId = req.user._id;

    // Validate clipId
    if (!mongoose.Types.ObjectId.isValid(clipId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid clip ID"
      });
    }

    // Check if coach role
    if (req.user.role !== "coach") {
      return res.status(403).json({
        success: false,
        message: "Only coaches can update video clips"
      });
    }

    // Find clip
    const clip = await VideoClip.findById(clipId);

    if (!clip) {
      return res.status(400).json({
        success: false,
        message: "Video clip not found"
      });
    }

    // Check ownership
    if (clip.coachId.toString() !== coachId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to update this clip"
      });
    }

    // Update fields
    if (inTime !== undefined) {
      if (inTime < 0) {
        return res.status(400).json({
          success: false,
          message: "inTime must be greater than or equal to 0"
        });
      }
      clip.inTime = inTime;
    }

    if (outTime !== undefined) {
      if (outTime <= clip.inTime) {
        return res.status(400).json({
          success: false,
          message: "outTime must be greater than inTime"
        });
      }
      clip.outTime = outTime;
    }

    if (duration !== undefined) {
      if (duration <= 0) {
        return res.status(400).json({
          success: false,
          message: "duration must be greater than 0"
        });
      }
      clip.duration = duration;
    }

    if (status !== undefined) {
      if (!["processing", "ready", "failed"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid status. Must be: processing, ready, or failed"
        });
      }
      clip.status = status;
    }

    // Recalculate duration if inTime or outTime changed
    if (inTime !== undefined || outTime !== undefined) {
      clip.duration = clip.outTime - clip.inTime;
    }

    await clip.save();

    res.status(201).json({
      success: true,
      message: "Video clip updated successfully",
      data: {
        _id: clip._id,
        coachId: clip.coachId,
        videoId: clip.videoId,
        playerId: clip.playerId,
        inTime: clip.inTime,
        outTime: clip.outTime,
        duration: clip.duration,
        clipUrl: clip.clipUrl,
        status: clip.status,
        createdAt: clip.createdAt,
        updatedAt: clip.updatedAt
      }
    });

  } catch (error) {
    console.error("Update Video Clip Error:", error);
    
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: messages.join(", ")
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to update video clip",
      error: error.message
    });
  }
};

/**
 * @desc    Delete video clip
 * @route   DELETE /api/coach/video-clips/:clipId
 * @access  Private (Coach only)
 */
export const deleteVideoClip = async (req, res) => {
  try {
    const { clipId } = req.params;
    const coachId = req.user._id;

    // Validate clipId
    if (!mongoose.Types.ObjectId.isValid(clipId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid clip ID"
      });
    }

    // Check if coach role
    if (req.user.role !== "coach") {
      return res.status(403).json({
        success: false,
        message: "Only coaches can delete video clips"
      });
    }

    // Find clip
    const clip = await VideoClip.findById(clipId);

    if (!clip) {
      return res.status(400).json({
        success: false,
        message: "Video clip not found"
      });
    }

    // Check ownership
    if (clip.coachId.toString() !== coachId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to delete this clip"
      });
    }

    // TODO: Delete actual clip file from storage
    // if (clip.clipUrl) {
    //   await deleteFileFromStorage(clip.clipUrl);
    // }

    // Delete clip
    await VideoClip.findByIdAndDelete(clipId);

    res.status(200).json({
      success: true,
      message: "Video clip deleted successfully"
    });

  } catch (error) {
    console.error("Delete Video Clip Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete video clip",
      error: error.message
    });
  }
};