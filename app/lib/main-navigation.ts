export type MainTabIcon =
  | 'compass'
  | 'map'
  | 'shopping-cart'
  | 'heart'
  | 'plus'
  | 'user'
  | 'store'
  | 'reports';

export interface MainTabConfig {
  path: string;
  labelKey: string;
  icon: MainTabIcon;
}

const regularTabs: MainTabConfig[] = [
  { path: 'explore', labelKey: 'EXPLORE', icon: 'compass' },
  { path: 'map', labelKey: 'MAP', icon: 'map' },
  { path: 'shopping-list', labelKey: 'SHOPPING_LIST', icon: 'shopping-cart' },
  { path: 'favorites', labelKey: 'LIKED_PRODUCTS', icon: 'heart' },
  { path: 'add', labelKey: 'ADD', icon: 'plus' },
  { path: 'profile', labelKey: 'PROFILE', icon: 'user' },
];

const merchantTabs: MainTabConfig[] = [
  { path: 'explore', labelKey: 'EXPLORE', icon: 'compass' },
  { path: 'map', labelKey: 'MAP', icon: 'map' },
  { path: 'favorites', labelKey: 'LIKED_PRODUCTS', icon: 'heart' },
  { path: 'merchant-shop', labelKey: 'MY_SHOP', icon: 'store' },
  { path: 'merchant-reports', labelKey: 'REPORTS', icon: 'reports' },
  { path: 'profile', labelKey: 'PROFILE', icon: 'user' },
];

export function getMainTabConfigs(isMerchant: boolean): MainTabConfig[] {
  return isMerchant ? merchantTabs : regularTabs;
}
