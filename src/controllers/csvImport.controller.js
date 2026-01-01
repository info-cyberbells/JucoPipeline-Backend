import { importPlayersFromCSV } from "../services/csvImport.service.js";
import ImportLog from "../models/importLog.model.js";
import path from "path";
import fs from "fs";

// Import from file system
export const importCSV = async (req, res) => {
  const startTime = Date.now();
  
  try {
    const dataDir = path.join(process.cwd(), 'data');
    
    if (!fs.existsSync(dataDir)) {
      return res.status(404).json({ 
        message: "Data directory not found. Please create 'data' folder in project root." 
      });
    }

    const files = fs.readdirSync(dataDir).filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ext === '.csv' || ext === '.xlsx' || ext === '.xls';
    });
    
    if (files.length === 0) {
      return res.status(404).json({ 
        message: "No CSV or XLSX files found in data directory" 
      });
    }

    console.log(`📂 Found ${files.length} file(s) to import`);
    
    const allResults = {
      filesProcessed: files.length,
      totalRecords: 0,
      playersCreated: 0,
      playersUpdated: 0,
      teamsCreated: 0,
      recordsSkipped: 0,
      totalErrors: 0,
      fileResults: []
    };

    for (const file of files) {
      const filePath = path.join(dataDir, file);
      const fileExt = path.extname(file).toLowerCase();
      console.log(`\n📄 Processing ${fileExt.toUpperCase()} file: ${file}...`);
      
      try {
        const results = await importPlayersFromCSV(filePath);
        
        allResults.totalRecords += results.total;
        allResults.playersCreated += results.created;
        allResults.playersUpdated += results.updated;
        allResults.teamsCreated += results.teamsCreated;
        allResults.recordsSkipped += results.skipped;
        allResults.totalErrors += results.errors.length;
        
        allResults.fileResults.push({
          fileName: file,
          fileType: fileExt,
          status: 'success',
          totalRecords: results.total,
          playersCreated: results.created,
          playersUpdated: results.updated,
          teamsCreated: results.teamsCreated,
          recordsSkipped: results.skipped,
          errors: results.errors
        });
        
        console.log(`✅ ${file} - Created: ${results.created}, Updated: ${results.updated}`);
        
      } catch (error) {
        console.error(`❌ ${file} - Error: ${error.message}`);
        
        allResults.totalErrors++;
        allResults.fileResults.push({
          fileName: file,
          fileType: fileExt,
          status: 'failed',
          totalRecords: 0,
          playersCreated: 0,
          playersUpdated: 0,
          teamsCreated: 0,
          recordsSkipped: 0,
          errors: [{ error: error.message }]
        });
      }
    }

    const duration = Date.now() - startTime;
    const overallStatus = allResults.totalErrors > 0 
      ? (allResults.playersCreated > 0 || allResults.playersUpdated > 0 ? 'partial' : 'failed')
      : 'completed';

    const message = `Import completed. Processed ${files.length} file(s)`;

    // 💾 SAVE IMPORT LOG TO DATABASE
    const importLog = await ImportLog.create({
      importType: 'directory',
      importedBy: req.user?._id || null, // If you have auth, pass user ID
      summary: {
        filesProcessed: allResults.filesProcessed,
        totalRecords: allResults.totalRecords,
        playersCreated: allResults.playersCreated,
        playersUpdated: allResults.playersUpdated,
        teamsCreated: allResults.teamsCreated,
        recordsSkipped: allResults.recordsSkipped,
        totalErrors: allResults.totalErrors
      },
      fileResults: allResults.fileResults,
      status: overallStatus,
      message: message,
      duration: duration
    });

    console.log(`📝 Import log saved with ID: ${importLog._id}`);
    
    res.json({
      message: message,
      importLogId: importLog._id, // Return log ID for reference
      summary: {
        filesProcessed: allResults.filesProcessed,
        totalRecords: allResults.totalRecords,
        playersCreated: allResults.playersCreated,
        playersUpdated: allResults.playersUpdated,
        teamsCreated: allResults.teamsCreated,
        recordsSkipped: allResults.recordsSkipped,
        totalErrors: allResults.totalErrors,
        duration: importLog.durationFormatted
      },
      details: allResults.fileResults
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;

    // 💾 SAVE FAILED IMPORT LOG
    try {
      await ImportLog.create({
        importType: 'directory',
        importedBy: req.user?._id || null,
        summary: {
          filesProcessed: 0,
          totalRecords: 0,
          playersCreated: 0,
          playersUpdated: 0,
          teamsCreated: 0,
          recordsSkipped: 0,
          totalErrors: 1
        },
        fileResults: [],
        status: 'failed',
        message: 'Import failed',
        errorMessage: error.message,
        duration: duration
      });
    } catch (logError) {
      console.error('Failed to save error log:', logError);
    }

    res.status(500).json({ 
      message: "Import failed",
      error: error.message 
    });
  }
};

// Upload and import
export const uploadAndImportCSV = async (req, res) => {
  const startTime = Date.now();
  
  try {
    const files = req.files || (req.file ? [req.file] : []);
    
    if (files.length === 0) {
      return res.status(400).json({ message: "No file(s) uploaded" });
    }

    console.log(`📂 Received ${files.length} uploaded file(s)`);

    const allResults = {
      filesProcessed: files.length,
      totalRecords: 0,
      playersCreated: 0,
      playersUpdated: 0,
      teamsCreated: 0,
      recordsSkipped: 0,
      totalErrors: 0,
      fileResults: []
    };

    for (const file of files) {
      const fileExt = path.extname(file.originalname).toLowerCase();
      console.log(`\n📄 Processing ${fileExt.toUpperCase()} file: ${file.originalname}...`);
      
      try {
        const results = await importPlayersFromCSV(file.path);

        allResults.totalRecords += results.total;
        allResults.playersCreated += results.created;
        allResults.playersUpdated += results.updated;
        allResults.teamsCreated += results.teamsCreated;
        allResults.recordsSkipped += results.skipped;
        allResults.totalErrors += results.errors.length;

        allResults.fileResults.push({
          fileName: file.originalname,
          fileType: fileExt,
          status: 'success',
          totalRecords: results.total,
          playersCreated: results.created,
          playersUpdated: results.updated,
          teamsCreated: results.teamsCreated,
          recordsSkipped: results.skipped,
          errors: results.errors
        });

        console.log(`✅ ${file.originalname} - Created: ${results.created}, Updated: ${results.updated}`);

        fs.unlinkSync(file.path);
        
      } catch (error) {
        console.error(`❌ ${file.originalname} - Error: ${error.message}`);
        
        allResults.totalErrors++;
        allResults.fileResults.push({
          fileName: file.originalname,
          fileType: fileExt,
          status: 'failed',
          totalRecords: 0,
          playersCreated: 0,
          playersUpdated: 0,
          teamsCreated: 0,
          recordsSkipped: 0,
          errors: [{ error: error.message }]
        });

        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      }
    }

    const duration = Date.now() - startTime;
    const overallStatus = allResults.totalErrors > 0 
      ? (allResults.playersCreated > 0 || allResults.playersUpdated > 0 ? 'partial' : 'failed')
      : 'completed';

    const message = `Import completed. Processed ${files.length} file(s)`;

    // 💾 SAVE IMPORT LOG TO DATABASE
    const importLog = await ImportLog.create({
      importType: 'upload',
      importedBy: req.user?._id || null,
      summary: {
        filesProcessed: allResults.filesProcessed,
        totalRecords: allResults.totalRecords,
        playersCreated: allResults.playersCreated,
        playersUpdated: allResults.playersUpdated,
        teamsCreated: allResults.teamsCreated,
        recordsSkipped: allResults.recordsSkipped,
        totalErrors: allResults.totalErrors
      },
      fileResults: allResults.fileResults,
      status: overallStatus,
      message: message,
      duration: duration
    });

    console.log(`📝 Import log saved with ID: ${importLog._id}`);
    
    res.json({
      message: message,
      importLogId: importLog._id,
      summary: {
        filesProcessed: allResults.filesProcessed,
        totalRecords: allResults.totalRecords,
        playersCreated: allResults.playersCreated,
        playersUpdated: allResults.playersUpdated,
        teamsCreated: allResults.teamsCreated,
        recordsSkipped: allResults.recordsSkipped,
        totalErrors: allResults.totalErrors,
        duration: importLog.durationFormatted
      },
      details: allResults.fileResults
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    // Clean up all files if error occurs
    const files = req.files || (req.file ? [req.file] : []);
    files.forEach(file => {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    });

    // 💾 SAVE FAILED IMPORT LOG
    try {
      await ImportLog.create({
        importType: 'upload',
        importedBy: req.user?._id || null,
        summary: {
          filesProcessed: 0,
          totalRecords: 0,
          playersCreated: 0,
          playersUpdated: 0,
          teamsCreated: 0,
          recordsSkipped: 0,
          totalErrors: 1
        },
        fileResults: [],
        status: 'failed',
        message: 'Import failed',
        errorMessage: error.message,
        duration: duration
      });
    } catch (logError) {
      console.error('Failed to save error log:', logError);
    }
    
    res.status(500).json({ 
      message: "Import failed",
      error: error.message 
    });
  }
};

// Get Import Logs with Pagination & Filters
export const getImportLogs = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      status, 
      importType,
      startDate,
      endDate 
    } = req.query;

    const query = {};
    
    if (status) query.status = status;
    if (importType) query.importType = importType;
    if (startDate || endDate) {
      query.importedAt = {};
      if (startDate) query.importedAt.$gte = new Date(startDate);
      if (endDate) query.importedAt.$lte = new Date(endDate);
    }

    const logs = await ImportLog.find(query)
      .populate('importedBy', 'firstName lastName email')
      .sort({ importedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const count = await ImportLog.countDocuments(query);

    res.json({
      logs,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      totalLogs: count
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get Single Import Log Details
export const getImportLogById = async (req, res) => {
  try {
    const { logId } = req.params;

    const log = await ImportLog.findById(logId)
      .populate('importedBy', 'firstName lastName email')
      .lean();

    if (!log) {
      return res.status(404).json({ message: "Import log not found" });
    }

    res.json(log);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete Old Import Logs (cleanup)
export const cleanupOldLogs = async (req, res) => {
  try {
    const { daysOld = 90 } = req.query;
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await ImportLog.deleteMany({
      importedAt: { $lt: cutoffDate }
    });

    res.json({
      message: `Deleted ${result.deletedCount} logs older than ${daysOld} days`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get player stats (NO CHANGES NEEDED)
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