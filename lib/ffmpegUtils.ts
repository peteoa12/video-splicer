import ffmpeg from "fluent-ffmpeg";
import path from "path";
import { randomUUID } from "crypto";

// Split a video into a segment using start and duration (in seconds)
export function extractSegment(inputPath: string, start: number, duration: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const outputPath = path.join(
      process.cwd(),
      "tmp",
      `segment-${randomUUID()}.mp4`
    );

    ffmpeg(inputPath)
      .setStartTime(start)
      .duration(duration)
      .outputOptions([
        "-c:v libx264",
        "-preset veryfast",
        "-movflags +faststart",
        "-pix_fmt yuv420p",
        "-profile:v main",
        "-c:a aac",
        "-b:a 128k",
        "-shortest"
      ])
      .on("end", () => resolve(outputPath))
      .on("error", reject)
      .save(outputPath);
  });
}

export function extractAudio(inputPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const outputPath = path.join(
      process.cwd(),
      "tmp",
      `audio-${randomUUID()}.mp4`
    );

    ffmpeg(inputPath)
      .noVideo()
      .audioCodec("aac")
      .audioBitrate("128k")
      .outputOptions("-shortest")
      .on("end", () => resolve(outputPath))
      .on("error", reject)
      .save(outputPath);
  });
}