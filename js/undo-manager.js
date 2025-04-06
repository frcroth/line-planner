
function keyPress(e) {
    if (e.keyCode == 90 && e.ctrlKey && !e.shiftKey) {
        // Ctrl + Z
        document.undoManager.undo();
    }
    if (e.keyCode == 89 && e.ctrlKey || e.keyCode == 90 && e.ctrlKey && e.shiftKey) {
        // Ctrl + Y or Ctrl + Shift + Z
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
        let controlPoint = operation.controlPoint;
        switch (operation.type) {
        case "create station":
            station.remove();
            break;
        case "cross station":
            station.removeCross(line);
            break;
        case "remove cross station":
            station.restoreCross(line, operation.index);
            break;
        case "rename station":
            station.setName(operation.old);
            break;
        case "remove station":
            station.restore();
            break;
        case "move station":
            station.position = operation.old;
            station.refreshGraphics();
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
        case "change line type":
            line.lineType = line.map.lineTypes[operation.old];
            line.stations.forEach(station => station.refreshGraphics());
            line.redraw();
            break;
        case "move control point":
            controlPoint.position = operation.old;
            controlPoint.line.redraw();
            controlPoint.generateMarker();
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
            station.restoreCross(line, operation.index);
            break;
        case "remove cross station":
            station.removeCross(line);
            break;
        case "rename station":
            station.setName(operation.new);
            break;
        case "remove station":
            station.remove();
            break;
        case "move station":
            station.position = operation.new;
            station.refreshGraphics();
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
        case "change line type":
            line.lineType = line.map.lineTypes[operation.new];
            line.stations.forEach(station => station.refreshGraphics());
            line.reAddPolyLine();
            break;
        case "move control point":
            operation.controlPoint.position = operation.new;
            operation.controlPoint.line.redraw();
            operation.controlPoint.generateMarker();
            break;
        }
        document.ui.build();
    }
}

document.undoManager = new UndoManager();