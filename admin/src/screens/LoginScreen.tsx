import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import silosPhoto from '../assets/images/monze_silos.jpg';
import motorbikeIllustration from '../assets/images/motorbike_taxi_icon.svg';

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
    <div
      className="relative flex min-h-screen flex-col justify-end bg-slate-900 bg-cover bg-center"
      style={{ backgroundImage: `url(${silosPhoto})` }}
    >
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/70 to-slate-950/30" />

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pt-16 text-center">
        <img src={motorbikeIllustration} alt="" className="mb-6 h-28 w-auto drop-shadow-lg" />
        <h1 className="text-4xl font-extrabold uppercase tracking-wide text-white drop-shadow-md sm:text-5xl">
          Monze Moto
        </h1>
        <p className="mt-2 text-sm font-medium text-teal-200">Admin dashboard</p>
      </div>

      <div className="relative z-10 mx-auto w-full max-w-sm px-6 pb-10">
        <form
          onSubmit={otpSent ? handleVerifyOtp : handleRequestOtp}
          className="flex flex-col gap-3 rounded-xl bg-white/95 p-6 shadow-xl backdrop-blur"
        >
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            Phone number
            <input
              type="tel"
              value={phoneNumber}
              disabled={otpSent}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+260..."
              className="rounded-full border border-slate-300 px-4 py-2.5 text-sm disabled:bg-slate-100"
              required
            />
          </label>

          {otpSent && (
            <label className="flex flex-col gap-1 text-sm text-slate-700">
              Code from SMS
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="rounded-full border border-slate-300 px-4 py-2.5 text-sm"
                required
                autoFocus
              />
            </label>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 rounded-full bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
          >
            {otpSent ? 'Verify & sign in' : 'Send code'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-slate-300">
          Admin accounts are created by an existing admin, not through this form. Ask them to run
          the <code>seed:admin</code> script if you don't have access yet.
        </p>
      </div>
    </div>
  );
}
