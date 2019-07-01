export const mapCount = (count = 10, callback) => new Array(count).fill(null).map(callback);

export const randomInteger = (min, max) => Math.round(min - 0.5 + Math.random() * (max - min + 1));
