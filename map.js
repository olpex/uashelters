document.addEventListener('DOMContentLoaded', () => {
  const map = L.map('map');
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  const redDropIcon = L.icon({
    iconUrl: 'red-drop.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    shadowSize: [41, 41]
  });

  const blueDropIcon = L.icon({
    iconUrl: 'blue-drop.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    shadowSize: [41, 41]
  });

  function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // Add geocoding function
  async function getAddress(lat, lon) {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'UkraineShelterFinder/1.3',
            'Accept-Language': 'uk,en'
          }
        }
      );

      if (!response.ok) throw new Error('Geocoding failed');
      const data = await response.json();
      
      const addr = data.address || {};
      const parts = [];
      
      if (addr.road || addr.street) {
        parts.push(addr.road || addr.street);
        if (addr.house_number) {
          parts.push(addr.house_number);
        }
      }
      if (addr.city || addr.town || addr.village) {
        parts.push(addr.city || addr.town || addr.village);
      }
      
      return parts.join(', ') || `Coordinates: ${lat.toFixed(6)}, ${lon.toFixed(6)}`;
    } catch (error) {
      console.error('Geocoding error:', error);
      return `Coordinates: ${lat.toFixed(6)}, ${lon.toFixed(6)}`;
    }
  }

  function updateMap(userLat, userLon) {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('map').style.display = 'block';
    document.getElementById('gpsButton').style.display = 'block';

    map.setView([userLat, userLon], 14);
    L.marker([userLat, userLon], { icon: blueDropIcon }).addTo(map)
      .bindPopup('Your Location').openPopup();

    chrome.storage.local.get('shelters', async data => {
      console.log('Stored shelters:', data.shelters);
      if (data.shelters && data.shelters.length > 0) {
        const radius = 50;
        const nearbyShelters = data.shelters.filter(shelter => {
          const distance = getDistance(userLat, userLon, shelter.lat, shelter.lon);
          console.log(`Shelter ${shelter.id}: Distance ${distance.toFixed(2)} km, Address: ${shelter.address}`);
          return distance <= radius;
        });
        console.log('Nearby shelters:', nearbyShelters);

        if (nearbyShelters.length > 0) {
          for (const shelter of nearbyShelters) {
            try {
              // Get address for each shelter
              const address = await getAddress(shelter.lat, shelter.lon);
              const marker = L.marker([shelter.lat, shelter.lon], { icon: redDropIcon }).addTo(map);
              
              let popupContent = `<b>Address:</b> ${address}<br>`;
              if (shelter.tags.bunker_type === 'bomb_shelter') {
                popupContent += 'Type: Bomb Shelter<br>';
              } else if (shelter.tags.social_facility === 'shelter') {
                popupContent += 'Type: Social Shelter<br>';
              } else {
                popupContent += 'Type: Shelter<br>';
              }
              if (shelter.tags.name) {
                popupContent += `<b>Name:</b> ${shelter.tags.name}<br>`;
              }
              popupContent += `ID: ${shelter.id}`;
              
              marker.bindPopup(popupContent);
              
              // Add delay between requests to avoid rate limiting
              await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
              console.error('Error processing shelter:', error);
            }
          }
        } else {
          alert('No shelters found within 50 km of your location.');
        }
      } else {
        alert('No shelter data available. Please try again later.');
      }
    });
  }

  navigator.geolocation.getCurrentPosition(
    position => {
      const userLat = position.coords.latitude;
      const userLon = position.coords.longitude;
      console.log('Initial location:', userLat, userLon, 'Accuracy:', position.coords.accuracy);
      updateMap(userLat, userLon);
    },
    error => {
      document.getElementById('loading').innerText = 'Failed to get your location. Please enable location services.';
      console.error('Initial geolocation error:', error);
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );

  document.getElementById('gpsButton').addEventListener('click', () => {
    document.getElementById('loading').style.display = 'block';
    document.getElementById('map').style.display = 'none';
    document.getElementById('gpsButton').style.display = 'none';

    navigator.geolocation.getCurrentPosition(
      position => {
        const userLat = position.coords.latitude;
        const userLon = position.coords.longitude;
        console.log('Refined location:', userLat, userLon, 'Accuracy:', position.coords.accuracy);
        map.eachLayer(layer => { if (layer instanceof L.Marker) map.removeLayer(layer); });
        updateMap(userLat, userLon);
      },
      error => {
        document.getElementById('loading').innerText = 'Failed to refine location. Try again.';
        document.getElementById('map').style.display = 'block';
        document.getElementById('gpsButton').style.display = 'block';
        console.error('Refine geolocation error:', error);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
});