import { Component, ChangeDetectionStrategy, signal, AfterViewInit, inject, effect, computed } from '@angular/core';
import { MapService } from './services/map.service';
import { GeocodingService } from './services/geocoding.service';
import { DownloadService } from './services/download.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent implements AfterViewInit {
  mapService = inject(MapService);
  private geocodingService = inject(GeocodingService);
  private downloadService = inject(DownloadService);

  // State Signals
  address = signal({ city: '東京都千代田区', town: '丸の内' });
  showStations = signal(false);
  showBusStops = signal(false);
  isLoading = signal(false);
  isDownloading = signal(false);
  isMapDataLoading = signal(false);
  searchError = signal<string | null>(null);
  
  isMapLoading = computed(() => this.isLoading() || this.isMapDataLoading());

  private readonly MAP_ID = 'map';

  constructor() {
    effect(() => {
      this.isMapDataLoading.set(true);
      this.mapService.toggleStations(this.showStations()).finally(() => this.isMapDataLoading.set(false));
    });
    effect(() => {
      this.isMapDataLoading.set(true);
      this.mapService.toggleBusStops(this.showBusStops()).finally(() => this.isMapDataLoading.set(false));
    });
    effect(() => {
      if (this.mapService.selectedLocation()) {
        // When a pin is placed, clear the text search fields as they are no longer relevant
        this.address.set({ city: '', town: '' });
      }
    });
  }

  ngAfterViewInit(): void {
    // Default to Tokyo station
    this.mapService.initMap(this.MAP_ID, [35.681236, 139.767125], 15);
  }

  async searchLocation(): Promise<void> {
    this.isLoading.set(true);
    this.searchError.set(null);
    this.mapService.clearSelection(); // Clear pin when starting a new search
    try {
      const coords = await this.geocodingService.search(this.address().city, this.address().town);
      if (coords) {
        this.mapService.panTo(coords.lat, coords.lon, 16);
      } else {
        this.searchError.set('Location not found. Please try a different address.');
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      this.searchError.set('An error occurred during the search.');
    } finally {
      this.isLoading.set(false);
    }
  }

  updateCity(city: string): void {
    this.address.update(a => ({...a, city }));
  }

  updateTown(town: string): void {
    this.address.update(a => ({...a, town }));
  }

  toggleStations(event: Event): void {
    const isChecked = (event.target as HTMLInputElement).checked;
    this.showStations.set(isChecked);
  }

  toggleBusStops(event: Event): void {
    const isChecked = (event.target as HTMLInputElement).checked;
    this.showBusStops.set(isChecked);
  }

  clearMapSelection(): void {
    this.mapService.clearSelection();
  }

  async downloadMap(): Promise<void> {
    this.isDownloading.set(true);
    try {
      await this.downloadService.captureAndDownload(this.MAP_ID, 'poster-map.png');
    } catch (error) {
      console.error('Failed to download map:', error);
      alert('Could not download the map. Please try again.');
    } finally {
      this.isDownloading.set(false);
    }
  }
}