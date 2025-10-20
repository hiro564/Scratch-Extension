// Scratch地図拡張機能 - 完全動作版
// TurboWarpのサンドボックスモードで動作します

class ScratchMapExtension {
    constructor() {
        // 地図の中心座標（デフォルトは東京）
        this.centerLat = 35.6762;
        this.centerLon = 139.6503;
        this.zoom = 15;
        
        console.log('地図拡張機能が正常に読み込まれました');
    }

    getInfo() {
        return {
            id: 'scratchMap',
            name: '地図',
            color1: '#4C97FF',
            color2: '#3373CC',
            color3: '#2E5F8C',
            blocks: [
                {
                    opcode: 'setMapCenter',
                    blockType: 'command',
                    text: '地図の中心を 緯度[LAT] 経度[LON] にする',
                    arguments: {
                        LAT: {
                            type: 'number',
                            defaultValue: 35.6762
                        },
                        LON: {
                            type: 'number',
                            defaultValue: 139.6503
                        }
                    }
                },
                {
                    opcode: 'setZoom',
                    blockType: 'command',
                    text: 'ズームレベルを [ZOOM] にする',
                    arguments: {
                        ZOOM: {
                            type: 'number',
                            defaultValue: 15,
                            menu: 'zoomMenu'
                        }
                    }
                },
                '---',
                {
                    opcode: 'moveToLatLon',
                    blockType: 'command',
                    text: '緯度 [LAT] 経度 [LON] に移動',
                    arguments: {
                        LAT: {
                            type: 'number',
                            defaultValue: 35.6762
                        },
                        LON: {
                            type: 'number',
                            defaultValue: 139.6503
                        }
                    }
                },
                {
                    opcode: 'moveToXY',
                    blockType: 'command',
                    text: 'X座標 [X] Y座標 [Y] に移動',
                    arguments: {
                        X: {
                            type: 'number',
                            defaultValue: 0
                        },
                        Y: {
                            type: 'number',
                            defaultValue: 0
                        }
                    }
                },
                '---',
                {
                    opcode: 'getCurrentLat',
                    blockType: 'reporter',
                    text: '現在の緯度'
                },
                {
                    opcode: 'getCurrentLon',
                    blockType: 'reporter',
                    text: '現在の経度'
                },
                '---',
                {
                    opcode: 'getXFromLatLon',
                    blockType: 'reporter',
                    text: '緯度 [LAT] 経度 [LON] のX座標',
                    arguments: {
                        LAT: {
                            type: 'number',
                            defaultValue: 35.6762
                        },
                        LON: {
                            type: 'number',
                            defaultValue: 139.6503
                        }
                    }
                },
                {
                    opcode: 'getYFromLatLon',
                    blockType: 'reporter',
                    text: '緯度 [LAT] 経度 [LON] のY座標',
                    arguments: {
                        LAT: {
                            type: 'number',
                            defaultValue: 35.6762
                        },
                        LON: {
                            type: 'number',
                            defaultValue: 139.6503
                        }
                    }
                },
                {
                    opcode: 'getLatFromXY',
                    blockType: 'reporter',
                    text: 'X座標 [X] Y座標 [Y] の緯度',
                    arguments: {
                        X: {
                            type: 'number',
                            defaultValue: 0
                        },
                        Y: {
                            type: 'number',
                            defaultValue: 0
                        }
                    }
                },
                {
                    opcode: 'getLonFromXY',
                    blockType: 'reporter',
                    text: 'X座標 [X] Y座標 [Y] の経度',
                    arguments: {
                        X: {
                            type: 'number',
                            defaultValue: 0
                        },
                        Y: {
                            type: 'number',
                            defaultValue: 0
                        }
                    }
                },
                '---',
                {
                    opcode: 'calculateDistance',
                    blockType: 'reporter',
                    text: '緯度[LAT1]経度[LON1] から 緯度[LAT2]経度[LON2] までの距離(m)',
                    arguments: {
                        LAT1: {
                            type: 'number',
                            defaultValue: 35.6762
                        },
                        LON1: {
                            type: 'number',
                            defaultValue: 139.6503
                        },
                        LAT2: {
                            type: 'number',
                            defaultValue: 35.6812
                        },
                        LON2: {
                            type: 'number',
                            defaultValue: 139.7671
                        }
                    }
                },
                {
                    opcode: 'getMapScale',
                    blockType: 'reporter',
                    text: '1ピクセルあたりのメートル数'
                }
            ],
            menus: {
                zoomMenu: {
                    acceptReporters: true,
                    items: [
                        { text: '世界全体 (0)', value: '0' },
                        { text: '大陸 (3)', value: '3' },
                        { text: '国 (6)', value: '6' },
                        { text: '都道府県 (9)', value: '9' },
                        { text: '市区町村 (12)', value: '12' },
                        { text: '街 (15)', value: '15' },
                        { text: '詳細 (18)', value: '18' }
                    ]
                }
            }
        };
    }

    // ========================================
    // ブロック実装
    // ========================================

    setMapCenter(args) {
        this.centerLat = this.toNumber(args.LAT);
        this.centerLon = this.toNumber(args.LON);
    }

    setZoom(args) {
        this.zoom = Math.max(0, Math.min(20, this.toNumber(args.ZOOM)));
    }

    moveToLatLon(args, util) {
        const lat = this.toNumber(args.LAT);
        const lon = this.toNumber(args.LON);
        const pos = this.latLonToXY(lat, lon);
        util.target.setXY(pos.x, pos.y);
    }

    moveToXY(args, util) {
        const x = this.toNumber(args.X);
        const y = this.toNumber(args.Y);
        util.target.setXY(x, y);
    }

    getCurrentLat(args, util) {
        const pos = this.xyToLatLon(util.target.x, util.target.y);
        return this.roundTo(pos.lat, 6);
    }

    getCurrentLon(args, util) {
        const pos = this.xyToLatLon(util.target.x, util.target.y);
        return this.roundTo(pos.lon, 6);
    }

    getXFromLatLon(args) {
        const lat = this.toNumber(args.LAT);
        const lon = this.toNumber(args.LON);
        const pos = this.latLonToXY(lat, lon);
        return this.roundTo(pos.x, 1);
    }

    getYFromLatLon(args) {
        const lat = this.toNumber(args.LAT);
        const lon = this.toNumber(args.LON);
        const pos = this.latLonToXY(lat, lon);
        return this.roundTo(pos.y, 1);
    }

    getLatFromXY(args) {
        const x = this.toNumber(args.X);
        const y = this.toNumber(args.Y);
        const pos = this.xyToLatLon(x, y);
        return this.roundTo(pos.lat, 6);
    }

    getLonFromXY(args) {
        const x = this.toNumber(args.X);
        const y = this.toNumber(args.Y);
        const pos = this.xyToLatLon(x, y);
        return this.roundTo(pos.lon, 6);
    }

    calculateDistance(args) {
        const lat1 = this.toNumber(args.LAT1);
        const lon1 = this.toNumber(args.LON1);
        const lat2 = this.toNumber(args.LAT2);
        const lon2 = this.toNumber(args.LON2);

        // ヒュベニの公式で距離を計算
        const R = 6378137; // 地球の半径(m)
        const rad = Math.PI / 180;
        
        const lat1Rad = lat1 * rad;
        const lat2Rad = lat2 * rad;
        const dLat = (lat2 - lat1) * rad;
        const dLon = (lon2 - lon1) * rad;

        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat1Rad) * Math.cos(lat2Rad) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;

        return Math.round(distance);
    }

    getMapScale() {
        // 1ピクセルあたりのメートル数を計算
        const metersPerPixel = (40075017 * Math.cos(this.centerLat * Math.PI / 180)) / 
                               Math.pow(2, this.zoom + 8);
        return this.roundTo(metersPerPixel, 3);
    }

    // ========================================
    // 座標変換ヘルパー関数
    // ========================================

    latLonToXY(lat, lon) {
        const scale = Math.pow(2, this.zoom) * 256 / (2 * Math.PI);
        
        const centerX = this.lonToX(this.centerLon, scale);
        const centerY = this.latToY(this.centerLat, scale);
        const targetX = this.lonToX(lon, scale);
        const targetY = this.latToY(lat, scale);

        return {
            x: targetX - centerX,
            y: centerY - targetY
        };
    }

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

    // ========================================
    // ユーティリティ関数
    // ========================================

    toNumber(value) {
        if (typeof value === 'number') {
            return value;
        }
        const num = Number(value);
        return isNaN(num) ? 0 : num;
    }

    roundTo(value, decimals) {
        const multiplier = Math.pow(10, decimals);
        return Math.round(value * multiplier) / multiplier;
    }
}

// TurboWarp/Scratchに拡張機能を登録
(function() {
    if (typeof Scratch === 'undefined') {
        console.error('Scratch拡張機能APIが見つかりません。TurboWarpで実行してください。');
        return;
    }
    
    Scratch.extensions.register(new ScratchMapExtension());
    console.log('地図拡張機能の登録が完了しました！');
})();
