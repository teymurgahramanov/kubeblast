import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import axiosInstance from '../utils/axiosInstance';
import ApiDocs from './ApiDocs';

vi.mock('../utils/axiosInstance', () => ({
  default: {
    defaults: { baseURL: 'https://kubeblast.example/api/v1/' },
    get: vi.fn(),
  },
}));

vi.mock('./Menuselect', () => ({
  default: () => <div>Menu</div>,
}));

const jobSchema = {
  type: 'object',
  required: ['id', 'status'],
  properties: {
    id: { type: 'string', description: 'Job identifier' },
    status: {
      type: 'string',
      enum: ['ready', 'starting', 'running', 'completed', 'failed'],
      description: 'Current job status',
    },
  },
};

const spec = {
  openapi: '3.1.0',
  info: { title: 'KubeBlast API', version: '2.4.0' },
  security: [{ bearerAuth: [] }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer' },
    },
    schemas: { Job: jobSchema },
  },
  paths: {
    '/api/v1/jobs': {
      post: {
        tags: ['jobs'],
        summary: 'Create a job',
        description: 'Upload a JMeter plan.',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['file'],
                properties: {
                  file: { type: 'string', format: 'binary', description: 'JMeter plan' },
                  parameter_files: {
                    type: 'array',
                    items: { type: 'string', format: 'binary' },
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Created job',
            headers: {
              'X-Request-Id': {
                description: 'Request correlation ID',
                schema: { type: 'string' },
              },
            },
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Job' },
                example: { id: '123', status: 'ready' },
              },
            },
          },
        },
      },
    },
    '/api/v1/jobs/{job_id}/start': {
      put: {
        tags: ['jobs'],
        summary: 'Start a ready job',
        parameters: [{ name: 'job_id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 202: { description: 'Start accepted' } },
      },
    },
    '/api/v1/jobs/{job_id}': {
      get: {
        tags: ['jobs'],
        summary: 'Get a job',
        parameters: [{ name: 'job_id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: {
            description: 'Current job',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Job' } } },
          },
        },
      },
    },
    '/api/v1/jobs/{job_id}/status': {
      get: { tags: ['jobs'], summary: 'Get job status', responses: { 200: { description: 'Status and verdict' } } },
    },
    '/api/v1/pats': {
      get: { tags: ['pats'], summary: 'Hidden PAT management', responses: { 200: { description: 'PATs' } } },
    },
  },
};

const renderDocs = () => render(
  <BrowserRouter>
    <ApiDocs />
  </BrowserRouter>,
);

describe('ApiDocs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    axiosInstance.get.mockResolvedValue({ data: spec });
  });

  it('shows only the job creation, start, and status endpoints with the auto-approve requirement', async () => {
    renderDocs();

    expect(await screen.findByText(/Auto-approve must be enabled/)).toBeInTheDocument();
    expect(screen.getByText('https://kubeblast.example/api/v1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /POST.*\/api\/v1\/jobs/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /PUT.*\/api\/v1\/jobs\/\{job_id\}\/start/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /GET.*\/api\/v1\/jobs\/\{job_id\}\/status/ })).toBeInTheDocument();

    expect(screen.queryByText('Authenticate automation with a PAT')).not.toBeInTheDocument();
    expect(screen.queryByText(/End-to-end Bash CI\/CD/)).not.toBeInTheDocument();
    expect(screen.queryByText('/api/v1/jobs/{job_id}')).not.toBeInTheDocument();
    expect(screen.queryByText('/api/v1/pats')).not.toBeInTheDocument();
  });

  it('shows compact request and response fields inside the create-job endpoint', async () => {
    const user = userEvent.setup();
    renderDocs();

    const endpointButton = await screen.findByRole('button', { name: /POST.*\/api\/v1\/jobs/ });
    await user.click(endpointButton);

    const details = endpointButton.closest('.MuiAccordion-root');
    expect(within(details).getByText('Request')).toBeInTheDocument();
    expect(within(details).getByText('multipart/form-data')).toBeInTheDocument();
    const curlExample = within(details).getByText(/curl --fail-with-body/, { selector: 'pre' });
    expect(curlExample).toHaveTextContent('Authorization: Bearer YOUR_PAT');
    expect(curlExample).toHaveTextContent('file=@test-plan.jmx');
    expect(curlExample).toHaveTextContent('https://kubeblast.example/api/v1/jobs');
    expect(within(details).getByText('file')).toBeInTheDocument();
    expect(within(details).getByText('parameter_files')).toBeInTheDocument();
    expect(within(details).getAllByText('required').length).toBeGreaterThan(0);
    expect(within(details).getByText('Responses')).toBeInTheDocument();
    expect(within(details).getByText('Created job')).toBeInTheDocument();
    expect(within(details).getByText('application/json')).toBeInTheDocument();
    expect(within(details).getByText('status')).toBeInTheDocument();
    expect(within(details).queryByText('X-Request-Id')).not.toBeInTheDocument();
  });

  it('shows one-shot curl examples for starting and evaluating a job', async () => {
    const user = userEvent.setup();
    renderDocs();

    const startButton = await screen.findByRole('button', { name: /PUT.*\/api\/v1\/jobs\/\{job_id\}\/start/ });
    await user.click(startButton);
    const startExample = within(startButton.closest('.MuiAccordion-root')).getByText(/curl --fail-with-body/, { selector: 'pre' });
    expect(startExample).toHaveTextContent('-X PUT');
    expect(startExample).toHaveTextContent('https://kubeblast.example/api/v1/jobs/JOB_ID/start');

    const statusButton = screen.getByRole('button', { name: /GET.*\/api\/v1\/jobs\/\{job_id\}\/status/ });
    await user.click(statusButton);
    const statusExample = within(statusButton.closest('.MuiAccordion-root')).getByText(/curl --fail-with-body/, { selector: 'pre' });
    expect(statusExample).toHaveTextContent('Authorization: Bearer YOUR_PAT');
    expect(statusExample).toHaveTextContent('https://kubeblast.example/api/v1/jobs/JOB_ID/status');
  });

  it('shows the OpenAPI load error detail and supports retrying', async () => {
    const user = userEvent.setup();
    axiosInstance.get
      .mockRejectedValueOnce({ response: { data: { detail: 'OpenAPI is unavailable' } } })
      .mockResolvedValueOnce({ data: spec });
    renderDocs();

    expect(await screen.findByText('Failed to load API documentation: OpenAPI is unavailable')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText(/Auto-approve must be enabled/)).toBeInTheDocument();
    expect(axiosInstance.get).toHaveBeenCalledTimes(2);
  });
});
