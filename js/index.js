class Map {
    constructor() {
        this.init();
    }

    get tileServerUrl() {
        return "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png";
    }

    init() {
        this.map = L.map('map', {
            center: [51.505, -0.09],
            zoom: 13
        });

        L.tileLayer(this.tileServerUrl, {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(this.map);

        this.map.on('click', (event) => this.onMapClick(event));
    }

    onMapClick(event) {
        console.log(event);
    }
}

document.map = new Map();