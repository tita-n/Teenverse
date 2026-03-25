import express from 'express';

const router = express.Router();

const metricsData = {
  totalRequests: 0,
  requestsByEndpoint: {} as Record<string, number>,
  requestsByStatus: {} as Record<string, number>,
  averageResponseTime: 0,
  uptime: process.uptime(),
};

export const metricsMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const start = Date.now();
  
  res.on('finish', () => {
    metricsData.totalRequests++;
    const endpoint = req.path;
    metricsData.requestsByEndpoint[endpoint] = (metricsData.requestsByEndpoint[endpoint] || 0) + 1;
    
    const statusCode = res.statusCode.toString();
    metricsData.requestsByStatus[statusCode] = (metricsData.requestsByStatus[statusCode] || 0) + 1;
    
    const duration = Date.now() - start;
    metricsData.averageResponseTime = (metricsData.averageResponseTime + duration) / 2;
  });
  
  next();
};

router.get('/metrics', (req: express.Request, res: express.Response) => {
  const memUsage = process.memoryUsage();
  
  res.json({
    ...metricsData,
    memory: {
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      rss: Math.round(memUsage.rss / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024),
    },
    process: {
      pid: process.pid,
      uptime: process.uptime(),
      platform: process.platform,
      nodeVersion: process.version,
    },
    timestamp: new Date().toISOString(),
  });
});

router.get('/metrics/prometheus', (req: express.Request, res: express.Response) => {
  const memUsage = process.memoryUsage();
  
  const prometheusOutput = [
    '# HELP teenverse_total_requests Total number of requests',
    '# TYPE teenverse_total_requests counter',
    `teenverse_total_requests ${metricsData.totalRequests}`,
    '',
    '# HELP teenverse_average_response_time Average response time in milliseconds',
    '# TYPE teenverse_average_response_time gauge',
    `teenverse_average_response_time ${metricsData.averageResponseTime}`,
    '',
    '# HELP teenverse_memory_heap_used Heap memory used in MB',
    '# TYPE teenverse_memory_heap_used gauge',
    `teenverse_memory_heap_used ${Math.round(memUsage.heapUsed / 1024 / 1024)}`,
    '',
    '# HELP teenverse_uptime_seconds Process uptime in seconds',
    '# TYPE teenverse_uptime_seconds gauge',
    `teenverse_uptime_seconds ${process.uptime()}`,
    '',
  ].join('\n');
  
  res.set('Content-Type', 'text/plain; charset=utf-8');
  res.send(prometheusOutput);
});

export default router;
