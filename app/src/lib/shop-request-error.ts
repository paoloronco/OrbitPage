export class ShopRequestError extends Error {
  readonly code: string;

  constructor(message: string, code = "SHOP_REQUEST_FAILED") {
    super(message);
    this.name = "ShopRequestError";
    this.code = code;
  }
}
