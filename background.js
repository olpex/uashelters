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
    if (!osmResponse.ok) throw new Error(`OSM fetch failed: ${osmResponse.status}`);
    const data = await osmResponse.json();
    const shelters = data.elements
      .filter(element => element.type === 'node' || (element.type === 'way' && element.center))
      .map(element => ({
        id: element.id,
        type: element.type,
        lat: element.lat || element.center.lat,
        lon: element.lon || element.center.lon,
        tags: element.tags || {}
      }));
    console.log('Processed shelters:', shelters);
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