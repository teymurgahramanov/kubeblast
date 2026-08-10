import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Login from './Login';
import axiosInstance from '../utils/axiosInstance';

vi.mock('../utils/axiosInstance', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const canvasContext = {
  arc: vi.fn(),
  beginPath: vi.fn(),
  clearRect: vi.fn(),
  createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  fill: vi.fn(),
  fillRect: vi.fn(),
  lineTo: vi.fn(),
  moveTo: vi.fn(),
  setTransform: vi.fn(),
  stroke: vi.fn(),
};

const renderLogin = () => render(
  <BrowserRouter>
    <Login />
  </BrowserRouter>
);

describe('Login authentication methods', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(canvasContext);
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  it('does not show unconfigured authentication methods', async () => {
    axiosInstance.get.mockResolvedValue({
      data: {
        AUTHENTICATION_METHODS: ['local'],
        APP_VERSION: '1.3.0',
        EDITION: 'Community',
      },
    });

    renderLogin();

    expect(await screen.findByRole('button', { name: 'Sign In' })).toBeInTheDocument();
    expect(await screen.findByLabelText('Application version and edition')).toHaveTextContent('1.3.0 Community');
    expect(screen.queryByText('Welcome!')).not.toBeInTheDocument();
    expect(screen.queryByText('Kubernetes Native')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Authentication Method')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Continue with SSO' })).not.toBeInTheDocument();
  });

  it('shows the authentication selector when LDAP is configured', async () => {
    axiosInstance.get.mockResolvedValue({
      data: { AUTHENTICATION_METHODS: ['local', 'ldap'] },
    });

    renderLogin();

    expect(await screen.findByLabelText('Authentication Method')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Continue with SSO' })).not.toBeInTheDocument();
  });

  it('shows SSO when OIDC is configured', async () => {
    axiosInstance.get.mockResolvedValue({
      data: { AUTHENTICATION_METHODS: ['local', 'oidc'] },
    });

    renderLogin();

    expect(await screen.findByRole('button', { name: 'Continue with SSO' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Authentication Method')).not.toBeInTheDocument();
  });

  it('shows an error when credentials are rejected without triggering token refresh handling', async () => {
    const user = userEvent.setup();
    axiosInstance.get.mockResolvedValue({
      data: { AUTHENTICATION_METHODS: ['local'] },
    });
    axiosInstance.post.mockRejectedValue({
      response: { data: { detail: 'Incorrect username or password' } },
    });

    renderLogin();

    await user.type(await screen.findByLabelText('Username'), 'wrong-user');
    await user.type(screen.getByLabelText('Password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(await screen.findByText('Incorrect username or password')).toBeInTheDocument();
    expect(axiosInstance.post).toHaveBeenCalledWith(
      '/token?method=local',
      expect.any(URLSearchParams),
      { skipAuthRefresh: true }
    );
  });
});
