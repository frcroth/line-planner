/* global L, Swal*/

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
        this.map = L.map("map", {
            center: [52.511, 13.411],
            zoom: 13
        });

        L.tileLayer(this.tileServerUrl, {
            attribution: "&copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> contributors"
        }).addTo(this.map);

        this.map.on("click", (event) => this.onMapClick(event));
        this.map.on("contextmenu", (event) => this.onMapRightClick(event));
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
            station.lines.push(this.line);
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
            this.line = new Line();
            this.lines.push(this.line);
        }

        let station = new Station(position, this.line);

        this.line.addStation(station);
        document.undoManager.push({ type: "create station", station });
    }
}

class Station {
    constructor(position, line) {
        this.id = Station.stationId++;
        this.map = document.map;
        this.position = position;
        this.name = this.getInitialName();
        this.lines = [line];

        this.createOverlay();
        this.generateMarker();

        document.ui.addStation(this);
    }

    async getStationIcon() {
        if (!this.map.cache.stationIcon) {
            const path = "assets/stations/u-bahn.svg";
            this.map.cache.stationIcon = await ajax(path);
        }
        return this.map.cache.stationIcon;
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

    async createOverlay() {
        let svgElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svgElement.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        svgElement.setAttribute("viewBox", "0 0 200 200");
        let stationIcon = await this.getStationIcon();
        svgElement.innerHTML = stationIcon;
        let svgElementBounds = this.bounds(this.position);
        this.overlay = L.svgOverlay(svgElement, svgElementBounds, { interactive: true });
        this.overlay.on("click", event => this.map.onStationClick(event, this));

        this.overlay.addTo(this.map.map);
    }

    generateMarker() {
        this.marker?.remove();
        this.marker = new L.marker(this.position, { opacity: 0.001 });
        this.marker.bindTooltip(this.name, { permanent: true, className: "station-name", offset: [0.0005, 0] });
        this.marker.addTo(this.map.map);
    }

    getInitialName() {
        // Possible solutions:
        // 1. Create a plausible random name
        // 2. Create a generic name with a number
        // 3. Get a name from the geolocation
        return "Station " + this.id;
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
            this.name = name;
            this.generateMarker();
        }
    }

    remove() {
        this.overlay.remove();

        this.linePositions = {}; // Used to restore the station to the correct position in each line
        this.lines.forEach(line => {
            let stationIndex = line.stations.indexOf(this);
            this.linePositions[line.id] = stationIndex;
            line.stations.splice(stationIndex, 1);
            line.redraw();
        });

        this.marker.remove();
    }

    removeCross(line) {
        let stationIndex = line.stations.indexOf(this);
        line.stations.splice(stationIndex, 1);
        this.lines = this.lines.filter(l => l.id != line.id);
        line.redraw();
    }

    restore() {
        this.overlay.addTo(this.map.map);
        this.lines.forEach(line => {
            line.stations.splice(this.linePositions[line.id], 0, this);
            line.redraw();
        });
        this.generateMarker();
    }

    restoreCross(line, index) {
        this.lines.push(line);
        line.stations.splice(index, 0, this);
        line.redraw();
    }

}
Station.stationId = 0;

class Line {
    constructor() {
        this.id = Line.lineId++;
        this.map = document.map.map;
        this.stations = []; // First station is start, last is end
        this.polyline = L.polyline([], { color: "#115D91" });
        document.ui.addLine(this);
    }

    addStation(station) {
        this.stations.push(station);
        this.redraw();
    }

    get isCircleLine() {
        return this.stations[0] == this.stations[this.stations.length - 1];
    }

    getPolyLine() {
        this.polyline.setLatLngs(this.stations.map(station => station.position));
        return this.polyline;
    }

    redraw() {
        this.getPolyLine().addTo(this.map);
    }
}

function keyPress(e) {
    if (e.keyCode == 90 && e.ctrlKey) {
        document.undoManager.undo();
    }
    if (e.keyCode == 89 && e.ctrlKey) {
        document.undoManager.redo();
    }
}
document.onkeydown = keyPress;

class UndoManager {
    constructor() {
        this.operations = [];
        this.undoOperations = [];
    }

    push(operation) {
        this.operations.push(operation);
    }

    pop() {
        return this.operations.pop();
    }

    revert(operation) {
        if (!operation || !operation.type) {
            return;
        }
        let station = operation.station;
        switch (operation.type) {
        case "create station":
            station.remove();
            break;
        case "cross station":
            station.removeCross(operation.line);
            break;
        case "rename station":
            station.name = operation.old;
            station.generateMarker();
            break;
        case "create circle":
            operation.line.stations.pop();
            operation.line.redraw();
            break;
        }
    }

    undo() {
        if (this.operations.length < 1) {
            return true;
        }
        let previousOperation = this.pop();
        this.revert(previousOperation);
        this.undoOperations.push(previousOperation);
    }

    redo() {
        if (this.undoOperations.length < 1) {
            return;
        }
        let undidOperation = this.undoOperations.pop();
        this.redoOperation(undidOperation);
        this.operations.push(undidOperation);
    }

    redoOperation(operation) {
        if (!operation || !operation.type) {
            return;
        }
        let station = operation.station;
        switch (operation.type) {
        case "create station":
            station.restore();
            break;
        case "cross station":
            station.restoreCross(operation.line, operation.index);
            break;
        case "rename station":
            station.name = operation.new;
            station.generateMarker();
            break;
        case "create circle":
            operation.line.addStation(station);
            operation.line.redraw();
            break;
        }
    }
}

document.undoManager = new UndoManager();

function ajax(url) {
    return new Promise(function (resolve, reject) {
        var xhr = new XMLHttpRequest();
        xhr.onload = function () {
            resolve(this.responseText);
        };
        xhr.onerror = reject;
        xhr.open("GET", url);
        xhr.send();
    });
}
Line.lineId = 0;

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
