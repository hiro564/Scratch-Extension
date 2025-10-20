// Scratch地図拡張機能 - シンプル動作確認版
(function(Scratch) {
    'use strict';

    if (!Scratch.extensions.unsandboxed) {
        throw new Error('この拡張機能はサンドボックス化されていない環境で実行する必要があります');
    }

    class MapExtension {
        constructor() {
            this.centerLat = 35.6762;
            this.centerLon = 139.6503;
            this.zoom = 15;
            console.log('地図拡張機能が読み込まれました');
        }

        getInfo() {
            return {
                id: 'mapExtension',
                name: '地図',
                color1: '#4C97FF',
                color2: '#3373CC',
                blocks: [
                    {
                        opcode: 'setMapCenter',
                        blockType: Scratch.BlockType.COMMAND,
                        text: '地図の中心を 緯度[LAT] 経度[LON] にする',
                        arguments: {
                            LAT: {
                                type: Scratch.ArgumentType.NUMBER,
                                defaultValue: 35.6762
                            },
                            LON: {
                                type: Scratch.ArgumentType.NUMBER,
                                defaultValue: 139.6503
                            }
                        }
                    },
                    {
                        opcode: 'setZoom',
                        blockType: Scratch.BlockType.COMMAND,
                        text: 'ズームレベルを[ZOOM]にする',
                        arguments: {
                            ZOOM: {
                                type: Scratch.ArgumentType.NUMBER,
                                defaultValue: 15
                            }
                        }
                    },
                    {
                        opcode: 'moveToCoordinate',
                        blockType: Scratch.BlockType.COMMAND,
                        text: 'スプライトを 緯度[LAT] 経度[LON] に移動',
                        arguments: {
                            LAT: {
                                type: Scratch.ArgumentType.NUMBER,
                                defaultValue: 35.6762
                            },
                            LON: {
                                type: Scratch.ArgumentType.NUMBER,
                                defaultValue: 139.6503
                            }
                        }
                    },
                    {
                        opcode: 'getCurrentLat',
                        blockType: Scratch.BlockType.REPORTER,
                        text: 'スプライトの緯度'
                    },
                    {
                        opcode: 'getCurrentLon',
                        blockType: Scratch.BlockType.REPORTER,
                        text: 'スプライトの経度'
                    },
                    {
                        opcode: 'getDistance',
                        blockType: Scratch.BlockType.REPORTER,
                        text: '緯度[LAT1]経度[LON1]から緯度[LAT2]経度[LON2]までの距離(m)',
                        arguments: {
                            LAT1: {
                                type: Scratch.ArgumentType.NUMBER,
                                defaultValue: 35.6762
                            },
                            LON1: {
                                type: Scratch.ArgumentType.NUMBER,
                                defaultValue: 139.6503
                            },
                            LAT2: {
                                type: Scratch.ArgumentType.NUMBER,
                                defaultValue: 35.6812
                            },
                            LON2: {
                                type: Scratch.ArgumentType.NUMBER,
                                defaultValue: 139.7671
                            }
                        }
                    }
                ]
            };
        }

        setMapCenter(args) {
            this.centerLat = Number(args.LAT);
            this.centerLon = Number(args.LON);
            console.log(`地図の中心: ${this.centerLat}, ${this.centerLon}`);
        }

        setZoom(args) {
            this.zoom = Math.max(1, Math.min(20, Number(args.ZOOM)));
            console.log(`ズームレベル: ${this.zoom}`);
        }

        moveToCoordinate(args, util) {
            const lat = Number(args.LAT);
            const lon = Number(args.LON);
            const coords = this.latLonToXY(lat, lon);
            util.target.setXY(coords.x, coords.y);
        }

        getCurrentLat(args, util) {
            const coords = this.xyToLatLon(util.target.x, util.target.y);
            return Math.round(coords.lat * 1000000) / 1000000;
        }

        getCurrentLon(args, util) {
            const coords = this.xyToLatLon(util.target.x, util.target.y);
            return Math.round(coords.lon * 1000000) / 1000000;
        }

        getDistance(args) {
            const lat1 = Number(args.LAT1);
            const lon1 = Number(args.LON1);
            const lat2 = Number(args.LAT2);
            const lon2 = Number(args.LON2);

            // ヒュベニの公式で距離を計算
            const R = 6378137; // 地球の半径(m)
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLon = (lon2 - lon1) * Math.PI / 180;
            const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                      Math.sin(dLon / 2) * Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            const distance = R * c;

            return Math.round(distance);
        }

        // 緯度経度をScratch座標に変換
        latLonToXY(lat, lon) {
            const scale = Math.pow(2, this.zoom) * 256 / (2 * Math.PI);
            
            // 中心からの相対位置を計算
            const centerX = this.lonToX(this.centerLon, scale);
            const centerY = this.latToY(this.centerLat, scale);
            const targetX = this.lonToX(lon, scale);
            const targetY = this.latToY(lat, scale);

            return {
                x: targetX - centerX,
                y: centerY - targetY
            };
        }

        // Scratch座標を緯度経度に変換
        xyToLatLon(x, y) {
            const scale = Math.pow(2, this.zoom) * 256 / (2 * Math.PI);
            
            const centerX = this.lonToX(this.centerLon, scale);
            const centerY = this.latToY(this.centerLat, scale);
            const targetX = centerX + x;
            const targetY = centerY - y;

            return {
                lat: this.yToLat(targetY, scale),
                lon: this.xToLon(targetX, scale)
            };
        }

        // ヘルパー関数
        lonToX(lon, scale) {
            return lon * Math.PI / 180 * scale;
        }

        latToY(lat, scale) {
            return Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) * scale;
        }

        xToLon(x, scale) {
            return x / scale * 180 / Math.PI;
        }

        yToLat(y, scale) {
            return (2 * Math.atan(Math.exp(y / scale)) - Math.PI / 2) * 180 / Math.PI;
        }
    }

    Scratch.extensions.register(new MapExtension());
})(Scratch);
