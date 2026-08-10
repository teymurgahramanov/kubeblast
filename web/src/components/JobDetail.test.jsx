import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import axiosInstance from '../utils/axiosInstance';
import JobDetail from './JobDetail';

vi.mock('../utils/axiosInstance', () => ({
  default: {
    defaults: { baseURL: '/api/v1' },
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../utils/auth', () => ({
  getUserRole: () => 'user',
}));

vi.mock('../utils/sse', () => ({
  readSSEStream: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./AppHeader', () => ({
  default: () => <div>Job Detail</div>,
}));

vi.mock('./LiveMetrics', () => ({
  default: () => null,
}));

vi.mock('react-simple-code-editor', () => ({
  default: () => null,
}));

const completedJob = {
  id: 'job-1',
  name: 'Checkout load test',
  owner: 'tester',
  status: 'completed',
  created_at: '2026-08-10T10:00:00Z',
};

function renderJobDetail() {
  return render(
    <MemoryRouter initialEntries={['/jobs/job-1']}>
      <Routes>
        <Route path="/jobs/:jobId" element={<JobDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('JobDetail verdict', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('access_token', 'token');

    const streamReader = {
      read: vi.fn().mockResolvedValue({ done: true }),
      releaseLock: vi.fn(),
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      body: { getReader: () => streamReader },
    }));

    axiosInstance.get.mockImplementation((path) => {
      if (path === '/stats/app') {
        return Promise.resolve({ data: { LICENSE_VALID: false, INFLUXDB_ENABLED: false, TIMEZONE: 'UTC' } });
      }
      if (path === '/jobs/job-1') return Promise.resolve({ data: completedJob });
      if (path === '/jobs/job-1/status') {
        return Promise.resolve({
          data: {
            job_id: 'job-1',
            execution_status: 'completed',
            verdict: 'failed',
            samples_total: 20,
            samples_failed: 5,
            error_rate: 0.25,
            reason: null,
          },
        });
      }
      if (path === '/jobs/job-1/files') return Promise.resolve({ data: '<jmeterTestPlan />' });
      return Promise.reject(new Error(`Unexpected GET ${path}`));
    });
  });

  it('shows status-endpoint verdict details separately from completed execution status', async () => {
    renderJobDetail();

    expect(await screen.findByText('Completed')).toBeInTheDocument();
    expect(await screen.findByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('20 total samples')).toBeInTheDocument();
    expect(screen.getByText('5 failed')).toBeInTheDocument();
    expect(screen.getByText('25% error rate')).toBeInTheDocument();
    expect(axiosInstance.get).toHaveBeenCalledWith('/jobs/job-1/status');
  });
});
