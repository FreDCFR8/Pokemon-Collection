export type DashboardContentState = 'ready' | 'loading' | 'empty' | 'error';

export type DashboardDestination = '#collection' | '#wishlist' | '#sets' | '#search';

export type DashboardAction = {
  href: DashboardDestination;
  title: string;
  description: string;
  icon: 'collection' | 'wishlist' | 'sets' | 'search';
};
