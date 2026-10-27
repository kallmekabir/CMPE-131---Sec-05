export interface ShareLinks {
  url: string;
  deepLink: string;
}

export interface SharingAdapter {
  createLinks(eventId: string): Promise<ShareLinks>;
}

export class AppLinkSharingAdapter implements SharingAdapter {
  constructor(private readonly publicAppUrl: string) {}

  async createLinks(eventId: string): Promise<ShareLinks> {
    return {
      url: `${this.publicAppUrl.replace(/\/$/, '')}/events/${eventId}`,
      deepLink: `spartin://events/${eventId}`,
    };
  }
}
