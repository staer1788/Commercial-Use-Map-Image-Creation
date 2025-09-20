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
    html: `<div class="w-4 h-4 bg-red-600 rounded-full border-2 border-white shadow-lg ring-1 ring-red-700"></div>`,
    className: 'selection-marker-icon', // Empty class, styling is via Tailwind in html
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });

  initMap(elementId: string, center: [number, number], zoom: number): void {
    if (this.map) {
      this.map.remove();
    }

    this.map = L.map(elementId, { attributionControl: false }).setView(center, zoom);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(this.map);
    
    L.control.attribution({ position: 'bottomleft' }).addTo(this.map);

    this.stationLayer.addTo(this.map);
    this.busStopLayer.addTo(this.map);

    this.map.on('click', (e: any) => {
      this.updateSelectionMarker(e.latlng);
    });

    // Fix for map rendering issue
    setTimeout(() => {
      if (this.map) {
        this.map.invalidateSize();
      }
    }, 100);
  }

  panTo(lat: number, lon: number, zoom?: number): void {
    if (!this.map) return;
    this.map.setView([lat, lon], zoom || this.map.getZoom());
  }

  clearSelection(): void {
    if (this.selectionMarker) {
      this.map.removeLayer(this.selectionMarker);
      this.selectionMarker = null;
    }
    this.selectedLocation.set(null);
  }

  private updateSelectionMarker(latlng: { lat: number, lng: number }): void {
    this.clearSelection();
    const { lat, lng } = latlng;
    this.selectedLocation.set({ lat, lon: lng });
    this.selectionMarker = L.marker([lat, lng], { icon: this.selectionIcon }).addTo(this.map);
  }

  async toggleStations(show: boolean): Promise<void> {
    this.stationLayer.clearLayers();
    if (show && this.map) {
      const query = `[out:json];(node["railway"="station"](BBOX);way["railway"="station"](BBOX);relation["railway"="station"](BBOX););out center;`;
      const elements = await this.fetchOverpassData(query);
      elements.forEach(element => {
        const pos = element.lat ? { lat: element.lat, lon: element.lon } : element.center;
        if (pos) {
          const stationIcon = L.divIcon({
            html: `<div class="w-3 h-3 bg-blue-600 rounded-full border border-white shadow"></div>`,
            className: 'map-point-icon',
            iconSize: [12, 12],
            iconAnchor: [6, 6],
          });
          L.marker([pos.lat, pos.lon], { icon: stationIcon })
            .bindPopup(element.tags?.name || 'Station')
            .addTo(this.stationLayer);
        }
      });
    }
  }

  async toggleBusStops(show: boolean): Promise<void> {
    this.busStopLayer.clearLayers();
    if (show && this.map) {
      const query = `[out:json];(node["highway"="bus_stop"](BBOX);way["highway"="bus_stop"](BBOX););out center;`;
      const elements = await this.fetchOverpassData(query);
      elements.forEach(element => {
        const pos = element.lat ? { lat: element.lat, lon: element.lon } : element.center;
        if (pos) {
           const busIcon = L.divIcon({
            html: `<div class="w-3 h-3 bg-green-600 rounded-full border border-white shadow"></div>`,
            className: 'map-point-icon',
            iconSize: [12, 12],
            iconAnchor: [6, 6],
          });
          L.marker([pos.lat, pos.lon], { icon: busIcon })
            .bindPopup(element.tags?.name || 'Bus Stop')
            .addTo(this.busStopLayer);
        }
      });
    }
  }

  private async fetchOverpassData(query: string): Promise<OverpassElement[]> {
    if (!this.map) {
      return [];
    }
    const bounds = this.map.getBounds();
    const bbox = `${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()}`;
    const url = `https://overpass-api.de/api/interpreter`;
    const fullQuery = query.replace(/BBOX/g, bbox);

    try {
      const response = await firstValueFrom(
        this.http.post<{ elements: OverpassElement[] }>(url, `data=${encodeURIComponent(fullQuery)}`, {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        })
      );
      return response.elements;
    } catch (error) {
      console.error('Overpass API error:', error);
      return [];
    }
  }
}