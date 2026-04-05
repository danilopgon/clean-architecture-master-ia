export type Success<T> = {
  ok: true;
  value: T;
};

export type Failure<E> = {
  ok: false;
  error: E;
};

export type Result<T, E> = Success<T> | Failure<E>;

export const ok = <T>(value: T): Result<T, never> => ({
  ok: true,
  value,
});

export const fail = <E>(error: E): Result<never, E> => ({
  ok: false,
  error,
});
