import CoachNote from "../models/coachNote.model.js";
import User from "../models/user.model.js";
import mongoose from "mongoose";

/**
 * @desc    Create a new note for a player
 * @route   POST /api/coach-notes
 * @access  Private (Coach only)
 */
export const createCoachNote = async (req, res) => {
  try {
    const { playerId, noteText, tags, priority } = req.body;
    const coachId = req.user._id;

    // Validation
    if (!playerId || !noteText) {
      return res.status(400).json({
        success: false,
        message: "Player ID and note text are required"
      });
    }

    // Check if coach role
    if (req.user.role !== 'coach') {
      return res.status(403).json({
        success: false,
        message: "Only coaches can create notes"
      });
    }

    // Verify player exists and is a player
    const player = await User.findById(playerId);
    if (!player) {
      return res.status(400).json({
        success: false,
        message: "Player not found"
      });
    }

    if (player.role !== 'player') {
      return res.status(400).json({
        success: false,
        message: "Notes can only be created for players"
      });
    }

    // Create note
    const newNote = await CoachNote.create({
      coach: coachId,
      player: playerId,
      noteText: noteText.trim(),
      tags: tags || [],
      priority: priority || 'medium'
    });

    // Populate coach and player details
    const populatedNote = await CoachNote.findById(newNote._id)
      .populate('coach', 'firstName lastName email profileImage')
      .populate('player', 'firstName lastName jerseyNumber position team profileImage');

    res.status(201).json({
      success: true,
      message: "Note created successfully",
      data: populatedNote
    });

  } catch (error) {
    console.error("Error creating coach note:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create note",
      error: error.message
    });
  }
};

/**
 * @desc    Get all notes by logged-in coach
 * @route   GET /api/coach-notes
 * @access  Private (Coach only)
 */
export const getCoachNotes = async (req, res) => {
  try {
    const coachId = req.user._id;
    const { playerId, isArchived, priority, page = 1, limit = 20 } = req.query;

    if (req.user.role !== 'coach') {
      return res.status(403).json({
        success: false,
        message: "Only coaches can view notes"
      });
    }

    // Build query
    const query = { coach: coachId };

    if (playerId) {
      query.player = playerId;
    }

    if (isArchived !== undefined) {
      query.isArchived = isArchived === 'true';
    }

    if (priority) {
      query.priority = priority;
    }

    // Pagination
    const skip = (page - 1) * limit;

    // Get notes with pagination
    const notes = await CoachNote.find(query)
      .populate('player', 'firstName lastName jerseyNumber position team profileImage hometown highSchool')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const totalNotes = await CoachNote.countDocuments(query);

    res.status(200).json({
      success: true,
      data: notes,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalNotes / limit),
        totalNotes,
        hasMore: skip + notes.length < totalNotes
      }
    });

  } catch (error) {
    console.error("Error fetching coach notes:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch notes",
      error: error.message
    });
  }
};

/**
 * @desc    Get notes for a specific player (by logged-in coach)
 * @route   GET /api/coach-notes/player/:playerId
 * @access  Private (Coach only)
 */
export const getNotesForPlayer = async (req, res) => {
  try {
    const { playerId } = req.params;
    const coachId = req.user._id;

    if (req.user.role !== 'coach') {
      return res.status(403).json({
        success: false,
        message: "Only coaches can view notes"
      });
    }

    // Verify player exists
    const player = await User.findById(playerId);
    if (!player || player.role !== 'player') {
      return res.status(400).json({
        success: false,
        message: "Player not found"
      });
    }

    // Get all notes for this player by this coach
    const notes = await CoachNote.find({
      coach: coachId,
      player: playerId,
      isArchived: false
    })
      .populate('player', 'firstName lastName jerseyNumber position profileImage')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: notes,
      count: notes.length
    });

  } catch (error) {
    console.error("Error fetching player notes:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch player notes",
      error: error.message
    });
  }
};

/**
 * @desc    Get a single note by ID
 * @route   GET /api/coach-notes/:noteId
 * @access  Private (Coach only - own notes)
 */
export const getSingleNote = async (req, res) => {
  try {
    const { noteId } = req.params;
    const coachId = req.user._id;

    if (req.user.role !== 'coach') {
      return res.status(403).json({
        success: false,
        message: "Only coaches can view notes"
      });
    }

    const note = await CoachNote.findById(noteId)
      .populate('coach', 'firstName lastName email')
      .populate('player', 'firstName lastName jerseyNumber position team profileImage');

    if (!note) {
      return res.status(400).json({
        success: false,
        message: "Note not found"
      });
    }

    // Check if note belongs to this coach
    if (note.coach._id.toString() !== coachId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to view this note"
      });
    }

    res.status(200).json({
      success: true,
      data: note
    });

  } catch (error) {
    console.error("Error fetching note:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch note",
      error: error.message
    });
  }
};

/**
 * @desc    Update a note
 * @route   PUT /api/coach-notes/:noteId
 * @access  Private (Coach only - own notes)
 */
export const updateCoachNote = async (req, res) => {
  try {
    const { noteId } = req.params;
    const { noteText, tags, priority, isArchived } = req.body;
    const coachId = req.user._id;

    if (req.user.role !== 'coach') {
      return res.status(403).json({
        success: false,
        message: "Only coaches can update notes"
      });
    }

    // Find note
    const note = await CoachNote.findById(noteId);

    if (!note) {
      return res.status(400).json({
        success: false,
        message: "Note not found"
      });
    }

    // Check ownership
    if (note.coach.toString() !== coachId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to update this note"
      });
    }

    // Update fields
    if (noteText !== undefined) note.noteText = noteText.trim();
    if (tags !== undefined) note.tags = tags;
    if (priority !== undefined) note.priority = priority;
    if (isArchived !== undefined) note.isArchived = isArchived;
    
    note.lastEditedAt = new Date();

    await note.save();

    // Populate and return
    const updatedNote = await CoachNote.findById(noteId)
      .populate('coach', 'firstName lastName email')
      .populate('player', 'firstName lastName jerseyNumber position profileImage');

    res.status(200).json({
      success: true,
      message: "Note updated successfully",
      data: updatedNote
    });

  } catch (error) {
    console.error("Error updating note:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update note",
      error: error.message
    });
  }
};

/**
 * @desc    Delete a note
 * @route   DELETE /api/coach-notes/:noteId
 * @access  Private (Coach only - own notes)
 */
export const deleteCoachNote = async (req, res) => {
  try {
    const { noteId } = req.params;
    const coachId = req.user._id;

    if (req.user.role !== 'coach') {
      return res.status(403).json({
        success: false,
        message: "Only coaches can delete notes"
      });
    }

    // Find note
    const note = await CoachNote.findById(noteId);

    if (!note) {
      return res.status(400).json({
        success: false,
        message: "Note not found"
      });
    }

    // Check ownership
    if (note.coach.toString() !== coachId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to delete this note"
      });
    }

    await CoachNote.findByIdAndDelete(noteId);

    res.status(200).json({
      success: true,
      message: "Note deleted successfully"
    });

  } catch (error) {
    console.error("Error deleting note:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete note",
      error: error.message
    });
  }
};

/**
 * @desc    Bulk delete notes
 * @route   POST /api/coach-notes/bulk-delete
 * @access  Private (Coach only)
 */
export const bulkDeleteNotes = async (req, res) => {
  try {
    const { noteIds } = req.body;
    const coachId = req.user._id;

    if (!noteIds || !Array.isArray(noteIds) || noteIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Note IDs array is required"
      });
    }

    if (req.user.role !== 'coach') {
      return res.status(403).json({
        success: false,
        message: "Only coaches can delete notes"
      });
    }

    // Delete only notes that belong to this coach
    const result = await CoachNote.deleteMany({
      _id: { $in: noteIds },
      coach: coachId
    });

    res.status(200).json({
      success: true,
      message: `${result.deletedCount} note(s) deleted successfully`,
      deletedCount: result.deletedCount
    });

  } catch (error) {
    console.error("Error bulk deleting notes:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete notes",
      error: error.message
    });
  }
};