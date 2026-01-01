import { importPlayersFromCSV } from "../services/csvImport.service.js";
import path from "path";
import fs from "fs";

// Import CSV from file system
export const importCSV = async (req, res) => {
  try {
    const csvPath = path.join(process.cwd(), 'data', 'Central_AZ.csv');
    
    if (!fs.existsSync(csvPath)) {
      return res.status(404).json({ 
        message: "CSV file not found at: data/Central_AZ.csv" 
      });
    }

    const results = await importPlayersFromCSV(csvPath);
    
    res.json({
      message: "CSV import completed successfully",
      summary: {
        totalRecords: results.total,
        playersCreated: results.created,
        playersUpdated: results.updated,
        teamsCreated: results.teamsCreated,
        recordsSkipped: results.skipped,
        errors: results.errors.length
      },
      details: results
    });
  } catch (error) {
    res.status(500).json({ 
      message: "CSV import failed",
      error: error.message 
    });
  }
};

// Upload and import CSV
export const uploadAndImportCSV = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No CSV file uploaded" });
    }

    const results = await importPlayersFromCSV(req.file.path);

    // Delete uploaded file after processing
    fs.unlinkSync(req.file.path);
    
    res.json({
      message: "CSV import completed successfully",
      summary: {
        totalRecords: results.total,
        playersCreated: results.created,
        playersUpdated: results.updated,
        teamsCreated: results.teamsCreated,
        recordsSkipped: results.skipped,
        errors: results.errors.length
      },
      details: results
    });
  } catch (error) {
    // Clean up file if error occurs
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ 
      message: "CSV import failed",
      error: error.message 
    });
  }
};

// Get player stats
export const getPlayerStats = async (req, res) => {
  try {
    const { playerId } = req.params;
    const { season } = req.query;

    const player = await User.findById(playerId).select('-password').populate('team', 'name logo location division');
    if (!player || player.role !== 'player') {
      return res.status(404).json({ message: "Player not found" });
    }

    let response = {
      player: {
        _id: player._id,
        firstName: player.firstName,
        lastName: player.lastName,
        fullName: player.getFullName(),
        email: player.email,
        team: player.team,
        jerseyNumber: player.jerseyNumber,
        position: player.position,
        height: player.height,
        weight: player.weight,
        batsThrows: player.batsThrows,
        hometown: player.hometown,
        highSchool: player.highSchool,
        previousSchool: player.previousSchool,
        profileImage: player.profileImage,
      },
      stats: {
        batting: season ? player.battingStats.filter(s => s.seasonYear === season) : player.battingStats,
        fielding: season ? player.fieldingStats.filter(s => s.seasonYear === season) : player.fieldingStats,
        pitching: season ? player.pitchingStats.filter(s => s.seasonYear === season) : player.pitchingStats,
      }
    };

    res.json(response);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};