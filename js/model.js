/* global L, Swal*/
import { ajax } from "./utilities.js";

class Map {
    constructor() {
        this.init();
        this.cache = {};
        this.lines = [];
        this.currentLineType = this.lineTypes["u"];
    }

    get tileServerUrl() {
        return "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png";
    }

    init() {
        this.Lmap = L.map("map", {
            center: [52.511, 13.411],
            zoom: 13
        });

        L.tileLayer(this.tileServerUrl, {
            attribution: "&copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> contributors"
        }).addTo(this.Lmap);

        this.Lmap.on("click", (event) => this.onMapClick(event));
        this.Lmap.on("contextmenu", (event) => this.onMapRightClick(event));
    }

    get lineTypes() {
        return {
            u : {
                id : "u",
                name : "U-Bahn",
                icon: "assets/u/station.svg",
                color: "#115D91",
                lineNamePrefix: "U"
            },
            s : {
                id : "s",
                name : "S-Bahn",
                icon : "assets/s/station.svg",
                color: "#008e4e",
                lineNamePrefix : "S"
            }
        };
    }

    selectLineType(lineType){
        this.currentLineType = this.lineTypes[lineType];
        this.finishLine();
    }

    onMapClick(event) {
        this.addNewStation(event.latlng);
    }

    onMapRightClick() {
        this.finishLine();
    }

    onStationClick(event, station) {
        L.DomEvent.stopPropagation(event);

        // Click while drawing line means circle line
        if (this.line && this.line.stations[0] == station) {
            this.line.addStation(station);
            this.line.redraw();
            document.undoManager.push({ type: "create circle", station, line: this.line });
            this.finishLine();
            return;
        }

        // Create cross station
        if (this.line) {
            if (station.lines.includes(this.line)) {
                return; // Do not cross the station with itself!
            }
            this.line.addStation(station);
            station.addCross(this.line);
            this.line.redraw();
            document.undoManager.push({ type: "cross station", station, line: this.line, index: this.line.stations.length - 1 });
            return;
        }

        // Simple click is naming
        station.namePrompt();
    }

    finishLine() {
        this.line = undefined;
    }

    async addNewStation(position) {
        if (!this.line) {
            this.line = new Line(this.currentLineType);
            this.lines.push(this.line);
        }

        let station = new Station(position, this.line);

        document.undoManager.push({ type: "create station", station });
    }
}

class Station {
    constructor(position, line) {
        this.id = Station.stationId++;
        this.map = document.map;
        this.position = position;
        this.name = this.getInitialName();
        line.addStation(this);
        this.lines = [line];

        this.createOverlay();
        this.generateMarker();

        document.ui.build();
    }

    get primaryLineType() {
        return this.lines[0].lineType;
    }

    async getStationIcon() {
        if (!this.map.cache[this.primaryLineType.id]) {
            const path = this.primaryLineType.icon;
            this.map.cache[this.primaryLineType.id] = await ajax(path);
        }
        return this.map.cache[this.primaryLineType.id];
    }

    bounds() {
        let corner1 = L.latLng(this.position.lat - this.stationWidth / 2, this.position.lng - this.stationHeight / 2);
        let corner2 = L.latLng(this.position.lat + this.stationWidth / 2, this.position.lng + this.stationHeight / 2);
        return L.latLngBounds(corner1, corner2);
    }

    get stationWidth() {
        return 0.001;
    }

    get stationHeight() {
        return 0.001;
    }

    async createOverlay(crossing = false) {
        let svgElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svgElement.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        svgElement.setAttribute("viewBox", "0 0 200 200");

        let stationIcon = crossing ? await this.getCrossingStationIcon() : await this.getStationIcon();

        svgElement.innerHTML = stationIcon;
        let svgElementBounds = this.bounds();
        this.overlay = L.svgOverlay(svgElement, svgElementBounds, { interactive: true });
        this.overlay.on("click", event => this.map.onStationClick(event, this));

        this.overlay.addTo(this.map.Lmap);
    }

    generateMarker() {
        this.marker?.remove();
        this.marker = new L.marker(this.position, { opacity: 0.001 });
        this.marker.bindTooltip(this.name, { permanent: true, className: "station-name", offset: [0.0005, 0] });
        this.marker.addTo(this.map.Lmap);
    }

    async getCrossingStationIcon() {
        if (!this.map.cache.crossing) {
            const path = "assets/misc/crossing.svg";
            this.map.cache.crossing = await ajax(path);
        }
        return this.map.cache.crossing;
    }

    get isCross() {
        return this.lines.length > 1;
    }

    async addCross(line) {
        this.lines.push(line);
        if(line.lineType.id !== this.primaryLineType.id){
            this.overlay.remove();
            this.createOverlay(true);
        }
    }

    getInitialName() {
        // Possible solutions:
        // 1. Create a plausible random name
        // 2. Create a generic name with a number
        // 3. Get a name from the geolocation
        return "Station " + this.id;
    }


    setName(name) {
        this.name = name;
        this.generateMarker();
        document.ui.build();
    }

    async namePrompt() {
        const { value: name } = await Swal.fire({
            title: "Enter Station name",
            input: "text",
            inputPlaceholder: this.name,
            showCancelButton: true,
            inputValidator: (value) => {
                if (!value) {
                    return "You need to write something!";
                }
            }
        });

        if (name) {
            document.undoManager.push({ type: "rename station", station: this, old: this.name, new: name });
            this.setName(name);

        }
    }

    remove() {
        this.overlay.remove();
        this.linePositions = {}; // Used to restore the station to the correct position in each line
        this.lines.forEach(line => {
            this.linePositions[line.id] = line.stations.indexOf(this);
            line.removeStation(this);
        });
        this.marker.remove();
    }

    removeCross(line) {
        line.removeStation(this);
        this.lines = this.lines.filter(l => l.id != line.id);
        line.redraw();
    }

    restore() {
        this.overlay.addTo(this.map.Lmap);
        this.lines.forEach(line => line.addStationAtIndex(this, this.linePositions[line.id]));
        this.generateMarker();
    }

    restoreCross(line, index) {
        this.lines.push(line);
        line.addStationAtIndex(this, index);
    }

}
Station.stationId = 1;

class Line {
    constructor(lineType) {
        this.id = Line.lineId++;
        this.map = document.map;
        this.stations = []; // First station is start, last is end
        this.lineType = lineType;
        this.name = this.initialName;
        this.polyline = L.polyline([], { color: this.lineType.color });
        
        document.ui.build();
    }

    addStation(station) {
        this.addStationAtIndex(station, this.stations.length);
    }

    addStationAtIndex(station, index) {
        this.stations.splice(index, 0, station);
        this.redraw();
    }

    removeStation(station) {
        let stationIndex = this.stations.indexOf(station);
        this.removeStationByIndex(stationIndex);
    }

    removeStationByIndex(index) {
        this.stations.splice(index, 1);
        this.redraw();
    }

    get isCircleLine() {
        return this.stations[0] == this.stations[this.stations.length - 1];
    }

    getPolyLine() {
        this.polyline.setLatLngs(this.stations.map(station => station.position));
        return this.polyline;
    }

    get initialName() {
        return `${this.lineType.lineNamePrefix} ${this.id}`;
    }

    async namePrompt() {
        const { value: name } = await Swal.fire({
            title: "Enter Line name",
            input: "text",
            inputPlaceholder: this.name,
            showCancelButton: true,
            inputValidator: (value) => {
                if (!value) {
                    return "You need to write something!";
                }
            }
        });

        if (name) {
            document.undoManager.push({ type: "rename line", line: this, old: this.name, new: name });
            this.setName(name);
        }
    }

    setName(name) {
        this.name = name;
        document.ui.build();
    }

    remove() {
        this.previousStations = this.stations.slice();
        const stationCount = this.stations.length;
        for(let i=0; i<stationCount; i++){
            this.stations[0].remove();
        }
        if(this.map.line == this){
            this.map.finishLine();
        }
        document.ui.build();
    }

    restore() {
        this.previousStations.forEach(station => station.restore());
    }

    redraw() {
        this.getPolyLine().addTo(this.map.Lmap);
    }
}

Line.lineId = 1;

document.map = new Map();
