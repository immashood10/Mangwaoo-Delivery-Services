import RiderSignupForm from '@/components/RiderSignupForm';
import { cnicCheckEnabled } from '@/lib/cnic-check-config';

export default function RiderSignupPage() {
  // Whether the form says an AI checks the CNIC photos depends on the host having the key, which only the server knows.
  return <RiderSignupForm photoCheck={cnicCheckEnabled()} />;
}
