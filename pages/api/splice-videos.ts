import type { NextApiRequest, NextApiResponse } from "next";
import formidable from "formidable";
import path from "path";
import fs from "fs/promises";
import fsSync from "fs";
import { uploadToS3 } from "../../lib/s3Uploader";
import { extractSegment, extractAudio } from "../../lib/ffmpegUtils";
import ffmpeg from "fluent-ffmpeg";

export const config = {
  api: {
    bodyParser: false,
  },
};

function getVideoDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) reject(err);
      else resolve(metadata.format.duration || 0);
    });
  });
}

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
      const resolution = fields.resolution?.[0] || "mobile";

      if (!mainVideo || !clipVideo || !startTimestamp || !endTimestamp) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const startSec = parseTimeToSeconds(startTimestamp);
      const endSec = parseTimeToSeconds(endTimestamp);
      const totalMainDuration = await getVideoDuration(mainVideo.filepath);
      const actualClipDuration = await getVideoDuration(clipVideo.filepath);

      const clipDuration = Math.max(actualClipDuration, 0.1); // fallback just in case
      const remainingDuration = Math.max(totalMainDuration - endSec, 1);

      console.log({
        startSec,
        endSec,
        actualClipDuration,
        calculatedAfterStart: startSec + clipDuration,
        remainingDuration
      });

      // Cut main video into two pre-trimmed segments
      // Extract audio from main video (full track)
      const audioPath = await extractAudio(mainVideo.filepath);

      // Slice main video
      const beforePath = await extractSegment(mainVideo.filepath, 0, startSec);
      const afterPath = await extractSegment(mainVideo.filepath, endSec, remainingDuration);

      // Upload video segments
      const beforeUrl = await uploadToS3(beforePath, `before-${Date.now()}`);
      const afterUrl = await uploadToS3(afterPath, `after-${Date.now()}`);
      const clipUrl = await uploadToS3(clipVideo.filepath, `clip-${Date.now()}`);

      // Upload audio
      const audioUrl = await uploadToS3(audioPath, `audio-${Date.now()}`);

      const shotstackPayload = {
        timeline: {
          tracks: [
            {
              clips: [
                {
                  asset: {
                    type: "video",
                    src: beforeUrl,
                    volume: 0
                  },
                  start: 0,
                  length: startSec
                },
                {
                  asset: {
                    type: "video",
                    src: clipUrl,
                    volume: 0
                  },
                  start: startSec,
                  length: clipDuration
                },
                {
                  asset: {
                    type: "video",
                    src: afterUrl,
                    volume: 0
                  },
                  start: startSec + clipDuration,
                  length: remainingDuration
                }
              ]
            },
            {
              clips: [
                {
                  asset: {
                    type: "audio",
                    src: audioUrl
                  },
                  start: 0,
                  length: totalMainDuration
                }
              ]
            }
          ]
        },
        output: {
          format: "mp4",
          resolution,
          aspectRatio:
            resolution === "mobile" ? "9:16"
            : resolution === "square" ? "1:1"
            : "16:9"
        }
      };
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

      // Clean up everything in /tmp
      try {
        const tmpDir = path.join(process.cwd(), "tmp");
        const files = await fs.readdir(tmpDir);
        await Promise.all(files.map(file => fs.unlink(path.join(tmpDir, file))));
        console.log("🧹 Cleaned up /tmp folder");
      } catch (cleanupErr) {
        console.warn("⚠️ TMP cleanup error:", cleanupErr);
      }

      if (!response.ok || !result?.response?.id) {
        return res.status(500).json({ error: "Video rendering failed", shotstackResponse: result });
      }

      return res.status(200).json({ id: result.response.id });

    } catch (error) {
      console.error("Splicing error:", error);
      return res.status(500).json({ error: "Splicing failed" });
    }
  });
}