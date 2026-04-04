import { checkHealth } from './src/shared/health';

const healthStatus = checkHealth();
console.log(
  `Health Status: ${healthStatus.status}, Timestamp: ${healthStatus.timestamp}`,
);
