import User from "../../models/user.model.js";
import Follow from "../../models/follow.model.js";
import FollowTeam from "../../models/followTeam.model.js";
import Team from "../../models/team.model.js";
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

const POSITION_DETAIL_MAP = {
  P: "Pitcher",

  RHP: "Right-Handed Pitcher",
  LHP: "Left-Handed Pitcher",

  C: "Catcher",

  "1B": "First Baseman",
  "2B": "Second Baseman",
  SS: "Shortstop",
  "3B": "Third Baseman",

  LF: "Left Fielder",
  CF: "Center Fielder",
  RF: "Right Fielder",

  DH: "Designated Hitter",
  INF: "Infielders",
  OF: "Outfielders",
  "OF RHP": "Outfielder Right-Handed Pitcher",
};

// COACH DASHBOARD
export const getCoachDashboardOLDFILTERS = async (req, res) => {
  try {
    const coachId = req.user.id;
    const {
      page = 1,
      limit = 20,
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

    // Get coach details
    const coach = await User.findById(coachId).select("-password");
    if (!coach || coach.role !== "coach") {
      return res.status(403).json({ message: "Access denied. Coach role required." });
    }

    // Get follow counts
    const [followersCount, followingCount] = await Promise.all([
      Follow.countDocuments({ following: coachId }),
      Follow.countDocuments({ follower: coachId })
    ]);

    // Get list of players coach is following
    const followingList = await Follow.find({ follower: coachId }).distinct('following');

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

      // BUILD FILTER QUERY
      const filterQuery = {
        _id: { $in: followingList },
        role: "player"
      };

      // APPLY BATTING FILTERS
      if (statsType === "batting") {
        // Batting Average Filter
        if (batting_average_min || batting_average_max) {
          filterQuery['battingStats.0.batting_average'] = {};
          if (batting_average_min) {
            filterQuery['battingStats.0.batting_average'].$gte = parseFloat(batting_average_min);
          }
          if (batting_average_max) {
            filterQuery['battingStats.0.batting_average'].$lte = parseFloat(batting_average_max);
          }
        }

        // On Base Percentage Filter
        if (on_base_percentage_min || on_base_percentage_max) {
          filterQuery['battingStats.0.on_base_percentage'] = {};
          if (on_base_percentage_min) {
            filterQuery['battingStats.0.on_base_percentage'].$gte = parseFloat(on_base_percentage_min);
          }
          if (on_base_percentage_max) {
            filterQuery['battingStats.0.on_base_percentage'].$lte = parseFloat(on_base_percentage_max);
          }
        }

        // Slugging Percentage Filter
        if (slugging_percentage_min || slugging_percentage_max) {
          filterQuery['battingStats.0.slugging_percentage'] = {};
          if (slugging_percentage_min) {
            filterQuery['battingStats.0.slugging_percentage'].$gte = parseFloat(slugging_percentage_min);
          }
          if (slugging_percentage_max) {
            filterQuery['battingStats.0.slugging_percentage'].$lte = parseFloat(slugging_percentage_max);
          }
        }

        // Home Runs Filter
        if (home_runs_min || home_runs_max) {
          filterQuery['battingStats.0.home_runs'] = {};
          if (home_runs_min) {
            filterQuery['battingStats.0.home_runs'].$gte = parseInt(home_runs_min);
          }
          if (home_runs_max) {
            filterQuery['battingStats.0.home_runs'].$lte = parseInt(home_runs_max);
          }
        }

        // RBI Filter
        if (rbi_min || rbi_max) {
          filterQuery['battingStats.0.rbi'] = {};
          if (rbi_min) {
            filterQuery['battingStats.0.rbi'].$gte = parseInt(rbi_min);
          }
          if (rbi_max) {
            filterQuery['battingStats.0.rbi'].$lte = parseInt(rbi_max);
          }
        }

        // Hits Filter
        if (hits_min || hits_max) {
          filterQuery['battingStats.0.hits'] = {};
          if (hits_min) {
            filterQuery['battingStats.0.hits'].$gte = parseInt(hits_min);
          }
          if (hits_max) {
            filterQuery['battingStats.0.hits'].$lte = parseInt(hits_max);
          }
        }

        // Runs Filter
        if (runs_min || runs_max) {
          filterQuery['battingStats.0.runs'] = {};
          if (runs_min) {
            filterQuery['battingStats.0.runs'].$gte = parseInt(runs_min);
          }
          if (runs_max) {
            filterQuery['battingStats.0.runs'].$lte = parseInt(runs_max);
          }
        }

        // Doubles Filter
        if (doubles_min || doubles_max) {
          filterQuery['battingStats.0.doubles'] = {};
          if (doubles_min) {
            filterQuery['battingStats.0.doubles'].$gte = parseInt(doubles_min);
          }
          if (doubles_max) {
            filterQuery['battingStats.0.doubles'].$lte = parseInt(doubles_max);
          }
        }

        // Triples Filter
        if (triples_min || triples_max) {
          filterQuery['battingStats.0.triples'] = {};
          if (triples_min) {
            filterQuery['battingStats.0.triples'].$gte = parseInt(triples_min);
          }
          if (triples_max) {
            filterQuery['battingStats.0.triples'].$lte = parseInt(triples_max);
          }
        }

        // Walks Filter
        if (walks_min || walks_max) {
          filterQuery['battingStats.0.walks'] = {};
          if (walks_min) {
            filterQuery['battingStats.0.walks'].$gte = parseInt(walks_min);
          }
          if (walks_max) {
            filterQuery['battingStats.0.walks'].$lte = parseInt(walks_max);
          }
        }

        // Strikeouts Filter
        if (strikeouts_min || strikeouts_max) {
          filterQuery['battingStats.0.strikeouts'] = {};
          if (strikeouts_min) {
            filterQuery['battingStats.0.strikeouts'].$gte = parseInt(strikeouts_min);
          }
          if (strikeouts_max) {
            filterQuery['battingStats.0.strikeouts'].$lte = parseInt(strikeouts_max);
          }
        }

        // Stolen Bases Filter
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

      // APPLY PITCHING FILTERS
      if (statsType === "pitching") {
        // ERA Filter
        if (era_min || era_max) {
          filterQuery['pitchingStats.0.era'] = {};
          if (era_min) {
            filterQuery['pitchingStats.0.era'].$gte = parseFloat(era_min);
          }
          if (era_max) {
            filterQuery['pitchingStats.0.era'].$lte = parseFloat(era_max);
          }
        }

        // Wins Filter
        if (wins_min || wins_max) {
          filterQuery['pitchingStats.0.wins'] = {};
          if (wins_min) {
            filterQuery['pitchingStats.0.wins'].$gte = parseInt(wins_min);
          }
          if (wins_max) {
            filterQuery['pitchingStats.0.wins'].$lte = parseInt(wins_max);
          }
        }

        // Losses Filter
        if (losses_min || losses_max) {
          filterQuery['pitchingStats.0.losses'] = {};
          if (losses_min) {
            filterQuery['pitchingStats.0.losses'].$gte = parseInt(losses_min);
          }
          if (losses_max) {
            filterQuery['pitchingStats.0.losses'].$lte = parseInt(losses_max);
          }
        }

        // Strikeouts Pitched Filter
        if (strikeouts_pitched_min || strikeouts_pitched_max) {
          filterQuery['pitchingStats.0.strikeouts_pitched'] = {};
          if (strikeouts_pitched_min) {
            filterQuery['pitchingStats.0.strikeouts_pitched'].$gte = parseInt(strikeouts_pitched_min);
          }
          if (strikeouts_pitched_max) {
            filterQuery['pitchingStats.0.strikeouts_pitched'].$lte = parseInt(strikeouts_pitched_max);
          }
        }

        // Innings Pitched Filter
        if (innings_pitched_min || innings_pitched_max) {
          filterQuery['pitchingStats.0.innings_pitched'] = {};
          if (innings_pitched_min) {
            filterQuery['pitchingStats.0.innings_pitched'].$gte = parseFloat(innings_pitched_min);
          }
          if (innings_pitched_max) {
            filterQuery['pitchingStats.0.innings_pitched'].$lte = parseFloat(innings_pitched_max);
          }
        }

        // Walks Allowed Filter
        if (walks_allowed_min || walks_allowed_max) {
          filterQuery['pitchingStats.0.walks_allowed'] = {};
          if (walks_allowed_min) {
            filterQuery['pitchingStats.0.walks_allowed'].$gte = parseInt(walks_allowed_min);
          }
          if (walks_allowed_max) {
            filterQuery['pitchingStats.0.walks_allowed'].$lte = parseInt(walks_allowed_max);
          }
        }

        // Hits Allowed Filter
        if (hits_allowed_min || hits_allowed_max) {
          filterQuery['pitchingStats.0.hits_allowed'] = {};
          if (hits_allowed_min) {
            filterQuery['pitchingStats.0.hits_allowed'].$gte = parseInt(hits_allowed_min);
          }
          if (hits_allowed_max) {
            filterQuery['pitchingStats.0.hits_allowed'].$lte = parseInt(hits_allowed_max);
          }
        }

        // Saves Filter
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

      // APPLY FIELDING FILTERS
      if (statsType === "fielding") {
        // Fielding Percentage Filter
        if (fielding_percentage_min || fielding_percentage_max) {
          filterQuery['fieldingStats.0.fielding_percentage'] = {};
          if (fielding_percentage_min) {
            filterQuery['fieldingStats.0.fielding_percentage'].$gte = parseFloat(fielding_percentage_min);
          }
          if (fielding_percentage_max) {
            filterQuery['fieldingStats.0.fielding_percentage'].$lte = parseFloat(fielding_percentage_max);
          }
        }

        // Errors Filter
        if (errors_min || errors_max) {
          filterQuery['fieldingStats.0.errors'] = {};
          if (errors_min) {
            filterQuery['fieldingStats.0.errors'].$gte = parseInt(errors_min);
          }
          if (errors_max) {
            filterQuery['fieldingStats.0.errors'].$lte = parseInt(errors_max);
          }
        }

        // Putouts Filter
        if (putouts_min || putouts_max) {
          filterQuery['fieldingStats.0.putouts'] = {};
          if (putouts_min) {
            filterQuery['fieldingStats.0.putouts'].$gte = parseInt(putouts_min);
          }
          if (putouts_max) {
            filterQuery['fieldingStats.0.putouts'].$lte = parseInt(putouts_max);
          }
        }

        // Assists Filter
        if (assists_min || assists_max) {
          filterQuery['fieldingStats.0.assists'] = {};
          if (assists_min) {
            filterQuery['fieldingStats.0.assists'].$gte = parseInt(assists_min);
          }
          if (assists_max) {
            filterQuery['fieldingStats.0.assists'].$lte = parseInt(assists_max);
          }
        }

        // Double Plays Filter
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
          // .select("firstName lastName email position jerseyNumber profileImage battingStats pitchingStats fieldingStats videos team")
          .sort(sortOptions)
          .skip(skip)
          .limit(parseInt(limit)),
        User.countDocuments(filterQuery)
      ]);

      const formattedPlayers = players.map(player => {
        const userData = formatUserData(player, baseURL);
        const positionCode = userData.position;
        const positionDetailName = POSITION_DETAIL_MAP[positionCode] || "Unknown Position";

        // Get latest stats (keep as arrays like roster API)
        const battingStatsArray = userData.battingStats || [];
        const pitchingStatsArray = userData.pitchingStats || [];
        const fieldingStatsArray = userData.fieldingStats || [];

        // Format videos with full URLs
        const formattedVideos = userData.videos && userData.videos.length > 0
          ? userData.videos.map(video => ({
            _id: video._id,
            url: video.url.startsWith("http") ? video.url : `${baseURL}${video.url}`,
            title: video.title,
            uploadedAt: video.uploadedAt,
            fileSize: video.fileSize,
            duration: video.duration
          }))
          : [];

        return {
          ...userData,
          _id: userData._id,
          name: `${userData.firstName} ${userData.lastName}`,
          position: userData.position || "N/A",
          positionDetailName,
          team: userData.team || null,

          // profileImage: userData.profileImage,
          // height: userData.height || "N/A",
          // weight: userData.weight || "N/A",
          // batsthrow: userData.batsthrow || "N/A",
          // hometown: userData.hometown || "N/A",
          // highschool: userData.highschool || "N/A",
          // previousSchool: userData.previousSchool || "N/A",


          class: battingStatsArray[0]?.seasonYear || pitchingStatsArray[0]?.seasonYear || fieldingStatsArray[0]?.seasonYear || "N/A",
          profileImage: userData.profileImage,
          battingStats: battingStatsArray,      // Return as array
          pitchingStats: pitchingStatsArray,    // Return as array  
          fieldingStats: fieldingStatsArray,
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

    // 5. Get suggested profiles
    const suggestedPlayers = await User.find({
      role: "player",
      registrationStatus: "approved",
      isActive: true,
      _id: { $ne: coachId, $nin: followingList }
    })
      .populate('team', 'name logo location division')
      .select("firstName lastName email position jerseyNumber profileImage profileCompleteness team")
      .limit(10)
      .sort({ profileCompleteness: -1, createdAt: -1 });

    const formattedSuggestions = suggestedPlayers.map(player => formatUserData(player, baseURL));

    // 6. Get top players
    const topPlayers = await User.find({
      role: "player",
      registrationStatus: "approved",
      isActive: true,
      _id: { $ne: coachId, $nin: followingList }
    })
      .populate('team', 'name logo location division')
      .select("firstName lastName email position jerseyNumber profileImage profileCompleteness team")
      .sort({ profileCompleteness: -1 })
      .limit(10);

    const formattedTopPlayers = topPlayers.map(player => formatUserData(player, baseURL));

    // Combine all data
    const coachData = formatUserData(coach, baseURL);

    res.json({
      message: "Coach dashboard retrieved successfully",
      coach: {
        ...coachData,
        followersCount,
        followingCount
      },
      suggestions: formattedSuggestions,
      topPlayers: formattedTopPlayers,
      followedPlayers: followedPlayersData.players,
      pagination: followedPlayersData.pagination
    });
  } catch (error) {
    console.error("Coach Dashboard Error:", error);
    res.status(500).json({ message: error.message });
  }
};

export const getCoachDashboard = async (req, res) => {
  try {
    const coachId = req.user.id;
    const { seasonYear } = req.query;
    const {
      page = 1,
      limit = 20,
      statsType, // batting, pitching, fielding
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

    const buildElemMatch = (seasonYear) => {
      return seasonYear ? { seasonYear: seasonYear } : {};
    };
    const baseURL = `${req.protocol}://${req.get("host")}`;
    const coach = await User.findById(coachId).select("-password");
    if (!coach || coach.role !== "coach") {
      return res.status(403).json({ message: "Access denied. Coach role required." });
    }

    // Get follow counts
    const [followersCount, followingCount] = await Promise.all([
      Follow.countDocuments({ following: coachId }),
      Follow.countDocuments({ follower: coachId })
    ]);

    // Get list of players coach is following
    const followingList = await Follow.find({ follower: coachId }).distinct('following');

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
        const elem = buildElemMatch(seasonYear);

        if (batting_average_min || batting_average_max) {
          elem.batting_average = {};
          if (batting_average_min) elem.batting_average.$gte = parseFloat(batting_average_min);
          if (batting_average_max) elem.batting_average.$lte = parseFloat(batting_average_max);
        }

        if (on_base_percentage_min || on_base_percentage_max) {
          elem.on_base_percentage = {};
          if (on_base_percentage_min) elem.on_base_percentage.$gte = parseFloat(on_base_percentage_min);
          if (on_base_percentage_max) elem.on_base_percentage.$lte = parseFloat(on_base_percentage_max);
        }

        if (slugging_percentage_min || slugging_percentage_max) {
          elem.slugging_percentage = {};
          if (slugging_percentage_min) elem.slugging_percentage.$gte = parseFloat(slugging_percentage_min);
          if (slugging_percentage_max) elem.slugging_percentage.$lte = parseFloat(slugging_percentage_max);
        }

        if (home_runs_min || home_runs_max) {
          elem.home_runs = {};
          if (home_runs_min) elem.home_runs.$gte = parseInt(home_runs_min);
          if (home_runs_max) elem.home_runs.$lte = parseInt(home_runs_max);
        }

        if (rbi_min || rbi_max) {
          elem.rbi = {};
          if (rbi_min) elem.rbi.$gte = parseInt(rbi_min);
          if (rbi_max) elem.rbi.$lte = parseInt(rbi_max);
        }

        if (hits_min || hits_max) {
          elem.hits = {};
          if (hits_min) elem.hits.$gte = parseInt(hits_min);
          if (hits_max) elem.hits.$lte = parseInt(hits_max);
        }

        if (runs_min || runs_max) {
          elem.runs = {};
          if (runs_min) elem.runs.$gte = parseInt(runs_min);
          if (runs_max) elem.runs.$lte = parseInt(runs_max);
        }

        if (doubles_min || doubles_max) {
          elem.doubles = {};
          if (doubles_min) elem.doubles.$gte = parseInt(doubles_min);
          if (doubles_max) elem.doubles.$lte = parseInt(doubles_max);
        }

        if (triples_min || triples_max) {
          elem.triples = {};
          if (triples_min) elem.triples.$gte = parseInt(triples_min);
          if (triples_max) elem.triples.$lte = parseInt(triples_max);
        }

        if (walks_min || walks_max) {
          elem.walks = {};
          if (walks_min) elem.walks.$gte = parseFloat(walks_min);
          if (walks_max) elem.walks.$lte = parseFloat(walks_max);
        }

        if (strikeouts_min || strikeouts_max) {
          elem.strikeouts = {};
          if (strikeouts_min) elem.strikeouts.$gte = parseInt(strikeouts_min);
          if (strikeouts_max) elem.strikeouts.$lte = parseInt(strikeouts_max);
        }

        if (stolen_bases_min || stolen_bases_max) {
          elem.stolen_bases = {};
          if (stolen_bases_min) elem.stolen_bases.$gte = parseInt(stolen_bases_min);
          if (stolen_bases_max) elem.stolen_bases.$lte = parseInt(stolen_bases_max);
        }

        if (Object.keys(elem).length > (seasonYear ? 1 : 0)) {
          filterQuery.battingStats = { $elemMatch: elem };
        }
      }

      // === APPLY PITCHING FILTERS ===
      if (statsType === "pitching") {
        const elem = buildElemMatch(seasonYear);

        if (era_min || era_max) {
          elem.era = {};
          if (era_min) elem.era.$gte = parseFloat(era_min);
          if (era_max) elem.era.$lte = parseFloat(era_max);
        }

        if (wins_min || wins_max) {
          elem.wins = {};
          if (wins_min) elem.wins.$gte = parseInt(wins_min);
          if (wins_max) elem.wins.$lte = parseInt(wins_max);
        }

        if (losses_min || losses_max) {
          elem.losses = {};
          if (losses_min) elem.losses.$gte = parseInt(losses_min);
          if (losses_max) elem.losses.$lte = parseInt(losses_max);
        }

        if (strikeouts_pitched_min || strikeouts_pitched_max) {
          elem.strikeouts_pitched = {};
          if (strikeouts_pitched_min) elem.strikeouts_pitched.$gte = parseInt(strikeouts_pitched_min);
          if (strikeouts_pitched_max) elem.strikeouts_pitched.$lte = parseInt(strikeouts_pitched_max);
        }

        if (innings_pitched_min || innings_pitched_max) {
          elem.innings_pitched = {};
          if (innings_pitched_min) elem.innings_pitched.$gte = parseFloat(innings_pitched_min);
          if (innings_pitched_max) elem.innings_pitched.$lte = parseFloat(innings_pitched_max);
        }

        if (walks_allowed_min || walks_allowed_max) {
          elem.walks_allowed = {};
          if (walks_allowed_min) elem.walks_allowed.$gte = parseInt(walks_allowed_min);
          if (walks_allowed_max) elem.walks_allowed.$lte = parseInt(walks_allowed_max);
        }

        if (hits_allowed_min || hits_allowed_max) {
          elem.hits_allowed = {};
          if (hits_allowed_min) elem.hits_allowed.$gte = parseInt(hits_allowed_min);
          if (hits_allowed_max) elem.hits_allowed.$lte = parseInt(hits_allowed_max);
        }

        if (saves_min || saves_max) {
          elem.saves = {};
          if (saves_min) elem.saves.$gte = parseInt(saves_min);
          if (saves_max) elem.saves.$lte = parseInt(saves_max);
        }

        if (Object.keys(elem).length > (seasonYear ? 1 : 0)) {
          filterQuery.pitchingStats = { $elemMatch: elem };
        }
      }

      // === APPLY FIELDING FILTERS ===
      if (statsType === "fielding") {
        const elem = buildElemMatch(seasonYear);

        if (fielding_percentage_min || fielding_percentage_max) {
          elem.fielding_percentage = {};
          if (fielding_percentage_min) elem.fielding_percentage.$gte = parseFloat(fielding_percentage_min);
          if (fielding_percentage_max) elem.fielding_percentage.$lte = parseFloat(fielding_percentage_max);
        }

        if (errors_min || errors_max) {
          elem.errors = {};
          if (errors_min) elem.errors.$gte = parseInt(errors_min);
          if (errors_max) elem.errors.$lte = parseInt(errors_max);
        }

        if (putouts_min || putouts_max) {
          elem.putouts = {};
          if (putouts_min) elem.putouts.$gte = parseInt(putouts_min);
          if (putouts_max) elem.putouts.$lte = parseInt(putouts_max);
        }

        if (assists_min || assists_max) {
          elem.assists = {};
          if (assists_min) elem.assists.$gte = parseInt(assists_min);
          if (assists_max) elem.assists.$lte = parseInt(assists_max);
        }

        if (double_plays_min || double_plays_max) {
          elem.double_plays = {};
          if (double_plays_min) elem.double_plays.$gte = parseInt(double_plays_min);
          if (double_plays_max) elem.double_plays.$lte = parseInt(double_plays_max);
        }

        if (Object.keys(elem).length > (seasonYear ? 1 : 0)) {
          filterQuery.fieldingStats = { $elemMatch: elem };
        }
      }

      // === EXECUTE QUERY WITH FILTERS ===
      const [players, totalCount] = await Promise.all([User.find(filterQuery).populate('team', 'name logo location division').skip(skip).limit(parseInt(limit)),User.countDocuments(filterQuery)]);
      const formattedPlayers = players.map(player => {
        const userData = formatUserData(player, baseURL);
        const positionCode = userData.position;
        const positionDetailName = POSITION_DETAIL_MAP[positionCode] || "Unknown Position";

        // Get latest stats (keep as arrays like roster API)
        const battingStatsArray = userData.battingStats || [];
        const pitchingStatsArray = userData.pitchingStats || [];
        const fieldingStatsArray = userData.fieldingStats || [];

        // Format videos with full URLs
        const formattedVideos = userData.videos && userData.videos.length > 0
          ? userData.videos.map(video => ({
            _id: video._id,
            url: video.url.startsWith("http") ? video.url : `${baseURL}${video.url}`,
            title: video.title,
            uploadedAt: video.uploadedAt,
            fileSize: video.fileSize,
            duration: video.duration
          }))
          : [];

        return {
          ...userData,
          _id: userData._id,
          name: `${userData.firstName} ${userData.lastName}`,
          position: userData.position || "N/A",
          positionDetailName,
          team: userData.team || null,
          class: battingStatsArray[0]?.seasonYear || pitchingStatsArray[0]?.seasonYear || fieldingStatsArray[0]?.seasonYear || "N/A",
          profileImage: userData.profileImage,
          battingStats: battingStatsArray,
          pitchingStats: pitchingStatsArray,  
          fieldingStats: fieldingStatsArray,
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
    const suggestedPlayers = await User.find({role: "player", registrationStatus: "approved", isActive: true, _id: { $ne: coachId, $nin: followingList }}).populate('team', 'name logo location division').select("firstName lastName email position jerseyNumber profileImage profileCompleteness team").limit(10).sort({ profileCompleteness: -1, createdAt: -1 });
    const formattedSuggestions = suggestedPlayers.map(player => formatUserData(player, baseURL));
    // Get top players
    const topPlayers = await User.find({role: "player", registrationStatus: "approved", isActive: true, _id: { $ne: coachId, $nin: followingList }}).populate('team', 'name logo location division').select("firstName lastName email position jerseyNumber profileImage profileCompleteness team").sort({ profileCompleteness: -1 }).limit(10);
    const formattedTopPlayers = topPlayers.map(player => formatUserData(player, baseURL));

    // Combine all data
    const coachData = formatUserData(coach, baseURL);
    res.json({
      message: "Coach dashboard retrieved successfully",
      coach: {
        ...coachData,
        followersCount,
        followingCount
      },
      suggestions: formattedSuggestions,
      topPlayers: formattedTopPlayers,
      followedPlayers: followedPlayersData.players,
      pagination: followedPlayersData.pagination
    });
  } catch (error) {
    console.error("Coach Dashboard Error:", error);
    res.status(500).json({ message: error.message });
  }
};

// GET SUGGESTED PROFILES (Standalone)
export const getSuggestedProfiles = async (req, res) => {
  try {
    const coachId = req.user.id;
    const { limit = 10 } = req.query;

    // Get users that coach is already following
    const alreadyFollowing = await Follow.find({ follower: coachId }).distinct('following');

    // Get suggested players
    const suggestedPlayers = await User.find({
      role: "player",
      registrationStatus: "approved",
      isActive: true,
      _id: { $ne: coachId, $nin: alreadyFollowing }
    })
      .select("firstName lastName email teamName position jerseyNumber profileImage profileCompleteness")
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
    const coachId = req.user.id;
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    // Check if user exists
    const userToFollow = await User.findById(userId);
    if (!userToFollow) {
      return res.status(400).json({ message: "User not found" });
    }

    // Prevent self-following
    if (coachId === userId) {
      return res.status(400).json({ message: "You cannot follow yourself" });
    }

    // Check if already following
    const existingFollow = await Follow.findOne({
      follower: coachId,
      following: userId
    });

    if (existingFollow) {
      return res.status(400).json({ message: "Already following this user" });
    }

    // Create follow relationship
    await Follow.create({
      follower: coachId,
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
    const coachId = req.user.id;
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    // Check if following relationship exists
    const follow = await Follow.findOneAndDelete({
      follower: coachId,
      following: userId
    });

    if (!follow) {
      return res.status(400).json({ message: "Not following this user" });
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
    const coachId = req.user.id;
    const { page = 1, limit = 20 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [followingList, totalCount] = await Promise.all([
      Follow.find({ follower: coachId })
        .populate({
          path: 'following',
          select: 'firstName lastName email role teamName school position jerseyNumber profileImage profileCompleteness'
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Follow.countDocuments({ follower: coachId })
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
    const coachId = req.user.id;
    const { page = 1, limit = 20 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [followersList, totalCount] = await Promise.all([
      Follow.find({ following: coachId })
        .populate({
          path: 'follower',
          select: 'firstName lastName email role teamName school position jerseyNumber profileImage profileCompleteness'
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Follow.countDocuments({ following: coachId })
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
    const coachId = req.user.id;
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const isFollowing = await Follow.exists({
      follower: coachId,
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
    const coachId = req.user.id;
    const { limit = 10 } = req.query;

    // Get users that coach is already following
    const alreadyFollowing = await Follow.find({ follower: coachId }).distinct('following');

    // Get top players
    const topPlayers = await User.find({
      role: "player",
      registrationStatus: "approved",
      isActive: true,
      _id: { $ne: coachId, $nin: alreadyFollowing }
    })
      // .select("firstName lastName email teamName position jerseyNumber profileImage profileCompleteness battingStats")
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




// FOLLOW TEAM
export const followTeam = async (req, res) => {
  try {
    const coachId = req.user.id;
    const { teamId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(teamId)) {
      return res.status(400).json({ message: "Invalid team ID" });
    }

    // Check if team exists
    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(400).json({ message: "Team not found" });
    }

    // Check if team is active
    if (!team.isActive) {
      return res.status(400).json({ message: "Cannot follow inactive team" });
    }

    // Check if already following
    const existingFollow = await FollowTeam.findOne({
      coach: coachId,
      team: teamId
    });

    if (existingFollow) {
      return res.status(400).json({ message: "Already following this team" });
    }

    // Create follow relationship
    await FollowTeam.create({
      coach: coachId,
      team: teamId
    });

    res.json({
      message: "Successfully followed team",
      followedTeam: {
        _id: team._id,
        name: team.name,
        logo: team.logo,
        division: team.division,
        region: team.region
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// UNFOLLOW TEAM
export const unfollowTeam = async (req, res) => {
  try {
    const coachId = req.user.id;
    const { teamId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(teamId)) {
      return res.status(400).json({ message: "Invalid team ID" });
    }

    // Check if following relationship exists
    const followTeam = await FollowTeam.findOneAndDelete({
      coach: coachId,
      team: teamId
    });

    if (!followTeam) {
      return res.status(400).json({ message: "Not following this team" });
    }

    res.json({
      message: "Successfully unfollowed team"
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET FOLLOWED TEAMS LIST
export const getFollowedTeams = async (req, res) => {
  try {
    const coachId = req.user.id;
    const { page = 1, limit = 20 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [followedTeams, totalCount] = await Promise.all([
      FollowTeam.find({ coach: coachId })
        .populate({
          path: 'team',
          select: 'name logo location division region rank coachName conference isActive'
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      FollowTeam.countDocuments({ coach: coachId })
    ]);

    const baseURL = `${req.protocol}://${req.get("host")}`;
    const formattedTeams = followedTeams
      .filter(ft => ft.team && ft.team.isActive)
      .map(followTeam => {
        const team = followTeam.team;
        return {
          _id: team._id,
          name: team.name,
          logo: team.logo
            ? team.logo.startsWith("http")
              ? team.logo
              : `${baseURL}${team.logo}`
            : null,

          location: team.location ? team.location : null,
          division: team.division ? team.division : null,
          region: team.region ? team.region : null,
          rank: team.rank ? team.rank : null,
          coachName: team.coachName ? team.coachName : null,
          conference: team.conference ? team.conference : null,
          home: team.home ? team.home : null,
          away: team.away ? team.away : null,
          neutral: team.neutral ? team.neutral : null,
          conference: team.conference ? team.conference : null,
          followedAt: followTeam.followedAt
        };
      });

    res.json({
      message: "Followed teams retrieved successfully",
      teams: formattedTeams,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalCount,
        limit: parseInt(limit),
        hasMore: skip + formattedTeams.length < totalCount
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// CHECK IF FOLLOWING TEAM
export const checkIfFollowingTeam = async (req, res) => {
  try {
    const coachId = req.user.id;
    const { teamId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(teamId)) {
      return res.status(400).json({ message: "Invalid team ID" });
    }

    const isFollowing = await FollowTeam.exists({
      coach: coachId,
      team: teamId
    });

    res.json({
      message: "Follow status retrieved successfully",
      isFollowing: !!isFollowing
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET TEAM FOLLOWERS COUNT (Optional - useful for showing popularity)
export const getTeamFollowersCount = async (req, res) => {
  try {
    const { teamId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(teamId)) {
      return res.status(400).json({ message: "Invalid team ID" });
    }

    const followersCount = await FollowTeam.countDocuments({ team: teamId });

    res.json({
      message: "Team followers count retrieved successfully",
      teamId,
      followersCount
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};