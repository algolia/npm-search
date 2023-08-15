import MetricCollector from '../MetricCollector';
import agent from 'elastic-apm-node';

export const datadog = new MetricCollector(agent);
