export class HttpError extends Error {
  constructor(status, message, code = 'REQUEST_ERROR') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function notFound(message = 'Data tidak ditemukan.') {
  return new HttpError(404, message, 'NOT_FOUND');
}
