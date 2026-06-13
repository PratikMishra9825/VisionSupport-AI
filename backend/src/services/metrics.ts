import client from 'prom-client';
import os from 'os';

// Create registry
const register = new client.Registry();

// Enable default metrics (CPU, Memory, Event Loop, etc.)
client.collectDefaultMetrics({ register });

// Custom metrics
export const activeSessionsGauge = new client.Gauge({
  name: 'visionsupport_active_sessions',
  help: 'Number of active support calls',
});
register.registerMetric(activeSessionsGauge);

export const connectedUsersGauge = new client.Gauge({
  name: 'visionsupport_connected_users',
  help: 'Number of connected participants in sessions',
});
register.registerMetric(connectedUsersGauge);

export const cpuUsageGauge = new client.Gauge({
  name: 'visionsupport_cpu_usage',
  help: 'Current system CPU usage ratio (0 to 100)',
});
register.registerMetric(cpuUsageGauge);

export const memoryUsageGauge = new client.Gauge({
  name: 'visionsupport_memory_usage_bytes',
  help: 'Current system memory usage in bytes',
});
register.registerMetric(memoryUsageGauge);

export const bitrateGauge = new client.Gauge({
  name: 'visionsupport_bitrate_bps',
  help: 'Aggregated MediaSoup session bitrate in bits per second',
  labelNames: ['sessionId', 'role'],
});
register.registerMetric(bitrateGauge);

export const packetLossGauge = new client.Gauge({
  name: 'visionsupport_packet_loss_ratio',
  help: 'Aggregated MediaSoup packet loss ratio',
  labelNames: ['sessionId', 'role'],
});
register.registerMetric(packetLossGauge);

export const reconnectCounter = new client.Counter({
  name: 'visionsupport_reconnect_attempts_total',
  help: 'Total number of connection re-establishments',
});
register.registerMetric(reconnectCounter);

export const errorsCounter = new client.Counter({
  name: 'visionsupport_application_errors_total',
  help: 'Total number of application runtime errors',
  labelNames: ['type'],
});
register.registerMetric(errorsCounter);

// Helper to regularly scrape host system logs
setInterval(() => {
  // Memory
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  memoryUsageGauge.set(usedMem);

  // Simple load avg CPU calculation
  const loadAvg = os.loadavg()[0]; // 1-minute load average
  const cpuCount = os.cpus().length;
  const cpuRatio = Math.min(100, Math.round((loadAvg / cpuCount) * 100));
  cpuUsageGauge.set(cpuRatio);
}, 5000);

// Export metrics formatted for Prometheus scraping
export const getMetricsText = async (): Promise<string> => {
  return await register.metrics();
};
export const getRegistryContentType = (): string => {
  return register.contentType;
};
export const getLiveSystemTelemetry = () => {
  // Return simple object for dashboard charts endpoint
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const loadAvg = os.loadavg()[0];
  const cpuCount = os.cpus().length;
  const cpuRatio = Math.min(100, Math.round((loadAvg / cpuCount) * 100));

  return {
    cpu: cpuRatio,
    memory: Math.round(usedMem / 1024 / 1024), // MB
    memoryTotal: Math.round(totalMem / 1024 / 1024), // MB
    timestamp: Date.now(),
  };
};
