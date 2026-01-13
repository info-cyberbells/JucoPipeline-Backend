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

// Helper to format "time ago"
const getTimeAgo = (date) => {
  const now = new Date();
  const updatedDate = new Date(date);
  const diffMs = now - updatedDate;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "1 day ago";
  if (diffDays < 30) return `${diffDays} days ago`;
  if (diffDays < 60) return "1 month ago";
  
  const diffMonths = Math.floor(diffDays / 30);
  return `${diffMonths} months ago`;
};

// GET STATISTICS
export const getCoachStatistics = async (req, res) => {
  try {
    const coachId = req.user.id;
    const {
      page = 1,
      limit = 10,
      tab = "statistics", // "statistics" or "date_range"
      statsType = "pitching", // batting, pitching, fielding
      position,
      sortBy = "era",
      sortOrder = "asc",
      search,
      
      // Date filters (for DATE RANGE tab)
      date, // Single date from calendar
      start_date,
      end_date,
      
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
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get list of players coach is following
    const followingList = await Follow.find({ follower: coachId }).distinct('following');

    if (followingList.length === 0) {
      return res.json({
        message: "No followed players found",
        players: [],
        pagination: {
          currentPage: parseInt(page),
          totalPages: 0,
          totalCount: 0,
          limit: parseInt(limit),
          hasMore: false
        }
      });
    }

    // === BUILD FILTER QUERY ===
    const filterQuery = {
      _id: { $in: followingList },
      role: "player",
      registrationStatus: "approved",
      isActive: true
    };

    // === POSITION FILTER ===
    if (position && position !== "all") {
      filterQuery.position = { $regex: new RegExp(`^${position}$`, 'i') };
    }

    // === SEARCH FILTER ===
    if (search) {
      filterQuery.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } }
      ];
    }

    // === DATE FILTERS (FOR DATE RANGE TAB) ===
    if (tab === "date_range") {
      // Single date from calendar
      if (date) {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);
        
        filterQuery.updatedAt = {
          $gte: startOfDay,
          $lte: endOfDay
        };
      }
      // Date range
      else if (start_date && end_date) {
        filterQuery.updatedAt = {
          $gte: new Date(start_date),
          $lte: new Date(end_date)
        };
      }
      // Only start_date
      else if (start_date) {
        filterQuery.updatedAt = { $gte: new Date(start_date) };
      }
      // Only end_date
      else if (end_date) {
        filterQuery.updatedAt = { $lte: new Date(end_date) };
      }
    }

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

    // === EXECUTE QUERY ===
    const [players, totalCount] = await Promise.all([
      User.find(filterQuery)
        .populate('team', 'name logo location division')
        .select("firstName lastName email position jerseyNumber profileImage battingStats pitchingStats fieldingStats videos team updatedAt academic_info_gpa")
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments(filterQuery)
    ]);

    // === FORMAT PLAYERS ===
    const formattedPlayers = players.map(player => {
      const userData = formatUserData(player, baseURL);

      // Get latest stats
      const latestBattingStats = userData.battingStats?.[0] || {};
      const latestPitchingStats = userData.pitchingStats?.[0] || {};
      const latestFieldingStats = userData.fieldingStats?.[0] || {};

      // Calculate WHIP for pitching (Walks + Hits) / Innings Pitched
      let whip = 0;
      if (statsType === "pitching" && latestPitchingStats.innings_pitched > 0) {
        whip = ((latestPitchingStats.walks_allowed + latestPitchingStats.hits_allowed) / latestPitchingStats.innings_pitched).toFixed(2);
      }

      return {
        _id: userData._id,
        name: `${userData.firstName} ${userData.lastName}`,
        position: userData.position || "N/A",
        previousSchool: userData.previousSchool || "-",
        newSchool: userData.team?.name || "-",
        teamLogo: userData.team?.logo || null,
        academic_info_gpa: userData.academic_info_gpa || 3.8,
        region: userData.team?.location || "N/A",
        lastUpdate: getTimeAgo(userData.updatedAt),
        profileImage: userData.profileImage,
        videoCount: userData.videos?.length || 0,
        
        // Stats based on statsType
        stats: statsType === "batting" ? {
          batting_average: latestBattingStats.batting_average || 0,
          on_base_percentage: latestBattingStats.on_base_percentage || 0,
          slugging_percentage: latestBattingStats.slugging_percentage || 0,
          home_runs: latestBattingStats.home_runs || 0,
          rbi: latestBattingStats.rbi || 0,
          hits: latestBattingStats.hits || 0,
          runs: latestBattingStats.runs || 0
        } : statsType === "pitching" ? {
          era: latestPitchingStats.era || 0,
          wins: latestPitchingStats.wins || 0,
          losses: latestPitchingStats.losses || 0,
          whip: whip,
          strikeouts_pitched: latestPitchingStats.strikeouts_pitched || 0,
          innings_pitched: latestPitchingStats.innings_pitched || 0
        } : {
          fielding_percentage: latestFieldingStats.fielding_percentage || 0,
          putouts: latestFieldingStats.putouts || 0,
          assists: latestFieldingStats.assists || 0,
          errors: latestFieldingStats.errors || 0,
          double_plays: latestFieldingStats.double_plays || 0
        },
        
        isFollowing: true // Always true since we're showing followed players
      };
    });

    res.json({
      message: "Statistics retrieved successfully",
      tab,
      statsType,
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
    console.error("Get Statistics Error:", error);
    res.status(500).json({ message: error.message });
  }
};