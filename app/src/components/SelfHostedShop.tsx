import ShopClient, { ShopRequestError, type ShopClientProps, type ShopRequest } from './shop-client';
import { shopRequest } from '../lib/api-client';
import { useAppI18n } from '../lib/i18n';
import { publicLocaleSlug } from '../lib/public-routing';

const request: ShopRequest = async <T,>(input: string, init?: RequestInit): Promise<T> => {
  try { return await shopRequest<T>(input, init); }
  catch (reason) {
    const error = reason as Error & { code?: string };
    throw new ShopRequestError(error.message || 'Shop request failed.', error.code);
  }
};
export default function SelfHostedShop(props: Omit<ShopClientProps, 'request' | 'tr' | 'locale' | 'documentationUrl' | 'selfHosted'>) {
  const { tr, locale } = useAppI18n();
  return <div className="orbitpage-selfhosted-shop"><ShopClient {...props} documentationUrl={section => `https://github.com/paoloronco/OrbitPage/blob/main/docs/wiki/dashboard/sections/shop.md#${section}`}
    locale={publicLocaleSlug(locale)} request={request} selfHosted tr={tr} /></div>;
}
