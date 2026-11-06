-- Raise the final reel limit from 3 MiB to 4 MiB while remaining below Vercel's
-- 4.5 MiB request-body limit after multipart form overhead.
ALTER TABLE "ReelVideo" DROP CONSTRAINT "ReelVideo_size_check";
ALTER TABLE "ReelVideo" ADD CONSTRAINT "ReelVideo_size_check"
  CHECK (size > 0 AND size <= 4194304 AND octet_length(data) = size);
