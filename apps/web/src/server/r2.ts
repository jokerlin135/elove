import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const R2_PREFIX = process.env.R2_PREFIX ?? "elove";

export function createR2Client() {
  const client = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT!,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });

  const bucket = process.env.R2_BUCKET!;

  return {
    // Returns full R2 key with prefix
    key: (path: string) => `${R2_PREFIX}/${path}`,

    async put(
      path: string,
      body: string | Buffer,
      options?: { contentType?: string },
    ) {
      const cmd = new PutObjectCommand({
        Bucket: bucket,
        Key: `${R2_PREFIX}/${path}`,
        Body: body,
        ContentType: options?.contentType ?? "application/octet-stream",
      });
      return client.send(cmd);
    },

    async get(path: string): Promise<string> {
      const cmd = new GetObjectCommand({
        Bucket: bucket,
        Key: `${R2_PREFIX}/${path}`,
      });
      const response = await client.send(cmd);
      return response.Body!.transformToString();
    },

    async presignUpload(
      path: string,
      contentType: string,
      expiresIn = 3600,
    ) {
      const cmd = new PutObjectCommand({
        Bucket: bucket,
        Key: `${R2_PREFIX}/${path}`,
        ContentType: contentType,
      });
      return getSignedUrl(client, cmd, { expiresIn });
    },
  };
}

export type R2Client = ReturnType<typeof createR2Client>;
