/* global Swal, saveAs*/
class UI {
    constructor(id) {
        this.container = document.getElementById(id);
        this.lineContainers = {};
        this.stationContainers = {};
        this.model = document.map;

        this.initLineSelector();
        this.initImportExport();
        this.initReverseGeocode();
        this.initShowStationNames();
        this.initShowControlPoints();
    }

    initLineSelector() {
        document.getElementById("u-bahn-radio").onchange = () => this.model.selectLineType("u");
        document.getElementById("s-bahn-radio").onchange = () => this.model.selectLineType("s");
        document.getElementById("u-bahn-radio").checked = true;
    }

    initImportExport() {
        this.importButton = document.getElementById("import-button");
        this.importButton.onclick = () => this.import();
        this.upload = document.getElementById("upload-input");
        this.exportButton = document.getElementById("export-button");
        this.exportButton.onclick = () => this.export();
        this.shareButton = document.getElementById("share-button");
        this.shareButton.onclick = () => this.share();
    }

    initReverseGeocode() {
        this.reverseGeocodeBox = document.getElementById("reverse-geocode");
        this.reverseGeocodeBox.checked = false;
        this.reverseGeocodeBox.onchange = () => this.model.useReverseGeocode = this.reverseGeocodeBox.checked;
    }

    initShowControlPoints() {
        this.showControlPointsBox = document.getElementById("show-control-points");
        this.showControlPointsBox.checked = true;
        this.showControlPointsBox.onchange = () => {
            this.model.showControlPoints = this.showControlPointsBox.checked;
            this.model.lines.forEach(line => line.redraw());
        };
    }

    initShowStationNames() {
        this.showStationNamesBox = document.getElementById("show-station-names");
        this.showStationNamesBox.checked = true;
        this.showStationNamesBox.onchange = () => {
            this.model.showStationNames = this.showStationNamesBox.checked;
            this.model.lines.forEach(line => line.stations.forEach(station => station.generateMarker()));
        };
    }

    import() {
        if (this.upload.files.length < 1) {
            Swal.fire("No file specified");
            return;
        }
        const selectedFile = this.upload.files[0];

        selectedFile.text().then(text => document.map.import(text));
    }

    export() {
        let content = this.model.export();
        let filename = "lines.json";

        let blob = new Blob([content], {
            type: "text/plain;charset=utf-8"
        });

        saveAs(blob, filename);
    }

    share() {
        let content = this.model.export();
        let uriEncoded = encodeURIComponent(content);

        // Write exported content to current URL
        let url = new URL(window.location.href);
        url.searchParams.set("share", uriEncoded);
        window.history.pushState({}, "", url);
        // Copy URL to clipboard
        navigator.clipboard.writeText(url.href).then(() => {
            Swal.fire("Sharing URL copied to clipboard!");
        }, () => {
            Swal.fire("Failed to copy exported content to clipboard, copy the URL!");
        }
        );
    }

    restoreShare() {
        const urlParams = new URLSearchParams(window.location.search);
        const share = urlParams.get("share");
        if (share) {
            // Decode the URI component
            const decodedContent = decodeURIComponent(share);
            // Import the content
            this.model.import(decodedContent);
            // Remove the share parameter from the URL
            urlParams.delete("share");
            window.history.pushState({}, "", `${window.location.pathname}?${urlParams}`);
        }
    }

    build() {
        this.container.innerHTML = "";
        this.lineOverview = document.createElement("div");
        this.lineOverview.classList.add("line-row");
        this.container.appendChild(this.lineOverview);

        if (!this.model) {
            if (!document.map) {
                return;
            }
            this.model = document.map;
        }
        this.model.lines.forEach(line => {
            if (line.stations.length != 0) {
                this.addLine(line,  this.model.line == line);
                line.stations.forEach(station => this.addStation(station, line));
            }
        });
    }

    addLine(line, isActive) {
        const lineContainer = document.createElement("div");
        lineContainer.id = "line-" + line.id;
        const lineLabel = document.createElement("p");
        lineLabel.classList.add("line-label");
        lineLabel.innerHTML = line.name;

        const lineHead = document.createElement("div");
        lineHead.classList.add("form-inline", "container", "line-head");
        lineContainer.appendChild(lineHead);
        lineHead.appendChild(lineLabel);

        const lineRenameButton = document.createElement("button");
        lineRenameButton.onclick = () => line.namePrompt();
        lineRenameButton.title = "Rename line";
        lineRenameButton.classList.add("btn", "button", "btn-sm", "btn-outline-secondary");
        lineRenameButton.innerHTML = "<i class=\"fas fa-pen\"></i>";
        lineHead.appendChild(lineRenameButton);

        const lineDeletionButton = document.createElement("button");
        lineDeletionButton.onclick = () => {
            document.undoManager.push({ type: "remove line", line });
            line.remove();
        };
        lineDeletionButton.title = "Delete line";
        lineDeletionButton.classList.add("btn", "button", "btn-sm", "btn-outline-secondary");
        lineDeletionButton.innerHTML = "<i class=\"fas fa-trash\"></i>";
        lineHead.appendChild(lineDeletionButton);

        const lineContinueButton = document.createElement("button");
        lineContinueButton.onclick = () => this.continueLine(line);
        lineContinueButton.title = "Continue line";
        lineContinueButton.classList.add("btn", "button", "btn-sm", "btn-outline-secondary");
        lineContinueButton.innerHTML = "<i class=\"far fa-arrow-alt-circle-right\"></i>";
        lineHead.appendChild(lineContinueButton);

        const lineTypeChangeButton = document.createElement("button");
        lineTypeChangeButton.onclick = () => this.changeLineType(lineContainer, line);
        lineTypeChangeButton.title = "Change line type";
        lineTypeChangeButton.classList.add("btn", "button", "btn-sm", "btn-outline-secondary");
        lineTypeChangeButton.innerHTML = "<i class=\"fas fa-exchange-alt\"></i>";
        lineHead.appendChild(lineTypeChangeButton);

        lineContainer.classList.add("line", "card");
        if (line.lineType.id === "u") {
            lineContainer.classList.remove("green-line");
            lineContainer.classList.add("blue-line");
        } else if (line.lineType.id === "s") {
            lineContainer.classList.remove("blue-line");
            lineContainer.classList.add("green-line");
        }
        if (isActive) {
            lineContainer.classList.add("active");
        } else {
            lineContainer.classList.remove("active");
        }
        this.lineOverview.appendChild(lineContainer);
        this.lineContainers[line.id] = lineContainer;
    }

    async changeLineType(lineContainer, line) {
        await line.changeLineType();
        const lineType = line.lineType;
        if (lineType.id === "u") {
            lineContainer.classList.remove("green-line");
            lineContainer.classList.add("blue-line");
        } else if (lineType.id === "s") {
            lineContainer.classList.remove("blue-line");
            lineContainer.classList.add("green-line");
        }
    }

    continueLine(line) {
        this.model.line = line;
        document.querySelectorAll(".line").forEach(lineContainer => {
            lineContainer.classList.remove("active");
        });
        const lineContainer = document.getElementById("line-" + line.id);
        lineContainer.classList.add("active");
    }

    addStation(station, line) {
        const stationContainer = document.createElement("div");
        stationContainer.classList.add("station-container", "container", "station-item");
        this.stationContainers[station.id] = stationContainer;

        const stationLabel = document.createElement("label");
        stationLabel.classList.add("station-label");
        stationLabel.innerHTML = station.name;
        stationContainer.appendChild(stationLabel);

        const stationRenameButton = document.createElement("button");
        stationRenameButton.onclick = () => station.namePrompt();
        stationRenameButton.title = "Rename station";
        stationRenameButton.classList.add("btn", "button", "btn-sm", "btn-outline-secondary");
        stationRenameButton.innerHTML = "<i class=\"fas fa-pen\"></i>";
        stationContainer.appendChild(stationRenameButton);

        const stationDeleteButton = document.createElement("button");
        stationDeleteButton.onclick = () => {
            this.model.removeStation(station, line);
        };
        stationDeleteButton.title = "Delete station";
        stationDeleteButton.classList.add("btn", "button", "btn-sm", "btn-outline-secondary");
        stationDeleteButton.innerHTML = "<i class=\"fas fa-trash\"></i>";
        stationContainer.appendChild(stationDeleteButton);

        this.lineContainers[line.id].appendChild(stationContainer);
    }


}

document.ui = new UI("ui");
