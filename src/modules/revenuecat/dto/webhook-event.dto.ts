export interface RevenueCatEvent {
  id?: string;
  type?: string;
  app_user_id?: string;
  original_app_user_id?: string;
  product_id?: string;
  entitlement_ids?: string[];
  /** Deprecated single-entitlement field; kept for older payloads. */
  entitlement_id?: string;
  /** Epoch milliseconds the event fired; used to ignore stale/out-of-order deliveries. */
  event_timestamp_ms?: number;
  [key: string]: unknown;
}

export interface RevenueCatWebhookBody {
  event?: RevenueCatEvent;
  api_version?: string;
}
