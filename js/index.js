class Map {
    constructor() {
        this.init();
        this.cache = {};
        this.lines = [];
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
        this.map.on('contextmenu', (event) => this.onMapRightClick(event));
    }

    onMapClick(event) {
        this.addStation(event.latlng);
    }

    onMapRightClick(event) {
        this.finishLine();
    }

    onStationClick(event, station) {
        L.DomEvent.stopPropagation(event);

        // Simple click is naming
        //TODO

        // Click while drawing line means circle line
        if (this.line.stations[0] == station) {
            this.line.addStation(station);
            this.line.getLine().addTo(this.map);
            this.finishLine();
        }
    }

    finishLine() {
        this.line = undefined;
    }

    async getStationIcon() {
        if (!this.cache.stationIcon) {
            const path = "assets/stations/u-bahn.svg";
            this.cache.stationIcon = await ajax(path);
        }
        return this.cache.stationIcon;
    }

    get stationWidth() {
        return 0.001;
    }

    get stationHeight() {
        return 0.001;
    }

    bounds(position) {
        let corner1 = L.latLng(position.lat - this.stationWidth / 2, position.lng - this.stationHeight / 2);
        let corner2 = L.latLng(position.lat + this.stationWidth / 2, position.lng + this.stationHeight / 2);
        return L.latLngBounds(corner1, corner2);
    }

    async addStation(position) {
        if (!this.line) {
            this.line = new Line();
            this.lines.push(this.line);
        }

        let svgElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svgElement.setAttribute('xmlns', "http://www.w3.org/2000/svg");
        svgElement.setAttribute('viewBox', "0 0 200 200");
        let station = await this.getStationIcon();
        svgElement.innerHTML = station;
        let svgElementBounds = this.bounds(position);
        let svgOverlay = L.svgOverlay(svgElement, svgElementBounds, { interactive: true })
        this.line.addStation(new Station(position, svgOverlay, this.line));
        svgOverlay.addTo(this.map);
        this.line.getLine().addTo(this.map);
    }
}

class Station {
    constructor(position, overlay, line) {
        this.overlay = overlay;
        this.position = position;
        this.lines = [line];
        this.map = document.map;
        overlay.on('click', (event) => this.map.onStationClick(event, this));
    }

}

class Line {
    constructor() {
        this.stations = []; // First station is start, last is end
        this.polyline = L.polyline([], { color: '#115D91' });
    }

    addStation(station) {
        this.stations.push(station);
    }

    get isCircleLine() {
        return this.stations[0] == this.stations[this.stations.length - 1];
    }

    getLine() {
        this.polyline.setLatLngs(this.stations.map(station => station.position));
        return this.polyline;
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
