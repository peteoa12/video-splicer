// pages/api/splice-videos.ts
import type { NextApiRequest, NextApiResponse } from "next";
import formidable from "formidable";
import path from "path";
import fs from "fs/promises";
import fsSync from "fs";
import { uploadToS3, deleteFromS3 } from "../../lib/s3Uploader";
import axios from "axios";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const form = formidable({
    uploadDir: path.join(process.cwd(), "/tmp"),
    keepExtensions: true,
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

      if (!mainVideo || !clipVideo || !startTimestamp || !endTimestamp) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const mainUrl = await uploadToS3(mainVideo.filepath, "main");
      const clipUrl = await uploadToS3(clipVideo.filepath, "clip");

      const startSec = parseTimeToSeconds(startTimestamp);
      const endSec = parseTimeToSeconds(endTimestamp);
      const clipDuration = endSec - startSec;

      const shotstackPayload = {
        timeline: {
          tracks: [
            {
              clips: [
                {
                  asset: { type: "video", src: mainUrl },
                  start: 0,
                  length: startSec,
                },
                {
                  asset: { type: "video", src: clipUrl },
                  start: startSec,
                  length: clipDuration > 0 ? clipDuration : 1,
                },
                {
                  asset: { type: "video", src: mainUrl },
                  start: endSec,
                  length: 10,
                },
              ],
            },
          ],
        },
        output: {
          format: "mp4",
          resolution: "hd",
        },
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