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

const formatPlayerData = (player, baseURL) => {
  const playerData = typeof player.toObject === "function" ? player.toObject() : player;
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

  delete playerData.password;
  return playerData;
};

// const normalizeSeasonYear = (year) => year?.split('-')[0];
const normalizeSeasonYear = (year) => {
  if (!year) return null;

  let baseYear = year.toString().split("-")[0];

  if (baseYear === "2025") {
    baseYear = "2025";
  }

  return baseYear;
};

const buildRange = (min, max, isFloat = false) => {
  if (min === undefined && max === undefined) return null;
  const range = {};
  if (min !== undefined) range.$gte = isFloat ? parseFloat(min) : parseInt(min);
  if (max !== undefined) range.$lte = isFloat ? parseFloat(max) : parseInt(max);
  return range;
};

export const getTeamRoster = async (req, res) => {
  try {
    const coachId = req.user.id;
    const { teamId } = req.params;
    const {
      page = 1,
      limit = 10,
      position,
      seasonYear,
      sortBy = "firstName",
      sortOrder = "asc",
      search,

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

      total_base_min,
      total_base_max,
      on_base_plus_slugging_min,
      on_base_plus_slugging_max,
      caught_stealing_min,
      caught_stealing_max,
      at_bats_min,
      at_bats_max,
      hit_by_min,
      hit_by_max,
      sacrifice_flie_min,
      sacrifice_flie_max,
      sacrifice_hit_min,
      sacrifice_hit_max,
      games_play_min,
      games_play_max,
      games_start_min,
      games_start_max,
      grounded_into_double_play_min,
      grounded_into_double_play_max,
      stolen_bases_against_min,
      stolen_bases_against_max,
      intentional_walk_min,
      intentional_walk_max,
      walk_percentage_min,
      walk_percentage_max,
      strikeout_percentage_min,
      strikeout_percentage_max,
      
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

      appearances_min,
      appearances_max,
      doubles_allow_min,
      doubles_allow_max,
      home_runs_allow_min,
      home_runs_allow_max,
      complete_game_min,
      complete_game_max,
      earn_run_min,
      earn_run_max,
      batting_average_against_min,
      batting_average_against_max,
      wild_pitche_min,
      wild_pitche_max,
      games_pitch_min,
      games_pitch_max,
      shutouts_min,
      shutouts_max,
      runs_allowed_min,
      runs_allowed_max,
      triples_allowed_min,
      triples_allowed_max,
      at_bats_against_min,
      at_bats_against_max,
      hit_batters_min,
      hit_batters_max,
      balks_min,
      balks_max,
      sacrifice_flies_allowed_min,
      sacrifice_flies_allowed_max,
      sacrifice_hits_allowed_min,
      sacrifice_hits_allowed_max,
      batting_average_allowed_min,
      batting_average_allowed_max,
      
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

      total_chances_min,
      total_chances_max,
      passed_ball_min,
      passed_ball_max,
      stolen_bases_allowed_min,
      stolen_bases_allowed_max,
      runners_caught_stealing_percentage_min,
      runners_caught_stealing_percentage_max,
      runners_caught_stealing_min,
      runners_caught_stealing_max,
      catcher_interference_min,
      catcher_interference_max,
      fielding_games_min,
      fielding_games_max,
      stolen_base_success_rate_min,
      stolen_base_success_rate_max,
      caught_stealing_by_catcher_min,
      caught_stealing_by_catcher_max,
      stolen_base_attempt_percentage_min,
      stolen_base_attempt_percentage_max,
      f_stolen_bases_against_min,
      f_stolen_bases_against_max,

    } = req.query;

    if (!mongoose.Types.ObjectId.isValid(teamId)) {
      return res.status(400).json({ message: "Invalid team ID" });
    }

    const baseURL = `${req.protocol}://${req.get("host")}`;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const baseYear = seasonYear ? normalizeSeasonYear(seasonYear) : null;


    const matchStage = {
      role: "player",
      team: new mongoose.Types.ObjectId(teamId),
      registrationStatus: "approved",
      isActive: true
    };

    if (position && position !== "all") {
      matchStage.position = { $regex: position, $options: "i" };
    }

    if (search) {
      matchStage.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } }
      ];
    }

    if (seasonYear && seasonYear !== "all") {
      matchStage.$and = [
        { battingStats: { $elemMatch: { seasonYear: { $regex: `^${baseYear}` } } } },
        { fieldingStats: { $elemMatch: { seasonYear: { $regex: `^${baseYear}` } } } },
        { pitchingStats: { $elemMatch: { seasonYear: { $regex: `^${baseYear}` } } } }
      ];
    }

    const pipeline = [
      { $match: matchStage },

      {
        $lookup: {
          from: "teams",
          localField: "team",
          foreignField: "_id",
          as: "team"
        }
      },

      {
        $unwind: {
          path: "$team",
          preserveNullAndEmptyArrays: true
        }
      }
    ];

    // Apply season filtering ONLY if seasonYear is provided
    if (seasonYear && seasonYear !== "all") {
      pipeline.push({
        $addFields: {
          battingStats: {
            $filter: {
              input: "$battingStats",
              as: "stat",
              cond: {
                $regexMatch: {
                  input: "$$stat.seasonYear",
                  regex: `^${baseYear}`
                }
              }
            }
          },
          fieldingStats: {
            $filter: {
              input: "$fieldingStats",
              as: "stat",
              cond: {
                $regexMatch: {
                  input: "$$stat.seasonYear",
                  regex: `^${baseYear}`
                }
              }
            }
          },
          pitchingStats: {
            $filter: {
              input: "$pitchingStats",
              as: "stat",
              cond: {
                $regexMatch: {
                  input: "$$stat.seasonYear",
                  regex: `^${baseYear}`
                }
              }
            }
          }
        }
      });
    }

    // Batting Stats Filter
    if (seasonYear && seasonYear !== "all") {
      const elem = { seasonYear: { $regex: `^${baseYear}` } };

      const avgRange = buildRange(batting_average_min, batting_average_max, true);
      if (avgRange) elem.batting_average = avgRange;

      const onBasePercentage = buildRange(on_base_percentage_min, on_base_percentage_max, true);
      if (onBasePercentage) elem.on_base_percentage = onBasePercentage;

      const sluggingPercentage = buildRange(slugging_percentage_min, slugging_percentage_max, true);
      if (sluggingPercentage) elem.slugging_percentage = sluggingPercentage;

      const rbi = buildRange(rbi_min, rbi_max, true);
      if (rbi) elem.rbi = rbi;

      const homeRuns = buildRange(home_runs_min, home_runs_max, true);
      if (homeRuns) elem.home_runs = homeRuns;

      const bHits = buildRange(hits_min, hits_max);
      if (bHits) elem.hits = bHits;

      const bRuns = buildRange(runs_min, runs_max);
      if (bRuns) elem.runs = bRuns;

      const bDoubles = buildRange(doubles_min, doubles_max);
      if (bDoubles) elem.doubles = bDoubles;

      const bTriples = buildRange(triples_min, triples_max);
      if (bTriples) elem.triples = bTriples;

      const bWalks = buildRange(walks_min, walks_max);
      if (bWalks) elem.walks = bWalks;

      const bStrikeouts = buildRange(strikeouts_min, strikeouts_max);
      if (bStrikeouts) elem.strikeouts = bStrikeouts;

      const stolenBases = buildRange(stolen_bases_min, stolen_bases_max);
      if (stolenBases) elem.stolen_bases = stolenBases;

      const totalBases = buildRange(total_base_min, total_base_max);
      if (totalBases) elem.total_bases = totalBases;

      const ops = buildRange(on_base_plus_slugging_min, on_base_plus_slugging_max, parseFloat);
      if (ops) elem.on_base_plus_slugging = ops;

      const caughtStealing = buildRange(caught_stealing_min, caught_stealing_max);
      if (caughtStealing) elem.caught_stealing = caughtStealing;

      const atBats = buildRange(at_bats_min, at_bats_max);
      if (atBats) elem.at_bats = atBats;

      const hitByPitch = buildRange(hit_by_min, hit_by_max);
      if (hitByPitch) elem.hit_by_pitch = hitByPitch;

      const sacrificeFlies = buildRange(sacrifice_flie_min, sacrifice_flie_max);
      if (sacrificeFlies) elem.sacrifice_flies = sacrificeFlies;

      const sacrificeHits = buildRange(sacrifice_hit_min, sacrifice_hit_max);
      if (sacrificeHits) elem.sacrifice_hits = sacrificeHits;

      const gamesStarted = buildRange(games_start_min, games_start_max);
      if (gamesStarted) elem.games_started = gamesStarted;

      const gamesPlayed = buildRange(games_play_min, games_play_max);
      if (gamesPlayed) elem.games_played = gamesPlayed;

      const gidp = buildRange(grounded_into_double_play_min, grounded_into_double_play_max);
      if (gidp) elem.grounded_into_double_play = gidp;

      const stolenBasesAgainst = buildRange(stolen_bases_against_min, stolen_bases_against_max);
      if (stolenBasesAgainst) elem.stolen_bases_against = stolenBasesAgainst;

      const intentionalWalks = buildRange(intentional_walk_min, intentional_walk_max);
      if (intentionalWalks) elem.intentional_walks = intentionalWalks;

      const walkPct = buildRange(walk_percentage_min, walk_percentage_max, parseFloat);
      if (walkPct) elem.walk_percentage = walkPct;

      const strikeoutPct = buildRange(strikeout_percentage_min, strikeout_percentage_max, parseFloat);
      if (strikeoutPct) elem.strikeout_percentage = strikeoutPct;


      if (Object.keys(elem).length > 1) {
        pipeline.push({
          $match: {
            battingStats: { $elemMatch: elem }
          }
        });
      }
    }

    // Pitching Stats Filter
    if (seasonYear && seasonYear !== "all") {
      const elem = { seasonYear: { $regex: `^${baseYear}` } };

      const eraRange = buildRange(era_min, era_max, true);
      if (eraRange) elem.era = eraRange;

      const pWins = buildRange(wins_min, wins_max, true);
      if (pWins) elem.wins = pWins;

      const pLosses = buildRange(losses_min, losses_max, true);
      if (pLosses) elem.losses = pLosses;

      const strikeoutsPitched = buildRange(strikeouts_pitched_min, strikeouts_pitched_max, true);
      if (strikeoutsPitched) elem.strikeouts_pitched = strikeoutsPitched;

      const inningsPitchedMin = buildRange(innings_pitched_min, innings_pitched_max, true);
      if (inningsPitchedMin) elem.innings_pitched = inningsPitchedMin;

      const walksAllowed = buildRange(walks_allowed_min, walks_allowed_max, true);
      if (walksAllowed) elem.walks_allowed = walksAllowed;

      const hitsAllowed = buildRange(hits_allowed_min, hits_allowed_max, true);
      if (hitsAllowed) elem.hits_allowed = hitsAllowed;

      const savesMin = buildRange(saves_min, saves_max, true);
      if (savesMin) elem.saves = savesMin;

      const appearances = buildRange(appearances_min, appearances_max);
      if (appearances) elem.appearances = appearances;

      const doublesAllowed = buildRange(doubles_allow_min, doubles_allow_max);
      if (doublesAllowed) elem.doubles_allowed = doublesAllowed;

      const homeRunsAllowed = buildRange(home_runs_allow_min, home_runs_allow_max);
      if (homeRunsAllowed) elem.home_runs_allowed = homeRunsAllowed;

      const completeGames = buildRange(complete_game_min, complete_game_max);
      if (completeGames) elem.complete_games = completeGames;

      const earnedRuns = buildRange(earn_run_min, earn_run_max);
      if (earnedRuns) elem.earned_runs = earnedRuns;

      const battingAvgAgainst = buildRange(
        batting_average_against_min,
        batting_average_against_max,
        parseFloat
      );
      if (battingAvgAgainst) elem.batting_average_against = battingAvgAgainst;

      const wildPitches = buildRange(wild_pitche_min, wild_pitche_max);
      if (wildPitches) elem.wild_pitches = wildPitches;

      const gamesPitched = buildRange(games_pitch_min, games_pitch_max);
      if (gamesPitched) elem.games_pitched = gamesPitched;

      const shutouts = buildRange(shutouts_min, shutouts_max);
      if (shutouts) elem.shutouts = shutouts;

      const runsAllowed = buildRange(runs_allowed_min, runs_allowed_max);
      if (runsAllowed) elem.runs_allowed = runsAllowed;

      const triplesAllowed = buildRange(triples_allowed_min, triples_allowed_max);
      if (triplesAllowed) elem.triples_allowed = triplesAllowed;

      const atBatsAgainst = buildRange(at_bats_against_min, at_bats_against_max);
      if (atBatsAgainst) elem.at_bats_against = atBatsAgainst;

      const hitBatters = buildRange(hit_batters_min, hit_batters_max);
      if (hitBatters) elem.hit_batters = hitBatters;

      const balks = buildRange(balks_min, balks_max);
      if (balks) elem.balks = balks;

      const sacrificeFliesAllowed = buildRange(
        sacrifice_flies_allowed_min,
        sacrifice_flies_allowed_max
      );
      if (sacrificeFliesAllowed) elem.sacrifice_flies_allowed = sacrificeFliesAllowed;

      const sacrificeHitsAllowed = buildRange(
        sacrifice_hits_allowed_min,
        sacrifice_hits_allowed_max
      );
      if (sacrificeHitsAllowed) elem.sacrifice_hits_allowed = sacrificeHitsAllowed;

      const battingAverageAllowed = buildRange(
        batting_average_allowed_min,
        batting_average_allowed_max,
        parseFloat
      );
      if (battingAverageAllowed) elem.batting_average_allowed = battingAverageAllowed;


      if (Object.keys(elem).length > 1) {
        pipeline.push({
          $match: {
            pitchingStats: { $elemMatch: elem }
          }
        });
      }
    }

    // Fielding Stats Filter
    if (seasonYear && seasonYear !== "all") {
      const elem = { seasonYear: { $regex: `^${baseYear}` } };

      const fpRange = buildRange(fielding_percentage_min, fielding_percentage_max, true);
      if (fpRange) elem.fielding_percentage = fpRange;

      const errRange = buildRange(errors_min, errors_max);
      if (errRange) elem.errors = errRange;

      const fPutouts = buildRange(putouts_min, putouts_min);
      if (fPutouts) elem.putouts = fPutouts;

      const fAssists = buildRange(assists_min, assists_max);
      if (fAssists) elem.assists = fAssists;

      const doublePlays = buildRange(double_plays_min, double_plays_max);
      if (doublePlays) elem.double_plays = doublePlays;

      const totalChances = buildRange(total_chances_min, total_chances_max);
      if (totalChances) elem.total_chances = totalChances;

      const passedBalls = buildRange(passed_ball_min, passed_ball_max);
      if (passedBalls) elem.passed_balls = passedBalls;

      const stolenBasesAllowed = buildRange(stolen_bases_allowed_min, stolen_bases_allowed_max);
      if (stolenBasesAllowed) elem.stolen_bases_allowed = stolenBasesAllowed;

      const rcsPct = buildRange(
        runners_caught_stealing_percentage_min,
        runners_caught_stealing_percentage_max,
        parseFloat
      );
      if (rcsPct) elem.runners_caught_stealing_percentage = rcsPct;

      const catcherInterference = buildRange(catcher_interference_min, catcher_interference_max);
      if (catcherInterference) elem.catcher_interference = catcherInterference;

      const fieldingGames = buildRange(fielding_games_min, fielding_games_max);
      if (fieldingGames) elem.fielding_games = fieldingGames;

      const sbsRate = buildRange(
        stolen_base_success_rate_min,
        stolen_base_success_rate_max,
        parseFloat
      );
      if (sbsRate) elem.stolen_base_success_rate = sbsRate;

      const caughtStealingByCatcher = buildRange(
        caught_stealing_by_catcher_min,
        caught_stealing_by_catcher_max
      );
      if (caughtStealingByCatcher) elem.caught_stealing_by_catcher = caughtStealingByCatcher;

      const stolenBasesAgainst = buildRange(
        f_stolen_bases_against_min,
        f_stolen_bases_against_max
      );
      if (stolenBasesAgainst) elem.stolen_bases_against = stolenBasesAgainst;

      const sbaPct = buildRange(
        stolen_base_attempt_percentage_min,
        stolen_base_attempt_percentage_max,
        parseFloat
      );
      if (sbaPct) elem.stolen_base_attempt_percentage = sbaPct;

      const runnersCaughtStealing = buildRange(
        runners_caught_stealing_min,
        runners_caught_stealing_max
      );
      if (runnersCaughtStealing) elem.runners_caught_stealing = runnersCaughtStealing;


      if (Object.keys(elem).length > 1) {
        pipeline.push({
          $match: {
            fieldingStats: { $elemMatch: elem }
          }
        });
      }
    }


    // pagination & sorting remain unchanged
    pipeline.push(
      { $sort: { [sortBy]: sortOrder === "asc" ? 1 : -1 } },
      { $skip: skip },
      { $limit: parseInt(limit) }
    );

    const [players, totalCount] = await Promise.all([
      User.aggregate(pipeline),
      User.countDocuments(matchStage)
    ]);

    // Get followed players
    const playerIds = players.map(p => p._id);
    const followedPlayers = await Follow.find({
      follower: coachId,
      following: { $in: playerIds }
    }).distinct("following");

    const followedSet = new Set(followedPlayers.map(id => id.toString()));

    // Format players with team data
    const formattedPlayers = players.map(player => {
      const playerData = formatPlayerData(player, baseURL);
      return {
        ...playerData,
        playerClass: player.playerClass ?? null,
        playerScore: player.playerScore ?? null,
        jpRank: player.jpRank ?? null,
        conferenceStrengthScore: player.conferenceStrengthScore ?? null,
        velo: player.velo ?? null,
        whip: player.whip ?? null,
        era: player.era ?? null,
        battingAverage: player.battingAverage ?? null,
        homeRuns: player.homeRuns ?? null,
        rbi: player.rbi ?? null,
        isFollowing: followedSet.has(player._id.toString()),
      };
    });

    // GET TEAM INFO (for response metadata)
    let teamInfo = players.length > 0 && players[0].team ? players[0].team : null;

    if (teamInfo?.logo) {
      teamInfo = {
        ...teamInfo,
        logo: `${baseURL}${teamInfo.logo}`
      };
    }

    const playersWithTeamLogo = formattedPlayers.map(player => {
      if (player.team?.logo) {
        return {
          ...player,
          team: {
            ...player.team,
            logo: `${baseURL}${player.team.logo}`
          }
        };
      }
      return player;
    });

    res.json({
      message: "Team roster retrieved successfully",
      team: teamInfo,
      players: playersWithTeamLogo,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        limit: parseInt(limit),
        hasMore: skip + formattedPlayers.length < totalCount
      }
    });

  } catch (error) {
    console.error("Error fetching team roster:", error);
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
      return res.status(400).json({ message: "Team not found" });
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
      return res.status(400).json({ message: "Team not found" });
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
      return res.status(400).json({ message: "Team not found" });
    }

    const players = await User.find({
      role: "player",
      team: teamId,
      registrationStatus: "approved",
      isActive: true
    }).select("firstName lastName battingStats pitchingStats fieldingStats");

    if (players.length === 0) {
      return res.status(400).json({ message: "No players found for this team" });
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