(function() {
    'use strict';
    // Only visible maps request tiles. No prefetching, custom cache, or address lookup.
    const tileUrl = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
    const assets = new URL('.', document.currentScript.src);
    let library;
    function loadLibrary() {
        if (window.L) return Promise.resolve(window.L);
        if (!library) library = new Promise((resolve, reject) => {
            const css = document.createElement('link');
            css.rel = 'stylesheet'; css.href = new URL('vendor/leaflet/leaflet.css', assets);
            const script = document.createElement('script');
            script.src = new URL('vendor/leaflet/leaflet.js', assets);
            const failed = () => {
                css.remove(); script.remove(); library = null;
                reject(Error('Map could not load. Check your connection and try again.'));
            };
            css.onerror = failed; script.onerror = failed;
            css.onload = () => { script.onload = () => resolve(window.L); document.head.appendChild(script); };
            document.head.appendChild(css);
        });
        return library;
    }
    function mount(host, {coordinates, editable = false, onChange = () => {}} = {}) {
        let position = window.RentdleMapCore.coordinates(coordinates), map, marker, removed = false;
        const frame = document.createElement('div'); frame.className = 'rentdle-map-frame';
        const canvas = document.createElement('div'); canvas.className = 'rentdle-map';
        canvas.setAttribute('aria-label', editable ? 'Property location. Use the coordinate fields or place a pin on the map.' : 'Property neighbourhood map');
        const credit = document.createElement('div'); credit.className = 'map-credit';
        const link = document.createElement('a'); link.href = 'https://www.openstreetmap.org/copyright';
        link.target = '_blank'; link.rel = 'noopener'; link.textContent = '© OpenStreetMap contributors'; credit.appendChild(link);
        const status = document.createElement('p'); status.className = 'map-status'; status.setAttribute('role', 'status');
        status.textContent = 'Loading map…';
        const retry = document.createElement('button'); retry.type = 'button'; retry.className = 'secondary'; retry.textContent = 'Retry map'; retry.hidden = true;
        frame.append(canvas, credit); host.append(frame, status, retry);
        function place(next, recenter = true) {
            position = window.RentdleMapCore.coordinates(next);
            if (!map) return;
            if (!position) { if (marker) marker.remove(); marker = null; return; }
            const latlng = [position.latitude, position.longitude];
            if (!marker) {
                marker = L.marker(latlng, {
                    icon: L.divIcon({className:'rentdle-pin', html:'<span></span>', iconSize:[28,36], iconAnchor:[14,36]}),
                    draggable: editable, title: 'Property location', alt: 'Property location'
                }).addTo(map);
                if (editable) marker.on('dragend', () => select(marker.getLatLng()));
            } else marker.setLatLng(latlng);
            if (recenter) map.setView(latlng, 15, {animate:false});
        }
        function select(latlng) {
            const wrapped = latlng.wrap();
            const next = {latitude:Number(wrapped.lat.toFixed(6)), longitude:Number(wrapped.lng.toFixed(6))};
            if (!window.RentdleMapCore.coordinates(next)) return;
            place(next, false); onChange(next);
        }
        async function start() {
            retry.hidden = true; status.textContent = 'Loading map…';
            // file: pages cannot send the Referer required by OSM's tile policy.
            if (location.protocol === 'file:') {
                canvas.hidden = true;
                status.textContent = 'Interactive maps need the hosted website or localhost. You can still enter coordinates in the editor.';
                return;
            }
            try {
                const L = await loadLibrary();
                if (removed) return;
                map = L.map(canvas, {attributionControl:false, scrollWheelZoom:false, minZoom:3, maxZoom:19});
                map.setView(position ? [position.latitude, position.longitude] : [52.1, 5.3], position ? 15 : 7);
                const tiles = L.tileLayer(tileUrl, {
                    maxZoom:19, keepBuffer:0, updateWhenIdle:true, updateWhenZooming:false,
                    referrerPolicy:'strict-origin-when-cross-origin'
                });
                let failed = false;
                tiles.on('tileerror', () => { failed = true; status.textContent = 'Some map tiles could not load. Check your connection, then retry.'; retry.hidden = false; });
                tiles.on('load', () => { if (!failed) status.textContent = editable ? 'Click to place the pin, or drag it to adjust.' : ''; });
                tiles.addTo(map);
                if (editable) map.on('click', event => select(event.latlng));
                place(position, false);
            } catch (error) { if (!removed) { status.textContent = error.message; retry.hidden = false; } }
        }
        retry.addEventListener('click', () => { if (map) map.remove(); map = null; marker = null; start(); });
        start();
        return {
            setCoordinates: next => place(next),
            remove() { removed = true; if (map) map.remove(); host.replaceChildren(); }
        };
    }
    function editor(host, initial, onChange) {
        const row = document.createElement('div'); row.className = 'coordinate-fields';
        const inputs = {};
        for (const [key, title, min, max] of [['latitude','Latitude',-85.05112878,85.05112878],['longitude','Longitude',-180,180]]) {
            const label = document.createElement('label'); label.textContent = title;
            const input = document.createElement('input'); input.type = 'number'; input.step = 'any'; input.min = min; input.max = max;
            input.value = initial?.[key] ?? ''; input.placeholder = key === 'latitude' ? 'e.g. 52.068003' : 'e.g. 4.304524';
            label.appendChild(input); row.appendChild(label); inputs[key] = input;
        }
        const button = document.createElement('button'); button.type = 'button'; button.className = 'secondary'; button.textContent = 'Open map to place pin';
        const area = document.createElement('div');
        const help = document.createElement('p'); help.className = 'muted'; help.textContent = 'Enter coordinates, or open the map and click the property. Clue 2 shows the map; leave both fields blank to show the city name instead.';
        host.append(row, help, button, area);
        let controller;
        const value = () => ({latitude:inputs.latitude.value, longitude:inputs.longitude.value});
        Object.values(inputs).forEach(input => input.addEventListener('input', () => {
            onChange(value()); controller?.setCoordinates(value());
        }));
        button.addEventListener('click', () => {
            button.hidden = true;
            controller = mount(area, {coordinates:value(), editable:true, onChange:next => {
                inputs.latitude.value = next.latitude; inputs.longitude.value = next.longitude; onChange(value());
            }});
        });
        return {value, remove() { controller?.remove(); host.replaceChildren(); }};
    }
    window.RentdleMaps = {mount, editor};
})();
