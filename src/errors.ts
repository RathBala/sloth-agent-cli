export class CliError extends Error {
  constructor(
    message: string,
    readonly exitCode: number,
  ) {
    super(message);
  }
}

export class UsageError extends CliError {
  constructor(message: string) {
    super(message, 2);
  }
}

export class ConfigError extends CliError {
  constructor(message: string) {
    super(message, 3);
  }
}

export class ApiError extends CliError {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message, 1);
  }
}
