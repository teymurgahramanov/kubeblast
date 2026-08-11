import { useEffect, useMemo, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { Api, ExpandMore, Refresh } from '@mui/icons-material';
import { Link } from 'react-router-dom';
import axiosInstance from '../utils/axiosInstance';
import Menuselect from './Menuselect';

const methodColors = {
  get: { bg: '#10b981', text: '#ffffff' },
  post: { bg: '#3b82f6', text: '#ffffff' },
  put: { bg: '#f59e0b', text: '#ffffff' },
};

const visibleOperations = [
  { method: 'post', pathSuffix: '/jobs' },
  { method: 'put', pathSuffix: '/jobs/{job_id}/start' },
  { method: 'get', pathSuffix: '/jobs/{job_id}/status' },
];

const descriptionSx = {
  color: 'var(--text-secondary)',
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
};

const codeBlockSx = {
  m: 0,
  p: 2,
  overflowX: 'auto',
  borderRadius: '8px',
  backgroundColor: 'var(--background-light)',
  border: '1px solid var(--border-color)',
  color: 'var(--text-primary)',
  fontFamily: 'monospace',
  fontSize: '0.78rem',
  lineHeight: 1.6,
  whiteSpace: 'pre',
};

const resolveRef = (spec, ref) => {
  if (!ref?.startsWith('#/')) return null;
  return ref
    .slice(2)
    .split('/')
    .map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'))
    .reduce((current, part) => current?.[part], spec);
};

const resolveObject = (spec, value) => {
  if (!value?.$ref) return value;
  return resolveRef(spec, value.$ref) || value;
};

const schemaType = (spec, rawSchema) => {
  if (!rawSchema) return 'any';
  if (rawSchema.$ref) return rawSchema.$ref.split('/').pop();

  const schema = resolveObject(spec, rawSchema);
  if (schema.type === 'array') return `array<${schemaType(spec, schema.items)}>`;
  if (schema.format) return `${schema.type || 'string'} (${schema.format})`;
  return schema.type || 'object';
};

const SimpleSchema = ({ spec, rawSchema }) => {
  const schema = resolveObject(spec, rawSchema);
  const properties = schema?.properties || {};
  const required = new Set(schema?.required || []);

  if (Object.keys(properties).length === 0) {
    return <Typography variant="body2" sx={descriptionSx}>{schemaType(spec, rawSchema)}</Typography>;
  }

  return (
    <Stack divider={<Divider flexItem />}>
      {Object.entries(properties).map(([name, property]) => (
        <Box
          key={name}
          sx={{
            py: 0.75,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'minmax(140px, 1fr) 1fr auto' },
            gap: { xs: 0.25, sm: 1 },
            alignItems: 'center',
          }}
        >
          <Typography component="code" sx={{ fontFamily: 'monospace', fontSize: '0.82rem', fontWeight: 700 }}>
            {name}
          </Typography>
          <Typography variant="body2" sx={descriptionSx}>{schemaType(spec, property)}</Typography>
          <Chip
            label={required.has(name) ? 'required' : 'optional'}
            size="small"
            variant="outlined"
            color={required.has(name) ? 'error' : 'default'}
            sx={{ justifySelf: { sm: 'end' } }}
          />
        </Box>
      ))}
    </Stack>
  );
};

const buildCurlExample = (baseUrl, method, pathSuffix) => {
  const url = `${baseUrl}${pathSuffix.replace('{job_id}', 'JOB_ID')}`;
  const authorization = '-H "Authorization: Bearer YOUR_PAT"';

  if (method === 'post') {
    return `curl --fail-with-body -X POST ${authorization} -F "file=@test-plan.jmx" "${url}"`;
  }
  if (method === 'put') {
    return `curl --fail-with-body -X PUT ${authorization} "${url}"`;
  }
  return `curl --fail-with-body ${authorization} "${url}"`;
};

const ApiDocs = () => {
  const [spec, setSpec] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [retryCount, setRetryCount] = useState(0);

  const effectiveBaseUrl = useMemo(
    () => String(axiosInstance.defaults?.baseURL || `${window.location.origin}/api/v1`).replace(/\/+$/, ''),
    [],
  );

  useEffect(() => {
    let active = true;

    const fetchSpec = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await axiosInstance.get('/openapi.json');
        if (active) setSpec(response.data);
      } catch (requestError) {
        if (active) {
          const detail = requestError.response?.data?.detail || requestError.message;
          setError(detail ? `Failed to load API documentation: ${detail}` : 'Failed to load API documentation.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchSpec();
    return () => { active = false; };
  }, [retryCount]);

  const endpoints = useMemo(() => {
    if (!spec?.paths) return [];

    return visibleOperations.flatMap(({ method, pathSuffix }) => {
      const entry = Object.entries(spec.paths).find(([path]) => path.endsWith(pathSuffix));
      if (!entry) return [];

      const [path, pathItem] = entry;
      const operation = pathItem[method];
      if (!operation) return [];

      return [{
        ...operation,
        path,
        pathSuffix,
        method: method.toUpperCase(),
        parameters: [...(pathItem.parameters || []), ...(operation.parameters || [])],
      }];
    });
  }, [spec]);

  const renderParameters = (parameters) => {
    if (!parameters?.length) return null;

    return (
      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Parameters</Typography>
        <Paper variant="outlined" sx={{ px: 1.5 }}>
          <Stack divider={<Divider flexItem />}>
            {parameters.map((rawParameter) => {
              const parameter = resolveObject(spec, rawParameter);
              return (
                <Box key={`${parameter.in}-${parameter.name}`} sx={{ py: 0.75, display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Typography component="code" sx={{ fontFamily: 'monospace', fontWeight: 700 }}>{parameter.name}</Typography>
                  <Typography variant="body2" sx={descriptionSx}>{schemaType(spec, parameter.schema)}</Typography>
                  <Chip label={parameter.required ? 'required' : 'optional'} size="small" variant="outlined" />
                </Box>
              );
            })}
          </Stack>
        </Paper>
      </Box>
    );
  };

  const renderRequestBody = (rawRequestBody) => {
    if (!rawRequestBody) return null;
    const requestBody = resolveObject(spec, rawRequestBody);

    return (
      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Request</Typography>
        {Object.entries(requestBody.content || {}).map(([contentType, mediaType]) => (
          <Paper key={contentType} variant="outlined" sx={{ px: 1.5, py: 1 }}>
            <Chip label={contentType} size="small" sx={{ mb: 0.5 }} />
            <SimpleSchema spec={spec} rawSchema={mediaType.schema} />
          </Paper>
        ))}
      </Box>
    );
  };

  const renderResponses = (responses) => {
    if (!responses) return null;

    return (
      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Responses</Typography>
        <Stack spacing={0.75}>
          {Object.entries(responses).map(([code, rawResponse]) => {
            const response = resolveObject(spec, rawResponse);
            const successful = code.startsWith('2');
            return (
              <Paper key={code} variant="outlined" sx={{ px: 1.5, py: 1 }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <Chip label={code} size="small" color={successful ? 'success' : 'default'} />
                  <Typography variant="body2">{response.description || 'No description'}</Typography>
                </Stack>
                {successful && Object.entries(response.content || {}).map(([contentType, mediaType]) => (
                  <Box key={contentType} sx={{ mt: 1 }}>
                    <Typography variant="caption" sx={descriptionSx}>{contentType}</Typography>
                    <SimpleSchema spec={spec} rawSchema={mediaType.schema} />
                  </Box>
                ))}
              </Paper>
            );
          })}
        </Stack>
      </Box>
    );
  };

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ minHeight: '100vh', p: { xs: 2, sm: 4 } }}>
        <Alert
          severity="error"
          action={<Button color="inherit" startIcon={<Refresh />} onClick={() => setRetryCount((count) => count + 1)}>Retry</Button>}
        >
          {error}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Box
        sx={{
          borderBottom: '1px solid var(--border-color)',
          backgroundColor: 'background.paper',
          position: 'sticky',
          top: 0,
          zIndex: 1100,
          px: { xs: 1.5, sm: 3 },
          py: 1,
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
        }}
      >
        <Link to="/jobs" style={{ textDecoration: 'none', justifySelf: 'start' }}>
          <Box component="img" src="/logo.svg" alt="KubeBlast" sx={{ height: 36, width: 'auto', '&:hover': { opacity: 0.8 } }} />
        </Link>
        <Typography variant="h6" sx={{ fontWeight: 600, textAlign: 'center', display: { xs: 'none', sm: 'block' } }}>
          API Documentation
        </Typography>
        <Box sx={{ justifySelf: 'end' }}><Menuselect /></Box>
      </Box>

      <Box sx={{ maxWidth: 900, mx: 'auto', width: '100%', p: { xs: 1.5, sm: 3 } }}>
        <Paper variant="outlined" sx={{ mb: 3, p: { xs: 2, sm: 3 }, borderRadius: '12px' }}>
          <Stack direction="row" spacing={1.5} useFlexGap sx={{ mb: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            <Api sx={{ color: 'var(--primary-color)' }} />
            <Typography variant="h5" sx={{ fontWeight: 700 }}>{spec?.info?.title || 'KubeBlast API'}</Typography>
            <Chip label={`v${spec?.info?.version || 'unknown'}`} size="small" color="primary" />
          </Stack>
          <Typography variant="caption" sx={{ display: 'block', color: 'var(--text-secondary)' }}>API base URL</Typography>
          <Typography component="code" sx={{ display: 'block', fontFamily: 'monospace', overflowWrap: 'anywhere' }}>{effectiveBaseUrl}</Typography>
        </Paper>

        <Alert severity="warning" sx={{ mb: 3 }}>
          <strong>Auto-approve must be enabled for the automation user.</strong>{' '}
          Otherwise new jobs remain <code>pending</code> until a moderator approves them.
        </Alert>

        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>Job automation endpoints</Typography>

        {endpoints.length === 0 && (
          <Alert severity="info">The OpenAPI document does not contain the job automation endpoints.</Alert>
        )}

        {endpoints.map((endpoint, index) => {
          const panelId = `${endpoint.method}-${endpoint.path}-${index}`;
          const methodStyle = methodColors[endpoint.method.toLowerCase()];
          return (
            <Accordion
              key={panelId}
              expanded={expanded[panelId] || false}
              onChange={(_event, isExpanded) => setExpanded((previous) => ({ ...previous, [panelId]: isExpanded }))}
              sx={{
                mb: 1,
                backgroundColor: 'background.paper',
                border: '1px solid var(--border-color)',
                borderRadius: '8px !important',
                '&:before': { display: 'none' },
                boxShadow: 'none',
              }}
            >
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Stack direction="row" spacing={2} sx={{ alignItems: 'center', minWidth: 0 }}>
                  <Chip
                    label={endpoint.method}
                    size="small"
                    sx={{ fontWeight: 700, minWidth: 60, backgroundColor: methodStyle.bg, color: methodStyle.text }}
                  />
                  <Typography sx={{ fontFamily: 'monospace', fontSize: '0.9rem', overflowWrap: 'anywhere' }}>
                    {endpoint.path}
                  </Typography>
                </Stack>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 0 }}>
                {endpoint.summary && <Typography sx={{ fontWeight: 700, mb: 0.5 }}>{endpoint.summary}</Typography>}
                {endpoint.description && <Typography variant="body2" sx={{ ...descriptionSx, mb: 2 }}>{endpoint.description}</Typography>}

                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>curl example</Typography>
                <Box component="pre" sx={{ ...codeBlockSx, mb: 2 }}>
                  {buildCurlExample(effectiveBaseUrl, endpoint.method.toLowerCase(), endpoint.pathSuffix)}
                </Box>

                <Divider />
                {renderParameters(endpoint.parameters)}
                {renderRequestBody(endpoint.requestBody)}
                {renderResponses(endpoint.responses)}
              </AccordionDetails>
            </Accordion>
          );
        })}
      </Box>
    </Box>
  );
};

export default ApiDocs;
