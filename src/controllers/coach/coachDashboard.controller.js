import User from "../../models/user.model.js";
import Follow from "../../models/follow.model.js";
import FollowTeam from "../../models/followTeam.model.js";
import Team from "../../models/team.model.js";
import VideoRequest from "../../models/videoRequest.model.js";
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
      
      position
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

      if (position && position !== "all") {
        filterQuery.position = { $regex: position, $options: "i" };
      }

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


        if (total_base_min || total_base_max) {
          elem.total_bases = {};
          if (total_base_min) elem.total_bases.$gte = parseFloat(total_base_min);
          if (total_base_max) elem.total_bases.$lte = parseFloat(total_base_max);
        }

        if (on_base_plus_slugging_min || on_base_plus_slugging_max) {
          elem.on_base_plus_slugging = {};
          if (on_base_plus_slugging_min) elem.on_base_plus_slugging.$gte = parseFloat(on_base_plus_slugging_min);
          if (on_base_plus_slugging_max) elem.on_base_plus_slugging.$lte = parseFloat(on_base_plus_slugging_max);
        }

        if (caught_stealing_min || caught_stealing_max) {
          elem.caught_stealing = {};
          if (caught_stealing_min) elem.caught_stealing.$gte = parseFloat(caught_stealing_min);
          if (caught_stealing_max) elem.caught_stealing.$lte = parseFloat(caught_stealing_max);
        }

        if (at_bats_min || at_bats_max) {
          elem.at_bats = {};
          if (at_bats_min) elem.at_bats.$gte = parseFloat(at_bats_min);
          if (at_bats_max) elem.at_bats.$lte = parseFloat(at_bats_max);
        }

        if (hit_by_min || hit_by_max) {
          elem.hit_by_pitch = {};
          if (hit_by_min) elem.hit_by_pitch.$gte = parseFloat(hit_by_min);
          if (hit_by_max) elem.hit_by_pitch.$lte = parseFloat(hit_by_max);
        }

        if (sacrifice_flie_min || sacrifice_flie_max) {
          elem.sacrifice_flies = {};
          if (sacrifice_flie_min) elem.sacrifice_flies.$gte = parseFloat(sacrifice_flie_min);
          if (sacrifice_flie_max) elem.sacrifice_flies.$lte = parseFloat(sacrifice_flie_max);
        }

        if (sacrifice_hit_min || sacrifice_hit_max) {
          elem.sacrifice_hits = {};
          if (sacrifice_hit_min) elem.sacrifice_hits.$gte = parseFloat(sacrifice_hit_min);
          if (sacrifice_hit_max) elem.sacrifice_hits.$lte = parseFloat(sacrifice_hit_max);
        }

        if (games_start_min || games_start_max) {
          elem.games_started = {};
          if (games_start_min) elem.games_started.$gte = parseFloat(games_start_min);
          if (games_start_max) elem.games_started.$lte = parseFloat(games_start_max);
        }

        if (games_play_min || games_play_max) {
          elem.games_played = {};
          if (games_play_min) elem.games_played.$gte = parseFloat(games_play_min);
          if (games_play_max) elem.games_played.$lte = parseFloat(games_play_max);
        }

        if (grounded_into_double_play_min || grounded_into_double_play_max) {
          elem.grounded_into_double_play = {};
          if (grounded_into_double_play_min) elem.grounded_into_double_play.$gte = parseFloat(grounded_into_double_play_min);
          if (grounded_into_double_play_max) elem.grounded_into_double_play.$lte = parseFloat(grounded_into_double_play_max);
        }

        if (stolen_bases_against_min || stolen_bases_against_max) {
          elem.stolen_bases_against = {};
          if (stolen_bases_against_min) elem.stolen_bases_against.$gte = parseFloat(stolen_bases_against_min);
          if (stolen_bases_against_max) elem.stolen_bases_against.$lte = parseFloat(stolen_bases_against_max);
        }

        if (intentional_walk_min || intentional_walk_max) {
          elem.intentional_walks = {};
          if (intentional_walk_min) elem.intentional_walks.$gte = parseFloat(intentional_walk_min);
          if (intentional_walk_max) elem.intentional_walks.$lte = parseFloat(intentional_walk_max);
        }

        if (walk_percentage_min || walk_percentage_max) {
          elem.walk_percentage = {};
          if (walk_percentage_min) elem.walk_percentage.$gte = parseFloat(walk_percentage_min);
          if (walk_percentage_max) elem.walk_percentage.$lte = parseFloat(walk_percentage_max);
        }

        if (strikeout_percentage_min || strikeout_percentage_max) {
          elem.strikeout_percentage = {};
          if (strikeout_percentage_min) elem.strikeout_percentage.$gte = parseFloat(strikeout_percentage_min);
          if (strikeout_percentage_max) elem.strikeout_percentage.$lte = parseFloat(strikeout_percentage_max);
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


        if (appearances_min || appearances_max) {
          elem.appearances = {};
          if (appearances_min) elem.appearances.$gte = parseInt(appearances_min);
          if (appearances_max) elem.appearances.$lte = parseInt(appearances_max);
        }


        if (doubles_allow_min || doubles_allow_max) {
          elem.doubles_allowed = {};
          if (doubles_allow_min) elem.doubles_allowed.$gte = parseInt(doubles_allow_min);
          if (doubles_allow_max) elem.doubles_allowed.$lte = parseInt(doubles_allow_max);
        }

        if (home_runs_allow_min || home_runs_allow_max) {
          elem.home_runs_allowed = {};
          if (home_runs_allow_min) elem.home_runs_allowed.$gte = parseInt(home_runs_allow_min);
          if (home_runs_allow_max) elem.home_runs_allowed.$lte = parseInt(home_runs_allow_max);
        }

        if (complete_game_min || complete_game_max) {
          elem.complete_games = {};
          if (complete_game_min) elem.complete_games.$gte = parseInt(complete_game_min);
          if (complete_game_max) elem.complete_games.$lte = parseInt(complete_game_max);
        }

        if (earn_run_min || earn_run_max) {
          elem.earned_runs = {};
          if (earn_run_min) elem.earned_runs.$gte = parseInt(earn_run_min);
          if (earn_run_max) elem.earned_runs.$lte = parseInt(earn_run_max);
        }

        if (batting_average_against_min || batting_average_against_max) {
          elem.batting_average_against = {};
          if (batting_average_against_min) elem.batting_average_against.$gte = parseInt(batting_average_against_min);
          if (batting_average_against_max) elem.batting_average_against.$lte = parseInt(batting_average_against_max);
        }

        if (wild_pitche_min || wild_pitche_max) {
          elem.wild_pitches = {};
          if (wild_pitche_min) elem.wild_pitches.$gte = parseInt(wild_pitche_min);
          if (wild_pitche_max) elem.wild_pitches.$lte = parseInt(wild_pitche_max);
        }

        if (games_pitch_min || games_pitch_max) {
          elem.games_pitched = {};
          if (games_pitch_min) elem.games_pitched.$gte = parseInt(games_pitch_min);
          if (games_pitch_max) elem.games_pitched.$lte = parseInt(games_pitch_max);
        }

        if (shutouts_min || shutouts_max) {
          elem.shutouts = {};
          if (shutouts_min) elem.shutouts.$gte = parseInt(shutouts_min);
          if (shutouts_max) elem.shutouts.$lte = parseInt(shutouts_max);
        }

        if (runs_allowed_min || runs_allowed_max) {
          elem.runs_allowed = {};
          if (runs_allowed_min) elem.runs_allowed.$gte = parseInt(runs_allowed_min);
          if (runs_allowed_max) elem.runs_allowed.$lte = parseInt(runs_allowed_max);
        }

        if (triples_allowed_min || triples_allowed_max) {
          elem.triples_allowed = {};
          if (triples_allowed_min) elem.triples_allowed.$gte = parseInt(triples_allowed_min);
          if (triples_allowed_max) elem.triples_allowed.$lte = parseInt(triples_allowed_max);
        }

        if (at_bats_against_min || at_bats_against_max) {
          elem.at_bats_against = {};
          if (at_bats_against_min) elem.at_bats_against.$gte = parseInt(at_bats_against_min);
          if (at_bats_against_max) elem.at_bats_against.$lte = parseInt(at_bats_against_max);
        }

        if (hit_batters_min || hit_batters_max) {
          elem.hit_batters = {};
          if (hit_batters_min) elem.hit_batters.$gte = parseInt(hit_batters_min);
          if (hit_batters_max) elem.hit_batters.$lte = parseInt(hit_batters_max);
        }

        if (balks_min || balks_max) {
          elem.balks = {};
          if (balks_min) elem.balks.$gte = parseInt(balks_min);
          if (balks_max) elem.balks.$lte = parseInt(balks_max);
        }

        if (sacrifice_flies_allowed_min || sacrifice_flies_allowed_max) {
          elem.sacrifice_flies_allowed = {};
          if (sacrifice_flies_allowed_min) elem.sacrifice_flies_allowed.$gte = parseInt(sacrifice_flies_allowed_min);
          if (sacrifice_flies_allowed_max) elem.sacrifice_flies_allowed.$lte = parseInt(sacrifice_flies_allowed_max);
        }

        if (sacrifice_hits_allowed_min || sacrifice_hits_allowed_max) {
          elem.sacrifice_hits_allowed = {};
          if (sacrifice_hits_allowed_min) elem.sacrifice_hits_allowed.$gte = parseInt(sacrifice_hits_allowed_min);
          if (sacrifice_hits_allowed_max) elem.sacrifice_hits_allowed.$lte = parseInt(sacrifice_hits_allowed_max);
        }

        if (batting_average_allowed_min || batting_average_allowed_max) {
          elem.batting_average_allowed = {};
          if (batting_average_allowed_min) elem.batting_average_allowed.$gte = parseInt(batting_average_allowed_min);
          if (batting_average_allowed_max) elem.batting_average_allowed.$lte = parseInt(batting_average_allowed_max);
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

        if (total_chances_min || total_chances_max) {
          elem.total_chances = {};
          if (total_chances_min) elem.total_chances.$gte = parseInt(total_chances_min);
          if (total_chances_max) elem.total_chances.$lte = parseInt(total_chances_max);
        }

        if (passed_ball_min || passed_ball_max) {
          elem.passed_balls = {};
          if (passed_ball_min) elem.passed_balls.$gte = parseInt(passed_ball_min);
          if (passed_ball_max) elem.passed_balls.$lte = parseInt(passed_ball_max);
        }

        if (stolen_bases_allowed_min || stolen_bases_allowed_max) {
          elem.stolen_bases_allowed = {};
          if (stolen_bases_allowed_min) elem.stolen_bases_allowed.$gte = parseInt(stolen_bases_allowed_min);
          if (stolen_bases_allowed_max) elem.stolen_bases_allowed.$lte = parseInt(stolen_bases_allowed_max);
        }

        if (runners_caught_stealing_percentage_min || runners_caught_stealing_percentage_max) {
          elem.runners_caught_stealing_percentage = {};
          if (runners_caught_stealing_percentage_min) elem.runners_caught_stealing_percentage.$gte = parseInt(runners_caught_stealing_percentage_min);
          if (runners_caught_stealing_percentage_max) elem.runners_caught_stealing_percentage.$lte = parseInt(runners_caught_stealing_percentage_max);
        }

        if (catcher_interference_min || catcher_interference_max) {
          elem.catcher_interference = {};
          if (catcher_interference_min) elem.catcher_interference.$gte = parseInt(catcher_interference_min);
          if (catcher_interference_max) elem.catcher_interference.$lte = parseInt(catcher_interference_max);
        }


        if (fielding_games_min || fielding_games_max) {
          elem.fielding_games = {};
          if (fielding_games_min) elem.fielding_games.$gte = parseInt(fielding_games_min);
          if (fielding_games_max) elem.fielding_games.$lte = parseInt(fielding_games_max);
        }


        if (stolen_base_success_rate_min || stolen_base_success_rate_max) {
          elem.stolen_base_success_rate = {};
          if (stolen_base_success_rate_min) elem.stolen_base_success_rate.$gte = parseInt(stolen_base_success_rate_min);
          if (stolen_base_success_rate_max) elem.stolen_base_success_rate.$lte = parseInt(stolen_base_success_rate_max);
        }


        if (caught_stealing_by_catcher_min || caught_stealing_by_catcher_max) {
          elem.caught_stealing_by_catcher = {};
          if (caught_stealing_by_catcher_min) elem.caught_stealing_by_catcher.$gte = parseInt(caught_stealing_by_catcher_min);
          if (caught_stealing_by_catcher_max) elem.caught_stealing_by_catcher.$lte = parseInt(caught_stealing_by_catcher_max);
        }

        if (f_stolen_bases_against_min || f_stolen_bases_against_max) {
          elem.stolen_bases_against = {};
          if (f_stolen_bases_against_min) elem.stolen_bases_against.$gte = parseInt(f_stolen_bases_against_min);
          if (f_stolen_bases_against_max) elem.stolen_bases_against.$lte = parseInt(f_stolen_bases_against_max);
        }

        if (stolen_base_attempt_percentage_min || stolen_base_attempt_percentage_max) {
          elem.stolen_base_attempt_percentage = {};
          if (stolen_base_attempt_percentage_min) elem.stolen_base_attempt_percentage.$gte = parseInt(stolen_base_attempt_percentage_min);
          if (stolen_base_attempt_percentage_max) elem.stolen_base_attempt_percentage.$lte = parseInt(stolen_base_attempt_percentage_max);
        }

        
        if (runners_caught_stealing_min || runners_caught_stealing_max) {
          elem.runners_caught_stealing = {};
          if (runners_caught_stealing_min) elem.runners_caught_stealing.$gte = parseInt(runners_caught_stealing_min);
          if (runners_caught_stealing_max) elem.runners_caught_stealing.$lte = parseInt(runners_caught_stealing_max);
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

        // const battingStatsArray = (userData.battingStats || []).filter(
        //   stat => stat.seasonYear === seasonYear
        // );

        // const pitchingStatsArray = (userData.pitchingStats || []).filter(
        //   stat => stat.seasonYear === seasonYear
        // );

        // const fieldingStatsArray = (userData.fieldingStats || []).filter(
        //   stat => stat.seasonYear === seasonYear
        // );


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


export const requestMoreVideo = async (req, res) => {
  try {
    const coachId = req.user.id;
    const { playerId, note } = req.body;

    // Validate coach
    const coach = await User.findById(coachId);
    if (!coach || coach.role !== "coach") {
      return res.status(403).json({ message: "Only coaches can request videos" });
    }

    // Validate player
    const player = await User.findById(playerId);
    if (!player || player.role !== "player") {
      return res.status(404).json({ message: "Player not found" });
    }

    // Prevent duplicate pending request
    const existing = await VideoRequest.findOne({
      player: playerId,
      requestedBy: coachId,
      status: "pending"
    });

    if (existing) {
      return res.status(400).json({
        message: "You already have a pending request for this player"
      });
    }

    // Create request
    const request = await VideoRequest.create({
      player: playerId,
      requestedBy: coachId,
      note
    });

    res.status(201).json({
      message: "Video request sent to admin successfully",
      request
    });

  } catch (error) {
    console.error("Request More Video Error:", error);
    res.status(500).json({ message: error.message });
  }
};


export const getVideoRequestsByPlayer = async (req, res) => {
  try {
    const { playerId } = req.params;
    // Role check (Coach only for now)
    if (req.user.role !== "coach") {
      return res.status(403).json({ message: "Coach access required" });
    }
    const BASE_URL = `${req.protocol}://${req.get("host")}`;

    const requests = await VideoRequest.find({ player: playerId }).sort({ createdAt: -1 }).limit(1);
    if (!requests.length) {
      return res.status(404).json({
        message: "No video requests found for this player",
        requests: []
      });
    }

    res.json({
      message: "Player video requests retrieved successfully",
      requests: requests
    });

  } catch (error) {
    console.error("Get Video Requests By Player Error:", error);
    res.status(500).json({ message: error.message });
  }
};
