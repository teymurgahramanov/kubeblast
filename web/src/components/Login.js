import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../utils/axiosInstance';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await axiosInstance.post('/token', {
        username,
        password,
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      const { access_token } = response.data;
      sessionStorage.setItem('access_token', access_token);
      setError('');
      setLoading(false);
      navigate('/jobs');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to log in');
      console.error('Login error:', err);
      sessionStorage.removeItem('access_token');
      setLoading(false);
    }
  };

  return (
    <section className="d-flex align-items-center justify-content-center min-vh-100" style={{ backgroundColor: "#0D0630" }}>
      <div className="w-100 d-flex justify-content-center">
        <div className="col-lg-4 col-md-6 col-sm-8">
          <div className="card border-0" style={{ background: "none" }}>
            <div className="card-body text-center login-border">
              <form onSubmit={handleSubmit}>
                <h2 className="mb-4 text-light" style={{ fontFamily: "'Roboto', sans-serif", fontWeight: '500' }}>
                  Welcome Back!
                </h2>
                <h4 className="mb-5 text-light" style={{ fontFamily: "'Roboto', sans-serif", fontWeight: '300' }}>
                  Log in to continue
                </h4>
                <div className="form-group mb-4">
                  <input
                    type="text"
                    className="form-control text-white"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    style={{
                      color: '#fff',
                      backgroundColor: "#8BBEB2",
                      padding: "12px",
                      borderRadius: "50px",
                      border: "none",
                    }}
                    placeholder="Username"
                  />
                </div>
                <div className="form-group mb-4">
                  <input
                    type="password"
                    className="form-control text-white"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{
                      color: '#fff',
                      backgroundColor: "#8BBEB2",
                      padding: "12px",
                      borderRadius: "50px",
                      border: "none",
                    }}
                    placeholder="Password"
                  />
                </div>
                <div className="form-group mb-4">
                  <button
                    type="submit"
                    className="btn w-50"
                    disabled={loading}
                    style={{
                      backgroundColor: "#8BBEB2",
                      borderRadius: "20px",
                      color: "#FFF",
                      border: "none",
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
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Login;
