import { GetObjectCommand, HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

function storage() {
  const bucket = process.env.CALL_RECORDINGS_S3_BUCKET;
  const region = process.env.CALL_RECORDINGS_S3_REGION;
  const accessKeyId = process.env.CALL_RECORDINGS_S3_ACCESS_KEY;
  const secretAccessKey = process.env.CALL_RECORDINGS_S3_SECRET;
  if (!bucket || !region || !accessKeyId || !secretAccessKey) throw new Error('Call recordings storage is not configured.');
  return {
    bucket,
    client: new S3Client({
      region,
      endpoint: process.env.CALL_RECORDINGS_S3_ENDPOINT || undefined,
      forcePathStyle: Boolean(process.env.CALL_RECORDINGS_S3_ENDPOINT),
      credentials: { accessKeyId, secretAccessKey },
    }),
  };
}

export async function signedCallRecordingUrl(key: string) {
  const { bucket, client } = storage();
  await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key, ResponseContentType: 'audio/mp4', ResponseContentDisposition: 'inline' }), { expiresIn: 900 });
}
