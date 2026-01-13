import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import path from "path";
import fs from "fs/promises";

// Set FFmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

/**
 * Create a video clip from original video
 * @param {string} inputVideoPath - Path to original video
 * @param {number} startTime - Start time in milliseconds
 * @param {number} duration - Duration in milliseconds
 * @param {string} outputPath - Path where clip will be saved
 * @returns {Promise<string>} - Path to created clip
 */
export const createVideoClip = (inputVideoPath, startTime, duration, outputPath) => {
  return new Promise((resolve, reject) => {
    // Convert milliseconds to seconds for FFmpeg
    const startSeconds = startTime / 1000;
    const durationSeconds = duration / 1000;

    console.log(`Creating clip: Start=${startSeconds}s, Duration=${durationSeconds}s`);

    ffmpeg(inputVideoPath)
      .setStartTime(startSeconds)
      .setDuration(durationSeconds)
      .output(outputPath)
      .outputOptions([
        '-c:v libx264',        // Video codec
        '-c:a aac',            // Audio codec
        '-strict experimental',
        '-b:a 192k',           // Audio bitrate
        '-movflags +faststart' // Optimize for web streaming
      ])
      .on('start', (commandLine) => {
        console.log('FFmpeg command:', commandLine);
      })
      .on('progress', (progress) => {
        console.log(`Processing: ${progress.percent}% done`);
      })
      .on('end', () => {
        console.log('Video clip created successfully');
        resolve(outputPath);
      })
      .on('error', (err, stdout, stderr) => {
        console.error('FFmpeg Error:', err.message);
        console.error('FFmpeg stderr:', stderr);
        reject(err);
      })
      .run();
  });
};

/**
 * Get video metadata (duration, resolution, etc.)
 * @param {string} videoPath - Path to video file
 * @returns {Promise<Object>} - Video metadata
 */
export const getVideoMetadata = (videoPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        reject(err);
      } else {
        resolve(metadata);
      }
    });
  });
};

/**
 * Ensure directory exists
 * @param {string} dirPath - Directory path
 */
export const ensureDirectoryExists = async (dirPath) => {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
};