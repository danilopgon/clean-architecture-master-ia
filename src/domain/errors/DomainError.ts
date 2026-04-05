export type DomainErrorCode =
  | 'INVALID_CURRENCY'
  | 'INVALID_MONEY'
  | 'INVALID_QUANTITY'
  | 'INVALID_ID'
  | 'CURRENCY_MISMATCH'
  | 'ORDER_NOT_DRAFT'
  | 'ORDER_EMPTY'
  | 'ITEM_NOT_FOUND';

export interface DomainError {
  readonly code: DomainErrorCode;
  readonly message: string;
}
