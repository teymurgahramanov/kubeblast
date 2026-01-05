import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Chip, Accordion, AccordionSummary, AccordionDetails,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  CircularProgress, Alert
} from '@mui/material';
import { ExpandMore, Api } from '@mui/icons-material';
import { Link } from 'react-router-dom';
import axiosInstance from "../utils/axiosInstance";
import Menuselect from "./Menuselect";

const methodColors = {
  get: { bg: '#10b981', text: '#ffffff' },
  post: { bg: '#3b82f6', text: '#ffffff' },
  put: { bg: '#f59e0b', text: '#ffffff' },
  delete: { bg: '#ef4444', text: '#ffffff' },
  patch: { bg: '#8b5cf6', text: '#ffffff' }
};

const ApiDocs = () => {
  const [spec, setSpec] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    const fetchSpec = async () => {
      try {
        const response = await axiosInstance.get('/openapi.json');
        setSpec(response.data);
      } catch (err) {
        setError('Failed to load API documentation');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchSpec();
  }, []);

  const handleAccordionChange = (panel) => (event, isExpanded) => {
    setExpanded(prev => ({ ...prev, [panel]: isExpanded }));
  };

  const groupEndpointsByTag = () => {
    if (!spec?.paths) return {};
    
    const groups = {};
    const excludedTags = ['token','oidc','pats'];
    
    Object.entries(spec.paths).forEach(([path, methods]) => {
      Object.entries(methods).forEach(([method, details]) => {
        if (['get', 'post', 'put', 'delete', 'patch'].includes(method)) {
          const tags = details.tags || ['Other'];
          tags.forEach(tag => {
            if (excludedTags.includes(tag.toLowerCase())) return;
            if (!groups[tag]) groups[tag] = [];
            groups[tag].push({
              path,
              method: method.toUpperCase(),
              ...details
            });
          });
        }
      });
    });
    
    return groups;
  };

  const renderParameters = (parameters) => {
    if (!parameters || parameters.length === 0) return null;
    
    return (
      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: 'var(--text-secondary)' }}>
          Parameters
        </Typography>
        <TableContainer sx={{ 
          border: '1px solid var(--border-color)', 
          borderRadius: '8px',
          backgroundColor: 'background.paper'
        }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: 'var(--background-light)' }}>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Location</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Type</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Required</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Description</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {parameters.map((param, idx) => (
                <TableRow key={idx}>
                  <TableCell>
                    <code style={{ 
                      backgroundColor: 'var(--background-light)', 
                      padding: '2px 6px', 
                      borderRadius: '4px',
                      fontSize: '0.8rem'
                    }}>
                      {param.name}
                    </code>
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {param.in}
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.8rem' }}>
                    {param.schema?.type || 'any'}
                  </TableCell>
                  <TableCell>
                    {param.required ? (
                      <Chip label="required" size="small" sx={{ 
                        fontSize: '0.65rem', 
                        height: 20,
                        backgroundColor: '#fecaca',
                        color: '#991b1b'
                      }} />
                    ) : (
                      <Chip label="optional" size="small" sx={{ 
                        fontSize: '0.65rem', 
                        height: 20,
                        backgroundColor: 'var(--background-light)',
                        color: 'var(--text-secondary)'
                      }} />
                    )}
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {param.description || '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    );
  };

  const renderRequestBody = (requestBody) => {
    if (!requestBody) return null;
    
    const content = requestBody.content;
    const contentType = Object.keys(content)[0];
    const schema = content[contentType]?.schema;
    
    if (!schema) return null;

    // Resolve $ref if present
    const resolveRef = (ref) => {
      if (!ref || !spec) return null;
      const parts = ref.replace('#/', '').split('/');
      let result = spec;
      for (const part of parts) {
        result = result?.[part];
      }
      return result;
    };

    const schemaToRender = schema.$ref ? resolveRef(schema.$ref) : schema;
    const properties = schemaToRender?.properties || {};
    const required = schemaToRender?.required || [];

    if (Object.keys(properties).length === 0) return null;

    return (
      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: 'var(--text-secondary)' }}>
          Request Body
          <Chip label={contentType} size="small" sx={{ ml: 1, fontSize: '0.65rem', height: 20 }} />
        </Typography>
        <TableContainer sx={{ 
          border: '1px solid var(--border-color)', 
          borderRadius: '8px',
          backgroundColor: 'background.paper'
        }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: 'var(--background-light)' }}>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Field</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Type</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Required</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Description</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {Object.entries(properties).map(([name, prop]) => (
                <TableRow key={name}>
                  <TableCell>
                    <code style={{ 
                      backgroundColor: 'var(--background-light)', 
                      padding: '2px 6px', 
                      borderRadius: '4px',
                      fontSize: '0.8rem'
                    }}>
                      {name}
                    </code>
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.8rem' }}>
                    {prop.type || (prop.$ref ? prop.$ref.split('/').pop() : 'any')}
                    {prop.format && <span style={{ color: 'var(--text-secondary)' }}> ({prop.format})</span>}
                  </TableCell>
                  <TableCell>
                    {required.includes(name) ? (
                      <Chip label="required" size="small" sx={{ 
                        fontSize: '0.65rem', 
                        height: 20,
                        backgroundColor: '#fecaca',
                        color: '#991b1b'
                      }} />
                    ) : (
                      <Chip label="optional" size="small" sx={{ 
                        fontSize: '0.65rem', 
                        height: 20,
                        backgroundColor: 'var(--background-light)',
                        color: 'var(--text-secondary)'
                      }} />
                    )}
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {prop.description || prop.title || '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    );
  };

  const renderResponses = (responses) => {
    if (!responses) return null;
    
    return (
      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: 'var(--text-secondary)' }}>
          Responses
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {Object.entries(responses).map(([code, details]) => (
            <Chip
              key={code}
              label={`${code} ${details.description || ''}`}
              size="small"
              sx={{
                fontSize: '0.75rem',
                backgroundColor: code.startsWith('2') ? '#d1fae5' : 
                               code.startsWith('4') ? '#fef3c7' : 
                               code.startsWith('5') ? '#fecaca' : 'var(--background-light)',
                color: code.startsWith('2') ? '#065f46' : 
                       code.startsWith('4') ? '#92400e' : 
                       code.startsWith('5') ? '#991b1b' : 'var(--text-primary)'
              }}
            />
          ))}
        </Box>
      </Box>
    );
  };

  const groups = groupEndpointsByTag();

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ p: 4 }}>
          <Alert severity="error">{error}</Alert>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ 
        borderBottom: '1px solid var(--border-color)',
        backgroundColor: 'background.paper',
        position: 'sticky',
        top: 0,
        zIndex: 1100,
        px: 3,
        py: 1,
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center'
      }}>
        <Link to="/jobs" style={{ textDecoration: 'none', justifySelf: 'start' }}>
          <Box
            component="img"
            src="/logo.svg"
            alt="KubeBlast"
            sx={{
              height: 36,
              width: 'auto',
              '&:hover': { opacity: 0.8 }
            }}
          />
        </Link>
        <Typography variant="h6" sx={{ fontWeight: 600, textAlign: 'center' }}>
          API Documentation
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, justifySelf: 'end' }}>
          <Menuselect />
        </Box>
      </Box>

      {/* Content */}
      <Box sx={{ maxWidth: 900, mx: 'auto', width: '100%', p: 3 }}>
        {/* API Info */}
        <Box sx={{ 
          mb: 4, 
          p: 3, 
          backgroundColor: 'background.paper', 
          borderRadius: '12px',
          border: '1px solid var(--border-color)'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
            <Api sx={{ color: 'var(--primary-color)' }} />
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              {spec?.info?.title || 'API'}
            </Typography>
            {spec?.info?.version && (
              <Chip 
                label={`v${spec.info.version}`} 
                size="small" 
                sx={{ 
                  backgroundColor: 'var(--primary-color)', 
                  color: '#fff',
                  fontWeight: 600
                }} 
              />
            )}
          </Box>
          {spec?.info?.description && (
            <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
              {spec.info.description}
            </Typography>
          )}
        </Box>

        {/* Endpoints by Tag */}
        {Object.entries(groups).map(([tag, endpoints]) => (
          <Box key={tag} sx={{ mb: 3 }}>
            <Typography 
              variant="subtitle1" 
              sx={{ 
                fontWeight: 600, 
                mb: 1.5, 
                textTransform: 'capitalize',
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}
            >
              {tag}
              <Chip 
                label={endpoints.length} 
                size="small" 
                sx={{ 
                  fontSize: '0.7rem', 
                  height: 20,
                  backgroundColor: 'var(--background-light)',
                  color: 'var(--text-secondary)'
                }} 
              />
            </Typography>
            
            {endpoints.map((endpoint, idx) => {
              const panelId = `${tag}-${idx}`;
              const methodStyle = methodColors[endpoint.method.toLowerCase()] || { bg: '#6b7280', text: '#fff' };
              
              return (
                <Accordion 
                  key={panelId}
                  expanded={expanded[panelId] || false}
                  onChange={handleAccordionChange(panelId)}
                  sx={{
                    mb: 1,
                    backgroundColor: 'background.paper',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px !important',
                    '&:before': { display: 'none' },
                    boxShadow: 'none',
                    '&.Mui-expanded': {
                      margin: '0 0 8px 0'
                    }
                  }}
                >
                  <AccordionSummary 
                    expandIcon={<ExpandMore />}
                    sx={{
                      '& .MuiAccordionSummary-content': {
                        alignItems: 'center',
                        gap: 2
                      }
                    }}
                  >
                    <Chip 
                      label={endpoint.method}
                      size="small"
                      sx={{
                        fontWeight: 700,
                        fontSize: '0.7rem',
                        minWidth: 60,
                        backgroundColor: methodStyle.bg,
                        color: methodStyle.text
                      }}
                    />
                    <Typography 
                      sx={{ 
                        fontFamily: 'monospace', 
                        fontSize: '0.9rem',
                        color: 'var(--text-primary)'
                      }}
                    >
                      {endpoint.path}
                    </Typography>
                    {endpoint.summary && (
                      <Typography 
                        sx={{ 
                          fontSize: '0.85rem', 
                          color: 'var(--text-secondary)',
                          ml: 'auto',
                          display: { xs: 'none', md: 'block' }
                        }}
                      >
                        {endpoint.summary}
                      </Typography>
                    )}
                  </AccordionSummary>
                  <AccordionDetails sx={{ pt: 0 }}>
                    {endpoint.description && (
                      <Typography 
                        variant="body2" 
                        sx={{ color: 'var(--text-secondary)', mb: 2 }}
                      >
                        {endpoint.description}
                      </Typography>
                    )}
                    
                    {renderParameters(endpoint.parameters)}
                    {renderRequestBody(endpoint.requestBody)}
                    {renderResponses(endpoint.responses)}
                  </AccordionDetails>
                </Accordion>
              );
            })}
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default ApiDocs;

