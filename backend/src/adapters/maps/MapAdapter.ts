export interface MapLinks {
  mapUrl: string;
  navigationUrl: string;
}

export interface MapAdapter {
  getLinks(location: string): Promise<MapLinks>;
}

/** Builds public Google Maps URLs; needs no API key and makes no network calls. */
export class GoogleMapsLinkAdapter implements MapAdapter {
  async getLinks(location: string): Promise<MapLinks> {
    const q = encodeURIComponent(location);
    return {
      mapUrl: `https://www.google.com/maps/search/?api=1&query=${q}`,
      navigationUrl: `https://www.google.com/maps/dir/?api=1&destination=${q}`,
    };
  }
}
