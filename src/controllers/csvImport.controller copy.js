import { importPlayersFromCSV } from "../services/csvImport.service.js";
import path from "path";
import fs from "fs";

// Import CSV from file system
export const importCSV = async (req, res) => {
  try {
    const csvPath = path.join(process.cwd(), 'data', 'AZ_Western.csv');
    
    if (!fs.existsSync(csvPath)) {
      return res.status(404).json({ 
        message: "CSV file not found at: data/AZ_Western.csv" 
      });
    }

    const results = await importPlayersFromCSV(csvPath);
    // console.log('HELLO')
    res.json({
      message: "CSV import completed",
      results
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
    // console.log("JHSJJSJSJ")
    res.json({
      message: "CSV import completed",
      results
    });
  } catch (error) {
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

    const player = await User.findById(playerId).select('-password');
    
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
        teamName: player.teamName,
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
        batting: season 
          ? player.battingStats.filter(s => s.seasonYear === season)
          : player.battingStats,
        fielding: season
          ? player.fieldingStats.filter(s => s.seasonYear === season)
          : player.fieldingStats,
        pitching: season
          ? player.pitchingStats.filter(s => s.seasonYear === season)
          : player.pitchingStats,
      }
    };

    res.json(response);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};