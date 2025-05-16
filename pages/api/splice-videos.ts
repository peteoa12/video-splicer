import type { NextApiRequest, NextApiResponse } from "next";
import formidable from "formidable";
import path from "path";
import fs from "fs/promises";
import fsSync from "fs";
import { uploadToS3, deleteFromS3 } from "../../lib/s3Uploader";
import ffmpeg from "fluent-ffmpeg";

// Disable built-in bodyParser so formidable can parse multipart/form-data
export const config = {
  api: {
    bodyParser: false,
  },
};

// Get video duration using FFmpeg
function getVideoDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) reject(err);
      else resolve(metadata.format.duration || 0);
    });
  });
}

// Convert HH:MM:SS or MM:SS to seconds
function parseTimeToSeconds(timeStr: string): number {
  const parts = timeStr.split(":").map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  } else {
    return parseFloat(timeStr);
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const form = formidable({
    uploadDir: path.join(process.cwd(), "/tmp"),
    keepExtensions: true,
    multiples: true,
  });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error("Form parse error:", err);
      return res.status(500).json({ error: "Upload failed" });
    }

    try {
      const mainVideo = files.mainVideo?.[0];
      const clipVideo = files.clipVideo?.[0];
      const startTimestamp = fields.startTimestamp?.[0];
      const endTimestamp = fields.endTimestamp?.[0];
      const resolution = fields.resolution?.[0] || "mobile"; // mobile | hd | square

      if (!mainVideo || !clipVideo || !startTimestamp || !endTimestamp) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const startSec = parseTimeToSeconds(startTimestamp);
      const endSec = parseTimeToSeconds(endTimestamp);
      const clipDuration = Math.max(endSec - startSec, 1); // Ensure positive length

      // Get full duration of the main video
      const totalMainDuration = await getVideoDuration(mainVideo.filepath);
      const remainingDuration = Math.max(totalMainDuration - endSec, 1); // At least 1s

      // Upload videos to S3
      const mainUrl = await uploadToS3(mainVideo.filepath, "main");
      const clipUrl = await uploadToS3(clipVideo.filepath, "clip");

      // Build the Shotstack timeline
      const shotstackPayload = {
        timeline: {
          tracks: [
            {
              clips: [
                // 1) Pre-splice segment
                {
                  asset: { type: "video", src: mainUrl },
                  start: 0,
                  length: startSec,       // how long to play this first segment
                },
                // 2) The inserted clip
                {
                  asset: { type: "video", src: clipUrl },
                  start: startSec,                        // place at splice point
                  length: clipDuration > 0 ? clipDuration : 1, 
                },
                // 3) Post-splice continuation of main video
                {
                  asset: { type: "video", src: mainUrl },
                  start: endSec,                          // place at end of clip
                  length: remainingDuration,              // play from endSec → end
                },
              ],
            },
          ],
        },
        output: {
          format: "mp4",
          resolution, // dynamically passed in from the form
        },
      };

      // Call Shotstack render API
      const response = await fetch("https://api.shotstack.io/stage/render", {
        method: "POST",
        headers: {
          "x-api-key": process.env.SHOTSTACK_DEV_API_KEY!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(shotstackPayload),
      });

      const result = await response.json();
      console.log("📦 Shotstack API Response:", JSON.stringify(result, null, 2));
      console.log("🎥 Render Resolution:", resolution);

      if (!response.ok || !result?.response?.id) {
        return res.status(500).json({ error: "Video rendering failed", shotstackResponse: result });
      }

      // Clean up local temp files
      if (fsSync.existsSync(mainVideo.filepath)) await fs.unlink(mainVideo.filepath);
      if (fsSync.existsSync(clipVideo.filepath)) await fs.unlink(clipVideo.filepath);

      return res.status(200).json({ id: result.response.id });
    } catch (error) {
      console.error("Splicing error:", error);
      return res.status(500).json({ error: "Splicing failed" });
    }
  });
}