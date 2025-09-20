import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

// Declare Leaflet and its types to be available globally
declare const L: any;

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags: { [key: string]: string };
}

@Injectable({ providedIn: 'root' })
export class MapService {
  private http = inject(HttpClient);
  private map: any;
  private stationLayer = L.layerGroup();
  private busStopLayer = L.layerGroup();
  private selectionMarker: any;

  selectedLocation = signal<{ lat: number; lon: number } | null>(null);

  private selectionIcon = L.divIcon({
    html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-8 h-8 text-red-600 drop-shadow-lg"><path fill-rule="evenodd" d="M12 2.25c-2.429 0-4.757 1.01-6.443 2.843-1.685 1.833-2.557 4.24-2.557 6.75 0 4.293 2.768 8.442 6.002 11.536.19.186.442.29.7.29s.51-.104.7-.29c3.234-3.094 6.002-7.243 6.002-11.536 0-2.51- .872-4.917-2.557-6.75C16.757 3.26 14.429 2.25 12 2.25Zm0 4.5a3.375 3.375 0 1 0 0 6.75 3.375 3.375 0 0 0 0-6.75Z" clip-rule="evenodd" /></svg>`,
    className: 'bg-transparent border-0',
    iconSize: [32, 32],
    iconAnchor: [16, 32]
  });

  private stationIcon = L.divIcon({
    html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6 text-blue-700 drop-shadow-lg"><path fill-rule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm11.378-3.917c-.89-1.423-2.595-1.423-3.486 0l-2.923 4.653a.75.75 0 0 0 .628 1.156h6.852a.75.75 0 0 0 .628-1.156l-2.923-4.653Z" clip-rule="evenodd" /></svg>`,
    className: 'bg-transparent border-0',
    iconSize: [24, 24],
    iconAnchor: [12, 24]
  });

  private busStopIcon = L.divIcon({
    html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 text-green-700 drop-shadow-lg"><path fill-rule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Z" clip-rule="evenodd" /></svg>`,
    className: 'bg-transparent border-0',
    iconSize: [20, 20],
    iconAnchor: [10, 20]
  });

  initMap(elementId: string, center: [number, number], zoom: number): void {
    if (this.map) {
      this.map.remove();
    }
    this.map = L.map(elementId).setView(center, zoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(this.map);

    this.stationLayer.addTo(this.map);
    this.busStopLayer.addTo(this.map);

    this.map.on('click', (e: any) => {
      const { lat, lng } = e.latlng;
      this.updateSelectionMarker(lat, lng);
    });
  }

  panTo(lat: number, lon: number, zoom: number = 16): void {
    this.map.setView([lat, lon], zoom);
  }

  updateSelectionMarker(lat: number, lon: number): void {
    if (this.selectionMarker) {
        this.selectionMarker.remove();
    }
    this.selectionMarker = L.marker([lat, lon], { icon: this.selectionIcon })
        .addTo(this.map)
        .bindPopup(`<b>Selected Location</b><br>Lat: ${lat.toFixed(5)}, Lon: ${lon.toFixed(5)}`);
    
    this.selectedLocation.set({ lat, lon });
  }

  clearSelection(): void {
    if (this.selectionMarker) {
        this.selectionMarker.remove();
        this.selectionMarker = null;
    }
    this.selectedLocation.set(null);
  }

  async toggleStations(visible: boolean): Promise<void> {
    if (!this.map) return;
    this.stationLayer.clearLayers();
    if (visible) {
      const query = this.buildOverpassQuery('["railway"="station"]');
      const data = await this.fetchFromOverpass(query);
      this.addMarkersToLayer(data.elements, this.stationLayer, this.stationIcon, 'station');
    }
  }

  async toggleBusStops(visible: boolean): Promise<void> {
    if (!this.map) return;
    this.busStopLayer.clearLayers();
    if (visible) {
      const query = this.buildOverpassQuery('["highway"="bus_stop"]');
      const data = await this.fetchFromOverpass(query);
      this.addMarkersToLayer(data.elements, this.busStopLayer, this.busStopIcon, 'bus_stop');
    }
  }

  private addMarkersToLayer(elements: OverpassElement[], layer: any, icon: any, type: string): void {
    elements.forEach(el => {
      const lat = el.lat ?? el.center?.lat;
      const lon = el.lon ?? el.center?.lon;
      if (lat && lon) {
        const marker = L.marker([lat, lon], { icon: icon });
        const name = el.tags?.name || `${type.replace('_',' ')} location`;
        marker.bindPopup(`<b>${name}</b>`);
        layer.addLayer(marker);
      }
    });
  }

  private getMapBounds(): string {
    const bounds = this.map.getBounds();
    return `${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()}`;
  }

  private buildOverpassQuery(featureType: string): string {
    const bbox = this.getMapBounds();
    return `[out:json][timeout:25];
      (
        node${featureType}(${bbox});
        way${featureType}(${bbox});
        relation${featureType}(${bbox});
      );
      out center;`;
  }

  private async fetchFromOverpass(query: string): Promise<{ elements: OverpassElement[] }> {
    const overpassUrl = 'https://overpass-api.de/api/interpreter';
    const params = { data: query };
    try {
      return await firstValueFrom(this.http.get<{ elements: OverpassElement[] }>(overpassUrl, { params }));
    } catch (error) {
      console.error('Overpass API error:', error);
      return { elements: [] };
    }
  }
}