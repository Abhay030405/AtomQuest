import React, { useState, useEffect } from 'react';
import './LoginPage.css';

export const LoginPage: React.FC = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('cf-theme');
    if (saved === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      return 'dark';
    }
    return 'light';
  });
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    // any side effects can go here
  }, []);

  const handleSetTheme = (t: 'light' | 'dark') => {
    setTheme(t);
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('cf-theme', t);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 1800);
  };

  const handleMsLogin = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      showToast('Signed in with Microsoft (demo)');
    }, 1400);
  };

  const handleRoleSelect = (role: string) => {
    setSelectedRole(role);
    showToast('Continuing as ' + role.charAt(0).toUpperCase() + role.slice(1) + '…');
  };

  const handleBackToRoles = () => {
    setSelectedRole(null);
    setIdentifier('');
    setPassword('');
    setShowPassword(false);
  };

  const handleCredentialsSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!identifier || !password) {
      showToast('Enter email or phone and password');
      return;
    }
    showToast('Signing in as ' + (selectedRole ?? 'user') + ' (demo)');
  };

  return (
    <div className="login-page-container">
      <div className="login-shell" data-screen-label="01 Login">
        {/* LEFT: brand + illustration (background image) */}
        <div className="login-left" aria-hidden="true"></div>

        {/* RIGHT: login */}
        <main className="login-right">
          {/* Theme toggle */}
          <div className="theme-toggle" role="group" aria-label="Theme">
            <button
              onClick={() => handleSetTheme('light')}
              className={theme !== 'dark' ? 'active' : ''}
              aria-label="Light theme"
              title="Light"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="4"></circle>
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
              </svg>
            </button>
            <button
              onClick={() => handleSetTheme('dark')}
              className={theme === 'dark' ? 'active' : ''}
              aria-label="Dark theme"
              title="Dark"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
              </svg>
            </button>
          </div>

          <div className="login-card">
            <div className="login-hero">
              <h1>Welcome back</h1>
              <p>Sign in to continue to CortexFlow</p>
            </div>

            <button
              className={`ms-btn ${isLoading ? 'loading' : ''}`}
              onClick={handleMsLogin}
              type="button"
            >
              <span className="ms-logo" aria-hidden="true">
                <span></span><span></span><span></span><span></span>
              </span>
              <span className="ms-label">Sign in with Microsoft</span>
              <span className="spinner" aria-hidden="true"></span>
            </button>

            <div className="login-or"><span>or</span></div>

            {!selectedRole && <div className="login-as-label">Login as</div>}

            {!selectedRole && (
              <div className="login-roles">
                {/* Employee Role */}
                <button
                  className="login-role"
                  onClick={() => handleRoleSelect('employee')}
                  type="button"
                >
                  <span className="role-icon employee" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="5" width="18" height="14" rx="2" />
                      <circle cx="9" cy="11" r="2.2" />
                      <path d="M5.5 16.5c.7-1.6 2.1-2.5 3.5-2.5s2.8.9 3.5 2.5" />
                      <path d="M14.5 9.5h4M14.5 12.5h3" />
                    </svg>
                  </span>
                  <span className="role-body">
                    <span className="role-title">Employee</span>
                    <span className="role-desc">Access your goals and track progress</span>
                  </span>
                  <span className="role-chev" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 6l6 6-6 6" />
                    </svg>
                  </span>
                </button>

                {/* Manager Role */}
                <button
                  className="login-role"
                  onClick={() => handleRoleSelect('manager')}
                  type="button"
                >
                  <span className="role-icon manager" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="9" cy="9" r="3" />
                      <path d="M3.5 19c.8-2.6 3-4 5.5-4s4.7 1.4 5.5 4" />
                      <circle cx="17" cy="8" r="2.4" />
                      <path d="M15.5 14.2c2.2.2 4 1.6 4.5 3.8" />
                    </svg>
                  </span>
                  <span className="role-body">
                    <span className="role-title">Manager</span>
                    <span className="role-desc">Review team goals and performance</span>
                  </span>
                  <span className="role-chev" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 6l6 6-6 6" />
                    </svg>
                  </span>
                </button>

                {/* Admin Role */}
                <button
                  className="login-role"
                  onClick={() => handleRoleSelect('admin')}
                  type="button"
                >
                  <span className="role-icon admin" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 3l8 3v6c0 4.5-3.4 8.4-8 9-4.6-.6-8-4.5-8-9V6l8-3z" />
                      <path d="M9.5 12.5l2 2 3.5-4" />
                    </svg>
                  </span>
                  <span className="role-body">
                    <span className="role-title">Admin</span>
                    <span className="role-desc">Manage users and system settings</span>
                  </span>
                  <span className="role-chev" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 6l6 6-6 6" />
                    </svg>
                  </span>
                </button>
              </div>
            )}

            {selectedRole && (
              <section className="login-credentials" aria-label="Credentials">
                <div className="credentials-header">
                  <button
                    type="button"
                    className="back-button"
                    aria-label="Back to roles"
                    onClick={handleBackToRoles}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M15 18l-6-6 6-6" />
                    </svg>
                  </button>
                  <div className="credentials-text">
                    <span className="credentials-title">
                      {selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)} Login
                    </span>
                    <span className="credentials-subtitle">Please Enter your Login and your Password</span>
                  </div>
                </div>
                <form className="credentials-form" onSubmit={handleCredentialsSubmit}>
                  <label className="field">
                    <span className="field-label">Email or phone number</span>
                    <input
                      type="text"
                      placeholder="name@company.com or +1 555 000 0000"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                    />
                  </label>
                  <label className="field">
                    <span className="field-label">Password</span>
                    <span className="password-input">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        className="eye-toggle"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        onClick={() => setShowPassword((prev) => !prev)}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      </button>
                    </span>
                  </label>
                  <button className="credentials-submit" type="submit">Continue</button>
                </form>
              </section>
            )}

            <div className="login-secure">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="11" width="16" height="9" rx="2" />
                <path d="M8 11V8a4 4 0 0 1 8 0v3" />
              </svg>
              Secure and trusted by thousands of organizations
            </div>
          </div>
        </main>
      </div>
      <div className={`login-toast ${toastMessage ? 'show' : ''}`}>
        {toastMessage}
      </div>
    </div>
  );
};
