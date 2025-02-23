async function getAddress(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`;
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'UkraineShelterFinder/1.1 (contact: your-email@example.com)' }
    });
    if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
    const data = await response.json();
    const addr = data.address || {};
    const street = addr.road || addr.street || '';
    const houseNumber = addr.house_number || '';
    const city = addr.city || addr.town || addr.village || '';
    const country = addr.country || '';
    let fullAddress = '';
    if (street || houseNumber) {
      fullAddress = `${street}${houseNumber ? ' ' + houseNumber : ''}`;
    }
    if (city) {
      fullAddress += fullAddress ? `, ${city}` : city;
    }
    if (country && fullAddress) {
      fullAddress += `, ${country}`;
    }
    return fullAddress || 'Unknown address';
  } catch (error) {
    console.error('Geocoding error in background:', error);
    return `Address unavailable (Coordinates: ${lat.toFixed(4)}, ${lon.toFixed(4)})`;
  }
}

async function fetchShelterData() {
  const query = `[out:json][timeout:25];
area(3600060199)->.searchArea;
(
  node["amenity"="shelter"](area.searchArea);
  way["amenity"="shelter"](area.searchArea);
  relation["amenity"="shelter"](area.searchArea);
  node["social_facility"="shelter"](area.searchArea);
  way["social_facility"="shelter"](area.searchArea);
  relation["social_facility"="shelter"](area.searchArea);
  node["bunker_type"="bomb_shelter"](area.searchArea);
  way["bunker_type"="bomb_shelter"](area.searchArea);
  relation["bunker_type"="bomb_shelter"](area.searchArea);
);
out body;
>;
out skel qt;`;

  try {
    const osmResponse = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: 'data=' + encodeURIComponent(query)
    });
    const data = await osmResponse.json();
    const shelters = await Promise.all(
      data.elements
        .filter(element => element.type === 'node' || (element.type === 'way' && element.center))
        .map(async element => {
          const lat = element.lat || element.center.lat;
          const lon = element.lon || element.center.lon;
          const address = await getAddress(lat, lon);
          return {
            id: element.id,
            type: element.type,
            lat: lat,
            lon: lon,
            tags: element.tags || {},
            address: address
          };
        })
    );
    console.log('Processed shelters with addresses:', shelters);
    chrome.storage.local.set({ shelters: shelters }, () => {
      console.log('Shelters data saved:', shelters.length);
    });
  } catch (error) {
    console.error('Error fetching shelter data:', error);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  fetchShelterData();
  chrome.alarms.create('refreshShelters', { periodInMinutes: 1440 });
});

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'refreshShelters') {
    fetchShelterData();
  }
});

chrome.action.onClicked.addListener(tab => {
  chrome.tabs.create({ url: chrome.runtime.getURL('map.html') });
});