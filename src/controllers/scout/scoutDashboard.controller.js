import User from "../../models/user.model.js";
import Follow from "../../models/follow.model.js";
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

// COMBINED SCOUT DASHBOARD
export const getScoutDashboardOLDWITHOUTFILTERS = async (req, res) => {
  try {
    const scoutId = req.user.id;
    const {
      page = 1,
      limit = 10,
      statsType = "batting", // batting, pitching, fielding
      sortBy = "batting_average",
      sortOrder = "desc"
    } = req.query;

    const baseURL = `${req.protocol}://${req.get("host")}`;

    // 1. Get scout details
    const scout = await User.findById(scoutId)
      .populate('team', 'name logo location division')
      .select("-password");

    if (!scout || scout.role !== "scout") {
      return res.status(403).json({ message: "Access denied. Scout role required." });
    }

    // 2. Get follow counts
    const [followersCount, followingCount] = await Promise.all([
      Follow.countDocuments({ following: scoutId }),
      Follow.countDocuments({ follower: scoutId })
    ]);

    // 3. Get list of players scout is following
    const followingList = await Follow.find({ follower: scoutId }).distinct('following');

    // 4. Get followed players with stats (for dashboard table)
    let followedPlayersData = {
      players: [],
      pagination: {
        currentPage: 1,
        totalPages: 0,
        totalCount: 0,
        limit: parseInt(limit),
        hasMore: false
      }
    };

    if (followingList.length > 0) {
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const sortOptions = {};

      // Build sort options based on stats type
      if (statsType === "batting") {
        sortOptions[`battingStats.0.${sortBy}`] = sortOrder === "asc" ? 1 : -1;
      } else if (statsType === "pitching") {
        sortOptions[`pitchingStats.0.${sortBy}`] = sortOrder === "asc" ? 1 : -1;
      } else if (statsType === "fielding") {
        sortOptions[`fieldingStats.0.${sortBy}`] = sortOrder === "asc" ? 1 : -1;
      }

      const [players, totalCount] = await Promise.all([
        User.find({
          _id: { $in: followingList },
          role: "player"
        })
          .populate('team', 'name logo location division')
          .select("firstName lastName email position jerseyNumber profileImage battingStats pitchingStats fieldingStats videos team")
          .sort(sortOptions)
          .skip(skip)
          .limit(parseInt(limit)),
        User.countDocuments({
          _id: { $in: followingList },
          role: "player"
        })
      ]);

      const formattedPlayers = players.map(player => {
        const userData = formatUserData(player, baseURL);

        // Get latest stats
        const latestBattingStats = userData.battingStats?.[0] || {};
        const latestPitchingStats = userData.pitchingStats?.[0] || {};
        const latestFieldingStats = userData.fieldingStats?.[0] || {};

        // Format videos with full URLs
        const formattedVideos = userData.videos && userData.videos.length > 0
          ? userData.videos.map(video => ({
              _id: video._id,
              url: video.url.startsWith("http") ? video.url : `${baseURL}${video.url}`,
              title: video.title,
              uploadedAt: video.uploadedAt,
              fileSize: video.fileSize
            }))
          : [];

        return {
          _id: userData._id,
          name: `${userData.firstName} ${userData.lastName}`,
          position: userData.position || "N/A",
          team: userData.team?.name || "N/A",
          teamLogo: userData.team?.logo || null,
          class: latestBattingStats.seasonYear || latestPitchingStats.seasonYear || latestFieldingStats.seasonYear || "N/A",
          profileImage: userData.profileImage,
          battingStats: latestBattingStats,
          pitchingStats: latestPitchingStats,
          fieldingStats: latestFieldingStats,
          videos: formattedVideos
        };
      });

      followedPlayersData = {
        players: formattedPlayers,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          totalCount,
          limit: parseInt(limit),
          hasMore: skip + formattedPlayers.length < totalCount
        }
      };
    }

    // 5. Get suggested profiles (10 players)
    const suggestedPlayers = await User.find({
      role: "player",
      registrationStatus: "approved",
      isActive: true,
      _id: { $ne: scoutId, $nin: followingList }
    })
      .populate('team', 'name logo location division')
      .select("firstName lastName email position jerseyNumber profileImage profileCompleteness team")
      .limit(10)
      .sort({ profileCompleteness: -1, createdAt: -1 });

    const formattedSuggestions = suggestedPlayers.map(player => formatUserData(player, baseURL));

    // 6. Get top players (for "Follow the Top Players" section)
    const topPlayers = await User.find({
      role: "player",
      registrationStatus: "approved",
      isActive: true,
      _id: { $ne: scoutId, $nin: followingList }
    })
      .populate('team', 'name logo location division')
      .select("firstName lastName email position jerseyNumber profileImage profileCompleteness team")
      .sort({ profileCompleteness: -1 })
      .limit(10);

    const formattedTopPlayers = topPlayers.map(player => formatUserData(player, baseURL));

    // Combine all data
    const scoutData = formatUserData(scout, baseURL);

    res.json({
      message: "Scout dashboard retrieved successfully",
      dashboard: {
        scout: {
          ...scoutData,
          followersCount,
          followingCount
        },
        suggestions: formattedSuggestions,
        topPlayers: formattedTopPlayers,
        followedPlayers: followedPlayersData.players,
        pagination: followedPlayersData.pagination
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// COMBINED SCOUT DASHBOARD WITHFILTERS
export const getScoutDashboard = async (req, res) => {
  try {
    const scoutId = req.user.id;
    const {
      page = 1,
      limit = 10,
      statsType = "batting", // batting, pitching, fielding
      sortBy = "batting_average",
      sortOrder = "desc",
      
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
      double_plays_max
    } = req.query;

    const baseURL = `${req.protocol}://${req.get("host")}`;

    // Get scout details
    const scout = await User.findById(scoutId).populate('team', 'name logo location division').select("-password");
    if (!scout || scout.role !== "scout") {
      return res.status(403).json({ message: "Access denied. Scout role required." });
    }

    // Get follow counts
    const [followersCount, followingCount] = await Promise.all([
      Follow.countDocuments({ following: scoutId }),
      Follow.countDocuments({ follower: scoutId })
    ]);

    // Get list of players scout is following
    const followingList = await Follow.find({ follower: scoutId }).distinct('following');

    // Get followed players with stats and filters
    let followedPlayersData = {
      players: [],
      pagination: {
        currentPage: 1,
        totalPages: 0,
        totalCount: 0,
        limit: parseInt(limit),
        hasMore: false
      }
    };

    if (followingList.length > 0) {
      const skip = (parseInt(page) - 1) * parseInt(limit);
      
      // === BUILD FILTER QUERY ===
      const filterQuery = {
        _id: { $in: followingList },
        role: "player"
      };

      // === APPLY BATTING FILTERS ===
      if (statsType === "batting") {
        if (batting_average_min || batting_average_max) {
          filterQuery['battingStats.0.batting_average'] = {};
          if (batting_average_min) {
            filterQuery['battingStats.0.batting_average'].$gte = parseFloat(batting_average_min);
          }
          if (batting_average_max) {
            filterQuery['battingStats.0.batting_average'].$lte = parseFloat(batting_average_max);
          }
        }

        if (on_base_percentage_min || on_base_percentage_max) {
          filterQuery['battingStats.0.on_base_percentage'] = {};
          if (on_base_percentage_min) {
            filterQuery['battingStats.0.on_base_percentage'].$gte = parseFloat(on_base_percentage_min);
          }
          if (on_base_percentage_max) {
            filterQuery['battingStats.0.on_base_percentage'].$lte = parseFloat(on_base_percentage_max);
          }
        }

        if (slugging_percentage_min || slugging_percentage_max) {
          filterQuery['battingStats.0.slugging_percentage'] = {};
          if (slugging_percentage_min) {
            filterQuery['battingStats.0.slugging_percentage'].$gte = parseFloat(slugging_percentage_min);
          }
          if (slugging_percentage_max) {
            filterQuery['battingStats.0.slugging_percentage'].$lte = parseFloat(slugging_percentage_max);
          }
        }

        if (home_runs_min || home_runs_max) {
          filterQuery['battingStats.0.home_runs'] = {};
          if (home_runs_min) {
            filterQuery['battingStats.0.home_runs'].$gte = parseInt(home_runs_min);
          }
          if (home_runs_max) {
            filterQuery['battingStats.0.home_runs'].$lte = parseInt(home_runs_max);
          }
        }

        if (rbi_min || rbi_max) {
          filterQuery['battingStats.0.rbi'] = {};
          if (rbi_min) {
            filterQuery['battingStats.0.rbi'].$gte = parseInt(rbi_min);
          }
          if (rbi_max) {
            filterQuery['battingStats.0.rbi'].$lte = parseInt(rbi_max);
          }
        }

        if (hits_min || hits_max) {
          filterQuery['battingStats.0.hits'] = {};
          if (hits_min) {
            filterQuery['battingStats.0.hits'].$gte = parseInt(hits_min);
          }
          if (hits_max) {
            filterQuery['battingStats.0.hits'].$lte = parseInt(hits_max);
          }
        }

        if (runs_min || runs_max) {
          filterQuery['battingStats.0.runs'] = {};
          if (runs_min) {
            filterQuery['battingStats.0.runs'].$gte = parseInt(runs_min);
          }
          if (runs_max) {
            filterQuery['battingStats.0.runs'].$lte = parseInt(runs_max);
          }
        }

        if (doubles_min || doubles_max) {
          filterQuery['battingStats.0.doubles'] = {};
          if (doubles_min) {
            filterQuery['battingStats.0.doubles'].$gte = parseInt(doubles_min);
          }
          if (doubles_max) {
            filterQuery['battingStats.0.doubles'].$lte = parseInt(doubles_max);
          }
        }

        if (triples_min || triples_max) {
          filterQuery['battingStats.0.triples'] = {};
          if (triples_min) {
            filterQuery['battingStats.0.triples'].$gte = parseInt(triples_min);
          }
          if (triples_max) {
            filterQuery['battingStats.0.triples'].$lte = parseInt(triples_max);
          }
        }

        if (walks_min || walks_max) {
          filterQuery['battingStats.0.walks'] = {};
          if (walks_min) {
            filterQuery['battingStats.0.walks'].$gte = parseInt(walks_min);
          }
          if (walks_max) {
            filterQuery['battingStats.0.walks'].$lte = parseInt(walks_max);
          }
        }

        if (strikeouts_min || strikeouts_max) {
          filterQuery['battingStats.0.strikeouts'] = {};
          if (strikeouts_min) {
            filterQuery['battingStats.0.strikeouts'].$gte = parseInt(strikeouts_min);
          }
          if (strikeouts_max) {
            filterQuery['battingStats.0.strikeouts'].$lte = parseInt(strikeouts_max);
          }
        }

        if (stolen_bases_min || stolen_bases_max) {
          filterQuery['battingStats.0.stolen_bases'] = {};
          if (stolen_bases_min) {
            filterQuery['battingStats.0.stolen_bases'].$gte = parseInt(stolen_bases_min);
          }
          if (stolen_bases_max) {
            filterQuery['battingStats.0.stolen_bases'].$lte = parseInt(stolen_bases_max);
          }
        }
      }

      // === APPLY PITCHING FILTERS ===
      if (statsType === "pitching") {
        if (era_min || era_max) {
          filterQuery['pitchingStats.0.era'] = {};
          if (era_min) {
            filterQuery['pitchingStats.0.era'].$gte = parseFloat(era_min);
          }
          if (era_max) {
            filterQuery['pitchingStats.0.era'].$lte = parseFloat(era_max);
          }
        }

        if (wins_min || wins_max) {
          filterQuery['pitchingStats.0.wins'] = {};
          if (wins_min) {
            filterQuery['pitchingStats.0.wins'].$gte = parseInt(wins_min);
          }
          if (wins_max) {
            filterQuery['pitchingStats.0.wins'].$lte = parseInt(wins_max);
          }
        }

        if (losses_min || losses_max) {
          filterQuery['pitchingStats.0.losses'] = {};
          if (losses_min) {
            filterQuery['pitchingStats.0.losses'].$gte = parseInt(losses_min);
          }
          if (losses_max) {
            filterQuery['pitchingStats.0.losses'].$lte = parseInt(losses_max);
          }
        }

        if (strikeouts_pitched_min || strikeouts_pitched_max) {
          filterQuery['pitchingStats.0.strikeouts_pitched'] = {};
          if (strikeouts_pitched_min) {
            filterQuery['pitchingStats.0.strikeouts_pitched'].$gte = parseInt(strikeouts_pitched_min);
          }
          if (strikeouts_pitched_max) {
            filterQuery['pitchingStats.0.strikeouts_pitched'].$lte = parseInt(strikeouts_pitched_max);
          }
        }

        if (innings_pitched_min || innings_pitched_max) {
          filterQuery['pitchingStats.0.innings_pitched'] = {};
          if (innings_pitched_min) {
            filterQuery['pitchingStats.0.innings_pitched'].$gte = parseFloat(innings_pitched_min);
          }
          if (innings_pitched_max) {
            filterQuery['pitchingStats.0.innings_pitched'].$lte = parseFloat(innings_pitched_max);
          }
        }

        if (walks_allowed_min || walks_allowed_max) {
          filterQuery['pitchingStats.0.walks_allowed'] = {};
          if (walks_allowed_min) {
            filterQuery['pitchingStats.0.walks_allowed'].$gte = parseInt(walks_allowed_min);
          }
          if (walks_allowed_max) {
            filterQuery['pitchingStats.0.walks_allowed'].$lte = parseInt(walks_allowed_max);
          }
        }

        if (hits_allowed_min || hits_allowed_max) {
          filterQuery['pitchingStats.0.hits_allowed'] = {};
          if (hits_allowed_min) {
            filterQuery['pitchingStats.0.hits_allowed'].$gte = parseInt(hits_allowed_min);
          }
          if (hits_allowed_max) {
            filterQuery['pitchingStats.0.hits_allowed'].$lte = parseInt(hits_allowed_max);
          }
        }

        if (saves_min || saves_max) {
          filterQuery['pitchingStats.0.saves'] = {};
          if (saves_min) {
            filterQuery['pitchingStats.0.saves'].$gte = parseInt(saves_min);
          }
          if (saves_max) {
            filterQuery['pitchingStats.0.saves'].$lte = parseInt(saves_max);
          }
        }
      }

      // === APPLY FIELDING FILTERS ===
      if (statsType === "fielding") {
        if (fielding_percentage_min || fielding_percentage_max) {
          filterQuery['fieldingStats.0.fielding_percentage'] = {};
          if (fielding_percentage_min) {
            filterQuery['fieldingStats.0.fielding_percentage'].$gte = parseFloat(fielding_percentage_min);
          }
          if (fielding_percentage_max) {
            filterQuery['fieldingStats.0.fielding_percentage'].$lte = parseFloat(fielding_percentage_max);
          }
        }

        if (errors_min || errors_max) {
          filterQuery['fieldingStats.0.errors'] = {};
          if (errors_min) {
            filterQuery['fieldingStats.0.errors'].$gte = parseInt(errors_min);
          }
          if (errors_max) {
            filterQuery['fieldingStats.0.errors'].$lte = parseInt(errors_max);
          }
        }

        if (putouts_min || putouts_max) {
          filterQuery['fieldingStats.0.putouts'] = {};
          if (putouts_min) {
            filterQuery['fieldingStats.0.putouts'].$gte = parseInt(putouts_min);
          }
          if (putouts_max) {
            filterQuery['fieldingStats.0.putouts'].$lte = parseInt(putouts_max);
          }
        }

        if (assists_min || assists_max) {
          filterQuery['fieldingStats.0.assists'] = {};
          if (assists_min) {
            filterQuery['fieldingStats.0.assists'].$gte = parseInt(assists_min);
          }
          if (assists_max) {
            filterQuery['fieldingStats.0.assists'].$lte = parseInt(assists_max);
          }
        }

        if (double_plays_min || double_plays_max) {
          filterQuery['fieldingStats.0.double_plays'] = {};
          if (double_plays_min) {
            filterQuery['fieldingStats.0.double_plays'].$gte = parseInt(double_plays_min);
          }
          if (double_plays_max) {
            filterQuery['fieldingStats.0.double_plays'].$lte = parseInt(double_plays_max);
          }
        }
      }

      // === BUILD SORT OPTIONS ===
      const sortOptions = {};
      if (statsType === "batting") {
        sortOptions[`battingStats.0.${sortBy}`] = sortOrder === "asc" ? 1 : -1;
      } else if (statsType === "pitching") {
        sortOptions[`pitchingStats.0.${sortBy}`] = sortOrder === "asc" ? 1 : -1;
      } else if (statsType === "fielding") {
        sortOptions[`fieldingStats.0.${sortBy}`] = sortOrder === "asc" ? 1 : -1;
      }

      // === EXECUTE QUERY WITH FILTERS ===
      const [players, totalCount] = await Promise.all([
        User.find(filterQuery)
          .populate('team', 'name logo location division')
          .select("firstName lastName email position jerseyNumber profileImage battingStats pitchingStats fieldingStats videos team")
          .sort(sortOptions)
          .skip(skip)
          .limit(parseInt(limit)),
        User.countDocuments(filterQuery)
      ]);

      const formattedPlayers = players.map(player => {
        const userData = formatUserData(player, baseURL);

        // Get latest stats
        const latestBattingStats = userData.battingStats?.[0] || {};
        const latestPitchingStats = userData.pitchingStats?.[0] || {};
        const latestFieldingStats = userData.fieldingStats?.[0] || {};

        // Format videos with full URLs
        const formattedVideos = userData.videos && userData.videos.length > 0
          ? userData.videos.map(video => ({
              _id: video._id,
              url: video.url.startsWith("http") ? video.url : `${baseURL}${video.url}`,
              title: video.title,
              uploadedAt: video.uploadedAt,
              fileSize: video.fileSize
            }))
          : [];

        return {
          _id: userData._id,
          name: `${userData.firstName} ${userData.lastName}`,
          position: userData.position || "N/A",
          team: userData.team?.name || "N/A",
          teamLogo: userData.team?.logo || null,
          class: latestBattingStats.seasonYear || latestPitchingStats.seasonYear || latestFieldingStats.seasonYear || "N/A",
          profileImage: userData.profileImage,
          battingStats: latestBattingStats,
          pitchingStats: latestPitchingStats,
          fieldingStats: latestFieldingStats,
          videos: formattedVideos
        };
      });

      followedPlayersData = {
        players: formattedPlayers,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          totalCount,
          limit: parseInt(limit),
          hasMore: skip + formattedPlayers.length < totalCount
        }
      };
    }

    // Get suggested profiles
    const suggestedPlayers = await User.find({role: "player", registrationStatus: "approved", isActive: true, _id: { $ne: scoutId, $nin: followingList }}).populate('team', 'name logo location division').select("firstName lastName email position jerseyNumber profileImage profileCompleteness team").limit(10).sort({ profileCompleteness: -1, createdAt: -1 });
    const formattedSuggestions = suggestedPlayers.map(player => formatUserData(player, baseURL));

    // Get top players
    const topPlayers = await User.find({role: "player",registrationStatus: "approved",isActive: true,_id: { $ne: scoutId, $nin: followingList }}).populate('team', 'name logo location division').select("firstName lastName email position jerseyNumber profileImage profileCompleteness team").sort({ profileCompleteness: -1 }).limit(10);
    const formattedTopPlayers = topPlayers.map(player => formatUserData(player, baseURL));

    // Combine all data
    const scoutData = formatUserData(scout, baseURL);

    res.json({
      message: "Scout dashboard retrieved successfully",
      dashboard: {
        scout: {
          ...scoutData,
          followersCount,
          followingCount
        },
        suggestions: formattedSuggestions,
        topPlayers: formattedTopPlayers,
        followedPlayers: followedPlayersData.players,
        pagination: followedPlayersData.pagination
      }
    });
  } catch (error) {
    console.error("Scout Dashboard Error:", error);
    res.status(500).json({ message: error.message });
  }
};

// GET SUGGESTED PROFILES
export const getSuggestedProfiles = async (req, res) => {
  try {
    const scoutId = req.user.id;
    const { limit = 10 } = req.query;

    // Get users that scout is already following
    const alreadyFollowing = await Follow.find({ follower: scoutId }).distinct('following');

    // Get suggested players
    const suggestedPlayers = await User.find({
      role: "player",
      registrationStatus: "approved",
      isActive: true,
      _id: { $ne: scoutId, $nin: alreadyFollowing }
    })
      .populate('team', 'name logo location division')
      .select("firstName lastName email position jerseyNumber profileImage profileCompleteness team")
      .limit(parseInt(limit))
      .sort({ profileCompleteness: -1, createdAt: -1 });

    const baseURL = `${req.protocol}://${req.get("host")}`;
    const formattedProfiles = suggestedPlayers.map(player => formatUserData(player, baseURL));

    res.json({
      message: "Suggested profiles retrieved successfully",
      suggestions: formattedProfiles,
      totalSuggestions: formattedProfiles.length
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// FOLLOW USER
export const followUser = async (req, res) => {
  try {
    const scoutId = req.user.id;
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    // Check if user exists
    const userToFollow = await User.findById(userId);
    if (!userToFollow) {
      return res.status(404).json({ message: "User not found" });
    }

    // Prevent self-following
    if (scoutId === userId) {
      return res.status(400).json({ message: "You cannot follow yourself" });
    }

    // Check if already following
    const existingFollow = await Follow.findOne({
      follower: scoutId,
      following: userId
    });

    if (existingFollow) {
      return res.status(400).json({ message: "Already following this user" });
    }

    // Create follow relationship
    await Follow.create({
      follower: scoutId,
      following: userId
    });

    res.json({
      message: "Successfully followed user",
      followedUser: {
        _id: userToFollow._id,
        firstName: userToFollow.firstName,
        lastName: userToFollow.lastName,
        role: userToFollow.role
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// UNFOLLOW USER
export const unfollowUser = async (req, res) => {
  try {
    const scoutId = req.user.id;
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    // Check if following relationship exists
    const follow = await Follow.findOneAndDelete({
      follower: scoutId,
      following: userId
    });

    if (!follow) {
      return res.status(404).json({ message: "Not following this user" });
    }

    res.json({
      message: "Successfully unfollowed user"
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET FOLLOWING LIST
export const getFollowingList = async (req, res) => {
  try {
    const scoutId = req.user.id;
    const { page = 1, limit = 20 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [followingList, totalCount] = await Promise.all([
      Follow.find({ follower: scoutId })
        .populate({
          path: 'following',
          populate: {
            path: 'team',
            select: 'name logo location division'
          },
          select: 'firstName lastName email role position jerseyNumber profileImage profileCompleteness team'
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Follow.countDocuments({ follower: scoutId })
    ]);

    const baseURL = `${req.protocol}://${req.get("host")}`;
    const formattedFollowing = followingList
      .filter(f => f.following)
      .map(follow => {
        const userData = formatUserData(follow.following, baseURL);
        return {
          ...userData,
          followedAt: follow.followedAt
        };
      });

    res.json({
      message: "Following list retrieved successfully",
      following: formattedFollowing,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalCount,
        limit: parseInt(limit),
        hasMore: skip + formattedFollowing.length < totalCount
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET FOLLOWERS LIST
export const getFollowersList = async (req, res) => {
  try {
    const scoutId = req.user.id;
    const { page = 1, limit = 20 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [followersList, totalCount] = await Promise.all([
      Follow.find({ following: scoutId })
        .populate({
          path: 'follower',
          populate: {
            path: 'team',
            select: 'name logo location division'
          },
          select: 'firstName lastName email role position jerseyNumber profileImage profileCompleteness team'
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Follow.countDocuments({ following: scoutId })
    ]);

    const baseURL = `${req.protocol}://${req.get("host")}`;
    const formattedFollowers = followersList
      .filter(f => f.follower)
      .map(follow => {
        const userData = formatUserData(follow.follower, baseURL);
        return {
          ...userData,
          followedAt: follow.followedAt
        };
      });

    res.json({
      message: "Followers list retrieved successfully",
      followers: formattedFollowers,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalCount,
        limit: parseInt(limit),
        hasMore: skip + formattedFollowers.length < totalCount
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// CHECK IF FOLLOWING
export const checkIfFollowing = async (req, res) => {
  try {
    const scoutId = req.user.id;
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const isFollowing = await Follow.exists({
      follower: scoutId,
      following: userId
    });

    res.json({
      message: "Follow status retrieved successfully",
      isFollowing: !!isFollowing
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET TOP PLAYERS
export const getTopPlayers = async (req, res) => {
  try {
    const scoutId = req.user.id;
    const { limit = 10 } = req.query;

    // Get users that scout is already following
    const alreadyFollowing = await Follow.find({ follower: scoutId }).distinct('following');

    // Get top players
    const topPlayers = await User.find({
      role: "player",
      registrationStatus: "approved",
      isActive: true,
      _id: { $ne: scoutId, $nin: alreadyFollowing }
    })
      .populate('team', 'name logo location division')
      .select("firstName lastName email position jerseyNumber profileImage profileCompleteness battingStats team")
      .sort({ profileCompleteness: -1 })
      .limit(parseInt(limit));

    const baseURL = `${req.protocol}://${req.get("host")}`;
    const formattedPlayers = topPlayers.map(player => formatUserData(player, baseURL));

    res.json({
      message: "Top players retrieved successfully",
      topPlayers: formattedPlayers,
      totalPlayers: formattedPlayers.length
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};