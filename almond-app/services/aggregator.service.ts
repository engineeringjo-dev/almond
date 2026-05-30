import { config } from '@/constants/config';

/**
 * Delivery aggregator interface (Talabat/Careem/Jahez). Per section 0.3 we
 * build ONLY the service interface; implementation is deferred. In-app delivery
 * actually redirects externally (section 7.4), so this is a forward-looking stub.
 */
export interface AggregatorService {
  getRedirectUrl(): string;
  // TODO: aggregator — push order to a specific aggregator's API.
  pushOrder(orderId: string, aggregator: 'talabat' | 'careem' | 'jahez'): Promise<void>;
}

export const aggregatorService: AggregatorService = {
  getRedirectUrl: () => config.DELIVERY_REDIRECT_URL,
  pushOrder: async () => {
    // TODO: aggregator — not implemented in MVP.
  },
};
