// OpenStreetMap + Evacuation Modeling Helpers for TurboWarp URL Extension
// Single-file, no require(), uses Scratch.* APIs and DOM overlay canvas.

// ===== Minimal TileMap / TileCache (self-contained) =====
class TileCache {
  constructor() {
    this.cache = new Map();
    this.baseURL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  }
  _key(z, x, y) { return `${z}/${x}/${y}`; }
  _url(z, x, y) { return this.baseURL.replace('{z}', z).replace('{x}', x).replace('{y}', y); }
  async getImage(z, x, y) {
    const k = this._key(z, x, y);
    if (this.cache.has(k)) return this.cache.get(k);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    const p = new Promise((resolve, reject) => {
      img.onload = () => resolve(img);
      img.onerror = reject;
    });
    img.src = this._url(z, x, y);
    this.cache.set(k, p);
    return p;
  }
}

// Calculate tile indices and on-canvas positions for given center.
class TileMap {
  constructor() {
    this.centerLatitude = 35.689185;
    this.centerLongitude = 139.691648;
    this.currentZoom = 18;
    this.tiles = [];
  }

  // Convert lon/lat to pixel space at zoom
  static lon2x(lon, z) {
    const n = Math.pow(2, z) * 256;
    return ((lon + 180) / 360) * n;
  }
  static lat2y(lat, z) {
    const latRad = lat * Math.PI / 180;
    const n = Math.pow(2, z) * 256;
    return (0.5 - Math.log((1 + Math.sin(latRad)) / (1 - Math.sin(latRad))) / (4 * Math.PI)) * n;
  }

  buildTiles(zoom, lon, lat, canvasWidth, canvasHeight) {
    this.tiles = [];
    const worldW = 256 * Math.pow(2, zoom);
    const centerX = TileMap.lon2x(lon, zoom);
    const centerY = TileMap.lat2y(lat, zoom);

    // Visible rect in pixel coords
    const left = centerX - canvasWidth / 2;
    const top = centerY - canvasHeight / 2;
    const right = centerX + canvasWidth / 2;
    const bottom = centerY + canvasHeight / 2;

    const tileMinX = Math.floor(Math.max(0, left / 256));
    const tileMaxX = Math.floor(Math.min(Math.pow(2, zoom) - 1, right / 256));
    const tileMinY = Math.floor(Math.max(0, top / 256));
    const tileMaxY = Math.floor(Math.min(Math.pow(2, zoom) - 1, bottom / 256));

    for (let x = tileMinX; x <= tileMaxX; x++) {
      for (let y = tileMinY; y <= tileMaxY; y++) {
        const px = x * 256;
        const py = y * 256;
        const screenX = Math.round(px - (centerX - canvasWidth / 2));
        const screenY = Math.round(py - (centerY - canvasHeight / 2));
        this.tiles.push({ zoom, x, y, screenX, screenY });
      }
    }
  }
}

// ===== Timer =====
class Timer {
  constructor() { this.startTime = 0; }
  start() { this.startTime = Date.now(); }
  timeElapsed() { return Date.now() - this.startTime; }
}

// ===== PreciseMovementController =====
class PreciseMovementController {
  constructor() {
    this.startTime = 0;
    this.lastUpdateTime = 0;
    this.lastPosition = { x: 0, y: 0 };
    this.prevPosition = { x: 0, y: 0 };
    this.targetSpeed = 0;
    this.accumulatedError = 0;
    this.isMoving = false;
    this.updateInterval = 33.33; // ms
  }
  startMovement(startX, startY, speed) {
    const now = Date.now();
    this.startTime = now;
    this.lastUpdateTime = now;
    this.prevPosition = { x: startX, y: startY };
    this.lastPosition = { x: startX, y: startY };
    this.targetSpeed = speed;
    this.accumulatedError = 0;
    this.isMoving = true;
  }
  calculateNextTarget(currentX, currentY, targetX, targetY, stepDistance) {
    const dx = targetX - currentX;
    const dy = targetY - currentY;
    const totalDistance = Math.sqrt(dx * dx + dy * dy);
    if (totalDistance <= stepDistance) return { x: targetX, y: targetY };
    const dirX = dx / totalDistance;
    const dirY = dy / totalDistance;
    return { x: currentX + dirX * stepDistance, y: currentY + dirY * stepDistance };
  }
  updateMovement(sprite, finalTargetX, finalTargetY, speed, timeScale, metersPerPixel) {
    if (!this.isMoving) return false;
    const currentTime = Date.now();
    const deltaTime = currentTime - this.lastUpdateTime;
    if (deltaTime < this.updateInterval) return false;

    const dxr = finalTargetX - sprite.x;
    const dyr = finalTargetY - sprite.y;
    const remainingPixels = Math.sqrt(dxr * dxr + dyr * dyr);
    const remainingMeters = remainingPixels * metersPerPixel;
    if (remainingMeters < 0.01) {
      sprite.setXY(finalTargetX, finalTargetY);
      this.isMoving = false;
      return true;
    }

    const dtSec = deltaTime / 1000;
    const distanceToMoveMeters = speed * timeScale * dtSec;
    const distanceToMovePixels = distanceToMoveMeters / metersPerPixel;

    const nextTarget = this.calculateNextTarget(
      sprite.x, sprite.y, finalTargetX, finalTargetY, distanceToMovePixels + this.accumulatedError
    );

    const actualDx = nextTarget.x - sprite.x;
    const actualDy = nextTarget.y - sprite.y;
    const actualDistance = Math.sqrt(actualDx * actualDx + actualDy * actualDy);
    const intendedDistance = distanceToMovePixels;
    this.accumulatedError = intendedDistance - actualDistance;

    this.prevPosition = { ...this.lastPosition };
    sprite.setXY(nextTarget.x, nextTarget.y);
    this.lastUpdateTime = currentTime;
    this.lastPosition = { x: nextTarget.x, y: nextTarget.y };
    return false;
  }
  getCurrentSpeed(metersPerPixel) {
    if (!this.isMoving) return 0;
    const dx = this.lastPosition.x - this.prevPosition.x;
    const dy = this.lastPosition.y - this.prevPosition.y;
    const dpix = Math.sqrt(dx * dx + dy * dy);
    const dm = dpix * metersPerPixel;
    const dt = this.updateInterval / 1000;
    return dm / dt;
  }
}

// ===== PathMovementController (per-node stepping) =====
class PathMovementController {
  constructor() {
    this.isMoving = false;
    this.pathNodes = [];
    this.currentTargetIndex = 0;
    this.preciseMover = new PreciseMovementController();
  }
  startPathMovement(pathNodeCoordinates, speed) {
    if (!pathNodeCoordinates || pathNodeCoordinates.length === 0) return false;
    this.pathNodes = [...pathNodeCoordinates];
    this.currentTargetIndex = 0;
    this.isMoving = true;
    return true;
  }
  updatePathMovement(sprite, speed, timeScale, metersPerPixel) {
    if (!this.isMoving || this.currentTargetIndex >= this.pathNodes.length) return true;
    const currentTarget = this.pathNodes[this.currentTargetIndex];
    if (!this.preciseMover.isMoving) {
      this.preciseMover.startMovement(sprite.x, sprite.y, speed);
    }
    const reached = this.preciseMover.updateMovement(
      sprite, currentTarget.x, currentTarget.y, speed, timeScale, metersPerPixel
    );
    if (reached) {
      this.currentTargetIndex++;
      if (this.currentTargetIndex < this.pathNodes.length) {
        this.preciseMover = new PreciseMovementController();
        return false;
      } else {
        this.isMoving = false;
        return true;
      }
    }
    return false;
  }
  reset() {
    this.isMoving = false;
    this.pathNodes = [];
    this.currentTargetIndex = 0;
    this.preciseMover = new PreciseMovementController();
  }
}

// ===== A* Pathfinder =====
class AStarPathfinder {
  constructor() { this.nodes = new Map(); this.links = new Map(); }
  setNodes(nodeList) {
    this.nodes.clear();
    nodeList.forEach(([id, x, y]) => this.nodes.set(id, { id, x, y }));
  }
  setLinks(linkList) {
    this.links.clear();
    linkList.forEach(([from, to, distance]) => {
      if (!this.links.has(from)) this.links.set(from, []);
      this.links.get(from).push({ to, distance });
      if (!this.links.has(to)) this.links.set(to, []);
      this.links.get(to).push({ to: from, distance });
    });
  }
  heuristic(a, b) { const dx = a.x - b.x, dy = a.y - b.y; return Math.sqrt(dx*dx + dy*dy); }
  findPath(startId, goalId) {
    const start = this.nodes.get(startId), goal = this.nodes.get(goalId);
    if (!start || !goal) return [];
    if (startId === goalId) return [startId];

    const open = new Set([startId]);
    const cameFrom = new Map();
    const g = new Map(), f = new Map();
    this.nodes.forEach((_, id) => { g.set(id, Infinity); f.set(id, Infinity); });
    g.set(startId, 0); f.set(startId, this.heuristic(start, goal));

    while (open.size) {
      let current = null, minF = Infinity;
      for (const id of open) { const sc = f.get(id); if (sc < minF) { minF = sc; current = id; } }
      if (current === goalId) return this._reconstruct(cameFrom, current);
      open.delete(current);
      const neighbors = this.links.get(current) || [];
      for (const nb of neighbors) {
        const tentative = g.get(current) + nb.distance;
        if (tentative < g.get(nb.to)) {
          cameFrom.set(nb.to, current);
          g.set(nb.to, tentative);
          f.set(nb.to, tentative + this.heuristic(this.nodes.get(nb.to), goal));
          open.add(nb.to);
        }
      }
    }
    return [];
  }
  _reconstruct(cameFrom, cur) {
    const path = [cur];
    while (cameFrom.has(cur)) { cur = cameFrom.get(cur); path.unshift(cur); }
    return path;
  }
}

// ===== Scratch Extension =====
class Scratch3OpenStreetMapBlocks {
  constructor(runtime) {
    this.runtime = runtime;
    this.tileMap = new TileMap();
    this.tileCache = new TileCache();

    this.timeScale = 1.0;
    this.preciseMovements = new Map();
    this.simulationStartTime = Date.now();
    this.realStartTime = Date.now();
    this.isSimulationRunning = false;
    this.baseSpeedPerMinute = 300;
    this.distanceScale = 1.0;
    this.pathfinder = new AStarPathfinder();

    this.canvas = document.createElement('canvas');
    this.canvas.width = 480;
    this.canvas.height = 360;

    this.tileMap.centerLatitude = 35.689185;
    this.tileMap.centerLongitude = 139.691648;
    this.tileMap.currentZoom = 18;

    this.setupXYMoveListener();

    this.runtime.on('PROJECT_START', () => {
      this.isSimulationRunning = true;
      this.resetSimulationTime();
      this.drawTileMap({
        LATITUDE: this.tileMap.centerLatitude,
        LONGITUDE: this.tileMap.centerLongitude,
        ZOOM: this.tileMap.currentZoom
      }).catch(e => console.error('Initial map draw failed:', e));
    });

    this.runtime.on('PROJECT_STOP_ALL', () => {
      this.isSimulationRunning = false;
      this.preciseMovements.clear();
    });
  }

  resetSimulationTime() {
    const now = Date.now();
    this.simulationStartTime = now;
    this.realStartTime = now;
  }

  updateBlockDefaults(latitude, longitude) {
    const blocks = this.getInfo().blocks;
    blocks.forEach(block => {
      if (block.arguments?.LATITUDE) block.arguments.LATITUDE.defaultValue = Number(latitude.toFixed(6));
      if (block.arguments?.LONGITUDE) block.arguments.LONGITUDE.defaultValue = Number(longitude.toFixed(6));
    });
    if (this.runtime.extensionManager) this.runtime.extensionManager.refreshBlocks();
  }

  setupSpriteMoveListener() {
    this.runtime.on('TARGET_MOVED', target => {
      if (target.isStage) return;
      const latitude = this.getScratchCoordinateLatitude(target.x, target.y);
      const longitude = this.getScratchCoordinateLongitude(target.x, target.y);
      this.updateBlockDefaults(latitude, longitude);
    });
  }

  setupXYMoveListener() {
    this.runtime.on('TARGET_MOVED', target => {
      if (target.isStage) return;
      this.updateXYBlockDefaults(target.x, target.y);
    });
  }

  updateXYBlockDefaults(x, y) {
    const blocks = this.getInfo().blocks;
    blocks.forEach(block => {
      if (block.opcode === 'moveToXYWithPixelSpeed') {
        if (block.arguments?.X) block.arguments.X.defaultValue = Number(x.toFixed(2));
        if (block.arguments?.Y) block.arguments.Y.defaultValue = Number(y.toFixed(2));
      }
    });
    if (this.runtime.extensionManager) this.runtime.extensionManager.refreshBlocks();
  }

  getDistanceScale() {
    try {
      const mpp = this.getMetersPerPixel(this.tileMap.centerLatitude, this.tileMap.currentZoom);
      return Number(mpp.toFixed(4));
    } catch { return 0; }
  }

  calculateDistance(lat1, lon1, lat2, lon2) {
    try {
      const radLat1 = (Math.PI * lat1) / 180;
      const radLon1 = (Math.PI * lon1) / 180;
      const radLat2 = (Math.PI * lat2) / 180;
      const radLon2 = (Math.PI * lon2) / 180;

      const latDiff = radLat2 - radLat1;
      const lonDiff = radLon2 - radLon1;

      const e2 = 0.00669438;
      const a = 6378137;
      const avgLat = (radLat1 + radLat2) / 2;

      const sinLat = Math.sin(avgLat);
      const W = Math.sqrt(1 - e2 * sinLat * sinLat);
      const M = a * (1 - e2) / (W * W * W);
      const N = a / W;

      return Math.sqrt(Math.pow(M * latDiff, 2) + Math.pow(N * Math.cos(avgLat) * lonDiff, 2));
    } catch { return 0; }
  }

  calculateDistanceBetweenPoints(args) {
    try {
      const lat1 = Scratch.Cast.toNumber(args.LATITUDE1);
      const lon1 = Scratch.Cast.toNumber(args.LONGITUDE1);
      const lat2 = Scratch.Cast.toNumber(args.LATITUDE2);
      const lon2 = Scratch.Cast.toNumber(args.LONGITUDE2);
      return Math.round(this.calculateDistance(lat1, lon1, lat2, lon2));
    } catch { return 0; }
  }

  getMapBounds() {
    try {
      const corners = {
        northWest: { x: -this.canvas.width/2, y: this.canvas.height/2 },
        northEast: { x: this.canvas.width/2, y: this.canvas.height/2 },
        southWest: { x: -this.canvas.width/2, y: -this.canvas.height/2 },
        southEast: { x: this.canvas.width/2, y: -this.canvas.height/2 }
      };
      const bounds = {};
      for (const [corner, coords] of Object.entries(corners)) {
        const loc = this.getScratchCoordinateLocation(coords.x, coords.y);
        if (!loc) continue;
        const [pos1, pos2] = corner.split(/(?=[A-Z])/);
        if (!bounds[pos1.toLowerCase()]) bounds[pos1.toLowerCase()] = loc.latitude;
        if (!bounds[pos2.toLowerCase()]) bounds[pos2.toLowerCase()] = loc.longitude;
        bounds[pos1.toLowerCase()] = pos1 === 'north' ?
          Math.max(bounds[pos1.toLowerCase()], loc.latitude) :
          Math.min(bounds[pos1.toLowerCase()], loc.latitude);
        bounds[pos2.toLowerCase()] = pos2 === 'east' ?
          Math.max(bounds[pos2.toLowerCase()], loc.longitude) :
          Math.min(bounds[pos2.toLowerCase()], loc.longitude);
      }
      return bounds;
    } catch { return null; }
  }

  moveToCoordinateWithSpeed(args, util) {
    const targetLatitude = Scratch.Cast.toNumber(args.LATITUDE);
    const targetLongitude = Scratch.Cast.toNumber(args.LONGITUDE);
    const speedMps = Scratch.Cast.toNumber(args.SPEED);
    try {
      if (!this.preciseMovements.has(util.target.id)) {
        this.preciseMovements.set(util.target.id, new PreciseMovementController());
      }
      const movement = this.preciseMovements.get(util.target.id);
      const target = this.convertLatLngToScratch(targetLatitude, targetLongitude);
      const currentLatitude = this.getScratchCoordinateLatitude(util.target.x, util.target.y);
      const mpp = this.getMetersPerPixel(currentLatitude, this.tileMap.currentZoom);
      if (!movement.isMoving) movement.startMovement(util.target.x, util.target.y, speedMps);
      const done = movement.updateMovement(util.target, target.x, target.y, speedMps, this.timeScale, mpp);
      if (!done) util.yield(); else this.preciseMovements.delete(util.target.id);
    } catch (e) {
      console.error('moveToCoordinateWithSpeed:', e);
      this.preciseMovements.delete(util.target.id);
    }
  }

  getScratchCoordinateLocation(scratchX, scratchY) {
    const z = this.tileMap.currentZoom;
    const worldW = 256 * Math.pow(2, z);
    const centerX = ((this.tileMap.centerLongitude + 180) / 360) * worldW;
    const centerSinLat = Math.sin((this.tileMap.centerLatitude * Math.PI) / 180);
    const centerY = (0.5 - Math.log((1 + centerSinLat) / (1 - centerSinLat)) / (4 * Math.PI)) * worldW;

    const targetX = centerX + scratchX;
    const targetY = centerY - scratchY;

    const lon = (targetX / worldW) * 360 - 180;
    const latRad = Math.PI * (1 - 2 * (targetY / worldW));
    const lat = (Math.atan(Math.sinh(latRad)) * 180) / Math.PI;
    return { latitude: Number(lat.toFixed(6)), longitude: Number(lon.toFixed(6)) };
  }

  _normalizeCoordinate(value) {
    if (value === null || value === undefined) throw new Error('Invalid coordinate');
    return typeof value === 'function' ? Number(value()) : Number(String(value));
  }

  getSimulationTime() {
    const realElapsed = Date.now() - this.realStartTime;
    return this.simulationStartTime + (realElapsed * this.timeScale);
  }
  setTimeScale(args) {
    const newScale = Scratch.Cast.toNumber(args.SCALE);
    if (newScale > 0) {
      const cur = this.getSimulationTime();
      this.timeScale = newScale;
      this.realStartTime = Date.now();
      this.simulationStartTime = cur;
    }
  }
  getCurrentSimulationTime() {
    return Math.floor((this.getSimulationTime() - this.simulationStartTime) / 1000);
  }

  async addressSearchAndDisplay(args) {
    const address = Scratch.Cast.toString(args.ADDRESS);
    const zoom = Math.floor(Scratch.Cast.toNumber(args.ZOOM));
    try {
      const res = await fetch(`https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(address)}`);
      const results = await res.json();
      if (results.length > 0) {
        const loc = results[0];
        const latitude = parseFloat(loc.geometry.coordinates[1]);
        const longitude = parseFloat(loc.geometry.coordinates[0]);
        this.tileMap.centerLatitude = latitude;
        this.tileMap.centerLongitude = longitude;
        this.tileMap.currentZoom = zoom;
        await this.drawTileMap({ LATITUDE: latitude, LONGITUDE: longitude, ZOOM: zoom });
      } else {
        console.error('No geocode results');
      }
    } catch (e) {
      console.error('Geocoding error:', e);
    }
  }

  async drawTileMap(args) {
    const latitude = Scratch.Cast.toNumber(args.LATITUDE);
    const longitude = Scratch.Cast.toNumber(args.LONGITUDE);
    const zoom = Math.floor(Scratch.Cast.toNumber(args.ZOOM));

    Object.assign(this.tileMap, {
      centerLatitude: latitude,
      centerLongitude: longitude,
      currentZoom: zoom
    });
    this.tileMap.buildTiles(zoom, longitude, latitude, this.canvas.width, this.canvas.height);
    await this.drawTileImages();
  }

  async drawTileImages() {
    // overlay canvas mount is handled by wrapper (see bottom)
    const ctx = this.canvas.getContext('2d');
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.filter = 'saturate(1.2) contrast(1.05)';

    const imagePromises = this.tileMap.tiles.map(tile =>
      this.tileCache.getImage(tile.zoom, tile.x, tile.y).catch(() => null)
    );

    try {
      const images = await Promise.all(imagePromises);
      images.forEach((img, i) => {
        if (!img) return;
        const tile = this.tileMap.tiles[i];
        ctx.drawImage(img, tile.screenX, tile.screenY);
      });
    } catch (e) {
      console.error('Tile drawing error:', e);
    } finally {
      ctx.filter = 'none';
    }
  }

  async getElevation(args) {
    try {
      let latitude, longitude;
      if (args.COORDINATES) {
        const m = args.COORDINATES.match(/緯度:\s*([\d.-]+),\s*経度:\s*([\d.-]+)/);
        if (m) { latitude = parseFloat(m[1]); longitude = parseFloat(m[2]); } else { return '無効な座標形式'; }
      } else if (args.LATITUDE && args.LONGITUDE) {
        latitude = this._normalizeCoordinate(args.LATITUDE);
        longitude = this._normalizeCoordinate(args.LONGITUDE);
      } else return 'エラー: 緯度経度が指定されていません';

      if (isNaN(latitude) || isNaN(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        return '範囲外: 無効な座標です';
      }
      const url = `https://cyberjapandata2.gsi.go.jp/general/dem/scripts/getelevation.php?lon=${longitude}&lat=${latitude}&outtype=JSON`;
      const res = await fetch(url); const data = await res.json();
      if (data && typeof data.elevation === 'number') return `${Number(data.elevation.toFixed(1))}`;
      if (data && data.elevation === null) return '標高データなし';
      return 'エラー: 標高の取得に失敗';
    } catch (e) { console.error('Elevation error:', e); return 'エラー: 標高取得失敗'; }
  }

  moveMap(args) {
    const direction = Scratch.Cast.toString(args.DIRECTION).toLowerCase();
    const step = 0.0005;
    if (direction === '上') this.tileMap.centerLatitude += step;
    else if (direction === '下') this.tileMap.centerLatitude -= step;
    else if (direction === '左') this.tileMap.centerLongitude -= step;
    else if (direction === '右') this.tileMap.centerLongitude += step;
    this.tileMap.buildTiles(this.tileMap.currentZoom, this.tileMap.centerLongitude, this.tileMap.centerLatitude, this.canvas.width, this.canvas.height);
    this.drawTileImages();
  }

  convertLatLngToScratch(latitude, longitude) {
    const z = this.tileMap.currentZoom;
    const worldW = 256 * Math.pow(2, z);
    const centerX = ((this.tileMap.centerLongitude + 180) / 360) * worldW;
    const centerSin = Math.sin((this.tileMap.centerLatitude * Math.PI) / 180);
    const centerY = (0.5 - Math.log((1 + centerSin) / (1 - centerSin)) / (4 * Math.PI)) * worldW;

    const targetX = ((longitude + 180) / 360) * worldW;
    const targetSin = Math.sin((latitude * Math.PI) / 180);
    const targetY = (0.5 - Math.log((1 + targetSin) / (1 - targetSin)) / (4 * Math.PI)) * worldW;

    return { x: targetX - centerX, y: centerY - targetY };
  }

  getMonitored() {
    return {
      sprite_latitude: {
        isSpriteSpecific: true,
        getId: id => `${id}_latitude`,
        get: target => this.getScratchCoordinateLatitude(target.x, target.y)
      },
      sprite_longitude: {
        isSpriteSpecific: true,
        getId: id => `${id}_longitude`,
        get: target => this.getScratchCoordinateLongitude(target.x, target.y)
      }
    };
  }

  moveSpriteToCoordinates(args, util) {
    const lat = Scratch.Cast.toNumber(args.LATITUDE);
    const lon = Scratch.Cast.toNumber(args.LONGITUDE);
    const coords = this.convertLatLngToScratch(lat, lon);
    util.target.setXY(coords.x, coords.y);
  }

  getCurrentLocation(args, util) {
    try {
      const loc = this.getScratchCoordinateLocation(util.target.x, util.target.y);
      return `緯度: ${loc.latitude}, 経度: ${loc.longitude}`;
    } catch { return '座標取得エラー'; }
  }

  getScratchCoordinateLatitude(scratchX, scratchY) {
    try {
      const z = this.tileMap.currentZoom;
      const worldW = 256 * Math.pow(2, z);
      const centerX = ((this.tileMap.centerLongitude + 180) / 360) * worldW;
      const centerSin = Math.sin((this.tileMap.centerLatitude * Math.PI) / 180);
      const centerY = (0.5 - Math.log((1 + centerSin) / (1 - centerSin)) / (4 * Math.PI)) * worldW;
      const targetY = centerY - scratchY;
      const latRad = Math.PI * (1 - 2 * (targetY / worldW));
      const lat = (Math.atan(Math.sinh(latRad)) * 180) / Math.PI;
      return Number(lat.toFixed(6));
    } catch { return 0; }
  }
  getScratchCoordinateLongitude(scratchX, scratchY) {
    try {
      const z = this.tileMap.currentZoom;
      const worldW = 256 * Math.pow(2, z);
      const centerX = ((this.tileMap.centerLongitude + 180) / 360) * worldW;
      const targetX = centerX + scratchX;
      const lon = (targetX / worldW) * 360 - 180;
      return Number(lon.toFixed(6));
    } catch { return 0; }
  }

  getMetersPerPixel(latitude, zoom) {
    const EARTH = 40075016.686;
    const rad = latitude * Math.PI / 180;
    return (EARTH * Math.cos(rad)) / Math.pow(2, zoom + 8);
  }

  getCurrentLatitude(args, util) { return this.getScratchCoordinateLatitude(util.target.x, util.target.y); }
  getCurrentLongitude(args, util) { return this.getScratchCoordinateLongitude(util.target.x, util.target.y); }

  moveStepWithSpeedTowardCoordinate(args, util) {
    try {
      if (!this.preciseMovement) this.preciseMovement = new PreciseMovementController();
      const baseSpeedMS = Scratch.Cast.toNumber(args.SPEED);
      const targetLat = Scratch.Cast.toNumber(args.LATITUDE);
      const targetLon = Scratch.Cast.toNumber(args.LONGITUDE);
      const timeScale = Scratch.Cast.toNumber(args.TIMESCALE);
      const target = this.convertLatLngToScratch(targetLat, targetLon);
      const currentLat = this.getScratchCoordinateLatitude(util.target.x, util.target.y);
      const mpp = this.getMetersPerPixel(currentLat, this.tileMap.currentZoom);
      const done = this.preciseMovement.updateMovement(
        util.target, target.x, target.y, baseSpeedMS, timeScale, mpp
      );
      if (done) this.preciseMovement = new PreciseMovementController();
    } catch (e) { console.error('precise move step:', e); }
  }

  convertScratchDistanceToMeters(pixels, latitude, zoom) {
    const mpp = this.getMetersPerPixel(latitude, zoom);
    return pixels * mpp;
  }

  getNorthLatitude() { const b = this.getMapBounds(); return b ? Number(b.north.toFixed(6)) : 0; }
  getSouthLatitude() { const b = this.getMapBounds(); return b ? Number(b.south.toFixed(6)) : 0; }
  getEastLongitude() { const b = this.getMapBounds(); return b ? Number(b.east.toFixed(6)) : 0; }
  getWestLongitude() { const b = this.getMapBounds(); return b ? Number(b.west.toFixed(6)) : 0; }

  getLatitudeFromCoordinates(args) {
    try { return this.getScratchCoordinateLatitude(Scratch.Cast.toNumber(args.X), Scratch.Cast.toNumber(args.Y)); }
    catch { return 0; }
  }
  getLongitudeFromCoordinates(args) {
    try { return this.getScratchCoordinateLongitude(Scratch.Cast.toNumber(args.X), Scratch.Cast.toNumber(args.Y)); }
    catch { return 0; }
  }
  getXFromCoordinates(args) {
    try {
      const c = this.convertLatLngToScratch(Scratch.Cast.toNumber(args.LATITUDE), Scratch.Cast.toNumber(args.LONGITUDE));
      return Number(c.x.toFixed(2));
    } catch { return 0; }
  }
  getYFromCoordinates(args) {
    try {
      const c = this.convertLatLngToScratch(Scratch.Cast.toNumber(args.LATITUDE), Scratch.Cast.toNumber(args.LONGITUDE));
      return Number(c.y.toFixed(2));
    } catch { return 0; }
  }

  // Data access helpers
  getScratchList(target, listName) {
    try { const list = target.lookupVariableByNameAndType(listName, 'list'); return list ? list.value : null; }
    catch (e) { console.error(`get list ${listName}:`, e); return null; }
  }
  getScratchVariable(target, variableName) {
    try { const v = target.lookupVariableByNameAndType(variableName, ''); return v ? v.value : null; }
    catch (e) { console.error(`get var ${variableName}:`, e); return null; }
  }
  setScratchVariable(target, variableName, value) {
    try { const v = target.lookupVariableByNameAndType(variableName, ''); if (v) { v.value = value; return true; } return false; }
    catch (e) { console.error(`set var ${variableName}:`, e); return false; }
  }

  addPathToList(target, pathArray) {
    try {
      let pathList = target.lookupVariableByNameAndType('最短経路', 'list');
      if (!pathList) {
        const id = Math.random().toString(36).slice(2, 11);
        pathList = target.createVariable(id, '最短経路', 'list');
      }
      pathList.value = [];
      pathArray.forEach(nodeId => pathList.value.push(String(nodeId)));
      return true;
    } catch (e) { console.error('addPathToList:', e); return false; }
  }

  clearPathList() {
    try {
      const stage = this.runtime.getTargetForStage();
      if (!stage) return;
      const list = stage.lookupVariableByNameAndType('最短経路', 'list');
      if (list) list.value = [];
    } catch (e) { console.error('clearPathList:', e); }
  }

  findPathFromScratchData(args) {
    try {
      const startNodeId = Scratch.Cast.toNumber(args.START_NODE_ID);
      const goalNodeId = Scratch.Cast.toNumber(args.GOAL_NODE_ID);
      const stage = this.runtime.getTargetForStage();
      if (!stage) return 'エラー: ステージが見つかりません';

      const ids = this.getScratchList(stage, '表示NodeID');
      const xs = this.getScratchList(stage, '表示NodeX');
      const ys = this.getScratchList(stage, '表示NodeY');
      const froms = this.getScratchList(stage, '表示LinkFrom');
      const tos = this.getScratchList(stage, '表示LinkTo');
      if (!ids || !xs || !ys || !froms || !tos) return 'エラー: 道路ネットワークデータが見つかりません';
      if (ids.length !== xs.length || ids.length !== ys.length) return 'エラー: ノードデータの長さ不一致';
      if (froms.length !== tos.length) return 'エラー: リンクデータの長さ不一致';

      const nodeArray = [];
      for (let i = 0; i < ids.length; i++) nodeArray.push([Number(ids[i]), Number(xs[i]), Number(ys[i])]);

      const linkArray = [];
      for (let i = 0; i < froms.length; i++) {
        const f = Number(froms[i]), t = Number(tos[i]);
        const fn = nodeArray.find(n => n[0] === f), tn = nodeArray.find(n => n[0] === t);
        if (fn && tn) {
          const dx = tn[1] - fn[1], dy = tn[2] - fn[2];
          linkArray.push([f, t, Math.sqrt(dx*dx + dy*dy)]);
        }
      }

      this.pathfinder.setNodes(nodeArray);
      this.pathfinder.setLinks(linkArray);
      const path = this.pathfinder.findPath(startNodeId, goalNodeId);

      if (path.length > 0) {
        this.addPathToList(stage, path);
        const result = path.join(',');
        this.setScratchVariable(stage, '経路探索結果', result);
        return result;
      } else {
        const msg = 'パスが見つかりません';
        this.setScratchVariable(stage, '経路探索結果', msg);
        return msg;
      }
    } catch (e) {
      console.error('findPathFromScratchData:', e);
      const msg = 'エラー: 経路探索に失敗しました';
      const stage = this.runtime.getTargetForStage();
      if (stage) this.setScratchVariable(stage, '経路探索結果', msg);
      return msg;
    }
  }

  findPathToPathList(args) {
    try {
      const startNodeId = Scratch.Cast.toNumber(args.START_NODE_ID);
      const goalNodeId = Scratch.Cast.toNumber(args.GOAL_NODE_ID);
      const stage = this.runtime.getTargetForStage();
      if (!stage) { console.error('ステージが見つかりません'); return; }
      const targetList = stage.lookupVariableByNameAndType('Path', 'list');
      if (!targetList) { console.error('リスト "Path" が見つかりません'); return; }

      const ids = this.getScratchList(stage, '表示NodeID');
      const xs = this.getScratchList(stage, '表示NodeX');
      const ys = this.getScratchList(stage, '表示NodeY');
      const froms = this.getScratchList(stage, '表示LinkFrom');
      const tos = this.getScratchList(stage, '表示LinkTo');
      if (!ids || !xs || !ys || !froms || !tos) { console.error('道路ネットワークデータが見つかりません'); return; }

      const nodeArray = [];
      for (let i = 0; i < ids.length; i++) nodeArray.push([Number(ids[i]), Number(xs[i]), Number(ys[i])]);
      const linkArray = [];
      for (let i = 0; i < froms.length; i++) {
        const f = Number(froms[i]), t = Number(tos[i]);
        const fn = nodeArray.find(n => n[0] === f), tn = nodeArray.find(n => n[0] === t);
        if (fn && tn) {
          const dx = tn[1] - fn[1], dy = tn[2] - fn[2];
          linkArray.push([f, t, Math.sqrt(dx*dx + dy*dy)]);
        }
      }

      this.pathfinder.setNodes(nodeArray);
      this.pathfinder.setLinks(linkArray);
      const path = this.pathfinder.findPath(startNodeId, goalNodeId);

      if (path.length > 0) {
        targetList.value = [];
        path.forEach(nodeId => targetList.value.push(String(nodeId)));
      } else {
        console.error('パスが見つかりません');
      }
    } catch (e) { console.error('findPathToPathList:', e); }
  }

  moveToXYWithPixelSpeed(args, util) {
    const targetX = Scratch.Cast.toNumber(args.X);
    const targetY = Scratch.Cast.toNumber(args.Y);
    const speedPxPerSec = Scratch.Cast.toNumber(args.SPEED);
    try {
      if (!this.preciseMovements.has(util.target.id)) {
        this.preciseMovements.set(util.target.id, new PreciseMovementController());
      }
      const movement = this.preciseMovements.get(util.target.id);
      if (!movement.isMoving) movement.startMovement(util.target.x, util.target.y, speedPxPerSec);
      const metersPerPixel = 1.0;
      const done = movement.updateMovement(
        util.target, targetX, targetY, speedPxPerSec, this.timeScale, metersPerPixel
      );
      if (!done) util.yield(); else this.preciseMovements.delete(util.target.id);
    } catch (e) { console.error('moveToXYWithPixelSpeed:', e); this.preciseMovements.delete(util.target.id); }
  }

  moveToXYWithMeterSpeed(args, util) {
    const targetX = Scratch.Cast.toNumber(args.X);
    const targetY = Scratch.Cast.toNumber(args.Y);
    const speedMps = Scratch.Cast.toNumber(args.SPEED);
    try {
      if (!this.preciseMovements.has(util.target.id)) {
        this.preciseMovements.set(util.target.id, new PreciseMovementController());
      }
      const movement = this.preciseMovements.get(util.target.id);
      const currentLat = this.getScratchCoordinateLatitude(util.target.x, util.target.y);
      const mpp = this.getMetersPerPixel(currentLat, this.tileMap.currentZoom);
      if (!movement.isMoving) movement.startMovement(util.target.x, util.target.y, speedMps);
      const done = movement.updateMovement(
        util.target, targetX, targetY, speedMps, this.timeScale, mpp
      );
      if (!done) util.yield(); else this.preciseMovements.delete(util.target.id);
    } catch (e) { console.error('moveToXYWithMeterSpeed:', e); this.preciseMovements.delete(util.target.id); }
  }

  getInfo() {
    const ArgumentType = Scratch.ArgumentType;
    const BlockType = Scratch.BlockType;
    return {
      id: 'openStreetMap',
      name: '追加ブロック',
      blocks: [
        {
          opcode: 'moveToXYWithPixelSpeed',
          blockType: BlockType.COMMAND,
          text: '秒速 [SPEED] ピクセルでx座標を [X] 、y座標を [Y] にする',
          arguments: { SPEED: { type: ArgumentType.NUMBER, defaultValue: 50 }, X: { type: ArgumentType.NUMBER, defaultValue: 0 }, Y: { type: ArgumentType.NUMBER, defaultValue: 0 } }
        },
        {
          opcode: 'moveToXYWithMeterSpeed',
          blockType: BlockType.COMMAND,
          text: '秒速 [SPEED] m/sでx座標を [X] 、y座標を [Y] にする',
          arguments: { SPEED: { type: ArgumentType.NUMBER, defaultValue: 1.0 }, X: { type: ArgumentType.NUMBER, defaultValue: 0 }, Y: { type: ArgumentType.NUMBER, defaultValue: 0 } }
        },
        {
          opcode: 'moveSpriteToCoordinates',
          text: '緯度を [LATITUDE] 、経度 を[LONGITUDE] にする',
          blockType: BlockType.COMMAND,
          arguments: { LATITUDE: { type: ArgumentType.NUMBER, defaultValue: 35.3251096 }, LONGITUDE: { type: ArgumentType.NUMBER, defaultValue: 139.558511 } }
        },
        {
          opcode: 'addressSearchAndDisplay',
          blockType: BlockType.COMMAND,
          text: '住所 [ADDRESS] の地図をズームレベル [ZOOM] で表示',
          arguments: { ADDRESS: { type: ArgumentType.STRING, defaultValue: '神奈川県鎌倉市雪ノ下3丁目5-10' }, ZOOM: { type: ArgumentType.NUMBER, defaultValue: 16 } }
        },
        {
          opcode: 'drawTileMap',
          blockType: BlockType.COMMAND,
          text: '緯度[LATITUDE] 経度[LONGITUDE] の地図をズームレベル [ZOOM] で表示',
          arguments: { LATITUDE: { type: ArgumentType.NUMBER, defaultValue: 35.3251096 }, LONGITUDE: { type: ArgumentType.NUMBER, defaultValue: 139.558511 }, ZOOM: { type: ArgumentType.NUMBER, defaultValue: 16 } }
        },
        {
          opcode: 'moveMap',
          text: '地図を [DIRECTION] 方向に動かす',
          blockType: BlockType.COMMAND,
          arguments: { DIRECTION: { type: ArgumentType.STRING, menu: 'directions', defaultValue: '上' } }
        },
        {
          opcode: 'getElevation',
          blockType: BlockType.REPORTER,
          text: '緯度 [LATITUDE] 経度 [LONGITUDE] の場所の高さ(m)',
          arguments: { LATITUDE: { type: ArgumentType.NUMBER, defaultValue: 35.3251096 }, LONGITUDE: { type: ArgumentType.NUMBER, defaultValue: 139.558511 } }
        },
        { opcode: 'getCurrentLatitude', blockType: BlockType.REPORTER, text: 'スプライトがいる場所の緯度', arguments: {} },
        { opcode: 'getCurrentLongitude', blockType: BlockType.REPORTER, text: 'スプライトがいる場所の経度', arguments: {} },
        { opcode: 'getDistanceScale', blockType: BlockType.REPORTER, text: '1pxが実際の何メートルに相当するか', arguments: {} },
        {
          opcode: 'moveToCoordinateWithSpeed',
          blockType: BlockType.COMMAND,
          text: '秒速 [SPEED] メートルで緯度 [LATITUDE] 経度 [LONGITUDE] まで移動する',
          arguments: {
            SPEED: { type: ArgumentType.NUMBER, defaultValue: 1.0 },
            LATITUDE: { type: ArgumentType.NUMBER, defaultValue: 35.3251096 },
            LONGITUDE: { type: ArgumentType.NUMBER, defaultValue: 139.558511 }
          }
        },
        {
          opcode: 'calculateDistanceBetweenPoints',
          blockType: BlockType.REPORTER,
          text: '緯度[LATITUDE1]経度[LONGITUDE1]から緯度[LATITUDE2]経度[LONGITUDE2]までの距離(m)',
          arguments: {
            LATITUDE1: { type: ArgumentType.NUMBER, defaultValue: 35.689185 },
            LONGITUDE1: { type: ArgumentType.NUMBER, defaultValue: 139.691648 },
            LATITUDE2: { type: ArgumentType.NUMBER, defaultValue: 35.6895 },
            LONGITUDE2: { type: ArgumentType.NUMBER, defaultValue: 139.692 }
          }
        },
        { opcode: 'getNorthLatitude', blockType: BlockType.REPORTER, text: '表示中の地図の北端の緯度', arguments: {} },
        { opcode: 'getSouthLatitude', blockType: BlockType.REPORTER, text: '表示中の地図の南端の緯度', arguments: {} },
        { opcode: 'getEastLongitude', blockType: BlockType.REPORTER, text: '表示中の地図の東端の経度', arguments: {} },
        { opcode: 'getWestLongitude', blockType: BlockType.REPORTER, text: '表示中の地図の西端の経度', arguments: {} },
        {
          opcode: 'getLatitudeFromCoordinates',
          blockType: BlockType.REPORTER,
          text: 'x座標 [X] y座標 [Y] の場所の緯度',
          arguments: { X: { type: ArgumentType.NUMBER, defaultValue: 0 }, Y: { type: ArgumentType.NUMBER, defaultValue: 0 } }
        },
        {
          opcode: 'getLongitudeFromCoordinates',
          blockType: BlockType.REPORTER,
          text: 'x座標 [X] y座標 [Y] の場所の経度',
          arguments: { X: { type: ArgumentType.NUMBER, defaultValue: 0 }, Y: { type: ArgumentType.NUMBER, defaultValue: 0 } }
        },
        {
          opcode: 'getXFromCoordinates',
          blockType: BlockType.REPORTER,
          text: '緯度 [LATITUDE] 経度 [LONGITUDE] の場所のx座標',
          arguments: { LATITUDE: { type: ArgumentType.NUMBER, defaultValue: 35.3251096 }, LONGITUDE: { type: ArgumentType.NUMBER, defaultValue: 139.558511 } }
        },
        {
          opcode: 'getYFromCoordinates',
          blockType: BlockType.REPORTER,
          text: '緯度 [LATITUDE] 経度 [LONGITUDE] の場所のy座標',
          arguments: { LATITUDE: { type: ArgumentType.NUMBER, defaultValue: 35.3251096 }, LONGITUDE: { type: ArgumentType.NUMBER, defaultValue: 139.558511 } }
        },
        {
          opcode: 'findPathToPathList',
          blockType: BlockType.COMMAND,
          text: 'ノード[START_NODE_ID]からノード[GOAL_NODE_ID]への最短経路を「Path」リストに追加',
          arguments: { START_NODE_ID: { type: ArgumentType.NUMBER, defaultValue: 255479223 }, GOAL_NODE_ID: { type: ArgumentType.NUMBER, defaultValue: 255479334 } }
        }
      ],
      menus: { directions: { acceptReporters: true, items: ['上', '下', '左', '右'] } }
    };
  }
}

// ===== URL Extension Wrapper: mount overlay and register =====
(function (Scratch) {
  'use strict';
  if (!Scratch || !Scratch.extensions) {
    console.error('This extension must run in TurboWarp/Scratch-compatible environment.');
    return;
  }

  const mountOverlayCanvas = (ext) => {
    if (ext._overlayMounted) return;
    const stageCanvas = document.querySelector('canvas.stage, .stage_stage_3v43B') || document.querySelector('canvas');
    const container = stageCanvas?.parentElement || document.body;

    ext.canvas.style.position = 'absolute';
    ext.canvas.style.left = '0';
    ext.canvas.style.top = '0';
    ext.canvas.style.pointerEvents = 'none';
    ext.canvas.width = 480;
    ext.canvas.height = 360;
    container.appendChild(ext.canvas);
    ext._overlayMounted = true;

    const resize = () => {
      const s = document.querySelector('canvas.stage, .stage_stage_3v43B') || ext.canvas;
      const rect = s.getBoundingClientRect ? s.getBoundingClientRect() : {width:480,height:360,left:0,top:0};
      ext.canvas.style.width = rect.width + 'px';
      ext.canvas.style.height = rect.height + 'px';
      ext.canvas.style.left = rect.left + 'px';
      ext.canvas.style.top = rect.top + 'px';
    };
    resize();
    window.addEventListener('resize', resize);
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(() => resize());
      ro.observe(container);
    }
  };

  const _origDraw = Scratch3OpenStreetMapBlocks.prototype.drawTileImages;
  Scratch3OpenStreetMapBlocks.prototype.drawTileImages = async function () {
    mountOverlayCanvas(this);
    await _origDraw.apply(this, []);
  };

  Scratch.extensions.register(new Scratch3OpenStreetMapBlocks(Scratch.vm.runtime));
})(Scratch);
