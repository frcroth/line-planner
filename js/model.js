/* global L, Swal*/
import { ajax } from "./utilities.js";

class Map {
    constructor() {
        this.init();
        this.cache = {};
        this.lines = [];
        this.currentLineType = this.lineTypes["u"];
        this._initialized = true;
        this.showControlPoints = true;
    }

    get tileServerUrl() {
        return "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png";
    }

    readCenter() {
        let center = localStorage.getItem("map-center");
        if (!center) {
            return [52.511, 13.411]; // Default: Berlin
        }

        return [Number.parseFloat(center.split("(")[1].split(",")[0]),
            Number.parseFloat(center.split(" ")[1].split(")")[0])];
    }


    init() {
        this.Lmap = L.map("map", {
            center: this.readCenter(),
            zoom: 13
        });

        L.tileLayer(this.tileServerUrl, {
            attribution: "&copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> contributors"
        }).addTo(this.Lmap);

        this.Lmap.on("click", (event) => this.onMapClick(event));
        this.Lmap.on("contextmenu", (event) => this.onMapRightClick(event));
        this.Lmap.on("moveend", () => this.onMapMove());
    }

    get lineTypes() {
        return {
            u: {
                id: "u",
                name: "U-Bahn",
                icon: "assets/u/station.svg",
                color: "#115D91",
                lineNamePrefix: "U"
            },
            s: {
                id: "s",
                name: "S-Bahn",
                icon: "assets/s/station.svg",
                color: "#008e4e",
                lineNamePrefix: "S"
            }
        };
    }

    selectLineType(lineType) {
        this.currentLineType = this.lineTypes[lineType];
        this.finishLine();
    }

    onMapMove() {
        if (this._initialized) {
            localStorage.setItem("map-center", this.Lmap.getCenter());
        }
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

    get stations() {
        let stations = [];
        this.lines.forEach(line => line.stations.forEach(station => {
            if (!stations.some(s => s.id == station.id) && station) {
                stations.push(station);
            }
        }));
        return stations;
    }

    export() {
        let serialization = { stations: [], lines: [] };

        this.stations.forEach(station =>
            serialization.stations.push({
                id: station.id,
                position: station.position,
                name: station.name,
                lines: station.lines.map(l => l.id)
            })
        );

        this.lines.forEach(line =>
            serialization.lines.push({
                id: line.id,
                stations: line.stations.map(s => s.id),
                lineType: line.lineType.id,
                controlPoints: line.controlPoints.map(c => c.position),
                name: line.name
            })
        );

        return JSON.stringify(serialization);
    }

    getLineById(id) {
        return this.lines.find(line => line.id === id);
    }

    getStationById(id) {
        return this.stations.find(station => station.id === id);
    }

    import(serializationJSON) {
        this._importing = true;
        const serialization = JSON.parse(serializationJSON);

        const maxLineIdBefore = Line.lineId;
        const maxStationIdBefore = Station.stationId;
        const lineIdTransform = id => Number(id) + maxLineIdBefore;
        const stationIdTransform = id => Number(id) + maxStationIdBefore;

        serialization.lines.forEach(line => {
            this.line = new Line(this.lineTypes[line.lineType]);
            this.lines.push(this.line);
            this.line.id = lineIdTransform(line.id);
            this.line.setName(line.name);
        });

        const newStations = [];

        serialization.stations.forEach(station => {
            let newStation = new Station(station.position, this.getLineById(lineIdTransform(station.lines.splice(0, 1)[0])));
            newStation.name = station.name;
            newStation.id = stationIdTransform(station.id);
            station.lines.forEach(lineId => {
                let line = this.getLineById(lineIdTransform(lineId));
                newStation.lines.push(line);
            });
            newStations.push(newStation);
        });

        serialization.lines.forEach(line => {
            this.line = this.getLineById(lineIdTransform(line.id));
            this.line.stations = [];
            this.line.stations = line.stations.map(stationId => newStations.find(s => s.id === stationIdTransform(stationId)));
            this.line.controlPoints = line.controlPoints.map(controlPoint => new ControlPoint(this.line, controlPoint));
            this.line.redraw();
        });

        Line.lineId = Math.max(...this.lines.map(line => line.id)) + 1;
        Station.stationId = Math.max(...this.stations.map(station => station.id)) + 1;

        this.stations.forEach(s => {
            s.redrawOverlay();
            s.generateMarker();
        });
        this.finishLine();
        document.ui.build();
        this._importing = false;
    }
}

class Station {
    constructor(position, line, options = {}) {
        this.id = Station.stationId++;
        this.map = document.map;
        this.position = position;
        this.name = this.getInitialName();
        if (!options.doNotAddToLine) {
            line.addStation(this);
        }
        this.lines = [line];

        if (!this.map._importing) {
            this.createOverlay();
        }

        this.generateMarker();
        if (this.map.useReverseGeocode) {
            this.setBetterName();
        }

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
        this.initDraggable();
    }

    initDraggable() {
        this.dragHandle = new L.Draggable(this.overlay._image);
        this.dragHandle.enable();

        this.dragHandle.on("dragstart", () => {
            this._preDragPosition = this.position;
        });

        this.dragHandle.on("drag", (e) => {
            let layerPosition = e.target._newPos;
            let newPosition = document.map.Lmap.layerPointToLatLng(layerPosition);
            this.position = newPosition;
            this.redrawOverlay();
            this.lines.forEach(line => line.redraw());
        });

        this.dragHandle.on("dragend", () => {
            this.generateMarker();
            document.undoManager.push({ type: "move station", station: this, old: this._preDragPosition, new: this.position });
        });
    }

    generateMarker() {
        this.marker?.remove();
        this.marker = new L.marker(this.position, { opacity: 0.001 });
        this.marker.bindTooltip(this.name, { permanent: true, className: "station-name station-name-" + this.primaryLineType.id, offset: [0.0005, 0] });
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

    get isCrossOfDifferentLines() {
        return this.lines.filter(line => line.lineType.id != this.primaryLineType.id).length > 0;
    }

    async addCross(line) {
        this.lines.push(line);
        if (line.lineType.id !== this.primaryLineType.id) {
            this.redrawOverlay();
        }
    }

    refreshGraphics() {
        this.redrawOverlay();
        this.lines.forEach(line => line.redraw());
        this.generateMarker();
    }

    redrawOverlay() {
        this.overlay?.remove();
        this.createOverlay(this.isCrossOfDifferentLines);
    }

    getInitialName() {
        return "Station " + this.id;
    }

    async setBetterName() {
        this.setName(await this.getReverseGeocode());
    }

    reverseGeocodeURL() {
        return `https://nominatim.openstreetmap.org/reverse?lat=${this.position.lat}&lon=${this.position.lng}&format=json`;
    }

    get interestingAddressParts() {
        return ["road", "leisure", "quarter", "tourism", "neighbourhood", "suburb"];
    }

    async clientRequestThrottling() {
        if (!this.lastGeocodeRequestDate) {
            this.lastGeocodeRequestDate = Date.now();
        }
        this.lastGeocodeRequestDate = this.lastGeocodeRequestDate + 1000;
        return new Promise(resolve => setTimeout(resolve, this.lastGeocodeRequestDate - Date.now()));
    }

    async getReverseGeocode() {
        await this.clientRequestThrottling();
        let response = await ajax(this.reverseGeocodeURL());
        const responseObject = JSON.parse(response);
        let addressParts = Object.entries(responseObject["address"]);
        let possibleNames = addressParts.filter(addressPart => this.interestingAddressParts.includes(addressPart[0])).map(addressPart => addressPart[1]);

        // Ensure that the name has not been already used
        let possibleNamesFiltered = possibleNames.filter(name => !this.map.stations.some(station => station.name == name));
        if (possibleNamesFiltered.length == 0) {
            return possibleNames[0];
        }

        return possibleNamesFiltered[Math.floor(Math.random() * possibleNamesFiltered.length)];
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
        this.controlPoints = [];

        document.ui.build();
    }

    addStation(station) {
        this.addStationAtIndex(station, this.stations.length);
    }

    addStationAtIndex(station, index) {
        this.stations.splice(index, 0, station);

        // Add control points
        if (index > 0) {
            let prevStation = this.stations[index - 1];
            let a = prevStation.position;
            let b = station.position;

            // Create two control points on the line between the two stations
            // Without moving them, the curve will be a straight line

            let direction = L.latLng(b.lat - a.lat, b.lng - a.lng);
            let controlPoint1 = new ControlPoint(this, L.latLng(a.lat + direction.lat / 3, a.lng + direction.lng / 3));
            let controlPoint2 = new ControlPoint(this, L.latLng(a.lat + 2 * direction.lat / 3, a.lng + 2 * direction.lng / 3));

            // Insert control points into control points array
            this.controlPoints.splice(2 * index - 2, 0, controlPoint1);
            this.controlPoints.splice(2 * index - 1, 0, controlPoint2);
        }

        if (!this.map._importing) {
            this.redraw();
        }
    }

    removeStation(station) {
        let stationIndex = this.stations.indexOf(station);
        this.removeStationByIndex(stationIndex);
    }

    removeStationByIndex(index) {
        this.stations.splice(index, 1);

        // Remove control points
        if (index > 0) {
            this.controlPoints[2 * index - 1].marker.remove();
            this.controlPoints[2 * index - 2].marker.remove();

            this.controlPoints.splice(2 * index - 2, 2);
        }

        this.redraw();
    }

    get isCircleLine() {
        return this.stations[0] == this.stations[this.stations.length - 1];
    }

    get initialName() {
        return `${this.lineType.lineNamePrefix}${this.id}`;
    }

    isPointBetweenPoints(a, b, c) {
        const epsilon = 20;
        const lineDist = this.map.Lmap.distance(a, b);
        const distancePoint = this.map.Lmap.distance(a, c) + this.map.Lmap.distance(b, c);
        if (lineDist + epsilon > distancePoint && lineDist - epsilon < distancePoint) {
            return true;
        }
        return false;
    }

    getStationsNextToPoint(point) {
        for (let i = 1; i < this.stations.length; i++) {
            let a = this.stations[i - 1].position;
            let b = this.stations[i].position;
            if (this.isPointBetweenPoints(a, b, point)) {
                return { index: i };
            }
        }
    }

    // TODO: Add this to the curve
    onClick(evt) {
        L.DomEvent.stopPropagation(evt);

        // Add station by clicking between stations
        let { index } = this.getStationsNextToPoint(evt.latlng);
        if (!index) {
            return;
        }
        let station = new Station(evt.latlng, this, { doNotAddToLine: true });
        this.addStationAtIndex(station, index);
        document.undoManager.push({ type: "create station", station });
        document.ui.build();
    }

    async changeLineType() {
        const { value: lineTypeIndex } = await Swal.fire({
            title: "Select line type",
            input: "select",
            inputOptions: Object.values(this.map.lineTypes).map(lineType => lineType.name),
            inputPlaceholder: this.lineType.name,
            showCancelButton: true,
        });

        if (lineTypeIndex) {
            let newLineType = Object.values(this.map.lineTypes)[lineTypeIndex];
            document.undoManager.push({ type: "change line type", line: this, old: this.lineType.id, new: newLineType.id });
            this.lineType = newLineType;
            this.stations.forEach(station => station.refreshGraphics());
        }
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
        for (let i = 0; i < stationCount; i++) {
            this.stations[0].remove();
        }
        if (this.map.line == this) {
            this.map.finishLine();
        }
        document.ui.build();
    }

    restore() {
        this.previousStations.forEach(station => station.restore());
    }

    getCurve(stationPairs) {
        let curve = [];
        for (let i = 0; i < stationPairs.length; i++) {
            let a = stationPairs[i][0].position;
            let b = stationPairs[i][1].position;
            // Get control points

            let controlPoint1 = this.controlPoints[2 * i];
            let controlPoint2 = this.controlPoints[2 * i + 1];

            // Add start to curve
            if (i == 0) {
                curve = curve.concat(["M", [a.lat, a.lng]]);
            }
            curve = curve.concat(["C", [controlPoint1.position.lat, controlPoint1.position.lng], [controlPoint2.position.lat, controlPoint2.position.lng], [b.lat, b.lng]]);
        }
        return curve;
    }

    redraw() {
        // Draw curve
        // Get all station pairs
        let stationPairs = [];
        for (let i = 0; i < this.stations.length - 1; i++) {
            stationPairs.push([this.stations[i], this.stations[i + 1]]);
        }
        // Draw the curves
        let curveData = this.getCurve(stationPairs);
        this.curve?.remove();
        this.curve = L.curve(curveData, { color: this.lineType.color, className: "line", id: this.id, interactive: true });
        this.curve.addTo(this.map.Lmap);

        // Draw control points
        this.controlPoints.forEach(controlPoint => {

            if (this.map.showControlPoints) {
                controlPoint.generateMarker();
            } else {
                controlPoint.marker?.remove();
            }
        });

    }
}

class ControlPoint {
    constructor(line, position) {
        this.line = line;
        this.position = position;
        this.map = document.map;
        this.marker = null;
    }

    generateMarker() {
        if (this.marker) {
            this.marker.remove();
        }
        this.marker = L.marker(this.position, { draggable: true, color: this.line.lineType.color });
        this.marker.addTo(this.map.Lmap);
        this.marker.on("click", (e) => {
            L.DomEvent.stopPropagation(e);
            console.log(this);
        });
        this.initDraggable();
    }

    initDraggable() {
        this.marker.on("dragstart", () => {
            this._preDragPosition = this.position;
        });

        this.marker.on("drag", (e) => {
            let newPosition = e.target.getLatLng();
            this.position = newPosition;
        });

        this.marker.on("dragend", () => {
            this.line.redraw();
            document.undoManager.push({ type: "move control point", controlPoint: this, old: this._preDragPosition, new: this.position });
        });
    }
}

Line.lineId = 1;

document.map = new Map();
