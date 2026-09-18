import { AsyncLocalStorage } from 'async_hooks';
import { Request, Response, NextFunction } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { RuntimeTraceEntry } from '../../graph-builder/src/types';

export interface RequestStore {
  traceId: string;
  timestamp: string;
  method: string;
  path: string;
  route: string;
  startTime: number;
  dbCalls: Array<{
    callName: string;
    timestamp: string;
    durationMs?: number;
    meta?: any;
  }>;
}

export class RuntimeAgent {
  private static asyncLocalStorage = new AsyncLocalStorage<RequestStore>();
  private static traces: RuntimeTraceEntry[] = [];
  private static outputPath: string = './runtime-trace.json';

  public static initialize(options: { outputPath?: string } = {}) {
    if (options.outputPath) {
      this.outputPath = options.outputPath;
    }
    this.traces = [];
  }

  public static getMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const traceId = (req.headers['x-request-id'] as string) || `trace_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const startTime = Date.now();

      const store: RequestStore = {
        traceId,
        timestamp: new Date().toISOString(),
        method: req.method,
        path: req.path || req.url,
        route: req.baseUrl ? `${req.baseUrl}${req.route?.path || req.path}` : (req.route?.path || req.path),
        startTime,
        dbCalls: []
      };

      this.asyncLocalStorage.run(store, () => {
        // Intercept response finish to capture trace
        res.on('finish', () => {
          const durationMs = Date.now() - startTime;
          const currentStore = this.asyncLocalStorage.getStore() || store;

          const traceEntry: RuntimeTraceEntry = {
            traceId: currentStore.traceId,
            timestamp: currentStore.timestamp,
            method: currentStore.method,
            route: currentStore.route,
            path: currentStore.path,
            statusCode: res.statusCode,
            durationMs,
            dbCalls: currentStore.dbCalls
          };

          this.traces.push(traceEntry);
          this.flushTraces();
        });

        next();
      });
    };
  }

  /**
   * DB Call wrapper for database drivers/ORMs
   */
  public static traceDbCall(callName: string, meta: any = {}) {
    const store = this.asyncLocalStorage.getStore();
    if (store) {
      store.dbCalls.push({
        callName,
        timestamp: new Date().toISOString(),
        durationMs: 5,
        meta
      });
    }
  }

  /**
   * Wrap any async database function to automatically trace its invocation
   */
  public static wrapDbFunction<T extends (...args: any[]) => Promise<any>>(callName: string, fn: T): T {
    return (async (...args: any[]) => {
      const startTime = Date.now();
      try {
        const result = await fn(...args);
        const durationMs = Date.now() - startTime;
        const store = RuntimeAgent.asyncLocalStorage.getStore();
        if (store) {
          store.dbCalls.push({
            callName,
            timestamp: new Date().toISOString(),
            durationMs,
            meta: { argsCount: args.length }
          });
        }
        return result;
      } catch (err) {
        const durationMs = Date.now() - startTime;
        const store = RuntimeAgent.asyncLocalStorage.getStore();
        if (store) {
          store.dbCalls.push({
            callName,
            timestamp: new Date().toISOString(),
            durationMs,
            meta: { error: (err as any)?.message }
          });
        }
        throw err;
      }
    }) as T;
  }

  public static getTraces(): RuntimeTraceEntry[] {
    return [...this.traces];
  }

  public static flushTraces() {
    try {
      const dir = path.dirname(this.outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.outputPath, JSON.stringify(this.traces, null, 2), 'utf-8');
    } catch (e) {
      // Ignore in background
    }
  }

  public static loadTraces(filePath?: string): RuntimeTraceEntry[] {
    const target = filePath || this.outputPath;
    if (fs.existsSync(target)) {
      try {
        const raw = fs.readFileSync(target, 'utf-8');
        return JSON.parse(raw);
      } catch (e) {
        return [];
      }
    }
    return [];
  }
}
