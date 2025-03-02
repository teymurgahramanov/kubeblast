import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom'; // Import useNavigate

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [accessToken, setAccessToken] = useState('');
  const navigate = useNavigate(); // Initialize navigate

  const handleSubmit = async (e) => {
    e.preventDefault();

    setLoading(true);

    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);

    try {
      const response = await fetch('http://192.168.0.108:30800/token', {
        method: 'POST',
        body: formData, // Submit FormData directly
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to log in');
      }

      const data = await response.json();
      sessionStorage.setItem('access_token', data.access_token); // Store the access_token in sessionStorage
      setAccessToken(data.access_token);
      setError('');
      setLoading(false);

      // Redirect to /jobs after successful login
      navigate('/jobs');
    } catch (err) {
      setError(err.message || 'Failed to log in');
      console.error('Login error:', err);
      sessionStorage.removeItem('access_token'); // Clear token on error
      setAccessToken('');
      setLoading(false);
    }
  };

  return (
    <section className="d-flex align-items-center justify-content-center min-vh-100" style={{ backgroundColor: "#1F3A6D" }}>
      <div className="w-100 d-flex justify-content-center">
        <div className="col-lg-4 col-md-6 col-sm-8">
          <div className="card shadow-lg rounded-lg" style={{ backgroundColor: "#2E3B55", borderRadius: "15px" }}>
            <div className="card-body p-5">
              <form onSubmit={handleSubmit}>
                <h2 className="mb-4 text-center text-light" style={{ fontFamily: "'Roboto', sans-serif", fontWeight: '500' }}>Welcome Back!</h2>
                <h4 className="mb-5 text-center text-light" style={{ fontFamily: "'Roboto', sans-serif", fontWeight: '300' }}>Log in to continue</h4>

                <div className="form-group mb-4">
                  <label htmlFor="username" className="font-weight-bold text-light">Username</label>
                  <input
                    type="text"
                    className="form-control"
                    name="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    style={{ backgroundColor: "#E5E5E5", padding: "12px", borderRadius: "8px" }}
                  />
                </div>

                <div className="form-group mb-4">
                  <label htmlFor="password" className="font-weight-bold text-light">Password</label>
                  <input
                    type="password"
                    className="form-control"
                    name="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{ backgroundColor: "#E5E5E5", padding: "12px", borderRadius: "8px" }}
                  />
                </div>

                <div className="form-group mb-4">
                  <button
                    type="submit"
                    className="btn btn-block w-100"
                    disabled={loading}
                    style={{
                      background: "linear-gradient(90deg, #FCA311, #14213D)",
                      color: "#FFF",
                      border: "none",
                      borderRadius: "8px",
                      padding: "14px",
                      fontWeight: "bold",
                      fontFamily: "'Roboto', sans-serif",
                    }}
                  >
                    {loading && <span className="spinner-border spinner-border-sm"></span>}
                    <span>Login</span>
                  </button>
                </div>

                {error && <div className="alert alert-danger text-center">{error}</div>}
              </form>

              {/* Display Access Token if it exists */}
              {accessToken && (
                <div className="mt-4 p-3 bg-gray-200 rounded-lg">
                  <p className="text-sm text-muted">Access Token:</p>
                  <pre className="break-all text-xs p-2 bg-gray-100 rounded">{accessToken}</pre>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Login;
