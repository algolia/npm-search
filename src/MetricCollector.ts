import type { Agent } from 'elastic-apm-node';
import _ from 'lodash';

class MetricCollector {
  private client: Agent;
  private readonly events: { [k: string]: number };
  private readonly timings: { [k: string]: number[] };
  private timingsToClear: Set<string>;

  constructor(client) {
    this.client = client;
    this.events = Object.create(null);
    this.timings = Object.create(null);
    this.timingsToClear = new Set();
  }

  increment (event: string, count: number = 1) {
    this.logEvent(event, count);
    return this;
  }

  gauge (name: string, value: number) {
    if (this.timings[name] === undefined) {
      this.registerTiming(name);
    }

    this.timings[name] = [ value ];
    return this;
  }

  logEvent(event: string, count: number = 1) {
    if (this.events[event] === undefined) {
      this.registerEvent(event);
    }

    this.events[event] += count;
    return this;
  }

  timing (timing: string, duration: number) {
    if (this.timings[timing] === undefined) {
      this.registerTiming(timing);
    }

    if (this.timingsToClear.has(timing)) {
      this.timingsToClear.delete(timing);
      this.timings[timing] = [];
    }

    this.timings[timing]!.push(duration);
    return this;
  }

  private registerEvent(event: string) {
    this.events[event] = 0;

    // istanbul ignore if
    if (this.client.isStarted()) {
      this.client.registerMetric(`npmSearch.${event}`, () => {
        let value = this.events[event];
        this.events[event] = 0;
        return value;
      });
    }
  }

  private registerTiming(timing: string) {
    this.timings[timing] = [];

    // istanbul ignore if
    if (this.client.isStarted()) {
      this.client.registerMetric(`npmSearch.${timing}`, () => {
        this.timingsToClear.add(timing);
        return _.sum(this.timings[timing]) / this.timings[timing]!.length;
      });
    }
  }
}

export default MetricCollector;
