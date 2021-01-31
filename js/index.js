class Map {
    constructor() {
        this.init();
    }

    get tileServerUrl() {
        return "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png";
    }

    init() {
        this.map = L.map('map', {
            center: [52.511, 13.411],
            zoom: 13
        });

        L.tileLayer(this.tileServerUrl, {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(this.map);

        this.map.on('click', (event) => this.onMapClick(event));
    }

    onMapClick(event) {
        this.addStation(event.latlng)
    }

    async getStationIcon() {
        const path = "assets/stations/u-bahn.svg"
        let station = await ajax(path);
        return station;
    }

    get stationWidth() {
        return 0.001;
    }

    get stationHeight() {
        return 0.001;
    }

    bounds(position) {
        let corner1 = L.latLng(position.lat-this.stationWidth/2, position.lng-this.stationHeight/2);
        let corner2 = L.latLng(position.lat+this.stationWidth/2, position.lng+this.stationHeight/2);
        return L.latLngBounds(corner1, corner2);
    }

    async addStation(position) {
        let svgElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svgElement.setAttribute('xmlns', "http://www.w3.org/2000/svg");
        svgElement.setAttribute('viewBox', "0 0 200 200");
        let station = await this.getStationIcon();
        svgElement.innerHTML = station;
        let svgElementBounds = this.bounds(position);
        L.svgOverlay(svgElement, svgElementBounds).addTo(this.map);
    }
}


function ajax(url) {
    return new Promise(function (resolve, reject) {
        var xhr = new XMLHttpRequest();
        xhr.onload = function () {
            resolve(this.responseText);
        };
        xhr.onerror = reject;
        xhr.open('GET', url);
        xhr.send();
    });
}

document.map = new Map();