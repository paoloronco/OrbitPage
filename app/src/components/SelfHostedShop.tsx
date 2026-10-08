import ShopClient, { ShopRequestError, type ShopClientProps, type ShopRequest } from './shop-client';
import { shopRequest } from '../lib/api-client';

const request: ShopRequest = async <T,>(input: string, init?: RequestInit): Promise<T> => {
  try { return await shopRequest<T>(input, init); }
  catch (reason) {
    const error = reason as Error & { code?: string };
    throw new ShopRequestError(error.message || 'Shop request failed.', error.code);
  }
};
export default function SelfHostedShop(props: Omit<ShopClientProps, 'request' | 'documentationUrl' | 'selfHosted'>) {
  return <div className="orbitpage-selfhosted-shop"><ShopClient {...props} documentationUrl={section => `https://github.com/paoloronco/OrbitPage/blob/main/docs/wiki/dashboard/sections/shop.md#${section}`}
    request={request} selfHosted /></div>;
}
