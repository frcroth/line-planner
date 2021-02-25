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

        // Create cross station
        if (this.line) {
            this.line.addStation(station);
            station.lines.push(this.line);
            this.line.getLine().addTo(this.map);
            return;
        }

        // Click while drawing line means circle line
        if (this.line && this.line.stations[0] == station) {
            this.line.addStation(station);
            this.line.getLine().addTo(this.map);
            this.finishLine();
            return;
        }

        // Simple click is naming
        station.namePrompt();
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
    static stationId = 0;

    constructor(position, overlay, line) {
        this.id = Station.stationId++;
        this.overlay = overlay;
        this.position = position;
        this.lines = [line];
        this.name = this.getInitialName();
        this.map = document.map;
        overlay.on('click', event => this.map.onStationClick(event, this));
        this.generateMarker();

        document.ui.addStation(this);
    }

    generateMarker() {
        this.marker?.remove();
        this.marker = new L.marker(this.position, { opacity: 0.001 });
        this.marker.bindTooltip(this.name, {permanent: true, className: "station-name", offset: [0.0005, 0] });
        this.marker.addTo(this.map.map);
    }

    getInitialName() {
        // Possible solutions:
        // 1. Create a plausible random name
        // 2. Create a generic name with a number
        // 3. Get a name from the geolocation
        return "Station " + this.id;
    }

    async namePrompt(){
        const { value: name } = await Swal.fire({
            title: 'Enter Station name',
            input: 'text',
            inputPlaceholder: this.name,
            showCancelButton: true,
            inputValidator: (value) => {
                if (!value) {
                    return 'You need to write something!'
                }
            }
        })

        if (name) {
            this.name = name;
            this.generateMarker();
        }
    }

}

class Line {

    static lineId = 0;

    constructor() {
        this.id = Line.lineId++;
        this.stations = []; // First station is start, last is end
        this.polyline = L.polyline([], { color: '#115D91' });
        document.ui.addLine(this);
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


class UI {
    constructor(id) {
        this.container = document.getElementById(id);
        this.lineContainers = {};
        this.stationContainers = {};

        this.lineOverview = document.createElement("div");
        this.lineOverview.classList.add("row");
        this.container.appendChild(this.lineOverview);
    }

    addLine(line) {
        const lineContainer = document.createElement("div");
        const lineDescription = document.createElement("h5");
        lineDescription.innerHTML = "Line " + line.id;
        lineContainer.appendChild(lineDescription);

        lineContainer.classList.add("line", "col");
        this.lineOverview.appendChild(lineContainer);
        this.lineContainers[line.id] = lineContainer;
    }

    addStation(station) {
        const stationContainer = document.createElement("div");
        stationContainer.classList.add("station-container");
        this.stationContainers[station.id] = stationContainer;

        const stationText = document.createElement("p");
        stationText.innerHTML = station.name;
        stationContainer.appendChild(stationText);


        this.lineContainers[station.lines[0].id].appendChild(stationContainer);
    }


}

document.map = new Map();
document.ui = new UI("ui");