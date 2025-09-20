
import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

interface NominatimResponse {
  lat: string;
  lon: string;
  display_name: string;
}

@Injectable({ providedIn: 'root' })
export class GeocodingService {
  private http = inject(HttpClient);
  private readonly nominatimUrl = 'https://nominatim.openstreetmap.org/search';

  async search(city: string, town: string): Promise<{ lat: number; lon: number } | null> {
    const query = `${town}, ${city}, Japan`;
    const params = {
      q: query,
      format: 'json',
      limit: '1',
      'accept-language': 'ja',
    };

    try {
      const results = await firstValueFrom(this.http.get<NominatimResponse[]>(this.nominatimUrl, { params }));
      if (results && results.length > 0) {
        const { lat, lon } = results[0];
        return { lat: parseFloat(lat), lon: parseFloat(lon) };
      }
      return null;
    } catch (error) {
      console.error('Nominatim API error:', error);
      throw error;
    }
  }
}
