import Team from "../models/team.model.js";
import User from "../models/user.model.js";
import mongoose from "mongoose";

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

// GET ALL TEAMS
export const getAllTeams = async (req, res) => {
  try {
    const {
      search,
      division,
      region,
      isActive = true,
      sortBy = "name",
      sortOrder = "asc"
    } = req.query;

    const baseURL = `${req.protocol}://${req.get("host")}`;

    // Build filter
    const filter = { isActive: isActive === "true" };

    // Search by name or location
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } }
      ];
    }

    // Filter by division
    if (division && division !== "all") {
      filter.division = division;
    }

    // Filter by region
    if (region && region !== "all") {
      filter.region = region;
    }

    // Build sort
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "asc" ? 1 : -1;

    // Get teams
    const teams = await Team.find(filter).sort(sortOptions);

    // Get player count for each team
    const teamsWithCount = await Promise.all(
      teams.map(async (team) => {
        const playerCount = await User.countDocuments({
          team: team._id,
          role: "player",
          registrationStatus: "approved",
          isActive: true
        });

        const teamData = team.toObject();

        // Format logo URL
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
    console.error("Get All Teams Error:", error);
    res.status(500).json({ message: error.message });
  }
};

// GET TEAM BY ID
export const getTeamById = async (req, res) => {
  try {
    const { teamId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(teamId)) {
      return res.status(400).json({ message: "Invalid team ID format" });
    }

    const team = await Team.findById(teamId);

    if (!team) {
      return res.status(400).json({ message: "Team not found" });
    }

    const baseURL = `${req.protocol}://${req.get("host")}`;
    const teamData = team.toObject();

    // Format logo URL
    if (teamData.logo && !teamData.logo.startsWith("http")) {
      teamData.logo = `${baseURL}${teamData.logo}`;
    }

    // Get player count
    const playerCount = await User.countDocuments({
      team: teamId,
      role: "player",
      registrationStatus: "approved",
      isActive: true
    });

    res.json({
      message: "Team retrieved successfully",
      team: {
        ...teamData,
        playerCount
      }
    });
  } catch (error) {
    console.error("Get Team Error:", error);
    res.status(500).json({ message: error.message });
  }
};

// GET PLAYERS BY TEAM
export const getPlayersByTeam = async (req, res) => {
  try {
    const { teamId } = req.params;
    const { page = 1, limit = 20, position, search, sortBy = "firstName", sortOrder = "asc", registrationStatus = "approved" } = req.query;
    if (!mongoose.Types.ObjectId.isValid(teamId)) {
      return res.status(400).json({ message: "Invalid team ID format" });
    }

    const baseURL = `${req.protocol}://${req.get("host")}`;

    // Check if team exists
    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(400).json({ message: "Team not found" });
    }

    // Build filter
    const filter = {
      team: teamId,
      role: "player",
      isActive: true
    };

    // Filter by registration status
    if (registrationStatus !== "all") {
      filter.registrationStatus = registrationStatus;
    }

    // Filter by position
    if (position && position !== "all") {
      filter.position = { $regex: new RegExp(position, 'i') };
    }

    // Search by name
    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build sort
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "asc" ? 1 : -1;

    // Get players
    const [players, totalCount] = await Promise.all([
      User.find(filter)
        .populate('team', 'name logo location division region')
        .select("firstName lastName email phoneNumber profileImage position jerseyNumber height weight batsThrows hometown highSchool previousSchool battingStats pitchingStats fieldingStats videos registrationStatus profileCompleteness team")
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments(filter)
    ]);

    // Format players
    const formattedPlayers = players.map(player => {
      const userData = formatUserData(player, baseURL);

      // Get latest stats
      const latestBattingStats = userData.battingStats?.[0] || {};
      const latestPitchingStats = userData.pitchingStats?.[0] || {};
      const latestFieldingStats = userData.fieldingStats?.[0] || {};

      // Format videos
      const formattedVideos = userData.videos && userData.videos.length > 0
        ? userData.videos.map(video => ({
          _id: video._id,
          url: video.url.startsWith("http") ? video.url : `${baseURL}${video.url}`,
          title: video.title,
          uploadedAt: video.uploadedAt
        }))
        : [];

      return {
        _id: userData._id,
        name: `${userData.firstName} ${userData.lastName}`,
        firstName: userData.firstName,
        lastName: userData.lastName,
        email: userData.email,
        phoneNumber: userData.phoneNumber,
        profileImage: userData.profileImage,
        position: userData.position || "N/A",
        jerseyNumber: userData.jerseyNumber || "N/A",
        height: userData.height || "N/A",
        weight: userData.weight || "N/A",
        batsThrows: userData.batsThrows || "N/A",
        hometown: userData.hometown || "N/A",
        highSchool: userData.highSchool || "N/A",
        previousSchool: userData.previousSchool || "N/A",
        registrationStatus: userData.registrationStatus,
        profileCompleteness: userData.profileCompleteness,
        team: userData.team,
        class: latestBattingStats.seasonYear || latestPitchingStats.seasonYear || latestFieldingStats.seasonYear || "N/A",
        stats: {
          batting: latestBattingStats,
          pitching: latestPitchingStats,
          fielding: latestFieldingStats
        },
        videos: formattedVideos,
        videoCount: formattedVideos.length
      };
    });

    // Format team logo
    const teamData = team.toObject();
    if (teamData.logo && !teamData.logo.startsWith("http")) {
      teamData.logo = `${baseURL}${teamData.logo}`;
    }

    res.json({
      message: "Players retrieved successfully",
      team: teamData,
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
    console.error("Get Players By Team Error:", error);
    res.status(500).json({ message: error.message });
  }
};

// GET TEAM STATISTICS
export const getTeamStatistics = async (req, res) => {
  try {
    const { teamId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(teamId)) {
      return res.status(400).json({ message: "Invalid team ID format" });
    }

    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(400).json({ message: "Team not found" });
    }

    // Get all players
    const players = await User.find({
      team: teamId,
      role: "player",
      registrationStatus: "approved",
      isActive: true
    }).select("firstName lastName battingStats pitchingStats fieldingStats");

    if (players.length === 0) {
      return res.json({
        message: "No players found for this team",
        team: {
          _id: team._id,
          name: team.name
        },
        statistics: null
      });
    }

    // Calculate statistics
    let totalHits = 0;
    let totalAtBats = 0;
    let totalHomeRuns = 0;
    let totalRBI = 0;
    let totalWins = 0;
    let totalLosses = 0;
    let topBatter = null;
    let topPitcher = null;
    let highestAvg = 0;
    let lowestERA = 999;

    players.forEach(player => {
      // Batting stats
      if (player.battingStats && player.battingStats.length > 0) {
        const stats = player.battingStats[0];
        totalHits += stats.hits || 0;
        totalAtBats += stats.at_bats || 0;
        totalHomeRuns += stats.home_runs || 0;
        totalRBI += stats.rbi || 0;

        const playerAvg = stats.batting_average || 0;
        if (playerAvg > highestAvg) {
          highestAvg = playerAvg;
          topBatter = {
            name: `${player.firstName} ${player.lastName}`,
            average: playerAvg,
            homeRuns: stats.home_runs || 0,
            rbi: stats.rbi || 0
          };
        }
      }

      // Pitching stats
      if (player.pitchingStats && player.pitchingStats.length > 0) {
        const stats = player.pitchingStats[0];
        totalWins += stats.wins || 0;
        totalLosses += stats.losses || 0;

        const playerERA = stats.era || 999;
        if (playerERA < lowestERA && playerERA > 0) {
          lowestERA = playerERA;
          topPitcher = {
            name: `${player.firstName} ${player.lastName}`,
            era: playerERA,
            wins: stats.wins || 0,
            losses: stats.losses || 0,
            strikeouts: stats.strikeouts_pitched || 0
          };
        }
      }
    });

    const teamAverage = totalAtBats > 0 ? (totalHits / totalAtBats).toFixed(3) : "0.000";
    const winPercentage = totalWins + totalLosses > 0
      ? ((totalWins / (totalWins + totalLosses)) * 100).toFixed(1)
      : "0.0";

    res.json({
      message: "Team statistics retrieved successfully",
      team: {
        _id: team._id,
        name: team.name,
        logo: team.logo,
        record: {
          home: team.home,
          away: team.away,
          neutral: team.neutral,
          conference: team.conference
        }
      },
      statistics: {
        totalPlayers: players.length,
        teamBattingAverage: teamAverage,
        totalHomeRuns,
        totalRBI,
        totalWins,
        totalLosses,
        winPercentage,
        topBatter,
        topPitcher
      }
    });
  } catch (error) {
    console.error("Get Team Statistics Error:", error);
    res.status(500).json({ message: error.message });
  }
};

// GET AVAILABLE POSITIONS FOR TEAM
export const getTeamPositions = async (req, res) => {
  try {
    const { teamId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(teamId)) {
      return res.status(400).json({ message: "Invalid team ID format" });
    }

    const players = await User.find({
      team: teamId,
      role: "player",
      registrationStatus: "approved",
      isActive: true
    }).select("position");

    const positions = [...new Set(players.map(p => p.position).filter(Boolean))];

    res.json({
      message: "Team positions retrieved successfully",
      positions: positions.sort()
    });
  } catch (error) {
    console.error("Get Team Positions Error:", error);
    res.status(500).json({ message: error.message });
  }
};