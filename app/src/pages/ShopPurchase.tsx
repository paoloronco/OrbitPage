import { useLocation } from 'react-router-dom';
import { getActiveBasePath } from '../lib/base-path';
import ShopSuccessClient from '../components/shop-success-client';
import ShopCustomerClient from '../components/shop-customer-client';

export default function ShopPurchase() {
  const location = useLocation(), query = new URLSearchParams(location.search), basePath = getActiveBasePath();
  if (location.pathname.endsWith('/customer')) return <ShopCustomerClient basePath={basePath} initialAccess={query.get('access') || ''} />;
  const orderId = query.get('order') || '', sessionId = query.get('session_id') || '', token = query.get('token') || '';
  return <ShopSuccessClient basePath={basePath} checkout={orderId && sessionId ? { orderId, sessionId } : undefined} deliveryToken={token} />;
}
