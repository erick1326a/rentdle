(function(root) {
    'use strict';
    function coordinates(value) {
        if (!value || typeof value !== 'object') return null;
        const values = ['latitude', 'longitude'].map(key => {
            const v = value[key];
            return (typeof v === 'number' || typeof v === 'string') && String(v).trim() !== '' ? Number(v) : NaN;
        });
        const [latitude, longitude] = values;
        return Number.isFinite(latitude) && Math.abs(latitude) <= 85.05112878 &&
            Number.isFinite(longitude) && Math.abs(longitude) <= 180 ? {latitude, longitude} : null;
    }
    root.RentdleMapCore = {coordinates};
})(typeof module === 'object' ? module.exports : window);
