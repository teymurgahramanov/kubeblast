import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Box, Typography } from '@mui/material';
import {
  ResponsiveContainer, LineChart, AreaChart,
  Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import axiosInstance from '../utils/axiosInstance';

const POLL_INTERVAL = 5000;

const CHART_COLORS = {
  avg: '#58a6ff',
  p90: '#f0883e',
  p95: '#f778ba',
  p99: '#da3633',
  throughput: '#3fb950',
  errors: '#f85149',
  threads: '#a371f7',
};

const chartContainerSx = {
  bgcolor: 'rgba(255,255,255,0.03)',
  borderRadius: '12px',
  border: '1px solid #21262d',
  p: 2,
  minHeight: 240,
};

const titleSx = {
  color: '#8b949e',
  fontSize: '0.75rem',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  mb: 1.5,
};

const formatTimestamp = (ts) => {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const formatNumber = (v) => {
  if (v == null) return '0';
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return typeof v === 'number' ? v.toFixed(v < 10 ? 1 : 0) : String(v);
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <Box sx={{ bgcolor: '#161b22', border: '1px solid #30363d', borderRadius: '8px', p: 1.5, fontSize: '0.75rem' }}>
      <Typography sx={{ color: '#8b949e', fontSize: '0.7rem', mb: 0.5 }}>{formatTimestamp(label)}</Typography>
      {payload.map((entry, i) => (
        <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: entry.color }}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: entry.color, flexShrink: 0 }} />
          <span>{entry.name}: {formatNumber(entry.value)}</span>
        </Box>
      ))}
    </Box>
  );
};

const LiveMetrics = ({ jobId, jobStatus }) => {
  const [metrics, setMetrics] = useState(null);
  const [error, setError] = useState('');
  const intervalRef = useRef(null);

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await axiosInstance.get(`/metrics/${jobId}`);
      setMetrics(res.data);
      setError('');
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to load metrics');
    }
  }, [jobId]);

  useEffect(() => {
    fetchMetrics();
    if (['running', 'starting'].includes(jobStatus)) {
      intervalRef.current = setInterval(fetchMetrics, POLL_INTERVAL);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchMetrics, jobStatus]);

  if (error) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography sx={{ color: '#f85149', fontSize: '0.85rem' }}>{error}</Typography>
      </Box>
    );
  }

  if (!metrics?.enabled) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography sx={{ color: '#8b949e', fontSize: '0.85rem', fontStyle: 'italic' }}>
          Real-time metrics are not enabled. Enable InfluxDB integration to see live data.
        </Typography>
      </Box>
    );
  }

  const data = metrics?.data || {};
  const hasData = data.timestamps?.length > 0;

  const responseData = (data.timestamps || []).map((ts, i) => ({
    time: ts,
    avg: data.avg_response_time?.[i] ?? 0,
    p90: data.p90_response_time?.[i] ?? 0,
    p95: data.p95_response_time?.[i] ?? 0,
    p99: data.p99_response_time?.[i] ?? 0,
  }));

  const throughputData = (data.throughput_timestamps || []).map((ts, i) => ({
    time: ts,
    throughput: data.throughput?.[i] ?? 0,
  }));

  const errorData = (data.error_timestamps || []).map((ts, i) => ({
    time: ts,
    errors: data.error_count?.[i] ?? 0,
  }));

  const threadsData = (data.threads_timestamps || []).map((ts, i) => ({
    time: ts,
    threads: data.active_threads?.[i] ?? 0,
  }));

  if (!hasData) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography sx={{ color: '#8b949e', fontSize: '0.85rem', fontStyle: 'italic' }}>
          {jobStatus === 'running'
            ? 'Waiting for metrics data...'
            : 'No metrics data available for this job.'}
        </Typography>
      </Box>
    );
  }

  const axisProps = {
    tick: { fill: '#484f58', fontSize: 10 },
    axisLine: { stroke: '#21262d' },
    tickLine: false,
  };

  return (
    <Box sx={{ p: 2, display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
      {/* Response Times */}
      <Box sx={chartContainerSx}>
        <Typography sx={titleSx}>Response Times (ms)</Typography>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={responseData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
            <XAxis dataKey="time" tickFormatter={formatTimestamp} {...axisProps} />
            <YAxis {...axisProps} tickFormatter={formatNumber} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: '0.7rem', color: '#8b949e' }} />
            <Line type="monotone" dataKey="avg" name="Avg" stroke={CHART_COLORS.avg} dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="p90" name="p90" stroke={CHART_COLORS.p90} dot={false} strokeWidth={1.5} />
            <Line type="monotone" dataKey="p95" name="p95" stroke={CHART_COLORS.p95} dot={false} strokeWidth={1.5} />
            <Line type="monotone" dataKey="p99" name="p99" stroke={CHART_COLORS.p99} dot={false} strokeWidth={1.5} />
          </LineChart>
        </ResponsiveContainer>
      </Box>

      {/* Throughput */}
      <Box sx={chartContainerSx}>
        <Typography sx={titleSx}>Throughput (req/s)</Typography>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={throughputData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
            <XAxis dataKey="time" tickFormatter={formatTimestamp} {...axisProps} />
            <YAxis {...axisProps} tickFormatter={formatNumber} />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey="throughput" name="Req/s" stroke={CHART_COLORS.throughput} dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </Box>

      {/* Active Threads */}
      <Box sx={chartContainerSx}>
        <Typography sx={titleSx}>Active Threads</Typography>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={threadsData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
            <XAxis dataKey="time" tickFormatter={formatTimestamp} {...axisProps} />
            <YAxis {...axisProps} tickFormatter={formatNumber} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="threads" name="Threads" stroke={CHART_COLORS.threads} fill={CHART_COLORS.threads} fillOpacity={0.15} strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </Box>

      {/* Errors */}
      <Box sx={chartContainerSx}>
        <Typography sx={titleSx}>Errors</Typography>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={errorData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
            <XAxis dataKey="time" tickFormatter={formatTimestamp} {...axisProps} />
            <YAxis {...axisProps} tickFormatter={formatNumber} />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey="errors" name="Errors" stroke={CHART_COLORS.errors} dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </Box>
    </Box>
  );
};

export default LiveMetrics;
