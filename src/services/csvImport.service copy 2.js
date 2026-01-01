import fs from 'fs';
import { parse } from 'csv-parse/sync';
import User from '../models/user.model.js';
import Team from '../models/team.model.js';

// Helper functions
const parseName = (fullName) => {
  if (!fullName) return { firstName: '', lastName: '' };
  const parts = fullName.trim().split(' ');
  const firstName = parts[0] || '';
  const lastName = parts.slice(1).join(' ') || '';
  return { firstName, lastName };
};

const cleanString = (value) => {
  return value ? value.toString().trim() : '';
};

const parseNumber = (value) => {
  if (!value) return 0;
  const num = parseFloat(value);
  return isNaN(num) ? 0 : num;
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

        // Find team by name
        const team = await Team.findOne({
          name: { $regex: new RegExp(`^${collegeName}$`, 'i') }
        });

        if (!team) {
          results.skipped++;
          results.errors.push({
            playerName: `${firstName} ${lastName}`,
            collegeName,
            reason: `Team "${collegeName}" not found in database. Please add team first.`
          });
          continue;
        }

        // Find player by name and team
        let player = await User.findOne({
          firstName: { $regex: new RegExp(`^${firstName}$`, 'i') },
          lastName: { $regex: new RegExp(`^${lastName}$`, 'i') },
          team: team._id,
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
            team: team._id, // Reference to Team
            // teamName: team.name,
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

          // Update team reference
          player.team = team._id;
          // player.teamName = team.name;

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