import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import User from "../models/user.model.js";

// Helper function to parse number safely
const parseNumber = (value) => {
  if (value === null || value === undefined || value === '' || value === 'null') {
    return null;
  }
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
};

// Helper function to clean string
const cleanString = (value) => {
  if (value === null || value === undefined || value === 'null' || value === '') {
    return null;
  }
  return value.toString().trim();
};

// Parse player name into firstName and lastName
const parseName = (fullName) => {
  if (!fullName) return { firstName: '', lastName: '' };
  
  const nameParts = fullName.trim().split(' ');
  if (nameParts.length === 1) {
    return { firstName: nameParts[0], lastName: '' };
  }
  
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(' ');
  return { firstName, lastName };
};
// Skip Player No into database
export const importPlayersFromCSVOLD = async (csvFilePath) => {
  try {
    // Read CSV file
    const fileContent = fs.readFileSync(csvFilePath, { encoding: 'utf-8' });
    
    // Parse CSV
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    const results = {
      total: records.length,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: []
    };

    for (const record of records) {
      try {
        const { firstName, lastName } = parseName(record['Player Name']);
        const collegeName = cleanString(record['College Name']);
        const seasonYear = cleanString(record['Season Year']);

        if (!firstName || !collegeName) {
          results.skipped++;
          continue;
        }

        // Find player by name and team (college)
        let player = await User.findOne({
          firstName: { $regex: new RegExp(`^${firstName}$`, 'i') },
          lastName: { $regex: new RegExp(`^${lastName}$`, 'i') },
          teamName: { $regex: new RegExp(`^${collegeName}$`, 'i') },
          role: 'player'
        });

        // Prepare player data
        const playerData = {
          jerseyNumber: cleanString(record['Jersey Number']),
          position: cleanString(record['Position']),
          height: cleanString(record['Height']),
          weight: cleanString(record['Weight']),
          batsThrows: cleanString(record['Bats/Throws']),
          hometown: cleanString(record['Player Hometown']),
          highSchool: cleanString(record['High School']),
          previousSchool: cleanString(record['Previous School']),
        };

        // Only update profileImage if it exists and is not already set
        const profileImageUrl = cleanString(record['Profile Image']);
        if (profileImageUrl && (!player || !player.profileImage)) {
          playerData.profileImage = profileImageUrl;
        }

        // Batting Statistics
        const battingStats = {
          seasonYear,
          games_played: parseNumber(record['games_played']),
          games_started: parseNumber(record['games_started']),
          at_bats: parseNumber(record['at_bats']),
          runs: parseNumber(record['runs']),
          hits: parseNumber(record['hits']),
          doubles: parseNumber(record['doubles']),
          triples: parseNumber(record['triples']),
          home_runs: parseNumber(record['home_runs']),
          rbi: parseNumber(record['rbi']),
          total_bases: parseNumber(record['total_bases']),
          walks: parseNumber(record['walks']),
          hit_by_pitch: parseNumber(record['hit_by_pitch']),
          strikeouts: parseNumber(record['strikeouts']),
          grounded_into_double_play: parseNumber(record['grounded_into_double_play']),
          stolen_bases: parseNumber(record['stolen_bases']),
          caught_stealing: parseNumber(record['caught_stealing']),
          batting_average: parseNumber(record['batting_average']),
          on_base_percentage: parseNumber(record['on_base_percentage']),
          slugging_percentage: parseNumber(record['slugging_percentage']),
          sacrifice_flies: parseNumber(record['sacrifice_flies']),
          sacrifice_hits: parseNumber(record['sacrifice_hits']),
        };

        // Fielding Statistics
        const fieldingStats = {
          seasonYear,
          putouts: parseNumber(record['putouts']),
          assists: parseNumber(record['assists']),
          errors: parseNumber(record['errors']),
          fielding_percentage: parseNumber(record['fielding_percentage']),
          double_plays: parseNumber(record['double_plays']),
          total_chances: parseNumber(record['total_chances']),
          stolen_bases_against: parseNumber(record['stolen_bases_against']),
          runners_caught_stealing: parseNumber(record['runners_caught_stealing']),
          runners_caught_stealing_percentage: parseNumber(record['runners_caught_stealing_percentage']),
          passed_balls: parseNumber(record['passed_balls']),
          catcher_interference: parseNumber(record['catcher_interference']),
        };

        // Pitching Statistics
        const pitchingStats = {
          seasonYear,
          wins: parseNumber(record['wins']),
          losses: parseNumber(record['losses']),
          era: parseNumber(record['era']),
          games_pitched: parseNumber(record['games_pitched']),
          complete_games: parseNumber(record['complete_games']),
          shutouts: parseNumber(record['shutouts']),
          saves: parseNumber(record['saves']),
          innings_pitched: parseNumber(record['innings_pitched']),
          hits_allowed: parseNumber(record['hits_allowed']),
          runs_allowed: parseNumber(record['runs_allowed']),
          earned_runs: parseNumber(record['earned_runs']),
          walks_allowed: parseNumber(record['walks_allowed']),
          strikeouts_pitched: parseNumber(record['strikeouts_pitched']),
          doubles_allowed: parseNumber(record['doubles_allowed']),
          triples_allowed: parseNumber(record['triples_allowed']),
          home_runs_allowed: parseNumber(record['home_runs_allowed']),
          at_bats_against: parseNumber(record['at_bats_against']),
          batting_average_against: parseNumber(record['batting_average_against']),
          wild_pitches: parseNumber(record['wild_pitches']),
          hit_batters: parseNumber(record['hit_batters']),
          balks: parseNumber(record['balks']),
          sacrifice_flies_allowed: parseNumber(record['sacrifice_flies_allowed']),
          sacrifice_hits_allowed: parseNumber(record['sacrifice_hits_allowed']),
        };

        if (player) {
          // Update existing player
          Object.assign(player, playerData);

          // Remove existing stats for this season
          player.battingStats = player.battingStats.filter(s => s.seasonYear !== seasonYear);
          player.fieldingStats = player.fieldingStats.filter(s => s.seasonYear !== seasonYear);
          player.pitchingStats = player.pitchingStats.filter(s => s.seasonYear !== seasonYear);

          // Add new stats
          player.battingStats.push(battingStats);
          player.fieldingStats.push(fieldingStats);
          player.pitchingStats.push(pitchingStats);

          player.csvImported = true;
          player.lastCsvImport = new Date();

          await player.save();
          results.updated++;
        } else {
          // Player not found - skip or log
          results.skipped++;
          results.errors.push({
            playerName: `${firstName} ${lastName}`,
            collegeName,
            reason: 'Player not found in database'
          });
        }
      } catch (error) {
        results.errors.push({
          playerName: record['Player Name'],
          error: error.message
        });
      }
    }

    return results;
  } catch (error) {
    throw new Error(`CSV Import failed: ${error.message}`);
  }
};


// Modify function to skip players that already into tables
export const importPlayersFromCSVSDSDDSSS = async (csvFilePath) => {
  try {
    // Read CSV file
    const fileContent = fs.readFileSync(csvFilePath, { encoding: 'utf-8' });
    
    // Parse CSV
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    const results = {
      total: records.length,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: []
    };

    for (const record of records) {
      try {
        const { firstName, lastName } = parseName(record['Player Name']);
        const collegeName = cleanString(record['College Name']);
        const seasonYear = cleanString(record['Season Year']);

        if (!firstName || !collegeName) {
          results.skipped++;
          results.errors.push({
            playerName: record['Player Name'],
            collegeName,
            reason: 'Missing required fields (name or college)'
          });
          continue;
        }

        // Find player by name and team (college)
        let player = await User.findOne({
          firstName: { $regex: new RegExp(`^${firstName}$`, 'i') },
          lastName: { $regex: new RegExp(`^${lastName}$`, 'i') },
          teamName: { $regex: new RegExp(`^${collegeName}$`, 'i') },
          role: 'player'
        });

        // Prepare player data
        const playerData = {
          jerseyNumber: cleanString(record['Jersey Number']),
          position: cleanString(record['Position']),
          height: cleanString(record['Height']),
          weight: cleanString(record['Weight']),
          batsThrows: cleanString(record['Bats/Throws']),
          hometown: cleanString(record['Player Hometown']),
          highSchool: cleanString(record['High School']),
          previousSchool: cleanString(record['Previous School']),
        };

        // Only update profileImage if it exists and is not already set
        const profileImageUrl = cleanString(record['Profile Image']);
        if (profileImageUrl && (!player || !player.profileImage)) {
          playerData.profileImage = profileImageUrl;
        }

        // Batting Statistics
        const battingStats = {
          seasonYear,
          games_played: parseNumber(record['games_played']),
          games_started: parseNumber(record['games_started']),
          at_bats: parseNumber(record['at_bats']),
          runs: parseNumber(record['runs']),
          hits: parseNumber(record['hits']),
          doubles: parseNumber(record['doubles']),
          triples: parseNumber(record['triples']),
          home_runs: parseNumber(record['home_runs']),
          rbi: parseNumber(record['rbi']),
          total_bases: parseNumber(record['total_bases']),
          walks: parseNumber(record['walks']),
          hit_by_pitch: parseNumber(record['hit_by_pitch']),
          strikeouts: parseNumber(record['strikeouts']),
          grounded_into_double_play: parseNumber(record['grounded_into_double_play']),
          stolen_bases: parseNumber(record['stolen_bases']),
          caught_stealing: parseNumber(record['caught_stealing']),
          batting_average: parseNumber(record['batting_average']),
          on_base_percentage: parseNumber(record['on_base_percentage']),
          slugging_percentage: parseNumber(record['slugging_percentage']),
          sacrifice_flies: parseNumber(record['sacrifice_flies']),
          sacrifice_hits: parseNumber(record['sacrifice_hits']),
        };

        // Fielding Statistics
        const fieldingStats = {
          seasonYear,
          putouts: parseNumber(record['putouts']),
          assists: parseNumber(record['assists']),
          errors: parseNumber(record['errors']),
          fielding_percentage: parseNumber(record['fielding_percentage']),
          double_plays: parseNumber(record['double_plays']),
          total_chances: parseNumber(record['total_chances']),
          stolen_bases_against: parseNumber(record['stolen_bases_against']),
          runners_caught_stealing: parseNumber(record['runners_caught_stealing']),
          runners_caught_stealing_percentage: parseNumber(record['runners_caught_stealing_percentage']),
          passed_balls: parseNumber(record['passed_balls']),
          catcher_interference: parseNumber(record['catcher_interference']),
        };

        // Pitching Statistics
        const pitchingStats = {
          seasonYear,
          wins: parseNumber(record['wins']),
          losses: parseNumber(record['losses']),
          era: parseNumber(record['era']),
          games_pitched: parseNumber(record['games_pitched']),
          complete_games: parseNumber(record['complete_games']),
          shutouts: parseNumber(record['shutouts']),
          saves: parseNumber(record['saves']),
          innings_pitched: parseNumber(record['innings_pitched']),
          hits_allowed: parseNumber(record['hits_allowed']),
          runs_allowed: parseNumber(record['runs_allowed']),
          earned_runs: parseNumber(record['earned_runs']),
          walks_allowed: parseNumber(record['walks_allowed']),
          strikeouts_pitched: parseNumber(record['strikeouts_pitched']),
          doubles_allowed: parseNumber(record['doubles_allowed']),
          triples_allowed: parseNumber(record['triples_allowed']),
          home_runs_allowed: parseNumber(record['home_runs_allowed']),
          at_bats_against: parseNumber(record['at_bats_against']),
          batting_average_against: parseNumber(record['batting_average_against']),
          wild_pitches: parseNumber(record['wild_pitches']),
          hit_batters: parseNumber(record['hit_batters']),
          balks: parseNumber(record['balks']),
          sacrifice_flies_allowed: parseNumber(record['sacrifice_flies_allowed']),
          sacrifice_hits_allowed: parseNumber(record['sacrifice_hits_allowed']),
        };

        if (!player) {
          // Create new player
          player = await User.create({
            firstName,
            lastName,
            email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${collegeName.toLowerCase().replace(/\s+/g, '')}.temp`, // Temporary email
            role: 'player',
            teamName: collegeName,
            registrationStatus: 'pending',
            isActive: true,
            ...playerData,
            battingStats: [battingStats],
            fieldingStats: [fieldingStats],
            pitchingStats: [pitchingStats],
            csvImported: true,
            lastCsvImport: new Date()
          });
          
          results.created++;
        } else {
          // Check if player already has stats for this season
          const hasExistingStats = 
            player.battingStats?.some(s => s.seasonYear === seasonYear) ||
            player.fieldingStats?.some(s => s.seasonYear === seasonYear) ||
            player.pitchingStats?.some(s => s.seasonYear === seasonYear);

          if (hasExistingStats) {
            // Player already has stats for this season - skip
            results.skipped++;
            results.errors.push({
              playerName: `${firstName} ${lastName}`,
              collegeName,
              seasonYear,
              reason: `Stats already exist for season ${seasonYear}`
            });
            continue;
          }

          // Update existing player
          Object.assign(player, playerData);

          // Add new stats
          player.battingStats.push(battingStats);
          player.fieldingStats.push(fieldingStats);
          player.pitchingStats.push(pitchingStats);

          player.csvImported = true;
          player.lastCsvImport = new Date();

          await player.save();
          results.updated++;
        }

      } catch (error) {
        results.errors.push({
          playerName: record['Player Name'],
          collegeName: record['College Name'],
          error: error.message
        });
      }
    }

    return results;
  } catch (error) {
    throw new Error(`CSV Import failed: ${error.message}`);
  }
};


export const importPlayersFromCSV = async (csvFilePath) => {
  try {
    // Read CSV file
    const fileContent = fs.readFileSync(csvFilePath, { encoding: 'utf-8' });
    
    // Parse CSV
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    const results = {
      total: records.length,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: []
    };

    for (const record of records) {
      try {
        const { firstName, lastName } = parseName(record['Player Name']);
        const collegeName = cleanString(record['College Name']);
        const CollegeIcon = cleanString(record['College Icon']);
        const seasonYear = cleanString(record['Season Year']);

        if (!firstName || !collegeName) {
          results.skipped++;
          results.errors.push({
            playerName: record['Player Name'],
            collegeName,
            reason: 'Missing required fields (name or college)'
          });
          continue;
        }

        // Find player by name and team (college)
        let player = await User.findOne({
          firstName: { $regex: new RegExp(`^${firstName}$`, 'i') },
          lastName: { $regex: new RegExp(`^${lastName}$`, 'i') },
          teamName: { $regex: new RegExp(`^${collegeName}$`, 'i') },
          role: 'player'
        });

        // Prepare player data
        const playerData = {
          jerseyNumber: cleanString(record['Jersey Number']),
          position: cleanString(record['Position']),
          height: cleanString(record['Height']),
          weight: cleanString(record['Weight']),
          batsThrows: cleanString(record['Bats/Throws']),
          hometown: cleanString(record['Player Hometown']),
          highSchool: cleanString(record['High School']),
          previousSchool: cleanString(record['Previous School']),
        };

        // Handle Profile Image
        const profileImageUrl = cleanString(record['Profile Image']);
        if (profileImageUrl && (!player || !player.profileImage)) {
          playerData.profileImage = profileImageUrl;
        }

        // Handle College Icon (NEW)
        const collegeIconUrl = cleanString(record['College Icon']);
        if (collegeIconUrl) {
          playerData.collegeIcon = collegeIconUrl;
        }

        // Batting Statistics
        const battingStats = {
          seasonYear,
          games_played: parseNumber(record['games_played']),
          games_started: parseNumber(record['games_started']),
          at_bats: parseNumber(record['at_bats']),
          runs: parseNumber(record['runs']),
          hits: parseNumber(record['hits']),
          doubles: parseNumber(record['doubles']),
          triples: parseNumber(record['triples']),
          home_runs: parseNumber(record['home_runs']),
          rbi: parseNumber(record['rbi']),
          total_bases: parseNumber(record['total_bases']),
          walks: parseNumber(record['walks']),
          hit_by_pitch: parseNumber(record['hit_by_pitch']),
          strikeouts: parseNumber(record['strikeouts']),
          grounded_into_double_play: parseNumber(record['grounded_into_double_play']),
          stolen_bases: parseNumber(record['stolen_bases']),
          caught_stealing: parseNumber(record['caught_stealing']),
          batting_average: parseNumber(record['batting_average']),
          on_base_percentage: parseNumber(record['on_base_percentage']),
          slugging_percentage: parseNumber(record['slugging_percentage']),
          sacrifice_flies: parseNumber(record['sacrifice_flies']),
          sacrifice_hits: parseNumber(record['sacrifice_hits']),
        };

        // Fielding Statistics
        const fieldingStats = {
          seasonYear,
          putouts: parseNumber(record['putouts']),
          assists: parseNumber(record['assists']),
          errors: parseNumber(record['errors']),
          fielding_percentage: parseNumber(record['fielding_percentage']),
          double_plays: parseNumber(record['double_plays']),
          total_chances: parseNumber(record['total_chances']),
          stolen_bases_against: parseNumber(record['stolen_bases_against']),
          runners_caught_stealing: parseNumber(record['runners_caught_stealing']),
          runners_caught_stealing_percentage: parseNumber(record['runners_caught_stealing_percentage']),
          passed_balls: parseNumber(record['passed_balls']),
          catcher_interference: parseNumber(record['catcher_interference']),
        };

        // Pitching Statistics
        const pitchingStats = {
          seasonYear,
          wins: parseNumber(record['wins']),
          losses: parseNumber(record['losses']),
          era: parseNumber(record['era']),
          games_pitched: parseNumber(record['games_pitched']),
          complete_games: parseNumber(record['complete_games']),
          shutouts: parseNumber(record['shutouts']),
          saves: parseNumber(record['saves']),
          innings_pitched: parseNumber(record['innings_pitched']),
          hits_allowed: parseNumber(record['hits_allowed']),
          runs_allowed: parseNumber(record['runs_allowed']),
          earned_runs: parseNumber(record['earned_runs']),
          walks_allowed: parseNumber(record['walks_allowed']),
          strikeouts_pitched: parseNumber(record['strikeouts_pitched']),
          doubles_allowed: parseNumber(record['doubles_allowed']),
          triples_allowed: parseNumber(record['triples_allowed']),
          home_runs_allowed: parseNumber(record['home_runs_allowed']),
          at_bats_against: parseNumber(record['at_bats_against']),
          batting_average_against: parseNumber(record['batting_average_against']),
          wild_pitches: parseNumber(record['wild_pitches']),
          hit_batters: parseNumber(record['hit_batters']),
          balks: parseNumber(record['balks']),
          sacrifice_flies_allowed: parseNumber(record['sacrifice_flies_allowed']),
          sacrifice_hits_allowed: parseNumber(record['sacrifice_hits_allowed']),
        };

        if (!player) {
          // Create new player
          player = await User.create({
            firstName,
            lastName,
            email: null,
            role: 'player',
            teamName: collegeName,
            teamNameIcon: CollegeIcon,
            registrationStatus: 'pending',
            isActive: true,
            ...playerData,
            battingStats: [battingStats],
            fieldingStats: [fieldingStats],
            pitchingStats: [pitchingStats],
            csvImported: true,
            lastCsvImport: new Date()
          });
          
          results.created++;
        } else {
          // Check if player already has stats for this season
          const hasExistingStats = 
            player.battingStats?.some(s => s.seasonYear === seasonYear) ||
            player.fieldingStats?.some(s => s.seasonYear === seasonYear) ||
            player.pitchingStats?.some(s => s.seasonYear === seasonYear);

          if (hasExistingStats) {
            // Player already has stats for this season - skip
            results.skipped++;
            results.errors.push({
              playerName: `${firstName} ${lastName}`,
              collegeName,
              seasonYear,
              reason: `Stats already exist for season ${seasonYear}`
            });
            continue;
          }

          // Update existing player
          Object.assign(player, playerData);

          // Add new stats
          player.battingStats.push(battingStats);
          player.fieldingStats.push(fieldingStats);
          player.pitchingStats.push(pitchingStats);

          player.csvImported = true;
          player.lastCsvImport = new Date();

          await player.save();
          results.updated++;
        }

      } catch (error) {
        results.errors.push({
          playerName: record['Player Name'],
          collegeName: record['College Name'],
          error: error.message
        });
      }
    }

    return results;
  } catch (error) {
    throw new Error(`CSV Import failed: ${error.message}`);
  }
};