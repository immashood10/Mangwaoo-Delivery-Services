# Mangwaoo in-app recorded calls

Buyer–seller conversations and active customer–rider order chats support audio calls through LiveKit Cloud. The caller must agree to the recording notice; the recipient must accept with consent. Both participants enter muted, and the app enables microphones only after LiveKit Egress confirms audio recording has started. Declined and unanswered calls are not recorded. Call recordings are private and only the super admin can request a short-lived playback URL.

## Production setup

1. Create a LiveKit Cloud project with Egress enabled. Add `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` as server-only Vercel environment variables.
2. Create a **private** S3-compatible bucket for recordings, enable the provider's default server-side encryption, block public access, and use a bucket policy that allows the LiveKit and app credentials to access only the recordings bucket. Add `CALL_RECORDINGS_S3_BUCKET`, `CALL_RECORDINGS_S3_REGION`, `CALL_RECORDINGS_S3_ACCESS_KEY`, and `CALL_RECORDINGS_S3_SECRET`. Set `CALL_RECORDINGS_S3_ENDPOINT` for an S3-compatible provider (omit it for AWS S3).
3. Apply migrations `20261114100000_chat_typing_indicators` and `20261115100000_recorded_in_app_calls` before deploying the app. Set `LIVEKIT_URL` in the build environment too, so the production Content Security Policy allows its WebSocket origin.
4. Deploy and open **Admin → Call Recordings** as the super admin. Calls cannot be placed until every LiveKit and storage setting is present.

Recordings are retained in the configured private bucket. Configure an appropriate retention and backup policy for the bucket. LiveKit Cloud Egress and object storage usage may incur charges.
