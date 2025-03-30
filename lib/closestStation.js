// This is the code that was used to generate the dataset in "stations.js".
// Not intended to be executed in the browser.
function generateStationList() {
    function cleanUpName(name) {
        // Remove "S " or "U " prefix
        name = name.replace(/^(S|U) /, '');
        // Remove "S+U " prefix
        name = name.replace(/^S\+U /, '');
        // Remove ", Bhf" suffix
        name = name.replace(/, Bhf$/, '');
        // Remove ", Hbf" suffix
        name = name.replace(/, Hbf$/, '');

        // If there is a comma in the name, remove everything before the first comma
        const commaIndex = name.indexOf(',');
        if (commaIndex !== -1) {
            name = name.substring(commaIndex + 1).trim();
        }
        // If there is a slash in the name, remove everything after the first slash
        const slashIndex = name.indexOf('/');
        if (slashIndex !== -1) {
            name = name.substring(0, slashIndex).trim();
        }
        return name;
    }

    function queryStationsList() {
        const stations = require('vbb-stations')
        const allStations = stations("all")
        return allStations.map(station => {
            return {
                name: cleanUpName(station.name),
                location: {
                    lat: station.location.latitude,
                    lon: station.location.longitude,
                },
            }
        })
    }

    stationList = queryStationsList()
    stationList.sort((a, b) => a.location.lat - b.location.lat);

    // Save the stations to a JSON file
    const fs = require('fs');
    const path = require('path');
    const filePath = 'stations.json';

    fs.writeFileSync(filePath, JSON.stringify(stationList, null, 2), 'utf-8');
}

function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth radius in meters
    const toRad = (deg) => deg * (Math.PI / 180);

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLon / 2) ** 2;
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
}

export function findClosestStation(targetLat, targetLon, stations) {
    let left = 0, right = stations.length - 1;

    while (left < right) {
        let mid = Math.floor((left + right) / 2);
        if (stations[mid].location.lat < targetLat) {
            left = mid + 1;
        } else {
            right = mid;
        }
    }

    // Define a search window around the closest latitude match
    let bestStation = null, minDist = Infinity;
    for (let i = Math.max(0, left - 10); i < Math.min(stations.length, left + 10); i++) {
        let dist = haversineDistance(targetLat, targetLon, stations[i].location.lat, stations[i].location.lon);
        if (dist < minDist) {
            minDist = dist;
            bestStation = stations[i];
        }
    }

    return { station: bestStation, distance: minDist };
}