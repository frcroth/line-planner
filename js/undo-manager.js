
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
        let line = operation.line;
        switch (operation.type) {
        case "create station":
            station.remove();
            break;
        case "cross station":
            station.removeCross(operation.line);
            break;
        case "rename station":
            station.setName(operation.old);
            break;
        case "remove station":
            station.restore();
            break;
        case "move station":
            station.position = operation.old;
            station.redrawOverlay();
            station.lines.forEach(line => line.redraw());
            station.generateMarker();
            break;
        case "create circle":
            operation.line.stations.pop();
            operation.line.redraw();
            break;
        case "rename line":
            line.setName(operation.old);
            break;
        case "remove line":
            line.restore();
            break;
        }
        document.ui.build();
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
        let line = operation.line;
        switch (operation.type) {
        case "create station":
            station.restore();
            break;
        case "cross station":
            station.restoreCross(operation.line, operation.index);
            break;
        case "rename station":
            station.setName(operation.new);
            break;
        case "remove station":
            station.remove();
            break;
        case "move station":
            station.position = operation.new;
            station.redrawOverlay();
            station.lines.forEach(line => line.redraw());
            station.generateMarker();
            break;
        case "create circle":
            operation.line.addStation(station);
            operation.line.redraw();
            break;
        case "rename line":
            line.setName(operation.new);
            break;
        case "remove line":
            line.remove();
            break;
        }
        document.ui.build();
    }
}

document.undoManager = new UndoManager();