import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

vi.mock('./components/Login', () => ({
  default: () => <div>Login page</div>,
}));

describe('App routing', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  it('redirects unauthenticated users to the login page', async () => {
    render(<App />);

    expect(await screen.findByText('Login page')).toBeInTheDocument();
  });
});
