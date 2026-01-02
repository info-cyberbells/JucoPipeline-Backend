import User from "../models/user.model.js";
import Team from "../models/team.model.js";
import Game from "../models/game.model.js";
import Follow from "../models/follow.model.js";
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

// GET TEAM ROSTER 
export const getTeamRoster = async (req, res) => {
  try {
    const coachId = req.user.id;
    const { teamId } = req.params;
    const { page = 1, limit = 10, position, class: playerClass, batThrow, sortBy = "firstName", sortOrder = "asc", search } = req.query;
    if (!mongoose.Types.ObjectId.isValid(teamId)) {
      return res.status(400).json({ message: "Invalid team ID" });
    }

    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({ message: "Team not found" });
    }

    const baseURL = `${req.protocol}://${req.get("host")}`;
    // Build filter
    const filter = { role: "player", team: teamId, registrationStatus: "approved", isActive: true };
    if (position && position !== "all") {
      filter.position = { $regex: new RegExp(position, 'i') };
    }

    if (playerClass && playerClass !== "all") {
      filter['battingStats.seasonYear'] = playerClass;
    }

    if (batThrow && batThrow !== "all") {
      filter.batsThrows = { $regex: new RegExp(batThrow, 'i') };
    }

    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = { [sortBy]: sortOrder === "asc" ? 1 : -1 };
    const [players, totalCount] = await Promise.all([
      User.find(filter)
        // .populate('team', 'name logo location division')
        .populate('team')
        .select("firstName lastName email position jerseyNumber height weight batsThrows profileImage battingStats pitchingStats fieldingStats")
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments(filter)
    ]);

    // Get following status
    const playerIds = players.map(p => p._id);
    const followedPlayers = await Follow.find({ follower: coachId, following: { $in: playerIds } }).distinct('following');
    const followedSet = new Set(followedPlayers.map(id => id.toString()));
    const formattedPlayers = players.map(player => {
      const userData = formatUserData(player, baseURL);
      
      const battingStats = userData.battingStats?.[0] || {};
      const pitchingStats = userData.pitchingStats?.[0] || {};
      const fieldingStats = userData.fieldingStats?.[0] || {};

      // Format team logo
      let teamLogo = userData.team?.logo;
      if (teamLogo && !teamLogo.startsWith("http")) {
        teamLogo = `${baseURL}${teamLogo}`;
      }

      return {
        _id: userData._id,
        name: `${userData.firstName} ${userData.lastName}`,
        firstName: userData.firstName,
        lastName: userData.lastName,
        position: userData.position || "N/A",
        jerseyNumber: userData.jerseyNumber || "N/A",
        class: battingStats.seasonYear || pitchingStats.seasonYear || fieldingStats.seasonYear || "N/A",
        height: userData.height || "N/A",
        weight: userData.weight || "N/A",
        batThrow: userData.batsThrows || "N/A",
        profileImage: userData.profileImage,
        isFollowing: followedSet.has(userData._id.toString()),
        team,
        stats: {
          battingStats,
          pitchingStats,
          fieldingStats
        },
      };
    });

    // Format team logo for response
    let teamLogo = team.logo;
    if (teamLogo && !teamLogo.startsWith("http")) {
      teamLogo = `${baseURL}${teamLogo}`;
    }

    res.json({
      message: "Team roster retrieved successfully",
      team: {
        _id: team._id,
        name: team.name,
        logo: teamLogo,
        location: team.location,
        division: team.division,
        region: team.region,
        rank: team.rank,
        coachName: team.coachName,
        home: team.home,
        away: team.away,
        neutral: team.neutral,
        conference: team.conference
      },
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
    res.status(500).json({ message: error.message });
  }
};

// GET ALL TEAMS 
export const getAllTeamsWithoutPagination = async (req, res) => {
  try {
    const { search, division, region, isActive = true } = req.query;

    const filter = { isActive };

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } }
      ];
    }

    if (division && division !== "all") {
      filter.division = division;
    }

    if (region && region !== "all") {
      filter.region = region;
    }

    const teams = await Team.find(filter).sort({ name: 1 });

    // Get player count for each team
    const teamsWithCount = await Promise.all(
      teams.map(async (team) => {
        const playerCount = await User.countDocuments({
          team: team._id,
          role: "player",
          isActive: true
        });

        const baseURL = `${req.protocol}://${req.get("host")}`;
        const teamData = team.toObject();
        
        if (teamData.logo && !teamData.logo.startsWith("http")) {
          teamData.logo = `${baseURL}${teamData.logo}`;
        }

        return {
          ...teamData,
          playerCount
        };
      })
    );

    res.json({
      message: "Teams retrieved successfully",
      teams: teamsWithCount,
      totalTeams: teamsWithCount.length
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getAllTeams = async (req, res) => {
  try {
    const { search, division, region, isActive = true } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = { isActive };

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } }
      ];
    }

    if (division && division !== "all") {
      filter.division = division;
    }

    if (region && region !== "all") {
      filter.region = region;
    }

    const totalTeams = await Team.countDocuments(filter);
    const teams = await Team.find(filter).sort({ name: 1 }).skip(skip).limit(limit);

    // Add player count in each team
    const teamsWithCount = await Promise.all(
      teams.map(async (team) => {
        const playerCount = await User.countDocuments({
          team: team._id,
          role: "player",
          isActive: true
        });

        const baseURL = `${req.protocol}://${req.get("host")}`;
        const teamData = team.toObject();

        if (teamData.logo && !teamData.logo.startsWith("http")) {
          teamData.logo = `${baseURL}${teamData.logo}`;
        }

        return {
          ...teamData,
          playerCount
        };
      })
    );

    // -----------------------------------
    // ONLY FOR SCOUT — Upcoming Games
    // -----------------------------------
    let upcomingGames = [];
    let gamesPagination = null;

    if (req.user && req.user.role === "scout") {
      const gamesPage = parseInt(req.query.gamesPage) || 1;
      const gamesLimit = parseInt(req.query.gamesLimit) || 5;
      const gamesSkip = (gamesPage - 1) * gamesLimit;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const gameFilter = {
        date: { $gte: today },
        status: { $in: ["upcoming", "live"] }
      };

      const [games, totalGames] = await Promise.all([
        Game.find(gameFilter)
          .populate("createdBy", "firstName lastName email role")
          .populate("updatedBy", "firstName lastName email role")
          .populate("homeTeamId", "name logo")
          .populate("awayTeamId", "name logo")
          .sort({ date: 1, time: 1 })
          .skip(gamesSkip)
          .limit(gamesLimit),

        Game.countDocuments(gameFilter)
      ]);

      upcomingGames = games;
      gamesPagination = {
        currentPage: gamesPage,
        totalPages: Math.ceil(totalGames / gamesLimit),
        totalGames,
        limit: gamesLimit,
        hasMore: gamesSkip + games.length < totalGames
      };
    }

    // -----------------------------------
    // FINAL RESPONSE
    // -----------------------------------
    res.json({
      message: "Teams retrieved successfully",
      teams: teamsWithCount,
      totalTeams,
      currentPage: page,
      totalPages: Math.ceil(totalTeams / limit),
      limit,

      // Extra data only for scouts
      upcomingGames,
      gamesPagination
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// SEARCH TEAMS 
export const searchTeams = async (req, res) => {
  try {
    const { query, limit = 10 } = req.query;

    if (!query) {
      return res.status(400).json({ message: "Search query is required" });
    }

    const teams = await Team.find({
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { location: { $regex: query, $options: 'i' } }
      ],
      isActive: true
    })
      .select("name location division logo")
      .limit(parseInt(limit))
      .sort({ name: 1 });

    const baseURL = `${req.protocol}://${req.get("host")}`;
    
    const formattedTeams = teams.map(team => {
      const teamData = team.toObject();
      if (teamData.logo && !teamData.logo.startsWith("http")) {
        teamData.logo = `${baseURL}${teamData.logo}`;
      }
      return {
        _id: teamData._id,
        name: teamData.name,
        location: teamData.location,
        division: teamData.division,
        logo: teamData.logo,
        displayName: `${teamData.name}${teamData.location ? ` - ${teamData.location}` : ''}`
      };
    });

    res.json({
      message: "Teams found",
      teams: formattedTeams,
      totalResults: formattedTeams.length
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET TEAM BY ID 
export const getTeamById = async (req, res) => {
  try {
    const { teamId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(teamId)) {
      return res.status(400).json({ message: "Invalid team ID" });
    }

    const team = await Team.findById(teamId);

    if (!team) {
      return res.status(404).json({ message: "Team not found" });
    }

    const playerCount = await User.countDocuments({
      team: teamId,
      role: "player",
      isActive: true
    });

    const baseURL = `${req.protocol}://${req.get("host")}`;
    const teamData = team.toObject();
    
    if (teamData.logo && !teamData.logo.startsWith("http")) {
      teamData.logo = `${baseURL}${teamData.logo}`;
    }

    res.json({
      message: "Team retrieved successfully",
      team: {
        ...teamData,
        playerCount
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET TEAM DETAILS
export const getTeamDetails = async (req, res) => {
  try {
    const { teamId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(teamId)) {
      return res.status(400).json({ message: "Invalid team ID" });
    }

    const team = await Team.findById(teamId)
      .populate('topPerformer.playerId', 'firstName lastName position profileImage');

    if (!team) {
      return res.status(404).json({ message: "Team not found" });
    }

    const baseURL = `${req.protocol}://${req.get("host")}`;
    const teamData = team.toObject();
    
    if (teamData.logo && !teamData.logo.startsWith("http")) {
      teamData.logo = `${baseURL}${teamData.logo}`;
    }

    res.json({
      message: "Team details retrieved successfully",
      team: teamData
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET TEAM STATS 
export const getTeamStats = async (req, res) => {
  try {
    const { teamId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(teamId)) {
      return res.status(400).json({ message: "Invalid team ID" });
    }

    const team = await Team.findById(teamId);
    
    if (!team) {
      return res.status(404).json({ message: "Team not found" });
    }

    const players = await User.find({
      role: "player",
      team: teamId,
      registrationStatus: "approved",
      isActive: true
    }).select("firstName lastName battingStats pitchingStats fieldingStats");

    if (players.length === 0) {
      return res.status(404).json({ message: "No players found for this team" });
    }

    let totalHits = 0;
    let totalAtBats = 0;
    let totalHomeRuns = 0;
    let totalRBI = 0;
    let totalWins = 0;
    let totalLosses = 0;
    let topPerformer = null;
    let highestAvg = 0;

    players.forEach(player => {
      if (player.battingStats && player.battingStats.length > 0) {
        const latestBatting = player.battingStats[0];
        totalHits += latestBatting.hits || 0;
        totalAtBats += latestBatting.at_bats || 0;
        totalHomeRuns += latestBatting.home_runs || 0;
        totalRBI += latestBatting.rbi || 0;

        const playerAvg = latestBatting.batting_average || 0;
        if (playerAvg > highestAvg) {
          highestAvg = playerAvg;
          topPerformer = {
            name: `${player.firstName} ${player.lastName}`,
            position: player.position || "N/A",
            avg: playerAvg,
            hr: latestBatting.home_runs || 0,
            rbi: latestBatting.rbi || 0
          };
        }
      }

      if (player.pitchingStats && player.pitchingStats.length > 0) {
        const latestPitching = player.pitchingStats[0];
        totalWins += latestPitching.wins || 0;
        totalLosses += latestPitching.losses || 0;
      }
    });

    const teamAverage = totalAtBats > 0 ? (totalHits / totalAtBats).toFixed(3) : "0.000";
    const baseURL = `${req.protocol}://${req.get("host")}`;
    
    let teamLogo = team.logo;
    if (teamLogo && !teamLogo.startsWith("http")) {
      teamLogo = `${baseURL}${teamLogo}`;
    }

    res.json({
      message: "Team stats retrieved successfully",
      team: {
        _id: team._id,
        name: team.name,
        logo: teamLogo
      },
      stats: {
        totalPlayers: players.length,
        teamBattingAverage: teamAverage,
        totalHomeRuns,
        totalRBI,
        totalWins,
        totalLosses,
        winPercentage: totalWins + totalLosses > 0 
          ? ((totalWins / (totalWins + totalLosses)) * 100).toFixed(1) 
          : "0.0",
        topPerformer
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET TEAM FILTERS 
export const getTeamFilters = async (req, res) => {
  try {
    const { teamId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(teamId)) {
      return res.status(400).json({ message: "Invalid team ID" });
    }

    const players = await User.find({
      role: "player",
      team: teamId,
      registrationStatus: "approved",
      isActive: true
    }).select("position batsThrows battingStats");

    const positions = [...new Set(players.map(p => p.position).filter(Boolean))];
    const batThrows = [...new Set(players.map(p => p.batsThrows).filter(Boolean))];
    const classes = [...new Set(
      players.flatMap(p => p.battingStats?.map(s => s.seasonYear) || [])
    )].sort().reverse();

    res.json({
      message: "Team filters retrieved successfully",
      filters: {
        positions: positions.sort(),
        batThrows: batThrows.sort(),
        classes: classes
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};