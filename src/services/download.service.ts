
import { Injectable } from '@angular/core';

declare const html2canvas: any;

@Injectable({ providedIn: 'root' })
export class DownloadService {

  async captureAndDownload(elementId: string, filename: string): Promise<void> {
    const elementToCapture = document.getElementById(elementId);
    if (!elementToCapture) {
      throw new Error(`Element with id ${elementId} not found.`);
    }

    // Temporarily hide Leaflet controls for a cleaner capture
    const leafletControls = elementToCapture.querySelector('.leaflet-control-container') as HTMLElement | null;
    if (leafletControls) {
      leafletControls.style.display = 'none';
    }

    try {
      const canvas = await html2canvas(elementToCapture, {
        useCORS: true, // For loading map tiles from another domain
        scale: 3, // Increase scale for higher resolution
        logging: false,
        backgroundColor: null, // Use transparent background
      });

      // Restore Leaflet controls after capture
      if (leafletControls) {
        leafletControls.style.display = 'block';
      }

      const imageURL = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = imageURL;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      // Ensure controls are restored even if capture fails
      if (leafletControls) {
        leafletControls.style.display = 'block';
      }
      throw error;
    }
  }
}
