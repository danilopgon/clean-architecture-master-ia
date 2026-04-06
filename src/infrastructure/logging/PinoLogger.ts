import pino, { type Logger as PinoInstance, type LoggerOptions } from 'pino';
import type { LogContext, Logger } from '../../application/ports/Logger.js';

export type PinoLoggerOptions = {
  readonly level?: LoggerOptions['level'];
  readonly name?: string;
  readonly prettyPrint?: boolean;
};

export class PinoLogger implements Logger {
  private readonly logger: PinoInstance;

  constructor(options: PinoLoggerOptions = {}, instance?: PinoInstance) {
    if (instance) {
      this.logger = instance;
      return;
    }

    const transport =
      options.prettyPrint === true
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:standard',
              ignore: 'pid,hostname',
            },
          }
        : undefined;

    const loggerOptions: LoggerOptions = {
      level: options.level ?? 'info',
      name: options.name ?? 'app',
      ...(transport !== undefined ? { transport } : {}),
    };

    this.logger = pino(loggerOptions);
  }

  debug(message: string, context: LogContext = {}): void {
    this.logger.debug(context, message);
  }

  info(message: string, context: LogContext = {}): void {
    this.logger.info(context, message);
  }

  warn(message: string, context: LogContext = {}): void {
    this.logger.warn(context, message);
  }

  error(message: string, context: LogContext = {}): void {
    this.logger.error(context, message);
  }

  child(bindings: LogContext): Logger {
    return new PinoLogger({}, this.logger.child(bindings));
  }
}
