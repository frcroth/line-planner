
class UI {
    constructor(id) {
        this.container = document.getElementById(id);
        this.lineContainers = {};
        this.stationContainers = {};
        this.model = document.map;

        this.initLineSelector();
    }

    initLineSelector() {
        document.getElementById("u-bahn-radio").onchange = () => document.map.selectLineType("u");
        document.getElementById("s-bahn-radio").onchange = () => document.map.selectLineType("s");
        document.getElementById("u-bahn-radio").checked = true;
    }

    build() {
        this.container.innerHTML = "";
        this.lineOverview = document.createElement("div");
        this.lineOverview.classList.add("row");
        this.container.appendChild(this.lineOverview);

        if(!this.model ){
            if(!document.map){
                return;
            }
            this.model = document.map;
        }
        this.model.lines.forEach(line => {
            if (line.stations.length != 0) {
                this.addLine(line);
                line.stations.forEach(station => this.addStation(station, line));
            }
        });
    }

    addLine(line) {
        const lineContainer = document.createElement("div");
        const lineLabel = document.createElement("p");
        lineLabel.classList.add("line-label");
        lineLabel.innerHTML = line.name;

        const lineHead = document.createElement("div");
        lineHead.classList.add("form-inline", "container");
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
            document.undoManager.push({type: "remove line", line});
            line.remove();
        };
        lineDeletionButton.title = "Delete line";
        lineDeletionButton.classList.add("btn", "button", "btn-sm", "btn-outline-secondary");
        lineDeletionButton.innerHTML = "<i class=\"fas fa-trash\"></i>";
        lineHead.appendChild(lineDeletionButton);

        const lineContinueButton = document.createElement("button");
        lineContinueButton.onclick = () => document.map.line = line;
        lineContinueButton.title = "Continue line";
        lineContinueButton.classList.add("btn", "button", "btn-sm", "btn-outline-secondary");
        lineContinueButton.innerHTML = "<i class=\"far fa-arrow-alt-circle-right\"></i>";
        lineHead.appendChild(lineContinueButton);

        lineContainer.classList.add("line", "col");
        this.lineOverview.appendChild(lineContainer);
        this.lineContainers[line.id] = lineContainer;
    }

    addStation(station, line) {
        const stationContainer = document.createElement("div");
        stationContainer.classList.add("station-container", "container", "form-inline");
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
            document.undoManager.push({type: "remove station", station});
            station.remove();
            document.ui.build();
        };
        stationDeleteButton.title = "Delete station";
        stationDeleteButton.classList.add("btn", "button", "btn-sm", "btn-outline-secondary");
        stationDeleteButton.innerHTML = "<i class=\"fas fa-trash\"></i>";
        stationContainer.appendChild(stationDeleteButton);

        this.lineContainers[line.id].appendChild(stationContainer);
    }


}

document.ui = new UI("ui");