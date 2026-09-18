import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function LoginScreen() {
  const { requestOtp, verifyOtp } = useAuth();
  const navigate = useNavigate();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await requestOtp(phoneNumber);
      setOtpSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send code');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await verifyOtp(phoneNumber, otp);
      navigate('/drivers');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid code');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-bold text-teal-700">Monze Ride</h1>
        <p className="mb-6 text-sm text-slate-500">Admin dashboard</p>

        <form onSubmit={otpSent ? handleVerifyOtp : handleRequestOtp} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            Phone number
            <input
              type="tel"
              value={phoneNumber}
              disabled={otpSent}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+260..."
              className="rounded border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
              required
            />
          </label>

          {otpSent && (
            <label className="flex flex-col gap-1 text-sm">
              Code from SMS
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                required
                autoFocus
              />
            </label>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="rounded bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
          >
            {otpSent ? 'Verify & sign in' : 'Send code'}
          </button>
        </form>

        <p className="mt-4 text-xs text-slate-400">
          Admin accounts are created by an existing admin, not through this form. Ask them to run
          the <code>seed:admin</code> script if you don't have access yet.
        </p>
      </div>
    </div>
  );
}
