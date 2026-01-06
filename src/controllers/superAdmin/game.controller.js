import Game from "../../models/game.model.js";
import mongoose from "mongoose";
import Team from "../../models/team.model.js";

// CREATE GAME
export const createGame = async (req, res) => {
  try {
    const { homeTeamId, awayTeamId, date, time, location, streamLink, status } = req.body;
    const adminId = req.user.id;

    // Validate date is not in the past
    const gameDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (gameDate < today) {
      return res.status(400).json({ 
        message: "Game date cannot be in the past" 
      });
    }

    if (homeTeamId) {
      if (!mongoose.Types.ObjectId.isValid(homeTeamId)) {
        return res.status(400).json({ message: "Invalid homeTeamId format" });
      }

      // Check if team exists
      const teamExists = await Team.findById(homeTeamId);
      if (!teamExists) {
        return res.status(400).json({ message: "homeTeamId not found" });
      }
    }


    if (awayTeamId) {
      if (!mongoose.Types.ObjectId.isValid(awayTeamId)) {
        return res.status(400).json({ message: "Invalid awayTeamId format" });
      }

      // Check if team exists
      const teamExists = await Team.findById(awayTeamId);
      if (!teamExists) {
        return res.status(400).json({ message: "awayTeamId not found" });
      }
    }

    const game = await Game.create({
      homeTeamId,
      awayTeamId,
      date: gameDate,
      time,
      location,
      streamLink: streamLink || null,
      status: status || "upcoming",
      createdBy: adminId
    });

    const populatedGame = await Game.findById(game._id).populate('createdBy', 'firstName lastName email role').populate('homeTeamId', 'name logo').populate('awayTeamId', 'name logo');

    res.status(201).json({
      message: "Game created successfully",
      game: populatedGame
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET ALL GAMES
export const getAllGames = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      homeTeam,
      awayTeam,
      homeTeamId,
      awayTeamId,
      startDate,
      endDate,
      sortBy = "date",
      sortOrder = "asc"
    } = req.query;

    const filter = {};

    // Filter by status
    if (status && status !== "all") {
      filter.status = status;
    }

    // Filter by teamId (direct)
    if (homeTeamId && mongoose.Types.ObjectId.isValid(homeTeamId)) {
      filter.homeTeamId = homeTeamId;
    }

    if (awayTeamId && mongoose.Types.ObjectId.isValid(awayTeamId)) {
      filter.awayTeamId = awayTeamId;
    }

    // Filter by team NAME (search in Team collection)
    if (homeTeam) {
      const homeMatches = await Team.find({
        name: { $regex: homeTeam, $options: "i" }
      }).select("_id");

      filter.homeTeamId = { $in: homeMatches.map(t => t._id) };
    }

    if (awayTeam) {
      const awayMatches = await Team.find({
        name: { $regex: awayTeam, $options: "i" }
      }).select("_id");

      filter.awayTeamId = { $in: awayMatches.map(t => t._id) };
    }

    // Filter by date range
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);

      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.date.$lte = end;
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

    const [games, totalCount] = await Promise.all([
      Game.find(filter)
        .populate('createdBy', 'firstName lastName email role')
        .populate('updatedBy', 'firstName lastName email role')
        .populate('homeTeamId', 'name logo')
        .populate('awayTeamId', 'name logo')
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit)),

      Game.countDocuments(filter)
    ]);

    res.json({
      message: "Games retrieved successfully",
      games,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalCount,
        limit: parseInt(limit),
        hasMore: skip + games.length < totalCount
      }
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET UPCOMING GAMES
export const getUpcomingGames = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const filter = {
      date: { $gte: today },
      status: { $in: ["upcoming", "live"] }
    };

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [games, totalCount] = await Promise.all([
      Game.find(filter)
        .populate('createdBy', 'firstName lastName email role')
        .populate('updatedBy', 'firstName lastName email role')
        .populate('homeTeamId', 'name logo')
        .populate('awayTeamId', 'name logo')
        .sort({ date: 1, time: 1 })
        .skip(skip)
        .limit(parseInt(limit)),
        
      Game.countDocuments(filter)
    ]);

    res.json({
      message: "Upcoming games retrieved successfully",
      games,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalCount,
        limit: parseInt(limit),
        hasMore: skip + games.length < totalCount
      }
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET GAME BY ID
export const getGameById = async (req, res) => {
  try {
    const { gameId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(gameId)) {
      return res.status(400).json({ message: "Invalid game ID" });
    }

    const game = await Game.findById(gameId)
      .populate('createdBy', 'firstName lastName email role')
      .populate('updatedBy', 'firstName lastName email role')
      .populate('homeTeamId', 'name logo')
      .populate('awayTeamId', 'name logo');

    if (!game) {
      return res.status(400).json({ message: "Game not found" });
    }

    res.json({
      message: "Game retrieved successfully",
      game
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// UPDATE GAME
export const updateGame = async (req, res) => {
  try {
    const { gameId } = req.params;
    const { homeTeamId, awayTeamId, date, time, location, streamLink, status } = req.body;
    const adminId = req.user.id;

    // Validate gameId
    if (!mongoose.Types.ObjectId.isValid(gameId)) {
      return res.status(400).json({ message: "Invalid game ID" });
    }

    const game = await Game.findById(gameId);
    if (!game) {
      return res.status(400).json({ message: "Game not found" });
    }

    // Validate and update homeTeamId
    if (homeTeamId !== undefined) {
      if (!mongoose.Types.ObjectId.isValid(homeTeamId)) {
        return res.status(400).json({ message: "Invalid homeTeamId format" });
      }

      const teamExists = await Team.findById(homeTeamId);
      if (!teamExists) {
        return res.status(400).json({ message: "homeTeamId not found" });
      }

      game.homeTeamId = homeTeamId;
    }

    // Validate and update awayTeamId
    if (awayTeamId !== undefined) {
      if (!mongoose.Types.ObjectId.isValid(awayTeamId)) {
        return res.status(400).json({ message: "Invalid awayTeamId format" });
      }

      const teamExists = await Team.findById(awayTeamId);
      if (!teamExists) {
        return res.status(400).json({ message: "awayTeamId not found" });
      }

      game.awayTeamId = awayTeamId;
    }

    // Validate and update date
    if (date !== undefined) {
      const gameDate = new Date(date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (gameDate < today) {
        return res.status(400).json({ 
          message: "Game date cannot be in the past"
        });
      }

      game.date = gameDate;
    }

    // Update remaining fields
    if (time !== undefined) game.time = time;
    if (location !== undefined) game.location = location;
    if (streamLink !== undefined) game.streamLink = streamLink || null;
    if (status !== undefined) game.status = status;

    game.updatedBy = adminId;

    await game.save();

    // Populate
    const updatedGame = await Game.findById(gameId)
      .populate('createdBy', 'firstName lastName email role')
      .populate('updatedBy', 'firstName lastName email role')
      .populate('homeTeamId', 'name logo')
      .populate('awayTeamId', 'name logo');

    res.json({
      message: "Game updated successfully",
      game: updatedGame
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// DELETE GAME
export const deleteGame = async (req, res) => {
  try {
    const { gameId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(gameId)) {
      return res.status(400).json({ message: "Invalid game ID" });
    }

    const game = await Game.findByIdAndDelete(gameId);
    
    if (!game) {
      return res.status(400).json({ message: "Game not found" });
    }

    res.json({
      message: "Game deleted successfully"
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET GAME STATISTICS
export const getGameStatistics = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalGames, upcomingGames, liveGames, completedGames, todayGames] = await Promise.all([
      Game.countDocuments(),
      Game.countDocuments({ status: "upcoming", date: { $gte: today } }),
      Game.countDocuments({ status: "live" }),
      Game.countDocuments({ status: "completed" }),
      Game.countDocuments({ 
        date: { 
          $gte: today,
          $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
        } 
      })
    ]);

    res.json({
      message: "Game statistics retrieved successfully",
      statistics: {
        total: totalGames,
        upcoming: upcomingGames,
        live: liveGames,
        completed: completedGames,
        today: todayGames
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// BULK DELETE GAMES
export const bulkDeleteGames = async (req, res) => {
  try {
    const { gameIds } = req.body;

    if (!Array.isArray(gameIds) || gameIds.length === 0) {
      return res.status(400).json({ message: "Invalid game IDs array" });
    }

    // Validate all IDs
    const invalidIds = gameIds.filter(id => !mongoose.Types.ObjectId.isValid(id));
    if (invalidIds.length > 0) {
      return res.status(400).json({ 
        message: "Invalid game IDs found",
        invalidIds 
      });
    }

    const result = await Game.deleteMany({ _id: { $in: gameIds } });

    res.json({
      message: `${result.deletedCount} game(s) deleted successfully`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// UPDATE GAME STATUS
export const updateGameStatus = async (req, res) => {
  try {
    const { gameId } = req.params;
    const { status } = req.body;
    const adminId = req.user.id;

    // Validate game ID
    if (!mongoose.Types.ObjectId.isValid(gameId)) {
      return res.status(400).json({ message: "Invalid game ID" });
    }

    // Allowed statuses
    const validStatuses = ["upcoming", "live", "completed", "cancelled"];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        message: "Invalid status. Must be: upcoming, live, completed, or cancelled"
      });
    }

    const game = await Game.findById(gameId);

    if (!game) {
      return res.status(400).json({ message: "Game not found" });
    }

    // Update status
    game.status = status;
    game.updatedBy = adminId;

    await game.save();

    // Populate with new fields
    const updatedGame = await Game.findById(gameId)
      .populate("createdBy", "firstName lastName email role")
      .populate("updatedBy", "firstName lastName email role")
      .populate("homeTeamId", "name logo")
      .populate("awayTeamId", "name logo");

    res.json({
      message: "Game status updated successfully",
      game: updatedGame,
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};