import { AxiosError } from 'axios';

export interface TeamUpError {
  code: string;
  message: string;
  details?: any;
}

export class TeamUpAPIError extends Error {
  public code: string;
  public statusCode?: number;
  public details?: any;

  constructor(message: string, code: string, statusCode?: number, details?: any) {
    super(message);
    this.name = 'TeamUpAPIError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }

  static fromAxiosError(error: AxiosError): TeamUpAPIError {
    if (error.response) {
      const data = error.response.data as any;
      return new TeamUpAPIError(
        data.message || error.message,
        data.code || 'API_ERROR',
        error.response.status,
        data
      );
    } else if (error.request) {
      return new TeamUpAPIError(
        'No response received from TeamUp API',
        'NO_RESPONSE',
        undefined,
        { request: error.request }
      );
    } else {
      return new TeamUpAPIError(
        error.message,
        'REQUEST_ERROR',
        undefined,
        { error: error.message }
      );
    }
  }
}

export function handleAPIError(error: any): TeamUpAPIError {
  if (error instanceof TeamUpAPIError) {
    return error;
  } else if (error instanceof AxiosError) {
    return TeamUpAPIError.fromAxiosError(error);
  } else {
    return new TeamUpAPIError(
      error.message || 'Unknown error',
      'UNKNOWN_ERROR',
      undefined,
      error
    );
  }
}