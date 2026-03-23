import { registerPlugin } from '@capacitor/core';

type GooglePlayPurchaseResult = {
  productId: string;
  purchaseToken: string;
  orderId?: string;
  packageName?: string;
  purchaseTime?: number;
  acknowledged?: boolean;
};

type GooglePlayBillingPlugin = {
  purchaseSubscription(options: {
    productId: string;
    offerToken?: string;
  }): Promise<GooglePlayPurchaseResult>;
  exchangeOAuthCode(options: {
    supabaseUrl: string;
    code: string;
    codeVerifier: string;
    redirectUri?: string;
    apiKey: string;
  }): Promise<{ status: number; body: string }>;
  openInSystemBrowser(options: { url: string }): Promise<void>;
};

export const GooglePlayBilling = registerPlugin<GooglePlayBillingPlugin>('GooglePlayBilling');
