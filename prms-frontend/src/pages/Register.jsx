import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Building2,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  User,
  UserPlus,
  Phone,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useRegistration } from '../contexts/RegistrationContext';

function Register() {
  const navigate = useNavigate();
  const { register, error, clearError } = useAuth();
  const { clearRegistration } = useRegistration();

  /* Issue #2: Redirect to /role-selection if user skipped role pick */
  useEffect(() => {
    const selected = sessionStorage.getItem('prmsSelectedRole');
    if (!selected) {
      navigate('/role-selection', { replace: true });
    }
  }, [navigate]);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });

  /* AUTH-002: Read role from RoleSelection, fallback to Tenant */
  const selectedRole = sessionStorage.getItem('prmsSelectedRole') || 'Tenant';

  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  function handleChange(field, value) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    if (e) e.preventDefault();
    setSubmitting(true);
    clearError();
    setFormError('');

    if (formData.password !== formData.confirmPassword) {
      setSubmitting(false);
      setFormError('Passwords do not match');
      return;
    }

    const result = await register(
      {
        full_name: `${formData.firstName} ${formData.lastName}`.trim(),
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
        role: selectedRole,
      }
    );

    if (!result.success) {
      setFormError(result.error || 'Registration failed. Please try again.');
    } else {
      // Login clears registration state after navigation has completed.
      navigate('/login', { replace: true });
    }

    setSubmitting(false);
  }

  return (
    <main className="login-page" data-customize-id="global.page">
      <motion.section
        className="login-left"
        initial={{ x: -80, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.65, ease: 'easeOut' }}
      >
        <motion.div
          className="brand-small"
          initial={{ y: -18, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.45 }}
          onClick={() => navigate('/')}
          style={{ cursor: 'pointer' }}
        >
          <Building2 size={28} />
          <span>PRMS</span>
        </motion.div>

        <div className="login-hero-content">
          <motion.div
            className="purple-line"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 150, opacity: 1 }}
            transition={{ delay: 0.35, duration: 0.55, ease: 'easeOut' }}
          ></motion.div>

          <motion.h1
            initial={{ y: 28, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.45, duration: 0.55 }}
          >
            Join the Future of Property Management.
          </motion.h1>

          <motion.p
            initial={{ y: 28, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.55, duration: 0.55 }}
          >
            Create your account and start managing properties, bookings,
            and tenants in one powerful platform used across Southeast Asia.
          </motion.p>

          <motion.div
            className="trusted-card"
            initial={{ y: 32, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            transition={{ delay: 0.75, duration: 0.5 }}
            whileHover={{ y: -4, scale: 1.02 }}
          >
            <div className="avatar-group">
              <motion.div className="avatar" whileHover={{ y: -4 }}>
                JD
              </motion.div>

              <motion.div className="avatar" whileHover={{ y: -4 }}>
                MC
              </motion.div>

              <motion.div className="avatar" whileHover={{ y: -4 }}>
                SA
              </motion.div>
            </div>

            <span>Trusted by regional leaders</span>
          </motion.div>
        </div>
      </motion.section>

      <motion.section
        className="login-right"
        initial={{ x: 80, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.65, ease: 'easeOut' }}
      >
        <motion.div
          className="login-form-box"
          initial={{ y: 34, opacity: 0, scale: 0.97 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.55, ease: 'easeOut' }}
        >
          <motion.h2
            initial={{ y: 18, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.35 }}
          >
            Create Account
          </motion.h2>

          <motion.p
            className="form-subtitle"
            initial={{ y: 18, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.38, duration: 0.35 }}
          >
            Register to start managing your properties.
          </motion.p>

          <form onSubmit={handleSubmit}>
            <motion.div
              initial={{ y: 18, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.35 }}
            >
              <div className="register-row">
                <div className="register-half">
                  <label>First Name</label>
                  <div className="input-box">
                    <User size={22} />
                    <input
                      type="text"
                      placeholder="John"
                      value={formData.firstName}
                      onChange={(e) => handleChange('firstName', e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="register-half">
                  <label>Last Name</label>
                  <div className="input-box">
                    <User size={22} />
                    <input
                      type="text"
                      placeholder="Doe"
                      value={formData.lastName}
                      onChange={(e) => handleChange('lastName', e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ y: 18, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.46, duration: 0.35 }}
            >
              <label>Email Address</label>
              <div className="input-box">
                <Mail size={22} />
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  required
                />
              </div>
            </motion.div>

            <motion.div
              initial={{ y: 18, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.52, duration: 0.35 }}
            >
              <label>Phone</label>
              <div className="input-box">
                <Phone size={22} />
                <input
                  type="tel"
                  placeholder="+65 1234 5678"
                  value={formData.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                />
              </div>
            </motion.div>

            <motion.div
              initial={{ y: 18, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.58, duration: 0.35 }}
            >
              <label>Password</label>
              <div className="input-box">
                <LockKeyhole size={22} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Min 6 characters"
                  value={formData.password}
                  onChange={(e) => handleChange('password', e.target.value)}
                  required
                  minLength={6}
                />
                <span
                  className="input-right-icon"
                  onClick={() => setShowPassword((v) => !v)}
                  role="button"
                  tabIndex={0}
                >
                  {showPassword ? <EyeOff size={22} /> : <Eye size={22} />}
                </span>
              </div>
            </motion.div>

            <motion.div
              initial={{ y: 18, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.64, duration: 0.35 }}
            >
              <label>Confirm Password</label>
              <div className="input-box">
                <LockKeyhole size={22} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Re-enter password"
                  value={formData.confirmPassword}
                  onChange={(e) => handleChange('confirmPassword', e.target.value)}
                  required
                  minLength={6}
                />
              </div>
            </motion.div>

            {/* Error message */}
            {(formError || error) && (
              <motion.div
                className="login-error"
                role="alert"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {formError || error}
              </motion.div>
            )}

            <motion.button
              type="submit"
              className="primary-btn"
              disabled={submitting}
              initial={{ y: 18, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.72, duration: 0.35 }}
              whileHover={{ y: -2, scale: 1.01 }}
              whileTap={{ scale: 0.97 }}
            >
              {submitting ? 'Creating Account...' : 'Create Account'}{' '}
              <UserPlus size={20} />
            </motion.button>

            <motion.p
              className="signup-text"
              initial={{ y: 18, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.35 }}
            >
              Already have an account?{' '}
              <a
                href="#"
                role="link"
                tabIndex={0}
                onClick={(e) => {
                  e.preventDefault();
                  clearRegistration();
                  navigate('/login', { replace: true });
                }}
              >
                Sign in
              </a>
            </motion.p>
          </form>
        </motion.div>
      </motion.section>
    </main>
  );
}

export default Register;
