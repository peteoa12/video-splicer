import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const s3 = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function uploadToS3(localFilePath: string, folder: string) {
  const fileStream = fs.createReadStream(localFilePath);
  const extension = path.extname(localFilePath);
  const key = `${folder}/${uuidv4()}${extension}`;

  const uploadParams = {
    Bucket: process.env.AWS_S3_BUCKET!,
    Key: key,
    Body: fileStream,
    ContentType: "video/mp4",
  };

  await s3.send(new PutObjectCommand(uploadParams));

  return `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
}

export async function deleteFromS3(fileUrl: string) {
  const bucket = process.env.AWS_S3_BUCKET!;
  const region = process.env.AWS_REGION!;
  const prefix = `https://${bucket}.s3.${region}.amazonaws.com/`;

  if (!fileUrl.startsWith(prefix)) {
    throw new Error("Invalid S3 URL format");
  }

  const key = decodeURIComponent(fileUrl.substring(prefix.length));

  const deleteParams = {
    Bucket: bucket,
    Key: key,
  };

  await s3.send(new DeleteObjectCommand(deleteParams));
}