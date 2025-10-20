// TurboWarp用のScratch拡張機能
// このファイルをGitHub Pagesでホストして使用します

(function(Scratch) {
    'use strict';

    // 必要なクラスの定義
    const ArgumentType = Scratch.ArgumentType;
    const BlockType = Scratch.BlockType;
    const Cast = Scratch.Cast;

    // Timer クラス
    class Timer {
        constructor() {
            this.startTime = 0;
        }
        start() {
            this.startTime = Date.now();
        }
        timeElapsed() {
            return Date.now() - this.startTime;
        }
    }

    // PreciseMovementController クラス
    class PreciseMovementController {
        constructor() {
            this.startTime = 0;
            this.lastUpdateTime = 0;
            this.lastPosition = { x: 0, y: 0 };
            this.targetSpeed = 0;
            this.accumulatedError = 0;
            this.isMoving = false;
            this.updateInterval = 33.33;
        }

        startMovement(startX, startY, speed) {
            const now = Date.now();
            this.startTime = now;
            this.lastUpdateTime = now;
            this.lastPosition = { x: startX, y: startY };
            this.targetSpeed = speed;
            this.accumulatedError = 0;
            this.isMoving = true;
        }

        calculateNextTarget(currentX, currentY, targetX, targetY, stepDistance) {
            const dx = targetX - currentX;
            const dy = targetY - currentY;
            const totalDistance = Math.sqrt(dx * dx + dy * dy);

            if (totalDistance <= stepDistance) {
                return { x: targetX, y: targetY };
            }

            const directionX = dx / totalDistance;
            const directionY = dy / totalDistance;

            return {
                x: currentX + directionX * stepDistance,
                y: currentY + directionY * stepDistance
            };
        }

        updateMovement(sprite, finalTargetX, finalTargetY, speed, timeScale, metersPerPixel) {
            if (!this.isMoving) {
                return false;
            }

            const currentTime = Date.now();
            const deltaTime = currentTime - this.lastUpdateTime;

            if (deltaTime < this.updateInterval) {
                return false;
            }

            const dx = finalTargetX - sprite.x;
            const dy = finalTargetY - sprite.y;
            const remainingPixels = Math.sqrt(dx * dx + dy * dy);
            const remainingMeters = remainingPixels * metersPerPixel;

            if (remainingMeters < 0.01) {
                sprite.setXY(finalTargetX, finalTargetY);
                this.isMoving = false;
                return true;
            }

            const timeElapsedSeconds = deltaTime / 1000;
            const distanceToMoveMeters = speed * timeScale * timeElapsedSeconds;
            const distanceToMovePixels = distanceToMoveMeters / metersPerPixel;

            const nextTarget = this.calculateNextTarget(
                sprite.x, sprite.y, finalTargetX, finalTargetY,
                distanceToMovePixels + this.accumulatedError
            );

            const actualDx = nextTarget.x - sprite.x;
            const actualDy = nextTarget.y - sprite.y;
            const actualDistance = Math.sqrt(actualDx * actualDx + actualDy * actualDy);
            this.accumulatedError = distanceToMovePixels - actualDistance;

            sprite.setXY(nextTarget.x, nextTarget.y);
            this.lastUpdateTime = currentTime;
            this.lastPosition = { x: nextTarget.x, y: nextTarget.y };

            return false;
        }
    }

    // A*パスファインダー クラス
    class AStarPathfinder {
        constructor() {
            this.nodes = new Map();
            this.links = new Map();
        }

        setNodes(nodeList) {
            this.nodes.clear();
            nodeList.forEach(([id, x, y]) => {
                this.nodes.set(id, { id, x, y });
            });
        }

        setLinks(linkList) {
            this.links.clear();
            linkList.forEach(([from, to, distance]) => {
                if (!this.links.has(from)) {
                    this.links.set(from, []);
                }
                this.links.get(from).push({ to, distance });
                if (!this.links.has(to)) {
                    this.links.set(to, []);
                }
                this.links.get(to).push({ to: from, distance });
            });
        }

        heuristic(nodeA, nodeB) {
            const dx = nodeA.x - nodeB.x;
            const dy = nodeA.y - nodeB.y;
            return Math.sqrt(dx * dx + dy * dy);
        }

        findPath(startId, goalId) {
            const startNode = this.nodes.get(startId);
            const goalNode = this.nodes.get(goalId);

            if (!startNode || !goalNode) {
                console.error('Start or goal node not found');
                return [];
            }

            if (startId === goalId) {
                return [startId];
            }

            const openSet = new Set([startId]);
            const cameFrom = new Map();
            const gScore = new Map();
            const fScore = new Map();

            this.nodes.forEach((node, id) => {
                gScore.set(id, Infinity);
                fScore.set(id, Infinity);
            });

            gScore.set(startId, 0);
            fScore.set(startId, this.heuristic(startNode, goalNode));

            while (openSet.size > 0) {
                let current = null;
                let minFScore = Infinity;
                for (const nodeId of openSet) {
                    const score = fScore.get(nodeId);
                    if (score < minFScore) {
                        minFScore = score;
                        current = nodeId;
                    }
                }

                if (current === goalId) {
                    return this.reconstructPath(cameFrom, current);
                }

                openSet.delete(current);
                const neighbors = this.links.get(current) || [];

                for (const neighbor of neighbors) {
                    const neighborId = neighbor.to;
                    const tentativeGScore = gScore.get(current) + neighbor.distance;

                    if (tentativeGScore < gScore.get(neighborId)) {
                        cameFrom.set(neighborId, current);
                        gScore.set(neighborId, tentativeGScore);
                        const neighborNode = this.nodes.get(neighborId);
                        fScore.set(neighborId, tentativeGScore + this.heuristic(neighborNode, goalNode));
                        openSet.add(neighborId);
                    }
                }
            }

            return [];
        }

        reconstructPath(cameFrom, current) {
            const path = [current];
            while (cameFrom.has(current)) {
                current = cameFrom.get(current);
                path.unshift(current);
            }
            return path;
        }
    }

    // TileMapクラス（簡略版 - 実際のtile-map.jsから移植）
    class TileMap {
        constructor() {
            this.centerLatitude = 35.689185;
            this.centerLongitude = 139.691648;
            this.currentZoom = 18;
            this.tiles = [];
        }

        buildTiles(zoom, longitude, latitude, width, height) {
            this.tiles = [];
            const worldWidth = 256 * Math.pow(2, zoom);
            const centerPixelX = ((longitude + 180) / 360) * worldWidth;
            const centerSinLatitude = Math.sin((latitude * Math.PI) / 180);
            const centerPixelY = (0.5 - Math.log((1 + centerSinLatitude) / (1 - centerSinLatitude)) / (4 * Math.PI)) * worldWidth;

            const tileSize = 256;
            const tilesX = Math.ceil(width / tileSize) + 1;
            const tilesY = Math.ceil(height / tileSize) + 1;

            for (let ty = 0; ty < tilesY; ty++) {
                for (let tx = 0; tx < tilesX; tx++) {
                    const screenX = tx * tileSize - width / 2;
                    const screenY = ty * tileSize - height / 2;
                    const pixelX = centerPixelX + screenX;
                    const pixelY = centerPixelY - screenY;
                    
                    const tileX = Math.floor(pixelX / tileSize);
                    const tileY = Math.floor(pixelY / tileSize);

                    this.tiles.push({
                        x: tileX,
                        y: tileY,
                        zoom: zoom,
                        screenX: screenX,
                        screenY: screenY
                    });
                }
            }
        }
    }

    // TileCacheクラス（簡略版）
    class TileCache {
        constructor() {
            this.cache = new Map();
        }

        async getImage(zoom, x, y) {
            const key = `${zoom}/${x}/${y}`;
            
            if (this.cache.has(key)) {
                return this.cache.get(key);
            }

            try {
                const url = `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`;
                const image = new Image();
                image.crossOrigin = 'anonymous';
                
                const promise = new Promise((resolve, reject) => {
                    image.onload = () => resolve(image);
                    image.onerror = reject;
                });
                
                image.src = url;
                const loadedImage = await promise;
                this.cache.set(key, loadedImage);
                return loadedImage;
            } catch (error) {
                console.error('Tile loading error:', error);
                return null;
            }
        }
    }

    // メイン拡張機能クラス
    class Scratch3OpenStreetMapBlocks {
        constructor(runtime) {
            this.runtime = runtime;
            this.tileMap = new TileMap();
            this.tileCache = new TileCache();
            this.timeScale = 1.0;
            this.preciseMovements = new Map();
            this.pathfinder = new AStarPathfinder();
            
            this.canvas = document.createElement('canvas');
            this.canvas.width = 480;
            this.canvas.height = 360;
        }

        getInfo() {
            return {
                id: 'openStreetMap',
                name: '地図拡張機能',
                blocks: [
                    {
                        opcode: 'drawTileMap',
                        blockType: BlockType.COMMAND,
                        text: '緯度[LATITUDE] 経度[LONGITUDE] の地図をズーム[ZOOM]で表示',
                        arguments: {
                            LATITUDE: {
                                type: ArgumentType.NUMBER,
                                defaultValue: 35.689185
                            },
                            LONGITUDE: {
                                type: ArgumentType.NUMBER,
                                defaultValue: 139.691648
                            },
                            ZOOM: {
                                type: ArgumentType.NUMBER,
                                defaultValue: 16
                            }
                        }
                    },
                    {
                        opcode: 'moveSpriteToCoordinates',
                        blockType: BlockType.COMMAND,
                        text: '緯度[LATITUDE] 経度[LONGITUDE] に移動',
                        arguments: {
                            LATITUDE: {
                                type: ArgumentType.NUMBER,
                                defaultValue: 35.689185
                            },
                            LONGITUDE: {
                                type: ArgumentType.NUMBER,
                                defaultValue: 139.691648
                            }
                        }
                    },
                    {
                        opcode: 'getCurrentLatitude',
                        blockType: BlockType.REPORTER,
                        text: '現在の緯度'
                    },
                    {
                        opcode: 'getCurrentLongitude',
                        blockType: BlockType.REPORTER,
                        text: '現在の経度'
                    },
                    {
                        opcode: 'moveToXYWithPixelSpeed',
                        blockType: BlockType.COMMAND,
                        text: '秒速[SPEED]ピクセルでX:[X] Y:[Y]に移動',
                        arguments: {
                            SPEED: {
                                type: ArgumentType.NUMBER,
                                defaultValue: 50
                            },
                            X: {
                                type: ArgumentType.NUMBER,
                                defaultValue: 0
                            },
                            Y: {
                                type: ArgumentType.NUMBER,
                                defaultValue: 0
                            }
                        }
                    }
                ]
            };
        }

        // ブロックの実装メソッド
        drawTileMap(args) {
            const latitude = Cast.toNumber(args.LATITUDE);
            const longitude = Cast.toNumber(args.LONGITUDE);
            const zoom = Math.floor(Cast.toNumber(args.ZOOM));

            this.tileMap.centerLatitude = latitude;
            this.tileMap.centerLongitude = longitude;
            this.tileMap.currentZoom = zoom;
            this.tileMap.buildTiles(zoom, longitude, latitude, this.canvas.width, this.canvas.height);
            
            return this.drawTileImages();
        }

        async drawTileImages() {
            const ctx = this.canvas.getContext('2d');
            ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

            for (const tile of this.tileMap.tiles) {
                const image = await this.tileCache.getImage(tile.zoom, tile.x, tile.y);
                if (image && image.complete) {
                    ctx.drawImage(image, tile.screenX + this.canvas.width/2, tile.screenY + this.canvas.height/2);
                }
            }
        }

        moveSpriteToCoordinates(args, util) {
            const latitude = Cast.toNumber(args.LATITUDE);
            const longitude = Cast.toNumber(args.LONGITUDE);
            const coords = this.convertLatLngToScratch(latitude, longitude);
            util.target.setXY(coords.x, coords.y);
        }

        getCurrentLatitude(args, util) {
            return this.getScratchCoordinateLatitude(util.target.x, util.target.y);
        }

        getCurrentLongitude(args, util) {
            return this.getScratchCoordinateLongitude(util.target.x, util.target.y);
        }

        moveToXYWithPixelSpeed(args, util) {
            const targetX = Cast.toNumber(args.X);
            const targetY = Cast.toNumber(args.Y);
            const speed = Cast.toNumber(args.SPEED);

            if (!this.preciseMovements.has(util.target.id)) {
                this.preciseMovements.set(util.target.id, new PreciseMovementController());
            }
            const movement = this.preciseMovements.get(util.target.id);

            if (!movement.isMoving) {
                movement.startMovement(util.target.x, util.target.y, speed);
            }

            const isComplete = movement.updateMovement(
                util.target, targetX, targetY, speed, this.timeScale, 1.0
            );

            if (!isComplete) {
                util.yield();
            } else {
                this.preciseMovements.delete(util.target.id);
            }
        }

        // ヘルパーメソッド
        convertLatLngToScratch(latitude, longitude) {
            const zoom = this.tileMap.currentZoom;
            const worldWidth = 256 * Math.pow(2, zoom);

            const centerPixelX = ((this.tileMap.centerLongitude + 180) / 360) * worldWidth;
            const centerSinLatitude = Math.sin((this.tileMap.centerLatitude * Math.PI) / 180);
            const centerPixelY = (0.5 - Math.log((1 + centerSinLatitude) / (1 - centerSinLatitude)) / (4 * Math.PI)) * worldWidth;

            const targetPixelX = ((longitude + 180) / 360) * worldWidth;
            const targetSinLatitude = Math.sin((latitude * Math.PI) / 180);
            const targetPixelY = (0.5 - Math.log((1 + targetSinLatitude) / (1 - targetSinLatitude)) / (4 * Math.PI)) * worldWidth;

            return {
                x: targetPixelX - centerPixelX,
                y: centerPixelY - targetPixelY
            };
        }

        getScratchCoordinateLatitude(scratchX, scratchY) {
            const zoom = this.tileMap.currentZoom;
            const worldWidth = 256 * Math.pow(2, zoom);

            const centerPixelX = ((this.tileMap.centerLongitude + 180) / 360) * worldWidth;
            const centerSinLatitude = Math.sin((this.tileMap.centerLatitude * Math.PI) / 180);
            const centerPixelY = (0.5 - Math.log((1 + centerSinLatitude) / (1 - centerSinLatitude)) / (4 * Math.PI)) * worldWidth;

            const targetPixelY = centerPixelY - scratchY;
            const latitudeRad = Math.PI * (1 - 2 * (targetPixelY / worldWidth));
            const latitude = (Math.atan(Math.sinh(latitudeRad)) * 180) / Math.PI;

            return Number(latitude.toFixed(6));
        }

        getScratchCoordinateLongitude(scratchX, scratchY) {
            const zoom = this.tileMap.currentZoom;
            const worldWidth = 256 * Math.pow(2, zoom);

            const centerPixelX = ((this.tileMap.centerLongitude + 180) / 360) * worldWidth;
            const targetPixelX = centerPixelX + scratchX;
            const longitude = (targetPixelX / worldWidth) * 360 - 180;

            return Number(longitude.toFixed(6));
        }
    }

    Scratch.extensions.register(new Scratch3OpenStreetMapBlocks());
})(Scratch);
