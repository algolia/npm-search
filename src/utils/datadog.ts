import agent from 'elastic-apm-node';

import MetricCollector from './MetricCollector';

export const datadog = new MetricCollector(agent);
