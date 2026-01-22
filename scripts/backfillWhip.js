import mongoose from "mongoose";
import User from "../src/models/user.model.js";
import { calculateWHIP } from "../src/utils/whip.util.js";
import dotenv from "dotenv";

dotenv.config();

async function backfillWHIP() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    const totalPlayers = await User.countDocuments({
      "pitchingStats.0": { $exists: true },
    });
    console.log("Total players to check:", totalPlayers);

    if (totalPlayers === 0) {
      console.log("No player found with pitchingStats array");
      process.exit(0);
    }

    let updated = 0;

    const cursor = User.find({ "pitchingStats.0": { $exists: true } }).cursor();

    for await (const player of cursor) {
      let changed = false;

      player.pitchingStats.forEach((stat) => {
        if (stat.innings_pitched > 0) {
          const whip = calculateWHIP(stat);
          if (stat.whip == null || stat.whip !== whip) {
            stat.whip = whip;
            changed = true;
          }
        } else {
          if (stat.whip == null) {
            stat.whip = null;
            changed = true;
          }
        }
      });

      if (changed) {
        player.markModified("pitchingStats");
        // Skip validation errors for this backfill
        await player.save({ validateBeforeSave: false });
        updated++;
      }
    }

    console.log(`WHIP backfilled for ${updated} players`);
    process.exit(0);
  } catch (error) {
    console.error("Error in backfillWHIP:", error);
    process.exit(1);
  }
}

backfillWHIP();
